// Fichas de personagem. Fachada sobre Dados (js/dados.js): mantém a API que fichas.js e app.js já usavam.
const Personagens = (() => {
  const COL = 'personagens';
  const norm = p => Regras.migrar(p);   // fichas antigas ganham "ajustes" sem mudar valores

  const listar = () => Dados.listar(COL).map(norm);
  const obter = id => { const p = Dados.obter(COL, id); return p && norm(p); };

  const novo = () => norm({
    id: uid(), nome: '', imagem: '', raca: '', classe: '', nivel: 1, aparencia: '', historia: '',
    vida: { atual: 10, max: 10 }, energia: { atual: 10, max: 10 }, ajustes: { vida: 0, energia: 0, defesa: 0 },
    habilidades: [], forca: 0, agilidade: 0, inteligencia: 0, carisma: 0, inventario: [], atualizado: Date.now()
  });

  function salvar(p) { Regras.aplicar(p); return Dados.salvar(COL, p); }
  const excluir = id => Dados.excluir(COL, id);

  // Converte um card do site (item da loja) no formato do inventário
  const itemDeCard = c => ({
    nome: c.nome, imagem: c.imagem || '', categoria: c.categoria || '', raridade: c.raridade || '',
    valor: c.valor || '', peso: c.peso || '',
    efeitos: Array.isArray(c.efeitos) ? c.efeitos.join(', ') : (c.efeitos || ''),
    detalhes: Object.entries(c.atributos || {}).map(([k, v]) => `${k}: ${v}`).join(' · '),
    descricao: c.descricao || ''
  });

  // Soma 1 se o personagem já tem o item (mesmo nome); senão cria a linha
  function adicionarItem(pid, item, qtd = 1) {
    const p = obter(pid);
    if (!p) return null;
    const ja = p.inventario.find(i => i.nome === item.nome);
    if (ja) ja.qtd += qtd; else p.inventario.push({ id: uid(), qtd, ...item });
    return salvar(p);
  }

  // Compra: desconta o preço (em bronzes) do dinheiro da ficha e põe o item no inventário. Devolve { ok, motivo?, total?, excedeu? }.
  function comprar(pid, card, qtd = 1) {
    const p = obter(pid); if (!p) return { ok: false, motivo: 'Personagem não encontrado.' };
    const preco = Regras.precoBronzes(card.valor), r = Regras.pagar(p, preco === null ? NaN : preco, qtd);
    if (!r.ok) return r;
    const item = itemDeCard(card), ja = p.inventario.find(i => i.nome === item.nome);
    if (ja) ja.qtd += qtd; else p.inventario.push({ id: uid(), qtd, ...item });
    salvar(p);
    return { ok: true, total: r.total, excedeu: Regras.carga(p).excedeu, dinheiro: p.dinheiro };
  }

  const exportar = () => Dados.exportar(COL);
  const importar = texto => Dados.importar(COL, texto);

  // Ponto de partida: data/personagens/personagens.json é carregado na primeira visita de um navegador
  async function semear() {
    await Dados.pronto;
    if (localStorage.getItem('grimorio.seed.personagens')) return;
    localStorage.setItem('grimorio.seed.personagens', '1');
    if (Dados.total(COL) || Dados.temLegado()) return;
    try { const r = await fetch('data/personagens/personagens.json'); if (r.ok) importar(await r.text()); } catch { /* sem ponto de partida */ }
  }

  const api = { listar, obter, novo, salvar, excluir, itemDeCard, adicionarItem, comprar, exportar, importar, uid, semear, aoMudar: null };
  Dados.ouvir('mudou:' + COL, () => api.aoMudar?.());   // o arquivo vinculado grava a cada mudança (local ou vinda da nuvem)
  return api;
})();
