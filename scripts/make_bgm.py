"""밝은 방송 오프닝 느낌의 짧은 배경음악을 직접 합성한다 (저작권 걱정 없음).

    python scripts/make_bgm.py bgm.wav 13.4   # 출력 파일, 길이(초)
"""
import sys, numpy as np, wave
SR, BPM, DUR = 44100, 120, float(sys.argv[2])
beat = 60 / BPM
n = int(SR * (DUR + 2.5))
L = np.zeros(n); R = np.zeros(n)
rng = np.random.default_rng(7)

def hz(m): return 440 * 2 ** ((m - 69) / 12)
def add(sig, t, pan=0.0, gain=1.0):
    i = int(t * SR); j = min(n, i + len(sig))
    if i >= n: return
    L[i:j] += sig[: j - i] * gain * (1 - pan) / 2 ** 0.5 * 1.2
    R[i:j] += sig[: j - i] * gain * (1 + pan) / 2 ** 0.5 * 1.2
def env(length, a=0.005, d=0.3):
    t = np.arange(int(length * SR)) / SR
    return np.minimum(t / a, 1) * np.exp(-t / d)

def epiano(m, length, vel=1.0):
    t = np.arange(int(length * SR)) / SR; f = hz(m)
    s = np.sin(2*np.pi*f*t) + 0.35*np.sin(2*np.pi*2*f*t)*np.exp(-t/0.25) + 0.12*np.sin(2*np.pi*3*f*t)*np.exp(-t/0.1)
    return s * env(length, 0.004, 0.9) * vel
def bell(m, length=0.6, vel=1.0):
    t = np.arange(int(length * SR)) / SR; f = hz(m)
    s = np.sin(2*np.pi*f*t + 1.2*np.sin(2*np.pi*f*3.5*t)*np.exp(-t/0.08))
    return s * env(length, 0.002, 0.22) * vel
def bass(m, length):
    t = np.arange(int(length * SR)) / SR; f = hz(m)
    s = np.sin(2*np.pi*f*t) + 0.25*np.sin(2*np.pi*2*f*t)
    e = np.minimum(t / 0.006, 1) * np.minimum(1, (length - t) / 0.03)
    return s * e
def kick():
    t = np.arange(int(0.35 * SR)) / SR
    f = 50 + 90 * np.exp(-t / 0.04)
    return np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-t / 0.12)
def clap():
    t = np.arange(int(0.25 * SR)) / SR
    x = rng.standard_normal(len(t)); x = x - np.convolve(x, np.ones(8)/8, "same")
    return x * np.exp(-t / 0.06) * 0.5
def hat(open_=False):
    t = np.arange(int((0.18 if open_ else 0.05) * SR)) / SR
    x = rng.standard_normal(len(t)); x = np.diff(np.diff(x, prepend=0), prepend=0)
    return x * np.exp(-t / (0.06 if open_ else 0.015)) * 0.12

# 코드 진행: C G Am F | C G Am F | C (마무리)
prog = [(48, [60, 64, 67]), (43, [59, 62, 67]), (45, [60, 64, 69]), (41, [60, 65, 69])]
bars = int(np.ceil(DUR / (4 * beat)))
for b in range(bars):
    last = b == bars - 1
    root, ch = (48, [60, 64, 67, 72]) if last else prog[b % 4]
    t0 = b * 4 * beat
    if last:
        for k, m in enumerate(ch): add(epiano(m, 3.5, 0.5), t0 + k * 0.02, pan=(k - 1.5) * 0.3)
        add(bass(root, 2.5), t0, gain=0.55); add(kick(), t0, gain=0.9)
        for k, m in enumerate([72, 76, 79, 84]): add(bell(m, 1.2, 0.35), t0 + k * beat / 4, pan=0.3 - k * 0.2)
        break
    # 피아노: 박자마다 화음 (2·4박은 살짝 약하게)
    for q in range(4):
        for k, m in enumerate(ch): add(epiano(m, beat * 1.2, 0.32 if q % 2 == 0 else 0.22), t0 + q * beat + k * 0.008, pan=(k - 1) * 0.35)
    # 베이스: 8분음표, 근음과 옥타브
    for e in range(8):
        add(bass(root + (12 if e % 4 == 3 else 0), beat / 2 * 0.9), t0 + e * beat / 2, gain=0.5)
    # 드럼
    for q in range(4):
        add(kick(), t0 + q * beat, gain=0.8)
        if q % 2 == 1: add(clap(), t0 + q * beat, gain=0.8)
    for e in range(8): add(hat(e % 2 == 1 and e == 7), t0 + e * beat / 2 + 0.01, pan=0.4, gain=1.0 if e % 2 else 0.6)
    # 벨 아르페지오 (16분음표, 화음음 위로)
    arp = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 12]
    for s16 in range(16):
        if b % 2 == 1 and s16 >= 12: continue  # 두 마디마다 숨 쉬기
        add(bell(arp[s16 % 4], 0.4, 0.16), t0 + s16 * beat / 4, pan=-0.4 + 0.8 * (s16 % 4) / 3)

# 간단한 잔향
ir_t = np.arange(int(0.9 * SR)) / SR
for ch_, seed in ((L, 1), (R, 2)):
    ir = np.random.default_rng(seed).standard_normal(len(ir_t))
    ir = np.convolve(ir, np.ones(6) / 6, "same") * np.exp(-ir_t / 0.22) * 0.006  # 어둡고 옅은 잔향
    ir[0] = 1.0
    ch_[:] = np.convolve(ch_, ir)[:n]
mix = np.stack([L, R], 1)[: int(SR * DUR)]
fade = int(SR * 1.2); mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 1.5
mix /= np.abs(mix).max() / 0.89
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
