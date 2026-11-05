/* ======================= 입력: 키보드·마우스·터치 ======================= */
const IN = {
  keys: new Set(),
  mouse: {x: 0, y: 0, t: -99, btn: [false, false]},
  touch: false, // 마지막 입력이 터치였나
  joy: null, // {id, ox, oy, x, y}
  held: {}, // 버튼 id → 터치 id
  dodgeTap: false,
  guardUntil: 0
};
// HUD 자리(캔버스 픽셀). u = 화면 1px 당 캔버스 픽셀(dpr)
function hudLayout(W, H, u) {
  const touch = IN.touch;
  const big = (touch ? 62 : 48) * u,
    sm = (touch ? 50 : 40) * u;
  const m = 16 * u,
    sx = W - m - big / 2,
    sy = H - m - big / 2;
  const B = [];
  // 오른쪽 아래 부채꼴: 0번(가장 큼)이 모서리, 1~3 둘레, 회피는 왼쪽 위
  B.push({id: 'k0', x: sx, y: sy, r: big / 2});
  const R = big * 1.25;
  [
    [180, 'k1'],
    [225, 'k2'],
    [270, 'k3']
  ].forEach(([deg, id]) => {
    const a = (deg * Math.PI) / 180;
    B.push({id, x: sx + Math.cos(a) * R, y: sy + Math.sin(a) * R, r: sm / 2});
  });
  B.push({id: 'dodge', x: sx - R * 1.75, y: sy + 2 * u, r: (sm / 2) * 0.9});
  B.push({id: 'pause', x: W - m - 18 * u, y: m + 18 * u, r: 18 * u});
  return B;
}
function hitButton(x, y) {
  const C = R_.cv;
  for (const b of hudLayout(C.width, C.height, R_.u)) if (dist2(x, y, b.x, b.y) < (b.r * 1.15) ** 2) return b.id;
  return null;
}
function readInput() {
  const k = IN.keys;
  let mx = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
  let my = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0);
  if (IN.joy) {
    const dx = IN.joy.x - IN.joy.ox,
      dy = IN.joy.y - IN.joy.oy,
      R = 46 * R_.u,
      d = Math.hypot(dx, dy);
    if (d > 6 * R_.u) (mx = dx / Math.max(d, R)), (my = dy / Math.max(d, R));
  }
  const now = performance.now() / 1000;
  const guard = now < IN.guardUntil;
  const cast = [0, 1, 2, 3].map(i => !guard && (k.has(String(i + 1)) || IN.held['k' + i] !== undefined || (i < 2 && IN.mouse.btn[i] && !IN.touch)));
  let aim = null;
  if (!IN.touch && now - IN.mouse.t < 3 && GS.w) aim = screenToWorld(IN.mouse.x, IN.mouse.y);
  const dodge = !guard && (k.has(' ') || IN.dodgeTap);
  IN.dodgeTap = false;
  return {mx, my, aim, cast, dodge};
}
function guardInput(sec = 0.4) {
  IN.guardUntil = performance.now() / 1000 + sec;
  IN.held = {};
  IN.joy = null;
  IN.mouse.btn = [false, false];
}
// 한글 자판에서는 W가 「ㅈ」로 들어오므로 글자(e.key)가 아니라 자판 위치(e.code)로 읽는다
const CODE_KEY = {KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyI: 'i', KeyK: 'k', KeyP: 'p', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Numpad1: '1', Numpad2: '2', Numpad3: '3', Numpad4: '4', Space: ' ', Escape: 'escape', Tab: 'tab', ArrowUp: 'arrowup', ArrowDown: 'arrowdown', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright'};
const keyOf = e => CODE_KEY[e.code] || String(e.key || '').toLowerCase();
function bindInput(cv) {
  addEventListener('keydown', e => {
    const k = keyOf(e);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(k)) e.preventDefault();
    if (e.repeat) return;
    IN.touch = false;
    unlockAudio();
    if (k === 'escape' || k === 'tab' || k === 'p') return onKeyMenu('pause');
    if (k === 'i') return onKeyMenu('bag');
    if (k === 'k') return onKeyMenu('skill');
    IN.keys.add(k);
  });
  addEventListener('keyup', e => IN.keys.delete(keyOf(e)));
  addEventListener('blur', () => {
    IN.keys.clear();
    IN.held = {};
    IN.joy = null;
    IN.mouse.btn = [false, false];
  });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  const pos = e => {
    const r = cv.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * cv.width, ((e.clientY - r.top) / r.height) * cv.height];
  };
  cv.addEventListener('pointerdown', e => {
    unlockAudio();
    const [x, y] = pos(e);
    IN.touch = e.pointerType === 'touch' || e.pointerType === 'pen';
    if (GS.mode !== 'dungeon' || GS.modal) return;
    if (performance.now() / 1000 < IN.guardUntil) return;
    if (IN.touch) {
      const b = hitButton(x, y);
      if (b === 'pause') return openPause();
      if (b === 'dodge') return void (IN.dodgeTap = true);
      if (b) return void (IN.held[b] = e.pointerId);
      if (x < cv.width * 0.55 && !IN.joy) IN.joy = {id: e.pointerId, ox: x, oy: y, x, y};
    } else {
      if (hitButton(x, y) === 'pause') return openPause();
      IN.mouse.x = x;
      IN.mouse.y = y;
      IN.mouse.t = performance.now() / 1000;
      if (e.button === 0 || e.button === 2) IN.mouse.btn[e.button === 0 ? 0 : 1] = true;
    }
    try {
      cv.setPointerCapture(e.pointerId);
    } catch (er) {}
  });
  cv.addEventListener('pointermove', e => {
    const [x, y] = pos(e);
    if (IN.joy && IN.joy.id === e.pointerId) {
      IN.joy.x = x;
      IN.joy.y = y;
      // 손가락이 멀리 가면 조이스틱 중심이 따라온다
      const R = 46 * R_.u,
        dx = x - IN.joy.ox,
        dy = y - IN.joy.oy,
        d = Math.hypot(dx, dy);
      if (d > R * 1.4) (IN.joy.ox = x - (dx / d) * R * 1.4), (IN.joy.oy = y - (dy / d) * R * 1.4);
    }
    if (e.pointerType === 'mouse') {
      IN.touch = false;
      IN.mouse.x = x;
      IN.mouse.y = y;
      IN.mouse.t = performance.now() / 1000;
    }
  });
  const up = e => {
    if (IN.joy && IN.joy.id === e.pointerId) IN.joy = null;
    for (const k in IN.held) if (IN.held[k] === e.pointerId) delete IN.held[k];
    if (e.pointerType === 'mouse') IN.mouse.btn = [false, false];
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
}
