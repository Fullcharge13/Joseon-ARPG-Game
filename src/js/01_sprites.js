/* ======================= 코드 도트 =======================
   틀(mk·선비 조립·요괴 틀 5종)은 조선퇴마록 src/js/01_sprites.js 에서 가져옴(같은 작가의 코드) */
const PAL = {k: '#1a1418', w: '#efe6d2', s: '#e8b98f', r: '#c23b2a', R: '#7a2018', g: '#3f9a5a', G: '#1d4d42', b: '#3a5f9e', B: '#1a2b4a', y: '#e0b048', o: '#b0702e', n: '#4a3a30', x: '#8a8494', X: '#4a4552', c: '#8fd3ff', p: '#b07fd0'};
function canvasOf(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
function mk(rows, pal = PAL) {
  const h = rows.length,
    w = Math.max(...rows.map(r => r.length));
  const c = canvasOf(w, h);
  const x = c.getContext('2d');
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) {
      const ch = r[i];
      if (ch !== '.' && pal[ch]) {
        x.fillStyle = pal[ch];
        x.fillRect(i, j, 1, 1);
      }
    }
  });
  return c;
}
// 바깥 빈칸에 1칸 어두운 테두리(밤 바닥 위에서도 보이게)
function outline(src, col = '#120c10') {
  const w = src.width + 2,
    h = src.height + 2;
  const c = canvasOf(w, h),
    x = c.getContext('2d');
  const d = src.getContext('2d').getImageData(0, 0, src.width, src.height).data;
  x.fillStyle = col;
  for (let j = 0; j < src.height; j++)
    for (let i = 0; i < src.width; i++) if (d[(j * src.width + i) * 4 + 3] > 0) x.fillRect(i, j, 3, 3);
  x.drawImage(src, 1, 1);
  return c;
}
function flipH(src) {
  const c = canvasOf(src.width, src.height),
    x = c.getContext('2d');
  x.translate(src.width, 0);
  x.scale(-1, 1);
  x.drawImage(src, 0, 0);
  return c;
}
function whiteOf(src) {
  const c = canvasOf(src.width, src.height),
    x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

/* --- 선비: 갓 + 얼굴 + 흰 도포 + 붓 (조선퇴마록 charSpr 의 선비 1차 모습) --- */
const HAT_GAT = ['...HHHH...', '...HHHH...', 'HHHHHHHHHH'];
const FACE = ['...ssss...', '...sksk...', '...ssss...'];
const BODY = ['..AAAAAA..', '.AAATTAAA.', '.sAAAAAAs.', '..ALLLLA..', '..AAAAAA..', '..AA..AA..', '..kk..kk..'];
const LEGS = [
  ['..AA..AA..', '..kk..kk..'],
  ['.AA....AA.', '.kk....kk.'],
  ['...AAAA...', '...kkkk...']
];
const BRUSH = [
  [10, 6, 'k'],
  [10, 7, 'n'],
  [10, 8, 'n'],
  [10, 9, 'n']
];
function seonbiFrame(legs, look) {
  const pal = {...PAL, H: '#1a1418', h: '#e0b048', A: look.A, T: look.T, L: '#1a1418'};
  const body = BODY.slice(0, 5).concat(LEGS[legs]);
  const g = [...HAT_GAT, ...FACE, ...body].map(r => ('.' + r + '.').split(''));
  for (const [x, y, c] of BRUSH) g[y][x] = c;
  return outline(mk(g.map(r => r.join('')), pal));
}

/* --- 요괴 틀(A 주색 · B 보조색) --- */
const TPL = {
  wisp: ['...A...', '..AAA..', '.ABABA.', '.AAABA.', 'ABAwABA', 'ABwwwBA', '.AwwwA.', '..AAA..'],
  blob: ['..AAAA..', '.AAAAAA.', 'AAwAAwAA', 'AArAArAA', 'AAAAAAAA', '.AAAAAA.', 'A.A..A.A'],
  goblin: [
    '....y.....',
    '...AAA....',
    '..AAAAAB..',
    '..AwAwAB..',
    '..AAAAA.B.',
    '..ArrrA.B.',
    '.AAAAAAA..',
    '.A.AAA.A..',
    '...AAA....',
    '...A.A....',
    '..kk.kk...'
  ],
  ghost: [
    '..kkkk..',
    '.kkkkkk.',
    '.kAkkAk.',
    '.kAAAAk.',
    '.krAArk.',
    '.kAAAAk.',
    '.BBBBBB.',
    'BBBBBBBB',
    '.BBBBBB.',
    '.BBBBBB.',
    '..B.BB.B',
    '.B..B...'
  ],
  fox: [
    '.A.A........',
    '.AAA......ww',
    'AAkAA....wAw',
    'AAAAAAAAAAA.',
    '.AAAAAAAAA..',
    '.AwwAAAAAA..',
    '..A.A..A.A..',
    '..k.k..k.k..'
  ]
};
const LEFT_FACING = new Set(['fox']);

/* --- 아이콘: 장비 4부위, 스킬 5개 --- */
const ICON_ROWS = {
  weapon: ['........yk', '.......yk.', '......nn..', '.....nn...', '....nn....', '...nn.....', '..nn......', '.ww.......', 'wkw.......', '.k........'],
  hat: ['..........', '...kkkk...', '...kkkk...', '...kkkk...', 'kkkkkkkkkk', '.kkkkkkkk.', '..........', '...y..y...', '....yy....', '..........'],
  robe: ['..wwwwww..', '.wwwbbwww.', 'wwwwbbwwww', 'w.wwwwww.w', 'w.wkkkkw.w', '..wwwwww..', '..wwwwww..', '..wwwwww..', '..ww..ww..', '..........'],
  charm: ['....yy....', '...y..y...', '....yy....', '....rr....', '...rrrr...', '..rrggrr..', '...rrrr...', '....rr....', '...r.r.r..', '..r..r..r.'],
  meok: ['..........', '...kkkk...', '..kkXkkk..', '.kkXXkkkk.', '.kkkkkkkk.', '.kkkkkkkk.', '..kkkkkk..', '...kkkk...', '..........', '..........'],
  hwa: ['.yyyyyyy..', '.yrrrrry..', '.yyyyyyy..', '.yyrryyy..', '.yrryrry..', '.yyrrryy..', '.yyyryyy..', '.yryryry..', '.yyyyyyy..', '...r.r....'],
  ilpil: ['.........k', '........kk', '.......kk.', '.....kkk..', '....kkk...', '..kkkk....', '.kkkk.....', 'kkkk......', 'kk........', '..........'],
  hanseol: ['....c.....', '.c..c..c..', '..c.c.c...', '...ccc....', 'ccccwcccc.', '...ccc....', '..c.c.c...', '.c..c..c..', '....c.....', '..........'],
  gyeol: ['...yyyy...', '..y....y..', '.y..yy..y.', 'y..y..y..y', 'y.y.rr.y.y', 'y.y.rr.y.y', 'y..y..y..y', '.y..yy..y.', '..y....y..', '...yyyy...']
};
const ICONS = {};
function icon(name) {
  return ICONS[name] || (ICONS[name] = outline(mk(ICON_ROWS[name]), '#a8967a')); // 밝은 테두리: 검은 먹·갓도 어두운 바탕에서 보이게
}

/* --- 그림 묶음(처음 쓸 때 한 번 만든다) --- */
let ART = null;
function art() {
  if (ART) return ART;
  ART = {player: [], ens: {}, tiles: null};
  const look = {A: '#efe6d2', T: '#efe6d2'};
  for (let i = 0; i < 3; i++) {
    const R = seonbiFrame(i, look);
    ART.player.push({R, L: flipH(R), W: whiteOf(R)});
  }
  ART.tiles = makeTiles();
  return ART;
}
function enemyArt(D, elite) {
  const key = D.n + (elite ? '*' : '');
  const A = art();
  if (A.ens[key]) return A.ens[key];
  const pal = {...PAL, A: D.A, B: D.B || D.A};
  let base = outline(mk(TPL[D.t], pal), elite ? '#3a0a0a' : '#120c10');
  if (LEFT_FACING.has(D.t)) base = flipH(base);
  return (A.ens[key] = {R: base, L: flipH(base), W: whiteOf(base)});
}

/* --- 바닥·벽 타일 16×16 (모두 코드로) --- */
function makeTiles() {
  const rng = makeRng(77);
  const t = n => canvasOf(16, 16);
  const px = (x, c, X, Y, w = 1, h = 1) => ((x.fillStyle = c), x.fillRect(X, Y, w, h));
  const floor = [0, 1, 2].map(v => {
    const c = t(),
      x = c.getContext('2d');
    px(x, '#3a3330', 0, 0, 16, 16);
    // 박석(넓적한 돌) 이음새
    px(x, '#2c2624', 0, 7, 16, 1);
    px(x, '#2c2624', v === 1 ? 10 : 5, 0, 1, 7);
    px(x, '#2c2624', v === 2 ? 3 : 12, 8, 1, 8);
    for (let i = 0; i < 9; i++) px(x, rng() < 0.5 ? '#433b37' : '#342d2a', rint(rng, 0, 15), rint(rng, 0, 15));
    if (v === 2) (px(x, '#4b5a3a', 2, 2, 2, 1), px(x, '#4b5a3a', 3, 3, 1, 1)); // 이끼
    return c;
  });
  const wall = t(),
    wx = wall.getContext('2d');
  px(wx, '#241b1a', 0, 0, 16, 16);
  px(wx, '#4a2a22', 0, 0, 16, 4); // 기와 밑 서까래
  px(wx, '#6e3a2a', 0, 4, 16, 2);
  for (let i = 0; i < 16; i += 4) px(wx, '#1a1214', i, 6, 1, 10);
  px(wx, '#1a1214', 0, 15, 16, 1);
  const pillar = t(),
    pxx = pillar.getContext('2d');
  px(pxx, '#3a3330', 0, 0, 16, 16);
  px(pxx, '#1a1214', 3, 13, 10, 3);
  px(pxx, '#8a3020', 4, 1, 8, 13); // 붉은 기둥
  px(pxx, '#b0442c', 5, 1, 2, 13);
  px(pxx, '#5a1e16', 10, 1, 2, 13);
  px(pxx, '#6a5a4a', 3, 12, 10, 2); // 주춧돌
  const water = [0, 1].map(v => {
    const c = t(),
      x = c.getContext('2d');
    px(x, '#1d3a4a', 0, 0, 16, 16);
    px(x, '#2a5a6a', v ? 2 : 6, 4, 5, 1);
    px(x, '#2a5a6a', v ? 9 : 4, 10, 5, 1);
    px(x, '#3f7a8a', v ? 12 : 1, 7, 2, 1);
    return c;
  });
  const lantern = t(),
    lx = lantern.getContext('2d');
  px(lx, '#3a3330', 0, 0, 16, 16);
  px(lx, '#6a6460', 6, 10, 4, 5);
  px(lx, '#7a7470', 4, 4, 8, 6);
  px(lx, '#ffcf6a', 6, 6, 4, 2);
  px(lx, '#5a5450', 3, 3, 10, 1);
  px(lx, '#7a7470', 5, 2, 6, 1);
  return {floor, wall, pillar, water, lantern};
}
