import init, { Store, namedNode } from "./vendor/web.js";
import { GRAPH_BASE, formatOf } from "./config.js";

const $ = (id) => document.getElementById(id);
let store;

// Let the browser repaint before a long synchronous step (parsing blocks the main thread).
// requestAnimationFrame never fires in background tabs, so skip it when hidden and
// fall back to a timeout in case the tab is hidden while waiting.
const nextPaint = () => document.hidden ? Promise.resolve() : new Promise((r) => {
  requestAnimationFrame(() => setTimeout(r));
  setTimeout(r, 100);
});

function progress(fraction, label) {
  const pct = Math.floor(fraction * 100);
  $("bar").style.width = `${fraction * 100}%`;
  $("splash").setAttribute("aria-valuenow", pct);
  $("splash-pct").textContent = `${pct}%`;
  if (label) $("splash-file").textContent = label;
}

async function fetchBytes(url, onChunk) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const chunks = [];
  let length = 0;
  for (const reader = res.body.getReader(); ;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    length += value.length;
    onChunk(value.length);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
  return bytes;
}

async function loadData() {
  await init();
  store = new Store();
  const files = await (await fetch("data/index.json")).json();
  const total = files.reduce((sum, f) => sum + f.size, 0);
  const log = [];
  let done = 0; // bytes of fully processed files; downloading counts for half, parsing for the other half
  for (const [i, { file, size }] of files.entries()) {
    const step = `(${i + 1}/${files.length})`;
    let received = 0;
    try {
      progress(done / total, `Downloading ${file} ${step}`);
      const bytes = await fetchBytes(`data/${file}`, (n) => {
        received += n;
        progress((done + Math.min(received, size) / 2) / total);
      });
      progress((done + size / 2) / total, `Parsing ${file} ${step}`);
      await nextPaint();
      const before = store.size;
      store.load(bytes, {
        format: formatOf(file),
        base_iri: new URL(`data/${file}`, location.href).href,
        to_graph_name: namedNode(GRAPH_BASE + file),
        lenient: true,
      });
      log.push(`✓ ${file} — ${(store.size - before).toLocaleString()} triples (graph <${GRAPH_BASE}${file}>)`);
    } catch (e) {
      log.push(`✗ ${file}: ${e}`);
      const li = document.createElement("li");
      li.textContent = `${file}: ${e}`;
      $("splash-errors").append(li);
    }
    done += size;
  }
  progress(1, "Ready");
  const failed = log.filter((l) => l.startsWith("✗")).length;
  $("status").querySelector("summary").textContent =
    `${store.size.toLocaleString()} quads from ${files.length - failed}/${files.length} files — default graph = union of all graphs`;
  $("log").textContent = log.join("\n");
  $("status").open = failed > 0;
  $("run").disabled = false;
  // Leave the splash up for a moment if some files failed, so the errors can be read
  setTimeout(() => {
    const splash = $("splash");
    splash.classList.add("done");
    // A timer rather than transitionend: transitions don't run in background tabs
    setTimeout(() => splash.remove(), 500);
    $("query").focus();
  }, failed ? 3000 : 300);
}

function termHtml(t) {
  if (!t) return "";
  const esc = (s) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  if (t.termType === "NamedNode") return `<a href="${esc(t.value)}" target="_blank">${esc(t.value)}</a>`;
  if (t.termType === "BlankNode") return `_:${esc(t.value)}`;
  if (t.termType === "Literal") {
    let s = esc(t.value);
    if (t.language) s += `<small>@${esc(t.language)}</small>`;
    return s;
  }
  return esc(t.toString());
}

function run() {
  const out = $("results");
  out.innerHTML = "";
  const t0 = performance.now();
  try {
    const res = store.query($("query").value, { use_default_graph_as_union: true });
    const ms = (performance.now() - t0).toFixed(0);
    if (typeof res === "boolean") {
      out.innerHTML = `<pre>${res}</pre>`;
      $("info").textContent = `ASK in ${ms} ms`;
    } else if (Array.isArray(res) && (res.length === 0 || res[0] instanceof Map)) {
      const vars = [...new Set(res.flatMap((r) => [...r.keys()]))];
      const rows = res.map((r) => `<tr>${vars.map((v) => `<td>${termHtml(r.get(v))}</td>`).join("")}</tr>`);
      out.innerHTML = `<table><tr>${vars.map((v) => `<th>?${v}</th>`).join("")}</tr>${rows.join("")}</table>`;
      $("info").textContent = `${res.length} rows in ${ms} ms`;
    } else {
      const pre = document.createElement("pre");
      pre.textContent = res.map((q) => q.toString()).join("\n");
      out.append(pre);
      $("info").textContent = `${res.length} triples in ${ms} ms`;
    }
  } catch (e) {
    out.innerHTML = `<pre class="err"></pre>`;
    out.firstChild.textContent = String(e);
    $("info").textContent = "";
  }
}

// Example queries: listed in queries/index.json, one .rq file each.
// An example can be linked to with #example=ID, any query with #query=<encoded SPARQL>.
let examples = [];

async function loadExamples() {
  const list = await (await fetch("queries/index.json")).json();
  examples = await Promise.all(list.map(async (e) => ({ ...e, text: await (await fetch(`queries/${e.file}`)).text() })));
  const groups = new Map();
  for (const e of examples) {
    if (!groups.has(e.group)) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = e.group;
      $("examples").append(optgroup);
      groups.set(e.group, optgroup);
    }
    groups.get(e.group).append(new Option(e.title, e.id));
  }
}

const exampleWithText = (text) => examples.find((e) => e.text === text);

function showQuery(text) {
  const example = exampleWithText(text);
  $("query").value = text;
  // Show the start of the query (a focused textarea would otherwise scroll to the end)
  $("query").setSelectionRange(0, 0);
  $("query").scrollTop = 0;
  $("examples").value = example?.id ?? "";
  $("example-desc").textContent = example?.description ?? "";
}

// Show the query named by the URL hash, if any; returns whether it did
function applyHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  const example = examples.find((e) => e.id === params.get("example"));
  const text = example?.text ?? params.get("query");
  if (text === null || text === undefined) return false;
  showQuery(text);
  return true;
}

function shareUrl() {
  const example = exampleWithText($("query").value);
  const hash = example ? `example=${example.id}` : `query=${encodeURIComponent($("query").value)}`;
  return `${location.origin}${location.pathname}#${hash}`;
}

const dataReady = () => !$("run").disabled;

$("examples").onchange = () => {
  const example = examples.find((e) => e.id === $("examples").value);
  if (!example) return; // "Custom query": keep the editor as it is
  showQuery(example.text);
  history.replaceState(null, "", `#example=${example.id}`);
  if (dataReady()) run();
};

$("query").oninput = () => {
  const example = exampleWithText($("query").value);
  $("examples").value = example?.id ?? "";
  $("example-desc").textContent = example?.description ?? "";
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
};

$("copy-link").onclick = async () => {
  const url = shareUrl();
  history.replaceState(null, "", url);
  try {
    await navigator.clipboard.writeText(url);
    $("copy-link").textContent = "Link copied";
    setTimeout(() => ($("copy-link").textContent = "Copy link"), 1500);
  } catch {
    prompt("Copy this link:", url);
  }
};

window.onhashchange = () => { if (applyHash() && dataReady()) run(); };

$("run").onclick = run;
$("query").onkeydown = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && dataReady()) run(); };

// Start with the query from the URL, or the first example
const examplesLoaded = loadExamples()
  .then(() => { if (!applyHash() && examples.length) showQuery(examples[0].text); })
  .catch((e) => console.warn("Example queries unavailable:", e));

loadData()
  .then(async () => { await examplesLoaded; run(); })
  .catch((e) => {
    $("splash").querySelector("h2").textContent = "Loading failed";
    $("splash-file").textContent = "";
    $("splash-errors").textContent = String(e);
  });
