// Phòng A (tia sáng), Phòng B (máy dập), vật phẩm & cửa phòng phối hợp
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { newGame, P, place, run, col, ROOM_Y, FLOOR_Y, makeBot, botInput, runBots } = require('./helpers');

test('Phòng A: PET đi xuyên tia sáng, tia không bị gián đoạn', () => {
  const s = newGame();
  const p = place(s, 'PET', col(88), ROOM_Y);
  place(s, 'HDPE', col(90), ROOM_Y);
  let passed = false;
  const bot = makeBot('PET', [{ walk: col(74) }]);
  run(s, 60 * 4, (st) => {
    if (st.beams.some((b) => b.petPass > 0)) passed = true;
    return { p1: botInput(st, bot) };
  });
  assert.equal(p.deaths, 0);
  assert.ok(p.x < col(76), 'đã qua cả 3 tia');
  assert.ok(passed, 'có hiệu ứng tia xuyên qua PET');
  assert.ok(s.beams.every((b) => b.hdpeHit === 0));
});

test('Phòng A: HDPE đục bị tia sáng chặn lại, kèm thông báo', () => {
  const s = newGame();
  const p = place(s, 'HDPE', col(88), ROOM_Y);
  place(s, 'PET', col(90), ROOM_Y);
  run(s, 60 * 3, { p2: { left: true } });
  const beam = s.level.beams[0];
  assert.equal(p.x, beam.x + beam.w, 'đứng sát mép phải tia đầu tiên');
  assert.ok(s.messages.some((m) => /chắn tia sáng/.test(m.text)));
});

test('HDPE không nhảy vượt được tia sáng (tia chạy từ trần tới sàn)', () => {
  const s = newGame();
  const p = place(s, 'HDPE', col(88), ROOM_Y);
  place(s, 'PET', col(90), ROOM_Y);
  run(s, 60 * 3, (st, i) => ({ p2: { left: true, jump: i % 30 < 15 } }));
  assert.ok(p.x >= s.level.beams[0].x + s.level.beams[0].w - 0.01);
});

test('Vật phẩm chỉ đúng chủ mới nhặt được', () => {
  const s = newGame();
  const A = s.level.items.find((i) => i.id === 'A');
  // HDPE bị dịch chuyển tới chỗ vật phẩm A -> không nhặt được
  place(s, 'HDPE', A.x + A.w / 2, ROOM_Y);
  place(s, 'PET', col(85), ROOM_Y);
  run(s, 5, {});
  assert.equal(s.items.A, false);
  assert.ok(s.messages.some((m) => /Chỉ PET/.test(m.text)));
  // PET tới thì nhặt được
  place(s, 'HDPE', col(85), ROOM_Y);
  place(s, 'PET', A.x + A.w / 2, ROOM_Y);
  run(s, 2, {});
  assert.equal(s.items.A, true);
});

test('Phòng B: máy dập hạ xuống PET -> PET thất bại', () => {
  const s = newGame();
  const st0 = s.stampers[0];
  const p = place(s, 'PET', st0.x + st0.w / 2, ROOM_Y);
  place(s, 'HDPE', col(96), ROOM_Y);
  run(s, 60 * 3, {});
  assert.ok(p.deaths >= 1);
  assert.match(p.deathReason, /dập/);
});

test('Phòng B: HDPE chặn được máy dập và không bị thương', () => {
  const s = newGame();
  const st0 = s.stampers[0];
  const p = place(s, 'HDPE', st0.x + st0.w / 2, ROOM_Y);
  place(s, 'PET', col(96), ROOM_Y);
  let blocked = false;
  run(s, 60 * 4, (st) => { if (st.stampers[0].blocked) blocked = true; return {}; });
  assert.equal(p.deaths, 0);
  assert.ok(blocked, 'máy dập bị HDPE chặn');
  assert.ok(st0.bottom <= p.y + 0.01, 'máy dập không đè xuyên HDPE');
});

test('Phòng B: HDPE đi xuyên dãy máy dập lấy vật phẩm B; PET đi vào thì bị dập', () => {
  const s = newGame();
  place(s, 'PET', col(90), ROOM_Y);
  place(s, 'HDPE', col(97), ROOM_Y);
  runBots(s, [makeBot('HDPE', [{ walk: col(115) + 6 }])], 60 * 15);
  assert.equal(s.items.B, true);
  assert.equal(P(s, 'HDPE').deaths, 0);

});

test('Phòng B: PET không thể chạy thẳng qua dãy máy dập ở bất kỳ thời điểm xuất phát nào', () => {
  const S = require('./helpers').PE.CONFIG.STAMPER;
  const period = S.down + S.waitDown + S.up + S.waitUp;
  for (let delay = 0; delay < period * 60; delay += 2) {
    const s = newGame();
    place(s, 'HDPE', col(96), ROOM_Y);
    const p = place(s, 'PET', col(99), ROOM_Y);
    run(s, delay, {});
    run(s, 60 * 3, () => ({ p1: { right: !p.dead && p.deaths === 0 } }));
    assert.ok(p.deaths >= 1, `xuất phát sau ${delay} khung hình mà PET vẫn sống`);
  }
});

test('Phòng B: PET đi/dừng ngẫu nhiên (300 lần thử) cũng không qua được dãy máy dập', () => {
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let trial = 0; trial < 300; trial++) {
    const s = newGame();
    place(s, 'HDPE', col(96), ROOM_Y);
    const p = place(s, 'PET', col(99), ROOM_Y);
    let act = { right: true };
    run(s, 60 * 6, (st, i) => {
      if (p.deaths > 0) return {};
      if (i % 6 === 0) {
        const r = rnd();
        act = r < 0.55 ? { right: true } : r < 0.8 ? {} : r < 0.9 ? { left: true } : { right: true, jump: true };
      }
      return { p1: act };
    });
    assert.ok(p.deaths >= 1 || p.x + p.w < s.stampers[4].x + 64, `lần thử ${trial}: PET lọt qua`);
  }
});

test('Cửa phòng phối hợp: đóng khi thiếu vật phẩm, mở khi đủ A và B', () => {
  const s = newGame();
  const p = place(s, 'HDPE', col(116));
  place(s, 'PET', col(114));
  run(s, 60, { p2: { right: true } });
  assert.equal(s.gateOpen, false);
  assert.ok(p.x + p.w <= s.level.gate.x + 0.01, 'bị cửa chặn');
  s.items.A = true;
  run(s, 2, {});
  assert.equal(s.gateOpen, false, 'mới có A thì chưa mở');
  s.items.B = true;
  run(s, 60, { p2: { right: true } });
  assert.equal(s.gateOpen, true);
  assert.ok(p.x > s.level.gate.x + s.level.gate.w, 'đi qua cửa');
});

test('Trong hành lang trung tâm, sàn lưới không chặn người đi bên dưới', () => {
  const s = newGame();
  const p = place(s, 'PET', col(86));
  place(s, 'HDPE', col(85));
  run(s, 60, { p1: { right: true } });
  assert.ok(p.x > col(92));
  assert.equal(p.y + p.h, FLOOR_Y);
});
