"""규칙 기반 검수. 네이버 규격·금칙어·구성 누락을 잡는다."""
from __future__ import annotations

import re
from pathlib import Path

import yaml
from PIL import Image

from .schemas import ContentPlan, MaterialProfile, QAIssue, QAReport

BANNED_PATH = Path(__file__).parent / "banned_terms.yaml"


def _banned() -> list[str]:
    return yaml.safe_load(BANNED_PATH.read_text(encoding="utf-8"))["terms"]


def check(plan: ContentPlan, profile: MaterialProfile, thumbs: list[Path], details: list[Path],
          preview_count: int) -> QAReport:
    issues: list[QAIssue] = []
    err = lambda w, m: issues.append(QAIssue(level="error", where=w, message=m))
    warn = lambda w, m: issues.append(QAIssue(level="warn", where=w, message=m))

    # 상품명
    if len(plan.product_name) > 50:
        err("product_name", f"50자 초과 ({len(plan.product_name)}자)")
    if re.search(r"[!?~★☆♥※\[\]\(\)\{\}<>/\\|@#$%^&*+=]", plan.product_name):
        err("product_name", "특수문자 포함")
    # 태그
    if len(plan.search_tags) != 10:
        warn("search_tags", f"태그 {len(plan.search_tags)}개 (10개 권장)")
    if len(set(plan.search_tags)) != len(plan.search_tags):
        err("search_tags", "중복 태그")
    for t in plan.search_tags:
        if " " in t:
            warn("search_tags", f"띄어쓰기 포함: {t}")
    # 금칙어
    text = " ".join([plan.product_name, plan.thumbnail.title, plan.thumbnail.sub]
                    + [s.title + " " + s.body + " ".join(s.items) + " ".join(" ".join(p) for p in s.pairs)
                       for s in plan.sections])
    for term in _banned():
        if term in text:
            err("copy", f"금칙어: {term}")
    # 섹션 구성
    types = [s.type for s in plan.sections]
    for must in ("hero", "composition", "preview", "license", "delivery_refund"):
        if must not in types:
            err("sections", f"필수 섹션 누락: {must}")
    if "delivery_refund" in types:
        s = next(s for s in plan.sections if s.type == "delivery_refund")
        if "이메일" not in s.body:
            err("delivery_refund", "이메일 전달 안내 문구 없음")
        if not any("청약철회" in i or "환불" in i for i in s.items + [s.body]):
            err("delivery_refund", "환불·청약철회 안내 없음")
    # 미리보기 비율
    from .generate import max_preview_pages
    allowed = max_preview_pages(profile.page_count)
    if preview_count > allowed:
        err("preview", f"미리보기 {preview_count}쪽은 허용치 {allowed}쪽 초과 (전체 {profile.page_count}쪽의 30%, 최소 2쪽)")
    # 저작권
    for f in profile.copyright_flags:
        warn("copyright", f)
    for f in plan.compliance_flags:
        warn("compliance", f)
    # 이미지 규격
    for p in thumbs:
        w, h = Image.open(p).size
        if (w, h) != (1000, 1000):
            err(p.name, f"썸네일 크기 {w}x{h} (1000x1000 필요)")
        if p.stat().st_size > 2_000_000:
            warn(p.name, "2MB 초과")
    widths = {Image.open(p).size[0] for p in details}
    if len(widths) > 1:
        err("detail", f"상세 이미지 폭 불일치: {sorted(widths)}")
    for p in details:
        if p.stat().st_size > 5_000_000:
            warn(p.name, "5MB 초과, 업로드 제한에 걸릴 수 있음")
    return QAReport(issues=issues)
