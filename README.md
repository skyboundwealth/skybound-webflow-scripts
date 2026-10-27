# Skybound Webflow scripts

Scripts for the Skybound Wealth Webflow site forms. Served from this repository by
[jsDelivr](https://www.jsdelivr.com/), so the Webflow footer only holds a small settings block.

| File | What it does |
|---|---|
| `src/form.js` | Sends forms to the Cloudflare Worker. Spam checks, Turnstile, ad tracking (UTMs), page slug, locale. Shows the Webflow success message. |
| `src/select.js` | Designed dropdowns with search for Select fields. Fills Nationality and Country of Residence lists. Works with Finsweet filters. |
| `src/phone.js` | Dial code with flags inside the phone field. Checks the number. Sends the full number. |
| `src/video-unlock.js` | Soft gate for on-demand videos. On-demand page template only. |

`dist/` holds the small (minified) copies that Webflow loads. Rebuild them with `./build.sh`.

The Cloudflare Worker code is not in this repository. It lives in Cloudflare.

## Install

Copy `footer-snippet.html` into **Webflow > Site settings > Custom code > Footer code**,
after Consent Pro. Set `workerUrl` and `turnstileSiteKey`.

Order matters: `form.js`, then `select.js`, then `phone.js`.

## Webflow attributes

**Every form**

| Element | Attribute | Value |
|---|---|---|
| Form (inside the Form Block) | `data-hub-form` | `true` |
| Form (inside the Form Block) | `data-form-key` | the key, like `contact-form` (on CMS templates, link it to the CMS key field) |
| Any empty div *(optional)* | `data-hub-turnstile` | where Turnstile sits. Default: above the submit button block |

Every form needs an email field named `Email` or `email`, and the Webflow success and error blocks.
Webflow's own bot protection must be **off** (Site settings > Apps & Integrations).

**Fields**

| Element | Attribute | Value |
|---|---|---|
| Phone input | `data-phone-picker` | `true`, or a 2-letter code like `ae` to always start there |
| Nationality Select | `data-select-list` | `nationality` |
| Country of Residence Select | `data-select-list` | `country` |
| Any other Select (like Finsweet filters) | `data-select` | `true` |

**On-demand video page** (same key on all)

| Element | Attribute | Value |
|---|---|---|
| Form | `data-unlock` | the key |
| Cover div over the video | `data-unlock-cover` | the key |
| Form section *(optional)* | `data-unlock-hide` | the key |

Email link: `https://.../on-demand/your-webinar?access=KEY`

## Fields sent to Make

Every form field by its Webflow name, plus:

- `form_key`, `page_url`, `page_slug`, `locale`
- `Phone_full`, `Phone_country` (for a phone field named `Phone`)
- `Nationality_country` (for a Nationality field)
- Ad data when present: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `utm_id`,
  `gclid`, `gbraid`, `wbraid`, `fbclid`, `msclkid`, `li_fat_id`, `ttclid`, `landing_page`, `attribution_captured_at`
- `submitted_at` (added by the Worker)

## Settings

All optional except `workerUrl` and `turnstileSiteKey`.

```js
window.SB_CONFIG = {
  workerUrl: 'https://...workers.dev',
  turnstileSiteKey: '...',
  form: {
    trackedParams: ['utm_source', '...'], // address queries to keep
    attributionDays: 30,                  // how long to remember them
    attributionMode: 'last',              // 'last' or 'first' ad visit wins
    sendTimeoutMs: 15000,                 // show the error message after this
    tokenWaitMs: 5000                     // wait for Turnstile on send
  },
  select: {
    searchMin: 10,                        // lists this long or longer get a search box
    nativeOnTouch: true,                  // phones keep the browser's own picker
    maxHeight: 320,
    searchPlaceholder: 'Search...',
    noResults: 'No results',
    hideFromResidence: ['Antarctica', '...'], // replaces the built-in list
    addToResidence: ['Guatemala', 'Kosovo', 'South Sudan']
  },
  phone: {
    defaultCountry: 'gb',
    countryOrder: ['gb', 'ae', 'ch', 'us'],
    invalidMessage: 'Please enter a valid phone number.',
    showFlags: true,
    countryWaitMs: 1500
  },
  video: {
    unlockDays: 30,
    linkParam: 'access'
  }
};
```

## Making a change

1. Edit the file in `src/`.
2. Run `./build.sh` to rebuild the small files in `dist/` (needs esbuild: `npm i -g esbuild`).
3. Commit both, then create a new release (tag) on GitHub, like `v1.0.1`.
4. In the Webflow footer, change `v1.0.0` to `v1.0.1` in the script addresses. Publish.

Webflow loads the files in `dist/`. `src/` is the readable copy to edit.
Old versions keep working, so a bad change can be undone by switching the version number back.

## Known gaps

The Hub country list has no Guatemala, South Sudan, Kosovo or Palestine. These nationalities
currently send `Guatemala`, `South Sudan`, `Kosovo` and `Palestine`. Check what the Hub accepts.
