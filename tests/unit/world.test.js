const test = require('node:test');
const assert = require('node:assert/strict');
const {load} = require('../harness');
const G = load();
const NOIN = () => ({mx: 0, my: 0, aim: null, cast: [false, false, false, false], dodge: false});

function arena(ch) {
  const w = G.makeWorld(ch || G.newChar(), G.openMap(40, 30), {floor: 1, tier: 1, seed: 1});
  w.p.x = 100;
  w.p.y = 240;
  return w;
}
function step(w, sec, inp = NOIN) {
  for (let t = 0; t < sec; t += 1 / 60) G.update(w, 1 / 60, typeof inp === 'function' ? inp() : inp);
}

test('자동 조준: 잡은 대상이 살아 있고 사거리 안이면 더 가까운 적이 와도 유지', () => {
  const w = arena();
  const a = G.spawnEnemy(w, 'dokkaebi', 200, 240, {still: 1});
  assert.equal(G.autoTarget(w, 190), a);
  const b = G.spawnEnemy(w, 'dokkaebi', 140, 240, {still: 1});
  assert.equal(G.autoTarget(w, 190), a, '대상이 튀면 안 됨');
  a.hp = 0;
  a.dead = true;
  assert.equal(G.autoTarget(w, 190), b, '잡은 대상이 죽으면 가까운 적으로');
});

test('자동 조준: 사거리 밖이면 대상 없음', () => {
  const w = arena();
  G.spawnEnemy(w, 'dokkaebi', 500, 240, {still: 1});
  assert.equal(G.autoTarget(w, 190), null);
});

test('보스 내려찍기: 예고 0.8초 동안은 피해 없고, 끝나는 순간 범위 안이면 맞는다', () => {
  const w = arena();
  const boss = G.spawnBoss(w, 300, 240);
  boss.still = 1;
  G.bossAttack(w, boss, 'slam');
  const tele = w.tele[0];
  assert.ok(tele, '예고가 먼저 나온다');
  assert.ok(Math.abs(tele.total - 0.8) < 1e-9);
  const hp0 = w.p.hp;
  step(w, 0.75);
  assert.equal(w.p.hp, hp0, '예고 중 피해');
  step(w, 0.2);
  assert.ok(w.p.hp < hp0, '예고가 끝났는데 안 맞음');
});

test('보스 내려찍기: 예고를 보고 벗어나면 안 맞는다', () => {
  const w = arena();
  const boss = G.spawnBoss(w, 300, 240);
  boss.still = 1;
  G.bossAttack(w, boss, 'slam');
  const hp0 = w.p.hp;
  step(w, 1.0, () => ({...NOIN(), mx: 0, my: 1}));
  assert.equal(w.p.hp, hp0);
});

test('피해는 hurt 한 곳에서 출처별로 기록된다', () => {
  const w = arena();
  const e = G.spawnEnemy(w, 'dokkaebi', 150, 240, {still: 1});
  G.hurt(w, e, 5, 'meok', 'phys', {nocrit: 1});
  G.hurt(w, e, 3, 'hwa', 'fire', {nocrit: 1});
  assert.equal(w.rs.dmg.meok, 5);
  assert.ok(w.rs.dmg.hwa >= 3);
});

test('보스는 1초에 최대 체력의 8%까지만 깎인다', () => {
  const w = arena();
  const b = G.spawnBoss(w, 300, 240);
  for (let i = 0; i < 10; i++) G.hurt(w, b, b.maxHp, 'meok', 'phys', {nocrit: 1});
  assert.ok(b.maxHp - b.hp <= b.maxHp * 0.08 + 1e-6);
  step(w, 1.05);
  G.hurt(w, b, b.maxHp, 'meok', 'phys', {nocrit: 1});
  assert.ok(b.maxHp - b.hp <= b.maxHp * 0.16 + 1e-6);
});

test('정예 「단단한」은 받는 피해 35% 감소', () => {
  const w = arena();
  const a = G.spawnEnemy(w, 'dokkaebi', 150, 240, {still: 1});
  const b = G.spawnEnemy(w, 'dokkaebi', 150, 260, {still: 1, elite: ['dandan']});
  G.hurt(w, a, 10, 'meok', 'phys', {nocrit: 1});
  G.hurt(w, b, 10, 'meok', 'phys', {nocrit: 1});
  assert.equal(a.maxHp - a.hp, 10);
  assert.ok(Math.abs(b.maxHp - b.hp - 6.5) < 1e-9);
  assert.ok(b.maxHp > a.maxHp * 3, '정예는 체력이 많다');
});

test('회피 중에는 맞지 않는다', () => {
  const w = arena();
  const hp0 = w.p.hp;
  G.update(w, 1 / 60, {...NOIN(), mx: 1, dodge: true});
  G.hurtPlayer(w, 30, 'test', 'phys');
  assert.equal(w.p.hp, hp0);
});

// 같은 시드로 정해진 전투를 돌려 결과를 숫자로 낸다(옵션·전설이 실제로 무언가 바꾸는지 보는 탐침)
function probe(ch, opts = {}) {
  const w = G.makeWorld(ch, G.openMap(60, 40), {floor: 1, tier: 1, seed: 9});
  w.p.x = 200;
  w.p.y = 320;
  w.rng = G.makeRng(9);
  const foes = [];
  for (let i = 0; i < 8; i++) {
    const e = G.spawnEnemy(w, 'dokkaebi', 240 + i * 14, 320, {still: 1}); // 일렬: 마지막 몇은 기본 획(120) 밖
    e.hp = e.maxHp = 1e7;
    e.dmg = 6;
    foes.push(e);
  }
  w.godKi = !!opts.godKi;
  const x0 = w.p.x;
  let moved = 0;
  for (let f = 0; f < 60 * 8; f++) {
    const slot = f % 4;
    const inp = {...NOIN(), cast: [slot === 0, slot === 1, slot === 2, slot === 3]};
    if (f % 120 === 0) inp.mx = 1;
    if (f % 120 === 1) inp.mx = -1;
    const bx = w.p.x;
    G.update(w, 1 / 60, inp);
    moved += Math.abs(w.p.x - bx);
    if (f % 30 === 0) G.hurtPlayer(w, 20, 'probe', 'phys');
  }
  return JSON.stringify({dealt: Math.round(Object.values(w.rs.dmg).reduce((a, b) => a + b, 0)), kiGot: Math.round(w.rs.kiGot), taken: Math.round(w.rs.taken), hp: Math.round(w.p.hp * 10), moved: Math.round(moved * 10), dx: Math.round((w.p.x - x0) * 10)});
}
function probeChar(skill) {
  const ch = G.newChar();
  ch.lvl = 30;
  ch.skills[skill] = {rank: 1, br: 0};
  ch.slots = [skill, skill === 'meok' ? null : 'meok', null, null]; // 실제처럼 먹탄은 늘 함께
  return ch;
}

test('전설 효과 5개는 모두 전투 결과를 바꾼다', () => {
  for (const [k, L] of Object.entries(G.LEGENDS)) {
    const base = probeChar(L.sk);
    const withL = probeChar(L.sk);
    withL.equip.charm = {uid: 9999, slot: 'charm', il: 1, rar: 3, base: '나무 노리개', affixes: [], rr: 0, ki: 10, legend: k};
    base.equip.charm = {...withL.equip.charm, legend: undefined, rar: 0};
    assert.notEqual(probe(withL, {godKi: true}), probe(base, {godKi: true}), k + ' 이(가) 아무것도 바꾸지 않음');
  }
});

test('스킬 갈래 10개는 모두 전투 결과를 바꾼다', () => {
  for (const id of G.SKILL_IDS)
    for (const b of [1, 2]) {
      const base = probeChar(id);
      base.skills[id].rank = 3;
      const alt = probeChar(id);
      alt.skills[id] = {rank: 3, br: b};
      assert.notEqual(probe(alt), probe(base), id + ' 갈래 ' + b); // 기력은 실제처럼(「맑은 기운」이 보이게)
    }
});

test('옵션 16개는 모두 전투 결과를 바꾼다', () => {
  for (const [k, a] of Object.entries(G.AFFIXES)) {
    const slot = a.slots[0];
    const ch = G.newChar();
    ch.lvl = 30;
    for (const id of G.SKILL_IDS) ch.skills[id] = {rank: 1, br: 0};
    ch.slots = ['meok', 'hwa', 'hanseol', 'ilpil'];
    if (k === 'r_gyeol') ch.slots[3] = 'gyeol';
    const base = probe(ch);
    const it = {uid: 8888, slot, il: 10, rar: 1, base: 'x', affixes: [{k, v: G.affixValue(k, 10, 1)}], rr: 0};
    if (slot === 'weapon') it.power = 6;
    ch.equip[slot] = it;
    if (slot === 'weapon') {
      // 기준도 같은 붓
      const ch2 = JSON.parse(JSON.stringify(ch));
      ch2.equip.weapon = {...it, affixes: []};
      assert.notEqual(probe(ch), probe(ch2), k);
    } else assert.notEqual(probe(ch), base, k);
  }
});

test('가방이 꽉 차면 장비는 바닥에 남는다', () => {
  const ch = G.newChar();
  for (let i = 0; i < G.BAG_MAX; i++) ch.bag.push(G.rollItem(G.makeRng(i + 1), 'hat', 1, 0));
  const w = arena(ch);
  G.dropItem(w, w.p.x + 4, w.p.y, G.rollItem(G.makeRng(77), 'robe', 1, 1));
  G.update(w, 1 / 60, NOIN());
  assert.equal(ch.bag.length, G.BAG_MAX);
  assert.equal(w.drops.length, 1);
});

test('엽전은 가까이 가면 줍는다', () => {
  const w = arena();
  G.dropGold(w, w.p.x + 4, w.p.y, 12);
  G.update(w, 1 / 60, NOIN());
  assert.equal(w.ch.gold, 12);
});

test('요괴를 쓰러뜨리면 경험치를 얻고 레벨이 오른다', () => {
  const w = arena();
  for (let i = 0; i < 40; i++) {
    const e = G.spawnEnemy(w, 'dokkaebi', 150, 240, {still: 1});
    G.hurt(w, e, 1e6, 'meok', 'phys', {nocrit: 1});
  }
  assert.ok(w.ch.lvl > 1);
  assert.ok(w.events.some(e => e.k === 'lvl'));
});

test('던전 층: 출구 계단에 서면 층을 깬다(보스 층은 보스를 잡아야)', () => {
  const ch = G.newChar();
  const w = G.startFloor(ch, 1, 1, 5);
  w.ens.length = 0;
  w.p.x = (w.map.exit.x + 0.5) * G.TILE;
  w.p.y = (w.map.exit.y + 0.5) * G.TILE;
  G.update(w, 1 / 60, NOIN());
  assert.equal(w.state, 'clear');
  const w3 = G.startFloor(ch, 3, 1, 5);
  w3.p.x = (w3.map.exit.x + 0.5) * G.TILE;
  w3.p.y = (w3.map.exit.y + 0.5) * G.TILE;
  G.update(w3, 1 / 60, NOIN());
  assert.notEqual(w3.state, 'clear', '보스가 살아 있는데 깸');
});

test('던전 층: 시작 방에는 요괴가 없고, 다른 방에는 있다', () => {
  const w = G.startFloor(G.newChar(), 1, 1, 8);
  const sr = w.map.rooms[0];
  const inStart = w.ens.filter(e => e.x >= sr.x0 * G.TILE && e.x < (sr.x0 + G.ROOM_W) * G.TILE && e.y >= sr.y0 * G.TILE && e.y < (sr.y0 + G.ROOM_H) * G.TILE);
  assert.equal(inStart.length, 0);
  assert.ok(w.ens.length >= 20);
});

test('보스 돌진 예고선은 벽에서 끝난다(실제 돌진 거리와 같게)', () => {
  const w = G.makeWorld(G.newChar(), G.openMap(12, 30), {floor: 1, tier: 1, seed: 1});
  const b = G.spawnBoss(w, 96, 100);
  w.p.x = 96;
  w.p.y = 60; // 보스 바로 위: 위쪽 벽(y=16)까지 84px 뿐
  G.bossAttack(w, b, 'charge');
  const T = w.tele[0];
  const L = Math.hypot(T.x2 - T.x, T.y2 - T.y);
  assert.ok(L < 100, '예고선 길이 ' + L);
});

test('자동 조준이 「보인다」고 잡은 대상은 먹탄이 실제로 닿는다(시드 지도 300곳)', () => {
  const rng = G.makeRng(123);
  let tried = 0,
    miss = 0;
  for (let seed = 1; tried < 300 && seed < 400; seed++) {
    const w = G.startFloor(G.newChar(), 1 + (seed % 3), 1, seed);
    const m = w.map;
    const room = m.rooms[1 + (seed % (m.rooms.length - 1))];
    const spots = G.roomFloorTiles(m, room);
    const [ax, ay] = spots[Math.floor(rng() * spots.length)],
      [bx, by] = spots[Math.floor(rng() * spots.length)];
    w.ens.length = 0;
    w.p.x = (ax + 0.5) * G.TILE;
    w.p.y = (ay + 0.5) * G.TILE;
    const e = G.spawnEnemy(w, 'dokkaebi', (bx + 0.5) * G.TILE, (by + 0.5) * G.TILE, {still: 1});
    e.hp = e.maxHp = 1e6;
    if (Math.hypot(ax - m.exit.x, ay - m.exit.y) < 2) continue; // 계단 위에 서면 층이 끝나 세계가 멈춘다
    if (G.autoTarget(w, 190) !== e) continue;
    tried++;
    G.castSkill(w, 'meok', null);
    for (let i = 0; i < 60 && w.projs.length; i++) G.update(w, 1 / 60, NOIN());
    if (e.hp === e.maxHp) miss++;
  }
  assert.ok(tried > 100, '시험 장면 부족 ' + tried);
  assert.equal(miss, 0, `${tried}번 중 ${miss}번 헛방`);
});

test('요괴는 벽 뒤에서도 길을 찾아 플레이어에게 온다', () => {
  const m = G.openMap(30, 20);
  // 가운데 세로 벽(아래쪽만 뚫림)
  for (let y = 0; y < 16; y++) m.tiles[y * 30 + 15] = 1;
  const w = G.makeWorld(G.newChar(), m, {floor: 1, tier: 1, seed: 1});
  w.p.x = 20 * 16;
  w.p.y = 4 * 16;
  w.p.hp = w.S.maxHp = 1e9;
  const e = G.spawnEnemy(w, 'dokkaebi', 10 * 16, 4 * 16, {});
  for (let i = 0; i < 60 * 20; i++) G.update(w, 1 / 60, NOIN()); // 돌아가는 길 34칸 ÷ 초당 2칸 ≈ 16초
  const d = Math.hypot(e.x - w.p.x, e.y - w.p.y);
  assert.ok(d < 20, '요괴가 벽 뒤에 걸림: 거리 ' + Math.round(d));
});

test('복숭아를 주우면 최대 체력의 22%를 회복한다(최대치는 넘지 않음)', () => {
  const w = arena();
  w.p.hp = 10;
  G.dropPeach(w, w.p.x + 4, w.p.y);
  G.update(w, 1 / 60, NOIN());
  assert.ok(Math.abs(w.p.hp - (10 + w.S.maxHp * 0.22)) < 1);
  assert.equal(w.drops.length, 0);
  G.dropPeach(w, w.p.x + 4, w.p.y);
  w.p.hp = w.S.maxHp;
  G.update(w, 1 / 60, NOIN());
  assert.ok(w.p.hp <= w.S.maxHp);
});

test('정예를 쓰러뜨리면 복숭아가 떨어진다', () => {
  const w = arena();
  const e = G.spawnEnemy(w, 'dokkaebi', 300, 240, {still: 1, elite: ['nalraen']});
  G.hurt(w, e, 1e9, 'meok', 'phys', {nocrit: 1});
  assert.ok(w.drops.some(d => d.peach));
});

test('업 1단계 1층: 정예는 마지막(계단) 방에만 나온다 — 갓 시작한 선비 보호', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const w = G.startFloor(G.newChar(), 1, 1, seed);
    const ex = w.map.rooms.find(r => r.kind === 'exit');
    for (const e of w.ens.filter(e => e.elite)) {
      const inExit = e.x >= ex.x0 * G.TILE && e.x < (ex.x0 + G.ROOM_W) * G.TILE && e.y >= ex.y0 * G.TILE && e.y < (ex.y0 + G.ROOM_H) * G.TILE;
      assert.ok(inExit, '시드 ' + seed + ' 정예가 계단 방 밖에');
    }
  }
});

test('업 1단계 1층은 익히는 층: 시작 방 바로 옆 방은 요괴 4마리 이하', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const w = G.startFloor(G.newChar(), 1, 1, seed);
    for (const r of w.map.rooms.filter(r => r.depth === 1)) {
      const n = w.ens.filter(e => e.x >= r.x0 * G.TILE && e.x < (r.x0 + G.ROOM_W) * G.TILE && e.y >= r.y0 * G.TILE && e.y < (r.y0 + G.ROOM_H) * G.TILE).length;
      assert.ok(n <= 4, `시드 ${seed} 첫 방 요괴 ${n}`);
    }
  }
});

test('검토 1: 보스를 쓰러뜨리면 남은 요괴·예고·요괴 투사체가 모두 사라져 더는 맞지 않는다', () => {
  const w = arena();
  const b = G.spawnBoss(w, 300, 240);
  b.still = 1;
  G.bossAttack(w, b, 'summon');
  G.bossAttack(w, b, 'slam');
  w.hprojs.push({x: w.p.x + 30, y: w.p.y, vx: -90, vy: 0, r: 3, dmg: 20, life: 2, src: 'x'});
  for (let i = 0; i < 20; i++) {
    b.capT = -9;
    G.hurt(w, b, b.maxHp, 'meok', 'phys', {nocrit: 1});
  }
  assert.ok(w.bossDead);
  const hp = w.p.hp;
  for (let i = 0; i < 60 * 5; i++) G.update(w, 1 / 60, NOIN());
  assert.equal(w.p.hp, hp);
  assert.equal(w.ens.filter(e => !e.dead).length, 0);
});

test('검토 2: 모든 층의 모든 방(시작 방 제외)에 요괴가 있다 — 개수 상한에 잘리지 않음', () => {
  for (let seed = 1; seed <= 50; seed++)
    for (let f = 1; f <= 3; f++) {
      const w = G.startFloor(G.newChar(), f, 2, seed);
      for (const r of w.map.rooms) {
        if (r.kind === 'start') continue;
        const n = w.ens.filter(e => e.x >= r.x0 * G.TILE && e.x < (r.x0 + G.ROOM_W) * G.TILE && e.y >= r.y0 * G.TILE && e.y < (r.y0 + G.ROOM_H) * G.TILE).length;
        assert.ok(n > 0, `시드 ${seed} ${f}층 ${r.kind} 방이 빔`);
      }
    }
});

test('검토 3: 요괴는 막힌 칸(기둥·연못·벽) 안에 생기지 않는다', () => {
  let bad = 0;
  for (let seed = 1; seed <= 100; seed++)
    for (let f = 1; f <= 3; f++) {
      const w = G.startFloor(G.newChar(), f, 1, seed);
      for (const e of w.ens) if (G.solidAt(w.map, e.x, e.y, e.r * 0.8)) bad++;
    }
  assert.equal(bad, 0, '막힌 칸에 생긴 요괴 ' + bad);
});

test('검토 5: 금강결계 폭발은 잠든 요괴를 깨우지 않는다', () => {
  const ch = G.newChar();
  ch.skills.gyeol = {rank: 1, br: 0};
  ch.equip.charm = {uid: 7777, slot: 'charm', il: 1, rar: 3, base: 'x', affixes: [], rr: 0, ki: 10, legend: 'gyeolBurst'};
  const w = arena(ch);
  const e = G.spawnEnemy(w, 'dokkaebi', w.p.x + 20, w.p.y, {sleep: 1, still: 1});
  G.castSkill(w, 'gyeol', null);
  G.breakShield(w);
  assert.equal(e.sleep, true);
  assert.equal(e.hp, e.maxHp);
});

test('검토 9: 플레이어가 내려놓은 장비는 그 자리를 떠났다 돌아오기 전에는 다시 줍지 않는다', () => {
  const w = arena();
  const it = G.rollItem(G.makeRng(1), 'hat', 1, 1);
  G.dropItem(w, w.p.x, w.p.y, it, {hold: 1});
  for (let i = 0; i < 30; i++) G.update(w, 1 / 60, NOIN());
  assert.equal(w.ch.bag.length, 0, '내려놓자마자 다시 주움');
  for (let i = 0; i < 40; i++) G.update(w, 1 / 60, {...NOIN(), mx: 1});
  for (let i = 0; i < 40; i++) G.update(w, 1 / 60, {...NOIN(), mx: -1});
  assert.equal(w.ch.bag.length, 1, '돌아와도 못 주움');
});
