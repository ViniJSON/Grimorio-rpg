// Salvos como bloco reutilizável: resultados dos oráculos guardados, divididos por grupo (NPCs, Masmorras, ...).
// Usado na página Salvos (todos) e dentro da campanha (só os dela).
//   SalvosView.montar(elemento, { campanhaId })   // campanhaId vazio = página Salvos
const SalvosView = (() => {
  // Nomes bonitos para os geradores conhecidos; um gerador novo vira um grupo com o próprio nome.
  const NOMES = { npc: 'NPCs', masmorra: 'Masmorras', anomalia: 'Anomalias' };
  function grupoDe(r) {
    const base = String(r.gerador || 'Outros').replace(/^gerador de\s+/i, '').trim() || 'Outros', id = base.toLowerCase();
    return { id, nome: NOMES[id] || base.charAt(0).toUpperCase() + base.slice(1) };
  }
  // NPCs primeiro, depois os outros em ordem alfabética
  const ordemGrupos = (a, b) => (b.id === 'npc') - (a.id === 'npc') || a.nome.localeCompare(b.nome, 'pt-BR');

  function montar(el, opts = {}) {
    const embutido = !!opts.campanhaId;
    let LISTA = [], filtro = '', filtroCamp = '', busca = '', imgAlvo = null;
    const nomeCamp = id => (id && typeof Campanhas !== 'undefined' ? Campanhas.obter(id)?.nome : '') || '';

    const cardHtml = r => `
    <div class="col-12 col-md-6 col-lg-4"><div class="card card-dossie h-100" data-id="${esc(r.id)}">
      <div class="salvo-foto" data-acao="${r.imagem ? 'ampliar' : 'imagem'}" title="${r.imagem ? 'Ampliar' : 'Adicionar imagem'}">
        ${r.imagem ? `<img src="${esc(r.imagem)}" alt="${esc(r.nome)}">` : '<span>＋ adicionar imagem</span>'}
      </div>
      <div class="card-body">
        <h5 class="nome-agente">${esc(r.nome)}</h5>
        <div class="campo-mini mb-1"><b>${esc(r.gerador)}</b> · ${esc(r.genero)}${!embutido && r.campanhaId ? ` · 📖 ${esc(nomeCamp(r.campanhaId) || 'campanha removida')}` : ''}</div>
        <hr style="border-color:#444;margin:8px 0;">
        ${(r.linhas || []).map(l => `<div class="linha-res"><b>${esc(l.rotulo)}:</b> ${esc(l.texto)}</div>`).join('')}
        ${r.notas ? `<div class="info-label">NOTAS:</div><div class="info-texto" style="white-space:pre-wrap;">${esc(r.notas)}</div>` : ''}
        <div class="acoes-orac">
          <button type="button" class="btn-fantasma" data-acao="editar">Editar</button>
          <button type="button" class="btn-fantasma" data-acao="imagem">${r.imagem ? 'Trocar imagem' : 'Imagem'}</button>
          ${r.imagem ? '<button type="button" class="btn-fantasma" data-acao="img-remover">Tirar imagem</button>' : ''}
          ${embutido ? '<button type="button" class="btn-fantasma" data-acao="desvincular">Tirar da campanha</button>' : ''}
          <button type="button" class="btn-fantasma btn-perigo" data-acao="excluir">Excluir</button>
        </div>
      </div>
    </div></div>`;

    function desenhar() {
      const doEscopo = embutido ? LISTA.filter(r => r.campanhaId === opts.campanhaId) : LISTA;
      const q = busca.trim().toLowerCase();
      const grupos = new Map();
      doEscopo.forEach(r => { const g = grupoDe(r); (grupos.get(g.id) || grupos.set(g.id, { ...g, itens: [] }).get(g.id)).itens.push(r); });
      const todos = [...grupos.values()].sort(ordemGrupos);
      if (filtro && !grupos.has(filtro)) filtro = '';
      const passa = r => (!q || (r.nome + ' ' + (r.notas || '') + ' ' + (r.linhas || []).map(l => l.texto).join(' ')).toLowerCase().includes(q)) &&
        (embutido || !filtroCamp || (filtroCamp === '__nenhuma__' ? !r.campanhaId : r.campanhaId === filtroCamp));
      const visiveis = todos.filter(g => !filtro || g.id === filtro).map(g => ({ ...g, itens: g.itens.filter(passa) })).filter(g => g.itens.length);
      const soltos = embutido ? LISTA.filter(r => !r.campanhaId) : [];
      const camps = !embutido && typeof Campanhas !== 'undefined' ? Campanhas.listar() : [];

      el.innerHTML = `
        ${embutido ? '' : `<div class="d-flex flex-wrap gap-2 justify-content-center mt-4 mb-2">
          <button class="btn-fantasma" data-acao="exportar">Exportar backup</button>
          <button class="btn-fantasma" data-acao="importar">Importar backup</button>
          <input type="file" class="arq-backup" accept=".json,application/json" hidden></div>`}
        <input type="file" class="arq-imagem" accept="image/*" hidden>
        ${doEscopo.length ? `<div class="pilulas mt-3">
            <a href="#" data-acao="filtro" data-f="" class="${filtro === '' ? 'ativo' : ''}">Todos (${doEscopo.length})</a>
            ${todos.map(g => `<a href="#" data-acao="filtro" data-f="${esc(g.id)}" class="${g.id === filtro ? 'ativo' : ''}">${esc(g.nome)} (${g.itens.length})</a>`).join('')}
          </div>
          <div class="d-flex flex-wrap gap-2 justify-content-center mb-4">
            <input class="campo" style="max-width:320px;" type="search" data-busca placeholder="Buscar nos salvos..." value="${esc(busca)}">
            ${camps.length ? `<select class="campo" style="max-width:260px;" data-filtro-camp aria-label="Filtrar por campanha"><option value="">Todas as campanhas</option><option value="__nenhuma__" ${filtroCamp === '__nenhuma__' ? 'selected' : ''}>Sem campanha</option>${camps.map(c => `<option value="${esc(c.id)}" ${filtroCamp === c.id ? 'selected' : ''}>${esc(c.nome || 'Sem nome')}</option>`).join('')}</select>` : ''}
          </div>` : ''}
        ${visiveis.map(g => `<details class="gerador" open data-grupo="${esc(g.id)}">
            <summary>${esc(g.nome)} <small>${g.itens.length}</small></summary>
            <div class="gerador-corpo"><div class="row g-4">${g.itens.map(cardHtml).join('')}</div></div></details>`).join('')
          || `<p class="text-center text-muted mt-4">${doEscopo.length ? 'Nada encontrado.' : embutido ? 'Nada salvo nesta campanha ainda. Use um oráculo na aba <b>Oráculos</b> e clique em Salvar.' : 'Nada salvo ainda. Em <a href="oraculos.html" style="color:#ff3333;">Oráculos</a> (ou dentro de uma campanha), role um gerador e clique em <b>Salvar</b>.'}</p>`}
        ${soltos.length ? `<details class="gerador mt-4"><summary>Salvos sem campanha <small>${soltos.length}</small></summary><div class="gerador-corpo">
            ${soltos.map(r => `<div class="d-flex flex-wrap align-items-center gap-2 mb-2" data-id="${esc(r.id)}"><span class="flex-grow-1"><b>${esc(r.nome)}</b> <small class="text-muted">${esc(r.gerador)}</small></span>
              <button type="button" class="btn-fantasma" data-acao="vincular">Trazer para esta campanha</button></div>`).join('')}</div></details>` : ''}
        ${embutido ? '' : `<div class="painel-arquivo">${Dados.estado.usuario ? 'Seus salvos estão <b>sincronizados com a sua conta</b> e também guardados neste aparelho.' : 'Os salvos ficam <b>neste navegador</b>. Entre na sua conta (menu) para sincronizar entre aparelhos.'} Use <b>Exportar backup</b> de vez em quando e <b>Importar backup</b> para trazer de volta.</div>`}`;
    }

    async function recarregar() { LISTA = await Salvos.listar(); desenhar(); }
    const achar = b => LISTA.find(r => r.id === b.closest('[data-id]').dataset.id);

    // ---------- Edição ----------
    function abrirEdicao(r) {
      const camps = !embutido && typeof Campanhas !== 'undefined' ? Campanhas.listar() : [];
      const fundo = document.createElement('div');
      fundo.className = 'ficha-fundo'; fundo.style.zIndex = 2200;
      fundo.innerHTML = `<form class="picker-box" style="width:min(520px,100%);max-height:92vh;overflow:auto;">
        <h5 class="nome-agente mb-3">Editar</h5>
        <label class="rotulo">Nome<input class="campo" name="nome" value="${esc(r.nome)}"></label>
        <label class="rotulo mt-2">Resultados (um por linha, “Título: valor”)<textarea class="campo" name="linhas" rows="9">${esc((r.linhas || []).map(l => `${l.rotulo}: ${l.texto}`).join('\n'))}</textarea></label>
        <label class="rotulo mt-2">Notas<textarea class="campo" name="notas" rows="4" placeholder="Segredos, ganchos, onde apareceu...">${esc(r.notas || '')}</textarea></label>
        ${camps.length ? `<label class="rotulo mt-2">Campanha<select class="campo" name="campanha"><option value="">— nenhuma —</option>${camps.map(c => `<option value="${esc(c.id)}" ${c.id === r.campanhaId ? 'selected' : ''}>${esc(c.nome || 'Sem nome')}</option>`).join('')}</select></label>` : ''}
        <div class="d-flex gap-2 mt-3"><button class="btn-rolar" type="submit">Salvar</button><button class="btn-fantasma" type="button" data-fechar>Cancelar</button></div>
      </form>`;
      document.body.appendChild(fundo);
      fundo.querySelector('[name=nome]').focus();
      fundo.addEventListener('click', e => { if (e.target === fundo || e.target.closest('[data-fechar]')) fundo.remove(); });
      fundo.querySelector('form').addEventListener('submit', async e => {
        e.preventDefault();
        const f = e.target, nome = f.nome.value.trim();
        if (!nome) return aviso('O nome não pode ficar vazio');
        r.nome = nome; r.notas = f.notas.value.trim();
        if (f.campanha) r.campanhaId = f.campanha.value;
        r.linhas = f.linhas.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(s => {
          const i = s.indexOf(':');
          return i > 0 ? { rotulo: s.slice(0, i).trim(), texto: s.slice(i + 1).trim() } : { rotulo: '', texto: s };
        });
        try { await Salvos.salvar(r); fundo.remove(); aviso('Alterações salvas'); desenhar(); }
        catch (err) { aviso('Não consegui salvar: ' + err.message); }
      });
    }
    function ampliar(r) {
      const fundo = document.createElement('div');
      fundo.className = 'ficha-fundo'; fundo.style.zIndex = 2200;
      fundo.innerHTML = `<img src="${esc(r.imagem)}" alt="${esc(r.nome)}" style="max-width:100%;max-height:100%;border:1px solid #8b0000;">`;
      fundo.addEventListener('click', () => fundo.remove());
      document.body.appendChild(fundo);
    }

    const acoes = {
      filtro(b) { filtro = b.dataset.f; desenhar(); },
      editar(b) { abrirEdicao(achar(b)); },
      ampliar(b) { ampliar(achar(b)); },
      imagem(b) { imgAlvo = achar(b).id; el.querySelector('.arq-imagem').click(); },
      async 'img-remover'(b) { const r = achar(b); r.imagem = ''; await Salvos.salvar(r); desenhar(); },
      async desvincular(b) { const r = achar(b); r.campanhaId = ''; await Salvos.salvar(r); aviso('Tirado da campanha (continua em Salvos)'); desenhar(); },
      async vincular(b) { const r = achar(b); r.campanhaId = opts.campanhaId; await Salvos.salvar(r); aviso('Trazido para esta campanha'); desenhar(); },
      async excluir(b) {
        const r = achar(b);
        if (!confirm(`Excluir "${r.nome}"? Isso não pode ser desfeito (a menos que você tenha um backup).`)) return;
        await Salvos.excluir(r.id); aviso('Excluído'); recarregar();
      },
      async exportar() { if (!LISTA.length) return aviso('Não há nada para exportar'); baixarTexto('grimorio-salvos.json', await Salvos.exportar()); },
      importar() { el.querySelector('.arq-backup').click(); }
    };

    el.addEventListener('click', e => {
      const b = e.target.closest('[data-acao]'); if (!b) return;
      if (b.tagName === 'A') e.preventDefault();
      Promise.resolve().then(() => acoes[b.dataset.acao]?.(b)).catch(err => aviso('Erro: ' + err.message));
      e.stopPropagation();
    });
    el.addEventListener('input', e => {
      if (!e.target.matches('[data-busca]')) return;
      busca = e.target.value; const pos = e.target.selectionStart; desenhar();
      const n = el.querySelector('[data-busca]'); n.focus(); n.setSelectionRange(pos, pos);
      e.stopPropagation();
    });
    el.addEventListener('change', async e => {
      e.stopPropagation();
      if (e.target.matches('[data-filtro-camp]')) { filtroCamp = e.target.value; return desenhar(); }
      const f = e.target.files && e.target.files[0]; if (!f) return;
      try {
        if (e.target.classList.contains('arq-imagem')) {
          const r = LISTA.find(x => x.id === imgAlvo);
          if (r) { r.imagem = await reduzir(f); await Salvos.salvar(r); aviso('Imagem salva'); desenhar(); }
        } else if (e.target.classList.contains('arq-backup')) {
          aviso((await Salvos.importar(await f.text())) + ' item(ns) importado(s)'); recarregar();
        }
      } catch (err) { aviso('Falha: ' + err.message); }
      e.target.value = '';
    });

    let off; off = Dados.ouvir('sync', cols => {
      if (!el.isConnected) return off();
      if (cols.includes('salvos') && !document.querySelector('.ficha-fundo')) recarregar();
    });
    return recarregar().then(() => ({ recarregar }));
  }
  return { montar, grupoDe };
})();
