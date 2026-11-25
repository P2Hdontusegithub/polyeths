// Kiểm tra tính hợp lệ của bản đồ
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { PE, T, FLOOR_Y } = require('./helpers');

const L = PE.buildLevel(T);
const tile = (x, y) => L.grid[Math.floor(y / T)][Math.floor(x / T)];
const rectFree = (r) => {
  for (let y = r.y; y < r.y + r.h; y += 4)
    for (let x = r.x; x < r.x + r.w; x += 4) if (tile(x, y) === '#') return false;
  return true;
};

test('lưới có kích thước đúng và chỉ dùng ký hiệu hợp lệ', () => {
  assert.equal(L.grid.length, L.H);
  for (const row of L.grid) {
    assert.equal(row.length, L.W);
    for (const t of row) assert.ok('.#-NX'.includes(t), `ký hiệu lạ: ${t}`);
  }
});

test('bản đồ được bao kín bởi tường và trần', () => {
  for (let c = 0; c < L.W; c++) assert.equal(L.grid[0][c], '#');
  for (let r = 0; r < L.H; r++) {
    assert.equal(L.grid[r][0], '#');
    assert.equal(L.grid[r][L.W - 1], '#');
  }
});

test('các khu A–E nối liền nhau, phủ hết chiều ngang (một map duy nhất)', () => {
  assert.deepEqual(L.zones.map((z) => z.id), ['A', 'B', 'C', 'D', 'E']);
  assert.equal(L.zones[0].x0, 0);
  for (let i = 1; i < L.zones.length; i++) assert.equal(L.zones[i].x0, L.zones[i - 1].x1);
  assert.equal(L.zones[L.zones.length - 1].x1, L.widthPx);
});

test('điểm xuất phát nằm trên sàn đặc và không bị kẹt', () => {
  for (const kind of ['PET', 'HDPE']) {
    const s = L.spawns[kind];
    assert.equal(tile(s.x, s.y + 1), '#', `${kind} đứng trên sàn`);
    assert.ok(rectFree({ x: s.x - 14, y: s.y - 34, w: 28, h: 34 }), `${kind} không kẹt trong tường`);
  }
});

test('checkpoint tăng dần, nằm trên sàn đặc, có khoảng trống để hồi sinh', () => {
  let prev = -1;
  for (const cp of L.checkpoints) {
    assert.ok(cp.x > prev);
    prev = cp.x;
    for (const off of [-18, 18]) {
      assert.equal(tile(cp.x + off, cp.y + 1), '#', `checkpoint x=${cp.x} có sàn`);
      assert.ok(rectFree({ x: cp.x + off - 14, y: cp.y - 34, w: 28, h: 34 }));
    }
  }
});

test('hành lang hoá chất có cả bể NaOH và bể oxy hoá', () => {
  const row = L.grid[L.FLOOR].join('');
  const zoneB = row.slice(25, 70);
  assert.match(zoneB, /N{5,}/, 'có bể NaOH');
  assert.match(zoneB, /X{3,}/, 'có bể oxy hoá');
  // bể sâu 2 ô
  for (let c = 25; c < 70; c++) if (L.grid[L.FLOOR][c] !== '#') assert.equal(L.grid[L.FLOOR + 1][c], L.grid[L.FLOOR][c]);
});

test('vật phẩm, tấm cảm biến, cửa và khu thoát nằm trong vùng trống', () => {
  for (const it of L.items) assert.ok(rectFree(it), `vật phẩm ${it.id}`);
  assert.ok(rectFree(L.exitZone));
  assert.ok(rectFree(L.gate));
  assert.ok(rectFree(L.exitDoor));
  assert.equal(tile(L.pad.x + 4, L.pad.y + L.pad.h + 1), '#', 'tấm cảm biến đặt trên sàn');
});

test('vật phẩm A ở phòng A (trên cao, bên trái), vật phẩm B ở phòng B (bên phải)', () => {
  const A = L.items.find((i) => i.id === 'A');
  const B = L.items.find((i) => i.id === 'B');
  assert.equal(A.owner, 'PET');
  assert.equal(B.owner, 'HDPE');
  assert.ok(A.x < 93 * T && A.y < 7 * T);
  assert.ok(B.x > 93 * T && B.y < 7 * T);
});

test('hố oxy hoá phòng cuối quá rộng để nhảy (bắt buộc dùng cầu ánh sáng)', () => {
  const c0 = Math.floor(L.bridge.x / T);
  const w = L.bridge.w / T;
  for (let c = c0; c < c0 + w; c++) assert.equal(L.grid[L.FLOOR][c], 'X');
  const cfg = PE.CONFIG;
  for (const k of ['PET', 'HDPE']) {
    const d = cfg.CHARACTERS[k];
    const reach = (2 * d.jump / cfg.GRAVITY) * d.speed;
    assert.ok(reach < L.bridge.w - d.w, `${k} không nhảy qua được hố`);
  }
  assert.ok(FLOOR_Y === L.bridge.y);
});
