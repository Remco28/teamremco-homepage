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

  // Explicit toggle, but OS reduced-motion always wins for canvas.
  const canvasMotion = () => state.motion === "on" && !prefersReduced.matches;

  /* ---------- weather: fixed NYC, Open-Meteo, honest fallback ---------- */
  const WX_URL = "https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.0060&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FNew_York";
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
      const when = w._at ? new Date(w._at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "earlier";
      wxChipText.textContent = `NYC ${Math.round(w.temperature_2m)}°F · seen ${when} · offline`;
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

  // What the live reading says beyond the sky type: how hard, which way the wind, how much cloud.
  // Previews are sketches, so they get middling defaults rather than borrowed live numbers.
  const HEAVY = { 51: 0.35, 53: 0.5, 55: 0.7, 56: 0.5, 57: 0.7, 61: 0.65, 63: 1, 65: 1.5, 66: 0.65, 67: 1.3,
    71: 0.6, 73: 1, 75: 1.5, 77: 0.5, 80: 0.7, 81: 1.1, 82: 1.6, 85: 0.8, 86: 1.4, 95: 1.1, 96: 1.3, 99: 1.5 };
  function traits() {
    const w = state.override === "live" ? (state.wx || state.lastGood) : null;
    if (!w) return { heavy: 1, wind: 8, dir: 1, cover: state.sky === "clear" ? 10 : 70, code: null };
    const deg = Number.isFinite(w.wind_direction_10m) ? w.wind_direction_10m : 270;
    // Wind blowing from the west carries things east, which is screen-right on a north-up map.
    const dir = -Math.sin(deg * Math.PI / 180) >= 0 ? 1 : -1;
    return { heavy: HEAVY[w.weather_code] || 1, wind: w.wind_speed_10m || 0, dir,
             cover: Number.isFinite(w.cloud_cover) ? w.cloud_cover : 60, code: w.weather_code };
  }
  let wx = traits();

  let lastW = 0, lastH = 0;
  function sizeSky() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Phones fire resize when the address bar slides; only reseed when the shape really changed,
    // otherwise rain and snow would restart from scratch on every scroll.
    if (Math.abs(W - lastW) > 40 || Math.abs(H - lastH) > 160) { lastW = W; lastH = H; seed(); }
  }
  function seed() {
    parts = [];
    wx = traits();
    const sky = state.sky;
    const night = state.day === "night";
    const drizzle = wx.code >= 51 && wx.code <= 57;
    // Weather-driven particles: rain/storm streaks, snowflakes, stars on clear or broken-cloud nights.
    const base = sky === "snow" ? 160 : sky === "rain" ? 220 : sky === "storm" ? 260 : 0;
    const stars = night && (sky === "clear" || (sky === "cloud" && wx.cover < 75)) ? (sky === "clear" ? 150 : 70) : 0;
    const n = base ? Math.round(base * wx.heavy) : stars;
    for (let i = 0; i < n; i++) {
      parts.push({ x: Math.random() * W, y: Math.random() * H, z: 0.4 + Math.random() * 0.6, ph: Math.random() * 6.28,
                   len: drizzle ? 5 + Math.random() * 6 : 10 + Math.random() * 14 });
    }
    clouds = [];
    const cn = sky === "clear" ? (wx.cover < 15 ? 1 : 3) : sky === "fog" ? 8
      : sky === "cloud" ? Math.round(3 + wx.cover / 100 * 6) : 6;
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
  function cloudAlpha() {
    if (state.sky === "fog") return 0.33;
    if (state.sky === "clear") return 0.11;
    return state.sky === "cloud" ? 0.12 + wx.cover / 100 * 0.14 : 0.22;
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
  function drawMoon(x, y, r, haze) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
    g.addColorStop(0, `rgba(220,230,255,${0.22 * haze})`); g.addColorStop(1, "rgba(220,230,255,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 5, 0, 6.29); ctx.fill();
    ctx.save();
    ctx.fillStyle = `rgba(238,242,255,${0.9 * haze})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.29); ctx.fill();
    // Cut a crescent out of the disc so the page behind shows through.
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath(); ctx.arc(x + r * 0.45, y - r * 0.2, r * 0.88, 0, 6.29); ctx.fill();
    ctx.restore();
  }
  function drawSkyBackdrop(animated) {
    const night = state.day === "night";
    if (state.sky === "clear" && night) {
      drawMoon(W * 0.84, H * 0.16, Math.min(W, H) * 0.035, 1);
    } else if (state.sky === "clear") {
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
      // The sun or moon glows through thinner cloud and fades out under overcast.
      const glow = Math.max(0, 1 - wx.cover / 110);
      const x = W * 0.76 + (animated ? Math.sin(t * 0.14) * W * 0.035 : 0), y = H * 0.18;
      const g = ctx.createRadialGradient(x, y, 0, x, y, Math.min(W, H) * 0.2);
      g.addColorStop(0, night ? `rgba(190,211,255,${0.06 + 0.14 * glow})` : `rgba(255,224,154,${0.06 + 0.16 * glow})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, Math.min(W, H) * 0.2, 0, 6.29); ctx.fill();
    } else if (state.sky === "fog") {
      const x = W * 0.78, y = H * 0.42, r = Math.min(W, H) * 0.18;
      if (night) { drawMoon(x, y, Math.min(W, H) * 0.02, 0.45); return; }
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(255,206,120,.20)"); g.addColorStop(0.2, "rgba(255,190,100,.08)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.29); ctx.fill();
      ctx.fillStyle = "rgba(255,213,133,.65)"; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 6.29); ctx.fill();
    }
  }
  function drawSkySurface(animated) {
    if (state.sky === "rain" || state.sky === "storm") {
      const count = Math.max(2, Math.round(4 * wx.heavy));
      ctx.save(); ctx.strokeStyle = "rgba(198,231,255,.60)"; ctx.lineWidth = 1;
      for (let i = 0; i < count; i++) {
        const phase = animated ? (t * 0.34 * wx.heavy + i * 0.23) % 1 : 0.35;
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
  // Rain falls at a fixed pace; wind leans it. Returns px/second.
  function rainVel(p) {
    const vy = (4 + p.z * (state.sky === "storm" ? 14 : 9)) * 60 * (wx.code >= 51 && wx.code <= 57 ? 0.6 : 1);
    const vx = wx.dir * Math.min(wx.wind, 40) * 7 * (0.7 + p.z * 0.3);
    return [vx, vy];
  }
  function drawStars(animated) {
    ctx.fillStyle = "#fff";
    for (const p of parts) {
      const tw = animated ? 0.3 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2 + p.ph)) : 0.85;
      ctx.globalAlpha = tw * p.z;
      ctx.fillRect(p.x, p.y, p.z > 0.8 ? 2 : 1, p.z > 0.8 ? 2 : 1);
    }
    ctx.globalAlpha = 1;
  }
  const hasStars = () => state.day === "night" && (state.sky === "clear" || state.sky === "cloud");
  function drawOnce() {
    ctx.clearRect(0, 0, W, H);
    const night = state.day === "night";
    if (hasStars()) drawStars(false);
    drawSkyBackdrop(false);
    for (const c of clouds) drawCloud(c, night, cloudAlpha());
    // precipitation one static frame
    ctx.strokeStyle = state.sky === "snow" ? "rgba(255,255,255,.85)" : "rgba(180,220,255,.5)";
    for (const p of parts) {
      if (state.sky === "snow") { ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.beginPath(); ctx.arc(p.x, p.y, 1 + p.z * 1.6, 0, 6.29); ctx.fill(); }
      else if (state.sky === "rain" || state.sky === "storm") {
        const [vx, vy] = rainVel(p);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - vx / vy * p.len, p.y - p.len); ctx.stroke();
      }
    }
    if (state.sky === "fog") drawFog(false);
    drawSkySurface(false);
  }
  let lastFrame = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    // Seconds since the last frame, so 60 Hz and 144 Hz screens see the same weather.
    const dt = Math.min(((now || 0) - lastFrame) / 1000, 0.05);
    lastFrame = now || 0;
    if (!canvasMotion() || document.hidden || dt <= 0) return;
    const f = dt * 60; // old per-frame tuning, scaled to real time
    t += dt;
    ctx.clearRect(0, 0, W, H);
    const night = state.day === "night";
    if (hasStars()) drawStars(true);
    drawSkyBackdrop(true);
    const drift = wx.dir * (0.5 + Math.min(wx.wind, 30) / 12) * (state.sky === "storm" ? 2 : 1);
    for (const c of clouds) {
      c.x += c.v * drift * f;
      if (c.x - c.r * 1.2 > W) { c.x = -c.r * 1.2; c.y = Math.random() * H * 0.6; }
      else if (c.x + c.r * 1.2 < 0) { c.x = W + c.r * 1.2; c.y = Math.random() * H * 0.6; }
      drawCloud(c, night, cloudAlpha() * 0.92);
    }
    if (state.sky === "snow") {
      ctx.fillStyle = "rgba(255,255,255,.9)";
      const push = wx.dir * Math.min(wx.wind, 30) * 0.04;
      for (const p of parts) {
        p.y += (0.5 + p.z) * 0.9 * f; p.x += (Math.sin(t + p.ph) * 0.5 + push) * f;
        if (p.y > H + 4) { p.y = -4; p.x = Math.random() * W; }
        if (p.x > W + 4) p.x = -4; else if (p.x < -4) p.x = W + 4;
        ctx.globalAlpha = 0.5 + p.z * 0.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, 1 + p.z * 1.8, 0, 6.29); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (state.sky === "rain" || state.sky === "storm") {
      ctx.strokeStyle = "rgba(175,215,255,.55)"; ctx.lineWidth = 1;
      for (const p of parts) {
        const [vx, vy] = rainVel(p);
        p.y += vy * dt; p.x += vx * dt;
        if (p.y > H + 20) { p.y = -20; p.x = Math.random() * (W + 200) - 100; }
        if (p.x > W + 40) p.x -= W + 80; else if (p.x < -40) p.x += W + 80;
        ctx.globalAlpha = 0.35 + p.z * 0.4;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - vx / vy * p.len, p.y - p.len); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (state.sky === "storm") {
        if (!bolt && Math.random() < 0.36 * dt * wx.heavy) {
          bolt = { x: Math.random() * W, life: 0.06 + Math.random() * 0.1, segs: Array.from({ length: 9 }, () => (Math.random() - 0.5) * 44) };
          flash = 1;
        }
        if (bolt) {
          ctx.strokeStyle = "rgba(255,240,170,.95)"; ctx.lineWidth = 2;
          ctx.beginPath(); let bx = bolt.x, by = 0;
          ctx.moveTo(bx, by);
          for (const s of bolt.segs) { bx += s; by += H / 9; ctx.lineTo(bx, by); }
          ctx.stroke();
          bolt.life -= dt; if (bolt.life <= 0) bolt = null;
        }
        if (flash > 0) { ctx.fillStyle = `rgba(255,250,220,${flash * 0.16})`; ctx.fillRect(0, 0, W, H); flash -= 3.6 * dt; }
      }
    } else if (state.sky === "fog") drawFog(true);
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
  const PROJECTS = [
    { name: "charmera", url: "https://charmera.teamremco.org/", blurb: "tiny camera, big sheet — photo collages",
      about: ["Drop up to a dozen tiny Charmera shots, arrange them, pick a theme, export one sheet.",
              "Every photo stays the same size: no cropping, no empty cells."],
      tags: ["photo", "camera", "collage", "print"] },
    { name: "squarehole", url: "https://squarehole.teamremco.org/", blurb: "every shape fits",
      about: ["A shape-sorter toy where every shape fits the square hole.",
              "Tap a piece to pick it up, tap again to drop, twist with two fingers to turn it. It can record."],
      tags: ["toy", "game", "shapes", "puzzle", "kids"] },
    { name: "abacus", url: "https://abacus.teamremco.org/", blurb: "a tactile soroban for curious minds",
      about: ["A Japanese soroban you move bead by bead, with sounds and shake-to-clear.",
              "Practice + − × ÷ on the beads or print a worksheet; step-by-step lessons included."],
      tags: ["soroban", "math", "arithmetic", "practice", "learning", "kids"] },
    { name: "crokinole", url: "https://crokinole.teamremco.org/", blurb: "around the board — the flicking game",
      about: ["The tabletop flicking game: place your disc on the line, flick it through, first to 100.",
              "Two or four players, teams or free-for-all, tournament scoring, board finishes and your own artwork."],
      tags: ["game", "board game", "tabletop", "multiplayer"] },
    { name: "penalties", url: "https://penalties.teamremco.org/", blurb: "USA Fencing penalty chart, quick reference",
      about: ["An unofficial guide to the USA Fencing penalty chart, with rule citations and diagrams.",
              "Start from the card the referee showed, browse by situation, or search all entries. The rulebook is the source."],
      tags: ["fencing", "rules", "referee", "cards", "usa fencing", "reference"] },
    { name: "newsletter", url: "https://newsletter.teamremco.org/", blurb: "En Garde Gazette — weekly épée newsletter",
      about: ["The En Garde Gazette, a weekly épée newsletter from Elite Fencers Club, Chatham NJ.",
              "Issues lie on a desk you can drag about; click a paper to read it, or browse the archive."],
      tags: ["fencing", "épée", "epee", "club", "news", "chatham"] }
  ];
  const LAUNCHPAD = { name: "launchpad", url: "https://frank-hp-elitedesk-800-g5-desktop-mini.taild9032.ts.net:8766/", blurb: "private launchpad (Tailscale only)",
    about: ["The Team Remco private launchpad. It only opens on the Team Remco Tailscale network."], tags: ["private", "tailscale"] };
  const DESTS = [...PROJECTS, LAUNCHPAD];
  const COMMANDS = ["help", "ls", "cd", "cat", "grep", "weather", "live", "calc", "password", "sisyphus", "clear"];
  const fold = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  function grepLines(p) { return [p.blurb, ...p.about, "tags: " + p.tags.join(", ")]; }
  function printLink(p, withBlurb) {
    printRich(div => {
      const a = document.createElement("a");
      a.href = p.url; a.textContent = p.name; a.style.color = "inherit";
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
    if (!canvasMotion()) {
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
    if (!sisyphusBusy) {
      termStatus.textContent = "thinking…";
      setTimeout(() => { if (!sisyphusBusy) termStatus.textContent = "ready"; }, 250);
    }

    const [verbRaw, ...rest] = cmd.split(/\s+/);
    const verb = verbRaw.toLowerCase(), arg = rest.join(" ").trim();

    switch (verb) {
      case "help":
        print("this console understands:", "ok");
        ["ls — list our projects (ls -l adds a line about each)",
         "cd <project> — go to it; e.g. cd crokinole (Tab completes names)",
         "cat <project> — what it is, without leaving; e.g. cat abacus",
         "grep <word> — find projects by what they do; e.g. grep fencing",
         "weather [clear|cloud|rain|storm|snow|fog|live] — live NYC sky or honest preview",
         "live — return to live New York weather",
         "calc <expr> — safe pocket calculator, e.g. calc (3+4)*2",
         "password [length] — crypto-secure password, auto-copied; e.g. password 20",
         "sisyphus — he pushes. you watch.",
         "clear — wipe the console"
        ].forEach(l => print("  " + l));
        break;
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
          a.href = p.url; a.textContent = p.url; a.style.color = "inherit";
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
            a.href = p.url; a.textContent = p.name; a.style.color = "inherit";
            div.appendChild(document.createTextNode("  "));
            div.appendChild(a);
            div.appendChild(document.createTextNode(": " + line));
          });
        });
        break;
      }
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
        print(`“${verbRaw}” isn’t an instrument yet. Type “help”.`, "err");
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
  window.addEventListener("keydown", e => {
    if (e.key === "/" && document.activeElement !== input && !e.metaKey && !e.ctrlKey) { e.preventDefault(); input.focus(); }
  });

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
    window.addEventListener("resize", () => { sizeSky(); if (!canvasMotion()) drawOnce(); });
    prefersReduced.addEventListener?.("change", () => { renderMotion(); drawOnce(); });
    print("team remco online — one New York sky, one tiny console. type “help”.", "ok");
    print("live sky follows NYC · previews are honestly labeled.", "dim");
    fetchWeather();
    setInterval(fetchWeather, 10 * 60 * 1000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
