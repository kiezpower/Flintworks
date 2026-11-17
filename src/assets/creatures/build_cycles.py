# Cuts the walk/fly cycle sheet (6 creatures x 4 phases) into cycles.png / cycles.json.
#   python3 build_cycles.py <cycles-sheet.png> <atlas-dir-with-atlas.json> <out-basename>
# Every phase is scaled so that the creature's body (the square root of its bounding box area,
# averaged over the four phases) matches the same creature's idle picture in atlas.png.
import json, math, os, sys
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(here, 'build.py')).read().split("A = cut(SRC")[0].replace("SRC, EXTRA, OUT = sys.argv[1:4]", ""))
sheet, atlas_dir, out = sys.argv[1:4]
old = json.load(open(os.path.join(atlas_dir, 'atlas.json')))['frames']
figs = cut(sheet, 6, 4)
KINDS = ['monster', 'bat', 'spider', 'slime', 'golem', 'fluffel']
SCALE = float(os.environ.get('SCALE', 0.6))  # the atlas itself is stored at 0.75 of the sheet; frames are drawn small
frames = {}
for c, kind in enumerate(KINDS):
    cells = [figs[(r, c)] for r in range(4)]
    body = lambda w, h: math.sqrt(w * h)
    ref = body(*old[kind]['idle'][2:4])
    mine = sum(body(im.width, im.height) for im, _ in cells) / 4
    k = ref / mine
    frames[kind] = {f'walk{r}': (im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS), ax * k) for r, (im, ax) in enumerate(cells)}
items = [(kind, name, im, ax) for kind, f in frames.items() for name, (im, ax) in f.items()]
items.sort(key=lambda i: -i[2].height)
AW = 1536; x = y = 2; shelf = 0; meta = {}; place = []
for kind, name, im, ax in items:
    if x + im.width + 2 > AW: x = 2; y += shelf + 2; shelf = 0
    place.append((im, x, y)); meta.setdefault(kind, {})[name] = [x, y, im.width, im.height, round(ax, 1)]
    x += im.width + 2; shelf = max(shelf, im.height)
AH = y + shelf + 2; atlas = Image.new('RGBA', (AW, AH), (0, 0, 0, 0))
for im, x, y in place: atlas.paste(im, (x, y))
atlas.save(out + '.png', optimize=True)
json.dump({'width': AW, 'height': AH, 'frames': meta}, open(out + '.json', 'w'), indent=1)
print(AW, AH, os.path.getsize(out + '.png'))
