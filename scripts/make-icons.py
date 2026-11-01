"""Generate the app icons (a simple kettlebell) into public/icons.

Run: python3 scripts/make-icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
BG = (18, 60, 50)
FG = (120, 235, 190)
SUPERSAMPLE = 4


def kettlebell(size: int, pad_ratio: float) -> Image.Image:
    s = size * SUPERSAMPLE
    img = Image.new("RGB", (s, s), BG)
    d = ImageDraw.Draw(img)
    # Draw in a 180-unit box scaled by the padding so every size shares one design.
    scale = s * (1 - 2 * pad_ratio) / 180 * (180 / 130)
    cx, cy = s / 2, s / 2

    def u(x: float, y: float) -> tuple[float, float]:
        return cx + x * scale, cy + y * scale

    body_r = 52
    body_cy = 24
    handle_r = 34
    handle_cy = -22
    stroke_units = 13
    stroke = round(stroke_units * scale)

    d.ellipse((*u(-body_r, body_cy - body_r), *u(body_r, body_cy + body_r)), fill=FG)
    d.arc((*u(-handle_r, handle_cy - handle_r), *u(handle_r, handle_cy + handle_r)), 180, 360, fill=FG, width=stroke)
    for side in (-1, 1):
        # The arc's stroke grows inward from its bounding box, so the legs sit inside handle_r.
        outer = side * handle_r
        inner = side * (handle_r - stroke_units)
        d.rectangle(
            (*u(min(inner, outer), handle_cy), *u(max(inner, outer), body_cy - body_r * 0.5)),
            fill=FG,
        )
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    kettlebell(192, 0.12).save(OUT / "icon-192.png")
    kettlebell(512, 0.12).save(OUT / "icon-512.png")
    kettlebell(512, 0.22).save(OUT / "maskable-512.png")
    kettlebell(180, 0.14).save(OUT / "apple-touch-icon.png")


if __name__ == "__main__":
    main()
