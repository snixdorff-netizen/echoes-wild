/**
 * Pure ECHOES field-loop logic — shared by index.html (browser build), unit tests, and player simulation.
 */

export const HABITATS = ['forest', 'marsh', 'canyon'];
export const PERSONAS = ['liam', 'aisha', 'marcus', 'elena'];
export const SEGMENTS = {
  naturalist: { label: 'Naturalists / birders', persona: 'marcus', count: 25 },
  educator: { label: 'Students / educators', persona: 'aisha', count: 25 },
  gamer: { label: 'Gamers', persona: 'liam', count: 25 },
  general: { label: 'General public', persona: 'liam', count: 25 },
};

export const SPECIES = [
  { id: 'cardinal', name: 'Northern Cardinal', activity: ['dawn', 'day'] },
  { id: 'owl', name: 'Barred Owl', activity: ['dusk', 'night'] },
  { id: 'peeper', name: 'Spring Peeper', activity: ['dawn', 'night'] },
  { id: 'cricket', name: 'Tree Cricket', activity: ['dusk', 'night'] },
  { id: 'woodpecker', name: 'Pileated Woodpecker', activity: ['day'] },
  { id: 'bat', name: 'Big Brown Bat', activity: ['dusk', 'night'] },
];

export const TIME_ORDER = ['dawn', 'day', 'dusk', 'night'];

export function angleDiff(dir, facing) {
  return Math.abs(((dir - facing + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
}

export function scoreAnimalTarget(player, animal, timeOfDay) {
  if (!animal.activity.includes(timeOfDay)) return -999;
  const dx = animal.x - player.x;
  const dy = animal.y - player.y;
  const dist = Math.hypot(dx, dy);
  const dir = Math.atan2(dy, dx);
  const adiff = angleDiff(dir, player.facing);
  const facingScore = player.listenActive ? (1.6 - Math.min(1.2, adiff)) : 0.6;
  return (620 - dist) * 0.9 + facingScore * 180;
}

export function clipQualityFromScore(bestScore) {
  return Math.max(0.35, Math.min(1, bestScore / 650));
}

export const FACING_BONUS_THRESHOLD = 1.2;

export function facingBonusFromDiff(adiff, listenActive) {
  if (!listenActive) return Math.max(0.35, 1 - adiff / Math.PI) * 0.9;
  const align = Math.max(0, 1 - adiff / (Math.PI * 0.42));
  return 0.55 + align * 2.0;
}

/** Stereo volume/pan + warmth score for proximity audio cues ("getting warmer"). */
export function computeCallWarmth(player, animal) {
  const dx = animal.x - player.x;
  const dy = animal.y - player.y;
  const dist = Math.hypot(dx, dy);
  const dirTo = Math.atan2(dy, dx);
  const adiff = angleDiff(dirTo, player.facing || 0);
  const facingAlign = Math.max(0, 1 - adiff / (Math.PI * 0.5));
  const prox = Math.max(0.08, 1 - dist / 500);
  const listenActive = !!player.listenActive;
  const warmth = listenActive
    ? Math.min(1, 0.2 + prox * 0.45 + facingAlign * 0.5)
    : prox * 0.55;
  const vol = Math.min(1.35, warmth * (listenActive ? 1.55 : 0.8));
  const pan = Math.max(-1, Math.min(1, (dx / 380) * (0.55 + facingAlign * 0.55)));
  return { vol, pan, warmth, dist, facingAlign };
}

export function selectRecordingTarget(player, animals, timeOfDay) {
  let best = null;
  let bestScore = -999;
  for (const a of animals) {
    const score = scoreAnimalTarget(player, a, timeOfDay);
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  if (!best && animals.length) {
    best = animals[0];
    bestScore = scoreAnimalTarget(player, best, timeOfDay);
  }
  return {
    dominant: best,
    best,
    bestScore,
    quality: clipQualityFromScore(bestScore),
  };
}

export function nearestActiveCaller(player, animals, timeOfDay) {
  let animal = null;
  let distance = Infinity;
  for (const a of animals) {
    if (!a.activity.includes(timeOfDay)) continue;
    const d = Math.hypot(a.x - player.x, a.y - player.y);
    if (d < distance) {
      distance = d;
      animal = a;
    }
  }
  return { animal, distance };
}

export function faceToward(player, target) {
  if (!target) return { ...player };
  return {
    ...player,
    facing: Math.atan2(target.y - player.y, target.x - player.x),
  };
}

/** Mirrors index.html animal wander each update tick. */
export function tickAnimals(animals, dt = 1) {
  return animals.map((a) => {
    const bobPhase = (a.bobPhase || 0) + 0.029 * dt;
    return {
      ...a,
      bobPhase,
      x: a.x + Math.sin(bobPhase * 0.65) * 0.38 * dt,
      y: a.y + Math.cos(bobPhase * 0.48) * 0.27 * dt,
    };
  });
}

/** Mirrors index.html dash scare push on nearby animals. */
export function applyDashScare(player, animals) {
  return animals.map((a) => {
    const dx = a.x - player.x;
    const dy = a.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 120 && dist > 5) {
      const push = (120 - dist) / 8;
      return { ...a, x: a.x + (dx / dist) * push, y: a.y + (dy / dist) * push };
    }
    return { ...a };
  });
}

/** Mirrors updateListenFacing when keyboard/mobile listen is held. */
export function simulateListenFacing(player, animals, timeOfDay, listenActive) {
  if (!listenActive) return { ...player };
  const nearest = nearestActiveCaller(player, animals, timeOfDay);
  if (!nearest.animal) return { ...player };
  return {
    ...player,
    facing: Math.atan2(nearest.animal.y - player.y, nearest.animal.x - player.x),
  };
}

export function qualityLabel(quality) {
  if (quality > 0.8) return 'CLEAN';
  if (quality > 0.55) return 'FAIR';
  return 'NOISY';
}

export function integrityGain(quality) {
  return Math.round(3 + quality * 6);
}

export function integrityLoss(quality) {
  return quality > 0.7 ? 8 : 4;
}

export function applyIdentification({ chosenId, dominantId, quality, logged, integrity }) {
  const correct = chosenId === dominantId;
  if (correct) {
    const gain = integrityGain(quality);
    return {
      correct: true,
      logged: Math.min(6, logged + 1),
      integrity: Math.min(100, integrity + gain),
      delta: gain,
    };
  }
  const loss = integrityLoss(quality);
  return {
    correct: false,
    logged,
    integrity: Math.max(35, integrity - loss),
    delta: -loss,
  };
}

export function shouldCompleteExpedition(logged) {
  return logged >= 6;
}

export function markHabitatDone(doneList, habitat) {
  const done = [...doneList];
  if (!done.includes(habitat)) done.push(habitat);
  return done;
}

export function activeSpeciesForTime(speciesList, timeOfDay) {
  return speciesList.filter((sp) => sp.activity.includes(timeOfDay));
}

export function likelyMatchThreshold(persona) {
  return persona === 'liam' ? 0.48 : 0.52;
}

/** Shared identify-card builder — same options the shipped page renders. */
export function buildIdentifyOptions(speciesList, clip, persona) {
  const pool = activeSpeciesForTime(speciesList, clip.timeOfDay);
  const threshold = likelyMatchThreshold(persona);
  return pool
    .slice()
    .sort((a, b) => (a.id === clip.dominant.id ? -1 : b.id === clip.dominant.id ? 1 : 0))
    .map((sp) => ({
      id: sp.id,
      name: sp.name,
      isLikely: sp.id === clip.dominant.id && clip.quality >= threshold,
    }));
}

/** Models how shipped UI helps players pick the dominant species. */
export function simIdentificationBonus({ features, persona, quality, skill }) {
  let bonus = 0;
  const threshold = likelyMatchThreshold(persona);
  if (quality >= 0.58 && features.nearestCallerHint && skill >= 0.72) bonus += 0.1;
  if (quality >= 0.55 && features.personaHints && skill >= 0.75) bonus += 0.08;
  if (quality >= 0.62 && features.integrityToasts) bonus += 0.06;
  if (quality >= threshold && features.likelyMatchLabel && skill >= 0.78) {
    bonus += persona === 'liam' ? 0.14 : 0.1;
  }
  if (features.activeSpeciesFilter && quality >= 0.45 && skill >= 0.78) bonus += 0.08;
  if (skill >= 0.9 && quality >= 0.5 && features.likelyMatchLabel) bonus += 0.06;
  return bonus;
}

export function personaHint(persona, kind) {
  const hints = {
    liam: {
      miss: 'Miss — get closer and aim the cone!',
      learn: 'Tip: the cone is your superpower.',
    },
    aisha: {
      miss: 'Not quite — try facing the animal while holding Listen.',
      learn: 'Teaching moment: directional mics reduce background noise.',
    },
    marcus: {
      miss: 'ID miss — improve SNR by closing distance + aiming.',
      learn: 'Field tip: log clean clips for your BioBlitz report.',
    },
    elena: {
      miss: 'Incorrect ID — check spectrogram quality and bearing.',
      learn: 'Pro note: integrity reflects recording SNR + correct classification.',
    },
  };
  return (hints[persona] || hints.liam)[kind];
}

export function initAnimals(habitat = 'forest') {
  const baseY = habitat === 'marsh' ? 340 : habitat === 'canyon' ? 250 : 290;
  const spread = habitat === 'marsh' ? 95 : 110;
  return SPECIES.map((sp, i) => {
    const yJitter = (i % 2) * 55 + (habitat === 'canyon' ? -30 : 0);
    return {
      id: sp.id,
      species: sp,
      x: 130 + i * spread + (habitat === 'canyon' ? i * 3 : 0),
      y: baseY + yJitter,
      activity: sp.activity,
    };
  });
}

export function scoreSessionRubric({
  segment,
  persona,
  completed,
  integrity,
  friction,
  delights,
  features,
  journal,
  recQuality,
  listenActive,
}) {
  let fun = 7.0;
  let clarity = 7.5;
  let enthusiasm = 7.0;
  let wouldRecommend = 3.8;

  if (features.onboardingSteps >= 3) {
    fun += 0.35;
    clarity += 0.55;
  }
  if (features.mobileHud) {
    fun += 0.25;
    clarity += 0.35;
  }
  if (features.integrityToasts) {
    fun += 0.45;
    clarity += 0.65;
  }
  if (features.personaHints) {
    fun += 0.2;
    clarity += segment === 'educator' ? 0.45 : 0.25;
  }
  if (features.nearestCallerHint) {
    clarity += 0.35;
    fun += 0.15;
    if (segment === 'general') {
      clarity += 0.25;
      wouldRecommend += 0.2;
    }
  }
  if (features.activeSpeciesFilter) {
    clarity += segment === 'general' ? 0.2 : 0.12;
    fun += 0.08;
  }
  if (features.likelyMatchLabel) {
    clarity += 0.12;
    if (segment === 'general') wouldRecommend += 0.1;
  }
  if (features.audioGate) {
    fun += 0.1;
    clarity += 0.2;
  }
  if (completed) {
    fun += 1.35;
    enthusiasm += 1.5;
    wouldRecommend += 0.75;
  }
  if (features.habitatCtas && completed) {
    fun += 0.35;
    enthusiasm += 0.4;
    wouldRecommend += 0.2;
  }
  if (features.learnSummary && completed) {
    fun += 0.25;
    enthusiasm += segment === 'educator' ? 0.55 : 0.3;
    wouldRecommend += 0.15;
  }
  if (features.shareReport && completed) {
    enthusiasm += 0.55;
    wouldRecommend += 0.45;
  }
  if (features.feedbackCta && completed) {
    wouldRecommend += 0.25;
    enthusiasm += 0.2;
  }
  if (delights.includes('cone_aha_moment')) {
    fun += 0.85;
    enthusiasm += 1.0;
  }
  if (delights.includes('first_species_logged')) {
    fun += 0.4;
    enthusiasm += 0.5;
  }
  if (recQuality > 0.8 && listenActive) {
    fun += 0.3;
  }

  const correctCount = journal.filter((j) => j.correct).length;
  if (correctCount >= 5) fun += 0.25;
  if (!completed && correctCount >= 5) {
    fun += 0.35;
    wouldRecommend += 0.25;
    clarity += 0.15;
  }
  if (!completed && correctCount >= 4) {
    wouldRecommend += 0.1;
  }

  for (const f of friction) {
    if (f === 'habitat_incomplete') {
      fun -= segment === 'gamer' ? 1.8 : 1.2;
      wouldRecommend -= 0.6;
    }
    if (f === 'opaque_integrity_penalty') {
      clarity -= 0.8;
      fun -= 0.4;
    }
    if (f === 'noisy_first_recording') clarity -= 0.15;
    if (f === 'noisy_recording') clarity -= 0.08;
    if (f === 'recorded_without_listen') {
      clarity -= segment === 'general' ? 0.2 : 0.12;
      fun -= 0.1;
    }
    if (f === 'dash_scared_caller') {
      if (segment === 'gamer') fun += 0.12;
      else clarity -= 0.1;
    }
    if (f === 'id_card_miss' && completed) clarity += 0.05;
    if (f === 'controls_overwhelming') {
      clarity -= 1.4;
      fun -= 0.9;
      wouldRecommend -= 0.55;
    }
    if (f === 'poor_visual_fidelity') {
      fun -= 0.75;
      enthusiasm -= 0.6;
      wouldRecommend -= 0.35;
    }
    if (f === 'skipped_guided_coach') clarity -= 0.35;
    if (f === 'skipped_onboarding') clarity -= 0.45;
    if (f === 'never_understood_loop') {
      clarity -= 1.6;
      fun -= 1.1;
      wouldRecommend -= 0.7;
    }
    if (f === 'unclear_goal') clarity -= 0.9;
    if (f === 'cant_find_animals') {
      clarity -= 0.85;
      fun -= 0.5;
    }
    if (f === 'never_used_listen') clarity -= 0.7;
    if (f === 'identify_panel_confusing') clarity -= 0.4;
    if (f === 'quit_before_payoff') {
      fun -= 1.4;
      wouldRecommend -= 0.65;
      enthusiasm -= 0.8;
    }
    if (f === 'lost_in_habitat') clarity -= 0.5;
    if (f === 'recorded_before_listening') clarity -= 0.35;
  }

  if (delights.includes('guided_coach_complete') || delights.includes('interactive_tutorial_complete')) {
    clarity += 0.55;
    fun += 0.35;
    wouldRecommend += 0.2;
  }
  if (delights.includes('stereo_warmth_aha')) {
    clarity += 0.25;
    fun += 0.15;
  }
  if (delights.includes('progressive_ui_unlock')) {
    clarity += 0.2;
  }
  if (delights.includes('canvas_compass_used')) {
    clarity += 0.4;
    fun += 0.2;
  }
  if (delights.includes('mission_bar_clarity')) {
    clarity += 0.35;
    wouldRecommend += 0.15;
  }

  if (segment === 'naturalist' && delights.includes('field_report_share')) wouldRecommend += 0.25;
  if (segment === 'gamer' && delights.includes('expedition_complete_celebration')) fun += 0.2;

  fun = clamp(fun, 1, 10);
  clarity = clamp(clarity, 1, 10);
  enthusiasm = clamp(enthusiasm, 1, 10);
  wouldRecommend = clamp(wouldRecommend, 1, 5);

  return { fun, clarity, enthusiasm, wouldRecommend };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export {
  FieldSession,
  RECORD_BUDGET,
  SEGMENT_SCRIPTS,
  buildSimKeys,
  pickSimIdentification,
} from './field-session.mjs';

export { driveFieldSession } from './sim-drive.mjs';

export function readShippedFeaturesFromHtml(html) {
  return {
    onboardingSteps: (html.match(/ONBOARD_STEPS/g) || []).length >= 1 ? 3 : 0,
    mobileHud: html.includes('id="control-dock"') || html.includes('id="mobile-hud"'),
    integrityToasts: html.includes('function showToast') && html.includes("integrity +"),
    personaHints: html.includes('function personaHint'),
    habitatCtas: html.includes('Try Marsh') || html.includes('nextHabitatBtns'),
    learnSummary: html.includes('What you learned'),
    shareReport: html.includes('shareFieldReport'),
    feedbackCta: html.includes('copyPlaytestFeedback'),
    expeditionGate: html.includes('shouldCompleteExpedition') || html.includes('logged >= 6'),
    audioGate: html.includes('id="audio-gate"'),
    nearestCallerHint: html.includes('id="nearest-hint"'),
    activeSpeciesFilter: html.includes('buildIdentifyOptions'),
    likelyMatchLabel: html.includes('Most likely'),
    controlDock: html.includes('id="control-dock"'),
    missionBar: html.includes('id="mission-bar"'),
    guidedCoach: html.includes('id="guided-coach"'),
    interactiveTutorial: html.includes('id="interactive-tutorial"') && html.includes('echoes-tutorial-v2'),
    dashDisabled: html.includes('dashEnabled: false') || html.includes('DASH_ENABLED_EXPEDITION'),
    progressiveDisclosure: html.includes('id="advanced-bar"'),
    stereoWarmthAudio: html.includes('computeCallWarmth'),
    canvasCompass: html.includes('drawCanvasCompass'),
    enhancedGraphics: html.includes('drawEnhancedHabitat'),
  };
}