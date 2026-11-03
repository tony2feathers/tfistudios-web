# Steal Blackbeard's Treasure — build receipt and QA guide

## Scope / architecture

Standalone static Astro route: `/games/steal-blackbeards-treasure-archer/` (`src/pages/games/steal-blackbeards-treasure-archer.astro`). No shared layouts or application services are used. The illustrated ship cabin is original inline SVG and CSS in `src/styles/blackbeards-treasure-archer/game.css`; no external images, fonts, network API calls, audio, tracking or player data. Browser interaction is isolated in `src/scripts/blackbeards-treasure-archer/app.mjs`. Pure rules and validation live in `src/scripts/blackbeards-treasure-archer/core.mjs` and are shared with `scripts/verify-blackbeards-treasure-archer.mjs`.

Four labeled cabin hotspots open native modal dialogs: the log, sea chart, astrolabe and chest. The log is an unscored clue, not a completed protection. Three actual solved stages power the progress meter. Each puzzle has three progressively explicit hints, accessible from its inspection panel. Wrong attempts retain a recovery path. Buttons support keyboard activation; native dialogs trap focus and Escape closes them. Restart has its own confirmation dialog. On completion, the chest displays an original inline SVG treasure reveal and an optional public booking link. The prequel and final tease are fictional, not claims about the real-life room's solutions.

Game state is a small transition function with chart route, three bearing indices, key, selected weights and win flag. `validState` rejects incoherent saved states; only a versioned game-owned localStorage key is used, and storage failures fall back to memory-only play. Static template strings render authored UI; no user text is interpreted as HTML.

## QA walkthrough / answers

1. Open Captain's log on the desk. Its sentence instructs **Moon → Reef → Lantern**. Open the wall chart and tap those landmarks in order. Any incorrect choice clears just the current trace. Finishing reveals a hidden chart rubbing: **E → S → W**.
2. Open the brass astrolabe. Rotate its three independent rings from N until they read **E, S, W** left to right (one, two and three presses respectively). Press **Lock the rings**. A brass key enters inventory; wrong alignments do not clear the dials.
3. Open the chest. Its inscription says two offerings must total five, with printed weights Moon 2, Reef 3, Lantern 1. Place **Moon + Reef**, then **Lift the lid**. Wrong weights can be removed; a wrong opening attempt does not consume anything. The treasure and fictional revenge setup appear, with an optional link to the public Blackbeard's Revenge page.
4. Use Start over → Keep playing to test cancel. Use Start over → Start over to test clearing the progress, inventory, solved puzzle state and saved storage. Refresh during play to test restoration when localStorage is available. Test keyboard Tab/Enter/Space and Escape, and browser responsive mode at 390px.

## CASEE comparison publication and independent acceptance

This is normal Archer (`gpt-6-sol`), independently built from the pre-game baseline with the same creative/technical brief and no access to the previous implementation. First return: 546.773 seconds, preserved unchanged. One subsequent Archer correction took 89.057 seconds and guarded a queued native-dialog close event from clearing a newly reopened panel. CASEE reproduced that race in real Chromium before the fix and verified it passed afterward.

For side-by-side publication CASEE moved this submission into the `blackbeards-treasure-archer` file/route namespace and updated imports/documentation only. Game rules, artwork, styling and interaction logic otherwise remain Archer's; the corrected app is byte-identical to its correction return. The previous DeepSeek game and all existing tracked files are unchanged.

The blocked build/browser statements below describe the worker's original **comparison sandbox**, not a site defect or a remaining release blocker. CASEE independently passed the normal `npm run build`, both games' core suites (57 assertions here and 11 for the retained game), `npm run test:ops`, and 87 browser assertions covering desktop/mobile, blocked storage, reload/restart, and keyboard-only completion, plus the deterministic native close/reopen regression. The source review passed; one optional validation issue remains: `in COINS` accepts inherited property names in a manually forged local save. No win bypass or HTML-injection path was found. It is retained explicitly rather than silently improving the first submission.

These checks establish functionality, not deep puzzles or a measured 5–10-minute experience for a first-time human player. Publication and production-browser verification are recorded separately in the PR.

## Verification performed in the original worker sandbox

- `node scripts/verify-blackbeards-treasure-archer.mjs` — **PASS**, `Blackbeard game verification: 57 assertions passed; gates, incorrect attempts, complete chain, repeats, restore and reset.`
- `npm run build` — **BLOCKED by preexisting shared dependency symlink permissions**, `EACCES: permission denied, rmdir '.../workspace/node_modules/.vite/deps'`. No dependency files or permissions were changed.
- Equivalent Astro programmatic build with the same checked-in config and an isolated Vite/Astro cache: `node --input-type=module -e "import { build } from 'astro'; import config from './astro.config.mjs'; await build({ ...config, configFile: false, cacheDir: './.astro-blackbeard-cache', vite: { ...config.vite, cacheDir: './.vite-blackbeard-cache' } });"` — **PASS**. Build log includes `prerendering static routes`, `/games/steal-blackbeards-treasure/index.html (+4ms)` (the original pre-publication route), and `[build] Complete!`; generated client HTML and bundled game script are present in `dist/client/`.

## Limitations / publication gate

The built page returned HTTP 200 and 9903 bytes from a temporary local static HTTP server. Automated browser end-to-end and visual mobile screenshot assertions were unavailable: the installed snap Chromium exits before startup with `snap-confine is packaged without necessary permissions ... cap_dac_override not found`. CASEE should conduct desktop/mobile playthrough before publication. The normal `npm run build` command requires write access to the shared `node_modules/.vite` cache in this isolated evaluation worktree; the isolated-cache build demonstrates the source compiles without modifying shared dependencies. This work is not committed, pushed or deployed. CASEE controls review and publication.
