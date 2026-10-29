// probe_stage2.js - v2.12 Stage 2
//
// (1) Sheets sync now uses ONE definition of "same swimmer" shared with the SE import
//     (normaliseNameKey: NFKC, lower-case, whitespace collapsed) instead of lower-case + trim only
//     (known-bugs #10), with a pre-flight check that STOPS a sync (nothing changed) if two swimmers
//     would collapse to one key - otherwise one of them, and all their PBs, would be silently dropped.
// (2) SE import matcher: a date-of-birth / gender mismatch shows BOTH values (with a day/month-swap
//     hint), the summary lists swimmers whose DOB differs from the SE report, the suggested-match
//     wording about the SE # is accurate (known-bugs #12), and accents are folded when judging
//     whether two first names look alike.
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, process.env.INDEX_FILE || 'index.html'), 'utf8');
const dir = process.env.FIXTURE_DIR || __dirname;
const sampleRows = JSON.parse(fs.readFileSync(path.join(dir, 'se_sample_rows.json'), 'utf8'));
const countyQt = fs.readFileSync(path.join(dir, 'county_qt.json'), 'utf8');
const regionalQt = fs.readFileSync(path.join(dir, 'regional_qt.json'), 'utf8');

let failures = 0;
const check = (d, c) => { console.log(c ? 'PASS -' : 'FAIL -', d); if (!c) failures++; };

const dom = new JSDOM(html, {
  runScripts: 'dangerously', resources: 'usable', url: 'http://localhost/index.html',
  beforeParse(w) {
    w.localStorage.setItem('coach_COUNTY_QT_FULL', countyQt);
    w.localStorage.setItem('coach_REGIONAL_QT_FULL', regionalQt);
  },
});
const { window } = dom;

setTimeout(async () => {
  const doc = window.document;
  const T = (ev, time, date, source) => ({ event: ev, course: 'S', time, date, ...(source ? { source } : {}) });
  const BUILD = (html.match(/EXPECTED_SCRIPT_BUILD = '([^']+)'/) || [])[1];
  const sw = (id, name, dob, gender, extra) => ({ id, name, dob, gender, source: 'sheet', pbs: [], ...(extra || {}) });
  const setRoster = arr => window.eval(`SWIMMERS = ${JSON.stringify(arr)}`);

  // ── A. the shared key ───────────────────────────────────────────────────
  const key = n => window.swimmerSyncKey({ name: n, dob: '2013-10-18' });
  check('A1 case and surrounding spaces are ignored (as before)', key('  BOB baker ') === key('Bob Baker'));
  check('A2 INTERNAL whitespace is now ignored too (two spaces, a tab, a non-breaking space)', key('Bob  Baker') === key('Bob Baker') && key('Bob\tBaker') === key('Bob Baker') && key('Bob\u00a0Baker') === key('Bob Baker'));
  check('A3 a composed and a decomposed accent are the same name', key('Ren\u00e9e Lee') === key('Rene\u0301e Lee'));
  check('A4 different date of birth is a different swimmer', window.swimmerSyncKey({ name: 'Bob Baker', dob: '2013-10-18' }) !== window.swimmerSyncKey({ name: 'Bob Baker', dob: '2013-10-19' }));
  check('A5 a missing name does not throw', typeof window.swimmerSyncKey({ dob: '2013-10-18' }) === 'string');

  // ── B. sync matching and Remove use it ──────────────────────────────────
  setRoster([sw('l1', 'Bob Baker', '2013-10-18', 'Boys', { pbs: [T('50 Free', '30.00', '2026-01-01', 'manual')] })]);
  let r = window.mergeSwimmers([{ name: 'Bob  Baker', dob: '2013-10-18', gender: 'Boys', pbs: [T('100 Free', '65.00', '2026-02-01')] }], 'keep', { sourceIsAuthoritative: true, fullHistory: true });
  check('B1 a Sheet name with a stray double space MATCHES the dashboard swimmer (before: a duplicate swimmer was added)', r.added === 0 && window.eval('SWIMMERS.length') === 1);
  check('B2 ...and their manual PB is kept alongside the Sheet\'s', window.eval('SWIMMERS[0].pbs.length') === 2);
  setRoster([sw('l1', 'Bob Baker', '2013-10-18', 'Boys')]);
  const removed = window.findSwimmersRemovedBySync([{ name: 'bob\u00a0 baker', dob: '2013-10-18', gender: 'Boys', pbs: [] }]);
  check('B3 Remove\'s warning does not list a swimmer who only differs by spacing (it would have been deleted before)', removed.length === 0);
  setRoster([sw('l1', 'Bob Baker', '2013-10-18', 'Boys')]);
  window.mergeSwimmers([{ name: 'Bob  Baker', dob: '2013-10-18', gender: 'Boys', pbs: [] }], 'remove', { sourceIsAuthoritative: true });
  check('B4 ...and a Remove sync really keeps that swimmer', window.eval('SWIMMERS.length') === 1);

  // ── C. collisions: detection ────────────────────────────────────────────
  const dupes = window.findKeyCollisions([sw('a', 'Bob Baker', '2013-10-18', 'Boys'), sw('b', 'bob  baker', '2013-10-18', 'Boys'), sw('c', 'Bob Baker', '2012-01-01', 'Boys'), sw('d', 'Cara Lee', '2013-10-18', 'Girls')]);
  check('C1 two swimmers with the same normalised name AND date of birth are a collision', dupes.length === 1 && dupes[0].length === 2);
  check('C2 the same name with a different date of birth is not', window.findKeyCollisions([sw('a', 'Bob Baker', '2013-10-18', 'Boys'), sw('c', 'Bob Baker', '2012-01-01', 'Boys')]).length === 0);
  check('C3 an empty list is fine', window.findKeyCollisions([]).length === 0 && window.findKeyCollisions(null).length === 0);

  // ── D. collisions stop a sync, nothing changed ──────────────────────────
  window.localStorage.setItem('coach_SYNC_URL', 'https://example.test/exec');
  doc.getElementById('syncTokenInput').value = 'test-token';
  window.eval('SYNC_RETRY_DELAY_MS = 5');
  async function runSync(sheetSwimmers, mode) {
    window.fetch = async () => ({ ok: true, status: 200, statusText: 'OK', json: async () => ({ version: '2.4', build: BUILD, swimmers: sheetSwimmers }) });
    doc.getElementById('syncMergeMode').value = mode || 'keep';
    await window.startSync();
    return doc.getElementById('syncStatus');
  }
  window.localStorage.removeItem('coach_SHEETS_LAST_SYNC');
  const twinsLocal = [sw('a', 'Bob Baker', '2013-10-18', 'Boys', { pbs: [T('50 Free', '30.00', '2026-01-01', 'manual')] }), sw('b', 'bob  baker', '2013-10-18', 'Boys', { pbs: [T('50 Free', '31.00', '2026-01-02', 'manual')] })];
  setRoster(twinsLocal);
  const before = JSON.stringify(window.eval('SWIMMERS'));
  let st = await runSync([{ name: 'Bob Baker', dob: '2013-10-18', gender: 'Boys', pbs: [] }]);
  check('D1 two look-alike swimmers on the dashboard: the sync STOPS with an error, naming them and the date of birth, and how to fix it',
    /stopped/i.test(st.textContent) && /nothing was changed/i.test(st.textContent) && /Bob Baker/.test(st.textContent) && /18 Oct 2013/.test(st.textContent) && /Edit Swimmer/.test(st.textContent));
  check('D2 ...and nothing was changed (both swimmers and all PBs intact), no sync time recorded', JSON.stringify(window.eval('SWIMMERS')) === before && !window.localStorage.getItem('coach_SHEETS_LAST_SYNC'));
  check('D3 ...and the Sync button is usable again', doc.getElementById('syncBtn').disabled === false);
  setRoster([sw('a', 'Bob Baker', '2013-10-18', 'Boys')]);
  st = await runSync([{ name: 'Bob Baker', dob: '2013-10-18', gender: 'Boys', pbs: [] }, { name: 'bob  baker', dob: '2013-10-18', gender: 'Boys', pbs: [] }]);
  check('D4 two look-alike rows in the GOOGLE SHEET stop the sync too, and say to fix the Sheet', /stopped/i.test(st.textContent) && /Google Sheet/.test(st.textContent) && /Basic Data/.test(st.textContent) && window.eval('SWIMMERS.length') === 1);
  setRoster(twinsLocal);
  let confirms = 0; window.confirm = () => { confirms++; return true; };
  await runSync([{ name: 'Cara Lee', dob: '2013-10-18', gender: 'Girls', pbs: [] }], 'remove');
  check('D5 the check runs BEFORE the Remove confirmation (no delete prompt for a sync that is going to stop)', confirms === 0 && window.eval('SWIMMERS.length') === 2);
  setRoster([sw('a', 'Bob Baker', '2013-10-18', 'Boys'), sw('c', 'Cara Lee', '2013-10-18', 'Girls')]);
  st = await runSync([{ name: 'Bob Baker', dob: '2013-10-18', gender: 'Boys', pbs: [] }, { name: 'Cara Lee', dob: '2013-10-18', gender: 'Girls', pbs: [] }]);
  check('D6 a normal sync is unaffected', /synced/.test(st.textContent) && !/stopped/i.test(st.textContent));
  // direct callers of mergeSwimmers are protected too
  setRoster(twinsLocal);
  const blocked = window.mergeSwimmers([{ name: 'Bob Baker', dob: '2013-10-18', gender: 'Boys', pbs: [] }], 'keep', { sourceIsAuthoritative: true });
  check('D7 mergeSwimmers itself refuses (blocked, nothing changed) rather than silently dropping one of two look-alikes', blocked.blocked === true && window.eval('SWIMMERS.length') === 2);
  setRoster(twinsLocal);
  window.applySwimmersUpload([{ name: 'Bob Baker', dob: '2013-10-18', gender: 'Boys', pbs: [] }], 'merge', '');
  check('D8 a manual file Upload-Merge shows the same refusal as an error and changes nothing', window.eval('SWIMMERS.length') === 2 && /look like the same/i.test(doc.getElementById('dataError').textContent || ''));

  // ── E. matcher: both DOBs, swap hint, gender ────────────────────────────
  const seBib = { surname: 'Bremer', forename: 'Bib', fullName: 'Bib Bremer', dob: '2011-06-07', gender: 'Girls', se: '32145678' };
  let m = window.matchSeSwimmer(seBib, [sw('r', 'Bib Bremer', '2011-07-06', 'Girls', { se: '32145678' })]);
  check('E1 SE # matches but the DOB differs: still a suggestion, and the reason shows BOTH dates', m.status === 'confirm' && /6 Jul 2011/.test(m.reason) && /7 Jun 2011/.test(m.reason) && /roster/.test(m.reason) && /SE report/.test(m.reason));
  check('E2 ...a day/month swap is recognised and said so', /swapped/.test(m.reason) && m.dobMismatch && m.dobMismatch.swapped === true && m.dobMismatch.roster === '2011-07-06' && m.dobMismatch.se === '2011-06-07');
  m = window.matchSeSwimmer(seBib, [sw('r', 'Bib Bremer', '2010-01-01', 'Girls', { se: '32145678' })]);
  check('E3 a different DOB that is not a swap shows both dates without the swap claim', m.status === 'confirm' && /1 Jan 2010/.test(m.reason) && !/swapped/.test(m.reason) && m.dobMismatch.swapped === false);
  m = window.matchSeSwimmer({ ...seBib, dob: '2011-11-11' }, [sw('r', 'Bib Bremer', '2011-11-12', 'Girls', { se: '32145678' })]);
  check('E4 dates that cannot be a swap (same day and month digits differ) are not called a swap', m.dobMismatch && m.dobMismatch.swapped === false);
  m = window.matchSeSwimmer(seBib, [sw('r', 'Bib Bremer', '2011-06-07', 'Boys', { se: '32145678' })]);
  check('E5 a gender-only mismatch names both genders and has no DOB mismatch', m.status === 'confirm' && /roster Boys, SE report Girls/.test(m.reason) && m.dobMismatch === null);
  m = window.matchSeSwimmer(seBib, [sw('r', 'Bib Bremer', '2011-07-06', 'Boys', { se: '32145678' })]);
  check('E6 both differ: both are described', /date of birth differs/.test(m.reason) && /gender differs/.test(m.reason));
  m = window.matchSeSwimmer(seBib, [sw('r', 'Bib Bremer', '2011-06-07', 'Boys')]);
  check('E7 name + DOB match with a different gender (no SE #) also names both genders', m.status === 'confirm' && /roster Boys, SE report Girls/.test(m.reason));
  m = window.matchSeSwimmer(seBib, [sw('r', 'Bib Bremer', '2011-06-07', 'Girls', { se: '32145678' })]);
  check('E8 an exact match is unchanged: auto-matched, no mismatch', m.status === 'matched-se' && !m.dobMismatch);

  // ── F. accent folding in first-name similarity only ─────────────────────
  const seArty = { surname: 'Sushinski', forename: 'Artyom', fullName: 'Artyom Sushinski', dob: '2014-09-22', gender: 'Boys', se: '9990999' };
  m = window.matchSeSwimmer(seArty, [sw('r', 'Artyóm Sushinski', '2014-09-22', 'Boys')]);
  check('F1 Artyóm vs Artyom: now a LIKELY match (was needs-review)', m.status === 'confirm' && m.confidence === 'high');
  m = window.matchSeSwimmer(seArty, [sw('r', 'Art\u0079\u006f\u0301m Sushinski', '2014-09-22', 'Boys')]);
  check('F2 a decomposed accent is folded the same way', m.status === 'confirm' && m.confidence === 'high');
  m = window.matchSeSwimmer(seArty, [sw('r', 'Artyóm Sushinski', '2014-09-22', 'Boys')]);
  check('F3 ...but it is still only a SUGGESTION: folding never makes a name auto-match', m.status !== 'matched-name' && m.status !== 'matched-se');
  m = window.matchSeSwimmer(seArty, [sw('r', 'Robert Sushinski', '2014-09-22', 'Boys')]);
  check('F4 an unrelated first name is still low confidence', m.status === 'confirm' && m.confidence === 'low');

  // ── G. wizard: wording (#12), DOB mismatch in review and summary ─────────
  const scFile = new window.File(['__SC__'], 'sc.xlsx');
  const setInputFiles = (el, files) => Object.defineProperty(el, 'files', { value: Object.assign({ length: files.length, item: i => files[i] }, files), configurable: true });
  window.readXlsxRows = async () => ({ sheetName: 'x', rows: sampleRows.sc });
  setRoster([sw('rb', 'Bib Bremer', '2011-07-06', 'Girls', { se: '32145678', squad: 'Senior' })]);
  window.showSeImportModal();
  setInputFiles(doc.getElementById('seImportFileInput'), [scFile]);
  await window.handleSeImportFileChange();
  const body = () => doc.getElementById('seImportBody').innerHTML;
  const bibIdx = window.eval('_seImport.matches').findIndex(x => x.se.se === '32145678');
  check('G1 the review shows both dates of birth for the suggested match', /6 Jul 2011/.test(body()) && /7 Jun 2011/.test(body()) && /swapped/.test(body()));
  check('G2 the explanation of ticking no longer claims the SE # is never changed (#12)', /never changes their Name, Date of Birth or Gender/.test(body()) && /no SE # on the dashboard[^.]*filled in/.test(body()) && !/Gender, or SE #/.test(body()));
  window.seSetConfirmAccepted(bibIdx, true);
  window.seApplyImport();
  const res = window.eval('_seImport.result');
  check('G3 the summary records the swimmer whose DOB differs, with both dates and the swap flag', res.dobMismatches.length === 1 && res.dobMismatches[0].name === 'Bib Bremer' && res.dobMismatches[0].swapped === true);
  check('G4 the summary tells the coach, names the swimmer and both dates, and says to fix the Google Sheet', /Bib Bremer/.test(body()) && /6 Jul 2011/.test(body()) && /7 Jun 2011/.test(body()) && /Google Sheet/.test(body()) && /not changed/i.test(body()));
  check('G5 the dashboard\'s date of birth was NOT changed by the import', window.eval('SWIMMERS[0].dob') === '2011-07-06');
  window.hideSeImportModal();
  setRoster([sw('rb', 'Bib Bremer', '2011-06-07', 'Girls', { se: '32145678' })]);
  window.showSeImportModal();
  setInputFiles(doc.getElementById('seImportFileInput'), [scFile]);
  await window.handleSeImportFileChange();
  window.seApplyImport();
  check('G6 an exact match produces no date-of-birth note in the summary', window.eval('_seImport.result.dobMismatches.length') === 0 && !/date of birth differs/i.test(body()));
  window.hideSeImportModal();

  console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
  process.exit(failures ? 1 : 0);
}, 50);
