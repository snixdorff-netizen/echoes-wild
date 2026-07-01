#!/usr/bin/env node
/**
 * Browser launch verification for ECHOES index.html
 */
import { createServer } from 'node:http';
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

const html = readFileSync(join(root, 'index.html'), 'utf8');

function staticChecks() {
  const checks = {
    parsesScriptBlock: html.includes('function recordClip') && html.includes('function submitIdentification'),
    echoesCoreLoaded: html.includes('echoes-core.browser.js'),
    mobileHud: html.includes('id="mobile-hud"'),
    personaSelect: html.includes('id="persona"'),
    canvas880: html.includes('width="880"') && html.includes('height="620"'),
    noEsModuleEntry: !html.includes('type="module"'),
  };
  return checks;
}

async function tryPlaywright() {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    return null;
  }
  const { chromium } = playwright;
  const port = 8765 + Math.floor(Math.random() * 200);
  const server = createServer((req, res) => {
    const url = req.url === '/' ? '/index.html' : req.url;
    const file = join(root, url.replace(/^\//, ''));
    try {
      const body = readFileSync(file);
      const type = file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'application/javascript' : 'text/plain';
      res.writeHead(200, { 'Content-Type': type });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  await new Promise((r) => server.listen(port, r));
  const errors = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('echoes-onboarding-v1', '1');
    localStorage.setItem('echoes-playtest-seen-help', '1');
    const ob = document.getElementById('onboard');
    if (ob) ob.classList.add('hidden');
    const hm = document.getElementById('help-modal');
    if (hm) hm.classList.add('hidden');
    if (typeof showAudioGateIfNeeded === 'function') showAudioGateIfNeeded();
  });
  await page.evaluate(() => {
    if (typeof unlockAudio === 'function') unlockAudio();
  });
  await page.waitForTimeout(500);
  const dims = await page.evaluate(() => {
    const c = document.getElementById('game');
    return { w: c.width, h: c.height, clientW: c.clientWidth };
  });
  await page.evaluate(() => {
    if (typeof recordClip === 'function') recordClip();
  });
  await page.waitForTimeout(300);
  const identifyVisible = await page.evaluate(() => {
    const p = document.getElementById('identify-panel');
    return p && !p.classList.contains('hidden');
  });
  const painted = await page.evaluate(() => {
    const c = document.getElementById('game');
    const ctx = c.getContext('2d');
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let nonzero = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] || data[i + 1] || data[i + 2]) nonzero++;
    }
    return nonzero;
  });
  await page.screenshot({ path: join(scratch, 'launch.png'), fullPage: false });
  await browser.close();
  server.close();
  return { errors, dims, identifyVisible, painted };
}

async function main() {
  const checks = staticChecks();
  const log = ['ECHOES browser verification', 'static: ' + JSON.stringify(checks, null, 2)];
  let pw;
  try {
    pw = await tryPlaywright();
  } catch (e) {
    log.push('playwright error: ' + e.message);
  }
  if (!pw) {
    const fallback = join(scratch, 'launch-fallback.log');
    log.push('playwright unavailable — static checks only');
    writeFileSync(fallback, log.join('\n'));
    console.log(log.join('\n'));
    const ok = Object.values(checks).every(Boolean);
    process.exit(ok ? 0 : 1);
  }
  log.push('playwright dims: ' + JSON.stringify(pw.dims));
  log.push('identify panel after recordClip: ' + pw.identifyVisible);
  log.push('nonzero pixels: ' + pw.painted);
  log.push('page errors: ' + (pw.errors.length ? pw.errors.join('; ') : 'none'));
  log.push('screenshot: ' + join(scratch, 'launch.png'));
  writeFileSync(join(scratch, 'browser-verify.log'), log.join('\n'));
  console.log(log.join('\n'));
  const ok =
    pw.errors.length === 0 &&
    pw.dims.w === 880 &&
    pw.dims.h === 620 &&
    pw.identifyVisible &&
    pw.painted > 1000 &&
    Object.values(checks).every(Boolean);
  process.exit(ok ? 0 : 1);
}

main();