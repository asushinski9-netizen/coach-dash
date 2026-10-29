// probe_v21210.js - v2.12.10: consistent button/radio names, outcome wording on conflict rows, and a
// fourth conflict choice "Use SE report and remove the other copy of the replaced time" (explicit, reported).
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
const P = (t, d, src, extra) => ({ event: '200 Free', course: 'S', time: t, ...(d ? { date: d } : {}), ...(src ? { source: src } : {}), ...(extra || {}) });
const hdr = ['Rank', 'Event', 'Best Time', 'P/F/T', 'Date', 'Meet Name'];
const seRows = (t, d) => [hdr, ['Jina, Amy: 12/10/2014  (Open/Girl 11) 1234567', '', '', '', '', ''], ['1', '200 Free', t + 'S', 'F', d, 'PSC SUMMER 26']];
const file = new w.File(['x'], 'sc.xlsx');
const setFiles = (el, f) => Object.defineProperty(el, 'files', { value: Object.assign({ length: f.length, item: i => f[i] }, f), configurable: true });
async function load(pbs, rows) {
  w.eval('SWIMMERS=' + JSON.stringify([{ id: 'a', name: 'Amy Jina', dob: '2014-10-12', gender: 'Girls', source: 'sheet', se: '1234567', pbs }]));
  w.readXlsxRows = async () => ({ sheetName: 'x', rows });
  w.showSeImportModal(); setFiles(doc.getElementById('seImportFileInput'), [file]); await w.handleSeImportFileChange();
  return w.eval('_seImport.matches[0]');
}
const body = () => doc.getElementById('seImportBody').textContent.replace(/\s+/g, ' ');
const pbsNow = () => w.eval('SWIMMERS[0].pbs');
const btns = () => [...doc.querySelectorAll('#seImportBody button')].map(b => b.textContent.trim());
const radioLabels = () => [...doc.querySelectorAll('#seImportBody label.se-import-choice')].map(l => l.textContent.replace(/\s+/g, ' ').trim());
const amy = () => [P('3:13.52', '2025-11-29', 'gala'), P('3:13.52', '2026-07-05', 'gala')];

setTimeout(async () => {
  let m = await load(amy(), seRows('3:11.36', '05/07/2026'));
  // ── naming: every bulk button is "<radio name> for all" ──
  const b = btns(), r = radioLabels();
  for (const name of ['Keep existing', 'Use SE report', 'Keep both']) {
    check(`conflict: bulk button "${name} for all" exists and a radio starts with "${name}"`, b.includes(name + ' for all') && r.some(x => x.startsWith(name)));
  }
  check('conflict: the old ambiguous "Keep all" button is gone', !b.includes('Keep all'));
  w.hideSeImportModal();
  m = await load([P('3:13.52', '2025-07-01', 'gala', {}), P('3:13.52', '2025-09-28', 'gala')], seRows('3:13.52', '22/02/2025'));
  const b2 = btns(), r2 = radioLabels();
  for (const name of ['Skip', 'Replace', 'Import separately']) {
    check(`duplicates: bulk button "${name} for all" exists and a radio starts with "${name}"`, b2.includes(name + ' for all') && r2.some(x => x.startsWith(name)));
  }
  check('duplicates: the merge radio is named "Merge" (not "Replace all", which clashed with the bulk button)', r2.some(x => x.startsWith('Merge')) && !r2.some(x => /^Replace all/.test(x)));
  w.hideSeImportModal();

  // ── outcome wording on Amy's row ──
  m = await load(amy(), seRows('3:11.36', '05/07/2026'));
  const t = body();
  check('Keep existing says what happens: keeps 3:13.52 and does not import 3:11.36', /Keep existing - keep 3:13\.52 on 5 Jul 2026, don't import 3:11\.36/.test(t));
  check('Use SE report says what happens, and that the other date stays', /Use SE report - replace 3:13\.52 with 3:11\.36 \(the 29 Nov 2025 entry stays\)/.test(t));
  check('Keep both says what happens', /Keep both \(heat and final\) - keep 3:13\.52 and also add 3:11\.36/.test(t));
  check('a faster SE time is called out with the size of the gain', /SE time is 2\.16s faster/.test(t));
  check('the fourth option is offered and names the date that would be removed', /Use SE report and remove the other 3:13\.52 \(29 Nov 2025\)/.test(t) && doc.querySelectorAll('#seImportBody input[type=radio][name^="se-conflict"]').length === 4);
  check('there is deliberately NO bulk button for the removing option', !btns().some(x => /remove/i.test(x) && /for all/.test(x)));
  w.hideSeImportModal();
  m = await load([P('3:13.52', '2026-07-05', 'gala')], seRows('3:15.00', '05/07/2026'));
  check('a slower SE time has no "faster" note and only 3 options (nothing else to remove)', !/faster/.test(body()) && doc.querySelectorAll('#seImportBody input[type=radio][name^="se-conflict"]').length === 3);
  w.hideSeImportModal();

  // ── apply the fourth option ──
  m = await load(amy(), seRows('3:11.36', '05/07/2026'));
  const o = w.seComputeOutcomes(m).find(x => x.outcome === 'conflict');
  w.seSetDecision(w.seDecisionKey('1234567', o), 'incomingx');
  const applyBtn = () => [...doc.querySelectorAll('#seImportBody button')].find(x => /Apply Import/.test(x.textContent));
  check('preview says the repeated on-file result will be removed, Apply is live', applyBtn().disabled === false && /remove 1 repeated on-file result/.test(body()));
  w.seApplyImport(); const rs = w.eval('_seImport.result');
  const e = pbsNow();
  check('Amy ends with ONE swim: 3:11.36 on 5 Jul 2026 (SE), the 29 Nov copy is gone', e.length === 1 && e[0].time === '3:11.36' && e[0].date === '2026-07-05' && e[0].source === 'se');
  check('the SE entry remembers the replaced time AND the removed row', JSON.stringify(e[0].replaced) === '["3:13.52"]' && JSON.stringify(e[0].removed) === '[{"date":"2025-11-29","time":"3:13.52"}]');
  check('summary: 1 conflict updated, 1 repeated result removed, bucket sum still balances', rs.conflictsUpdated === 1 && rs.othersRemoved === 1 && rs.added + rs.datesCorrected + rs.unchanged + rs.duplicatesSkipped + rs.conflictsKept + rs.conflictsUpdated + rs.conflictsBoth === 1);
  check('results line shows 2 -> 1 (-1) with no mismatch warning, and the summary says what was removed', /Swimming results on file: 2 → 1 \(-1\)/.test(body()) && !/did not change by the number/.test(body()) && /repeated on-file result\(s\) removed/.test(body()));
  w.hideSeImportModal();
  const sheet = [{ id: 'a', name: 'Amy Jina', dob: '2014-10-12', gender: 'Girls', source: 'sheet', se: '1234567', pbs: [P('3:13.52', '2025-11-29'), P('3:13.52', '2026-07-05')] }];
  const st = w.mergeSwimmers(sheet, 'keep', { sourceIsAuthoritative: true, fullHistory: true });
  check('a later Sheet sync does not bring either 3:13.52 row back', pbsNow().length === 1 && st.sePbsOverridden === 2 && st.updated === 0);

  // choosing the plain options leaves the other copy alone
  m = await load(amy(), seRows('3:11.36', '05/07/2026'));
  const o2 = w.seComputeOutcomes(m).find(x => x.outcome === 'conflict');
  w.seSetDecision(w.seDecisionKey('1234567', o2), 'incoming'); w.seApplyImport();
  check('plain "Use SE report" still keeps the 29 Nov entry (2 swims left)', pbsNow().length === 2 && pbsNow().some(p => p.date === '2025-11-29') && !pbsNow().some(p => p.removed));
  w.hideSeImportModal();

  // never removes SE-sourced entries; forced decision with nothing to remove behaves as plain replace
  m = await load([P('3:13.52', '2025-11-29', 'se'), P('3:13.52', '2026-07-05', 'gala')], seRows('3:11.36', '05/07/2026'));
  const o3 = w.seComputeOutcomes(m).find(x => x.outcome === 'conflict');
  check('an SE-sourced repeat is not offered for removal (only 3 options)', doc.querySelectorAll('#seImportBody input[type=radio][name^="se-conflict"]').length === 3);
  w.seSetDecision(w.seDecisionKey('1234567', o3), 'incomingx'); w.seApplyImport();
  check('...and forcing the decision removes nothing', pbsNow().length === 2 && pbsNow().some(p => p.source === 'se' && p.date === '2025-11-29'));
  w.hideSeImportModal();

  // sanitiser + edit-preserve
  const sres = w.sanitiseSwimmersData([{ name: 'A B', dob: '2012-01-01', gender: 'Boys', pbs: [
    P('3:11.36', '2026-07-05', 'se', { removed: [{ date: '2025-11-29', time: '3:13.52' }, { date: 'bad', time: '3:13.52' }, { date: '2025-01-01', time: 'x' }, 'junk'] }),
    P('3:10.00', '2026-08-05', 'se', { removed: 'nope' })] }]);
  check('sanitiser keeps only well-formed removed rows and drops the field when none remain', JSON.stringify(sres.clean[0].pbs[0].removed) === '[{"date":"2025-11-29","time":"3:13.52"}]' && !('removed' in sres.clean[0].pbs[1]) && sres.clean[0].pbs.length === 2);
  w.eval('SWIMMERS=' + JSON.stringify([{ id: 'sw_e', name: 'Edit Me', dob: '2012-01-01', gender: 'Boys', pbs: [P('3:11.36', '2026-07-05', 'se', { replaced: ['3:13.52'], removed: [{ date: '2025-11-29', time: '3:13.52' }] })] }]));
  w.editSwimmer('sw_e'); doc.getElementById('asSquad').value = 'Junior'; w.saveSwimmer();
  check('Edit Swimmer keeps the removed list', JSON.stringify(w.eval('SWIMMERS[0].pbs[0].removed')) === '[{"date":"2025-11-29","time":"3:13.52"}]');

  // property
  let seed = 4242; const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const dates = ['2025-11-29', '2026-07-05', '2025-02-22'], times = ['3:13.52', '3:11.36'];
  let bad = 0, cases = 0; const ex = [];
  for (let i = 0; i < 120; i++) {
    const pbs = []; const n = 1 + rnd(4);
    for (let k = 0; k < n; k++) pbs.push(P(times[rnd(2)], dates[rnd(3)], ['gala', 'manual', 'se'][rnd(3)]));
    const seT = times[rnd(2)], seD = dates[rnd(3)].split('-').reverse().join('/');
    for (const conf of ['keep', 'incoming', 'both', 'incomingx']) for (const dup of ['skip', 'replace', 'all']) {
      const mm = await load(JSON.parse(JSON.stringify(pbs)), seRows(seT, seD));
      const before = pbsNow().length, seBefore = pbsNow().filter(p => p.source === 'se').length;
      (mm.duplicates || []).forEach(d => w.seSetDupChoice(0, mm.se.entries.indexOf(d.entry), dup));
      w.seComputeOutcomes(mm).filter(x => x.outcome === 'conflict').forEach(x => w.seSetDecision(w.seDecisionKey('1234567', x), conf));
      w.seApplyImport(); const q = w.eval('_seImport.result'); cases++;
      const after = pbsNow().length, seAfter = pbsNow().filter(p => p.source === 'se').length;
      const ok = after === before + q.added + q.conflictsBoth - q.duplicatesMerged - q.othersRemoved && seAfter >= seBefore;
      if (!ok) { bad++; if (ex.length < 3) ex.push(JSON.stringify({ pbs: pbs.map(p => p.time + '@' + p.date + '[' + (p.source || '') + ']'), se: seT + '@' + seD, conf, dup, before, after, q: { a: q.added, b: q.conflictsBoth, m: q.duplicatesMerged, o: q.othersRemoved } })); }
      w.hideSeImportModal();
    }
  }
  check(`property: across ${cases} random cases the count only changes by reported adds, kept-both, merges and removals, and no existing SE entry is lost${bad ? ' ' + ex.join(' ; ') : ''}`, bad === 0);
  console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
  process.exit(failures ? 1 : 0);
}, 100);
