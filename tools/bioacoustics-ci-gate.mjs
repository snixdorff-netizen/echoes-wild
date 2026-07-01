#!/usr/bin/env node
/**
 * CI gate — bioacoustics panel must meet training recommend bar before release.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readShippedFeaturesFromHtml } from './echoes-core.mjs';
import { driveBioacousticsSession } from './bioacoustics-sim-drive.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const features = readShippedFeaturesFromHtml(html);
const build = (html.match(/BUILD_VERSION = '([^']+)'/) || [])[1] || 'unknown';

const MIN_TRAINING_RECOMMEND = Number(process.env.BIOACOUSTICS_MIN_RECOMMEND || 4.5);
const MIN_TRAINING_VALUE = Number(process.env.BIOACOUSTICS_MIN_VALUE || 8.5);
const PANEL_SIZE = 35;

function seededRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

const roles = ['pam_analyst', 'field_tech', 'grad_student', 'educator', 'citizen_scientist'];
const sessions = [];
for (let i = 0; i < PANEL_SIZE; i++) {
  const rng = seededRng(9900 + i * 13);
  sessions.push(driveBioacousticsSession({
    engineer: { id: `ci_${i}`, role: roles[i % roles.length], playHabit: 'puzzle' },
    features,
    skill: 0.82 + rng() * 0.12,
    rng,
    habitat: ['forest', 'marsh', 'canyon'][i % 3],
  }));
}

const mean = (k) => sessions.reduce((a, s) => a + s.scores[k], 0) / sessions.length;
const agg = {
  build,
  count: sessions.length,
  meanTrainingValue: mean('trainingValue'),
  meanRecommendForTraining: mean('wouldRecommendForTraining'),
  meanScientificCredibility: mean('scientificCredibility'),
  completionRate: sessions.filter((s) => s.completed).length / sessions.length,
};

const failures = [];
if (agg.meanRecommendForTraining < MIN_TRAINING_RECOMMEND) {
  failures.push(`training recommend ${agg.meanRecommendForTraining.toFixed(2)} < ${MIN_TRAINING_RECOMMEND}`);
}
if (agg.meanTrainingValue < MIN_TRAINING_VALUE) {
  failures.push(`training value ${agg.meanTrainingValue.toFixed(2)} < ${MIN_TRAINING_VALUE}`);
}

if (failures.length) {
  console.error('Bioacoustics CI gate FAILED');
  console.error('  build:', build);
  console.error('  ', failures.join('; '));
  console.error('  aggregate:', JSON.stringify(agg, null, 2));
  process.exit(1);
}

console.log('Bioacoustics CI gate passed');
console.log('  build:', build);
console.log('  training recommend:', agg.meanRecommendForTraining.toFixed(2));
console.log('  training value:', agg.meanTrainingValue.toFixed(2));
console.log('  scientific credibility:', agg.meanScientificCredibility.toFixed(2));