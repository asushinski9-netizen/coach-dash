# Coach Dashboard - cumulative test script, v2.12.8 through v2.12.11

One script covering everything added since v2.12.8, using the names and wording of v2.12.11. Tick each box. If something does not match "Expected", stop and tell me the step number and what you saw (screenshots help, and please include any totals shown).

**Layout steps (Part 5) cannot be checked by my automated tests - they have no real screen - so those are the ones where your eyes matter most.**

---

## Part 0 - Before you start
- [ ] **0.1** Tab title says **Coach Dashboard v2.12.11**.
- [ ] **0.2** The Apps Script is still build **2.2.4-b5** (a sync message shows "Apps Script 2.2.4-b5, history check on"). No script change since then.
- [ ] **0.3** Download a fresh backup: Manage Data > Full Backup & Restore > Download Full Backup. Several steps below remove or merge results on purpose, so test on this data only if you have the backup.
- [ ] **0.4** Have your SE Top Times file(s) ready and note a swimmer for each case below (names in brackets are the examples from your data; use any swimmer with the same pattern).

---

## Part 1 - Results count and "nothing is lost" (v2.12.8)
- [ ] **1.1 Count in the sync message.** Sync from Google Sheet.
  **Expected:** the message includes "Swimming results on file: N -> M (+X)" (or "no change").
- [ ] **1.2 Count in Manage Data.** Open Manage Data.
  **Expected:** the swimmer line reads e.g. "74 swimmers loaded - 1165 swimming results".
- [ ] **1.3 Import never loses a result.** Start an SE import, choose **Replace for all** under Probable duplicates, Apply.
  **Expected:** the summary has a "Swimming results on file: before -> after" line that balances (before + new results added = after), and no red warning.
- [ ] **1.4 Re-review shows nothing left to do.** Re-open the import with the same file(s).
  **Expected:** no probable duplicate for a swim that is already on file exactly (Leila's 34.80 case and Nicole's repeat flag are gone); Apply is greyed out with "Nothing to import".
- [ ] **1.5 Possible duplicates note.** In the review, open the grey "swimming result time(s) on file appear on more than one date - possible duplicates" box.
  **Expected:** swimmers with the same time on two dates (Nicole 43.50) are listed. Nothing is ever deleted by this list.

## Part 2 - "Use SE report" is remembered; "Keep both" (v2.12.8)
- [ ] **2.1** Pick a swimmer where the Sheet and SE have the same event on the same date with different times (a Time conflict). Choose **Use SE report**, Apply.
  **Expected:** that swim now shows the SE time.
- [ ] **2.2** Sync from the Google Sheet again.
  **Expected:** the old Sheet time does NOT come back; the sync message includes "N Google Sheet swim(s) you earlier replaced with the SE time were not re-added"; the results total does not grow; no extra swimmer shows as "updated" because of this.
- [ ] **2.3 Keep both.** On a conflict that is genuinely a heat and a final, choose **Keep both (heat and final)**, Apply.
  **Expected:** both swims are on file (results +1). A later sync changes nothing.
- [ ] **2.4 Edit Swimmer keeps it.** Edit the swimmer from 2.1 (change Squad only), Save, sync again.
  **Expected:** the replaced time still does not come back.

## Part 3 - Several same-time entries on file: Nicole-type (v2.12.9)
Use a swimmer with the same time on two dates plus an SE swim with that time on a third date (Nicole, 50 Free SC 43.50).
- [ ] **3.1 Choices.** In Probable duplicates the row lists both on-file dates and offers: Skip / Replace the first date entry / Replace the second date entry / Merge all 2 into the SE swim / Import separately. Default is Skip.
- [ ] **3.2 Replace one.** Choose the first Replace option. Bottom note says it will update 1 record. Apply.
  **Expected:** only that entry changes; the other stays.
- [ ] **3.3 Merge (on a restored copy, or a different swimmer).** Choose **Merge all 2 into the SE swim**.
  **Expected:** the bottom note says "...and remove 1 duplicate on-file result(s) with the same time"; Apply; summary says "1 extra on-file result(s) ... merged"; the results line drops by exactly 1 with no red warning.
- [ ] **3.4 Sync does not undo the merge.** Sync from the Google Sheet.
  **Expected:** the merged rows do not return.

## Part 4 - Amy-type conflict: outcomes, names, and the fourth choice (v2.12.10)
Use a swimmer with the same time on two dates (3:13.52 on 29 Nov 2025 and 5 Jul 2026) and an SE swim with a different (faster) time on one of those dates (3:11.36 on 5 Jul 2026).
- [ ] **4.1 Button names match option names.** Time conflicts buttons read **Keep existing for all / Use SE report for all / Keep both for all**; Probable duplicates buttons read **Skip for all / Replace for all / Import separately for all**.
  **Expected:** each button matches the choice it applies; there is no "Keep all" or "Replace all" button.
- [ ] **4.2 Each option says what it does.** Amy's row reads (with her times):
  - Keep existing - keep 3:13.52 on 5 Jul 2026, don't import 3:11.36
  - Use SE report - replace 3:13.52 with 3:11.36 (the 29 Nov 2025 entry stays)
  - Keep both (heat and final) - keep 3:13.52 and also add 3:11.36
  - Use SE report and remove the other 3:13.52 (29 Nov 2025) - replace ... and delete the other copy
- [ ] **4.3 Fourth choice only where it applies.** A conflict row with no repeated time shows only three options. There is no bulk button for the removing option.
- [ ] **4.4 Apply the fourth choice (restored copy).** Bottom note says "remove 1 repeated on-file result(s)". Apply.
  **Expected:** Amy has ONE 200 Free SC swim, 3:11.36; summary lists "1 repeated on-file result(s) removed"; results line drops by exactly 1, no red warning.
- [ ] **4.5 Sync does not undo it.** Sync from the Google Sheet.
  **Expected:** neither 3:13.52 row returns; totals do not grow.
- [ ] **4.6 Plain Use SE report keeps the other copy** (restored copy): Amy keeps 3:13.52 on 29 Nov 2025 and gets 3:11.36 on 5 Jul 2026.

## Part 5 - Review screen layout and notes (v2.12.11) - please check on a REAL screen
Do these on desktop AND on a phone (or a window narrowed to under 500px).
- [ ] **5.1 Name on its own row.** In both Time conflicts and Probable duplicates, each swimmer's name is on the first line of its box, full width, and never squeezed beside the buttons. Try a swimmer with a long name.
- [ ] **5.2 Buttons never wrap their text.** The three bulk buttons sit on the line below the name. On a narrow screen the buttons may move to a second line as a whole, but "Use SE report for all" etc. must each stay on ONE line inside its button.
- [ ] **5.3 Time conflicts explainer.** Under the "Time conflicts" heading there is an explainer ("A time conflict means ... Nothing is changed until you click Apply").
- [ ] **5.4 Note for every difference (orange).** On each conflict row there is an orange note when the SE time differs from the best on file:
  - SE faster (Amy): "The SE time is 2.16s faster than the best on file (3:13.52), so Keep existing leaves your best at 3:13.52."
  - SE slower (Jager, 30.37 vs 30.75): "The SE time is 0.38s slower than the best on file (30.37). Using the SE report would make your best time on file slower."
- [ ] **5.5 Repeated time on a conflict row.** Amy's row also has an orange line "The on-file time 3:13.52 is also on file on 29 Nov 2025."
- [ ] **5.6 Nicola-type duplicate.** A duplicate row with two same-time entries has an orange note: "2 entries on file have this time (dates) and the SE report has it on (date) - most likely the same swim recorded more than once. 'Merge' keeps just the SE one." A single-entry duplicate row has no such note.

## Part 6 - Final sanity (nothing else broke)
- [ ] **6.1** Overview, County QT and Regional QT tabs load as before.
- [ ] **6.2** Add a swimmer and a PB the normal way; Edit Swimmer saves.
- [ ] **6.3** Download a Full Backup; it downloads normally.
- [ ] **6.4** Overall: every "Swimming results on file" line you saw added up. Tell me any that did not, with the numbers.

## Known limits to remember
- The SE report only lists each swimmer's current best, so imports build history gradually.
- "Merge" and "remove the other copy" are the only choices that delete results, they are never the default, and they have no bulk button.
- UI wording in the SE review still says "PB result(s)" in places; a sweep to "swimming results" is planned for v2.13.
