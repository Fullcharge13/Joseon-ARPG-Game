/* ======================= 소리: Web Audio 합성 ======================= */
const AU = {ctx: null, last: {}};
function unlockAudio() {
  if (AU.ctx || typeof AudioContext === 'undefined') return;
  try {
    AU.ctx = new AudioContext();
  } catch (e) {}
}
// [주파수, 길이, 파형, 음량, 끝 주파수]
const SFX = {
  meok: [[520, 0.05, 'square', 0.05, 300]],
  hwa: [[300, 0.08, 'sawtooth', 0.05, 500]],
  boom: [[120, 0.18, 'sawtooth', 0.09, 40]],
  ilpil: [[900, 0.12, 'triangle', 0.08, 200]],
  hanseol: [
    [1200, 0.15, 'sine', 0.06, 1800],
    [1600, 0.15, 'sine', 0.04, 2400]
  ],
  gyeol: [
    [440, 0.1, 'sine', 0.06, 660],
    [660, 0.15, 'sine', 0.05, 880]
  ],
  hurt: [[160, 0.08, 'square', 0.06, 90]],
  kill: [[260, 0.05, 'square', 0.03, 130]],
  coin: [[1400, 0.05, 'square', 0.03, 1800]],
  pick: [[700, 0.06, 'triangle', 0.05, 1000]],
  rare: [
    [880, 0.08, 'triangle', 0.06, 880],
    [1320, 0.12, 'triangle', 0.06, 1320]
  ],
  legend: [
    [660, 0.1, 'triangle', 0.08, 660],
    [880, 0.1, 'triangle', 0.08, 880],
    [1320, 0.3, 'triangle', 0.08, 1320]
  ],
  lvl: [
    [523, 0.1, 'square', 0.05, 523],
    [659, 0.1, 'square', 0.05, 659],
    [784, 0.2, 'square', 0.05, 784]
  ],
  dodge: [[300, 0.08, 'sine', 0.04, 600]],
  slam: [[80, 0.3, 'sawtooth', 0.12, 30]],
  boss: [
    [200, 0.3, 'sawtooth', 0.1, 60],
    [400, 0.4, 'triangle', 0.08, 800]
  ],
  equip: [[600, 0.06, 'square', 0.04, 900]],
  forge: [
    [1000, 0.05, 'square', 0.05, 1000],
    [1500, 0.08, 'square', 0.04, 1500]
  ]
};
sfx = function (name) {
  const a = AU.ctx;
  if (!a || GS.mute || !SFX[name]) return;
  const now = a.currentTime;
  if (AU.last[name] && now - AU.last[name] < 0.05) return;
  AU.last[name] = now;
  let t = now;
  for (const [f, d, type, v, f2] of SFX[name]) {
    const o = a.createOscillator(),
      g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + d);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + d + 0.02);
    t += d * 0.8;
  }
};
