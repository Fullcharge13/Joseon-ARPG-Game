#!/usr/bin/env python3
"""실제 브라우저 화면 순회: PC(마우스)·휴대폰(가로·터치)에서 처음 화면 → 마을 → 가방·수련·대장간 → 출정 → 전투 → 멈춤
→ 층 이동 → 보스(예고) → 정화 → 쓰러짐까지 열어 보고, 콘솔 오류·화면 넘침을 검사하고 캡처를 남긴다.
  python3 tests/browser/flow.py            # 캡처는 tests/browser/out/
"""
import sys, json, pathlib, time
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'tests' / 'browser' / 'out'
OUT.mkdir(parents=True, exist_ok=True)
URL = (ROOT / 'dist' / 'index.html').as_uri()
DEVICES = [
    ('pc', dict(viewport={'width': 1280, 'height': 720})),
    ('phone', dict(viewport={'width': 844, 'height': 390}, device_scale_factor=3, is_mobile=True, has_touch=True)),
    ('phone_small', dict(viewport={'width': 667, 'height': 375}, device_scale_factor=2, is_mobile=True, has_touch=True)),
]
fails = []

def check_fit(pg, name):
    # 열린 창(.box)이 화면 밖으로 넘치지 않는가, 가로 스크롤이 없는가
    r = pg.evaluate("""() => {
      const out = [];
      for (const b of document.querySelectorAll('.scr.on .box, .scr.on .btns')) {
        const q = b.getBoundingClientRect();
        if (q.left < -1 || q.top < -1 || q.right > innerWidth + 1 || q.bottom > innerHeight + 1) out.push([b.className, q.left, q.top, q.right, q.bottom]);
      }
      if (document.documentElement.scrollWidth > innerWidth + 1) out.push(['가로 스크롤', document.documentElement.scrollWidth]);
      for (const btn of document.querySelectorAll('.scr.on button')) {
        const q = btn.getBoundingClientRect();
        if (q.width && (q.height < 30)) out.push(['작은 버튼', btn.textContent.trim().slice(0, 20), q.height]);
      }
      return out;
    }""")
    if r: fails.append(f'{name}: 넘침 {r}')

def shot(pg, dev, name):
    pg.screenshot(path=str(OUT / f'{dev}_{name}.png'))
    check_fit(pg, f'{dev}/{name}')

def click(pg, sel):
    pg.wait_for_timeout(550)  # 입력 보호(0.4~0.5초)가 풀린 뒤 누른다
    pg.click(sel)

def touch_hold(pg, x, y, ms, pid=7):
    pg.evaluate("""([x,y,ms,pid]) => new Promise(res => {
      const cv = document.getElementById('cv');
      const o = {pointerId: pid, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, button: 0};
      cv.dispatchEvent(new PointerEvent('pointerdown', o));
      setTimeout(() => { cv.dispatchEvent(new PointerEvent('pointerup', o)); res(); }, ms);
    })""", [x, y, ms, pid])

def run(dev, opts, p):
    b = p.chromium.launch()
    ctx = b.new_context(**opts)
    pg = ctx.new_page()
    errs = []
    pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL)
    pg.wait_for_timeout(400)
    shot(pg, dev, '01_title')
    click(pg, '#b-new')
    pg.wait_for_timeout(300)
    shot(pg, dev, '02_town')
    # 가방에 장비를 넣어 두고 화면을 연다
    pg.evaluate("""() => { const r = makeRng(5); for (let i=0;i<12;i++) GS.ch.bag.push(rollItem(r, SLOTS[i%4], 3+i, i%4)); GS.ch.lvl = 8; GS.ch.gold = 900; goTown(); }""")
    click(pg, '[data-a=bag]')
    pg.wait_for_timeout(200)
    click(pg, '#s-bag .bag .slot[data-a=sel]')
    pg.wait_for_timeout(200)
    shot(pg, dev, '03_bag')
    click(pg, '#s-bag [data-a=wear]')
    click(pg, '#s-bag .ft [data-a=close]')
    click(pg, '[data-a=skill]')
    pg.wait_for_timeout(200)
    for _ in range(3): click(pg, '#s-skill [data-a=learn][data-v=hwa]')
    click(pg, '#s-skill [data-a=br][data-v="hwa:1"]')
    click(pg, '#s-skill [data-a=learn][data-v=hanseol]')
    shot(pg, dev, '04_skill')
    st = pg.evaluate('JSON.stringify({sk: GS.ch.skills, slots: GS.ch.slots})')
    if '"hwa":{"rank":3,"br":1}' not in st or 'hanseol' not in st: fails.append(f'{dev}: 수련 화면 조작이 반영 안 됨 {st}')
    click(pg, '#s-skill .ft [data-a=close]')
    click(pg, '[data-a=forge]')
    click(pg, '#s-forge .slot[data-a=sel]')
    click(pg, '#s-forge [data-a=aff]')
    click(pg, '#s-forge [data-a=roll]')
    pg.wait_for_timeout(200)
    shot(pg, dev, '05_forge')
    if '→' not in pg.inner_text('#s-forge'): fails.append(f'{dev}: 대장간 재굴림 결과 표시 없음')
    click(pg, '#s-forge .ft [data-a=close]')
    # 출정
    click(pg, '[data-a=go]')
    pg.wait_for_timeout(900)
    shot(pg, dev, '06_dungeon')
    if pg.evaluate('GS.mode') != 'dungeon': fails.append(f'{dev}: 출정이 안 됨')
    # 검토 4: 한글 자판(W가 「ㅈ」로 들어옴)으로도 움직인다
    if dev == 'pc':
        y0 = pg.evaluate('GS.w.p.y')
        pg.evaluate("""() => new Promise(r => { dispatchEvent(new KeyboardEvent('keydown', {key:'ㅈ', code:'KeyW'})); setTimeout(() => { dispatchEvent(new KeyboardEvent('keyup', {key:'ㅈ', code:'KeyW'})); r(); }, 500); })""")
        if pg.evaluate('GS.w.p.y') > y0 - 5: fails.append(f'{dev}: 한글 자판 W로 안 움직임')
    # 검토 6: 던전에서 이미 고른 갈래는 잠김 / 검토 9: 바닥에 내려놓기
    pg.evaluate("() => openSkill(null)")
    pg.wait_for_timeout(200)
    if not pg.evaluate("document.querySelector('#s-skill [data-a=br][data-v=\"hwa:2\"]').disabled"): fails.append(f'{dev}: 던전에서 갈래를 바꿀 수 있음')
    pg.evaluate("() => closeModalToGame()")
    pg.evaluate("() => openBag(null)")
    click(pg, '#s-bag .bag .slot[data-a=sel]')
    n0 = pg.evaluate('GS.ch.bag.length')
    click(pg, '#s-bag [data-a=drop]')
    pg.wait_for_timeout(200)
    if pg.evaluate('GS.ch.bag.length') != n0 - 1 or not pg.evaluate('GS.w.drops.some(d => d.hold)'): fails.append(f'{dev}: 바닥에 내려놓기 안 됨')
    pg.evaluate("() => closeModalToGame()")
    pg.wait_for_timeout(500)
    if pg.evaluate('GS.ch.bag.length') != n0 - 1: fails.append(f'{dev}: 내려놓자마자 다시 주움')
    # 움직이고 스킬 쓰기
    x0 = pg.evaluate('GS.w.p.x')
    if dev == 'pc':
        pg.keyboard.down('d'); pg.mouse.move(900, 360); pg.keyboard.down('1'); pg.wait_for_timeout(900); pg.keyboard.up('1'); pg.keyboard.up('d')
    else:
        vw = opts['viewport']['width']; vh = opts['viewport']['height']
        pg.evaluate("""([x,y]) => { const cv=document.getElementById('cv'); const o={pointerId:3,pointerType:'touch',clientX:x,clientY:y,bubbles:true};
          cv.dispatchEvent(new PointerEvent('pointerdown',o)); o.clientX=x+60; cv.dispatchEvent(new PointerEvent('pointermove',o)); window.__joy=o; }""", [vw * 0.2, vh * 0.7])
        pg.wait_for_timeout(250)
        shot(pg, dev, '07_joystick')
        pg.wait_for_timeout(600)
        pg.evaluate("() => document.getElementById('cv').dispatchEvent(new PointerEvent('pointerup', window.__joy))")
        # 스킬 0번 버튼(오른쪽 아래) 길게 누르기
        L = pg.evaluate('hudLayout(R_.cv.width, R_.cv.height, R_.u).map(b => [b.id, b.x / R_.u, b.y / R_.u])')
        k0 = [b for b in L if b[0] == 'k0'][0]
        touch_hold(pg, k0[1], k0[2], 500)
    x1 = pg.evaluate('GS.w.p.x')
    if abs(x1 - x0) < 5: fails.append(f'{dev}: 움직이지 않음 {x0}->{x1}')
    if pg.evaluate("GS.w.p.cds.meok === undefined"): fails.append(f'{dev}: 스킬이 안 나감')
    # 전투 장면: 요괴를 곁으로
    pg.evaluate("""() => { const w=GS.w; for (let i=0;i<6;i++){ const e=spawnEnemy(w, ['dokkaebi','gwihwa','changgwi'][i%3], w.p.x+40+i*8, w.p.y-20+i*6, {}); }
      spawnEnemy(w,'baekyeou', w.p.x+60, w.p.y+20, {elite:['bul']}); dropItem(w, w.p.x-30, w.p.y, rollItem(makeRng(3),'charm',3,3)); dropItem(w, w.p.x-30, w.p.y+16, rollItem(makeRng(4),'hat',3,2)); }""")
    if dev == 'pc':
        pg.mouse.move(800, 330); pg.mouse.down(); pg.wait_for_timeout(500); pg.mouse.up()
    else:
        touch_hold(pg, k0[1], k0[2], 500)
    shot(pg, dev, '08_fight')
    # 멈춤
    if dev == 'pc': pg.keyboard.press('Escape')
    else:
        pz = [b for b in L if b[0] == 'pause'][0]; touch_hold(pg, pz[1], pz[2], 60, 9)
    pg.wait_for_timeout(300)
    shot(pg, dev, '09_pause')
    if pg.evaluate('GS.modal') != 'pause': fails.append(f'{dev}: 멈춤 창이 안 열림')
    click(pg, '#s-pause [data-a=resume]')
    # 층 이동: 출구로
    pg.evaluate("() => { const w=GS.w; w.ens.length=0; w.p.x=(w.map.exit.x+.5)*TILE; w.p.y=(w.map.exit.y+.5)*TILE; }")
    pg.wait_for_timeout(500)
    if pg.evaluate('GS.floor') != 2: fails.append(f'{dev}: 2층으로 안 감')
    # 3층 보스
    pg.evaluate("() => enterFloor(3)")
    pg.evaluate("""() => { const w=GS.w; const r=w.map.rooms.find(r=>r.kind==='boss'); w.p.x=(r.x0+7.5)*TILE; w.p.y=(r.y0+8)*TILE; w.p.hp=w.S.maxHp=9999; }""")
    pg.wait_for_timeout(700)
    pg.evaluate("() => { const b=GS.w.boss; b.sleep=false; b.atkCd=99; bossAttack(GS.w,b,'slam'); bossAttack(GS.w,b,'charge'); }")
    pg.wait_for_timeout(350)
    shot(pg, dev, '10_boss_tele')
    pg.evaluate("() => { const b=GS.w.boss; for(let i=0;i<20;i++){ b.capT=-9; hurt(GS.w,b,b.maxHp,'meok','phys',{nocrit:1}); } }")
    pg.wait_for_timeout(500)
    shot(pg, dev, '11_boss_dead')
    if not pg.evaluate('GS.w && GS.w.bossDead'): fails.append(f'{dev}: 보스가 안 죽음')
    pg.evaluate("() => { const w=GS.w; w.p.x=(w.map.exit.x+.5)*TILE; w.p.y=(w.map.exit.y+.5)*TILE; }")
    pg.wait_for_timeout(500)
    shot(pg, dev, '12_won')
    if 'maxTier":2' not in pg.evaluate('JSON.stringify(GS.ch)'): fails.append(f'{dev}: 업 2단계가 안 열림')
    click(pg, '#s-msg [data-a=b0]')
    pg.wait_for_timeout(300)
    shot(pg, dev, '13_town_tier2')
    # 쓰러짐
    click(pg, '[data-a=go]')
    pg.wait_for_timeout(500)
    pg.evaluate("() => { GS.w.p.iframe=0; GS.w.p.dodgeT=0; hurtPlayer(GS.w, 1e9, 'test', 'phys'); }")
    pg.wait_for_timeout(400)
    shot(pg, dev, '14_dead')
    if '쓰러졌다' not in pg.inner_text('#s-msg'): fails.append(f'{dev}: 쓰러짐 창 없음')
    click(pg, '#s-msg [data-a=b0]')
    # 다시 불러오기: 저장이 남았나
    pg.reload(); pg.wait_for_timeout(400)
    if 'Lv' not in pg.inner_text('#b-cont'): fails.append(f'{dev}: 저장이 안 남음')
    # 검토 7: 다시 불러오면 열린 가장 높은 업 단계가 기본 / 검토 8: 마을에서 I 키로 가방
    click(pg, '#b-cont'); pg.wait_for_timeout(300)
    if pg.evaluate("document.getElementById('tierSel') && document.getElementById('tierSel').value") != '2': fails.append(f'{dev}: 열린 업 단계가 기본 선택이 아님')
    if dev == 'pc':
        pg.evaluate("() => dispatchEvent(new KeyboardEvent('keydown', {key:'ㅑ', code:'KeyI'}))")
        pg.wait_for_timeout(200)
        if pg.evaluate('GS.modal') != 'bag': fails.append(f'{dev}: 마을에서 I 키로 가방이 안 열림')
        pg.evaluate("() => dispatchEvent(new KeyboardEvent('keyup', {key:'ㅑ', code:'KeyI'}))")
        pg.wait_for_timeout(450)
        click(pg, '#s-bag .ft [data-a=close]')
    # 성능: 요괴 40마리 전투 3초 프레임
    click(pg, '[data-a=go]'); pg.wait_for_timeout(500)
    cdp = ctx.new_cdp_session(pg)
    if dev != 'pc': cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
    pg.evaluate("""() => { const w=GS.w; w.p.hp=w.S.maxHp=1e6; for (let i=0;i<40;i++) spawnEnemy(w, ['dokkaebi','gwihwa','kkeomeok','changgwi'][i%4], w.p.x+Math.cos(i)*60, w.p.y+Math.sin(i)*45, {});
      window.__ft=[]; let last=performance.now(); (function f(){ const n=performance.now(); __ft.push(n-last); last=n; if(__ft.length<180) requestAnimationFrame(f); })(); }""")
    pg.wait_for_timeout(3500)
    ft = pg.evaluate('__ft.slice(10)')
    ft.sort()
    med = ft[len(ft) // 2] if ft else 0
    p95 = ft[int(len(ft) * 0.95)] if ft else 0
    perf = {'median_ms': round(med, 1), 'p95_ms': round(p95, 1), 'throttle': 1 if dev == 'pc' else 4, 'lowFx': pg.evaluate('R_.lowFx')}
    if errs: fails.append(f'{dev}: 콘솔 오류 {errs[:5]}')
    b.close()
    return perf

with sync_playwright() as p:
    perf = {}
    for dev, opts in DEVICES:
        perf[dev] = run(dev, opts, p)
print('프레임 시간:', json.dumps(perf, ensure_ascii=False))
print('캡처:', OUT)
if fails:
    print('실패', len(fails)); [print(' -', f) for f in fails]; sys.exit(1)
print('화면 순회 통과 (기기 %d종)' % len(DEVICES))
