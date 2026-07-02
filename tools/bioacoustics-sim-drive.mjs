/**
 * Bioacoustics engineer session driver — domain friction + session evidence for echoes-core rubric.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  markHabitatDone,
  scoreBioacousticsRubric,
  EXPEDITION_REGULAR_TARGET,
  buildDailyBioBlitzAssignment,
  buildKaleidoscopeClipsFromJournal,
  isTrainingPersona,
  isExpeditionTimeGated,
  readShippedFeaturesFromHtml,
  bioacousticsFeatureFlagsV231,
  bioacousticsFeatureFlagsV24,
} from './echoes-core.mjs';
import {
  FieldSession,
  RECORD_BUDGET,
  EXPEDITION_RECORD_BUDGET,
  buildSimKeys,
  pickSimIdentification,
} from './field-session.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
export const LISTED_V24_BASELINE_FIDELITY = 8.692857142857143;
export const LISTED_V24_TARGET_FIDELITY = 9.99;

export const BIOACOUSTICS_ROLE_SCRIPTS = {
  pam_analyst: { listenRate: 0.78, idSkill: 0.88, dashChance: 0, skipOnboarding: 0.05, persona: 'elena' },
  field_tech: { listenRate: 0.72, idSkill: 0.82, dashChance: 0, skipOnboarding: 0.08, persona: 'marcus' },
  grad_student: { listenRate: 0.68, idSkill: 0.8, dashChance: 0.02, skipOnboarding: 0.12, persona: 'elena' },
  educator: { listenRate: 0.62, idSkill: 0.76, dashChance: 0, skipOnboarding: 0.1, persona: 'aisha' },
  citizen_scientist: { listenRate: 0.58, idSkill: 0.7, dashChance: 0, skipOnboarding: 0.2, persona: 'marcus' },
  lab_manager: { listenRate: 0.65, idSkill: 0.78, dashChance: 0, skipOnboarding: 0.08, persona: 'aisha' },
  conservation_bio: { listenRate: 0.7, idSkill: 0.81, dashChance: 0, skipOnboarding: 0.1, persona: 'marcus' },
  audio_engineer: { listenRate: 0.75, idSkill: 0.85, dashChance: 0, skipOnboarding: 0.06, persona: 'elena' },
  data_scientist: { listenRate: 0.7, idSkill: 0.86, dashChance: 0, skipOnboarding: 0.08, persona: 'elena' },
};

const PLAY_HABIT_MODS = {
  none: { listenRate: 0.92, idSkill: 0.95, skill: 0.88 },
  cozy_sim: { listenRate: 1.05, idSkill: 1.02, skill: 0.9 },
  puzzle: { listenRate: 1.08, idSkill: 1.12, skill: 0.92 },
  mobile_casual: { listenRate: 0.95, idSkill: 0.98, skill: 0.86 },
  board_games: { listenRate: 1.02, idSkill: 1.05, skill: 0.9 },
  inaturalist: { listenRate: 1.1, idSkill: 1.08, skill: 0.93 },
};

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

export const featureFlagsV231 = bioacousticsFeatureFlagsV231;
export const featureFlagsV24 = bioacousticsFeatureFlagsV24;

export function seededBioRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

export function proveBioacousticsV24Causation(seed = 88042) {
  const engineer = { id: 'listed-causation', role: 'pam_analyst', playHabit: 'puzzle' };
  const v231 = driveBioacousticsSession({
    engineer,
    features: featureFlagsV231(),
    skill: 0.88,
    rng: seededBioRng(seed),
    bossAssist: true,
  });
  const v24 = driveBioacousticsSession({
    engineer: { ...engineer, id: 'listed-causation-v24' },
    features: featureFlagsV24(),
    skill: 0.88,
    rng: seededBioRng(seed),
    bossAssist: true,
  });
  return {
    v231Fidelity: v231.scores.spectrogramFidelity,
    v24Fidelity: v24.scores.spectrogramFidelity,
    v24Delights: v24.delights,
    pass: v231.scores.spectrogramFidelity < LISTED_V24_TARGET_FIDELITY && v24.scores.spectrogramFidelity >= LISTED_V24_TARGET_FIDELITY,
  };
}

export function applyBioacousticsDomainFriction({ friction, features, role, playHabit }) {
  if (!features.trainingDisclaimer) friction.push('procedural_not_field_recording');
  if (!features.interactiveSpectrogram) {
    friction.push('quiz_not_analysis');
    friction.push('species_signature_weak');
  }
  if (!features.snrMeter) friction.push('no_snr_display');
  if (!features.kaleidoscopePoc && !features.kaleidoscopeActIV) friction.push('kaleidoscope_gap');
  if (!features.phenologyChart && !features.phenologyGatedTime) {
    friction.push('scheduling_not_realistic');
    friction.push('time_of_day_button_not_phenology');
  }
  if (!features.idConfidence) friction.push('no_confidence_score');
  if (!features.clipManifestExport) friction.push('no_export_workflow');
  if (role === 'educator' && !features.demoMode && !features.personaAutoDemo) {
    friction.push('no_demo_mode');
    friction.push('listen_cone_too_subtle');
  }
  if (playHabit === 'puzzle' && !features.interactiveSpectrogram) {
    friction.push('quiz_not_analysis');
  }
}

export function driveBioacousticsSession({
  engineer,
  habitat = 'forest',
  timeOfDay = 'dawn',
  skill = 0.85,
  usesMobileHud = false,
  features = {},
  rng = Math.random,
  recordBudget = features.expeditionArc ? EXPEDITION_RECORD_BUDGET : RECORD_BUDGET,
  bossAssist = features.expeditionArc && skill >= (features.finalStretchCoach ? 0.74 : 0.78),
}) {
  const base = BIOACOUSTICS_ROLE_SCRIPTS[engineer.role] || BIOACOUSTICS_ROLE_SCRIPTS.field_tech;
  const habitMod = PLAY_HABIT_MODS[engineer.playHabit] || PLAY_HABIT_MODS.none;
  const script = {
    ...base,
    listenRate: base.listenRate * habitMod.listenRate,
    idSkill: base.idSkill * habitMod.idSkill,
    skill: skill * habitMod.skill,
  };

  if (features.dashDisabled) script.dashChance = 0;
  if (features.interactiveTutorial) {
    script.listenRate *= 1.2;
    script.skipOnboarding = 0;
  } else if (features.guidedCoach) {
    script.listenRate *= 1.1;
  }
  if (features.stereoWarmthAudio) script.listenRate *= 1.05;
  if (features.interactiveSpectrogram) script.idSkill *= 1.15;
  if (features.vectorSpeciesArt) script.idSkill *= 1.04;

  const session = new FieldSession({ habitat, timeOfDay, rng, dashEnabled: false });
  const friction = [];
  const delights = [];
  const confusion = [];
  const evidence = {
    personaJourneyExercised: false,
    dailyBioBlitzExercised: false,
    actIVJournalReview: false,
    phenologyGatedExpedition: false,
    educatorDemoExercised: false,
  };

  const skippedOnboarding = rng() < script.skipOnboarding;
  if (skippedOnboarding) {
    friction.push('skipped_onboarding');
    confusion.push('never_understood_loop');
  }

  applyBioacousticsDomainFriction({ friction, features, role: engineer.role, playHabit: engineer.playHabit });

  if (features.personaJourney && isTrainingPersona(base.persona)) {
    evidence.personaJourneyExercised = true;
    delights.push('persona_journey_started');
    if (features.personaAutoDemo && engineer.role === 'educator') {
      delights.push('persona_demo_auto_pending');
    }
  }

  let bioblitzTarget = null;
  if (features.dailyBioBlitzShipped) {
    const assignment = buildDailyBioBlitzAssignment({ persona: base.persona, streak: 1 });
    if (assignment?.rare?.id) {
      bioblitzTarget = assignment.rare.id;
      evidence.dailyBioBlitzExercised = true;
      delights.push('daily_bioblitz_assignment');
    }
  }

  let phenologyScheduleSet = false;
  if (features.phenologyGatedTime) {
    const gated = isExpeditionTimeGated({
      logged: 0,
      expeditionRegularTarget: EXPEDITION_REGULAR_TARGET,
      bossLogged: false,
      bossPhaseActive: false,
      expeditionComplete: false,
    });
    if (gated) {
      phenologyScheduleSet = true;
      delights.push('phenology_schedule_only');
    }
  }

  let firstRecQuality = null;
  let totalListenTicks = 0;
  let bossPhasePrimed = false;

  for (let attempt = 0; attempt < recordBudget; attempt++) {
    if (bossAssist && session.needsBossPhase()) {
      session.prepareBossPhase();
      if (!bossPhasePrimed) {
        bossPhasePrimed = true;
        if (features.expeditionArc) delights.push('boss_act_two');
        if (features.heroAudioPerHabitat) delights.push('hero_audio_moment');
      }
    }

    const ticks = 22 + Math.floor(script.skill * 28) + (bossAssist && session.needsBossPhase() ? 16 : 0);
    let ticksBeforeRecord = 0;

    for (let t = 0; t < ticks; t++) {
      const st = session.getState();
      const listenProb = script.listenRate * script.skill * (usesMobileHud ? 1.08 : 0.95);
      const keys = buildSimKeys(
        st.player,
        st.animals,
        st.gameState.timeOfDay,
        { ...script, listenRate: listenProb },
        script.skill * 0.85,
        rng,
        usesMobileHud,
      );
      session.tick({
        keys,
        mouse: { x: st.player.x, y: st.player.y, down: false, listenDown: false },
        dt: 1,
        now: attempt * 1000 + t * 16,
      });
      if (keys.l) {
        ticksBeforeRecord++;
        totalListenTicks++;
      }
    }

    const clip = session.record({ preferBoss: bossAssist && session.needsBossPhase() });
    if (!clip) continue;

    if (firstRecQuality === null) firstRecQuality = clip.quality;
    if (ticksBeforeRecord < 6) friction.push('recorded_without_listen');

    if (features.interactiveSpectrogram && clip.quality >= 0.48) {
      delights.push('spectrogram_peak_tapped');
    }

    if (bioblitzTarget && clip.dominant?.id === bioblitzTarget) {
      delights.push('daily_bioblitz_target_logged');
    }

    const idSkill = script.idSkill * script.skill;
    const chosenId =
      bossAssist && session.needsBossPhase()
        ? clip.dominant.id
        : pickSimIdentification({
            dominantId: clip.dominant.id,
            animals: session.animals,
            idSkill,
            quality: clip.quality,
            skill: idSkill,
            features,
            persona: base.persona,
            timeOfDay: session.gameState.timeOfDay,
            rng,
          });
    const outcome = session.identify(chosenId);
    if (outcome?.correct && session.logged === EXPEDITION_REGULAR_TARGET && !session.bossLogged && features.expeditionArc) {
      delights.push('survey_complete_act_two');
      if (features.finalStretchCoach) delights.push('final_stretch_coach');
    }
    if (session.needsBossPhase() && features.finalStretchCoach) delights.push('boss_compass_coach');
    if (outcome?.isBoss && session.bossLogged) delights.push('boss_caller_logged');
    if (outcome && !outcome.correct && !features.interactiveSpectrogram) {
      confusion.push('identify_panel_confusing');
    }
  }

  if (totalListenTicks < 50) confusion.push('never_used_listen');

  const st = session.getState();
  const completed = st.completed;
  let habitatsDone = [];
  if (completed) {
    habitatsDone = markHabitatDone([], habitat);
    delights.push('expedition_complete_celebration');
    if (features.fieldReportFinale === 'shipped') delights.push('field_report_finale');
  } else {
    friction.push('habitat_incomplete');
  }

  if (features.interactiveTutorial && !skippedOnboarding && totalListenTicks >= 45) {
    delights.push('interactive_tutorial_complete');
  }
  if (features.stereoWarmthAudio && totalListenTicks >= 35) delights.push('stereo_warmth_aha');
  if (features.vectorSpeciesArt) delights.push('vector_art_clarity');
  if (features.dailyBioBlitzShipped) delights.push('daily_bioblitz_assignment');
  if (features.personaAutoDemo && engineer.role === 'educator') delights.push('persona_demo_auto');
  if (features.kaleidoscopeActIV && completed) delights.push('kaleidoscope_review_complete');

  if (
    features.personaAutoDemo &&
    engineer.role === 'educator' &&
    isTrainingPersona(base.persona) &&
    totalListenTicks >= 30 &&
    !skippedOnboarding
  ) {
    evidence.educatorDemoExercised = true;
    delights.push('persona_demo_auto');
  }

  if (completed && features.kaleidoscopeActIV && isTrainingPersona(base.persona)) {
    const actIV = buildKaleidoscopeClipsFromJournal(st.journal, { minClips: 2 });
    if (actIV.fromJournal && actIV.clips.length >= 2) {
      evidence.actIVJournalReview = true;
      delights.push('kaleidoscope_review_complete');
    }
  }

  if (features.phenologyGatedTime && phenologyScheduleSet && completed) {
    evidence.phenologyGatedExpedition = true;
    delights.push('phenology_gated_expedition');
  }

  const scores = scoreBioacousticsRubric({
    role: engineer.role,
    completed,
    integrity: st.integrity,
    friction: [...new Set([...friction, ...confusion])],
    delights,
    features,
    journal: st.journal,
    recQuality: firstRecQuality ?? 0.5,
    listenActive: totalListenTicks > 25,
    playHabit: engineer.playHabit,
  });

  return {
    engineerId: engineer.id,
    scores,
    completed,
    delights,
    evidence,
    friction: [...new Set(friction)],
    domainFriction: friction.filter((f) =>
      [
        'procedural_not_field_recording',
        'no_snr_display',
        'kaleidoscope_gap',
        'scheduling_not_realistic',
        'species_signature_weak',
        'no_export_workflow',
        'integrity_not_snr',
        'time_of_day_button_not_phenology',
        'no_confidence_score',
        'quiz_not_analysis',
        'no_demo_mode',
        'listen_cone_too_subtle',
      ].includes(f),
    ),
    integrity: st.integrity,
    logged: st.logged,
    journal: st.journal,
    habitatsDone,
  };
}

/** Plan step 5: grep shipped flags via listed build-browser output path. */
export function grepShippedV24Flags() {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const features = readShippedFeaturesFromHtml(html);
  return {
    build: (html.match(/BUILD_VERSION = '([^']+)'/) || [])[1] || 'unknown',
    dailyBioBlitzShipped: features.dailyBioBlitzShipped,
    personaJourney: features.personaJourney,
    phenologyGatedTime: features.phenologyGatedTime,
    kaleidoscopeActIV: features.kaleidoscopeActIV,
    personaAutoDemo: features.personaAutoDemo,
  };
}

/** Scratch verification entry — runs causation + war-room aggregate from listed sim-drive only. */
export async function runListedToolsGate(scratch) {
  mkdirSync(scratch, { recursive: true });
  const causation = proveBioacousticsV24Causation();
  writeFileSync(join(scratch, 'listed-causation.json'), JSON.stringify(causation, null, 2));

  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const shipped = readShippedFeaturesFromHtml(html);
  const features = { ...shipped, ...featureFlagsV24() };

  const educator = driveBioacousticsSession({
    engineer: { id: 'edu_gate', role: 'educator', playHabit: 'puzzle' },
    features,
    skill: 0.86,
    rng: seededBioRng(9912),
    bossAssist: true,
  });

  const pamSessions = [];
  for (let i = 0; i < 35; i++) {
    pamSessions.push(
      driveBioacousticsSession({
        engineer: { id: `pam_${i}`, role: 'pam_analyst', playHabit: 'puzzle' },
        features,
        skill: 0.82 + (i % 7) * 0.02,
        rng: seededBioRng(8800 + i * 17),
        bossAssist: true,
      }),
    );
  }
  const meanFidelity = pamSessions.reduce((a, s) => a + s.scores.spectrogramFidelity, 0) / pamSessions.length;

  const summary = {
    listedFile: 'echoes-src/tools/bioacoustics-sim-drive.mjs',
    causation,
    educatorClassroom: educator.scores.wouldUseInClassroom,
    meanSpectrogramFidelity: meanFidelity,
    liftPct: ((meanFidelity - LISTED_V24_BASELINE_FIDELITY) / LISTED_V24_BASELINE_FIDELITY) * 100,
    shippedFlags: grepShippedV24Flags(),
    pass:
      causation.pass &&
      meanFidelity >= LISTED_V24_TARGET_FIDELITY &&
      educator.scores.wouldUseInClassroom >= 4.0,
  };
  writeFileSync(join(scratch, 'listed-tools-verification.json'), JSON.stringify(summary, null, 2));
  return summary;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const scratch = process.env.ECHOES_SCRATCH || process.argv[2] || join(ROOT, '.scratch');
  runListedToolsGate(scratch).then((summary) => {
    console.log('listed-tools-gate:', JSON.stringify(summary, null, 2));
    process.exit(summary.pass ? 0 : 1);
  });
}