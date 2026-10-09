"""영상 속 사람 얼굴을 자동으로 찾아 블러 처리한다.

학생이 나오는 활동 영상을 유튜브 등에 올리기 전에 초상권을 보호하려고 쓴다.

    python scripts/blur_faces.py input.mp4 output.mp4 --models MODEL_DIR

학교 로고·책상 번호표처럼 학교나 학생을 알 수 있는 것도 함께 가리려면

    python scripts/blur_faces.py input.mp4 output.mp4 --models MODEL_DIR \
        --labels --region 100:645,1145,725,1200

--labels 는 번호표·이름표 같은 작은 글씨 딱지를 자동으로 찾고,
--region 은 한 프레임에서 위치를 알려 준 대상(예: 셔츠 로고)을 영상 전체에서 추적한다.

MODEL_DIR 에는 다음 파일이 있어야 한다.
  - yunet.onnx          (OpenCV Zoo face_detection_yunet_2023mar.onnx)
  - blaze_full.tflite   (MediaPipe blaze_face_full_range)
  - blaze_short.tflite  (MediaPipe blaze_face_short_range)

감지기 세 개의 결과를 합치고, 프레임 사이를 추적해 놓친 프레임을 메운 뒤
얼굴보다 넉넉한 타원 영역을 강하게 블러한다. 소리는 그대로 복사한다.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

import cv2
import numpy as np


def probe_size(path: Path) -> tuple[int, int, str]:
    """회전 메타데이터를 반영한 화면 크기와 프레임레이트."""
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height,r_frame_rate:stream_side_data=rotation",
         "-of", "json", str(path)],
        capture_output=True, text=True, check=True,
    )
    s = json.loads(out.stdout)["streams"][0]
    w, h = s["width"], s["height"]
    rot = 0
    for sd in s.get("side_data_list", []):
        rot = int(sd.get("rotation", 0))
    if abs(rot) % 180 == 90:
        w, h = h, w
    return w, h, s["r_frame_rate"]


def read_frames(path: Path, w: int, h: int):
    proc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-i", str(path), "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
        stdout=subprocess.PIPE,
    )
    size = w * h * 3
    while True:
        buf = proc.stdout.read(size)
        if len(buf) < size:
            break
        yield np.frombuffer(buf, np.uint8).reshape(h, w, 3).copy()
    proc.wait()


class Detector:
    def __init__(self, model_dir: Path, w: int, h: int):
        import mediapipe as mp
        from mediapipe.tasks.python import BaseOptions
        from mediapipe.tasks.python.vision import FaceDetector, FaceDetectorOptions

        self.mp = mp
        self.yunet = cv2.FaceDetectorYN.create(
            str(model_dir / "yunet.onnx"), "", (w, h), score_threshold=0.5, nms_threshold=0.3, top_k=50,
        )
        self.blaze = [
            FaceDetector.create_from_options(FaceDetectorOptions(
                base_options=BaseOptions(model_asset_path=str(model_dir / name)),
                min_detection_confidence=0.45,
            ))
            for name in ("blaze_full.tflite", "blaze_short.tflite")
        ]

    def close(self) -> None:
        for d in self.blaze:
            d.close()

    def _yunet(self, img: np.ndarray, scale: float) -> list[tuple]:
        h, w = img.shape[:2]
        small = cv2.resize(img, (int(w * scale), int(h * scale))) if scale != 1 else img
        self.yunet.setInputSize((small.shape[1], small.shape[0]))
        _, faces = self.yunet.detect(small)
        boxes = []
        if faces is not None:
            for f in faces:
                x, y, bw, bh = (f[:4] / scale).tolist()
                boxes.append((x, y, bw, bh, float(f[-1])))
        return boxes

    def _blaze(self, img: np.ndarray, ox: int = 0, oy: int = 0) -> list[tuple]:
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        mimg = self.mp.Image(image_format=self.mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb))
        boxes = []
        for det in self.blaze:
            for d in det.detect(mimg).detections:
                b = d.bounding_box
                boxes.append((b.origin_x + ox, b.origin_y + oy, b.width, b.height, d.categories[0].score))
        return boxes

    def detect(self, frame: np.ndarray) -> list[tuple]:
        h, w = frame.shape[:2]
        boxes = self._yunet(frame, 1.0) + self._yunet(frame, 0.5)
        boxes += self._blaze(frame)
        # 화면을 겹치는 타일로 나눠 작은 얼굴도 잡는다
        th, tw = h // 2, w
        for ty in (0, h // 4, h // 2):
            boxes += self._blaze(frame[ty:ty + th, 0:tw], 0, ty)
        return nms(boxes, 0.3)


class HeadFinder:
    """사람(몸)을 찾고 자세 추정으로 머리 위치를 구한다.

    얼굴 감지기는 정면 얼굴에 강하지만 마스크·옆모습·뒷모습·멀리 있는 사람을 자주 놓친다.
    몸은 훨씬 잘 찾히므로, 몸 상자 안에서 코·눈·귀 위치로 머리를 잡는다.
    MODEL_DIR 에 efficientdet.tflite(EfficientDet-Lite2)와 pose_landmarker_heavy.task 가 필요하다.
    """

    def __init__(self, model_dir: Path):
        import mediapipe as mp
        from mediapipe.tasks.python import BaseOptions
        from mediapipe.tasks.python.vision import (
            ObjectDetector, ObjectDetectorOptions, PoseLandmarker, PoseLandmarkerOptions)

        self.mp = mp
        self.od = ObjectDetector.create_from_options(ObjectDetectorOptions(
            base_options=BaseOptions(model_asset_path=str(model_dir / "efficientdet.tflite")),
            score_threshold=0.25, category_allowlist=["person"], max_results=40))
        self.pose = PoseLandmarker.create_from_options(PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(model_dir / "pose_landmarker_heavy.task")),
            num_poses=1, min_pose_detection_confidence=0.3))

    def close(self) -> None:
        self.od.close()
        self.pose.close()

    def _img(self, bgr: np.ndarray):
        rgb = np.ascontiguousarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
        return self.mp.Image(image_format=self.mp.ImageFormat.SRGB, data=rgb)

    def persons(self, frame: np.ndarray) -> list[tuple]:
        h, w = frame.shape[:2]
        tiles = [(0, 0, w, h)] + [(x, y, min(w, x + w // 2 + 100), min(h, y + h // 2 + 100))
                                  for x in (0, w // 2 - 100) for y in (0, h // 2 - 100)]
        found = []
        for x0, y0, x1, y1 in tiles:
            for d in self.od.detect(self._img(frame[y0:y1, x0:x1])).detections:
                b = d.bounding_box
                found.append((b.origin_x + x0, b.origin_y + y0, b.width, b.height, d.categories[0].score))
        return nms(found, 0.5)

    def head(self, frame: np.ndarray, p: tuple) -> tuple | None:
        x, y, bw, bh, score = p
        h, w = frame.shape[:2]
        x0, y0 = int(max(0, x - bw * 0.15)), int(max(0, y - bh * 0.1))
        x1, y1 = int(min(w, x + bw * 1.15)), int(min(h, y + bh * 1.1))
        crop = frame[y0:y1, x0:x1]
        if crop.size == 0:
            return None
        k = max(1.0, 384 / max(crop.shape[:2]))
        big = cv2.resize(crop, None, fx=k, fy=k)
        r = self.pose.detect(self._img(big))
        if r.pose_landmarks:
            lm = r.pose_landmarks[0]
            pts = np.array([(l.x * big.shape[1] / k + x0, l.y * big.shape[0] / k + y0) for l in lm[:11]])
            shoulder = abs(lm[11].x - lm[12].x) * big.shape[1] / k
            cx, cy = np.median(pts, 0)
            size = max(np.ptp(pts[:, 0]) * 1.3, shoulder * 0.55, bw * 0.22)
            # 자세 추정이 엉뚱하게 나온 경우(머리가 몸 상자 아래쪽이거나 너무 큼)는 버린다
            if size <= min(bw * 0.7, bh * 0.45) and y - bh * 0.1 <= cy <= y + bh * 0.5:
                return (cx - size / 2, cy - size * 0.55, size, size * 1.1, score)
        size = min(bw * 0.4, bh * 0.3)
        return (x + bw / 2 - size / 2, y + size * 0.1, size, size * 1.1, score * 0.9)

    def detect(self, frame: np.ndarray) -> list[tuple]:
        return [hb for p in self.persons(frame) if (hb := self.head(frame, p)) is not None]


def iou(a, b) -> float:
    ax2, ay2, bx2, by2 = a[0] + a[2], a[1] + a[3], b[0] + b[2], b[1] + b[3]
    iw = max(0, min(ax2, bx2) - max(a[0], b[0]))
    ih = max(0, min(ay2, by2) - max(a[1], b[1]))
    inter = iw * ih
    union = a[2] * a[3] + b[2] * b[3] - inter
    return inter / union if union > 0 else 0.0


def nms(boxes: list[tuple], thr: float) -> list[tuple]:
    boxes = sorted(boxes, key=lambda b: -b[4])
    keep: list[tuple] = []
    for b in boxes:
        if b[2] < 12 or b[3] < 12:
            continue
        if all(iou(b, k) < thr for k in keep):
            keep.append(b)
    return keep


def camera_motion(path: Path, w: int, h: int) -> list[np.ndarray]:
    """프레임 i → i+1 카메라 움직임(이동·확대)을 2x3 행렬로 추정한다."""
    s = 0.25
    mats, prev = [], None
    for f in read_frames(path, w, h):
        g = cv2.cvtColor(cv2.resize(f, None, fx=s, fy=s), cv2.COLOR_BGR2GRAY)
        if prev is not None:
            m = None
            pts = cv2.goodFeaturesToTrack(prev, 400, 0.01, 8)
            if pts is not None:
                nxt, st, _ = cv2.calcOpticalFlowPyrLK(prev, g, pts, None)
                ok = st.ravel() == 1
                if ok.sum() >= 10:
                    m, _ = cv2.estimateAffinePartial2D(pts[ok], nxt[ok], method=cv2.RANSAC)
            if m is None:
                m = np.array([[1, 0, 0], [0, 1, 0]], float)
            m[:, 2] /= s
            mats.append(m)
        prev = g
    return mats


def move_box(b: tuple, m: np.ndarray) -> tuple:
    x, y, bw, bh = b[:4]
    cx, cy = m @ np.array([x + bw / 2, y + bh / 2, 1.0])
    k = float(np.sqrt(abs(np.linalg.det(m[:, :2]))))
    return (cx - bw * k / 2, cy - bh * k / 2, bw * k, bh * k, 0.0)


def track(dets: list[list[tuple]], max_gap: int, motion: list[np.ndarray] | None = None,
          hold: int | None = None, near_k: float = 0.8) -> list[list[tuple]]:
    """프레임별 감지를 이어 트랙을 만들고, 빈 프레임은 보간한다.

    max_gap 프레임까지 끊긴 감지를 이어 붙이고, 트랙 앞뒤로 hold 프레임(기본 max_gap)을 더 가린다.
    """
    hold = max_gap if hold is None else hold
    tracks: list[dict] = []  # {"frames": {i: box}, "last": i}
    for i, boxes in enumerate(dets):
        used = set()
        for t in sorted(tracks, key=lambda t: -t["last"]):
            if i - t["last"] > max_gap:
                continue
            lb = t["frames"][t["last"]]
            best, bi = 0.0, -1
            for j, b in enumerate(boxes):
                if j in used:
                    continue
                cx, cy = b[0] + b[2] / 2, b[1] + b[3] / 2
                lcx, lcy = lb[0] + lb[2] / 2, lb[1] + lb[3] / 2
                near = np.hypot(cx - lcx, cy - lcy) < max(lb[2], lb[3]) * near_k
                score = max(iou(b, lb), 0.05 if near else 0.0)
                if score > best:
                    best, bi = score, j
            if bi >= 0:
                t["frames"][i] = boxes[bi]
                t["last"] = i
                used.add(bi)
        for j, b in enumerate(boxes):
            if j not in used:
                tracks.append({"frames": {i: b}, "last": i})

    n = len(dets)
    out: list[list[tuple]] = [[] for _ in range(n)]
    for t in tracks:
        idx = sorted(t["frames"])
        scores = [t["frames"][k][4] for k in idx]
        # 잠깐 나타난 낮은 점수 감지는 오검출로 본다
        if len(idx) < 3 and max(scores) < 0.8:
            continue
        for a, b in zip(idx, idx[1:] + [None]):
            out[a].append(t["frames"][a])
            if b is None:
                continue
            ba, bb = np.array(t["frames"][a][:4]), np.array(t["frames"][b][:4])
            for k in range(a + 1, b):
                r = (k - a) / (b - a)
                out[k].append(tuple((ba * (1 - r) + bb * r).tolist()) + (0.0,))
        # 확실한 얼굴이면 손으로 가리거나 화면 끝에 걸려 감지가 끊겨도
        # 카메라 움직임을 따라 영상 처음·끝까지 계속 가린다
        sure = motion is not None and len(idx) >= 20 and float(np.median(scores)) >= 0.8
        before = range(0, idx[0]) if sure else range(max(0, idx[0] - hold), idx[0])
        after = range(idx[-1] + 1, n) if sure else range(idx[-1] + 1, min(n, idx[-1] + hold + 1))
        b = t["frames"][idx[0]]
        for k in reversed(before):
            if motion is not None:
                b = move_box(b, cv2.invertAffineTransform(motion[k]))
            out[k].append(b)
        b = t["frames"][idx[-1]]
        for k in after:
            if motion is not None:
                b = move_box(b, motion[k - 1])
            out[k].append(b)
    return out


def find_labels(frame: np.ndarray) -> list[tuple]:
    """책상 번호표·이름표처럼 어두운 바탕에 붙은 작고 밝은 글씨 딱지를 찾는다."""
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    top = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, cv2.getStructuringElement(cv2.MORPH_RECT, (181, 61)))
    light = ((top > 35) & (hsv[..., 1] < 130)).astype(np.uint8) * 255
    light = cv2.morphologyEx(light, cv2.MORPH_CLOSE, np.ones((7, 11), np.uint8))
    n, _, stats, _ = cv2.connectedComponentsWithStats(light)
    H, W = gray.shape
    out = []
    for x, y, w, h, area in stats[1:]:
        if not (30 <= w <= 160 and 10 <= h <= 50 and 2.2 <= w / h <= 6 and area > 0.55 * w * h):
            continue
        inner = gray[y:y + h, x:x + w]
        y0, y1, x0, x1 = max(0, y - h), min(H, y + 2 * h), max(0, x - w // 2), min(W, x + w + w // 2)
        ring = gray[y0:y1, x0:x1].astype(float)
        m = np.ones_like(ring, bool)
        m[y - y0:y - y0 + h, x - x0:x - x0 + w] = False
        if ring[m].mean() > inner.mean() - 30:  # 바탕이 딱지보다 충분히 어두워야 한다
            continue
        if (inner < inner.mean() - 25).mean() < 0.02:  # 안에 글씨가 있어야 한다
            continue
        out.append((float(x), float(y), float(w), float(h), 1.0))
    return out


def track_region(gray: list[np.ndarray], motion: list[np.ndarray], seed: int, box: tuple, s: float) -> list[tuple | None]:
    """한 프레임에서 지정한 영역(로고·번호표 등)을 앞뒤 프레임으로 추적한다.

    카메라 움직임으로 위치를 예측한 뒤, 처음 지정한 모습과 가장 닮은 곳을
    주변에서 찾아 바로잡는다. gray 는 s 배로 줄인 흑백 프레임이다.
    """
    x0, y0, x1, y1 = (v * s for v in box)
    bw0, bh0 = x1 - x0, y1 - y0
    # 번호표처럼 작고 밋밋한 대상은 주변(책상 모서리 등)까지 함께 비교해야 덜 헷갈린다
    cx, cy = bw0 * 0.6 + 4, bh0 * 1.2 + 4
    border = int(max(cx, cy)) + 64
    padded = [cv2.copyMakeBorder(g, border, border, border, border, cv2.BORDER_CONSTANT, value=0) for g in gray]
    tmpl = padded[seed][int(y0 - cy) + border:int(y1 + cy) + border, int(x0 - cx) + border:int(x1 + cx) + border]
    th, tw = tmpl.shape
    n = len(gray)
    out: list[tuple | None] = [None] * n
    out[seed] = (x0, y0, bw0, bh0)

    def step(prev: tuple, m: np.ndarray, g: np.ndarray) -> tuple:
        sm = m.copy()
        sm[:, 2] *= s
        x, y, bw, bh, _ = move_box(prev + (0.0,), sm)
        k = bw / bw0
        t = cv2.resize(tmpl, (max(4, round(tw * k)), max(4, round(th * k))))
        ex, ey = cx * k, cy * k
        pad = max(12, int(bw * 0.5))
        sx0, sy0 = int(x - ex - pad) + border, int(y - ey - pad) + border
        sx1, sy1 = sx0 + t.shape[1] + 2 * pad, sy0 + t.shape[0] + 2 * pad
        if sx0 < 0 or sy0 < 0 or sx1 > g.shape[1] or sy1 > g.shape[0]:
            return (x, y, bw, bh)  # 화면 밖으로 멀리 나갔다
        res = cv2.matchTemplate(g[sy0:sy1, sx0:sx1], t, cv2.TM_CCOEFF_NORMED)
        _, score, _, loc = cv2.minMaxLoc(res)
        if score < 0.6:
            return (x, y, bw, bh)
        return (sx0 + loc[0] - border + ex, sy0 + loc[1] - border + ey, bw, bh)

    for i in range(seed + 1, n):
        out[i] = step(out[i - 1], motion[i - 1], padded[i])
    for i in range(seed - 1, -1, -1):
        out[i] = step(out[i + 1], cv2.invertAffineTransform(motion[i]), padded[i])
    return [None if b is None else tuple(v / s for v in b) for b in out]


def blur_rects(frame: np.ndarray, rects: list[tuple], pad: float = 0.35) -> np.ndarray:
    """로고·번호표처럼 네모난 영역을 가장자리가 부드럽게 흐린다."""
    h, w = frame.shape[:2]
    out = frame
    for x, y, bw, bh in rects:
        px, py = bw * pad + 6, bh * pad + 6
        x0, y0 = int(max(0, x - px)), int(max(0, y - py))
        x1, y1 = int(min(w, x + bw + px)), int(min(h, y + bh + py))
        if x1 - x0 < 4 or y1 - y0 < 4:
            continue
        roi = out[y0:y1, x0:x1]
        ks = int(max(bw, bh) / 3) | 1
        blurred = cv2.GaussianBlur(cv2.GaussianBlur(roi, (ks, ks), 0), (ks, ks), 0)
        mask = np.zeros(roi.shape[:2], np.uint8)
        r = int(min(px, py) / 2)
        cv2.rectangle(mask, (r, r), (roi.shape[1] - r, roi.shape[0] - r), 255, -1)
        mask = cv2.GaussianBlur(mask, (2 * r + 1, 2 * r + 1), 0)[..., None] / 255.0
        out[y0:y1, x0:x1] = (blurred * mask + roi * (1 - mask)).astype(np.uint8)
    return out


def parse_region(text: str) -> tuple[int, tuple]:
    frame, coords = text.split(":")
    x0, y0, x1, y1 = (float(v) for v in coords.split(","))
    return int(frame), (x0, y0, x1, y1)


def blur(frame: np.ndarray, boxes: list[tuple], grow: float) -> np.ndarray:
    h, w = frame.shape[:2]
    out = frame.copy()
    for x, y, bw, bh, *_ in boxes:
        cx, cy = x + bw / 2, y + bh / 2 - bh * 0.08  # 이마·머리 쪽으로 살짝 올린다
        rx, ry = bw * grow / 2, bh * grow * 1.15 / 2
        x0, y0 = int(max(0, cx - rx)), int(max(0, cy - ry))
        x1, y1 = int(min(w, cx + rx)), int(min(h, cy + ry))
        if x1 <= x0 or y1 <= y0:
            continue
        roi = out[y0:y1, x0:x1]
        # 모자이크 + 가우시안: 복원하기 어렵고 보기에도 부드럽다
        k = max(6, int(min(roi.shape[:2]) / 6))
        small = cv2.resize(roi, (max(1, roi.shape[1] // k), max(1, roi.shape[0] // k)), interpolation=cv2.INTER_AREA)
        pix = cv2.resize(small, (roi.shape[1], roi.shape[0]), interpolation=cv2.INTER_NEAREST)
        ks = int(min(roi.shape[:2]) / 3) | 1
        pix = cv2.GaussianBlur(pix, (ks, ks), 0)
        mask = np.zeros(roi.shape[:2], np.uint8)
        cv2.ellipse(mask, (int(cx - x0), int(cy - y0)), (int(rx), int(ry)), 0, 0, 360, 255, -1)
        mask = cv2.GaussianBlur(mask, (15, 15), 0)[..., None] / 255.0
        out[y0:y1, x0:x1] = (pix * mask + roi * (1 - mask)).astype(np.uint8)
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input", type=Path)
    ap.add_argument("output", type=Path)
    ap.add_argument("--models", type=Path, required=True)
    ap.add_argument("--grow", type=float, default=1.8, help="얼굴 상자 대비 블러 영역 배율")
    ap.add_argument("--max-gap", type=int, default=15, help="감지가 끊겨도 이어 붙일 최대 프레임 수")
    ap.add_argument("--boxes-json", type=Path, help="감지·추적 결과를 저장할 경로 (검수용)")
    ap.add_argument("--bodies", action="store_true",
                    help="몸·자세로 머리를 찾아 마스크·옆모습·뒷모습·멀리 있는 사람도 가린다 (느림)")
    ap.add_argument("--stride", type=int, default=1, help="N 프레임마다 한 번 감지하고 사이는 보간한다")
    ap.add_argument("--labels", action="store_true", help="책상 번호표·이름표처럼 작은 글씨 딱지도 자동으로 찾아 흐린다")
    ap.add_argument("--region", action="append", default=[], metavar="FRAME:X0,Y0,X1,Y1",
                    help="얼굴 말고도 가릴 영역(학교 로고, 번호표 등). FRAME 번째 프레임에서의 위치를 주면 "
                         "영상 전체에서 추적해 흐린다. 여러 번 줄 수 있다.")
    args = ap.parse_args()

    w, h, fps = probe_size(args.input)
    det = Detector(args.models, w, h)
    heads = HeadFinder(args.models) if args.bodies else None
    raw = []
    for i, f in enumerate(read_frames(args.input, w, h)):
        if i % args.stride:
            raw.append([])
            continue
        found = det.detect(f) + (heads.detect(f) if heads else [])
        raw.append(nms(found, 0.2))
    det.close()
    if heads:
        heads.close()
    motion = camera_motion(args.input, w, h)
    # 돌아다니는 사람이 많은 영상에서는 감지가 끊긴 얼굴을 끝까지 늘리지 않는다
    boxes = track(raw, args.max_gap, None if args.bodies else motion)

    rects: list[list[tuple]] = [[] for _ in boxes]
    if args.labels:
        # 딱지는 화면 끝에 걸리면 놓치기 쉬워 길게(3초) 이어 붙이고, 앞뒤로는 조금만 더 가린다
        found = [find_labels(f) for f in read_frames(args.input, w, h)]
        for i, lb in enumerate(track(found, 90, hold=10, near_k=1.8)):
            rects[i].extend(tuple(b[:4]) for b in lb)
    if args.region:
        s = 0.5
        gray = [cv2.cvtColor(cv2.resize(f, None, fx=s, fy=s), cv2.COLOR_BGR2GRAY) for f in read_frames(args.input, w, h)]
        for text in args.region:
            seed, box = parse_region(text)
            for i, r in enumerate(track_region(gray, motion, seed, box, s)):
                if r is not None:
                    rects[i].append(r)
        del gray
    if args.boxes_json:
        args.boxes_json.write_text(json.dumps({"raw": raw, "tracked": boxes, "regions": rects}))

    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y",
         "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-r", fps, "-i", "-",
         "-i", str(args.input), "-map", "0:v", "-map", "1:a?",
         "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest",
         str(args.output)],
        stdin=subprocess.PIPE,
    )
    for i, f in enumerate(read_frames(args.input, w, h)):
        f = blur(f, boxes[i] if i < len(boxes) else [], args.grow)
        enc.stdin.write(blur_rects(f, rects[i] if i < len(rects) else []).tobytes())
    enc.stdin.close()
    enc.wait()
    print(f"{len(boxes)} frames, max {max(len(b) for b in boxes)} faces/frame -> {args.output}")


if __name__ == "__main__":
    main()
