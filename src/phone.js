/*!
 * Skybound forms - phone.js
 * Dial code inside the phone field, with flags. Desktop: designed dropdown (needs select.js).
 * Phones: the browser's own picker. Number checks by intl-tel-input v25.4.3 (from cdnjs).
 *
 * Webflow, on each phone input:
 *   data-phone-picker = true      (or a 2-letter code, like ae, to always start there)
 *
 * For a phone field named "Phone", the form sends:
 *   Phone          what they typed, like 07911 123456
 *   Phone_country  the 2-letter country code, like gb
 *   Phone_full     the full number, like +447911123456
 *
 * Settings: window.SB_CONFIG.phone
 */
(function () {
  // Settings come from window.SB_CONFIG.phone in the Webflow footer (all optional).
  var CONFIG = window.SB_CONFIG || {};
  var OPT = CONFIG.phone || {};
  function pick(value, fallback) { return value === undefined || value === null ? fallback : value; }

  var DEFAULT_COUNTRY = pick(OPT.defaultCountry, 'gb');                 // Start country when none is known.
  var COUNTRY_ORDER = pick(OPT.countryOrder, ['gb', 'ae', 'ch', 'us']); // These go to the top of the list.
  var INVALID_MESSAGE = pick(OPT.invalidMessage, 'Please enter a valid phone number.');
  var SHOW_FLAGS = pick(OPT.showFlags, true);                           // false = show only the dial code.
  var COUNTRY_WAIT_MS = pick(OPT.countryWaitMs, 1500);                  // Max wait for the visitor's country.
  var VERSION = '25.4.3';                                               // intl-tel-input version.

  var inputs = Array.prototype.slice.call(document.querySelectorAll('input[data-phone-picker]'));
  if (!inputs.length) return; // No phone fields: load nothing.

  var base = 'https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/' + VERSION + '/build/';

  // Flag images only. The library's own dropdown is not used.
  if (SHOW_FLAGS) {
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = base + 'css/intlTelInput.min.css';
    document.head.appendChild(css);
  }

  var style = document.createElement('style');
  style.textContent = [
    '.sb-phone{position:relative;display:block;}',
    '.sb-phone__prefix{position:absolute;top:0;bottom:0;display:flex;align-items:center;gap:.4em;pointer-events:none;white-space:nowrap;}',
    '.sb-phone__prefix .iti__flag{flex:none;}',
    '.sb-phone__arrow{flex:none;display:block;width:.8em;transition:rotate .2s ease;}',
    '.sb-phone__arrow svg{display:block;width:100%;height:auto;overflow:visible;}',
    '.sb-phone__select{position:absolute;top:0;bottom:0;left:0;opacity:0;cursor:pointer;font-size:16px;-webkit-appearance:none;appearance:none;border:0;margin:0;padding:0;}',
    '.sb-phone.is-focus .sb-phone__prefix{outline:2px solid currentColor;outline-offset:2px;border-radius:2px;}',
    '.sb-phone__prefix:focus{outline:none;}',
    '.sb-phone__prefix:focus-visible{outline:2px solid currentColor;outline-offset:2px;border-radius:2px;}',
    '.sb-phone.is-open .sb-phone__arrow{rotate:180deg;}'
  ].join('');
  document.head.appendChild(style);

  // Ask the Worker for the visitor's country, while the library loads.
  var ipCountry = '';
  var countryDone = false;
  var libraryDone = false;

  function startWhenReady() {
    if (countryDone && libraryDone) inputs.forEach(setUp);
  }

  function finishCountry(code) {
    if (countryDone) return;
    if (/^[a-z]{2}$/.test(code || '')) ipCountry = code;
    countryDone = true;
    startWhenReady();
  }

  var workerUrl = CONFIG.workerUrl || window.SB_WORKER_URL;
  if (workerUrl && window.fetch && !/YOUR-WORKER/.test(workerUrl)) {
    setTimeout(function () { finishCountry(''); }, COUNTRY_WAIT_MS);
    fetch(workerUrl, { method: 'GET' })
      .then(function (res) { return res.json(); })
      .then(function (body) { finishCountry(body && body.country); })
      .catch(function () { finishCountry(''); });
  } else {
    finishCountry('');
  }

  var js = document.createElement('script');
  js.src = base + 'js/intlTelInputWithUtils.min.js';
  js.onload = function () { libraryDone = true; startWhenReady(); };
  document.head.appendChild(js);

  var countries = null;

  function getCountries() {
    if (countries) return countries;
    countries = window.intlTelInput.getCountryData().slice().sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
    return countries;
  }

  function findCountry(iso2) {
    var list = getCountries();
    for (var i = 0; i < list.length; i++) if (list[i].iso2 === iso2) return list[i];
    return null;
  }

  // For numbers typed with a +: find the country from the dial code.
  function countryFromNumber(value) {
    var digits = value.replace(/\D/g, '');
    var best = null;
    getCountries().forEach(function (c) {
      if (digits.indexOf(c.dialCode) !== 0) return;
      if (!best || c.dialCode.length > best.dialCode.length ||
          (c.dialCode.length === best.dialCode.length && c.priority < best.priority)) {
        best = c;
      }
    });
    return best;
  }

  function addOption(select, c) {
    var option = document.createElement('option');
    option.value = c.iso2;
    option.textContent = c.name + ' (+' + c.dialCode + ')';
    select.appendChild(option);
  }

  function makeHidden(input, name) {
    var form = input.form;
    var existing = form ? form.querySelector('input[type="hidden"][name="' + name + '"]') : null;
    if (existing) return existing;
    var hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.name = name;
    input.parentNode.insertBefore(hidden, input.nextSibling);
    return hidden;
  }

  function setUp(input) {
    if (!window.intlTelInput || !window.intlTelInput.utils) return;
    if (input.closest('.sb-phone')) return; // Already set up.
    var utils = window.intlTelInput.utils;
    var fieldName = input.name || 'Phone';

    // Start country: the field's own setting, then the visitor's country, then the default.
    var start = (input.getAttribute('data-phone-picker') || '').trim().toLowerCase();
    if (!findCountry(start)) start = findCountry(ipCountry) ? ipCountry : DEFAULT_COUNTRY;

    // Read the field's own look, so the dial code matches it.
    var look = window.getComputedStyle(input);
    var basePadding = parseFloat(look.paddingLeft) || 0;

    // Wrap the input. The wrapper takes over the input's outer margin.
    var wrap = document.createElement('div');
    wrap.className = 'sb-phone';
    wrap.style.margin = look.margin;
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    input.style.margin = '0';

    // The visible dial code, inside the field on the left.
    var prefix = document.createElement('div');
    prefix.className = 'sb-phone__prefix';
    prefix.setAttribute('aria-hidden', 'true');
    prefix.style.left = basePadding + 'px';
    prefix.style.font = look.font;
    prefix.style.color = look.color;
    var flag = document.createElement('div');
    var code = document.createElement('span');
    var arrow = document.createElement('span');
    arrow.className = 'sb-phone__arrow';
    // Line arrow, the same shape as the other dropdowns. It spins when the list opens.
    arrow.innerHTML = '<svg viewBox="0 0 6 5" fill="none" aria-hidden="true"><path d="M0.5 1L3 3.5L5.5 1" stroke="currentColor" stroke-width="0.125rem" vector-effect="non-scaling-stroke"></path></svg>';
    if (SHOW_FLAGS) prefix.appendChild(flag);
    prefix.appendChild(code);
    prefix.appendChild(arrow);
    wrap.appendChild(prefix);

    // The real browser dropdown. Invisible, on top of the dial code.
    var select = document.createElement('select');
    select.className = 'sb-phone__select';
    select.name = fieldName + '_country';
    select.setAttribute('aria-label', 'Country dial code');
    COUNTRY_ORDER.forEach(function (iso2) {
      var c = findCountry(iso2);
      if (c) addOption(select, c);
    });
    var line = document.createElement('option');
    line.disabled = true;
    line.textContent = '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500';
    select.appendChild(line);
    getCountries().forEach(function (c) {
      if (COUNTRY_ORDER.indexOf(c.iso2) === -1) addOption(select, c);
    });
    select.value = start;
    wrap.appendChild(select);

    // Desktop: the designed dropdown from the select script, with flags and search.
    // Phones (or no select script): the browser's own picker over the dial code.
    var designed = null;
    if (window.SBSelect && !window.SBSelect.useNative) {
      designed = window.SBSelect.enhance(select, {
        anchor: wrap,
        trigger: prefix,
        label: 'Country dial code',
        render: function (option, li) {
          if (!SHOW_FLAGS || !option.value) return;
          var f = document.createElement('div');
          f.className = 'iti__flag iti__' + option.value;
          li.appendChild(f);
        }
      });
    }
    if (!designed) {
      select.addEventListener('focus', function () { wrap.classList.add('is-focus'); });
      select.addEventListener('blur', function () { wrap.classList.remove('is-focus'); });
    }

    if (!input.getAttribute('autocomplete')) input.setAttribute('autocomplete', 'tel-national');
    var fullField = makeHidden(input, fieldName + '_full');

    // Show the chosen country, and make room for it inside the field.
    function showCountry() {
      var c = findCountry(select.value);
      code.textContent = c ? '+' + c.dialCode : '';
      flag.className = 'iti__flag iti__' + select.value;
      var width = prefix.getBoundingClientRect().width;
      select.style.width = (basePadding + width + 8) + 'px';
      input.style.paddingLeft = (basePadding + width + 12) + 'px';
    }

    // Keep the full number up to date on every change.
    function sync() {
      var value = input.value.trim();

      // Typed with a +? Move the dropdown to match.
      if (value.charAt(0) === '+') {
        var current = findCountry(select.value);
        var match = countryFromNumber(value);
        var digits = value.replace(/\D/g, '');
        if (match && !(current && digits.indexOf(current.dialCode) === 0)) {
          select.value = match.iso2;
          showCountry();
        }
      }

      if (!value) {
        fullField.value = '';
        input.setCustomValidity('');
        return;
      }

      var valid = false;
      try { valid = utils.isValidNumber(value, select.value) === true; } catch (e) {}

      fullField.value = valid ? utils.formatNumber(value, select.value, utils.numberFormat.E164) : '';
      input.setCustomValidity(valid ? '' : INVALID_MESSAGE);
    }

    select.addEventListener('change', function () {
      showCountry();
      sync();
      input.focus();
    });
    input.addEventListener('input', sync);
    input.addEventListener('change', sync);
    input.addEventListener('blur', sync);
    if (input.form) input.form.addEventListener('hub:before-submit', sync); // Last check.

    showCountry();
    // Measure again when the field becomes visible (forms in pop-ups or tabs
    // are hidden at page load) and when fonts finish loading.
    if (window.ResizeObserver) new ResizeObserver(showCountry).observe(prefix);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(showCountry);
    sync();
  }
})();
