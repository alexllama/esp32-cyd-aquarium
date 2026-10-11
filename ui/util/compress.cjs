#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = path.resolve(__dirname, "..");
const uiLibRoot = path.resolve(__dirname, "..", "..", "lib", "UI");
const distHtml = path.join(root, "dist", "index.html");
const outCpp = path.join(uiLibRoot, "interface.cpp");
const outH = path.join(uiLibRoot, "interface.h");

if (!fs.existsSync(distHtml)) {
  console.error(
    `compress: ${distHtml} not found. Run "vite build" (npm run build) first.`
  );
  process.exit(1);
}

const html = fs.readFileSync(distHtml);
const gz = zlib.gzipSync(html, {
  level: zlib.constants.Z_BEST_COMPRESSION,
  mtime: 0,
});

fs.mkdirSync(uiLibRoot, { recursive: true });

const header = [
  "#ifndef interface_h",
  "#define interface_h",
  "",
  '#include "Arduino.h"',
  "",
  "extern const uint8_t OPEN_MATRIX_HTML[" + gz.length + "];",
  "",
  "#endif",
  "",
].join("\n");

const lines = [];
lines.push('#include "interface.h" ');
lines.push("");
lines.push(
  "const uint8_t OPEN_MATRIX_HTML[" + gz.length + "] PROGMEM = { "
);
for (let i = 0; i < gz.length; i += 16) {
  lines.push(Array.from(gz.subarray(i, i + 16)).join(",") + ",");
}
const lastLineIndex = lines.length - 1;
lines[lastLineIndex] = lines[lastLineIndex].replace(/,$/, "");
lines.push("};");
lines.push("");

fs.writeFileSync(outH, header);
fs.writeFileSync(outCpp, lines.join("\n"));

const sizeKb = (gz.length / 1024).toFixed(1);
console.log(
  `compress: dist/index.html (${(html.length / 1024).toFixed(1)} KB) -> lib/UI/interface.{h,cpp} (${gz.length} bytes / ${sizeKb} KB gzip)`
);