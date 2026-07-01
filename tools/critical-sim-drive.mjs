/**
 * Critical / novice 100-player driver — models confused first-time humans (red team).
 */
import { markHabitatDone, scoreSessionRubric } from './echoes-core.mjs';
import {
  FieldSession,
  RECORD_BUDGET,
  buildSimKeys,
  pickSimIdentification,
} from './field-session.mjs';

const NOVICE_SCRIPTS = {
  naturalist: { listenRate: 0.55, idSkill: 0.72, dashChance: 0, skipOnboarding: 0.15 },
  educator: { listenRate: 0.48, idSkill: 0.68, dashChance: 0, skipOnboarding: 0.25 },
  gamer: { listenRate: 0.35, idSkill: 0.75, dashChance: 0.35, skipOnboarding: 0.1 },
  general: { listenRate: 0.32, idSkill: 0.58, dashChance: 0.12, skipOnboarding: 0.45 },
};

export function driveCriticalSession({
  segment,
  persona,
  habitat = 'forest',
  timeOfDay = 'dawn',
  skill = 0.55,
  usesMobileHud = false,
  features = {},
  rng = Math.random,
  recordBudget = RECORD_BUDGET,
}) {
  const script = { ...NOVICE_SCRIPTS[segment], skill };
  if (features.dashDisabled) script.dashChance = 0;
  if (features.interactiveTutorial) {
    script.listenRate *= 1.35;
    script.skipOnboarding = 0;
  } else if (features.guidedCoach) {
    script.listenRate *= 1.22;
  }
  if (features.controlDock) script.listenRate *= 1.08;
  if (features.canvasCompass) script.idSkill *= 1.06;
  if (features.stereoWarmthAudio) script.listenRate *= 1.06;
  if (features.interactiveSpectrogram) script.idSkill *= 1.14;
  if (features.interactiveTutorial) script.idSkill *= 1.08;
  if (features.vectorSpeciesArt) script.idSkill *= 1.05;
  const session = new FieldSession({
    habitat,
    timeOfDay,
    rng,
    dashEnabled: !features.dashDisabled && segment === 'gamer',
  });
  const friction = [];
  const delights = [];
  const confusion = [];

  const skippedOnboarding = rng() < script.skipOnboarding;
  if (skippedOnboarding) {
    friction.push('skipped_onboarding');
    confusion.push('never_understood_loop');
  } else if (features.onboardingSteps >= 3) {
    delights.push('onboarding_tour_cleared');
  }

  if (!features.controlDock && !features.mobileHud && !features.progressiveDisclosure) {
    friction.push('controls_overwhelming');
  }
  if (!features.missionBar) confusion.push('unclear_goal');
  if (!features.interactiveTutorial && !features.guidedCoach) friction.push('skipped_guided_coach');
  if (!features.canvasCompass) confusion.push('cant_find_animals');
  if (!features.enhancedGraphics && !features.vectorSpeciesArt) friction.push('poor_visual_fidelity');

  let firstRecQuality = null;
  let totalListenTicks = 0;
  let recordsWithoutListen = 0;

  for (let attempt = 0; attempt < recordBudget; attempt++) {
    const ticks = 18 + Math.floor(skill * 22);
    let ticksBeforeRecord = 0;

    for (let t = 0; t < ticks; t++) {
      const st = session.getState();
      const listenProb = script.listenRate * skill * (usesMobileHud ? 1.1 : 0.85);
      const keys = buildSimKeys(st.player, st.animals, st.gameState.timeOfDay, {
        ...script,
        listenRate: listenProb,
      }, skill * 0.7, rng, usesMobileHud);
      session.tick({ keys, mouse: { x: st.player.x, y: st.player.y, down: false, listenDown: false }, dt: 1, now: attempt * 1000 + t * 16 });
      if (keys.l) {
        ticksBeforeRecord++;
        totalListenTicks++;
      }
    }

    if (segment === 'gamer' && rng() < script.dashChance) {
      session.triggerDash();
      friction.push('dash_scared_caller');
    }

    const clip = session.record();
    if (!clip) continue;

    if (firstRecQuality === null) firstRecQuality = clip.quality;
    if (ticksBeforeRecord < 5) {
      recordsWithoutListen++;
      friction.push(attempt === 0 ? 'noisy_first_recording' : 'recorded_without_listen');
    }
    if (clip.quality <= 0.55) friction.push('noisy_recording');

    const idSkill = script.idSkill * skill * ((features.interactiveTutorial || features.guidedCoach) ? 1.08 : 0.82);
    if (features.interactiveSpectrogram && clip.quality >= 0.48) {
      delights.push('spectrogram_peak_tapped');
    }
    const chosenId = pickSimIdentification({
      dominantId: clip.dominant.id,
      animals: session.animals,
      idSkill,
      quality: clip.quality,
      skill: idSkill,
      features,
      persona,
      timeOfDay: session.gameState.timeOfDay,
      rng,
    });
    const outcome = session.identify(chosenId);
    if (outcome && !outcome.correct) {
      friction.push('id_card_miss');
      if (!features.interactiveSpectrogram) confusion.push('identify_panel_confusing');
    }
  }

  if (totalListenTicks < 40) confusion.push('never_used_listen');
  if (recordsWithoutListen >= 3) confusion.push('recorded_before_listening');
  if (!features.nearestCallerHint && !features.canvasCompass) confusion.push('lost_in_habitat');

  const st = session.getState();
  const completed = st.completed;
  let habitatsDone = [];
  if (completed) {
    habitatsDone = markHabitatDone([], habitat);
    delights.push('expedition_complete_celebration');
  } else {
    friction.push('habitat_incomplete');
    confusion.push('quit_before_payoff');
  }

  if (features.interactiveTutorial && !skippedOnboarding && totalListenTicks >= 40) {
    delights.push('interactive_tutorial_complete');
  } else if (features.guidedCoach && !skippedOnboarding && totalListenTicks >= 40) {
    delights.push('guided_coach_complete');
  }
  if (features.stereoWarmthAudio && totalListenTicks >= 30) delights.push('stereo_warmth_aha');
  if (features.progressiveDisclosure) delights.push('progressive_ui_unlock');
  if (features.vectorSpeciesArt) delights.push('vector_art_clarity');
  if (features.canvasCompass && totalListenTicks >= 30) delights.push('canvas_compass_used');
  if (features.missionBar && completed) delights.push('mission_bar_clarity');

  const scores = scoreSessionRubric({
    segment,
    persona,
    completed,
    integrity: st.integrity,
    friction: [...new Set([...friction, ...confusion])],
    delights,
    features,
    journal: st.journal,
    recQuality: firstRecQuality ?? 0.5,
    listenActive: totalListenTicks > 20,
  });

  return {
    scores,
    completed,
    attempts: recordBudget,
    listenTicksTotal: totalListenTicks,
    delights,
    friction: [...new Set(friction)],
    confusion: [...new Set(confusion)],
    integrity: st.integrity,
    logged: st.logged,
    journal: st.journal,
    habitatsDone,
    skippedOnboarding,
  };
}