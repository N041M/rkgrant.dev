// Small animated plots drawn as text: one per project card and a globe in the
// contact section. Each <pre data-figure="name"> is redrawn only while it is on
// screen, and drawn once when reduced motion is on.
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
  const CLS = ["", "a", "d", "g", "i", "ai"];

  function Grid(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.ch = new Array(cols * rows).fill(" ");
    this.cl = new Uint8Array(cols * rows);
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

  // Contact: a globe drawn with ticks, turning slowly, with Jablonec nad Nisou
  // marked. A numbered ruler runs along the top.
  const HOME = { lat: 50.7243, lon: 15.1711 };
  FIGURES.globe = {
    fps: 15,
    init: function () {},
    draw: function (s, g, t) {
      for (let x = 0; x < g.cols; x++) {
        if (x % 4 === 0) {
          g.put(x, 0, "╷", 3);
          g.put(x + 1, 0, String((x / 4) * 2 + 1).padStart(2, "0"), 2);
        }
      }
      const bottomRows = 3;
      const areaH = (g.rows - 1 - bottomRows) * LH;
      const cx = (g.cols * CW) / 2;
      const cy = LH + areaH / 2;
      const R = Math.min(g.cols * CW, areaH) * 0.44;
      const rot = t * 0.22;
      const tilt = 0.38;
      const ct = Math.cos(tilt), st = Math.sin(tilt);
      const zbuf = new Float32Array(g.cols * g.rows).fill(-2);

      function project(lat, lon) {
        const x = Math.cos(lat) * Math.sin(lon + rot);
        const y = Math.sin(lat);
        const z = Math.cos(lat) * Math.cos(lon + rot);
        return [cx + R * x, cy - R * (y * ct - z * st), y * st + z * ct];
      }

      // Axis through the poles, drawn first so the globe covers it.
      const north = project(Math.PI / 2, 0);
      const south = project(-Math.PI / 2, 0);
      const axc = Math.floor(north[0] / CW);
      for (let y = Math.floor(north[1] / LH) - 2; y <= Math.floor(south[1] / LH) + 2; y++) {
        if (y > 0 && y < g.rows - bottomRows) g.put(axc, y, "│", 2);
      }

      function plot(a, b) {
        const col = Math.floor(a[0] / CW), row = Math.floor(a[1] / LH);
        if (col < 0 || col >= g.cols || row < 1 || row >= g.rows - bottomRows) return;
        const i = row * g.cols + col;
        const z = a[2];
        if (z <= zbuf[i]) return;
        zbuf[i] = z;
        if (z < 0) {
          g.put(col, row, "·", 3);
          return;
        }
        const ang = Math.atan2(Math.abs(b[1] - a[1]), Math.abs(b[0] - a[0]) + 1e-6);
        let chr = ang > 1.1 ? "│" : ang > 0.45 ? "¦" : "╷";
        if (z > 0.8 && ang > 0.45) chr = "┃";
        g.put(col, row, chr, z > 0.35 ? 0 : 2);
      }

      const D = Math.PI / 180;
      for (let lat = -60; lat <= 60; lat += 30) {
        let prev = project(lat * D, 0);
        for (let k = 1; k <= 240; k++) {
          const cur = project(lat * D, (k / 240) * Math.PI * 2);
          plot(prev, cur);
          prev = cur;
        }
      }
      for (let lon = 0; lon < 360; lon += 45) {
        let prev = project(-90 * D, lon * D);
        for (let k = 1; k <= 120; k++) {
          const cur = project((-90 + (k / 120) * 180) * D, lon * D);
          plot(prev, cur);
          prev = cur;
        }
      }

      const home = project(HOME.lat * D, HOME.lon * D);
      if (home[2] > 0) {
        const col = Math.floor(home[0] / CW), row = Math.floor(home[1] / LH);
        g.put(col, row, Math.floor(t * 2) % 2 ? "■" : "□", 1);
        g.put(col + 2, row, "JBC", 1);
      }

      // A strip of readings under the globe.
      const w = Math.floor(g.cols * 0.7);
      const x0 = Math.floor((g.cols - w) / 2);
      for (let r = 0; r < bottomRows - 1; r++) {
        for (let x = 0; x < w; x++) {
          const h = hash(x + Math.floor(t * 3) * 7, r + 11);
          if (h < 0.55) g.put(x0 + x, g.rows - bottomRows + 1 + r, ":|╷·!:.'"[Math.floor(h * 14.5) % 8], h < 0.08 ? 0 : 2);
        }
      }
    },
  };

  // ------------------------------------------------------------------- loop ---

  const items = [];
  document.querySelectorAll("[data-figure]").forEach(function (el) {
    const def = FIGURES[el.getAttribute("data-figure")];
    if (!def) return;
    const item = { el: el, def: def, state: {}, cols: 0, rows: 0, visible: false, last: -1 };
    def.init(item.state);
    items.push(item);
  });
  if (!items.length) return;

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
      if (t - item.last < 1 / item.def.fps) continue;
      item.last = t;
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
