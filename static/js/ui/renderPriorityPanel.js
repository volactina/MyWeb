import { escapeHtml } from "../util/escapeHtml.js";

function parsePriority(x) {
  const raw = String(x ?? "").trim();
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function renderPriorityPanel({ priorityItemsBody, itemsById, limit }) {
  if (!priorityItemsBody) return;
  const items = Array.from((itemsById || new Map()).values());
  items.sort((a, b) => parsePriority(b.priority) - parsePriority(a.priority));

  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 5));
  const top = items.slice(0, safeLimit);
  if (top.length === 0) {
    priorityItemsBody.innerHTML = `<tr><td colspan="2">（暂无项目）</td></tr>`;
    return;
  }

  priorityItemsBody.innerHTML = top
    .map((it) => {
      const id = String(it.id);
      const title = escapeHtml(it.title || "");
      return `
        <tr>
          <td>${title} <span class="muted">#${escapeHtml(id)}</span></td>
          <td class="actions">
            <button type="button" data-action="priority-locate" data-id="${escapeHtml(id)}">定位</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

