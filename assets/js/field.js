// The glyph field behind the page.
//
// A fixed canvas is divided into character cells, and every cell draws one
// glyph from a pre-rendered atlas. The first screen is a landscape (clouds, two
// ridgelines and a road with a pixel rally car on it). The rest of the page is
// a plot: a dotted grid, ridgeline traces and heavy dashes that come and go.
// The footer sits on water, and a numbered ruler runs along the top edge.
// Elements with the class `ko` are cut out of the field so their text stays
// readable.
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

  // --------------------------------------------------------------- glyphs ---

  // Every glyph here exists in Departure Mono.
  const SETS = {
    cloudDense: "■■■▪═■",
    cloudMid: "=+□▪≈=",
    cloudEdge: "-:·.'-",
    digits: "0123456789",
    shade: "\\X#■=\\",
    lit: "/.'",
    base: ".:'`,",
    road: "─═-—─",
    water: "─═-—~≈─",
    energy: "<>/\\|-=+*#%&",
    dust: ".·°'`,",
  };
  const EXTRA = "/\\-─═■·^_|.━•¯│┊╷";
  const GLYPHS = Array.from(new Set(Array.from(Object.values(SETS).join("") + EXTRA)));
  const GI = new Map(GLYPHS.map(function (g, i) { return [g, i]; }));
  const S = {};
  for (const key in SETS) S[key] = Int16Array.from(Array.from(SETS[key]), function (g) { return GI.get(g); });
  const G_SLASH = GI.get("/");
  const G_BACK = GI.get("\\");
  const G_DASH = GI.get("-");
  const G_H = GI.get("─");
  const G_HH = GI.get("═");
  const G_SQ = GI.get("■");
  const G_DOT = GI.get("·");
  const G_CARET = GI.get("^");
  const G_HEAVY = GI.get("━");
  const G_BULLET = GI.get("•");
  const G_MACRON = GI.get("¯");
  const G_US = GI.get("_");
  const G_PIPE = GI.get("│");
  const G_GRID = GI.get("┊");
  const G_TICK = GI.get("╷");

  // Atlas rows 0–6 are ink at falling opacity, rows 7–9 are the accent.
  const FG_LEVELS = [1, 0.8, 0.6, 0.44, 0.32, 0.22, 0.13];
  const AC_LEVELS = [1, 0.62, 0.34];

  function pick(set, h) {
    return set[(h * set.length) | 0];
  }

  // ---------------------------------------------------------------- state ---

  const MAX_CELLS = 17000;
  const FPS = 30;
  const P_HERO = 0.55;
  const P_CALM = 0.3;
  const SPEED_FAR = 4;
  const SPEED_NEAR = 11;
  // Plot layer: a dotted grid line every GRID columns, and ridgeline traces
  // TRACE_ROWS rows apart with heavy dashes and dots placed on them.
  const GRID = 6;
  const TRACE_ROWS = 5;
  const SLOT = 7;

  let dpr = 1, vw = 0, vh = 0;
  let fontPx = 11, cw = 7, ch = 14, cwD = 7, chD = 14;
  let cols = 0, rows = 0, N = 0;
  let atlas = null;
  let colors = { bg: "#f3f2ee", fg: "#0b0b0b", accent: "#ff4f00" };
  let mask, E, RA, RB, HF, HN;
  let traceBuf = new Float32Array(0);
  let traceK0 = 0, traceCount = 0, traceGap = 70, traceAmp = 180, plotOff = 0;
  let heroEl = null, shoreEl = null, koEls = [];
  let heroH = 0;
  let reduced = reducedMQ.matches;
  let started = false;
  let raf = 0, lastDraw = 0, lastT = 0;
  const pulses = [];
  const dust = [];
  let lastDust = 0;
  const L = { cloudBase: 0, farBase: 0, farAmp: 0, nearBase: 0, nearAmp: 0, roadTop: 0, groundEnd: 0 };
  const car = { x: 0, y: 0, w: 0, h: 0, p: 4, hopT: -10, visible: false };

  function readColors() {
    const cs = getComputedStyle(root);
    colors = {
      bg: cs.getPropertyValue("--bg").trim() || colors.bg,
      fg: cs.getPropertyValue("--fg").trim() || colors.fg,
      accent: cs.getPropertyValue("--accent").trim() || colors.accent,
    };
  }

  function buildAtlas() {
    atlas = document.createElement("canvas");
    atlas.width = GLYPHS.length * cwD;
    atlas.height = 10 * chD;
    const a = atlas.getContext("2d");
    a.font = fontPx * dpr + 'px "Departure Mono", ui-monospace, Menlo, monospace';
    a.textBaseline = "alphabetic";
    const baseline = Math.round(fontPx * dpr);
    for (let row = 0; row < 10; row++) {
      a.fillStyle = row < 7 ? colors.fg : colors.accent;
      a.globalAlpha = row < 7 ? FG_LEVELS[row] : AC_LEVELS[row - 7];
      for (let i = 0; i < GLYPHS.length; i++) a.fillText(GLYPHS[i], i * cwD, row * chD + baseline);
    }
  }

  function measureLayout() {
    heroEl = document.querySelector("[data-hero]");
    shoreEl = document.querySelector("[data-shore]");
    koEls = Array.from(document.querySelectorAll(".ko"));
    heroH = heroEl ? heroEl.offsetHeight : 0;
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
      rows = Math.ceil(canvas.height / chD);
      if (cols * rows <= MAX_CELLS || scale >= 2) break;
      scale += 0.25;
    }
    cw = cwD / dpr;
    ch = chD / dpr;
    N = cols * rows;
    mask = new Uint8Array(N);
    E = new Float32Array(N);
    RA = new Float32Array(N);
    RB = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      RA[i] = hash2(i, 7);
      RB[i] = hash2(i, 13);
    }
    HF = new Float32Array(cols);
    HN = new Float32Array(cols);
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
        const r0 = Math.max(0, Math.floor((rc.top - padY) / ch));
        const r1 = Math.min(rows - 1, Math.floor((rc.bottom + padY) / ch));
        const ic0 = Math.floor(rc.left / cw), ic1 = Math.floor(rc.right / cw);
        const ir0 = Math.floor(rc.top / ch), ir1 = Math.floor(rc.bottom / ch);
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

  // --------------------------------------------------------------- layers ---

  function ridge(u, seed) {
    const a = 1 - Math.abs(noise3(u, seed, 0.37));
    const b = noise3(u * 2.6, seed + 4.1, 1.13) * 0.5 + 0.5;
    const d = noise3(u * 6.3, seed + 9.2, 2.71) * 0.5 + 0.5;
    return Math.min(1, a * a * 0.6 + b * 0.3 + d * 0.1);
  }

  function computeRidges(t) {
    for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * cw;
      HF[c] = L.farBase - L.farAmp * ridge((x + t * SPEED_FAR) / 420, 1.7);
      HN[c] = L.nearBase - L.nearAmp * ridge((x + t * SPEED_NEAR) / 250, 8.3);
    }
  }

  // Samples every visible trace at each column edge, in plot-scene pixels.
  // A trace sits on its baseline and rises above it by up to traceAmp, so
  // neighbouring traces cross each other.
  function computeTraces(t, scrollY) {
    plotOff = scrollY * P_CALM;
    traceGap = ch * TRACE_ROWS;
    traceAmp = traceGap * 2.6;
    traceK0 = Math.floor(plotOff / traceGap) - 1;
    const k1 = Math.ceil((plotOff + vh + traceAmp) / traceGap) + 1;
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
        const env = 0.6 + 0.4 * noise3(x / 700, k * 0.23, 5.5);
        const h = env * (0.6 * Math.max(0, n1) + 0.4 * Math.pow(n2 * 0.5 + 0.5, 3));
        traceBuf[n * stride + c] = baseY - amp * h;
      }
    }
  }

  function skyCell(c, r, x, sy, t, idx) {
    const hv = hash3(c, r, Math.floor(t * 0.4 + RA[idx] * 8));
    const cx = (x + t * 4) / 230, cy = sy / 115;
    const d = noise3(cx, cy, t * 0.018) * 0.62 + noise3(cx * 2.3, cy * 2.3, t * 0.03 + 5.1) * 0.38;
    const thr = 0.1 + 0.6 * smooth(L.cloudBase * 0.35, L.cloudBase * 1.25, sy);
    const v = d - thr;
    if (v > 0.26) return hv < 0.07 ? (pick(S.digits, hv * 14) << 4) | 1 : pick(S.cloudDense, hv) << 4;
    if (v > 0.13) return hv < 0.1 ? (pick(S.digits, hv * 10) << 4) | 1 : (pick(S.cloudMid, hv) << 4) | 1;
    if (v > 0.03) return (pick(S.cloudEdge, hv) << 4) | 3;
    if (sy < L.farBase) {
      const z = noise3(x / 320 + t * 0.012, sy / 150, 9.1);
      if (z > 0.32) return ((c & 1 ? G_BACK : G_SLASH) << 4) | (z > 0.5 ? 4 : 5);
    }
    const hs = hash2(Math.floor((x + t * 9) / cw), r + 400);
    if (hs < 0.01) return ((hs < 0.006 ? G_DASH : G_DOT) << 4) | 4;
    return c % GRID === 0 ? (G_GRID << 4) | 6 : -1;
  }

  function mountainCell(c, sy, H, near, wc) {
    const h = H[c];
    const hl = H[c > 0 ? c - 1 : c];
    const hr = H[c < cols - 1 ? c + 1 : c];
    const slope = (hr - hl) / (2 * cw);
    const depth = (sy - h) / ch;
    const rs = Math.floor(sy / ch);
    const edgeRows = Math.max(1, (Math.abs(slope) * cw) / ch + 0.6);
    if (depth < edgeRows) {
      let g = G_DASH;
      if (slope < -0.3) g = G_SLASH;
      else if (slope > 0.3) g = G_BACK;
      else if (hl > h && hr > h) g = G_CARET;
      return (g << 4) | (near ? 0 : 2);
    }
    const hv = hash2(wc, rs + (near ? 900 : 1900));
    const fade = 1 - smooth(3, near ? 16 : 10, depth);
    const tex = noise3((wc * cw) / 46, sy / 46, near ? 3.3 : 7.7);
    if (slope > 0.05) {
      if ((((wc - rs) % 3) + 3) % 3 === 0 && hv < 0.8 * fade + 0.1) return (G_BACK << 4) | (near ? 1 : 3);
      if (tex > 0.25 && hv < fade) return (pick(S.shade, hash2(wc, rs)) << 4) | (near ? 1 : 3);
    } else {
      if ((((wc + rs) % 4) + 4) % 4 === 0 && hv < 0.5 * fade) return (G_SLASH << 4) | (near ? 2 : 4);
      if (tex > 0.45 && hv < 0.4 * fade) return (pick(S.lit, hash2(wc, rs)) << 4) | (near ? 2 : 4);
    }
    if (hv < 0.05 + 0.08 * (1 - fade)) return (pick(S.base, hash2(rs, wc)) << 4) | (near ? 3 : 5);
    return -1;
  }

  function groundCell(x, sy, t) {
    const ri = Math.floor((sy - L.roadTop) / ch);
    if (ri === 0) {
      const wc = Math.floor((x + t * 20) / cw);
      return ((hash2(wc >> 2, 91) < 0.82 ? G_H : G_HH) << 4) | 1;
    }
    const speed = 20 + ri * 8;
    const wc = Math.floor((x + t * speed) / cw);
    const segLen = 2 + ((hash2(ri, 17) * 7) | 0);
    const hs = hash2(Math.floor(wc / segLen), ri + 31);
    const fade = 1 - smooth(L.roadTop + ch * 6, L.groundEnd, sy);
    const dens = 0.5 * fade;
    const lvl = ri < 4 ? 2 : 1;
    if (hs < dens) {
      const hc = hash2(wc, ri + 5);
      if (hc < 0.035) return (pick(S.digits, hash2(wc, ri + 9)) << 4) | lvl;
      if (hc < 0.06) return (G_SQ << 4) | lvl;
      return (S.road[((hs / dens) * S.road.length) | 0] << 4) | lvl;
    }
    if (hash2(wc, ri + 60) < 0.025 * fade) return (G_DOT << 4) | 3;
    return -1;
  }

  function heroCell(c, r, x, sy, t, idx) {
    if (sy >= L.groundEnd) return -2;
    if (sy >= L.roadTop) return groundCell(x, sy, t);
    if (sy >= HN[c]) return mountainCell(c, sy, HN, true, Math.floor((x + t * SPEED_NEAR) / cw));
    if (sy >= HF[c]) return mountainCell(c, sy, HF, false, Math.floor((x + t * SPEED_FAR) / cw));
    return skyCell(c, r, x, sy, t, idx);
  }

  function plotCell(c, r, y, t, idx) {
    const sy = y + plotOff;
    const top = sy - ch / 2, bot = sy + ch / 2;
    const kLo = Math.max(traceK0, Math.ceil(top / traceGap));
    const kHi = Math.min(traceK0 + traceCount - 1, Math.floor((bot + traceAmp) / traceGap));
    const stride = cols + 1;
    let curve = -1;
    for (let k = kLo; k <= kHi; k++) {
      const row = (k - traceK0) * stride;
      // Dashes and dots sit on the trace at the centre of a slot. Each slot
      // re-rolls every ~9 s, so marks come and go slowly.
      const shift = ((k * 3) % SLOT + SLOT) % SLOT;
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
    if (hash3(c, r, Math.floor(t * 0.35 + RA[idx] * 8)) < 0.002) return (pick(S.energy, RB[idx]) << 4) | 5;
    return -1;
  }

  // A numbered ruler along the top edge. Its ticks line up with the grid.
  function drawRuler() {
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, canvas.width, chD);
    for (let c = 0; c < cols; c++) {
      const m = c % GRID;
      let g = -1;
      if (m === 0) g = G_TICK;
      else if (m === 1 || m === 2) {
        const label = String(Math.floor(c / GRID) + 1).padStart(2, "0");
        g = GI.get(label[m - 1]);
      }
      if (g >= 0) ctx.drawImage(atlas, g * cwD, 3 * chD, cwD, chD, c * cwD, 0, cwD, chD);
    }
  }

  function waterCell(x, dy, t) {
    const ri = Math.floor(dy / ch);
    if (ri === 0) {
      const wc = Math.floor((x + t * 6) / cw);
      return ((hash2(wc >> 2, 3) < 0.85 ? G_H : G_HH) << 4) | 1;
    }
    const sway = Math.sin(t * 0.9 + ri * 0.7) * cw * 1.2;
    const speed = 4 + ri * 2.5;
    const wc = Math.floor((x + t * speed + sway) / cw);
    const segLen = 2 + ((hash2(ri, 71) * 8) | 0);
    const hs = hash2(Math.floor(wc / segLen), ri + 131);
    const dens = Math.min(0.7, 0.16 + ri * 0.05);
    if (hs < dens) {
      if (hash2(wc, ri + 7) < 0.03) return (G_SQ << 4) | 1;
      return (S.water[((hs / dens) * S.water.length) | 0] << 4) | (ri < 3 ? 3 : ri < 7 ? 2 : 1);
    }
    return -1;
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

  function paintSprite(rowsArr, ox, oy, pD, fade, seed, alphaFor) {
    for (let j = 0; j < rowsArr.length; j++) {
      const line = rowsArr[j];
      for (let i = 0; i < line.length; i++) {
        const k = line[i];
        if (k === ".") continue;
        if (fade < 1 && hash2(i + seed, j) > fade) continue;
        const px = ox + i * pD, py = oy + j * pD;
        const cell = Math.floor(py / chD) * cols + Math.floor(px / cwD);
        if (cell >= 0 && cell < N && mask[cell] === 1) continue;
        ctx.globalAlpha = alphaFor(k);
        ctx.fillStyle = k === "a" ? colors.accent : k === "w" ? colors.bg : colors.fg;
        ctx.fillRect(px, py, pD, pD);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawCar(t, heroOff, heroFade) {
    car.visible = false;
    // The car leaves before the rest of the landscape does.
    const fade = 1 - smooth(heroH * 0.15, heroH * 0.5, window.scrollY || 0);
    heroFade = Math.min(heroFade, fade);
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
    const ox = Math.round(car.x * dpr);
    const oy = Math.round(car.y * dpr);
    const bump = !reduced && hop === 0 && hash2(Math.floor(t * 6), 5) < 0.22 ? -pD : 0;
    const alphaFor = function (k) { return k === "g" ? 0.35 : 1; };
    paintSprite(CAR, ox, oy + bump, pD, heroFade, 0, alphaFor);
    const frame = reduced ? 0 : Math.floor(t * 12) % 2;
    for (let w = 0; w < WHEELS_AT.length; w++) {
      const [wx, wy] = WHEELS_AT[w];
      paintSprite(WHEEL[frame], ox + wx * pD, oy + wy * pD, pD, heroFade, 50 + w * 9, alphaFor);
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
      const c = Math.floor(d.x / cw);
      const r = Math.floor((d.y - heroOff) / ch);
      if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
      if (mask[r * cols + c]) continue;
      const age = (t - d.born) / d.life;
      const lvl = age < 0.3 ? 2 : age < 0.6 ? 3 : 4;
      ctx.fillStyle = colors.bg;
      ctx.fillRect(c * cwD, r * chD, cwD, chD);
      ctx.drawImage(atlas, d.g * cwD, lvl * chD, cwD, chD, c * cwD, r * chD, cwD, chD);
    }
  }

  // --------------------------------------------------------------- energy ---

  function inject(px, py, radius, amount) {
    const c0 = Math.max(0, Math.floor((px - radius) / cw));
    const c1 = Math.min(cols - 1, Math.floor((px + radius) / cw));
    const r0 = Math.max(0, Math.floor((py - radius) / ch));
    const r1 = Math.min(rows - 1, Math.floor((py + radius) / ch));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const d = Math.hypot((c + 0.5) * cw - px, (r + 0.5) * ch - py) / radius;
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
        const dy = (r + 0.5) * ch - pulse.y;
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
    L.cloudBase = H * 0.42;
    L.farBase = H * 0.74;
    L.farAmp = H * 0.26;
    L.nearBase = H * 0.83;
    L.nearAmp = H * 0.15;
    L.roadTop = Math.round((H * 0.86) / ch) * ch;
    L.groundEnd = H + vh * 0.3;

    const heroOff = scrollY * P_HERO;
    const heroFade = heroEl ? 1 - smooth(H * 0.3, H * 1.0, scrollY) : 0;
    const heroVisible = heroFade > 0 && L.groundEnd - heroOff > 0;
    const needCalm = heroFade < 1 || vh + heroOff > L.groundEnd;
    if (needCalm) computeTraces(t, scrollY);
    if (heroVisible) computeRidges(t);
    buildMask();
    const shoreTop = shoreEl ? shoreEl.getBoundingClientRect().top : Infinity;

    if (!reduced) {
      const decay = Math.pow(0.87, dt * 30);
      for (let i = 0; i < N; i++) if (E[i] > 0.001) E[i] *= decay; else E[i] = 0;
      if (pulses.length) applyPulses(t);
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < rows; r++) {
      const y = (r + 0.5) * ch;
      const sy = y + heroOff;
      const yD = r * chD;
      const base = r * cols;
      for (let c = 0; c < cols; c++) {
        const idx = base + c;
        const m = mask[idx];
        if (m === 1 || (m === 2 && RA[idx] < 0.55)) continue;
        const x = (c + 0.5) * cw;
        let code;
        const e = E[idx];
        if (e > 0.06) {
          const g = pick(S.energy, hash3(c, r, Math.floor(t * 14 + RA[idx] * 10)));
          code = (g << 4) | (7 + (e > 0.55 ? 0 : e > 0.28 ? 1 : 2));
        } else if (y > shoreTop) {
          code = waterCell(x, y - shoreTop, t);
        } else {
          let hc = -2;
          if (heroVisible && heroFade > RB[idx]) hc = heroCell(c, r, x, sy, t, idx);
          code = hc === -2 ? (needCalm ? plotCell(c, r, y, t, idx) : -1) : hc;
        }
        if (code >= 0) {
          ctx.drawImage(atlas, (code >> 4) * cwD, (code & 15) * chD, cwD, chD, c * cwD, yD, cwD, chD);
        }
      }
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
    if (now - lastDraw < 1000 / FPS - 2) return;
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
  const STILL_T = 42;
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
