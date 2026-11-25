// Tiện ích dùng chung cho test: tạo game, đặt nhân vật, "bot" điều khiển bằng phím ảo.
'use strict';
require('../js/config.js');
require('../js/level.js');
const Engine = require('../js/engine.js');
const PE = globalThis.PE;

const DT = 1 / 60;
const T = 32;
const FLOOR_Y = 13 * T;
const ROOM_Y = 7 * T;
const col = (c) => c * T + T / 2; // tâm của cột c

function newGame(configPatch) {
  const cfg = JSON.parse(JSON.stringify(PE.CONFIG));
  if (configPatch) configPatch(cfg);
  return Engine.createGame(PE.buildLevel(cfg.TILE), cfg);
}

const P = (s, kind) => s.players.find((p) => p.kind === kind);

// Đặt nhân vật đứng tại (cx, surfaceY)
function place(s, kind, cx, surfaceY = FLOOR_Y) {
  const p = P(s, kind);
  p.x = cx - p.w / 2;
  p.y = surfaceY - p.h;
  p.vx = 0; p.vy = 0;
  p.dead = false;
  p.onGround = true;
  p.groundType = 'solid';
  return p;
}

// Chạy n khung hình với input cố định (hoặc hàm (s, frame) => input)
function run(s, n, inputs) {
  for (let i = 0; i < n; i++) {
    const inp = typeof inputs === 'function' ? inputs(s, i) : inputs;
    Engine.update(s, inp || {}, DT);
    s.events.length = 0;
  }
  return s;
}

// Nguy hiểm với nhân vật kind?
function lethal(kind, t) {
  return t === 'X' || (t === 'N' && kind === 'PET');
}

/*
 * Bot theo kịch bản. Mỗi bước (waypoint):
 *   { walk: x }                 đi tới toạ độ x (tự nhảy qua bể nguy hiểm)
 *   { climb: y, x }             nhảy liên tục (giữ hướng về x) tới khi đứng ở độ cao y
 *   { drop: y }                 bấm xuống để thả qua sàn lưới tới khi đứng ở độ cao y
 *   { wait: (s) => bool }       đứng yên tới khi điều kiện đúng
 *   { idle: frames }            đứng yên số khung hình
 */
function makeBot(kind, script) {
  return { kind, script: script.slice(), i: 0, jumpLatch: false, frames: 0 };
}

function botInput(s, bot) {
  const p = P(s, bot.kind);
  const inp = { left: false, right: false, jump: false, down: false };
  if (p.dead) return inp;
  const wp = bot.script[bot.i];
  if (!wp) return inp;
  bot.frames++;
  const cx = p.x + p.w / 2;
  const feet = p.y + p.h;
  const next = () => { bot.i++; bot.frames = 0; bot.jumpLatch = false; };

  if (wp.walk !== undefined) {
    const d = wp.walk - cx;
    if (Math.abs(d) < 5 && p.onGround) { next(); return inp; }
    if (Math.abs(d) >= 3) { if (d > 0) inp.right = true; else inp.left = true; }
    // tự nhảy qua bể nguy hiểm trước mặt
    const dir = Math.sign(d);
    // nhảy "sát mép": khi 3/4 thân đã ra tới mép bể
    const front = dir > 0 ? p.x + p.w * 0.75 : p.x + p.w * 0.25;
    const c = Math.floor(front / T);
    const r = Math.floor((feet + 2) / T);
    const t = Engine._internal.tileAt(s, c, r);
    const bridge = s.level.bridge;
    const onBridge = s.bridgeOn && front >= bridge.x && front <= bridge.x + bridge.w;
    if (p.onGround && lethal(bot.kind, t) && !onBridge) inp.jump = true;
    // tường thấp trước mặt -> nhảy lên
    const wallX = dir > 0 ? p.x + p.w + 4 : p.x - 4;
    const wall = Engine._internal.tileAt(s, Math.floor(wallX / T), Math.floor((feet - 4) / T));
    if (p.onGround && wall === '#' && Math.abs(d) > p.w) inp.jump = true;
    if (!p.onGround && p.vy < 0) inp.jump = true; // giữ phím để nhảy hết lực
  } else if (wp.climb !== undefined) {
    if (p.onGround && feet <= wp.climb + 1) { next(); return inp; }
    if (wp.x !== undefined) {
      const d = wp.x - cx;
      if (Math.abs(d) > 4) { if (d > 0) inp.right = true; else inp.left = true; }
    }
    if (p.onGround) { inp.jump = !bot.jumpLatch; bot.jumpLatch = !bot.jumpLatch; }
    else inp.jump = p.vy < 0;
  } else if (wp.drop !== undefined) {
    if (p.onGround && Math.abs(feet - wp.drop) < 1) { next(); return inp; }
    inp.down = p.onGround;
  } else if (wp.wait) {
    if (wp.wait(s)) next();
  } else if (wp.idle !== undefined) {
    if (bot.frames >= wp.idle) next();
  }
  return inp;
}

// Chạy nhiều bot cùng lúc tới khi tất cả xong (hoặc hết maxFrames)
function runBots(s, bots, maxFrames = 60 * 120, stopWhen) {
  for (let f = 0; f < maxFrames; f++) {
    const inputs = {};
    for (const b of bots) inputs[P(s, b.kind).slot] = botInput(s, b);
    Engine.update(s, inputs, DT);
    s.events.length = 0;
    if (stopWhen && stopWhen(s)) return f;
    if (bots.every((b) => b.i >= b.script.length)) return f;
  }
  return -1;
}

module.exports = {
  Engine, PE, DT, T, FLOOR_Y, ROOM_Y, col, newGame, P, place, run, makeBot, botInput, runBots,
};
