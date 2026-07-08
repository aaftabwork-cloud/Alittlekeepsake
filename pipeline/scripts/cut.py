import sys, os
from rembg import remove, new_session
from PIL import Image
outdir = sys.argv[1]
os.makedirs(outdir, exist_ok=True)
sess = new_session('u2net')
for p in sys.argv[2:]:
    img = Image.open(p).convert('RGBA')
    res = remove(img, session=sess)
    o = os.path.join(outdir, os.path.basename(p))
    res.save(o)
    print('OK', o, res.size)
