"use client";

import { useState } from "react";
import { Save, Trash2 } from "lucide-react";

import type {
  ArrivalPattern,
  ConfigTemplate,
  DispatchPolicy,
  SimulationConfig,
} from "@/types/simulation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ConfigPanelProps {
  config: SimulationConfig;
  templates: ConfigTemplate[];
  onChange: <K extends keyof SimulationConfig>(
    key: K,
    value: SimulationConfig[K],
  ) => void;
  onApply: () => void;
  onRestoreDefaults: () => void;
  onSaveTemplate: (name: string) => void;
  onLoadTemplate: (template: ConfigTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
}

interface NumberFieldProps {
  id: keyof SimulationConfig;
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function NumberField({ id, label, value, onChange }: NumberFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: DispatchPolicy;
  onChange: (value: DispatchPolicy) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <select
        className="flex h-9 w-full rounded-md border border-[color:var(--border)] bg-white px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
        value={value}
        onChange={(event) => onChange(event.target.value as DispatchPolicy)}
      >
        <option value="round_robin">round_robin</option>
        <option value="shortest_queue">shortest_queue</option>
        <option value="least_loaded">least_loaded</option>
      </select>
    </div>
  );
}

function ArrivalSelectField({
  value,
  onChange,
}: {
  value: ArrivalPattern;
  onChange: (value: ArrivalPattern) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>arrival_pattern</Label>
      <select
        className="flex h-9 w-full rounded-md border border-[color:var(--border)] bg-white px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
        value={value}
        onChange={(event) => onChange(event.target.value as ArrivalPattern)}
      >
        <option value="uniform_interval">uniform_interval</option>
        <option value="burst_per_sec">burst_per_sec</option>
      </select>
    </div>
  );
}

export function ConfigPanel({
  config,
  templates,
  onChange,
  onApply,
  onRestoreDefaults,
  onSaveTemplate,
  onLoadTemplate,
  onDeleteTemplate,
}: ConfigPanelProps) {
  const [templateName, setTemplateName] = useState("");

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Config</CardTitle>
        <CardDescription>
          All core parameters are editable. Apply rebuilds the simulation. Save
          template stores the current draft locally in the browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
            Templates
          </h4>
          <div className="flex gap-2">
            <Input
              placeholder="template name"
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
            />
            <Button
              disabled={templateName.trim().length === 0}
              onClick={() => {
                onSaveTemplate(templateName);
                setTemplateName("");
              }}
            >
              <Save className="h-4 w-4" />
              Save
            </Button>
          </div>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-[color:var(--border)] p-2">
            {templates.length === 0 ? (
              <p className="px-2 py-3 text-sm text-[color:var(--muted-foreground)]">
                No saved templates yet.
              </p>
            ) : (
              templates.map((template) => (
                <div
                  key={template.id}
                  className="rounded-lg border border-[color:var(--border)] bg-[color:var(--secondary)]/35 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{template.name}</p>
                      <p className="mt-1 font-mono text-[11px] text-[color:var(--muted-foreground)]">
                        updated {new Date(template.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onDeleteTemplate(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => onLoadTemplate(template)}
                    >
                      Load
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
            Workload
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              id="reqPerSec"
              label="req_per_sec"
              value={config.reqPerSec}
              onChange={(value) => onChange("reqPerSec", value)}
            />
            <ArrivalSelectField
              value={config.arrivalPattern}
              onChange={(value) => onChange("arrivalPattern", value)}
            />
            <NumberField
              id="maxRequestCount"
              label="max_request_count"
              value={config.maxRequestCount}
              onChange={(value) => onChange("maxRequestCount", value)}
            />
            <NumberField
              id="simulationDurationSec"
              label="simulation_duration_sec"
              value={config.simulationDurationSec}
              onChange={(value) => onChange("simulationDurationSec", value)}
            />
            <NumberField
              id="inputTokensPerRequest"
              label="input_tokens_per_request"
              value={config.inputTokensPerRequest}
              onChange={(value) => onChange("inputTokensPerRequest", value)}
            />
            <NumberField
              id="outputTokensPerRequest"
              label="output_tokens_per_request"
              value={config.outputTokensPerRequest}
              onChange={(value) => onChange("outputTokensPerRequest", value)}
            />
            <NumberField
              id="randomSeed"
              label="random_seed"
              value={config.randomSeed}
              onChange={(value) => onChange("randomSeed", value)}
            />
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
            Topology
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              id="prefillNodeCount"
              label="prefill_node_count"
              value={config.prefillNodeCount}
              onChange={(value) => onChange("prefillNodeCount", value)}
            />
            <NumberField
              id="decodeNodeCount"
              label="decode_node_count"
              value={config.decodeNodeCount}
              onChange={(value) => onChange("decodeNodeCount", value)}
            />
            <NumberField
              id="prefillBatchSize"
              label="prefill_batch_size"
              value={config.prefillBatchSize}
              onChange={(value) => onChange("prefillBatchSize", value)}
            />
            <NumberField
              id="decodeBatchSize"
              label="decode_batch_size"
              value={config.decodeBatchSize}
              onChange={(value) => onChange("decodeBatchSize", value)}
            />
            <SelectField
              label="coordinator_dispatch_policy"
              value={config.coordinatorDispatchPolicy}
              onChange={(value) => onChange("coordinatorDispatchPolicy", value)}
            />
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
            Service Time
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              id="prefillTimePerRequestMs"
              label="prefill_time_intercept_ms"
              value={config.prefillTimePerRequestMs}
              onChange={(value) => onChange("prefillTimePerRequestMs", value)}
            />
            <NumberField
              id="prefillTimeSlopeMs"
              label="prefill_time_slope_ms"
              value={config.prefillTimeSlopeMs}
              onChange={(value) => onChange("prefillTimeSlopeMs", value)}
            />
            <NumberField
              id="decodeStepTimeMs"
              label="decode_step_intercept_ms"
              value={config.decodeStepTimeMs}
              onChange={(value) => onChange("decodeStepTimeMs", value)}
            />
            <NumberField
              id="decodeStepTimeSlopeMs"
              label="decode_step_slope_ms"
              value={config.decodeStepTimeSlopeMs}
              onChange={(value) => onChange("decodeStepTimeSlopeMs", value)}
            />
            <NumberField
              id="decodeTokensPerStep"
              label="decode_tokens_per_step"
              value={config.decodeTokensPerStep}
              onChange={(value) => onChange("decodeTokensPerStep", value)}
            />
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
            Network
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              id="networkLatencyClientToCoordinatorMs"
              label="network_latency_client_to_coordinator_ms"
              value={config.networkLatencyClientToCoordinatorMs}
              onChange={(value) =>
                onChange("networkLatencyClientToCoordinatorMs", value)
              }
            />
            <NumberField
              id="networkLatencyCoordinatorToPrefillMs"
              label="network_latency_coordinator_to_prefill_ms"
              value={config.networkLatencyCoordinatorToPrefillMs}
              onChange={(value) =>
                onChange("networkLatencyCoordinatorToPrefillMs", value)
              }
            />
            <NumberField
              id="networkLatencyPrefillToDecodeMs"
              label="network_latency_prefill_to_decode_ms"
              value={config.networkLatencyPrefillToDecodeMs}
              onChange={(value) => onChange("networkLatencyPrefillToDecodeMs", value)}
            />
            <NumberField
              id="networkLatencyDecodeToClientMs"
              label="network_latency_decode_to_client_ms"
              value={config.networkLatencyDecodeToClientMs}
              onChange={(value) => onChange("networkLatencyDecodeToClientMs", value)}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button className="flex-1" onClick={onApply}>
            Apply & Reset
          </Button>
          <Button variant="outline" className="flex-1" onClick={onRestoreDefaults}>
            Defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
