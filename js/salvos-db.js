// Guarda no navegador (IndexedDB) os resultados que você rolou e decidiu salvar (NPCs, anomalias, salas...).
// IndexedDB aguenta imagens sem o limite pequeno do localStorage. Usado por oraculos.js e salvos.js.
// Cada registro: { id, genero, gerador, nome, linhas: [{ rotulo, texto }], notas, imagem (dataURL), criado, atualizado }
const Salvos = (() => {
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  let conexao;
  const abrir = () => conexao ||= new Promise((ok, err) => {
    if (!window.indexedDB) return err(new Error('este navegador não permite salvar dados aqui'));
    const r = indexedDB.open('grimorio-salvos', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('itens', { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => err(r.error || new Error('falha ao abrir o armazenamento'));
  });
  const tx = async (modo, fn) => {
    const db = await abrir();
    return new Promise((ok, err) => {
      const t = db.transaction('itens', modo), req = fn(t.objectStore('itens'));
      t.oncomplete = () => ok(req && req.result);
      t.onerror = t.onabort = () => err(t.error || new Error('falha ao gravar'));
    });
  };

  // Pede ao navegador para não apagar estes dados quando faltar espaço
  const proteger = () => { try { navigator.storage?.persist?.(); } catch { /* ignora */ } };

  const listar = async () => (await tx('readonly', s => s.getAll())).sort((a, b) => b.criado - a.criado);
  const salvar = async r => { r.atualizado = Date.now(); if (!r.criado) r.criado = r.atualizado; await tx('readwrite', s => s.put(r)); proteger(); return r; };
  const excluir = id => tx('readwrite', s => s.delete(id));
  const novo = ({ genero, gerador, nome, linhas }) => ({ id: uid(), genero, gerador, nome, linhas, notas: '', imagem: '', criado: Date.now() });

  const exportar = async () => JSON.stringify({ grimorio: 1, salvos: await listar() }, null, 2);

  // Importa um backup: com o mesmo id vence o que foi alterado por último; os outros são adicionados
  async function importar(texto) {
    const d = JSON.parse(texto), novos = Array.isArray(d) ? d : d.salvos;
    if (!Array.isArray(novos)) throw new Error('arquivo não parece um backup de salvos do Grimório');
    const atuais = new Map((await listar()).map(r => [r.id, r]));
    let n = 0;
    for (const r of novos) {
      if (!r || !r.id) continue;
      const a = atuais.get(r.id);
      if (!a || (r.atualizado || 0) >= (a.atualizado || 0)) { await tx('readwrite', s => s.put(r)); n++; }
    }
    proteger();
    return n;
  }

  // Reduz a imagem (lado maior 640px, JPEG) para o backup não ficar gigante
  const reduzir = (file, max = 640) => new Promise((ok, err) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); err(new Error('não consegui ler essa imagem')); };
    img.src = url;
  });

  return { listar, salvar, excluir, novo, exportar, importar, reduzir, proteger };
})();
