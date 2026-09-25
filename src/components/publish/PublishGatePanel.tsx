// Copyright (c) 2026 Skuld, LLC. All rights reserved.
// Proprietary and confidential. Reverse engineering prohibited.

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PublishGateChecklist } from "./PublishGateChecklist";
import {
  PublishVerificationDecision,
  publishActionGateReason,
  type StudioPublishBlockedReason,
  type StudioPublishGateAction,
  type StudioPublishGateReadModel,
} from "@/types/publish-gate";

/**
 * Block 8 — Studio Publish Gate panel.
 *
 * Renders the server-owned `StudioPublishGateReadModel`: verification checklist,
 * blocked reasons and the publish/runner actions. Read-only-first — every action
 * is DISABLED with its server-derived reason, because no signed publish endpoint
 * (`POST /studio/publish`) is wired yet. Publishability is server-owned
 * (`canPublish` + `surfaceContractSigned` + per-action `enabled`); this surface
 * computes no verdict and fabricates no data. Props-driven: the model is supplied
 * by the caller once the orchestrator connection + verify client exist.
 */

function RefLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-xs text-foreground break-all">
        {value}
      </span>
    </div>
  );
}

function BlockedReasonRow({ reason }: { reason: StudioPublishBlockedReason }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <Icon name="AlertTriangle" size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <span className="font-medium">{reason.reasonLabel}</span>
        {reason.detail && <span> — {reason.detail}</span>}
        {!reason.blocksPublish && (
          <Badge variant="outline" className="ml-2 text-[10px]">
            Non-blocking
          </Badge>
        )}
      </div>
    </div>
  );
}

function ActionRow({
  model,
  action,
}: {
  model: StudioPublishGateReadModel;
  action: StudioPublishGateAction;
}) {
  const reason = publishActionGateReason(model, action);

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">
          {action.actionLabel}
        </span>
        {/* Read-only-first: always disabled until a signed publish endpoint exists. */}
        <Button variant="outline" size="sm" disabled>
          <Icon name="Lock" size={12} className="mr-1" />
          Unavailable
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-[10px]">
          {reason ?? "Awaiting signed publish endpoint"}
        </Badge>
        {action.requiredPermissions.map((perm) => (
          <Badge key={perm} variant="outline" className="text-[10px]">
            {perm}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function PublishGatePanel({
  model,
}: {
  model: StudioPublishGateReadModel;
}) {
  const verification = model.verification;
  const verified =
    verification?.decision === PublishVerificationDecision.VERIFIED;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Icon name="ShieldCheck" size={18} />
              Publish gate
            </CardTitle>
            <CardDescription>
              Verify publish preconditions before publishing to an Orchestrator.
            </CardDescription>
          </div>
          <Badge variant={model.canPublish ? "secondary" : "destructive"}>
            {model.canPublish ? "Ready to publish" : "Blocked"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {(model.subjectId || model.packageId || model.planHash) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {model.subjectId && (
              <RefLine label="Subject" value={model.subjectId} />
            )}
            {model.packageId && (
              <RefLine label="Package" value={model.packageId} />
            )}
            {model.planHash && (
              <RefLine label="Plan hash" value={model.planHash} />
            )}
          </div>
        )}

        {!model.surfaceContractSigned && (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
            <Icon name="Lock" size={16} className="shrink-0" />
            Publish surface contract not signed — actions remain disabled.
          </div>
        )}

        {model.blockedReasons.length > 0 && (
          <div className="space-y-2">
            {model.blockedReasons.map((reason) => (
              <BlockedReasonRow key={reason.reasonCode} reason={reason} />
            ))}
          </div>
        )}

        {verification && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Verification
              </span>
              <Badge variant={verified ? "secondary" : "destructive"}>
                {verified ? "Verified" : "Blocked"}
              </Badge>
            </div>
            <PublishGateChecklist checks={verification.checks} />
          </div>
        )}

        {model.availableActions.length > 0 && (
          <div className="space-y-2 border-t border-border pt-3">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Actions (read-only — publish endpoint not signed)
            </span>
            {model.availableActions.map((action) => (
              <ActionRow key={action.actionCode} model={model} action={action} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
