/* ======================= 던전: 방 조각 이어 붙이기 ======================= */
// 칸 번호: 0 바닥 · 1 벽 · 2 기둥 · 3 연못 · 4 등롱 · 5 계단
const TILE_OF = {'.': 0, '#': 1, o: 2, '~': 3, L: 4};
const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
];

function genFloor(seed, floor) {
  const rng = makeRng(seed * 7919 + floor * 104729);
  const n = ROOMS_PER_FLOOR[floor - 1];
  // 1) 방 자리: 무작위 걷기(이미 있는 방에서 옆으로 한 칸)
  const cells = [[0, 0]];
  const key = (x, y) => x + ',' + y;
  const has = new Set([key(0, 0)]);
  let guard = 0;
  while (cells.length < n && guard++ < 5000) {
    const [bx, by] = rng() < 0.6 ? cells[cells.length - 1] : pick(rng, cells);
    const [dx, dy] = pick(rng, DIRS);
    const nx = bx + dx,
      ny = by + dy;
    if (has.has(key(nx, ny))) continue;
    // 덩어리지지 않게: 새 칸의 이웃이 둘 이상이면 가끔만 허용
    const nb = DIRS.filter(([ax, ay]) => has.has(key(nx + ax, ny + ay))).length;
    if (nb > 1 && rng() < 0.7) continue;
    cells.push([nx, ny]);
    has.add(key(nx, ny));
  }
  // 2) 문: 걸어온 길(나무) + 이웃끼리 가끔 고리
  const doors = new Set();
  const dk = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  for (let i = 1; i < cells.length; i++) {
    const [x, y] = cells[i];
    const nbs = cells.slice(0, i).filter(([px, py]) => Math.abs(px - x) + Math.abs(py - y) === 1);
    doors.add(dk(key(x, y), key(...pick(rng, nbs))));
  }
  for (let i = 0; i < cells.length; i++)
    for (let j = i + 1; j < cells.length; j++) {
      const [ax, ay] = cells[i],
        [bx, by] = cells[j];
      if (Math.abs(ax - bx) + Math.abs(ay - by) === 1 && rng() < 0.25) doors.add(dk(key(ax, ay), key(bx, by)));
    }
  // 3) 출구: 시작에서 문을 따라 가장 먼 방
  const adj = {};
  for (const d of doors) {
    const [a, b] = d.split('|');
    (adj[a] = adj[a] || []).push(b);
    (adj[b] = adj[b] || []).push(a);
  }
  const depth = {[key(0, 0)]: 0};
  const q = [key(0, 0)];
  while (q.length) {
    const c = q.shift();
    for (const nb of adj[c] || []) if (!(nb in depth)) (depth[nb] = depth[c] + 1), q.push(nb);
  }
  let far = 0;
  cells.forEach(([x, y], i) => {
    if (depth[key(x, y)] > depth[key(...cells[far])]) far = i;
  });
  // 4) 지도로 옮기기
  const minX = Math.min(...cells.map(c => c[0])),
    minY = Math.min(...cells.map(c => c[1]));
  const gw = Math.max(...cells.map(c => c[0])) - minX + 1,
    gh = Math.max(...cells.map(c => c[1])) - minY + 1;
  const w = gw * ROOM_W,
    h = gh * ROOM_H;
  const tiles = new Array(w * h).fill(1);
  const names = Object.keys(ROOMS);
  const rooms = cells.map(([x, y], i) => {
    const boss = floor === FLOORS && i === far;
    const name = i === 0 ? '마당' : boss ? '보스' : pick(rng, names);
    const tpl = boss ? BOSS_ROOM : ROOMS[name];
    const x0 = (x - minX) * ROOM_W,
      y0 = (y - minY) * ROOM_H;
    for (let j = 0; j < ROOM_H; j++) for (let k = 0; k < ROOM_W; k++) tiles[(y0 + j) * w + x0 + k] = TILE_OF[tpl[j][k]];
    return {gx: x, gy: y, x0, y0, name, kind: i === 0 ? 'start' : boss ? 'boss' : i === far ? 'exit' : 'normal', depth: depth[key(x, y)]};
  });
  // 문 열기(폭 3칸). 문 앞 한 칸도 비워 막힘이 없게
  const open = (tx, ty) => (tiles[ty * w + tx] = 0);
  for (const d of doors) {
    const [a, b] = d.split('|').map(s => s.split(',').map(Number));
    const ra = rooms[cells.findIndex(c => c[0] === a[0] && c[1] === a[1])],
      rb = rooms[cells.findIndex(c => c[0] === b[0] && c[1] === b[1])];
    const [L, R] = ra.x0 < rb.x0 || ra.y0 < rb.y0 ? [ra, rb] : [rb, ra];
    if (L.y0 === R.y0) {
      // 좌우
      for (let k = -1; k <= 1; k++) {
        const ty = L.y0 + 5 + k;
        for (let tx = L.x0 + ROOM_W - 2; tx <= R.x0 + 1; tx++) open(tx, ty);
      }
    } else {
      for (let k = -1; k <= 1; k++) {
        const tx = L.x0 + 7 + k;
        for (let ty = L.y0 + ROOM_H - 2; ty <= R.y0 + 1; ty++) open(tx, ty);
      }
    }
  }
  const sr = rooms[0],
    er = rooms[far];
  const start = {x: sr.x0 + 7, y: sr.y0 + 5};
  tiles[start.y * w + start.x] = 0; // 시작 방은 늘 「마당」이라 가운데가 비어 있다
  // 막힘 칸에 갇힌 바닥(우물 가운데처럼)은 벽으로 메운다
  const m = {w, h, tiles, rooms, start, exit: null, floor, seed};
  const seen = floodFrom(m, start.x, start.y);
  for (let i = 0; i < tiles.length; i++) if (tiles[i] === 0 && !seen.has(i)) tiles[i] = 1;
  // 출구: 끝 방 가운데에서 가장 가까운, 걸어갈 수 있는 칸
  let best = null;
  for (let j = 1; j < ROOM_H - 1; j++)
    for (let k = 1; k < ROOM_W - 1; k++) {
      const tx = er.x0 + k,
        ty = er.y0 + j;
      if (!seen.has(ty * w + tx)) continue;
      const d = (k - 7) * (k - 7) + (j - 5) * (j - 5);
      if (!best || d < best.d) best = {x: tx, y: ty, d};
    }
  m.exit = {x: best.x, y: best.y};
  return m;
}
const walkable = (m, tx, ty) => tx >= 0 && ty >= 0 && tx < m.w && ty < m.h && (m.tiles[ty * m.w + tx] === 0 || m.tiles[ty * m.w + tx] === 5);
function floodFrom(m, sx, sy) {
  const seen = new Set([sy * m.w + sx]);
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of DIRS) {
      const nx = x + dx,
        ny = y + dy,
        i = ny * m.w + nx;
      if (!seen.has(i) && walkable(m, nx, ny)) seen.add(i), q.push([nx, ny]);
    }
  }
  return seen;
}
// 원(중심 x,y 반지름 r, 화면 단위)이 막힌 칸과 겹치는가
function solidAt(m, x, y, r) {
  const x0 = Math.floor((x - r) / TILE),
    x1 = Math.floor((x + r) / TILE),
    y0 = Math.floor((y - r) / TILE),
    y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++) {
      if (walkable(m, tx, ty)) continue;
      const cx = clamp(x, tx * TILE, tx * TILE + TILE),
        cy = clamp(y, ty * TILE, ty * TILE + TILE);
      if (dist2(x, y, cx, cy) < r * r) return true;
    }
  return false;
}
// 축마다 따로 움직여 벽을 따라 미끄러진다
function moveCircle(m, o, dx, dy) {
  if (dx && !solidAt(m, o.x + dx, o.y, o.r)) o.x += dx;
  if (dy && !solidAt(m, o.x, o.y + dy, o.r)) o.y += dy;
}
// 방 안 바닥 칸(문 근처·시작 근처 제외) 목록
function roomFloorTiles(m, room) {
  const out = [];
  for (let j = 2; j < ROOM_H - 2; j++)
    for (let k = 2; k < ROOM_W - 2; k++) {
      const tx = room.x0 + k,
        ty = room.y0 + j;
      if (m.tiles[ty * m.w + tx] === 0) out.push([tx, ty]);
    }
  return out;
}
// 시선이 막히는가(투사체·원거리 요괴·자동 조준이 모두 이것 하나를 쓴다).
// 선이 지나가는 칸을 빠짐없이 따라간다(Amanatides–Woo): 투사체 중심이 지나는 칸은 모두 이 안에 있다
const SIGHT_BLOCK = t => t === 1 || t === 2 || t === 4 || t === undefined;
function lineClear(m, ax, ay, bx, by) {
  let tx = Math.floor(ax / TILE),
    ty = Math.floor(ay / TILE);
  const ex = Math.floor(bx / TILE),
    ey = Math.floor(by / TILE);
  const dx = bx - ax,
    dy = by - ay;
  const sx = dx > 0 ? 1 : -1,
    sy = dy > 0 ? 1 : -1;
  const tdx = dx ? Math.abs(TILE / dx) : Infinity,
    tdy = dy ? Math.abs(TILE / dy) : Infinity;
  let tmx = dx ? ((dx > 0 ? (tx + 1) * TILE - ax : ax - tx * TILE) / Math.abs(dx)) : Infinity,
    tmy = dy ? ((dy > 0 ? (ty + 1) * TILE - ay : ay - ty * TILE) / Math.abs(dy)) : Infinity;
  for (let i = 0; i < 400; i++) {
    if (tx === ex && ty === ey) return true;
    if (tmx < tmy) (tmx += tdx), (tx += sx);
    else if (tmy < tmx) (tmy += tdy), (ty += sy);
    else {
      // 모서리를 정확히 지나면 양옆 칸도 본다
      if (SIGHT_BLOCK(m.tiles[ty * m.w + tx + sx]) || SIGHT_BLOCK(m.tiles[(ty + sy) * m.w + tx])) return false;
      (tmx += tdx), (tx += sx), (tmy += tdy), (ty += sy);
    }
    if (tx === ex && ty === ey) return true;
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h || SIGHT_BLOCK(m.tiles[ty * m.w + tx])) return false;
  }
  return false;
}
// 길 안내 지도: (sx,sy) 칸에서 걸어서 몇 칸인가(최대 maxD)
function flowField(m, sx, sy, maxD = 40) {
  const d = new Int16Array(m.w * m.h).fill(-1);
  const s = sy * m.w + sx;
  if (s < 0 || s >= d.length) return d;
  d[s] = 0;
  const q = [s];
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi],
      x = c % m.w,
      y = (c / m.w) | 0;
    if (d[c] >= maxD) continue;
    for (const [ax, ay] of DIRS) {
      const nx = x + ax,
        ny = y + ay,
        n = ny * m.w + nx;
      if (nx >= 0 && ny >= 0 && nx < m.w && ny < m.h && d[n] === -1 && walkable(m, nx, ny)) (d[n] = d[c] + 1), q.push(n);
    }
  }
  return d;
}
// 시험·연습용 빈 마당(가장자리만 벽)
function openMap(w, h) {
  const tiles = new Array(w * h).fill(0);
  for (let x = 0; x < w; x++) (tiles[x] = 1), (tiles[(h - 1) * w + x] = 1);
  for (let y = 0; y < h; y++) (tiles[y * w] = 1), (tiles[y * w + w - 1] = 1);
  return {w, h, tiles, rooms: [{x0: 0, y0: 0, kind: 'start', name: '연습'}], start: {x: 2, y: 2}, exit: {x: w - 3, y: h - 3}, floor: 0, seed: 0};
}
