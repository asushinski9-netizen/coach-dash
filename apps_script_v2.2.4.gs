// ============================================================
// Broomfield Park SC — Coach Dashboard Apps Script
// Version: 2.2.4 (v2.12 — every dated result, not just the fastest)
//
// v2.2.4 changes (index.html v2.12 session):
//   - buildPayload() now emits EVERY non-DQ Results row as a dated entry, instead of collapsing to
//     the single fastest time per swimmer+event+course. A slower later swim, or two swims entered
//     before a sync, are no longer lost.
//   - A heat and a final on the same day are TWO swims: same-day entries are told apart by time.
//     Only an exact duplicate (same swimmer, event, course, date AND time) collapses.
//   - Rows with no usable date keep the old behaviour (fastest only per event+course) because there
//     is no date to tell them apart; they are counted in stats.undated.
//   - Entries are ordered by date, then by record number (Results column A), so a heat entered
//     before its final stays before it however the Sheet is sorted. The record number is used for
//     ordering and for warnings only; it is never part of the saved swim.
//   - NEW payload field `warnings`: recent swims (last 60 days) more than 15% faster than the
//     swimmer's previous best for that event+course - almost always a typo. Informational only;
//     the dashboard shows them in the sync message and never blocks.
//   - NEW payload field `stats` (row counts: skipped DQ, unknown swimmers, collapsed duplicates...).
//   - Row -> entry mapping is now the pure function parseResultRow() (same pattern as
//     parseBasicDataRow), so it is unit-testable in Node; buildPayload() itself is tested against a
//     fake Sheet (see test_apps_script_v224.js).
//   - Payload `version` 2.3 -> 2.4. The `pbs` entry shape {event, course, time, date} is unchanged,
//     so a dashboard that predates v2.12 still reads this payload.
// No changes to the token check, DQ detection or Basic Data parsing.
//
// SETUP:
//   1. In Apps Script editor: Project Settings > Script Properties
//      Add property: ACCESS_TOKEN = your-secret-token-here
//   2. Deploy as Web App: Execute as Me, Anyone with Google account
//      TO UPDATE AN EXISTING DEPLOYMENT: Deploy > Manage deployments > pencil icon > Version: "New
//      version" > Deploy. This keeps the same URL. ("New deployment" gives a NEW URL and silently
//      breaks sync until Settings is updated - known-bugs #8.)
//   3. The Sheet never needs to be public.
//   4. "Basic Data" tab needs a 5th column, header "SE #", from row 2 down.
// ============================================================

// Build marker, shown by the dashboard after every sync so it is obvious which code the deployed web
// app is actually running (a redeploy that did not take effect is otherwise invisible).
const SCRIPT_BUILD = '2.2.4-b5';

// Reading the Results tab. Measured on the coach's Sheet (v2.12 UAT): every read costs ~1.7 ms PER ROW,
// whatever the number of columns, and the sheet has ~3,100 formula rows below the real data. So the
// last data row is found by reading forward in chunks and stopping after a run of blank chunks, rather
// than scanning every row first; every column is read (a narrower read bought nothing).
const CHUNK_ROWS            = 250;  // rows per read
const MAX_BLANK_CHUNKS      = 2;    // stop after this many consecutive all-blank chunks (a 500-row gap is tolerated)

const TAB_BASIC       = 'Basic Data';
const TAB_RESULTS     = 'Results';
const DATA_START_ROW  = 2;
const BASIC_START_ROW = 2;

// DQ: direct hex colour matching against known Google Sheets yellow fills
const DQ_HEX_COLORS = ['#ffff00', '#fff2cc', '#ffe599', '#ffd966'];

// Warnings: flag a swim this much faster than the swimmer's previous best for the same
// event+course (0.15 = 15%) - juniors genuinely improve fast, so a lower bar would cry wolf.
const PLAUSIBILITY_DROP        = 0.15;
const PLAUSIBILITY_RECENT_DAYS = 60;   // only flag swims this recent: older ones were already seen
const MAX_WARNINGS             = 50;

const EVENT_MAP = {
  '50 FS': '50 Free', '100 FS': '100 Free', '200 FS': '200 Free', '400 FS': '400 Free', '800 FS': '800 Free', '1500 FS': '1500 Free',
  '50 BK': '50 Back', '100 BK': '100 Back', '200 BK': '200 Back',
  '50 BRST': '50 Breast', '100 BRST': '100 Breast', '200 BRST': '200 Breast',
  '50 FLY': '50 Fly', '100 FLY': '100 Fly', '200 FLY': '200 Fly',
  '100 IM': '100 IM', '200 IM': '200 IM', '400 IM': '400 IM'
};

// "Results" tab column indices (0-based).
const RESULT_COL_RECORD = 0; // A - record number
const RESULT_COL_NAME   = 1; // B - "Lastname, Firstname"
const RESULT_COL_GENDER = 2; // C - M/F flag (not used: Basic Data already holds gender)
const RESULT_COL_EVENT  = 3; // D - e.g. "100 FS"
const RESULT_COL_DATE   = 4; // E - date
const RESULT_COL_COURSE = 5; // F - SC / LC

function getFinalCumColIndex(eventName) {
  const distMatch = eventName.match(/^(\d+)/);
  if (!distMatch) return -1;
  const dist = parseInt(distMatch[1]);
  return 6 + ((dist / 50) * 2) - 1;
}

// The spreadsheet's timezone is a service call. fmtDate runs once per Results row, so asking every
// time cost one call per row (~800); it is now fetched once per payload.
let _tzCache = null;
function getTz(ss) {
  if (_tzCache === null) _tzCache = ss.getSpreadsheetTimeZone();
  return _tzCache;
}

function fmtDate(val, ss) {
  if (!val || !(val instanceof Date)) return '';
  try {
    return Utilities.formatDate(val, getTz(ss), "yyyy-MM-dd");
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

// "Basic Data" tab column indices (0-based).
const BASIC_COL_NAME   = 0; // A — Swimmer Full Name
const BASIC_COL_GENDER = 1; // B — M/F
const BASIC_COL_DOB    = 2; // C — DD/MM/YYYY
const BASIC_COL_SQUAD  = 3; // D — free text, normalised via SQUAD_MAP
const BASIC_COL_SE     = 4; // E — "SE #" (Swim England ID)

// Pure row -> swimmer-fields mapper (unchanged since v2.2.3). Returns null for a row that
// shouldn't become a swimmer.
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

// SE # is a free-text Sheet cell: trim it, treat blank as absent. Digit validation is the
// dashboard's job (sanitiseSwimmersData), so there is exactly one definition of a valid SE #.
function formatSE(raw) {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  return s || undefined;
}

function parseRecNo(v) {
  const n = parseInt(String(v === undefined || v === null ? '' : v).replace(/[^0-9]/g, ''), 10);
  return isFinite(n) ? n : null;
}

// Plain-English reason a row's final time could not be used. A cumulative time sitting in an earlier
// column (e.g. the 200's time typed into the 150 column) is the commonest data-entry slip, so say so.
function describeTimeProblem(row, finalColIdx) {
  const txt = v => (v === undefined || v === null) ? '' : String(v).trim();
  const empty = t => t === '' || t === '0' || t === '00:00.00';
  const cell = txt(row[finalColIdx]);
  if (empty(cell)) {
    for (let idx = finalColIdx - 2; idx >= 7; idx -= 2) {
      const t = txt(row[idx]);
      if (!empty(t)) return 'the final time cell is empty, but a time (' + t + ') is in the ' + (((idx + 1 - 6) / 2) * 50) + ' column - probably entered in the wrong column';
    }
    return 'the final time cell is empty';
  }
  return 'the time cell shows "' + cell.slice(0, 20) + '" which cannot be read as a time';
}

// Pure Results-row -> swim mapper. Returns { skip: 'reason' } for a row that must not become a
// swim, otherwise { rawName, event, course, timeSec, date, rec, row }.
//   background - the cell background colour of the NAME cell (the DQ marker), e.g. '#ffff00'
//   sheetRow   - the row's 1-based number in the Sheet (fallback ordering/label when there is no
//                record number)
// A row with no usable Date value is NOT skipped: it comes back with date '' (see addResultEntry).
function parseResultRow(row, background, ss, sheetRow) {
  if (DQ_HEX_COLORS.includes(String(background || '').toLowerCase())) return { skip: 'dq' };

  const rawName  = String(row[RESULT_COL_NAME]  || '').trim();
  const rawEvent = String(row[RESULT_COL_EVENT] || '').trim();
  if (!rawName || !rawEvent) return { skip: 'blank' };

  const event = EVENT_MAP[rawEvent];
  if (!event) return { skip: 'event', detail: rawEvent };

  const rawCourse = String(row[RESULT_COL_COURSE] || '').trim();
  const course = rawCourse === 'SC' ? 'S' : rawCourse === 'LC' ? 'L' : null;
  if (!course) return { skip: 'course', detail: rawCourse };

  const finalColIdx = getFinalCumColIndex(event);
  if (finalColIdx < 0 || finalColIdx >= row.length) return { skip: 'columns' };

  // Force string conversion to protect parseTimeStr from primitive numbers; round to 2dp so
  // "same time" comparisons are exact.
  const timeSec = Math.round(parseTimeStr(String(row[finalColIdx] || '')) * 100) / 100;
  if (!timeSec || timeSec <= 0) return { skip: 'time', detail: describeTimeProblem(row, finalColIdx) };

  return {
    rawName, event, course, timeSec,
    date: fmtDate(row[RESULT_COL_DATE], ss),
    rec: parseRecNo(row[RESULT_COL_RECORD]),
    row: sheetRow,
  };
}

// Adds one swim to a swimmer's pbs map (keyed so that duplicates collapse). Returns what happened:
// 'added' | 'duplicate' | 'undated-replaced' | 'undated-kept'.
//   Dated swim: key = event|course|date|time. Same-day swims with different times are separate
//     entries (heat + final); the same time twice on one day is the same swim entered twice.
//   Undated swim: key = event|course. Only the fastest is kept (no date to tell swims apart).
function addResultEntry(swimmer, e) {
  const dated = !!e.date;
  const key = dated ? `${e.event}|${e.course}|${e.date}|${e.timeSec.toFixed(2)}` : `${e.event}|${e.course}|`;
  const entry = { event: e.event, course: e.course, sec: e.timeSec, time: secsToTimeStr(e.timeSec), date: e.date, rec: e.rec, row: e.row };
  const existing = swimmer.pbs[key];
  if (!existing) { swimmer.pbs[key] = entry; return 'added'; }
  if (!dated) {
    if (e.timeSec < existing.sec) { swimmer.pbs[key] = entry; return 'undated-replaced'; }
    return 'undated-kept';
  }
  return 'duplicate'; // keeps the earlier record
}

// Chronological order; within a day by record number (or Sheet row when there is none).
function compareEntries(a, b) {
  const da = a.date || '', db = b.date || '';
  if (da !== db) return da < db ? -1 : 1;
  const oa = a.rec != null ? a.rec : (a.row || 0), ob = b.rec != null ? b.rec : (b.row || 0);
  return oa - ob;
}

function isoFromDate(d) {
  const p = n => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

// Recent swims that are implausibly fast against the swimmer's own previous best for the same
// event+course (chronological, so a swimmer's first swim is never flagged). Newest first, capped.
function computeWarnings(swimmerMap, today) {
  const cutoff = new Date(today.getTime());
  cutoff.setDate(cutoff.getDate() - PLAUSIBILITY_RECENT_DAYS);
  const cutoffIso = isoFromDate(cutoff);
  const out = [];
  Object.values(swimmerMap).forEach(sw => {
    const groups = {};
    Object.values(sw.pbs).forEach(p => {
      if (!p.date) return;
      const k = p.event + '|' + p.course;
      (groups[k] = groups[k] || []).push(p);
    });
    Object.values(groups).forEach(list => {
      list.sort(compareEntries);
      // Day by day. Every swim on a day is compared with the established best from BEFORE that day,
      // so a heat and a final that are both implausibly fast are both flagged. A flagged swim never
      // becomes the baseline (otherwise a second fast swim looks normal next to the first); swims
      // older than the window always do, so a genuine step improvement long ago is not re-flagged.
      let best = Infinity, bestDate = '', i = 0;
      while (i < list.length) {
        const date = list[i].date, day = [];
        while (i < list.length && list[i].date === date) day.push(list[i++]);
        const recent = date >= cutoffIso;
        const flagged = [];
        day.forEach(p => {
          if (recent && isFinite(best) && p.sec < best * (1 - PLAUSIBILITY_DROP)) {
            flagged.push(p);
            out.push({ name: sw.name, event: p.event, course: p.course, date: p.date, time: p.time,
                       previousBest: secsToTimeStr(best), previousBestDate: bestDate,
                       rec: p.rec != null ? p.rec : null, row: p.row != null ? p.row : null });
          }
        });
        day.forEach(p => { if (flagged.indexOf(p) === -1 && p.sec < best) { best = p.sec; bestDate = p.date; } });
      }
    });
  });
  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return out.slice(0, MAX_WARNINGS);
}

function buildPayload() {
  // getActiveSpreadsheet() works because the script is bound to the Sheet.
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  _tzCache = null;

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
  const t0 = new Date().getTime();
  const stats = { rows: 0, ms: 0, msRead: 0, msValues: 0, msBg: 0, msParse: 0, rowsRead: 0, lastCol: 0, skippedTotal: 0, skippedRows: [], dq: 0, blank: 0, event: 0, course: 0, columns: 0, time: 0, unknownSwimmer: 0, duplicates: 0, undated: 0 };
  const resultsSheet = ss.getSheetByName(TAB_RESULTS);
  const lastRow      = resultsSheet.getLastRow();
  const lastCol      = resultsSheet.getLastColumn();
  stats.lastCol      = lastCol;
  const dataRows     = lastRow - DATA_START_ROW;

  if (dataRows < 1) return buildOutput(swimmerMap, stats, []);

  // Read only the rows that hold swims. The Sheet's "last row" can be far below the real data
  // (formatted or formula rows: 3,174 of 3,999 rows were blank in the coach's Sheet) and reading
  // every cell of every row, plus every cell's background colour, was the slow part (~13 s).
  // So: scan ONE column (the event) to find the last real row, then read just that block, and
  // read the background of just the name column (the only place DQ yellow is looked at).
  const dataStart = DATA_START_ROW + 1;
  const t1 = new Date().getTime();
  let values = [], pos = 0, lastIdx = -1, blankChunks = 0;
  while (pos < dataRows && blankChunks < MAX_BLANK_CHUNKS) {
    const rows  = Math.min(CHUNK_ROWS, dataRows - pos);
    const block = resultsSheet.getRange(dataStart + pos, 1, rows, lastCol).getValues();
    let any = false;
    for (let i = 0; i < block.length; i++) {
      values.push(block[i]);
      if (String(block[i][RESULT_COL_EVENT] || '').trim() !== '') { lastIdx = pos + i; any = true; }
    }
    blankChunks = any ? 0 : blankChunks + 1;
    pos += rows;
  }
  stats.rowsRead = values.length;
  stats.msValues = new Date().getTime() - t1;
  if (lastIdx < 0) return buildOutput(swimmerMap, stats, []);
  const n = lastIdx + 1;
  values = values.slice(0, n);
  const t2 = new Date().getTime();
  const nameBgs = resultsSheet.getRange(dataStart, RESULT_COL_NAME + 1, n, 1).getBackgrounds();
  stats.msBg = new Date().getTime() - t2;
  stats.rows = n;
  stats.msRead = new Date().getTime() - t0;

  for (let r = 0; r < values.length; r++) {
    const p = parseResultRow(values[r], nameBgs[r][0], ss, dataStart + r);
    if (p.skip) {
      stats[p.skip] = (stats[p.skip] || 0) + 1;
      // A row with a swimmer and event that is skipped for an unknown event/course or an unreadable
      // time may be a real swim lost to a typo: list the first few so it is not silent.
      if (p.skip === 'event' || p.skip === 'course' || p.skip === 'time' || p.skip === 'columns') {
        stats.skippedTotal++;
        if (stats.skippedRows.length < 20) {
          stats.skippedRows.push({ row: dataStart + r, rec: parseRecNo(values[r][RESULT_COL_RECORD]), reason: p.skip,
                                   name: String(values[r][RESULT_COL_NAME] || '').slice(0, 40), detail: String(p.detail || '').slice(0, 160) });
        }
      }
      continue;
    }

    const swimmer = swimmerMap[p.rawName];
    if (!swimmer) { stats.unknownSwimmer++; continue; }

    if (!p.date) stats.undated++;
    if (addResultEntry(swimmer, p) === 'duplicate') stats.duplicates++;
  }
  stats.ms = new Date().getTime() - t0;
  stats.msParse = stats.ms - stats.msRead;

  return buildOutput(swimmerMap, stats, computeWarnings(swimmerMap, new Date()));
}

function buildOutput(swimmerMap, stats, warnings) {
  const swimmers = Object.values(swimmerMap).map(sw => {
    const pbsArray = Object.values(sw.pbs).sort(compareEntries).map(p => ({ event: p.event, course: p.course, time: p.time, date: p.date }));

    const out = { id: sw.id, name: sw.name, dob: sw.dob, gender: sw.gender, source: sw.source, pbs: pbsArray };
    if (sw.squad) out.squad = sw.squad;
    if (sw.se) out.se = sw.se;
    return out;
  });

  return { version: '2.4', build: SCRIPT_BUILD, generated: new Date().toISOString(), count: swimmers.length, swimmers, warnings: warnings || [], stats: stats || {} };
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
  Logger.log('Script build: ' + payload.build);
  const st = payload.stats;
  Logger.log('Time: total ' + st.ms + ' ms = reading the Sheet ' + st.msRead + ' ms (values ' + st.msValues + ' for ' + st.rowsRead + ' rows, colours ' + st.msBg + ' for ' + st.rows + ' rows) + processing ' + st.msParse + ' ms. Sheet is ' + st.lastCol + ' columns wide.');
  Logger.log('Stats: ' + JSON.stringify(Object.assign({}, st, { skippedRows: undefined })));
  if (st.skippedRows && st.skippedRows.length) {
    Logger.log('Rows skipped that may be real swims (check the event / time / course cell):');
    st.skippedRows.forEach(x => Logger.log('  Record ' + (x.rec !== null ? x.rec : '?') + ' (Sheet row ' + x.row + '): ' + x.reason + ' - ' + x.name + ' - ' + x.detail));
  }
  Logger.log('Warnings: ' + payload.warnings.length);
  let total = 0; payload.swimmers.forEach(s => { total += s.pbs.length; });
  Logger.log('Total swim entries: ' + total + ' (payload ~' + Math.round(JSON.stringify(payload).length / 1024) + ' KB)');
  if (payload.swimmers.length > 0) {
    const s = payload.swimmers[0];
    Logger.log('First swimmer: ' + s.name + ' | ' + s.gender + ' | ' + s.dob + ' | SE#: ' + (s.se || '(none)'));
    Logger.log('PBs (first 3): ' + JSON.stringify(s.pbs.slice(0, 3)));
  }
}

// ── Set token helper — run once to store the token securely ──
// Guarded against accidental re-runs: refuses to overwrite an existing token unless called
// explicitly as setToken(true).
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

// Constant-time-ish string comparison for the token check in doGet() (v2.2.2).
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
