#!/usr/bin/env node
// Copyright (c) 2026 Skuld, LLC. All rights reserved.
// Proprietary and confidential. Reverse engineering prohibited.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCatalogContract } from "./catalog_contract.mjs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = path.join(rootDir, "src", "data", "catalogContract.json");
const expected = `${JSON.stringify(buildCatalogContract(rootDir), null, 2)}\n`;
const actual = readFileSync(contractPath, "utf8");

if (actual !== expected) {
  console.error(
    "catalog-contract: committed src/data/catalogContract.json is stale. " +
      "Run `npm run gen:catalog-contract` and commit the result.",
  );
  process.exit(1);
}

const contract = JSON.parse(actual);
assert(contract.generatedBy === "studio-catalog-contract", "wrong generator marker");
assert(contract.schemaVersion === "1.0.0", "wrong schema version");
assert(contract.nodes && typeof contract.nodes === "object", "missing nodes map");

const nodes = Object.values(contract.nodes);
assert(nodes.length > 0, "catalog contract has no nodes");

const knownStatuses = new Set([
  "executable",
  "runtime_blocked",
  "not_implemented",
  "engine_hidden",
]);

for (const node of nodes) {
  assert(typeof node.nodeType === "string" && node.nodeType.includes("."), `bad nodeType: ${node.nodeType}`);
  assert(knownStatuses.has(node.status), `unknown status for ${node.nodeType}: ${node.status}`);
  assert(node.plannerEligible === (node.status === "executable"), `plannerEligible mismatch for ${node.nodeType}`);

  if (node.status === "executable") {
    assert(node.studioVisible, `executable node must be visible in Studio: ${node.nodeType}`);
    assert(node.hasCompilerMapping, `executable node must have compiler mapping: ${node.nodeType}`);
    assert(node.hasExecutorMapping, `executable node must have executor mapping: ${node.nodeType}`);
    assert(!node.runtimeBlocked, `executable node must not be runtime blocked: ${node.nodeType}`);
  }

  if (node.status === "engine_hidden") {
    assert(!node.studioVisible, `engine_hidden node cannot be visible in Studio: ${node.nodeType}`);
    assert(
      node.hasCompilerMapping || node.hasExecutorMapping,
      `engine_hidden node must exist in compiler or executor: ${node.nodeType}`,
    );
    assert(node.reasons.includes("not_visible_in_studio"), `engine_hidden reason missing for ${node.nodeType}`);
  }
}

for (const status of knownStatuses) {
  assert(nodes.some((node) => node.status === status), `expected at least one ${status} node`);
}

const summary = contract.summary;
assert(summary.totalNodes === nodes.length, "summary.totalNodes mismatch");
assert(
  summary.executableCount === nodes.filter((node) => node.status === "executable").length,
  "summary.executableCount mismatch",
);
assert(
  summary.engineHiddenCount === nodes.filter((node) => node.status === "engine_hidden").length,
  "summary.engineHiddenCount mismatch",
);

console.log(
  `catalog-contract: ${nodes.length} nodes validated ` +
    `(${summary.executableCount} executable, ` +
    `${summary.notImplementedCount} not_implemented, ` +
    `${summary.engineHiddenCount} engine_hidden).`,
);
