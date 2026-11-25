/*
 * The Polyeths — KHỞI ĐỘNG TRÌNH DUYỆT: bàn phím, vòng lặp, HUD, menu
 */
(function () {
  'use strict';
  const PE = window.PE;
  const CFG = PE.CONFIG;
  const { Engine, Render, Audio } = PE;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const ui = {
    hud: $('hud'), zone: $('hud-zone'), time: $('hud-time'), d1: $('hud-d1'), d2: $('hud-d2'),
    objectives: $('hud-objectives'), messages: $('hud-messages'), sign: $('hud-sign'),
    menu: $('menu'), win: $('win'), winStats: $('win-stats'),
    btnStart: $('btn-start'), btnResume: $('btn-resume'), btnRestart: $('btn-restart'), btnAgain: $('btn-again'),
  };

  // ---------------------------------------------------------------- input
  const down = new Set();
  const ALL_GAME_KEYS = new Set();
  for (const slot of ['p1', 'p2'])
    for (const k of Object.keys(CFG.CONTROLS[slot])) CFG.CONTROLS[slot][k].forEach((c) => ALL_GAME_KEYS.add(c));

  function readInput(slot) {
    const map = CFG.CONTROLS[slot];
    const any = (codes) => codes.some((c) => down.has(c));
    return { left: any(map.left), right: any(map.right), jump: any(map.jump), down: any(map.down) };
  }

  // ---------------------------------------------------------------- game state
  let state = null;
  let camera = null;
  let mode = 'menu'; // 'menu' | 'playing' | 'paused' | 'won'
  let lastMsgKey = '';
  let lastObjKey = '';
  let lastSign = null;

  function newGame() {
    state = Engine.createGame(PE.buildLevel(CFG.TILE), CFG);
    camera = Render.createCamera(CFG);
    lastMsgKey = lastObjKey = '';
    lastSign = null;
    window.__polyeths.state = state;
  }

  function setMode(m) {
    mode = m;
    ui.menu.classList.toggle('hidden', !(m === 'menu' || m === 'paused'));
    ui.win.classList.toggle('hidden', m !== 'won');
    ui.hud.classList.toggle('hidden', m === 'menu');
    ui.btnStart.classList.toggle('hidden', m !== 'menu');
    ui.btnResume.classList.toggle('hidden', m !== 'paused');
    ui.btnRestart.classList.toggle('hidden', m !== 'paused');
    down.clear();
  }

  function start() { Audio.unlock(); newGame(); setMode('playing'); }
  function togglePause() {
    if (mode === 'playing') setMode('paused');
    else if (mode === 'paused') setMode('playing');
  }

  // ---------------------------------------------------------------- keyboard
  window.addEventListener('keydown', (e) => {
    if (ALL_GAME_KEYS.has(e.code)) e.preventDefault();
    Audio.unlock();
    if (e.repeat) { if (mode === 'playing') down.add(e.code); return; }
    switch (e.code) {
      case 'Enter':
      case 'NumpadEnter':
        if (mode === 'menu' || mode === 'won') start();
        else if (mode === 'paused') togglePause();
        return;
      case 'KeyP':
      case 'Escape':
        togglePause(); return;
      case 'KeyH':
        if (mode === 'playing' || mode === 'paused') togglePause();
        return;
      case 'KeyR':
        if (mode === 'playing' || mode === 'paused' || mode === 'won') start();
        return;
      case 'KeyM':
        Audio.toggleMute(); return;
    }
    if (mode === 'playing') down.add(e.code);
  });
  window.addEventListener('keyup', (e) => { down.delete(e.code); });
  window.addEventListener('blur', () => down.clear());

  ui.btnStart.addEventListener('click', start);
  ui.btnAgain.addEventListener('click', start);
  ui.btnRestart.addEventListener('click', start);
  ui.btnResume.addEventListener('click', togglePause);

  // ---------------------------------------------------------------- HUD
  const fmtTime = (t) => {
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  function updateHUD() {
    const [pet, hdpe] = state.players;
    const mid = (pet.x + hdpe.x) / 2;
    ui.zone.textContent = Engine.currentZone(state, mid).name;
    ui.time.textContent = '⏱ ' + fmtTime(state.won ? state.wonTime : state.time);
    ui.d1.textContent = pet.deaths;
    ui.d2.textContent = hdpe.deaths;

    const objs = Engine.objectives(state);
    const objKey = objs.map((o) => +o.done).join('');
    if (objKey !== lastObjKey) {
      lastObjKey = objKey;
      ui.objectives.innerHTML = objs.map((o) => `<li class="${o.done ? 'done' : ''}">${esc(o.text)}</li>`).join('');
    }
    const msgKey = state.messages.map((m) => m.time + m.text).join('|');
    if (msgKey !== lastMsgKey) {
      lastMsgKey = msgKey;
      ui.messages.innerHTML = state.messages.slice(-4)
        .map((m) => `<div style="color:${m.color}">${esc(m.text)}</div>`).join('');
    }
    const sign = Engine.activeSign(state);
    if (sign !== lastSign) {
      lastSign = sign;
      ui.sign.classList.toggle('hidden', !sign);
      if (sign) ui.sign.textContent = sign.text;
    }
  }

  function showWin() {
    const [pet, hdpe] = state.players;
    ui.winStats.innerHTML =
      `Thời gian: <b>${fmtTime(state.wonTime)}</b><br>` +
      `PET hỏng: <b>${pet.deaths}</b> lần · HDPE hỏng: <b>${hdpe.deaths}</b> lần`;
    setMode('won');
  }

  // ---------------------------------------------------------------- loop
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (mode === 'playing') {
      acc += dt;
      let steps = 0;
      while (acc >= CFG.FIXED_DT && steps < 6) {
        Engine.update(state, { p1: readInput('p1'), p2: readInput('p2') }, CFG.FIXED_DT);
        acc -= CFG.FIXED_DT;
        steps++;
      }
      if (steps === 6) acc = 0;
      Audio.play(state.events);
      state.events.length = 0;
      if (state.won) showWin();
    } else {
      acc = 0;
    }
    if (state) {
      Render.updateCamera(camera, state, dt);
      Render.draw(ctx, state, camera, now / 1000);
      if (mode !== 'menu') updateHUD();
    }
    requestAnimationFrame(frame);
  }

  // Cho phép kiểm tra / gỡ lỗi từ console: window.__polyeths.state
  window.__polyeths = {
    Engine, Render, CFG, start, setMode, keys: down,
    get mode() { return mode; },
    get camera() { return camera; },
    // Gỡ lỗi: chạy n bước mô phỏng ngay lập tức rồi vẽ lại (camera bám tức thì)
    step(n, inputs) {
      for (let i = 0; i < (n || 1); i++) Engine.update(state, inputs || {}, CFG.FIXED_DT);
      state.events.length = 0;
      camera.init = false;
      Render.updateCamera(camera, state, 0);
      Render.draw(ctx, state, camera, performance.now() / 1000);
      updateHUD();
    },
  };
  newGame();             // vẽ sẵn màn chơi phía sau menu
  setMode('menu');
  requestAnimationFrame(frame);
})();
