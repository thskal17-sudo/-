@echo off
chcp 65001 >nul
:: 한국엑스퍼트교육원 홈페이지 실행 (윈도우)
cd /d "%~dp0"
if not exist .venv (
  python -m venv .venv
)
call .venv\Scripts\activate.bat
pip install -q -r requirements.txt
start "" http://localhost:8080/admin
python app.py
pause
