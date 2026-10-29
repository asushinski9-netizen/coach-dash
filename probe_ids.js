// probe_ids.js - v2.12 (UAT V3 follow-up)
//
// Two swimmer records can end up with the SAME id: the Apps Script derives a swimmer's id from the
// Sheet name only, so when a sync cannot match a dashboard swimmer (e.g. the date of birth differs) the
// Sheet's swimmer is added as new with the same id as the kept dashboard one. Everything that looks a
// swimmer up by id (Edit, Delete) then acts on the wrong record: both Edit dialogs showed the first
// record's data, and Delete removed BOTH. Ids must be unique; existing duplicates are repaired on load.
// Also (UAT general i): the Manage Data status line ("Cleared all swimmers") must not linger when another
// operation (Sync, SE import) is started from that modal.
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, process.env.INDEX_FILE || 'index.html'), 'utf8');

let failures = 0;
const check = (d, c) => { console.log(c ? 'PASS -' : 'FAIL -', d); if (!c) failures++; };

const dupRoster = [
  { id: 'sh_bremer__bib', name: 'Bib Bremer', dob: '2011-07-06', gender: 'Girls', source: 'local', pbs: [{ event: '50 Free', course: 'S', time: '36.06', date: '2025-02-22', source: 'se' }] },
  { id: 'sh_bremer__bib', name: 'Bib Bremer', dob: '2011-06-07', gender: 'Girls', source: 'sheet', pbs: [] },
  { id: 'sh_baker__bob', name: 'Bob Baker', dob: '2013-10-18', gender: 'Boys', source: 'sheet', pbs: [] },
];
const dom = new JSDOM(html, {
  runScripts: 'dangerously', resources: 'usable', url: 'http://localhost/index.html',
  beforeParse(w) { w.localStorage.setItem('coach_SWIMMERS', JSON.stringify(dupRoster)); },
});
const { window } = dom;

setTimeout(async () => {
  const doc = window.document;
  const ids = () => window.eval('SWIMMERS').map(s => s.id);
  const unique = a => new Set(a).size === a.length;

  // ── A. repair on load (the coach's data already has duplicates) ──────────
  check('A1 duplicate ids already in storage are repaired when the dashboard loads', unique(ids()) && window.eval('SWIMMERS.length') === 3);
  check('A2 ...and the repaired ids are saved back', unique(JSON.parse(window.localStorage.getItem('coach_SWIMMERS')).map(s => s.id)));
  const bibs = window.eval('SWIMMERS').filter(s => s.name === 'Bib Bremer');
  check('A3 the Sheet-sourced record keeps the original id (it is the one a sync will keep matching); the other gets a new one',
    bibs.find(s => s.source === 'sheet').id === 'sh_bremer__bib' && bibs.find(s => s.source === 'local').id !== 'sh_bremer__bib');
  check('A4 no record lost or changed apart from the id (DOBs and PBs intact)', bibs.length === 2 && bibs.some(s => s.dob === '2011-07-06' && s.pbs.length === 1) && bibs.some(s => s.dob === '2011-06-07'));

  // ── B. the function itself ──────────────────────────────────────────────
  const mk = (id, source) => ({ id, source, name: 'x' });
  let list = [mk('a', 'sheet'), mk('a', 'local'), mk('a', 'sheet'), mk('a_2', 'sheet')];
  let n = window.ensureUniqueIds(list);
  check('B1 three records sharing an id (with an "a_2" already taken) all end up unique', unique(list.map(s => s.id)) && n === 2 && list.filter(s => s.id === 'a').length === 1);
  list = [mk('a', 'local'), mk('a', 'sheet')];
  window.ensureUniqueIds(list);
  check('B2 the first non-local record keeps the id', list[1].id === 'a' && list[0].id !== 'a');
  list = [mk('a', 'local'), mk('a', 'local')];
  window.ensureUniqueIds(list);
  check('B3 with no Sheet record, the first keeps it', list[0].id === 'a' && list[1].id !== 'a');
  list = [mk('a', 'sheet'), mk('b', 'sheet')];
  check('B4 already-unique ids are left alone and report 0 changes', window.ensureUniqueIds(list) === 0 && list[0].id === 'a' && list[1].id === 'b');
  list = [{ name: 'no id' }, { name: 'also none' }, mk('', 'sheet')];
  check('B5 records with a missing/empty id get one', window.ensureUniqueIds(list) === 3 && unique(list.map(s => s.id)) && list.every(s => typeof s.id === 'string' && s.id));
  check('B6 non-array input does not throw', window.ensureUniqueIds(null) === 0 && window.ensureUniqueIds(undefined) === 0);

  // ── C. the sync scenario from UAT V3 (with a DOB too different to pair; see probe_dobmatch.js for the near-DOB case) ──
  // A DOB that differs by MORE than a one-field correction or a day/month swap, so the sync (which since
  // known-bugs #25 pairs near-identical DOBs) still cannot match them: the unmatched case this guards.
  window.eval(`SWIMMERS = [{ id:'sh_bremer__bib', name:'Bib Bremer', dob:'2010-01-01', gender:'Girls', source:'sheet', se:'32145678', pbs:[{event:'50 Free',course:'S',time:'36.06',date:'2025-02-22',source:'se'}] }]`);
  const sheet = [{ id: 'sh_bremer__bib', name: 'Bib Bremer', dob: '2011-06-07', gender: 'Girls', source: 'sheet', se: '32145678', pbs: [{ event: '100 Free', course: 'S', time: '1:16.02', date: '2026-01-25' }] }];
  window.mergeSwimmers(sheet, 'keep', { sourceIsAuthoritative: true, fullHistory: true });
  const after = window.eval('SWIMMERS');
  check('C1 after a sync that cannot match (DOB differs) the two records have different ids', after.length === 2 && unique(after.map(s => s.id)));
  const [r1, r2] = after;
  window.editSwimmer(r1.id); const d1 = doc.getElementById('asDOB').value; window.hideAddSwimmerModal();
  window.editSwimmer(r2.id); const d2 = doc.getElementById('asDOB').value; window.hideAddSwimmerModal();
  check('C2 each record\'s Edit dialog shows ITS OWN date of birth (was: both showed the first record\'s)', d1 === r1.dob && d2 === r2.dob && d1 !== d2);
  window.confirm = () => true;
  window.deleteSwimmer(r2.id);
  check('C3 deleting one of them deletes exactly one (was: both)', window.eval('SWIMMERS.length') === 1 && window.eval('SWIMMERS[0].id') === r1.id);

  // ── D. other ways in ────────────────────────────────────────────────────
  const dupUpload = [
    { id: 'u1', name: 'Amy Carter', dob: '2013-09-23', gender: 'Girls', pbs: [] },
    { id: 'u1', name: 'Amy Carter', dob: '2013-09-24', gender: 'Girls', pbs: [] },
  ];
  window.applySwimmersUpload(dupUpload, 'replace', '');
  check('D1 a file upload (Replace) with duplicate ids is repaired', unique(ids()) && window.eval('SWIMMERS.length') === 2);
  window.eval('SWIMMERS = []');
  window.applyBackupRestore({ swimmersResult: { clean: dupUpload.map(s => ({ ...s })), skipped: 0, datesDropped: 0, seDropped: 0, pbSourceDropped: 0 }, countyParsed: null, countyResult: null, regionalParsed: null, regionalResult: null });
  check('D2 a backup restore with duplicate ids is repaired', unique(ids()) && window.eval('SWIMMERS.length') === 2);

  // ── E. UAT general (i): a stale Manage Data status must not linger ───────
  const status = () => doc.getElementById('dataStatus');
  window.setDataStatus('success', '✅ Cleared all 62 swimmer(s).');
  check('E0 fixture: the message is showing', status().style.display === 'block' && /Cleared/.test(status().textContent));
  window.showSyncModal();
  check('E1 starting a Google Sheets sync from Manage Data clears the old status', status().style.display === 'none' && status().textContent === '');
  window.hideSyncModal();
  window.setDataStatus('success', '✅ Cleared all 62 swimmer(s).');
  window.showSeImportModal();
  check('E2 starting an SE import clears it too', status().style.display === 'none' && status().textContent === '');
  window.hideSeImportModal();
  window.setDataError('Error: something old');
  window.showSyncModal();
  check('E3 an old error line is cleared as well', doc.getElementById('dataError').style.display === 'none');
  window.hideSyncModal();
  check('E4 the docked status area collapses (no empty bar left behind)', !doc.getElementById('dataModalStatusDock').classList.contains('dock-visible'));

  console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
  process.exit(failures ? 1 : 0);
}, 50);
