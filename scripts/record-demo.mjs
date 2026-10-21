// Record demo.gif: open the site in headless Chrome, capture the loading splash screen and the
// first example's results, pick a few more examples from the list, then assemble the screenshots
// into a GIF with ImageMagick.
//
// Usage: npm run demo [-- output.gif]
// Env:   CHROME=/path/to/chrome (default: /usr/bin/google-chrome), PORT=8765
import puppeteer from "puppeteer-core";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.resolve(process.argv[2] ?? path.join(ROOT, "demo.gif"));
const CHROME = process.env.CHROME ?? "/usr/bin/google-chrome";
const PORT = Number(process.env.PORT ?? 8765);
const URL = `http://localhost:${PORT}/`;
const WIDTH = 1000, HEIGHT = 900, GIF_WIDTH = 800;

// Examples shown after the first one (ids from queries/index.json)
const EXAMPLES = ["paper-q2", "tool-across-registries"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const work = fs.mkdtempSync(path.join(os.tmpdir(), "demo-gif-"));

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(URL)).ok) return; } catch {}
    await sleep(200);
  }
  throw new Error(`server did not start on ${URL}`);
}

async function record() {
  const frames = []; // [png path, address-bar text, delay in 1/100 s]
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    userDataDir: path.join(work, "profile"), args: ["--no-first-run"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT });
    let url = "about:blank";
    const snap = async (delay) => {
      const f = path.join(work, `${String(frames.length).padStart(3, "0")}.png`);
      await page.screenshot({ path: f });
      frames.push([f, url, delay]);
    };

    await page.goto(url); await snap(80);
    url = URL;
    await page.goto(url, { waitUntil: "domcontentloaded" }); await snap(60);
    while (await page.$("#splash")) { await sleep(1000); await snap(25); }
    // The page runs the first example once the data is loaded: show the introduction,
    // then scroll to the query and its results (below the sticky header)
    await page.waitForFunction(() => document.getElementById("info").textContent !== "");
    await snap(250);
    await page.evaluate(() => {
      const header = document.querySelector(".site-header").offsetHeight;
      window.scrollTo(0, document.querySelector(".panel").offsetTop - header - 12);
    });
    await snap(400);

    for (const id of EXAMPLES) {
      // Selecting an example runs it right away and puts it in the URL (?query=…)
      await page.select("#examples", id);
      await page.waitForFunction(() => new URLSearchParams(location.search).get("query") === document.getElementById("query").value);
      url = decodeURIComponent(page.url().replace(/\+/g, " "));
      await snap(400);
    }
  } finally {
    await browser.close();
  }
  return frames;
}

// Long ?query=… URLs don't fit in the address bar: show the start, on one line
const shorten = (url) => {
  const line = url.replace(/\s+/g, " ");
  return line.length > 100 ? `${line.slice(0, 99)}…` : line;
};

function assemble(frames) {
  const args = [];
  frames.forEach(([png, url, delay], i) => {
    const out = path.join(work, `bar-${i}.png`);
    execFileSync("magick", [png, "-background", "#e8e8e8", "-gravity", "north", "-splice", "0x40",
      "-fill", "white", "-stroke", "#c8c8c8", "-draw", `roundrectangle 12,7 ${WIDTH - 12},33 13,13`,
      "-stroke", "none", "-fill", "#333", "-font", "DejaVu-Sans", "-pointsize", "15",
      "-gravity", "northwest", "-annotate", "+28+12", shorten(url), "-resize", `${GIF_WIDTH}x`, out]);
    args.push("-delay", String(delay), out);
  });
  execFileSync("magick", [...args, "-loop", "0", "-colors", "96", "-layers", "OptimizeFrame", OUTPUT]);
}

const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
try {
  await waitForServer();
  const frames = await record();
  assemble(frames);
  console.log(`${OUTPUT}: ${frames.length} frames, ${(fs.statSync(OUTPUT).size / 1e3).toFixed(0)} kB`);
} finally {
  server.kill();
  fs.rmSync(work, { recursive: true, force: true });
}
