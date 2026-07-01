/**
 * 100-player sim driver — feeds scripted inputs into FieldSession (fixed record budget).
 */
import { markHabitatDone, scoreSessionRubric } from './echoes-core.mjs';
import {
  FieldSession,
  RECORD_BUDGET,
  SEGMENT_SCRIPTS,
  buildSimKeys,
  pickSimIdentification,
} from './field-session.mjs';

export function driveFieldSession({
  segment,
  persona,
  habitat = 'forest',
  timeOfDay = 'dawn',
  skill = 0.85,
  usesMobileHud = false,
  features = {},
  rng = Math.random,
  recordBudget = RECORD_BUDGET,
}) {
  const script = { ...SEGMENT_SCRIPTS[segment], skill };
  if (features.dashDisabled) script.dashChance = 0;
  const session = new FieldSession({
    habitat,
    timeOfDay,
    rng,
    dashEnabled: !features.dashDisabled && segment === 'gamer',
  });
  const friction = [];
  const delights = [];

  if (features.onboardingSteps >= 3) delights.push('onboarding_tour_cleared');
  if (features.mobileHud) delights.push('mobile_hud_available');
  if (features.nearestCallerHint) delights.push('nearest_caller_compass');
  if (features.audioGate) delights.push('audio_unlock_gate');

  let firstRecQuality = null;

  for (let attempt = 0; attempt < recordBudget; attempt++) {
    const ticks = 48 + Math.floor(skill * 14) + (usesMobileHud ? 6 : 0);
    let ticksBeforeRecord = 0;
    let dashed = false;

    for (let t = 0; t < ticks; t++) {
      const st = session.getState();
      const keys = buildSimKeys(st.player, st.animals, st.gameState.timeOfDay, script, skill, rng, usesMobileHud);
      const mouse = {
        x: st.player.x,
        y: st.player.y,
        down: false,
        listenDown: usesMobileHud && rng() < 0.25,
      };
      session.tick({ keys, mouse, dt: 1, now: attempt * 1000 + t * 16 });
      if (keys.l) ticksBeforeRecord++;
    }

    if (!features.dashDisabled && segment === 'gamer' && !dashed && rng() < script.dashChance) {
      dashed = true;
      session.triggerDash();
      friction.push('dash_scared_caller');
    }

    const clip = session.record();
    if (!clip) continue;

    if (firstRecQuality === null) firstRecQuality = clip.quality;
    if (ticksBeforeRecord < 8) friction.push(attempt === 0 ? 'noisy_first_recording' : 'recorded_without_listen');
    if (clip.quality <= 0.55) friction.push('noisy_recording');
    if (attempt === 0 && clip.quality > 0.6 && ticksBeforeRecord >= 8) delights.push('cone_aha_moment');

    const chosenId = pickSimIdentification({
      dominantId: clip.dominant.id,
      animals: session.animals,
      idSkill: script.idSkill * skill,
      quality: clip.quality,
      skill,
      features,
      persona,
      timeOfDay: session.gameState.timeOfDay,
      rng,
    });
    const outcome = session.identify(chosenId);
    if (outcome?.correct && features.integrityToasts && session.logged === 1) delights.push('first_species_logged');
    if (outcome && !outcome.correct) {
      if (!features.integrityToasts) friction.push('opaque_integrity_penalty');
      friction.push('id_card_miss');
    }
  }

  const st = session.getState();
  const completed = st.completed;
  let habitatsDone = [];
  if (completed) {
    habitatsDone = markHabitatDone([], habitat);
    delights.push('expedition_complete_celebration');
    if (features.habitatCtas) delights.push('habitat_switch_cta');
    if (features.learnSummary) delights.push('what_you_learned_summary');
    if (features.shareReport) delights.push('field_report_share');
    if (features.feedbackCta) delights.push('feedback_button_ready');
  } else {
    friction.push('habitat_incomplete');
  }

  if (usesMobileHud && features.mobileHud) delights.push('mobile_listen_record_used');

  const scores = scoreSessionRubric({
    segment,
    persona,
    completed,
    integrity: st.integrity,
    friction,
    delights,
    features,
    journal: st.journal.map((j) => ({ species: j.species.id, correct: j.correct, quality: j.quality })),
    recQuality: firstRecQuality ?? 0.45,
    listenActive: st.listenTicksSession > 0,
  });

  return {
    segment,
    persona,
    habitat,
    logged: st.logged,
    integrity: st.integrity,
    completed,
    habitatsDone,
    friction,
    delights,
    journal: st.journal,
    attempts: st.recordCount,
    listenTicksTotal: st.listenTicksSession,
    scores,
  };
}