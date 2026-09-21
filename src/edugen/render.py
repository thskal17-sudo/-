"""Jinja2 HTML → Playwright 캡처 → 분할. 픽셀은 여기서만 만든다."""
from __future__ import annotations

import os
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from PIL import Image

from . import FONTS_DIR, TEMPLATES_DIR
from .schemas import ContentPlan, MaterialProfile, Meta

SUBJECT_THEMES = {
    "국어": "korean", "수학": "math", "영어": "english", "사회": "social", "역사": "social",
    "도덕": "social", "과학": "science", "미술": "art", "음악": "art", "체육": "science",
}
THUMB_SIZE = 1000
CHROMIUM = os.environ.get("EDUGEN_CHROMIUM", "/opt/pw-browsers/chromium")


def pick_theme(meta: Meta, profile: MaterialProfile) -> str:
    if meta.theme:
        return meta.theme
    return SUBJECT_THEMES.get(profile.subject, "default")


def pick_style(meta: Meta, profile: MaterialProfile) -> str:
    if meta.thumbnail_style:
        return meta.thumbnail_style
    return "screen" if profile.material_type == "교안" else "fan"


def _env() -> Environment:
    return Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)), autoescape=select_autoescape(["html"]))


def _file_url(p: Path) -> str:
    return p.resolve().as_uri()


class Browser:
    """Playwright 브라우저를 한 번만 띄워 여러 장을 찍는다."""

    def __enter__(self):
        from playwright.sync_api import sync_playwright

        self._pw = sync_playwright().start()
        launch = {"executable_path": CHROMIUM} if Path(CHROMIUM).exists() else {}
        self._browser = self._pw.chromium.launch(**launch)
        return self

    def __exit__(self, *exc):
        self._browser.close()
        self._pw.stop()

    def shot(self, html: Path, out: Path, width: int, height: int | None, scale: int = 1,
             full_page: bool = False) -> list[dict]:
        """캡처하고 각 섹션의 CSS 픽셀 경계를 돌려준다."""
        page = self._browser.new_page(viewport={"width": width, "height": height or 800},
                                      device_scale_factor=scale)
        page.goto(_file_url(html))
        page.wait_for_load_state("networkidle")
        page.evaluate("document.fonts.ready")
        page.wait_for_timeout(150)
        boxes = page.evaluate(
            "Array.from(document.querySelectorAll('[data-sec]')).map(e => {"
            "const r = e.getBoundingClientRect(); return {name: e.dataset.sec, top: r.top + window.scrollY, bottom: r.bottom + window.scrollY};})"
        )
        page.screenshot(path=str(out), full_page=full_page, type="png")
        page.close()
        return boxes


def render_thumbnail(browser: Browser, meta: Meta, profile: MaterialProfile, plan: ContentPlan,
                     page_images: list[Path], style: str, with_text: bool, out_png: Path,
                     work_dir: Path, corner: str = "") -> Path:
    theme = pick_theme(meta, profile)
    imgs = [_file_url(p) for p in page_images] or []
    html = _env().get_template(f"thumbnails/{style}.html").render(
        theme=theme, fonts_url=_file_url(FONTS_DIR), pages=imgs, with_text=with_text,
        t=plan.thumbnail, corner=corner, bg=("var(--primary-soft)" if with_text else "#f3f4f6"),
    )
    work_dir.mkdir(parents=True, exist_ok=True)
    html_path = work_dir / f"thumb_{style}_{'text' if with_text else 'clean'}.html"
    html_path.write_text(html, encoding="utf-8")
    tmp = out_png.with_suffix(".png")
    browser.shot(html_path, tmp, THUMB_SIZE, THUMB_SIZE, scale=1)
    Image.open(tmp).convert("RGB").save(out_png, quality=92)
    if tmp != out_png:
        tmp.unlink()
    return out_png


def render_detail(browser: Browser, meta: Meta, profile: MaterialProfile, plan: ContentPlan,
                  previews: list[dict], out_dir: Path, work_dir: Path,
                  width: int = 860, scale: int = 2, max_segment: int = 1500) -> list[Path]:
    """상세페이지를 통으로 찍은 뒤 섹션 경계에서 max_segment(CSS px) 이하로 자른다."""
    theme = pick_theme(meta, profile)
    html = _env().get_template("detail.html").render(
        theme=theme, fonts_url=_file_url(FONTS_DIR), width=width, plan=plan, meta=meta,
        profile=profile, previews=[{**p, "url": _file_url(p["path"])} for p in previews],
    )
    work_dir.mkdir(parents=True, exist_ok=True)
    html_path = work_dir / "detail.html"
    html_path.write_text(html, encoding="utf-8")
    full_png = work_dir / "detail_full.png"
    boxes = browser.shot(html_path, full_png, width, None, scale=scale, full_page=True)
    return slice_by_sections(full_png, boxes, out_dir, scale, max_segment)


def slice_by_sections(full_png: Path, boxes: list[dict], out_dir: Path, scale: int,
                      max_segment: int) -> list[Path]:
    img = Image.open(full_png).convert("RGB")
    total_css = img.height / scale
    # 섹션 경계 후보 (CSS px). 마지막은 문서 끝.
    cuts = sorted({round(b["bottom"]) for b in boxes} | {round(total_css)})
    segments: list[tuple[int, int]] = []
    start = 0
    prev = 0
    for c in cuts:
        if c - start > max_segment:
            # 직전 경계까지 자르고, 그래도 한 섹션이 너무 길면 강제 분할
            if prev > start:
                segments.append((start, prev))
                start = prev
            while c - start > max_segment:
                segments.append((start, start + max_segment))
                start += max_segment
        prev = c
    if prev > start:
        segments.append((start, prev))
    out_dir.mkdir(parents=True, exist_ok=True)
    outs: list[Path] = []
    for i, (a, b) in enumerate(segments, start=1):
        crop = img.crop((0, int(a * scale), img.width, min(int(b * scale), img.height)))
        p = out_dir / f"detail_{i:02d}.jpg"
        crop.save(p, quality=90)
        outs.append(p)
    return outs
