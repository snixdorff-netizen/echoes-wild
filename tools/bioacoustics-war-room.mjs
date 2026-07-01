#!/usr/bin/env node
/**
 * Bioacoustics engineer war room: 20–50 domain experts (60–70% women),
 * game design review, red/blue team on prioritized backlog.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readShippedFeaturesFromHtml } from './echoes-core.mjs';
import { driveBioacousticsSession } from './bioacoustics-sim-drive.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const scratch =
  process.env.ECHOES_SCRATCH ||
  process.argv[2] ||
  join(root, '.scratch');
mkdirSync(scratch, { recursive: true });

const PANEL_SIZE = Math.min(50, Math.max(20, Number(process.env.BIOACOUSTICS_PANEL_SIZE) || 35));
const WOMEN_TARGET = 0.65;

const html = readFileSync(join(root, 'index.html'), 'utf8');
const features = readShippedFeaturesFromHtml(html);
const build = (html.match(/BUILD_VERSION = '([^']+)'/) || [])[1] || 'unknown';

const FIRST_NAMES_W = [
  'Priya', 'Maya', 'Sofia', 'Elena', 'Aisha', 'Rachel', 'Lin', 'Camille', 'Nadia', 'Hannah',
  'Keiko', 'Amara', 'Zoe', 'Tessa', 'Ingrid', 'Mei', 'Fatima', 'Clara', 'Jade', 'Rosa',
];
const FIRST_NAMES_M = [
  'Marcus', 'Diego', 'Owen', 'Raj', 'Leo', 'Sam', 'Noah', 'Chen', 'Andre', 'Kai',
];
const LAST_NAMES = [
  'Okonkwo', 'Patel', 'Nguyen', 'Lindqvist', 'Morales', 'Kim', 'Fischer', 'Santos',
  'Okafor', 'Bergstrom', 'Chen', 'Alvarez', 'Nakamura', 'Dubois', 'Hartley',
];

const ROLES = [
  { id: 'pam_analyst', label: 'PAM analyst / Kaleidoscope power user', weight: 0.18 },
  { id: 'field_tech', label: 'Field technician (Song Meter deploy)', weight: 0.15 },
  { id: 'grad_student', label: 'Grad student (bioacoustics lab)', weight: 0.14 },
  { id: 'educator', label: 'University / outreach educator', weight: 0.12 },
  { id: 'citizen_scientist', label: 'Citizen scientist / BioBlitz lead', weight: 0.1 },
  { id: 'conservation_bio', label: 'Conservation biologist', weight: 0.1 },
  { id: 'audio_engineer', label: 'Field audio engineer', weight: 0.08 },
  { id: 'data_scientist', label: 'Acoustic data scientist', weight: 0.08 },
  { id: 'lab_manager', label: 'Acoustic monitoring lab manager', weight: 0.05 },
];

const PLAY_HABITS = [
  { id: 'none', label: 'Rarely plays games — prefers field work', weight: 0.22 },
  { id: 'inaturalist', label: 'iNaturalist / Merlin gamification', weight: 0.18 },
  { id: 'puzzle', label: 'Puzzle games (Baba Is You, Obra Dinn)', weight: 0.14 },
  { id: 'cozy_sim', label: 'Cozy sims (Alba, Stardew)', weight: 0.14 },
  { id: 'mobile_casual', label: 'Mobile casual (Wordle, NYT Games)', weight: 0.12 },
  { id: 'board_games', label: 'Board games / tabletop nights', weight: 0.1 },
];

const FUN_ACTIVITIES = [
  'dawn chorus hikes', 'kayaking for frog surveys', 'banding station volunteering',
  'Kaleidoscope batch review nights', 'teaching spectrogram workshops', 'eBird / XC uploads',
  'trail running with parabolic mic', 'sci-comm podcasting', 'data viz side projects',
  'community BioBlitz organizing', 'bird photography', 'camping with Song Meter',
];

const SENIOR_PANEL = [
  {
    id: 'lead_pam',
    name: 'Dr. Ingrid Bergstrom — PAM program lead (Wildlife Acoustics alum)',
    seat: 'red_team',
    gender: 'woman',
    verdict: 'Procedural calls teach aiming but not deployment, duty cycle, or file naming — trainees will confuse game SNR with real-world noise floors',
    scores: { trainingValue: 5.5, scientificCredibility: 4.8, spectrogramFidelity: 6.2 },
    attacks: ['P2-01', 'P2-02', 'P1-05', 'P1-03'],
    mandates: ['Song Meter deploy minigame with SD card + schedule', 'Kaleidoscope drag-drop clustering POC', 'SNR meter tied to listen cone'],
  },
  {
    id: 'edu_outreach',
    name: 'Camille Dubois — acoustic outreach educator (Audubon chapter)',
    seat: 'red_team',
    gender: 'woman',
    verdict: 'Would demo to 30 students if projector mode existed; current cone invisible at 1080p; persona dropdown confuses novices',
    scores: { trainingValue: 6.8, wouldUseInClassroom: 2.8 },
    attacks: ['P1-03', 'P3-03', 'P1-06', 'P0-03'],
    mandates: ['Demo/projector mode', '15-min expedition preset', 'persona affects UI density'],
  },
  {
    id: 'field_tech',
    name: 'Diego Morales — Song Meter field tech (200+ deployments)',
    seat: 'red_team',
    gender: 'man',
    verdict: 'Dash disabled is correct; but time-of-day button breaks phenology training — real surveys are schedule-driven not button-mashed',
    scores: { trainingValue: 6.0, scientificCredibility: 5.2 },
    attacks: ['P1-01', 'P2-01', 'P1-05'],
    mandates: ['Species activity chart puzzle', 'exportable clip manifest', 'habitat-specific ambient beds'],
  },
  {
    id: 'grad_student',
    name: 'Mei Chen — PhD candidate (bat FM classification)',
    seat: 'blue_team',
    gender: 'woman',
    verdict: 'Interactive spectrogram peak tap is the right instinct — extend with confidence score + wrong-peak teachable moment',
    scores: { spectrogramFidelity: 7.2, trainingValue: 7.0 },
    defends: ['P0-06', 'P1-05', 'P1-04'],
    countermeasures: ['Add confidence % on ID card', 'FM sweep animation for bat profile', 'lore cards with call structure notes'],
  },
  {
    id: 'citizen_sci',
    name: 'Rosa Alvarez — BioBlitz coordinator + iNat power user',
    seat: 'blue_team',
    gender: 'woman',
    verdict: 'Daily BioBlitz streak maps to real community science; shareable spectrogram card = viral training loop',
    scores: { wouldRecommendForTraining: 4.2 },
    defends: ['P1-02', 'P1-07', 'P2-05'],
    countermeasures: ['Rotating rare caller tied to real phenology calendar', 'habitat % cleared map', 'XC-style share card'],
  },
  {
    id: 'audio_eng',
    name: 'Raj Okonkwo — field recording engineer (headphone-first workflow)',
    seat: 'red_team',
    gender: 'man',
    verdict: 'Stereo warmth is good pedagogy but integrity stat still opaque — engineers want dB SNR not gamified HP bar',
    scores: { scientificCredibility: 5.5, spectrogramFidelity: 6.5 },
    attacks: ['P1-05', 'P0-05', 'P3-02'],
    mandates: ['SNR meter in dB', 'headphone mode toggle', 'colorblind-safe + keyboard path'],
  },
  {
    id: 'data_sci',
    name: 'Dr. Nadia Okafor — ML acoustic classifier maintainer',
    seat: 'blue_team',
    gender: 'woman',
    verdict: 'Kaleidoscope POC is non-negotiable for PAM cohort — without it this stays a cute quiz not a pipeline primer',
    scores: { trainingValue: 5.8 },
    defends: ['P2-02', 'P1-08', 'P2-01'],
    countermeasures: ['Cluster drag-drop with false-positive bucket', 'CI gate on bioacoustics rubric ≥3.8 training recommend'],
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

function generateEngineerPanel(size, womenRatio, seed = 42026) {
  const rng = seededRng(seed);
  const engineers = [];
  let womenCount = 0;

  for (let i = 0; i < size; i++) {
    const forceWoman = womenCount / Math.max(1, i) < womenRatio - 0.05;
    const forceMan = (i - womenCount) / Math.max(1, size - i) < (1 - womenRatio) - 0.05;
    const isWoman = forceWoman ? true : forceMan ? false : rng() < womenRatio;
    if (isWoman) womenCount++;

    const firstName = isWoman
      ? FIRST_NAMES_W[Math.floor(rng() * FIRST_NAMES_W.length)]
      : FIRST_NAMES_M[Math.floor(rng() * FIRST_NAMES_M.length)];
    const lastName = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
    const role = pickWeighted(ROLES, rng);
    const playHabit = pickWeighted(PLAY_HABITS, rng);
    const funCount = 2 + Math.floor(rng() * 2);
    const funShuffled = [...FUN_ACTIVITIES].sort(() => rng() - 0.5);
    const funFor = funShuffled.slice(0, funCount);
    const ageBand = ['25-29', '30-34', '35-39', '40-49', '50+'][Math.floor(rng() * 5)];
    const region = ['PNW', 'Southeast US', 'Northeast', 'UK', 'Australia', 'Central America', 'Canada'][Math.floor(rng() * 7)];

    engineers.push({
      id: `bio_${String(i + 1).padStart(3, '0')}`,
      name: `${firstName} ${lastName}`,
      gender: isWoman ? 'woman' : 'man',
      ageBand,
      region,
      role: role.id,
      roleLabel: role.label,
      playHabit: playHabit.id,
      playHabitLabel: playHabit.label,
      funFor,
      team: rng() < 0.52 ? 'red' : 'blue',
    });
  }

  return { engineers, womenCount, womenPct: womenCount / size };
}

function buildBacklog() {
  const has = (f) => features[f];
  return [
    { id: 'P0-01', priority: 'P0', category: 'FTUE', title: 'Interactive first-clip tutorial', impact: 10, effort: 'L', status: has('interactiveTutorial') ? 'shipped' : 'missing', detail: 'Domain: educators need gated demo path for first clip.' },
    { id: 'P0-02', priority: 'P0', category: 'Controls', title: 'Defer grip/charge dash mechanic', impact: 9, effort: 'S', status: has('dashDisabled') ? 'shipped' : 'missing', detail: 'Field techs approve — dash scares wildlife in real surveys too.' },
    { id: 'P0-03', priority: 'P0', category: 'UI', title: 'Progressive disclosure — hide advanced bar', impact: 9, effort: 'M', status: has('progressiveDisclosure') ? 'shipped' : 'missing', detail: 'Reduces cognitive load for non-gamer cohort.' },
    { id: 'P0-04', priority: 'P0', category: 'Visual', title: 'Vector species silhouettes', impact: 10, effort: 'L', status: has('vectorSpeciesArt') ? 'shipped' : 'missing', detail: 'Silhouettes help field ID; not substitute for spectrogram.' },
    { id: 'P0-05', priority: 'P0', category: 'Audio', title: 'Stereo pan + proximity warmth', impact: 8, effort: 'M', status: has('stereoWarmthAudio') ? 'shipped' : 'missing', detail: 'Good aiming pedagogy; needs dB SNR readout (P1-05).' },
    { id: 'P0-06', priority: 'P0', category: 'Identify', title: 'Interactive spectrogram peak tap', impact: 9, effort: 'L', status: has('interactiveSpectrogram') ? 'shipped' : 'missing', detail: 'Core training hook for PAM analysts.' },

    { id: 'P1-01', priority: 'P1', category: 'Systems', title: 'Time-of-day as phenology puzzle', impact: 8, effort: 'M', status: 'missing', detail: 'Red team: T button teaches wrong mental model vs deployment schedules.' },
    { id: 'P1-02', priority: 'P1', category: 'Retention', title: 'Daily BioBlitz streak + rare caller', impact: 8, effort: 'M', status: 'partial', detail: 'Blue team: maps to community science calendar.' },
    { id: 'P1-03', priority: 'P1', category: 'Educator', title: 'Demo/projector mode', impact: 9, effort: 'S', status: 'missing', detail: 'BLOCKER for classroom adoption — 2× cone, auto-pause.' },
    { id: 'P1-04', priority: 'P1', category: 'Narrative', title: 'Species lore cards (call structure notes)', impact: 7, effort: 'M', status: 'missing', detail: 'Teachable moments post-ID — harmonics, duty cycle, FM sweeps.' },
    { id: 'P1-05', priority: 'P1', category: 'Feedback', title: 'SNR meter (dB) tied to listen cone', impact: 10, effort: 'M', status: 'partial', detail: 'Red+blue consensus: integrity bar must show dB SNR.' },
    { id: 'P1-06', priority: 'P1', category: 'Mobile', title: 'Full-bleed canvas + dock-only mobile', impact: 6, effort: 'S', status: 'partial', detail: 'Lower priority for desktop-first PAM cohort.' },
    { id: 'P1-07', priority: 'P1', category: 'Share', title: 'Shareable spectrogram card (XC-style)', impact: 7, effort: 'M', status: 'missing', detail: 'Training viral loop for BioBlitz coordinators.' },
    { id: 'P1-08', priority: 'P1', category: 'QA', title: 'CI gate: bioacoustics rubric ≥3.8 training recommend', impact: 9, effort: 'S', status: 'partial', detail: 'Prevent sim/general-public-only release gates.' },

    { id: 'P2-01', priority: 'P2', category: 'Vision', title: 'Song Meter Safari deploy minigame', impact: 10, effort: 'XL', status: 'missing', detail: 'Red team P0 for field techs — schedule, GPS, SD card.' },
    { id: 'P2-02', priority: 'P2', category: 'Vision', title: 'Kaleidoscope drag-drop clustering POC', impact: 10, effort: 'XL', status: 'missing', detail: 'Non-negotiable for PAM analyst adoption.' },
    { id: 'P2-03', priority: 'P2', category: 'World', title: 'Habitat ambient beds + weather', impact: 7, effort: 'L', status: 'missing', detail: 'Teaches noise floor differences marsh vs canyon.' },
    { id: 'P2-04', priority: 'P2', category: 'NPC', title: 'Field partner radio (mentor hints)', impact: 5, effort: 'M', status: 'missing', detail: 'Nice for outreach; lower than SNR + Kaleidoscope.' },
    { id: 'P2-05', priority: 'P2', category: 'Meta', title: 'Cross-habitat progression map', impact: 6, effort: 'M', status: 'partial', detail: 'BioBlitz coordinators want % cleared per site.' },

    { id: 'P3-01', priority: 'P3', category: 'Polish', title: 'Celebration on correct ID + expedition complete', impact: 4, effort: 'S', status: 'partial', detail: 'Low priority vs scientific credibility items.' },
    { id: 'P3-02', priority: 'P3', category: 'A11y', title: 'Colorblind markers + keyboard path', impact: 6, effort: 'M', status: 'missing', detail: 'Lab inclusivity — audio engineers flagged.' },
    { id: 'P3-03', priority: 'P3', category: 'Persona', title: 'Persona affects UI density', impact: 5, effort: 'M', status: 'partial', detail: 'Educator vs analyst density profiles.' },
  ];
}

function reprioritizeForBioacoustics(backlog, redAttacks, blueDefends) {
  const boost = {
    'P1-05': 2, 'P1-03': 2, 'P2-02': 2, 'P2-01': 2, 'P1-01': 1, 'P1-08': 1,
    'P1-04': 1, 'P2-03': 1, 'P1-07': 1,
  };
  const demote = { 'P3-01': -2, 'P1-06': -1, 'P2-04': -1 };

  return backlog.map((item) => {
    const attackCount = redAttacks.filter((id) => id === item.id).length;
    const defendCount = blueDefends.filter((id) => id === item.id).length;
    const domainImpact = item.impact + (boost[item.id] || 0) + (demote[item.id] || 0) + attackCount * 0.5 + defendCount * 0.3;
    let newPriority = item.priority;
    if (domainImpact >= 10 && item.priority !== 'P0') newPriority = 'P1';
    if (['P2-01', 'P2-02'].includes(item.id)) newPriority = 'P1';
    if (item.id === 'P1-05' && item.status !== 'shipped') newPriority = 'P1';
    return {
      ...item,
      domainImpact: Math.round(domainImpact * 10) / 10,
      redTeamVotes: attackCount,
      blueTeamVotes: defendCount,
      bioacousticsPriority: newPriority,
      consensus: attackCount && defendCount ? 'contested' : attackCount ? 'red_escalate' : defendCount ? 'blue_defend' : 'neutral',
    };
  }).sort((a, b) => {
    const p = { P0: 0, P1: 1, P2: 2, P3: 3 };
    const pa = p[a.bioacousticsPriority] ?? 9;
    const pb = p[b.bioacousticsPriority] ?? 9;
    return pa - pb || b.domainImpact - a.domainImpact;
  });
}

function runEngineerSims(engineers) {
  const simFeatures = { ...features };
  return engineers.map((eng, i) => {
    const rng = seededRng(8800 + i * 17);
    const skill = 0.78 + rng() * 0.18;
    const session = driveBioacousticsSession({
      engineer: eng,
      features: simFeatures,
      skill,
      rng,
      habitat: ['forest', 'marsh', 'canyon'][i % 3],
      timeOfDay: ['dawn', 'dusk', 'night'][i % 3],
    });
    return { ...session, engineer: eng };
  });
}

function aggregateSims(sessions) {
  const mean = (k) => sessions.reduce((a, s) => a + s.scores[k], 0) / sessions.length;
  const topFriction = {};
  for (const s of sessions) {
    for (const f of s.domainFriction) {
      topFriction[f] = (topFriction[f] || 0) + 1;
    }
  }
  const sortedFriction = Object.entries(topFriction).sort((a, b) => b[1] - a[1]);
  return {
    count: sessions.length,
    meanTrainingValue: mean('trainingValue'),
    meanScientificCredibility: mean('scientificCredibility'),
    meanSpectrogramFidelity: mean('spectrogramFidelity'),
    meanRecommendForTraining: mean('wouldRecommendForTraining'),
    meanUseInClassroom: mean('wouldUseInClassroom'),
    completionRate: sessions.filter((s) => s.completed).length / sessions.length,
    topDomainFriction: sortedFriction.slice(0, 8).map(([flag, count]) => ({ flag, count, pct: count / sessions.length })),
  };
}

function gameDesignReview() {
  return {
    authenticity: {
      strengths: [
        'Listen cone + directional aiming mirrors parabolic / shotgun mic workflow',
        'Interactive spectrogram peak tap teaches band selection before species ID',
        'Stereo warmth cue reinforces bearing + proximity (field technique)',
        'Dash disabled — aligns with "move slowly near wildlife" field norm',
        'Species activity windows (dawn/dusk/night) touch real phenology',
      ],
      gaps: [
        'Procedural synthesis ≠ field recording — no noise floor, wind, handling noise',
        'Integrity stat opaque to engineers — needs dB SNR meter',
        'Time-of-day button breaks schedule-based survey mental model',
        'No Song Meter deploy, SD export, or Kaleidoscope clustering',
        'No confidence score on classification — quiz not analysis pipeline',
        'README trilogy promise (Safari + Kaleidoscope) undermines credibility with WA-adjacent cohort',
      ],
    },
    cohortFit: {
      pam_analyst: 'Partial — spectrogram tap is promising; Kaleidoscope gap is fatal for power users',
      field_tech: 'Weak — no deploy workflow; phenology button wrong pedagogy',
      educator: 'Blocked — no projector/demo mode; cone too subtle at 1080p',
      grad_student: 'Moderate — FM bat profile exists; needs confidence + export',
      citizen_scientist: 'Good hook — BioBlitz loop maps if daily streak ships',
    },
  };
}

const { engineers, womenCount, womenPct } = generateEngineerPanel(PANEL_SIZE, WOMEN_TARGET);
const backlog = buildBacklog();
const redAttacks = SENIOR_PANEL.flatMap((p) => p.attacks || []);
const blueDefends = SENIOR_PANEL.flatMap((p) => p.defends || []);
const reprioritized = reprioritizeForBioacoustics(backlog, redAttacks, blueDefends);
const sessions = runEngineerSims(engineers);
const simAgg = aggregateSims(sessions);
const designReview = gameDesignReview();

const report = {
  generatedAt: new Date().toISOString(),
  build,
  panel: {
    size: PANEL_SIZE,
    womenCount,
    womenPct: Math.round(womenPct * 1000) / 10,
    womenTarget: `${Math.round(WOMEN_TARGET * 100 - 5)}–${Math.round(WOMEN_TARGET * 100 + 5)}%`,
    roleBreakdown: ROLES.map((r) => ({
      role: r.id,
      count: engineers.filter((e) => e.role === r.id).length,
    })).filter((x) => x.count > 0),
    playHabitBreakdown: PLAY_HABITS.map((h) => ({
      habit: h.id,
      count: engineers.filter((e) => e.playHabit === h.id).length,
    })).filter((x) => x.count > 0),
  },
  features,
  seniorPanel: SENIOR_PANEL,
  engineers,
  gameDesignReview: designReview,
  simAggregate: simAgg,
  sessions: sessions.map((s) => ({
    id: s.engineerId,
    name: s.engineer.name,
    role: s.engineer.role,
    team: s.engineer.team,
    scores: s.scores,
    completed: s.completed,
    topFriction: s.domainFriction.slice(0, 4),
  })),
  backlogOriginal: backlog,
  backlogReprioritized: reprioritized,
  redBlueSummary: {
    redEscalations: reprioritized.filter((b) => b.consensus === 'red_escalate').map((b) => b.id),
    blueDefenses: reprioritized.filter((b) => b.consensus === 'blue_defend').map((b) => b.id),
    contested: reprioritized.filter((b) => b.consensus === 'contested').map((b) => b.id),
    topBioP1: reprioritized.filter((b) => b.bioacousticsPriority === 'P1' && b.status !== 'shipped').slice(0, 8),
  },
  northStar: 'Bioacoustics engineer cohort ≥4.0 would-recommend-for-training AND ≥3.8 would-use-in-classroom (educators)',
  currentGap: `Panel sim: ${simAgg.meanRecommendForTraining.toFixed(2)}/5 training recommend · ${simAgg.meanTrainingValue.toFixed(2)}/10 training value · ${(simAgg.completionRate * 100).toFixed(0)}% completion`,
  premortem: {
    partnership: [
      { failure: 'Wildlife Acoustics partnership pass', cause: 'No Song Meter or Kaleidoscope fidelity', fix: 'P2-01 + P2-02 promoted to bio-P1' },
      { failure: 'University lab rejects as homework', cause: 'No SNR dB + no export', fix: 'P1-05 SNR meter + clip manifest export' },
    ],
    classroom: [
      { failure: 'Outreach educator cannot demo', cause: 'Cone invisible on projector', fix: 'P1-03 demo mode — red team unanimous' },
      { failure: 'Students confuse game with real PAM', cause: 'Procedural audio + integrity gamification', fix: 'Disclaimer + side-by-side field recording compare mode' },
    ],
    credibility: [
      { failure: 'Listed on "bad science games" thread', cause: 'Time button ≠ phenology', fix: 'P1-01 activity chart puzzle' },
      { failure: 'PAM analysts bounce at identify screen', cause: 'Quiz cards without confidence %', fix: 'P1-05 + confidence score on ID' },
    ],
  },
};

writeFileSync(join(scratch, 'bioacoustics-war-room.json'), JSON.stringify(report, null, 2));
writeFileSync(join(scratch, 'bioacoustics-backlog.md'), formatMarkdown(report));

console.log('Bioacoustics war room complete');
console.log('  build:', build);
console.log('  panel:', PANEL_SIZE, `engineers (${womenCount} women, ${(womenPct * 100).toFixed(1)}%)`);
console.log('  training recommend:', simAgg.meanRecommendForTraining.toFixed(2), '/5');
console.log('  training value:', simAgg.meanTrainingValue.toFixed(2), '/10');
console.log('  completion:', (simAgg.completionRate * 100).toFixed(0) + '%');
console.log('  wrote:', join(scratch, 'bioacoustics-war-room.json'));
console.log('  wrote:', join(scratch, 'bioacoustics-backlog.md'));

function formatMarkdown(r) {
  const lines = [
    `# ECHOES Bioacoustics War Room — ${r.build}`,
    '',
    `**North star:** ${r.northStar}`,
    '',
    `**Current gap:** ${r.currentGap}`,
    '',
    `**Panel:** ${r.panel.size} bioacoustics engineers · ${r.panel.womenCount} women (${r.panel.womenPct}%, target ${r.panel.womenTarget})`,
    '',
    '---',
    '',
    '## Panel demographics',
    '',
    '### Roles',
    '',
  ];
  for (const row of r.panel.roleBreakdown) {
    lines.push(`- **${row.role}:** ${row.count}`);
  }
  lines.push('');
  lines.push('### Play habits');
  lines.push('');
  for (const row of r.panel.playHabitBreakdown) {
    lines.push(`- **${row.habit}:** ${row.count}`);
  }
  lines.push('');
  lines.push('### Sample engineers (first 8)');
  lines.push('');
  for (const e of r.engineers.slice(0, 8)) {
    lines.push(`- **${e.name}** (${e.gender}, ${e.ageBand}, ${e.region}) — ${e.roleLabel}`);
    lines.push(`  - Plays: ${e.playHabitLabel}`);
    lines.push(`  - Fun: ${e.funFor.join('; ')}`);
    lines.push(`  - War room team: ${e.team}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Game design review');
  lines.push('');
  lines.push('### Authenticity strengths');
  for (const s of r.gameDesignReview.authenticity.strengths) {
    lines.push(`- ${s}`);
  }
  lines.push('');
  lines.push('### Authenticity gaps');
  for (const g of r.gameDesignReview.authenticity.gaps) {
    lines.push(`- ${g}`);
  }
  lines.push('');
  lines.push('### Cohort fit');
  for (const [role, note] of Object.entries(r.gameDesignReview.cohortFit)) {
    lines.push(`- **${role}:** ${note}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Senior panel — red team / blue team');
  lines.push('');
  for (const p of r.seniorPanel) {
    lines.push(`### ${p.name} (${p.seat})`);
    lines.push(`- **Verdict:** ${p.verdict}`);
    if (p.attacks?.length) lines.push(`- **Red attacks:** ${p.attacks.join(', ')}`);
    if (p.defends?.length) lines.push(`- **Blue defends:** ${p.defends.join(', ')}`);
    if (p.mandates?.length) lines.push(`- **Mandates:** ${p.mandates.join('; ')}`);
    if (p.countermeasures?.length) lines.push(`- **Countermeasures:** ${p.countermeasures.join('; ')}`);
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push('## Sim aggregate (panel playthrough)');
  lines.push('');
  lines.push(`| Metric | Mean |`);
  lines.push(`|--------|------|`);
  lines.push(`| Training value | ${r.simAggregate.meanTrainingValue.toFixed(2)}/10 |`);
  lines.push(`| Scientific credibility | ${r.simAggregate.meanScientificCredibility.toFixed(2)}/10 |`);
  lines.push(`| Spectrogram fidelity | ${r.simAggregate.meanSpectrogramFidelity.toFixed(2)}/10 |`);
  lines.push(`| Would recommend for training | ${r.simAggregate.meanRecommendForTraining.toFixed(2)}/5 |`);
  lines.push(`| Would use in classroom | ${r.simAggregate.meanUseInClassroom.toFixed(2)}/5 |`);
  lines.push(`| Completion rate | ${(r.simAggregate.completionRate * 100).toFixed(0)}% |`);
  lines.push('');
  lines.push('### Top domain friction');
  for (const f of r.simAggregate.topDomainFriction) {
    lines.push(`- **${f.flag}** — ${f.count}/${r.simAggregate.count} (${(f.pct * 100).toFixed(0)}%)`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Reprioritized backlog (bioacoustics lens)');
  lines.push('');
  lines.push('P2-01 (Song Meter) and P2-02 (Kaleidoscope) **promoted to effective P1** for this cohort.');
  lines.push('');
  for (const pri of ['P0', 'P1', 'P2', 'P3']) {
    const group = r.backlogReprioritized.filter((b) => b.bioacousticsPriority === pri);
    if (!group.length) continue;
    lines.push(`### ${pri}`);
    lines.push('');
    for (const item of group) {
      const tag = item.consensus !== 'neutral' ? ` [${item.consensus}]` : '';
      lines.push(`- **[${item.id}]** ${item.title} (domain impact ${item.domainImpact}, ${item.status})${tag}`);
      lines.push(`  - ${item.detail}`);
      if (item.redTeamVotes || item.blueTeamVotes) {
        lines.push(`  - *Votes:* red ${item.redTeamVotes} · blue ${item.blueTeamVotes}`);
      }
    }
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push('## Pre-mortem (bioacoustics-specific)');
  lines.push('');
  for (const [horizon, items] of Object.entries(r.premortem)) {
    lines.push(`### ${horizon}`);
    for (const item of items) {
      lines.push(`- **${item.failure}** — ${item.cause} → *Fix:* ${item.fix}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}