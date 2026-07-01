#!/usr/bin/env node
/**
 * Plan verification step 2: run 100-player sim twice; each run writes {SCRATCH}/sim-report.json.
 * Archives each run, then writes combined sim-report-combined.json for dual-seed evidence.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const scratch =
  process.env.ECHOES_SCRATCH ||
  process.argv[2] ||
  join(root, '.scratch');
mkdirSync(scratch, { recursive: true });

const seeds = [42, 77];
const runs = [];
const logLines = [];

for (let runIndex = 0; runIndex < seeds.length; runIndex++) {
  const seed = seeds[runIndex];
  const runNum = runIndex + 1;
  logLines.push(`=== ECHOES sim run ${runNum}/2 (seed ${seed}) ===`);
  const proc = spawnSync(
    process.execPath,
    [join(__dirname, 'simulate-players.mjs'), scratch, String(seed)],
    { cwd: root, env: { ...process.env, ECHOES_SIM_SEED: String(seed) }, encoding: 'utf8' },
  );
  logLines.push(proc.stdout || '');
  if (proc.stderr) logLines.push(proc.stderr);

  const reportPath = join(scratch, 'sim-report.json');
  if (proc.status !== 0) {
    logLines.push(`run ${runNum} FAILED (exit ${proc.status})`);
    writeFileSync(join(scratch, 'sim-run.log'), logLines.join('\n'));
    process.exit(proc.status);
  }

  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  runs.push(report);

  // Archive this run's sim-report.json (plan: each run writes sim-report.json)
  const archivePath = join(scratch, `sim-report-run${runNum}.json`);
  copyFileSync(reportPath, archivePath);
  logLines.push(
    `run ${runNum} wrote ${reportPath} (seed ${seed}, passed=${report.passed}, fun=${report.aggregate.meanFun}, recommend=${report.aggregate.meanWouldRecommend})`,
  );
  logLines.push(`run ${runNum} archived to ${archivePath}`);
}

const combined = {
  generatedAt: new Date().toISOString(),
  build: runs[0]?.build || 'unknown',
  seeds,
  runs,
  passed: runs.every((r) => r.passed),
  aggregate: {
    meanFun: runs.reduce((a, r) => a + r.aggregate.meanFun, 0) / runs.length,
    meanWouldRecommend: runs.reduce((a, r) => a + r.aggregate.meanWouldRecommend, 0) / runs.length,
    completionRate: runs.reduce((a, r) => a + r.aggregate.completionRate, 0) / runs.length,
  },
  note: 'Each individual run also wrote sim-report.json; see sim-report-run1.json and sim-report-run2.json',
};

writeFileSync(join(scratch, 'sim-report-combined.json'), JSON.stringify(combined, null, 2));
// Final sim-report.json = last run (seed 77) per plan wording; combined in sim-report-combined.json
writeFileSync(join(scratch, 'sim-report.json'), JSON.stringify(runs[runs.length - 1], null, 2));
writeFileSync(join(scratch, 'sim-run.log'), logLines.join('\n'));

console.log('ECHOES dual-seed simulation complete');
console.log('  seeds:', seeds.join(', '));
console.log('  both runs wrote:', join(scratch, 'sim-report.json'));
console.log('  archives:', join(scratch, 'sim-report-run1.json'), join(scratch, 'sim-report-run2.json'));
console.log('  combined:', join(scratch, 'sim-report-combined.json'));
console.log('  passed:', combined.passed);
process.exit(combined.passed ? 0 : 1);