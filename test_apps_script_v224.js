// test_apps_script_v224.js - v2.12
//
// Dev-time Node test for apps_script_v2.2.4.gs: every dated Results row is emitted (not just the
// fastest per event+course), same-day swims (heat + final) stay separate, exact duplicates collapse,
// undated rows keep the old "fastest only" behaviour, and recent implausibly-fast swims produce
// warnings. Unlike test_se_field.js this ALSO exercises buildPayload() end to end, using a small
// fake Sheet (SpreadsheetApp mock) - the loop wiring is exactly what this version changes.
//
// GS_FILE=/path/to/file.gs overrides the file under test (path no longer hard-coded).
const fs = require('fs'), path = require('path'), vm = require('vm');
const GS = process.env.GS_FILE || path.join(__dirname, 'apps_script_v2.2.4.gs');

let failures = 0;
const check = (d, c) => { console.log(c ? 'PASS -' : 'FAIL -', d); if (!c) failures++; };

let src;
try { src = fs.readFileSync(GS, 'utf8'); } catch (e) { console.log('FAIL - cannot read ' + GS); process.exit(1); }

function stripFunction(text, name) {
  const m = new RegExp(`function ${name}\\([^)]*\\)\\s*\\{`).exec(text);
  if (!m) throw new Error(`Could not find function ${name}`);
  let i = m.index + m[0].length, depth = 1;
  while (depth > 0 && i < text.length) { if (text[i] === '{') depth++; else if (text[i] === '}') depth--; i++; }
  return text.slice(0, m.index) + text.slice(i);
}
['doGet', 'testRun', 'setToken', 'safeCompare'].forEach(fn => { src = stripFunction(src, fn); });
src += `\nthis.api = { parseResultRow, addResultEntry, buildOutput, computeWarnings, buildPayload, parseBasicDataRow, PLAUSIBILITY_DROP, MAX_WARNINGS, SCRIPT_BUILD };`;

const pad = n => String(n).padStart(2, '0');
const isoLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
let currentSS = null;
const sandbox = {
  console,
  Utilities: { formatDate: d => isoLocal(d) },
  SpreadsheetApp: { getActiveSpreadsheet: () => currentSS },
};
vm.createContext(sandbox);
try { vm.runInContext(src, sandbox); } catch (e) { console.log('FAIL - could not load script: ' + e.message); process.exit(1); }
const A = sandbox.api;
const ss = { getSpreadsheetTimeZone: () => 'UTC' };
// Dates must come from the SANDBOX realm: the script does `val instanceof Date`, which is false for a
// Date built in Node's own realm (a harness artefact; real Apps Script is a single realm).
const SBDate = vm.runInContext('Date', sandbox);

const daysAgo = n => { const d = new SBDate(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const finalIdx = ev => 6 + (parseInt(ev, 10) / 50) * 2 - 1;
function resRow({ rec = '', name = 'Baker, Bob', gender = 'M', ev = '100 FS', date, course = 'SC', final }) {
  const row = new Array(finalIdx(ev) + 1).fill('');
  row[0] = rec; row[1] = name; row[2] = gender; row[3] = ev; row[4] = date; row[5] = course; row[finalIdx(ev)] = final;
  return row;
}
const WHITE = '#ffffff', YELLOW = '#ffff00';

// ── 1. parseResultRow ────────────────────────────────────────────────────
const d0 = new SBDate(2026, 6, 4, 12);
let p = A.parseResultRow(resRow({ rec: 17, ev: '100 FS', date: d0, final: '01:23.90' }), WHITE, ss, 5);
check('a valid row parses: event mapped, course S, seconds, ISO date, record number, sheet row',
  p.event === '100 Free' && p.course === 'S' && p.timeSec === 83.9 && p.date === '2026-07-04' && p.rec === 17 && p.row === 5 && p.rawName === 'Baker, Bob');
check('LC maps to L', A.parseResultRow(resRow({ ev: '50 FS', date: d0, course: 'LC', final: '00:30.12' }), WHITE, ss, 3).course === 'L');
check('a yellow (DQ) row is skipped as dq', A.parseResultRow(resRow({ ev: '50 FS', date: d0, final: '00:30.12' }), YELLOW, ss, 3).skip === 'dq');
check('DQ colour match is case-insensitive', A.parseResultRow(resRow({ ev: '50 FS', date: d0, final: '00:30.12' }), '#FFFF00', ss, 3).skip === 'dq');
check('unknown event skipped', A.parseResultRow(resRow({ ev: '75 FS', date: d0, final: '00:30.12' }), WHITE, ss, 3).skip === 'event');
check('unknown course skipped', A.parseResultRow(resRow({ ev: '50 FS', date: d0, course: 'XX', final: '00:30.12' }), WHITE, ss, 3).skip === 'course');
check('an empty or zero time is skipped', A.parseResultRow(resRow({ ev: '50 FS', date: d0, final: '' }), WHITE, ss, 3).skip === 'time' && A.parseResultRow(resRow({ ev: '50 FS', date: d0, final: '00:00.00' }), WHITE, ss, 3).skip === 'time');
check('a garbage time is skipped', A.parseResultRow(resRow({ ev: '50 FS', date: d0, final: 'abc' }), WHITE, ss, 3).skip === 'time');
check('a blank name is skipped', A.parseResultRow(resRow({ name: '', ev: '50 FS', date: d0, final: '00:30.12' }), WHITE, ss, 3).skip === 'blank');
const undated = A.parseResultRow(resRow({ ev: '50 FS', date: 'unknown', final: '00:30.12' }), WHITE, ss, 3);
check('a row with a text (non-Date) date is NOT skipped: it parses with an empty date (old behaviour kept)', !undated.skip && undated.date === '');
check('a missing record number gives rec null', A.parseResultRow(resRow({ rec: '', ev: '50 FS', date: d0, final: '00:30.12' }), WHITE, ss, 3).rec === null);

// ── 2. addResultEntry: heat + final, duplicates, undated ─────────────────
const mkSw = () => ({ name: 'Bob Baker', pbs: {} });
const mk = (ev, time, date, rec, course = 'S') => ({ event: ev, course, timeSec: time, date, rec, row: rec });
let sw = mkSw();
check('first swim is added', A.addResultEntry(sw, mk('100 Free', 85.1, '2026-07-04', 1)) === 'added');
check('a second DIFFERENT time on the same day is kept as its own entry (heat + final)', A.addResultEntry(sw, mk('100 Free', 83.9, '2026-07-04', 2)) === 'added' && Object.keys(sw.pbs).length === 2);
check('an exact duplicate (same event, course, date, time) collapses', A.addResultEntry(sw, mk('100 Free', 83.9, '2026-07-04', 3)) === 'duplicate' && Object.keys(sw.pbs).length === 2);
check('the same time on a different day is a different swim', A.addResultEntry(sw, mk('100 Free', 83.9, '2026-07-05', 4)) === 'added' && Object.keys(sw.pbs).length === 3);
check('the same time in the other course is a different swim', A.addResultEntry(sw, mk('100 Free', 83.9, '2026-07-04', 5, 'L')) === 'added' && Object.keys(sw.pbs).length === 4);
sw = mkSw();
A.addResultEntry(sw, mk('50 Back', 40, '', 1)); A.addResultEntry(sw, mk('50 Back', 39, '', 2)); A.addResultEntry(sw, mk('50 Back', 41, '', 3));
check('undated swims keep only the fastest per event+course (old behaviour: no date to tell them apart)', Object.keys(sw.pbs).length === 1 && Object.values(sw.pbs)[0].time === '39.00');

// ── 3. buildOutput: shape, order, version ────────────────────────────────
sw = { id: 'sh_baker__bob', name: 'Bob Baker', dob: '2013-10-18', gender: 'Boys', squad: 'Junior', se: '1234567', source: 'sheet', pbs: {} };
A.addResultEntry(sw, mk('100 Free', 83.9, '2026-07-04', 9));
A.addResultEntry(sw, mk('100 Free', 85.1, '2026-07-04', 8));
A.addResultEntry(sw, mk('50 Free', 36, '2026-05-01', 2));
const out = A.buildOutput({ x: sw }, { dq: 1 }, []);
check('payload version is 2.4', out.version === '2.4');
check('payload count and swimmer fields (id/name/dob/gender/source/squad/se) are carried', out.count === 1 && out.swimmers[0].id === 'sh_baker__bob' && out.swimmers[0].squad === 'Junior' && out.swimmers[0].se === '1234567' && out.swimmers[0].source === 'sheet');
const pbs = out.swimmers[0].pbs;
check('every entry has exactly the old shape {event, course, time, date} (no new fields to persist)', pbs.every(e => JSON.stringify(Object.keys(e).sort()) === JSON.stringify(['course', 'date', 'event', 'time'])));
check('entries are ordered by date, then by record number (heat before final regardless of time)', pbs.map(e => e.date + ' ' + e.time).join('|') === '2026-05-01 36.00|2026-07-04 1:25.10|2026-07-04 1:23.90');
check('payload carries warnings and stats', Array.isArray(out.warnings) && out.stats.dq === 1);

// ── 4. computeWarnings ───────────────────────────────────────────────────
const today = new Date(2026, 6, 20, 12);
function swWith(entries) { const s = mkSw(); entries.forEach(e => A.addResultEntry(s, e)); return { x: s }; }
let w = A.computeWarnings(swWith([mk('50 Free', 36, '2026-06-01', 1), mk('50 Free', 25, '2026-07-10', 2)]), today);
check('a recent swim >15% faster than the previous best is flagged, with record number and previous best',
  w.length === 1 && w[0].name === 'Bob Baker' && w[0].event === '50 Free' && w[0].time === '25.00' && w[0].previousBest === '36.00' && w[0].rec === 2);
check('a 10% improvement is NOT flagged (juniors improve fast)', A.computeWarnings(swWith([mk('50 Free', 36, '2026-06-01', 1), mk('50 Free', 32.4, '2026-07-10', 2)]), today).length === 0);
check('a swimmer\'s first-ever swim is never flagged', A.computeWarnings(swWith([mk('50 Free', 25, '2026-07-10', 1)]), today).length === 0);
check('an old suspicious swim (outside the 60-day window) is not re-flagged on every sync', A.computeWarnings(swWith([mk('50 Free', 36, '2025-06-01', 1), mk('50 Free', 25, '2026-03-01', 2)]), today).length === 0);
check('a heat followed by a slightly faster final the same day is not flagged', A.computeWarnings(swWith([mk('100 Free', 85.1, '2026-07-10', 1), mk('100 Free', 83.9, '2026-07-10', 2)]), today).length === 0);
check('SC and LC are compared separately', A.computeWarnings(swWith([mk('50 Free', 36, '2026-06-01', 1, 'S'), mk('50 Free', 25, '2026-07-10', 2, 'L')]), today).length === 0);
check('undated entries are never flagged', A.computeWarnings(swWith([mk('50 Free', 36, '', 1)]), today).length === 0);
const many = []; for (let i = 0; i < 80; i++) many.push(mk('50 Free', 100 - i * 1.0, '2026-07-' + pad(1 + (i % 19)), i + 1));
const manyW = A.computeWarnings(swWith(many.concat([mk('100 Free', 100, '2026-06-01', 900), mk('100 Free', 50, '2026-07-12', 901)])), today);
check('warnings are capped at MAX_WARNINGS', manyW.length <= A.MAX_WARNINGS);
const two = A.computeWarnings(swWith([mk('50 Free', 36, '2026-06-01', 1), mk('50 Free', 25, '2026-07-05', 2), mk('100 Free', 90, '2026-06-01', 3), mk('100 Free', 60, '2026-07-15', 4)]), today);
check('warnings are ordered newest first', two.length === 2 && two[0].date >= two[1].date);
check('PLAUSIBILITY_DROP is 0.15', A.PLAUSIBILITY_DROP === 0.15);
// UAT 5.1: a heat AND a final that are both far faster than the previous best must BOTH be flagged
// (the final used to be compared with the heat, which had already become the "best").
const both = A.computeWarnings(swWith([mk('50 Free', 36, '2026-06-01', 1), mk('50 Free', 25, '2026-07-10', 2), mk('50 Free', 24, '2026-07-10', 3)]), today);
check('UAT 5.1: heat 25.00 and final 24.00 the same day, both far faster than the previous 36.00 -> BOTH flagged', both.length === 2 && both.some(x => x.time === '25.00') && both.some(x => x.time === '24.00'));
check('...each compared with the best BEFORE that day (36.00), not with each other', both.every(x => x.previousBest === '36.00'));
check('a day\'s slower swim is still not flagged when only the faster one is implausible', A.computeWarnings(swWith([mk('50 Free', 36, '2026-06-01', 1), mk('50 Free', 35, '2026-07-10', 2), mk('50 Free', 25, '2026-07-10', 3)]), today).length === 1);
// UAT R5 (round 2): the baseline is the established best from swims that were NOT flagged. A flagged
// swim never becomes the baseline, so two far-faster swims on different days are both flagged.
const diffDays = A.computeWarnings(swWith([mk('50 Free', 36, '2026-06-01', 1), mk('50 Free', 25, '2026-07-05', 2), mk('50 Free', 24.5, '2026-07-12', 3)]), today);
check('UAT R5: two far-faster swims on DIFFERENT days are both flagged, each against the established 36.00', diffDays.length === 2 && diffDays.every(x => x.previousBest === '36.00'));
check('a flagged typo does not hide the real baseline: a normal 35.00 after a 25.00 typo is not flagged (1 warning in total)', A.computeWarnings(swWith([mk('50 Free', 36, '2026-06-01', 1), mk('50 Free', 25, '2026-07-05', 2), mk('50 Free', 35, '2026-07-12', 3)]), today).length === 1);
check('previousBestDate is the date of the previous best swim (not of the fast one)', both[0].previousBestDate === '2026-06-01' && diffDays.every(x => x.previousBestDate === '2026-06-01'));
check('an OLD genuine step improvement (outside the window) becomes the baseline: 36 then 28 in March, 28 again in July is not flagged', A.computeWarnings(swWith([mk('50 Free', 36, '2026-01-10', 1), mk('50 Free', 28, '2026-03-01', 2), mk('50 Free', 28, '2026-07-10', 3)]), today).length === 0);
check('the previous best date follows the best: after an unflagged improvement, later warnings cite the NEW best\'s date', (() => { const w2 = A.computeWarnings(swWith([mk('50 Free', 36, '2026-04-01', 1), mk('50 Free', 33, '2026-06-01', 2), mk('50 Free', 22, '2026-07-10', 3)]), today); return w2.length === 1 && w2[0].previousBest === '33.00' && w2[0].previousBestDate === '2026-06-01'; })());

// ── 5. buildPayload end to end with a fake Sheet ─────────────────────────
const COLS = 70; // wide enough for a 1500 Free final (column index 65), like the real Sheet
function mockSS(basic, results, bgs) {
  const wide = r => { const a = r.slice(0, COLS); while (a.length < COLS) a.push(''); return a; };
  const allBgs = (bgs || results.map(r => r.map(() => WHITE))).map(wide);
  const calls = { cells: 0, rows: 0, tz: 0 };
  const ssObj = {
    calls,
    getSpreadsheetTimeZone: () => { calls.tz++; return 'UTC'; },
    getSheetByName: name => name === 'Basic Data'
      ? { getDataRange: () => ({ getValues: () => [['hdr'], ['hdr'], ...basic] }) }
      : { getLastRow: () => 2 + results.length, getLastColumn: () => COLS,
          getRange: (a, c, nr, nc) => {
            // Supports the row/column form only (what buildPayload uses); data starts at sheet row 3.
            if (typeof a === 'string') throw new Error('A1-string getRange not supported by this mock');
            const r0 = a - 3;
            const pick = rows => rows.slice(r0, r0 + nr).map(r => wide(r).slice(c - 1, c - 1 + nc));
            calls.cells += nr * nc; calls.rows += nr;
            return { getValues: () => pick(results), getBackgrounds: () => pick(allBgs.map(r => r)) };
          } },
  };
  return ssObj;
}
const basic = [['Baker, Bob', 'M', '18/10/2013', 'Junior', '1234567'], ['Carter, Amy', 'F', '23/09/2013', 'Senior', '']];
const day = daysAgo(10), recent = daysAgo(5), old = daysAgo(200);
const results = [
  resRow({ rec: 1, ev: '100 FS', date: day, final: '01:25.10' }),                 // heat
  resRow({ rec: 2, ev: '100 FS', date: day, final: '01:23.90' }),                 // final
  resRow({ rec: 3, ev: '100 FS', date: day, final: '01:23.90' }),                 // exact duplicate row
  resRow({ rec: 4, ev: '50 FS', date: old, final: '00:36.00' }),
  resRow({ rec: 5, ev: '50 FS', date: recent, final: '00:25.00' }),               // 30% faster: warning
  resRow({ rec: 6, ev: '50 FS', date: daysAgo(3), final: '00:20.00' }),           // DQ (yellow)
  resRow({ rec: 7, ev: '50 BK', date: 'unknown', final: '00:40.00' }),            // undated
  resRow({ rec: 8, ev: '50 BK', date: 'unknown', final: '00:39.00' }),            // undated, faster
  resRow({ rec: 9, name: 'Nobody, Unknown', ev: '50 FS', date: recent, final: '00:30.00' }),
  resRow({ rec: 10, ev: '50 FS', date: recent, course: 'LC', final: '00:40.00' }),
  resRow({ rec: 11, name: 'Carter, Amy', gender: 'F', ev: '200 FS', date: recent, final: '02:30.00' }),
];
const bgs = results.map(r => r.map(() => WHITE)); bgs[5][1] = YELLOW;
currentSS = mockSS(basic, results, bgs);
const payload = A.buildPayload();
const bob = payload.swimmers.find(s => s.name === 'Bob Baker'), amy = payload.swimmers.find(s => s.name === 'Amy Carter');
const f = (s, ev, c) => s.pbs.filter(e => e.event === ev && e.course === c);
check('buildPayload: both swimmers present, payload version 2.4', payload.count === 2 && payload.version === '2.4');
check('heat AND final of the same day are both emitted, in record order', f(bob, '100 Free', 'S').map(e => e.time).join('|') === '1:25.10|1:23.90');
check('the duplicated final row did not produce a third entry', f(bob, '100 Free', 'S').length === 2);
check('both 50 Free SC swims (old and recent) are emitted - history, not just the fastest', f(bob, '50 Free', 'S').map(e => e.time).join('|') === '36.00|25.00');
check('the yellow DQ row is not emitted', !bob.pbs.some(e => e.time === '20.00'));
check('undated rows collapse to the single fastest, with an empty date', f(bob, '50 Back', 'S').length === 1 && f(bob, '50 Back', 'S')[0].time === '39.00' && f(bob, '50 Back', 'S')[0].date === '');
check('the LC 50 Free is its own entry', f(bob, '50 Free', 'L').length === 1);
check('a row for an unknown swimmer is ignored', !payload.swimmers.some(s => s.name === 'Unknown Nobody'));
check('Amy has her one swim', amy.pbs.length === 1 && amy.pbs[0].time === '2:30.00');
check('Bob: 2 + 2 + 1 + 1 = 6 entries in total', bob.pbs.length === 6);
check('exactly one warning: Bob\'s recent 25.00 (record 5), with the previous best 36.00', payload.warnings.length === 1 && payload.warnings[0].rec === 5 && payload.warnings[0].previousBest === '36.00');
check('stats count the skipped DQ row, the unknown swimmer and the collapsed duplicate', payload.stats.dq === 1 && payload.stats.unknownSwimmer === 1 && payload.stats.duplicates === 1);
check('Basic Data parsing is unchanged (se carried through)', bob.se === '1234567' && !('se' in amy));
currentSS = mockSS(basic, []);
check('an empty Results tab still produces a valid payload', A.buildPayload().count === 2);

// ── 6. Reading only the rows that hold data (UAT 4.0: 3,174 of 3,999 rows read were blank) ──────────
const strip = pl => JSON.stringify({ ...pl, generated: 0, stats: { ...pl.stats, rows: 0, rowsRead: 0, ms: 0, msRead: 0, msValues: 0, msBg: 0, msParse: 0 } });
const blanks = n => Array.from({ length: n }, () => new Array(COLS).fill(''));
currentSS = mockSS(basic, results, bgs);
const plain = A.buildPayload(); const cellsPlain = currentSS.calls.cells;
currentSS = mockSS(basic, results.concat(blanks(500)), bgs.concat(blanks(500).map(r => r.map(() => WHITE))));
const padded = A.buildPayload(); const cellsPadded = currentSS.calls.cells;
check('500 trailing blank rows give a payload identical to none', strip(plain) === strip(padded));
check('...and are not read in bulk: rows touched stay a small multiple of the data, not the sheet length (see section 8)', cellsPadded < cellsPlain * 400);
check('stats.rows reports the rows actually read, not the sheet length', padded.stats.rows === results.length);
check('stats.ms (build time) is reported as a number', typeof padded.stats.ms === 'number' && padded.stats.ms >= 0);
check('the time split is reported too (msRead, msBg, msParse), so a slow run shows WHERE the time goes', typeof padded.stats.msRead === 'number' && typeof padded.stats.msBg === 'number' && typeof padded.stats.msParse === 'number');
check('the payload carries the script build marker', /^2\.2\.4-b\d+$/.test(padded.build) && padded.build === A.SCRIPT_BUILD);
currentSS = mockSS(basic, results, bgs); A.buildPayload();
check('the Sheet timezone is asked for ONCE per payload, not once per row (each ask is a slow service call)', currentSS.calls.tz <= 1);
currentSS = mockSS(basic, [resRow({ rec: 1, ev: '75 FS', date: day, final: '00:30.00' }), resRow({ rec: 2, ev: '50 FS', date: day, final: 'abc' }), resRow({ rec: 3, ev: '50 FS', date: day, final: '00:30.00' })]);
const skp = A.buildPayload().stats;
check('rows skipped for an unknown event or an unreadable time are listed (Sheet row, record no., reason, name, detail) so no real swim is dropped silently',
  Array.isArray(skp.skippedRows) && skp.skippedRows.length === 2 && skp.skippedRows[0].row === 3 && skp.skippedRows[0].rec === 1 && skp.skippedRows[0].reason === 'event' && skp.skippedRows[0].detail === '75 FS' && skp.skippedRows[0].name === 'Baker, Bob' && skp.skippedRows[1].reason === 'time' && skp.skippedRows[1].rec === 2 && /abc/.test(skp.skippedRows[1].detail));
check('skippedTotal counts every such row, not just the listed ones', skp.skippedTotal === 2);
const manySkips = Array.from({ length: 60 }, (_, i) => resRow({ rec: i + 1, ev: '75 FS', date: day, final: '00:30.00' }));
currentSS = mockSS(basic, manySkips);
const capStats = A.buildPayload().stats;
check('the skipped-rows list is capped (20) but skippedTotal still says 60', capStats.skippedRows.length === 20 && capStats.skippedTotal === 60 && capStats.event === 60);

// ── 7. UAT S2: why rows were skipped, in words ──────────────────────────────────────────────
const withCells = (r, cells) => { const a = r.slice(); Object.keys(cells).forEach(k => { a[+k] = cells[k]; }); return a; };
const reason = row => A.parseResultRow(row, WHITE, ss, 9);
let sk1 = reason(withCells(resRow({ rec: 812, ev: '200 BK', date: d0, final: '' }), { 11: '02:44.03' }));
check('UAT S2b: a 200 whose time is in the 150 column and the 200 column is blank says exactly that', sk1.skip === 'time' && /150 column/.test(sk1.detail) && /02:44\.03/.test(sk1.detail) && /wrong column/.test(sk1.detail));
sk1 = reason(withCells(resRow({ rec: 813, ev: '100 BK', date: d0, final: '' }), { 7: '01:44.69' }));
check('UAT S2b: a 100 whose time is in the 50 column says the 50 column', sk1.skip === 'time' && /50 column/.test(sk1.detail) && /01:44\.69/.test(sk1.detail));
sk1 = reason(resRow({ rec: 814, ev: '100 BK', date: d0, final: '' }));
check('an entirely empty time says the final time cell is empty', sk1.skip === 'time' && /final time cell is empty/.test(sk1.detail) && !/wrong column/.test(sk1.detail));
sk1 = reason(resRow({ rec: 815, ev: '100 BK', date: d0, final: '#REF!' }));
check('UAT S2a: a #REF! cell (a Data Entry row deleted instead of cleared) is named', sk1.skip === 'time' && /#REF!/.test(sk1.detail));
check('a numeric (not text) cell is fine as a time (Sheets may hand back a number)', reason(resRow({ ev: '50 FS', date: d0, final: 33.25 })).timeSec === 33.25);

// ── 8. Touching fewer ROWS (UAT T2: cost is ~1.7 ms per row read, whatever the column count) ──────────
// Round 3 timings: scan 3,997 rows 7.3 s, values 830 rows 1.4 s, colours 830 rows 1.5 s. Reading fewer
// columns changed nothing, so every column is read again (no result can be missed), and the last data
// row is found by reading forward in chunks, stopping after a run of blank chunks, instead of scanning
// every row of the sheet first.
const core = pl => JSON.stringify({ swimmers: pl.swimmers, warnings: pl.warnings.map(w => ({ ...w, row: 0 })) }); // `row` legitimately moves with blank rows
const sprint = Array.from({ length: 120 }, (_, i) => resRow({ rec: i + 1, ev: i % 2 ? '50 FS' : '100 FS', date: day, final: '00:' + (30 + (i % 20)) + '.00' }));
currentSS = mockSS(basic, sprint);
const sprintPlain = A.buildPayload(); const rowsPlain = currentSS.calls.rows;
currentSS = mockSS(basic, sprint.concat(blanks(3000)), bgs.slice(0, 0).concat(sprint.map(r => r.map(() => WHITE)), blanks(3000).map(r => r.map(() => WHITE))));
const sprintBlank = A.buildPayload(); const rowsBlank = currentSS.calls.rows;
check('3,000 trailing blank rows give exactly the same swims and warnings as none', core(sprintBlank) === core(sprintPlain));
check('...and cost a bounded number of row reads: far fewer than the 3,120 rows in the sheet (the old scan alone read all of them)', rowsBlank < 1200);
check('...while rowsRead is reported for the diagnosis', typeof sprintBlank.stats.rowsRead === 'number' && sprintBlank.stats.rowsRead >= 120 && sprintBlank.stats.rowsRead < 1200);
// every column is read: a swim whose time is in a late column is never missed
const longRows = [
  resRow({ rec: 1, ev: '400 FS', date: d0, final: '05:34.46' }),
  resRow({ rec: 2, ev: '800 FS', date: d0, final: '11:00.10' }),
  resRow({ rec: 3, ev: '1500 FS', date: d0, final: '21:45.00' }),
  resRow({ rec: 4, ev: '400 IM', date: d0, final: '' }),
];
currentSS = mockSS(basic, longRows);
const longPayload = A.buildPayload();
const lp = longPayload.swimmers.find(x => x.name === 'Bob Baker').pbs;
check('400, 800 and 1500 finals are read correctly (every column is read)', lp.some(e => e.event === '400 Free' && e.time === '5:34.46') && lp.some(e => e.event === '800 Free' && e.time === '11:00.10') && lp.some(e => e.event === '1500 Free' && e.time === '21:45.00'));
check('...and an empty 400 IM final is reported as a skipped row, not a crash', longPayload.stats.skippedRows.length === 1 && longPayload.stats.skippedRows[0].reason === 'time');
check('the Sheet width and the read time split are reported', ['msValues', 'msBg', 'lastCol', 'rowsRead'].every(k => typeof longPayload.stats[k] === 'number') && longPayload.stats.lastCol === COLS);
// gaps in the middle (rows cleared during testing) must not hide the data after them
const gapA = sprint.slice(0, 60), gapB = sprint.slice(60);
const midGap = (n) => { const rows = gapA.concat(blanks(n), gapB); return mockSS(basic, rows, rows.map(r => r.map(() => WHITE))); };
currentSS = midGap(400);
check('a gap of 400 blank rows in the middle (cleared test data) is tolerated: the swims after it are still read', core(A.buildPayload()) === core(sprintPlain));
currentSS = midGap(30);
check('a short gap is of course fine too', core(A.buildPayload()) === core(sprintPlain));
const trailing = Array.from({ length: 5 }, (_, i) => resRow({ rec: 900 + i, ev: '50 FS', date: day, final: '00:2' + i + '.50' }));
const edge = sprint.concat(blanks(249), trailing); // data ends exactly at a chunk boundary region
currentSS = mockSS(basic, edge, edge.map(r => r.map(() => WHITE)));
check('data that starts just after a blank stretch near a chunk boundary is still read (5 swims after 249 blanks)', A.buildPayload().swimmers.find(x => x.name === 'Bob Baker').pbs.length > sprintPlain.swimmers.find(x => x.name === 'Bob Baker').pbs.length);

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
process.exit(failures ? 1 : 0);
