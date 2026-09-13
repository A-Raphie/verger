#!/usr/bin/env python3
"""Devpost project thumbnail: 3:2 (1500x1000), same system as the OG card."""
from PIL import Image, ImageDraw, ImageFont

W, H = 1500, 1000
PAPER = (248, 243, 234)
SURFACE = (255, 252, 245)
INK = (35, 47, 62)
MUTED = (125, 133, 140)
ACCENT = (250, 111, 0)
LINE = (228, 220, 203)

GEORGIA = "/System/Library/Fonts/Supplemental/Georgia.ttf"
GEORGIA_BOLD = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
MENLO = "/System/Library/Fonts/Menlo.ttc"

img = Image.new("RGB", (W, H), PAPER)
d = ImageDraw.Draw(img)
# inner hairline frame
d.rectangle([36, 36, W - 36, H - 36], outline=LINE, width=2)


def bell(draw, cx, cy, scale, color):
    s = scale
    draw.ellipse([cx - 3.2 * s, cy - 3.4 * s, cx + 3.2 * s, cy + 3.0 * s], fill=color)
    draw.rectangle([cx - 3.2 * s - 1, cy + 1.4 * s, cx + 3.2 * s + 1, cy + 3.0 * s + 1], fill=PAPER)
    draw.polygon(
        [(cx - 3.2 * s, cy + 0.8 * s), (cx + 3.2 * s, cy + 0.8 * s),
         (cx + 4.4 * s, cy + 2.6 * s), (cx - 4.4 * s, cy + 2.6 * s)],
        fill=color,
    )
    draw.ellipse([cx - 0.7 * s, cy - 4.3 * s, cx + 0.7 * s, cy - 2.9 * s], fill=color)
    draw.ellipse([cx - 0.9 * s, cy + 3.0 * s, cx + 0.9 * s, cy + 4.4 * s], fill=color)


def fit(text, path, size, max_w):
    f = ImageFont.truetype(path, size)
    while d.textlength(text, font=f) > max_w and size > 20:
        size -= 2
        f = ImageFont.truetype(path, size)
    return f


LX = 110
# wordmark + bell with badge on the dome's shoulder
f_word = ImageFont.truetype(GEORGIA_BOLD, 58)
d.text((LX, 96), "Verger", font=f_word, fill=INK)
bell(d, W - 190, 150, 20, INK)
s = 20
bcx, bcy, br = W - 190 + int(2.9 * s), 150 - int(3.1 * s), 32
d.ellipse([bcx - br, bcy - br, bcx + br, bcy + br], fill=ACCENT)

# headline, auto-fitted to the LONGEST line so nothing clips
max_w = W - 2 * LX - 40
f_head = fit("Every action on the record.", GEORGIA_BOLD, 124, max_w)
d.text((LX, 240), "Your inbox answered.", font=f_head, fill=INK)
d.text((LX, 240 + 150), "Every action on the record.", font=f_head, fill=INK)

f_sub = ImageFont.truetype(GEORGIA, 40)
d.text((LX, 610), "The front-desk agent for volunteer-run organizations.", font=f_sub, fill=(84, 91, 100))

f_mono = ImageFont.truetype(MENLO, 27)
d.text((LX, 760), "RIVERBANK COMMUNITY FRIDGE  ·  4 ANSWERED  ·  CHAIN VERIFIED", font=f_mono, fill=MUTED)

# pill button bottom-right
f_btn = ImageFont.truetype(GEORGIA_BOLD, 38)
label = "Open the desk"
tw = d.textlength(label, font=f_btn)
pw, ph = tw + 88, 92
px, py = W - 110 - pw, H - 110 - ph
d.rounded_rectangle([px, py, px + pw, py + ph], radius=ph // 2, fill=ACCENT)
d.text((px + 44, py + (ph - 46) // 2), label, font=f_btn, fill=(255, 255, 255))

img.save("/Users/raphie/Documents/Hackathons/verger/submission/thumbnail.png")
print("saved", img.size)
