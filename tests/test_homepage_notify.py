"""문의 알림(이메일·카카오톡) 테스트. 실제로 보내지 않고 보내는 함수만 바꿔 끼운다."""
import importlib.util
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "homepage"))
spec = importlib.util.spec_from_file_location("homepage_app", ROOT / "homepage" / "app.py")
homepage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(homepage)
import notify  # noqa: E402

PASSWORD = "test-password-1"
INQUIRY = {"기관명": "알림중학교", "담당자": "김담당", "연락처": "010-2222-3333", "관심분야": ["AI 교육"], "문의내용": "12월에 가능한가요?"}


@pytest.fixture()
def admin(tmp_path):
    c = TestClient(homepage.create_app(tmp_path), follow_redirects=False)
    c.post("/admin/login", data={"password": PASSWORD, "password2": PASSWORD})
    c.app.state.notifier.sync = True  # 테스트에서는 바로 보낸다
    return c


def test_no_config_means_no_sending(admin, monkeypatch):
    calls = []
    monkeypatch.setattr(notify, "smtp_send", lambda *a: calls.append(a))
    monkeypatch.setattr(notify, "http_post", lambda *a, **k: calls.append(a))
    assert admin.post("/api/inquiry", json=INQUIRY).json() == {"ok": True}
    assert calls == []
    page = admin.get("/admin").text
    assert "이메일 설정 안 됨" in page and "카카오톡 연결 안 됨" in page


def test_email_notification(admin, monkeypatch):
    sent = []
    monkeypatch.setattr(notify, "smtp_send", lambda host, port, user, pw, msg: sent.append((host, port, user, pw, msg)))
    r = admin.post("/admin/notify", data={"notify_email": "me@naver.com", "smtp_user": "koexpert", "smtp_pass": "app-pass",
                                          "smtp_host": "smtp.naver.com", "smtp_port": "465", "base_url": "https://koexpert.kr"})
    assert r.status_code == 303
    assert "이메일 설정됨" in admin.get("/admin").text
    admin.post("/api/inquiry", json=INQUIRY)
    assert len(sent) == 1
    host, port, user, pw, msg = sent[0]
    assert (host, port, user, pw) == ("smtp.naver.com", 465, "koexpert", "app-pass")
    assert msg["To"] == "me@naver.com" and "알림중학교" in msg["Subject"]
    body = msg.get_content()
    assert "010-2222-3333" in body and "12월에 가능한가요?" in body and "https://koexpert.kr/admin" in body
    # 비밀번호 칸을 비워 두고 저장하면 기존 값이 남는다
    admin.post("/admin/notify", data={"notify_email": "me@naver.com", "smtp_user": "koexpert", "smtp_pass": "",
                                      "smtp_host": "smtp.naver.com", "smtp_port": "465", "base_url": ""})
    assert admin.app.state.store.notify_config()["smtp_pass"] == "app-pass"
    # 테스트 알림 버튼
    r = admin.post("/admin/notify/test")
    assert len(sent) == 2 and "msg=" not in r.headers["location"]  # 카톡은 연결 안 됨이라 error 로 안내
    assert "error=" in r.headers["location"]


def test_kakao_connect_and_notify(admin, monkeypatch):
    posts = []

    def fake_post(url, data, headers=None):
        posts.append((url, data, headers))
        if url == notify.KAKAO_TOKEN:
            return {"access_token": "AT1", "expires_in": 21600, "refresh_token": "RT1", "refresh_token_expires_in": 5184000}
        return {"result_code": 0}

    monkeypatch.setattr(notify, "http_post", fake_post)
    admin.post("/admin/notify", data={"notify_email": "", "smtp_user": "", "smtp_pass": "", "smtp_host": "smtp.naver.com",
                                      "smtp_port": "465", "kakao_rest_key": "RESTKEY", "kakao_client_secret": "", "base_url": "https://koexpert.kr"})
    r = admin.get("/admin/kakao/connect")
    assert r.status_code == 303
    q = parse_qs(urlparse(r.headers["location"]).query)
    assert q["client_id"] == ["RESTKEY"] and q["scope"] == ["talk_message"]
    assert q["redirect_uri"] == ["https://koexpert.kr/admin/kakao/callback"]
    state = q["state"][0]

    bad = admin.get("/admin/kakao/callback?code=abc&state=wrong")
    assert "error=" in bad.headers["location"]
    ok = admin.get(f"/admin/kakao/callback?code=abc&state={state}")
    assert "msg=" in ok.headers["location"]
    assert posts[0][0] == notify.KAKAO_TOKEN and posts[0][1]["code"] == "abc"
    assert admin.app.state.store.kakao_tokens()["refresh_token"] == "RT1"
    assert "카카오톡 연결됨" in admin.get("/admin").text

    admin.post("/api/inquiry", json=INQUIRY)
    url, data, headers = posts[-1]
    assert url == notify.KAKAO_MEMO and headers["Authorization"] == "Bearer AT1"
    assert "알림중학교" in data["template_object"] and "010-2222-3333" in data["template_object"]
    assert "https://koexpert.kr/admin" in data["template_object"]

    # 토큰이 만료되면 갱신한 뒤 보낸다
    tokens = admin.app.state.store.kakao_tokens()
    tokens["expires_at"] = 1
    admin.app.state.store.save_kakao_tokens(tokens)
    admin.post("/api/inquiry", json=INQUIRY)
    refresh = [p for p in posts if p[0] == notify.KAKAO_TOKEN and p[1].get("grant_type") == "refresh_token"]
    assert refresh and refresh[0][1]["refresh_token"] == "RT1"

    admin.post("/admin/kakao/disconnect")
    assert admin.app.state.store.kakao_tokens() is None


def test_notify_requires_login(admin):
    admin.cookies.clear()
    assert admin.post("/admin/notify", data={}).headers["location"] == "/admin/login"
    assert admin.get("/admin/kakao/connect").headers["location"] == "/admin/login"
