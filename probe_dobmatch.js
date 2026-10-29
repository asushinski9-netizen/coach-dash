// probe_dobmatch.js - v2.12 (known-bugs #25, design approved by the coach)
//
// A Google Sheets sync identifies a swimmer by normalised name + date of birth, so a corrected DOB (in the
// Sheet, or edited on the dashboard) used to make a duplicate swimmer with the PBs split across two records.
// Now an unmatched Sheet swimmer is matched to an unmatched dashboard swimmer when ALL of these hold:
//   - same Sheet-derived id (the Apps Script builds it from the Sheet name), and
//   - same normalised name, and
//   - the DOBs differ only slightly: exactly one of year/month/day, or a day/month swap, and
//   - the pairing is unambiguous (one candidate each way), and the sync is authoritative (the Sheet).
// The Sheet's DOB wins, PBs are kept, and the sync says so. Bigger differences keep the old behaviour but
// produce a warning when a same-name / different-DOB pair results. Never matched on name alone.
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, process.env.INDEX_FILE || 'index.html'), 'utf8');
const dir = process.env.FIXTURE_DIR || __dirname;
const countyQt = fs.readFileSync(path.join(dir, 'county_qt.json'), 'utf8');
const regionalQt = fs.readFileSync(path.join(dir, 'regional_qt.json'), 'utf8');

let failures = 0;
const check = (d, c) => { console.log(c ? 'PASS -' : 'FAIL -', d); if (!c) failures++; };

const dom = new JSDOM(html, {
  runScripts: 'dangerously', resources: 'usable', url: 'http://localhost/index.html',
  beforeParse(w) { w.localStorage.setItem('coach_COUNTY_QT_FULL', countyQt); w.localStorage.setItem('coach_REGIONAL_QT_FULL', regionalQt); },
});
const { window } = dom;

setTimeout(async () => {
  const doc = window.document;
  const BUILD = (html.match(/EXPECTED_SCRIPT_BUILD = '([^']+)'/) || [])[1];
  const T = (ev, time, date, source) => ({ event: ev, course: 'S', time, date, ...(source ? { source } : {}) });
  const local = (id, name, dob, extra) => ({ id, name, dob, gender: 'Girls', source: 'sheet', pbs: [], ...(extra || {}) });
  const sheetSw = (id, name, dob, extra) => ({ id, name, dob, gender: 'Girls', source: 'sheet', pbs: [], ...(extra || {}) });
  const setRoster = a => window.eval(`SWIMMERS = ${JSON.stringify(a)}`);
  const roster = () => window.eval('SWIMMERS');
  const sync = (sheet, mode, opts) => window.mergeSwimmers(sheet, mode || 'keep', { sourceIsAuthoritative: true, fullHistory: true, ...(opts || {}) });

  // ── A. what counts as "a corrected date of birth" ───────────────────────
  const c = window.dobsLookCorrected;
  check('A1 one component differs: year / month / day', c('2011-06-07', '2012-06-07') && c('2011-06-07', '2011-07-07') && c('2011-06-07', '2011-06-08'));
  check('A2 a day/month swap (two components differ, but it is a swap)', c('2011-07-06', '2011-06-07') && c('2011-06-07', '2011-07-06'));
  check('A3 two components that are not a swap are NOT a correction', !c('2011-06-07', '2012-07-07') && !c('2011-06-07', '2011-08-09') && !c('2011-06-07', '2013-01-01'));
  check('A4 identical dates, a swap of equal digits, and invalid input are not corrections', !c('2011-06-07', '2011-06-07') && !c('2011-11-11', '2011-11-11') && !c('2011-06-07', 'nonsense') && !c(null, '2011-06-07') && !c('2011-06-07', undefined));
  check('A5 a swap needs the same year', !c('2011-07-06', '2012-06-07'));

  // ── B. the coach's scenario ─────────────────────────────────────────────
  const seBib = [T('50 Free', '36.06', '2025-02-22', 'se')];
  setRoster([local('sh_bremer__bib', 'Bib Bremer', '2011-07-06', { se: '32145678', squad: 'Senior', pbs: seBib })]);
  let r = sync([sheetSw('sh_bremer__bib', 'Bib Bremer', '2011-06-07', { se: '32145678', pbs: [T('100 Free', '1:16.02', '2026-01-25')] })]);
  check('B1 the dashboard DOB was flipped, the Sheet\'s is right: ONE record, not two (nothing added, nothing "kept")', roster().length === 1 && r.added === 0 && r.kept === 0);
  check('B2 ...the Sheet\'s date of birth wins (it is authoritative)', roster()[0].dob === '2011-06-07');
  check('B3 ...the SE-imported PB is kept and the Sheet\'s PB is added', roster()[0].pbs.length === 2 && roster()[0].pbs.some(p => p.source === 'se') && roster()[0].pbs.some(p => p.time === '1:16.02'));
  check('B4 ...name, SE # and squad are preserved', roster()[0].se === '32145678' && roster()[0].squad === 'Senior' && roster()[0].id === 'sh_bremer__bib');
  check('B5 ...and the change is reported with both dates', r.dobChanges.length === 1 && r.dobChanges[0].name === 'Bib Bremer' && r.dobChanges[0].from === '2011-07-06' && r.dobChanges[0].to === '2011-06-07');
  check('B6 ...counted as an update, not a new swimmer', r.updated === 1 && r.matched === 0);
  r = sync([sheetSw('sh_bremer__bib', 'Bib Bremer', '2011-06-07', { se: '32145678', pbs: [T('100 Free', '1:16.02', '2026-01-25')] })]);
  check('B7 a second identical sync is an ordinary match: no DOB change, nothing updated (idempotent)', r.dobChanges.length === 0 && r.matched === 1 && r.updated === 0 && roster().length === 1);

  // the other direction: the DOB is corrected in the SHEET
  setRoster([local('sh_bremer__bib', 'Bib Bremer', '2011-06-07', { pbs: seBib })]);
  r = sync([sheetSw('sh_bremer__bib', 'Bib Bremer', '2011-06-08', { pbs: [] })]);
  check('B8 a DOB corrected in the Sheet (a day off) updates the existing record instead of adding a second', roster().length === 1 && roster()[0].dob === '2011-06-08' && roster()[0].pbs.length === 1 && r.dobChanges.length === 1);

  // ── C. what is NOT matched ──────────────────────────────────────────────
  setRoster([local('sh_bremer__bib', 'Bib Bremer', '2010-01-01', { pbs: seBib })]);
  r = sync([sheetSw('sh_bremer__bib', 'Bib Bremer', '2011-06-07')]);
  check('C1 a bigger difference is NOT matched (could be a different child): two records, as before', roster().length === 2 && r.added === 1 && r.kept === 1 && r.dobChanges.length === 0);
  check('C2 ...but the pair is reported so it is not silent', r.lookalikes.length === 1 && r.lookalikes[0].name === 'Bib Bremer' && r.lookalikes[0].localDob === '2010-01-01' && r.lookalikes[0].sheetDob === '2011-06-07');
  check('C3 ...and the two records have different ids (v2.12.6)', new Set(roster().map(s => s.id)).size === 2);
  setRoster([local('sw_123', 'Bib Bremer', '2011-07-06')]);
  r = sync([sheetSw('sh_bremer__bib', 'Bib Bremer', '2011-06-07')]);
  check('C4 a manually added swimmer (a different id) is not matched on name + near DOB alone', roster().length === 2 && r.dobChanges.length === 0 && r.lookalikes.length === 1);
  setRoster([local('sh_bremer__bib', 'Bib Bremer', '2011-07-06')]);
  r = sync([sheetSw('sh_bremer__bib', 'Bib  Bremer-Jones', '2011-06-07')]);
  check('C5 the same id but a different name is not matched', roster().length === 2 && r.dobChanges.length === 0);
  setRoster([local('sh_x', 'Bib Bremer', '2011-07-06'), local('sh_x', 'Bib Bremer', '2011-06-06')]);
  r = sync([sheetSw('sh_x', 'Bib Bremer', '2011-06-07')]);
  check('C6 two dashboard candidates (an ambiguous pairing) are not auto-matched', r.dobChanges.length === 0 && roster().length === 3);
  setRoster([local('sh_x', 'Bib Bremer', '2011-07-06')]);
  r = sync([sheetSw('sh_x', 'Bib Bremer', '2011-06-07'), sheetSw('sh_x', 'Bib Bremer', '2011-07-07')]);
  check('C7 two Sheet swimmers competing for one dashboard swimmer are not auto-matched', r.dobChanges.length === 0);
  setRoster([local('sh_bremer__bib', 'Bib Bremer', '2011-07-06')]);
  r = window.mergeSwimmers([sheetSw('sh_bremer__bib', 'Bib Bremer', '2011-06-07')], 'keep', { sourceIsAuthoritative: false });
  check('C8 a manual file upload-merge (not the Sheet) never pairs by a near DOB', roster().length === 2 && r.dobChanges.length === 0 && r.lookalikes.length === 0);

  // ── D. Keep / Hide / Remove ─────────────────────────────────────────────
  for (const mode of ['keep', 'hide', 'remove']) {
    setRoster([local('sh_bremer__bib', 'Bib Bremer', '2011-07-06', { pbs: seBib }), local('sh_gone', 'Gone Away', '2009-01-01')]);
    sync([sheetSw('sh_bremer__bib', 'Bib Bremer', '2011-06-07')], mode);
    const bib = roster().find(s => s.name === 'Bib Bremer');
    check(`D(${mode}) the DOB-corrected swimmer is matched, not hidden or removed, and keeps their PB`, !!bib && !bib.hidden && bib.dob === '2011-06-07' && bib.pbs.length === 1);
  }
  setRoster([local('sh_bremer__bib', 'Bib Bremer', '2011-07-06'), local('sh_gone', 'Gone Away', '2009-01-01')]);
  const toRemove = window.findSwimmersRemovedBySync([sheetSw('sh_bremer__bib', 'Bib Bremer', '2011-06-07')]);
  check('D4 the Remove warning lists only the swimmer who is really missing, not the DOB-corrected one', toRemove.length === 1 && toRemove[0].sw.name === 'Gone Away');

  // ── E. the sync message ─────────────────────────────────────────────────
  window.localStorage.setItem('coach_SYNC_URL', 'https://example.test/exec');
  doc.getElementById('syncTokenInput').value = 'test-token';
  window.eval('SYNC_RETRY_DELAY_MS = 5');
  async function runSync(sheetSwimmers) {
    window.fetch = async () => ({ ok: true, status: 200, statusText: 'OK', json: async () => ({ version: '2.4', build: BUILD, swimmers: sheetSwimmers }) });
    doc.getElementById('syncMergeMode').value = 'keep';
    await window.startSync();
    return doc.getElementById('syncStatus');
  }
  setRoster([local('sh_bremer__bib', 'Bib Bremer', '2011-07-06')]);
  let st = await runSync([sheetSw('sh_bremer__bib', 'Bib Bremer', '2011-06-07')]);
  check('E1 the message says the DOB differed, names the swimmer and both dates, and that the Sheet\'s date was used',
    /date of birth differed/.test(st.textContent) && /Bib Bremer/.test(st.textContent) && /6 Jul 2011/.test(st.textContent) && /7 Jun 2011/.test(st.textContent) && /Sheet's date was used/.test(st.textContent));
  check('E2 ...it holds the dialog open (age groups may change) and there is still just one swimmer', doc.getElementById('syncCloseBtn').style.display === '' && roster().length === 1);
  setRoster([local('sh_bremer__bib', 'Bib Bremer', '2010-01-01')]);
  st = await runSync([sheetSw('sh_bremer__bib', 'Bib Bremer', '2011-06-07')]);
  check('E3 an unmatched same-name pair is warned about, with both dates and what to do', /share a name/.test(st.textContent) && /1 Jan 2010/.test(st.textContent) && /7 Jun 2011/.test(st.textContent) && /same child/.test(st.textContent) && /ignore/.test(st.textContent));
  setRoster([local('sh_a', 'Cara Lee', '2012-02-02')]);
  st = await runSync([sheetSw('sh_a', 'Cara Lee', '2012-02-02')]);
  check('E4 an ordinary sync has neither note', !/date of birth differed/.test(st.textContent) && !/share a name/.test(st.textContent));
  window.__x = false;
  setRoster([local('sh_e', '<img src=x onerror="window.__x=true">', '2011-07-06')]);
  st = await runSync([sheetSw('sh_e', '<img src=x onerror="window.__x=true">', '2011-06-07')]);
  check('E5 hostile names are shown as inert text', st.children.length === 0 && window.__x === false);
  const many = [], sheetMany = [];
  for (let i = 0; i < 9; i++) { many.push(local('sh_m' + i, 'Swimmer Number' + i, '2011-07-06')); sheetMany.push(sheetSw('sh_m' + i, 'Swimmer Number' + i, '2011-06-07')); }
  setRoster(many);
  st = await runSync(sheetMany);
  check('E6 many DOB changes: first three listed, the rest summarised, message stays short', /9 swimmers/.test(st.textContent) && /and 6 more/.test(st.textContent) && st.textContent.length < 1500 && roster().length === 9);

  console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
  process.exit(failures ? 1 : 0);
}, 50);
