# Cuts the catapult parts sheet (base left, arm right) into catapult.png / catapult.json.
#   python3 build_catapult.py <sheet.png> <out-basename>
# Axle, pivot and cup are given in sheet pixels (measured once) and stored relative to each part.
import json, os, sys
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(here, '..', 'creatures', 'build.py')).read().split("A = cut(SRC")[0].replace("SRC, EXTRA, OUT = sys.argv[1:4]", ""))
sheet, out = sys.argv[1:3]
figs = cut(sheet, 2, 1)
base, arm = figs[(0, 0)][0], figs[(0, 1)][0]
AXLE = (505, 230)            # the hole at the top of the A-frame
PIVOT, CUP, TAIL = (1050, 415), (1448, 395), 765   # the arm's pivot ring, the cup's centre, the counterweight's left edge
k = 0.5                       # stored at half the sheet's size
bx, by = base.origin; ax, ay = arm.origin
atlas = Image.new('RGBA', (round(base.width * k) + round(arm.width * k) + 6, max(round(base.height * k), round(arm.height * k)) + 4), (0, 0, 0, 0))
b = base.resize((round(base.width * k), round(base.height * k)), Image.LANCZOS); a = arm.resize((round(arm.width * k), round(arm.height * k)), Image.LANCZOS)
atlas.paste(b, (2, 2)); atlas.paste(a, (b.width + 4, 2))
meta = {'width': atlas.width, 'height': atlas.height,
        'base': [2, 2, b.width, b.height], 'axle': [round((AXLE[0] - bx) * k, 1), round((AXLE[1] - by) * k, 1)],
        'arm': [b.width + 4, 2, a.width, a.height], 'pivot': [round((PIVOT[0] - ax) * k, 1), round((PIVOT[1] - ay) * k, 1)],
        'cup': [round((CUP[0] - ax) * k, 1), round((CUP[1] - ay) * k, 1)], 'tail': round((TAIL - ax) * k, 1)}
atlas.save(out + '.png', optimize=True); json.dump(meta, open(out + '.json', 'w'), indent=1); print(meta, os.path.getsize(out + '.png'))
