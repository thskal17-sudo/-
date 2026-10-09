"""한국엑스퍼트교육원 홈페이지 서버.

공개 페이지(/)와 관리자 페이지(/admin)를 함께 띄운다.
관리자 페이지에서 활동 사진, 회사소개서, 바로가기 주소, 문의 내역을 관리한다.
올린 파일과 설정은 data/ 폴더에 저장되고 git 에는 올라가지 않는다.
"""
from __future__ import annotations

import hashlib
import hmac
import io
import json
import os
import re
import secrets
import threading
import time
import uuid
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from jinja2 import Environment, FileSystemLoader, select_autoescape
from PIL import Image, ImageOps

import sys as _sys

_sys.path.insert(0, str(Path(__file__).resolve().parent))
from notify import Notifier  # noqa: E402

HERE = Path(__file__).resolve().parent
TEMPLATES_DIR = HERE / "templates"
STATIC_DIR = HERE / "static"  # 로고 등 고정 파일
DEFAULT_DATA_DIR = Path(os.environ.get("HOMEPAGE_DATA", HERE / "data"))

MAX_PHOTO_MB = 20
MAX_PDF_MB = 50
PHOTO_LONG_EDGE = 1600
THUMB_LONG_EDGE = 640
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
SESSION_HOURS = 12
COOKIE = "kee_admin"

DEFAULT_SITE = {
    "links": {
        "gangsaitda": "https://gangsaitda.com",
        "gyoannote": "https://smartstore.naver.com/sangsangcareerdesign",
        "blog": "https://blog.naver.com/sangsangcareer",
        "youtube": "https://www.youtube.com/@%ED%95%9C%EA%B5%AD%EC%97%91%EC%8A%A4%ED%8D%BC%ED%8A%B8%EA%B5%90%EC%9C%A1%EC%9B%90",
    },
    "contact": {
        "phone": "010-9891-9450",
        "email": "koexpert@naver.com",
        "address": "부산광역시 북구 낙동대로1694번길 4, 3층",
    },
}
LINK_KEYS = tuple(DEFAULT_SITE["links"])
CONTACT_KEYS = tuple(DEFAULT_SITE["contact"])
INQUIRY_FIELDS = ("기관명", "담당자", "연락처", "이메일", "관심분야", "운영형태", "대상인원", "희망시기", "문의내용")
INQUIRY_REQUIRED = ("기관명", "담당자", "연락처")
NOTIFY_DEFAULTS = {
    "notify_email": "", "smtp_host": "smtp.naver.com", "smtp_port": "465", "smtp_user": "", "smtp_pass": "",
    "kakao_rest_key": "", "kakao_client_secret": "", "base_url": "",
}
NOTIFY_SECRETS = ("smtp_pass", "kakao_client_secret")  # 비워 두면 기존 값을 유지하는 칸


# ---------------------------------------------------------------- 저장소
class Store:
    """data/ 폴더에 JSON 과 파일로 보관한다. 동시 쓰기는 잠금 하나로 막는다."""

    def __init__(self, data_dir: Path):
        self.dir = Path(data_dir)
        self.photos_dir = self.dir / "photos"
        self.photos_dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    # ---- 공통
    def _read(self, name: str, default):
        p = self.dir / name
        if not p.exists():
            return json.loads(json.dumps(default))
        try:
            return json.loads(p.read_text("utf-8"))
        except json.JSONDecodeError:
            return json.loads(json.dumps(default))

    def _write(self, name: str, value) -> None:
        tmp = self.dir / f"{name}.tmp"
        tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2), "utf-8")
        tmp.replace(self.dir / name)

    # ---- 사이트 설정
    def site(self) -> dict:
        saved = self._read("site.json", DEFAULT_SITE)
        site = json.loads(json.dumps(DEFAULT_SITE))
        for group in ("links", "contact"):
            for k, v in (saved.get(group) or {}).items():
                if k in site[group] and isinstance(v, str):
                    site[group][k] = v
        return site

    def save_site(self, links: dict, contact: dict) -> None:
        with self._lock:
            self._write("site.json", {"links": links, "contact": contact})

    # ---- 관리자 계정
    def admin(self) -> dict | None:
        a = self._read("admin.json", None)
        return a if a and a.get("hash") else None

    def set_password(self, password: str) -> None:
        salt = secrets.token_hex(16)
        with self._lock:
            current = self._read("admin.json", {}) or {}
            self._write("admin.json", {
                "salt": salt,
                "hash": _pbkdf2(password, salt),
                "secret": current.get("secret") or secrets.token_hex(32),
            })

    def check_password(self, password: str) -> bool:
        a = self.admin()
        if not a:
            return False
        return hmac.compare_digest(_pbkdf2(password, a["salt"]), a["hash"])

    def secret(self) -> str:
        a = self.admin()
        return a["secret"] if a else ""

    # ---- 사진
    def photos(self) -> list[dict]:
        return self._read("photos.json", [])

    def add_photo(self, data: bytes, caption: str) -> dict:
        try:
            im = Image.open(io.BytesIO(data))
            im.load()
        except Exception:  # noqa: BLE001
            raise ValueError("이미지 파일을 읽을 수 없습니다. JPG, PNG, WEBP 파일을 올려 주세요.") from None
        im = ImageOps.exif_transpose(im)  # 휴대폰 사진 회전 바로잡기. EXIF 는 저장하지 않는다.
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        pid = uuid.uuid4().hex[:12]
        full = im.copy()
        full.thumbnail((PHOTO_LONG_EDGE, PHOTO_LONG_EDGE))
        full.save(self.photos_dir / f"{pid}.jpg", "JPEG", quality=86, optimize=True)
        thumb = im.copy()
        thumb.thumbnail((THUMB_LONG_EDGE, THUMB_LONG_EDGE))
        thumb.save(self.photos_dir / f"{pid}_t.jpg", "JPEG", quality=82, optimize=True)
        entry = {
            "id": pid,
            "caption": caption.strip()[:120],
            "width": full.width,
            "height": full.height,
            "created": _now(),
        }
        with self._lock:
            photos = self.photos()
            photos.append(entry)
            self._write("photos.json", photos)
        return entry

    def update_photo(self, pid: str, caption: str) -> bool:
        with self._lock:
            photos = self.photos()
            for p in photos:
                if p["id"] == pid:
                    p["caption"] = caption.strip()[:120]
                    self._write("photos.json", photos)
                    return True
        return False

    def move_photo(self, pid: str, direction: int) -> bool:
        with self._lock:
            photos = self.photos()
            idx = next((i for i, p in enumerate(photos) if p["id"] == pid), -1)
            j = idx + direction
            if idx < 0 or j < 0 or j >= len(photos):
                return False
            photos[idx], photos[j] = photos[j], photos[idx]
            self._write("photos.json", photos)
            return True

    def delete_photo(self, pid: str) -> bool:
        with self._lock:
            photos = self.photos()
            kept = [p for p in photos if p["id"] != pid]
            if len(kept) == len(photos):
                return False
            self._write("photos.json", kept)
        for suffix in (".jpg", "_t.jpg"):
            (self.photos_dir / f"{pid}{suffix}").unlink(missing_ok=True)
        return True

    # ---- 첫 화면 배경 사진
    def hero(self) -> dict | None:
        h = self._read("hero.json", None)
        return h if h and (self.dir / "hero.jpg").exists() else None

    def save_hero(self, data: bytes) -> None:
        try:
            im = Image.open(io.BytesIO(data))
            im.load()
        except Exception:  # noqa: BLE001
            raise ValueError("이미지 파일을 읽을 수 없습니다. JPG, PNG, WEBP 파일을 올려 주세요.") from None
        im = ImageOps.exif_transpose(im)
        if im.mode != "RGB":
            im = im.convert("RGB")
        im.thumbnail((2400, 2400))
        with self._lock:
            im.save(self.dir / "hero.jpg", "JPEG", quality=84, optimize=True, progressive=True)
            self._write("hero.json", {"width": im.width, "height": im.height, "uploaded": _now()})

    def delete_hero(self) -> None:
        with self._lock:
            (self.dir / "hero.jpg").unlink(missing_ok=True)
            (self.dir / "hero.json").unlink(missing_ok=True)

    # ---- 회사소개서
    def brochure(self) -> dict | None:
        b = self._read("brochure.json", None)
        return b if b and (self.dir / "brochure.pdf").exists() else None

    def save_brochure(self, data: bytes, original_name: str) -> None:
        if not data.startswith(b"%PDF"):
            raise ValueError("PDF 파일만 올릴 수 있습니다.")
        with self._lock:
            (self.dir / "brochure.pdf").write_bytes(data)
            self._write("brochure.json", {
                "name": Path(original_name or "회사소개서.pdf").name[:120],
                "size": len(data),
                "uploaded": _now(),
            })

    def delete_brochure(self) -> None:
        with self._lock:
            (self.dir / "brochure.pdf").unlink(missing_ok=True)
            (self.dir / "brochure.json").unlink(missing_ok=True)

    # ---- 문의
    def inquiries(self) -> list[dict]:
        return self._read("inquiries.json", [])

    def add_inquiry(self, fields: dict) -> dict:
        entry = {"id": uuid.uuid4().hex[:12], "created": _now(), "status": "new", **fields}
        with self._lock:
            items = self.inquiries()
            items.insert(0, entry)
            self._write("inquiries.json", items)
        return entry

    def set_inquiry_status(self, iid: str, status: str) -> bool:
        with self._lock:
            items = self.inquiries()
            for it in items:
                if it["id"] == iid:
                    it["status"] = status
                    self._write("inquiries.json", items)
                    return True
        return False

    # ---- 알림 설정 (비밀번호가 들어 있으므로 파일 권한을 소유자만으로 둔다)
    def notify_config(self) -> dict:
        saved = self._read("notify.json", {}) or {}
        cfg = dict(NOTIFY_DEFAULTS)
        for k in cfg:
            v = saved.get(k)
            if isinstance(v, str) and v:
                cfg[k] = v
            env = os.environ.get("HOMEPAGE_" + k.upper())  # 서버 환경변수가 있으면 그쪽이 우선
            if env:
                cfg[k] = env
        if not cfg["notify_email"]:
            cfg["notify_email"] = self.site()["contact"]["email"]
        return cfg

    def save_notify_config(self, cfg: dict) -> None:
        with self._lock:
            self._write("notify.json", {k: cfg.get(k, "") for k in NOTIFY_DEFAULTS})
            os.chmod(self.dir / "notify.json", 0o600)

    def kakao_tokens(self) -> dict | None:
        t = self._read("kakao.json", None)
        return t if t and t.get("access_token") else None

    def save_kakao_tokens(self, tokens: dict) -> None:
        with self._lock:
            self._write("kakao.json", tokens)
            os.chmod(self.dir / "kakao.json", 0o600)

    def delete_kakao_tokens(self) -> None:
        with self._lock:
            (self.dir / "kakao.json").unlink(missing_ok=True)

    def delete_inquiry(self, iid: str) -> bool:
        with self._lock:
            items = self.inquiries()
            kept = [it for it in items if it["id"] != iid]
            if len(kept) == len(items):
                return False
            self._write("inquiries.json", kept)
            return True


def _pbkdf2(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000).hex()


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")


# ---------------------------------------------------------------- 로그인 세션
def _make_session(secret: str) -> str:
    exp = str(int(time.time()) + SESSION_HOURS * 3600)
    sig = hmac.new(secret.encode(), exp.encode(), "sha256").hexdigest()
    return f"{exp}.{sig}"


def _valid_session(secret: str, token: str | None) -> bool:
    if not secret or not token or "." not in token:
        return False
    exp, sig = token.split(".", 1)
    if not exp.isdigit() or int(exp) < time.time():
        return False
    want = hmac.new(secret.encode(), exp.encode(), "sha256").hexdigest()
    return hmac.compare_digest(want, sig)


class LoginGuard:
    """비밀번호를 5번 틀리면 1분 동안 막는다."""

    def __init__(self):
        self._fails: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def blocked(self, ip: str) -> bool:
        with self._lock:
            now = time.time()
            recent = [t for t in self._fails.get(ip, []) if now - t < 60]
            self._fails[ip] = recent
            return len(recent) >= 5

    def fail(self, ip: str) -> None:
        with self._lock:
            self._fails.setdefault(ip, []).append(time.time())

    def clear(self, ip: str) -> None:
        with self._lock:
            self._fails.pop(ip, None)


class RateLimit:
    """같은 IP 에서 문의를 한 시간에 10건까지만 받는다."""

    def __init__(self, limit: int = 10, window: int = 3600):
        self.limit, self.window = limit, window
        self._hits: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def allow(self, ip: str) -> bool:
        with self._lock:
            now = time.time()
            hits = [t for t in self._hits.get(ip, []) if now - t < self.window]
            if len(hits) >= self.limit:
                self._hits[ip] = hits
                return False
            hits.append(now)
            self._hits[ip] = hits
            return True


# ---------------------------------------------------------------- 앱
def create_app(data_dir: Path | str = DEFAULT_DATA_DIR) -> FastAPI:
    store = Store(Path(data_dir))
    guard = LoginGuard()
    inquiry_limit = RateLimit()
    notifier = Notifier(store)
    kakao_states: dict[str, float] = {}  # 카카오 로그인 왕복 확인용 임시 값
    app = FastAPI(title="한국엑스퍼트교육원", docs_url=None, redoc_url=None, openapi_url=None)
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    env = Environment(loader=FileSystemLoader(TEMPLATES_DIR), autoescape=select_autoescape(["html"]))

    initial = os.environ.get("HOMEPAGE_ADMIN_PASSWORD")
    if initial and not store.admin():
        store.set_password(initial)

    def render(name: str, **ctx) -> HTMLResponse:
        return HTMLResponse(env.get_template(name).render(**ctx))

    def is_admin(request: Request) -> bool:
        return _valid_session(store.secret(), request.cookies.get(COOKIE))

    def require_admin(request: Request) -> None:
        if not is_admin(request):
            raise HTTPException(401)

    def site_url(request: Request) -> str:
        """알림 링크와 카카오 로그인 돌아올 주소에 쓰는 홈페이지 주소. 설정이 없으면 지금 접속한 주소."""
        return (store.notify_config()["base_url"] or str(request.base_url)).rstrip("/")

    def back(section: str = "", msg: str = "", error: str = "") -> RedirectResponse:
        q = []
        if msg:
            q.append("msg=" + quote(msg))
        if error:
            q.append("error=" + quote(error))
        url = "/admin" + ("?" + "&".join(q) if q else "") + (f"#{section}" if section else "")
        return RedirectResponse(url, status_code=303)

    # ---------------- 공개 페이지
    @app.get("/", response_class=HTMLResponse)
    def index():
        return render("index.html", site=store.site(), photos=store.photos(), brochure=store.brochure(), hero=store.hero())

    @app.get("/hero.jpg")
    def hero_image():
        h = store.hero()
        if not h:
            raise HTTPException(404)
        return FileResponse(store.dir / "hero.jpg", media_type="image/jpeg",
                            headers={"Cache-Control": "public, max-age=3600", "ETag": f'"{h["uploaded"]}"'})

    @app.get("/favicon.ico", include_in_schema=False)
    def favicon():
        return FileResponse(STATIC_DIR / "favicon.png", media_type="image/png")

    @app.get("/photos/{name}")
    def photo(name: str):
        if not re.fullmatch(r"[0-9a-f]{12}(_t)?\.jpg", name):
            raise HTTPException(404)
        p = store.photos_dir / name
        if not p.exists():
            raise HTTPException(404)
        return FileResponse(p, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})

    @app.get("/brochure.pdf")
    def brochure(download: int = 0):
        """기본은 브라우저에서 바로 열리고, ?download=1 이면 파일로 내려받는다."""
        if not store.brochure():
            raise HTTPException(404, "아직 올린 회사소개서가 없습니다.")
        return FileResponse(store.dir / "brochure.pdf", media_type="application/pdf",
                            filename="한국엑스퍼트교육원_회사소개서.pdf",
                            content_disposition_type="attachment" if download else "inline")

    @app.post("/api/inquiry")
    async def inquiry(request: Request):
        try:
            body = await request.json()
        except Exception:  # noqa: BLE001
            raise HTTPException(400, "요청 형식이 올바르지 않습니다.") from None
        if not isinstance(body, dict):
            raise HTTPException(400, "요청 형식이 올바르지 않습니다.")
        if body.get("_gotcha"):
            return JSONResponse({"ok": True})  # 스팸 봇은 조용히 무시한다
        fields = {}
        for k in INQUIRY_FIELDS:
            v = body.get(k, "")
            if isinstance(v, list):
                v = ", ".join(str(x) for x in v)
            v = str(v or "").strip()
            fields[k] = v[:3000] if k == "문의내용" else v[:200]
        for k in INQUIRY_REQUIRED:
            if not fields[k]:
                raise HTTPException(400, f"{k}을(를) 입력해 주세요.")
        digits = re.sub(r"\D", "", fields["연락처"])
        if not re.fullmatch(r"01[016789]\d{7,8}", digits):
            raise HTTPException(400, "휴대폰 번호를 다시 확인해 주세요. 예) 010-1234-5678")
        fields["연락처"] = re.sub(r"^(\d{3})(\d{3,4})(\d{4})$", r"\1-\2-\3", digits)
        if fields["이메일"] and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", fields["이메일"]):
            raise HTTPException(400, "이메일 주소를 다시 확인해 주세요.")
        ip = request.client.host if request.client else "?"
        if not inquiry_limit.allow(ip):
            raise HTTPException(429, "문의가 너무 많이 접수되었습니다. 잠시 후 다시 시도해 주세요.")
        entry = store.add_inquiry(fields)
        try:
            notifier.notify_inquiry(entry, site_url(request) + "/admin")
        except Exception:  # noqa: BLE001 - 알림이 안 가도 문의 접수는 성공이다
            pass
        return JSONResponse({"ok": True})

    # ---------------- 관리자: 로그인
    @app.get("/admin/login", response_class=HTMLResponse)
    def login_page(request: Request, error: str = ""):
        if is_admin(request):
            return RedirectResponse("/admin", status_code=303)
        return render("admin_login.html", setup=store.admin() is None, error=error)

    @app.post("/admin/login")
    def login(request: Request, password: str = Form(""), password2: str = Form("")):
        ip = request.client.host if request.client else "?"
        if store.admin() is None:
            # 처음 접속: 비밀번호 정하기
            if len(password) < 8:
                return render("admin_login.html", setup=True, error="비밀번호는 8자 이상으로 정해 주세요.")
            if password != password2:
                return render("admin_login.html", setup=True, error="두 비밀번호가 서로 다릅니다.")
            store.set_password(password)
        else:
            if guard.blocked(ip):
                return render("admin_login.html", setup=False, error="너무 많이 틀렸습니다. 1분 뒤에 다시 시도해 주세요.")
            if not store.check_password(password):
                guard.fail(ip)
                return render("admin_login.html", setup=False, error="비밀번호가 맞지 않습니다.")
        guard.clear(ip)
        resp = RedirectResponse("/admin", status_code=303)
        resp.set_cookie(COOKIE, _make_session(store.secret()), max_age=SESSION_HOURS * 3600,
                        httponly=True, samesite="lax", path="/")
        return resp

    @app.post("/admin/logout")
    def logout():
        resp = RedirectResponse("/admin/login", status_code=303)
        resp.delete_cookie(COOKIE, path="/")
        return resp

    @app.post("/admin/password")
    def change_password(request: Request, current: str = Form(""), password: str = Form(""), password2: str = Form("")):
        require_admin(request)
        if not store.check_password(current):
            return back("account", error="현재 비밀번호가 맞지 않습니다.")
        if len(password) < 8:
            return back("account", error="새 비밀번호는 8자 이상으로 정해 주세요.")
        if password != password2:
            return back("account", error="두 비밀번호가 서로 다릅니다.")
        store.set_password(password)
        return back("account", msg="비밀번호를 바꿨습니다.")

    # ---------------- 관리자: 대시보드
    @app.get("/admin", response_class=HTMLResponse)
    def admin(request: Request, msg: str = "", error: str = ""):
        if not is_admin(request):
            return RedirectResponse("/admin/login", status_code=303)
        inquiries = store.inquiries()
        return render(
            "admin.html",
            site=store.site(),
            photos=store.photos(),
            brochure=store.brochure(),
            hero=store.hero(),
            inquiries=inquiries,
            new_count=sum(1 for i in inquiries if i.get("status") == "new"),
            notify=store.notify_config(),
            email_ready=notifier.email_ready(),
            kakao=store.kakao_tokens(),
            kakao_ready=notifier.kakao_ready(),
            notify_last=notifier.last,
            site_url=site_url(request),
            msg=msg[:200],
            error=error[:200],
        )

    # ---------------- 관리자: 알림 (이메일 · 카카오톡)
    @app.post("/admin/notify")
    async def notify_settings(request: Request):
        require_admin(request)
        form = await request.form()
        cfg = store.notify_config()
        saved = store._read("notify.json", {}) or {}
        for k in NOTIFY_DEFAULTS:
            v = str(form.get(k, "")).strip()[:300]
            if k in NOTIFY_SECRETS and not v:
                cfg[k] = saved.get(k, "")  # 비워 두면 그대로
            else:
                cfg[k] = v
        cfg["base_url"] = cfg["base_url"].rstrip("/")
        store.save_notify_config(cfg)
        return back("notify", msg="알림 설정을 저장했습니다. ‘테스트 알림 보내기’로 확인해 보세요.")

    @app.post("/admin/notify/test")
    def notify_test(request: Request):
        require_admin(request)
        result = notifier.test(site_url(request) + "/admin")
        text = f"이메일: {result['email']} · 카카오톡: {result['kakao']}"
        ok = all(v == "성공" for v in result.values())
        return back("notify", msg=text if ok else "", error="" if ok else text)

    @app.get("/admin/kakao/connect")
    def kakao_connect(request: Request):
        require_admin(request)
        if not store.notify_config()["kakao_rest_key"]:
            return back("notify", error="먼저 카카오 REST API 키를 저장해 주세요.")
        state = secrets.token_urlsafe(16)
        kakao_states[state] = time.time()
        return RedirectResponse(notifier.kakao_auth_url(site_url(request) + "/admin/kakao/callback", state), status_code=303)

    @app.get("/admin/kakao/callback")
    def kakao_callback(request: Request, code: str = "", state: str = "", error: str = "", error_description: str = ""):
        require_admin(request)
        if error:
            return back("notify", error=f"카카오 로그인이 취소되었습니다: {error_description or error}")
        if not code or state not in kakao_states or time.time() - kakao_states.pop(state, 0) > 600:
            return back("notify", error="카카오 연결 요청이 맞지 않습니다. 다시 눌러 주세요.")
        try:
            notifier.kakao_exchange(code, site_url(request) + "/admin/kakao/callback")
        except Exception as e:  # noqa: BLE001
            return back("notify", error=f"카카오 연결 실패: {e}"[:300])
        return back("notify", msg="카카오톡을 연결했습니다. ‘테스트 알림 보내기’로 확인해 보세요.")

    @app.post("/admin/kakao/disconnect")
    def kakao_disconnect(request: Request):
        require_admin(request)
        store.delete_kakao_tokens()
        return back("notify", msg="카카오톡 연결을 해제했습니다.")

    @app.post("/admin/settings")
    async def settings(request: Request):
        require_admin(request)
        form = await request.form()
        links, contact = {}, {}
        for k in LINK_KEYS:
            v = str(form.get(f"link_{k}", "")).strip()[:500]
            if v and not re.match(r"^https?://", v):
                v = "https://" + v
            links[k] = v
        for k in CONTACT_KEYS:
            contact[k] = str(form.get(f"contact_{k}", "")).strip()[:200] or DEFAULT_SITE["contact"][k]
        store.save_site(links, contact)
        return back("settings", msg="바로가기와 연락처를 저장했습니다.")

    # ---------------- 관리자: 사진
    @app.post("/admin/photos")
    async def upload_photos(request: Request, files: list[UploadFile] = File(...), caption: str = Form("")):
        require_admin(request)
        added, errors = 0, []
        for f in files:
            name = f.filename or ""
            if Path(name).suffix.lower() not in IMAGE_SUFFIXES:
                errors.append(f"{name}: 이미지 파일이 아닙니다")
                continue
            data = await f.read()
            if len(data) > MAX_PHOTO_MB * 1024 * 1024:
                errors.append(f"{name}: {MAX_PHOTO_MB}MB 를 넘습니다")
                continue
            try:
                store.add_photo(data, caption)
                added += 1
            except ValueError as e:
                errors.append(f"{name}: {e}")
        msg = f"사진 {added}장을 올렸습니다." if added else ""
        return back("photos", msg=msg, error=" / ".join(errors))

    @app.post("/admin/photos/{pid}/caption")
    def photo_caption(request: Request, pid: str, caption: str = Form("")):
        require_admin(request)
        store.update_photo(pid, caption)
        return back("photos", msg="설명을 저장했습니다.")

    @app.post("/admin/photos/{pid}/move")
    def photo_move(request: Request, pid: str, direction: str = Form("up")):
        require_admin(request)
        store.move_photo(pid, -1 if direction == "up" else 1)
        return back("photos")

    @app.post("/admin/photos/{pid}/delete")
    def photo_delete(request: Request, pid: str):
        require_admin(request)
        store.delete_photo(pid)
        return back("photos", msg="사진을 지웠습니다.")

    # ---------------- 관리자: 첫 화면 배경 사진
    @app.post("/admin/hero")
    async def upload_hero(request: Request, file: UploadFile = File(...)):
        require_admin(request)
        if Path(file.filename or "").suffix.lower() not in IMAGE_SUFFIXES:
            return back("hero", error="JPG, PNG, WEBP 이미지 파일만 올릴 수 있습니다.")
        data = await file.read()
        if len(data) > MAX_PHOTO_MB * 1024 * 1024:
            return back("hero", error=f"파일이 {MAX_PHOTO_MB}MB 를 넘습니다.")
        try:
            store.save_hero(data)
        except ValueError as e:
            return back("hero", error=str(e))
        return back("hero", msg="첫 화면 배경 사진을 바꿨습니다.")

    @app.post("/admin/hero/delete")
    def delete_hero(request: Request):
        require_admin(request)
        store.delete_hero()
        return back("hero", msg="배경 사진을 내렸습니다. 첫 화면은 기본 색으로 나옵니다.")

    # ---------------- 관리자: 회사소개서
    @app.post("/admin/brochure")
    async def upload_brochure(request: Request, file: UploadFile = File(...)):
        require_admin(request)
        data = await file.read()
        if len(data) > MAX_PDF_MB * 1024 * 1024:
            return back("brochure", error=f"파일이 {MAX_PDF_MB}MB 를 넘습니다.")
        try:
            store.save_brochure(data, file.filename or "")
        except ValueError as e:
            return back("brochure", error=str(e))
        return back("brochure", msg="회사소개서를 올렸습니다. 홈페이지에서 바로 내려받을 수 있습니다.")

    @app.post("/admin/brochure/delete")
    def delete_brochure(request: Request):
        require_admin(request)
        store.delete_brochure()
        return back("brochure", msg="회사소개서를 내렸습니다.")

    # ---------------- 관리자: 문의
    @app.post("/admin/inquiries/{iid}/status")
    def inquiry_status(request: Request, iid: str, status: str = Form("done")):
        require_admin(request)
        store.set_inquiry_status(iid, "done" if status == "done" else "new")
        return back("inquiries")

    @app.post("/admin/inquiries/{iid}/delete")
    def inquiry_delete(request: Request, iid: str):
        require_admin(request)
        store.delete_inquiry(iid)
        return back("inquiries", msg="문의를 지웠습니다.")

    @app.exception_handler(HTTPException)
    def http_error(request: Request, exc: HTTPException):
        if exc.status_code == 401:
            return RedirectResponse("/admin/login", status_code=303)
        if request.url.path.startswith("/api/"):
            return JSONResponse({"ok": False, "error": exc.detail}, status_code=exc.status_code)
        return HTMLResponse(f"<h1>{exc.status_code}</h1><p>{exc.detail or ''}</p>", status_code=exc.status_code)

    app.state.store = store
    app.state.notifier = notifier
    return app


app = create_app()


def main() -> None:
    import uvicorn

    host = os.environ.get("HOMEPAGE_HOST", "0.0.0.0")
    port = int(os.environ.get("HOMEPAGE_PORT", "8080"))
    print(f"홈페이지: http://localhost:{port}   관리자: http://localhost:{port}/admin")
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
