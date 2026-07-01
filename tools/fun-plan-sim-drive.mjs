/**
 * Fun-plan session driver — current build + v2.1 plan gap friction.
 */
import { readFunPlanStatus, scoreFunPlanRubric } from './echoes-core.mjs';
import { driveBioacousticsSession } from './bioacoustics-sim-drive.mjs';

export function applyFunPlanFriction({ friction, funPlan, features, role, playHabit, logged, completed }) {
  if (funPlan.expeditionArc !== 'shipped') {
    friction.push('no_expedition_arc');
    friction.push('checklist_not_story');
    if (logged >= 4 && !completed) friction.push('six_species_grind_too_long');
  } else if (logged >= 4 && !completed && funPlan.finalStretchCoach !== 'shipped') {
    friction.push('boss_caller_incomplete');
  }
  if (funPlan.heroAudioPerHabitat !== 'shipped') {
    friction.push('no_hero_audio_moment');
    friction.push('procedural_flat_soundscape');
  }
  if (funPlan.meaningfulFailure !== 'shipped' && features.meaningfulFailure !== 'shipped') {
    friction.push('wrong_id_no_teachable_punchline');
  }
  if (funPlan.shareableWinGated !== 'shipped' && funPlan.shareableWinGated !== true && !features.shareableWinGated) {
    friction.push('share_unearned');
  }
  if (funPlan.powerProgression !== 'shipped') {
    friction.push('progression_is_menus_not_power');
  }
  const trainingRole = ['pam_analyst', 'educator', 'data_scientist', 'grad_student', 'conservation_bio'].includes(role);
  const puzzleMind = playHabit === 'puzzle' || playHabit === 'inaturalist';
  if (
    features.kaleidoscopePoc &&
    !features.kaleidoscopePersonaGated &&
    !trainingRole &&
    !puzzleMind
  ) {
    friction.push('kaleidoscope_distraction_for_casual');
  }
  if (completed && funPlan.fieldReportFinale !== 'shipped') {
    friction.push('no_field_report_celebration');
  }
  if (
    features.progressiveDisclosure &&
    logged >= 1 &&
    !trainingRole &&
    !features.kaleidoscopePersonaGated
  ) {
    friction.push('advanced_bar_overwhelming');
  }
  if (features.trainingDisclaimer) {
    friction.push('procedural_not_field_recording');
  }
}

export function driveFunPlanSession({
  engineer,
  features,
  funPlan,
  rng = Math.random,
  habitat,
  timeOfDay,
  skill,
}) {
  const base = driveBioacousticsSession({
    engineer,
    features,
    rng,
    habitat,
    timeOfDay,
    skill,
  });

  const friction = [...base.friction, ...base.domainFriction];
  applyFunPlanFriction({
    friction,
    funPlan,
    features,
    role: engineer.role,
    playHabit: engineer.playHabit,
    logged: base.logged,
    completed: base.completed,
  });

  const delights = [...base.delights];
  if (base.completed && features.shareReport) delights.push('field_report_share');

  const scores = scoreFunPlanRubric({
    role: engineer.role,
    playHabit: engineer.playHabit,
    completed: base.completed,
    integrity: base.integrity,
    friction: [...new Set(friction)],
    delights,
    features,
    funPlan,
    journal: base.journal,
    recQuality: base.journal[0]?.quality ?? 0.5,
    listenActive: !friction.includes('never_used_listen'),
    logged: base.logged,
  });

  const funFriction = [...new Set(friction)].filter((f) =>
    [
      'no_expedition_arc', 'checklist_not_story', 'no_hero_audio_moment',
      'procedural_flat_soundscape', 'wrong_id_no_teachable_punchline', 'share_unearned',
      'progression_is_menus_not_power', 'kaleidoscope_distraction_for_casual',
      'six_species_grind_too_long', 'boss_caller_incomplete', 'no_field_report_celebration', 'advanced_bar_overwhelming',
      'habitat_incomplete', 'never_used_listen',
    ].includes(f),
  );

  return {
    ...base,
    engineer,
    scores,
    funFriction,
    funPlan,
  };
}

const PARTIAL_PILLAR_IDS = new Set([
  'meaningfulFailure', 'shareableWinGated', 'fieldReportFinale', 'dailyBioBlitzHook',
]);

export function projectFunPlanIfShipped(funPlan, pillars) {
  const projected = { ...funPlan };
  for (const p of pillars) {
    projected[p.id] = 'shipped';
  }
  return projected;
}

export { readFunPlanStatus };