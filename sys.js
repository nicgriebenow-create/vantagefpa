/* The System page, flagship rebuild (prototype, batch site_v7_r3_list2_20261001). Extends web.js's orb.
   Two movers, each self-contained and each optional on the page (the band engine was deleted 2026-10-02):
     .sysorb    the hero: a dense spinning orb with a thread and pulses to every capability node
     .sysflow   inputs pulled into the orb, outputs pushed out of it
   Every label is real DOM placed by CSS before this runs; this file only paints canvases and moves packets.
   Each mover paints only while on screen and the tab is visible. Under prefers-reduced-motion each paints
   one complete still frame and repaints on resize only. Seeded, no Math.random, no dependencies. */
(function () {
  'use strict';
  var GOLD = [201, 168, 76], PALE = [236, 214, 146], ICE = [185, 196, 216], TEAL = [92, 201, 190], CREAM = [241, 221, 164];
  var KIND = { reporting: GOLD, deal: TEAL, check: ICE, intel: CREAM };
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var MQ = window.matchMedia ? matchMedia('(min-width: 860px)') : { matches: true };
  var TAU = 6.2832;

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + clamp01(a).toFixed(3) + ')'; }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ---------- the orb, web.js's Fibonacci sphere made denser: k nearest links and two orbit rings ---------- */
  function makeOrb(n, k) {
    var rnd = mulberry(20261001), ga = Math.PI * (3 - Math.sqrt(5)), nodes = [], edges = [], seen = {}, i, j, m;
    for (i = 0; i < n; i++) {
      var y = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - y * y), th = ga * i, jt = 0.93 + 0.12 * rnd(), h = rnd();
      nodes.push({ x: Math.cos(th) * r * jt, y: y * jt, z: Math.sin(th) * r * jt, s: 0.8 + 1.8 * h * h * h, hot: h > 0.9 });
    }
    for (i = 0; i < n; i++) {
      var best = [];
      for (j = 0; j < n; j++) { if (i === j) continue;
        var dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y, dz = nodes[i].z - nodes[j].z, d = dx * dx + dy * dy + dz * dz;
        best.push([d, j]); }
      best.sort(function (a, b) { return a[0] - b[0]; });
      for (m = 0; m < k; m++) { var a = Math.min(i, best[m][1]), b = Math.max(i, best[m][1]); if (!seen[a + '_' + b]) { seen[a + '_' + b] = 1; edges.push([a, b]); } }
    }
    return { nodes: nodes, edges: edges };
  }

  function paintOrb(ctx, orb, cx, cy, R, t, spin) {
    var i, a, q, yaw = 0.9 + spin * t, cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(0.38), sp = Math.sin(0.38), CAM = 2.8;
    var g = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 2.1);
    g.addColorStop(0, rgba(GOLD, 0.22)); g.addColorStop(0.45, rgba(GOLD, 0.07)); g.addColorStop(1, rgba(GOLD, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 2.1, 0, TAU); ctx.fill();
    /* two orbit rings, tilted and counter-rotating, each carrying one bright bead */
    for (i = 0; i < 2; i++) {
      var rr = R * (i ? 1.42 : 1.22), tilt = i ? -0.5 : 0.62, rot = (i ? -0.13 : 0.09) * t + i * 2, ct = Math.cos(tilt), st = Math.sin(tilt), cr = Math.cos(rot), sr = Math.sin(rot);
      ctx.beginPath();
      for (var s = 0; s <= 64; s++) { var u = s / 64 * TAU, px = Math.cos(u) * rr, py = Math.sin(u) * rr * 0.32;
        var X = px * cr - py * sr, Y = (px * sr + py * cr) * ct + rr * 0.06 * st;
        if (s) { ctx.lineTo(cx + X, cy + Y); } else { ctx.moveTo(cx + X, cy + Y); } }
      ctx.strokeStyle = rgba(ICE, 0.16); ctx.lineWidth = 1; ctx.stroke();
      var ub = (i ? -0.21 : 0.17) * t + i * 3.1, bx = Math.cos(ub) * rr, by = Math.sin(ub) * rr * 0.32;
      var BX = cx + bx * cr - by * sr, BY = cy + (bx * sr + by * cr) * ct + rr * 0.06 * st;
      var bg = ctx.createRadialGradient(BX, BY, 0, BX, BY, 7); bg.addColorStop(0, rgba(PALE, 0.95)); bg.addColorStop(1, rgba(GOLD, 0));
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(BX, BY, 7, 0, TAU); ctx.fill();
    }
    for (i = 0; i < orb.nodes.length; i++) {
      q = orb.nodes[i];
      var x1 = q.x * cyw + q.z * syw, z1 = q.z * cyw - q.x * syw, y1 = q.y * cp - z1 * sp, z2 = q.y * sp + z1 * cp, k2 = CAM / (CAM + z2);
      q.sx = cx + x1 * k2 * R; q.sy = cy + y1 * k2 * R; q.dz = z2; q.k = k2;
    }
    ctx.lineWidth = 0.7; ctx.strokeStyle = rgba(ICE, 0.2); ctx.beginPath();
    for (i = 0; i < orb.edges.length; i++) { a = orb.nodes[orb.edges[i][0]]; q = orb.nodes[orb.edges[i][1]]; ctx.moveTo(a.sx, a.sy); ctx.lineTo(q.sx, q.sy); }
    ctx.stroke();
    for (i = 0; i < orb.nodes.length; i++) {
      q = orb.nodes[i];
      ctx.fillStyle = rgba(q.hot ? PALE : GOLD, Math.min(1, 0.35 + 0.6 * (1 - (q.dz + 1) / 2) + (q.hot ? 0.25 : 0)));
      ctx.beginPath(); ctx.arc(q.sx, q.sy, Math.max(0.8, q.s * q.k * R / 110), 0, TAU); ctx.fill();
    }
  }

  function pulse(ctx, x, y, a, c, r) {
    var hl = ctx.createRadialGradient(x, y, 0, x, y, r);
    hl.addColorStop(0, rgba(PALE, 0.95 * a)); hl.addColorStop(0.4, rgba(c, 0.5 * a)); hl.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = hl; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  function quad(u, s, m, e) { var w = 1 - u; return w * w * s + 2 * w * u * m + u * u * e; }
  function cubic(u, a, b, c, d) { var w = 1 - u; return w * w * w * a + 3 * w * w * u * b + 3 * w * u * u * c + u * u * u * d; }

  /* Shared driver: sizes the canvas to its CSS box, paints while visible, one still frame under reduced motion. */
  function drive(root, cv, layout, draw) {
    var ctx = cv.getContext('2d'), raf = 0, visible = true, t0 = 0, box = { W: 0, H: 0 };
    function size() {
      var b = cv.getBoundingClientRect(), D = Math.min(2, window.devicePixelRatio || 1);
      box.W = b.width; box.H = b.height; cv.width = Math.round(b.width * D); cv.height = Math.round(b.height * D);
      ctx.setTransform(D, 0, 0, D, 0, 0); layout(box, b);
    }
    function frame(t) { ctx.clearRect(0, 0, box.W, box.H); draw(ctx, box, t); }
    function tick(now) { raf = 0; if (!visible || document.hidden) { return; } if (!t0) { t0 = now; } frame((now - t0) / 1000 + 1.2); raf = requestAnimationFrame(tick); }
    function start() { if (!reduce && !raf && visible && !document.hidden) { raf = requestAnimationFrame(tick); } }
    function refresh() { size(); if (reduce || !raf) { frame(1.2); } }
    size(); frame(1.2);
    if (window.ResizeObserver) { new ResizeObserver(refresh).observe(root); } else { window.addEventListener('resize', refresh); }
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(refresh); }
    if (reduce) { return; }
    if (window.IntersectionObserver) { new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) { start(); } }, { threshold: 0 }).observe(root); }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { start(); } });
    start();
  }

  /* ---------- HERO: every capability threaded to the orb ---------- */
  function initOrb(root) {
    var cv = root.querySelector('.sysorb-cv'), core = root.querySelector('.sysorb-core');
    var lis = [].slice.call(root.querySelectorAll('.sysorb-node'));
    if (!cv || !core || !lis.length) { return; }
    var orb = makeOrb(240, 3), rnd = mulberry(7331), cx = 0, cy = 0, R = 0, wide = true, nodes = [], byId = {};
    lis.forEach(function (li, i) {
      var n = { el: li, id: li.getAttribute('data-id') || ('n' + i), parent: li.getAttribute('data-parent'), kind: (li.className.match(/kind-(\w+)/) || [0, 'reporting'])[1],
        pulses: [{ ph: rnd(), sp: 0.14 + rnd() * 0.1 }, { ph: rnd(), sp: 0.14 + rnd() * 0.1 }], x: 0, y: 0 };
      nodes.push(n); byId[n.id] = n;
    });
    /* phone: dots clustered by kind in the four quadrants, matching the corner group labels */
    var QUAD = { reporting: -135, check: -45, intel: 45, deal: 135 };
    function compactAnchors(W, H) {
      var rx = W * 0.37, ry = H * 0.35, groups = {};
      nodes.forEach(function (n) { if (!n.parent) { (groups[n.kind] = groups[n.kind] || []).push(n); } });
      Object.keys(groups).forEach(function (k) {
        var g = groups[k], base = QUAD[k] === undefined ? 0 : QUAD[k], spread = Math.min(56, 20 * (g.length - 1));
        g.forEach(function (n, i) { var ang = (base - spread / 2 + (g.length > 1 ? spread * i / (g.length - 1) : 0)) * Math.PI / 180;
          n.x = cx + Math.cos(ang) * rx; n.y = cy + Math.sin(ang) * ry; n.ang = ang; });
      });
      nodes.forEach(function (n) { if (n.parent && byId[n.parent]) { var p = byId[n.parent], sibs = nodes.filter(function (m) { return m.parent === n.parent; }), i = sibs.indexOf(n);
        var ang = p.ang + (i - (sibs.length - 1) / 2) * 0.42; n.x = cx + Math.cos(ang) * rx * 1.25; n.y = cy + Math.sin(ang) * ry * 1.25; } });
    }
    drive(root, cv, function (box, b) {
      wide = MQ.matches;
      var c = core.getBoundingClientRect(); cx = c.left - b.left; cy = c.top - b.top;
      if (wide) {
        R = Math.max(90, Math.min(box.H * 0.27, box.W * 0.14));
        nodes.forEach(function (n) { var r = n.el.getBoundingClientRect(); n.x = r.left - b.left + r.width / 2; n.y = r.top - b.top + r.height / 2; });
      } else { R = Math.min(box.W, box.H) * 0.18; compactAnchors(box.W, box.H); }
    }, function (ctx, box, t) {
      var i, j;
      /* faint links tying each kind together, wide only */
      paintOrb(ctx, orb, cx, cy, R, t, 0.16);
      for (i = 0; i < nodes.length; i++) {
        var n = nodes[i], col = KIND[n.kind] || GOLD, p = n.parent ? byId[n.parent] : null, sx, sy, dx, dy, dl;
        if (p) { sx = p.x; sy = p.y; dx = n.x - sx; dy = n.y - sy; dl = Math.sqrt(dx * dx + dy * dy) || 1; }
        else { dx = n.x - cx; dy = n.y - cy; dl = Math.sqrt(dx * dx + dy * dy) || 1; sx = cx + dx / dl * R * 0.96; sy = cy + dy / dl * R * 0.96; }
        var ux = dx / dl, uy = dy / dl, bow = (i % 2 ? 1 : -1) * Math.min(36, dl * 0.09), mx = (sx + n.x) / 2 - uy * bow, my = (sy + n.y) / 2 + ux * bow;
        ctx.lineWidth = p ? 1 : 1.2; ctx.strokeStyle = rgba(col, p ? 0.42 : 0.4);
        if (p) { ctx.setLineDash([4, 5]); }
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx, my, n.x, n.y); ctx.stroke(); ctx.setLineDash([]);
        for (j = 0; j < (p ? 1 : 2); j++) {
          var pu = n.pulses[j], u = reduce ? (pu.ph * 0.8 + 0.1) : ((pu.ph + t * pu.sp) % 1);
          pulse(ctx, quad(u, sx, mx, n.x), quad(u, sy, my, n.y), Math.sin(u * Math.PI), col, wide ? 9 : 7);
        }
        if (!wide) {
          ctx.fillStyle = rgba(col, 0.25); ctx.beginPath(); ctx.arc(n.x, n.y, p ? 8 : 10, 0, TAU); ctx.fill();
          ctx.fillStyle = p ? '#0A1830' : rgba(col, 1); ctx.strokeStyle = rgba(col, 1); ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(n.x, n.y, p ? 4 : 5, 0, TAU); ctx.fill(); if (p) { ctx.stroke(); }
        }
      }
    });
  }

  /* ---------- FLOW: inputs pulled in, outputs pushed out ---------- */
  function initFlow(root) {
    var cv = root.querySelector('.sysflow-cv'), core = root.querySelector('.sysflow-core');
    var ins = [].slice.call(root.querySelectorAll('.sysflow-in .sysflow-item')), outs = [].slice.call(root.querySelectorAll('.sysflow-out .sysflow-item'));
    if (!cv || !core || !ins.length || !outs.length) { return; }
    var orb = makeOrb(160, 3), rnd = mulberry(4242), cx = 0, cy = 0, R = 0, wide = true, curves = [];
    drive(root, cv, function (box, b) {
      wide = MQ.matches; curves = [];
      var c = core.getBoundingClientRect(); cx = c.left - b.left + c.width / 2; cy = c.top - b.top + c.height / 2;
      R = Math.min(c.width, c.height) * (wide ? 0.3 : 0.3);
      function add(el, inward, idx, count) {
        var r = el.getBoundingClientRect(), x, y, ex, ey, c1x, c1y, c2x, c2y, spread = (idx - (count - 1) / 2) / Math.max(1, count - 1);
        if (wide) {
          x = inward ? r.right - b.left : r.left - b.left; y = r.top - b.top + r.height / 2;
          ex = cx + (inward ? -1 : 1) * R * 0.92; ey = cy + spread * R * 0.9;
          var dx = ex - x; c1x = x + dx * 0.55; c1y = y; c2x = ex - dx * 0.45; c2y = ey;
        } else {
          /* phone: every curve meets its list at the edge facing the orb, spread across the list width, so no
             curve crosses a row of items */
          var ul = el.parentNode.getBoundingClientRect();
          x = ul.left - b.left + ul.width * (idx + 0.5) / count; y = inward ? ul.bottom - b.top + 4 : ul.top - b.top - 4;
          ex = cx + spread * R * 1.1; ey = cy + (inward ? -1 : 1) * R * 0.92;
          var dy = ey - y; c1x = x; c1y = y + dy * 0.55; c2x = ex; c2y = ey - dy * 0.45;
        }
        var ps = []; for (var k = 0; k < 4; k++) { ps.push({ ph: (k + rnd() * 0.5) / 4, sp: 0.22 + rnd() * 0.06 }); }
        /* inward: travel item -> orb. outward: travel orb -> item. */
        curves.push(inward ? { a: [x, y], b: [c1x, c1y], c: [c2x, c2y], d: [ex, ey], col: ICE, ps: ps } : { a: [ex, ey], b: [c2x, c2y], c: [c1x, c1y], d: [x, y], col: GOLD, ps: ps });
      }
      ins.forEach(function (el, i) { add(el, true, i, ins.length); });
      outs.forEach(function (el, i) { add(el, false, i, outs.length); });
    }, function (ctx, box, t) {
      var i, k, s;
      for (i = 0; i < curves.length; i++) {
        var C = curves[i];
        ctx.lineWidth = 1.2; ctx.strokeStyle = rgba(C.col, 0.28); ctx.beginPath(); ctx.moveTo(C.a[0], C.a[1]);
        ctx.bezierCurveTo(C.b[0], C.b[1], C.c[0], C.c[1], C.d[0], C.d[1]); ctx.stroke();
        /* arrowhead at the receiving end, so the still frame reads its direction */
        var ex = C.d[0], ey = C.d[1], tx = ex - cubic(0.96, C.a[0], C.b[0], C.c[0], C.d[0]), ty = ey - cubic(0.96, C.a[1], C.b[1], C.c[1], C.d[1]), tl = Math.sqrt(tx * tx + ty * ty) || 1;
        tx /= tl; ty /= tl; ctx.fillStyle = rgba(C.col, 0.75); ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - tx * 9 - ty * 4.5, ey - ty * 9 + tx * 4.5); ctx.lineTo(ex - tx * 9 + ty * 4.5, ey - ty * 9 - tx * 4.5); ctx.fill();
        for (k = 0; k < C.ps.length; k++) {
          var P = C.ps[k], u = reduce ? P.ph : (P.ph + t * P.sp) % 1;
          for (s = 3; s >= 0; s--) { var us = u - s * 0.018; if (us < 0) { continue; }
            var a = Math.sin(us * Math.PI) * (1 - s * 0.24);
            ctx.fillStyle = rgba(s ? C.col : PALE, a); ctx.beginPath(); ctx.arc(cubic(us, C.a[0], C.b[0], C.c[0], C.d[0]), cubic(us, C.a[1], C.b[1], C.c[1], C.d[1]), s ? 2 : 3.2, 0, TAU); ctx.fill(); }
        }
      }
      paintOrb(ctx, orb, cx, cy, R, t, 0.2);
    });
  }

  function boot() {
    [].slice.call(document.querySelectorAll('.sysorb')).forEach(initOrb);
    [].slice.call(document.querySelectorAll('.sysflow')).forEach(initFlow);
    document.documentElement.classList.add('js-sys');
    if (MQ.addEventListener) { MQ.addEventListener('change', function () { window.dispatchEvent(new Event('resize')); }); }
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
})();
