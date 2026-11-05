/* ======================= 저장 ======================= */
function writeSave(st, ch) {
  try {
    st.setItem(SAVE_KEY, JSON.stringify({saveVer: SAVE_VER, ver: GAME_VER, ch}));
    return true;
  } catch (e) {
    return false;
  }
}
function loadSave(st) {
  let raw = null;
  try {
    raw = st.getItem(SAVE_KEY);
  } catch (e) {}
  if (raw == null || raw === '') return {status: 'new', ch: newChar()};
  let obj;
  try {
    obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') throw 0;
  } catch (e) {
    try {
      st.setItem(SAVE_KEY + '-broken', raw);
    } catch (e2) {}
    return {status: 'broken', ch: newChar()};
  }
  const migrated = !obj.saveVer || obj.saveVer < SAVE_VER;
  const ch = sanitizeChar(migrateSave(obj));
  return {status: migrated ? 'migrated' : 'ok', ch};
}
// 판마다 옮기는 단계를 하나씩 쌓는다
function migrateSave(obj) {
  let v = obj.saveVer || 0;
  let o = obj;
  if (v === 0) {
    o = {saveVer: 1, ch: obj};
    v = 1;
  }
  return o.ch || {};
}
const numOr = (v, d, lo = -Infinity, hi = Infinity) => {
  const n = Number(v);
  return Number.isFinite(n) ? clamp(n, lo, hi) : d;
};
function sanitizeItem(it) {
  if (!it || typeof it !== 'object' || !SLOTS.includes(it.slot)) return null;
  const out = {
    uid: numOr(it.uid, 0) || ITEM_SEQ++,
    slot: it.slot,
    il: numOr(it.il, 1, 1, 200),
    rar: numOr(it.rar, 0, 0, 3),
    base: typeof it.base === 'string' ? it.base : BASES[it.slot][0],
    affixes: (Array.isArray(it.affixes) ? it.affixes : []).filter(a => a && AFFIXES[a.k] && AFFIXES[a.k].slots.includes(it.slot)).map(a => ({k: a.k, v: numOr(a.v, 1)})),
    rr: numOr(it.rr, 0, 0)
  };
  for (const k of ['power', 'armor', 'hp', 'ki']) if (it[k] != null) out[k] = numOr(it[k], 0, 0);
  if (it.legend && LEGENDS[it.legend]) out.legend = it.legend;
  ITEM_SEQ = Math.max(ITEM_SEQ, out.uid + 1);
  return out;
}
function sanitizeChar(c) {
  const ch = newChar();
  if (!c || typeof c !== 'object') return ch;
  ch.lvl = Math.round(numOr(c.lvl, 1, 1, MAX_LVL));
  ch.xp = numOr(c.xp, 0, 0);
  ch.gold = Math.round(numOr(c.gold, 0, 0));
  ch.tier = Math.round(numOr(c.tier, 1, 1, 999));
  ch.maxTier = Math.max(ch.tier, Math.round(numOr(c.maxTier, 1, 1, 999)));
  if (c.skills && typeof c.skills === 'object')
    for (const [id, s] of Object.entries(c.skills)) {
      if (!SKILLS[id] || !s) continue;
      const rank = Math.round(numOr(s.rank, 0, 0, SKILL_MAX));
      if (rank > 0) ch.skills[id] = {rank, br: [0, 1, 2].includes(s.br) && rank >= BRANCH_AT ? s.br : 0};
    }
  if (!ch.skills.meok || ch.skills.meok.rank < 1) ch.skills.meok = {rank: 1, br: 0};
  while (spentPoints(ch) > ch.lvl - 1) respec(ch); // 점수가 넘치면 되돌려 준다
  if (c.equip && typeof c.equip === 'object')
    for (const slot of SLOTS) {
      const it = sanitizeItem(c.equip[slot]);
      if (it && it.slot === slot) ch.equip[slot] = it;
    }
  ch.bag = (Array.isArray(c.bag) ? c.bag : []).map(sanitizeItem).filter(Boolean).slice(0, BAG_MAX);
  const usable = usableSkills(ch);
  ch.slots = [0, 1, 2, 3].map(i => (Array.isArray(c.slots) && usable.includes(c.slots[i]) ? c.slots[i] : null));
  if (!ch.slots.some(Boolean)) ch.slots[0] = 'meok';
  // 같은 스킬 두 칸 금지
  ch.slots = ch.slots.map((s, i) => (s && ch.slots.indexOf(s) === i ? s : null));
  return ch;
}
