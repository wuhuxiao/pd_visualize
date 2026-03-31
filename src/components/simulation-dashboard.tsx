"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { ConfigPanel } from "@/components/config-panel";
import { ControlBar } from "@/components/control-bar";
import { MetricsPanel } from "@/components/metrics-panel";
import { RequestDetailDialog } from "@/components/request-detail-dialog";
import { TimelinePanel } from "@/components/timeline-panel";
import { TopologyPanel } from "@/components/topology-panel";
import {
  deleteConfigTemplate,
  readConfigTemplates,
  saveConfigTemplate,
  subscribeConfigTemplates,
} from "@/lib/config-templates";
import { type UiLocale } from "@/lib/i18n";
import { DEFAULT_SIMULATION_CONFIG, normalizeConfig } from "@/sim/default-config";
import { SimulationController } from "@/sim/controller";
import type { ConfigTemplate, ControllerSnapshot, SimulationConfig } from "@/types/simulation";

const EMPTY_TEMPLATES: ConfigTemplate[] = [];
const getServerTemplatesSnapshot = () => EMPTY_TEMPLATES;
const LOCALE_STORAGE_KEY = "pd-visualize-locale";

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SimulationDashboard() {
  const controller = useMemo(() => new SimulationController(), []);
  const templates = useSyncExternalStore(
    subscribeConfigTemplates,
    readConfigTemplates,
    getServerTemplatesSnapshot,
  );
  const [snapshot, setSnapshot] = useState<ControllerSnapshot>(() =>
    controller.getSnapshot(),
  );
  const [draftConfig, setDraftConfig] = useState<SimulationConfig>(
    DEFAULT_SIMULATION_CONFIG,
  );
  const [chartMode, setChartMode] = useState<"realtime" | "final">("realtime");
  const [selectedRequestId, setSelectedRequestId] = useState<string>();
  const [locale, setLocale] = useState<UiLocale>(() => {
    if (typeof window === "undefined") {
      return "en";
    }

    const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return savedLocale === "zh-CN" || savedLocale === "en" ? savedLocale : "en";
  });

  useEffect(() => controller.subscribe(setSnapshot), [controller]);
  useEffect(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  const selectedRequest = snapshot.requests.find(
    (request) => request.id === selectedRequestId,
  );
  const zh = locale === "zh-CN";

  const handleConfigChange = <K extends keyof SimulationConfig>(
    key: K,
    value: SimulationConfig[K],
  ) => {
    setDraftConfig((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSaveTemplate = (name: string) => {
    const normalizedDraft = normalizeConfig(draftConfig);
    saveConfigTemplate(name, normalizedDraft);
    setDraftConfig(normalizedDraft);
  };

  const handleLoadTemplate = (template: ConfigTemplate) => {
    setDraftConfig(template.config);
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1680px] flex-col gap-4 px-4 py-6 lg:px-6">
      <header className="rounded-2xl border border-[color:var(--border)] bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(14,116,144,0.92))] p-6 text-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-sky-200">
          {zh ? "PD 分离仿真" : "PD Separation Simulation"}
        </p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-tight">
              {zh
                ? "面向 LLM Prefill/Decode 部署的离散事件仿真控制台"
                : "Discrete-event dashboard for LLM prefill/decode deployment"}
            </h1>
            <p className="mt-2 text-sm text-slate-200">
              {zh
                ? "虚拟时间只会在预定事件发生时推进。UI 只负责渲染仿真引擎快照，因此排队、分发、流式输出、指标、批处理与模板配置都具备可复现性和可追溯性。"
                : "Virtual time advances only through scheduled events. The UI simply renders engine snapshots, so queuing, dispatch, streaming, metrics, batching, and saved templates stay reproducible and traceable."}
            </p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm">
            <p className="text-sky-100">{zh ? "默认拓扑" : "Default topology"}</p>
            <p className="mt-1 font-mono">
              Client -&gt; Coordinator -&gt; P0/P1 -&gt; D0 -&gt; Client
            </p>
          </div>
        </div>
      </header>

      <ControlBar
        snapshot={snapshot}
        onStart={() => controller.start()}
        onPause={() => controller.pause()}
        onStep={() => controller.step()}
        onReset={() => {
          controller.reset(snapshot.config);
          setDraftConfig(snapshot.config);
          setSelectedRequestId(undefined);
        }}
        onSpeedChange={(speed) => controller.setSpeed(speed)}
        locale={locale}
        onLocaleChange={setLocale}
        onExport={() =>
          downloadJson("pd-simulation-metrics.json", {
            exportedAt: new Date().toISOString(),
            config: snapshot.config,
            currentTimeMs: snapshot.currentTimeMs,
            metrics: snapshot.metrics,
            requests: snapshot.requests,
          })
        }
      />

      <div className="grid flex-1 items-stretch gap-4 xl:min-h-[calc(100vh-16rem)] xl:grid-cols-[320px_minmax(0,1fr)_360px]">
        <TopologyPanel snapshot={snapshot} locale={locale} />
        <TimelinePanel
          snapshot={snapshot}
          locale={locale}
          onSelectRequest={(requestId) => setSelectedRequestId(requestId)}
        />
        <ConfigPanel
          config={draftConfig}
          templates={templates}
          locale={locale}
          onChange={handleConfigChange}
          onApply={() => {
            const appliedConfig = normalizeConfig(draftConfig);
            setDraftConfig(appliedConfig);
            controller.reset(appliedConfig);
            setSelectedRequestId(undefined);
          }}
          onRestoreDefaults={() => {
            setDraftConfig(DEFAULT_SIMULATION_CONFIG);
            controller.reset(DEFAULT_SIMULATION_CONFIG);
            setSelectedRequestId(undefined);
          }}
          onSaveTemplate={handleSaveTemplate}
          onLoadTemplate={handleLoadTemplate}
          onDeleteTemplate={deleteConfigTemplate}
        />
      </div>

      <MetricsPanel
        snapshot={snapshot}
        locale={locale}
        chartMode={chartMode}
        onChartModeChange={setChartMode}
      />

      <RequestDetailDialog
        request={selectedRequest}
        locale={locale}
        open={Boolean(selectedRequest)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRequestId(undefined);
          }
        }}
      />
    </div>
  );
}
