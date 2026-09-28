# Coach Dashboard v2.10 — User Test Script

A step-by-step manual checklist for a coach (no dev tools needed) to confirm everything shipped
this session actually works. This is separate from — and doesn't replace — the automated
`test_overview.js`/`probe_pbs_widening.js` checks, which verify the underlying code logic but
not what you actually see and click.

**What this session covers:** PBs can now hold more than one entry per event+course (real
history, not just "the current best"), and — most importantly for day-to-day use — **the bug
where manually-entered PBs got silently wiped out by an upload or sync is fixed.** Hot Right
Now now only shows genuine improvements, not every recorded swim.

**Nothing you do day-to-day changes.** Add/Edit Swimmer, uploads, and sync all work exactly as
before — this session is about the dashboard no longer *losing* data it shouldn't, and being
ready underneath for next session's official Swim England PB import. There's no new screen, no
new button, nothing to learn.

Tick each box as you go. If anything doesn't match the "Expected" column, stop and tell me
exactly which step failed and what you saw instead.

---

## Part 0 — Before you start

- [ ] **0.1** You're viewing the v2.10 `index.html` file (check the browser tab title says
      "Coach Dashboard v2.10", or the page `<title>` if you check "View Page Source").
- [ ] **0.2** This is a good moment to download a fresh backup first (📤 Manage Data → 🗄️ Full
      Backup & Restore → ⬇ Download Full Backup) before testing anything below, purely as a
      safety net — not because anything here is expected to go wrong.

---

## Part 1 — The main fix: manual PBs must survive an upload/sync

This is the most important thing to test this session — it's the actual bug you reported.

### 1.1 Set up a swimmer with two manual PBs for the same event
- [ ] Open **＋** → **👤 Add Swimmer**. Name it something you'll recognise later, e.g. "Test
      Manual Wipe".
- [ ] Add a PB: **50 Free**, Short Course, a slower time, an OLDER date (e.g. a few months
      back).
- [ ] Add a second PB for the SAME event: **50 Free**, Short Course, a faster time, a MORE
      RECENT date.
- [ ] Save.
- **Expected:** Both PBs save with no error or warning about "already exists."

### 1.2 Re-open and confirm both PBs are still there
- [ ] Click **✏️ Edit** on this swimmer.
- **Expected:** Both 50 Free entries are listed as separate rows, with their own dates and
      times — neither one silently replaced the other.

### 1.3 Upload a file with a faster PB for the same event, same swimmer — Merge
- [ ] Download your current swimmers file first (📤 Manage Data → 🏊 Swimmers & PBs → ⬇
      Download) so you have something to edit.
- [ ] Open that downloaded JSON file in a text editor. Find your test swimmer's entry. Add
      (don't replace) one more 50 Free PB with an even faster time and a brand-new date (not
      matching either of the two you entered manually).
- [ ] Save the file, then in the dashboard: 📤 Manage Data → 🏊 Swimmers & PBs → Upload that
      edited file.
- [ ] When prompted, choose **Merge** (not Replace).
- **Expected:** No error. The success message doesn't need to say anything special about this.
- [ ] Now re-open **✏️ Edit** on your test swimmer.
- **Expected — this is the actual fix:** All THREE 50 Free entries are present — your two
      original manual ones, plus the uploaded one. **None of them should have disappeared.**
      Before this session, the two manual entries would have been silently wiped down to just
      the uploaded one.

### 1.4 Confirm the County/Regional tabs still show the right "current" PB
- [ ] Go to the County (or Regional) QT tab and find your test swimmer's 50 Free row.
- **Expected:** The PB Time shown is the **fastest** of the three times you entered — the
      dashboard always compares against your swimmer's best time, regardless of how many
      historical times are now on file. Nothing about how County/Regional looks or works has
      changed.

### 1.5 Clean up
- [ ] Delete the test swimmer (🗑️ on their card) once you're happy with the above.

---

## Part 2 — Hot Right Now now shows improvements, not every swim

### 2.1 Set up a swimmer with a non-improving swim in the middle
- [ ] Add a test swimmer with three 50 Free PBs, all dated within the last month, in this
      order: a faster time, then a SLOWER time, then an even faster time again. (E.g.
      30.00 → 31.00 → 29.00, three different recent dates.)
- [ ] Save.

### 2.2 Check the Overview tab's "Hot Right Now" section
- [ ] Go to the 🌅 Overview tab. Find your test swimmer's card under "🔥 Hot Right Now."
- [ ] If there's a "▾ +N more" link, click it to see every entry for this swimmer.
- **Expected:** Only the two genuinely FASTER swims show up (30.00 and 29.00 in the example
      above) — the slower 31.00 swim in the middle should **not** appear at all, since it
      wasn't actually a personal best at the time it happened.

### 2.3 Clean up
- [ ] Delete the test swimmer.

---

## Part 3 — General sanity check (nothing else broke)

- [ ] Add a swimmer with a single PB the normal way — saves and shows on County/Regional as
      before.
- [ ] Edit an EXISTING swimmer and change only their Squad (don't touch any PB row) — save,
      then re-open Edit. Their PBs should look completely untouched.
- [ ] Sync from Google Sheets normally — completes with the usual success message, no new or
      different warnings.
- [ ] Download a full Backup & Restore bundle (📤 Manage Data → 🗄️ Full Backup & Restore) —
      downloads fine, same as always.
- [ ] Overview tab still loads (Squad Composition, Hot Right Now, The Bubble List) with no
      layout weirdness.

---

## A note on something you might notice, but isn't a problem

If you look closely at a downloaded `swimmers_pb.json` file, you may notice some PB entries
now have a new `"source"` field (`"gala"`, `"se"`, or `"manual"`) and older entries may have
none at all. This is expected — it's groundwork for next session's official Swim England PB
import, not something you need to do anything about. It doesn't change how any PB is displayed
or compared anywhere in the dashboard today.
