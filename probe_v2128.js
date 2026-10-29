// probe_v2128.js - v2.12.8: SE import must never lose a swimming result; remembered overrides;
// "keep both" for a heat+final conflict; results-on-file count line; same-time-repeat flag.
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
const P = (t, d, src, extra) => ({ event: '50 Free', course: 'S', time: t, ...(d ? { date: d } : {}), ...(src ? { source: src } : {}), ...(extra || {}) });
const roster = pbs => [{ id: 'sh_t', name: 'Leila Test', dob: '2014-10-12', gender: 'Girls', source: 'sheet', se: '1234567', pbs }];
const hdr = ['Rank', 'Event', 'Best Time', 'P/F/T', 'Date', 'Meet Name'];
const seRows = (t, d) => [hdr, ['Test, Leila: 12/10/2014  (Open/Girl 11) 1234567', '', '', '', '', ''], ['1', '50 Free', t + 'S', 'F', d, 'Meet X']];
const file = new w.File(['__SC__'], 'sc.xlsx');
const setFiles = (el, f) => Object.defineProperty(el, 'files', { value: Object.assign({ length: f.length, item: i => f[i] }, f), configurable: true });
async function load(pbs, rows) {
  w.eval('SWIMMERS=' + JSON.stringify(roster(pbs)));
  w.readXlsxRows = async () => ({ sheetName: 'x', rows });
  w.showSeImportModal(); setFiles(doc.getElementById('seImportFileInput'), [file]); await w.handleSeImportFileChange();
  return w.eval('_seImport.matches[0]');
}
const pbsNow = () => w.eval('SWIMMERS[0].pbs');
const keyOf = p => p.time + '@' + p.date + (p.source ? '[' + p.source + ']' : '');
const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const dmy = iso => iso.split('-').reverse().join('/');

setTimeout(async () => {
  // ── Fix 1: an SE swim that is already on file exactly is never a "probable duplicate" ──
  let m = await load([P('34.80', '2026-10-03'), P('34.80', '2025-10-04')], seRows('34.80', '04/10/2025'));
  check('Fix 1 (Leila): SE swim already on file exactly is not flagged as a probable duplicate', m.duplicates.length === 0);
  w.seSetAllDupChoices(0, 'replace'); w.seApplyImport();
  check('Fix 1 (Leila): both on-file entries survive the import even when "Replace all" is clicked', pbsNow().length === 2 && pbsNow().some(p => p.date === '2026-10-03'));
  w.hideSeImportModal();

  // ── Nicole: SE date matches neither on-file entry ──
  m = await load([P('43.50', '2025-07-01', 'gala'), P('43.50', '2025-09-28', 'gala')], seRows('43.50', '22/02/2025'));
  check('Nicole: flagged as a probable duplicate (SE date matches neither)', m.duplicates.length === 1);
  check('Nicole: the entry offered for replacement is the one with the CLOSEST date, not just the first found', m.duplicates[0].existingMatch.date === '2025-07-01');
  w.seSetAllDupChoices(0, 'replace'); w.seApplyImport();
  check('Nicole: replace swaps exactly one entry; the other same-time entry stays', pbsNow().length === 2 && pbsNow().some(p => p.date === '2025-02-22' && p.source === 'se') && pbsNow().some(p => p.date === '2025-09-28'));
  w.hideSeImportModal();
  m = await load(JSON.parse(JSON.stringify(pbsNow())), seRows('43.50', '22/02/2025'));
  check('Nicole re-review of the same file: no probable duplicate any more (the SE swim is already on file)', m.duplicates.length === 0);
  check('Nicole re-review: Apply is disabled with nothing to import', [...doc.querySelectorAll('#seImportBody button')].find(b => /Apply Import/.test(b.textContent)).disabled === true);
  w.hideSeImportModal();

  m = await load([P('43.50', '2025-07-01', 'gala'), P('43.50', '2025-09-28', 'gala')], seRows('43.50', '27/09/2025'));
  check('closest-date rule: SE 27 Sep picks the 28 Sep entry, not the 1 Jul one', m.duplicates[0].existingMatch.date === '2025-09-28');
  w.hideSeImportModal();
  m = await load([P('43.50', '2025-01-01', 'se'), P('43.50', '2025-09-28', 'gala')], seRows('43.50', '22/02/2025'));
  check('an earlier SE-sourced entry is never offered for replacement (only the Sheet/manual one)', m.duplicates.length === 1 && m.duplicates[0].existingMatch.date === '2025-09-28');
  w.hideSeImportModal();
  m = await load([P('43.50', '2025-01-01', 'se')], seRows('43.50', '22/02/2025'));
  check('with only an SE-sourced same-time entry on file, nothing is flagged', m.duplicates.length === 0);
  w.hideSeImportModal();

  // ── Fix 2: property test - no choice combination can ever lose a result ──
  let seed = 12345; const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const dates = ['2025-02-22', '2025-07-01', '2025-09-28'];
  const times = ['43.50', '1:25.10'];
  let bad = 0, cases = 0; const examples = [];
  for (let i = 0; i < 150; i++) {
    const n = 1 + rnd(4), pbs = [];
    for (let k = 0; k < n; k++) pbs.push(P(times[rnd(2)], dates[rnd(3)], ['gala', 'manual', 'se'][rnd(3)]));
    const seT = times[rnd(2)], seD = dates[rnd(3)];
    for (const dup of ['skip', 'replace', 'separate']) for (const conf of ['keep', 'incoming', 'both']) {
      const mm = await load(JSON.parse(JSON.stringify(pbs)), seRows(seT, dmy(seD)));
      const before = pbsNow().length;
      w.seSetAllDupChoices(0, dup);
      w.seComputeOutcomes(mm).filter(o => o.outcome === 'conflict').forEach(o => w.seSetDecision(w.seDecisionKey('1234567', o), conf));
      w.seApplyImport(); const r = w.eval('_seImport.result'); const after = pbsNow().length; cases++;
      if (after !== before + r.added + r.conflictsBoth) { bad++; if (examples.length < 3) examples.push(JSON.stringify({ pbs: pbs.map(keyOf), se: seT + '@' + seD, dup, conf, before, after, added: r.added })); }
      w.hideSeImportModal();
    }
  }
  check(`Fix 2 property: across ${cases} random cases the swimmer's result count only ever rises by exactly the reported adds (new results + kept-both) (no silent loss)${bad ? ' ' + examples.join(' ; ') : ''}`, bad === 0);

  // ── Fix 3: remembered override ──
  const conflictPbs = [P('1:25.10', '2026-07-04', 'gala')];
  m = await load(conflictPbs, seRows('1:23.90', '04/07/2026'));
  let o = w.seComputeOutcomes(m).find(x => x.outcome === 'conflict');
  const optionRadios = doc.querySelectorAll('#seImportBody input[type=radio][name^="se-conflict"]');
  check('conflict row offers three choices (keep existing / use SE report / keep both)', optionRadios.length === 3);
  w.seSetDecision(w.seDecisionKey('1234567', o), 'incoming'); w.seApplyImport();
  let e0 = pbsNow()[0];
  check('"Use SE report" records the replaced Sheet time on the SE entry', pbsNow().length === 1 && e0.time === '1:23.90' && e0.source === 'se' && JSON.stringify(e0.replaced) === '["1:25.10"]');
  w.hideSeImportModal();
  const sheetOld = [{ id: 'sh_t', name: 'Leila Test', dob: '2014-10-12', gender: 'Girls', source: 'sheet', se: '1234567', pbs: [P('1:25.10', '2026-07-04')] }];
  let st = w.mergeSwimmers(sheetOld, 'keep', { sourceIsAuthoritative: true, fullHistory: true });
  check('next Sheet sync does NOT bring the replaced time back', pbsNow().length === 1 && pbsNow()[0].time === '1:23.90');
  check('...and reports it as overridden, not as a protected mismatch or an update', st.sePbsOverridden === 1 && st.sePbsProtected === 0 && st.updated === 0);
  const sheetOther = [{ ...sheetOld[0], pbs: [P('1:26.00', '2026-07-04')] }];
  w.mergeSwimmers(sheetOther, 'keep', { sourceIsAuthoritative: true, fullHistory: true });
  check('a DIFFERENT slower Sheet time on that date is still treated as a plausible heat and added', pbsNow().length === 2);

  // accumulate / sanitise / edit-preserve
  const sres = w.sanitiseSwimmersData([{ name: 'A B', dob: '2012-01-01', gender: 'Boys', pbs: [
    P('30.00', '2026-01-01', 'se', { replaced: ['31.00', 'junk', '1:02.50'] }), P('29.00', '2026-02-01', 'se', { replaced: 'nope' }), P('28.00', '2026-03-01', 'se', { replaced: [] })] }]);
  const sp = sres.clean[0].pbs;
  check('sanitiser keeps valid replaced times and drops junk entries', JSON.stringify(sp[0].replaced) === '["31.00","1:02.50"]');
  check('sanitiser drops a non-array or empty replaced field but keeps the swim', !('replaced' in sp[1]) && !('replaced' in sp[2]) && sp.length === 3);
  w.eval('SWIMMERS=' + JSON.stringify([{ id: 'sw_e', name: 'Edit Me', dob: '2012-01-01', gender: 'Boys', pbs: [P('30.00', '2026-01-01', 'se', { replaced: ['31.00'] })] }]));
  w.editSwimmer('sw_e'); doc.getElementById('asSquad').value = 'Junior'; w.saveSwimmer();
  check('Edit Swimmer (changing something unrelated) keeps the replaced list', JSON.stringify(w.eval('SWIMMERS[0].pbs[0].replaced')) === '["31.00"]');

  // ── Keep both (heat + final) ──
  m = await load([P('1:25.10', '2026-07-04', 'gala')], seRows('1:23.90', '04/07/2026'));
  o = w.seComputeOutcomes(m).find(x => x.outcome === 'conflict'); w.seSetDecision(w.seDecisionKey('1234567', o), 'both');
  const applyBtn = () => [...doc.querySelectorAll('#seImportBody button')].find(b => /Apply Import/.test(b.textContent));
  check('choosing "Keep both" makes Apply live and the note says a result will be added', applyBtn().disabled === false && /add 1 new PB result/.test(doc.getElementById('seImportBody').textContent));
  w.seApplyImport(); const rb = w.eval('_seImport.result');
  check('Keep both: both swims are on file, SE one tagged se, original untouched, no replaced marker',
    pbsNow().length === 2 && pbsNow().some(p => p.time === '1:25.10' && p.source === 'gala' && !p.replaced) && pbsNow().some(p => p.time === '1:23.90' && p.source === 'se' && !p.replaced));
  check('Keep both is counted in its own bucket; buckets still sum to the results in the file', rb.conflictsBoth === 1 && rb.added + rb.datesCorrected + rb.unchanged + rb.duplicatesSkipped + rb.conflictsKept + rb.conflictsUpdated + rb.conflictsBoth === 1);
  w.hideSeImportModal();
  st = w.mergeSwimmers([{ ...sheetOld[0], pbs: [P('1:25.10', '2026-07-04'), P('1:23.90', '2026-07-04')] }], 'keep', { sourceIsAuthoritative: true, fullHistory: true });
  check('after Keep both, a sync listing both swims changes nothing', pbsNow().length === 2 && st.updated === 0);

  // ── Same time on file more than once: flagged, never deleted ──
  check('findSameTimeRepeats lists a swim time held on two dates', JSON.stringify(w.findSameTimeRepeats([P('43.50', '2025-09-28'), P('43.50', '2025-02-22'), P('44.00', '2025-01-01')]).map(g => g.dates.sort())) === '[["2025-02-22","2025-09-28"]]');
  m = await load([P('43.50', '2025-09-28', 'gala'), P('43.50', '2025-10-05', 'gala'), P('50.00', '2025-01-01', 'gala')], seRows('44.00', '01/02/2025'));
  const rep = doc.querySelector('#seImportBody details[data-keep="repeats"]');
  check('the review lists same-time repeats on file as a possible-duplicates note', !!rep && /possible duplicate/i.test(rep.textContent) && /43\.50/.test(rep.textContent));
  w.hideSeImportModal();

  // ── Results-on-file count line ──
  w.eval('SWIMMERS=' + JSON.stringify([{ id: 'x', name: 'Count Me', dob: '2012-01-01', gender: 'Boys', pbs: [P('30.00', '2026-01-01', 'gala'), P('31.00', '2026-01-02', 'gala')] }]));
  check('countAllResults totals every swim across every swimmer', w.countAllResults() === 2);
  w.localStorage.setItem('coach_SYNC_URL', 'https://example.test/exec'); doc.getElementById('syncTokenInput').value = 't';
  w.confirm = () => true;
  w.fetch = async () => ({ ok: true, status: 200, statusText: 'OK', json: async () => ({ version: '2.4', swimmers: [{ id: 'x', name: 'Count Me', dob: '2012-01-01', gender: 'Boys', pbs: [P('30.00', '2026-01-01'), P('31.00', '2026-01-02'), P('29.00', '2026-02-02')] }] }) });
  doc.getElementById('syncMergeMode').value = 'keep'; await w.startSync();
  check('sync message shows the swimming results on file before -> after', /Swimming results on file: 2 → 3 \(\+1\)/.test(doc.getElementById('syncStatus').textContent));
  check('Manage Data shows the total swimming results next to the swimmer count', (w.refreshDataModalStatus(), /3 swimming results/.test(doc.getElementById('dataSwimmersCount').textContent)));
  m = await load([P('1:25.10', '2026-07-04', 'gala')], seRows('1:23.90', '04/07/2026'));
  w.seApplyImport();
  check('SE import summary shows the results-on-file line (before -> after) and it balances', /Swimming results on file: 1 → 1 \(no change\)/.test(doc.getElementById('seImportBody').textContent));
  w.hideSeImportModal();
  m = await load([P('1:25.10', '2026-07-04', 'gala')], seRows('1:23.90', '05/07/2026'));
  w.seApplyImport();
  check('...and counts a genuine add (1 -> 2, +1)', /Swimming results on file: 1 → 2 \(\+1\)/.test(doc.getElementById('seImportBody').textContent));
  console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
  process.exit(failures ? 1 : 0);
}, 100);
