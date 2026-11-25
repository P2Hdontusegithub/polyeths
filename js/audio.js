/*
 * The Polyeths — ÂM THANH (WebAudio, tự tổng hợp — không cần file âm thanh)
 */
(function (root) {
  'use strict';
  const PE = root.PE || (root.PE = {});

  let ctx = null;
  let muted = false;

  function ensure() {
    if (ctx || typeof window === 'undefined') return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
    return ctx;
  }

  function tone(freq, dur, type, vol, slide) {
    if (muted || !ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(vol || 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  const SOUNDS = {
    jump: (e) => tone(e.who === 'PET' ? 520 : 380, 0.12, 'square', 0.05, 1.6),
    death: () => { tone(220, 0.35, 'sawtooth', 0.08, 0.3); },
    respawn: () => tone(660, 0.12, 'triangle', 0.06, 1.3),
    pickup: () => { tone(660, 0.1, 'triangle', 0.08); setTimeout(() => tone(990, 0.15, 'triangle', 0.08), 90); },
    door: () => tone(140, 0.5, 'sawtooth', 0.06, 2),
    clank: () => tone(90, 0.12, 'square', 0.07, 0.6),
    blocked: () => tone(300, 0.08, 'square', 0.04, 0.7),
    pad: () => tone(880, 0.25, 'sine', 0.07, 1.5),
    complete: () => { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'triangle', 0.08), i * 110)); },
    win: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.28, 'triangle', 0.09), i * 140)); },
  };

  PE.Audio = {
    unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); },
    play(events) { for (const e of events) if (SOUNDS[e.type]) SOUNDS[e.type](e); },
    toggleMute() { muted = !muted; return muted; },
    get muted() { return muted; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
