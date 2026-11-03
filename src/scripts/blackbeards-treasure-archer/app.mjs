import { initialState, validState, transition, STORAGE_KEY, MARKS, COINS } from './core.mjs';

const $ = id => document.getElementById(id);
const dialog = $('inspection');
const confirmDialog = $('confirm');
const bodies = {
  log: () => `<p>The captain has left his log open, its margins smudged with salt.</p><div class="clue"><small>Last watch · a private reminder</small>“On the night chart, begin at the <strong>moon</strong>. Sail next to the <strong>reef</strong>, and make landfall at the <strong>lantern</strong>. The course itself will tell the brass rings where to turn.”</div><p class="subtext">Inspect the sea chart to trace those landmarks. The log remains here whenever you need it.</p>`,
  chart: s => `<p>The chart shows nine islands and markers. Trace the three landmarks from the captain’s log, in order. A wrong turn washes the ink away, but you can try again.</p><div class="route-grid" aria-label="Sea chart landmarks">
    <span class="empty" aria-hidden="true">Open sea</span><button type="button" data-action="route" data-value="moon">☾ Moon</button><span class="empty" aria-hidden="true">Shoal</span>
    <span class="empty" aria-hidden="true">Cove</span><button type="button" data-action="route" data-value="reef">▲ Reef</button><span class="empty" aria-hidden="true">Current</span>
    <span class="empty" aria-hidden="true">Deep water</span><button type="button" data-action="route" data-value="lantern">✦ Lantern</button><span class="empty" aria-hidden="true">Harbor</span></div><p class="meter">Traced: ${s.route.length} / 3 landmarks</p>${s.chart ? '<div class="clue"><small>Hidden chart rubbing · collected</small>Three bearings, from left to right: <strong>E → S → W</strong>. Use these on the astrolabe.</div>' : ''}`,
  astrolabe: s => `<p>Three brass rings turn independently. Each press advances a pointer clockwise: N → E → S → W → N. The chart rubbing gives their order from left to right.</p>${s.chart ? `<div class="dials" role="group" aria-label="Astrolabe bearing dials">${s.bearings.map((v, i) => `<button type="button" data-action="rotate" data-value="${i}" ${s.instrument ? 'disabled' : ''} aria-label="Rotate dial ${i + 1}; currently ${MARKS[v]}"><span>Ring ${i + 1}</span><strong aria-hidden="true">${MARKS[v]}</strong><span>Turn ↻</span></button>`).join('')}</div><div class="actions"><button type="button" data-action="align" ${s.instrument ? 'disabled' : ''}>Lock the rings</button></div>${s.key ? '<div class="clue"><small>Recovered</small>The mechanism releases a <strong>brass key</strong>. The chest is now within reach.</div>' : ''}` : '<div class="clue"><small>Sealed mechanism</small>First trace the landmarks on the sea chart to discover the bearings.</div>'}`,
  chest: s => `<p>An ornate chest holds the prize. A brass key releases its outer lock; an old balance inside still guards the lid.</p><div class="clue"><small>Inscription on the balance</small>“Two offerings. Together they must weigh <strong>five</strong>.”<br />Moon weighs <strong>2</strong> · Reef weighs <strong>3</strong> · Lantern weighs <strong>1</strong>.</div>${s.key ? `<p>Choose exactly two engraved weights for the balance. Press a selected weight again to remove it.</p><div class="coin-buttons" role="group" aria-label="Weights on the balance">${Object.entries(COINS).map(([id, weight]) => `<button type="button" data-action="coin" data-value="${id}" aria-pressed="${s.coins.includes(id)}" class="${s.coins.includes(id) ? 'selected' : ''}" ${s.won ? 'disabled' : ''}>${id[0].toUpperCase() + id.slice(1)}<strong>${weight}</strong></button>`).join('')}</div><p class="meter">On the balance: ${s.coins.length} weights · total ${s.coins.reduce((sum, id) => sum + COINS[id], 0)}</p><div class="actions"><button type="button" data-action="open" ${s.won ? 'disabled' : ''}>Lift the lid</button></div>` : '<p class="meter">The outer lock is closed. The astrolabe may hide the key.</p>'}${s.won ? `<div class="reward"><svg viewBox="0 0 220 160" role="img" aria-label="A glowing golden treasure spilling from an open chest"><path d="M20 60Q110-25 200 60l-16 23Q109 27 36 83z" fill="#795334" stroke="#e7c277" stroke-width="6"/><ellipse cx="110" cy="92" rx="75" ry="35" fill="#e8b64a"/><g fill="#ffe39a" stroke="#b68536" stroke-width="2"><circle cx="65" cy="86" r="19"/><circle cx="111" cy="72" r="19"/><circle cx="151" cy="88" r="19"/><circle cx="90" cy="102" r="19"/><circle cx="133" cy="104" r="19"/></g><path d="M16 104h188l-16 48H32z" fill="#68432c" stroke="#e4bc69" stroke-width="6"/><path d="M103 100h22v36h-22z" fill="#e9c479"/></svg><h3>The treasure is yours.</h3><p>You slip over the rail as dawn breaks. Behind you, a captain will soon find an empty chest. His revenge is another story.</p><a href="https://theescapeadventures.com/escape-rooms/blackbeards-revenge/" target="_blank" rel="noopener noreferrer">Explore Blackbeard’s Revenge at The Escape Adventures ↗</a></div>` : ''}`
};
const hints = {
  log: ['The log names a start, a middle, and a destination.', 'Read the bold landmarks in sentence order.', 'Solution: select Moon, then Reef, then Lantern on the sea chart.'],
  chart: ['The captain’s log on the desk names the route.', 'Begin at Moon, then find Reef, then Lantern. A wrong press resets the route.', 'Solution: press Moon → Reef → Lantern. The revealed bearings are E → S → W.'],
  astrolabe: ['The chart conceals a rubbing after you finish its route.', 'Each ring starts at N. Turn the first once, second twice, third three times.', 'Solution: set the rings to E, S, W from left to right, then press Lock the rings.'],
  chest: ['The inscription demands two offerings totaling five.', 'Compare the printed weights: Moon 2, Reef 3, Lantern 1.', 'Solution: select Moon (2) and Reef (3), then press Lift the lid. You must first obtain the brass key.']
};
const titles = { log: 'The captain’s log', chart: 'The night chart', astrolabe: 'The brass astrolabe', chest: 'The treasure chest' };
let state = initialState();
try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (validState(saved)) state = saved; } catch { /* Storage may be blocked. Play continues in memory. */ }
let panel = null;
let opener = null;
let feedback = '';
let hintLevels = { log: 0, chart: 0, astrolabe: 0, chest: 0 };

function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Storage is optional. */ } }
function updateScene() {
  const count = Number(state.chart) + Number(state.instrument) + Number(state.won);
  $('progress').textContent = `${count} / 3 protections`;
  for (const [id, done] of [['chart', state.chart], ['instrument', state.instrument], ['chest', state.won]]) $('step-' + id).classList.toggle('done', done);
  const items = [];
  if (state.chart) items.push('Chart rubbing · E → S → W');
  if (state.key) items.push('Brass key · from the astrolabe');
  if (state.won) items.push('The captain’s treasure · escaped');
  if (!items.length) items.push('A steady hand and a little nerve.');
  $('inventory').replaceChildren(...items.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
  $('notes').textContent = state.won ? 'You made it ashore. When the captain returns, he will find the chest empty.' : state.key ? 'The chest inscription names the three weights. Choose two that add to five.' : state.chart ? 'The chart rubbing reads E → S → W. Turn the three astrolabe rings to match.' : 'The captain’s log rests on the desk. It may tell you where to begin.';
  document.querySelector('.scene').classList.toggle('won', state.won);
}
function renderPanel(focusKey) {
  if (!panel) return;
  $('dialog-title').textContent = titles[panel];
  $('dialog-body').innerHTML = bodies[panel](state);
  if (feedback) { const p = document.createElement('p'); p.className = 'status'; p.setAttribute('role', 'status'); p.textContent = feedback; $('dialog-body').append(p); }
  const level = hintLevels[panel];
  $('hint').textContent = level === 3 ? 'Show solution again' : `Need a hint? (${level + 1} / 3)`;
  $('hint-text').textContent = level ? hints[panel][level - 1] : '';
  if (focusKey) {
    const target = [...$('dialog-body').querySelectorAll('[data-action]')].find(el => el.dataset.action === focusKey.action && el.dataset.value === focusKey.value && !el.disabled);
    (target || $('close')).focus();
  }
}
function openPanel(which, button) {
  if (!Object.hasOwn(titles, which)) return;
  opener = button; panel = which; feedback = ''; renderPanel(); dialog.showModal(); $('close').focus();
}
document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => openPanel(button.dataset.open, button)));
$('dialog-body').addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  const value = action === 'rotate' ? Number(button.dataset.value) : button.dataset.value;
  const result = transition(state, action, value);
  state = result.state; feedback = result.message;
  $('status').textContent = feedback;
  save(); updateScene(); renderPanel({ action, value: button.dataset.value });
});
$('hint').addEventListener('click', () => { hintLevels[panel] = Math.min(3, hintLevels[panel] + 1); renderPanel(); $('hint').focus(); });
$('close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  // A queued close from the previous inspection may arrive after showModal() reopens it.
  if (dialog.open) return;
  panel = null;
  opener?.focus();
});
$('restart').addEventListener('click', () => confirmDialog.showModal());
$('cancel-restart').addEventListener('click', () => confirmDialog.close());
$('do-restart').addEventListener('click', () => {
  state = initialState(); hintLevels = { log: 0, chart: 0, astrolabe: 0, chest: 0 }; feedback = '';
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* Storage is optional. */ }
  $('status').textContent = 'A new voyage begins. The captain is ashore.';
  updateScene(); confirmDialog.close(); $('restart').focus();
});
updateScene();
