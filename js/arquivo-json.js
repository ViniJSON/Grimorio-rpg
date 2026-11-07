// Arquivo .json vinculado às fichas (File System Access API: Chrome/Edge no computador). Opcional, convive com a nuvem.
// Depois de vinculado, cada alteração nas fichas é gravada direto no arquivo.
const ArquivoJson = (() => {
  const suportado = 'showOpenFilePicker' in window;
  let handle = null, fila = Promise.resolve(), timer = null;
  const api = { suportado, estado: 'nenhum', nome: '', erro: '', aoEstado: null };
  const muda = (estado, erro = '') => { api.estado = estado; api.erro = erro; api.nome = handle ? handle.name : ''; api.aoEstado?.(); };

  const banco = () => new Promise((ok, err) => {
    const r = indexedDB.open('grimorio', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('h');
    r.onsuccess = () => ok(r.result); r.onerror = () => err(r.error);
  });
  const guardar = async h => { const d = await banco(); d.transaction('h', 'readwrite').objectStore('h').put(h, 'arquivo'); };
  const esquecer = async () => { const d = await banco(); d.transaction('h', 'readwrite').objectStore('h').delete('arquivo'); };
  const lembrado = async () => { const d = await banco(); return new Promise(ok => { const q = d.transaction('h').objectStore('h').get('arquivo'); q.onsuccess = () => ok(q.result); q.onerror = () => ok(null); }); };

  // Lê o arquivo (mesclando com o que há no navegador) e grava a lista completa de volta
  async function sincronizar() {
    const texto = await (await handle.getFile()).text();
    if (texto.trim()) Personagens.importar(texto);
    await escrever();
  }
  async function escrever() {
    const w = await handle.createWritable();
    await w.write(Personagens.exportar()); await w.close();
  }
  async function usar(h) {
    handle = h;
    try { await sincronizar(); await guardar(h); muda('pronto'); }
    catch (e) { muda('erro', e.message); }
  }

  api.iniciar = async () => {
    if (!suportado) return;
    try {
      handle = await lembrado();
      if (!handle) return;
      muda((await handle.queryPermission({ mode: 'readwrite' })) === 'granted' ? 'pronto' : 'permissao');
      if (api.estado === 'pronto') await sincronizar();
    } catch (e) { muda('erro', e.message); }
  };
  const tipos = [{ description: 'Fichas do Grimório (JSON)', accept: { 'application/json': ['.json'] } }];
  api.abrir = async () => { try { const [h] = await showOpenFilePicker({ types: tipos }); await usar(h); } catch (e) { if (e.name !== 'AbortError') muda('erro', e.message); } };
  api.criar = async () => { try { await usar(await showSaveFilePicker({ suggestedName: 'personagens.json', types: tipos })); } catch (e) { if (e.name !== 'AbortError') muda('erro', e.message); } };
  api.reconectar = async () => {
    try {
      if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') return;
      await sincronizar(); muda('pronto');
    } catch (e) { muda('erro', e.message); }
  };
  api.desvincular = async () => { handle = null; await esquecer(); muda('nenhum'); };
  api.usar = usar; // (para testes)

  // Grava depois de cada alteração (agrupa várias em uma só)
  Personagens.aoMudar = () => {
    if (!handle || api.estado !== 'pronto') return;
    clearTimeout(timer);
    timer = setTimeout(() => { fila = fila.then(escrever).then(() => muda('pronto'), e => muda('erro', e.message)); }, 250);
  };
  return api;
})();
