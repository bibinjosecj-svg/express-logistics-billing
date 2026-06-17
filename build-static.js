const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "dist");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const file of ["index.html"]) {
  fs.copyFileSync(path.join(__dirname, file), path.join(outDir, file));
}

console.log("Static site built to dist");
