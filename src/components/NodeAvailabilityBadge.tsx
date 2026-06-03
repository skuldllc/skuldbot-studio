// Copyright (c) 2026 Skuld, LLC. All rights reserved.
// Proprietary and confidential. Reverse engineering prohibited.

import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import {
  getNodeAvailability,
  getAvailabilityPresentation,
  type NodeAvailabilityStatus,
} from "@/lib/nodeAvailability";

// Semantic colour per status. Colour reinforces the label; it never carries the
// meaning alone (the text always names the state), so the badge stays legible for
// colour-blind users and in high-contrast modes.
const STATUS_CLASS: Record<NodeAvailabilityStatus, string> = {
  executable: "border-emerald-200 bg-emerald-50 text-emerald-700",
  runtime_blocked: "border-amber-200 bg-amber-50 text-amber-700",
  not_implemented: "border-rose-200 bg-rose-50 text-rose-700",
  unknown: "border-rose-200 bg-rose-50 text-rose-700",
};

interface NodeAvailabilityBadgeProps {
  nodeType: string;
  /** Hide the "Executable" badge to keep runnable nodes visually quiet. */
  hideWhenExecutable?: boolean;
  className?: string;
}

/**
 * Compact, human-readable availability badge for a node type. Reads the generated
 * manifest via the shared availability module — never a hardcoded status.
 */
export function NodeAvailabilityBadge({
  nodeType,
  hideWhenExecutable = false,
  className,
}: NodeAvailabilityBadgeProps) {
  const availability = getNodeAvailability(nodeType);
  const presentation = getAvailabilityPresentation(availability);

  if (hideWhenExecutable && availability.status === "executable") {
    return null;
  }

  return (
    <Badge
      variant="outline"
      title={presentation.tooltip}
      className={cn(
        "px-1.5 py-0 text-[10px] font-medium leading-4",
        STATUS_CLASS[availability.status],
        className,
      )}
    >
      {presentation.label}
    </Badge>
  );
}
