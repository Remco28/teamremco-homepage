# Trace the white lines of a line-art brain into centerline paths.
# uv run --with numpy --with scikit-image --with pillow python trace.py in.png out-prefix
import sys, json
import numpy as np
from PIL import Image, ImageDraw
from skimage.morphology import skeletonize, remove_small_objects

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("L")
a = np.asarray(im, dtype=np.float32)
ink = a > 110
ink = remove_small_objects(ink, 40)
sk = skeletonize(ink)
H, W = sk.shape
OFF = [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]
pix = set(zip(*np.nonzero(sk)))
def nbrs(p):
    y, x = p
    return [(y+dy, x+dx) for dy, dx in OFF if (y+dy, x+dx) in pix]
deg = {p: len(nbrs(p)) for p in pix}
nodes = {p for p, d in deg.items() if d != 2}
# walk every path between nodes
seen_edges, paths = set(), []
for n in nodes:
    for m in nbrs(n):
        if (n, m) in seen_edges: continue
        path, prev, cur = [n], n, m
        seen_edges.add((n, m))
        while cur not in nodes:
            path.append(cur)
            nxt = [q for q in nbrs(cur) if q != prev and q not in path[-3:]]
            if not nxt: break
            prev, cur = cur, nxt[0]
        path.append(cur)
        seen_edges.add((cur, path[-2]))
        paths.append(path)
# loops with no node at all (closed rings)
covered = {p for path in paths for p in path}
for p in pix - covered:
    if p in covered: continue
    ring, prev, cur = [p], None, p
    while True:
        nxt = [q for q in nbrs(cur) if q != prev and q not in ring[-3:]]
        if not nxt or nxt[0] == p: break
        prev, cur = cur, nxt[0]; ring.append(cur)
        if len(ring) > 20000: break
    covered |= set(ring); paths.append(ring + [p])
# drop tiny spurs: short paths with a free end
def plen(path): return sum(np.hypot(path[i][0]-path[i-1][0], path[i][1]-path[i-1][1]) for i in range(1, len(path)))
kept = [p for p in paths if not (plen(p) < 18 and (deg[p[0]] == 1 or deg[p[-1]] == 1))]
print(f"skeleton px {len(pix)}, nodes {len(nodes)}, paths {len(paths)}, kept {len(kept)}")
print("junctions", sum(1 for p,d in deg.items() if d >= 3), "free ends", sum(1 for p,d in deg.items() if d == 1))
json.dump({"w": W, "h": H, "paths": [[[int(x), int(y)] for y, x in p] for p in kept]}, open(out + ".json", "w"))
# overlay: original dimmed, traced paths in color
base = Image.open(src).convert("RGB").point(lambda v: v * 0.35)
d = ImageDraw.Draw(base)
cols = [(255,80,80),(80,220,120),(90,160,255),(255,200,60),(220,100,255),(60,230,230)]
for i, p in enumerate(kept):
    d.line([(x, y) for y, x in p], fill=cols[i % len(cols)], width=3)
for p, dg in deg.items():
    y, x = p
    if dg >= 3: d.ellipse([x-4, y-4, x+4, y+4], outline=(255,255,255))
    elif dg == 1: d.ellipse([x-4, y-4, x+4, y+4], fill=(255,255,0))
base.save(out + "-overlay.png")
