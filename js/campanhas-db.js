// Campanhas e sessões. Fachada sobre Dados (js/dados.js). As sessões, o personagem escolhido (personagemId) e o combate em andamento ficam dentro da campanha.
const Campanhas = (() => {
  const COL = 'campanhas';
  const norm = c => ({ ...c, sessoes: Array.isArray(c.sessoes) ? c.sessoes : [], personagemId: c.personagemId || '', combate: c.combate || null });
  const listar = () => Dados.listar(COL).map(norm);
  const obter = id => { const c = Dados.obter(COL, id); return c && norm(c); };
  const novo = () => ({ id: uid(), nome: '', genero: 'fantasia', descricao: '', imagem: '', sessoes: [], personagemId: '', combate: null, criado: Date.now(), atualizado: Date.now() });
  const novaSessao = c => ({
    id: uid(), numero: Math.max(0, ...c.sessoes.map(s => s.numero || 0)) + 1,
    titulo: '', data: '', acontecimentos: '', ganchos: '', criado: Date.now()
  });
  const salvar = c => Dados.salvar(COL, c);
  const excluir = id => Dados.excluir(COL, id);
  const exportar = () => Dados.exportar(COL);
  const importar = texto => Dados.importar(COL, texto, norm);
  return { listar, obter, novo, novaSessao, salvar, excluir, exportar, importar };
})();
