# rsec-sparql

Static website to query local Turtle datasets with SPARQL in the browser, using [Oxigraph](https://github.com/oxigraph/oxigraph) compiled to WebAssembly (vendored in `vendor/`, v0.5.11).

- `data/*.ttl` — datasets, each loaded into its own named graph `<urn:dataset:FILE>`
- `data/index.json` — list of files to load
- Queries run with the default graph as the union of all named graphs.

## Refresh data

```bash
./update-data.sh            # copies ~/content/datasets/*.ttl and rebuilds data/index.json
```

## Run

Any static file server works (WASM needs to be served over HTTP, not `file://`):

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.
