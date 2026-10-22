#!/usr/bin/env bash
# Build out/video.mp4: narration → voice clips + timeline → cue sheet → soundtrack → master → frames → mux.
#   FISH_API_KEY=... ./make.sh      # voiced (Fish Audio)
#   DRY=1 ./make.sh                 # no voice: estimated timing, music + SFX only
set -euo pipefail
cd "$(dirname "$0")"
export NODE_PATH="${NODE_PATH:-$(npm root -g)}"

if [ -n "${DRY:-}" ]; then python3 tts.py --dry; else python3 tts.py; fi
node render.mjs --cues
python3 audio.py
ffmpeg -hide_banner -loglevel error -y -i out/audio_raw.wav \
  -af "loudnorm=I=-14:TP=-1.5:LRA=9" -ar 48000 out/audio.wav
node render.mjs --workers "${WORKERS:-4}" "$@"
