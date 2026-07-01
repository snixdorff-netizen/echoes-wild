import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { FieldSession } from '../tools/field-session.mjs';
import { driveFieldSession } from '../tools/sim-drive.mjs';
import { readShippedFeaturesFromHtml } from '../tools/echoes-core.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const features = readShippedFeaturesFromHtml(html);

function seededRandom(s) {
  let state = s;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

describe('FieldSession core loop', () => {
  it('tick + record + identify updates logged via same path as index.html', () => {
    const session = new FieldSession({ habitat: 'forest', timeOfDay: 'dawn' });
    for (let i = 0; i < 60; i++) {
      session.tick({ keys: { w: true, l: true }, mouse: { x: 200, y: 300, down: false, listenDown: true }, dt: 1, now: i * 16 });
    }
    const clip = session.record();
    assert.ok(clip);
    const before = session.getState().logged;
    const out = session.identify(clip.dominant.id);
    assert.equal(out.correct, true);
    assert.equal(session.getState().logged, before + 1);
  });

  it('keyboard listen changes facing toward nearest caller', () => {
    const session = new FieldSession({ habitat: 'forest', timeOfDay: 'dawn' });
    const facing0 = session.getState().player.facing;
    for (let i = 0; i < 30; i++) {
      session.tick({ keys: { l: true }, mouse: { x: 440, y: 310, down: false, listenDown: false }, dt: 1, now: i * 16 });
    }
    const facing1 = session.getState().player.facing;
    assert.ok(Math.abs(facing1 - facing0) > 0.05);
    assert.equal(session.getState().listenActive, true);
  });
});

describe('shipped index.html wires FIELD_LOOP to FieldSession', () => {
  it('recordClip and submitIdentification delegate to session.record/identify', () => {
    assert.match(html, /function recordClip\(\)[\s\S]*session\.record\(\)/);
    assert.match(html, /function submitIdentification[\s\S]*session\.identify\(/);
    assert.match(html, /function update\(\)[\s\S]*session\.tick\(/);
    assert.match(html, /shouldCompleteExpedition|logged >= 6/);
    assert.match(html, /function showExpeditionComplete/);
    assert.match(html, /FIELD_LOOP step 1/);
    assert.match(html, /activeSpeciesForTime/);
    assert.match(html, /Most likely/);
  });
});

describe('browser bundle includes FieldSession', () => {
  it('loads FieldSession from generated browser file', () => {
    const browserSrc = readFileSync(join(root, 'tools/echoes-core.browser.js'), 'utf8');
    const sandbox = { window: {}, globalThis: {} };
    sandbox.globalThis = sandbox.window;
    vm.runInNewContext(browserSrc, sandbox);
    assert.equal(typeof sandbox.window.EchoesCore.FieldSession, 'function');
    const s = new sandbox.window.EchoesCore.FieldSession({ habitat: 'forest', timeOfDay: 'dawn' });
    assert.equal(s.getState().logged, 0);
  });
});

describe('convergence gate — low-skill general can fail to complete', () => {
  it('50 seeded general sessions at skill ≤0.68 produce incomplete habitats', () => {
    const sessions = [];
    for (let seed = 1; seed <= 50; seed++) {
      sessions.push(
        driveFieldSession({
          segment: 'general',
          persona: 'liam',
          habitat: 'forest',
          timeOfDay: 'dawn',
          skill: 0.65 + (seed % 4) * 0.01,
          usesMobileHud: false,
          features,
          rng: seededRandom(seed),
          recordBudget: 8,
        }),
      );
    }
    const completionRate = sessions.filter((s) => s.completed).length / sessions.length;
    const hasIncompleteFriction = sessions.some((s) => s.friction.includes('habitat_incomplete'));
    assert.ok(completionRate < 1.0, `expected some failures, got ${completionRate}`);
    assert.ok(hasIncompleteFriction, 'expected habitat_incomplete friction');
  });
});

describe('100-player aggregate thresholds (FieldSession driver)', () => {
  it('meets plan fun/recommend bars at recruitment skill levels', () => {
    const rand = seededRandom(42);
    const segments = {
      naturalist: { skill: 0.92, persona: 'marcus' },
      educator: { skill: 0.88, persona: 'aisha' },
      gamer: { skill: 0.9, persona: 'liam' },
      general: { skill: 0.82, persona: 'liam' },
    };
    const all = [];
    for (const [seg, cfg] of Object.entries(segments)) {
      for (let i = 0; i < 25; i++) {
        const s = driveFieldSession({
          segment: seg,
          persona: cfg.persona,
          habitat: ['forest', 'marsh', 'canyon'][i % 3],
          timeOfDay: ['dawn', 'day', 'dusk', 'night'][i % 4],
          skill: cfg.skill + (i % 5) * 0.01,
          usesMobileHud: i % 3 === 0,
          features,
          rng: rand,
        });
        all.push(s);
      }
    }
    const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const meanFun = mean(all.map((s) => s.scores.fun));
    const meanRec = mean(all.map((s) => s.scores.wouldRecommend));
    assert.ok(meanFun >= 9.0, `fun ${meanFun}`);
    assert.ok(meanRec >= 4.5, `recommend ${meanRec}`);
    const bySeg = {};
    for (const s of all) {
      bySeg[s.segment] = bySeg[s.segment] || [];
      bySeg[s.segment].push(s);
    }
    for (const [seg, list] of Object.entries(bySeg)) {
      const mf = mean(list.map((s) => s.scores.fun));
      assert.ok(mf >= 8.0, `${seg} fun ${mf}`);
    }
    const general = bySeg.general || [];
    const gCompletion = general.filter((s) => s.completed).length / general.length;
    const gRec = mean(general.map((s) => s.scores.wouldRecommend));
    assert.ok(gCompletion >= 0.98, `general completion ${gCompletion}`);
    assert.ok(gRec >= 4.95, `general recommend ${gRec}`);
  });
});