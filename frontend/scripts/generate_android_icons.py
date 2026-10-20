"""Draws the Android launcher icons and splash screens (a wooden pit holding tamarind seeds).

Writes into frontend/android/app/src/main/res. Run from frontend/ after `npx cap add android`:

    python scripts/generate_android_icons.py
"""

import math
import re
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

RES = Path(__file__).resolve().parent.parent / "android/app/src/main/res"
SS = 4  # supersampling factor for smooth edges

BG_CENTER = (122, 35, 22)
BG_EDGE = (46, 11, 5)
PIT_CENTER = (139, 59, 34)
PIT_EDGE = (47, 14, 6)
GOLD = (217, 164, 65)
SEED_LIGHT = (192, 112, 63)
SEED_MID = (138, 61, 28)
SEED_DARK = (74, 29, 12)
OUTLINE = (42, 15, 6)

# Seed centres (fractions of the pit radius), lengths and tilt, echoing the in-game pit.
SEEDS = [
    (0.00, -0.58, 20), (0.56, -0.18, 70), (0.34, 0.50, 125),
    (-0.34, 0.50, 55), (-0.56, -0.18, 110),
]


def radial(size: int, inner: tuple[int, int, int], outer: tuple[int, int, int]) -> Image.Image:
    mask = Image.radial_gradient("L").resize((size, size))  # black centre -> white edge
    return Image.composite(
        Image.new("RGB", (size, size), outer), Image.new("RGB", (size, size), inner), mask
    )


def seed(length: int, tilt: float) -> Image.Image:
    """One glossy tamarind seed on a transparent tile."""
    pad = int(length * 0.3)
    w, h = length + pad, length + pad
    tile = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    ry = length * 0.36
    box = (w / 2 - length / 2, h / 2 - ry, w / 2 + length / 2, h / 2 + ry)
    d.ellipse(box, fill=SEED_MID + (255,), outline=OUTLINE + (255,), width=max(2, length // 28))
    inner = (box[0] + length * 0.08, box[1] + ry * 0.12, box[2] - length * 0.30, box[3] - ry * 0.45)
    d.ellipse(inner, fill=SEED_LIGHT + (255,))
    d = ImageDraw.Draw(tile)
    d.ellipse(
        (box[0] + length * 0.16, box[1] + ry * 0.2, box[0] + length * 0.46, box[1] + ry * 0.55),
        fill=(241, 201, 160, 150),
    )
    return tile.rotate(tilt, resample=Image.BICUBIC, expand=True)


def pit_with_seeds(size: int, pit_fraction: float) -> Image.Image:
    """A transparent square holding the gold-rimmed pit and its seeds, centred."""
    big = size * SS
    layer = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    r = int(big * pit_fraction)
    cx = cy = big // 2
    d = ImageDraw.Draw(layer)
    d.ellipse((cx - r - big // 60, cy - r - big // 60, cx + r + big // 60, cy + r + big // 60), fill=OUTLINE + (255,))
    pit = radial(2 * r, PIT_CENTER, PIT_EDGE).convert("RGBA")
    circle = Image.new("L", (2 * r, 2 * r), 0)
    ImageDraw.Draw(circle).ellipse((0, 0, 2 * r - 1, 2 * r - 1), fill=255)
    layer.paste(pit, (cx - r, cy - r), circle)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=GOLD + (255,), width=max(3, big // 48))
    length = int(r * 0.66)
    for fx, fy, tilt in SEEDS:
        s = seed(length, tilt)
        layer.alpha_composite(s, (int(cx + fx * r * 0.74 - s.width / 2), int(cy + fy * r * 0.74 - s.height / 2)))
    return layer.resize((size, size), Image.LANCZOS)


def square_icon(size: int) -> Image.Image:
    bg = radial(size, BG_CENTER, BG_EDGE).convert("RGBA")
    bg.alpha_composite(pit_with_seeds(size, 0.36))
    return bg


def round_icon(size: int) -> Image.Image:
    icon = square_icon(size)
    mask = Image.new("L", (size * SS, size * SS), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * SS - 1, size * SS - 1), fill=255)
    icon.putalpha(mask.resize((size, size), Image.LANCZOS))
    return icon


def foreground(size: int) -> Image.Image:
    """Adaptive-icon foreground: content stays inside the central 66/108 safe zone."""
    return pit_with_seeds(size, 0.29)


def splash(width: int, height: int) -> Image.Image:
    base = radial(max(width, height), BG_CENTER, BG_EDGE)
    base = base.crop(((base.width - width) // 2, (base.height - height) // 2, (base.width + width) // 2, (base.height + height) // 2))
    base = base.convert("RGBA")
    side = int(min(width, height) * 0.42)
    mark = pit_with_seeds(side, 0.46)
    base.alpha_composite(mark, ((width - side) // 2, (height - side) // 2))
    return base.convert("RGB")


def main() -> None:
    launcher = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    adaptive = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}
    for density, px in launcher.items():
        folder = RES / f"mipmap-{density}"
        square_icon(px).save(folder / "ic_launcher.png")
        round_icon(px).save(folder / "ic_launcher_round.png")
        foreground(adaptive[density]).save(folder / "ic_launcher_foreground.png")

    for path in RES.glob("drawable*/splash.png"):
        with Image.open(path) as existing:
            width, height = existing.size
        splash(width, height).save(path)

    colors = RES / "values/ic_launcher_background.xml"
    if colors.exists():
        text = colors.read_text(encoding="utf-8")
        colors.write_text(re.sub(r"#[0-9A-Fa-f]{6}", "#4A130A", text), encoding="utf-8")
    print(f"icons and splash screens written under {RES}")


if __name__ == "__main__":
    main()
