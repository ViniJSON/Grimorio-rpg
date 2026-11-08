// Motor de regras do sistema (ver regras.html). Funções puras: sem DOM, sem armazenamento.
// Funciona no navegador e no Node (para testes: node tests/regras.test.js).
const Regras = (() => {
  const n = v => { const x = parseInt(v, 10); return Number.isFinite(x) ? x : 0; };
  const ATRIBUTOS = [['forca', 'FOR', 'Força'], ['agilidade', 'AGI', 'Agilidade'], ['inteligencia', 'INT', 'Inteligência'], ['carisma', 'CAR', 'Carisma']];
  const PONTOS_INICIAIS = 7, MAX_INICIAL = 4, NIVEL_MAX = 10;
  const CUSTO_ENERGIA = { 4: 2, 6: 4, 8: 8, 10: 9, 12: 10 };   // dado da habilidade -> custo de Energia
  const DESCANSO = { curto: 4, longo: 8 };                      // dado de recuperação (Vida e Energia)
  const CARGA_BASE = 15;                                        // kg que qualquer personagem carrega no início

  // Progressão base. "vida" é o dado-base daquele nível: a classe do personagem o SUBSTITUI pelo próprio dado de vida
  // (ver "Dado de vida" no card da classe). "energia" é fixa. "pontos" = pontos de atributo a distribuir.
  const PROGRESSAO = {
    1: { xp: 0 },
    2: { xp: 1200, vida: '1d4', energia: '1d4' },
    3: { xp: 2400, vida: '1d4', pontos: 2 },
    4: { xp: 3800, vida: '1d6', energia: '1d4' },
    5: { xp: 4900 },
    6: { xp: 7500, vida: '1d6', pontos: 2 },
    7: { xp: 9000, vida: '1d8' },
    8: { xp: 12000, energia: '1d4' },
    9: { xp: 17000, pontos: 2 },
    10: { xp: 20400, vida: '1d8', energia: '1d8' }
  };

  // ---------- Estatísticas derivadas ----------
  const base = p => ({ vida: 10 + n(p.forca) * 2, defesa: 10 + n(p.agilidade), energia: 10 + n(p.inteligencia) });
  const derivados = p => {
    const b = base(p), a = p.ajustes || {}, g = p.progressao || {};
    return { vida: b.vida + n(g.vida) + n(a.vida), defesa: b.defesa + n(a.defesa), energia: b.energia + n(g.energia) + n(a.energia) };
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
    p.ajustes.carga = n(p.ajustes.carga);
    p.dinheiro = Math.max(0, n(p.dinheiro));
    p.nivel = Math.min(NIVEL_MAX, Math.max(1, n(p.nivel) || 1));
    if (!p.progressao) {   // ficha de antes da progressão: o que já estava digitado vira ponto de partida
      const gastos = ATRIBUTOS.reduce((s, [k]) => s + p[k], 0);
      p.progressao = { vida: 0, energia: 0, pontos: p.nivel > 1 ? Math.max(0, gastos - PONTOS_INICIAIS) : 0, historico: [] };
    }
    p.xp = Math.max(n(p.xp), PROGRESSAO[p.nivel].xp);
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

  // Pontos de atributo: 7 no início + 2 em cada marco de nível (3, 6 e 9). Máximo de 4 por atributo só no nível 1.
  // Devolve avisos; não bloqueia (o mestre manda).
  function validarCriacao(p) {
    const gastos = ATRIBUTOS.reduce((t, [k]) => t + n(p[k]), 0), orcamento = PONTOS_INICIAIS + n(p.progressao?.pontos), avisos = [];
    if (gastos > orcamento) avisos.push(`Pontos demais: ${gastos} de ${orcamento}.`);
    if (gastos < orcamento) avisos.push(`Ainda restam ${orcamento - gastos} ponto(s) para distribuir.`);
    ATRIBUTOS.forEach(([k, , nome]) => {
      if (n(p.nivel) <= 1 && n(p[k]) > MAX_INICIAL) avisos.push(`${nome} passa de ${MAX_INICIAL} no início.`);
      if (n(p[k]) < 0) avisos.push(`${nome} está negativo.`);
    });
    return { gastos, orcamento, restantes: orcamento - gastos, avisos };
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
    const detalhe = partes.map((x, i) => (i && x.valor >= 0 ? '+' : '') + (x.tipo === 'dado' ? `${x.rotulo}[${x.rolagens.join(',')}]` : x.tipo === 'num' ? `${x.valor}` : `${x.rotulo}(${x.valor})`)).join(' ');
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

  // ---------- Experiência e níveis ----------
  const xpDoNivel = nv => PROGRESSAO[nv]?.xp ?? null;
  const xpProximo = p => xpDoNivel(n(p.nivel) + 1);
  const podeSubir = p => n(p.nivel) < NIVEL_MAX && n(p.xp) >= xpProximo(p);
  const dadoValido = d => { const m = String(d ?? '').trim().match(/^(\d+)d(\d+)$/i); return m && +m[1] >= 1 && +m[2] >= 2 ? `${+m[1]}d${+m[2]}` : null; };

  // Sobe UM nível: rola Vida (dado da classe no lugar do dado-base) e Energia, soma os pontos de atributo e registra o histórico.
  // Os ganhos entram nos máximos e também na Vida/Energia atuais. Altera p.
  function subirNivel(p, dadoClasse, rng = Math.random) {
    if (!podeSubir(p)) return { ok: false, motivo: n(p.nivel) >= NIVEL_MAX ? 'Já está no nível máximo.' : `Faltam ${xpProximo(p) - n(p.xp)} XP para o nível ${n(p.nivel) + 1}.` };
    const nv = n(p.nivel) + 1, g = PROGRESSAO[nv], r = { ok: true, nivel: nv, pontos: g.pontos || 0 };
    if (g.vida) { const dado = dadoValido(dadoClasse) || g.vida; r.vida = { dado, usouClasse: dado !== g.vida || !!dadoValido(dadoClasse), valor: rolar(dado, p, rng).total }; }
    if (g.energia) r.energia = { dado: g.energia, valor: rolar(g.energia, p, rng).total };
    p.progressao ||= { vida: 0, energia: 0, pontos: 0, historico: [] };
    p.progressao.vida += r.vida?.valor || 0; p.progressao.energia += r.energia?.valor || 0; p.progressao.pontos += r.pontos;
    p.progressao.historico = [...(p.progressao.historico || []), { nivel: nv, vida: r.vida?.valor || 0, dadoVida: r.vida?.dado || '', energia: r.energia?.valor || 0, pontos: r.pontos }];
    p.nivel = nv;
    p.vida.atual = n(p.vida.atual) + (r.vida?.valor || 0); p.energia.atual = n(p.energia.atual) + (r.energia?.valor || 0);
    aplicar(p);
    return r;
  }

  // ---------- Carga do inventário ----------
  // "1,5 kg", "4 kg", "500 g", "1,5 kg cada": devolve kg, ou null se não houver número. Sem unidade = kg.
  function pesoKg(txt) {
    const m = String(txt ?? '').match(/(\d+(?:[.,]\d+)?)\s*(kg|g)?/i);
    if (!m) return null;
    const v = parseFloat(m[1].replace(',', '.'));
    return m[2] && m[2].toLowerCase() === 'g' ? v / 1000 : v;
  }
  function carga(p) {
    let total = 0, semPeso = 0;
    (p.inventario || []).forEach(i => { const kg = pesoKg(i.peso); if (kg === null) semPeso++; else total += kg * Math.max(1, n(i.qtd)); });
    total = Math.round(total * 100) / 100;
    const capacidade = CARGA_BASE + n(p.ajustes?.carga);
    return { total, capacidade, semPeso, excedeu: total > capacidade, livre: Math.round((capacidade - total) * 100) / 100 };
  }

  // ---------- Moedas e compras ----------
  // As regras ainda não definem a conversão: valores assumidos (1 prata = 10 bronzes; 1 ouro = 100 pratas). Guardamos tudo em bronzes.
  // "cobre" é tratado como bronze. Para mudar a conversão, altere só esta tabela.
  const MOEDAS = { ouro: 1000, prata: 10, bronze: 1 };
  // "1 ouro e 20 pratas", "3 moedas de ouro", "30 moedas de cobre", "8 bronzes" -> bronzes. Número solto = bronzes. Sem preço -> null.
  function precoBronzes(txt) {
    const s = String(txt ?? '').toLowerCase().trim(); let total = 0, achou = false;
    for (const m of s.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:moedas?\s+)?(?:de\s+)?(ouros?|pratas?|bronzes?|cobres?)/g)) {
      const u = m[2].startsWith('ouro') ? 'ouro' : m[2].startsWith('prata') ? 'prata' : 'bronze';
      total += parseFloat(m[1].replace(',', '.')) * MOEDAS[u]; achou = true;
    }
    if (achou) return Math.round(total);
    return /^\d+$/.test(s) ? parseInt(s, 10) : null;
  }
  function formatarMoedas(bronzes) {
    const b = Math.max(0, Math.round(n(bronzes))); if (!b) return 'sem moedas';
    const o = Math.floor(b / MOEDAS.ouro), pr = Math.floor((b % MOEDAS.ouro) / MOEDAS.prata), br = b % MOEDAS.prata, p = [];
    if (o) p.push(`${o} ${o === 1 ? 'ouro' : 'ouros'}`); if (pr) p.push(`${pr} ${pr === 1 ? 'prata' : 'pratas'}`); if (br) p.push(`${br} ${br === 1 ? 'bronze' : 'bronzes'}`);
    return p.length > 1 ? p.slice(0, -1).join(', ') + ' e ' + p[p.length - 1] : p[0];
  }
  // Desconta preço × quantidade do dinheiro da ficha (altera p). Não mexe no inventário.
  function pagar(p, preco, qtd = 1) {
    if (!Number.isFinite(preco)) return { ok: false, motivo: 'Esse item não tem preço definido.' };
    const total = Math.round(preco * Math.max(1, n(qtd)));
    if (n(p.dinheiro) < total) return { ok: false, motivo: `Dinheiro insuficiente: custa ${formatarMoedas(total)} e você tem ${formatarMoedas(p.dinheiro)}.` };
    p.dinheiro = n(p.dinheiro) - total;
    return { ok: true, total };
  }

  return { MOEDAS, precoBronzes, formatarMoedas, pagar, PROGRESSAO, CARGA_BASE, xpDoNivel, xpProximo, podeSubir, subirNivel, pesoKg, carga, ATRIBUTOS, PONTOS_INICIAIS, MAX_INICIAL, NIVEL_MAX, CUSTO_ENERGIA, base, derivados, migrar, aplicar, validarCriacao, rolarDado, rolar, teste, iniciativa, ladosDe, custoEnergia, usarHabilidade, descansar };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Regras;
