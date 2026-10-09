# 문의 → 카카오톡 알림 (서버 없이, Cloudflare Worker)

홈페이지 문의창은 Formspree 로 메일을 보냅니다. 여기에 더해 같은 내용을 Cloudflare Worker 에도 보내면,
워커가 카카오 '나에게 보내기'로 대표 카카오톡의 **나와의 채팅**에 알림을 넣습니다.
Cloudflare Workers 무료 요금제(하루 10만 건)로 충분하고, 서버를 빌리지 않아도 됩니다.

`worker.js` 한 파일이 전부입니다. 준비물은 Cloudflare 계정(무료)과 카카오 개발자 앱입니다.

## 1. 카카오 개발자 앱

1. https://developers.kakao.com → 내 애플리케이션 → 애플리케이션 추가 (이름: 한국엑스퍼트교육원 홈페이지).
2. 앱 → **앱 키** 에서 **REST API 키** 를 적어 둔다.
3. **카카오 로그인** → 활성화 ON.
4. **카카오 로그인 → 동의항목** → '카카오톡 메시지 전송'(talk_message) 을 '이용 중 동의'로 켠다.
5. **Redirect URI** 에 워커 주소 + `/callback` 을 등록한다 (워커를 만든 뒤 주소를 알게 되면 등록).
   새 콘솔에서는 앱 → 플랫폼 키 → REST API 키 → 리다이렉트 URI 에 있다.

## 2. Cloudflare Worker 만들기

1. https://dash.cloudflare.com 가입(무료) → 로그인.
2. 왼쪽 **Workers & Pages** → **Create** → **Start with Hello World!** → 이름을 `koexpert-alert` 로 → **Deploy**.
3. **Edit code** 를 눌러 편집기를 열고, 기존 내용을 지운 뒤 `worker.js` 내용을 전부 붙여 넣고 **Deploy**.
4. 워커 주소는 `https://koexpert-alert.<계정이름>.workers.dev` 처럼 나온다. 이 주소를 적어 둔다.

## 3. 저장소(KV)와 설정값

1. 왼쪽 **Storage & Databases → KV** → **Create** → 이름 `kakao-tokens` → Create.
2. 워커 → **Settings → Bindings → Add → KV namespace**: Variable name `KAKAO`, Namespace `kakao-tokens` → Deploy.
3. 워커 → **Settings → Variables and Secrets → Add** 로 아래를 넣는다 (Type 은 Secret 으로).

| 이름 | 값 |
|---|---|
| `KAKAO_REST_KEY` | 카카오 앱의 REST API 키 |
| `KAKAO_CLIENT_SECRET` | 카카오 로그인 → 보안 의 Client Secret. '사용 안 함'이면 넣지 않는다 |
| `ADMIN_KEY` | 아무 긴 비밀번호 (연결·테스트 주소를 열 때 쓴다) |
| `ALLOWED_ORIGIN` | `https://koexpert.co.kr` (Type 은 Text 로 두어도 된다) |

4. 워커 → **Settings → Triggers → Cron Triggers → Add**: `0 3 * * *` (하루 한 번 토큰을 갱신해 연결이 끊기지 않게 한다).

## 4. 카카오톡 연결

1. 카카오 개발자 앱의 Redirect URI 에 `https://<워커 주소>/callback` 을 등록한다.
2. 브라우저에서 `https://<워커 주소>/connect?key=<ADMIN_KEY>` 를 연다 → 카카오 로그인 → '카카오톡 메시지 전송' 동의.
3. "카카오톡이 연결되었습니다" 가 나오면 `https://<워커 주소>/test?key=<ADMIN_KEY>` 를 열어 시험 카톡이 오는지 본다.
4. `https://<워커 주소>/status?key=<ADMIN_KEY>` 에서 연결 상태를 볼 수 있다.

## 5. 홈페이지에 연결

`homepage/build_static.py` 의 `KAKAO_ENDPOINT` 에 `https://<워커 주소>/inquiry` 를 넣고 `python homepage/build_static.py` 로
다시 만들어 커밋한다. 문의창은 메일(Formspree)을 먼저 보내고, 성공하면 같은 내용을 워커에도 보낸다.
워커가 실패해도 메일은 이미 갔으므로 문의가 사라지지 않는다.

## 테스트

```bash
node --test tests/kakao_worker.test.mjs
```
