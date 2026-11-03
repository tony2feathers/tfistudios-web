# Steal Blackbeard's Treasure

Standalone illustrated browser escape mini-game at `/games/steal-blackbeards-treasure/`. An original fictional prequel to **Blackbeard's Revenge**, not a recreation of the venue's puzzle solutions.

## Provenance and scope

- Game page, pure state module and CSS were implemented by **Archer-DeepSeek**, using the local `deepseek-v4.1-coder` model through the separate Hermes `archer-deepseek` profile. No cloud coding fallback was used.
- CASEE supplied the brief, diagnosed runtime/resource failures, independently reviewed and exercised the result, and authored the regression checks, this documentation and release packaging. Passing tests is not evidence of unattended coding reliability: the local worker needed multiple directed passes and exhausted its turn/context budgets.
- Artwork is original inline SVG with CSS lighting/glows/animation. No third-party image assets, external fonts, generated-image service, game backend or paid inference is required to play.
- Existing homepage, Minesweeper, private operations routes, middleware, shared layouts, dependencies and hosting configuration are unchanged.

## Files

- `src/pages/games/steal-blackbeards-treasure.astro`: scene, accessible hotspot buttons, clue dialog and browser interactions.
- `src/scripts/blackbeards-treasure/game-core.mjs`: puzzle sequence, hints, item use, escape, restart and saved-state validation.
- `src/styles/blackbeards-treasure/game.css`: game-only visual styling and responsive layout.
- `scripts/verify-blackbeards-treasure.mjs`: CASEE's independent core regression checks.

## Play and controls

Select the highlighted brass hotspot to inspect the current clue. Close the dialog with its button or Escape; solve using the journal controls. Standard buttons/inputs support keyboard focus and activation. The Hint button progresses through three levels, with the last revealing the answer. There is no timer or wrong-answer lockout.

After solving all four protections, explicitly **Use crowbar / open chest**, then **Escape with treasure**. Solving the last puzzle alone does not open the chest or win. Restart clears this game's saved run and resets its inventory, chest and progress.

### Walkthrough — spoilers

1. Night-watch logbook: watches give 2, 5, 3; enter **253**.
2. Reef chart: reverse the 330-degree cove-to-chest leg to return from the chest to the cove: **150 degrees**.
3. Rigging: high tide 8 minus low tide 3 gives five knots; choose **Rope D** to obtain the crowbar.
4. Gangway: return watch 8 minus current watch 3 gives five bells; choose **Aft** to secure the escape route.
5. Use the crowbar to open the chest and receive gold coins, rubies, silver chalice and captain's seal exactly once. Then escape.

## Saved state and privacy

This game uses only its own browser localStorage key, `blackbeards-treasure-v2`. Valid progress, chest opening and win state survive reload; malformed or obsolete saves are ignored. Unavailable storage is nonfatal: play continues in memory. There are no player accounts, analytics submissions, tracking integrations or server-side game writes. Restart does not clear unrelated site storage. The surrounding website's own hosting behavior is independent.

## Verification receipts

CASEE executed these against the actual local source:

```sh
node scripts/verify-blackbeards-treasure.mjs
npm run test:ops
npm run build
```

Both the independently maintained core fixture and the packaged regression script passed **11/11 checks**. The site production build completed and prerendered the game route; existing operations verification passed.

Real Playwright browser QA against the built static output passed **101 assertions** across desktop 1440px, mobile 390px and a 320px reduced-motion/blocked-storage case. It covered wrong clues and answers, three hints, item acquisition, reload during puzzles, closed/open chest reload without premature win, explicit escape, win persistence, restart, a second complete run, malformed-save recovery, no horizontal overflow, and no JavaScript page errors. This is browser-emulated mobile evidence, not physical-device acceptance or proof of all assistive-technology behavior.

A separate complete keyboard-only play-through also passed using Tab, Enter, typed answers and Escape, without mouse activation. Retained local evidence (outside the repository): `TFI/evaluations/archer-deepseek/blackbeard-browser-qa.mjs`, `blackbeard-browser-qa-result.json`, screenshots and worker transcripts. Production access and behavior must be verified separately after deployment; this source receipt does not claim that deployment has happened.

## Limitations

A deliberately small single-player trial, not a full escape-room platform. Client-side answers and progress are inspectable; there is no anti-cheat, leaderboard, multiplayer, cloud save, audio system or service-worker/offline installation. Intro and layout polish can evolve independently. Reduced-motion support and semantic controls do not constitute a formal accessibility certification.
