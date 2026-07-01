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
} from '../tools/echoes-core.mjs';
import { FieldSession } from '../tools/field-session.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const browserSrc = readFileSync(join(root, 'tools/echoes-core.browser.js'), 'utf8');

function loadBrowserCore() {
  const sandbox = { window: {}, globalThis: {} };
  sandbox.globalThis = sandbox.window;
  vm.runInNewContext(browserSrc, sandbox);
  return sandbox.window.EchoesCore;
}

describe('shipped loop runtime parity (page helpers === sim helpers)', () => {
  it('buildIdentifyOptions matches browser bundle for same clip + persona', () => {
    const core = loadBrowserCore();
    const session = new FieldSession({ habitat: 'forest', timeOfDay: 'dawn' });
    for (let i = 0; i < 40; i++) {
      session.tick({ keys: { l: true, w: true }, mouse: { x: 200, y: 300, down: false, listenDown: true }, dt: 1, now: i * 16 });
    }
    const clip = session.record();
    const personas = ['liam', 'marcus', 'aisha', 'elena'];
    for (const persona of personas) {
      const mjs = buildIdentifyOptions(SPECIES, clip, persona);
      const browser = core.buildIdentifyOptions(SPECIES, clip, persona);
      assert.equal(JSON.stringify(browser), JSON.stringify(mjs), `persona ${persona}`);
      const activeCount = activeSpeciesForTime(SPECIES, clip.timeOfDay).length;
      assert.equal(mjs.length, activeCount);
      assert.ok(mjs.length < SPECIES.length, 'active filter reduces card count');
    }
  });

  it('fieldLoop chain in index.html delegates to session + EchoesCore gates', () => {
    assert.match(html, /function fieldLoopExplore/);
    assert.match(html, /function fieldLoopRecord/);
    assert.match(html, /EchoesCore\.selectRecordingTarget/);
    assert.match(html, /function fieldLoopIdentify/);
    assert.match(html, /function fieldLoopComplete/);
    assert.match(html, /EchoesCore\.buildIdentifyOptions/);
    assert.match(html, /EchoesCore\.shouldCompleteExpedition/);
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