/* The projects page: a spark travels the brain and lights up one project at a time. */
(async () => {
  let PROJECTS, ART;
  try {
    const get = (u, o) => fetch(u, o).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
    const [pj, art] = await Promise.all([get("/projects.json", { cache: "no-cache" }), get("brain.json")]);
    PROJECTS = (pj.projects || []).filter((p) => p.url && p.title && p.listed !== false);
    ART = art;
  } catch {
    const none = document.getElementById("none");
    none.textContent = "Couldn’t load the projects just now. Reload to try again.";
    none.hidden = false;
    return;
  }
  /* a project's About page comes first, when it has one */
  const linkOf = (p) => p.aboutUrl || p.url;
  /* "épée" and "epee" are both tags so search finds either; show only one */
  const plainTags = (tags = []) => tags.filter((t, i) => tags.findIndex((u) => u.normalize("NFD").replace(/[\u0300-\u036f]/g, "") === t.normalize("NFD").replace(/[\u0300-\u036f]/g, "")) === i);
  const verbOf = (p) => (p.aboutUrl ? "read the story →" : p.desktop ? "get it →" : "open →");

  /* the brain: traced from Frank's generated line drawing, smoothed, in its own pixel space */
  const W = ART.w, H = ART.h;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const toPath = (pts) => { const p = new Path2D(); pts.forEach((q, i) => (i ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y))); return p; };
  const lines = ART.lines.map((f) => { const p = []; for (let i = 0; i < f.length; i += 2) p.push({ x: f[i], y: f[i + 1] }); return p; });
  const ART_PATH = new Path2D();
  lines.forEach((l) => l.forEach((q, i) => (i ? ART_PATH.lineTo(q.x, q.y) : ART_PATH.moveTo(q.x, q.y))));

  /* one network of points every few pixels along the lines; lines that share an end are joined there */
  const V = [], adj = [], ends = new Map();
  const addV = (p) => { V.push(p); adj.push([]); return V.length - 1; };
  const join = (a, b) => { if (a !== b && !adj[a].includes(b)) { adj[a].push(b); adj[b].push(a); } };
  const endV = (p) => { const k = p.x + "," + p.y; if (!ends.has(k)) ends.set(k, addV(p)); return ends.get(k); };
  lines.forEach((l) => {
    let prev = endV(l[0]);
    for (let i = 1; i < l.length; i++) {
      const a = l[i - 1], b = l[i], n = Math.floor(dist(a, b) / 5);
      for (let k = 1; k <= n; k++) { const v = addV({ x: a.x + ((b.x - a.x) * k) / (n + 1), y: a.y + ((b.y - a.y) * k) / (n + 1) }); join(prev, v); prev = v; }
      if (i < l.length - 1) { const v = addV(b); join(prev, v); prev = v; }
    }
    join(prev, endV(l[l.length - 1]));
  });
  function bfs(from) {
    const prev = new Int32Array(V.length).fill(-2), d = new Int32Array(V.length).fill(-1), q = [from];
    prev[from] = -1; d[from] = 0;
    for (let h = 0; h < q.length; h++) { const k = q[h]; for (const n of adj[k]) if (d[n] < 0) { d[n] = d[k] + 1; prev[n] = k; q.push(n); } }
    return { prev, d };
  }

  /* spots go only where a spark can arrive and leave: not on the dead-end folds */
  const deg = adj.map((a) => a.length), gone = new Uint8Array(V.length), leaves = [];
  deg.forEach((d, i) => { if (d <= 1) leaves.push(i); });
  while (leaves.length) { const v = leaves.pop(); if (gone[v]) continue; gone[v] = 1; for (const n of adj[v]) if (!gone[n] && --deg[n] <= 1) leaves.push(n); }
  const main = (() => { let best = { d: [] }, size = 0; const tried = new Uint8Array(V.length);
    for (let i = 0; i < V.length; i++) { if (gone[i] || tried[i]) continue; const r = bfs(i); let n = 0; r.d.forEach((x, j) => { if (x >= 0) { tried[j] = 1; n++; } }); if (n > size) { size = n; best = r; } }
    return best.d; })();
  const spots = [];
  const pool = V.map((p, i) => i).filter((i) => !gone[i] && main[i] >= 0).sort(() => Math.random() - 0.5);
  for (const v of pool) { if (spots.length >= 20) break; if (spots.every((s) => dist(V[s], V[v]) > 120)) spots.push(v); }

  function route(a, b) {
    const { prev } = bfs(a);
    if (prev[b] === -2) return null;
    let pts = [];
    for (let k = b; k !== -1; k = prev[k]) pts.unshift(V[k]);
    for (let pass = 0; pass < 2; pass++) {
      pts = pts.map((p, i) => {
        const k = Math.min(4, i, pts.length - 1 - i);
        let x = 0, y = 0;
        for (let j = i - k; j <= i + k; j++) { x += pts[j].x; y += pts[j].y; }
        return { x: x / (2 * k + 1), y: y / (2 * k + 1) };
      });
    }
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i], pts[i - 1]));
    return { pts, cum, len: cum[cum.length - 1] || 0 };
  }

  const stage = document.getElementById("stage");
  const base = document.getElementById("base"), fx = document.getElementById("fx");
  const bctx = base.getContext("2d"), fctx = fx.getContext("2d");
  const glow = document.getElementById("glow"), thought = document.getElementById("thought");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* drawing: the brain is painted once; only the spark is redrawn while it moves */
  let scale = 1, dpr = 1;
  const lw = (px) => px / Math.max(scale, 0.4);
  function size() {
    const w = stage.clientWidth, h = (w * H) / W;
    scale = w / W; dpr = Math.min(2, devicePixelRatio || 1);
    for (const c of [base, fx]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    drawBase();
    if (!busy) place(hist[idx]);
  }
  function glowStroke(c, path, rgb, widths) {
    widths.forEach(([px, a]) => { c.strokeStyle = `rgba(${rgb},${a})`; c.lineWidth = lw(px); c.stroke(path); });
  }
  function drawBase() {
    const c = bctx;
    c.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    c.clearRect(0, 0, W, H);
    c.lineCap = "round"; c.lineJoin = "round";
    glowStroke(c, ART_PATH, "196,206,228", [[1.8, 0.5]]);
  }

  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 64;
  { const s = sprite.getContext("2d"), g = s.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,250,232,1)"); g.addColorStop(0.18, "rgba(255,222,150,.9)"); g.addColorStop(0.45, "rgba(255,180,80,.28)"); g.addColorStop(1, "rgba(255,180,80,0)");
    s.fillStyle = g; s.fillRect(0, 0, 64, 64); }

  function clearFx() { fx.style.transition = "none"; fx.style.opacity = 1; fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.clearRect(0, 0, fx.width, fx.height); }
  /* the path stays lit amber behind the spark; the brightest part follows it */
  function drawSpark(r, head, tail, alpha) {
    fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.clearRect(0, 0, fx.width, fx.height);
    fctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    fctx.lineCap = "round"; fctx.lineJoin = "round";
    const { pts, cum } = r;
    let hi = 0;
    while (hi < pts.length - 1 && cum[hi + 1] <= head) hi++;
    const lit = toPath(pts.slice(0, hi + 1));
    glowStroke(fctx, lit, "255,180,80", [[7, 0.07]]);
    glowStroke(fctx, lit, "255,214,140", [[1.8, 0.45]]);
    for (let k = hi; k > 0 && head - cum[k] < tail; k--) {
      const a = Math.pow(Math.max(0, 1 - (head - cum[k]) / tail), 1.6) * alpha;
      fctx.beginPath(); fctx.moveTo(pts[k - 1].x, pts[k - 1].y); fctx.lineTo(pts[k].x, pts[k].y);
      fctx.strokeStyle = `rgba(255,190,90,${a * 0.2})`; fctx.lineWidth = lw(12); fctx.stroke();
      fctx.strokeStyle = `rgba(255,224,160,${a})`; fctx.lineWidth = lw(3); fctx.stroke();
    }
    const p = pts[hi], q = pts[Math.min(hi + 1, pts.length - 1)];
    const f = cum[hi + 1] > cum[hi] ? Math.min(1, (head - cum[hi]) / (cum[hi + 1] - cum[hi])) : 0;
    const x = p.x + (q.x - p.x) * f, y = p.y + (q.y - p.y) * f, rad = lw(22);
    fctx.globalAlpha = alpha; fctx.drawImage(sprite, x - rad, y - rad, rad * 2, rad * 2); fctx.globalAlpha = 1;
  }
  function travel(r, done) {
    clearFx();
    const speed = 300, tail = 230, t0 = performance.now(), endT = (r.len / speed) * 1000, fadeT = 500;
    const frame = (now) => {
      const t = now - t0, fade = Math.max(0, (t - endT) / fadeT);
      drawSpark(r, Math.min(r.len, (t / 1000) * speed), tail * (1 - fade * 0.7), 1 - fade);
      if (t < endT + fadeT) requestAnimationFrame(frame);
      else { fx.style.transition = "opacity 3.5s ease"; fx.style.opacity = 0; done(); }
    };
    requestAnimationFrame(frame);
  }

  /* the lit spot and its spark line */
  function place(entry) {
    const n = V[spots[entry.node]], x = n.x * scale, y = n.y * scale;
    const sw = stage.clientWidth, sh = stage.clientHeight;
    glow.style.left = x + "px"; glow.style.top = y + "px";
    const bw = thought.offsetWidth, bh = thought.offsetHeight;
    const left = Math.max(4, Math.min(sw - bw - 4, x - bw / 2));
    let top = y > sh * 0.5 ? y - bh - 24 : y + 24;
    top = Math.max(4, Math.min(sh - bh - 4, top));
    if (sw < 560) top = sh + 12; /* phones: the box sits under the brain, not on it */
    thought.style.left = left + "px"; thought.style.top = top + "px";
  }
  function showThought() {
    const e = hist[idx];
    document.getElementById("tLine").textContent = e.p.spark || e.p.blurb;
    document.getElementById("tTitle").textContent = e.p.title;
    document.getElementById("tVerb").textContent = verbOf(e.p);
    thought.href = linkOf(e.p);
    place(e);
    glow.classList.add("on"); thought.classList.add("on");
  }
  function hideThought() { glow.classList.remove("on"); thought.classList.remove("on"); }

  /* random projects with no repeats until each has had a turn */
  let bag = [];
  function nextProject(prev) {
    if (!bag.length) {
      bag = PROJECTS.slice().sort(() => Math.random() - 0.5);
      if (bag.length > 1 && bag[bag.length - 1] === prev) bag.unshift(bag.pop());
    }
    return bag.pop();
  }
  function pickSpot(from) { /* somewhere a short journey away, not next door and not across the whole brain */
    const { d } = bfs(spots[from]);
    const ok = spots.map((v, i) => i).filter((i) => i !== from && d[spots[i]] >= 70 && d[spots[i]] <= 260);
    const pool = ok.length ? ok : spots.map((v, i) => i).filter((i) => i !== from);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /* history: back and forward walk the sparks already seen */
  let hist = [{ node: Math.floor(Math.random() * spots.length), p: nextProject() }], idx = 0, busy = false, timer = 0, held = false;
  const DWELL = 7000;
  const prevBtn = document.getElementById("prev"), nextBtn = document.getElementById("next"), count = document.getElementById("count");
  function nav() { prevBtn.disabled = idx === 0; count.textContent = `${idx + 1} / ${hist.length}`; }
  function arm(ms = DWELL) { clearTimeout(timer); if (!held && !document.hidden) timer = setTimeout(() => step(1), ms); }
  function goTo(i) {
    const a = hist[idx].node, b = hist[i].node;
    busy = true; clearTimeout(timer); idx = i; nav(); hideThought();
    setTimeout(() => {
      const done = () => { busy = false; showThought(); arm(); };
      const r = reduce || a === b ? null : route(spots[a], spots[b]);
      if (r) travel(r, done); else setTimeout(done, 250);
    }, 500);
  }
  function fresh(node) {
    hist = hist.slice(0, idx + 1);
    hist.push({ node: node ?? pickSpot(hist[idx].node), p: nextProject(hist[idx].p) });
    goTo(hist.length - 1);
  }
  function step(d) {
    if (busy) return;
    if (d < 0) { if (idx > 0) goTo(idx - 1); }
    else if (idx < hist.length - 1) goTo(idx + 1);
    else fresh();
  }
  prevBtn.addEventListener("click", () => step(-1));
  nextBtn.addEventListener("click", () => step(1));
  fx.addEventListener("click", (e) => {
    if (busy) return;
    const r = fx.getBoundingClientRect(), at = { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
    const cur = hist[idx].node;
    const near = spots.map((v, i) => i).filter((i) => i !== cur).sort((i, j) => dist(V[spots[i]], at) - dist(V[spots[j]], at))[0];
    fresh(near);
  });
  const hold = (on) => { held = on; if (on) clearTimeout(timer); else if (!busy) arm(4000); };
  thought.addEventListener("pointerenter", () => hold(true));
  thought.addEventListener("pointerleave", () => hold(false));
  thought.addEventListener("focus", () => hold(true));
  thought.addEventListener("blur", () => hold(false));
  document.addEventListener("visibilitychange", () => { if (document.hidden) clearTimeout(timer); else if (!busy) arm(4000); });
  new ResizeObserver(size).observe(stage);

  size(); nav(); showThought(); arm();

  /* the plain list */
  const list = document.getElementById("list"), q = document.getElementById("q"), none = document.getElementById("none");
  const rows = PROJECTS.slice().sort((a, b) => a.title.localeCompare(b.title)).map((p) => {
    const li = document.createElement("li"), a = document.createElement("a");
    a.href = linkOf(p);
    a.innerHTML = '<span class="t"></span><span class="b"></span><span class="tags"></span>';
    a.querySelector(".t").textContent = p.title;
    a.querySelector(".b").textContent = p.blurb;
    a.querySelector(".tags").textContent = [p.desktop ? p.desktop + " app" : "", ...plainTags(p.tags).slice(0, 3)].filter(Boolean).join(" · ");
    li.append(a); list.append(li);
    return { li, text: [p.title, p.blurb, p.spark, ...(p.about || []), ...(p.tags || [])].join(" ").toLowerCase() };
  });
  q.addEventListener("input", () => {
    const s = q.value.trim().toLowerCase();
    let shown = 0;
    rows.forEach((r) => { r.li.hidden = !!s && !r.text.includes(s); if (!r.li.hidden) shown++; });
    none.hidden = shown > 0;
  });
})();
