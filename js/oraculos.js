// Página Oráculos: monta o bloco de oráculos (js/oraculos-core.js) e cuida do aviso de dados de versões antigas.
// Nada é gravado no navegador por esta página, exceto os resultados que você escolhe salvar (botão "Salvar").

// ---------- Oráculos que ficaram no navegador numa versão antiga ----------
function legado() {
  try {
    const d = JSON.parse(localStorage.getItem('grimorio.oraculos.v1'));
    return d && Array.isArray(d.meus) && d.meus.length ? d : null;
  } catch { return null; }
}
const tabelaParaJson = t => {
  const n = Oraculos.normTabela(t), simples = n.faixas.every((f, i) => f.de === f.ate && f.de === i + 1);
  const o = { nome: n.nome };
  if (n.dado) o.dado = n.dado;
  if (simples) o.linhas = n.faixas.map(f => f.texto); else o.faixas = n.faixas;
  return o;
};
function avisoAntigo(el) {
  const d = legado(), alvo = el.querySelector('.aviso-antigo');
  if (!d || !alvo) return;
  alvo.innerHTML = `<div class="painel-arquivo" style="margin:16px 0;border-color:#ffcc00;">⚠ Há <b>${d.meus.length} oráculo(s)</b> que você criou/editou numa versão antiga, guardados só neste navegador.
    <button type="button" class="btn-fantasma ms-2" data-acao="baixar-antigos">Baixar em JSON</button>
    <div class="mt-1">Cada item do arquivo baixado é um gerador pronto para colar dentro de <code>"geradores": [ ... ]</code> do JSON do gênero.</div></div>`;
}
function baixarAntigos() {
  const d = legado(); if (!d) return;
  const out = {};
  d.meus.forEach(m => (out[m.genero] ||= []).push({ nome: m.nome, descricao: m.descricao || '', tabelas: (m.tabelas || []).map(tabelaParaJson) }));
  baixarTexto('oraculos-antigos.json', JSON.stringify(out, null, 2));
}

const RODAPE = `<div class="painel-arquivo">Os oráculos vêm dos arquivos em <b>data/oraculos/&lt;gênero&gt;/</b>. Para criar ou mudar um, edite o JSON (formato no README). Use <b>Salvar</b> depois de rolar para guardar o resultado na página <a href="salvos.html" style="color:#ff3333;">Salvos</a>, ou use os oráculos dentro de uma <a href="campanhas.html" style="color:#ff3333;">campanha</a> para salvar já ligado a ela.</div>`;

(async () => {
  try {
    await Dados.pronto;
    await Oraculos.montar(raiz, { usarHash: true, rodape: RODAPE, aposDesenhar: avisoAntigo, acoesExtras: { 'baixar-antigos': baixarAntigos } });
  } catch (e) {
    raiz.innerHTML = `<div class="alert alert-danger mt-5 rounded-0">Não consegui carregar os dados: ${esc(e.message)}.` +
      (location.protocol === 'file:' ? '<br>Abrindo o arquivo direto do computador o navegador bloqueia os JSONs. Rode um servidor local (veja o LEIAME.md).' : '') + '</div>';
  }
})();
