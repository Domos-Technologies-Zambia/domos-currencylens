// Pure helpers: price detection, number parsing, conversion, formatting.
(function (root) {
  const CURRENCIES = root.FX_CURRENCIES || {};

  // Symbols that can appear BEFORE a number. "$" is ambiguous and resolved from settings.
  const PREFIX_SYMBOLS = {
    "US$": "USD", "$": "$", "A$": "AUD", "AU$": "AUD", "C$": "CAD", "CA$": "CAD",
    "NZ$": "NZD", "HK$": "HKD", "S$": "SGD", "R$": "BRL", "CN¥": "CNY", "JP¥": "JPY",
    "€": "EUR", "£": "GBP", "¥": "JPY", "₹": "INR", "₩": "KRW", "₦": "NGN", "₱": "PHP",
    "₫": "VND", "₺": "TRY", "₽": "RUB", "₪": "ILS", "฿": "THB", "ZK": "ZMW", "KSh": "KES"
  };
  // Symbols that can appear AFTER a number (e.g. "10 €", "50 zł").
  const SUFFIX_SYMBOLS = { "€": "EUR", "£": "GBP", "₹": "INR", "₩": "KRW", "₦": "NGN", "₱": "PHP",
    "₫": "VND", "₺": "TRY", "₽": "RUB", "₪": "ILS", "฿": "THB", "zł": "PLN", "¥": "JPY" };

  // Codes that are also common English words; skip them for auto-detection.
  const AMBIGUOUS_CODES = new Set(["ALL", "TOP", "PEN", "TRY"]);
  const CODES = Object.keys(CURRENCIES).filter((c) => !AMBIGUOUS_CODES.has(c));

  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const byLen = (a, b) => b.length - a.length;

  const NUM_SOURCE =
    "(?:\\d{1,3}(?:[.,\\u00a0\\u202f\\u2009]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)";
  const codeAlt = CODES.join("|");
  const prefixAlt =
    Object.keys(PREFIX_SYMBOLS).sort(byLen).map(esc).join("|") + "|(?:" + codeAlt + ")(?![A-Za-z])";
  const suffixAlt =
    Object.keys(SUFFIX_SYMBOLS).sort(byLen).map(esc).join("|") + "|(?:" + codeAlt + ")(?![A-Za-z])";

  const REGEX_SOURCE =
    "(?:(?<![A-Za-z0-9])(?<pc>" + prefixAlt + ")\\s?(?<pn>" + NUM_SOURCE + ")" +
    "(?:\\s?(?<mu>million|billion|bn|[kKmM])(?![A-Za-z]))?" +
    "|(?<![\\d.,])(?<sn>" + NUM_SOURCE + ")\\s?(?<sc>" + suffixAlt + "))" +
    "(?!\\d|[.,]\\d)";

  const MULT = { k: 1e3, m: 1e6, million: 1e6, bn: 1e9, billion: 1e9 };

  function parseNumber(str) {
    let s = str.replace(/[\u00a0\u202f\u2009]/g, "");
    const lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(",");
    if (lastDot > -1 && lastComma > -1) {
      const dec = lastDot > lastComma ? "." : ",";
      const thou = dec === "." ? "," : ".";
      s = s.split(thou).join("").replace(dec, ".");
    } else if (lastDot > -1 || lastComma > -1) {
      const sep = lastDot > -1 ? "." : ",";
      const parts = s.split(sep);
      if (parts.length > 2) s = parts.join("");
      else {
        const [a, b] = parts;
        if (b.length === 3 && (sep === "," || (a.length <= 3 && a !== "0"))) s = a + b;
        else s = a + "." + b;
      }
    }
    return parseFloat(s);
  }

  function resolveCurrency(token, dollarMeans) {
    const t = PREFIX_SYMBOLS[token] || SUFFIX_SYMBOLS[token] || token.toUpperCase();
    return t === "$" ? dollarMeans : t;
  }

  // Returns [{index, length, text, amount, currency}]
  function findPrices(text, dollarMeans) {
    const re = new RegExp(REGEX_SOURCE, "g");
    const out = [];
    let m;
    while ((m = re.exec(text))) {
      const g = m.groups;
      const token = g.pc || g.sc;
      const raw = g.pn || g.sn;
      let amount = parseNumber(raw);
      if (g.mu) amount *= MULT[g.mu.toLowerCase()] || 1;
      const currency = resolveCurrency(token, dollarMeans || "USD");
      if (!isFinite(amount) || !CURRENCIES[currency]) continue;
      out.push({ index: m.index, length: m[0].length, text: m[0], amount, currency });
    }
    return out;
  }

  // rates: units of currency per 1 USD
  function convert(amount, from, to, rates) {
    if (!rates || !rates[from] || !rates[to]) return null;
    return (amount / rates[from]) * rates[to];
  }

  function format(value, currency, locale) {
    const digits = Math.abs(value) >= 1000 ? 0 : 2;
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits
      }).format(value);
    } catch (e) {
      return currency + " " + value.toFixed(digits);
    }
  }

  root.FX = { findPrices, parseNumber, convert, format, NUM_SOURCE };
})(globalThis);
