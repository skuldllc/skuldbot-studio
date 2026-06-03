#!/usr/bin/env node
// Copyright (c) 2026 Skuld, LLC. All rights reserved.
// Proprietary and confidential. Reverse engineering prohibited.

import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entryPoint = path.join(rootDir, "tests", "node-availability.test.ts");
const tempDir = mkdtempSync(path.join(tmpdir(), "skuldbot-node-availability-"));
const outFile = path.join(tempDir, "node-availability.test.mjs");

try {
  await build({
    entryPoints: [entryPoint],
    outfile: outFile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    // The availability module imports its manifest via the "@/" path alias used
    // across the Studio; mirror Vite's alias so the bundle resolves it.
    alias: { "@": path.join(rootDir, "src") },
    loader: { ".json": "json" },
    sourcemap: false,
    logLevel: "silent",
  });

  await import(pathToFileURL(outFile).href);
  console.log("Node availability tests passed.");
} catch (error) {
  console.error("Node availability tests failed:", error);
  process.exitCode = 1;
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
