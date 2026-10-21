// Run every example query (queries/index.json) against a data folder, loaded as the web page
// does, and fail if a query errors or returns nothing (no rows, or only a count of 0).
//
// Usage: npm run check-queries [-- DATA_DIR [QUERIES_DIR]]   (defaults: data, queries)
import fs from "node:fs";
import path from "node:path";
import oxigraph from "oxigraph";
import { GRAPH_BASE, formatOf } from "../config.js";

const { Store, namedNode } = oxigraph;
const [dataDir = "data", queriesDir = "queries"] = process.argv.slice(2);
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

const store = new Store();
for (const { file } of readJson(path.join(dataDir, "index.json"))) {
  store.load(fs.readFileSync(path.join(dataDir, file)), {
    format: formatOf(file),
    to_graph_name: namedNode(GRAPH_BASE + file),
    lenient: true,
  });
}
console.log(`Loaded ${store.size.toLocaleString("en")} quads from ${dataDir}\n`);

const isEmpty = (res) => {
  if (typeof res === "boolean") return !res;
  if (res.length === 0) return true;
  // A single row of zeros, e.g. a COUNT that matched nothing
  return res.length === 1 && res[0] instanceof Map && [...res[0].values()].every((t) => t.value === "0");
};

let failures = 0;
for (const example of readJson(path.join(queriesDir, "index.json"))) {
  const t0 = performance.now();
  let status;
  try {
    const res = store.query(fs.readFileSync(path.join(queriesDir, example.file), "utf8"), { use_default_graph_as_union: true });
    const count = typeof res === "boolean" ? String(res) : `${res.length} result${res.length === 1 ? "" : "s"}`;
    status = isEmpty(res) ? `FAIL  empty (${count})` : `ok    ${count}`;
  } catch (e) {
    status = `FAIL  ${String(e).split("\n")[0]}`;
  }
  if (status.startsWith("FAIL")) failures++;
  console.log(`${status.padEnd(30)} ${(performance.now() - t0).toFixed(0).padStart(6)} ms  ${example.id}`);
}

if (failures) {
  console.error(`\n${failures} example quer${failures > 1 ? "ies" : "y"} failed`);
  process.exit(1);
}
