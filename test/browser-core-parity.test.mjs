import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initAnimals,
  selectRecordingTarget,
  applyIdentification,
  FACING_BONUS_THRESHOLD,
} from '../tools/echoes-core.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const browserSrc = readFileSync(join(root, 'tools/echoes-core.browser.js'), 'utf8');

function loadBrowserCore() {
  const sandbox = { window: {}, globalThis: {} };
  sandbox.globalThis = sandbox.window;
  vm.runInNewContext(browserSrc, sandbox);
  return sandbox.window.EchoesCore;
}

describe('browser bundle parity', () => {
  it('loads EchoesCore without module syntax', () => {
    assert.ok(!browserSrc.includes('export '));
    const core = loadBrowserCore();
    assert.equal(typeof core.selectRecordingTarget, 'function');
    assert.equal(core.FACING_BONUS_THRESHOLD, FACING_BONUS_THRESHOLD);
  });

  it('selectRecordingTarget matches mjs for same inputs', () => {
    const core = loadBrowserCore();
    const animals = initAnimals('forest');
    const player = { x: 125, y: 285, facing: Math.atan2(5, 5), listenActive: true };

    const mjs = selectRecordingTarget(player, animals, 'dawn');
    const browser = core.selectRecordingTarget(player, animals, 'dawn');

    assert.equal(browser.dominant.species.id, mjs.dominant.species.id);
    assert.equal(browser.best.species.id, mjs.best.species.id);
    assert.ok(Math.abs(browser.quality - mjs.quality) < 0.001);
  });

  it('uses deterministic fallback when no scored target', () => {
    const core = loadBrowserCore();
    const animals = initAnimals('forest').map((a) => ({ ...a, activity: ['night'] }));
    const player = { x: 125, y: 285, facing: 0, listenActive: false };
    const rec = core.selectRecordingTarget(player, animals, 'dawn');
    assert.equal(rec.dominant.species.id, animals[0].species.id);
    assert.equal(rec.best.species.id, animals[0].species.id);
  });

  it('applyIdentification matches mjs', () => {
    const core = loadBrowserCore();
    const state = {
      chosenId: 'owl',
      dominantId: 'owl',
      quality: 0.82,
      logged: 2,
      integrity: 90,
    };
    const mjsOut = applyIdentification(state);
    const browserOut = core.applyIdentification(state);
    assert.equal(browserOut.correct, mjsOut.correct);
    assert.equal(browserOut.logged, mjsOut.logged);
    assert.equal(browserOut.integrity, mjsOut.integrity);
    assert.equal(browserOut.delta, mjsOut.delta);
  });
});