const DEFAULTS = { target: "ZMW", dollarMeans: "USD", auto: true, selection: true, disabledSites: [] };
const $ = (id) => document.getElementById(id);
const locale = navigator.language || "en-US";
let settings = { ...DEFAULTS };
let ratesData = null;
let host = null;

function fillSelect(sel, value) {
  sel.innerHTML = "";
  for (const [code, name] of Object.entries(FX_CURRENCIES)) {
    const o = document.createElement("option");
    o.value = code;
    o.textContent = `${code} — ${name}`;
    sel.appendChild(o);
  }
  sel.value = value;
}

function renderQuick() {
  const amount = parseFloat($("qAmount").value);
  const from = $("qFrom").value;
  if (!ratesData || !isFinite(amount)) { $("qResult").textContent = "—"; return; }
  const v = FX.convert(amount, from, settings.target, ratesData.rates);
  $("qResult").textContent = v == null ? "Rate unavailable" : FX.format(v, settings.target, locale);
}

function renderStatus() {
  if (!ratesData) { $("status").textContent = "Rates unavailable — check your connection"; return; }
  const when = new Date(ratesData.updated).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
  $("status").textContent = (ratesData.stale ? "Offline, showing cached rates · " : "Rates updated ") + when;
}

function getRates(force) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "getRates", force }, (res) => {
      resolve(chrome.runtime.lastError || !res || !res.ok ? null : res.data);
    });
  });
}

async function save(patch) {
  settings = { ...settings, ...patch };
  await chrome.storage.sync.set(patch);
  renderQuick();
}

async function init() {
  settings = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
  fillSelect($("target"), settings.target);
  fillSelect($("dollarMeans"), settings.dollarMeans);
  fillSelect($("qFrom"), settings.dollarMeans);
  $("auto").checked = settings.auto;
  $("selection").checked = settings.selection;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && /^https?:/.test(tab.url)) host = new URL(tab.url).hostname;
  } catch (e) {}
  if (host) {
    $("siteLabel").textContent = `Disable on ${host}`;
    $("siteOff").checked = settings.disabledSites.includes(host);
  } else {
    $("siteOff").disabled = true;
    $("siteLabel").textContent = "Disable on this site (n/a here)";
  }

  ratesData = await getRates(false);
  renderStatus();
  renderQuick();
}

$("target").addEventListener("change", (e) => save({ target: e.target.value }));
$("dollarMeans").addEventListener("change", (e) => save({ dollarMeans: e.target.value }));
$("auto").addEventListener("change", (e) => save({ auto: e.target.checked }));
$("selection").addEventListener("change", (e) => save({ selection: e.target.checked }));
$("siteOff").addEventListener("change", (e) => {
  const set = new Set(settings.disabledSites);
  e.target.checked ? set.add(host) : set.delete(host);
  save({ disabledSites: [...set] });
});
$("qAmount").addEventListener("input", renderQuick);
$("qFrom").addEventListener("change", renderQuick);
$("refresh").addEventListener("click", async () => {
  $("refresh").disabled = true;
  $("status").textContent = "Refreshing…";
  ratesData = await getRates(true);
  renderStatus();
  renderQuick();
  $("refresh").disabled = false;
});

init();
