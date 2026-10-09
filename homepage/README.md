# 한국엑스퍼트교육원 홈페이지

두 가지 방식으로 쓸 수 있습니다.

- **서버 없이 올리기 (지금 쓰는 방식):** `docs/` 폴더가 완성된 홈페이지입니다. GitHub Pages 같은 무료 정적 호스팅에 그대로 올리면 되고, 문의창은 Formspree 를 거쳐 메일로 옵니다. 아래 '서버 없이 올리기' 참고.
- **서버에 올리기:** 관리자 페이지(사진·소개서 올리기, 문의 내역, 카톡 알림)까지 쓰려면 Python 서버 한 대가 필요합니다. 아래 '관리자 페이지' 이후 참고.

| 주소 | 무엇 |
|---|---|
| `/` | 홈페이지 (교육원 소개, 교육 분야, 활동 사진, 진행 절차, 문의창, 강사잇다·교안노트·블로그·유튜브 바로가기) |
| `/admin` | 관리자 페이지 (문의 내역, 활동 사진, 회사소개서, 바로가기·연락처, 비밀번호) |

## 내 컴퓨터에서 열어 보기

Python 3.10 이상이 필요합니다 (https://www.python.org/downloads/ · 설치 때 "Add python.exe to PATH" 체크).

- 윈도우: `run.bat` 더블클릭
- 맥·리눅스: 터미널에서 `./run.sh`

처음 한 번은 설치 때문에 1~2분 걸립니다. 끝나면 http://localhost:8080 이 홈페이지,
http://localhost:8080/admin 이 관리자 페이지입니다.

## 관리자 페이지

- **처음 접속하면 비밀번호를 정하는 화면**이 나옵니다. 8자 이상으로 정해 주세요.
  (서버 환경변수 `HOMEPAGE_ADMIN_PASSWORD` 를 미리 넣어 두면 그 값으로 시작합니다.)
- **문의 내역:** 홈페이지 문의창으로 들어온 내용이 여기에 쌓입니다. 답변 후 '처리 완료', 1년 지나면 '지우기'.
- **활동 사진:** 여러 장을 한 번에 올립니다. 긴 쪽 1600px 로 줄이고 사진 속 위치 정보(EXIF)는 지웁니다. 설명 수정, 순서 바꾸기, 지우기가 됩니다. 사진이 한 장이라도 있으면 홈페이지에 '활동 사진' 칸이 생깁니다.
- **회사소개서:** PDF 한 파일. 올리면 홈페이지 첫 화면과 소개 칸에 '회사소개서 받기' 버튼이 생깁니다.
- **바로가기·연락처:** 강사잇다, 교안노트(스마트스토어), 블로그, 유튜브 주소와 전화·이메일·주소. 비워 두면 그 버튼은 흐리게 나오고 눌러지지 않습니다.
- 비밀번호를 5번 틀리면 1분 동안 막힙니다. 비밀번호를 잊었으면 `data/admin.json` 을 지우고 다시 접속하면 새로 정할 수 있습니다.

올린 파일과 설정은 전부 `data/` 폴더에 있습니다. 이 폴더만 백업하면 됩니다. git 에는 올라가지 않습니다.

## 문의 알림 (관리자 페이지 → 문의 알림)

문의가 들어오면 이메일과 카카오톡으로 바로 알려 줍니다. 설정한 쪽만 보내고, 알림이 실패해도 문의는 관리자 페이지에 남습니다.

**① 이메일 (네이버 메일)**
1. 네이버 메일 → 환경설정 → POP3/IMAP 설정 → 'SMTP 사용'을 켠다.
2. 네이버 ID → 보안설정 → '앱 비밀번호 관리'에서 앱 비밀번호를 하나 만든다 (2단계 인증이 켜져 있어야 함).
3. 관리자 페이지 '문의 알림'에 받을 이메일, 네이버 아이디, 앱 비밀번호를 넣고 저장 → '테스트 알림 보내기'.

**② 카카오톡 (나와의 채팅)**
1. https://developers.kakao.com 에 카카오 계정으로 로그인 → 내 애플리케이션 → 애플리케이션 추가 (이름: 한국엑스퍼트교육원 홈페이지).
2. 앱 키의 **REST API 키**를 복사해 관리자 페이지 '문의 알림'에 넣고 저장.
3. 카카오 앱 설정 → 카카오 로그인 → 활성화 ON, **Redirect URI** 에 관리자 페이지에 표시된 주소(`홈페이지주소/admin/kakao/callback`)를 등록.
4. 카카오 로그인 → 동의항목 → **'카카오톡 메시지 전송'(talk_message)** 을 켠다.
5. 관리자 페이지에서 '카카오톡 연결하기' → 카카오 로그인 화면에서 동의 → 돌아오면 '연결됨' 표시. '테스트 알림 보내기'로 확인.

카카오 토큰은 `data/kakao.json` 에 두고 만료 전에 자동 갱신합니다. 두 달 넘게 문의가 하나도 없으면 연결이 끊길 수 있으니 그때는 '다시 연결'을 누르면 됩니다.
알림 설정 값은 서버 환경변수 `HOMEPAGE_SMTP_USER`, `HOMEPAGE_SMTP_PASS`, `HOMEPAGE_NOTIFY_EMAIL`, `HOMEPAGE_KAKAO_REST_KEY`, `HOMEPAGE_BASE_URL` 로도 넣을 수 있습니다 (환경변수가 우선).

## 서버 없이 올리기 (GitHub Pages + Formspree)

`docs/` 폴더는 `python homepage/build_static.py` 가 만든 결과물입니다. 관리자 페이지 없이 홈페이지 한 장만 들어 있고,
사진·소개서는 `homepage/site_content/` 에 있는 파일을 씁니다.

- **처음 켜기 (한 번만):** GitHub 저장소 → Settings → Pages → Build and deployment 의 Source 를 **Deploy from a branch**,
  Branch 를 이 브랜치와 **/docs** 로 고르고 Save. 1~2분 뒤 `https://<계정>.github.io/<저장소>/` 에서 열립니다.
- **문의창:** `https://formspree.io/f/xwlvodan` 으로 보내고, Formspree 가 등록된 메일(koexpert@naver.com)로 전달합니다.
  무료 요금제는 한 달 50건까지입니다. 양식 주소를 바꾸려면 `build_static.py` 의 `FORM_ENDPOINT` 를 고치고 다시 만듭니다.
- **내용 고치기:** 글은 `homepage/templates/index.html`, 사진은 `homepage/site_content/photos/` + `photos.json`,
  소개서는 `homepage/site_content/brochure.pdf` 를 바꾼 뒤 `python homepage/build_static.py` 를 다시 실행하고 커밋합니다.
- **도메인 연결:** Settings → Pages → Custom domain 에 산 도메인을 넣고, 도메인 업체에서 안내대로 DNS 를 잡습니다.

## 서버에 올리기

Python 이 도는 서버 한 대면 됩니다. 가장 쉬운 길은 [Render](https://render.com) 나
[Railway](https://railway.app) 같은 서비스에 이 폴더를 올리고 실행 명령을 `python app.py` 로 두는 것입니다.
`data/` 폴더가 지워지지 않도록 **영구 디스크(persistent disk)** 를 붙이고, 환경변수
`HOMEPAGE_DATA` 에 그 디스크 경로를 넣어 주세요. 도메인은 그 서비스의 안내대로 연결하면 됩니다.

환경변수:

| 이름 | 기본값 | 뜻 |
|---|---|---|
| `HOMEPAGE_PORT` | `8080` | 포트 |
| `HOMEPAGE_HOST` | `0.0.0.0` | 바깥에서 접속 허용 |
| `HOMEPAGE_DATA` | `homepage/data` | 사진·소개서·문의·설정 저장 폴더 |
| `HOMEPAGE_ADMIN_PASSWORD` | 없음 | 첫 실행 때 관리자 비밀번호로 쓸 값 |

## 개발

```bash
pip install -r homepage/requirements.txt pytest httpx
pytest tests/test_homepage.py tests/test_homepage_notify.py tests/test_build_static.py
```
