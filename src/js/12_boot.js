/* ======================= 출정 흐름과 반복 ======================= */
function startRun(tier) {
  GS.tier = tier;
  GS.floor = 1;
  GS.runSeed = (Math.random() * 1e9) | 0;
  enterFloor(1);
}
function enterFloor(f) {
  const prev = GS.w;
  GS.floor = f;
  GS.w = startFloor(GS.ch, f, GS.tier, GS.runSeed + f);
  if (prev) (GS.w.p.hp = Math.min(GS.w.S.maxHp, prev.p.hp)), (GS.w.p.ki = prev.p.ki);
  R_.seen = new Set();
  GS.mode = 'dungeon';
  GS.modal = null;
  guardInput(0.3);
  showScr('none');
  persist();
  toast(`<b>백귀사 ${f}층</b>${f === FLOORS ? ' — 대장 도깨비가 기다린다' : ''}`);
}
function handleEvents(w) {
  const LAST = {clear: 1, won: 1, dead: 1};
  w.events.sort((a, b) => (LAST[a.k] || 0) - (LAST[b.k] || 0)); // 층 이동 전에 레벨 업 같은 알림을 먼저
  for (const ev of w.events) {
    if (ev.k === 'lvl') toast(`<b style="color:#ffd451">레벨 ${ev.lvl}!</b> 수련점 +1 (K)`);
    else if (ev.k === 'pick' && ev.item.rar >= 1) toast(`<span class="t${ev.item.rar}">${RAR_NAME[ev.item.rar]} ${esc(itemName(ev.item))}</span>${better(ev.item) ? ' <span style="color:#7fe07f">▲</span>' : ''}`);
    else if (ev.k === 'full') toast('가방이 가득 찼다 — 마을에서 팔거나 정리하자');
    else if (ev.k === 'bossStart') toast(`<b style="color:#ff7a6a">${BOSS.n}</b> — 바닥의 붉은 표시를 피하라 (회피)`);
    else if (ev.k === 'phase') toast(`<b style="color:#ff7a6a">${BOSS.n}가 분노했다</b>`);
    else if (ev.k === 'boss') toast('<b style="color:#ffd451">대장 도깨비를 물리쳤다!</b> 빛나는 문으로');
    else if (ev.k === 'clear') {
      w.events = [];
      return enterFloor(GS.floor + 1);
    } else if (ev.k === 'won') {
      const ch = GS.ch;
      const opened = GS.tier + 1 > ch.maxTier;
      ch.maxTier = Math.max(ch.maxTier, GS.tier + 1);
      GS.tierPick = ch.maxTier;
      persist();
      w.events = [];
      return msg('백귀사를 정화했다', `업 ${GS.tier}단계의 대장 도깨비를 물리쳤다.${opened ? `<br><b style="color:#ffd451">업 ${GS.tier + 1}단계가 열렸다.</b> 요괴가 더 세고 좋은 장비가 더 자주 나온다.` : ''}`, [{t: '퇴마청으로', pri: 1, fn: goTown}]);
    } else if (ev.k === 'dead') {
      const ch = GS.ch,
        lost = Math.floor(ch.gold * 0.1);
      ch.gold -= lost;
      persist();
      w.events = [];
      return msg('쓰러졌다', `요괴에게 쓰러졌다. 엽전 ${lost}닢을 잃었다.<br>장비와 레벨은 그대로다. 수련과 장비를 손보고 다시 출정하자.`, [{t: '퇴마청으로', pri: 1, fn: goTown}]);
    }
  }
  w.events = [];
}
let lastT = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const t = ts / 1000;
  const dt = Math.min(0.05, Math.max(0, t - (lastT || t)));
  lastT = t;
  // 느리면 절약 모드
  R_.ft.push(dt);
  if (R_.ft.length > 90) R_.ft.shift();
  if (R_.ft.length === 90 && !R_.lowFx && R_.ft.reduce((a, b) => a + b, 0) / 90 > 1 / 40) R_.lowFx = true;
  const c = R_.ctx;
  if (GS.mode === 'dungeon' && GS.w) {
    const w = GS.w;
    const inp = readInput();
    readMoveCache.mx = inp.mx;
    readMoveCache.my = inp.my;
    if (!GS.modal && !document.hidden) {
      // 고정 걸음(1/60)으로 나눠 계산: 느린 기기에서도 같은 규칙
      let left = dt;
      while (left > 1e-6) {
        const s = Math.min(1 / 60, left);
        update(w, s, inp);
        inp.dodge = false;
        left -= s;
      }
      handleEvents(w);
    }
    if (GS.w) {
      drawWorld(GS.w, t);
      drawHud(GS.w, t);
    }
  } else {
    // 마을·처음 화면 뒤: 등불 흔들리는 어둠
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#120c10';
    c.fillRect(0, 0, R_.cv.width, R_.cv.height);
  }
}
function boot() {
  R_.cv = $('cv');
  resize();
  addEventListener('resize', resize);
  bindInput(R_.cv);
  try {
    GS.mute = localStorage.getItem('baekgwisa-mute') === '1';
  } catch (e) {}
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && GS.mode === 'dungeon') {
      persist();
      if (!GS.modal) openPause();
    }
  });
  $('verTag').textContent = GAME_VER;
  showTitle();
  requestAnimationFrame(frame);
}
if (!globalThis.__NO_BOOT) boot();
