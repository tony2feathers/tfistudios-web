# TFI Ops Forecast Dashboard Implementation Plan

> **For Hermes:** Use web-app-delivery-ops and subagent-driven-development if execution is delegated. Do not deploy or change DNS/auth provider settings without Robert's explicit approval.

**Goal:** Add a private `ops.tfistudios.com`/protected dashboard pilot that publishes nightly staff forecasting output and weekly local-event intelligence for The Escape Adventures, as a VenueAxis prototype.

**Architecture:** Start as a low-risk Astro/Vercel pilot inside `tfistudios-web`: generated static JSON artifacts feed a private dashboard route. Forecast generation remains local/server-side and PII-free. Event intelligence is stored as structured artifacts first, then can evolve into a database-backed VenueAxis module.

**Tech Stack:** Astro 6, Tailwind CSS 4, Vercel adapter, Python forecast scripts, Hermes cron/research jobs, Google Sheets API.

---

## Phase 0: Robert Decisions Captured

Robert provided these pilot decisions on 2026-06-02:

1. Subdomain: `ops.tfistudios.com`.
2. Pilot auth: simple password gate is acceptable; Clerk can be used later if needed.
3. Temporary dashboard password: CASEE generated one for initial setup. Do not commit it, store it in docs, or print it in worker logs. Robert will change it after first login.
4. Source workbook: use the live production workbook `Sales` for dashboard forecasting. The staging workbook `Sales - Pabbly Staging` is only for Pabbly/parser validation, not live ops forecasting.
5. Event research radius: 30 miles from The Escape Adventures for now.
6. CASEE operating boundary: CASEE orchestrates and assigns this work; specialist profiles implement/research/review.

### Staffing model correction

The forecasting model must focus on room/game coverage and blocked revenue, not guest count alone.

Venue operating facts from Robert:

- Three games/rooms exist; each game requires a game master.
- If fewer than three people are on site, the booking engine auto-blocks conflicting games when a room is reserved.
- Example: Friday has possible 12:00 Clockwork Odyssey, 12:30 Lab Rats, and 1:00 Blackbeard's Revenge. If only one staff member is available and a customer books 12:30 Lab Rats, the 12:00 and 1:00 games are blocked, creating potential lost revenue.
- Tuesday/Wednesday: currently appointment-only; appointments must be made at least two hours in advance.
- Thursday: currently open with one person; may change to two.
- Friday: one person until about 5 PM; typically 2-3 people on site after about 5 PM.
- Saturday/Sunday: 2-4 people depending on expected demand.
- Current staffing constraint: only one true employee, who works some Tues/Wed bookings and every other Saturday; owners cover the rest.
- Core business problem: understaffing high-demand periods causes booking-engine blocking and lost room/game revenue.

Forecast outputs should therefore include:

- expected rooms/games demanded by time block, not only guests/bookings;
- expected concurrent game-master demand;
- staffing coverage risk by time window;
- estimated blocked-revenue risk when staffing is below likely room concurrency;
- event-intel demand surge flags that can justify staffing up before on-the-books demand appears.

## Phase 1: Local Static Dashboard Scaffold

### Task 1: Create forecast artifact output format

**Objective:** Extend the current Python forecast script to emit dashboard-ready JSON.

**Files:**
- Modify: `/home/tfintelligence/TFI/projects/escape-adventures-analytics/scripts/baseline_forecast.py`
- Create: `/home/tfintelligence/TFI/projects/escape-adventures-analytics/reports/forecast-latest.json`
- Create: `/home/tfintelligence/TFI/projects/escape-adventures-analytics/reports/forecast-history/YYYY-MM-DD.json`

**Steps:**
1. Add `--json-output` parameter.
2. Include model metadata: generated date, source workbook ID, model version, loaded row count, source tabs, privacy note.
3. Include forecast rows with no PII.
4. Include external event references if provided.
5. Run script and verify JSON parses.

**Verification:**

```bash
python scripts/baseline_forecast.py \
  --output reports/baseline-forecast-report.md \
  --json-output reports/forecast-latest.json
python -m json.tool reports/forecast-latest.json >/tmp/forecast.json
```

### Task 2: Add dashboard data folder to website repo

**Objective:** Provide a static data location for the Astro pilot.

**Files:**
- Create: `/home/tfintelligence/TFI/projects/tfistudios-web/src/data/forecast-latest.json`
- Create: `/home/tfintelligence/TFI/projects/tfistudios-web/src/data/event-intel-latest.json`

**Steps:**
1. Copy current forecast JSON into `src/data` for build-time rendering.
2. Create an empty/synthetic event-intel file with the intended schema.
3. Ensure files contain no customer PII.

### Task 3: Create private ops layout/page

**Objective:** Build an Astro dashboard route that renders forecast data.

**Files:**
- Create: `/home/tfintelligence/TFI/projects/tfistudios-web/src/pages/ops/forecast.astro`
- Optional create: `/home/tfintelligence/TFI/projects/tfistudios-web/src/layouts/OpsLayout.astro`

**Page sections:**
- header: TFI Ops / Staff Forecasting
- summary cards: next Saturday, next Sunday, total next 7 days, high-risk days
- forecast table: date, day, on-books, baseline, forecast guests/bookings, staffing, confidence
- event-intel panel: local events that may affect demand
- model notes and privacy note

**Verification:**

```bash
npm run build
npm run dev
```

Then browser-check `/ops/forecast` locally.

## Phase 2: Protection/Auth

### Task 4: Add pilot route protection

**Objective:** Prevent public access to ops dashboard.

**Files:**
- Potentially create: `/home/tfintelligence/TFI/projects/tfistudios-web/src/middleware.ts`

**Preferred pilot approach:** environment-variable password gate for `/ops/*` routes.

**Environment variable names:**
- `OPS_DASHBOARD_PASSWORD`
- optional `OPS_DASHBOARD_USER`

**Rules:**
- Do not hardcode password in repo.
- Do not print secret values in logs.
- Local test can use a temporary non-production password in shell only.

**Verification:**
- no-cookie request to `/ops/forecast` should return auth challenge/redirect.
- authenticated request should return page.
- public homepage should remain accessible.

## Phase 3: Nightly Automation

### Task 5: Create publish script

**Objective:** Generate forecast artifacts and sync/copy them into website data location or deployment storage.

**Files:**
- Create: `/home/tfintelligence/TFI/projects/escape-adventures-analytics/scripts/publish_forecast_artifacts.py`

**Steps:**
1. Run `baseline_forecast.py` with JSON output.
2. Save immutable dated snapshot.
3. Copy latest snapshot into website repo `src/data/forecast-latest.json` or external storage.
4. Optionally commit/push if Robert approves that deployment pattern; otherwise keep local until deployment design is approved.

**Boundary:** Do not auto-commit/push/deploy without Robert's explicit approval.

### Task 6: Schedule nightly forecast generation

**Objective:** Run forecast every night from the live `Sales` workbook so the dashboard reflects current booking data.

**Preferred:** Hermes cronjob or system cron on the TFI machine.

**Schedule:** around 3:00 AM local.

**Prompt/tooling:** self-contained, read staging workbook, produce PII-free forecast artifacts, report failures.

## Phase 4: Weekly Event Intelligence

### Task 7: Create local event-intel schema and seed file

**Objective:** Store researched local events in a structured format.

**Files:**
- Create: `/home/tfintelligence/TFI/projects/escape-adventures-analytics/event-intel/events-latest.json`
- Create: `/home/tfintelligence/TFI/projects/escape-adventures-analytics/event-intel/README.md`

**Fields:**
- `event_name`
- `start_date`
- `end_date`
- `location`
- `distance_miles_estimate`
- `event_type`
- `expected_attendance`
- `audience_fit`
- `expected_uplift_bookings`
- `expected_uplift_guests`
- `confidence`
- `source_url`
- `research_notes`
- `status`
- `created_at`

### Task 8: Schedule weekly research agent

**Objective:** Search upcoming regional events and produce structured candidate findings.

**Schedule:** Monday morning weekly, optional Thursday refresh.

**Sources to research:**
- official Richmond/Chesterfield event calendars
- local sports tournament calendars
- school calendars/breaks
- festival calendars
- tourism calendars
- weather risk close to weekend

**Boundary:** Research agent captures candidate event intelligence; it does not directly mutate staffing policy or live recommendations without accepted confidence rules.

## Phase 5: Retrospective Loop

### Task 9: Add retrospective report

**Objective:** Compare forecasts and event-intel notes against actual demand after each weekend.

**Files:**
- Create: `/home/tfintelligence/TFI/projects/escape-adventures-analytics/scripts/weekend_retrospective.py`
- Output: `/home/tfintelligence/TFI/projects/escape-adventures-analytics/reports/retrospectives/YYYY-MM-DD.md`

**Report:**
- forecast vs actual
- event notes known before weekend
- actual demand delta vs baseline
- likely event impact
- model/staffing adjustment notes

## Deployment Gate

Before pushing/deploying:

1. `npm run build` passes locally.
2. Dashboard contains no PII.
3. `/ops/*` route protection verified locally.
4. Robert approves subdomain/auth/deploy target.
5. Robert approves whether to push to `master` or create PR/preview first.

## Recommended first execution

Start with Phase 1 only locally. Once Robert provides auth/subdomain decision and staffing thresholds, implement Phase 2 protection and request deployment approval.
