#!/usr/bin/env python3
"""Rebuild cropped PNG floorplans from pmt PDFs (Ghostscript and Pillow required)."""

import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

FRONTEND = Path(__file__).resolve().parents[1]
PLANS = FRONTEND / "src/lib/data/floorplans/plans.json"
OUTPUT = FRONTEND / "public/floorplans"


def export():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="735-floorplans-") as temp:
        for plan in json.loads(PLANS.read_text()):
            rendered = Path(temp) / f"{plan['id']}.png"
            subprocess.run(
                [
                    "gs", "-q", "-dSAFER", "-dBATCH", "-dNOPAUSE",
                    "-sDEVICE=png16m", "-r220", "-dTextAlphaBits=4",
                    "-dGraphicsAlphaBits=4", f"-sOutputFile={rendered}",
                    str(FRONTEND.parent / "pmt" / plan["source"]),
                ], check=True,
            )
            with Image.open(rendered) as original:
                picture = original.convert("RGB")
            # Masks remove only annotation text. Structural red lines stay intact.
            draw = ImageDraw.Draw(picture)
            for box in plan["labelMasks"]:
                draw.rectangle(tuple(v * 2 for v in box), fill="white")
            # Remove the red installation circles without erasing nearby black walls.
            pixels = picture.load()
            for pin in plan["pins"]:
                cx, cy = pin["x"] * 2, pin["y"] * 2
                for y in range(cy - 27, cy + 28):
                    for x in range(cx - 27, cx + 28):
                        r, g, b = pixels[x, y]
                        if r > g + 35 and r > b + 35:
                            pixels[x, y] = (255, 255, 255)
            picture = picture.crop(tuple(v * 2 for v in plan["crop"]))
            picture.save(OUTPUT / f"{plan['id']}.png", optimize=True)
            print(f"{plan['id']}: {picture.width}×{picture.height}")


if __name__ == "__main__":
    export()
