"""서버 없이 올리는 정적 홈페이지(build_static.py) 테스트."""
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "homepage"))
spec = importlib.util.spec_from_file_location("build_static", ROOT / "homepage" / "build_static.py")
build_static = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_static)


def test_static_site_posts_to_formspree_and_has_no_server_paths(tmp_path):
    out = build_static.build(tmp_path / "site")
    html = (out / "index.html").read_text("utf-8")

    assert build_static.FORM_ENDPOINT in html and "'Accept': 'application/json'" in html
    assert "/api/inquiry" not in html
    assert "_subject: '[홈페이지 문의] '" in html and "_gotcha: d._gotcha" in html
    # 서버 전용 절대 경로가 남아 있으면 GitHub Pages 의 하위 주소에서 깨진다
    for bad in ('"/static/', 'url("/static/', '"/photos/', '"/brochure.pdf', "/admin", "cdn.jsdelivr.net"):
        assert bad not in html, bad
    assert 'url("fonts/PretendardVariable.woff2")' in html
    assert 'href="brochure.pdf"' in html and "회사소개서" in html

    assert (out / ".nojekyll").exists()
    assert (out / "CNAME").read_text("utf-8").strip() == "koexpert.co.kr"
    for rel in ("static/logo-h.png", "fonts/PretendardVariable.woff2", "brochure.pdf"):
        assert (out / rel).exists(), rel
    # 사진 목록에 있는 사진은 전부 들어 있고, 홈페이지에서 가리킨다
    for p in build_static.json.loads((build_static.CONTENT / "photos.json").read_text("utf-8")):
        assert (out / "photos" / f"{p['id']}.jpg").exists() and (out / "photos" / f"{p['id']}_t.jpg").exists()
        assert f'photos/{p["id"]}_t.jpg' in html

    # 홈페이지에 넣지 않기로 한 것들
    assert "010-9891-9450" not in html
    assert "koexpert@naver.com" in html
