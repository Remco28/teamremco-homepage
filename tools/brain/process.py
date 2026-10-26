# Smooth the traced paths, crop to the brain, simplify, and write compact JSON for the page.
import json, math
d = json.load(open("a.json"))
paths = [p for p in d["paths"] if len(p) >= 2]
def smooth(p, k=5, passes=3):
    for _ in range(passes):
        q = []
        for i in range(len(p)):
            r = min(k, i, len(p) - 1 - i)
            xs = p[i - r:i + r + 1]
            q.append([sum(a[0] for a in xs) / len(xs), sum(a[1] for a in xs) / len(xs)])
        p = q
    return p
def rdp(p, eps):
    if len(p) < 3: return p
    (x1, y1), (x2, y2) = p[0], p[-1]
    L = math.hypot(x2 - x1, y2 - y1) or 1e-9
    dmax, idx = 0, 0
    for i in range(1, len(p) - 1):
        dd = abs((y2 - y1) * p[i][0] - (x2 - x1) * p[i][1] + x2 * y1 - y2 * x1) / L
        if dd > dmax: dmax, idx = dd, i
    if dmax <= eps: return [p[0], p[-1]]
    return rdp(p[:idx + 1], eps)[:-1] + rdp(p[idx:], eps)
sm = [rdp(smooth(p), 0.35) for p in paths]
xs = [x for p in sm for x, _ in p]; ys = [y for p in sm for _, y in p]
m = 14
x0, y0 = min(xs) - m, min(ys) - m
W, H = round(max(xs) + m - x0), round(max(ys) + m - y0)
out = [[v for x, y in p for v in (round(x - x0, 1), round(y - y0, 1))] for p in sm]
json.dump({"w": W, "h": H, "lines": out}, open("brain.json", "w"), separators=(",", ":"))
print(W, H, len(out), sum(len(p) for p in sm), "points")
