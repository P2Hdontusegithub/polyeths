/*
 * The Polyeths — BẢN ĐỒ (một map liên tục duy nhất)
 * ---------------------------------------------------------------
 * Bản đồ được dựng bằng code (hàm rect/pool...) thay vì vẽ tay ASCII,
 * nên muốn dời một bể, một phòng, chỉ cần sửa con số cột/hàng.
 *
 * Ký hiệu ô (tile):
 *   '.' trống      '#' tường/sàn đặc     '-' sàn lưới (nhảy xuyên từ dưới lên, ↓ để thả xuống)
 *   'N' bể NaOH    'X' bể chất thải oxy hoá giả lập
 *
 * Toạ độ: c = cột, r = hàng (mỗi ô 32px). Hàng 0 ở trên cùng.
 *
 *  KHU A  |  KHU B (hành lang hoá chất)  |  KHU C (2 phòng + hành lang)  |  KHU D (phối hợp)  |  KHU E
 *  0..24  |  25..69                      |  70..118                      |  119..157          |  158..171
 */
(function (root) {
  'use strict';
  const PE = root.PE || (root.PE = {});

  function buildLevel(T) {
    T = T || 32;
    const W = 172;
    const H = 17;
    const FLOOR = 13; // hàng sàn chính
    const grid = [];
    for (let r = 0; r < H; r++) grid.push(new Array(W).fill('.'));

    const rect = (c, r, w, h, t) => {
      for (let y = r; y < r + h; y++)
        for (let x = c; x < c + w; x++)
          if (y >= 0 && y < H && x >= 0 && x < W) grid[y][x] = t;
    };
    // Bể chất lỏng: hõm sâu 2 ô, bề mặt ngang mặt sàn
    const pool = (c, w, t) => rect(c, FLOOR, w, 2, t);
    // Chuyển ô -> pixel
    const px = (c) => c * T;

    // ---------- Khung nhà máy ----------
    rect(0, 0, W, 1, '#');              // trần
    rect(0, FLOOR, W, H - FLOOR, '#');  // nền
    rect(0, 0, 1, H, '#');              // tường trái
    rect(W - 1, 0, 1, H, '#');          // tường phải

    // ---------- KHU A: cổng vào (một ít bậc để tập nhảy) ----------
    rect(14, 11, 2, 2, '#');
    rect(18, 10, 3, 1, '-');

    // ---------- KHU B: hành lang hoá chất ----------
    pool(30, 5, 'N');                   // NaOH #1 (5 ô): PET nhảy; HDPE nhảy hoặc chạy qua
    pool(41, 3, 'X');                   // oxy hoá #1: cả hai nhảy
    pool(49, 6, 'N');                   // NaOH #2 (6 ô): HDPE không nhảy tới -> phải chạy qua
    pool(59, 4, 'X');                   // oxy hoá #2 (4 ô)

    // ---------- KHU C: trung tâm thử nghiệm ----------
    // Sàn hai phòng (cũng là trần hành lang trung tâm)
    rect(71, 7, 47, 1, '#');
    rect(71, 0, 1, 8, '#');             // tường trái phòng A
    rect(93, 0, 1, 8, '#');             // vách giữa hai phòng
    rect(117, 0, 2, 8, '#');            // tường phải phòng B (+ trên cổng D)
    // Lối lên phòng A (sàn lưới xếp chồng)
    rect(88, 7, 5, 1, '-');
    rect(89, 9, 3, 1, '-');
    rect(89, 11, 3, 1, '-');
    // Lối lên phòng B
    rect(94, 7, 5, 1, '-');
    rect(95, 9, 3, 1, '-');
    rect(95, 11, 3, 1, '-');
    // Vài thùng hàng trong phòng A
    rect(82, 6, 2, 1, '#');

    // ---------- KHU D: phòng phối hợp cuối ----------
    // Hốc cảm biến trên cao (chỉ PET vào được vì có rèm tia sáng)
    rect(128, 9, 7, 1, '#');            // sàn hốc
    rect(127, 4, 9, 1, '#');            // trần hốc
    rect(135, 4, 1, 6, '#');            // vách phải hốc
    rect(124, 11, 3, 1, '-');           // bậc lên hốc
    pool(140, 9, 'X');                  // hố oxy hoá rộng 9 ô — không ai nhảy qua được
    rect(151, 0, W - 151, 7, '#');      // vỏ máy ép + trần khu E

    // ---------- Thực thể ----------
    const floorY = px(FLOOR);
    const roomFloorY = px(7);

    const level = {
      T, W, H, FLOOR,
      grid,
      widthPx: W * T,
      heightPx: H * T,
      spawns: {
        PET: { x: px(3), y: floorY },
        HDPE: { x: px(5), y: floorY },
      },
      zones: [
        { id: 'A', name: 'Khu A — Cổng vào', x0: 0, x1: px(25) },
        { id: 'B', name: 'Khu B — Hành lang hoá chất', x0: px(25), x1: px(70) },
        { id: 'C', name: 'Khu C — Trung tâm thử nghiệm', x0: px(70), x1: px(119) },
        { id: 'D', name: 'Khu D — Phòng phối hợp cuối', x0: px(119), x1: px(158) },
        { id: 'E', name: 'Khu E — Cửa thoát', x0: px(158), x1: W * T },
      ],
      // Điểm hồi sinh (theo từng nhân vật, lấy điểm xa nhất đã đi qua)
      checkpoints: [
        { x: px(4), y: floorY },
        { x: px(27), y: floorY },
        { x: px(38), y: floorY },
        { x: px(46), y: floorY },
        { x: px(57), y: floorY },
        { x: px(67), y: floorY },
        { x: px(121), y: floorY },
      ],
      signs: [
        { x: px(4), text: 'Chào mừng tới nhà máy thử nghiệm vật liệu! P1 = PET (W A S D), P2 = HDPE (← ↑ → ↓). Hai bạn phải phối hợp mới thoát được.' },
        { x: px(12), text: 'Nhảy: W / ↑ (giữ lâu để nhảy cao). Trên sàn lưới, bấm S / ↓ để thả xuống.' },
        { x: px(27), text: 'Bể NaOH (xanh lục): PET phải NHẢY qua. HDPE có thể CHẠY qua — nhưng KHÔNG được dừng và có giới hạn thời gian.' },
        { x: px(39), text: 'Bể chất thải oxy hoá giả lập (tím): nguy hiểm cho CẢ HAI — đều phải nhảy qua.' },
        { x: px(68), text: 'Trung tâm thử nghiệm: leo sàn lưới để vào Phòng A (ánh sáng, bên trái) và Phòng B (va đập, bên phải).' },
        { x: px(88), y: roomFloorY, text: 'Phòng A — Tia sáng: PET trong suốt nên đi qua mà tín hiệu không bị gián đoạn. HDPE đục sẽ chắn tia → bị hệ thống an toàn chặn lại.' },
        { x: px(99), y: roomFloorY, text: 'Phòng B — Máy dập: HDPE chịu va đập nên chặn được máy dập. PET sẽ bị dập — đừng vào!' },
        { x: px(115), text: 'Cửa phòng phối hợp: cần Vật phẩm A (PET lấy ở Phòng A) và Vật phẩm B (HDPE lấy ở Phòng B).' },
        { x: px(122), text: 'Phòng cuối: PET đứng trên tấm cảm biến trong hốc trên cao → bật Cầu ánh sáng, nhưng máy ép sẽ hạ xuống. HDPE qua cầu và chặn máy ép. Giữ cả hai cùng lúc!' },
        { x: px(160), text: 'Cửa thoát — cả hai nhân vật cùng vào để hoàn thành!' },
      ],
      // Rèm tia sáng: đứng từ trần xuống sàn. PET đi xuyên; HDPE bị chặn.
      beams: [
        { x: px(85) + 12, y: px(1), w: 8, h: roomFloorY - px(1) },
        { x: px(80) + 12, y: px(1), w: 8, h: roomFloorY - px(1) },
        { x: px(76) + 12, y: px(1), w: 8, h: roomFloorY - px(1) },
        { x: px(128) + 12, y: px(5), w: 8, h: px(9) - px(5) },
      ],
      // Dãy máy dập phòng B đặt sát nhau (không có chỗ trú giữa các máy), lệch pha
      // để lúc nào cũng có máy đang dập -> PET không thể chạy thẳng qua.
      // (top = trần, retract = đáy khi thu lên, floor = mặt sàn, phase = lệch pha theo giây)
      stampers: [0, 0.64, 1.28, 0.32, 0.96].map((phase, i) => ({
        x: px(101 + i * 2), w: 64, top: px(1), retract: px(1) + 18, floor: roomFloorY, phase,
      })),
      items: [
        {
          id: 'A', owner: 'PET', name: 'Vật phẩm A — Thấu kính quang học',
          x: px(73) + 6, y: roomFloorY - 26, w: 20, h: 20,
          note: 'PET thường trong suốt hơn HDPE, nhưng mức truyền sáng còn phụ thuộc độ dày và cấu tạo.',
        },
        {
          id: 'B', owner: 'HDPE', name: 'Vật phẩm B — Khớp nối chịu lực',
          x: px(115) + 6, y: roomFloorY - 26, w: 20, h: 20,
          note: 'HDPE dai và chịu va đập tốt trong nhiều điều kiện — nhưng không phải chịu được mọi lực.',
        },
      ],
      gate: { x: px(118), y: px(8), w: T, h: px(FLOOR) - px(8), requires: ['A', 'B'] },
      pad: { x: px(131), y: px(9) - 6, w: 64, h: 6 },
      bridge: { x: px(140), y: floorY, w: px(9), h: 10 },
      press: { x: px(152), w: 96, top: px(7), retract: px(7) + 16, floor: floorY },
      exitDoor: { x: px(157), y: px(7), w: T, h: floorY - px(7) },
      exitZone: { x: px(160), y: px(7), w: px(10), h: floorY - px(7) },
    };
    return level;
  }

  PE.buildLevel = buildLevel;
  if (typeof module !== 'undefined' && module.exports) module.exports = buildLevel;
})(typeof window !== 'undefined' ? window : globalThis);
