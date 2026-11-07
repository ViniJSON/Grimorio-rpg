const assert = require('assert');
const R = require('../js/regras.js');
const rngDe = (lados, ...faces) => { let i = 0; return () => (faces[i++] - 1) / lados; };

// derivados
let p = { forca: 3, agilidade: 2, inteligencia: 1, carisma: 0, ajustes: { vida: 0, energia: 0, defesa: 0 }, vida: { atual: 99, max: 0 }, energia: { atual: 5, max: 0 }, nivel: 1 };
R.aplicar(p);
assert.deepStrictEqual(R.derivados(p), { vida: 16, defesa: 12, energia: 11 });
assert.strictEqual(p.vida.atual, 16, 'atual não passa do máximo');
assert.strictEqual(p.defesa, 12);

// migração de ficha antiga preserva valores
const antiga = { forca: 2, agilidade: 1, inteligencia: 0, carisma: 0, defesa: 15, vida: { atual: 7, max: 20 }, energia: { atual: 3, max: 12 }, nivel: 1 };
R.migrar(antiga);
assert.strictEqual(antiga.vida.max, 20); assert.strictEqual(antiga.energia.max, 12); assert.strictEqual(antiga.defesa, 15);
assert.deepStrictEqual(antiga.ajustes, { vida: 6, energia: 2, defesa: 4, carga: 0 });
R.migrar(antiga); assert.strictEqual(antiga.vida.max, 20, 'idempotente');
antiga.forca = 3; R.aplicar(antiga); assert.strictEqual(antiga.vida.max, 22, 'FOR+1 => vida +2');

// criação: 7 pontos, máx 4
let c = { nivel: 1, forca: 4, agilidade: 3, inteligencia: 0, carisma: 0 };
assert.deepStrictEqual(R.validarCriacao(c).avisos, []);
c.forca = 5; assert.ok(R.validarCriacao(c).avisos.length === 2);
c = { nivel: 2, forca: 9, agilidade: 9, inteligencia: 0, carisma: 0, progressao: { pontos: 11 } };
assert.deepStrictEqual(R.validarCriacao(c).avisos, [], 'teto de 4 só vale no nível 1; orçamento = 7 + pontos ganhos');

// expressões
let r = R.rolar('1d6+FOR', { forca: 2 }, rngDe(6, 4)); assert.strictEqual(r.total, 6);
r = R.rolar('2d12 + 1d6', {}, (() => { const f = [12, 1, 3]; const l = [12, 12, 6]; let i = 0; return () => (f[i] - 1) / l[i++]; })()); assert.strictEqual(r.total, 16);
r = R.rolar('1d4+2-1', {}, rngDe(4, 1)); assert.strictEqual(r.total, 2);
assert.throws(() => R.rolar('1d6+banana', {})); assert.throws(() => R.rolar('')); assert.throws(() => R.rolar('1d1'));
assert.throws(() => R.rolar('1d6++2'));

// testes
let t = R.teste({ forca: 3 }, 'forca', 14, rngDe(20, 12)); // 12+3=15
assert.deepStrictEqual([t.total, t.resultado], [15, 'sucesso']);
t = R.teste({ forca: 3 }, 'forca', 16, rngDe(20, 12)); assert.strictEqual(t.resultado, 'falha');
t = R.teste({ forca: -5 }, 'forca', 99, rngDe(20, 20)); assert.strictEqual(t.resultado, 'critico', '20 natural é sucesso automático');
t = R.teste({ forca: 9 }, 'forca', 1, rngDe(20, 1)); assert.strictEqual(t.resultado, 'falha-critica');
t = R.teste({ agilidade: 2 }, 'agilidade', '', rngDe(20, 10)); assert.strictEqual(t.resultado, null);

// habilidades
const hab = { nome: 'Bola de fogo', dado: '1d6', extra: '+INT' };
let f = { energia: { atual: 10, max: 10 }, inteligencia: 2 };
let u = R.usarHabilidade(f, hab, {}, rngDe(6, 5));
assert.ok(u.ok); assert.strictEqual(u.custo, 4); assert.strictEqual(f.energia.atual, 6); assert.strictEqual(u.total, 7);
u = R.usarHabilidade(f, hab, { critico: true }, rngDe(6, 5));
assert.strictEqual(u.custo, 0); assert.strictEqual(f.energia.atual, 6, 'crítico natural não gasta'); assert.strictEqual(u.total, 14, 'dano dobrado');
f.energia.atual = 3; u = R.usarHabilidade(f, hab, {}, rngDe(6, 1)); assert.ok(!u.ok); assert.strictEqual(f.energia.atual, 3);
assert.ok(!R.usarHabilidade(f, { nome: 'passiva' }, {}).ok);
assert.deepStrictEqual([4, 6, 8, 10, 12].map(l => R.custoEnergia('1d' + l)), [2, 4, 8, 9, 10]);

// descanso
let d = { vida: { atual: 10, max: 12 }, energia: { atual: 1, max: 12 } };
let dr = R.descansar(d, 'longo', rngDe(8, 6, 7)); // vida +6 (cap 12 => +2), energia +7
assert.strictEqual(d.vida.atual, 12); assert.strictEqual(dr.ganhoVida, 2); assert.strictEqual(d.energia.atual, 8);
console.log('regras: tudo certo');

// ---------- progressão ----------
const rngSeq = (...f) => { let i = 0; return () => f[i++ % f.length]; };   // rng: devolve fração direta
const nova = () => R.migrar({ forca: 3, agilidade: 2, inteligencia: 2, carisma: 0, nivel: 1, xp: 0, vida: { atual: 16, max: 16 }, energia: { atual: 12, max: 12 }, ajustes: { vida: 0, energia: 0, defesa: 0 } });
let h = nova();
assert.deepStrictEqual([h.vida.max, h.energia.max, h.progressao.pontos], [16, 12, 0]);
assert.ok(!R.podeSubir(h)); assert.ok(!R.subirNivel(h, '1d12').ok);
h.xp = 1199; assert.ok(!R.podeSubir(h), '1199 XP ainda não'); h.xp = 1200; assert.ok(R.podeSubir(h));
// nível 2: vida = dado da CLASSE (1d12, rng=0.5 -> 7), energia 1d4 (0.5 -> 3)
let s = R.subirNivel(h, '1d12', () => 0.5);
assert.strictEqual(s.nivel, 2); assert.strictEqual(s.vida.dado, '1d12'); assert.strictEqual(s.vida.valor, 7); assert.strictEqual(s.energia.valor, 3);
assert.deepStrictEqual([h.vida.max, h.energia.max, h.vida.atual, h.energia.atual], [23, 15, 23, 15], 'ganho entra no máximo e no atual');
// sem classe cai no dado-base do nível
h.xp = 2400; s = R.subirNivel(h, '', () => 0); assert.strictEqual(s.nivel, 3); assert.strictEqual(s.vida.dado, '1d4'); assert.strictEqual(s.pontos, 2); assert.strictEqual(h.progressao.pontos, 2);
assert.ok(!s.energia, 'nível 3 não dá energia');
// validação com os pontos ganhos: 7 + 2 = 9 (nível 3: sem teto de 4 por atributo)
h.forca = 4; h.agilidade = 3; assert.deepStrictEqual(R.validarCriacao(h).avisos, []);
h.forca = 5; assert.ok(R.validarCriacao(h).avisos[0].includes('demais'));
// nível 5 não dá nada; 10 dá vida e energia; teto em 10
h.xp = 4900; h.nivel = 4; s = R.subirNivel(h, '1d12', () => 0); assert.ok(!s.vida && !s.energia && s.pontos === 0);
h.nivel = 9; h.xp = 20400; s = R.subirNivel(h, '1d10', () => 0.99); assert.strictEqual(s.vida.valor, 10); assert.strictEqual(s.energia.dado, '1d8'); assert.strictEqual(s.energia.valor, 8);
assert.ok(!R.podeSubir(h) && !R.subirNivel(h, '1d10').ok);
assert.deepStrictEqual(h.progressao.historico.map(x => x.nivel), [2, 3, 5, 10]);
// total de ganhos de uma ficha completa de 1 a 10 com d12: pontos = 6, vida em 6 níveis, energia em 4
const full = nova(); let vidas = 0, ener = 0, pts = 0;
for (let nv = 2; nv <= 10; nv++) { full.xp = R.xpDoNivel(nv); const r = R.subirNivel(full, '1d12', () => 0.99); vidas += r.vida?.valor || 0; ener += r.energia?.valor || 0; pts += r.pontos; }
assert.deepStrictEqual([full.nivel, vidas, ener, pts], [10, 72, 20, 6], '1d12 em 6 níveis; 1d4×3 + 1d8 de energia; 3 marcos de +2');
// fichas antigas (nível > 1 sem progressão) não ganham aviso falso nem perdem valores
const velha = R.migrar({ forca: 4, agilidade: 3, inteligencia: 3, carisma: 2, nivel: 4, vida: { atual: 30, max: 40 }, energia: { atual: 5, max: 20 }, defesa: 15 });
assert.deepStrictEqual([velha.vida.max, velha.energia.max, velha.defesa, velha.progressao.pontos, velha.xp], [40, 20, 15, 5, 3800]);
assert.deepStrictEqual(R.validarCriacao(velha).avisos, []);

// ---------- carga ----------
assert.strictEqual(R.pesoKg('1,0 kg'), 1); assert.strictEqual(R.pesoKg('4 kg'), 4); assert.strictEqual(R.pesoKg('500 g'), 0.5);
assert.strictEqual(R.pesoKg('1,5 kg cada'), 1.5); assert.strictEqual(R.pesoKg(''), null); assert.strictEqual(R.pesoKg('leve'), null); assert.strictEqual(R.pesoKg('2'), 2);
let inv = { ajustes: { carga: 0 }, inventario: [{ peso: '4 kg', qtd: 2 }, { peso: '500 g', qtd: 3 }, { peso: '1,0 kg', qtd: 1 }, { peso: '', qtd: 1 }] };
let cg = R.carga(inv); assert.deepStrictEqual([cg.total, cg.capacidade, cg.semPeso, cg.excedeu, cg.livre], [10.5, 15, 1, false, 4.5]);
inv.inventario.push({ peso: '5 kg', qtd: 1 }); cg = R.carga(inv); assert.ok(cg.excedeu && cg.total === 15.5);
inv.ajustes.carga = 5; assert.ok(!R.carga(inv).excedeu); assert.strictEqual(R.carga(inv).capacidade, 20);
console.log('progressão e carga: tudo certo');
