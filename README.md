# sparql

**Live site: https://research-software-ecosystem.github.io/sparql/**

Static website to query local Turtle datasets with SPARQL in the browser, using [Oxigraph](https://github.com/oxigraph/oxigraph) compiled to WebAssembly (vendored in `vendor/`, v0.5.11).

- `data/*.ttl` — datasets, each loaded into its own named graph `<urn:dataset:FILE>`
- `data/index.json` — list of files to load, with their sizes (used by the loading bar)
- `queries/` — example queries shown in the interface (see [Example queries](#example-queries))
- Queries run with the default graph as the union of all named graphs.

## Refresh data

```bash
./start.sh --refresh        # downloads the data the published site uses into data/, then starts the site
scripts/fetch-data.sh DEST  # same download into DEST, without starting the site
./update-data.sh            # copies ~/content/datasets/*.ttl and rebuilds data/index.json
./update-data.sh SRC DEST   # copies SRC/*.ttl into DEST and rebuilds DEST/index.json
```

`scripts/fetch-data.sh` keeps a shallow clone of the `datasets/` folder of the content repository in `.cache/content` (about 140 MB, not committed) and updates it on each run. The committed `data/` folder is only used when running locally; the published site fetches its own copy (see below).

## Publishing

The site is published to GitHub Pages by [.github/workflows/deploy.yml](.github/workflows/deploy.yml), on every push to `main`, every day at 04:00 UTC, and on demand (*Actions → Deploy to GitHub Pages → Run workflow*). The workflow:

1. runs `scripts/fetch-data.sh`, which clones only the `datasets/` folder of [research-software-ecosystem/content](https://github.com/research-software-ecosystem/content), applies a temporary fix to `bioconda-dump.ttl` identifiers ([content#4783](https://github.com/research-software-ecosystem/content/issues/4783)) and downloads the latest `EDAM.owl` from https://edamontology.org/EDAM.owl,
2. assembles `index.html`, `app.js`, `config.js`, `vendor/`, `queries/` and the data into `_site/`,
3. runs every example query against that data and stops if one fails or returns nothing (see [Example queries](#example-queries)),
4. pushes `_site/` to the `gh-pages` branch, which GitHub Pages serves at https://research-software-ecosystem.github.io/sparql/.

## Run locally

### Requirements

- A recent browser (Chrome, Firefox, Safari or Edge) with WebAssembly support.
- Bash, Git, curl and Python 3. No build step and no Node.js are needed to run the site.

### Steps

1. Get the code:

   ```bash
   git clone https://github.com/research-software-ecosystem/sparql.git
   cd sparql
   ```

2. Start the site:

   ```bash
   ./start.sh
   ```

   If `data/` has no data yet, this first downloads the data the published site uses (about 70 MB). It then serves the repository on http://localhost:8000 (set `PORT` to change it). Use `./start.sh --refresh` to update the data to the latest version; `npm start` does the same as `./start.sh`.

   Any other static HTTP server works too once `data/` is filled, e.g. `python3 -m http.server 8000` or `npx serve -l 8000`. Opening `index.html` directly (`file://`) does not work, because browsers block loading the `.wasm` file and the datasets from disk.

3. Open http://localhost:8000. A splash screen with a loading bar shows which dataset is being downloaded and parsed (about 75 MB, roughly 1.2 million triples). It disappears once everything is loaded; this takes from a few seconds up to about 30 s depending on the machine, and the tab needs several hundred MB of memory. Files that fail to load are listed on the splash screen and in the collapsible summary above the query box.

4. Pick an example from the **Example query** list, or type a SPARQL query and press **Run** or Ctrl+Enter. Each file is in its own named graph `<urn:dataset:FILENAME>`, and the default graph is the union of all of them, so queries can either ignore graphs or use `GRAPH ?g { … }`.

To stop the server, press Ctrl+C in its terminal.

## Example queries

The **Example query** list is built from [queries/index.json](queries/index.json); each entry has an `id`, a `group` (shown as a heading in the list), a `title`, a `description` and the `file` holding the query in [queries/](queries/). The page opens with the first example and runs it once the data is loaded.

Queries can be linked to directly:

- `…/sparql/#example=paper-q1` opens and runs an example (by its `id`),
- `…/sparql/#query=<URL-encoded SPARQL>` opens and runs any query; the **Copy link** button builds this link for the query in the editor.

To add an example, put the query in a new `.rq` file in `queries/`, add an entry to `queries/index.json`, then check that all examples still work:

```bash
npm install
npm run check-queries                       # against data/
npm run check-queries -- DATA_DIR QUERIES_DIR
```

The check loads the data as the web page does and fails if a query errors or returns nothing (no rows, or a single count of 0). The publishing workflow runs it on the freshly built data, so a change in an upstream dataset that breaks an example stops the deployment instead of publishing a site whose examples return nothing.

## Demo animation

![demo](demo.gif)

`demo.gif` is generated by [scripts/record-demo.mjs](scripts/record-demo.mjs), which starts a temporary server, drives headless Chrome through loading the datasets and running a query, and assembles the screenshots with ImageMagick. Requires Node, Chrome and ImageMagick 7 (`magick`).

```bash
npm install
npm run demo                                    # rewrites demo.gif
CHROME=/usr/bin/chromium npm run demo -- out.gif   # other browser / output path
```
