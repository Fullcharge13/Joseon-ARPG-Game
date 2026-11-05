/* ======================= 화면(마을·가방·수련·대장간·멈춤·알림) ======================= */
const GS = {mode: 'title', ch: null, w: null, modal: null, back: null, sel: null, skSel: null, forgeSel: null, forgeAff: null, forgeLog: '', mute: false, loadStatus: '', tierPick: null, saveWarned: false};
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[ch]);
const ICON_URL = {};
function iconURL(n) {
  if (ICON_URL[n]) return ICON_URL[n];
  const c = icon(n);
  return (ICON_URL[n] = c.toDataURL ? c.toDataURL() : '');
}
function showScr(id) {
  for (const s of document.querySelectorAll('.scr')) s.classList.toggle('on', s.id === id);
}
function toast(html) {
  const t = $('toast');
  const d = document.createElement('div');
  d.innerHTML = html;
  t.appendChild(d);
  setTimeout(() => d.remove(), 2400);
  while (t.children.length > 4) t.children[0].remove();
}
// 화면 안 버튼은 data-a 로 묶는다
function wire(el, acts) {
  el.onclick = e => {
    const b = e.target.closest('[data-a]');
    if (!b || b.disabled) return;
    if (performance.now() / 1000 < IN.guardUntil) return; // 창이 막 열렸을 때 잘못 누름 방지
    const f = acts[b.dataset.a];
    if (f) f(b.dataset.v, b);
  };
}
function persist() {
  if (!GS.ch) return;
  let ok = false;
  try {
    ok = writeSave(localStorage, GS.ch);
  } catch (e) {}
  if (!ok && !GS.saveWarned) {
    GS.saveWarned = true;
    toast('<b style="color:#ff7a6a">저장하지 못했습니다.</b> 사생활 보호(비공개) 창이거나 저장 공간이 꽉 찼는지 확인하세요.');
  }
}

/* --- 처음 화면 --- */
function showTitle() {
  GS.mode = 'title';
  GS.modal = null;
  const r = loadSave(localStorage);
  GS.loadStatus = r.status;
  const has = r.status !== 'new';
  $('b-cont').style.display = has ? '' : 'none';
  $('b-cont').textContent = has ? `이어하기 (Lv ${r.ch.lvl})` : '이어하기';
  $('b-new').textContent = has ? '새로 시작' : '시작하기';
  $('t-hint').innerHTML = (r.status === 'broken' ? '<b style="color:#ff7a6a">저장이 깨져 있어 새로 시작합니다(깨진 저장은 따로 보관).</b><br>' : '') + 'PC: WASD 이동 · 마우스로 조준 · 좌클릭/우클릭/1~4 스킬 · Space 회피 · I 가방 · K 수련 · Esc 멈춤<br>휴대폰: 가로로 돌려 주세요. 왼손 조이스틱 · 오른손 스킬(가까운 요괴 자동 조준)';
  showScr('s-title');
  $('b-cont').onclick = () => {
    GS.ch = r.ch;
    if (r.status === 'migrated') persist();
    goTown();
  };
  $('b-new').onclick = () => {
    if (!has) return startNew();
    msg('새로 시작', '지금 캐릭터(Lv ' + r.ch.lvl + ')를 지우고 처음부터 시작할까요?', [
      {t: '아니오', fn: showTitle},
      {t: '지우고 시작', pri: 1, fn: startNew}
    ]);
  };
}
function startNew() {
  GS.ch = newChar();
  persist();
  goTown();
}

/* --- 마을: 퇴마청 --- */
function goTown() {
  if (GS.mode === 'dungeon') recordFloor('home'); // 멈춤 → 마을로(이미 기록한 층이면 건너뜀)
  GS.mode = 'town';
  GS.w = null;
  GS.modal = null;
  GS.back = 'town';
  persist();
  const ch = GS.ch,
    S = calcStats(ch);
  GS.tierPick = Math.min(GS.tierPick || ch.maxTier, ch.maxTier);
  const tiers = Array.from({length: ch.maxTier}, (_, i) => i + 1);
  const el = $('s-town');
  el.innerHTML = `<div class="box"><div class="hd"><h2>퇴마청 退魔廳</h2><span class="pill">엽전 ${ch.gold}</span></div>
  <div class="bd"><div class="split">
   <div class="card town-card" style="background:var(--panel2);border:2px solid var(--line);padding:10px;border-radius:3px">
    <div class="stat"><span>선비</span><b>Lv ${ch.lvl}${ch.lvl >= MAX_LVL ? ' (최고)' : ` · 경험 ${Math.floor(ch.xp)}/${xpNeed(ch.lvl)}`}</b></div>
    <div class="stat"><span>체력 · 기력</span><b>${Math.round(S.maxHp)} · ${S.maxKi}</b></div>
    <div class="stat"><span>공력 · 방어</span><b>${S.power.toFixed(1)} · ${Math.round(S.armor)}</b></div>
    <div class="stat"><span>치명타</span><b>${S.crit}% · +${S.critDmg}%</b></div>
    <div class="stat"><span>열린 업 단계</span><b>${ch.maxTier}단계</b></div>
    <p class="note">백귀사(百鬼寺)는 요괴가 들끓는 폐사찰이다. 3층 끝의 대장 도깨비를 물리치면 더 깊은 업(業) 단계가 열린다. 단계가 높을수록 요괴가 세고 좋은 장비가 자주 나온다.</p>
   </div>
   <div class="town">
    <button class="pri" data-a="go" style="grid-column:1/-1">출정 — 백귀사</button>
    ${ch.maxTier > 1 ? `<label class="note" style="grid-column:1/-1">업 단계 <select id="tierSel">${tiers.map(t => `<option value="${t}" ${t === GS.tierPick ? 'selected' : ''}>${t}단계 (요괴 Lv ${monLevel(1, t)}~${monLevel(3, t)})</option>`).join('')}</select></label>` : ''}
    <button data-a="bag">가방 ${ch.bag.length}/${BAG_MAX}</button>
    <button data-a="skill">수련${freePoints(ch) > 0 ? ` <b style="color:#ffd451">+${freePoints(ch)}</b>` : ''}</button>
    <button data-a="forge">대장간</button>
    <button data-a="stats">기록${ch.stats && ch.stats.length ? ' ' + ch.stats.length : ''}</button>
    <button data-a="title">처음 화면</button>
   </div></div></div></div>`;
  showScr('s-town');
  const sel = $('tierSel');
  if (sel) sel.onchange = () => (GS.tierPick = +sel.value);
  wire(el, {
    go: () => startRun(GS.tierPick || 1),
    bag: () => openBag('town'),
    skill: () => openSkill('town'),
    forge: openForge,
    stats: openStats,
    title: showTitle
  });
}

/* --- 가방 --- */
function slotHTML(it, label, sel, up) {
  if (!it) return `<div class="slot" data-a="none"><span class="lb">${label || ''}</span></div>`;
  return `<div class="slot r${it.rar} ${sel ? 'sel' : ''}" data-a="sel" data-v="${it.uid}"><img src="${iconURL(it.slot)}" alt="">${up ? '<span class="up">▲</span>' : ''}${label ? `<span class="lb">${label}</span>` : ''}</div>`;
}
function findItem(uid) {
  uid = +uid;
  const ch = GS.ch;
  for (const s of SLOTS) if (ch.equip[s] && ch.equip[s].uid === uid) return {it: ch.equip[s], where: 'equip'};
  const i = ch.bag.findIndex(x => x.uid === uid);
  return i >= 0 ? {it: ch.bag[i], where: 'bag', i} : null;
}
function itemDetail(it, cmp) {
  let h = `<h3 class="t${it.rar}">${esc(itemName(it))}</h3><div class="note">${RAR_NAME[it.rar]} ${SLOT_NAME[it.slot]} · 장비 Lv ${it.il}</div>`;
  if (it.power) h += `<div>공력 ${it.power}</div>`;
  if (it.armor) h += `<div>방어 ${it.armor} · 체력 +${it.hp}</div>`;
  if (it.ki) h += `<div>기력 +${it.ki}</div>`;
  for (const a of it.affixes) h += `<div class="aff">${esc(affixText(a))}</div>`;
  if (it.legend) h += `<div class="leg">◆ ${LEGENDS[it.legend].n}: ${LEGENDS[it.legend].d}</div>`;
  if (cmp) {
    const lines = compareLines(GS.ch, it);
    h += `<div class="cmp">입으면: ${lines.length ? lines.map(l => colorCmp(l)).join('<br>') : '달라지는 것 없음'}</div>`;
  }
  return h;
}
function colorCmp(l) {
  const m = l.match(/(-?[\d.]+)%? → (-?[\d.]+)%?$/);
  if (m) return `<span class="${+m[2] > +m[1] ? 'g' : 'b'}">${esc(l)}</span>`;
  return `<span class="${l.includes('생김') ? 'g' : 'b'}">${esc(l)}</span>`;
}
function better(it) {
  const ch = GS.ch;
  const tmp = {...ch, equip: {...ch.equip, [it.slot]: it}};
  return gearScore(tmp) > gearScore(ch) * 1.001;
}
function openBag(back) {
  GS.back = back;
  GS.modal = 'bag';
  guardInput();
  renderBag();
}
function renderBag() {
  const ch = GS.ch,
    el = $('s-bag');
  const inTown = GS.mode === 'town';
  const sel = GS.sel && findItem(GS.sel);
  const eq = SLOTS.map(s => slotHTML(ch.equip[s], SLOT_NAME[s], sel && sel.it === ch.equip[s])).join('');
  const bag = ch.bag.map(it => slotHTML(it, '', sel && sel.it === it, better(it))).join('') + Array.from({length: BAG_MAX - ch.bag.length}, () => '<div class="slot" style="opacity:.35"></div>').join('');
  let act = '';
  if (sel) {
    act = sel.where === 'bag' ? `<button class="pri" data-a="wear">입기</button>` : ch.bag.length < BAG_MAX && sel.it.slot !== 'weapon' ? `<button data-a="off">벗기</button>` : '';
    if (inTown && sel.where === 'bag') act += `<button data-a="sell">팔기 (엽전 ${sellPrice(sel.it)})</button>`;
    if (!inTown && GS.w && sel.where === 'bag') act += `<button data-a="drop">바닥에 내려놓기</button>`;
  }
  const junk = ch.bag.filter(it => it.rar <= 1 && !better(it));
  el.innerHTML = `<div class="box"><div class="hd"><h2>가방</h2><span class="pill">엽전 ${ch.gold}</span><button class="x" data-a="close">✕</button></div>
   <div class="bd"><div class="split"><div>
    <div class="note">입은 장비</div><div class="equip">${eq}</div>
    <div class="note">가방 ${ch.bag.length}/${BAG_MAX} · <span style="color:#7fe07f">▲</span> 지금보다 좋음</div><div class="bag">${bag}</div>
   </div><div>${sel ? `<div class="detail">${itemDetail(sel.it, sel.where === 'bag')}</div>` : '<div class="detail note">장비를 누르면 자세히 보고, 입었을 때 무엇이 「지금 → 바뀐 뒤」로 달라지는지 볼 수 있습니다.</div>'}</div></div></div>
   <div class="ft">${inTown && junk.length ? `<button data-a="selljunk">일반·마법 중 안 좋은 것 ${junk.length}개 팔기</button>` : ''}${act}<button data-a="close">닫기</button></div></div>`;
  showScr('s-bag');
  wire(el, {
    sel: v => ((GS.sel = +v), renderBag()),
    none: () => ((GS.sel = null), renderBag()),
    close: closeModal,
    wear: () => {
      const f = findItem(GS.sel);
      if (!f || f.where !== 'bag') return;
      const old = ch.equip[f.it.slot];
      ch.bag.splice(f.i, 1);
      if (old) ch.bag.push(old);
      ch.equip[f.it.slot] = f.it;
      afterGearChange();
      sfx('equip');
      renderBag();
    },
    off: () => {
      const f = findItem(GS.sel);
      if (!f || f.where !== 'equip' || ch.bag.length >= BAG_MAX || f.it.slot === 'weapon') return;
      delete ch.equip[f.it.slot];
      ch.bag.push(f.it);
      afterGearChange();
      renderBag();
    },
    drop: () => {
      const f = findItem(GS.sel);
      if (!f || f.where !== 'bag' || !GS.w) return;
      ch.bag.splice(f.i, 1);
      dropItem(GS.w, GS.w.p.x, GS.w.p.y, f.it, {hold: 1});
      GS.sel = null;
      persist();
      renderBag();
    },
    sell: () => {
      const f = findItem(GS.sel);
      if (!f || f.where !== 'bag') return;
      ch.gold += sellPrice(f.it);
      ch.bag.splice(f.i, 1);
      GS.sel = null;
      sfx('coin');
      persist();
      renderBag();
    },
    selljunk: () => {
      let g = 0;
      ch.bag = ch.bag.filter(it => {
        if (it.rar <= 1 && !better(it)) return (g += sellPrice(it)), false;
        return true;
      });
      ch.gold += g;
      GS.sel = null;
      toast(`엽전 +${g}`);
      sfx('coin');
      persist();
      renderBag();
    }
  });
}
function afterGearChange() {
  // 단계 옵션을 벗어 쓸 수 없게 된 스킬은 칸에서 내린다
  const ok = usableSkills(GS.ch);
  GS.ch.slots = GS.ch.slots.map(s => (s && ok.includes(s) ? s : null));
  if (!GS.ch.slots.some(Boolean)) GS.ch.slots[0] = 'meok';
  if (GS.w) refreshStats(GS.w);
  persist();
}

/* --- 수련(스킬 트리) --- */
function openSkill(back) {
  GS.back = back;
  GS.modal = 'skill';
  GS.skSel = null;
  guardInput();
  renderSkill();
}
function renderSkill() {
  const ch = GS.ch,
    el = $('s-skill'),
    S = calcStats(ch),
    fp = freePoints(ch);
  const inTown = GS.mode === 'town';
  const rows = SKILL_IDS.map(id => {
    const sk = SKILLS[id],
      s = ch.skills[id] || {rank: 0, br: 0},
      eff = S.ranks[id] || 0;
    const bonus = eff - s.rank;
    const pips = '●'.repeat(s.rank) + '○'.repeat(SKILL_MAX - s.rank) + (bonus > 0 ? ` <span style="color:#9fc6ff">+${bonus}</span>` : '');
    const brs = sk.br.map((b, i) => `<button class="br ${s.br === i + 1 ? 'on' : ''}" data-a="br" data-v="${id}:${i + 1}" ${s.rank < BRANCH_AT || (!inTown && s.br && s.br !== i + 1) ? 'disabled' : ''} title="${esc(b.d)}">${b.n}</button>`).join('');
    const brText = s.br ? `<div class="ds" style="color:#ffd451">갈래 「${sk.br[s.br - 1].n}」: ${sk.br[s.br - 1].d}</div>` : `<div class="ds">${BRANCH_AT}단계에서 갈래 선택: ${sk.br.map(b => `「${b.n}」 ${b.d}`).join(' / ')}</div>`;
    const cost = sk.cost ? `기력 ${sk.cost}` : '기력 +' + sk.gain;
    return `<div class="sk ${GS.skSel === id ? 'pick' : ''}"><img src="${iconURL(id)}" alt=""><div style="flex:1">
      <div class="nm">${sk.name} <span class="pips">${pips}</span></div>
      <div class="ds">${sk.desc} · ${cost} · 재사용 ${sk.cd}초${eff ? ` · 피해 계수 ×${(sk.coef * rankMul(eff)).toFixed(2)}` : ''}</div>${brText}
      <div class="ctl"><button data-a="learn" data-v="${id}" ${fp <= 0 || s.rank >= SKILL_MAX ? 'disabled' : ''}>배우기 (${s.rank} → ${Math.min(SKILL_MAX, s.rank + 1)})</button>${brs}
      <button data-a="pick" data-v="${id}" ${eff ? '' : 'disabled'}>칸에 놓기</button></div></div></div>`;
  }).join('');
  const slots = ch.slots.map((id, i) => `<div class="slot ${GS.skSel ? 'sel' : ''}" data-a="slot" data-v="${i}">${id ? `<img src="${iconURL(id)}" alt="">` : ''}<span class="lb">${['1·좌', '2·우', '3', '4'][i]}</span></div>`).join('');
  el.innerHTML = `<div class="box"><div class="hd"><h2>수련</h2><span class="pill">수련점 ${fp}</span><button class="x" data-a="close">✕</button></div>
   <div class="bd"><div class="note">버튼 칸 ${GS.skSel ? `— <b style="color:#fff">「${SKILLS[GS.skSel].name}」을(를) 놓을 칸을 누르세요</b>` : '(스킬의 「칸에 놓기」를 누른 뒤 칸을 고릅니다. 칸을 누르면 비웁니다)'}</div>
   <div class="slots4">${slots}</div>${rows}</div>
   <div class="ft">${inTown ? '<button data-a="respec">수련점 모두 돌려받기(무료)</button>' : '<span class="note" style="margin-right:auto">갈래 바꾸기·재배분은 마을에서</span>'}<button data-a="close">닫기</button></div></div>`;
  showScr('s-skill');
  wire(el, {
    close: closeModal,
    learn: id => {
      if (learn(ch, id)) sfx('equip');
      afterGearChange();
      renderSkill();
    },
    br: v => {
      const [id, b] = v.split(':');
      if (GS.mode !== 'town' && ch.skills[id] && ch.skills[id].br) return; // 갈래 바꾸기는 마을에서
      chooseBranch(ch, id, +b);
      afterGearChange();
      renderSkill();
    },
    pick: id => ((GS.skSel = GS.skSel === id ? null : id), renderSkill()),
    slot: i => {
      i = +i;
      if (GS.skSel) {
        const j = ch.slots.indexOf(GS.skSel);
        if (j >= 0) ch.slots[j] = ch.slots[i];
        ch.slots[i] = GS.skSel;
        GS.skSel = null;
      } else if (ch.slots.filter(Boolean).length > 1) ch.slots[i] = null;
      afterGearChange();
      renderSkill();
    },
    respec: () => {
      respec(ch);
      afterGearChange();
      renderSkill();
    }
  });
}

/* --- 대장간: 옵션 하나 다시 굴리기 --- */
function openForge() {
  GS.modal = 'forge';
  GS.back = 'town';
  GS.forgeSel = null;
  GS.forgeAff = null;
  GS.forgeLog = '';
  guardInput();
  renderForge();
}
function renderForge() {
  const ch = GS.ch,
    el = $('s-forge');
  const items = [...SLOTS.map(s => ch.equip[s]).filter(Boolean), ...ch.bag].filter(it => it.affixes.length);
  const sel = GS.forgeSel && findItem(GS.forgeSel);
  let right = '<div class="detail note">옵션이 붙은 장비를 고르고, 바꿀 옵션 하나를 고르면 엽전을 내고 다른 옵션으로 다시 굴립니다. 같은 장비를 다시 굴릴수록 값이 오릅니다.</div>';
  if (sel) {
    const it = sel.it,
      cost = rerollCost(it);
    right = `<div class="detail"><h3 class="t${it.rar}">${esc(itemName(it))}</h3>${it.affixes
      .map((a, i) => `<div><button style="width:100%;text-align:left;margin:2px 0" class="${GS.forgeAff === i ? 'br on' : ''}" data-a="aff" data-v="${i}">${esc(affixText(a))}</button></div>`)
      .join('')}${it.legend ? `<div class="leg">◆ ${LEGENDS[it.legend].n} (전설 효과는 그대로)</div>` : ''}
      <div class="cmp">${GS.forgeLog || ''}</div></div>
      <div class="ft" style="padding:8px 0"><button class="pri" data-a="roll" ${GS.forgeAff == null || ch.gold < cost ? 'disabled' : ''}>다시 굴리기 (엽전 ${cost} / 가진 엽전 ${ch.gold})</button></div>`;
  }
  el.innerHTML = `<div class="box"><div class="hd"><h2>대장간</h2><span class="pill">엽전 ${ch.gold}</span><button class="x" data-a="close">✕</button></div>
   <div class="bd"><div class="split"><div><div class="bag">${items.map(it => slotHTML(it, '', sel && sel.it === it)).join('') || '<span class="note">옵션이 붙은 장비가 없습니다.</span>'}</div></div><div>${right}</div></div></div>
   <div class="ft"><button data-a="close">닫기</button></div></div>`;
  showScr('s-forge');
  wire(el, {
    close: closeModal,
    sel: v => ((GS.forgeSel = +v), (GS.forgeAff = null), (GS.forgeLog = ''), renderForge()),
    aff: i => ((GS.forgeAff = +i), renderForge()),
    roll: () => {
      const f = findItem(GS.forgeSel);
      if (!f || GS.forgeAff == null) return;
      const cost = rerollCost(f.it);
      if (ch.gold < cost) return;
      const nx = rerollAffix(Math.random, f.it, GS.forgeAff);
      if (!nx) return;
      ch.gold -= cost;
      GS.forgeLog = `${esc(affixText(f.it.affixes[GS.forgeAff]))} → <b style="color:#ffd451">${esc(affixText(nx.affixes[GS.forgeAff]))}</b>`;
      if (f.where === 'equip') ch.equip[f.it.slot] = nx;
      else ch.bag[f.i] = nx;
      GS.forgeSel = nx.uid;
      sfx('forge');
      afterGearChange();
      renderForge();
    }
  });
}

/* --- 멈춤·알림 --- */
function openPause() {
  if (GS.mode !== 'dungeon' || GS.modal) return;
  GS.modal = 'pause';
  guardInput();
  const el = $('s-pause');
  el.innerHTML = `<div class="box small"><div class="hd"><h2>멈춤</h2></div><div class="bd" style="display:flex;flex-direction:column;gap:8px">
   <button class="pri" data-a="resume">계속하기</button><button data-a="bag">가방 (I)</button><button data-a="skill">수련 (K)${freePoints(GS.ch) > 0 ? ' +' + freePoints(GS.ch) : ''}</button>
   <button data-a="mute">소리 ${GS.mute ? '켜기' : '끄기'}</button><button data-a="home">마을로 돌아가기</button>
   <p class="note">마을로 돌아가면 이번 출정의 층 진행은 사라지지만, 주운 장비·엽전·레벨은 남습니다.</p></div></div>`;
  showScr('s-pause');
  wire(el, {
    resume: closeModal,
    bag: () => openBag('pause'),
    skill: () => openSkill('pause'),
    mute: () => {
      GS.mute = !GS.mute;
      try {
        localStorage.setItem('baekgwisa-mute', GS.mute ? '1' : '');
      } catch (e) {}
      GS.modal = null;
      openPause();
    },
    home: () => goTown()
  });
}
function msg(title, html, buttons) {
  GS.modal = 'msg';
  guardInput(0.5);
  const el = $('s-msg');
  el.innerHTML = `<div class="box small"><div class="hd"><h2>${title}</h2></div><div class="bd note" style="color:var(--ink);font-size:15px">${html}</div><div class="ft">${buttons.map((b, i) => `<button ${b.pri ? 'class="pri"' : ''} data-a="b${i}">${b.t}</button>`).join('')}</div></div>`;
  showScr('s-msg');
  const acts = {};
  buttons.forEach((b, i) => (acts['b' + i] = () => ((GS.modal = null), b.fn())));
  wire(el, acts);
}
function closeModal() {
  GS.sel = null;
  GS.modal = null;
  guardInput(0.25);
  if (GS.mode === 'town') return goTown();
  if (GS.back === 'pause' && GS.mode === 'dungeon') {
    GS.back = null;
    return openPause();
  }
  showScr('none');
}
function onKeyMenu(which) {
  if (GS.mode === 'dungeon') {
    if (GS.modal) {
      if (GS.modal !== 'msg') {
        GS.back = null;
        closeModalToGame();
      }
      return;
    }
    if (which === 'pause') return openPause();
    GS.back = null;
    return which === 'bag' ? openBag(null) : openSkill(null);
  }
  if (GS.mode === 'town') {
    if (GS.modal && GS.modal !== 'msg') return closeModal();
    if (!GS.modal && which === 'bag') return openBag('town');
    if (!GS.modal && which === 'skill') return openSkill('town');
  }
}
function closeModalToGame() {
  GS.sel = null;
  GS.modal = null;
  guardInput(0.25);
  showScr('none');
}

/* --- 기록(v0.2): 사람이 해 본 층 시간·쓰러짐·받은 피해를 저에게 붙여 줄 수 있게 --- */
function openStats() {
  GS.modal = 'stats';
  GS.back = 'town';
  guardInput();
  const ch = GS.ch,
    el = $('s-stats'),
    S = (ch.stats || []).slice().reverse();
  const rows = S.map(r => `<tr><td>${r.at.slice(5, 10)}</td><td>업${r.tier} ${r.floor}층</td><td>${r.sec}초</td><td class="${r.end === 'dead' ? 'bad' : r.end === 'won' ? 'good' : ''}">${STAT_END[r.end]}</td><td>Lv${r.lvl}</td><td>${r.kills}</td><td>${r.taken}</td><td>${r.by.length ? esc(srcName(r.by[0][0])) : '-'}</td></tr>`).join('');
  el.innerHTML = `<div class="box"><div class="hd"><h2>기록</h2><span class="pill">최근 ${S.length}/${STATS_MAX}층</span><button class="x" data-a="close">✕</button></div>
   <div class="bd"><p class="note">층마다 걸린 시간·쓰러짐·받은 피해가 남습니다. 「기록 복사」를 눌러 대화창에 붙여 주시면 수치를 사람 기준으로 맞춥니다.</p>
   ${S.length ? `<div class="tbl"><table><thead><tr><th>날짜</th><th>층</th><th>시간</th><th>결과</th><th>레벨</th><th>처치</th><th>받은 피해</th><th>가장 아팠던 것</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="note">아직 기록이 없습니다.</p>'}
   <textarea id="statsTxt" readonly hidden>${esc(statsText(ch))}</textarea></div>
   <div class="ft"><button class="pri" data-a="copy" ${S.length ? '' : 'disabled'}>기록 복사</button><button data-a="close">닫기</button></div></div>`;
  showScr('s-stats');
  wire(el, {
    close: closeModal,
    copy: () => {
      const txt = statsText(ch),
        ta = $('statsTxt');
      const manual = () => {
        ta.hidden = false;
        ta.focus();
        ta.select();
        toast('글 상자를 길게 눌러 복사하세요');
      };
      try {
        navigator.clipboard.writeText(txt).then(() => toast('<b>기록을 복사했습니다.</b> 대화창에 붙여 주세요'), manual);
      } catch (e) {
        manual();
      }
    }
  });
}
