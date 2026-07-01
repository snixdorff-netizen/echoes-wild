#!/usr/bin/env node
/**
 * Capture polished demo screenshots for presentations / marketing.
 * Usage: npm run capture-demo
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const scratch = process.env.ECHOES_SCRATCH || join(root, '.scratch');
mkdirSync(scratch, { recursive: true });

async function dismissOnboarding(page) {
  const onboard = page.locator('#onboard');
  if (!(await onboard.isVisible().catch(() => false))) return;
  for (let i = 0; i < 4; i++) {
    const next = page.locator('#onboard-next');
    if (!(await next.isVisible().catch(() => false))) break;
    await next.click();
    await page.waitForTimeout(180);
  }
}

async function main() {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    console.error('playwright not installed — run npm install');
    process.exit(1);
  }

  const { chromium } = playwright;
  const port = 8870 + Math.floor(Math.random() * 50);
  const server = createServer((req, res) => {
    const url = req.url === '/' ? '/index.html' : req.url;
    const file = join(root, url.replace(/^\//, '').split('?')[0]);
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

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  const base = `http://127.0.0.1:${port}/index.html?demo=1`;
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);

  await dismissOnboarding(page);
  try {
    const gateBtn = page.locator('#audio-gate:not(.hidden) button');
    if (await gateBtn.isVisible({ timeout: 2000 })) await gateBtn.click();
  } catch { /* optional */ }
  await page.waitForTimeout(400);

  const fieldPath = join(scratch, 'demo-field.png');
  await page.locator('#game-wrap').screenshot({ path: fieldPath });

  const heroPath = join(scratch, 'demo-hero.png');
  await page.screenshot({ path: heroPath, fullPage: false });

  await page.waitForFunction(() => typeof window.__echoesTriggerRecord === 'function', { timeout: 8000 });
  await page.evaluate(() => window.__echoesTriggerRecord());
  await page.waitForTimeout(700);

  const keyPeak = page.locator('#spectrogram button.spectrogram-peak[data-key-peak="1"]');
  if (await keyPeak.count()) {
    await keyPeak.first().click({ force: true });
    await page.waitForTimeout(300);
  }
  const identifyPath = join(scratch, 'demo-identify.png');
  await page.locator('#identify-panel').screenshot({ path: identifyPath });

  const finalePath = join(scratch, 'demo-field-report.png');
  await page.evaluate(() => window.__echoesOpenFieldReport && window.__echoesOpenFieldReport());
  await page.waitForTimeout(500);
  const finaleModal = page.locator('#field-report-modal:not(.hidden)');
  if (await finaleModal.isVisible().catch(() => false)) {
    await finaleModal.screenshot({ path: finalePath });
  }

  await browser.close();
  server.close();

  const build = (readFileSync(join(root, 'index.html'), 'utf8').match(/BUILD_VERSION = '([^']+)'/) || [])[1] || 'unknown';
  const out = [
    `ECHOES demo capture (${build})`,
    'field canvas: ' + fieldPath,
    'hero frame:   ' + heroPath,
    'identify UI:  ' + identifyPath,
    'field report: ' + finalePath,
  ];
  writeFileSync(join(scratch, 'demo-capture.log'), out.join('\n'));
  console.log(out.join('\n'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});