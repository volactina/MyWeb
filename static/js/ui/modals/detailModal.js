import { escapeHtml } from "../../util/escapeHtml.js";
import { renderProjectStatusBadge } from "../badges.js";
import { formatValue } from "../formatters.js";

export function createDetailModal({ backdrop, titleEl, subEl, bodyEl, viewConfig } = {}) {
  function open(item) {
    if (!backdrop || !bodyEl) return;
    if (titleEl) titleEl.textContent = item?.title ? `详情：${item.title}` : "详情";
    if (subEl) subEl.textContent = "";

    const fields = viewConfig?.detailFields || [];
    bodyEl.innerHTML = `
      <table>
        ${fields
          .map(({ key, label }) => {
            if (key === "project_status") {
              return `<tr><td class="k">${escapeHtml(label)}</td><td>${renderProjectStatusBadge(item)}</td></tr>`;
            }
            const v = formatValue(key, item);
            return `<tr><td class="k">${escapeHtml(label)}</td><td>${escapeHtml(v || "")}</td></tr>`;
          })
          .join("")}
        <tr>
          <td class="k">详情内容</td>
          <td><pre>${escapeHtml(item?.detail || "")}</pre></td>
        </tr>
      </table>
    `;

    backdrop.style.display = "flex";
    backdrop.setAttribute("aria-hidden", "false");
  }

  function close() {
    if (!backdrop) return;
    backdrop.style.display = "none";
    backdrop.setAttribute("aria-hidden", "true");
  }

  return { open, close };
}

