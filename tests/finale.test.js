// Cao trào: tấm cảm biến, cầu ánh sáng, máy ép, đồng bộ, cửa thoát, chiến thắng
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { newGame, P, place, run, col, FLOOR_Y, PE } = require('./helpers');

function finale() {
  const s = newGame();
  s.items.A = s.items.B = true;
  s.gateOpen = true;
  const L = s.level;
  return { s, L, padX: L.pad.x + L.pad.w / 2, padY: L.pad.y + L.pad.h, pressX: L.press.x + L.press.w / 2 };
}

test('PET đứng trên tấm cảm biến -> bật cầu ánh sáng; rời đi -> tắt', () => {
  const { s, padX, padY } = finale();
  place(s, 'PET', padX, padY);
  place(s, 'HDPE', col(138));
  run(s, 2, {});
  assert.equal(s.padActive, true);
  assert.equal(s.bridgeOn, true);
  place(s, 'PET', padX - 70, padY);
  run(s, 2, {});
  assert.equal(s.padActive, false);
  assert.equal(s.bridgeOn, false);
});

test('HDPE (đục) đứng trên tấm cảm biến không bật được', () => {
  const { s, padX, padY } = finale();
  place(s, 'HDPE', padX, padY);
  place(s, 'PET', col(126));
  run(s, 3, {});
  assert.equal(s.padActive, false);
  assert.ok(s.messages.some((m) => /che mất ánh sáng/.test(m.text)));
});

test('HDPE bị rèm tia sáng chặn ngoài hốc cảm biến', () => {
  const { s, L } = finale();
  const p = place(s, 'HDPE', col(125), 11 * 32); // đứng trên bậc lên hốc
  place(s, 'PET', col(122));
  const beam = L.beams[3];
  let reached = false;
  run(s, 60 * 4, (st, i) => {
    if (p.y + p.h <= 9 * 32 + 0.5 && p.x + p.w > beam.x + beam.w) reached = true;
    return { p2: { right: true, jump: i % 20 < 12 } };
  });
  assert.equal(reached, false, 'HDPE không vào được trong hốc');
  assert.equal(s.padActive, false);
});

test('Cầu ánh sáng chịu được người đi; tắt cầu khi đang đứng trên -> rơi vào bể', () => {
  const { s, L, padX, padY } = finale();
  place(s, 'PET', padX, padY);
  const h = place(s, 'HDPE', col(139));
  run(s, 2, {});
  run(s, 25, { p2: { right: true } });
  assert.equal(h.deaths, 0);
  assert.equal(h.groundType, 'bridge');
  assert.ok(h.x > L.bridge.x);
  place(s, 'PET', padX - 70, padY);
  run(s, 30, {});
  assert.equal(h.deaths, 1);
  assert.match(h.deathReason, /oxy hoá/);
});

test('Máy ép tự đóng kín lối đi nếu không có HDPE chặn', () => {
  const { s, L, padX, padY } = finale();
  place(s, 'PET', padX, padY);
  place(s, 'HDPE', col(138));
  run(s, 60 * 6, {});
  assert.ok(Math.abs(s.press.bottom - L.press.floor) < 0.5, 'máy ép chạm sàn');
  assert.equal(s.sync, 0);
  // PET rời tấm -> máy ép nâng lên
  place(s, 'PET', padX - 70, padY);
  run(s, 60 * 2, {});
  assert.equal(s.press.bottom, L.press.retract);
});

test('HDPE chặn máy ép + PET giữ tín hiệu đủ SYNC_TIME -> mở cửa thoát', () => {
  const { s, L, padX, padY, pressX } = finale();
  const pet = place(s, 'PET', padX, padY);
  const h = place(s, 'HDPE', pressX);
  assert.equal(s.exitOpen, false);
  run(s, 60 * 5, {});
  assert.equal(s.press.blocked, true, 'máy ép tì lên HDPE');
  assert.ok(Math.abs(s.press.bottom - h.y) < 0.01);
  assert.equal(h.deaths, 0);
  assert.equal(h.bracing, true);
  run(s, Math.ceil(PE.CONFIG.SYNC_TIME * 60) + 5, {});
  assert.equal(s.complete, true);
  assert.equal(s.exitOpen, true);
  // sau khi hoàn tất: cầu cố định, máy ép nâng lên dù PET rời tấm
  place(s, 'PET', padX - 70, padY);
  run(s, 60 * 2, {});
  assert.equal(s.bridgeOn, true);
  assert.equal(s.press.bottom, L.press.retract);
  assert.equal(pet.deaths + h.deaths, 0);
});

test('Đồng bộ tụt dần nếu một trong hai điều kiện bị ngắt', () => {
  const { s, padX, padY, pressX } = finale();
  place(s, 'PET', padX, padY);
  place(s, 'HDPE', pressX);
  run(s, 60 * 5, {});
  const mid = s.sync;
  assert.ok(mid > 0 && mid < PE.CONFIG.SYNC_TIME, `sync=${mid}`);
  place(s, 'PET', padX - 70, padY); // PET rời tấm
  run(s, 30, {});
  assert.ok(s.sync < mid);
  assert.equal(s.complete, false);
});

test('Máy ép đã hạ thấp hơn đầu HDPE thì HDPE bị chặn ngang, phải chờ máy nâng lên', () => {
  const { s, L, padX, padY, pressX } = finale();
  place(s, 'PET', padX, padY);
  const h = place(s, 'HDPE', L.press.x - 40);
  run(s, 60 * 6, {}); // máy ép đóng kín
  run(s, 60, { p2: { right: true } });
  assert.ok(h.x + h.w <= L.press.x + 0.01, 'bị máy ép chặn');
  place(s, 'PET', padX - 70, padY); // tắt tín hiệu -> máy nâng
  run(s, 90, { p2: { right: true } });
  assert.ok(h.x > L.press.x, 'đi vào dưới máy ép được');
  void pressX;
});

test('Máy ép chỉ hạ khi có tín hiệu (PET trên tấm cảm biến)', () => {
  const { s, L, padX, padY } = finale();
  place(s, 'PET', padX - 70, padY);
  place(s, 'HDPE', col(138));
  run(s, 120, {});
  assert.equal(s.press.bottom, L.press.retract);
  place(s, 'PET', padX, padY);
  run(s, 60, {});
  assert.ok(s.press.bottom > L.press.retract + 30);
});

test('Chiến thắng chỉ khi cửa thoát mở và CẢ HAI ở trong khu thoát', () => {
  const { s, L } = finale();
  const zx = L.exitZone.x + 40;
  place(s, 'PET', zx);
  place(s, 'HDPE', zx + 60);
  run(s, 2, {});
  assert.equal(s.won, false, 'cửa chưa mở thì chưa thắng');
  s.complete = true; s.exitOpen = true;
  place(s, 'HDPE', L.exitDoor.x - 60);
  run(s, 2, {});
  assert.equal(s.won, false, 'mới có một người');
  place(s, 'HDPE', zx + 60);
  run(s, 2, {});
  assert.equal(s.won, true);
});

test('Không ai tự mình qua được phòng cuối: hố quá rộng khi cầu tắt', () => {
  for (const kind of ['PET', 'HDPE']) {
    const { s } = finale();
    const p = place(s, kind, col(138));
    place(s, kind === 'PET' ? 'HDPE' : 'PET', col(136));
    run(s, 120, (st, i) => ({ [p.slot]: { right: true, jump: i > 2 && p.x + p.w * 0.75 > 140 * 32 } }));
    assert.ok(p.deaths >= 1, `${kind} rơi xuống hố`);
  }
});

test('FIXED_DT và update ổn định khi gọi với dt mặc định', () => {
  const { s } = finale();
  PE.Engine.update(s, {});
  assert.ok(s.time > 0);
  assert.equal(FLOOR_Y, s.level.bridge.y);
});
