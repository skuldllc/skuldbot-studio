// Copyright (c) 2026 Skuld, LLC. All rights reserved.
// Proprietary and confidential. Reverse engineering prohibited.

/**
 * AI Planner Panel
 * Main sliding panel for the AI-powered RPA planning assistant
 */

import { useEffect, useCallback } from "react";
import { X, Bot, Sparkles, Settings, Play, Loader2 } from "lucide-react";
import { Button } from "../ui/Button";
import { useAIPlannerStore } from "../../store/aiPlannerStore";
import { useCanUseAIPlanner } from "../../store/sessionStore";
import { PlannerInput } from "./PlannerInput";
import { PlanStepList } from "./PlanStepList";
import { RefinementInput } from "./RefinementInput";
import { LLMConfigDialog } from "./LLMConfigDialog";
import { useState } from "react";

export function AIPlannerPanel() {
  const {
    isPanelOpen,
    closePanel,
    currentPhase,
    planSteps,
    isGenerating,
    generatePlan,
    reset,
    applyToCanvas,
  } = useAIPlannerStore();

  const canUseAI = useCanUseAIPlanner();
  const [showLLMConfig, setShowLLMConfig] = useState(false);

  // Handle apply to canvas
  const handleApplyToCanvas = useCallback(() => {
    applyToCanvas();
  }, [applyToCanvas]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close
      if (e.key === "Escape" && isPanelOpen) {
        closePanel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPanelOpen, closePanel]);

  if (!isPanelOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={closePanel}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[500px] bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">AI Planner</h2>
              <p className="text-xs text-slate-500">
                {currentPhase === "input" && "Describe your automation"}
                {currentPhase === "plan" && `${planSteps.length} steps generated`}
                {currentPhase === "refining" && "Refining plan..."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLLMConfig(true)}
              title="LLM Settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={closePanel}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* SkuldAI Module Check */}
          {!canUseAI && (
            <div className="mb-6 p-4 bg-primary-50 border border-primary-200 rounded-xl">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary-500 mt-0.5" />
                <div>
                  <h3 className="font-medium text-primary-800 mb-2">
                    SkuldAI module required
                  </h3>
                  <p className="text-sm text-primary-700">
                    AI Planner helps you design automations using natural language.
                    It's part of the SkuldAI module — contact your admin or{" "}
                    <a
                      href="https://skuldbot.com/pricing"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      skuldbot.com/pricing
                    </a>{" "}
                    to add it to your Studio seat.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          {canUseAI && (
            <>
              {/* Input Phase */}
              {currentPhase === "input" && (
                <PlannerInput />
              )}

              {/* Plan Phase */}
              {(currentPhase === "plan" || currentPhase === "refining") && (
                <>
                  <PlanStepList />

                  {/* Refinement Section */}
                  <div className="mt-6 pt-6 border-t border-slate-200">
                    <RefinementInput />
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
          {currentPhase === "input" ? (
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={reset}
                className="flex-1"
              >
                Clear
              </Button>
              <Button
                variant="default"
                onClick={generatePlan}
                disabled={isGenerating}
                className="flex-1"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Plan
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={reset}
                className="flex-1"
              >
                Start Over
              </Button>
              <Button
                variant="default"
                onClick={handleApplyToCanvas}
                disabled={planSteps.length === 0}
                className="flex-1"
              >
                <Play className="w-4 h-4 mr-2" />
                Apply to Canvas
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* LLM Config Dialog */}
      <LLMConfigDialog
        isOpen={showLLMConfig}
        onClose={() => setShowLLMConfig(false)}
      />
    </>
  );
}

export default AIPlannerPanel;
