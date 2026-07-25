/*
  Vantage ambient node field. Purely decorative. No text, no labels, no data.

  MOUNTING CONTRACT (this is all the wiring pass needs to know):

    1. Add the attribute data-node-field to the hero section:
         <section class="page-hero" data-node-field>
    2. Load this file once per page, anywhere after nav.js:
         <script src="node-field.js" defer></script>

    That is the whole contract. The script finds every [data-node-field],
    inserts its own canvas (aria-hidden, pointer-events none, painted behind
    the hero content), and manages sizing, pausing, and degradation itself.
    Do not add a canvas by hand and do not set z-index on hero children.

    verification.html only: remove the old inline <canvas id="node-field">
    and the inline node-field script block at the bottom of the page when
    wiring this in, otherwise two fields will run on top of each other.

  Behavior, so nobody has to read the implementation:
    - Below a 900px viewport nothing animates and nothing is drawn.
    - prefers-reduced-motion gets one finished static frame, no animation.
    - Pauses when the tab is hidden or the hero is scrolled off screen.
    - Every field on a page shares one animation loop, so extra mounts are
      close to free. Any failure degrades to the plain navy hero.
    - Manual mount if ever needed: window.VantageNodeField.mount(element)
*/
(function () {
  'use strict';

  /* Tuning. The field is meant to read as a quiet system running underneath
     the page, never a screensaver. Life comes from links forming, easing in,
     dissolving, and the occasional pulse traveling an active link. Drift
     speed stays close to the original restrained build on purpose. */
  var MIN_VIEWPORT = 900;      /* px, below this nothing runs at all */
  var GOLD = '201, 168, 76';
  var DENSITY = 26000;         /* px^2 of hero per node */
  var N_MIN = 16, N_MAX = 28;
  var LINK_DIST = 170;         /* px, link forms inside this distance */
  var LINK_ALPHA = 0.12;       /* peak link alpha at zero distance */
  var LINK_EASE = 0.004;       /* per-ms approach rate, so links fade in and out */
  var NODE_ALPHA = 0.32;
  var SPEED_MIN = 4, SPEED_MAX = 9;   /* px per second */
  var TURN_RATE = 1.1;         /* rad per second of heading wander, curved paths */
  var PULSE_ALPHA = 0.42;      /* peak alpha of a traveling pulse dot */
  var PULSE_MIN_GAP = 1900;    /* ms between pulse launches, plus jitter */
  var PULSE_JITTER = 2400;
  var PULSE_MAX = 2;           /* concurrent pulses per field */
  var PULSE_DUR_MIN = 1500, PULSE_DUR_JITTER = 700; /* ms of travel time */
  var DPR_CAP = 2;

  var fields = [];
  var rafId = 0;
  var loopRunning = false;
  var lastT = 0;
  var docVisible = !document.hidden;
  var frameMsAvg = 0;          /* rolling average of per-frame JS cost */
  var reducedQuery = null;
  try { reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch (e) {}
  function reduced() { return !!(reducedQuery && reducedQuery.matches); }
  function wideEnough() { return window.innerWidth >= MIN_VIEWPORT; }

  function Field(host) {
    this.host = host;
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    var s = this.canvas.style;
    s.position = 'absolute';
    s.top = '0'; s.left = '0'; s.right = '0'; s.bottom = '0';
    s.width = '100%'; s.height = '100%';
    s.pointerEvents = 'none';
    s.zIndex = '-1';
    /* isolate keeps the negative z-index canvas above the hero background
       but below the hero content, with no changes to the content markup */
    var hs = getComputedStyle(host);
    if (hs.position === 'static') host.style.position = 'relative';
    host.style.isolation = 'isolate';
    host.insertBefore(this.canvas, host.firstChild);
    this.ctx = this.canvas.getContext('2d');
    this.w = 0; this.h = 0;
    this.n = 0;
    this.nodes = [];
    this.linkA = null;         /* smoothed alpha per node pair */
    this.pulses = [];
    this.nextPulseAt = 0;
    this.onscreen = true;
    this.seeded = false;
    var self = this;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        self.onscreen = es[0].isIntersecting;
        wake();
      }, { threshold: 0 }).observe(this.canvas);
    }
    if ('ResizeObserver' in window) {
      new ResizeObserver(function () { self.resize(); wake(); }).observe(host);
    }
    this.resize();
  }

  Field.prototype.resize = function () {
    if (!this.ctx) return;
    if (!wideEnough()) {
      /* mobile does zero work: no backing store, no draw, no battery */
      if (this.canvas.width) { this.canvas.width = 0; this.canvas.height = 0; }
      this.seeded = false;
      return;
    }
    var r = this.host.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) {
      /* host not laid out yet, wake() retries once it has real size */
      if (this.canvas.width) { this.canvas.width = 0; this.canvas.height = 0; }
      this.seeded = false;
      return;
    }
    var dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    this.w = r.width; this.h = r.height;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.seed();
    this.draw(reduced());     /* always leave a finished frame on the canvas */
  };

  Field.prototype.seed = function () {
    this.n = Math.max(N_MIN, Math.min(N_MAX, Math.round(this.w * this.h / DENSITY)));
    this.nodes = [];
    for (var i = 0; i < this.n; i++) {
      this.nodes.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        a: Math.random() * 6.2832,                        /* heading */
        s: SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN),
        r: 1.2 + Math.random() * 1.6
      });
    }
    this.linkA = new Float32Array(this.n * this.n);
    this.pulses = [];
    this.nextPulseAt = 0;
    this.seeded = true;
  };

  Field.prototype.active = function () {
    return this.seeded && docVisible && this.onscreen && wideEnough() && !reduced();
  };

  Field.prototype.step = function (dt, t) {
    var i, j, k, n;
    var sec = dt / 1000;
    for (i = 0; i < this.n; i++) {
      n = this.nodes[i];
      n.a += (Math.random() - 0.5) * TURN_RATE * sec * 2;
      n.x += Math.cos(n.a) * n.s * sec;
      n.y += Math.sin(n.a) * n.s * sec;
      if (n.x < -12) n.x = this.w + 12; else if (n.x > this.w + 12) n.x = -12;
      if (n.y < -12) n.y = this.h + 12; else if (n.y > this.h + 12) n.y = -12;
    }
    /* ease each pair's link alpha toward its distance target, which is what
       makes links visibly form and dissolve instead of popping */
    var ease = Math.min(1, dt * LINK_EASE);
    for (i = 0; i < this.n; i++) {
      for (j = i + 1; j < this.n; j++) {
        var dx = this.nodes[i].x - this.nodes[j].x;
        var dy = this.nodes[i].y - this.nodes[j].y;
        var d = Math.sqrt(dx * dx + dy * dy);
        var target = d < LINK_DIST ? LINK_ALPHA * (1 - d / LINK_DIST) : 0;
        k = i * this.n + j;
        this.linkA[k] += (target - this.linkA[k]) * ease;
      }
    }
    /* occasionally send a pulse along a currently strong link */
    if (this.nextPulseAt === 0) this.nextPulseAt = t + PULSE_MIN_GAP + Math.random() * PULSE_JITTER;
    if (t >= this.nextPulseAt && this.pulses.length < PULSE_MAX) {
      var candidates = [];
      for (i = 0; i < this.n; i++) {
        for (j = i + 1; j < this.n; j++) {
          if (this.linkA[i * this.n + j] > 0.055) candidates.push([i, j]);
        }
      }
      if (candidates.length) {
        var pick = candidates[(Math.random() * candidates.length) | 0];
        this.pulses.push({ i: pick[0], j: pick[1], start: t,
          dur: PULSE_DUR_MIN + Math.random() * PULSE_DUR_JITTER });
      }
      this.nextPulseAt = t + PULSE_MIN_GAP + Math.random() * PULSE_JITTER;
    }
    for (i = this.pulses.length - 1; i >= 0; i--) {
      if (t - this.pulses[i].start >= this.pulses[i].dur) this.pulses.splice(i, 1);
    }
    this.draw(false, t);
  };

  /* statically true, computes targets directly for the one-shot static frame */
  Field.prototype.draw = function (statically, t) {
    var ctx = this.ctx, i, j, a;
    ctx.clearRect(0, 0, this.w, this.h);
    for (i = 0; i < this.n; i++) {
      for (j = i + 1; j < this.n; j++) {
        if (statically) {
          var dx = this.nodes[i].x - this.nodes[j].x;
          var dy = this.nodes[i].y - this.nodes[j].y;
          var d = Math.sqrt(dx * dx + dy * dy);
          a = d < LINK_DIST ? LINK_ALPHA * (1 - d / LINK_DIST) : 0;
        } else {
          a = this.linkA[i * this.n + j];
        }
        if (a < 0.008) continue;
        ctx.strokeStyle = 'rgba(' + GOLD + ',' + a.toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.nodes[i].x, this.nodes[i].y);
        ctx.lineTo(this.nodes[j].x, this.nodes[j].y);
        ctx.stroke();
      }
    }
    ctx.fillStyle = 'rgba(' + GOLD + ',' + NODE_ALPHA + ')';
    for (i = 0; i < this.n; i++) {
      ctx.beginPath();
      ctx.arc(this.nodes[i].x, this.nodes[i].y, this.nodes[i].r, 0, 6.2832);
      ctx.fill();
    }
    if (!statically && t) {
      for (i = 0; i < this.pulses.length; i++) {
        var p = this.pulses[i];
        var f = (t - p.start) / p.dur;
        if (f < 0 || f > 1) continue;
        var e = f * f * (3 - 2 * f);                       /* smoothstep travel */
        var env = Math.sin(3.1416 * f);                    /* fade in and out */
        var na = this.nodes[p.i], nb = this.nodes[p.j];
        var px = na.x + (nb.x - na.x) * e;
        var py = na.y + (nb.y - na.y) * e;
        ctx.strokeStyle = 'rgba(' + GOLD + ',' + (0.05 * env).toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y); ctx.stroke();
        ctx.fillStyle = 'rgba(' + GOLD + ',' + (PULSE_ALPHA * env).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(px, py, 1.5, 0, 6.2832); ctx.fill();
      }
    }
  };

  /* one shared loop for every field on the page */
  function tick(t) {
    rafId = requestAnimationFrame(tick);
    var dt = lastT ? Math.min(t - lastT, 50) : 16;
    lastT = t;
    var t0 = performance.now();
    var any = false;
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].active()) { fields[i].step(dt, t); any = true; }
    }
    frameMsAvg = frameMsAvg * 0.95 + (performance.now() - t0) * 0.05;
    if (!any) {
      loopRunning = false;
      lastT = 0;
      cancelAnimationFrame(rafId);
    }
  }

  function wake() {
    /* re-arm any field that missed its first layout, then start the loop */
    for (var j = 0; j < fields.length; j++) {
      if (!fields[j].seeded && wideEnough()) fields[j].resize();
    }
    if (loopRunning || reduced()) return;
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].active()) {
        loopRunning = true;
        lastT = 0;
        rafId = requestAnimationFrame(tick);
        return;
      }
    }
  }

  function mount(host) {
    try {
      if (!host || host.__vnfMounted) return null;
      host.__vnfMounted = true;
      var f = new Field(host);
      if (!f.ctx) return null;
      fields.push(f);
      wake();
      return f;
    } catch (e) { return null; /* decorative only, fail to the plain hero */ }
  }

  function init() {
    try {
      var hosts = document.querySelectorAll('[data-node-field]');
      for (var i = 0; i < hosts.length; i++) mount(hosts[i]);
      document.addEventListener('visibilitychange', function () {
        docVisible = !document.hidden;
        wake();
      });
      window.addEventListener('resize', function () {
        for (var i = 0; i < fields.length; i++) fields[i].resize();
        wake();
      });
      /* fonts and images settle hero height after DOMContentLoaded */
      window.addEventListener('load', function () {
        for (var i = 0; i < fields.length; i++) fields[i].resize();
        wake();
      });
      if (reducedQuery && reducedQuery.addEventListener) {
        reducedQuery.addEventListener('change', function () {
          for (var i = 0; i < fields.length; i++) fields[i].resize();
          wake();
        });
      }
    } catch (e) { /* decorative only */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.VantageNodeField = {
    mount: mount,
    fields: fields,
    stats: function () {
      var act = 0;
      for (var i = 0; i < fields.length; i++) if (fields[i].active()) act++;
      return { fields: fields.length, activeFields: act, frameMsAvg: frameMsAvg, looping: loopRunning };
    }
  };
})();
