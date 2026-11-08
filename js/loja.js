// Loja da campanha: compra itens do catálogo (data/itens) com o dinheiro do personagem escolhido na campanha.
// O preço (texto como "1 ouro e 20 pratas") é convertido em bronzes (veja Regras.MOEDAS) e descontado da ficha.
//   Loja.montar(elemento, { campanha })
const Loja = (() => {
  let cache = null;
  const carregar = () => cache ||= (async () => {
    const man = await lerJson('data/manifest.json');
    const gens = await Promise.all((man.itens || []).map(id => lerJson(`data/itens/${id}/${id}.json`).then(d => ({ id, ...d })).catch(() => null)));
    return gens.filter(Boolean).flatMap(g => (g.categorias || []).flatMap(c => c.cards.map(x => ({ ...x, categoria: c.nome, genero: g.genero }))));
  })();
  const fmtKg = n => String(n).replace('.', ',');

  async function montar(el, ctx) {
    const itens = await carregar();
    let busca = '', cat = '', qtd = 1;
    const ficha = () => ctx.campanha.personagemId ? Personagens.obter(ctx.campanha.personagemId) : null;
    const categorias = [...new Set(itens.map(i => i.categoria))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const topo = p => {
      const c = Regras.carga(p);
      return `<div class="card card-dossie mb-3"><div class="card-body p-3">
        <div class="d-flex flex-wrap align-items-center gap-3">
          <div class="flex-grow-1"><b>${esc(p.nome || 'Sem nome')}</b> <small class="text-muted"><a href="fichas.html#${esc(p.id)}" style="color:#ff3333;">abrir ficha</a></small>
            <div class="info-texto">💰 <b>${esc(Regras.formatarMoedas(p.dinheiro))}</b></div>
            <div class="info-texto">Carga: <b${c.excedeu ? ' style="color:#ff3333;"' : ''}>${fmtKg(c.total)}</b> / ${fmtKg(c.capacidade)} kg${c.excedeu ? ' — <b style="color:#ff3333;">acima do limite</b>' : ''}</div></div>
          <div class="d-flex flex-wrap gap-2 align-items-end">
            <input class="campo" style="width:210px;" data-l-din placeholder="Ex.: 2 ouros e 5 pratas" autocomplete="off">
            <button type="button" class="btn-fantasma" data-l="receber">Receber</button>
            <button type="button" class="btn-fantasma" data-l="gastar">Gastar</button>
          </div></div></div></div>`;
    };
    const linha = (i, k, p) => {
      const preco = Regras.precoBronzes(i.valor), total = preco === null ? null : preco * qtd, pode = total !== null && p.dinheiro >= total;
      return `<div class="loja-item"><div class="loja-nome"><b>${esc(i.nome)}</b><br><small>${esc([i.genero, i.categoria, i.raridade].filter(Boolean).join(' · '))}</small></div>
        <div><small>Preço</small><br><b>${esc(i.valor || '—')}</b></div><div><small>Peso</small><br>${esc(i.peso || '—')}</div>
        <button type="button" class="btn-rolar" data-l="comprar" data-k="${k}" ${pode ? '' : 'disabled'} title="${total === null ? 'Sem preço definido' : pode ? '' : 'Dinheiro insuficiente'}">Comprar${qtd > 1 ? ' ×' + qtd : ''}</button></div>`;
    };
    function lista() {
      const p = ficha(), q = busca.trim().toLowerCase();
      const vis = itens.map((i, k) => [i, k]).filter(([i]) => (!cat || i.categoria === cat) && (!q || [i.nome, i.categoria, i.genero, i.raridade].join(' ').toLowerCase().includes(q)));
      el.querySelector('.loja-topo').innerHTML = topo(p);
      el.querySelector('.loja-lista').innerHTML = vis.map(([i, k]) => linha(i, k, p)).join('') || '<p class="text-center text-muted">Nenhum item encontrado.</p>';
    }
    function desenhar() {
      if (!ficha()) {
        el.innerHTML = '<p class="text-center text-muted mt-4">Escolha o personagem desta campanha na aba <b>Personagem</b> para usar a loja.</p>';
        return;
      }
      el.innerHTML = `<div class="loja-topo"></div>
        <div class="d-flex flex-wrap gap-2 mb-3">
          <input class="campo" style="max-width:280px;" type="search" data-l-busca placeholder="Buscar item..." value="${esc(busca)}">
          <select class="campo" style="max-width:220px;" data-l-cat aria-label="Categoria"><option value="">Todas as categorias</option>${categorias.map(c => `<option ${c === cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
          <label class="rotulo d-flex align-items-center gap-2 m-0">Quantidade <input class="campo" style="width:80px;" type="number" min="1" max="99" value="${qtd}" data-l-qtd></label>
        </div><div class="loja-lista"></div>`;
      lista();
    }

    function mexerDinheiro(sinal) {
      const campo = el.querySelector('[data-l-din]'), v = Regras.precoBronzes(campo.value);
      if (v === null || v <= 0) return aviso('Digite um valor, por exemplo "2 ouros e 5 pratas"');
      const p = ficha();
      if (sinal < 0 && p.dinheiro < v) return aviso(`Dinheiro insuficiente: você tem ${Regras.formatarMoedas(p.dinheiro)}.`, 3600);
      p.dinheiro += sinal * v; Personagens.salvar(p);
      aviso(`${sinal > 0 ? 'Recebeu' : 'Gastou'} ${Regras.formatarMoedas(v)}`); lista();
    }
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-l]'); if (!b) return;
      if (b.dataset.l === 'comprar') {
        const item = itens[num(b.dataset.k)], r = Personagens.comprar(ctx.campanha.personagemId, item, qtd);
        if (!r.ok) aviso(r.motivo, 3800);
        else aviso(`Comprou ${item.nome}${qtd > 1 ? ' ×' + qtd : ''} por ${Regras.formatarMoedas(r.total)}${r.excedeu ? ' — carga acima do limite!' : ''}`, 3600);
        lista();
      } else if (b.dataset.l === 'receber') mexerDinheiro(1);
      else if (b.dataset.l === 'gastar') mexerDinheiro(-1);
      e.stopPropagation();
    });
    el.addEventListener('input', e => {
      if (e.target.matches('[data-l-busca]')) { busca = e.target.value; lista(); }
      else if (e.target.matches('[data-l-qtd]')) { qtd = Math.max(1, Math.min(99, num(e.target.value, 1))); lista(); }
      e.stopPropagation();
    });
    el.addEventListener('change', e => { if (e.target.matches('[data-l-cat]')) { cat = e.target.value; lista(); } e.stopPropagation(); });
    el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-l-din]')) { e.preventDefault(); mexerDinheiro(1); } e.stopPropagation(); });
    desenhar();
  }
  return { montar };
})();
