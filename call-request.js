/* Copyright (c) 2026 Vantage FP&A LLC. All rights reserved.
   Request-a-call form. Validates on the page, then POSTs JSON as text/plain
   (a simple request, so no CORS preflight) to the Apps Script web app named
   below. While the endpoint is the placeholder, a submit shows the email
   fallback and never pretends to succeed. */

/* THE ONE SETTING. Paste the Apps Script web app /exec URL here, keep the quotes.
   Deploy steps: Website/_apps_script/call_request/DEPLOY.md */
var CALL_REQUEST_ENDPOINT = 'PASTE_APPS_SCRIPT_EXEC_URL_HERE';

(function () {
  'use strict';
  var form = document.getElementById('call-request');
  if (!form) return;
  var summary = document.getElementById('cr-summary');
  var done = document.getElementById('cr-done');
  var fail = document.getElementById('cr-fail');
  var button = form.querySelector('.cr-submit');
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var PHONE = /^[0-9+().\-\s xXextEXT]{7,40}$/;
  var FIELDS = [
    { id: 'cr-name', key: 'name', label: 'Name', required: true, max: 120 },
    { id: 'cr-company', key: 'company', label: 'Company or firm', required: true, max: 160 },
    { id: 'cr-email', key: 'email', label: 'Email', required: true, max: 254, test: EMAIL, bad: 'Enter an email address like name@company.com.' },
    { id: 'cr-phone', key: 'phone', label: 'Phone', required: false, max: 40, test: PHONE, bad: 'Enter a phone number using digits, spaces and + ( ) - only, or leave it blank.' },
    { id: 'cr-reason', key: 'reason', label: 'Reason for the call', required: true, max: 2000 }
  ];

  function endpointReady() {
    return typeof CALL_REQUEST_ENDPOINT === 'string' && /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(CALL_REQUEST_ENDPOINT);
  }

  function setError(f, el, msg) {
    var err = document.getElementById(f.id + '-error');
    if (msg) {
      el.setAttribute('aria-invalid', 'true');
      el.setAttribute('aria-describedby', f.id + '-error');
      err.textContent = msg; err.hidden = false;
    } else {
      el.removeAttribute('aria-invalid');
      el.removeAttribute('aria-describedby');
      err.textContent = ''; err.hidden = true;
    }
  }

  function check(f, el) {
    var v = (el.value || '').trim();
    if (f.required && !v) return f.label + ' is required.';
    if (v && v.length > f.max) return f.label + ' is too long. Keep it under ' + f.max + ' characters.';
    if (v && f.test && !f.test.test(v)) return f.bad;
    return '';
  }

  function validate() {
    var errors = [], data = {};
    FIELDS.forEach(function (f) {
      var el = document.getElementById(f.id), v = (el.value || '').trim(), msg = check(f, el);
      setError(f, el, msg);
      if (msg) errors.push({ f: f, el: el, msg: msg });
      data[f.key] = v;
    });
    return { errors: errors, data: data };
  }

  function showSummary(errors) {
    summary.innerHTML = '';
    if (!errors.length) { summary.hidden = true; return; }
    var p = document.createElement('p');
    p.textContent = errors.length === 1 ? 'One field needs attention.' : errors.length + ' fields need attention.';
    var ul = document.createElement('ul');
    errors.forEach(function (e) {
      var li = document.createElement('li'), a = document.createElement('a');
      a.href = '#' + e.f.id; a.textContent = e.msg;
      a.addEventListener('click', function (ev) { ev.preventDefault(); e.el.focus(); });
      li.appendChild(a); ul.appendChild(li);
    });
    summary.appendChild(p); summary.appendChild(ul); summary.hidden = false;
  }

  function showDone() {
    form.hidden = true; summary.hidden = true; fail.hidden = true; done.hidden = false;
    var h = done.querySelector('h2'); if (h) h.focus();
  }
  function showFail() {
    fail.hidden = false; button.disabled = false; button.removeAttribute('aria-busy');
    fail.setAttribute('tabindex', '-1'); fail.focus();
  }

  /* An error clears while the reader types the fix, never on blur: clearing on blur collapsed the
     error line under a pointer already pressed on Submit, the button moved, and the first click
     missed it (round 5, V2). A message is never swapped for another mid-typing; the next submit
     re-validates everything. */
  FIELDS.forEach(function (f) {
    var el = document.getElementById(f.id);
    el.addEventListener('input', function () {
      if (el.getAttribute('aria-invalid') === 'true' && !check(f, el)) setError(f, el, '');
    });
  });

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    fail.hidden = true;
    var r = validate();
    showSummary(r.errors);
    if (r.errors.length) { r.errors[0].el.focus(); return; }
    var hp = document.getElementById('cr-website');
    if (hp && hp.value) { showDone(); return; }          /* a bot filled the trap: look done, send nothing */
    if (!endpointReady()) { showFail(); return; }         /* placeholder endpoint: never pretend */
    var body = r.data; body.page = 'request-a-call'; body.website = '';
    button.disabled = true; button.setAttribute('aria-busy', 'true');
    fetch(CALL_REQUEST_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' })
      .then(function (res) {
        return res.text().then(function (t) {
          var j = null; try { j = JSON.parse(t); } catch (e) { j = null; }
          if (j && j.ok === true) return showDone();
          if (j && j.ok === false) return showFail();
          if (res.ok) return showDone();
          showFail();
        });
      })
      .catch(showFail);
  });
})();
