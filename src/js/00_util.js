/* ======================= 도움 함수 ======================= */
// 시드 난수(mulberry32): 같은 시드면 같은 결과 → 던전·장비 시험을 되풀이할 수 있다
function makeRng(seed) {
  let a = seed >>> 0 || 1;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rint = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
function weighted(rng, ws) {
  let s = 0;
  for (const w of ws) s += w;
  let r = rng() * s;
  for (let i = 0; i < ws.length; i++) {
    r -= ws[i];
    if (r < 0) return i;
  }
  return ws.length - 1;
}
// 한국어 조사: 받침 있으면 a, 없으면 b
function josa(word, a, b) {
  const c = String(word).charCodeAt(String(word).length - 1);
  if (c < 0xac00 || c > 0xd7a3) return b;
  return (c - 0xac00) % 28 ? a : b;
}
