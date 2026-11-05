#!/usr/bin/env python3
"""백귀사 빌드: src/shell.html 의 <!--JS--> 자리에 src/js/*.js 를 이름 순서대로 이어 붙여 dist/index.html 한 장을 만든다.
  python3 build.py          # dist/index.html 을 만든다
  python3 build.py --check  # 만들 결과가 지금 dist/index.html 과 같은지만 본다
판 번호는 src/js/02_data.js 의 GAME_VER 한 곳에만 쓴다(시작 화면 표시는 빌드가 맞춘다).
"""
import sys, re, pathlib, subprocess, shutil, tempfile, json, zlib, struct
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
    return shell.replace(MARK, js), js, ver[0]

# --- 홈 화면 앱(v0.2): 앱 정보 파일, 오프라인 저장, 도트 아이콘 ---
# 아이콘은 게임 속 선비 도트(갓·얼굴·흰 도포·붓)와 같은 격자를 PNG 로 키운다(외부 그림 없음)
ICON_ROWS = [
    '................',
    '.....kkkkk......',
    '.....kkkkk......',
    '..kkkkkkkkkkk...',
    '.....sssss......',
    '.....skssk......',
    '.....sssss......',
    '....wwwwwww.y...',
    '...wwwwrwwww.k..',
    '...swwwwwwws.n..',
    '....wkkkkkw..n..',
    '....wwwwwww..n..',
    '....ww...ww.....',
    '....kk...kk.....',
    '................',
    '................',
]
ICON_PAL = {'k': (26, 20, 24), 's': (232, 185, 143), 'w': (239, 230, 210), 'r': (194, 59, 42), 'y': (224, 176, 72), 'n': (74, 58, 48)}
BG = (90, 34, 28)  # 어두운 붉은 바탕: 검은 갓이 묻히지 않게

def png(size):
    n = len(ICON_ROWS)
    cell = size // (n + 2)
    off = (size - cell * n) // 2
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            gx, gy = (x - off) // cell, (y - off) // cell
            c = BG
            if 0 <= gx < n and 0 <= gy < n and ICON_ROWS[gy][gx] in ICON_PAL:
                c = ICON_PAL[ICON_ROWS[gy][gx]]
            row += bytes(c)
        rows.append(bytes(row))
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b''.join(rows), 9)) + chunk(b'IEND', b'')

def app_files(ver):
    manifest = {
        'name': '조선퇴마록 외전: 백귀사', 'short_name': '백귀사', 'lang': 'ko', 'start_url': './', 'scope': './',
        'display': 'fullscreen', 'orientation': 'landscape', 'background_color': '#120c10', 'theme_color': '#120c10',
        'icons': [{'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png'}],
    }
    sw = (SRC / 'sw.js').read_text(encoding='utf8')
    if sw.count('__VER__') != 1: raise SystemExit('src/sw.js 에 __VER__ 가 정확히 한 번 있어야 합니다')
    return {
        'manifest.webmanifest': json.dumps(manifest, ensure_ascii=False, indent=1).encode('utf8'),
        'sw.js': sw.replace('__VER__', ver).encode('utf8'),
        'icon-192.png': png(192),
        'icon-512.png': png(512),
    }

def png_pixels(b):
    # IDAT 를 풀어 픽셀만 비교(압축 라이브러리 판마다 압축 결과가 달라도 같다고 본다)
    i, data = 8, b''
    while i < len(b):
        n = struct.unpack('>I', b[i:i + 4])[0]
        if b[i + 4:i + 8] == b'IDAT': data += b[i + 8:i + 8 + n]
        i += 12 + n
    return b[16:24], zlib.decompress(data)

def same_bytes(name, a, b):
    return png_pixels(a) == png_pixels(b) if name.endswith('.png') else a == b

def main():
    try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass
    html, js, ver = build_text()
    extra = app_files(ver)
    if shutil.which('node'):
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf8') as f: f.write(js); name = f.name
        r = subprocess.run(['node', '--check', name], capture_output=True, text=True)
        if r.returncode: raise SystemExit('합친 스크립트 문법 오류:\n' + r.stderr[-800:])
    if '--check' in sys.argv:
        same = OUT.exists() and OUT.read_text(encoding='utf8') == html and all((OUT.parent / n).exists() and same_bytes(n, (OUT.parent / n).read_bytes(), b) for n, b in extra.items())
        print('같음' if same else '다름: python3 build.py 를 다시 돌리세요'); sys.exit(0 if same else 1)
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(html, encoding='utf8')
    for n, b in extra.items(): (OUT.parent / n).write_bytes(b)
    print(f'dist/index.html {len(html.encode("utf8")) // 1024}KB + ' + ', '.join(extra))

if __name__ == '__main__': main()
