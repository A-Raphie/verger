#!/usr/bin/env python
"""Generate the favicon set + OG card on the Verger token palette.

Outputs (web/app/): icon.png 512, apple-icon.png 180, favicon.ico (multi-size),
opengraph-image.png 1200x630. Fonts: Georgia (serif display), Menlo (mono).
"""

from PIL import Image, ImageDraw, ImageFont

PAPER = (248, 243, 234)
SURFACE = (255, 252, 245)
INK = (35, 47, 62)
MUTED = (125, 133, 140)
ACCENT = (250, 111, 0)
LINE = (228, 220, 203)

GEORGIA = "/System/Library/Fonts/Supplemental/Georgia.ttf"
GEORGIA_BOLD = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
MENLO = "/System/Library/Fonts/Menlo.ttc"


def bell(draw, cx, cy, scale, color):
    """Geometric bell: dome + skirt + clapper, centered at (cx, cy)."""
    s = scale
    # dome: half-ellipse
    draw.ellipse([cx - 3.2 * s, cy - 3.4 * s, cx + 3.2 * s, cy + 3.0 * s], fill=color)
    # flatten the bottom half of the ellipse: paper rect below the skirt line
    draw.rectangle([cx - 3.2 * s - 1, cy + 1.4 * s, cx + 3.2 * s + 1, cy + 3.0 * s + 1], fill=PAPER)
    # skirt flare
    draw.polygon(
        [(cx - 3.2 * s, cy + 0.8 * s), (cx + 3.2 * s, cy + 0.8 * s),
         (cx + 4.4 * s, cy + 2.6 * s), (cx - 4.4 * s, cy + 2.6 * s)],
        fill=color,
    )
    # crown knob
    draw.ellipse([cx - 0.7 * s, cy - 4.3 * s, cx + 0.7 * s, cy - 2.9 * s], fill=color)
    # clapper
    draw.ellipse([cx - 0.9 * s, cy + 3.0 * s, cx + 0.9 * s, cy + 4.4 * s], fill=color)


def make_icon(size: int, path: str, with_badge: bool = False):
    img = Image.new("RGB", (size, size), PAPER)
    d = ImageDraw.Draw(img)
    bell(d, size / 2, size * 0.48, size / 16, INK)
    if with_badge:
        r = size * 0.16
        d.ellipse([size - 2 * r, 0, size, 2 * r], fill=ACCENT)
    img.save(path, "PNG")


def make_ico(path: str):
    imgs = []
    for size in (16, 32, 48):
        img = Image.new("RGBA", (size, size), PAPER + (255,))
        d = ImageDraw.Draw(img)
        bell(d, size / 2, size * 0.48, size / 16, INK)
        imgs.append(img)
    imgs[0].save(path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])


def make_og(path: str):
    w, h = 1200, 630
    img = Image.new("RGB", (w, h), PAPER)
    d = ImageDraw.Draw(img)
    # hairline frame
    d.rectangle([24, 24, w - 24, h - 24], outline=LINE, width=2)
    # wordmark
    f_word = ImageFont.truetype(GEORGIA_BOLD, 44)
    d.text((72, 72), "Verger", font=f_word, fill=INK)
    # headline
    f_head = ImageFont.truetype(GEORGIA_BOLD, 88)
    d.text((72, 200), "Your inbox answered.", font=f_head, fill=INK)
    d.text((72, 300), "Every action on the record.", font=f_head, fill=INK)
    # sub
    f_sub = ImageFont.truetype(GEORGIA, 30)
    d.text((72, 424), "The front-desk agent for volunteer-run organizations.", font=f_sub, fill=(84, 91, 100))
    # mono strip
    f_mono = ImageFont.truetype(MENLO, 22)
    d.text((72, 520), "RIVERBANK COMMUNITY FRIDGE  ·  4 ANSWERED  ·  CHAIN VERIFIED", font=f_mono, fill=MUTED)
    # accent pill bottom-right
    d.rounded_rectangle([w - 352, h - 122, w - 72, h - 58], radius=32, fill=ACCENT)
    f_btn = ImageFont.truetype(GEORGIA_BOLD, 28)
    d.text((w - 322, h - 106), "Open the desk", font=f_btn, fill=(255, 255, 255))
    # bell mark, top right
    bell(d, w - 120, 150, 14, INK)
    d.ellipse([w - 106, 84, w - 52, 138], fill=ACCENT)
    img.save(path, "PNG")


if __name__ == "__main__":
    import os
    app = os.path.join(os.path.dirname(__file__), "app")
    make_icon(512, os.path.join(app, "icon.png"), with_badge=True)
    make_icon(180, os.path.join(app, "apple-icon.png"))
    make_ico(os.path.join(app, "favicon.ico"))
    make_og(os.path.join(app, "opengraph-image.png"))
    print("assets written")
