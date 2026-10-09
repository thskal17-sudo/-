#!/usr/bin/env bash
# 한국엑스퍼트교육원 홈페이지 실행 (맥·리눅스)
set -e
cd "$(dirname "$0")"
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
. .venv/bin/activate
pip install -q -r requirements.txt
python app.py
