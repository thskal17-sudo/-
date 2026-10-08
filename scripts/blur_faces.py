"""영상 속 사람 얼굴을 자동으로 찾아 블러 처리한다.

학생이 나오는 활동 영상을 유튜브 등에 올리기 전에 초상권을 보호하려고 쓴다.

    python scripts/blur_faces.py input.mp4 output.mp4 --models MODEL_DIR

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


def track(dets: list[list[tuple]], max_gap: int, motion: list[np.ndarray] | None = None) -> list[list[tuple]]:
    """프레임별 감지를 이어 트랙을 만들고, 빈 프레임은 보간한다."""
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
                near = np.hypot(cx - lcx, cy - lcy) < max(lb[2], lb[3]) * 0.8
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
        before = range(0, idx[0]) if sure else range(max(0, idx[0] - max_gap), idx[0])
        after = range(idx[-1] + 1, n) if sure else range(idx[-1] + 1, min(n, idx[-1] + max_gap + 1))
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
    args = ap.parse_args()

    w, h, fps = probe_size(args.input)
    det = Detector(args.models, w, h)
    raw = [det.detect(f) for f in read_frames(args.input, w, h)]
    det.close()
    boxes = track(raw, args.max_gap, camera_motion(args.input, w, h))
    if args.boxes_json:
        args.boxes_json.write_text(json.dumps({"raw": raw, "tracked": boxes}))

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
        enc.stdin.write(blur(f, boxes[i] if i < len(boxes) else [], args.grow).tobytes())
    enc.stdin.close()
    enc.wait()
    print(f"{len(boxes)} frames, max {max(len(b) for b in boxes)} faces/frame -> {args.output}")


if __name__ == "__main__":
    main()
