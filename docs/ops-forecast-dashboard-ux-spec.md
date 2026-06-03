# TFI Ops Forecast Dashboard UX Spec

> Private pilot dashboard for `ops.tfistudios.com`. This spec is for internal staffing decisions at The Escape Adventures. It must stay PII-free and should explain forecast logic in operator language, not black-box AI language.

## 1. Product goal and operator goal

### Page goal
Help Robert/operators answer one question quickly:

> "Do we have enough game-master coverage for the rooms people are likely to book, and where are we at risk of blocking revenue?"

### Primary operator actions
1. Check the next 7-14 days for staffing coverage risk.
2. Identify specific time windows where expected room concurrency exceeds planned staff coverage.
3. See whether local events justify staffing up before bookings appear on the calendar.
4. Review forecast accuracy after the weekend and record adjustment notes.

### UX priority
The dashboard should optimize for the next staffing decision, not for model inspection. Every major section should answer one of these:

- "Where is the risk?"
- "Why is it risky?"
- "What should I look at next?"
- "What changed since the last forecast?"

## 2. Information architecture

Recommended private route structure:

- `/ops/forecast`
  - Main forecast dashboard.
  - Shows upcoming days, staffing risk, room concurrency, event flags, and model explanation.
- `/ops/forecast/[date]` or in-page expandable day detail
  - Day detail view for a selected date.
  - Shows risk by time window, likely demanded rooms, current bookings, event notes, and blocked-revenue risk.
- Optional future route: `/ops/events`
  - Event intelligence inbox if the panel becomes too large for the main page.
- Optional future route: `/ops/retrospectives`
  - Weekend forecast-vs-actual archive once enough retrospective reports exist.

For the pilot, a single page with expandable day details is acceptable and lower implementation risk.

## 3. Main forecast page layout

### Header
Purpose: orient the operator and establish privacy/recency.

Recommended content:

- Title: `Staff Coverage Forecast`
- Subtitle: `Room demand, game-master coverage, and blocked-revenue risk for The Escape Adventures.`
- Metadata row:
  - `Generated: [date/time]`
  - `Source: Sales - Pabbly Staging`
  - `Model version: [version]`
  - `Privacy: no customer names, emails, phone numbers, or payment data`
- Primary CTA/link: `Review high-risk days`
- Secondary CTA/link: `Open event inbox`

Avoid: "AI knows demand" or "AI staffing optimizer." Use "forecast," "estimate," and "risk flag."

### Summary cards
Purpose: give the answer in under 10 seconds.

Cards, in priority order:

1. `Highest-risk day`
   - Example value: `Saturday`
   - Supporting line: `2 time windows may need 3 game masters`
   - State colors:
     - Red: likely concurrency > planned staff.
     - Amber: possible concurrency > planned staff or confidence is low.
     - Green: planned staff likely covers expected rooms.

2. `Blocked-revenue risk`
   - Example value: `$420 estimated at risk`
   - Supporting line: `If only 1 GM is available during likely 2-3 room overlap.`
   - If revenue estimate is not available yet, show count-based substitute: `2 likely blocked room starts`.

3. `Next weekend coverage`
   - Example value: `Watch Saturday 12-4 PM`
   - Supporting line: `Events and baseline demand both point upward.`

4. `Event surge flags`
   - Example value: `3 candidate events`
   - Supporting line: `1 high confidence, 2 medium confidence within 30 miles.`

5. `Forecast confidence`
   - Example value: `Medium`
   - Supporting line: `Based on on-books demand, historical pattern, and event notes.`

### Upcoming days table
Purpose: make scanning and day selection easy.

Recommended columns:

| Column | Operator-facing label | Notes |
|---|---|---|
| Date/day | `Day` | Include day-of-week first: `Sat Jun 6`. |
| Current bookings | `On books` | Count only; no customer details. |
| Expected rooms/time pressure | `Likely room demand` | Summarize expected rooms by daypart, e.g. `2-3 rooms around 1-4 PM`. |
| Staff plan | `Planned GM coverage` | Show known coverage if available, e.g. `1 until 5 PM, 2-3 after`. |
| Risk | `Staffing risk` | Red/amber/green badge plus short reason. |
| Blocked-revenue risk | `Blocked-revenue risk` | Estimated dollars or likely blocked start count. |
| Event flags | `Event flags` | Small badges: `Sports`, `Festival`, `School break`, `Weather`. |
| Action | `Details` | Opens day detail view/expandable panel. |

Default sort:

1. High staffing risk first.
2. Then upcoming chronological order.

Filtering for pilot:

- `All days`
- `High risk`
- `Weekend`
- `Has event flag`

### Risk badge language
Use badges that explain the staffing issue, not generic severity.

Recommended labels:

- `Coverage gap likely`
- `Coverage gap possible`
- `Covered`
- `Needs review`
- `Waiting on staffing plan`

Examples:

- Red: `Coverage gap likely: likely 3 room overlap, 1 GM planned.`
- Amber: `Coverage gap possible: event may lift demand before bookings appear.`
- Green: `Covered: planned staff matches likely room concurrency.`

### Room concurrency visualization
Purpose: make the model correction visible: this is not guest count alone.

Recommended pilot visualization:

- A compact horizontal daypart strip per day:
  - `10 AM-12 PM`
  - `12-2 PM`
  - `2-4 PM`
  - `4-6 PM`
  - `6-9 PM`
- Each segment shows:
  - likely rooms demanded: `1`, `2`, or `3 rooms`
  - planned GM coverage: `1 GM`, `2 GMs`, etc.
  - status color based on rooms demanded vs GM coverage

Tooltip or expandable text:

- `A game master can cover one active room start/experience at a time. If staffing is below likely room concurrency, the booking engine may block otherwise sellable room starts.`

### Event flags on main page
Purpose: show why demand might arrive late or exceed on-books demand.

Event flags should appear as compact badges in the table and as a panel below the forecast table.

Badge examples:

- `Tournament nearby`
- `Festival weekend`
- `School calendar`
- `Weather watch`
- `Manual note`

Each flag should link or scroll to the event intelligence inbox entry.

### Model explanation panel
Purpose: build trust without pretending certainty.

Placement: below summary/table, collapsed by default or as a small right-side card.

Recommended copy:

> This forecast estimates room/game-master pressure, not just guest count. It compares current bookings, historical demand patterns, local event notes, and planned staffing coverage. Risk flags are decision aids; they should be reviewed with operator judgment before changing staffing.

Must include:

- Data recency.
- PII-free statement.
- Model limits.
- Explanation that blocked revenue is an estimate.
- Link/anchor to retrospective accuracy if available.

## 4. Day detail view concept

### Day detail goal
Help the operator decide whether to add, move, or hold staffing for a specific day/time window.

### Entry point
Clicking `Details` on a day row should open either:

- an expanded row below the selected day, or
- a dedicated `/ops/forecast/[date]` page.

For pilot speed, use expandable rows. Use a dedicated route later if day detail becomes dense.

### Day detail header
Recommended content:

- `Saturday, Jun 6`
- `Overall risk: Coverage gap likely`
- `Primary concern: 12-4 PM may need 3 game masters`
- `Recommended review: confirm whether 2nd/3rd GM can cover mid-day overlap`

Avoid phrasing as an automatic staffing command unless staffing policy rules are formally approved.

### Time-window table
Recommended columns:

| Column | Label | Notes |
|---|---|---|
| Window | `Time window` | 2-hour blocks for pilot; refine later if booking intervals require 30-min precision. |
| Likely rooms | `Likely demanded rooms` | Expected concurrent game demand, not guest count. |
| Current bookings | `On-books rooms` | Room/game names and booked start counts only. No PII. |
| Planned coverage | `Planned GM coverage` | Known staff count or `Unknown`. |
| Gap | `Coverage gap` | `0`, `+1 GM needed`, etc. |
| Blocked risk | `Blocked-revenue risk` | Dollar estimate or likely blocked starts. |
| Confidence | `Confidence` | High/medium/low with reason. |
| Notes | `Notes` | Concise event/model/operator notes. |

### Room/game demand detail
Show room names because operators think in rooms, but avoid customer data.

Known rooms/games from plan context:

- `Clockwork Odyssey`
- `Lab Rats`
- `Blackbeard's Revenge`

Example display:

- `12-2 PM`
  - Likely demanded rooms: `Lab Rats + Clockwork Odyssey likely; Blackbeard possible`
  - On books: `1 Lab Rats start`
  - Planned coverage: `1 GM`
  - Risk: `Booking may block 1-2 additional room starts`

### Blocked-revenue risk explanation in day detail
Use a clear calculation note when available:

> Blocked-revenue risk estimates room starts that may become unavailable when staffing is below likely room concurrency. It is not guaranteed lost revenue; it is a warning that the booking engine may prevent customers from selecting otherwise sellable times.

If the model cannot estimate dollars yet, label the metric as `blocked room-start risk` instead of pretending revenue precision.

### Operator notes
Include a small notes area for:

- staffing assumptions;
- event-related judgment;
- known owner/employee coverage constraints;
- model caveats;
- follow-up reminders.

Pilot note fields can be read-only from generated artifacts. Editable notes can wait unless implementation scope explicitly adds persistence.

## 5. Event intelligence inbox panel

### Panel goal
Let operators review weekly local-event candidates and decide whether any event should influence staffing expectations.

### Placement
Main forecast page, below or beside the upcoming days table.

Recommended title:

- `Event Intelligence Inbox`

Recommended subtitle:

- `Candidate local events within 30 miles that may affect escape-room demand.`

### Event card fields
Each event candidate should show:

- `Event name`
- `Date/time range`
- `Location`
- `Distance estimate`
- `Event type`
- `Audience fit`
- `Expected attendance` if known
- `Suggested uplift`
  - bookings uplift
  - guest uplift
  - room-demand/staffing note if available
- `Confidence`
- `Source URL`
- `Research notes`
- `Status`

Recommended statuses:

- `New candidate`
- `Accepted for forecast`
- `Needs operator review`
- `Dismissed`
- `Expired`

### Confidence display
Use confidence as a review aid, not as an authority claim.

- `High`: official source, date/location confirmed, relevant audience likely.
- `Medium`: credible source but demand impact uncertain.
- `Low`: weak source, unclear attendance, or questionable fit.

### Suggested uplift language
Avoid overclaiming.

Good:

- `Suggested uplift: +1-2 bookings; confidence medium.`
- `Possible mid-day lift. Consider staffing review if Saturday on-books demand rises.`
- `Watch only: event is nearby but audience fit is uncertain.`

Avoid:

- `This event will generate 20 guests.`
- `AI recommends adding staff.`

### Source URL behavior
Show the source domain and provide the full URL in the link target. If multiple sources exist, display the strongest source first and allow secondary links.

No event card should enter the dashboard without at least one source URL or an explicit `manual note` label.

## 6. Retrospective loop

### Retrospective goal
Close the feedback loop so the forecast improves and operators trust the dashboard.

### Main page placement
A small panel near the model explanation:

- `Latest retrospective`
- `Forecast vs actual: [summary]`
- `Event notes: [matched/missed/no clear impact]`
- `Model adjustment notes: [short summary]`
- Link: `View retrospective notes`

### Retrospective detail fields
Each retrospective report should capture:

| Field | Purpose |
|---|---|
| `Forecast date` | Which generated forecast was reviewed. |
| `Reviewed period` | Weekend/day/time windows covered. |
| `Forecast risk` | The original risk level and time windows. |
| `Actual bookings/rooms` | Aggregate counts only; no PII. |
| `Actual concurrency` | How many rooms needed simultaneous GM coverage. |
| `Blocked/rejected demand evidence` | Only if available without PII. |
| `Event note vs actual demand` | Whether candidate events seemed relevant. |
| `Missed signals` | What the model or research did not catch. |
| `Operator note` | Human interpretation. |
| `Model adjustment note` | What should change next time. |

### Feedback labels
Recommended labels:

- `Forecast was accurate`
- `Forecast overestimated demand`
- `Forecast underestimated demand`
- `Event note helped`
- `Event note did not appear relevant`
- `Staffing assumption needs update`
- `Confidence should be lower next time`

### Retrospective copy example

> Forecast flagged Saturday 12-4 PM as a possible 3-room overlap. Actual demand reached 2-room overlap, with one additional inquiry after the preferred time was unavailable. Event impact was unclear. Keep Saturday mid-day risk amber unless on-books demand or event confidence increases.

## 7. Copy guidance

### Voice
Use concise operator language:

- direct;
- practical;
- humble about uncertainty;
- focused on decisions;
- no hype.

### Recommended terms
Use:

- `forecast`
- `estimate`
- `risk flag`
- `coverage gap`
- `planned GM coverage`
- `likely demanded rooms`
- `blocked-revenue risk`
- `confidence`
- `operator review`

Avoid:

- `AI says`
- `guaranteed`
- `optimal staffing`
- `autonomous decision`
- `perfect prediction`
- `guest intelligence`
- customer-specific language or anything implying PII exposure

### Empty states
Use operational next steps.

- No forecast data:
  - `No forecast artifact is available yet. Run the forecast publish job and refresh this dashboard.`
- No event candidates:
  - `No event candidates found for this forecast period. Weekly research may still update this panel.`
- Missing staffing plan:
  - `Staffing coverage is unknown for this day. Add planned GM coverage before relying on risk color.`
- Low confidence:
  - `Low confidence: use this as a watch item, not a staffing recommendation.`

### Button/link labels
Use verbs tied to decisions:

- `Review day`
- `Review high-risk days`
- `Open event source`
- `View model notes`
- `View retrospective`
- `Mark event accepted` (future editable workflow)
- `Dismiss event` (future editable workflow)

## 8. Visual and interaction notes

### Visual hierarchy
1. Risk summary cards.
2. Upcoming days table.
3. Day detail expansion.
4. Event inbox.
5. Model/privacy/retrospective explanation.

### Color usage
Use color as a secondary cue only; include text labels for every status.

- Red: likely staffing gap or likely blocked-revenue risk.
- Amber: possible staffing gap, low/medium confidence event lift, or missing staffing data.
- Green: coverage appears sufficient.
- Gray: no data/unknown/not applicable.

### Density
This is an internal operator dashboard, so moderate data density is acceptable. Keep each row scannable and move explanations into expandable details.

### Mobile/responsive behavior
Pilot can prioritize desktop/tablet, but phone should remain usable:

- summary cards stack vertically;
- table becomes cards by day;
- event inbox cards stack below forecast;
- source URLs should not overflow.

### Accessibility
- Do not rely on color alone.
- Use clear status text.
- Ensure table headers are descriptive.
- Keep contrast high for red/amber/green badges.
- Make expandable controls keyboard reachable.

## 9. Data/privacy constraints

The dashboard must not show or store customer PII.

Do not display:

- customer names;
- emails;
- phone numbers;
- payment data;
- booking notes that identify customers;
- full raw workbook rows.

Allowed aggregate/operator-safe data:

- booking counts;
- room/game names;
- date/time windows;
- expected room starts;
- expected concurrent GM demand;
- planned staff count;
- confidence;
- event source URLs;
- aggregate actual-vs-forecast counts.

Add a persistent privacy note in the model explanation panel:

> This dashboard uses aggregate booking and forecast data only. It should not contain customer names, contact details, payment data, or private booking notes.

## 10. Implementation acceptance criteria

A first implementation satisfies this spec if:

1. `/ops/forecast` clearly surfaces the highest-risk upcoming days before detailed tables.
2. Staffing risk is based on expected room/game-master concurrency, not guest count alone.
3. Each high/amber risk row explains the reason in one sentence.
4. Day detail shows time windows, likely demanded rooms, current bookings by room, planned GM coverage, coverage gap, blocked-revenue risk, confidence, and notes.
5. Event intelligence shows candidate events with source URLs, confidence, suggested uplift, and status.
6. Retrospective space exists, even if initially empty or populated from static markdown/artifacts.
7. Model explanation uses humble forecast language and includes privacy/no-PII guidance.
8. Empty states tell the operator what is missing and what to do next.
9. No customer PII appears in the UI or static data artifacts.
10. The private route remains protected by the approved pilot password gate before any deployment.

## 11. Open questions for CASEE/Robert

These do not block the UX spec, but they affect implementation precision:

1. What revenue value should be used for a blocked room start if the model estimates dollars?
2. Should planned GM coverage come from a manual static schedule, Google Sheet, or generated artifact during pilot?
3. Should day detail use 2-hour windows first, or should it model exact 30-minute booking start intervals from day one?
4. Which event statuses should operators be able to edit in the pilot, if any?
5. Should retrospective notes be read-only generated reports first, or should Robert/operators be able to add notes directly in the dashboard?
6. What minimum confidence level allows an event to affect staffing risk color rather than appearing as a watch-only note?
