/* Team Remco homepage: a small console you can open from the hero. Vanilla JS. */
(function () {
  "use strict";
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  $("#year").textContent = String(new Date().getFullYear());

  /* ---------- console: small, honest, playful utilities ---------- */
  const out = $("#termOutput"), form = $("#termForm"), input = $("#consoleInput"), termStatus = $("#termStatus");
  const history = []; let hIndex = -1;

  function print(text, cls) {
    const div = document.createElement("div");
    if (cls) div.className = cls;
    div.textContent = text;
    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
  }
  function printRich(build) {
    const div = document.createElement("div");
    build(div);
    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
  }
  /* the project list lives in projects.json, shared with the projects page */
  let PROJECTS = [], projectsFailed = false;
  const projectsReady = fetch("projects.json", { cache: "no-cache" })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => {
      PROJECTS = (d.projects || []).filter(p => p.id && p.url)
        .map(p => ({ ...p, name: p.id, blurb: p.blurb || "", about: p.about || [], tags: p.tags || [] }));
      DESTS = [...PROJECTS, LAUNCHPAD];
    })
    .catch(() => { projectsFailed = true; });
  const LAUNCHPAD = { name: "launchpad", url: "https://frank-hp-elitedesk-800-g5-desktop-mini.taild9032.ts.net:8766/", blurb: "private launchpad (Tailscale only)",
    about: ["The Team Remco private launchpad. It only opens on the Team Remco Tailscale network."], tags: ["private", "tailscale"] };
  let DESTS = [LAUNCHPAD];
  const COMMANDS = ["help", "ls", "cd", "cat", "grep", "calc", "password", "sisyphus", "clear"];
  const fold = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  function grepLines(p) { return [p.blurb, ...p.about, "tags: " + p.tags.join(", ")]; }
  function printLink(p, withBlurb) {
    printRich(div => {
      const a = document.createElement("a");
      a.href = p.url; a.textContent = p.name;
      div.appendChild(document.createTextNode("  "));
      div.appendChild(a);
      if (withBlurb) div.appendChild(document.createTextNode("  — " + p.blurb));
    });
  }
  function genPassword(len) {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ", lower = "abcdefghijkmnopqrstuvwxyz",
      digits = "23456789", symbols = "!@#$%^&*()-_=+[]{};:,.?";
    const all = upper + lower + digits + symbols;
    const rand = (n) => {
      const b = new Uint32Array(n);
      crypto.getRandomValues(b);
      return Array.from(b, (v) => v % all.length);
    };
    // guarantee one of each class (most common policy: upper+lower+digit+symbol)
    const pick = (s) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length];
    const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
    const rest = rand(len - chars.length).map((k) => all[k]);
    const outArr = chars.concat(rest);
    // Fisher–Yates with crypto randomness
    for (let k = outArr.length - 1; k > 0; k--) {
      const j = crypto.getRandomValues(new Uint32Array(1))[0] % (k + 1);
      [outArr[k], outArr[j]] = [outArr[j], outArr[k]];
    }
    return outArr.join("");
  }
  /* ----- sisyphus: one silent push, procedurally drawn so it stays crisp ----- */
  let sisyphusBusy = false, sisyphusTimers = [];
  function sisyphusCancel() {
    sisyphusTimers.forEach(clearTimeout);
    sisyphusTimers = [];
    sisyphusBusy = false;
  }
  function drawSisyphus(o) {
    // o: { s (0 bottom → 1 peak), pose, boulderS, dust:[], sparkle:bool, sweat:bool, pebble:bool, hop, spin }
    const W = 32, H = 10, GROUND = H - 1;
    const g = Array.from({ length: H }, () => Array(W).fill(" "));
    // Gentle dome: half-cosine rising from the flats (x=6,row 8) to the
    // summit plateau (x>=21,row 4). Low and rolling on purpose — a steep
    // cone always reads as stairs in ASCII, a mound reads as a hill.
    const surf = (x) => {
      const t = Math.max(0, Math.min(1, (x - 6) / 18));
      return 8 - Math.round(4 * (0.5 - 0.5 * Math.cos(Math.PI * t)));
    };
    const put = (x, y, ch) => {
      x = Math.round(x); y = Math.round(y);
      if (y >= 0 && y < H && x >= 0 && x < W && ch !== " ") g[y][x] = ch;
    };
    // stars + moon (fixed, deterministic)
    [[4, 0], [11, 1], [18, 0], [24, 1], [30, 0]].forEach(([x, y]) => { g[y][x] = "·"; });
    g[0][1] = "☾";
    // peak cairn: the silent goal
    const px = 28;
    put(px, surf(px) - 1, "∴");
    // round hill: one char per column, glyph follows local steepness so the
    // dome eases out of the flats instead of staircasing up a diagonal
    for (let x = 0; x < W; x++) {
      const y = surf(x);
      const steep = surf(x - 1) - surf(x + 1);
      g[y][x] = steep <= 0 ? "_" : steep === 1 ? "/" : "|";
    }
    for (let x = 0; x < W; x++) g[GROUND][x] = "_";
    // faint earth: sparse deterministic texture below the skyline so the
    // dome reads as solid mass instead of a staircase outline
    for (let x = 0; x < W; x++) {
      for (let y = surf(x) + 1; y < GROUND; y++) {
        if ((x * 5 + y * 9) % 13 === 0) g[y][x] = "·";
      }
    }
    // grass tufts clinging to the dome (actors walk past them)
    [[4, '"'], [14, '"'], [30, '"']].forEach(([x, ch]) => put(x, surf(x) - 1, ch));
    // pebble kicked loose underfoot
    if (o.pebble) {
      const fx = Math.round(o.fx), fy = Math.round(o.fy);
      if (g[fy] && g[fy][fx - 2]) g[fy][fx - 2] = "·";
      if (g[fy] && g[fy][fx - 3]) g[fy][fx - 3] = ".";
    }
    // dust trail behind a rolling boulder
    (o.dust || []).forEach(([dx, dy, ch]) => {
      dx = Math.round(dx); dy = Math.round(dy);
      if (dy >= 0 && dy < H && dx >= 0 && dx < W && g[dy][dx] === " ") g[dy][dx] = ch;
    });
    // boulder: a proper rock, 5 wide × 3 tall. The speck drifts side to
    // side with `spin`, so the stone visibly rolls instead of sliding.
    const bx = Math.round(8 + (o.boulderS === undefined ? o.s : o.boulderS) * 17);
    const by = Math.max(2, Math.min(GROUND, surf(bx) + (o.hop ? -1 : 0)));
    const speck = (((o.spin || 0) % 3) + 3) % 3 - 1;
    // hollow the rock first so grass/dust never show through it
    for (let dx = -1; dx <= 1; dx++) {
      const x = bx + dx;
      if (by - 1 >= 0 && by - 1 < H && x >= 0 && x < W) g[by - 1][x] = " ";
    }
    put(bx - 1, by - 2, "_"); put(bx, by - 2, "_"); put(bx + 1, by - 2, "_");
    put(bx - 2, by - 1, "/"); put(bx + speck, by - 1, "·"); put(bx + 2, by - 1, "\\");
    put(bx - 2, by, "\\");
    put(bx - 1, by, "_"); put(bx, by, "_"); put(bx + 1, by, "_");
    put(bx + 2, by, "/");
    // figure, anchored at feet (fx, fy on the slope)
    const fx = Math.round(o.fx), fy = Math.round(o.fy);
    const set = (dx, dy, ch) => {
      const x = fx + dx, y = fy + dy;
      if (y >= 0 && y < H && x >= 0 && x < W && ch !== " ") g[y][x] = ch;
    };
    if (o.pose === "push" || o.pose === "strain") {
      const lean = o.pose === "strain" ? 1 : 0;
      set(lean, -2, "o");
      set(-1 + lean, -1, "-"); set(lean, -1, "|"); set(1 + lean, -1, "\\");
      set(-1, 0, "/"); set(1, 0, "\\");
      if (o.sweat) set(2 + lean, -3, "'");
    } else if (o.pose === "triumph") {
      set(-1, -2, "\\"); set(0, -2, "o"); set(1, -2, "/");
      set(0, -1, "|");
      set(-1, 0, "/"); set(1, 0, "\\");
    } else if (o.pose === "reach") {
      set(0, -2, "o");
      set(-1, -1, "-"); set(0, -1, "|"); set(1, -1, "-");
      set(-1, 0, "/"); set(1, 0, "\\");
    } else if (o.pose === "watch") {
      set(0, -2, "o");
      set(0, -1, "|");
      set(-1, 0, "/"); set(1, 0, "\\");
    } else if (o.pose === "slump") {
      set(0, -2, " ");
      set(0, -1, "_"); set(1, -1, "o");
      set(-1, 0, "/"); set(0, 0, "|"); set(1, 0, "\\");
    } else if (o.pose === "sit") {
      set(0, -1, "o");
      set(-1, 0, "("); set(0, 0, "_"); set(1, 0, ")");
    }
    // triumph sparkles around the peak
    if (o.sparkle) {
      [[px - 2, surf(px) - 3, "*"], [px + 1, surf(px) - 2, "+"], [px, surf(px) - 4, "*"]]
        .forEach(([x, y, ch]) => { if (y >= 0 && y < H && x >= 0 && x < W) g[y][x] = ch; });
    }
    return g.map((r) => r.join("").replace(/\s+$/, "")).join("\n");
  }
  function sisyphusStatic() {
    const s = 0.45, bx = 9 + s * 15, fx = bx - 4.4;
    const surf = (x) => {
      const t = Math.max(0, Math.min(1, (x - 6) / 18));
      return 8 - Math.round(4 * (0.5 - 0.5 * Math.cos(Math.PI * t)));
    };
    return drawSisyphus({ s, fx, fy: surf(fx), spin: 1 });
  }
  function runSisyphus() {
    if (sisyphusBusy) { print("sisyphus is already pushing.", "dim"); return; }
    if (prefersReduced.matches) {
      // reduced motion: one honest still, no animation
      printRich((div) => {
        const pre = document.createElement("pre");
        pre.style.margin = "0";
        pre.textContent = sisyphusStatic();
        div.appendChild(pre);
      });
      return;
    }
    sisyphusBusy = true;
    termStatus.textContent = "pushing…";
    const preWrap = document.createElement("div");
    const pre = document.createElement("pre");
    pre.style.margin = "0";
    preWrap.appendChild(pre);
    out.appendChild(preWrap);
    const surf = (x) => {
      const t = Math.max(0, Math.min(1, (x - 6) / 18));
      return 8 - Math.round(4 * (0.5 - 0.5 * Math.cos(Math.PI * t)));
    };
    const show = (frame) => {
      pre.textContent = drawSisyphus(frame);
      out.scrollTop = out.scrollHeight;
    };
    const steps = [];
    // climb: 14 frames, ease-out, breathing hitches at 5/9/13, sweat + pebbles
    for (let i = 0; i <= 13; i++) {
      const s = i / 13;
      const bx = 9 + s * 15, fx = bx - 4.4;
      steps.push({
        at: i * 170 + (i >= 5 ? 170 : 0) + (i >= 9 ? 170 : 0),
        frame: {
          s, fx, fy: surf(fx), spin: i % 3,
          pose: i % 3 === 2 ? "strain" : "push",
          sweat: i % 3 === 2 && i > 3, pebble: i % 2 === 0 && i > 0
        }
      });
    }
    const t0 = steps[steps.length - 1].at + 250;
    // triumph: settle, arms up, sparkles
    const topBx = 24, topFx = 20;
    [{ pose: "reach", sparkle: false }, { pose: "triumph", sparkle: true }, { pose: "triumph", sparkle: true }]
      .forEach((p, k) => steps.push({
        at: t0 + k * 300,
        frame: Object.assign({ s: 1, boulderS: 1, fx: topFx, fy: surf(topFx), spin: 1 }, p)
      }));
    // fall: 6 accelerating steps, bouncing boulder, dust, watcher left behind
    const t1 = t0 + 3 * 300 + 200;
    const durs = [150, 130, 110, 90, 70, 70];
    let acc = 0;
    const dust = [];
    for (let k = 0; k < 6; k++) {
      acc += durs[k];
      const bs = 1 - (k + 1) / 6;
      const bx = 9 + bs * 15;
      dust.push([bx + 3.5, surf(bx + 3.5) - 1, k % 2 ? "." : "~"]);
      steps.push({
        at: t1 + acc,
        frame: {
          s: 1, boulderS: bs, hop: k % 2 === 0, spin: k % 3,
          fx: topFx, fy: surf(topFx), pose: "watch",
          dust: dust.slice()
        }
      });
    }
    // aftermath: impact puffs, slump beside the stone, then the quiet reset
    const t2 = t1 + acc + 250;
    steps.push({
      at: t2,
      frame: { s: 0, boulderS: 0, fx: topFx, fy: surf(topFx), pose: "watch", dust: dust.slice().concat([[5, 7, "."], [12, 6, "~"], [7, 7, "."]]) }
    });
    steps.push({
      at: t2 + 450,
      frame: { s: 0, boulderS: 0, fx: 13, fy: surf(13), pose: "sit", spin: 0 }
    });
    steps.push({
      at: t2 + 950,
      frame: { s: 0, boulderS: 0, fx: 13, fy: surf(13), pose: "slump", spin: 0 }
    });
    steps.push({
      at: t2 + 1450,
      frame: { s: 0, fx: 9 - 4.4, fy: surf(9 - 4.4), pose: "push", spin: 0 }
    });
    steps.forEach(({ at, frame }) => {
      sisyphusTimers.push(setTimeout(() => show(frame), at));
    });
    sisyphusTimers.push(setTimeout(() => {
      sisyphusBusy = false;
      termStatus.textContent = "ready";
      out.scrollTop = out.scrollHeight;
    }, t2 + 1500));
  }
  function runProjects(verb, rest) {
    if (projectsFailed) print("couldn’t load the project list just now, so only launchpad is here. reload to try again.", "warn");
    switch (verb) {
      case "ls": {
        const long = rest.includes("-l") || rest.includes("-la") || rest.includes("-al");
        PROJECTS.forEach(p => printLink(p, long));
        if (long) print("  (cd launchpad → the private launchpad, Tailscale only)", "dim");
        break;
      }
      case "cd": {
        const name = (rest[0] || "").toLowerCase().replace(/\/+$/, "");
        if (!name || name === "~" || name === "." || name === "..") { print("already home. try “ls”, then “cd <project>”.", "dim"); break; }
        const p = DESTS.find(d => d.name === name);
        if (!p) {
          const near = DESTS.filter(d => d.name.startsWith(name[0])).map(d => d.name);
          print(`cd: no such project: ${rest[0]}${near.length ? " — did you mean " + near.join(" or ") + "?" : ". try “ls”."}`, "err");
          break;
        }
        print(`→ ${p.url}`, "ok");
        termStatus.textContent = "leaving…";
        setTimeout(() => { location.href = p.url; }, 250);
        break;
      }
      case "cat": {
        const name = (rest[0] || "").toLowerCase().replace(/\/+$/, "");
        if (!name) { print("usage: cat <project> — e.g. cat crokinole. “ls” lists them.", "err"); break; }
        const p = DESTS.find(d => d.name === name);
        if (!p) { print(`cat: ${rest[0]}: no such project. try “ls”.`, "err"); break; }
        print(`${p.name} — ${p.blurb}`, "ok");
        p.about.forEach(l => print("  " + l));
        print(`  tags: ${p.tags.join(", ")}`, "dim");
        printRich(div => {
          div.appendChild(document.createTextNode("  "));
          const a = document.createElement("a");
          a.href = p.url; a.textContent = p.url;
          div.appendChild(a);
          div.appendChild(document.createTextNode(`  (cd ${p.name} to go)`));
        });
        break;
      }
      case "grep": {
        const words = rest.filter(w => !w.startsWith("-"));
        const q = fold(words.join(" ").replace(/^["']|["']$/g, ""));
        if (!q) { print("usage: grep <word> — e.g. grep fencing, grep game", "err"); break; }
        const hits = DESTS.filter(p => fold(p.name).includes(q) || grepLines(p).some(l => fold(l).includes(q)));
        if (!hits.length) { print(`grep: nothing mentions “${words.join(" ")}”. try “ls -l”.`, "warn"); break; }
        hits.forEach(p => {
          const tag = p.tags.find(tg => fold(tg).includes(q));
          const line = [p.blurb, ...p.about].find(l => fold(l).includes(q)) || (tag ? `${p.blurb}  [${tag}]` : p.blurb);
          printRich(div => {
            const a = document.createElement("a");
            a.href = p.url; a.textContent = p.name;
            div.appendChild(document.createTextNode("  "));
            div.appendChild(a);
            div.appendChild(document.createTextNode(": " + line));
          });
        });
        break;
      }
    }
  }

  function run(raw) {
    const cmd = raw.trim();
    if (!cmd) return;
    const echo = document.createElement("div");
    echo.className = "in"; echo.textContent = "$ " + cmd;
    out.appendChild(echo);
    history.unshift(cmd); hIndex = -1;
    if (!sisyphusBusy) {
      termStatus.textContent = "thinking…";
      setTimeout(() => { if (!sisyphusBusy) termStatus.textContent = "ready"; }, 250);
    }

    const [verbRaw, ...rest] = cmd.split(/\s+/);
    const verb = verbRaw.toLowerCase(), arg = rest.join(" ").trim();

    if (["ls", "cd", "cat", "grep"].includes(verb) && !PROJECTS.length && !projectsFailed) {
      projectsReady.then(() => runProjects(verb, rest));
      return;
    }
    if (["ls", "cd", "cat", "grep"].includes(verb)) { runProjects(verb, rest); out.scrollTop = out.scrollHeight; return; }

    switch (verb) {
      case "help":
        print("this console understands:", "ok");
        ["ls — list our projects (ls -l adds a line about each)",
         "cd <project> — go to it; e.g. cd crokinole (Tab completes names)",
         "cat <project> — what it is, without leaving; e.g. cat abacus",
         "grep <word> — find projects by what they do; e.g. grep fencing",
         "calc <expr> — safe pocket calculator, e.g. calc (3+4)*2",
         "password [length] — crypto-secure password, auto-copied; e.g. password 20",
         "sisyphus — he pushes. you watch.",
         "clear — wipe the console"
        ].forEach(l => print("  " + l));
        break;
      case "calc": {
        if (!arg) { print("usage: calc (3+4)*2 — numbers and + - * / % ^ ( ) only", "err"); break; }
        if (!/^[0-9+\-*/%().\s^]+$/.test(arg)) { print("calc keeps it safe: numbers and + - * / % ^ ( ) only.", "err"); break; }
        try {
          const val = Function('"use strict"; return (' + arg.replace(/\^/g, "**") + ")")();
          if (typeof val !== "number" || !isFinite(val)) throw new Error("nope");
          print(`= ${Math.round(val * 1e10) / 1e10}`, "ok");
        } catch { print("that expression doesn’t compute. try calc (3+4)*2", "err"); }
        break;
      }
      case "password":
      case "pass":
      case "passgen":
      case "pw": {
        let len = parseInt(rest[0] || "16", 10);
        if (!Number.isFinite(len)) { print("usage: password [length] — e.g. password 20 (8–64)", "err"); break; }
        len = Math.max(8, Math.min(64, len));
        let pw;
        try { pw = genPassword(len); }
        catch { print("this browser blocked secure randomness — no password generated.", "err"); break; }
        print(pw, "ok");
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(pw).then(
            () => print(`${len} chars · upper + lower + digit + symbol · copied to clipboard`, "dim"),
            () => print(`${len} chars · upper + lower + digit + symbol · select to copy (clipboard blocked)`, "dim")
          );
        } else {
          print(`${len} chars · upper + lower + digit + symbol · select to copy`, "dim");
        }
        break;
      }
      case "sisyphus":
        runSisyphus();
        break;
      case "clear": sisyphusCancel(); out.innerHTML = ""; break;
      default:
        print(`“${verbRaw}” isn’t a command here. type “help”.`, "err");
    }
    out.scrollTop = out.scrollHeight;
  }

  form.addEventListener("submit", e => { e.preventDefault(); const v = input.value; input.value = ""; run(v); input.focus(); });
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowUp") { e.preventDefault(); if (history.length) { hIndex = Math.min(hIndex + 1, history.length - 1); input.value = history[hIndex] || ""; } }
    if (e.key === "ArrowDown") { e.preventDefault(); hIndex = Math.max(hIndex - 1, -1); input.value = hIndex === -1 ? "" : history[hIndex]; }
    if (e.key === "Tab" && input.value.trim()) {
      const parts = input.value.split(/\s+/);
      const pool = parts.length > 1 && ["cd", "cat"].includes(parts[0].toLowerCase()) ? DESTS.map(d => d.name) : parts.length === 1 ? COMMANDS : [];
      const last = parts[parts.length - 1].toLowerCase();
      const hits = pool.filter(n => n.startsWith(last));
      if (!hits.length) return;
      e.preventDefault();
      if (hits.length === 1) { parts[parts.length - 1] = hits[0]; input.value = parts.join(" ") + " "; }
      else print(hits.join("  "), "dim");
    }
  });
  $$(".term-chips button").forEach(b => b.addEventListener("click", () => { input.focus(); run(b.dataset.cmd); }));

  /* ---------- open and close ---------- */
  const panel = $("#console"), openBtn = $("#consoleOpen"), closeBtn = $("#consoleClose");
  let greeted = false;
  function openConsole() {
    if (panel.hidden) {
      panel.hidden = false;
      openBtn.setAttribute("aria-expanded", "true");
      if (!greeted) {
        greeted = true;
        print("team remco console. type “help” to see what it can do.", "ok");
        print("“ls” lists our projects; “cd <project>” opens one.", "dim");
      }
      panel.scrollIntoView({ behavior: prefersReduced.matches ? "auto" : "smooth", block: "nearest" });
    }
    input.focus({ preventScroll: true });
  }
  function closeConsole() {
    sisyphusCancel();
    termStatus.textContent = "ready";
    panel.hidden = true;
    openBtn.setAttribute("aria-expanded", "false");
    openBtn.focus();
  }
  openBtn.addEventListener("click", () => (panel.hidden ? openConsole() : closeConsole()));
  closeBtn.addEventListener("click", closeConsole);
  panel.addEventListener("keydown", e => { if (e.key === "Escape") { e.preventDefault(); closeConsole(); } });
  window.addEventListener("keydown", e => {
    const t = e.target, typing = t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t.isContentEditable;
    if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); openConsole(); }
  });
})();
