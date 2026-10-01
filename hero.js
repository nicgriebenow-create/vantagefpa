/* Vantage FP&A, Direction A hero. One program: window.seek(t) paints the panel at time t (seconds).
   No timers, no randomness. The live page drives seek(t) with requestAnimationFrame once, then holds.
   Sample data only: Specimen Commercial Services Co., the EBITDA walk the site already publishes. */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var DUR = 7.0;
  var fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

  // Specimen Commercial Services Co. (sample data)
  var REV = [
    { fy: 'FY2022', v: 612022 },
    { fy: 'FY2023', v: 657320 },
    { fy: 'FY2024', v: 702856 },
    { fy: 'FY2025', v: 746564 }
  ];
  var REPORTED = 93208, ADDBACK = 12300, ADJUSTED = 105508; // LTM

  var svg = document.getElementById('hero-panel');
  if (!svg) return;
  var NARROW = (svg.getBoundingClientRect().width || 640) < 480;
  var SX = NARROW ? -330 : 0, SY = NARROW ? 330 : 0;   // right pane shift
  svg.setAttribute('viewBox', NARROW ? '0 0 320 680' : '0 0 640 344');

  function el(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    svg.appendChild(e);
    return e;
  }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function easeOut(x) { x = clamp01(x); return 1 - Math.pow(1 - x, 3); }
  function seg(t, a, b) { return easeOut((t - a) / (b - a)); }

  // Geometry
  var BASE = 250, HMAX = 150, B2 = BASE + SY;
  var L = { x0: 18, title: 'Every month', sub: 'Revenue by fiscal year, against prior year' };
  var R = { x0: 348 + SX, title: 'Before a deal', sub: 'Reported to adjusted EBITDA, LTM' };

  // Static text
  el('text', { x: L.x0, y: 28, 'class': 'cap' }, L.title);
  el('text', { x: L.x0, y: 46, 'class': 'lbl' }, L.sub);
  el('text', { x: R.x0, y: 28 + SY, 'class': 'cap' }, R.title);
  el('text', { x: R.x0, y: 46 + SY, 'class': 'lbl' }, R.sub);
  if (NARROW) el('line', { x1: 18, y1: 326, x2: 302, y2: 326, stroke: '#EEF0F4', 'stroke-width': 1 }); else el('line', { x1: 320, y1: 14, x2: 320, y2: 340, stroke: '#EEF0F4', 'stroke-width': 1 });
  el('line', { x1: 18, y1: BASE + 0.5, x2: 296, y2: BASE + 0.5, stroke: '#8A95A3', 'stroke-width': 1 });
  el('line', { x1: 348 + SX, y1: B2 + 0.5, x2: 626 + SX, y2: B2 + 0.5, stroke: '#8A95A3', 'stroke-width': 1 });

  // Left: four revenue columns
  var bars = [], figs = [], deltas = [];
  REV.forEach(function (d, i) {
    var x = 30 + i * 68;
    bars.push(el('rect', { x: x, y: BASE, width: 44, height: 0, fill: i === 3 ? '#0D1F3C' : '#243E6B' }));
    figs.push(el('text', { x: x + 22, y: BASE - 6, 'class': 'fig', 'text-anchor': 'middle' }, ''));
    el('text', { x: x + 22, y: BASE + 18, 'class': 'lbl', 'text-anchor': 'middle' }, d.fy);
    if (i > 0) {
      var pct = (d.v / REV[i - 1].v - 1) * 100;
      deltas.push(el('text', { x: x + 22, y: BASE + 34, 'class': 'delta', 'text-anchor': 'middle', opacity: 0 },
        (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%'));
    }
  });
  el('text', { x: L.x0, y: 322, 'class': 'lbl' }, 'Change against the prior fiscal year.');
  var trendPts = REV.map(function (d, i) { return (30 + i * 68 + 22) + ',' + (BASE - d.v / REV[3].v * HMAX); }).join(' ');
  var trend = el('polyline', { points: trendPts, fill: 'none', stroke: '#C9A84C', 'stroke-width': 1.5, 'stroke-dasharray': 260, 'stroke-dashoffset': 260 });

  // Right: bridge
  var SCALE = 170 / ADJUSTED;
  var hRep = REPORTED * SCALE, hAdj = ADJUSTED * SCALE, hAdd = ADDBACK * SCALE;
  var xRep = 360 + SX, xAdd = 450 + SX, xAdj = 540 + SX, W = 70; 
  var repBar = el('rect', { x: xRep, y: B2, width: W, height: 0, fill: '#243E6B' });
  var repFig = el('text', { x: xRep + W / 2, y: B2 - 6, 'class': 'fig', 'text-anchor': 'middle' }, '');
  el('text', { x: xRep + W / 2, y: B2 + 18, 'class': 'lbl', 'text-anchor': 'middle' }, 'Reported EBITDA');
  el('text', { x: xRep + W / 2, y: B2 + 32, 'class': 'lbl', 'text-anchor': 'middle' }, '(LTM)');
  var addBar = el('rect', { x: xAdd, y: B2 - hRep, width: W, height: 0, fill: '#C9A84C' });
  var addFig = el('text', { x: xAdd + W / 2, y: B2 - hAdj - 6, 'class': 'fig', 'text-anchor': 'middle', opacity: 0 }, '');
  el('text', { x: xAdd + W / 2, y: B2 + 18, 'class': 'lbl', 'text-anchor': 'middle' }, 'Add-backs');
  el('text', { x: xAdd + W / 2, y: B2 + 32, 'class': 'lbl', 'text-anchor': 'middle' }, '(accepted)');
  var adjBar = el('rect', { x: xAdj, y: B2, width: W, height: 0, fill: '#0D1F3C' });
  var adjFig = el('text', { x: xAdj + W / 2, y: B2 - 6, 'class': 'fig', 'text-anchor': 'middle' }, '');
  el('text', { x: xAdj + W / 2, y: B2 + 18, 'class': 'lbl', 'text-anchor': 'middle' }, 'Adjusted EBITDA');
  el('text', { x: xAdj + W / 2, y: B2 + 32, 'class': 'lbl', 'text-anchor': 'middle' }, '(LTM)');
  var con1 = el('line', { x1: xRep + W, y1: B2 - hRep + 0.5, x2: xAdd, y2: B2 - hRep + 0.5, stroke: '#8A95A3', 'stroke-dasharray': '3 3', opacity: 0 });
  var con2 = el('line', { x1: xAdd + W, y1: B2 - hAdj + 0.5, x2: xAdj, y2: B2 - hAdj + 0.5, stroke: '#8A95A3', 'stroke-dasharray': '3 3', opacity: 0 });

  // Footing line and trace
  var FOOT = fmt.format(REPORTED) + ' + ' + fmt.format(ADDBACK) + ' = ' + fmt.format(ADJUSTED);
  var trace = el('path', { d: 'M' + xAdd + ' ' + (B2 - hRep) + ' L' + (xAdd - 8) + ' ' + (B2 - hRep) + ' L' + (xAdd - 8) + ' ' + (300 + SY) + ' L' + R.x0 + ' ' + (300 + SY) + ' L' + R.x0 + ' ' + (316 + SY),
    fill: 'none', stroke: '#C9A84C', 'stroke-width': 1.25 });
  var traceLen = 400; trace.setAttribute('stroke-dasharray', traceLen); trace.setAttribute('stroke-dashoffset', traceLen);
  var footTxt = el('text', { x: R.x0, y: 330 + SY, 'class': 'foot-line' }, '');
  var foots = el('text', { x: R.x0, y: 330 + SY, 'class': 'foots', opacity: 0 }, 'Adds up.');
  var check = el('path', { d: '', fill: 'none', stroke: '#2F6B3A', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0 });

  function seek(t) {
    if (t < 0) t = 0; if (t > DUR) t = DUR;
    // Beat 1: columns, start 0.0, 0.5, 1.0, 1.5, 0.7 s each
    REV.forEach(function (d, i) {
      var p = seg(t, i * 0.5, i * 0.5 + 0.7);
      var h = d.v / REV[3].v * HMAX * p;
      bars[i].setAttribute('y', BASE - h); bars[i].setAttribute('height', h);
      figs[i].setAttribute('y', BASE - h - 6);
      figs[i].textContent = p > 0 ? fmt.format(Math.round(d.v * p)) : '';
      if (i > 0) deltas[i - 1].setAttribute('opacity', clamp01((t - (i * 0.5 + 0.8)) / 0.3));
    });
    trend.setAttribute('stroke-dashoffset', 260 * (1 - seg(t, 2.0, 2.6)));
    // Beat 2: bridge
    var pr = seg(t, 2.3, 3.1), pa = seg(t, 3.2, 3.8), pj = seg(t, 3.9, 4.6);
    repBar.setAttribute('y', B2 - hRep * pr); repBar.setAttribute('height', hRep * pr);
    repFig.setAttribute('y', B2 - hRep * pr - 6); repFig.textContent = pr > 0 ? fmt.format(Math.round(REPORTED * pr)) : '';
    con1.setAttribute('opacity', pa > 0 ? 1 : 0);
    addBar.setAttribute('y', B2 - hRep - hAdd * pa); addBar.setAttribute('height', hAdd * pa);
    addFig.setAttribute('opacity', pa); addFig.textContent = '+' + fmt.format(Math.round(ADDBACK * pa));
    con2.setAttribute('opacity', pj > 0 ? 1 : 0);
    adjBar.setAttribute('y', B2 - hAdj * pj); adjBar.setAttribute('height', hAdj * pj);
    adjFig.setAttribute('y', B2 - hAdj * pj - 6); adjFig.textContent = pj > 0 ? fmt.format(Math.round(ADJUSTED * pj)) : '';
    // Beat 3: trace and footing
    var pt = seg(t, 4.7, 5.3);
    trace.setAttribute('stroke-dashoffset', traceLen * (1 - pt));
    var pf = clamp01((t - 5.0) / 0.9);
    footTxt.textContent = FOOT.slice(0, Math.round(FOOT.length * pf));
    var done = t >= 6.0;
    foots.setAttribute('x', R.x0 + 190); foots.setAttribute('opacity', done ? clamp01((t - 6.0) / 0.3) : 0);
    var pc = clamp01((t - 6.1) / 0.4);
    check.setAttribute('opacity', pc > 0 ? 1 : 0);
    var cx = R.x0 + 254, cy = 326 + SY;
    check.setAttribute('d', 'M' + cx + ' ' + cy + ' l' + (4 * Math.min(1, pc * 2)) + ' ' + (4 * Math.min(1, pc * 2)) +
      (pc > 0.5 ? ' l' + (9 * (pc - 0.5) * 2) + ' ' + (-9 * (pc - 0.5) * 2) : ''));
  }
  window.seek = seek;
  window.HERO_DURATION = DUR;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || window.__CAPTURE__) { seek(reduced ? DUR : 0); return; }
  var start = null;
  function frame(ts) {
    if (start === null) start = ts;
    var t = (ts - start) / 1000;
    seek(t);
    if (t < DUR) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
