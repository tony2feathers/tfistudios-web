// Pure, browser-safe game state machine for the Blackbeard's Treasure escape game.
// No DOM access, no storage, no network, no eval. The UI layer consumes these exports.

export const GAME_VERSION = 2;

export const PUZZLES = [
  {
    id: 'wardroom-lock',
    title: 'The Wardroom Lock',
    prompt: 'The wardroom lock has three brass dials. Set them to the captain\'s night-watch code.',
    clue: 'Captain\'s night-watch log, nailed above the desk: First watch — 2 bells. Second watch — 5 bells. Third watch — 3 bells. The lock takes the bells in watch order, oldest first.',
    answer: '253',
    hints: [
      'Read the logbook from the first watch to the third. Each line gives one digit.',
      'The digits are 2, 5, 3 in that order. Set the dials left to right.',
      'Solution: 253.',
    ],
    wrong: 'The dials stay put. Read the three watch entries again; there is no lockout.',
    reward: 'spyglass',
  },
  {
    id: 'reef-bearing',
    title: 'The Reef Passage',
    prompt: 'Choose the return bearing that runs from the treasure chest back to the cove.',
    clue: 'Chart bearings: stern lantern → reef 075°; reef → cove 210°; cove → chest 330°. A note reads: "Reverse a bearing by 180° to return along the same line."',
    answer: '150',
    hints: [
      'The chart gives cove → chest as 330°. The prompt asks for the chest → cove return, so reverse that leg.',
      'Reverse 330° by 180°: (330 + 180) mod 360 = 150°. That points from the chest back toward the cove.',
      'Solution: 150°.',
    ],
    wrong: '150° is the correct chest-to-cove return. 330° is the printed cove-to-chest leg, not the return bearing.',
    reward: 'brass chart',
  },
  {
    id: 'crowbar-rope',
    title: 'The Rigging Rope',
    prompt: 'Which rope holds the crowbar? Choose A, B, C, or D.',
    clue: 'Tide table: high tide 8 ft, low tide 3 ft. Four rigging ropes: A has 4 knots, B has 7 knots, C has 9 knots, D has 5 knots. A chalk note says: "The crowbar rope carries knots equal to high tide minus low tide."',
    answer: 'D',
    hints: [
      'High tide minus low tide is the knot count you need.',
      '8 − 3 = 5 knots. Only rope D has five knots.',
      'Solution: D.',
    ],
    wrong: 'Count again. The note compares two tide heights, not the bearings.',
    reward: 'crowbar',
  },
  {
    id: 'escape-gangway',
    title: 'The Escape Gangway',
    prompt: 'Choose the gangway to leave by: fore, aft, or boarding plank.',
    clue: 'Bell schedule by the door: current watch 3 bells; Blackbeard\'s return 8 bells. Three gangways: fore 2 bells, aft 5 bells, boarding plank 8 bells. A note says: "Leave by the gangway whose bells equal the gap between the return watch and the current watch."',
    answer: 'aft',
    hints: [
      'Subtract the current watch from the return watch.',
      '8 − 3 = 5 bells. The aft gangway is marked 5.',
      'Solution: aft gangway.',
    ],
    wrong: 'The boarding plank is the return watch itself; the fore gangway is too early. Recheck the subtraction.',
    reward: 'escape route',
  },
];

export const INITIAL_INVENTORY = ['dark lantern', 'empty satchel'];

export const TREASURE = ['gold coins', 'rubies', 'silver chalice', 'captain\'s seal'];

export const WIN_TEXT = 'The chest is open and the treasure is in your satchel. The gangway is clear, but Blackbeard\'s Revenge is already waiting on the far side of the water. Restart to try the run again.';

function freshState() {
  return {
    version: GAME_VERSION,
    phase: 0,
    solved: PUZZLES.map(() => false),
    attempts: PUZZLES.map(() => 0),
    inventory: INITIAL_INVENTORY.slice(),
    treasure: [],
    chestOpen: false,
    crowbarUsed: false,
    escaped: false,
    won: false,
    lastMessage: 'Aboard the Queen Anne\'s Revenge. Four protections stand between you and the treasure.',
  };
}

export function createGame() {
  return freshState();
}

export function currentPuzzle(state) {
  return state.phase < PUZZLES.length ? PUZZLES[state.phase] : null;
}

export function normalizeGuess(raw) {
  return String(raw).trim().toLowerCase().replace(/°$/, '');
}

function hasItem(state, item) {
  return state.inventory.includes(item);
}

export function submit(state, rawGuess) {
  if (state.won) {
    return { ok: false, phase: state.phase, message: 'The treasure is already won. Restart to play again.' };
  }
  if (!Number.isInteger(state.phase) || state.phase < 0 || state.phase > PUZZLES.length) {
    return { ok: false, phase: state.phase, message: 'The run is out of sequence. Restart to play again.' };
  }
  if (state.phase === PUZZLES.length) {
    return { ok: false, phase: state.phase, message: 'All protections are solved, but the chest still needs to be opened with the crowbar.' };
  }
  const puzzle = PUZZLES[state.phase];
  if (state.solved[state.phase]) {
    return { ok: false, phase: state.phase, message: 'This protection is already solved. Use the chest action or restart.' };
  }
  const guess = normalizeGuess(rawGuess);
  if (guess === normalizeGuess(puzzle.answer)) {
    if (hasItem(state, puzzle.reward)) {
      return { ok: false, phase: state.phase, message: `The ${puzzle.reward} is already in your inventory; restart to reset the run.` };
    }
    state.solved[state.phase] = true;
    state.inventory.push(puzzle.reward);
    state.phase += 1;
    if (state.phase === PUZZLES.length) {
      state.lastMessage = 'All four protections are solved. The crowbar is in your inventory; the chest is still closed.';
      return { ok: true, phase: state.phase, message: state.lastMessage };
    }
    const next = PUZZLES[state.phase];
    state.lastMessage = `Correct. You gain the ${puzzle.reward}. Next protection: ${next.title}.`;
    return { ok: true, phase: state.phase, message: state.lastMessage };
  }
  state.attempts[state.phase] += 1;
  state.lastMessage = puzzle.wrong;
  return { ok: false, phase: state.phase, message: puzzle.wrong };
}

export function useCrowbar(state) {
  if (state.won) {
    return { ok: false, message: 'The treasure is already won. Restart to play again.' };
  }
  if (state.phase !== PUZZLES.length || !state.solved.every(Boolean)) {
    return { ok: false, message: 'The chest can only be opened after all four protections are solved.' };
  }
  if (!hasItem(state, 'crowbar')) {
    return { ok: false, message: 'You need the crowbar in your inventory to open the chest.' };
  }
  if (state.crowbarUsed || state.chestOpen) {
    return { ok: false, message: 'The crowbar has already been used; the chest is open.' };
  }
  state.crowbarUsed = true;
  state.chestOpen = true;
  for (const item of TREASURE) {
    if (!state.treasure.includes(item)) {
      state.treasure.push(item);
      state.inventory.push(item);
    }
  }
  state.lastMessage = 'The crowbar turns the lock. The chest opens and the treasure is awarded once.';
  return { ok: true, message: state.lastMessage };
}

export function escape(state) {
  if (state.won) {
    return { ok: false, message: 'The treasure is already won. Restart to play again.' };
  }
  if (!state.chestOpen || !state.crowbarUsed) {
    return { ok: false, message: 'The escape cannot win until the chest has actually been opened with the crowbar.' };
  }
  if (!hasItem(state, 'crowbar') || !hasItem(state, 'escape route')) {
    return { ok: false, message: 'The run needs both the crowbar and the escape route before it can win.' };
  }
  if (state.escaped) {
    return { ok: false, message: 'The escape has already been completed. Restart to play again.' };
  }
  state.escaped = true;
  state.won = true;
  state.lastMessage = WIN_TEXT;
  return { ok: true, message: WIN_TEXT };
}

export function hint(state, level) {
  const puzzle = currentPuzzle(state);
  if (!puzzle) {
    return { text: 'All protections are solved. Use the crowbar on the chest, then the escape gangway.', level: 0 };
  }
  const bounded = Math.max(0, Math.min(2, Math.trunc(level)));
  return { text: puzzle.hints[bounded], level: bounded };
}

export function restart(state) {
  // Mutate in place so the UI keeps one state object and no duplicate listeners are needed.
  const fresh = freshState();
  Object.assign(state, fresh);
  return state;
}

export function progress(state) {
  return {
    phase: state.phase,
    solvedCount: state.solved.filter(Boolean).length,
    total: PUZZLES.length,
    inventory: state.inventory.slice(),
    treasure: state.treasure.slice(),
    chestOpen: state.chestOpen,
    crowbarUsed: state.crowbarUsed,
    won: state.won,
  };
}

export function validateStateShape(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
  if (candidate.version !== GAME_VERSION) return false;
  if (!Number.isInteger(candidate.phase) || candidate.phase < 0 || candidate.phase > PUZZLES.length) return false;
  if (!Array.isArray(candidate.solved) || candidate.solved.length !== PUZZLES.length) return false;
  if (!Array.isArray(candidate.attempts) || candidate.attempts.length !== PUZZLES.length) return false;
  if (!Array.isArray(candidate.inventory)) return false;
  if (!Array.isArray(candidate.treasure)) return false;
  if (typeof candidate.chestOpen !== 'boolean') return false;
  if (typeof candidate.crowbarUsed !== 'boolean') return false;
  if (typeof candidate.escaped !== 'boolean') return false;
  if (typeof candidate.won !== 'boolean') return false;

  if (candidate.solved.some((entry) => typeof entry !== 'boolean')) return false;
  if (candidate.attempts.some((entry) => !Number.isInteger(entry) || entry < 0)) return false;

  const solvedCount = candidate.solved.filter((entry) => entry === true).length;
  if (solvedCount !== candidate.phase) return false;
  if (!candidate.solved.slice(0, candidate.phase).every((entry) => entry === true)) return false;
  if (!candidate.solved.slice(candidate.phase).every((entry) => entry === false)) return false;

  const inventory = candidate.inventory;
  if (inventory.some((entry) => typeof entry !== 'string' || entry.length === 0)) return false;

  // Expected inventory: initial items + one reward per solved puzzle
  // + TREASURE only once the chest has actually been opened.
  const expected = INITIAL_INVENTORY.slice();
  for (let i = 0; i < candidate.phase; i += 1) expected.push(PUZZLES[i].reward);
  if (candidate.chestOpen) expected.push(...TREASURE);

  const expectedSet = new Set(expected);
  const inventorySet = new Set(inventory);
  if (inventory.length !== expected.length) return false;
  if (inventorySet.size !== inventory.length) return false;
  if (inventorySet.size !== expectedSet.size) return false;
  for (const entry of expected) {
    if (!inventorySet.has(entry)) return false;
  }

  const treasure = candidate.treasure;
  if (treasure.some((entry) => typeof entry !== 'string' || entry.length === 0)) return false;
  if (new Set(treasure).size !== treasure.length) return false;
  if (treasure.some((entry) => !TREASURE.includes(entry))) return false;
  if (treasure.length !== 0 && treasure.length !== TREASURE.length) return false;
  if (treasure.length === TREASURE.length && !TREASURE.every((entry) => treasure.includes(entry))) return false;

  const open = candidate.chestOpen;
  const used = candidate.crowbarUsed;
  if (used !== open) return false;
  if (open && candidate.phase !== PUZZLES.length) return false;
  if (open && treasure.length !== TREASURE.length) return false;
  if (open && !inventory.includes('crowbar')) return false;
  if (!open && treasure.length !== 0) return false;
  if (!open && inventory.some((entry) => TREASURE.includes(entry))) return false;

  // The escape route is legitimately earned at phase 4 before escaping.
  if (candidate.escaped && !open) return false;
  if (candidate.won !== candidate.escaped) return false;
  if (candidate.escaped && !inventory.includes('escape route')) return false;
  if (candidate.escaped && !inventory.includes('crowbar')) return false;

  return true;
}
