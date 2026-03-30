# PD Visualize

A Next.js + React + TypeScript dashboard for simulating separated Prefill / Decode deployment with a discrete-event engine.

## Features

- Independent simulation engine under `src/sim/`
- Virtual time advanced by discrete events only
- `Start / Pause / Reset / Step / Speed`
- Fixed random seed for reproducible runs
- Configurable request rate, client concurrency, request cap, topology, batching, service time, and network latency
- Configurable arrival pattern and linear batch-time models
- Streaming token visualization
- Request lifecycle drill-down with TTFT / TPOT / E2E timestamps
- AISBench-style workload semantics for `request_rate`, `batch_size`, and `max_out_len`
- AISBench-style performance tables for request-level metrics and common metrics
- Realtime and final-summary chart modes
- Metrics JSON export

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`

Production:

```bash
npm run build
npm start
```

## Default scenario

The default config lives in [src/sim/default-config.ts](/d:/project/pd_visualize/src/sim/default-config.ts).

- `reqPerSec = 0.3`
- `arrivalPattern = aisbench_request_rate`
- `clientBatchSize = 16`
- `maxRequestCount = 16`
- `inputTokensPerRequest = 64000`
- `outputTokensPerRequest = 1000`
- `simulationDurationSec = 120`
- `prefillNodeCount = 2`
- `decodeNodeCount = 1`
- `prefillBatchSize = 1`
- `decodeBatchSize = 32`
- `prefillTimePerRequestMs = 8220`
- `prefillTimeSlopeMs = 0`
- `decodeStepTimeMs = 36.5`
- `decodeStepTimeSlopeMs = 0`
- `decodeTokensPerStep = 1`

This default setup intentionally makes queueing, batch behavior, and streaming easy to observe.

## Project structure

```text
src/
  app/
  components/
  lib/
  sim/
  types/
```

Key files:

- [src/sim/engine.ts](/d:/project/pd_visualize/src/sim/engine.ts): discrete-event engine
- [src/sim/controller.ts](/d:/project/pd_visualize/src/sim/controller.ts): browser playback wrapper
- [src/components/simulation-dashboard.tsx](/d:/project/pd_visualize/src/components/simulation-dashboard.tsx): main page
- [src/components/timeline-panel.tsx](/d:/project/pd_visualize/src/components/timeline-panel.tsx): flow animation + paginated lifecycle list
- [src/components/metrics-panel.tsx](/d:/project/pd_visualize/src/components/metrics-panel.tsx): charts and aggregate metrics

## Configurable parameters

The right-side config panel currently supports:

- `request_rate`
- `batch_size`
- `max_request_count`
- `arrival_pattern`
- `input_tokens_per_request`
- `max_out_len`
- `simulation_duration_sec`
- `prefill_node_count`
- `decode_node_count`
- `prefill_batch_size`
- `decode_batch_size`
- `coordinator_dispatch_policy`
- `prefill_time_per_request_ms`
- `prefill_time_slope_ms`
- `decode_step_time_ms`
- `decode_step_time_slope_ms`
- `decode_tokens_per_step`
- `network_latency_client_to_coordinator_ms`
- `network_latency_coordinator_to_prefill_ms`
- `network_latency_prefill_to_decode_ms`
- `network_latency_decode_to_client_ms`
- `random_seed`

## Metrics

Request-level performance parameters:

- `TTFT = first_token_time - arrival_time`
- `TPOT = (last_token_time - first_token_time) / (output_tokens - 1)`
- `E2EL = finish_time - arrival_time`
- `OutputTokenThroughput = 1000 / TPOT`

Common metrics:

- `Benchmark Duration = max(finish_time, current_time) - min(arrival_time)`
- `Request Throughput = completed_requests / benchmark_duration`
- `Prefill Token Throughput = sum(input_tokens for requests with TTFT) / sum(TTFT)`
- `Input Token Throughput = total_input_tokens / benchmark_duration`
- `Output Token Throughput = total_output_tokens / benchmark_duration`
- `Total Token Throughput = (total_input_tokens + total_output_tokens) / benchmark_duration`
- `Concurrency = sum(E2EL of completed requests) / benchmark_duration`
- `avg / p50 / p90 / p99 / max` for `TTFT / TPOT / E2EL / OutputTokenThroughput`

Tracked lifecycle timestamps are stored on each request record in [src/types/simulation.ts](/d:/project/pd_visualize/src/types/simulation.ts):

- `arrivalTimeMs`
- `prefillStartTimeMs`
- `prefillEndTimeMs`
- `decodeStartTimeMs`
- `firstTokenTimeMs`
- `lastTokenTimeMs`
- `finishTimeMs`

## Realtime vs final mode

- `Realtime Mode`: plots cumulative realtime series against current virtual time
- `Final Mode`: plots per-second bucketed throughput and queue summaries

## AISBench compatibility

This dashboard now includes an `aisbench_request_rate` workload mode inspired by:

- `ais_bench/benchmark/configs/models/vllm_api/vllm_api_stream_chat.py`
- `ais_bench/benchmark/tasks/openicl_api_infer.py`
- `ais_bench/benchmark/openicl/icl_inferencer/icl_base_api_inferencer.py`
- `ais_bench/benchmark/calculators/base_perf_metric_calculator.py`

Implemented mappings:

- `request_rate`
  - if `request_rate < 0.1`, the client does not rate-limit request release
  - otherwise the client releases one request every `1 / request_rate` seconds
- `batch_size`
  - interpreted as client-side max in-flight request concurrency
  - this is separate from server-side `prefill_batch_size` and `decode_batch_size`
- `max_out_len`
  - mapped to the per-request output token target in the simulator
  - internally this is still stored as `outputTokensPerRequest`

## Model assumptions

This version uses a deliberately simple but extensible model:

- request generation stops when either `simulationDurationSec` or `maxRequestCount` is reached
- `arrival_pattern = aisbench_request_rate` mirrors AISBench request release and client concurrency behavior
- `arrival_pattern = uniform_interval` sends one request every `1 / reqPerSec` seconds
- `arrival_pattern = burst_per_sec` sends the per-second quota together at each whole-second boundary
- all arrival modes are additionally constrained by client `batch_size`
- Prefill nodes process up to `prefillBatchSize` queued requests together per batch
- Decode nodes keep an active batch up to `decodeBatchSize`, and each decode step advances every request in that batch once
- Prefill batch duration uses `prefill_time = prefillTimeSlopeMs * active_batch + prefillTimePerRequestMs`
- Decode step duration uses `decode_time = decodeStepTimeSlopeMs * active_batch + decodeStepTimeMs`
- decode streaming returns `decodeTokensPerStep` tokens per request per step
- service time and network latency are deterministic
- `coordinator_dispatch_policy` is reused for both prefill and decode node selection
- simulation stops at the configured time horizon; events beyond that horizon are not executed
- common metrics follow AISBench naming where practical, but are computed from the simulator's current snapshot when the run is still in progress

## Extending the model

Common extension points:

- add new node kinds in [src/types/simulation.ts](/d:/project/pd_visualize/src/types/simulation.ts)
- add new event types and scheduling logic in [src/sim/engine.ts](/d:/project/pd_visualize/src/sim/engine.ts)
- add new dispatch policies in `selectNode`
- add richer batching, preemption, admission control, or heterogeneous node timings

## Export

The top control bar exports `pd-simulation-metrics.json` containing:

- current config
- current virtual time
- aggregate metrics
- full request details
