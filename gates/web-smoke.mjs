// Headless smoke: test and typecheck the 3D pane and the notebook, then build the static site.
// Usage: node gates/web-smoke.mjs   (from the repo root, after node deps.mjs, npm ci and
// npm run build in deps/bim-open-viewer, and npm ci in bimopenflow/web)
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const web = join(root, "bimopenflow", "web");

// bim-open-flow's eight editor packages and the viewer's packages are linked from deps/
// and tested by their own repositories; here the two packages of this repository are
// tested and built against them.
const steps = [
  ...["pane-3d", "bim-open-notebook"].flatMap((p) => [
    ["test", "-w", `@bimopenflow/${p}`],
    ["run", "typecheck", "-w", `@bimopenflow/${p}`],
  ]),
  ["run", "build:pages", "-w", "@bimopenflow/bim-open-notebook"],
];

let failed = false;
for (const args of steps) {
  console.log(`\n== npm ${args.join(" ")} (${web}) ==`);
  const res = spawnSync("npm", args, { cwd: web, stdio: "inherit", shell: true });
  if (res.status !== 0) { failed = true; console.error(`FAILED: npm ${args.join(" ")}`); }
}
console.log(failed ? "\nWEB SMOKE: FAIL" : "\nWEB SMOKE: PASS");
process.exitCode = failed ? 1 : 0;
