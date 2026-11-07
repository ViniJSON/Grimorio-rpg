// Página de campanhas: lista, campanha (com sessões) e edição. Dados em js/campanhas-db.js

// ---------- Utilidades ----------
let GENEROS = [['fantasia', 'Fantasia'], ['terror', 'Terror'], ['mundo-moderno', 'Mundo moderno']];
const rotuloGenero = id => {
  const g = GENEROS.find(([k]) => k === id);
  if (g) return g[1];
  const t = String(id || 'outro').replace(/-/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
};
async function carregarGeneros() {
  try {
    const m = await (await fetch('data/manifest.json')).json();
    const ids = [...new Set(Object.values(m).flat())];
    if (ids.length) GENEROS = ids.map(id => [id, rotuloGenero(id)]);
  } catch {}
  GENEROS = GENEROS.filter(([k]) => k !== 'outro').concat([['outro', 'Outro']]);
}

const miniatura = c => c.imagem ? `<img src="${esc(c.imagem)}" alt="">` : '<span>sem imagem</span>';

// ---------- Estado ----------
let tela = 'lista';      // 'lista' | 'campanha' | 'editar' | 'sessao'
let atual = null;        // campanha aberta
let sessao = null;       // sessão em edição
let ehNovo = false;
let filtro = '';         // gênero filtrado na lista
let abrirId = '';        // sessão que deve aparecer aberta ao desenhar a campanha

// ---------- Lista ----------
function capa(c, classe = 'foto-capa') {
  return c.imagem
    ? `<img src="${esc(c.imagem)}" class="${classe}" alt="${esc(c.nome)}">`
    : `<div class="capa-vazia">sem imagem</div>`;
}

function telaLista() {
  const todas = Campanhas.listar().sort((a, b) => b.atualizado - a.atualizado);
  const generos = [...new Set(todas.map(c => c.genero))];
  if (filtro && !generos.includes(filtro)) filtro = '';
  const ps = todas.filter(c => !filtro || c.genero === filtro);
  raiz.innerHTML = `
    <div class="d-flex flex-wrap gap-2 justify-content-center mt-4">
      <button class="btn-rolar" data-acao="nova-camp">＋ Nova campanha</button>
      <button class="btn-fantasma" data-acao="exportar">Exportar backup</button>
      <button class="btn-fantasma" data-acao="importar">Importar backup</button>
      <input type="file" id="arquivo-backup" accept=".json,application/json" hidden>
    </div>
    ${generos.length > 1 ? `<div class="pilulas mt-4">
      <a href="#" data-acao="filtro" data-g="" class="${filtro ? '' : 'ativo'}">Todas</a>
      ${generos.map(g => `<a href="#" data-acao="filtro" data-g="${esc(g)}" class="${filtro === g ? 'ativo' : ''}">${esc(rotuloGenero(g))}</a>`).join('')}
    </div>` : ''}
    ${ps.length ? `<div class="row g-4 mt-1">${ps.map(c => {
      const n = c.sessoes.length;
      return `<div class="col-12 col-md-6 col-lg-4"><div class="card card-dossie clicavel h-100" data-id="${esc(c.id)}" role="button" tabindex="0">
        ${capa(c)}
        <div class="card-body">
          <h5 class="nome-agente">${esc(c.nome || 'Sem nome')}</h5>
          <div class="id-matricula">${esc(rotuloGenero(c.genero).toUpperCase())} · ${n} ${n === 1 ? 'SESSÃO' : 'SESSÕES'}</div>
          ${c.descricao ? `<div class="info-label">DESCRIÇÃO:</div><div class="info-texto resumo-camp">${esc(c.descricao)}</div>` : ''}
        </div></div></div>`;
    }).join('')}</div>`
      : `<p class="text-center text-muted mt-5">${todas.length ? 'Nenhuma campanha desse gênero.' : 'Nenhuma campanha ainda. Crie a primeira!'}</p>`}
    <div class="painel-arquivo">${Dados.estado.usuario ? 'Suas campanhas estão <b>sincronizadas com a sua conta</b> e também guardadas neste aparelho.' : 'As campanhas ficam salvas <b>neste navegador</b>. Entre na sua conta (menu) para sincronizar entre aparelhos.'} Para guardar uma cópia de segurança, use <b>Exportar backup</b>.</div>`;
}

// ---------- Campanha (visualização + sessões) ----------
function telaCampanha() {
  const c = atual;
  const ss = [...c.sessoes].sort((a, b) => (b.numero || 0) - (a.numero || 0));
  const ultima = c.sessoes.map(s => s.data).filter(Boolean).sort().pop();
  raiz.innerHTML = `
    <div class="d-flex flex-wrap gap-2 mt-4 mb-3">
      <button class="btn-fantasma" data-acao="voltar">← Campanhas</button>
      <button class="btn-rolar" data-acao="editar-camp">Editar campanha</button>
      <button class="btn-fantasma btn-perigo ms-auto" data-acao="excluir-camp">Excluir</button>
    </div>
    <div class="card card-dossie"><div class="card-body p-4">
      <div class="row g-4">
        ${c.imagem ? `<div class="col-12 col-md-5 col-lg-4"><img class="foto-capa borda" src="${esc(c.imagem)}" alt="${esc(c.nome)}"></div>` : ''}
        <div class="col">
          <h2 class="nome-agente">${esc(c.nome || 'Sem nome')}</h2>
          <div class="id-matricula">${esc(rotuloGenero(c.genero).toUpperCase())} · ${c.sessoes.length} ${c.sessoes.length === 1 ? 'SESSÃO' : 'SESSÕES'}${ultima ? ' · ÚLTIMA EM ' + dataBR(ultima) : ''}</div>
          ${c.descricao ? `<hr style="border-color:#444;"><div class="info-texto texto-livre">${esc(c.descricao)}</div>` : ''}
        </div>
      </div>
    </div></div>

    <div class="d-flex flex-wrap align-items-center gap-2 mt-4">
      <h3 class="categoria m-0 flex-grow-1">Sessões</h3>
      <button class="btn-rolar" data-acao="nova-sessao">＋ Nova sessão</button>
    </div>
    <div class="mt-3">
      ${ss.length ? ss.map((s, i) => `
        <details class="gerador" ${(abrirId ? s.id === abrirId : i === 0) ? 'open' : ''} data-sessao="${esc(s.id)}">
          <summary>Sessão ${pad2(s.numero || 0)}${s.titulo ? ' — ' + esc(s.titulo) : ''}${s.data ? `<small>${dataBR(s.data)}</small>` : ''}</summary>
          <div class="gerador-corpo">
            ${s.acontecimentos ? `<div class="info-label">ACONTECIMENTOS:</div><div class="info-texto texto-livre">${esc(s.acontecimentos)}</div>` : '<div class="info-texto text-muted">Nada registrado ainda.</div>'}
            ${s.ganchos ? `<div class="info-label">GANCHOS / PENDÊNCIAS:</div><div class="info-texto texto-livre">${esc(s.ganchos)}</div>` : ''}
            <div class="d-flex gap-2 mt-3">
              <button class="btn-fantasma" data-acao="editar-sessao">Editar</button>
              <button class="btn-fantasma btn-perigo" data-acao="excluir-sessao">Excluir</button>
            </div>
          </div>
        </details>`).join('')
        : '<p class="text-center text-muted mt-4">Nenhuma sessão registrada. Crie a primeira para começar o diário da campanha.</p>'}
    </div>`;
}

// ---------- Edição da campanha ----------
const campoTxt = (n, l, v, ph = '') => `<label class="rotulo">${l}<input class="campo" name="${n}" value="${esc(v)}" placeholder="${esc(ph)}"></label>`;

function telaEditar() {
  const c = atual;
  raiz.innerHTML = `
    <form id="form-camp" class="card card-dossie mt-4"><div class="card-body p-4">
      <h2 class="nome-agente mb-3">${ehNovo ? 'Nova campanha' : 'Editar campanha'}</h2>
      <div class="row g-3">
        <div class="col-12 col-md-8">${campoTxt('nome', 'Nome', c.nome, 'Ex.: A Queda de Valdoria')}</div>
        <div class="col-12 col-md-4"><label class="rotulo">Gênero
          <select class="campo" name="genero">${GENEROS.map(([k, l]) => `<option value="${esc(k)}" ${k === c.genero ? 'selected' : ''}>${esc(l)}</option>`).join('')}
          ${GENEROS.some(([k]) => k === c.genero) ? '' : `<option value="${esc(c.genero)}" selected>${esc(rotuloGenero(c.genero))}</option>`}</select></label></div>
      </div>
      <label class="rotulo mt-3">Descrição<textarea class="campo" name="descricao" rows="5" placeholder="Sinopse, tom, mundo, jogadores...">${esc(c.descricao)}</textarea></label>
      <div class="info-label">IMAGEM:</div>
      <div class="d-flex gap-3 align-items-end flex-wrap">
        <div class="preview-capa">${miniatura(c)}</div>
        <div class="d-flex flex-wrap gap-2"><input type="file" id="arq-imagem" accept="image/*" hidden>
          <button type="button" class="btn-fantasma" data-acao="img-escolher">Escolher imagem</button>
          <button type="button" class="btn-fantasma" data-acao="img-remover">Remover</button></div>
      </div>
      <div class="d-flex gap-2 mt-4">
        <button class="btn-rolar" type="submit">Salvar</button>
        <button class="btn-fantasma" type="button" data-acao="cancelar-camp">Cancelar</button>
      </div>
    </div></form>`;
}

// ---------- Edição da sessão ----------
function telaSessao() {
  const s = sessao;
  raiz.innerHTML = `
    <form id="form-sessao" class="card card-dossie mt-4"><div class="card-body p-4">
      <div class="id-matricula">${esc((atual.nome || 'Sem nome').toUpperCase())}</div>
      <h2 class="nome-agente mb-3">${ehNovo ? 'Nova sessão' : 'Editar sessão'}</h2>
      <div class="row g-3">
        <div class="col-4 col-md-2"><label class="rotulo">Nº<input class="campo" type="number" min="1" name="numero" value="${esc(s.numero)}"></label></div>
        <div class="col-8 col-md-3"><label class="rotulo">Data<input class="campo" type="date" name="data" value="${esc(s.data)}"></label></div>
        <div class="col-12 col-md-7">${campoTxt('titulo', 'Título', s.titulo, 'Ex.: A emboscada na estrada')}</div>
      </div>
      <label class="rotulo mt-3">Acontecimentos<textarea class="campo" name="acontecimentos" rows="12" placeholder="O que aconteceu: cenas, decisões, combates, descobertas, NPCs...">${esc(s.acontecimentos)}</textarea></label>
      <label class="rotulo mt-3">Ganchos / pendências<textarea class="campo" name="ganchos" rows="4" placeholder="Pontas soltas e o que fica para a próxima sessão">${esc(s.ganchos)}</textarea></label>
      <div class="d-flex gap-2 mt-4">
        <button class="btn-rolar" type="submit">Salvar sessão</button>
        <button class="btn-fantasma" type="button" data-acao="cancelar-sessao">Cancelar</button>
      </div>
    </div></form>`;
}

// ---------- Controle ----------
function desenhar() { ({ lista: telaLista, campanha: telaCampanha, editar: telaEditar, sessao: telaSessao })[tela](); window.scrollTo(0, 0); }

function abrir(id, sid = '') {
  atual = Campanhas.obter(id);
  if (!atual) return irLista();
  tela = 'campanha'; ehNovo = false; abrirId = sid;
  history.replaceState(null, '', '#' + id);
  desenhar();
}
function irLista() { tela = 'lista'; atual = null; history.replaceState(null, '', location.pathname); desenhar(); }

const sessaoDe = el => atual.sessoes.find(s => s.id === el.closest('[data-sessao]').dataset.sessao);

const acoes = {
  'nova-camp'() { atual = Campanhas.novo(); ehNovo = true; tela = 'editar'; desenhar(); },
  voltar: irLista,
  'editar-camp'() { tela = 'editar'; ehNovo = false; desenhar(); },
  'cancelar-camp'() { ehNovo ? irLista() : abrir(atual.id); },
  'excluir-camp'() {
    const n = atual.sessoes.length;
    if (confirm(`Excluir a campanha "${atual.nome || 'Sem nome'}"${n ? ` e suas ${n} sessão(ões)` : ''}? Isso não pode ser desfeito.`)) { Campanhas.excluir(atual.id); irLista(); }
  },
  'nova-sessao'() {
    sessao = Campanhas.novaSessao(atual); sessao.data = hoje();
    ehNovo = true; tela = 'sessao'; desenhar();
  },
  'editar-sessao'(el) { sessao = { ...sessaoDe(el) }; ehNovo = false; tela = 'sessao'; desenhar(); },
  'cancelar-sessao'() { abrir(atual.id, ehNovo ? '' : sessao.id); },
  'excluir-sessao'(el) {
    const s = sessaoDe(el);
    if (!confirm(`Excluir a sessão ${pad2(s.numero || 0)}${s.titulo ? ' — ' + s.titulo : ''}? Isso não pode ser desfeito.`)) return;
    atual.sessoes = atual.sessoes.filter(x => x !== s);
    Campanhas.salvar(atual); aviso('Sessão excluída'); abrir(atual.id);
  },
  'img-escolher'() { document.getElementById('arq-imagem').click(); },
  'img-remover'() { atual.imagem = ''; document.querySelector('.preview-capa').innerHTML = miniatura(atual); },
  filtro(el) { filtro = el.dataset.g; desenhar(); },
  exportar() {
    baixarTexto('grimorio-campanhas.json', Campanhas.exportar());
  },
  importar() { document.getElementById('arquivo-backup').click(); }
};

raiz.addEventListener('click', e => {
  const b = e.target.closest('[data-acao]');
  if (b) { if (b.tagName === 'A') e.preventDefault(); return acoes[b.dataset.acao]?.(b); }
  const card = e.target.closest('.clicavel[data-id]');
  if (card) abrir(card.dataset.id);
});
raiz.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.clicavel[data-id]')) { e.preventDefault(); abrir(e.target.dataset.id); }
});

raiz.addEventListener('submit', e => {
  e.preventDefault();
  const f = new FormData(e.target), g = k => String(f.get(k) ?? '').trim();

  if (e.target.id === 'form-camp') {
    atual.nome = g('nome'); atual.genero = g('genero') || 'outro'; atual.descricao = String(f.get('descricao') ?? '').trim();
    if (!atual.nome) return aviso('A campanha precisa de um nome');
    try { Campanhas.salvar(atual); aviso('Campanha salva'); }
    catch { return aviso('Não coube no armazenamento do navegador. Tente uma imagem menor.'); }
    return abrir(atual.id);
  }

  if (e.target.id === 'form-sessao') {
    sessao.numero = Math.max(1, num(g('numero'), 1)); sessao.data = g('data'); sessao.titulo = g('titulo');
    sessao.acontecimentos = String(f.get('acontecimentos') ?? '').trim(); sessao.ganchos = String(f.get('ganchos') ?? '').trim();
    if (!sessao.titulo && !sessao.acontecimentos) return aviso('Escreva um título ou os acontecimentos');
    const i = atual.sessoes.findIndex(s => s.id === sessao.id);
    if (i >= 0) atual.sessoes[i] = sessao; else atual.sessoes.push(sessao);
    try { Campanhas.salvar(atual); aviso('Sessão salva'); }
    catch { return aviso('Não coube no armazenamento do navegador.'); }
    return abrir(atual.id, sessao.id);
  }
});

raiz.addEventListener('change', async e => {
  if (e.target.id === 'arq-imagem' && e.target.files[0]) {
    try { atual.imagem = await reduzir(e.target.files[0], 900); document.querySelector('.preview-capa').innerHTML = miniatura(atual); }
    catch (err) { aviso(err.message); }
    e.target.value = ''; return;
  }
  if (e.target.id !== 'arquivo-backup' || !e.target.files[0]) return;
  const r = new FileReader();
  r.onload = () => {
    try { aviso(Campanhas.importar(r.result) + ' campanha(s) importada(s)'); desenhar(); }
    catch (err) { aviso('Falha ao importar: ' + err.message); }
  };
  r.readAsText(e.target.files[0]);
});

// Início: carrega os gêneros do manifest e abre direto se a URL tiver #id
Dados.ouvir('sync', cols => { if (cols.includes('campanhas') && tela === 'lista') desenhar(); });
(async () => {
  try {
    await Promise.all([carregarGeneros(), Dados.pronto]);
    const id = location.hash.slice(1);
    if (id && Campanhas.obter(id)) return abrir(id);
    desenhar();
  } catch (e) {
    raiz.innerHTML = `<div class="alert alert-danger mt-5 rounded-0">Não consegui acessar o armazenamento do navegador: ${esc(e.message)}</div>`;
  }
})();
