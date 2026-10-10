/*
 * 홈페이지 문의 → 카카오톡 '나에게 보내기' 알림 (Cloudflare Worker, 무료 요금제로 충분)
 *
 * 홈페이지(koexpert.co.kr)의 문의창이 Formspree 로 메일을 보낸 뒤, 같은 내용을 이 워커에도 보낸다.
 * 워커는 카카오 '나에게 보내기' API 로 대표님 카카오톡 '나와의 채팅'에 알림을 넣는다.
 *
 * 필요한 설정 (Cloudflare 대시보드 → 워커 → Settings)
 *   KV 바인딩   KAKAO               토큰 보관용 KV 네임스페이스
 *   비밀 변수   KAKAO_REST_KEY      카카오 개발자 앱의 REST API 키
 *   비밀 변수   KAKAO_CLIENT_SECRET 카카오 로그인 → 보안 의 Client Secret (사용 안 함이면 비워 둠)
 *   비밀 변수   ADMIN_KEY           /connect, /test, /status 를 여는 비밀번호 (아무 긴 문자열)
 *   변수        ALLOWED_ORIGIN      https://koexpert.co.kr (문의를 받아 줄 홈페이지 주소)
 *   Cron 트리거 0 3 * * *            하루 한 번 토큰을 갱신해 연결이 끊기지 않게 한다
 *
 * 주소
 *   GET  /connect?key=ADMIN_KEY   카카오 로그인으로 가서 '나에게 보내기' 권한을 허용한다 (한 번만)
 *   GET  /callback                카카오가 돌아오는 곳. 카카오 앱의 Redirect URI 에 이 주소를 등록한다
 *   GET  /status?key=ADMIN_KEY    연결 상태 보기
 *   GET  /test?key=ADMIN_KEY      시험 카톡 보내기
 *   POST /inquiry                 홈페이지 문의창이 보내는 곳 (JSON)
 */

const KAKAO_AUTH = "https://kauth.kakao.com/oauth/authorize";
const KAKAO_TOKEN = "https://kauth.kakao.com/oauth/token";
const KAKAO_MEMO = "https://kapi.kakao.com/v2/api/talk/memo/default/send";
const TEXT_LIMIT = 200; // '나에게 보내기' 기본 텍스트 글자 수 한도
const FIELDS = ["기관명", "담당자", "연락처", "이메일", "관심분야", "운영형태", "대상인원", "희망시기", "문의내용"];
const RATE_LIMIT = 5; // 같은 접속자가 10분에 보낼 수 있는 문의 수

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    try {
      if (!env.KAKAO || typeof env.KAKAO.get !== "function") {
        throw new Error("KV 바인딩 KAKAO 가 없습니다. 워커 Settings → Bindings 에서 KV namespace 를 변수 이름 KAKAO 로 연결해 주세요.");
      }
      if (request.method === "OPTIONS") return cors(env, new Response(null, { status: 204 }));
      if (path === "/inquiry" && request.method === "POST") return cors(env, await inquiry(request, env));
      if (path === "/callback") return await callback(request, url, env);
      if (!adminOk(url, env)) return page("잘못된 접근입니다.", 403);
      if (path === "/connect") return connect(url, env);
      if (path === "/status") return await status(env);
      if (path === "/test") return await test(url, env);
      return page("한국엑스퍼트교육원 홈페이지 카카오톡 알림", 200);
    } catch (e) {
      return page("오류: " + (e && e.message ? e.message : String(e)), 500);
    }
  },

  // 하루 한 번: 토큰을 갱신해 두 달 넘게 문의가 없어도 연결이 끊기지 않게 한다.
  async scheduled(event, env, ctx) {
    const tokens = await loadTokens(env);
    if (tokens && tokens.refresh_token) {
      await refresh(env, tokens).catch(() => {});
    }
  },
};

// ---------- 문의 알림
async function inquiry(request, env) {
  const origin = request.headers.get("Origin") || "";
  if (env.ALLOWED_ORIGIN && origin && origin !== env.ALLOWED_ORIGIN) return json({ ok: false, error: "허용되지 않은 주소" }, 403);

  let d;
  try { d = await request.json(); } catch { return json({ ok: false, error: "JSON 형식이 아닙니다." }, 400); }
  if (typeof d !== "object" || d === null) return json({ ok: false, error: "내용이 없습니다." }, 400);
  if (d._gotcha) return json({ ok: true }); // 로봇이 채우는 숨은 칸. 받은 척만 한다.

  const e = {};
  for (const k of FIELDS) {
    const v = d[k];
    e[k] = (Array.isArray(v) ? v.join(", ") : String(v == null ? "" : v)).trim().slice(0, 1000);
  }
  if (!e.기관명 || !e.담당자 || !e.연락처) return json({ ok: false, error: "기관명, 담당자, 연락처는 꼭 필요합니다." }, 400);

  const ip = request.headers.get("CF-Connecting-IP") || "0";
  const bucket = "rate:" + ip + ":" + Math.floor(Date.now() / 600000);
  const n = parseInt((await env.KAKAO.get(bucket)) || "0", 10) + 1;
  if (n > RATE_LIMIT) return json({ ok: false, error: "잠시 후 다시 시도해 주세요." }, 429);
  await env.KAKAO.put(bucket, String(n), { expirationTtl: 700 });

  const text = `[홈페이지 문의] ${e.기관명} · ${e.담당자} · ${e.연락처}\n관심: ${e.관심분야 || "-"}${e.운영형태 ? " / " + e.운영형태 : ""}` +
    `${e.희망시기 ? "\n시기: " + e.희망시기 : ""}${e.대상인원 ? "\n대상: " + e.대상인원 : ""}\n${e.문의내용 || ""}`;
  try {
    await sendMemo(env, text, "https://mail.naver.com", "메일함 열기");
  } catch (e) {
    return json({ ok: false, error: e && e.message ? e.message : String(e) }, 500);
  }
  return json({ ok: true });
}

// ---------- 카카오 연결
function connect(url, env) {
  if (!env.KAKAO_REST_KEY) return page("KAKAO_REST_KEY 가 설정되어 있지 않습니다.", 500);
  const state = crypto.randomUUID();
  const q = new URLSearchParams({
    client_id: env.KAKAO_REST_KEY,
    redirect_uri: redirectUri(url),
    response_type: "code",
    scope: "talk_message",
    state,
  });
  return new Response(null, {
    status: 302,
    headers: { Location: KAKAO_AUTH + "?" + q, "Set-Cookie": `kstate=${state}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax` },
  });
}

async function callback(request, url, env) {
  const err = url.searchParams.get("error");
  if (err) return page("카카오 로그인이 취소되었거나 실패했습니다: " + (url.searchParams.get("error_description") || err), 400);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) return page("code 가 없습니다.", 400);
  const want = cookieValue(request.headers.get("Cookie") || "", "kstate");
  if (!want || want !== state) return page("확인 값이 맞지 않습니다. /connect 부터 다시 해 주세요.", 400);

  const body = { grant_type: "authorization_code", client_id: env.KAKAO_REST_KEY, redirect_uri: redirectUri(url), code };
  if (env.KAKAO_CLIENT_SECRET) body.client_secret = env.KAKAO_CLIENT_SECRET;
  const resp = await postForm(KAKAO_TOKEN, body);
  await saveTokens(env, resp, {});
  return page("카카오톡이 연결되었습니다. 이제 문의가 들어오면 '나와의 채팅'으로 알림이 옵니다.<br><br>" +
    "시험 카톡은 <b>/test?key=비밀번호</b> 주소로 열면 보내집니다.", 200,
    { "Set-Cookie": "kstate=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax" });
}

async function status(env) {
  const t = await loadTokens(env);
  if (!t) return page("연결 안 됨. /connect?key=… 로 연결해 주세요.", 200);
  const left = Math.round((t.refresh_expires_at - Date.now() / 1000) / 86400);
  return page(`연결됨 (${t.connected_at}). 토큰 갱신 기한 ${left}일 남음. 마지막 전송: ${t.last_sent || "-"}`, 200);
}

async function test(url, env) {
  await sendMemo(env, "[홈페이지] 알림 테스트 — 문의가 들어오면 이렇게 카톡이 와요.", "https://koexpert.co.kr", "홈페이지 열기");
  return page("시험 카톡을 보냈습니다. 카카오톡 '나와의 채팅'을 확인해 보세요.", 200);
}

// ---------- 토큰
async function loadTokens(env) {
  const raw = await env.KAKAO.get("tokens");
  return raw ? JSON.parse(raw) : null;
}

async function saveTokens(env, resp, old) {
  if (!resp.access_token) throw new Error("카카오 응답에 토큰이 없습니다: " + JSON.stringify(resp).slice(0, 200));
  const now = Math.floor(Date.now() / 1000);
  const t = {
    access_token: resp.access_token,
    expires_at: now + (resp.expires_in || 21600),
    refresh_token: resp.refresh_token || old.refresh_token || "",
    refresh_expires_at: resp.refresh_token_expires_in ? now + resp.refresh_token_expires_in : (old.refresh_expires_at || 0),
    connected_at: old.connected_at || new Date().toISOString().slice(0, 16).replace("T", " "),
    last_sent: old.last_sent || "",
  };
  await env.KAKAO.put("tokens", JSON.stringify(t));
  return t;
}

async function refresh(env, tokens) {
  const body = { grant_type: "refresh_token", client_id: env.KAKAO_REST_KEY, refresh_token: tokens.refresh_token };
  if (env.KAKAO_CLIENT_SECRET) body.client_secret = env.KAKAO_CLIENT_SECRET;
  return saveTokens(env, await postForm(KAKAO_TOKEN, body), tokens);
}

async function accessToken(env) {
  let t = await loadTokens(env);
  if (!t) throw new Error("카카오톡이 연결되어 있지 않습니다. /connect?key=… 로 연결해 주세요.");
  if (t.expires_at - 120 > Date.now() / 1000) return t;
  if (!t.refresh_token) throw new Error("토큰이 만료되었습니다. 다시 연결해 주세요.");
  return refresh(env, t);
}

async function sendMemo(env, text, linkUrl, buttonTitle) {
  const t = await accessToken(env);
  const cut = text.length > TEXT_LIMIT ? text.slice(0, TEXT_LIMIT - 1) + "…" : text;
  const template = { object_type: "text", text: cut, link: { web_url: linkUrl, mobile_web_url: linkUrl }, button_title: buttonTitle };
  const resp = await postForm(KAKAO_MEMO, { template_object: JSON.stringify(template) }, { Authorization: "Bearer " + t.access_token });
  if (resp.result_code !== 0) throw new Error("카카오 전송 실패: " + JSON.stringify(resp).slice(0, 200));
  t.last_sent = new Date().toISOString().slice(0, 16).replace("T", " ");
  await env.KAKAO.put("tokens", JSON.stringify(t));
}

// ---------- 공통
async function postForm(url, data, headers = {}) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8", ...headers },
    body: new URLSearchParams(data),
  });
  const text = await r.text();
  let out = {};
  try { out = JSON.parse(text || "{}"); } catch { out = { raw: text.slice(0, 200) }; }
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`);
  return out;
}

function redirectUri(url) { return url.origin + "/callback"; }
function adminOk(url, env) { return !!env.ADMIN_KEY && url.searchParams.get("key") === env.ADMIN_KEY; }
function cookieValue(header, name) {
  const m = header.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : "";
}

function cors(env, resp) {
  const h = new Headers(resp.headers);
  h.set("Access-Control-Allow-Origin", env.ALLOWED_ORIGIN || "*");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type");
  h.set("Access-Control-Max-Age", "86400");
  return new Response(resp.body, { status: resp.status, headers: h });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}

function page(msg, status = 200, extra = {}) {
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>한국엑스퍼트교육원 알림</title>
<body style="font-family:sans-serif;max-width:520px;margin:60px auto;padding:0 20px;line-height:1.7;color:#152b3d">
<h2 style="font-size:18px">한국엑스퍼트교육원 홈페이지 알림</h2><p>${msg}</p></body>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", ...extra } });
}
