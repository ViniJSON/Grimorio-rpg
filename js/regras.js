// Motor de regras do sistema (ver regras.html). Funções puras: sem DOM, sem armazenamento.
// Funciona no navegador e no Node (para testes: node tests/regras.test.js).
const Regras = (() => {
  const n = v => { const x = parseInt(v, 10); return Number.isFinite(x) ? x : 0; };
  const ATRIBUTOS = [['forca', 'FOR', 'Força'], ['agilidade', 'AGI', 'Agilidade'], ['inteligencia', 'INT', 'Inteligência'], ['carisma', 'CAR', 'Carisma']];
  const PONTOS_INICIAIS = 7, MAX_INICIAL = 4, NIVEL_MAX = 10;
  const CUSTO_ENERGIA = { 4: 2, 6: 4, 8: 8, 10: 9, 12: 10 };   // dado da habilidade -> custo de Energia
  const DESCANSO = { curto: 4, longo: 8 };                      // dado de recuperação (Vida e Energia)

  // ---------- Estatísticas derivadas ----------
  const base = p => ({ vida: 10 + n(p.forca) * 2, defesa: 10 + n(p.agilidade), energia: 10 + n(p.inteligencia) });
  const derivados = p => {
    const b = base(p), a = p.ajustes || {};
    return { vida: b.vida + n(a.vida), defesa: b.defesa + n(a.defesa), energia: b.energia + n(a.energia) };
  };

  // Fichas antigas tinham Vida/Energia máximas e Defesa digitadas. Guardamos a diferença em "ajustes"
  // para que nada mude de valor ao adotar as fórmulas.
  function migrar(p) {
    ATRIBUTOS.forEach(([k]) => p[k] = n(p[k]));
    p.vida = { atual: n(p.vida?.atual), max: n(p.vida?.max) };
    p.energia = { atual: n(p.energia?.atual), max: n(p.energia?.max) };
    if (!p.ajustes) {
      const b = base(p);
      p.ajustes = { vida: p.vida.max - b.vida, energia: p.energia.max - b.energia, defesa: (p.defesa ?? b.defesa) - b.defesa };
    }
    return aplicar(p);
  }

  // Recalcula máximos e Defesa a partir dos atributos e mantém os valores atuais dentro do limite
  function aplicar(p) {
    const d = derivados(p);
    p.vida = { atual: Math.max(0, Math.min(n(p.vida?.atual), d.vida)), max: d.vida };
    p.energia = { atual: Math.max(0, Math.min(n(p.energia?.atual), d.energia)), max: d.energia };
    p.defesa = d.defesa;
    p.nivel = Math.min(NIVEL_MAX, Math.max(1, n(p.nivel) || 1));
    return p;
  }

  // Distribuição inicial: 7 pontos, no máximo 4 por atributo (só vale no nível 1). Devolve avisos, não bloqueia.
  function validarCriacao(p) {
    const gastos = ATRIBUTOS.reduce((t, [k]) => t + n(p[k]), 0), avisos = [];
    if (n(p.nivel) <= 1) {
      if (gastos > PONTOS_INICIAIS) avisos.push(`Pontos demais: ${gastos} de ${PONTOS_INICIAIS}.`);
      if (gastos < PONTOS_INICIAIS) avisos.push(`Ainda restam ${PONTOS_INICIAIS - gastos} ponto(s) para distribuir.`);
      ATRIBUTOS.forEach(([k, , nome]) => { if (n(p[k]) > MAX_INICIAL) avisos.push(`${nome} passa de ${MAX_INICIAL} no início.`); if (n(p[k]) < 0) avisos.push(`${nome} está negativo.`); });
    }
    return { gastos, restantes: PONTOS_INICIAIS - gastos, avisos };
  }

  // ---------- Dados ----------
  const rolarDado = (lados, rng = Math.random) => 1 + Math.floor(rng() * lados);
  const SIGLAS = { FOR: 'forca', AGI: 'agilidade', INT: 'inteligencia', CAR: 'carisma', DEF: 'defesa' };

  // Expressões como "1d6+FOR", "2d12+1d6", "1d4+2", "1d20+AGI-1"
  function rolar(expr, p = {}, rng = Math.random) {
    const texto = String(expr ?? '').replace(/\s+/g, '').toUpperCase();
    if (!texto) throw new Error('Digite o que rolar, por exemplo 1d6+FOR');
    const termos = texto.match(/[+-]?[^+-]+/g);
    if (!termos || termos.join('') !== texto) throw new Error('Expressão inválida: ' + expr);
    let total = 0; const partes = [];
    for (const t of termos) {
      const sinal = t[0] === '-' ? -1 : 1, corpo = t.replace(/^[+-]/, ''); let m;
      if ((m = corpo.match(/^(\d*)D(\d+)$/))) {
        const qtd = m[1] === '' ? 1 : parseInt(m[1], 10), lados = parseInt(m[2], 10);
        if (qtd < 1 || qtd > 100 || lados < 2 || lados > 1000) throw new Error('Dado inválido: ' + corpo.toLowerCase());
        const rs = Array.from({ length: qtd }, () => rolarDado(lados, rng)), soma = rs.reduce((a, b) => a + b, 0);
        total += sinal * soma; partes.push({ tipo: 'dado', rotulo: `${qtd}d${lados}`, valor: sinal * soma, rolagens: rs });
      } else if (/^\d+$/.test(corpo)) {
        total += sinal * parseInt(corpo, 10); partes.push({ tipo: 'num', rotulo: corpo, valor: sinal * parseInt(corpo, 10) });
      } else if (SIGLAS[corpo]) {
        const v = n(p[SIGLAS[corpo]]); total += sinal * v; partes.push({ tipo: 'attr', rotulo: corpo, valor: sinal * v });
      } else throw new Error('Não entendi "' + corpo.toLowerCase() + '". Use dados (1d6), números e FOR/AGI/INT/CAR.');
    }
    const detalhe = partes.map((x, i) => (i && x.valor >= 0 ? '+' : '') + (x.tipo === 'dado' ? `${x.rotulo}[${x.rolagens.join(',')}]` : `${x.rotulo}(${x.valor})`)).join(' ');
    return { total, partes, texto: detalhe };
  }

  // ---------- Testes ----------
  // 1d20 + atributo >= dificuldade. 20 natural = sucesso crítico; 1 natural = falha crítica (automáticos).
  function teste(p, chave, dificuldade = null, rng = Math.random) {
    const dado = rolarDado(20, rng), bonus = n(p[chave]), total = dado + bonus;
    const dif = dificuldade === null || dificuldade === '' || !Number.isFinite(Number(dificuldade)) ? null : Number(dificuldade);
    let resultado = null;
    if (dado === 20) resultado = 'critico'; else if (dado === 1) resultado = 'falha-critica';
    else if (dif !== null) resultado = total >= dif ? 'sucesso' : 'falha';
    return { dado, bonus, total, dificuldade: dif, resultado };
  }
  const iniciativa = (p, rng) => teste(p, 'agilidade', null, rng);

  // ---------- Habilidades e Energia ----------
  const ladosDe = d => { const m = String(d ?? '').trim().match(/^1?d(\d+)$/i); const l = m ? parseInt(m[1], 10) : NaN; return CUSTO_ENERGIA[l] ? l : null; };
  const custoEnergia = d => { const l = ladosDe(d); return l ? CUSTO_ENERGIA[l] : 0; };

  // Usa a habilidade: gasta Energia (exceto em crítico natural) e rola o dado dela. Altera p.energia.atual.
  function usarHabilidade(p, hab, { critico = false } = {}, rng = Math.random) {
    const lados = ladosDe(hab.dado);
    if (!lados) return { ok: false, motivo: 'Essa habilidade não tem dado definido (edite a ficha).' };
    const custo = critico ? 0 : CUSTO_ENERGIA[lados];
    if (n(p.energia?.atual) < custo) return { ok: false, motivo: `Energia insuficiente: custa ${custo}, você tem ${n(p.energia?.atual)}.` };
    const extra = String(hab.extra ?? '').trim();
    let r;
    try { r = rolar(`1d${lados}${extra && !/^[+-]/.test(extra) ? '+' : ''}${extra}`, p, rng); } catch (e) { return { ok: false, motivo: e.message }; }
    p.energia.atual = n(p.energia.atual) - custo;
    return { ok: true, custo, critico, rolagem: r, total: critico ? r.total * 2 : r.total };
  }

  // ---------- Descanso ----------
  // Curto: 1d4 de Vida e 1d4 de Energia. Longo: 1d8 e 1d8. Nunca passa do máximo. Altera p.
  function descansar(p, tipo, rng = Math.random) {
    const lados = DESCANSO[tipo]; if (!lados) throw new Error('Tipo de descanso desconhecido');
    const rv = rolarDado(lados, rng), re = rolarDado(lados, rng);
    const v0 = n(p.vida.atual), e0 = n(p.energia.atual);
    p.vida.atual = Math.min(p.vida.max, v0 + rv); p.energia.atual = Math.min(p.energia.max, e0 + re);
    return { lados, rolagemVida: rv, rolagemEnergia: re, ganhoVida: p.vida.atual - v0, ganhoEnergia: p.energia.atual - e0 };
  }

  return { ATRIBUTOS, PONTOS_INICIAIS, MAX_INICIAL, NIVEL_MAX, CUSTO_ENERGIA, base, derivados, migrar, aplicar, validarCriacao, rolarDado, rolar, teste, iniciativa, ladosDe, custoEnergia, usarHabilidade, descansar };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Regras;
