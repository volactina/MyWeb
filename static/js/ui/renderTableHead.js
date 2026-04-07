import { escapeHtml } from "../util/escapeHtml.js";

export function renderTableHead({ itemsHeadRow, viewConfig }) {
  if (!itemsHeadRow) return;
  const cols = (viewConfig && viewConfig.listColumns) || [];
  itemsHeadRow.innerHTML = `
    ${cols.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("")}
    <th>Actions</th>
  `;
}

