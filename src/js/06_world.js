/* ======================= 전투 세계: update(dt) 한 곳 ======================= */
const CAP = {ens: 70, projs: 140, nums: 40, fx: 220};
const PICK_R = 16,
  DODGE_CD = 3,
  DODGE_T = 0.22,
  DODGE_SPD = 230,
  IFRAME = 0.32,
  AGGRO = 150,
  BOSS_CAP = 0.08,
  TELE_T = 0.8;
let sfx = () => {}; // 11_audio 가 바꿔 끼운다(Node 시험에서는 조용히)

function makeWorld(ch, map, o) {
  const S = calcStats(ch);
  const w = {
    ch,
    S,
    map,
    floor: o.floor,
    tier: o.tier,
    ml: monLevel(Math.max(1, o.floor), o.tier),
    seed: o.seed,
    rng: makeRng(o.seed * 31 + 7),
    t: 0,
    p: {x: (map.start.x + 0.5) * TILE, y: (map.start.y + 0.5) * TILE, r: 5, hp: S.maxHp, ki: S.maxKi, cds: {}, lock: null, face: 0, fx: 1, dodgeT: 0, dodgeCd: 0, iframe: 0, shield: null, burn: 0, walk: 0, hurtT: 0, castT: 0, vx: 0, vy: 0},
    ens: [],
    projs: [],
    hprojs: [],
    pools: [],
    later: [],
    drops: [],
    tele: [],
    fx: [],
    nums: [],
    events: [],
    rs: {dmg: {}, taken: 0, takenBy: {}, kills: 0, kiGot: 0, t0: 0, bossT: 0},
    boss: null,
    bossDead: false,
    state: 'play',
    shake: 0,
    hitstop: 0,
    godKi: false,
    fullMsgT: 0
  };
  return w;
}
function refreshStats(w) {
  const hpR = w.p.hp / w.S.maxHp;
  w.S = calcStats(w.ch);
  w.p.hp = Math.min(w.S.maxHp, Math.max(1, hpR * w.S.maxHp));
  w.p.ki = Math.min(w.S.maxKi, w.p.ki);
}

/* --- 층 시작: 지도 + 요괴 배치 --- */
function startFloor(ch, floor, tier, seed) {
  const map = genFloor(seed, floor);
  const w = makeWorld(ch, map, {floor, tier, seed});
  const rng = makeRng(seed * 131 + floor);
  const ids = Object.keys(ENEMIES);
  for (const room of map.rooms) {
    if (room.kind === 'start') continue;
    const spots = roomFloorTiles(map, room);
    if (room.kind === 'boss') {
      const b = spawnBoss(w, (room.x0 + 7.5) * TILE, (room.y0 + 4.5) * TILE);
      b.sleep = true;
      continue;
    }
    // 방마다 무리 2~3개(무리는 같은 종류)
    const learning = tier === 1 && floor === 1; // 업 1단계 1층: 익히는 층
    const groups = learning ? (room.depth <= 1 ? 1 : 2) : rint(rng, 2, 3) + (floor >= 2 ? 1 : 0) + (room.depth > 2 ? 1 : 0);
    for (let g = 0; g < groups; g++) {
      const id = pick(rng, ids.slice(0, Math.min(ids.length, 2 + floor + (tier > 1 ? 2 : 0))));
      const [tx, ty] = pick(rng, spots);
      const n = ENEMIES[id].ai === 'swarm' ? (learning ? rint(rng, 3, 4) : rint(rng, 4, 6)) : learning && room.depth <= 1 ? 2 : rint(rng, 2, 3);
      for (let i = 0; i < n; i++) {
        const [x, y] = freeSpot(map, (tx + 0.5) * TILE, (ty + 0.5) * TILE, ENEMIES[id].r, rng);
        spawnEnemy(w, id, x, y, {sleep: 1, force: 1});
      }
    }
    const eliteOk = !(tier === 1 && floor === 1) || room.kind === 'exit'; // 갓 시작한 선비 보호
    if (eliteOk && (rng() < 0.3 + 0.1 * floor || room.kind === 'exit')) {
      const [tx, ty] = pick(rng, spots);
      const mods = Object.keys(ELITE_MODS);
      const m1 = pick(rng, mods);
      const elite = floor >= 3 && rng() < 0.4 ? [m1, pick(rng, mods.filter(m => m !== m1))] : [m1];
      spawnEnemy(w, pick(rng, ids.slice(2)), (tx + 0.5) * TILE, (ty + 0.5) * TILE, {sleep: 1, elite, force: 1});
    }
  }
  return w;
}

// 칸 중심 둘레 ±10px 안에서 막히지 않은 자리(못 찾으면 칸 중심: 칸 중심은 늘 바닥)
function freeSpot(m, cx, cy, r, rng) {
  for (let k = 0; k < 8; k++) {
    const x = cx + rint(rng, -10, 10),
      y = cy + rint(rng, -10, 10);
    if (!solidAt(m, x, y, r)) return [x, y];
  }
  return [cx, cy];
}
function spawnEnemy(w, id, x, y, o = {}) {
  const D = ENEMIES[id];
  const mm = monMul(w.ml);
  const e = {id, D, x, y, r: D.r, hp: D.hp * MON_HP * mm.hp, maxHp: D.hp * MON_HP * mm.hp, dmg: D.dmg * mm.dmg, spd: D.spd, ai: D.ai, atkCd: 0, st: 0, stT: 0, slow: 0, slowT: 0, root: 0, burn: null, dr: 0, still: !!o.still, sleep: !!o.sleep, elite: o.elite || null, hitT: 0, vx: 0, vy: 0, wob: w.rng() * 6, xp: D.xp};
  if (e.elite) {
    e.hp = e.maxHp = e.maxHp * ELITE_HP;
    e.dmg *= ELITE_DMG;
    e.r += 1;
    e.xp *= 4;
    for (const m of e.elite) ELITE_MODS[m].ap(e);
  }
  if (w.ens.length < CAP.ens || o.force) w.ens.push(e);
  return e;
}
function spawnBoss(w, x, y) {
  const mm = monMul(w.ml);
  const b = {id: BOSS.id, D: BOSS, boss: true, x, y, r: BOSS.r, hp: BOSS.hp * mm.hp, maxHp: BOSS.hp * mm.hp, dmg: BOSS.dmg * mm.dmg, spd: BOSS.spd, ai: 'boss', atkCd: 2, st: 0, stT: 0, slow: 0, slowT: 0, root: 0, burn: null, dr: 0, still: false, sleep: false, hitT: 0, capT: 0, capUsed: 0, xp: BOSS.xp, phase: 1, dash: null};
  w.ens.push(b);
  w.boss = b;
  return b;
}

/* --- 자동 조준: 잡은 대상 유지 → 없으면 가장 가까운(시선 열린) 적 --- */
function autoTarget(w, range) {
  const p = w.p;
  const ok = e => e && !e.dead && e.hp > 0 && !e.sleep && dist2(p.x, p.y, e.x, e.y) <= (range + e.r) * (range + e.r) && lineClear(w.map, p.x, p.y, e.x, e.y);
  if (ok(p.lock)) return p.lock;
  let best = null,
    bd = Infinity;
  for (const e of w.ens) {
    if (!ok(e)) continue;
    const d = dist2(p.x, p.y, e.x, e.y) - (e.boss ? 900 : 0); // 보스를 조금 더 먼저
    if (d < bd) (bd = d), (best = e);
  }
  p.lock = best;
  return best;
}

/* --- 피해: 요괴에게는 hurt 하나로만 --- */
function hurt(w, e, amt, src, type, o = {}) {
  if (e.dead || amt <= 0) return 0;
  let crit = false;
  if (!o.nocrit && w.rng() * 100 < w.S.crit) {
    amt *= 1 + w.S.critDmg / 100;
    crit = true;
  }
  amt *= 1 - e.dr;
  if (e.frozen > 0) amt *= 1.2; // 얼음 감옥
  if (e.boss) {
    if (w.t - e.capT >= 1) (e.capT = w.t), (e.capUsed = 0);
    const room = e.maxHp * BOSS_CAP - e.capUsed;
    amt = Math.max(0, Math.min(amt, room));
    e.capUsed += amt;
  }
  amt = Math.min(amt, e.hp);
  e.hp -= amt;
  e.sleep = false;
  e.hitT = 0.12;
  w.rs.dmg[src] = (w.rs.dmg[src] || 0) + amt;
  if (type === 'fire' && !o.noStatus) e.burn = {dps: (amt / (crit ? 1 + w.S.critDmg / 100 : 1)) * 0.2, t: 3, src};
  if (type === 'cold' && !o.noStatus) (e.slow = Math.max(e.slow, 0.4)), (e.slowT = 2);
  if (amt >= 1 && w.nums.length < CAP.nums && !o.quiet) w.nums.push({x: e.x + (w.rng() - 0.5) * 6, y: e.y - e.r - 4, v: Math.round(amt), t: 0.7, crit, type});
  if (e.hp <= 0.0001) killEnemy(w, e);
  return amt;
}
function killEnemy(w, e) {
  if (e.dead) return;
  e.dead = true;
  e.hp = 0;
  w.rs.kills++;
  if (w.p.lock === e) w.p.lock = null;
  const ups = gainXp(w.ch, Math.round(e.xp * XP_MUL * Math.pow(1.1, w.ml - 1)));
  if (ups) {
    w.events.push({k: 'lvl', lvl: w.ch.lvl});
    refreshStats(w);
    w.p.hp = w.S.maxHp;
    sfx('lvl');
  }
  burst(w, e.x, e.y, e.boss ? 40 : 8, e.D.A || '#fff');
  // 드롭
  const r = w.rng;
  if (r() < (e.boss ? 1 : e.elite ? 0.8 : 0.32)) dropGold(w, e.x, e.y, Math.round((e.boss ? 60 : e.elite ? 12 : 2 + r() * 3) * (1 + 0.15 * (w.ml - 1))));
  if (e.elite || (!e.boss && r() < 0.06)) dropPeach(w, e.x + (r() - 0.5) * 12, e.y + (r() - 0.5) * 12);
  const n = e.boss ? 3 : e.elite ? 1 : r() < 0.07 ? 1 : 0;
  for (let i = 0; i < n; i++) {
    const rar = rollRarity(r, e.boss ? 'b' : e.elite ? 'e' : 'n', w.tier);
    dropItem(w, e.x + (r() - 0.5) * 20, e.y + (r() - 0.5) * 20, rollItem(r, pick(r, SLOTS), w.ml, rar));
  }
  if (e.boss) {
    w.bossDead = true;
    w.rs.bossT = w.t - (w.rs.bossStart || w.t);
    w.events.push({k: 'boss'});
    w.shake = 0.6;
    sfx('boss');
    // 남은 요괴는 보상 없이 흩어지고, 떨어지던 공격도 모두 사라진다(이기고도 쓰러지지 않게)
    for (const o of w.ens)
      if (!o.dead && o !== e) {
        o.dead = true;
        burst(w, o.x, o.y, 4, '#8a8494');
      }
    w.tele.length = 0;
    w.hprojs.length = 0;
  } else sfx('kill');
}
function dropItem(w, x, y, item, o = {}) {
  w.drops.push({x, y, item, t: 0, hold: !!o.hold}); // hold: 플레이어가 내려놓은 것 — 한 번 떠나야 다시 줍는다
  if (item.rar >= 3) sfx('legend');
  else if (item.rar >= 2) sfx('rare');
}
// 복숭아: 민간에서 귀신을 쫓는다고 믿은 과일(한국민족문화대백과사전 「복숭아」). 주우면 체력 회복
const PEACH_HEAL = 0.22;
function dropPeach(w, x, y) {
  w.drops.push({x, y, peach: 1, t: 0});
}
function dropGold(w, x, y, n) {
  w.drops.push({x, y, gold: n, t: 0});
}

/* --- 플레이어가 맞음 --- */
function hurtPlayer(w, amt, src, type) {
  const p = w.p;
  if (w.state !== 'play' || p.iframe > 0 || p.dodgeT > 0 || amt <= 0) return 0;
  amt *= 1 - armorReduce(w.S.armor, w.ml);
  if (p.shield) {
    const ab = Math.min(p.shield.amt, amt);
    p.shield.amt -= ab;
    amt -= ab;
    if (p.shield.amt <= 0.0001) breakShield(w);
  }
  if (type === 'fire') p.burn = 2;
  p.hp -= amt;
  w.rs.taken += amt;
  w.rs.takenBy[src] = (w.rs.takenBy[src] || 0) + amt;
  w.rs.lastSrc = src;
  p.hurtT = 0.15;
  if (amt > 0) {
    w.shake = Math.max(w.shake, 0.12);
    sfx('hurt');
  }
  if (p.hp <= 0) {
    p.hp = 0;
    w.state = 'dead';
    w.events.push({k: 'dead'});
  }
  return amt;
}
function breakShield(w) {
  const p = w.p;
  if (!p.shield) return;
  if (w.S.legends.includes('gyeolBurst')) {
    const dmg = w.S.power * 4 * (1 + (w.S.dmgPct + w.S.firePct) / 100);
    for (const e of w.ens) if (!e.dead && !e.sleep && dist2(p.x, p.y, e.x, e.y) < (60 + e.r) ** 2) hurt(w, e, dmg, 'gyeolBurst', 'fire');
    ring(w, p.x, p.y, 60, '#ff9a3a');
  }
  p.shield = null;
}

/* --- 보스 공격(예고 → 실행) --- */
function bossAttack(w, b, kind) {
  const p = w.p;
  if (kind === 'slam') w.tele.push({kind: 'circle', x: p.x, y: p.y, r: 42, t: TELE_T, total: TELE_T, dmg: b.dmg * 2.2, owner: b});
  else if (kind === 'charge') {
    const a = Math.atan2(p.y - b.y, p.x - b.x);
    let L = 170;
    // 돌진은 벽에서 멈추므로 예고선도 벽에서 자른다
    for (let s = 4; s <= 170; s += 4)
      if (solidAt(w.map, b.x + Math.cos(a) * s, b.y + Math.sin(a) * s, b.r * 0.6)) {
        L = Math.max(8, s - 4);
        break;
      }
    w.tele.push({kind: 'line', x: b.x, y: b.y, x2: b.x + Math.cos(a) * L, y2: b.y + Math.sin(a) * L, wd: 26, t: TELE_T, total: TELE_T, dmg: b.dmg * 1.8, owner: b, a});
  } else if (kind === 'summon') {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const x = b.x + Math.cos(a) * 34,
        y = b.y + Math.sin(a) * 34;
      if (!solidAt(w.map, x, y, 5)) spawnEnemy(w, 'gwihwa', x, y, {force: 1});
    }
    burst(w, b.x, b.y, 14, '#8fd3ff');
  }
  b.st = kind;
}
const segDist2 = (px, py, x1, y1, x2, y2) => {
  const dx = x2 - x1,
    dy = y2 - y1,
    L = dx * dx + dy * dy || 1;
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / L, 0, 1);
  return dist2(px, py, x1 + dx * t, y1 + dy * t);
};
function fireTele(w, T) {
  const p = w.p;
  if (T.owner && T.owner.dead) return;
  if (T.kind === 'circle') {
    if (dist2(p.x, p.y, T.x, T.y) < (T.r + p.r) ** 2) hurtPlayer(w, T.dmg, 'boss:내려찍기', 'phys');
    ring(w, T.x, T.y, T.r, '#ff5a3a');
    w.shake = Math.max(w.shake, 0.3);
    sfx('slam');
  } else if (T.kind === 'line' && !T.owner.dead) T.owner.dash = {a: T.a, t: 0.42, hit: false, dmg: T.dmg};
}

/* --- 효과 그림 도움 --- */
function burst(w, x, y, n, c) {
  for (let i = 0; i < n && w.fx.length < CAP.fx; i++) {
    const a = w.rng() * Math.PI * 2,
      s = 20 + w.rng() * 60;
    w.fx.push({k: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0.4 + w.rng() * 0.3, c});
  }
}
function ring(w, x, y, r, c) {
  if (w.fx.length < CAP.fx) w.fx.push({k: 'ring', x, y, r, t: 0.3, T: 0.3, c});
}

/* --- 한 걸음 --- */
function update(w, dt, inp) {
  if (w.state !== 'play') return;
  if (w.hitstop > 0) {
    w.hitstop -= dt;
    return;
  }
  w.t += dt;
  const p = w.p,
    S = w.S;
  // 이동·회피
  p.dodgeCd = Math.max(0, p.dodgeCd - dt);
  p.iframe = Math.max(0, p.iframe - dt);
  p.hurtT = Math.max(0, p.hurtT - dt);
  p.castT = Math.max(0, p.castT - dt);
  let mx = inp.mx || 0,
    my = inp.my || 0;
  const ml = Math.hypot(mx, my);
  if (ml > 1) (mx /= ml), (my /= ml);
  if (inp.dodge && p.dodgeCd <= 0 && p.dodgeT <= 0) {
    const a = ml > 0.1 ? Math.atan2(my, mx) : p.face;
    p.dodgeT = DODGE_T;
    p.dodgeA = a;
    p.dodgeCd = DODGE_CD;
    p.iframe = IFRAME;
    sfx('dodge');
  }
  if (p.dodgeT > 0) {
    p.dodgeT -= dt;
    moveCircle(w.map, p, Math.cos(p.dodgeA) * DODGE_SPD * dt, Math.sin(p.dodgeA) * DODGE_SPD * dt);
  } else if (ml > 0.05) {
    const sp = S.moveFinal * (p.burn > 0 ? 1 : 1);
    moveCircle(w.map, p, mx * sp * dt, my * sp * dt);
    p.face = Math.atan2(my, mx);
    if (Math.abs(mx) > 0.1) p.fx = mx > 0 ? 1 : -1;
    p.walk += dt;
  }
  // 회복
  const kiMul = p.shield && S.branches.gyeol === 2 ? 2 : 1;
  p.ki = Math.min(S.maxKi, p.ki + S.kiRegenFinal * kiMul * dt);
  if (w.godKi) p.ki = S.maxKi;
  p.hp = Math.min(S.maxHp, p.hp + S.regen * dt);
  if (p.burn > 0) {
    p.burn -= dt;
    p.hp -= w.S.maxHp * 0.02 * dt;
    w.rs.taken += w.S.maxHp * 0.02 * dt;
    if (p.hp <= 0) (p.hp = 0), (w.state = 'dead'), w.events.push({k: 'dead'});
  }
  if (p.shield) {
    p.shield.t -= dt;
    if (p.shield.t <= 0) breakShield(w);
  }
  // 스킬
  for (const id in p.cds) p.cds[id] = Math.max(0, p.cds[id] - dt);
  if (p.dodgeT <= 0) for (let i = 0; i < 4; i++) if (inp.cast && inp.cast[i] && w.ch.slots[i]) castSkill(w, w.ch.slots[i], inp.aim);
  // 늦게 터지는 것
  for (let i = w.later.length - 1; i >= 0; i--) {
    const L = w.later[i];
    L.t -= dt;
    if (L.t <= 0) {
      L.fn();
      w.later.splice(i, 1);
    }
  }
  w.flowT = (w.flowT || 0) - dt;
  if (w.flowT <= 0) {
    w.flowT = 0.4;
    w.flow = flowField(w.map, Math.floor(p.x / TILE), Math.floor(p.y / TILE));
  }
  updateProjs(w, dt);
  updatePools(w, dt);
  updateEnemies(w, dt);
  // 예고
  for (let i = w.tele.length - 1; i >= 0; i--) {
    const T = w.tele[i];
    T.t -= dt;
    if (T.t <= 0) {
      w.tele.splice(i, 1);
      fireTele(w, T);
    }
  }
  // 줍기
  for (let i = w.drops.length - 1; i >= 0; i--) {
    const d = w.drops[i];
    d.t += dt;
    if (d.hold) {
      if (dist2(p.x, p.y, d.x, d.y) > (PICK_R + 12) ** 2) d.hold = false;
      continue;
    }
    if (dist2(p.x, p.y, d.x, d.y) > PICK_R * PICK_R) continue;
    if (d.peach) {
      w.p.hp = Math.min(w.S.maxHp, w.p.hp + w.S.maxHp * PEACH_HEAL);
      w.drops.splice(i, 1);
      sfx('pick');
      if (w.fx.length < CAP.fx) w.fx.push({k: 'ring', x: p.x, y: p.y - 5, r: 10, t: 0.3, T: 0.3, c: '#ff9aa8'});
    } else if (d.gold) {
      w.ch.gold += d.gold;
      w.drops.splice(i, 1);
      sfx('coin');
    } else if (w.ch.bag.length < BAG_MAX) {
      w.ch.bag.push(d.item);
      w.drops.splice(i, 1);
      w.events.push({k: 'pick', item: d.item});
      sfx('pick');
    } else if (w.t - w.fullMsgT > 2) {
      w.fullMsgT = w.t;
      w.events.push({k: 'full'});
    }
  }
  // 효과
  for (let i = w.fx.length - 1; i >= 0; i--) {
    const f = w.fx[i];
    f.t -= dt;
    if (f.vx !== undefined) (f.x += f.vx * dt), (f.y += f.vy * dt), (f.vx *= 0.9), (f.vy *= 0.9);
    if (f.t <= 0) w.fx.splice(i, 1);
  }
  for (let i = w.nums.length - 1; i >= 0; i--) {
    const n = w.nums[i];
    n.t -= dt;
    n.y -= 18 * dt;
    if (n.t <= 0) w.nums.splice(i, 1);
  }
  w.shake = Math.max(0, w.shake - dt);
  if (w.ens.length > 40) w.ens = w.ens.filter(e => !e.dead);
  // 층 끝
  const ex = (w.map.exit.x + 0.5) * TILE,
    ey = (w.map.exit.y + 0.5) * TILE;
  const bossFloor = w.map.rooms.some(r => r.kind === 'boss');
  if ((!bossFloor || w.bossDead) && dist2(p.x, p.y, ex, ey) < 12 * 12) {
    w.state = w.bossDead ? 'won' : 'clear';
    w.events.push({k: w.state});
  }
}

function updateProjs(w, dt) {
  for (let i = w.projs.length - 1; i >= 0; i--) {
    const pr = w.projs[i];
    const ox = pr.x,
      oy = pr.y; // 지나온 선분 전체로 맞음 판정(겹친 요괴·빠른 투사체도 건너뛰지 않게)
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.life -= dt;
    let end = pr.life <= 0;
    const t = w.map.tiles[Math.floor(pr.y / TILE) * w.map.w + Math.floor(pr.x / TILE)];
    if (t === 1 || t === 2 || t === 4 || t === undefined) end = true;
    if (!end)
      for (const e of w.ens) {
        if (e.dead || e.sleep || pr.hit.has(e)) continue;
        if (segDist2(e.x, e.y, ox, oy, pr.x, pr.y) < (pr.r + e.r) ** 2 || (pr.age === 0 && dist2(w.p.x, w.p.y, e.x, e.y) < (pr.r + e.r + 6) ** 2)) {
          pr.hit.add(e);
          if (pr.boom) {
            end = true;
            break;
          }
          hurt(w, e, pr.dmg, pr.src, pr.type);
          if (pr.splash) {
            for (const o of w.ens) if (!o.dead && o !== e && dist2(e.x, e.y, o.x, o.y) < (pr.splash.r + o.r) ** 2) hurt(w, o, pr.dmg * pr.splash.part, pr.src, pr.type, {quiet: 1});
            ring(w, e.x, e.y, pr.splash.r, '#2a2230');
          }
          if (pr.pierce-- <= 0) {
            end = true;
            break;
          }
        }
      }
    pr.age = (pr.age || 0) + 1;
    if (end) {
      if (pr.boom) pr.boom(pr.x, pr.y);
      w.projs.splice(i, 1);
    }
  }
  // 요괴 투사체
  const p = w.p;
  for (let i = w.hprojs.length - 1; i >= 0; i--) {
    const h = w.hprojs[i];
    h.x += h.vx * dt;
    h.y += h.vy * dt;
    h.life -= dt;
    const t = w.map.tiles[Math.floor(h.y / TILE) * w.map.w + Math.floor(h.x / TILE)];
    let end = h.life <= 0 || t === 1 || t === 2 || t === 4 || t === undefined;
    if (!end && dist2(h.x, h.y, p.x, p.y) < (h.r + p.r) ** 2) {
      hurtPlayer(w, h.dmg, h.src, 'phys');
      end = true;
    }
    if (end) w.hprojs.splice(i, 1);
  }
}
function updatePools(w, dt) {
  for (let i = w.pools.length - 1; i >= 0; i--) {
    const P = w.pools[i];
    P.t -= dt;
    P.tick -= dt;
    if (P.tick <= 0) {
      P.tick += P.every;
      for (const e of w.ens) {
        if (e.dead || e.sleep) continue;
        const hit = P.line ? segDist2(e.x, e.y, P.x, P.y, P.x2, P.y2) < (P.wd / 2 + e.r) ** 2 : dist2(e.x, e.y, P.x, P.y) < (P.r + e.r) ** 2;
        if (!hit) continue;
        hurt(w, e, P.dmg, P.src, P.type, {quiet: 1});
        if (P.slow) (e.slow = Math.max(e.slow, P.slow)), (e.slowT = Math.max(e.slowT, 0.6));
      }
    }
    if (P.t <= 0) w.pools.splice(i, 1);
  }
}

function updateEnemies(w, dt) {
  const p = w.p;
  for (const e of w.ens) {
    if (e.dead) continue;
    e.hitT = Math.max(0, e.hitT - dt);
    if (e.burn) {
      e.burn.t -= dt;
      hurt(w, e, e.burn.dps * dt, e.burn.src, 'burn', {nocrit: 1, quiet: 1, noStatus: 1});
      if (e.burn && e.burn.t <= 0) e.burn = null;
      if (e.dead) continue;
    }
    if (e.slowT > 0) (e.slowT -= dt), e.slowT <= 0 && (e.slow = 0);
    if (e.root > 0) e.root -= dt;
    if (e.frozen > 0) e.frozen -= dt;
    if (e.still) continue;
    const d2 = dist2(e.x, e.y, p.x, p.y),
      d = Math.sqrt(d2);
    if (e.sleep) {
      if (d < AGGRO && lineClear(w.map, e.x, e.y, p.x, p.y)) {
        e.sleep = false;
        if (e.boss) (w.rs.bossStart = w.t), w.events.push({k: 'bossStart'});
        // 근처 같은 무리도 깨운다
        for (const o of w.ens) if (o.sleep && !o.boss && dist2(o.x, o.y, e.x, e.y) < 60 * 60) o.sleep = false;
      } else continue;
    }
    e.atkCd = Math.max(0, e.atkCd - dt);
    const sp = e.spd * (1 - e.slow) * (e.root > 0 ? 0 : 1);
    const ax = (p.x - e.x) / (d || 1),
      ay = (p.y - e.y) / (d || 1);
    let vx = 0,
      vy = 0;
    if (e.boss) {
      bossThink(w, e, dt, ax, ay, d, sp);
      continue;
    }
    switch (e.ai) {
      case 'zig':
        e.wob += dt * 4;
        vx = ax + Math.cos(e.wob) * 0.6 * -ay;
        vy = ay + Math.cos(e.wob) * 0.6 * ax;
        break;
      case 'shoot':
        if (d > 110) (vx = ax), (vy = ay);
        else if (d < 70) (vx = -ax), (vy = -ay);
        if (e.atkCd <= 0 && d < 170 && lineClear(w.map, e.x, e.y, p.x, p.y)) {
          e.atkCd = 2.2;
          if (w.hprojs.length < CAP.projs) w.hprojs.push({x: e.x, y: e.y, vx: ax * 95, vy: ay * 95, r: 3, dmg: e.dmg, life: 2.2, src: e.id});
        }
        break;
      case 'charge':
        if (e.st === 'wind') {
          e.stT -= dt;
          if (e.stT <= 0) (e.st = 'dash'), (e.stT = 0.45), (e.ca = Math.atan2(ay, ax));
        } else if (e.st === 'dash') {
          e.stT -= dt;
          vx = Math.cos(e.ca) * 3.6;
          vy = Math.sin(e.ca) * 3.6;
          if (e.stT <= 0) (e.st = 0), (e.atkCd = 1.6);
        } else {
          vx = ax;
          vy = ay;
          if (d < 100 && e.atkCd <= 0) (e.st = 'wind'), (e.stT = 0.5);
        }
        break;
      default:
        vx = ax;
        vy = ay;
    }
    if (e.st === 'wind') vx = vy = 0;
    // 서로 밀기(가벼운)
    for (const o of w.ens) {
      if (o === e || o.dead || o.boss) continue;
      const dd = dist2(e.x, e.y, o.x, o.y),
        rr = (e.r + o.r) * 0.9;
      if (dd < rr * rr && dd > 0.01) {
        const k = (rr - Math.sqrt(dd)) / rr;
        vx += ((e.x - o.x) / Math.sqrt(dd)) * k * 1.2;
        vy += ((e.y - o.y) / Math.sqrt(dd)) * k * 1.2;
      }
    }
    if (e.ai !== 'shoot' || d > 110) {
      e.lost = Math.max(0, (e.lost || 0) - dt);
      if (e.lost > 0 || !lineClear(w.map, e.x, e.y, p.x, p.y)) {
        const f = flowDir(w, e);
        if (f) (vx = f[0] + vx * 0.15), (vy = f[1] + vy * 0.15);
      }
    }
    if (d > e.r + p.r) {
      const ox = e.x,
        oy = e.y,
        want = Math.hypot(vx, vy) * sp * dt;
      moveEnemy(w, e, vx * sp * dt, vy * sp * dt);
      // 거의 못 움직였으면 잠시 길 안내 지도를 따른다
      if (want > 0.05 && Math.hypot(e.x - ox, e.y - oy) < want * 0.3) e.lost = 1;
    }
    if (e.burnTouch && d < e.r + p.r + 14) p.burn = Math.max(p.burn, 0.6); // 불타는 정예: 곁에 있으면 불탄다
    // 닿으면 피해
    if (d < e.r + p.r + 2 && e.atkCd <= 0) {
      hurtPlayer(w, e.dmg, e.id, e.burnTouch ? 'fire' : 'phys');
      e.atkCd = e.st === 'dash' ? 1.6 : 0.9;
    }
  }
}
// 길 안내 지도에서 더 가까운 이웃 칸 쪽 방향
function flowDir(w, e) {
  const F = w.flow;
  if (!F) return null;
  const m = w.map,
    tx = Math.floor(e.x / TILE),
    ty = Math.floor(e.y / TILE);
  const here = F[ty * m.w + tx];
  let best = null,
    bd = here < 0 ? 9999 : here;
  for (const [ax, ay] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1]
  ]) {
    const nx = tx + ax,
      ny = ty + ay,
      v = F[ny * m.w + nx];
    if (v < 0 || v >= bd) continue;
    if (ax && ay && (!walkable(m, tx + ax, ty) || !walkable(m, tx, ty + ay))) continue; // 모서리 가로지르기 금지
    bd = v;
    best = [nx, ny];
  }
  if (!best) return null;
  const gx = (best[0] + 0.5) * TILE - e.x,
    gy = (best[1] + 0.5) * TILE - e.y,
    L = Math.hypot(gx, gy) || 1;
  return [gx / L, gy / L];
}
function moveEnemy(w, e, dx, dy) {
  const x0 = e.x,
    y0 = e.y;
  if (e.D.fly) {
    // 날아다니는 요괴는 연못 위도 지나간다(벽·기둥은 못 지남)
    const t = w.map.tiles[Math.floor((e.y + dy) / TILE) * w.map.w + Math.floor((e.x + dx) / TILE)];
    if (t === 0 || t === 3 || t === 5) (e.x += dx), (e.y += dy);
  } else moveCircle(w.map, e, dx, dy);
  // 막혔으면 옆으로 비켜 간다
  if (Math.abs(e.x - x0) + Math.abs(e.y - y0) < Math.hypot(dx, dy) * 0.3) moveCircle(w.map, e, -dy * 0.8, dx * 0.8);
}
function bossThink(w, b, dt, ax, ay, d, sp) {
  const p = w.p;
  if (b.hp < b.maxHp * 0.5 && b.phase === 1) {
    b.phase = 2;
    w.events.push({k: 'phase'});
    ring(w, b.x, b.y, 50, '#ff5a3a');
  }
  if (b.dash) {
    b.dash.t -= dt;
    const before = {x: b.x, y: b.y};
    moveCircle(w.map, b, Math.cos(b.dash.a) * 330 * dt, Math.sin(b.dash.a) * 330 * dt);
    if (!b.dash.hit && dist2(b.x, b.y, p.x, p.y) < (b.r + p.r) ** 2) {
      b.dash.hit = true;
      hurtPlayer(w, b.dash.dmg, 'boss:돌진', 'phys');
    }
    if (b.dash.t <= 0 || (b.x === before.x && b.y === before.y)) b.dash = null;
    return;
  }
  if (w.tele.some(T => T.owner === b)) return; // 예고 중에는 서 있는다
  b.atkCd -= dt;
  if (b.atkCd <= 0) {
    const r = w.rng();
    bossAttack(w, b, r < 0.45 ? 'slam' : r < 0.8 ? 'charge' : 'summon');
    b.atkCd = b.phase === 2 ? 1.7 : 2.4;
    return;
  }
  if (d > b.r + p.r + 6) moveCircle(w.map, b, ax * sp * dt, ay * sp * dt);
  else if (b.touchCd === undefined || b.touchCd <= 0) {
    hurtPlayer(w, b.dmg, 'boss:몸통', 'phys');
    b.touchCd = 1;
  }
  if (b.touchCd > 0) b.touchCd -= dt;
}
