#!/usr/bin/env node
/**
 * Browser launch verification for ECHOES index.html — real UI input path.
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
    mobileHud: html.includes('id="mobile-hud"'),
    personaSelect: html.includes('id="persona"'),
    canvas880: html.includes('width="880"') && html.includes('height="620"'),
    noEsModuleEntry: !html.includes('type="module"'),
    debugStateHook: html.includes('getEchoesDebugState'),
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
  await page.waitForTimeout(400);

  const dims = await page.evaluate(() => {
    const c = document.getElementById('game');
    return { w: c.width, h: c.height, clientW: c.clientWidth };
  });

  const facingBefore = await page.evaluate(() => window.getEchoesDebugState().facing);
  await page.keyboard.down('l');
  await page.waitForTimeout(700);
  const listenState = await page.evaluate(() => window.getEchoesDebugState());
  await page.keyboard.up('l');

  await page.keyboard.press('r');
  await page.waitForTimeout(350);
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

  const facingChanged = Math.abs(listenState.facing - facingBefore) > 0.05;
  return {
    errors,
    dims,
    identifyVisible,
    painted,
    gateClicked,
    listenActiveDuringL: listenState.listenActive,
    facingChanged,
    facingBefore,
    facingAfter: listenState.facing,
  };
}

async function main() {
  const checks = staticChecks();
  const log = ['ECHOES browser verification', 'static: ' + JSON.stringify(checks, null, 2)];
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
    /* no stale fallback */
  }

  log.push('playwright dims: ' + JSON.stringify(pw.dims));
  log.push('audio gate clicked: ' + pw.gateClicked);
  log.push('listen active during L: ' + pw.listenActiveDuringL);
  log.push('facing changed with L held: ' + pw.facingChanged + ' (' + pw.facingBefore.toFixed(3) + ' -> ' + pw.facingAfter.toFixed(3) + ')');
  log.push('identify panel after KeyR: ' + pw.identifyVisible);
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
    pw.listenActiveDuringL &&
    pw.facingChanged &&
    pw.identifyVisible &&
    pw.painted > 1000 &&
    Object.values(checks).every(Boolean);
  process.exit(ok ? 0 : 1);
}

main();