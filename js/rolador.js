// Dados "puros": d4, d6, d8, d10, d12, d20 e d100, com quantidade e bônus numérico (positivo ou negativo).
// Nada é calculado por atributo: você rola, vê o resultado e decide o que ele significa.
//   Rolador.abrir()  /  Rolador.fechar()  /  Rolador.visivel(bool)   -> botão 🎲 flutuante com histórico
//   Rolador.barra(elemento, { aoRolar(resultado, expressao) })        -> a mesma barra de dados, embutida numa tela
const Rolador = (() => {
  const DADOS = [4, 6, 8, 10, 12, 20, 100];

  const barraHtml = () => `
    <div class="rolador-dados">${DADOS.map(l => `<button type="button" class="btn-rolar" data-r="dado" data-l="${l}">d${l}</button>`).join('')}</div>
    <div class="rolador-ajustes">
      <div><span class="rotulo">Quantidade</span><div class="stepper"><button type="button" data-r="passo" data-s="qtd" data-d="-1" aria-label="Menos um dado">−</button><input type="number" data-r-qtd value="1" min="1" max="20"><button type="button" data-r="passo" data-s="qtd" data-d="1" aria-label="Mais um dado">+</button></div></div>
      <div><span class="rotulo">Bônus (pode ser negativo)</span><div class="stepper"><button type="button" data-r="passo" data-s="mod" data-d="-1" aria-label="Diminuir bônus">−</button><input type="number" data-r-mod value="0"><button type="button" data-r="passo" data-s="mod" data-d="1" aria-label="Aumentar bônus">+</button></div></div>
    </div>`;

  // Rola de verdade: "2d20+3", "1d8-2"... e avisa quem estiver ouvindo
  function rolar(root, lados, aoRolar) {
    const qtd = Math.max(1, Math.min(20, num(root.querySelector('[data-r-qtd]').value, 1))), mod = num(root.querySelector('[data-r-mod]').value);
    const expr = `${qtd}d${lados}${mod ? (mod > 0 ? '+' : '-') + Math.abs(mod) : ''}`;
    aoRolar(Regras.rolar(expr, {}), expr);
  }
  function ligar(root, aoRolar) {
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-r]'); if (!b || !root.contains(b)) return;
      if (b.dataset.r === 'dado') rolar(root, num(b.dataset.l), aoRolar);
      else if (b.dataset.r === 'passo') {
        const qtd = b.dataset.s === 'qtd', c = root.querySelector(qtd ? '[data-r-qtd]' : '[data-r-mod]');
        c.value = Math.max(qtd ? 1 : -99, Math.min(qtd ? 20 : 99, num(c.value) + num(b.dataset.d)));
      }
      e.stopPropagation();
    });
  }
  // Marca 20 e 1 naturais num d20 sozinho (só para colorir o histórico)
  const classeDe = r => { const p = r.partes[0]; return p && p.rotulo === '1d20' ? (p.rolagens[0] === 20 ? 'critico' : p.rolagens[0] === 1 ? 'falha-critica' : '') : ''; };

  // ---------- Barra embutida (usada no combate) ----------
  function barra(el, { aoRolar }) {
    el.innerHTML = barraHtml();
    ligar(el, aoRolar);
  }

  // ---------- Botão flutuante ----------
  let historico = [];
  const raizEl = () => document.getElementById('rolador-flutuante');
  const histHtml = () => historico.length
    ? historico.map(h => `<div class="rol ${h.classe}"><b>${esc(h.titulo)}</b> <span>${esc(h.detalhe)}</span> <b class="rol-total">${h.total}</b></div>`).join('')
    : '<div class="info-texto text-muted">Escolha um dado. As últimas rolagens aparecem aqui.</div>';

  function abrir() {
    if (raizEl()) return;
    const el = document.createElement('div');
    el.id = 'rolador-flutuante'; el.className = 'rolador-flut';
    el.innerHTML = `<div class="rolador-painel" hidden>
        <div class="d-flex align-items-center mb-2"><b class="flex-grow-1" style="letter-spacing:2px;">DADOS</b><button type="button" class="inv-rm" data-r="alternar" aria-label="Fechar">✕</button></div>
        <div class="rolador-barra">${barraHtml()}</div>
        <div class="rolador-hist">${histHtml()}</div>
      </div>
      <button type="button" class="rolador-fab" data-r="alternar" aria-label="Menu de dados" title="Dados">🎲</button>`;
    document.body.appendChild(el);
    ligar(el.querySelector('.rolador-barra'), (r, expr) => {
      historico.unshift({ titulo: expr, detalhe: r.texto, total: r.total, classe: classeDe(r) });
      historico = historico.slice(0, 12);
      el.querySelector('.rolador-hist').innerHTML = histHtml();
    });
    el.addEventListener('click', e => {
      if (e.target.closest('[data-r=alternar]')) { const p = el.querySelector('.rolador-painel'); p.hidden = !p.hidden; }
    });
  }
  const fechar = () => raizEl()?.remove();
  const visivel = sim => { const el = raizEl(); if (el) el.style.display = sim ? '' : 'none'; };
  return { abrir, fechar, visivel, barra, classeDe };
})();
