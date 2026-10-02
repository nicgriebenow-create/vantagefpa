/* Vantage FP&A home intro, v3 (direction 7). On the navy ground of the approved
   orb_to_wordmark film: a gold cell and a teal cell let go of their links, their
   nodes fly into the Vantage FP&A wordmark in gold and teal only, a gold rule
   comes in from the right, the wordmark travels into the nav logo slot and lands
   there while the navy still covers the page, then the navy fades evenly to the
   hero. No moving edge ever crosses the page, so no line of the h1 is ever shown
   cut, and the slot is never seen empty: the canvas wordmark sits in it until the
   overlay goes and the real logo is under it pixel for pixel. About 1.85 s, once
   per session, skippable by click, tap, key, wheel or scroll. prefers-reduced-motion never runs it. seek(t) paints any frame, seeded,
   no Math.random. The page is complete in the DOM underneath the whole time, and
   the CSS injected below drops the veil at 2.6 s and the overlay at 3.2 s even if
   this script stalls, so the intro can never gate the content. */
(function () {
  'use strict';
  var root = document.documentElement, Q = location.search, KEY = 'vfpa-intro', seen = null;
  var frozen = /[?&]introAt=([\d.]+)/.exec(Q);
  try { seen = sessionStorage.getItem(KEY); } catch (e) {}
  if (!frozen && (seen || location.hash || /[?&](capture|nointro)=1/.test(Q) ||
      (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches))) return;
  var css = document.createElement('style');
  css.textContent = 'html.intro-on body::after{content:"";position:fixed;inset:0;background:#0D1F3C;z-index:2147483599;animation:vfpa-ik .2s linear 2.6s forwards}' +
    'html.intro-live body::after{display:none}@keyframes vfpa-ik{to{opacity:0;visibility:hidden}}' +
    '#intro{position:fixed;inset:0;z-index:2147483600;cursor:pointer;animation:vfpa-ik 0s linear 3.2s forwards}#intro.frz{animation:none}' +
    '#intro canvas{display:block}html.intro-live .nav-logo img{opacity:0}';
  (document.head || root).appendChild(css);
  root.classList.add('intro-on');

  var T = { inDur: 0.28, detach: 0.3, edgeFade: 0.25, flow: 0.36, stagger: 0.26, flowDur: 0.48, resolve: 0.94, resolveDur: 0.2,
            rule: 1.0, ruleDur: 0.24, reveal: 0.7, settle: 1.2, settleDur: 0.44, fade: 1.4, fadeDur: 0.42, end: 1.85 };
  var NAVY = [13, 31, 60], GOLD = [201, 168, 76], TEAL = [92, 201, 190], WHITE = [244, 245, 248], PALE = [236, 214, 146], ICE = [185, 196, 216], CEDGE = [150, 222, 214];

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function smooth(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
  function smoother(x) { x = clamp01(x); return x * x * x * (x * (x * 6 - 15) + 10); }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + clamp01(a).toFixed(3) + ')'; }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  var cv, ctx, W, H, img, dark, word, nav, cells, nodes, parts, raf = 0, t0 = 0, done = false, revealed = false;
  function reveal() { if (revealed) return; revealed = true; window.dispatchEvent(new Event('vfpa:intro-reveal')); }
  var EV = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];
  function finish() {
    if (done) return; done = true;
    if (raf) cancelAnimationFrame(raf);
    var o = document.getElementById('intro');
    if (o && o.parentNode) o.parentNode.removeChild(o);
    root.classList.remove('intro-on', 'intro-live');
    EV.forEach(function (e) { window.removeEventListener(e, finish, true); });
    reveal();
    window.dispatchEvent(new Event('vfpa:intro-done'));
  }

  /* ---------- build: targets from the shipped lockup's own pixels, two cells with one node per target ---------- */
  function build() {
    W = innerWidth; H = innerHeight;
    var D = Math.min(2, devicePixelRatio || 1), mob = W < 700, k, j, x, y;
    cv.width = Math.round(W * D); cv.height = Math.round(H * D); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx = cv.getContext('2d'); ctx.setTransform(D, 0, 0, D, 0, 0);
    var r = img.getBoundingClientRect(); nav = { x: r.left, y: r.top, w: r.width, h: r.height };
    var ww = Math.min(620, W * 0.84), wh = ww * img.naturalHeight / img.naturalWidth;
    word = { x: (W - ww) / 2, y: H * 0.44 - wh / 2, w: ww, h: wh };

    /* the lockup with its navy ink lifted to white, for the navy ground (gold stays gold) */
    dark = document.createElement('canvas'); dark.width = Math.round(ww * D); dark.height = Math.round(wh * D);
    var dc = dark.getContext('2d'); dc.drawImage(img, 0, 0, dark.width, dark.height);
    var id = dc.getImageData(0, 0, dark.width, dark.height), p = id.data;
    for (k = 0; k < p.length; k += 4) if (p[k] - p[k + 2] < 40) { p[k] = WHITE[0]; p[k + 1] = WHITE[1]; p[k + 2] = WHITE[2]; }
    dc.putImageData(id, 0, 0);

    var ow = Math.round(ww), oh = Math.round(wh), off = document.createElement('canvas');
    off.width = ow; off.height = oh;
    var oc = off.getContext('2d'); oc.drawImage(img, 0, 0, ow, oh);
    var px = oc.getImageData(0, 0, ow, oh).data, ink = 0, tg = [];
    for (k = 3; k < px.length; k += 4) if (px[k] > 140) ink++;
    var step = Math.max(2, Math.sqrt(ink / (mob ? 300 : 440)));
    for (y = step / 2; y < oh; y += step) for (x = step / 2; x < ow; x += step) {
      k = ((y | 0) * ow + (x | 0)) * 4;
      if (px[k + 3] > 140) tg.push({ x: word.x + x, y: word.y + y, gold: px[k] - px[k + 2] > 40 });
    }

    /* Vann, the gold cell, upper left; Tage, the teal cell, lower right, as in the film */
    var n = tg.length, nV = Math.round(n * 0.62), RV = mob ? Math.min(W * 0.3, H * 0.17) : Math.min(H * 0.24, W * 0.17, 220);
    var vx = W * (mob ? 0.4 : 0.45), vy = H * (mob ? 0.35 : 0.39);
    cells = [{ x: vx, y: vy, R: RV, col: GOLD, ec: ICE, yaw: 0.5, spin: 0.9 },
             { x: vx + RV * 0.84, y: vy + RV * 0.98, R: RV * 0.64, col: TEAL, ec: CEDGE, yaw: 2.1, spin: -1.2 }];
    nodes = [];
    var rnd = mulberry(20261001), ga = Math.PI * (3 - Math.sqrt(5));
    for (k = 0; k < n; k++) {
      var c = k < nV ? 0 : 1, m = c ? n - nV : nV, i = c ? k - nV : k;
      var yy = 1 - 2 * (i + 0.5) / m, rr = Math.sqrt(1 - yy * yy), th = ga * i, jt = 0.9 + 0.16 * rnd(), h = rnd();
      nodes.push({ c: c, x: Math.cos(th) * rr * jt, y: yy * jt, z: Math.sin(th) * rr * jt, s: 0.8 + 2.2 * h * h * h,
                   hot: h > 0.86, a: rnd() * 6.2832, m: 8 + 22 * rnd() });
    }
    cells.forEach(function (C, ci) {
      C.ed = []; C.pu = [];
      var idx = []; for (k = 0; k < n; k++) if (nodes[k].c === ci) idx.push(k);
      idx.forEach(function (a) {
        var b1 = -1, b2 = -1, d1 = 9, d2 = 9;
        idx.forEach(function (b) { if (a === b) return;
          var dx = nodes[a].x - nodes[b].x, dy = nodes[a].y - nodes[b].y, dz = nodes[a].z - nodes[b].z, d = dx * dx + dy * dy + dz * dz;
          if (d < d1) { d2 = d1; b2 = b1; d1 = d; b1 = b; } else if (d < d2) { d2 = d; b2 = b; } });
        if (b1 > a) C.ed.push([a, b1]); if (b2 > a) C.ed.push([a, b2]);
      });
      var pr = mulberry(7331 + ci);
      for (k = 0; k < (ci ? 10 : 16); k++) C.pu.push({ e: C.ed[(pr() * C.ed.length) | 0], t0: pr() * 0.3, dur: 0.22 + pr() * 0.14 });
    });

    /* pair sources and targets by rank, left to right, so paths cross as little as they can */
    project(T.flow);
    var src = nodes.map(function (q, i) { var d = drift(i, T.flow); return { i: i, key: d[0] + d[1] * 0.25 }; });
    src.sort(function (a, b) { return a.key - b.key; });
    tg.forEach(function (q) { q.key = q.x + (q.y - word.y) * 0.25; });
    tg.sort(function (a, b) { return a.key - b.key; });
    parts = [];
    for (k = 0; k < n; k++) {
      var r2 = mulberry(9001 + k), q = tg[k];
      parts.push({ i: src[k].i, tx: q.x, ty: q.y, tc: q.gold ? GOLD : cells[nodes[src[k].i].c].col,
                   st: T.flow + T.stagger * ((q.x - word.x) / word.w) * 0.8 + r2() * T.stagger * 0.2,
                   bow: (r2() - 0.5) * 0.45, dur: T.flowDur * (0.85 + 0.3 * r2()) });
    }
  }

  function project(t) {
    var cp = Math.cos(0.38), sp = Math.sin(0.38), CAM = 2.8, sc = 0.9 + 0.1 * smooth(t / T.inDur);
    cells.forEach(function (C) { var yw = C.yaw + C.spin * t; C.cy = Math.cos(yw); C.sy = Math.sin(yw); });
    for (var i = 0; i < nodes.length; i++) {
      var q = nodes[i], C = cells[q.c], x1 = q.x * C.cy + q.z * C.sy, z1 = q.z * C.cy - q.x * C.sy, y1 = q.y * cp - z1 * sp, z2 = q.y * sp + z1 * cp;
      var k = CAM / (CAM + z2);
      q.sx = C.x + x1 * k * C.R * sc; q.sy = C.y + y1 * k * C.R * sc; q.dz = z2; q.k = k;
    }
  }
  function drift(i, t) {
    var q = nodes[i], C = cells[q.c];
    if (t <= T.detach) return [q.sx, q.sy];
    var g = Math.pow((t - T.detach) / 0.3, 1.4) * q.m, rx = q.sx - C.x, ry = q.sy - C.y, rl = Math.sqrt(rx * rx + ry * ry) || 1;
    return [q.sx + (rx / rl * 0.8 + Math.cos(q.a) * 0.2) * g, q.sy + (ry / rl * 0.8 + Math.sin(q.a) * 0.2) * g];
  }
  function nodeR(q) { return Math.max(0.9, q.s * q.k * cells[0].R / 95); }
  function nodeA(q) { return 0.45 + 0.55 * (1 - (q.dz + 1) / 2); }

  /* ---------- seek(t): one frame, a pure function of t ---------- */
  function seek(t) {
    ctx.clearRect(0, 0, W, H);
    var nA = 1 - smooth((t - T.fade) / T.fadeDur);              /* the navy fades evenly, no edge crosses the page */
    if (nA > 0) { ctx.fillStyle = rgba(NAVY, nA); ctx.fillRect(0, 0, W, H); }
    var inA = smooth(t / T.inDur), eA = (1 - smooth((t - T.detach) / T.edgeFade)) * inA, i, k, q, C;
    project(Math.min(t, T.flow));

    if (eA > 0.003) {
      /* the dashed bridge from Tage to Vann, then each cell's links, then gold pulses running them */
      var A = cells[1], B = cells[0], dx = B.x - A.x, dy = B.y - A.y, dl = Math.sqrt(dx * dx + dy * dy);
      var g = ctx.createLinearGradient(A.x, A.y, B.x, B.y);
      g.addColorStop(0, rgba(TEAL, 0.6 * eA)); g.addColorStop(1, rgba(GOLD, 0.5 * eA));
      ctx.setLineDash([7, 7]); ctx.lineDashOffset = -t * 40; ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.beginPath();
      ctx.moveTo(A.x + dx / dl * A.R * 1.05, A.y + dy / dl * A.R * 1.05); ctx.lineTo(B.x - dx / dl * B.R * 0.9, B.y - dy / dl * B.R * 0.9);
      ctx.stroke(); ctx.setLineDash([]);
      cells.forEach(function (C) {
        ctx.lineWidth = 0.7; ctx.strokeStyle = rgba(C.ec, 0.26 * eA); ctx.beginPath();
        C.ed.forEach(function (e) { var a = nodes[e[0]], b = nodes[e[1]]; ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); });
        ctx.stroke();
        C.pu.forEach(function (P) {
          var u = (t - P.t0) / P.dur; if (u < 0 || u > 1) return;
          var a = nodes[P.e[0]], b = nodes[P.e[1]], fx = lerp(a.sx, b.sx, u), fy = lerp(a.sy, b.sy, u), fa = Math.sin(u * Math.PI) * eA;
          var hl = ctx.createRadialGradient(fx, fy, 0, fx, fy, 10);
          hl.addColorStop(0, rgba(PALE, 0.85 * fa)); hl.addColorStop(0.35, rgba(C.col, 0.45 * fa)); hl.addColorStop(1, rgba(C.col, 0));
          ctx.fillStyle = hl; ctx.beginPath(); ctx.arc(fx, fy, 10, 0, 6.2832); ctx.fill();
        });
      });
    }

    var pf = 1 - smooth((t - T.resolve - 0.06) / 0.24);
    if (t < T.flow) {
      for (i = 0; i < nodes.length; i++) {
        q = nodes[i]; var d = drift(i, t);
        ctx.fillStyle = rgba(cells[q.c].col, Math.min(1, nodeA(q) + (q.hot ? 0.3 : 0)) * inA);
        ctx.beginPath(); ctx.arc(d[0], d[1], nodeR(q) * (q.hot ? 1.35 : 1), 0, 6.2832); ctx.fill();
      }
    } else if (pf > 0.003) {
      for (k = 0; k < parts.length; k++) {
        var P = parts[k]; q = nodes[P.i]; C = cells[q.c];
        var u = smoother((t - P.st) / P.dur), s0 = drift(P.i, Math.min(t, P.st));
        var mx = (s0[0] + P.tx) / 2, my = (s0[1] + P.ty) / 2, ex = P.tx - s0[0], ey = P.ty - s0[1];
        var cx = mx - ey * P.bow, cy = my + ex * P.bow, w = 1 - u;
        var x = w * w * s0[0] + 2 * w * u * cx + u * u * P.tx, y = w * w * s0[1] + 2 * w * u * cy + u * u * P.ty;
        var col = [lerp(C.col[0], P.tc[0], u), lerp(C.col[1], P.tc[1], u), lerp(C.col[2], P.tc[2], u)], rad = lerp(nodeR(q), 1.7, u);
        var a0 = Math.min(1, nodeA(q) + 0.5);
        ctx.fillStyle = rgba(col, (a0 + (1 - a0) * u) * pf);
        ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.2832); ctx.fill();
        if (u > 0.02 && u < 0.98) {                      /* a short comet tail while in flight */
          var u2 = smoother((t - 0.028 - P.st) / P.dur), w2 = 1 - u2;
          ctx.strokeStyle = rgba(col, 0.3 * pf); ctx.lineWidth = rad * 0.9; ctx.beginPath();
          ctx.moveTo(w2 * w2 * s0[0] + 2 * w2 * u2 * cx + u2 * u2 * P.tx, w2 * w2 * s0[1] + 2 * w2 * u2 * cy + u2 * u2 * P.ty);
          ctx.lineTo(x, y); ctx.stroke();
        }
      }
    }

    /* the shipped wordmark comes up where the cells land, white on navy, travels into the nav logo
       slot and lands there on navy; as the navy fades the lockup turns to its built colours in place */
    var resA = smooth((t - T.resolve) / T.resolveDur), sv = smoother((t - T.settle) / T.settleDur);
    var R0 = { x: lerp(word.x, nav.x, sv), y: lerp(word.y, nav.y, sv), w: lerp(word.w, nav.w, sv), h: lerp(word.h, nav.h, sv) };
    if (resA > 0) {
      ctx.globalAlpha = resA; ctx.drawImage(img, R0.x, R0.y, R0.w, R0.h);
      var dA = smooth((nA - 0.55) / 0.25);                     /* white ink holds while the ground is dark, navy ink from mid-fade on */
      if (dA > 0) { ctx.globalAlpha = resA * dA; ctx.drawImage(dark, R0.x, R0.y, R0.w, R0.h); }
      ctx.globalAlpha = 1;
    }
    var pr = smooth((t - T.rule) / T.ruleDur), ra = 1 - smooth((t - T.settle) / 0.2);
    if (pr > 0 && ra > 0) {
      var x0 = R0.x + R0.w * 0.107, x1 = R0.x + R0.w * 0.891, len = x1 - x0;
      ctx.fillStyle = rgba(GOLD, ra);
      ctx.fillRect(x1 - pr * len, R0.y + R0.h * 0.84, pr * len, Math.max(2, R0.h * 0.02));
    }
  }

  function tick(now) {
    if (done) return;
    if (!t0) t0 = now;
    var t = (now - t0) / 1000;
    try { var r = img.getBoundingClientRect(); nav = { x: r.left, y: r.top, w: r.width, h: r.height }; seek(Math.min(t, T.end)); }
    catch (err) { finish(); return; }
    if (t >= T.reveal) reveal();
    if (t >= T.end) { finish(); return; }
    raf = requestAnimationFrame(tick);
  }

  function start() {
    img = document.querySelector('.nav-logo img');
    if (!img || (!frozen && scrollY > 10)) { finish(); return; }
    var o = document.createElement('div');
    o.id = 'intro'; o.setAttribute('aria-hidden', 'true');
    if (frozen) o.className = 'frz';
    cv = document.createElement('canvas'); o.appendChild(cv);
    document.body.appendChild(o);
    var started = false;
    var ready = function () {
      if (done || started) return;
      started = true;
      try { build(); seek(frozen ? +frozen[1] : 0); } catch (err) { finish(); return; }
      window.__introSeek = seek; window.__introT = T;
      root.classList.add('intro-live');
      if (frozen) return;
      try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
      EV.forEach(function (e) { window.addEventListener(e, finish, true); });
      setTimeout(finish, 3000);                        /* belt to the CSS braces */
      raf = requestAnimationFrame(tick);
    };
    if (img.complete) { if (img.naturalWidth) ready(); else finish(); }
    else {
      img.addEventListener('load', ready);
      img.addEventListener('error', finish);
      if (!frozen) setTimeout(function () { if (!started) finish(); }, 600);   /* a late lockup skips the intro */
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
