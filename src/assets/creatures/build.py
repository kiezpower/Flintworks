# Cuts the generated sheets into a transparent, packed atlas plus JSON metadata.
import json, sys
from collections import deque
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
SRC, EXTRA, OUT = sys.argv[1:4]
def cut(path, cols, rows, thresh=34):
    im = Image.open(path).convert('RGB'); W, H = im.size
    work = im.copy(); key = (255, 0, 255)
    for x in range(0, W, 8):
        for y in (0, H - 1):
            if work.getpixel((x, y)) != key: ImageDraw.floodfill(work, (x, y), key, thresh=thresh)
    for y in range(0, H, 8):
        for x in (0, W - 1):
            if work.getpixel((x, y)) != key: ImageDraw.floodfill(work, (x, y), key, thresh=thresh)
    a = np.asarray(work); fg = ~((a[..., 0] == 255) & (a[..., 1] == 0) & (a[..., 2] == 255))
    mask = Image.fromarray((fg * 255).astype('uint8'))
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))  # trim the grey fringe
    # label figures on a dilated quarter-size mask so splashes and debris stay with their owner
    small = mask.resize((W // 4, H // 4), Image.BILINEAR).point(lambda v: 255 if v > 40 else 0).filter(ImageFilter.MaxFilter(3))
    s = np.asarray(small) > 0; lab = np.zeros(s.shape, int); n = 0; sizes = {}
    for y0 in range(s.shape[0]):
        for x0 in range(s.shape[1]):
            if s[y0, x0] and not lab[y0, x0]:
                n += 1; lab[y0, x0] = n; q = deque([(y0, x0)]); c = 0
                while q:
                    y, x = q.popleft(); c += 1
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        yy, xx = y + dy, x + dx
                        if 0 <= yy < s.shape[0] and 0 <= xx < s.shape[1] and s[yy, xx] and not lab[yy, xx]:
                            lab[yy, xx] = n; q.append((yy, xx))
                sizes[n] = c
    big = sorted(sizes, key=sizes.get, reverse=True)[:cols * rows]
    assert len(big) == cols * rows, (path, len(big))
    # loose bits (drips, rocks, shards) join the nearest figure when close enough
    pts = {l: np.argwhere(lab == l)[::7] for l in big}
    for l, c in sizes.items():
        if l in big or c < 6: continue
        p = np.argwhere(lab == l).mean(0)
        d = {b: np.abs(pts[b] - p).sum(1).min() for b in big}
        b = min(d, key=d.get)
        if d[b] < 16: lab[lab == l] = b
    full = np.asarray(Image.fromarray(lab.astype('int32')).resize((W, H), Image.NEAREST))
    alpha = np.asarray(mask); rgb = np.asarray(im); figs = {}
    for l in big:
        am = np.where(full == l, alpha, 0).astype('uint8')
        ys, xs = np.nonzero(am > 100); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        cx, cy = xs.mean(), ys.mean()
        col, row = int(cx * cols / W), int(cy * rows / H)
        assert (row, col) not in figs, (path, row, col)
        figs[(row, col)] = Image.fromarray(np.dstack([rgb[y0:y1, x0:x1], am[y0:y1, x0:x1]])), cx - x0
    return figs
A = cut(SRC, 6, 3); E = cut(EXTRA, 4, 2)
frames = {}
for c, k in enumerate(['monster', 'bat', 'spider', 'slime', 'golem', 'fluffel']):
    frames[k] = {p: A[(r, c)] for r, p in enumerate(['idle', 'move', 'attack'])}
frames['fish'] = {'idle': E[(0, 0)], 'move': E[(1, 0)]}
frames['queen'] = {'idle': E[(0, 1)], 'attack': E[(1, 1)]}
frames['iceking'] = {'idle': E[(0, 2)], 'attack': E[(1, 2)]}
frames['worm'] = {'idle': E[(0, 3)], 'body': E[(1, 3)]}
SCALE = float(sys.argv[4]) if len(sys.argv) > 4 else 1
items = [(k, p, im.resize((round(im.width * SCALE), round(im.height * SCALE)), Image.LANCZOS) if SCALE != 1 else im, ax * SCALE) for k, f in frames.items() for p, (im, ax) in f.items()]
items.sort(key=lambda i: -i[2].height)
AW = 1536; x = y = 2; shelf = 0; meta = {}; place = []
for k, p, im, ax in items:
    if x + im.width + 2 > AW: x = 2; y += shelf + 2; shelf = 0
    place.append((im, x, y)); meta.setdefault(k, {})[p] = [x, y, im.width, im.height, round(ax, 1)]
    x += im.width + 2; shelf = max(shelf, im.height)
AH = y + shelf + 2; atlas = Image.new('RGBA', (AW, AH), (0, 0, 0, 0))
for im, x, y in place: atlas.paste(im, (x, y))
atlas.save(OUT + '/atlas.png', optimize=True)
json.dump({'width': AW, 'height': AH, 'frames': meta}, open(OUT + '/atlas.json', 'w'), indent=1)
print(AW, AH, {k: {p: v[2:4] for p, v in f.items()} for k, f in meta.items()})
