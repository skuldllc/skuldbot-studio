// Copyright (c) 2026 Skuld, LLC. All rights reserved.
// Proprietary and confidential. Reverse engineering prohibited.

import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import type { PublishVerificationCheck } from "@/types/publish-gate";

/**
 * Block 8 — read-only checklist of publish verification checks.
 *
 * Renders the server's `verification.checks[]` (lookup-backed `checkLabel`,
 * server-owned `passed`). Presentation-only: computes no verdict. The only local
 * mapping is pass/fail → icon + badge tone (presentation, not a label).
 */

function CheckRow({ check }: { check: PublishVerificationCheck }) {
  const passed = check.passed;

  return (
    <li className="flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2.5">
      <Icon
        name={passed ? "CheckCircle2" : "XCircle"}
        size={18}
        className={cn(
          "mt-0.5 shrink-0",
          passed ? "text-emerald-500" : "text-destructive",
        )}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {check.checkLabel}
          </span>
          <Badge
            variant={passed ? "secondary" : "destructive"}
            className="text-[10px]"
          >
            {passed ? "Passed" : "Blocked"}
          </Badge>
        </div>
        {check.blockedReason && (
          <p className="text-xs text-destructive">
            {check.blockedReason.reasonLabel}
            {check.blockedReason.detail ? ` — ${check.blockedReason.detail}` : ""}
          </p>
        )}
      </div>
    </li>
  );
}

export function PublishGateChecklist({
  checks,
}: {
  checks: PublishVerificationCheck[];
}) {
  if (checks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No verification checks have been evaluated yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {checks.map((check) => (
        <CheckRow key={check.checkCode} check={check} />
      ))}
    </ul>
  );
}
