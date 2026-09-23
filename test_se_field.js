// test_se_field.js — v2.9
//
// Dev-time Node test for apps_script_v2.2.3.gs's new SE # column-read logic. Not part of the
// shipped Apps Script project or the shipped dashboard — a local verification tool only,
// matching the project's "extract the pure logic and test that directly" convention
// established in the v2.9 handover discussion.
//
// SCOPE AND LIMITS (read this before trusting what "passing" means here):
// Apps Script's own plumbing (SpreadsheetApp.getActiveSpreadsheet(), sheet.getDataRange(),
// PropertiesService, etc.) cannot be exercised in a plain Node process — there's no live
// Google Sheet here, and no realistic mock is worth building for it. This file therefore
// does NOT test buildPayload() end-to-end. It tests the one function v2.9 pulled out
// specifically so it COULD be tested this way: parseBasicDataRow(row, ss), the pure
// row-array -> swimmer-fields mapper. That's deliberate, not a gap: the actual risk in this
// change (wrong column index, a header/data shape mismatch, a coach's blank-cell edge case)
// lives entirely inside that function, not in the SpreadsheetApp calls around it.
//
// How this works: the .gs file is plain JS aside from its GAS-global calls, so we can read it
// as text, strip out the handful of functions/lines that touch GAS-only globals
// (SpreadsheetApp, PropertiesService, ContentService, Utilities, Logger), and eval what's left
// in this Node process. formatDob()'s Date-instance branch calls fmtDate() -> Utilities — we
// never exercise that branch here (every test row uses a DD/MM/YYYY string DOB, exactly like
// a Google Sheet with a plain-text-formatted date column, which is what formatDob()'s
// string-splitting branch is actually for), so Utilities is never invoked.

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'apps_script_v2.2.3.gs'), 'utf8');

// Strip only what would throw due to missing GAS globals if evaluated: doGet() (uses
// PropertiesService/ContentService), buildPayload()/buildOutput() (use SpreadsheetApp),
// testRun() (calls buildPayload), and setToken()/safeCompare() (PropertiesService — unrelated
// to this test anyway). Left in: everything parseBasicDataRow() actually depends on
// (mapGender, formatDob, formatName, mapSquad, formatSE, toTitleCase, the BASIC_COL_* consts,
// parseBasicDataRow itself) plus a few harmless unrelated helpers (parseTimeStr,
// columnToLetter, getFinalCumColIndex, secsToTimeStr, fmtDate — fmtDate is unused by any path
// this test exercises, kept only because it's textually interleaved with functions we do need).
function stripFunction(text, name) {
  const re = new RegExp(`function ${name}\\([^)]*\\)\\s*\\{`);
  const m = re.exec(text);
  if (!m) throw new Error(`Could not find function ${name} to strip — has the .gs file structure changed?`);
  let i = m.index + m[0].length;
  let depth = 1;
  while (depth > 0 && i < text.length) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') depth--;
    i++;
  }
  return text.slice(0, m.index) + text.slice(i);
}

let sandboxSrc = src;
['doGet', 'buildPayload', 'buildOutput', 'testRun', 'setToken', 'safeCompare'].forEach(fn => {
  sandboxSrc = stripFunction(sandboxSrc, fn);
});

// Top-level `const`/`function` declarations from a vm-evaluated script don't attach to the
// sandbox object as properties by default (const/let live in a separate lexical environment
// even at "global" scope) — explicitly re-assign the handful we need onto `this` so the test
// below can read them back out.
sandboxSrc += `
this.parseBasicDataRow = parseBasicDataRow;
this.formatSE = formatSE;
this.BASIC_COL_SE = BASIC_COL_SE;
`;

const vm = require('vm');
const sandbox = { console };
vm.createContext(sandbox);
try {
  vm.runInContext(sandboxSrc, sandbox);
} catch (e) {
  console.error('Failed to load stripped Apps Script source into the test sandbox:', e.message);
  process.exit(1);
}
const { parseBasicDataRow, formatSE, BASIC_COL_SE } = sandbox;

let failures = 0;
function check(desc, cond) {
  if (cond) console.log('PASS -', desc);
  else { console.log('FAIL -', desc); failures++; }
}

// A stub `ss` is passed everywhere real code would pass the Sheet — it's never actually used,
// since every DOB below is a DD/MM/YYYY string (formatDob's non-Date branch), matching how a
// plain-text Basic Data DOB column reads in practice.
const stubSs = {};

// ── 1. Column index is genuinely column E (index 4) ──────────────────────
check('BASIC_COL_SE is index 4 (column E)', BASIC_COL_SE === 4);

// ── 2. A normal row with an SE # present ──────────────────────────────────
const rowWithSe = ['Baker, Bob', 'M', '18/10/2013', 'Junior', '1234567'];
const parsedWithSe = parseBasicDataRow(rowWithSe, stubSs);
check('name parses correctly (Lastname, Firstname -> Firstname Lastname)', parsedWithSe.name === 'Bob Baker');
check('gender maps M -> Boys', parsedWithSe.gender === 'Boys');
check('dob converts DD/MM/YYYY -> YYYY-MM-DD', parsedWithSe.dob === '2013-10-18');
check('squad normalises', parsedWithSe.squad === 'Junior');
check('se is read from column E as a string', parsedWithSe.se === '1234567');

// ── 3. A row with a BLANK SE # cell — must not create an empty string ────
const rowNoSe = ['Carter, Amy', 'F', '23/09/2013', 'Senior', ''];
const parsedNoSe = parseBasicDataRow(rowNoSe, stubSs);
check('a swimmer with no SE # gets se === undefined, not an empty string', parsedNoSe.se === undefined);

// ── 4. Row shorter than 5 columns (SE # column doesn't exist yet on an older Sheet) ──
const rowShort = ['Diaz, Andrew', 'M', '24/06/2014', 'Junior'];
const parsedShort = parseBasicDataRow(rowShort, stubSs);
check('a row with no column E at all is treated the same as a blank cell (se undefined)', parsedShort.se === undefined);
check('the rest of the row still parses fine when column E is entirely absent', parsedShort.name === 'Andrew Diaz' && parsedShort.gender === 'Boys');

// ── 5. SE # stored as a genuine Sheets number (e.g. a coach typed digits with no
//      leading-zero concern and Sheets auto-detected it as numeric) ──────────
const rowNumericSe = ['Evans, Robert', 'M', '12/10/2014', 'Junior', 1745801];
const parsedNumericSe = parseBasicDataRow(rowNumericSe, stubSs);
check('a numeric (not string) SE # cell is coerced to a string', parsedNumericSe.se === '1745801');

// ── 6. SE # with stray whitespace (a common paste artifact) ──────────────
check('formatSE trims stray whitespace', formatSE('  1745801  ') === '1745801');
check('formatSE treats a whitespace-only cell as absent', formatSE('   ') === undefined);
check('formatSE treats null/undefined as absent', formatSE(null) === undefined && formatSE(undefined) === undefined);

// ── 7. A row that fails a REQUIRED field (no dob) is still rejected outright, same as
//      before this change — SE # must never rescue an otherwise-invalid row ──────
const rowNoDob = ['Franklin, Zoe', 'F', '', 'Senior', '9988776'];
check('a row missing a required field (dob) is still rejected regardless of SE #', parseBasicDataRow(rowNoDob, stubSs) === null);

// ── 8. A completely blank row (no name) is rejected, same as before ───────
check('a blank row (no name) is rejected', parseBasicDataRow(['', '', '', '', ''], stubSs) === null);

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`));
process.exit(failures === 0 ? 0 : 1);
