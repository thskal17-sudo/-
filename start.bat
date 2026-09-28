@echo off
chcp 65001 > nul
cd /d %~dp0
where python > nul 2>&1 || (echo Python 3.10 이상을 먼저 설치하세요: https://www.python.org/downloads/ & pause & exit /b 1)
if not exist .venv (
  echo 처음 실행: 설치 중입니다. 몇 분 걸립니다.
  python -m venv .venv || (pause & exit /b 1)
  .venv\Scripts\python -m pip install -q --upgrade pip
  .venv\Scripts\python -m pip install -q -e . || (pause & exit /b 1)
  .venv\Scripts\python -m playwright install chromium || (pause & exit /b 1)
)
start "" http://localhost:8000
.venv\Scripts\python -m edugen.cli serve
pause
