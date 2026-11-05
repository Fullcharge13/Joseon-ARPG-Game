#!/usr/bin/env bash
# 완료 보고 전 기본 묶음: 빌드 확인 → 단위 시험 → README 일치 → 자동 플레이 12판 → 브라우저 화면 순회
set -e
cd "$(dirname "$0")/.."
python3 build.py --check
node --test tests/unit/*.test.js
node tools/readme_gen.js --check
node tests/sim/play.js 12 3
python3 tests/browser/flow.py
