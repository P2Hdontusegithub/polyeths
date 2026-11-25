/*
 * The Polyeths — CẤU HÌNH GAME
 * ---------------------------------------------------------------
 * Mọi con số "cảm giác chơi" nằm ở đây. Sửa file này rồi tải lại trang
 * là thấy thay đổi ngay — không cần build.
 *
 * Đơn vị: pixel (px), giây (s). 1 ô (tile) = TILE px.
 */
(function (root) {
  'use strict';
  const PE = root.PE || (root.PE = {});

  const CONFIG = {
    TILE: 32,
    VIEW_W: 960,            // kích thước khung hình (canvas)
    VIEW_H: 544,
    FIXED_DT: 1 / 60,       // bước mô phỏng cố định

    GRAVITY: 1900,
    MAX_FALL: 900,
    COYOTE_TIME: 0.09,      // vẫn nhảy được ngay sau khi rời mép
    JUMP_BUFFER: 0.12,      // bấm nhảy hơi sớm trước khi chạm đất vẫn tính
    JUMP_CUT: 0.45,         // thả phím nhảy sớm -> nhảy thấp hơn
    ACCEL_GROUND: 2400,
    ACCEL_AIR: 1500,
    FRICTION: 2600,

    // Hai nhân vật. Chỉnh speed/jump để đổi độ khó.
    CHARACTERS: {
      PET: {
        name: 'PET',
        code: 1,
        w: 24, h: 34,
        speed: 240,
        jump: 760,          // nhảy cao & xa hơn (nhẹ)
        color: '#7fd6ff',
        transparent: true,  // cho ánh sáng đi qua
        impactResistant: false,
      },
      HDPE: {
        name: 'HDPE',
        code: 2,
        w: 28, h: 34,
        speed: 215,
        jump: 640,          // nặng hơn, nhảy thấp hơn
        color: '#f4f1e6',
        transparent: false, // đục: chắn tia sáng
        impactResistant: true,
      },
    },

    // Bể NaOH: HDPE chạy qua được nhưng phải liên tục di chuyển.
    NAOH: {
      maxExposure: 1.6,     // tổng thời gian tối đa trong bể (s)
      stillSpeed: 50,       // chậm hơn mức này coi như "đứng yên"
      maxStill: 0.3,        // đứng yên quá lâu (s) -> thất bại
      recover: 1.0,         // tốc độ hồi thanh phơi nhiễm khi ra khỏi bể (s/s)
    },

    // Máy dập trong Phòng B
    STAMPER: { down: 0.25, waitDown: 0.5, up: 0.5, waitUp: 0.35 },

    // Máy ép phòng cuối
    PRESS: {
      closeSpeed: 42,       // px/s khi hạ xuống
      openSpeed: 160,       // px/s khi nâng lên
    },
    SYNC_TIME: 3.0,         // thời gian cần duy trì đồng thời 2 điều kiện (s)

    RESPAWN_DELAY: 0.9,
    LEASH: 1400,            // khoảng cách ngang tối đa giữa 2 nhân vật (px)
    MIN_ZOOM: 0.58,         // camera thu nhỏ tối đa để thấy cả hai
    MAX_ZOOM: 1.0,

    // Điều khiển bàn phím (KeyboardEvent.code). Có thể đổi tuỳ ý.
    CONTROLS: {
      p1: { left: ['KeyA'], right: ['KeyD'], jump: ['KeyW', 'Space'], down: ['KeyS'] },
      p2: { left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['ArrowUp'], down: ['ArrowDown'] },
    },
  };

  PE.CONFIG = CONFIG;
  if (typeof module !== 'undefined' && module.exports) module.exports = CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);
