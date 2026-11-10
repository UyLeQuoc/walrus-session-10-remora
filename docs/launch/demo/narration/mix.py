"""Mix the ElevenLabs narration over the demo's soundtrack and mux it into the rendered videos (ADR-0155).

Usage (from the repo root, after `tts.py` wrote the clips):
    python3 -I docs/launch/demo/narration/mix.py <silent master.mp4>

Each line of script.json starts at its `at` second. The soundtrack is lowered to 0.4 and ducked under the
voice (sidechain, ratio 20); the voice is raised 6 dB. The mix is loudness-normalized to -14 LUFS and written
to out/narration/mix.wav. Then the video streams are copied, not re-encoded:
- out/remora-demo.mp4      (master, AAC 256k) from <silent master.mp4>
- out/remora-demo-web.mp4  (share copy, AAC 128k) from out/backup-nov6-175s-novoice/remora-demo-web.mp4
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "out")
CLIPS = os.path.join(OUT, "narration")
DUR = 174.95
VOICE_GAIN, MUSIC_GAIN = 2.0, 0.4

master = sys.argv[1]
script = json.load(open(os.path.join(HERE, "script.json")))
args = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", master]
f = []
for i, s in enumerate(script, 1):
    args += ["-i", os.path.join(CLIPS, f"{s['id']}.mp3")]
    ms = int(round(s["at"] * 1000))
    f.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={ms}|{ms}[v{i}]")
n = len(script)
f.append("".join(f"[v{i}]" for i in range(1, n + 1))
         + f"amix=inputs={n}:normalize=0:duration=longest,apad=whole_dur={DUR},volume={VOICE_GAIN}[voice]")
f.append("[voice]asplit=2[vk][vm]")
f.append(f"[0:a]aresample=48000,volume={MUSIC_GAIN}[mus]")
f.append("[mus][vk]sidechaincompress=threshold=0.008:ratio=20:attack=25:release=500:makeup=1[duck]")
f.append("[duck][vm]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[out]")
mix = os.path.join(CLIPS, "mix.wav")
subprocess.run(args + ["-filter_complex", ";".join(f), "-map", "[out]", "-t", str(DUR), "-c:a", "pcm_s16le", mix],
               check=True)

web_src = os.path.join(OUT, "backup-nov6-175s-novoice", "remora-demo-web.mp4")
for src, dst, rate in [(master, "remora-demo.mp4", "256k"), (web_src, "remora-demo-web.mp4", "128k")]:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", src, "-i", mix,
                    "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", rate, "-ar", "48000",
                    "-shortest", "-movflags", "+faststart", os.path.join(OUT, dst)], check=True)
print("wrote", mix, "and the two videos")
