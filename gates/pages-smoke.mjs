// Checks the built static site the way GitHub Pages serves it: plain files under site/, no dev
// server, no host. Opens the landing page and every notebook it lists in a headless browser and
// fails on an uncaught exception, a console error, a failed request or a response of 400 or more,
// a notebook that shows fewer turns than its catalog entry, a "could not open" box, or a missing
// link to NOTICE.md.
//
// Usage, from the repository root, after npm run build:pages (it writes site/app):
//   node gates/pages-smoke.mjs                          headless Edge
//   node gates/pages-smoke.mjs --screenshots docs/images   also saves landing.png (whole page)
//                                                       and <notebook>.png (the first screen of each)
// PAGES_BROWSER_CHANNEL picks another installed browser (CI uses chrome); PAGES_PORT the port.

import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "site");
const catalogFile = join(site, "app", "notebooks", "catalog.json");
// playwright-core is a devDependency of the web workspace, not of the repository root.
const { chromium } = createRequire(join(root, "bimopenflow", "web", "package.json"))("playwright-core");

const port = Number(process.env.PAGES_PORT ?? 5355);
const channel = process.env.PAGES_BROWSER_CHANNEL ?? "msedge";
const shotsArg = process.argv.indexOf("--screenshots");
const shots = shotsArg < 0 ? undefined : resolve(process.argv[shotsArg + 1] ?? "docs/images");
const timeoutMs = 60_000;

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".wasm": "application/wasm", ".woff2": "font/woff2",
};

/** Serves site/ as GitHub Pages does: a folder answers with its index.html. */
function serve() {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
    let file = normalize(join(site, path));
    if (!file.startsWith(site + sep) && file !== site) { res.writeHead(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  return new Promise((done) => server.listen(port, "127.0.0.1", () => done(server)));
}

/** Every problem a page reports. */
function watch(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`exception: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  page.on("response", (response) => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
  page.on("requestfailed", (request) => errors.push(`request failed: ${request.url()} (${request.failure()?.errorText ?? ""})`));
  return errors;
}

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise((done) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(done)), 500)));
}

async function main() {
  if (!existsSync(catalogFile)) throw new Error(`${catalogFile} is missing; run npm run build:pages first`);
  const catalog = JSON.parse(readFileSync(catalogFile, "utf8"));
  const turnsOf = new Map(catalog.map((entry) => [entry.name, entry.turns]));
  if (shots) mkdirSync(shots, { recursive: true });

  const server = await serve();
  const origin = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ channel, headless: true });
  const failures = [];
  try {
    // The landing page: one card per catalog entry, and the NOTICE.md link.
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const landingErrors = watch(page);
    await page.goto(`${origin}/`, { waitUntil: "load" });
    await page.waitForSelector(".card", { timeout: timeoutMs }).catch(() => {});
    const cards = await page.$$eval(".card", (links) => links.map((a) => new URL(a.href).searchParams.get("notebook")));
    const noticeLinks = await page.$$eval('a[href$="NOTICE.md"]', (links) => links.map((a) => a.href));
    if (cards.length !== catalog.length) failures.push(`landing: ${cards.length} cards for ${catalog.length} catalog entries`);
    if (noticeLinks.length === 0) failures.push("landing: no link to NOTICE.md");
    for (const href of new Set(noticeLinks)) {
      const response = await page.request.get(href);
      if (!response.ok() || !(await response.text()).startsWith("# Notices")) failures.push(`landing: ${href} is not the NOTICE`);
    }
    await settle(page);
    if (shots) await page.screenshot({ path: join(shots, "landing.png"), fullPage: true });
    console.log(`landing: ${cards.length} notebooks listed, ${noticeLinks.length} NOTICE.md links`);
    for (const message of landingErrors) failures.push(`landing: ${message}`);
    await page.close();
    if (catalog.length < 3) failures.push(`catalog: ${catalog.length} notebooks, expected at least 3`);

    // Each notebook: every turn drawn, no problems box, the hostless note linking NOTICE.md.
    for (const name of cards) {
      const one = await browser.newPage({ viewport: { width: 1200, height: 900 } });
      const errors = watch(one);
      try {
        await one.goto(`${origin}/app/notebook.html?notebook=${encodeURIComponent(name)}`, { waitUntil: "load" });
        const turns = turnsOf.get(name) ?? 1;
        await one.waitForFunction((n) => document.querySelectorAll(".nb-turn").length >= n || document.querySelector(".nb-problems") !== null, turns, { timeout: timeoutMs });
        await settle(one);
        const seen = await one.evaluate(() => ({
          turns: document.querySelectorAll(".nb-turn").length,
          embeds: document.querySelectorAll(".nb-embed").length,
          problems: [...document.querySelectorAll(".nb-problems")].map((p) => p.textContent),
          notice: document.querySelector('.nb-ask-note a[href="NOTICE.md"]') !== null,
        }));
        if (seen.problems.length > 0) throw new Error(seen.problems.join("; "));
        if (seen.turns !== turns) throw new Error(`${seen.turns} turns drawn, catalog says ${turns}`);
        if (!seen.notice) throw new Error("the hostless note does not link NOTICE.md");
        if (shots) {
          // The top of the notebook, with the sticky request box moved to the end so it covers nothing.
          await one.addStyleTag({ content: ".nb-ask { position: static !important; }" });
          await settle(one);
          await one.screenshot({ path: join(shots, `${name}.png`) });
        }
        console.log(`ok   ${name}: ${seen.turns} turns, ${seen.embeds} embeds`);
      } catch (cause) {
        failures.push(`${name}: ${cause instanceof Error ? cause.message : String(cause)}`);
        console.log(`FAIL ${name}`);
      }
      for (const message of errors) failures.push(`${name}: ${message}`);
      await one.close();
    }
  } finally {
    await browser.close();
    await new Promise((done) => server.close(done));
  }
  for (const failure of failures) console.log(`  ${failure}`);
  console.log(failures.length === 0 ? "PAGES SMOKE: PASS" : `PAGES SMOKE: FAIL (${failures.length} problems)`);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

await main();
