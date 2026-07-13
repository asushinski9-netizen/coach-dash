const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const swimmers = fs.readFileSync(path.join(__dirname, 'swimmers_pb.json'), 'utf8');
const countyQt = fs.readFileSync(path.join(__dirname, 'county_qt.json'), 'utf8');
const regionalQt = fs.readFileSync(path.join(__dirname, 'regional_qt.json'), 'utf8');

let dom;
let failures = 0;
function check(desc, cond) {
  if (cond) { console.log('PASS -', desc); }
  else { console.log('FAIL -', desc); failures++; }
}

dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'http://localhost/index.html',
  beforeParse(window) {
    // Seed localStorage BEFORE the document's own <script> executes its module-level init.
    window.localStorage.setItem('coach_SWIMMERS', swimmers);
    window.localStorage.setItem('coach_COUNTY_QT_FULL', countyQt);
    window.localStorage.setItem('coach_REGIONAL_QT_FULL', regionalQt);
  }
});

const { window } = dom;

// Give the DOMContentLoaded handler a tick to run.
setTimeout(() => {
  const doc = window.document;

  // ── 1. Overview is the default active tab ──────────────────────
  check('tab-overview panel is active by default',
    doc.getElementById('tab-overview').classList.contains('active'));
  check('tab-county panel is NOT active by default',
    !doc.getElementById('tab-county').classList.contains('active'));
  check('Overview tab button is active by default',
    doc.querySelector('.tab-btn.active').textContent.includes('Overview'));
  check('default bubble margin input is 5', doc.getElementById('bubbleMargin').value === '5');

  // ── 2. Hot Right Now — configurable day cutoff ───────────────────
  // The fixture data's PB dates are fixed historical dates (Nov 2025 - June 2026), so
  // relative to whenever this test actually runs, they may or may not fall within the
  // default 30-day window — that's the feature working as intended, not a bug. Verify the
  // cutoff behavior explicitly, then widen the window before the general grouping/rendering
  // checks below (which are about grouping/card mechanics, not about the cutoff itself, and
  // need the older fixture dates to be visible to have anything to assert against).
  check('default hot-cutoff-days input is 30', doc.getElementById('hotCutoffDays').value === '30');
  const hotCutoffInput = doc.getElementById('hotCutoffDays');
  hotCutoffInput.value = '1';
  window.renderHotList();
  const hotCardsNarrow = doc.querySelectorAll('#overviewHotList .ov-person-card').length;
  console.log('   hot cards with a 1-day cutoff (fixture dates are historical, expect 0 unless a synthetic same-day PB exists):', hotCardsNarrow);
  if (hotCardsNarrow === 0) {
    check('empty state nudges to widen the window (not the "never recorded" message) when older PBs exist but are outside the cutoff',
      doc.getElementById('overviewHotList').textContent.includes('widening the window'));
  }
  hotCutoffInput.value = '3650'; // ~10 years — wide enough that every fixture PB date qualifies
  window.renderHotList();
  const hotCardsWide = doc.querySelectorAll('#overviewHotList .ov-person-card').length;
  check('widening the cutoff to 10 years surfaces cards from the historical fixture data', hotCardsWide > 0);
  check('widening the cutoff never shrinks the eligible pool vs the narrow cutoff', hotCardsWide >= hotCardsNarrow);

  // ── 3. Hot Right Now — grouped by swimmer, card grid (cutoff left wide from above) ──
  const hotCards = doc.querySelectorAll('#overviewHotList .ov-person-card');
  check('hot list renders at least one card', hotCards.length > 0);
  check('hot list caps at 10 cards', hotCards.length <= 10);
  const statEntries = doc.querySelectorAll('#overviewHotList .ov-entry-stat');
  check('hot list entries use the two-line stat layout', statEntries.length > 0);
  if (statEntries.length > 0) {
    const firstEntry = statEntries[0];
    const metaEl = firstEntry.querySelector('.ov-entry-stat-meta');
    const timeEl = firstEntry.querySelector('.ov-entry-stat-time');
    const dateEl = firstEntry.querySelector('.ov-entry-stat-date');
    check('entry contains a meta line (distance/stroke/course) and a stat line (time/date)',
      !!metaEl && !!firstEntry.querySelector('.badge') && !!timeEl && !!dateEl);
    const dateText = dateEl.textContent;
    check(`hot entry date is the compact no-year form (got "${dateText}")`, !/\d{4}/.test(dateText));
    // The whole point of Option B is that the time is the visual lead — bigger and bolder
    // than the meta line, not matched to it.
    const metaFontSize = parseFloat(window.getComputedStyle(metaEl).fontSize);
    const timeFontSize = parseFloat(window.getComputedStyle(timeEl).fontSize);
    check('PB time renders larger than the meta line (it is meant to be the visual lead)',
      timeFontSize > metaFontSize);
    // Time and date must be siblings inside one grouped "result" block, not spread
    // independently across the row — that separation is exactly what read as "scattered".
    check('time and date share the same immediate parent (grouped as one result block)',
      timeEl.parentElement === dateEl.parentElement);
    // Stroke accent bar — color should match STROKE_COLOR for whatever stroke this entry is.
    const borderColor = window.getComputedStyle(firstEntry).borderLeftColor;
    console.log('   first hot entry stroke accent border-left-color:', borderColor);
    check('entry has a non-default (non-border-gray) accent color on its left edge',
      borderColor !== window.getComputedStyle(doc.body).getPropertyValue('--border') && borderColor !== '');
    check('PB time is bold (font-weight >= 700)',
      parseInt(window.getComputedStyle(timeEl).fontWeight, 10) >= 700);
    // (c) Mobile stroke abbreviation via the existing .col-full/.col-abbr pattern, still
    // carried over from the grid design since it's independent of row layout.
    const strokeFullEl = metaEl.querySelector('.col-full');
    const strokeAbbrEl = metaEl.querySelector('.col-abbr');
    check('meta line has both a full stroke name and an abbreviation span',
      !!strokeFullEl && !!strokeAbbrEl);
    if (strokeFullEl && strokeAbbrEl && strokeFullEl.textContent === 'Free') {
      check('Free abbreviates to FR', strokeAbbrEl.textContent === 'FR');
    }
  }
  const hotGrid = doc.querySelector('#overviewHotList .ov-card-grid');
  check('hot list uses the card-grid container', !!hotGrid);
  // A swimmer with 2+ recent PBs should have 2+ entries grouped inside ONE card, not two cards.
  const hotGroups = window.groupRecentPbsBySwimmer();
  const multiPbSwimmer = hotGroups.find(g => g.entries.length > 1);
  if (multiPbSwimmer) {
    const cardsForName = [...hotCards].filter(c => c.querySelector('.ov-person-name').textContent.includes(multiPbSwimmer.name));
    check(`swimmer with multiple recent PBs (${multiPbSwimmer.name}) gets exactly one card`, cardsForName.length === 1);
    if (cardsForName.length === 1) {
      const entryCount = cardsForName[0].querySelectorAll('.ov-person-entry').length;
      check('that card actually lists more than one entry', entryCount > 1 || cardsForName[0].innerHTML.includes('more'));
    }
  } else {
    console.log('   (no swimmer in sample data had 2+ recent PBs to verify grouping against — inconclusive but not a failure)');
  }

  // ── 3. Bubble list — default 3% margin, grouped by swimmer ───────
  const bubbleEl = doc.getElementById('overviewBubbleList');
  check('bubble list rendered something (cards or empty state)', bubbleEl.innerHTML.trim().length > 0);
  const bubbleCardsBefore = doc.querySelectorAll('#overviewBubbleList .ov-person-card').length;

  // Widen the margin a lot and re-render — should show >= as many grouped swimmers.
  const marginInput = doc.getElementById('bubbleMargin');
  marginInput.value = '15';
  window.renderBubbleList();
  console.log('   bubble cards at 3% vs 15% margin (capped at 10):', bubbleCardsBefore, '->', doc.querySelectorAll('#overviewBubbleList .ov-person-card').length);
  check('widening the margin does not shrink the eligible set',
    window.buildBubbleList(15, false).length >= window.buildBubbleList(3, false).length);
  check('bubble cards are capped at 10 even at a wide margin',
    doc.querySelectorAll('#overviewBubbleList .ov-person-card').length <= 10);

  // Include-hidden toggle: with it off, hidden/former swimmers must not appear as bubble cards.
  marginInput.value = '3';
  const includeHiddenBox = doc.getElementById('bubbleIncludeHidden');
  includeHiddenBox.checked = false;
  window.renderBubbleList();
  const namesOff = [...doc.querySelectorAll('#overviewBubbleList .ov-person-name')].map(n => n.textContent);
  check('with toggle off, no swimmer name shows a Hidden/Former tag',
    namesOff.every(n => !n.includes('Hidden') && !n.includes('Former')));

  includeHiddenBox.checked = true;
  window.renderBubbleList();
  const entriesOn = window.buildBubbleList(3, true);
  const hasTaggedEntry = entriesOn.some(e => e.hideReason);
  console.log('   bubble entries with toggle ON:', entriesOn.length, '(any tagged hidden/former:', hasTaggedEntry, ')');

  // ── 5. Squad composition ─────────────────────────────────────────
  const compEl = doc.getElementById('overviewComposition');
  check('composition renders 3 titled cards (squad/gender/age)',
    compEl.querySelectorAll('.ov-comp-card-title').length === 3);
  const compCards = compEl.querySelectorAll('.ov-comp-card');
  check('composition renders exactly 3 cards (gender/squad/age)', compCards.length === 3);

  // Age typically has more categories than gender/squad — should get the 2-column legend
  // automatically (>6 items), while gender (2 items) should not.
  const ageLegendCol = compCards[2].querySelector('.ov-legend-col');
  const ageLegendItemCount = ageLegendCol.querySelectorAll('.ov-legend-item').length;
  check(`Age legend (${ageLegendItemCount} items) gets the multi-col class when it has >6 categories`,
    ageLegendItemCount <= 6 || ageLegendCol.classList.contains('multi-col'));
  const genderLegendCol = compCards[0].querySelector('.ov-legend-col');
  check('Gender legend (2 items) does NOT get the multi-col class', !genderLegendCol.classList.contains('multi-col'));

  // Ring geometry must never be edge-clipped by its own viewBox (R + half stroke-width must
  // stay inside half the viewBox) — clipping here was the root cause of the "flat-sided"
  // donut appearance reported against the previous size.
  const anyCircle = compCards[0].querySelector('svg circle');
  const ringR = parseFloat(anyCircle.getAttribute('r'));
  const ringStroke = parseFloat(anyCircle.getAttribute('stroke-width'));
  const vb = compCards[0].querySelector('svg').getAttribute('viewBox').split(' ').map(Number);
  const halfCanvas = vb[2] / 2;
  check('donut ring geometry has margin inside its viewBox (no edge-clipping)',
    (ringR + ringStroke / 2) < halfCanvas);
  const donuts = compEl.querySelectorAll('svg.ov-donut');
  check('all 3 cards render a pie/donut svg', donuts.length === 3);
  const genderArcs = compCards[0].querySelectorAll('circle[stroke-dasharray]');
  check('gender pie renders 2 colored arcs (Boys + Girls)', genderArcs.length === 2);

  // ── Interactive legend: clicking toggles the category and recomputes % among the rest ──
  const genderTotalTextBefore = compCards[0].querySelector('.ov-donut-total').textContent;
  const girlsLegendItem = [...compCards[0].querySelectorAll('.ov-legend-item')].find(i => i.textContent.includes('Girls'));
  check('Girls legend item exists and is not excluded by default', !!girlsLegendItem && !girlsLegendItem.classList.contains('excluded'));
  girlsLegendItem.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const compAfterToggle = doc.getElementById('overviewComposition');
  const girlsLegendAfter = [...compAfterToggle.querySelectorAll('.ov-comp-card')[0].querySelectorAll('.ov-legend-item')].find(i => i.textContent.includes('Girls'));
  check('clicking Girls legend marks it excluded', girlsLegendAfter.classList.contains('excluded'));
  const genderArcsAfter = compAfterToggle.querySelectorAll('.ov-comp-card')[0].querySelectorAll('circle[stroke-dasharray]');
  check('with Girls excluded, only 1 arc remains (Boys)', genderArcsAfter.length === 1);
  const boysArcAfter = genderArcsAfter[0];
  const boysArcLen = parseFloat(boysArcAfter.getAttribute('stroke-dasharray').split(' ')[0]);
  const boysArcCirc = parseFloat(boysArcAfter.getAttribute('stroke-dasharray').split(' ')[1]);
  check('Boys arc now fills the full circle (100%) since it is the only visible category',
    Math.abs(boysArcLen - boysArcCirc) < 0.01);
  const totalAfterToggle = compAfterToggle.querySelectorAll('.ov-comp-card')[0].querySelector('.ov-donut-total').textContent;
  console.log('   gender chart total before/after hiding Girls:', genderTotalTextBefore, '->', totalAfterToggle);
  check('donut center total updates to reflect only the visible category', totalAfterToggle !== genderTotalTextBefore);

  // Toggle it back on and confirm it's restored to a normal 2-arc state.
  window.eval(`toggleCompChartKey('gender', 'Girls')`);
  const genderArcsRestored = doc.querySelector('#overviewComposition .ov-comp-card').querySelectorAll('circle[stroke-dasharray]');
  check('toggling the same legend key again restores the second arc', genderArcsRestored.length === 2);

  // ── 6. Tab switching round-trip ───────────────────────────────────
  const countyBtn = [...doc.querySelectorAll('.tab-btn')].find(b => b.textContent.includes('County QT'));
  window.showTab('county', countyBtn);
  check('switching to County activates tab-county', doc.getElementById('tab-county').classList.contains('active'));
  check('switching to County deactivates tab-overview', !doc.getElementById('tab-overview').classList.contains('active'));
  const overviewBtn = [...doc.querySelectorAll('.tab-btn')].find(b => b.textContent.includes('Overview'));
  window.showTab('overview', overviewBtn);
  check('switching back to Overview re-activates tab-overview', doc.getElementById('tab-overview').classList.contains('active'));
  check('overview re-render still produces a hot-list card grid', doc.querySelectorAll('#overviewHotList .ov-person-card').length > 0);

  // ── 7. Deliberate hidden-swimmer-in-bubble-list scenario ─────────
  // SWIMMERS is a top-level `let`, so it isn't a window property — mutate it via eval in
  // the page's own realm (per the project's documented jsdom testing approach).
  window.eval(`
    SWIMMERS.push({
      id: 'sw_bubble_hidden_test', name: 'Hidden Bubble Test', dob: '2011-01-01', gender: 'Boys',
      squad: undefined, hidden: true,
      pbs: [{ event: '50 Free', course: 'S', time: '26.00', date: '2026-06-01' }]
    });
  `);
  const offCount = window.buildBubbleList(3, false).filter(e => e.name === 'Hidden Bubble Test').length;
  const onEntries = window.buildBubbleList(3, true).filter(e => e.name === 'Hidden Bubble Test');
  check('hidden swimmer excluded from bubble list when toggle is off', offCount === 0);
  check('hidden swimmer appears in bubble list when toggle is on', onEntries.length > 0);
  check('included hidden swimmer is tagged with a hideReason', onEntries.length > 0 && !!onEntries[0].hideReason);
  if (onEntries.length > 0) console.log('   hideReason for included swimmer:', onEntries[0].hideReason);
  window.eval(`SWIMMERS = SWIMMERS.filter(s => s.id !== 'sw_bubble_hidden_test');`);

  // ── 8. XSS safety on the new Overview surfaces ────────────────────
  // Inject a swimmer with a malicious name + PB competition, matching how Sheets-sync data
  // bypasses sanitiseSwimmersData entirely in production (see known-bugs-and-fixes.md #7).
  window.__xssFired = false;
  window.eval(`
    SWIMMERS.push({
      id: 'sw_xss_test', name: 'Mallory<img src=x onerror="window.__xssFired=true">', dob: '2012-01-01', gender: 'Boys', squad: undefined,
      pbs: [{ event: '50 Free', course: 'S', time: '30.00', date: '2026-07-01', competition: '<img src=x onerror="window.__xssFired=true">' }]
    });
  `);
  window.renderOverview();
  check('malicious swimmer name in Hot Right Now did not execute a script',
    window.__xssFired === false);
  check('malicious name appears as escaped text somewhere in Overview HTML',
    doc.getElementById('tab-overview').innerHTML.includes('&lt;img'));
  // Clean up the injected test swimmer
  window.eval(`SWIMMERS = SWIMMERS.filter(s => s.id !== 'sw_xss_test');`);
  window.renderOverview();

  // ── 9. Age legend shows bare numbers (not "Age N"), full text kept in tooltips ──
  const ageCard2 = doc.querySelectorAll('#overviewComposition .ov-comp-card')[2];
  const ageLegendLabels = [...ageCard2.querySelectorAll('.ov-legend-label')].map(l => l.textContent);
  check('age legend labels are bare numbers, not "Age N"', ageLegendLabels.every(l => /^\d+$/.test(l)));
  const ageLegendTitles = [...ageCard2.querySelectorAll('.ov-legend-item')].map(i => i.getAttribute('title'));
  check('age legend items still say "Age N" in their tooltip title', ageLegendTitles.some(t => /Age \d+/.test(t)));
  const ageArcTitle = ageCard2.querySelector('svg circle[stroke-dasharray] title')?.textContent || '';
  check('age donut arc tooltip also says "Age N", not a bare number', /Age \d+/.test(ageArcTitle));

  // ── 10. Expand/collapse: cards show exactly 1 entry by default, toggle reveals the rest ──
  window.eval(`
    SWIMMERS.push({
      id: 'sw_expand_test', name: 'Zzz ExpandTest', dob: '2010-01-01', gender: 'Girls', squad: undefined,
      pbs: [
        { event: '50 Free',  course: 'S', time: '30.00', date: '2026-07-05' },
        { event: '100 Free', course: 'S', time: '65.00', date: '2026-07-05' },
        { event: '200 Free', course: 'S', time: '140.00', date: '2026-07-05' }
      ]
    });
  `);
  window.renderOverview();
  const hotCards2 = [...doc.querySelectorAll('#overviewHotList .ov-person-card')];
  const expandCard = hotCards2.find(c => c.querySelector('.ov-person-name').textContent.includes('ExpandTest'));
  check('a swimmer with 3 same-day PBs still shows just 1 entry by default',
    !!expandCard && expandCard.querySelectorAll('.ov-person-entry').length === 1);
  const expandBtn = expandCard.querySelector('.ov-expand-toggle');
  check('an expand toggle button is present and says "+2 more"', !!expandBtn && expandBtn.textContent.includes('+2 more'));
  expandBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const expandCardAfter = [...doc.querySelectorAll('#overviewHotList .ov-person-card')]
    .find(c => c.querySelector('.ov-person-name').textContent.includes('ExpandTest'));
  check('clicking the toggle reveals all 3 entries', expandCardAfter.querySelectorAll('.ov-person-entry').length === 3);
  check('the toggle button now reads "Show less"', expandCardAfter.querySelector('.ov-expand-toggle').textContent.includes('Show less'));
  check('expanded card gets the "expanded" class for the darker background treatment',
    expandCardAfter.classList.contains('expanded'));
  window.eval(`toggleHotExpand('Zzz ExpandTest')`); // collapse back
  const expandCardCollapsed = [...doc.querySelectorAll('#overviewHotList .ov-person-card')]
    .find(c => c.querySelector('.ov-person-name').textContent.includes('ExpandTest'));
  check('collapsing back removes the "expanded" class', !expandCardCollapsed.classList.contains('expanded'));
  window.eval(`SWIMMERS = SWIMMERS.filter(s => s.id !== 'sw_expand_test');`);
  window.renderOverview();

  // ── 11. Hot Right Now tie-break: same date, more PBs ranks above fewer PBs (not alphabetical) ──
  window.eval(`
    SWIMMERS.push(
      { id: 'sw_tie_a', name: 'Aaron TieTest', dob: '2011-01-01', gender: 'Boys', squad: undefined,
        pbs: [{ event: '50 Free', course: 'S', time: '30.00', date: '2026-07-08' }] },
      { id: 'sw_tie_z', name: 'Zach TieTest', dob: '2011-01-01', gender: 'Boys', squad: undefined,
        pbs: [
          { event: '50 Free',  course: 'S', time: '30.00', date: '2026-07-08' },
          { event: '100 Free', course: 'S', time: '65.00', date: '2026-07-08' }
        ] }
    );
  `);
  const tieGroups = window.groupRecentPbsBySwimmer();
  const aaronIdx = tieGroups.findIndex(g => g.name === 'Aaron TieTest');
  const zachIdx = tieGroups.findIndex(g => g.name === 'Zach TieTest');
  check('on a tied date, the swimmer with MORE PBs ranks above one with fewer (not alphabetical)',
    zachIdx !== -1 && aaronIdx !== -1 && zachIdx < aaronIdx);
  window.eval(`SWIMMERS = SWIMMERS.filter(s => s.id !== 'sw_tie_a' && s.id !== 'sw_tie_z');`);

  // ── 12. Bubble list tie-break: same closest gap, more opportunities ranks first ──
  // Don't hardcode an assumed age bracket/QT value (that's what broke last time, as "today"
  // advances) — look up the swimmer's REAL bracket and QT row via the app's own functions,
  // then synthesize a time exactly 1% slower than qualify, guaranteed within a 5% margin.
  const bubTieDob = '2010-01-01';
  const bubTieBracket = window.getCountyAgeBracket(bubTieDob);
  const countyQtLive = window.eval('COUNTY_QT');
  const bubTie50Row  = window.lookupQT(countyQtLive, 'Boys', bubTieBracket, '50 Free',  'S');
  const bubTie100Row = window.lookupQT(countyQtLive, 'Boys', bubTieBracket, '100 Back', 'S');
  if (bubTie50Row?.qualify != null && bubTie100Row?.qualify != null) {
    // Both near-miss times are qualify * 1.01 — the SAME ~1% gap for both events, so Zach's
    // two entries tie with Aaron's one entry on pct. Without this, whichever of Zach's two
    // entries happens to have the smaller gap would win on the primary sort (smallest gap)
    // alone, and the test would "pass" without actually exercising the tie-break at all.
    const nearMiss50  = window.secToTime(bubTie50Row.qualify  * 1.01);
    const nearMiss100 = window.secToTime(bubTie100Row.qualify * 1.01);
    console.log(`   bubble tie-break fixture: bracket=${bubTieBracket}, 50Free qualify=${bubTie50Row.qualify} (near-miss ${nearMiss50}), 100Back qualify=${bubTie100Row.qualify} (near-miss ${nearMiss100})`);
    window.eval(`
      SWIMMERS.push(
        { id: 'sw_bub_a', name: 'Aaron BubbleTest', dob: '${bubTieDob}', gender: 'Boys', squad: undefined,
          pbs: [{ event: '50 Free', course: 'S', time: '${nearMiss50}', date: '2026-07-01' }] },
        { id: 'sw_bub_z', name: 'Zach BubbleTest', dob: '${bubTieDob}', gender: 'Boys', squad: undefined,
          pbs: [
            { event: '50 Free',  course: 'S', time: '${nearMiss50}',  date: '2026-07-01' },
            { event: '100 Back', course: 'S', time: '${nearMiss100}', date: '2026-07-01' }
          ] }
      );
    `);
    const bubTieGroups = window.groupBubbleEntriesBySwimmer(5, false);
    const aaronBubIdx = bubTieGroups.findIndex(g => g.name === 'Aaron BubbleTest');
    const zachBubIdx = bubTieGroups.findIndex(g => g.name === 'Zach BubbleTest');
    check('both synthetic bubble-tie swimmers land within the 5% margin', aaronBubIdx !== -1 && zachBubIdx !== -1);
    if (aaronBubIdx !== -1 && zachBubIdx !== -1) {
      const aaronPct = bubTieGroups[aaronBubIdx].entries[0].pct;
      const zachPct = bubTieGroups[zachBubIdx].entries[0].pct;
      console.log(`   Aaron closest gap: ${aaronPct.toFixed(3)}%, Zach closest gap: ${zachPct.toFixed(3)}%`);
      const samePctTie = Math.abs(aaronPct - zachPct) < 0.05;
      check('both synthetic swimmers have the same closest gap % (valid tie-break setup)', samePctTie);
      check('with equal closest gaps, the swimmer with more bubble opportunities (Zach, 2 events) ranks above the one with fewer (Aaron, 1 event)',
        zachBubIdx < aaronBubIdx);
    }
    window.eval(`SWIMMERS = SWIMMERS.filter(s => s.id !== 'sw_bub_a' && s.id !== 'sw_bub_z');`);
    window.renderOverview();
  } else {
    check('bubble tie-break fixture QT rows exist (county_qt.json Boys 50 Free + 100 Back SC for the computed bracket)', false);
  }

  // ── 13b. Bubble List entries use the same grouped stat layout + stroke accent as Hot Right Now ──
  doc.getElementById('bubbleMargin').value = '5';
  window.renderBubbleList();
  const bubbleStatEntries = doc.querySelectorAll('#overviewBubbleList .ov-entry-stat');
  check('bubble list entries use the two-column stat layout', bubbleStatEntries.length > 0);
  if (bubbleStatEntries.length > 0) {
    const be = bubbleStatEntries[0];
    check('bubble entry has meta (tab/event/course), gap% as hero stat, and PB-vs-QT caption',
      !!be.querySelector('.ov-entry-stat-meta') && !!be.querySelector('.badge') &&
      !!be.querySelector('.ov-entry-stat-time') && !!be.querySelector('.ov-entry-stat-date'));
    check('bubble hero stat shows the time difference with no ambiguous +/- sign', /^\d+\.\d{2}s off$/.test(be.querySelector('.ov-entry-stat-time').textContent));
    check('bubble caption shows the QT cutoff time', be.querySelector('.ov-entry-stat-date').textContent.startsWith('QT '));
    const bubbleBorderColor = window.getComputedStyle(be).borderLeftColor;
    check('bubble entry has a stroke accent color on its left edge (not default border gray)',
      bubbleBorderColor !== '' && bubbleBorderColor !== 'rgb(203, 213, 225)');
    // Championship type (County/Regional) on its own row, event + course underneath.
    const bubbleTabEl = be.querySelector('.ov-bubble-meta-tab');
    const bubbleEventEl = be.querySelector('.ov-bubble-meta-event');
    check('bubble meta has a separate championship-type row and event row',
      !!bubbleTabEl && !!bubbleEventEl);
    if (bubbleTabEl && bubbleEventEl) {
      check('championship-type row contains only "County" or "Regional", not the event',
        (bubbleTabEl.textContent === 'County' || bubbleTabEl.textContent === 'Regional') &&
        !bubbleEventEl.textContent.includes('County') && !bubbleEventEl.textContent.includes('Regional'));
      check('event row is visually below the championship-type row',
        bubbleEventEl.compareDocumentPosition(bubbleTabEl) & window.Node.DOCUMENT_POSITION_PRECEDING);
    }
  }

  // ── 14. Hot Right Now — "show all / show fewer" toggle on the capped-count note ──
  // Widen the cutoff to 10 years (from an earlier test step) so there are enough swimmers
  // in the pool to actually exceed HOT_CARD_CAP and trigger the note in the first place.
  doc.getElementById('hotCutoffDays').value = '3650';
  window.renderHotList();
  const hotNoteBefore = doc.getElementById('overviewHotList').querySelector('.note');
  if (hotNoteBefore && hotNoteBefore.querySelector('.ov-inline-link-btn')) {
    const totalHotSwimmers = window.groupRecentPbsBySwimmer().length;
    check('capped note shows "Show all" link when there are more swimmers than the cap',
      hotNoteBefore.querySelector('.ov-inline-link-btn').textContent.includes('Show all'));
    hotNoteBefore.querySelector('.ov-inline-link-btn').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    const hotCardsAfterShowAll = doc.querySelectorAll('#overviewHotList .ov-person-card').length;
    check('clicking "Show all" reveals every swimmer, not just the capped 10',
      hotCardsAfterShowAll === totalHotSwimmers && totalHotSwimmers > 10);
    const hotNoteAfter = doc.getElementById('overviewHotList').querySelector('.note .ov-inline-link-btn');
    check('the link now reads "Show fewer"', hotNoteAfter.textContent.includes('Show fewer'));
    hotNoteAfter.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    check('clicking "Show fewer" re-collapses back to the cap',
      doc.querySelectorAll('#overviewHotList .ov-person-card').length === 10);
    window.eval(`hotShowAll = false;`); // leave state clean for anything after this
  } else {
    console.log('   (fewer than 10 swimmers with PBs in a 10-year window in the fixture — show-all toggle not exercised, not a failure)');
  }

  // ── 15. Age legend label minimum width (root cause of the digit-truncation bug) ──
  const ageCard = doc.querySelectorAll('#overviewComposition .ov-comp-card')[2];
  const ageLabelEl = ageCard.querySelector('.ov-legend-label');
  const labelMinWidth = window.getComputedStyle(ageLabelEl).minWidth;
  console.log('   age legend label computed min-width:', labelMinWidth);
  check('age legend label has a non-zero minimum width (prevents squeeze-to-1-digit)',
    labelMinWidth !== '0px' && labelMinWidth !== '');

  console.log('\n' + (failures === 0 ? `ALL CHECKS PASSED` : `${failures} CHECK(S) FAILED`));
  process.exit(failures === 0 ? 0 : 1);
}, 50);
