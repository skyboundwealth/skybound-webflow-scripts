/*!
 * Skybound forms — video-unlock.js
 * Soft gate for on-demand videos. Load it only on the on-demand page template.
 *
 * Webflow (same KEY on all):
 *   Form element:            data-unlock = KEY
 *   Cover div over video:    data-unlock-cover = KEY
 *   Optional, form section:  data-unlock-hide = KEY   (hidden on return visits)
 * Email link: add ?access=KEY to the page address.
 * Unlocks are remembered for 30 days in this browser.
 *
 * Settings: window.SB_CONFIG.video
 */
(function () {
  // Settings come from window.SB_CONFIG.video in the Webflow footer (all optional).
  var OPT = (window.SB_CONFIG || {}).video || {};
  function pick(value, fallback) { return value === undefined || value === null ? fallback : value; }

  var UNLOCK_DAYS = pick(OPT.unlockDays, 30);
  var LINK_PARAM = pick(OPT.linkParam, 'access');
  var STORAGE_KEY = 'sb_unlocked';

  function loadUnlocks() {
    try {
      var saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || {};
      var now = Date.now();
      var live = {};
      Object.keys(saved).forEach(function (key) {
        if (typeof saved[key] === 'number' && saved[key] > now) live[key] = saved[key];
      });
      return live;
    } catch (e) {
      return {};
    }
  }

  function saveUnlock(key) {
    try {
      var saved = loadUnlocks(); // Also drops old, expired ones.
      saved[key] = Date.now() + UNLOCK_DAYS * 24 * 60 * 60 * 1000;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch (e) {}
  }

  function eachWithValue(attr, key, fn) {
    Array.prototype.slice.call(document.querySelectorAll('[' + attr + ']')).forEach(function (el) {
      if ((el.getAttribute(attr) || '').trim() === key) fn(el);
    });
  }

  function unlock(key, onLoad) {
    eachWithValue('data-unlock-cover', key, function (el) { el.remove(); });
    if (onLoad) {
      eachWithValue('data-unlock-hide', key, function (el) { el.style.display = 'none'; });
    }
    document.dispatchEvent(new CustomEvent('hub:unlocked', { detail: { key: key } }));
  }

  // Keys used by covers on this page.
  var keys = [];
  Array.prototype.slice.call(document.querySelectorAll('[data-unlock-cover]')).forEach(function (el) {
    var key = (el.getAttribute('data-unlock-cover') || '').trim();
    if (key && keys.indexOf(key) === -1) keys.push(key);
  });

  // On page load: unlock from saved data or from the email link.
  var saved = loadUnlocks();
  var fromLink = (new URLSearchParams(window.location.search).get(LINK_PARAM) || '').trim();
  keys.forEach(function (key) {
    if (saved[key]) {
      unlock(key, true);
    } else if (fromLink && fromLink === key) {
      saveUnlock(key);
      unlock(key, true);
    }
  });

  // After the form script says the form was sent.
  document.addEventListener('hub:success', function (e) {
    var form = e.target;
    var key = form && form.getAttribute ? (form.getAttribute('data-unlock') || '').trim() : '';
    if (!key) return;
    saveUnlock(key);
    unlock(key, false); // Keep the form visible, so they see the success message.
  });
})();
