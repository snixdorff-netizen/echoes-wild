/* eslint-disable */
(function (global) {
  const HABITATS = ['forest', 'marsh', 'canyon'];
  const PERSONAS = ['liam', 'aisha', 'marcus', 'elena'];

  function angleDiff(dir, facing) {
    return Math.abs(((dir - facing + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  }

  function scoreAnimalTarget(player, animal, timeOfDay) {
    if (!animal.activity.includes(timeOfDay)) return -999;
    const dx = animal.x - player.x;
    const dy = animal.y - player.y;
    const dist = Math.hypot(dx, dy);
    const dir = Math.atan2(dy, dx);
    const adiff = angleDiff(dir, player.facing);
    const facingScore = player.listenActive ? (1.6 - Math.min(1.2, adiff)) : 0.6;
    return (620 - dist) * 0.9 + facingScore * 180;
  }

  function clipQualityFromScore(bestScore) {
    return Math.max(0.35, Math.min(1, bestScore / 650));
  }

  function selectRecordingTarget(player, animals, timeOfDay) {
    let best = null;
    let bestScore = -999;
    animals.forEach(function (a) {
      const score = scoreAnimalTarget(player, a, timeOfDay);
      if (score > bestScore) {
        bestScore = score;
        best = a;
      }
    });
    if (!best && animals.length) {
      best = animals[Math.floor(Math.random() * animals.length)];
      bestScore = scoreAnimalTarget(player, best, timeOfDay);
    }
    return { best: best, bestScore: bestScore, quality: clipQualityFromScore(bestScore) };
  }

  function qualityLabel(quality) {
    if (quality > 0.8) return 'CLEAN';
    if (quality > 0.55) return 'FAIR';
    return 'NOISY';
  }

  function integrityGain(quality) {
    return Math.round(3 + quality * 6);
  }

  function integrityLoss(quality) {
    return quality > 0.7 ? 8 : 4;
  }

  function applyIdentification(state) {
    const correct = state.chosenId === state.dominantId;
    if (correct) {
      const gain = integrityGain(state.quality);
      return {
        correct: true,
        logged: Math.min(6, state.logged + 1),
        integrity: Math.min(100, state.integrity + gain),
        delta: gain,
      };
    }
    const loss = integrityLoss(state.quality);
    return {
      correct: false,
      logged: state.logged,
      integrity: Math.max(35, state.integrity - loss),
      delta: -loss,
    };
  }

  function shouldCompleteExpedition(logged) {
    return logged >= 6;
  }

  function markHabitatDone(doneList, habitat) {
    const done = doneList.slice();
    if (done.indexOf(habitat) === -1) done.push(habitat);
    return done;
  }

  function personaHint(persona, kind) {
    const hints = {
      liam: { miss: 'Miss — get closer and aim the cone!', learn: 'Tip: the cone is your superpower.' },
      aisha: { miss: 'Not quite — try facing the animal while holding Listen.', learn: 'Teaching moment: directional mics reduce background noise.' },
      marcus: { miss: 'ID miss — improve SNR by closing distance + aiming.', learn: 'Field tip: log clean clips for your BioBlitz report.' },
      elena: { miss: 'Incorrect ID — check spectrogram quality and bearing.', learn: 'Pro note: integrity reflects recording SNR + correct classification.' },
    };
    return (hints[persona] || hints.liam)[kind];
  }

  global.EchoesCore = {
    HABITATS: HABITATS,
    PERSONAS: PERSONAS,
    angleDiff: angleDiff,
    scoreAnimalTarget: scoreAnimalTarget,
    clipQualityFromScore: clipQualityFromScore,
    selectRecordingTarget: selectRecordingTarget,
    qualityLabel: qualityLabel,
    integrityGain: integrityGain,
    integrityLoss: integrityLoss,
    applyIdentification: applyIdentification,
    shouldCompleteExpedition: shouldCompleteExpedition,
    markHabitatDone: markHabitatDone,
    personaHint: personaHint,
  };
})(typeof window !== 'undefined' ? window : globalThis);