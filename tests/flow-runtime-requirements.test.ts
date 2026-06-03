// Copyright (c) 2026 Skuld, LLC. All rights reserved.
// Proprietary and confidential. Reverse engineering prohibited.

import {
  analyzeFlowRuntimeRequirements,
  getRuntimePreflightMessage,
  GRAPHICAL_DISPLAY_CAPABILITY,
} from "../src/lib/flowRuntimeRequirements";
import { getNodeAvailability } from "../src/lib/nodeAvailability";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const node = (nodeType: string, label?: string) => ({ data: { nodeType, label } });

// Sanity: the node types this test relies on must have the expected manifest status,
// so the test exercises real data rather than assumptions.
assert(
  getNodeAvailability("ai.agent").status === "executable",
  "fixture drift: ai.agent should be executable",
);
assert(
  getNodeAvailability("desktop.screenshot").runtimeBlocked,
  "fixture drift: desktop.screenshot should be runtimeBlocked",
);
assert(
  getNodeAvailability("logging.screenshot").runtimeBlocked,
  "fixture drift: logging.screenshot should be runtimeBlocked (post GR-EX closure)",
);

// 1. A headless flow: only executable nodes → no graphical requirement, no notice.
{
  const req = analyzeFlowRuntimeRequirements([node("ai.agent"), node("control.log")]);
  assert(req.runtimeTarget === "headless", "executable-only flow must be headless");
  assert(req.requiredCapabilities.length === 0, "headless flow needs no capabilities");
  assert(req.graphicalNodes.length === 0, "headless flow has no graphical nodes");
  assert(getRuntimePreflightMessage(req) === null, "headless flow shows no notice");
}

// 2. A graphical flow: any runtime-blocked node forces graphical + the capability code.
{
  const req = analyzeFlowRuntimeRequirements([
    node("ai.agent"),
    node("desktop.screenshot", "Capture screen"),
    node("document.ocr"),
  ]);
  assert(req.runtimeTarget === "graphical", "flow with desktop.* must be graphical");
  assert(
    req.requiredCapabilities.includes(GRAPHICAL_DISPLAY_CAPABILITY),
    "graphical flow must require the graphical_display capability",
  );
  assert(req.graphicalNodes.length === 2, "two distinct graphical nodes expected");
  const msg = getRuntimePreflightMessage(req);
  assert(msg !== null, "graphical flow must show a notice");
  assert(/display/i.test(msg!.detail), "notice must mention a display");
  // No raw reason codes (snake_case) leak into the user-facing notice.
  assert(
    !/[a-z]+_[a-z]+_[a-z]+/.test(msg!.title + " " + msg!.detail),
    `notice leaks a raw reason code: ${msg!.detail}`,
  );
}

// 3. logging.screenshot (closed in GR-EX) now forces a graphical runtime too.
{
  const req = analyzeFlowRuntimeRequirements([node("logging.screenshot")]);
  assert(req.runtimeTarget === "graphical", "logging.screenshot must force graphical runtime");
}

// 4. Distinct node types only: duplicates collapse to one entry.
{
  const req = analyzeFlowRuntimeRequirements([
    node("desktop.screenshot"),
    node("desktop.screenshot"),
  ]);
  assert(req.graphicalNodes.length === 1, "duplicate node types must collapse to one");
}

// 5. Defensive: empty / null / malformed inputs are headless, never throw.
{
  assert(analyzeFlowRuntimeRequirements([]).runtimeTarget === "headless", "empty flow is headless");
  assert(analyzeFlowRuntimeRequirements(null).runtimeTarget === "headless", "null flow is headless");
  assert(
    analyzeFlowRuntimeRequirements([{ data: null }, {}]).runtimeTarget === "headless",
    "malformed nodes are ignored, flow stays headless",
  );
}

console.log("flow-runtime-requirements: all assertions passed.");
