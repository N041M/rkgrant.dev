// The glyph field behind the page.
//
// A fixed canvas is divided into character cells, and every cell draws one
// glyph from a pre-rendered atlas. On the first screen a pixel rally car drives
// an endless road past a coastline city, a highway, a suspension bridge, a
// shore road, a desert, a rally stage, farmland, a village, a forest, mountains
// and a winter valley, while the day turns from morning to night and back.
// Below it the page shows a plot with a dotted grid, ridgeline traces and heavy
// dashes that come and go. The footer sits on water, and a numbered ruler hangs
// under the top bar. Elements with the class `ko` are cut out of the field so
// their text stays readable.
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
  const EXTRA = "/\\-─═■·^_|.━•¯│┊╷□▪┌┐╭╮╧║╦┬┼▲▼+✦o┃┗┛Ψ▟▙▄█▓░@&v◄╪╗~¦†┄★→▒╤ABCDEFGHIJKLMNOPQRSTUVWXYZ╳╱╲╫▚▞▀┴├┤╪┃╋╬┘└ÉČÍÝ";
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
  const G_AT = G("@"), G_AMP = G("&"), G_V = G("v"), G_TILDE = G("~"), G_SNOWFIELD = G("░");
  const G_CHK_A = G("▚"), G_CHK_B = G("▞");
  const G_TAPE = G("┄"), G_SHINGLE = G("▒"), G_STAR = G("*"), G_CLUB = G("♣"), G_RAIL = G("╤");
  const PLANE = Array.from("◄═╪═╗", G);

  // Atlas rows 0–6 are ink at falling opacity, rows 7–9 the accent, and rows
  // 10–16 the page colour at the same opacities as 0–6, for glyphs drawn on a
  // dark night sky. From row 17 come the scene colours. A cell's code is its
  // glyph index shifted left by 7, or'd with its row.
  const FG_LEVELS = [1, 0.8, 0.6, 0.44, 0.32, 0.22, 0.13];
  const AC_LEVELS = [1, 0.62, 0.34];

  // ---------------------------------------------------------------- colour ---
  // The drive has its own colours, while the rest of the page stays black,
  // white and red. Each colour comes at three strengths, in a version for the
  // light page by day and a brighter one for the dark page and a dark night.
  const SKY = 0, SUN = 1, DUSK = 2, NIGHT = 3, WINDOW = 4, LEAF = 5, PINE = 6, GRASS = 7;
  const WHEAT = 8, WATER = 9, SAND = 10, CLAY = 11, ROCK = 12, SNOW = 13, SLATE = 14;
  const PURPLE = 15, PAPER = 16, INKD = 17;
  const PALETTE = [
    ["#6f9bc8", "#7fa8d6"], // sky
    ["#e3931a", "#f4b73c"], // sun
    ["#d4694e", "#f0957a"], // dusk: a low sun and sunset clouds
    ["#9c8a4a", "#f1e3a6"], // night: stars and the moon
    ["#d08f12", "#f6c54e"], // window light, lamps and headlights
    ["#4d8a3b", "#7cc266"], // leaf
    ["#2f6a45", "#5ea676"], // pine
    ["#7f9f33", "#b1cf5f"], // grass
    ["#c29a33", "#e2c26c"], // wheat and road markings
    ["#3a78b8", "#6ea8e2"], // water
    ["#bf9552", "#dcb982"], // sand
    ["#b4502d", "#e27a52"], // clay: mesas, the bridge, roofs and hulls
    ["#7b6b5b", "#ad9d8d"], // rock and bark
    ["#8da6bf", "#eaf1f8"], // snow
    ["#7f8ca2", "#9aa6bb"], // slate: distant hills and buildings
    ["#7d5fb0", "#b39ae6"], // purple: the northern lights and shirts
    ["#dcd8cf", "#f5f4f0"], // paper: signs, tape and the lighthouse stripes
    ["#1b1c20", "#1b1c20"], // dark ink for text on light signs
  ];
  const COLOUR_LEVELS = [1, 0.7, 0.42];
  const COLOUR_BASE = 17;
  const COLOUR_ROWS = PALETTE.length * 3;
  function cr(colour, level) {
    return COLOUR_BASE + colour * 3 + level;
  }

  // Sky colours at the top of the sky, at the horizon, and for the ground and
  // water, by day, at dusk and at night, for each page theme.
  const SKY_KEYS = {
    light: {
      day: ["#cfe0ee", "#f3efe5", "#e9ebe6"],
      dusk: ["#766b98", "#f0a068", "#cfb9ab"],
      night: ["#0c1226", "#1e284a", "#0b1020"],
    },
    dark: {
      day: ["#1c2b3e", "#2c3947", "#171b21"],
      dusk: ["#241f3b", "#5c3125", "#1a1618"],
      night: ["#090d1a", "#131b31", "#0a0d16"],
    },
  };

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
  // BIOME_LEN px of the front layer the road reaches the next place in ORDER.
  // The change from one place to the next is a boundary that sweeps across the
  // screen at the front layer's speed, and every layer changes as it passes,
  // so the distance never shows a place the road has not reached yet.
  const SPEED_HILLS = 9;
  const SPEED_MID = 18;
  const SPEED_NEAR = 36;
  const SPEED_ROAD = 54;
  const BIOME_LEN = 1100;
  const BLEND = 0.2;
  const CITY = 0, BRIDGE = 1, COUNTRY = 2, MOUNTAINS = 3, DESERT = 4, FOREST = 5;
  const SHORE = 6, VILLAGE = 7, WINTER = 8, RALLY = 9, HIGHWAY = 10;
  // The order the road passes the places in, round and round.
  const ORDER = [CITY, HIGHWAY, BRIDGE, SHORE, DESERT, RALLY, COUNTRY, VILLAGE, FOREST, MOUNTAINS, WINTER];
  const NB = ORDER.length;
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
  let colors = { bg: "#fbfaf8", fg: "#17181b", accent: "#c8352b" };
  let bgRGB = [251, 250, 248];
  let darkPage = false;
  let mask, E, RA;
  // Per column: terrain height, terrain biome, and the biome of the front
  // layer, the middle layer and the road and water.
  let HF, HB, NBI, MBI, BB, SEA;
  let tone, rowInv, rowAlt, rowFill = [];
  // Per row: tone is 1 on rows dark enough for light glyphs, rowInv flips
  // ink to the page colour there, and rowAlt picks the brighter scene colours.
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
  // The hero's text blocks (left, right and bottom in page px), which the
  // road keeps clear of.
  let heroBlocks = [];
  // Where the top bar ends, so the ruler can hang just below it.
  let barEl = null, barBottom = 0;
  let reduced = reducedMQ.matches;
  let started = false;
  let raf = 0, lastDraw = 0, lastT = 0, lastScroll = -1;
  const pulses = [];
  const dust = [];
  let lastDust = 0, lastPuff = 0;
  const L = { H: 0, cloudBase: 0, cityH: 0, farCityH: 0, roadTop: 0, waterTop: 0, groundEnd: 0 };
  const env = { day: 1, night: 0, dusk: 0, wDay: 1, wDusk: 0, wNight: 0, sunX: 0, sunY: 0, sunR: 0, moonX: 0, moonY: 0, moonR: 0 };
  const skyTop = [0, 0, 0], skyHorizon = [0, 0, 0], skyGround = [0, 0, 0];
  const car = { x: 0, y: 0, w: 0, h: 0, p: 4, hopT: -10, visible: false };

  function rgbOf(str, fallback) {
    const m = /^#([0-9a-f]{6})$/i.exec(str);
    if (!m) return fallback;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  const SKY_RGB = {};
  for (const theme in SKY_KEYS) {
    SKY_RGB[theme] = {};
    for (const phase in SKY_KEYS[theme]) {
      SKY_RGB[theme][phase] = SKY_KEYS[theme][phase].map(function (hex) { return rgbOf(hex, [0, 0, 0]); });
    }
  }

  function readColors() {
    const cs = getComputedStyle(root);
    colors = {
      bg: cs.getPropertyValue("--bg").trim() || colors.bg,
      fg: cs.getPropertyValue("--fg").trim() || colors.fg,
      accent: cs.getPropertyValue("--accent").trim() || colors.accent,
    };
    bgRGB = rgbOf(colors.bg, bgRGB);
    darkPage = bgRGB[0] + bgRGB[1] + bgRGB[2] < 384;
  }

  function buildAtlas() {
    atlas = document.createElement("canvas");
    atlas.width = GLYPHS.length * cwD;
    atlas.height = (COLOUR_BASE + 2 * COLOUR_ROWS) * chD;
    const a = atlas.getContext("2d");
    a.font = fontPx * dpr + 'px "Departure Mono", ui-monospace, Menlo, monospace';
    a.textBaseline = "alphabetic";
    const baseline = Math.round(fontPx * dpr);
    const paint = function (row, style, alpha) {
      a.fillStyle = style;
      a.globalAlpha = alpha;
      for (let i = 0; i < GLYPHS.length; i++) a.fillText(GLYPHS[i], i * cwD, row * chD + baseline);
    };
    for (let row = 0; row < 7; row++) paint(row, colors.fg, FG_LEVELS[row]);
    for (let row = 0; row < 3; row++) paint(7 + row, colors.accent, AC_LEVELS[row]);
    for (let row = 0; row < 7; row++) paint(10 + row, colors.bg, FG_LEVELS[row]);
    for (let v = 0; v < 2; v++) {
      for (let i = 0; i < PALETTE.length; i++) {
        for (let l = 0; l < 3; l++) paint(COLOUR_BASE + v * COLOUR_ROWS + i * 3 + l, PALETTE[i][v], COLOUR_LEVELS[l]);
      }
    }
  }

  function measureLayout() {
    heroEl = document.querySelector("[data-hero]");
    shoreEl = document.querySelector("[data-shore]");
    koEls = Array.from(document.querySelectorAll(".ko"));
    heroH = heroEl ? heroEl.offsetHeight : 0;
    barEl = document.querySelector(".top");
    barBottom = barEl ? Math.round(barEl.getBoundingClientRect().bottom) : 0;
    heroBlocks = heroEl
      ? Array.from(heroEl.querySelectorAll(".hero-inner > *"))
          .map(function (el) {
            const r = el.getBoundingClientRect();
            return { left: r.left, right: r.right, bottom: r.bottom + window.scrollY };
          })
          .filter(function (b) { return b.right > b.left; })
      : [];
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
    SEA = new Float32Array(cols);
    BB = new Uint8Array(cols);
    tone = new Float32Array(rows);
    rowInv = new Uint8Array(rows);
    rowAlt = new Uint8Array(rows);
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
    // The sky colours move in steps of ten minutes of the day (about a second),
    // so a frame without scrolling only redraws the rows when they change.
    const hq = Math.round(h * 6) / 6;
    const dq = smooth(5, 7, hq) * (1 - smooth(18, 20, hq));
    env.wDusk = 4 * dq * (1 - dq);
    env.wDay = dq * (1 - env.wDusk);
    env.wNight = (1 - dq) * (1 - env.wDusk);
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

  // The day, dusk and night colours for one part of the sky, weighted by the
  // time of day.
  function mixSky(K, i, out) {
    for (let j = 0; j < 3; j++) out[j] = K.day[i][j] * env.wDay + K.dusk[i][j] * env.wDusk + K.night[i][j] * env.wNight;
  }

  // Each row of the scene gets its sky colour: a blend from the top of the sky
  // to the horizon, then the ground and water below the road. It fades back to
  // the page colour at the bottom of the scene and as the page scrolls. Rows
  // dark enough to need light glyphs are marked.
  function computeTone(fade, rowOff) {
    const K = darkPage ? SKY_RGB.dark : SKY_RGB.light;
    mixSky(K, 0, skyTop);
    mixSky(K, 1, skyHorizon);
    mixSky(K, 2, skyGround);
    for (let r = 0; r < rows; r++) {
      const sy = (r + rowOff + 0.5) * ch;
      const k = fade > 0 && sy < L.groundEnd ? fade * (1 - smooth(L.H * 0.98, L.groundEnd, sy)) : 0;
      if (k <= 0.004) {
        rowFill[r] = null;
        rowInv[r] = 0;
        rowAlt[r] = darkPage ? 1 : 0;
        tone[r] = 0;
        continue;
      }
      let c0, c1, c2;
      if (sy < L.roadTop) {
        const f = smooth(L.cloudBase * 0.2, L.roadTop, sy);
        c0 = skyTop[0] + (skyHorizon[0] - skyTop[0]) * f;
        c1 = skyTop[1] + (skyHorizon[1] - skyTop[1]) * f;
        c2 = skyTop[2] + (skyHorizon[2] - skyTop[2]) * f;
      } else {
        c0 = skyGround[0];
        c1 = skyGround[1];
        c2 = skyGround[2];
      }
      c0 = Math.round(bgRGB[0] + (c0 - bgRGB[0]) * k);
      c1 = Math.round(bgRGB[1] + (c1 - bgRGB[1]) * k);
      c2 = Math.round(bgRGB[2] + (c2 - bgRGB[2]) * k);
      const dark = (0.2126 * c0 + 0.7152 * c1 + 0.0722 * c2) / 255 < 0.38;
      rowFill[r] = "rgb(" + c0 + "," + c1 + "," + c2 + ")";
      rowInv[r] = !darkPage && dark ? 1 : 0;
      rowAlt[r] = darkPage || dark ? 1 : 0;
      tone[r] = dark ? 1 : 0;
    }
  }

  // --------------------------------------------------------------- places ---

  // Which place a point of a layer belongs to. Near the end of each stretch the
  // next place takes over, first for a few objects and then for all of them.
  function biomeAt(wx, len, key, salt) {
    const b = wx / len;
    const i = Math.floor(b);
    const next = hash2(key, salt) < smooth(1 - BLEND, 1, b - i) ? 1 : 0;
    return ORDER[mod(i + next, NB)];
  }

  // The same without the mixing. The place changes halfway through the blend.
  function crispBiome(wx) {
    return ORDER[mod(Math.floor(wx / BIOME_LEN + BLEND / 2), NB)];
  }

  function spanIsBridge(k) {
    return crispBiome((k + 0.5) * SPAN * cw) === BRIDGE;
  }

  // The place a column of the front layer belongs to, with the bridge snapped
  // to whole spans so it starts and ends at a tower.
  function placeAt(wc) {
    const k = Math.floor(wc / SPAN);
    if (spanIsBridge(k)) return BRIDGE;
    const idx = Math.floor(((wc + 0.5) * cw) / BIOME_LEN + BLEND / 2);
    const p = ORDER[mod(idx, NB)];
    if (p !== BRIDGE) return p;
    return ORDER[mod(idx + (spanIsBridge(k - 1) ? 1 : -1), NB)];
  }

  // Front-layer objects stand on lots, and a lot belongs to the place its
  // middle is in. The set piece where two places meet covers the change.
  function nearBiomeAt(x, t) {
    const lot = Math.floor(Math.floor((x + t * SPEED_NEAR) / cw) / LOT_NEAR);
    return placeAt(lot * LOT_NEAR + (LOT_NEAR >> 1));
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
      case BRIDGE: return H * 0.2 + H * 0.09 * ridge(u * 0.8, 3.1);
      case HIGHWAY: return H * 0.14 * ridge(u * 0.7, 6.2);
      case SHORE: return H * 0.2;
      case COUNTRY:
      case RALLY: return H * 0.2 * (0.35 + 0.65 * (noise3(u * 0.6, 11.1, 0.3) * 0.5 + 0.5));
      case VILLAGE: return H * 0.18 * (0.4 + 0.6 * (noise3(u * 0.7, 41.3, 0.6) * 0.5 + 0.5));
      case MOUNTAINS: return H * 0.56 * Math.pow(ridge(u * 1.3, 4.4), 1.3);
      case WINTER: return H * 0.34 * (0.3 + 0.7 * ridge(u * 0.9, 51.7));
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
      // Which place this column shows is decided in front-layer terms. The
      // hills keep their own, slower drift for their shape.
      const wn = x + t * SPEED_NEAR;
      const b = wn / BIOME_LEN;
      const i = Math.floor(b);
      const w = smooth(1 - BLEND, 1, b - i);
      const u = (x + t * SPEED_HILLS) / 520;
      const cur = ORDER[mod(i, NB)], nxt = ORDER[mod(i + 1, NB)];
      let tb = cur;
      let h = terrainHeight(cur, u);
      // How many rows of sea show behind the road, blended like the height.
      let sea = seaBehind(cur);
      if (w > 0) {
        h += (terrainHeight(nxt, u) - h) * w;
        sea += (seaBehind(nxt) - sea) * w;
        if (hash2(Math.floor(wn / (cw * 3)), 5) < w) tb = nxt;
      }
      HF[c] = L.roadTop - h;
      HB[c] = tb;
      SEA[c] = Math.min(sea * seaRows(), h / ch);
      BB[c] = placeAt(Math.floor(wn / cw));
      NBI[c] = nearBiomeAt(x, t);
      // A middle-layer object takes the place its centre is in right now.
      const mlot = Math.floor(Math.floor((x + t * SPEED_MID) / cw) / LOT_MID);
      const lotX = (mlot + 0.5) * LOT_MID * cw - t * SPEED_MID;
      MBI[c] = biomeAt(lotX + t * SPEED_NEAR, BIOME_LEN, mlot, 31);
    }
  }

  // The sea shows behind the road along the bridge and the shore road.
  function seaBehind(p) {
    return p === BRIDGE || p === SHORE ? 1 : 0;
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
    // Clouds only form in the upper part of the sky. At dusk they take on the
    // colour of the sunset.
    if (sy < L.cloudBase * 1.3) {
      const hv = hash3(c, sr, Math.floor(t * 0.4 + hash2(c, sr + 5000) * 8));
      const cx = (x + t * 4) / 230, cy = sy / 115;
      const d = noise3(cx, cy, t * 0.018) * 0.62 + noise3(cx * 2.3, cy * 2.3, t * 0.03 + 5.1) * 0.38;
      const v = d - (0.1 + 0.1 * env.night + 0.6 * smooth(L.cloudBase * 0.35, L.cloudBase * 1.25, sy));
      const pink = env.dusk > 0.4;
      if (v > 0.26) return hv < 0.02 ? (pick(S.digits, hv * 50) << 7) | 1 : (pick(S.cloudDense, hv) << 7) | (pink ? cr(DUSK, 0) : 0);
      if (v > 0.13) return hv < 0.03 ? (pick(S.digits, hv * 33) << 7) | 1 : (pick(S.cloudMid, hv) << 7) | (pink ? cr(DUSK, 1) : 1);
      if (v > 0.03) return (pick(S.cloudEdge, hv) << 7) | (pink ? cr(DUSK, 2) : 3);
    }
    if (env.sunR > 0 && Math.abs(x - env.sunX) < env.sunR + cw && Math.abs(sy - env.sunY) < env.sunR + ch) {
      const low = env.dusk > 0.35;
      const bits = discBits(x, sy, env.sunX, env.sunY, env.sunR, low);
      if (bits) return (S.quads[bits] << 7) | (low ? cr(DUSK, 0) : cr(SUN, 0));
    }
    if (env.moonR > 0 && Math.abs(x - env.moonX) < env.moonR + cw && Math.abs(sy - env.moonY) < env.moonR + ch) {
      let bits = discBits(x, sy, env.moonX, env.moonY, env.moonR, false);
      if (bits) bits &= ~discBits(x, sy, env.moonX + env.moonR * 0.5, env.moonY - env.moonR * 0.15, env.moonR * 0.85, false);
      if (bits) return (S.quads[bits] << 7) | cr(NIGHT, 0);
    }
    // The northern lights over the winter valley.
    if (env.night > 0.5 && BB[c] === WINTER && sy < L.H * 0.5) {
      const top = L.H * (0.08 + 0.06 * noise3(x / 260, 4.2, t * 0.05));
      const d = (sy - top) / (L.H * 0.2);
      if (d > 0 && d < 1) {
        const n = noise3(x / 70 + t * 0.06, 8.3, t * 0.12) * 0.5 + 0.5;
        if (n > 0.4 + Math.abs(d - 0.6) * 0.4 && hash3(c, sr, Math.floor(t * 3)) < 0.85) {
          if (d < 0.45) return (G("¦") << 7) | cr(PURPLE, d < 0.25 ? 2 : 1);
          return (G_PIPE << 7) | cr(LEAF, d > 0.75 ? 0 : 1);
        }
      }
    }
    if (env.night > 0.3) {
      const hs = hash2(c * 7 + 3, sr * 13 + 1);
      if (hs < 0.022 * env.night) {
        const tw = hash3(c, sr, Math.floor(t * 1.7 + hs * 90));
        return tw < 0.72 ? (G_DOT << 7) | cr(NIGHT, 2) : tw < 0.92 ? (G_PLUS << 7) | cr(NIGHT, 1) : (G_SPARK << 7) | cr(NIGHT, 0);
      }
    }
    if (sy < L.roadTop) {
      const key = sr * 4096 + (c >> 1);
      if (key !== zzKey) {
        zzKey = key;
        zzVal = noise3(((c | 1) * cw) / 320 + t * 0.012, sy / 150, 9.1);
      }
      if (zzVal > 0.42) return ((c & 1 ? G_BACK : G_SLASH) << 7) | cr(SKY, zzVal > 0.58 ? 1 : 2);
    }
    const hs = hash2(Math.floor((x + t * 9) / cw), sr + 400);
    if (hs < 0.01) return ((hs < 0.006 ? G_DASH : G_DOT) << 7) | 4;
    return c % GRID === 0 ? (G_GRID << 7) | 6 : -1;
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
    // Water behind the road, out to the horizon or to the hills across the
    // bay, with a strip of beach and a line of surf along the shore road. A
    // low sun or the moon lays a path of glitter across it.
    const ly = Math.floor((L.roadTop - sy) / ch);
    if (ly < SEA[c]) {
      if (HB[c] === SHORE && ly === 0) return hv < 0.45 ? (pick(S.base, hv * 2.2) << 7) | cr(SAND, 0) : -1;
      if (HB[c] === SHORE && ly === 1) {
        const surf = hash2(Math.floor(((c + 0.5) * cw + t * 5) / (cw * 2)), sr + 2600);
        return surf < 0.7 ? ((surf < 0.35 ? G_TILDE : G_DASH) << 7) | cr(SNOW, surf < 0.35 ? 0 : 1) : -1;
      }
      const top = Math.ceil(SEA[c]) - 1;
      if (ly === top) return (G_H << 7) | cr(WATER, 1);
      const deep = top - ly;
      const cx = (c + 0.5) * cw;
      if (env.sunR > 0 && env.dusk > 0.2 && hv < 0.55 && Math.abs(cx - env.sunX) < env.sunR * (0.5 + deep * 0.08)) {
        return (G_HH << 7) | cr(DUSK, 0);
      }
      if (env.moonR > 0 && env.night > 0.5 && hv < 0.4 && Math.abs(cx - env.moonX) < env.moonR * (0.4 + deep * 0.06)) {
        return (G_H << 7) | cr(NIGHT, 1);
      }
      const wx = Math.floor((cx + t * (4 + deep * 1.5)) / cw);
      const hw = hash2(Math.floor(wx / 3), sr + 2500);
      if (hw < 0.16 + deep * 0.02) return ((hw < 0.07 ? G_TILDE : G_DASH) << 7) | cr(WATER, deep < 4 ? 2 : 1);
      return -1;
    }
    let eg = G_DASH;
    if (slope < -0.3) eg = G_SLASH;
    else if (slope > 0.3) eg = G_BACK;
    else if (hl > h && hr > h) eg = G_CARET;
    switch (HB[c]) {
      case MOUNTAINS: {
        if (edge) return (eg << 7) | cr(ROCK, 0);
        // High peaks keep snow on top.
        const peak = (L.roadTop - h) / (L.H * 0.56);
        if (peak > 0.5 && depth < 1.5 + peak * 5) return (G_SNOWFIELD << 7) | cr(SNOW, 1);
        const fade = 1 - smooth(4, 18, depth);
        if (slope > 0.05) {
          if (mod(wc - sr, 3) === 0 && hv < 0.85 * fade + 0.1) return (G_BACK << 7) | cr(ROCK, 1);
          if (hv < 0.35 * fade) return (pick(S.rock, hash2(wc, sr)) << 7) | cr(ROCK, 1);
        } else if (mod(wc + sr, 4) === 0 && hv < 0.6 * fade) return (G_SLASH << 7) | cr(ROCK, 2);
        return hv < 0.05 ? (pick(S.base, hash2(sr, wc)) << 7) | cr(ROCK, 2) : -1;
      }
      case WINTER: {
        // Snowfields with a few dark pines showing through.
        if (edge) return (eg << 7) | cr(SNOW, 0);
        if (depth < 3) return (G_SNOWFIELD << 7) | cr(SNOW, 1);
        if (mod(wc + sr, 5) === 0 && hv < 0.45) return (G_TRI << 7) | cr(PINE, 1);
        return hv < 0.06 ? (G_DOT << 7) | cr(SNOW, 2) : -1;
      }
      case FOREST: {
        if (edge) return (G_TRI << 7) | cr(PINE, 0);
        if (mod(wc + (sr & 1) * 2, 3) === 0 && hv < 0.9 - depth * 0.05) {
          return (pick(S.pineTop, hv) << 7) | cr(PINE, depth < 4 ? 1 : 2);
        }
        return -1;
      }
      case COUNTRY:
      case RALLY: {
        // Rolling hills in a patchwork of grass and wheat with hedges between.
        // The rally stage runs through drier country.
        if (edge) return ((Math.abs(slope) < 0.3 ? G_US : eg) << 7) | cr(GRASS, 0);
        if (mod(wc, 10) === 0) return (G_DOT << 7) | cr(PINE, 1);
        const style = hash2(Math.floor(wc / 10) * 31 + Math.floor(depth / 2.5), 3);
        if (style < 0.25) return -1;
        const grass = style < (HB[c] === RALLY ? 0.4 : 0.6);
        if ((sr & 1) === 0) return (pick(S.field, style) << 7) | cr(grass ? GRASS : WHEAT, 0);
        return style > 0.6 && hv < 0.5 ? (G_DOT << 7) | cr(WHEAT, 2) : -1;
      }
      case VILLAGE: {
        // Hills with rows of apple trees.
        if (edge) return ((Math.abs(slope) < 0.3 ? G_US : eg) << 7) | cr(GRASS, 0);
        if (mod(wc, 6) < 2 && mod(sr, 3) === 0) return hv < 0.18 ? (G_BULLET << 7) | 7 : (G("♣") << 7) | cr(LEAF, 1);
        return hv < 0.08 ? (G_DOT << 7) | cr(GRASS, 2) : -1;
      }
      case DESERT: {
        if (edge) return ((Math.abs(slope) < 0.3 ? G_TILDE : eg) << 7) | cr(SAND, 0);
        if (mod(sr + Math.floor(wc / 5), 3) === 0 && hv < 0.45) return (G_TILDE << 7) | cr(SAND, 1);
        return hv < 0.04 ? (G_DOT << 7) | cr(SAND, 1) : -1;
      }
      default: {
        // Low hills behind the city, the highway and across the bay, blue
        // with distance.
        if (edge) return (eg << 7) | cr(SLATE, 1);
        const fade = 1 - smooth(3, 10, depth);
        if (slope > 0.05) {
          if (mod(wc - sr, 3) === 0 && hv < 0.7 * fade + 0.1) return (G_BACK << 7) | cr(SLATE, 2);
        } else if (mod(wc + sr, 4) === 0 && hv < 0.4 * fade) return (G_SLASH << 7) | cr(SLATE, 2);
        return hv < 0.04 ? (pick(S.base, hash2(sr, wc)) << 7) | cr(SLATE, 2) : -1;
      }
    }
  }

  // --------------------------------------------------------------- sprites ---
  // Small pictures drawn in half-cell blocks. Each letter is a colour key, and
  // every two columns and two rows of letters make one cell, drawn with the
  // block glyph that fills the same quarters. Keys get their colour when drawn.
  function makeSprite(rows) {
    const h = Math.ceil(rows.length / 2);
    const w = Math.ceil(rows[0].length / 2);
    const glyph = new Int16Array(w * h).fill(-1);
    const key = new Array(w * h).fill(null);
    for (let cy = 0; cy < h; cy++) {
      for (let cx = 0; cx < w; cx++) {
        let bits = 0, k = null;
        for (let q = 0; q < 4; q++) {
          const chr = (rows[cy * 2 + (q >> 1)] || "")[cx * 2 + (q & 1)];
          if (chr && chr !== ".") {
            bits |= 8 >> q;
            if (!k) k = chr;
          }
        }
        if (bits) {
          glyph[cy * w + cx] = S.quads[bits];
          key[cy * w + cx] = k;
        }
      }
    }
    return { w: w, h: h, glyph: glyph, key: key };
  }

  // The code for cell (lx, ly) of a sprite whose bottom-left cell is (0, 0).
  function spriteCell(sp, lx, ly, colours) {
    if (lx < 0 || lx >= sp.w || ly < 0 || ly >= sp.h) return NOT_HERE;
    const i = (sp.h - 1 - ly) * sp.w + lx;
    return sp.glyph[i] < 0 ? NOT_HERE : (sp.glyph[i] << 7) | colours[sp.key[i]];
  }

  const DEER = makeSprite(["a.a.........", ".aa.........", "bbb.........", ".bb.......w.", ".bbbbbbbbbb.", "..bbbbbbbbb.", "..b.b...b.b.", "..b.b...b.b."]);
  const DEER_GRAZE = makeSprite(["............", "............", "..........w.", ".a.bbbbbbbb.", "aabbbbbbbbb.", "bb..bbbbbbb.", "b...b.b.b.b.", "....b.b.b.b."]);
  const RABBIT_ROWS = [".b.b..", ".b.b..", "bbb...", "bbbbbw", ".bbbb.", ".b..b."];
  const RABBIT = makeSprite(RABBIT_ROWS);
  const RABBIT_BACK = makeSprite(RABBIT_ROWS.map(function (s) { return s.split("").reverse().join(""); }));
  const FOX = makeSprite(["b.b.........", "bbb.........", "wbbbbbbbb...", ".bbbbbbbbbbb", ".b.b...b.bbw", ".b.b...b.b.."]);
  const FOX_STEP = makeSprite(["b.b.........", "bbb.........", "wbbbbbbbb...", ".bbbbbbbbbbb", "..bb....bbbw", "..b.b..b.b.."]);
  const PALM = makeSprite(["..ff....ff..", ".f..ff.ff..f", "f....fff...f", ".....tf.....", ".....t......", "....t.......", "....t.......", "....t.......", "...t........", "...t........", "...t........", "...t........", "..tt........", "..tt........"]);
  // The mast has a column of cells to itself, so the sail keeps its colour.
  const SAILBOAT = makeSprite(["...m....", "...ms...", "...mss..", "...msss.", "...mssss", "...m....", "hhhhhhhh", ".hhhhhh."]);
  const SHIP = makeSprite(["....cc......", "..ssssss....", "hhhhhhhhhhhh", ".hhhhhhhhhh."]);
  const SNOWMAN = makeSprite(["..ss..", "..ss..", ".ssss.", ".ssss.", "ssssss", "ssssss"]);
  const PERSON = makeSprite([".hh.", ".hh.", "ssss", "ssss", ".ss.", ".pp.", ".p.p", ".p.p"]);
  const PERSON_WAVE = makeSprite(["s.hh", "s.hh", "ssss", ".sss", ".ss.", ".pp.", ".p.p", ".p.p"]);
  const PHOTOGRAPHER = makeSprite([".hh..", ".hhkk", "sssk.", ".ss..", ".ss..", ".pp..", ".p.p.", ".p.p."]);

  const DEER_COLOURS = { a: cr(ROCK, 0), b: cr(CLAY, 1), w: cr(SNOW, 0) };
  const RABBIT_COLOURS = { b: cr(ROCK, 1), w: cr(SNOW, 0) };
  const FOX_COLOURS = { b: cr(CLAY, 0), w: cr(SNOW, 0) };
  const PALM_COLOURS = { f: cr(LEAF, 0), t: cr(SAND, 0) };
  const SAIL_COLOURS = { m: 1, s: cr(SNOW, 0), h: cr(CLAY, 0) };
  const SHIP_COLOURS = { c: cr(CLAY, 0), s: cr(SLATE, 0), h: cr(SLATE, 1) };
  const SNOWMAN_COLOURS = { s: cr(SNOW, 0) };
  const SHIRTS = [7, cr(WATER, 0), cr(WINDOW, 0), cr(LEAF, 0), cr(PURPLE, 0), cr(SNOW, 0)];
  const PEOPLE_COLOURS = SHIRTS.map(function (s) { return { h: cr(SAND, 0), s: s, p: cr(SLATE, 0), k: 1 }; });
  const FLOWERS = [7, cr(DUSK, 0), cr(WINDOW, 0), cr(PURPLE, 0), cr(SNOW, 0)];

  // --------------------------------------------------------------- objects ---
  // Objects stand on lots of a fixed width along an endless roadside, and
  // everything about an object comes from hashing its lot number. Each
  // function returns a glyph code, -1 for the blank inside of an object, or
  // NOT_HERE when the point is not on one. `ly` counts rows up from the road.

  // Windows switch on and off every few seconds, and more are lit at night.
  function windowCode(id, lx, ly, t) {
    const hw = hash2(id * 64 + lx, ly + 300);
    const on = hash3(id * 64 + lx, ly, Math.floor(t / 7 + hw * 7)) < 0.3 + 0.4 * env.night;
    if (!on) return (G_OPEN << 7) | 3;
    return hw < 0.035 ? (G_SMALL << 7) | 7 : (G_SMALL << 7) | cr(WINDOW, 0);
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
      if (ly < floors + ant - 1) return (G_PIPE << 7) | 1;
      return Math.floor(t / 0.8 + ha * 5) % 2 ? (G_BULLET << 7) | 7 : (G_TICK << 7) | 2;
    }
    let left = 0, right = w - 1;
    // Stepped towers are two cells narrower on each side above the shoulder.
    if (style === 3 && w > 7) {
      const shoulder = Math.floor(floors * 0.7);
      const outside = lx < 2 || lx > w - 3;
      if (ly > shoulder && outside) return NOT_HERE;
      if (ly === shoulder && outside) return ((lx === 0 ? G_TL : lx === w - 1 ? G_TR : G_H) << 7) | 1;
      if (ly > shoulder) {
        left = 2;
        right = w - 3;
      }
    }
    if (ly === floors - 1) {
      const round = style === 4;
      const g = lx === left ? (round ? G_RTL : G_TL) : lx === right ? (round ? G_RTR : G_TR) : G_H;
      return (g << 7) | 1;
    }
    if (lx === left || lx === right) return (G_PIPE << 7) | 1;
    const ix = lx - left;
    if (style === 1) {
      if (ly % 3 === 0) return (G_HH << 7) | 2;
      return ix % 2 === 1 ? windowCode(lot, lx, ly, t) : -1;
    }
    if (style === 2) {
      if (ix % 3 === 0) return (G_PIPE << 7) | 3;
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
    if (ly === floors - 1) return (G_H << 7) | cr(SLATE, 0);
    if (lx === 0 || lx === w - 1) return (G_PIPE << 7) | cr(SLATE, 1);
    if (lx % 2 === 1 && ly % 2 === 0) {
      const on = hash3(lot * 16 + lx, ly, Math.floor(t / 9 + hash2(lot, ly) * 9)) < 0.25 + 0.4 * env.night;
      return on ? (G_SMALL << 7) | cr(WINDOW, 1) : (G_DOT << 7) | cr(SLATE, 2);
    }
    // Distant buildings are hatched so they read as a mass behind the front row.
    return mod(wc + ly, 3) === 0 ? (G_SLASH << 7) | cr(SLATE, 2) : -1;
  }

  // Street lamps along the promenade, lit at night, in front of the buildings.
  function cityNear(wc, ly, t) {
    const p = mod(wc, 23);
    if (ly <= 4 && p >= 7 && p <= 10) {
      if (p === 7) return ((ly === 4 ? G_TL : G_PIPE) << 7) | 1;
      if (p === 8 && ly === 4) return (G_H << 7) | 1;
      if (p === 9 && ly === 4) return env.night > 0.4 ? (G_SQ << 7) | cr(WINDOW, 0) : (G_DOWN << 7) | 1;
      if (env.night > 0.4 && ly >= 2 && ly <= 3 && hash3(wc, ly, Math.floor(t * 4)) < 0.5) return (G_DOT << 7) | cr(WINDOW, 1);
    }
    return building(wc, ly, t);
  }

  // A suspension bridge: a pair of legs every SPAN cells, the main cable
  // hanging between them, hangers down to the deck and a railing.
  const SPAN = 64;
  const LEGS = 4;
  function bridgeHeight() {
    return Math.max(6, Math.round((L.H * 0.5) / ch));
  }

  function bridgeTower(lx, ly) {
    const th = bridgeHeight();
    if (ly > th) return NOT_HERE;
    if (lx === 0 || lx === LEGS - 1) return ((ly === th ? G_DTEE : G_DPIPE) << 7) | cr(CLAY, 0);
    if (ly === th || ly === Math.round(th * 0.62) || ly === Math.round(th * 0.3)) return (G_HH << 7) | cr(CLAY, 0);
    return NOT_HERE;
  }

  function bridgeNear(wc, ly) {
    const th = bridgeHeight();
    const lx = mod(wc, SPAN);
    if (lx < LEGS) return bridgeTower(lx, ly);
    if (ly === 0) return ((lx % 3 === 0 ? G_TEE : G_H) << 7) | 2;
    const span = SPAN - LEGS;
    const s0 = (lx - LEGS) / span, s1 = (lx - LEGS + 1) / span;
    const sag = th * 0.85;
    const h0 = Math.round(th - sag * 4 * s0 * (1 - s0));
    const h1 = Math.round(th - sag * 4 * s1 * (1 - s1));
    const lo = Math.min(h0, h1), hi = Math.max(h0, h1);
    if (ly >= lo && ly <= hi) return ((h0 === h1 ? G_H : h1 < h0 ? G_BACK : G_SLASH) << 7) | cr(CLAY, 0);
    if (lx % 3 === 1 && ly < lo) return (G_PIPE << 7) | cr(CLAY, 2);
    return NOT_HERE;
  }

  // A pine: a trunk, then rows that narrow to a point. `lvl` sets how dark it
  // is, so distant pines are lighter. Snowy pines carry snow along their edges.
  function pine(wc, ly, salt, density, hmin, hmax, lvl, snowy) {
    const hwMax = Math.floor((hmax - 1) * 0.55);
    const lotW = 2 * hwMax + 5;
    const lot = Math.floor(wc / lotW);
    if (hash2(lot, salt) > density) return NOT_HERE;
    const cx = hwMax + 1 + ((hash2(lot, salt + 1) * 3) | 0);
    const hgt = hmin + ((hash2(lot, salt + 2) * (hmax - hmin + 1)) | 0);
    const dx = wc - lot * lotW - cx;
    const shade = Math.min(2, lvl - 1);
    if (ly === 0) return dx === 0 ? (G_PIPE << 7) | cr(ROCK, shade) : NOT_HERE;
    if (ly > hgt) return NOT_HERE;
    const hw = Math.floor((hgt - ly) * 0.55);
    if (dx < -hw || dx > hw) return NOT_HERE;
    const outline = snowy ? cr(SNOW, shade) : cr(PINE, shade);
    if (hw === 0) return (G_TRI << 7) | outline;
    if (dx === -hw) return (G_SLASH << 7) | outline;
    if (dx === hw) return (G_BACK << 7) | outline;
    return (ly + dx) & 1 ? (G_CARET << 7) | cr(PINE, Math.min(2, lvl)) : -1;
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
      if (d < 1) return (pick(S.canopy, hash2(wc, ly + lot)) << 7) | cr(LEAF, d > 0.6 ? 1 : 0);
      if (lx === cx && ly <= trunk) return (G_PIPE << 7) | cr(ROCK, 0);
    } else if (h < 0.66 && lx >= 2 && lx <= 10) {
      // A barn with a red roof.
      if (ly <= 2) {
        if (lx === 2 || lx === 10) return (G_PIPE << 7) | 1;
        if (lx === 6 && ly <= 1) return (G_DARK << 7) | cr(CLAY, 1);
        if ((lx === 4 || lx === 8) && ly === 1) return (G_SMALL << 7) | cr(WINDOW, 1);
        if (ly > 0) return -1;
      } else if (ly <= 6) {
        const k = ly - 3;
        if (lx === 2 + k) return ((2 + k >= 10 - k ? G_CARET : G_SLASH) << 7) | cr(CLAY, 0);
        if (lx === 10 - k) return (G_BACK << 7) | cr(CLAY, 0);
        if (lx > 2 + k && lx < 10 - k) return (lx + ly) % 2 ? (G_SLASH << 7) | cr(CLAY, 2) : -1;
      }
    }
    if (ly === 0) return ((mod(wc, 4) === 0 ? G_CROSS : G_H) << 7) | cr(ROCK, 1);
    return NOT_HERE;
  }

  // Desert: saguaros with an arm on each side, small cacti and rocks.
  function desertNear(wc, ly) {
    const lot = Math.floor(wc / 16);
    const lx = wc - lot * 16;
    const h = hash2(lot, 91);
    const cx = 4 + ((hash2(lot, 92) * 8) | 0);
    const dx = lx - cx;
    const green = cr(LEAF, 1);
    if (h < 0.4) {
      const hgt = 4 + ((hash2(lot, 93) * 4) | 0);
      const a1 = 1 + ((hash2(lot, 94) * 2) | 0), a2 = a1 + 1;
      if (dx === 0 && ly <= hgt) return (G_HPIPE << 7) | green;
      if (dx === -1 && ly === a1) return (G_HEAVY << 7) | green;
      if (dx === -2 && ly === a1) return (G_BLH << 7) | green;
      if (dx === -2 && ly > a1 && ly <= a1 + 2) return (G_HPIPE << 7) | green;
      if (dx === 1 && ly === a2) return (G_HEAVY << 7) | green;
      if (dx === 2 && ly === a2) return (G_BRH << 7) | green;
      if (dx === 2 && ly > a2 && ly <= a2 + 2) return (G_HPIPE << 7) | green;
    } else if (h < 0.55) {
      if (dx === 0 && ly === 0) return (G_PSI << 7) | green;
    } else if (h < 0.68) {
      if (ly === 0 && dx >= 0 && dx <= 2) return ((dx === 0 ? G_ROCK_L : dx === 2 ? G_ROCK_R : G_ROCK_M) << 7) | cr(ROCK, 1);
      if (ly === 1 && dx === 1) return (G_ROCK_T << 7) | cr(ROCK, 1);
    }
    return NOT_HERE;
  }

  // Forest: two rows of tall pines with patches of fog drifting between them.
  function forestNear(wc, ly, t) {
    let p = pine(wc, ly, 81, 0.9, 7, 13, 1);
    if (p !== NOT_HERE) return p;
    p = pine(wc + 9, ly, 85, 0.8, 5, 10, 2);
    if (p !== NOT_HERE) return p;
    if (ly >= 2 && ly <= 6 && hash3(wc >> 1, ly, Math.floor(t * 0.7)) < 0.12) return (G_DASH << 7) | 5;
    return NOT_HERE;
  }

  // Log cabins stand in the forest, the mountains and the winter valley. Each
  // has stacked logs with their ends showing, a window that is lit at night, a
  // plank door, a chimney and a shingle roof that is snowed over in winter.
  const CABIN_LOT = 64;
  const CABIN_DENSITY = [];
  CABIN_DENSITY[FOREST] = 0.3;
  CABIN_DENSITY[MOUNTAINS] = 0.25;
  CABIN_DENSITY[WINTER] = 0.35;

  // The first column of the cabin on a lot, or null. A cabin is wider than an
  // object lot, so it belongs to the place its middle is in.
  function cabinX(lot) {
    const h = hash2(lot, 301);
    if (h >= 0.35) return null;
    const x0 = lot * CABIN_LOT + 16 + ((hash2(lot, 302) * 24) | 0);
    if (h >= (CABIN_DENSITY[placeAt(x0 + 7)] || 0) || inPiece(x0) || inPiece(x0 + 14)) return null;
    return x0;
  }

  function cabin(wc, ly) {
    if (ly > 7) return NOT_HERE;
    const lot = Math.floor(wc / CABIN_LOT);
    const near = wc - lot * CABIN_LOT - 16;
    if (near < 0 || near > 38) return NOT_HERE;
    const x0 = cabinX(lot);
    if (x0 === null) return NOT_HERE;
    const lx = wc - x0;
    if (lx < 0 || lx > 14) return NOT_HERE;
    const snowy = placeAt(x0 + 7) === WINTER;
    if (lx === 11 && ly >= 5) return (G_ROCK_M << 7) | cr(ROCK, 1);
    if (ly >= 4) {
      const k = ly - 4, l = k * 2, r = 14 - k * 2;
      if (lx < l || lx > r) return NOT_HERE;
      const trim = snowy ? cr(SNOW, 0) : cr(ROCK, 0);
      if (lx === l) return (G_SLASH << 7) | trim;
      if (lx === r) return (G_BACK << 7) | trim;
      return snowy ? (G_SNOWFIELD << 7) | cr(SNOW, 1) : (G_SHINGLE << 7) | cr(ROCK, 1);
    }
    if (lx === 0 || lx === 14) return NOT_HERE;
    if (lx === 1 || lx === 13) return (G_SQ << 7) | cr(CLAY, 0);
    if ((lx === 4 || lx === 5) && ly === 2) return (G_SMALL << 7) | (env.night > 0.4 ? cr(WINDOW, 0) : cr(SKY, 1));
    if ((lx === 9 || lx === 10) && ly <= 2) return (G_DARK << 7) | cr(ROCK, 0);
    return ((ly & 1 ? G_HH : G_H) << 7) | cr(CLAY, 1);
  }

  // A gantry over the highway every GANTRY_GAP columns. drawPanels paints
  // its sign.
  const GANTRY_GAP = 150;
  const GANTRY_W = 22;
  function gantryAt(k) {
    const g0 = k * GANTRY_GAP;
    return placeAt(g0 + (GANTRY_W >> 1)) === HIGHWAY && !inPiece(g0) && !inPiece(g0 + GANTRY_W);
  }

  function gantry(wc, ly) {
    if (ly > 12) return NOT_HERE;
    const k = Math.floor(wc / GANTRY_GAP);
    const g = wc - k * GANTRY_GAP;
    if (g > GANTRY_W || !gantryAt(k)) return NOT_HERE;
    if (g === 0 || g === GANTRY_W) return (G_DPIPE << 7) | cr(SLATE, 0);
    if (ly === 12) return (G_HH << 7) | cr(SLATE, 0);
    return ly >= 9 && g >= 2 && g <= GANTRY_W - 2 ? -1 : NOT_HERE;
  }

  // The highway has a crash barrier along the verge and street lights.
  function highwayNear(wc, ly, t) {
    if (ly === 0) return ((mod(wc, 5) === 0 ? G_RAIL : G_HH) << 7) | cr(SLATE, 1);
    const p = mod(wc, 26);
    if (p <= 2 && ly <= 10) {
      if (p === 0) return ((ly === 10 ? G_TL : G_PIPE) << 7) | cr(SLATE, 1);
      if (p === 1 && ly === 10) return (G_H << 7) | cr(SLATE, 1);
      if (p === 2 && ly === 10) return env.night > 0.4 ? (G_SQ << 7) | cr(WINDOW, 0) : (G_DOWN << 7) | cr(SLATE, 1);
      if (p === 2 && env.night > 0.4 && ly >= 7 && hash3(wc, ly, Math.floor(t * 4)) < 0.4) return (G_DOT << 7) | cr(WINDOW, 1);
    }
    return NOT_HERE;
  }

  // Palm trees line the shore road.
  function shoreNear(wc, ly) {
    const lot = Math.floor(wc / LOT_NEAR);
    if (hash2(lot, 321) > 0.55) return NOT_HERE;
    return spriteCell(PALM, wc - lot * LOT_NEAR - 1 - ((hash2(lot, 322) * 7) | 0), ly, PALM_COLOURS);
  }

  // The rally stage has tape along the verge with spectators behind it. Some
  // of them wave, a photographer's flash goes off now and then, and there are
  // hay bales.
  function rallyNear(wc, ly, t) {
    if (ly === 0) {
      if (mod(wc, 12) === 0) return (G_CROSS << 7) | 2;
      return (G_TAPE << 7) | ((wc >> 1) & 1 ? 7 : cr(PAPER, 0));
    }
    const lot = Math.floor(wc / LOT_NEAR);
    const lx = wc - lot * LOT_NEAR;
    const h = hash2(lot, 331);
    if (h < 0.6) {
      const n = 2 + ((hash2(lot, 332) * 3) | 0);
      const i = Math.floor((lx - 1) / 3);
      if (lx < 1 || i >= n || (lx - 1) % 3 === 2) return NOT_HERE;
      const who = lot * 7 + i;
      const waving = hash2(who, 333) < 0.5 && Math.floor(t * 3 + hash2(who, 334) * 4) % 2 === 0;
      const colours = PEOPLE_COLOURS[(hash2(who, 335) * PEOPLE_COLOURS.length) | 0];
      return spriteCell(waving ? PERSON_WAVE : PERSON, (lx - 1) % 3, ly - 1, colours);
    }
    if (h < 0.72) {
      if (lx === 7 && ly === 4 && hash3(lot, 336, Math.floor(t * 2.5)) < 0.15) return (G_SPARK << 7) | cr(PAPER, 0);
      return spriteCell(PHOTOGRAPHER, lx - 4, ly - 1, PEOPLE_COLOURS[(hash2(lot, 337) * PEOPLE_COLOURS.length) | 0]);
    }
    if (h < 0.88 && ly === 1 && lx >= 4 && lx <= 8) return ((lx === 4 || lx === 8 ? G_ROCK_T : G_ROCK_M) << 7) | cr(WHEAT, 0);
    return NOT_HERE;
  }

  // The Czech village has white houses with red tiled roofs and chimneys,
  // apple trees, flower beds and a picket fence.
  function villageNear(wc, ly) {
    const lot = Math.floor(wc / LOT_NEAR);
    const lx = wc - lot * LOT_NEAR;
    const h = hash2(lot, 341);
    if (h < 0.55 && lx >= 1 && lx <= 12 && ly <= 9) {
      if (ly <= 3) {
        if (lx === 1 || lx === 12) return NOT_HERE;
        if (lx === 2 || lx === 11) return (G_PIPE << 7) | 1;
        if (lx === 7 && ly <= 1) return (G_DARK << 7) | cr(ROCK, 0);
        if ((lx === 4 || lx === 9) && ly === 2) return (G_SMALL << 7) | (env.night > 0.4 ? cr(WINDOW, 0) : cr(SKY, 1));
        return -1;
      }
      if (lx === 10 && ly <= 7) return (G_ROCK_M << 7) | cr(ROCK, 1);
      const k = ly - 4, l = 1 + k, r = 12 - k;
      if (lx < l || lx > r) return NOT_HERE;
      if (l >= r - 1) return (G_CARET << 7) | cr(CLAY, 0);
      if (lx === l) return (G_SLASH << 7) | cr(CLAY, 0);
      if (lx === r) return (G_BACK << 7) | cr(CLAY, 0);
      return (G_SHINGLE << 7) | cr(CLAY, 1);
    }
    if (h < 0.8) {
      const dx = (lx - 6) / 3.2, dy = (ly + 0.5 - 4) / 2;
      const d = dx * dx + dy * dy;
      if (d < 1) return hash2(wc, ly + lot) < 0.15 ? (G_BULLET << 7) | 7 : (pick(S.canopy, hash2(wc, ly)) << 7) | cr(LEAF, d > 0.6 ? 1 : 0);
      if (lx === 6 && ly <= 2) return (G_PIPE << 7) | cr(ROCK, 0);
    } else if (ly === 1 && lx >= 2 && lx <= 11 && hash2(wc, 343) < 0.7) {
      return (G_STAR << 7) | FLOWERS[(hash2(wc, 344) * FLOWERS.length) | 0];
    }
    if (ly === 0) return ((mod(wc, 3) === 0 ? G_CROSS : G_H) << 7) | 3;
    return NOT_HERE;
  }

  // The winter valley has snowmen in hats and snowy pines.
  function winterNear(wc, ly) {
    const lot = Math.floor(wc / LOT_NEAR);
    if (hash2(lot, 351) < 0.3) {
      const lx = wc - lot * LOT_NEAR - 5;
      if (lx === 1 && ly === SNOWMAN.h) return (G_ROCK_T << 7) | 1;
      const p = spriteCell(SNOWMAN, lx, ly, SNOWMAN_COLOURS);
      if (p !== NOT_HERE) return p;
    }
    return pine(wc, ly, 91, 0.75, 4, 10, 1, true);
  }

  function nearCell(x, sy, t, biome) {
    const ly = Math.floor((L.roadTop - sy) / ch);
    if (ly < 0) return NOT_HERE;
    const wc = Math.floor((x + t * SPEED_NEAR) / cw);
    // The bridge covers whole spans, so it starts and ends at a tower.
    const k = Math.floor(wc / SPAN);
    if (spanIsBridge(k)) return bridgeNear(wc, ly);
    if (mod(wc, SPAN) < LEGS && spanIsBridge(k - 1)) return bridgeTower(mod(wc, SPAN), ly);
    let p = transitionPiece(wc, ly, t);
    if (p !== NOT_HERE) return p === CLEAR ? NOT_HERE : p;
    p = cabin(wc, ly);
    if (p !== NOT_HERE) return p;
    p = gantry(wc, ly);
    if (p !== NOT_HERE) return p;
    if (biome === BRIDGE) biome = placeAt(wc);
    switch (biome) {
      case CITY: return cityNear(wc, ly, t);
      case HIGHWAY: return highwayNear(wc, ly, t);
      case SHORE: return shoreNear(wc, ly);
      case DESERT: return desertNear(wc, ly);
      case RALLY: return rallyNear(wc, ly, t);
      case COUNTRY: return countryNear(wc, ly);
      case VILLAGE: return villageNear(wc, ly);
      case MOUNTAINS: return pine(wc, ly, 71, 0.5, 4, 9, 1);
      case WINTER: return winterNear(wc, ly);
      default: return forestNear(wc, ly, t);
    }
  }

  // A railway in the middle distance. Every so often a train runs along it
  // from right to left, faster than the scenery.
  const TRAIN_CAR = 11;
  function railCell(x, ly, t) {
    if (ly < 3 || ly > 5) return NOT_HERE;
    const rail = (G_H << 7) | 3;
    const k = Math.floor(t / 24);
    const head = vw + 60 - (t - k * 24) * 170;
    const dx = x - head;
    if (hash2(k, 7) > 0.8 || dx < 0 || dx >= 7 * TRAIN_CAR * cw) return ly === 3 ? rail : NOT_HERE;
    const car = Math.floor(dx / (TRAIN_CAR * cw));
    const lx = Math.floor(dx / cw) - car * TRAIN_CAR;
    const body = cr(WATER, 0);
    if (ly === 3) return lx === 1 || lx === 8 ? (G_O << 7) | 1 : rail;
    if (lx === 10) return ly === 4 ? (G_H << 7) | 2 : NOT_HERE;
    if (ly === 5) return ((lx === 0 ? (car === 0 ? G_RTL : G_TL) : lx === 9 ? G_TR : G_H) << 7) | body;
    if (lx === 0 || lx === 9) return (G_PIPE << 7) | body;
    if (car === 0) return lx <= 2 ? (G_SMALL << 7) | cr(SKY, 0) : (G_DARK << 7) | cr(WATER, 1);
    return lx % 2 === 1 ? (env.night > 0.4 ? (G_SMALL << 7) | cr(WINDOW, 0) : (G_OPEN << 7) | cr(SKY, 1)) : -1;
  }

  // Wind turbines with three turning blades.
  const TURBINE_GAP = 34;
  function turbine(wc, ly, t) {
    const k = Math.round(wc / TURBINE_GAP);
    if (hash2(k, 131) > 0.55) return NOT_HERE;
    const mast = Math.round((L.H * 0.3) / ch);
    const dxc = wc - k * TURBINE_GAP;
    if (dxc === 0 && ly < mast) return (G_PIPE << 7) | 2;
    const dx = dxc * cw, dy = (ly - mast) * ch;
    const r = Math.hypot(dx, dy);
    if (r < 1) return (G_PLUS << 7) | 1;
    if (r > L.H * 0.12) return NOT_HERE;
    const a = Math.atan2(dy, dx);
    const rot = t * 1.2 + k * 2.1;
    for (let b = 0; b < 3; b++) {
      const blade = rot + (b * 2 * Math.PI) / 3;
      const diff = Math.atan2(Math.sin(a - blade), Math.cos(a - blade));
      if (Math.abs(diff) * r < cw * 0.7) {
        const ang = mod(blade, Math.PI);
        const g = ang < Math.PI / 8 || ang > (7 * Math.PI) / 8 ? G_H : ang < (3 * Math.PI) / 8 ? G_SLASH : ang < (5 * Math.PI) / 8 ? G_PIPE : G_BACK;
        return (g << 7) | 2;
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
    if (ly === hgt - 1) return (G_H << 7) | cr(CLAY, 0);
    if (lx === l) return (G_SLASH << 7) | cr(CLAY, 0);
    if (lx === r) return (G_BACK << 7) | cr(CLAY, 0);
    return ly % 2 === 0 ? (G_H << 7) | cr(CLAY, 1) : mod(lx * 7 + ly, 5) === 0 ? (G_DOT << 7) | cr(CLAY, 0) : -1;
  }

  function midCell(x, sy, t, biome) {
    const ly = Math.floor((L.roadTop - sy) / ch);
    if (ly < 0) return NOT_HERE;
    const wc = Math.floor((x + t * SPEED_MID) / cw);
    let p = wideMid(wc, ly, t);
    if (p !== NOT_HERE) return p;
    switch (biome) {
      case CITY: return farBuilding(wc, ly, t);
      case HIGHWAY: return pine(wc, ly, 151, 0.35, 1, 3, 3);
      case BRIDGE:
      case SHORE: return shoreMid(wc, ly, t);
      case COUNTRY:
        p = railCell(x, ly, t);
        if (p !== NOT_HERE) return p;
        p = turbine(wc, ly, t);
        if (p !== NOT_HERE) return p;
        return pine(wc, ly, 101, 0.3, 1, 3, 3);
      case RALLY: return pine(wc, ly, 141, 0.5, 2, 6, 3);
      case VILLAGE: return villageMid(wc, ly);
      case MOUNTAINS:
        p = railCell(x, ly, t);
        if (p !== NOT_HERE) return p;
        return pine(wc, ly, 111, 0.6, 2, 5, 3);
      case WINTER: return pine(wc, ly, 131, 0.85, 2, 6, 3, true);
      case DESERT: return mesa(wc, ly);
      case FOREST:
        p = pine(wc, ly, 121, 0.95, 3, 7, 3);
        return p !== NOT_HERE ? p : pine(wc + 4, ly, 125, 0.8, 2, 5, 4);
      default: return NOT_HERE;
    }
  }

  // The place a column of the middle layer is passing right now, in front
  // layer terms.
  function midPlace(wc, t) {
    return crispBiome((wc + 0.5) * cw + t * (SPEED_NEAR - SPEED_MID));
  }

  // Some landmarks in the middle distance are wider than a lot. They are an
  // overpass across the highway, a lighthouse off the shore and the village
  // church. Each belongs to the place its middle is in.
  function wideMid(wc, ly, t) {
    let lot = Math.floor(wc / 120);
    let lx = wc - lot * 120 - 30;
    if (lx >= 0 && lx <= 40 && ly <= 8 && hash2(lot, 391) < 0.45 && midPlace(lot * 120 + 50, t) === HIGHWAY) {
      return overpass(lx, ly);
    }
    lot = Math.floor(wc / 110);
    lx = wc - lot * 110 - 50;
    if (lx >= -1 && lx <= 3 && ly <= 12 && hash2(lot, 361) < 0.45 && midPlace(lot * 110 + 51, t) === SHORE) {
      return lighthouse(lx, ly);
    }
    lot = Math.floor(wc / 70);
    lx = wc - lot * 70 - 20;
    if (lx >= 0 && lx <= 12 && ly <= 12 && hash2(lot, 371) < 0.5 && midPlace(lot * 70 + 26, t) === VILLAGE) {
      return church(lx, ly);
    }
    return NOT_HERE;
  }

  function overpass(lx, ly) {
    if (ly === 8) return ((lx % 2 === 0 ? G_TEE : G_H) << 7) | cr(SLATE, 1);
    if (ly === 7) return (G_HH << 7) | cr(SLATE, 0);
    if (ly === 6) return (G_ROCK_T << 7) | cr(SLATE, 1);
    if (lx === 6 || lx === 7 || lx === 33 || lx === 34) return (G_ROCK_M << 7) | cr(SLATE, 1);
    return NOT_HERE;
  }

  // A lighthouse in red and white bands on a rock, its lamp lit at night.
  function lighthouse(lx, ly) {
    if (ly === 0) return ((lx === -1 ? G_ROCK_L : lx === 3 ? G_ROCK_R : G_ROCK_M) << 7) | cr(ROCK, 0);
    if (lx < 0 || lx > 2) return NOT_HERE;
    if (ly === 1) return (G_ROCK_M << 7) | cr(ROCK, 1);
    if (ly <= 10) return (G_ROCK_M << 7) | (((ly - 2) >> 1) & 1 ? cr(PAPER, 0) : 7);
    if (ly === 11) return lx === 1 ? (G_SQ << 7) | cr(WINDOW, env.night > 0.4 ? 0 : 2) : (G_PIPE << 7) | 1;
    return lx === 1 ? (G_TRI << 7) | 1 : NOT_HERE;
  }

  // A church with a green onion dome on its tower.
  function church(lx, ly) {
    if (lx <= 9) {
      if (ly > 4) return NOT_HERE;
      if (ly === 4) return (G_ROCK_T << 7) | cr(CLAY, 0);
      if (lx === 0) return (G_PIPE << 7) | cr(SLATE, 0);
      if ((lx === 3 || lx === 6) && ly === 2) return (G_SMALL << 7) | (env.night > 0.4 ? cr(WINDOW, 1) : cr(SLATE, 2));
      return -1;
    }
    if (ly <= 9) {
      if (lx === 10 || lx === 12) return (G_PIPE << 7) | cr(SLATE, 0);
      return ly === 7 ? (G_SMALL << 7) | (env.night > 0.4 ? cr(WINDOW, 1) : cr(SLATE, 1)) : -1;
    }
    if (ly === 10) return (G_ROCK_T << 7) | cr(PINE, 0);
    if (lx !== 11) return NOT_HERE;
    if (ly === 11) return (G("♠") << 7) | cr(PINE, 0);
    return ly === 12 ? (G("†") << 7) | 1 : NOT_HERE;
  }

  // Ships on the horizon head one way and sailboats nearer in head the other.
  function seaRows() {
    return Math.max(4, Math.round((L.H * 0.2) / ch));
  }

  function shoreMid(wc, ly, t) {
    const sea = seaRows();
    const sc = wc - Math.floor((t * 10) / cw);
    const sl = Math.floor(sc / 70);
    if (hash2(sl, 362) < 0.6) {
      const p = spriteCell(SHIP, sc - sl * 70 - 5 - ((hash2(sl, 363) * 30) | 0), ly - (sea - 1), SHIP_COLOURS);
      if (p !== NOT_HERE) return p;
    }
    const bc = wc + Math.floor((t * 6) / cw);
    const bl = Math.floor(bc / 38);
    if (hash2(bl, 364) < 0.55) {
      // Sailboats keep out past the surf.
      const near = Math.round(sea * 0.4);
      const base = near + ((hash2(bl, 365) * Math.max(1, sea - 4 - near)) | 0);
      return spriteCell(SAILBOAT, bc - bl * 38 - 4 - ((hash2(bl, 366) * 20) | 0), ly - base, SAIL_COLOURS);
    }
    return NOT_HERE;
  }

  // Small houses and orchards stand behind the village.
  function villageMid(wc, ly) {
    const lot = Math.floor(wc / LOT_MID);
    const lx = wc - lot * LOT_MID;
    const h = hash2(lot, 372);
    if (h < 0.45 && lx <= 4) {
      if (ly <= 1) {
        if (lx === 0 || lx === 4) return (G_PIPE << 7) | cr(SLATE, 1);
        return ly === 1 && lx === 2 && env.night > 0.4 ? (G_SMALL << 7) | cr(WINDOW, 1) : -1;
      }
      if (ly === 2) return (G_ROCK_T << 7) | cr(CLAY, 1);
      if (ly === 3 && lx >= 1 && lx <= 3) return (G_ROCK_T << 7) | cr(CLAY, 1);
      return NOT_HERE;
    }
    if (h < 0.8 && ly <= 2) {
      const dx = lx - 4;
      if (ly === 0) return dx === 0 ? (G_PIPE << 7) | cr(ROCK, 1) : NOT_HERE;
      if (Math.abs(dx) <= 3 - ly) return hash2(wc, ly + 380) < 0.2 ? (G_BULLET << 7) | 8 : (G_CLUB << 7) | cr(LEAF, 1);
    }
    return NOT_HERE;
  }

  // ---------------------------------------------------------- transitions ---
  // Where one place meets the next there is a set piece made for that pair,
  // listed in TRANS under the place that ends. The road surface and the ground
  // below the road change along a line fixed to the ground, so the line turns
  // with the perspective as it passes.

  const CLEAR = -4;
  const TR = { from: 0, to: 0, bc: 0, d: 0 };

  // The front-layer column where stretch j - 1 meets stretch j. The bridge
  // starts and ends at a tower, so the points on either side of it snap to
  // whole spans.
  function meetCol(j) {
    const X = (j - BLEND / 2) * BIOME_LEN;
    const from = ORDER[mod(j - 1, NB)], to = ORDER[mod(j, NB)];
    if (from === BRIDGE || to === BRIDGE) return Math.ceil(X / (SPAN * cw) - 0.5) * SPAN;
    return Math.floor(X / cw);
  }

  // The meeting point nearest to front-layer column wc, written into TR, with
  // wc's distance from it in columns.
  function transitionNear(wc) {
    const j = Math.round((wc * cw) / BIOME_LEN + BLEND / 2);
    TR.from = ORDER[mod(j - 1, NB)];
    TR.to = ORDER[mod(j, NB)];
    TR.bc = meetCol(j);
    TR.d = wc - TR.bc;
    return TR;
  }

  // Whether front-layer column wc is inside the space kept for a set piece.
  function inPiece(wc) {
    const tr = transitionNear(wc);
    const clear = TRANS[tr.from].clear;
    return tr.d >= clear[0] && tr.d <= clear[1];
  }

  // Some set pieces are glyph art, given as rows of glyphs from the top and
  // rows of colour keys to match. A "." key leaves the cell to whatever is behind, and
  // a space in the glyph rows is an opaque blank. The key L is a window that is
  // lit at night.
  const ART_KEYS = {
    K: 0, k: 1, m: 3, a: 7,
    w: cr(PAPER, 0), n: cr(INKD, 0),
    r: cr(ROCK, 0), R: cr(ROCK, 1), q: cr(ROCK, 2),
    c: cr(CLAY, 0), C: cr(CLAY, 1),
    s: cr(SLATE, 0), S: cr(SLATE, 1),
    g: cr(LEAF, 0), G: cr(LEAF, 1),
    x: cr(SNOW, 0),
  };

  function makeArt(rows, colours) {
    const h = rows.length;
    let w = 0;
    for (let y = 0; y < h; y++) w = Math.max(w, Array.from(rows[y]).length);
    const glyph = new Int16Array(w * h).fill(-2);
    const key = new Array(w * h).fill("");
    for (let y = 0; y < h; y++) {
      const gr = Array.from(rows[y]);
      for (let x = 0; x < w; x++) {
        const k = colours[y][x] || ".";
        const chr = gr[x] || " ";
        if (k === ".") continue;
        if (chr === " " || k === "_") glyph[y * w + x] = -1;
        else {
          glyph[y * w + x] = GI.has(chr) ? G(chr) : G("#");
          key[y * w + x] = k;
        }
      }
    }
    return { w: w, h: h, glyph: glyph, key: key };
  }

  // The code for cell (lx, ly) of a piece of art whose bottom-left cell is (0, 0).
  function artCell(art, lx, ly) {
    if (lx < 0 || lx >= art.w || ly < 0 || ly >= art.h) return NOT_HERE;
    const i = (art.h - 1 - ly) * art.w + lx;
    const g = art.glyph[i];
    if (g === -2) return NOT_HERE;
    if (g === -1) return -1;
    const k = art.key[i];
    return (g << 7) | (k === "L" ? (env.night > 0.4 ? cr(WINDOW, 0) : cr(SKY, 1)) : ART_KEYS[k]);
  }

  const POST = makeArt(["│", "│", "│"], ["k", "k", "k"]);
  const POST4 = makeArt(["│", "│", "│", "│"], ["k", "k", "k", "k"]);

  // A fuel station with two pumps under a canopy and a kiosk beside it.
  const FUEL = makeArt([
    "  ┃                  ┃              ",
    "  ┃   ▗▄▖      ▗▄▖   ┃   ▄▄▄▄▄▄▄▄▄▄ ",
    "  ┃   ▐▪▌      ▐▪▌   ┃   │ ▪▪  ▪▪ │ ",
    "  ┃   ▐█▌      ▐█▌   ┃   │ ▪▪  ▪▪ │ ",
    "  ┃   ▐█▌      ▐█▌   ┃   │   ▓    │ ",
    "▄▄┴▄▄▄███▄▄▄▄▄▄███▄▄▄┴▄▄ │   ▓    │ ",
  ], [
    "..S..................S..............",
    "..S...aaa......aaa...S...cccccccccc.",
    "..S...aLa......aLa...S...k_LL__LL_k.",
    "..S...aaa......aaa...S...k_LL__LL_k.",
    "..S...aaa......aaa...S...k___r____k.",
    "qqSqqqaaaqqqqqqaaaqqqSqq.k___r____k.",
  ]);

  // The timing booth at the start of the rally stage.
  const BOOTH = makeArt([
    "▄▄▄▄▄▄▄",
    "│▪▪▪▪▪│",
    "│  ▓  │",
    "│  ▓  │",
  ], [
    "ccccccc",
    "kLLLLLk",
    "k__r__k",
    "k__r__k",
  ]);

  // A wayside cross at the edge of the village.
  const CROSS = makeArt([
    "  †  ",
    " ▄█▄ ",
    " ▐▓▌ ",
    "  █  ",
    "  █  ",
    "  █  ",
    " ▄█▄ ",
  ], [
    "..k..",
    ".xxx.",
    ".xcx.",
    "..x..",
    "..x..",
    "..x..",
    ".xxx.",
  ]);

  // A hunting stand on braced legs at the edge of the forest.
  const STAND = makeArt([
    " ▄▄▄▄▄ ",
    "▟█████▙",
    " │▪ ▪│ ",
    " ├───┤ ",
    " │╲ ╱│ ",
    " │ ╳ │ ",
    " │╱ ╲│ ",
    " │╲ ╱│ ",
    " │ ╳ │ ",
    " │╱ ╲│ ",
  ], [
    ".rrrrr.",
    "rrrrrrr",
    ".rK_Kr.",
    ".rrrrr.",
    ".rR.Rr.",
    ".r.R.r.",
    ".rR.Rr.",
    ".rR.Rr.",
    ".r.R.r.",
    ".rR.Rr.",
  ]);

  // The main cable comes down from the tower at each end of the bridge into a
  // concrete anchorage on land.
  function anchorSpan() {
    return Math.max(12, bridgeHeight() - 3);
  }

  function anchorage(lx, ly) {
    if (lx < 0 || lx > 7 || ly > 3) return NOT_HERE;
    if (ly === 3) return lx === 0 || lx === 7 ? NOT_HERE : (G_ROCK_T << 7) | cr(SLATE, 1);
    if (ly === 2 && (lx === 0 || lx === 7)) return ((lx === 0 ? G("▐") : G("▌")) << 7) | cr(SLATE, 1);
    return (G_ROCK_M << 7) | cr(SLATE, 1);
  }

  function anchorIn(d, ly) {
    const A = anchorSpan(), th = bridgeHeight();
    const p = anchorage(d + A + 4, ly);
    if (p !== NOT_HERE || d < -A || d > -1) return p;
    const y0 = 3 + ((th - 3) * (d + A)) / A, y1 = 3 + ((th - 3) * (d + A + 1)) / A;
    return ly >= Math.round(y0) && ly <= Math.round(y1) ? (G_SLASH << 7) | cr(CLAY, 0) : NOT_HERE;
  }

  function anchorOut(d, ly) {
    const A = anchorSpan(), th = bridgeHeight();
    const e = d - (LEGS - 1);
    const p = anchorage(e - A + 3, ly);
    if (p !== NOT_HERE || e < 1 || e > A) return p;
    const y0 = th - ((th - 3) * (e - 1)) / A, y1 = th - ((th - 3) * e) / A;
    return ly >= Math.round(y1) && ly <= Math.round(y0) ? (G_BACK << 7) | cr(CLAY, 0) : NOT_HERE;
  }

  // The rally stage starts and finishes under an arch, with a marshal beside
  // it. At the finish the marshal waves the chequered flag.
  const MARSHAL = { h: cr(SAND, 0), s: cr(WINDOW, 0), p: cr(SLATE, 0), k: 1 };
  function marshal(d, ly, t, x0) {
    return spriteCell(Math.floor(t * 2.5) % 2 === 0 ? PERSON_WAVE : PERSON, d - x0, ly, MARSHAL);
  }

  function stageArch(d, ly) {
    if (d === -8 || d === 10) return ly <= 8 ? (G_DPIPE << 7) | 2 : NOT_HERE;
    return d > -8 && d < 10 && ly >= 6 && ly <= 8 ? -1 : NOT_HERE;
  }

  function stageStart(d, ly, t) {
    const p = stageArch(d, ly);
    return p !== NOT_HERE ? p : marshal(d, ly, t, -13);
  }

  function stageFinish(d, ly, t) {
    const p = stageArch(d, ly);
    if (p !== NOT_HERE) return p;
    if (ly >= 4 && ly <= 5 && d >= -16 && d <= -14) return ((Math.floor(t * 4) & 1 ? G_CHK_A : G_CHK_B) << 7) | 1;
    return marshal(d, ly, t, -13);
  }

  // A big linden tree by the wayside cross.
  function linden(d, ly) {
    if (d === 17 && ly <= 3) return (G_ROCK_M << 7) | cr(ROCK, 0);
    const dx = (d - 17) / 6.5, dy = (ly + 0.5 - 7) / 4;
    const q = dx * dx + dy * dy;
    return q < 1 ? (pick(S.canopy, hash2(d, ly + 930)) << 7) | cr(LEAF, q > 0.6 ? 1 : 0) : NOT_HERE;
  }

  // The road into the mountains runs through a cutting. The far wall of rock
  // has pines on top, and the near side is rocky ground.
  function rockHeight(d) {
    if (d < -10 || d > 24) return -1;
    return Math.round(9 * Math.pow(Math.sin((Math.PI * (d + 10.5)) / 35), 0.7) + (hash2(d, 911) - 0.5) * 2.5);
  }

  function rockCut(d, ly) {
    const h = rockHeight(d);
    if (h < 0 || ly > h + 1) return NOT_HERE;
    if (ly === h + 1) return mod(d, 4) === 1 && hash2(d, 912) < 0.7 ? (G_TRI << 7) | cr(PINE, 0) : NOT_HERE;
    const l = rockHeight(d - 1), r = rockHeight(d + 1);
    if (ly === h) return ((l < h ? G_ROCK_L : r < h ? G_ROCK_R : G_ROCK_T) << 7) | cr(ROCK, 0);
    if (ly > l) return (G("▐") << 7) | cr(ROCK, 0);
    if (ly > r) return (G("▌") << 7) | cr(ROCK, 0);
    return rockTexture(d, ly);
  }

  function rockTexture(d, ly) {
    if (mod(ly + (d >> 3), 3) === 0) return (G_H << 7) | cr(ROCK, 1);
    return hash2(d, ly + 913) < 0.55 ? (G_SHINGLE << 7) | cr(ROCK, 2) : -1;
  }

  // Red and white snow poles along the road up to the snow line.
  function snowPoles(d, ly) {
    if (ly > 3 || d < -36 || d > 36 || mod(d, 6) !== 0) return NOT_HERE;
    return (G("▌") << 7) | (ly & 1 ? cr(PAPER, 0) : 7);
  }

  // A harbour crane with a container on its hook, and more containers on the
  // quay, where the road comes down to the city.
  function crane(d, ly) {
    const Y = cr(WINDOW, 0);
    if (ly === 16 && d >= -26 && d <= 3) return ((d === -12 ? G("╬") : G_HH) << 7) | Y;
    if (ly === 17 && d === -12) return (G_TRI << 7) | Y;
    if (ly === 15 && d >= -26 && d <= -23) return (G_ROCK_M << 7) | cr(SLATE, 1);
    if (ly >= 1 && ly <= 15 && d >= -13 && d <= -11) return ((d === -12 ? G("╳") : G_PIPE) << 7) | Y;
    if (ly === 14 && d === -15) return (G_ROCK_M << 7) | Y;
    if (ly === 14 && d === -14) return (G_SMALL << 7) | (env.night > 0.4 ? cr(WINDOW, 0) : cr(SKY, 1));
    if (ly === 0 && d >= -14 && d <= -10) return (G_ROCK_M << 7) | cr(SLATE, 0);
    if (d === 0 && ly >= 10 && ly <= 15) return (G_PIPE << 7) | 3;
    if (d === 0 && ly === 9) return (G("┘") << 7) | 3;
    if (ly === 8 && d >= -3 && d <= 3) return (G_ROCK_M << 7) | 7;
    if (ly <= 1 && d >= -9 && d <= -4) return (G_ROCK_M << 7) | (ly === 0 ? cr(WATER, 0) : 7);
    if (ly === 0 && d >= -3 && d <= 1) return (G_ROCK_M << 7) | cr(LEAF, 1);
    return NOT_HERE;
  }

  // What happens where each place ends. clear is the stretch around the
  // meeting point, in columns, that other roadside objects keep out of. The
  // road either changes at an expansion joint, at a chequered line, or over a
  // few columns with a ragged edge. Below the road, land meets water at a
  // rocky bank and other ground mixes along a slanted line.
  const SIGN_WHITE = "#f2f1ed", SIGN_BLUE = "#1f4e9c", SIGN_BLACK = "#17181b";
  const TRANS = [];
  // The sign at the end of the town, and then the start of the motorway.
  TRANS[CITY] = {
    clear: [-16, 14],
    arts: [[-9, POST], [9, POST]],
    panels: [
      { x: -15, y: 3, w: 13, h: 3, text: "LIBEREC", bg: SIGN_WHITE, fg: cr(INKD, 0), strike: true },
      { x: 6, y: 3, w: 7, h: 3, text: "D10", bg: SIGN_BLUE },
    ],
    below: { shore: true, off: -2, slope: 0.9 },
  };
  // Onto the bridge past its first anchorage.
  TRANS[HIGHWAY] = { clear: [-44, -1], near: anchorIn, road: "joint", below: { shore: true, off: -8, slope: -0.7 } };
  // Off the bridge past the second anchorage, onto the coast.
  TRANS[BRIDGE] = { clear: [LEGS, LEGS + 44], near: anchorOut, road: "joint", below: { shore: true, off: LEGS + 3, slope: 0.8 } };
  // The last fuel station before the desert.
  TRANS[SHORE] = {
    clear: [-4, 40],
    arts: [[2, FUEL]],
    panels: [{ x: 2, y: 6, w: 24, h: 2, text: "FUEL · CAFÉ", bg: "accent" }],
    below: { off: 0, slope: 0.6, w: 6 },
  };
  // The start of the rally stage.
  TRANS[DESERT] = {
    clear: [-15, 22],
    near: stageStart,
    arts: [[13, BOOTH]],
    panels: [{ x: -7, y: 6, w: 17, h: 3, text: "★ RALLY START ★", bg: "accent" }],
    road: "chequer",
    below: { off: 0, slope: 0.5, w: 5 },
  };
  // The finish, and the stop board after it.
  TRANS[RALLY] = {
    clear: [-16, 26],
    near: stageFinish,
    arts: [[20, POST]],
    panels: [
      { x: -7, y: 6, w: 17, h: 3, text: "▚▞ FINISH ▚▞", bg: SIGN_BLACK },
      { x: 18, y: 3, w: 6, h: 3, text: "STOP", bg: "accent" },
    ],
    road: "chequer",
    below: { off: 0, slope: 0.5, w: 5 },
  };
  // Into the village past its name sign, a wayside cross and a linden tree.
  TRANS[COUNTRY] = {
    clear: [-15, 26],
    near: linden,
    arts: [[-9, POST], [3, CROSS]],
    panels: [{ x: -15, y: 3, w: 12, h: 3, text: "LUČANY", bg: SIGN_WHITE, fg: cr(INKD, 0) }],
    below: { off: -4, slope: 0.5, w: 6 },
  };
  // Out of the village and past a hunting stand into the forest.
  TRANS[VILLAGE] = {
    clear: [-15, 13],
    arts: [[-9, POST], [4, STAND]],
    panels: [{ x: -15, y: 3, w: 12, h: 3, text: "LUČANY", bg: SIGN_WHITE, fg: cr(INKD, 0), strike: true }],
    below: { off: 0, slope: 0.5, w: 6 },
  };
  // Through a rock cutting into the mountains.
  TRANS[FOREST] = { clear: [-12, 26], near: rockCut, below: { shore: true, off: 26, slope: 0.9, cut: true } };
  // Up to the snow line, where the lake freezes over.
  TRANS[MOUNTAINS] = {
    clear: [2, 19],
    near: snowPoles,
    arts: [[10, POST4]],
    panels: [{ x: 4, y: 4, w: 14, h: 3, text: "ZIMNÍ VÝBAVA", bg: SIGN_BLUE }],
    below: { off: 0, slope: 0.3, w: 14 },
  };
  // Down to the harbour and back into the city, where the ice breaks up.
  TRANS[WINTER] = {
    clear: [-28, 19],
    near: crane,
    arts: [[13, POST]],
    panels: [{ x: 7, y: 3, w: 13, h: 3, text: "LIBEREC", bg: SIGN_WHITE, fg: cr(INKD, 0) }],
    below: { off: 0, slope: 0.3, w: 10 },
  };

  // The set piece at front-layer column wc, CLEAR where other objects keep
  // out, or NOT_HERE.
  function transitionPiece(wc, ly, t) {
    const tr = transitionNear(wc);
    if (tr.d < -48 || tr.d > 48) return NOT_HERE;
    const d = tr.d;
    const spec = TRANS[tr.from];
    if (spec.near) {
      const p = spec.near(d, ly, t);
      if (p !== NOT_HERE) return p;
    }
    if (spec.arts) {
      for (let i = 0; i < spec.arts.length; i++) {
        const p = artCell(spec.arts[i][1], d - spec.arts[i][0], ly);
        if (p !== NOT_HERE) return p;
      }
    }
    return d >= spec.clear[0] && d <= spec.clear[1] ? CLEAR : NOT_HERE;
  }

  // The front-layer column that a ground row moving at v px/s shows at x.
  // Rows nearer the viewer move faster, so a line on the ground turns about
  // the middle of the screen as it passes.
  function groundCol(x, t, v) {
    const mid = vw * 0.5;
    return Math.floor((mid + (x - mid) * (SPEED_NEAR / v) + t * SPEED_NEAR) / cw);
  }

  function isWater(p) {
    return p === CITY || p === BRIDGE || p === MOUNTAINS;
  }

  // ------------------------------------------------------------ road, water ---

  // The road. The texture of each row passes a little faster than the row
  // behind it. Where one place meets the next the surface changes straight
  // across the road, at an expansion joint, at a chequered line, or over a few
  // columns with a ragged edge.
  const ROAD_SPEED = [SPEED_NEAR, 42, 48, SPEED_ROAD];
  function roadCell(c, x, sy, t) {
    const ri = Math.floor((sy - L.roadTop) / ch);
    const v = ROAD_SPEED[ri];
    const wg = Math.floor((x + t * SPEED_NEAR) / cw);
    let place = placeAt(wg);
    const tr = transitionNear(wg);
    if (tr.d > -12 && tr.d < 12) {
      const kind = TRANS[tr.from].road;
      const side = ri === 0 || ri === 3;
      if (kind === "joint") {
        const at = tr.from === BRIDGE ? LEGS : 0;
        if (tr.d === at) return ((side ? G("╪") : G_HPIPE) << 7) | (side ? 2 : 4);
        place = tr.d < at ? tr.from : tr.to;
      } else if (kind === "chequer" && (tr.d === 0 || tr.d === 1)) {
        return (((tr.d + ri) & 1 ? G_CHK_A : G_CHK_B) << 7) | 1;
      } else {
        place = hash2(wg, ri + 610) < smooth(-5, 5, tr.d) ? tr.to : tr.from;
      }
    }
    return roadSurface(place, ri, Math.floor((x + t * v) / cw));
  }

  function roadSurface(place, ri, wc) {
    const side = ri === 0 || ri === 3;
    const hv = hash2(wc, 88 + ri);
    switch (place) {
      case RALLY:
        // Gravel with two ruts worn into it and grass along the edge.
        if (ri === 0) return hv < 0.35 ? (pick(S.base, hv * 2.8) << 7) | cr(ROCK, 1) : -1;
        if (ri === 3) return hv < 0.45 ? (pick(S.fern, hv * 2.2) << 7) | cr(GRASS, 1) : hv < 0.6 ? (G_DOT << 7) | cr(ROCK, 1) : -1;
        if (mod(wc + ri * 5, 13) < 9) return (G_H << 7) | cr(ROCK, 2);
        return hv < 0.25 ? (G_DOT << 7) | cr(SAND, 1) : -1;
      case WINTER:
        // Packed snow with a bank on either side.
        if (side) return ((hv < 0.55 ? G_SNOWFIELD : G_DOT) << 7) | cr(SNOW, 2);
        if (ri === 1) return hv < 0.06 ? (G_DOT << 7) | cr(SNOW, 1) : -1;
        return mod(wc, 7) < 3 ? (G_DASH << 7) | cr(WHEAT, 1) : -1;
      case HIGHWAY:
        // Two lanes and a crash barrier.
        if (ri === 1) return -1;
        if (ri === 2) return mod(wc, 8) < 4 ? (G_HEAVY << 7) | 2 : -1;
        if (ri === 3) return ((mod(wc, 6) === 0 ? G_POST : G_HH) << 7) | cr(SLATE, 0);
        break;
    }
    if (ri === 0) return ((hash2(wc >> 2, 91) < 0.85 ? G_H : G_HH) << 7) | (place === DESERT ? 3 : 1);
    if (ri === 1) return hv < 0.04 ? (G_DOT << 7) | 5 : -1;
    if (ri === 2) return mod(wc, 7) < 3 ? (G_DASH << 7) | cr(WHEAT, 0) : -1;
    switch (place) {
      case CITY: return ((mod(wc, 5) === 0 ? G_POST : G_HH) << 7) | 1;
      case SHORE: return ((mod(wc, 5) === 0 ? G_POST : G_H) << 7) | 2;
      case BRIDGE: return (((wc & 1) ? G_SLASH : G_BACK) << 7) | cr(CLAY, 1);
      case MOUNTAINS: return ((mod(wc, 4) === 0 ? G_DTEE : G_HH) << 7) | 2;
      case VILLAGE: return (G_OPEN << 7) | cr(ROCK, mod(wc, 3) === 0 ? 1 : 2);
      case DESERT: return hv < 0.3 ? (pick(S.base, hv * 3) << 7) | cr(SAND, 1) : -1;
      default: return hv < 0.6 ? (pick(S.fern, hv) << 7) | cr(LEAF, 1) : -1;
    }
  }

  // The sea in front of the road mirrors the skyline or the bridge. The
  // waves push the reflection sideways and break it up more the further down
  // it is, with swell in between. The bridge piers stand in the water under the
  // towers, and their reflections shimmer below them.
  function seaCell(c, sr, x, sy, t, wi, fade) {
    if (wi === 0) return ((hash2(Math.floor((x + t * 6) / cw) >> 2, 5) < 0.8 ? G_H : G_DASH) << 7) | cr(WATER, 0);
    const wn = Math.floor((x + t * SPEED_NEAR) / cw);
    if (wi <= 9 && mod(wn, SPAN) < LEGS) {
      const k = Math.floor(wn / SPAN);
      if (spanIsBridge(k) || spanIsBridge(k - 1)) {
        if (wi <= 5) return (G_DARK << 7) | cr(CLAY, 1);
        const hv = hash3(c, sr, Math.floor(t * 3));
        if (hv < (10 - wi) * 0.16) return (pick(S.reflect, hv) << 7) | cr(CLAY, 2);
      }
    }
    const wob = Math.sin(t * 1.3 + wi * 0.9) * cw * (0.8 + wi * 0.15);
    const rb = nearBiomeAt(x + wob, t);
    if (rb === CITY || rb === BRIDGE) {
      const b = nearCell(x + wob, 2 * L.waterTop - sy, t, rb);
      if (b !== NOT_HERE) {
        const hv = hash3(c, sr, Math.floor(t * 3));
        if (hv > (0.75 - wi * 0.025) * fade) return -1;
        const row = b >= 0 ? b & 127 : -1;
        if (row >= 7 && row <= 9) return (G_H << 7) | 8;
        if (row === cr(WINDOW, 0)) return (G_H << 7) | cr(WINDOW, 1);
        if (row === cr(CLAY, 0)) return (pick(S.reflect, hv) << 7) | cr(CLAY, 2);
        return (pick(S.reflect, hv) << 7) | cr(WATER, b >= 0 ? 1 : 2);
      }
    }
    return swell(x, t, wi, fade);
  }

  function swell(x, t, wi, fade) {
    const wc = Math.floor((x + t * (5 + wi * 2) + Math.sin(t * 0.9 + wi * 0.7) * cw) / cw);
    const segLen = 2 + ((hash2(wi, 71) * 6) | 0);
    const hs = hash2(Math.floor(wc / segLen), wi + 131);
    const dens = Math.min(0.45, 0.1 + wi * 0.035) * fade;
    if (hs < dens) return (S.water[((hs / dens) * S.water.length) | 0] << 7) | cr(WATER, wi < 4 ? 2 : 1);
    return -1;
  }

  // A mountain lake that mirrors the peaks behind it.
  function lakeCell(c, sr, x, sy, t, wi, fade) {
    if (wi === 0) return (G_H << 7) | cr(WATER, 0);
    const wob = Math.round((Math.sin(t * 1.1 + wi * 0.8) * (0.6 + wi * 0.1)));
    const cc = Math.min(cols - 1, Math.max(0, c + wob));
    if (HB[cc] === MOUNTAINS && 2 * L.waterTop - sy >= HF[cc]) {
      const hv = hash3(c, sr, Math.floor(t * 3));
      if (hv > (0.8 - wi * 0.03) * fade) return -1;
      return (pick(S.reflect, hv) << 7) | cr(ROCK, 2);
    }
    return swell(x, t, wi, fade * 0.7);
  }

  // Crop rows in front of the road. Nearer rows pass faster.
  function fieldCell(x, t, wi, fade) {
    const wc = Math.floor((x + t * SPEED_ROAD * (0.6 + wi * 0.08)) / cw);
    const hv = hash2(wc, wi + 211);
    if (wi % 2 === 0) {
      if (hv < 0.004) return (G("*") << 7) | 7;
      if (hv < 0.009) return (G("*") << 7) | cr(DUSK, 0);
      return hv < 0.65 * fade ? (pick(S.crop, hash2(wi, wc)) << 7) | cr(wi & 2 ? WHEAT : GRASS, wi < 4 ? 1 : 0) : -1;
    }
    return hv < 0.25 * fade ? (G_US << 7) | cr(ROCK, 2) : -1;
  }

  // Sand with ripples, and heat shimmer on the rows next to the road.
  function sandCell(x, t, wi, fade) {
    const shimmer = wi < 3 ? Math.sin(t * 7 + wi * 2 + x * 0.05) * cw : 0;
    const wc = Math.floor((x + t * SPEED_ROAD * (0.5 + wi * 0.07) + shimmer) / cw);
    const hv = hash2(Math.floor(wc / 3), wi + 221);
    if (hv < 0.3 * fade) return (G_TILDE << 7) | cr(SAND, wi < 4 ? 1 : 0);
    return hash2(wc, wi + 222) < 0.03 * fade ? (G_DOT << 7) | cr(ROCK, 1) : -1;
  }

  // Ferns and undergrowth under the trees, thinning out further down.
  function undergrowthCell(x, t, wi, fade) {
    const wc = Math.floor((x + t * SPEED_ROAD * (0.6 + wi * 0.06)) / cw);
    const hv = hash2(wc, wi + 231);
    if (hv < 0.006 * fade) return (G("*") << 7) | cr(WINDOW, 0);
    if (hv < (0.55 - wi * 0.035) * fade) return (pick(S.fern, hash2(wi, wc)) << 7) | cr(wc & 1 ? LEAF : PINE, wi < 3 ? 0 : 1);
    return -1;
  }

  // Grass on the highway embankment, with a ditch of water along it.
  function vergeCell(x, t, wi, fade) {
    const wc = Math.floor((x + t * SPEED_ROAD * (0.6 + wi * 0.07)) / cw);
    const hv = hash2(wc, wi + 241);
    if (wi === 2) return hv < 0.5 * fade ? (G_TILDE << 7) | cr(WATER, 2) : -1;
    return hv < (0.4 - wi * 0.03) * fade ? (pick(S.crop, hash2(wi, wc)) << 7) | cr(GRASS, wi < 4 ? 1 : 2) : -1;
  }

  // Dunes with tufts of grass below the shore road.
  function duneCell(x, t, wi, fade) {
    const wc = Math.floor((x + t * SPEED_ROAD * (0.55 + wi * 0.07)) / cw);
    const hv = hash2(wc, wi + 251);
    if (hv < 0.12 * fade) return (pick(S.fern, hash2(wc, wi)) << 7) | cr(GRASS, 1);
    return sandCell(x, t, wi, fade);
  }

  // Cottage gardens with rows of flowers lie behind a picket fence.
  function gardenCell(x, t, wi, fade) {
    const wc = Math.floor((x + t * SPEED_ROAD * (0.6 + wi * 0.07)) / cw);
    if (wi === 0) return ((mod(wc, 3) === 0 ? G_CROSS : G_H) << 7) | 3;
    const hv = hash2(wc, wi + 261);
    if (wi % 2 === 1) {
      if (hv < 0.5 * fade) return (G_STAR << 7) | FLOWERS[(hash2(wc, wi + 262) * FLOWERS.length) | 0];
      return hv < 0.7 * fade ? (G(",") << 7) | cr(LEAF, 1) : -1;
    }
    return hv < 0.35 * fade ? (pick(S.fern, hv * 2) << 7) | cr(LEAF, 0) : -1;
  }

  // A frozen lake has a few cracks in the ice and snow blown across it.
  function iceCell(x, t, wi, fade) {
    if (wi === 0) return ((hash2(Math.floor((x + t * SPEED_ROAD) / cw), 270) < 0.55 ? G_SNOWFIELD : G_DOT) << 7) | cr(SNOW, 2);
    const wc = Math.floor((x + t * SPEED_ROAD * (0.55 + wi * 0.07)) / cw);
    const hv = hash2(wc, wi + 271);
    if (hv < 0.02 * fade) return ((hv < 0.01 ? G_SLASH : G_BACK) << 7) | cr(SNOW, 0);
    if (hash2(Math.floor(wc / 4), wi + 272) < 0.35 * fade) return (G_H << 7) | cr(SNOW, wi < 4 ? 1 : 2);
    return hv < 0.08 * fade ? (G_DOT << 7) | cr(SNOW, 1) : -1;
  }

  // Each row below the road passes faster than the one above it.
  function belowSpeed(wi) {
    return SPEED_ROAD * (1 + wi * 0.07);
  }

  // The place a cell below the road shows. Near a meeting point the ground
  // changes along a slanted line fixed to the ground. Where land meets water
  // the line is a rocky bank with surf on the water side and pebbles on the
  // land side. The bank codes are BANK_L and BANK_R for its end on the water
  // side, BANK for the rest of it, and SURF and PEBBLE.
  const BANK = -10, BANK_L = -11, BANK_R = -12, SURF = -13, PEBBLE = -14, ROCKY = -15;
  function bankEdge(b, wi, bc) {
    return b.off + Math.round(b.slope * wi + (hash2(wi, bc) - 0.5) * 2);
  }

  function belowPlace(x, wi, t) {
    const wg = groundCol(x, t, belowSpeed(wi));
    const tr = transitionNear(wg);
    if (tr.d <= -40 || tr.d >= 40) return placeAt(wg);
    const b = TRANS[tr.from].below;
    if (b.cut && rockHeight(tr.d) > 0 && wi <= rockHeight(tr.d) >> 1) return ROCKY;
    const e0 = bankEdge(b, wi, tr.bc);
    if (!b.shore) return hash2(wg, wi + 620) < smooth(-b.w, b.w, tr.d - e0) ? tr.to : tr.from;
    // The bank reaches over to where the next row's edge falls, in this row's
    // columns, so it has no gaps.
    const mid = vw * 0.5;
    const xg = (tr.bc + bankEdge(b, wi + 1, tr.bc)) * cw - t * SPEED_NEAR;
    const xs = mid + ((xg - mid) * belowSpeed(wi + 1)) / SPEED_NEAR;
    const e1 = Math.round((mid + ((xs - mid) * SPEED_NEAR) / belowSpeed(wi) + t * SPEED_NEAR) / cw) - tr.bc;
    const lo = Math.min(e0, e1), hi = Math.max(e0, e1);
    const wetLeft = isWater(tr.from);
    const d = tr.d;
    if (d >= lo && d <= hi) {
      if (d === (wetLeft ? lo : hi)) return wetLeft ? BANK_L : BANK_R;
      return BANK;
    }
    const place = d < lo ? tr.from : tr.to;
    if (d === (wetLeft ? lo - 1 : hi + 1)) return hash2(wg, wi + 630) < 0.7 ? SURF : place;
    if (d === (wetLeft ? hi + 1 : lo - 1)) return hash2(wg, wi + 631) < 0.5 ? PEBBLE : place;
    return place;
  }

  function belowCell(c, sr, x, sy, t) {
    const wi = Math.floor((sy - L.waterTop) / ch);
    const fade = 1 - smooth(L.waterTop + ch * 5, L.groundEnd, sy);
    const place = belowPlace(x, wi, t);
    switch (place) {
      case BANK_L: return (G_ROCK_L << 7) | cr(ROCK, 1);
      case BANK_R: return (G_ROCK_R << 7) | cr(ROCK, 1);
      case BANK: return (G_ROCK_T << 7) | cr(ROCK, 1);
      case ROCKY: return rockTexture(Math.floor(x / cw), wi);
      case SURF: return ((hash2(Math.floor(t * 3), wi + Math.floor(x / cw)) < 0.5 ? G_TILDE : G_DASH) << 7) | cr(SNOW, 0);
      case PEBBLE: return (pick(S.base, hash2(Math.floor(x / cw), wi)) << 7) | cr(ROCK, 2);
      case CITY:
      case BRIDGE: return seaCell(c, sr, x, sy, t, wi, fade);
      case HIGHWAY: return vergeCell(x, t, wi, fade);
      case SHORE: return duneCell(x, t, wi, fade);
      case MOUNTAINS: return lakeCell(c, sr, x, sy, t, wi, fade);
      case COUNTRY:
      case RALLY: return fieldCell(x, t, wi, fade);
      case VILLAGE: return gardenCell(x, t, wi, fade);
      case WINTER: return iceCell(x, t, wi, fade);
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
              if (Math.abs(c - center) <= half) return G_HEAVY << 7;
            } else if (c === center) return (G_BULLET << 7) | 1;
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
          curve = (g << 7) | lvl;
        }
      }
    }
    if (curve >= 0) return curve;
    if (c % GRID === 0) return (G_GRID << 7) | 6;
    if (hash3(c, r, Math.floor(t * 0.35 + hash2(c, r + 7000) * 8)) < 0.002) return (pick(S.energy, hash2(r, c)) << 7) | 5;
    return -1;
  }

  // A numbered ruler hanging under the top bar. Its ticks line up with the
  // grid's dotted columns.
  function drawRuler() {
    const yD = Math.round(barBottom * dpr);
    const r = Math.min(rows - 1, Math.max(0, Math.floor((barBottom + ch / 2 + frac) / ch)));
    ctx.fillStyle = rowFill[r] || colors.bg;
    ctx.fillRect(0, yD, canvas.width, chD);
    const row = rowInv[r] ? 13 : 3;
    for (let c = 0; c < cols; c++) {
      const m = c % GRID;
      let g = -1;
      if (m === 0) g = G_TICK;
      else if (m === 1 || m === 2) g = GI.get(String(Math.floor(c / GRID) + 1).padStart(2, "0")[m - 1]);
      if (g >= 0) ctx.drawImage(atlas, g * cwD, row * chD, cwD, chD, c * cwD, yD, cwD, chD);
    }
  }

  function waterCell(x, dy, t) {
    const ri = Math.floor(dy / ch);
    if (ri === 0) {
      const wc = Math.floor((x + t * 6) / cw);
      return ((hash2(wc >> 2, 3) < 0.85 ? G_H : G_HH) << 7) | 1;
    }
    const sway = Math.sin(t * 0.9 + ri * 0.7) * cw * 1.2;
    const wc = Math.floor((x + t * (4 + ri * 2.5) + sway) / cw);
    const segLen = 2 + ((hash2(ri, 71) * 8) | 0);
    const hs = hash2(Math.floor(wc / segLen), ri + 131);
    const dens = Math.min(0.7, 0.16 + ri * 0.05);
    if (hs < dens) {
      if (hash2(wc, ri + 7) < 0.03) return (G_SQ << 7) | 1;
      return (S.water[((hs / dens) * S.water.length) | 0] << 7) | (ri < 3 ? 3 : ri < 7 ? 2 : 1);
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
    let row = code & 127;
    if (row >= COLOUR_BASE) {
      if (rowAlt[r]) row += COLOUR_ROWS;
    } else if (rowInv[r] && row < 7) row += 10;
    ctx.drawImage(atlas, (code >> 7) * cwD, row * chD, cwD, chD, c * cwD, yD, cwD, chD);
  }

  // A cell on a coloured panel, such as a road sign. The glyph always uses the
  // bright version of its colour, and a code of -1 paints the panel only.
  function putCellBg(c, r, code, bg) {
    if (c < 0 || c >= cols || r < 0 || r >= rows) return;
    if (mask[r * cols + c]) return;
    prevCode[r * cols + c] = -9;
    const yD = r * chD - fracD;
    ctx.fillStyle = bg;
    ctx.fillRect(c * cwD, yD, cwD, chD);
    if (code < 0) return;
    let row = code & 127;
    if (row >= COLOUR_BASE) row += COLOUR_ROWS;
    ctx.drawImage(atlas, (code >> 7) * cwD, row * chD, cwD, chD, c * cwD, yD, cwD, chD);
  }

  function screenRow(sceneY, heroOff) {
    return Math.floor((sceneY - heroOff + frac) / ch);
  }

  // Boats sail across the water in front of the city and the bridge, nearer
  // than the bridge piers, and only where there is water under the whole hull.
  const BOAT = [" |\\", " |_\\", "\\___/"];
  function drawBoats(t, heroOff) {
    const gap = 560, speed = 20;
    const k0 = Math.floor((t * speed - 300) / gap), k1 = Math.ceil((t * speed + vw + 60) / gap);
    for (let k = k0; k <= k1; k++) {
      if (hash2(k, 151) > 0.65) continue;
      const x = k * gap + hash2(k, 152) * 240 - t * speed;
      const col = Math.floor(x / cw);
      if (col < -6 || col > cols) continue;
      const wi = 7 + ((hash2(k, 153) * 3) | 0);
      let wet = true;
      for (let i = -1; i <= 6 && wet; i += 7) wet = isWater(belowPlace((col + i + 0.5) * cw, wi, t));
      if (!wet) continue;
      const r0 = screenRow(L.waterTop + ch * (wi + 0.5), heroOff);
      for (let j = 0; j < BOAT.length; j++) {
        for (let i = 0; i < BOAT[j].length; i++) {
          if (BOAT[j][i] !== " ") putCell(col + i, r0 - 2 + j, (G(BOAT[j][i]) << 7) | (j === 2 ? cr(CLAY, 0) : 1));
        }
      }
      if (env.night > 0.4) putCell(col + 1, r0 - 3, (G_DOT << 7) | cr(WINDOW, 0));
    }
  }

  function drawTumbleweed(t, heroOff) {
    const k = Math.floor(t / 12), tau = t - k * 12;
    if (hash2(k, 201) > 0.7) return;
    const c = Math.floor((vw + 30 - tau * 110) / cw);
    if (c < 0 || c >= cols || BB[c] !== DESERT) return;
    const bounce = Math.abs(Math.sin(tau * 5)) * ch * 1.2;
    putCell(c, screenRow(L.roadTop - ch * 0.5 - bounce, heroOff), ((Math.floor(tau * 8) & 1 ? G_AT : G_AMP) << 7) | cr(ROCK, 0));
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
      putCell(Math.floor(x / cw), screenRow(y, heroOff), ((flap ? G_V : G_DASH) << 7) | 1);
    }
  }

  function drawPlane(t, heroOff) {
    const k = Math.floor(t / 38), tau = t - k * 38;
    if (tau > 16 || hash2(k, 171) > 0.65) return;
    const c0 = Math.floor((vw + 60 - (tau / 16) * (vw + 160)) / cw);
    const r0 = screenRow(L.H * (0.06 + 0.1 * hash2(k, 172)), heroOff);
    if (env.night > 0.5) {
      // Navigation lights: red on one wing, green on the other.
      const on = Math.floor(t * 2) & 1;
      putCell(c0, r0, ((on ? G_BULLET : G_DOT) << 7) | 7);
      putCell(c0 + 3, r0, ((on ? G_DOT : G_BULLET) << 7) | cr(LEAF, 0));
      return;
    }
    for (let i = 0; i < PLANE.length; i++) putCell(c0 + i, r0, (PLANE[i] << 7) | 1);
    for (let i = 0; i < 14; i++) {
      if ((i + Math.floor(t * 6)) % 3 !== 0) putCell(c0 + PLANE.length + i, r0, (G_DASH << 7) | (i < 5 ? 3 : i < 10 ? 4 : 5));
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
      putCell(Math.floor(px / cw), screenRow(py, heroOff), ((i === 0 ? G_PLUS : G_DASH) << 7) | cr(NIGHT, Math.min(2, i >> 2)));
    }
  }

  // Rain in the forest and snow in the mountains and the winter valley, as
  // heavy as the share of the screen that place takes up.
  function drawWeather(t, heroOff) {
    let rain = 0, snow = 0, n = 0;
    for (let c = 0; c < cols; c += 8, n++) {
      if (BB[c] === FOREST) rain++;
      if (BB[c] === MOUNTAINS) snow++;
      if (BB[c] === WINTER) snow += 1.6;
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
        putCell(c, r, (G_SLASH << 7) | cr(WATER, 1));
        putCell(c + 1, r - 1, (G_SLASH << 7) | cr(WATER, 2));
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
          putCell(Math.floor(x / cw), Math.floor((y + frac) / ch), ((hs < 0.1 * snow ? G_STAR : G_DOT) << 7) | cr(SNOW, 0));
        }
      }
    }
  }

  // The screen column of world column `w` in a layer that has moved `shift`
  // columns, and the screen row of row `ly` above the road.
  function layerShift(t, speed) {
    return Math.floor((t * speed) / cw + 0.5);
  }

  function rowAbove(ly, heroOff) {
    return screenRow(L.roadTop - (ly + 0.5) * ch, heroOff);
  }

  // At night the lighthouse lamp turns, and its beam sweeps across the sea.
  function drawLighthouse(t, heroOff) {
    if (env.night < 0.4) return;
    const shift = layerShift(t, SPEED_MID);
    const r = rowAbove(11, heroOff);
    for (let k = Math.floor((shift - 40) / 110); k <= Math.floor((shift + cols + 40) / 110); k++) {
      const w = k * 110 + 51;
      if (hash2(k, 361) >= 0.45 || midPlace(w, t) !== SHORE) continue;
      const c = w - shift;
      const a = t * 1.4 + k;
      const reach = Math.round(34 * Math.abs(Math.cos(a)));
      const dir = Math.cos(a) > 0 ? 1 : -1;
      if (reach < 6) putCell(c, r, (G_SPARK << 7) | cr(WINDOW, 0));
      for (let i = 2; i <= reach; i++) {
        const fall = 1 - i / 34;
        putCell(c + dir * i, r, ((fall > 0.6 ? G_HH : G_H) << 7) | cr(WINDOW, fall > 0.6 ? 0 : fall > 0.3 ? 1 : 2));
      }
    }
  }

  // Smoke rising from the chimneys of cabins and village houses.
  function drawSmoke(t, heroOff) {
    const shift = layerShift(t, SPEED_NEAR);
    for (let lot = Math.floor((shift - 16) / CABIN_LOT); lot <= Math.floor((shift + cols) / CABIN_LOT); lot++) {
      const x0 = cabinX(lot);
      if (x0 !== null) puffs(x0 + 11 - shift, 8, lot, t, heroOff);
    }
    for (let lot = Math.floor((shift - 12) / LOT_NEAR); lot <= Math.floor((shift + cols) / LOT_NEAR); lot++) {
      if (hash2(lot, 341) >= 0.55) continue;
      const c = lot * LOT_NEAR + 10 - shift;
      if (c >= 0 && c < cols && NBI[c] === VILLAGE && !inPiece(lot * LOT_NEAR + 10)) puffs(c, 8, lot + 500, t, heroOff);
    }
  }

  function puffs(c, ly, seed, t, heroOff) {
    for (let i = 0; i < 5; i++) {
      const age = mod(t * 0.35 + i / 5 + hash2(seed, 405), 1);
      const x = (c + 0.5) * cw - age * cw * 4 + Math.sin(t * 1.5 + i * 2 + seed) * cw * 0.6;
      const y = L.roadTop - (ly + 0.5) * ch - age * ch * 5;
      const g = age < 0.3 ? G_O : age < 0.65 ? G("°") : G_DOT;
      putCell(Math.floor(x / cw), screenRow(y, heroOff), (g << 7) | (age < 0.3 ? 3 : age < 0.65 ? 4 : 5));
    }
  }

  // Draws a sprite with its bottom-left cell at column c0 and row rBase.
  function stamp(sp, c0, rBase, colours) {
    for (let ly = 0; ly < sp.h; ly++) {
      for (let lx = 0; lx < sp.w; lx++) {
        const code = spriteCell(sp, lx, ly, colours);
        if (code >= 0) putCell(c0 + lx, rBase - ly, code);
      }
    }
  }

  // By day, deer graze in the forest and the snow, rabbits hop about and now
  // and then a fox trots past. At night owls watch from the trees and
  // fireflies drift between them.
  const ANIMAL_LOT = 40;
  function drawAnimals(t, heroOff) {
    const shift = layerShift(t, SPEED_NEAR);
    const rBase = rowAbove(0, heroOff);
    const day = env.day > 0.3;
    for (let lot = Math.floor((shift - 12) / ANIMAL_LOT); lot <= Math.floor((shift + cols) / ANIMAL_LOT); lot++) {
      const h = hash2(lot, 401);
      const w = lot * ANIMAL_LOT + 4 + ((hash2(lot, 402) * 24) | 0);
      const c = w - shift;
      if (c < -12 || c >= cols) continue;
      const place = placeAt(w + 3);
      if ((place !== FOREST && place !== WINTER) || inPiece(w) || inPiece(w + 6)) continue;
      if (day && h < 0.4) {
        const up = Math.floor(t / 2.5 + hash2(lot, 403) * 3) % 3 === 0;
        stamp(up ? DEER : DEER_GRAZE, c, rBase, DEER_COLOURS);
      } else if (day && h < 0.65 && place === FOREST) {
        // Four hops to the left, a rest, four hops back and another rest.
        const q = mod(t + hash2(lot, 404) * 8, 8);
        let dx = 0, lift = 0;
        if (q < 2) {
          dx = -Math.floor(q / 0.5) * 2;
          lift = q % 0.5 < 0.3 ? 1 : 0;
        } else if (q < 4) dx = -8;
        else if (q < 6) {
          dx = -8 + Math.floor((q - 4) / 0.5) * 2;
          lift = (q - 4) % 0.5 < 0.3 ? 1 : 0;
        }
        stamp(q < 4 ? RABBIT : RABBIT_BACK, c + 8 + dx, rBase - lift, RABBIT_COLOURS);
      } else if (!day && h < 0.5 && place === FOREST) {
        if (hash3(lot, 406, Math.floor(t * 1.5)) > 0.15) {
          const r = rBase - 5 - ((hash2(lot, 407) * 5) | 0);
          putCell(c, r, (G_BULLET << 7) | cr(WINDOW, 0));
          putCell(c + 1, r, (G_BULLET << 7) | cr(WINDOW, 0));
        }
      }
    }
    if (day) {
      const k = Math.floor(t / 20), tau = t - k * 20;
      if (hash2(k, 408) < 0.6) {
        const c = Math.floor((vw + 20 - tau * 60) / cw);
        const at = Math.min(cols - 1, Math.max(0, c + 3));
        if (c > -8 && BB[at] === FOREST) stamp(Math.floor(t * 6) & 1 ? FOX : FOX_STEP, c, rBase, FOX_COLOURS);
      }
      return;
    }
    for (let i = 0; i < 24; i++) {
      const x = mod(hash2(i, 411) * vw * 1.3 - t * SPEED_NEAR * 0.8 + Math.sin(t * 0.7 + i) * 20, vw * 1.3);
      const c = Math.floor(x / cw);
      if (c >= cols || BB[c] !== FOREST) continue;
      if (hash3(i, 412, Math.floor(t * 2 + hash2(i, 413) * 4)) < 0.4) continue;
      const y = L.roadTop - ch * (1.5 + 4 * hash2(i, 414) + Math.sin(t * 1.1 + i * 3) * 0.8);
      putCell(c, screenRow(y, heroOff), (G_DOT << 7) | cr(WINDOW, hash2(i, 415) < 0.5 ? 0 : 1));
    }
  }

  // Direction signs on the highway gantries, and the signs and banners of the
  // set pieces.
  const SIGNS = ["PRAHA 102 →", "LIBEREC 14 →", "JABLONEC 8 →", "BRNO 186 →"];
  const SIGN_GREEN = "#1d6b3c";
  function drawPanels(t, heroOff) {
    let shift = layerShift(t, SPEED_NEAR);
    for (let k = Math.floor((shift - GANTRY_W) / GANTRY_GAP); k <= Math.floor((shift + cols) / GANTRY_GAP); k++) {
      const g0 = k * GANTRY_GAP;
      if (!gantryAt(k)) continue;
      const text = SIGNS[(hash2(k, 431) * SIGNS.length) | 0];
      panel(g0 + 2 - shift, GANTRY_W - 3, 9, 3, text, SIGN_GREEN, cr(PAPER, 0), heroOff, false, false);
    }
    const j0 = Math.round(((shift - 60) * cw) / BIOME_LEN + BLEND / 2);
    const j1 = Math.round(((shift + cols + 60) * cw) / BIOME_LEN + BLEND / 2);
    for (let j = j0; j <= j1; j++) {
      const ps = TRANS[ORDER[mod(j - 1, NB)]].panels;
      if (!ps) continue;
      const bc = meetCol(j);
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        const bg = p.bg === "accent" ? colors.accent : p.bg;
        panel(bc + p.x - shift, p.w, p.y, p.h, p.text, bg, p.fg === undefined ? cr(PAPER, 0) : p.fg, heroOff, p.strike, bg === SIGN_WHITE);
      }
    }
  }

  // A panel h rows high with one line of text in its middle row. A bordered
  // panel is framed in dark ink, like a town sign. A struck panel has a red
  // bar from corner to corner, like the sign at the end of a town, and the
  // letters it crosses turn red.
  function panel(c0, w, ly0, h, text, bg, fg, heroOff, strike, border) {
    const start = (w - text.length) >> 1;
    const mid = h >> 1;
    const ink = cr(INKD, 0);
    for (let j = 0; j < h; j++) {
      const r = rowAbove(ly0 + j, heroOff);
      for (let i = 0; i < w; i++) {
        const chr = j === mid ? text[i - start] : undefined;
        const onBar = strike && Math.min(h - 1, Math.floor((i * h) / w)) === j;
        let code = -1;
        if (chr && chr !== " ") code = (G(chr) << 7) | (onBar ? 7 : fg);
        else if (onBar) code = (G("╱") << 7) | 7;
        else if (border) {
          const top = j === h - 1, bottom = j === 0, left = i === 0, right = i === w - 1;
          if (top || bottom) code = ((left ? (top ? G_TL : G("└")) : right ? (top ? G_TR : G("┘")) : G_H) << 7) | ink;
          else if (left || right) code = (G_PIPE << 7) | ink;
        }
        putCellBg(c0 + i, r, code, bg);
      }
    }
  }

  // Traffic in the far lane of the highway and over the bridge, which the
  // rally car overtakes. Vehicles are drawn to the car's scale, ten sprite
  // pixels to the metre, with slightly smaller pixels because the lane is
  // further away. A vehicle joins at the right edge and carries on until it
  // has left the screen, so none appears or vanishes in the middle of the road.
  const TRAFFIC_SPEED = 24;

  // A vehicle in sprite pixels. Each shape is [key, y0, y1, left at y0, left
  // at y1, right at y0, right at y1]. The body is outlined, then windows and
  // lights go on top, then the wheels with their arches.
  function vehicleRows(W, H, body, details, wheels) {
    const g = [];
    for (let y = 0; y < H; y++) g.push(new Array(W).fill("."));
    function shape(s) {
      for (let y = s[1]; y <= s[2]; y++) {
        const f = s[2] === s[1] ? 0 : (y - s[1]) / (s[2] - s[1]);
        const xl = Math.round(s[3] + (s[4] - s[3]) * f), xr = Math.round(s[5] + (s[6] - s[5]) * f);
        for (let x = Math.max(0, xl); x <= Math.min(W - 1, xr); x++) if (y >= 0 && y < H) g[y][x] = s[0];
      }
    }
    body.forEach(shape);
    const edge = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (g[y][x] === ".") continue;
        if (y === 0 || x === 0 || y === H - 1 || x === W - 1 || g[y - 1][x] === "." || g[y + 1][x] === "." || g[y][x - 1] === "." || g[y][x + 1] === ".") edge.push(y * W + x);
      }
    }
    edge.forEach(function (i) { g[(i / W) | 0][i % W] = "k"; });
    details.forEach(shape);
    wheels.forEach(function (wh) {
      const cx = wh[0], r = wh[1], cy = H - r;
      for (let y = Math.floor(cy - r - 2); y < H; y++) {
        for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
          if (x < 0 || x >= W || y < 0) continue;
          const dd = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          if (dd <= r) g[y][x] = dd <= r * 0.42 ? "s" : "k";
          else if (dd <= r + 1.2 && y + 0.5 < cy && g[y][x] !== ".") g[y][x] = "d";
        }
      }
    });
    return g.map(function (row) { return row.join(""); });
  }

  const VEHICLES = [
    // A hatchback.
    { weight: 3, rows: vehicleRows(42, 15,
      [["b", 5, 11, 1, 0, 40, 41], ["b", 0, 4, 9, 6, 26, 35], ["B", 10, 11, 0, 0, 41, 41]],
      [["g", 1, 4, 10, 8, 17, 17], ["g", 1, 4, 20, 20, 27, 33], ["G", 1, 1, 21, 21, 24, 24], ["t", 6, 7, 0, 0, 1, 1], ["h", 6, 7, 40, 40, 41, 41]],
      [[8.5, 3.5], [33.5, 3.5]]) },
    // A saloon.
    { weight: 3, rows: vehicleRows(48, 15,
      [["b", 5, 11, 1, 0, 46, 47], ["b", 0, 4, 14, 9, 30, 38], ["B", 10, 11, 0, 0, 47, 47]],
      [["g", 1, 4, 14, 11, 21, 21], ["g", 1, 4, 24, 24, 31, 36], ["G", 1, 1, 25, 25, 28, 28], ["t", 6, 7, 0, 0, 1, 1], ["h", 6, 7, 46, 46, 47, 47]],
      [[10.5, 3.5], [38.5, 3.5]]) },
    // A van.
    { weight: 2, rows: vehicleRows(58, 25,
      [["b", 0, 9, 1, 0, 48, 57], ["b", 10, 20, 0, 0, 57, 57], ["B", 18, 20, 0, 0, 57, 57]],
      [["g", 2, 8, 42, 42, 49, 54], ["G", 2, 2, 43, 43, 46, 46], ["d", 4, 17, 38, 38, 38, 38], ["t", 10, 13, 0, 0, 1, 1], ["h", 11, 12, 56, 56, 57, 57]],
      [[11.5, 4.5], [46.5, 4.5]]) },
    // A box truck.
    { weight: 1.5, rows: vehicleRows(86, 34,
      [["w", 0, 26, 0, 0, 61, 61], ["b", 7, 14, 64, 64, 80, 85], ["b", 15, 27, 64, 64, 85, 85], ["d", 27, 29, 0, 0, 85, 85]],
      [["b", 20, 22, 1, 1, 60, 60], ["g", 9, 15, 67, 67, 76, 78], ["g", 9, 14, 81, 82, 82, 84], ["t", 23, 25, 0, 0, 1, 1], ["h", 21, 23, 84, 84, 85, 85]],
      [[12.5, 5], [24.5, 5], [73.5, 5]]) },
    // A coach.
    { weight: 1, rows: vehicleRows(120, 34,
      [["b", 0, 2, 3, 1, 116, 118], ["b", 3, 29, 0, 0, 119, 119], ["B", 25, 29, 0, 0, 119, 119]],
      [["g", 4, 13, 5, 5, 15, 15], ["g", 4, 13, 18, 18, 28, 28], ["g", 4, 13, 31, 31, 41, 41], ["g", 4, 13, 44, 44, 54, 54],
       ["g", 4, 13, 57, 57, 67, 67], ["g", 4, 13, 70, 70, 80, 80], ["g", 4, 13, 83, 83, 93, 93], ["G", 4, 4, 5, 5, 93, 93],
       ["g", 5, 26, 102, 102, 109, 109], ["d", 5, 26, 105, 105, 105, 105], ["g", 3, 16, 113, 113, 118, 118],
       ["y", 1, 2, 104, 104, 115, 115], ["w", 17, 18, 1, 1, 100, 100], ["t", 20, 23, 0, 0, 1, 1], ["h", 21, 23, 118, 118, 119, 119]],
      [[22.5, 5], [92.5, 5]]) },
    // An articulated lorry.
    { weight: 1, rows: vehicleRows(164, 40,
      [["w", 0, 30, 0, 0, 117, 117], ["d", 31, 32, 0, 0, 117, 117], ["b", 4, 12, 124, 124, 156, 163], ["b", 13, 33, 124, 124, 163, 163], ["d", 33, 34, 118, 118, 163, 163]],
      [["b", 24, 25, 1, 1, 116, 116], ["g", 8, 15, 146, 146, 154, 156], ["g", 6, 16, 157, 159, 159, 162], ["s", 27, 31, 128, 128, 140, 140],
       ["d", 0, 10, 143, 143, 143, 143], ["t", 27, 29, 0, 0, 1, 1], ["h", 27, 29, 162, 162, 163, 163]],
      [[12.5, 5.5], [25.5, 5.5], [38.5, 5.5], [133.5, 5.5], [153.5, 5.5]]) },
  ];
  const VEHICLE_WEIGHT = VEHICLES.reduce(function (s, v) { return s + v.weight; }, 0);
  function pickVehicle(h) {
    let a = h * VEHICLE_WEIGHT;
    for (let i = 0; i < VEHICLES.length; i++) {
      a -= VEHICLES[i].weight;
      if (a < 0) return VEHICLES[i];
    }
    return VEHICLES[0];
  }

  const BODY_COLOURS = ["#2f6fb0", "#e0a526", "#4f8a4b", "#8a8f99", "#ece9e2", "#6a4fa0", "#1f7f86", "#23262b", "#b8452f"];
  function drawTraffic(t, heroOff, heroFade) {
    const P = Math.max(1, Math.round(car.p * 0.8));
    const pD = Math.max(1, Math.round(P * dpr));
    const bottom = L.roadTop + ch * 1.35 - heroOff;
    const cycle = NB * BIOME_LEN;
    // Vehicles join while the highway and the bridge come into view.
    const joining = (2 * BIOME_LEN) / SPEED_NEAR - 10;
    const night = env.night > 0.35;
    const m1 = Math.floor((t * SPEED_NEAR + vw) / cycle) + 1;
    for (let m = m1 - 2; m <= m1; m++) {
      const t0 = ((m * NB + ORDER.indexOf(HIGHWAY) - BLEND / 2) * BIOME_LEN - vw) / SPEED_NEAR;
      let te = t0 + hash2(m, 425) * 4;
      for (let j = 0; te <= t0 + joining && te <= t; j++) {
        const id = m * 31 + j;
        const v = pickVehicle(hash2(id, 423));
        const spr = v.rows;
        const w = spr[0].length * P, h = spr.length * P;
        const x = vw + 4 - (t - te) * TRAFFIC_SPEED;
        te += (w + 180 + hash2(id, 426) * 420) / TRAFFIC_SPEED;
        if (x + w < 0 || x > vw) continue;
        const body = BODY_COLOURS[(hash2(id, 424) * BODY_COLOURS.length) | 0];
        const pal = {
          k: "#141518",
          b: body,
          B: shade(body, 0.78),
          w: "#e9e7e1",
          d: "#2f3136",
          g: "#5b7390",
          G: "#b9d0e6",
          s: "#c8ccd2",
          y: "#ffb300",
          t: night ? "#ff5a45" : "#c8352b",
          h: night ? "#ffd34d" : "#fff3c4",
        };
        const y = bottom - h;
        const c0 = Math.max(0, Math.floor(x / cw)), c1 = Math.min(cols - 1, Math.ceil((x + w) / cw));
        const r0 = Math.max(0, Math.floor((y + frac) / ch)), r1 = Math.min(rows - 1, Math.ceil((y + h + frac) / ch));
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) prevCode[r * cols + c] = -9;
        paintSprite(spr, Math.round(x * dpr), Math.round(y * dpr), pD, heroFade, id, pal);
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
        putCell(c, r, (g << 7) | cr(WINDOW, fall > 0.5 ? 0 : fall > 0.2 ? 1 : 2));
      }
    }
  }

  // ------------------------------------------------------------------ car ---

  // A rally hatchback facing right: red with a white and navy stripe, a door
  // number, a rear wing, a light pod on the bonnet and a driver in a white
  // helmet. The wheels are drawn separately so their spokes can turn.
  // k outline, d trim, r body, R lower body, w white, b navy, g glass,
  // G glass highlight, y light pod, t tail lights, h headlights, Y gold rims,
  // s silver spokes.
  const CAR = [
    ".kkkkkkkk........kkk....................",
    ".kddddddk..kkkkkkdddkkkkkk..............",
    "...k..k...krrrrrrrrrrrrrrrk.............",
    "...k..k..kGgggkggggggwwggggk...dyyyyd...",
    ".kkkkkkkkGggggkggggggwbbggggkkkkkkkkkk..",
    ".ktrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrk.",
    ".ktrrrrrrrrrrrrrrwwwwwwrrrrrrrrrrrrrrhhk",
    ".kwwwwwwwwwwwwwwwwkkkkwwwwwwwwwwwwwwwhhk",
    ".kbbbbbbbbbbbbbbbwwwwkwbbbbbbbbbbbbbbbrk",
    ".krrrrrrrrrrrrrrrwwwkwwrrrrrrrrrrrrrrrrk",
    "dkRRRRRRRRRRRRRRRwwwwwwRRRRRRRRRRRRRRRRk",
    ".kdd.........dddddddddddddd.........dddk",
    "...d.........kkkkkkkkkkkkkd.........kkk.",
    "...d......................d.............",
  ];
  const WHEEL = [
    ["...kkk...", ".kkkkkkk.", ".kkYsYkk.", "kkYYsYYkk", "kkssssskk", "kkYYsYYkk", ".kkYsYkk.", ".kkkkkkk.", "...kkk..."],
    ["...kkk...", ".kkkkkkk.", ".kksYskk.", "kkYsYsYkk", "kkYYsYYkk", "kkYsYsYkk", ".kksYskk.", ".kkkkkkk.", "...kkk..."],
  ];
  const CAR_W = CAR[0].length;
  const CAR_H = 17;
  const WHEELS_AT = [[4, 8], [27, 8]];
  // Where exhaust puffs and road dust leave the car, in sprite pixels.
  const EXHAUST = [0, 10];
  const REAR_WHEEL = [8, 16];

  // The body colour is the page accent, and the lower body a darker shade of it.
  function shade(hex, k) {
    const c = rgbOf(hex, [200, 53, 43]);
    return "rgb(" + Math.round(c[0] * k) + "," + Math.round(c[1] * k) + "," + Math.round(c[2] * k) + ")";
  }

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
        ctx.fillStyle = pal[k] || pal.k;
        ctx.fillRect(px, py, pD, pD);
      }
    }
  }

  function sizeCar() {
    car.p = vw < 640 ? 3 : vw < 1200 ? 4 : 5;
    car.w = CAR_W * car.p;
    car.h = CAR_H * car.p;
    car.x = vw * (vw < 640 ? 0.62 : 0.7) - car.w / 2;
  }

  // The road sits at 80% of the hero, or lower if the car would otherwise
  // drive behind the hero text above it.
  function roadTopFor(H) {
    let clear = 0;
    for (let i = 0; i < heroBlocks.length; i++) {
      const b = heroBlocks[i];
      if (b.right > car.x - 8 && b.left < car.x + car.w + 8) clear = Math.max(clear, b.bottom);
    }
    const min = clear ? clear + 10 + car.h - ch * 2.4 : 0;
    return Math.ceil(Math.max(H * 0.8, min) / ch) * ch;
  }

  function drawCar(t, heroOff, heroFade) {
    car.visible = false;
    // The car leaves before the rest of the landscape does.
    heroFade = Math.min(heroFade, 1 - smooth(heroH * 0.15, heroH * 0.5, window.scrollY || 0));
    if (!heroEl || heroFade <= 0) return;
    const P = car.p;
    const pD = Math.max(1, Math.round(P * dpr));
    const bottom = L.roadTop + ch * 2.4 - heroOff;
    if (bottom < -40 || bottom - car.h > vh) return;
    let hop = 0;
    const since = t - car.hopT;
    if (since < 0.55) hop = Math.sin((since / 0.55) * Math.PI) * 22;
    car.y = bottom - car.h - hop;
    car.visible = true;
    const night = env.night > 0.35;
    if (night) drawBeam(t, env.night * heroFade);
    // Traffic in the far lane passes behind the car but in front of its beam.
    drawTraffic(t, heroOff, heroFade);
    const pal = {
      k: "#141518",
      d: "#2f3136",
      r: colors.accent,
      R: shade(colors.accent, 0.72),
      w: "#f5f4f0",
      b: "#223a7a",
      g: "#5b7390",
      G: "#b9d0e6",
      y: night ? "#ffd34d" : "#e8b92e",
      t: night ? "#ff5a45" : "#e0352b",
      h: night ? "#ffd34d" : "#fff3c4",
      Y: "#d4a72c",
      s: "#c8ccd2",
    };
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
    // Gravel throws up more dust than tarmac, and snow sprays white.
    const wheel = Math.min(cols - 1, Math.max(0, Math.floor((car.x + car.p * REAR_WHEEL[0]) / cw)));
    const place = BB[wheel];
    const rally = place === RALLY;
    if (t - lastDust > (rally ? 0.025 : place === DESERT ? 0.045 : 0.07)) {
      lastDust = t;
      dust.push({
        x: car.x + car.p * REAR_WHEEL[0],
        y: car.y + car.p * REAR_WHEEL[1] + heroOff,
        vx: -(35 + Math.random() * (rally ? 90 : 45)),
        vy: -(4 + Math.random() * (rally ? 28 : 12)),
        born: t,
        life: (rally ? 0.9 : 0.6) + Math.random() * (rally ? 1.1 : 0.8),
        g: pick(S.dust, Math.random()),
        colour: place === WINTER ? SNOW : rally ? ROCK : SAND,
        puff: false,
      });
    }
    if (t - lastPuff > 0.2) {
      lastPuff = t;
      dust.push({
        x: car.x + car.p * EXHAUST[0],
        y: car.y + car.p * EXHAUST[1] + heroOff,
        vx: -(20 + Math.random() * 20),
        vy: -(6 + Math.random() * 10),
        born: t,
        life: 0.5 + Math.random() * 0.5,
        g: Math.random() < 0.5 ? G_O : G("°"),
        colour: 0,
        puff: true,
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
      const lvl = age < 0.3 ? 0 : age < 0.6 ? 1 : 2;
      putCell(Math.floor(d.x / cw), screenRow(d.y, heroOff), (d.g << 7) | (d.puff ? 3 + lvl : cr(d.colour, lvl)));
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
    sizeCar();
    L.roadTop = roadTopFor(H);
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
    // The night tint fades out quickly once the page scrolls, so the sections
    // below never sit on a half-dark sky.
    computeTone(heroVisible ? heroFade * (1 - smooth(H * 0.1, H * 0.6, scrollY)) : 0, rowOff);
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
      const alt = rowAlt[r];
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
          code = (g << 7) | (7 + (e > 0.55 ? 0 : e > 0.28 ? 1 : 2));
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
          let row = code & 127;
          if (row >= COLOUR_BASE) {
            if (alt) row += COLOUR_ROWS;
          } else if (inv && row < 7) row += 10;
          ctx.drawImage(atlas, (code >> 7) * cwD, row * chD, cwD, chD, c * cwD, yD, cwD, chD);
        }
      }
    }

    if (heroVisible && heroFade > 0.3) {
      drawBoats(t, heroOff);
      drawTumbleweed(t, heroOff);
      drawBirds(t, heroOff);
      drawPlane(t, heroOff);
      drawShootingStar(t, heroOff);
      drawLighthouse(t, heroOff);
      drawSmoke(t, heroOff);
      drawAnimals(t, heroOff);
      drawPanels(t, heroOff);
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
  document.addEventListener("langchange", function () {
    if (!started) return;
    requestAnimationFrame(measureLayout);
  });

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
