// Página Salvos: monta o bloco de salvos (js/salvos-view.js), com todos os resultados divididos por grupo.
// Dá para renomear, anotar, pôr imagem, ligar a uma campanha e excluir.
Dados.pronto.then(() => SalvosView.montar(raiz)).catch(err => {
  raiz.innerHTML = `<div class="alert alert-danger mt-5 rounded-0">Não consegui abrir os salvos: ${esc(err.message)}.</div>`;
});
