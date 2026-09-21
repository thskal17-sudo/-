from pathlib import Path

from PIL import Image

from edugen import generate, qa, render
from edugen.schemas import Meta, MaterialProfile


def _profile(n=12):
    return MaterialProfile(material_type="활동지", school_level="초등", grade="5학년", subject="국어",
                           unit="1단원", page_count=n, has_answer_key=True, toc=["활동 1"],
                           preview_pages=[1, 2, 3], summary="테스트")


def test_max_preview_pages():
    assert generate.max_preview_pages(6) == 2
    assert generate.max_preview_pages(12) == 4
    assert generate.max_preview_pages(1) == 2


def test_fallback_plan_passes_qa(tmp_path):
    meta = Meta(sku="t", subject="국어", grade="5학년")
    plan = generate.fallback_plan(_profile(), meta)
    thumb = tmp_path / "t.jpg"
    Image.new("RGB", (1000, 1000)).save(thumb)
    report = qa.check(plan, _profile(), [thumb], [], preview_count=3)
    assert report.ok, [i.message for i in report.issues]


def test_qa_catches_banned_and_size(tmp_path):
    meta = Meta(sku="t")
    plan = generate.fallback_plan(_profile(), meta)
    plan.product_name = "성적 보장 활동지!"
    bad = tmp_path / "bad.jpg"
    Image.new("RGB", (800, 800)).save(bad)
    report = qa.check(plan, _profile(), [bad], [], preview_count=6)
    msgs = " ".join(i.message for i in report.issues if i.level == "error")
    assert "금칙어" in msgs and "특수문자" in msgs and "800x800" in msgs and "미리보기" in msgs


def test_slice_by_sections(tmp_path):
    scale = 2
    full = tmp_path / "full.png"
    Image.new("RGB", (100, 5000 * scale)).save(full)
    boxes = [{"name": "a", "top": 0, "bottom": 900}, {"name": "b", "top": 900, "bottom": 1800},
             {"name": "c", "top": 1800, "bottom": 4200}, {"name": "d", "top": 4200, "bottom": 5000}]
    outs = render.slice_by_sections(full, boxes, tmp_path / "out", scale, max_segment=1500)
    heights = [Image.open(p).size[1] // scale for p in outs]
    assert sum(heights) == 5000
    assert max(heights) <= 1500
    assert heights[0] == 900  # 섹션 경계에서 잘림
