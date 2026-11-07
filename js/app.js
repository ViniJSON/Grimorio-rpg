// Lê data/manifest.json e os JSONs de cada gênero, e desenha a página (bestiário, itens e NPCs).
const SECAO = document.body.dataset.secao;

// Campos extras de cada seção: [chave no JSON, rótulo, aparece também no card pequeno?, mostrar lista em tópicos?]
// Valores podem ser texto ou lista (["a","b"]). Campo ausente/vazio não aparece.
const CAMPOS = {
  bestiario: [['ameaca', 'Nível de ameaça', true], ['fraquezas', 'Fraquezas'], ['resistencias', 'Resistências'], ['recompensas', 'Recompensas'], ['personalidade', 'Personalidade']],
  npcs: [['ocupacao', 'Ocupação', true], ['personalidade', 'Personalidade'], ['objetivos', 'Objetivos'], ['relacoes', 'Relações']],
  classes: [['especialidade', 'Especialidade', true], ['limitacoes', 'Limitações']],
  racas: [['traco', 'Traço principal', true], ['vantagens', 'Vantagens', false, true], ['desvantagens', 'Desvantagens', false, true]],
  itens: [['categoria', 'Categoria', true], ['raridade', 'Raridade', true], ['valor', 'Valor', true], ['peso', 'Peso'], ['efeitos', 'Efeitos']]
};
const preenchido = v => Array.isArray(v) ? v.length > 0 : v != null && v !== '';
const campos = c => (CAMPOS[SECAO] || []).filter(([k]) => preenchido(c[k]));
const fmt = v => Array.isArray(v) ? v.join(', ') : v;
const camposMini = c => campos(c).filter(f => f[2]).map(([k, l]) => `<div class="campo-mini"><b>${esc(l)}:</b> ${esc(fmt(c[k]))}</div>`).join('');
const camposFull = c => campos(c).map(([k, l, , lista]) => `<div class="info-label">${esc(l.toUpperCase())}:</div>` +
  (lista && Array.isArray(c[k]) ? `<ul class="habilidades">${c[k].map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : `<div class="info-texto">${esc(fmt(c[k]))}</div>`)).join('');
// Blocos de atributos e habilidades (só aparecem se o card tiver conteúdo)
const blocoAtributos = c => Object.keys(c.atributos || {}).length ? `<div class="info-label">${esc(c.rotulo_atributos || 'ATRIBUTOS')}:</div>
    <div class="atributos">${Object.entries(c.atributos).map(([k, v]) => `<div><span>${esc(k.toUpperCase())}</span>${esc(v)}</div>`).join('')}</div>` : '';
const blocoHabilidades = c => (c.habilidades || []).length ? `<div class="info-label">HABILIDADES:</div>
    <ul class="habilidades">${c.habilidades.map(h => `<li><b>${esc(h.nome)}:</b> ${esc(h.descricao)}</li>`).join('')}</ul>` : '';
const btnAdd = SECAO === 'itens' ? '<button type="button" class="btn-rolar btn-add-inv w-100 mt-3">＋ Adicionar à ficha</button>' : '';

// Guarda os dados de cada card desenhado, para a ficha ampliada poder reabri-los pelo índice
const registro = [];

const card = c => `
<div class="col-12 col-md-6 col-lg-4"><div class="card card-dossie clicavel h-100" data-i="${registro.push(c) - 1}" role="button" tabindex="0" aria-label="Abrir ficha: ${esc(c.nome)}"${c.destaque ? ' style="border-color:#8b0000;"' : ''}>
  <img src="${esc(c.imagem || PLACEHOLDER)}" class="foto-perfil" alt="${esc(c.nome)}" onerror="this.onerror=null;this.src='${PLACEHOLDER}'">
  <div class="card-body">
    <h5 class="nome-agente"${c.destaque ? ' style="color:#ff3333;"' : ''}>${esc(c.nome)}</h5>
    <hr style="border-color:#444;margin:10px 0;">
    ${camposMini(c)}
    <div class="info-label">DESCRIÇÃO:</div><div class="info-texto">${esc(c.descricao)}</div>
    ${blocoAtributos(c)}
    ${blocoHabilidades(c)}
    ${btnAdd}
  </div>
</div></div>`;


// ---------- Loja (só na página Itens) ----------
// Imagens: sorteadas da pasta img/itens/<genero>/vendedora/ (lista gerada por gerar-vendedoras.py em data/vendedoras.json)
// Opcional em cada JSON de itens -> "vendedora": { "titulo", "nome", "imagem" (reserva), "falas": [ ... ], "enquadramento": "cobrir" }
let VENDEDORAS = {};
const FALAS_PADRAO = ['Dê uma olhada. Mas só encoste no que for comprar.', 'Sem fiado. Sem reembolso. Sem choro.', 'Tem coisa boa aqui, se você souber procurar.', 'Hmm... você tem cara de quem precisa de equipamento.', 'Cuidado com o que escolhe. Tudo aqui tem história.'];
const sortFala = (falas, atual) => {
  const l = falas.length > 1 ? falas.filter(f => f !== atual) : falas;
  return l[Math.floor(Math.random() * l.length)];
};
const lojaHtml = g => {
  const v = g.vendedora || {};
  const falas = Array.isArray(v.falas) && v.falas.length ? v.falas : FALAS_PADRAO;
  const pasta = VENDEDORAS[g.id] || [];
  const fotos = pasta.length ? pasta : [v.imagem || PLACEHOLDER];
  const foto = fotos[Math.floor(Math.random() * fotos.length)];
  const nome = v.nome || 'Vendedora';
  const linhas = g.categorias.map(c => `<div class="loja-cat">${esc(c.nome)}</div>` + c.cards.map(x =>
    `<div class="loja-item clicavel" data-i="${registro.push(x.categoria ? x : { ...x, categoria: c.nome }) - 1}" role="button" tabindex="0" aria-label="Abrir ficha: ${esc(x.nome)}">
      <span class="loja-nome">${esc(x.nome)}</span>
      <span class="loja-preco">${esc(x.valor || '—')}</span>
      <button type="button" class="btn-add-inv loja-add" title="Adicionar à ficha" aria-label="Adicionar ${esc(x.nome)} à ficha">＋</button>
    </div>`).join('')).join('');
  return `<div class="loja" data-falas="${esc(JSON.stringify(falas))}">
    <div class="loja-vendedora${v.enquadramento === 'cobrir' ? ' cobrir' : ''}" title="Clique para ela falar de novo">
      <img class="loja-fundo" src="${esc(foto)}" alt="" aria-hidden="true">
      <img class="loja-foto" src="${esc(foto)}" alt="${esc(nome)}" onerror="this.onerror=null;this.src='${PLACEHOLDER}'">
      <div class="loja-fala"><b>${esc(nome)}</b><p>${esc(sortFala(falas))}</p></div>
      <a class="loja-sair" href="index.html">SAIR</a>
    </div>
    <div class="loja-lista">
      <div class="loja-titulo">${esc(v.titulo || 'Loja')}</div>
      <div class="loja-itens">${linhas}</div>
    </div>
  </div>`;
};
function ligarLoja() {
  raiz.addEventListener('click', e => {
    const v = e.target.closest('.loja-vendedora');
    if (!v || e.target.closest('.loja-sair')) return;
    const p = v.querySelector('.loja-fala p');
    p.textContent = sortFala(JSON.parse(v.closest('.loja').dataset.falas), p.textContent);
  });
}

const genCards = g => `<section class="genero" id="${esc(g.id)}"><h3>${esc(g.genero)}</h3>` + (SECAO === 'itens' ? lojaHtml(g) : '') +
  g.categorias.map(c => `<h4 class="categoria">${esc(c.nome)}</h4><div class="row g-4">${c.cards.map(x => card(SECAO === 'itens' && !x.categoria ? { ...x, categoria: c.nome } : x)).join('')}</div>`).join('') + '</section>';

// ---------- Ficha ampliada (clique no card) ----------
let fichaEl, fichaOrigem;

function montarFicha() {
  fichaEl = document.createElement('div');
  fichaEl.className = 'ficha-fundo';
  fichaEl.hidden = true;
  fichaEl.innerHTML = `
    <div class="ficha-box" role="dialog" aria-modal="true" aria-labelledby="ficha-nome">
      <button type="button" class="ficha-fechar" aria-label="Fechar">✕</button>
      <div class="ficha-img"><img alt=""></div>
      <div class="ficha-info"></div>
    </div>`;
  document.body.appendChild(fichaEl);
  fichaEl.addEventListener('click', e => {
    if (e.target.closest('.btn-add-inv')) return escolherPersonagem(registro[fichaEl.dataset.atual]);
    if (e.target === fichaEl || e.target.closest('.ficha-fechar')) fecharFicha();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !fichaEl.hidden) fecharFicha(); });
}

function abrirFicha(c, origem) {
  if (!fichaEl) montarFicha();
  fichaOrigem = origem;
  const img = fichaEl.querySelector('.ficha-img img');
  img.onerror = () => { img.onerror = null; img.src = PLACEHOLDER; };
  img.src = c.imagem || PLACEHOLDER;
  img.alt = c.nome;
  const box = fichaEl.querySelector('.ficha-box');
  box.classList.toggle('destaque', !!c.destaque);
  fichaEl.querySelector('.ficha-info').innerHTML = `
    <h2 class="nome-agente" id="ficha-nome">${esc(c.nome)}</h2>
    <hr style="border-color:#444;margin:12px 0;">
    <div class="info-label">DESCRIÇÃO:</div><div class="info-texto">${esc(c.descricao)}</div>
    ${camposFull(c)}
    ${blocoAtributos(c)}
    ${blocoHabilidades(c)}${btnAdd}`;
  fichaEl.dataset.atual = registro.indexOf(c);
  fichaEl.querySelector('.ficha-info').scrollTop = 0;
  fichaEl.hidden = false;
  document.body.style.overflow = 'hidden';
  fichaEl.querySelector('.ficha-fechar').focus();
}

function fecharFicha() {
  fichaEl.hidden = true;
  document.body.style.overflow = '';
  if (fichaOrigem) fichaOrigem.focus();
}

// ---------- Adicionar item à ficha de um personagem ----------
async function escolherPersonagem(c) {
  await Dados.pronto;
  const ps = Personagens.listar();
  const fundo = document.createElement('div');
  fundo.className = 'ficha-fundo'; fundo.style.zIndex = 2100;
  fundo.innerHTML = `<div class="picker-box" role="dialog" aria-modal="true">
    <h5 class="nome-agente">Adicionar à ficha</h5>
    <div class="info-texto mb-2">${esc(c.nome)}</div>
    ${ps.length ? ps.map(p => `<button type="button" class="btn-rolar d-block w-100 mb-2" data-id="${esc(p.id)}">${esc(p.nome || 'Sem nome')}</button>`).join('')
      : '<div class="info-texto mb-2">Você ainda não tem personagens. <a href="fichas.html" style="color:#ff3333;">Criar uma ficha</a></div>'}
    <button type="button" class="btn-fantasma w-100" data-fechar>Cancelar</button></div>`;
  document.body.appendChild(fundo);
  const fechar = () => fundo.remove();
  fundo.addEventListener('click', e => {
    const b = e.target.closest('[data-id]');
    if (b) {
      Personagens.adicionarItem(b.dataset.id, Personagens.itemDeCard(c));
      fundo.querySelector('.picker-box').innerHTML = `<div class="info-texto">✔ ${esc(c.nome)} foi para o inventário de <b>${esc(Personagens.obter(b.dataset.id).nome)}</b>.</div>
        <button type="button" class="btn-fantasma w-100 mt-3" data-fechar>Ok</button>`;
    } else if (e.target === fundo || e.target.closest('[data-fechar]')) fechar();
  });
  fundo.querySelector('button').focus();
}

function ligarFichas() {
  const abrir = el => { if (el) abrirFicha(registro[el.dataset.i], el); };
  raiz.addEventListener('click', e => {
    const add = e.target.closest('.btn-add-inv');
    if (add) return escolherPersonagem(registro[add.closest('.clicavel').dataset.i]);
    abrir(e.target.closest('.clicavel'));
  });
  raiz.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('clicavel')) { e.preventDefault(); abrir(e.target); }
  });
}

(async () => {
  try {
    const man = await lerJson('data/manifest.json');
    if (SECAO === 'itens') VENDEDORAS = await lerJson('data/vendedoras.json').catch(() => ({}));
    const gens = await Promise.all((man[SECAO] || []).map(id => lerJson(`data/${SECAO}/${id}/${id}.json`).then(d => ({ id, ...d }))));
    raiz.innerHTML = `<div class="pilulas mt-4">${gens.map(g => `<a href="#${esc(g.id)}">${esc(g.genero)}</a>`).join('')}</div>` +
      gens.map(genCards).join('');
    ligarFichas();
    if (SECAO === 'itens') ligarLoja();
    // Abas de gênero: mostra só um por vez
    const mostrar = id => {
      document.querySelectorAll('.genero').forEach(s => s.hidden = s.id !== id);
      document.querySelectorAll('.pilulas a').forEach(a => a.classList.toggle('ativo', a.getAttribute('href') === '#' + id));
    };
    document.querySelectorAll('.pilulas a').forEach(a => a.onclick = e => {
      e.preventDefault();
      const id = a.getAttribute('href').slice(1);
      mostrar(id);
      history.replaceState(null, '', '#' + id);
    });
    const alvo = gens.find(g => '#' + g.id === location.hash);
    mostrar((alvo || gens[0] || {}).id);
  } catch (e) {
    raiz.innerHTML = `<div class="alert alert-danger mt-5 rounded-0">Não consegui carregar os dados: ${esc(e.message)}.` +
      (location.protocol === 'file:' ? '<br>Abrindo o arquivo direto do computador o navegador bloqueia os JSONs. Rode um servidor local (veja o LEIAME.md).' : '') + '</div>';
  }
})();
