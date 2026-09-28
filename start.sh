#!/usr/bin/env bash
# macOS / Linux 실행 스크립트. 처음 한 번 설치 후 브라우저 업로드 화면을 연다.
set -e
cd "$(dirname "$0")"
if [ ! -d .venv ]; then
  echo "처음 실행: 설치 중입니다. 몇 분 걸립니다."
  python3 -m venv .venv
  .venv/bin/python -m pip install -q --upgrade pip
  .venv/bin/python -m pip install -q -e .
  .venv/bin/python -m playwright install chromium
fi
( sleep 2; command -v open >/dev/null && open http://localhost:8000 || xdg-open http://localhost:8000 ) >/dev/null 2>&1 &
exec .venv/bin/python -m edugen.cli serve
