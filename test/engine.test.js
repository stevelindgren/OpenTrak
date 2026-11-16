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
console.log(n, 'tests passed');
