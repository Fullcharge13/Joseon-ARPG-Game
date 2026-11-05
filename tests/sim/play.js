// 자동 플레이: 봇이 마을 ↔ 백귀사를 오가며 업 단계를 올린다. 화면 없이 Node 에서.
//   node tests/sim/play.js [판 수=12] [보스 처치 목표=3]
const {load} = require('../harness');
const N = +process.argv[2] || 12,
  GOAL = +process.argv[3] || 3;
const DT = 1 / 60;

function bfsPath(G, m, sx, sy, goal) {
  // goal(tx,ty) → true 인 칸까지 길(칸 목록)
  const W = m.w,
    prev = new Int32Array(W * m.h).fill(-1),
    s = sy * W + sx;
  prev[s] = s;
  const q = [s];
  let qi = 0;
  while (qi < q.length) {
    const c = q[qi++],
      x = c % W,
      y = (c / W) | 0;
    if (goal(x, y)) {
      const out = [];
      for (let k = c; k !== s; k = prev[k]) out.push([k % W, (k / W) | 0]);
      return out.reverse();
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ]) {
      const nx = x + dx,
        ny = y + dy,
        n = ny * W + nx;
      if (prev[n] === -1 && G.walkable(m, nx, ny)) (prev[n] = c), q.push(n);
    }
  }
  return null;
}

function spendPoints(G, ch, reset) {
  // 수련: 화염부·한설·일필휘지·먹탄·결계 순, 3단계에서 갈래
  const order = ['hwa', 'hanseol', 'ilpil', 'hwa', 'hwa', 'hanseol', 'hanseol', 'meok', 'meok', 'ilpil', 'ilpil', 'gyeol', 'hwa', 'hanseol', 'meok', 'meok', 'ilpil', 'ilpil', 'gyeol', 'gyeol', 'gyeol', 'gyeol'];
  if (reset) G.respec(ch);
  for (const id of order) {
    if (G.freePoints(ch) <= 0) break;
    const want = order.slice(0, order.indexOf(id) + 1).filter(x => x === id).length;
    if ((ch.skills[id] ? ch.skills[id].rank : 0) < want + (id === 'meok' ? 1 : 0)) G.learn(ch, id);
  }
  while (G.freePoints(ch) > 0 && G.SKILL_IDS.some(id => (ch.skills[id] ? ch.skills[id].rank : 0) < G.SKILL_MAX)) G.learn(ch, G.SKILL_IDS.find(id => (ch.skills[id] ? ch.skills[id].rank : 0) < G.SKILL_MAX));
  const br = {hwa: 1, hanseol: 2, ilpil: 1, meok: 1, gyeol: 1};
  for (const id in ch.skills) if (ch.skills[id].rank >= 3 && !ch.skills[id].br) G.chooseBranch(ch, id, br[id]);
  const S = G.calcStats(ch);
  const want = ['meok', 'hwa', 'hanseol', 'ilpil', 'gyeol'].filter(id => (S.ranks[id] || 0) > 0);
  ch.slots = [0, 1, 2, 3].map(i => want[i] || null);
}
function townPrep(G, ch, rng) {
  // 1) 더 좋은 장비로 갈아입기(욕심쟁이: 점수가 오르면 입는다)
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < ch.bag.length; i++) {
      const it = ch.bag[i];
      const tmp = {...ch, equip: {...ch.equip, [it.slot]: it}};
      if (G.gearScore(tmp) > G.gearScore(ch) * 1.001) {
        const old = ch.equip[it.slot];
        ch.bag.splice(i, 1);
        if (old) ch.bag.push(old);
        ch.equip[it.slot] = it;
        changed = true;
        break;
      }
    }
  }
  // 2) 남은 것 팔기
  for (const it of ch.bag) ch.gold += G.sellPrice(it);
  ch.bag.length = 0;
  spendPoints(G, ch, true);
  // 4) 엽전이 넉넉하면 무기 옵션 하나를 피해 쪽으로 굴려 본다
  const wpn = ch.equip.weapon;
  if (wpn && wpn.affixes.length) {
    const bad = wpn.affixes.findIndex(a => !['dmg', 'fire', 'crit', 'critdmg', 'r_hwa'].includes(a.k));
    if (bad >= 0 && ch.gold > G.rerollCost(wpn) * 3) {
      ch.gold -= G.rerollCost(wpn);
      ch.equip.weapon = G.rerollAffix(rng, wpn, bad);
    }
  }
}

function botInput(G, w, B) {
  const p = w.p,
    m = w.map;
  const inp = {mx: 0, my: 0, aim: null, cast: [false, false, false, false], dodge: false};
  // 예고 안이면 빠져나간다(곧 터지면 회피)
  for (const T of w.tele) {
    const inside = T.kind === 'circle' ? G.dist2(p.x, p.y, T.x, T.y) < (T.r + p.r + 4) ** 2 : G.segDist2(p.x, p.y, T.x, T.y, T.x2, T.y2) < (T.wd / 2 + p.r + 4) ** 2;
    if (!inside) continue;
    // 16방향 중 막히지 않고, 예고 범위 밖으로 가장 멀리 나가는 쪽(사람이 보고 피하듯)
    let best = null,
      bs = -1e9;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2,
        dx = Math.cos(a),
        dy = Math.sin(a);
      let ok = true;
      for (const s of [8, 20, 34, 50]) if (G.solidAt(m, p.x + dx * s, p.y + dy * s, p.r)) ok = false;
      if (!ok) continue;
      const qx = p.x + dx * 50,
        qy = p.y + dy * 50;
      const sc = T.kind === 'circle' ? Math.hypot(qx - T.x, qy - T.y) : Math.sqrt(G.segDist2(qx, qy, T.x, T.y, T.x2, T.y2));
      if (sc > bs) (bs = sc), (best = [dx, dy]);
    }
    const [ax, ay] = best || [Math.cos(w.t), Math.sin(w.t)];
    inp.mx = ax;
    inp.my = ay;
    if (T.t < 0.35) inp.dodge = true;
    return inp;
  }
  const live = w.ens.filter(e => !e.dead && !e.sleep);
  let near = null,
    nd = 1e9;
  for (const e of live) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < nd && d < 170 && G.lineClear(m, p.x, p.y, e.x, e.y)) (nd = d), (near = e);
  }
  if (near) {
    const S = w.S,
      sl = w.ch.slots;
    const cnt = r => live.filter(e => Math.hypot(e.x - p.x, e.y - p.y) < r).length;
    const want = {meok: true, hwa: p.ki >= 18, ilpil: nd < 115 && p.ki >= 28, hanseol: cnt(60) >= 3 || (near.boss && nd < 60), gyeol: p.hp < S.maxHp * 0.7 && !p.shield};
    for (let i = 0; i < 4; i++) if (sl[i] && want[sl[i]]) inp.cast[i] = true;
    // 거리 두기: 가까우면 물러나고 멀면 다가간다(물러날 때 벽이면 옆으로)
    const ax = (p.x - near.x) / nd,
      ay = (p.y - near.y) / nd;
    const kite = near.boss ? 75 : 55;
    if (nd < kite) {
      let mx = ax,
        my = ay;
      if (G.solidAt(m, p.x + mx * 10, p.y + my * 10, p.r)) (mx = -ay), (my = ax);
      if (G.solidAt(m, p.x + mx * 10, p.y + my * 10, p.r)) (mx = ay), (my = -ax);
      inp.mx = mx;
      inp.my = my;
    } else if (nd > 120) (inp.mx = -ax), (inp.my = -ay);
    else {
      // 사람처럼 옆으로 돌며 싸운다(멈춰 서서 날아오는 기운을 다 맞지 않게). 벽이면 방향을 바꾼다
      B.orbit = B.orbit || 1;
      let mx = -ay * B.orbit,
        my = ax * B.orbit;
      if (G.solidAt(m, p.x + mx * 10, p.y + my * 10, p.r)) (B.orbit *= -1), (mx = -mx), (my = -my);
      inp.mx = mx * 0.8;
      inp.my = my * 0.8;
    }
    // 날아오는 기운이 가까우면 옆으로 비킨다
    for (const h of w.hprojs) {
      const hd = Math.hypot(h.x - p.x, h.y - p.y);
      if (hd > 40) continue;
      const v = Math.hypot(h.vx, h.vy) || 1;
      inp.mx = -h.vy / v;
      inp.my = h.vx / v;
      if (G.solidAt(m, p.x + inp.mx * 8, p.y + inp.my * 8, p.r)) (inp.mx *= -1), (inp.my *= -1);
      break;
    }
    return inp;
  }
  // 길 찾기: 살아 있는 요괴가 있는 가장 가까운 방 → 없으면 출구(보스 방)
  B.repath -= DT;
  const tx = Math.floor(p.x / G.TILE),
    ty = Math.floor(p.y / G.TILE);
  if (B.repath <= 0 || !B.path || !B.path.length) {
    B.repath = 0.5;
    const alive = w.ens.filter(e => !e.dead);
    const bossFloor = m.rooms.some(r => r.kind === 'boss');
    const todo = new Set(alive.filter(e => !e.boss).map(e => Math.floor(e.y / G.TILE) * m.w + Math.floor(e.x / G.TILE)));
    const clearFirst = todo.size > 0 && (B.clearAll || (bossFloor && !w.bossDead && w.boss && w.boss.sleep && B.lvlLow));
    const goal = clearFirst ? (x, y) => todo.has(y * m.w + x) : w.boss && !w.bossDead ? (x, y) => Math.abs(x * G.TILE - w.boss.x) < 40 && Math.abs(y * G.TILE - w.boss.y) < 40 : (x, y) => x === m.exit.x && y === m.exit.y;
    B.path = bfsPath(G, m, tx, ty, goal) || bfsPath(G, m, tx, ty, (x, y) => x === m.exit.x && y === m.exit.y);
  }
  if (B.path && B.path.length) {
    while (B.path.length && B.path[0][0] === tx && B.path[0][1] === ty) B.path.shift();
    const nx = B.path[0] ? (B.path[0][0] + 0.5) * G.TILE : p.x,
      ny = B.path[0] ? (B.path[0][1] + 0.5) * G.TILE : p.y;
    const d = Math.hypot(nx - p.x, ny - p.y) || 1;
    inp.mx = (nx - p.x) / d;
    inp.my = (ny - p.y) / d;
  }
  // 막힘 풀기
  B.stuckT += DT;
  if (B.stuckT > 2) {
    if (Math.hypot(p.x - B.sx, p.y - B.sy) < 6) (B.wig = 0.4), (B.path = null);
    B.stuckT = 0;
    B.sx = p.x;
    B.sy = p.y;
  }
  if (B.wig > 0) {
    B.wig -= DT;
    inp.mx = Math.cos(w.t * 7);
    inp.my = Math.sin(w.t * 5);
  }
  return inp;
}

function runOne(seed) {
  const G = load();
  const rng = G.makeRng(seed * 977);
  const ch = G.newChar();
  const rep = {seed, floors: [], bosses: [], deaths: 0, simMin: 0};
  let tier = 1,
    kills = 0,
    t = 0,
    runSeed = seed * 1000;
  while (kills < GOAL && t < 60 * 90) {
    townPrep(G, ch, rng);
    runSeed++;
    let prevHp = null;
    for (let f = 1; f <= 3; f++) {
      const w = G.startFloor(ch, f, tier, runSeed * 10 + f);
      if (prevHp != null) w.p.hp = Math.min(w.S.maxHp, prevHp);
      const B = {repath: 0, path: null, stuckT: 0, sx: 0, sy: 0, wig: 0, clearAll: f < 3, lvlLow: true};
      const t0 = t;
      let ft = 0;
      while (w.state === 'play' && ft < 15 * 60) {
        const inp = botInput(G, w, B);
        G.update(w, DT, inp);
        if (w.events.some(e => e.k === 'lvl')) {
          spendPoints(G, ch, false); // 사람처럼 레벨이 오르면 그 자리에서 수련점을 찍는다
          G.refreshStats(w);
        }
        w.events.length = 0;
        ft += DT;
        t += DT;
      }
      const dmg = w.rs.dmg,
        tot = Object.values(dmg).reduce((a, b) => a + b, 0) || 1;
      rep.floors.push({tier, f, sec: Math.round(ft), lvl: ch.lvl, hpStart: Math.round(prevHp == null ? -1 : prevHp), state: w.state, taken: Math.round(w.rs.taken), maxHp: Math.round(w.S.maxHp), share: Object.fromEntries(Object.entries(dmg).map(([k, v]) => [k, v / tot])), kills: w.rs.kills, by: w.rs.takenBy, last: w.rs.lastSrc});
      if (w.bossDead) rep.bosses.push({tier, sec: Math.round(w.rs.bossT), lvl: ch.lvl, gear: G.SLOTS.map(s => (ch.equip[s] ? ch.equip[s].rar : -1))});
      prevHp = w.p.hp;
      if (w.state === 'dead') {
        rep.deaths++;
        ch.gold -= Math.floor(ch.gold * 0.1);
        break;
      }
      if (w.state === 'play') {
        rep.timeouts = (rep.timeouts || 0) + 1;
        break;
      }
      if (w.state === 'won') {
        kills++;
        tier++;
        ch.maxTier = Math.max(ch.maxTier, tier);
      }
      void t0;
    }
  }
  rep.simMin = Math.round(t / 6) / 10;
  rep.finalLvl = ch.lvl;
  return rep;
}

const med = a => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const reps = [];
for (let s = 1; s <= N; s++) reps.push(runOne(s));
const fl = reps.flatMap(r => r.floors.filter(f => f.state !== 'dead'));
const floorSec = [1, 2, 3].map(f => med(fl.filter(x => x.f === f && x.tier === 1).map(x => x.sec)));
const b1 = reps.map(r => r.bosses.find(b => b.tier === 1)).filter(Boolean);
const shareAll = {};
for (const f of fl) for (const [k, v] of Object.entries(f.share)) (shareAll[k] = shareAll[k] || []).push(v);
const shareMed = Object.fromEntries(Object.entries(shareAll).map(([k, v]) => [k, Math.round(med(v) * 100)]));
const maxShareTop = Math.max(...fl.map(f => Math.max(0, ...Object.values(f.share))));
const takenRatio = [];
for (const r of reps)
  for (let i = 1; i < r.floors.length; i++) {
    const a = r.floors[i - 1],
      b = r.floors[i];
    if (a.tier === b.tier && b.f === a.f + 1 && a.taken > 0) takenRatio.push(b.taken / a.taken);
  }
const out = {
  판: N,
  '업1 층 시간 중앙값(초) 1·2·3층': floorSec,
  '첫 보스 처치 시간 중앙값(초)': med(b1.map(b => b.sec)),
  '첫 보스 처치 레벨 중앙값': med(b1.map(b => b.lvl)),
  '첫 보스 처치 판 수': `${b1.length}/${N}`,
  '첫 보스 때 희귀 이상 장비 1개+': `${b1.filter(b => b.gear.some(r => r >= 2)).length}/${b1.length}`,
  '모든 보스 처치 시간 중앙값(초)': med(reps.flatMap(r => r.bosses.map(b => b.sec))),
  '보스 처치 수 중앙값': med(reps.map(r => r.bosses.length)),
  '쓰러짐 수 중앙값': med(reps.map(r => r.deaths)),
  '시간 초과 층 합계': reps.reduce((a, r) => a + (r.timeouts || 0), 0),
  '다음 층 받은 피해 비율 중앙값': Math.round(med(takenRatio) * 100) / 100,
  '피해 비중 중앙값(%)': shareMed,
  '한 층에서 가장 큰 피해 비중(최대)': Math.round(maxShareTop * 100) + '%',
  '끝난 레벨 중앙값': med(reps.map(r => r.finalLvl)),
  '시뮬레이션 시간 중앙값(분)': med(reps.map(r => r.simMin))
};
const deadF = reps.flatMap(r => r.floors.filter(f => f.state === 'dead'));
out['쓰러진 층(업-층)'] = Object.entries(deadF.reduce((a, f) => ((a[f.tier + '-' + f.f] = (a[f.tier + '-' + f.f] || 0) + 1), a), {})).map(([k, v]) => k + ':' + v).join(' ');
out['쓰러뜨린 마지막 공격'] = Object.entries(deadF.reduce((a, f) => ((a[f.last] = (a[f.last] || 0) + 1), a), {})).map(([k, v]) => k + ':' + v).join(' ');
const byAll = {};
for (const f of reps.flatMap(r => r.floors)) for (const [k, v] of Object.entries(f.by || {})) byAll[k] = (byAll[k] || 0) + v;
const byTot = Object.values(byAll).reduce((a, b) => a + b, 0) || 1;
out['받은 피해 출처(%)'] = Object.fromEntries(Object.entries(byAll).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round((v / byTot) * 100)]));
out['층마다 가장 큰 피해 비중 중앙값'] = Math.round(med(fl.map(f => Math.max(0, ...Object.values(f.share)))) * 100) + '%';
delete out['한 층에서 가장 큰 피해 비중(최대)'];
console.log(JSON.stringify(out, null, 1));
if (process.argv.includes('--detail')) for (const r of reps) console.log(r.seed, r.deaths, r.bosses.map(b => `업${b.tier}:${b.sec}s/Lv${b.lvl}`).join(' '), r.floors.map(f => `${f.tier}-${f.f}:${f.sec}s:${f.state[0]}`).join(' '));
