"""Generate one ElevenLabs clip per scene line. Reads ELEVENLABS_API_KEY from the repo's .env.

Usage: python3 -I docs/launch/demo/narration/tts.py docs/launch/demo/narration/script.json docs/launch/demo/out/narration [id ...]   (ids limit which lines are (re)generated)
Never prints the key.
"""
import json
import os
import subprocess
import sys
import urllib.request

ENV = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../../../.env")
VOICE = "cjVigY5qzO86Huf0OWal"  # Eric - Smooth, Trustworthy (premade)
MODEL = "eleven_multilingual_v2"

key = next(l.split("=", 1)[1].strip() for l in open(ENV) if l.startswith("ELEVENLABS_API_KEY="))
script = json.load(open(sys.argv[1]))
out = sys.argv[2]
only = set(sys.argv[3:])
os.makedirs(out, exist_ok=True)
print("chars:", sum(len(s["text"]) for s in script if not only or s["id"] in only))

for i, s in enumerate(script):
    if only and s["id"] not in only:
        continue
    prev_t = script[i - 1]["text"] if i else None
    next_t = script[i + 1]["text"] if i + 1 < len(script) else None
    body = {
        "text": s["text"],
        "model_id": MODEL,
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.8, "style": 0.15, "use_speaker_boost": True},
    }
    if prev_t:
        body["previous_text"] = prev_t
    if next_t:
        body["next_text"] = next_t
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128",
        data=json.dumps(body).encode(),
        headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
    except urllib.error.HTTPError as e:
        print(s["id"], "HTTP", e.code, e.read()[:300])
        continue
    path = os.path.join(out, f"{s['id']}.mp3")
    open(path, "wb").write(data)
    dur = float(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]).strip())
    flag = "OVER" if dur > s["max"] else "ok"
    print(f"{s['id']:12s} {dur:5.2f}s / max {s['max']:5.2f}  {flag}")
