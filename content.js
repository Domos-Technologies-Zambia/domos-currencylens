(() => {
  const DEFAULTS = { target: "ZMW", dollarMeans: "USD", auto: true, selection: true, disabledSites: [] };
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION", "CODE", "PRE", "SVG", "IFRAME"]);
  const WRAP = "fxc-wrap", BADGE = "fxc-badge", TIP = "fxc-tip";
  const locale = navigator.language || "en-US";

  let settings = { ...DEFAULTS };
  let ratesData = null;
  let observer = null;
  let debounce = null;
  const pending = new Set();

  const siteDisabled = () => settings.disabledSites.includes(location.hostname);
  const active = () => ratesData && !siteDisabled();

  // ---------- conversion helpers ----------
  function convertedLabel(amount, from) {
    if (from === settings.target) return null;
    const v = FX.convert(amount, from, settings.target, ratesData.rates);
    if (v == null) return null;
    return { text: FX.format(v, settings.target, locale), value: v };
  }

  function rateTitle(from) {
    const r = FX.convert(1, from, settings.target, ratesData.rates);
    return r == null ? "" : `1 ${from} = ${r.toLocaleString(locale, { maximumFractionDigits: 4 })} ${settings.target}`;
  }

  function makeBadge(amount, from) {
    const c = convertedLabel(amount, from);
    if (!c) return null;
    const b = document.createElement("span");
    b.className = BADGE;
    b.textContent = "≈ " + c.text;
    b.title = rateTitle(from);
    return b;
  }

  // ---------- auto-detect: text nodes ----------
  function eligibleParent(el) {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      if (SKIP_TAGS.has(n.tagName) || (n.classList && (n.classList.contains(WRAP) || n.classList.contains(TIP) || n.classList.contains(BADGE)))) return false;
      if (n.isContentEditable) return false;
    }
    return true;
  }

  function processTextNode(node) {
    const text = node.nodeValue;
    const hits = FX.findPrices(text, settings.dollarMeans);
    if (!hits.length) return;
    const frag = document.createDocumentFragment();
    let last = 0, changed = false;
    for (const h of hits) {
      const badge = makeBadge(h.amount, h.currency);
      if (!badge) continue;
      frag.appendChild(document.createTextNode(text.slice(last, h.index)));
      const wrap = document.createElement("span");
      wrap.className = WRAP;
      wrap.appendChild(document.createTextNode(h.text));
      wrap.appendChild(badge);
      frag.appendChild(wrap);
      last = h.index + h.length;
      changed = true;
    }
    if (!changed) return;
    frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }

  function scanTextNodes(root) {
    if (!root || !root.isConnected) return;
    const startEl = root.nodeType === 1 ? root : root.parentElement;
    if (!startEl || !eligibleParent(startEl)) return;
    const walker = document.createTreeWalker(root.nodeType === 3 ? root.parentNode : root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const v = n.nodeValue;
        if (!v || v.length > 3000 || !/\d/.test(v)) return NodeFilter.FILTER_REJECT;
        return eligibleParent(n.parentElement) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(processTextNode);
  }

  // ---------- auto-detect: prices split across elements (<span>$</span><span>10,000</span>) ----------
  const PRICE_SELECTOR = '[class*="price" i], [class*="amount" i], [itemprop="price"], [data-price]';

  function scanSplitPrices(root) {
    const scope = root && root.nodeType === 1 ? root : document;
    const els = [];
    if (scope !== document && scope.matches && scope.matches(PRICE_SELECTOR)) els.push(scope);
    scope.querySelectorAll(PRICE_SELECTOR).forEach((e) => els.push(e));
    // Innermost first: nested "price" wrappers must get one badge, placed next to the number itself.
    for (const el of els.reverse()) {
      if (el.dataset.fxcDone || !eligibleParent(el)) continue;
      if (el.childElementCount < 1 || el.querySelector("." + WRAP + ", ." + BADGE)) continue;
      const full = el.textContent.replace(/\s+/g, " ").trim();
      if (full.length > 40) continue;
      const hits = FX.findPrices(full, settings.dollarMeans);
      if (hits.length !== 1 || hits[0].length !== full.length) continue;
      const badge = makeBadge(hits[0].amount, hits[0].currency);
      if (!badge) continue;
      badge.dataset.fxcSplit = "1";
      el.dataset.fxcDone = "1";
      el.appendChild(badge);
    }
  }

  function scan(root) {
    scanTextNodes(root);
    scanSplitPrices(root);
  }

  // ---------- observe dynamic pages ----------
  function startObserver() {
    if (observer) return;
    observer = new MutationObserver((muts) => {
      for (const m of muts) {
        const t = m.target;
        if (t.nodeType === 1 && (t.closest("." + WRAP) || t.closest("." + TIP))) continue;
        if (m.type === "characterData") {
          if (t.parentElement && !t.parentElement.closest("." + WRAP)) pending.add(t.parentElement);
        } else {
          m.addedNodes.forEach((n) => {
            if (n.nodeType === 1 && (n.classList.contains(WRAP) || n.classList.contains(BADGE) || n.classList.contains(TIP))) return;
            if (n.nodeType === 1 || n.nodeType === 3) pending.add(n);
          });
        }
      }
      if (pending.size && !debounce) {
        debounce = setTimeout(() => {
          debounce = null;
          const batch = [...pending];
          pending.clear();
          batch.forEach((n) => scan(n));
        }, 400);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function stopObserver() {
    if (observer) observer.disconnect();
    observer = null;
    pending.clear();
  }

  function cleanup() {
    hideTip();
    stopObserver();
    document.querySelectorAll("." + WRAP).forEach((w) => {
      const first = w.firstChild;
      w.replaceWith(document.createTextNode(first ? first.nodeValue : w.textContent));
    });
    document.querySelectorAll("." + BADGE + "[data-fxc-split]").forEach((b) => b.remove());
    document.querySelectorAll("[data-fxc-done]").forEach((e) => delete e.dataset.fxcDone);
  }

  // ---------- select-to-convert tooltip ----------
  let tip = null;
  function hideTip() {
    if (tip) tip.remove();
    tip = null;
  }

  function showTip(range, amount, from) {
    hideTip();
    const to = settings.target;
    tip = document.createElement("div");
    tip.className = TIP;

    const mk = (cls, txt) => {
      const d = document.createElement("div");
      d.className = cls;
      d.textContent = txt;
      return d;
    };

    const c = convertedLabel(amount, from);
    if (!ratesData) {
      tip.appendChild(mk("fxc-from", "Exchange rates unavailable right now."));
    } else if (!c) {
      tip.appendChild(mk("fxc-from", `${FX.format(amount, from, locale)} is already in ${to}.`));
    } else {
      tip.appendChild(mk("fxc-from", FX.format(amount, from, locale)));
      tip.appendChild(mk("fxc-to", c.text));
      tip.appendChild(mk("fxc-rate", rateTitle(from)));
    }

    document.documentElement.appendChild(tip);
    const rect = range.getBoundingClientRect();
    const th = tip.offsetHeight, tw = tip.offsetWidth;
    let top = rect.bottom + window.scrollY + 8;
    if (rect.bottom + th + 16 > window.innerHeight && rect.top - th - 16 > 0) top = rect.top + window.scrollY - th - 8;
    let left = rect.left + window.scrollX;
    left = Math.max(window.scrollX + 8, Math.min(left, window.scrollX + document.documentElement.clientWidth - tw - 8));
    tip.style.top = top + "px";
    tip.style.left = left + "px";
  }

  function handleSelection() {
    if (!settings.selection || !active()) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return hideTip();
    const text = sel.toString().trim();
    if (!text || text.length > 40 || !/\d/.test(text)) return hideTip();

    let amount, from;
    const hit = FX.findPrices(text, settings.dollarMeans)[0];
    if (hit) {
      amount = hit.amount;
      from = hit.currency;
    } else {
      const m = text.match(new RegExp(FX.NUM_SOURCE));
      if (!m) return hideTip();
      amount = FX.parseNumber(m[0]);
      from = settings.dollarMeans; // bare number: assume the default source currency
    }
    if (!isFinite(amount)) return hideTip();
    showTip(sel.getRangeAt(0), amount, from);
  }

  document.addEventListener("mouseup", (e) => {
    if (e.target.closest && e.target.closest("." + TIP)) return;
    setTimeout(handleSelection, 10);
  });
  document.addEventListener("mousedown", (e) => {
    if (!(e.target.closest && e.target.closest("." + TIP))) hideTip();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideTip();
  });

  // ---------- boot ----------
  function apply() {
    cleanup();
    if (!active()) return;
    if (settings.auto && document.body) {
      scan(document.body);
      startObserver();
    }
  }

  function loadRates() {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "getRates" }, (res) => {
          if (chrome.runtime.lastError || !res || !res.ok) return resolve(null);
          resolve(res.data);
        });
      } catch (e) { resolve(null); }
    });
  }

  async function init() {
    settings = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
    ratesData = await loadRates();
    apply();
  }

  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === "sync") {
      settings = { ...settings, ...Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.newValue])) };
      apply();
    } else if (area === "local" && changes.rates && changes.rates.newValue) {
      ratesData = changes.rates.newValue;
      apply();
    }
  });

  init();
})();
