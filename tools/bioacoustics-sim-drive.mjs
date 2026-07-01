/**
 * Bioacoustics engineer session driver — domain friction + training rubric.
 */
import { markHabitatDone, scoreBioacousticsRubric, EXPEDITION_REGULAR_TARGET } from './echoes-core.mjs';
import {
  FieldSession,
  RECORD_BUDGET,
  EXPEDITION_RECORD_BUDGET,
  buildSimKeys,
  pickSimIdentification,
} from './field-session.mjs';

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

export function applyBioacousticsDomainFriction({ friction, features, role, playHabit }) {
  if (!features.trainingDisclaimer) friction.push('procedural_not_field_recording');
  if (!features.interactiveSpectrogram) {
    friction.push('quiz_not_analysis');
    friction.push('species_signature_weak');
  }
  if (!features.snrMeter) friction.push('no_snr_display');
  if (!features.kaleidoscopePoc) friction.push('kaleidoscope_gap');
  if (!features.phenologyChart) {
    friction.push('scheduling_not_realistic');
    friction.push('time_of_day_button_not_phenology');
  }
  if (!features.idConfidence) friction.push('no_confidence_score');
  if (!features.clipManifestExport) friction.push('no_export_workflow');
  if (role === 'educator' && !features.demoMode) {
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

  const session = new FieldSession({
    habitat,
    timeOfDay,
    rng,
    dashEnabled: false,
  });
  const friction = [];
  const delights = [];
  const confusion = [];

  const skippedOnboarding = rng() < script.skipOnboarding;
  if (skippedOnboarding) {
    friction.push('skipped_onboarding');
    confusion.push('never_understood_loop');
  }

  applyBioacousticsDomainFriction({ friction, features, role: engineer.role, playHabit: engineer.playHabit });

  let firstRecQuality = null;
  let totalListenTicks = 0;
  let recordsWithoutListen = 0;

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
      const keys = buildSimKeys(st.player, st.animals, st.gameState.timeOfDay, {
        ...script,
        listenRate: listenProb,
      }, script.skill * 0.85, rng, usesMobileHud);
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
    if (ticksBeforeRecord < 6) {
      recordsWithoutListen++;
      friction.push('recorded_without_listen');
    }

    if (features.interactiveSpectrogram && clip.quality >= 0.48) {
      delights.push('spectrogram_peak_tapped');
    }

    const idSkill = script.idSkill * script.skill;
    const chosenId = bossAssist && session.needsBossPhase()
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
    friction: [...new Set(friction)],
    domainFriction: friction.filter((f) =>
      ['procedural_not_field_recording', 'no_snr_display', 'kaleidoscope_gap', 'scheduling_not_realistic',
        'species_signature_weak', 'no_export_workflow', 'integrity_not_snr', 'time_of_day_button_not_phenology',
        'no_confidence_score', 'quiz_not_analysis', 'no_demo_mode', 'listen_cone_too_subtle'].includes(f),
    ),
    integrity: st.integrity,
    logged: st.logged,
    journal: st.journal,
    habitatsDone,
  };
}