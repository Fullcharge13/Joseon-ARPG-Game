/* ======================= 그리기 ======================= */
const R_ = {cv: null, ctx: null, u: 1, z: 3, camX: 0, camY: 0, lowFx: false, ft: [], seen: new Set()};
function resize() {
  const cv = R_.cv;
  const u = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.round(innerWidth * u),
    H = Math.round(innerHeight * u);
  if (cv.width !== W || cv.height !== H) (cv.width = W), (cv.height = H);
  R_.u = u;
  // 세계가 세로로 약 230px 보이도록 정수 배율
  R_.z = Math.max(2, Math.round(H / 230));
  R_.ctx = cv.getContext('2d');
  R_.ctx.imageSmoothingEnabled = false;
}
function screenToWorld(x, y) {
  return {x: x / R_.z + R_.camX, y: y / R_.z + R_.camY};
}
const RAR_BEAM = ['#d8d0bc', '#6fa8ff', '#ffd451', '#ff8a2a'];

function drawWorld(w, real) {
  const c = R_.ctx,
    cv = R_.cv,
    z = R_.z,
    A = art(),
    p = w.p,
    m = w.map;
  const W = cv.width / z,
    H = cv.height / z;
  let cx = p.x - W / 2,
    cy = p.y - H / 2;
  if (w.shake > 0 && !R_.lowFx) (cx += (Math.random() - 0.5) * w.shake * 10), (cy += (Math.random() - 0.5) * w.shake * 10);
  R_.camX = Math.round(cx * z) / z;
  R_.camY = Math.round(cy * z) / z;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#0a0608';
  c.fillRect(0, 0, cv.width, cv.height);
  c.setTransform(z, 0, 0, z, -R_.camX * z, -R_.camY * z);
  c.imageSmoothingEnabled = false;
  // 타일
  const tx0 = Math.max(0, Math.floor(R_.camX / TILE)),
    ty0 = Math.max(0, Math.floor(R_.camY / TILE)),
    tx1 = Math.min(m.w - 1, Math.floor((R_.camX + W) / TILE)),
    ty1 = Math.min(m.h - 1, Math.floor((R_.camY + H) / TILE));
  const wf = Math.floor(real * 2) % 2;
  for (let ty = ty0; ty <= ty1; ty++)
    for (let tx = tx0; tx <= tx1; tx++) {
      const t = m.tiles[ty * m.w + tx],
        X = tx * TILE,
        Y = ty * TILE;
      if (t === 1) {
        // 바닥에 닿은 벽만 그린다(나머지는 어둠)
        const near = walkable(m, tx, ty + 1) || walkable(m, tx, ty - 1) || walkable(m, tx + 1, ty) || walkable(m, tx - 1, ty);
        if (near) c.drawImage(A.tiles.wall, X, Y);
        continue;
      }
      c.drawImage(A.tiles.floor[(tx * 7 + ty * 13) % 3], X, Y);
      if (t === 2) c.drawImage(A.tiles.pillar, X, Y);
      else if (t === 3) c.drawImage(A.tiles.water[(wf + tx) % 2], X, Y);
      else if (t === 4) c.drawImage(A.tiles.lantern, X, Y);
    }
  // 출구
  const ex = (m.exit.x + 0.5) * TILE,
    ey = (m.exit.y + 0.5) * TILE;
  const bossFloor = m.rooms.some(r => r.kind === 'boss');
  if (!bossFloor) drawStairs(c, ex, ey, real);
  else if (w.bossDead) drawPortal(c, ex, ey, real);
  // 장판
  for (const P of w.pools) {
    c.globalAlpha = Math.min(1, P.t) * 0.55;
    if (P.line) {
      c.strokeStyle = '#140c18';
      c.lineWidth = P.wd * 0.8;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(P.x, P.y);
      c.lineTo(P.x2, P.y2);
      c.stroke();
    } else {
      c.fillStyle = '#bfe6ff';
      circle(c, P.x, P.y, P.r);
    }
    c.globalAlpha = 1;
  }
  // 예고
  for (const T of w.tele) {
    const k = 1 - T.t / T.total;
    c.fillStyle = 'rgba(200,40,30,0.22)';
    c.strokeStyle = 'rgba(255,90,60,0.9)';
    c.lineWidth = 1;
    if (T.kind === 'circle') {
      circle(c, T.x, T.y, T.r);
      c.beginPath();
      c.arc(T.x, T.y, T.r, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = 'rgba(255,70,40,0.35)';
      circle(c, T.x, T.y, T.r * k);
    } else {
      c.save();
      c.translate(T.x, T.y);
      c.rotate(T.a);
      const L = Math.hypot(T.x2 - T.x, T.y2 - T.y);
      c.fillRect(0, -T.wd / 2, L, T.wd);
      c.strokeRect(0, -T.wd / 2, L, T.wd);
      c.fillStyle = 'rgba(255,70,40,0.35)';
      c.fillRect(0, -T.wd / 2, L * k, T.wd);
      c.restore();
    }
  }
  // 떨어진 것
  for (const d of w.drops) {
    if (d.peach) {
      const X = Math.round(d.x),
        Y = Math.round(d.y + Math.sin(real * 3 + d.x));
      c.fillStyle = '#ffb0b8';
      c.fillRect(X - 3, Y - 2, 6, 5);
      c.fillStyle = '#ff7088';
      c.fillRect(X - 3, Y, 6, 3);
      c.fillStyle = '#3f9a5a';
      c.fillRect(X, Y - 4, 3, 2);
      continue;
    }
    if (d.gold) {
      c.fillStyle = '#e0b048';
      c.fillRect(Math.round(d.x) - 2, Math.round(d.y) - 2, 4, 4);
      c.fillStyle = '#7a5a20';
      c.fillRect(Math.round(d.x) - 1, Math.round(d.y) - 1, 2, 2);
      continue;
    }
    const it = d.item,
      col = RAR_BEAM[it.rar];
    if (it.rar >= 1) {
      const hgt = [0, 10, 18, 34][it.rar];
      const g = c.createLinearGradient(0, d.y - hgt, 0, d.y);
      g.addColorStop(0, col + '00');
      g.addColorStop(1, col + 'aa');
      c.fillStyle = g;
      c.fillRect(d.x - 2, d.y - hgt, 4, hgt);
    }
    c.drawImage(icon(it.slot), Math.round(d.x - 6), Math.round(d.y - 6 + Math.sin(real * 3 + d.x) * 1));
    c.strokeStyle = col;
    c.lineWidth = 1;
    c.strokeRect(Math.round(d.x - 7) + 0.5, Math.round(d.y - 7) + 0.5, 13, 13);
  }
  // 몸들: y 순서
  const bodies = w.ens.filter(e => !e.dead && e.x > R_.camX - 40 && e.x < R_.camX + W + 40 && e.y > R_.camY - 40 && e.y < R_.camY + H + 40);
  bodies.push(p);
  bodies.sort((a, b) => a.y - b.y);
  for (const b of bodies) (b === p ? drawPlayer(c, w, real) : drawEnemy(c, w, b, real));
  // 투사체
  for (const pr of w.projs) {
    if (pr.look === 'hwa') {
      c.save();
      c.translate(pr.x, pr.y);
      c.rotate(real * 10);
      c.fillStyle = '#e0b048';
      c.fillRect(-3, -4, 6, 8);
      c.fillStyle = '#c23b2a';
      c.fillRect(-1, -3, 2, 6);
      c.restore();
    } else {
      c.fillStyle = '#1a1418';
      c.fillRect(Math.round(pr.x) - 2, Math.round(pr.y) - 2, 4, 4);
      c.fillStyle = 'rgba(26,20,24,0.4)';
      c.fillRect(Math.round(pr.x - pr.vx * 0.02) - 1, Math.round(pr.y - pr.vy * 0.02) - 1, 3, 3);
    }
  }
  for (const h of w.hprojs) {
    c.fillStyle = '#b07fd0';
    circle(c, h.x, h.y, 3);
    c.fillStyle = '#efe0ff';
    c.fillRect(Math.round(h.x) - 1, Math.round(h.y) - 1, 2, 2);
  }
  // 효과
  for (const f of w.fx) {
    if (f.k === 'dot') {
      if (R_.lowFx && (f.x * 7) % 2 > 1) continue;
      c.fillStyle = f.c;
      c.globalAlpha = Math.min(1, f.t * 2);
      c.fillRect(Math.round(f.x), Math.round(f.y), 2, 2);
      c.globalAlpha = 1;
    } else if (f.k === 'ring') {
      c.strokeStyle = f.c;
      c.globalAlpha = f.t / f.T;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(f.x, f.y, f.r * (1.15 - (0.25 * f.t) / f.T), 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 1;
    } else if (f.k === 'stroke') {
      c.strokeStyle = '#120a10';
      c.globalAlpha = f.t / f.T;
      c.lineCap = 'round';
      c.lineWidth = 7 * (f.t / f.T) + 2;
      c.beginPath();
      c.moveTo(f.x, f.y);
      c.lineTo(f.x2, f.y2);
      c.stroke();
      c.globalAlpha = 1;
    }
  }
  // 어둠(등불 둘레만 밝게)
  c.setTransform(1, 0, 0, 1, 0, 0);
  if (!R_.lowFx) {
    const sx = (p.x - R_.camX) * z,
      sy = (p.y - R_.camY) * z;
    const g = c.createRadialGradient(sx, sy, 60 * z, sx, sy, 170 * z);
    g.addColorStop(0, 'rgba(8,4,8,0)');
    g.addColorStop(1, 'rgba(8,4,8,0.75)');
    c.fillStyle = g;
    c.fillRect(0, 0, cv.width, cv.height);
  }
  // 피해 숫자(화면 기준으로 또렷하게)
  c.textAlign = 'center';
  for (const n of w.nums) {
    const sx = (n.x - R_.camX) * z,
      sy = (n.y - R_.camY) * z;
    c.font = `bold ${(n.crit ? 15 : 11) * R_.u}px sans-serif`;
    c.globalAlpha = Math.min(1, n.t * 2);
    c.fillStyle = '#0a0608';
    c.fillText(n.v, sx + R_.u, sy + R_.u);
    c.fillStyle = n.crit ? '#ffd451' : n.type === 'fire' ? '#ffb070' : n.type === 'cold' ? '#bfe6ff' : '#efe6d2';
    c.fillText(n.v, sx, sy);
  }
  c.globalAlpha = 1;
  // 정예·보스 이름
  for (const e of bodies)
    if (e !== p && (e.elite || e.boss) && !e.sleep) {
      const sx = (e.x - R_.camX) * z,
        sy = (e.y - R_.camY - e.r * (e.boss ? 2 : 1) - 12) * z;
      c.font = `bold ${10 * R_.u}px sans-serif`;
      const name = e.boss ? '' : e.elite.map(k => ELITE_MODS[k].n).join(' ') + ' ' + e.D.n;
      if (name) {
        c.fillStyle = '#0a0608';
        c.fillText(name, sx + R_.u, sy + R_.u);
        c.fillStyle = '#ffd451';
        c.fillText(name, sx, sy);
      }
    }
}
function circle(c, x, y, r) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}
function drawStairs(c, x, y, t) {
  c.fillStyle = '#0a0608';
  c.fillRect(x - 8, y - 7, 16, 14);
  for (let i = 0; i < 4; i++) {
    c.fillStyle = ['#5a5450', '#4a4440', '#3a3430', '#2a2420'][i];
    c.fillRect(x - 7 + i, y - 6 + i * 3, 14 - i * 2, 3);
  }
  c.globalAlpha = 0.5 + 0.3 * Math.sin(t * 3);
  c.strokeStyle = '#e0b048';
  c.strokeRect(x - 8.5, y - 7.5, 17, 15);
  c.globalAlpha = 1;
}
function drawPortal(c, x, y, t) {
  for (let i = 0; i < 3; i++) {
    c.strokeStyle = ['#ffd451', '#ff8a2a', '#fff4c0'][i];
    c.globalAlpha = 0.7;
    c.lineWidth = 2;
    c.beginPath();
    c.arc(x, y, 8 + i * 3 + Math.sin(t * 4 + i) * 1.5, 0, Math.PI * 2);
    c.stroke();
  }
  c.globalAlpha = 1;
}
function drawPlayer(c, w, t) {
  const p = w.p,
    A = art();
  const moving = p.walk > 0 && IN && (Math.abs(readMoveCache.mx) + Math.abs(readMoveCache.my) > 0.05);
  const fi = moving ? 1 + (Math.floor(t * 8) % 2) : 0;
  const F = A.player[fi];
  const img = p.hurtT > 0 ? F.W : p.fx > 0 ? F.R : F.L;
  const X = Math.round(p.x - img.width / 2),
    Y = Math.round(p.y - img.height + 4);
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(Math.round(p.x) - 5, Math.round(p.y) + 2, 10, 3);
  if (p.dodgeT > 0) {
    c.globalAlpha = 0.35;
    c.drawImage(img, X - Math.cos(p.dodgeA) * 8, Y - Math.sin(p.dodgeA) * 8);
    c.globalAlpha = 1;
  }
  if (p.iframe > 0 && p.dodgeT <= 0) c.globalAlpha = 0.6;
  c.drawImage(img, X, Y - (p.castT > 0 ? 1 : 0));
  c.globalAlpha = 1;
  if (p.shield) {
    c.strokeStyle = 'rgba(255,224,138,' + (0.4 + 0.4 * (p.shield.amt / p.shield.max)) + ')';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(p.x, p.y - 5, 11 + Math.sin(t * 5) * 0.6, 0, Math.PI * 2);
    c.stroke();
  }
  if (p.burn > 0 && Math.floor(t * 10) % 2) {
    c.fillStyle = '#ff8a2a';
    c.fillRect(Math.round(p.x) - 1, Y - 2, 2, 2);
  }
}
const readMoveCache = {mx: 0, my: 0};
function drawEnemy(c, w, e, t) {
  const D = e.D,
    s = e.boss ? 2 : 1;
  const ea = enemyArt(D, !!e.elite || e.boss);
  const face = w.p.x >= e.x;
  let img = e.hitT > 0 ? ea.W : face ? ea.R : ea.L;
  const bob = D.fly ? Math.sin(t * 4 + e.x) * 1.5 : e.st === 'wind' ? (Math.floor(t * 20) % 2) - 0.5 : 0;
  const Wd = img.width * s,
    Hd = img.height * s;
  const X = Math.round(e.x - Wd / 2),
    Y = Math.round(e.y - Hd + e.r * 0.6 + bob);
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(Math.round(e.x - e.r), Math.round(e.y + e.r * 0.5), e.r * 2, 2 * s);
  if (e.elite && !R_.lowFx) {
    c.fillStyle = e.elite.includes('bul') ? 'rgba(255,120,40,0.25)' : 'rgba(255,212,81,0.18)';
    circle(c, e.x, e.y - Hd / 3, Math.max(Wd, Hd) * 0.6);
  }
  if (e.sleep) c.globalAlpha = 0.85;
  if (e.frozen > 0 || e.root > 0) c.filter && (c.globalAlpha = 0.8);
  c.drawImage(img, X, Y, Wd, Hd);
  c.globalAlpha = 1;
  if (e.frozen > 0) {
    c.strokeStyle = '#bfe6ff';
    c.strokeRect(X + 0.5, Y + 0.5, Wd - 1, Hd - 1);
  }
  if (e.burn && Math.floor(t * 12 + e.x) % 3 === 0) {
    c.fillStyle = '#ff8a2a';
    c.fillRect(Math.round(e.x + (Math.random() - 0.5) * e.r * 2), Y + 2, 1, 2);
  }
  if (!e.boss && e.hp < e.maxHp) {
    c.fillStyle = '#0a0608';
    c.fillRect(Math.round(e.x - 7), Y - 4, 14, 2);
    c.fillStyle = e.elite ? '#ffd451' : '#c23b2a';
    c.fillRect(Math.round(e.x - 7), Y - 4, Math.max(1, Math.round(14 * (e.hp / e.maxHp))), 2);
  }
}

/* --- HUD --- */
function drawHud(w, t) {
  const c = R_.ctx,
    cv = R_.cv,
    u = R_.u,
    S = w.S,
    p = w.p;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.textAlign = 'left';
  const m = 12 * u;
  // 체력·기력·경험치
  const bw = Math.min(220 * u, cv.width * 0.34);
  bar(c, m, m, bw, 12 * u, p.hp / S.maxHp, '#c23b2a', `${Math.ceil(p.hp)} / ${Math.round(S.maxHp)}`, p.shield ? p.shield.amt / S.maxHp : 0);
  bar(c, m, m + 16 * u, bw * 0.8, 8 * u, p.ki / S.maxKi, '#3a7fd0', '');
  const ch = w.ch;
  bar(c, m, m + 28 * u, bw * 0.8, 4 * u, ch.lvl >= MAX_LVL ? 1 : ch.xp / xpNeed(ch.lvl), '#e0b048', '');
  c.font = `bold ${11 * u}px sans-serif`;
  c.fillStyle = '#efe6d2';
  const fp = freePoints(ch);
  c.fillText(`Lv ${ch.lvl}${fp > 0 ? '  · 수련점 ' + fp : ''}`, m, m + 46 * u);
  c.fillStyle = '#a89a86';
  c.font = `${10 * u}px sans-serif`;
  c.fillText(`백귀사 ${w.floor}층 · 업 ${w.tier}단계 · 엽전 ${ch.gold}`, m, m + 60 * u);
  // 보스 막대
  const b = w.boss;
  if (b && !b.dead && !b.sleep) {
    const W2 = Math.min(cv.width * 0.5, 420 * u);
    bar(c, (cv.width - W2) / 2, m + 4 * u, W2, 10 * u, b.hp / b.maxHp, '#c23b2a', '');
    c.textAlign = 'center';
    c.font = `bold ${12 * u}px sans-serif`;
    c.fillStyle = '#ffd451';
    c.fillText(BOSS.n + (b.phase === 2 ? ' · 분노' : ''), cv.width / 2, m + 30 * u);
    c.textAlign = 'left';
  }
  // 작은 지도
  drawMinimap(c, w, u);
  // 버튼
  const L = hudLayout(cv.width, cv.height, u);
  for (const B of L) {
    if (B.id === 'pause') {
      c.fillStyle = 'rgba(20,12,16,0.7)';
      circle(c, B.x, B.y, B.r);
      c.fillStyle = '#efe6d2';
      for (let i = -1; i <= 1; i++) c.fillRect(B.x - 7 * u, B.y + i * 5 * u - u, 14 * u, 2 * u);
      continue;
    }
    if (B.id === 'dodge') {
      const cd = p.dodgeCd / DODGE_CD;
      btn(c, B, null, cd, false, IN.touch ? '' : 'Space');
      c.fillStyle = '#efe6d2';
      c.font = `bold ${12 * u}px sans-serif`;
      c.textAlign = 'center';
      c.fillText('회피', B.x, B.y + 4 * u);
      c.textAlign = 'left';
      continue;
    }
    const i = +B.id[1],
      id = w.ch.slots[i];
    if (!id) {
      btn(c, B, null, 0, true, IN.touch ? '' : String(i + 1));
      continue;
    }
    const cd = (p.cds[id] || 0) / skillCd(S, id);
    btn(c, B, icon(id), cd, p.ki < SKILLS[id].cost, IN.touch ? '' : ['1·좌', '2·우', '3', '4'][i]);
  }
  // 조이스틱
  if (IN.joy) {
    c.globalAlpha = 0.35;
    c.fillStyle = '#efe6d2';
    circle(c, IN.joy.ox, IN.joy.oy, 46 * u);
    c.globalAlpha = 0.7;
    const dx = IN.joy.x - IN.joy.ox,
      dy = IN.joy.y - IN.joy.oy,
      d = Math.hypot(dx, dy),
      k = Math.min(1, (46 * u) / (d || 1));
    circle(c, IN.joy.ox + dx * k, IN.joy.oy + dy * k, 20 * u);
    c.globalAlpha = 1;
  }
}
function bar(c, x, y, w, h, k, col, txt, extra = 0) {
  c.fillStyle = '#0a0608';
  c.fillRect(x - 2, y - 2, w + 4, h + 4);
  c.fillStyle = '#2a1f20';
  c.fillRect(x, y, w, h);
  c.fillStyle = col;
  c.fillRect(x, y, w * clamp(k, 0, 1), h);
  if (extra > 0) {
    c.fillStyle = 'rgba(255,224,138,0.8)';
    c.fillRect(x, y, w * clamp(extra, 0, 1), Math.max(2, h * 0.35));
  }
  if (txt) {
    c.font = `bold ${h * 0.8}px sans-serif`;
    c.fillStyle = '#efe6d2';
    c.textAlign = 'center';
    c.fillText(txt, x + w / 2, y + h * 0.82);
    c.textAlign = 'left';
  }
}
function btn(c, B, img, cd, dim, label) {
  const u = R_.u;
  c.fillStyle = 'rgba(20,12,16,0.75)';
  circle(c, B.x, B.y, B.r);
  c.strokeStyle = dim ? '#4a3a30' : '#a8865a';
  c.lineWidth = 2 * u;
  c.beginPath();
  c.arc(B.x, B.y, B.r, 0, Math.PI * 2);
  c.stroke();
  if (img) {
    const s = Math.floor((B.r * 1.15) / img.width) || 1;
    c.globalAlpha = dim ? 0.4 : 1;
    c.drawImage(img, Math.round(B.x - (img.width * s) / 2), Math.round(B.y - (img.height * s) / 2), img.width * s, img.height * s);
    c.globalAlpha = 1;
  }
  if (cd > 0) {
    c.fillStyle = 'rgba(10,6,8,0.6)';
    c.beginPath();
    c.moveTo(B.x, B.y);
    c.arc(B.x, B.y, B.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cd);
    c.fill();
  }
  if (label) {
    c.font = `${9 * u}px sans-serif`;
    c.fillStyle = '#a89a86';
    c.textAlign = 'center';
    c.fillText(label, B.x, B.y + B.r + 11 * u);
    c.textAlign = 'left';
  }
}
function drawMinimap(c, w, u) {
  const m = w.map,
    p = w.p;
  const cur = m.rooms.find(r => p.x >= r.x0 * TILE && p.x < (r.x0 + ROOM_W) * TILE && p.y >= r.y0 * TILE && p.y < (r.y0 + ROOM_H) * TILE);
  if (cur) R_.seen.add(cur);
  const s = 3 * u,
    cv = R_.cv;
  const gw = m.w / ROOM_W,
    gh = m.h / ROOM_H;
  const X0 = cv.width - 12 * u - 40 * u - gw * 6 * s,
    Y0 = 12 * u;
  for (const r of m.rooms) {
    if (!R_.seen.has(r)) continue;
    const x = X0 + (r.x0 / ROOM_W) * 6 * s,
      y = Y0 + (r.y0 / ROOM_H) * 5 * s;
    c.fillStyle = r === cur ? '#efe6d2' : r.kind === 'boss' ? '#c23b2a' : r.kind === 'exit' ? '#e0b048' : '#5a4a40';
    c.fillRect(x, y, 5 * s, 4 * s);
  }
}
