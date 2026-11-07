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
Ficam salvas no navegador (IndexedDB, por dispositivo e por endereço do site) e, se você entrar numa conta (ver "Nuvem" abaixo), sincronizadas entre aparelhos.

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


## Código compartilhado (js/)
- `util.js`: `esc`, `num`, `uid`, `aviso`, `reduzir` (imagem), `lerJson`, `baixarTexto`... (antes copiados em cada arquivo).
- `nav.js`: barra de navegação única (as páginas só têm `<div id="nav"></div>`) e o botão de conta.
- `regras.js`: regras do sistema (derivados, testes, dados, Energia, descanso). Sem DOM; testável no Node.
- `dados.js`: camada de dados única (memória + IndexedDB + sincronização). `personagens.js`, `campanhas-db.js` e `salvos-db.js` são fachadas finas sobre ela.
- `arquivo-json.js`: arquivo .json vinculado às fichas (Chrome/Edge no computador), opcional.

## Regras na ficha
Vida máx. = 10 + FOR×2, Defesa = 10 + AGI, Energia máx. = 10 + INT, mais os **ajustes** (campo na edição) para bônus de itens/nível, que ainda
não têm regra fechada. Fichas antigas são migradas sem mudar nenhum valor (a diferença vira ajuste). Na ficha: teste por atributo (d20 + atributo,
20 natural = sucesso crítico, 1 natural = falha crítica), iniciativa, expressões como `1d6+FOR`, habilidades com dado e custo de Energia
(d4=2, d6=4, d8=8, d10=9, d12=10; "Usar (20 natural)" não gasta Energia e dobra o dano) e descanso curto (1d4) / longo (1d8).

## Raças e classes
Páginas `racas.html` e `classes.html`, iguais às outras: o conteúdo fica em `data/racas/<gênero>/<gênero>.json` e `data/classes/<gênero>/<gênero>.json`
(e o gênero precisa estar listado em `data/manifest.json`, chaves `racas` e `classes`). Para adicionar uma, é só copiar um card e editar. Campos:
- **Classe:** `nome`, `descricao`, `especialidade`, `limitacoes`, `atributos` (`"Atributo principal"` e **`"Dado de vida"`**, por exemplo `"1d12"`) e `habilidades`
  (um item por nível, com `nome` começando em `"Nível N — ..."`: a ficha usa isso para listar os poderes até o nível do personagem).
- **Raça:** `nome`, `descricao`, `traco` (nome do traço principal), `vantagens` e `desvantagens` (listas de texto).
- **Imagem:** `imagem` com o caminho (ex.: `img/classes/fantasia/barbaro.webp`); vazio usa a imagem padrão.

Na criação do personagem, os campos Raça e Classe listam esses cards (agrupados por gênero), com a opção "Outra (digitar)" para algo fora da lista.
Os efeitos de raça e classe **não** são aplicados automaticamente na ficha: ficam como referência (e o dado de vida da classe é usado ao subir de nível).

## Progressão e carga
- **XP e níveis (1–10):** na ficha, "Dar XP" soma experiência e, quando ela alcança o próximo nível (1.200, 2.400, 3.800, 4.900, 7.500, 9.000, 12.000, 17.000, 20.400),
  aparece o botão "Subir de nível". Ele rola os ganhos: **Vida** com o dado de vida da classe (no lugar do dado-base do nível), **Energia** (1d4 ou 1d8 conforme o nível)
  e +2 pontos de atributo nos níveis 3, 6 e 9. Os ganhos entram nos máximos e ficam no histórico da ficha. A tabela está em `js/regras.js` (`PROGRESSAO`) e em `regras.html`.
- **Pontos de atributo:** orçamento = 7 + os pontos ganhos por nível. A ficha avisa (sem bloquear) quando sobra ou falta.
- **Carga:** 15 kg para todos (mais o "Ajuste de carga" na edição). Soma peso × quantidade dos itens e entende `kg` e `g` (`500 g` = 0,5 kg). Itens sem peso não entram na soma e a ficha avisa.
  O que acontece ao passar do limite ainda não está nas regras: a ficha só mostra o aviso.

## Nuvem (Supabase, opcional)
Sem configurar nada, o site funciona só no navegador. Para sincronizar entre aparelhos:
1. Crie um projeto grátis em supabase.com.
2. SQL Editor: cole e rode `supabase/setup.sql` (tabelas, segurança por usuário e bucket `imagens`).
3. Authentication > Providers > Email: para o uso de hobby, desligue **Confirm email** (assim o cadastro não depende de e-mail).
4. Project Settings > API: copie a **Project URL** e a chave **anon public** para `js/supabase-config.js`.
   Nunca coloque a chave `service_role` no código.
5. Abra o site, clique em **Entrar** na barra, crie a conta. As fichas, campanhas e salvos que já estão neste navegador sobem sozinhos.
Dados vão para as tabelas `personagens`, `campanhas` e `salvos` (um registro JSON por linha); imagens novas vão para o Storage.
Conflito: vence a edição mais recente. No plano grátis o projeto pausa após uma semana sem uso (os dados ficam guardados; reative pelo painel) e
não há backup automático, então continue usando **Exportar backup** de vez em quando (imagens já enviadas ficam como link no backup).

## Testes
`node tests/regras.test.js` e `node tests/dados.test.js` (precisa do Node; não há dependências).
