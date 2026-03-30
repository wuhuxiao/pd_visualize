"use client";

import { SimulationEngine } from "@/sim/engine";
import { DEFAULT_SIMULATION_CONFIG } from "@/sim/default-config";
import type {
  ControllerSnapshot,
  PlaybackState,
  SimulationConfig,
} from "@/types/simulation";

type Listener = (snapshot: ControllerSnapshot) => void;

/**
 * Playback controller that paces the pure engine for the browser UI.
 * Real time is only used to decide how often to call `runUntil`; the
 * engine itself always advances using virtual timestamps from events.
 */
export class SimulationController {
  private engine = new SimulationEngine(DEFAULT_SIMULATION_CONFIG);
  private listeners = new Set<Listener>();
  private playbackState: PlaybackState = "idle";
  private speed = 1;
  private tickHandle?: number;
  private lastTickAt?: number;

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.getSnapshot());

    return () => {
      this.listeners.delete(listener);
    };
  }

  setSpeed(speed: number) {
    this.speed = speed;
    this.emit();
  }

  start() {
    if (this.playbackState === "running") {
      return;
    }

    if (this.engine.getSnapshot().hasFinished) {
      this.reset(this.engine.getConfig());
    }

    this.playbackState = "running";
    this.lastTickAt = performance.now();
    this.tickHandle = window.setInterval(() => this.tick(), 48);
    this.emit();
  }

  pause() {
    if (this.tickHandle !== undefined) {
      window.clearInterval(this.tickHandle);
      this.tickHandle = undefined;
    }

    this.playbackState = this.engine.getSnapshot().hasFinished
      ? "finished"
      : "paused";
    this.lastTickAt = undefined;
    this.emit();
  }

  reset(config?: SimulationConfig) {
    if (this.tickHandle !== undefined) {
      window.clearInterval(this.tickHandle);
      this.tickHandle = undefined;
    }

    this.engine.reset(config ?? this.engine.getConfig());
    this.playbackState = "idle";
    this.lastTickAt = undefined;
    this.emit();
  }

  step() {
    if (this.playbackState === "running") {
      this.pause();
    }

    this.engine.step();
    this.playbackState = this.engine.getSnapshot().hasFinished
      ? "finished"
      : "paused";
    this.emit();
  }

  getSnapshot(): ControllerSnapshot {
    return {
      ...this.engine.getSnapshot(),
      playbackState: this.playbackState,
      speed: this.speed,
    };
  }

  private tick() {
    const now = performance.now();
    const previousTickAt = this.lastTickAt ?? now;
    this.lastTickAt = now;
    const deltaMs = now - previousTickAt;
    const targetVirtualTime = this.engine.getCurrentTimeMs() + deltaMs * this.speed;
    this.engine.runUntil(targetVirtualTime);

    if (this.engine.getSnapshot().hasFinished) {
      this.pause();
      return;
    }

    this.emit();
  }

  private emit() {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
