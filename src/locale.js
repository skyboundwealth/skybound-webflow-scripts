/*!
 * Skybound - locale.js
 * Shows the region pop-up when a visitor seems to be on the wrong locale.
 * It uses the visitor's country from the Worker (one lookup per visit, shared with phone.js).
 *
 * Webflow:
 *   The locale pop-up is a Lumos modal: data-modal-target = locale-switcher
 *   Inside it: Webflow's Locales List, one item per locale, each with a Locale Link.
 *   Heading:   data-locale-the      (holds "the ")
 *              data-locale-country  (holds the country name)
 *   Card:      .locale_switcher_element and .locale_switcher_recommended get is-active
 *              on the recommended locale. .locale_switcher_flag img gets the flag (optional).
 *
 * It waits until the page transition has finished, then a short pause.
 * The visitor's choice is remembered for 30 days (pick a region, close the pop-up,
 * or land on the right locale for their country).
 *
 * Test: add ?sb-country=fr to the page address. The saved choice is ignored while testing.
 * Settings: window.SB_CONFIG.locale
 */
import './geo.js';

(function () {
  var CONFIG = window.SB_CONFIG || {};
  var OPT = CONFIG.locale || {};
  function pick(value, fallback) { return value === undefined || value === null ? fallback : value; }

  var MODAL_ID = pick(OPT.modalId, 'locale-switcher');     // data-modal-target of the pop-up
  var DELAY_MS = pick(OPT.delayMs, 800);                     // Pause after the page transition
  var REMEMBER_DAYS = pick(OPT.rememberDays, 30);            // How long the choice is kept
  var FLAGS = pick(OPT.flags, {});                           // { '': url, uk: url, usa: url, ... }
  var COOKIE = 'sb_locale';

  // Locale folders. '' = International (no folder).
  var FOLDERS = ['uk', 'usa', 'europe', 'switzerland'];

  // Country (2-letter code) to locale folder. Anything not listed goes to International.
  var EU = ['at', 'be', 'bg', 'hr', 'cy', 'cz', 'dk', 'ee', 'fi', 'fr', 'de', 'gr', 'hu', 'ie',
            'it', 'lv', 'lt', 'lu', 'mt', 'nl', 'pl', 'pt', 'ro', 'sk', 'si', 'es', 'se'];
  function folderFor(country) {
    if (country === 'gb') return 'uk';
    if (country === 'us') return 'usa';
    if (country === 'ch') return 'switzerland';
    if (EU.indexOf(country) !== -1) return 'europe';
    return '';
  }

  // Country names that read better with "the" in front.
  var USES_THE = ['gb', 'us', 'ae', 'nl', 'ph', 'bs', 'gm', 'do', 'mv', 'ky', 'vg', 'vi', 'mh',
                  'sb', 'tc', 'fk', 'fo', 'im', 'km', 'cf'];
  // Shorter names where the browser's own name is awkward.
  var NAMES = { hk: 'Hong Kong', mo: 'Macau', cd: 'Democratic Republic of the Congo', cg: 'Republic of the Congo' };

  function countryName(code) {
    if (NAMES[code]) return NAMES[code];
    try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) || code.toUpperCase(); }
    catch (e) { return code.toUpperCase(); }
  }

  // The first part of an address, if it is a locale folder. '' = International.
  function folderOf(pathname) {
    var first = (pathname || '/').split('/')[1] || '';
    return FOLDERS.indexOf(first) !== -1 ? first : '';
  }

  function readChoice() {
    var m = document.cookie.match('(?:^|; )' + COOKIE + '=([^;]*)');
    return m ? decodeURIComponent(m[1]) : null;
  }
  function saveChoice(value) {
    document.cookie = COOKIE + '=' + encodeURIComponent(value) + '; max-age=' + (REMEMBER_DAYS * 86400) + '; path=/; SameSite=Lax';
  }

  // Search engines and other robots never get the pop-up.
  function isRobot() {
    return navigator.webdriver === true || /bot|crawl|spider|slurp|preview|lighthouse|headless/i.test(navigator.userAgent || '');
  }

  // Changes the text in the deepest element, so italic and bold stay.
  function setText(el, text) {
    var target = el;
    while (target.firstElementChild) target = target.lastElementChild;
    target.textContent = text;
  }

  // Runs fn once the page transition has finished (or straight away if there is none).
  function afterTransition(fn) {
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

  // Waits for the Lumos modal system to know the pop-up.
  function whenModalReady(fn) {
    var tries = 0;
    (function check() {
      var list = window.lumos && window.lumos.modal && window.lumos.modal.list;
      if (list && list[MODAL_ID]) return fn();
      if (++tries < 50) setTimeout(check, 100);
    })();
  }

  function init() {
    var modal = document.querySelector('[data-modal-target="' + MODAL_ID + '"]');
    if (!modal) return;

    var items = Array.prototype.slice.call(modal.querySelectorAll('.w-locales-item')).map(function (item) {
      var link = item.querySelector('a[href]');
      var folder = '';
      if (link) {
        try { folder = folderOf(new URL(link.href, window.location.href).pathname); } catch (e) {}
      }
      return { item: item, link: link, folder: folder };
    });

    // Flags, if set in SB_CONFIG.locale.flags.
    items.forEach(function (c) {
      var img = c.item.querySelector('.locale_switcher_flag img');
      if (img && FLAGS[c.folder]) img.src = FLAGS[c.folder];
    });

    // Picking a region, or closing the pop-up, is remembered.
    items.forEach(function (c) {
      if (c.link) c.link.addEventListener('click', function () { saveChoice(c.folder || 'international'); });
    });
    if (modal.tagName === 'DIALOG') {
      modal.addEventListener('close', function () { if (!readChoice()) saveChoice('stay'); });
    }

    var testing = window.SBGeo.isTest();
    var current = folderOf(window.location.pathname);

    window.SBGeo.country().then(function (country) {
      if (!country) return; // Unknown country: do nothing.
      var best = folderFor(country);

      // Fill in the heading and mark the recommended card (also used when the nav opens the pop-up).
      var theEl = modal.querySelector('[data-locale-the]');
      var nameEl = modal.querySelector('[data-locale-country]');
      if (nameEl) setText(nameEl, countryName(country));
      if (theEl) {
        var useThe = USES_THE.indexOf(country) !== -1;
        setText(theEl, useThe ? 'the ' : '');
        theEl.style.display = useThe ? '' : 'none';
      }
      items.forEach(function (c) {
        var on = c.folder === best;
        ['.locale_switcher_element', '.locale_switcher_recommended'].forEach(function (sel) {
          var el = c.item.querySelector(sel);
          if (el) el.classList.toggle('is-active', on);
        });
      });

      // Already on the right locale: remember it, so a later link to another locale does not open the pop-up.
      if (best === current) {
        if (!testing && !readChoice()) saveChoice(current || 'international');
        return;
      }
      // Open it only on the wrong locale, not for robots, and not if they already chose.
      if (!testing && (readChoice() || isRobot())) return;
      // That locale is not live yet (no card for it). While testing, show it anyway.
      if (!testing && !items.some(function (c) { return c.folder === best; })) return;

      afterTransition(function () {
        setTimeout(function () {
          whenModalReady(function () { window.lumos.modal.open(MODAL_ID); });
        }, DELAY_MS);
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
