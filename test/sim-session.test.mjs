import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SEGMENTS,
  runPlayerSession,
  readShippedFeaturesFromHtml,
  tickAnimals,
  applyDashScare,
  selectRecordingTarget,
  initAnimals,
} from '../tools/echoes-core.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const features = readShippedFeaturesFromHtml(html);

function seededRandom(s) {
  let state = s;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

describe('tick field physics', () => {
  it('animal bob moves positions each tick', () => {
    const animals = initAnimals('forest').map((a) => ({ ...a, bobPhase: 0 }));
    const after = tickAnimals(animals, 3);
    assert.notEqual(after[0].x, animals[0].x);
  });

  it('dash scare pushes nearby animals and can lower record quality', () => {
    const animals = initAnimals('forest');
    const target = animals[0];
    const player = { x: target.x - 40, y: target.y, facing: 0, listenActive: true };
    const before = selectRecordingTarget(player, animals, 'dawn').quality;
    const scared = applyDashScare(player, animals);
    const after = selectRecordingTarget(player, scared, 'dawn').quality;
    assert.ok(scared[0].x > animals[0].x);
    assert.ok(after <= before);
  });
});

describe('100-player session model', () => {
  it('sessions use more than six attempts when IDs miss', () => {
    const rng = seededRandom(12);
    let sawExtraAttempts = false;
    for (let i = 0; i < 30; i++) {
      const session = runPlayerSession({
        segment: 'general',
        persona: 'liam',
        habitat: 'forest',
        timeOfDay: 'dawn',
        skill: 0.8,
        usesMobileHud: false,
        features,
        rng,
      });
      if (session.attempts > 6) sawExtraAttempts = true;
    }
    assert.ok(sawExtraAttempts, 'expected some sessions with >6 record attempts');
  });

  it('effective clip quality varies with listen timing and dash friction', () => {
    const qualities = new Set();
    for (let seed = 1; seed <= 24; seed++) {
      const session = runPlayerSession({
        segment: seed % 3 === 0 ? 'gamer' : 'general',
        persona: 'liam',
        habitat: ['forest', 'marsh', 'canyon'][seed % 3],
        timeOfDay: ['dawn', 'day', 'dusk', 'night'][seed % 4],
        skill: 0.72 + (seed % 4) * 0.04,
        usesMobileHud: seed % 4 === 0,
        features,
        rng: seededRandom(seed),
      });
      for (const entry of session.journal) qualities.add(entry.quality.toFixed(2));
    }
    assert.ok(qualities.size >= 3, `expected quality spread, got ${[...qualities].join(', ')}`);
  });

  it('aggregate sample meets plan thresholds (fun ≥9, recommend ≥4.5, segment fun ≥8)', () => {
    const rand = seededRandom(99);
    const all = [];
    const bySegment = {};
    for (const [key, seg] of Object.entries(SEGMENTS)) {
      const sessions = [];
      for (let i = 0; i < seg.count; i++) {
        const s = runPlayerSession({
          segment: key,
          persona: seg.persona,
          habitat: ['forest', 'marsh', 'canyon'][i % 3],
          timeOfDay: ['dawn', 'day', 'dusk', 'night'][i % 4],
          skill: { naturalist: 0.92, educator: 0.88, gamer: 0.9, general: 0.82 }[key] + (i % 5) * 0.01,
          usesMobileHud: i % 3 === 0,
          features,
          rng: rand,
        });
        sessions.push(s);
        all.push(s);
      }
      const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
      bySegment[key] = {
        meanFun: mean(sessions.map((s) => s.scores.fun)),
        meanWouldRecommend: mean(sessions.map((s) => s.scores.wouldRecommend)),
        completionRate: sessions.filter((s) => s.completed).length / sessions.length,
      };
    }

    const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const aggregate = {
      meanFun: mean(all.map((s) => s.scores.fun)),
      meanWouldRecommend: mean(all.map((s) => s.scores.wouldRecommend)),
    };

    assert.ok(aggregate.meanFun >= 9.0, `aggregate fun ${aggregate.meanFun}`);
    assert.ok(aggregate.meanWouldRecommend >= 4.5, `aggregate recommend ${aggregate.meanWouldRecommend}`);
    for (const [key, stats] of Object.entries(bySegment)) {
      assert.ok(stats.meanFun >= 8.0, `${key} fun ${stats.meanFun}`);
    }
  });
});