// Página de fichas: lista, ficha (rolador, recursos, inventário) e edição.
// Dados em js/personagens.js (sobre js/dados.js). Regras do sistema em js/regras.js.
const pesoNum = s => { const m = String(s ?? '').replace(',', '.').match(/\d+(\.\d+)?/); return m ? parseFloat(m[0]) : 0; };

let tela = 'lista';       // 'lista' | 'ficha' | 'editar'
let atual = null;         // personagem aberto (cópia de trabalho)
let ehNovo = false;
let catalogo = null;      // itens do site, carregado sob demanda
let painel = '';          // '' | 'catalogo' | 'custom'
let busca = '';
let historico = [];       // últimas rolagens (só na tela, não é salvo)
let historicoDe = '';     // de quem é o histórico acima
let difAtual = '', exprAtual = '';

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
    nenhum: `Salvando ${Dados.estado.usuario ? 'neste navegador e na sua conta' : 'só neste navegador'}. Vincule um arquivo .json para gravar as fichas nele automaticamente.
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

// ---------- Rolagens ----------
const ROTULO_RES = { critico: 'SUCESSO CRÍTICO!', 'falha-critica': 'FALHA CRÍTICA', sucesso: 'Sucesso', falha: 'Falha' };
function registrar(titulo, detalhe, classe = '') {
  historico.unshift({ titulo, detalhe, classe });
  historico = historico.slice(0, 20);
  const h = document.getElementById('hist'); if (h) h.innerHTML = histHtml();
}
const histHtml = () => historico.length
  ? historico.slice(0, 8).map(r => `<div class="rol ${esc(r.classe)}"><b>${esc(r.titulo)}</b> <span>${esc(r.detalhe)}</span></div>`).join('')
  : '<div class="info-texto text-muted">Clique em um atributo, em Iniciativa ou rode uma expressão. As últimas rolagens aparecem aqui.</div>';

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

function habItem(h, i) {
  const lados = Regras.ladosDe(h.dado), extra = h.extra ? (/^[+-]/.test(h.extra) ? h.extra : '+' + h.extra) : '';
  return `<li><b>${esc(h.nome)}:</b> ${esc(h.descricao)}${lados ? `<div class="hab-uso"><small>1d${lados}${esc(extra)} · ${Regras.custoEnergia(h.dado)} Energia</small>
    <button type="button" class="btn-rolar" data-acao="usar-hab" data-i="${i}">Usar</button>
    <button type="button" class="btn-fantasma" data-acao="usar-hab" data-i="${i}" data-c="1" title="Crítico natural: dano dobrado e sem gasto de Energia">Usar (20 natural)</button></div>` : ''}</li>`;
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
      <div class="info-label">ATRIBUTOS: <small style="color:#888;text-transform:none;letter-spacing:0;">(clique para testar: d20 + atributo)</small></div>
      <div class="atributos atributos-5">${Regras.ATRIBUTOS.map(([k, s, l]) => `<button type="button" data-acao="testar" data-k="${k}" title="Testar ${esc(l)}"><span>${s}</span>${esc(p[k])}</button>`).join('')}<div title="10 + AGI + ajustes"><span>DEFESA</span>${esc(p.defesa)}</div></div>

      <div class="info-label">ROLAR:</div>
      <div class="rolador"><div class="row g-2 align-items-end">
        <div class="col-5 col-md-2"><label class="rotulo">Dificuldade<input class="campo" id="dif" type="number" placeholder="opcional" value="${esc(difAtual)}"></label></div>
        <div class="col-7 col-md-4"><label class="rotulo">Expressão<input class="campo" id="expr" placeholder="1d6+FOR" value="${esc(exprAtual)}" autocomplete="off"></label></div>
        <div class="col-12 col-md-6 d-flex flex-wrap gap-2">
          <button type="button" class="btn-rolar" data-acao="rolar-expr">Rolar</button>
          <button type="button" class="btn-fantasma" data-acao="iniciativa">Iniciativa</button>
          <button type="button" class="btn-fantasma" data-acao="descanso" data-t="curto">Descanso curto</button>
          <button type="button" class="btn-fantasma" data-acao="descanso" data-t="longo">Descanso longo</button>
        </div></div>
        <div class="rol-hist" id="hist">${histHtml()}</div></div>

      ${(p.habilidades || []).length ? `<div class="info-label">HABILIDADES:</div><ul class="habilidades">${p.habilidades.map(habItem).join('')}</ul>` : ''}
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
const DADOS_HAB = Object.entries(Regras.CUSTO_ENERGIA);
const linhaHab = h => `<div class="hab-linha"><div class="row g-2 align-items-start">
  <div class="col-12 col-md-4"><input class="campo" data-hab="nome" placeholder="Nome da habilidade" value="${esc(h.nome)}"></div>
  <div class="col"><textarea class="campo" data-hab="descricao" rows="2" placeholder="Descrição / efeito">${esc(h.descricao)}</textarea></div>
  <div class="col-auto"><button type="button" class="inv-rm" data-acao="hab-rm" aria-label="Remover habilidade">✕</button></div></div>
  <div class="row g-2 mt-1">
    <div class="col-12 col-sm-6 col-md-4"><select class="campo" data-hab="dado" aria-label="Dado da habilidade"><option value="">Sem dado (passiva)</option>${DADOS_HAB.map(([l, c]) => `<option value="1d${l}" ${String(Regras.ladosDe(h.dado)) === l ? 'selected' : ''}>d${l} · custa ${c} Energia</option>`).join('')}</select></div>
    <div class="col-12 col-sm-6 col-md-4"><input class="campo" data-hab="extra" placeholder="Bônus no dano (opcional): +FOR ou +2" value="${esc(h.extra || '')}"></div></div></div>`;

const campoTxt = (n, l, v, ph = '') => `<label class="rotulo">${l}<input class="campo" name="${n}" value="${esc(v)}" placeholder="${esc(ph)}"></label>`;
const campoNum = (n, l, v, extra = '') => `<label class="rotulo">${l}<input class="campo" type="number" name="${n}" value="${esc(v)}" ${extra}></label>`;

function telaEditar() {
  const p = atual, a = p.ajustes;
  raiz.innerHTML = `
    <form id="form-ficha" class="card card-dossie mt-4"><div class="card-body p-4">
      <h2 class="nome-agente mb-3">${ehNovo ? 'Novo personagem' : 'Editar ficha'}</h2>
      <div class="row g-3">
        <div class="col-12 col-md-6">${campoTxt('nome', 'Nome', p.nome)}</div>
        <div class="col-12 col-md-3">${campoTxt('raca', 'Raça', p.raca)}</div>
        <div class="col-6 col-md-3">${campoTxt('classe', 'Classe', p.classe)}</div>
        <div class="col-6 col-md-2">${campoNum('nivel', 'Nível (1–10)', p.nivel, `min="1" max="${Regras.NIVEL_MAX}"`)}</div>
      </div>
      <div class="info-label">IMAGEM:</div>
      <div class="d-flex gap-3 align-items-end flex-wrap">
        <div class="preview-ficha">${miniatura(p)}</div>
        <div class="d-flex flex-wrap gap-2"><input type="file" id="arq-imagem" accept="image/*" hidden>
          <button type="button" class="btn-fantasma" data-acao="img-escolher">Escolher imagem</button>
          <button type="button" class="btn-fantasma" data-acao="img-remover">Remover</button></div>
      </div>
      <div class="info-label">ATRIBUTOS:</div>
      <div class="row g-3">${Regras.ATRIBUTOS.map(([k, , l]) => `<div class="col-6 col-md-3">${campoNum(k, l, p[k], 'min="0"')}</div>`).join('')}</div>
      <div id="pontos" class="info-texto mt-2"></div>
      <div class="info-label">DERIVADOS (calculados pelas regras):</div>
      <div id="previa" class="info-texto"></div>
      <div class="row g-3 mt-1">
        <div class="col-4">${campoNum('ajuste_vida', 'Ajuste de Vida', a.vida)}</div>
        <div class="col-4">${campoNum('ajuste_energia', 'Ajuste de Energia', a.energia)}</div>
        <div class="col-4">${campoNum('ajuste_defesa', 'Ajuste de Defesa', a.defesa)}</div>
      </div>
      <div class="info-texto text-muted mt-1"><small>Os ajustes somam ao valor das fórmulas (itens, nível, bônus do mestre). Armaduras e níveis ainda não têm regra fechada, então use aqui por enquanto.</small></div>
      ${ehNovo ? '' : `<div class="row g-3 mt-1">
        <div class="col-6 col-md-3">${campoNum('vida_atual', 'Vida atual', p.vida.atual)}</div>
        <div class="col-6 col-md-3">${campoNum('energia_atual', 'Energia atual', p.energia.atual)}</div></div>`}
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
  previa();
}

// Mostra, enquanto você digita, os valores derivados e a conta dos 7 pontos iniciais
function previa() {
  const f = document.getElementById('form-ficha'); if (!f) return;
  const g = k => num(f.elements[k]?.value);
  const t = { nivel: g('nivel') || 1, ajustes: { vida: g('ajuste_vida'), energia: g('ajuste_energia'), defesa: g('ajuste_defesa') } };
  Regras.ATRIBUTOS.forEach(([k]) => t[k] = g(k));
  const d = Regras.derivados(t), v = Regras.validarCriacao(t);
  document.getElementById('previa').innerHTML = `Vida máx. <b>${d.vida}</b> (10 + FOR×2) · Energia máx. <b>${d.energia}</b> (10 + INT) · Defesa <b>${d.defesa}</b> (10 + AGI)`;
  document.getElementById('pontos').innerHTML = t.nivel <= 1
    ? `Pontos distribuídos: <b>${v.gastos}</b>/${Regras.PONTOS_INICIAIS} (máx. ${Regras.MAX_INICIAL} por atributo) ${v.avisos.length ? `<br><span style="color:#ffcc00;">⚠ ${v.avisos.map(esc).join(' ')}</span>` : '✔'}`
    : '<span class="text-muted">Acima do nível 1, os pontos extras por nível ainda não têm regra definida: distribua como o mestre combinar.</span>';
}

function lerForm() {
  const f = new FormData(document.getElementById('form-ficha')), g = k => String(f.get(k) ?? '').trim();
  const p = atual;
  p.nome = g('nome'); p.raca = g('raca'); p.classe = g('classe'); p.nivel = Math.min(Regras.NIVEL_MAX, Math.max(1, num(g('nivel'), 1)));
  p.aparencia = String(f.get('aparencia') ?? ''); p.historia = String(f.get('historia') ?? '');
  Regras.ATRIBUTOS.forEach(([k]) => p[k] = num(g(k)));
  p.ajustes = { vida: num(g('ajuste_vida')), energia: num(g('ajuste_energia')), defesa: num(g('ajuste_defesa')) };
  if (!ehNovo) { p.vida.atual = num(g('vida_atual')); p.energia.atual = num(g('energia_atual')); }
  p.habilidades = [...document.querySelectorAll('.hab-linha')].map(l => ({
    nome: l.querySelector('[data-hab=nome]').value.trim(), descricao: l.querySelector('[data-hab=descricao]').value.trim(),
    dado: l.querySelector('[data-hab=dado]').value, extra: l.querySelector('[data-hab=extra]').value.trim()
  })).filter(h => h.nome || h.descricao);
  Regras.aplicar(p);                                   // recalcula máximos e limita os valores atuais
  if (ehNovo) { p.vida.atual = p.vida.max; p.energia.atual = p.energia.max; }
}

// ---------- Controle ----------
function desenhar() { (tela === 'lista' ? telaLista : tela === 'ficha' ? telaFicha : telaEditar)(); }

function abrir(id) {
  atual = Personagens.obter(id);
  if (!atual) return irLista();
  tela = 'ficha'; painel = ''; ehNovo = false;
  if (historicoDe !== atual.id) { historico = []; historicoDe = atual.id; }
  history.replaceState(null, '', '#' + id);
  desenhar();
}
function irLista() { tela = 'lista'; atual = null; history.replaceState(null, '', location.pathname); desenhar(); }

function gravarAtual(msg) { Personagens.salvar(atual); if (msg) aviso(msg); }

function addItem(item, qtd = 1) {
  const ja = atual.inventario.find(i => i.nome === item.nome);
  if (ja) ja.qtd += qtd; else atual.inventario.push({ id: uid(), qtd, ...item });
  gravarAtual(item.nome + ' adicionado');
  desenhar();
}

const lerDif = () => difAtual === '' ? null : difAtual;

const acoes = {
  novo() { atual = Personagens.novo(); ehNovo = true; tela = 'editar'; desenhar(); },
  voltar: irLista,
  editar() { tela = 'editar'; ehNovo = false; desenhar(); },
  cancelar() { ehNovo ? irLista() : abrir(atual.id); },
  excluir() {
    if (confirm(`Excluir "${atual.nome || 'Sem nome'}"? Isso não pode ser desfeito.`)) { Personagens.excluir(atual.id); irLista(); }
  },
  exportar() { baixarTexto('grimorio-personagens.json', Personagens.exportar()); },
  importar() { document.getElementById('arquivo-backup').click(); },
  'hab-add'() {
    const lista = document.getElementById('habs');
    lista.insertAdjacentHTML('beforeend', linhaHab({ nome: '', descricao: '', dado: '', extra: '' }));
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
  // ----- rolagens -----
  testar(el) {
    const k = el.dataset.k, [, sigla] = Regras.ATRIBUTOS.find(a => a[0] === k), r = Regras.teste(atual, k, lerDif());
    registrar(`Teste de ${sigla}`, `d20 ${r.dado} ${r.bonus >= 0 ? '+' : '−'} ${Math.abs(r.bonus)} = ${r.total}` +
      (r.dificuldade !== null ? ` vs dificuldade ${r.dificuldade}` : '') + (r.resultado ? ` — ${ROTULO_RES[r.resultado]}` : ''), r.resultado || '');
  },
  iniciativa() {
    const r = Regras.iniciativa(atual);
    registrar('Iniciativa', `d20 ${r.dado} + AGI ${r.bonus} = ${r.total}`);
  },
  'rolar-expr'() {
    try { const r = Regras.rolar(exprAtual, atual); registrar(exprAtual.trim(), `${r.texto} = ${r.total}`); }
    catch (e) { aviso(e.message, 3600); }
  },
  descanso(el) {
    const r = Regras.descansar(atual, el.dataset.t); gravarAtual();
    registrar(`Descanso ${el.dataset.t}`, `Vida +${r.ganhoVida} (d${r.lados}: ${r.rolagemVida}) · Energia +${r.ganhoEnergia} (d${r.lados}: ${r.rolagemEnergia})`);
    desenhar();
  },
  'usar-hab'(el) {
    const h = atual.habilidades[num(el.dataset.i)], crit = el.dataset.c === '1';
    const r = Regras.usarHabilidade(atual, h, { critico: crit });
    if (!r.ok) return aviso(r.motivo, 3600);
    gravarAtual();
    registrar(`${h.nome}${crit ? ' (crítico)' : ''}`, `${r.rolagem.texto} = ${r.rolagem.total}${crit ? ` ×2 = ${r.total}` : ''} · ${r.custo ? `−${r.custo} Energia` : 'sem gasto de Energia'}`, crit ? 'critico' : '');
    desenhar();
  },
  // ----- inventário -----
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
  if (e.key === 'Enter' && e.target.id === 'expr') { e.preventDefault(); acoes['rolar-expr'](); }
});
raiz.addEventListener('submit', e => {
  e.preventDefault();
  lerForm();
  if (!atual.nome) return aviso('O personagem precisa de um nome');
  try { gravarAtual('Ficha salva'); }
  catch (err) { return aviso('Não consegui salvar: ' + err.message); }
  abrir(atual.id);
});
raiz.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'busca-item') {
    busca = t.value;
    const pos = t.selectionStart;
    desenhar();
    const n = document.getElementById('busca-item'); n.focus(); n.setSelectionRange(pos, pos);
  } else if (t.id === 'dif') difAtual = t.value;
  else if (t.id === 'expr') exprAtual = t.value;
  else if (t.form && t.form.id === 'form-ficha') previa();
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

// Início: semeia data/personagens/personagens.json na 1ª visita, liga o arquivo vinculado e abre direto se a URL tiver #id.
// Quando a nuvem traz fichas novas, a lista se atualiza sozinha (nunca no meio de uma edição).
const abrirDaUrl = () => { const id = location.hash.slice(1); if (id && Personagens.obter(id)) { abrir(id); return true; } return false; };
ArquivoJson.aoEstado = () => { if (tela === 'lista') desenhar(); };
Dados.ouvir('sync', cols => { if (cols.includes('personagens') && tela === 'lista' && !abrirDaUrl()) desenhar(); });
(async () => {
  try {
    await Personagens.semear();
    await ArquivoJson.iniciar();
    if (!abrirDaUrl()) desenhar();
  } catch (e) {
    raiz.innerHTML = `<div class="alert alert-danger mt-5 rounded-0">Não consegui acessar o armazenamento do navegador: ${esc(e.message)}</div>`;
  }
})();
