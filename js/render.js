/*
 * The Polyeths — VẼ (Canvas 2D, không dùng ảnh ngoài)
 * ---------------------------------------------------------------
 * Toàn bộ đồ hoạ được vẽ bằng hình khối đơn giản. Muốn đổi màu,
 * sửa bảng COLORS bên dưới.
 */
(function (root) {
  'use strict';
  const PE = root.PE || (root.PE = {});

  const COLORS = {
    bgTop: '#141a26',
    bgBottom: '#0b0f17',
    wall: '#2b3445',
    wallEdge: '#3d4a61',
    wallDark: '#1d2431',
    grate: '#7d8aa3',
    naoh: '#4cd97b',
    naohDeep: '#1f8c4a',
    oxid: '#b45cff',
    oxidDeep: '#5d2394',
    beam: '#7fe7ff',
    beamHit: '#ff5d5d',
    hazard: '#ffcc33',
    text: '#e8edf5',
    good: '#9be564',
    bad: '#ff6b6b',
  };

  function createCamera(cfg) {
    return { x: 0, y: 0, zoom: 1, init: false, cfg };
  }

  // Camera theo trung điểm 2 nhân vật, tự thu nhỏ để thấy cả hai
  function updateCamera(cam, state, dt) {
    const cfg = state.cfg;
    const L = state.level;
    const alive = state.players.filter((p) => !p.dead);
    const ps = alive.length ? alive : state.players;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of ps) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x + p.w);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y + p.h);
    }
    const needW = maxX - minX + 420;
    const needH = maxY - minY + 260;
    const targetZoom = Math.max(cfg.MIN_ZOOM, Math.min(cfg.MAX_ZOOM, cfg.VIEW_W / needW, cfg.VIEW_H / needH));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const k = cam.init ? 1 - Math.exp(-dt * 6) : 1;
    cam.zoom += (targetZoom - cam.zoom) * k;
    const vw = cfg.VIEW_W / cam.zoom, vh = cfg.VIEW_H / cam.zoom;
    let tx = cx - vw / 2, ty = cy - vh / 2;
    tx = vw >= L.widthPx ? (L.widthPx - vw) / 2 : Math.max(0, Math.min(L.widthPx - vw, tx));
    ty = vh >= L.heightPx ? (L.heightPx - vh) / 2 : Math.max(0, Math.min(L.heightPx - vh, ty));
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
    cam.init = true;
  }

  // ---------------------------------------------------------------- helpers
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function stripes(ctx, x, y, w, h, c1, c2, size) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = c1; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = c2;
    size = size || 10;
    for (let i = -h; i < w + h; i += size * 2) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + size, y + h);
      ctx.lineTo(x + i + size + h, y); ctx.lineTo(x + i + h, y);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- background
  function drawBackground(ctx, state, cam) {
    const cfg = state.cfg;
    const g = ctx.createLinearGradient(0, 0, 0, cfg.VIEW_H);
    g.addColorStop(0, COLORS.bgTop); g.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cfg.VIEW_W, cfg.VIEW_H);
    // ống dẫn mờ phía xa (parallax)
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#2f3b52';
    ctx.lineWidth = 10;
    const off = -(cam.x * 0.3) % 240;
    for (let x = off - 240; x < cfg.VIEW_W + 240; x += 240) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cfg.VIEW_H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, 120); ctx.lineTo(x + 120, 120); ctx.lineTo(x + 120, cfg.VIEW_H); ctx.stroke();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- tiles
  function drawTiles(ctx, state, cam, t) {
    const L = state.level, T = L.T;
    const vw = state.cfg.VIEW_W / cam.zoom, vh = state.cfg.VIEW_H / cam.zoom;
    const c0 = Math.max(0, Math.floor(cam.x / T) - 1), c1 = Math.min(L.W - 1, Math.ceil((cam.x + vw) / T) + 1);
    const r0 = Math.max(0, Math.floor(cam.y / T) - 1), r1 = Math.min(L.H - 1, Math.ceil((cam.y + vh) / T) + 1);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const tile = L.grid[r][c];
        const x = c * T, y = r * T;
        if (tile === '#') {
          ctx.fillStyle = COLORS.wall;
          ctx.fillRect(x, y, T, T);
          const up = r > 0 ? L.grid[r - 1][c] : '#';
          if (up !== '#') { ctx.fillStyle = COLORS.wallEdge; ctx.fillRect(x, y, T, 4); }
          ctx.fillStyle = COLORS.wallDark;
          ctx.fillRect(x, y + T - 2, T, 2);
          ctx.fillRect(x + T - 2, y, 2, T);
          if ((c + r) % 3 === 0) { ctx.fillStyle = '#4a5873'; ctx.fillRect(x + 5, y + 8, 3, 3); }
        } else if (tile === '-') {
          ctx.fillStyle = COLORS.grate;
          ctx.fillRect(x, y, T, 5);
          ctx.fillStyle = '#556078';
          for (let i = 2; i < T; i += 6) ctx.fillRect(x + i, y + 5, 2, 4);
        } else if (tile === 'N' || tile === 'X') {
          const top = r > 0 && L.grid[r - 1][c] !== tile;
          const deep = tile === 'N' ? COLORS.naohDeep : COLORS.oxidDeep;
          const surf = tile === 'N' ? COLORS.naoh : COLORS.oxid;
          ctx.fillStyle = deep;
          ctx.fillRect(x, y, T, T);
          if (top) {
            ctx.fillStyle = surf;
            ctx.beginPath();
            ctx.moveTo(x, y + T);
            for (let i = 0; i <= T; i += 4) {
              ctx.lineTo(x + i, y + 5 + Math.sin((x + i) * 0.12 + t * 3) * 2.5);
            }
            ctx.lineTo(x + T, y + T);
            ctx.closePath(); ctx.fill();
            // bong bóng
            const b = ((t * 0.8 + c * 0.37) % 1);
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.beginPath(); ctx.arc(x + 8 + (c * 7) % 16, y + T - b * (T - 6), 2, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    }
    // nhãn bể
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const row = L.grid[L.FLOOR];
    let c = 0;
    while (c < L.W) {
      const t0 = row[c];
      if (t0 === 'N' || t0 === 'X') {
        let e = c; while (e < L.W && row[e] === t0) e++;
        const cx = ((c + e) / 2) * T;
        const y = L.FLOOR * T - 50;
        const label = t0 === 'N' ? 'NaOH' : 'OXY HOÁ';
        ctx.fillStyle = t0 === 'N' ? COLORS.naohDeep : COLORS.oxidDeep;
        roundRect(ctx, cx - 34, y - 12, 68, 18, 4); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(label, cx, y + 2);
        // cọc biển
        ctx.fillStyle = '#556078';
        ctx.fillRect(cx - 1, y + 6, 2, 0);
        c = e;
      } else c++;
    }
  }

  // ---------------------------------------------------------------- decor: zone labels, signs, checkpoints
  function drawDecor(ctx, state, t) {
    const L = state.level, T = L.T;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(200,215,240,0.12)';
    for (const z of L.zones) ctx.fillText(z.name.toUpperCase(), z.x0 + 40, L.FLOOR * T - 130);
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(127,231,255,0.25)';
    ctx.fillText('PHÒNG A — CẢM BIẾN ÁNH SÁNG', 73 * T, 2 * T - 6);
    ctx.fillStyle = 'rgba(255,204,51,0.25)';
    ctx.fillText('PHÒNG B — VA ĐẬP', 99 * T, 2 * T - 6);
    ctx.restore();

    // biển hướng dẫn
    const active = PE.Engine.activeSign(state);
    for (const s of L.signs) {
      const sy = s.y !== undefined ? s.y : L.FLOOR * T;
      const on = active === s;
      ctx.fillStyle = '#556078';
      ctx.fillRect(s.x - 2, sy - 34, 4, 34);
      ctx.fillStyle = on ? COLORS.hazard : '#c9a227';
      roundRect(ctx, s.x - 13, sy - 50, 26, 20, 4); ctx.fill();
      ctx.fillStyle = '#1b1b1b';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(on ? '!' : '?', s.x, sy - 35);
    }
    // checkpoint: đèn sáng khi có người đã đi qua
    L.checkpoints.forEach((cp, i) => {
      const lit = state.players.some((p) => p.checkpoint >= i);
      ctx.fillStyle = '#3d4a61';
      ctx.fillRect(cp.x - 2, cp.y - 22, 4, 22);
      ctx.fillStyle = lit ? COLORS.good : '#5b6577';
      ctx.beginPath(); ctx.arc(cp.x, cp.y - 25, 5, 0, Math.PI * 2); ctx.fill();
      if (lit) {
        ctx.fillStyle = 'rgba(155,229,100,0.18)';
        ctx.beginPath(); ctx.arc(cp.x, cp.y - 25, 12 + Math.sin(t * 4) * 2, 0, Math.PI * 2); ctx.fill();
      }
    });
  }

  // ---------------------------------------------------------------- entities
  function drawBeams(ctx, state, t) {
    for (const b of state.beams) {
      const hit = b.hdpeHit > 0, pass = b.petPass > 0;
      const col = hit ? COLORS.beamHit : COLORS.beam;
      // phát & cảm biến
      ctx.fillStyle = '#556078';
      ctx.fillRect(b.x - 6, b.y, b.w + 12, 8);
      ctx.fillRect(b.x - 6, b.y + b.h - 6, b.w + 12, 6);
      ctx.fillStyle = col;
      ctx.fillRect(b.x - 2, b.y + b.h - 8, b.w + 4, 3);
      // tia
      ctx.save();
      ctx.globalAlpha = 0.18 + (pass ? 0.25 : 0) + Math.sin(t * 10 + b.x) * 0.04;
      ctx.fillStyle = col;
      ctx.fillRect(b.x - 6, b.y + 8, b.w + 12, b.h - 14);
      ctx.globalAlpha = 0.85;
      ctx.fillRect(b.x + b.w / 2 - 1.5, b.y + 8, 3, b.h - 14);
      ctx.restore();
    }
  }

  function drawItems(ctx, state, t) {
    for (const it of state.level.items) {
      if (state.items[it.id]) continue;
      const bob = Math.sin(t * 3 + it.x) * 3;
      const cx = it.x + it.w / 2, cy = it.y + it.h / 2 + bob;
      ctx.save();
      ctx.fillStyle = it.id === 'A' ? 'rgba(127,231,255,0.25)' : 'rgba(255,204,51,0.25)';
      ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.fill();
      if (it.id === 'A') {
        // thấu kính
        ctx.fillStyle = '#bff3ff';
        ctx.strokeStyle = '#2aa9d6'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(cx, cy, 7, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else {
        // bánh răng
        ctx.fillStyle = '#ffcc33';
        ctx.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2 + t;
          const r = i % 2 ? 7 : 11;
          ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#7a5a00';
        ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(it.id, cx, cy - 16);
      ctx.restore();
    }
    // bệ / bảng điều khiển
    for (const it of state.level.items) {
      ctx.fillStyle = '#3d4a61';
      ctx.fillRect(it.x - 4, it.y + it.h + 2, it.w + 8, 4);
    }
  }

  function drawCrusher(ctx, m, label) {
    const h = m.bottom - m.top;
    // cần piston
    ctx.fillStyle = '#7d8aa3';
    ctx.fillRect(m.x + m.w / 2 - 5, m.top, 10, Math.max(0, h - 18));
    // khối dập
    const bh = Math.min(h, 26);
    stripes(ctx, m.x, m.bottom - bh, m.w, bh, '#2b2b2b', COLORS.hazard, 8);
    ctx.strokeStyle = m.blocked ? COLORS.good : '#111';
    ctx.lineWidth = 2;
    ctx.strokeRect(m.x + 1, m.bottom - bh + 1, m.w - 2, bh - 2);
    if (label) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, m.x + m.w / 2, m.top + 14);
    }
  }

  function drawMachines(ctx, state) {
    for (const s of state.stampers) drawCrusher(ctx, s);
    // máy ép (vỏ + khối)
    const pr = state.press;
    ctx.fillStyle = '#3a2f1f';
    ctx.fillRect(pr.x - 6, pr.top - 6, pr.w + 12, 6);
    drawCrusher(ctx, pr, 'MÁY ÉP');
    ctx.fillStyle = pr.blocked ? COLORS.good : '#888';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    if (pr.blocked) ctx.fillText('ĐÃ CHẶN', pr.x + pr.w / 2, pr.bottom - 30);
  }

  function drawDoor(ctx, d, open, labelTop, lights) {
    if (open) {
      ctx.fillStyle = 'rgba(155,229,100,0.15)';
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.fillStyle = '#3d4a61';
      ctx.fillRect(d.x, d.y, d.w, 10);
      return;
    }
    ctx.fillStyle = '#4a3f2a';
    ctx.fillRect(d.x, d.y, d.w, d.h);
    for (let y = d.y + 10; y < d.y + d.h; y += 20) {
      ctx.fillStyle = '#5e5136'; ctx.fillRect(d.x + 3, y, d.w - 6, 10);
    }
    if (lights) {
      lights.forEach((l, i) => {
        ctx.fillStyle = l.on ? COLORS.good : COLORS.bad;
        ctx.beginPath(); ctx.arc(d.x + d.w / 2, d.y + 22 + i * 26, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(l.label, d.x + d.w / 2, d.y + 26 + i * 26);
      });
    }
    if (labelTop) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labelTop, d.x + d.w / 2, d.y - 6);
    }
  }

  function drawFinale(ctx, state, t) {
    const L = state.level;
    // ánh sáng chiếu xuống tấm cảm biến
    const pad = L.pad;
    ctx.save();
    ctx.globalAlpha = state.padActive || state.complete ? 0.35 : 0.12;
    const gl = ctx.createLinearGradient(0, pad.y - 120, 0, pad.y);
    gl.addColorStop(0, 'rgba(127,231,255,0)'); gl.addColorStop(1, COLORS.beam);
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.moveTo(pad.x + pad.w / 2 - 10, pad.y - 125);
    ctx.lineTo(pad.x + pad.w / 2 + 10, pad.y - 125);
    ctx.lineTo(pad.x + pad.w + 6, pad.y);
    ctx.lineTo(pad.x - 6, pad.y);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = state.padActive || state.complete ? COLORS.beam : '#3e5566';
    ctx.fillRect(pad.x, pad.y, pad.w, pad.h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CẢM BIẾN', pad.x + pad.w / 2, pad.y + pad.h + 20);

    // cầu ánh sáng
    const b = L.bridge;
    if (state.bridgeOn) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = COLORS.beam;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.globalAlpha = 0.25 + Math.sin(t * 8) * 0.08;
      ctx.fillRect(b.x, b.y - 8, b.w, 8);
      ctx.restore();
    } else {
      ctx.save();
      ctx.strokeStyle = 'rgba(127,231,255,0.35)';
      ctx.setLineDash([8, 8]);
      ctx.strokeRect(b.x + 1, b.y, b.w - 2, b.h);
      ctx.restore();
    }

    // cửa vào phòng phối hợp (2 khoá A/B)
    drawDoor(ctx, L.gate, state.gateOpen, null, [
      { label: 'A', on: !!state.items.A }, { label: 'B', on: !!state.items.B },
    ]);
    // cửa thoát
    drawDoor(ctx, L.exitDoor, state.exitOpen, null, [{ label: '⇄', on: state.complete }]);
    // khu thoát
    const z = L.exitZone;
    ctx.fillStyle = state.exitOpen ? 'rgba(155,229,100,0.12)' : 'rgba(255,255,255,0.03)';
    ctx.fillRect(z.x, z.y, z.w, z.h);
    ctx.fillStyle = state.exitOpen ? COLORS.good : '#667';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', z.x + z.w / 2, z.y + 50);

    // thanh đồng bộ phía trên hố
    if (!state.complete && (state.padActive || state.sync > 0)) {
      const w = 220, x = (b.x + L.press.x + L.press.w) / 2 - w / 2 + 40, y = L.press.top + 30;
      const k = state.sync / state.cfg.SYNC_TIME;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      roundRect(ctx, x - 6, y - 18, w + 12, 34, 6); ctx.fill();
      ctx.fillStyle = '#333';
      ctx.fillRect(x, y, w, 10);
      ctx.fillStyle = COLORS.good;
      ctx.fillRect(x, y, w * k, 10);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const a = state.padActive ? '✔ Tín hiệu' : '✘ Tín hiệu';
      const c = state.press.blocked ? '✔ Máy ép' : '✘ Máy ép';
      ctx.fillText(`${a}   ${c}`, x + w / 2, y - 5);
    }
  }

  // ---------------------------------------------------------------- characters
  function drawPlayer(ctx, state, p, t) {
    if (p.dead) {
      // mảnh vỡ
      const k = 1 - p.respawnTimer / state.cfg.RESPAWN_DELAY;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.fillStyle = p.def.color;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.fillRect(p.x + p.w / 2 + Math.cos(a) * k * 30, p.y + p.h / 2 + Math.sin(a) * k * 30, 4, 4);
      }
      ctx.restore();
      return;
    }
    const isPET = p.kind === 'PET';
    const x = p.x, y = p.y, w = p.w, h = p.h;
    const squash = p.bracing ? 3 : 0;
    ctx.save();
    // thân chai
    if (isPET) {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = p.def.color;
      roundRect(ctx, x, y + 8 + squash, w, h - 8 - squash, 7); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#d9f6ff'; ctx.lineWidth = 1.5;
      roundRect(ctx, x, y + 8 + squash, w, h - 8 - squash, 7); ctx.stroke();
      // cổ chai + nắp
      ctx.fillStyle = 'rgba(127,214,255,0.6)';
      ctx.fillRect(x + w / 2 - 5, y + 3 + squash, 10, 6);
      ctx.fillStyle = '#2b7bd6';
      ctx.fillRect(x + w / 2 - 6, y + squash, 12, 5);
      // ánh phản chiếu
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(x + 4, y + 13 + squash, 3, h - 20);
    } else {
      ctx.fillStyle = p.def.color;
      roundRect(ctx, x, y + 6 + squash, w, h - 6 - squash, 5); ctx.fill();
      ctx.strokeStyle = '#b9b4a2'; ctx.lineWidth = 1.5;
      roundRect(ctx, x, y + 6 + squash, w, h - 6 - squash, 5); ctx.stroke();
      // quai can
      ctx.strokeStyle = '#d9d4c2'; ctx.lineWidth = 3;
      ctx.beginPath();
      const hx = p.facing > 0 ? x + 4 : x + w - 4;
      ctx.arc(hx, y + 14 + squash, 5, 0, Math.PI * 2); ctx.stroke();
      // nắp cam
      ctx.fillStyle = '#ff8c3a';
      ctx.fillRect(x + w / 2 - 6 + p.facing * 4, y + squash, 12, 7);
    }
    // mắt
    const ex = x + w / 2 + p.facing * 4;
    ctx.fillStyle = '#10151f';
    ctx.fillRect(ex - 5, y + 15 + squash, 3, 5);
    ctx.fillRect(ex + 2, y + 15 + squash, 3, 5);
    // mã tái chế
    ctx.fillStyle = isPET ? '#0b4a7a' : '#7a3a0b';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isPET ? '♳1' : '♴2', x + w / 2, y + h - 5);
    ctx.restore();

    // tên & P1/P2
    ctx.fillStyle = isPET ? '#7fd6ff' : '#ffb27a';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.slot.toUpperCase()} ${p.kind}`, x + w / 2, y - 6);

    // thanh phơi nhiễm NaOH
    if (p.naoh.exposure > 0.01) {
      const k = Math.min(1, p.naoh.exposure / state.cfg.NAOH.maxExposure);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x - 6, y - 22, w + 12, 6);
      ctx.fillStyle = k > 0.7 ? COLORS.bad : COLORS.naoh;
      ctx.fillRect(x - 6, y - 22, (w + 12) * k, 6);
      if (p.naoh.inside && Math.abs(p.vx) < state.cfg.NAOH.stillSpeed * 2) {
        ctx.fillStyle = COLORS.bad;
        ctx.fillText('CHẠY TIẾP!', x + w / 2, y - 28);
      }
    }
    if (p.beamBlocked > 0) {
      ctx.fillStyle = COLORS.beamHit;
      ctx.fillText('✋', x + w / 2 + p.facing * 18, y + 10);
    }
    if (p.bracing) {
      ctx.strokeStyle = COLORS.good; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 4, y + 2); ctx.lineTo(x - 9, y - 4);
      ctx.moveTo(x + w + 4, y + 2); ctx.lineTo(x + w + 9, y - 4);
      ctx.stroke();
    }
  }

  // ---------------------------------------------------------------- main draw
  function draw(ctx, state, cam, t) {
    const cfg = state.cfg;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawBackground(ctx, state, cam);
    ctx.setTransform(cam.zoom, 0, 0, cam.zoom, -cam.x * cam.zoom, -cam.y * cam.zoom);
    // nền ngoài bản đồ (khi thu nhỏ)
    ctx.fillStyle = '#06080d';
    ctx.fillRect(-2000, state.level.heightPx, state.level.widthPx + 4000, 2000);
    drawDecor(ctx, state, t);
    drawTiles(ctx, state, cam, t);
    drawBeams(ctx, state, t);
    drawFinale(ctx, state, t);
    drawItems(ctx, state, t);
    for (const p of state.players) drawPlayer(ctx, state, p, t);
    drawMachines(ctx, state);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    void cfg;
  }

  PE.Render = { COLORS, createCamera, updateCamera, draw };
})(typeof window !== 'undefined' ? window : globalThis);
