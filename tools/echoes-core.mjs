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

/** One movement tick toward a chase target (WASD-style closing speed). */
export function tickPlayerTowardTarget(player, target, skill = 0.85) {
  if (!target) return { ...player };
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) return { ...player };
  const step = Math.min(2.0 + skill * 2.0, dist);
  return {
    ...player,
    x: player.x + (dx / dist) * step,
    y: player.y + (dy / dist) * step,
  };
}

export function chooseActiveTime(animals, preferred) {
  if (animals.filter((a) => a.activity.includes(preferred)).length >= 3) return preferred;
  return TIME_ORDER.find((t) => animals.filter((a) => a.activity.includes(t)).length >= 3) || preferred;
}

const LISTEN_RATE = {
  naturalist: 0.9,
  educator: 0.86,
  gamer: 0.72,
  general: 0.74,
};

const TICKS_PER_ATTEMPT = {
  naturalist: 50,
  educator: 46,
  gamer: 40,
  general: 44,
};

const MAX_ATTEMPTS_BY_SEGMENT = {
  naturalist: 11,
  educator: 12,
  gamer: 13,
  general: 15,
};

export function pickIdentificationChoice({ dominantId, animals, skill, quality, rng = Math.random }) {
  const pCorrect = Math.min(0.96, skill * (0.38 + quality * 0.58));
  if (rng() < pCorrect) return dominantId;
  const alts = animals.filter((a) => a.species.id !== dominantId);
  if (!alts.length) return dominantId;
  return alts[Math.floor(rng() * alts.length)].species.id;
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

/**
 * Tick-based field session: bob wander, listen facing, optional dash scare,
 * variable clip quality, probabilistic ID card picks, extra attempts on misses.
 */
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
  let animals = initAnimals(habitat).map((a, i) => ({ ...a, bobPhase: i * 0.6 }));
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

  const tod = chooseActiveTime(animals, timeOfDay);
  let player = { x: 440, y: 310, facing: 0, listenActive: false };
  let firstRecQuality = null;
  let listenTicksTotal = 0;
  let anyListen = false;
  let attempts = 0;
  const maxAttempts = MAX_ATTEMPTS_BY_SEGMENT[segment] + (usesMobileHud ? 2 : 0) + Math.floor(skill * 2);
  const ticksPerAttempt = TICKS_PER_ATTEMPT[segment];

  while (logged < 6 && attempts < maxAttempts) {
    attempts++;
    let listenTicksAttempt = 0;
    let dashedAttempt = false;
    let chase = nearestActiveCaller(player, animals, tod).animal;

    for (let tick = 0; tick < ticksPerAttempt; tick++) {
      animals = tickAnimals(animals);
      chase = nearestActiveCaller(player, animals, tod).animal || chase;

      const listenBase = LISTEN_RATE[segment] * skill + (usesMobileHud ? 0.14 : 0) + (features.nearestCallerHint ? 0.06 : 0);
      const impatientRecord = segment === 'general' && tick > ticksPerAttempt - 6 && rng() < 0.28;
      player.listenActive = !impatientRecord && rng() < listenBase;
      if (player.listenActive) {
        listenTicksAttempt++;
        listenTicksTotal++;
        anyListen = true;
      }

      player = tickPlayerTowardTarget(player, chase, skill);
      player = simulateListenFacing(player, animals, tod, player.listenActive);

      if (segment === 'gamer' && !dashedAttempt && tick === Math.floor(ticksPerAttempt * 0.5) && rng() < 0.24) {
        dashedAttempt = true;
        const boost = 6 + skill * 4;
        player.x += Math.cos(player.facing || 0) * boost;
        player.y += Math.sin(player.facing || 0) * boost;
        animals = applyDashScare(player, animals);
        friction.push('dash_scared_caller');
        chase = nearestActiveCaller(player, animals, tod).animal || chase;
      }
    }

    if (listenTicksAttempt < 10) {
      friction.push(attempts === 1 ? 'noisy_first_recording' : 'recorded_without_listen');
      player.listenActive = false;
    }

    const clip = selectRecordingTarget(player, animals, tod);
    const dominant = clip.dominant || clip.best;
    const listenFrac = listenTicksAttempt / ticksPerAttempt;
    let effectiveQuality = clip.quality * (0.48 + Math.min(1, listenFrac * 1.15) * 0.52);
    if (dashedAttempt) effectiveQuality *= 0.86;
    const distToDominant = Math.hypot(dominant.x - player.x, dominant.y - player.y);
    if (distToDominant > 90) effectiveQuality *= 0.78;
    effectiveQuality = Math.max(0.35, Math.min(1, effectiveQuality));

    if (firstRecQuality === null) firstRecQuality = effectiveQuality;

    if (effectiveQuality <= 0.55) friction.push('noisy_recording');
    if (attempts === 1 && effectiveQuality > 0.62 && listenTicksAttempt >= 10) delights.push('cone_aha_moment');

    const chosenId = pickIdentificationChoice({
      dominantId: dominant.species.id,
      animals,
      skill,
      quality: effectiveQuality,
      rng,
    });
    const outcome = applyIdentification({
      chosenId,
      dominantId: dominant.species.id,
      quality: effectiveQuality,
      logged,
      integrity,
    });
    logged = outcome.logged;
    integrity = outcome.integrity;
    journal.push({
      species: dominant.species.id,
      correct: outcome.correct,
      quality: effectiveQuality,
      rawQuality: clip.quality,
      attempt: attempts,
    });

    if (outcome.correct && features.integrityToasts && logged === 1) delights.push('first_species_logged');
    if (!outcome.correct) {
      if (!features.integrityToasts) friction.push('opaque_integrity_penalty');
      friction.push('id_card_miss');
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
    recQuality: firstRecQuality ?? 0.5,
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
    attempts,
    listenTicksTotal,
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
    if (f === 'recorded_without_listen') {
      clarity -= segment === 'general' ? 0.2 : 0.12;
      fun -= 0.1;
    }
    if (f === 'dash_scared_caller') {
      if (segment === 'gamer') fun += 0.12;
      else clarity -= 0.1;
    }
    if (f === 'id_card_miss' && completed) clarity += 0.05;
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