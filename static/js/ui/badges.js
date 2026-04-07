import { escapeHtml } from "../util/escapeHtml.js";

export function getProjectStatusLabel(statusRaw) {
  const s = String(statusRaw ?? "0");
  if (s === "1") return "进行中";
  if (s === "2") return "已完成";
  if (s === "4") return "阻塞";
  if (s === "5") return "中止";
  return "待开始";
}

export function renderProjectStatusBadge(itemOrStatus) {
  const status =
    typeof itemOrStatus === "object"
      ? String(itemOrStatus?.project_status ?? "0")
      : String(itemOrStatus ?? "0");
  const normalized = status === "3" ? "0" : status;
  const cls = `badge status-${escapeHtml(normalized)}`;
  const label = escapeHtml(getProjectStatusLabel(normalized));
  return `<span class="${cls}">${label}</span>`;
}

