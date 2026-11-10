/*
 * Skybound - shared pop-up helpers (used by locale.js and exit.js).
 */

// Runs fn once the page transition has finished, or straight away if the page has none.
export function afterTransition(fn) {
  var root = document.documentElement;
  var panel = document.querySelector('[data-transition-panel]');
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.querySelector('[data-transition-wrap]') || !panel || reduced) return fn();

  var done = false;
  var finish = function () { if (!done) { done = true; fn(); } };
  var started = Date.now();
  (function check() {
    if (done) return;
    // The transition removes is-covered at the start, then hides the panel at the end.
    var ended = !root.classList.contains('is-covered') && window.getComputedStyle(panel).visibility === 'hidden';
    if (ended || Date.now() - started > 10000) return finish();
    setTimeout(check, 150);
  })();
}

// Runs fn once the Lumos modal system knows the pop-up with this id.
export function whenModalReady(id, fn) {
  var tries = 0;
  (function check() {
    var list = window.lumos && window.lumos.modal && window.lumos.modal.list;
    if (list && list[id]) return fn();
    if (++tries < 50) setTimeout(check, 100);
  })();
}

// True while any pop-up (dialog) is open.
export function anyModalOpen() {
  return !!document.querySelector('dialog[open]');
}

// Search engines and other robots never get pop-ups.
export function isRobot() {
  return navigator.webdriver === true || /bot|crawl|spider|slurp|preview|lighthouse|headless/i.test(navigator.userAgent || '');
}
