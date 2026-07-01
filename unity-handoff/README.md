# BioAcoustics Explorer — Unity Handoff Package (MVP)

This is the production handoff for the mobile game series "BioAcoustics Explorer / Wildlife Acoustics Adventures", as refined by the expert panel (Niantic, Supercell, Duolingo, WA trainers, Filament/Planet Birdsong influences, personas, Red/Blue reviews).

**Consensus Series Structure** (from full panel):
- **Flagship (acquisition/virality)**: Song Meter Safari — Hybrid AR / real-world deployment + collection (Niantic + Planet Birdsong).
- **Core (retention + training value)**: Kaleidoscope Quest — Drag-and-drop spectrogram clustering + ID puzzles (direct mirror of real Kaleidoscope Pro workflows; Duolingo streaks + mastery).
- **Deep (loyalty + systemic impact)**: Echoes of the Wild — Habitat / soundscape sim + story decisions (Animal Crossing + conservation storytelling).

**Web MVP Reference** (playable immediately): See the upgraded echoes-wild/index.html in the sibling folder. It prototypes Safari deploy → Kaleidoscope drag-drop puzzle → Echoes restoration flow, with personas, streaks, and strong WA tie-ins.

## Project Goals (from MRD/PRD in full discussion)
- Fun-first, short sessions (1-5+ min), high retention/virality.
- Authentic WA: Song Meter Micro/Mini/SM5BAT language, Kaleidoscope clustering, scheduling, ultrasonic handling, PAM/ARU terms.
- Personas: Adaptive for Dr. Elena Vargas (pro depth), Marcus Thompson (citizen/community), Aisha Patel (educator/family short sessions), Liam Chen (casual gamer addictive loops).
- Real impact: Optional anonymized "data export" simulation, conservation metrics, links to WA Academy/training.
- Ethical F2P + IAPs (skins, expansions, ad-free). No pay-to-win.
- KPIs: D1 retention ~45%+, educational lift (pre/post quiz), WA awareness/conversion, shares.
- "Anything is Possible" tone + joy of discovery.

## Tech Stack (MVP → Production)
- Unity 2022.3 LTS or 6000.x
- AR Foundation + ARCore Extensions / ARKit
- Firebase (Auth + Firestore for guilds/progress, optional)
- Unity IAP + Addressables
- FMOD or advanced Unity Audio for spatial + real sample support (plan licensed WA / public bioacoustic libraries)
- UI Toolkit or Canvas + TextMeshPro

## Project Setup (Week 1 — Engineer)
1. New Unity project from AR Mobile template or AR Foundation samples.
2. Install via Package Manager:
   - AR Foundation
   - ARCore Extensions (Android)
   - ARKit (iOS via XR Plug-in)
   - Input System
   - Firebase SDK for Unity
   - Unity IAP
   - Addressables
   - TextMeshPro
3. Player Settings:
   - Permissions: Camera, Microphone (optional for future), Location (optional for AR real-world).
   - Offline-first: Cache audio/progress locally; sync when online.
4. Folder structure:
   ```
   Assets/
     Scripts/
       Core/ (GameManager, PlayerProfile, AudioManager)
       AR/ (SongMeterAR, DeployController)
       Quest/ (SpectrogramPuzzle, DraggableSegment, ClusterZone)
       Sim/ (EchoesHabitat, SoundscapeMixer)
       UI/ (PersonaSelector, GuildFeed, DailyChallenge)
       Data/ (SpeciesData ScriptableObject, SoundClip)
     Prefabs/
       SongMeter.prefab (visual ARU device)
       SpectrogramSegment.prefab
     Scenes/
       MainARScene.unity (Safari)
       KaleidoscopeLab.unity (Quest)
       EchoesStation.unity (Sim)
     Audio/ (placeholder + real samples later)
   ```
5. Version control + basic CI (Unity Cloud Build or GitHub Actions).

## Key Scripts (Stubs Ready to Expand — See /Scripts/)
The scripts below are production-quality starting points based on the simulated v0.4 prototype progress in the discussion + panel requirements. They implement:
- AR deploy → record → feed clips
- Full drag-drop Kaleidoscope clustering (IDropHandler + scoring exactly as requested)
- Guild + Story cross-progression
- Realistic bat ultrasonic handling (frequency sweeps + filters)
- Persona-adaptive difficulty/hints

Copy the .cs files into Assets/Scripts/...

(Files provided in this folder: AudioManager.cs, SpectrogramPuzzle.cs, DraggableSegment.cs, GameManager.cs, SongMeterAR.cs, etc.)

## Sprint Plan (from refined PRD — 8-12 weeks to MVP)
**Sprint 1 (Weeks 1-3): Safari Core + Foundation**
- AR plane detection + Song Meter placement prefab.
- Schedule UI (dawn/dusk/night toggles, mimic real WA Configurator app).
- "Record" session: Timer + spatial audio trigger (use real or synthesized calls).
- Simple ID collection + feed to inventory.
- Daily quests + streak (local + Firebase).
- Offline support.

**Sprint 2 (Weeks 3-5): Kaleidoscope Quest + Integration**
- Spectrogram viewer generated from audio (Texture2D or plugin).
- Drag-drop clustering puzzle (DraggableSegment + IDropHandler zones for "Bat FM", "Bird trill", "Frog peep", etc.).
- Scoring, replay, "confidence %" feedback like real Kaleidoscope.
- Narrative mystery wrapper ("Restore the soundscape — why are the bats declining?").
- Cross-progress: Safari deployments unlock Quest levels + provide the exact clips.

**Sprint 3 (Weeks 5-8): Polish, Social, Polish, Test**
- Echoes sim layer (simple habitat management driven by Quest accuracy).
- Guild/social feed simulation + shareable reports (text + image).
- Persona system (start selector + dynamic UI depth/hints).
- Badges that conceptually link to WA Academy (webview or deep link).
- IAP stubs, conservation impact dashboard ("Acoustic Health restored: X%").
- Playtest with all 4 personas; A/B difficulty.
- WA audio QA + ethics review for any real samples.

**Post-MVP**:
- Full AR real-world GPS tie-ins (optional).
- Co-op raids on large "datasets".
- New biomes/taxa tied to WA grants.
- Real data export opt-in (anonymized to partner citizen science projects).
- Deeper Academy integration.

## Important Authenticity & Ethics Notes (from WA expert input)
- Always use accurate terms: Song Meter, ARU, PAM, Kaleidoscope clustering / Auto ID, ultrasonic down-conversion for bats, scheduling.
- Real WA recordings preferred (ethically sourced; start with public-domain or partner-provided).
- Citizen science: Make data contribution optional, anonymized, transparent, and clearly "inspired by" or "in partnership with" (coordinate with WA legal/outreach).
- Training value: Every Quest success can surface a short "Field Tip" from Paul Howden-Leach-style trainers or Academy content.
- Avoid oversimplification for pros (Elena persona): Offer "Pro Mode" with more clusters, lower tolerance, exportable CSV stub.

## Next Immediate Engineering Steps
1. Import this handoff into a fresh Unity project (setup above).
2. Create basic SongMeter.prefab (capsule or low-poly recorder model + AudioSource + particle "recording" rings).
3. Wire MainARScene: AR Session Origin + plane manager → tap to deploy → open scheduling panel.
4. Implement SpectrogramPuzzle + DraggableSegment exactly as in the provided .cs (test drag-drop scoring first in a 2D scene).
5. Connect GameManager so Safari "clips" become the draggable segments in Quest.
6. Add local persistence (PlayerPrefs or simple JSON) for streaks/persona/progress.
7. Build test APK/IPA and run on device (test AR on real phone).
8. Hook the web MVP (echoes-wild) as the fastest way to validate mechanics with real users/personas before full Unity polish.

## Files in This Handoff
- README.md (this file — the full context + plan)
- Scripts/AudioManager.cs (realistic calls + bat sweeps + seasonal filters + basic spectrogram stub)
- Scripts/SpectrogramPuzzle.cs (full IDropHandler drag-drop clustering, scoring, guild/story triggers)
- Scripts/DraggableSegment.cs (begin/drag/end handlers + clusterType assignment)
- Scripts/GameManager.cs (core loop orchestration, cross-progress, persona adaptation)
- Scripts/SongMeterAR.cs (deploy + schedule + record simulation)
- Scripts/GuildManager.cs + StoryManager.cs (social + narrative)
- Scripts/SpeciesData.cs (expanded authentic WA-inspired content: bats, birds, frogs + call params)
- Assets/ (placeholder icons, simple Song Meter model description)

This package is ready for a solo engineer or small team to get a playable AR + puzzle prototype in days and full MVP in 8-12 weeks.

"Anything is Possible" — from virtual Song Meter deployment to real discovery and conservation impact, powered by Wildlife Acoustics.

For questions or the next specific feature (e.g., "implement full Firebase guild sync stub" or "add WA Configurator scheduling screen in Unity"), provide the instruction and the engineer can ship the next piece.

## Web Prototype (Fast Validation)
The sibling `echoes-wild` folder contains the living, immediately playable web version that demonstrates the hybrid loop. Use it for quick playtests with the 4 personas while the Unity production build ramps.

Built with love for the real work of Wildlife Acoustics researchers and citizen scientists everywhere.
### Supercell Retention & Progression Expert Subagent (Completed)
Focused on daily hooks, streaks with forgiveness, persona-tuned daily challenges (e.g. "Quick BioBlitz" for Liam, "Family Chorus" for Aisha, "Redundant Sampling" for Elena), expanded badges (display grid, earn on deploys/Quests/health), simulated guild feed + co-op health, pillar XP ladders, ethical IAPs (cosmetics only), D1/D7/D30 flywheel via cross-progress + social + mastery.

Implemented in web MVP: Daily Field Assignment UI + button (persona flavor, forces cycle for rewards), badges strip, guild feed panel (updates on share, boosts Echoes). Logic hooks for rotation and rewards.

For Unity: Expand GameManager daily SOs, badge ScriptableObjects with WA Academy links, GuildManager + Firebase for real social, persona data-driven scoring/hints/rewards, pillar XP bars, streak calendar. Aligns with sprint plan (S3 guild/badges/IAP).

This completes the expert team reviews (Red/Blue + Niantic + Duolingo + Supercell + WA context). The hybrid prototype + handoff now embody the full panel consensus with strong retention/progression.
