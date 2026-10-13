import init, { Store, namedNode } from "./vendor/web.js";

const $ = (id) => document.getElementById(id);
const status = $("status");
let store;
const GRAPH_BASE = "urn:dataset:";
const FORMATS = { ttl: "text/turtle", owl: "application/rdf+xml", rdf: "application/rdf+xml", nt: "application/n-triples" };

async function loadData() {
  await init();
  store = new Store();
  const files = await (await fetch("data/index.json")).json();
  const log = [];
  for (const file of files) {
    status.textContent = [...log, `Loading ${file}…`].join("\n");
    try {
      const text = await (await fetch(`data/${file}`)).text();
      const before = store.size;
      store.load(text, {
        format: FORMATS[file.split(".").pop()] ?? "text/turtle",
        base_iri: new URL(`data/${file}`, location.href).href,
        to_graph_name: namedNode(GRAPH_BASE + file),
        lenient: true,
      });
      log.push(`✓ ${file} — ${(store.size - before).toLocaleString()} triples (graph <${GRAPH_BASE}${file}>)`);
    } catch (e) {
      log.push(`✗ ${file}: ${e}`);
    }
  }
  log.push(`Total: ${store.size.toLocaleString()} quads. Default graph = union of all graphs.`);
  status.textContent = log.join("\n");
  $("run").disabled = false;
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
loadData().catch((e) => { status.innerHTML = `<span class="err">${e}</span>`; });
