// Camada de dados única do Grimório (fichas, campanhas e salvos).
//  - Tudo fica em memória + IndexedDB: rápido, sem limite pequeno de espaço e funciona offline.
//  - Se houver login (Supabase), sincroniza em segundo plano. Sem login/config, funciona só no navegador.
//  - Conflito: vence o registro com "atualizado" mais recente. Exclusão vira "lápide" para sincronizar entre aparelhos.
const Dados = (() => {
  const COLECOES = ['personagens', 'campanhas', 'salvos'];
  const cfg = window.GRIMORIO_CONFIG || {};
  const BUCKET = cfg.bucket || 'imagens';
  const SDK_URL = cfg.sdkUrl || 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  const mem = Object.fromEntries(COLECOES.map(c => [c, new Map()]));
  const estado = { nuvem: !!(cfg.supabaseUrl && cfg.supabaseAnonKey), usuario: null, sync: 'local', erro: '', ultimaSync: 0 };
  const ouvintes = {};
  let idb = null, sb = null, rodando = null, repetir = false, timer = null;

  const ouvir = (tipo, fn) => { (ouvintes[tipo] ||= new Set()).add(fn); return () => ouvintes[tipo].delete(fn); };
  const emitir = (tipo, arg) => (ouvintes[tipo] || []).forEach(fn => { try { fn(arg); } catch (e) { console.error(e); } });
  const mudaEstado = (sync, erro = '') => { estado.sync = sync; estado.erro = erro; emitir('estado'); };
  const clone = x => structuredClone(x);
  const vivos = col => [...mem[col].values()].filter(r => !r.excluido);

  // ---------- IndexedDB ----------
  const abrirIdb = () => new Promise((ok, err) => {
    if (!window.indexedDB) return err(new Error('este navegador não permite salvar dados aqui'));
    const r = indexedDB.open('grimorio-dados', 1);
    r.onupgradeneeded = () => COLECOES.forEach(c => r.result.createObjectStore(c, { keyPath: 'id' }));
    r.onsuccess = () => ok(r.result); r.onerror = () => err(r.error || new Error('falha ao abrir o armazenamento'));
  });
  const idbOp = (col, modo, fn) => new Promise((ok, err) => {
    if (!idb) return ok();
    const t = idb.transaction(col, modo), req = fn(t.objectStore(col));
    t.oncomplete = () => ok(req && req.result); t.onerror = t.onabort = () => err(t.error || new Error('falha ao gravar'));
  });
  const gravarLocal = (col, rec) => idbOp(col, 'readwrite', s => s.put(rec)).catch(e => { console.error(e); if (typeof aviso === 'function') aviso('Não consegui gravar no navegador: ' + e.message); });
  const limparLocal = col => { mem[col].clear(); return idbOp(col, 'readwrite', s => s.clear()).catch(() => {}); };

  // ---------- Migração do armazenamento antigo (uma vez) ----------
  async function migrarLegado() {
    if (localStorage.getItem('grimorio.dados.migrado')) return;
    const juntar = (col, lista) => (lista || []).forEach(r => {
      if (!r || !r.id) return;
      const a = mem[col].get(r.id);
      if (!a || (r.atualizado || 0) > (a.atualizado || 0)) { mem[col].set(r.id, r); gravarLocal(col, r); }
    });
    const ls = k => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
    juntar('personagens', ls('grimorio.personagens.v1'));
    juntar('campanhas', ls('grimorio.campanhas.v1').map(c => ({ ...c, sessoes: Array.isArray(c.sessoes) ? c.sessoes : [] })));
    try {   // salvos ficavam noutro banco do navegador
      const velho = await new Promise((ok, err) => { const r = indexedDB.open('grimorio-salvos'); r.onsuccess = () => ok(r.result); r.onerror = () => err(r.error); });
      if (velho.objectStoreNames.contains('itens')) {
        const lista = await new Promise(ok => { const q = velho.transaction('itens').objectStore('itens').getAll(); q.onsuccess = () => ok(q.result); q.onerror = () => ok([]); });
        juntar('salvos', lista);
      }
      velho.close();
    } catch { /* sem dados antigos */ }
    localStorage.setItem('grimorio.dados.migrado', '1');   // os dados antigos continuam intactos como cópia de segurança
  }

  // ---------- API local ----------
  const listar = col => vivos(col).map(clone);
  const obter = (col, id) => { const r = mem[col].get(id); return r && !r.excluido ? clone(r) : undefined; };

  function salvar(col, rec) {
    rec.atualizado = Date.now();
    mem[col].set(rec.id, clone(rec));
    gravarLocal(col, mem[col].get(rec.id));
    emitir('mudou:' + col); agendar();
    return rec;
  }
  function excluir(col, id) {
    const r = mem[col].get(id);
    if (r && r.imagemCaminho && sb && estado.usuario) sb.storage.from(BUCKET).remove([r.imagemCaminho]).catch(() => {});
    const lapide = { id, excluido: true, atualizado: Date.now() };
    mem[col].set(id, lapide); gravarLocal(col, lapide);
    emitir('mudou:' + col); agendar();
  }

  const exportar = col => JSON.stringify({ grimorio: 1, [col]: listar(col) }, null, 2);
  function importar(col, texto, normalizar = r => r) {
    const d = JSON.parse(texto), novos = Array.isArray(d) ? d : d[col];
    if (!Array.isArray(novos)) throw new Error(`arquivo não parece um backup de ${col} do Grimório`);
    novos.forEach(r => {
      if (!r || !r.id) return;
      const a = mem[col].get(r.id);
      if (!a || (r.atualizado || 0) >= (a.atualizado || 0)) { const x = normalizar(clone(r)); mem[col].set(x.id, x); gravarLocal(col, x); }
    });
    emitir('mudou:' + col); agendar();
    return novos.length;
  }

  // ---------- Nuvem (Supabase) ----------
  const carregarSdk = () => window.supabase ? Promise.resolve() : new Promise((ok, err) => {
    const s = document.createElement('script'); s.src = SDK_URL; s.onload = ok;
    s.onerror = () => err(new Error('não consegui carregar o Supabase (sem internet?)')); document.head.appendChild(s);
  });

  async function iniciarNuvem() {
    try {
      await carregarSdk();
      sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      sb.auth.onAuthStateChange((_ev, sessao) => aplicarSessao(sessao));
      const { data } = await sb.auth.getSession();
      await aplicarSessao(data.session);
      addEventListener('online', () => sincronizar());
      document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - estado.ultimaSync > 30000) sincronizar(); });
    } catch (e) { mudaEstado('erro', e.message); }
  }

  async function aplicarSessao(sessao) {
    const u = sessao && sessao.user ? { id: sessao.user.id, email: sessao.user.email } : null;
    if (u && estado.usuario && u.id === estado.usuario.id) return;
    if (u) {
      const ultimo = localStorage.getItem('grimorio.ultimoUsuario');
      const temDados = COLECOES.some(c => vivos(c).length);
      if (ultimo && ultimo !== u.id && temDados &&
          confirm('Este navegador tem dados de outra conta.\n\nOK = descartar os dados locais e entrar limpo.\nCancelar = juntar tudo na conta atual.')) {
        await Promise.all(COLECOES.map(limparLocal)); COLECOES.forEach(c => emitir('mudou:' + c));
      }
      localStorage.setItem('grimorio.ultimoUsuario', u.id);
    }
    estado.usuario = u; mudaEstado(u ? 'ocioso' : 'local');
    if (u) sincronizar();
  }

  const traduzir = e => {
    const m = String(e && e.message || e);
    if (/invalid login/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/not confirmed/i.test(m)) return 'Confirme seu e-mail primeiro (veja a caixa de entrada).';
    if (/already registered/i.test(m)) return 'Esse e-mail já tem conta. Use Entrar.';
    if (/at least 6/i.test(m)) return 'A senha precisa de pelo menos 6 caracteres.';
    if (/rate limit/i.test(m)) return 'Muitas tentativas. Espere um pouco e tente de novo.';
    return m;
  };
  const auth = {
    async entrar(email, senha) { const { error } = await sb.auth.signInWithPassword({ email, password: senha }); if (error) throw new Error(traduzir(error)); },
    async criar(email, senha) {
      const { data, error } = await sb.auth.signUp({ email, password: senha });
      if (error) throw new Error(traduzir(error));
      return data.session ? 'ok' : 'confirmar';
    },
    async sair() { await sb.auth.signOut(); }
  };

  // Sobe imagens novas (data URL) para o Storage e troca por URL pública; apaga a antiga
  async function prepararImagem(col, rec) {
    if (rec.excluido) return;
    const antigo = rec.imagemCaminho;
    if (!rec.imagem && antigo) { sb.storage.from(BUCKET).remove([antigo]).catch(() => {}); delete rec.imagemCaminho; return gravarLocal(col, rec); }
    if (!String(rec.imagem || '').startsWith('data:')) return;
    const blob = await (await fetch(rec.imagem)).blob();
    const caminho = `${estado.usuario.id}/${col}/${rec.id}-${Date.now()}.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`;
    const { error } = await sb.storage.from(BUCKET).upload(caminho, blob, { contentType: blob.type, cacheControl: '31536000' });
    if (error) throw error;
    rec.imagem = sb.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
    rec.imagemCaminho = caminho;
    gravarLocal(col, rec);
    if (antigo) sb.storage.from(BUCKET).remove([antigo]).catch(() => {});
  }

  async function sincronizarColecao(col) {
    const { data: idx, error } = await sb.from(col).select('id,atualizado,excluido');
    if (error) throw error;
    const remoto = new Map(idx.map(r => [r.id, r]));
    // 1) baixa só o que é mais novo no servidor
    const baixar = idx.filter(r => { const l = mem[col].get(r.id); return !l || r.atualizado > (l.atualizado || 0); }).map(r => r.id);
    let mudou = false;
    for (let i = 0; i < baixar.length; i += 50) {
      const { data, error: e2 } = await sb.from(col).select('id,dados,atualizado,excluido').in('id', baixar.slice(i, i + 50));
      if (e2) throw e2;
      data.forEach(r => {
        const rec = r.excluido ? { id: r.id, excluido: true, atualizado: r.atualizado } : { ...r.dados, id: r.id, atualizado: r.atualizado };
        mem[col].set(r.id, rec); gravarLocal(col, rec); mudou = true;
      });
    }
    // 2) sobe o que é mais novo aqui (ou não existe no servidor)
    const subir = [...mem[col].values()].filter(l => { const r = remoto.get(l.id); return !r || (l.atualizado || 0) > r.atualizado; });
    for (const rec of subir) await prepararImagem(col, rec);
    for (let i = 0; i < subir.length; i += 50) {
      const linhas = subir.slice(i, i + 50).map(r => ({ user_id: estado.usuario.id, id: r.id, dados: r.excluido ? {} : r, atualizado: r.atualizado || Date.now(), excluido: !!r.excluido }));
      const { error: e3 } = await sb.from(col).upsert(linhas, { onConflict: 'user_id,id' });
      if (e3) throw e3;
    }
    return mudou ? col : null;
  }

  function sincronizar() {
    if (!sb || !estado.usuario) return Promise.resolve();
    if (rodando) { repetir = true; return rodando; }
    rodando = (async () => {
      mudaEstado('sincronizando');
      const mudaram = [];
      try {
        for (const col of COLECOES) { const m = await sincronizarColecao(col); if (m) mudaram.push(m); }
        estado.ultimaSync = Date.now(); mudaEstado('ocioso');
      } catch (e) { mudaEstado('erro', (e && e.message) || String(e)); }
      rodando = null;
      mudaram.forEach(c => emitir('mudou:' + c));
      if (mudaram.length) emitir('sync', mudaram);
      if (repetir) { repetir = false; await sincronizar(); }
    })();
    return rodando;
  }
  function agendar() { if (!sb || !estado.usuario) return; clearTimeout(timer); timer = setTimeout(sincronizar, 1200); }

  // ---------- Início ----------
  async function iniciar() {
    try { idb = await abrirIdb(); } catch (e) { console.warn(e); estado.erro = e.message; }
    if (idb) for (const col of COLECOES) {
      const todos = await idbOp(col, 'readonly', s => s.getAll());
      (todos || []).forEach(r => mem[col].set(r.id, r));
    }
    await migrarLegado();
    if (estado.nuvem) iniciarNuvem();   // em segundo plano: não atrasa a tela
  }
  const pronto = iniciar();

  return { COLECOES, estado, pronto, ouvir, listar, obter, salvar, excluir, exportar, importar, auth, sincronizar,
    total: col => mem[col].size, temLegado: () => !!localStorage.getItem('grimorio.personagens.v1'),
    __testarNuvem(cliente, usuario) { sb = cliente; estado.nuvem = true; estado.usuario = usuario; } };   // só para testes
})();
