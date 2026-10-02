/* Vantage FP&A web (Nic's order 2026-10-01 20:22 and 20:23 CT). The gold intelligence orb of the approved
   orb_to_wordmark intro, spinning slowly at the centre of a navy ground, with a thread to each capability
   node and a pulse running out along it. The nodes are real DOM (a list, readable by a screen reader);
   this script only paints the orb, the threads and the pulses on a canvas behind them. One canvas per
   .web, painted only while it is on screen and the tab is visible. Under prefers-reduced-motion it paints
   one still frame and repaints on resize only. Seeded, no Math.random. No dependencies. */
(function () {
  'use strict';
  var GOLD = [201, 168, 76], PALE = [236, 214, 146], ICE = [185, 196, 216], TEAL = [92, 201, 190];
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + clamp01(a).toFixed(3) + ')'; }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* the orb: Fibonacci sphere of nodes, each linked to its two nearest, as the intro's gold cell */
  function makeOrb(n) {
    var rnd = mulberry(20261001), ga = Math.PI * (3 - Math.sqrt(5)), nodes = [], edges = [], i, j;
    for (i = 0; i < n; i++) {
      var y = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - y * y), th = ga * i, jt = 0.92 + 0.14 * rnd(), h = rnd();
      nodes.push({ x: Math.cos(th) * r * jt, y: y * jt, z: Math.sin(th) * r * jt, s: 0.9 + 1.9 * h * h * h, hot: h > 0.88 });
    }
    for (i = 0; i < n; i++) {
      var b1 = -1, b2 = -1, d1 = 9, d2 = 9;
      for (j = 0; j < n; j++) { if (i === j) continue;
        var dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y, dz = nodes[i].z - nodes[j].z, d = dx * dx + dy * dy + dz * dz;
        if (d < d1) { d2 = d1; b2 = b1; d1 = d; b1 = j; } else if (d < d2) { d2 = d; b2 = j; } }
      if (b1 > i) edges.push([i, b1]); if (b2 > i) edges.push([i, b2]);
    }
    return { nodes: nodes, edges: edges };
  }

  function init(root) {
    var cv = root.querySelector('.web-cv'), core = root.querySelector('.web-core'), pills = [].slice.call(root.querySelectorAll('.web-node'));
    if (!cv || !core || !pills.length) { return; }
    var ringed = root.hasAttribute('data-ring'), ringLabel = root.querySelector('.web-ring-label');
    var ctx = cv.getContext('2d'), orb = makeOrb(120), W = 0, H = 0, D = 1, cx = 0, cy = 0, R = 0, anchors = [], wide = true;
    var pulses = [], rnd = mulberry(7331), raf = 0, visible = true, t0 = 0, k;
    for (k = 0; k < pills.length; k++) { pulses.push({ ph: rnd(), sp: 0.16 + rnd() * 0.1 }, { ph: rnd(), sp: 0.16 + rnd() * 0.1 }); }

    function layout() {
      var b = root.getBoundingClientRect(); W = b.width; H = b.height;
      D = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(W * D); cv.height = Math.round(H * D); cv.style.width = W + 'px'; cv.style.height = H + 'px';
      ctx.setTransform(D, 0, 0, D, 0, 0);
      var c = core.getBoundingClientRect();
      cx = c.left - b.left + c.width / 2; cy = c.top - b.top + c.height / 2;
      R = Math.max(54, Math.min(c.height * 0.38, W * 0.3));
      if (wide = W > 700) { R = Math.max(70, Math.min(H * 0.21, W * 0.13)); }
      anchors = pills.map(function (p) { var r = p.getBoundingClientRect(); return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2, w: r.width, h: r.height }; });
      var cl = root.querySelector('.web-core-label');
      if (cl) { cl.style.left = cx + 'px'; cl.style.top = (cy + R * 1.22) + 'px'; }
      if (ringLabel) { ringLabel.style.left = (W / 2) + 'px'; ringLabel.style.top = (H - 14) + 'px'; }
    }

    function draw(t) {
      var i, j, a, p, q, yaw = 0.9 + 0.2 * t, cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(0.38), sp = Math.sin(0.38), CAM = 2.8;
      ctx.clearRect(0, 0, W, H);
      /* the ring, when the page asks for one: a dashed teal ellipse around the whole stage */
      if (ringed) {
        ctx.save(); ctx.setLineDash([7, 8]); ctx.lineDashOffset = -t * 6; ctx.strokeStyle = rgba(TEAL, 0.5); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(W / 2, H / 2, Math.max(10, W / 2 - 14), Math.max(10, H / 2 - 14), 0, 0, 6.2832); ctx.stroke(); ctx.restore();
      }
      /* links between neighbouring nodes, wide layout only */
      if (wide && anchors.length > 2) {
        ctx.lineWidth = 0.8; ctx.strokeStyle = rgba(ICE, 0.16); ctx.beginPath();
        for (i = 0; i < anchors.length; i++) { a = anchors[i]; q = anchors[(i + 1) % anchors.length]; ctx.moveTo(a.x, a.y); ctx.lineTo(q.x, q.y); }
        ctx.stroke();
      }
      /* soft glow under the orb */
      var g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.9);
      g.addColorStop(0, rgba(GOLD, 0.16)); g.addColorStop(1, rgba(GOLD, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.9, 0, 6.2832); ctx.fill();
      /* orb nodes, projected */
      for (i = 0; i < orb.nodes.length; i++) {
        q = orb.nodes[i];
        var x1 = q.x * cyw + q.z * syw, z1 = q.z * cyw - q.x * syw, y1 = q.y * cp - z1 * sp, z2 = q.y * sp + z1 * cp, k2 = CAM / (CAM + z2);
        q.sx = cx + x1 * k2 * R; q.sy = cy + y1 * k2 * R; q.dz = z2; q.k = k2;
      }
      ctx.lineWidth = 0.7; ctx.strokeStyle = rgba(ICE, 0.24); ctx.beginPath();
      for (i = 0; i < orb.edges.length; i++) { a = orb.nodes[orb.edges[i][0]]; q = orb.nodes[orb.edges[i][1]]; ctx.moveTo(a.sx, a.sy); ctx.lineTo(q.sx, q.sy); }
      ctx.stroke();
      for (i = 0; i < orb.nodes.length; i++) {
        q = orb.nodes[i];
        ctx.fillStyle = rgba(q.hot ? PALE : GOLD, Math.min(1, 0.45 + 0.55 * (1 - (q.dz + 1) / 2) + (q.hot ? 0.25 : 0)));
        ctx.beginPath(); ctx.arc(q.sx, q.sy, Math.max(0.9, q.s * q.k * R / 95), 0, 6.2832); ctx.fill();
      }
      /* a thread from the orb to each node, with a pulse or two running out along it */
      for (i = 0; i < anchors.length; i++) {
        a = anchors[i];
        var dx = a.x - cx, dy = a.y - cy, dl = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / dl, uy = dy / dl;
        var sx = cx + ux * R * 0.95, sy = cy + uy * R * 0.95, bow = (i % 2 ? 1 : -1) * Math.min(40, dl * 0.08), mx = (sx + a.x) / 2 - uy * bow, my = (sy + a.y) / 2 + ux * bow;
        ctx.lineWidth = 1.1; ctx.strokeStyle = rgba(GOLD, 0.38); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx, my, a.x, a.y); ctx.stroke();
        for (j = 0; j < 2; j++) {
          p = pulses[i * 2 + j]; var u = (reduce ? (p.ph * 0.9 + 0.05) : ((p.ph + t * p.sp) % 1)), w = 1 - u;
          var fx = w * w * sx + 2 * w * u * mx + u * u * a.x, fy = w * w * sy + 2 * w * u * my + u * u * a.y, fa = Math.sin(u * Math.PI);
          var hl = ctx.createRadialGradient(fx, fy, 0, fx, fy, 9);
          hl.addColorStop(0, rgba(PALE, 0.9 * fa)); hl.addColorStop(0.4, rgba(GOLD, 0.45 * fa)); hl.addColorStop(1, rgba(GOLD, 0));
          ctx.fillStyle = hl; ctx.beginPath(); ctx.arc(fx, fy, 9, 0, 6.2832); ctx.fill();
        }
      }
    }

    function tick(now) {
      raf = 0;
      if (!visible || document.hidden) { return; }
      if (!t0) { t0 = now; }
      draw((now - t0) / 1000);
      raf = requestAnimationFrame(tick);
    }
    function start() { if (!reduce && !raf && visible && !document.hidden) { raf = requestAnimationFrame(tick); } }

    layout(); draw(1.2);
    if (reduce) {
      if (window.ResizeObserver) { new ResizeObserver(function () { layout(); draw(1.2); }).observe(root); }
      window.addEventListener('resize', function () { layout(); draw(1.2); });
      if (document.fonts && document.fonts.ready) { document.fonts.ready.then(function () { layout(); draw(1.2); }); }
      return;
    }
    if (window.ResizeObserver) { new ResizeObserver(function () { layout(); }).observe(root); }
    else { window.addEventListener('resize', layout); }
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(layout); }
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) { start(); } }, { threshold: 0 }).observe(root);
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { start(); } });
    start();
  }

  function boot() { [].slice.call(document.querySelectorAll('.web')).forEach(init); }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
})();
