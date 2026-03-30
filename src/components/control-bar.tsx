"use client";

import { Download, Pause, Play, RotateCcw, StepForward } from "lucide-react";

import { formatSeconds } from "@/lib/format";
import { PLAYBACK_SPEED_OPTIONS } from "@/sim/default-config";
import type { ControllerSnapshot } from "@/types/simulation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ControlBarProps {
  snapshot: ControllerSnapshot;
  onStart: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onExport: () => void;
}

function stateVariant(state: ControllerSnapshot["playbackState"]) {
  switch (state) {
    case "running":
      return "success";
    case "finished":
      return "info";
    case "paused":
      return "warning";
    default:
      return "default";
  }
}

export function ControlBar({
  snapshot,
  onStart,
  onPause,
  onStep,
  onReset,
  onSpeedChange,
  onExport,
}: ControlBarProps) {
  const isRunning = snapshot.playbackState === "running";
  const startLabel = snapshot.hasStarted ? "Resume" : "Start";

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={isRunning ? onPause : onStart}>
            {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isRunning ? "Pause" : startLabel}
          </Button>
          <Button variant="outline" onClick={onStep}>
            <StepForward className="h-4 w-4" />
            Step
          </Button>
          <Button variant="outline" onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button variant="secondary" onClick={onExport}>
            <Download className="h-4 w-4" />
            Export Metrics
          </Button>
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={stateVariant(snapshot.playbackState)}>
              {snapshot.playbackState.toUpperCase()}
            </Badge>
            <span className="font-mono text-sm text-[color:var(--muted-foreground)]">
              virtual time {formatSeconds(snapshot.currentTimeMs)}
            </span>
            <span className="font-mono text-sm text-[color:var(--muted-foreground)]">
              / {formatSeconds(snapshot.durationMs)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[color:var(--muted-foreground)]">
              Playback
            </span>
            <div className="flex flex-wrap gap-1">
              {PLAYBACK_SPEED_OPTIONS.map((speed) => (
                <Button
                  key={speed}
                  size="sm"
                  variant={snapshot.speed === speed ? "default" : "outline"}
                  onClick={() => onSpeedChange(speed)}
                >
                  {speed}x
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
