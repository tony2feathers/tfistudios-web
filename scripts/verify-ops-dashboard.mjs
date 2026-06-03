import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (relativePath) => readFileSync(join(repoRoot, relativePath), 'utf8');
const readJson = (relativePath) => JSON.parse(read(relativePath));

const requiredFiles = [
  'src/data/forecast-latest.json',
  'src/data/event-intel-latest.json',
  'src/pages/ops/forecast.astro',
  'src/layouts/OpsLayout.astro',
  'src/middleware.ts',
];

for (const relativePath of requiredFiles) {
  assert.ok(existsSync(join(repoRoot, relativePath)), `${relativePath} should exist`);
}

const forecast = readJson('src/data/forecast-latest.json');
assert.ok(forecast.metadata, 'forecast should include metadata');
assert.ok(Array.isArray(forecast.forecast), 'forecast should include forecast rows');
assert.ok(forecast.forecast.length >= 7, 'forecast should include at least 7 days');
assert.match(forecast.metadata.privacy_note, /PII-free|No customer/i);
assert.ok(forecast.metadata.loaded_rows > 0, 'forecast should be generated from real aggregate booking rows, not scaffold data');
assert.ok(forecast.metadata.capacity_model, 'forecast should document the game-capacity normalization model');
assert.equal(forecast.metadata.capacity_model.pre_clockwork_capacity, 2, 'pre-Clockwork capacity should be modeled as 2 games');
assert.equal(forecast.metadata.capacity_model.current_game_capacity, 3, 'current capacity should be modeled as 3 games');
assert.ok(forecast.forecast.some((row) => Array.isArray(row.windows) && row.windows.length > 1), 'forecast should include weekday/daypart window detail');

const events = readJson('src/data/event-intel-latest.json');
assert.ok(Array.isArray(events), 'event-intel latest should be an array');

const piiKeyPattern = /(customer_name|customer_email|email|phone|payment|card|private_booking_note|booking_note)/i;
function scanKeys(value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanKeys(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    assert.ok(!piiKeyPattern.test(key), `PII-like key ${path}.${key} is not allowed`);
    scanKeys(nested, `${path}.${key}`);
  }
}
scanKeys(forecast);
scanKeys(events);

const opsPage = read('src/pages/ops/forecast.astro');
for (const requiredCopy of [
  'Staff Coverage Forecast',
  'Highest-risk day',
  'Blocked-revenue risk',
  'Event Intelligence Inbox',
  'This dashboard uses aggregate booking and forecast data only',
]) {
  assert.ok(opsPage.includes(requiredCopy), `ops page should include copy: ${requiredCopy}`);
}
assert.ok(opsPage.includes('expected_rooms') || opsPage.includes('concurrent_staff_needed'), 'ops page should render room-concurrency metrics');
assert.ok(opsPage.includes('chronologicalWindow'), 'ops page should establish a chronological seven-day window before review sorting');
assert.ok(opsPage.includes('riskSeverity(b) - riskSeverity(a)'), 'upcoming days should sort by staffing-risk severity first');
assert.ok(opsPage.includes('a.days_until - b.days_until'), 'risk sorting should use date as the tiebreaker');
assert.ok(opsPage.includes('nextWeekendCoverage'), 'next weekend card should use a derived risk label');
assert.ok(!opsPage.includes('`${weekendRows[0].weekday} watch`'), 'next weekend card must not use a constant watch label');

const middleware = read('src/middleware.ts');
assert.ok(middleware.includes('OPS_DASHBOARD_PASSWORD'), 'middleware should use OPS_DASHBOARD_PASSWORD');
assert.ok(middleware.includes('OPS_DASHBOARD_USER'), 'middleware should use OPS_DASHBOARD_USER');
assert.ok(middleware.includes('/ops/'), 'middleware should protect ops routes');
assert.ok(!middleware.includes('generated password'), 'middleware must not hardcode the generated password');
assert.ok(middleware.includes('X-Robots-Tag'), 'ops middleware should prevent indexing private ops routes');
assert.ok(middleware.includes('noindex, nofollow'), 'ops middleware should set noindex/nofollow for private ops routes');

const homePage = read('src/pages/index.astro');
assert.ok(!homePage.includes('OPS_DASHBOARD_PASSWORD'), 'homepage should not include ops auth env vars');
assert.ok(!homePage.includes('Staff Coverage Forecast'), 'homepage should remain public marketing page');

console.log('ops dashboard verification passed');
