// Vẽ thử mọi khu bằng một canvas giả: đảm bảo render không ném lỗi và camera hợp lệ
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { newGame, place, run, col, ROOM_Y, PE } = require('./helpers');
require('../js/render.js');

function mockCtx() {
  const calls = { count: 0 };
  const gradient = { addColorStop() {} };
  const handler = {
    get(target, prop) {
      if (prop === '__calls') return calls;
      if (prop in target) return target[prop];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      return (...args) => {
        calls.count++;
        for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) throw new Error(`${String(prop)} nhận số không hợp lệ`);
      };
    },
    set(target, prop, value) { target[prop] = value; return true; },
  };
  return new Proxy({}, handler);
}

test('render vẽ được mọi khu (và lúc chết / thắng) không lỗi', () => {
  const { Render } = PE;
  const s = newGame();
  const cam = Render.createCamera(s.cfg);
  const ctx = mockCtx();
  const spots = [
    [['PET', col(4)], ['HDPE', col(6)]],
    [['PET', col(33)], ['HDPE', col(51)]],
    [['PET', col(80), ROOM_Y], ['HDPE', col(105), ROOM_Y]],
    [['PET', col(132), 9 * 32], ['HDPE', col(153)]],
    [['PET', col(164)], ['HDPE', col(166)]],
  ];
  for (const spot of spots) {
    for (const [k, x, y] of spot) place(s, k, x, y);
    run(s, 20, {});
    Render.updateCamera(cam, s, 1 / 60);
    Render.draw(ctx, s, cam, s.time);
    assert.ok(Number.isFinite(cam.x) && Number.isFinite(cam.y));
    assert.ok(cam.zoom >= s.cfg.MIN_ZOOM - 1e-9 && cam.zoom <= s.cfg.MAX_ZOOM + 1e-9);
  }
  // nhân vật đang chết
  PE.Engine._internal.kill(s, s.players[0], 'test');
  Render.draw(ctx, s, cam, s.time);
  s.items.A = s.items.B = true; s.gateOpen = true; s.complete = true; s.exitOpen = true; s.bridgeOn = true;
  Render.draw(ctx, s, cam, s.time);
  assert.ok(ctx.__calls.count > 1000);
});

test('camera thu nhỏ khi hai nhân vật ở xa nhau và không vượt biên bản đồ', () => {
  const { Render } = PE;
  const s = newGame();
  const cam = Render.createCamera(s.cfg);
  place(s, 'PET', col(74), ROOM_Y);
  place(s, 'HDPE', col(115), ROOM_Y);
  Render.updateCamera(cam, s, 1);
  assert.ok(cam.zoom < 1, 'đã thu nhỏ');
  place(s, 'PET', col(2));
  place(s, 'HDPE', col(3));
  cam.init = false;
  Render.updateCamera(cam, s, 0);
  assert.equal(cam.zoom, 1);
  assert.equal(cam.x, 0, 'không lộ ra ngoài mép trái');
});
