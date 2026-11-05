// 가짜 화면으로 src/js/*.js 를 Node 에서 불러온다. 시작(boot)은 하지 않는다.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function fakeCtx() {
  const noop = () => {};
  return new Proxy(
    {},
    {
      get: (t, k) => {
        if (k in t) return t[k];
        if (k === 'getImageData') return (x, y, w, h) => ({data: new Uint8ClampedArray(w * h * 4), width: w, height: h});
        if (k === 'createImageData') return (w, h) => ({data: new Uint8ClampedArray(w * h * 4), width: w, height: h});
        if (k === 'measureText') return s => ({width: String(s).length * 6});
        if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({addColorStop: noop});
        return noop;
      },
      set: (t, k, v) => ((t[k] = v), true)
    }
  );
}
function fakeEl(tag) {
  const el = {
    tagName: tag,
    style: {},
    children: [],
    classList: {add() {}, remove() {}, toggle() {}, contains: () => false},
    dataset: {},
    width: 0,
    height: 0,
    innerHTML: '',
    textContent: '',
    addEventListener() {},
    removeEventListener() {},
    appendChild(c) {
      this.children.push(c);
      return c;
    },
    querySelector: () => fakeEl('div'),
    querySelectorAll: () => [],
    getContext: () => fakeCtx(),
    getBoundingClientRect: () => ({left: 0, top: 0, width: 1280, height: 720}),
    setAttribute() {},
    remove() {},
    focus() {}
  };
  return el;
}

function load(opts = {}) {
  const store = {};
  const ctx = {
    console,
    Math,
    JSON,
    Date,
    performance: {now: () => Date.now()},
    __NO_BOOT: true,
    localStorage: opts.localStorage || {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => (store[k] = String(v)),
      removeItem: k => delete store[k],
      _store: store
    },
    document: {
      createElement: fakeEl,
      getElementById: () => fakeEl('div'),
      querySelector: () => fakeEl('div'),
      querySelectorAll: () => [],
      addEventListener() {},
      body: fakeEl('body'),
      documentElement: fakeEl('html')
    },
    navigator: {userAgent: 'node', maxTouchPoints: 0},
    requestAnimationFrame: () => 0,
    setTimeout,
    clearTimeout,
    AudioContext: undefined
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  const dir = path.join(__dirname, '..', 'src', 'js');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
  // const/let 도 밖에서 보이게: 모두 하나로 이어 붙여 한 번에 실행하고, 이름표를 ctx 에 내보낸다
  let code = files.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const names = new Set();
  for (const m of code.matchAll(/^(?:const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  // const A = 1,\n  B = 2; 처럼 한 번에 여러 이름을 선언한 경우의 뒤 이름들
  for (const m of code.matchAll(/^ {2}([A-Za-z_$][\w$]*) = /gm)) names.add(m[1]);
  code += '\n;Object.assign(globalThis,{' + [...names].map(n => `${n}: typeof ${n} !== 'undefined' ? ${n} : undefined`).join(',') + '});';
  vm.runInContext(code, ctx, {filename: 'game.js'});
  return ctx;
}
module.exports = {load};
