// Copyright (c) 2026 Skuld, LLC. All rights reserved.
// Proprietary and confidential. Reverse engineering prohibited.

/**
 * Block 8 — Studio Publish Gate UX.
 *
 * 1:1 read-only mirror of the orchestrator-api FROZEN contract
 * `StudioPublishGateReadModelDto` and its sub-DTOs
 * (`canonical-architecture-contracts.ts`).
 *
 * Discipline (same as the governed surfaces):
 *  - Every `*Label` (checkLabel, actionLabel, reasonLabel) is SERVER-PROVIDED
 *    and lookup-backed (`studio_publish.*`); rendered verbatim, never inferred.
 *  - Publishability and per-action `enabled` are SERVER-OWNED. Fail-closed: the
 *    publish action stays disabled until `surfaceContractSigned` AND a signed
 *    publish endpoint (`POST /studio/publish`) exist.
 *  - No secret/PHI values — references/hashes only.
 *
 * Read surface obtains the model from `POST /studio/publish/verify`
 * (mutatesState:false, signed). The publish mutation is `POST /studio/publish`
 * (mutatesState:true, perm `bots:publish`) — not wired here.
 */

export const PublishVerificationDecision = {
  VERIFIED: 'verified',
  BLOCKED: 'blocked',
} as const;
export type PublishVerificationDecision =
  (typeof PublishVerificationDecision)[keyof typeof PublishVerificationDecision];

export interface StudioPublishBlockedReason {
  /** Lookup-backed code from `studio_publish.block_reason`. */
  reasonCode: string;
  /** Server-provided, lookup-backed label. Rendered verbatim. */
  reasonLabel: string;
  detail?: string;
  blocksPublish: boolean;
}

export interface StudioPublishGateAction {
  /** Lookup-backed code from `studio_publish.action`. */
  actionCode: string;
  /** Server-provided, lookup-backed label. Rendered verbatim. */
  actionLabel: string;
  /** Server-owned. The UI never computes whether an action is actionable. */
  enabled: boolean;
  blockedReason?: StudioPublishBlockedReason;
  requiredPermissions: string[];
}

export interface PublishVerificationCheck {
  /** Lookup-backed code from `studio_publish.check`. */
  checkCode: string;
  /** Server-provided, lookup-backed label. Rendered verbatim. */
  checkLabel: string;
  passed: boolean;
  blockedReason?: StudioPublishBlockedReason;
}

export interface PublishVerificationResult {
  decision: PublishVerificationDecision;
  packageId: string;
  planHash: string;
  hashMatches: boolean;
  policyCompatible: boolean;
  executionTargetCompatible: boolean;
  runtimePlaneCompatible: boolean;
  compilerExecutorRuntimeMapped: boolean;
  graphicalRuntimeDeclared: boolean;
  runnerSelectionContractSigned: boolean;
  runtimePlaneGatePassed: boolean;
  evidenceRequirementsComplete: boolean;
  blockedReasons: StudioPublishBlockedReason[];
  checks: PublishVerificationCheck[];
  availableActions: StudioPublishGateAction[];
}

export interface StudioPublishGateReadModel {
  /** `CanonicalArchitectureContractVersion` — protocol identifier. */
  contractVersion: string;
  surfaceContractSigned: boolean;
  subjectId?: string;
  packageId?: string;
  planHash?: string;
  canPublish: boolean;
  canSelectRunner: boolean;
  canSelectRunnerPool: boolean;
  canClaimReady: boolean;
  availableActions: StudioPublishGateAction[];
  blockedReasons: StudioPublishBlockedReason[];
  verification?: PublishVerificationResult;
}

/**
 * Read-only-first gating: an action is actionable only when the server marks it
 * `enabled` AND the surface contract is signed. The Block-8 surface still does
 * not invoke the publish mutation (endpoint not signed), so callers keep the
 * control disabled regardless and surface the reason below.
 */
export function publishActionGateReason(
  model: StudioPublishGateReadModel,
  action: StudioPublishGateAction,
): string | null {
  if (!model.surfaceContractSigned) {
    return 'Publish surface contract not signed';
  }
  if (!action.enabled) {
    return action.blockedReason?.reasonLabel ?? 'Action not available';
  }
  return null;
}
