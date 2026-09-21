"""원본 파일 → PDF 통일 → 페이지 PNG·텍스트 추출 → 미리보기 워터마크."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pymupdf
import yaml
from PIL import Image, ImageDraw, ImageFont

from . import FONTS_DIR
from .schemas import Meta

SOURCE_NAMES = ("source.pdf", "source.pptx", "source.docx", "source.hwpx", "source.hwp")
CONVERTIBLE = {".pptx", ".docx", ".hwpx", ".hwp", ".ppt", ".doc"}


def load_meta(product_dir: Path) -> Meta:
    path = product_dir / "meta.yaml"
    data = yaml.safe_load(path.read_text(encoding="utf-8")) if path.exists() else {}
    data.setdefault("sku", product_dir.name)
    return Meta(**data)


def find_source(product_dir: Path) -> Path:
    """source.pdf 가 있으면 우선. 없으면 변환 가능한 파일을 찾는다."""
    for name in SOURCE_NAMES:
        p = product_dir / name
        if p.exists():
            return p
    for p in sorted(product_dir.iterdir()):
        if p.suffix.lower() == ".pdf" or p.suffix.lower() in CONVERTIBLE:
            return p
    raise FileNotFoundError(f"{product_dir} 에 source.pdf/pptx/docx/hwpx 가 없습니다")


def ensure_pdf(product_dir: Path) -> Path:
    """PDF 가 아니면 LibreOffice 로 변환해 source.pdf 를 만든다."""
    src = find_source(product_dir)
    if src.suffix.lower() == ".pdf":
        return src
    out = product_dir / "source.pdf"
    if out.exists() and out.stat().st_mtime >= src.stat().st_mtime:
        return out
    soffice = shutil.which("soffice") or shutil.which("libreoffice")
    if not soffice:
        raise RuntimeError("LibreOffice(soffice)가 없어 PDF 변환을 할 수 없습니다. PDF 를 직접 넣어주세요.")
    subprocess.run(
        [soffice, "--headless", "--convert-to", "pdf", "--outdir", str(product_dir), str(src)],
        check=True, capture_output=True, timeout=300,
    )
    converted = product_dir / (src.stem + ".pdf")
    if converted != out:
        converted.replace(out)
    return out


def extract_pages(pdf_path: Path, pages_dir: Path, dpi: int = 150) -> tuple[list[Path], list[str]]:
    """각 페이지를 PNG 로 저장하고 텍스트를 함께 돌려준다."""
    pages_dir.mkdir(parents=True, exist_ok=True)
    images: list[Path] = []
    texts: list[str] = []
    with pymupdf.open(pdf_path) as doc:
        for i, page in enumerate(doc, start=1):
            out = pages_dir / f"page_{i:03d}.png"
            if not out.exists():
                page.get_pixmap(dpi=dpi, alpha=False).save(out)
            images.append(out)
            texts.append(page.get_text("text"))
    (pages_dir / "text.txt").write_text(
        "\n\n".join(f"===== 페이지 {i} =====\n{t}" for i, t in enumerate(texts, start=1)),
        encoding="utf-8",
    )
    return images, texts


def watermark(src: Path, dst: Path, text: str, opacity: int = 70) -> Path:
    """미리보기용 대각선 워터마크. 원본은 건드리지 않는다."""
    base = Image.open(src).convert("RGBA")
    w, h = base.size
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    font = ImageFont.truetype(str(FONTS_DIR / "Pretendard-Bold.ttf"), max(24, w // 14))
    draw = ImageDraw.Draw(layer)
    tw = draw.textlength(text, font=font)
    step_y = int(h / 4)
    for y in range(-h, h * 2, step_y):
        for x in range(-w, w * 2, int(tw + w // 6)):
            draw.text((x, y), text, font=font, fill=(90, 90, 90, opacity))
    layer = layer.rotate(30, resample=Image.BICUBIC, center=(w / 2, h / 2))
    out = Image.alpha_composite(base, layer).convert("RGB")
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst, quality=88)
    return dst
