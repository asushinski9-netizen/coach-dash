// probe_v2129.js - v2.12.9: several same-time entries on file; choose which one an SE swim replaces,
// or merge them all into the SE swim (explicit, reported); context lines on duplicate/conflict rows.
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const dir = process.env.FIXTURE_DIR || __dirname;
const html = fs.readFileSync(path.join(__dirname, process.env.INDEX_FILE || 'index.html'), 'utf8');
let failures = 0;
const check = (d, c) => { console.log(c ? 'PASS -' : 'FAIL -', d); if (!c) failures++; };
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', beforeParse(w) {
  w.localStorage.setItem('coach_COUNTY_QT_FULL', fs.readFileSync(path.join(dir, 'county_qt.json'), 'utf8'));
  w.localStorage.setItem('coach_REGIONAL_QT_FULL', fs.readFileSync(path.join(dir, 'regional_qt.json'), 'utf8'));
} });
const w = dom.window, doc = w.document;
const P = (t, d, src, ev) => ({ event: ev || '50 Free', course: 'S', time: t, ...(d ? { date: d } : {}), ...(src ? { source: src } : {}) });
const hdr = ['Rank', 'Event', 'Best Time', 'P/F/T', 'Date', 'Meet Name'];
const seRows = (t, d, ev) => [hdr, ['Test, Nicole: 12/10/2014  (Open/Girl 11) 1234567', '', '', '', '', ''], ['1', ev || '50 Free', t + 'S', 'F', d, 'Meet X']];
const file = new w.File(['x'], 'sc.xlsx');
const setFiles = (el, f) => Object.defineProperty(el, 'files', { value: Object.assign({ length: f.length, item: i => f[i] }, f), configurable: true });
async function load(pbs, rows) {
  w.eval('SWIMMERS=' + JSON.stringify([{ id: 'n', name: 'Nicole Test', dob: '2014-10-12', gender: 'Girls', source: 'sheet', se: '1234567', pbs }]));
  w.readXlsxRows = async () => ({ sheetName: 'x', rows });
  w.showSeImportModal(); setFiles(doc.getElementById('seImportFileInput'), [file]); await w.handleSeImportFileChange();
  return w.eval('_seImport.matches[0]');
}
const body = () => doc.getElementById('seImportBody').textContent.replace(/\s+/g, ' ');
const pbsNow = () => w.eval('SWIMMERS[0].pbs');
const dmy = iso => iso.split('-').reverse().join('/');
const entryIdx = (m) => m.se.entries.indexOf(m.duplicates[0].entry);

setTimeout(async () => {
  const nic = [P('43.50', '2025-07-01', 'gala'), P('43.50', '2025-09-28', 'gala')];
  let m = await load(nic, seRows('43.50', '22/02/2025'));
  check('the duplicate carries ALL candidate entries (2), not just the closest', m.duplicates[0].candidates && m.duplicates[0].candidates.length === 2);
  const radios = doc.querySelectorAll('#seImportBody input[type=radio][name^="se-dup-"]');
  check('with two candidates the row offers 5 choices (skip / replace 1 Jul / replace 28 Sep / replace all / separate)', radios.length === 5);
  check('the row names BOTH on-file dates', /1 Jul 2025/.test(body()) && /28 Sep 2025/.test(body()));
  check('default is still Skip (nothing changes until chosen)', w.seGetDupChoice(m, entryIdx(m)) === 'skip');

  // replace the closest (default "replace")
  w.seSetDupChoice(0, entryIdx(m), 'replace'); w.seApplyImport();
  check('Replace (closest) swaps only the 1 Jul entry', pbsNow().length === 2 && pbsNow().some(p => p.date === '2025-09-28') && pbsNow().some(p => p.date === '2025-02-22' && p.source === 'se'));
  w.hideSeImportModal();

  // pick the OTHER candidate
  m = await load(nic, seRows('43.50', '22/02/2025'));
  const idxOf = d => m.duplicates[0].candidates.findIndex(c => c.date === d);
  w.seSetDupChoice(0, entryIdx(m), 'pick:' + idxOf('2025-09-28'));
  w.seApplyImport();
  check('picking the 28 Sep entry replaces THAT one and leaves 1 Jul', pbsNow().length === 2 && pbsNow().some(p => p.date === '2025-07-01') && !pbsNow().some(p => p.date === '2025-09-28') && pbsNow().some(p => p.date === '2025-02-22'));
  w.hideSeImportModal();

  // replace all (merge)
  m = await load(nic, seRows('43.50', '22/02/2025'));
  w.seSetDupChoice(0, entryIdx(m), 'all');
  check('preview says the extra on-file result will be removed and Apply is live', /remove 1 duplicate on-file result/.test(body()) && [...doc.querySelectorAll('#seImportBody button')].find(b => /Apply Import/.test(b.textContent)).disabled === false);
  w.seApplyImport(); const r = w.eval('_seImport.result');
  check('Replace all merges both on-file entries into the one SE swim (2 -> 1)', pbsNow().length === 1 && pbsNow()[0].date === '2025-02-22' && pbsNow()[0].source === 'se');
  check('the merge is reported: datesCorrected 1, duplicatesMerged 1, nothing counted as added', r.datesCorrected === 1 && r.duplicatesMerged === 1 && r.added === 0);
  check('the results line shows the drop and the summary says so in words', /Swimming results on file: 2 → 1 \(-1\)/.test(body()) && /same time merged into the SE/.test(body()));
  check('no mismatch warning is shown for an explicit merge', !/did not change by the number/.test(body()));
  w.hideSeImportModal();
  // later sync does not bring them back
  const sheet = [{ id: 'n', name: 'Nicole Test', dob: '2014-10-12', gender: 'Girls', source: 'sheet', se: '1234567', pbs: [P('43.50', '2025-07-01'), P('43.50', '2025-09-28')] }];
  const st = w.mergeSwimmers(sheet, 'keep', { sourceIsAuthoritative: true, fullHistory: true });
  check('a later Sheet sync does not re-add the merged Sheet rows', pbsNow().length === 1 && st.sePbsSuppressed === 2);

  // single candidate keeps the old 3 choices
  m = await load([P('43.50', '2025-07-01', 'gala')], seRows('43.50', '22/02/2025'));
  check('a single candidate still offers exactly the 3 original choices', doc.querySelectorAll('#seImportBody input[type=radio][name^="se-dup-"]').length === 3);
  w.hideSeImportModal();

  // 'all' never touches an SE-sourced entry or another event
  m = await load([P('43.50', '2025-01-01', 'se'), P('43.50', '2025-07-01', 'gala'), P('43.50', '2025-09-28', 'gala'), P('43.50', '2025-07-01', 'gala', '100 Free')], seRows('43.50', '22/02/2025'));
  w.seSetDupChoice(0, entryIdx(m), 'all'); w.seApplyImport();
  check('merge never removes an SE-sourced entry or a different event', pbsNow().length === 3 && pbsNow().some(p => p.source === 'se' && p.date === '2025-01-01') && pbsNow().some(p => p.event === '100 Free'));
  w.hideSeImportModal();

  // context line on conflict rows (Amy)
  const amy = [P('3:13.52', '2025-11-29', 'gala', '200 Free'), P('3:13.52', '2026-07-05', 'gala', '200 Free')];
  m = await load(amy, seRows('3:11.36', '05/07/2026', '200 Free'));
  check('conflict row says the on-file time also appears on another date', /also on file on 29 Nov 2025/.test(body()));
  w.hideSeImportModal();
  m = await load([P('1:25.10', '2026-07-04', 'gala', '200 Free')], seRows('1:23.90', '04/07/2026', '200 Free'));
  check('no context line when the on-file time appears nowhere else', !/also on file on/.test(body()));
  w.hideSeImportModal();

  // property: results only fall through an explicit merge, by exactly the reported amount
  let seed = 777; const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const dates = ['2025-02-22', '2025-07-01', '2025-09-28', '2026-10-03'], times = ['43.50', '1:25.10'];
  let bad = 0, cases = 0; const ex = [];
  for (let i = 0; i < 120; i++) {
    const pbs = []; const n = 1 + rnd(5);
    for (let k = 0; k < n; k++) pbs.push(P(times[rnd(2)], dates[rnd(4)], ['gala', 'manual', 'se'][rnd(3)]));
    const seT = times[rnd(2)], seD = dates[rnd(4)];
    for (const dup of ['skip', 'replace', 'separate', 'all', 'pick:0', 'pick:1']) for (const conf of ['keep', 'incoming', 'both']) {
      const mm = await load(JSON.parse(JSON.stringify(pbs)), seRows(seT, dmy(seD)));
      const before = pbsNow().length;
      (mm.duplicates || []).forEach(d => w.seSetDupChoice(0, mm.se.entries.indexOf(d.entry), dup));
      w.seComputeOutcomes(mm).filter(o => o.outcome === 'conflict').forEach(o => w.seSetDecision(w.seDecisionKey('1234567', o), conf));
      const seBefore = pbsNow().filter(p => p.source === 'se').length;
      w.seApplyImport(); const rr = w.eval('_seImport.result'); cases++;
      const after = pbsNow().length, seAfter = pbsNow().filter(p => p.source === 'se').length;
      const okCount = after === before + rr.added + rr.conflictsBoth - (rr.duplicatesMerged || 0);
      // existing SE-sourced entries are never removed (new SE entries may be added)
      const okSe = seAfter >= seBefore;
      if (!okCount || !okSe) { bad++; if (ex.length < 3) ex.push(JSON.stringify({ pbs: pbs.map(p => p.time + '@' + p.date + '[' + (p.source || '') + ']'), se: seT + '@' + seD, dup, conf, before, after, rr: { a: rr.added, b: rr.conflictsBoth, m: rr.duplicatesMerged } })); }
      w.hideSeImportModal();
    }
  }
  check(`property: across ${cases} random cases the count changes only by reported adds, kept-both and explicit merges, and an SE-sourced entry is never removed${bad ? ' ' + ex.join(' ; ') : ''}`, bad === 0);
  console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
  process.exit(failures ? 1 : 0);
}, 100);
