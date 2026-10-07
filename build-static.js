const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "dist");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const file of ["index.html"]) {
  fs.copyFileSync(path.join(__dirname, file), path.join(outDir, file));
}

for (const dir of ["css", "js"]) {
  fs.cpSync(path.join(__dirname, dir), path.join(outDir, dir), { recursive: true });
}

console.log("Static site built to dist");
