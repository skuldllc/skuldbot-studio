// Copyright (c) 2026 Skuld, LLC. All rights reserved.
// Proprietary and confidential. Reverse engineering prohibited.

// Flow-level runtime preflight (GR-ST-003). Node-level availability already blocks
// individual non-executable nodes; this raises the same truth to the FLOW level: a
// flow that contains any node requiring a rendered display needs a graphical runtime
// and cannot run on a headless runner. It is derived purely from the generated
// availability manifest (no hardcoded node lists) and is design-time only — it makes
// no claim that the flow will run, it states what runtime the flow would require.

import { getNodeAvailability } from "@/lib/nodeAvailability";

export type RuntimeTarget = "headless" | "graphical";

/** Capability code a runner must advertise to host a graphical flow. */
export const GRAPHICAL_DISPLAY_CAPABILITY = "graphical_display";

export interface FlowGraphicalNode {
  nodeType: string;
  label: string;
}

export interface FlowRuntimeRequirements {
  /** "graphical" when any node needs a rendered display; otherwise "headless". */
  runtimeTarget: RuntimeTarget;
  /** Capability codes the target runner must advertise (empty when headless). */
  requiredCapabilities: string[];
  /** Distinct node types that force a graphical runtime, with a display label. */
  graphicalNodes: FlowGraphicalNode[];
}

interface FlowNodeLike {
  data?: { nodeType?: string | null; label?: string | null } | null;
}

/**
 * Compute the runtime a flow would require from its nodes. A node forces a graphical
 * runtime when the parity manifest marks it `runtimeBlocked` (it needs a rendered
 * display — desktop/vision/ocr/logging.screenshot). Distinct node types only.
 */
export function analyzeFlowRuntimeRequirements(
  nodes: readonly FlowNodeLike[] | null | undefined,
): FlowRuntimeRequirements {
  const graphicalNodes: FlowGraphicalNode[] = [];
  const seen = new Set<string>();

  for (const node of nodes ?? []) {
    const nodeType = node?.data?.nodeType;
    if (!nodeType || seen.has(nodeType)) {
      continue;
    }
    if (getNodeAvailability(nodeType).runtimeBlocked) {
      seen.add(nodeType);
      graphicalNodes.push({
        nodeType,
        label: node?.data?.label?.trim() || nodeType,
      });
    }
  }

  const requiresGraphical = graphicalNodes.length > 0;
  return {
    runtimeTarget: requiresGraphical ? "graphical" : "headless",
    requiredCapabilities: requiresGraphical ? [GRAPHICAL_DISPLAY_CAPABILITY] : [],
    graphicalNodes,
  };
}

export interface RuntimePreflightMessage {
  title: string;
  detail: string;
}

/**
 * Human-readable preflight notice for a flow's runtime requirement, or null when the
 * flow can run headless (no notice needed). Plain language — never a claim that the
 * flow runs today.
 */
export function getRuntimePreflightMessage(
  requirements: FlowRuntimeRequirements,
): RuntimePreflightMessage | null {
  if (requirements.runtimeTarget !== "graphical") {
    return null;
  }
  const names = requirements.graphicalNodes.map((n) => n.label);
  const preview = names.slice(0, 3).join(", ");
  const extra = names.length > 3 ? ` and ${names.length - 3} more` : "";
  return {
    title: "Requires a graphical display session",
    detail:
      `This flow uses ${names.length} node${names.length === 1 ? "" : "s"} that need a ` +
      `rendered display (${preview}${extra}). It can't run on a headless runner yet — ` +
      `it needs a graphical runtime that isn't available in this environment.`,
  };
}
