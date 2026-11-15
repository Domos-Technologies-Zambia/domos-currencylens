# Domos CurrencyLens

**See any price on the web in your own currency.**

Domos CurrencyLens is a small browser extension for Microsoft Edge and Google Chrome. It spots prices on the pages you browse and shows what they cost in the currency you actually use, so you don't have to keep opening a converter in another tab.

**Get it for Edge:** [Domos CurrencyLens on Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/domos-currencylens/jjjjjhplgmfdljkjomahajbihcnhgabm)
**Chrome:** coming soon. You can already use it in Chrome by [installing from source](#install-from-source).

---

## Why I made it

I wanted to know what a car on a site like Befward, or a basket on Shein, really costs in kwacha. The listed price is in dollars, and doing the maths in my head (or opening a converter every few minutes) gets old fast. So I built a tiny extension that does it for me, right on the page, and decided to share it for anyone who finds it handy.

## What it does

- **Auto badges:** a small green badge appears next to each price, for example `$10,000 ≈ ZMW 204,000`. Hover the badge to see the exchange rate used.
- **Select to convert:** switch auto mode off, highlight any amount (`$10,000` or even just `10,000`) and a tooltip shows the converted value.
- **60+ currencies:** pick your home currency from the popup. The prices it finds can be in `$ € £ ¥ ₹ ₦ ₩` and more, or written with codes such as `USD`, `EUR`, `ZAR`, `AED`.
- **Smart about `$`:** tell it whether `$` means US, Australian, Canadian, NZ dollars and so on. `A$`, `C$`, `US$` are understood automatically.
- **Quick converter** in the popup.
- **Per-site off switch**, for pages where you don't want it.
- **Works on dynamic sites** where more products load as you scroll, and on sites that split a price across several HTML elements.
- **Works offline** using the last downloaded rates.

## Install

### From the store
Open the [Edge Add-ons page](https://microsoftedge.microsoft.com/addons/detail/domos-currencylens/jjjjjhplgmfdljkjomahajbihcnhgabm) and click **Get**.

### Install from source
1. Download or clone this repository.
2. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the project folder (the one containing `manifest.json`).
5. Pin the extension and open its popup to choose your currency.

## How to use it

1. Click the extension icon and choose **My currency**.
2. Browse a shopping site. Converted prices appear next to the originals.
3. Prefer a clean page? Untick **Auto-show conversions** in the popup, then select an amount to convert it on demand.
4. Use **Disable on this site** if a website doesn't play nicely.

## How it works

The extension is plain JavaScript with no build step and no dependencies. It uses Manifest V3.

| File | What it does |
|------|--------------|
| `manifest.json` | Declares the extension, its permissions and the content script |
| `background.js` | Service worker. Downloads exchange rates, caches them for 12 hours, and answers requests from the page and popup |
| `content.js` | Runs on web pages. Finds prices, adds badges, shows the select-to-convert tooltip, and watches for newly loaded content |
| `fx-core.js` | Pure helper functions: price-detection regex, number parsing (`1,234.56` vs `1.234,56`), conversion and formatting |
| `currencies.js` | The list of supported currency codes and names |
| `content.css` | Styling for badges and tooltip |
| `popup.html`, `popup.css`, `popup.js` | The settings popup and quick converter |
| `icons/` | Extension icons |

**Finding prices.** A regular expression looks for a currency symbol or code next to a number (`$10,000`, `99 EUR`, `€1.234,56`, `$5k`, `$2.5 million`). Text is scanned node by node, skipping inputs, scripts and editable areas. A second pass handles prices whose symbol and number sit in different elements, which is common on shops. A `MutationObserver` rescans content that loads later.

**Converting.** The rate source returns every currency against USD, so converting `X` in currency A to currency B is `X / rate[A] * rate[B]`.

**Exchange rates.** They come from the free [Exchange Rate API](https://www.exchangerate-api.com) (`open.er-api.com`), with two backup sources (the open-source [fawazahmed0 currency-api](https://github.com/fawazahmed0/exchange-api)). They are mid-market rates, refreshed about once a day. Your bank, card or the shop may use a different rate and add fees.

## Privacy

No accounts, no ads, no analytics and no tracking. Prices are detected and converted locally in your browser, and page content is never sent anywhere. The only network requests download public exchange-rate data. Your settings stay in your browser's extension storage. See [`privacy-policy.md`](privacy-policy.md) for the full policy.

## Known limitations

- Prices written with a plain space as thousands separator (`$10 000`) aren't auto-detected. Select the amount instead.
- Prices with cents in a superscript (some shops) may not be recognised automatically.
- It converts the listed price only. Shipping, import duties and taxes are not included, which matters a lot for items like imported cars.
- Pages inside embedded iframes are not scanned.
- Rates are indicative, not what a bank will charge.

## How I built it

1. **Started with the problem:** a price in dollars that I wanted in my own currency, without leaving the page.
2. **Chose the simplest design:** a Manifest V3 extension in plain JavaScript, so it runs in both Edge and Chrome with no tooling. Two interaction modes: automatic badges, and select-to-convert for pages that are hard to parse.
3. **Wrote the price detector first** and tested it on its own in Node against formats like `€1.234,56`, `99 EUR`, `A$1,200` and `$5k`, before touching any browser code.
4. **Added the pieces around it:** a background worker for rates with caching and fallback sources, the content script that places the badges, and the popup for settings.
5. **Tested on real shops.** Shein showed a bug where nested price elements got two badges each. I fixed it by processing the innermost price element first.
6. **Packaged and published** it to the Microsoft Edge Add-ons store, with a privacy policy and permission justifications.

I built it with [Claude](https://claude.ai) from Anthropic as my coding assistant, and tested and shipped it myself.

## Development

```bash
# check the price parser from the command line
node -e 'require("./currencies.js"); require("./fx-core.js");
console.log(FX.findPrices("Price: $10,000 or €1.234,56", "USD"))'
```

- **Add a currency:** add a line to `currencies.js`, for example `XYZ: "Currency Name"`. The rate sources need to carry that code too.
- **Change defaults** (home currency, what `$` means): edit `DEFAULTS` at the top of `content.js` and `popup.js`.
- After editing, click the reload arrow on the extension's card in `chrome://extensions` or `edge://extensions`, then refresh the page you are testing.

## Contributing

Bug reports and ideas are welcome. If a site shows prices wrongly, open an issue with the website, what you expected and what you saw (a screenshot helps).

## Contact

Domos Technologies, Lusaka, Zambia.

## License

MIT License. Free to use, modify and share. Copyright © 2026 Domos Technologies.
