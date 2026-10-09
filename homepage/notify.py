"""문의 알림. 새 문의가 들어오면 네이버 메일(SMTP)과 카카오톡 '나에게 보내기'로 알린다.

- 이메일: 관리자 페이지 '알림'에서 받을 주소, 네이버 아이디, 앱 비밀번호를 넣는다.
- 카카오톡: 카카오 개발자 앱의 REST API 키를 넣고 '카카오톡 연결하기'로 한 번 로그인하면,
  그 계정의 '나와의 채팅'으로 보낸다. 토큰은 data/kakao.json 에 두고 만료 전에 자동 갱신한다.
알림이 실패해도 문의 저장은 영향을 받지 않는다.
"""
from __future__ import annotations

import json
import smtplib
import ssl
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from email.message import EmailMessage

KAKAO_AUTH = "https://kauth.kakao.com/oauth/authorize"
KAKAO_TOKEN = "https://kauth.kakao.com/oauth/token"
KAKAO_MEMO = "https://kapi.kakao.com/v2/api/talk/memo/default/send"
KAKAO_TEXT_LIMIT = 200  # 나에게 보내기 기본 텍스트 템플릿 글자 수 한도


def http_post(url: str, data: dict, headers: dict | None = None) -> dict:
    """폼 형식으로 POST 하고 JSON 응답을 돌려준다. 테스트에서 바꿔 끼운다."""
    body = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded;charset=utf-8")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:300]
        raise RuntimeError(f"HTTP {e.code}: {detail}") from None
    except urllib.error.URLError as e:
        raise RuntimeError(f"연결 실패: {e.reason}") from None


def smtp_send(host: str, port: int, user: str, password: str, msg: EmailMessage) -> None:
    """SSL SMTP 로 메일 한 통을 보낸다. 테스트에서 바꿔 끼운다."""
    with smtplib.SMTP_SSL(host, port, timeout=20, context=ssl.create_default_context()) as s:
        s.login(user, password)
        s.send_message(msg)


class Notifier:
    def __init__(self, store, sync: bool = False):
        self.store = store
        self.sync = sync  # True 면 바로 보낸다 (테스트용). 평소엔 뒤에서 보낸다.
        self.last: dict[str, str] = {}  # 최근 알림 결과 (관리자 페이지 표시용)

    # ---- 설정 상태
    def cfg(self) -> dict:
        return self.store.notify_config()

    def email_ready(self) -> bool:
        c = self.cfg()
        return bool(c["smtp_user"] and c["smtp_pass"] and c["notify_email"])

    def kakao_ready(self) -> bool:
        return bool(self.cfg()["kakao_rest_key"] and self.store.kakao_tokens())

    # ---- 이메일
    def send_email(self, subject: str, body: str) -> None:
        c = self.cfg()
        msg = EmailMessage()
        sender = c["smtp_user"] if "@" in c["smtp_user"] else f"{c['smtp_user']}@naver.com"
        msg["From"] = f"한국엑스퍼트교육원 홈페이지 <{sender}>"
        msg["To"] = c["notify_email"]
        msg["Subject"] = subject
        msg.set_content(body)
        smtp_send(c["smtp_host"], int(c["smtp_port"]), c["smtp_user"], c["smtp_pass"], msg)

    # ---- 카카오톡
    def kakao_auth_url(self, redirect_uri: str, state: str) -> str:
        q = {
            "client_id": self.cfg()["kakao_rest_key"],
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "talk_message",
            "state": state,
        }
        return KAKAO_AUTH + "?" + urllib.parse.urlencode(q)

    def kakao_exchange(self, code: str, redirect_uri: str) -> None:
        c = self.cfg()
        data = {"grant_type": "authorization_code", "client_id": c["kakao_rest_key"],
                "redirect_uri": redirect_uri, "code": code}
        if c["kakao_client_secret"]:
            data["client_secret"] = c["kakao_client_secret"]
        self._save_tokens(http_post(KAKAO_TOKEN, data), {})

    def _save_tokens(self, resp: dict, old: dict) -> dict:
        if "access_token" not in resp:
            raise RuntimeError(f"카카오 응답에 토큰이 없습니다: {json.dumps(resp, ensure_ascii=False)[:200]}")
        now = int(time.time())
        tokens = {
            "access_token": resp["access_token"],
            "expires_at": now + int(resp.get("expires_in", 21600)),
            "refresh_token": resp.get("refresh_token") or old.get("refresh_token", ""),
            "refresh_expires_at": now + int(resp["refresh_token_expires_in"]) if resp.get("refresh_token_expires_in") else old.get("refresh_expires_at", 0),
            "connected_at": old.get("connected_at") or time.strftime("%Y-%m-%d %H:%M"),
        }
        self.store.save_kakao_tokens(tokens)
        return tokens

    def _access_token(self) -> str:
        tokens = self.store.kakao_tokens()
        if not tokens:
            raise RuntimeError("카카오톡이 연결되어 있지 않습니다.")
        if tokens["expires_at"] - 120 > time.time():
            return tokens["access_token"]
        if not tokens.get("refresh_token"):
            raise RuntimeError("카카오 토큰이 만료되었습니다. 관리자 페이지에서 다시 연결해 주세요.")
        c = self.cfg()
        data = {"grant_type": "refresh_token", "client_id": c["kakao_rest_key"], "refresh_token": tokens["refresh_token"]}
        if c["kakao_client_secret"]:
            data["client_secret"] = c["kakao_client_secret"]
        return self._save_tokens(http_post(KAKAO_TOKEN, data), tokens)["access_token"]

    def send_kakao(self, text: str, link_url: str = "") -> None:
        text = text if len(text) <= KAKAO_TEXT_LIMIT else text[: KAKAO_TEXT_LIMIT - 1] + "…"
        template = {"object_type": "text", "text": text,
                    "link": {"web_url": link_url or "https://www.naver.com", "mobile_web_url": link_url or "https://www.naver.com"}}
        if link_url:
            template["button_title"] = "관리자 페이지 열기"
        resp = http_post(KAKAO_MEMO, {"template_object": json.dumps(template, ensure_ascii=False)},
                         {"Authorization": "Bearer " + self._access_token()})
        if resp.get("result_code", 0) != 0:
            raise RuntimeError(f"카카오 전송 실패: {resp}")

    # ---- 문의 알림
    def notify_inquiry(self, entry: dict, admin_url: str) -> None:
        subject = f"[홈페이지 문의] {entry['기관명']} · {entry['담당자']}"
        lines = [f"{k}: {entry.get(k) or '-'}" for k in ("기관명", "담당자", "연락처", "이메일", "관심분야", "운영형태", "대상인원", "희망시기")]
        body = "\n".join(lines) + f"\n\n문의 내용:\n{entry.get('문의내용') or '-'}\n\n접수 {entry['created']}\n관리자 페이지: {admin_url}"
        short = (f"[홈페이지 문의] {entry['기관명']} · {entry['담당자']} · {entry['연락처']}\n"
                 f"관심: {entry.get('관심분야') or '-'}\n{(entry.get('문의내용') or '')[:70]}")
        self._run(lambda: self._send_all(subject, body, short, admin_url))

    def _send_all(self, subject: str, body: str, short: str, admin_url: str) -> None:
        if self.email_ready():
            try:
                self.send_email(subject, body)
                self.last["email"] = "성공 " + time.strftime("%m-%d %H:%M")
            except Exception as e:  # noqa: BLE001 - 알림 실패는 기록만 한다
                self.last["email"] = f"실패: {e}"[:160]
        if self.kakao_ready():
            try:
                self.send_kakao(short, admin_url)
                self.last["kakao"] = "성공 " + time.strftime("%m-%d %H:%M")
            except Exception as e:  # noqa: BLE001
                self.last["kakao"] = f"실패: {e}"[:160]

    def _run(self, fn) -> None:
        if self.sync:
            fn()
        else:
            threading.Thread(target=fn, daemon=True).start()

    def test(self, admin_url: str) -> dict[str, str]:
        """관리자 페이지 '테스트 알림 보내기'. 설정된 쪽만 보내고 결과를 돌려준다."""
        out: dict[str, str] = {}
        if self.email_ready():
            try:
                self.send_email("[홈페이지] 알림 테스트", "홈페이지 문의 알림이 이 주소로 옵니다.\n" + admin_url)
                out["email"] = "성공"
            except Exception as e:  # noqa: BLE001
                out["email"] = f"실패: {e}"[:200]
        else:
            out["email"] = "설정 안 됨"
        if self.kakao_ready():
            try:
                self.send_kakao("[홈페이지] 알림 테스트 — 문의가 들어오면 이렇게 카톡이 와요.", admin_url)
                out["kakao"] = "성공"
            except Exception as e:  # noqa: BLE001
                out["kakao"] = f"실패: {e}"[:200]
        else:
            out["kakao"] = "연결 안 됨"
        return out
