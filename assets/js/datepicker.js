// Shared date picker helper. Replaces the native browser date input with a
// flatpickr calendar styled to match the Inspirare theme. Exposes
// window.InspirareDatePicker.initAll(root) which converts every
// <input type="date"> inside `root` (default: document) into a flatpickr
// input. Re-call after dynamically adding more date inputs.
//
// The flatpickr CSS and JS are loaded lazily on the first call to keep
// page load fast when the user never opens a date picker.

(function () {
  'use strict';

  var FLATPICKR_CSS = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css';
  var FLATPICKR_JS  = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.js';
  var LOCALE_JS     = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/l10n/pt.js';

  var flatpickrPromise = null;
  var flatpickrReady = false;
  var pendingInputs = [];

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function loadStyle(href) {
    return new Promise(function (resolve, reject) {
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.onload = function () { resolve(); };
      l.onerror = function () { resolve(); /* non-fatal: still try to run */ };
      document.head.appendChild(l);
    });
  }

  function ensureFlatpickrLoaded() {
    if (flatpickrReady) return Promise.resolve();
    if (flatpickrPromise) return flatpickrPromise;
    flatpickrPromise = Promise.all([
      loadStyle(FLATPICKR_CSS),
      loadScript(LOCALE_JS).catch(function () { /* locale optional */ }),
      loadScript(FLATPICKR_JS),
    ]).then(function () {
      // flatpickr is exposed on window. Pull the locale module if loaded.
      try { window.flatpickr.localize(window.flatpickr.l10ns.pt); } catch (_e) { /* ignore */ }
      flatpickrReady = true;
    }).catch(function (err) {
      flatpickrPromise = null;
      throw err;
    });
    return flatpickrPromise;
  }

  function initOne(input) {
    if (!input || input.type !== 'date') return;
    // Avoid double-init: flatpickr stores a `_flatpickr` property on the input.
    if (input._flatpickr) return;
    if (typeof window.flatpickr !== 'function') {
      pendingInputs.push(input);
      return;
    }
    var isDisabled = input.disabled || input.hasAttribute('disabled');
    window.flatpickr(input, {
      dateFormat: 'Y-m-d',     // value stays in the same wire format
      allowInput: true,        // user can still type the date manually
      disableMobile: true,     // always use our popup, not the OS one
      locale: window.flatpickr.l10ns && window.flatpickr.l10ns.pt
        ? window.flatpickr.l10ns.pt
        : 'pt',
      clickOpens: !isDisabled,
      // Keep the icon trigger next to the input — flatpickr renders its own
      // by default, but the native one is hidden when flatpickr takes over.
    });
  }

  function initAll(root) {
    root = root || document;
    var inputs = root.querySelectorAll('input[type="date"]');
    inputs.forEach(initOne);
  }

  function flushPending() {
    var pending = pendingInputs.splice(0);
    pending.forEach(initOne);
  }

  function init(root) {
    ensureFlatpickrLoaded().then(function () {
      flushPending();
      initAll(root);
    }).catch(function (err) {
      console.warn('[datepicker] flatpickr failed to load, using native input:', err);
    });
  }

  // Re-init when new inputs are added later. Call window.InspirareDatePicker.init()
  // from anywhere — it's safe to call multiple times; already-initialized inputs
  // are skipped.
  window.InspirareDatePicker = {
    init: init,
    initAll: initAll,
  };

  // Auto-run on DOMContentLoaded so the static inputs (admin price cards,
  // "new note" input, etc.) get picked up without the caller doing anything.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(document); });
  } else {
    init(document);
  }
})();
