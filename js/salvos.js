// Página Salvos: resultados dos oráculos que você guardou. Dá para renomear, anotar, pôr imagem e excluir.
let LISTA = [];
let filtro = '';          // nome do gerador, '' = todos
let busca = '';
let imgAlvo = null;       // id do registro que vai receber a imagem
let editando = null;      // registro aberto na edição

const cardHtml = r => `
<div class="col-12 col-md-6 col-lg-4"><div class="card card-dossie h-100" data-id="${esc(r.id)}">
  <div class="salvo-foto" data-acao="${r.imagem ? 'ampliar' : 'imagem'}" title="${r.imagem ? 'Ampliar' : 'Adicionar imagem'}">
    ${r.imagem ? `<img src="${esc(r.imagem)}" alt="${esc(r.nome)}">` : '<span>＋ adicionar imagem</span>'}
  </div>
  <div class="card-body">
    <h5 class="nome-agente">${esc(r.nome)}</h5>
    <div class="campo-mini mb-1"><b>${esc(r.gerador)}</b> · ${esc(r.genero)}</div>
    <hr style="border-color:#444;margin:8px 0;">
    ${(r.linhas || []).map(l => `<div class="linha-res"><b>${esc(l.rotulo)}:</b> ${esc(l.texto)}</div>`).join('')}
    ${r.notas ? `<div class="info-label">NOTAS:</div><div class="info-texto" style="white-space:pre-wrap;">${esc(r.notas)}</div>` : ''}
    <div class="acoes-orac">
      <button type="button" class="btn-fantasma" data-acao="editar">Editar</button>
      <button type="button" class="btn-fantasma" data-acao="imagem">${r.imagem ? 'Trocar imagem' : 'Imagem'}</button>
      ${r.imagem ? '<button type="button" class="btn-fantasma" data-acao="img-remover">Tirar imagem</button>' : ''}
      <button type="button" class="btn-fantasma btn-perigo" data-acao="excluir">Excluir</button>
    </div>
  </div>
</div></div>`;

function desenhar() {
  const geradores = [...new Set(LISTA.map(r => r.gerador))].sort();
  if (filtro && !geradores.includes(filtro)) filtro = '';
  const q = busca.trim().toLowerCase();
  const vis = LISTA.filter(r => (!filtro || r.gerador === filtro) &&
    (!q || (r.nome + ' ' + (r.notas || '') + ' ' + (r.linhas || []).map(l => l.texto).join(' ')).toLowerCase().includes(q)));
  raiz.innerHTML = `
    <div class="d-flex flex-wrap gap-2 justify-content-center mt-4 mb-2">
      <button class="btn-fantasma" data-acao="exportar">Exportar backup</button>
      <button class="btn-fantasma" data-acao="importar">Importar backup</button>
      <input type="file" id="arq-backup" accept=".json,application/json" hidden>
      <input type="file" id="arq-imagem" accept="image/*" hidden>
    </div>
    ${LISTA.length ? `<div class="pilulas mt-3">
        <a href="#" data-acao="filtro" data-f="" class="${filtro === '' ? 'ativo' : ''}">Todos (${LISTA.length})</a>
        ${geradores.map(g => `<a href="#" data-acao="filtro" data-f="${esc(g)}" class="${g === filtro ? 'ativo' : ''}">${esc(g)} (${LISTA.filter(r => r.gerador === g).length})</a>`).join('')}
      </div>
      <input class="campo mb-4" style="max-width:360px;margin:0 auto;" type="search" id="busca" placeholder="Buscar nos salvos..." value="${esc(busca)}">`
      : ''}
    <div class="row g-4">${vis.map(cardHtml).join('') || `<p class="text-center text-muted mt-4">${LISTA.length ? 'Nada encontrado.' : 'Nada salvo ainda. Em <a href="oraculos.html" style="color:#ff3333;">Oráculos</a>, use “Rolar tudo” e depois “Salvar este resultado”.'}</p>`}</div>
    <div class="painel-arquivo">${Dados.estado.usuario ? 'Seus salvos estão <b>sincronizados com a sua conta</b> e também guardados neste aparelho.' : 'Os salvos ficam <b>neste navegador</b>. Entre na sua conta (menu) para sincronizar entre aparelhos.'} Use <b>Exportar backup</b> de vez em quando e <b>Importar backup</b> para trazer de volta.</div>`;
}

async function recarregar() { LISTA = await Salvos.listar(); desenhar(); }
const achar = el => LISTA.find(r => r.id === el.closest('[data-id]').dataset.id);

// ---------- Edição (nome, linhas, notas) ----------
function abrirEdicao(r) {
  editando = r;
  const fundo = document.createElement('div');
  fundo.className = 'ficha-fundo'; fundo.id = 'edicao';
  fundo.innerHTML = `<form class="picker-box" style="width:min(520px,100%);max-height:92vh;overflow:auto;">
    <h5 class="nome-agente mb-3">Editar</h5>
    <label class="rotulo">Nome<input class="campo" name="nome" value="${esc(r.nome)}"></label>
    <label class="rotulo mt-2">Resultados (um por linha, “Título: valor”)<textarea class="campo" name="linhas" rows="9">${esc((r.linhas || []).map(l => `${l.rotulo}: ${l.texto}`).join('\n'))}</textarea></label>
    <label class="rotulo mt-2">Notas<textarea class="campo" name="notas" rows="4" placeholder="Segredos, ganchos, onde apareceu...">${esc(r.notas || '')}</textarea></label>
    <div class="d-flex gap-2 mt-3"><button class="btn-rolar" type="submit">Salvar</button><button class="btn-fantasma" type="button" data-fechar>Cancelar</button></div>
  </form>`;
  document.body.appendChild(fundo);
  fundo.querySelector('[name=nome]').focus();
  fundo.addEventListener('click', e => { if (e.target === fundo || e.target.closest('[data-fechar]')) fundo.remove(); });
  fundo.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, nome = f.nome.value.trim();
    if (!nome) return aviso('O nome não pode ficar vazio');
    r.nome = nome;
    r.notas = f.notas.value.trim();
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
  fundo.className = 'ficha-fundo';
  fundo.innerHTML = `<img src="${esc(r.imagem)}" alt="${esc(r.nome)}" style="max-width:100%;max-height:100%;border:1px solid #8b0000;">`;
  fundo.addEventListener('click', () => fundo.remove());
  document.body.appendChild(fundo);
}

const acoes = {
  filtro(el) { filtro = el.dataset.f; desenhar(); },
  editar(el) { abrirEdicao(achar(el)); },
  ampliar(el) { ampliar(achar(el)); },
  imagem(el) { imgAlvo = achar(el).id; document.getElementById('arq-imagem').click(); },
  async 'img-remover'(el) {
    const r = achar(el); r.imagem = '';
    await Salvos.salvar(r); desenhar();
  },
  async excluir(el) {
    const r = achar(el);
    if (!confirm(`Excluir "${r.nome}"? Isso não pode ser desfeito (a menos que você tenha um backup).`)) return;
    await Salvos.excluir(r.id); aviso('Excluído'); recarregar();
  },
  async exportar() {
    if (!LISTA.length) return aviso('Não há nada para exportar');
    baixarTexto('grimorio-salvos.json', await Salvos.exportar());
  },
  importar() { document.getElementById('arq-backup').click(); }
};

raiz.addEventListener('click', e => {
  const b = e.target.closest('[data-acao]');
  if (!b) return;
  if (b.tagName === 'A') e.preventDefault();
  Promise.resolve().then(() => acoes[b.dataset.acao]?.(b)).catch(err => aviso('Erro: ' + err.message));
});
raiz.addEventListener('input', e => {
  if (e.target.id !== 'busca') return;
  busca = e.target.value; const pos = e.target.selectionStart; desenhar();
  const n = document.getElementById('busca'); n.focus(); n.setSelectionRange(pos, pos);
});
raiz.addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  try {
    if (e.target.id === 'arq-imagem') {
      const r = LISTA.find(x => x.id === imgAlvo);
      if (r) { r.imagem = await reduzir(f); await Salvos.salvar(r); aviso('Imagem salva'); desenhar(); }
    } else if (e.target.id === 'arq-backup') {
      const n = await Salvos.importar(await f.text());
      aviso(n + ' item(ns) importado(s)'); recarregar();
    }
  } catch (err) { aviso('Falha: ' + err.message); }
  e.target.value = '';
});

Dados.ouvir('sync', cols => { if (cols.includes('salvos') && !document.getElementById('edicao')) recarregar(); });
recarregar().catch(err => {
  raiz.innerHTML = `<div class="alert alert-danger mt-5 rounded-0">Não consegui abrir os salvos: ${esc(err.message)}.</div>`;
});
