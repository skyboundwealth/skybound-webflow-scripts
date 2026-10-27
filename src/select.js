/*!
 * Skybound forms - select.js
 * Turns normal Webflow Select fields into a designed dropdown, with a search box on long lists.
 * Phones keep the browser's own picker. The normal Select stays hidden underneath, so form
 * values, required checks, Finsweet filters and Make all keep working.
 * Load it BEFORE phone.js (the phone dial code list uses it).
 *
 * Webflow, on a Select field:
 *   data-select = true               use the designed dropdown
 *   data-select-list = nationality   fill with nationalities (e.g. British). Also sends
 *                                    [field name]_country, e.g. Nationality_country = United Kingdom
 *   data-select-list = country       fill with Country of Residence names
 * For data-select-list, keep one placeholder option like "Select one..." with an empty value.
 *
 * Settings: window.SB_CONFIG.select
 */
(function () {
  // Settings come from window.SB_CONFIG.select in the Webflow footer (all optional).
  var OPT = (window.SB_CONFIG || {}).select || {};
  function pick(value, fallback) { return value === undefined || value === null ? fallback : value; }

  var SEARCH_MIN = pick(OPT.searchMin, 10);            // Lists with this many options or more get a search box.
  var NATIVE_ON_TOUCH = pick(OPT.nativeOnTouch, true); // Phones and tablets keep the browser's own picker.
  var MAX_HEIGHT = pick(OPT.maxHeight, 320);           // Max height of the open list, in pixels.
  var SEARCH_PLACEHOLDER = pick(OPT.searchPlaceholder, 'Search...');
  var NO_RESULTS = pick(OPT.noResults, 'No results');

  // Country names exactly as the Hub uses them.
  var HUB_COUNTRIES = ["Afghanistan", "Akrotiri", "Albania", "Algeria", "American Samoa", "Andorra", "Angola", "Anguilla", "Antarctica", "Antigua & Barbuda", "Argentina", "Armenia", "Aruba", "Ashmore & Cartier Islands", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Bassas da India", "Belarus", "Belgium", "Belize", "Benin", "Bermuda", "Bhutan", "Bolivia", "Bosnia & Herzegovina", "Botswana", "Bouvet Island", "Brazil", "British Indian Ocean Territory", "British Virgin Islands", "Brunei", "Bulgaria", "Burkina Faso", "Burma", "Burundi", "Cambodia", "Cameroon", "Canada", "Cape Verde", "Cayman Islands", "Central African Republic", "Chad", "Chile", "China", "Christmas Island", "Clipperton Island", "Cocos (Keeling) Islands", "Colombia", "Comoros", "Congo", "Democratic Republic of the Congo", "Republic of the Cook Islands", "Coral Sea Islands", "Costa Rica", "Cote d'Ivoire", "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Dhekelia", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Ethiopia", "Europa Island", "Falkland Islands (Islas Malvinas)", "Faroe Islands", "Fiji", "Finland", "France", "French Guiana", "French Polynesia", "French Southern & Antarctic Lands", "Gabon", "Gambia", "Gaza Strip", "Georgia", "Germany", "Ghana", "Gibraltar", "Glorioso Islands", "Greece", "Greenland", "Grenada", "Guadeloupe", "Guam", "Guernsey", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Heard Island & McDonald Islands", "Holy See", "Honduras", "Hong Kong", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Isle of Man", "Israel", "Italy", "Jamaica", "Jan Mayen", "Japan", "Jersey", "Jordan", "Juan de Nova Island", "Kazakhstan", "Kenya", "Kiribati", "Korea, North", "Korea, South", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Macau", "Macedonia", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Martinique", "Mauritania", "Mauritius", "Mayotte", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Montserrat", "Morocco", "Mozambique", "Namibia", "Nauru", "Navassa Island", "Nepal", "Netherlands", "Netherlands Antilles", "New Caledonia", "New Zealand", "Nicaragua", "Niger", "Nigeria", "Niue", "Norfolk Island", "Northern Mariana Islands", "Norway", "Oman", "Pakistan", "Palau", "Panama", "Papua New Guinea", "Paracel Islands", "Paraguay", "Peru", "Philippines", "Pitcairn Islands", "Poland", "Portugal", "Puerto Rico", "Qatar", "Reunion", "Romania", "Russia", "Rwanda", "Saint Helena", "Saint Kitts & Nevis", "Saint Lucia", "Saint Pierre & Miquelon", "Saint Vincent & the Grenadines", "Samoa", "San Marino", "Sao Tome & Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Georgia & the South Sandwich Islands", "Spain", "Spratly Islands", "Sri Lanka", "Sudan", "Suriname", "Svalbard", "Swaziland", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tokelau", "Tonga", "Trinidad & Tobago", "Tromelin Island", "Tunisia", "Turkey", "Turkmenistan", "Turks & Caicos Islands", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Virgin Islands", "Wake Island", "Wallis & Futuna", "West Bank", "Western Sahara", "Yemen", "Zambia", "Zimbabwe"];

  // Not shown in Country of Residence: places with no civilian residents, and one duplicate.
  var HIDE_FROM_RESIDENCE = pick(OPT.hideFromResidence, ["Antarctica", "Ashmore & Cartier Islands", "Bassas da India", "Bouvet Island", "British Indian Ocean Territory", "Clipperton Island", "Coral Sea Islands", "Europa Island", "French Southern & Antarctic Lands", "Glorioso Islands", "Heard Island & McDonald Islands", "Holy See", "Jan Mayen", "Juan de Nova Island", "Navassa Island", "Paracel Islands", "South Georgia & the South Sandwich Islands", "Spratly Islands", "Tromelin Island", "Wake Island"]);

  // Added to Country of Residence. These are missing from the Hub list (see notes).
  var ADD_TO_RESIDENCE = pick(OPT.addToResidence, ["Guatemala", "Kosovo", "South Sudan"]);

  // [nationality shown, country sent to the Hub]
  var NATIONALITIES = [
    ["Afghan", "Afghanistan"], ["Albanian", "Albania"], ["Algerian", "Algeria"], ["American", "United States"],
    ["Andorran", "Andorra"], ["Angolan", "Angola"], ["Antiguan and Barbudan", "Antigua & Barbuda"],
    ["Argentine", "Argentina"], ["Armenian", "Armenia"], ["Australian", "Australia"], ["Austrian", "Austria"],
    ["Azerbaijani", "Azerbaijan"], ["Bahamian", "Bahamas"], ["Bahraini", "Bahrain"], ["Bangladeshi", "Bangladesh"],
    ["Barbadian", "Barbados"], ["Belarusian", "Belarus"], ["Belgian", "Belgium"], ["Belizean", "Belize"],
    ["Beninese", "Benin"], ["Bhutanese", "Bhutan"], ["Bissau-Guinean", "Guinea-Bissau"], ["Bolivian", "Bolivia"],
    ["Bosnian and Herzegovinian", "Bosnia & Herzegovina"], ["Botswanan", "Botswana"], ["Brazilian", "Brazil"],
    ["British", "United Kingdom"], ["Bruneian", "Brunei"], ["Bulgarian", "Bulgaria"], ["Burkinabé", "Burkina Faso"],
    ["Burmese", "Burma"], ["Burundian", "Burundi"], ["Cambodian", "Cambodia"], ["Cameroonian", "Cameroon"],
    ["Canadian", "Canada"], ["Cape Verdean", "Cape Verde"], ["Central African", "Central African Republic"],
    ["Chadian", "Chad"], ["Chilean", "Chile"], ["Chinese", "China"], ["Colombian", "Colombia"],
    ["Comoran", "Comoros"], ["Congolese (DR Congo)", "Democratic Republic of the Congo"],
    ["Congolese (Republic of the Congo)", "Congo"], ["Costa Rican", "Costa Rica"], ["Croatian", "Croatia"],
    ["Cuban", "Cuba"], ["Cypriot", "Cyprus"], ["Czech", "Czech Republic"], ["Danish", "Denmark"],
    ["Djiboutian", "Djibouti"], ["Dominican (Dominica)", "Dominica"], ["Dominican (Dominican Republic)", "Dominican Republic"],
    ["Dutch", "Netherlands"], ["Ecuadorian", "Ecuador"], ["Egyptian", "Egypt"], ["Emirati", "United Arab Emirates"],
    ["Equatorial Guinean", "Equatorial Guinea"], ["Eritrean", "Eritrea"], ["Estonian", "Estonia"],
    ["Ethiopian", "Ethiopia"], ["Fijian", "Fiji"], ["Filipino", "Philippines"], ["Finnish", "Finland"],
    ["French", "France"], ["Gabonese", "Gabon"], ["Gambian", "Gambia"], ["Georgian", "Georgia"],
    ["German", "Germany"], ["Ghanaian", "Ghana"], ["Greek", "Greece"], ["Grenadian", "Grenada"],
    ["Guatemalan", "Guatemala"], ["Guinean", "Guinea"], ["Guyanese", "Guyana"], ["Haitian", "Haiti"],
    ["Honduran", "Honduras"], ["Hong Konger", "Hong Kong"], ["Hungarian", "Hungary"], ["I-Kiribati", "Kiribati"],
    ["Icelandic", "Iceland"], ["Indian", "India"], ["Indonesian", "Indonesia"], ["Iranian", "Iran"],
    ["Iraqi", "Iraq"], ["Irish", "Ireland"], ["Israeli", "Israel"], ["Italian", "Italy"], ["Ivorian", "Cote d'Ivoire"],
    ["Jamaican", "Jamaica"], ["Japanese", "Japan"], ["Jordanian", "Jordan"], ["Kazakh", "Kazakhstan"],
    ["Kenyan", "Kenya"], ["Kittitian and Nevisian", "Saint Kitts & Nevis"], ["Kosovan", "Kosovo"],
    ["Kuwaiti", "Kuwait"], ["Kyrgyz", "Kyrgyzstan"], ["Lao", "Laos"], ["Latvian", "Latvia"],
    ["Lebanese", "Lebanon"], ["Liberian", "Liberia"], ["Libyan", "Libya"], ["Liechtensteiner", "Liechtenstein"],
    ["Lithuanian", "Lithuania"], ["Luxembourger", "Luxembourg"], ["Macedonian", "Macedonia"], ["Malagasy", "Madagascar"],
    ["Malawian", "Malawi"], ["Malaysian", "Malaysia"], ["Maldivian", "Maldives"], ["Malian", "Mali"],
    ["Maltese", "Malta"], ["Marshallese", "Marshall Islands"], ["Mauritanian", "Mauritania"], ["Mauritian", "Mauritius"],
    ["Mexican", "Mexico"], ["Micronesian", "Micronesia"], ["Moldovan", "Moldova"], ["Monegasque", "Monaco"],
    ["Mongolian", "Mongolia"], ["Montenegrin", "Montenegro"], ["Moroccan", "Morocco"], ["Mosotho", "Lesotho"],
    ["Mozambican", "Mozambique"], ["Namibian", "Namibia"], ["Nauruan", "Nauru"], ["Nepalese", "Nepal"],
    ["New Zealander", "New Zealand"], ["Ni-Vanuatu", "Vanuatu"], ["Nicaraguan", "Nicaragua"], ["Nigerian", "Nigeria"],
    ["Nigerien", "Niger"], ["North Korean", "Korea, North"], ["Norwegian", "Norway"], ["Omani", "Oman"],
    ["Pakistani", "Pakistan"], ["Palauan", "Palau"], ["Palestinian", "Palestine"], ["Panamanian", "Panama"],
    ["Papua New Guinean", "Papua New Guinea"], ["Paraguayan", "Paraguay"], ["Peruvian", "Peru"], ["Polish", "Poland"],
    ["Portuguese", "Portugal"], ["Qatari", "Qatar"], ["Romanian", "Romania"], ["Russian", "Russia"],
    ["Rwandan", "Rwanda"], ["Saint Lucian", "Saint Lucia"], ["Salvadorean", "El Salvador"], ["Sammarinese", "San Marino"],
    ["Samoan", "Samoa"], ["São Toméan", "Sao Tome & Principe"], ["Saudi", "Saudi Arabia"], ["Senegalese", "Senegal"],
    ["Serbian", "Serbia"], ["Seychellois", "Seychelles"], ["Sierra Leonean", "Sierra Leone"], ["Singaporean", "Singapore"],
    ["Slovak", "Slovakia"], ["Slovenian", "Slovenia"], ["Solomon Islander", "Solomon Islands"], ["Somali", "Somalia"],
    ["South African", "South Africa"], ["South Korean", "Korea, South"], ["South Sudanese", "South Sudan"],
    ["Spanish", "Spain"], ["Sri Lankan", "Sri Lanka"], ["Sudanese", "Sudan"], ["Surinamese", "Suriname"],
    ["Swazi", "Swaziland"], ["Swedish", "Sweden"], ["Swiss", "Switzerland"], ["Syrian", "Syria"],
    ["Taiwanese", "Taiwan"], ["Tajik", "Tajikistan"], ["Tanzanian", "Tanzania"], ["Thai", "Thailand"],
    ["Timorese", "Timor-Leste"], ["Togolese", "Togo"], ["Tongan", "Tonga"], ["Trinidadian and Tobagonian", "Trinidad & Tobago"],
    ["Tunisian", "Tunisia"], ["Turkish", "Turkey"], ["Turkmen", "Turkmenistan"], ["Tuvaluan", "Tuvalu"],
    ["Ugandan", "Uganda"], ["Ukrainian", "Ukraine"], ["Uruguayan", "Uruguay"], ["Uzbek", "Uzbekistan"],
    ["Venezuelan", "Venezuela"], ["Vincentian", "Saint Vincent & the Grenadines"], ["Vietnamese", "Vietnam"],
    ["Yemeni", "Yemen"], ["Zambian", "Zambia"], ["Zimbabwean", "Zimbabwe"]
  ];
  // ---------------------

  var isTouch = !!(window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches);
  var useNative = NATIVE_ON_TOUCH && isTouch;
  var uid = 0;
  var openOne = null;

  var style = document.createElement('style');
  style.textContent = [
    '.sb-sel{position:relative;}',
    '.sb-sel__native{position:absolute!important;left:0;bottom:0;width:1px!important;height:1px!important;margin:0!important;padding:0!important;border:0!important;opacity:0!important;pointer-events:none!important;overflow:hidden;clip-path:inset(50%);}',
    '.sb-sel__trigger{display:flex;align-items:center;justify-content:space-between;gap:.5em;width:100%;text-align:left;cursor:pointer;}',
    '.sb-sel__trigger.is-placeholder .sb-sel__label{opacity:.6;}',
    '.sb-sel__label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.sb-sel__chev{flex:none;width:0;height:0;border-left:.3em solid transparent;border-right:.3em solid transparent;border-top:.35em solid currentColor;opacity:.6;transition:transform .15s;}',
    '.sb-sel.is-open .sb-sel__chev{transform:rotate(180deg);}',
    '.sb-sel__panel{position:absolute;left:0;top:calc(100% + 4px);z-index:1000;display:none;flex-direction:column;overflow:hidden;min-width:100%;width:max-content;max-width:min(92vw,380px);box-shadow:0 8px 24px rgba(0,0,0,.12);}',
    '.sb-sel.is-open .sb-sel__panel{display:flex;}',
    '.sb-sel.is-up .sb-sel__panel{top:auto;bottom:calc(100% + 4px);}',
    '.sb-sel.is-right .sb-sel__panel{left:auto;right:0;}',
    '.sb-sel__search{margin:.5em .5em .25em;padding:.5em .75em;border:1px solid currentColor;border-color:rgba(127,127,127,.35);border-radius:.375em;font:inherit;color:inherit;background:transparent;outline-offset:0;}',
    '.sb-sel__list{overflow-y:auto;overscroll-behavior:contain;margin:0;padding:.25em 0;list-style:none;}',
    '.sb-sel__opt{display:flex;align-items:center;gap:.5em;padding:.55em .9em;cursor:pointer;}',
    '.sb-sel__opt.is-active{background:rgba(127,127,127,.14);}',
    '.sb-sel__opt[aria-selected="true"]{font-weight:600;}',
    '.sb-sel__opt[aria-disabled="true"]{opacity:.4;cursor:default;}',
    '.sb-sel__sep{height:1px;margin:.25em .9em;background:currentColor;opacity:.15;}',
    '.sb-sel__empty{padding:.55em .9em;opacity:.6;}'
  ].join('');
  document.head.appendChild(style);

  function norm(s) {
    return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function labelText(select) {
    var label = select.labels && select.labels[0];
    if (!label) return select.name || '';
    var copy = label.cloneNode(true);
    Array.prototype.slice.call(copy.querySelectorAll('select, input, textarea, .sb-sel__panel, .sb-sel__trigger'))
      .forEach(function (el) { el.remove(); });
    return copy.textContent.replace(/\s+/g, ' ').trim();
  }

  // ---- Fill lists ----

  function fillList(select, type) {
    var keep = select.options.length && select.options[0].value === '' ? select.options[0] : null;
    select.innerHTML = '';
    if (keep) select.appendChild(keep);

    if (type === 'nationality') {
      NATIONALITIES.slice().sort(function (a, b) { return a[0].localeCompare(b[0]); }).forEach(function (n) {
        var o = document.createElement('option');
        o.value = n[0];
        o.textContent = n[0];
        o.setAttribute('data-country', n[1]);
        select.appendChild(o);
      });

      // Also send the matching country, e.g. Nationality_country = United Kingdom.
      var hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = (select.name || 'Nationality') + '_country';
      select.parentNode.insertBefore(hidden, select.nextSibling);
      var update = function () {
        var o = select.options[select.selectedIndex];
        hidden.value = o ? (o.getAttribute('data-country') || '') : '';
      };
      select.addEventListener('change', update);
      if (select.form) select.form.addEventListener('hub:before-submit', update);
      update();
    }

    if (type === 'country') {
      HUB_COUNTRIES.filter(function (c) { return HIDE_FROM_RESIDENCE.indexOf(c) === -1; })
        .concat(ADD_TO_RESIDENCE)
        .sort(function (a, b) { return a.localeCompare(b); })
        .forEach(function (c) {
          var o = document.createElement('option');
          o.value = c;
          o.textContent = c;
          select.appendChild(o);
        });
    }

    if (keep) select.selectedIndex = 0;
  }

  // ---- The designed dropdown ----

  // opts.trigger: use an existing element as the button (phone picker).
  // opts.anchor:  element the list opens under (default: a new wrapper).
  // opts.render:  function (option, li) to add extra content, like a flag.
  // opts.label:   text for screen readers.
  function enhance(select, opts) {
    opts = opts || {};
    if (useNative || select.hasAttribute('data-select-ready')) return null;
    select.setAttribute('data-select-ready', 'true');

    var id = 'sb-sel-' + (++uid);
    var anchor = opts.anchor;
    var trigger = opts.trigger;
    var labelSpan = null;
    var look = window.getComputedStyle(select);

    if (!anchor) {
      anchor = document.createElement('div');
      anchor.style.margin = look.margin;
      // Take the Select's place in the layout. A full-width Select stays full width.
      // (A Select hidden at page load, like in a pop-up, is treated as full width.)
      var parent = select.parentElement;
      var pLook = window.getComputedStyle(parent);
      var inner = parent.clientWidth - parseFloat(pLook.paddingLeft || 0) - parseFloat(pLook.paddingRight || 0);
      var own = select.getBoundingClientRect().width;
      if (!own || Math.abs(own - inner) < 2) anchor.style.width = '100%';
      anchor.style.flex = look.flex;
      anchor.style.alignSelf = look.alignSelf;
      anchor.style.minWidth = '0';
      select.parentNode.insertBefore(anchor, select);
      anchor.appendChild(select);
    }
    anchor.classList.add('sb-sel');

    if (!trigger) {
      trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = select.className + ' sb-sel__trigger';
      trigger.style.margin = '0';
      labelSpan = document.createElement('span');
      labelSpan.className = 'sb-sel__label';
      trigger.appendChild(labelSpan);
      // Only add our arrow if the Select's class does not draw one.
      if (look.backgroundImage === 'none') {
        var chev = document.createElement('span');
        chev.className = 'sb-sel__chev';
        trigger.appendChild(chev);
      }
      anchor.insertBefore(trigger, select);
    } else {
      trigger.setAttribute('tabindex', '0');
      trigger.style.pointerEvents = 'auto';
      trigger.style.cursor = 'pointer';
    }

    select.classList.add('sb-sel__native');
    select.setAttribute('tabindex', '-1');
    select.setAttribute('aria-hidden', 'true');

    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', id + '-list');
    trigger.setAttribute('aria-label', opts.label || labelText(select));
    trigger.removeAttribute('aria-hidden');

    // The open list. It copies the field's look.
    var panel = document.createElement('div');
    panel.className = 'sb-sel__panel';
    panel.setAttribute('data-lenis-prevent', ''); // Let the list scroll with Lenis smooth scroll.
    var fieldLook = window.getComputedStyle(opts.anchor ? opts.anchor.querySelector('input') || trigger : trigger);
    var bg = fieldLook.backgroundColor;
    panel.style.backgroundColor = (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') ? '#fff' : bg;
    panel.style.border = fieldLook.borderTopWidth + ' ' + (fieldLook.borderTopStyle === 'none' ? 'solid' : fieldLook.borderTopStyle) + ' ' + fieldLook.borderTopColor;
    panel.style.borderRadius = fieldLook.borderTopLeftRadius;
    panel.style.color = fieldLook.color;
    panel.style.fontFamily = fieldLook.fontFamily;
    panel.style.fontSize = fieldLook.fontSize;

    var search = null;
    var list = document.createElement('ul');
    list.className = 'sb-sel__list';
    list.id = id + '-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', opts.label || labelText(select));
    panel.appendChild(list);
    anchor.appendChild(panel);

    var items = [];     // { option, li }
    var active = -1;    // index in items

    function makeSearch() {
      search = document.createElement('input');
      search.type = 'text';
      search.className = 'sb-sel__search';
      search.placeholder = SEARCH_PLACEHOLDER;
      search.setAttribute('autocomplete', 'off');
      search.setAttribute('aria-label', SEARCH_PLACEHOLDER);
      search.setAttribute('aria-controls', list.id);
      panel.insertBefore(search, list); // No name, so it is never sent with the form.
      search.addEventListener('input', function () { filter(); });
      search.addEventListener('keydown', onKey);
      // Keep search typing to itself, so form scripts (like Finsweet) never see it.
      ['input', 'change'].forEach(function (type) {
        search.addEventListener(type, function (e) { e.stopPropagation(); });
      });
    }

    function isPlaceholder(o, i) {
      return i === 0 && o.value === '' && select.required;
    }

    function isHidden(o) {
      return o.hidden || o.style.display === 'none';
    }

    function build() {
      list.innerHTML = '';
      items = [];
      var count = 0;
      Array.prototype.slice.call(select.options).forEach(function (o, i) {
        if (isHidden(o) || isPlaceholder(o, i)) return;
        if (o.disabled && /^[\s\-\u2500\u2014_]*$/.test(o.textContent)) {
          var sep = document.createElement('li');
          sep.className = 'sb-sel__sep';
          sep.setAttribute('role', 'separator');
          list.appendChild(sep);
          return;
        }
        var li = document.createElement('li');
        li.className = 'sb-sel__opt';
        li.id = id + '-o' + i;
        li.setAttribute('role', 'option');
        if (o.disabled) li.setAttribute('aria-disabled', 'true');
        if (opts.render) opts.render(o, li);
        var text = document.createElement('span');
        text.textContent = o.textContent;
        li.appendChild(text);
        list.appendChild(li);
        items.push({ option: o, li: li, text: norm(o.textContent) });
        count++;
      });

      if (!search && count >= SEARCH_MIN) makeSearch();
      if (search && count < SEARCH_MIN) { search.remove(); search = null; }
      if (search) filter(true);
      showValue();
    }

    function visibleItems() {
      return items.filter(function (it) { return it.li.style.display !== 'none' && !it.option.disabled; });
    }

    function filter(keepActive) {
      var q = search ? norm(search.value.trim()) : '';
      var shown = 0;
      items.forEach(function (it) {
        var match = !q || it.text.indexOf(q) !== -1 || it.text.replace(/[^a-z0-9]/g, '').indexOf(q.replace(/[^a-z0-9]/g, '')) !== -1;
        it.li.style.display = match ? '' : 'none';
        if (match) shown++;
      });
      // Hide separators while searching.
      Array.prototype.slice.call(list.querySelectorAll('.sb-sel__sep')).forEach(function (s) { s.style.display = q ? 'none' : ''; });
      var empty = list.querySelector('.sb-sel__empty');
      if (!shown && !empty) {
        empty = document.createElement('li');
        empty.className = 'sb-sel__empty';
        empty.textContent = NO_RESULTS;
        list.appendChild(empty);
      } else if (shown && empty) {
        empty.remove();
      }
      if (!keepActive) setActive(items.indexOf(visibleItems()[0]));
    }

    function showValue() {
      var o = select.options[select.selectedIndex];
      items.forEach(function (it) { it.li.setAttribute('aria-selected', it.option === o ? 'true' : 'false'); });
      if (labelSpan) {
        labelSpan.textContent = o ? o.textContent : '';
        // Fade "Select one..." in forms. Filter choices like "All topics" stay normal.
        var inForm = select.required || !!select.closest('form[data-hub-form]');
        trigger.classList.toggle('is-placeholder', inForm && (!o || o.value === ''));
      }
      trigger.disabled = select.disabled;
    }

    function setActive(index) {
      items.forEach(function (it) { it.li.classList.remove('is-active'); });
      active = index;
      var it = items[index];
      var owner = search || trigger;
      if (!it) { owner.removeAttribute('aria-activedescendant'); return; }
      it.li.classList.add('is-active');
      owner.setAttribute('aria-activedescendant', it.li.id);
      var top = it.li.offsetTop, bottom = top + it.li.offsetHeight;
      if (top < list.scrollTop) list.scrollTop = top;
      else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
    }

    function move(step) {
      var vis = visibleItems();
      if (!vis.length) return;
      var pos = vis.indexOf(items[active]);
      pos = pos === -1 ? (step > 0 ? 0 : vis.length - 1) : Math.max(0, Math.min(vis.length - 1, pos + step));
      setActive(items.indexOf(vis[pos]));
    }

    function choose(it) {
      if (!it || it.option.disabled) return;
      var changed = select.value !== it.option.value;
      select.value = it.option.value;
      showValue();
      close(false);
      if (changed) {
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      // Back to the button, unless a change handler moved focus on purpose (phone picker).
      var now = document.activeElement;
      if (!now || now === document.body || panel.contains(now)) trigger.focus();
    }

    function open() {
      if (select.disabled || anchor.classList.contains('is-open')) return;
      if (openOne && openOne !== api) openOne.close(false);
      openOne = api;
      build();

      // Open upwards if there is not enough room below.
      var rect = anchor.getBoundingClientRect();
      var below = window.innerHeight - rect.bottom - 12;
      var above = rect.top - 12;
      var up = below < Math.min(MAX_HEIGHT, 220) && above > below;
      anchor.classList.toggle('is-up', up);
      var room = Math.max(160, Math.min(MAX_HEIGHT, up ? above : below));
      list.style.maxHeight = (room - (search ? 56 : 8)) + 'px';

      anchor.classList.remove('is-right');
      anchor.classList.add('is-open');
      // The list can be wider than the button. Keep it on screen.
      if (panel.getBoundingClientRect().right > window.innerWidth - 8) anchor.classList.add('is-right');
      trigger.setAttribute('aria-expanded', 'true');
      if (search) { search.value = ''; filter(true); }
      var current = -1;
      items.forEach(function (it, i) { if (it.option === select.options[select.selectedIndex]) current = i; });
      setActive(current !== -1 ? current : items.indexOf(visibleItems()[0]));
      if (search) search.focus();
      document.addEventListener('pointerdown', onOutside, true);
    }

    function close(focusTrigger) {
      if (!anchor.classList.contains('is-open')) return;
      anchor.classList.remove('is-open', 'is-up', 'is-right');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.removeAttribute('aria-activedescendant');
      document.removeEventListener('pointerdown', onOutside, true);
      if (openOne === api) openOne = null;
      if (focusTrigger) trigger.focus();
    }

    function onOutside(e) {
      if (!anchor.contains(e.target)) close(false);
    }

    // Type letters on the closed button (no search box): jump to a match.
    var typed = '', typedTimer = null;
    function typeAhead(ch) {
      typed += norm(ch);
      clearTimeout(typedTimer);
      typedTimer = setTimeout(function () { typed = ''; }, 600);
      var vis = visibleItems();
      for (var i = 0; i < vis.length; i++) {
        if (vis[i].text.indexOf(typed) === 0) { setActive(items.indexOf(vis[i])); return; }
      }
    }

    function onKey(e) {
      var isOpen = anchor.classList.contains('is-open');
      var k = e.key;
      if (!isOpen) {
        if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ') { e.preventDefault(); open(); return; }
        if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          open();
          if (search) { search.value = k; filter(); } else typeAhead(k);
        }
        return;
      }
      if (k === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (k === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (k === 'PageDown') { e.preventDefault(); move(10); }
      else if (k === 'PageUp') { e.preventDefault(); move(-10); }
      else if (k === 'Home' && !search) { e.preventDefault(); move(-items.length); }
      else if (k === 'End' && !search) { e.preventDefault(); move(items.length); }
      else if (k === 'Enter') { e.preventDefault(); choose(items[active]); }
      else if (k === 'Escape') { e.preventDefault(); close(true); }
      else if (k === 'Tab') { close(false); }
      else if (!search && k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); typeAhead(k); }
      else if (!search && k === ' ') { e.preventDefault(); choose(items[active]); }
    }

    trigger.addEventListener('keydown', onKey);
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      if (anchor.classList.contains('is-open')) close(true); else open();
    });

    // Clicks inside the list. preventDefault stops a wrapping <label> from re-opening it.
    panel.addEventListener('mousedown', function (e) { if (e.target !== search) e.preventDefault(); });
    panel.addEventListener('click', function (e) {
      if (e.target === search) return;
      e.preventDefault();
      var li = e.target.closest('.sb-sel__opt');
      if (!li) return;
      for (var i = 0; i < items.length; i++) if (items[i].li === li) return choose(items[i]);
    });
    panel.addEventListener('mousemove', function (e) {
      var li = e.target.closest('.sb-sel__opt');
      if (!li || li.classList.contains('is-active')) return;
      for (var i = 0; i < items.length; i++) if (items[i].li === li) return setActive(i);
    });

    // If something focuses the hidden Select (like its label), move to the button.
    // Not when it is invalid: the browser is showing its "please select" warning there.
    select.addEventListener('focus', function () { if (select.validity.valid) trigger.focus(); });

    // Required field left empty: mark it, so it can be styled with .sb-sel.is-invalid.
    select.addEventListener('invalid', function () { anchor.classList.add('is-invalid'); });

    // ---- Stay in step with the hidden Select ----
    // Other scripts (like Finsweet) change it: from the page address, a reset,
    // or by hiding options with no results.
    var pending = false;
    function refresh() {
      if (pending) return;
      pending = true;
      setTimeout(function () {
        pending = false;
        build();
        if (select.validity.valid) anchor.classList.remove('is-invalid');
      }, 0);
    }

    ['value', 'selectedIndex'].forEach(function (prop) {
      var d = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, prop);
      if (!d || !d.set) return;
      Object.defineProperty(select, prop, {
        configurable: true,
        get: function () { return d.get.call(this); },
        set: function (v) { d.set.call(this, v); refresh(); }
      });
    });
    new MutationObserver(refresh).observe(select, { childList: true, subtree: true, attributes: true, characterData: true });
    select.addEventListener('change', refresh);
    select.addEventListener('input', refresh);
    if (select.form) select.form.addEventListener('reset', function () { setTimeout(refresh, 0); });

    var api = { open: open, close: close, refresh: refresh, select: select, trigger: trigger };
    build();
    return api;
  }

  // Public, for the phone picker.
  window.SBSelect = { enhance: enhance, useNative: useNative };

  // ---- Start ----
  Array.prototype.slice.call(document.querySelectorAll('select[data-select], select[data-select-list]')).forEach(function (select) {
    var type = (select.getAttribute('data-select-list') || '').trim().toLowerCase();
    if (type) fillList(select, type);
    enhance(select);
  });
})();
