"""원본 파일 → PDF 통일 → 페이지 PNG·텍스트 추출 → 미리보기 워터마크."""
from __future__ import annotations

import os
import platform
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path

import pymupdf
import yaml
from PIL import Image, ImageDraw, ImageFont

from . import FONTS_DIR
from .schemas import Meta

# 업로드·변환을 허용하는 형식. 확장자 → 설명
SUPPORTED = {".pdf": "PDF", ".pptx": "PowerPoint", ".ppt": "PowerPoint 97-2003"}
CONVERTIBLE = {".pptx", ".ppt"}
CONVERTED_NAME = "source.converted.pdf"  # 변환 결과. 원본과 구분한다.


class UnsupportedFile(ValueError):
    """형식이 맞지 않거나 손상된 파일."""


def load_meta(product_dir: Path) -> Meta:
    path = product_dir / "meta.yaml"
    data = yaml.safe_load(path.read_text(encoding="utf-8")) if path.exists() else {}
    data = data or {}
    data.setdefault("sku", product_dir.name)
    return Meta(**data)


def detect_kind(path: Path) -> str:
    """파일 앞부분을 읽어 실제 형식을 판별한다. 확장자만 믿지 않는다."""
    with open(path, "rb") as f:
        head = f.read(8)
    if head.startswith(b"%PDF-"):
        return ".pdf"
    if head.startswith(b"PK\x03\x04"):
        try:
            with zipfile.ZipFile(path) as z:
                if "ppt/presentation.xml" in z.namelist():
                    return ".pptx"
        except zipfile.BadZipFile:
            pass
        raise UnsupportedFile("PPTX 파일이 아니거나 손상되었습니다.")
    if head == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1":
        return ".ppt"
    raise UnsupportedFile("PDF 또는 PPT/PPTX 파일만 올릴 수 있습니다.")


def find_source(product_dir: Path) -> Path:
    """원본 파일을 찾는다. PPT/PPTX 가 있으면 그것이 원본이다."""
    for ext in (".pptx", ".ppt", ".pdf"):
        p = product_dir / f"source{ext}"
        if p.exists():
            return p
    for p in sorted(product_dir.iterdir()):
        if p.name != CONVERTED_NAME and p.suffix.lower() in SUPPORTED:
            return p
    raise FileNotFoundError(f"{product_dir} 에 source.pdf 또는 source.pptx 가 없습니다")


def find_soffice() -> str | None:
    env = os.environ.get("EDUGEN_SOFFICE")
    if env and Path(env).exists():
        return env
    for name in ("soffice", "libreoffice"):
        found = shutil.which(name)
        if found:
            return found
    candidates = [
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    ]
    return next((c for c in candidates if Path(c).exists()), None)


# 리눅스에서 한글이 중국어 폰트로 대체되지 않도록 번들 폰트를 우선한다.
# 윈도우·맥의 LibreOffice 는 시스템 폰트(맑은 고딕 등)를 그대로 쓰므로 적용하지 않는다.
_FONTCONFIG = """<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>
  <dir>{fonts}</dir>
  <cachedir>{cache}</cachedir>
  <selectfont><rejectfont>
    <glob>*/wqy*</glob><glob>*/unifont*</glob><glob>*/DroidSansFallback*</glob>
  </rejectfont></selectfont>
  <match target="pattern">
    <test name="lang" compare="contains"><string>ko</string></test>
    <edit name="family" mode="prepend" binding="strong"><string>Noto Sans KR</string></edit>
  </match>
  {aliases}
</fontconfig>
"""
_KOREAN_FAMILIES = ["맑은 고딕", "Malgun Gothic", "굴림", "Gulim", "돋움", "Dotum", "바탕", "Batang",
                    "나눔고딕", "NanumGothic", "나눔스퀘어", "NanumSquare", "Apple SD Gothic Neo"]


def _conversion_env(work: Path) -> dict[str, str]:
    env = dict(os.environ)
    if platform.system() == "Linux":
        aliases = "\n  ".join(
            f'<alias binding="strong"><family>{f}</family><prefer><family>Noto Sans KR</family></prefer></alias>'
            for f in _KOREAN_FAMILIES
        )
        conf = work / "fonts.conf"
        conf.write_text(_FONTCONFIG.format(fonts=FONTS_DIR.resolve(), cache=work / "fc-cache",
                                           aliases=aliases), encoding="utf-8")
        env["FONTCONFIG_FILE"] = str(conf)
    return env


def ensure_pdf(product_dir: Path, timeout: int = 300) -> Path:
    """원본이 PPT/PPTX 면 LibreOffice 로 PDF 를 만든다. 결과는 source.converted.pdf."""
    src = find_source(product_dir)
    if src.suffix.lower() == ".pdf":
        return src
    out = product_dir / CONVERTED_NAME
    if out.exists() and out.stat().st_mtime >= src.stat().st_mtime:
        return out
    soffice = find_soffice()
    if not soffice:
        raise RuntimeError(
            "PPT/PPTX 를 변환하려면 LibreOffice 가 필요합니다. https://ko.libreoffice.org 에서 설치하거나 "
            "PowerPoint 에서 PDF 로 저장해 올려주세요."
        )
    with tempfile.TemporaryDirectory(prefix="edugen-lo-") as tmp:
        work = Path(tmp)
        profile = (work / "profile").resolve().as_uri()
        # 파일명이 한글이어도 안전하도록 영문 이름으로 복사해 변환한다
        staged = work / f"input{src.suffix.lower()}"
        shutil.copy2(src, staged)
        proc = subprocess.run(
            [soffice, f"-env:UserInstallation={profile}", "--headless", "--norestore",
             "--convert-to", "pdf", "--outdir", str(work), str(staged)],
            capture_output=True, timeout=timeout, env=_conversion_env(work),
        )
        produced = work / "input.pdf"
        if proc.returncode != 0 or not produced.exists():
            detail = (proc.stderr or proc.stdout).decode(errors="replace").strip()[-300:]
            raise RuntimeError(f"PPT/PPTX 변환에 실패했습니다. {detail}")
        shutil.move(str(produced), out)
    return out


def extract_pages(pdf_path: Path, pages_dir: Path, dpi: int = 150) -> tuple[list[Path], list[str]]:
    """각 페이지를 PNG 로 저장하고 텍스트를 함께 돌려준다. 원본이 바뀌면 다시 뽑는다."""
    stamp = pages_dir / ".source"
    sig = f"{pdf_path.resolve()}|{pdf_path.stat().st_size}|{pdf_path.stat().st_mtime_ns}|{dpi}"
    if pages_dir.exists() and (not stamp.exists() or stamp.read_text() != sig):
        shutil.rmtree(pages_dir)
    pages_dir.mkdir(parents=True, exist_ok=True)
    images: list[Path] = []
    texts: list[str] = []
    with pymupdf.open(pdf_path) as doc:
        if doc.page_count == 0:
            raise UnsupportedFile("페이지가 없는 파일입니다.")
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
    stamp.write_text(sig)
    return images, texts


def is_landscape(page_image: Path) -> bool:
    w, h = Image.open(page_image).size
    return w > h


def watermark(src: Path, dst: Path, text: str, opacity: int = 70) -> Path:
    """미리보기용 대각선 워터마크. 원본은 건드리지 않는다."""
    base = Image.open(src).convert("RGBA")
    w, h = base.size
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    font = ImageFont.truetype(str(FONTS_DIR / "Pretendard-Bold.ttf"), max(24, min(w, h) // 12))
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
