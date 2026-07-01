#!/usr/bin/env node
/**
 * 100-player war room: red team (critical novices), blue team (countermeasures), pre-mortem.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEGMENTS, readShippedFeaturesFromHtml } from './echoes-core.mjs';
import { driveFieldSession } from './sim-drive.mjs';
import { driveCriticalSession } from './critical-sim-drive.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const scratch =
  process.env.ECHOES_SCRATCH ||
  process.argv[2] ||
  join(root, '.scratch');
mkdirSync(scratch, { recursive: true });

const html = readFileSync(join(root, 'index.html'), 'utf8');
const features = readShippedFeaturesFromHtml(html);
const build = (html.match(/BUILD_VERSION = '([^']+)'/) || [])[1] || 'unknown';

function seededRandom(s) {
  let state = s;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function runCohort(driver, seed, skillScale = 1) {
  const players = [];
  let id = 0;
  for (const [segmentKey, seg] of Object.entries(SEGMENTS)) {
    for (let i = 0; i < seg.count; i++) {
      id += 1;
      const skillBySegment = {
        naturalist: 0.88,
        educator: 0.84,
        gamer: 0.86,
        general: 0.62,
      };
      const session = driver({
        segment: segmentKey,
        persona: seg.persona,
        habitat: ['forest', 'marsh', 'canyon'][i % 3],
        timeOfDay: ['dawn', 'day', 'dusk', 'night'][i % 4],
        skill: skillBySegment[segmentKey] * skillScale + (i % 5) * 0.01,
        usesMobileHud: i % 2 === 0,
        features,
        rng: seededRandom(seed + id * 17),
      });
      players.push({ id, segment: segmentKey, persona: seg.persona, ...session });
    }
  }
  return players;
}

const redPlayers = runCohort(driveCriticalSession, 9001, 0.85);
const bluePlayers = runCohort(driveFieldSession, 42, 1);

function summarize(players, label) {
  const bySegment = {};
  for (const key of Object.keys(SEGMENTS)) {
    const subset = players.filter((p) => p.segment === key);
    bySegment[key] = {
      label: SEGMENTS[key].label,
      count: subset.length,
      meanFun: mean(subset.map((p) => p.scores.fun)),
      meanClarity: mean(subset.map((p) => p.scores.clarity)),
      meanWouldRecommend: mean(subset.map((p) => p.scores.wouldRecommend)),
      completionRate: subset.filter((p) => p.completed).length / subset.length,
      topFriction: topCounts(subset.flatMap((p) => p.friction || [])),
      topConfusion: topCounts(subset.flatMap((p) => p.confusion || [])),
    };
  }
  return {
    label,
    playerCount: players.length,
    aggregate: {
      meanFun: mean(players.map((p) => p.scores.fun)),
      meanClarity: mean(players.map((p) => p.scores.clarity)),
      meanEnthusiasm: mean(players.map((p) => p.scores.enthusiasm)),
      meanWouldRecommend: mean(players.map((p) => p.scores.wouldRecommend)),
      completionRate: players.filter((p) => p.completed).length / players.length,
    },
    bySegment,
  };
}

function topCounts(arr) {
  const m = {};
  for (const x of arr) m[x] = (m[x] || 0) + 1;
  return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ flag: k, count: v }));
}

const red = summarize(redPlayers, 'red_team_critical_novices');
const blue = summarize(bluePlayers, 'blue_team_recruitment_skill');

const redFindings = [
  { severity: 'critical', issue: 'Controls overload', evidence: red.topFriction?.find((f) => f.flag === 'controls_overwhelming') || red.bySegment.general.topFriction[0], impact: 'Players cannot find Listen/Record on desktop' },
  { severity: 'critical', issue: 'Visual fidelity', evidence: { flag: 'poor_visual_fidelity', count: redPlayers.filter((p) => p.friction.includes('poor_visual_fidelity')).length }, impact: 'Low-res sprites read as placeholder art' },
  { severity: 'high', issue: 'Loop comprehension', evidence: red.bySegment.general.topConfusion, impact: 'Skip onboarding → never understand explore→listen→record→identify' },
  { severity: 'high', issue: 'Spatial disorientation', evidence: { flag: 'cant_find_animals', count: redPlayers.filter((p) => (p.confusion || []).includes('cant_find_animals')).length }, impact: 'No on-canvas compass; callers invisible in clutter' },
  { severity: 'medium', issue: 'Grip/charge mechanic', evidence: { flag: 'dash_scared_caller', count: redPlayers.filter((p) => p.friction.includes('dash_scared_caller')).length }, impact: 'Accidental dash scares wildlife (gamers)' },
];

const blueCountermeasures = [
  { fix: 'Always-visible Control Dock (Listen / Record / Time)', targets: ['controls_overwhelming', 'recorded_before_listening'], status: features.controlDock ? 'shipped' : 'planned' },
  { fix: 'Mission bar (Explore → Listen → Record → Identify → Report)', targets: ['unclear_goal', 'never_understood_loop'], status: features.missionBar ? 'shipped' : 'planned' },
  { fix: 'Interactive guided coach (first expedition)', targets: ['skipped_guided_coach', 'skipped_onboarding'], status: features.guidedCoach ? 'shipped' : 'planned' },
  { fix: 'Canvas compass arrow + calling-animal glow labels', targets: ['cant_find_animals', 'lost_in_habitat'], status: features.canvasCompass ? 'shipped' : 'planned' },
  { fix: 'Enhanced habitat rendering (sky, parallax, halos)', targets: ['poor_visual_fidelity'], status: features.enhancedGraphics ? 'shipped' : 'planned' },
];

const premortem = {
  sixMonthsOut: [
    { failure: 'App Store 2.8★ — "pretty but confusing"', cause: 'No interactive tutorial; text-only onboarding', prevention: 'Guided coach + mission bar' },
    { failure: 'Educators abandon after 3 minutes', cause: 'Cannot demonstrate listen cone in classroom', prevention: 'Canvas compass + larger listen wedge' },
    { failure: 'Viral clip mocks "MS Paint birding game"', cause: 'JPEG sprite artifacts', prevention: 'Procedural glow markers + habitat depth' },
    { failure: 'Simulation lied — real playtests fail', cause: 'Rubric bonuses for feature flags not UX', prevention: 'Critical novice cohort + honest friction penalties' },
  ],
  launchWeek: [
    { failure: 'Zero completions on mobile Safari', cause: 'HUD hidden on desktop viewport', prevention: 'Control dock always visible' },
    { failure: 'Players record before listening', cause: 'Record button more prominent than Listen', prevention: 'Coach gates Record until Listen held 2s' },
  ],
};

const report = {
  generatedAt: new Date().toISOString(),
  build,
  features,
  redTeam: { ...red, findings: redFindings, passed: red.aggregate.meanFun >= 9 && red.aggregate.meanWouldRecommend >= 4.5 },
  blueTeam: { ...blue, countermeasures: blueCountermeasures, passed: blue.aggregate.meanFun >= 9 && blue.aggregate.meanWouldRecommend >= 4.5 },
  premortem,
  delta: {
    fun: blue.aggregate.meanFun - red.aggregate.meanFun,
    recommend: blue.aggregate.meanWouldRecommend - red.aggregate.meanWouldRecommend,
    completion: blue.aggregate.completionRate - red.aggregate.completionRate,
  },
  verdict: red.aggregate.meanWouldRecommend < 4.0
    ? 'RED TEAM WINS — ship blocked until UX/visual fixes land'
    : 'Red team mitigated — monitor general segment',
};

writeFileSync(join(scratch, 'war-room-report.json'), JSON.stringify(report, null, 2));
writeFileSync(
  join(scratch, 'war-room-summary.md'),
  `# ECHOES War Room — ${build}\n\n## Red Team (100 critical novices)\n- Fun: ${red.aggregate.meanFun.toFixed(2)}/10\n- Recommend: ${red.aggregate.meanWouldRecommend.toFixed(2)}/5\n- Completion: ${(red.aggregate.completionRate * 100).toFixed(0)}%\n\n## Blue Team (100 recruitment skill)\n- Fun: ${blue.aggregate.meanFun.toFixed(2)}/10\n- Recommend: ${blue.aggregate.meanWouldRecommend.toFixed(2)}/5\n- Completion: ${(blue.aggregate.completionRate * 100).toFixed(0)}%\n\n## Pre-mortem top risk\n${premortem.sixMonthsOut[0].failure}\n`,
);

console.log('ECHOES war room complete');
console.log('  build:', build);
console.log('  RED  fun', red.aggregate.meanFun.toFixed(2), 'recommend', red.aggregate.meanWouldRecommend.toFixed(2), 'completion', (red.aggregate.completionRate * 100).toFixed(0) + '%');
console.log('  BLUE fun', blue.aggregate.meanFun.toFixed(2), 'recommend', blue.aggregate.meanWouldRecommend.toFixed(2), 'completion', (blue.aggregate.completionRate * 100).toFixed(0) + '%');
console.log('  wrote:', join(scratch, 'war-room-report.json'));
process.exit(0);