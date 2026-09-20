#!/usr/bin/env node
// Copyright (c) 2026 Skuld, LLC. All rights reserved.
// Proprietary and confidential. Reverse engineering prohibited.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCatalogContract } from "./catalog_contract.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(rootDir, "src", "data", "catalogContract.json");
const contract = buildCatalogContract(rootDir);

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(contract, null, 2)}\n`, "utf8");

console.log(
  `catalog-contract: wrote ${path.relative(rootDir, outPath)} ` +
    `(${contract.summary.totalNodes} total, ` +
    `${contract.summary.executableCount} executable, ` +
    `${contract.summary.notImplementedCount} not_implemented, ` +
    `${contract.summary.engineHiddenCount} engine_hidden).`,
);
