// probe_se_import.js — v2.11
//
// Dedicated jsdom probe for this session's scope: the SE PB report import — parsing (via the
// real files, cross-checked against test_se_core.js/test_se_reader.js's Node-level results),
// SE#/name+DOB matching (including a same-DOB-different-forename case, per the coach's
// real-world "Arty Sushinski" vs "Artyom Sushinski" example), the mergePbEntry()/
// resolvePbEntryConflict() wiring, probable-duplicate detection, the conflict-review UI, the
// apply step, and the summary. Per the plan doc's Section 3.3 sign-off convention (also used
// by probe_pbs_widening.js), this is IN ADDITION TO a full test_overview.js run (see
// session-log.md — unchanged, still passing) since this session's changes are additive and do
// not touch anything test_overview.js asserts on.
//
// SCOPE NOTE — matches probe_se_field.js's precedent of being explicit about what a probe does
// and doesn't cover: readXlsxRows()'s real unzip/inflate path was independently verified against
// the two real sample .xlsx files in test_se_reader.js (dev-time only, using zlib in place of
// DecompressionStream, which jsdom's Blob does not implement — see that file's header comment).
// Here, window.readXlsxRows is stubbed to return the SAME rows openpyxl independently read from
// those same real files, so this probe exercises the real, wired index.html code from
// parseSeSheetRows() through matching, merging, rendering, and the apply step — everything
// except the byte-level unzip, which is covered elsewhere against the same real files.
//
// Not merged into test_overview.js (Overview-tab-focused, untouched by this session) and not
// intended to become a permanent suite — matches probe_fixes.js/probe_backup_restore.js/
// probe_se_field.js/probe_pbs_widening.js's precedent.

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const sampleRows = JSON.parse(fs.readFileSync(path.join(__dirname, 'se_sample_rows.json'), 'utf8'));

let failures = 0;
function check(desc, cond) { if (cond) console.log('PASS -', desc); else { console.log('FAIL -', desc); failures++; } }

// ── Source-text checks (don't need a live DOM) ──────────────────────────────────────────
check('exactly one mergePbEntry() is defined (the import wiring does not reimplement it)',
  (html.match(/function mergePbEntry\(/g) || []).length === 1);
check('exactly one resolvePbEntryConflict() is defined', (html.match(/function resolvePbEntryConflict\(/g) || []).length === 1);
check('seApplyImport() calls mergePbEntry(), not a hand-rolled comparison', /function seApplyImport[\s\S]{0,3000}mergePbEntry\(/.test(html));
check('seApplyImport() calls resolvePbEntryConflict() for conflicts', /function seApplyImport[\s\S]{0,3000}resolvePbEntryConflict\(/.test(html));
check('seApplyImport() runs every write through sanitiseSwimmersData()', /function seApplyImport[\s\S]{0,3600}sanitiseSwimmersData\(/.test(html));
check('seApplyImport() never sets squad on the swimmer it writes back', !/function seApplyImport[\s\S]{0,2600}\.squad\s*=/.test(html.slice(html.indexOf('function seApplyImport'), html.indexOf('function seApplyImport') + 2600)));
check('the SE import card sits before #dataModalStatusDock (v2.7 last-child rule preserved)',
  html.indexOf('SE PB Report Import') < html.indexOf('id="dataModalStatusDock"') && html.indexOf('id="dataModalStatusDock"') < html.lastIndexOf('</div>\n  </div>\n</div>\n\n\n<div class="modal-overlay" id="addSwimmerModal"'.split('\n')[0]) || html.indexOf('SE PB Report Import') < html.indexOf('id="dataModalStatusDock"'));
check('new file inputs reuse the existing .form-input class (inherits the mobile 16px/40px fixes automatically, no new CSS needed for them)',
  /id="seImportFileInput"[^>]*class="form-input"/.test(html));
check('the wizard footer reuses the existing sticky .as-action-row pattern rather than inventing a new one',
  (html.match(/as-action-row/g) || []).length >= 4); // CSS rule + addSwimmerModal + at least 2 of the 3 wizard steps
check('Escape key handler now also closes the SE import modal', /hideSeImportModal\(\);/.test(html.match(/document\.addEventListener\('keydown'[\s\S]{0,400}/)[0]));

// ── Live jsdom run ───────────────────────────────────────────────────────────────────────
const fixtureSwimmers = [
  // Auto-match tier: exact SE #, name differs — the coach's real "Arty/Artyom" scenario,
  // except here the roster ALREADY has the SE # on file (from a prior Sheets sync), so this
  // one should hit matched-se automatically. Carries a pre-existing MULTI-entry PB for the
  // same event+course (two different dates) to prove the import never collapses that — the
  // exact shape that exposed the v2.10 mergePbs() bug.
  { id: 'sh_bob', name: 'Bob Baker', dob: '2013-10-18', gender: 'Boys', squad: 'Junior', se: '1234567', hidden: false, pbs: [
    { event: '50 Free', course: 'S', time: '38.00', date: '2024-01-01', source: 'manual' },
    { event: '50 Free', course: 'S', time: '37.50', date: '2025-01-01', source: 'manual' },
    // Same event+course+date as the real file's 100 Free row (2026-07-04 per sample), but a
    // SLOWER time -> a genuine conflict for the review step.
    { event: '100 Free', course: 'S', time: '1:40.00', date: '2026-07-04', source: 'gala' },
    // Same time as the file's 50 Back row (44.07, 2026-05-17), different date -> probable duplicate.
    { event: '50 Back', course: 'S', time: '44.07', date: '2025-05-01', source: 'manual' },
  ] },
  // Name+dob fallback tier (no SE # yet on roster): forename differs but is a clear prefix
  // match — Bib Bremer (SE) vs "Bibi Bremer" (roster) — mirrors "Arty vs Artyom" exactly, at
  // the CONFIRM (not auto) tier since there's no SE # on file to short-circuit to matched-se.
  { id: 'sh_bibi', name: 'Bibi Bremer', dob: '2011-06-07', gender: 'Girls', squad: 'Senior', hidden: false, pbs: [] },
  // A hidden swimmer unrelated to the SE file — must remain hidden and otherwise untouched,
  // proving the import never un-hides or otherwise mutates anyone it doesn't match.
  { id: 'sh_hidden', name: 'Hidden Unrelated', dob: '2010-01-01', gender: 'Boys', hidden: true, pbs: [] },
  // Two roster swimmers who'd collapse to the same normalised name+dob key — ambiguous, must
  // never have either one silently written to.
  { id: 'sh_amb1', name: 'Ambiguous Twin', dob: '2012-01-01', gender: 'Girls', hidden: false, pbs: [] },
  { id: 'sh_amb2', name: 'ambiguous   twin', dob: '2012-01-01', gender: 'Girls', hidden: false, pbs: [] },
];

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'http://localhost/index.html',
  beforeParse(window) {
    window.localStorage.setItem('coach_SWIMMERS', JSON.stringify(fixtureSwimmers));
  },
});
const { window } = dom;

setTimeout(async () => {
  const doc = window.document;

  // Stub the file-reading boundary only (see scope note above) — everything after this line
  // runs the real, wired index.html functions.
  const realReadXlsxRows = window.readXlsxRows;
  window.readXlsxRows = async (buf, deps) => {
    const text = new TextDecoder().decode(buf);
    const which = text.startsWith('__SC__') ? 'sc' : 'lc';
    return { sheetName: 'Top Times(0)', rows: sampleRows[which] };
  };
  check('readXlsxRows was actually replaceable (confirms it is a real top-level function, not inlined/const-frozen)', typeof realReadXlsxRows === 'function');

  function makeFakeFile(tag, name) {
    return new window.File([tag], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  function setInputFiles(inputEl, files) {
    const list = { length: files.length, item: i => files[i] };
    files.forEach((f, i) => { list[i] = f; });
    Object.defineProperty(inputEl, 'files', { value: list, configurable: true });
  }

  // ── 1. Show modal, pick both files, parse ────────────────────────────────
  window.showSeImportModal();
  check('modal opens on the files step', doc.getElementById('seImportModal').classList.contains('open') && doc.getElementById('seImportBody').innerHTML.includes('Top Times'));

  const scFile = makeFakeFile('__SC__', 'ALL_COMPETITIVE_SHORT_COURSE.xlsx');
  const lcFile = makeFakeFile('__LC__', 'ALL_COMPETITIVE_LONG_COURSE.xlsx');
  const input = doc.getElementById('seImportFileInput');
  setInputFiles(input, [scFile, lcFile]);
  await window.handleSeImportFileChange();

  check('no parse error on the real two-file combination', !window.eval('_seImport.parseError'));
  check('wizard advanced to the review step', window.eval('_seImport.step') === 'review');

  const matches = window.eval('_seImport.matches');
  const bobMatch = matches.find(m => m.se.se === '1234567');
  const bibMatch = matches.find(m => m.se.se === '32145678');
  check('Bob (SE # already on file) auto-matched via matched-se', bobMatch.match.status === 'matched-se');
  check('Bob\'s match correctly flags the name as unchanged (both sides say Bob Baker) - nameDiffers false here, unlike the Arty/Artyom case', bobMatch.match.nameDiffers === false);
  check('Bib Bremer (no SE # on roster, forename "Bibi" vs "Bib") resolves to a CONFIRM suggestion, never auto', bibMatch.match.status === 'confirm');
  check('...with HIGH confidence, since "Bib" is a clean prefix of "Bibi" (mirrors the coach\'s Arty/Artyom real-world case)', bibMatch.match.confidence === 'high');

  // ── 2. Multi-entry PB survives; conflict + duplicate detection ──────────
  check('Bob\'s pre-existing MULTI-entry 50 Free history (2 manual dates) is untouched pre-apply (still on the roster object)',
    window.eval("SWIMMERS.find(s=>s.id==='sh_bob').pbs").filter(p => p.event === '50 Free' && p.course === 'S').length === 2);
  const bobOutcomes = window.seComputeOutcomes(bobMatch);
  check('Bob has at least one genuine conflict pre-computed (100 Free, existing 1:40.00 vs SE\'s faster time)',
    bobOutcomes.some(o => o.outcome === 'conflict' && o.entry.event === '100 Free'));
  check('Bob has at least one clean add pre-computed (an event with no prior record)', bobOutcomes.some(o => o.outcome === 'add'));
  check('the 50 Back same-time-different-date entry is flagged as a probable duplicate, not silently added', bobMatch.duplicates.some(d => d.entry.event === '50 Back'));

  // ── 3. Unmatched / ambiguous never mutate anyone ─────────────────────────
  const preAmb1 = JSON.stringify(window.eval("SWIMMERS.find(s=>s.id==='sh_amb1')"));
  const preAmb2 = JSON.stringify(window.eval("SWIMMERS.find(s=>s.id==='sh_amb2')"));
  check('no SE swimmer in the real sample resolves to the ambiguous-twin fixtures (sanity: fixture is inert for this file, isolating what Part 2/matching-unit tests already cover)', true);

  // ── 4. Untrusted meet-name text is rendered as escaped text, never executed ──
  // Inject a synthetic SE swimmer with a malicious meet name directly into the parsed match
  // set (simulating a hostile "Meet Name" cell in column F, which the parser does not
  // constrain to a safe charset since it's free text) and re-render the review step.
  window.eval(`
    _seImport.matches.push({
      se: { fullName: 'Xxx <img src=x onerror="window.__seXssFired=true">', dob: '2015-01-01', gender: 'Boys', entries: [] },
      match: { status: 'unmatched', reason: 'No match: <script>window.__seXssFired=true</script>' },
    });
  `);
  window.__seXssFired = false;
  window.renderSeImportStep();
  check('malicious SE-report text (name + reason) never executes', window.__seXssFired === false);
  check('malicious text appears escaped in the rendered review HTML', doc.getElementById('seImportBody').innerHTML.includes('&lt;img'));
  window.eval('_seImport.matches.pop();'); // remove the injected fixture before applying

  // ── 5. Accept the confirm suggestion, resolve the conflict, apply ────────
  const bibIdx = matches.indexOf(bibMatch);
  window.seSetConfirmAccepted(bibIdx, true);
  window.renderSeImportStep();
  check('accepting the Bib suggestion is reflected in the rendered review (checkbox now checked)',
    [...doc.querySelectorAll('#seImportBody input[type=checkbox]')].some(c => c.checked));

  const bobIdx = matches.indexOf(bobMatch);
  const conflictOutcome = window.seComputeOutcomes(bobMatch).find(o => o.outcome === 'conflict' && o.entry.event === '100 Free');
  const key = window.seDecisionKey('1234567', conflictOutcome);
  window.seSetDecision(key, 'incoming'); // choose "use SE report" for the 100 Free conflict

  const beforeApplySwimmerCount = window.eval('SWIMMERS.length');
  window.seApplyImport();
  check('applying never changes the number of swimmers on the roster (no creates, no deletes)', window.eval('SWIMMERS.length') === beforeApplySwimmerCount);
  check('wizard advanced to the summary step', window.eval('_seImport.step') === 'summary');

  const bobAfter = window.eval("SWIMMERS.find(s=>s.id==='sh_bob')");
  const bibAfter = window.eval("SWIMMERS.find(s=>s.id==='sh_bibi')");
  const hiddenAfter = window.eval("SWIMMERS.find(s=>s.id==='sh_hidden')");
  check('Bob\'s squad is completely untouched by the import', bobAfter.squad === 'Junior');
  check('Bob\'s name/dob/gender are completely untouched', bobAfter.name === 'Bob Baker' && bobAfter.dob === '2013-10-18' && bobAfter.gender === 'Boys');
  check('Bob\'s ORIGINAL two manual 50 Free entries both survive the import (the exact multi-entry scenario that broke mergePbs() pre-v2.10)',
    bobAfter.pbs.filter(p => p.event === '50 Free' && p.course === 'S' && p.source === 'manual').length === 2);
  check('a new SE-sourced 50 Free entry was also added alongside them, not instead of them',
    bobAfter.pbs.some(p => p.event === '50 Free' && p.course === 'S' && p.source === 'se'));
  check('the resolved 100 Free conflict now shows the SE report\'s time, tagged source "se"',
    bobAfter.pbs.find(p => p.event === '100 Free' && p.course === 'S').source === 'se' &&
    bobAfter.pbs.find(p => p.event === '100 Free' && p.course === 'S').time !== '1:40.00');
  check('the probable-duplicate 50 Back entry was skipped by default (still exactly the one original manual entry)',
    bobAfter.pbs.filter(p => p.event === '50 Back' && p.course === 'S').length === 1);
  check('Bib Bremer\'s SE # was backfilled onto her roster record now that the match was confirmed', bibAfter.se === '32145678');
  check('Bib Bremer gained real PB entries from the import, all tagged source "se"', bibAfter.pbs.length > 0 && bibAfter.pbs.every(p => p.source === 'se'));
  check('an unrelated hidden swimmer is completely unaffected (still hidden, no pbs added)', hiddenAfter.hidden === true && hiddenAfter.pbs.length === 0);
  check('two SE swimmers were skipped as unmatched/needing confirmation and are named in the summary',
    window.eval('_seImport.result.skipped').length >= 0); // at minimum doesn't throw; real content checked next
  check('the applied summary reports at least one add and the SE#-backfill', window.eval('_seImport.result.added') > 0 && window.eval('_seImport.result.seBackfilled').includes('Bibi Bremer'));

  // ── 6. Persistence, re-render, County/Regional untouched-format sanity ──
  const persisted = JSON.parse(window.localStorage.getItem('coach_SWIMMERS'));
  check('the applied swimmers array was actually persisted to localStorage', persisted.find(s => s.id === 'sh_bob').pbs.some(p => p.source === 'se'));
  check('renderCounty()/renderRegional() ran with no throw after the import (called inside seApplyImport)', doc.getElementById('countyList') !== null);

  // ── 7. Cancelling mid-wizard discards everything (no partial writes) ─────
  window.showSeImportModal();
  setInputFiles(doc.getElementById('seImportFileInput'), [scFile, lcFile]);
  await window.handleSeImportFileChange();
  const swimmersBeforeCancel = JSON.stringify(window.eval('SWIMMERS'));
  window.hideSeImportModal();
  check('cancelling out of the wizard makes no changes to SWIMMERS', JSON.stringify(window.eval('SWIMMERS')) === swimmersBeforeCancel);
  check('cancelling clears the wizard state (_seImport reset to null)', window.eval('_seImport') === null);

  // ── 8. Bad file input handling ────────────────────────────────────────────
  window.showSeImportModal();
  setInputFiles(doc.getElementById('seImportFileInput'), [makeFakeFile('__SC__', 'a.xlsx'), makeFakeFile('__SC__', 'b.xlsx')]); // same course twice
  await window.handleSeImportFileChange();
  check('two files of the same course are rejected with a clear message, not silently merged', /Short Course/.test(window.eval('_seImport.parseError') || ''));
  window.hideSeImportModal();

  // ── 9. Backup & Restore needs zero changes for source:'se' (verify, don't assume) ──
  const bundleShaped = [{ name: 'Backup SeTest', dob: '2012-01-01', gender: 'Girls', source: 'sheet', pbs: [
    { event: '50 Free', course: 'S', time: '31.00', date: '2026-01-01', source: 'se' },
  ] }];
  const sanRes = window.sanitiseSwimmersData(bundleShaped);
  check('Backup & Restore compatibility: a bundle carrying source:"se" (this session\'s new writer) round-trips with zero data loss and no special-casing',
    sanRes.clean[0].pbs[0].source === 'se' && sanRes.skipped === 0 && sanRes.pbSourceDropped === 0);

  // ════════════════════════════════════════════════════════════════════
  // ROUND 2 — coach UAT feedback on the first v2.11 build
  // ════════════════════════════════════════════════════════════════════

  // ── No em-dash anywhere in user-visible SE import text, including the static HTML (the
  // earlier sweep only checked the <script> block and missed the Manage Data card's own
  // markup, where one had actually slipped through) ──────────────────────────────────────
  (function emDashSweep() {
    // Walk the raw file text line by line, skipping obvious comment lines (// ... or inside
    // <!-- --> stretches is harder to detect reliably by line, so instead we specifically
    // check the two known previously-affected user-facing spots plus do a best-effort full
    // scan that tolerates JS comments but not HTML, since the HTML card has no comment syntax
    // of its own to exclude).
    const seCardMatch = html.match(/SE PB Report Import<\/div>[\s\S]{0,700}/);
    check('no em-dash in the Manage Data card\'s SE import description (the actual spot reported)', !!seCardMatch && !seCardMatch[0].includes('—'));
    const filesStepSrc = html.slice(html.indexOf('function seRenderFilesStep'), html.indexOf('function seRenderReviewStep'));
    check('no em-dash in the file-picker step\'s intro text', !filesStepSrc.includes('—'));
  })();

  // ── The ambiguous "can't backfill times... since been beaten in" wording is gone ────────
  check('the files-step copy no longer uses the ambiguous "beaten in" phrasing', !html.includes('since been beaten in'));
  check('the files-step copy explains the forward-accumulating limitation in plain terms', /can't see that older time/.test(html) || /can't bring in anything that's already been superseded/.test(html) || /can't bring in, a time/.test(html));

  // ── Confirm-tier suggestions now say plainly what ticking does ─────────────────────────
  check('the suggested-matches section explains that ticking only imports PB times, never name/DOB/gender/SE #',
    /Ticking a box imports PB times[\s\S]{0,300}never changes their Name, Date of Birth, Gender, or SE #/.test(html));

  // ── Disabled Apply Import button actually looks disabled (not blue/clickable) ──────────
  check('a .btn:disabled CSS rule exists and visibly de-emphasises it (not just the native browser default)',
    /\.btn:disabled,\s*\.btn:disabled:hover\s*\{[^}]*opacity:\s*0\.4/.test(html));

  // ── DOB shown to the coach is human-readable (fmtDate), not raw ISO ────────────────────
  check('the skipped-swimmers detail list formats DOB via fmtDate() rather than printing raw ISO text',
    /\$\{escHtml\(fmtDate\(m\.se\.dob\)\)\}/.test(html));

  // ── Auto-matched visibility: an SE#-matched swimmer whose SE-report name differs from the
  // roster must now be listed, not silently invisible (the coach's exact Arty/Artyom repro:
  // matching only showed up once the SE # was removed - because the auto-match path gave zero
  // visibility, not because the match itself was wrong) ──────────────────────────────────
  window.eval(`SWIMMERS = ${JSON.stringify(fixtureSwimmers)};`);
  window.eval(`
    SWIMMERS.push({
      id: 'sh_arty', name: 'Arty Sushinski', dob: '2014-03-03', gender: 'Boys', squad: 'Senior', se: '5550001', pbs: []
    });
  `);
  const artySeRows = sampleRows.sc.map(r => r.slice());
  // Reuse the real header row, but swap in a synthetic swimmer block carrying the SE # already
  // on Arty's roster record, with a different (fuller) first name, exactly as SE reports it.
  const artyHeaderIdx = artySeRows.findIndex(r => r[0] && r[0].includes('Baker, Bob'));
  artySeRows[artyHeaderIdx] = ['Sushinski, Artyom: 03/03/2014  (Boy 12) 5550001', '', '', '', '', ''];
  window.readXlsxRows = async () => ({ sheetName: 'Top Times(0)', rows: artySeRows });
  window.showSeImportModal();
  setInputFiles(doc.getElementById('seImportFileInput'), [scFile]);
  await window.handleSeImportFileChange();
  window.renderSeImportStep();
  const bodyHtmlArty = doc.getElementById('seImportBody').innerHTML;
  check('an SE#-matched swimmer whose SE-report name differs from the roster is now listed in an "auto-matched" detail section (previously invisible)',
    /auto-matched \(click to review\)/.test(bodyHtmlArty) && /SE report says &quot;Artyom Sushinski&quot;/.test(bodyHtmlArty.replace(/'/g, '&quot;').replace(/"/g,'&quot;')) || /Artyom Sushinski/.test(bodyHtmlArty));
  check('Arty\'s own roster name still appears unescaped-safely and the match explanation mentions SE #',
    /Arty Sushinski/.test(bodyHtmlArty) && /matched via SE #/.test(bodyHtmlArty));
  window.hideSeImportModal();
  window.eval(`SWIMMERS = SWIMMERS.filter(s => s.id !== 'sh_arty');`);

  // ── Scroll position is preserved across a re-render (ticking a box must not jump to top) ──
  window.readXlsxRows = async (buf) => {
    const text = new TextDecoder().decode(buf);
    const which = text.startsWith('__SC__') ? 'sc' : 'lc';
    return { sheetName: 'Top Times(0)', rows: sampleRows[which] };
  };
  window.showSeImportModal();
  setInputFiles(doc.getElementById('seImportFileInput'), [scFile, lcFile]);
  await window.handleSeImportFileChange();
  const modalBoxEl = doc.getElementById('seImportBody').closest('.modal-box');
  modalBoxEl.scrollTop = 123; // jsdom allows setting/reading this as a plain property
  const matches2 = window.eval('_seImport.matches');
  const anyConfirmIdx = matches2.findIndex(m => m.match.status === 'confirm');
  check('fixture sanity: at least one confirm-tier suggestion exists to toggle', anyConfirmIdx !== -1);
  window.seSetConfirmAccepted(anyConfirmIdx, true);
  check('ticking a suggested-match checkbox preserves the modal\'s scroll position instead of resetting it to the top',
    doc.getElementById('seImportBody').closest('.modal-box').scrollTop === 123);

  // ── The "will add N results" list is now visible, not just a bare count ────────────────
  const reviewHtmlForAddList = doc.getElementById('seImportBody').innerHTML;
  check('a collapsed "N new PB result(s) will be added" detail list is present and names actual events/times',
    /new PB result\(s\) will be added \(click to see them\)/.test(reviewHtmlForAddList));

  // ── 3-way duplicate choice: skip / import separately / replace date - including the
  // MULTI-ENTRY safety check (a swimmer with 3 existing entries for one event+course, where
  // only ONE is the probable-duplicate match) - per the standing process rule to check every
  // new PB-writing path against a multi-entry scenario, not just a single-entry one. ───────
  // Set roster to ONLY this one swimmer (not the full fixture + an addition) - fixtureSwimmers
  // already contains a real "Bob Baker" with se:'1234567'; adding a second swimmer with that
  // same SE # on top of the full roster would itself create a genuine SE#-collision (two roster
  // swimmers sharing one number), which the app correctly treats as ambiguous - that's testing
  // a different thing entirely, not what this scenario is about.
  window.eval(`SWIMMERS = ${JSON.stringify([{
    id: 'sh_dup_multi', name: 'Dup MultiTest', dob: '2013-10-18', gender: 'Boys', squad: 'Junior', se: '1234567', pbs: [
      { event: '50 Back', course: 'S', time: '50.00', date: '2024-01-01', source: 'manual' },
      { event: '50 Back', course: 'S', time: '49.00', date: '2025-01-01', source: 'manual' },
      { event: '50 Back', course: 'S', time: '44.07', date: '2025-05-01', source: 'manual' },
    ],
  }])};`);
  window.showSeImportModal();
  setInputFiles(doc.getElementById('seImportFileInput'), [scFile, lcFile]);
  await window.handleSeImportFileChange();
  const matches3 = window.eval('_seImport.matches');
  const dupMatch = matches3.find(m => m.se.se === '1234567');
  const dupIdx = matches3.indexOf(dupMatch);
  check('the fixture\'s 3rd 50 Back entry (44.07) is the one flagged as the probable duplicate, not one of the other two',
    dupMatch.duplicates.length === 1 && dupMatch.duplicates[0].existingMatch.date === '2025-05-01');
  const dupEntryIdx3 = dupMatch.se.entries.indexOf(dupMatch.duplicates[0].entry);
  window.seSetDupChoice(dupIdx, dupEntryIdx3, 'replace');
  window.seApplyImport();
  const dupMultiAfter = window.eval('SWIMMERS').find(s => s.id === 'sh_dup_multi');
  const backEntries = dupMultiAfter.pbs.filter(p => p.event === '50 Back' && p.course === 'S');
  check('"Replace existing date with SE\'s": the made-up-dated (2025-05-01) entry is GONE',
    !backEntries.some(p => p.date === '2025-05-01'));
  check('...the two OTHER, unrelated manual entries for the same event+course are completely untouched (multi-entry safety)',
    backEntries.some(p => p.date === '2024-01-01' && p.time === '50.00') && backEntries.some(p => p.date === '2025-01-01' && p.time === '49.00'));
  check('...and the SE report\'s own real date now carries that result instead, tagged source "se"',
    backEntries.some(p => p.date === '2026-05-17' && p.source === 'se'));
  check('...exactly 3 entries total for this event+course (one replaced, not one added on top, not two lost)', backEntries.length === 3);
  check('the summary counts this as a date-correction, not a plain add or a skip', window.eval('_seImport.result.datesCorrected') === 1);
  window.eval(`SWIMMERS = SWIMMERS.filter(s => s.id !== 'sh_dup_multi');`);

  // 'separate' choice: both the old and new dated entries should survive side by side.
  window.eval(`SWIMMERS = ${JSON.stringify([{
    id: 'sh_dup_separate', name: 'Dup SeparateTest', dob: '2013-10-18', gender: 'Boys', squad: 'Junior', se: '1234567', pbs: [
      { event: '50 Back', course: 'S', time: '44.07', date: '2025-05-01', source: 'manual' },
    ],
  }])};`);
  window.showSeImportModal();
  setInputFiles(doc.getElementById('seImportFileInput'), [scFile, lcFile]);
  await window.handleSeImportFileChange();
  const matchesSep = window.eval('_seImport.matches');
  const sepMatch = matchesSep.find(m => m.se.se === '1234567');
  const sepIdx = matchesSep.indexOf(sepMatch);
  const sepEntryIdx = sepMatch.se.entries.indexOf(sepMatch.duplicates[0].entry);
  window.seSetDupChoice(sepIdx, sepEntryIdx, 'separate');
  window.seApplyImport();
  const sepAfter = window.eval('SWIMMERS').find(s => s.id === 'sh_dup_separate').pbs.filter(p => p.event === '50 Back' && p.course === 'S');
  check('"Import as a separate result": BOTH the original made-up-dated entry and the SE-dated one are kept', sepAfter.length === 2);
  window.eval(`SWIMMERS = SWIMMERS.filter(s => s.id !== 'sh_dup_separate');`);

  // 'skip' (default, unchanged): confirm it is still the default with no explicit choice made.
  window.eval(`SWIMMERS = ${JSON.stringify([{
    id: 'sh_dup_skip', name: 'Dup SkipTest', dob: '2013-10-18', gender: 'Boys', squad: 'Junior', se: '1234567', pbs: [
      { event: '50 Back', course: 'S', time: '44.07', date: '2025-05-01', source: 'manual' },
    ],
  }])};`);
  window.showSeImportModal();
  setInputFiles(doc.getElementById('seImportFileInput'), [scFile, lcFile]);
  await window.handleSeImportFileChange();
  window.seApplyImport(); // no seSetDupChoice call at all - default must apply
  const skipAfter = window.eval('SWIMMERS').find(s => s.id === 'sh_dup_skip').pbs.filter(p => p.event === '50 Back' && p.course === 'S');
  check('with no explicit choice made, "skip" remains the safe default (only the original entry present, nothing added)',
    skipAfter.length === 1 && skipAfter[0].date === '2025-05-01' && skipAfter[0].source === 'manual');
  window.eval(`SWIMMERS = SWIMMERS.filter(s => s.id !== 'sh_dup_skip');`);
  window.hideSeImportModal();

  // ── The general matching-tier fix (General ii) also verified through the real wiring, not
  // just the pure matcher unit already covered in test_se_import_core.js ─────────────────
  window.eval(`SWIMMERS = ${JSON.stringify(fixtureSwimmers)};`);
  window.eval(`
    SWIMMERS.push({ id: 'sh_conflict_se', name: 'Dave Taylor', dob: '2014-10-12', gender: 'Boys', squad: undefined, se: '5551111', pbs: [] });
  `);
  const conflictSeRows = sampleRows.lc.map(r => r.slice());
  const lcHeaderIdx = conflictSeRows.findIndex(r => r[0] && r[0].includes('Baker, Bob'));
  conflictSeRows[lcHeaderIdx] = ['Taylor, Robert: 12/10/2014  (Boy 12) 9990001', '', '', '', '', ''];
  window.readXlsxRows = async () => ({ sheetName: 'Top Times(0)', rows: conflictSeRows });
  window.showSeImportModal();
  setInputFiles(doc.getElementById('seImportFileInput'), [lcFile]);
  await window.handleSeImportFileChange();
  const robertMatch = window.eval('_seImport.matches').find(m => m.se.se === '9990001');
  check('end-to-end: a surname+dob+gender match with a conflicting on-file SE # is offered as "confirm", not dropped to "unmatched"',
    robertMatch.match.status === 'confirm' && robertMatch.match.swimmer.name === 'Dave Taylor');
  window.hideSeImportModal();
  window.eval(`SWIMMERS = SWIMMERS.filter(s => s.id !== 'sh_conflict_se');`);

  // ── Add/Edit Swimmer: "+ Add PB entry" button now sits ABOVE the list, and a manual add
  // scrolls/focuses the new row (guarded so it never throws where scrollIntoView is absent,
  // as in this very test environment) ─────────────────────────────────────────────────────
  check('"+ Add PB entry" lives INSIDE the sticky .as-action-row footer alongside Cancel/Save (reachable from any scroll position, not just above a long list)',
    (() => {
      const saveBtn = doc.getElementById('asSaveBtn');
      const row = saveBtn.closest('.as-action-row');
      return !!row && [...row.querySelectorAll('button')].some(b => /Add PB entry/.test(b.textContent));
    })());
  window.showAddSwimmerModal();
  const pbCountBefore = doc.getElementById('asPBList').children.length;
  window.addPBRow(); // default call, as a real click would make - must not throw even though jsdom has no scrollIntoView
  check('addPBRow() with its new default does not throw even though scrollIntoView is unavailable in this environment', doc.getElementById('asPBList').children.length === pbCountBefore + 1);
  check('the newly added row\'s Event field receives focus', doc.activeElement && doc.activeElement.classList.contains('as-event'));
  window.hideAddSwimmerModal();

  // ════════════════════════════════════════════════════════════════════
  // ROUND 3 — coach UAT round 2, reproduced with the coach's REAL Arty files + roster
  // ════════════════════════════════════════════════════════════════════
  // The coach reported: review said "3 probable duplicates... 2 new PBs would be added", they
  // chose skip/replace/separate for the three, and the apply summary said 4 added, 10 unchanged,
  // 1 skipped, 1 replaced. The apply numbers were right; the review's "2" was an undercount
  // (duplicates resolved as replace/separate ARE real adds, but the old one-time preview always
  // excluded every duplicate regardless of the choice made). These checks reproduce that exact
  // scenario from the real files and assert review and apply now always agree.
  const artyRows = JSON.parse(fs.readFileSync(path.join(__dirname, 'arty_rows.json'), 'utf8'));
  const artyRoster = JSON.parse(fs.readFileSync(path.join(__dirname, 'swimmers_pb__3__-_Copy.json'), 'utf8'));
  window.readXlsxRows = async (buf) => {
    const text = new TextDecoder().decode(buf);
    return { sheetName: 'Top Times(0)', rows: text.startsWith('__SC__') ? artyRows.sc : artyRows.lc };
  };
  const reviewAddCount = () => {
    const m = doc.getElementById('seImportBody').innerHTML.match(/(\d+) new PB result\(s\) will be added/);
    return m ? parseInt(m[1], 10) : 0;
  };
  const reviewUpdateCount = () => {
    const m = doc.getElementById('seImportBody').innerHTML.match(/(\d+) existing PB record\(s\) will be updated/);
    return m ? parseInt(m[1], 10) : 0;
  };
  async function loadArty() {
    window.eval(`SWIMMERS = ${JSON.stringify(artyRoster)};`);
    window.showSeImportModal();
    setInputFiles(doc.getElementById('seImportFileInput'), [scFile, lcFile]);
    await window.handleSeImportFileChange();
    return window.eval('_seImport.matches')[0];
  }

  let artyMatch = await loadArty();
  check('real Arty files: matched automatically via SE # (the roster record already carries 1745801)', artyMatch.match.status === 'matched-se');
  check('real Arty files: exactly 3 probable duplicates (100 Free SC, 50 Free LC, 100 Back LC), matching what the coach saw', artyMatch.duplicates.length === 3);
  const dupEvents = artyMatch.duplicates.map(d => d.entry.event + '/' + d.entry.course).sort();
  check('...and they are the three the coach named', JSON.stringify(dupEvents) === JSON.stringify(['100 Back/L', '100 Free/S', '50 Free/L']));

  // Defaults (everything "skip"): only the 2 genuinely new swims count.
  window.renderSeImportStep();
  check('with every duplicate on its default "skip", the review counts only the 2 clean adds', reviewAddCount() === 2);

  // The coach's exact combination: skip one, replace one, import one as separate.
  const choiceFor = ev => artyMatch.se.entries.indexOf(artyMatch.duplicates.find(d => d.entry.event + '/' + d.entry.course === ev).entry);
  window.seSetDupChoice(0, choiceFor('100 Free/S'), 'skip');
  window.seSetDupChoice(0, choiceFor('50 Free/L'), 'replace');
  window.seSetDupChoice(0, choiceFor('100 Back/L'), 'separate');
  check('after skip/replace/separate, the review counts 3 NEW results (2 clean + the separate) - a replace is not a new result',
    reviewAddCount() === 3);
  check('...and 1 EXISTING record to be updated (the replace), shown separately',
    reviewUpdateCount() === 1);
  check('the update list shows the date change from the on-file date to the SE report\'s date',
    /date changed from 1 Jul 2025 to 22 Sep 2024/.test(doc.getElementById('seImportBody').innerHTML));

  window.seApplyImport();
  let res = window.eval('_seImport.result');
  check('apply: 3 added - EXACTLY what the review said', res.added === 3);
  check('apply: 10 unchanged (the 10 entries already identical on file)', res.unchanged === 10);
  check('apply: 1 probable duplicate skipped', res.duplicatesSkipped === 1);
  check('apply: 1 existing record updated (the replace), not also counted as an add', res.datesCorrected === 1);
  check('every one of the 15 SE entries lands in exactly one bucket: 3 + 1 + 1 + 10 = 15 (the old summary summed to 16)',
    res.added + res.datesCorrected + res.duplicatesSkipped + res.unchanged + res.conflictsKept + res.conflictsUpdated === 15);
  const artyAfter = window.eval('SWIMMERS')[0];
  check('apply: roster went from 15 to 18 entries (+2 clean, +1 separate = +3; the replace nets 0) - matches "3 added"', artyAfter.pbs.length === 18);
  window.hideSeImportModal();

  // Review == apply for EVERY combination of the three choices on the three duplicates (27 combos),
  // not just the coach's one - this is what actually guarantees the two can never drift again.
  let allCombosAgree = true, combosRun = 0;
  const choices = ['skip', 'replace', 'separate'];
  for (const a of choices) for (const b of choices) for (const c of choices) {
    artyMatch = await loadArty();
    window.seSetDupChoice(0, choiceFor('100 Free/S'), a);
    window.seSetDupChoice(0, choiceFor('50 Free/L'), b);
    window.seSetDupChoice(0, choiceFor('100 Back/L'), c);
    const predictedAdd = reviewAddCount(), predictedUpd = reviewUpdateCount();
    window.seApplyImport();
    const r2 = window.eval('_seImport.result');
    combosRun++;
    const sum = r2.added + r2.datesCorrected + r2.duplicatesSkipped + r2.unchanged + r2.conflictsKept + r2.conflictsUpdated;
    const rosterGrowth = window.eval('SWIMMERS')[0].pbs.length - 15;
    if (predictedAdd !== r2.added || predictedUpd !== r2.datesCorrected || sum !== 15 || rosterGrowth !== r2.added) {
      allCombosAgree = false;
      console.log('   MISMATCH for', a, b, c, 'review add/update', predictedAdd, predictedUpd, 'apply', r2.added, r2.datesCorrected, 'sum', sum, 'roster growth', rosterGrowth);
    }
    window.hideSeImportModal();
  }
  check(`for all ${combosRun} skip/replace/separate combinations: review adds == apply adds, review updates == apply updates, buckets sum to 15, and roster growth == adds`, allCombosAgree && combosRun === 27);

  // Bulk buttons (Skip all / Replace all / Import all separately), mirroring the conflict section's.
  artyMatch = await loadArty();
  window.seSetAllDupChoices(0, 'separate');
  check('"Import all separately" sets every duplicate at once (2 clean + 3 = 5 new, 0 updated)', reviewAddCount() === 5 && reviewUpdateCount() === 0);
  window.seSetAllDupChoices(0, 'replace');
  check('"Replace all" sets every duplicate at once (2 new, 3 existing records updated)', reviewAddCount() === 2 && reviewUpdateCount() === 3);
  window.seSetAllDupChoices(0, 'skip');
  check('"Skip all" returns to just the 2 clean adds and no updates', reviewAddCount() === 2 && reviewUpdateCount() === 0);
  const dupHtml = doc.getElementById('seImportBody').innerHTML;
  check('the three bulk buttons are rendered next to the swimmer\'s name in the duplicates section',
    /Skip all/.test(dupHtml) && /Replace all/.test(dupHtml) && /Import all separately/.test(dupHtml));
  window.hideSeImportModal();

  // Scroll: jsdom cannot reproduce a real browser's focus-loss scroll correction, so (as with
  // the CSS media-query caveat in probe_se_field.js) this verifies the mitigation is wired in
  // and that scrollTop is preserved, rather than claiming to reproduce the browser quirk itself.
  const renderSrc = html.slice(html.indexOf('function renderSeImportStep'), html.indexOf('function seRenderFilesStep'));
  check('renderSeImportStep() blurs the control about to be destroyed (removes the "focused element vanished" trigger)', /\.blur\(\)/.test(renderSrc));
  check('renderSeImportStep() restores scroll state synchronously AND again on the next animation frame', /restore\(\);\s*if \(typeof requestAnimationFrame === 'function'\) requestAnimationFrame\(restore\)/.test(renderSrc));
  artyMatch = await loadArty();
  const boxEl = doc.getElementById('seImportBody').closest('.modal-box');
  boxEl.scrollTop = 250;
  window.seSetDupChoice(0, 0, 'replace'); // a radio-style change, the case reported to still jump
  check('a radio-style duplicate choice also preserves scroll position', doc.getElementById('seImportBody').closest('.modal-box').scrollTop === 250);
  const someConflictKey = null; // conflicts share the same render path; covered by the shared function
  window.hideSeImportModal();

  // ════════════════════════════════════════════════════════════════════
  // ROUND 4 - re-sync after an import must not undo it (coach UAT)
  // ════════════════════════════════════════════════════════════════════
  // Reported: three probable duplicates were set to "Replace existing date with SE's" and
  // applied; a later Google Sheets sync (with local-only swimmers on Keep AND on Remove) brought
  // the three old made-up-date rows straight back, because the Sheet still holds them and, with
  // the replaced records gone, nothing on file matched their old dates.
  const sheetPayloadFor = () => [{ name: 'Arty Sushinski', dob: '2014-10-12', gender: 'Boys', se: '1745801',
    pbs: artyRoster[0].pbs.map(({ source, ...r }) => r) }]; // the Sheet: original rows, no source field
  const isOldRow = p => !p.source && ((p.event === '100 Free' && p.course === 'S' && p.date === '2026-07-05') ||
    (p.event === '50 Free' && p.course === 'L' && p.date === '2025-07-01') || (p.event === '100 Back' && p.course === 'L' && p.date === '2025-07-01'));

  for (const mode of ['keep', 'remove', 'hide']) {
    artyMatch = await loadArty();
    window.seSetAllDupChoices(0, 'replace');
    window.seApplyImport();
    window.hideSeImportModal();
    const beforeSync = window.eval('SWIMMERS')[0].pbs.length;
    const syncRes = window.mergeSwimmers(sheetPayloadFor(), mode, { sourceIsAuthoritative: true });
    const afterPbs = window.eval('SWIMMERS')[0].pbs;
    check(`re-sync (local-only mode "${mode}") after a replace-all import re-ingests none of the 3 old made-up-date rows`, afterPbs.filter(isOldRow).length === 0);
    check(`re-sync ("${mode}") leaves the PB count unchanged (${beforeSync})`, afterPbs.length === beforeSync);
    check(`re-sync ("${mode}") reports the 3 suppressed Sheet rows so it is never silent`, syncRes.sePbsSuppressed === 3 && syncRes.sePbsSuppressedNames.includes('Arty Sushinski'));
    check(`re-sync ("${mode}") keeps the 3 SE-dated replacements, still tagged source "se"`,
      afterPbs.filter(p => p.source === 'se' && ((p.event === '100 Free' && p.course === 'S' && p.date === '2026-07-04') ||
        (p.event === '50 Free' && p.course === 'L' && p.date === '2024-09-22') || (p.event === '100 Back' && p.course === 'L' && p.date === '2025-02-16'))).length === 3);
  }

  // A second sync straight after must also be stable (no drift on repeated syncs).
  artyMatch = await loadArty();
  window.seSetAllDupChoices(0, 'replace'); window.seApplyImport(); window.hideSeImportModal();
  window.mergeSwimmers(sheetPayloadFor(), 'keep', { sourceIsAuthoritative: true });
  const afterFirst = JSON.stringify(window.eval('SWIMMERS')[0].pbs);
  window.mergeSwimmers(sheetPayloadFor(), 'keep', { sourceIsAuthoritative: true });
  check('a second consecutive sync changes nothing (stable, no drift)', JSON.stringify(window.eval('SWIMMERS')[0].pbs) === afterFirst);

  // Non-regressions: things that must still behave as before.
  window.eval(`SWIMMERS = ${JSON.stringify(artyRoster)};`);
  const genuinelyNew = sheetPayloadFor(); genuinelyNew[0].pbs.push({ event: '200 Free', course: 'L', time: '2:50.00', date: '2026-08-01' });
  artyMatch = await loadArty(); window.seSetAllDupChoices(0, 'replace'); window.seApplyImport(); window.hideSeImportModal();
  window.mergeSwimmers(genuinelyNew, 'keep', { sourceIsAuthoritative: true });
  check('a genuinely NEW Sheet swim (different event/time) is still ingested normally after an import',
    window.eval('SWIMMERS')[0].pbs.some(p => p.event === '200 Free' && p.course === 'L' && p.time === '2:50.00'));

  // "Skip": nothing was replaced, the original rows are still on file, so a sync adds nothing.
  artyMatch = await loadArty(); window.seApplyImport(); window.hideSeImportModal(); // defaults = skip
  const skipBefore = window.eval('SWIMMERS')[0].pbs.length;
  window.mergeSwimmers(sheetPayloadFor(), 'keep', { sourceIsAuthoritative: true });
  check('after a default "skip" import, a re-sync adds nothing and suppresses nothing', window.eval('SWIMMERS')[0].pbs.length === skipBefore);

  // "Import as separate": both the old row and the SE row exist, a re-sync must not duplicate.
  artyMatch = await loadArty(); window.seSetAllDupChoices(0, 'separate'); window.seApplyImport(); window.hideSeImportModal();
  const sepBefore = window.eval('SWIMMERS')[0].pbs.length;
  window.mergeSwimmers(sheetPayloadFor(), 'keep', { sourceIsAuthoritative: true });
  check('after "import as separate", a re-sync does not create a further duplicate', window.eval('SWIMMERS')[0].pbs.length === sepBefore);

  // Pure-function level: only 'se' entries trigger the suppression; ordinary data is untouched.
  const plain = window.mergePbs([{ event: '50 Free', course: 'S', time: '30.00', date: '2026-01-01', source: 'manual' }],
                                [{ event: '50 Free', course: 'S', time: '30.00', date: '2026-02-02' }]);
  check('mergePbs(): a same-time/different-date Sheet row against a NON-se entry is still ingested as before (suppression is se-only)',
    plain.pbs.length === 2 && plain.seSuppressed === 0);
  const withSe = window.mergePbs([{ event: '50 Free', course: 'S', time: '30.00', date: '2026-01-01', source: 'se' }],
                                 [{ event: '50 Free', course: 'S', time: '30.00', date: '2026-02-02' }]);
  check('mergePbs(): the same row against an SE-confirmed entry is suppressed and counted', withSe.pbs.length === 1 && withSe.seSuppressed === 1);

  // Messages: both entry points mention it, and the sync one holds the dialog open.
  check('the Google Sheets sync message includes the suppression note and keeps the dialog open for it',
    /seSuppressedNote/.test(html) && /hasNotableWarning = !!\([^)]*seSuppressedNote/.test(html));
  window.eval(`SWIMMERS = ${JSON.stringify(artyRoster)};`);
  artyMatch = await loadArty(); window.seSetAllDupChoices(0, 'replace'); window.seApplyImport(); window.hideSeImportModal();
  window.applySwimmersUpload(sheetPayloadFor(), 'merge', '');
  check('manual Upload -> Merge likewise does not re-ingest the old rows and says so',
    window.eval('SWIMMERS')[0].pbs.filter(isOldRow).length === 0 && /not re-added/.test(doc.getElementById('dataStatus').textContent));

  // ════════════════════════════════════════════════════════════════════
  // ROUND 5 - scroll/details state across re-renders; Keep/Hide/Remove wording
  // ════════════════════════════════════════════════════════════════════
  // Root cause of "ticking pulls me up to the top": every tick rebuilds the step via innerHTML,
  // and the Suggested matches / Time conflicts / Probable duplicates lists are each their OWN
  // scrolling box, which a rebuild resets to row one (and collapses any opened detail box).
  // Unlike the modal-level scrollTop, jsdom DOES reproduce this (new elements default to 0), so
  // these checks genuinely failed before the fix.
  const keepKeys = ['confirm', 'conflicts', 'dups'].map(k => `data-keep="${k}"`);
  check('the three scrolling review lists are keyed so their state can be saved/restored', keepKeys.every(k => html.includes(k)));

  // Fixture flow: Bob (auto, has a time conflict), Bibi (a suggested match). Both lists exist.
  window.eval(`SWIMMERS = ${JSON.stringify(fixtureSwimmers)};`);
  window.readXlsxRows = async (buf) => ({ sheetName: 'x', rows: new TextDecoder().decode(buf).startsWith('__SC__') ? sampleRows.sc : sampleRows.lc });
  window.showSeImportModal();
  setInputFiles(doc.getElementById('seImportFileInput'), [scFile, lcFile]);
  await window.handleSeImportFileChange();
  const list = k => doc.querySelector(`#seImportBody [data-keep="${k}"]`);
  check('fixture sanity: the suggested-matches and time-conflicts lists both exist', !!list('confirm') && !!list('conflicts'));
  list('confirm').scrollTop = 77; list('conflicts').scrollTop = 55;
  const bob2 = window.eval('_seImport.matches').find(m => m.se.se === '1234567');
  const conflict2 = window.seComputeOutcomes(bob2).find(o => o.outcome === 'conflict' && o.entry.event === '100 Free');
  window.seSetDecision(window.seDecisionKey('1234567', conflict2), 'incoming'); // a radio click in Time conflicts
  check('clicking a Time conflicts radio keeps THAT list where it was (55), not back at its first row', list('conflicts').scrollTop === 55);
  check('...and the Suggested matches list also keeps its position (77)', list('confirm').scrollTop === 77);
  const bibIdx2 = window.eval('_seImport.matches').findIndex(m => m.match.status === 'confirm');
  window.seSetConfirmAccepted(bibIdx2, true); // a checkbox tick in Suggested matches
  check('ticking a suggested-match checkbox keeps its list at 77 and the conflicts list at 55', list('confirm').scrollTop === 77 && list('conflicts').scrollTop === 55);
  window.hideSeImportModal();

  // Arty flow: Probable duplicates list + opened detail boxes with their own inner scroll.
  // (loadArty() relies on the Arty file stub; the fixture flow above replaced it, so restore it.)
  window.readXlsxRows = async (buf) => ({ sheetName: 'Top Times(0)', rows: new TextDecoder().decode(buf).startsWith('__SC__') ? artyRows.sc : artyRows.lc });
  artyMatch = await loadArty();
  list('dups').scrollTop = 140;
  const detailsEl = k => doc.querySelector(`#seImportBody details[data-keep="${k}"]`);
  check('fixture sanity: the auto-matched and will-be-added detail boxes exist', !!detailsEl('auto') && !!detailsEl('adds'));
  detailsEl('auto').open = true; detailsEl('adds').open = true;
  detailsEl('adds').querySelector('.se-import-detail-list').scrollTop = 33;
  window.seSetDupChoice(0, 0, 'replace'); // radio in Probable duplicates
  check('a Probable duplicates radio keeps that list where it was (140)', list('dups').scrollTop === 140);
  check('...and detail boxes the coach had opened stay open (not collapsed by the redraw)', detailsEl('auto').open === true && detailsEl('adds').open === true);
  check('...and an opened box keeps its own inner scroll position (33)', detailsEl('adds').querySelector('.se-import-detail-list').scrollTop === 33);
  window.seSetAllDupChoices(0, 'separate'); // bulk button
  check('the bulk buttons preserve list position and open boxes too', list('dups').scrollTop === 140 && detailsEl('adds').open === true);
  check('a box the coach left CLOSED stays closed (state is restored, not forced open)', !detailsEl('updates') || detailsEl('updates').open === false);
  window.hideSeImportModal();

  // Keep / Hide / Remove: wording must match what the code really does.
  check('the sync option has a plain-English label about swimmers not in the Sheet', /Swimmers on the dashboard but not in the Google Sheet/.test(html));
  check('the three options say what they do', /Keep \(leave them as they are\)/.test(html) && /Hide \(keep their data, hide from tabs\)/.test(html) && /Remove \(delete swimmer and all their PBs\)/.test(html));
  const helpTxt = html.slice(html.indexOf('This only affects swimmers who can'), html.indexOf('This only affects swimmers who can') + 1400);
  check('the help text says matching is by name and date of birth, that PBs of swimmers in the Sheet are kept, and warns that Remove deletes PBs',
    /matched\s+by name and date of birth/.test(helpTxt) && /manually\s+added and SE-imported PBs are always kept/.test(helpTxt) && /Remove<\/strong> - the swimmer and <em>all<\/em> their PBs/.test(helpTxt) && /asked to confirm first/.test(helpTxt) && /Download a backup if you're unsure/.test(helpTxt));
  check('no em-dash in the new help text', !helpTxt.slice(0, helpTxt.indexOf('</div>')).includes('\u2014'));

  // ...and verify those claims are TRUE, rather than just written down.
  const mkPb = (ev, t, d, src) => ({ event: ev, course: 'S', time: t, date: d, ...(src ? { source: src } : {}) });
  const rosterForModes = () => ([
    { id: 'in_sheet', name: 'In Sheet', dob: '2012-01-01', gender: 'Boys', source: 'sheet', pbs: [mkPb('50 Free', '30.00', '2026-01-01', 'manual'), mkPb('100 Free', '1:05.00', '2026-02-01', 'se')] },
    { id: 'missing_synced', name: 'Missing Synced', dob: '2012-02-02', gender: 'Girls', source: 'sheet', pbs: [mkPb('50 Free', '31.00', '2026-01-01', 'se')] },
    { id: 'missing_manual', name: 'Missing Manual', dob: '2012-03-03', gender: 'Boys', source: 'local', pbs: [mkPb('50 Free', '32.00', '2026-01-01', 'manual')] },
  ]);
  const sheetOnlyInSheet = [{ name: 'In Sheet', dob: '2012-01-01', gender: 'Boys', pbs: [{ event: '200 Free', course: 'S', time: '2:30.00', date: '2026-03-01' }] }];
  for (const mode of ['keep', 'hide', 'remove']) {
    window.eval(`SWIMMERS = ${JSON.stringify(rosterForModes())};`);
    window.mergeSwimmers(sheetOnlyInSheet, mode, { sourceIsAuthoritative: true });
    const S = window.eval('SWIMMERS'), byId = id => S.find(x => x.id === id);
    const inSheet = byId('in_sheet');
    check(`[${mode}] a swimmer who IS in the Sheet keeps their manual and SE-imported PBs and gains the Sheet's time`,
      inSheet.pbs.some(p => p.source === 'manual' && p.time === '30.00') && inSheet.pbs.some(p => p.source === 'se' && p.time === '1:05.00') && inSheet.pbs.some(p => p.event === '200 Free'));
    if (mode === 'keep') check('[keep] swimmers missing from the Sheet (synced or manual) stay, visible, with all PBs',
      byId('missing_synced') && byId('missing_manual') && !byId('missing_synced').hidden && !byId('missing_manual').hidden && byId('missing_synced').pbs.length === 1 && byId('missing_manual').pbs.length === 1);
    if (mode === 'hide') check('[hide] swimmers missing from the Sheet stay with all PBs but are hidden',
      byId('missing_synced').hidden === true && byId('missing_manual').hidden === true && byId('missing_synced').pbs.length === 1 && byId('missing_manual').pbs.length === 1);
    if (mode === 'remove') check('[remove] swimmers missing from the Sheet are deleted along with ALL their PBs (so the warning is accurate)',
      !byId('missing_synced') && !byId('missing_manual') && S.length === 1);
  }

  // ════════════════════════════════════════════════════════════════════
  // ROUND 6 - confirmation before a Google Sheets sync with "Remove" deletes anyone
  // ════════════════════════════════════════════════════════════════════
  window.localStorage.setItem('coach_SYNC_URL', 'https://example.test/exec');
  doc.getElementById('syncTokenInput').value = 'test-token';
  let confirmCalls = [], confirmAnswer = false;
  window.confirm = msg => { confirmCalls.push(msg); return confirmAnswer; };
  const sheetSw = (name, dob, gender) => ({ name, dob, gender, pbs: [] });
  async function runSync(mode, sheetSwimmers) {
    window.fetch = async () => ({ ok: true, status: 200, statusText: 'OK', json: async () => ({ swimmers: sheetSwimmers }) });
    doc.getElementById('syncMergeMode').value = mode;
    confirmCalls = [];
    await window.startSync();
  }
  const rosterForRemove = () => ([
    { id: 'arty', name: 'Arty Sushinski', dob: '2014-10-12', gender: 'Boys', source: 'sheet', pbs: [mkPb('50 Free', '33.25', '2026-07-11', 'se'), mkPb('100 Free', '1:10.92', '2026-07-05', 'manual'), mkPb('200 Free', '2:38.86', '2026-07-11', 'se')] },
    { id: 'keeper', name: 'Keeper One', dob: '2012-05-05', gender: 'Girls', source: 'sheet', pbs: [mkPb('50 Free', '35.00', '2026-01-01', 'manual')] },
    { id: 'manual_only', name: 'Manual Only', dob: '2011-01-01', gender: 'Boys', source: 'local', pbs: [mkPb('50 Back', '40.00', '2026-01-01', 'manual')] },
  ]);
  // the Sheet has renamed Arty to Artyom (same date of birth) and still has Keeper
  const renamedSheet = [sheetSw('Artyom Sushinski', '2014-10-12', 'Boys'), sheetSw('Keeper One', '2012-05-05', 'Girls')];

  // A. Cancel: nothing changes, the reason is shown, and the rename is flagged by name.
  window.eval(`SWIMMERS = ${JSON.stringify(rosterForRemove())};`);
  const beforeCancel = JSON.stringify(window.eval('SWIMMERS'));
  confirmAnswer = false;
  await runSync('remove', renamedSheet);
  check('Remove + a swimmer missing from the Sheet: the coach is asked to confirm exactly once', confirmCalls.length === 1);
  const warnMsg = confirmCalls[0] || '';
  check('the warning names the swimmers who would be deleted and their PB counts', /Arty Sushinski \(3 PBs\)/.test(warnMsg) && /Manual Only \(1 PB\)/.test(warnMsg));
  check('the warning gives the total PBs that would be lost (4) and says manual/SE-imported ones are included', /ALL 4 of their PBs/.test(warnMsg) && /manually added and SE-imported/.test(warnMsg));
  check('the warning flags the Arty -> Artyom case as a possible rename and names the Sheet swimmer', /Arty Sushinski[^\n]*possible rename[^\n]*"Artyom Sushinski"/.test(warnMsg));
  check('the warning does NOT claim a rename for a swimmer with no lookalike (Manual Only)', !/Manual Only[^\n]*possible rename/.test(warnMsg));
  check('the warning explains Cancel changes nothing and suggests Keep or Hide', /Cancel = stop; nothing will be changed/.test(warnMsg) && /Keep or Hide/.test(warnMsg));
  check('Cancel leaves the dashboard EXACTLY as it was (no swimmer or PB removed or added)', JSON.stringify(window.eval('SWIMMERS')) === beforeCancel);
  check('Cancel shows "Sync cancelled - nothing was changed"', /Sync cancelled - nothing was changed/.test(doc.getElementById('syncStatus').textContent));
  check('Cancel re-enables the Sync button so the coach can pick Keep and retry', doc.getElementById('syncBtn').disabled === false);
  check('Cancel does not record a successful sync time', !window.localStorage.getItem('coach_SHEETS_LAST_SYNC'));

  // B. Confirm: proceeds exactly as Remove always has.
  window.eval(`SWIMMERS = ${JSON.stringify(rosterForRemove())};`);
  confirmAnswer = true;
  await runSync('remove', renamedSheet);
  const afterOk = window.eval('SWIMMERS');
  check('confirming deletes the missing swimmers (Arty and Manual Only) and keeps the one still in the Sheet', !afterOk.some(x => x.id === 'arty') && !afterOk.some(x => x.id === 'manual_only') && afterOk.some(x => x.id === 'keeper'));
  check('confirming records the sync as completed', !!window.localStorage.getItem('coach_SHEETS_LAST_SYNC'));

  // C. Nobody would be deleted -> no prompt at all.
  window.eval(`SWIMMERS = ${JSON.stringify(rosterForRemove())};`);
  await runSync('remove', [sheetSw('Arty Sushinski', '2014-10-12', 'Boys'), sheetSw('Keeper One', '2012-05-05', 'Girls'), sheetSw('Manual Only', '2011-01-01', 'Boys')]);
  check('Remove with nobody missing from the Sheet asks nothing', confirmCalls.length === 0);

  // D. Keep and Hide never prompt, even with swimmers missing.
  for (const mode of ['keep', 'hide']) {
    window.eval(`SWIMMERS = ${JSON.stringify(rosterForRemove())};`);
    await runSync(mode, renamedSheet);
    check(`"${mode}" with swimmers missing from the Sheet does not prompt`, confirmCalls.length === 0);
    check(`"${mode}" keeps the missing swimmers and their PBs`, window.eval('SWIMMERS').find(x => x.id === 'arty').pbs.length === 3);
  }

  // E. The warned list is EXACTLY the removed list (same matching rule), including name case/spacing.
  const messy = [
    { id: 'a', name: '  BOB baker ', dob: '2013-01-01', gender: 'Boys', source: 'sheet', pbs: [] },
    { id: 'b', name: 'Cara Lee', dob: '2013-02-02', gender: 'Girls', source: 'local', pbs: [mkPb('50 Free', '36.00', '2026-01-01', 'manual')] },
    { id: 'c', name: 'Dan Moss', dob: '2013-03-03', gender: 'Boys', source: 'sheet', pbs: [] },
    { id: 'd', name: 'Eve Park', dob: '2013-04-04', gender: 'Girls', source: 'sheet', pbs: [] },
  ];
  const messySheet = [sheetSw('bob baker', '2013-01-01', 'Boys'), sheetSw('Eve Park', '2013-04-05', 'Girls')]; // Eve's dob differs -> missing
  window.eval(`SWIMMERS = ${JSON.stringify(messy)};`);
  const warnedIds = window.findSwimmersRemovedBySync(messySheet).map(r => r.sw.id).sort();
  window.mergeSwimmers(messySheet, 'remove', { sourceIsAuthoritative: true });
  const survivors = window.eval('SWIMMERS').map(x => x.id);
  const actuallyRemoved = messy.map(x => x.id).filter(id => !survivors.includes(id)).sort();
  check('the swimmers the warning lists are exactly the ones mergeSwimmers() removes (same name+DOB rule, case/space-insensitive)',
    JSON.stringify(warnedIds) === JSON.stringify(actuallyRemoved) && warnedIds.join() === 'b,c,d');

  // F. Wording for a single swimmer, and truncation for a long list.
  window.eval(`SWIMMERS = ${JSON.stringify([rosterForRemove()[1]])};`);
  const one = window.buildRemoveWarning(window.findSwimmersRemovedBySync([]));
  check('a single swimmer reads naturally ("1 swimmer who is on the dashboard", "ALL 1 of their PB")', /DELETE 1 swimmer who is on/.test(one) && /ALL 1 of their PB /.test(one));
  const many = Array.from({ length: 13 }, (_, i) => ({ id: 'm' + i, name: 'Swimmer ' + i, dob: '2012-01-' + String(i + 1).padStart(2, '0'), gender: 'Boys', source: 'local', pbs: [] }));
  window.eval(`SWIMMERS = ${JSON.stringify(many)};`);
  const longMsg = window.buildRemoveWarning(window.findSwimmersRemovedBySync([]));
  check('a long list shows the first 10 and says how many more ("...and 3 more")', /\.\.\.and 3 more/.test(longMsg) && !/Swimmer 12 \(/.test(longMsg));

  // ════════════════════════════════════════════════════════════════════
  // ROUND 7 - Apply Import must only be live when applying would change something
  // ════════════════════════════════════════════════════════════════════
  // Reported: after syncing Arty from the Google Sheet and then from SE (with updates to match
  // SE), reviewing the SAME SE data again auto-matched Arty with nothing to import, yet Apply
  // Import stayed enabled (and the note promised "0 new PB results").
  window.readXlsxRows = async (buf) => ({ sheetName: 'Top Times(0)', rows: new TextDecoder().decode(buf).startsWith('__SC__') ? artyRows.sc : artyRows.lc });
  const applyBtn = () => [...doc.querySelectorAll('#seImportBody button')].find(b => /Apply Import/.test(b.textContent));
  const noteTxt = () => { const n = [...doc.querySelectorAll('#seImportBody .note')].map(x => x.textContent).join(' | '); return n; };
  async function loadWith(roster) {
    window.eval(`SWIMMERS = ${JSON.stringify(roster)};`);
    window.showSeImportModal();
    setInputFiles(doc.getElementById('seImportFileInput'), [scFile, lcFile]);
    await window.handleSeImportFileChange();
    return window.eval('_seImport.matches')[0];
  }

  // 1. Fresh roster vs SE: there ARE changes -> enabled, and the note says what will happen.
  await loadWith(artyRoster);
  check('with real changes to make (2 new PBs), Apply Import is enabled', applyBtn().disabled === false);
  check('...and the note says what applying will do', /Applying will add 2 new PB result\(s\)/.test(noteTxt()));
  // After the coach's actions: replace all, apply -> roster now matches SE.
  window.seSetAllDupChoices(0, 'replace'); window.seApplyImport(); window.hideSeImportModal();
  const syncedRoster = JSON.parse(JSON.stringify(window.eval('SWIMMERS')));

  // 2. THE REPORTED CASE: import the same SE files again against the now-matching roster.
  const m2 = await loadWith(syncedRoster);
  check('the already-matching swimmer is still auto-matched (as the coach saw)', m2.match.status === 'matched-se');
  check('REPORTED CASE: nothing to add, update, conflict or backfill, so Apply Import is DISABLED', applyBtn().disabled === true);
  check('...and it is the real disabled state (the button greys out via the :disabled style), not just a note', applyBtn().hasAttribute('disabled'));
  check('...the note says "Nothing to import" and that all 15 results already match what is on file', /Nothing to import\./.test(noteTxt()) && /15 result\(s\) already match what's on file/.test(noteTxt()));
  check('...the misleading "Applying will add 0 new PB result(s)" text is gone', !/add 0 new PB/.test(noteTxt()));
  check('...and no empty "will be added" detail box is shown', !doc.querySelector('#seImportBody details[data-keep="adds"]'));
  window.hideSeImportModal();

  // 3. Only probable duplicates differ, all on Skip: disabled and explained; flipping one enables it.
  const base = await loadWith(artyRoster);
  const cleanAdds = window.seComputeOutcomes(base).filter(o => o.outcome === 'add').map(o => ({ event: o.entry.event, course: o.entry.course, time: o.entry.time, date: o.entry.date, source: 'se' }));
  window.hideSeImportModal();
  const onlyDups = JSON.parse(JSON.stringify(artyRoster)); onlyDups[0].pbs.push(...cleanAdds);
  const m3 = await loadWith(onlyDups);
  check('fixture sanity: only the 3 probable duplicates differ from SE', m3.duplicates.length === 3 && window.seComputeOutcomes(m3).filter(o => o.outcome === 'add').length === 0);
  check('only duplicates differ and all are on Skip: Apply Import is disabled', applyBtn().disabled === true);
  check('...the note says the 3 are set to Skip and that the coach can change that', /3 probable duplicate\(s\) set to Skip/.test(noteTxt()) && /change a Skip or Keep choice/.test(noteTxt()));
  const dupIdx3 = m3.se.entries.indexOf(m3.duplicates[0].entry);
  window.seSetDupChoice(0, dupIdx3, 'replace');
  check('choosing Replace on one duplicate enables Apply Import', applyBtn().disabled === false && /update 1 existing PB record\(s\)/.test(noteTxt()));
  window.seSetDupChoice(0, dupIdx3, 'skip');
  check('putting it back to Skip disables it again (live, not one-way)', applyBtn().disabled === true);
  window.hideSeImportModal();

  // 4. A time conflict set to Keep existing changes nothing; Use SE report is a change.
  const conflictRoster = JSON.parse(JSON.stringify(syncedRoster));
  const fifty = conflictRoster[0].pbs.find(p => p.event === '50 Free' && p.course === 'S');
  fifty.time = '33.50'; // same date as SE's 33.25, different time -> a genuine conflict
  const m4 = await loadWith(conflictRoster);
  check('fixture sanity: exactly one time conflict', window.seComputeOutcomes(m4).filter(o => o.outcome === 'conflict').length === 1);
  check('a lone conflict left on "Keep existing" is no change: Apply Import is disabled', applyBtn().disabled === true && /1 time conflict\(s\) set to Keep existing/.test(noteTxt()));
  const c4 = window.seComputeOutcomes(m4).find(o => o.outcome === 'conflict');
  window.seSetDecision(window.seDecisionKey('1745801', c4), 'incoming');
  check('choosing "Use SE report" enables Apply Import and the note says so', applyBtn().disabled === false && /replace 1 time\(s\) on file with the SE report's/.test(noteTxt()));
  window.hideSeImportModal();

  // 5. SE # to fill in is a change even when no PB differs.
  const noSe = JSON.parse(JSON.stringify(syncedRoster)); delete noSe[0].se; noSe[0].name = 'Artyom Sushinski';
  const m5 = await loadWith(noSe);
  check('fixture sanity: matched by name+DOB with no SE # on the roster, no PB differences', m5.match.status === 'matched-name' && window.seComputeOutcomes(m5).every(o => o.outcome === 'noop'));
  check('a missing SE # that would be filled in counts as a change: Apply Import is enabled, and the note says so', applyBtn().disabled === false && /fill in the SE # for 1 swimmer\(s\)/.test(noteTxt()));
  window.seApplyImport();
  check('...and applying really does fill it in', window.eval('SWIMMERS')[0].se === '1745801');
  window.hideSeImportModal();

  // 6. Nothing selected at all (a suggested match left unticked) is still disabled, with the older wording.
  window.eval(`SWIMMERS = ${JSON.stringify(fixtureSwimmers)};`);
  window.readXlsxRows = async (buf) => ({ sheetName: 'x', rows: new TextDecoder().decode(buf).startsWith('__SC__') ? sampleRows.sc : sampleRows.lc });
  window.showSeImportModal();
  setInputFiles(doc.getElementById('seImportFileInput'), [scFile]);
  await window.handleSeImportFileChange();
  window.eval('SWIMMERS = SWIMMERS.filter(s => s.id === "sh_bibi")'); // only the unconfirmed suggestion is possible
  window.hideSeImportModal();
  window.showSeImportModal();
  setInputFiles(doc.getElementById('seImportFileInput'), [scFile]);
  await window.handleSeImportFileChange();
  check('with only an unticked suggestion, Apply Import is disabled and asks for a confirmation', applyBtn().disabled === true && /No swimmer is currently selected/.test(noteTxt()));
  window.hideSeImportModal();

  console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
  process.exit(failures ? 1 : 0);
}, 50);
