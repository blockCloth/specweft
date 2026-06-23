import type { DiffSummary, ProjectProfile, ReviewDraft } from "../schemas/types.js";

type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export async function enhanceReviewWithLlm(
  review: ReviewDraft,
  diff: DiffSummary,
  profile: ProjectProfile,
): Promise<ReviewDraft> {
  const config = readLlmConfig();

  if (!config || diff.changedFiles.length === 0) {
    return {
      ...review,
      generationSource: "rules",
    };
  }

  try {
    const content = await requestLlmReview(config, review, diff, profile);
    const parsed = parseLlmReview(content);

    return {
      ...review,
      generationSource: "rules+llm",
      llmModel: config.model,
      llmSummary: parsed.summary,
      llmReviewNotes: parsed.notes,
      implementationSummary: mergeFront(parsed.implementationSummary, review.implementationSummary),
      risks: mergeFront(parsed.risks, review.risks),
      reviewChecklist: mergeFront(parsed.checklist, review.reviewChecklist),
      testSuggestions: mergeFront(parsed.testSuggestions, review.testSuggestions),
    };
  } catch (error) {
    return {
      ...review,
      generationSource: "rules",
      llmError: error instanceof Error ? error.message : String(error),
    };
  }
}

function readLlmConfig(): LlmConfig | undefined {
  const apiKey = process.env.SPECWEFT_LLM_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey?.trim()) {
    return undefined;
  }

  return {
    apiKey,
    baseUrl: trimTrailingSlash(process.env.SPECWEFT_LLM_BASE_URL || "https://api.openai.com/v1"),
    model: process.env.SPECWEFT_LLM_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
  };
}

async function requestLlmReview(
  config: LlmConfig,
  review: ReviewDraft,
  diff: DiffSummary,
  profile: ProjectProfile,
): Promise<string> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: [
            "You are SpecWeft's code-review explainer.",
            "Return concise JSON only. Do not include markdown fences.",
            "Explain what changed, why it matters, over-engineering risks, source-reading guidance, and tests.",
            "Use Chinese by default.",
          ].join(" "),
        },
        {
          role: "user",
          content: createPrompt(review, diff, profile),
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM review failed: ${response.status} ${text.slice(0, 300)}`);
  }

  const json = await response.json() as ChatCompletionResponse;
  const content = json.choices?.[0]?.message?.content;

  if (!content?.trim()) {
    throw new Error("LLM review returned empty content.");
  }

  return content;
}

function createPrompt(
  review: ReviewDraft,
  diff: DiffSummary,
  profile: ProjectProfile,
): string {
  return JSON.stringify({
    project: {
      name: profile.name,
      languages: profile.languages,
      frameworks: profile.frameworks,
      packageManager: profile.packageManager,
      ruleFiles: profile.ruleFiles,
    },
    ruleReview: {
      summary: review.summary,
      intent: review.intent,
      requirementBlocks: review.requirementBlocks.map((block) => ({
        title: block.title,
        kind: block.kind,
        confidence: block.confidence,
        summary: block.summary,
        evidence: block.evidence,
        files: block.files.map((file) => file.path),
        suggestedAction: block.suggestedAction,
      })),
      implementationSummary: review.implementationSummary,
      mainChanges: review.mainChanges,
      risks: review.risks,
      tests: review.testSuggestions,
    },
    diff: {
      stats: diff.stats,
      changedFiles: diff.changedFiles,
      patch: trimDiff(diff.diffText),
    },
    expectedJsonShape: {
      summary: "一段说明这次修改实现了什么。",
      implementationSummary: ["实现内容要点"],
      notes: ["帮助用户 review 的讲解要点"],
      risks: ["潜在风险"],
      checklist: ["review 时要检查的事项"],
      testSuggestions: ["建议执行或补充的测试"],
    },
  });
}

function parseLlmReview(content: string): {
  summary?: string;
  implementationSummary: string[];
  notes: string[];
  risks: string[];
  checklist: string[];
  testSuggestions: string[];
} {
  const value = JSON.parse(content) as Record<string, unknown>;

  return {
    summary: toOptionalString(value.summary),
    implementationSummary: toStringArray(value.implementationSummary),
    notes: toStringArray(value.notes),
    risks: toStringArray(value.risks),
    checklist: toStringArray(value.checklist),
    testSuggestions: toStringArray(value.testSuggestions),
  };
}

function mergeFront(front: string[], fallback: string[]): string[] {
  return [
    ...new Set(
      [...front, ...fallback]
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ].slice(0, 12);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function trimDiff(diffText: string): string {
  const maxLength = Number(process.env.SPECWEFT_LLM_MAX_DIFF_CHARS || 16000);
  if (diffText.length <= maxLength) {
    return diffText;
  }

  return `${diffText.slice(0, maxLength)}\n\n[SpecWeft truncated the remaining diff for LLM review.]`;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
