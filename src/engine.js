/* OpenTrak scheduling engine — Critical Path Method.
 * Time model: a "point" is an integer day number meaning the START of that day
 * (days since 1970-01-01 UTC). An activity starting on day S has start point S;
 * one finishing on day F (inclusive) has finish point F+1. Durations and lags
 * are in work days, counted on a calendar. Lags use the predecessor's calendar.
 */
(function (root) {
  'use strict';
  const DAY = 86400000;
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const GUARD = 3700; // ~10 years of consecutive non-work days

  function isIso(s) {
    if (typeof s !== 'string' || !ISO.test(s)) return false;
    const d = new Date(s + 'T00:00:00Z');
    return !isNaN(d) && d.toISOString().slice(0, 10) === s;
  }
  function toDn(iso) { const [y, m, d] = iso.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / DAY); }
  function toIso(dn) { return new Date(dn * DAY).toISOString().slice(0, 10); }
  function weekday(dn) { return (((dn + 4) % 7) + 7) % 7; } // 0 = Sunday

  // Recurring holidays. fixed: true = a set calendar date that moves to Fri/Mon when it falls on a weekend (if observe is on).
  const nthDow = (y, m, dow, n) => { const first = toDn(y + '-' + String(m).padStart(2, '0') + '-01'); const off = (dow - weekday(first) + 7) % 7; return first + off + (n - 1) * 7; };
  const lastDow = (y, m, dow) => { const last = toDn(new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)); return last - ((weekday(last) - dow + 7) % 7); };
  const ymd = (y, m, d) => toDn(y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'));
  function easter(y) { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return ymd(y, mo, da); }
  const HOLIDAYS = [
    { id: 'newyear', name: "New Year's Day", rule: 'Jan 1', fixed: true, on: (y) => ymd(y, 1, 1) },
    { id: 'mlk', name: 'Martin Luther King Jr. Day', rule: '3rd Mon in Jan', on: (y) => nthDow(y, 1, 1, 3) },
    { id: 'lincoln', name: "Lincoln's Birthday", rule: 'Feb 12', fixed: true, on: (y) => ymd(y, 2, 12) },
    { id: 'presidents', name: "Presidents' Day", rule: '3rd Mon in Feb', on: (y) => nthDow(y, 2, 1, 3) },
    { id: 'goodfriday', name: 'Good Friday', rule: 'Friday before Easter', on: (y) => easter(y) - 2 },
    { id: 'memorial', name: 'Memorial Day', rule: 'Last Mon in May', on: (y) => lastDow(y, 5, 1) },
    { id: 'juneteenth', name: 'Juneteenth', rule: 'Jun 19', fixed: true, on: (y) => ymd(y, 6, 19) },
    { id: 'july4', name: 'Independence Day', rule: 'Jul 4', fixed: true, on: (y) => ymd(y, 7, 4) },
    { id: 'labor', name: 'Labor Day', rule: '1st Mon in Sep', on: (y) => nthDow(y, 9, 1, 1) },
    { id: 'columbus', name: 'Columbus Day', rule: '2nd Mon in Oct', on: (y) => nthDow(y, 10, 1, 2) },
    { id: 'election', name: 'Election Day', rule: 'Tue after 1st Mon in Nov', on: (y) => nthDow(y, 11, 1, 1) + 1 },
    { id: 'veterans', name: 'Veterans Day', rule: 'Nov 11', fixed: true, on: (y) => ymd(y, 11, 11) },
    { id: 'thanksgiving', name: 'Thanksgiving', rule: '4th Thu in Nov', on: (y) => nthDow(y, 11, 4, 4) },
    { id: 'dayafter', name: 'Day after Thanksgiving', rule: 'Fri after Thanksgiving', on: (y) => nthDow(y, 11, 4, 4) + 1 },
    { id: 'xmaseve', name: 'Christmas Eve', rule: 'Dec 24', fixed: true, on: (y) => ymd(y, 12, 24) },
    { id: 'christmas', name: 'Christmas Day', rule: 'Dec 25', fixed: true, on: (y) => ymd(y, 12, 25) },
    { id: 'nye', name: "New Year's Eve", rule: 'Dec 31', fixed: true, on: (y) => ymd(y, 12, 31) },
  ];
  const HOL_IDS = new Set(HOLIDAYS.map((h) => h.id));
  const DEFAULT_HOLIDAYS = ['newyear', 'mlk', 'presidents', 'goodfriday', 'memorial', 'july4', 'labor', 'columbus', 'election', 'veterans', 'thanksgiving', 'dayafter', 'christmas'];
  // Dates (day numbers) of the chosen recurring holidays that fall in year y.
  function ruleDates(rules, observe, y) {
    const out = [];
    for (const h of HOLIDAYS) {
      if (!rules.includes(h.id)) continue;
      for (const yy of [y - 1, y, y + 1]) {
        let d = h.on(yy);
        if (observe && h.fixed) { const w = weekday(d); if (w === 6) d -= 1; else if (w === 0) d += 1; }
        if (new Date(d * DAY).getUTCFullYear() === y) out.push({ dn: d, id: h.id, name: h.name });
      }
    }
    return out.sort((a, b) => a.dn - b.dn);
  }

  function makeCal(c) {
    const wd = (c.workDays || []).slice(0, 7).map(Boolean);
    if (wd.length !== 7 || !wd.some(Boolean)) throw new Error('Calendar "' + c.name + '" has no work days.');
    const hol = new Set((c.holidays || []).filter(isIso).map(toDn));
    const rules = (c.rules || []).filter((r) => HOL_IDS.has(r)), observe = c.observe !== false, done = new Set();
    const yearOf = (d) => new Date(d * DAY).getUTCFullYear();
    const isWork = (d) => {
      if (!wd[weekday(d)]) return false;
      if (rules.length) { const y = yearOf(d); if (!done.has(y)) { done.add(y); for (const r of ruleDates(rules, observe, y)) hol.add(r.dn); } }
      return !hol.has(d);
    };
    const fail = () => { throw new Error('Calendar "' + c.name + '" has no work days for 10 years around a date.'); };
    return {
      id: c.id, name: c.name, isWork,
      // move a start point forward to the start of a work day
      snapF(p) { let d = p, i = 0; while (!isWork(d)) { d++; if (++i > GUARD) fail(); } return d; },
      // move a finish point back to the end of a work day
      snapB(p) { let d = p - 1, i = 0; while (!isWork(d)) { d--; if (++i > GUARD) fail(); } return d + 1; },
      // advance point p by n work days (n may be negative)
      add(p, n) {
        if (!n) return p;
        let i = 0, k = 0;
        if (n > 0) { let d = p; for (;;) { if (isWork(d) && ++k === n) return d + 1; d++; if (++i > GUARD + n * 7) fail(); } }
        n = -n; let d = p - 1;
        for (;;) { if (isWork(d) && ++k === n) return d; d--; if (++i > GUARD + n * 7) fail(); }
      },
      // signed number of work days in [a, b)
      between(a, b) {
        if (a === b) return 0;
        const lo = Math.min(a, b), hi = Math.max(a, b); let k = 0;
        for (let d = lo; d < hi; d++) if (isWork(d)) k++;
        return b > a ? k : -k;
      },
    };
  }

  function num(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }

  function schedule(project) {
    const errors = [], warnings = [];
    const cals = {};
    for (const c of project.calendars || []) {
      try { cals[c.id] = makeCal(c); } catch (e) { errors.push({ msg: e.message }); }
    }
    let defCal = cals[project.defaultCal] || Object.values(cals)[0];
    if (!defCal) { defCal = makeCal({ id: '_std', name: 'Standard', workDays: [0, 1, 1, 1, 1, 1, 0] }); }
    const calOf = (a) => cals[a.cal] || defCal;

    const acts = project.activities || [];
    const byId = new Map(acts.map((a) => [a.id, a]));
    const preds = new Map(), succs = new Map();
    acts.forEach((a) => { preds.set(a.id, []); succs.set(a.id, []); });
    const rels = [];
    for (const r of project.relationships || []) {
      if (!byId.has(r.from) || !byId.has(r.to) || r.from === r.to) continue;
      const rr = { ...r, type: ['FS', 'SS', 'FF', 'SF'].includes(r.type) ? r.type : 'FS', lag: Math.round(num(r.lag, 0)) };
      rels.push(rr); preds.get(r.to).push(rr); succs.get(r.from).push(rr);
    }

    // ---- topological order (Kahn) + loop detection
    const indeg = new Map(acts.map((a) => [a.id, preds.get(a.id).length]));
    const queue = acts.filter((a) => indeg.get(a.id) === 0).map((a) => a.id);
    const order = [];
    while (queue.length) {
      const id = queue.shift(); order.push(id);
      for (const r of succs.get(id)) { indeg.set(r.to, indeg.get(r.to) - 1); if (indeg.get(r.to) === 0) queue.push(r.to); }
    }
    const loopIds = new Set();
    if (order.length < acts.length) {
      const left = new Set(acts.map((a) => a.id).filter((id) => !order.includes(id)));
      // find one concrete cycle for the message
      const start = [...left][0]; const path = []; const seen = new Map(); let cur = start;
      while (cur && !seen.has(cur)) { seen.set(cur, path.length); path.push(cur); const nx = succs.get(cur).find((r) => left.has(r.to)); cur = nx && nx.to; }
      const cyc = cur ? path.slice(seen.get(cur)) : path;
      cyc.forEach((id) => loopIds.add(id));
      errors.push({ msg: 'Logic loop: ' + cyc.map((id) => byId.get(id).code).concat(byId.get(cyc[0]).code).join(' → ') + '. Remove one of these links.', ids: cyc });
      left.forEach((id) => order.push(id));
    }

    const dd = isIso(project.dataDate) ? toDn(project.dataDate) : null;
    const ps = isIso(project.startDate) ? toDn(project.startDate) : (dd ?? toDn(new Date().toISOString().slice(0, 10)));
    const floor = dd != null ? Math.max(ps, dd) : ps;
    const R = new Map();

    // ---- forward pass
    for (const id of order) {
      const a = byId.get(id), cal = calOf(a);
      const ms = a.type === 'start' || a.type === 'finish';
      const od = ms ? 0 : Math.max(0, Math.round(num(a.od, 0)));
      const asOk = isIso(a.as), afOk = isIso(a.af);
      const status = afOk || (a.type === 'start' && asOk) ? 'done' : asOk ? 'active' : 'planned';
      const dur = ms ? 0 : status === 'planned' ? od : Math.max(0, Math.round(num(a.rd, od)));
      const r = { id, cal, ms, od, dur, status };
      if (status === 'done') {
        if (ms) { const p = asOk ? toDn(a.as) : toDn(a.af) + 1; r.es = r.ef = r.rs = (a.type === 'finish' && afOk) ? toDn(a.af) + 1 : p; }
        else { r.es = asOk ? toDn(a.as) : toDn(a.af) - od + 1; r.ef = toDn(a.af) + 1; r.rs = r.ef; }
        r.es0 = r.es;
        if (asOk && afOk && toDn(a.af) < toDn(a.as)) errors.push({ msg: a.code + ': actual finish is before actual start.', ids: [id] });
        if (dd != null && afOk && toDn(a.af) >= dd) warnings.push({ msg: a.code + ': actual finish is on/after the data date.', ids: [id] });
        R.set(id, r); continue;
      }
      let esC = floor, efC = -Infinity;
      // candidate reasons for the (remaining) start, so the app can explain what drives each activity
      const impS = (v) => (dur > 0 ? cal.snapF(v) : v), impF = (v) => (dur > 0 ? cal.snapF(cal.add(v, -dur)) : v);
      const cands = [{ kind: dd != null && floor === dd ? 'datadate' : 'projectstart', imp: impS(floor), rank: 2 }];
      for (const l of preds.get(id)) {
        const P = R.get(l.from); if (!P) continue;
        const pc = P.cal; let v;
        if (l.type === 'FS') { v = pc.add(P.ef, l.lag); esC = Math.max(esC, v); }
        else if (l.type === 'SS') { v = pc.add(P.es0, l.lag); esC = Math.max(esC, v); }
        else if (l.type === 'FF') { v = pc.add(P.ef, l.lag); efC = Math.max(efC, v); }
        else { v = pc.add(P.es0, l.lag); efC = Math.max(efC, v); }
        cands.push({ kind: 'rel', rel: l.id, from: l.from, type: l.type, lag: l.lag, imp: l.type === 'FS' || l.type === 'SS' ? impS(v) : impF(v), rank: P.status === 'done' ? 3 : 0 });
      }
      const cd = isIso(a.cDate) ? toDn(a.cDate) : null;
      if (cd != null && a.cType === 'SNET') { esC = Math.max(esC, cd); cands.push({ kind: 'constraint', cType: 'SNET', imp: impS(cd), rank: 1 }); }
      if (cd != null && a.cType === 'FNET') { efC = Math.max(efC, cd + 1); cands.push({ kind: 'constraint', cType: 'FNET', imp: impF(cd + 1), rank: 1 }); }
      let s, f;
      if (cd != null && a.cType === 'MSO') { s = dur ? cal.snapF(cd) : cd; f = cal.add(s, dur); }
      else if (cd != null && a.cType === 'MFO') { f = dur ? cal.snapB(cd + 1) : cd + 1; s = cal.add(f, -dur); }
      else if (dur > 0) {
        s = cal.snapF(esC);
        if (efC > -Infinity) s = Math.max(s, cal.snapF(cal.add(efC, -dur)));
        f = cal.add(s, dur);
      } else { s = f = Math.max(esC, efC); }
      r.rs = s; r.ef = f;
      if (cd != null && (a.cType === 'MSO' || a.cType === 'MFO')) r.driver = { kind: 'constraint', cType: a.cType };
      else {
        const bind = cands.filter((c) => c.imp === s).sort((x, y) => x.rank - y.rank)[0] || cands.sort((x, y) => y.imp - x.imp)[0];
        r.driver = { ...bind }; delete r.driver.imp; delete r.driver.rank;
      }
      if (status === 'active') { r.es = toDn(a.as); if (dd != null && r.es >= dd) warnings.push({ msg: a.code + ': actual start is on/after the data date.', ids: [id] }); }
      else r.es = s;
      r.es0 = status === 'active' ? r.rs : r.es;
      R.set(id, r);
    }
    return backward();

    function backward() {
      let pf = -Infinity;
      for (const r of R.values()) pf = Math.max(pf, r.ef);
      if (!Number.isFinite(pf)) pf = floor;
      const target = isIso(project.mustFinishBy) ? toDn(project.mustFinishBy) + 1 : pf;
      for (let i = order.length - 1; i >= 0; i--) {
        const id = order[i], a = byId.get(id), r = R.get(id);
        if (r.status === 'done') { r.ls = r.es0; r.lf = r.ef; continue; }
        const cal = r.cal, dur = r.dur;
        let lfC = target, lsC = Infinity;
        for (const l of succs.get(id)) {
          const S = R.get(l.to); if (!S || S.ls == null || S.status === 'done') continue;
          if (l.type === 'FS') lfC = Math.min(lfC, r.cal.add(S.ls, -l.lag));
          else if (l.type === 'SS') lsC = Math.min(lsC, r.cal.add(S.ls, -l.lag));
          else if (l.type === 'FF') lfC = Math.min(lfC, r.cal.add(S.lf, -l.lag));
          else lsC = Math.min(lsC, r.cal.add(S.lf, -l.lag));
        }
        const cd = isIso(a.cDate) ? toDn(a.cDate) : null;
        if (cd != null && (a.cType === 'SNLT' || a.cType === 'MSO')) lsC = Math.min(lsC, cd);
        if (cd != null && (a.cType === 'FNLT' || a.cType === 'MFO')) lfC = Math.min(lfC, cd + 1);
        let lf;
        if (dur > 0) {
          lf = cal.snapB(lfC);
          if (lsC < Infinity) { const s2 = cal.isWork(lsC) ? lsC : cal.add(lsC, -1); lf = Math.min(lf, cal.add(s2, dur)); }
          r.lf = lf; r.ls = cal.add(lf, -dur);
        } else { r.lf = r.ls = Math.min(lfC, lsC); }
        r.tf = cal.between(r.ef, r.lf);
      }
      // free float + driving links
      for (const id of order) {
        const r = R.get(id); if (r.status === 'done') continue;
        let ff = Infinity;
        for (const l of succs.get(id)) {
          const S = R.get(l.to); if (!S || S.status === 'done') continue;
          let g;
          if (l.type === 'FS') g = r.cal.between(r.cal.add(r.ef, l.lag), S.es0);
          else if (l.type === 'SS') g = r.cal.between(r.cal.add(r.es0, l.lag), S.es0);
          else if (l.type === 'FF') g = r.cal.between(r.cal.add(r.ef, l.lag), S.ef);
          else g = r.cal.between(r.cal.add(r.es0, l.lag), S.ef);
          // a gap of non-work days on the successor side is not float
          if (g < 0) g = 0;
          ff = Math.min(ff, g);
          if (g === 0) l.driving = true;
        }
        if (ff === Infinity) ff = r.cal.between(r.ef, pf);
        r.ff = Math.min(ff, r.tf);
      }
      const thr = num(project.critThreshold, 0);
      const out = {};
      for (const [id, r] of R) {
        const a = byId.get(id);
        const show = (p, fin) => {
          if (p == null || !Number.isFinite(p)) return '';
          if (r.ms) return toIso(a.type === 'finish' ? r.cal.snapB(p) - 1 : r.cal.snapF(p));
          return toIso(fin ? p - 1 : p);
        };
        const crit = r.status !== 'done' && r.tf != null && r.tf <= thr;
        out[id] = {
          status: r.status, critical: crit, milestone: r.ms,
          es: show(r.es, false), ef: show(r.ef, true), rs: show(r.rs, false),
          ls: r.status === 'done' ? '' : show(r.ls, false), lf: r.status === 'done' ? '' : show(r.lf, true),
          tf: r.status === 'done' ? null : r.tf, ff: r.status === 'done' ? null : r.ff,
          esP: r.es, efP: r.ef, rsP: r.rs, lsP: r.ls, lfP: r.lf, loop: loopIds.has(id),
          driver: r.status === 'done' ? { kind: 'done' } : r.driver || { kind: 'none' },
        };
        if (r.status !== 'done' && r.tf < 0) warnings.push({ msg: a.code + ' has negative float (' + r.tf + 'd) — a constraint or finish date cannot be met.', ids: [id] });
      }
      // open ends
      const openS = acts.filter((a) => !preds.get(a.id).length && out[a.id].status !== 'done');
      const openF = acts.filter((a) => !succs.get(a.id).length);
      if (openS.length > 1) warnings.push({ msg: openS.length + ' activities have no predecessor: ' + openS.slice(0, 6).map((a) => a.code).join(', ') + (openS.length > 6 ? '…' : '') + '.', ids: openS.map((a) => a.id) });
      if (openF.length > 1) warnings.push({ msg: openF.length + ' activities have no successor: ' + openF.slice(0, 6).map((a) => a.code).join(', ') + (openF.length > 6 ? '…' : '') + '.', ids: openF.map((a) => a.id) });
      // out-of-sequence progress
      for (const l of rels) {
        const P = R.get(l.from), S = R.get(l.to);
        if (l.type === 'FS' && S.status !== 'planned' && P.status !== 'done') warnings.push({ msg: 'Out of sequence: ' + byId.get(l.to).code + ' started before ' + byId.get(l.from).code + ' finished.', ids: [l.to, l.from] });
      }
      const drivingRels = rels.filter((l) => l.driving).map((l) => l.id);
      return {
        acts: out, errors, warnings, drivingRels,
        start: toIso(Math.min(...[...R.values()].map((r) => r.es).filter(Number.isFinite), floor)),
        finish: toIso(pf - 1), finishP: pf, dataDateP: dd,
      };
    }
  }

  // Parse SureTrak-style link text: "A1020, A1030 SS+3, A1040 FF -2, A1050+1" -> [{ code, type, lag }].
  // isCode (optional) says whether a string is an existing activity ID, so IDs like "CAR-100" are not read as a lag.
  // Throws an Error with a plain-language message when an entry can't be read.
  function parseLinks(text, isCode) {
    const out = [];
    for (const raw of String(text || '').split(/[,;\n]+/)) {
      const t = raw.trim().replace(/\s+/g, ' '); if (!t) continue;
      if (isCode && isCode(t)) { out.push({ code: t, type: 'FS', lag: 0 }); continue; }
      let rest = t, lag = 0, type = 'FS';
      const lm = /^(.*?)\s*([+-])\s*(\d+)\s*d?$/i.exec(rest);
      if (lm && lm[1] && !(isCode && isCode(rest))) { rest = lm[1]; lag = (lm[2] === '-' ? -1 : 1) * parseInt(lm[3], 10); }
      const tm = /^(.*\S)\s+(FS|SS|FF|SF)$/i.exec(rest);
      if (tm) { rest = tm[1]; type = tm[2].toUpperCase(); }
      const code = rest.trim();
      if (!code || /\s/.test(code)) throw new Error('Could not read “' + t + '”. Write an ID, then optionally a type and lag, e.g. A1020 SS+3.');
      if (Math.abs(lag) > 9999) throw new Error('The lag in “' + t + '” is too large.');
      out.push({ code, type, lag });
    }
    return out;
  }

  const api = { schedule, makeCal, toDn, toIso, isIso, weekday, HOLIDAYS, DEFAULT_HOLIDAYS, ruleDates, parseLinks };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CPM = api;
})(typeof self !== 'undefined' ? self : this);
