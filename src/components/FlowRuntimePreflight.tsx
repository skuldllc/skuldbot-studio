// Copyright (c) 2026 Skuld, LLC. All rights reserved.
// Proprietary and confidential. Reverse engineering prohibited.

import { Monitor } from "lucide-react";
import {
  analyzeFlowRuntimeRequirements,
  getRuntimePreflightMessage,
} from "@/lib/flowRuntimeRequirements";

interface FlowRuntimePreflightProps {
  // Active-flow nodes. Each editor owns its own node source (project bot vs flow
  // store), so the set is passed in rather than read from a single store.
  nodes: ReadonlyArray<{ data?: { nodeType?: string | null; label?: string | null } | null }>;
}

/**
 * Design-time, flow-level preflight banner (GR-ST-003). Shows only when the flow
 * requires a graphical display session; stays out of the way for headless flows.
 * Communicates the runtime requirement honestly — it does not claim the flow runs.
 */
export function FlowRuntimePreflight({ nodes }: FlowRuntimePreflightProps) {
  const requirements = analyzeFlowRuntimeRequirements(nodes);
  const message = getRuntimePreflightMessage(requirements);
  if (!message) {
    return null;
  }

  return (
    <div
      role="status"
      className="flex items-start gap-2.5 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-amber-800"
    >
      <Monitor className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight">{message.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-amber-700">{message.detail}</p>
      </div>
    </div>
  );
}
