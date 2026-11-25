/*
 * The Polyeths — ENGINE (logic thuần, không đụng tới DOM)
 * ---------------------------------------------------------------
 * createGame(level, config)        -> state
 * update(state, inputs, dt)        -> tiến 1 bước mô phỏng
 *   inputs = { p1: {left,right,jump,down}, p2: {...} }   (boolean)
 *
 * Vì không phụ thuộc trình duyệt, file này được test trực tiếp bằng Node.
 */
(function (root) {
  'use strict';
  const PE = root.PE || (root.PE = {});

  // ------------------------------------------------------------------ utils
  const overlaps = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const overlapX = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const approach = (v, target, step) =>
    v < target ? Math.min(v + step, target) : Math.max(v - step, target);
  const centerX = (p) => p.x + p.w / 2;

  // ------------------------------------------------------------------ create
  function createPlayer(kind, slot, level, cfg) {
    const def = cfg.CHARACTERS[kind];
    const spawn = level.spawns[kind];
    const p = {
      kind, slot, def,
      w: def.w, h: def.h,
      x: spawn.x, y: spawn.y - def.h,
      vx: 0, vy: 0,
      facing: 1,
      onGround: false,
      groundType: null,     // 'solid' | 'oneway' | 'naoh' | 'bridge' | 'entity'
      coyote: 0,
      jumpBuffer: 0,
      jumpHeld: false,
      dropTimer: 0,
      dead: false,
      respawnTimer: 0,
      deathReason: '',
      checkpoint: -1,
      respawn: { x: spawn.x, y: spawn.y },
      naoh: { exposure: 0, still: 0, inside: false },
      beamBlocked: 0,       // hiệu ứng khi HDPE đụng tia sáng
      deaths: 0,
      bracing: false,       // HDPE đang chặn máy dập / máy ép
    };
    return p;
  }

  function createGame(level, cfg) {
    cfg = cfg || PE.CONFIG;
    level = level || PE.buildLevel(cfg.TILE);
    const state = {
      cfg, level,
      time: 0,
      players: [createPlayer('PET', 'p1', level, cfg), createPlayer('HDPE', 'p2', level, cfg)],
      items: {},
      gateOpen: false,
      stampers: level.stampers.map((s) => ({ ...s, bottom: s.retract, blocked: false })),
      beams: level.beams.map((b) => ({ ...b, hdpeHit: 0, petPass: 0 })),
      press: { ...level.press, bottom: level.press.retract, blocked: false },
      padActive: false,
      bridgeOn: false,
      sync: 0,
      complete: false,
      exitOpen: false,
      won: false,
      wonTime: 0,
      messages: [],
      events: [],
      _msgThrottle: {},
    };
    for (const it of level.items) state.items[it.id] = false;
    return state;
  }

  // ------------------------------------------------------------------ messages / events
  function say(state, text, opts) {
    opts = opts || {};
    const key = opts.key || text;
    const last = state._msgThrottle[key];
    if (opts.throttle && last !== undefined && state.time - last < opts.throttle) return;
    state._msgThrottle[key] = state.time;
    state.messages.push({ text, color: opts.color || '#fff', time: state.time, ttl: opts.ttl || 4 });
    if (state.messages.length > 6) state.messages.shift();
  }
  const emit = (state, type, data) => state.events.push(Object.assign({ type }, data));

  // ------------------------------------------------------------------ tiles
  function tileAt(state, c, r) {
    const L = state.level;
    if (c < 0 || c >= L.W) return '#';
    if (r < 0) return '#';
    if (r >= L.H) return '.';
    return L.grid[r][c];
  }

  // Ô nào là "đặc" đối với nhân vật p
  function tileSolidFor(p, t) {
    if (t === '#') return true;
    if (t === 'N') return p.kind === 'HDPE'; // HDPE chạy trên mặt bể NaOH (có giới hạn)
    return false;
  }

  // Các khối động (cửa, máy, cầu, tia sáng...) đặc đối với p
  function dynamicSolids(state, p) {
    const out = [];
    const L = state.level;
    if (!state.gateOpen) out.push(L.gate);
    if (!state.exitOpen) out.push(L.exitDoor);
    if (state.bridgeOn) out.push(L.bridge);
    for (const s of state.stampers) out.push({ x: s.x, y: s.top, w: s.w, h: s.bottom - s.top, stamper: s });
    const pr = state.press;
    out.push({ x: pr.x, y: pr.top, w: pr.w, h: pr.bottom - pr.top, press: pr });
    if (!p.def.transparent) for (const b of state.beams) out.push({ x: b.x, y: b.y, w: b.w, h: b.h, beam: b });
    return out;
  }

  // Liệt kê ô đè lên hình chữ nhật
  function forTiles(state, rect, fn) {
    const T = state.level.T;
    const c0 = Math.floor(rect.x / T), c1 = Math.floor((rect.x + rect.w - 0.001) / T);
    const r0 = Math.floor(rect.y / T), r1 = Math.floor((rect.y + rect.h - 0.001) / T);
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) fn(tileAt(state, c, r), c, r);
  }

  // ------------------------------------------------------------------ movement
  function moveX(state, p, dx) {
    if (dx === 0) return;
    const T = state.level.T;
    // Dây nối: hai nhân vật không được cách nhau quá LEASH
    const other = state.players.find((o) => o !== p);
    if (other && !other.dead) {
      const before = Math.abs(centerX(p) - centerX(other));
      const after = Math.abs(centerX(p) + dx - centerX(other));
      if (after > state.cfg.LEASH && after > before) {
        const allowed = Math.max(0, state.cfg.LEASH - before);
        dx = Math.sign(dx) * Math.min(Math.abs(dx), allowed);
        if (dx === 0) {
          p.vx = 0;
          say(state, 'Hai nhân vật không thể tách nhau quá xa!', { throttle: 3, key: 'leash', color: '#ffd166' });
          return;
        }
      }
    }
    p.x += dx;
    // tiles
    forTiles(state, p, (t, c) => {
      if (!tileSolidFor(p, t)) return;
      if (dx > 0) p.x = Math.min(p.x, c * T - p.w);
      else p.x = Math.max(p.x, (c + 1) * T);
      p.vx = 0;
    });
    // dynamic
    for (const s of dynamicSolids(state, p)) {
      if (s.h <= 0 || !overlaps(p, s)) continue;
      if (s === state.level.bridge) continue; // cầu mỏng: chỉ va chạm theo phương đứng
      if (dx > 0) p.x = s.x - p.w;
      else p.x = s.x + s.w;
      p.vx = 0;
      if (s.beam) {
        s.beam.hdpeHit = 0.4;
        p.beamBlocked = 0.4;
        say(state, 'HDPE đục — chắn tia sáng! Hệ thống an toàn chặn lại. Hãy để PET đi.', {
          throttle: 4, key: 'beam', color: '#ffd166',
        });
        emit(state, 'blocked');
      }
    }
  }

  function moveY(state, p, dy) {
    const T = state.level.T;
    const prevTop = p.y, prevBottom = p.y + p.h;
    p.y += dy;
    let landed = null;
    forTiles(state, p, (t, c, r) => {
      const top = r * T, bottom = top + T;
      if (tileSolidFor(p, t)) {
        if (dy > 0 && prevBottom <= top + 0.01) {
          p.y = top - p.h; p.vy = 0; landed = t === 'N' ? 'naoh' : 'solid';
        } else if (dy < 0 && prevTop >= bottom - 0.01) {
          p.y = bottom; p.vy = 0;
        }
      } else if (t === '-' && dy > 0 && p.dropTimer <= 0 && prevBottom <= top + 0.01) {
        p.y = top - p.h; p.vy = 0; landed = landed || 'oneway';
      }
    });
    for (const s of dynamicSolids(state, p)) {
      if (s.h <= 0 || !overlaps(p, s)) continue;
      if (dy > 0 && prevBottom <= s.y + 0.01) {
        p.y = s.y - p.h; p.vy = 0;
        landed = s === state.level.bridge ? 'bridge' : 'entity';
      } else if (dy < 0 && prevTop >= s.y + s.h - 0.01) {
        p.y = s.y + s.h; p.vy = 0;
      }
    }
    return landed;
  }

  // ------------------------------------------------------------------ death / respawn
  function kill(state, p, reason) {
    if (p.dead || state.won) return;
    p.dead = true;
    p.deaths++;
    p.deathReason = reason;
    p.respawnTimer = state.cfg.RESPAWN_DELAY;
    p.vx = 0; p.vy = 0;
    say(state, `${p.kind}: ${reason}`, { color: '#ff6b6b', ttl: 5 });
    emit(state, 'death', { who: p.kind });
  }

  function respawn(state, p) {
    const off = p.kind === 'PET' ? -18 : 18;
    p.dead = false;
    p.x = p.respawn.x + off - p.w / 2;
    p.y = p.respawn.y - p.h;
    p.vx = 0; p.vy = 0;
    p.naoh.exposure = 0; p.naoh.still = 0; p.naoh.inside = false;
    p.onGround = false;
    emit(state, 'respawn', { who: p.kind });
  }

  // ------------------------------------------------------------------ machines
  // Khối đi xuống từ trần (máy dập / máy ép). HDPE chặn được; PET bị dập.
  function lowerCrusher(state, m, targetBottom, maxStep, label) {
    const prevBottom = m.bottom;
    let nb = approach(m.bottom, targetBottom, maxStep);
    m.blocked = false;
    m.blocker = null;
    if (nb > prevBottom) {
      const zone = { x: m.x, y: m.top, w: m.w, h: 0 };
      // HDPE trước: kẹt máy lại
      for (const p of state.players) {
        if (p.dead || !p.def.impactResistant) continue;
        if (overlapX(p, zone) <= 0) continue;
        if (p.y < prevBottom - 2) continue; // không nằm bên dưới
        if (nb > p.y) { nb = Math.max(prevBottom, p.y); m.blocked = true; m.blocker = p; }
      }
      for (const p of state.players) {
        if (p.dead || p.def.impactResistant) continue;
        const ox = overlapX(p, zone);
        if (ox <= 0) continue;
        if (p.y < prevBottom - 2) continue;
        if (nb > p.y) {
          if (ox <= 8) {
            // chỉ sượt mép: đẩy PET ra ngoài
            if (centerX(p) < m.x + m.w / 2) p.x = m.x - p.w; else p.x = m.x + m.w;
          } else {
            kill(state, p, `bị ${label} dập! PET không chịu va đập tốt bằng HDPE.`);
          }
        }
      }
    }
    m.bottom = nb;
  }

  function updateStampers(state, dt) {
    const S = state.cfg.STAMPER;
    const period = S.down + S.waitDown + S.up + S.waitUp;
    for (const s of state.stampers) {
      const travel = s.floor - s.retract;
      const t = (((state.time + s.phase) % period) + period) % period;
      let target, speed;
      if (t < S.waitUp) { target = s.retract; speed = travel / S.up; }
      else if (t < S.waitUp + S.down) { target = s.floor; speed = travel / S.down; }
      else if (t < S.waitUp + S.down + S.waitDown) { target = s.floor; speed = travel / S.down; }
      else { target = s.retract; speed = travel / S.up; }
      const wasBlocked = s.blocked;
      lowerCrusher(state, s, target, speed * dt, 'máy dập');
      if (s.blocked && !wasBlocked) emit(state, 'clank');
    }
  }

  function updatePress(state, dt) {
    const pr = state.press;
    const C = state.cfg.PRESS;
    const closing = state.padActive && !state.complete;
    const target = closing ? pr.floor : pr.retract;
    const step = (closing ? C.closeSpeed : C.openSpeed) * dt;
    const wasBlocked = pr.blocked;
    lowerCrusher(state, pr, target, step, 'máy ép');
    if (pr.blocked && !wasBlocked) {
      emit(state, 'clank');
      say(state, 'HDPE đang chặn máy ép!', { throttle: 3, key: 'pressheld', color: '#9be564' });
    }
    if (closing && pr.bottom >= pr.floor - 0.5 && !pr.closedMsg) {
      pr.closedMsg = true;
      say(state, 'Máy ép đã đóng lối đi! PET rời tấm cảm biến để máy nâng lên rồi thử lại.', { color: '#ffd166', ttl: 5 });
    }
    if (!closing) pr.closedMsg = false;
  }

  // ------------------------------------------------------------------ per-player update
  function updatePlayer(state, p, input, dt) {
    const cfg = state.cfg;
    const L = state.level;
    input = input || {};

    if (p.dead) {
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0) respawn(state, p);
      return;
    }

    // --- di chuyển ngang
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) p.facing = dir;
    const accel = p.onGround ? cfg.ACCEL_GROUND : cfg.ACCEL_AIR;
    if (dir !== 0) p.vx = approach(p.vx, dir * p.def.speed, accel * dt);
    else p.vx = approach(p.vx, 0, (p.onGround ? cfg.FRICTION : cfg.ACCEL_AIR * 0.5) * dt);

    // --- nhảy (coyote + buffer + nhảy ngắn khi thả phím)
    const jumpPressed = !!input.jump && !p.jumpHeld;
    p.jumpHeld = !!input.jump;
    if (jumpPressed) p.jumpBuffer = cfg.JUMP_BUFFER; else p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
    p.coyote = p.onGround ? cfg.COYOTE_TIME : Math.max(0, p.coyote - dt);
    if (p.jumpBuffer > 0 && p.coyote > 0) {
      p.vy = -p.def.jump;
      p.jumpBuffer = 0; p.coyote = 0;
      p.onGround = false;
      emit(state, 'jump', { who: p.kind });
    }
    if (!input.jump && p.vy < 0) p.vy *= Math.pow(cfg.JUMP_CUT, dt * 60 / 4);

    // --- thả xuống sàn lưới
    p.dropTimer = Math.max(0, p.dropTimer - dt);
    if (input.down && p.onGround && p.groundType === 'oneway') {
      p.dropTimer = 0.2;
      p.onGround = false;
    }

    // --- trọng lực
    p.vy = Math.min(p.vy + cfg.GRAVITY * dt, cfg.MAX_FALL);

    moveX(state, p, p.vx * dt);
    const landed = moveY(state, p, p.vy * dt);
    p.onGround = !!landed;
    p.groundType = landed;

    // --- bị đẩy vào trong khối (máy dập vừa sượt qua)
    if (p.y > L.heightPx + 64) kill(state, p, 'rơi khỏi bản đồ.');

    // --- hoá chất
    const body = { x: p.x + 2, y: p.y + 2, w: p.w - 4, h: p.h - 2 };
    let touchX = false, touchN = false;
    forTiles(state, body, (t) => { if (t === 'X') touchX = true; if (t === 'N') touchN = true; });
    if (touchX && !(state.bridgeOn && p.groundType === 'bridge')) {
      kill(state, p, 'rơi vào bể chất thải oxy hoá (giả lập) — nguy hiểm cho cả hai loại nhựa!');
      return;
    }
    if (touchN && !p.def.impactResistant) {
      kill(state, p, 'chạm bể NaOH! Theo luật game PET phải nhảy qua (thực tế còn tuỳ nồng độ, nhiệt độ, thời gian).');
      return;
    }
    // HDPE đứng trên mặt bể NaOH
    const N = cfg.NAOH;
    const T = L.T;
    const underCenter = tileAt(state, Math.floor(centerX(p) / T), Math.floor((p.y + p.h + 1) / T));
    p.naoh.inside = p.onGround && (p.groundType === 'naoh' || underCenter === 'N');
    if (p.naoh.inside) {
      p.naoh.exposure += dt;
      if (Math.abs(p.vx) < N.stillSpeed) p.naoh.still += dt; else p.naoh.still = 0;
      if (p.naoh.still > N.maxStill) {
        kill(state, p, 'dừng lại trong bể NaOH! HDPE phải chạy liên tục.');
        return;
      }
      if (p.naoh.exposure > N.maxExposure) {
        kill(state, p, 'ở trong bể NaOH quá lâu (giới hạn thời gian giả lập).');
        return;
      }
    } else {
      p.naoh.still = 0;
      p.naoh.exposure = Math.max(0, p.naoh.exposure - N.recover * dt);
    }

    // --- tia sáng PET đi xuyên
    if (p.def.transparent) for (const b of state.beams) if (overlaps(p, b)) b.petPass = 0.3;
    p.beamBlocked = Math.max(0, p.beamBlocked - dt);

    // --- vật phẩm
    for (const it of L.items) {
      if (state.items[it.id] || !overlaps(p, it)) continue;
      if (it.owner === p.kind) {
        state.items[it.id] = true;
        say(state, `${p.kind} nhặt ${it.name}!`, { color: '#9be564', ttl: 4 });
        say(state, it.note, { color: '#bde0fe', ttl: 7 });
        emit(state, 'pickup', { who: p.kind, item: it.id });
      } else {
        say(state, `Chỉ ${it.owner} mới lấy được ${it.name}.`, { throttle: 3, key: 'own' + it.id, color: '#ffd166' });
      }
    }

    // --- checkpoint
    if (p.onGround && p.groundType !== 'naoh' && p.groundType !== 'bridge') {
      const cps = L.checkpoints;
      for (let i = cps.length - 1; i > p.checkpoint; i--) {
        if (centerX(p) >= cps[i].x && Math.abs(p.y + p.h - cps[i].y) < 2) {
          p.checkpoint = i;
          p.respawn = { x: cps[i].x, y: cps[i].y };
          break;
        }
      }
    }
  }

  // ------------------------------------------------------------------ main update
  function update(state, inputs, dt) {
    if (state.won) { state.time += dt; return state; }
    dt = dt || state.cfg.FIXED_DT;
    inputs = inputs || {};
    state.time += dt;
    const L = state.level;
    const [pet, hdpe] = state.players;

    // 1) Tấm cảm biến: chỉ bật khi PET (trong suốt, ánh sáng vẫn tới cảm biến) đứng trên đó
    const onPad = (p) => !p.dead && p.onGround &&
      overlapX(p, L.pad) >= p.w * 0.5 && Math.abs(p.y + p.h - (L.pad.y + L.pad.h)) < 8;
    const wasActive = state.padActive;
    state.padActive = onPad(pet) && pet.def.transparent;
    if (state.padActive && !wasActive && !state.complete) {
      emit(state, 'pad');
      say(state, 'Tín hiệu quang học ổn định — Cầu ánh sáng BẬT! Máy ép bắt đầu hạ xuống…', { color: '#7fd6ff' });
    }
    if (!state.padActive && wasActive && !state.complete) {
      say(state, 'Mất tín hiệu — Cầu ánh sáng TẮT!', { color: '#ffd166' });
    }
    if (onPad(hdpe) && !state.complete) {
      say(state, 'HDPE đục che mất ánh sáng tới cảm biến — cần PET!', { throttle: 4, key: 'hdpepad', color: '#ffd166' });
    }
    state.bridgeOn = state.padActive || state.complete;

    // 2) Máy móc
    updateStampers(state, dt);
    updatePress(state, dt);

    // 3) Nhân vật
    updatePlayer(state, pet, inputs.p1, dt);
    updatePlayer(state, hdpe, inputs.p2, dt);
    for (const p of state.players) p.bracing = false;
    for (const s of state.stampers) if (s.blocked && s.blocker) s.blocker.bracing = true;
    if (state.press.blocked && state.press.blocker) state.press.blocker.bracing = true;

    // 4) Cửa vào phòng phối hợp
    if (!state.gateOpen && L.gate.requires.every((id) => state.items[id])) {
      state.gateOpen = true;
      say(state, 'Đủ Vật phẩm A và B — cửa phòng phối hợp đã mở!', { color: '#9be564', ttl: 5 });
      emit(state, 'door');
    }

    // 5) Đồng bộ: PET giữ tín hiệu + HDPE chặn máy ép
    if (!state.complete) {
      const held = state.padActive && state.press.blocked && state.press.blocker === hdpe;
      if (held) state.sync += dt;
      else state.sync = Math.max(0, state.sync - dt * 1.5);
      if (state.sync >= state.cfg.SYNC_TIME) {
        state.complete = true;
        state.exitOpen = true;
        state.bridgeOn = true;
        say(state, 'Phối hợp thành công! Cửa thoát đã mở, cầu ánh sáng được khoá cố định.', { color: '#9be564', ttl: 6 });
        emit(state, 'door');
        emit(state, 'complete');
      }
    }

    // 6) Chiến thắng: cả hai vào khu cửa thoát
    if (state.exitOpen && state.players.every((p) => !p.dead && overlaps(p, L.exitZone))) {
      state.won = true;
      state.wonTime = state.time;
      emit(state, 'win');
    }

    // 7) Dọn thông báo hết hạn
    state.messages = state.messages.filter((m) => state.time - m.time < m.ttl);
    for (const b of state.beams) { b.hdpeHit = Math.max(0, b.hdpeHit - dt); b.petPass = Math.max(0, b.petPass - dt); }
    return state;
  }

  // Khu hiện tại (theo trung điểm hai nhân vật) — dùng cho HUD
  function currentZone(state, x) {
    for (const z of state.level.zones) if (x >= z.x0 && x < z.x1) return z;
    return state.level.zones[state.level.zones.length - 1];
  }

  // Biển hướng dẫn gần nhất mà một nhân vật đang đứng cạnh
  function activeSign(state) {
    let best = null, bestD = Infinity;
    for (const s of state.level.signs) {
      for (const p of state.players) {
        if (p.dead) continue;
        const d = Math.abs(centerX(p) - s.x);
        const sy = s.y !== undefined ? s.y : state.level.FLOOR * state.level.T;
        if (d < 90 && Math.abs(p.y + p.h - sy) < 70 && d < bestD) { best = s; bestD = d; }
      }
    }
    return best;
  }

  // Danh sách mục tiêu cho HUD
  function objectives(state) {
    return [
      { text: 'PET lấy Vật phẩm A (Phòng A)', done: !!state.items.A },
      { text: 'HDPE lấy Vật phẩm B (Phòng B)', done: !!state.items.B },
      { text: 'Mở cửa phòng phối hợp', done: state.gateOpen },
      { text: 'PET giữ tín hiệu + HDPE chặn máy ép', done: state.complete },
      { text: 'Cả hai cùng vào cửa thoát', done: state.won },
    ];
  }

  PE.Engine = {
    createGame, update, currentZone, activeSign, objectives,
    // xuất ra cho test
    _internal: { overlaps, overlapX, tileAt, tileSolidFor, kill, respawn },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = PE.Engine;
})(typeof window !== 'undefined' ? window : globalThis);
