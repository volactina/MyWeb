import { escapeHtml } from "../util/escapeHtml.js";
import { renderProjectStatusBadge } from "./badges.js";
import { formatValue } from "./formatters.js";

export function renderItemsTable({ itemsBody, items, viewConfig }) {
  if (!itemsBody) return;
  if (!Array.isArray(items) || items.length === 0) {
    const colspan = Math.max(1, (viewConfig?.listColumns?.length || 0)) + 1;
    itemsBody.innerHTML = `<tr><td colspan="${colspan}">No data found.</td></tr>`;
    return;
  }

  const cols = viewConfig?.listColumns || [];
  itemsBody.innerHTML = items
    .map(
      (item) => `
      <tr>
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
          <button type="button" data-action="detail" data-id="${item.id}">详情</button>
          <button type="button" data-action="edit" data-id="${item.id}">Edit</button>
          <button type="button" data-action="nav-children" data-id="${item.id}">下级项目</button>
          <button type="button" data-action="move" data-id="${item.id}">移动</button>
          <button type="button" data-action="add-child" data-id="${item.id}">Add Child</button>
          <button type="button" data-action="add-prereq" data-id="${item.id}">Add Prereq</button>
          ${
            String(item.project_status ?? "0") === "1"
              ? `<button type="button" data-action="set-status" data-id="${item.id}" data-status="0">暂停</button>`
              : `<button type="button" data-action="set-status" data-id="${item.id}" data-status="1">开始</button>`
          }
          <button type="button" data-action="set-status" data-id="${item.id}" data-status="2">完成</button>
          ${
            String(item.project_status ?? "0") === "4"
              ? ""
              : `<button type="button" data-action="set-status" data-id="${item.id}" data-status="5">中止</button>`
          }
          <button type="button" data-action="delete" data-id="${item.id}">Delete</button>
        </td>
      </tr>
    `
    )
    .join("");
}

