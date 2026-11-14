// Fetches and caches exchange rates (units per 1 USD). Content scripts and popup ask us for them.
const TTL_MS = 12 * 60 * 60 * 1000;

async function fetchRates() {
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD");
    const j = await r.json();
    if (j.result === "success" && j.rates) {
      return { rates: { ...j.rates, USD: 1 }, updated: (j.time_last_update_unix || Date.now() / 1000) * 1000, fetchedAt: Date.now() };
    }
  } catch (e) { /* fall through to backup */ }

  for (const url of [
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
    "https://latest.currency-api.pages.dev/v1/currencies/usd.json"
  ]) {
    try {
      const j = await (await fetch(url)).json();
      if (j.usd) {
        const rates = {};
        for (const [k, v] of Object.entries(j.usd)) rates[k.toUpperCase()] = v;
        rates.USD = 1;
        return { rates, updated: Date.parse(j.date) || Date.now(), fetchedAt: Date.now() };
      }
    } catch (e) { /* try next */ }
  }
  throw new Error("Could not fetch exchange rates");
}

async function getRates(force) {
  const { rates: cached } = await chrome.storage.local.get("rates");
  if (!force && cached && Date.now() - cached.fetchedAt < TTL_MS) return cached;
  try {
    const fresh = await fetchRates();
    await chrome.storage.local.set({ rates: fresh });
    return fresh;
  } catch (e) {
    if (cached) return { ...cached, stale: true };
    throw e;
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "getRates") {
    getRates(!!msg.force)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // async response
  }
});

chrome.runtime.onInstalled.addListener(() => getRates(false).catch(() => {}));
