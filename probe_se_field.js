// probe_se_field.js — v2.9 (extended after coach UAT feedback, same session)
//
// One-off jsdom probe for this session's scope: the SE # field end-to-end in index.html
// (Add/Edit Swimmer UI, saveSwimmer() validation, editSwimmer() population, mergeSwimmers()
// authoritative-carry-through + soft conflict warning + matched-vs-updated counting,
// sanitiseSwimmersData()'s per-field drop-not-reject validation), the two mobile CSS fixes
// done alongside it, and — added after the coach ran the manual test script and reported real
// issues — a second round covering: the Add/Edit Swimmer modal no longer forcing an empty PB
// row by default; the sync modal's auto-close being disabled whenever there's a genuine
// warning to read; the conflict box scrolling into view when shown; and the round-2 mobile CSS
// fix for the Date of Birth/Date Set fields still rendering wider/taller than their siblings
// after round 1's grid-collapse and font-size fixes.
//
// Not merged into test_overview.js (which is Overview-tab-focused specifically and this
// session touches none of it) and not intended to become a permanent suite — matches the
// precedent probe_fixes.js (v2.7) and probe_backup_restore.js (v2.8) both set for a
// single-session, non-Overview-tab change.
//
// CSS MEDIA-QUERY CAVEAT: jsdom does not evaluate @media conditions against a simulated
// viewport width for getComputedStyle() purposes (there's no real layout engine underneath
// it), so the mobile CSS fixes can't be verified the way the v2.7 gender-pill fix's
// getComputedStyle assertions were (those checked non-media-query rules). Instead, per the
// same project convention v2.7's probe used for a different unverifiable-via-computed-style
// property (the U+FE0E presentation-selector source check), those fixes are verified directly
// against the source CSS text. **This means the round-2 date-input fix is verified as "the
// right CSS rules are present," not as "this visually renders correctly on a real phone" —
// jsdom cannot confirm the latter. The coach's own re-test on a real device is still the real
// verification for 3.1/3.2, same as it was for round 1.**

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let failures = 0;
function check(desc, cond) {
  if (cond) { console.log('PASS -', desc); }
  else { console.log('FAIL -', desc); failures++; }
}

// ────────────────────────────────────────────────────────────────────────
// PART A — source-text checks for the two mobile CSS fixes
// ────────────────────────────────────────────────────────────────────────
const mediaMatch = html.match(/@media \(max-width: 500px\) \{([\s\S]*?)\n\}\n(?=\s*<\/style>)/);
check('mobile @media (max-width: 500px) block is present and captured', !!mediaMatch);
const mobileCss = mediaMatch ? mediaMatch[1] : '';
const restOfCss = html.slice(0, html.indexOf('@media (max-width: 500px)'));

check('mobile block collapses .form-grid-2 and .pb-top-grid to a single column',
  /\.form-grid-2,\s*\.pb-top-grid\s*\{\s*grid-template-columns:\s*1fr;\s*\}/.test(mobileCss));
check('that single-column override does NOT also appear before the mobile block (would break desktop 2-up layout)',
  !/\.form-grid-2,\s*\.pb-top-grid\s*\{\s*grid-template-columns:\s*1fr;\s*\}/.test(restOfCss));

check('mobile block sets 16px font-size on the text-entry classes (fixes iOS auto-zoom-on-focus)',
  /\.form-input,\s*\.name-search,\s*\.qt-inline-input,\s*\.margin-input-group input,\s*select\s*\{\s*font-size:\s*16px;\s*\}/.test(mobileCss));
check('the desktop .form-input rule is untouched (still its original smaller size, not bumped globally)',
  /\.form-input\s*\{[^}]*font-size:\s*0\.83rem/.test(restOfCss));

// ── Round 2 (post-UAT feedback): date input still wider/taller than siblings ────────────
check('mobile block pins a uniform 40px height on .form-input/.name-search/.margin-input-group input/select',
  /\.form-input,\s*\.name-search,\s*\.margin-input-group input,\s*select\s*\{\s*height:\s*40px;\s*\}/.test(mobileCss));
check('mobile block has a type=date-specific rule (stronger than the shared .form-input class) pinning width/height/box-sizing',
  /input\[type="date"\]\.form-input\s*\{[^}]*width:\s*100%;[^}]*height:\s*40px;[^}]*box-sizing:\s*border-box;/.test(mobileCss));
check('mobile block resets the WebKit/Blink internal date sub-element padding (::-webkit-datetime-edit)',
  /input\[type="date"\]\.form-input::-webkit-datetime-edit/.test(mobileCss));
check('mobile block resets the calendar-picker-indicator padding too',
  /input\[type="date"\]\.form-input::-webkit-calendar-picker-indicator/.test(mobileCss));
check('none of the round-2 date-input rules leaked outside the mobile block (desktop date inputs unaffected)',
  !/input\[type="date"\]\.form-input/.test(restOfCss));

// ── v2.9 UAT fix: sync modal auto-close is disabled whenever there's a real warning ──────
// Source-text check rather than a full runtime one: exercising this properly would mean
// mocking startSync()'s fetch() end-to-end for marginal extra confidence over confirming the
// gating logic itself is actually wired up as intended, which is a disproportionate amount of
// scaffolding for what's a straightforward conditional. The three inputs (qtNote/sanitiseNote/
// seConflictNote) and the mergeSwimmers()/sanitiseSwimmersData() functions that feed them are
// already covered by the SE#/merge checks below.
check('startSync() computes hasNotableWarning from qtNote/sanitiseNote/seConflictNote',
  /const hasNotableWarning = !!\(qtNote \|\| sanitiseNote \|\| seConflictNote\)/.test(html));
check('the 3-second auto-close timer is only armed when hasNotableWarning is false',
  /if \(hasNotableWarning\) \{[\s\S]{0,200}\} else \{[\s\S]{0,100}let remaining = 3;/.test(html));

// ────────────────────────────────────────────────────────────────────────
// PART B — SE # feature, via a real jsdom render of index.html
// ────────────────────────────────────────────────────────────────────────
const swimmers = JSON.stringify([
  { id: 'sh_baker__bob', name: 'Bob Baker', dob: '2013-10-18', gender: 'Boys', source: 'sheet', se: '1234567', pbs: [] },
  { id: 'sh_carter__amy', name: 'Amy Carter', dob: '2013-09-23', gender: 'Girls', source: 'sheet', pbs: [] },
]);

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'http://localhost/index.html',
  beforeParse(window) {
    window.localStorage.setItem('coach_SWIMMERS', swimmers);
  }
});
const { window } = dom;

setTimeout(() => {
  const doc = window.document;

  // ── 1. Add/Edit Swimmer modal has the new field, as its own third row ──────
  const seInput = doc.getElementById('asSE');
  check('SE # input field exists in the Add/Edit Swimmer modal', !!seInput);
  const seRow = seInput ? seInput.closest('.form-row') : null;
  check('SE # sits in its own .form-row (a distinct row, not squeezed into the Gender/Squad grid)',
    !!seRow && !seRow.classList.contains('form-grid-2') && seRow.parentElement.className !== 'form-grid-2');
  const genderSquadGrid = doc.getElementById('asGender')?.closest('.form-grid-2');
  check('SE # row comes AFTER the Gender/Squad grid in document order (third row, as requested)',
    !!genderSquadGrid && !!(genderSquadGrid.compareDocumentPosition(seRow) & window.Node.DOCUMENT_POSITION_FOLLOWING));

  // ── 2. showAddSwimmerModal() clears the field for a fresh Add ───────────────
  window.showAddSwimmerModal();
  check('opening Add Swimmer (fresh) leaves SE # blank', doc.getElementById('asSE').value === '');
  check('v2.9 UAT fix: Add Swimmer no longer forces an empty PB row by default (was required extra step to delete before Save)',
    doc.getElementById('asPBList').children.length === 0);

  // ── 3. editSwimmer() populates SE # from the swimmer record ─────────────────
  window.editSwimmer('sh_baker__bob');
  check("editSwimmer() populates the SE # field from the swimmer's existing se", doc.getElementById('asSE').value === '1234567');
  window.hideAddSwimmerModal();

  window.editSwimmer('sh_carter__amy'); // this fixture swimmer has pbs: [] — the exact zero-PB case reported
  check('editSwimmer() leaves SE # blank for a swimmer with no se on record', doc.getElementById('asSE').value === '');
  check('v2.9 UAT fix: editing a swimmer with zero PBs no longer forces an empty PB row either',
    doc.getElementById('asPBList').children.length === 0);
  window.hideAddSwimmerModal();

  // ── 4. saveSwimmer() validation: non-digit SE # is rejected, digit string accepted ──
  window.showAddSwimmerModal();
  doc.getElementById('asName').value = 'Test Newkid';
  doc.getElementById('asDOB').value = '2014-01-01';
  doc.getElementById('asGender').value = 'Boys';
  doc.getElementById('asSE').value = 'ABC123';
  doc.getElementById('asPBList').innerHTML = ''; // no PBs needed for this test — avoids the unrelated "enter a time" validation
  window.saveSwimmer();
  const errEl = doc.getElementById('asError');
  check('saveSwimmer() rejects a non-digit SE # with a visible error', errEl.style.display === 'block' && /SE #/.test(errEl.textContent));
  check('the invalid-SE# swimmer was NOT saved', !window.eval('SWIMMERS').some(s => s.name === 'Test Newkid'));

  doc.getElementById('asSE').value = '  ';
  errEl.style.display = 'none';
  window.saveSwimmer();
  check('an all-whitespace SE # is treated as blank (no error, swimmer saves without an se field)',
    window.eval('SWIMMERS').some(s => s.name === 'Test Newkid' && !('se' in s)));
  window.eval(`SWIMMERS = SWIMMERS.filter(s => s.name !== 'Test Newkid');`);

  window.showAddSwimmerModal();
  doc.getElementById('asName').value = 'Test Newkid Two';
  doc.getElementById('asDOB').value = '2014-01-01';
  doc.getElementById('asGender').value = 'Girls';
  doc.getElementById('asSE').value = '7654321';
  doc.getElementById('asPBList').innerHTML = '';
  window.saveSwimmer();
  check('a valid all-digit SE # is accepted and stored on the new swimmer',
    window.eval('SWIMMERS').some(s => s.name === 'Test Newkid Two' && s.se === '7654321'));
  window.eval(`SWIMMERS = SWIMMERS.filter(s => s.name !== 'Test Newkid Two');`);

  // ── 5. sanitiseSwimmersData(): drops an invalid se but KEEPS the swimmer ────
  const dirtyImport = [
    { name: 'Valid Se', dob: '2012-05-01', gender: 'Boys', se: '9998887', pbs: [] },
    { name: 'Bad Se', dob: '2012-05-02', gender: 'Girls', se: 'not-a-number', pbs: [] },
    { name: 'No Se At All', dob: '2012-05-03', gender: 'Boys', pbs: [] },
  ];
  const sanResult = window.sanitiseSwimmersData(dirtyImport);
  check('sanitiseSwimmersData() keeps a valid numeric se', sanResult.clean.find(s => s.name === 'Valid Se')?.se === '9998887');
  const badSeSwimmer = sanResult.clean.find(s => s.name === 'Bad Se');
  check('sanitiseSwimmersData() drops an invalid se but keeps the swimmer record itself', !!badSeSwimmer && !('se' in badSeSwimmer));
  check('sanitiseSwimmersData() counts the drop in seDropped, not in skipped (the record was not rejected)', sanResult.seDropped === 1 && sanResult.skipped === 0);
  check('describeSanitiseIssues() surfaces the seDropped count in its note', /1 SE # value/.test(window.describeSanitiseIssues(sanResult.skipped, sanResult.datesDropped, sanResult.seDropped)));

  // ── 6. mergeSwimmers(): se carried through authoritatively from an authoritative sync ──
  window.eval(`SWIMMERS = ${swimmers};`); // reset to the known fixture
  const syncNoConflict = [
    { name: 'Bob Baker', dob: '2013-10-18', gender: 'Boys', se: '1234567', pbs: [] }, // same se
  ];
  let result = window.mergeSwimmers(syncNoConflict, 'keep', { sourceIsAuthoritative: true });
  check('matching se on both sides is not flagged as a conflict', result.seConflicts === 0);
  check('se is carried through unchanged when it matches', window.eval('SWIMMERS').find(s => s.name === 'Bob Baker')?.se === '1234567');

  window.eval(`SWIMMERS = ${swimmers};`); // reset again
  const syncNewSe = [
    { name: 'Amy Carter', dob: '2013-09-23', gender: 'Girls', se: '5556667', pbs: [] }, // previously had none
  ];
  result = window.mergeSwimmers(syncNewSe, 'keep', { sourceIsAuthoritative: true });
  check('a swimmer with no prior se gets one from an authoritative sync, with no conflict flagged',
    result.seConflicts === 0 && window.eval('SWIMMERS').find(s => s.name === 'Amy Carter')?.se === '5556667');

  window.eval(`SWIMMERS = ${swimmers};`); // reset again
  const syncConflict = [
    { name: 'Bob Baker', dob: '2013-10-18', gender: 'Boys', se: '9999999', pbs: [] }, // DIFFERENT se
  ];
  result = window.mergeSwimmers(syncConflict, 'keep', { sourceIsAuthoritative: true });
  check('a changed se on an authoritative sync is flagged as a soft conflict (count)', result.seConflicts === 1);
  check('...and named, so the coach knows which swimmer', result.seConflictNames.includes('Bob Baker'));
  check('...but the Sheet still wins — the new value is applied, not silently discarded or blocked',
    window.eval('SWIMMERS').find(s => s.name === 'Bob Baker')?.se === '9999999');

  window.eval(`SWIMMERS = ${swimmers};`); // reset again
  const nonAuthoritativeConflict = [
    { name: 'Bob Baker', dob: '2013-10-18', gender: 'Boys', se: '9999999', pbs: [] },
  ];
  result = window.mergeSwimmers(nonAuthoritativeConflict, 'keep', { sourceIsAuthoritative: false });
  check('a manual-upload MERGE (sourceIsAuthoritative:false) never overwrites an existing se or flags a conflict',
    result.seConflicts === 0 && window.eval('SWIMMERS').find(s => s.name === 'Bob Baker')?.se === '1234567');

  // ── 7. v2.9 UAT fix: "matched" (genuinely unchanged) vs "updated" (something really changed) ──
  window.eval(`SWIMMERS = ${swimmers};`); // reset
  result = window.mergeSwimmers(syncNoConflict, 'keep', { sourceIsAuthoritative: true }); // identical se, identical everything
  check('a swimmer matched with zero actual field changes is counted as "matched", not "updated"',
    result.matched === 1 && result.updated === 0);

  window.eval(`SWIMMERS = ${swimmers};`); // reset
  result = window.mergeSwimmers(syncNewSe, 'keep', { sourceIsAuthoritative: true }); // se genuinely added
  check('a swimmer that genuinely gained a new se is still counted as "updated", not "matched"',
    result.updated === 1 && result.matched === 0);

  // This is the exact real-world scenario reported: download the full roster, hand-edit ONE
  // swimmer, re-upload the whole file as a Merge. Only the edited swimmer should count as
  // "updated"; everyone else in the file should count as "matched" (unchanged), not
  // misleadingly "updated" too. Uses `squad` here (not `se`) deliberately — a non-authoritative
  // merge never touches `se` at all by design (confirmed working as intended in 2.5's manual
  // test), so editing SE # in a downloaded-then-reuploaded file is a no-op either way and
  // wouldn't actually exercise the "updated" counting fix; `squad` genuinely does flow through
  // a merge regardless of authoritative-ness, so it's the field that actually demonstrates it.
  window.eval(`SWIMMERS = ${swimmers};`); // reset
  const fullRosterReupload = [
    { name: 'Bob Baker',  dob: '2013-10-18', gender: 'Boys',  squad: 'Junior', se: '1234567', pbs: [] }, // squad newly set — a real change
    { name: 'Amy Carter', dob: '2013-09-23', gender: 'Girls', pbs: [] }, // completely untouched
  ];
  result = window.mergeSwimmers(fullRosterReupload, 'keep', { sourceIsAuthoritative: false });
  check('v2.9 UAT fix: re-uploading a full roster with exactly one real edit reports 1 updated...', result.updated === 1);
  check('...and the untouched swimmer in the same file is reported as matched, not updated', result.matched === 1);

  // ── 8. v2.9 UAT fix: showDataConflict() scrolls the conflict box into view ──────────────
  let scrolledInto = null;
  window.HTMLElement.prototype.scrollIntoView = function (opts) { scrolledInto = { el: this, opts }; };
  window.showDataConflict('swimmers', [], 'A conflict message for the probe.', { merge: true }, '');
  check('showDataConflict() calls scrollIntoView on the conflict box (fixes it appearing off-screen below the fold)',
    !!scrolledInto && scrolledInto.el === doc.getElementById('dataConflictBox'));
  window.cancelDataConflict();

  // ── 9. Round 2 UAT feedback: sticky action row, dedicated sync Close button, wording fixes ──
  check('Add/Edit Swimmer modal has the sticky .as-action-row wrapping Cancel/Save (always reachable regardless of PB-list length)',
    !!doc.getElementById('asSaveBtn').closest('.as-action-row'));
  check('.as-action-row CSS rule uses position: sticky',
    /\.as-action-row\s*\{[^}]*position:\s*sticky;/.test(html));
  check('sync modal has a dedicated syncCloseBtn, hidden by default in markup',
    /id="syncCloseBtn"[^>]*style="display:none/.test(html));
  check('startSync() shows syncCloseBtn specifically when hasNotableWarning is true',
    /if \(hasNotableWarning\) \{[\s\S]{0,150}syncCloseBtn\.style\.display = '';/.test(html));
  check('the manual-merge upload status message no longer uses the confusing "local kept" wording (sync\'s message, which reflects a real keep/hide/remove choice, is unchanged)',
    /Merged - \$\{result\.added\}[\s\S]{0,250}not in this file \(left as-is\)/.test(html));
  check('SE # field help text says "Google Sheet", not bare "Sheet"',
    /from the club's Google Sheet/.test(html));

  console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`));
  process.exit(failures === 0 ? 0 : 1);
}, 50);
