// 카카오톡 알림 워커 테스트. 카카오 서버 대신 가짜 fetch 를 끼우고, KV 는 Map 으로 흉내 낸다.
//   node --test tests/kakao_worker.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../homepage/kakao-worker/worker.js";

const ORIGIN = "https://koexpert.co.kr";
const BASE = "https://alert.example.workers.dev";

function makeEnv() {
  const store = new Map();
  return {
    KAKAO: {
      async get(k) { return store.has(k) ? store.get(k) : null; },
      async put(k, v) { store.set(k, v); },
      _store: store,
    },
    KAKAO_REST_KEY: "RESTKEY",
    KAKAO_CLIENT_SECRET: "",
    ADMIN_KEY: "secret-admin",
    ALLOWED_ORIGIN: ORIGIN,
  };
}

function fakeKakao() {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const body = Object.fromEntries(new URLSearchParams(init.body));
    calls.push({ url, body, headers: init.headers });
    if (url.includes("/oauth/token")) {
      const n = calls.filter((c) => c.url.includes("/oauth/token")).length;
      return new Response(JSON.stringify({ access_token: "AT" + n, expires_in: 21600, refresh_token: "RT" + n, refresh_token_expires_in: 5184000 }), { status: 200 });
    }
    return new Response(JSON.stringify({ result_code: 0 }), { status: 200 });
  };
  return calls;
}

const inquiryBody = { 기관명: "알림중학교", 담당자: "김담당", 연락처: "010-2222-3333", 관심분야: "AI 교육, 창업", 운영형태: "캠프", 문의내용: "12월에 가능한가요?" };
const post = (env, body, origin = ORIGIN) =>
  worker.fetch(new Request(BASE + "/inquiry", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) }), env, {});

async function connect(env, calls) {
  const r = await worker.fetch(new Request(BASE + "/connect?key=secret-admin"), env, {});
  assert.equal(r.status, 302);
  const loc = new URL(r.headers.get("Location"));
  assert.equal(loc.origin + loc.pathname, "https://kauth.kakao.com/oauth/authorize");
  assert.equal(loc.searchParams.get("client_id"), "RESTKEY");
  assert.equal(loc.searchParams.get("scope"), "talk_message");
  assert.equal(loc.searchParams.get("redirect_uri"), BASE + "/callback");
  const state = loc.searchParams.get("state");
  const cookie = r.headers.get("Set-Cookie").split(";")[0];
  assert.equal(cookie, "kstate=" + state);
  const cb = await worker.fetch(new Request(`${BASE}/callback?code=abc&state=${state}`, { headers: { Cookie: cookie } }), env, {});
  assert.equal(cb.status, 200);
  assert.match(await cb.text(), /연결되었습니다/);
  const ex = calls.find((c) => c.url.includes("/oauth/token"));
  assert.equal(ex.body.code, "abc");
  assert.equal(ex.body.grant_type, "authorization_code");
  return state;
}

test("관리자 주소는 key 없이는 열리지 않는다", async () => {
  const env = makeEnv();
  for (const p of ["/connect", "/status", "/test", "/"]) {
    const r = await worker.fetch(new Request(BASE + p), env, {});
    assert.equal(r.status, 403, p);
  }
  const r = await worker.fetch(new Request(BASE + "/status?key=secret-admin"), env, {});
  assert.match(await r.text(), /연결 안 됨/);
});

test("카카오 연결 → 문의 알림 → 만료되면 갱신 → 하루 한 번 갱신", async () => {
  const env = makeEnv();
  const calls = fakeKakao();
  await connect(env, calls);
  assert.equal(JSON.parse(env.KAKAO._store.get("tokens")).refresh_token, "RT1");

  const bad = await worker.fetch(new Request(BASE + "/callback?code=abc&state=wrong", { headers: { Cookie: "kstate=right" } }), env, {});
  assert.equal(bad.status, 400);

  const r = await post(env, inquiryBody);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  const memo = calls.at(-1);
  assert.match(memo.url, /talk\/memo\/default\/send$/);
  assert.equal(memo.headers.Authorization, "Bearer AT1");
  const tpl = JSON.parse(memo.body.template_object);
  assert.equal(tpl.object_type, "text");
  assert.match(tpl.text, /\[홈페이지 문의\] 알림중학교 · 김담당 · 010-2222-3333/);
  assert.match(tpl.text, /AI 교육, 창업 \/ 캠프/);
  assert.match(tpl.text, /12월에 가능한가요\?/);
  assert.ok(tpl.text.length <= 200);

  // 토큰이 만료되면 갱신한 뒤 보낸다
  const t = JSON.parse(env.KAKAO._store.get("tokens"));
  t.expires_at = 1;
  env.KAKAO._store.set("tokens", JSON.stringify(t));
  await post(env, inquiryBody);
  const refreshCall = calls.filter((c) => c.body.grant_type === "refresh_token").at(-1);
  assert.equal(refreshCall.body.refresh_token, "RT1");
  assert.equal(calls.at(-1).headers.Authorization, "Bearer AT2");

  // 스케줄(매일)도 갱신한다
  const before = calls.length;
  await worker.scheduled({}, env, {});
  assert.equal(calls.length, before + 1);
  assert.equal(calls.at(-1).body.grant_type, "refresh_token");

  const st = await worker.fetch(new Request(BASE + "/status?key=secret-admin"), env, {});
  assert.match(await st.text(), /연결됨/);
  const te = await worker.fetch(new Request(BASE + "/test?key=secret-admin"), env, {});
  assert.equal(te.status, 200);
  assert.match(JSON.parse(calls.at(-1).body.template_object).text, /알림 테스트/);
});

test("문의 검사: 다른 사이트, 로봇 칸, 필수 칸, 너무 잦은 전송, 연결 안 됨", async () => {
  const env = makeEnv();
  const calls = fakeKakao();

  assert.equal((await post(env, inquiryBody, "https://evil.example")).status, 403);
  const hp = await post(env, { ...inquiryBody, _gotcha: "spam" });
  assert.deepEqual(await hp.json(), { ok: true });
  assert.equal(calls.length, 0);
  assert.equal((await post(env, { 기관명: "x" })).status, 400);

  // 연결 전에는 실패를 돌려주지만 서버가 죽지는 않는다
  const r = await post(env, inquiryBody);
  assert.equal(r.status, 500);
  assert.match((await r.json()).error, /연결되어 있지 않습니다/);

  await connect(env, calls);
  for (let i = 0; i < 4; i++) assert.equal((await post(env, inquiryBody)).status, 200);
  assert.equal((await post(env, inquiryBody)).status, 429);

  const opt = await worker.fetch(new Request(BASE + "/inquiry", { method: "OPTIONS", headers: { Origin: ORIGIN } }), env, {});
  assert.equal(opt.status, 204);
  assert.equal(opt.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
});
