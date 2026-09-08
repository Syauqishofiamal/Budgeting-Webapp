# Coffer

A gamified personal expense tracker. Built for one thing: logging a purchase in
under five seconds, three taps, on a phone — and making you want to come back
tomorrow.

Next.js 16 · React 19 · PostgreSQL · TypeScript

---

## Quick start

```bash
npm install
cp .env.example .env.local     # then fill in the values (see below)
npm run db:setup               # creates the tables
npm run dev                    # http://localhost:3000
```

### Filling in `.env.local`

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Postgres connection string (Neon, Supabase, or local) |
| `AUTH_SECRET` | Signing key for session cookies, 32+ chars |
| `OWNER_USERNAME` | Your login name |
| `OWNER_PASSWORD_HASH` | bcrypt hash of your password |
| `DEFAULT_CURRENCY` | `MYR` |
| `DEFAULT_LOCALE` | `Asia/Kuala_Lumpur` — drives streak day boundaries |
| `DEFAULT_MONTHLY_BUDGET` | Starting budget, editable in the app |
| `CRON_SECRET` | Optional. Protects the demo-reset endpoint in production |

Generate the two secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node scripts/hash-password.mjs "your-password-here"
```

---

## Deploying to Vercel

1. Create a Postgres database at [Neon](https://neon.tech) or
   [Supabase](https://supabase.com) and copy the **pooled** connection string.
2. Push this repo to GitHub and import it into Vercel.
3. Add every variable from the table above to Vercel's environment settings.
   Add `CRON_SECRET` too — set it to any long random string.
4. Run the schema once against your cloud database:
   ```bash
   DATABASE_URL="your-cloud-url" node scripts/setup-db.mjs
   ```
5. Deploy. `vercel.json` registers a nightly cron that reseeds the demo account.

Every push to your default branch redeploys automatically.

---

## The demo account

The login screen has a **Try the demo** button. It signs visitors into a shared
`demo` account preloaded with about two months of realistic spending, a level-12
profile, a 12-day streak, and several unlocked badges — so the gamification is
visible immediately rather than empty.

Because the account is shared, visitors leave test data behind. A Vercel cron
hits `/api/cron/reset-demo` nightly, which wipes and reseeds it. You can also
trigger it manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/reset-demo
```

Your own account is a separate user row. Demo visitors cannot reach it.

---

## Tuning the game

All the numbers live in [`lib/gamification.ts`](lib/gamification.ts) and nothing
else hardcodes them. Change a constant and the whole app follows.

| Constant | Default | Meaning |
|---|---|---|
| `XP_PER_ENTRY` | 10 | Per logged expense |
| `XP_FIRST_ENTRY_OF_DAY` | 25 | Bonus for showing up that day |
| `XP_NO_SPEND_DAY` | 25 | A no-spend day is real tracking |
| `XP_QUEST_COMPLETE` | 50 | Weekly quest finished |
| `XP_BADGE_UNLOCK` | 40 | Per badge |
| `LEVEL_BASE` / `LEVEL_STEP` | 20 / 40 | Level curve shape |
| `STREAK_FREEZES_PER_MONTH` | 1 | Missed days forgiven per month |

The level curve is quadratic: total XP to reach level *L* is
`BASE·(L−1)² + STEP·(L−1)`. That puts level 2 at 60 XP and level 10 at 1860 —
early levels arrive in days, later ones take weeks.

Badges live in [`lib/badges.ts`](lib/badges.ts), quest definitions in
[`lib/quests.ts`](lib/quests.ts), and all the toast copy in
[`lib/copy.ts`](lib/copy.ts).

### Design rule behind the XP model

**XP is awarded for the act of logging, never for spending little.** If
overspending cost XP, the rational move would be to hide bad purchases — which
destroys the data the app exists to collect. Honesty always pays. There is no
mechanism anywhere that removes XP, and no red-alert framing when you go over
budget.

---

## Changing your budget

In the app: **More → Settings → Monthly budget**. It takes effect immediately
and applies to the current month.

## Backing up

Your data lives in Postgres, not on your phone.

```bash
# Full logical backup
pg_dump "$DATABASE_URL" > coffer-backup-$(date +%F).sql

# Restore
psql "$DATABASE_URL" < coffer-backup-2026-09-08.sql
```

Neon and Supabase both keep automatic point-in-time backups on their free tiers.
For a portable copy, use **More → Export** in the app: XLSX gives one sheet per
month plus a summary, CSV gives one flat table.

---

## How it's put together

```
app/
  api/
    auth/{login,demo,logout}   sign in, start a demo session, sign out
    expenses/                  create, list, and the amount-chip lookup
    expenses/[id]/             edit and delete
    undo/                      remove an entry and restore the prior state
    no-spend/                  mark a day as deliberately zero
    state/                     one call powering the whole dashboard
    history/                   month and category filtering
    export/{xlsx,csv}          live-query downloads
    settings/, recurring/      budget, toggles, bill templates
    cron/reset-demo            nightly demo reseed
  login/, page.tsx, layout.tsx, globals.css
components/
  AppShell    tab navigation, optimistic writes, toast and undo orchestration
  QuickAdd    the 90%-of-usage screen: date, categories, chips, keypad
  Keypad      amount entry held as a string so trailing decimals survive edits
  Dashboard   budget gauge, level, streak, quests, breakdown, badges
  History     month and category filters with running totals
  More        recurring bills, export, settings, sign out
  EntryList   today's entries with inline edit and delete
  Toast       5-second feedback carrying Undo
  Celebration confetti and card for level-ups, badges, and 7-day streaks
lib/
  gamification.ts  XP curve, level thresholds, streak and freeze rules
  actions.ts       the write path: log, no-spend, and exact-rollback undo
  db.ts            queries, plus a Neon/node-postgres driver shim
  dates.ts         timezone-correct day boundaries
  quests.ts        weekly quests generated from your own data
  badges.ts, copy.ts, constants.ts, types.ts, feedback.ts
  schema.sql       the database
```

### Two decisions worth knowing about

**Undo restores a snapshot rather than recomputing.** Every XP-granting action
writes a full before-image to `xp_events`. Undo replays that image, so XP,
streak, longest streak, freeze allowance, and badges land back exactly where
they were — an undone save never counted as activity. Recomputing would have
been subtly wrong at month boundaries and around freezes.

**Dates are strings, never timestamps.** Streaks turn on calendar days in *your*
timezone. Vercel runs UTC, so a naive `new Date()` would roll your day over at
8am local time. Postgres `DATE` columns are read as plain `YYYY-MM-DD` strings
end to end, and `lib/dates.ts` formats through `Intl` with an explicit timezone.

---

## Verified behaviour

Checked against a real browser at 390px and a live Postgres database:

- Logging a Transport expense takes three taps with today's date; nothing is
  typed but the amount.
- Tapping a remembered-amount chip loads the keypad and saves nothing.
  Transport shows three chips; Food → Delivery shows a single `~` chip.
- Saving then hitting Undo leaves the database, XP total, streak, and badges
  byte-identical to before.
- Feedback appears about 90ms after Save, well inside the 300ms target.
- Restarting the server preserves all data, XP, streak, and badges.
- The XLSX export opens cleanly with one sheet per month, a Summary sheet,
  frozen headers, currency formatting, and totals that reconcile.
- Streaks increment across date boundaries, including leap years and year ends.
  The freeze bridges exactly one missed day per calendar month.
- No horizontal scrolling, no tap target under 44px, and no network requests to
  any external domain.
