# Decisions and assumptions

Answers to the three open questions in the original brief, plus the judgement
calls made along the way.

---

## 1. Is SQLite + a thin Python server the right call?

**No — and the brief overtook itself here.** The title says localhost, but the
Context and Non-negotiable sections say cloud-hosted Postgres on Vercel with a
public demo for recruiters. Those cannot both be true. I built the cloud
version, because a portfolio piece nobody can click is not a portfolio piece.

That decision forces the rest. Python plus `openpyxl` on Vercel means cold
starts measured in seconds on a platform whose Python support is a second-class
citizen, against a hard requirement that feedback land inside 300ms. TypeScript
end to end removes the boundary entirely: the same category definitions,
gamification constants, and date helpers are imported by both the server routes
and the React components, so the XP curve cannot drift between them.

For a genuinely single-user localhost app, SQLite would have been the better
answer — one file, no daemon, trivial backup. It stopped being the right answer
the moment "recruiters can try it" entered the requirements.

**Export uses ExcelJS, not `openpyxl`.** Beyond the language change, the
JavaScript package the brief's approach maps onto (`xlsx` on npm) currently ships
unpatched prototype-pollution and ReDoS advisories with no fix available.
ExcelJS is maintained and does everything asked: one sheet per month, a Summary
sheet, frozen headers, currency formatting, autofit widths.

---

## 2. Should recurring bills auto-log, or require a tap?

**Always require the tap.** Auto-logging trades a real risk for a trivial saving.

The failure modes are asymmetric. A bill that auto-logs at the wrong amount
silently corrupts your budget maths, and you find out weeks later when the
numbers stop matching your bank. A bill that waits for you costs one tap. The
brief itself says the amount "is usually the same each month" — *usually* is
exactly the word that makes automation dangerous. Electricity swings with the
weather; a rent increase would post the old figure forever.

There is a second reason. The streak rewards *engagement*, and a bill that logs
itself while you sleep would inflate that streak without you opening the app.
The number would stop meaning anything.

So recurring bills are one-tap templates: last month's amount is pre-filled and
editable, and every template updates its remembered amount after each log. The
tap stays.

---

## 3. Why would this get abandoned in week three, and what prevents it?

**The most likely cause: a gap you cannot repair.**

Week one is easy — the app is new and the streak is exciting. Week three is
where it breaks. You miss a Tuesday. The streak reads 0. Every screen that
previously said "14 days" now says nothing, and the app has quietly become a
record of your failure. That is the moment people stop opening an app, and no
amount of encouraging copy fixes it, because the damage is structural rather
than tonal.

**The feature that prevents it is the streak freeze**, and it is why the brief
asks for one. One missed day per calendar month is absorbed automatically, with
no penance and no prompt. A 40-day run survives an early night.

Two supporting pieces matter as much:

- **"No spending today" is a first-class button** worth full XP. Without it, the
  cheapest possible day — the one where you spend nothing — is also the day you
  break your streak. That is precisely backwards.
- **XP is never deductible.** Nothing in the system can take points away. An
  expensive week costs you nothing but an honest number, so there is never a
  reason to hide a purchase or, worse, to stop logging entirely.

If I could keep only one of the three, it would still be the freeze. The other
two prevent bad incentives; the freeze prevents the specific moment of despair
that ends the habit.

---

## Assumptions made without asking

- **Currency and locale.** The brief left these bracketed. I used **MYR** and
  **Asia/Kuala_Lumpur**, since its own example copy refers to "a few cents or
  ringgit". Both are editable, and the timezone genuinely matters: it decides
  when your day rolls over for streak purposes.
- **Demo isolation.** One shared demo account rather than per-visitor sandboxes,
  as chosen during the build. Since visitors leave junk behind, a nightly cron
  reseeds it.
- **Edit does not touch XP.** Correcting a typo is not new activity, so it
  neither grants nor claws back points. Undo is the path that rolls state back;
  edit only changes the number.
- **Backdated entries credit the streak to today.** If you log Monday's coffee
  on Wednesday, Wednesday is the day you showed up. Otherwise backfilling a week
  would manufacture a streak you never earned.
- **A month counts as "fully logged" only once it has ended.** The badge
  evaluates the previous month, since the current one cannot qualify yet.
- **No service worker or offline queue.** The brief asks the app to *feel* local
  via optimistic UI, which it does. True offline support needs a sync-conflict
  story that the single-user case does not justify.
