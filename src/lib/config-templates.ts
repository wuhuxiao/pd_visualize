"use client";

import type { ConfigTemplate, SimulationConfig } from "@/types/simulation";

const STORAGE_KEY = "pd-visualize-config-templates";
const CHANGE_EVENT = "pd-visualize-config-templates-change";
const EMPTY_TEMPLATES: ConfigTemplate[] = [];

let cachedRaw: string | null | undefined;
let cachedTemplates: ConfigTemplate[] = EMPTY_TEMPLATES;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readConfigTemplates(): ConfigTemplate[] {
  if (!canUseStorage()) {
    return EMPTY_TEMPLATES;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cachedRaw = null;
      cachedTemplates = EMPTY_TEMPLATES;
      return cachedTemplates;
    }

    if (raw === cachedRaw) {
      return cachedTemplates;
    }

    const parsed = JSON.parse(raw) as ConfigTemplate[];
    cachedRaw = raw;
    cachedTemplates = Array.isArray(parsed) ? parsed : EMPTY_TEMPLATES;
    return cachedTemplates;
  } catch {
    cachedRaw = undefined;
    cachedTemplates = EMPTY_TEMPLATES;
    return cachedTemplates;
  }
}

function writeConfigTemplates(templates: ConfigTemplate[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeConfigTemplates(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = () => callback();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);

  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function saveConfigTemplate(name: string, config: SimulationConfig) {
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error("Template name is required");
  }

  const now = new Date().toISOString();
  const templates = readConfigTemplates();
  const existing = templates.find(
    (template) => template.name.toLowerCase() === normalizedName.toLowerCase(),
  );

  if (existing) {
    const updatedTemplates = templates.map((template) =>
      template.id === existing.id
        ? {
            ...template,
            name: normalizedName,
            updatedAt: now,
            config,
          }
        : template,
    );
    writeConfigTemplates(updatedTemplates);
    return existing.id;
  }

  const newTemplate: ConfigTemplate = {
    id: `tpl-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name: normalizedName,
    createdAt: now,
    updatedAt: now,
    config,
  };
  writeConfigTemplates([newTemplate, ...templates]);
  return newTemplate.id;
}

export function deleteConfigTemplate(id: string) {
  const templates = readConfigTemplates().filter((template) => template.id !== id);
  writeConfigTemplates(templates);
}
