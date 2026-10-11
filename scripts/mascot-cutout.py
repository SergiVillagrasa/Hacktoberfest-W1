#!/usr/bin/env python3
"""Cuts the flat lavender ground out of a mascot image and recolours its baked-in ground shadow.

usage: mascot-cutout.py in.webp out.webp [--shadow R,G,B]

The background colour is sampled from the top-left pixel. Pixels connected to the border that match it
become transparent, pixels matching the shadow colour become a soft neutral translucent shadow, and the
one-pixel fringe around the cut takes the colour of its inner neighbours so no lavender halo remains.
The result is trimmed to the artwork's bounding box plus 16px.
"""
import sys
from collections import deque
from PIL import Image

args = sys.argv[1:]
shadow = (179, 158, 229)
if '--shadow' in args:
    i = args.index('--shadow')
    shadow = tuple(int(v) for v in args[i + 1].split(','))
    del args[i : i + 2]
src, dst = args

img = Image.open(src).convert('RGB')
w, h = img.size
px = img.load()
bg = px[0, 0]

def dist(a, b):
    return max(abs(a[0] - b[0]), abs(a[1] - b[1]), abs(a[2] - b[2]))

BG_TOL, SHADOW_TOL = 26, 20
kind = [[0] * w for _ in range(h)]  # 0 subject, 1 background, 2 shadow
queue = deque((x, y) for x in range(w) for y in (0, h - 1))
queue.extend((x, y) for y in range(h) for x in (0, w - 1))
while queue:
    x, y = queue.popleft()
    if not (0 <= x < w and 0 <= y < h) or kind[y][x]:
        continue
    p = px[x, y]
    if dist(p, bg) <= BG_TOL or dist(p, shadow) <= SHADOW_TOL:
        kind[y][x] = 2 if dist(p, shadow) < dist(p, bg) else 1
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
op = out.load()
SHADOW_RGBA = (38, 58, 50, 40)
neighbours = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
for y in range(h):
    for x in range(w):
        k = kind[y][x]
        if k == 1:
            continue
        if k == 2:
            op[x, y] = SHADOW_RGBA
            continue
        edge = any(0 <= x + dx < w and 0 <= y + dy < h and kind[y + dy][x + dx] for dx, dy in neighbours)
        if not edge:
            op[x, y] = px[x, y] + (255,)
            continue
        inner = [px[x + dx, y + dy] for dx, dy in neighbours if 0 <= x + dx < w and 0 <= y + dy < h and not kind[y + dy][x + dx]]
        inner = [p for p in inner if dist(p, bg) > BG_TOL + 12 and dist(p, shadow) > SHADOW_TOL + 12] or inner or [px[x, y]]
        r, g, b = (sum(p[i] for p in inner) // len(inner) for i in range(3))
        op[x, y] = (r, g, b, 235)

box = out.getchannel('A').getbbox()
if box:
    pad = 16
    out = out.crop((max(box[0] - pad, 0), max(box[1] - pad, 0), min(box[2] + pad, w), min(box[3] + pad, h)))
out.save(dst, 'WEBP', quality=92, method=6)
print(f'{dst}: {out.size[0]}x{out.size[1]}')
