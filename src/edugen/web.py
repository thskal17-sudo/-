"""브라우저 업로드 화면. PDF/PPTX 를 올리면 썸네일·상세페이지를 만들어 보여준다.

로컬 PC 에서 쓰는 도구다. 기본으로 127.0.0.1 에만 열린다.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import tempfile
import threading
import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

import yaml
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from jinja2 import Environment, FileSystemLoader, select_autoescape

from . import FONTS_DIR, TEMPLATES_DIR, generate, ingest, pipeline
from .schemas import QAReport

SKU_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")
MAX_UPLOAD_MB = int(os.environ.get("EDUGEN_MAX_UPLOAD_MB", "300"))
STYLES = ("stack", "fan", "screen")
SCHOOL_LEVELS = ("초등", "중등", "고등", "성인")
MATERIAL_TYPES = ("활동지", "교안", "지도안", "평가지", "묶음")


@dataclass
class Job:
    id: str
    sku: str
    state: str = "queued"  # queued | running | done | failed
    logs: list[str] = field(default_factory=list)
    error: str = ""


class JobRunner:
    """렌더링은 브라우저·LibreOffice 를 쓰므로 한 번에 하나씩 처리한다."""

    def __init__(self):
        self._pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="edugen-job")
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()

    def get(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)

    def submit(self, product_dir: Path, **kwargs) -> Job:
        job = Job(id=uuid.uuid4().hex[:12], sku=product_dir.name)
        with self._lock:
            self._jobs[job.id] = job
        self._pool.submit(self._run, job, product_dir, kwargs)
        return job

    @staticmethod
    def _run(job: Job, product_dir: Path, kwargs: dict) -> None:
        job.state = "running"
        try:
            pipeline.run_product(product_dir, log=job.logs.append, **kwargs)
            job.state = "done"
        except (ingest.UnsupportedFile, RuntimeError, FileNotFoundError) as e:
            job.error = str(e)
            job.state = "failed"
        except Exception as e:  # noqa: BLE001 - 화면에 원인을 보여준다
            job.error = f"예상하지 못한 오류: {e}"
            job.logs.append(traceback.format_exc())
            job.state = "failed"


def _clean_sku(raw: str) -> str:
    raw = (raw or "").strip()
    if not raw:
        return datetime.now().strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:4]
    if not SKU_RE.match(raw):
        raise HTTPException(400, "상품 코드는 영문·숫자·하이픈(-)·밑줄(_)만, 64자 이내로 입력하세요.")
    return raw


def _save_upload(upload: UploadFile, dst_dir: Path) -> Path:
    """업로드를 임시 파일로 받은 뒤 형식을 확인하고 source.<확장자> 로 옮긴다."""
    ext = Path(upload.filename or "").suffix.lower()
    if ext not in ingest.SUPPORTED:
        raise HTTPException(400, "PDF, PPTX, PPT 파일만 올릴 수 있습니다.")
    limit = MAX_UPLOAD_MB * 1024 * 1024
    size = 0
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext, dir=dst_dir) as tmp:
        tmp_path = Path(tmp.name)
        try:
            while chunk := upload.file.read(1024 * 1024):
                size += len(chunk)
                if size > limit:
                    raise HTTPException(413, f"파일이 {MAX_UPLOAD_MB}MB 를 넘습니다.")
                tmp.write(chunk)
        except HTTPException:
            tmp.close()
            tmp_path.unlink(missing_ok=True)
            raise
    if size == 0:
        tmp_path.unlink(missing_ok=True)
        raise HTTPException(400, "빈 파일입니다.")
    try:
        kind = ingest.detect_kind(tmp_path)
    except ingest.UnsupportedFile as e:
        tmp_path.unlink(missing_ok=True)
        raise HTTPException(400, str(e)) from None
    # 이전 원본·변환본·페이지 캐시를 지운다
    for old in list(dst_dir.glob("source.*")):
        old.unlink()
    shutil.rmtree(dst_dir / "pages", ignore_errors=True)
    final = dst_dir / f"source{kind}"
    tmp_path.replace(final)
    return final


def _write_meta(product_dir: Path, fields: dict) -> None:
    path = product_dir / "meta.yaml"
    meta = yaml.safe_load(path.read_text(encoding="utf-8")) if path.exists() else {}
    meta = meta or {}
    for k, v in fields.items():
        if v in (None, ""):
            meta.pop(k, None)
        else:
            meta[k] = v
    meta["sku"] = product_dir.name
    path.write_text(yaml.safe_dump(meta, allow_unicode=True, sort_keys=False), encoding="utf-8")


def _product_summary(d: Path) -> dict | None:
    out = d / "out"
    if not (out / "thumb_main.jpg").exists():
        return None
    name = (out / "product_name.txt").read_text(encoding="utf-8") if (out / "product_name.txt").exists() else d.name
    return {"sku": d.name, "name": name, "mtime": (out / "thumb_main.jpg").stat().st_mtime}


def _source_name(d: Path) -> str:
    try:
        return ingest.find_source(d).name
    except FileNotFoundError:
        return "(원본 없음)"


def create_app(products_dir: Path) -> FastAPI:
    products_dir.mkdir(parents=True, exist_ok=True)
    settings_path = products_dir / ".edugen.json"
    runner = JobRunner()
    env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR / "web")), autoescape=select_autoescape(["html"]))
    app = FastAPI(title="edugen", docs_url=None, redoc_url=None)
    app.state.runner = runner

    def settings() -> dict:
        try:
            return json.loads(settings_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}

    def product_dir(sku: str) -> Path:
        if not SKU_RE.match(sku):
            raise HTTPException(404)
        d = products_dir / sku
        if not d.is_dir():
            raise HTTPException(404, "상품을 찾을 수 없습니다.")
        return d

    def page(name: str, **ctx) -> HTMLResponse:
        return HTMLResponse(env.get_template(name).render(llm=generate.llm_available(), **ctx))

    @app.get("/", response_class=HTMLResponse)
    def index(sku: str = ""):
        items = [s for d in products_dir.iterdir() if d.is_dir() and (s := _product_summary(d))]
        items.sort(key=lambda s: s["mtime"], reverse=True)
        prefill = {}
        if sku and SKU_RE.match(sku) and (products_dir / sku / "meta.yaml").exists():
            prefill = yaml.safe_load((products_dir / sku / "meta.yaml").read_text(encoding="utf-8")) or {}
        return page("index.html", products=items[:30], settings=settings(), prefill=prefill,
                    styles=STYLES, levels=SCHOOL_LEVELS, types=MATERIAL_TYPES, max_mb=MAX_UPLOAD_MB)

    @app.post("/api/upload")
    def upload(
        file: UploadFile = File(...),
        sku: str = Form(""),
        store_name: str = Form(""),
        school_level: str = Form(""),
        grade: str = Form(""),
        subject: str = Form(""),
        material_type: str = Form(""),
        file_formats: str = Form(""),
        has_answer_key: str = Form("auto"),
        editable: str = Form(""),
        thumbnail_style: str = Form("auto"),
        price: str = Form(""),
    ):
        sku = _clean_sku(sku)
        if school_level and school_level not in SCHOOL_LEVELS:
            raise HTTPException(400, "학교급 값이 올바르지 않습니다.")
        if material_type and material_type not in MATERIAL_TYPES:
            raise HTTPException(400, "자료 유형 값이 올바르지 않습니다.")
        if thumbnail_style not in (*STYLES, "auto"):
            raise HTTPException(400, "썸네일 형태 값이 올바르지 않습니다.")
        d = products_dir / sku
        created = not d.exists()
        d.mkdir(parents=True, exist_ok=True)
        try:
            _save_upload(file, d)
        except HTTPException:
            if created:
                shutil.rmtree(d, ignore_errors=True)
            raise
        formats = [f.strip().upper() for f in re.split(r"[,/ ]+", file_formats) if f.strip()]
        _write_meta(d, {
            "store_name": store_name.strip(),
            "school_level": school_level,
            "grade": grade.strip(),
            "subject": subject.strip(),
            "material_type": material_type,
            "file_formats": formats or None,
            "has_answer_key": {"yes": True, "no": False}.get(has_answer_key),
            "editable": True if editable else None,
            "thumbnail_style": None if thumbnail_style == "auto" else thumbnail_style,
            "price": int(price) if price.strip().isdigit() else None,
        })
        if store_name.strip():
            settings_path.write_text(json.dumps({**settings(), "store_name": store_name.strip()},
                                                ensure_ascii=False), encoding="utf-8")
        job = runner.submit(d, force=True)
        return {"job_id": job.id, "sku": sku}

    @app.post("/api/p/{sku}/rerun")
    def rerun(sku: str, style: str = Form("auto")):
        d = product_dir(sku)
        if style not in (*STYLES, "auto"):
            raise HTTPException(400, "썸네일 형태 값이 올바르지 않습니다.")
        job = runner.submit(d, style=None if style == "auto" else style)
        return {"job_id": job.id, "sku": sku}

    @app.get("/api/jobs/{job_id}")
    def job_status(job_id: str):
        job = runner.get(job_id)
        if not job:
            raise HTTPException(404, "작업을 찾을 수 없습니다.")
        return {"state": job.state, "sku": job.sku, "logs": job.logs[-40:], "error": job.error}

    @app.get("/p/{sku}", response_class=HTMLResponse)
    def product(sku: str):
        d = product_dir(sku)
        out = d / "out"
        if not (out / "thumb_main.jpg").exists():
            raise HTTPException(404, "아직 생성된 결과가 없습니다.")
        read = lambda n: (out / n).read_text(encoding="utf-8") if (out / n).exists() else ""  # noqa: E731
        report = QAReport.model_validate_json(read("qa_report.json")) if read("qa_report.json") else QAReport()
        v = int((out / "thumb_main.jpg").stat().st_mtime)
        return page(
            "product.html", sku=sku, v=v,
            product_name=read("product_name.txt"),
            tags=[t for t in read("search_tags.txt").splitlines() if t],
            thumbs=[p.name for p in sorted(out.glob("thumb_*.jpg"), key=lambda p: (p.name != "thumb_main.jpg", p.name))],
            details=[p.name for p in sorted(out.glob("detail_*.jpg"))],
            previews=[p.name for p in sorted((out / "preview").glob("*.jpg"))],
            report=report, source=_source_name(d), styles=STYLES,
        )

    @app.get("/p/{sku}/files/{name:path}")
    def product_file(sku: str, name: str):
        out = (product_dir(sku) / "out").resolve()
        target = (out / name).resolve()
        if out not in target.parents or target.suffix.lower() not in (".jpg", ".png") or "_work" in target.parts:
            raise HTTPException(404)
        if not target.exists():
            raise HTTPException(404)
        return FileResponse(target)

    @app.get("/p/{sku}/download.zip")
    def download(sku: str):
        out = product_dir(sku) / "out"
        (out / "_work").mkdir(parents=True, exist_ok=True)
        z = pipeline.build_zip(out, out / "_work" / f"{sku}.zip")
        return FileResponse(z, filename=f"{sku}.zip", media_type="application/zip")

    @app.get("/fonts/PretendardVariable.woff2")
    def font():
        return FileResponse(FONTS_DIR / "PretendardVariable.woff2", media_type="font/woff2")

    @app.exception_handler(HTTPException)
    def http_error(request: Request, exc: HTTPException):
        if request.url.path.startswith("/api/"):
            return JSONResponse({"error": exc.detail}, status_code=exc.status_code)
        resp = page("error.html", status=exc.status_code, message=exc.detail or "페이지를 찾을 수 없습니다.")
        resp.status_code = exc.status_code
        return resp

    return app
