import path from "node:path";
import type {
  AgentActivityEvent,
  AgentActivityKind,
  AgentActivityLog,
  AgentActivitySource,
  AgentActivityStatus,
} from "../schemas/types.js";
import { readSecureJsonFile, writeSecureJsonFile } from "../security/secure-json.js";
import { projectConfigDir } from "../utils/path.js";

const MAX_ACTIVITY_EVENTS = 160;
const SUMMARY_LIMIT = 260;
const TITLE_LIMIT = 90;
const TARGET_LIMIT = 160;

type AgentActivityInput = {
  kind: AgentActivityKind;
  source: AgentActivitySource;
  status?: AgentActivityStatus;
  title: string;
  summary: string;
  toolName?: string;
  requirementId?: string;
  requirementTitle?: string;
  target?: string;
  metadata?: Record<string, unknown>;
};

export function agentActivityPath(repoPath: string): string {
  return path.join(projectConfigDir(repoPath), "agent-activity.json");
}

export async function recordAgentActivity(
  repoPath: string,
  input: AgentActivityInput,
): Promise<AgentActivityEvent> {
  const current = await readAgentActivityFile(repoPath);
  const event: AgentActivityEvent = {
    id: createActivityId(input.kind),
    repoPath,
    kind: input.kind,
    source: input.source,
    status: input.status ?? "success",
    title: trimText(input.title, TITLE_LIMIT),
    summary: trimText(input.summary, SUMMARY_LIMIT),
    toolName: trimOptionalText(input.toolName, TITLE_LIMIT),
    requirementId: trimOptionalText(input.requirementId, TARGET_LIMIT),
    requirementTitle: trimOptionalText(input.requirementTitle, TITLE_LIMIT),
    target: trimOptionalText(input.target, TARGET_LIMIT),
    metadata: sanitizeMetadata(input.metadata ?? {}),
    createdAt: new Date().toISOString(),
  };

  const events = [event, ...current.events]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, MAX_ACTIVITY_EVENTS);
  await writeSecureJsonFile(agentActivityPath(repoPath), {
    version: 1,
    events,
  });

  return event;
}

export async function readAgentActivity(
  repoPath: string,
  limit = 30,
): Promise<AgentActivityLog> {
  const file = await readAgentActivityFile(repoPath);
  const events = file.events
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, Math.max(1, Math.min(100, limit)));

  return {
    version: file.version,
    generatedAt: new Date().toISOString(),
    events,
    summary: createActivitySummary(events),
  };
}

async function readAgentActivityFile(repoPath: string): Promise<{
  version: number;
  events: AgentActivityEvent[];
}> {
  const file = await readSecureJsonFile<Partial<AgentActivityLog>>(agentActivityPath(repoPath));
  return {
    version: 1,
    events: Array.isArray(file?.events) ? file.events.map(normalizeEvent).filter(Boolean) : [],
  };
}

function createActivitySummary(events: AgentActivityEvent[]): AgentActivityLog["summary"] {
  return {
    total: events.length,
    success: events.filter((event) => event.status === "success").length,
    attention: events.filter((event) => event.status === "attention").length,
    error: events.filter((event) => event.status === "error").length,
    lastEventAt: events[0]?.createdAt,
  };
}

function normalizeEvent(value: AgentActivityEvent): AgentActivityEvent {
  return {
    id: String(value.id || createActivityId(value.kind || "system")),
    repoPath: String(value.repoPath || ""),
    kind: value.kind || "system",
    source: value.source || "system",
    status: value.status || "success",
    title: trimText(value.title || "SpecWeft activity", TITLE_LIMIT),
    summary: trimText(value.summary || "-", SUMMARY_LIMIT),
    toolName: trimOptionalText(value.toolName, TITLE_LIMIT),
    requirementId: trimOptionalText(value.requirementId, TARGET_LIMIT),
    requirementTitle: trimOptionalText(value.requirementTitle, TITLE_LIMIT),
    target: trimOptionalText(value.target, TARGET_LIMIT),
    metadata: sanitizeMetadata(value.metadata ?? {}),
    createdAt: value.createdAt || new Date().toISOString(),
  };
}

function sanitizeMetadata(value: Record<string, unknown>): Record<string, string | number | boolean> {
  const sanitized: Record<string, string | number | boolean> = {};

  for (const [key, rawValue] of Object.entries(value).slice(0, 18)) {
    if (rawValue === undefined || rawValue === null) {
      continue;
    }

    if (typeof rawValue === "number" || typeof rawValue === "boolean") {
      sanitized[key] = rawValue;
      continue;
    }

    if (typeof rawValue === "string") {
      sanitized[key] = trimText(rawValue, TARGET_LIMIT);
      continue;
    }

    if (Array.isArray(rawValue)) {
      sanitized[key] = rawValue
        .slice(0, 6)
        .map((item) => trimText(String(item), 48))
        .join(", ");
      continue;
    }

    sanitized[key] = trimText(String(rawValue), 80);
  }

  return sanitized;
}

function trimOptionalText(value: string | undefined, maxLength: number): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  return trimText(value, maxLength);
}

function trimText(value: string, maxLength: number): string {
  const normalized = String(value).replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}

function createActivityId(kind: string): string {
  return `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
