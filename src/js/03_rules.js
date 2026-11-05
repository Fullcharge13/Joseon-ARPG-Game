/* ======================= 규칙: 계산만, 화면 없음 ======================= */
const xpNeed = L => Math.round((5 + 9 * (L - 1) + Math.pow(L - 1, 2.2)) * 6);
const armorReduce = (armor, ml) => Math.min(0.75, armor / (armor + 40 + 12 * ml));
const monMul = ml => ({hp: Math.pow(1.13, ml - 1), dmg: Math.pow(1.09, ml - 1)});
const monLevel = (floor, tier) => floor + TIER_STEP * (tier - 1);
const rankMul = r => 1 + 0.25 * (r - 1);

function affixValue(k, il, roll) {
  const a = AFFIXES[k];
  const v = (a.lo + (a.hi - a.lo) * roll) * (1 + a.sc * (il - 1));
  const p = Math.pow(10, a.dec || 0);
  return Math.max(a.dec ? 0.1 : 1, Math.round(v * p) / p);
}
function affixText(a) {
  return AFFIXES[a.k].n + ' ' + AFFIXES[a.k].f.replace('{v}', a.v);
}

/* --- 장비 --- */
let ITEM_SEQ = 1;
function baseStats(slot, il) {
  const g = Math.pow(1.1, il - 1);
  if (slot === 'weapon') return {power: Math.round(6 * Math.pow(1.12, il - 1) * 10) / 10};
  if (slot === 'hat') return {armor: Math.round(4 * g), hp: Math.round(8 * g)};
  if (slot === 'robe') return {armor: Math.round(7 * g), hp: Math.round(12 * g)};
  return {ki: Math.round(10 * Math.pow(1.04, il - 1))};
}
function rollItem(rng, slot, il, rar) {
  const nAff = [() => 0, () => rint(rng, 1, 2), () => rint(rng, 3, 4), () => rint(rng, 2, 3)][rar]();
  const pool = Object.keys(AFFIXES).filter(k => AFFIXES[k].slots.includes(slot));
  const affixes = [];
  while (affixes.length < nAff && affixes.length < pool.length) {
    const k = pick(rng, pool);
    if (affixes.some(a => a.k === k)) continue;
    affixes.push({k, v: affixValue(k, il, rng())});
  }
  const band = Math.min(3, Math.floor((il - 1) / 3));
  const it = {uid: ITEM_SEQ++, slot, il, rar, base: BASES[slot][band], affixes, rr: 0, ...baseStats(slot, il)};
  if (slot === 'weapon') it.power = Math.round(it.power * (0.9 + 0.2 * rng()) * 10) / 10;
  if (rar === 3) it.legend = pick(rng, Object.keys(LEGENDS));
  return it;
}
function itemName(it) {
  if (it.legend) return LEGENDS[it.legend].n + '의 ' + it.base;
  return it.base;
}
// 드롭 등급. src: n 일반 · e 정예 · b 보스. 업 단계가 높으면 좋은 등급이 잦다
function rollRarity(rng, src, tier) {
  const t = 1 + 0.3 * (tier - 1);
  const w = {n: [80, 16 * t, 3.6 * t, 0.4 * t], e: [0, 66, 30 * t, 4 * t], b: [0, 0, 78, 22 * t]}[src];
  return weighted(rng, w);
}
const sellPrice = it => Math.round((4 + it.il * 2) * (1 + it.rar * 1.5));
const rerollCost = it => Math.round(20 * (1 + 0.4 * it.il) * (1 + it.rr) * (it.rar === 3 ? 2 : 1));
function rerollAffix(rng, it, idx) {
  const cur = it.affixes.map(a => a.k);
  const pool = Object.keys(AFFIXES).filter(k => AFFIXES[k].slots.includes(it.slot) && !cur.includes(k));
  if (!pool.length || !it.affixes[idx]) return null;
  const k = pick(rng, pool);
  const out = JSON.parse(JSON.stringify(it));
  out.affixes[idx] = {k, v: affixValue(k, it.il, rng())};
  out.rr = (it.rr || 0) + 1;
  return out;
}

/* --- 캐릭터 --- */
function newChar() {
  const w = {uid: ITEM_SEQ++, slot: 'weapon', il: 1, rar: 0, base: BASES.weapon[0], affixes: [], rr: 0, power: 6};
  return {lvl: 1, xp: 0, gold: 0, skills: {meok: {rank: 1, br: 0}}, slots: ['meok', null, null, null], equip: {weapon: w}, bag: [], tier: 1, maxTier: 1, stats: []};
}
function calcStats(ch) {
  const B = BASE_STATS;
  const S = {
    power: 0,
    maxHp: B.maxHp + B.hpPerLvl * (ch.lvl - 1),
    maxKi: B.maxKi,
    kiRegen: B.kiRegen,
    kiRegenPct: 0,
    armor: B.armor,
    crit: B.crit,
    critDmg: B.critDmg,
    dmgPct: 0,
    firePct: 0,
    coldPct: 0,
    regen: 0,
    cdr: 0,
    move: B.move,
    movePct: 0,
    ranks: {},
    branches: {},
    legends: []
  };
  for (const [id, s] of Object.entries(ch.skills)) {
    S.ranks[id] = s.rank;
    if (s.br) S.branches[id] = s.br;
  }
  for (const slot of SLOTS) {
    const it = ch.equip[slot];
    if (!it) continue;
    if (it.power) S.power += it.power;
    if (it.armor) S.armor += it.armor;
    if (it.hp) S.maxHp += it.hp;
    if (it.ki) S.maxKi += it.ki;
    for (const a of it.affixes) AFFIXES[a.k].ap(S, a.v);
    if (it.legend && !S.legends.includes(it.legend)) S.legends.push(it.legend);
  }
  if (!S.power) S.power = 3; // 붓이 없으면 맨손
  for (const id in S.ranks) S.ranks[id] = Math.min(SKILL_MAX + 2, S.ranks[id]);
  S.cdr = Math.min(40, S.cdr);
  S.legends.sort();
  S.kiRegenFinal = Math.round(S.kiRegen * (1 + S.kiRegenPct / 100) * 100) / 100;
  S.moveFinal = Math.round(S.move * (1 + S.movePct / 100) * 100) / 100;
  return S;
}
// 스킬 한 번의 기본 피해(치명 제외)
function skillHit(S, id, part = 1) {
  const sk = SKILLS[id];
  const r = S.ranks[id] || 1;
  const typePct = sk.type === 'fire' ? S.firePct : sk.type === 'cold' ? S.coldPct : 0;
  let m = sk.coef * S.power * (1 + (S.dmgPct + typePct) / 100) * rankMul(r) * part;
  if (id === 'hanseol' && S.branches.hanseol === 2) m *= 1.25;
  return m;
}
const skillCd = (S, id) => SKILLS[id].cd * (1 - S.cdr / 100);

/* --- 수련점 --- */
const spentPoints = ch => Object.entries(ch.skills).reduce((s, [id, v]) => s + v.rank - (id === 'meok' ? 1 : 0), 0);
const freePoints = ch => ch.lvl - 1 - spentPoints(ch);
function learn(ch, id) {
  if (!SKILLS[id] || freePoints(ch) <= 0) return false;
  const s = ch.skills[id] || {rank: 0, br: 0};
  if (s.rank >= SKILL_MAX) return false;
  s.rank++;
  ch.skills[id] = s;
  if (s.rank === 1 && !ch.slots.includes(id)) {
    const free = ch.slots.indexOf(null);
    if (free >= 0) ch.slots[free] = id;
  }
  return true;
}
function chooseBranch(ch, id, b) {
  const s = ch.skills[id];
  if (!s || s.rank < BRANCH_AT || (b !== 1 && b !== 2)) return false;
  s.br = b;
  return true;
}
function respec(ch) {
  ch.skills = {meok: {rank: 1, br: 0}};
  ch.slots = ['meok', null, null, null];
}
// 단계 옵션으로만 얻은 스킬도 칸에 올릴 수 있다
function usableSkills(ch) {
  const S = calcStats(ch);
  return SKILL_IDS.filter(id => (S.ranks[id] || 0) > 0);
}

/* --- 장비 비교: 「지금 → 바뀐 뒤」 --- */
const CMP_KEYS = [
  ['power', '공력', 1],
  ['maxHp', '체력', 0],
  ['maxKi', '기력', 0],
  ['armor', '방어', 0],
  ['crit', '치명타 확률', 0, '%'],
  ['critDmg', '치명타 피해', 0, '%'],
  ['dmgPct', '피해', 0, '%'],
  ['firePct', '불 피해', 0, '%'],
  ['coldPct', '냉기 피해', 0, '%'],
  ['regen', '초당 체력 회복', 1],
  ['kiRegenFinal', '초당 기력 회복', 1],
  ['cdr', '재사용 대기 감소', 0, '%'],
  ['moveFinal', '이동 속도', 0]
];
function compareLines(ch, it) {
  const a = calcStats(ch);
  const tmp = {...ch, equip: {...ch.equip, [it.slot]: it}};
  const b = calcStats(tmp);
  const fmt = (v, d) => (d ? (Math.round(v * 10) / 10).toFixed(1) : String(Math.round(v)));
  const out = [];
  for (const [k, n, d, u = ''] of CMP_KEYS) if (fmt(a[k], d) !== fmt(b[k], d)) out.push(`${n} ${fmt(a[k], d)}${u} → ${fmt(b[k], d)}${u}`);
  for (const id of SKILL_IDS) if ((a.ranks[id] || 0) !== (b.ranks[id] || 0)) out.push(`${SKILLS[id].name} 단계 ${a.ranks[id] || 0} → ${b.ranks[id] || 0}`);
  for (const L of b.legends) if (!a.legends.includes(L)) out.push(`전설 「${LEGENDS[L].n}」 없음 → 생김`);
  for (const L of a.legends) if (!b.legends.includes(L)) out.push(`전설 「${LEGENDS[L].n}」 있음 → 사라짐`);
  return out;
}
// 자동 플레이·「더 좋음」 표시용 점수: 대략 초당 피해 × 버티는 힘
function gearScore(ch) {
  const S = calcStats(ch);
  const off = S.power * (1 + S.dmgPct / 100 + (S.firePct + S.coldPct) / 300) * (1 + ((S.crit / 100) * S.critDmg) / 100) * (1 + S.cdr / 100);
  const def = S.maxHp * (1 + S.armor / 60) + S.regen * 20;
  let sc = off * Math.sqrt(def) * (1 + S.movePct / 200) * (1 + S.kiRegenPct / 300);
  for (const id in S.ranks) sc *= 1 + 0.04 * S.ranks[id];
  return sc * (1 + 0.08 * S.legends.length);
}
function gainXp(ch, n) {
  let ups = 0;
  if (ch.lvl >= MAX_LVL) return 0;
  ch.xp += n;
  while (ch.lvl < MAX_LVL && ch.xp >= xpNeed(ch.lvl)) {
    ch.xp -= xpNeed(ch.lvl);
    ch.lvl++;
    ups++;
  }
  if (ch.lvl >= MAX_LVL) ch.xp = 0;
  return ups;
}
