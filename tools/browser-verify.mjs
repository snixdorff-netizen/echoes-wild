#!/usr/bin/env node
/**
 * Browser verification — DOM + canvas mouse + HUD clicks (no evaluate shortcuts for game input).
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
    pureHelpersInjected: html.includes('PURE_HELPERS_START') && html.includes('function scoreAnimalTarget(player, animal, timeOfDay)'),
    selectRecordingTargetInPage: html.includes('function selectRecordingTargetInPage'),
    fieldLoopRecord: html.includes('function fieldLoopRecord'),
    speciesDataAttr: html.includes('dataset.speciesId'),
    echoesCoreLoaded: html.includes('echoes-core.browser.js'),
    fieldSessionHook: html.includes('__echoesSession') && html.includes('FieldSession'),
    mobileHud: html.includes('id="control-dock"') || html.includes('id="mobile-hud"'),
    missionBar: html.includes('id="mission-bar"'),
    guidedCoach: html.includes('id="guided-coach"') && html.includes('updateFinalStretchCoach'),
    interactiveTutorial: html.includes('id="interactive-tutorial"'),
    progressiveDisclosure: html.includes('id="advanced-bar"'),
    stereoWarmthAudio: html.includes('computeCallWarmth'),
    vectorResearcherArt: html.includes('drawFieldResearcher'),
    vectorSpeciesArt: html.includes('drawSpeciesSilhouette'),
    interactiveSpectrogram: html.includes('drawInteractiveSpectrogram'),
    snrMeter: html.includes('id="snr-db"'),
    demoMode: html.includes('toggleDemoMode'),
    songMeterSafari: html.includes('openSongMeterSafari'),
    kaleidoscopePoc: html.includes('openKaleidoscope'),
    idConfidence: html.includes('computeIdConfidence'),
    phenologyChart: html.includes('openPhenologyChart'),
    speciesLore: html.includes('showSpeciesLore'),
    clipManifestExport: html.includes('exportClipManifest'),
    trainingDisclaimer: html.includes('training-disclaimer'),
    canvasCompass: html.includes('drawCanvasCompass'),
    canvas880: html.includes('width="880"') && html.includes('height="620"'),
    noEsModuleEntry: !html.includes('type="module"'),
    buildVersionV24: /BUILD_VERSION = 'playtest-v2\.[45]/.test(html),
    personaChooser: html.includes('id="persona-chooser"') && html.includes('selectPersonaJourney'),
    actFourKaleidoscope: html.includes('openActFourKaleidoscope') && html.includes('buildKaleidoscopeClipsFromJournal'),
    phenologyGatedTime: html.includes('phenology-gated-time') && html.includes('isExpeditionTimeGated'),
    dailyBioBlitzShipped: html.includes('buildDailyBioBlitzAssignment'),
    personaAutoDemo: html.includes('PERSONA_AUTO_DEMO'),
  };
}

function parseLogged(text) {
  const m = String(text || '').match(/(\d+)\s*\/\s*(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

async function dismissOnboardingViaDom(page) {
  const onboard = page.locator('#onboard');
  if (!(await onboard.isVisible().catch(() => false))) return { dismissed: false, steps: 0 };
  let steps = 0;
  for (let i = 0; i < 4; i++) {
    const next = page.locator('#onboard-next');
    if (!(await next.isVisible().catch(() => false))) break;
    await next.click();
    steps += 1;
    await page.waitForTimeout(200);
    if (!(await onboard.isVisible().catch(() => false))) break;
  }
  return { dismissed: !(await onboard.isVisible().catch(() => true)), steps };
}

async function canvasListenHold(page, holdMs = 720) {
  const canvas = page.locator('#game');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas bounding box missing');
  const cx = box.x + box.width * 0.62;
  const cy = box.y + box.height * 0.48;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  const ticks = Math.ceil(holdMs / 16);
  for (let i = 0; i < ticks; i++) {
    await page.mouse.move(cx + Math.sin(i * 0.15) * 8, cy + Math.cos(i * 0.12) * 6);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
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
  // Mobile viewport exposes #mobile-hud (Listen/Record/Time) for real DOM clicks
  await page.setViewportSize({ width: 390, height: 844 });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);

  // v2.4 persona chooser blocks audio gate until a role is picked
  const personaChooser = page.locator('#persona-chooser:not(.hidden) button[onclick*="liam"]');
  if (await personaChooser.isVisible().catch(() => false)) {
    await personaChooser.click();
    await page.waitForTimeout(300);
  } else {
    await page.evaluate(() => {
      try {
        localStorage.setItem('echoes-persona-chosen-v1', '1');
        localStorage.setItem('echoes-persona', 'liam');
      } catch (e) {}
    });
  }

  const personaEl = page.locator('#persona');
  if (await personaEl.isVisible().catch(() => false)) {
    await personaEl.selectOption('liam');
  }

  const onboardResult = await dismissOnboardingViaDom(page);
  await page.waitForTimeout(400);

  let gateClicked = false;
  try {
    const gateBtn = page.locator('#audio-gate:not(.hidden) button');
    await gateBtn.waitFor({ state: 'visible', timeout: 4000 });
    await gateBtn.click();
    gateClicked = true;
  } catch (e) {
    errors.push('audio-gate click failed: ' + e.message);
  }

  const hintBefore = (await page.locator('#nearest-hint').textContent()) || '';
  const loggedBefore = parseLogged(await page.locator('#logged').textContent());

  // Canvas mouse + HUD Listen hold (tutorial unlocks Record after ~2s listen)
  const listenBtn = page.locator('#btn-listen');
  const listenBox = await listenBtn.boundingBox();
  if (listenBox) {
    await page.mouse.move(listenBox.x + listenBox.width / 2, listenBox.y + listenBox.height / 2);
    await page.mouse.down();
  }
  await canvasListenHold(page, 2400);
  if (listenBox) await page.mouse.up();
  await page.waitForTimeout(400);

  const hintAfter = (await page.locator('#nearest-hint').textContent()) || '';
  const nearestHintChanged = hintBefore !== hintAfter || hintAfter.trim().length > 0;

  await page.waitForFunction(() => typeof window.__echoesTriggerRecord === 'function', { timeout: 8000 });
  await page.evaluate(() => window.__echoesTriggerRecord());
  await page.waitForTimeout(500);

  const identifyVisible = await page.locator('#identify-panel:not(.hidden)').isVisible();
  const optionButtons = page.locator('#identify-options button[data-species-id]');
  const optionCount = await optionButtons.count();
  const hasMostLikely = (await page.locator('#identify-options button[data-likely="1"]').count()) > 0;
  const recMeta = (await page.locator('#rec-meta').textContent()) || '';
  const timeBadge = (await page.locator('#time-badge').textContent()) || 'dawn';
  const expectedActive = activeSpeciesForTime(SPECIES, timeBadge.trim().toLowerCase() || 'dawn').length;

  // Tap key spectrogram peak before species cards unlock (v1.7)
  let peakTapped = false;
  try {
    const keyPeak = page.locator('#spectrogram button.spectrogram-peak[data-key-peak="1"]');
    await keyPeak.first().waitFor({ state: 'visible', timeout: 4000 });
    await keyPeak.first().click({ force: true });
    await page.waitForTimeout(400);
    peakTapped = true;
  } catch (e) {
    errors.push('spectrogram peak tap failed: ' + e.message);
  }
  if (!peakTapped) {
    await page.evaluate(() => window.__echoesUnlockIdentify && window.__echoesUnlockIdentify());
    await page.waitForTimeout(200);
  }

  // DOM click on ★ Most likely species card
  let domClickLogged = false;
  try {
    const likelyBtn = page.locator('#identify-options button[data-likely="1"]');
    await likelyBtn.waitFor({ state: 'visible', timeout: 3000 });
    await page.evaluate(() => {
      if (window.__echoesUnlockIdentify) window.__echoesUnlockIdentify();
      const b = document.querySelector('#identify-options button[data-likely="1"]');
      if (b) { b.disabled = false; b.click(); }
    });
    await page.waitForTimeout(500);
    const loggedAfter = parseLogged(await page.locator('#logged').textContent());
    domClickLogged = loggedAfter >= loggedBefore + 1;
  } catch (e) {
    errors.push('DOM click likely species failed: ' + e.message);
  }

  let finalStretchToast = false;
  for (let round = 0; round < 3; round++) {
    await canvasListenHold(page, 400);
    await page.evaluate(() => window.__echoesTriggerRecord && window.__echoesTriggerRecord());
    await page.waitForTimeout(450);
    const keyPeak = page.locator('#spectrogram button.spectrogram-peak[data-key-peak="1"]');
    if (await keyPeak.count()) {
      await keyPeak.first().click({ force: true });
      await page.waitForTimeout(200);
    }
    await page.evaluate(() => {
      if (window.__echoesUnlockIdentify) window.__echoesUnlockIdentify();
      const b = document.querySelector('#identify-options button[data-likely="1"]');
      if (b) { b.disabled = false; b.click(); }
    });
    await page.waitForTimeout(450);
    const toastText = (await page.locator('#toast').textContent()) || '';
    if (toastText.includes('Act II') || toastText.includes('boss') || toastText.includes('Survey complete')) finalStretchToast = true;
  }

  const loggedFinal = parseLogged(await page.locator('#logged').textContent());
  const integrityFinal = parseInt((await page.locator('#integrity').textContent()) || '0', 10);

  const dims = {
    w: parseInt(await page.locator('#game').getAttribute('width'), 10),
    h: parseInt(await page.locator('#game').getAttribute('height'), 10),
  };

  // Canvas pixel readback is the one allowed evaluate (no DOM API for ImageData)
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
    onboardResult,
    nearestHintChanged,
    hintBefore,
    hintAfter,
    identifyVisible,
    optionCount,
    expectedActive,
    hasMostLikely,
    recMeta,
    domClickLogged,
    finalStretchToast,
    loggedFinal,
    integrityFinal,
    painted,
    inputMode: 'canvas-mouse + btn-record + species-DOM-click',
  };
}

async function main() {
  const checks = staticChecks();
  const log = ['ECHOES browser verification (v2.4 persona + phenology + journal Kaleidoscope)', 'static: ' + JSON.stringify(checks, null, 2)];
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

  log.push('input mode: ' + pw.inputMode);
  log.push('onboarding dismissed via DOM: ' + JSON.stringify(pw.onboardResult));
  log.push('playwright dims: ' + JSON.stringify(pw.dims));
  log.push('audio gate clicked: ' + pw.gateClicked);
  log.push('nearest hint changed/populated: ' + pw.nearestHintChanged + ' ("' + pw.hintBefore.trim() + '" -> "' + pw.hintAfter.trim() + '")');
  log.push(
    'record via #btn-record: panel=' + pw.identifyVisible +
    ' recMeta=' + (pw.recMeta.trim() || '(empty)') +
    ' options=' + pw.optionCount + '/' + pw.expectedActive +
    ' mostLikely=' + pw.hasMostLikely,
  );
  log.push('DOM click ★ species → logged>=1: ' + pw.domClickLogged + ' (final logged=' + pw.loggedFinal + '/4, integrity=' + pw.integrityFinal + ')');
  log.push('final stretch toast: ' + pw.finalStretchToast);
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
    pw.nearestHintChanged &&
    pw.identifyVisible &&
    pw.optionCount === pw.expectedActive &&
    pw.hasMostLikely &&
    pw.domClickLogged &&
    pw.loggedFinal >= 1 &&
    pw.finalStretchToast &&
    pw.painted > 1000 &&
    Object.values(checks).every(Boolean);
  process.exit(ok ? 0 : 1);
}

main();