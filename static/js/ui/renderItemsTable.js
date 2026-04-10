import { escapeHtml } from "../util/escapeHtml.js";
import { renderProjectStatusBadge } from "./badges.js";
import { formatValue } from "./formatters.js";

export function renderItemsTable({ itemsBody, items, viewConfig, locatedItemId = null }) {
  if (!itemsBody) return;
  if (!Array.isArray(items) || items.length === 0) {
    const colspan = Math.max(1, (viewConfig?.listColumns?.length || 0)) + 1;
    itemsBody.innerHTML = `<tr><td colspan="${colspan}">No data found.</td></tr>`;
    return;
  }

  const cols = viewConfig?.listColumns || [];
  itemsBody.innerHTML = items
    .map(
      (item) => {
        const id = String(item?.id ?? "");
        const isLocated = locatedItemId != null && String(locatedItemId) === id;
        return `
      <tr data-item-id="${escapeHtml(id)}" class="${isLocated ? "locate-highlight" : ""}">
        ${cols
          .map((c) => {
            if (c.key === "title") {
              return `<td><div class="cell-title">${renderProjectStatusBadge(item)}<span>${escapeHtml(
                String(formatValue(c.key, item) || "")
              )}</span></div></td>`;
            }
            if (c.key === "project_status") {
              return `<td>${renderProjectStatusBadge(item)}</td>`;
            }
            return `<td>${escapeHtml(formatValue(c.key, item) || "")}</td>`;
          })
          .join("")}
        <td class="actions">
          <button type="button" data-testid="item-detail-${escapeHtml(id)}" data-action="detail" data-id="${item.id}">详情</button>
          <button type="button" data-testid="item-edit-${escapeHtml(id)}" data-action="edit" data-id="${item.id}">Edit</button>
          <button type="button" data-testid="item-nav-children-${escapeHtml(id)}" data-action="nav-children" data-id="${item.id}">下级项目</button>
          <button type="button" data-testid="item-move-${escapeHtml(id)}" data-action="move" data-id="${item.id}">移动</button>
          <button type="button" data-testid="item-add-child-${escapeHtml(id)}" data-action="add-child" data-id="${item.id}">Add Child</button>
          <button type="button" data-testid="item-add-prereq-${escapeHtml(id)}" data-action="add-prereq" data-id="${item.id}">Add Prereq</button>
          <button type="button" data-testid="item-add-schedule-${escapeHtml(id)}" data-action="add-schedule" data-id="${item.id}">加入日程</button>
          ${(() => {
            const st = String(item.project_status ?? "0");
            if (st === "1") {
              return `<button type="button" data-testid="item-pause-${escapeHtml(id)}" data-action="set-status" data-id="${item.id}" data-status="3">暂停</button>`;
            }
            if (st === "2") {
              return `<button type="button" data-testid="item-undo-complete-${escapeHtml(id)}" data-action="set-status" data-id="${item.id}" data-status="3">撤销完成</button>`;
            }
            return `<button type="button" data-testid="item-start-${escapeHtml(id)}" data-action="set-status" data-id="${item.id}" data-status="1">开始</button>`;
          })()}
          ${
            String(item.project_status ?? "0") === "2"
              ? ""
              : `<button type="button" data-testid="item-complete-${escapeHtml(id)}" data-action="set-status" data-id="${item.id}" data-status="2">完成</button>`
          }
          ${
            String(item.project_status ?? "0") === "4"
              ? ""
              : `<button type="button" data-testid="item-cancel-${escapeHtml(id)}" data-action="set-status" data-id="${item.id}" data-status="5">中止</button>`
          }
          <button type="button" data-testid="item-delete-${escapeHtml(id)}" data-action="delete" data-id="${item.id}">Delete</button>
        </td>
      </tr>
    `
      }
    )
    .join("");
}

