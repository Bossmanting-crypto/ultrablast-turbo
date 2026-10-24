"""Draws the Android launcher icons and splash screens for Ultrablast Turbo.

Run from the repo root after `npx cap add android`:  python3 scripts/make-icons.py
Needs Pillow. The art: a gold boost ring with alien glyph ticks and a red jet blasting through it,
on the game's indigo night.
"""
import math, os, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
FONT = os.path.join(ROOT, 'node_modules', '@fontsource', 'bungee', 'files', 'bungee-latin-400-normal.woff')
NIGHT = (10, 11, 34)
GOLD = (255, 210, 122)
PEACH = (244, 198, 160)


def glow_layer(size, draw_fn, blur):
    layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(layer))
    return layer.filter(ImageFilter.GaussianBlur(blur))


def emblem(S, bg=True):
    """The icon art at S x S. bg=False leaves a transparent background (adaptive foreground)."""
    im = Image.new('RGBA', (S, S), NIGHT + (255,) if bg else (0, 0, 0, 0))
    c = S / 2
    if bg:  # warm sunset glow behind the ring
        g = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(g)
        for i in range(24, 0, -1):
            r = S * 0.46 * i / 24
            a = int(10 + 5 * (24 - i))
            d.ellipse([c - r, c - r * 0.9 + S * 0.04, c + r, c + r * 0.9 + S * 0.04], fill=(255, 110 + 4 * (24 - i), 70, min(a, 140)))
        im.alpha_composite(g.filter(ImageFilter.GaussianBlur(S * 0.05)))
        # purple storm arc
        st = glow_layer(S, lambda d: d.arc([S * -0.25, S * 0.55, S * 1.25, S * 1.9], 200, 340, fill=(180, 107, 255, 220), width=int(S * 0.05)), S * 0.012)
        im.alpha_composite(st)
    R = S * 0.30
    ring_box = [c - R, c - R, c + R, c + R]
    im.alpha_composite(glow_layer(S, lambda d: d.ellipse(ring_box, outline=GOLD + (255,), width=int(S * 0.05)), S * 0.03))
    d = ImageDraw.Draw(im)
    d.ellipse(ring_box, outline=(255, 236, 190, 255), width=int(S * 0.028))
    # glyph ticks around the ring
    rnd = random.Random(7)
    for i in range(18):
        a = i / 18 * math.tau
        r0, r1 = R * 1.12, R * (1.2 + rnd.random() * 0.1)
        w = max(1, int(S * 0.012))
        x0, y0 = c + math.cos(a) * r0, c + math.sin(a) * r0
        x1, y1 = c + math.cos(a) * r1, c + math.sin(a) * r1
        d.line([x0, y0, x1, y1], fill=GOLD + (230,), width=w)
        if i % 3 == 0:
            rr = S * 0.014
            d.ellipse([x1 - rr, y1 - rr, x1 + rr, y1 + rr], outline=GOLD + (230,), width=w)
    # the jet: a red dart diving up-right through the ring, with a gold exhaust streak
    ang = math.radians(-40)
    def P(px, py):
        x = px * S; y = -py * S
        return (c + x * math.cos(ang) - y * math.sin(ang), c + x * math.sin(ang) + y * math.cos(ang))
    exhaust = glow_layer(S, lambda dd: dd.line([P(0, -0.42), P(0, -0.08)], fill=(255, 190, 90, 255), width=int(S * 0.06)), S * 0.025)
    im.alpha_composite(exhaust)
    d = ImageDraw.Draw(im)
    d.line([P(0, -0.40), P(0, -0.08)], fill=(255, 244, 214, 255), width=int(S * 0.022))
    body = [P(0, 0.26), P(0.05, 0.05), P(0.19, -0.06), P(0.18, -0.1), P(0.04, -0.06), P(0.06, -0.14), P(0, -0.11), P(-0.06, -0.14), P(-0.04, -0.06), P(-0.18, -0.1), P(-0.19, -0.06), P(-0.05, 0.05)]
    shadow = glow_layer(S, lambda dd: dd.polygon(body, fill=(0, 0, 0, 160)), S * 0.012)
    im.alpha_composite(shadow)
    d = ImageDraw.Draw(im)
    d.polygon(body, fill=(216, 38, 47, 255), outline=(255, 214, 180, 255))
    d.polygon([P(0, 0.24), P(0.03, 0.05), P(0, 0.0), P(-0.03, 0.05)], fill=(255, 120, 110, 255))
    d.polygon([P(0, 0.17), P(0.018, 0.1), P(0, 0.07), P(-0.018, 0.1)], fill=(20, 20, 42, 255))
    return im


def save_icons():
    big = emblem(1024, True)
    fg = emblem(1024, False)
    sizes = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
    for dens, s in sizes.items():
        d = os.path.join(RES, 'mipmap-' + dens)
        sq = big.resize((s, s), Image.LANCZOS)
        mask = Image.new('L', (s * 4, s * 4), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, s * 4 - 1, s * 4 - 1], radius=s * 0.9, fill=255)
        rounded = Image.new('RGBA', (s, s), (0, 0, 0, 0)); rounded.paste(sq, (0, 0), mask.resize((s, s), Image.LANCZOS))
        rounded.save(os.path.join(d, 'ic_launcher.png'))
        circ = Image.new('L', (s * 4, s * 4), 0); ImageDraw.Draw(circ).ellipse([0, 0, s * 4 - 1, s * 4 - 1], fill=255)
        rnd = Image.new('RGBA', (s, s), (0, 0, 0, 0)); rnd.paste(sq, (0, 0), circ.resize((s, s), Image.LANCZOS))
        rnd.save(os.path.join(d, 'ic_launcher_round.png'))
        # adaptive foreground: 108dp canvas, art inside the 66dp safe zone
        fs = int(s * 108 / 48)
        canvas = Image.new('RGBA', (fs, fs), (0, 0, 0, 0))
        art = fg.resize((int(fs * 0.72), int(fs * 0.72)), Image.LANCZOS)
        canvas.alpha_composite(art, ((fs - art.width) // 2, (fs - art.height) // 2))
        canvas.save(os.path.join(d, 'ic_launcher_foreground.png'))
    with open(os.path.join(RES, 'values', 'ic_launcher_background.xml'), 'w') as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0A0B22</color>\n</resources>\n')


def splash(w, h):
    im = Image.new('RGBA', (w, h), NIGHT + (255,))
    S = int(min(w, h) * 0.42)
    e = emblem(S, False)
    im.alpha_composite(e, ((w - S) // 2, int(h * 0.42 - S / 2)))
    try:
        size = max(14, int(min(w, h) * 0.075))
        font = ImageFont.truetype(FONT, size)
        d = ImageDraw.Draw(im)
        text = 'ULTRABLAST TURBO'
        tw = d.textlength(text, font=font)
        y = int(h * 0.42 + S / 2 + size * 0.4)
        d.text(((w - tw) / 2 + 3, y + 4), text, font=font, fill=(90, 18, 54, 255))
        d.text(((w - tw) / 2, y), text, font=font, fill=GOLD + (255,))
    except OSError:
        pass
    return im.convert('RGB')


def save_splashes():
    for root, dirs, files in os.walk(RES):
        if 'splash.png' in files:
            p = os.path.join(root, 'splash.png')
            w, h = Image.open(p).size
            splash(w, h).save(p)


if __name__ == '__main__':
    save_icons()
    save_splashes()
    emblem(512, True).save(os.path.join(ROOT, 'docs', 'icon.png')) if os.path.isdir(os.path.join(ROOT, 'docs')) else None
    print('icons and splash screens written')
