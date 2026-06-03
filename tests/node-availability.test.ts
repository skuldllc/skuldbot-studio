// Copyright (c) 2026 Skuld, LLC. All rights reserved.
// Proprietary and confidential. Reverse engineering prohibited.

import {
  getNodeAvailability,
  isNodeExecutable,
  getAvailabilityPresentation,
  getNodePresentation,
} from "../src/lib/nodeAvailability";
import manifest from "../src/data/nodeAvailability.json";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const KNOWN_STATUSES = new Set(["executable", "runtime_blocked", "not_implemented"]);

// 1. Every manifest entry is internally consistent: the status the generator
//    assigned must match the mapping/runtime flags it recorded. This is the
//    contract the UI relies on to decide what is runnable.
const entries = Object.values(manifest.nodes) as Array<{
  nodeType: string;
  status: string;
  hasCompilerMapping: boolean;
  hasExecutorMapping: boolean;
  runtimeBlocked: boolean;
  reasons: string[];
}>;

assert(entries.length > 0, "manifest must contain nodes");

for (const e of entries) {
  assert(KNOWN_STATUSES.has(e.status), `unknown status "${e.status}" for ${e.nodeType}`);

  if (e.status === "executable") {
    assert(
      e.hasCompilerMapping && e.hasExecutorMapping && !e.runtimeBlocked,
      `executable node ${e.nodeType} must have both mappings and not be runtime-blocked`,
    );
  } else if (e.status === "runtime_blocked") {
    assert(e.runtimeBlocked, `runtime_blocked node ${e.nodeType} must set runtimeBlocked`);
  } else {
    // not_implemented
    assert(
      !e.hasCompilerMapping || !e.hasExecutorMapping,
      `not_implemented node ${e.nodeType} must be missing a mapping`,
    );
    assert(
      !e.runtimeBlocked,
      `not_implemented node ${e.nodeType} must not be runtime_blocked (that is its own status)`,
    );
  }
}

// 2. isNodeExecutable agrees with the manifest status, for every node.
for (const e of entries) {
  assert(
    isNodeExecutable(e.nodeType) === (e.status === "executable"),
    `isNodeExecutable disagrees with manifest for ${e.nodeType}`,
  );
}

// 3. A node absent from the manifest is fail-closed: "unknown" and blocked.
const ghost = getNodeAvailability("this.node.does.not.exist");
assert(ghost.status === "unknown", "missing node must be 'unknown'");
assert(isNodeExecutable("this.node.does.not.exist") === false, "missing node must be non-executable");
assert(getNodePresentation("this.node.does.not.exist").blocked, "missing node must be blocked");

// 4. Presentation contract: only executable is unblocked; copy is human-readable
//    (no raw reason codes leak into the UI), and labels are the agreed wording.
const expectedLabels: Record<string, string> = {
  executable: "Executable",
  runtime_blocked: "Runtime blocked",
  not_implemented: "Not implemented",
  unknown: "Unverified",
};

for (const status of ["executable", "runtime_blocked", "not_implemented", "unknown"] as const) {
  const presentation = getAvailabilityPresentation({
    nodeType: "sample",
    status,
    reasons: status === "not_implemented" ? ["missing_compiler_mapping"] : [],
    hasCompilerMapping: status === "executable",
    hasExecutorMapping: status === "executable",
    runtimeBlocked: status === "runtime_blocked",
  });
  assert(presentation.label === expectedLabels[status], `wrong label for ${status}`);
  assert(presentation.blocked === (status !== "executable"), `wrong blocked flag for ${status}`);
  // Reason codes use snake_case; the user-facing tooltip must not expose them.
  assert(
    !/[a-z]+_[a-z]+_[a-z]+/.test(presentation.tooltip),
    `tooltip for ${status} leaks a raw reason code: "${presentation.tooltip}"`,
  );
}

// 5. Sanity: the catalog has at least one node of each lifecycle status, so the
//    badges and blocking paths are all exercised by real data.
const present = new Set(entries.map((e) => e.status));
for (const status of ["executable", "runtime_blocked", "not_implemented"]) {
  assert(present.has(status), `expected at least one "${status}" node in the manifest`);
}

console.log(
  `node-availability: ${entries.length} nodes validated ` +
    `(${entries.filter((e) => e.status === "executable").length} executable, ` +
    `${entries.filter((e) => e.status === "runtime_blocked").length} runtime_blocked, ` +
    `${entries.filter((e) => e.status === "not_implemented").length} not_implemented).`,
);
