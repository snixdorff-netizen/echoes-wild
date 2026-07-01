import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SEGMENTS,
  runPlayerSession,
  readShippedFeaturesFromHtml,
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

describe('100-player session model', () => {
  it('general segment completes habitat with shipped features', () => {
    const session = runPlayerSession({
      segment: 'general',
      persona: 'liam',
      habitat: 'forest',
      timeOfDay: 'dawn',
      skill: 0.82,
      usesMobileHud: true,
      features,
      rng: seededRandom(42),
    });
    assert.equal(session.completed, true);
    assert.equal(session.logged, 6);
    assert.ok(session.scores.wouldRecommend >= 4.5);
    assert.ok(session.scores.fun >= 8.0);
  });

  it('all segments pass 5-star thresholds in aggregate sample', () => {
    const rand = seededRandom(99);
    const bySegment = {};
    for (const [key, seg] of Object.entries(SEGMENTS)) {
      const sessions = [];
      for (let i = 0; i < seg.count; i++) {
        sessions.push(
          runPlayerSession({
            segment: key,
            persona: seg.persona,
            habitat: ['forest', 'marsh', 'canyon'][i % 3],
            timeOfDay: ['dawn', 'day', 'dusk', 'night'][i % 4],
            skill: { naturalist: 0.92, educator: 0.88, gamer: 0.9, general: 0.82 }[key] + (i % 5) * 0.01,
            usesMobileHud: i % 3 === 0,
            features,
            rng: rand,
          }),
        );
      }
      const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
      bySegment[key] = {
        meanFun: mean(sessions.map((s) => s.scores.fun)),
        meanWouldRecommend: mean(sessions.map((s) => s.scores.wouldRecommend)),
        completionRate: sessions.filter((s) => s.completed).length / sessions.length,
      };
    }

    for (const [key, stats] of Object.entries(bySegment)) {
      assert.ok(stats.meanFun >= 8.0, `${key} fun ${stats.meanFun}`);
      assert.ok(stats.meanWouldRecommend >= 4.5, `${key} recommend ${stats.meanWouldRecommend}`);
      assert.ok(stats.completionRate >= 0.95, `${key} completion ${stats.completionRate}`);
    }
  });
});