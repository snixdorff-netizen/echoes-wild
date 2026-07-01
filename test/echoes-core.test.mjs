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
  markHabitatDone,
  personaHint,
  initAnimals,
  computeCallWarmth,
} from '../tools/echoes-core.mjs';

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
  it('triggers at 6 logged species', () => {
    assert.equal(shouldCompleteExpedition(5), false);
    assert.equal(shouldCompleteExpedition(6), true);
    assert.equal(shouldCompleteExpedition(7), true);
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

describe('angleDiff helper', () => {
  it('is minimal when facing target', () => {
    const d = angleDiff(Math.PI / 4, Math.PI / 4);
    assert.ok(d < 0.01);
  });
});