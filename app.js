/* Team Remco — vanilla JS. One NYC weather instrument + playful local console. */
(function () {
  "use strict";
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const root = document.documentElement;
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const store = {
    get(k, f) { try { const v = localStorage.getItem(k); return v === null ? f : v; } catch { return f; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} }
  };

  $("#year").textContent = String(new Date().getFullYear());

  /* ---------- state ---------- */
  const state = {
    sky: "cloud", day: "day", live: "loading",
    override: store.get("teamremco.sky", "live"), // "live" or a sky name = honest preview
    motion: store.get("teamremco.motion", prefersReduced.matches ? "off" : "on"),
    wx: null, lastGood: null
  };
  try {
    const cached = store.get("teamremco.lastwx", null);
    if (cached) state.lastGood = JSON.parse(cached);
  } catch { /* ignore */ }

  const SKIES = ["clear", "cloud", "rain", "storm", "snow", "fog"];

  const motionOn = () => state.motion === "on" && !prefersReduced.matches ? true : state.motion === "on" && prefersReduced.matches ? false : state.motion === "on";
  // Simpler truth: explicit toggle, but OS reduced-motion always wins for canvas.
  const canvasMotion = () => state.motion === "on" && !prefersReduced.matches;

  /* ---------- weather: fixed NYC, Open-Meteo, honest fallback ---------- */
  const WX_URL = "https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.0060&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FNew_York";
  const wxChipText = $("#wxChipText"), skyNote = $("#skyNote"),
        themeColor = $("#themeColor");

  function wmoToSky(code) {
    if (code === 0 || code === 1) return "clear";
    if (code === 2 || code === 3) return "cloud";
    if (code === 45 || code === 48) return "fog";
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
    if (code >= 95) return "storm";
    return "cloud";
  }
  function wmoLabel(code) {
    const m = { 0: "clear sky", 1: "mostly clear", 2: "partly cloudy", 3: "overcast", 45: "fog", 48: "rime fog",
      51: "light drizzle", 53: "drizzle", 55: "heavy drizzle", 61: "light rain", 63: "rain", 65: "heavy rain",
      66: "freezing rain", 67: "freezing rain", 71: "light snow", 73: "snow", 75: "heavy snow", 77: "snow grains",
      80: "light showers", 81: "showers", 82: "violent showers", 85: "snow showers", 86: "snow showers",
      95: "thunderstorm", 96: "storm + hail", 99: "storm + hail" };
    return m[code] || "changing sky";
  }

  function effectiveSky() {
    if (state.override !== "live" && SKIES.includes(state.override)) return state.override;
    if (state.wx) return wmoToSky(state.wx.weather_code);
    if (state.lastGood) return wmoToSky(state.lastGood.weather_code);
    return "cloud";
  }

  function applySky() {
    const sky = effectiveSky();
    const isDay = state.wx ? state.wx.is_day === 1 : (state.lastGood ? state.lastGood.is_day === 1 : true);
    const preview = state.override !== "live";
    const liveLabel = state.wx && !preview ? "live" : preview ? "preview" : (state.lastGood ? "fallback" : "fallback");

    state.sky = sky;
    state.day = isDay ? "day" : "night";
    state.live = liveLabel;
    root.dataset.sky = sky;
    root.dataset.day = state.day;
    root.dataset.live = liveLabel;
    themeColor.setAttribute("content", state.day === "day" ? "#7d9cc4" : "#0b1226");

    $$("[data-sky-btn]").forEach(b => {
      const on = (b.dataset.skyBtn === "live" && !preview) || b.dataset.skyBtn === (preview ? state.override : "@live");
      b.setAttribute("aria-pressed", String(on));
    });

    if (state.wx && !preview) {
      const w = state.wx;
      wxChipText.textContent = `NYC ${Math.round(w.temperature_2m)}°F · ${wmoLabel(w.weather_code)} · live`;
      skyNote.textContent = "Following live New York weather. Pick a preset for an honest preview.";
    } else if (preview) {
      wxChipText.textContent = `NYC sky preview: ${state.override}`;
      skyNote.textContent = `Previewing “${state.override}” — an honest sketch, not live data. “● Live NYC” returns to real weather.`;
    } else if (state.lastGood) {
      const w = state.lastGood;
      const when = w._at ? new Date(w._at).toLocaleTimeString() : "earlier";
      wxChipText.textContent = `NYC ${Math.round(w.temperature_2m)}°F · last seen · offline`;
      skyNote.textContent = "Offline: showing the last seen New York sky, honestly labeled. It will refresh itself when the network returns.";
    } else {
      wxChipText.textContent = "NYC sky: offline sketch";
      skyNote.textContent = "Offline sketch — live data unavailable, nothing faked. It will switch to live on its own when the network returns.";
    }
  }

  async function fetchWeather() {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(WX_URL, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error("bad status " + res.status);
      const data = await res.json();
      if (!data || !data.current) throw new Error("empty");
      state.wx = data.current;
      state.lastGood = Object.assign({ _at: Date.now() }, data.current);
      store.set("teamremco.lastwx", JSON.stringify(state.lastGood));
    } catch {
      state.wx = null; // stay honest: fallback path in applySky()
    }
    applySky();
  }

  $$("[data-sky-btn]").forEach(b => b.addEventListener("click", () => {
    state.override = b.dataset.skyBtn === "live" ? "live" : b.dataset.skyBtn;
    store.set("teamremco.sky", state.override);
    applySky();
    print(`sky → ${state.override === "live" ? "live New York weather" : "preview: " + state.override + " (not live)"}`, "ok");
  }));

  /* ---------- sky canvas: one atmosphere, weather-driven ---------- */
  const canvas = $("#sky"), ctx = canvas.getContext("2d");
  let W = 0, H = 0, parts = [], clouds = [], flash = 0, bolt = null, t = 0;

  function sizeSky() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  }
  function seed() {
    parts = [];
    const sky = state.sky;
    const night = state.day === "night";
    // Weather-driven particles only: rain/storm streaks, snowflakes, clear-night stars.
    // Calm skies get their atmosphere from clouds/fog alone.
    const n = sky === "snow" ? 160 : sky === "rain" ? 220 : sky === "storm" ? 260 : (sky === "clear" && night) ? 150 : 0;
    for (let i = 0; i < n; i++) {
      parts.push({ x: Math.random() * W, y: Math.random() * H, z: 0.4 + Math.random() * 0.6, ph: Math.random() * 6.28, len: 10 + Math.random() * 14 });
    }
    clouds = [];
    const cn = sky === "clear" ? 3 : sky === "fog" ? 8 : 6;
    for (let i = 0; i < cn; i++) {
      clouds.push({
        x: Math.random() * W, y: Math.random() * H * 0.6,
        r: 90 + Math.random() * 170, v: 0.15 + Math.random() * 0.4,
        puffs: [
          [-0.76, 0.10, 0.38], [-0.46, -0.13, 0.56], [-0.08, -0.28, 0.68],
          [0.30, -0.13, 0.52], [0.68, 0.10, 0.36]
        ].map(([dx, dy, scale]) => ({ dx, dy, scale: scale * (0.88 + Math.random() * 0.2) }))
      });
    }
  }
  function drawCloud(c, night, alpha) {
    const g = ctx.createRadialGradient(c.x, c.y - c.r * 0.12, 0, c.x, c.y, c.r * 1.12);
    g.addColorStop(0, night ? `rgba(190,210,245,${alpha})` : `rgba(255,255,255,${alpha + 0.12})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.save();
    ctx.fillStyle = g;
    ctx.beginPath();
    for (const p of c.puffs) ctx.arc(c.x + p.dx * c.r, c.y + p.dy * c.r, p.scale * c.r, 0, 6.29);
    ctx.rect(c.x - c.r * 0.78, c.y + c.r * 0.08, c.r * 1.56, c.r * 0.24);
    ctx.fill();
    ctx.restore();
  }
  function drawFog(animated) {
    // Soft, irregular wisps avoid the hard-edged gray bands used before.
    const wisps = [
      { at: 0.24, h: 18, amp: 10, alpha: 0.10, speed: 0.22, phase: 0.3 },
      { at: 0.36, h: 26, amp: 16, alpha: 0.12, speed: 0.16, phase: 1.8 },
      { at: 0.49, h: 20, amp: 12, alpha: 0.09, speed: 0.19, phase: 3.1 },
      { at: 0.62, h: 32, amp: 19, alpha: 0.13, speed: 0.13, phase: 4.4 },
      { at: 0.76, h: 22, amp: 14, alpha: 0.10, speed: 0.18, phase: 5.6 },
      { at: 0.88, h: 16, amp: 9, alpha: 0.08, speed: 0.24, phase: 0.9 }
    ];
    ctx.save();
    for (const w of wisps) {
      const y = H * w.at + (animated ? Math.sin(t * w.speed + w.phase) * 12 : 0);
      const h = Math.min(w.h, H * 0.045);
      const g = ctx.createLinearGradient(0, y - h, 0, y + h);
      g.addColorStop(0, "rgba(235,239,246,0)");
      g.addColorStop(0.34, `rgba(235,239,246,${w.alpha})`);
      g.addColorStop(0.66, `rgba(235,239,246,${w.alpha * 0.72})`);
      g.addColorStop(1, "rgba(235,239,246,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-40, y);
      for (let x = -40; x <= W + 40; x += Math.max(90, W / 5)) {
        const wave = Math.sin(x * 0.009 + w.phase + (animated ? t * w.speed : 0)) * w.amp;
        ctx.lineTo(x, y - h * 0.52 + wave);
      }
      for (let x = W + 40; x >= -40; x -= Math.max(90, W / 5)) {
        const wave = Math.sin(x * 0.009 + w.phase + (animated ? t * w.speed : 0)) * w.amp;
        ctx.lineTo(x, y + h * 0.52 + wave);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  function drawSkyBackdrop(animated) {
    const night = state.day === "night";
    if (state.sky === "clear" && !night) {
      const x = W * 0.84, y = H * 0.16, r = Math.min(W, H) * 0.22;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const pulse = animated ? 0.25 + Math.sin(t * 0.5) * 0.03 : 0.26;
      g.addColorStop(0, `rgba(255,238,168,${pulse})`);
      g.addColorStop(0.28, `rgba(255,205,92,${pulse * 0.62})`);
      g.addColorStop(0.7, `rgba(255,194,73,${pulse * 0.16})`);
      g.addColorStop(1, "rgba(255,194,73,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.29); ctx.fill();
      ctx.save();
      ctx.fillStyle = `rgba(255,224,126,${0.72 + (animated ? Math.sin(t * 0.5) * 0.04 : 0)})`;
      ctx.beginPath(); ctx.arc(x, y, r * 0.16, 0, 6.29); ctx.fill();
      ctx.strokeStyle = "rgba(255,229,153,.42)"; ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + (animated ? t * 0.025 : 0);
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.54, y + Math.sin(a) * r * 0.54);
        ctx.lineTo(x + Math.cos(a) * r * 0.72, y + Math.sin(a) * r * 0.72); ctx.stroke();
      }
      ctx.restore();
    } else if (state.sky === "cloud") {
      const x = W * 0.76 + (animated ? Math.sin(t * 0.14) * W * 0.035 : 0), y = H * 0.18;
      const g = ctx.createRadialGradient(x, y, 0, x, y, Math.min(W, H) * 0.2);
      g.addColorStop(0, night ? "rgba(190,211,255,.17)" : "rgba(255,224,154,.18)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, Math.min(W, H) * 0.2, 0, 6.29); ctx.fill();
    } else if (state.sky === "fog") {
      const x = W * 0.78, y = H * 0.42, r = Math.min(W, H) * 0.18;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(255,206,120,.20)"); g.addColorStop(0.2, "rgba(255,190,100,.08)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.29); ctx.fill();
      ctx.fillStyle = "rgba(255,213,133,.65)"; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 6.29); ctx.fill();
    }
  }
  function drawSkySurface(animated) {
    if (state.sky === "rain") {
      const count = 4;
      ctx.save(); ctx.strokeStyle = "rgba(198,231,255,.60)"; ctx.lineWidth = 1;
      for (let i = 0; i < count; i++) {
        const phase = animated ? (t * 0.34 + i * 0.23) % 1 : 0.35;
        const x = ((i + 0.5) / count) * W + (animated ? Math.sin(t + i) * 16 : 0);
        const y = H - 18; ctx.globalAlpha = (1 - phase) * 0.5;
        ctx.beginPath(); ctx.arc(x, y, 3 + phase * 11, Math.PI, 2 * Math.PI); ctx.stroke();
      }
      ctx.restore();
    } else if (state.sky === "snow") {
      ctx.save(); ctx.fillStyle = "rgba(255,255,255,.18)";
      ctx.beginPath(); ctx.moveTo(0, H - 7); ctx.quadraticCurveTo(W * 0.22, H - 24, W * 0.46, H - 9);
      ctx.quadraticCurveTo(W * 0.74, H - 27, W, H - 8); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill(); ctx.restore();
    }
  }
  function drawOnce() {
    ctx.clearRect(0, 0, W, H);
    const night = state.day === "night";
    drawSkyBackdrop(false);
    for (const c of clouds) {
      const a = state.sky === "fog" ? 0.35 : state.sky === "clear" ? 0.12 : 0.22;
      drawCloud(c, night, a);
    }
    // stars: clear nights only — a weather-specific sky, not generic particles
    if (night && state.sky === "clear") {
      ctx.fillStyle = "#fff";
      for (const p of parts.slice(0, 120)) {
        ctx.globalAlpha = 0.25 + p.z * 0.55;
        ctx.fillRect(p.x, p.y, p.z > 0.8 ? 2 : 1, p.z > 0.8 ? 2 : 1);
      }
      ctx.globalAlpha = 1;
    }
    // precipitation one static frame
    ctx.strokeStyle = state.sky === "snow" ? "rgba(255,255,255,.85)" : "rgba(180,220,255,.5)";
    for (const p of parts) {
      if (state.sky === "snow") { ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.beginPath(); ctx.arc(p.x, p.y, 1 + p.z * 1.6, 0, 6.29); ctx.fill(); }
      else if (["rain", "storm"].includes(state.sky)) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 3, p.y + p.len); ctx.stroke(); }
    }
    if (state.sky === "fog") drawFog(false);
    drawSkySurface(false);
  }
  function loop() {
    requestAnimationFrame(loop);
    if (!canvasMotion() || document.hidden) return;
    t += 0.016;
    ctx.clearRect(0, 0, W, H);
    const night = state.day === "night";
    drawSkyBackdrop(true);
    for (const c of clouds) {
      c.x += c.v * (state.sky === "storm" ? 3 : 1);
      if (c.x - c.r > W) { c.x = -c.r; c.y = Math.random() * H * 0.6; }
      const a = state.sky === "fog" ? 0.32 : state.sky === "clear" ? 0.10 : 0.2;
      drawCloud(c, night, a);
    }
    if (night && state.sky === "clear") {
      for (const p of parts.slice(0, 120)) {
        const tw = 0.3 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2 + p.ph));
        ctx.globalAlpha = tw * p.z;
        ctx.fillStyle = "#fff";
        ctx.fillRect(p.x, p.y, p.z > 0.8 ? 2 : 1, p.z > 0.8 ? 2 : 1);
      }
      ctx.globalAlpha = 1;
    }
    if (state.sky === "snow") {
      ctx.fillStyle = "rgba(255,255,255,.9)";
      for (const p of parts) {
        p.y += (0.5 + p.z) * 0.9; p.x += Math.sin(t + p.ph) * 0.5;
        if (p.y > H + 4) { p.y = -4; p.x = Math.random() * W; }
        ctx.globalAlpha = 0.5 + p.z * 0.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, 1 + p.z * 1.8, 0, 6.29); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (state.sky === "rain" || state.sky === "storm") {
      ctx.strokeStyle = "rgba(175,215,255,.55)"; ctx.lineWidth = 1;
      const fast = state.sky === "storm" ? 14 : 9;
      for (const p of parts) {
        p.y += (4 + p.z * fast); p.x -= 1.4;
        if (p.y > H + 20) { p.y = -20; p.x = Math.random() * (W + 60); }
        ctx.globalAlpha = 0.35 + p.z * 0.4;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 2.5, p.y - p.len); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (state.sky === "storm") {
        if (!bolt && Math.random() < 0.006) {
          bolt = { x: Math.random() * W, segs: Array.from({ length: 9 }, () => (Math.random() - 0.5) * 44) };
          flash = 1;
        }
        if (bolt) {
          ctx.strokeStyle = "rgba(255,240,170,.95)"; ctx.lineWidth = 2;
          ctx.beginPath(); let bx = bolt.x, by = 0;
          ctx.moveTo(bx, by);
          for (const s of bolt.segs) { bx += s; by += H / 9; ctx.lineTo(bx, by); }
          ctx.stroke();
          if (Math.random() < 0.25) bolt = null;
        }
        if (flash > 0) { ctx.fillStyle = `rgba(255,250,220,${flash * 0.16})`; ctx.fillRect(0, 0, W, H); flash -= 0.06; }
      }
    } else if (state.sky === "fog") drawFog(true);
    // clear / cloud calm skies: clouds alone carry the atmosphere.
    drawSkySurface(true);
  }

  /* re-seed particles whenever sky changes */
  const _applySky = applySky;
  applySky = function () { _applySky(); seed(); if (!canvasMotion()) drawOnce(); };

  /* ---------- motion toggle ---------- */
  const motionBtn = $("#motionBtn");
  function renderMotion() {
    const on = state.motion === "on";
    motionBtn.textContent = `Motion: ${on ? "on" : "off"}`;
    motionBtn.setAttribute("aria-pressed", String(on));
    if (!canvasMotion()) drawOnce();
  }
  motionBtn.addEventListener("click", () => {
    state.motion = state.motion === "on" ? "off" : "on";
    store.set("teamremco.motion", state.motion);
    renderMotion();
  });

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
  const JOKES = [
    "Why do programmers prefer dark mode? Because light attracts bugs. (The sky agrees tonight.)",
    "There are only 10 kinds of people: those who understand binary and those who don’t.",
    "A SQL query walks into a bar, sees two tables and asks… “Mind if I join you?”",
    "Real programmers count from 0. Rebels count from 0x0.",
    "I told my computer I needed a break. Now it won’t stop sending me KitKats… via cache.",
    "Why did the weather API stay calm? It knew how to handle pressure systems."
  ];
  const BALL = [
    "It is certain.",
    "It is decidedly so.",
    "Without a doubt.",
    "Yes — definitely.",
    "You may rely on it.",
    "As I see it, yes.",
    "Most likely.",
    "Outlook good.",
    "Yes.",
    "The signs point to yes.",
    "Reply hazy — try again.",
    "Ask again later.",
    "Better not tell you now.",
    "Cannot predict that yet.",
    "Concentrate and ask again.",
    "Don’t count on it.",
    "My reply is no.",
    "Outlook not so good.",
    "Very doubtful.",
    "The answer is hiding in the fog.",
    "The sky has not made up its mind."
  ];
  function diceRoll(spec) {
    const m = /^(\d{1,2})d(\d{1,4})$/.exec(spec || "1d6");
    if (!m) return null;
    const n = Math.min(Number(m[1]) || 1, 20), sides = Math.min(Number(m[2]) || 6, 1000);
    const rolls = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * sides));
    return { rolls, total: rolls.reduce((a, b) => a + b, 0), sides };
  }
  function snapshot() {
    const c = navigator.connection || {};
    const lines = [
      "about-me — browser-reported, ephemeral, never sent anywhere:",
      `  language: ${navigator.language} · cores: ${navigator.hardwareConcurrency || "?"} · ram: ${navigator.deviceMemory ? "~" + navigator.deviceMemory + "GB" : "?"}`,
      `  viewport: ${window.innerWidth}×${window.innerHeight} · pixels: ×${window.devicePixelRatio || 1} · touch: ${matchMedia("(pointer: coarse)").matches ? "likely" : "unlikely"}`,
      `  timezone: ${(Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || "?"} · online: ${navigator.onLine} · net: ${c.effectiveType || "?"}`,
      `  motion: ${prefersReduced.matches ? "you prefer reduced motion (honored)" : "full motion OK"} · sky: ${state.sky} (${state.live})`
    ];
    lines.forEach(l => print(l, "dim"));
  }
  function weatherSummary() {
    if (state.wx && state.override === "live")
      print(`NYC now: ${wmoLabel(state.wx.weather_code)}, ${Math.round(state.wx.temperature_2m)}°F (feels ${Math.round(state.wx.apparent_temperature)}°F), wind ${Math.round(state.wx.wind_speed_10m)} mph · live via Open-Meteo.`, "ok");
    else if (state.lastGood)
      print(`NYC last seen: ${wmoLabel(state.lastGood.weather_code)}, ${Math.round(state.lastGood.temperature_2m)}°F · live unreachable, nothing faked. “weather live” retries the sky.`, "warn");
    else
      print("NYC live weather unreachable and no cached reading — offline sketch. Nothing faked; it retries on its own.", "warn");
  }

  function run(raw) {
    const cmd = raw.trim();
    if (!cmd) return;
    const echo = document.createElement("div");
    echo.className = "in"; echo.textContent = "$ " + cmd;
    out.appendChild(echo);
    history.unshift(cmd); hIndex = -1;
    termStatus.textContent = "thinking…";
    setTimeout(() => { termStatus.textContent = "ready"; }, 250);

    const [verbRaw, ...rest] = cmd.split(/\s+/);
    const verb = verbRaw.toLowerCase(), arg = rest.join(" ").trim();

    switch (verb) {
      case "help":
        print("this console understands:", "ok");
        ["weather [clear|cloud|rain|storm|snow|fog|live] — live NYC sky or honest preview",
         "live — return to live New York weather",
         "time | date — yours + New York, side by side",
         "calc <expr> — safe pocket calculator, e.g. calc (3+4)*2",
         "dice [NdM] — roll N dice with M sides; e.g. dice 2d6 = two six-sided dice",
         "coin — flip a coin",
         "8ball <question> — a small oracle, locally sourced",
         "color <css color> — preview it, e.g. color #7df0ff",
         "joke — a nerdy joke, no network",
         "about-me — one honest snapshot of what your browser reports",
         "echo <text> — say it back",
         "clear — wipe the console",
         "curiosity | 42 — for explorers"
        ].forEach(l => print("  " + l));
        break;
      case "weather": {
        const w = (rest[0] || "").toLowerCase();
        if (!w) { weatherSummary(); break; }
        if (w === "live") { state.override = "live"; store.set("teamremco.sky", "live"); applySky(); print("sky → live New York weather.", "ok"); fetchWeather(); }
        else if (SKIES.includes(w)) { state.override = w; store.set("teamremco.sky", w); applySky(); print(`sky → preview: ${w} (honest sketch, not live). “weather live” returns.`, "ok"); }
        else print(`unknown sky “${rest[0]}”. try: ${SKIES.join(" · ")} · live`, "err");
        break;
      }
      case "live":
        state.override = "live"; store.set("teamremco.sky", "live"); applySky(); fetchWeather();
        print("sky → live New York weather (fetching…).", "ok");
        break;
      case "time":
      case "date": {
        const now = new Date();
        let nyc = now.toLocaleString();
        try { nyc = now.toLocaleString(undefined, { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", second: "2-digit" }); } catch {}
        print(`you: ${now.toLocaleTimeString()} · New York: ${nyc}`, "ok");
        break;
      }
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
      case "dice": {
        const r = diceRoll(rest[0] || "1d6");
        if (!r) { print("usage: dice NdM — N dice, each with M sides; e.g. dice 2d6", "err"); break; }
        print(`🎲 ${r.rolls.join(" · ")}  (total ${r.total} on d${r.sides})`, "ok");
        break;
      }
      case "coin":
        print(`🪙 ${Math.random() < 0.5 ? "heads" : "tails"}`, "ok");
        break;
      case "8ball":
        if (!arg) { print("ask it something: 8ball should I ship it?", "err"); break; }
        print(`🔮 ${BALL[Math.floor(Math.random() * BALL.length)]}`, "warn");
        break;
      case "color": {
        if (!arg) { print("usage: color #7df0ff — any CSS color", "err"); break; }
        const probe = document.createElement("div");
        probe.style.color = "";
        probe.style.color = arg;
        if (!probe.style.color) { print(`“${arg}” isn’t a color this browser recognizes.`, "err"); break; }
        printRich(div => {
          const sw = document.createElement("span");
          sw.className = "swatch"; sw.style.background = arg; sw.setAttribute("aria-hidden", "true");
          div.appendChild(sw);
          div.appendChild(document.createTextNode(`${arg} → ${probe.style.color} (as the browser sees it)`));
        });
        break;
      }
      case "joke":
        print(JOKES[Math.floor(Math.random() * JOKES.length)], "ok");
        break;
      case "about-me": snapshot(); break;
      case "echo":
        print(arg || "(silence — the instrument echoes it back faithfully)", "dim");
        break;
      case "clear": out.innerHTML = ""; break;
      case "curiosity":
        print("Curiosity recognized. The map grows wherever you point it.", "ok");
        print("“We keep the question open longer than is comfortable.” — crew log", "dim");
        break;
      case "42":
        print("42: the answer. The question — what should we explore next? — is yours.", "warn");
        break;
      default:
        print(`“${verbRaw}” isn’t an instrument yet. Type “help”.`, "err");
    }
    out.scrollTop = out.scrollHeight;
  }

  form.addEventListener("submit", e => { e.preventDefault(); const v = input.value; input.value = ""; run(v); input.focus(); });
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowUp") { e.preventDefault(); if (history.length) { hIndex = Math.min(hIndex + 1, history.length - 1); input.value = history[hIndex] || ""; } }
    if (e.key === "ArrowDown") { e.preventDefault(); hIndex = Math.max(hIndex - 1, -1); input.value = hIndex === -1 ? "" : history[hIndex]; }
  });
  $$(".term-chips button").forEach(b => b.addEventListener("click", () => { input.focus(); run(b.dataset.cmd); }));
  window.addEventListener("keydown", e => {
    if (e.key === "/" && document.activeElement !== input && !e.metaKey && !e.ctrlKey) { e.preventDefault(); input.focus(); }
  });
  window.addEventListener("resize", () => sizeSky());

  /* konami stays: one tiny warp, honestly labeled */
  const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let k = 0;
  window.addEventListener("keydown", e => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    k = (key === KONAMI[k]) ? k + 1 : (key === KONAMI[0] ? 1 : 0);
    if (k === KONAMI.length) {
      k = 0;
      state.override = "storm"; store.set("teamremco.sky", "storm"); applySky();
      print("KONAMI ACCEPTED — storm preview (honest sketch, not live). “weather live” returns.", "warn");
    }
  });

  /* ---------- boot ---------- */
  function boot() {
    renderMotion();
    sizeSky();
    applySky();
    drawOnce();
    requestAnimationFrame(loop);
    window.addEventListener("resize", () => { if (!canvasMotion()) drawOnce(); });
    prefersReduced.addEventListener?.("change", () => { renderMotion(); drawOnce(); });
    print("team remco online — one New York sky, one tiny console. type “help”.", "ok");
    print("live sky follows NYC · previews are honestly labeled.", "dim");
    fetchWeather();
    setInterval(fetchWeather, 10 * 60 * 1000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
