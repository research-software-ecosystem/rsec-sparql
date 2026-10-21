import init, { Store, namedNode } from "./vendor/web.js";

const $ = (id) => document.getElementById(id);
let store;
const GRAPH_BASE = "urn:dataset:";
const FORMATS = { ttl: "text/turtle", owl: "application/rdf+xml", rdf: "application/rdf+xml", nt: "application/n-triples" };

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
        format: FORMATS[file.split(".").pop()] ?? "text/turtle",
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

$("run").onclick = run;
$("query").onkeydown = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !$("run").disabled) run(); };
loadData().catch((e) => {
  $("splash").querySelector("h2").textContent = "Loading failed";
  $("splash-file").textContent = "";
  $("splash-errors").textContent = String(e);
});
