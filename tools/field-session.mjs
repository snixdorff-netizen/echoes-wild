/**
 * Single source of truth for ECHOES field loop — used by index.html and 100-player sim.
 */
import {
  SPECIES,
  TIME_ORDER,
  initAnimals,
  selectRecordingTarget,
  nearestActiveCaller,
  simulateListenFacing,
  applyIdentification,
  shouldCompleteExpedition,
} from './echoes-core.mjs';

export const RECORD_BUDGET = 8;

export const SEGMENT_SCRIPTS = {
  naturalist: { listenRate: 0.9, idSkill: 0.92, dashChance: 0 },
  educator: { listenRate: 0.86, idSkill: 0.88, dashChance: 0 },
  gamer: { listenRate: 0.72, idSkill: 0.9, dashChance: 0.22 },
  general: { listenRate: 0.76, idSkill: 0.84, dashChance: 0.06 },
};

export class FieldSession {
  constructor({ habitat = 'forest', timeOfDay = 'dawn', speciesList = SPECIES, rng = Math.random } = {}) {
    this.rng = rng;
    this.speciesList = speciesList;
    const baseAnimals = initAnimals(habitat);
    let tod = timeOfDay;
    if (baseAnimals.filter((a) => a.activity.includes(tod)).length < 3) {
      tod = TIME_ORDER.find((t) => baseAnimals.filter((a) => a.activity.includes(t)).length >= 3) || tod;
    }
    this.gameState = { habitat, timeOfDay: tod };
    this.player = { x: 440, y: 310, vx: 0, vy: 0, facing: 0 };
    this.animals = this._initAnimals(habitat);
    this.logged = 0;
    this.integrity = 100;
    this.journal = [];
    this.currentClip = null;
    this.listenActive = false;
    this.listenTicksSession = 0;
    this.recordCount = 0;
    this._isChargingMove = false;
    this._chargeMoveTime = 0;
    this._isDashing = false;
    this._dashEndTime = 0;
    this._wasMouseDown = false;
    this._now = 0;
  }

  _initAnimals(habitat) {
    const base = initAnimals(habitat);
    return base.map((a, i) => {
      const rich = this.speciesList.find((s) => s.id === a.species.id) || a.species;
      return {
        ...a,
        species: { ...a.species, ...rich },
        lastCall: 0,
        bobPhase: i * 1.3,
      };
    });
  }

  tick({ keys = {}, mouse = {}, dt = 1, now = 0 } = {}) {
    this._now = now || this._now + dt * 16;

    let ax = 0;
    let ay = 0;
    if (keys.w || keys.arrowup) ay -= 1;
    if (keys.s || keys.arrowdown) ay += 1;
    if (keys.a || keys.arrowleft) ax -= 1;
    if (keys.d || keys.arrowright) ax += 1;

    if (mouse.down && !this._wasMouseDown && !this._isDashing) {
      this._isChargingMove = true;
      this._chargeMoveTime = 0;
    }

    const spaceHeld = !!keys[' '];
    const moveKeysHeld = ax || ay || keys.w || keys.s || keys.a || keys.d;

    if ((mouse.down || (moveKeysHeld && spaceHeld)) && !this._isDashing) {
      this._isChargingMove = true;
      this._chargeMoveTime += dt * 0.04;
      this.player.vx *= 0.65;
      this.player.vy *= 0.65;
    } else if (this._isChargingMove && !mouse.down && !spaceHeld && (this._wasMouseDown || moveKeysHeld)) {
      if (this._chargeMoveTime > 0.35) {
        this._isDashing = true;
        this._dashEndTime = this._now + 650;
        const dir = this.player.facing || Math.atan2(ay || 0, ax || 1);
        const boost = 6.5 + this._chargeMoveTime * 9;
        this.player.vx = Math.cos(dir) * boost;
        this.player.vy = Math.sin(dir) * boost;
      }
      this._isChargingMove = false;
      this._chargeMoveTime = 0;
    }

    if (ax || ay) {
      const len = Math.hypot(ax, ay) || 1;
      this.player.vx += (ax / len) * 3.1 * 0.32;
      this.player.vy += (ay / len) * 3.1 * 0.32;
      this.player.facing = Math.atan2(this.player.vy, this.player.vx);
    }
    this.player.vx *= 0.79;
    this.player.vy *= 0.79;
    this.player.x += this.player.vx * dt;
    this.player.y += this.player.vy * dt;
    this.player.x = Math.max(55, Math.min(825, this.player.x));
    this.player.y = Math.max(75, Math.min(545, this.player.y));

    if (this._isDashing && this._now > this._dashEndTime) this._isDashing = false;

    if (this._isDashing) {
      const dashX = this.player.x;
      const dashY = this.player.y;
      for (const a of this.animals) {
        const dx = a.x - dashX;
        const dy = a.y - dashY;
        const dist = Math.hypot(dx, dy);
        if (dist < 120 && dist > 5) {
          const push = (120 - dist) / 8;
          a.x += (dx / dist) * push;
          a.y += (dy / dist) * push;
        }
      }
    }

    this._wasMouseDown = !!mouse.down;
    this.listenActive = !!(keys.l || keys[' '] || mouse.listenDown || mouse.down);

    const faced = simulateListenFacing(
      { ...this.player, listenActive: this.listenActive },
      this.animals,
      this.gameState.timeOfDay,
      this.listenActive,
    );
    if (this.listenActive) {
      this.player.facing = faced.facing;
      this.listenTicksSession++;
    } else if (mouse.listenDown && (Math.abs(mouse.x - this.player.x) > 8 || Math.abs(mouse.y - this.player.y) > 8)) {
      this.player.facing = Math.atan2(mouse.y - this.player.y, mouse.x - this.player.x);
    }

    for (const a of this.animals) {
      a.bobPhase = (a.bobPhase || 0) + 0.029;
      a.x += Math.sin(a.bobPhase * 0.65) * 0.38;
      a.y += Math.cos(a.bobPhase * 0.48) * 0.27;
    }

    return this.getState();
  }

  /** Scripted dash for sim (gamer segment). */
  triggerDash() {
    const dir = this.player.facing || 0;
    const boost = 8;
    this.player.vx = Math.cos(dir) * boost;
    this.player.vy = Math.sin(dir) * boost;
    this._isDashing = true;
    this._dashEndTime = this._now + 650;
    this.tick({ keys: {}, mouse: { down: false, listenDown: false, x: this.player.x, y: this.player.y }, dt: 0.5, now: this._now });
  }

  record() {
    const rec = selectRecordingTarget(
      { x: this.player.x, y: this.player.y, facing: this.player.facing, listenActive: this.listenActive },
      this.animals,
      this.gameState.timeOfDay,
    );
    const best = rec.dominant || rec.best;
    this.recordCount++;
    this.currentClip = {
      dominant: best.species,
      dominantAnimal: best,
      quality: rec.quality,
      timeOfDay: this.gameState.timeOfDay,
      habitat: this.gameState.habitat,
      ts: Date.now(),
    };
    return { ...this.currentClip };
  }

  identify(chosenId) {
    if (!this.currentClip) return null;
    const clip = this.currentClip;
    const outcome = applyIdentification({
      chosenId,
      dominantId: clip.dominant.id,
      quality: clip.quality,
      logged: this.logged,
      integrity: this.integrity,
    });
    this.logged = outcome.logged;
    this.integrity = outcome.integrity;
    this.journal.unshift({
      species: clip.dominant,
      time: clip.timeOfDay,
      quality: clip.quality,
      correct: outcome.correct,
      guess: outcome.correct ? null : chosenId,
    });
    this.currentClip = null;
    return outcome;
  }

  switchHabitat(habitat) {
    this.gameState.habitat = habitat;
    this.logged = 0;
    this.integrity = 100;
    this.journal = [];
    this.currentClip = null;
    this.recordCount = 0;
    this.listenTicksSession = 0;
    this.animals = this._initAnimals(habitat);
    this.player = { x: 440, y: 310, vx: 0, vy: 0, facing: 0 };
  }

  advanceTime() {
    const idx = TIME_ORDER.indexOf(this.gameState.timeOfDay);
    this.gameState.timeOfDay = TIME_ORDER[(idx + 1) % TIME_ORDER.length];
  }

  getState() {
    return {
      player: { ...this.player },
      animals: this.animals,
      gameState: { ...this.gameState },
      logged: this.logged,
      integrity: this.integrity,
      journal: [...this.journal],
      currentClip: this.currentClip ? { ...this.currentClip } : null,
      listenActive: this.listenActive,
      completed: shouldCompleteExpedition(this.logged),
      recordCount: this.recordCount,
      listenTicksSession: this.listenTicksSession,
      isDashing: this._isDashing,
      isChargingMove: this._isChargingMove,
      chargeMoveTime: this._chargeMoveTime,
    };
  }
}

export function buildSimKeys(player, animals, timeOfDay, script, skill, rng, usesMobileHud) {
  const nearest = nearestActiveCaller(player, animals, timeOfDay);
  const keys = {};
  if (nearest.animal) {
    const dx = nearest.animal.x - player.x;
    const dy = nearest.animal.y - player.y;
    if (Math.abs(dx) > 18) keys[dx > 0 ? 'd' : 'a'] = true;
    if (Math.abs(dy) > 18) keys[dy > 0 ? 's' : 'w'] = true;
  }
  const listenP = script.listenRate * skill + (usesMobileHud ? 0.12 : 0);
  if (rng() < listenP) keys.l = true;
  return keys;
}

export function pickSimIdentification({
  dominantId,
  animals,
  idSkill,
  quality,
  skill = 0.8,
  features = {},
  rng = Math.random,
}) {
  let pCorrect = Math.min(0.94, idSkill * (0.38 + quality * 0.55));
  if (quality >= 0.58 && features.nearestCallerHint && skill >= 0.72) pCorrect += 0.1;
  if (quality >= 0.55 && features.personaHints && skill >= 0.75) pCorrect += 0.08;
  if (quality >= 0.62 && features.integrityToasts) pCorrect += 0.06;
  pCorrect = Math.min(0.96, pCorrect);
  if (rng() < pCorrect) return dominantId;
  const alts = animals.filter((a) => a.species.id !== dominantId);
  if (!alts.length) return dominantId;
  return alts[Math.floor(rng() * alts.length)].species.id;
}

