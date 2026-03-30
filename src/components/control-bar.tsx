"use client";

import { Download, Pause, Play, RotateCcw, StepForward } from "lucide-react";

import { formatSeconds } from "@/lib/format";
import {
  type UiLocale,
  UI_LOCALE_OPTIONS,
  translatePlaybackState,
} from "@/lib/i18n";
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
  locale: UiLocale;
  onLocaleChange: (locale: UiLocale) => void;
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
  locale,
  onLocaleChange,
}: ControlBarProps) {
  const isRunning = snapshot.playbackState === "running";
  const zh = locale === "zh-CN";
  const startLabel = snapshot.hasStarted
    ? zh
      ? "继续"
      : "Resume"
    : zh
      ? "开始"
      : "Start";

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={isRunning ? onPause : onStart}>
            {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isRunning ? (zh ? "暂停" : "Pause") : startLabel}
          </Button>
          <Button variant="outline" onClick={onStep}>
            <StepForward className="h-4 w-4" />
            {zh ? "单步" : "Step"}
          </Button>
          <Button variant="outline" onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
            {zh ? "重置" : "Reset"}
          </Button>
          <Button variant="secondary" onClick={onExport}>
            <Download className="h-4 w-4" />
            {zh ? "导出指标" : "Export Metrics"}
          </Button>
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={stateVariant(snapshot.playbackState)}>
              {translatePlaybackState(snapshot.playbackState, locale)}
            </Badge>
            <span className="font-mono text-sm text-[color:var(--muted-foreground)]">
              {zh ? "虚拟时间" : "virtual time"}{" "}
              {formatSeconds(snapshot.currentTimeMs)}
            </span>
            <span className="font-mono text-sm text-[color:var(--muted-foreground)]">
              / {formatSeconds(snapshot.durationMs)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[color:var(--muted-foreground)]">
              {zh ? "播放速度" : "Playback"}
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
            <select
              className="flex h-9 rounded-md border border-[color:var(--border)] bg-white px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
              value={locale}
              onChange={(event) => onLocaleChange(event.target.value as UiLocale)}
              aria-label={zh ? "语言" : "Language"}
            >
              {UI_LOCALE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
