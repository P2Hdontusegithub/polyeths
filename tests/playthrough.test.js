// Test tích hợp: chơi hết màn chỉ bằng phím ảo (không dịch chuyển tức thời).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { newGame, P, col, makeBot, runBots, FLOOR_Y, ROOM_Y, T } = require('./helpers');

test('hai bot phối hợp hoàn thành toàn bộ màn chơi không chết lần nào', () => {
  const s = newGame();

  // --- Khu A, B: cả hai băng qua hành lang hoá chất
  let f = runBots(s, [
    makeBot('PET', [{ walk: col(66) }]),
    makeBot('HDPE', [{ walk: col(68) }]),
  ]);
  assert.ok(f >= 0, 'đi hết hành lang hoá chất');
  assert.equal(P(s, 'PET').deaths, 0, 'PET không chết ở hành lang');
  assert.equal(P(s, 'HDPE').deaths, 0, 'HDPE không chết ở hành lang');

  // --- Khu C: PET vào phòng A, HDPE vào phòng B
  f = runBots(s, [
    makeBot('PET', [
      { walk: col(90) }, { climb: 11 * T, x: col(90) }, { climb: 9 * T, x: col(90) }, { climb: ROOM_Y, x: col(90) },
      { walk: col(73) + 6 },
      { walk: col(90) }, { drop: 9 * T }, { drop: 11 * T }, { drop: FLOOR_Y },
    ]),
    makeBot('HDPE', [
      { walk: col(96) }, { climb: 11 * T, x: col(96) }, { climb: 9 * T, x: col(96) }, { climb: ROOM_Y, x: col(96) },
      { walk: col(115) + 6 },
      { walk: col(96) }, { drop: 9 * T }, { drop: 11 * T }, { drop: FLOOR_Y },
    ]),
  ]);
  assert.ok(f >= 0, 'hoàn thành khu C');
  assert.equal(s.items.A, true, 'đã có vật phẩm A');
  assert.equal(s.items.B, true, 'đã có vật phẩm B');
  assert.equal(s.gateOpen, true, 'cửa phòng phối hợp mở');
  assert.equal(P(s, 'PET').deaths, 0);
  assert.equal(P(s, 'HDPE').deaths, 0);

  // --- Khu D: PET lên hốc cảm biến, HDPE chờ cầu rồi chặn máy ép
  const pressX = s.level.press.x + s.level.press.w / 2;
  f = runBots(s, [
    makeBot('PET', [
      { walk: col(125) }, { climb: 11 * T, x: col(125) }, { climb: 9 * T, x: col(132) },
      { walk: s.level.pad.x + s.level.pad.w / 2 },
      { wait: (st) => st.complete },
      { walk: col(122) }, { walk: col(164) },
    ]),
    makeBot('HDPE', [
      { walk: col(138) },
      { wait: (st) => st.bridgeOn },
      { walk: pressX },
      { wait: (st) => st.complete },
      { walk: col(166) },
    ]),
  ], 60 * 120, (st) => st.won);
  assert.ok(f >= 0, 'kết thúc màn');
  assert.equal(s.complete, true, 'phối hợp cuối hoàn tất');
  assert.equal(s.won, true, 'thắng màn chơi');
  assert.equal(P(s, 'PET').deaths, 0);
  assert.equal(P(s, 'HDPE').deaths, 0);
});
