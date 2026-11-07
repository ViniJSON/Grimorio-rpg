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
assert.deepStrictEqual(antiga.ajustes, { vida: 6, energia: 2, defesa: 4 });
R.migrar(antiga); assert.strictEqual(antiga.vida.max, 20, 'idempotente');
antiga.forca = 3; R.aplicar(antiga); assert.strictEqual(antiga.vida.max, 22, 'FOR+1 => vida +2');

// criação: 7 pontos, máx 4
let c = { nivel: 1, forca: 4, agilidade: 3, inteligencia: 0, carisma: 0 };
assert.deepStrictEqual(R.validarCriacao(c).avisos, []);
c.forca = 5; assert.ok(R.validarCriacao(c).avisos.length === 2);
c = { nivel: 2, forca: 9, agilidade: 9, inteligencia: 0, carisma: 0 };
assert.deepStrictEqual(R.validarCriacao(c).avisos, [], 'só vale no nível 1');

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
