import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SPECIES,
  buildIdentifyOptions,
  activeSpeciesForTime,
  applyIdentification,
  shouldCompleteExpedition,
  scoreAnimalTarget,
  clipQualityFromScore,
  initAnimals,
} from '../tools/echoes-core.mjs';
import { FieldSession } from '../tools/field-session.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');

function extractInjectedHelpers() {
  const startMarker = '<!-- PURE_HELPERS_START -->';
  const endMarker = '<!-- PURE_HELPERS_END -->';
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  assert.ok(start >= 0 && end > start, 'PURE_HELPERS markers missing');
  const block = html.slice(start + startMarker.length, end);
  assert.match(block, /function scoreAnimalTarget/);
  assert.match(block, /function applyIdentification/);
  return block;
}

function loadInjectedFromIndex() {
  const block = extractInjectedHelpers();
  const sandbox = {};
  vm.runInNewContext(block, sandbox);
  return sandbox;
}

describe('injected pure helpers in index.html source', () => {
  it('scoreAnimalTarget matches echoes-core.mjs', () => {
    const injected = loadInjectedFromIndex();
    const animals = initAnimals('forest');
    const player = { x: 125, y: 285, facing: Math.atan2(5, 5), listenActive: true };
    const mjs = scoreAnimalTarget(player, animals[0], 'dawn');
    const page = injected.scoreAnimalTarget(player, animals[0], 'dawn');
    assert.ok(Math.abs(mjs - page) < 0.001);
  });

  it('clipQualityFromScore matches echoes-core.mjs', () => {
    const injected = loadInjectedFromIndex();
    const score = 520;
    assert.equal(injected.clipQualityFromScore(score), clipQualityFromScore(score));
  });

  it('applyIdentification matches echoes-core.mjs', () => {
    const injected = loadInjectedFromIndex();
    const state = { chosenId: 'owl', dominantId: 'owl', quality: 0.82, logged: 2, integrity: 90 };
    const mjs = applyIdentification(state);
    const page = injected.applyIdentification(state);
    assert.equal(JSON.stringify(page), JSON.stringify(mjs));
  });

  it('shouldCompleteExpedition matches echoes-core.mjs', () => {
    const injected = loadInjectedFromIndex();
    assert.equal(injected.shouldCompleteExpedition(5), shouldCompleteExpedition(5));
    assert.equal(injected.shouldCompleteExpedition(6), shouldCompleteExpedition(6));
  });
});

describe('shipped loop runtime parity (page helpers === sim helpers)', () => {
  it('buildIdentifyOptions via EchoesCore matches mjs for same clip', () => {
    const browserSrc = readFileSync(join(root, 'tools/echoes-core.browser.js'), 'utf8');
    const sandbox = { window: {}, globalThis: {} };
    sandbox.globalThis = sandbox.window;
    vm.runInNewContext(browserSrc, sandbox);
    const core = sandbox.window.EchoesCore;

    const session = new FieldSession({ habitat: 'forest', timeOfDay: 'dawn' });
    for (let i = 0; i < 40; i++) {
      session.tick({ keys: { l: true, w: true }, mouse: { x: 200, y: 300, down: false, listenDown: true }, dt: 1, now: i * 16 });
    }
    const clip = session.record();
    const mjs = buildIdentifyOptions(SPECIES, clip, 'liam');
    const browser = core.buildIdentifyOptions(SPECIES, clip, 'liam');
    assert.equal(JSON.stringify(browser), JSON.stringify(mjs));
    assert.equal(mjs.length, activeSpeciesForTime(SPECIES, clip.timeOfDay).length);
  });

  it('fieldLoop chain uses inlined helpers not only EchoesCore delegation', () => {
    assert.match(html, /function selectRecordingTargetInPage/);
    assert.match(html, /function fieldLoopRecord/);
    assert.match(html, /const preview = applyIdentification/);
    assert.match(html, /if \(shouldCompleteExpedition\(logged\)\)/);
    assert.match(html, /dataset\.speciesId/);
    assert.match(extractInjectedHelpers(), /function scoreAnimalTarget/);
  });

  it('identify path updates logged count same as pure applyIdentification', () => {
    const session = new FieldSession({ habitat: 'forest', timeOfDay: 'dawn' });
    for (let i = 0; i < 30; i++) {
      session.tick({ keys: { l: true }, mouse: { x: 440, y: 310, down: false, listenDown: false }, dt: 1, now: i * 16 });
    }
    const clip = session.record();
    const before = session.getState().logged;
    const pure = applyIdentification({
      chosenId: clip.dominant.id,
      dominantId: clip.dominant.id,
      quality: clip.quality,
      logged: before,
      integrity: session.getState().integrity,
    });
    const outcome = session.identify(clip.dominant.id);
    assert.equal(outcome.logged, pure.logged);
    assert.equal(session.getState().logged, pure.logged);
    assert.equal(shouldCompleteExpedition(session.getState().logged), session.getState().logged >= 6);
  });
});