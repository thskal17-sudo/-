"""홈페이지 서버(homepage/app.py) 테스트. 공개 페이지, 관리자 로그인, 사진·소개서 업로드, 문의 접수."""
import importlib.util
import io
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("homepage_app", ROOT / "homepage" / "app.py")
homepage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(homepage)

PASSWORD = "test-password-1"


@pytest.fixture()
def client(tmp_path):
    return TestClient(homepage.create_app(tmp_path), follow_redirects=False)


@pytest.fixture()
def admin(client):
    # 첫 접속은 비밀번호 설정 화면이다
    assert "비밀번호 정하기" in client.get("/admin/login").text
    r = client.post("/admin/login", data={"password": PASSWORD, "password2": PASSWORD})
    assert r.status_code == 303 and r.headers["location"] == "/admin"
    assert homepage.COOKIE in client.cookies
    return client


def _png(color=(200, 40, 40), size=(2400, 1800)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, "PNG")
    return buf.getvalue()


def test_index_renders_with_defaults(client):
    html = client.get("/").text
    assert "한국엑스퍼트교육원이란" in html
    assert 'href="https://gangsaitda.com"' in html
    assert "교안노트" in html and "준비 중" in html
    assert 'id="gallery"' not in html  # 사진이 없으면 칸이 안 보인다
    assert "회사소개서 받기" not in html
    assert "계성여고" not in html  # 학교 이름은 공개하지 않는다
    assert "블로그" in html and "유튜브" in html


def test_admin_requires_login(client):
    assert client.get("/admin").headers["location"] == "/admin/login"
    assert client.post("/admin/settings", data={}).headers["location"] == "/admin/login"
    assert client.get("/brochure.pdf").status_code == 404


def test_wrong_password_and_lockout(admin):
    admin.cookies.clear()
    for _ in range(5):
        assert "맞지 않습니다" in admin.post("/admin/login", data={"password": "nope"}).text
    assert "1분 뒤에" in admin.post("/admin/login", data={"password": PASSWORD}).text


def test_settings_change_public_links(admin):
    r = admin.post("/admin/settings", data={
        "link_gangsaitda": "https://gangsaitda.com",
        "link_gyoannote": "smartstore.naver.com/gyoannote",
        "link_blog": "https://blog.naver.com/koexpert",
        "link_youtube": "",
        "contact_phone": "010-0000-0000",
        "contact_email": "koexpert@naver.com",
        "contact_address": "부산 어딘가",
    })
    assert r.status_code == 303
    html = admin.get("/").text
    assert 'href="https://smartstore.naver.com/gyoannote"' in html
    assert 'href="https://blog.naver.com/koexpert"' in html
    assert "010-0000-0000" in html and "부산 어딘가" in html
    assert 'class="yt is-pending"' in html


def test_photo_upload_resize_and_delete(admin):
    r = admin.post("/admin/photos", data={"caption": "AI 캠프"}, files=[
        ("files", ("a.png", _png(), "image/png")),
        ("files", ("b.png", _png((40, 40, 200), (800, 600)), "image/png")),
        ("files", ("c.txt", b"hello", "text/plain")),
    ])
    assert r.status_code == 303 and "2" in r.headers["location"]
    photos = admin.app.state.store.photos()
    assert len(photos) == 2 and photos[0]["caption"] == "AI 캠프"
    assert photos[0]["width"] == 1600 and photos[0]["height"] == 1200  # 긴 쪽 1600 으로 줄인다
    assert photos[1]["width"] == 800  # 작은 사진은 그대로

    html = admin.get("/").text
    assert 'id="gallery"' in html and f'/photos/{photos[0]["id"]}_t.jpg' in html
    assert admin.get(f'/photos/{photos[0]["id"]}.jpg').headers["content-type"] == "image/jpeg"
    assert admin.get("/photos/../admin.json").status_code == 404

    admin.post(f'/admin/photos/{photos[0]["id"]}/move', data={"direction": "down"})
    assert admin.app.state.store.photos()[0]["id"] == photos[1]["id"]
    admin.post(f'/admin/photos/{photos[0]["id"]}/delete')
    assert len(admin.app.state.store.photos()) == 1
    assert admin.get(f'/photos/{photos[0]["id"]}.jpg').status_code == 404


def test_brochure_upload_and_download(admin):
    bad = admin.post("/admin/brochure", files={"file": ("x.pdf", b"not a pdf", "application/pdf")})
    assert "PDF" in bad.headers["location"]
    pdf = b"%PDF-1.4\n%fake\n"
    admin.post("/admin/brochure", files={"file": ("소개서.pdf", pdf, "application/pdf")})
    assert "회사소개서 받기" in admin.get("/").text
    r = admin.get("/brochure.pdf")
    assert r.status_code == 200 and r.content == pdf
    assert "attachment" in r.headers["content-disposition"]
    admin.post("/admin/brochure/delete")
    assert admin.get("/brochure.pdf").status_code == 404


def test_inquiry_flow(admin):
    bad = admin.post("/api/inquiry", json={"기관명": "", "담당자": "홍", "연락처": "051-123-4567"})
    assert bad.status_code == 400 and "기관명" in bad.json()["error"]
    bad = admin.post("/api/inquiry", json={"기관명": "학교", "담당자": "홍", "연락처": "12"})
    assert bad.status_code == 400
    spam = admin.post("/api/inquiry", json={"기관명": "x", "담당자": "x", "연락처": "0511234567", "_gotcha": "bot"})
    assert spam.json() == {"ok": True} and admin.app.state.store.inquiries() == []

    ok = admin.post("/api/inquiry", json={
        "기관명": "테스트중학교", "담당자": "홍길동", "연락처": "051-123-4567",
        "관심분야": ["AI 교육", "창업"], "운영형태": [], "문의내용": "12월 캠프 <b>문의</b>",
    })
    assert ok.json() == {"ok": True}
    page = admin.get("/admin").text
    assert "테스트중학교" in page and "AI 교육, 창업" in page
    assert "&lt;b&gt;문의&lt;/b&gt;" in page  # HTML 은 그대로 글자로 보인다
    assert 'class="badge">1<' in page

    iid = admin.app.state.store.inquiries()[0]["id"]
    admin.post(f"/admin/inquiries/{iid}/status", data={"status": "done"})
    assert admin.app.state.store.inquiries()[0]["status"] == "done"
    admin.post(f"/admin/inquiries/{iid}/delete")
    assert admin.app.state.store.inquiries() == []


def test_change_password_and_logout(admin):
    r = admin.post("/admin/password", data={"current": "wrong", "password": "new-password-1", "password2": "new-password-1"})
    assert "error=" in r.headers["location"]
    admin.post("/admin/password", data={"current": PASSWORD, "password": "new-password-1", "password2": "new-password-1"})
    admin.post("/admin/logout")
    assert admin.get("/admin").headers["location"] == "/admin/login"
    assert admin.post("/admin/login", data={"password": "new-password-1"}).headers["location"] == "/admin"
