import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  angleDiff,
  scoreAnimalTarget,
  clipQualityFromScore,
  selectRecordingTarget,
  qualityLabel,
  integrityGain,
  integrityLoss,
  applyIdentification,
  shouldCompleteExpedition,
  getBossTimeOfDay,
  bossActiveAtTime,
  getBossSpeciesId,
  markHabitatDone,
  personaHint,
  initAnimals,
  computeCallWarmth,
  buildSpectrogramPeaks,
  scoreBioacousticsRubric,
  scoreFunPlanRubric,
  readFunPlanStatus,
  computeSnrDb,
  computeIdConfidence,
  buildPhenologyMatrix,
  buildClipManifest,
  dailyRareSpecies,
  isExpeditionTimeGated,
  buildDailyBioBlitzAssignment,
  buildKaleidoscopeClipsFromJournal,
  isTrainingPersona,
  readShippedFeaturesFromHtml,
  bioacousticsFeatureFlagsV231,
  bioacousticsFeatureFlagsV24,
  EXPEDITION_REGULAR_TARGET,
} from '../tools/echoes-core.mjs';
import {
  proveBioacousticsV24Causation,
  driveBioacousticsSession,
  seededBioRng,
} from '../tools/bioacoustics-sim-drive.mjs';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('recording quality scoring', () => {
  const animal = { x: 200, y: 300, activity: ['dawn', 'day'], species: { id: 'cardinal' } };

  it('scores higher when close, facing, and listening', () => {
    const nearListen = scoreAnimalTarget(
      { x: 170, y: 285, facing: Math.atan2(15, 30), listenActive: true },
      animal,
      'dawn',
    );
    const farNoListen = scoreAnimalTarget(
      { x: 500, y: 500, facing: 0, listenActive: false },
      animal,
      'dawn',
    );
    assert.ok(nearListen > farNoListen);
    assert.ok(clipQualityFromScore(nearListen) > clipQualityFromScore(farNoListen));
  });

  it('selectRecordingTarget picks active-time animal with best score', () => {
    const animals = initAnimals('forest');
    const player = { x: 125, y: 285, facing: Math.atan2(5, 5), listenActive: true };
    const rec = selectRecordingTarget(player, animals, 'dawn');
    assert.equal(rec.dominant.species.id, 'cardinal');
    assert.ok(rec.quality >= 0.35 && rec.quality <= 1);
  });
});

describe('identification outcomes', () => {
  it('correct ID increases logged count and integrity', () => {
    const out = applyIdentification({
      chosenId: 'owl',
      dominantId: 'owl',
      quality: 0.9,
      logged: 2,
      integrity: 88,
    });
    assert.equal(out.correct, true);
    assert.equal(out.logged, 3);
    assert.equal(out.integrity, 88 + integrityGain(0.9));
    assert.equal(out.delta, integrityGain(0.9));
  });

  it('miss ID reduces integrity with floor at 35', () => {
    const out = applyIdentification({
      chosenId: 'bat',
      dominantId: 'owl',
      quality: 0.8,
      logged: 4,
      integrity: 40,
    });
    assert.equal(out.correct, false);
    assert.equal(out.logged, 4);
    assert.equal(out.integrity, Math.max(35, 40 - integrityLoss(0.8)));
  });

  it('integrity cannot drop below 35', () => {
    const out = applyIdentification({
      chosenId: 'bat',
      dominantId: 'owl',
      quality: 0.5,
      logged: 1,
      integrity: 36,
    });
    assert.equal(out.integrity, 35);
  });
});

describe('expedition completion gate', () => {
  it('requires 4 survey logs plus boss', () => {
    assert.equal(shouldCompleteExpedition(3, false), false);
    assert.equal(shouldCompleteExpedition(4, false), false);
    assert.equal(shouldCompleteExpedition(4, true), true);
    assert.equal(shouldCompleteExpedition(5, true), true);
  });
});

describe('boss time-of-day edge cases', () => {
  it('peeper boss prefers night when current time is day', () => {
    assert.equal(bossActiveAtTime('peeper', 'day'), false);
    assert.equal(bossActiveAtTime('peeper', 'night'), true);
    assert.equal(getBossTimeOfDay('peeper', 'day'), 'night');
  });

  it('owl boss falls back from dawn to dusk', () => {
    assert.equal(getBossTimeOfDay('owl', 'dawn'), 'dusk');
    assert.equal(getBossTimeOfDay('owl', 'dusk'), 'dusk');
  });

  it('marsh habitat boss resolves to peeper', () => {
    assert.equal(getBossSpeciesId('marsh'), 'peeper');
    assert.equal(getBossTimeOfDay(getBossSpeciesId('marsh'), 'day'), 'night');
  });
});

describe('applyIdentification expedition arc', () => {
  it('boss log completes only after survey target', () => {
    const boss = applyIdentification({
      chosenId: 'owl',
      dominantId: 'owl',
      quality: 0.8,
      logged: 4,
      integrity: 90,
      bossLogged: false,
      habitat: 'forest',
    });
    assert.equal(boss.bossLogged, true);
    assert.equal(boss.logged, 4);
    const early = applyIdentification({
      chosenId: 'owl',
      dominantId: 'owl',
      quality: 0.8,
      logged: 2,
      integrity: 90,
      bossLogged: false,
      habitat: 'forest',
    });
    assert.equal(early.logged, 3);
    assert.equal(early.isBossEarly, true);
  });

  it('bonus log after survey does not advance toward boss', () => {
    const bonus = applyIdentification({
      chosenId: 'cardinal',
      dominantId: 'cardinal',
      quality: 0.7,
      logged: 4,
      integrity: 88,
      bossLogged: false,
      habitat: 'forest',
    });
    assert.equal(bonus.bonusLog, true);
    assert.equal(bonus.logged, 4);
    assert.equal(bonus.bossLogged, false);
  });
});

describe('habitat tracking', () => {
  it('adds habitat without duplicates', () => {
    let done = markHabitatDone([], 'forest');
    assert.deepEqual(done, ['forest']);
    done = markHabitatDone(done, 'marsh');
    assert.deepEqual(done, ['forest', 'marsh']);
    done = markHabitatDone(done, 'forest');
    assert.deepEqual(done, ['forest', 'marsh']);
  });
});

describe('persona hints', () => {
  it('returns segment-appropriate copy', () => {
    assert.ok(personaHint('aisha', 'learn').includes('directional'));
    assert.ok(personaHint('elena', 'miss').includes('spectrogram'));
  });
});

describe('quality labels', () => {
  it('maps thresholds to CLEAN/FAIR/NOISY', () => {
    assert.equal(qualityLabel(0.9), 'CLEAN');
    assert.equal(qualityLabel(0.6), 'FAIR');
    assert.equal(qualityLabel(0.4), 'NOISY');
  });
});

describe('buildSpectrogramPeaks', () => {
  it('marks first peak as key for dominant species', () => {
    const peaks = buildSpectrogramPeaks({
      dominant: { id: 'owl' },
      quality: 0.8,
      timeOfDay: 'dusk',
    });
    assert.ok(peaks.length >= 1);
    assert.equal(peaks[0].isKey, true);
    assert.equal(peaks[0].speciesId, 'owl');
    assert.ok(peaks[0].xNorm > 0 && peaks[0].xNorm < 1);
  });
});

describe('computeCallWarmth', () => {
  it('returns higher warmth when listening and facing caller', () => {
    const animal = { x: 200, y: 300 };
    const facing = Math.atan2(15, 30);
    const warm = computeCallWarmth({ x: 170, y: 285, facing, listenActive: true }, animal);
    const cold = computeCallWarmth({ x: 500, y: 500, facing: 0, listenActive: false }, animal);
    assert.ok(warm.warmth > cold.warmth);
    assert.ok(warm.vol > cold.vol);
  });
});

describe('computeSnrDb', () => {
  it('returns higher dB when listening and facing caller', () => {
    const animal = { x: 200, y: 300 };
    const facing = Math.atan2(15, 30);
    const hot = computeSnrDb({ x: 170, y: 285, facing, listenActive: true }, animal, true);
    const cold = computeSnrDb({ x: 500, y: 500, facing: 0, listenActive: false }, animal, false);
    assert.ok(hot > cold);
    assert.ok(hot >= 8 && hot <= 32);
  });
});

describe('computeIdConfidence', () => {
  it('increases with peak tap and likely match', () => {
    const base = computeIdConfidence({ quality: 0.6, peakTapped: false, isLikely: false });
    const boosted = computeIdConfidence({ quality: 0.8, peakTapped: true, isLikely: true });
    assert.ok(boosted > base);
    assert.ok(boosted <= 98);
  });
});

describe('buildPhenologyMatrix', () => {
  it('marks species active per time window', () => {
    const matrix = buildPhenologyMatrix();
    const dawn = matrix.find((r) => r.time === 'dawn');
    assert.ok(dawn.species.includes('cardinal'));
    assert.ok(dawn.species.includes('peeper'));
  });
});

describe('buildClipManifest', () => {
  it('emits CSV header and rows', () => {
    const csv = buildClipManifest([
      { species: { id: 'owl', name: 'Barred Owl' }, time: 'dusk', quality: 0.8, correct: true, snrDb: 18, confidence: 82, timestamp: 't1' },
    ], { habitat: 'forest' });
    assert.ok(csv.includes('species_id'));
    assert.ok(csv.includes('owl'));
    assert.ok(csv.includes('forest'));
  });
});

describe('dailyRareSpecies', () => {
  it('returns deterministic species for a date', () => {
    const a = dailyRareSpecies(new Date('2026-07-01'));
    const b = dailyRareSpecies(new Date('2026-07-01'));
    assert.equal(a.id, b.id);
  });
});

describe('v2.4 bioacoustics pipeline helpers', () => {
  it('isExpeditionTimeGated blocks free skip during survey, exempts boss phase', () => {
    assert.equal(isExpeditionTimeGated({ logged: 2, bossLogged: false }), true);
    assert.equal(
      isExpeditionTimeGated({ logged: EXPEDITION_REGULAR_TARGET, bossLogged: false, bossPhaseActive: true }),
      false,
    );
    assert.equal(isExpeditionTimeGated({ expeditionComplete: true }), false);
  });

  it('buildDailyBioBlitzAssignment returns persona-flavored copy', () => {
    const liam = buildDailyBioBlitzAssignment({ persona: 'liam', date: new Date('2026-07-01'), streak: 3 });
    const aisha = buildDailyBioBlitzAssignment({ persona: 'aisha', date: new Date('2026-07-01') });
    assert.ok(liam.headline.includes('BioBlitz'));
    assert.ok(liam.headline.includes(liam.rare.name));
    assert.ok(aisha.headline.includes('Family Chorus'));
    assert.ok(liam.compassHint.includes('streak 3'));
  });

  it('buildKaleidoscopeClipsFromJournal uses expedition journal not samples', () => {
    const journal = [
      { correct: true, species: { id: 'owl', name: 'Barred Owl' }, quality: 0.82 },
      { correct: true, species: { id: 'cardinal', name: 'Northern Cardinal' }, quality: 0.71 },
      { correct: false, species: { id: 'bat', name: 'Bat' }, quality: 0.5 },
    ];
    const built = buildKaleidoscopeClipsFromJournal(journal, { minClips: 2 });
    assert.equal(built.fromJournal, true);
    assert.equal(built.clips.length, 2);
    assert.equal(built.clips[0].speciesId, 'owl');
  });

  it('Act IV path accepts single journal clip when expedition complete (minClips bypass via caller)', () => {
    const journal = [
      { correct: true, species: { id: 'peeper', name: 'Spring Peeper' }, quality: 0.88 },
    ];
    const built = buildKaleidoscopeClipsFromJournal(journal, { minClips: 1 });
    assert.equal(built.fromJournal, true);
    assert.equal(built.clips.length, 1);
    assert.equal(built.clips[0].speciesId, 'peeper');
    assert.equal(built.needsSamples, false);
  });

  it('isTrainingPersona gates training tools personas', () => {
    assert.equal(isTrainingPersona('aisha'), true);
    assert.equal(isTrainingPersona('liam'), false);
  });

  it('scoreBioacousticsRubric lifts spectrogram fidelity with v2.4 delights', () => {
    const base = scoreBioacousticsRubric({
      role: 'pam_analyst',
      completed: true,
      integrity: 90,
      friction: [],
      delights: ['spectrogram_peak_tapped'],
      features: { interactiveSpectrogram: true, kaleidoscopePoc: true },
      journal: Array.from({ length: 5 }, () => ({ correct: true })),
      recQuality: 0.8,
      listenActive: true,
      playHabit: 'puzzle',
    });
    const v24 = scoreBioacousticsRubric({
      role: 'pam_analyst',
      completed: true,
      integrity: 90,
      friction: [],
      delights: ['spectrogram_peak_tapped', 'kaleidoscope_review_complete', 'daily_bioblitz_assignment'],
      features: {
        interactiveSpectrogram: true,
        kaleidoscopePoc: true,
        kaleidoscopeActIV: true,
        dailyBioBlitzShipped: true,
        phenologyGatedTime: true,
      },
      journal: Array.from({ length: 5 }, () => ({ correct: true })),
      recQuality: 0.8,
      listenActive: true,
      playHabit: 'puzzle',
    });
    assert.ok(v24.spectrogramFidelity >= 9.99);
    assert.ok(v24.spectrogramFidelity > base.spectrogramFidelity);
  });

  it('educator classroom score clears with persona auto-demo delight', () => {
    const scores = scoreBioacousticsRubric({
      role: 'educator',
      completed: true,
      integrity: 88,
      friction: [],
      delights: ['persona_demo_auto', 'interactive_tutorial_complete'],
      features: { demoMode: true, personaAutoDemo: true, personaJourney: true, guidedCoach: true },
      journal: Array.from({ length: 5 }, () => ({ correct: true })),
      recQuality: 0.78,
      listenActive: true,
      playHabit: 'puzzle',
    });
    assert.ok(scores.wouldUseInClassroom >= 4.0);
  });

  it('readShippedFeaturesFromHtml detects v2.4 shipped flags in index.html', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    const features = readShippedFeaturesFromHtml(html);
    assert.equal(features.dailyBioBlitzShipped, true);
    assert.equal(features.personaJourney, true);
    assert.equal(features.phenologyGatedTime, true);
    assert.equal(features.kaleidoscopeActIV, true);
    assert.equal(features.personaAutoDemo, true);
    assert.ok(html.includes("BUILD_VERSION = 'playtest-v2.4-jul2026'"));
    assert.ok(!html.includes('Playtest v2.3'));
  });
});

describe('scoreBioacousticsRubric', () => {
  it('penalizes domain friction and rewards interactive spectrogram', () => {
    const base = scoreBioacousticsRubric({
      role: 'pam_analyst',
      completed: false,
      integrity: 70,
      friction: ['kaleidoscope_gap', 'no_snr_display', 'procedural_not_field_recording'],
      delights: [],
      features: { interactiveSpectrogram: false },
      journal: [],
      recQuality: 0.6,
      listenActive: true,
      playHabit: 'puzzle',
    });
    const improved = scoreBioacousticsRubric({
      role: 'pam_analyst',
      completed: true,
      integrity: 88,
      friction: ['integrity_not_snr'],
      delights: ['spectrogram_peak_tapped'],
      features: { interactiveSpectrogram: true, stereoWarmthAudio: true },
      journal: [{ correct: true }, { correct: true }, { correct: true }, { correct: true }, { correct: true }, { correct: true }],
      recQuality: 0.85,
      listenActive: true,
      playHabit: 'puzzle',
    });
    assert.ok(improved.trainingValue > base.trainingValue);
    assert.ok(improved.spectrogramFidelity > base.spectrogramFidelity);
    assert.ok(improved.wouldRecommendForTraining > base.wouldRecommendForTraining);
  });
});

describe('scoreFunPlanRubric', () => {
  it('penalizes missing expedition arc and rewards projected plan', () => {
    const funPlanGap = {
      listenConeCore: true,
      spectrogramPuzzle: true,
      expeditionArc: 'missing',
      fieldReportFinale: 'partial',
      meaningfulFailure: 'partial',
      heroAudioPerHabitat: 'missing',
      shareableWinGated: 'partial',
      powerProgression: 'missing',
      dailyBioBlitzHook: 'partial',
      vectorFieldArt: true,
      demoPresentation: true,
    };
    const gap = scoreFunPlanRubric({
      role: 'citizen_scientist',
      playHabit: 'cozy_sim',
      completed: true,
      integrity: 90,
      friction: ['no_expedition_arc', 'no_hero_audio_moment', 'no_field_report_celebration'],
      delights: ['stereo_warmth_aha'],
      features: {},
      funPlan: funPlanGap,
      journal: Array.from({ length: 6 }, () => ({ correct: true })),
      recQuality: 0.8,
      listenActive: true,
      logged: 6,
    });
    const shipped = scoreFunPlanRubric({
      role: 'citizen_scientist',
      playHabit: 'cozy_sim',
      completed: true,
      integrity: 90,
      friction: [],
      delights: ['stereo_warmth_aha', 'field_report_share'],
      features: {},
      funPlan: {
        ...funPlanGap,
        expeditionArc: 'shipped',
        heroAudioPerHabitat: 'shipped',
        fieldReportFinale: 'shipped',
        meaningfulFailure: 'shipped',
        shareableWinGated: 'shipped',
        powerProgression: 'shipped',
      },
      journal: Array.from({ length: 4 }, () => ({ correct: true })),
      recQuality: 0.8,
      listenActive: true,
      logged: 4,
    });
    assert.ok(shipped.fun > gap.fun);
    assert.ok(shipped.wouldRecommendForFun > gap.wouldRecommendForFun);
    assert.ok(shipped.payoffStrength > gap.payoffStrength);
  });
});

describe('readFunPlanStatus', () => {
  it('detects missing vs shipped fun-plan pillars from feature flags', () => {
    const status = readFunPlanStatus({
      stereoWarmthAudio: true,
      canvasCompass: true,
      interactiveSpectrogram: true,
      shareReport: true,
      speciesLore: true,
      spectrogramShare: true,
      dailyBioBlitz: true,
      vectorResearcherArt: true,
      demoMode: true,
    });
    assert.equal(status.expeditionArc, 'missing');
    assert.equal(status.heroAudioPerHabitat, 'missing');
    assert.equal(status.powerProgression, 'missing');
    const shipped = readFunPlanStatus({
      expeditionArc: true,
      fieldReportFinale: 'shipped',
      heroAudioPerHabitat: true,
      shareableWinGated: true,
      meaningfulFailure: 'shipped',
      powerProgression: true,
      listenConeProgression: true,
      finalStretchCoach: true,
      stereoWarmthAudio: true,
      canvasCompass: true,
      interactiveSpectrogram: true,
    });
    assert.equal(shipped.expeditionArc, 'shipped');
    assert.equal(shipped.fieldReportFinale, 'shipped');
    assert.equal(shipped.powerProgression, 'shipped');
    assert.equal(shipped.finalStretchCoach, 'shipped');
  });
});

describe('angleDiff helper', () => {
  it('is minimal when facing target', () => {
    const d = angleDiff(Math.PI / 4, Math.PI / 4);
    assert.ok(d < 0.01);
  });
});

describe('bioacoustics v2.4 causation (driveBioacousticsSession + echoes-core rubric)', () => {
  it('v2.3.1 feature flags score below 9.99 fidelity; v2.4 shipped flags score at or above', () => {
    const result = proveBioacousticsV24Causation(88042);
    assert.ok(result.v231Fidelity < 9.99, `v2.3.1 fidelity was ${result.v231Fidelity}`);
    assert.ok(result.v24Fidelity >= 9.99, `v2.4 fidelity was ${result.v24Fidelity}`);
    assert.equal(result.pass, true);
  });

  it('educator session with v2.4 flags clears classroom floor via rubric delights', () => {
    const session = driveBioacousticsSession({
      engineer: { id: 'edu_causation', role: 'educator', playHabit: 'puzzle' },
      features: bioacousticsFeatureFlagsV24(),
      skill: 0.86,
      rng: seededBioRng(9912),
      bossAssist: true,
    });
    assert.ok(session.scores.wouldUseInClassroom >= 4.0);
    assert.ok(session.delights.includes('persona_demo_auto') || session.delights.includes('persona_journey_started'));
  });
});