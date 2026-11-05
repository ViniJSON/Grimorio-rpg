# Grimório

## Rodar no computador
O navegador bloqueia JSON quando a página é aberta com duplo clique. Dentro desta pasta, rode:

    python -m http.server 8000

e abra http://localhost:8000 (ou use a extensão Live Server do VS Code).
Hospedado (GitHub Pages, Netlify...) funciona normal.

## Estrutura
    data/manifest.json                       lista os gêneros de cada seção
    data/<secao>/<genero>/<genero>.json      conteúdo do gênero
    img/<secao>/<genero>/                    imagens

## Novo gênero
1. Crie data/bestiario/steampunk/steampunk.json
2. Adicione "steampunk" na lista de "bestiario" em data/manifest.json

## Card (bestiário, itens, NPCs)
{
  "nome": "Goblin", "imagem": "img/bestiario/fantasia/goblin.webp",
  "descricao": "...", "destaque": false,
  "rotulo_atributos": "PROPRIEDADES",      (opcional, padrão ATRIBUTOS)
  "atributos": { "Vida": 8, "Defesa": 10 },  (qualquer nome/quantidade)
  "habilidades": [ { "nome": "...", "descricao": "..." } ]
}
Sem imagem ou com caminho errado, aparece o placeholder.

## Oráculos
"geradores": [ { "nome", "descricao", "tabelas": [ { "nome": "Nome", "linhas": ["a","b"] } ] } ]
O dado (d6, d8...) é contado pelo número de linhas.

## Campos extras (todos opcionais; texto ou lista ["a","b"])
Bestiário: "ameaca", "fraquezas", "resistencias", "recompensas", "personalidade"
NPCs:      "ocupacao", "personalidade", "objetivos", "relacoes"
Itens:     "raridade", "valor", "peso", "efeitos", "categoria" (se omitida, usa o nome da categoria do JSON)
Campo ausente ou vazio simplesmente não aparece no card.

## Fichas de personagem (fichas.html)
Ficam salvas no localStorage do navegador (por navegador/dispositivo, e por endereço do site).

Arquivo JSON vinculado (Chrome/Edge no computador): na lista de personagens, "Abrir arquivo existente"
ou "Criar novo arquivo". Daí em diante toda edição é gravada automaticamente nesse .json.
O navegador pede permissão de novo a cada sessão: clique em "Reconectar". Pode guardar o arquivo
onde quiser (ex.: dentro de data/personagens/) e versionar no Git.
Se o arquivo mudar fora do site, ao abrir a página vale a versão mais recente de cada personagem.

Ponto de partida: data/personagens/personagens.json é carregado na primeira visita de um navegador
(se você publicar o site com suas fichas nesse arquivo, elas já aparecem para quem abrir).

Firefox/Safari/celular não gravam direto em arquivo: use "Exportar backup" / "Importar backup".
Itens entram no inventário pela própria ficha (catálogo = página Itens) ou pelo botão
"Adicionar à ficha" nos cards da página Itens.

Imagem do personagem: na edição da ficha, "Escolher imagem". Ela é reduzida (640px) e guardada dentro da própria ficha (e do .json vinculado).

Habilidades do personagem: na edição da ficha, "＋ Habilidade" (nome + descrição), igual aos cards do bestiário.
