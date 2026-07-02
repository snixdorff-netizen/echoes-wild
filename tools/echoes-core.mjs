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

/** Map listen cone alignment + proximity to field-realistic SNR (dB). */
export function computeSnrDb(player, animal, listenActive = false) {
  const warmth = computeCallWarmth(player, animal);
  const prox = Math.max(0.08, 1 - warmth.dist / 500);
  const base = listenActive ? 6 + warmth.warmth * 24 : 3 + prox * 8;
  const facingBonus = listenActive ? warmth.facingAlign * 6 : 0;
  const distPenalty = Math.max(0, (warmth.dist - 280) / 45);
  const db = base + facingBonus - distPenalty;
  return Math.round(Math.max(-4, Math.min(32, db)) * 10) / 10;
}

/** Classification confidence % from clip quality + spectrogram peak + likely match. */
export function computeIdConfidence({ quality, peakTapped, isLikely }) {
  let conf = (quality ?? 0.5) * 55;
  if (peakTapped) conf += 22;
  if (isLikely) conf += 15;
  return Math.round(Math.max(12, Math.min(98, conf)));
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

export const EXPEDITION_REGULAR_TARGET = 4;

export const BOSS_SPECIES_BY_HABITAT = {
  forest: 'owl',
  marsh: 'peeper',
  canyon: 'woodpecker',
};

export function getBossSpeciesId(habitat = 'forest') {
  return BOSS_SPECIES_BY_HABITAT[habitat] || 'owl';
}

export const BOSS_TIME_PREFERENCE = {
  owl: ['dusk', 'night'],
  peeper: ['night', 'dawn'],
  woodpecker: ['day'],
};

export function bossActiveAtTime(bossId, timeOfDay) {
  const sp = SPECIES.find((s) => s.id === bossId);
  return sp ? sp.activity.includes(timeOfDay) : false;
}

/** Pick a time-of-day when the habitat boss can call (fallback order per species). */
export function getBossTimeOfDay(bossId, currentTod = 'dawn') {
  const prefs = BOSS_TIME_PREFERENCE[bossId] || ['day'];
  if (bossActiveAtTime(bossId, currentTod)) return currentTod;
  return prefs.find((t) => bossActiveAtTime(bossId, t)) || prefs[0];
}

export function expeditionPhase(logged, bossLogged = false, habitat = 'forest') {
  if (shouldCompleteExpedition(logged, bossLogged)) return 'complete';
  if (logged >= EXPEDITION_REGULAR_TARGET) return 'boss';
  if (logged >= 1) return 'survey';
  return 'explore';
}

export function applyIdentification({
  chosenId,
  dominantId,
  quality,
  logged,
  integrity,
  bossLogged = false,
  habitat = 'forest',
}) {
  const correct = chosenId === dominantId;
  const bossId = getBossSpeciesId(habitat);
  const isBoss = dominantId === bossId;

  if (correct) {
    const gain = integrityGain(quality);
    if (isBoss && logged >= EXPEDITION_REGULAR_TARGET && !bossLogged) {
      return {
        correct: true,
        logged,
        bossLogged: true,
        integrity: Math.min(100, integrity + gain + 5),
        delta: gain + 5,
        isBoss: true,
      };
    }
    if (logged >= EXPEDITION_REGULAR_TARGET && !isBoss) {
      return {
        correct: true,
        logged,
        bossLogged,
        integrity: Math.min(100, integrity + Math.max(2, Math.floor(gain / 2))),
        delta: Math.max(2, Math.floor(gain / 2)),
        bonusLog: true,
      };
    }
    return {
      correct: true,
      logged: Math.min(EXPEDITION_REGULAR_TARGET, logged + 1),
      bossLogged,
      integrity: Math.min(100, integrity + gain),
      delta: gain,
      isBossEarly: isBoss && logged < EXPEDITION_REGULAR_TARGET,
    };
  }
  const loss = integrityLoss(quality);
  return {
    correct: false,
    logged,
    bossLogged,
    integrity: Math.max(35, integrity - loss),
    delta: -loss,
    missSpeciesId: dominantId,
  };
}

export function shouldCompleteExpedition(logged, bossLogged = false) {
  return logged >= EXPEDITION_REGULAR_TARGET && bossLogged;
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

/** Post-ID lore — call structure notes for training authenticity. */
export const SPECIES_LORE = {
  cardinal: { structure: 'Clear whistled phrases, ~2–3 kHz fundamentals', duty: 'Dawn + day chorus', tip: 'Repeated 2-note motif; harmonics rise with SNR' },
  owl: { structure: 'Low hoots ~300 Hz, 8-syllable rhythm', duty: 'Dusk + night', tip: '"Who-cooks-for-you" — space hoots ~2 s apart' },
  peeper: { structure: 'High peep ~3 kHz, short duty cycle', duty: 'Dawn + night at wetlands', tip: 'Mass chorus raises noise floor — aim one caller' },
  cricket: { structure: 'Rhythmic chirp ~3.1 kHz band', duty: 'Dusk + night', tip: 'Temperature-linked rate; check spectrogram harmonics' },
  woodpecker: { structure: 'Drum bursts 0.5–2 kHz, irregular spacing', duty: 'Day only', tip: 'Drumming = territory; not song — look for burst pattern' },
  bat: { structure: 'FM sweep down-chirp (down-converted)', duty: 'Dusk + night', tip: 'FM slope visible in Kaleidoscope; not tonal like birds' },
};

/** Habitat noise floor (dB) for ambient bed pedagogy. */
export const HABITAT_NOISE_FLOOR = {
  forest: 12,
  marsh: 18,
  canyon: 9,
};

/** Phenology matrix: which species vocalize per time window. */
export function buildPhenologyMatrix(speciesList = SPECIES) {
  return TIME_ORDER.map((time) => ({
    time,
    species: speciesList.filter((sp) => sp.activity.includes(time)).map((sp) => sp.id),
    count: speciesList.filter((sp) => sp.activity.includes(time)).length,
  }));
}

/** Suggest next survey window with most unlogged active species. */
export function suggestPhenologyTime({ speciesList, timeOfDay, loggedIds = [] }) {
  const matrix = buildPhenologyMatrix(speciesList);
  let best = timeOfDay;
  let bestScore = -1;
  for (const row of matrix) {
    const unlogged = row.species.filter((id) => !loggedIds.includes(id)).length;
    const score = unlogged * 2 + row.count;
    if (score > bestScore) {
      bestScore = score;
      best = row.time;
    }
  }
  return { time: best, matrix };
}

/** CSV-ready clip manifest for export workflow. */
export function buildClipManifest(entries, meta = {}) {
  const header = 'timestamp,habitat,time_of_day,species_id,species_name,quality,snr_db,correct,confidence';
  const rows = entries.map((e, i) => {
    const sp = e.species || {};
    const id = sp.id || sp;
    const name = sp.name || id;
    return [
      e.timestamp || `clip_${i + 1}`,
      meta.habitat || '',
      e.time || e.timeOfDay || '',
      id,
      `"${String(name).replace(/"/g, '""')}"`,
      e.quality != null ? Math.round(e.quality * 1000) / 1000 : '',
      e.snrDb != null ? e.snrDb : '',
      e.correct ? 'true' : 'false',
      e.confidence != null ? e.confidence : '',
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

/** Daily BioBlitz rare caller from date seed. */
export function dailyRareSpecies(date = new Date()) {
  const seed = date.getFullYear() * 1000 + date.getMonth() * 50 + date.getDate();
  const idx = seed % SPECIES.length;
  return SPECIES[idx];
}

export const TRAINING_PERSONAS = ['aisha', 'marcus', 'elena'];

export function isTrainingPersona(persona) {
  return TRAINING_PERSONAS.includes(persona);
}

/** Expedition survey windows change only via Schedule / phenology chart (boss auto-shift exempt). */
export function isExpeditionTimeGated({
  logged = 0,
  bossLogged = false,
  expeditionComplete = false,
  bossPhaseActive = false,
  expeditionRegularTarget = EXPEDITION_REGULAR_TARGET,
} = {}) {
  if (expeditionComplete) return false;
  if (bossPhaseActive || (logged >= expeditionRegularTarget && !bossLogged)) return false;
  return true;
}

export function buildDailyBioBlitzAssignment({ persona = 'liam', date = new Date(), streak = 0 } = {}) {
  const rare = dailyRareSpecies(date);
  let headline;
  if (persona === 'aisha') headline = 'Family Chorus: log 2 dawn species with students';
  else if (persona === 'marcus') headline = `Site report: clear a habitat + log ${rare.name}`;
  else if (persona === 'elena') headline = `Batch review: cluster clips · target ${rare.name}`;
  else headline = `Quick BioBlitz: find today's ★ ${rare.name}`;
  return {
    rare,
    streak,
    headline,
    compassHint: `★ Daily: ${rare.name}${streak > 0 ? ` · streak ${streak}` : ''}`,
  };
}

/** Kaleidoscope Act IV clips sourced from expedition journal (not hardcoded samples). */
export function buildKaleidoscopeClipsFromJournal(journalEntries = [], { minClips = 2 } = {}) {
  const clips = journalEntries
    .filter((e) => e.correct)
    .map((e, i) => {
      const sp = typeof e.species === 'object' ? e.species : { id: e.species, name: String(e.species) };
      return {
        id: `kclip_${i}`,
        speciesId: sp.id || sp,
        label: `${sp.name || sp.id} · ${Math.round((e.quality || 0.6) * 100)}%`,
        quality: e.quality ?? 0.6,
      };
    });
  return {
    clips,
    fromJournal: clips.length >= minClips,
    needsSamples: clips.length < minClips,
  };
}

/** Frequency-band fingerprints for interactive spectrogram peaks. */
export const SPECIES_FREQ_PROFILES = {
  cardinal: { peaks: [0.28, 0.45, 0.62], label: 'Whistle band' },
  owl: { peaks: [0.18, 0.35], label: 'Low hoot' },
  peeper: { peaks: [0.72, 0.82], label: 'High peep' },
  cricket: { peaks: [0.65, 0.78], label: 'Chirp rhythm' },
  woodpecker: { peaks: [0.22, 0.38, 0.52, 0.68], label: 'Drum bursts' },
  bat: { peaks: [0.55, 0.7], label: 'FM sweep', fm: true },
};

/** Build clickable spectrogram peaks for a recorded clip. */
export function buildSpectrogramPeaks(clip) {
  const profile = SPECIES_FREQ_PROFILES[clip.dominant?.id] || { peaks: [0.5], label: 'Call band' };
  const q = clip.quality ?? 0.5;
  const jitter = (1 - q) * 0.05;
  return profile.peaks.map((x, i) => ({
    xNorm: Math.max(0.08, Math.min(0.92, x + Math.sin(i * 1.7) * jitter)),
    height: 0.32 + q * 0.42 + (i === 0 ? 0.18 : 0.06),
    isKey: i === 0,
    speciesId: clip.dominant.id,
    label: profile.label,
    fm: !!profile.fm,
  }));
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
  if (features.interactiveSpectrogram && quality >= 0.48 && skill >= 0.65) bonus += 0.14;
  if (features.vectorSpeciesArt && skill >= 0.6) bonus += 0.05;
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
  if (features.expeditionArc) {
    fun += 0.55;
    clarity += 0.35;
    wouldRecommend += 0.25;
  }
  if (features.heroAudioPerHabitat) {
    fun += 0.35;
    enthusiasm += 0.4;
    wouldRecommend += 0.15;
  }
  if (features.fieldReportFinale === 'shipped' && completed) {
    fun += 0.45;
    enthusiasm += 0.65;
    wouldRecommend += 0.35;
  }
  if (features.meaningfulFailure === 'shipped') {
    clarity += 0.15;
    fun += 0.12;
  }
  if (features.shareableWinGated && completed) {
    wouldRecommend += 0.2;
  }
  if (delights.includes('survey_complete_act_two')) {
    fun += 0.3;
    enthusiasm += 0.35;
  }
  if (delights.includes('boss_act_two') || delights.includes('hero_audio_moment')) {
    fun += 0.25;
    enthusiasm += 0.3;
  }
  if (delights.includes('field_report_finale')) {
    fun += 0.4;
    wouldRecommend += 0.25;
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
  if (delights.includes('spectrogram_peak_tapped')) {
    clarity += 0.4;
    fun += 0.25;
    wouldRecommend += 0.18;
  }
  if (delights.includes('vector_art_clarity')) {
    fun += 0.3;
    enthusiasm += 0.25;
    wouldRecommend += 0.12;
  }

  if (segment === 'naturalist' && delights.includes('field_report_share')) wouldRecommend += 0.25;
  if (segment === 'gamer' && delights.includes('expedition_complete_celebration')) fun += 0.2;

  fun = clamp(fun, 1, 10);
  clarity = clamp(clarity, 1, 10);
  enthusiasm = clamp(enthusiasm, 1, 10);
  wouldRecommend = clamp(wouldRecommend, 1, 5);

  return { fun, clarity, enthusiasm, wouldRecommend };
}

/** Domain rubric for bioacoustics engineers — training authenticity over casual fun. */
export function scoreBioacousticsRubric({
  role,
  completed,
  integrity,
  friction,
  delights,
  features,
  journal,
  recQuality,
  listenActive,
  playHabit,
}) {
  let trainingValue = 6.5;
  let scientificCredibility = 6.0;
  let spectrogramFidelity = 5.5;
  let wouldRecommendForTraining = 3.2;
  let wouldUseInClassroom = 3.0;

  if (features.interactiveSpectrogram) {
    spectrogramFidelity += 1.4;
    trainingValue += 0.55;
    scientificCredibility += 0.35;
    wouldRecommendForTraining += 0.35;
  }
  if (features.stereoWarmthAudio) {
    trainingValue += 0.45;
    scientificCredibility += 0.25;
  }
  if (features.snrMeter) {
    scientificCredibility += 1.2;
    trainingValue += 0.65;
    wouldRecommendForTraining += 0.35;
  }
  if (features.demoMode) {
    wouldUseInClassroom += 0.55;
    trainingValue += 0.25;
  }
  if (features.songMeterSafari) {
    trainingValue += 0.55;
    scientificCredibility += 0.45;
    wouldRecommendForTraining += 0.25;
  }
  if (features.kaleidoscopePoc) {
    trainingValue += 0.7;
    spectrogramFidelity += 0.55;
    wouldRecommendForTraining += 0.3;
  }
  if (features.idConfidence) {
    spectrogramFidelity += 0.35;
    scientificCredibility += 0.3;
  }
  if (features.phenologyChart) {
    scientificCredibility += 0.85;
    trainingValue += 0.55;
    wouldRecommendForTraining += 0.2;
  }
  if (features.speciesLore) {
    trainingValue += 0.45;
    wouldUseInClassroom += 0.25;
  }
  if (features.clipManifestExport) {
    trainingValue += 0.5;
    scientificCredibility += 0.35;
    wouldRecommendForTraining += 0.2;
  }
  if (features.spectrogramShare) {
    trainingValue += 0.3;
    wouldRecommendForTraining += 0.15;
  }
  if (features.habitatAmbient) {
    scientificCredibility += 0.4;
    trainingValue += 0.35;
  }
  if (features.trainingDisclaimer) {
    scientificCredibility += 0.5;
    wouldUseInClassroom += 0.2;
  }
  if (features.dailyBioBlitz) {
    wouldRecommendForTraining += 0.15;
  }
  if (features.dailyBioBlitzShipped) {
    trainingValue += 0.35;
    wouldRecommendForTraining += 0.2;
  }
  if (features.phenologyGatedTime) {
    scientificCredibility += 0.55;
    trainingValue += 0.4;
  }
  if (features.kaleidoscopeActIV) {
    spectrogramFidelity += 0.85;
    trainingValue += 0.55;
    wouldRecommendForTraining += 0.2;
  }
  if (features.personaJourney) {
    trainingValue += 0.25;
    if (role === 'educator') wouldUseInClassroom += 0.35;
  }
  if (features.personaAutoDemo) {
    if (role === 'educator') wouldUseInClassroom += 0.55;
    trainingValue += 0.2;
  }
  if (features.vectorSpeciesArt) {
    trainingValue += 0.2;
    scientificCredibility += 0.15;
  }
  if (features.interactiveTutorial || features.guidedCoach) {
    trainingValue += 0.35;
    wouldUseInClassroom += 0.25;
  }
  if (features.personaHints && role === 'educator') {
    wouldUseInClassroom += 0.35;
    trainingValue += 0.2;
  }
  if (completed) {
    trainingValue += 1.1;
    wouldRecommendForTraining += 0.65;
    wouldUseInClassroom += 0.45;
  }
  if (recQuality > 0.75 && listenActive) {
    trainingValue += 0.35;
    scientificCredibility += 0.2;
  }
  if (delights.includes('spectrogram_peak_tapped')) {
    spectrogramFidelity += 0.85;
    trainingValue += 0.4;
    wouldRecommendForTraining += 0.25;
  }
  if (delights.includes('stereo_warmth_aha')) {
    trainingValue += 0.3;
    scientificCredibility += 0.15;
  }
  if (delights.includes('interactive_tutorial_complete')) {
    wouldUseInClassroom += 0.2;
  }
  if (delights.includes('kaleidoscope_review_complete')) {
    spectrogramFidelity += 1.15;
    trainingValue += 0.45;
    wouldRecommendForTraining += 0.3;
  }
  if (delights.includes('persona_demo_auto')) {
    wouldUseInClassroom += role === 'educator' ? 0.45 : 0.15;
    trainingValue += 0.2;
  }
  if (delights.includes('daily_bioblitz_assignment')) {
    trainingValue += 0.25;
    spectrogramFidelity += 0.2;
    wouldRecommendForTraining += 0.1;
  }

  const correctCount = journal.filter((j) => j.correct).length;
  if (correctCount >= 5) trainingValue += 0.25;

  const domainFriction = {
    procedural_not_field_recording: () => {
      scientificCredibility -= 1.8;
      trainingValue -= 1.2;
      wouldRecommendForTraining -= 0.55;
    },
    no_snr_display: () => {
      scientificCredibility -= 1.1;
      trainingValue -= 0.7;
      spectrogramFidelity -= 0.35;
    },
    kaleidoscope_gap: () => {
      trainingValue -= role === 'pam_analyst' || role === 'data_scientist' ? 1.4 : 0.9;
      wouldRecommendForTraining -= 0.45;
      scientificCredibility -= 0.5;
    },
    scheduling_not_realistic: () => {
      scientificCredibility -= 0.85;
      trainingValue -= 0.55;
    },
    species_signature_weak: () => {
      spectrogramFidelity -= 1.0;
      scientificCredibility -= 0.65;
      trainingValue -= 0.4;
    },
    no_export_workflow: () => {
      trainingValue -= role === 'pam_analyst' || role === 'field_tech' ? 0.9 : 0.45;
      wouldRecommendForTraining -= 0.3;
    },
    integrity_not_snr: () => {
      scientificCredibility -= 0.75;
      trainingValue -= 0.45;
    },
    time_of_day_button_not_phenology: () => {
      scientificCredibility -= 0.6;
      trainingValue -= 0.35;
    },
    no_confidence_score: () => {
      spectrogramFidelity -= 0.5;
      scientificCredibility -= 0.4;
    },
    quiz_not_analysis: () => {
      trainingValue -= 0.85;
      spectrogramFidelity -= 0.55;
      wouldRecommendForTraining -= 0.35;
    },
    no_demo_mode: () => {
      if (role === 'educator') wouldUseInClassroom -= 1.1;
    },
    listen_cone_too_subtle: () => {
      if (role === 'educator') wouldUseInClassroom -= 0.65;
      trainingValue -= 0.25;
    },
    habitat_incomplete: () => {
      trainingValue -= 0.9;
      wouldRecommendForTraining -= 0.4;
    },
    never_used_listen: () => {
      trainingValue -= 0.55;
      scientificCredibility -= 0.35;
    },
    identify_panel_confusing: () => {
      spectrogramFidelity -= 0.35;
      trainingValue -= 0.3;
    },
  };

  for (const f of friction) {
    domainFriction[f]?.();
  }

  if (playHabit === 'puzzle' && features.interactiveSpectrogram) {
    spectrogramFidelity += 0.25;
    wouldRecommendForTraining += 0.15;
  }
  if (playHabit === 'none' && !features.interactiveTutorial) {
    trainingValue -= 0.35;
  }
  if (role === 'citizen_scientist' && completed) {
    wouldRecommendForTraining += 0.2;
  }
  if (role === 'educator' && features.progressiveDisclosure) {
    wouldUseInClassroom += 0.15;
  }

  trainingValue = clamp(trainingValue, 1, 10);
  scientificCredibility = clamp(scientificCredibility, 1, 10);
  spectrogramFidelity = clamp(spectrogramFidelity, 1, 10);
  wouldRecommendForTraining = clamp(wouldRecommendForTraining, 1, 5);
  wouldUseInClassroom = clamp(wouldUseInClassroom, 1, 5);

  return {
    trainingValue,
    scientificCredibility,
    spectrogramFidelity,
    wouldRecommendForTraining,
    wouldUseInClassroom,
  };
}

/** Fun-plan rubric — researcher cohort evaluating play-for-fun + v2.1 plan gaps. */
export function readFunPlanStatus(features) {
  return {
    listenConeCore: !!(features.stereoWarmthAudio && features.canvasCompass),
    spectrogramPuzzle: !!features.interactiveSpectrogram,
    expeditionArc: features.expeditionArc ? 'shipped' : 'missing',
    fieldReportFinale: features.fieldReportFinale || (features.shareReport ? 'partial' : 'missing'),
    meaningfulFailure: features.meaningfulFailure || (features.speciesLore ? 'partial' : 'missing'),
    heroAudioPerHabitat: features.heroAudioPerHabitat ? 'shipped' : 'missing',
    shareableWinGated: features.shareableWinGated ? 'shipped' : (features.spectrogramShare ? 'partial' : 'missing'),
    powerProgression: (features.powerProgression && features.listenConeProgression) ? 'shipped' : 'missing',
    finalStretchCoach: features.finalStretchCoach ? 'shipped' : 'missing',
    listenConeProgression: features.listenConeProgression ? 'shipped' : 'missing',
    dailyBioBlitzHook: features.dailyBioBlitzShipped ? 'shipped' : (features.dailyBioBlitz ? 'partial' : 'missing'),
    vectorFieldArt: !!features.vectorResearcherArt,
    demoPresentation: !!features.demoMode,
  };
}

export function scoreFunPlanRubric({
  role,
  playHabit,
  completed,
  integrity,
  friction,
  delights,
  features,
  funPlan,
  journal,
  recQuality,
  listenActive,
  logged,
}) {
  let fun = 6.2;
  let wouldRecommendForFun = 3.1;
  let expeditionPacing = 5.5;
  let payoffStrength = 4.8;
  let planConfidence = 5.0;

  if (funPlan.listenConeCore) {
    fun += 1.1;
    wouldRecommendForFun += 0.45;
    planConfidence += 0.8;
  }
  if (funPlan.spectrogramPuzzle) {
    fun += 0.65;
    wouldRecommendForFun += 0.3;
    expeditionPacing += 0.4;
  }
  if (funPlan.vectorFieldArt) {
    fun += 0.35;
    wouldRecommendForFun += 0.12;
  }
  if (funPlan.demoPresentation) {
    fun += 0.2;
    planConfidence += 0.25;
  }
  if (funPlan.dailyBioBlitzHook === 'partial') {
    fun += 0.25;
    wouldRecommendForFun += 0.15;
  }
  if (funPlan.expeditionArc === 'shipped') {
    fun += 0.55;
    expeditionPacing += 0.85;
    wouldRecommendForFun += 0.3;
    payoffStrength += 0.35;
  }
  if (funPlan.heroAudioPerHabitat === 'shipped') {
    fun += 0.4;
    payoffStrength += 0.4;
    wouldRecommendForFun += 0.2;
  }
  if (funPlan.fieldReportFinale === 'shipped' && completed) {
    fun += 0.35;
    payoffStrength += 0.45;
    wouldRecommendForFun += 0.25;
  }
  if (funPlan.powerProgression === 'shipped') {
    expeditionPacing += 0.25;
    planConfidence += 0.2;
  }
  if (funPlan.finalStretchCoach === 'shipped') {
    fun += 0.25;
    expeditionPacing += 0.35;
    payoffStrength += 0.2;
  }
  if (funPlan.listenConeProgression === 'shipped') {
    fun += 0.15;
    wouldRecommendForFun += 0.1;
  }
  if (completed) {
    fun += 0.85;
    wouldRecommendForFun += 0.45;
    payoffStrength += 0.9;
  }
  if (delights.includes('stereo_warmth_aha') || delights.includes('cone_aha_moment')) {
    fun += 0.75;
    wouldRecommendForFun += 0.35;
    planConfidence += 0.5;
  }
  if (delights.includes('spectrogram_peak_tapped')) {
    fun += 0.45;
    expeditionPacing += 0.35;
  }
  if (delights.includes('field_report_share') || delights.includes('field_report_finale')) {
    payoffStrength += 0.55;
    wouldRecommendForFun += 0.2;
  }
  if (delights.includes('boss_act_two') || delights.includes('hero_audio_moment')) {
    fun += 0.3;
    payoffStrength += 0.25;
  }
  if (delights.includes('survey_complete_act_two')) {
    expeditionPacing += 0.3;
    fun += 0.2;
  }
  if (recQuality > 0.75 && listenActive) fun += 0.3;

  const wrongIds = journal.filter((j) => !j.correct).length;
  const correctCount = journal.filter((j) => j.correct).length;
  if (funPlan.expeditionArc !== 'shipped' && correctCount >= 4 && !completed) {
    expeditionPacing -= 0.35;
    friction.push('six_species_grind_too_long');
  } else if (funPlan.expeditionArc === 'shipped' && logged >= 4 && !completed && funPlan.finalStretchCoach !== 'shipped') {
    expeditionPacing -= 0.2;
    friction.push('boss_caller_incomplete');
  }

  const funFriction = {
    no_expedition_arc: () => {
      fun -= 1.1;
      expeditionPacing -= 1.2;
      payoffStrength -= 0.9;
      wouldRecommendForFun -= 0.45;
      planConfidence -= 0.6;
    },
    checklist_not_story: () => {
      fun -= 0.85;
      expeditionPacing -= 1.0;
      wouldRecommendForFun -= 0.35;
    },
    no_hero_audio_moment: () => {
      fun -= playHabit === 'cozy_sim' ? 1.0 : 0.65;
      payoffStrength -= 0.55;
      wouldRecommendForFun -= 0.3;
    },
    procedural_flat_soundscape: () => {
      fun -= 0.45;
      planConfidence -= 0.35;
    },
    wrong_id_no_teachable_punchline: () => {
      fun -= wrongIds > 0 ? 0.55 : 0.25;
      expeditionPacing -= 0.3;
    },
    share_unearned: () => {
      payoffStrength -= 0.4;
      wouldRecommendForFun -= 0.15;
    },
    progression_is_menus_not_power: () => {
      if (playHabit === 'cozy_sim' || playHabit === 'mobile_casual') {
        fun -= 0.7;
        wouldRecommendForFun -= 0.35;
      }
    },
    kaleidoscope_distraction_for_casual: () => {
      if (playHabit !== 'puzzle' && role !== 'pam_analyst' && role !== 'data_scientist' && role !== 'educator') {
        fun -= 0.35;
        expeditionPacing -= 0.2;
      }
    },
    six_species_grind_too_long: () => {
      expeditionPacing -= 0.85;
      fun -= 0.6;
      wouldRecommendForFun -= 0.4;
    },
    boss_caller_incomplete: () => {
      expeditionPacing -= 0.45;
      fun -= 0.35;
      wouldRecommendForFun -= 0.2;
      payoffStrength -= 0.3;
    },
    no_field_report_celebration: () => {
      payoffStrength -= 1.1;
      wouldRecommendForFun -= 0.5;
      if (completed) fun -= 0.35;
    },
    advanced_bar_overwhelming: () => {
      fun -= 0.5;
      expeditionPacing -= 0.25;
      wouldRecommendForFun -= 0.2;
    },
    habitat_incomplete: () => {
      fun -= 0.9;
      wouldRecommendForFun -= 0.45;
      payoffStrength -= 0.65;
    },
    never_used_listen: () => {
      fun -= 0.8;
      wouldRecommendForFun -= 0.4;
    },
    procedural_not_field_recording: () => {
      planConfidence -= 0.25;
    },
  };

  for (const f of friction) funFriction[f]?.();

  if (playHabit === 'cozy_sim' && funPlan.heroAudioPerHabitat === 'shipped') {
    fun += 0.45;
    wouldRecommendForFun += 0.25;
  }
  if (playHabit === 'inaturalist' && funPlan.shareableWinGated === 'shipped') {
    wouldRecommendForFun += 0.35;
    payoffStrength += 0.4;
  }
  if (playHabit === 'puzzle' && funPlan.meaningfulFailure === 'shipped') {
    fun += 0.3;
    expeditionPacing += 0.25;
  }
  if (role === 'educator' && funPlan.expeditionArc === 'shipped') {
    expeditionPacing += 0.35;
    planConfidence += 0.3;
  }
  if (role === 'citizen_scientist' && funPlan.dailyBioBlitzHook === 'shipped') {
    wouldRecommendForFun += 0.25;
  }

  fun = clamp(fun, 1, 10);
  wouldRecommendForFun = clamp(wouldRecommendForFun, 1, 5);
  expeditionPacing = clamp(expeditionPacing, 1, 10);
  payoffStrength = clamp(payoffStrength, 1, 10);
  planConfidence = clamp(planConfidence, 1, 10);

  return { fun, wouldRecommendForFun, expeditionPacing, payoffStrength, planConfidence };
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
    expeditionGate: html.includes('shouldCompleteExpedition') || html.includes('EXPEDITION_REGULAR_TARGET'),
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
    vectorResearcherArt: html.includes('drawFieldResearcher'),
    vectorSpeciesArt: html.includes('drawSpeciesSilhouette'),
    interactiveSpectrogram: html.includes('drawInteractiveSpectrogram') || html.includes('spectrogram-peak'),
    snrMeter: html.includes('id="snr-db"') || html.includes('computeSnrDb'),
    demoMode: html.includes('toggleDemoMode') || html.includes('id="demo-mode-btn"'),
    songMeterSafari: html.includes('id="song-meter-modal"') || html.includes('openSongMeterSafari'),
    kaleidoscopePoc: html.includes('id="kaleidoscope-modal"') || html.includes('openKaleidoscope'),
    idConfidence: html.includes('computeIdConfidence') || html.includes('id-confidence'),
    phenologyChart: html.includes('openPhenologyChart') || html.includes('id="phenology-modal"'),
    speciesLore: html.includes('SPECIES_LORE') || html.includes('showSpeciesLore'),
    clipManifestExport: html.includes('exportClipManifest') || html.includes('buildClipManifest'),
    spectrogramShare: html.includes('shareSpectrogramCard') || html.includes('spectrogram-share'),
    habitatAmbient: html.includes('startHabitatAmbient') || html.includes('HABITAT_NOISE_FLOOR'),
    trainingDisclaimer: html.includes('id="training-disclaimer"'),
    dailyBioBlitz: html.includes('dailyRareSpecies') || html.includes('id="bioblitz-rare"'),
    dailyBioBlitzShipped: html.includes('buildDailyBioBlitzAssignment'),
    progressionMap: html.includes('id="progression-map"'),
    personaDensity: html.includes('applyPersonaDensity') && html.includes('applyPersonaJourney'),
    personaJourney: html.includes('id="persona-chooser"') || html.includes('openPersonaChooser'),
    personaAutoDemo: html.includes('personaAutoDemo') || html.includes('PERSONA_AUTO_DEMO'),
    phenologyGatedTime: html.includes('isExpeditionTimeGated') || html.includes('phenology-gated-time'),
    kaleidoscopeActIV: html.includes('openActFourKaleidoscope') || html.includes('act-four-kaleidoscope'),
    expeditionArc: html.includes('EXPEDITION_REGULAR_TARGET'),
    fieldReportFinale: html.includes('openFieldReportFinale') ? 'shipped' : 'missing',
    heroAudioPerHabitat: html.includes('playHeroCall'),
    shareableWinGated: html.includes('expeditionComplete'),
    meaningfulFailure: html.includes('showSpeciesMissLore') ? 'shipped' : 'missing',
    powerProgression: html.includes('KALEIDOSCOPE_EXPEDITION_GATE') && html.includes('getListenConeScale'),
    kaleidoscopePersonaGated: html.includes('KALEIDOSCOPE_TRAINING_PERSONAS') && html.includes('isKaleidoscopeEligible'),
    finalStretchCoach: html.includes('updateFinalStretchCoach'),
    listenConeProgression: html.includes('getListenConeScale') && html.includes('CONE_WIDEN_EXPEDITION_GATE'),
  };
}