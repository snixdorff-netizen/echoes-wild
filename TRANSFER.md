# ECHOES / echoes-wild — Team Transfer Instructions

**Document date:** July 2026  
**Current build:** `playtest-v1.7-jul2026`  
**Latest commit:** `f9fa019` (see `git log`)  
**Prepared for:** Incoming engineering / design / playtest team  
**Sponsor / founder context:** Stuart Nixdorff — board director (Ada IQ), operator (Intervals.ai), founder (ClaimRestored.ai). This prototype validates a Wildlife Acoustics–inspired bioacoustics game series before Unity production.

---

## 1. What you are receiving

A **self-contained browser game** (`index.html`) plus a **Node.js tooling layer** for unit tests, honest player simulation, and Playwright smoke verification. It is **not** a full trilogy (Safari / Kaleidoscope / Echoes) — the shipped experience is **Echoes of the Wild** field-loop only. README and `unity-handoff/` describe a broader vision; treat this repo as the **living web MVP** for that vision’s Echoes pillar.

| Asset | Purpose |
|-------|---------|
| `index.html` | Shipped game (~128KB source; embeds base64 hiker sprites; procedural Web Audio) |
| `tools/` | Shared game logic, sim drivers, browser build, war-room analysis |
| `test/` | 28 unit/parity tests |
| `PLAYTEST.md` | 20-person human playtest kit (recruitment, script, survey) |
| `unity-handoff/` | C# stubs + sprint plan for native AR/mobile port (separate track) |
| `.scratch/` | Local-only evidence outputs (gitignored); regenerate with npm scripts |

**Live deployment (GitHub Pages):**  
https://snixdorff-netizen.github.io/echoes-wild/

**Source repository:**  
https://github.com/snixdorff-netizen/echoes-wild

---

## 2. Executive summary — current state

### Shipped (P0 backlog — all complete as of v1.7)

| ID | Feature |
|----|---------|
| P0-01 | Forced interactive first-clip tutorial (`echoes-tutorial-v2` in localStorage) |
| P0-02 | Grip/charge dash **disabled** until expedition 2 (`FieldSession.dashEnabled`) |
| P0-03 | Progressive disclosure — `#advanced-bar` hidden until first species logged |
| P0-04 | Vector species silhouettes on canvas (`drawSpeciesSilhouette`) |
| P0-05 | Stereo warmth audio (`computeCallWarmth`) + HUD signal % |
| P0-06 | Interactive spectrogram — tap key frequency peak before ID unlock |

### North star (product)

General-public **novice** players: **≥4.5 would-recommend** and **≥70% complete one habitat** in ~18 minutes.

### Latest **simulation** metrics (not human playtest — see §7)

| Cohort | Fun | Recommend | Habitat completion |
|--------|-----|-----------|------------------|
| Red novices (`war-room.mjs`) | 9.30/10 | 4.59/5 | 75% |
| Expert panel novice sim | — | 4.01/5 | 46% |
| Blue recruitment skill | 9.93/10 | 4.88/5 | 91% |

**Caveat:** Sim bots benefit from shipped UX aids (tutorial, peaks, ★ labels). Run **real** 20-person protocol in `PLAYTEST.md` before trusting retention or App Store readiness.

### Known README drift

- Root `README.md` and `PLAYTEST.md` still mention v1.4.x and features (Safari deploy, Kaleidoscope drag-drop) **not in** `index.html`.
- **Authoritative shipped state:** `index.html` → `BUILD_VERSION`, `tools/readShippedFeaturesFromHtml()` in `echoes-core.mjs`, and `.scratch/expert-backlog.md` (regenerate via `npm run expert-war-room`).

---

## 3. Architecture (read this first)

```
┌─────────────────────────────────────────────────────────────┐
│  index.html (browser)                                       │
│  • Canvas render + Web Audio procedural calls               │
│  • UI: dock, tutorial, identify panel, mission bar          │
│  • Inlined PURE_HELPERS (auto-injected markers)             │
│  • Loads tools/echoes-core.browser.js (generated)           │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  tools/echoes-core.mjs — pure logic (tested, no DOM)        │
│  scoring, ID, integrity, spectrogram peaks, rubric, features│
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  tools/field-session.mjs — FieldSession class               │
│  tick/move/listen/record/identify; dash gated               │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
  sim-drive.mjs    critical-sim-drive.mjs   browser-verify.mjs
  (skilled bots)   (novice/red team)        (Playwright DOM)
```

### Build pipeline (mandatory before test)

`npm test` runs `build:browser` which:

1. Generates `tools/echoes-core.browser.js` from `echoes-core.mjs` + `field-session.mjs`
2. **Injects** pure helper functions into `index.html` between `<!-- PURE_HELPERS_START -->` / `<!-- PURE_HELPERS_END -->`

**Never edit `echoes-core.browser.js` by hand.** Edit `echoes-core.mjs` or `field-session.mjs`, then rebuild.

### Single source of truth

- **Gameplay state machine:** `FieldSession` in `field-session.mjs` — browser uses `window.__echoesSession` synced from `index.html` each frame.
- **Recording / ID math:** Must match between inlined helpers in `index.html` and `echoes-core.mjs` (enforced by `test/shipped-loop.test.mjs`).

---

## 4. Repository map

| Path | Owner / notes |
|------|----------------|
| `index.html` | Primary product; ~1.7k lines; Tailwind CDN + Font Awesome CDN |
| `tools/echoes-core.mjs` | Pure helpers, species data, rubric, feature flags, spectrogram peaks |
| `tools/field-session.mjs` | `FieldSession`, `RECORD_BUDGET=8`, segment scripts |
| `tools/build-browser-core.mjs` | Browser bundle + HTML injection |
| `tools/sim-drive.mjs` | Skilled 100-player driver |
| `tools/critical-sim-drive.mjs` | Novice/red-team driver |
| `tools/war-room.mjs` | Red vs blue + pre-mortem → `.scratch/war-room-report.json` |
| `tools/expert-war-room.mjs` | Expert panel + 22-item backlog → `.scratch/expert-backlog.md` |
| `tools/browser-verify.mjs` | Playwright: audio gate → listen → record → peak → ★ ID |
| `tools/run-sim-twice.mjs` | Dual-seed sim for evidence |
| `tools/collect-evidence.mjs` | Copies deliverables + manifest (use `ECHOES_SCRATCH`) |
| `test/*.test.mjs` | 28 tests — run on every change |
| `unity-handoff/` | Parallel Unity track — not wired to web build |
| `PLAYTEST.md` | Human playtest ops (outdated version string; process still valid) |

---

## 5. Onboarding checklist (incoming team)

### Day 0 — Access

- [ ] GitHub repo access: `snixdorff-netizen/echoes-wild` (transfer or add collaborators)
- [ ] GitHub Pages admin (Settings → Pages) if changing live URL
- [ ] Optional: Netlify/Vercel if moving off GitHub Pages
- [ ] No backend, DB, or API keys required — fully static + localStorage

### Day 1 — Run locally

```bash
git clone https://github.com/snixdorff-netizen/echoes-wild.git
cd echoes-wild
npm install                    # installs playwright only
npm test                       # build + 28 tests (~1s)
python3 -m http.server 8765    # open http://localhost:8765/
```

Play through **first visit** (clear site data or use incognito):

1. Onboarding modal → audio gate → interactive tutorial  
2. Hold **Listen** 2s → **Record** → tap spectrogram **key peak** → **★ species**  
3. Log 6/6 for Field Report

### Day 2 — Tooling

```bash
npm run war-room              # red/blue 100-player report
npm run expert-war-room       # backlog + expert scores
npm run verify                # Playwright (needs Chromium; first run may download)
npm run verify:all            # test + sim + verify + evidence
```

Evidence bundle (for CI or handoff audits):

```bash
ECHOES_SCRATCH=/tmp/echoes-evidence npm run verify:all
# → /tmp/echoes-evidence/deliverables/echoes-wild/
# → CHANGED_FILES.json, sim-report.json, launch.png, etc.
```

### Day 3 — Read generated artifacts

After `npm run expert-war-room`, open:

- `.scratch/expert-backlog.md` — prioritized P1–P3 work  
- `.scratch/war-room-summary.md` — one-page metrics  
- `.scratch/launch.png` — browser verify screenshot  

---

## 6. Deploy / release

### GitHub Pages (current)

- Branch: `main`  
- Root: repo root (`index.html` at `/`)  
- Push to `main` → live within ~1–2 minutes  

### Pre-release gate (recommended — not yet in CI)

1. `npm test` — 28/28 pass  
2. `npm run verify` — Playwright exit 0  
3. `npm run war-room` — red novice recommend ≥ 4.0 (currently ~4.59)  
4. Bump `BUILD_VERSION` in `index.html` and help modal version string  
5. Regenerate `expert-war-room` and archive `.scratch/` with release tag  

### Version strings to keep in sync

- `index.html`: `const BUILD_VERSION = 'playtest-v1.7-jul2026'`
- Help modal footer version  
- Desktop hint span (`v1.7 — …`)  
- `tools/browser-verify.mjs` log header (cosmetic)

---

## 7. Simulation vs human playtest (critical)

The repo includes **honest** bot rubrics (`scoreSessionRubric` in `echoes-core.mjs`) that penalize:

- Skipped tutorial / onboarding  
- Controls overwhelm, bad graphics (pre–vector art)  
- Never using listen, identify confusion, quit before payoff  

Bots **do not** replace humans. They regress UX changes quickly.

**Required before major release:** Execute `PLAYTEST.md` with 20 real users (5 per segment). Compare:

- Human completion % vs sim  
- Human recommend vs `war-room` red cohort  
- Mobile Safari / Chrome Android friction (sim assumes desktop HUD)

---

## 8. Game design reference (for designers)

### Core loop

Explore → **Listen** (hold, directional cone) → **Record** (while listening) → **Tap spectrogram peak** → **Identify** (★ when fair+ clip) → journal + integrity → 6/6 = Field Report

### Habitats & species (6 per habitat tab)

Forest / Marsh / Canyon — species list in `index.html` `species` array and `echoes-core.mjs` `SPECIES`. Time-of-day gating: dawn / day / dusk / night.

### Personas (localStorage `echoes-persona`)

`liam` (casual), `aisha` (educator), `marcus` (citizen scientist), `elena` (pro) — affects hint strings via `personaHint()`, not UI density yet (P3-03).

### localStorage keys

| Key | Meaning |
|-----|---------|
| `echoes-tutorial-v2` | First-clip tutorial completed |
| `echoes-onboarding-v1` | 3-step modal completed |
| `echoes-habitats-done` | JSON array of cleared habitats |
| `echoes-expedition-level` | Unlocks dash at ≥2 |
| `echoes-persona` | Selected persona |
| `echoes-best-integrity` | Per-habitat bests |

---

## 9. Prioritized backlog for next team (P1 first)

Regenerate full list: `npm run expert-war-room` → `.scratch/expert-backlog.md`

### P1 — Recommended next sprint

| ID | Item | Effort |
|----|------|--------|
| P1-08 | CI gate: novice recommend ≥4.0 in GitHub Actions | S |
| P1-01 | Time-of-day as puzzle (activity chart), not arbitrary T button | M |
| P1-06 | Full-bleed mobile canvas; dock-only on phone | S |
| P1-03 | Educator demo/projector mode (2× cone, labels) | S |
| P1-07 | Shareable spectrogram **image** card (viral loop) | M |

### P2 — Vision gap (README promises)

- Song Meter Safari deploy minigame  
- Kaleidoscope drag-drop clustering POC  
- Habitat ambient beds, field partner radio, progression map  

See `unity-handoff/README.md` for native implementation plan.

---

## 10. Unity parallel track

`unity-handoff/` contains C# stubs (`GameManager`, `SpectrogramPuzzle`, `SongMeterAR`, etc.) and an 8–12 week sprint plan. **Not synchronized** with web `FieldSession` — web is ahead on FTUE; Unity is ahead on drag-drop spectrogram **design** only.

**Recommendation:** Keep web as rapid UX lab; port proven loops to Unity after human playtest confirms completion/recommend thresholds.

---

## 11. Technical debt & gotchas

1. **CDN dependency:** Tailwind + Font Awesome loaded from CDN — offline double-click works but styling may flash; local server preferred.  
2. **index.html size:** Large base64 hiker JPEGs still embedded; species use vector canvas now.  
3. **Mouse on canvas:** Still sets `mouse.down` for listen; dash disabled but listen path shares mouse state.  
4. **Browser verify test hook:** `window.__echoesUnlockIdentify()` exists for CI when peak tap flaky — do not expose to production users as primary path.  
5. **Parent workspace:** If nested inside a monorepo harness, `CHANGED_FILES` at parent may not track `echoes-wild/` — use `ECHOES_SCRATCH` + `collect-evidence.mjs`.  
6. **PLAYTEST.md / README:** Marketing copy describes trilogy + v1.4 — update or add banner pointing to `TRANSFER.md`.

---

## 12. Contacts & stakeholder context

| Role | Notes |
|------|-------|
| **Stuart Nixdorff** | snixdorff@gmail.com — product owner, playtest sponsor |
| **Wildlife Acoustics** | Inspiration only; not an official partnership in this prototype |
| **Ada IQ / Intervals.ai / ClaimRestored** | Separate active ventures — do not conflate issue trackers |

---

## 13. Suggested 30-day plan for receiving team

| Week | Focus |
|------|-------|
| 1 | Clone, run tests, play v1.7, run 5 internal playtests using `PLAYTEST.md` script |
| 2 | Update README/PLAYTEST version drift; add GitHub Actions (`npm test` + `npm run war-room`) |
| 3 | P1 sprint: mobile full-bleed + time-of-day chart + shareable spectrogram PNG |
| 4 | Second 20-user playtest; compare human vs sim; decide Unity port vs web iteration |

---

## 14. Quick command reference

```bash
npm test                 # build browser core + 28 tests
npm run build:browser    # regenerate echoes-core.browser.js + inject helpers
npm run sim              # dual-seed 100-player sim → .scratch/sim-report.json
npm run war-room         # red vs blue war room
npm run expert-war-room  # expert backlog + novice snapshot
npm run verify           # Playwright smoke test
npm run evidence         # collect deliverables to ECHOES_SCRATCH
python3 -m http.server 8765   # local play
```

---

## 15. Handoff sign-off

| Item | Status at transfer |
|------|-------------------|
| Repo pushed to GitHub | ✅ `main` @ `f9fa019` |
| GitHub Pages live | ✅ snixdorff-netizen.github.io/echoes-wild |
| P0 backlog | ✅ 6/6 shipped (v1.7) |
| Unit tests | ✅ 28/28 |
| Browser verify | ✅ Passing (v1.7) |
| Human 20-user playtest | ⬜ Not run by automation — **team action** |
| CI/CD pipeline | ⬜ Local scripts only |
| README accuracy | ⚠️ Drift — use this doc + `BUILD_VERSION` |

**Receiving team lead:** sign below when access verified and local `npm run verify:all` passes.

```
Name: _________________________  Date: ___________
GitHub access confirmed: [ ]   Local verify passed: [ ]
```

---

*This document captures project state as of playtest v1.7 (July 2026). Regenerate metrics and backlog before major releases.*