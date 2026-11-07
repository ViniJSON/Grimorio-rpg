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
