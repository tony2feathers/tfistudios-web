// The only source of game rules. The browser and verification script share these transitions.
export const STORAGE_KEY = 'tfi-blackbeard-prequel-v1';
export const ROUTE = ['moon', 'reef', 'lantern'];
export const BEARINGS = ['E', 'S', 'W'];
export const MARKS = ['N', 'E', 'S', 'W'];
export const COINS = { moon: 2, reef: 3, lantern: 1 };

export function initialState() {
  return { route: [], chart: false, bearings: [0, 0, 0], instrument: false, key: false, coins: [], won: false };
}

export function validState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const { route, chart, bearings, instrument, key, coins, won } = value;
  if (![chart, instrument, key, won].every(v => typeof v === 'boolean')) return false;
  if (!Array.isArray(route) || route.length > 3 || route.some((v, i) => v !== ROUTE[i])) return false;
  if (chart !== (route.length === 3)) return false;
  if (!Array.isArray(bearings) || bearings.length !== 3 || bearings.some(v => !Number.isInteger(v) || v < 0 || v > 3)) return false;
  if (!Array.isArray(coins) || coins.length > 3 || new Set(coins).size !== coins.length || coins.some(v => !(v in COINS))) return false;
  if (instrument && (!chart || bearings.some((v, i) => MARKS[v] !== BEARINGS[i]))) return false;
  if (key !== instrument || (won && (!key || coins.reduce((n, id) => n + COINS[id], 0) !== 5))) return false;
  return true;
}

export function transition(state, action, value) {
  if (!validState(state)) throw new Error('Invalid starting state');
  const next = { ...state, route: [...state.route], bearings: [...state.bearings], coins: [...state.coins] };
  let message = '';
  if (action === 'route' && ROUTE.includes(value)) {
    if (next.chart) message = 'The route is already traced; the chart rubbing is in your journal.';
    else if (value === ROUTE[next.route.length]) {
      next.route.push(value);
      if (next.route.length === 3) {
        next.chart = true;
        message = 'A hidden seam opens. Chart rubbing acquired: E → S → W. Take this bearing to the astrolabe.';
      } else message = `Course held. ${next.route.length} of 3 landmarks traced.`;
    } else {
      next.route = [];
      message = 'That course runs aground. The ink fades; begin again at the moon.';
    }
  } else if (action === 'rotate' && Number.isInteger(value) && value >= 0 && value < 3) {
    if (!next.chart) message = 'The astrolabe is sealed. Trace the chart first.';
    else if (next.instrument) message = 'The astrolabe is already aligned.';
    else {
      next.bearings[value] = (next.bearings[value] + 1) % 4;
      message = `Dial ${value + 1} now points ${MARKS[next.bearings[value]]}.`;
    }
  } else if (action === 'align') {
    if (!next.chart) message = 'Find the chart rubbing before aligning the astrolabe.';
    else if (next.instrument) message = 'The brass key is already yours.';
    else if (next.bearings.every((v, i) => MARKS[v] === BEARINGS[i])) {
      next.instrument = true;
      next.key = true;
      message = 'The rings lock into place. A brass key slides free. The chest awaits.';
    } else message = 'The rings shudder and refuse to lock. Compare each dial to the chart rubbing.';
  } else if (action === 'coin' && Object.hasOwn(COINS, value)) {
    if (!next.key) message = 'The chest is locked. The astrolabe holds the key.';
    else if (next.won) message = 'The chest is open; your prize is aboard.';
    else {
      next.coins = next.coins.includes(value) ? next.coins.filter(v => v !== value) : [...next.coins, value];
      message = `${value[0].toUpperCase() + value.slice(1)} weight ${next.coins.includes(value) ? 'placed' : 'removed'}.`;
    }
  } else if (action === 'open') {
    if (!next.key) message = 'The chest needs a brass key from the astrolabe.';
    else if (next.won) message = 'You already escaped with the treasure.';
    else if (next.coins.reduce((n, id) => n + COINS[id], 0) === 5 && next.coins.length === 2) {
      next.won = true;
      message = 'The balance clicks. The chest opens! You slip away with the treasure before the captain returns.';
    } else message = 'The balance tips the wrong way. The lid stays shut; adjust the weights and try again.';
  } else message = 'Nothing changes.';
  return { state: next, message };
}
