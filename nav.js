/* Vantage FP&A shared navigation script. Accessible mobile menu. No dependencies. */
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var menu = document.getElementById('mobile-menu');
  if (!toggle || !menu) { return; }

  function isOpen() { return menu.classList.contains('open'); }

  function setOpen(open) {
    menu.classList.toggle('open', open);
    toggle.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  toggle.addEventListener('click', function (e) {
    e.stopPropagation();
    setOpen(!isOpen());
  });

  menu.addEventListener('click', function (e) {
    if (e.target.closest('a')) { setOpen(false); }
  });

  document.addEventListener('click', function (e) {
    if (!isOpen()) { return; }
    if (menu.contains(e.target) || toggle.contains(e.target)) { return; }
    setOpen(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) {
      setOpen(false);
      toggle.focus();
    }
  });

  function closeIfDesktop() {
    if (window.innerWidth > 900 && isOpen()) { setOpen(false); }
  }

  var desktop = window.matchMedia('(min-width: 901px)');
  if (desktop.addEventListener) { desktop.addEventListener('change', closeIfDesktop); }
  else if (desktop.addListener) { desktop.addListener(closeIfDesktop); }
  window.addEventListener('resize', closeIfDesktop);
})();

/* Site assistant launcher placement (site_v7_full_20261001, fix B). Until the reader scrolls past
   the hero, the launcher is an icon-only circle (html.vfpa-icon), and while that circle would sit
   over a heading, a chart or any element whose own text carries a digit, it steps out of view
   (html.vfpa-yield). At any scroll position it also steps out while it would sit over a form control
   (round 4, C4). Yielding hides it visually only (extra.css): it stays in the tab order and the
   accessibility tree and shows on focus (C5). An open panel, or focus inside the assistant, always
   keeps it on screen. */
(function () {
  var root = document.documentElement;
  var SOLID = 'h1, h2, h3, p, svg, [role="img"]';
  var FORM = 'input, textarea, select, button, label, .cr-summary, .cr-fail, .cr-note';
  function ownDigit(e) {
    for (var n = e.firstChild; n; n = n.nextSibling) { if (n.nodeType === 3 && /\d/.test(n.nodeValue)) return true; }
    return false;
  }
  function update() {
    var w = document.getElementById('vfpa-assist');
    if (!w) return;
    var t = w.querySelector('.vfpa-assist-toggle');
    var hero = document.querySelector('.hero') || document.querySelector('h1');
    var past = !hero || hero.getBoundingClientRect().bottom <= 0;
    root.classList.toggle('vfpa-icon', !past);
    var open = (t && t.getAttribute('aria-expanded') === 'true') || w.contains(document.activeElement);
    if (open || !t) { root.classList.remove('vfpa-yield'); return; }
    var b = t.getBoundingClientRect(), clash = false, all = document.body.getElementsByTagName('*');
    for (var i = 0; i < all.length && !clash; i++) {
      var e = all[i];
      if (w.contains(e)) continue;
      if (!(e.matches(FORM) || (!past && (e.matches(SOLID) || ownDigit(e))))) continue;
      var r = e.getBoundingClientRect();
      if (r.width && r.height && r.bottom > b.top && r.top < b.bottom && r.right > b.left && r.left < b.right) clash = true;
    }
    root.classList.toggle('vfpa-yield', clash);
  }
  var queued = false;
  function soon() { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; update(); }); }
  root.classList.add('vfpa-icon');
  window.addEventListener('scroll', soon, { passive: true });
  window.addEventListener('resize', soon);
  document.addEventListener('focusin', soon);
  document.addEventListener('click', function () { setTimeout(update, 0); });
  document.addEventListener('input', soon);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', update); else update();
  window.addEventListener('load', update);
  window.__vfpaLauncherUpdate = update;
})();
