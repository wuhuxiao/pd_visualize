import type { SimulationConfig } from "@/types/simulation";

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  reqPerSec: 4,
  arrivalPattern: "uniform_interval",
  maxRequestCount: 56,
  inputTokensPerRequest: 16000,
  outputTokensPerRequest: 1000,
  simulationDurationSec: 18,
  prefillNodeCount: 2,
  decodeNodeCount: 1,
  prefillBatchSize: 2,
  decodeBatchSize: 4,
  coordinatorDispatchPolicy: "shortest_queue",
  prefillTimePerRequestMs: 900,
  prefillTimeSlopeMs: 90,
  decodeStepTimeMs: 60,
  decodeStepTimeSlopeMs: 10,
  decodeTokensPerStep: 20,
  networkLatencyClientToCoordinatorMs: 30,
  networkLatencyCoordinatorToPrefillMs: 25,
  networkLatencyPrefillToDecodeMs: 35,
  networkLatencyDecodeToClientMs: 45,
  randomSeed: 7,
};

export const PLAYBACK_SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4, 8];

export function normalizeConfig(config: SimulationConfig): SimulationConfig {
  return {
    ...config,
    reqPerSec: Math.max(config.reqPerSec, 0.1),
    arrivalPattern: config.arrivalPattern,
    maxRequestCount: Math.max(Math.round(config.maxRequestCount), 1),
    inputTokensPerRequest: Math.max(Math.round(config.inputTokensPerRequest), 1),
    outputTokensPerRequest: Math.max(Math.round(config.outputTokensPerRequest), 1),
    simulationDurationSec: Math.max(config.simulationDurationSec, 1),
    prefillNodeCount: Math.max(Math.round(config.prefillNodeCount), 1),
    decodeNodeCount: Math.max(Math.round(config.decodeNodeCount), 1),
    prefillBatchSize: Math.max(Math.round(config.prefillBatchSize), 1),
    decodeBatchSize: Math.max(Math.round(config.decodeBatchSize), 1),
    prefillTimePerRequestMs: Math.max(config.prefillTimePerRequestMs, 1),
    prefillTimeSlopeMs: Math.max(config.prefillTimeSlopeMs, 0),
    decodeStepTimeMs: Math.max(config.decodeStepTimeMs, 1),
    decodeStepTimeSlopeMs: Math.max(config.decodeStepTimeSlopeMs, 0),
    decodeTokensPerStep: Math.max(Math.round(config.decodeTokensPerStep), 1),
    networkLatencyClientToCoordinatorMs: Math.max(
      config.networkLatencyClientToCoordinatorMs,
      0,
    ),
    networkLatencyCoordinatorToPrefillMs: Math.max(
      config.networkLatencyCoordinatorToPrefillMs,
      0,
    ),
    networkLatencyPrefillToDecodeMs: Math.max(
      config.networkLatencyPrefillToDecodeMs,
      0,
    ),
    networkLatencyDecodeToClientMs: Math.max(
      config.networkLatencyDecodeToClientMs,
      0,
    ),
    randomSeed: Math.max(Math.round(config.randomSeed), 0),
  };
}
