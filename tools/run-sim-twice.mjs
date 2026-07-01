#!/usr/bin/env node
/**
 * Runs 100-player sim twice (seeds 42, 77) and writes combined sim-report.json.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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

for (const seed of seeds) {
  logLines.push(`=== ECHOES sim run seed ${seed} ===`);
  const proc = spawnSync(
    process.execPath,
    [join(__dirname, 'simulate-players.mjs'), scratch, String(seed)],
    { cwd: root, env: { ...process.env, ECHOES_SIM_SEED: String(seed) }, encoding: 'utf8' },
  );
  logLines.push(proc.stdout || '');
  if (proc.stderr) logLines.push(proc.stderr);
  if (proc.status !== 0) {
    writeFileSync(join(scratch, 'sim-run.log'), logLines.join('\n'));
    process.exit(proc.status);
  }
  const report = JSON.parse(readFileSync(join(scratch, `sim-report-seed${seed}.json`), 'utf8'));
  runs.push(report);
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
};

writeFileSync(join(scratch, 'sim-report.json'), JSON.stringify(combined, null, 2));
writeFileSync(join(scratch, 'sim-run.log'), logLines.join('\n'));

console.log('ECHOES dual-seed simulation complete');
console.log('  seeds:', seeds.join(', '));
console.log('  passed:', combined.passed);
console.log('  wrote:', join(scratch, 'sim-report.json'));
process.exit(combined.passed ? 0 : 1);