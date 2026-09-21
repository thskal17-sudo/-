"""edugen run products/<sku>  →  products/<sku>/out/ 에 썸네일·상세페이지 생성."""
from __future__ import annotations

import shutil
from pathlib import Path

import typer

from . import generate, ingest, qa, render
from .schemas import ContentPlan, MaterialProfile

app = typer.Typer(add_completion=False, help="교육자료 썸네일·상세페이지 자동 생성")


@app.command()
def run(
    product_dir: Path = typer.Argument(..., help="products/<sku> 폴더"),
    offline: bool = typer.Option(False, "--offline", help="Claude 없이 규칙 기반 대체안으로 실행"),
    force: bool = typer.Option(False, "--force", help="캐시된 분석·카피 JSON 을 무시하고 다시 생성"),
    style: str = typer.Option(None, "--style", help="썸네일 목업: stack | fan | screen"),
    width: int = typer.Option(860, help="상세페이지 CSS 폭"),
    scale: int = typer.Option(2, help="상세페이지 해상도 배율"),
    max_segment: int = typer.Option(1500, help="상세 이미지 한 장의 최대 세로(CSS px)"),
):
    product_dir = product_dir.resolve()
    out = product_dir / "out"
    work = out / "_work"
    if force and out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True, exist_ok=True)

    meta = ingest.load_meta(product_dir)
    typer.echo(f"[1/6] 입력: {meta.sku}")
    pdf = ingest.ensure_pdf(product_dir)
    page_images, texts = ingest.extract_pages(pdf, product_dir / "pages")
    typer.echo(f"      {pdf.name} → {len(page_images)}쪽")

    use_llm = generate.llm_available() and not offline
    profile_path, plan_path = out / "material_profile.json", out / "content_plan.json"

    typer.echo(f"[2/6] 분석 ({'Claude' if use_llm else '오프라인 대체안'})")
    if profile_path.exists() and not force:
        profile = generate.load_json(MaterialProfile, profile_path)
    else:
        profile = generate.analyze(pdf, meta) if use_llm else generate.fallback_profile(meta, texts)
        # 판매자 메타가 있으면 우선
        for f in ("material_type", "school_level", "grade", "subject", "has_answer_key"):
            v = getattr(meta, f)
            if v is not None:
                setattr(profile, f, v)
        if meta.preview_pages:
            profile.preview_pages = meta.preview_pages
        generate.save_json(profile, profile_path)

    typer.echo("[3/6] 카피")
    if plan_path.exists() and not force:
        plan = generate.load_json(ContentPlan, plan_path)
    else:
        plan = generate.write_copy(profile, meta) if use_llm else generate.fallback_plan(profile, meta)
        generate.save_json(plan, plan_path)

    typer.echo("[4/6] 미리보기 워터마크")
    previews = []
    for n in profile.preview_pages[: generate.max_preview_pages(profile.page_count)]:
        if 1 <= n <= len(page_images):
            dst = out / "preview" / f"preview_{n:03d}.jpg"
            ingest.watermark(page_images[n - 1], dst, meta.store_name)
            previews.append({"page": n, "path": dst})

    typer.echo("[5/6] 렌더링")
    thumb_style = style or render.pick_style(meta, profile)
    other = "stack" if thumb_style != "stack" else "fan"
    # 썸네일에 쓸 페이지: 미리보기 페이지 우선, 부족하면 앞 페이지로 채움
    thumb_pages = [page_images[p["page"] - 1] for p in previews]
    for p in page_images:
        if len(thumb_pages) >= 5:
            break
        if p not in thumb_pages:
            thumb_pages.append(p)
    thumbs: list[Path] = []
    with render.Browser() as b:
        thumbs.append(render.render_thumbnail(b, meta, profile, plan, thumb_pages, thumb_style, False,
                                              out / "thumb_main.jpg", work))
        thumbs.append(render.render_thumbnail(b, meta, profile, plan, thumb_pages, thumb_style, True,
                                              out / "thumb_01.jpg", work,
                                              corner=f"{profile.page_count}쪽"))
        thumbs.append(render.render_thumbnail(b, meta, profile, plan, thumb_pages, other, True,
                                              out / "thumb_02.jpg", work,
                                              corner=("정답 포함" if profile.has_answer_key else "")))
        details = render.render_detail(b, meta, profile, plan, previews, out, work,
                                       width=width, scale=scale, max_segment=max_segment)
    typer.echo(f"      썸네일 {len(thumbs)}장, 상세 {len(details)}장")

    typer.echo("[6/6] 검수")
    report = qa.check(plan, profile, thumbs, details, len(previews))
    generate.save_json(report, out / "qa_report.json")
    (out / "product_name.txt").write_text(plan.product_name, encoding="utf-8")
    (out / "search_tags.txt").write_text("\n".join(plan.search_tags), encoding="utf-8")
    for i in report.issues:
        typer.echo(f"      [{i.level}] {i.where}: {i.message}")
    typer.echo(("검수 통과" if report.ok else "검수 실패 (error 항목을 고치세요)") + f" → {out}")
    raise typer.Exit(code=0 if report.ok else 1)


if __name__ == "__main__":
    app()
