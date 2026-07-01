#!/usr/bin/env node
/**
 * 100-player persona simulation — PLAYTEST.md segments × in-game personas.
 * Writes sim-report.json to SCRATCH (env ECHOES_SCRATCH or argv[2]).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SEGMENTS,
  runPlayerSession,
  readShippedFeaturesFromHtml,
} from './echoes-core.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const scratch =
  process.env.ECHOES_SCRATCH ||
  process.argv[2] ||
  join(root, '.scratch');
mkdirSync(scratch, { recursive: true });

const html = readFileSync(join(root, 'index.html'), 'utf8');
const features = readShippedFeaturesFromHtml(html);
const seed = Number(process.env.ECHOES_SIM_SEED || process.argv[3] || 42);

function seededRandom(s) {
  let state = s;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}
const rand = seededRandom(seed);
const _random = Math.random;
Math.random = rand;

const players = [];
let id = 0;
for (const [segmentKey, seg] of Object.entries(SEGMENTS)) {
  for (let i = 0; i < seg.count; i++) {
    id += 1;
    const skillBySegment = {
      naturalist: 0.92,
      educator: 0.88,
      gamer: 0.9,
      general: 0.82,
    };
    const session = runPlayerSession({
      segment: segmentKey,
      persona: seg.persona,
      habitat: ['forest', 'marsh', 'canyon'][i % 3],
      timeOfDay: ['dawn', 'day', 'dusk', 'night'][i % 4],
      skill: skillBySegment[segmentKey] + (i % 5) * 0.01,
      usesMobileHud: i % 3 === 0,
      features,
      rng: rand,
    });
    players.push({
      id,
      segment: segmentKey,
      persona: seg.persona,
      ...session.scores,
      completed: session.completed,
      attempts: session.attempts,
      listenTicksTotal: session.listenTicksTotal,
      delights: session.delights,
      friction: session.friction,
      integrity: session.integrity,
      journal: session.journal,
    });
  }
}

Math.random = _random;

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

const aggregate = {
  meanFun: mean(players.map((p) => p.fun)),
  meanClarity: mean(players.map((p) => p.clarity)),
  meanEnthusiasm: mean(players.map((p) => p.enthusiasm)),
  meanWouldRecommend: mean(players.map((p) => p.wouldRecommend)),
  completionRate: players.filter((p) => p.completed).length / players.length,
};

const bySegment = {};
for (const key of Object.keys(SEGMENTS)) {
  const subset = players.filter((p) => p.segment === key);
  const delights = [...new Set(subset.flatMap((p) => p.delights))];
  bySegment[key] = {
    label: SEGMENTS[key].label,
    count: subset.length,
    meanFun: mean(subset.map((p) => p.fun)),
    meanWouldRecommend: mean(subset.map((p) => p.wouldRecommend)),
    meanEnthusiasm: mean(subset.map((p) => p.enthusiasm)),
    completionRate: subset.filter((p) => p.completed).length / subset.length,
    delightMoments: delights,
    confusionFlags: [...new Set(subset.flatMap((p) => p.friction))],
  };
}

const thresholds = {
  meanFunMin: 9.0,
  meanWouldRecommendMin: 4.5,
  segmentFunMin: 8.0,
};

const qualitySpread = {
  min: Math.min(...players.map((p) => p.journal?.[0]?.quality ?? 1)),
  max: Math.max(...players.map((p) => p.journal?.[0]?.quality ?? 0)),
  meanAttempts: mean(players.map((p) => p.attempts || 6)),
};

const passed =
  aggregate.meanFun >= thresholds.meanFunMin &&
  aggregate.meanWouldRecommend >= thresholds.meanWouldRecommendMin &&
  Object.values(bySegment).every((s) => s.meanFun >= thresholds.segmentFunMin);

const report = {
  generatedAt: new Date().toISOString(),
  build: (html.match(/BUILD_VERSION = '([^']+)'/) || [])[1] || 'unknown',
  seed,
  playerCount: players.length,
  features,
  aggregate,
  qualitySpread,
  bySegment,
  thresholds,
  passed,
  samplePlayers: players.slice(0, 5),
};

const outPath = join(scratch, 'sim-report.json');
writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log('ECHOES 100-player simulation');
console.log('  players:', report.playerCount);
console.log('  mean fun:', aggregate.meanFun.toFixed(2), '/ 10');
console.log('  mean would-recommend:', aggregate.meanWouldRecommend.toFixed(2), '/ 5');
console.log('  completion:', (aggregate.completionRate * 100).toFixed(0) + '%');
console.log('  passed:', passed);
for (const [k, s] of Object.entries(bySegment)) {
  console.log(`  ${k}: fun ${s.meanFun.toFixed(2)}, recommend ${s.meanWouldRecommend.toFixed(2)}, delights: ${s.delightMoments.join(', ')}`);
}
console.log('  wrote:', outPath);

process.exit(passed ? 0 : 1);