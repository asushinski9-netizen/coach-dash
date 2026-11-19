// probe_v2138.js - v2.13.8 (#32): interactive Squad Composition pies on the Roster (desktop) and up to five toggle chips (mobile).
// The pies, the chips and the Gender / Age / Squad dropdowns are three views of ONE set of selections: clicking a slice (or legend entry)
// removes that category from the list; the dropdowns follow ("Custom" when a mix cannot be expressed); counts follow every other filter
// but not the pie's own selection. The Overview pies must behave exactly as before.
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
const R = n => Array.from({ length: n }, (_, i) => ({ event: '50 Free', course: 'S', time: (30 + i) + '.00', date: '2026-0' + (1 + i) + '-01', source: 'gala' }));
const sw = (id, name, gender, dob, squad, se, n, source, extra) => ({ id, name, dob, gender, source: source || 'sheet', ...(squad ? { squad } : {}), ...(se ? { se } : {}), pbs: R(n), ...(extra || {}) });
const ROSTER = [
  sw('a', 'Ava Adams', 'Girls', '2013-03-03', 'Junior', '1000001', 3),
  sw('b', 'Ben Brown', 'Boys', '2012-06-06', 'Senior', '1000002', 1),
  sw('c', 'Cal Cole', 'Boys', '2014-01-01', '', '', 0, 'local'),
  sw('d', 'Dee Dunn', 'Girls', '2011-09-09', 'Masters', '1000004', 2),
  sw('t1', 'Sam Twin', 'Boys', '2013-05-05', 'Junior', '1000005', 1),
  sw('t2', 'sam  TWIN', 'Boys', '2013-05-06', 'Junior', '', 1, 'local'),
  sw('h', 'Hal Hidden', 'Boys', '2013-01-01', 'Junior', '1000007', 1, 'sheet', { hidden: true }),
  sw('f', 'Fred Former', 'Boys', '2012-02-02', 'Former Swimmer', '1000008', 0),
  sw('m', 'Mal Moss', 'Girls', '2013-07-07', 'Active', '1000009', 1),
];
const N = ROSTER.length;
const cards = () => [...doc.querySelectorAll('#rosterList > .swimmer-card')];
const names = () => cards().map(c => c.querySelector('.swimmer-name-text').textContent);
const lis = () => [...doc.querySelectorAll('#rosterNote details li')].map(e => e.textContent.replace(/\s+/g, ' ').trim());
const noteText = () => doc.getElementById('rosterNote').textContent.replace(/\s+/g, ' ');
const accounted = () => { const all = [...names(), ...lis().map(l => l.split(' - ')[0])]; return all.length === N && new Set(all).size === N; };
const liFor = n => lis().find(l => l.startsWith(n + ' - ')) || '';
const pie = i => doc.querySelectorAll('#rosterCharts .ov-comp-card')[i];
const legend = i => { const o = {}; pie(i).querySelectorAll('.ov-legend-item').forEach(it => { o[it.querySelector('.ov-legend-label').textContent] = { n: parseInt(it.querySelector('.ov-legend-count').textContent, 10), off: it.classList.contains('excluded'), el: it }; }); return o; };
const centre = i => parseInt(pie(i).querySelector('.ov-donut-total').textContent, 10);
const arcs = i => [...pie(i).querySelectorAll('circle[stroke-dasharray]')];
const arcFor = (i, label) => arcs(i).find(c => new RegExp('^' + label.replace(/[+*?^$()[\]{}|\\]/g, '\\$&') + ':').test(c.querySelector('title').textContent));
const click = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const sel = id => doc.getElementById(id).value;
const reset = () => { w.resetRosterFilters(); };
const chip = (dim, key) => doc.querySelector(`#rosterChips [data-dim="${dim}"][data-key="${key}"]`);
const bal = (str, tag) => (str.match(new RegExp('<' + tag + '[\\s>]', 'g')) || []).length === (str.match(new RegExp('</' + tag + '>', 'g')) || []).length;

setTimeout(async () => {
  w.eval('SWIMMERS=' + JSON.stringify(ROSTER));
  const before = JSON.stringify(w.eval('SWIMMERS'));
  const tabs = [...doc.querySelectorAll('.tabs .tab-btn')];
  w.showTab('roster', tabs[1]);
  reset();

  // ═══ placement and structure ═══
  check('layout: the pie strip sits at the top of the Roster, before the filter bar', !!doc.getElementById('rosterCharts') && doc.getElementById('rosterCharts').compareDocumentPosition(doc.getElementById('rosterFilterBar')) & w.Node.DOCUMENT_POSITION_FOLLOWING);
  check('layout: three pies (By Gender, By Squad, By Age), the same card markup as Overview', doc.querySelectorAll('#rosterCharts .ov-comp-card').length === 3 && [...doc.querySelectorAll('#rosterCharts .ov-comp-card-title')].map(e => e.textContent).join('|') === 'By Gender|By Squad|By Age' && doc.querySelectorAll('#rosterCharts svg.ov-donut').length === 3);
  check('layout: the strip string is balanced (div, svg, span)', ['div', 'svg', 'span'].every(t => bal(doc.getElementById('rosterCharts').innerHTML, t)));

  // ═══ counts ═══
  let g = legend(0), s = legend(1), a = legend(2);
  check('counts: gender pie shows Boys 4 / Girls 3 (hidden and Former swimmers are not counted)', g.Boys.n === 4 && g.Girls.n === 3);
  check('counts: squad pie: Junior 3, Senior 1, Active 1, Masters 1, No Squad 1 and no Former Swimmer slice while Former is off', s.Junior.n === 3 && s.Senior.n === 1 && s.Active.n === 1 && s.Masters.n === 1 && s['No Squad'].n === 1 && !('Former Swimmer' in s) && !('Development' in s));
  const ageOf = x => String(w.getCurrentAge(x.dob)), expectAges = {}; ROSTER.filter(x => !x.hidden && x.squad !== 'Former Swimmer').forEach(x => { expectAges[ageOf(x)] = (expectAges[ageOf(x)] || 0) + 1; });
  check('counts: age pie has one entry per current age with bare-number labels and the right counts', Object.keys(expectAges).every(k => a[k] && a[k].n === expectAges[k]) && Object.keys(a).length === Object.keys(expectAges).length);
  check('counts: every donut centre equals the number of swimmers listed (7)', [0, 1, 2].every(i => centre(i) === 7) && cards().length === 7);

  // ═══ click a slice ═══
  click(arcFor(0, 'Boys'));
  check('slice: clicking the Boys slice removes the boys from the list', names().sort().join('|') === ['Ava Adams', 'Dee Dunn', 'Mal Moss'].sort().join('|'));
  check('slice: ...the Gender dropdown follows (Girls)', sel('rsGender') === 'Girls');
  g = legend(0);
  check('slice: ...Boys is struck out in the legend and its slice is gone from the ring, Girls remains', g.Boys.off && !g.Girls.off && !arcFor(0, 'Boys') && !!arcFor(0, 'Girls'));
  check('slice: ...the struck-out entry still shows the count re-including it would add back (4)', g.Boys.n === 4);
  s = legend(1);
  check('slice: ...the OTHER pies now count only the listed swimmers (Junior 1, Masters 1, Active 1; Senior and No Squad gone)', s.Junior.n === 1 && s.Masters.n === 1 && s.Active.n === 1 && !s.Senior && !s['No Squad'] && centre(1) === 3 && centre(2) === 3 && centre(0) === 3);
  check('slice: ...the footer lists the boys with what they ARE and the heading names the filter once', /not matching the active filters \(Gender: Girls\)/.test(noteText()) && liFor('Ben Brown') === 'Ben Brown - Boys' && accounted());
  click(g.Boys.el);
  check('legend: clicking the struck-out Boys entry brings them back; dropdown returns to All', names().length === 7 && sel('rsGender') === '' && !legend(0).Boys.off);

  // ═══ dropdown -> pies ═══
  doc.getElementById('rsSquad').value = 'Junior'; w.renderRoster();
  s = legend(1);
  check('dropdown: Squad = Junior shows only the Junior slice, the others struck out, and the list has the 3 juniors', names().sort().join('|') === ['Ava Adams', 'Sam Twin', 'sam  TWIN'].sort().join('|') && !s.Junior.off && s.Senior.off && s.Masters.off && s.Active.off && s['No Squad'].off && !!arcFor(1, 'Junior') && !arcFor(1, 'Senior'));
  g = legend(0);
  check('dropdown: ...the gender pie now counts only juniors (Boys 2, Girls 1) and the dropdown still says Junior', g.Boys.n === 2 && g.Girls.n === 1 && sel('rsSquad') === 'Junior');
  doc.getElementById('rsGender').value = 'Boys'; w.renderRoster();
  check('dropdown: Gender = Boys on top: the gender pie strikes Girls and the list is the 2 junior boys', names().length === 2 && legend(0).Girls.off && !legend(0).Boys.off);
  reset();
  check('reset: Reset Filters clears pie selections too (all slices back, 7 swimmers)', names().length === 7 && Object.values(legend(0)).every(x => !x.off) && Object.values(legend(1)).every(x => !x.off) && sel('rsSquad') === '' && sel('rsGender') === '');

  // ═══ custom mixes ═══
  click(legend(1).Senior.el); click(legend(1).Active.el);
  check('custom: striking out two squads leaves a mix the dropdown cannot express: it reads "Custom"', sel('rsSquad') === '__custom' && /Custom/.test(doc.querySelector('#rsSquad option[value="__custom"]').textContent) && names().length === 5 && !names().includes('Ben Brown') && !names().includes('Mal Moss'));
  check('custom: the footer heading says what is excluded, and rows show what each swimmer is', /Squad: excluding Senior, Active/.test(noteText()) && liFor('Ben Brown') === 'Ben Brown - Senior' && accounted());
  click(legend(1).Senior.el); click(legend(1).Active.el);
  check('custom: re-including both returns the dropdown to All', sel('rsSquad') === '' && names().length === 7);
  doc.getElementById('rsSquad').value = 'Junior'; w.renderRoster(); click(legend(1).Senior.el);
  check('custom: Junior + Senior = two included, so the dropdown reads Custom', sel('rsSquad') === '__custom' && names().length === 4);
  reset();

  // ═══ age pie ═══
  const ages = Object.keys(expectAges);
  const oneAge = ages[0];
  click(legend(2)[oneAge].el);
  check('age: clicking an age entry removes that age; the dropdown goes Custom (many ages left)', names().length === 7 - expectAges[oneAge] && sel('rsAge') === (ages.length === 2 ? ages[1] : '__custom'));
  reset();
  doc.getElementById('rsAge').value = oneAge; w.renderRoster();
  check('age: choosing an age in the dropdown strikes every other age in the pie', Object.entries(legend(2)).every(([k, v]) => v.off === (k !== oneAge)) && names().length === expectAges[oneAge]);
  check('age: slice tooltips say "Age N" while the legend shows the bare number', !!arcFor(2, 'Age ' + oneAge) && Object.keys(legend(2)).every(k => /^\d+$/.test(k)));
  reset();

  // ═══ other filters feed the pie counts ═══
  doc.getElementById('rsSource').value = 'local'; w.renderRoster();
  check('other filters: Source = Added locally makes the pies count only local swimmers (gender Boys 2, Girls 0 -> gone)', legend(0).Boys.n === 2 && !legend(0).Girls && centre(0) === 2);
  reset(); doc.getElementById('rsSearch').value = 'sam'; w.renderRoster();
  check('other filters: Search = "sam" makes the squad pie Junior 2 only', legend(1).Junior.n === 2 && Object.keys(legend(1)).length === 1 && centre(1) === 2);
  reset(); doc.getElementById('rsFlag').value = 'noSE'; w.renderRoster();
  check('other filters: Flag = No SE # makes the pies count Cal and sam only', centre(0) === 2 && legend(1)['No Squad'].n === 1 && legend(1).Junior.n === 1);
  reset();

  // ═══ Former / hidden ═══
  doc.getElementById('rsShowFormer').checked = true; w.renderRoster();
  check('Former: ticking Show Former Swimmers adds a "Former Swimmer" slice (1) to the squad pie', legend(1)['Former Swimmer'] && legend(1)['Former Swimmer'].n === 1 && centre(1) === 8);
  doc.getElementById('rsShowFormer').checked = false; doc.getElementById('rsSquad').value = 'Former Swimmer'; w.renderRoster();
  check('Former: choosing Squad = Former Swimmer reveals Fred, shows the Former slice, and strikes the rest', names().join('|') === 'Fred Former' && !legend(1)['Former Swimmer'].off && legend(1).Junior.off);
  reset();
  doc.getElementById('rsShowHidden').checked = true; w.renderRoster();
  check('hidden: Show hidden swimmers adds Hal to the pies (Boys 5, Junior 4)', legend(0).Boys.n === 5 && legend(1).Junior.n === 4);
  reset();

  // ═══ collapse the strip ═══
  const btn = doc.getElementById('rosterChartsBtn');
  check('strip: a ▾ Charts button, expanded by default', !!btn && btn.getAttribute('aria-expanded') === 'true' && !doc.getElementById('rosterCharts').classList.contains('rs-charts-hidden'));
  click(btn);
  check('strip: clicking it hides the pies, flips aria-expanded, and remembers the choice', doc.getElementById('rosterCharts').classList.contains('rs-charts-hidden') && btn.getAttribute('aria-expanded') === 'false' && w.localStorage.getItem('coach_ROSTER_CHARTS_HIDDEN') === '1');
  w.renderRoster();
  check('strip: the choice survives a re-render', doc.getElementById('rosterCharts').classList.contains('rs-charts-hidden'));
  check('strip: hidden pies do not stop the chips and filters working', names().length === 7);
  click(btn);
  check('strip: clicking again shows them and clears the stored choice', !doc.getElementById('rosterCharts').classList.contains('rs-charts-hidden') && w.localStorage.getItem('coach_ROSTER_CHARTS_HIDDEN') !== '1');

  // ═══ mobile chips ═══
  const chipEls = [...doc.querySelectorAll('#rosterChips .rs-chip')];
  check('chips: five chips in order Boys, Girls, Junior, Senior, Development', chipEls.map(c => c.getAttribute('data-key')).join('|') === 'Boys|Girls|Junior|Senior|Development');
  check('chips: each shows its count (Boys 4, Girls 3, Junior 3, Senior 1, Development 0) and is on (pressed) by default', chip('gender', 'Boys').textContent.includes('4') && chip('gender', 'Girls').textContent.includes('3') && chip('squad', 'Junior').textContent.includes('3') && chip('squad', 'Senior').textContent.includes('1') && chip('squad', 'Development').textContent.includes('0') && chipEls.every(c => c.getAttribute('aria-pressed') === 'true'));
  click(chip('gender', 'Boys'));
  check('chips: tapping Boys switches boys off: list, pie, dropdown and chip all agree', names().length === 3 && chip('gender', 'Boys').getAttribute('aria-pressed') === 'false' && legend(0).Boys.off && sel('rsGender') === 'Girls');
  check('chips: counts on the other chips follow (Junior now 1)', chip('squad', 'Junior').textContent.includes('1'));
  click(chip('squad', 'Junior'));
  check('chips: switching Junior off as well leaves a mix the squad dropdown calls Custom', sel('rsSquad') === '__custom' && names().length === 2);
  click(legend(1).Junior.el);
  check('chips: a pie legend click and a chip share the same selection (clicking Junior in the pie turns the Junior chip back on)', chip('squad', 'Junior').getAttribute('aria-pressed') === 'true' && sel('rsSquad') === '' && names().length === 3);
  reset();
  check('chips: Reset Filters turns every chip back on', [...doc.querySelectorAll('#rosterChips .rs-chip')].every(c => c.getAttribute('aria-pressed') === 'true') && names().length === 7);
  const cssAll = html.slice(0, html.indexOf('@media (max-width: 500px)')), mobile = html.slice(html.indexOf('@media (max-width: 500px)'));
  check('mobile [source check]: the pies and their toggle are hidden on phones and the chips are shown; on desktop the chips are hidden', /\.rs-chips\s*\{[^}]*display:\s*none/.test(cssAll) && /\.rs-chips\s*\{[^}]*display:\s*flex/.test(mobile) && /\.rs-charts-wrap\s*\{[^}]*display:\s*none/.test(mobile));

  // ═══ safety ═══
  check('read-only: charts, chips and filters changed no swimmer data', JSON.stringify(w.eval('SWIMMERS')) === before);
  w.__x = false;
  w.eval('SWIMMERS=' + JSON.stringify([sw('x1', 'Pat Plain', 'Boys', '2013-01-01', 'Sq<img src=x onerror="window.__x=true">', '1', 1), sw('x2', 'Quin Quick', 'Girls', '2013-02-02', 'Junior', '2', 1)]));
  reset(); w.renderRoster();
  const unusual = Object.keys(legend(1)).find(k => k.startsWith('Sq<img'));
  check('escaping: an unusual squad name appears in the squad pie as inert text', w.__x === false && doc.querySelectorAll('#rosterCharts img').length === 0 && !!unusual);
  if (unusual) click(legend(1)[unusual].el);
  check('escaping: toggling it works (Pat leaves the list, squad dropdown Custom) and nothing executed', names().join('|') === 'Quin Quick' && sel('rsSquad') === '__custom' && w.__x === false);
  w.eval('SWIMMERS=[]'); reset();
  check('empty: with no swimmers the pies show nothing broken and the page still renders', /No swimmers loaded/.test(doc.getElementById('rosterList').textContent));
  w.eval('SWIMMERS=' + JSON.stringify(ROSTER)); w.renderOverview();
  check('refresh: a data change re-renders the open Roster and its pies', cards().length === 7 && centre(0) === 7);

  // ═══ Overview pies unchanged ═══
  w.showTab('overview', tabs[0]);
  const ov = doc.querySelectorAll('#overviewComposition .ov-comp-card');
  check('overview: still three pies, whose legend entries toggle through toggleCompChartKey and whose slices are NOT clickable', ov.length === 3 && [...doc.querySelectorAll('#overviewComposition .ov-legend-item')].every(i => /toggleCompChartKey/.test(i.getAttribute('onclick'))) && doc.querySelectorAll('#overviewComposition circle[onclick]').length === 0);
  const girls = [...ov[0].querySelectorAll('.ov-legend-item')].find(i => i.textContent.includes('Girls'));
  click(girls);
  check('overview: striking Girls out still works there and does NOT touch the Roster selection', [...doc.querySelectorAll('#overviewComposition .ov-comp-card')[0].querySelectorAll('.ov-legend-item')].find(i => i.textContent.includes('Girls')).classList.contains('excluded') && sel('rsGender') === '');
  w.eval("toggleCompChartKey('gender','Girls')");

  check('build marker: the page title says v2.13.8 or later', /<title>[^<]*v2\.13\.([8-9]|\d{2})/.test(html));
  console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
  process.exit(failures ? 1 : 0);
}, 100);
