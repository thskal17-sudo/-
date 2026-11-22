#!/usr/bin/env python3
"""MYBOX(아이폰 라이브포토) 사진 정리 도구.

원본 폴더는 읽기만 하고, 결과는 모두 복사본으로 만든다.

  1) scan       : 원본을 훑어보고 장수/날짜 범위/중복을 요약 (아무것도 쓰지 않음)
  2) organize   : 날짜별 정리 + 중복/날짜없음 분리 + HEIC→JPG + 정리기록.csv
                  + 교실사진 판정용 미리보기(_검토용) 생성
  3) classroom  : _검토용/판정입력.csv 의 판정(교실/확인필요/아님)을 반영해
                  교실사진 폴더에 복사하고 정리기록.csv 를 갱신

예)
  python photo_organizer.py scan      "D:\\2026년 활동사진\\MYBOX"
  python photo_organizer.py organize  "D:\\2026년 활동사진\\MYBOX" "D:\\2026년 활동사진\\정리결과"
  python photo_organizer.py classroom "D:\\2026년 활동사진\\정리결과"

필요: pip install pillow pillow-heif
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import re
import shutil
import struct
import sys
import zipfile
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Optional

from PIL import Image, ImageDraw, ImageFont, ImageOps

try:
    import pillow_heif

    pillow_heif.register_heif_opener()
    HAVE_HEIF = True
except ImportError:  # HEIC 가 없으면 scan 은 가능하지만 변환은 불가
    HAVE_HEIF = False

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(errors="replace")
    sys.stderr.reconfigure(errors="replace")

PHOTO_EXT = {".jpg", ".jpeg", ".heic", ".heif", ".png", ".gif", ".bmp", ".tif", ".tiff", ".webp", ".dng"}
VIDEO_EXT = {".mov", ".mp4", ".m4v", ".avi", ".3gp", ".mkv"}
SKIP_EXT = {".aae", ".ds_store", ".ini", ".db", ".json", ".xml", ".txt"}
HEIC_EXT = {".heic", ".heif"}

SORTED_DIR = "정리된사진"
DUP_DIR = "중복사진"
NODATE_DIR = "날짜없음"
CLASS_DIR = "교실사진"
CHECK_DIR = "확인필요"
REVIEW_DIR = "_검토용"
LOG_NAME = "정리기록.csv"

LOG_FIELDS = ["원본파일", "압축안파일", "종류", "새위치", "동영상새위치", "촬영날짜", "날짜출처",
              "판정", "교실사진위치", "내용해시", "비고"]
VALID_LABELS = {"교실", "확인필요", "아님"}


# ---------------------------------------------------------------- 공통 유틸

def decode_zip_name(info: zipfile.ZipInfo) -> str:
    """UTF-8 플래그가 없으면 파이썬이 cp437 로 읽으므로 cp949(한글 윈도우)로 다시 해석."""
    name = info.filename
    if info.flag_bits & 0x800:
        return name
    try:
        raw = name.encode("cp437")
    except UnicodeEncodeError:
        return name
    for enc in ("utf-8", "cp949"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("cp949", errors="replace")


COPY_SUFFIX_RE = re.compile(r"(_\d+|\s*\(\d+\)|\s*-\s*복사본.*|\s*copy.*)$", re.IGNORECASE)


def has_copy_suffix(stem: str) -> bool:
    s = stem.lower()
    if s.endswith(".livephoto"):
        return False
    return bool(COPY_SUFFIX_RE.search(re.sub(r"\.livephoto", "", s)))


FNAME_DT_RE = re.compile(
    r"(?<!\d)(20\d{2}|19\d{2})[-_.]?(\d{2})[-_.]?(\d{2})"
    r"(?:[ _\-T]?(\d{2})[-_.:h]?(\d{2})[-_.:m]?(\d{2})(?:[._]?\d{1,3})?)?(?!\d)"
)  # P20251216_101530196 처럼 뒤에 밀리초(3자리)가 붙는 MYBOX 이름도 처리


def date_from_name(name: str) -> tuple[Optional[datetime], bool]:
    """파일 이름 속 날짜. (datetime, 시각포함여부)."""
    for m in FNAME_DT_RE.finditer(name):
        y, mo, d, hh, mi, ss = m.groups()
        try:
            if hh is not None:
                return datetime(int(y), int(mo), int(d), int(hh), int(mi), int(ss)), True
            return datetime(int(y), int(mo), int(d)), False
        except ValueError:
            try:
                return datetime(int(y), int(mo), int(d)), False
            except ValueError:
                continue
    return None, False


def parse_exif_dt(value) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, bytes):
        value = value.decode("ascii", errors="ignore")
    value = str(value).strip().strip("\x00")
    for fmt in ("%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y:%m:%d %H:%M", "%Y-%m-%dT%H:%M:%S"):
        try:
            dt = datetime.strptime(value[:19], fmt)
            if dt.year < 1990:
                return None
            return dt
        except ValueError:
            continue
    return None


def photo_exif_date(data: bytes) -> Optional[datetime]:
    """EXIF 촬영 날짜(DateTimeOriginal → DateTimeDigitized). 파일 수정 날짜는 쓰지 않는다."""
    try:
        with Image.open(io.BytesIO(data)) as im:
            exif = im.getexif()
            sub = exif.get_ifd(0x8769)
            for tag in (0x9003, 0x9004):
                dt = parse_exif_dt(sub.get(tag))
                if dt:
                    return dt
            # 일부 PNG/편집본은 IFD0 DateTime 만 있음 → 이것도 '촬영 정보'로 보지는 않는다.
    except Exception:
        return None
    return None


# ------------------------------------------------- QuickTime/MP4 날짜 파서

QT_EPOCH = datetime(1904, 1, 1, tzinfo=timezone.utc)


def _iter_atoms(buf: bytes, start: int, end: int):
    pos = start
    while pos + 8 <= end:
        size, kind = struct.unpack(">I4s", buf[pos:pos + 8])
        header = 8
        if size == 1:
            if pos + 16 > end:
                return
            size = struct.unpack(">Q", buf[pos + 8:pos + 16])[0]
            header = 16
        elif size == 0:
            size = end - pos
        if size < header:
            return
        yield kind, pos + header, min(pos + size, end)
        pos += size


def _read_moov(path_or_bytes) -> Optional[bytes]:
    """파일 전체를 읽지 않고 moov 박스만 꺼낸다."""
    if isinstance(path_or_bytes, (bytes, bytearray)):
        buf = bytes(path_or_bytes)
        for kind, s, e in _iter_atoms(buf, 0, len(buf)):
            if kind == b"moov":
                return buf[s:e]
        return None
    with open(path_or_bytes, "rb") as f:
        f.seek(0, 2)
        total = f.tell()
        pos = 0
        while pos + 8 <= total:
            f.seek(pos)
            hdr = f.read(16)
            if len(hdr) < 8:
                return None
            size, kind = struct.unpack(">I4s", hdr[:8])
            header = 8
            if size == 1:
                size = struct.unpack(">Q", hdr[8:16])[0]
                header = 16
            elif size == 0:
                size = total - pos
            if size < header:
                return None
            if kind == b"moov":
                f.seek(pos + header)
                return f.read(size - header)
            pos += size
    return None


def video_date(src, utc_offset_hours: float) -> Optional[datetime]:
    """com.apple.quicktime.creationdate(현지 시각) → mvhd 생성시각(UTC→현지) 순."""
    try:
        moov = _read_moov(src)
    except Exception:
        return None
    if not moov:
        return None
    apple_dt = None
    mvhd_dt = None
    for kind, s, e in _iter_atoms(moov, 0, len(moov)):
        if kind == b"mvhd":
            ver = moov[s]
            if ver == 1:
                secs = struct.unpack(">Q", moov[s + 4:s + 12])[0]
            else:
                secs = struct.unpack(">I", moov[s + 4:s + 8])[0]
            if secs > 0:
                utc = QT_EPOCH + timedelta(seconds=secs)
                if utc.year >= 1990:
                    mvhd_dt = (utc + timedelta(hours=utc_offset_hours)).replace(tzinfo=None)
        elif kind == b"meta":
            keys, values = [], {}
            for k2, s2, e2 in _iter_atoms(moov, s, e):
                if k2 == b"keys":
                    cnt = struct.unpack(">I", moov[s2 + 4:s2 + 8])[0]
                    p = s2 + 8
                    for _ in range(cnt):
                        ksz = struct.unpack(">I", moov[p:p + 4])[0]
                        keys.append(moov[p + 8:p + ksz].decode("utf-8", "ignore"))
                        p += ksz
                elif k2 == b"ilst":
                    for k3, s3, e3 in _iter_atoms(moov, s2, e2):
                        idx = struct.unpack(">I", k3)[0]
                        for k4, s4, e4 in _iter_atoms(moov, s3, e3):
                            if k4 == b"data":
                                values[idx] = moov[s4 + 8:e4]
            for i, k in enumerate(keys, start=1):
                if k == "com.apple.quicktime.creationdate" and i in values:
                    txt = values[i].decode("utf-8", "ignore").strip()
                    m = re.match(r"(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})", txt)
                    if m:
                        apple_dt = datetime(*map(int, m.groups()))
    return apple_dt or mvhd_dt


# ---------------------------------------------------------------- 항목 수집

@dataclass
class Item:
    origin: str                     # 원본 파일 경로(압축파일 또는 낱장)
    member: str                     # 압축 안 파일 이름 (낱장이면 "")
    kind: str                       # "사진" / "라이브포토" / "동영상"
    ext: str                        # 원래 확장자(소문자)
    load: Callable[[], bytes]       # 사진(또는 단독 동영상) 바이트
    video_member: str = ""
    video_ext: str = ""
    load_video: Optional[Callable[[], bytes]] = None
    copy_from: Optional[str] = None  # 낱장 동영상은 스트리밍 복사
    video_copy_from: Optional[str] = None
    sha: str = ""
    dt: Optional[datetime] = None
    has_time: bool = True
    dt_source: str = "없음"
    note: str = ""
    # 결정된 결과
    is_dup: bool = False
    dup_of: Optional["Item"] = None
    dest: str = ""
    video_dest: str = ""
    label: str = ""
    class_dest: str = ""

    @property
    def display_name(self) -> str:
        return self.member or Path(self.origin).name

    @property
    def is_video_only(self) -> bool:
        return self.kind == "동영상"


def _pair_up(entries: list[tuple[str, str, Callable[[], bytes], Optional[str]]], origin_of, member_mode: bool,
             problems: list[str]) -> list[Item]:
    """같은 폴더/압축 안에서 이름(확장자 제외)이 같은 사진+영상을 라이브포토로 묶는다.

    entries: (이름, 확장자, 로더, 디스크경로 or None)
    """
    groups: dict[str, list] = defaultdict(list)
    for name, ext, loader, disk in entries:
        stem = str(Path(name).with_suffix("")).lower()
        groups[stem].append((name, ext, loader, disk))

    photos = [e for e in entries if e[1] in PHOTO_EXT]
    videos = [e for e in entries if e[1] in VIDEO_EXT]
    items: list[Item] = []
    used_videos = set()

    for name, ext, loader, disk in photos:
        stem = str(Path(name).with_suffix("")).lower()
        partner = next((v for v in groups[stem] if v[1] in VIDEO_EXT and v[0] not in used_videos), None)
        # 라이브포토 압축(사진 1 + 영상 1)은 이름이 달라도 묶는다
        if partner is None and member_mode and len(photos) == 1 and len(videos) == 1:
            partner = videos[0]
        it = Item(origin=origin_of(name), member=name if member_mode else "", kind="사진", ext=ext, load=loader)
        if partner is not None:
            used_videos.add(partner[0])
            it.kind = "라이브포토"
            it.video_member = partner[0] if member_mode else ""
            it.video_ext = partner[1]
            it.load_video = partner[2]
            it.video_copy_from = partner[3]
        items.append(it)

    for name, ext, loader, disk in videos:
        if name in used_videos:
            continue
        items.append(Item(origin=origin_of(name), member=name if member_mode else "", kind="동영상", ext=ext,
                          load=loader, copy_from=disk))
    return items


def collect(source: Path, problems: list[str], skipped: list[str]) -> tuple[list[Item], dict]:
    stats = Counter()
    items: list[Item] = []
    by_dir: dict[Path, list] = defaultdict(list)

    for root, dirs, files in os.walk(source):
        dirs.sort()
        for fn in sorted(files):
            p = Path(root) / fn
            ext = p.suffix.lower()
            if ext == ".zip":
                stats["압축파일"] += 1
                try:
                    zf = zipfile.ZipFile(p)
                    zf.testzip  # noqa: B018 (접근 확인용)
                except (zipfile.BadZipFile, OSError) as e:
                    problems.append(f"압축을 열 수 없음: {p} ({e})")
                    items.append(Item(origin=str(p), member="", kind="압축(열수없음)", ext=".zip",
                                      load=lambda: b"", note=f"압축을 열 수 없음: {e}"))
                    continue
                entries = []
                for info in zf.infolist():
                    if info.is_dir():
                        continue
                    name = decode_zip_name(info)
                    base = name.replace("\\", "/").split("/")[-1]
                    if name.startswith("__MACOSX/") or base.startswith("._"):
                        continue
                    mext = Path(base).suffix.lower()
                    if mext in PHOTO_EXT | VIDEO_EXT:
                        stats["압축 안 파일"] += 1
                        entries.append((name, mext, (lambda zf=zf, info=info: zf.read(info)), None))
                    else:
                        skipped.append(f"{p} :: {name}")
                if not entries:
                    problems.append(f"압축 안에 사진/영상이 없음: {p}")
                items.extend(_pair_up(entries, lambda _n, p=p: str(p), True, problems))
            elif ext in PHOTO_EXT | VIDEO_EXT:
                stats["낱장 파일"] += 1
                by_dir[p.parent].append((fn, ext, (lambda p=p: p.read_bytes()), str(p)))
            else:
                skipped.append(str(p))

    for d, entries in by_dir.items():
        items.extend(_pair_up(entries, lambda n, d=d: str(d / n), False, problems))
    return items, stats


def analyze(items: list[Item], use_filename_date: bool, utc_offset: float, problems: list[str]) -> None:
    for it in items:
        if it.kind == "압축(열수없음)":
            continue
        try:
            if it.copy_from:
                h = hashlib.sha256()
                with open(it.copy_from, "rb") as f:
                    for chunk in iter(lambda: f.read(1 << 20), b""):
                        h.update(chunk)
                it.sha = h.hexdigest()
                data = None
            else:
                data = it.load()
                it.sha = hashlib.sha256(data).hexdigest()
        except Exception as e:  # 손상된 압축 등
            problems.append(f"읽기 실패: {it.origin} {it.member} ({e})")
            it.note = f"읽기 실패: {e}"
            continue

        dt = None
        if it.is_video_only:
            dt = video_date(it.copy_from or data, utc_offset)
            if dt:
                it.dt_source = "영상정보"
        else:
            if it.ext in HEIC_EXT and not HAVE_HEIF:
                problems.append("pillow-heif 가 없어 HEIC 촬영 날짜를 읽지 못함 (pip install pillow-heif)")
            dt = photo_exif_date(data)
            if dt:
                it.dt_source = "EXIF"
        if dt:
            it.dt, it.has_time = dt, True
        elif use_filename_date:
            for nm in (it.member, Path(it.origin).name):
                if not nm:
                    continue
                fdt, has_time = date_from_name(Path(nm.replace("\\", "/")).name)
                if fdt:
                    it.dt, it.has_time, it.dt_source = fdt, has_time, "파일이름"
                    break


def mark_duplicates(items: list[Item]) -> None:
    groups: dict[str, list[Item]] = defaultdict(list)
    for it in items:
        if it.sha:
            groups[it.sha].append(it)
    for grp in groups.values():
        if len(grp) < 2:
            continue
        def rank(i: Item):
            stem = Path(i.origin).stem
            return (i.dt is None, has_copy_suffix(stem), has_copy_suffix(Path(i.member).stem) if i.member else False,
                    len(i.origin), i.origin, i.member)
        grp.sort(key=rank)
        for d in grp[1:]:
            d.is_dup = True
            d.dup_of = grp[0]


# ---------------------------------------------------------------- 요약(scan)

def summarize(items: list[Item], stats: Counter, problems: list[str], skipped: list[str]) -> str:
    lines = []
    ok = [i for i in items if i.sha]
    uniq = [i for i in ok if not i.is_dup]
    dups = [i for i in ok if i.is_dup]
    lines.append("=== 원본 폴더 요약 ===")
    lines.append(f"압축파일 {stats['압축파일']}개 (안에 든 사진/영상 {stats['압축 안 파일']}개), 낱장 파일 {stats['낱장 파일']}개")
    kinds = Counter(i.kind for i in ok)
    lines.append("항목: " + ", ".join(f"{k} {v}" for k, v in kinds.items()) + f"  (총 {len(ok)})")
    exts = Counter(i.ext for i in ok)
    lines.append("형식: " + ", ".join(f"{k} {v}" for k, v in sorted(exts.items())))
    lines.append(f"서로 다른 사진/영상: {len(uniq)}  /  내용이 똑같은 중복: {len(dups)}")
    dated = [i for i in uniq if i.dt]
    if dated:
        lo, hi = min(i.dt for i in dated), max(i.dt for i in dated)
        lines.append(f"촬영 날짜 범위: {lo:%Y-%m-%d %H:%M} ~ {hi:%Y-%m-%d %H:%M}")
    src = Counter(i.dt_source for i in uniq)
    lines.append("날짜 출처(중복 제외): " + ", ".join(f"{k} {v}" for k, v in src.items()))
    months = Counter(f"{i.dt:%Y-%m}" for i in dated)
    if months:
        lines.append("월별(중복 제외): " + ", ".join(f"{k} {v}" for k, v in sorted(months.items())))
    fn_only = [i for i in uniq if i.dt_source == "파일이름"]
    if fn_only:
        lines.append(f"※ EXIF 없이 파일 이름 날짜로 분류될 항목 {len(fn_only)}개 (스크린샷일 수 있음):")
        for i in fn_only[:15]:
            lines.append(f"    {i.display_name}  ← {Path(i.origin).name}")
        if len(fn_only) > 15:
            lines.append(f"    ... 외 {len(fn_only) - 15}개")
    nodate = [i for i in uniq if not i.dt]
    if nodate:
        lines.append(f"날짜없음으로 갈 항목 {len(nodate)}개:")
        for i in nodate[:15]:
            lines.append(f"    {i.display_name}  ← {Path(i.origin).name}")
    if dups:
        lines.append("중복 예시 (남길 것 ← 중복):")
        for d in dups[:8]:
            lines.append(f"    {Path(d.dup_of.origin).name} ← {Path(d.origin).name}")
    if problems:
        lines.append(f"문제 {len(problems)}건:")
        lines.extend("    " + p for p in sorted(set(problems))[:30])
    if skipped:
        lines.append(f"사진/영상이 아니라 건너뛸 파일 {len(skipped)}개 (예: {', '.join(Path(s).name for s in skipped[:5])})")
    return "\n".join(lines)


# ---------------------------------------------------------------- 쓰기

class NameBook:
    """폴더별로 이미 쓴 파일 이름(확장자 제외)을 기억해 _2, _3 을 붙인다."""

    def __init__(self):
        self.used: dict[Path, set[str]] = defaultdict(set)

    def reserve(self, folder: Path, stem: str) -> str:
        used = self.used[folder]
        if folder.exists() and not used:
            used.update(p.stem.lower() for p in folder.iterdir())
        cand, n = stem, 1
        while cand.lower() in used:
            n += 1
            cand = f"{stem}_{n}"
        used.add(cand.lower())
        return cand


def safe_stem(s: str) -> str:
    s = re.sub(r'[\\/:*?"<>|]+', "_", s).strip(" .")
    return s or "이름없음"


def convert_heic(data: bytes, out: Path, quality: int) -> None:
    with Image.open(io.BytesIO(data)) as im:
        im.load()
        icc = im.info.get("icc_profile")
        exif = im.getexif()
        # pillow-heif 는 디코딩 때 회전(irot/imir)을 이미 적용하고 EXIF 방향을 1로 맞춘다.
        # 혹시 방향 값이 남아 있으면 그대로 두어 뷰어가 처리하게 한다(이중 회전 방지는 pillow-heif 가 담당).
        exif_bytes = exif.tobytes() if len(exif) else im.info.get("exif")
        img = im
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        kw = {"quality": quality, "optimize": True}
        if exif_bytes:
            kw["exif"] = exif_bytes
        if icc:
            kw["icc_profile"] = icc
        img.save(out, "JPEG", **kw)


def write_photo(it: Item, folder: Path, stem: str, quality: int) -> Path:
    folder.mkdir(parents=True, exist_ok=True)
    if it.is_video_only:
        out = folder / f"{stem}{it.ext}"
        if it.copy_from:
            shutil.copyfile(it.copy_from, out)
        else:
            out.write_bytes(it.load())
        return out
    if it.ext in HEIC_EXT:
        out = folder / f"{stem}.jpg"
        convert_heic(it.load(), out, quality)
        return out
    ext = ".jpg" if it.ext == ".jpeg" else it.ext
    out = folder / f"{stem}{ext}"
    if it.member:
        out.write_bytes(it.load())
    else:
        shutil.copyfile(it.origin, out)
    return out


def write_video(it: Item, folder: Path, stem: str) -> Optional[Path]:
    if it.kind != "라이브포토":
        return None
    out = folder / f"{stem}{it.video_ext}"
    if it.video_copy_from:
        shutil.copyfile(it.video_copy_from, out)
    else:
        out.write_bytes(it.load_video())
    return out


def write_log(dest_root: Path, items: list[Item]) -> Path:
    path = dest_root / LOG_NAME
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=LOG_FIELDS)
        w.writeheader()
        for it in items:
            w.writerow({
                "원본파일": it.origin,
                "압축안파일": " + ".join(x for x in (it.member, it.video_member) if x),
                "종류": it.kind,
                "새위치": it.dest,
                "동영상새위치": it.video_dest,
                "촬영날짜": (it.dt.strftime("%Y-%m-%d %H:%M:%S" if it.has_time else "%Y-%m-%d") if it.dt else ""),
                "날짜출처": it.dt_source,
                "판정": it.label,
                "교실사진위치": it.class_dest,
                "내용해시": it.sha[:16],
                "비고": it.note,
            })
    return path


def load_font(size: int):
    for cand in ("malgun.ttf", "C:/Windows/Fonts/malgun.ttf", "DejaVuSans.ttf",
                 "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(cand, size)
        except OSError:
            continue
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def make_review(dest_root: Path, items: list[Item], per_sheet: int = 12, cols: int = 4, tile: int = 480) -> int:
    """교실사진 판정을 위한 번호 붙은 모아보기 이미지와 판정입력.csv."""
    review = dest_root / REVIEW_DIR
    review.mkdir(parents=True, exist_ok=True)
    targets = [i for i in items if i.dest and not i.is_dup and not i.is_video_only]
    rows = []
    font = load_font(22)
    for start in range(0, len(targets), per_sheet):
        chunk = targets[start:start + per_sheet]
        rows_n = (len(chunk) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * tile, rows_n * (tile + 34)), "white")
        draw = ImageDraw.Draw(sheet)
        for k, it in enumerate(chunk):
            no = start + k + 1
            try:
                with Image.open(dest_root / it.dest) as im:
                    im = ImageOps.exif_transpose(im)
                    im.thumbnail((tile - 8, tile - 8))
                    im = im.convert("RGB")
                    x = (k % cols) * tile + (tile - im.width) // 2
                    y = (k // cols) * (tile + 34) + 34 + (tile - im.height) // 2
                    sheet.paste(im, (x, y))
                    draw.rectangle([x - 1, y - 1, x + im.width, y + im.height], outline=(170, 170, 170))
            except Exception as e:
                it.note = (it.note + f" 미리보기 실패: {e}").strip()
            draw.text(((k % cols) * tile + 6, (k // cols) * (tile + 34) + 4),
                      f"#{no}  {Path(it.dest).name}", fill="black", font=font)
            rows.append({"번호": no, "새위치": it.dest, "모아보기": f"모아보기_{start // per_sheet + 1:02d}.jpg",
                         "판정": "", "메모": ""})
        sheet.save(review / f"모아보기_{start // per_sheet + 1:02d}.jpg", quality=85)
    with open(review / "판정입력.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["번호", "새위치", "모아보기", "판정", "메모"])
        w.writeheader()
        w.writerows(rows)
    return len(targets)


def organize(source: Path, dest_root: Path, args) -> None:
    source, dest_root = source.resolve(), dest_root.resolve()
    if source == dest_root or source in dest_root.parents or dest_root in source.parents:
        sys.exit("오류: 결과 폴더와 원본 폴더가 겹칩니다. 서로 다른 폴더를 지정하세요.")
    if (dest_root / SORTED_DIR).exists() and any((dest_root / SORTED_DIR).iterdir()):
        sys.exit(f"오류: {dest_root / SORTED_DIR} 에 이미 파일이 있습니다. 비우거나 다른 결과 폴더를 지정하세요.")
    if not HAVE_HEIF:
        sys.exit("오류: pillow-heif 가 필요합니다 → pip install pillow-heif")

    problems, skipped = [], []
    items, stats = collect(source, problems, skipped)
    analyze(items, not args.no_filename_date, args.video_utc_offset, problems)
    mark_duplicates(items)
    print(summarize(items, stats, problems, skipped))

    sorted_root = dest_root / SORTED_DIR
    book = NameBook()
    items.sort(key=lambda i: (i.dt is None, i.dt or datetime.min, i.is_dup, i.origin, i.member))
    for n, it in enumerate(items, 1):
        if not it.sha:
            it.label = "읽기실패"
            continue
        if it.is_dup:
            folder = sorted_root / DUP_DIR
            it.label = "중복"
            it.note = (it.note + f" 같은 내용: {Path(it.dup_of.origin).name}").strip()
        elif it.dt:
            folder = sorted_root / f"{it.dt:%Y}" / f"{it.dt:%Y-%m}"
        else:
            folder = sorted_root / NODATE_DIR
        if it.dt:
            stem = it.dt.strftime("%Y-%m-%d_%H-%M-%S" if it.has_time else "%Y-%m-%d")
        else:
            stem = safe_stem(Path(it.display_name.replace("\\", "/")).stem)
        stem = book.reserve(folder, stem)
        try:
            out = write_photo(it, folder, stem, args.quality)
            it.dest = str(out.relative_to(dest_root))
            v = write_video(it, folder, stem)
            if v:
                it.video_dest = str(v.relative_to(dest_root))
        except Exception as e:
            it.note = (it.note + f" 쓰기 실패: {e}").strip()
            problems.append(f"쓰기 실패: {it.origin} {it.member} ({e})")
        if not it.label:
            it.label = "미판정(영상)" if it.is_video_only else "미판정"
        if n % 20 == 0:
            print(f"  ... {n}/{len(items)}")

    n_review = make_review(dest_root, items)
    write_log(dest_root, items)
    (dest_root / REVIEW_DIR / "manifest.json").write_text(
        json.dumps({"source": str(source)}, ensure_ascii=False), encoding="utf-8")
    print(f"\n완료: {dest_root / LOG_NAME}")
    print(f"교실사진 판정 대상 {n_review}장 → {dest_root / REVIEW_DIR} 의 모아보기를 보고 판정입력.csv 를 채운 뒤 classroom 실행")
    if problems:
        print(f"문제 {len(problems)}건 (정리기록.csv 비고 참고)")


def classroom(dest_root: Path, args) -> None:
    dest_root = dest_root.resolve()
    review_csv = Path(args.labels) if args.labels else dest_root / REVIEW_DIR / "판정입력.csv"
    class_root = dest_root / CLASS_DIR
    if class_root.exists() and any(class_root.rglob("*")):
        sys.exit(f"오류: {class_root} 에 이미 파일이 있습니다. 다시 하려면 그 폴더를 비운 뒤 실행하세요.")
    raw = review_csv.read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:  # 엑셀에서 그냥 'CSV'로 저장하면 cp949
        text = raw.decode("cp949")
    labels = {r["새위치"]: ((r.get("판정") or "").strip(), (r.get("메모") or "").strip())
              for r in csv.DictReader(io.StringIO(text))}
    bad = [k for k, (v, _) in labels.items() if v not in VALID_LABELS]
    if bad:
        sys.exit(f"오류: 판정이 비었거나 잘못된 행 {len(bad)}개 (교실/확인필요/아님 중 하나): {bad[:5]}")

    log_path = dest_root / LOG_NAME
    with open(log_path, encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    book = NameBook()
    counts = Counter()
    check_list = []
    for r in rows:
        if r["판정"] == "중복" or r["새위치"] not in labels:
            continue
        label, memo = labels[r["새위치"]]
        r["판정"] = label
        counts[label] += 1
        if label == "아님":
            r["교실사진위치"] = ""
            continue
        src = dest_root / r["새위치"]
        if label == "확인필요":
            folder = class_root / CHECK_DIR
            check_list.append((r["새위치"], memo))
        elif r["촬영날짜"]:
            d = r["촬영날짜"]
            folder = class_root / d[:4] / d[:7]
        else:
            folder = class_root / NODATE_DIR
        folder.mkdir(parents=True, exist_ok=True)
        stem = book.reserve(folder, src.stem)
        out = folder / f"{stem}{src.suffix}"
        shutil.copyfile(src, out)
        r["교실사진위치"] = str(out.relative_to(dest_root))
        if r["동영상새위치"]:
            vsrc = dest_root / r["동영상새위치"]
            shutil.copyfile(vsrc, folder / f"{stem}{vsrc.suffix}")
        if memo:
            r["비고"] = (r["비고"] + f" 판정메모: {memo}").strip()
    with open(log_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=LOG_FIELDS)
        w.writeheader()
        w.writerows(rows)
    print("교실사진 판정: " + ", ".join(f"{k} {v}" for k, v in counts.items()))
    if check_list:
        print("확인필요 목록:")
        for p, memo in check_list:
            print(f"  {p}" + (f"  ({memo})" if memo else ""))


def report(dest_root: Path) -> None:
    with open(dest_root / LOG_NAME, encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    months = Counter(r["촬영날짜"][:7] for r in rows if r["판정"] != "중복" and r["촬영날짜"] and r["새위치"])
    print("월별 장수(중복 제외): " + ", ".join(f"{k} {v}" for k, v in sorted(months.items())))
    print("판정: " + ", ".join(f"{k} {v}" for k, v in Counter(r["판정"] for r in rows).items()))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("scan", "organize"):
        sp = sub.add_parser(name)
        sp.add_argument("source")
        if name == "organize":
            sp.add_argument("dest")
            sp.add_argument("--quality", type=int, default=92)
        sp.add_argument("--no-filename-date", action="store_true",
                        help="EXIF 가 없으면 파일 이름 날짜를 쓰지 않고 바로 날짜없음으로")
        sp.add_argument("--video-utc-offset", type=float, default=9.0,
                        help="영상 생성시각(UTC)을 현지 시각으로 바꿀 때 시차 (기본 9 = 한국)")
    sp = sub.add_parser("classroom")
    sp.add_argument("dest")
    sp.add_argument("--labels", help="판정입력.csv 경로 (기본: 결과폴더/_검토용/판정입력.csv)")
    sp = sub.add_parser("report")
    sp.add_argument("dest")
    args = ap.parse_args()

    if args.cmd == "scan":
        problems, skipped = [], []
        items, stats = collect(Path(args.source), problems, skipped)
        analyze(items, not args.no_filename_date, args.video_utc_offset, problems)
        mark_duplicates(items)
        print(summarize(items, stats, problems, skipped))
    elif args.cmd == "organize":
        organize(Path(args.source), Path(args.dest), args)
    elif args.cmd == "classroom":
        classroom(Path(args.dest), args)
    else:
        report(Path(args.dest))


if __name__ == "__main__":
    main()
