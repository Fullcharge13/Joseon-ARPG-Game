// README.md 를 게임 데이터에서 만든다(표가 코드와 어긋나지 않게).
//   node tools/readme_gen.js          # README.md 를 새로 쓴다
//   node tools/readme_gen.js --check  # 지금 README.md 와 같은지만 본다
const fs = require('fs');
const path = require('path');
const {load} = require('../tests/harness');
const G = load();
const ROOT = path.join(__dirname, '..');
const row = a => '| ' + a.join(' | ') + ' |';
const table = (head, rows) => [row(head), row(head.map(() => '---')), ...rows.map(row)].join('\n');

const skills = table(
  ['스킬', '피해 종류', '기력', '재사용', '계수', '설명', '갈래 ①', '갈래 ②'],
  G.SKILL_IDS.map(id => {
    const s = G.SKILLS[id];
    return [s.name, {phys: '일반', fire: '불', cold: '냉기'}[s.type], s.cost ? s.cost : '+' + s.gain, s.cd + '초', '×' + s.coef, s.desc, `「${s.br[0].n}」 ${s.br[0].d}`, `「${s.br[1].n}」 ${s.br[1].d}`];
  })
);
const legends = table(
  ['전설 효과', '스킬', '내용'],
  Object.values(G.LEGENDS).map(L => [L.n, G.SKILLS[L.sk].name, L.d])
);
const affixes = table(
  ['옵션', '붙는 부위', '장비 Lv 1 값'],
  Object.values(G.AFFIXES).map(a => [a.n, a.slots.map(s => G.SLOT_NAME[s]).join('·'), a.f.replace('{v}', a.lo === a.hi ? a.lo : `${a.lo}~${a.hi}`)])
);
const enemies = table(
  ['요괴', '체력(Lv 1)', '피해', '속도', '행동', '설명'],
  Object.values(G.ENEMIES).map(e => [e.n, Math.round(e.hp * G.MON_HP), e.dmg, e.spd, {zig: '흔들리며 다가옴', swarm: '무리', melee: '곧장', shoot: '멀리서 쏨', charge: '멈칫 후 돌진'}[e.ai], e.d])
);
const elites = table(
  ['정예 접두어', '효과'],
  Object.values(G.ELITE_MODS).map(m => [m.n, m.d])
);

const md = `# 조선퇴마록 외전: 백귀사 (${G.GAME_VER})

> 이 파일은 \`node tools/readme_gen.js\` 가 게임 데이터에서 만듭니다. 표를 손으로 고치지 말고 \`src/js/02_data.js\` 를 고친 뒤 다시 만드세요.

조선퇴마록 세계관을 잇는 **작은 정통 도트 ARPG**입니다. 선비가 요괴가 들끓는 폐사찰 「백귀사(百鬼寺, 가상의 절)」를 내려가며 장비를 줍고, 스킬 갈래와 전설 효과로 빌드를 맞춥니다.

- 웹 브라우저 하나로 PC와 휴대폰(가로 화면)에서 플레이합니다. 파일은 \`dist/index.html\` 한 장입니다.
- 외부 라이브러리·이미지 파일 없이, 그림은 모두 코드로 그리고 소리는 Web Audio로 합성합니다.

## 휴대폰에서 하기
- 주소: **https://fullcharge13.github.io/Joseon-ARPG-Game/** (\`main\`에 올라가면 자동으로 새 판이 올라갑니다)
- 홈 화면 앱: 휴대폰 브라우저 메뉴에서 「홈 화면에 추가」를 누르면 앱처럼 전체 화면으로 열립니다. 한 번 열어 둔 뒤에는 인터넷이 끊겨도 실행됩니다.
- 기록: 퇴마청 「기록」 창에 층마다 걸린 시간·쓰러짐·받은 피해가 최근 ${G.STATS_MAX}층까지 남습니다. 「기록 복사」로 요약 글을 복사할 수 있습니다.

## 조작
| | PC | 휴대폰 |
|---|---|---|
| 이동 | WASD·방향키 | 왼쪽 아무 곳이나 눌러 생기는 조이스틱 |
| 스킬 | 좌클릭·우클릭·1~4 (마우스 쪽으로 조준) | 오른쪽 아래 버튼 4개 (가까운 요괴 자동 조준) |
| 회피 | Space | 「회피」 버튼 |
| 메뉴 | Esc 멈춤 · I 가방 · K 수련 | 오른쪽 위 ≡ |

## 한 판의 흐름
1. **퇴마청**(마을)에서 장비를 고르고 수련점을 찍은 뒤 출정합니다.
2. 백귀사는 3층입니다. 층마다 방 ${G.ROOMS_PER_FLOOR.join('·')}개를 손으로 짠 방 조각 ${Object.keys(G.ROOMS).length}종으로 무작위로 이어 붙입니다. 계단에 서면 다음 층으로 가고, 층마다 자동 저장합니다.
3. 3층 끝 방의 **${G.BOSS.n}**를 물리치면 **업(業) 단계**가 하나 열립니다. 단계마다 요괴 레벨 +${G.TIER_STEP}, 좋은 장비가 더 자주 나옵니다.
4. 쓰러지면 마을로 돌아가고 엽전 10%만 잃습니다. 장비·레벨은 그대로입니다.
5. 요괴가 가끔 떨어뜨리는 **복숭아**를 주우면 체력 22%를 회복합니다(정예는 반드시).

## 스킬 (레벨마다 수련점 1 · ${G.BRANCH_AT}단계에서 갈래 · 최대 ${G.SKILL_MAX}단계 · 마을에서 무료 재배분)
${skills}

## 장비
부위 4개: ${G.SLOTS.map(s => G.SLOT_NAME[s]).join(' · ')}. 등급: ${G.RAR_NAME.join(' · ')}(옵션 0 / 1~2 / 3~4 / 2~3 + 전설 효과).
대장간에서 엽전을 내고 옵션 하나를 다른 옵션으로 다시 굴릴 수 있습니다(같은 장비는 굴릴수록 비싸짐).

### 옵션 (${Object.keys(G.AFFIXES).length}종)
${affixes}

### 전설 효과 (${Object.keys(G.LEGENDS).length}종)
${legends}

## 요괴 (이름·설명: 고성배 「한국 요괴 도감」 기반, 조선퇴마록과 같은 기준)
${enemies}

보스 **${G.BOSS.n}** — ${G.BOSS.d} 큰 공격 전에는 바닥에 붉은 범위를 0.8초 먼저 보여 줍니다. 체력 절반 아래에서 분노해 더 자주 공격합니다.

${elites}

## 만들기와 시험
\`\`\`
python3 build.py                      # src/ → dist/(index.html, 앱 정보 파일, 오프라인 저장, 아이콘)
bash tests/run_all.sh                 # 단위 시험 + 자동 플레이 12판 + 브라우저 화면 순회
node tests/sim/play.js 12 3           # 자동 플레이만(판 수, 보스 처치 목표)
node tools/readme_gen.js              # 이 README 다시 만들기
\`\`\`
- \`tests/unit/\`: 규칙·저장·던전·전투 시험(전설 효과·갈래·옵션이 모두 실제 전투 결과를 바꾸는지 포함)
- \`tests/sim/play.js\`: 봇이 마을 ↔ 던전을 오가며 업 단계를 올리는 자동 플레이
- \`tests/browser/flow.py\`: 실제 브라우저(PC·휴대폰 2종)로 화면 순회, 넘침·콘솔 오류·프레임 시간
- 설계: \`docs/specs/\`, 계획: \`docs/plans/\`, 개발 일지: \`LOG.md\`

## 출처와 저작권
- 요괴 이름과 설명: 고성배, 「한국 요괴 도감」. 일부 행동은 게임 속 각색입니다.
- 복숭아가 귀신을 쫓는다는 믿음: 한국민족문화대백과사전 「복숭아」(https://encykorea.aks.ac.kr/Article/E0023684, 2026-11-05 확인).
- 도트 틀(\`mk\`, 선비 조립, 요괴 틀 5종)은 같은 작가의 조선퇴마록 코드에서 가져왔습니다. 그 밖의 그림은 모두 이 저장소의 코드로 새로 그렸습니다.
`;
const out = path.join(ROOT, 'README.md');
if (process.argv.includes('--check')) {
  const same = fs.existsSync(out) && fs.readFileSync(out, 'utf8') === md;
  console.log(same ? 'README 같음' : 'README 다름: node tools/readme_gen.js 를 다시 돌리세요');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(out, md);
console.log('README.md 만듦');
