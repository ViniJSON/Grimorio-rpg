// Rolagem das tabelas: cada <div class="tabela-oraculo"> tem um <table> com <tr> = um resultado.
// Rola 1 dado com o número de linhas (d6, d8, d20...). Nada para configurar.
function sorteia(tab){
  const linhas=[...tab.querySelectorAll('tr')];
  linhas.forEach(l=>l.classList.remove('sorteado'));
  const l=linhas[Math.floor(Math.random()*linhas.length)];
  l.classList.add('sorteado');
  return l.cells[l.cells.length-1].textContent;
}
document.querySelectorAll('.tabela-oraculo').forEach(t=>{
  const n=t.querySelectorAll('tr').length;
  const h=t.querySelector('h6'); h.textContent+=' (d'+n+')';
  const b=document.createElement('button'); b.className='btn-rolar ms-2'; b.textContent='Rolar';
  b.onclick=()=>sorteia(t); h.appendChild(b);
});
// Botão "Rolar tudo": rola todas as tabelas do gerador e junta o resultado
document.querySelectorAll('.gerador').forEach(g=>{
  const btn=g.querySelector('.rolar-tudo'); if(!btn) return;
  const out=g.querySelector('.resultado-geral');
  btn.onclick=()=>{
    out.textContent=[...g.querySelectorAll('.tabela-oraculo')].map(t=>t.querySelector('h6').firstChild.textContent.trim()+': '+sorteia(t)).join(' · ');
  };
});
