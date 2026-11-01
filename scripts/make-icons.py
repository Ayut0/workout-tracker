"""Generate the app icons (a simple barbell) into public/icons.

Run: python3 scripts/make-icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
BG = (22, 32, 42)
FG = (127, 162, 245)


def barbell(size: int, pad_ratio: float) -> Image.Image:
    img = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(img)
    s = size
    pad = s * pad_ratio
    inner = s - 2 * pad
    cy = s / 2
    bar_h = inner * 0.06
    d.rounded_rectangle((pad, cy - bar_h / 2, s - pad, cy + bar_h / 2), radius=bar_h / 2, fill=FG)
    plates = [(0.10, 0.50), (0.22, 0.36)]
    for x_ratio, h_ratio in plates:
        w = inner * 0.09
        h = inner * h_ratio
        for left in (pad + inner * x_ratio, s - pad - inner * x_ratio - w):
            d.rounded_rectangle((left, cy - h / 2, left + w, cy + h / 2), radius=w * 0.3, fill=FG)
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    barbell(192, 0.12).save(OUT / "icon-192.png")
    barbell(512, 0.12).save(OUT / "icon-512.png")
    barbell(512, 0.22).save(OUT / "maskable-512.png")
    barbell(180, 0.14).save(OUT / "apple-touch-icon.png")


if __name__ == "__main__":
    main()
