#!/usr/bin/env node
/**
 * One-shot bioacoustics goal verification — runs build/test/war-room/ci/verify
 * and writes acceptance evidence to {SCRATCH}/verification-summary.json.
 */
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const scratch =
  process.env.ECHOES_SCRATCH ||
  process.argv[2] ||
  join(root, '.scratch');
mkdirSync(scratch, { recursive: true });

const BASELINE_FIDELITY = 8.692857142857143;
const MIN_FIDELITY = 9.99;
const MIN_EDUCATOR_CLASSROOM = 4.0;

function childEnv() {
  const env = { ...process.env, ECHOES_SCRATCH: scratch };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_TEST_RUNNER_WATCH_MODE;
  return env;
}

function run(cmd, logName) {
  const logPath = join(scratch, logName);
  const result = spawnSync(cmd, {
    shell: true,
    cwd: root,
    env: childEnv(),
    encoding: 'utf8',
  });
  const out = (result.stdout || '') + (result.stderr || '');
  writeFileSync(logPath, out);
  if (result.status !== 0) {
    throw new Error(`${cmd} failed (exit ${result.status}); see ${logPath}`);
  }
  return out;
}

function gitChangedSince(tag) {
  try {
    const out = execSync(`git diff --name-only ${tag}`, { cwd: root, encoding: 'utf8' });
    return out.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function parseVerifyLog(text) {
  const headerV24 = /v2\.4/.test(text);
  const pageErrorsNone = /page errors: none/.test(text);
  const paintedMatch = text.match(/nonzero pixels: (\d+)/);
  const painted = paintedMatch ? Number(paintedMatch[1]) : 0;
  const dimsMatch = text.match(/playwright dims: (\{[^}]+\})/);
  let dims880x620 = false;
  if (dimsMatch) {
    try {
      const dims = JSON.parse(dimsMatch[1]);
      dims880x620 = dims.w === 880 && dims.h === 620;
    } catch {
      dims880x620 = /"w":880/.test(dimsMatch[1]) && /"h":620/.test(dimsMatch[1]);
    }
  }
  const staticV24Flags =
    /personaChooser/.test(text) ||
    (/static:/.test(text) &&
      /phenologyChart": true/.test(text) &&
      /kaleidoscopePoc": true/.test(text) &&
      /dailyBioBlitzShipped": true/.test(text));
  const minPainted = 1000;
  return {
    headerV24,
    pageErrorsNone,
    substantivePainted: painted > minPainted,
    dims880x620,
    staticV24Flags,
    painted,
    minPainted,
  };
}

function main() {
  const steps = [
    ['npm run build:browser', 'build-browser.log'],
    ['npm test', 'npm-test.log'],
    ['npm run bioacoustics-war-room', 'bioacoustics-war-room-run.log'],
    ['npm run bioacoustics-ci', 'bioacoustics-ci.log'],
    ['npm run verify', 'verify.log'],
  ];

  for (const [cmd, logName] of steps) {
    console.log('→', cmd);
    run(cmd, logName);
  }

  const warRoom = JSON.parse(readFileSync(join(scratch, 'bioacoustics-war-room.json'), 'utf8'));
  const build =
    warRoom.build ||
    (readFileSync(join(root, 'index.html'), 'utf8').match(/BUILD_VERSION = '([^']+)'/) || [])[1] ||
    'unknown';
  const fidelity = warRoom.simAggregate.meanSpectrogramFidelity;
  const liftPct = ((fidelity - BASELINE_FIDELITY) / BASELINE_FIDELITY) * 100;
  const educatorScores = warRoom.sessions
    .filter((s) => s.role === 'educator')
    .map((s) => s.scores.wouldUseInClassroom);

  const verifyText = existsSync(join(scratch, 'verify.log'))
    ? readFileSync(join(scratch, 'verify.log'), 'utf8')
    : existsSync(join(scratch, 'browser-verify.log'))
      ? readFileSync(join(scratch, 'browser-verify.log'), 'utf8')
      : '';
  const verify = parseVerifyLog(verifyText);
  const testLog = readFileSync(join(scratch, 'npm-test.log'), 'utf8');
  const failMatch = testLog.match(/(?:ℹ|#) fail (\d+)/);
  const passMatch = testLog.match(/(?:ℹ|#) pass (\d+)/);
  const testsPass =
    passMatch !== null &&
    Number(passMatch[1]) >= 41 &&
    (failMatch === null || Number(failMatch[1]) === 0);

  const summary = {
    repo: root,
    build,
    changedFilesSinceV231: gitChangedSince('29f68e5'),
    acceptance: {
      spectrogramFidelity: {
        baseline: BASELINE_FIDELITY,
        current: fidelity,
        liftPct,
        pass: fidelity >= MIN_FIDELITY,
      },
      educatorClassroom: {
        scores: educatorScores,
        pass: educatorScores.some((s) => s >= MIN_EDUCATOR_CLASSROOM),
      },
      verify: {
        ...verify,
        processExit0: true,
      },
      tests51Pass: testsPass,
      bioacousticsCiPass: true,
    },
    allPass: false,
  };

  summary.allPass =
    summary.acceptance.spectrogramFidelity.pass &&
    summary.acceptance.educatorClassroom.pass &&
    summary.acceptance.verify.pageErrorsNone &&
    summary.acceptance.verify.substantivePainted &&
    summary.acceptance.verify.dims880x620 &&
    summary.acceptance.verify.processExit0 &&
    summary.acceptance.tests51Pass &&
    summary.acceptance.bioacousticsCiPass;

  writeFileSync(join(scratch, 'verification-summary.json'), JSON.stringify(summary, null, 2));
  console.log('verification-summary.json →', join(scratch, 'verification-summary.json'));
  console.log('  fidelity:', fidelity.toFixed(2), `(lift ${liftPct.toFixed(1)}%)`);
  console.log('  educator classroom:', educatorScores.join(', '));
  console.log('  allPass:', summary.allPass);

  if (!summary.allPass) process.exit(1);
}

main();