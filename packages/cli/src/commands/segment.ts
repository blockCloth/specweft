import {
  completeWorkSegment,
  createWorkSegmentStatus,
  getActiveRequirement,
  resolveRepoPath,
  scanProject,
  startWorkSegment,
} from "@specweft/core";
import { printJson, printText } from "../output.js";
import { recordCliActivity } from "./activity.js";

export async function runSegment(
  repoArg: string,
  subcommand?: string,
  taskOrTitle?: string,
  asJson = false,
): Promise<void> {
  const repoPath = resolveRepoPath(repoArg);
  const profile = await scanProject(repoPath);
  const command = subcommand ?? "status";

  if (command === "start") {
    const requirement = await getActiveRequirement(repoPath);
    const result = await startWorkSegment(repoPath, {
      projectId: profile.id,
      requirement,
      task: taskOrTitle ?? requirement?.title ?? "未命名工作段",
      title: taskOrTitle,
    });
    await recordCliActivity(repoPath, {
      kind: "start_work_segment",
      title: "开启工作段",
      summary: "CLI 已为本次需求记录修改边界，后续 review 可以区分新增改动和已有脏区。",
      toolName: "specweft segment start",
      requirementId: result.segment.requirementId,
      requirementTitle: result.segment.requirementTitle,
      target: result.segment.title,
      metadata: {
        baselineChangedFiles: result.segment.baselineChangedFiles,
        interruptedSegmentId: result.interruptedSegment?.id,
      },
    });
    printSegmentResult(result, asJson);
    return;
  }

  if (command === "end" || command === "record" || command === "complete") {
    const segment = await completeWorkSegment(repoPath, {
      status: "recorded",
      title: taskOrTitle,
    });
    if (segment) {
      await recordCliActivity(repoPath, {
        kind: "complete_work_segment",
        title: "完成工作段",
        summary: "CLI 已结束当前工作段，记录本段新增和沿用的修改文件。",
        toolName: "specweft segment complete",
        requirementId: segment.requirementId,
        requirementTitle: segment.requirementTitle,
        target: segment.title,
        metadata: {
          status: segment.status,
          newChangedFiles: segment.newChangedFiles,
          carriedChangedFiles: segment.carriedChangedFiles,
        },
      });
    }
    if (asJson) {
      printJson({ segment });
      return;
    }
    printText(segment
      ? `工作段已结束：${segment.title}\n新增文件：${segment.newChangedFiles.join(", ") || "-"}`
      : "当前没有活跃工作段。");
    return;
  }

  if (command === "abort" || command === "abandon") {
    const segment = await completeWorkSegment(repoPath, {
      status: "abandoned",
      title: taskOrTitle,
    });
    if (segment) {
      await recordCliActivity(repoPath, {
        kind: "complete_work_segment",
        status: "attention",
        title: "放弃工作段",
        summary: "CLI 已将当前工作段标记为放弃，后续讲解会把它视为非正常完成边界。",
        toolName: "specweft segment abandon",
        requirementId: segment.requirementId,
        requirementTitle: segment.requirementTitle,
        target: segment.title,
        metadata: {
          status: segment.status,
          newChangedFiles: segment.newChangedFiles,
          carriedChangedFiles: segment.carriedChangedFiles,
        },
      });
    }
    if (asJson) {
      printJson({ segment });
      return;
    }
    printText(segment ? `工作段已放弃：${segment.title}` : "当前没有活跃工作段。");
    return;
  }

  if (command === "status" || command === "list") {
    const status = await createWorkSegmentStatus(repoPath, profile);
    if (asJson) {
      printJson(status);
      return;
    }
    printText(formatSegmentStatus(status));
    return;
  }

  throw new Error(`未知 segment 命令：${command}`);
}

function printSegmentResult(
  result: Awaited<ReturnType<typeof startWorkSegment>>,
  asJson: boolean,
): void {
  if (asJson) {
    printJson(result);
    return;
  }

  const lines = [
    `工作段已开始：${result.segment.title}`,
    `需求：${result.segment.requirementTitle ?? "-"}`,
    `开始时已有改动：${result.segment.baselineChangedFiles.join(", ") || "-"}`,
  ];

  if (result.interruptedSegment) {
    lines.push(`已中断上一条工作段：${result.interruptedSegment.title}`);
  }

  printText(lines.join("\n"));
}

function formatSegmentStatus(status: Awaited<ReturnType<typeof createWorkSegmentStatus>>): string {
  return [
    "SpecWeft Work Segments / 工作段",
    "",
    `项目：${status.projectName}`,
    `活跃工作段：${status.activeSegment?.title ?? "-"}`,
    `总数：${status.summary.total}，已记录：${status.summary.recorded}，中断：${status.summary.interrupted}，放弃：${status.summary.abandoned}`,
    "",
    "建议：",
    ...status.guidance.map((item) => `- ${item}`),
    "",
    "最近工作段：",
    ...(status.recentSegments.length
      ? status.recentSegments.map((segment) =>
        `- ${segment.title} [${segment.status}] 新增文件：${segment.newChangedFiles.slice(0, 5).join(", ") || "-"}`
      )
      : ["- 暂无工作段"]),
  ].join("\n");
}
