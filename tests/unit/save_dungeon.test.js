const test = require('node:test');
const assert = require('node:assert/strict');
const {load} = require('../harness');

function mem(init = {}) {
  const s = {...init};
  return {getItem: k => (k in s ? s[k] : null), setItem: (k, v) => (s[k] = String(v)), removeItem: k => delete s[k], _s: s};
}

test('저장 없음 → 새 캐릭터', () => {
  const G = load();
  const r = G.loadSave(mem());
  assert.equal(r.status, 'new');
  assert.equal(r.ch.lvl, 1);
});

test('저장 → 불러오기 왕복이 같다', () => {
  const G = load();
  const st = mem();
  const ch = G.newChar();
  ch.lvl = 7;
  ch.gold = 123;
  ch.bag.push(G.rollItem(G.makeRng(5), 'hat', 4, 3));
  G.writeSave(st, ch);
  const r = G.loadSave(st);
  assert.equal(r.status, 'ok');
  assert.equal(JSON.stringify(r.ch), JSON.stringify(ch));
});

test('깨진 저장 → 새 캐릭터로 시작하고 깨진 글은 백업에 남긴다', () => {
  const G = load();
  const st = mem({[G.SAVE_KEY]: '{이상한 글'});
  const r = G.loadSave(st);
  assert.equal(r.status, 'broken');
  assert.equal(r.ch.lvl, 1);
  assert.equal(st._s[G.SAVE_KEY + '-broken'], '{이상한 글');
});

test('판 번호 없는 옛 저장(saveVer 0)을 새 형식으로 옮긴다', () => {
  const G = load();
  const old = {lvl: 4, xp: 10, gold: 50, skills: {meok: {rank: 2}}, equip: {weapon: {slot: 'weapon', il: 2, rar: 1, base: '양털붓', power: 7, affixes: [{k: 'dmg', v: 8}, {k: '없는옵션', v: 1}]}}};
  const st = mem({[G.SAVE_KEY]: JSON.stringify(old)});
  const r = G.loadSave(st);
  assert.equal(r.status, 'migrated');
  assert.equal(r.ch.lvl, 4);
  assert.equal(r.ch.tier, 1);
  assert.equal(r.ch.bag.length, 0);
  assert.equal(r.ch.slots[0], 'meok');
  assert.equal(r.ch.equip.weapon.affixes.length, 1, '모르는 옵션은 버림');
  assert.equal(r.ch.equip.weapon.rr, 0);
  assert.ok(r.ch.equip.weapon.uid > 0);
});

test('저장 값이 이상해도 시작은 된다(레벨 문자열, 가방 객체)', () => {
  const G = load();
  const st = mem({[G.SAVE_KEY]: JSON.stringify({saveVer: 1, ch: {lvl: '5', gold: -3, bag: {a: 1}, skills: null, slots: 'x'}})});
  const r = G.loadSave(st);
  assert.equal(r.ch.lvl, 5);
  assert.equal(r.ch.gold, 0);
  assert.ok(Array.isArray(r.ch.bag));
  assert.equal(r.ch.skills.meok.rank, 1);
  assert.equal(r.ch.slots.length, 4);
});

test('던전: 시드 500개 × 3층, 시작에서 계단(보스 방)까지 길이 있고 모든 바닥이 이어진다', () => {
  const G = load();
  for (let seed = 1; seed <= 500; seed++) {
    for (let f = 1; f <= 3; f++) {
      const m = G.genFloor(seed, f);
      assert.equal(m.rooms.length, G.ROOMS_PER_FLOOR[f - 1], `시드${seed} ${f}층 방 수`);
      assert.ok(G.walkable(m, m.start.x, m.start.y), '시작 칸이 막힘');
      const seen = G.floodFrom(m, m.start.x, m.start.y);
      assert.ok(seen.has(m.exit.y * m.w + m.exit.x), `시드${seed} ${f}층 출구에 못 감`);
      let floor = 0;
      for (let i = 0; i < m.tiles.length; i++) if (m.tiles[i] === 0) floor++;
      assert.equal(seen.size, floor, `시드${seed} ${f}층 닿지 않는 바닥 ${floor - seen.size}칸`);
      const boss = m.rooms.filter(r => r.kind === 'boss');
      assert.equal(boss.length, f === 3 ? 1 : 0);
    }
  }
});

test('던전: 같은 시드는 같은 지도', () => {
  const G = load();
  assert.equal(JSON.stringify(G.genFloor(42, 2)), JSON.stringify(G.genFloor(42, 2)));
});

test('방 조각은 모두 15×11이고 테두리는 벽', () => {
  const G = load();
  for (const [n, r] of Object.entries({...G.ROOMS, 보스: G.BOSS_ROOM})) {
    assert.equal(r.length, 11, n);
    for (const row of r) assert.equal(row.length, 15, n + ' ' + row);
    assert.ok(/^#+$/.test(r[0]) && /^#+$/.test(r[10]), n);
    for (const row of r) assert.ok(row[0] === '#' && row[14] === '#', n);
  }
});
