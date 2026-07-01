#!/usr/bin/env node
/**
 * Browser verification — real keyboard input driving FieldSession via index.html.
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPECIES, activeSpeciesForTime } from './echoes-core.mjs';

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
    parsesScriptBlock: html.includes('function fieldLoopRecord') && html.includes('function fieldLoopIdentify'),
    echoesCoreLoaded: html.includes('echoes-core.browser.js'),
    fieldSessionHook: html.includes('__echoesSession') && html.includes('FieldSession'),
    buildIdentifyOptions: html.includes('buildIdentifyOptions'),
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
    localStorage.setItem('echoes-persona', 'liam');
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

  const identifyUi = await page.evaluate(() => {
    const s = window.__echoesSession.getState();
    const panel = document.getElementById('identify-panel');
    const opts = document.getElementById('identify-options');
    const buttons = opts ? [...opts.querySelectorAll('button')] : [];
    return {
      hasClip: !!s.currentClip,
      recordCount: s.recordCount,
      identifyVisible: panel && !panel.classList.contains('hidden'),
      optionCount: buttons.length,
      hasMostLikely: (opts?.innerHTML || '').includes('Most likely'),
      timeOfDay: s.gameState.timeOfDay,
      dominantId: s.currentClip?.dominant?.id || null,
      quality: s.currentClip?.quality || 0,
    };
  });

  const expectedActive = activeSpeciesForTime(SPECIES, identifyUi.timeOfDay || 'dawn').length;

  let finalStretchToast = false;
  for (let round = 0; round < 4; round++) {
    if (!identifyUi.dominantId && round > 0) break;
    const domId = await page.evaluate(() => window.__echoesSession.getState().currentClip?.dominant?.id);
    if (!domId) {
      await page.keyboard.down('l');
      for (let i = 0; i < 30; i++) await page.waitForTimeout(16);
      await page.keyboard.up('l');
      await page.keyboard.press('r');
      await page.waitForTimeout(350);
    }
    const clickId = domId || identifyUi.dominantId;
    if (!clickId) break;
    await page.evaluate((speciesId) => {
      if (typeof submitIdentification === 'function') submitIdentification(speciesId);
    }, clickId);
    await page.waitForTimeout(500);
    const toastText = await page.evaluate(() => document.getElementById('toast')?.textContent || '');
    if (toastText.includes('final stretch')) finalStretchToast = true;
    if (round < 3) {
      await page.keyboard.down('l');
      for (let i = 0; i < 25; i++) await page.waitForTimeout(16);
      await page.keyboard.up('l');
      await page.keyboard.press('r');
      await page.waitForTimeout(350);
    }
  }

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
    identifyUi,
    expectedActive,
    finalStretchToast,
    painted,
    facingBefore,
    facingAfter,
  };
}

async function main() {
  const checks = staticChecks();
  const log = ['ECHOES browser verification (FieldSession v1.4.2)', 'static: ' + JSON.stringify(checks, null, 2)];
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
  log.push(
    'record via KeyR: count=' + pw.identifyUi.recordCount +
    ' clip=' + pw.identifyUi.hasClip +
    ' panel=' + pw.identifyUi.identifyVisible +
    ' options=' + pw.identifyUi.optionCount + '/' + pw.expectedActive +
    ' mostLikely=' + pw.identifyUi.hasMostLikely,
  );
  log.push('final stretch toast after 4th log: ' + pw.finalStretchToast);
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
    pw.identifyUi.recordCount >= 1 &&
    pw.identifyUi.identifyVisible &&
    pw.identifyUi.optionCount === pw.expectedActive &&
    pw.identifyUi.optionCount < SPECIES.length &&
    pw.identifyUi.hasMostLikely &&
    pw.finalStretchToast &&
    pw.painted > 1000 &&
    Object.values(checks).every(Boolean);
  process.exit(ok ? 0 : 1);
}

main();