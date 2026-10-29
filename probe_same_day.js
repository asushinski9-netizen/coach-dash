// probe_same_day.js - v2.12
//
// Dedicated jsdom probe for v2.12 (a), dashboard side: a heat and a final on the same day are two
// real swims. Covers mergePbs() (keys now include the time; SE protection only fires for a swim
// FASTER than the SE-confirmed time), mergePbEntry()/seComputeOutcomes() (match the same-day entry
// with the same time before declaring a conflict), computePbImprovements() (one improvement per
// event per day), and the sync wiring for the v2.4 payload's `warnings`.
// Standing rule: every PB read/write path is checked with a swimmer holding SEVERAL entries for one
// event+course.
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, process.env.INDEX_FILE || 'index.html'), 'utf8');
const dir = process.env.FIXTURE_DIR || __dirname;
const swimmers = fs.readFileSync(path.join(dir, 'swimmers_pb.json'), 'utf8');
const countyQt = fs.readFileSync(path.join(dir, 'county_qt.json'), 'utf8');
const regionalQt = fs.readFileSync(path.join(dir, 'regional_qt.json'), 'utf8');

let failures = 0;
const check = (d, c) => { console.log(c ? 'PASS -' : 'FAIL -', d); if (!c) failures++; };

const dom = new JSDOM(html, {
  runScripts: 'dangerously', resources: 'usable', url: 'http://localhost/index.html',
  beforeParse(window) {
    window.localStorage.setItem('coach_SWIMMERS', swimmers);
    window.localStorage.setItem('coach_COUNTY_QT_FULL', countyQt);     // loaded so the "no QT" note never holds the sync dialog open
    window.localStorage.setItem('coach_REGIONAL_QT_FULL', regionalQt);
  },
});
const { window } = dom;

setTimeout(async () => {
  const doc = window.document;
  const T = (ev, time, date, source) => ({ event: ev, course: 'S', time, date, ...(source ? { source } : {}) });
  const D = '2026-07-04';
  const BUILD = (html.match(/EXPECTED_SCRIPT_BUILD = '([^']+)'/) || [])[1];

  // ── A. mergePbs: same-day swims ──────────────────────────────────────────
  let r = window.mergePbs([T('100 Back', '1:23.90', D, 'gala')], [T('100 Back', '1:25.10', D), T('100 Back', '1:23.90', D)]);
  check('A1 local final + Sheet heat and final -> both swims, no duplicate', r.pbs.length === 2 && r.pbs.some(p => p.time === '1:25.10') && r.pbs.filter(p => p.time === '1:23.90').length === 1);
  check('A1b ...and the existing entry keeps its source (sticky, not replaced by the Sheet copy)', r.pbs.find(p => p.time === '1:23.90').source === 'gala' && r.seProtected === 0);

  r = window.mergePbs([T('100 Back', '1:25.10', D, 'manual'), T('100 Back', '1:23.90', D, 'manual')], []);
  check('A2 two same-day LOCAL entries both survive a merge (they used to collapse to one)', r.pbs.length === 2);
  r = window.mergePbs([T('100 Back', '1:25.10', D, 'manual'), T('100 Back', '1:23.90', D, 'manual')], [T('100 Back', '1:25.10', D), T('100 Back', '1:23.90', D)]);
  check('A3 Sheet brings the same two swims again -> still 2 entries, manual source preserved', r.pbs.length === 2 && r.pbs.every(p => p.source === 'manual'));

  r = window.mergePbs([T('100 Back', '1:20.00', D)], [T('100 Back', '1:21.00', D)]);
  check('A4 a SLOWER Sheet swim on the same day as a non-SE entry is added, not discarded', r.pbs.length === 2);
  r = window.mergePbs([T('100 Back', '1:20.00', D)], [T('100 Back', '1:19.00', D)]);
  check('A5 a FASTER Sheet swim on the same day is added too (the old entry is no longer overwritten)', r.pbs.length === 2 && r.pbs.some(p => p.time === '1:19.00') && r.pbs.some(p => p.time === '1:20.00'));
  r = window.mergePbs([T('100 Back', '83.90', D)], [T('100 Back', '1:23.90', D)]);
  check('A5b the same swim written "83.90" and "1:23.90" is recognised as one swim', r.pbs.length === 1);

  // SE-confirmed entries (source 'se')
  const SE = [T('100 Back', '1:23.90', D, 'se')];
  r = window.mergePbs(SE, [T('100 Back', '1:25.10', D)]);
  check('A6 a Sheet swim SLOWER than the SE time on that date is plausibly the heat: added, no warning', r.pbs.length === 2 && r.seProtected === 0);
  r = window.mergePbs(SE, [T('100 Back', '1:22.00', D)]);
  check('A7 a Sheet swim FASTER than the SE time on that date cannot be right: protected, counted, not added', r.pbs.length === 1 && r.pbs[0].time === '1:23.90' && r.seProtected === 1);
  r = window.mergePbs(SE, [T('100 Back', '1:23.90', D)]);
  check('A8 the Sheet agreeing with the SE time changes and counts nothing', r.pbs.length === 1 && r.seProtected === 0 && r.seSuppressed === 0);
  r = window.mergePbs(SE, [T('100 Back', '1:25.10', D), T('100 Back', '1:22.00', D)]);
  check('A9 heat + implausible-fast row together: heat added (2 entries), fast one protected (1 counted)', r.pbs.length === 2 && r.seProtected === 1 && !r.pbs.some(p => p.time === '1:22.00'));
  r = window.mergePbs(SE, [T('100 Back', '1:23.90', '2026-02-02')]);
  check('A10 same time on a different date as an SE entry is still suppressed (the replaced-date correction survives a re-sync)', r.pbs.length === 1 && r.seSuppressed === 1);
  r = window.mergePbs([T('50 Fly', '40.00', '2026-01-01', 'se')], [T('50 Fly', '38.00', '2026-05-01')]);
  check('A11 a genuinely new swim on another date is added normally', r.pbs.length === 2 && r.seProtected === 0);

  // undated (old behaviour kept)
  const U = (t) => ({ event: '50 Free', course: 'S', time: t });
  r = window.mergePbs([U('33.25')], [U('32.00')]);
  check('A12 undated: a faster undated Sheet swim replaces the old undated one (still one entry)', r.pbs.length === 1 && r.pbs[0].time === '32.00');
  r = window.mergePbs([U('33.25')], [U('34.00')]);
  check('A13 undated: a slower one changes nothing', r.pbs.length === 1 && r.pbs[0].time === '33.25');

  // ── A2. mergeSwimmers end to end ─────────────────────────────────────────
  const sheetSw = () => [{ name: 'Bob Baker', dob: '2013-10-18', gender: 'Boys', source: 'sheet', pbs: [T('100 Back', '1:25.10', D), T('100 Back', '1:23.90', D), T('100 Back', '1:22.50', '2026-07-20')] }];
  window.eval(`SWIMMERS = []`);
  let s1 = window.mergeSwimmers(sheetSw(), 'keep', { sourceIsAuthoritative: true });
  check('B1 first sync adds the swimmer with all 3 dated swims', s1.added === 1 && window.eval('SWIMMERS[0].pbs.length') === 3);
  const after1 = JSON.stringify(window.eval('SWIMMERS[0].pbs'));
  let s2 = window.mergeSwimmers(sheetSw(), 'keep', { sourceIsAuthoritative: true });
  check('B2 an identical second sync is a no-op: "matched" not "updated", PBs byte-identical (idempotent)', s2.matched === 1 && s2.updated === 0 && JSON.stringify(window.eval('SWIMMERS[0].pbs')) === after1);
  window.eval(`SWIMMERS = [{ id:'m', name:'Bob Baker', dob:'2013-10-18', gender:'Boys', source:'sheet', pbs:[
    {event:'100 Back',course:'S',time:'1:26.00',date:'2026-07-04',source:'manual'},
    {event:'100 Back',course:'S',time:'1:24.00',date:'2026-07-04',source:'manual'}] }]`);
  window.mergeSwimmers(sheetSw(), 'keep', { sourceIsAuthoritative: true });
  const pbsB3 = window.eval('SWIMMERS[0].pbs');
  check('B3 a swimmer with two manual same-day entries keeps both after a sync that brings the Sheet\'s own heat/final + a later swim (2 + 3 = 5)', pbsB3.length === 5 && pbsB3.filter(p => p.source === 'manual').length === 2);

  // ── C. mergePbEntry / seComputeOutcomes ──────────────────────────────────
  const two = [T('100 Back', '1:25.10', D, 'manual'), T('100 Back', '1:23.90', D, 'manual')];
  const inc = (t) => ({ event: '100 Back', course: 'S', date: D, time: t, source: 'se' });
  let m = window.mergePbEntry(two, inc('1:23.90'));
  check('C1 SE time equals the FINAL (second of two same-day entries) -> noop, not a false conflict against the heat', m.outcome === 'noop');
  m = window.mergePbEntry(two, inc('1:25.10'));
  check('C2 SE time equals the HEAT -> noop', m.outcome === 'noop');
  m = window.mergePbEntry(two, inc('1:22.00'));
  check('C3 SE time matches neither -> conflict against the FASTEST same-day entry', m.outcome === 'conflict' && m.existingEntry.time === '1:23.90' && two[m.index].time === '1:23.90');
  const resolved = window.resolvePbEntryConflict(two, m.index, m.incomingEntry, 'incoming');
  check('C4 resolving "use SE" changes only that entry; the other same-day swim is untouched', resolved.length === 2 && resolved.some(p => p.time === '1:25.10' && p.source === 'manual') && resolved.some(p => p.time === '1:22.00' && p.source === 'se'));
  m = window.mergePbEntry([T('100 Back', '1:23.90', D, 'manual')], inc('1:22.00'));
  check('C5 single-entry behaviour is unchanged (conflict on same date, different time)', m.outcome === 'conflict' && m.index === 0);
  m = window.mergePbEntry(two, { ...inc('1:21.00'), date: '2026-08-01' });
  check('C6 a different date is still a plain add', m.outcome === 'add' && m.pbs.length === 3);
  const outcomes = window.seComputeOutcomes({ match: { swimmer: { pbs: two } }, se: { entries: [{ event: '100 Back', course: 'S', time: '1:23.90', date: D }] }, duplicates: [] });
  check('C7 seComputeOutcomes for a swimmer with heat+final whose SE time is the final -> noop (nothing to apply)', outcomes.length === 1 && outcomes[0].outcome === 'noop');

  // ── D. computePbImprovements / Hot Right Now ─────────────────────────────
  const hist = [T('100 Back', '1:30.00', '2026-06-01'), T('100 Back', '1:25.10', D), T('100 Back', '1:23.90', D)];
  let imp = window.computePbImprovements(hist);
  check('D1 heat (1:25.10) then final (1:23.90) the same day: ONE improvement for that day, the fastest', imp.length === 2 && imp.some(p => p.time === '1:30.00') && imp.some(p => p.time === '1:23.90') && !imp.some(p => p.time === '1:25.10'));
  imp = window.computePbImprovements([hist[0], hist[2], hist[1]]);
  check('D2 order of the two same-day entries in the array does not matter', imp.length === 2 && imp.some(p => p.time === '1:23.90') && !imp.some(p => p.time === '1:25.10'));
  imp = window.computePbImprovements([T('100 Back', '1:20.00', '2026-06-01'), T('100 Back', '1:25.10', D), T('100 Back', '1:23.90', D)]);
  check('D3 a day whose fastest swim is slower than the standing best is no improvement at all', imp.length === 1 && imp[0].time === '1:20.00');
  imp = window.computePbImprovements([T('100 Back', '1:25.10', D), T('100 Back', '1:25.10', D)]);
  check('D3b two identical same-day entries count once', imp.length === 1);
  window.eval(`SWIMMERS.push({ id:'sw_hf', name:'Hef HeatFinal', dob:'2012-01-01', gender:'Boys', pbs:[
    {event:'100 Back',course:'S',time:'1:25.10',date:'2026-07-18'},{event:'100 Back',course:'S',time:'1:23.90',date:'2026-07-18'}] })`);
  doc.getElementById('hotCutoffDays').value = '3650';
  const grp = window.groupRecentPbsBySwimmer().find(g => g.name === 'Hef HeatFinal');
  check('D4 Hot Right Now shows a single entry (the final) for a heat+final day', !!grp && grp.entries.length === 1 && grp.entries[0].time === '1:23.90');
  const cur = window.getCurrentPbMap(window.eval(`SWIMMERS.find(s=>s.id==='sw_hf')`).pbs);
  check('D5 the current PB is still the fastest of the swims', cur['100 Back|S'].time === '1:23.90');
  window.eval(`SWIMMERS = SWIMMERS.filter(s => s.id !== 'sw_hf')`);

  // ── E. sync wiring: v2.4 payload `warnings`, v2.3 payloads still fine ─────
  window.localStorage.setItem('coach_SYNC_URL', 'https://example.test/exec');
  doc.getElementById('syncTokenInput').value = 'test-token';
  async function runSync(payload) {
    window.eval(`SWIMMERS = []`);
    window.fetch = async () => ({ ok: true, status: 200, statusText: 'OK', json: async () => payload });
    doc.getElementById('syncMergeMode').value = 'keep';
    await window.startSync();
    return doc.getElementById('syncStatus');
  }
  const bobPayload = [{ name: 'Bob Baker', dob: '2013-10-18', gender: 'Boys', source: 'sheet', pbs: [T('50 Free', '36.00', '2026-05-01'), T('50 Free', '25.00', '2026-07-01')] }];
  const warn = { name: 'Bob Baker', event: '50 Free', course: 'S', date: '2026-07-01', time: '25.00', previousBest: '36.00', previousBestDate: '2026-03-14', rec: 5 };
  let st = await runSync({ version: '2.4', build: BUILD, swimmers: bobPayload, warnings: [warn] });
  check('E1 v2.4 payload syncs both swims', window.eval('SWIMMERS[0].pbs.length') === 2);
  check('E2 a warning appears in the sync message: names the swimmer, time and record', /unusually fast/.test(st.textContent) && /Bob Baker/.test(st.textContent) && /25\.00/.test(st.textContent) && /36\.00/.test(st.textContent) && /record 5/.test(st.textContent));
  check('E2b UAT R5: the wording attributes each date correctly - the NEW swim first (time, its date, record), then the previous best with ITS own date',
    /Bob Baker 50 Free SC: new swim 25\.00 on 1 Jul 2026 \(record 5\), previous best 36\.00 on 14 Mar 2026/.test(st.textContent));
  check('E3 a warning holds the dialog open with the "Got it - Close" button', doc.getElementById('syncCloseBtn').style.display === '');
  st = await runSync({ version: '2.3', swimmers: bobPayload });
  check('E4 a v2.3 object payload (no warnings) still syncs, with no warning text', window.eval('SWIMMERS.length') === 1 && !/unusually fast/.test(st.textContent));
  st = await runSync({ version: '2.4', build: BUILD, swimmers: bobPayload });
  check('E5 ...and, with QT data loaded, the expected script build and no warning, the dialog is not held open', doc.getElementById('syncCloseBtn').style.display === 'none');
  st = await runSync(bobPayload);
  check('E6 a bare array payload (oldest shape) still syncs', window.eval('SWIMMERS.length') === 1 && /synced/.test(st.textContent));
  st = await runSync({ version: '2.4', build: BUILD, swimmers: bobPayload, warnings: [warn, { ...warn, time: '24.50', date: '2026-07-08', rec: 6 }] });
  check('E3b two warnings for the same event are both reported ("2 recent swims") and both named', /2 recent swims/.test(st.textContent) && /new swim 25\.00/.test(st.textContent) && /new swim 24\.50/.test(st.textContent));
  st = await runSync({ version: '2.4', build: BUILD, swimmers: bobPayload, warnings: [{ ...warn, previousBestDate: undefined }] });
  check('E3c an older script with no previousBestDate still gives a readable line (no "on undefined")', /previous best 36\.00/.test(st.textContent) && !/undefined/.test(st.textContent));
  // build marker + history-check status (UAT R4: make it visible which code is actually running)
  st = await runSync({ version: '2.4', build: '2.2.4-b3', swimmers: bobPayload });
  st = await runSync({ version: '2.4', build: BUILD, swimmers: bobPayload });
  check('E3d the sync message shows the Apps Script build and that the history check is on', st.textContent.includes('Apps Script ' + BUILD) && /history check on/.test(st.textContent));
  check('E3d2 a script whose build matches what the dashboard expects adds no "older script" warning', !/older|expects/.test(st.textContent) && doc.getElementById('syncCloseBtn').style.display === 'none');
  st = await runSync({ version: '2.3', swimmers: bobPayload });
  check('E3e an older script (no build, version 2.3) is labelled as such and the history check is off', /older script/.test(st.textContent) && /history check off/.test(st.textContent));
  st = await runSync({ version: '2.4', build: '<img src=x onerror="window.__x=true">', swimmers: bobPayload });
  check('E3f a hostile build string is not shown', st.children.length === 0 && !/<img/.test(st.textContent) && /older script|unknown/.test(st.textContent));
  check('E3g the page title carries the build (v2.12.11) so a stale cached file is obvious', /<title>[^<]*v2\.12\.11/.test(html));
  window.__x = false;
  const evil = [
    { ...warn, name: '<img src=x onerror="window.__x=true">' },
    { ...warn, time: 'not a time' },        // dropped: bad time
    { ...warn, name: 123 },                 // dropped: not a string
    'junk', null,
  ];
  st = await runSync({ version: '2.4', build: BUILD, swimmers: bobPayload, warnings: evil });
  check('E7 hostile warnings are shown as inert text (no element created, nothing executed)', st.children.length === 0 && window.__x === false);
  check('E8 only the one valid warning was counted (1 swim)', /1 recent swim/.test(st.textContent));
  st = await runSync({ version: '2.4', build: BUILD, swimmers: bobPayload, warnings: 'not an array' });
  check('E9 a non-array warnings field is ignored safely', window.eval('SWIMMERS.length') === 1 && !/unusually fast/.test(st.textContent));
  const big = []; for (let i = 0; i < 200; i++) big.push({ ...warn, rec: i });
  st = await runSync({ version: '2.4', build: BUILD, swimmers: bobPayload, warnings: big });
  check('E10 an oversized warnings list is capped and the message stays short', st.textContent.length < 1800 && /and 47 more/.test(st.textContent));

  // ── F. sync reliability (UAT 4.0): retry on 404, timeout, clear messages ─────
  window.eval('SYNC_RETRY_DELAY_MS = 5');
  async function runSyncWith(fetchImpl, keepSwimmers) {
    if (!keepSwimmers) window.eval(`SWIMMERS = []`);
    window.fetch = fetchImpl;
    doc.getElementById('syncMergeMode').value = 'keep';
    await window.startSync();
    return doc.getElementById('syncStatus');
  }
  const okResp = payload => ({ ok: true, status: 200, statusText: 'OK', json: async () => payload });
  const bad = (status, text) => ({ ok: false, status, statusText: text || 'x', json: async () => ({}) });
  let calls = 0;
  st = await runSyncWith(async () => { calls++; return calls < 3 ? bad(404, 'Not Found') : okResp({ version: '2.4', build: BUILD, swimmers: bobPayload }); });
  check('F1 two 404s then success: the sync retries and succeeds', calls === 3 && window.eval('SWIMMERS.length') === 1 && /synced/.test(st.textContent));
  calls = 0;
  st = await runSyncWith(async () => { calls++; return bad(404, 'Not Found'); });
  check('F2 404 every time: 3 tries, then says what happened and what to do (retry; check the URL in Settings)', calls === 3 && /404/.test(st.textContent) && /try again/i.test(st.textContent) && /Settings/.test(st.textContent));
  check('F2b ...and the Sync button is usable again', doc.getElementById('syncBtn').disabled === false);
  calls = 0;
  st = await runSyncWith(async () => { calls++; return bad(403, 'Forbidden'); });
  check('F3 a 403 is not retried and points at access / token', calls === 1 && /refused/.test(st.textContent) && /token/i.test(st.textContent));
  calls = 0;
  st = await runSyncWith(async () => { calls++; return bad(503); });
  check('F4 a 503 is retried 3 times and reads as temporary', calls === 3 && /temporary/i.test(st.textContent));
  window.eval('SYNC_TIMEOUT_MS = 30');
  calls = 0;
  st = await runSyncWith((url, opts) => { calls++; return new Promise((_, rej) => { opts.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; rej(e); }); }); });
  check('F5 no answer within the timeout: each attempt is aborted (3 attempts), then "Timed out ... try again"', calls === 3 && /Timed out/.test(st.textContent) && /try again/i.test(st.textContent));
  window.eval('SYNC_TIMEOUT_MS = 90000');
  st = await runSyncWith(async () => { throw new window.TypeError('Failed to fetch'); });
  check('F6 a network failure says it could not reach Google and to try again', /reach Google/.test(st.textContent) && /try again/i.test(st.textContent));
  st = await runSyncWith(async () => okResp({ error: true, message: 'Unauthorised.' }));
  check('F7 an error returned by the script itself is shown as before, without retry advice', /Unauthorised\./.test(st.textContent) && !/try again/i.test(st.textContent));
  calls = 0; window.fetch = async () => { calls++; return bad(404); };
  await window.syncQTFromGitHub('county');
  check('F8 the GitHub QT sync is unchanged: a 404 there is not retried', calls === 1);

  // ── G. orphaned swims (UAT 4.0.1): a synced swim that is no longer in the Sheet ─────
  const FH = { fullHistory: true };
  const G = (time, date, source) => T('100 Back', time, date, source);
  r = window.mergePbs([G('1:23.90', '2026-07-04', 'gala')], [G('1:23.90', '2026-07-11')], FH);
  check('G1 a swim whose DATE was edited in the Sheet: the old entry is kept and reported, with a hint to the new date', r.pbs.length === 2 && r.stale.length === 1 && r.stale[0].pb.date === '2026-07-04' && !!r.stale[0].hint && r.stale[0].hint.kind === 'date' && r.stale[0].hint.date === '2026-07-11');
  r = window.mergePbs([G('1:23.90', D, 'gala')], [G('1:24.50', D)], FH);
  check('G2 a TIME edited in the Sheet: reported with a "time" hint', r.stale.length === 1 && r.stale[0].hint.kind === 'time' && r.stale[0].hint.time === '1:24.50');
  r = window.mergePbs([G('1:23.90', D, 'gala')], [T('50 Free', '30.00', D)], FH);
  check('G3 a swim deleted from the Sheet: reported, no hint', r.stale.length === 1 && r.stale[0].hint === null);
  r = window.mergePbs([G('1:23.90', D, 'gala')], [G('1:23.90', D)], FH);
  check('G4 an unchanged swim is not reported', r.stale.length === 0);
  r = window.mergePbs([G('1:23.90', D, 'manual'), G('1:22.00', '2026-06-01', 'se'), G('1:25.00', '2026-05-01')], [], FH);
  check('G5 manual and SE entries are never reported; an entry with no source counts as a Sheet swim', r.stale.length === 1 && r.stale[0].pb.time === '1:25.00');
  r = window.mergePbs([G('1:23.90', '2026-07-04', 'gala')], [G('1:23.90', '2026-07-11')]);
  check('G6 without fullHistory (an old payload that only carries the fastest swim) nothing is reported', r.stale.length === 0 && r.pbs.length === 2);
  r = window.mergePbs([U('33.25')], [U('32.00')], FH);
  check('G7 undated entries are never reported', r.stale.length === 0);
  r = window.mergePbs([G('1:23.90', D, 'gala'), G('1:25.10', D, 'gala')], [G('1:23.90', D)], FH);
  check('G8 a heat that vanished from the Sheet while the final remains is reported', r.stale.length === 1 && r.stale[0].pb.time === '1:25.10');
  const oldEntry = JSON.stringify(G('1:23.90', '2026-07-04', 'gala'));
  const sheetBob = [{ name: 'Bob Baker', dob: '2013-10-18', gender: 'Boys', pbs: [G('1:23.90', '2026-07-11')] }];
  const seed = () => window.eval(`SWIMMERS = [{id:'s1',name:'Bob Baker',dob:'2013-10-18',gender:'Boys',source:'sheet',pbs:[${oldEntry}]}]`);
  seed(); let ms = window.mergeSwimmers(sheetBob, 'keep', { sourceIsAuthoritative: true, fullHistory: true });
  check('G9 mergeSwimmers collects the reported swims with the swimmer\'s name; nothing is deleted', ms.stalePbs.length === 1 && ms.stalePbs[0].name === 'Bob Baker' && window.eval('SWIMMERS[0].pbs.length') === 2);
  seed(); ms = window.mergeSwimmers(sheetBob, 'keep', { sourceIsAuthoritative: true });
  check('G9b ...but not without fullHistory', ms.stalePbs.length === 0);
  seed(); ms = window.mergeSwimmers(sheetBob, 'keep', { sourceIsAuthoritative: false, fullHistory: true });
  check('G9c ...and never for a manual file upload-merge (that is not the Sheet)', ms.stalePbs.length === 0);
  seed();
  st = await runSyncWith(async () => okResp({ version: '2.4', build: BUILD, swimmers: sheetBob }), true);
  check('G10 the sync message names the orphaned swim, where the Sheet has it now, and how to fix it; the dialog is held open', /no longer in the Google Sheet/.test(st.textContent) && /Bob Baker/.test(st.textContent) && /4 Jul/.test(st.textContent) && /11 Jul/.test(st.textContent) && /Edit Swimmer/.test(st.textContent) && doc.getElementById('syncCloseBtn').style.display === '');
  check('G11 ...and nothing was deleted: both swims are still on the dashboard', window.eval('SWIMMERS[0].pbs.length') === 2);
  seed();
  st = await runSyncWith(async () => okResp({ version: '2.3', swimmers: sheetBob }), true);
  check('G12 an old (v2.3) payload never produces the orphan note', !/no longer in the Google Sheet/.test(st.textContent));
  const manyOld = []; for (let i = 0; i < 12; i++) manyOld.push(G('1:2' + (i % 10) + '.00', '2026-0' + (1 + (i % 6)) + '-1' + (i % 9), 'gala'));
  window.eval(`SWIMMERS = [{id:'s1',name:'Bob Baker',dob:'2013-10-18',gender:'Boys',source:'sheet',pbs:${JSON.stringify(manyOld)}}]`);
  st = await runSyncWith(async () => okResp({ version: '2.4', build: BUILD, swimmers: [{ name: 'Bob Baker', dob: '2013-10-18', gender: 'Boys', pbs: [T('50 Free', '30.00', '2026-07-01')] }] }), true);
  check('G13 a long list is summarised (first few + "and N more") so the message stays short', /and 9 more/.test(st.textContent) && st.textContent.length < 1800);

  // ── H. UAT S3: a stale deployment must be loud, not a footnote ───────────────────────────
  st = await runSync({ version: '2.4', build: '2.2.4-b1', swimmers: bobPayload });
  check('H1 a script reporting a DIFFERENT build says so, names both builds, says how to redeploy, and holds the dialog open',
    /reports build 2\.2\.4-b1/.test(st.textContent) && st.textContent.includes(BUILD) && /New version/.test(st.textContent) && /Save/i.test(st.textContent) && doc.getElementById('syncCloseBtn').style.display === '');
  st = await runSync({ version: '2.4', swimmers: bobPayload });
  check('H2 a script with NO build marker (an older deployment) is called out the same way', /no build marker/.test(st.textContent) && /New version/.test(st.textContent));
  st = await runSync({ version: '2.4', build: '<img src=x onerror="window.__x=true">', swimmers: bobPayload });
  check('H3 a hostile build string is never echoed', st.children.length === 0 && !/<img/.test(st.textContent) && /no build marker/.test(st.textContent));

  // ── I. UAT S2c: rows skipped in the Results tab are surfaced, by record number ─────────────────
  const skippedRows = [
    { row: 812, rec: 809, reason: 'time', name: 'Baker, Bob', detail: 'the final time cell is empty, but a time (02:44.03) is in the 150 column - probably entered in the wrong column' },
    { row: 813, rec: 810, reason: 'time', name: 'Carter, Amy', detail: 'the time cell shows "#REF!" which cannot be read as a time' },
    { row: 814, rec: 811, reason: 'event', name: 'Diaz, Andrew', detail: '100 FR' },
    { row: 815, rec: null, reason: 'course', name: 'Hill, Anthony', detail: 'XX' },
  ];
  st = await runSync({ version: '2.4', build: BUILD, swimmers: bobPayload, stats: { skippedRows, skippedTotal: 7 } });
  check('I1 skipped rows are reported with their count and the record number of each', /7 rows in the Results tab were skipped/.test(st.textContent) && /record 809/.test(st.textContent) && /record 810/.test(st.textContent) && /record 811/.test(st.textContent));
  check('I2 the reason is in words, including the wrong-column hint and the unrecognised event', /150 column/.test(st.textContent) && /wrong column/.test(st.textContent) && /"100 FR"/.test(st.textContent) && /not recognised/.test(st.textContent));
  check('I3 only the first three are listed, the rest summarised', !/Hill, Anthony/.test(st.textContent) && /and 4 more/.test(st.textContent));
  check('I4 it holds the dialog open (it may be a real swim lost to a typo)', doc.getElementById('syncCloseBtn').style.display === '');
  st = await runSync({ version: '2.4', build: BUILD, swimmers: bobPayload, stats: { skippedRows: [skippedRows[3]], skippedTotal: 1 } });
  check('I5 a row with no record number falls back to its Sheet row', /1 row in the Results tab was skipped/.test(st.textContent) && /Sheet row 815/.test(st.textContent));
  st = await runSync({ version: '2.4', build: BUILD, swimmers: bobPayload, stats: { skippedRows: [], skippedTotal: 0, dq: 10, time: 0 } });
  check('I6 nothing skipped: no note (DQ rows are intentionally excluded and not reported)', !/skipped/.test(st.textContent));
  window.__x = false;
  st = await runSync({ version: '2.4', build: BUILD, swimmers: bobPayload, stats: { skippedRows: [{ row: 5, rec: 1, reason: 'time', name: '<img src=x onerror="window.__x=true">', detail: '<b>x</b>' }, 'junk', null, { row: 'a', reason: 'bogus', name: 1 }], skippedTotal: 1 } });
  check('I7 hostile or malformed skipped-row data is shown as inert text or dropped', st.children.length === 0 && window.__x === false);
  st = await runSync({ version: '2.4', build: BUILD, swimmers: bobPayload, stats: 'nonsense' });
  check('I8 a malformed stats field is ignored safely', window.eval('SWIMMERS.length') === 1);
  st = await runSync({ version: '2.3', swimmers: bobPayload });
  check('I9 an older payload with no stats at all still syncs', window.eval('SWIMMERS.length') === 1);

  console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
  process.exit(failures ? 1 : 0);
}, 50);
