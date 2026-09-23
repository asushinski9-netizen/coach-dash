// ============================================================
// Broomfield Park SC — Coach Dashboard Apps Script
// Version: 2.2.3 (v2.9 — SE # field, see se-pb-import-and-history-plan.md Section 5)
//
// v2.2.3 changes (index.html v2.9 session):
//   - "Basic Data" tab now has a 5th column read: column E, header "SE #" (Swim England ID).
//     Pulled into a new BASIC_COL_SE constant, alongside the other Basic Data column indices
//     (also newly named — BASIC_COL_NAME/GENDER/DOB/SQUAD — previously bare row[0..3] magic
//     numbers) so this addition is a one-line change rather than shifting unlabelled indices.
//   - The row -> swimmer-fields mapping (name/gender/dob/squad/se) is now its own pure
//     function, parseBasicDataRow(), taking a plain row array + the spreadsheet (for
//     formatDob's timezone only) rather than reading SpreadsheetApp state itself. This is
//     deliberately unit-testable outside Apps Script (see test_se_field.js in the dashboard
//     repo) — buildPayload()'s own Sheet-reading plumbing around it still isn't testable in
//     a non-Apps-Script environment, but the actual risk in this change (an off-by-one column
//     index, a header/data shape mismatch) lives entirely in parseBasicDataRow(), which now
//     is.
//   - buildOutput() includes an `se` field on a swimmer's payload entry when present (never
//     an empty string — an absent/blank Sheet cell means the field is omitted entirely, same
//     convention as `squad`).
//   - Payload `version` bumped 2.2 -> 2.3 to reflect the new optional field.
// No changes to PB computation, DQ detection, or the doGet()/token-check security work from
// v2.2.2 — that all carries forward unchanged.
//
// SETUP:
//   1. In Apps Script editor: Project Settings > Script Properties
//      Add property: ACCESS_TOKEN = your-secret-token-here
//   2. Deploy as Web App: Execute as Me, Anyone with Google account
//   3. The Sheet never needs to be public.
//   4. "Basic Data" tab needs a 5th column, header "SE #", from row 2 down — same header row
//      convention as the other four columns. Leave a cell blank for any swimmer without one.
// ============================================================

const TAB_BASIC       = 'Basic Data';
const TAB_RESULTS     = 'Results';
const DATA_START_ROW  = 2;
const BASIC_START_ROW = 2;

// DQ: direct hex colour matching against known Google Sheets yellow fills
const DQ_HEX_COLORS = ['#ffff00', '#fff2cc', '#ffe599', '#ffd966'];

const EVENT_MAP = {
  '50 FS': '50 Free', '100 FS': '100 Free', '200 FS': '200 Free', '400 FS': '400 Free', '800 FS': '800 Free', '1500 FS': '1500 Free',
  '50 BK': '50 Back', '100 BK': '100 Back', '200 BK': '200 Back',
  '50 BRST': '50 Breast', '100 BRST': '100 Breast', '200 BRST': '200 Breast',
  '50 FLY': '50 Fly', '100 FLY': '100 Fly', '200 FLY': '200 Fly',
  '100 IM': '100 IM', '200 IM': '200 IM', '400 IM': '400 IM'
};

function getFinalCumColIndex(eventName) {
  const distMatch = eventName.match(/^(\d+)/);
  if (!distMatch) return -1;
  const dist = parseInt(distMatch[1]);
  return 6 + ((dist / 50) * 2) - 1;
}

function fmtDate(val, ss) {
  if (!val || !(val instanceof Date)) return '';
  try {
    return Utilities.formatDate(val, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
  } catch(e) {
    return '';
  }
}

function secsToTimeStr(totalSecs) {
  if (!totalSecs || isNaN(totalSecs) || totalSecs <= 0) return null;
  const mins = Math.floor(totalSecs / 60);
  const secs = (totalSecs - mins * 60).toFixed(2);
  const secsPadded = parseFloat(secs) < 10 ? '0' + secs : secs;
  return mins > 0 ? `${mins}:${secsPadded}` : secs;
}

function formatName(sheetName) {
  if (!sheetName) return '';
  const parts = sheetName.split(',');
  if (parts.length < 2) return toTitleCase(sheetName.trim());
  return `${toTitleCase(parts[1].trim())} ${toTitleCase(parts[0].trim())}`;
}

function toTitleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function mapGender(raw) {
  const v = String(raw || '').trim().toUpperCase();
  return v === 'M' ? 'Boys' : v === 'F' ? 'Girls' : null;
}

function formatDob(val, ss) {
  if (!val) return '';
  if (val instanceof Date) return fmtDate(val, ss);
  const parts = String(val).trim().split('/');
  if (parts.length === 3) {
    return `${parts[2].padStart(4,'0')}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
  }
  return '';
}

function mapSquad(raw) {
  if (!raw) return undefined;
  const SQUAD_MAP = { 'dev': 'Development', 'development': 'Development', 'jun': 'Junior', 'junior': 'Junior', 'sen': 'Senior', 'senior': 'Senior', 'active': 'Active', 'masters': 'Masters' };
  const key = String(raw).trim().toLowerCase();
  return SQUAD_MAP[key] || toTitleCase(String(raw).trim()) || undefined;
}

function doGet(e) {
  try {
    // Token is stored in Script Properties (Project Settings > Script Properties)
    // — never hardcoded in source, never visible in the dashboard HTML file.
    const expectedToken = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN');
    const clientToken   = e.parameter && e.parameter.token;

    if (!expectedToken) {
      // Script property not set — return a clear setup error
      return ContentService
        .createTextOutput(JSON.stringify({ error: true, message: 'ACCESS_TOKEN script property not set. See setup instructions.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (!safeCompare(clientToken, expectedToken)) {
      // Log the attempt (visible in Apps Script execution log)
      console.warn('Unauthorised sync attempt at ' + new Date().toISOString());
      return ContentService
        .createTextOutput(JSON.stringify({ error: true, message: 'Unauthorised.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify(buildPayload()))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    console.error('doGet error:', err.message);
    return ContentService
      .createTextOutput(JSON.stringify({ error: true, message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// "Basic Data" tab column indices (0-based). Named here so adding/moving a column — as this
// v2.9 session just did for SE # — is a one-line change, not a hunt through magic numbers.
const BASIC_COL_NAME   = 0; // A — Swimmer Full Name
const BASIC_COL_GENDER = 1; // B — M/F
const BASIC_COL_DOB    = 2; // C — DD/MM/YYYY
const BASIC_COL_SQUAD  = 3; // D — free text, normalised via SQUAD_MAP
const BASIC_COL_SE     = 4; // E — "SE #", new in v2.9 (Swim England ID)

// Pure row -> swimmer-fields mapper. Deliberately has no dependency on SpreadsheetApp/Sheet
// objects beyond `ss` (needed only for formatDob's timezone), so it can be exercised directly
// from a plain Node test with a mocked row array + a stub ss — see test_se_field.js. Returns
// null for a row that shouldn't become (or update) a swimmer, exactly matching the `continue`
// conditions the original inline loop used.
function parseBasicDataRow(row, ss) {
  const rawName = String(row[BASIC_COL_NAME] || '').trim();
  if (!rawName) return null;

  const gender = mapGender(row[BASIC_COL_GENDER]);
  const dob    = formatDob(row[BASIC_COL_DOB], ss);
  const name   = formatName(rawName);
  const squad  = mapSquad(row[BASIC_COL_SQUAD]);
  const se     = formatSE(row[BASIC_COL_SE]);

  if (!name || !gender || !dob) return null;

  return { rawName, name, gender, dob, squad, se };
}

// SE # is a free-text Sheet cell in practice — a coach could paste it with stray whitespace,
// or Sheets could store a numeric-looking value as an actual number. Normalise to a trimmed
// string; a blank cell becomes undefined so it never shows up as an empty string in the
// payload (matching how `squad` is already handled in buildOutput() below). Format/digit
// validation itself is deliberately NOT done here — that's the dashboard's job
// (sanitiseSwimmersData() in index.html), so there is exactly one place that decides what a
// valid SE # looks like, not two definitions that could quietly drift apart.
function formatSE(raw) {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  return s || undefined;
}

function buildPayload() {
  // getActiveSpreadsheet() works because the script is bound to the Sheet.
  // No Sheet ID needed — and no risk of the ID being exposed.
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Process Profile Data
  const basicSheet  = ss.getSheetByName(TAB_BASIC);
  const basicData   = basicSheet.getDataRange().getValues();
  const swimmerMap  = {}; 

  for (let r = BASIC_START_ROW; r < basicData.length; r++) {
    const parsed = parseBasicDataRow(basicData[r], ss);
    if (!parsed) continue;

    swimmerMap[parsed.rawName] = {
      id: 'sh_' + parsed.rawName.replace(/[^a-z0-9]/gi, '_').toLowerCase(),
      name: parsed.name, dob: parsed.dob, gender: parsed.gender, squad: parsed.squad,
      se: parsed.se, source: 'sheet', pbs: {}
    };
  }

  // 2. Process Timing Results
  const resultsSheet = ss.getSheetByName(TAB_RESULTS);
  const lastRow      = resultsSheet.getLastRow();
  const lastCol      = resultsSheet.getLastColumn();
  const dataRows     = lastRow - DATA_START_ROW;
  
  if (dataRows < 1) return buildOutput(swimmerMap);

  const rangeStr    = `A${DATA_START_ROW + 1}:${columnToLetter(lastCol)}${lastRow}`;
  const dataRange    = resultsSheet.getRange(rangeStr);
  const values       = dataRange.getValues();
  const backgrounds   = dataRange.getBackgrounds();

  for (let r = 0; r < values.length; r++) {
    const row = values[r];
    
    // Direct string matching against hexadecimal array string map
    if (DQ_HEX_COLORS.includes(backgrounds[r][1].toLowerCase())) continue;

    const rawName   = String(row[1] || '').trim();
    const rawEvent  = String(row[3] || '').trim();
    const rawDate   = row[4];
    const rawCourse = String(row[5] || '').trim();

    if (!rawName || !rawEvent) continue;

    const eventName = EVENT_MAP[rawEvent];
    if (!eventName) continue; 

    const course = rawCourse === 'SC' ? 'S' : rawCourse === 'LC' ? 'L' : null;
    if (!course) continue;

    const swimmer = swimmerMap[rawName];
    if (!swimmer) continue; 

    const finalColIdx = getFinalCumColIndex(eventName);
    if (finalColIdx < 0 || finalColIdx >= row.length) continue;

    // Force string conversion to protect parseTimeStr from primitive numbers
    const timeSec = parseTimeStr(String(row[finalColIdx] || ''));
    if (!timeSec || timeSec <= 0) continue;

    const dateStr = fmtDate(rawDate, ss);
    const key     = `${eventName}|${course}`;

    if (!swimmer.pbs[key] || timeSec < swimmer.pbs[key].sec) {
      swimmer.pbs[key] = { time: secsToTimeStr(timeSec), sec: timeSec, date: dateStr };
    }
  }

  return buildOutput(swimmerMap);
}

function buildOutput(swimmerMap) {
  const swimmers = Object.values(swimmerMap).map(sw => {
    const pbsArray = Object.entries(sw.pbs).map(([key, pb]) => {
      const [event, course] = key.split('|');
      return { event, course, time: pb.time, date: pb.date };
    });

    const out = { id: sw.id, name: sw.name, dob: sw.dob, gender: sw.gender, source: sw.source, pbs: pbsArray };
    if (sw.squad) out.squad = sw.squad;
    if (sw.se) out.se = sw.se;
    return out;
  });

  return { version: '2.3', generated: new Date().toISOString(), count: swimmers.length, swimmers };
}

function parseTimeStr(str) {
  if (!str || str === '00:00.00' || str === '0') return 0;
  str = str.trim();
  const parts = str.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(parts[0]);
}

function columnToLetter(col) {
  let letter = '';
  while (col > 0) {
    const rem = (col - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}
// ── Test function — run manually in Apps Script editor ────────
// Before running, set ACCESS_TOKEN in Project Settings > Script Properties.
function testRun() {
  const payload = buildPayload();
  Logger.log('Swimmers found: ' + payload.count);
  Logger.log('Generated: ' + payload.generated);
  if (payload.swimmers.length > 0) {
    const s = payload.swimmers[0];
    Logger.log('First swimmer: ' + s.name + ' | ' + s.gender + ' | ' + s.dob + ' | SE#: ' + (s.se || '(none)'));
    Logger.log('PBs (first 3): ' + JSON.stringify(s.pbs.slice(0, 3)));
  }
}

// ── Set token helper — run once to store the token securely ──
// Change the value below, run this function once, then delete it.
// Guarded against accidental re-runs: if a real token is already set, this refuses to
// overwrite it unless called explicitly as setToken(true). Previously, anyone with edit
// access to this Apps Script project (or a future maintainer who forgot the "delete after
// running" instruction) could re-run this with the default placeholder value and silently
// lock every coach out until someone noticed and reset it properly.
function setToken(force) {
  const props = PropertiesService.getScriptProperties();
  const existing = props.getProperty('ACCESS_TOKEN');
  if (existing && !force) {
    Logger.log('ACCESS_TOKEN is already set — refusing to overwrite it. If you are intentionally rotating the token, call setToken(true) instead of re-running this with its default arguments.');
    return;
  }
  props.setProperty('ACCESS_TOKEN', 'REPLACE_WITH_YOUR_TOKEN');
  Logger.log('Token set successfully.');
}

// Constant-time-ish string comparison for the token check in doGet(), replacing a plain
// !== comparison. A strict !== short-circuits on the first mismatched character, which in
// principle leaks (via response timing) how many leading characters of a guessed token were
// correct. Real-world risk here is low (single low-value target, not a public multi-tenant
// service) but this closes the gap for free. Lengths are still compared with an early exit —
// token length isn't the security-sensitive part, the character content is.
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
