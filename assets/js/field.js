// The glyph field behind the page.
//
// A fixed canvas is divided into character cells, and every cell draws one
// glyph from a pre-rendered atlas. The first screen is a drive: a pixel rally
// car on an endless road passes a coastline city, a suspension bridge,
// farmland, snowy mountains, a desert and a forest, while the day turns from
// morning to night and back. The rest of the page is a plot: a dotted grid,
// ridgeline traces and heavy dashes that come and go. The footer sits on
// water, and a numbered ruler runs along the top edge. Elements with the class
// `ko` are cut out of the field so their text stays readable.
//
// The whole field scrolls at PARALLAX times the page speed. Cells are worked
// out in scene rows, and the grid is drawn shifted by the leftover fraction of
// a row, so it glides with the page instead of jumping a row at a time.
(function () {
  "use strict";

  const canvas = document.getElementById("field");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d", { alpha: false });
  const root = document.documentElement;
  const reducedMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  const darkMQ = window.matchMedia("(prefers-color-scheme: dark)");

  // ---------------------------------------------------------------- noise ---

  function mulberry32(a) {
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const perm = new Uint8Array(512);
  const perm12 = new Uint8Array(512);
  (function () {
    const rand = mulberry32(20260925);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = (rand() * (i + 1)) | 0;
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) {
      perm[i] = p[i & 255];
      perm12[i] = perm[i] % 12;
    }
  })();

  const GRAD = new Int8Array([
    1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
    1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
    0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1,
  ]);
  const F3 = 1 / 3;
  const G3 = 1 / 6;

  // 3D simplex noise (after Stefan Gustavson), roughly in [-1, 1].
  function noise3(xin, yin, zin) {
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const z0 = zin - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let n = 0;
    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 > 0) {
      const g = perm12[ii + perm[jj + perm[kk]]] * 3;
      t0 *= t0;
      n += t0 * t0 * (GRAD[g] * x0 + GRAD[g + 1] * y0 + GRAD[g + 2] * z0);
    }
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 > 0) {
      const g = perm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3;
      t1 *= t1;
      n += t1 * t1 * (GRAD[g] * x1 + GRAD[g + 1] * y1 + GRAD[g + 2] * z1);
    }
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 > 0) {
      const g = perm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3;
      t2 *= t2;
      n += t2 * t2 * (GRAD[g] * x2 + GRAD[g + 1] * y2 + GRAD[g + 2] * z2);
    }
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 > 0) {
      const g = perm12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3;
      t3 *= t3;
      n += t3 * t3 * (GRAD[g] * x3 + GRAD[g + 1] * y3 + GRAD[g + 2] * z3);
    }
    return 32 * n;
  }

  function hash2(a, b) {
    let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function hash3(a, b, c) {
    return hash2((a | 0) + Math.imul(c | 0, 1442695041), (b | 0) ^ Math.imul(c | 0, -2048144777));
  }

  function smooth(a, b, x) {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function mod(a, n) {
    return ((a % n) + n) % n;
  }

  // --------------------------------------------------------------- glyphs ---

  // Every glyph here exists in Departure Mono.
  const SETS = {
    cloudDense: "■■■▪═■",
    cloudMid: "=+□▪≈=",
    cloudEdge: "-:·.'-",
    digits: "0123456789",
    base: ".:'`,",
    rock: "#X=\\",
    water: "─═-—~≈─",
    reflect: "─-─═-",
    energy: "<>/\\|-=+*#%&",
    dust: ".·°'`,",
    canopy: "@%&♣@%",
    pineTop: "▲^♠",
    field: "-=:~\"',",
    crop: "\"',;\"",
    fern: ",;'\"`",
    // 2×2 block glyphs, indexed by top-left·8 + top-right·4 + bottom-left·2 + bottom-right.
    quads: " ▗▖▄▝▐▞▟▘▚▌▙▀▜▛█",
  };
  const EXTRA = "/\\-─═■·^_|.━•¯│┊╷□▪┌┐╭╮╧║╦┬┼▲▼+✦o┃┗┛Ψ▟▙▄█▓@&v◄╪╗~";
  const GLYPHS = Array.from(new Set(Array.from(Object.values(SETS).join("") + EXTRA)));
  const GI = new Map(GLYPHS.map(function (g, i) { return [g, i]; }));
  const S = {};
  for (const key in SETS) S[key] = Int16Array.from(Array.from(SETS[key]), function (g) { return GI.get(g); });
  function G(g) {
    return GI.get(g);
  }
  const G_SLASH = G("/"), G_BACK = G("\\"), G_DASH = G("-"), G_H = G("─"), G_HH = G("═");
  const G_SQ = G("■"), G_DOT = G("·"), G_CARET = G("^"), G_HEAVY = G("━"), G_BULLET = G("•");
  const G_MACRON = G("¯"), G_US = G("_"), G_PIPE = G("│"), G_GRID = G("┊"), G_TICK = G("╷");
  const G_OPEN = G("□"), G_SMALL = G("▪"), G_TL = G("┌"), G_TR = G("┐"), G_RTL = G("╭"), G_RTR = G("╮");
  const G_POST = G("╧"), G_DPIPE = G("║"), G_DTEE = G("╦"), G_TEE = G("┬"), G_CROSS = G("┼");
  const G_TRI = G("▲"), G_DOWN = G("▼"), G_PLUS = G("+"), G_SPARK = G("✦"), G_O = G("o");
  const G_HPIPE = G("┃"), G_BLH = G("┗"), G_BRH = G("┛"), G_PSI = G("Ψ"), G_DARK = G("▓");
  const G_ROCK_L = G("▟"), G_ROCK_R = G("▙"), G_ROCK_M = G("█"), G_ROCK_T = G("▄");
  const G_AT = G("@"), G_AMP = G("&"), G_V = G("v"), G_TILDE = G("~");
  const PLANE = Array.from("◄═╪═╗", G);

  // Atlas rows 0–6 are ink at falling opacity, rows 7–9 the accent, and rows
  // 10–16 the page colour at the same opacities as 0–6, for glyphs drawn on a
  // dark night sky.
  const FG_LEVELS = [1, 0.8, 0.6, 0.44, 0.32, 0.22, 0.13];
  const AC_LEVELS = [1, 0.62, 0.34];

  function pick(set, h) {
    return set[(h * set.length) | 0];
  }

  // ---------------------------------------------------------------- state ---

  const MAX_CELLS = 17000;
  const FPS = 30;
  const PARALLAX = 0.5;
  // Plot layer: a dotted grid line every GRID columns, and ridgeline traces
  // TRACE_ROWS rows apart with heavy dashes and dots placed on them.
  const GRID = 6;
  const TRACE_ROWS = 5;
  const SLOT = 7;

  // The drive. Each layer drifts past at its own speed in px/s, and every
  // BIOME_LEN px of the front layer the road reaches the next place. The
  // slower layers change over at the same moment, so distant scenery arrives
  // first and the foreground follows.
  const SPEED_HILLS = 8;
  const SPEED_MID = 16;
  const SPEED_NEAR = 30;
  const SPEED_ROAD = 54;
  const BIOME_LEN = 1300;
  const BLEND = 0.2;
  const LEN_MID = (BIOME_LEN * SPEED_MID) / SPEED_NEAR;
  const LEN_HILLS = (BIOME_LEN * SPEED_HILLS) / SPEED_NEAR;
  const CITY = 0, BRIDGE = 1, COUNTRY = 2, MOUNTAINS = 3, DESERT = 4, FOREST = 5, NB = 6;
  const LOT_NEAR = 14;
  const LOT_MID = 9;
  // A whole day passes in DAY_LENGTH seconds, starting mid-morning.
  const DAY_LENGTH = 150;
  const START_HOUR = 9;
  const NOT_HERE = -3;

  let dpr = 1, vw = 0, vh = 0;
  let fontPx = 11, cw = 7, ch = 14, cwD = 7, chD = 14;
  let cols = 0, rows = 0, N = 0;
  let atlas = null;
  let colors = { bg: "#f3f2ee", fg: "#0b0b0b", accent: "#ff4f00" };
  let bgRGB = [243, 242, 238], fgRGB = [11, 11, 11], acRGB = [255, 79, 0];
  let darkPage = false;
  let mask, E, RA;
  // Per column: terrain height, terrain biome, and the biome of the front
  // layer, the middle layer and the road and water.
  let HF, HB, NBI, MBI, BB;
  // Per row: how far the scene's background is from the page colour, whether
  // glyphs there are drawn in the page colour, and the row's fill.
  let tone, rowInv, rowFill = [];
  // What each cell showed last frame, and each row's fill, so a frame only
  // redraws what changed. -9 marks a cell something was drawn over.
  let prevCode, prevFill = [];
  let fullRedraw = true, lastRowOff = -1, lastFracD = -1;
  let traceBuf = new Float32Array(0);
  let traceK0 = 0, traceCount = 0, traceGap = 70, traceAmp = 180;
  // Sub-row shift of the grid in CSS px and device px, and where the footer's
  // water starts in scene px.
  let frac = 0, fracD = 0, seaTop = Infinity;
  let heroEl = null, shoreEl = null, koEls = [];
  let heroH = 0;
  let reduced = reducedMQ.matches;
  let started = false;
  let raf = 0, lastDraw = 0, lastT = 0, lastScroll = -1;
  const pulses = [];
  const dust = [];
  let lastDust = 0;
  const L = { H: 0, cloudBase: 0, cityH: 0, farCityH: 0, roadTop: 0, waterTop: 0, groundEnd: 0 };
  const env = { day: 1, night: 0, dusk: 0, sunX: 0, sunY: 0, sunR: 0, moonX: 0, moonY: 0, moonR: 0 };
  const car = { x: 0, y: 0, w: 0, h: 0, p: 4, hopT: -10, visible: false };

  function rgbOf(str, fallback) {
    const m = /^#([0-9a-f]{6})$/i.exec(str);
    if (!m) return fallback;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function readColors() {
    const cs = getComputedStyle(root);
    colors = {
      bg: cs.getPropertyValue("--bg").trim() || colors.bg,
      fg: cs.getPropertyValue("--fg").trim() || colors.fg,
      accent: cs.getPropertyValue("--accent").trim() || colors.accent,
    };
    bgRGB = rgbOf(colors.bg, bgRGB);
    fgRGB = rgbOf(colors.fg, fgRGB);
    acRGB = rgbOf(colors.accent, acRGB);
    darkPage = bgRGB[0] + bgRGB[1] + bgRGB[2] < 384;
  }

  // The page colour moved T of the way towards the ink, then `glow` of the way
  // towards the accent.
  function tint(T, glow) {
    const out = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      out[i] = Math.round((bgRGB[i] + (fgRGB[i] - bgRGB[i]) * T) * (1 - glow) + acRGB[i] * glow);
    }
    return "rgb(" + out[0] + "," + out[1] + "," + out[2] + ")";
  }

  function buildAtlas() {
    atlas = document.createElement("canvas");
    atlas.width = GLYPHS.length * cwD;
    atlas.height = 17 * chD;
    const a = atlas.getContext("2d");
    a.font = fontPx * dpr + 'px "Departure Mono", ui-monospace, Menlo, monospace';
    a.textBaseline = "alphabetic";
    const baseline = Math.round(fontPx * dpr);
    for (let row = 0; row < 17; row++) {
      if (row < 7) {
        a.fillStyle = colors.fg;
        a.globalAlpha = FG_LEVELS[row];
      } else if (row < 10) {
        a.fillStyle = colors.accent;
        a.globalAlpha = AC_LEVELS[row - 7];
      } else {
        a.fillStyle = colors.bg;
        a.globalAlpha = FG_LEVELS[row - 10];
      }
      for (let i = 0; i < GLYPHS.length; i++) a.fillText(GLYPHS[i], i * cwD, row * chD + baseline);
    }
  }

  function measureLayout() {
    heroEl = document.querySelector("[data-hero]");
    shoreEl = document.querySelector("[data-shore]");
    koEls = Array.from(document.querySelectorAll(".ko"));
    heroH = heroEl ? heroEl.offsetHeight : 0;
    // The water reaches the shore spacer exactly when the page is scrolled to
    // the end, and stays below it before that.
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    seaTop = shoreEl
      ? shoreEl.getBoundingClientRect().top + window.scrollY - maxScroll * (1 - PARALLAX)
      : Infinity;
  }

  function setup() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    vw = rect.width;
    vh = rect.height;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    let scale = scaleFloor;
    for (;;) {
      fontPx = 11 * scale;
      cwD = Math.max(1, Math.round(((fontPx * 350) / 550) * dpr));
      chD = Math.max(1, Math.round(((fontPx * 700) / 550) * dpr));
      cols = Math.ceil(canvas.width / cwD);
      rows = Math.ceil(canvas.height / chD) + 1;
      if (cols * rows <= MAX_CELLS || scale >= 2) break;
      scale += 0.25;
    }
    cw = cwD / dpr;
    ch = chD / dpr;
    N = cols * rows;
    mask = new Uint8Array(N);
    E = new Float32Array(N);
    RA = new Float32Array(N);
    for (let i = 0; i < N; i++) RA[i] = hash2(i, 7);
    HF = new Float32Array(cols);
    HB = new Uint8Array(cols);
    NBI = new Uint8Array(cols);
    MBI = new Uint8Array(cols);
    BB = new Uint8Array(cols);
    tone = new Float32Array(rows);
    rowInv = new Uint8Array(rows);
    rowFill = new Array(rows).fill(null);
    prevCode = new Int32Array(N);
    prevFill = new Array(rows).fill(null);
    fullRedraw = true;
    readColors();
    buildAtlas();
    measureLayout();
  }

  // ------------------------------------------------------------- knockout ---

  function buildMask() {
    mask.fill(0);
    const padX = cw * 1.5;
    const padY = ch * 0.6;
    for (let n = 0; n < koEls.length; n++) {
      const rects = koEls[n].getClientRects();
      for (let k = 0; k < rects.length; k++) {
        const rc = rects[k];
        if (rc.width === 0 || rc.bottom < -ch || rc.top > vh + ch) continue;
        const c0 = Math.max(0, Math.floor((rc.left - padX) / cw));
        const c1 = Math.min(cols - 1, Math.floor((rc.right + padX) / cw));
        const r0 = Math.max(0, Math.floor((rc.top - padY + frac) / ch));
        const r1 = Math.min(rows - 1, Math.floor((rc.bottom + padY + frac) / ch));
        const ic0 = Math.floor(rc.left / cw), ic1 = Math.floor(rc.right / cw);
        const ir0 = Math.floor((rc.top + frac) / ch), ir1 = Math.floor((rc.bottom + frac) / ch);
        for (let r = r0; r <= r1; r++) {
          const inRow = r >= ir0 && r <= ir1;
          for (let c = c0; c <= c1; c++) {
            const idx = r * cols + c;
            if (inRow && c >= ic0 && c <= ic1) mask[idx] = 1;
            else if (mask[idx] === 0) mask[idx] = 2;
          }
        }
      }
    }
  }

  // ------------------------------------------------------------ time of day ---

  function computeEnv(t) {
    const h = (START_HOUR + (24 * t) / DAY_LENGTH) % 24;
    env.day = smooth(5, 7, h) * (1 - smooth(18, 20, h));
    env.night = 1 - env.day;
    env.dusk = 4 * env.day * env.night;
    const scale = Math.min(1.2, Math.max(0.7, vw / 1200));
    const horizon = L.roadTop - ch * 2;
    // The sun is up from 5:00 to 20:00 and the moon from 19:30 to 5:30.
    const sp = (h - 5) / 15;
    if (sp > 0 && sp < 1) {
      env.sunX = vw * (0.08 + 0.84 * sp);
      env.sunY = horizon - Math.sin(Math.PI * sp) * L.H * 0.55;
      env.sunR = (20 + 16 * env.dusk) * scale;
    } else env.sunR = 0;
    const mp = mod(h - 19.5, 24) / 10;
    if (mp > 0 && mp < 1) {
      env.moonX = vw * (0.1 + 0.8 * mp);
      env.moonY = horizon - Math.sin(Math.PI * mp) * L.H * 0.47;
      env.moonR = 15 * scale;
    } else env.moonR = 0;
  }

  // On the light page the night darkens the scene, and glyphs there switch to
  // the page colour. On the dark page the day lightens the sky a little. Dusk
  // and dawn add an accent glow near the horizon on both.
  function computeTone(fade, rowOff) {
    for (let r = 0; r < rows; r++) {
      const sy = (r + rowOff + 0.5) * ch;
      let T = 0, glow = 0;
      if (fade > 0 && sy < L.groundEnd) {
        const f = smooth(L.cloudBase * 0.2, L.roadTop, sy);
        const sky = sy < L.roadTop;
        if (!darkPage) {
          const n = Math.pow(env.night, 1.3);
          T = sky ? n * (0.94 - f * (0.08 + 0.5 * (1 - env.night))) : n * 0.88;
        } else {
          T = sky ? env.day * (0.07 + 0.08 * f) + env.dusk * 0.1 * f : env.day * 0.04;
        }
        if (sky) glow = env.dusk * 0.2 * f * f;
        const k = fade * (1 - smooth(L.H * 0.98, L.groundEnd, sy));
        T *= k;
        glow *= k;
      }
      tone[r] = T;
      rowInv[r] = T > 0.5 ? 1 : 0;
      rowFill[r] = T > 0.004 || glow > 0.004 ? tint(T, glow) : null;
    }
  }

  // --------------------------------------------------------------- places ---

  // Which place a point of a layer belongs to. Near the end of each stretch the
  // next place takes over, first for a few objects and then for all of them.
  function biomeAt(wx, len, key, salt) {
    const b = wx / len;
    const i = Math.floor(b);
    const next = hash2(key, salt) < smooth(1 - BLEND, 1, b - i) ? 1 : 0;
    return mod(i + next, NB);
  }

  function nearBiomeAt(x, t) {
    const lot = Math.floor(Math.floor((x + t * SPEED_NEAR) / cw) / LOT_NEAR);
    return biomeAt((lot + 0.5) * LOT_NEAR * cw, BIOME_LEN, lot, 41);
  }

  function ridge(u, seed) {
    const a = 1 - Math.abs(noise3(u, seed, 0.37));
    const b = noise3(u * 2.6, seed + 4.1, 1.13) * 0.5 + 0.5;
    const d = noise3(u * 6.3, seed + 9.2, 2.71) * 0.5 + 0.5;
    return Math.min(1, a * a * 0.6 + b * 0.3 + d * 0.1);
  }

  function terrainHeight(biome, u) {
    const H = L.H;
    switch (biome) {
      case CITY: return H * 0.28 * ridge(u, 1.7);
      case BRIDGE: return H * 0.1 * ridge(u * 0.8, 3.1);
      case COUNTRY: return H * 0.2 * (0.35 + 0.65 * (noise3(u * 0.6, 11.1, 0.3) * 0.5 + 0.5));
      case MOUNTAINS: return H * 0.56 * Math.pow(ridge(u * 1.3, 4.4), 1.3);
      case DESERT: {
        const n = noise3(u * 0.5, 21.7, 0.8) * 0.5 + 0.5;
        return H * 0.13 * (0.3 + 0.7 * n * n);
      }
      default: return H * 0.3 * (0.4 + 0.6 * (noise3(u * 0.8, 31.3, 1.9) * 0.5 + 0.5));
    }
  }

  function computeColumns(t) {
    for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * cw;
      const wh = x + t * SPEED_HILLS;
      const b = wh / LEN_HILLS;
      const i = Math.floor(b);
      const w = smooth(1 - BLEND, 1, b - i);
      const u = wh / 520;
      let h = terrainHeight(mod(i, NB), u);
      let tb = mod(i, NB);
      if (w > 0) {
        h += (terrainHeight(mod(i + 1, NB), u) - h) * w;
        if (hash2(Math.floor(wh / (cw * 3)), 5) < w) tb = mod(i + 1, NB);
      }
      HF[c] = L.roadTop - h;
      HB[c] = tb;
      const wn = x + t * SPEED_NEAR;
      BB[c] = biomeAt(wn, BIOME_LEN, Math.floor(wn / cw), 51);
      NBI[c] = nearBiomeAt(x, t);
      const mlot = Math.floor(Math.floor((x + t * SPEED_MID) / cw) / LOT_MID);
      MBI[c] = biomeAt((mlot + 0.5) * LOT_MID * cw, LEN_MID, mlot, 31);
    }
  }

  // Samples every visible trace at each column edge, in scene pixels. A trace
  // sits on its baseline and rises above it by up to traceAmp, so neighbouring
  // traces cross each other.
  function computeTraces(t, sceneTop) {
    traceGap = ch * TRACE_ROWS;
    traceAmp = traceGap * 2.6;
    traceK0 = Math.floor(sceneTop / traceGap) - 1;
    const k1 = Math.ceil((sceneTop + vh + ch + traceAmp) / traceGap) + 1;
    traceCount = k1 - traceK0 + 1;
    const stride = cols + 1;
    if (traceBuf.length < traceCount * stride) traceBuf = new Float32Array(traceCount * stride);
    for (let n = 0; n < traceCount; n++) {
      const k = traceK0 + n;
      const baseY = k * traceGap;
      const amp = traceAmp * (0.55 + 0.45 * hash2(k, 3));
      for (let c = 0; c <= cols; c++) {
        const x = c * cw;
        const n1 = noise3(x / 260, k * 0.61, t * 0.04);
        const n2 = noise3(x / 95, k * 1.37 + 7, t * 0.06);
        const env2 = 0.6 + 0.4 * noise3(x / 700, k * 0.23, 5.5);
        const h = env2 * (0.6 * Math.max(0, n1) + 0.4 * Math.pow(n2 * 0.5 + 0.5, 3));
        traceBuf[n * stride + c] = baseY - amp * h;
      }
    }
  }

  // ------------------------------------------------------------------ sky ---

  // 2×2 coverage of a disc within one cell, as an index into S.quads. With
  // `stripes` the lower half is cut into bands, the way a low sun looks.
  function discBits(x, sy, cx, cy, R, stripes) {
    let bits = 0;
    const qx = cw / 4, qy = ch / 4;
    for (let k = 0; k < 4; k++) {
      const dx = x + (k & 1 ? qx : -qx) - cx;
      const dy = sy + (k & 2 ? qy : -qy) - cy;
      if (dx * dx + dy * dy > R * R) continue;
      if (stripes && dy > R * 0.1 && Math.floor(dy / (R * 0.2)) % 2 === 1) continue;
      bits |= 8 >> k;
    }
    return bits;
  }

  // The sky texture changes slowly, so one noise sample serves two columns.
  let zzKey = -1, zzVal = 0;

  function skyCell(c, sr, x, sy, t) {
    // Clouds only form in the upper part of the sky.
    if (sy < L.cloudBase * 1.3) {
      const hv = hash3(c, sr, Math.floor(t * 0.4 + hash2(c, sr + 5000) * 8));
      const cx = (x + t * 4) / 230, cy = sy / 115;
      const d = noise3(cx, cy, t * 0.018) * 0.62 + noise3(cx * 2.3, cy * 2.3, t * 0.03 + 5.1) * 0.38;
      const v = d - (0.1 + 0.1 * env.night + 0.6 * smooth(L.cloudBase * 0.35, L.cloudBase * 1.25, sy));
      if (v > 0.26) return hv < 0.07 ? (pick(S.digits, hv * 14) << 4) | 1 : pick(S.cloudDense, hv) << 4;
      if (v > 0.13) return hv < 0.1 ? (pick(S.digits, hv * 10) << 4) | 1 : (pick(S.cloudMid, hv) << 4) | 1;
      if (v > 0.03) return (pick(S.cloudEdge, hv) << 4) | 3;
    }
    if (env.sunR > 0 && Math.abs(x - env.sunX) < env.sunR + cw && Math.abs(sy - env.sunY) < env.sunR + ch) {
      const bits = discBits(x, sy, env.sunX, env.sunY, env.sunR, env.dusk > 0.35);
      if (bits) return (S.quads[bits] << 4) | (env.dusk > 0.35 ? 7 : 8);
    }
    if (env.moonR > 0 && Math.abs(x - env.moonX) < env.moonR + cw && Math.abs(sy - env.moonY) < env.moonR + ch) {
      let bits = discBits(x, sy, env.moonX, env.moonY, env.moonR, false);
      if (bits) bits &= ~discBits(x, sy, env.moonX + env.moonR * 0.5, env.moonY - env.moonR * 0.15, env.moonR * 0.85, false);
      if (bits) return S.quads[bits] << 4;
    }
    if (env.night > 0.3) {
      const hs = hash2(c * 7 + 3, sr * 13 + 1);
      if (hs < 0.022 * env.night) {
        const tw = hash3(c, sr, Math.floor(t * 1.7 + hs * 90));
        return tw < 0.72 ? (G_DOT << 4) | 2 : tw < 0.92 ? (G_PLUS << 4) | 1 : G_SPARK << 4;
      }
    }
    if (sy < L.roadTop) {
      const key = sr * 4096 + (c >> 1);
      if (key !== zzKey) {
        zzKey = key;
        zzVal = noise3(((c | 1) * cw) / 320 + t * 0.012, sy / 150, 9.1);
      }
      if (zzVal > 0.32) return ((c & 1 ? G_BACK : G_SLASH) << 4) | (zzVal > 0.5 ? 4 : 5);
    }
    const hs = hash2(Math.floor((x + t * 9) / cw), sr + 400);
    if (hs < 0.01) return ((hs < 0.006 ? G_DASH : G_DOT) << 4) | 4;
    return c % GRID === 0 ? (G_GRID << 4) | 6 : -1;
  }

  // -------------------------------------------------------------- terrain ---

  function terrainCell(c, sr, sy, t) {
    const h = HF[c];
    const hl = HF[c > 0 ? c - 1 : c];
    const hr = HF[c < cols - 1 ? c + 1 : c];
    const slope = (hr - hl) / (2 * cw);
    const depth = (sy - h) / ch;
    const wc = Math.floor(((c + 0.5) * cw + t * SPEED_HILLS) / cw);
    const hv = hash2(wc, sr + 1900);
    const edge = depth < Math.max(1, (Math.abs(slope) * cw) / ch + 0.6);
    let eg = G_DASH;
    if (slope < -0.3) eg = G_SLASH;
    else if (slope > 0.3) eg = G_BACK;
    else if (hl > h && hr > h) eg = G_CARET;
    switch (HB[c]) {
      case MOUNTAINS: {
        if (edge) return (eg << 4) | 1;
        // High peaks keep snow on top.
        const peak = (L.roadTop - h) / (L.H * 0.56);
        if (peak > 0.5 && depth < 1.5 + peak * 5) return hv < 0.05 ? (G_DOT << 4) | 4 : -1;
        const fade = 1 - smooth(4, 18, depth);
        if (slope > 0.05) {
          if (mod(wc - sr, 3) === 0 && hv < 0.85 * fade + 0.1) return (G_BACK << 4) | 2;
          if (hv < 0.35 * fade) return (pick(S.rock, hash2(wc, sr)) << 4) | 2;
        } else if (mod(wc + sr, 4) === 0 && hv < 0.6 * fade) return (G_SLASH << 4) | 3;
        return hv < 0.05 ? (pick(S.base, hash2(sr, wc)) << 4) | 4 : -1;
      }
      case FOREST: {
        if (edge) return (G_TRI << 4) | 2;
        if (mod(wc + (sr & 1) * 2, 3) === 0 && hv < 0.9 - depth * 0.05) {
          return (pick(S.pineTop, hv) << 4) | (depth < 4 ? 3 : 4);
        }
        return -1;
      }
      case COUNTRY: {
        // Rolling hills in a patchwork of fields with hedges between them.
        if (edge) return ((Math.abs(slope) < 0.3 ? G_US : eg) << 4) | 3;
        if (mod(wc, 10) === 0) return (G_DOT << 4) | 5;
        const style = hash2(Math.floor(wc / 10) * 31 + Math.floor(depth / 2.5), 3);
        if (style < 0.25) return -1;
        if ((sr & 1) === 0) return (pick(S.field, style) << 4) | 4;
        return style > 0.6 && hv < 0.5 ? (G_DOT << 4) | 5 : -1;
      }
      case DESERT: {
        if (edge) return ((Math.abs(slope) < 0.3 ? G_TILDE : eg) << 4) | 3;
        if (mod(sr + Math.floor(wc / 5), 3) === 0 && hv < 0.45) return (G_TILDE << 4) | 5;
        return hv < 0.04 ? (G_DOT << 4) | 5 : -1;
      }
      default: {
        // Low hills behind the city and across the bay.
        if (edge) return (eg << 4) | 3;
        const fade = 1 - smooth(3, 10, depth);
        if (slope > 0.05) {
          if (mod(wc - sr, 3) === 0 && hv < 0.7 * fade + 0.1) return (G_BACK << 4) | 4;
        } else if (mod(wc + sr, 4) === 0 && hv < 0.4 * fade) return (G_SLASH << 4) | 5;
        return hv < 0.04 ? (pick(S.base, hash2(sr, wc)) << 4) | 5 : -1;
      }
    }
  }

  // --------------------------------------------------------------- objects ---
  // Objects stand on lots of a fixed width along an endless roadside, and
  // everything about an object comes from hashing its lot number. Each
  // function returns a glyph code, -1 for the blank inside of an object, or
  // NOT_HERE when the point is not on one. `ly` counts rows up from the road.

  // Windows switch on and off every few seconds, and more are lit at night.
  function windowCode(id, lx, ly, t) {
    const hw = hash2(id * 64 + lx, ly + 300);
    const on = hash3(id * 64 + lx, ly, Math.floor(t / 7 + hw * 7)) < 0.3 + 0.4 * env.night;
    if (!on) return (G_OPEN << 4) | 3;
    return hw < 0.035 ? (G_SMALL << 4) | 7 : (G_SMALL << 4) | 1;
  }

  function building(wc, ly, t) {
    const lot = Math.floor(wc / LOT_NEAR);
    const w = 6 + ((hash2(lot, 11) * 8) | 0);
    const lx = wc - lot * LOT_NEAR - ((hash2(lot, 12) * (LOT_NEAR - w)) | 0);
    if (lx < 0 || lx >= w) return NOT_HERE;
    const floors = Math.max(3, Math.round((L.cityH * (0.15 + 0.85 * Math.pow(hash2(lot, 13), 1.4))) / ch));
    const style = (hash2(lot, 14) * 5) | 0;
    const ha = hash2(lot, 15);
    if (ly >= floors) {
      // Some roofs carry an antenna with a blinking warning light.
      const ant = ha < 0.35 ? 2 + (((ha * 30) | 0) % 3) : 0;
      if (!ant || lx !== w >> 1 || ly >= floors + ant) return NOT_HERE;
      if (ly < floors + ant - 1) return (G_PIPE << 4) | 1;
      return Math.floor(t / 0.8 + ha * 5) % 2 ? (G_BULLET << 4) | 7 : (G_TICK << 4) | 2;
    }
    let left = 0, right = w - 1;
    // Stepped towers are two cells narrower on each side above the shoulder.
    if (style === 3 && w > 7) {
      const shoulder = Math.floor(floors * 0.7);
      const outside = lx < 2 || lx > w - 3;
      if (ly > shoulder && outside) return NOT_HERE;
      if (ly === shoulder && outside) return ((lx === 0 ? G_TL : lx === w - 1 ? G_TR : G_H) << 4) | 1;
      if (ly > shoulder) {
        left = 2;
        right = w - 3;
      }
    }
    if (ly === floors - 1) {
      const round = style === 4;
      const g = lx === left ? (round ? G_RTL : G_TL) : lx === right ? (round ? G_RTR : G_TR) : G_H;
      return (g << 4) | 1;
    }
    if (lx === left || lx === right) return (G_PIPE << 4) | 1;
    const ix = lx - left;
    if (style === 1) {
      if (ly % 3 === 0) return (G_HH << 4) | 2;
      return ix % 2 === 1 ? windowCode(lot, lx, ly, t) : -1;
    }
    if (style === 2) {
      if (ix % 3 === 0) return (G_PIPE << 4) | 3;
      return ly % 2 === 1 ? windowCode(lot, lx, ly, t) : -1;
    }
    return ix % 2 === 1 && ly % 2 === 1 ? windowCode(lot, lx, ly, t) : -1;
  }

  function farBuilding(wc, ly, t) {
    const lot = Math.floor(wc / LOT_MID);
    const w = 4 + ((hash2(lot, 21) * 5) | 0);
    const lx = wc - lot * LOT_MID - ((hash2(lot, 22) * (LOT_MID - w)) | 0);
    if (lx < 0 || lx >= w) return NOT_HERE;
    const floors = Math.max(3, Math.round((L.farCityH * (0.3 + 0.7 * Math.pow(hash2(lot, 23), 1.2))) / ch));
    if (ly >= floors) return NOT_HERE;
    if (ly === floors - 1) return (G_H << 4) | 2;
    if (lx === 0 || lx === w - 1) return (G_PIPE << 4) | 3;
    if (lx % 2 === 1 && ly % 2 === 0) {
      const on = hash3(lot * 16 + lx, ly, Math.floor(t / 9 + hash2(lot, ly) * 9)) < 0.25 + 0.4 * env.night;
      return on ? (G_SMALL << 4) | 2 : (G_DOT << 4) | 4;
    }
    // Distant buildings are hatched so they read as a mass behind the front row.
    return mod(wc + ly, 3) === 0 ? (G_SLASH << 4) | 5 : -1;
  }

  // Street lamps along the promenade, lit at night, in front of the buildings.
  function cityNear(wc, ly, t) {
    const p = mod(wc, 23);
    if (ly <= 4 && p >= 7 && p <= 10) {
      if (p === 7) return ((ly === 4 ? G_TL : G_PIPE) << 4) | 1;
      if (p === 8 && ly === 4) return (G_H << 4) | 1;
      if (p === 9 && ly === 4) return env.night > 0.4 ? (G_SQ << 4) | 7 : (G_DOWN << 4) | 1;
      if (env.night > 0.4 && ly >= 2 && ly <= 3 && hash3(wc, ly, Math.floor(t * 4)) < 0.5) return (G_DOT << 4) | 8;
    }
    return building(wc, ly, t);
  }

  // A suspension bridge: a pair of legs every SPAN cells, the main cable
  // hanging between them, hangers down to the deck and a railing.
  const SPAN = 64;
  const LEGS = 4;
  function bridgeNear(wc, ly) {
    const th = Math.max(6, Math.round((L.H * 0.5) / ch));
    const lx = mod(wc, SPAN);
    if (lx < LEGS) {
      if (ly > th) return NOT_HERE;
      if (lx === 0 || lx === LEGS - 1) return ((ly === th ? G_DTEE : G_DPIPE) << 4) | 1;
      if (ly === th || ly === Math.round(th * 0.62) || ly === Math.round(th * 0.3)) return (G_HH << 4) | 1;
      return NOT_HERE;
    }
    if (ly === 0) return ((lx % 3 === 0 ? G_TEE : G_H) << 4) | 2;
    const span = SPAN - LEGS;
    const s0 = (lx - LEGS) / span, s1 = (lx - LEGS + 1) / span;
    const sag = th * 0.85;
    const h0 = Math.round(th - sag * 4 * s0 * (1 - s0));
    const h1 = Math.round(th - sag * 4 * s1 * (1 - s1));
    const lo = Math.min(h0, h1), hi = Math.max(h0, h1);
    if (ly >= lo && ly <= hi) return ((h0 === h1 ? G_H : h1 < h0 ? G_BACK : G_SLASH) << 4) | 1;
    if (lx % 3 === 1 && ly < lo) return (G_PIPE << 4) | 3;
    return NOT_HERE;
  }

  // A pine: a trunk, then rows that narrow to a point. `lvl` sets how dark it
  // is, so distant pines are lighter.
  function pine(wc, ly, salt, density, hmin, hmax, lvl) {
    const hwMax = Math.floor((hmax - 1) * 0.55);
    const lotW = 2 * hwMax + 5;
    const lot = Math.floor(wc / lotW);
    if (hash2(lot, salt) > density) return NOT_HERE;
    const cx = hwMax + 1 + ((hash2(lot, salt + 1) * 3) | 0);
    const hgt = hmin + ((hash2(lot, salt + 2) * (hmax - hmin + 1)) | 0);
    const dx = wc - lot * lotW - cx;
    if (ly === 0) return dx === 0 ? (G_PIPE << 4) | lvl : NOT_HERE;
    if (ly > hgt) return NOT_HERE;
    const hw = Math.floor((hgt - ly) * 0.55);
    if (dx < -hw || dx > hw) return NOT_HERE;
    if (hw === 0) return (G_TRI << 4) | lvl;
    if (dx === -hw) return (G_SLASH << 4) | lvl;
    if (dx === hw) return (G_BACK << 4) | lvl;
    return (ly + dx) & 1 ? (G_CARET << 4) | Math.min(6, lvl + 1) : -1;
  }

  // Farmland: round trees, the odd barn, and a fence along the road.
  function countryNear(wc, ly) {
    const lot = Math.floor(wc / LOT_NEAR);
    const lx = wc - lot * LOT_NEAR;
    const h = hash2(lot, 61);
    if (h < 0.55) {
      const cx = 3 + ((hash2(lot, 62) * 8) | 0);
      const rx = 2 + hash2(lot, 63) * 2.5;
      const ry = 1.4 + hash2(lot, 64) * 1.4;
      const trunk = 1 + ((hash2(lot, 65) * 2) | 0);
      const dx = (lx - cx) / rx, dy = (ly + 0.5 - trunk - ry) / ry;
      const d = dx * dx + dy * dy;
      if (d < 1) return (pick(S.canopy, hash2(wc, ly + lot)) << 4) | (d > 0.6 ? 2 : 1);
      if (lx === cx && ly <= trunk) return (G_PIPE << 4) | 1;
    } else if (h < 0.66 && lx >= 2 && lx <= 10) {
      if (ly <= 2) {
        if (lx === 2 || lx === 10) return (G_PIPE << 4) | 1;
        if (lx === 6 && ly <= 1) return (G_DARK << 4) | 1;
        if ((lx === 4 || lx === 8) && ly === 1) return (G_SMALL << 4) | 1;
        if (ly > 0) return -1;
      } else if (ly <= 6) {
        const k = ly - 3;
        if (lx === 2 + k) return ((2 + k >= 10 - k ? G_CARET : G_SLASH) << 4) | 1;
        if (lx === 10 - k) return (G_BACK << 4) | 1;
        if (lx > 2 + k && lx < 10 - k) return (lx + ly) % 2 ? (G_SLASH << 4) | 4 : -1;
      }
    }
    if (ly === 0) return ((mod(wc, 4) === 0 ? G_CROSS : G_H) << 4) | 3;
    return NOT_HERE;
  }

  // Desert: saguaros with an arm on each side, small cacti and rocks.
  function desertNear(wc, ly) {
    const lot = Math.floor(wc / 16);
    const lx = wc - lot * 16;
    const h = hash2(lot, 91);
    const cx = 4 + ((hash2(lot, 92) * 8) | 0);
    const dx = lx - cx;
    if (h < 0.4) {
      const hgt = 4 + ((hash2(lot, 93) * 4) | 0);
      const a1 = 1 + ((hash2(lot, 94) * 2) | 0), a2 = a1 + 1;
      if (dx === 0 && ly <= hgt) return (G_HPIPE << 4) | 1;
      if (dx === -1 && ly === a1) return (G_HEAVY << 4) | 1;
      if (dx === -2 && ly === a1) return (G_BLH << 4) | 1;
      if (dx === -2 && ly > a1 && ly <= a1 + 2) return (G_HPIPE << 4) | 1;
      if (dx === 1 && ly === a2) return (G_HEAVY << 4) | 1;
      if (dx === 2 && ly === a2) return (G_BRH << 4) | 1;
      if (dx === 2 && ly > a2 && ly <= a2 + 2) return (G_HPIPE << 4) | 1;
    } else if (h < 0.55) {
      if (dx === 0 && ly === 0) return (G_PSI << 4) | 1;
    } else if (h < 0.68) {
      if (ly === 0 && dx >= 0 && dx <= 2) return ((dx === 0 ? G_ROCK_L : dx === 2 ? G_ROCK_R : G_ROCK_M) << 4) | 2;
      if (ly === 1 && dx === 1) return (G_ROCK_T << 4) | 2;
    }
    return NOT_HERE;
  }

  // Forest: two rows of tall pines with patches of fog drifting between them.
  function forestNear(wc, ly, t) {
    let p = pine(wc, ly, 81, 0.9, 7, 13, 1);
    if (p !== NOT_HERE) return p;
    p = pine(wc + 9, ly, 85, 0.8, 5, 10, 2);
    if (p !== NOT_HERE) return p;
    if (ly >= 2 && ly <= 6 && hash3(wc >> 1, ly, Math.floor(t * 0.7)) < 0.12) return (G_DASH << 4) | 5;
    return NOT_HERE;
  }

  function nearCell(x, sy, t, biome) {
    const ly = Math.floor((L.roadTop - sy) / ch);
    if (ly < 0) return NOT_HERE;
    const wc = Math.floor((x + t * SPEED_NEAR) / cw);
    switch (biome) {
      case CITY: return cityNear(wc, ly, t);
      case BRIDGE: return bridgeNear(wc, ly);
      case COUNTRY: return countryNear(wc, ly);
      case MOUNTAINS: return pine(wc, ly, 71, 0.5, 4, 9, 1);
      case DESERT: return desertNear(wc, ly);
      default: return forestNear(wc, ly, t);
    }
  }

  // A railway in the middle distance. Every so often a train runs along it
  // from right to left, faster than the scenery.
  const TRAIN_CAR = 11;
  function railCell(x, ly, t) {
    if (ly < 3 || ly > 5) return NOT_HERE;
    const rail = (G_H << 4) | 3;
    const k = Math.floor(t / 24);
    const head = vw + 60 - (t - k * 24) * 170;
    const dx = x - head;
    if (hash2(k, 7) > 0.8 || dx < 0 || dx >= 7 * TRAIN_CAR * cw) return ly === 3 ? rail : NOT_HERE;
    const car = Math.floor(dx / (TRAIN_CAR * cw));
    const lx = Math.floor(dx / cw) - car * TRAIN_CAR;
    if (ly === 3) return lx === 1 || lx === 8 ? (G_O << 4) | 1 : rail;
    if (lx === 10) return ly === 4 ? (G_H << 4) | 2 : NOT_HERE;
    if (ly === 5) return ((lx === 0 ? (car === 0 ? G_RTL : G_TL) : lx === 9 ? G_TR : G_H) << 4) | 1;
    if (lx === 0 || lx === 9) return (G_PIPE << 4) | 1;
    if (car === 0) return lx <= 2 ? (G_SMALL << 4) | 1 : (G_DARK << 4) | 3;
    return lx % 2 === 1 ? (env.night > 0.4 ? (G_SMALL << 4) | 1 : (G_OPEN << 4) | 3) : -1;
  }

  // Wind turbines with three turning blades.
  const TURBINE_GAP = 34;
  function turbine(wc, ly, t) {
    const k = Math.round(wc / TURBINE_GAP);
    if (hash2(k, 131) > 0.55) return NOT_HERE;
    const mast = Math.round((L.H * 0.3) / ch);
    const dxc = wc - k * TURBINE_GAP;
    if (dxc === 0 && ly < mast) return (G_PIPE << 4) | 2;
    const dx = dxc * cw, dy = (ly - mast) * ch;
    const r = Math.hypot(dx, dy);
    if (r < 1) return (G_PLUS << 4) | 1;
    if (r > L.H * 0.12) return NOT_HERE;
    const a = Math.atan2(dy, dx);
    const rot = t * 1.2 + k * 2.1;
    for (let b = 0; b < 3; b++) {
      const blade = rot + (b * 2 * Math.PI) / 3;
      const diff = Math.atan2(Math.sin(a - blade), Math.cos(a - blade));
      if (Math.abs(diff) * r < cw * 0.7) {
        const ang = mod(blade, Math.PI);
        const g = ang < Math.PI / 8 || ang > (7 * Math.PI) / 8 ? G_H : ang < (3 * Math.PI) / 8 ? G_SLASH : ang < (5 * Math.PI) / 8 ? G_PIPE : G_BACK;
        return (g << 4) | 2;
      }
    }
    return NOT_HERE;
  }

  // Flat-topped mesas with layered rock.
  function mesa(wc, ly) {
    const lot = Math.floor(wc / 26);
    if (hash2(lot, 141) > 0.6) return NOT_HERE;
    const lx = wc - lot * 26;
    const w = 12 + ((hash2(lot, 142) * 12) | 0);
    const x0 = (hash2(lot, 143) * (26 - w)) | 0;
    const hgt = 3 + ((hash2(lot, 144) * 6) | 0);
    if (ly >= hgt) return NOT_HERE;
    const inset = ly >> 1;
    const l = x0 + inset, r = x0 + w - 1 - inset;
    if (lx < l || lx > r) return NOT_HERE;
    if (ly === hgt - 1) return (G_H << 4) | 2;
    if (lx === l) return (G_SLASH << 4) | 2;
    if (lx === r) return (G_BACK << 4) | 2;
    return ly % 2 === 0 ? (G_H << 4) | 5 : mod(lx * 7 + ly, 5) === 0 ? (G_DOT << 4) | 4 : -1;
  }

  function midCell(x, sy, t, biome) {
    const ly = Math.floor((L.roadTop - sy) / ch);
    if (ly < 0) return NOT_HERE;
    const wc = Math.floor((x + t * SPEED_MID) / cw);
    let p;
    switch (biome) {
      case CITY: return farBuilding(wc, ly, t);
      case COUNTRY:
        p = railCell(x, ly, t);
        if (p !== NOT_HERE) return p;
        p = turbine(wc, ly, t);
        if (p !== NOT_HERE) return p;
        return pine(wc, ly, 101, 0.3, 1, 3, 3);
      case MOUNTAINS:
        p = railCell(x, ly, t);
        if (p !== NOT_HERE) return p;
        return pine(wc, ly, 111, 0.6, 2, 5, 3);
      case DESERT: return mesa(wc, ly);
      case FOREST:
        p = pine(wc, ly, 121, 0.95, 3, 7, 3);
        return p !== NOT_HERE ? p : pine(wc + 4, ly, 125, 0.8, 2, 5, 4);
      default: return NOT_HERE;
    }
  }

  // ------------------------------------------------------------ road, water ---

  function roadCell(c, x, sy, t) {
    const ri = Math.floor((sy - L.roadTop) / ch);
    const wc = Math.floor((x + t * SPEED_ROAD) / cw);
    const biome = BB[c];
    if (ri === 0) return ((hash2(wc >> 2, 91) < 0.85 ? G_H : G_HH) << 4) | (biome === DESERT ? 3 : 1);
    if (ri === 1) return hash2(wc, 77) < 0.04 ? (G_DOT << 4) | 5 : -1;
    if (ri === 2) return mod(wc, 7) < 3 ? (G_DASH << 4) | 3 : -1;
    const hv = hash2(wc, 88);
    switch (biome) {
      case CITY: return ((mod(wc, 5) === 0 ? G_POST : G_HH) << 4) | 1;
      case BRIDGE: return (((wc & 1) ? G_SLASH : G_BACK) << 4) | 2;
      case MOUNTAINS: return ((mod(wc, 4) === 0 ? G_DTEE : G_HH) << 4) | 2;
      case DESERT: return hv < 0.3 ? (pick(S.base, hv * 3) << 4) | 4 : -1;
      default: return hv < 0.6 ? (pick(S.fern, hv) << 4) | 3 : -1;
    }
  }

  // The sea: the skyline or the bridge mirrored in the water, pushed sideways
  // by the waves and broken up more the further down it is, with swell in
  // between. Under the bridge its piers stand in the water.
  function seaCell(c, sr, x, sy, t, wi, fade, biome) {
    if (wi === 0) return ((hash2(Math.floor((x + t * 6) / cw) >> 2, 5) < 0.8 ? G_H : G_DASH) << 4) | 2;
    if (biome === BRIDGE && wi <= 5 && mod(Math.floor((x + t * SPEED_NEAR) / cw), SPAN) < LEGS) {
      return (G_DARK << 4) | 3;
    }
    const wob = Math.sin(t * 1.3 + wi * 0.9) * cw * (0.8 + wi * 0.15);
    const rb = nearBiomeAt(x + wob, t);
    if (rb === CITY || rb === BRIDGE) {
      const b = nearCell(x + wob, 2 * L.waterTop - sy, t, rb);
      if (b !== NOT_HERE) {
        const hv = hash3(c, sr, Math.floor(t * 3));
        if (hv > (0.75 - wi * 0.025) * fade) return -1;
        if (b >= 0 && (b & 15) >= 7) return (G_H << 4) | 8;
        if (b >= 0 && b >> 4 === G_SMALL) return (G_H << 4) | 1;
        return (pick(S.reflect, hv) << 4) | (b >= 0 ? 3 : 4);
      }
    }
    return swell(x, t, wi, fade);
  }

  function swell(x, t, wi, fade) {
    const wc = Math.floor((x + t * (5 + wi * 2) + Math.sin(t * 0.9 + wi * 0.7) * cw) / cw);
    const segLen = 2 + ((hash2(wi, 71) * 6) | 0);
    const hs = hash2(Math.floor(wc / segLen), wi + 131);
    const dens = Math.min(0.45, 0.1 + wi * 0.035) * fade;
    if (hs < dens) return (S.water[((hs / dens) * S.water.length) | 0] << 4) | (wi < 4 ? 4 : 3);
    return -1;
  }

  // A mountain lake that mirrors the peaks behind it.
  function lakeCell(c, sr, x, sy, t, wi, fade) {
    if (wi === 0) return (G_H << 4) | 2;
    const wob = Math.round((Math.sin(t * 1.1 + wi * 0.8) * (0.6 + wi * 0.1)));
    const cc = Math.min(cols - 1, Math.max(0, c + wob));
    if (HB[cc] === MOUNTAINS && 2 * L.waterTop - sy >= HF[cc]) {
      const hv = hash3(c, sr, Math.floor(t * 3));
      if (hv > (0.8 - wi * 0.03) * fade) return -1;
      return (pick(S.reflect, hv) << 4) | 3;
    }
    return swell(x, t, wi, fade * 0.7);
  }

  // Crop rows in front of the road. Nearer rows pass faster.
  function fieldCell(x, t, wi, fade) {
    const wc = Math.floor((x + t * SPEED_ROAD * (0.6 + wi * 0.08)) / cw);
    const hv = hash2(wc, wi + 211);
    if (wi % 2 === 0) {
      if (hv < 0.004) return (G("*") << 4) | 7;
      return hv < 0.65 * fade ? (pick(S.crop, hash2(wi, wc)) << 4) | (wi < 4 ? 3 : 2) : -1;
    }
    return hv < 0.25 * fade ? (G_US << 4) | 4 : -1;
  }

  // Sand with ripples, and heat shimmer on the rows next to the road.
  function sandCell(x, t, wi, fade) {
    const shimmer = wi < 3 ? Math.sin(t * 7 + wi * 2 + x * 0.05) * cw : 0;
    const wc = Math.floor((x + t * SPEED_ROAD * (0.5 + wi * 0.07) + shimmer) / cw);
    const hv = hash2(Math.floor(wc / 3), wi + 221);
    if (hv < 0.3 * fade) return (G_TILDE << 4) | (wi < 4 ? 4 : 3);
    return hash2(wc, wi + 222) < 0.03 * fade ? (G_DOT << 4) | 3 : -1;
  }

  // Ferns and undergrowth under the trees, thinning out further down.
  function undergrowthCell(x, t, wi, fade) {
    const wc = Math.floor((x + t * SPEED_ROAD * (0.6 + wi * 0.06)) / cw);
    const hv = hash2(wc, wi + 231);
    if (hv < (0.55 - wi * 0.035) * fade) return (pick(S.fern, hash2(wi, wc)) << 4) | (wi < 3 ? 2 : 3);
    return -1;
  }

  function belowCell(c, sr, x, sy, t) {
    const wi = Math.floor((sy - L.waterTop) / ch);
    const fade = 1 - smooth(L.waterTop + ch * 5, L.groundEnd, sy);
    const biome = BB[c];
    switch (biome) {
      case CITY:
      case BRIDGE: return seaCell(c, sr, x, sy, t, wi, fade, biome);
      case MOUNTAINS: return lakeCell(c, sr, x, sy, t, wi, fade);
      case COUNTRY: return fieldCell(x, t, wi, fade);
      case DESERT: return sandCell(x, t, wi, fade);
      default: return undergrowthCell(x, t, wi, fade);
    }
  }

  function heroCell(c, sr, x, sy, t) {
    if (sy >= L.groundEnd) return -2;
    if (sy >= L.waterTop) return belowCell(c, sr, x, sy, t);
    if (sy >= L.roadTop) return roadCell(c, x, sy, t);
    let b = nearCell(x, sy, t, NBI[c]);
    if (b !== NOT_HERE) return b;
    b = midCell(x, sy, t, MBI[c]);
    if (b !== NOT_HERE) return b;
    if (sy >= HF[c]) return terrainCell(c, sr, sy, t);
    return skyCell(c, sr, x, sy, t);
  }

  // ----------------------------------------------------------------- plot ---

  function plotCell(c, r, sy, t) {
    const top = sy - ch / 2, bot = sy + ch / 2;
    const kLo = Math.max(traceK0, Math.ceil(top / traceGap));
    const kHi = Math.min(traceK0 + traceCount - 1, Math.floor((bot + traceAmp) / traceGap));
    const stride = cols + 1;
    let curve = -1;
    for (let k = kLo; k <= kHi; k++) {
      const row = (k - traceK0) * stride;
      // Dashes and dots sit on the trace at the centre of a slot. Each slot
      // re-rolls every ~9 s, so marks come and go slowly.
      const shift = mod(k * 3, SLOT);
      const slot = Math.floor((c + shift) / SLOT);
      const hb = hash3(slot, k, Math.floor(t / 9 + hash2(slot, k)));
      if (hb < 0.12) {
        const center = slot * SLOT - shift + (SLOT >> 1);
        if (center >= 0 && center < cols) {
          const cy = (traceBuf[row + center] + traceBuf[row + center + 1]) / 2;
          if (cy >= top && cy < bot) {
            if (hb < 0.07) {
              const half = 1 + ((hash2(slot, k + 77) * 4) | 0);
              if (Math.abs(c - center) <= half) return G_HEAVY << 4;
            } else if (c === center) return (G_BULLET << 4) | 1;
          }
        }
      }
      if (curve < 0) {
        const yA = traceBuf[row + c], yB = traceBuf[row + c + 1];
        if (Math.max(yA, yB) >= top && Math.min(yA, yB) < bot) {
          const slope = (yB - yA) / cw;
          const lvl = (k & 3) === 0 ? 4 : 5;
          let g;
          if (Math.abs(slope) < 0.35) {
            const d = (yA + yB) / 2 - top;
            g = d < ch / 3 ? G_MACRON : d < (2 * ch) / 3 ? G_DASH : G_US;
          } else if (Math.abs(slope) < 2.2) g = slope < 0 ? G_SLASH : G_BACK;
          else g = G_PIPE;
          curve = (g << 4) | lvl;
        }
      }
    }
    if (curve >= 0) return curve;
    if (c % GRID === 0) return (G_GRID << 4) | 6;
    if (hash3(c, r, Math.floor(t * 0.35 + hash2(c, r + 7000) * 8)) < 0.002) return (pick(S.energy, hash2(r, c)) << 4) | 5;
    return -1;
  }

  // A numbered ruler along the top edge. Its ticks line up with the grid.
  function drawRuler() {
    ctx.fillStyle = rowFill[0] || colors.bg;
    ctx.fillRect(0, 0, canvas.width, chD);
    const row = rowInv[0] ? 13 : 3;
    for (let c = 0; c < cols; c++) {
      const m = c % GRID;
      let g = -1;
      if (m === 0) g = G_TICK;
      else if (m === 1 || m === 2) g = GI.get(String(Math.floor(c / GRID) + 1).padStart(2, "0")[m - 1]);
      if (g >= 0) ctx.drawImage(atlas, g * cwD, row * chD, cwD, chD, c * cwD, 0, cwD, chD);
    }
  }

  function waterCell(x, dy, t) {
    const ri = Math.floor(dy / ch);
    if (ri === 0) {
      const wc = Math.floor((x + t * 6) / cw);
      return ((hash2(wc >> 2, 3) < 0.85 ? G_H : G_HH) << 4) | 1;
    }
    const sway = Math.sin(t * 0.9 + ri * 0.7) * cw * 1.2;
    const wc = Math.floor((x + t * (4 + ri * 2.5) + sway) / cw);
    const segLen = 2 + ((hash2(ri, 71) * 8) | 0);
    const hs = hash2(Math.floor(wc / segLen), ri + 131);
    const dens = Math.min(0.7, 0.16 + ri * 0.05);
    if (hs < dens) {
      if (hash2(wc, ri + 7) < 0.03) return (G_SQ << 4) | 1;
      return (S.water[((hs / dens) * S.water.length) | 0] << 4) | (ri < 3 ? 3 : ri < 7 ? 2 : 1);
    }
    return -1;
  }

  // ------------------------------------------------------------- overlays ---
  // Things that move on their own schedule rather than with the scenery. They
  // are drawn over the finished grid, one cell at a time.

  function putCell(c, r, code) {
    if (c < 0 || c >= cols || r < 0 || r >= rows) return;
    if (mask[r * cols + c]) return;
    prevCode[r * cols + c] = -9;
    const yD = r * chD - fracD;
    ctx.fillStyle = rowFill[r] || colors.bg;
    ctx.fillRect(c * cwD, yD, cwD, chD);
    let row = code & 15;
    if (rowInv[r] && row < 7) row += 10;
    ctx.drawImage(atlas, (code >> 4) * cwD, row * chD, cwD, chD, c * cwD, yD, cwD, chD);
  }

  function screenRow(sceneY, heroOff) {
    return Math.floor((sceneY - heroOff + frac) / ch);
  }

  const BOAT = [" |\\", " |_\\", "\\___/"];
  function drawBoats(t, heroOff) {
    const gap = 560, speed = 20;
    const k0 = Math.floor((t * speed - 300) / gap), k1 = Math.ceil((t * speed + vw + 60) / gap);
    for (let k = k0; k <= k1; k++) {
      if (hash2(k, 151) > 0.65) continue;
      const x = k * gap + hash2(k, 152) * 240 - t * speed;
      const col = Math.floor(x / cw);
      const bc = Math.min(cols - 1, Math.max(0, col + 2));
      if (BB[bc] !== CITY && BB[bc] !== BRIDGE) continue;
      const r0 = screenRow(L.waterTop + ch * (4 + ((hash2(k, 153) * 4) | 0)), heroOff);
      for (let j = 0; j < BOAT.length; j++) {
        for (let i = 0; i < BOAT[j].length; i++) {
          if (BOAT[j][i] !== " ") putCell(col + i, r0 - 2 + j, (G(BOAT[j][i]) << 4) | 1);
        }
      }
      if (env.night > 0.4) putCell(col + 1, r0 - 3, (G_DOT << 4) | 7);
    }
  }

  function drawTumbleweed(t, heroOff) {
    const k = Math.floor(t / 12), tau = t - k * 12;
    if (hash2(k, 201) > 0.7) return;
    const c = Math.floor((vw + 30 - tau * 110) / cw);
    if (c < 0 || c >= cols || BB[c] !== DESERT) return;
    const bounce = Math.abs(Math.sin(tau * 5)) * ch * 1.2;
    putCell(c, screenRow(L.roadTop - ch * 0.5 - bounce, heroOff), ((Math.floor(tau * 8) & 1 ? G_AT : G_AMP) << 4) | 1);
  }

  function drawBirds(t, heroOff) {
    if (env.day < 0.4) return;
    const k = Math.floor(t / 26), tau = t - k * 26;
    if (hash2(k, 161) > 0.7) return;
    const n = 3 + ((hash2(k, 162) * 5) | 0);
    const baseY = L.H * (0.1 + 0.22 * hash2(k, 163));
    for (let i = 0; i < n; i++) {
      const x = -40 + tau * 62 - Math.abs(i - n / 2) * 16;
      const y = baseY + Math.abs(i - n / 2) * 7 + Math.sin(t * 2 + i) * 3;
      const flap = Math.floor(t * 5 + i) & 1;
      putCell(Math.floor(x / cw), screenRow(y, heroOff), ((flap ? G_V : G_DASH) << 4) | 1);
    }
  }

  function drawPlane(t, heroOff) {
    const k = Math.floor(t / 38), tau = t - k * 38;
    if (tau > 16 || hash2(k, 171) > 0.65) return;
    const c0 = Math.floor((vw + 60 - (tau / 16) * (vw + 160)) / cw);
    const r0 = screenRow(L.H * (0.06 + 0.1 * hash2(k, 172)), heroOff);
    if (env.night > 0.5) {
      putCell(c0, r0, ((Math.floor(t * 2) & 1 ? G_BULLET : G_DOT) << 4) | 7);
      putCell(c0 + 3, r0, (G_DOT << 4) | 2);
      return;
    }
    for (let i = 0; i < PLANE.length; i++) putCell(c0 + i, r0, (PLANE[i] << 4) | 1);
    for (let i = 0; i < 14; i++) {
      if ((i + Math.floor(t * 6)) % 3 !== 0) putCell(c0 + PLANE.length + i, r0, (G_DASH << 4) | (i < 5 ? 3 : i < 10 ? 4 : 5));
    }
  }

  function drawShootingStar(t, heroOff) {
    if (env.night < 0.6) return;
    const k = Math.floor(t / 6.5), tau = t - k * 6.5;
    if (tau > 0.9 || hash2(k, 181) > 0.55) return;
    const len = 700 * tau;
    const hx = vw * (0.15 + 0.7 * hash2(k, 182)) + 0.92 * len;
    const hy = L.H * (0.05 + 0.25 * hash2(k, 183)) + 0.4 * len;
    for (let i = 0; i < 10; i++) {
      const px = hx - 0.92 * i * cw * 1.3, py = hy - 0.4 * i * cw * 1.3;
      putCell(Math.floor(px / cw), screenRow(py, heroOff), ((i === 0 ? G_PLUS : G_DASH) << 4) | Math.min(5, i >> 1));
    }
  }

  // Rain in the forest and snow in the mountains, as heavy as the share of the
  // screen that place takes up.
  function drawWeather(t, heroOff) {
    let rain = 0, snow = 0, n = 0;
    for (let c = 0; c < cols; c += 8, n++) {
      if (BB[c] === FOREST) rain++;
      if (BB[c] === MOUNTAINS) snow++;
    }
    rain /= n;
    snow /= n;
    const bottom = L.groundEnd - heroOff;
    if (rain > 0.05) {
      for (let c = 0; c < cols; c++) {
        if (hash2(c, 191) > 0.33 * rain) continue;
        const y = mod(hash2(c, 192) * vh * 1.2 + t * 380, vh * 1.2) - vh * 0.1;
        if (y > bottom) continue;
        const r = Math.floor((y + frac) / ch);
        putCell(c, r, (G_SLASH << 4) | 3);
        putCell(c + 1, r - 1, (G_SLASH << 4) | 4);
      }
    }
    if (snow > 0.05) {
      for (let c = 0; c < cols; c++) {
        for (let f = 0; f < 2; f++) {
          const hs = hash2(c, 195 + f);
          if (hs > 0.25 * snow) continue;
          const y = mod(hash2(c, 197 + f) * vh + t * (28 + 20 * hs), vh);
          if (y > bottom) continue;
          const x = (c + 0.5) * cw + Math.sin(t * 0.8 + hs * 60) * cw * 1.5;
          putCell(Math.floor(x / cw), Math.floor((y + frac) / ch), ((hs < 0.1 * snow ? G("*") : G_DOT) << 4) | 2);
        }
      }
    }
  }

  // Headlights at night, fanning out from the front of the car.
  function drawBeam(t, strength) {
    const fx = car.x + car.w - car.p;
    const fy = car.y + car.h * 0.47;
    const len = 26;
    for (let i = 1; i <= len; i++) {
      const x = fx + i * cw;
      const spread = i * cw * 0.16;
      const fall = 1 - i / len;
      for (let dy = -spread; dy <= spread + 0.1; dy += ch * 0.5) {
        const y = fy + dy + i * cw * 0.06;
        const c = Math.floor(x / cw), r = Math.floor((y + frac) / ch);
        const hv = hash3(c, r, Math.floor(t * 6));
        if (hv > strength * (0.35 + fall * 0.65)) continue;
        const g = Math.abs(dy) < ch * 0.6 ? G_HH : hv < 0.4 ? G_H : G_DASH;
        putCell(c, r, (g << 4) | (fall > 0.5 ? 7 : fall > 0.2 ? 8 : 9));
      }
    }
  }

  // ------------------------------------------------------------------ car ---

  // A small rally hatchback facing right. k = ink, a = accent, w = paper,
  // g = glass. The wheels are drawn separately so they can turn.
  const CAR = [
    "........kkkkkkkkkkkkkk............",
    ".kkkk..kaaaaaaaaaaaaaak...........",
    ".kaak.kggggkgggggggggggk..........",
    ".kaaakggggkggggggggggggak.........",
    ".kaaakggggkgggggggggggggakkkkkkk..",
    ".kaaaaaaaaaaaaaaaaaaaaaaaaaaaaaakk",
    ".kaaaaaaaaawwwwwaaaaaaaaaaaaaaaaww",
    ".kaaaaaaaawwkkkwwaaaaaaaaaaaaaaaak",
    ".kaaaaaaaawwwkwwwaaaaaaaaaaaaaaaak",
    ".kkaaaaaaaawwwwwaaaaaaaaaaaaaaaakk",
    "..kkk.......kkkkkkkkkkk......kkkk.",
  ];
  const WHEEL = [
    ["..kkk..", ".kkkkk.", "kkwkwkk", "kkkwkkk", "kkwkwkk", ".kkkkk.", "..kkk.."],
    ["..kkk..", ".kkkkk.", "kkkwkkk", "kkwwwkk", "kkkwkkk", ".kkkkk.", "..kkk.."],
  ];
  const CAR_W = CAR[0].length;
  const CAR_H = 15;
  const WHEELS_AT = [[3, 8], [23, 8]];

  function paintSprite(rowsArr, ox, oy, pD, fade, seed, pal) {
    for (let j = 0; j < rowsArr.length; j++) {
      const line = rowsArr[j];
      for (let i = 0; i < line.length; i++) {
        const k = line[i];
        if (k === ".") continue;
        if (fade < 1 && hash2(i + seed, j) > fade) continue;
        const px = ox + i * pD, py = oy + j * pD;
        const cell = Math.floor((py + fracD) / chD) * cols + Math.floor(px / cwD);
        if (cell >= 0 && cell < N && mask[cell] === 1) continue;
        ctx.globalAlpha = k === "g" ? 0.35 : 1;
        ctx.fillStyle = k === "a" ? pal.a : k === "w" ? pal.w : pal.k;
        ctx.fillRect(px, py, pD, pD);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawCar(t, heroOff, heroFade) {
    car.visible = false;
    // The car leaves before the rest of the landscape does.
    heroFade = Math.min(heroFade, 1 - smooth(heroH * 0.15, heroH * 0.5, window.scrollY || 0));
    if (!heroEl || heroFade <= 0) return;
    const P = vw < 640 ? 3 : vw < 1200 ? 4 : 5;
    const pD = Math.max(1, Math.round(P * dpr));
    const bottom = L.roadTop + ch * 2.4 - heroOff;
    if (bottom < -40 || bottom - CAR_H * P > vh) return;
    car.p = P;
    car.w = CAR_W * P;
    car.h = CAR_H * P;
    car.x = vw * (vw < 640 ? 0.62 : 0.7) - car.w / 2;
    let hop = 0;
    const since = t - car.hopT;
    if (since < 0.55) hop = Math.sin((since / 0.55) * Math.PI) * 22;
    car.y = bottom - car.h - hop;
    car.visible = true;
    if (env.night > 0.35) drawBeam(t, env.night * heroFade);
    // On a dark night sky the outline flips to the page colour.
    const midRow = Math.floor((car.y + car.h / 2 + frac) / ch);
    const inv = midRow >= 0 && midRow < rows && rowInv[midRow] === 1;
    const pal = { a: colors.accent, k: inv ? colors.bg : colors.fg, w: inv ? colors.fg : colors.bg };
    const ox = Math.round(car.x * dpr);
    const oy = Math.round(car.y * dpr);
    const bump = !reduced && hop === 0 && hash2(Math.floor(t * 6), 5) < 0.22 ? -pD : 0;
    const c0 = Math.max(0, Math.floor(car.x / cw) - 1), c1 = Math.min(cols - 1, Math.ceil((car.x + car.w) / cw) + 1);
    const r0 = Math.max(0, Math.floor((car.y - 30 + frac) / ch)), r1 = Math.min(rows - 1, Math.ceil((car.y + car.h + frac) / ch) + 1);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) prevCode[r * cols + c] = -9;
    paintSprite(CAR, ox, oy + bump, pD, heroFade, 0, pal);
    const frame = reduced ? 0 : Math.floor(t * 12) % 2;
    for (let w = 0; w < WHEELS_AT.length; w++) {
      const [wx, wy] = WHEELS_AT[w];
      paintSprite(WHEEL[frame], ox + wx * pD, oy + wy * pD, pD, heroFade, 50 + w * 9, pal);
    }
  }

  function updateDust(t, dt, heroOff) {
    if (!car.visible || reduced) {
      dust.length = 0;
      return;
    }
    if (t - lastDust > 0.07) {
      lastDust = t;
      dust.push({
        x: car.x + car.p * 3,
        y: car.y + car.h - car.p + heroOff,
        vx: -(35 + Math.random() * 45),
        vy: -(4 + Math.random() * 12),
        born: t,
        life: 0.6 + Math.random() * 0.8,
        g: pick(S.dust, Math.random()),
      });
    }
    for (let i = dust.length - 1; i >= 0; i--) {
      const d = dust[i];
      if (t - d.born > d.life) {
        dust.splice(i, 1);
        continue;
      }
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 6 * dt;
    }
  }

  function drawDust(t, heroOff) {
    for (let i = 0; i < dust.length; i++) {
      const d = dust[i];
      const age = (t - d.born) / d.life;
      putCell(Math.floor(d.x / cw), screenRow(d.y, heroOff), (d.g << 4) | (age < 0.3 ? 2 : age < 0.6 ? 3 : 4));
    }
  }

  // --------------------------------------------------------------- energy ---

  function inject(px, py, radius, amount) {
    const c0 = Math.max(0, Math.floor((px - radius) / cw));
    const c1 = Math.min(cols - 1, Math.floor((px + radius) / cw));
    const r0 = Math.max(0, Math.floor((py - radius + frac) / ch));
    const r1 = Math.min(rows - 1, Math.floor((py + radius + frac) / ch));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const d = Math.hypot((c + 0.5) * cw - px, (r + 0.5) * ch - frac - py) / radius;
        if (d < 1) {
          const idx = r * cols + c;
          const v = amount * (1 - d);
          if (v > E[idx]) E[idx] = v;
        }
      }
    }
  }

  function applyPulses(t) {
    for (let p = pulses.length - 1; p >= 0; p--) {
      const pulse = pulses[p];
      const age = t - pulse.t0;
      if (age > 1.4) {
        pulses.splice(p, 1);
        continue;
      }
      const R = age * 950;
      const strength = 0.95 * (1 - age / 1.4);
      for (let r = 0; r < rows; r++) {
        const dy = (r + 0.5) * ch - frac - pulse.y;
        for (let c = 0; c < cols; c++) {
          const d = Math.abs(Math.hypot((c + 0.5) * cw - pulse.x, dy) - R);
          if (d < 34) {
            const idx = r * cols + c;
            const v = strength * (1 - d / 34);
            if (v > E[idx]) E[idx] = v;
          }
        }
      }
    }
  }

  // ----------------------------------------------------------------- draw ---

  function draw(t, dt) {
    const scrollY = window.scrollY || 0;
    const H = heroH || vh;
    L.H = H;
    L.cloudBase = H * 0.4;
    L.roadTop = Math.round((H * 0.8) / ch) * ch;
    L.waterTop = L.roadTop + ch * 4;
    L.cityH = H * 0.42;
    L.farCityH = H * 0.34;
    L.groundEnd = H + vh * 0.3;

    const heroOff = scrollY * PARALLAX;
    const rowOff = Math.floor(heroOff / ch);
    frac = heroOff - rowOff * ch;
    fracD = Math.round(frac * dpr);
    const heroFade = heroEl ? 1 - smooth(H * 0.3, H * 1.0, scrollY) : 0;
    const heroVisible = heroFade > 0 && L.groundEnd - heroOff > 0;
    const needCalm = heroFade < 1 || vh + heroOff > L.groundEnd;
    computeEnv(t);
    zzKey = -1;
    if (needCalm) computeTraces(t, rowOff * ch);
    if (heroVisible) computeColumns(t);
    computeTone(heroVisible ? heroFade : 0, rowOff);
    buildMask();

    if (!reduced) {
      const decay = Math.pow(0.87, dt * 30);
      for (let i = 0; i < N; i++) if (E[i] > 0.001) E[i] *= decay; else E[i] = 0;
      if (pulses.length) applyPulses(t);
    }

    // A scrolled grid, a resize or a theme change redraws everything. Otherwise
    // only rows whose fill changed and cells whose glyph changed are drawn.
    const full = fullRedraw || rowOff !== lastRowOff || fracD !== lastFracD;
    fullRedraw = false;
    lastRowOff = rowOff;
    lastFracD = fracD;
    ctx.globalAlpha = 1;
    if (full) {
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    for (let r = 0; r < rows; r++) {
      const sr = r + rowOff;
      const sy = (sr + 0.5) * ch;
      const yD = r * chD - fracD;
      const base = r * cols;
      const inv = rowInv[r];
      const fill = rowFill[r] || colors.bg;
      const rowAll = full || rowFill[r] !== prevFill[r];
      prevFill[r] = rowFill[r];
      if (rowAll && (!full || rowFill[r])) {
        ctx.fillStyle = fill;
        ctx.fillRect(0, yD, canvas.width, chD);
      }
      let styled = rowAll;
      for (let c = 0; c < cols; c++) {
        const idx = base + c;
        const m = mask[idx];
        const x = (c + 0.5) * cw;
        let code;
        const e = E[idx];
        if (m === 1 || (m === 2 && RA[idx] < 0.55)) {
          code = -1;
        } else if (e > 0.06) {
          const g = pick(S.energy, hash3(c, r, Math.floor(t * 14 + RA[idx] * 10)));
          code = (g << 4) | (7 + (e > 0.55 ? 0 : e > 0.28 ? 1 : 2));
        } else if (sy > seaTop) {
          code = waterCell(x, sy - seaTop, t);
        } else {
          let hc = -2;
          if (heroVisible && heroFade > hash2(c * 131 + 17, sr)) hc = heroCell(c, sr, x, sy, t);
          code = hc === -2 ? (needCalm ? plotCell(c, sr, sy, t) : -1) : hc;
        }
        if (!rowAll) {
          if (code === prevCode[idx]) continue;
          if (!styled) {
            ctx.fillStyle = fill;
            styled = true;
          }
          ctx.fillRect(c * cwD, yD, cwD, chD);
        }
        prevCode[idx] = code;
        if (code >= 0) {
          let row = code & 15;
          if (inv && row < 7) row += 10;
          ctx.drawImage(atlas, (code >> 4) * cwD, row * chD, cwD, chD, c * cwD, yD, cwD, chD);
        }
      }
    }

    if (heroVisible && heroFade > 0.3) {
      drawBoats(t, heroOff);
      drawTumbleweed(t, heroOff);
      drawBirds(t, heroOff);
      drawPlane(t, heroOff);
      drawShootingStar(t, heroOff);
      drawWeather(t, heroOff);
    }
    drawCar(t, heroOff, heroFade);
    updateDust(t, dt, heroOff);
    drawDust(t, heroOff);
    drawRuler();
  }

  // Draw time is averaged over 60 frames. A machine that cannot keep up gets
  // bigger cells, which means fewer of them.
  let costSum = 0, costFrames = 0, lastCost = 0;
  let scaleFloor = 1;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const scrollNow = window.scrollY;
    if (scrollNow === lastScroll && now - lastDraw < 1000 / FPS - 2) return;
    lastScroll = scrollNow;
    const t = now / 1000;
    const dt = lastT ? Math.min(0.1, t - lastT) : 1 / FPS;
    lastT = t;
    lastDraw = now;
    const t0 = performance.now();
    draw(t, dt);
    costSum += performance.now() - t0;
    if (++costFrames === 60) {
      lastCost = costSum / 60;
      if (lastCost > 16 && scaleFloor < 2) {
        scaleFloor += 0.25;
        setup();
      }
      costSum = 0;
      costFrames = 0;
    }
  }

  // A fixed moment for reduced motion, redrawn only when something changes.
  // Sunset over the bridge.
  const STILL_T = 62;
  let stillQueued = false;
  function drawStill() {
    if (stillQueued) return;
    stillQueued = true;
    requestAnimationFrame(function () {
      stillQueued = false;
      draw(STILL_T, 0);
    });
  }

  function start() {
    if (started) return;
    started = true;
    setup();
    if (reduced) drawStill();
    else raf = requestAnimationFrame(frame);
  }

  function restartLoop() {
    cancelAnimationFrame(raf);
    reduced = reducedMQ.matches;
    lastT = 0;
    if (reduced) drawStill();
    else raf = requestAnimationFrame(frame);
  }

  // --------------------------------------------------------------- events ---

  let resizeTimer = 0;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (!started) return;
      setup();
      if (reduced) drawStill();
    }, 120);
  });

  window.addEventListener("scroll", function () {
    if (started && reduced) drawStill();
  }, { passive: true });

  if (window.ResizeObserver) {
    new ResizeObserver(function () {
      if (!started) return;
      measureLayout();
      if (reduced) drawStill();
    }).observe(document.body);
  }

  function onTheme() {
    if (!started) return;
    readColors();
    buildAtlas();
    fullRedraw = true;
    if (reduced) drawStill();
  }
  new MutationObserver(onTheme).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  darkMQ.addEventListener("change", onTheme);
  reducedMQ.addEventListener("change", restartLoop);

  let lastPX = null, lastPY = null;
  window.addEventListener("pointermove", function (e) {
    if (!started) return;
    const x = e.clientX, y = e.clientY;
    const overCar = car.visible && x >= car.x && x <= car.x + car.w && y >= car.y && y <= car.y + car.h;
    root.classList.toggle("over-car", overCar);
    if (reduced) return;
    if (lastPX === null) inject(x, y, 24, 0.9);
    else {
      const dx = x - lastPX, dy = y - lastPY;
      const steps = Math.min(12, Math.ceil(Math.hypot(dx, dy) / 10));
      for (let i = 1; i <= steps; i++) inject(lastPX + (dx * i) / steps, lastPY + (dy * i) / steps, 24, 0.9);
    }
    lastPX = x;
    lastPY = y;
  }, { passive: true });
  document.addEventListener("pointerleave", function () { lastPX = lastPY = null; });
  window.addEventListener("blur", function () { lastPX = lastPY = null; });

  window.addEventListener("click", function (e) {
    if (!car.visible || reduced) return;
    if (e.target instanceof Element && e.target.closest("a, button, input, label")) return;
    const x = e.clientX, y = e.clientY;
    if (x >= car.x && x <= car.x + car.w && y >= car.y - 10 && y <= car.y + car.h) {
      const now = performance.now() / 1000;
      if (now - car.hopT > 0.55) car.hopT = now;
      pulses.push({ x: car.x + car.w / 2, y: car.y + car.h / 2, t0: now });
    }
  });

  window.Field = {
    pulse: function (x, y) {
      if (!started || reduced) return;
      pulses.push({ x: x, y: y, t0: performance.now() / 1000 });
    },
    refresh: function () {
      if (!started) return;
      measureLayout();
      if (reduced) drawStill();
    },
  };

  const fontReady = document.fonts && document.fonts.load
    ? document.fonts.load('11px "Departure Mono"')
    : Promise.resolve();
  Promise.race([fontReady, new Promise(function (r) { setTimeout(r, 1500); })]).then(start, start);
})();
