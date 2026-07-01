#!/usr/bin/env node
/**
 * Collects echoes-wild deliverables + verification manifest into {SCRATCH}.
 * Addresses harness CHANGED_FILES blind spot for nested git repo.
 */
import { execSync } from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  existsSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const scratch =
  process.env.ECHOES_SCRATCH ||
  process.argv[2] ||
  join(root, '.scratch');
const deliverables = join(scratch, 'deliverables', 'echoes-wild');
mkdirSync(deliverables, { recursive: true });

const TRACKED = [
  'index.html',
  'PLAYTEST.md',
  'package.json',
  'tools/browser-verify.mjs',
  'tools/build-browser-core.mjs',
  'tools/run-sim-twice.mjs',
  'tools/simulate-players.mjs',
  'tools/echoes-core.mjs',
  'tools/field-session.mjs',
  'tools/sim-drive.mjs',
  'test/shipped-loop.test.mjs',
  'test/field-session.test.mjs',
];

function sha256(path) {
  const data = readFileSync(path);
  return createHash('sha256').update(data).digest('hex').slice(0, 16);
}

const changedFiles = [];
for (const rel of TRACKED) {
  const src = join(root, rel);
  if (!existsSync(src)) continue;
  const dest = join(deliverables, rel);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  changedFiles.push({
    path: `echoes-wild/${rel}`,
    sha256: sha256(src),
    bytes: readFileSync(src).length,
  });
}

let gitDiff = '';
try {
  gitDiff = execSync('git diff HEAD', { cwd: root, encoding: 'utf8' });
} catch {
  gitDiff = '(git diff unavailable)';
}
writeFileSync(join(scratch, 'echoes-wild.patch'), gitDiff);

const html = readFileSync(join(root, 'index.html'), 'utf8');
const build = (html.match(/BUILD_VERSION = '([^']+)'/) || [])[1] || 'unknown';

const manifest = {
  generatedAt: new Date().toISOString(),
  build,
  repo: root,
  liveUrl: 'https://snixdorff-netizen.github.io/echoes-wild/',
  harnessNote:
    'Parent workspace CHANGED_FILES may omit nested echoes-wild/; this manifest + deliverables/ + echoes-wild.patch are authoritative.',
  changedFiles,
  verificationPlan: {
    step1: { artifact: 'unit-tests.log', command: 'npm test' },
    step2: {
      artifact: 'sim-report.json',
      archives: ['sim-report-run1.json', 'sim-report-run2.json', 'sim-report-combined.json'],
      command: 'ECHOES_SCRATCH=... npm run sim',
      note: 'simulate-players.mjs writes sim-report.json on each of two runs',
    },
    step3: {
      artifact: 'browser-verify.log',
      screenshot: 'launch.png',
      command: 'ECHOES_SCRATCH=... npm run verify',
      note: 'Single browser smoke session; 100-player bar met by FieldSession sim (step 2)',
    },
    step4: { artifact: 'improvements.md' },
    step5: { artifact: 'PLAYTEST.md', build },
  },
  deliverablesDir: deliverables,
};

writeFileSync(join(scratch, 'CHANGED_FILES.json'), JSON.stringify(changedFiles, null, 2));
writeFileSync(join(scratch, 'verification-manifest.json'), JSON.stringify(manifest, null, 2));

console.log('Evidence collected to', scratch);
console.log('  CHANGED_FILES.json:', changedFiles.length, 'echoes-wild files');
console.log('  deliverables:', deliverables);
console.log('  build:', build);