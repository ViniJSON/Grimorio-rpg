# Grimorio-rpg
## Oráculos (editar pelo JSON)
Os geradores ficam em data/oraculos/<genero>/<genero>.json. Para criar ou mudar um, edite o arquivo (igual ao bestiário).
Cada tabela aceita um destes formatos:

    { "nome": "Sala", "linhas": ["a", "b"] }                                   dado = nº de linhas
    { "nome": "Sala", "dado": 20, "linhas": [ ...20 itens... ] }
    { "nome": "Monstro", "dado": 100, "faixas": [ {"de":1,"ate":20,"texto":"Rato"} ] }

"Rolar tudo" mostra cada resposta em uma linha.

## Salvos
Depois de "Rolar tudo", o botão "Salvar este resultado" guarda o resultado na página Salvos (salvos.html):
dá para renomear, anotar, adicionar/trocar imagem e excluir. Ficam no navegador (IndexedDB), então use
"Exportar backup" (inclui as imagens) de vez em quando e "Importar backup" para restaurar.
