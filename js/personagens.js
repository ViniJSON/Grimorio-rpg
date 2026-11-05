// Guarda os personagens no navegador (localStorage). Usado por fichas.js e pelo app.js (botão "Adicionar à ficha").
const Personagens = (() => {
  const KEY = 'grimorio.personagens.v1';
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const listar = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  };
  const gravar = lista => { localStorage.setItem(KEY, JSON.stringify(lista)); api.aoMudar?.(); };
  const iniciado = () => localStorage.getItem(KEY) !== null;
  const obter = id => listar().find(p => p.id === id);

  const novo = () => ({
    id: uid(), nome: '', imagem: '', raca: '', classe: '', nivel: 1, aparencia: '', historia: '',
    vida: { atual: 10, max: 10 }, energia: { atual: 10, max: 10 },
    habilidades: [], defesa: 10, forca: 0, agilidade: 0, inteligencia: 0, carisma: 0,
    inventario: [], atualizado: Date.now()
  });

  function salvar(p) {
    const lista = listar(), i = lista.findIndex(x => x.id === p.id);
    p.atualizado = Date.now();
    if (i >= 0) lista[i] = p; else lista.push(p);
    gravar(lista);
    return p;
  }
  const excluir = id => gravar(listar().filter(p => p.id !== id));

  // Converte um card do site (item da loja) no formato do inventário
  const itemDeCard = c => ({
    nome: c.nome, imagem: c.imagem || '', categoria: c.categoria || '', raridade: c.raridade || '',
    valor: c.valor || '', peso: c.peso || '',
    efeitos: Array.isArray(c.efeitos) ? c.efeitos.join(', ') : (c.efeitos || ''),
    detalhes: Object.entries(c.atributos || {}).map(([k, v]) => `${k}: ${v}`).join(' · '),
    descricao: c.descricao || ''
  });

  // Soma 1 se o personagem já tem o item (mesmo nome); senão cria a linha
  function adicionarItem(pid, item, qtd = 1) {
    const p = obter(pid);
    if (!p) return null;
    const ja = p.inventario.find(i => i.nome === item.nome);
    if (ja) ja.qtd += qtd; else p.inventario.push({ id: uid(), qtd, ...item });
    return salvar(p);
  }

  const exportar = () => JSON.stringify({ grimorio: 1, personagens: listar() }, null, 2);

  // Importa um backup: com id igual, vence o que foi alterado por último; os demais são adicionados
  function importar(texto) {
    const d = JSON.parse(texto);
    const novos = Array.isArray(d) ? d : d.personagens;
    if (!Array.isArray(novos)) throw new Error('arquivo não parece um backup do Grimório');
    const lista = listar();
    novos.forEach(p => {
      if (!p || !p.id) return;
      const i = lista.findIndex(x => x.id === p.id);
      if (i < 0) lista.push(p); else if ((p.atualizado || 0) >= (lista[i].atualizado || 0)) lista[i] = p;
    });
    gravar(lista);
    return novos.length;
  }

  const api = { listar, obter, novo, salvar, excluir, itemDeCard, adicionarItem, exportar, importar, uid, iniciado, aoMudar: null };
  return api;
})();

// Arquivo JSON vinculado (File System Access API: Chrome/Edge no computador).
// Depois de vinculado, cada alteração nas fichas é gravada direto no arquivo.
const ArquivoJson = (() => {
  const suportado = 'showOpenFilePicker' in window;
  let handle = null, fila = Promise.resolve(), timer = null;
  const api = { suportado, estado: 'nenhum', nome: '', erro: '', aoEstado: null };
  const muda = (estado, erro = '') => { api.estado = estado; api.erro = erro; api.nome = handle ? handle.name : ''; api.aoEstado?.(); };

  const banco = () => new Promise((ok, err) => {
    const r = indexedDB.open('grimorio', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('h');
    r.onsuccess = () => ok(r.result); r.onerror = () => err(r.error);
  });
  const guardar = async h => { const d = await banco(); d.transaction('h', 'readwrite').objectStore('h').put(h, 'arquivo'); };
  const esquecer = async () => { const d = await banco(); d.transaction('h', 'readwrite').objectStore('h').delete('arquivo'); };
  const lembrado = async () => { const d = await banco(); return new Promise(ok => { const q = d.transaction('h').objectStore('h').get('arquivo'); q.onsuccess = () => ok(q.result); q.onerror = () => ok(null); }); };

  // Lê o arquivo (mesclando com o que há no navegador) e grava a lista completa de volta
  async function sincronizar() {
    const texto = await (await handle.getFile()).text();
    if (texto.trim()) Personagens.importar(texto);
    await escrever();
  }
  async function escrever() {
    const w = await handle.createWritable();
    await w.write(Personagens.exportar()); await w.close();
  }
  async function usar(h) {
    handle = h;
    try { await sincronizar(); await guardar(h); muda('pronto'); }
    catch (e) { muda('erro', e.message); }
  }

  api.iniciar = async () => {
    if (!suportado) return;
    try {
      handle = await lembrado();
      if (!handle) return;
      muda((await handle.queryPermission({ mode: 'readwrite' })) === 'granted' ? 'pronto' : 'permissao');
      if (api.estado === 'pronto') await sincronizar();
    } catch (e) { muda('erro', e.message); }
  };
  const tipos = [{ description: 'Fichas do Grimório (JSON)', accept: { 'application/json': ['.json'] } }];
  api.abrir = async () => { try { const [h] = await showOpenFilePicker({ types: tipos }); await usar(h); } catch (e) { if (e.name !== 'AbortError') muda('erro', e.message); } };
  api.criar = async () => { try { await usar(await showSaveFilePicker({ suggestedName: 'personagens.json', types: tipos })); } catch (e) { if (e.name !== 'AbortError') muda('erro', e.message); } };
  api.reconectar = async () => {
    try {
      if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') return;
      await sincronizar(); muda('pronto');
    } catch (e) { muda('erro', e.message); }
  };
  api.desvincular = async () => { handle = null; await esquecer(); muda('nenhum'); };
  api.usar = usar; // (para testes)

  // Grava depois de cada alteração (agrupa várias em uma só)
  Personagens.aoMudar = () => {
    if (!handle || api.estado !== 'pronto') return;
    clearTimeout(timer);
    timer = setTimeout(() => { fila = fila.then(escrever).then(() => muda('pronto'), e => muda('erro', e.message)); }, 250);
  };
  return api;
})();
