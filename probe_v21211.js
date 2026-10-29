// probe_v21211.js - v2.12.11: swimmer name always on its own row above the buttons (conflicts and
// duplicates); explainer note for Time conflicts; an orange note for EVERY time difference (faster or
// slower); orange note when several same-time entries are on file.
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
const NAME = 'Alexandra Shchupak-Montgomery Featherstonehaugh';
const P = (ev, t, d, src) => ({ event: ev, course: 'S', time: t, date: d, ...(src ? { source: src } : {}) });
const hdr = ['Rank', 'Event', 'Best Time', 'P/F/T', 'Date', 'Meet Name'];
const seRows = (ev, t, d) => [hdr, ['Shchupak-Montgomery Featherstonehaugh, Alexandra: 12/10/2014  (Open/Girl 11) 1234567', '', '', '', '', ''], ['1', ev, t + 'S', 'F', d, 'Meet']];
const file = new w.File(['x'], 'sc.xlsx');
const setFiles = (el, f) => Object.defineProperty(el, 'files', { value: Object.assign({ length: f.length, item: i => f[i] }, f), configurable: true });
async function load(pbs, rows) {
  w.eval('SWIMMERS=' + JSON.stringify([{ id: 'a', name: NAME, dob: '2014-10-12', gender: 'Girls', source: 'sheet', se: '1234567', pbs }]));
  w.readXlsxRows = async () => ({ sheetName: 'x', rows });
  w.showSeImportModal(); setFiles(doc.getElementById('seImportFileInput'), [file]); await w.handleSeImportFileChange();
}
const warns = () => [...doc.querySelectorAll('#seImportBody .se-note-warn')].map(n => n.textContent.replace(/\s+/g, ' ').trim());
const body = () => doc.getElementById('seImportBody').textContent.replace(/\s+/g, ' ');

setTimeout(async () => {
  // ── layout: name on its own row, buttons on the next, in BOTH sections ──
  await load([P('200 Free', '3:13.52', '2025-11-29'), P('200 Free', '3:13.52', '2026-07-05')], seRows('200 Free', '3:11.36', '05/07/2026'));
  let row = doc.querySelector('#seImportBody [data-keep="conflicts"] .pb-event-row');
  check('conflicts: first child is the name row, containing the full (long) swimmer name', row.children[0].classList.contains('se-row-name') && row.children[0].textContent.trim() === NAME);
  check('conflicts: the second child is the button row with the 3 bulk buttons, outside the name row', row.children[1].classList.contains('se-row-buttons') && row.children[1].querySelectorAll('button').length === 3 && !row.children[0].querySelector('button'));
  w.hideSeImportModal();
  await load([P('50 Free', '43.50', '2025-07-01', 'gala'), P('50 Free', '43.50', '2025-09-28', 'gala')], seRows('50 Free', '43.50', '22/02/2025'));
  row = doc.querySelector('#seImportBody [data-keep="dups"] .pb-event-row');
  check('duplicates: name row first, then the button row with the 3 bulk buttons', row.children[0].classList.contains('se-row-name') && row.children[0].textContent.trim() === NAME && row.children[1].classList.contains('se-row-buttons') && row.children[1].querySelectorAll('button').length === 3);
  check('CSS: bulk buttons never wrap their text, the button row may wrap as a whole, long names break', /\.se-row-buttons \.fbtn\s*\{[^}]*white-space:\s*nowrap/.test(html) && /\.se-row-buttons\s*\{[^}]*flex-wrap:\s*wrap/.test(html) && /\.se-row-name\s*\{[^}]*overflow-wrap:\s*anywhere/.test(html));
  check('CSS: the warning note class is orange (the existing gold/amber colour)', /\.se-note-warn\s*\{[^}]*color:\s*var\(--gold\)/.test(html));

  // ── Nicola-type orange note ──
  const nw = warns().find(t => /entries on file have this time/.test(t));
  check('duplicates with 2 same-time entries: orange note names both dates and the SE date', !!nw && /2 entries on file have this time/.test(nw) && /1 Jul 2025/.test(nw) && /28 Sep 2025/.test(nw) && /22 Feb 2025/.test(nw));
  w.hideSeImportModal();
  await load([P('50 Free', '43.50', '2025-07-01', 'gala')], seRows('50 Free', '43.50', '22/02/2025'));
  check('a single same-time entry gets no such note', !warns().some(t => /entries on file have this time/.test(t)));
  w.hideSeImportModal();

  // ── Time conflicts: explainer ──
  await load([P('50 Free', '30.37', '2026-07-05', 'gala')], seRows('50 Free', '30.75', '05/07/2026'));
  check('Time conflicts has an explainer note (same date, different times; nothing changes until Apply)', /same date but with different times/.test(body()) && /Nothing is changed until you click Apply/.test(body()));

  // ── Jager: SE slower than the best on file ──
  let jw = warns().find(t => /slower/.test(t));
  check('SE time slower than the best on file: orange note with the gap and the best time', !!jw && /SE time is 0\.38s slower than the best on file \(30\.37\)/.test(jw));
  check('...and, because the on-file swim IS the best, it warns Use SE report would make the best slower', /would make your best time on file slower/.test(jw));
  check('the slower note does not use the word "faster"', !/faster/.test(jw));
  w.hideSeImportModal();
  await load([P('50 Free', '30.37', '2026-03-01', 'gala'), P('50 Free', '30.60', '2026-07-05', 'gala')], seRows('50 Free', '30.75', '05/07/2026'));
  jw = warns().find(t => /slower/.test(t));
  check('when the on-file swim being conflicted is NOT the best, the slower note appears without the "make your best slower" warning', !!jw && /30\.37/.test(jw) && !/would make your best time on file slower/.test(jw));
  w.hideSeImportModal();

  // ── faster note and Amy's repeat line are orange too ──
  await load([P('200 Free', '3:13.52', '2025-11-29'), P('200 Free', '3:13.52', '2026-07-05')], seRows('200 Free', '3:11.36', '05/07/2026'));
  const ws = warns();
  check('faster SE time: the note is orange (se-note-warn)', ws.some(t => /SE time is 2\.16s faster/.test(t)));
  check('"also on file on" repeat line is orange too', ws.some(t => /also on file on 29 Nov 2025/.test(t)));
  w.hideSeImportModal();
  await load([P('50 Free', '30.37', '2026-07-05', 'gala')], seRows('50 Free', '30.75', '05/07/2026'));
  check('no repeat line when the on-file time is not repeated', !warns().some(t => /also on file on/.test(t)));
  w.hideSeImportModal();
  console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
  process.exit(failures ? 1 : 0);
}, 100);
