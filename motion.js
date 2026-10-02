/* Vantage FP&A site motion, direction 7. The render is a program: every mover exposes seek(t) in seconds.
   No timers and no Math.random. The live page drives seek(t) from requestAnimationFrame;
   a capture harness calls window.seek(t) / window.seekAll(t) directly. */
(function () {
  'use strict';
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CAPTURE = /[?&]capture=1/.test(location.search);

  // Critically damped spring step response, closed form. 0 before t0, 1 at rest.
  // SETTLED is true only inside settle(): every spring that has started reads exactly 1, so the final
  // frame lands every figure on its data-value (round 5, V1; the closed form never reaches 1 on its own).
  var SETTLED = false;
  function sp(t, t0, w) { var d = t - t0; if (d <= 0) return 0; if (SETTLED) return 1; w = w || 10; return 1 - (1 + w * d) * Math.exp(-w * d); }
  // Underdamped spring (overshoot) for chips popping in. zeta 0.62.
  function spU(t, t0, w) { var d = t - t0; if (d <= 0) return 0; if (SETTLED) return 1; w = w || 14; var z = 0.62, wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * d) * (Math.cos(wd * d) + (z * w / wd) * Math.sin(wd * d)); }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function fmt(n) { n = Math.round(n); return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function money(n) { return '$' + fmt(n); }

  var movers = []; // {el, seek(t), dur, started, t0}
  function register(el, seek, dur) { var m = { el: el, seek: seek, dur: dur, started: false, t0: 0, done: false }; movers.push(m); seek(0); return m; }

  /* ---------- HERO (home): two panels, left then right ---------- */
  function buildHero(root) {
    if (!root || !root.querySelector('h1')) return null;
    var h1 = root.querySelector('h1'), sub = root.querySelector('.hero-sub'), line = root.querySelector('.hero-line'), act = root.querySelector('.hero-actions');
    var frame = root.querySelector('.frame'), srcs = [].slice.call(root.querySelectorAll('.source'));
    var lines = [].slice.call(root.querySelectorAll('h1 .line'));
    var panels = [].slice.call(root.querySelectorAll('.panel')).map(function (p, idx) {
      var cols = [].slice.call(p.querySelectorAll('.col')), max = 0, floor = 0;
      cols.forEach(function (c) { max = Math.max(max, +c.dataset.value + (+c.dataset.base || 0)); if (c.dataset.floor) floor = +c.dataset.floor; });
      var total = p.querySelector('.total-chip');
      return { el: p, cols: cols, joined: !!p.querySelector('.cols.joined'), max: max, base: p.querySelector('.baseline'), sweep: p.querySelector('.sweep'), title: p.querySelector('.chart-title'),
        total: total, totalVals: total && !total.classList.contains('static') ? [].slice.call(total.querySelectorAll('b')) : [], floor: floor, start: idx === 0 ? 0.1 : 1.7 };
    });
    function rise(el, p, px) { if (!el) return; el.style.opacity = p; el.style.transform = 'translateY(' + ((1 - p) * (px || 18)) + 'px)'; }
    function seek(t) {
      if (frame) frame.style.opacity = clamp01(sp(t, 0.0, 9) * 1.1);
      if (lines.length) { lines.forEach(function (l, i) { rise(l, sp(t, 0.1 + i * 0.18, 9), 22); }); if (h1) h1.style.opacity = 1; }
      else rise(h1, sp(t, 0.1, 9));
      rise(sub, sp(t, 0.5, 9)); rise(line, sp(t, 0.65, 9)); rise(act, sp(t, 0.8, 9), 14);
      panels.forEach(function (P) {
        var s0 = P.start;
        // the gold line draws the baseline, then the columns grow out of it
        if (P.base) P.base.style.transform = 'scaleX(' + sp(t, s0, 6) + ')';
        if (P.sweep) { P.sweep.style.transform = 'scaleX(' + sp(t, s0, 6) + ')'; P.sweep.style.opacity = clamp01(1 - sp(t, s0 + 2.4, 4)); }
        if (P.title) P.title.style.opacity = sp(t, s0 + 0.2, 8);
        P.cols.forEach(function (c, i) {
          var t0 = s0 + 0.4 + i * 0.26, v = +c.dataset.value, p = sp(t, t0, 7), fl = P.floor, base = +c.dataset.base || 0;
          var hgt = ((v - fl) / (P.max - fl)) * 100 * p, off = (base / (P.max - fl)) * 100;
          if (P.joined) { hgt = 100 * p; base = 0; off = 0; }   /* one connected bar, every segment the same height (Nic 2026-10-01 19:28 CT) */
          var bar = c.querySelector('.bar'), chip = c.querySelector('.chip'), b = chip.querySelector('b'), pre = c.dataset.prefix || '', suf = c.dataset.suffix || '';
          bar.style.height = hgt + '%'; bar.style.opacity = clamp01(p * 4);
          if (base) { bar.style.position = 'relative'; bar.style.bottom = off + '%'; }
          var pc = spU(t, t0 + 0.4, 13);
          chip.style.opacity = clamp01(pc * 1.5); chip.style.transform = 'translateY(' + (-((hgt + (base ? off : 0)) / 100) * c.clientHeight - chip.offsetHeight - 12) + 'px) scale(' + (0.9 + 0.1 * pc) + ')';
          // the label reads the bar's own current value (same progress p as the height), so a label
          // never contradicts its bar mid-animation (round 4, C10)
          var shown = fl + (v - fl) * p;
          b.textContent = pre + (c.dataset.decimals ? shown.toFixed(+c.dataset.decimals) : fmt(shown)) + suf;
        });
        if (P.total) { var pt = spU(t, s0 + 1.9, 12); P.total.style.opacity = clamp01(pt * 1.4); P.total.style.transform = 'translateY(' + ((1 - clamp01(pt)) * 12) + 'px)';
          P.totalVals.forEach(function (b) { b.textContent = fmt((+b.dataset.value) * sp(t, s0 + 1.9, 5)); }); }
      });
      srcs.forEach(function (s, i) { s.style.opacity = sp(t, 4.2 + i * 0.15, 7); });
    }
    return register(root, seek, 6.0);
  }

  /* ---------- HORIZONTAL BARS ---------- */
  function buildHBars(el) {
    var rows = [].slice.call(el.querySelectorAll('.hb')), max = 0;
    rows.forEach(function (r) { max = Math.max(max, +r.dataset.value); });
    var stagger = +el.dataset.stagger || 0.12, dur = 0.9 + rows.length * stagger;
    function seek(t) {
      rows.forEach(function (r, i) {
        var v = +r.dataset.value, p = sp(t, i * stagger, 8), fill = r.querySelector('.fill'), val = r.querySelector('.val');
        fill.style.width = (v / max * 100) + '%'; fill.style.transform = 'scaleX(' + p + ')';
        var pre = r.dataset.prefix || '', suf = r.dataset.suffix || '';
        if (r.dataset.decimals) { val.textContent = pre + (v * p).toFixed(+r.dataset.decimals) + suf; }
        else { val.textContent = pre + fmt(v * p) + suf; }
        val.style.opacity = clamp01(p * 1.5);
      });
    }
    return register(el, seek, dur);
  }

  /* ---------- EBITDA BRIDGE (3 columns: reported, add-backs, adjusted) ---------- */
  function buildBridge(el) {
    var cols = [].slice.call(el.querySelectorAll('.bcol')), max = 0;
    cols.forEach(function (c) { max = Math.max(max, +c.dataset.top); });
    function seek(t) {
      cols.forEach(function (c, i) {
        var p = sp(t, i * 0.35, 8), top = +c.dataset.top, bottom = +c.dataset.bottom || 0, v = +c.dataset.value;
        var bar = c.querySelector('.bbar'), val = c.querySelector('.bval');
        var hPx = ((top - bottom) / max) * 96 * p, offset = (bottom / max) * 96 * p;
        bar.style.height = hPx + 'px'; bar.style.marginBottom = offset + 'px';
        val.textContent = (c.dataset.sign || '') + money(Math.abs(v) * p); val.style.opacity = clamp01(p * 1.5);
      });
    }
    return register(el, seek, 2.2);
  }

  /* ---------- TRIGGER FLOW (svg, draws arrows and boxes in order) ---------- */
  function buildFlow(el) {
    var steps = [].slice.call(el.querySelectorAll('[data-step]'));
    var lines = [].slice.call(el.querySelectorAll('path.fline, line.fline'));
    lines.forEach(function (l) { var L = l.getTotalLength ? l.getTotalLength() : 100; l.dataset.len = L; l.style.strokeDasharray = L; });
    function seek(t) {
      steps.forEach(function (s) {
        var k = +s.dataset.step, p = sp(t, k * 0.32, 9);
        if (s.tagName.toLowerCase() === 'g') { s.style.opacity = clamp01(p * 1.4); s.style.transform = 'translateY(' + ((1 - p) * 6) + 'px)'; }
        else if (s.classList.contains('fline')) { s.style.strokeDashoffset = (+s.dataset.len) * (1 - p); }
        else { s.style.opacity = clamp01(p * 1.4); }
      });
    }
    return register(el, seek, 0.32 * steps.length + 0.9);
  }

  /* ---------- STEPS (trace chain: nodes rise, links draw, in order) ---------- */
  function buildSteps(el) {
    var steps = [].slice.call(el.querySelectorAll('[data-step]'));
    function seek(t) {
      steps.forEach(function (s) {
        var k = +s.dataset.step, p = sp(t, 0.15 + k * 0.28, 9);
        if (s.classList.contains('tlink')) { s.style.setProperty('--draw', clamp01(p)); }
        else { s.style.opacity = clamp01(p * 1.4); s.style.transform = 'translateY(' + ((1 - p) * 10) + 'px)'; }
      });
    }
    return register(el, seek, 0.15 + 0.28 * steps.length + 0.9);
  }

  /* ---------- DRIVER ---------- */
  function settle(m) { SETTLED = true; try { m.seek(m.dur + 1); } finally { SETTLED = false; } }
  function finish(m) { settle(m); m.done = true; }
  function now() { return performance.now() / 1000; }
  var raf = null;
  function loop() {
    var live = false, t = now();
    movers.forEach(function (m) { if (m.started && !m.done) { var e = t - m.t0; m.seek(e); if (e >= m.dur + 0.4) finish(m); else live = true; } });
    raf = live ? requestAnimationFrame(loop) : null;
  }
  function start(m) { if (m.started) return; m.started = true; m.t0 = now(); if (!raf) raf = requestAnimationFrame(loop); }

  function init() {
    var hero = buildHero(document.querySelector('.hero'));
    [].forEach.call(document.querySelectorAll('[data-mover="hbars"]'), buildHBars);
    [].forEach.call(document.querySelectorAll('[data-mover="bridge"]'), buildBridge);
    [].forEach.call(document.querySelectorAll('[data-mover="flow"]'), buildFlow);
    [].forEach.call(document.querySelectorAll('[data-mover="steps"]'), buildSteps);

    window.seek = function (t) { if (hero) hero.seek(t); };
    window.seekAll = function (t) { movers.forEach(function (m) { m.seek(t); }); };
    window.__movers = movers;

    movers.forEach(function (m) { if (m !== hero && m.el.getClientRects().length === 0) finish(m); });
    if (REDUCED || CAPTURE) { movers.forEach(finish); if (CAPTURE && hero) hero.seek(0); return; }
    if (hero) {
      if (document.documentElement.classList.contains('intro-on')) {
        var go = function () { start(hero); };
        window.addEventListener('vfpa:intro-reveal', go, { once: true });
        setTimeout(go, 4500); /* the intro can never hold the hero back */
      } else start(hero);
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { var m = movers.filter(function (x) { return x.el === e.target; })[0]; if (m) { start(m); io.unobserve(e.target); } } }); }, { threshold: 0.35 });
      movers.forEach(function (m) { if (m !== hero) io.observe(m.el); });
    } else { movers.forEach(finish); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.addEventListener('resize', function () { movers.forEach(function (m) { if (m.done) settle(m); }); });
})();
