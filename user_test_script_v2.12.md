# Coach Dashboard v2.12 — User Test Script (Stage 1: every swim, heats and finals)

**What this stage changes:** Google Sheets sync now brings in **every** swim from the Results tab,
not just each swimmer's fastest per event. A heat and a final on the same day are kept as two swims.
The sync also warns you about recent swims that look far too fast (usually a typo). Nothing else
about how the dashboard looks or works has changed.

**Two files change:** `index.html` (v2.12) and the Google Apps Script (`apps_script_v2.2.4.gs`).
The dashboard works with the OLD script too, so do Part 1 first, and only then redeploy the script.

If any step doesn't match "Expected", stop and tell me the step number and what you saw.

---

## Part 0 — Before you start
- [ ] **0.1** Download a fresh backup: 📤 Manage Data → 🗄️ Full Backup & Restore → ⬇ Download Full Backup.
- [ ] **0.2** Check the browser tab says "Coach Dashboard v2.12" (if it still says v2.11, tell me).

## Part 1 — New dashboard, OLD script (nothing should change yet)
- [ ] **1.1** 📤 Manage Data → 🔄 Sync from Google Sheet → Sync Now.
- **Expected:** the usual success message, no new warning about "unusually fast" swims, and the
  numbers (swimmers, PBs) look the same as before.
- [ ] **1.2** Open the County tab and look at three swimmers you know well.
- **Expected:** their PB times and statuses are exactly as before.

## Part 2 — Redeploy the Apps Script
- [ ] **2.1** Open the Apps Script project attached to your club Sheet (Extensions → Apps Script).
- [ ] **2.2** Replace the code with the contents of `apps_script_v2.2.4.gs`. Do **not** touch
  Project Settings: your `ACCESS_TOKEN` stays as it is.
- [ ] **2.3** **Deploy → Manage deployments → ✏️ (pencil) on your existing deployment → Version: "New
  version" → Deploy.** *Do not choose "New deployment"* — that gives a new URL and silently breaks sync.
- [ ] **2.4** In the editor choose the function `testRun` and click Run, then open the Execution log.
- **Expected:** lines for Swimmers found, Stats, Warnings, and "Total swim entries … (payload ~N KB)".
  **Please send me these lines** — they tell me how big your real payload is (I expect well under 1–2 MB).
- [ ] **2.5** Check the URL in the dashboard's ⚙️ Settings still matches Deploy → Manage deployments.

## Part 3 — Sync with the new script
- [ ] **3.1** Sync from Google Sheet.
- **Expected:** success. Swimmers will now typically have **more PB entries** than before (full
  history). A yellow "unusually fast" note may appear; see Part 5.
- [ ] **3.2** Open the County tab and re-check the same three swimmers from 1.2.
- **Expected:** their PB Time is still the same **fastest** time as before. History does not change
  what the County/Regional tabs show.
- [ ] **3.3** Sync again straight away.
- **Expected:** "… unchanged" for everyone, "0 updated". A second sync must change nothing.

## Part 4 — Heats and finals
- [ ] **4.1** Find a swimmer who swam the same event twice on the same day (a heat and a final) — or,
  in the Sheet, add two rows for one swimmer, same event, course and date, different times (e.g.
  1:25.10 then 1:23.90). Sync.
- [ ] **4.2** ✏️ Edit that swimmer.
- **Expected:** **both** swims are listed as separate PB rows (same date, different times).
- [ ] **4.3** County/Regional tab, that event.
- **Expected:** the PB shown is the faster of the two.
- [ ] **4.4** Overview → Hot Right Now (widen the days if needed).
- **Expected:** that swimmer shows **one** entry for that event/day (the faster swim), not two.
- [ ] **4.5** In the Sheet, copy one of those rows so the same swim appears twice (same time). Sync.
- **Expected:** still only two entries in ✏️ Edit — an exact duplicate row is not added twice.

## Part 5 — The "looks too fast" warning
*(Use a test row you'll delete afterwards.)*
- [ ] **5.1** In the Sheet add a swim for any swimmer, dated within the last 2 months, for an event
  they've swum before, with a time **more than 15% faster** than their previous best (e.g. 20.00
  where they were 36.00). Sync.
- **Expected:** the sync message includes "⚠️ 1 recent swim … look unusually fast", naming the
  swimmer, the time, their previous best and the **record number** of that row (Results column A).
  The dialog stays open with a "Got it - Close" button. The swim *has* been synced.
- [ ] **5.2** Delete the test row in the Sheet, then ✏️ Edit the swimmer on the dashboard and delete
  the test PB row there. Sync again.
- **Expected:** no warning. *(Known limit: deleting or correcting a row in the Sheet does not remove
  the already-synced copy from the dashboard — that is why 5.2 deletes it by hand.)*
- [ ] **5.3** A normal fast improvement (about 5–10% quicker than before) should **not** warn.

## Part 6 — SE-confirmed swims
- [ ] **6.1** For a swimmer whose PBs came from an SE import (e.g. Arty), sync.
- **Expected:** their SE-imported PBs are unchanged. No scary warning unless the Sheet has a swim
  **faster** than the SE time on the same date (then you'll see the existing "SE-confirmed PB(s)
  differed" note — that is correct and means the Sheet row deserves a look).
- [ ] **6.2** A *slower* Sheet swim on the same date as an SE-confirmed one (e.g. a heat) gives **no**
  warning and is added as an extra swim. This is new behaviour.

## Part 7 — Nothing else broke
- [ ] Add Swimmer / Edit Swimmer still work; SE PB Report Import still opens and reviews a file.
- [ ] Full Backup downloads. Overview loads (Squad Composition, Hot Right Now, Bubble List).
- [ ] The dashboard feels as quick as before (if it feels slower, tell me roughly how many seconds).

---

## Things worth knowing
- **Correcting a mistyped time in the Sheet does not remove the old time from the dashboard** (it
  just stops being the PB if it was slower). Delete the stale row in ✏️ Edit Swimmer. This was
  already true before; it is just more visible now that history is kept.
- **Rows with no real date** (a text date, not a date cell) keep the old behaviour: only the fastest
  is kept, because without a date the swims can't be told apart. Check column E holds true dates.
- The record number (Results column A) is used only to keep a heat before its final and to label
  warnings. It is not saved on the swimmer.


---

# Round 2 re-test (after your first-round feedback)

What changed: the script reads far fewer blank rows (your `testRun` showed 3,174 of 3,999 rows were
blank, and building the payload took about 13 seconds); a sync that gets a 404, a 5xx or no answer
now retries up to 3 times and then tells you what to do; the "unusually fast" warning now flags
**both** a heat and a final that are far faster than the previous best; and a synced swim that has
been edited or deleted in the Sheet is now reported instead of silently left behind.

- [ ] **R1** Redeploy the script again: paste the new `apps_script_v2.2.4.gs`, then Deploy → Manage
  deployments → ✏️ → Version: **New version** → Deploy. Replace `index.html` with the new v2.12 file.
- [ ] **R2** Run `testRun` again. **Please send me the Stats line and the time between "Execution
  started" and "Swimmers found".**
- **Expected:** `rows` is now close to the number of real swims (about 825, not 3,999), a new `ms`
  figure appears, and it is clearly faster than the ~13 seconds you saw. (I can't measure Google's
  speed from here, so this is the check that matters.)
- [ ] **R3** Sync. **Expected:** it works. The first sync may list some swims as "no longer in the
  Google Sheet". That is expected: it will include the dates you edited during testing (4.0.1) and
  any test rows you removed. They are listed (first three, then "and N more"), kept, and never
  deleted for you. If the Sheet is right, delete them in ✏️ Edit Swimmer; the note then stops.
- [ ] **R4** Repeat your 4.0.1 test: edit one synced swim's date in the Sheet, then sync.
- **Expected:** both the old and the new-dated swim are on the dashboard (as before), and the sync
  message now names the old one and says where the Sheet has it now, e.g. "...on 4 Jul 2026 (the Sheet
  now has it on 11 Jul 2026)", with the dialog held open. Delete the old one in ✏️ Edit Swimmer, sync
  again, and the note is gone.
- [ ] **R5** Repeat your 4.5/5.1 test (a heat and a final both far faster than the swimmer's best,
  dated within the last two months).
- **Expected:** "2 recent swims ... look unusually fast", naming both, each against the previous best.
  Remember to delete the test rows afterwards (Sheet and ✏️ Edit Swimmer).
- [ ] **R6** If a sync fails again: the screen should show "trying again (attempt 2 of 3)", and if it
  still fails, a message saying what it probably is and to wait a minute and click Sync Now. **Please
  tell me how long it took to fail and whether a retry (or Sync Now again) then worked.**


---

# Round 3 re-test

What changed: the dashboard title now says **v2.12.2** and every sync message ends with which Apps
Script build answered and whether the "swim no longer in the Sheet" check ran, so a stale file or an
un-redeployed script is obvious at a glance. The "unusually fast" warning now flags **every** far-faster
swim (same day or different days) and its wording is clearer. The script asks Google for the Sheet's
timezone once instead of once per row, shows a timing split, and lists skipped rows that may be real swims.

- [ ] **S1** Replace `index.html` and paste the new `apps_script_v2.2.4.gs`; Deploy -> Manage
  deployments -> pencil -> Version: **New version** -> Deploy. Open the dashboard with a hard refresh
  (Ctrl+Shift+R / Cmd+Shift+R). **Expected:** the tab title says **v2.12.2**. If it still says v2.12,
  your browser (or GitHub Pages) is serving the old file. Tell me, and do not continue until it
  changes: this alone could explain the round 2 "orphan" result.
- [ ] **S2** Run `testRun`. **Please send me:** the `Script build` line (should be `2.2.4-b3`), the
  `Time:` line (total, reading, processing), and the list under "Rows skipped that may be real swims"
  if there is one. Round 2 showed 3 rows skipped for an unrecognised event and 4 for an unreadable
  time: open those Sheet rows and tell me whether they are real swims with a typo (e.g. an event
  typed `100 FR`) or genuinely empty rows.
- [ ] **S3** Sync. **Read the end of the first line.** It must say `(Apps Script 2.2.4-b3, history
  check on)`. If it says `older script` or `history check off`, the web app is not running the new
  code: check Deploy -> Manage deployments shows your newest version, then tell me.
- [ ] **S4** Orphan test again: in the Sheet change the date of one already-synced swim, then sync.
  **Expected:** the message names it, e.g. "...100 Free SC 1:10.92 on 5 Jul 2026 (the Sheet now has it
  on 6 Jul 2026)". If S3 looked right and there is still no note, tell me the swimmer, event, old and
  new dates, and paste the whole sync message.
- [ ] **S5** Warnings: in the Sheet add, within the last 2 months, for one swimmer and event they have
  swum before: (a) a heat and a final on the same day, both far faster than their best; (b) another far
  faster swim on a different day. **Expected:** "3 recent swims ... look unusually fast", all three
  named. Each reads like `Name 50 Free SC: new swim 25.00 on 1 Jul 2026 (record 5), previous best 36.00
  on 14 Mar 2026`. Delete the test rows afterwards (Sheet and Edit Swimmer).
- [ ] **S6** If a sync fails: note how long it took, what the message said, and whether a retry worked.

Good to know: a far-faster swim never becomes the "previous best" for the warning, so a swimmer who
genuinely drops a lot of time will keep being mentioned for up to 60 days (until those swims age
out of the window). Tell me if that is too noisy and I will add a way to acknowledge a warning.


---

# Round 4 re-test (dashboard v2.12.3, Apps Script build 2.2.4-b4)

What changed: (1) the Sheet is now read with a narrow block of columns (A..N) instead of all ~66, to cut
the 10.6 s read; (2) skipped Results rows are shown in the sync message **by record number**, in words
(e.g. "a time (02:44.03) is in the 150 column - probably entered in the wrong column", or a `#REF!`
cell); (3) if the Apps Script answering a sync is not the build this dashboard expects, the message says
so loudly and tells you how to redeploy.

**How to deploy the script so it takes effect:** paste the code, **press Save (Ctrl+S)**, run `testRun`
once, and only then Deploy -> Manage deployments -> the pencil on the deployment whose URL is in
Settings -> Version: New version -> Deploy.

- [ ] **T1** Replace `index.html` (tab title **v2.12.3**) and redeploy the script as above.
- [ ] **T2** Run `testRun`. **Please send me the `Script build` line (expect `2.2.4-b4`) and the `Time:` line.**
  It now shows scan / values / colours separately and the Sheet width, so we can see what is slow.
  Round 3 was 11.3 s total, 10.6 s of it reading.
- [ ] **T3** Sync. **Expected:** the first line ends `(Apps Script 2.2.4-b4, history check on).` with no
  "reports build / no build marker" warning.
- [ ] **T4** Skipped rows. In Data Entry, enter a race with the final time in the wrong column (e.g. a 200
  with its time in the 150 column and the 200 column blank). Sync. **Expected:** "1 row in the Results tab
  was skipped and may be real swims: record N (Name): the final time cell is empty, but a time (...) is in
  the 150 column - probably entered in the wrong column". Fix the row, sync again, the note is gone.
  Please do NOT delete rows in Data Entry to clean up (that leaves #REF! in Results); clear them.
- [ ] **T5** Speed: does the sync feel quicker than before? Roughly how many seconds from clicking Sync
  Now to the result?
- [ ] **T6** (optional) To see the loud warning, tell me if you are happy to deliberately redeploy an older
  version, otherwise skip. It is already covered by automated tests.


---

# Round 5 re-test (dashboard v2.12.4, Apps Script build 2.2.4-b5)

What changed: only how the script reads the Sheet. Your round 4 numbers (scan 3,997 rows 7.3 s, values
830 rows 1.4 s, colours 830 rows 1.5 s) show every read costs about **1.7 ms per ROW**, however many
columns. So reading columns A..N saved nothing (it is reverted: every column is read again, so no result
can be missed). The 7.3 s "scan" is gone: the script now reads forward in chunks of 250 rows and stops
after two completely blank chunks, so it reads about 1,500 rows instead of about 5,700. Estimate: the
sheet-reading part drops from about 10 s to about 4 s. That is an estimate from your timings, not a
measurement.

Redeploy: paste the code, **Save (Ctrl+S)**, run `testRun`, then Deploy -> Manage deployments -> pencil
-> New version -> Deploy.

- [ ] **U1** Replace `index.html` (title **v2.12.4**) and redeploy. Sync: the first line should end
  `(Apps Script 2.2.4-b5, history check on).` with no build warning.
- [ ] **U2** Run `testRun`. **Send me the `Time:` line.** It now reads, e.g. `values N ms for 1500 rows,
  colours N ms for 830 rows`. Expect roughly 4-6 s in total, down from 12.9 s.
- [ ] **U3** Check nothing is missing: the swimmer count and total swim entries in the log should match
  round 4 (plus anything you added since). Spot-check two or three swimmers on the County tab.
- [ ] **U4** Time a few syncs from click to result, and tell me the typical time and the slowest. The
  occasional 1+ minute sync is probably Google being slow rather than the script; the dashboard now
  retries and explains, but I cannot fix Google's side.

Known limit of the new read: if more than **500 consecutive blank rows** are ever left in the middle of
the Results tab (e.g. a whole season cleared), swims below that gap would not be read. Clearing a few
rows (as in your testing) is fine. Tell me if you ever archive by clearing large blocks.

Option if it is still too slow: the Sheets Advanced Service reads values and colours in one request and
is usually much faster, but it needs a one-off setting in the Apps Script project. I have not built it.


---

# Stage 2 test (dashboard v2.12.5; the Apps Script is unchanged, build 2.2.4-b5)

What changed: the Google Sheets sync now treats two names that differ only by spacing, capitals or accents
as the same swimmer (before, a stray double space made a swimmer look new and a duplicate was added); a sync
**stops, changing nothing,** if two swimmers look like the same person; the SE import now shows BOTH dates
of birth when they differ (and says if the day and month look swapped), and lists such swimmers in its
summary; the SE import's wording about the SE # is corrected. Take a backup first.

- [ ] **V1** ✏️ Edit a swimmer and put an extra space inside their name (e.g. "Bob  Baker"); Save. Sync
  (Keep). **Expected:** no duplicate swimmer appears, the swimmer count is unchanged, and the name is back
  to the Sheet's spelling.
- [ ] **V2** 👤 Add a swimmer with the same name as an existing swimmer (different capitals or an extra
  space is fine) and the **same date of birth**. Sync. **Expected:** a red message "Sync stopped - nothing
  was changed. These swimmers on the dashboard look like the same person ... Delete or correct one in Edit
  Swimmer". Check both swimmers and their PBs are untouched. Delete the extra one and sync again: it works.
- [ ] **V3** (needs your SE report) ✏️ Edit a swimmer who has an SE # and whose date of birth has a day of
  12 or less (e.g. 7 Jun 2011): change it to the swapped date (6 Jul 2011). Run **Import SE PB Report**
  with the SE file. **Expected:** that swimmer appears under Suggested matches (not auto-matched), with
  both dates in the reason, e.g. "(roster 6 Jul 2011, SE report 7 Jun 2011 - the day and month look
  swapped)". Tick it and apply: the summary has an amber box "Date of birth differs from the SE report"
  naming the swimmer and both dates, and the swimmer's date of birth on the dashboard is **not** changed.
  Then put the date of birth back (or just sync; the Sheet is authoritative).
- [ ] **V4** In the same review, read the line above the suggested matches. **Expected:** it says ticking
  never changes Name, Date of Birth or Gender, and that the SE # is filled in only if the dashboard has none.
- [ ] **V5** Normal paths still fine: a plain Sync, an SE import with auto-matched swimmers, Backup download.


---

# Duplicate-id fix test (dashboard v2.12.6)

What this fixes: after a sync that could not match a swimmer (e.g. their date of birth differed) two
records could end up sharing one id. Edit then showed the same record for both, and **Delete removed both**.
v2.12.6 repairs this when it loads and prevents it happening again. **Until you install v2.12.6, do not
Delete either of two look-alike swimmers.**

- [ ] **W1** Take a backup, then replace `index.html` (tab title **v2.12.6**). Open the duplicated swimmer's two
  records and click ✏️ on each. **Expected:** each opens on its **own** date of birth (before, both showed the
  Sheet's).
- [ ] **W2** Clean up the duplicate, in this order: Delete the record that came from the Sheet (the 📊 one,
  carrying the Sheet's DOB); then ✏️ the other record (the ✏️ one) and set its date of birth to the Sheet's;
  then Sync (Keep). **Expected:** one swimmer, with their SE-imported PBs and the Sheet's PBs.
  (The Sheet record's PBs come back with the sync; the SE-imported ones live on the other record.)
- [ ] **W3** Do something that leaves a message at the bottom of Manage Data (e.g. 🔄 Sync from GitHub on
  County QT), then open 🔄 Sync from Google Sheet, and later 📥 Import SE PB Report. **Expected:** the old
  message is gone each time.


---

# Corrected date of birth test (dashboard v2.12.7)

What changed: a swimmer whose date of birth differs only slightly between the dashboard and the Google Sheet
(one of day/month/year, or the day and month swapped) is now matched as the **same swimmer**: the Sheet's date
wins, their PBs are kept, and the sync tells you. Before, you got a duplicate. A bigger difference still makes
two records (it could be a different child) but now warns you. Take a backup first.

- [ ] **X1** Replace `index.html` (tab title **v2.12.7**).
- [ ] **X2** ✏️ Edit a swimmer and change their date of birth by one day (or swap the day and month if the
  day is 12 or less). Save. Sync (Keep). **Expected:** the swimmer count is unchanged and there is no
  duplicate; the message says "The date of birth differed from the Google Sheet's for 1 swimmer (Name:
  dashboard ..., Sheet ...) ... matched as the same swimmer, their PBs were kept, and the Sheet's date was used";
  the date of birth is back to the Sheet's; every PB (including SE-imported ones) is still there.
- [ ] **X3** Now the other direction: in the **Google Sheet** change a swimmer's date of birth by one day
  (restore it afterwards). Sync. **Expected:** the same note; still one swimmer; the dashboard now has the
  Sheet's new date. Restore the Sheet's date and sync again to put it back.
- [ ] **X4** Sync again straight away. **Expected:** no date-of-birth note (an ordinary match).
- [ ] **X5** (optional, makes a duplicate on purpose; use a swimmer you can delete) ✏️ Edit a swimmer and change
  the **year** by 3 or more. Sync. **Expected:** two records for that name, and the message warns that "N
  swimmer(s) on the dashboard are not in the Google Sheet but share a name with a Sheet swimmer who has a
  different date of birth ...". Clean up: Delete the 📊 record, then ✏️ the other and set its date of birth to
  the Sheet's.
- [ ] **X6** (optional) Set the sync dropdown to **Remove** and sync after X2's change. **Expected:** the
  confirmation (if it appears) does **not** list the swimmer whose date of birth was corrected.
