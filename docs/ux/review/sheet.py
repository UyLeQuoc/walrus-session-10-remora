"""U14 (ADR-0103): contact sheets and the word table for a review round.

    python3 docs/ux/review/sheet.py <round>

Writes r<round>/sheet-<device>-<n>.jpg (labelled thumbnails of every above-the-fold shot, 20 a sheet)
and prints the word table: each page's interface words above the fold and in total, against round 0.
"""

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent


def sheets(rdir: Path, device: str) -> None:
    shots = sorted(p for p in (rdir / device).glob("*.jpg") if ".full" not in p.name)
    per, cols, tw = 20, 4, 480
    for n in range(0, len(shots), per):
        batch = shots[n : n + per]
        thumbs = []
        for p in batch:
            im = Image.open(p).convert("RGB")
            th = int(im.height * tw / im.width)
            thumbs.append((p.stem, im.resize((tw, th))))
        rows = (len(thumbs) + cols - 1) // cols
        row_h = [max(t[1].height for t in thumbs[r * cols : (r + 1) * cols]) + 26 for r in range(rows)]
        sheet = Image.new("RGB", (cols * (tw + 8) + 8, sum(row_h) + 8), (18, 18, 22))
        draw = ImageDraw.Draw(sheet)
        y = 8
        for r in range(rows):
            for c, (name, th) in enumerate(thumbs[r * cols : (r + 1) * cols]):
                x = 8 + c * (tw + 8)
                draw.text((x, y), name, fill=(230, 230, 235))
                sheet.paste(th, (x, y + 18))
            y += row_h[r]
        out = rdir / f"sheet-{device}-{n // per + 1}.jpg"
        sheet.save(out, quality=78)
        print(f"wrote {out.relative_to(HERE)}")


def words(rdir: Path, base: Path) -> None:
    for device in ("desktop", "phone"):
        now_f, base_f = rdir / device / "words.json", base / device / "words.json"
        if not now_f.exists():
            continue
        now = json.loads(now_f.read_text())
        then = json.loads(base_f.read_text()) if base_f.exists() else {}
        print(f"\n### Words, {device}\n")
        print("| Page | Above the fold (r0 → now) | Total (r0 → now) |")
        print("|---|---|---|")
        t0 = t1 = 0
        for page in sorted(set(now) | set(then)):
            a, b = then.get(page), now.get(page)
            fmt = lambda k: f"{a[k] if a else '–'} → {b[k] if b else '–'}"
            print(f"| {page} | {fmt('above')} | {fmt('total')} |")
            if a and b:
                t0 += a["total"]
                t1 += b["total"]
        if t0:
            print(f"| **All pages in both** | | **{t0} → {t1} ({(t1 - t0) * 100 // t0:+d}%)** |")


if __name__ == "__main__":
    r = sys.argv[1] if len(sys.argv) > 1 else "0"
    rdir = HERE / f"r{r}"
    for device in ("desktop", "phone", "light-desktop"):
        if (rdir / device).exists():
            sheets(rdir, device)
    words(rdir, HERE / "r0")
