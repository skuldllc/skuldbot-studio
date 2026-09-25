// Copyright (c) 2026 Skuld, LLC. All rights reserved.
// Proprietary and confidential. Reverse engineering prohibited.

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { Edge, Node } from "reactflow";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FlowNodeData } from "../../types/flow";
import type { BotInfo } from "../../lib/dsl";
import {
  verifyStudioPublish,
  publishStudioBot,
} from "../../lib/studioPublishClient";
import { useToastStore } from "../../store/toastStore";
import { PublishGatePanel } from "./PublishGatePanel";
import type { StudioPublishGateReadModel } from "../../types/publish-gate";

interface PublishDialogProps {
  isOpen: boolean;
  onClose: () => void;
  bot: BotInfo;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
}

export function PublishDialog({
  isOpen,
  onClose,
  bot,
  nodes,
  edges,
}: PublishDialogProps) {
  const toast = useToastStore();
  const [isVerifying, setIsVerifying] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [model, setModel] = useState<StudioPublishGateReadModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runVerify = async () => {
    setIsVerifying(true);
    setError(null);
    try {
      const result = await verifyStudioPublish(bot, nodes, edges);
      setModel(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setModel(null);
      setError(null);
      runVerify();
    } else {
      onClose();
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const result = await publishStudioBot(bot, nodes, edges);
      setModel(result.gate);
      toast.success(
        result.idempotent ? "Already published" : "Published",
        `Version ${result.version}`,
      );
    } catch (err) {
      toast.error("Publish failed", String(err));
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publish {bot.name}</DialogTitle>
        </DialogHeader>

        {isVerifying && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking publish preconditions...
          </div>
        )}

        {error && !isVerifying && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {model && !isVerifying && (
          <div className="space-y-4">
            <PublishGatePanel model={model} />
            <Button
              className="w-full"
              disabled={!model.canPublish || isPublishing}
              onClick={handlePublish}
            >
              {isPublishing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Publishing...
                </>
              ) : (
                "Publish to Orchestrator"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
