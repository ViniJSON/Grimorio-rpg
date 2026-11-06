// Oráculos: lê os geradores de data/oraculos/<genero>/<genero>.json e rola os dados.
// Para criar ou mudar um oráculo, edite o JSON (veja o README). Nada é gravado no navegador por esta página,
// exceto os resultados que você escolhe salvar (botão "Salvar", veja salvos-db.js).
const raiz = document.getElementById('conteudo');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num = (v, pad = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : pad; };

function aviso(msg) {
  let t = document.querySelector('.toast-ca');
  if (!t) { t = document.createElement('div'); t.className = 'toast-ca'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('on');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 2400);
}

// ---------- Tabelas ----------
// Aceita { nome, linhas: [...] }  |  { nome, dado, linhas }  |  { nome, dado, faixas: [{ de, ate, texto }] }
function normTabela(t) {
  const faixas = Array.isArray(t.faixas) && t.faixas.length
    ? t.faixas.map(f => ({ de: num(f.de, 1), ate: num(f.ate ?? f.de, 1), texto: String(f.texto ?? '') }))
    : (t.linhas || []).map((l, i) => ({ de: i + 1, ate: i + 1, texto: String(l) }));
  return { nome: String(t.nome ?? ''), dado: t.dado ? num(t.dado) : null, faixas };
}
const dadoEf = t => t.dado || t.faixas.reduce((m, f) => Math.max(m, f.ate), 0) || 1;
const rotFaixa = f => f.de === f.ate ? String(f.de) : `${f.de}–${f.ate}`;

function rolar(t) {
  const d = dadoEf(t), n = 1 + Math.floor(Math.random() * d);
  const i = t.faixas.findIndex(f => n >= f.de && n <= f.ate);
  return { n, d, i, texto: i >= 0 ? t.faixas[i].texto : '(sem resultado para esse número)' };
}

// ---------- Estado ----------
let ORDEM = [];                 // ids dos gêneros (ordem do manifest)
const GEN = {};                 // id -> { label, geradores: [{ nome, descricao, tabelas }] }
let genAtual = '';
const ULTIMO = new Map();       // "genero|indice" -> último "Rolar tudo" (para o botão Salvar)

// ---------- Desenho ----------
const tabelaHtml = (t, ti) => `<div class="tabela-oraculo" data-ti="${ti}">
  <h6>${esc(t.nome)} (d${dadoEf(t)}) <button type="button" class="btn-rolar ms-2" data-acao="rolar">Rolar</button></h6>
  <div class="resultado-geral mini" hidden></div>
  <div class="rolagem-lista"><table>${t.faixas.map((f, i) => `<tr data-f="${i}"><td>${rotFaixa(f)}</td><td>${esc(f.texto)}</td></tr>`).join('')}</table></div></div>`;

const geradorHtml = (g, gi, gen) => `<details class="gerador" data-gen="${esc(gen)}" data-gi="${gi}">
  <summary>${esc(g.nome)}</summary>
  <div class="gerador-corpo">${g.descricao ? `<p>${esc(g.descricao)}</p>` : ''}
    <button type="button" class="btn-rolar" data-acao="rolar-tudo">Rolar tudo</button>
    <div class="resultado-geral resultado-linhas" hidden></div>
    <div class="acoes-orac" hidden><button type="button" class="btn-fantasma" data-acao="salvar">💾 Salvar este resultado</button><a class="btn-fantasma" href="salvos.html" style="text-decoration:none;">Ver salvos</a></div>
    <div class="info-label mt-3">TABELAS:</div>
    ${g.tabelas.map(tabelaHtml).join('')}
  </div></details>`;

function desenhar() {
  raiz.innerHTML = `
    <div class="pilulas mt-4">${ORDEM.map(id => `<a href="#${esc(id)}" data-acao="aba" data-g="${esc(id)}" class="${id === genAtual ? 'ativo' : ''}">${esc(GEN[id].label)}</a>`).join('')}</div>
    <div id="aviso-antigo"></div>
    ${ORDEM.map(id => `<section class="genero" id="${esc(id)}" ${id === genAtual ? '' : 'hidden'}><h3>${esc(GEN[id].label)}</h3>
      ${GEN[id].geradores.map((g, i) => geradorHtml(g, i, id)).join('') || '<p class="text-center text-muted">Nenhum oráculo neste gênero.</p>'}</section>`).join('')}
    <div class="painel-arquivo">Os oráculos vêm dos arquivos em <b>data/oraculos/&lt;gênero&gt;/</b>. Para criar ou mudar um, edite o JSON (formato no README). Use <b>Salvar</b> depois de rolar para guardar o resultado na página <a href="salvos.html" style="color:#ff3333;">Salvos</a>.</div>`;
  avisoAntigo();
}

// ---------- Oráculos que ficaram no navegador numa versão antiga ----------
function legado() {
  try {
    const d = JSON.parse(localStorage.getItem('grimorio.oraculos.v1'));
    return d && Array.isArray(d.meus) && d.meus.length ? d : null;
  } catch { return null; }
}
const tabelaParaJson = t => {
  const n = normTabela(t), simples = n.faixas.every((f, i) => f.de === f.ate && f.de === i + 1);
  const o = { nome: n.nome };
  if (n.dado) o.dado = n.dado;
  if (simples) o.linhas = n.faixas.map(f => f.texto); else o.faixas = n.faixas;
  return o;
};
function avisoAntigo() {
  const d = legado(), el = document.getElementById('aviso-antigo');
  if (!d || !el) return;
  el.innerHTML = `<div class="painel-arquivo" style="margin:16px 0;border-color:#ffcc00;">⚠ Há <b>${d.meus.length} oráculo(s)</b> que você criou/editou numa versão antiga, guardados só neste navegador.
    <button type="button" class="btn-fantasma ms-2" data-acao="baixar-antigos">Baixar em JSON</button>
    <div class="mt-1">Cada item do arquivo baixado é um gerador pronto para colar dentro de <code>"geradores": [ ... ]</code> do JSON do gênero.</div></div>`;
}
function baixarAntigos() {
  const d = legado(); if (!d) return;
  const out = {};
  d.meus.forEach(m => (out[m.genero] ||= []).push({ nome: m.nome, descricao: m.descricao || '', tabelas: (m.tabelas || []).map(tabelaParaJson) }));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
  a.download = 'oraculos-antigos.json'; a.click(); URL.revokeObjectURL(a.href);
}

// ---------- Rolagem ----------
const geradorDe = el => { const d = el.closest('.gerador'); return { d, g: GEN[d.dataset.gen].geradores[d.dataset.gi], chave: d.dataset.gen + '|' + d.dataset.gi }; };

function destacar(tabEl, r) {
  tabEl.querySelectorAll('tr.sorteado').forEach(l => l.classList.remove('sorteado'));
  if (r.i < 0) return;
  const tr = tabEl.querySelector(`tr[data-f="${r.i}"]`), box = tabEl.querySelector('.rolagem-lista');
  tr.classList.add('sorteado');
  box.scrollTop = Math.max(0, tr.offsetTop - box.clientHeight / 2);
}

const acoes = {
  aba(el) {
    genAtual = el.dataset.g;
    document.querySelectorAll('.genero').forEach(s => s.hidden = s.id !== genAtual);
    document.querySelectorAll('.pilulas a').forEach(a => a.classList.toggle('ativo', a.dataset.g === genAtual));
    history.replaceState(null, '', '#' + genAtual);
  },
  rolar(el) {
    const tabEl = el.closest('.tabela-oraculo'), { g } = geradorDe(el), t = g.tabelas[num(tabEl.dataset.ti)], r = rolar(t);
    destacar(tabEl, r);
    const out = tabEl.querySelector('.resultado-geral');
    out.hidden = false; out.textContent = `d${r.d}: ${r.n} → ${r.texto}`;
  },
  'rolar-tudo'(el) {
    const { d, g, chave } = geradorDe(el), linhas = [];
    d.querySelectorAll('.tabela-oraculo').forEach(tabEl => {
      const t = g.tabelas[num(tabEl.dataset.ti)], r = rolar(t);
      destacar(tabEl, r);
      tabEl.querySelector('.resultado-geral').hidden = true;
      linhas.push({ rotulo: t.nome, texto: r.texto });
    });
    ULTIMO.set(chave, linhas);
    const out = d.querySelector('.resultado-linhas');
    out.hidden = false;
    out.innerHTML = linhas.map(l => `<div class="linha-res"><b>${esc(l.rotulo)}:</b> ${esc(l.texto)}</div>`).join('');
    d.querySelector('.acoes-orac').hidden = false;
    const s = d.querySelector('[data-acao=salvar]'); s.disabled = false; s.textContent = '💾 Salvar este resultado';
  },
  async salvar(el) {
    const { d, g, chave } = geradorDe(el), linhas = ULTIMO.get(chave);
    if (!linhas) return;
    // nome inicial: a primeira linha que parece um nome, senão o nome do gerador
    const nomeLinha = linhas.find(l => /^nome$/i.test(l.rotulo));
    const reg = Salvos.novo({ genero: GEN[d.dataset.gen].label, gerador: g.nome, nome: nomeLinha ? nomeLinha.texto : g.nome, linhas });
    try {
      await Salvos.salvar(reg);
      el.disabled = true; el.textContent = '✔ Salvo';
      aviso('Salvo em Salvos');
    } catch (e) { aviso('Não consegui salvar: ' + e.message); }
  },
  'baixar-antigos'() { baixarAntigos(); }
};

raiz.addEventListener('click', e => {
  const b = e.target.closest('[data-acao]');
  if (!b) return;
  if (b.tagName === 'A') e.preventDefault();
  acoes[b.dataset.acao]?.(b);
});

// ---------- Início ----------
(async () => {
  try {
    const ler = async url => { const r = await fetch(url); if (!r.ok) throw new Error(url + ' (' + r.status + ')'); return r.json(); };
    const man = await ler('data/manifest.json');
    ORDEM = man.oraculos || [];
    await Promise.all(ORDEM.map(async id => {
      const d = await ler(`data/oraculos/${id}/${id}.json`);
      GEN[id] = { label: d.genero || id, geradores: (d.geradores || []).map(g => ({ ...g, tabelas: (g.tabelas || []).map(normTabela) })) };
    }));
    genAtual = ORDEM.includes(location.hash.slice(1)) ? location.hash.slice(1) : ORDEM[0];
    desenhar();
  } catch (e) {
    raiz.innerHTML = `<div class="alert alert-danger mt-5 rounded-0">Não consegui carregar os dados: ${esc(e.message)}.` +
      (location.protocol === 'file:' ? '<br>Abrindo o arquivo direto do computador o navegador bloqueia os JSONs. Rode um servidor local (veja o LEIAME.md).' : '') + '</div>';
  }
})();
