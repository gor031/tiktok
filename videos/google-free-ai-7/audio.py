#!/usr/bin/env python3
"""Synthesise the soundtrack (music bed + SFX) from cues.json → out/audio_raw.wav.

Every sound is code: no samples. The cue sheet comes from index.html (node render.mjs --cues),
so picture hits and audio onsets share one source of truth. Mastering (−14 LUFS, −1 dBTP)
is done by ffmpeg loudnorm in make.sh.
"""
import json
import os
import wave

import numpy as np

SR = 48000
ROOT = os.path.dirname(os.path.abspath(__file__))
cues = json.load(open(os.path.join(ROOT, 'cues.json')))
DUR = cues['duration']
N = int(DUR * SR) + SR
rng = np.random.default_rng(7)

L = np.zeros(N)
R = np.zeros(N)


def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    L[i:i + len(sig)] += sig * gain * np.sqrt(0.5 * (1 - pan))
    R[i:i + len(sig)] += sig * gain * np.sqrt(0.5 * (1 + pan))


def tt(d):
    return np.arange(int(d * SR)) / SR


def env(d, a=0.003, decay=8.0):
    t = tt(d)
    return np.minimum(1, t / a) * np.exp(-t * decay)


def fft_filter(x, lo=None, hi=None):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if hi:
        m *= 1 / np.sqrt(1 + (f / hi) ** 4)
    if lo:
        m *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1)) ** 4)
    return np.fft.irfft(X * m, len(x))


def mtof(m):
    return 440 * 2 ** ((m - 69) / 12)


# ---------------------------------------------------------------- music
BPM = cues['bpm']
BEAT = 60 / BPM
BAR = 4 * BEAT
T_TOOLS, T_OUTRO = 3.5, DUR - 3.5
BEAT_IN = 1.6                       # full groove lands on the big "7"
END_GROOVE = T_OUTRO + 1.5

# vi – IV – I – V in C (A minor feel, bright pop)
CHORDS = [(57, [57, 60, 64]), (53, [53, 57, 60]), (48, [55, 60, 64]), (55, [55, 59, 62])]


def kick():
    t = tt(0.32)
    f = 45 + 95 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * 1.0


def clap():
    t = tt(0.22)
    n = rng.standard_normal(len(t))
    n = fft_filter(n, lo=900, hi=5000)
    e = np.exp(-t * 22) * (1 + 0.6 * (np.sin(2 * np.pi * 90 * t) > 0) * (t < .03))
    return n * e * 0.55


def hat(open_=False):
    t = tt(0.18 if open_ else 0.05)
    n = fft_filter(rng.standard_normal(len(t)), lo=7000)
    return n * np.exp(-t * (18 if open_ else 70)) * 0.35


def bass_note(m, d):
    t = tt(d)
    f = mtof(m - 12)
    s = sum(np.sin(2 * np.pi * f * k * t) / k for k in range(1, 7))
    return s * np.minimum(1, t / .005) * np.exp(-t * 3.5) * 0.32


def pluck(m, d=0.22):
    t = tt(d)
    f = mtof(m + 12)
    s = 0.6 * np.sign(np.sin(2 * np.pi * f * t)) * np.exp(-t * 18) + np.sin(2 * np.pi * f * t) * np.exp(-t * 9)
    return s * np.minimum(1, t / .002) * 0.11


def pad(notes, d):
    t = tt(d)
    s = np.zeros_like(t)
    for m in notes:
        for det in (-0.08, 0.08):
            f = mtof(m) * 2 ** (det / 12)
            s += 2 * (f * t - np.floor(0.5 + f * t))      # saw
    a = np.minimum(1, t / 0.25) * np.minimum(1, (d - t) / 0.3)
    return s * a * 0.035


music = np.zeros(N)
musL = np.zeros(N)
musR = np.zeros(N)
padbus = np.zeros(N)


def mput(buf, sig, t, g=1.0):
    i = int(t * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    buf[i:i + len(sig)] += sig * g


nbars = int(np.ceil(DUR / BAR))
K = kick()
kick_times = []
for b in range(nbars):
    t0 = b * BAR
    root, notes = CHORDS[b % 4]
    if t0 < END_GROOVE + BAR:
        mput(padbus, pad(notes, BAR), t0, 1.0 if t0 >= BEAT_IN - BAR else 0.6)
    for k in range(4):
        tb = t0 + k * BEAT
        if tb >= END_GROOVE:
            break
        groove = tb >= BEAT_IN - 1e-6
        light = T_OUTRO - 1e-6 <= tb
        if groove:
            mput(music, K, tb, 0.8 if not light else 0.5)
            kick_times.append(tb)
            if k in (1, 3):
                mput(musL, clap(), tb, 0.8); mput(musR, clap(), tb, 0.8)
            mput(musL, hat(), tb + BEAT / 2, 0.9); mput(musR, hat(), tb + BEAT / 2, 0.6)
            if k == 3:
                mput(musR, hat(True), tb + BEAT * 0.75, 0.5)
            for e in range(2):
                mput(music, bass_note(root, BEAT / 2), tb + e * BEAT / 2, 1.0)
        # arp 16ths through chord tones (enters with the tools)
        if tb >= T_TOOLS - 1e-6 and not light:
            seq = [0, 1, 2, 1]
            for s in range(4):
                m = notes[seq[s]] + (12 if (s == 2 and k % 2) else 0)
                buf = musL if s % 2 == 0 else musR
                mput(buf, pluck(m), tb + s * BEAT / 4, 1.0)
        elif tb < BEAT_IN:
            mput(music, pluck(notes[k % 3], 0.4), tb, 0.6)

# sidechain duck on pad + bass-ish bus
duck = np.ones(N)
for kt in kick_times:
    i = int(kt * SR)
    d = tt(0.22)
    seg = 1 - 0.55 * np.exp(-d * 14)
    duck[i:i + len(seg)] = np.minimum(duck[i:i + len(seg)], seg[: N - i])
padbus = fft_filter(padbus, hi=3200) * duck
music = music * (0.75 + 0.25 * duck)

# final chord (outro)
for tf in cues['final']:
    t = tt(3.0)
    s = np.zeros_like(t)
    for m in (48, 55, 60, 64, 67, 72):
        s += np.sin(2 * np.pi * mtof(m) * t) * (1 / (1 + (m - 48) / 24))
    s *= np.minimum(1, t / 0.01) * np.exp(-t * 1.1) * 0.12
    mput(music, s, tf)
    mput(musL, pluck(72, 1.0) * 1.5, tf); mput(musR, pluck(76, 1.0) * 1.5, tf + 0.07)

L += (music + padbus + musL) * 0.9
R += (music + padbus + musR) * 0.9

# ---------------------------------------------------------------- sfx


def whoosh():
    d = 0.7
    t = tt(d)
    n = rng.standard_normal(len(t))
    sweep = np.zeros_like(n)
    # crude moving band: mix of low/high filtered noise crossfaded over time
    lo = fft_filter(n, lo=300, hi=1500)
    hi = fft_filter(n, lo=2500, hi=9000)
    x = t / d
    sweep = lo * (1 - x) + hi * x
    e = np.sin(np.pi * np.clip(x, 0, 1)) ** 2
    return sweep * e * 0.5


def popfx():
    t = tt(0.12)
    f = 380 + 700 * np.exp(-t * 40)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(0.12, 0.001, 30) * 0.45


def clickfx():
    t = tt(0.03)
    n = fft_filter(rng.standard_normal(len(t)), lo=2000)
    return (n * 0.5 + np.sin(2 * np.pi * 3200 * t)) * np.exp(-t * 260) * 0.4


def typefx():
    t = tt(0.025)
    n = fft_filter(rng.standard_normal(len(t)), lo=1500, hi=7000)
    return n * np.exp(-t * 300) * 0.25


def dingfx():
    t = tt(0.9)
    s = np.sin(2 * np.pi * 1318.5 * t) + 0.5 * np.sin(2 * np.pi * 1975.5 * t) + 0.25 * np.sin(2 * np.pi * 2637 * t)
    return s * np.minimum(1, t / .002) * np.exp(-t * 5) * 0.16


def tickfx():
    t = tt(0.06)
    return np.sin(2 * np.pi * 1250 * t) * np.exp(-t * 70) * 0.3


def hitfx():
    t = tt(0.9)
    f = 40 + 110 * np.exp(-t * 12)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.5)
    n = fft_filter(rng.standard_normal(len(t)), lo=200, hi=6000) * np.exp(-t * 14)
    # quick downward "scratch" chirp for the "잠깐!" hook
    fs = 1800 * np.exp(-t * 9) + 200
    ch = np.sin(2 * np.pi * np.cumsum(fs) / SR) * np.exp(-t * 10) * 0.25
    return (body * 0.9 + n * 0.5 + ch) * 0.8


W = whoosh()
for c in cues['whoosh']:
    add(W, c - 0.45, 0.8, 0.0)
for c in cues['pop']:
    add(popfx(), c, 0.9, 0.1)
for c in cues['click']:
    add(clickfx(), c, 1.0, 0.2)
for i, c in enumerate(cues['type']):
    add(typefx(), c, 0.9, -0.2 + 0.4 * (i % 2))
for c in cues['ding']:
    add(dingfx(), c, 1.0, 0.25)
for c in cues['tick']:
    add(tickfx(), c, 0.9, -0.15)
for c in cues['hit']:
    add(hitfx(), c, 1.0)
t_b = tt(1.4)
boom = np.sin(2 * np.pi * np.cumsum(30 + 60 * np.exp(-t_b * 6)) / SR) * np.exp(-t_b * 2.8) * 0.9
for c in cues['boom']:
    add(boom, c, 1.0)

# ---------------------------------------------------------------- write
n_out = int(DUR * SR)
fade = int(0.6 * SR)
for ch in (L, R):
    ch[n_out - fade:n_out] *= np.linspace(1, 0, fade)
st = np.stack([L[:n_out], R[:n_out]], 1)
st = st / (np.max(np.abs(st)) + 1e-9) * 0.89
os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
with wave.open(os.path.join(ROOT, 'out', 'audio_raw.wav'), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((st * 32767).astype('<i2').tobytes())
print('wrote out/audio_raw.wav', f'{DUR:.2f}s')
