#!/usr/bin/env python3
"""Narration → voice clips (Fish Audio) → timeline.json + out/vo.wav.

Each line of narration.json is voiced separately, trimmed of edge silence and measured. Scene
lengths, subtitle cards and visual marks are then laid out from the real clip durations, so the
picture (index.html reads timeline.json) always follows the voice.

  FISH_API_KEY=... python3 tts.py          # voice every line (cached in out/vo/ by text+voice)
  python3 tts.py --dry                     # no API: estimate durations, no vo.wav (layout preview)
  python3 tts.py --voice <model id>        # override the voice
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
import wave

import numpy as np

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'out')
VO_DIR = os.path.join(OUT, 'vo')
SR = 48000

# lead-in before the first line, gap between lines, tail after the last line, minimum scene length
LAYOUT = {
    'intro': (0.10, 0.15, 0.45, 3.0),
    'recap': (0.35, 0.20, 1.10, 6.0),
    'outro': (0.30, 0.20, 1.80, 3.5),
}
TOOL_LAYOUT = (0.45, 0.20, 0.55, 6.5)


def fish_tts(text, voice, model, speed, key):
    body = json.dumps({
        'text': text, 'reference_id': voice, 'format': 'mp3', 'mp3_bitrate': 192,
        'normalize': True, 'latency': 'normal', 'prosody': {'speed': speed, 'volume': 0},
    }).encode()
    req = urllib.request.Request('https://api.fish.audio/v1/tts', data=body, method='POST', headers={
        'Authorization': f'Bearer {key}', 'Content-Type': 'application/json', 'model': model})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        sys.exit(f'Fish Audio {e.code}: {e.read()[:300].decode(errors="replace")}')


def to_trimmed_wav(src, dst):
    trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02'
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-ac', '1', '-ar', str(SR),
                    '-af', f'{trim},areverse,{trim},areverse', dst], check=True)


def read_wav(path):
    with wave.open(path) as w:
        return np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float64) / 32768


def estimate(say, speed):
    syl = sum(1 for c in say if '가' <= c <= '힣') + sum(1 for c in say if c.isascii() and c.isalnum()) * 0.6
    pauses = sum(say.count(p) for p in ',.!?')
    return syl / (6.6 * speed) + pauses * 0.22


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry', action='store_true')
    ap.add_argument('--voice')
    a = ap.parse_args()

    nar = json.load(open(os.path.join(ROOT, 'narration.json'), encoding='utf-8'))
    voice, model, speed = a.voice or nar['voice'], nar['model'], nar['speed']
    key = os.environ.get('FISH_API_KEY')
    if not a.dry and not key:
        sys.exit('FISH_API_KEY is not set (or pass --dry for a layout preview)')
    os.makedirs(VO_DIR, exist_ok=True)

    clips = []        # (abs start, samples)
    scenes, t = [], 0.0
    for sc in nar['scenes']:
        lead, gap, tail, min_dur = LAYOUT.get(sc['id'], TOOL_LAYOUT)
        lt, lines, marks = lead, [], {}
        for ln in sc['lines']:
            if a.dry:
                dur, samples = estimate(ln['say'], speed), None
            else:
                h = hashlib.sha1(f'{voice}|{model}|{speed}|{ln["say"]}'.encode()).hexdigest()[:16]
                mp3, wav = os.path.join(VO_DIR, h + '.mp3'), os.path.join(VO_DIR, h + '.wav')
                if not os.path.exists(mp3):
                    print('voicing:', ln['say'])
                    open(mp3, 'wb').write(fish_tts(ln['say'], voice, model, speed, key))
                if not os.path.exists(wav):
                    to_trimmed_wav(mp3, wav)
                samples = read_wav(wav)
                dur = len(samples) / SR
            # subtitle cards: share the line's time by character count
            cards = [c.strip() for c in ln['sub'].split('|')]
            weights = [max(1, len(c.replace(' ', ''))) for c in cards]
            ct, subs = lt, []
            for c, w in zip(cards, weights):
                d = dur * w / sum(weights)
                subs.append({'text': c, 'start': round(t + ct, 3), 'end': round(t + ct + d, 3)})
                ct += d
            for name, word in ln.get('marks', {}).items():
                idx = ln['say'].find(word)
                marks[name] = round(lt + dur * max(0, idx) / len(ln['say']), 3)
            lines.append({'start': round(t + lt, 3), 'end': round(t + lt + dur, 3), 'subs': subs, 'nosub': ln.get('nosub', False)})
            if samples is not None:
                clips.append((t + lt, samples))
            lt += dur + gap
        sdur = round(max(min_dur, lt - gap + tail), 3)
        scenes.append({'id': sc['id'], 'start': round(t, 3), 'dur': sdur, 'marks': marks, 'lines': lines})
        t += sdur

    tl = {'duration': round(t, 3), 'voiced': not a.dry, 'voice': voice, 'scenes': scenes}
    json.dump(tl, open(os.path.join(ROOT, 'timeline.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'timeline.json: {t:.2f}s, ' + ', '.join(f'{s["id"]} {s["dur"]:.1f}' for s in scenes))

    vo_path = os.path.join(OUT, 'vo.wav')
    if a.dry:
        if os.path.exists(vo_path):
            os.remove(vo_path)
        return
    vo = np.zeros(int(t * SR) + SR)
    for st, s in clips:
        i = int(st * SR)
        vo[i:i + len(s)] += s
    with wave.open(vo_path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(vo[:int(t * SR)], -1, 1) * 32767).astype('<i2').tobytes())
    print('wrote out/vo.wav')


if __name__ == '__main__':
    main()
