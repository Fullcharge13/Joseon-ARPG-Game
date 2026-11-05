#!/usr/bin/env python3
"""백귀사 빌드: src/shell.html 의 <!--JS--> 자리에 src/js/*.js 를 이름 순서대로 이어 붙여 dist/index.html 한 장을 만든다.
  python3 build.py          # dist/index.html 을 만든다
  python3 build.py --check  # 만들 결과가 지금 dist/index.html 과 같은지만 본다
판 번호는 src/js/02_data.js 의 GAME_VER 한 곳에만 쓴다(시작 화면 표시는 빌드가 맞춘다).
"""
import sys, re, pathlib, subprocess, shutil, tempfile
ROOT = pathlib.Path(__file__).resolve().parent
SRC, OUT = ROOT / 'src', ROOT / 'dist' / 'index.html'
MARK = '<!--JS-->\n'

def build_text():
    shell = (SRC / 'shell.html').read_text(encoding='utf8')
    if shell.count(MARK) != 1: raise SystemExit('shell.html 에 <!--JS--> 줄이 정확히 한 번 있어야 합니다')
    parts = sorted((SRC / 'js').glob('*.js'))
    js = ''.join(p.read_text(encoding='utf8') for p in parts)
    if '</script' in js.lower(): raise SystemExit('src/js 안에 </script 글자가 있으면 페이지가 깨집니다')
    ver = re.findall(r"^const GAME_VER = '(v[\w.]+)'", (SRC / 'js' / '02_data.js').read_text(encoding='utf8'), re.M)
    if len(ver) != 1: raise SystemExit("02_data.js 에 const GAME_VER = 'v…' 가 정확히 한 번 있어야 합니다")
    shell = re.sub(r'(<p class="ver" id="verTag">).*?(</p>)', lambda m: m.group(1) + ver[0] + m.group(2), shell)
    return shell.replace(MARK, js), js

def main():
    try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass
    html, js = build_text()
    if shutil.which('node'):
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf8') as f: f.write(js); name = f.name
        r = subprocess.run(['node', '--check', name], capture_output=True, text=True)
        if r.returncode: raise SystemExit('합친 스크립트 문법 오류:\n' + r.stderr[-800:])
    if '--check' in sys.argv:
        same = OUT.exists() and OUT.read_text(encoding='utf8') == html
        print('같음' if same else '다름: python3 build.py 를 다시 돌리세요'); sys.exit(0 if same else 1)
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(html, encoding='utf8')
    print(f'dist/index.html {len(html.encode("utf8")) // 1024}KB')

if __name__ == '__main__': main()
