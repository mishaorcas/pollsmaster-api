import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(root, "..");
const src = projectRoot;
const dist = join(projectRoot, "dist");

// Clean the previous build output.
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// Copy static pages (index + 404) into dist/.
cpSync(join(src, "index.html"), join(dist, "index.html"));
cpSync(join(src, "404.html"), join(dist, "404.html"));

// .nojekyll tells GitHub Pages not to run Jekyll processing.
cpSync(join(src, ".nojekyll"), join(dist, ".nojekyll"));

const assetsDir = join(dist, "assets");
mkdirSync(assetsDir, { recursive: true });
cpSync(join(src, "css", "style.css"), join(assetsDir, "style.css"));
cpSync(join(src, "js", "app.js"), join(assetsDir, "app.js"));
cpSync(join(src, "js", "html_processor.js"), join(assetsDir, "html_processor.js"));

console.log("Build complete: dist/ is ready to deploy to GitHub Pages.");