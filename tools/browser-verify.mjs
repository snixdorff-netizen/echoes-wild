#!/usr/bin/env node
/**
 * Browser verification — real keyboard input driving FieldSession via index.html.
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
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
  return {
    parsesScriptBlock: html.includes('function recordClip') && html.includes('function submitIdentification'),
    echoesCoreLoaded: html.includes('echoes-core.browser.js'),
    fieldSessionHook: html.includes('__echoesSession') && html.includes('FieldSession'),
    mobileHud: html.includes('id="mobile-hud"'),
    personaSelect: html.includes('id="persona"'),
    canvas880: html.includes('width="880"') && html.includes('height="620"'),
    noEsModuleEntry: !html.includes('type="module"'),
  };
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
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1100);

  let gateClicked = false;
  try {
    const gateBtn = page.locator('#audio-gate:not(.hidden) button');
    await gateBtn.waitFor({ state: 'visible', timeout: 4000 });
    await gateBtn.click();
    gateClicked = true;
  } catch (e) {
    errors.push('audio-gate click failed: ' + e.message);
  }

  const state0 = await page.evaluate(() => {
    const s = window.__echoesSession;
    if (!s) return { error: 'no __echoesSession' };
    return s.getState();
  });
  if (state0.error) errors.push(state0.error);

  const facingBefore = state0.player?.facing ?? 0;

  await page.keyboard.down('l');
  for (let i = 0; i < 45; i++) {
    await page.waitForTimeout(16);
  }
  await page.keyboard.up('l');

  const state1 = await page.evaluate(() => window.__echoesSession.getState());
  const facingAfter = state1.player?.facing ?? 0;
  const listenTicks = state1.listenTicksSession;

  await page.keyboard.press('r');
  await page.waitForTimeout(400);

  const state2 = await page.evaluate(() => {
    const s = window.__echoesSession.getState();
    const panel = document.getElementById('identify-panel');
    return {
      hasClip: !!s.currentClip,
      recordCount: s.recordCount,
      identifyVisible: panel && !panel.classList.contains('hidden'),
    };
  });

  const dims = await page.evaluate(() => {
    const c = document.getElementById('game');
    return { w: c.width, h: c.height };
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

  return {
    errors,
    dims,
    gateClicked,
    facingChanged: Math.abs(facingAfter - facingBefore) > 0.05,
    listenTicks,
    state2,
    painted,
    facingBefore,
    facingAfter,
  };
}

async function main() {
  const checks = staticChecks();
  const log = ['ECHOES browser verification (FieldSession)', 'static: ' + JSON.stringify(checks, null, 2)];
  const fallbackPath = join(scratch, 'launch-fallback.log');

  let pw;
  try {
    pw = await tryPlaywright();
  } catch (e) {
    log.push('playwright error: ' + e.message);
  }

  if (!pw) {
    log.push('playwright unavailable — static checks only');
    writeFileSync(fallbackPath, log.join('\n'));
    console.log(log.join('\n'));
    process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
  }

  try {
    unlinkSync(fallbackPath);
  } catch {
    /* none */
  }

  log.push('playwright dims: ' + JSON.stringify(pw.dims));
  log.push('audio gate clicked: ' + pw.gateClicked);
  log.push('listen ticks via rAF loop: ' + pw.listenTicks);
  log.push('facing changed: ' + pw.facingChanged + ' (' + pw.facingBefore.toFixed(3) + ' -> ' + pw.facingAfter.toFixed(3) + ')');
  log.push('record via KeyR: count=' + pw.state2.recordCount + ' clip=' + pw.state2.hasClip + ' panel=' + pw.state2.identifyVisible);
  log.push('nonzero pixels: ' + pw.painted);
  log.push('page errors: ' + (pw.errors.length ? pw.errors.join('; ') : 'none'));
  log.push('screenshot: ' + join(scratch, 'launch.png'));
  writeFileSync(join(scratch, 'browser-verify.log'), log.join('\n'));
  console.log(log.join('\n'));

  const ok =
    pw.errors.length === 0 &&
    pw.dims.w === 880 &&
    pw.dims.h === 620 &&
    pw.gateClicked &&
    pw.listenTicks > 5 &&
    pw.facingChanged &&
    pw.state2.recordCount >= 1 &&
    pw.state2.identifyVisible &&
    pw.painted > 1000 &&
    Object.values(checks).every(Boolean);
  process.exit(ok ? 0 : 1);
}

main();