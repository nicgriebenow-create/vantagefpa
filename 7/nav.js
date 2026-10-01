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
