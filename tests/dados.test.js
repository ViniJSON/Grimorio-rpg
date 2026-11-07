// Testa a camada de dados com um Supabase falso (dois "aparelhos" compartilhando o mesmo servidor).
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const codigo = fs.readFileSync(__dirname + '/../js/dados.js', 'utf8');

function servidorFalso() {
  const tabelas = {}, arquivos = new Map();
  const tab = c => tabelas[c] ||= new Map();
  const consulta = (c, cols) => {
    let filtro = null;
    const q = { in(_k, ids) { filtro = ids; return q; },
      then(ok) { const rows = [...tab(c).values()].filter(r => !filtro || filtro.includes(r.id)).map(r => Object.fromEntries(cols.split(',').map(k => [k, r[k]]))); ok({ data: rows, error: null }); } };
    return q;
  };
  return { tabelas, arquivos, cliente: {
    from: c => ({ select: cols => consulta(c, cols),
      upsert: rows => ({ then(ok) { rows.forEach(r => tab(c).set(r.id, JSON.parse(JSON.stringify(r)))); ok({ error: null }); } }) }),
    storage: { from: () => ({
      async upload(p, blob) { arquivos.set(p, blob); return { error: null }; },
      getPublicUrl: p => ({ data: { publicUrl: 'https://x.supabase.co/storage/v1/object/public/imagens/' + p } }),
      async remove(ps) { ps.forEach(p => arquivos.delete(p)); return { error: null }; } }) } } };
}

function aparelho(srv, usuario = { id: 'u1', email: 'a@b.c' }) {
  const store = {};
  const ctx = vm.createContext({ window: { GRIMORIO_CONFIG: {} }, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => store[k] = String(v) },
    structuredClone, fetch, console, setTimeout, clearTimeout, Date, JSON, Promise, Map, Set, aviso: m => console.log('aviso:', m) });
  vm.runInContext(codigo, ctx);
  const D = vm.runInContext('Dados', ctx);
  D.__testarNuvem(srv.cliente, usuario);
  return D;
}
const PIXEL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

(async () => {
  const srv = servidorFalso();
  const A = aparelho(srv), B = aparelho(srv);
  await A.pronto; await B.pronto;

  // 1) salva no A com imagem -> sobe para o servidor e vira URL
  A.salvar('personagens', { id: 'p1', nome: 'Kael', imagem: PIXEL, nivel: 1 });
  await A.sincronizar();
  assert.strictEqual(A.estado.sync, 'ocioso', A.estado.erro);
  const remoto = srv.tabelas.personagens.get('p1');
  assert.ok(remoto, 'subiu'); assert.ok(remoto.dados.imagem.startsWith('https://'), 'imagem virou URL');
  assert.strictEqual(srv.arquivos.size, 1);
  assert.ok(A.obter('personagens', 'p1').imagem.startsWith('https://'), 'local também guarda a URL');

  // 2) B baixa
  await B.sincronizar();
  assert.strictEqual(B.obter('personagens', 'p1').nome, 'Kael');

  // 3) B edita (mais novo) -> A recebe
  await new Promise(r => setTimeout(r, 5));
  const pb = B.obter('personagens', 'p1'); pb.nome = 'Kael, o Velho'; B.salvar('personagens', pb);
  await B.sincronizar(); await A.sincronizar();
  assert.strictEqual(A.obter('personagens', 'p1').nome, 'Kael, o Velho');

  // 4) versão local mais ANTIGA nunca sobrescreve a do servidor
  A.importar('personagens', JSON.stringify([{ id: 'p1', nome: 'VELHO', atualizado: 1 }]));
  assert.strictEqual(A.obter('personagens', 'p1').nome, 'Kael, o Velho');

  // 5) exclusão propaga (lápide) e apaga a imagem
  A.excluir('personagens', 'p1');
  await A.sincronizar(); assert.strictEqual(srv.tabelas.personagens.get('p1').excluido, true);
  assert.strictEqual(srv.arquivos.size, 0, 'imagem apagada do storage');
  await B.sincronizar(); assert.strictEqual(B.obter('personagens', 'p1'), undefined);
  assert.strictEqual(B.listar('personagens').length, 0);

  // 6) remover a imagem apaga o arquivo antigo
  A.salvar('campanhas', { id: 'c1', nome: 'X', imagem: PIXEL, sessoes: [] }); await A.sincronizar();
  assert.strictEqual(srv.arquivos.size, 1);
  const c = A.obter('campanhas', 'c1'); c.imagem = ''; A.salvar('campanhas', c); await A.sincronizar();
  assert.strictEqual(srv.arquivos.size, 0); assert.strictEqual(srv.tabelas.campanhas.get('c1').dados.imagemCaminho, undefined);

  // 7) listar/obter devolvem cópias
  A.salvar('salvos', { id: 's1', nome: 'Orc', linhas: [] });
  const cp = A.obter('salvos', 's1'); cp.nome = 'MUDEI'; assert.strictEqual(A.obter('salvos', 's1').nome, 'Orc');

  // 8) exportar / importar
  const json = A.exportar('salvos'); assert.ok(JSON.parse(json).salvos.length === 1);
  const C = aparelho(servidorFalso()); await C.pronto;
  assert.strictEqual(C.importar('salvos', json), 1); assert.strictEqual(C.listar('salvos')[0].nome, 'Orc');
  assert.throws(() => C.importar('salvos', '{"x":1}'));
  console.log('dados: tudo certo');
})().catch(e => { console.error('FALHOU:', e); process.exit(1); });
