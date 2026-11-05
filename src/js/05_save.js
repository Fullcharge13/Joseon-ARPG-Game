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
  if (v === 1) {
    // v0.2: 플레이 기록 칸
    o = {...o, saveVer: 2, ch: {...(o.ch || {}), stats: []}};
    v = 2;
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
  const okRec = r => r && typeof r === 'object' && Number.isFinite(r.floor) && Number.isFinite(r.sec) && STAT_END[r.end] && Array.isArray(r.by) && typeof r.at === 'string';
  ch.stats = (Array.isArray(c.stats) ? c.stats : []).filter(okRec);
  // 층 중간에 앱이 꺼졌으면 그 층을 「중단」으로 옮긴다
  if (okRec(c.curFloor)) ch.stats.push({...c.curFloor, end: 'quit'});
  ch.stats = ch.stats.slice(-STATS_MAX);
  const usable = usableSkills(ch);
  ch.slots = [0, 1, 2, 3].map(i => (Array.isArray(c.slots) && usable.includes(c.slots[i]) ? c.slots[i] : null));
  if (!ch.slots.some(Boolean)) ch.slots[0] = 'meok';
  // 같은 스킬 두 칸 금지
  ch.slots = ch.slots.map((s, i) => (s && ch.slots.indexOf(s) === i ? s : null));
  return ch;
}

/* ======================= 플레이 기록 (v0.2) ======================= */
const STAT_END = {clear: '깸', won: '보스 처치', dead: '쓰러짐', home: '귀환', quit: '중단'};
function srcName(k) {
  if (ENEMIES[k]) return ENEMIES[k].n;
  if (k && k.startsWith('boss:')) return BOSS.n + ' ' + k.slice(5);
  return {burn: '불탐', probe: '시험'}[k] || k;
}
function floorRecord(w, end, dev) {
  const by = Object.entries(w.rs.takenBy || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => [k, Math.round(v)]);
  return {v: GAME_VER, at: new Date().toISOString().slice(0, 16), dev, tier: w.tier, floor: w.floor, sec: Math.round(w.t), end, lvl: w.ch.lvl, kills: w.rs.kills, taken: Math.round(w.rs.taken), by, bossSec: w.bossDead ? Math.round(w.rs.bossT) : 0};
}
function pushStat(ch, rec) {
  ch.stats = ch.stats || [];
  ch.stats.push(rec);
  if (ch.stats.length > STATS_MAX) ch.stats.splice(0, ch.stats.length - STATS_MAX);
}
// 저에게 붙여 줄 요약 글
function statsText(ch) {
  const S = ch.stats || [];
  if (!S.length) return '아직 기록이 없습니다. 백귀사에 한 번 출정하면 층마다 기록이 남습니다.';
  const last = S[S.length - 1];
  const out = [`백귀사 플레이 기록 (${GAME_VER} · ${last.dev} · Lv ${ch.lvl} · 열린 업 ${ch.maxTier}단계 · ${last.at.slice(0, 10)})`];
  const t1 = S.filter(r => r.tier === 1 && (r.end === 'clear' || r.end === 'won'));
  const avg = f => {
    const a = t1.filter(r => r.floor === f).map(r => r.sec);
    return a.length ? `${f}층 ${Math.round(a.reduce((x, y) => x + y, 0) / a.length)}초(${a.length}번)` : `${f}층 -`;
  };
  out.push('업1 층별 평균 시간: ' + [1, 2, 3].map(avg).join(' · '));
  const dead = S.filter(r => r.end === 'dead');
  const quit = S.filter(r => r.end === 'quit').length;
  if (quit) out.push(`중단(층 중간에 앱을 닫음) ${quit}번`);
  out.push(`쓰러짐 ${dead.length}번` + (dead.length ? ` (${dead.map(r => `업${r.tier} ${r.floor}층`).join(', ')})` : ''));
  const boss = S.filter(r => r.bossSec > 0);
  if (boss.length) out.push(`보스 처치 ${boss.length}번 (평균 ${Math.round(boss.reduce((a, r) => a + r.bossSec, 0) / boss.length)}초)`);
  const tot = {};
  for (const r of S) for (const [k, v] of r.by) tot[k] = (tot[k] || 0) + v;
  const sum = Object.values(tot).reduce((a, b) => a + b, 0) || 1;
  out.push('받은 피해 출처: ' + Object.entries(tot).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${srcName(k)} ${Math.round((v / sum) * 100)}%`).join(', '));
  out.push('최근 기록:');
  for (const r of S.slice(-12)) out.push(`- ${r.at.slice(5, 10)} 업${r.tier} ${r.floor}층 ${r.sec}초 ${STAT_END[r.end]} · Lv${r.lvl} · 처치 ${r.kills} · 받은 피해 ${r.taken}${r.by.length ? ' (' + r.by.map(([k, v]) => srcName(k) + ' ' + v).join(', ') + ')' : ''}${r.bossSec ? ' · 보스 ' + r.bossSec + '초' : ''}`);
  return out.join('\n');
}
