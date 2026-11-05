// Página de fichas: lista, ficha (com inventário) e edição. Dados em js/personagens.js
const raiz = document.getElementById('conteudo');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num = (v, pad = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : pad; };
const pesoNum = s => { const m = String(s ?? '').replace(',', '.').match(/\d+(\.\d+)?/); return m ? parseFloat(m[0]) : 0; };

let tela = 'lista';       // 'lista' | 'ficha' | 'editar'
let atual = null;         // personagem aberto (cópia de trabalho)
let ehNovo = false;
let catalogo = null;      // itens do site, carregado sob demanda
let painel = '';          // '' | 'catalogo' | 'custom'
let busca = '';

const ATRIBUTOS = [['defesa', 'Defesa'], ['forca', 'Força'], ['agilidade', 'Agilidade'], ['inteligencia', 'Inteligência'], ['carisma', 'Carisma']];

function aviso(msg) {
  let t = document.querySelector('.toast-ca');
  if (!t) { t = document.createElement('div'); t.className = 'toast-ca'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('on');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 2200);
}

// Reduz a imagem (lado maior 640px, JPEG) para caber no armazenamento e no arquivo JSON
function reduzir(file, max = 640) {
  return new Promise((ok, err) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); err(new Error('não consegui ler essa imagem')); };
    img.src = url;
  });
}
const miniatura = p => p.imagem ? `<img src="${esc(p.imagem)}" alt="">` : '<span>sem imagem</span>';

// ---------- Lista ----------
function barra(r) {
  const pct = r.max > 0 ? Math.max(0, Math.min(100, r.atual / r.max * 100)) : 0;
  return `<div class="barra"><i style="width:${pct}%"></i></div>`;
}

function painelArquivo() {
  const A = ArquivoJson;
  if (!A.suportado) return `<div class="painel-arquivo">Este navegador não grava direto em arquivo (use Chrome ou Edge no computador). Por aqui, use Exportar/Importar backup.</div>`;
  const nome = esc(A.nome);
  const corpo = {
    nenhum: `Salvando só neste navegador. Vincule um arquivo .json para gravar as fichas nele automaticamente.
      <div class="d-flex flex-wrap gap-2 mt-2"><button class="btn-fantasma" data-acao="arq-abrir">Abrir arquivo existente</button><button class="btn-fantasma" data-acao="arq-criar">Criar novo arquivo</button></div>`,
    pronto: `✔ Gravando automaticamente em <b>${nome}</b>.
      <div class="mt-2"><button class="btn-fantasma" data-acao="arq-desvincular">Desvincular</button></div>`,
    permissao: `O arquivo <b>${nome}</b> está vinculado, mas o navegador pede permissão de novo a cada sessão.
      <div class="mt-2"><button class="btn-rolar" data-acao="arq-reconectar">Reconectar</button> <button class="btn-fantasma" data-acao="arq-desvincular">Desvincular</button></div>`,
    erro: `⚠ Problema com o arquivo: ${esc(A.erro)}
      <div class="d-flex flex-wrap gap-2 mt-2"><button class="btn-fantasma" data-acao="arq-reconectar">Tentar de novo</button><button class="btn-fantasma" data-acao="arq-desvincular">Desvincular</button></div>`
  }[A.estado];
  return `<div class="painel-arquivo">${corpo}</div>`;
}

function telaLista() {
  const ps = Personagens.listar().sort((a, b) => b.atualizado - a.atualizado);
  raiz.innerHTML = `
    <div class="d-flex flex-wrap gap-2 justify-content-center mt-4">
      <button class="btn-rolar" data-acao="novo">＋ Novo personagem</button>
      <button class="btn-fantasma" data-acao="exportar">Exportar backup</button>
      <button class="btn-fantasma" data-acao="importar">Importar backup</button>
      <input type="file" id="arquivo-backup" accept=".json,application/json" hidden>
    </div>
    ${ps.length ? `<div class="row g-4 mt-1">${ps.map(p => `
      <div class="col-12 col-md-6 col-lg-4"><div class="card card-dossie clicavel h-100" data-id="${esc(p.id)}" role="button" tabindex="0">
        ${p.imagem ? `<img src="${esc(p.imagem)}" class="foto-perfil" alt="${esc(p.nome)}">` : ''}
        <div class="card-body">
          <h5 class="nome-agente">${esc(p.nome || 'Sem nome')}</h5>
          <div class="id-matricula">${esc([p.raca, p.classe].filter(Boolean).join(' · ') || '—')} · NV ${esc(p.nivel)}</div>
          <hr style="border-color:#444;margin:10px 0;">
          <div class="info-label">VIDA ${esc(p.vida.atual)}/${esc(p.vida.max)}</div>${barra(p.vida)}
          <div class="info-label">ENERGIA ${esc(p.energia.atual)}/${esc(p.energia.max)}</div>${barra(p.energia)}
          <div class="info-texto mt-2">${p.inventario.length} item(ns) no inventário</div>
        </div></div></div>`).join('')}</div>`
      : `<p class="text-center text-muted mt-5">Nenhum personagem ainda. Crie o primeiro!</p>`}
    ${painelArquivo()}`;
}

// ---------- Ficha (visualização) ----------
function linhaItem(i) {
  const sub = [i.categoria, i.raridade, i.valor && 'valor ' + i.valor, i.peso && 'peso ' + i.peso].filter(Boolean).join(' · ');
  const info = [i.efeitos, i.detalhes].filter(Boolean).join(' — ');
  return `<div class="inv-linha" data-item="${esc(i.id)}">
    <div class="inv-nome"><b>${esc(i.nome)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}${info ? `<small>${esc(info)}</small>` : ''}</div>
    <div class="inv-qtd"><button data-acao="qtd-" aria-label="Diminuir">−</button><span>${esc(i.qtd)}</span><button data-acao="qtd+" aria-label="Aumentar">+</button></div>
    <button class="inv-rm" data-acao="rm-item" aria-label="Remover ${esc(i.nome)}">✕</button></div>`;
}

function blocoRecurso(chave, rotulo) {
  const r = atual[chave];
  return `<div class="recurso" data-recurso="${chave}">
    <div class="info-label">${rotulo}: ${esc(r.atual)} / ${esc(r.max)}</div>${barra(r)}
    <div class="recurso-btns">${[-5, -1, 1, 5].map(d => `<button data-acao="ajuste" data-d="${d}">${d > 0 ? '+' : '−'}${Math.abs(d)}</button>`).join('')}</div></div>`;
}

function telaFicha() {
  const p = atual;
  const peso = p.inventario.reduce((t, i) => t + pesoNum(i.peso) * i.qtd, 0);
  raiz.innerHTML = `
    <div class="d-flex flex-wrap gap-2 mt-4 mb-3">
      <button class="btn-fantasma" data-acao="voltar">← Personagens</button>
      <button class="btn-rolar" data-acao="editar">Editar ficha</button>
      <button class="btn-fantasma btn-perigo ms-auto" data-acao="excluir">Excluir</button>
    </div>
    <div class="card card-dossie"><div class="card-body p-4">
      <div class="row g-4">${p.imagem ? `<div class="col-12 col-sm-5 col-md-4 col-lg-3"><img class="foto-ficha" src="${esc(p.imagem)}" alt="${esc(p.nome)}"></div>` : ''}<div class="col">
      <h2 class="nome-agente">${esc(p.nome || 'Sem nome')}</h2>
      <div class="id-matricula">${esc([p.raca, p.classe].filter(Boolean).join(' · ') || '—')} · NÍVEL ${esc(p.nivel)}</div>
      <hr style="border-color:#444;">
      <div class="row g-3">
        <div class="col-12 col-md-6">${blocoRecurso('vida', 'VIDA')}</div>
        <div class="col-12 col-md-6">${blocoRecurso('energia', 'ENERGIA')}</div>
      </div></div></div>
      <div class="info-label">ATRIBUTOS:</div>
      <div class="atributos atributos-5">${ATRIBUTOS.map(([k, l]) => `<div><span>${l.toUpperCase()}</span>${esc(p[k])}</div>`).join('')}</div>
      ${(p.habilidades || []).length ? `<div class="info-label">HABILIDADES:</div><ul class="habilidades">${p.habilidades.map(h => `<li><b>${esc(h.nome)}:</b> ${esc(h.descricao)}</li>`).join('')}</ul>` : ''}
      ${p.aparencia ? `<div class="info-label">APARÊNCIA:</div><div class="info-texto texto-livre">${esc(p.aparencia)}</div>` : ''}
      ${p.historia ? `<div class="info-label">HISTÓRIA:</div><div class="info-texto texto-livre">${esc(p.historia)}</div>` : ''}
      <div class="info-label">INVENTÁRIO (${p.inventario.length}):</div>
      <div class="inventario">${p.inventario.map(linhaItem).join('') || '<div class="info-texto text-muted">Vazio.</div>'}</div>
      ${peso ? `<div class="info-texto mt-2">Peso total: <b>${String(Math.round(peso * 100) / 100).replace('.', ',')}</b> (soma dos pesos × quantidade)</div>` : ''}
      <div class="d-flex flex-wrap gap-2 mt-3">
        <button class="btn-rolar" data-acao="painel" data-p="catalogo">＋ Item do catálogo</button>
        <button class="btn-fantasma" data-acao="painel" data-p="custom">＋ Item personalizado</button>
      </div>
      ${painel === 'catalogo' ? painelCatalogo() : painel === 'custom' ? painelCustom() : ''}
    </div></div>`;
}

function painelCustom() {
  return `<div class="painel-add" data-painel="custom">
    <div class="row g-2">
      <div class="col-12 col-md-6"><input class="campo" name="nome" placeholder="Nome do item"></div>
      <div class="col-4 col-md-2"><input class="campo" name="qtd" type="number" min="1" value="1" placeholder="Qtd"></div>
      <div class="col-4 col-md-2"><input class="campo" name="peso" placeholder="Peso"></div>
      <div class="col-4 col-md-2"><input class="campo" name="valor" placeholder="Valor"></div>
      <div class="col-12"><input class="campo" name="efeitos" placeholder="Efeitos / notas"></div>
    </div>
    <button class="btn-rolar mt-2" data-acao="add-custom">Adicionar</button></div>`;
}

function painelCatalogo() {
  if (!catalogo) return `<div class="painel-add" data-painel="catalogo"><div class="info-texto">Carregando itens...</div></div>`;
  const q = busca.trim().toLowerCase();
  const lista = catalogo.filter(i => !q || [i.nome, i.categoria, i.genero].join(' ').toLowerCase().includes(q));
  return `<div class="painel-add" data-painel="catalogo">
    <input class="campo mb-2" id="busca-item" placeholder="Buscar item..." value="${esc(busca)}">
    <div class="catalogo">${lista.map(i => `<div class="inv-linha"><div class="inv-nome"><b>${esc(i.nome)}</b>
      <small>${esc([i.genero, i.categoria, i.raridade, i.valor].filter(Boolean).join(' · '))}</small></div>
      <button class="btn-rolar" data-acao="add-catalogo" data-k="${catalogo.indexOf(i)}">Adicionar</button></div>`).join('')
      || '<div class="info-texto text-muted">Nenhum item encontrado.</div>'}</div></div>`;
}

async function carregarCatalogo() {
  try {
    const man = await (await fetch('data/manifest.json')).json();
    const gens = await Promise.all((man.itens || []).map(async id => {
      const d = await (await fetch(`data/itens/${id}/${id}.json`)).json();
      return { id, ...d };
    }));
    catalogo = gens.flatMap(g => (g.categorias || []).flatMap(c => c.cards.map(x =>
      ({ ...Personagens.itemDeCard({ categoria: c.nome, ...x }), genero: g.genero }))));
  } catch (e) {
    catalogo = [];
    aviso('Não consegui carregar os itens (' + e.message + ')');
  }
  if (tela === 'ficha' && painel === 'catalogo') desenhar();
}

// ---------- Edição ----------
const linhaHab = h => `<div class="hab-linha"><div class="row g-2 align-items-start">
  <div class="col-12 col-md-4"><input class="campo" data-hab="nome" placeholder="Nome da habilidade" value="${esc(h.nome)}"></div>
  <div class="col"><textarea class="campo" data-hab="descricao" rows="2" placeholder="Descrição / efeito">${esc(h.descricao)}</textarea></div>
  <div class="col-auto"><button type="button" class="inv-rm" data-acao="hab-rm" aria-label="Remover habilidade">✕</button></div></div></div>`;

const campoTxt = (n, l, v, ph = '') => `<label class="rotulo">${l}<input class="campo" name="${n}" value="${esc(v)}" placeholder="${esc(ph)}"></label>`;
const campoNum = (n, l, v) => `<label class="rotulo">${l}<input class="campo" type="number" name="${n}" value="${esc(v)}"></label>`;

function telaEditar() {
  const p = atual;
  raiz.innerHTML = `
    <form id="form-ficha" class="card card-dossie mt-4"><div class="card-body p-4">
      <h2 class="nome-agente mb-3">${ehNovo ? 'Novo personagem' : 'Editar ficha'}</h2>
      <div class="row g-3">
        <div class="col-12 col-md-6">${campoTxt('nome', 'Nome', p.nome)}</div>
        <div class="col-12 col-md-3">${campoTxt('raca', 'Raça', p.raca)}</div>
        <div class="col-6 col-md-3">${campoTxt('classe', 'Classe', p.classe)}</div>
        <div class="col-6 col-md-2">${campoNum('nivel', 'Nível', p.nivel)}</div>
      </div>
      <div class="info-label">IMAGEM:</div>
      <div class="d-flex gap-3 align-items-end flex-wrap">
        <div class="preview-ficha">${miniatura(p)}</div>
        <div class="d-flex flex-wrap gap-2"><input type="file" id="arq-imagem" accept="image/*" hidden>
          <button type="button" class="btn-fantasma" data-acao="img-escolher">Escolher imagem</button>
          <button type="button" class="btn-fantasma" data-acao="img-remover">Remover</button></div>
      </div>
      <div class="info-label">RECURSOS:</div>
      <div class="row g-3">
        <div class="col-6 col-md-3">${campoNum('vida_atual', 'Vida atual', p.vida.atual)}</div>
        <div class="col-6 col-md-3">${campoNum('vida_max', 'Vida máxima', p.vida.max)}</div>
        <div class="col-6 col-md-3">${campoNum('energia_atual', 'Energia atual', p.energia.atual)}</div>
        <div class="col-6 col-md-3">${campoNum('energia_max', 'Energia máxima', p.energia.max)}</div>
      </div>
      <div class="info-label">ATRIBUTOS:</div>
      <div class="row g-3">${ATRIBUTOS.map(([k, l]) => `<div class="col-6 col-md">${campoNum(k, l, p[k])}</div>`).join('')}</div>
      <div class="info-label">HABILIDADES:</div>
      <div id="habs">${(p.habilidades || []).map(linhaHab).join('')}</div>
      <button type="button" class="btn-fantasma mt-2" data-acao="hab-add">＋ Habilidade</button>
      <label class="rotulo mt-3">Aparência<textarea class="campo" name="aparencia" rows="3">${esc(p.aparencia)}</textarea></label>
      <label class="rotulo mt-3">História<textarea class="campo" name="historia" rows="6">${esc(p.historia)}</textarea></label>
      <div class="d-flex gap-2 mt-4">
        <button class="btn-rolar" type="submit">Salvar</button>
        <button class="btn-fantasma" type="button" data-acao="cancelar">Cancelar</button>
      </div>
    </div></form>`;
}

function lerForm() {
  const f = new FormData(document.getElementById('form-ficha')), g = k => String(f.get(k) ?? '').trim();
  const p = atual;
  p.nome = g('nome'); p.raca = g('raca'); p.classe = g('classe'); p.nivel = Math.max(1, num(g('nivel'), 1));
  p.aparencia = String(f.get('aparencia') ?? ''); p.historia = String(f.get('historia') ?? '');
  p.vida = { atual: num(g('vida_atual')), max: Math.max(0, num(g('vida_max'))) };
  p.energia = { atual: num(g('energia_atual')), max: Math.max(0, num(g('energia_max'))) };
  ATRIBUTOS.forEach(([k]) => p[k] = num(g(k)));
  p.habilidades = [...document.querySelectorAll('.hab-linha')].map(l => ({
    nome: l.querySelector('[data-hab=nome]').value.trim(), descricao: l.querySelector('[data-hab=descricao]').value.trim()
  })).filter(h => h.nome || h.descricao);
  p.vida.atual = Math.min(p.vida.atual, p.vida.max); p.energia.atual = Math.min(p.energia.atual, p.energia.max);
}

// ---------- Controle ----------
function desenhar() { (tela === 'lista' ? telaLista : tela === 'ficha' ? telaFicha : telaEditar)(); }

function abrir(id) {
  atual = Personagens.obter(id);
  if (!atual) return irLista();
  tela = 'ficha'; painel = ''; ehNovo = false;
  history.replaceState(null, '', '#' + id);
  desenhar();
}
function irLista() { tela = 'lista'; atual = null; history.replaceState(null, '', location.pathname); desenhar(); }

function gravarAtual(msg) { Personagens.salvar(atual); if (msg) aviso(msg); }

function addItem(item, qtd = 1) {
  const ja = atual.inventario.find(i => i.nome === item.nome);
  if (ja) ja.qtd += qtd; else atual.inventario.push({ id: Personagens.uid(), qtd, ...item });
  gravarAtual(item.nome + ' adicionado');
  desenhar();
}

const acoes = {
  novo() { atual = Personagens.novo(); ehNovo = true; tela = 'editar'; desenhar(); },
  voltar: irLista,
  editar() { tela = 'editar'; ehNovo = false; desenhar(); },
  cancelar() { ehNovo ? irLista() : abrir(atual.id); },
  excluir() {
    if (confirm(`Excluir "${atual.nome || 'Sem nome'}"? Isso não pode ser desfeito.`)) { Personagens.excluir(atual.id); irLista(); }
  },
  exportar() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([Personagens.exportar()], { type: 'application/json' }));
    a.download = 'grimorio-personagens.json'; a.click(); URL.revokeObjectURL(a.href);
  },
  importar() { document.getElementById('arquivo-backup').click(); },
  'hab-add'() {
    const lista = document.getElementById('habs');
    lista.insertAdjacentHTML('beforeend', linhaHab({ nome: '', descricao: '' }));
    lista.lastElementChild.querySelector('input').focus();
  },
  'hab-rm'(el) { el.closest('.hab-linha').remove(); },
  'img-escolher'() { document.getElementById('arq-imagem').click(); },
  'img-remover'() { atual.imagem = ''; document.querySelector('.preview-ficha').innerHTML = miniatura(atual); },
  'arq-abrir': () => ArquivoJson.abrir().then(desenhar),
  'arq-criar': () => ArquivoJson.criar().then(desenhar),
  'arq-reconectar': () => ArquivoJson.reconectar().then(desenhar),
  'arq-desvincular': () => ArquivoJson.desvincular().then(desenhar),
  ajuste(el) {
    const chave = el.closest('.recurso').dataset.recurso, r = atual[chave];
    r.atual = Math.max(0, Math.min(r.max, r.atual + num(el.dataset.d)));
    gravarAtual(); desenhar();
  },
  'qtd+'(el) { const i = itemDe(el); i.qtd++; gravarAtual(); desenhar(); },
  'qtd-'(el) { const i = itemDe(el); if (i.qtd > 1) { i.qtd--; gravarAtual(); desenhar(); } else aviso('Use ✕ para remover o item'); },
  'rm-item'(el) {
    const i = itemDe(el);
    atual.inventario = atual.inventario.filter(x => x !== i); gravarAtual(); desenhar();
  },
  painel(el) {
    painel = painel === el.dataset.p ? '' : el.dataset.p; busca = '';
    if (painel === 'catalogo' && !catalogo) carregarCatalogo();
    desenhar();
  },
  'add-catalogo'(el) { const { genero, ...item } = catalogo[num(el.dataset.k)]; addItem(item); },
  'add-custom'() {
    const q = n => document.querySelector(`[data-painel="custom"] [name="${n}"]`).value.trim();
    if (!q('nome')) return aviso('Dê um nome ao item');
    addItem({ nome: q('nome'), peso: q('peso'), valor: q('valor'), efeitos: q('efeitos') }, Math.max(1, num(q('qtd'), 1)));
  }
};
const itemDe = el => atual.inventario.find(i => i.id === el.closest('[data-item]').dataset.item);

raiz.addEventListener('click', e => {
  const b = e.target.closest('[data-acao]');
  if (b) return acoes[b.dataset.acao]?.(b);
  const card = e.target.closest('.clicavel[data-id]');
  if (card) abrir(card.dataset.id);
});
raiz.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.clicavel[data-id]')) { e.preventDefault(); abrir(e.target.dataset.id); }
});
raiz.addEventListener('submit', e => {
  e.preventDefault();
  lerForm();
  if (!atual.nome) return aviso('O personagem precisa de um nome');
  try { gravarAtual('Ficha salva'); }
  catch (err) { return aviso('Não coube no armazenamento do navegador. Tente uma imagem menor.'); }
  abrir(atual.id);
});
raiz.addEventListener('input', e => {
  if (e.target.id === 'busca-item') {
    busca = e.target.value;
    const pos = e.target.selectionStart;
    desenhar();
    const n = document.getElementById('busca-item'); n.focus(); n.setSelectionRange(pos, pos);
  }
});
raiz.addEventListener('change', async e => {
  if (e.target.id === 'arq-imagem' && e.target.files[0]) {
    try { atual.imagem = await reduzir(e.target.files[0]); document.querySelector('.preview-ficha').innerHTML = miniatura(atual); }
    catch (err) { aviso(err.message); }
    e.target.value = ''; return;
  }
  if (e.target.id !== 'arquivo-backup' || !e.target.files[0]) return;
  const r = new FileReader();
  r.onload = () => {
    try { aviso(Personagens.importar(r.result) + ' personagem(ns) importado(s)'); desenhar(); }
    catch (err) { aviso('Falha ao importar: ' + err.message); }
  };
  r.readAsText(e.target.files[0]);
});

// Início: liga o arquivo vinculado, usa data/personagens/personagens.json como ponto de partida
// (só na primeira vez neste navegador) e abre direto se a URL tiver #id
ArquivoJson.aoEstado = () => { if (tela === 'lista') desenhar(); };
(async () => {
  try {
    if (!Personagens.iniciado()) {
      try { const r = await fetch('data/personagens/personagens.json'); if (r.ok) Personagens.importar(await r.text()); } catch {}
    }
    await ArquivoJson.iniciar();
    const id = location.hash.slice(1);
    if (id && Personagens.obter(id)) return abrir(id);
    desenhar();
  } catch (e) {
    raiz.innerHTML = `<div class="alert alert-danger mt-5 rounded-0">Não consegui acessar o armazenamento do navegador: ${esc(e.message)}</div>`;
  }
})();
