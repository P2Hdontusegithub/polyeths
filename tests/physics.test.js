// Vật lý cơ bản: trọng lực, va chạm, nhảy, sàn lưới, dây nối
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { newGame, P, place, run, col, T, FLOOR_Y, PE } = require('./helpers');

test('nhân vật rơi xuống và đứng yên trên sàn', () => {
  const s = newGame();
  const p = P(s, 'PET');
  p.y -= 100;
  run(s, 90);
  assert.equal(p.y + p.h, FLOOR_Y);
  assert.equal(p.onGround, true);
  assert.equal(p.vy, 0);
});

test('đi sang phải/trái theo phím, tốc độ tối đa đúng cấu hình', () => {
  const s = newGame();
  const p = place(s, 'PET', col(6));
  place(s, 'HDPE', col(3));
  run(s, 30, { p1: { right: true } });
  assert.ok(p.x > col(6));
  assert.ok(Math.abs(p.vx - PE.CONFIG.CHARACTERS.PET.speed) < 1);
  run(s, 40, { p1: { left: true } });
  assert.ok(p.vx < 0);
  run(s, 60, {});
  assert.equal(p.vx, 0, 'ma sát làm dừng lại');
});

test('tường chặn nhân vật', () => {
  const s = newGame();
  const p = place(s, 'HDPE', col(3));
  run(s, 120, { p2: { left: true } });
  assert.equal(p.x, T, 'dừng sát tường trái');
});

test('PET nhảy cao hơn HDPE; giữ phím nhảy cao hơn nhảy ngắn', () => {
  const apex = (kind, hold) => {
    const s = newGame();
    const p = place(s, kind, col(6));
    place(s, kind === 'PET' ? 'HDPE' : 'PET', col(3));
    const slot = p.slot;
    let min = p.y;
    run(s, 60, (st, i) => {
      min = Math.min(min, p.y);
      return { [slot]: { jump: hold ? true : i < 3 } };
    });
    return FLOOR_Y - p.h - min;
  };
  const petFull = apex('PET', true), hdpeFull = apex('HDPE', true), petShort = apex('PET', false);
  assert.ok(petFull > hdpeFull, `PET ${petFull} > HDPE ${hdpeFull}`);
  assert.ok(petShort < petFull * 0.7, `nhảy ngắn ${petShort} < ${petFull}`);
  assert.ok(hdpeFull > 64, 'HDPE vẫn nhảy lên được bậc 2 ô');
});

test('không nhảy được giữa không trung (không double-jump), nhưng có coyote time', () => {
  const s = newGame();
  const p = place(s, 'PET', col(6));
  place(s, 'HDPE', col(3));
  run(s, 1, { p1: { jump: true } });
  run(s, 10, { p1: { jump: true } });
  const vyBefore = p.vy;
  run(s, 1, { p1: {} });
  run(s, 1, { p1: { jump: true } }); // bấm lại giữa không trung
  assert.ok(p.vy > vyBefore, 'không được tăng tốc lên lần nữa');
});

test('jump buffer: bấm nhảy ngay trước khi chạm đất vẫn nhảy', () => {
  const s = newGame();
  const p = place(s, 'PET', col(6));
  place(s, 'HDPE', col(3));
  p.y -= 12; p.onGround = false; p.vy = 300;
  run(s, 1, { p1: { jump: true } });
  run(s, 6, { p1: { jump: true } });
  assert.ok(p.vy < 0, 'đã bật nhảy khi chạm đất');
});

test('sàn lưới: nhảy xuyên từ dưới lên, đứng được, bấm xuống để thả', () => {
  const s = newGame();
  const p = place(s, 'HDPE', col(19)); // dưới sàn lưới hàng 10 (cột 18–20)
  place(s, 'PET', col(16), 11 * T);
  run(s, 1, { p2: { jump: true } });
  run(s, 50, { p2: { jump: true } });
  assert.equal(p.y + p.h, 10 * T, 'đứng trên sàn lưới');
  assert.equal(p.groundType, 'oneway');
  run(s, 40, { p2: { down: true } });
  assert.equal(p.y + p.h, FLOOR_Y, 'đã thả xuống sàn');
});

test('dây nối: hai nhân vật không tách nhau quá LEASH', () => {
  const s = newGame((cfg) => { cfg.LEASH = 300; });
  const a = place(s, 'PET', col(3));
  const b = place(s, 'HDPE', col(2));
  run(s, 60 * 4, { p1: { right: true } });
  const dist = () => Math.abs(a.x + a.w / 2 - (b.x + b.w / 2));
  assert.ok(Math.abs(dist() - 300) < 1, `bị giữ ở đúng LEASH, khoảng cách ${dist()}`);
  assert.ok(s.messages.some((m) => /quá xa/.test(m.text)), 'có thông báo');
  // đi lại gần thì vẫn được
  run(s, 30, { p1: { left: true } });
  assert.ok(dist() < 300);
});
