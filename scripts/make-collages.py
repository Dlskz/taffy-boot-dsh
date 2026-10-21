#!/usr/bin/env python3
# ============================================================
# 塔菲启动动画 · 拼贴图生成
#
# 用 backgrounds/ 里的原图合成几张“信息量更大”的拼贴图，
# 让启动动画一轮能看到更多塔菲：
#   collage-grid.jpg     2×2 多脸合集
#   collage-strip.jpg    三联竖幅
#   collage-polaroid.jpg 拍立得贴墙
#   collage-banner.jpg   模糊背景 + 居中人像
#
# 用法：python3 make-collages.py
# 生成后会写入 backgrounds/，再跑 sync-assets.py 即可。
# ============================================================
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BG_DIR = os.path.join(ROOT, "backgrounds")
OUT_W, OUT_H = 900, 1125
SEED = 20261020

SOURCES = [
    f for f in sorted(os.listdir(BG_DIR))
    if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))
    and not f.startswith(".")
    and not f.startswith("collage-")   # 避免拿上一轮的拼贴当素材，产生套娃
] if os.path.isdir(BG_DIR) else []


def load(name):
    return Image.open(os.path.join(BG_DIR, name)).convert("RGB")


def gradient(w, h, top=(255, 246, 251), bottom=(255, 214, 232)):
    img = Image.new("RGB", (w, h), top)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(h - 1, 1)
        d.line([(0, y), (w, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(top, bottom)))
    return img


def crop_cover(im, tw, th, anchor=0.34):
    im = im.convert("RGB")
    sw, sh = im.size
    scale = max(tw / sw, th / sh)
    nw, nh = max(tw, int(sw * scale + 0.5)), max(th, int(sh * scale + 0.5))
    im = im.resize((nw, nh), Image.LANCZOS)
    left = (nw - tw) // 2
    top = int((nh - th) * anchor)
    return im.crop((left, top, left + tw, top + th))


def rounded(im, radius):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=radius, fill=255)
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out


def with_shadow(tile, blur=16, alpha=62):
    pad = blur * 3
    canvas = Image.new("RGBA", (tile.width + pad * 2, tile.height + pad * 2), (0, 0, 0, 0))
    sh = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle(
        [pad, pad + 6, pad + tile.width, pad + 6 + tile.height], radius=26, fill=(128, 44, 84, alpha)
    )
    canvas.alpha_composite(sh.filter(ImageFilter.GaussianBlur(blur)))
    canvas.alpha_composite(tile, (pad, pad))
    return canvas


def paste_center(base, im, cx, cy):
    base.alpha_composite(im, (int(cx - im.width / 2), int(cy - im.height / 2)))


def sparkles(draw, w, h, n=14, seed=1):
    rnd = random.Random(seed)
    for _ in range(n):
        x, y = rnd.randint(20, w - 20), rnd.randint(20, h - 20)
        r = rnd.choice((3, 4, 5))
        col = rnd.choice(((255, 255, 255, 190), (255, 170, 205, 170), (255, 226, 240, 200)))
        draw.ellipse([x - r, y - r, x + r, y + r], fill=col)


def collage_grid(picks):
    base = gradient(OUT_W, OUT_H).convert("RGBA")
    d = ImageDraw.Draw(base)
    sparkles(d, OUT_W, OUT_H, 12, 3)
    cell, gap = 396, 26
    x0 = (OUT_W - (cell * 2 + gap)) // 2
    y0 = (OUT_H - (cell * 2 + gap)) // 2
    for i in range(4):
        im = crop_cover(load(picks[i]), cell, cell, anchor=0.42)
        tile = with_shadow(rounded(im, 26))
        cx = x0 + (i % 2) * (cell + gap) + cell / 2
        cy = y0 + (i // 2) * (cell + gap) + cell / 2
        paste_center(base, tile, cx, cy)
    return base


def collage_strip(picks):
    base = gradient(OUT_W, OUT_H).convert("RGBA")
    sparkles(ImageDraw.Draw(base), OUT_W, OUT_H, 10, 7)
    cw, ch, gap = 286, 500, 22
    total = cw * 3 + gap * 2
    x0 = (OUT_W - total) // 2
    cy = OUT_H // 2
    for i in range(3):
        im = crop_cover(load(picks[i]), cw, ch, anchor=0.42)
        tile = with_shadow(rounded(im, 22))
        paste_center(base, tile, x0 + i * (cw + gap) + cw / 2, cy)
    return base


def collage_polaroid(picks):
    base = gradient(OUT_W, OUT_H, (255, 250, 253), (255, 226, 240)).convert("RGBA")
    sparkles(ImageDraw.Draw(base), OUT_W, OUT_H, 16, 11)
    rnd = random.Random(SEED + 5)
    positions = [(240, 330), (600, 300), (300, 700), (620, 700), (450, 520)]
    for i, (px, py) in enumerate(positions[:len(picks)]):
        im = crop_cover(load(picks[i]), 300, 360, anchor=0.42)
        card = Image.new("RGBA", (im.width + 28, im.height + 52), (255, 255, 255, 255))
        card.paste(im, (14, 14))
        card = rounded(card, 10)
        ang = rnd.uniform(-7, 7)
        card = card.rotate(ang, expand=True, resample=Image.BICUBIC)
        tile = with_shadow(card, 14, 55)
        paste_center(base, tile, px + 180, py + 200)
    return base


def collage_banner(picks):
    backdrop = load(picks[0]).resize((OUT_W, OUT_H), Image.LANCZOS)
    backdrop = backdrop.filter(ImageFilter.GaussianBlur(18))
    overlay = Image.new("RGBA", (OUT_W, OUT_H), (255, 235, 245, 92))
    backdrop = backdrop.convert("RGBA")
    backdrop.alpha_composite(overlay)
    im = crop_cover(load(picks[1]), 560, 700, anchor=0.42)
    tile = with_shadow(rounded(im, 30), 20, 85)
    paste_center(backdrop, tile, OUT_W / 2, OUT_H / 2)
    sparkles(ImageDraw.Draw(backdrop), OUT_W, OUT_H, 12, 17)
    return backdrop


def main():
    if len(SOURCES) < 4:
        print("素材不足（至少 4 张），跳过拼贴生成")
        return
    rnd = random.Random(SEED)
    picks = rnd.sample(SOURCES, min(len(SOURCES), 9))

    jobs = [
        ("collage-grid.jpg", collage_grid([picks[0], picks[1], picks[2], picks[3]])),
        ("collage-strip.jpg", collage_strip([picks[4], picks[5], picks[6]])),
        ("collage-polaroid.jpg", collage_polaroid([picks[1], picks[6], picks[2], picks[8], picks[3]])),
        ("collage-banner.jpg", collage_banner([picks[7], picks[0]])),
    ]
    for name, img in jobs:
        out = img.convert("RGB")
        path = os.path.join(BG_DIR, name)
        out.save(path, "JPEG", quality=85, optimize=True)
        print(f"  · {name}  ({out.width}×{out.height}, {os.path.getsize(path)//1024} KB)")
    print(f"完成：{len(jobs)} 张拼贴图 -> {BG_DIR}")


if __name__ == "__main__":
    main()
