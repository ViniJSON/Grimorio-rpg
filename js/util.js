// Utilidades compartilhadas por todas as páginas (antes estavam copiadas em cada arquivo).
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (v, pad = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : pad; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const pad2 = n => String(n).padStart(2, '0');
const PLACEHOLDER = 'img/placeholder.webp';
const raiz = document.getElementById('conteudo');

function aviso(msg, ms = 2400) {
  let t = document.querySelector('.toast-ca');
  if (!t) { t = document.createElement('div'); t.className = 'toast-ca'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('on');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), ms);
}

async function lerJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' (' + r.status + ')');
  return r.json();
}

// Reduz a imagem (lado maior = max px, JPEG) para ficar leve no navegador e na nuvem
function reduzir(file, max = 640) {
  return new Promise((ok, err) => {
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
}

function baixarTexto(nome, texto, tipo = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([texto], { type: tipo }));
  a.download = nome; a.click(); URL.revokeObjectURL(a.href);
}

const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const dataBR = s => s ? s.split('-').reverse().join('/') : '';
