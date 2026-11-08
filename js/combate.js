// Combate da campanha, 100% manual: o site não rola ataque, não calcula dano e não decide nada sozinho.
// Você escolhe os inimigos (e quantos), vê as fichas completas, ajusta Vida/Energia à mão, anota a iniciativa,
// rola dados puros (com bônus positivo ou negativo) e o registro guarda o que aconteceu.
// A Vida/Energia do personagem é a da ficha (as mudanças ficam gravadas nela); o combate em andamento fica salvo na campanha.
//   Combate.montar(elemento, { campanha, salvar })
const Combate = (() => {
  const VERSAO = 2;
  let cache = null;
  const carregar = () => cache ||= (async () => {
    const man = await lerJson('data/manifest.json');
    const ler = async sec => (await Promise.all((man[sec] || []).map(id => lerJson(`data/${sec}/${id}/${id}.json`).then(d => ({ id, ...d })).catch(() => null))))
      .filter(Boolean).flatMap(g => (g.categorias || []).flatMap(c => c.cards.map(x => ({ ...x, genero: g.genero }))));
    return { bestiario: await ler('bestiario'), classes: await ler('classes') };
  })();
  const igual = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
  const limitar = (v, min, max) => Math.max(min, Math.min(max, v));
  const novoCombate = () => ({ versao: VERSAO, fase: 'preparo', rodada: 1, vez: '', jogadorIni: null, fichas: {}, inimigos: [], log: [] });
  const imgOnError = `onerror="this.onerror=null;this.src='${PLACEHOLDER}'"`;
  const barra = (atual, max, cor) => `<div class="barra"><i style="width:${max ? limitar(atual / max * 100, 0, 100) : 0}%;${cor ? 'background:' + cor + ';' : ''}"></i></div>`;
  const lista = a => (a || []).length ? `<ul class="habilidades">${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<div class="info-texto text-muted">—</div>';

  // Ficha do bestiário guardada no combate (a cópia não muda se você editar o JSON no meio da luta)
  const fichaDe = c => ({ nome: c.nome, imagem: c.imagem || '', descricao: c.descricao || '', ameaca: c.ameaca || '', personalidade: c.personalidade || '',
    atributos: c.atributos || {}, habilidades: (c.habilidades || []).map(h => ({ nome: h.nome, descricao: h.descricao })), fraquezas: c.fraquezas || [], resistencias: c.resistencias || [] });

  async function montar(el, ctx) {
    const { bestiario, classes } = await carregar();
    const ficha = () => ctx.campanha.personagemId ? Personagens.obter(ctx.campanha.personagemId) : null;
    const c = () => ctx.campanha.combate;
    const salvar = () => ctx.salvar();
    const ui = { inimigo: '0', qtd: 1, nota: '' };
    const inimigo = id => c().inimigos.find(i => i.uid === id);
    const logar = (t, classe = '') => { c().log.unshift({ t, c: classe }); c().log = c().log.slice(0, 100); };

    el.innerHTML = '<div class="c-corpo"></div><div class="c-dados mt-3" hidden></div><div class="c-log"></div>';
    const corpo = el.querySelector('.c-corpo'), dados = el.querySelector('.c-dados'), logEl = el.querySelector('.c-log');
    Rolador.barra(dados, { aoRolar: (r, expr) => { logar(`🎲 ${expr}: ${r.texto} = ${r.total}`, Rolador.classeDe(r)); salvar(); desenharLog(); } });

    // ---------- Inimigos ----------
    function renumerar(base) {
      const us = c().inimigos.filter(i => i.base === base);
      us.forEach((u, k) => u.nome = us.length > 1 ? `${base} ${k + 1}` : base);
    }
    function adicionar(f, qtd) {
      const k = c(), n = limitar(num(qtd, 1), 1, 20);
      k.fichas[f.nome] ||= f;
      const vida = Math.max(1, num(f.atributos.Vida, 1));
      for (let i = 0; i < n; i++) k.inimigos.push({ uid: uid(), base: f.nome, nome: f.nome, vida: { atual: vida, max: vida }, ini: null });
      renumerar(f.nome);
      if (k.fase === 'luta') logar(`➕ ${n > 1 ? n + '× ' : ''}${f.nome} entrou no combate.`);
    }
    function remover(uidx) {
      const i = inimigo(uidx); if (!i) return;
      c().inimigos = c().inimigos.filter(x => x !== i);
      if (!c().inimigos.some(x => x.base === i.base)) delete c().fichas[i.base]; else renumerar(i.base);
      if (c().vez === uidx) c().vez = '';
      if (c().fase === 'luta') logar(`✖ ${i.nome} saiu do combate.`);
    }

    // ---------- Vida, Energia, iniciativa e turnos (tudo à mão) ----------
    function mexer(id, chave, delta) {
      let nome, r, alvo = null;
      if (id === 'jogador') { alvo = ficha(); nome = alvo.nome; r = alvo[chave]; } else { const i = inimigo(id); nome = i.nome; r = i.vida; }
      const antes = r.atual; r.atual = limitar(r.atual + delta, 0, r.max);
      if (alvo) Personagens.salvar(alvo);
      logar(`${nome}: ${chave === 'energia' ? 'Energia' : 'Vida'} ${antes} → ${r.atual} (${delta > 0 ? '+' : '−'}${Math.abs(delta)})`, delta < 0 ? (id === 'jogador' ? 'falha' : 'sucesso') : '');
      salvar(); desenhar(); desenharLog();
    }
    const ordem = () => {
      const k = c(), p = ficha();
      return [{ id: 'jogador', nome: p.nome, ini: k.jogadorIni }, ...k.inimigos.map(i => ({ id: i.uid, nome: i.nome, ini: i.ini }))]
        .map((o, idx) => ({ ...o, idx })).sort((a, b) => (b.ini ?? -1e9) - (a.ini ?? -1e9) || a.idx - b.idx);
    };
    function turno(dir) {
      const k = c(), o = ordem();
      let i = o.findIndex(x => x.id === k.vez); if (i < 0) i = dir > 0 ? -1 : 0;
      i += dir;
      if (i >= o.length) { i = 0; k.rodada++; } else if (i < 0) { i = o.length - 1; k.rodada = Math.max(1, k.rodada - 1); }
      k.vez = o[i].id; salvar(); desenhar();
    }

    // ---------- Telas ----------
    const controles = (id, chave) => `<div class="controles d-flex flex-wrap align-items-center gap-1 mt-1">
      ${[-5, -1, 1, 5].map(d => `<button type="button" class="btn-fantasma" style="padding:2px 10px;" data-c="rec" data-t="${esc(id)}" data-k="${chave}" data-d="${d}">${d > 0 ? '+' : '−'}${Math.abs(d)}</button>`).join('')}
      <input type="number" min="1" class="campo" style="width:84px;padding:3px 6px;" data-c-val placeholder="valor" aria-label="Valor">
      <button type="button" class="btn-fantasma" style="padding:2px 10px;" data-c="aplicar" data-t="${esc(id)}" data-k="${chave}" data-s="-1">${chave === 'energia' ? 'Gastar' : 'Dano'}</button>
      <button type="button" class="btn-fantasma" style="padding:2px 10px;" data-c="aplicar" data-t="${esc(id)}" data-k="${chave}" data-s="1">${chave === 'energia' ? 'Recuperar' : 'Cura'}</button></div>`;
    const campoIni = (id, valor) => `<label class="rotulo m-0 d-flex align-items-center gap-2">Iniciativa <input type="number" class="campo" style="width:84px;padding:3px 6px;" data-c-ini data-t="${esc(id)}" value="${valor ?? ''}" placeholder="—"></label>`;

    function formAdicionar() {
      const gens = [...new Set(bestiario.map(b => b.genero))];
      return `<div class="d-flex flex-wrap gap-2 align-items-end">
        <label class="rotulo flex-grow-1" style="min-width:230px;">Inimigo<select class="campo" data-c-inimigo>${gens.map(g => `<optgroup label="${esc(g)}">${bestiario.map((b, idx) => [b, idx]).filter(([b]) => b.genero === g)
          .map(([b, idx]) => `<option value="${idx}" ${String(idx) === ui.inimigo ? 'selected' : ''}>${esc(b.nome)} — ${esc(b.ameaca || 'sem nível de ameaça')}</option>`).join('')}</optgroup>`).join('')}</select></label>
        <label class="rotulo">Quantidade<input type="number" class="campo" style="width:90px;" min="1" max="20" value="${ui.qtd}" data-c-qtd></label>
        <button type="button" class="btn-fantasma" data-c="add-inimigo">＋ Adicionar</button></div>`;
    }

    // Ficha completa do inimigo (imagem, descrição, atributos, habilidades, fraquezas e resistências)
    function fichaInimigoHtml(f) {
      const attrs = Object.entries(f.atributos || {});
      return `<div class="row g-3">
        ${f.imagem ? `<div class="col-12 col-sm-4 col-md-3"><img class="foto-ficha" src="${esc(f.imagem)}" alt="${esc(f.nome)}" ${imgOnError}></div>` : ''}
        <div class="col">
          ${f.ameaca ? `<div class="id-matricula">AMEAÇA: ${esc(f.ameaca.toUpperCase())}</div>` : ''}
          <div class="info-texto texto-livre">${esc(f.descricao)}</div>
          ${f.personalidade ? `<div class="info-label">PERSONALIDADE:</div><div class="info-texto">${esc(f.personalidade)}</div>` : ''}
          ${attrs.length ? `<div class="info-label">ATRIBUTOS:</div><div class="atributos">${attrs.map(([k, v]) => `<div><span>${esc(k.toUpperCase())}</span>${esc(v)}</div>`).join('')}</div>` : ''}
        </div></div>
        ${f.habilidades.length ? `<div class="info-label">HABILIDADES:</div><ul class="habilidades">${f.habilidades.map(h => `<li><b>${esc(h.nome)}:</b> ${esc(h.descricao)}</li>`).join('')}</ul>` : ''}
        <div class="row g-3"><div class="col-12 col-md-6"><div class="info-label">FRAQUEZAS:</div>${lista(f.fraquezas)}</div>
          <div class="col-12 col-md-6"><div class="info-label">RESISTÊNCIAS:</div>${lista(f.resistencias)}</div></div>`;
    }

    // A sua ficha no combate: imagem, Vida, Energia, atributos, poderes da classe até o nível e as habilidades que você criou
    function fichaJogadorHtml(p) {
      const cls = classes.find(x => igual(x.nome, p.classe));
      const poderes = cls ? (cls.habilidades || []).filter(h => { const m = /Nível (\d+)/.exec(h.nome || ''); return !m || +m[1] <= p.nivel; }) : [];
      const vez = c().vez === 'jogador';
      return `<div class="card card-dossie mb-3 ${vez ? 'vez-card' : ''}"><div class="card-body p-3">
        <div class="row g-3">
          ${p.imagem ? `<div class="col-12 col-sm-4 col-md-3"><img class="foto-ficha" src="${esc(p.imagem)}" alt="${esc(p.nome)}" ${imgOnError}></div>` : ''}
          <div class="col">
            <div class="d-flex flex-wrap align-items-baseline gap-2"><h5 class="nome-agente m-0">${esc(p.nome)}</h5>
              <span class="id-matricula">${esc([p.raca, p.classe].filter(Boolean).join(' · ') || '—')} · NÍVEL ${p.nivel}</span>${vez ? '<b style="color:#ffcc00;">▶ SUA VEZ</b>' : ''}</div>
            <div class="row g-3 mt-0"><div class="col-12 col-md-6"><div class="info-texto"><b>Vida</b> ${p.vida.atual}/${p.vida.max}</div>${barra(p.vida.atual, p.vida.max)}${controles('jogador', 'vida')}</div>
              <div class="col-12 col-md-6"><div class="info-texto"><b>Energia</b> ${p.energia.atual}/${p.energia.max}</div>${barra(p.energia.atual, p.energia.max, '#2a5bd7')}${controles('jogador', 'energia')}</div></div>
            <div class="atributos atributos-5 mt-3">${Regras.ATRIBUTOS.map(([k, s]) => `<div><span>${s}</span>${esc(p[k])}</div>`).join('')}<div><span>DEFESA</span>${esc(p.defesa)}</div></div>
            <div class="mt-2">${campoIni('jogador', c().jogadorIni)}</div>
          </div></div>
        <details class="gerador mt-3" open><summary>Poderes da classe${cls ? ' — ' + esc(cls.nome) : ''} <small>até o nível ${p.nivel}</small></summary><div class="gerador-corpo">
          ${poderes.length ? `<ul class="habilidades">${poderes.map(h => `<li><b>${esc(h.nome)}:</b> ${esc(h.descricao)}</li>`).join('')}</ul>` : `<div class="info-texto text-muted">${p.classe ? 'Essa classe não está cadastrada em Classes.' : 'Escolha a classe na ficha para ver os poderes aqui.'}</div>`}</div></details>
        <details class="gerador mt-2" open><summary>Minhas habilidades <small>${(p.habilidades || []).length}</small></summary><div class="gerador-corpo">
          ${(p.habilidades || []).length ? `<ul class="habilidades">${p.habilidades.map(h => { const l = Regras.ladosDe(h.dado); return `<li><b>${esc(h.nome)}:</b> ${esc(h.descricao)}${l ? ` <small style="color:#ffcc00;">(1d${l}${esc(h.extra || '')} · ${Regras.custoEnergia(h.dado)} Energia)</small>` : ''}</li>`; }).join('')}</ul>`
            : '<div class="info-texto text-muted">Você não criou habilidades nessa ficha.</div>'}</div></details>
      </div></div>`;
    }

    function cartaoInimigo(i, primeiro) {
      const f = c().fichas[i.base], vez = c().vez === i.uid;
      return `<div class="card card-dossie mb-3 ${vez ? 'vez-card' : ''} ${i.vida.atual <= 0 ? 'combatente morto' : ''}"><div class="card-body p-3">
        <div class="d-flex flex-wrap align-items-baseline gap-2"><h5 class="nome-agente m-0">${esc(i.nome)}</h5>${vez ? '<b style="color:#ffcc00;">▶ VEZ</b>' : ''}${i.vida.atual <= 0 ? '<span class="id-matricula">DERROTADO</span>' : ''}
          <button type="button" class="inv-rm ms-auto" data-c="rm-unidade" data-t="${esc(i.uid)}" aria-label="Remover do combate" title="Remover do combate">✕</button></div>
        <div class="row g-3"><div class="col-12 col-md-7"><div class="info-texto"><b>Vida</b> ${i.vida.atual}/${i.vida.max} · <b>Defesa</b> ${esc(f.atributos.Defesa ?? '—')}</div>${barra(i.vida.atual, i.vida.max)}${controles(i.uid, 'vida')}</div>
          <div class="col-12 col-md-5">${campoIni(i.uid, i.ini)}</div></div>
        <details class="gerador mt-3" ${primeiro ? 'open' : ''}><summary>Ficha — ${esc(f.nome)}</summary><div class="gerador-corpo">${fichaInimigoHtml(f)}</div></details>
      </div></div>`;
    }

    function telaPreparo(p) {
      const k = c(), bases = [...new Set(k.inimigos.map(i => i.base))];
      corpo.innerHTML = `<div class="card card-dossie mb-3"><div class="card-body p-3">
          <div class="info-texto">Personagem: <b>${esc(p.nome)}</b> <small class="text-muted">· Vida ${p.vida.atual}/${p.vida.max}</small></div>
          <div class="info-label">INIMIGOS:</div>${formAdicionar()}
          <div class="mt-3">${bases.length ? bases.map(b => { const n = k.inimigos.filter(i => i.base === b).length, f = k.fichas[b];
            return `<div class="loja-item"><div class="loja-nome"><b>${esc(b)}</b> × ${n}<br><small>Vida ${esc(f.atributos.Vida ?? '—')} · Defesa ${esc(f.atributos.Defesa ?? '—')} · ${esc(f.ameaca || '')}</small></div>
              <button type="button" class="btn-fantasma" data-c="menos" data-b="${esc(b)}">− 1</button><button type="button" class="btn-fantasma" data-c="mais" data-b="${esc(b)}">+ 1</button></div>`; }).join('')
            : '<div class="info-texto text-muted">Escolha o inimigo e a quantidade, e clique em Adicionar.</div>'}</div>
          <button type="button" class="btn-rolar mt-3" data-c="iniciar" ${k.inimigos.length ? '' : 'disabled'}>⚔ Iniciar combate</button>
          <div class="info-texto text-muted mt-2"><small>Ao iniciar, aparecem as fichas completas. Tudo é manual: você rola os dados e ajusta Vida e Energia.</small></div>
        </div></div>`;
    }

    function telaLuta(p) {
      const k = c(), o = ordem(), vistas = new Set();
      corpo.innerHTML = `
        <div class="d-flex flex-wrap align-items-center gap-2 mb-2"><b style="letter-spacing:2px;">RODADA ${k.rodada}</b>
          <button type="button" class="btn-fantasma" data-c="anterior" title="Turno anterior">◀</button>
          <button type="button" class="btn-rolar" data-c="proximo">Próximo turno ▶</button><span class="flex-grow-1"></span>
          <button type="button" class="btn-fantasma btn-perigo" data-c="encerrar">Encerrar combate</button></div>
        <div class="ini-ordem">${o.map(x => `<span class="${x.id === k.vez ? 'vez' : ''}">${esc(x.nome)} <small>${x.ini ?? '—'}</small></span>`).join('')}</div>
        ${fichaJogadorHtml(p)}
        <div class="info-label">INIMIGOS:</div>
        ${k.inimigos.map(i => { const primeiro = !vistas.has(i.base); vistas.add(i.base); return cartaoInimigo(i, primeiro); }).join('') || '<p class="text-center text-muted">Nenhum inimigo em campo.</p>'}
        <details class="gerador mt-2"><summary>＋ Adicionar mais inimigos</summary><div class="gerador-corpo">${formAdicionar()}</div></details>`;
    }

    function desenharLog() {
      const k = c(); if (!k || k.fase !== 'luta') { logEl.innerHTML = ''; return; }
      logEl.innerHTML = `<div class="info-label">REGISTRO:</div>
        <div class="d-flex gap-2 mb-2"><input class="campo" data-c-nota placeholder="Anotar algo (ex.: Goblin 2 foge)" value="${esc(ui.nota)}" autocomplete="off"><button type="button" class="btn-fantasma" data-c="nota">Anotar</button><button type="button" class="btn-fantasma" data-c="limpar-log">Limpar</button></div>
        <div class="combate-log">${k.log.map(l => `<div class="rol ${esc(l.c)}">${esc(l.t)}</div>`).join('') || '<div class="info-texto text-muted">As rolagens e os ajustes aparecem aqui.</div>'}</div>`;
    }

    function desenhar() {
      const p = ficha();
      if (!p) { corpo.innerHTML = '<p class="text-center text-muted mt-4">Escolha o personagem desta campanha na aba <b>Personagem</b> para lutar.</p>'; dados.hidden = true; logEl.innerHTML = ''; return; }
      if (!c() || c().versao !== VERSAO) ctx.campanha.combate = novoCombate();   // combates de versões antigas são descartados
      dados.hidden = c().fase !== 'luta';
      (c().fase === 'luta' ? telaLuta : telaPreparo)(p);
    }

    // ---------- Ações ----------
    const acoes = {
      'add-inimigo'() { const card = bestiario[num(ui.inimigo)]; if (!card) return; adicionar(fichaDe(card), ui.qtd); salvar(); desenhar(); desenharLog(); },
      mais(b) { adicionar(c().fichas[b.dataset.b], 1); salvar(); desenhar(); },
      menos(b) { const u = [...c().inimigos].reverse().find(i => i.base === b.dataset.b); if (u) remover(u.uid); salvar(); desenhar(); },
      'rm-unidade'(b) { remover(b.dataset.t); salvar(); desenhar(); desenharLog(); },
      iniciar() { const k = c(); k.fase = 'luta'; k.rodada = 1; k.vez = ''; k.log = []; logar('⚔ Combate iniciado. Anote a iniciativa de cada um e use "Próximo turno".', 'critico'); salvar(); desenhar(); desenharLog(); },
      proximo() { turno(1); }, anterior() { turno(-1); },
      rec(b) { mexer(b.dataset.t, b.dataset.k, num(b.dataset.d)); },
      aplicar(b) {
        const campo = b.closest('.controles').querySelector('[data-c-val]'), v = Math.abs(num(campo.value));
        if (!v) return aviso('Digite um valor');
        mexer(b.dataset.t, b.dataset.k, v * num(b.dataset.s));
      },
      nota() { const t = ui.nota.trim(); if (!t) return; logar('📝 ' + t); ui.nota = ''; salvar(); desenharLog(); },
      'limpar-log'() { c().log = []; salvar(); desenharLog(); },
      encerrar() { if (confirm('Encerrar o combate? Os inimigos e o registro serão apagados (a Vida e a Energia da ficha continuam como estão).')) { ctx.campanha.combate = null; salvar(); desenhar(); desenharLog(); } }
    };
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-c]'); if (!b) return;
      Promise.resolve().then(() => acoes[b.dataset.c]?.(b)).catch(err => aviso('Erro: ' + err.message));
      e.stopPropagation();
    });
    el.addEventListener('change', e => {
      const t = e.target;
      if (t.matches('[data-c-inimigo]')) ui.inimigo = t.value;
      else if (t.matches('[data-c-ini]')) {
        const v = t.value === '' ? null : num(t.value);
        if (t.dataset.t === 'jogador') c().jogadorIni = v; else inimigo(t.dataset.t).ini = v;
        salvar(); desenhar();
      }
      e.stopPropagation();
    });
    el.addEventListener('input', e => {
      if (e.target.matches('[data-c-qtd]')) ui.qtd = limitar(num(e.target.value, 1), 1, 20);
      else if (e.target.matches('[data-c-nota]')) ui.nota = e.target.value;
      e.stopPropagation();
    });
    el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-c-nota]')) { e.preventDefault(); acoes.nota(); } e.stopPropagation(); });
    desenhar(); desenharLog();
  }
  return { montar };
})();
