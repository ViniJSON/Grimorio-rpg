// Resultados dos oráculos que você guardou. Fachada (assíncrona, como antes) sobre Dados (js/dados.js).
// Cada registro: { id, genero, gerador, nome, linhas: [{ rotulo, texto }], notas, imagem, criado, atualizado }
const Salvos = (() => {
  const COL = 'salvos';
  const listar = async () => { await Dados.pronto; return Dados.listar(COL).sort((a, b) => b.criado - a.criado); };
  const salvar = async r => { await Dados.pronto; if (!r.criado) r.criado = Date.now(); return Dados.salvar(COL, r); };
  const excluir = async id => { await Dados.pronto; Dados.excluir(COL, id); };
  const novo = ({ genero, gerador, nome, linhas }) => ({ id: uid(), genero, gerador, nome, linhas, notas: '', imagem: '', criado: Date.now() });
  const exportar = async () => { await Dados.pronto; return Dados.exportar(COL); };
  const importar = async texto => { await Dados.pronto; return Dados.importar(COL, texto); };
  return { listar, salvar, excluir, novo, exportar, importar };
})();
