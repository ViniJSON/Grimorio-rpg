// Barra de navegação única (antes copiada em cada HTML) + botão de conta/sincronização.
(() => {
  const LINKS = [['oraculos', 'Oráculos'], ['bestiario', 'Bestiário'], ['itens', 'Itens'], ['npcs', 'NPCs'], ['salvos', 'Salvos'], ['fichas', 'Fichas'], ['campanhas', 'Campanhas'], ['regras', 'Regras']];
  const nuvem = typeof Dados !== 'undefined' && Dados.estado.nuvem;

  function montar() {
    const alvo = document.getElementById('nav'); if (!alvo) return;
    alvo.outerHTML = `<nav class="navbar navbar-expand-lg navbar-ca sticky-top"><div class="container">
      <a class="navbar-brand" href="index.html">GRIMÓRIO</a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#menu" style="background-color:#444;"><span class="navbar-toggler-icon" style="filter:invert(1);"></span></button>
      <div class="collapse navbar-collapse" id="menu"><ul class="navbar-nav ms-auto">
        ${LINKS.map(([p, t]) => `<li class="nav-item"><a class="nav-link" href="${p}.html">${t}</a></li>`).join('')}
        ${nuvem ? '<li class="nav-item"><a class="nav-link conta-link" href="#" id="conta-link">Entrar</a></li>' : ''}
      </ul></div></div></nav>`;
    if (!nuvem) return;
    document.getElementById('conta-link').addEventListener('click', e => { e.preventDefault(); abrirConta(); });
    Dados.ouvir('estado', rotular); rotular();
  }

  const ICONE = { local: '', ocioso: '☁ ✔', sincronizando: '☁ ⟳', erro: '☁ ⚠' };
  function rotular() {
    const l = document.getElementById('conta-link'); if (!l) return;
    const { usuario, sync } = Dados.estado;
    l.textContent = usuario ? `${ICONE[sync] || '☁'} ${usuario.email.split('@')[0]}` : 'Entrar';
    if (document.getElementById('conta-modal')) desenharConta();
  }

  function abrirConta() {
    if (document.getElementById('conta-modal')) return;
    const f = document.createElement('div');
    f.className = 'ficha-fundo'; f.id = 'conta-modal'; f.style.zIndex = 2200;
    f.innerHTML = '<div class="picker-box" role="dialog" aria-modal="true" style="width:min(400px,100%);"></div>';
    document.body.appendChild(f);
    f.addEventListener('click', e => { if (e.target === f || e.target.closest('[data-fechar]')) f.remove(); });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const email = f.querySelector('[name=email]').value.trim(), senha = f.querySelector('[name=senha]').value;
      const criar = e.submitter && e.submitter.dataset.criar === '1', msg = f.querySelector('.conta-msg');
      msg.textContent = 'Aguarde...';
      try {
        if (criar) { const r = await Dados.auth.criar(email, senha); if (r === 'confirmar') { msg.textContent = 'Conta criada! Confirme pelo e-mail que enviamos e depois clique em Entrar.'; return; } }
        else await Dados.auth.entrar(email, senha);
        f.remove(); aviso('Conectado. Sincronizando...');
      } catch (err) { msg.textContent = err.message; }
    });
    f.addEventListener('click', async e => {
      const b = e.target.closest('[data-acao]'); if (!b) return;
      if (b.dataset.acao === 'sair') { await Dados.auth.sair(); f.remove(); aviso('Você saiu. Seus dados continuam neste navegador.'); }
      if (b.dataset.acao === 'agora') Dados.sincronizar();
    });
    desenharConta();
  }

  function desenharConta() {
    const caixa = document.querySelector('#conta-modal .picker-box'); if (!caixa) return;
    const { usuario, sync, erro, ultimaSync } = Dados.estado;
    const quando = ultimaSync ? new Date(ultimaSync).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'ainda não';
    if (usuario) {
      caixa.innerHTML = `<h5 class="nome-agente">Conta</h5>
        <div class="info-texto mb-2">${esc(usuario.email)}</div>
        <div class="info-texto mb-2">${{ sincronizando: 'Sincronizando...', erro: '⚠ ' + esc(erro), ocioso: '✔ Tudo sincronizado (última: ' + quando + ')' }[sync] || ''}</div>
        <div class="d-flex flex-wrap gap-2"><button type="button" class="btn-rolar" data-acao="agora">Sincronizar agora</button>
        <button type="button" class="btn-fantasma" data-acao="sair">Sair</button><button type="button" class="btn-fantasma" data-fechar>Fechar</button></div>`;
    } else {
      const antes = caixa.querySelector('.conta-msg')?.textContent || (sync === 'erro' ? '⚠ ' + erro : '');
      caixa.innerHTML = `<form><h5 class="nome-agente">Entrar na nuvem</h5>
        <div class="info-texto mb-2">Suas fichas, campanhas e salvos ficam iguais em todos os aparelhos.</div>
        <label class="rotulo">E-mail<input class="campo" type="email" name="email" autocomplete="email" required></label>
        <label class="rotulo mt-2">Senha<input class="campo" type="password" name="senha" minlength="6" autocomplete="current-password" required></label>
        <div class="conta-msg info-texto mt-2" style="color:#ffcc00;">${esc(antes)}</div>
        <div class="d-flex flex-wrap gap-2 mt-3"><button class="btn-rolar" type="submit">Entrar</button>
        <button class="btn-fantasma" type="submit" data-criar="1">Criar conta</button><button type="button" class="btn-fantasma" data-fechar>Cancelar</button></div></form>`;
    }
  }

  document.addEventListener('DOMContentLoaded', montar);
})();
