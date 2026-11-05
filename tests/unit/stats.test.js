const test = require('node:test');
const assert = require('node:assert/strict');
const {load} = require('../harness');
const G = load();

function mem(init = {}) {
  const s = {...init};
  return {getItem: k => (k in s ? s[k] : null), setItem: (k, v) => (s[k] = String(v)), removeItem: k => delete s[k], _s: s};
}
function playedFloor(end) {
  const ch = G.newChar();
  const w = G.startFloor(ch, 2, 1, 3);
  w.t = 95.4;
  w.rs.kills = 17;
  w.rs.takenBy = {changgwi: 40, dokkaebi: 12, baekyeou: 30, gwihwa: 1};
  w.rs.taken = 83;
  return {ch, w, rec: G.floorRecord(w, end, '휴대폰')};
}

test('층 기록 한 줄: 판·기기·업·층·시간·결과·레벨·처치·받은 피해 상위 3', () => {
  const {rec} = playedFloor('clear');
  assert.equal(rec.v, G.GAME_VER);
  assert.equal(rec.dev, '휴대폰');
  assert.equal(rec.tier, 1);
  assert.equal(rec.floor, 2);
  assert.equal(rec.sec, 95);
  assert.equal(rec.end, 'clear');
  assert.equal(rec.kills, 17);
  assert.equal(rec.taken, 83);
  assert.equal(JSON.stringify(rec.by), JSON.stringify([['changgwi', 40], ['baekyeou', 30], ['dokkaebi', 12]]));
  assert.ok(typeof rec.at === 'string' && rec.at.length >= 10);
});

test('기록은 최근 30줄만 남는다(오래된 것부터 버림)', () => {
  const {ch, rec} = playedFloor('clear');
  for (let i = 0; i < 35; i++) G.pushStat(ch, {...rec, sec: i});
  assert.equal(ch.stats.length, 30);
  assert.equal(ch.stats[0].sec, 5);
  assert.equal(ch.stats[29].sec, 34);
});

test('요약 글: 층 시간, 쓰러짐, 받은 피해 출처 이름이 들어간다', () => {
  const {ch, rec} = playedFloor('clear');
  G.pushStat(ch, rec);
  G.pushStat(ch, {...rec, floor: 3, end: 'dead', sec: 40, bossSec: 0});
  const t = G.statsText(ch);
  assert.ok(t.includes('2층'), t);
  assert.ok(t.includes('쓰러짐'), t);
  assert.ok(t.includes('창귀'), t);
  assert.ok(t.includes(G.GAME_VER), t);
});

test('기록이 없으면 요약 글은 안내 문장', () => {
  assert.ok(G.statsText(G.newChar()).includes('아직'));
});

test('v1 저장(기록 없음)을 v2로 옮긴다', () => {
  const v1 = {saveVer: 1, ver: 'v0.1', ch: {lvl: 6, gold: 40, skills: {meok: {rank: 1}}}};
  const st = mem({[G.SAVE_KEY]: JSON.stringify(v1)});
  const r = G.loadSave(st);
  assert.equal(r.status, 'migrated');
  assert.equal(r.ch.lvl, 6);
  assert.ok(Array.isArray(r.ch.stats));
  assert.equal(r.ch.stats.length, 0);
});

test('저장 → 불러오기 왕복에서 기록이 남고, 이상한 기록 줄은 버린다', () => {
  const {ch, rec} = playedFloor('won');
  G.pushStat(ch, rec);
  ch.stats.push('이상한 줄', null, {floor: 'x'});
  const st = mem();
  G.writeSave(st, ch);
  const r = G.loadSave(st);
  assert.equal(r.status, 'ok');
  assert.equal(r.ch.stats.length, 1);
  assert.equal(r.ch.stats[0].end, 'won');
});

test('쓰러질 때 받은 피해는 남은 체력까지만 센다(기록이 부풀지 않게)', () => {
  const w = G.makeWorld(G.newChar(), G.openMap(20, 20), {floor: 1, tier: 1, seed: 1});
  w.p.hp = 30;
  G.hurtPlayer(w, 1e9, 'dokkaebi', 'phys');
  assert.equal(w.state, 'dead');
  assert.equal(Math.round(w.rs.taken), 30);
  assert.equal(Math.round(w.rs.takenBy.dokkaebi), 30);
});

test('검토: 층 중간에 앱이 꺼지면 다음에 켤 때 그 층이 「중단」으로 기록된다', () => {
  const {ch, w} = playedFloor('quit');
  ch.curFloor = G.floorRecord(w, 'quit', '휴대폰'); // 화면이 가려질 때 저장해 둔 진행 중 층
  const st = mem();
  G.writeSave(st, ch);
  const r = G.loadSave(st);
  assert.equal(r.ch.stats.length, 1);
  assert.equal(r.ch.stats[0].end, 'quit');
  assert.equal(r.ch.curFloor, undefined, '옮긴 뒤에는 지운다');
  assert.ok(G.statsText(r.ch).includes('중단'));
});

test('검토: 손상된 기록 줄(by·at 이상)은 불러올 때 버린다 — 기록 창이 멈추지 않게', () => {
  const {ch, rec} = playedFloor('clear');
  ch.stats = [rec, {...rec, by: 'x'}, {...rec, at: 5}];
  const st = mem();
  G.writeSave(st, ch);
  const r = G.loadSave(st);
  assert.equal(r.ch.stats.length, 1);
  assert.doesNotThrow(() => G.statsText(r.ch));
});
