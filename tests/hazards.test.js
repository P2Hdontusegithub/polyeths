// Luật bể hoá chất & hồi sinh
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { newGame, P, place, run, col, makeBot, runBots, FLOOR_Y, PE } = require('./helpers');

// NaOH #1: cột 30–34, oxy hoá #1: 41–43, NaOH #2: 49–54, oxy hoá #2: 59–62
function setup(kindA, xA, kindB, xB) {
  const s = newGame();
  place(s, kindA, xA);
  place(s, kindB, xB);
  return s;
}

test('PET đi thẳng vào bể NaOH -> thất bại kèm lý do', () => {
  const s = setup('PET', col(28), 'HDPE', col(26));
  run(s, 60, { p1: { right: true } });
  const p = P(s, 'PET');
  assert.equal(p.deaths, 1);
  assert.match(p.deathReason, /NaOH/);
});

test('PET nhảy qua được cả hai bể NaOH', () => {
  for (const [from, to] of [[27, 37], [46, 57]]) {
    const s = setup('PET', col(from), 'HDPE', col(from - 1));
    runBots(s, [makeBot('PET', [{ walk: col(to) }])], 600);
    assert.equal(P(s, 'PET').deaths, 0, `bể bắt đầu từ cột ${from + 3}`);
    const p = P(s, 'PET');
    assert.ok(Math.abs(p.x + p.w / 2 - col(to)) < 6, 'tới đích');
  }
});

test('HDPE chạy liên tục qua bể NaOH thì an toàn (thanh phơi nhiễm tăng rồi hồi)', () => {
  const s = setup('HDPE', col(46), 'PET', col(45));
  const p = P(s, 'HDPE');
  let maxExp = 0;
  run(s, 120, () => { maxExp = Math.max(maxExp, p.naoh.exposure); return { p2: { right: p.x < col(56) } }; });
  assert.equal(p.deaths, 0);
  assert.ok(p.x > col(55));
  assert.ok(maxExp > 0.5 && maxExp < PE.CONFIG.NAOH.maxExposure, `phơi nhiễm ${maxExp}`);
  run(s, 120, {});
  assert.equal(p.naoh.exposure, 0, 'đã hồi');
});

test('HDPE không nhảy qua được NaOH #2 (6 ô) — rơi xuống mặt bể, phải chạy tiếp', () => {
  const s = setup('HDPE', col(46), 'PET', col(45));
  const p = P(s, 'HDPE');
  let touched = false;
  run(s, 120, (st, i) => {
    if (p.naoh.inside) touched = true;
    const front = p.x + p.w * 0.75;
    return { p2: { right: p.x < col(56), jump: front >= 49 * 32 && i < 70 } };
  });
  assert.ok(touched, 'đã chạm mặt bể');
  assert.equal(p.deaths, 0);
});

test('HDPE dừng lại trong bể NaOH -> thất bại', () => {
  const s = setup('HDPE', col(29), 'PET', col(27));
  const p = P(s, 'HDPE');
  run(s, 600, (st) => ({ p2: { right: p.x < col(32) } }));
  assert.equal(p.deaths >= 1, true);
  assert.match(p.deathReason, /dừng lại/);
});

test('HDPE đi tới đi lui trong bể quá lâu -> thất bại vì giới hạn thời gian', () => {
  const s = setup('HDPE', col(50), 'PET', col(47));
  const p = P(s, 'HDPE');
  p.naoh.exposure = 0;
  let dir = 1;
  run(s, 200, () => {
    if (p.x > col(53)) dir = -1;
    if (p.x < col(50)) dir = 1;
    return { p2: { right: dir > 0, left: dir < 0 } };
  });
  assert.ok(p.deaths >= 1);
  assert.match(p.deathReason, /quá lâu|dừng lại/);
});

test('bể oxy hoá nguy hiểm cho cả hai', () => {
  for (const kind of ['PET', 'HDPE']) {
    const s = setup(kind, col(39), kind === 'PET' ? 'HDPE' : 'PET', col(37));
    const slot = P(s, kind).slot;
    run(s, 60, { [slot]: { right: true } });
    assert.equal(P(s, kind).deaths, 1, kind);
    assert.match(P(s, kind).deathReason, /oxy hoá/);
  }
});

test('cả hai nhảy qua được hai bể oxy hoá', () => {
  for (const kind of ['PET', 'HDPE']) {
    const s = setup(kind, col(38), kind === 'PET' ? 'HDPE' : 'PET', col(37));
    // dùng một điểm nhảy cho mỗi bể (bỏ qua NaOH bằng cách chỉ đi trong đoạn có oxy hoá)
    runBots(s, [makeBot(kind, [{ walk: col(46) }])], 600);
    assert.equal(P(s, kind).deaths, 0, `${kind} qua oxy hoá #1`);
    const s2 = setup(kind, col(57), kind === 'PET' ? 'HDPE' : 'PET', col(56));
    runBots(s2, [makeBot(kind, [{ walk: col(66) }])], 600);
    assert.equal(P(s2, kind).deaths, 0, `${kind} qua oxy hoá #2`);
  }
});

test('hồi sinh tại checkpoint gần nhất đã đi qua sau RESPAWN_DELAY', () => {
  const s = setup('PET', col(36), 'HDPE', col(37));
  const p = P(s, 'PET');
  // đi qua checkpoint cột 38
  run(s, 30, { p1: { right: true } });
  assert.equal(s.level.checkpoints[p.checkpoint].x, 38 * 32);
  // tiếp tục chạy -> rơi vào oxy hoá #1
  let f = 0;
  while (!p.dead && f++ < 120) run(s, 1, { p1: { right: true } });
  assert.equal(p.deaths, 1);
  assert.equal(p.dead, true);
  run(s, Math.ceil(PE.CONFIG.RESPAWN_DELAY * 60) - 5, {});
  assert.equal(p.dead, true, 'chưa hồi sinh ngay');
  run(s, 8, {});
  assert.equal(p.dead, false);
  assert.ok(Math.abs(p.x + p.w / 2 - (38 * 32 - 18)) < 1);
  assert.equal(p.y + p.h, FLOOR_Y);
});
