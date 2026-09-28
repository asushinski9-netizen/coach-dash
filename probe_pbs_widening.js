// probe_pbs_widening.js — v2.10
//
// Dedicated jsdom probe for this session's scope: the pbs schema widening (multiple dated
// entries per event+course), the new per-PB `source` field, mergePbEntry() (locked spec,
// see se-pb-import-and-history-plan.md Section 4), the derived-live current-PB helper
// (getCurrentPbMap), Hot Right Now's redefinition to "recent improvements"
// (computePbImprovements/collectRecentPbs), sanitiseSwimmersData()'s extended validation,
// saveSwimmer()'s source-tagging, and the mergePbs() re-keying fix for the reported
// "manual PBs wiped out by upload" bug.
//
// Per the plan doc's Section 3.3 sign-off requirement, this is IN ADDITION TO a full
// test_overview.js run (see session-log.md v2.10 entry for that result) — this is the first
// of the four SE-import-roadmap sessions where the change genuinely touches what
// test_overview.js asserts on (collectRecentPbs, buildSwimmerRows), so both are required.
//
// Not merged into test_overview.js (which is Overview-tab-focused specifically, and several
// of these checks — mergePbEntry, saveSwimmer's source tagging — are outside its scope) and
// not intended to become a permanent suite — matches the precedent probe_fixes.js (v2.7),
// probe_backup_restore.js (v2.8), and probe_se_field.js (v2.9) all set.

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const swimmers = fs.readFileSync(path.join(__dirname, 'swimmers_pb.json'), 'utf8');
const countyQt = fs.readFileSync(path.join(__dirname, 'county_qt.json'), 'utf8');
const regionalQt = fs.readFileSync(path.join(__dirname, 'regional_qt.json'), 'utf8');

let failures = 0;
function check(desc, cond) {
  if (cond) { console.log('PASS -', desc); }
  else { console.log('FAIL -', desc); failures++; }
}

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'http://localhost/index.html',
  beforeParse(window) {
    window.localStorage.setItem('coach_SWIMMERS', swimmers);
    window.localStorage.setItem('coach_COUNTY_QT_FULL', countyQt);
    window.localStorage.setItem('coach_REGIONAL_QT_FULL', regionalQt);
  }
});
const { window } = dom;

setTimeout(() => {
  const doc = window.document;

  // ────────────────────────────────────────────────────────────────
  // PART A — sanitiseSwimmersData(): widened pbs array + source validation
  // ────────────────────────────────────────────────────────────────

  // A1. Multiple dated entries for the SAME event+course are never deduplicated.
  const multiPbInput = [
    { name: 'Multi Pb', dob: '2012-01-01', gender: 'Boys', pbs: [
      { event: '50 Free', course: 'S', time: '30.00', date: '2026-01-01', source: 'gala' },
      { event: '50 Free', course: 'S', time: '29.50', date: '2026-06-01', source: 'gala' },
      { event: '50 Free', course: 'S', time: '31.00', date: '2025-01-01', source: 'manual' },
    ] },
  ];
  const multiPbResult = window.sanitiseSwimmersData(multiPbInput);
  check('sanitiseSwimmersData() keeps ALL 3 dated entries for the same event+course (no dedup)',
    multiPbResult.clean[0].pbs.length === 3);

  // A2. source field: valid values kept, invalid dropped (PB itself kept), reported via pbSourceDropped.
  const sourceInput = [
    { name: 'Source Test', dob: '2012-01-01', gender: 'Girls', pbs: [
      { event: '50 Free', course: 'S', time: '30.00', date: '2026-01-01', source: 'se' },
      { event: '100 Free', course: 'S', time: '65.00', date: '2026-01-01', source: 'bogus-source' },
      { event: '200 Free', course: 'S', time: '2:30.00', date: '2026-01-01' }, // no source at all
    ] },
  ];
  const sourceResult = window.sanitiseSwimmersData(sourceInput);
  const sw = sourceResult.clean[0];
  check('a valid source ("se") is kept as-is', sw.pbs.find(p => p.event === '50 Free').source === 'se');
  check('an invalid source is dropped, but the PB entry itself is kept',
    sw.pbs.some(p => p.event === '100 Free') && !('source' in sw.pbs.find(p => p.event === '100 Free')));
  check('pbSourceDropped counts exactly the one invalid source value', sourceResult.pbSourceDropped === 1);
  check('a PB with no source field at all is left alone (not flagged, not fatal)',
    !('source' in sw.pbs.find(p => p.event === '200 Free')));
  check('describeSanitiseIssues() surfaces the pbSourceDropped count',
    /1 PB source value/.test(window.describeSanitiseIssues(0, 0, 0, sourceResult.pbSourceDropped)));

  // A3. getPbSource(): defaults to 'gala' for legacy/missing source, per the read-time default.
  check("getPbSource() defaults a missing source to 'gala'", window.getPbSource({ event: '50 Free' }) === 'gala');
  check("getPbSource() returns an explicit source when present", window.getPbSource({ source: 'manual' }) === 'manual');

  // ────────────────────────────────────────────────────────────────
  // PART B — getCurrentPbMap() / buildSwimmerRows(): fastest-of-many is still derived live
  // ────────────────────────────────────────────────────────────────
  const currentPbSwimmer = {
    dob: '2012-01-01', gender: 'Boys',
    pbs: [
      { event: '50 Free', course: 'S', time: '32.00', date: '2025-01-01' },
      { event: '50 Free', course: 'S', time: '29.00', date: '2026-01-01' }, // fastest
      { event: '50 Free', course: 'S', time: '30.50', date: '2024-01-01' },
    ],
  };
  const currentMap = window.getCurrentPbMap(currentPbSwimmer.pbs);
  check('getCurrentPbMap() picks the FASTEST of several entries for the same event+course as the current PB, regardless of date order',
    currentMap['50 Free|S'].time === '29.00');

  // ────────────────────────────────────────────────────────────────
  // PART C — computePbImprovements() / Hot Right Now redefinition
  // ────────────────────────────────────────────────────────────────
  // Three dated swims for the same event+course: 32.00 (improvement, first) -> 33.00 (NOT an
  // improvement, slower than the standing best) -> 29.00 (improvement, new best). Only the
  // two genuine improvements should surface; the 33.00 swim must not.
  const improvementPbs = [
    { event: '50 Free', course: 'S', time: '32.00', date: '2026-01-01' },
    { event: '50 Free', course: 'S', time: '33.00', date: '2026-02-01' },
    { event: '50 Free', course: 'S', time: '29.00', date: '2026-03-01' },
    { event: '50 Free', course: 'S', time: '40.00' }, // undated — must be excluded entirely
  ];
  const improvements = window.computePbImprovements(improvementPbs);
  check('computePbImprovements() returns exactly the 2 genuine improvements, not all 3 dated swims',
    improvements.length === 2 && improvements.every(p => p.time === '32.00' || p.time === '29.00'));
  check('the non-improving 33.00 swim is excluded', !improvements.some(p => p.time === '33.00'));
  check('the undated 40.00 entry is excluded entirely (cannot be placed chronologically)',
    !improvements.some(p => p.time === '40.00'));

  // End-to-end: Hot Right Now (collectRecentPbs -> renderHotList) must not surface the
  // non-improving middle swim for a real swimmer injected into SWIMMERS.
  window.eval(`
    SWIMMERS.push({
      id: 'sw_improve_test', name: 'Ida ImproveTest', dob: '2012-01-01', gender: 'Girls', squad: undefined,
      pbs: [
        { event: '50 Free', course: 'S', time: '32.00', date: '2026-07-01' },
        { event: '50 Free', course: 'S', time: '33.00', date: '2026-07-08' },
        { event: '50 Free', course: 'S', time: '29.00', date: '2026-07-15' }
      ]
    });
  `);
  const hotCutoff = doc.getElementById('hotCutoffDays');
  hotCutoff.value = '3650';
  window.renderHotList();
  const ideaCard = [...doc.querySelectorAll('#overviewHotList .ov-person-card')]
    .find(c => c.querySelector('.ov-person-name').textContent.includes('ImproveTest'));
  check('Hot Right Now renders a card for the improvement-test swimmer', !!ideaCard);
  // Cards show only entries[0] by default (collapsed) — check the underlying grouped data,
  // not just what's rendered before expanding, to see every entry Hot Right Now considers.
  const ideaGroup = window.groupRecentPbsBySwimmer().find(g => g.name === 'Ida ImproveTest');
  check('Hot Right Now\'s underlying data has exactly the 2 genuine improvements for this swimmer, never the non-improving 33.00',
    !!ideaGroup && ideaGroup.entries.length === 2 &&
    ideaGroup.entries.some(e => e.time === '32.00') && ideaGroup.entries.some(e => e.time === '29.00') &&
    !ideaGroup.entries.some(e => e.time === '33.00'));
  window.eval(`SWIMMERS = SWIMMERS.filter(s => s.id !== 'sw_improve_test');`);
  window.renderOverview();

  // ────────────────────────────────────────────────────────────────
  // PART D — mergePbEntry() — locked spec from se-pb-import-and-history-plan.md Section 4
  // ────────────────────────────────────────────────────────────────
  const basePbs = [
    { event: '50 Free', course: 'S', time: '30.00', date: '2026-01-01', source: 'gala', competition: 'Watford SC County Qualifier 2025 - Session 2' },
  ];

  // D1. Add: no existing entry matches event+course+date -> auto-append, no review needed.
  const addResult = window.mergePbEntry(basePbs, { event: '100 Free', course: 'S', time: '65.00', date: '2026-02-01', source: 'se' });
  check("mergePbEntry(): no match on event+course+date -> outcome 'add'", addResult.outcome === 'add');
  check('mergePbEntry() add: original array untouched (new array returned)', basePbs.length === 1);
  check('mergePbEntry() add: the new pbs array has both the original and the added entry', addResult.pbs.length === 2);
  check('mergePbEntry() add: the added entry carries the incoming source', addResult.pbs[1].source === 'se');

  // D2. No-op: same event+course+date AND same time -> nothing changes, source stays sticky
  // even when the incoming source differs from what's already stored.
  const noopResult = window.mergePbEntry(basePbs, { event: '50 Free', course: 'S', time: '30.00', date: '2026-01-01', source: 'se' });
  check("mergePbEntry(): same event+course+date+time -> outcome 'noop'", noopResult.outcome === 'noop');
  check('mergePbEntry() no-op: source is STICKY — stays "gala" even though the incoming record says "se"',
    noopResult.pbs[0].source === 'gala');
  check('mergePbEntry() no-op: time/competition unchanged too', noopResult.pbs[0].time === '30.00' && noopResult.pbs[0].competition === basePbs[0].competition);

  // D3. Conflict: same event+course+date, DIFFERENT time -> surfaced, never auto-resolved.
  const conflictResult = window.mergePbEntry(basePbs, { event: '50 Free', course: 'S', time: '29.50', date: '2026-01-01', source: 'se', competition: 'Official SE Report' });
  check("mergePbEntry(): same event+course+date, different time -> outcome 'conflict'", conflictResult.outcome === 'conflict');
  check('mergePbEntry() conflict: nothing has changed yet (pbs array is the pre-conflict state)',
    conflictResult.pbs[0].time === '30.00');
  check('mergePbEntry() conflict: existingEntry/incomingEntry/index are all provided for the caller\'s UI',
    conflictResult.existingEntry.time === '30.00' && conflictResult.incomingEntry.time === '29.50' && conflictResult.index === 0);

  // D4. Resolving a conflict as "keep existing" -> no change at all.
  const keptPbs = window.resolvePbEntryConflict(basePbs, conflictResult.index, conflictResult.incomingEntry, 'keep');
  check('resolvePbEntryConflict("keep"): nothing changes', keptPbs[0].time === '30.00' && keptPbs[0].source === 'gala');

  // D5. Resolving a conflict as "use incoming" -> full straight replacement: time + source
  // update; competition too, UNLESS the incoming competition is a truncated fragment of the
  // fuller existing one (SE's 30-char truncation rule).
  const incomingPbs = window.resolvePbEntryConflict(basePbs, conflictResult.index, conflictResult.incomingEntry, 'incoming');
  check('resolvePbEntryConflict("incoming"): time updates to the incoming value', incomingPbs[0].time === '29.50');
  check('resolvePbEntryConflict("incoming"): source updates to the incoming value', incomingPbs[0].source === 'se');
  check('resolvePbEntryConflict("incoming"): a genuinely different (non-truncated) competition DOES overwrite',
    incomingPbs[0].competition === 'Official SE Report');

  // D6. Competition truncation-preference rule: an incoming competition that IS a truncated
  // (exactly 30-char) fragment of the existing fuller value must NOT overwrite it.
  const fullerComp = 'Watford SC County Qualifier 2025 - Session 2'; // > 30 chars
  const truncatedComp = fullerComp.slice(0, 30); // exactly 30 chars, a real fragment
  check('fixture sanity: the truncated fragment is exactly 30 chars and a real prefix of the fuller value',
    truncatedComp.length === 30 && fullerComp.startsWith(truncatedComp));
  const truncationPbs = [{ event: '50 Free', course: 'S', time: '30.00', date: '2026-01-01', source: 'gala', competition: fullerComp }];
  const truncConflict = window.mergePbEntry(truncationPbs, { event: '50 Free', course: 'S', time: '29.00', date: '2026-01-01', source: 'se', competition: truncatedComp });
  const afterTruncResolve = window.resolvePbEntryConflict(truncationPbs, truncConflict.index, truncConflict.incomingEntry, 'incoming');
  check('resolvePbEntryConflict("incoming") does NOT let a truncated SE fragment clobber a fuller existing competition name',
    afterTruncResolve[0].competition === fullerComp);

  // D7. A brand-new add with no matching existing entry defaults to 'manual' if the incoming
  // record itself specifies no source (matches saveSwimmer()'s own default).
  const addNoSourceResult = window.mergePbEntry([], { event: '50 Back', course: 'S', time: '35.00', date: '2026-01-01' });
  check("mergePbEntry() add with no incoming source defaults to 'manual'", addNoSourceResult.pbs[0].source === 'manual');

  // ────────────────────────────────────────────────────────────────
  // PART E — mergePbs() bug fix: manual PBs surviving an upload/sync merge
  // ────────────────────────────────────────────────────────────────
  // Reproduces the exact reported scenario: a swimmer has TWO manually-entered PBs for the
  // SAME event+course on different dates. A gala-sync/upload-merge then brings in a faster
  // time for that same event, on a THIRD, different date. Before the v2.10 fix, mergePbs()
  // keyed purely by event+course and would silently collapse this down to one surviving
  // entry, discarding the coach's manually-entered history.
  const manualTwoPbs = [
    { event: '50 Free', course: 'S', time: '31.00', date: '2025-01-01' },
    { event: '50 Free', course: 'S', time: '30.50', date: '2025-06-01' },
  ];
  const incomingFasterPb = [
    { event: '50 Free', course: 'S', time: '29.80', date: '2026-01-01' },
  ];
  const mergedPbsResult = window.mergePbs(manualTwoPbs, incomingFasterPb);
  check('mergePbs() bug fix: BOTH original manual PBs survive a merge bringing in a faster time on a different date',
    mergedPbsResult.some(p => p.date === '2025-01-01') && mergedPbsResult.some(p => p.date === '2025-06-01'));
  check('mergePbs() bug fix: the incoming faster entry is also present as its own distinct dated entry',
    mergedPbsResult.some(p => p.date === '2026-01-01' && p.time === '29.80'));
  check('mergePbs() bug fix: exactly 3 distinct dated entries survive in total (nothing lost, nothing duplicated)',
    mergedPbsResult.length === 3);

  // Same-date collision still behaves as before: if the incoming entry genuinely shares the
  // same event+course+date as an existing one, "keep whichever time is faster" still applies
  // (this is a real duplicate-report situation, not two different swims).
  const sameDateExisting = [{ event: '100 Back', course: 'S', time: '80.00', date: '2026-03-01' }];
  const sameDateIncomingSlower = [{ event: '100 Back', course: 'S', time: '81.00', date: '2026-03-01' }];
  const sameDateResultSlower = window.mergePbs(sameDateExisting, sameDateIncomingSlower);
  check('mergePbs() same-date collision: a SLOWER incoming time for the exact same date does not overwrite the faster existing one',
    sameDateResultSlower.length === 1 && sameDateResultSlower[0].time === '80.00');
  const sameDateIncomingFaster = [{ event: '100 Back', course: 'S', time: '79.00', date: '2026-03-01' }];
  const sameDateResultFaster = window.mergePbs(sameDateExisting, sameDateIncomingFaster);
  check('mergePbs() same-date collision: a FASTER incoming time for the exact same date DOES overwrite',
    sameDateResultFaster.length === 1 && sameDateResultFaster[0].time === '79.00');

  // End-to-end through mergeSwimmers(), the actual code path a real upload-merge or sync
  // runs through — not just the pure mergePbs() unit above.
  window.eval(`SWIMMERS = ${swimmers};`); // reset to the known fixture
  window.eval(`
    SWIMMERS.push({
      id: 'sw_manual_two_pbs', name: 'Mia ManualTwoPbs', dob: '2012-01-01', gender: 'Girls', squad: undefined,
      pbs: [
        { event: '50 Free', course: 'S', time: '31.00', date: '2025-01-01', source: 'manual' },
        { event: '50 Free', course: 'S', time: '30.50', date: '2025-06-01', source: 'manual' }
      ]
    });
  `);
  const uploadMergeFile = [
    { name: 'Mia ManualTwoPbs', dob: '2012-01-01', gender: 'Girls', pbs: [
      { event: '50 Free', course: 'S', time: '29.80', date: '2026-01-01' },
    ] },
  ];
  window.mergeSwimmers(uploadMergeFile, 'keep', { sourceIsAuthoritative: false });
  const miaAfterMerge = window.eval('SWIMMERS').find(s => s.name === 'Mia ManualTwoPbs');
  check('End-to-end via mergeSwimmers() (manual-upload merge path): both original manual PBs survive',
    miaAfterMerge.pbs.some(p => p.date === '2025-01-01') && miaAfterMerge.pbs.some(p => p.date === '2025-06-01'));
  check('End-to-end via mergeSwimmers(): the uploaded faster PB is present as its own entry, not a replacement',
    miaAfterMerge.pbs.some(p => p.date === '2026-01-01' && p.time === '29.80'));
  check('End-to-end via mergeSwimmers(): exactly 3 pbs total for this swimmer after the merge', miaAfterMerge.pbs.length === 3);
  window.eval(`SWIMMERS = SWIMMERS.filter(s => s.id !== 'sw_manual_two_pbs');`);

  // ────────────────────────────────────────────────────────────────
  // PART F — saveSwimmer() source-tagging
  // ────────────────────────────────────────────────────────────────
  window.eval(`SWIMMERS = ${swimmers};`); // reset

  // F1. A brand-new swimmer's PBs are all tagged 'manual'.
  window.showAddSwimmerModal();
  doc.getElementById('asName').value = 'Fiona SourceTest';
  doc.getElementById('asDOB').value = '2013-01-01';
  doc.getElementById('asGender').value = 'Girls';
  window.addPBRow();
  const newRow = doc.getElementById('asPBList').lastElementChild;
  newRow.querySelector('.as-event').value = '50 Free';
  newRow.querySelector('.as-course').value = 'S';
  newRow.querySelector('.as-time').value = '32.00';
  newRow.querySelector('.as-date').value = '2026-01-01';
  window.saveSwimmer();
  const fiona = window.eval('SWIMMERS').find(s => s.name === 'Fiona SourceTest');
  check('saveSwimmer(): a brand-new swimmer\'s PB is tagged source "manual"', !!fiona && fiona.pbs[0].source === 'manual');

  // F2. Editing a DIFFERENT field (not touching PBs) on an existing gala-sourced swimmer
  // preserves the original source on every untouched PB entry — must NOT silently
  // reclassify existing gala history as "manual" just because the form re-saves the array.
  window.eval(`
    SWIMMERS.push({
      id: 'sw_source_preserve', name: 'Gary SourcePreserve', dob: '2012-01-01', gender: 'Boys', squad: undefined,
      pbs: [{ event: '50 Free', course: 'S', time: '30.00', date: '2026-01-01', source: 'gala' }]
    });
  `);
  window.editSwimmer('sw_source_preserve');
  doc.getElementById('asSquad').value = 'Junior'; // touch an unrelated field only
  window.saveSwimmer();
  const gary = window.eval('SWIMMERS').find(s => s.id === 'sw_source_preserve');
  check('saveSwimmer(): editing an unrelated field preserves the untouched PB\'s original source ("gala"), not silently reclassified to "manual"',
    gary.pbs[0].source === 'gala');
  check('saveSwimmer(): the unrelated field edit (squad) did apply', gary.squad === 'Junior');

  // F3. Editing that SAME swimmer and genuinely changing the PB's time tags it 'manual'
  // (a human just typed a new value into the form).
  window.editSwimmer('sw_source_preserve');
  const editRow = doc.getElementById('asPBList').querySelector('.pb-event-row');
  editRow.querySelector('.as-time').value = '29.50'; // genuinely change the time
  window.saveSwimmer();
  const garyAfterEdit = window.eval('SWIMMERS').find(s => s.id === 'sw_source_preserve');
  check('saveSwimmer(): a genuinely CHANGED PB time is re-tagged "manual" (a human just edited it)',
    garyAfterEdit.pbs[0].time === '29.50' && garyAfterEdit.pbs[0].source === 'manual');
  window.eval(`SWIMMERS = SWIMMERS.filter(s => s.id !== 'sw_source_preserve' && s.name !== 'Fiona SourceTest');`);

  // ────────────────────────────────────────────────────────────────
  // PART G — XSS safety still holds with a WIDENED pbs array (per v2.6 precedent, extended)
  // ────────────────────────────────────────────────────────────────
  const xssWidenedInput = [
    { name: 'Xss Widened', dob: '2012-01-01', gender: 'Boys', pbs: [
      { event: '50 Free', course: 'S', time: '30.00', date: '2026-01-01' },        // valid
      { event: '50 Free', course: '"><img src=x onerror=1>', time: '29.00', date: '2026-02-01' }, // malicious course
      { event: '50 Free', course: 'S', time: '28.00', date: '2026-03-01' },        // valid, later date, faster
    ] },
  ];
  const xssResult = window.sanitiseSwimmersData(xssWidenedInput);
  check('sanitiseSwimmersData() drops just the malicious-course entry, keeping the other 2 valid dated entries for the same event+course',
    xssResult.clean[0].pbs.length === 2 && xssResult.clean[0].pbs.every(p => p.course === 'S'));

  // ────────────────────────────────────────────────────────────────
  // PART H — Backup & Restore needs zero changes for the widened schema (verify, don't assume)
  // ────────────────────────────────────────────────────────────────
  // downloadBackupBundle()/applyBackupRestore() themselves were untouched this session (per
  // architecture.md's design bet) — the actual point of contact is that loadBackupFile()
  // pre-sanitises the bundle's `swimmers` piece through the SAME sanitiseSwimmersData() call
  // already verified above. Confirming that call handles a bundle-shaped payload with widened
  // pbs + source data correctly is the real test of "needs zero changes," rather than assuming it.
  const bundleShapedSwimmers = [
    { id: 'sh_bundle_test', name: 'Backup BundleTest', dob: '2012-01-01', gender: 'Girls', source: 'sheet', pbs: [
      { event: '50 Free', course: 'S', time: '31.00', date: '2025-01-01', source: 'manual' },
      { event: '50 Free', course: 'S', time: '30.00', date: '2026-01-01', source: 'gala' },
      { event: '100 Free', course: 'S', time: '65.00', date: '2026-01-01', source: 'se' },
    ] },
  ];
  const bundleResult = window.sanitiseSwimmersData(bundleShapedSwimmers);
  check('Backup & Restore compatibility: sanitiseSwimmersData() round-trips a bundle-shaped payload with widened pbs + source with zero data loss',
    bundleResult.clean[0].pbs.length === 3 &&
    bundleResult.clean[0].pbs.every(p => ['gala', 'se', 'manual'].includes(p.source)));
  check('Backup & Restore compatibility: no special-casing was needed — same function, same call shape as every other path',
    bundleResult.skipped === 0 && bundleResult.pbSourceDropped === 0);

  console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`));
  process.exit(failures === 0 ? 0 : 1);
}, 50);
