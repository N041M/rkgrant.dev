// Small animated plots drawn as text: one per project card and a globe in the
// contact section. Each <pre data-figure="name"> is redrawn only while it is on
// screen, and drawn once when reduced motion is on. The globe also redraws
// when someone drags or zooms it.
(function () {
  "use strict";

  const CW = 7;   // advance of 11px Departure Mono
  const LH = 14;  // line height used by .plot
  const reducedMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  const STILL_T = 12;

  function lang() {
    return document.documentElement.lang === "cs" ? "cs" : "en";
  }

  // Cell classes: 0 ink, 1 accent, 2 muted, 3 faint, 4 inverted, 5 accent fill.
  // cls() adds combinations as they are needed, such as the globe's shading.
  const CLS = ["", "a", "d", "g", "i", "ai"];
  const CLS_INDEX = new Map(CLS.map(function (c, i) { return [c, i]; }));
  function cls(name) {
    let i = CLS_INDEX.get(name);
    if (i === undefined) {
      i = CLS.length;
      CLS.push(name);
      CLS_INDEX.set(name, i);
    }
    return i;
  }

  function Grid(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.ch = new Array(cols * rows).fill(" ");
    this.cl = new Uint16Array(cols * rows);
  }
  Grid.prototype.put = function (x, y, str, cls) {
    if (y < 0 || y >= this.rows) return;
    const chars = Array.from(String(str));
    for (let i = 0; i < chars.length; i++) {
      const xx = x + i;
      if (xx < 0 || xx >= this.cols) continue;
      this.ch[y * this.cols + xx] = chars[i];
      this.cl[y * this.cols + xx] = cls || 0;
    }
  };
  Grid.prototype.get = function (x, y) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return null;
    return this.ch[y * this.cols + x];
  };
  Grid.prototype.html = function () {
    const out = [];
    for (let y = 0; y < this.rows; y++) {
      let line = "";
      let run = "";
      let runCls = -1;
      for (let x = 0; x < this.cols; x++) {
        const i = y * this.cols + x;
        const c = this.cl[i];
        if (c !== runCls) {
          line += wrap(run, runCls);
          run = "";
          runCls = c;
        }
        const chr = this.ch[i];
        run += chr === "<" ? "&lt;" : chr === ">" ? "&gt;" : chr === "&" ? "&amp;" : chr;
      }
      out.push(line + wrap(run, runCls));
    }
    return out.join("\n");
  };
  function wrap(text, cls) {
    if (!text) return "";
    return cls > 0 ? '<span class="' + CLS[cls] + '">' + text + "</span>" : text;
  }

  function hash(a, b) {
    let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function binom(n, k, p) {
    let c = 1;
    for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
    return c * Math.pow(p, k) * Math.pow(1 - p, n - k);
  }

  function num(x, digits) {
    const s = x.toFixed(digits);
    return lang() === "cs" ? s.replace(".", ",") : s;
  }

  // ---------------------------------------------------------------- figures ---

  const FIGURES = {};

  // Grimstat: a damage distribution that settles on a new attack every few
  // seconds. The most likely result is in the accent colour.
  FIGURES.grimstat = {
    fps: 12,
    init: function (s) {
      s.cur = null;
      s.target = null;
      s.next = 0;
    },
    draw: function (s, g, t) {
      const K = 13;
      if (!s.target || t >= s.next) {
        const p1 = 0.18 + Math.random() * 0.5;
        const mix = Math.random() < 0.45 ? 0.3 + Math.random() * 0.3 : 0;
        const p2 = Math.min(0.92, p1 + 0.2 + Math.random() * 0.2);
        s.target = [];
        for (let k = 0; k < K; k++) s.target.push((1 - mix) * binom(K - 1, k, p1) + mix * binom(K - 1, k, p2));
        if (!s.cur) s.cur = s.target.slice();
        s.next = t + 3.2;
      }
      for (let k = 0; k < K; k++) s.cur[k] += (s.target[k] - s.cur[k]) * 0.2;

      const barsH = g.rows - 2;
      const x0 = 2;
      const slotW = Math.max(2, Math.floor((g.cols - x0) / K));
      const barW = Math.max(1, slotW - 1);
      let max = 0, mode = 0, mean = 0, tot = 0;
      for (let k = 0; k < K; k++) {
        if (s.cur[k] > max) { max = s.cur[k]; mode = k; }
        mean += k * s.cur[k];
        tot += s.cur[k];
      }
      mean /= tot;

      for (let y = 0; y < barsH; y++) g.put(x0 - 1, y, "│", 2);
      g.put(x0 - 1, barsH, "└", 2);
      for (let x = x0; x < g.cols; x++) g.put(x, barsH, "─", 2);
      for (let k = 0; k < K; k++) {
        const bx = x0 + k * slotW;
        const h = Math.round((s.cur[k] / max) * barsH * 8 * 0.9);
        for (let y = 0; y < barsH; y++) {
          const fill = Math.max(0, Math.min(8, h - (barsH - 1 - y) * 8));
          if (fill > 0) {
            for (let w = 0; w < barW; w++) g.put(bx + w, y, " ▁▂▃▄▅▆▇█"[fill], k === mode ? 1 : 0);
          } else if (y > 0) {
            g.put(bx, y, "┊", 3);
          }
        }
        if (k % 2 === 0) g.put(bx, barsH + 1, String(k), 2);
      }
      g.put(x0 + Math.round(mean * slotW + (barW - 1) / 2), barsH, "┴", 1);
      const label = (lang() === "cs" ? "průměr " : "mean ") + num(mean, 1);
      g.put(g.cols - label.length, 0, label, 2);
    },
  };

  // Sentiment Signal: a sentiment trace above a market trace, both scrolling
  // left. A dot marks a statement that moved sentiment sharply, with a dotted
  // drop line down to the market.
  FIGURES.sentiment = {
    fps: 12,
    init: function (s) {
      s.sent = [];
      s.price = [];
      s.ev = [];
      s.sv = 0;
      s.pv = 0;
      s.acc = 0;
      s.last = null;
      for (let i = 0; i < 160; i++) this.step(s);
    },
    step: function (s) {
      s.sv = s.sv * 0.72 + (Math.random() - 0.5) * 0.9;
      let ev = false;
      if (Math.random() < 0.07) {
        s.sv += (Math.random() < 0.5 ? -1 : 1) * (0.9 + Math.random() * 0.5);
        ev = true;
      }
      s.sv = Math.max(-1.2, Math.min(1.2, s.sv));
      const lag = s.sent.length > 3 ? s.sent[s.sent.length - 3] : 0;
      s.pv = s.pv * 0.93 + 0.5 * lag + (Math.random() - 0.5) * 0.7;
      s.sent.push(s.sv);
      s.price.push(s.pv);
      s.ev.push(ev);
      if (s.sent.length > 240) {
        s.sent.shift();
        s.price.shift();
        s.ev.shift();
      }
    },
    draw: function (s, g, t) {
      if (s.last === null) s.last = t;
      s.acc += t - s.last;
      s.last = t;
      while (s.acc > 0.28) {
        s.acc -= 0.28;
        this.step(s);
      }
      const n = Math.min(g.cols, s.sent.length);
      const off = s.sent.length - n;
      const cs = lang() === "cs";
      for (let x = 0; x < g.cols; x += 2) g.put(x, 4, "·", 3);

      let pmin = Infinity, pmax = -Infinity;
      for (let i = off; i < s.price.length; i++) {
        pmin = Math.min(pmin, s.price[i]);
        pmax = Math.max(pmax, s.price[i]);
      }
      const pad = (pmax - pmin) * 0.1 + 0.01;

      for (let x = 0; x < n; x++) {
        if (s.ev[off + x]) for (let y = 1; y < g.rows; y++) g.put(x, y, "┊", 3);
      }
      const sentRows = trace(g, s.sent, off, n, 1, 3, -1.3, 1.3, 0);
      const priceRows = trace(g, s.price, off, n, 5, g.rows - 5, pmin - pad, pmax + pad, 0);
      for (let x = 0; x < n; x++) {
        if (!s.ev[off + x]) continue;
        g.put(x, sentRows[x], "•", 1);
        // The market's reaction three steps later, as a heavy dash.
        for (let d = 2; d <= 4; d++) if (x + d < n) g.put(x + d, priceRows[x + d], "━", 0);
      }
      g.put(0, 0, " " + (cs ? "vyjádření" : "statements") + " ", 2);
      g.put(g.cols - (cs ? 5 : 8), 4, " " + (cs ? "trh" : "market") + " ", 2);
    },
  };

  // Draws a line with three sub-row positions per row (¯ - _) and joins big
  // jumps with vertical strokes. Returns the row used in each column.
  function trace(g, values, off, n, top, nRows, min, max, cls) {
    const rowsUsed = [];
    let prev = -1;
    for (let x = 0; x < n; x++) {
      const v = values[off + x];
      const pos = Math.max(0, Math.min(nRows * 3 - 1, Math.round((1 - (v - min) / (max - min)) * (nRows * 3 - 1))));
      const row = top + Math.floor(pos / 3);
      g.put(x, row, ["¯", "-", "_"][pos % 3], cls);
      if (prev >= 0 && Math.abs(row - prev) > 1) {
        const a = Math.min(row, prev) + 1, b = Math.max(row, prev);
        for (let y = a; y < b; y++) g.put(x, y, "│", cls);
      }
      rowsUsed.push(row);
      prev = row;
    }
    return rowsUsed;
  }

  // Addison: a short exchange in a chat window. The reply is revealed with
  // Addison's own streaming scramble, then the buttons appear and one is
  // pressed.
  const EXCHANGES = {
    en: [
      { user: "Summarise report.pdf", reply: "Reading report.pdf needs your OK. The file stays on this computer.", buttons: ["Allow once", "No"], press: 0 },
      { user: "Clean up my Downloads", reply: "I'll move 34 files into 5 folders. A restore point is saved first.", buttons: ["Go ahead", "Show me"], press: 0 },
      { user: "Undo that", reply: "Done. All 34 files are back where they were.", buttons: [], press: -1 },
    ],
    cs: [
      { user: "Shrň report.pdf", reply: "Ke čtení souboru report.pdf potřebuju tvůj souhlas. Soubor zůstane v tomto počítači.", buttons: ["Povolit jednou", "Ne"], press: 0 },
      { user: "Ukliď mi Stažené soubory", reply: "Přesunu 34 souborů do 5 složek. Nejdřív uložím bod obnovení.", buttons: ["Pokračuj", "Ukaž mi to"], press: 0 },
      { user: "Vrať to zpátky", reply: "Hotovo. Všech 34 souborů je zpět na svém místě.", buttons: [], press: -1 },
    ],
  };

  FIGURES.addison = {
    fps: 26,
    init: function (s) {
      if (s.cancel) s.cancel();
      s.i = 0;
      s.phase = "type";
      s.t0 = null;
      s.reply = "";
      s.pressed = -1;
      s.cancel = null;
    },
    draw: function (s, g, t, still) {
      const list = EXCHANGES[lang()];
      let ex = list[s.i % list.length];
      if (still) {
        s.phase = "buttons";
        s.reply = ex.reply;
        s.t0 = t;
      }
      if (s.t0 === null) s.t0 = t;
      if (s.phase === "buttons" && !still) {
        const dt = t - s.t0;
        if (ex.press >= 0 && dt > 1.1) s.pressed = ex.press;
        if (dt > (ex.buttons.length ? 2.6 : 2.2)) {
          s.i++;
          s.phase = "type";
          s.t0 = t;
          s.reply = "";
          s.pressed = -1;
          ex = list[s.i % list.length];
        }
      }
      const dt = t - s.t0;
      let typed = ex.user.length;
      if (s.phase === "type") {
        typed = Math.min(ex.user.length, Math.floor(dt * 22));
        if (dt > ex.user.length / 22 + 0.35) {
          s.phase = "stream";
          s.t0 = t;
          const done = function () {
            s.phase = "buttons";
            s.t0 = null;
          };
          if (window.Scramble) s.cancel = window.Scramble.streamReveal(ex.reply, function (f) { s.reply = f; }, done);
          else { s.reply = ex.reply; done(); }
        }
      }

      const W = g.cols;
      const inner = W - 4;
      g.put(0, 0, "╭" + "─".repeat(W - 2) + "╮", 2);
      g.put(2, 0, " Addison ", 0);
      for (let y = 1; y < g.rows - 1; y++) {
        g.put(0, y, "│", 2);
        g.put(W - 1, y, "│", 2);
      }
      g.put(0, g.rows - 1, "╰" + "─".repeat(W - 2) + "╯", 2);

      g.put(2, 1, ">", 1);
      g.put(4, 1, ex.user.slice(0, typed).slice(0, inner - 3), 0);
      if (s.phase === "type" && Math.floor(t * 2.5) % 2 === 0) g.put(4 + typed, 1, "█", 1);

      if (s.phase !== "type") {
        const lines = wrapLines(ex.reply, inner);
        for (let l = 0; l < lines.length && l < 3; l++) {
          const seg = s.reply.slice(lines[l][0], lines[l][1]);
          g.put(2, 3 + l, seg, 0);
        }
      }
      if (s.phase === "buttons" && ex.buttons.length) {
        let x = 2;
        ex.buttons.forEach(function (label, b) {
          const text = " " + label + " ";
          const cls = s.pressed === b ? 5 : b === 0 ? 4 : 0;
          if (b !== 0) g.put(x, 7, "[", 2);
          g.put(b === 0 ? x : x + 1, 7, text, cls);
          if (b !== 0) g.put(x + 1 + text.length, 7, "]", 2);
          x += text.length + 3;
        });
      }
    },
  };

  function wrapLines(text, width) {
    const lines = [];
    let start = 0;
    while (start < text.length) {
      let end = Math.min(text.length, start + width);
      if (end < text.length) {
        const space = text.lastIndexOf(" ", end);
        if (space > start) end = space;
      }
      lines.push([start, end]);
      start = end;
      while (text[start] === " ") start++;
    }
    return lines;
  }

  // S&P 500 thesis: the V3 model as a diagram. Inputs stream in, a marker walks
  // through the layers, and each pass adds a predicted direction next to the
  // naive model that always predicts a rise.
  FIGURES.snp = {
    fps: 12,
    init: function (s) {
      s.hist = [];
      s.cycle = -1;
      for (let i = 0; i < 40; i++) s.hist.push(Math.random() < 0.55);
    },
    draw: function (s, g, t) {
      const period = 2.4;
      const cyc = Math.floor(t / period);
      const p = (t % period) / period;
      if (cyc !== s.cycle) {
        s.cycle = cyc;
        s.hist.push(Math.random() < 0.55);
        if (s.hist.length > 80) s.hist.shift();
      }
      const cs = lang() === "cs";
      const bw = Math.min(g.cols, 34);
      const bx = Math.floor((g.cols - bw) / 2);
      const ax = bx + Math.floor(bw / 2);

      const label = cs ? "93 vstupů" : "93 inputs";
      g.put(bx, 0, label, 2);
      for (let x = bx + label.length + 1; x < ax; x++) {
        g.put(x, 0, "▪·▫·:•·"[Math.floor(hash(Math.floor(x - t * 9), 3) * 7)], 3);
      }
      g.put(ax, 0, "┐", 2);
      g.put(ax, 1, "▼", p < 0.15 ? 1 : 2);

      g.put(bx, 2, "┌" + "─".repeat(bw - 2) + "┐", 0);
      const layers = ["Bidirectional LSTM", cs ? "3 × Transformer blok" : "3 × Transformer block", "FeatureAttention"];
      const active = p >= 0.18 && p < 0.78 ? Math.floor((p - 0.18) / 0.2) : -1;
      for (let l = 0; l < 3; l++) {
        g.put(bx, 3 + l, "│", 0);
        g.put(bx + bw - 1, 3 + l, "│", 0);
        g.put(bx + 2, 3 + l, l === active ? "▸" : " ", 1);
        g.put(bx + 4, 3 + l, layers[l], l === active ? 0 : 2);
      }
      g.put(bx, 6, "└" + "─".repeat(bw - 2) + "┘", 0);
      g.put(ax, 6, "┬", 0);
      g.put(ax, 7, "▼", p >= 0.78 ? 1 : 2);

      const lw = 7;
      const n = Math.max(0, bw - lw);
      g.put(bx, 8, cs ? "model" : "model", 2);
      g.put(bx, 9, cs ? "naivní" : "naive", 2);
      for (let i = 0; i < n; i++) {
        const up = s.hist[s.hist.length - n + i];
        const newest = i === n - 1;
        g.put(bx + lw + i, 8, up ? "▲" : "▼", newest && p < 0.85 ? 1 : 0);
        g.put(bx + lw + i, 9, "▲", 3);
      }
    },
  };

  // PyQuest: a terminal session. `check` runs the puzzle three times with new
  // numbers, every run passes, and `next` moves on. Earlier sessions scroll up
  // the way they would in a real terminal.
  const PUZZLES = [
    { id: "6.4", fn: "total", run: function (a) { return a.reduce(function (s, v) { return s + v; }, 0); } },
    { id: "6.5", fn: "largest", run: function (a) { return Math.max.apply(null, a); } },
    { id: "6.6", fn: "count_even", run: function (a) { return a.filter(function (v) { return v % 2 === 0; }).length; } },
    { id: "6.7", fn: "smallest", run: function (a) { return Math.min.apply(null, a); } },
  ];
  const PROMPT = "~/pyquest $ ";
  const CYCLE = 6.4;

  FIGURES.pyquest = {
    fps: 20,
    init: function (s) {
      s.i = 0;
      s.t0 = null;
      s.runs = null;
      s.history = [];
    },
    newRuns: function () {
      const runs = [];
      for (let k = 0; k < 3; k++) {
        const a = [];
        const n = 2 + ((Math.random() * 3) | 0);
        for (let j = 0; j < n; j++) a.push(1 + ((Math.random() * 12) | 0));
        runs.push(a);
      }
      return runs;
    },
    // The lines of one session up to `dt` seconds in. A line is a list of
    // [column, text, class] pieces.
    session: function (s, dt) {
      const pz = PUZZLES[s.i % PUZZLES.length];
      const nx = PUZZLES[(s.i + 1) % PUZZLES.length];
      const typed = function (cmd, start) {
        return cmd.slice(0, Math.max(0, Math.min(cmd.length, Math.floor((dt - start) * 14))));
      };
      const calls = s.runs.map(function (a) { return pz.fn + "([" + a.join(", ") + "])"; });
      const resCol = 9 + Math.max.apply(null, calls.map(function (c) { return c.length; })) + 2;
      const lines = [[[0, PROMPT, 2], [PROMPT.length, typed("check", 0.2), 0]]];
      if (dt > 0.8) lines.push([[1, pz.id, 1], [6, pz.fn + "(nums)", 2]]);
      for (let k = 0; k < 3; k++) {
        if (dt <= 1.2 + k * 0.45) break;
        const res = "→ " + pz.run(s.runs[k]);
        lines.push([[1, "run " + (k + 1), 2], [9, calls[k], 0], [resCol, res, 0], [resCol + res.length + 2, "ok", 1]]);
      }
      if (dt > 2.8) lines.push([[1, "passed 3/3", 1]]);
      if (dt > 3.6) lines.push([[0, PROMPT, 2], [PROMPT.length, typed("next", 3.6), 0]]);
      if (dt > 4.3) lines.push([[1, nx.id, 1], [6, nx.fn + "(nums)", 2], [7 + nx.fn.length + 7, "▸ brief.md", 2]]);
      return lines;
    },
    draw: function (s, g, t, still) {
      if (!s.runs) s.runs = this.newRuns();
      if (s.t0 === null) s.t0 = t;
      let dt = still ? CYCLE : t - s.t0;
      if (!still && dt > CYCLE) {
        s.history = s.history.concat(this.session(s, CYCLE)).slice(-60);
        s.i++;
        s.t0 = t;
        s.runs = this.newRuns();
        dt = 0;
      }
      const lines = s.history.concat(this.session(s, dt));
      const shown = lines.slice(-g.rows);
      shown.forEach(function (line, y) {
        line.forEach(function (piece) { g.put(piece[0], y, piece[1], piece[2]); });
      });
      // A blinking cursor after the last prompt that is still being typed.
      const last = shown[shown.length - 1];
      if (!still && last[0][1] === PROMPT && Math.floor(t * 2.5) % 2 === 0) {
        g.put(PROMPT.length + last[1][1].length, shown.length - 1, "█", 1);
      }
    },
  };

  // Contact: a globe drawn in glyphs and shaded as a lit sphere, with Jablonec
  // nad Nisou marked. It turns slowly until someone drags it. The wheel, a pinch, a double
  // click or the buttons zoom in as far as single countries, and the strip
  // under the globe names the country under the pointer.
  // Home has a short label for when the globe is zoomed out and its full name
  // for when it is zoomed in.
  const HOME = { lat: 50.7243, lon: 15.1711, name: "Jablonec nad Nisou", short: "JBC" };
  const D = Math.PI / 180;
  const ZMAX = 40;
  const HOME_ZOOM = 14;
  const SPIN = 0.18;
  const QUADS = " ▗▖▄▝▐▞▟▘▚▌▙▀▜▛█";
  const QUAD_COUNT = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];
  const GRID_STEPS = [30, 15, 10, 5, 2, 1, 0.5];

  // The globe is lit from the upper left and a little in front. The sea also
  // shines where the light reflects straight back at the viewer.
  function unit(x, y, z) {
    const n = Math.hypot(x, y, z);
    return [x / n, y / n, z / n];
  }
  const LIGHT = unit(-0.5, 0.55, 0.67);
  const GLINT = unit(LIGHT[0], LIGHT[1], LIGHT[2] + 1);
  // Shading has sixteen tones. A 4×4 ordered dither blends the steps between
  // them.
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(function (b) { return (b + 0.5) / 16; });

  function wrapAngle(a) {
    return a - 2 * Math.PI * Math.floor((a + Math.PI) / (2 * Math.PI));
  }

  // The map is a grey PNG in which each pixel holds a country index, 0 for
  // sea. Its last row is a ramp from 0 to 255 that maps whatever the browser
  // decoded back to the stored values. Land is kept at four sizes so a sample
  // can read the one that matches its footprint on the globe.
  function loadWorld(done) {
    const img = new Image();
    Promise.all([
      fetch("assets/data/world.json").then(function (r) { return r.json(); }),
      new Promise(function (resolve, reject) {
        img.onload = resolve;
        img.onerror = reject;
        img.src = "assets/data/world.png";
      }),
    ]).then(function (res) {
      const meta = res[0];
      const w = meta.w, h = meta.h;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h + 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(0, 0, w, h + 1).data;
      canvas.width = canvas.height = 0;
      const lut = new Uint8Array(256);
      for (let x = 0; x < w; x++) lut[px[(h * w + x) * 4]] = Math.floor((x * 256) / w);
      const idx = new Uint8Array(w * h);
      const land = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) {
        idx[i] = lut[px[i * 4]];
        land[i] = idx[i] ? 255 : 0;
      }
      const countries = meta.countries;
      const bySize = countries.map(function (c, i) { return i + 1; }).sort(function (a, b) { return countries[b - 1][5] - countries[a - 1][5]; });
      done({ w: w, h: h, idx: idx, levels: shrink(land, w, h), countries: countries, bySize: bySize });
    }).catch(function () { /* without the map the globe is all sea */ });
  }

  function shrink(d, w, h) {
    const levels = [{ w: w, h: h, d: d }];
    while (w % 2 === 0 && h % 2 === 0 && w > 400) {
      const nw = w / 2, nh = h / 2, nd = new Uint8Array(nw * nh);
      for (let y = 0; y < nh; y++) {
        for (let x = 0; x < nw; x++) {
          const i = 2 * y * w + 2 * x;
          nd[y * nw + x] = (d[i] + d[i + 1] + d[i + w] + d[i + w + 1] + 2) >> 2;
        }
      }
      levels.push({ w: nw, h: nh, d: nd });
      d = nd;
      w = nw;
      h = nh;
    }
    return levels;
  }

  // The smallest level with at least one pixel per land sample.
  function levelFor(world, R) {
    const need = (2 * Math.PI * R) / (CW / 2);
    for (let i = world.levels.length - 1; i > 0; i--) if (world.levels[i].w >= need) return world.levels[i];
    return world.levels[0];
  }

  // Share of land at a point, interpolated between the four nearest pixels.
  function landAt(L, lat, lon) {
    const u = (wrapAngle(lon) / (2 * Math.PI) + 0.5) * L.w - 0.5;
    const v = (0.5 - lat / Math.PI) * L.h - 0.5;
    const x0 = Math.floor(u), y0 = Math.floor(v);
    const fx = u - x0, fy = v - y0;
    const xa = (x0 + L.w) % L.w, xb = (x0 + 1) % L.w;
    const ya = Math.max(0, y0) * L.w, yb = Math.min(L.h - 1, y0 + 1) * L.w;
    const d = L.d;
    const top = d[ya + xa] + (d[ya + xb] - d[ya + xa]) * fx;
    const bot = d[yb + xa] + (d[yb + xb] - d[yb + xa]) * fx;
    return (top + (bot - top) * fy) / 255;
  }

  function countryAt(world, lat, lon) {
    const x = Math.min(world.w - 1, Math.floor((wrapAngle(lon) / (2 * Math.PI) + 0.5) * world.w));
    const y = Math.min(world.h - 1, Math.max(0, Math.floor((0.5 - lat / Math.PI) * world.h)));
    return world.idx[y * world.w + x];
  }

  const regionNames = {};
  function countryName(world, i) {
    const c = world.countries[i - 1];
    const l = lang();
    if (!c[0]) return l === "cs" ? c[2] : c[1];
    try {
      if (!regionNames[l]) regionNames[l] = new Intl.DisplayNames([l], { type: "region" });
      return regionNames[l].of(c[0]) || c[0];
    } catch (e) {
      return c[0];
    }
  }

  function coords(lat, lon) {
    lon = wrapAngle(lon);
    const a = num(Math.abs(lat / D), 2) + "°", b = num(Math.abs(lon / D), 2) + "°";
    if (lang() === "cs") return a + (lat < 0 ? " j. š. " : " s. š. ") + b + (lon < 0 ? " z. d." : " v. d.");
    return a + (lat < 0 ? "S " : "N ") + b + (lon < 0 ? "W" : "E");
  }

  // The map fills the rows between the ruler and the three rows of readings.
  function view(s) {
    const top = 1, bottom = s.rows - 3;
    const w = s.cols * CW, h = (bottom - top) * LH;
    return {
      top: top,
      bottom: bottom,
      cx: w / 2,
      cy: top * LH + h / 2,
      R: Math.min(w, h) * 0.44 * s.zoom,
      lon0: s.lon,
      sin0: Math.sin(s.lat),
      cos0: Math.cos(s.lat),
    };
  }

  // Orthographic projection centred on (lat0, lon0), in pixels. z is below 0
  // on the far side.
  function project(v, lat, lon) {
    const cl = Math.cos(lat), dl = lon - v.lon0;
    const x = cl * Math.sin(dl);
    const y = v.cos0 * Math.sin(lat) - v.sin0 * cl * Math.cos(dl);
    const z = v.sin0 * Math.sin(lat) + v.cos0 * cl * Math.cos(dl);
    return [v.cx + v.R * x, v.cy - v.R * y, z];
  }

  // The point on the globe under pixel (px, py), or null off the globe.
  function unproject(v, px, py) {
    const x = (px - v.cx) / v.R, y = (v.cy - py) / v.R;
    const rr = x * x + y * y;
    if (rr > 1) return null;
    const z = Math.sqrt(1 - rr);
    return [Math.asin(z * v.sin0 + y * v.cos0), v.lon0 + Math.atan2(x, z * v.cos0 - y * v.sin0)];
  }

  // Turns the globe so that (lat, lon) sits under pixel (px, py). Of the two
  // centre latitudes that do this, it keeps the one nearer the current one.
  function pin(s, lat, lon, px, py) {
    const v = view(s);
    let x = (px - v.cx) / v.R, y = (v.cy - py) / v.R;
    const rr = x * x + y * y;
    if (rr > 0.998) {
      const k = Math.sqrt(0.998 / rr);
      x *= k;
      y *= k;
    }
    const z = Math.sqrt(1 - x * x - y * y);
    const q = Math.sin(lat) / Math.hypot(y, z);
    if (Math.abs(q) > 1) return;
    const a = Math.asin(q), phi = Math.atan2(y, z);
    let best = null;
    [a - phi, Math.PI - a - phi].forEach(function (c) {
      c = wrapAngle(c);
      if (Math.abs(c) <= Math.PI / 2 && (best === null || Math.abs(c - s.lat) < Math.abs(best - s.lat))) best = c;
    });
    if (best === null) return;
    s.lat = best;
    s.lon = lon - Math.atan2(x, z * Math.cos(best) - y * Math.sin(best));
  }

  // Sets the zoom and keeps the point under pixel (px, py) where it is.
  function zoomAt(s, zoom, px, py) {
    const at = unproject(view(s), px, py);
    s.zoom = Math.max(1, Math.min(ZMAX, zoom));
    if (at) pin(s, at[0], at[1], px, py);
  }

  // Eases towards a zoom, or jumps there when motion is reduced.
  function zoomTo(s, zoom, px, py) {
    zoom = Math.max(1, Math.min(ZMAX, zoom));
    if (reducedMQ.matches) {
      zoomAt(s, zoom, px, py);
      s.target = null;
    } else {
      s.target = { zoom: zoom, px: px, py: py };
    }
  }

  // Moves the globe the way a drag of (dx, dy) pixels would.
  function turn(s, dx, dy) {
    const R = view(s).R;
    const dlon = -dx / (R * Math.max(0.2, Math.cos(s.lat)));
    const dlat = dy / R;
    s.lon += dlon;
    s.lat = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, s.lat + dlat));
    return [dlon, dlat];
  }

  // Flies to Jablonec. From far away it pulls back in the middle of the
  // flight, by more the further it has to go.
  function flyHome(s) {
    const to = { lat: HOME.lat * D, lon: HOME.lon * D, zoom: HOME_ZOOM };
    s.target = null;
    if (reducedMQ.matches) {
      s.lat = to.lat;
      s.lon = to.lon;
      s.zoom = to.zoom;
      return;
    }
    const cosFar = Math.sin(s.lat) * Math.sin(to.lat) + Math.cos(s.lat) * Math.cos(to.lat) * Math.cos(to.lon - s.lon);
    const far = Math.acos(Math.max(-1, Math.min(1, cosFar)));
    const hop = Math.min(far * 2.5, Math.log(Math.max(s.zoom, to.zoom)));
    s.fly = { p: 0, lat: s.lat, lon: s.lon, zoom: s.zoom, hop: hop, to: to };
  }

  function step(s, dt, still) {
    if (s.fly) {
      const f = s.fly;
      f.p = still ? 1 : Math.min(1, f.p + dt / 1.6);
      const e = f.p < 0.5 ? 2 * f.p * f.p : 1 - Math.pow(2 - 2 * f.p, 2) / 2;
      const z0 = Math.log(f.zoom), z1 = Math.log(f.to.zoom);
      s.zoom = Math.max(1, Math.exp(z0 + (z1 - z0) * e - f.hop * Math.sin(Math.PI * e)));
      s.lat = f.lat + (f.to.lat - f.lat) * e;
      s.lon = f.lon + wrapAngle(f.to.lon - f.lon) * e;
      if (f.p >= 1) s.fly = null;
      return;
    }
    if (s.target) {
      const k = still ? 1 : 1 - Math.exp(-dt * 14);
      const z = Math.exp(Math.log(s.zoom) + (Math.log(s.target.zoom) - Math.log(s.zoom)) * k);
      const done = Math.abs(Math.log(z / s.target.zoom)) < 0.002;
      zoomAt(s, done ? s.target.zoom : z, s.target.px, s.target.py);
      if (done) s.target = null;
    }
    if (still) return;
    if (s.spin && !s.pointers.size) s.lon -= SPIN * dt;
    if ((s.vlon || s.vlat) && !s.pointers.size) {
      s.lon += s.vlon * dt;
      s.lat = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, s.lat + s.vlat * dt));
      const f = Math.exp(-dt * 4);
      s.vlon *= f;
      s.vlat *= f;
      if (Math.hypot(s.vlon, s.vlat) * view(s).R < 6) s.vlon = s.vlat = 0;
    }
  }

  // The glyph for a line through one cell, from the points where it crosses
  // the cell's edges (0–1 across and down). A line that only clips a corner
  // gets a dot in that corner, nearly flat lines sit high, in the middle or
  // low in the cell, and the rest are upright or slanted.
  function stroke(ax, ay, bx, by) {
    const dx = (bx - ax) * CW, dy = (by - ay) * LH;
    if (Math.hypot(dx, dy) < 6) {
      const top = ay + by < 1, left = ax + bx < 1;
      return top ? (left ? "`" : "'") : left ? "," : ".";
    }
    const ang = Math.atan2(Math.abs(dy), Math.abs(dx));
    if (ang < 0.5) {
      const m = (ay + by) / 2;
      return m < 0.34 ? "¯" : m > 0.66 ? "_" : "-";
    }
    if (ang > 1.2) return "│";
    return dx * dy > 0 ? "\\" : "/";
  }

  // Where the level `lv` crosses a cell, given the field at its top-left,
  // top-right, bottom-left and bottom-right corners.
  function contour(tl, tr, bl, br, lv) {
    const p = [];
    function edge(a, b, x0, y0, x1, y1) {
      if (a < lv === b < lv) return;
      const f = (lv - a) / (b - a);
      p.push(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f);
    }
    edge(tl, tr, 0, 0, 1, 0);
    edge(tr, br, 1, 0, 1, 1);
    edge(bl, br, 0, 1, 1, 1);
    edge(tl, bl, 0, 0, 0, 1);
    if (p.length === 4) return stroke(p[0], p[1], p[2], p[3]);
    return p.length ? "+" : "";
  }

  // The first grid line of spacing `stepR` inside a cell, as a glyph.
  function gridLine(tl, tr, bl, br, stepR, limit) {
    const lv = Math.ceil(Math.min(tl, tr, bl, br) / stepR) * stepR;
    if (lv > Math.max(tl, tr, bl, br) || Math.abs(lv) >= limit) return "";
    return contour(tl, tr, bl, br, lv);
  }

  // A border between two countries, from the countries at the cell corners.
  // It leaves the cell through each edge whose two corners differ, so the
  // box-drawing glyph with arms on those edges joins up with its neighbours.
  // Indexed by top·1 + right·2 + bottom·4 + left·8.
  const ARMS = "   └ │┌├ ┘─┴┐┤┬┼";
  function border(tl, tr, bl, br) {
    const arms = (tl && tr && tl !== tr ? 1 : 0) | (tr && br && tr !== br ? 2 : 0) | (bl && br && bl !== br ? 4 : 0) | (tl && bl && tl !== bl ? 8 : 0);
    return ARMS[arms].trim();
  }

  function niceKm(x) {
    const p = Math.pow(10, Math.floor(Math.log10(x)));
    const m = x / p;
    return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p;
  }

  FIGURES.globe = {
    fps: 15,
    init: function (s) {
      s.lat = 0.38;
      s.lon = (HOME.lon + 25) * D;
      s.zoom = 1;
      s.spin = true;
      s.vlon = s.vlat = 0;
      s.target = null;
      s.fly = null;
      s.pointers = new Map();
      s.hover = null;
      s.engaged = false;
      s.tap = null;
      s.t = -1;
      s.cols = s.rows = 0;
      s.world = null;
      s.el = null;
      s.touch = "";
    },
    busy: function (s) {
      return !!(s.fly || s.target || s.vlon || s.vlat);
    },
    bind: function (el, s, redraw) {
      s.el = el;
      const fig = el.parentNode;

      // The map is fetched once the globe comes near the screen.
      const near = new IntersectionObserver(function (entries) {
        if (!entries.some(function (e) { return e.isIntersecting; })) return;
        near.disconnect();
        loadWorld(function (world) {
          s.world = world;
          redraw();
        });
      }, { rootMargin: "600px" });
      near.observe(el);

      function local(e) {
        const r = el.getBoundingClientRect();
        return [e.clientX - r.left, e.clientY - r.top];
      }
      function takeOver() {
        s.spin = false;
        s.fly = null;
      }

      // Holding the globe pauses its spin. Dragging or clicking it stops the
      // spin for good, while a swipe that turns into a page scroll does not.
      el.addEventListener("pointerdown", function (e) {
        if (!s.cols || e.button !== 0) return;
        const p = local(e);
        s.fly = null;
        s.target = null;
        s.vlon = s.vlat = 0;
        s.engaged = true;
        s.hover = p;
        el.setPointerCapture(e.pointerId);
        s.pointers.set(e.pointerId, { x: p[0], y: p[1], x0: p[0], y0: p[1], t: e.timeStamp });
        el.classList.add("grabbing");
        redraw();
      });

      el.addEventListener("pointermove", function (e) {
        if (!s.cols) return;
        const p = local(e);
        const ptr = s.pointers.get(e.pointerId);
        s.hover = p;
        if (ptr) s.spin = false;
        if (ptr && s.pointers.size === 1) {
          const d = turn(s, p[0] - ptr.x, p[1] - ptr.y);
          const dt = Math.max(8, e.timeStamp - ptr.t) / 1000;
          s.vlon = s.vlon * 0.5 + (d[0] / dt) * 0.5;
          s.vlat = s.vlat * 0.5 + (d[1] / dt) * 0.5;
        } else if (ptr) {
          // Two fingers: the distance between them zooms and their midpoint pans.
          let other = null;
          s.pointers.forEach(function (o, id) { if (id !== e.pointerId) other = o; });
          const d0 = Math.hypot(ptr.x - other.x, ptr.y - other.y);
          const d1 = Math.hypot(p[0] - other.x, p[1] - other.y);
          turn(s, (p[0] - ptr.x) / 2, (p[1] - ptr.y) / 2);
          if (d0 > 0) zoomAt(s, (s.zoom * d1) / d0, (p[0] + other.x) / 2, (p[1] + other.y) / 2);
          s.vlon = s.vlat = 0;
        }
        if (ptr) {
          ptr.x = p[0];
          ptr.y = p[1];
          ptr.t = e.timeStamp;
        }
        redraw();
      });

      function release(e) {
        const ptr = s.pointers.get(e.pointerId);
        if (!ptr) return;
        s.pointers.delete(e.pointerId);
        if (!s.pointers.size) el.classList.remove("grabbing");
        if (e.timeStamp - ptr.t > 80 || s.pointers.size || reducedMQ.matches) s.vlon = s.vlat = 0;
        // Two taps in the same place zoom in on it.
        if (e.type === "pointerup" && Math.hypot(ptr.x - ptr.x0, ptr.y - ptr.y0) < 6) {
          s.spin = false;
          s.vlon = s.vlat = 0;
          if (s.tap && e.timeStamp - s.tap.t < 350 && Math.hypot(ptr.x - s.tap.x, ptr.y - s.tap.y) < 16) {
            zoomTo(s, (s.target ? s.target.zoom : s.zoom) * 2, ptr.x, ptr.y);
            s.tap = null;
          } else {
            s.tap = { t: e.timeStamp, x: ptr.x, y: ptr.y };
          }
        }
        redraw();
      }
      el.addEventListener("pointerup", release);
      el.addEventListener("pointercancel", release);
      el.addEventListener("pointerleave", function (e) {
        if (e.pointerType !== "mouse") return;
        s.hover = null;
        s.engaged = false;
        redraw();
      });

      // The wheel zooms once the globe has been clicked, so scrolling past it
      // still scrolls the page. A pinch on a trackpad arrives as a wheel with
      // ctrlKey and always zooms.
      el.addEventListener("wheel", function (e) {
        if (!s.cols || (!e.ctrlKey && !s.engaged)) return;
        const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
        const from = s.target ? s.target.zoom : s.zoom;
        if (!e.ctrlKey && ((dy > 0 && from <= 1) || (dy < 0 && from >= ZMAX))) return;
        e.preventDefault();
        takeOver();
        const p = local(e);
        zoomTo(s, from * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.003)), p[0], p[1]);
        redraw();
      }, { passive: false });

      fig.querySelectorAll("[data-globe]").forEach(function (button) {
        button.addEventListener("click", function () {
          if (!s.cols) return;
          const what = button.getAttribute("data-globe");
          const v = view(s);
          takeOver();
          if (what === "home") flyHome(s);
          else zoomTo(s, (s.target ? s.target.zoom : s.zoom) * (what === "in" ? 2 : 0.5), v.cx, v.cy);
          redraw();
        });
      });
    },
    draw: function (s, g, t, still) {
      const dt = s.t < 0 ? 0 : Math.max(0, Math.min(0.1, t - s.t));
      s.t = t;
      s.cols = g.cols;
      s.rows = g.rows;
      step(s, dt, still);
      // Zoomed out, a vertical swipe scrolls the page. Zoomed in, every drag
      // moves the map.
      const touch = s.zoom > 1.01 ? "none" : "pan-y";
      if (s.el && s.touch !== touch) s.el.style.touchAction = s.touch = touch;

      for (let x = 0; x < g.cols; x += 4) {
        g.put(x, 0, "╷", 3);
        g.put(x + 1, 0, String((x / 4) * 2 + 1).padStart(2, "0"), 2);
      }

      const v = view(s);
      const world = s.world;
      const top = v.top, rows = v.bottom - v.top, cols = g.cols, CN = cols + 1;

      // Every cell corner on the globe: where it falls and in which country.
      // The grid and the borders are traced between corners.
      const n = CN * (rows + 1);
      const cLat = new Float64Array(n), cLon = new Float64Array(n), cC = new Uint8Array(n);
      for (let j = 0; j <= rows; j++) {
        for (let i = 0; i <= cols; i++) {
          const k = j * CN + i;
          const x = (i * CW - v.cx) / v.R, y = (v.cy - (top + j) * LH) / v.R;
          const rr = x * x + y * y;
          if (rr > 1) continue;
          const z = Math.sqrt(1 - rr);
          cLat[k] = Math.asin(z * v.sin0 + y * v.cos0);
          cLon[k] = wrapAngle(v.lon0 + Math.atan2(x, z * v.cos0 - y * v.sin0));
          if (world) cC[k] = countryAt(world, cLat[k], cLon[k]);
        }
      }

      const L = world ? levelFor(world, v.R) : null;
      let gridStep = GRID_STEPS[0];
      for (let i = 0; i < GRID_STEPS.length && GRID_STEPS[i] * D * v.R >= 56; i++) gridStep = GRID_STEPS[i];
      const gridR = gridStep * D;
      const borders = world && s.zoom >= 3;

      // Each cell is shaded by the light on the sphere at its middle. Sea is
      // the cell's background and land is drawn over it in quarter blocks.
      // On the rim, the quarters inside the disc take the colour of whichever
      // of the two covers more of them.
      for (let j = 0; j < rows; j++) {
        const row = top + j;
        for (let i = 0; i < cols; i++) {
          let inBits = 0, landBits = 0;
          for (let q = 0; q < 4; q++) {
            const x = ((i + (q & 1 ? 0.75 : 0.25)) * CW - v.cx) / v.R;
            const y = (v.cy - (row + (q & 2 ? 0.75 : 0.25)) * LH) / v.R;
            const rr = x * x + y * y;
            if (rr > 1) continue;
            inBits |= 8 >> q;
            if (!L) continue;
            const z = Math.sqrt(1 - rr);
            if (landAt(L, Math.asin(z * v.sin0 + y * v.cos0), v.lon0 + Math.atan2(x, z * v.cos0 - y * v.sin0)) >= 0.5) landBits |= 8 >> q;
          }
          if (!inBits) continue;

          const mx = ((i + 0.5) * CW - v.cx) / v.R, my = (v.cy - (row + 0.5) * LH) / v.R;
          const mz = Math.sqrt(Math.max(0, 1 - mx * mx - my * my));
          const lit = Math.max(0, Math.min(1, (mx * LIGHT[0] + my * LIGHT[1] + mz * LIGHT[2] + 0.3) / 1.3));
          const glint = Math.pow(Math.max(0, mx * GLINT[0] + my * GLINT[1] + mz * GLINT[2]), 40);
          const dither = BAYER[(row & 3) * 4 + (i & 3)];
          const land = "l" + Math.min(15, Math.floor(lit * 15 + dither));
          const sea = "s" + Math.min(15, Math.floor(Math.min(1, lit * 0.85 + glint * 0.5) * 15 + dither));

          if (inBits !== 15) {
            const onLand = QUAD_COUNT[landBits] * 2 >= QUAD_COUNT[inBits];
            g.put(i, row, QUADS[inBits], cls(onLand ? land + " lf" : sea + " sf"));
            continue;
          }
          const tl = j * CN + i, tr = tl + 1, bl = tl + CN, br = bl + 1;
          if (landBits === 15 && borders) {
            const b = border(cC[tl], cC[tr], cC[bl], cC[br]);
            if (b) {
              g.put(i, row, b, cls(land + " lb cut"));
              continue;
            }
          }
          if (landBits) {
            g.put(i, row, QUADS[landBits], cls(sea + " " + land + " sb lf"));
            continue;
          }
          // The grid fades out before the rim, where its lines crowd together.
          let line = "";
          if (1 - mx * mx - my * my >= 0.2) {
            const par = gridLine(cLat[tl], cLat[tr], cLat[bl], cLat[br], gridR, Math.PI / 2 - 1e-6);
            // Meridians stop short of the poles, where they would bunch up.
            // Longitudes are unwrapped around the top-left corner so a cell on
            // the 180° line reads as one span.
            let mer = "";
            if (Math.max(Math.abs(cLat[tl]), Math.abs(cLat[br])) < 80 * D) {
              const base = cLon[tl];
              mer = gridLine(base, base + wrapAngle(cLon[tr] - base), base + wrapAngle(cLon[bl] - base), base + wrapAngle(cLon[br] - base), gridR, Infinity);
            }
            line = par && mer ? "+" : par || mer;
          }
          g.put(i, row, line || " ", cls(sea + (line ? " sb gr" : " sb")));
        }
      }

      // Zoomed out, the axis through the poles sticks out a little at both
      // ends, where it is not behind the globe.
      const nY = v.cos0, nZ = v.sin0;
      for (let k = 0; k <= 24 && s.zoom < 2; k++) {
        const f = 1 + k * 0.008;
        [1, -1].forEach(function (sign) {
          const py = sign * nY * f, pz = sign * nZ * f;
          if (py * py <= 1 && pz < 0) return;
          const row = Math.floor((v.cy - v.R * py) / LH);
          if (row >= top && row < v.bottom) g.put(Math.floor(v.cx / CW), row, "│", 2);
        });
      }

      // Labels. Home comes first and countries after it, from the largest
      // down. A country label keeps a clear cell to each side and a clear row
      // above and below, and gets the country's name when there is room and
      // its code when there is not.
      const taken = new Uint8Array(g.cols * g.rows);
      function free(col, row, len, rowPad) {
        if (row < top || row >= v.bottom || col < 0 || col + len > g.cols) return false;
        for (let y = Math.max(0, row - rowPad); y <= Math.min(g.rows - 1, row + rowPad); y++) {
          for (let x = Math.max(0, col - 1); x <= Math.min(g.cols - 1, col + len); x++) if (taken[y * g.cols + x]) return false;
        }
        return true;
      }
      function take(col, row, len) {
        for (let x = col; x < col + len; x++) taken[row * g.cols + x] = 1;
      }

      // Home's label goes to the right of its marker, or to the left when it
      // would run off the edge.
      let mark = null;
      const hp = project(v, HOME.lat * D, HOME.lon * D);
      const hCol = Math.floor(hp[0] / CW), hRow = Math.floor(hp[1] / LH);
      if (hp[2] > 0 && hRow >= top && hRow < v.bottom && hCol >= 0 && hCol < g.cols) {
        mark = { col: hCol, row: hRow, from: hCol, to: hCol, text: "" };
        take(hCol, hRow, 1);
        const text = s.zoom >= 8 ? HOME.name : HOME.short;
        const left = hCol - 1 - text.length;
        if (free(hCol + 2, hRow, text.length, 0)) {
          take(hCol + 1, hRow, text.length + 1);
          mark.to = hCol + 1 + text.length;
          mark.text = " " + text;
        } else if (free(left, hRow, text.length, 0)) {
          take(left, hRow, text.length + 1);
          mark.from = left;
          mark.text = text + " ";
        }
      }

      if (world && s.zoom >= 2) {
        for (let k = 0; k < world.bySize.length; k++) {
          const i = world.bySize[k];
          const c = world.countries[i - 1];
          const size = ((c[5] / 6371) * v.R) / CW;
          if (size < 4) break;
          const p = project(v, c[4] * D, c[3] * D);
          if (p[2] < 0.3) continue;
          const name = countryName(world, i);
          const row = Math.floor(p[1] / LH);
          [size >= name.length + 2 ? name : "", c[0]].some(function (text) {
            const col = Math.round(p[0] / CW - text.length / 2);
            if (!text || !free(col, row, text.length, 1)) return false;
            take(col, row, text.length);
            g.put(col, row, text, cls("tag"));
            return true;
          });
        }
      }

      // Home's marker blinks.
      if (mark) {
        const dot = !still && Math.floor(t * 2) % 2 === 0 ? "□" : "■";
        if (mark.from < mark.col) g.put(mark.from, mark.row, mark.text + dot, cls("tag a"));
        else g.put(mark.col, mark.row, dot + mark.text, cls("tag a"));
      }

      // Readings: the scale at the centre, then the country and coordinates
      // under the pointer, or at the centre when there is no pointer.
      const kmPx = 6371 / v.R;
      const km = niceKm(kmPx * CW * 12);
      const len = Math.max(2, Math.round(km / kmPx / CW));
      g.put(0, g.rows - 3, "├" + "─".repeat(len - 2) + "┤ " + km + " km", 2);

      // Over home's marker or its label, the readings are for home.
      const room = g.cols - 17;
      let place = null;
      if (s.hover && mark) {
        const hc = Math.floor(s.hover[0] / CW), hr = Math.floor(s.hover[1] / LH);
        if (hr === mark.row && hc >= mark.from - 1 && hc <= mark.to + 1) place = HOME;
      }
      let at = null;
      if (place) at = [place.lat * D, place.lon * D];
      else if (!s.hover) at = unproject(v, v.cx, v.cy);
      else if (s.hover[1] < v.bottom * LH) at = unproject(v, s.hover[0], s.hover[1]);
      if (at) {
        const i = world ? countryAt(world, at[0], at[1]) : 0;
        let name = i ? countryName(world, i) : "";
        if (place) name = name && place.name.length + name.length + 2 <= room ? place.name + ", " + name : place.name;
        if (name) g.put(0, g.rows - 2, name.slice(0, room), 0);
        g.put(0, g.rows - 1, coords(at[0], at[1]).slice(0, room), 2);
      }
    },
  };

  // ------------------------------------------------------------------- loop ---

  const items = [];
  document.querySelectorAll("[data-figure]").forEach(function (el) {
    const def = FIGURES[el.getAttribute("data-figure")];
    if (!def) return;
    const item = { el: el, def: def, state: {}, cols: 0, rows: 0, visible: false, last: -1, dirty: false };
    def.init(item.state);
    if (def.bind) def.bind(el, item.state, function () { redraw(item); });
    items.push(item);
  });
  if (!items.length) return;

  // A figure that takes input asks for a new frame here. The loop draws it on
  // its next pass. With reduced motion there is no loop, so it is drawn still.
  let pending = 0;
  function redraw(item) {
    item.dirty = true;
    if (!reducedMQ.matches || pending) return;
    pending = requestAnimationFrame(function () {
      pending = 0;
      items.forEach(function (it) {
        if (!it.dirty) return;
        it.dirty = false;
        if (!it.cols) measure(it);
        render(it, STILL_T, true);
      });
    });
  }

  function measure(item) {
    item.cols = Math.max(20, Math.floor(item.el.clientWidth / CW));
    item.rows = Math.max(4, Math.floor(item.el.clientHeight / LH));
  }

  function render(item, t, still) {
    const g = new Grid(item.cols, item.rows);
    item.def.draw(item.state, g, t, still);
    item.el.innerHTML = g.html();
  }

  function renderStill() {
    items.forEach(function (item) {
      measure(item);
      render(item, STILL_T, true);
    });
  }

  let raf = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const t = now / 1000;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.visible) continue;
      // A figure that is moving on its own draws every frame until it settles.
      const busy = item.dirty || (item.def.busy && item.def.busy(item.state));
      if (!busy && t - item.last < 1 / item.def.fps) continue;
      item.last = t;
      item.dirty = false;
      render(item, t, false);
    }
  }

  const io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      const item = items.find(function (it) { return it.el === e.target; });
      if (item) item.visible = e.isIntersecting;
    });
  }, { rootMargin: "80px" });

  function start() {
    cancelAnimationFrame(raf);
    items.forEach(measure);
    if (reducedMQ.matches) renderStill();
    else {
      items.forEach(function (item) { render(item, performance.now() / 1000, false); });
      raf = requestAnimationFrame(frame);
    }
  }

  items.forEach(function (item) { io.observe(item.el); });

  let resizeTimer = 0;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      items.forEach(measure);
      if (reducedMQ.matches) renderStill();
    }, 150);
  });

  document.addEventListener("langchange", function () {
    items.forEach(function (item) {
      if (item.def === FIGURES.addison) item.def.init(item.state);
    });
    if (reducedMQ.matches) renderStill();
  });
  reducedMQ.addEventListener("change", start);

  const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(start);
})();
