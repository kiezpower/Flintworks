# Cuts a generated icon sheet into a transparent atlas of tightly cropped icons.
#   python3 build.py <sheet.png> <cols> <rows> <out-basename> name1 name2 ...
# (uses the figure cutter of ../creatures/build.py; needs Pillow and NumPy)
import json, os, sys
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(here, '..', 'creatures', 'build.py')).read().split("A = cut(SRC")[0].replace("SRC, EXTRA, OUT = sys.argv[1:4]", ""))
sheet, cols, rows, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
names = sys.argv[5:]
figs = cut(sheet, cols, rows)
CELL = int(os.environ.get('CELL', 100)); atlas = Image.new('RGBA', (cols * CELL, rows * CELL), (0, 0, 0, 0)); meta = {}
for i, n in enumerate(names):
    im, _ = figs[(i // cols, i % cols)]
    k = min((CELL - 4) / im.width, (CELL - 4) / im.height, 1); im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    x = (i % cols) * CELL + (CELL - im.width) // 2; y = (i // cols) * CELL + (CELL - im.height) // 2
    atlas.paste(im, (x, y)); meta[n] = [x, y, im.width, im.height]
atlas.save(out + '.png', optimize=True)
json.dump({'width': atlas.width, 'height': atlas.height, 'frames': meta}, open(out + '.json', 'w'), indent=1)
