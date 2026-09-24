// Copyright (c) 2026 Skuld, LLC. All rights reserved.
// Proprietary and confidential. Reverse engineering prohibited.

type TriggerCandidate = {
  data?: {
    category?: string;
  };
};

export const EXPLICIT_TRIGGER_REQUIRED_TITLE = "Select an explicit trigger";
export const EXPLICIT_TRIGGER_REQUIRED_MESSAGE =
  "Choose Manual, Scheduled Run, Form, Webhook, or another trigger before compiling or running.";

export function hasExplicitTrigger(nodes: TriggerCandidate[]): boolean {
  return nodes.some((node) => node.data?.category === "trigger");
}
