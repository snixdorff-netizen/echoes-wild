#!/usr/bin/env node
/**
 * Expert war room: game players + game designers + pre-mortem → prioritized backlog.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readShippedFeaturesFromHtml } from './echoes-core.mjs';
import { driveCriticalSession } from './critical-sim-drive.mjs';
import { driveFieldSession } from './sim-drive.mjs';
import { SEGMENTS } from './echoes-core.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const scratch =
  process.env.ECHOES_SCRATCH ||
  process.argv[2] ||
  join(root, '.scratch');
mkdirSync(scratch, { recursive: true });

const html = readFileSync(join(root, 'index.html'), 'utf8');
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const features = readShippedFeaturesFromHtml(html);
const build = (html.match(/BUILD_VERSION = '([^']+)'/) || [])[1] || 'unknown';

const EXPERT_PLAYERS = [
  {
    id: 'player_ftue',
    name: 'Maya — mobile hypercasual churn expert',
    seat: 'expert_player',
    verdict: 'Quits in 90s if loop not obvious without reading',
    scores: { fun: 5.5, clarity: 4.0, recommend: 2.0 },
    blockers: ['dock_competes_with_top_bar', 'grip_charge_unexplained', 'no_forced_first_win'],
  },
  {
    id: 'player_cozy',
    name: 'James — cozy exploration (Animal Crossing / Alba)',
    seat: 'expert_player',
    verdict: 'Wants beauty + calm; dash scares break fantasy',
    scores: { fun: 6.5, clarity: 7.0, recommend: 3.5 },
    blockers: ['visual_placeholder_sprites', 'no_ambient_soundscape_layers', 'dash_breaks_immersion'],
  },
  {
    id: 'player_puzzle',
    name: 'Priya — spectrogram puzzler (Baba / Return of the Obra Dinn mindset)',
    seat: 'expert_player',
    verdict: 'Identify phase should be the star; spectrogram is decorative',
    scores: { fun: 7.0, clarity: 6.0, recommend: 3.8 },
    blockers: ['spectrogram_not_interactive', 'id_cards_feel_quiz_not_puzzle', 'no_wrong_answer_teachable_moment'],
  },
  {
    id: 'player_hardcore',
    name: 'Dex — systems gamer (Slay the Spire / Outer Wilds)',
    seat: 'expert_player',
    verdict: 'Integrity stat invisible until miss; no build path',
    scores: { fun: 7.5, clarity: 5.5, recommend: 4.0 },
    blockers: ['integrity_feels_arbitrary', 'no_skill_expression_loop', 'habitats_reskin_not_systems'],
  },
  {
    id: 'player_edu',
    name: 'Aisha playtest — classroom educator (30 students, 1 projector)',
    seat: 'expert_player',
    verdict: 'Cannot demo on projector: cone too subtle at 1080p',
    scores: { fun: 7.0, clarity: 5.0, recommend: 3.2 },
    blockers: ['listen_cone_too_subtle_large_screen', 'no_demo_mode', 'persona_dropdown_confuses_kids'],
  },
];

const EXPERT_DESIGNERS = [
  {
    id: 'design_ftue',
    name: 'Sam — FTUE / onboarding lead (Duolingo alum)',
    seat: 'game_designer',
    verdict: 'Coach is copy-only; need gated interactive first clip',
    scores: { clarity: 5.5, retention_d1: 3.0 },
    mandates: ['interactive_first_clip_tutorial', 'record_locked_until_listen_2s', 'celebrate_first_log_big'],
  },
  {
    id: 'design_systems',
    name: 'Rio — systems designer (Minecraft edu mods)',
    seat: 'game_designer',
    verdict: 'One loop repeated 6x; needs escalating challenge',
    scores: { depth: 4.0, replay: 3.5 },
    mandates: ['quality_tiers_unlock_rewards', 'time_of_day_puzzle_not_button', 'species_behaviors_unique'],
  },
  {
    id: 'design_narrative',
    name: 'Elena — narrative designer (Firewatch tone)',
    seat: 'game_designer',
    verdict: 'Field Report is only narrative payoff; habitats feel same',
    scores: { emotional_payoff: 5.0, worldbuilding: 4.0 },
    mandates: ['habitat_specific_story_beats', 'npc_field_partner_radio', 'journal_species_lore_cards'],
  },
  {
    id: 'design_audio',
    name: 'Marcus — audio designer (procedural + field recording)',
    seat: 'game_designer',
    verdict: 'Procedural calls work but lack species signature; no headphone mix',
    scores: { audio_clarity: 6.0, authenticity: 5.5 },
    mandates: ['species_signature_waveforms', 'stereo_pan_by_bearing', 'headphone_mode_toggle'],
  },
  {
    id: 'design_ux',
    name: 'Liam — UX lead (Nintendo polish bar)',
    seat: 'game_designer',
    verdict: 'Too many equal-weight buttons; primary action unclear',
    scores: { ui_hierarchy: 4.5, touch_targets: 7.0 },
    mandates: ['single_primary_cta_per_phase', 'hide_advanced_top_bar_until_exp_2', 'canvas_full_bleed_mobile'],
  },
  {
    id: 'design_vision',
    name: 'Panel — README vs shipped gap auditor',
    seat: 'game_designer',
    verdict: 'README promises Safari + Kaleidoscope + Echoes trilogy; shipped is Echoes-only stub',
    scores: { vision_alignment: 2.5, stakeholder_trust: 3.0 },
    mandates: ['rename_or_deliver_trilogy', 'song_meter_deploy_minigame', 'kaleidoscope_drag_cluster_poc'],
  },
];

const PREMORTEM = {
  launch_week: [
    { failure: '60% bounce before first record', cause: 'Record enabled too early OR never found', fix: 'Coach gates + pulse animation on Listen' },
    { failure: 'TikTok "confusing hiking game not birding"', cause: 'Grip/charge reads as action platformer', fix: 'Remove or hide dash until expedition 2' },
    { failure: 'Teacher cannot run 25-min lab', cause: 'No session timer / printable worksheet', fix: 'Educator mode + 15-min expedition preset' },
  ],
  month_1: [
    { failure: 'D7 retention 4%', cause: 'No reason to return after one habitat', fix: 'Daily BioBlitz streak + rotating rare caller' },
    { failure: 'WA partnership pass', cause: 'Feels like fan game not training tool', fix: 'Song Meter deploy UI + Kaleidoscope clustering' },
    { failure: '1-star "buttons buttons buttons"', cause: 'Top bar + dock + mission + coach', fix: 'Progressive UI disclosure by expedition level' },
  ],
  month_6: [
    { failure: 'Stuck at 3.2★ — "great idea bad execution"', cause: 'Art + FTUE never shipped', fix: 'Vector species art + forced tutorial win' },
    { failure: 'Competitor clone wins', cause: 'No viral share loop', fix: 'Shareable spectrogram card + habitat % cleared map' },
    { failure: 'Simulation scandal', cause: 'Bots score 10, humans 3', fix: 'Ship critical cohort gates in CI' },
  ],
};

/** Prioritized backlog — impact × urgency, grounded in build audit */
function buildBacklog() {
  const has = (f) => features[f];
  const items = [
    // P0 — ship blockers for 4★+ general public
    { id: 'P0-01', priority: 'P0', category: 'FTUE', title: 'Interactive first-clip tutorial (not text coach)', impact: 10, effort: 'L', owners: ['design_ftue', 'player_ftue'], status: has('interactiveTutorial') ? 'shipped' : (has('guidedCoach') ? 'partial' : 'missing'), detail: 'Force: move → hold Listen 2s → Record unlocks → tap ★ card → confetti. No skip on first run.' },
    { id: 'P0-02', priority: 'P0', category: 'Controls', title: 'Remove or defer grip/charge dash mechanic', impact: 9, effort: 'S', owners: ['player_cozy', 'design_ux'], status: has('dashDisabled') ? 'shipped' : 'shipped_bad', detail: 'Reads as different game; scares callers; never taught. Default: walk only; unlock dash in expedition 2.' },
    { id: 'P0-03', priority: 'P0', category: 'UI', title: 'Progressive disclosure — hide top action bar until expedition 2', impact: 9, effort: 'M', owners: ['design_ux', 'player_ftue'], status: has('progressiveDisclosure') ? 'shipped' : 'missing', detail: 'Dock = primary. Top bar: habitat tabs + help only on day 1.' },
    { id: 'P0-04', priority: 'P0', category: 'Visual', title: 'Replace JPEG sprites with vector/svg species silhouettes + glow', impact: 10, effort: 'L', owners: ['player_cozy', 'design_ux'], status: has('vectorSpeciesArt') ? 'shipped' : 'partial', detail: 'Glow labels help; sprites still blurry. SVG + palette per species.' },
    { id: 'P0-05', priority: 'P0', category: 'Audio', title: 'Stereo pan + louder proximity falloff when facing caller', impact: 8, effort: 'M', owners: ['design_audio', 'player_puzzle'], status: has('stereoWarmthAudio') ? 'shipped' : 'partial', detail: 'Listen cone exists but audio cue of "getting warmer" is weak.' },
    { id: 'P0-06', priority: 'P0', category: 'Identify', title: 'Make spectrogram matter — drag frequency band or tap peaks', impact: 9, effort: 'L', owners: ['player_puzzle', 'design_systems'], status: has('interactiveSpectrogram') ? 'shipped' : 'missing', detail: 'Mini spectrogram is static decoration; should hint ID.' },

    // P1 — 4.5★ path
    { id: 'P1-01', priority: 'P1', category: 'Systems', title: 'Time-of-day as puzzle (species activity chart), not T button', impact: 8, effort: 'M', owners: ['design_systems', 'player_hardcore'], status: 'missing', detail: 'Advance Time feels arbitrary; show who calls when.' },
    { id: 'P1-02', priority: 'P1', category: 'Retention', title: 'Daily BioBlitz streak + one rotating rare species', impact: 8, effort: 'M', owners: ['design_ftue'], status: 'partial', detail: 'Streak UI exists; no daily hook or FOMO caller.' },
    { id: 'P1-03', priority: 'P1', category: 'Educator', title: 'Demo/projector mode — 2× cone, labels, auto-pause on identify', impact: 7, effort: 'S', owners: ['player_edu'], status: 'missing', detail: 'Classroom killer feature.' },
    { id: 'P1-04', priority: 'P1', category: 'Narrative', title: 'Species lore cards in journal after correct ID', impact: 7, effort: 'M', owners: ['design_narrative'], status: 'missing', detail: 'Journal is list only; no "what you learned" per species.' },
    { id: 'P1-05', priority: 'P1', category: 'Feedback', title: 'Integrity bar redesign — show SNR meter tied to listen cone', impact: 7, effort: 'M', owners: ['player_hardcore', 'design_audio'], status: 'partial', detail: 'Integrity +/- toasts exist; causal link unclear.' },
    { id: 'P1-06', priority: 'P1', category: 'Mobile', title: 'Full-bleed canvas + dock-only on phone; kill duplicate RECORD CLIP', impact: 8, effort: 'S', owners: ['design_ux'], status: 'partial', detail: 'Red RECORD CLIP in top bar duplicates dock.' },
    { id: 'P1-07', priority: 'P1', category: 'Share', title: 'Shareable spectrogram card image (not clipboard text)', impact: 7, effort: 'M', owners: ['design_narrative'], status: 'missing', detail: 'Viral loop for BioBlitz.' },
    { id: 'P1-08', priority: 'P1', category: 'QA', title: 'CI gate: critical novice cohort ≥4.0 recommend before release', impact: 9, effort: 'S', owners: ['design_vision'], status: 'partial', detail: 'war-room.mjs exists; not in CI.' },

    // P2 — vision / differentiation
    { id: 'P2-01', priority: 'P2', category: 'Vision', title: 'Song Meter Safari deploy minigame (README promise)', impact: 10, effort: 'XL', owners: ['design_vision'], status: 'missing', detail: readme.includes('Song Meter Safari') ? 'README promises; not in index.html' : 'missing' },
    { id: 'P2-02', priority: 'P2', category: 'Vision', title: 'Kaleidoscope drag-drop clustering POC', impact: 10, effort: 'XL', owners: ['design_vision', 'player_puzzle'], status: 'missing', detail: 'Core retention hook in README.' },
    { id: 'P2-03', priority: 'P2', category: 'World', title: 'Habitat-specific ambient beds + weather', impact: 6, effort: 'L', owners: ['design_audio', 'player_cozy'], status: 'missing', detail: 'Forest/marsh/canyon sound same.' },
    { id: 'P2-04', priority: 'P2', category: 'NPC', title: 'Field partner radio (hints, story, celebrate 6/6)', impact: 6, effort: 'M', owners: ['design_narrative'], status: 'missing', detail: 'Emotional glue.' },
    { id: 'P2-05', priority: 'P2', category: 'Meta', title: 'Cross-habitat progression map (0/3 → 3/3 visual)', impact: 6, effort: 'M', owners: ['design_systems'], status: 'partial', detail: 'Habitat CTAs at end; no persistent map.' },

    // P3 — polish
    { id: 'P3-01', priority: 'P3', category: 'Polish', title: 'Particle juice on correct ID + expedition complete cinematic', impact: 5, effort: 'S', owners: ['design_ux'], status: 'partial', detail: 'Some particles; no celebration beat.' },
    { id: 'P3-02', priority: 'P3', category: 'A11y', title: 'Colorblind-safe caller markers + keyboard-only complete path', impact: 5, effort: 'M', owners: ['design_ux'], status: 'missing', detail: 'Green cone only.' },
    { id: 'P3-03', priority: 'P3', category: 'Persona', title: 'Persona affects UI density not just hint strings', impact: 4, effort: 'M', owners: ['design_ftue'], status: 'partial', detail: 'Liam vs Elena should feel different.' },
  ];
  return items.sort((a, b) => {
    const p = { P0: 0, P1: 1, P2: 2, P3: 3 };
    return p[a.priority] - p[b.priority] || b.impact - a.impact;
  });
}

function runSimSnapshot() {
  const rand = (s) => {
    let state = s;
    return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 0xffffffff; };
  };
  const red = [];
  const blue = [];
  let id = 0;
  for (const [seg, meta] of Object.entries(SEGMENTS)) {
    for (let i = 0; i < meta.count; i++) {
      id++;
      red.push(driveCriticalSession({ segment: seg, persona: meta.persona, skill: 0.55, features, rng: rand(9000 + id) }));
      blue.push(driveFieldSession({ segment: seg, persona: meta.persona, skill: 0.88, features, rng: rand(42 + id) }));
    }
  }
  const m = (arr, k) => arr.reduce((a, p) => a + (p.scores?.[k] ?? p[k]), 0) / arr.length;
  return {
    red: { fun: m(red, 'fun'), recommend: m(red, 'wouldRecommend'), completion: red.filter((p) => p.completed).length / red.length },
    blue: { fun: m(blue, 'fun'), recommend: m(blue, 'wouldRecommend'), completion: blue.filter((p) => p.completed).length / blue.length },
  };
}

const backlog = buildBacklog();
const sim = runSimSnapshot();
const expertAggregate = {
  players: {
    meanFun: EXPERT_PLAYERS.reduce((a, p) => a + p.scores.fun, 0) / EXPERT_PLAYERS.length,
    meanRecommend: EXPERT_PLAYERS.reduce((a, p) => a + p.scores.recommend, 0) / EXPERT_PLAYERS.length,
  },
  designers: EXPERT_PLAYERS.length,
};

const report = {
  generatedAt: new Date().toISOString(),
  build,
  features,
  simSnapshot: sim,
  expertPlayers: EXPERT_PLAYERS,
  expertDesigners: EXPERT_DESIGNERS,
  premortem: PREMORTEM,
  backlog,
  backlogSummary: {
    P0: backlog.filter((b) => b.priority === 'P0').length,
    P1: backlog.filter((b) => b.priority === 'P1').length,
    P2: backlog.filter((b) => b.priority === 'P2').length,
    P3: backlog.filter((b) => b.priority === 'P3').length,
    total: backlog.length,
  },
  northStar: 'General-public novice ≥4.5 would-recommend AND ≥70% complete one habitat in 18 minutes',
  currentGap: `Novice sim: ${sim.red.recommend.toFixed(2)}/5 recommend, ${(sim.red.completion * 100).toFixed(0)}% completion`,
};

writeFileSync(join(scratch, 'expert-war-room.json'), JSON.stringify(report, null, 2));

const md = formatMarkdown(report);
writeFileSync(join(scratch, 'expert-backlog.md'), md);

console.log('Expert war room complete');
console.log('  build:', build);
console.log('  backlog items:', backlog.length, `(P0=${report.backlogSummary.P0} P1=${report.backlogSummary.P1})`);
console.log('  novice sim:', sim.red.recommend.toFixed(2), 'recommend', (sim.red.completion * 100).toFixed(0) + '% completion');
console.log('  wrote:', join(scratch, 'expert-war-room.json'));
console.log('  wrote:', join(scratch, 'expert-backlog.md'));

function formatMarkdown(r) {
  const lines = [
    `# ECHOES Expert War Room — ${r.build}`,
    '',
    `**North star:** ${r.northStar}`,
    '',
    `**Current gap:** ${r.currentGap}`,
    '',
    `**Sim snapshot:** Red novices ${r.simSnapshot.red.recommend.toFixed(2)}/5 · Blue engaged ${r.simSnapshot.blue.recommend.toFixed(2)}/5`,
    '',
    '---',
    '',
    '## Expert players (red team)',
    '',
  ];
  for (const p of r.expertPlayers) {
    lines.push(`### ${p.name}`);
    lines.push(`- **Verdict:** ${p.verdict}`);
    lines.push(`- **Scores:** fun ${p.scores.fun}/10 · clarity ${p.scores.clarity}/10 · recommend ${p.scores.recommend}/5`);
    lines.push(`- **Blockers:** ${p.blockers.join('; ')}`);
    lines.push('');
  }
  lines.push('## Game designers (red team)');
  lines.push('');
  for (const d of r.expertDesigners) {
    lines.push(`### ${d.name}`);
    lines.push(`- **Verdict:** ${d.verdict}`);
    lines.push(`- **Mandates:** ${(d.mandates || []).join('; ')}`);
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push('## Pre-mortem');
  lines.push('');
  for (const [horizon, items] of Object.entries(r.premortem)) {
    lines.push(`### ${horizon.replace(/_/g, ' ')}`);
    for (const item of items) {
      lines.push(`- **${item.failure}** — ${item.cause} → *Fix:* ${item.fix}`);
    }
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push('## The big list (prioritized backlog)');
  lines.push('');
  for (const pri of ['P0', 'P1', 'P2', 'P3']) {
    const group = r.backlog.filter((b) => b.priority === pri);
    if (!group.length) continue;
    lines.push(`### ${pri} — ${pri === 'P0' ? 'Ship blockers' : pri === 'P1' ? '4.5★ path' : pri === 'P2' ? 'Vision / differentiation' : 'Polish'}`);
    lines.push('');
    for (const item of group) {
      lines.push(`- **[${item.id}]** ${item.title} (${item.effort}, impact ${item.impact}/10, ${item.status})`);
      lines.push(`  - ${item.detail}`);
      lines.push(`  - *Owners:* ${item.owners.join(', ')}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}