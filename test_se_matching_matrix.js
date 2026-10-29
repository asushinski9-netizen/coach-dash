// test_se_matching_matrix.js - v2.11
//
// Dev-time Node test. Pins down, scenario by scenario, which of three outcomes the SE import's
// swimmer matcher gives: AUTO-MATCHED (applies with no tick), SUGGESTED (shown under "Suggested
// matches", applies only if the coach ticks it) or SKIPPED (unmatched / ambiguous, never applied).
// It extracts the real matcher out of index.html (same convention as test_se_import_core.js), so it
// tests the shipped code. Run with "--table" to print the scenario table in Markdown (this is how
// the table in se-matching-scenarios.md was produced).
//
// PURPOSE FOR v2.12: the suggested-match rules are due to be revisited. Changing a rule will make a
// row below fail ON PURPOSE; update the expectation, regenerate the table, and the change is then a
// visible, reviewed decision instead of a silent behaviour shift.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, process.env.INDEX_FILE || 'index.html'), 'utf8');
const between = (a, b) => { const s = html.indexOf(a); return html.slice(s, html.indexOf(b, s)); };
function fn(name) { const m = new RegExp('function ' + name + '\\([^)]*\\)\\s*\\{').exec(html); let i = m.index + m[0].length, d = 1; while (d) { if (html[i] === '{') d++; else if (html[i] === '}') d--; i++; } return html.slice(m.index, i); }
const src = fn('timeToSec') + '\n' + between('// SE PB REPORT IMPORT — parser + matcher (v2.11)', '// SE PB REPORT IMPORT — UI orchestration (v2.11)') + '\nthis.api={matchSeSwimmer,matchAllSeSwimmers};';
const sb = { ALL_EVENTS: ['50 Free'], console, TextDecoder, Uint8Array, DataView }; vm.createContext(sb); vm.runInContext(src, sb);
const { matchSeSwimmer, matchAllSeSwimmers } = sb.api;

// The SE report says: "Sushinski, Artyom: 22/09/2014 (Boy 11) 9990999"
const SE = (forename, se = '9990999') => ({ forename, surname: 'Sushinski', fullName: `${forename} Sushinski`, dob: '2014-09-22', gender: 'Boys', se });
const R = (name, o = {}) => ({ name, dob: '2014-09-22', gender: 'Boys', ...o });
const SAME = '9990999';
const scenarios = [
  ['A', 'SE # matches; DOB and gender match; first name differs (Arty on dashboard, Artyom on SE)', SE('Artyom'), [R('Arty Sushinski', { se: SAME })], 'auto', 'matched-se'],
  ['B', 'SE # matches; DOB and gender match; name identical', SE('Artyom'), [R('Artyom Sushinski', { se: SAME })], 'auto', 'matched-se'],
  ['C', 'SE # matches and name matches, but date of birth differs', SE('Artyom'), [R('Artyom Sushinski', { se: SAME, dob: '2014-22-09' })], 'suggested', 'confirm low'],
  ['D', 'SE # matches, but gender differs', SE('Artyom'), [R('Artyom Sushinski', { se: SAME, gender: 'Girls' })], 'suggested', 'confirm low'],
  ['E', 'No SE # on dashboard; first name similar (Arty / Artyom); DOB and gender match', SE('Artyom'), [R('Arty Sushinski')], 'suggested', 'confirm high'],
  ['F', 'No SE # on dashboard; name identical; DOB matches', SE('Artyom'), [R('Artyom Sushinski')], 'auto', 'matched-name'],
  ['G', 'Name and DOB match, but the dashboard holds a DIFFERENT SE #', SE('Artyom'), [R('Artyom Sushinski', { se: '999' })], 'suggested', 'confirm low'],
  ['H', 'Name and DOB match, but gender differs (no SE #)', SE('Artyom'), [R('Artyom Sushinski', { gender: 'Girls' })], 'suggested', 'confirm low'],
  ['I', 'Same surname, DOB and gender; unrelated first name (Robert); no SE #', SE('Artyom'), [R('Robert Sushinski')], 'suggested', 'confirm low'],
  ['J', 'As I, but the dashboard holds a different SE # and is the only candidate', SE('Artyom'), [R('Robert Sushinski', { se: '999' })], 'suggested', 'confirm low'],
  ['K', 'Name identical but date of birth differs; no SE # link', SE('Artyom'), [R('Artyom Sushinski', { dob: '2014-22-09' })], 'skipped', 'unmatched'],
  ['L', 'Similar name, DOB differs, dashboard holds a different SE #', SE('Artyom'), [R('Arty Sushinski', { dob: '2014-22-09', se: '999' })], 'skipped', 'unmatched'],
  ['M', 'Similar name, DOB matches, gender differs (no SE #)', SE('Artyom'), [R('Arty Sushinski', { gender: 'Girls' })], 'skipped', 'unmatched'],
  ['N', 'Two dashboard swimmers hold the same SE #', SE('Artyom'), [R('Arty Sushinski', { se: SAME }), R('Artyom Sushinski', { se: SAME })], 'skipped', 'ambiguous'],
  ['O', 'Two dashboard swimmers with identical name and DOB (no SE #)', SE('Artyom'), [R('Artyom Sushinski'), R('artyom  sushinski')], 'skipped', 'ambiguous'],
  ['P', 'Two candidates; only one has a similar first name (Arty / Arti)', SE('Artyom'), [R('Arty Sushinski'), R('Arti Sushinski')], 'suggested', 'confirm high'],
  ['Q', 'Two candidates; BOTH have similar first names (Art / Arty)', SE('Artyom'), [R('Art Sushinski'), R('Arty Sushinski')], 'skipped', 'ambiguous'],
  ['R', 'Surname spelled differently (hyphenated on dashboard: Sushinski-Jones)', SE('Artyom'), [R('Arty Sushinski-Jones')], 'skipped', 'unmatched'],
  ['S', 'Name order swapped on dashboard ("Sushinski Arty")', SE('Artyom'), [R('Sushinski Arty')], 'skipped', 'unmatched'],
  ['T', 'Accent difference in the first name (Artyóm vs Artyom)', SE('Artyom'), [R('Artyóm Sushinski')], 'suggested', 'confirm high'],
  ['U', 'Dashboard name has a middle name (Artyom Alex Sushinski)', SE('Artyom'), [R('Artyom Alex Sushinski')], 'suggested', 'confirm high'],
  ['V', 'SE report line has no SE #; name identical; DOB matches', SE('Artyom', undefined), [R('Artyom Sushinski')], 'auto', 'matched-name'],
  ['W', 'SE report line has no SE #; similar first name; DOB matches', SE('Artyom', undefined), [R('Arty Sushinski')], 'suggested', 'confirm high'],
  ['X', 'Nobody on the dashboard shares the date of birth', SE('Artyom'), [R('Artyom Sushinski', { dob: '2013-01-01', se: '5' })], 'skipped', 'unmatched'],
];
const label = { auto: 'Auto-matched', suggested: 'Suggested match', skipped: 'Skipped (not applied)' };
let failures = 0; const rows = [];
scenarios.forEach(([id, desc, se, roster, expectCat, expectStatus]) => {
  const m = matchSeSwimmer(se, roster);
  const got = m.status + (m.confidence ? ' ' + m.confidence : '');
  const cat = m.status.startsWith('matched') ? 'auto' : m.status === 'confirm' ? 'suggested' : 'skipped';
  const ok = got === expectStatus && cat === expectCat;
  if (!ok) failures++;
  console.log(ok ? 'PASS -' : 'FAIL -', `${id}: ${desc} -> ${label[cat]} (${got}${m.nameDiffers ? ', name differs' : ''})`);
  rows.push(`| ${id} | ${desc} | **${label[cat]}** | ${m.status}${m.confidence ? ' (' + m.confidence + ')' : ''} |`);
});
const two = matchAllSeSwimmers([SE('Artyom', '1'), SE('Artyom', '2')], [R('Artyom Sushinski')]);
const twoOk = two.every(x => x.match.status === 'ambiguous'); if (!twoOk) failures++;
console.log(twoOk ? 'PASS -' : 'FAIL -', 'Y: two SE report swimmers that both resolve to the SAME dashboard swimmer -> both Skipped (ambiguous)');
rows.push('| Y | Two swimmers in the SE report both resolve to the same dashboard swimmer | **Skipped (not applied)** | ambiguous (both) |');
if (process.argv.includes('--table')) { console.log('\n| # | Scenario (SE report: Artyom Sushinski, 12 Oct 2014, SE # 9990999) | Result | Internal status |\n|---|---|---|---|'); rows.forEach(r => console.log(r)); }
console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
process.exit(failures ? 1 : 0);
