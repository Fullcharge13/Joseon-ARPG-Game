const test = require('node:test');
const assert = require('node:assert/strict');
const {load} = require('../harness');
const G = load();

test('경험치 곡선: 1레벨 30, 2레벨 90, 계속 늘어난다', () => {
  assert.equal(G.xpNeed(1), 30);
  assert.equal(G.xpNeed(2), 90);
  for (let L = 2; L < 30; L++) assert.ok(G.xpNeed(L + 1) > G.xpNeed(L));
});

test('방어 경감: 0이면 0, 아무리 커도 75%', () => {
  assert.equal(G.armorReduce(0, 1), 0);
  assert.ok(G.armorReduce(1e9, 1) <= 0.75);
  assert.ok(G.armorReduce(50, 1) > G.armorReduce(50, 10), '요괴 레벨이 높으면 같은 방어로 덜 막는다');
});

test('요괴 성장 배수: 레벨 1은 1배, 오를수록 커진다', () => {
  assert.equal(G.monMul(1).hp, 1);
  assert.equal(G.monMul(1).dmg, 1);
  assert.ok(G.monMul(5).hp > G.monMul(4).hp);
});

test('모든 옵션은 붙을 수 있는 부위에서 능력치를 바꾼다 (효과 없는 옵션 금지)', () => {
  for (const [k, a] of Object.entries(G.AFFIXES)) {
    assert.ok(a.slots.length > 0, k + ' 붙을 부위 없음');
    for (const slot of a.slots) {
      const ch = G.newChar();
      ch.skills.hwa = {rank: 1, br: 0}; // 불 스킬 하나 배워 둠
      ch.skills.hanseol = {rank: 1, br: 0};
      const before = JSON.stringify(G.calcStats(ch));
      const it = G.rollItem(G.makeRng(1), slot, 5, 0);
      it.affixes = [{k, v: G.affixValue(k, 5, 1)}];
      ch.equip[slot] = it;
      const after = JSON.stringify(G.calcStats(ch));
      assert.notEqual(after, before, `${k} 이(가) ${slot} 에서 아무것도 바꾸지 않음`);
    }
  }
});

test('등급별 옵션 개수: 일반 0, 마법 1~2, 희귀 3~4, 전설 2~3 + 전설 효과', () => {
  const rng = G.makeRng(7);
  for (let i = 0; i < 400; i++) {
    for (const slot of G.SLOTS) {
      for (let rar = 0; rar <= 3; rar++) {
        const it = G.rollItem(rng, slot, 1 + (i % 12), rar);
        const n = it.affixes.length;
        const [lo, hi] = [[0, 0], [1, 2], [3, 4], [2, 3]][rar];
        assert.ok(n >= lo && n <= hi, `${slot} 등급${rar} 옵션 ${n}개`);
        assert.equal(new Set(it.affixes.map(a => a.k)).size, n, '같은 옵션 두 번');
        for (const a of it.affixes) assert.ok(G.AFFIXES[a.k].slots.includes(slot), a.k + ' 은 ' + slot + ' 에 못 붙음');
        if (rar === 3) assert.ok(G.LEGENDS[it.legend], '전설 효과 없음');
        else assert.equal(it.legend, undefined);
      }
    }
  }
});

test('드롭 등급: 정예는 마법 이상, 보스는 희귀 이상', () => {
  const rng = G.makeRng(3);
  for (let i = 0; i < 500; i++) {
    assert.ok(G.rollRarity(rng, 'e', 1) >= 1);
    assert.ok(G.rollRarity(rng, 'b', 1) >= 2);
  }
});

test('재굴림: 고른 옵션만 다른 종류로 바뀌고 중복은 없다, 값은 오른다', () => {
  const rng = G.makeRng(11);
  for (let i = 0; i < 200; i++) {
    const it = G.rollItem(rng, G.SLOTS[i % 4], 6, 2);
    const old = it.affixes.map(a => a.k);
    const r = G.rerollAffix(rng, it, 0);
    assert.ok(r, '재굴림 실패');
    assert.notEqual(r.affixes[0].k, old[0]);
    assert.equal(JSON.stringify(r.affixes.slice(1).map(a => a.k)), JSON.stringify(old.slice(1)));
    assert.equal(new Set(r.affixes.map(a => a.k)).size, r.affixes.length);
    assert.equal(it.affixes[0].k, old[0], '원본을 고치면 안 됨');
    assert.ok(G.rerollCost(r) > G.rerollCost(it), '두 번째 재굴림은 더 비싸다');
  }
});

test('수련점: 레벨−1 만큼 쓸 수 있고, 재배분하면 모두 돌려받는다', () => {
  const ch = G.newChar();
  assert.equal(G.freePoints(ch), 0);
  ch.lvl = 6;
  assert.equal(G.freePoints(ch), 5);
  assert.ok(G.learn(ch, 'hwa'));
  assert.ok(G.learn(ch, 'hwa'));
  assert.ok(G.learn(ch, 'hwa'));
  assert.equal(ch.skills.hwa.rank, 3);
  assert.ok(G.chooseBranch(ch, 'hwa', 2));
  assert.equal(G.freePoints(ch), 2);
  assert.equal(G.chooseBranch(ch, 'meok', 1), false, '3단계 전에는 갈래를 못 고름');
  for (let i = 0; i < 2; i++) G.learn(ch, 'meok');
  assert.equal(G.learn(ch, 'meok'), false, '점수 없으면 못 배움');
  G.respec(ch);
  assert.equal(G.freePoints(ch), 5);
  assert.equal(ch.skills.meok.rank, 1, '먹탄 1단계는 기본');
  assert.equal(ch.skills.hwa, undefined);
  assert.equal(JSON.stringify(ch.slots.filter(Boolean)), '["meok"]');
});

test('스킬 최대 단계는 5', () => {
  const ch = G.newChar();
  ch.lvl = 20;
  for (let i = 0; i < 10; i++) G.learn(ch, 'meok');
  assert.equal(ch.skills.meok.rank, 5);
});

test('장비 비교는 「지금 → 바뀐 뒤」 줄을 낸다', () => {
  const ch = G.newChar();
  const it = G.rollItem(G.makeRng(2), 'weapon', 8, 2);
  const lines = G.compareLines(ch, it);
  assert.ok(lines.length > 0);
  assert.ok(lines.every(l => l.includes('→')));
});

test('부위마다 옵션 종류가 5개 이상이라 옵션 4개짜리도 재굴림할 수 있다', () => {
  for (const slot of G.SLOTS) {
    const n = Object.values(G.AFFIXES).filter(a => a.slots.includes(slot)).length;
    assert.ok(n >= 5, slot + ' 옵션 종류 ' + n);
  }
});
