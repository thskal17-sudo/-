"""서버 없이 올리는 '보여 주기용' 홈페이지를 만든다.

관리자 페이지 없이 홈페이지 한 장만 내보낸다. 문의창은 Formspree(https://formspree.io) 로 보내서
메일(koexpert@naver.com)로 받는다. 내용은 homepage/site_content/ 에 있는 사진·소개서를 쓴다.

    python homepage/build_static.py            # docs/ 폴더에 만든다 (GitHub Pages 용)
    python homepage/build_static.py 다른폴더    # 다른 폴더에 만든다

사진을 바꾸려면 site_content/photos/ 와 photos.json 을, 소개서는 site_content/brochure.pdf 를 바꾸고
다시 실행하면 된다.
"""
from __future__ import annotations

import json
import re
import shutil
import sys
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

HERE = Path(__file__).resolve().parent
CONTENT = HERE / "site_content"
DEFAULT_OUT = HERE.parent / "docs"

# 문의창이 보내는 곳. Formspree 양식 주소 (받는 메일은 Formspree 쪽에서 정한다).
FORM_ENDPOINT = "https://formspree.io/f/xwlvodan"
# 카카오톡 알림 워커 주소 (homepage/kakao-worker/ 참고). 비워 두면 메일만 보낸다.
KAKAO_ENDPOINT = "https://koexpert-alert.koexpert.workers.dev/inquiry"
# 검색 등록 확인 코드. 네이버 서치어드바이저 / 구글 서치콘솔의 'HTML 태그' 방식 content 값. 비우면 넣지 않는다.
NAVER_SITE_VERIFICATION = "971a57149f5ea9038df211a780fb91f557d2ebfa"
GOOGLE_SITE_VERIFICATION = ""
# 홈페이지 도메인. GitHub Pages 가 docs/CNAME 을 읽어 이 주소로 연결한다. 비우면 github.io 주소를 쓴다.
DOMAIN = "koexpert.co.kr"

FONT_CDN = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">'
FONT_LOCAL = ('<style>@font-face{font-family:"Pretendard Variable";src:url("fonts/PretendardVariable.woff2") '
              'format("woff2-variations");font-weight:45 920;font-display:swap}</style>')

# 메일이 간 뒤 같은 내용을 카카오톡 알림 워커에도 보낸다. 실패해도 문의는 이미 메일로 갔으므로 조용히 넘긴다.
KAKAO_FETCH = ("""
      if (res.ok) { fetch('%s', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(function () {}); }""" % KAKAO_ENDPOINT) if KAKAO_ENDPOINT else ""
# 서버 버전은 /api/inquiry 로 보냈다. 정적 버전은 Formspree 로 바로 보낸다.
SERVER_FETCH = re.compile(r"const res = await fetch\('/api/inquiry'.*?\);", re.S)
FORM_FETCH = """const payload = {
        _subject: '[홈페이지 문의] ' + d.기관명 + ' · ' + d.담당자,
        _replyto: d.이메일,
        _gotcha: d._gotcha,
        기관명: d.기관명, 담당자: d.담당자, 연락처: d.연락처, 이메일: d.이메일,
        관심분야: d.관심분야.join(', '), 운영형태: d.운영형태.join(', '),
        대상인원: d.대상인원, 희망시기: d.희망시기, 문의내용: d.문의내용,
      };
      const res = await fetch('%s', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(payload) });%s""" % (FORM_ENDPOINT, KAKAO_FETCH)
SERVER_ERROR = "if (!res.ok || !out.ok) throw new Error(out.error || '');"
FORM_ERROR = "if (!res.ok || !out.ok) throw new Error((out.errors && out.errors[0] && out.errors[0].message) || out.error || '');"


def site_config() -> dict:
    sys.path.insert(0, str(HERE))
    from app import DEFAULT_SITE  # 바로가기·연락처는 서버 버전과 같은 기본값을 쓴다

    return json.loads(json.dumps(DEFAULT_SITE))


def render_index() -> str:
    env = Environment(loader=FileSystemLoader(str(HERE / "templates")), autoescape=select_autoescape(["html"]))
    photos = json.loads((CONTENT / "photos.json").read_text("utf-8")) if (CONTENT / "photos.json").exists() else []
    brochure = {"name": "회사소개서.pdf"} if (CONTENT / "brochure.pdf").exists() else None
    html = env.get_template("index.html").render(site=site_config(), photos=photos, brochure=brochure, hero=None)

    if FONT_CDN not in html:
        raise SystemExit("템플릿에서 글꼴 링크를 찾지 못했습니다.")
    html = html.replace(FONT_CDN, FONT_LOCAL)
    # 서버 경로(/static/…)를 폴더 안 상대 경로로 바꾼다. 어느 주소 아래에 올려도 동작한다.
    html = html.replace('"/static/', '"static/').replace('url("/static/', 'url("static/').replace('"/photos/', '"photos/')
    html = html.replace('href="/brochure.pdf?download=1"', 'href="brochure.pdf"').replace('href="/brochure.pdf"', 'href="brochure.pdf"')

    tags = ""
    if NAVER_SITE_VERIFICATION:
        tags += f'<meta name="naver-site-verification" content="{NAVER_SITE_VERIFICATION}">\n'
    if GOOGLE_SITE_VERIFICATION:
        tags += f'<meta name="google-site-verification" content="{GOOGLE_SITE_VERIFICATION}">\n'
    if DOMAIN:
        tags += f'<link rel="canonical" href="https://{DOMAIN}/">\n'
    html = html.replace("</title>\n", "</title>\n" + tags, 1)

    html, n = SERVER_FETCH.subn(FORM_FETCH, html)
    if n != 1 or SERVER_ERROR not in html:
        raise SystemExit("문의창 전송 코드를 찾지 못했습니다. templates/index.html 이 바뀌었으면 build_static.py 도 맞춰 주세요.")
    html = html.replace(SERVER_ERROR, FORM_ERROR)
    return html


def build(out: Path = DEFAULT_OUT) -> Path:
    html = render_index()
    out.mkdir(parents=True, exist_ok=True)
    for sub in ("static", "photos", "fonts"):
        if (out / sub).exists():
            shutil.rmtree(out / sub)
    shutil.copytree(HERE / "static", out / "static")
    if (CONTENT / "photos").exists():
        shutil.copytree(CONTENT / "photos", out / "photos")
    shutil.copytree(CONTENT / "fonts", out / "fonts")
    if (CONTENT / "brochure.pdf").exists():
        shutil.copy(CONTENT / "brochure.pdf", out / "brochure.pdf")
    (out / "index.html").write_text(html, "utf-8")
    (out / ".nojekyll").write_text("", "utf-8")  # GitHub Pages 가 파일을 그대로 올리게 한다
    if DOMAIN:
        (out / "CNAME").write_text(DOMAIN + "\n", "utf-8")
        # 검색 엔진용: 어디를 읽어도 되는지(robots)와 페이지 목록(sitemap)
        (out / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: https://{DOMAIN}/sitemap.xml\n", "utf-8")
        (out / "sitemap.xml").write_text(
            '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            f"  <url><loc>https://{DOMAIN}/</loc><changefreq>monthly</changefreq><priority>1.0</priority></url>\n"
            f"  <url><loc>https://{DOMAIN}/brochure.pdf</loc><changefreq>yearly</changefreq><priority>0.5</priority></url>\n"
            "</urlset>\n", "utf-8")
    return out


if __name__ == "__main__":
    target = build(Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUT)
    print(f"만들었습니다: {target}")
