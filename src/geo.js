/*
 * Skybound - shared country lookup (used by phone.js and locale.js).
 * Asks the Worker for the visitor's country once per visit (this browser tab),
 * and shares the answer between the scripts. Each script that imports this file
 * gets a copy, but only the first copy on the page is used.
 *
 * Test: add ?sb-country=fr to any page address to pretend to be in France.
 */
if (!window.SBGeo) {
  (function () {
    var KEY = 'sb_country';
    var request = null;

    function read() {
      try { return window.sessionStorage.getItem(KEY); } catch (e) { return null; }
    }
    function save(code) {
      try { window.sessionStorage.setItem(KEY, code); } catch (e) {}
    }
    function testCountry() {
      try {
        var code = (new URLSearchParams(window.location.search).get('sb-country') || '').toLowerCase();
        return /^[a-z]{2}$/.test(code) ? code : '';
      } catch (e) { return ''; }
    }

    window.SBGeo = {
      // Gives a lowercase 2-letter code, like 'gb', or '' if unknown. Never fails.
      country: function () {
        var test = testCountry();
        if (test) return Promise.resolve(test);

        var saved = read();
        if (saved !== null) return Promise.resolve(saved); // '' = the Worker did not know. Do not ask again.

        if (request) return request; // Already asking: share the same answer.

        var config = window.SB_CONFIG || {};
        var url = config.workerUrl || window.SB_WORKER_URL;
        if (!url || !window.fetch || /YOUR-WORKER/.test(url)) return Promise.resolve('');

        request = fetch(url, { method: 'GET' })
          .then(function (res) { return res.json(); })
          .then(function (body) {
            var code = body && typeof body.country === 'string' ? body.country : '';
            code = /^[a-z]{2}$/.test(code) ? code : '';
            save(code);
            return code;
          })
          .catch(function () {
            request = null; // Not saved, so a later page tries again.
            return '';
          });
        return request;
      },

      // True when the test setting is in the page address.
      isTest: function () { return !!testCountry(); }
    };
  })();
}
