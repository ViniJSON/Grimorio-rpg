// Oráculos como bloco reutilizável: lê os geradores de data/oraculos/<genero>/<genero>.json e rola os dados.
// Usado na página Oráculos e dentro da campanha. Para criar ou mudar um oráculo, edite o JSON (veja o README).
//   Oraculos.montar(elemento, { usarHash, campanhaId, irSalvos, aoSalvar, rodape, aposDesenhar })
const Oraculos = (() => {
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
  function sortear(t) {
    const d = dadoEf(t), n = 1 + Math.floor(Math.random() * d), i = t.faixas.findIndex(f => n >= f.de && n <= f.ate);
    return { n, d, i, texto: i >= 0 ? t.faixas[i].texto : '(sem resultado para esse número)' };
  }

  // Os JSONs são lidos uma vez só, mesmo que o bloco seja montado várias vezes
  let cache = null;
  const carregar = () => cache ||= (async () => {
    const man = await lerJson('data/manifest.json'), ordem = man.oraculos || [], gen = {};
    await Promise.all(ordem.map(async id => {
      const d = await lerJson(`data/oraculos/${id}/${id}.json`);
      gen[id] = { label: d.genero || id, geradores: (d.geradores || []).map(g => ({ ...g, tabelas: (g.tabelas || []).map(normTabela) })) };
    }));
    return { ordem, gen };
  })();

  const tabelaHtml = (t, ti) => `<div class="tabela-oraculo" data-ti="${ti}">
    <h6>${esc(t.nome)} (d${dadoEf(t)}) <button type="button" class="btn-rolar ms-2" data-acao="rolar">Rolar</button></h6>
    <div class="resultado-geral mini" hidden></div>
    <div class="rolagem-lista"><table>${t.faixas.map((f, i) => `<tr data-f="${i}"><td>${rotFaixa(f)}</td><td>${esc(f.texto)}</td></tr>`).join('')}</table></div></div>`;

  async function montar(el, opts = {}) {
    const { ordem, gen } = await carregar();
    const ULTIMO = new Map();      // "genero|indice" -> último "Rolar tudo" (para o botão Salvar)
    let genAtual = opts.usarHash && ordem.includes(location.hash.slice(1)) ? location.hash.slice(1) : ordem[0];

    const geradorHtml = (g, gi, id) => `<details class="gerador" data-gen="${esc(id)}" data-gi="${gi}">
      <summary>${esc(g.nome)}</summary>
      <div class="gerador-corpo">${g.descricao ? `<p>${esc(g.descricao)}</p>` : ''}
        <button type="button" class="btn-rolar" data-acao="rolar-tudo">Rolar tudo</button>
        <div class="resultado-geral resultado-linhas" hidden></div>
        <div class="acoes-orac" hidden><button type="button" class="btn-fantasma" data-acao="salvar">💾 Salvar este resultado</button>
          ${opts.irSalvos ? '<button type="button" class="btn-fantasma" data-acao="ver-salvos">Ver salvos da campanha</button>' : '<a class="btn-fantasma" href="salvos.html" style="text-decoration:none;">Ver salvos</a>'}</div>
        <div class="info-label mt-3">TABELAS:</div>
        ${g.tabelas.map(tabelaHtml).join('')}
      </div></details>`;

    function desenhar() {
      el.innerHTML = `
        <div class="pilulas mt-3">${ordem.map(id => `<a href="#${esc(id)}" data-acao="aba" data-g="${esc(id)}" class="${id === genAtual ? 'ativo' : ''}">${esc(gen[id].label)}</a>`).join('')}</div>
        <div class="aviso-antigo"></div>
        ${ordem.map(id => `<section class="genero" data-g="${esc(id)}" ${id === genAtual ? '' : 'hidden'}><h3>${esc(gen[id].label)}</h3>
          ${gen[id].geradores.map((g, i) => geradorHtml(g, i, id)).join('') || '<p class="text-center text-muted">Nenhum oráculo neste gênero.</p>'}</section>`).join('')}
        ${opts.rodape || ''}`;
      opts.aposDesenhar?.(el);
    }

    const geradorDe = b => { const d = b.closest('.gerador'); return { d, g: gen[d.dataset.gen].geradores[d.dataset.gi], chave: d.dataset.gen + '|' + d.dataset.gi }; };
    function destacar(tabEl, r) {
      tabEl.querySelectorAll('tr.sorteado').forEach(l => l.classList.remove('sorteado'));
      if (r.i < 0) return;
      const tr = tabEl.querySelector(`tr[data-f="${r.i}"]`), box = tabEl.querySelector('.rolagem-lista');
      tr.classList.add('sorteado'); box.scrollTop = Math.max(0, tr.offsetTop - box.clientHeight / 2);
    }

    const acoes = {
      aba(b) {
        genAtual = b.dataset.g;
        el.querySelectorAll('.genero').forEach(s => s.hidden = s.dataset.g !== genAtual);
        el.querySelectorAll('.pilulas a').forEach(a => a.classList.toggle('ativo', a.dataset.g === genAtual));
        if (opts.usarHash) history.replaceState(null, '', '#' + genAtual);
      },
      rolar(b) {
        const tabEl = b.closest('.tabela-oraculo'), { g } = geradorDe(b), t = g.tabelas[num(tabEl.dataset.ti)], r = sortear(t);
        destacar(tabEl, r);
        const out = tabEl.querySelector('.resultado-geral'); out.hidden = false; out.textContent = `d${r.d}: ${r.n} → ${r.texto}`;
      },
      'rolar-tudo'(b) {
        const { d, g, chave } = geradorDe(b), linhas = [];
        d.querySelectorAll('.tabela-oraculo').forEach(tabEl => {
          const t = g.tabelas[num(tabEl.dataset.ti)], r = sortear(t);
          destacar(tabEl, r); tabEl.querySelector('.resultado-geral').hidden = true;
          linhas.push({ rotulo: t.nome, texto: r.texto });
        });
        ULTIMO.set(chave, linhas);
        const out = d.querySelector('.resultado-linhas'); out.hidden = false;
        out.innerHTML = linhas.map(l => `<div class="linha-res"><b>${esc(l.rotulo)}:</b> ${esc(l.texto)}</div>`).join('');
        d.querySelector('.acoes-orac').hidden = false;
        const s = d.querySelector('[data-acao=salvar]'); s.disabled = false; s.textContent = '💾 Salvar este resultado';
      },
      async salvar(b) {
        const { d, g, chave } = geradorDe(b), linhas = ULTIMO.get(chave);
        if (!linhas) return;
        const nomeLinha = linhas.find(l => /^nome$/i.test(l.rotulo));   // nome inicial: a linha "Nome", senão o nome do gerador
        const reg = Salvos.novo({ genero: gen[d.dataset.gen].label, gerador: g.nome, nome: nomeLinha ? nomeLinha.texto : g.nome, linhas, campanhaId: opts.campanhaId || '' });
        try {
          await Salvos.salvar(reg);
          b.disabled = true; b.textContent = '✔ Salvo';
          aviso(opts.campanhaId ? 'Salvo nesta campanha' : 'Salvo em Salvos');
          opts.aoSalvar?.(reg);
        } catch (e) { aviso('Não consegui salvar: ' + e.message); }
      },
      'ver-salvos'() { opts.irSalvos?.(); },
      ...(opts.acoesExtras || {})
    };

    el.addEventListener('click', e => {
      const b = e.target.closest('[data-acao]'); if (!b) return;
      if (b.tagName === 'A') e.preventDefault();
      acoes[b.dataset.acao]?.(b);
      e.stopPropagation();   // quando embutido na campanha, não deixa a página tratar o mesmo clique
    });
    desenhar();
  }
  return { montar, normTabela };
})();
