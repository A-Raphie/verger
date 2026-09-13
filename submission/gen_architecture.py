#!/usr/bin/env python3
"""Verger architecture diagram for the Devpost submission (required upload)."""
from PIL import Image, ImageDraw, ImageFont

W, H = 1600, 1000
PAPER = (248, 243, 234)
INK = (20, 32, 31)
MUTED = (94, 106, 112)
ACCENT = (250, 111, 0)
ACCENT_SOFT = (255, 236, 219)
CARD = (255, 253, 248)

img = Image.new("RGB", (W, H), PAPER)
d = ImageDraw.Draw(img)

def font(size, bold=False):
    path = "/System/Library/Fonts/Helvetica.ttc" if not bold else "/System/Library/Fonts/HelveticaNeue.ttc"
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", size)

f_title = font(34, True)
f_sub = font(20)
f_box_t = font(23, True)
f_box_b = font(19)
f_small = font(17)

def box(x, y, w, h, title, lines, accent=False):
    fill = ACCENT_SOFT if accent else CARD
    outline = ACCENT if accent else INK
    d.rounded_rectangle([x, y, x + w, y + h], radius=10, fill=fill, outline=outline, width=2 if accent else 1)
    d.text((x + 18, y + 14), title, fill=INK, font=f_box_t)
    yy = y + 14 + 30
    for ln in lines:
        d.text((x + 18, yy), ln, fill=MUTED, font=f_box_b)
        yy += 25

def arrow(x1, y1, x2, y2, accent=False):
    color = ACCENT if accent else INK
    d.line([x1, y1, x2, y2], fill=color, width=2)
    # arrowhead
    dx, dy = x2 - x1, y2 - y1
    import math
    ang = math.atan2(dy, dx)
    for s in (2.6, -2.6 + math.pi):
        pass
    import math as m
    a1 = ang + m.radians(25)
    a2 = ang - m.radians(25)
    L = 12
    d.polygon([ (x2, y2), (x2 - L*m.cos(a1), y2 - L*m.sin(a1)), (x2 - L*m.cos(a2), y2 - L*m.sin(a2)) ], fill=color)

d.text((60, 44), "Verger architecture", fill=INK, font=f_title)
d.text((60, 88), "Front-desk agent for volunteer-run organizations · Strands Agents SDK (TypeScript) · Netlify", fill=MUTED, font=f_sub)

# Lane 1: inbox and rounds
box(60, 160, 340, 130, "Organization inbox", ["Netlify Blobs mailbox", "seeded demo messages"])
box(60, 330, 340, 150, "Round worker", ["Netlify Function, one message", "per invocation, chained", "cron tick every 10 minutes"])
box(60, 520, 340, 110, "Single-flight lock", ["owner token, 60s TTL", "cron and desk never double-hold"])
arrow(230, 290, 230, 330)
arrow(230, 480, 230, 520)

# Lane 2: the agent
box(520, 160, 420, 190, "Strands Agent (TypeScript)", ["@strands-agents/sdk Agent", "gpt-oss-20b via Groq endpoint", "fresh agent per chunk, no", "cross-chunk conversation state"])
box(520, 400, 420, 130, "Tools", ["send_mail  ·  GATED", "no_reply  ·  open"])
arrow(730, 350, 730, 400)
d.text((438, 376), "one round = one message", fill=MUTED, font=f_small)

# The gate (accent)
box(520, 600, 420, 170, "TrusteeGate  ·  THE GATE", ["BeforeToolCallEvent hook:", "allowlist check, then Strands", "interrupt: stopReason = interrupt.", "Nothing is sent without a human."], accent=True)
arrow(730, 530, 730, 600, accent=True)
arrow(640, 350, 640, 400)

# Lane 3: trustee and receipts
box(1080, 160, 440, 190, "Trustee desk (Next.js)", ["decision bell swings on a hold", "one-click approve or deny", "approve sends the reviewed draft", "verbatim; deny retires the session"])
box(1080, 400, 440, 130, "Decisions", ["approve -> send_mail executes", "deny -> paused session retired"])
arrow(940, 245, 1080, 245, accent=True)
d.text((950, 215), "hold for review", fill=ACCENT, font=f_small)
arrow(1300, 350, 1300, 400)

box(1080, 600, 440, 170, "Receipt ledger", ["append-only sha256 hash chain,", "self-verifying on every append;", "the desk shows the ledger's own", "verdict, never re-derives it"])
arrow(1300, 530, 1300, 600)

# bottom stores strip
box(60, 760, 1460, 90, "Netlify Blobs stores", ["mailbox  ·  sent  ·  pending decisions  ·  round messages  ·  single-flight lock  ·  receipt chain (chain.json published)"])
arrow(230, 630, 230, 760)
arrow(730, 770, 730, 850)
arrow(1300, 770, 1300, 850)

d.text((60, 920), "Every autonomous action leaves a receipt a human can audit. The trustee holds the send button.", fill=MUTED, font=f_small)

img.save("/Users/raphie/Documents/Hackathons/verger/submission/architecture.png")
print("saved", img.size)
