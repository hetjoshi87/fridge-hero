/**
 * Writes config.local.js from process.env.GEMINI_API_KEY
 * Usage (PowerShell): $env:GEMINI_API_KEY="your-key"; node write-config.js
 */
const fs = require("fs");
const key = process.env.GEMINI_API_KEY || "";
fs.writeFileSync(
  "config.local.example.js",
  `window.__GEMINI_API_KEY__=${JSON.stringify(key)};\n`
);
