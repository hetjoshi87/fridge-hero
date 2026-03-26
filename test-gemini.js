/**
 * Run: $env:GEMINI_API_KEY="your-key"; node test-gemini.js
 * Or create config.local.js (same format as config.local.example.js).
 */
const fs = require("fs");
const https = require("https");
const path = require("path");

function postJsonHttps(urlString, jsonBody) {
  return new Promise(function (resolve, reject) {
    const u = new URL(urlString);
    const data = JSON.stringify(jsonBody);
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data, "utf8"),
      },
    };
    const req = https.request(opts, function (res) {
      const chunks = [];
      res.on("data", function (c) {
        chunks.push(c);
      });
      res.on("end", function () {
        resolve({
          status: res.statusCode,
          text: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    req.on("error", reject);
    req.write(data, "utf8");
    req.end();
  });
}

let key = process.env.GEMINI_API_KEY || "";
if (!key) {
  try {
    const p = path.join(__dirname, "config.local.js");
    const s = fs.readFileSync(p, "utf8");
    const m = s.match(/__GEMINI_API_KEY__\s*=\s*["']([^"']*)["']/);
    if (m) key = m[1].trim();
  } catch (e) {
    /* no local file */
  }
}
const url =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
  encodeURIComponent(key);

function buildPrompt(a, b, c) {
  return (
    "You are a creative chef. Given these 3 ingredients: " +
    a +
    ", " +
    b +
    ", " +
    c +
    ", create:\n" +
    "1. A fancy French-inspired dish name\n" +
    "2. A 3-step cooking instruction (each step one sentence)\n" +
    "Format as JSON: {dishName: string, steps: string[]}"
  );
}

function parseJsonFromModelText(text) {
  const trimmed = String(text).trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
  const raw = fence ? fence[1].trim() : trimmed;
  return JSON.parse(raw);
}

const cases = [
  ["Chicken", "Lemon", "Garlic"],
  ["Tomato", "Basil", "Mozzarella"],
  ["Potato", "Butter", "Rosemary"],
];

async function run() {
  if (!key) {
    console.error(
      "No API key: set GEMINI_API_KEY, or add config.local.js with window.__GEMINI_API_KEY__ = \"...\"; then run again."
    );
    process.exit(1);
  }

  for (let i = 0; i < cases.length; i++) {
    const [a, b, c] = cases[i];
    console.log("\n--- Case " + (i + 1) + ": " + a + ", " + b + ", " + c + " ---\n");

    const body = {
      contents: [{ parts: [{ text: buildPrompt(a, b, c) }] }],
      generationConfig: { responseMimeType: "application/json" },
    };

    const res = await postJsonHttps(url, body);
    const text = res.text;
    if (res.status < 200 || res.status >= 300) {
      console.error("HTTP " + res.status + ":", text.slice(0, 500));
      continue;
    }

    const parsed = JSON.parse(text);
    const candidate =
      parsed.candidates &&
      parsed.candidates[0] &&
      parsed.candidates[0].content &&
      parsed.candidates[0].content.parts &&
      parsed.candidates[0].content.parts[0];
    const rawText = candidate && candidate.text ? candidate.text : "";
    const recipe = parseJsonFromModelText(rawText);
    console.log("dishName:", recipe.dishName);
    console.log("steps:");
    (recipe.steps || []).forEach(function (s, j) {
      console.log("  " + (j + 1) + ". " + s);
    });
  }
}

run().catch(function (e) {
  console.error(e);
  process.exit(1);
});
