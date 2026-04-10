import { renderProjectStatusBadge } from "./badges.js";
import { escapeHtml } from "../util/escapeHtml.js";

export const GOAL_LINE_SELECTED_KEY = "myweb:goalLineSelectedRootId";

/** 分类为 4 的项目均可作为面板可选目标（可挂在管理项目等上级下） */
export function getGoalRoots(itemsById) {
  const roots = [];
  for (const item of itemsById.values()) {
    if (String(item.project_category ?? "2").trim() !== "4") continue;
    roots.push(item);
  }
  roots.sort((a, b) => Number(a.id) - Number(b.id));
  return roots;
}

function parseIdList(raw) {
  return String(raw || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 根 + 全部前置链路节点 id（含自己） */
export function collectSubtreeIds(itemsById, rootId) {
  const out = new Set();
  const stack = [String(rootId)];
  while (stack.length) {
    const cur = stack.pop();
    if (out.has(cur)) continue;
    out.add(cur);
    const it = itemsById.get(cur);
    if (!it) continue;
    for (const k of parseIdList(it.prerequisite_ids)) stack.push(String(k));
  }
  return out;
}

/** 中止(5)不计入分母；已完成(2)计入完成数 */
export function computeGoalProgress(itemsById, rootId) {
  const ids = collectSubtreeIds(itemsById, rootId);
  let done = 0;
  let total = 0;
  for (const id of ids) {
    const it = itemsById.get(id);
    if (!it) continue;
    const st = String(it.project_status ?? "0");
    if (st === "5") continue;
    total += 1;
    if (st === "2") done += 1;
  }
  const pct = total ? Math.round((100 * done) / total) : 0;
  return { done, total, pct };
}

/** BFS 分层：每层该深度的节点列表 */
export function buildGoalLevels(itemsById, rootId) {
  const rid = String(rootId);
  if (!itemsById.has(rid)) return [];

  const levels = [];
  let frontier = [rid];
  let depth = 0;
  const visited = new Set();
  while (frontier.length) {
    const nodes = frontier
      .map((id) => itemsById.get(id))
      .filter(Boolean)
      .filter((x) => !visited.has(String(x.id)));
    if (nodes.length) levels.push({ depth, nodes });
    const next = [];
    for (const n of nodes) {
      visited.add(String(n.id));
      for (const k of parseIdList(n.prerequisite_ids)) {
        const kid = String(k);
        if (visited.has(kid)) continue;
        next.push(kid);
      }
    }
    frontier = next;
    depth += 1;
  }
  return levels;
}

export function renderGoalLineBoardHtml(levels) {
  if (!levels.length) return "";
  return levels
    .map((level) => {
      const cards = level.nodes
        .map((item) => {
          const id = String(item.id);
          const st = String(item.project_status ?? "0");
          const pauseBtn =
            st === "1" || st === "3"
              ? `<button type="button" data-goal-action="pause" data-id="${escapeHtml(id)}">暂停</button>`
              : "";
          const startBtn =
            st === "3" ? `<button type="button" data-goal-action="start" data-id="${escapeHtml(id)}">开始</button>` : "";
          const planBtn =
            st === "0" ? `<button type="button" data-goal-action="plan" data-id="${escapeHtml(id)}">计划</button>` : "";
          const completeBtn =
            st === "0"
              ? ""
              : st === "2"
              ? `<button type="button" data-goal-action="undo-complete" data-id="${escapeHtml(id)}">撤销完成</button>`
              : `<button type="button" data-goal-action="complete" data-id="${escapeHtml(id)}">完成</button>`;
          return `
        <article class="goal-line-card" data-goal-node-id="${escapeHtml(id)}">
          <div class="goal-line-card-title">${renderProjectStatusBadge(item)}<span>${escapeHtml(
            String(item.title || "")
          )}</span></div>
          <div class="muted goal-line-card-id">#${escapeHtml(id)}</div>
          <div class="actions goal-line-card-actions">
            <button type="button" data-goal-action="locate" data-id="${escapeHtml(id)}">定位</button>
            <button type="button" data-goal-action="detail" data-id="${escapeHtml(id)}">详情</button>
            <button type="button" data-goal-action="add-child" data-id="${escapeHtml(id)}">新增子目标</button>
            <button type="button" data-goal-action="detach" data-id="${escapeHtml(id)}">删除目标</button>
            ${planBtn}
            ${startBtn}
            ${pauseBtn}
            ${completeBtn}
          </div>
        </article>`;
        })
        .join("");
      return `<div class="goal-line-column" data-depth="${level.depth}">
        <div class="goal-line-column-inner">${cards}</div>
      </div>`;
    })
    .join("");
}
