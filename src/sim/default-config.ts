import type { SimulationConfig } from "@/types/simulation";

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  reqPerSec: 0.3,
  arrivalPattern: "aisbench_request_rate",
  clientBatchSize: 16,
  maxRequestCount: 16,
  inputTokensPerRequest: 64000,
  outputTokensPerRequest: 1000,
  simulationDurationSec: 120,
  prefillNodeCount: 2,
  decodeNodeCount: 1,
  prefillBatchSize: 1,
  decodeBatchSize: 32,
  coordinatorDispatchPolicy: "shortest_queue",
  prefillTimePerRequestMs: 8220,
  prefillTimeSlopeMs: 0,
  decodeStepTimeMs: 36.5,
  decodeStepTimeSlopeMs: 0,
  decodeTokensPerStep: 1,
  networkLatencyClientToCoordinatorMs: 25,
  networkLatencyCoordinatorToPrefillMs: 25,
  networkLatencyPrefillToDecodeMs: 25,
  networkLatencyDecodeToClientMs: 0,
  randomSeed: 7,
};

export const PLAYBACK_SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4, 8];

export function normalizeConfig(config: SimulationConfig): SimulationConfig {
  return {
    ...config,
    reqPerSec: Math.max(config.reqPerSec, 0),
    arrivalPattern: config.arrivalPattern,
    clientBatchSize: Math.max(Math.round(config.clientBatchSize), 1),
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
