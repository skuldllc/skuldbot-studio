// Copyright (c) 2026 Skuld, LLC. All rights reserved.
// Proprietary and confidential. Reverse engineering prohibited.

// Node availability is derived from a single generated source of truth:
// `src/data/nodeAvailability.json`, produced by QG19's parity checker
// (skuldbot-documentation/scripts/quality/check_node_parity.py). Regenerate it
// with `npm run gen:availability`. This module never hardcodes per-node status;
// it only reads the manifest. A node may be placed, configured and run in the
// Studio ONLY when its status is "executable" — every other status (including a
// node absent from the manifest) is treated as non-executable so the palette can
// never claim a node runs when the runtime cannot execute it.

import manifest from "@/data/nodeAvailability.json";

export type NodeAvailabilityStatus =
  | "executable"
  | "runtime_blocked"
  | "not_implemented"
  | "unknown";

export interface NodeAvailability {
  nodeType: string;
  status: NodeAvailabilityStatus;
  reasons: string[];
  hasCompilerMapping: boolean;
  hasExecutorMapping: boolean;
  runtimeBlocked: boolean;
}

interface ManifestEntry {
  nodeType: string;
  status: string;
  reasons: string[];
  hasCompilerMapping: boolean;
  hasExecutorMapping: boolean;
  runtimeBlocked: boolean;
}

interface AvailabilityManifest {
  schemaVersion: string;
  generatedBy: string;
  nodes: Record<string, ManifestEntry>;
}

// The manifest is a build-time generated artifact. A major-version mismatch means
// the generator and this consumer have diverged — fail fast rather than silently
// misreport availability.
const SUPPORTED_SCHEMA_MAJOR = "1";

const typedManifest = manifest as unknown as AvailabilityManifest;

const manifestMajor = String(typedManifest.schemaVersion ?? "").split(".")[0];
if (manifestMajor !== SUPPORTED_SCHEMA_MAJOR) {
  throw new Error(
    `nodeAvailability.json schemaVersion "${typedManifest.schemaVersion}" is not ` +
      `supported (expected major ${SUPPORTED_SCHEMA_MAJOR}). Run "npm run gen:availability".`,
  );
}

const KNOWN_STATUSES: ReadonlySet<NodeAvailabilityStatus> = new Set([
  "executable",
  "runtime_blocked",
  "not_implemented",
]);

function normalizeStatus(status: string): NodeAvailabilityStatus {
  return KNOWN_STATUSES.has(status as NodeAvailabilityStatus)
    ? (status as NodeAvailabilityStatus)
    : "unknown";
}

/**
 * Availability for a node type. A node missing from the manifest is reported as
 * "unknown" (fail-closed: non-executable) rather than assumed runnable.
 */
export function getNodeAvailability(nodeType: string): NodeAvailability {
  const entry = typedManifest.nodes[nodeType];
  if (!entry) {
    return {
      nodeType,
      status: "unknown",
      reasons: ["not_in_availability_manifest"],
      hasCompilerMapping: false,
      hasExecutorMapping: false,
      runtimeBlocked: false,
    };
  }
  return {
    nodeType: entry.nodeType,
    status: normalizeStatus(entry.status),
    reasons: entry.reasons ?? [],
    hasCompilerMapping: Boolean(entry.hasCompilerMapping),
    hasExecutorMapping: Boolean(entry.hasExecutorMapping),
    runtimeBlocked: Boolean(entry.runtimeBlocked),
  };
}

/** True only when the node can be compiled and executed end-to-end today. */
export function isNodeExecutable(nodeType: string): boolean {
  return getNodeAvailability(nodeType).status === "executable";
}

export interface AvailabilityPresentation {
  label: string;
  /** Maps to the shared Badge variant. */
  variant: "default" | "secondary" | "destructive" | "outline";
  /** One-line, human-readable explanation. Never a raw reason code. */
  tooltip: string;
  /** True when the node must be blocked from drag / config / run. */
  blocked: boolean;
}

const REASON_TEXT: Record<string, string> = {
  missing_compiler_mapping: "no compiler mapping yet",
  missing_executor_mapping: "no runtime keyword yet",
  requires_graphical_runtime: "needs a graphical display session",
  not_in_availability_manifest: "not yet verified by the parity gate",
};

function humanizeReasons(reasons: string[]): string {
  const parts = reasons.map((r) => REASON_TEXT[r]).filter(Boolean);
  return parts.length > 0 ? parts.join("; ") : "";
}

/**
 * Human-facing presentation for a node's availability. Used by the palette badge,
 * tooltips and blocking messages. All copy is plain language — no reason codes,
 * no claims that a node runs when it cannot.
 */
export function getAvailabilityPresentation(
  availability: NodeAvailability,
): AvailabilityPresentation {
  const reasonText = humanizeReasons(availability.reasons);
  switch (availability.status) {
    case "executable":
      return {
        label: "Executable",
        variant: "secondary",
        tooltip: "Compiles and runs end-to-end.",
        blocked: false,
      };
    case "runtime_blocked":
      return {
        label: "Runtime blocked",
        variant: "outline",
        tooltip:
          "Designed, but cannot run yet — it needs a graphical display session " +
          "(graphical runtime track). Not available to place or run.",
        blocked: true,
      };
    case "not_implemented":
      return {
        label: "Not implemented",
        variant: "destructive",
        tooltip: reasonText
          ? `Not executable yet (${reasonText}). Not available to place or run.`
          : "Not executable yet. Not available to place or run.",
        blocked: true,
      };
    case "unknown":
    default:
      return {
        label: "Unverified",
        variant: "destructive",
        tooltip:
          "Availability not verified by the parity gate. Treated as non-executable. " +
          'Run "npm run gen:availability".',
        blocked: true,
      };
  }
}

/** Convenience: presentation directly from a node type. */
export function getNodePresentation(nodeType: string): AvailabilityPresentation {
  return getAvailabilityPresentation(getNodeAvailability(nodeType));
}
