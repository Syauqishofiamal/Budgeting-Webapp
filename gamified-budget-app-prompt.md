# Prompt: Gamified Personal Budget Tracker (localhost)

> Paste everything below into a coding agent (Claude Code, Cursor, etc.).
> Fill in the three `[BRACKETED]` values first.

---

## Role

You are a senior full-stack engineer building a **single-user, offline, localhost-only** expense tracker. Optimize for two things above all else: **speed of logging an expense** (target: under 5 seconds, 3 taps) and **making the user want to come back tomorrow**. Everything else is secondary.

## Context
- Target Audience: Me (secure personal use) and Recruiters (interactive demo mode).
- Deployment: Cloud-hosted and continuously deployed from GitHub (e.g., Vercel or Render).
- Devices: Accessible from any web browser, but strictly optimized for mobile phone use (large tap targets, thumb-reachable controls).
- Currency: [MYR / USD / ...] | Locale: [e.g. Asia/Kuala_Lumpur].

## Non-negotiable constraints
1. **Cloud Persistence:** Use PostgreSQL (via Supabase or Neon). The agent must provide the database schema setup and environment variable instructions.
2. **Authentication & Demo Mode:** Implement a secure login for me. Crucially, include a "Try Demo" button on the login screen that logs visitors into a temporary, isolated session pre-filled with realistic sample data so they can test the UX without ruining my database.
3. **Deployability:** The project must be structured for immediate cloud deployment. Include any necessary build configurations (e.g., `package.json` scripts, `vercel.json`, or a `Dockerfile`) and a robust `README.md`.
4. **Frictionless UX:** Despite being cloud-hosted, the app must feel local. Use optimistic UI updates so logging an expense never waits for a server response.

## Data model

Table `expenses`:

| field | notes |
|---|---|
| `id` | primary key |
| `date` | defaults to today |
| `category` | one of the presets below, or `custom` |
| `custom_label` | free text, only when category is `custom` |
| `subtype` | optional; used by Food → `delivery` \| `cooked` |
| `amount` | decimal, 2 places |
| `note` | optional free text, always available |
| `created_at` | timestamp, for streak logic |

Preset categories: **Transport, Food, Groceries, Rent, WiFi, Water bill, Electric bill**, plus **Other/Custom**.

Also persist: user settings (monthly budget, currency), XP total, streak state, unlocked badges. Recurring bills (rent, wifi, water, electric) should be creatable as templates I can log with one tap, since the amount is usually the same each month — pre-fill last month's amount and let me edit it.

## Screens

**1. Home / Quick Add** (the default screen — this is 90% of usage)
- Date selector at top, **pre-set to today**, with one-tap "Yesterday" and a date picker for anything older.
- Category grid: large icon tiles, one tap to select. Food expands inline to Delivery / Cooked.
- "Other" tile opens a text field for a custom label.
- Numeric keypad for the amount, big digits, with a visible Save button. Optional note field, collapsed by default.
- **Remembered amounts.** Once a category is selected, show up to 3 chips of my most recent distinct amounts for that category, most recent first. Tapping a chip **loads the value into the keypad — it does not save.** I can then edit the trailing digits and hit Save myself. Never one-tap-commit an amount; a wrong saved number is worse than a saved keystroke.
  - Stable categories (Transport, Rent, WiFi, Water, Electric, Groceries) get the full chip row — these repeat almost exactly.
  - **Food → Delivery is the exception:** the total shifts by a few cents or ringgit every order (fees, promos, different items), so a remembered amount is a starting point at best. For Delivery, show a single chip labelled with the last amount and a `~` prefix to signal "edit me," and keep the keypad focused and ready for input. Do not show three chips there — it implies a precision that doesn't exist and invites me to save a stale number.
  - Food → Cooked behaves like a stable category.
- Save → instant feedback (below) → form resets to ready state for the next entry. Never make me navigate back.

**2. Today / This Month dashboard**
- Remaining budget shown as the main visual (see gamification).
- Today's entries as a list, each swipe-or-tap to edit/delete. Edit and delete must exist — I will fumble an amount.
- Simple category breakdown for the current month.

**3. History**
- Filter by month and category. Running totals. Nothing fancy.

**4. Export**
- One button → downloads `.xlsx`, one button → `.csv`.
- XLSX: columns `Date | Category | Subtype | Custom Label | Amount | Note`. One sheet per month, plus a `Summary` sheet with category totals per month. Freeze the header row, format the amount column as currency, autofit column widths. Use `openpyxl`.
- Export must reflect a live query of the DB, not a cached copy.

## Gamification system

Design it as **encouragement, never punishment.** Concretely:

- **XP for the act of logging**, not for spending little. +10 XP per entry, +25 bonus for logging every category-day complete. This is the core loop: I get rewarded for honesty, so I never have an incentive to hide a bad purchase.
- **Streak** = consecutive days I opened the app and logged *or* explicitly tapped "No spending today" (make that a first-class button). Show a flame/counter. Include **one streak freeze per month** that auto-applies to a missed day, so a single slip doesn't wipe a 40-day streak.
- **Levels** from cumulative XP, with a visible progress bar that animates on gain.
- **Budget as a resource bar**, not a debt counter. Show remaining budget filling/draining like an HP or fuel gauge. When I go over, the framing is "over by X — here's what next month looks like," never red-alert shaming.
- **Weekly quests**, 2–3 at a time, generated from my own data. Examples: "Log 5 days this week," "Cook 3 meals instead of ordering," "Keep transport under [X]." Completing one grants XP + a badge.
- **Badges** for milestones: first entry, 7-day streak, 30-day streak, first month fully logged, first month under budget, 100 entries.

**Anti-patterns — do not implement:** loss of XP for overspending, guilt-toned copy, aggressive red UI, notifications that nag, leaderboards, anything that punishes a missed day.

## Instant feedback

- Feedback must appear **under 300ms** of tapping Save — optimistic UI, don't wait for the server round-trip.
- A toast/card animates in showing: amount logged, XP gained, and a short positive line.
- **The toast carries an Undo button and stays up for ~5 seconds.** Undo removes the entry outright and rolls back any XP, streak, or badge state it triggered — as if it never happened. This is the primary correction path for a fat-fingered amount; the edit screen is the fallback for mistakes I notice later. Undo must not itself count as activity for streak purposes.
- **Vary the copy.** Write a pool of at least 20 messages and rotate without immediate repeats, so it doesn't feel robotic by day three. Tone: warm, brief, a little playful. Examples of the register I want: "Logged. That's 6 days running." / "Nice — tracked before you forgot." / "+10 XP. Your future self says thanks."
- Milestone moments (level up, badge unlock, streak multiple of 7) get a bigger celebration: confetti or a scale-in card, plus a distinct message. Keep it under 2 seconds and dismissible.
- Optional subtle haptic (`navigator.vibrate`) and an audio toggle, both off by default and easy to disable.
- Respect `prefers-reduced-motion`.

## Definition of done

Verify each of these before telling me you're finished:

1. Fresh clone → `pip install -r requirements.txt` → one command → app is reachable in a browser.
2. I can log a Transport expense in 3 taps with today's date, without typing anything except the amount.
3. I can log something that fits no preset category, with my own label and an amount.
4. I can edit and delete an entry.
5. Saving an entry then hitting Undo leaves the database, XP total, and streak exactly as they were before the save.
6. Selecting Transport shows my recent amounts as chips; tapping one fills the keypad without saving, and I can change the last two digits before saving. Selecting Food → Delivery shows a single `~` chip instead.
7. Killing the server and restarting preserves all data, XP, streak, and badges.
8. Export produces an `.xlsx` that opens cleanly in Excel/LibreOffice/Google Sheets with correct totals.
9. Streak increments correctly across a date boundary, and the freeze works for exactly one missed day per month.
10. Usable one-handed on a 390px-wide phone screen.
11. No network requests to any external domain at runtime.

## How to deliver

- **Before writing code**, list any assumptions you're making and ask me only the questions you genuinely can't decide yourself. Don't ask me things where a sensible default exists — pick the default and note it.
- Build in phases and stop for my confirmation after each:
  - **Phase 1** — data layer + quick-add + list view + edit/delete. Working end to end, ugly is fine.
  - **Phase 2** — export to CSV/XLSX.
  - **Phase 3** — XP, streaks, levels, badges, quests.
  - **Phase 4** — animation, feedback copy, visual polish.
- Give me the full file tree first, then the files. Keep every file under ~400 lines; split if longer.
- Comment the gamification math (XP curve, level thresholds, streak rules) so I can tune the numbers myself later.
- Include a short `README.md`: how to run, where the DB file lives, how to back it up, how to change the budget.

---

## Open questions to answer before Phase 1

Answer these in your own words; don't just accept my defaults if you think they're wrong:

1. Is SQLite + a thin Python server the right call here, or would a different setup meaningfully reduce friction for a single-user localhost app?
2. Should recurring bills auto-log on a schedule, or always require my tap to confirm?
3. What's the most likely reason I abandon this app in week three, and what one feature would prevent it?
