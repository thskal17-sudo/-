"""한 상품 폴더를 처리하는 전체 흐름. CLI 와 웹 업로드가 함께 쓴다."""
from __future__ import annotations

import shutil
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from . import generate, ingest, qa, render
from .schemas import ContentPlan, MaterialProfile, QAReport

Log = Callable[[str], None]


@dataclass
class Result:
    out_dir: Path
    plan: ContentPlan
    profile: MaterialProfile
    report: QAReport
    thumbs: list[Path]
    details: list[Path]
    used_llm: bool
    style: str
    landscape: bool
    notes: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return self.report.ok


def run_product(
    product_dir: Path,
    *,
    offline: bool = False,
    force: bool = False,
    style: str | None = None,
    width: int = 860,
    scale: int = 2,
    max_segment: int = 1500,
    log: Log = print,
) -> Result:
    product_dir = product_dir.resolve()
    out = product_dir / "out"
    work = out / "_work"
    if force and out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True, exist_ok=True)

    meta = ingest.load_meta(product_dir)
    log(f"[1/6] 입력 확인: {meta.sku}")
    src = ingest.find_source(product_dir)
    if src.suffix.lower() in ingest.CONVERTIBLE:
        log(f"      {src.name} → PDF 변환 중 (LibreOffice)")
    pdf = ingest.ensure_pdf(product_dir)
    page_images, texts = ingest.extract_pages(pdf, product_dir / "pages")
    landscape = ingest.is_landscape(page_images[0])
    log(f"      {len(page_images)}쪽, {'가로형(슬라이드)' if landscape else '세로형(문서)'}")

    use_llm = generate.llm_available() and not offline
    profile_path, plan_path = out / "material_profile.json", out / "content_plan.json"

    log(f"[2/6] 자료 분석 ({'Claude' if use_llm else '규칙 기반'})")
    if profile_path.exists() and not force:
        profile = generate.load_json(MaterialProfile, profile_path)
    else:
        profile = generate.analyze(pdf, meta) if use_llm else generate.fallback_profile(meta, texts)
        # 판매자가 적은 값이 있으면 우선한다
        for f in ("material_type", "school_level", "grade", "subject", "has_answer_key"):
            v = getattr(meta, f)
            if v is not None:
                setattr(profile, f, v)
        if meta.preview_pages:
            profile.preview_pages = meta.preview_pages
        profile.page_count = len(page_images)
        generate.save_json(profile, profile_path)

    log("[3/6] 상품명·상세 문구 작성")
    if plan_path.exists() and not force:
        plan = generate.load_json(ContentPlan, plan_path)
    else:
        plan = generate.write_copy(profile, meta) if use_llm else generate.fallback_plan(profile, meta)
        generate.save_json(plan, plan_path)

    log("[4/6] 미리보기 워터마크")
    preview_dir = out / "preview"
    if preview_dir.exists():
        shutil.rmtree(preview_dir)
    previews = []
    for n in profile.preview_pages[: generate.max_preview_pages(profile.page_count)]:
        if 1 <= n <= len(page_images):
            dst = preview_dir / f"preview_{n:03d}.jpg"
            ingest.watermark(page_images[n - 1], dst, meta.store_name)
            previews.append({"page": n, "path": dst})

    log("[5/6] 썸네일·상세페이지 렌더링")
    thumb_style = style or render.pick_style(meta, profile, landscape)
    other = "stack" if thumb_style != "stack" else "fan"
    thumb_pages = [page_images[p["page"] - 1] for p in previews]
    for p in page_images:
        if len(thumb_pages) >= 5:
            break
        if p not in thumb_pages:
            thumb_pages.append(p)
    for old in out.glob("detail_*.jpg"):
        old.unlink()
    thumbs: list[Path] = []
    with render.Browser() as b:
        thumbs.append(render.render_thumbnail(b, meta, profile, plan, thumb_pages, thumb_style, False,
                                              out / "thumb_main.jpg", work, landscape=landscape))
        thumbs.append(render.render_thumbnail(b, meta, profile, plan, thumb_pages, thumb_style, True,
                                              out / "thumb_01.jpg", work, corner=f"{profile.page_count}{'장' if landscape else '쪽'}",
                                              landscape=landscape))
        thumbs.append(render.render_thumbnail(b, meta, profile, plan, thumb_pages, other, True,
                                              out / "thumb_02.jpg", work,
                                              corner=("정답 포함" if profile.has_answer_key else ""),
                                              landscape=landscape))
        details = render.render_detail(b, meta, profile, plan, previews, out, work, width=width,
                                       scale=scale, max_segment=max_segment, landscape=landscape)
    log(f"      썸네일 {len(thumbs)}장, 상세 {len(details)}장")

    log("[6/6] 검수")
    report = qa.check(plan, profile, thumbs, details, len(previews))
    generate.save_json(report, out / "qa_report.json")
    (out / "product_name.txt").write_text(plan.product_name, encoding="utf-8")
    (out / "search_tags.txt").write_text("\n".join(plan.search_tags), encoding="utf-8")
    for i in report.issues:
        log(f"      [{i.level}] {i.where}: {i.message}")
    log("검수 통과" if report.ok else "검수에서 고칠 항목이 있습니다")
    return Result(out_dir=out, plan=plan, profile=profile, report=report, thumbs=thumbs,
                  details=details, used_llm=use_llm, style=thumb_style, landscape=landscape)


def build_zip(out_dir: Path, zip_path: Path) -> Path:
    """스토어 업로드용 산출물만 묶는다. 중간 작업 파일은 뺀다."""
    names = sorted(out_dir.glob("thumb_*.jpg")) + sorted(out_dir.glob("detail_*.jpg"))
    texts = [out_dir / n for n in ("product_name.txt", "search_tags.txt") if (out_dir / n).exists()]
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for p in names + texts:
            z.write(p, p.name)
        for p in sorted((out_dir / "preview").glob("*.jpg")):
            z.write(p, f"preview/{p.name}")
    return zip_path
