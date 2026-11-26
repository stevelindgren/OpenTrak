const C = require('../src/engine.js'); const assert = require('assert');
const std = { id: 'c5', name: '5-day', workDays: [0,1,1,1,1,1,0], holidays: ['2026-11-26'] };
const d7 = { id: 'c7', name: '7-day', workDays: [1,1,1,1,1,1,1] };
let n = 0; const A = (code, od, extra = {}) => ({ id: code, code, name: code, od, rd: od, type: 'task', ...extra });
const L = (from, to, type = 'FS', lag = 0) => ({ id: from + to + type, from, to, type, lag });
function run(acts, rels, extra = {}) { return C.schedule({ calendars: [std, d7], defaultCal: 'c5', startDate: '2026-11-02', dataDate: '2026-11-02', activities: acts, relationships: rels, ...extra }); }
function t(name, fn) { fn(); n++; console.log('ok', name); }

t('simple chain FS', () => {
  const r = run([A('A', 5), A('B', 3), A('C', 2)], [L('A','B'), L('B','C')]);
  assert.equal(r.acts.A.es, '2026-11-02'); assert.equal(r.acts.A.ef, '2026-11-06');
  assert.equal(r.acts.B.es, '2026-11-09'); assert.equal(r.acts.B.ef, '2026-11-11');
  assert.equal(r.acts.C.ef, '2026-11-13'); assert.equal(r.finish, '2026-11-13');
  ['A','B','C'].forEach(k => { assert.equal(r.acts[k].tf, 0); assert(r.acts[k].critical); });
});
t('parallel path float', () => {
  const r = run([A('A', 5), A('B', 10), A('C', 2), A('D', 1)], [L('A','C'), L('B','D'), L('C','D')]);
  assert.equal(r.acts.B.tf, 0); assert.equal(r.acts.A.tf, 3); assert.equal(r.acts.C.tf, 3);
  assert.equal(r.acts.A.ff, 0); assert.equal(r.acts.C.ff, 3);
  assert.equal(r.acts.D.es, '2026-11-16');
});
t('holiday skipped (Thanksgiving)', () => {
  const r = run([A('A', 4, { cType: 'SNET', cDate: '2026-11-24' })], []);
  // Tue 24, Wed 25, (Thu 26 holiday), Fri 27, Mon 30
  assert.equal(r.acts.A.es, '2026-11-24'); assert.equal(r.acts.A.ef, '2026-11-30');
});
t('FS lag and SS lag', () => {
  const r = run([A('A', 5), A('B', 3), A('C', 2)], [L('A','B','FS',2), L('A','C','SS',1)]);
  assert.equal(r.acts.B.es, '2026-11-11'); assert.equal(r.acts.C.es, '2026-11-03');
});
t('FF and SF', () => {
  const r = run([A('A', 5), A('B', 2), A('C', 1)], [L('A','B','FF',0), L('A','C','SF',3)]);
  assert.equal(r.acts.B.ef, '2026-11-06'); assert.equal(r.acts.B.es, '2026-11-05');
  // SF: C finishes no earlier than A start + 3 = end of Wed 4th
  assert.equal(r.acts.C.ef, '2026-11-04');
});
t('negative lag (lead)', () => {
  const r = run([A('A', 5), A('B', 3)], [L('A','B','FS',-2)]);
  assert.equal(r.acts.B.es, '2026-11-05');
});
t('milestones', () => {
  const r = run([{ ...A('S', 0), type: 'start' }, A('A', 5), { ...A('F', 0), type: 'finish' }], [L('S','A'), L('A','F')]);
  assert.equal(r.acts.S.es, '2026-11-02'); assert.equal(r.acts.F.ef, '2026-11-06'); assert.equal(r.acts.F.tf, 0);
});
t('7-day calendar', () => {
  const r = run([A('A', 7, { cal: 'c7' }), A('B', 1)], [L('A','B')]);
  assert.equal(r.acts.A.ef, '2026-11-08'); assert.equal(r.acts.B.es, '2026-11-09');
});
t('constraints SNET / FNLT negative float', () => {
  const r = run([A('A', 5), A('B', 5, { cType: 'FNLT', cDate: '2026-11-11' })], [L('A','B')]);
  assert.equal(r.acts.B.ef, '2026-11-13'); assert.equal(r.acts.B.tf, -2); assert(r.warnings.some(w => /negative float/.test(w.msg)));
});
t('must finish by', () => {
  const r = run([A('A', 5)], [], { mustFinishBy: '2026-11-13' });
  assert.equal(r.acts.A.tf, 5);
});
t('progress: done + in-progress + data date', () => {
  const r = C.schedule({ calendars: [std], defaultCal: 'c5', startDate: '2026-11-02', dataDate: '2026-11-09',
    activities: [A('A', 5, { as: '2026-11-02', af: '2026-11-06', rd: 0 }), A('B', 10, { as: '2026-11-09', rd: 8 }), A('C', 3)],
    relationships: [L('A','B'), L('B','C')] });
  assert.equal(r.acts.A.status, 'done'); assert.equal(r.acts.B.status, 'active');
  assert.equal(r.acts.B.ef, '2026-11-18'); assert.equal(r.acts.C.es, '2026-11-19'); assert.equal(r.acts.C.tf, 0);
});
t('not-started work cannot start before data date', () => {
  const r = C.schedule({ calendars: [std], defaultCal: 'c5', startDate: '2026-11-02', dataDate: '2026-11-11', activities: [A('A', 2)], relationships: [] });
  assert.equal(r.acts.A.es, '2026-11-11');
});
t('loop detected, no crash', () => {
  const r = run([A('A', 1), A('B', 1), A('C', 1)], [L('A','B'), L('B','C'), L('C','A')]);
  assert(r.errors.some(e => /loop/i.test(e.msg)), JSON.stringify(r.errors));
});
t('bad data ignored safely', () => {
  const r = run([A('A', 'x'), A('B', -4, { cType: 'SNET', cDate: 'garbage' })], [L('A','Z'), L('A','A')]);
  assert.equal(r.acts.A.es, '2026-11-02'); assert.equal(r.errors.length, 0);
});
t('performance 3000 activities', () => {
  const acts = [], rels = []; for (let i = 0; i < 3000; i++) { acts.push(A('A' + i, 1 + (i % 7))); if (i) rels.push(L('A' + (i - 1), 'A' + i)); if (i > 10 && i % 3 == 0) rels.push(L('A' + (i - 10), 'A' + i, 'SS', 2)); }
  const t0 = Date.now(); run(acts, rels); const ms = Date.now() - t0; console.log('   3000 acts in', ms, 'ms'); assert(ms < 3000);
});
t('recurring holiday rules (2027)', () => {
  const ds = (y) => C.ruleDates(C.DEFAULT_HOLIDAYS, true, y).map((r) => C.toIso(r.dn) + ' ' + r.id);
  assert.deepEqual(ds(2027), ['2027-01-01 newyear','2027-01-18 mlk','2027-02-15 presidents','2027-03-26 goodfriday','2027-05-31 memorial','2027-07-05 july4','2027-09-06 labor','2027-10-11 columbus','2027-11-02 election','2027-11-11 veterans','2027-11-25 thanksgiving','2027-11-26 dayafter','2027-12-24 christmas','2027-12-31 newyear']);
});
t('weekend observance can be turned off', () => {
  const ds = C.ruleDates(['july4', 'christmas'], false, 2027).map((r) => C.toIso(r.dn));
  assert.deepEqual(ds, ['2027-07-04', '2027-12-25']);
});
t('recurring holidays push dates in any year', () => {
  const cal = C.makeCal({ name: 'r', workDays: [0,1,1,1,1,1,0], rules: ['mlk', 'election', 'veterans', 'columbus'] });
  // Fri 2031-01-17 + 1 work day: Mon 20 is MLK Day, so it lands Tue 21
  assert.equal(C.toIso(cal.add(C.toDn('2031-01-17'), 2) - 1), '2031-01-21');
  assert(!cal.isWork(C.toDn('2030-11-05')) && !cal.isWork(C.toDn('2030-11-11')) && !cal.isWork(C.toDn('2030-10-14')));
});
t('driver: predecessor, constraint, data date', () => {
  const r = run([A('A', 5), A('B', 3), A('C', 2, { cType: 'SNET', cDate: '2026-11-20' }), A('D', 2)], [L('A','B'), L('A','C'), L('B','D')]);
  assert.equal(r.acts.A.driver.kind, 'datadate');
  assert.equal(r.acts.B.driver.kind, 'rel'); assert.equal(r.acts.B.driver.from, 'A');
  assert.equal(r.acts.C.driver.kind, 'constraint'); assert.equal(r.acts.C.driver.cType, 'SNET');
  assert.equal(r.acts.D.driver.from, 'B');
});
t('driver: the later of two predecessors, FF link, done predecessor', () => {
  const r = run([A('A', 5), A('B', 8), A('C', 2), A('D', 6)], [L('A','C'), L('B','C'), L('B','D','FF',0)]);
  assert.equal(r.acts.C.driver.from, 'B'); assert.equal(r.acts.D.driver.type, 'FF');
  const r2 = run([A('A', 2, { as: '2026-10-26', af: '2026-10-27', pct: 100, rd: 0 }), A('B', 3)], [L('A','B')]);
  assert.equal(r2.acts.A.driver.kind, 'done'); assert.equal(r2.acts.B.driver.kind, 'datadate');
});
t('parseLinks reads SureTrak-style link text', () => {
  const codes = new Set(['A1020', 'A1030', 'CAR-100']); const is = (c) => codes.has(c);
  assert.deepEqual(C.parseLinks('A1020, A1030 SS+3; A1040 FF -2, A1050+1, A1060 sf', is), [
    { code: 'A1020', type: 'FS', lag: 0 }, { code: 'A1030', type: 'SS', lag: 3 }, { code: 'A1040', type: 'FF', lag: -2 },
    { code: 'A1050', type: 'FS', lag: 1 }, { code: 'A1060', type: 'SF', lag: 0 }]);
  assert.deepEqual(C.parseLinks('CAR-100, CAR-100 SS-2', is), [{ code: 'CAR-100', type: 'FS', lag: 0 }, { code: 'CAR-100', type: 'SS', lag: -2 }]);
  assert.deepEqual(C.parseLinks('  '), []);
  assert.throws(() => C.parseLinks('A1020 SS SS'), /Could not read/);
});
console.log(n, 'tests passed');
