/*!
 * Skybound - exit.js
 * Exit pop-up, only for visitors who arrive with ?popup=NAME in the page address.
 * No query: it does nothing.
 *
 * Webflow:
 *   The pop-up is a Lumos modal: data-modal-target = exit-NAME
 *   Example: ?popup=newsletter opens the modal with data-modal-target = exit-newsletter
 *
 * When it opens (landing page only, once, then not again for 30 days):
 *   Desktop: the mouse leaves through the top of the window.
 *   Phones:  a fast, long scroll up after scrolling well down the page.
 *            Not when the scroll ends near the top (tapping the top bar to jump up).
 * It starts watching 4 seconds after the page transition has finished.
 * Never on top of another pop-up, never while someone is filling in a form,
 * and never after a form was sent on this page.
 *
 * GTM events: exit_popup_shown, exit_popup_closed.
 * Test: add &popup-test to the address. The 30-day memory is ignored.
 * Settings: window.SB_CONFIG.exit
 */
import { afterTransition, whenModalReady, anyModalOpen, isRobot, track, watchDialog } from './ui.js';

(function () {
  var CONFIG = window.SB_CONFIG || {};
  var OPT = CONFIG.exit || {};
  function pick(value, fallback) { return value === undefined || value === null ? fallback : value; }

  var START_AFTER_MS = pick(OPT.startAfterMs, 4000); // Wait after the page transition before watching
  var REMEMBER_DAYS = pick(OPT.rememberDays, 30);    // Not shown again for this many days
  var DEPTH = pick(OPT.mobileDepth, 1.5);            // Phones: must have scrolled this many screens down
  var UP_SCREENS = pick(OPT.mobileUpScreens, 0.35);  // Phones: scroll up at least this much of a screen...
  var UP_WITHIN_MS = pick(OPT.mobileUpWithinMs, 400);// ...within this time

  var params = new URLSearchParams(window.location.search);
  var name = (params.get('popup') || '').toLowerCase();
  if (!/^[a-z0-9-]{1,40}$/.test(name)) return; // No (valid) query: do nothing.

  var modalId = 'exit-' + name;
  var modal = document.querySelector('[data-modal-target="' + modalId + '"]');
  if (!modal) return;
  if (isRobot()) return;

  var testing = params.has('popup-test');
  var KEY = 'sb_exit_' + name;

  function shownRecently() {
    try {
      var at = parseInt(window.localStorage.getItem(KEY), 10);
      return at && Date.now() - at < REMEMBER_DAYS * 86400000;
    } catch (e) { return false; }
  }
  function remember() {
    try { window.localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
  }
  if (!testing && shownRecently()) return;

  var watching = false;
  var shown = false;
  var formSent = false;
  document.addEventListener('hub:success', function () { formSent = true; });

  // True while the visitor is typing in a form or has a dropdown open.
  function busyInForm() {
    var el = document.activeElement;
    if (el && el.closest && el.closest('form') && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(el.tagName)) return true;
    return !!document.querySelector('.sb-sel.is-open');
  }

  function canShow() {
    return watching && !shown && !formSent && !anyModalOpen() && !busyInForm();
  }

  function show() {
    shown = true;
    if (!testing) remember();
    whenModalReady(modalId, function () {
      if (!anyModalOpen()) window.lumos.modal.open(modalId);
    });
  }

  var hasMouse = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // For GTM. A form sent from inside the pop-up shows as form_submit with modal = exit-NAME.
  if (modal.tagName === 'DIALOG') {
    watchDialog(modal, function (open) {
      track(open ? 'exit_popup_shown' : 'exit_popup_closed', {
        popup_name: name,
        popup_device: hasMouse ? 'desktop' : 'mobile'
      });
    });
  }

  if (hasMouse) {
    // Desktop: the mouse leaves the page through the top (towards the tabs or address bar).
    document.addEventListener('mouseout', function (e) {
      if (!e.relatedTarget && e.clientY <= 0 && canShow()) show();
    });
  } else {
    // Phones: a fast, long scroll up, after scrolling well down the page.
    var maxY = 0;
    var samples = [];
    var candidate = false;
    var settleTimer = 0;

    window.addEventListener('scroll', function () {
      var y = window.scrollY;
      var now = Date.now();
      var screen = window.innerHeight || 1;
      if (y > maxY) maxY = y;

      samples.push({ y: y, t: now });
      while (samples.length && now - samples[0].t > UP_WITHIN_MS) samples.shift();
      var highest = samples.reduce(function (m, s) { return Math.max(m, s.y); }, y);
      if (watching && maxY >= DEPTH * screen && highest - y >= UP_SCREENS * screen) candidate = true;

      // Decide once the scroll has stopped. A jump to the top (tapping the top bar)
      // ends near the top, so it does not count.
      clearTimeout(settleTimer);
      settleTimer = setTimeout(function () {
        if (candidate && window.scrollY > 0.5 * screen && canShow()) show();
        candidate = false;
      }, 250);
    }, { passive: true });
  }

  afterTransition(function () {
    setTimeout(function () { watching = true; }, START_AFTER_MS);
  });
})();
