#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const shouldWrite = args.has("--write");

const rootDir = process.cwd();
const allowedExt = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".md",
  ".json",
  ".yml",
  ".yaml",
  ".txt",
]);
const ignoredDirs = new Set(["node_modules", ".next", ".next-dev", ".git", "artifacts"]);

// Broad mojibake signatures typically produced by bad UTF-8 decoding.
const mojibakeMatchers = [
  /\u00C2/g,
  /\u00C3./g,
  /\u00E2./g,
  /\u00F0\u0178/g,
  /\u00EF\u00B8/g,
  /\uFFFD/g,
];

function collectFiles(dirPath, output) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) continue;
      collectFiles(abs, output);
      continue;
    }

    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (allowedExt.has(ext)) {
      output.push(abs);
    }
  }
}

function scoreMojibake(text) {
  let score = 0;
  for (const regex of mojibakeMatchers) {
    const matches = text.match(regex);
    if (matches) score += matches.length;
  }
  return score;
}

const win1252Reverse = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

function encodeWin1252(text) {
  const bytes = [];

  for (const char of text) {
    const cp = char.codePointAt(0);
    if (cp <= 0xff) {
      bytes.push(cp);
      continue;
    }

    const mapped = win1252Reverse[cp];
    if (mapped !== undefined) {
      bytes.push(mapped);
      continue;
    }

    return null;
  }

  return Buffer.from(bytes);
}

function normalizeLine(line) {
  // Rebuild original Windows-1252 bytes, then decode as UTF-8.
  const bytes = encodeWin1252(line);
  if (!bytes) return line;
  return bytes.toString("utf8");
}

function normalizeText(text) {
  const lines = text.split(/\r?\n/);
  let changed = false;

  const out = lines.map((line) => {
    const before = scoreMojibake(line);
    if (before === 0) return line;

    const fixed = normalizeLine(line);
    const after = scoreMojibake(fixed);
    if (after < before) {
      changed = true;
      return fixed;
    }

    return line;
  });

  return {
    text: out.join("\n"),
    changed,
  };
}

const files = [];
collectFiles(rootDir, files);

const touched = [];
const detected = [];

for (const absFile of files) {
  const original = fs.readFileSync(absFile, "utf8");
  const before = scoreMojibake(original);
  if (before === 0) continue;

  detected.push(path.relative(rootDir, absFile));

  const normalized = normalizeText(original);
  const fixed = normalized.text;
  const after = scoreMojibake(fixed);

  // Only accept transformation when it clearly improves mojibake signatures.
  if (shouldWrite && normalized.changed && after < before) {
    fs.writeFileSync(absFile, fixed, "utf8");
    touched.push(path.relative(rootDir, absFile));
  }
}

if (shouldWrite) {
  console.log(`Detected files: ${detected.length}`);
  console.log(`Repaired files: ${touched.length}`);
  for (const rel of touched) {
    console.log(rel);
  }
  process.exit(0);
}

if (detected.length > 0) {
  console.log(`Detected files: ${detected.length}`);
  for (const rel of detected) {
    console.log(rel);
  }
  process.exit(1);
}

console.log("No mojibake signatures detected.");
process.exit(0);
