// test_se_import_core.js — v2.11
//
// Dev-time Node test. Not part of the shipped dashboard. Follows the same "extract the pure
// logic from the real shipped file, don't hand-maintain a duplicate" convention test_se_field.js
// established for apps_script_v2.2.3.gs: this file pulls timeToSec() and the whole SE-import
// parser/matcher/reader block straight out of index.html by text markers and evals it, so what
// is tested here is byte-for-byte the code that ships — there is no separate se_import_core.js/
// se_import_reader.js source file to drift out of sync with it.
//
// Covers: parseSeSheetRows() against the two real sample .xlsx files (via openpyxl, independent
// of our own reader) and against adversarial/malformed synthetic input; combineSeParsedFiles();
// matchSeSwimmer()/matchAllSeSwimmers() including the coach's real "Arty vs Artyom" scenario;
// and readXlsxRows() against the same two real files plus zip-bomb/truncation/oversize hardening.
//
// readXlsxRows()'s real implementation calls the browser's DecompressionStream via
// XLSX_BROWSER_DEPS; jsdom's Blob doesn't implement .stream() so that exact object isn't
// exercised here (see probe_se_import.js's header for how the browser wiring itself is
// checked). Here readXlsxRows(bytes, deps) is called with an equivalent Node inflate (zlib) —
// the parsing/zip-walking code under test is identical either way; only the platform primitive
// for decompression differs, which is one documented line in XLSX_BROWSER_DEPS.

const fs = require('fs'), path = require('path'), zlib = require('zlib'), vm = require('vm');
const { execFileSync } = require('child_process');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const ALL_EVENTS = ['50 Free','100 Free','200 Free','400 Free','800 Free','1500 Free','50 Back','100 Back','200 Back','50 Breast','100 Breast','200 Breast','50 Fly','100 Fly','200 Fly','100 IM','200 IM','400 IM'];

function extractBetween(text, startMarker, endMarker) {
  const s = text.indexOf(startMarker);
  const e = text.indexOf(endMarker, s);
  if (s === -1 || e === -1) throw new Error(`Could not find markers "${startMarker}" / "${endMarker}" in index.html — has the file structure changed?`);
  return text.slice(s, e);
}
function extractFunction(text, name) {
  const re = new RegExp(`function ${name}\\([^)]*\\)\\s*\\{`);
  const m = re.exec(text);
  if (!m) throw new Error(`Could not find function ${name}() in index.html`);
  let i = m.index + m[0].length, depth = 1;
  while (depth > 0 && i < text.length) { if (text[i] === '{') depth++; else if (text[i] === '}') depth--; i++; }
  return text.slice(m.index, i);
}

const timeToSecSrc = extractFunction(html, 'timeToSec');
const seBlock = extractBetween(html, '// SE PB REPORT IMPORT — parser + matcher (v2.11)', '// SE PB REPORT IMPORT — UI orchestration (v2.11)');

const sandboxSrc = timeToSecSrc + '\n' + seBlock + `
this.api = { parseSeSheetRows, parseSeSwimmerHeader, parseSeTime, parseSeDate, combineSeParsedFiles, matchSeSwimmer, matchAllSeSwimmers, normaliseNameKey, readXlsxRows, XLSX_LIMITS };`;
const sandbox = { ALL_EVENTS, console, TextDecoder, Uint8Array, DataView };
vm.createContext(sandbox);
vm.runInContext(sandboxSrc, sandbox);
const A = sandbox.api;

let failures = 0;
const check = (d, c) => { console.log(c ? 'PASS -' : 'FAIL -', d); if (!c) failures++; };

const UP = '/mnt/user-data/uploads/';
function groundTruthRows(file) {
  return JSON.parse(execFileSync('python3', ['-c', `
import json, openpyxl
ws = openpyxl.load_workbook("${UP}${file}").worksheets[0]
print(json.dumps([[('' if c.value is None else str(c.value)) for c in r] for r in ws.iter_rows()]))
`]).toString());
}
const scRows = groundTruthRows('ALL_COMPETITIVE_SHORT_COURSE_-_Copy.xlsx');
const lcRows = groundTruthRows('ALL_COMPETITIVE_LONG_COURSE_-_Copy.xlsx');

// ════════════════════════════════════════════════════════════════════════
// PART 1 — parseSeSheetRows() / combineSeParsedFiles() against the real files
// ════════════════════════════════════════════════════════════════════════
const sc = A.parseSeSheetRows(scRows), lc = A.parseSeSheetRows(lcRows);
check('SC file parses with no fatal error', !sc.fatal);
check('LC file parses with no fatal error', !lc.fatal);
check('SC file course detected as S, LC as L', sc.course === 'S' && lc.course === 'L');
check('SC: 2 swimmers found; no row errors or warnings', sc.swimmers.length === 2 && !sc.errors.length && !sc.warnings.length);
check('LC: 2 swimmers found; no row errors or warnings', lc.swimmers.length === 2 && !lc.errors.length && !lc.warnings.length);
const bobSC = sc.swimmers[0], bibSC = sc.swimmers[1];
check('header parsed: Baker, Bob -> "Bob Baker", 2013-10-18, Boys, SE 1234567',
  bobSC.fullName === 'Bob Baker' && bobSC.dob === '2013-10-18' && bobSC.gender === 'Boys' && bobSC.se === '1234567');
check('header parsed: Bremer, Bib -> Girls, 2011-06-07, 8-digit SE # kept', bibSC.gender === 'Girls' && bibSC.dob === '2011-06-07' && bibSC.se === '32145678');
check('SC Bob has 9 events; SC Bib has 11 (independently counted with openpyxl)', bobSC.entries.length === 9 && bibSC.entries.length === 11);
const bob50 = bobSC.entries.find(e => e.event === '50 Free');
check('event row: 50 Free 36.97S 17/05/2026 -> time "36.97", course S, ISO date',
  bob50.time === '36.97' && bob50.course === 'S' && bob50.date === '2026-05-17');
check('minutes time kept in dashboard shape: 100 Free "1:26.25"', bobSC.entries.find(e => e.event === '100 Free').time === '1:26.25');
check('P/F/T column never surfaces on any entry', [...sc.swimmers, ...lc.swimmers].every(s => s.entries.every(e => !('pft' in e) && !('stage' in e))));
check('a meet name longer than 30 chars is preserved untruncated (real files show SE does NOT always cap at 30)',
  bibSC.entries.some(e => e.competition === 'BHSC Christmas Cracker 2025 (Harrow)') || bobSC.entries.some(e => e.competition === 'BHSC Christmas Cracker 2025 (Harrow)'));
check('inconsistent blank-row spacing within one swimmer\'s own block (real file) parses correctly either way',
  bobSC.entries.some(e => e.event === '50 Fly') && bobSC.entries.some(e => e.event === '100 Fly'));
check('every parsed entry carries a valid course letter and ISO date', [...sc.swimmers, ...lc.swimmers].every(s => s.entries.every(e => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && (e.course === 'S' || e.course === 'L'))));

const combined = A.combineSeParsedFiles([sc, lc]);
check('combining SC+LC merges the same SE # into 2 swimmers, not 4', combined.swimmers.length === 2 && !combined.errors.length);
const bobBoth = combined.swimmers.find(s => s.se === '1234567');
check('combined Bob has both S and L entries', bobBoth.entries.some(e => e.course === 'S') && bobBoth.entries.some(e => e.course === 'L'));
check('combined Bob entry count = SC + LC', bobBoth.entries.length === bobSC.entries.length + lc.swimmers[0].entries.length);

// ── Row-shape robustness: blank-row POSITION must never matter (the real bug class SE's
// inconsistent spacing could otherwise cause) ────────────────────────────────────────────
const stripped = scRows.filter(r => r.some(c => String(c).trim() !== ''));
const strippedRes = A.parseSeSheetRows(stripped);
check('stripping ALL blank rows from the real file gives identical swimmers/entries',
  JSON.stringify(strippedRes.swimmers.map(s => [s.fullName, s.entries.map(e => e.event + e.time)])) ===
  JSON.stringify(sc.swimmers.map(s => [s.fullName, s.entries.map(e => e.event + e.time)])));
const blank = () => ['', '', '', '', '', ''];
const padded = [scRows[0]]; scRows.slice(1).forEach(r => padded.push(blank(), r, blank()));
const paddedRes = A.parseSeSheetRows(padded);
check('a blank row inserted between EVERY row of the real file still parses identically',
  paddedRes.swimmers.length === 2 && paddedRes.swimmers[0].entries.length === 9 && paddedRes.swimmers[1].entries.length === 11);

// ── Header validation ─────────────────────────────────────────────────────
check('wrong header row is a fatal rejection', !!A.parseSeSheetRows([['a', 'b', 'c'], ['x']]).fatal);
check('empty/null input rejected', !!A.parseSeSheetRows([]).fatal && !!A.parseSeSheetRows(null).fatal);
const mixed = A.parseSeSheetRows([scRows[0], scRows[1], scRows[2], ['1', '100 Free', '1:30.00L', 'F', '01/01/2026', 'X']]);
check('a file mixing S and L course times is rejected', /mixes/.test(mixed.fatal || ''));

// ── Untrusted / malformed input ───────────────────────────────────────────
const HDR = scRows[0];
const bad = A.parseSeSheetRows([HDR,
  ['Doe, Jane: 01/02/2012  (Girl 14) 111', '', '', '', '', ''],
  ['1', '50 Free', '31.00S', 'F', '31/02/2026', 'Bad date'],
  ['1', '50 Back', 'fast', 'F', '01/01/2026', 'Bad time'],
  ['1', '99 Free', '31.00S', 'F', '01/01/2026', 'Bad event'],
  ['1', '100 Free', '1:75.00S', 'F', '01/01/2026', 'Seconds >= 60'],
  ['1', '200 Free', '2:30.00S', 'F', '01/01/2026', '<img src=x onerror=alert(1)>'],
  ['Garbage header line', '', '', '', '', ''],
  ['1', '50 Free', '20.00S', 'F', '01/01/2026', 'ORPHAN - must not be credited to Jane'],
]);
check('bad date/time/event/seconds rows are each skipped and reported, plus the garbage header and its orphan (6 errors total)', bad.errors.length === 6);
check('only the one valid row survives on Jane', bad.swimmers.length === 1 && bad.swimmers[0].entries.length === 1 && bad.swimmers[0].entries[0].event === '200 Free');
check('an orphan row after an unrecognised header is NOT credited to the previous swimmer', !bad.swimmers[0].entries.some(e => e.time === '20.00'));
check('markup in a meet name is kept as inert text (parser never builds HTML - escaping is the UI\'s job)', bad.swimmers[0].entries[0].competition === '<img src=x onerror=alert(1)>');
const dupRows = A.parseSeSheetRows([HDR, ['Doe, Jane: 01/02/2012  (Girl 14) 111', '', '', '', '', ''], ['1', '50 Free', '31.00S', 'F', '01/01/2026', 'a'], ['2', '50 Free', '30.00S', 'F', '02/01/2026', 'b']]);
check('duplicate event rows for one swimmer: the fastest is kept, a warning is raised', dupRows.swimmers[0].entries.length === 1 && dupRows.swimmers[0].entries[0].time === '30.00' && dupRows.warnings.length === 1);
check('a numeric (not string) rank cell is still recognised', A.parseSeSheetRows([HDR, ['Doe, Jane: 01/02/2012  (Girl 14) 111', '', '', '', '', ''], [1, '50 Free', '31.00S', 'F', '01/01/2026', 'a']]).swimmers[0].entries.length === 1);
const hdrParsed = A.parseSeSwimmerHeader('De La Cruz-Smith, Mary Jane: 05/05/2010  (Girl 16) 9876543');
check('hyphenated/multi-word surname and forename split correctly', hdrParsed.surname === 'De La Cruz-Smith' && hdrParsed.forename === 'Mary Jane' && hdrParsed.fullName === 'Mary Jane De La Cruz-Smith');
check('a header with no SE # is accepted, se left undefined', A.parseSeSwimmerHeader('Doe, Jane: 01/02/2012  (Girl 14)').se === undefined);

// Real-world coach report had a category prefix before Gender/Age ("Open/Boy N") that the
// original regex didn't expect, silently orphaning every event row beneath such a header.
const catHdr = A.parseSeSwimmerHeader('Smith, John: 21/05/2014  (Open/Boy 12) 1652233');
check('a "(Open/Boy N)" category-prefixed header parses correctly (real coach report format)',
  !!catHdr && catHdr.fullName === 'John Smith' && catHdr.gender === 'Boys' && catHdr.ageLabel === '12' && catHdr.se === '1652233');
check('plain "(Boy N)" with no category prefix still parses (the original two sample files\' format)',
  A.parseSeSwimmerHeader('Smith, John: 21/05/2014  (Boy 12) 1652233').gender === 'Boys');
check('a multi-segment category prefix "(Open/National/Girl N)" also parses',
  A.parseSeSwimmerHeader('Doe, Jane: 01/02/2012  (Open/National/Girl 14) 111').gender === 'Girls');
// And the end-to-end row-shape parser must not orphan the events under such a header.
const catFileRes = A.parseSeSheetRows([HDR,
  ['Smith, John: 21/05/2014  (Open/Boy 12) 1652233', '', '', '', '', ''],
  ['1', '50 Free', '31.00S', 'F', '01/01/2026', 'Meet'],
]);
check('a real "(Open/Boy N)" header is recognised end-to-end by parseSeSheetRows() - no orphaned event row, no fatal error',
  !catFileRes.fatal && catFileRes.swimmers.length === 1 && catFileRes.swimmers[0].entries.length === 1 && !catFileRes.errors.length);
check('parseSeDate rejects an impossible date and accepts a real leap day', A.parseSeDate('30/02/2026') === null && A.parseSeDate('29/02/2024') === '2024-02-29' && A.parseSeDate('29/02/2026') === null);
check('parseSeTime rejects a missing course letter and a zero time', A.parseSeTime('36.97') === null && A.parseSeTime('0.00S') === null);

// ════════════════════════════════════════════════════════════════════════
// PART 2 — matching, including the coach's real "Arty vs Artyom" scenario
// ════════════════════════════════════════════════════════════════════════
const mk = (name, dob, gender, se) => ({ name, dob, gender, ...(se ? { se } : {}) });
const seOf = (surname, forename, dob, gender, se) => ({ surname, forename, fullName: `${forename} ${surname}`, dob, gender, se });

let r = A.matchSeSwimmer(seOf('Sushinski', 'Artyom', '2014-03-03', 'Boys', '5550001'), [mk('Arty Sushinski', '2014-03-03', 'Boys', '5550001')]);
check('real-world case: SE # match wins even though the GALA sheet name ("Arty") differs from SE\'s ("Artyom") - auto, flagged nameDiffers', r.status === 'matched-se' && r.nameDiffers === true);
r = A.matchSeSwimmer(seOf('Sushinski', 'Artyom', '2014-03-03', 'Boys', '5550001'), [mk('Arty Sushinski', '2014-03-03', 'Boys')]);
check('Arty vs Artyom with no SE # yet on the roster -> confirm, HIGH confidence (never auto-applied)', r.status === 'confirm' && r.confidence === 'high');
r = A.matchSeSwimmer(seOf('Baker', 'Robert', '2013-10-18', 'Boys', '1234567'), [mk('Bob Baker', '2013-10-18', 'Boys')]);
check('Bob vs Robert (same dob/surname, unrelated first name) -> confirm, LOW confidence', r.status === 'confirm' && r.confidence === 'low');
r = A.matchSeSwimmer(seOf('Baker', 'Bob', '2013-10-18', 'Boys', '1234567'), [mk('  bob   BAKER ', '2013-10-18', 'Boys')]);
check('exact name+dob with messy whitespace/case matches automatically', r.status === 'matched-name');
r = A.matchSeSwimmer(seOf('Baker', 'Bob', '2013-10-18', 'Boys', '1234567'), [mk('Bob Baker', '2013-10-19', 'Boys')]);
check('same name, DIFFERENT dob -> unmatched (never guessed)', r.status === 'unmatched');
r = A.matchSeSwimmer(seOf('Baker', 'Bob', '2013-10-18', 'Boys', '1234567'), [mk('Bob Baker', '2013-10-18', 'Boys', '7654321')]);
check('name+dob match but the roster already has a DIFFERENT SE # -> confirm, never auto', r.status === 'confirm' && /7654321/.test(r.reason));
r = A.matchSeSwimmer(seOf('Baker', 'Bob', '2013-10-18', 'Boys', '1234567'), [mk('Bob Baker', '2000-01-01', 'Boys', '1234567')]);
check('SE # matches but dob differs -> confirm (possible wrong child), not auto', r.status === 'confirm');
r = A.matchSeSwimmer(seOf('Baker', 'Bob', '2013-10-18', 'Boys', '1234567'), [mk('Bob Baker', '2013-10-18', 'Boys'), mk('Bob  Baker', '2013-10-18', 'Boys')]);
check('two roster swimmers collapsing to the same normalised name+dob -> ambiguous', r.status === 'ambiguous' && r.candidates.length === 2);
r = A.matchSeSwimmer(seOf('Kim', 'Alex', '2013-01-01', 'Girls', '111'), [mk('Alex Kim', '2013-01-01', 'Girls', '222')]);
check('exact name+dob but a DIFFERENT SE # already on the roster -> confirm, never auto', r.status === 'confirm' && /222/.test(r.reason));
r = A.matchSeSwimmer(seOf('Kim', 'Samuel', '2013-01-01', 'Girls', '111'), [mk('Sam Kim', '2013-01-01', 'Girls', '222'), mk('Samu Kim', '2013-01-01', 'Girls')]);
check('a twin already holding their OWN different SE # is excluded from suggestions (only the unnumbered one is offered)', r.status === 'confirm' && r.swimmer.name === 'Samu Kim');
r = A.matchSeSwimmer(seOf('Nobody', 'Nemo', '2010-01-01', 'Boys', '999'), [mk('Bob Baker', '2013-10-18', 'Boys', '1234567')]);
check('no plausible candidate at all -> unmatched', r.status === 'unmatched');
r = A.matchSeSwimmer(seOf('Smith', 'Mary Jane', '2012-02-02', 'Girls', '3'), [mk('Mary Jane Smith', '2012-02-02', 'Girls')]);
check('multi-word forename matches exactly', r.status === 'matched-name');
r = A.matchSeSwimmer(seOf('Smith', 'Mary Jane', '2012-02-02', 'Girls', '3'), [mk('Mary Smith', '2012-02-02', 'Girls')]);
check('"Mary" vs "Mary Jane" -> confirm HIGH (first name token matches)', r.status === 'confirm' && r.confidence === 'high');

// Real bug reported by the coach: a roster swimmer matching surname+dob+gender, with a
// DIFFERENT first name AND an already-on-file SE # that conflicts with the incoming one, was
// being fully EXCLUDED from tier 3 (treated like an already-confirmed twin) and fell all the
// way to 'unmatched' with an unhelpful "no match at all" reason - even though three of four
// signals (surname, dob, gender) genuinely agreed. Fixed: such a candidate is deprioritised,
// not excluded - only dropped in favour of an alternative that has NO conflicting SE # at all.
r = A.matchSeSwimmer(seOf('Taylor', 'Robert', '2014-10-12', 'Boys', '9990001'), [mk('Dave Taylor', '2014-10-12', 'Boys', '5551111')]);
check('same surname+dob+gender, differing forename, roster already has a DIFFERENT SE # on file, and NO alternative candidate exists -> still offered as confirm (not unmatched)',
  r.status === 'confirm' && r.swimmer.name === 'Dave Taylor');
check('...and the reason names the existing conflicting SE # so the coach can judge it, rather than hiding the conflict', /5551111/.test(r.reason));
// The pre-existing "twin" behaviour must still hold: when an unconflicted alternative DOES
// exist alongside a conflicted one, the unconflicted one is still preferred, unchanged.
r = A.matchSeSwimmer(seOf('Kim', 'Samuel', '2013-01-01', 'Girls', '111'), [mk('Sam Kim', '2013-01-01', 'Girls', '222'), mk('Samu Kim', '2013-01-01', 'Girls')]);
check('with BOTH a conflicted and an unconflicted candidate present, the unconflicted one is still preferred (unchanged from before this fix)',
  r.status === 'confirm' && r.swimmer.name === 'Samu Kim' && !/222/.test(r.reason));

const twoSeOneRoster = A.matchAllSeSwimmers([seOf('Baker', 'Bob', '2013-10-18', 'Boys', '1'), seOf('Baker', 'Bob', '2013-10-18', 'Boys', '2')], [mk('Bob Baker', '2013-10-18', 'Boys')]);
check('two SE swimmers resolving to ONE roster swimmer are both downgraded to ambiguous (never both write to one child)', twoSeOneRoster.every(x => x.match.status === 'ambiguous'));
const allReal = A.matchAllSeSwimmers(combined.swimmers, [mk('Bob Baker', '2013-10-18', 'Boys', '1234567')]);
check('real samples vs a roster holding only Bob: Bob matched by SE #, Bib correctly unmatched', allReal.find(x => x.se.se === '1234567').match.status === 'matched-se' && allReal.find(x => x.se.se === '32145678').match.status === 'unmatched');

// ════════════════════════════════════════════════════════════════════════
// PART 3 — readXlsxRows() against the same two real files + adversarial input
// ════════════════════════════════════════════════════════════════════════
const dom = new JSDOM('');
const nodeDeps = {
  async inflate(bytes, cap) {
    const out = zlib.inflateRawSync(Buffer.from(bytes));
    if (out.length > cap) throw new Error('This .xlsx expands to an unreasonable size and was rejected.');
    return new Uint8Array(out);
  },
  parseXml(text) { return new dom.window.DOMParser().parseFromString(text, 'application/xml'); },
};

async function part3() {
  const scBytes = fs.readFileSync(UP + 'ALL_COMPETITIVE_SHORT_COURSE_-_Copy.xlsx');
  const lcBytes = fs.readFileSync(UP + 'ALL_COMPETITIVE_LONG_COURSE_-_Copy.xlsx');

  const scRead = await A.readXlsxRows(scBytes, nodeDeps);
  check('reader opens the real SC file with no exception', Array.isArray(scRead.rows) && scRead.rows.length > 0);
  check('reader recovers the header row correctly from raw XML/shared-strings', scRead.rows[0].slice(0, 6).map(s => s.toLowerCase()).join('|') === 'rank|event|best time|p/f/t|date|meet name');
  check('reader finds Bob\'s SC header text intact', scRead.rows.some(row => row[0] === 'Baker, Bob: 18/10/2013  (Boy 12) 1234567'));
  check('reader finds a known event/time/date cell for Bob', scRead.rows.some(row => row[1] === '50 Free' && row[2] === '36.97S' && row[4] === '17/05/2026'));

  const lcRead = await A.readXlsxRows(lcBytes, nodeDeps);
  check('reader opens the real LC file with no exception', lcRead.rows.length > 0);
  check('reader returns the actual first-sheet name (never hardcoded/assumed)', typeof lcRead.sheetName === 'string' && lcRead.sheetName.length > 0);

  const pad6 = rows => rows.map(row => { const c = row.map(x => String(x).trim()); while (c.length < 6) c.push(''); return c.slice(0, 6); }).filter(row => row.some(c => c !== ''));
  check('reader output matches openpyxl\'s independent ground truth cell-for-cell on the real SC file', JSON.stringify(pad6(scRead.rows)) === JSON.stringify(pad6(scRows)));

  const notAZip = new TextEncoder().encode('hello world, not a zip file at all');
  await A.readXlsxRows(notAZip, nodeDeps).then(() => check('non-zip bytes rejected', false), e => check('non-zip bytes rejected: ' + e.message, /not a/.test(e.message)));

  const truncated = scBytes.subarray(0, scBytes.length - 200);
  await A.readXlsxRows(truncated, nodeDeps).then(() => check('truncated zip rejected', false), e => check('a real zip truncated past its central directory is rejected: ' + e.message, true));

  const oversize = new Uint8Array(A.XLSX_LIMITS.maxFileBytes + 1);
  await A.readXlsxRows(oversize, nodeDeps).then(() => check('oversize file rejected', false), e => check('a file over the size cap is rejected before any parsing: ' + e.message, /too large/.test(e.message)));

  // Zip-bomb guard: the declared (header) size is attacker-controlled — the real protection
  // is inflate() counting actual output bytes, not trusting the header's claim.
  const bigPlain = Buffer.alloc(25 * 1024 * 1024, 'A');
  const deflated = zlib.deflateRawSync(bigPlain);
  function buildZip(entryName, compressed, liedUncompressedSize) {
    const nameBuf = Buffer.from(entryName);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); localHeader.writeUInt16LE(20, 4); localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8); localHeader.writeUInt32LE(compressed.length, 18); localHeader.writeUInt32LE(liedUncompressedSize, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    const cdHeader = Buffer.alloc(46);
    cdHeader.writeUInt32LE(0x02014b50, 0); cdHeader.writeUInt16LE(8, 10);
    cdHeader.writeUInt32LE(compressed.length, 20); cdHeader.writeUInt32LE(liedUncompressedSize, 24);
    cdHeader.writeUInt16LE(nameBuf.length, 28); cdHeader.writeUInt32LE(0, 42);
    const local = Buffer.concat([localHeader, nameBuf, compressed]);
    const cd = Buffer.concat([cdHeader, nameBuf]);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(local.length, 16);
    return Buffer.concat([local, cd, eocd]);
  }
  const bombZip = buildZip('xl/workbook.xml', deflated, 100); // header lies: claims 100 bytes, really inflates to 25MB
  await A.readXlsxRows(new Uint8Array(bombZip), nodeDeps).then(
    () => check('an entry lying about its size to hide a real decompression bomb is rejected', false),
    e => check('inflate() catches an entry whose declared header size lies about a real decompression bomb: ' + e.message, /unreasonable size/.test(e.message)));

  console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
  process.exit(failures ? 1 : 0);
}
part3().catch(e => { console.error('UNCAUGHT:', e); process.exit(1); });
