#!/usr/bin/env node
/**
 * Fun-plan war room: 50 bioacoustics researchers simulate v2.1 fun plan,
 * red/blue review problems, project scores if plan ships.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readShippedFeaturesFromHtml, readFunPlanStatus } from './echoes-core.mjs';
import { driveFunPlanSession, projectFunPlanIfShipped } from './fun-plan-sim-drive.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const scratch = process.env.ECHOES_SCRATCH || process.argv[2] || join(root, '.scratch');
mkdirSync(scratch, { recursive: true });

const PANEL_SIZE = 50;
const WOMEN_TARGET = 0.65;

const html = readFileSync(join(root, 'index.html'), 'utf8');
const features = readShippedFeaturesFromHtml(html);
const funPlanCurrent = readFunPlanStatus(features);
const build = (html.match(/BUILD_VERSION = '([^']+)'/) || [])[1] || 'unknown';

const FIRST_NAMES_W = [
  'Priya', 'Maya', 'Sofia', 'Elena', 'Aisha', 'Rachel', 'Lin', 'Camille', 'Nadia', 'Hannah',
  'Keiko', 'Amara', 'Zoe', 'Tessa', 'Ingrid', 'Mei', 'Fatima', 'Clara', 'Jade', 'Rosa',
  'Lena', 'Anika', 'Beatriz', 'Yuki', 'Naomi',
];
const FIRST_NAMES_M = [
  'Marcus', 'Diego', 'Owen', 'Raj', 'Leo', 'Sam', 'Noah', 'Chen', 'Andre', 'Kai', 'Felix', 'Jonah',
];
const LAST_NAMES = [
  'Okonkwo', 'Patel', 'Nguyen', 'Lindqvist', 'Morales', 'Kim', 'Fischer', 'Santos',
  'Okafor', 'Bergstrom', 'Chen', 'Alvarez', 'Nakamura', 'Dubois', 'Hartley', 'Kowalski',
];

const ROLES = [
  { id: 'pam_analyst', label: 'PAM analyst', weight: 0.18 },
  { id: 'field_tech', label: 'Field technician', weight: 0.15 },
  { id: 'grad_student', label: 'Grad student (bioacoustics)', weight: 0.14 },
  { id: 'educator', label: 'Outreach educator', weight: 0.12 },
  { id: 'citizen_scientist', label: 'Citizen scientist / BioBlitz', weight: 0.1 },
  { id: 'conservation_bio', label: 'Conservation biologist', weight: 0.1 },
  { id: 'audio_engineer', label: 'Field audio engineer', weight: 0.08 },
  { id: 'data_scientist', label: 'Acoustic data scientist', weight: 0.08 },
  { id: 'lab_manager', label: 'Lab manager', weight: 0.05 },
];

const PLAY_HABITS = [
  { id: 'none', label: 'Rarely plays games', weight: 0.22 },
  { id: 'inaturalist', label: 'iNaturalist / Merlin', weight: 0.18 },
  { id: 'puzzle', label: 'Puzzle games', weight: 0.14 },
  { id: 'cozy_sim', label: 'Cozy sims (Alba, Stardew)', weight: 0.14 },
  { id: 'mobile_casual', label: 'Mobile casual', weight: 0.12 },
  { id: 'board_games', label: 'Board games', weight: 0.1 },
];

const FUN_PLAN_PILLARS = [
  { id: 'expeditionArc', title: '18-min 3-act expedition arc', status: funPlanCurrent.expeditionArc, priority: 'P0', effort: 'L',
    detail: 'Explore → tricky caller → Field Report finale; not "log 6 species" checklist.' },
  { id: 'fieldReportFinale', title: 'Cinematic Field Report payoff', status: funPlanCurrent.fieldReportFinale, priority: 'P0', effort: 'M',
    detail: 'Share card gated on site complete — earned brag moment.' },
  { id: 'meaningfulFailure', title: 'Wrong-ID teachable punchline', status: funPlanCurrent.meaningfulFailure, priority: 'P1', effort: 'S',
    detail: 'Lore correction on miss — funny not punishing.' },
  { id: 'heroAudioPerHabitat', title: 'One hero audio moment per habitat', status: funPlanCurrent.heroAudioPerHabitat, priority: 'P0', effort: 'M',
    detail: 'Owl pair / peeper chorus / woodpecker echo — one unmistakable signature each.' },
  { id: 'shareableWinGated', title: 'Share spectrogram only after site clear', status: funPlanCurrent.shareableWinGated, priority: 'P1', effort: 'S',
    detail: 'Unearned share kills viral loop.' },
  { id: 'powerProgression', title: 'Unlock feel (cone width, record window)', status: funPlanCurrent.powerProgression, priority: 'P1', effort: 'M',
    detail: 'Not Kaleidoscope buttons — expedition 2+ gets tangible power.' },
  { id: 'dailyBioBlitzHook', title: 'Single daily rare caller', status: funPlanCurrent.dailyBioBlitzHook, priority: 'P2', effort: 'S',
    detail: 'One surprise per day — already partial.' },
];

const SENIOR_FUN_PANEL = [
  {
    seat: 'red_team',
    name: 'Dr. Ingrid Bergstrom — PAM program lead',
    verdict: 'Fun plan is right but six-species grind kills 18-min pacing — researchers quit at log 4 feeling done',
    attacks: ['F0-01', 'F0-03', 'F1-02'],
    problem: 'Expedition arc must replace checklist before hero audio matters',
  },
  {
    seat: 'red_team',
    name: 'Rosa Alvarez — BioBlitz coordinator',
    verdict: 'Share spectrogram before site clear feels like homework spam not community science win',
    attacks: ['F1-04', 'F0-02'],
    problem: 'Gate all share behind Field Report or iNat cohort bounces',
  },
  {
    seat: 'red_team',
    name: 'Diego Morales — field tech',
    verdict: 'Unlocking Song Meter + Kaleidoscope buttons confuses cozy players — progression plan adds menus not power',
    attacks: ['F1-05', 'F1-06'],
    problem: 'Hide educator tools until expedition 3; expedition 2 unlocks wider cone only',
  },
  {
    seat: 'blue_team',
    name: 'Mei Chen — bat FM grad student',
    verdict: 'Listen cone + spectrogram peak is the fun core — plan should double down not add features',
    defends: ['F0-04', 'F0-05'],
    problem: 'Hero audio and wrong-ID lore must not slow the listen→record loop',
  },
  {
    seat: 'blue_team',
    name: 'Camille Dubois — educator',
    verdict: 'Demo mode + dusk presentation is classroom-ready; missing finale celebration is the only blocker',
    defends: ['F0-02', 'F0-06'],
    problem: 'Ship Field Report cinematic before hero audio',
  },
  {
    seat: 'blue_team',
    name: 'Raj Okonkwo — audio engineer',
    verdict: 'Procedural calls fine for aiming — one hero recording per habitat sells the fantasy without full library',
    defends: ['F0-03'],
    problem: 'Forest owl call-and-response is highest ROI hero moment',
  },
];

function seededRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function pickWeighted(items, rng) {
  const total = items.reduce((a, i) => a + i.weight, 0);
  let r = rng() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function generatePanel(size, womenRatio, seed = 77026) {
  const rng = seededRng(seed);
  const engineers = [];
  let womenCount = 0;
  for (let i = 0; i < size; i++) {
    const forceWoman = womenCount / Math.max(1, i) < womenRatio - 0.04;
    const forceMan = (i - womenCount) / Math.max(1, size - i) < (1 - womenRatio) - 0.04;
    const isWoman = forceWoman ? true : forceMan ? false : rng() < womenRatio;
    if (isWoman) womenCount++;
    const firstName = isWoman
      ? FIRST_NAMES_W[Math.floor(rng() * FIRST_NAMES_W.length)]
      : FIRST_NAMES_M[Math.floor(rng() * FIRST_NAMES_M.length)];
    const lastName = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
    const role = pickWeighted(ROLES, rng);
    const playHabit = pickWeighted(PLAY_HABITS, rng);
    engineers.push({
      id: `fun_${String(i + 1).padStart(3, '0')}`,
      name: `${firstName} ${lastName}`,
      gender: isWoman ? 'woman' : 'man',
      role: role.id,
      roleLabel: role.label,
      playHabit: playHabit.id,
      playHabitLabel: playHabit.label,
      team: rng() < 0.5 ? 'red' : 'blue',
    });
  }
  return { engineers, womenCount, womenPct: womenCount / size };
}

function runSims(engineers, funPlan) {
  return engineers.map((eng, i) => {
    const rng = seededRng(9900 + i * 23);
    return driveFunPlanSession({
      engineer: eng,
      features,
      funPlan,
      rng,
      skill: 0.76 + rng() * 0.2,
      habitat: ['forest', 'marsh', 'canyon'][i % 3],
      timeOfDay: ['dawn', 'dusk', 'night'][i % 3],
    });
  });
}

function aggregate(sessions) {
  const mean = (k) => sessions.reduce((a, s) => a + s.scores[k], 0) / sessions.length;
  const frictionCounts = {};
  for (const s of sessions) {
    for (const f of s.funFriction) frictionCounts[f] = (frictionCounts[f] || 0) + 1;
  }
  const topProblems = Object.entries(frictionCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([flag, count]) => ({ flag, count, pct: Math.round((count / sessions.length) * 1000) / 10 }));
  const byHabit = {};
  for (const h of PLAY_HABITS) {
    const subset = sessions.filter((s) => s.engineer.playHabit === h.id);
    if (!subset.length) continue;
    byHabit[h.id] = {
      n: subset.length,
      fun: subset.reduce((a, s) => a + s.scores.fun, 0) / subset.length,
      recommend: subset.reduce((a, s) => a + s.scores.wouldRecommendForFun, 0) / subset.length,
    };
  }
  return {
    count: sessions.length,
    meanFun: mean('fun'),
    meanRecommendForFun: mean('wouldRecommendForFun'),
    meanExpeditionPacing: mean('expeditionPacing'),
    meanPayoffStrength: mean('payoffStrength'),
    meanPlanConfidence: mean('planConfidence'),
    completionRate: sessions.filter((s) => s.completed).length / sessions.length,
    topProblems,
    byPlayHabit: byHabit,
  };
}

function buildProblemBacklog(topProblems, agg, projectedAgg) {
  const problemMap = {
    no_expedition_arc: { id: 'F0-01', fix: 'Replace 6-species checklist with 3-act arc + Field Report gate', priority: 'P0' },
    checklist_not_story: { id: 'F0-01', fix: 'Mission bar shows story beats not species count', priority: 'P0' },
    six_species_grind_too_long: { id: 'F0-01', fix: 'Cap forest expedition at 4 logs + 1 boss caller for site clear', priority: 'P0' },
    no_field_report_celebration: { id: 'F0-02', fix: 'Full-screen Field Report + share unlock on site complete', priority: 'P0' },
    no_hero_audio_moment: { id: 'F0-03', fix: 'One signature call per habitat (owl pair, peeper wall, drum echo)', priority: 'P0' },
    procedural_flat_soundscape: { id: 'F0-03', fix: 'Layer hero sample over procedural bed at key moments', priority: 'P1' },
    wrong_id_no_teachable_punchline: { id: 'F1-01', fix: 'Lore card on wrong ID with integrity -5 and species tip', priority: 'P1' },
    share_unearned: { id: 'F1-04', fix: 'Hide spectrogram share until expedition complete', priority: 'P1' },
    progression_is_menus_not_power: { id: 'F1-05', fix: 'Expedition 2: +15% cone width; hide Kaleidoscope until exp 3', priority: 'P1' },
    advanced_bar_overwhelming: { id: 'F1-06', fix: 'Progressive disclosure tiers — not all buttons at log 1', priority: 'P1' },
    kaleidoscope_distraction_for_casual: { id: 'F1-06', fix: 'Educator-only tools behind persona or expedition gate', priority: 'P2' },
    habitat_incomplete: { id: 'F1-02', fix: 'Stronger final-stretch coach when 1 log from site clear', priority: 'P1' },
    never_used_listen: { id: 'F0-04', fix: 'Keep listen cone as mandatory tutorial beat — already shipped', priority: 'P0', status: 'shipped' },
  };

  const items = [];
  const seen = new Set();
  for (const p of topProblems) {
    const meta = problemMap[p.flag];
    if (!meta || seen.has(meta.id)) continue;
    seen.add(meta.id);
    items.push({
      ...meta,
      flag: p.flag,
      panelPct: p.pct,
      panelCount: p.count,
      deltaIfPlanShips: projectedAgg ? (projectedAgg.meanRecommendForFun - agg.meanRecommendForFun).toFixed(2) : null,
    });
  }
  return items.sort((a, b) => b.panelPct - a.panelPct);
}

const { engineers, womenCount, womenPct } = generatePanel(PANEL_SIZE, WOMEN_TARGET);
const sessionsCurrent = runSims(engineers, funPlanCurrent);
const aggCurrent = aggregate(sessionsCurrent);

const funPlanProjected = projectFunPlanIfShipped(funPlanCurrent, FUN_PLAN_PILLARS);
const sessionsProjected = runSims(engineers, funPlanProjected);
const aggProjected = aggregate(sessionsProjected);

const backlog = buildProblemBacklog(aggCurrent.topProblems, aggCurrent, aggProjected);
const redAttacks = SENIOR_FUN_PANEL.flatMap((p) => p.attacks || []);
const attackCounts = {};
for (const id of redAttacks) attackCounts[id] = (attackCounts[id] || 0) + 1;

const report = {
  generatedAt: new Date().toISOString(),
  build,
  planVersion: 'fun-plan-v2.1-jul2026',
  northStar: 'Researcher cohort ≥4.0 would-recommend-for-FUN AND ≥70% complete one habitat in ~18 min',
  panel: { size: PANEL_SIZE, womenCount, womenPct: Math.round(womenPct * 1000) / 10 },
  funPlanCurrent,
  funPlanProjected,
  pillars: FUN_PLAN_PILLARS,
  seniorPanel: SENIOR_FUN_PANEL,
  current: aggCurrent,
  projectedIfPlanShips: aggProjected,
  lift: {
    fun: aggProjected.meanFun - aggCurrent.meanFun,
    recommendForFun: aggProjected.meanRecommendForFun - aggCurrent.meanRecommendForFun,
    expeditionPacing: aggProjected.meanExpeditionPacing - aggCurrent.meanExpeditionPacing,
    payoffStrength: aggProjected.meanPayoffStrength - aggCurrent.meanPayoffStrength,
  },
  problemBacklog: backlog,
  redTeamConsensus: Object.entries(attackCounts).sort((a, b) => b[1] - a[1]),
  sampleSessions: sessionsCurrent.slice(0, 6).map((s) => ({
    name: s.engineer.name,
    role: s.engineer.role,
    playHabit: s.engineer.playHabit,
    scores: s.scores,
    topFriction: s.funFriction.slice(0, 4),
    completed: s.completed,
    logged: s.logged,
  })),
};

writeFileSync(join(scratch, 'fun-plan-war-room.json'), JSON.stringify(report, null, 2));
writeFileSync(join(scratch, 'fun-plan-backlog.md'), formatMd(report));

console.log('Fun-plan war room complete');
console.log('  build:', build);
console.log('  panel:', PANEL_SIZE, `researchers (${womenCount} women, ${(womenPct * 100).toFixed(1)}%)`);
console.log('  CURRENT  fun:', aggCurrent.meanFun.toFixed(2), '/10 · recommend-for-fun:', aggCurrent.meanRecommendForFun.toFixed(2), '/5');
console.log('  PROJECTED fun:', aggProjected.meanFun.toFixed(2), '/10 · recommend-for-fun:', aggProjected.meanRecommendForFun.toFixed(2), '/5');
console.log('  lift recommend:', (aggProjected.meanRecommendForFun - aggCurrent.meanRecommendForFun).toFixed(2));
console.log('  top problem:', aggCurrent.topProblems[0]?.flag, `(${aggCurrent.topProblems[0]?.pct}%)`);
console.log('  wrote:', join(scratch, 'fun-plan-war-room.json'));
console.log('  wrote:', join(scratch, 'fun-plan-backlog.md'));

function formatMd(r) {
  const lines = [
    `# ECHOES Fun-Plan War Room — ${r.build}`,
    '',
    `**Plan:** ${r.planVersion}`,
    '',
    `**North star:** ${r.northStar}`,
    '',
    `**Panel:** ${r.panel.size} researchers · ${r.panel.womenCount} women (${r.panel.womenPct}%)`,
    '',
    '## Scores — current build vs plan shipped',
    '',
    '| Metric | Current | If plan ships | Lift |',
    '|--------|---------|---------------|------|',
    `| Fun | ${r.current.meanFun.toFixed(2)}/10 | ${r.projectedIfPlanShips.meanFun.toFixed(2)}/10 | +${r.lift.fun.toFixed(2)} |`,
    `| Would recommend for fun | ${r.current.meanRecommendForFun.toFixed(2)}/5 | ${r.projectedIfPlanShips.meanRecommendForFun.toFixed(2)}/5 | +${r.lift.recommendForFun.toFixed(2)} |`,
    `| Expedition pacing | ${r.current.meanExpeditionPacing.toFixed(2)}/10 | ${r.projectedIfPlanShips.meanExpeditionPacing.toFixed(2)}/10 | +${r.lift.expeditionPacing.toFixed(2)} |`,
    `| Payoff strength | ${r.current.meanPayoffStrength.toFixed(2)}/10 | ${r.projectedIfPlanShips.meanPayoffStrength.toFixed(2)}/10 | +${r.lift.payoffStrength.toFixed(2)} |`,
    `| Completion | ${(r.current.completionRate * 100).toFixed(0)}% | ${(r.projectedIfPlanShips.completionRate * 100).toFixed(0)}% | — |`,
    '',
    '## Top problems (% of 50 researchers hit this friction)',
    '',
  ];
  for (const p of r.current.topProblems.slice(0, 10)) {
    lines.push(`- **${p.flag}** — ${p.pct}% (${p.count}/50)`);
  }
  lines.push('');
  lines.push('## Prioritized fix backlog');
  lines.push('');
  for (const b of r.problemBacklog) {
    lines.push(`### ${b.id} [${b.priority}] — ${b.fix}`);
    lines.push(`- Panel hit rate: ${b.panelPct}% · flag: \`${b.flag}\``);
    if (b.status === 'shipped') lines.push('- Status: already shipped');
    lines.push('');
  }
  lines.push('## Senior panel verdicts');
  lines.push('');
  for (const p of r.seniorPanel) {
    lines.push(`### ${p.seat === 'red_team' ? '🔴' : '🔵'} ${p.name}`);
    lines.push(`> ${p.verdict}`);
    lines.push(`- **Problem:** ${p.problem}`);
    lines.push('');
  }
  lines.push('## Play-habit breakdown (current build)');
  lines.push('');
  for (const [habit, stats] of Object.entries(r.current.byPlayHabit)) {
    lines.push(`- **${habit}** (n=${stats.n}): fun ${stats.fun.toFixed(2)} · recommend ${stats.recommend.toFixed(2)}`);
  }
  lines.push('');
  lines.push('## Fun plan pillar status');
  lines.push('');
  for (const p of r.pillars) {
    lines.push(`- **${p.id}** [${p.priority}]: ${p.status} — ${p.detail}`);
  }
  return lines.join('\n');
}