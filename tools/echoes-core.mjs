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
  return listenActive && adiff < FACING_BONUS_THRESHOLD ? 1.65 : 1.0;
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

export function approachTarget(player, target, skill = 0.85) {
  if (!target) return { ...player };
  const p = { ...player };
  const steps = Math.max(2, Math.round(3 + skill * 2));
  for (let s = 0; s < steps; s++) {
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 40) break;
    const step = Math.min(30, dist - 36);
    p.x += (dx / dist) * step;
    p.y += (dy / dist) * step;
  }
  p.facing = Math.atan2(target.y - p.y, target.x - p.x);
  return p;
}

export function pickIdentificationChoice({ dominantId, animals, skill, quality, round, rng = Math.random }) {
  if (quality < 0.48 && round === 0 && skill < 0.72) {
    const alt = animals.find((a) => a.species.id !== dominantId);
    return alt ? alt.species.id : dominantId;
  }
  if (quality >= 0.52 || skill >= 0.78) return dominantId;
  return rng() < skill ? dominantId : animals.find((a) => a.species.id !== dominantId)?.species.id || dominantId;
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

/** Scripted session using real move → listen → face → record → identify helpers. */
export function runPlayerSession({
  segment,
  persona,
  habitat = 'forest',
  timeOfDay = 'dawn',
  skill = 0.85,
  usesMobileHud = false,
  features = {},
  rng = Math.random,
}) {
  const animals = initAnimals(habitat);
  const friction = [];
  const delights = [];
  let logged = 0;
  let integrity = 100;
  let habitatsDone = [];
  const journal = [];

  if (features.onboardingSteps >= 3) delights.push('onboarding_tour_cleared');
  if (features.mobileHud) delights.push('mobile_hud_available');
  if (features.nearestCallerHint) delights.push('nearest_caller_compass');
  if (features.audioGate) delights.push('audio_unlock_gate');

  let tod = timeOfDay;
  const activeAtTime = animals.filter((a) => a.activity.includes(tod));
  if (activeAtTime.length < 3) {
    const fallback = TIME_ORDER.find((t) => animals.filter((a) => a.activity.includes(t)).length >= 3);
    if (fallback) tod = fallback;
  }

  const roundTargets = animals.filter((a) => a.activity.includes(tod));
  const targets = roundTargets.length >= 6
    ? roundTargets.slice(0, 6)
    : [...roundTargets, ...animals].slice(0, 6);

  let player = { x: 440, y: 310, facing: 0, listenActive: false };
  let firstRecQuality = 0;
  let anyListen = false;

  for (let i = 0; i < 6; i++) {
    const target = targets[i % targets.length];
    player = approachTarget(player, target, skill);
    player.listenActive = usesMobileHud || skill > 0.38;
    anyListen = anyListen || player.listenActive;
    player = faceToward(player, target);

    if (segment === 'gamer' && i === 2 && rng() < 0.12) {
      player.x += 55;
      player.y += 30;
      friction.push('dash_scared_caller');
    }

    const clip = selectRecordingTarget(player, animals, tod);
    const dominant = clip.dominant || clip.best;
    if (i === 0) firstRecQuality = clip.quality;

    if (clip.quality <= 0.55) friction.push(i === 0 ? 'noisy_first_recording' : 'noisy_recording');
    if (i === 0 && clip.quality > 0.68 && player.listenActive) delights.push('cone_aha_moment');

    const chosenId = pickIdentificationChoice({
      dominantId: dominant.species.id,
      animals,
      skill,
      quality: clip.quality,
      round: i,
      rng,
    });
    const outcome = applyIdentification({
      chosenId,
      dominantId: dominant.species.id,
      quality: clip.quality,
      logged,
      integrity,
    });
    logged = outcome.logged;
    integrity = outcome.integrity;
    journal.push({ species: dominant.species.id, correct: outcome.correct, quality: clip.quality });

    if (outcome.correct && features.integrityToasts && i === 0) delights.push('first_species_logged');
    if (!outcome.correct) {
      if (!features.integrityToasts) friction.push('opaque_integrity_penalty');
      if (segment === 'general' && features.nearestCallerHint) friction.push('id_confusion_recovered');
    }
  }

  const completed = shouldCompleteExpedition(logged);
  if (completed) {
    habitatsDone = markHabitatDone(habitatsDone, habitat);
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
    integrity,
    friction,
    delights,
    features,
    journal,
    recQuality: firstRecQuality,
    listenActive: anyListen,
  });

  return {
    segment,
    persona,
    habitat,
    logged,
    integrity,
    completed,
    habitatsDone,
    friction,
    delights,
    journal,
    scores,
  };
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
    if (f === 'dash_scared_caller' && segment === 'gamer') fun += 0.15;
    if (f === 'id_confusion_recovered' && completed) clarity += 0.1;
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

export function readShippedFeaturesFromHtml(html) {
  return {
    onboardingSteps: (html.match(/ONBOARD_STEPS/g) || []).length >= 1 ? 3 : 0,
    mobileHud: html.includes('id="mobile-hud"'),
    integrityToasts: html.includes('function showToast') && html.includes("integrity +"),
    personaHints: html.includes('function personaHint'),
    habitatCtas: html.includes('Try Marsh') || html.includes('nextHabitatBtns'),
    learnSummary: html.includes('What you learned'),
    shareReport: html.includes('shareFieldReport'),
    feedbackCta: html.includes('copyPlaytestFeedback'),
    expeditionGate: html.includes('shouldCompleteExpedition') || html.includes('logged >= 6'),
    audioGate: html.includes('id="audio-gate"'),
    nearestCallerHint: html.includes('id="nearest-hint"'),
  };
}