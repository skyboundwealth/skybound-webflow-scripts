/*!
 * Skybound forms - form.js
 * Sends Webflow forms (with data-hub-form) to the Cloudflare Worker, with spam checks,
 * Turnstile, ad tracking (UTMs, 30 days, needs Consent Pro "Marketing"), page slug and locale.
 * Shows the Webflow success / error message. No redirect.
 *
 * Webflow, on the Form element:
 *   data-hub-form = true
 *   data-form-key = KEY
 * Optional: an empty div with data-hub-turnstile, to choose where Turnstile sits.
 *
 * Signals for other scripts: hub:before-submit, hub:success (on the form).
 * Settings: window.SB_CONFIG.workerUrl, .turnstileSiteKey, .form
 */
(function () {
  // Settings come from window.SB_CONFIG in the Webflow footer.
  var CONFIG = window.SB_CONFIG || {};
  var OPT = CONFIG.form || {};
  function pick(value, fallback) { return value === undefined || value === null ? fallback : value; }

  var WORKER_URL = CONFIG.workerUrl || '';
  var TURNSTILE_SITE_KEY = CONFIG.turnstileSiteKey || '';
  if (!WORKER_URL || !TURNSTILE_SITE_KEY) {
    console.warn('[Skybound forms] Set workerUrl and turnstileSiteKey in window.SB_CONFIG.');
  }

  var SEND_TIMEOUT_MS = pick(OPT.sendTimeoutMs, 15000); // Show the error message if no answer in time.
  var TOKEN_WAIT_MS = pick(OPT.tokenWaitMs, 5000);      // Wait for Turnstile when the person clicks send.

  // Shared with the phone picker script.
  window.SB_WORKER_URL = WORKER_URL;

  // ===== AD TRACKING (UTM) =====
  // Which address queries to keep. Override with SB_CONFIG.form.trackedParams.
  var TRACKED_PARAMS = pick(OPT.trackedParams, [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
    'gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'li_fat_id', 'ttclid'
  ]);
  var ATTRIBUTION_DAYS = pick(OPT.attributionDays, 30);     // How long to remember them.
  var ATTRIBUTION_MODE = pick(OPT.attributionMode, 'last'); // 'last' = newest ad visit wins. 'first' = first one wins.

  // The script only saves tracking data in the browser when this returns true.
  // UK law (PECR) treats browser storage like cookies, so this reads the
  // "Marketing" choice from Finsweet Consent Pro. Without consent, nothing is
  // saved, but queries on the same page as the form are still sent.
  function hasConsent() {
    var cp = window.FinsweetConsentPro;
    if (!cp || Array.isArray(cp) || !cp.consents) return false;
    try {
      if (typeof cp.consents.get === 'function') {
        var choices = cp.consents.get();
        if (choices && typeof choices.marketing === 'boolean') return choices.marketing;
      }
      return cp.consents.marketing === true;
    } catch (e) {
      return false;
    }
  }
  // ==============================

  var FORM_SELECTOR = 'form[data-hub-form]';
  var HONEYPOT_NAME = 'website_url';
  var STORAGE_KEY = 'sb_attribution';

  // ---- Ad tracking: runs on every page, with or without a form ----

  function readTrackedQueries() {
    var params = new URLSearchParams(window.location.search);
    var out = {};
    var found = false;
    TRACKED_PARAMS.forEach(function (name) {
      var value = params.get(name);
      if (value && value.trim()) {
        out[name] = value.trim().slice(0, 500);
        found = true;
      }
    });
    return found ? out : null;
  }

  function loadAttribution() {
    if (!hasConsent()) return null;
    try {
      var saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      if (!saved || !saved.params || typeof saved.expires !== 'number') return null;
      if (Date.now() > saved.expires) {
        window.localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return saved;
    } catch (e) {
      return null;
    }
  }

  function saveAttribution(record) {
    if (!hasConsent()) return false;
    try {
      if (ATTRIBUTION_MODE === 'first' && loadAttribution()) return true;
      var copy = {
        params: record.params,
        landing_page: record.landing_page,
        captured_at: record.captured_at,
        expires: Date.now() + ATTRIBUTION_DAYS * 24 * 60 * 60 * 1000
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(copy));
      return true;
    } catch (e) {
      return false;
    }
  }

  // Tracking data from this page's address, if any.
  var currentQueries = readTrackedQueries();
  var currentRecord = currentQueries ? {
    params: currentQueries,
    landing_page: getPageSlug(),
    captured_at: new Date().toISOString()
  } : null;
  var currentSaved = currentRecord ? saveAttribution(currentRecord) : false;

  function trySaveCurrent() {
    if (currentRecord && !currentSaved) currentSaved = saveAttribution(currentRecord);
  }

  // Consent Pro loads after this script. Save once it is ready.
  window.FinsweetConsentPro = window.FinsweetConsentPro || [];
  if (Array.isArray(window.FinsweetConsentPro)) {
    window.FinsweetConsentPro.push(['consent', trySaveCurrent]);
  } else {
    trySaveCurrent();
  }

  // The person changes their cookie choice.
  document.documentElement.addEventListener('consentpro:consent-updated', function () {
    if (hasConsent()) {
      trySaveCurrent();
    } else {
      // Marketing consent removed: delete saved tracking data.
      try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      currentSaved = false;
    }
  });

  // Last chance: save when the person leaves the page.
  window.addEventListener('pagehide', trySaveCurrent);

  // Pick which tracking data goes with the form.
  function getAttribution() {
    var saved = loadAttribution();
    if (ATTRIBUTION_MODE === 'first') return saved || currentRecord;
    return currentRecord || saved;
  }

  // ---- Forms ----

  var forms = Array.prototype.slice.call(document.querySelectorAll(FORM_SELECTOR));
  if (!forms.length) return;

  var state = new WeakMap();

  // The form key is the last part of the page address (the slug),
  // unless the form has its own data-form-key attribute.
  function getFormKey(form) {
    var override = form.getAttribute('data-form-key');
    if (override && override.trim()) return override.trim();
    var parts = window.location.pathname.split('/').filter(Boolean);
    return parts.length ? decodeURIComponent(parts[parts.length - 1]) : 'home';
  }

  // Everything after the domain, with no slashes at the start or end.
  // Example: /fr/webinars/my-webinar/ -> fr/webinars/my-webinar
  // The home page gives "home".
  function getPageSlug() {
    var path = window.location.pathname.replace(/^\/+|\/+$/g, '');
    try { path = decodeURIComponent(path); } catch (e) {}
    return path || 'home';
  }

  // Hidden field that people do not see. Bots fill it in.
  function addHoneypot(form) {
    var wrap = document.createElement('div');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText = 'position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;';
    var input = document.createElement('input');
    input.type = 'text';
    input.name = HONEYPOT_NAME;
    input.tabIndex = -1;
    input.autocomplete = 'off';
    input.value = '';
    wrap.appendChild(input);
    form.appendChild(wrap);
  }

  // Place for the Turnstile check.
  // 1. Inside an element with data-hub-turnstile, if the form has one.
  // 2. Otherwise just above the whole submit button block (not inside it,
  //    so it does not break buttons built from layered parts).
  function addTurnstileSlot(form) {
    var slot = document.createElement('div');
    slot.className = 'hub-turnstile';

    var target = form.querySelector('[data-hub-turnstile]');
    if (target) {
      target.appendChild(slot);
      return slot;
    }

    var block = form.querySelector('[type="submit"]');
    while (block && block.parentNode && block.parentNode !== form) block = block.parentNode;
    if (block && block.parentNode === form) {
      form.insertBefore(slot, block);
    } else {
      form.appendChild(slot);
    }
    return slot;
  }

  function getLabel(button) {
    if (!button) return '';
    return button.tagName === 'INPUT' ? button.value : button.textContent;
  }

  function setLabel(button, text) {
    if (!button) return;
    if (button.tagName === 'INPUT') button.value = text;
    else button.textContent = text;
  }

  // Read all form fields. Fields with the same name become a list.
  function collect(form) {
    var data = {};
    new FormData(form).forEach(function (value, key) {
      if (key === 'cf-turnstile-response' || key === 'g-recaptcha-response') return;
      if (typeof value !== 'string') return; // skip file uploads
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        data[key] = [].concat(data[key], value);
      } else {
        data[key] = value;
      }
    });
    return data;
  }

  function handleSubmit(form) {
    var s = state.get(form);
    if (!s || s.busy) return;

    var wrapper = form.closest('.w-form');
    var done = wrapper ? wrapper.querySelector('.w-form-done') : null;
    var fail = wrapper ? wrapper.querySelector('.w-form-fail') : null;
    var button = form.querySelector('[type="submit"]');
    var originalLabel = getLabel(button);

    function showFail() {
      if (fail) fail.style.display = 'block';
      setLabel(button, originalLabel);
      s.busy = false;
      if (window.turnstile && s.widgetId !== null) window.turnstile.reset(s.widgetId);
    }

    function showDone() {
      form.style.display = 'none';
      if (fail) fail.style.display = 'none';
      if (done) done.style.display = 'block';
    }

    if (fail) fail.style.display = 'none';

    // Signal for other scripts (like the phone picker) to update their fields.
    form.dispatchEvent(new CustomEvent('hub:before-submit', { bubbles: true }));

    // Stop if any field is not valid, and show the browser's message.
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    s.busy = true;
    var waitLabel = button ? button.getAttribute('data-wait') : null;
    if (waitLabel) setLabel(button, waitLabel);

    // Turnstile runs out of sight. Wait up to a few seconds for its answer.
    waitForToken(s, TOKEN_WAIT_MS, function (token) {
      if (!token) return showFail();
      send(token);
    });

    function send(token) {
    var payload = collect(form);
    if (!payload.form_key) payload.form_key = getFormKey(form);
    payload.page_url = window.location.href;
    payload.page_slug = getPageSlug();
    payload.locale = document.documentElement.getAttribute('lang') || '';

    // Add ad tracking data. It never replaces a field the form already has.
    var attribution = getAttribution();
    if (attribution) {
      Object.keys(attribution.params).forEach(function (name) {
        if (!Object.prototype.hasOwnProperty.call(payload, name)) {
          payload[name] = attribution.params[name];
        }
      });
      payload.landing_page = attribution.landing_page;
      payload.attribution_captured_at = attribution.captured_at;
    }
    payload._elapsed = Date.now() - s.loadedAt;
    payload._turnstile = token;

    // Give up after SEND_TIMEOUT_MS and show the error message.
    var controller = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, SEND_TIMEOUT_MS);

    fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) {
        return res.json()
          .catch(function () { return {}; })
          .then(function (body) { return res.ok && body.ok === true; });
      })
      .then(function (ok) {
        clearTimeout(timer);
        if (!ok) return showFail();
        showDone();

        // Tell Google Tag Manager. No names or emails are sent.
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: 'form_submit',
          form_key: payload.form_key,
          page_slug: payload.page_slug
        });

        // Signal for other scripts (like the video unlock) that the form was sent.
        form.dispatchEvent(new CustomEvent('hub:success', {
          bubbles: true,
          detail: { formKey: payload.form_key }
        }));
      })
      .catch(function () {
        clearTimeout(timer);
        showFail();
      });
    }
  }

  // Checks for a Turnstile answer every 200 ms, up to maxMs.
  function waitForToken(s, maxMs, done) {
    var started = Date.now();
    (function check() {
      var token = (window.turnstile && s.widgetId !== null) ? window.turnstile.getResponse(s.widgetId) : '';
      if (token) return done(token);
      if (Date.now() - started >= maxMs) return done('');
      setTimeout(check, 200);
    })();
  }

  // Set up each form.
  forms.forEach(function (form) {
    addHoneypot(form);
    state.set(form, {
      loadedAt: Date.now(),
      slot: addTurnstileSlot(form),
      widgetId: null,
      busy: false
    });
  });

  // Stop Webflow's own send. Use ours instead.
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!(form instanceof HTMLFormElement) || !form.matches(FORM_SELECTOR)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    handleSubmit(form);
  }, true);

  // Load Turnstile, then show one check in each form.
  window.hubTurnstileReady = function () {
    forms.forEach(function (form) {
      var s = state.get(form);
      // 'interaction-only': the box only shows if Cloudflare needs the person to click.
      s.widgetId = window.turnstile.render(s.slot, {
        sitekey: TURNSTILE_SITE_KEY,
        appearance: 'interaction-only'
      });
    });
  };

  var ts = document.createElement('script');
  ts.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=hubTurnstileReady';
  ts.async = true;
  document.head.appendChild(ts);
})();
