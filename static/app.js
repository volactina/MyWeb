const form = document.getElementById("item-form");
const formTitle = document.getElementById("form-title");
const itemIdInput = document.getElementById("item-id");
const titleInput = document.getElementById("title");
const detailInput = document.getElementById("detail");
const submitBtn = document.getElementById("submit-btn");
const cancelBtn = document.getElementById("cancel-btn");
const formMessage = document.getElementById("form-message");

const urgencyLevelSelect = document.getElementById("urgency-level");
const projectStatusSelect = document.getElementById("project-status");
const parentIdsInput = document.getElementById("parent-ids");
const childIdsInput = document.getElementById("child-ids");
const prerequisiteIdsInput = document.getElementById("prerequisite-ids");
const deadlineValueInput = document.getElementById("deadline-value");
const deadlineValueWrap = document.getElementById("deadline-value-wrap");

const filterTitleInput = document.getElementById("filter-title");
const filterDetailInput = document.getElementById("filter-detail");
const filterRootIdInput = document.getElementById("filter-root-id");
const searchBtn = document.getElementById("search-btn");
const clearBtn = document.getElementById("clear-btn");
const statusFilterCheckboxes = Array.from(
  document.querySelectorAll('input.status-filter[type="checkbox"]')
);

const itemsBody = document.getElementById("items-body");
const detailModalBackdrop = document.getElementById("detail-modal-backdrop");
const detailModalCloseBtn = document.getElementById("detail-modal-close");
const detailModalTitle = document.getElementById("detail-modal-title");
const detailModalSub = document.getElementById("detail-modal-sub");
const detailModalBody = document.getElementById("detail-modal-body");

let lastItemsById = new Map();

// -----------------------------
// View config (easy to adjust)
// -----------------------------
// - listColumns: fields shown in the main table (Actions column is always shown)
// - detailFields: fields shown in the detail modal (detail content is always shown)
const VIEW_CONFIG = {
  listColumns: [
    // Example: { key: "id", label: "ID" },
    { key: "title", label: "标题" },
    // Example: { key: "project_status", label: "状态" },
    // Example: { key: "path", label: "路径" },
  ],
  detailFields: [
    { key: "id", label: "ID" },
    { key: "path", label: "Path" },
    { key: "project_status", label: "项目状态" },
    { key: "blocked_by_ids", label: "待完成前置项目" },
    { key: "prerequisite_ids", label: "前置项目列表" },
    { key: "urgency_level", label: "时间紧急程度" },
    { key: "deadline_value", label: "具体日期" },
    { key: "parent_ids", label: "上级项目列表" },
    { key: "child_ids", label: "下级项目列表" },
    { key: "created_at", label: "创建时间" },
    { key: "updated_at", label: "更新时间" },
  ],
};

const itemsHeadRow = document.getElementById("items-head-row");

function syncDeadlineInputControl() {
  const needsDate = urgencyLevelSelect.value === "4";
  if (deadlineValueWrap) {
    deadlineValueWrap.style.display = needsDate ? "" : "none";
  }
  if (!needsDate) {
    deadlineValueInput.value = "";
  }
}

function getCurrentFilters() {
  const params = new URLSearchParams();
  if (filterRootIdInput && filterRootIdInput.value.trim()) {
    params.set("root_id", filterRootIdInput.value.trim());
  }
  if (statusFilterCheckboxes.length > 0) {
    const checked = statusFilterCheckboxes
      .filter((c) => c.checked)
      .map((c) => c.value);
    if (checked.length > 0) {
      params.set("statuses", checked.join(","));
    }
  }
  if (filterTitleInput.value.trim()) {
    params.set("title", filterTitleInput.value.trim());
  }
  if (filterDetailInput.value.trim()) {
    params.set("detail", filterDetailInput.value.trim());
  }
  return params;
}

async function loadItems() {
  const query = getCurrentFilters().toString();
  const url = query ? `/api/items?${query}` : "/api/items";
  const res = await fetch(url);
  const items = await res.json();
  if (Array.isArray(items)) {
    lastItemsById = new Map(items.map((i) => [String(i.id), i]));
  } else {
    lastItemsById = new Map();
  }
  renderItems(items);
}

function renderItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    const colspan = Math.max(1, VIEW_CONFIG.listColumns.length) + 1;
    itemsBody.innerHTML = `<tr><td colspan="${colspan}">No data found.</td></tr>`;
    return;
  }

  const cols = VIEW_CONFIG.listColumns;
  itemsBody.innerHTML = items
    .map(
      (item) => `
      <tr>
        ${cols
          .map((c) => `<td>${escapeHtml(formatValue(c.key, item) || "")}</td>`)
          .join("")}
        <td class="actions">
          <button type="button" data-action="detail" data-id="${item.id}">详情</button>
          <button type="button" data-action="edit" data-id="${item.id}">Edit</button>
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

function formatDeadline(item) {
  const u = String(item.urgency_level ?? "0");
  const v = String(item.deadline_value ?? "").trim();
  if (u !== "4") return "—";
  return v || "未填写";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatValue(key, item) {
  if (key === "deadline_value") return formatDeadline(item);
  return item?.[key] ?? "";
}

function renderTableHead() {
  if (!itemsHeadRow) return;
  const cols = VIEW_CONFIG.listColumns;
  itemsHeadRow.innerHTML = `
    ${cols.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("")}
    <th>Actions</th>
  `;
}

function openDetailModal(item) {
  if (!detailModalBackdrop) return;

  detailModalTitle.textContent = item.title ? `详情：${item.title}` : "详情";
  detailModalSub.textContent = "";

  detailModalBody.innerHTML = `
    <table>
      ${VIEW_CONFIG.detailFields
        .map(({ key, label }) => {
          const v = formatValue(key, item);
          return `<tr><td class="k">${escapeHtml(label)}</td><td>${escapeHtml(v || "")}</td></tr>`;
        })
        .join("")}
      <tr>
        <td class="k">详情内容</td>
        <td><pre>${escapeHtml(item.detail || "")}</pre></td>
      </tr>
    </table>
  `;

  detailModalBackdrop.style.display = "flex";
  detailModalBackdrop.setAttribute("aria-hidden", "false");
}

function closeDetailModal() {
  if (!detailModalBackdrop) return;
  detailModalBackdrop.style.display = "none";
  detailModalBackdrop.setAttribute("aria-hidden", "true");
}

function resetForm() {
  itemIdInput.value = "";
  formTitle.textContent = "Add New Item";
  submitBtn.textContent = "Create";
  titleInput.value = "";
  detailInput.value = "";
  urgencyLevelSelect.value = "0";
  projectStatusSelect.value = "0";
  parentIdsInput.value = "";
  childIdsInput.value = "";
  prerequisiteIdsInput.value = "";
  deadlineValueInput.value = "";
  syncDeadlineInputControl();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.textContent = "";

  const id = itemIdInput.value.trim();
  const payload = {
    title: titleInput.value.trim(),
    detail: detailInput.value.trim(),
    urgency_level: urgencyLevelSelect.value,
    project_status: projectStatusSelect.value,
    parent_ids: parentIdsInput.value.trim(),
    child_ids: childIdsInput.value.trim(),
    prerequisite_ids: prerequisiteIdsInput.value.trim(),
    deadline_value: deadlineValueInput.value.trim(),
  };

  const isEdit = Boolean(id);
  const url = isEdit ? `/api/items/${id}` : "/api/items";
  const method = isEdit ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json();
    formMessage.textContent = errorData.error || "Request failed.";
    return;
  }

  formMessage.textContent = isEdit ? "Item updated." : "Item created.";
  resetForm();
  await loadItems();
});

cancelBtn.addEventListener("click", () => {
  formMessage.textContent = "";
  resetForm();
});

urgencyLevelSelect.addEventListener("change", () => {
  syncDeadlineInputControl();
});

searchBtn.addEventListener("click", () => {
  loadItems();
});

clearBtn.addEventListener("click", () => {
  if (filterRootIdInput) {
    filterRootIdInput.value = "";
  }
  filterTitleInput.value = "";
  filterDetailInput.value = "";
  // Reset status filters to default: 0/1 checked
  for (const c of statusFilterCheckboxes) {
    c.checked = c.value === "0" || c.value === "1";
  }
  loadItems();
});

itemsBody.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.getAttribute("data-action");
  const id = target.getAttribute("data-id");
  if (!action || !id) {
    return;
  }

  if (action === "detail") {
    const item = lastItemsById.get(String(id));
    if (!item) {
      alert("找不到该条目详情（请先刷新列表）");
      return;
    }
    openDetailModal(item);
    return;
  }

  if (action === "add-child") {
    // Switch to create mode and pre-fill parent_ids with the current row's id
    itemIdInput.value = "";
    formTitle.textContent = `Add Child Project (Parent #${id})`;
    submitBtn.textContent = "Create";
    titleInput.value = "";
    detailInput.value = "";
    urgencyLevelSelect.value = "0";
    projectStatusSelect.value = "0";
    parentIdsInput.value = id;
    childIdsInput.value = "";
    prerequisiteIdsInput.value = "";
    deadlineValueInput.value = "";
    syncDeadlineInputControl();
    titleInput.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (action === "add-prereq") {
    itemIdInput.value = "";
    formTitle.textContent = `Add Project (Prereq #${id})`;
    submitBtn.textContent = "Create";
    titleInput.value = "";
    detailInput.value = "";
    urgencyLevelSelect.value = "0";
    projectStatusSelect.value = "0";
    parentIdsInput.value = "";
    childIdsInput.value = "";
    prerequisiteIdsInput.value = id;
    deadlineValueInput.value = "";
    syncDeadlineInputControl();
    titleInput.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (action === "set-status") {
    const status = target.getAttribute("data-status");
    if (!status) return;

    const item = lastItemsById.get(String(id));
    if (item && String(item.project_status ?? "0") === "4" && (status === "1" || status === "2")) {
      const blockedBy = String(item.blocked_by_ids ?? "").trim();
      const msg = blockedBy
        ? `该项目处于阻塞状态，当前被以下前置项目阻塞：${blockedBy}。请先完成前置项目。`
        : "该项目处于阻塞状态，请先完成前置项目。";
      alert(msg);
      return;
    }

    const res = await fetch(`/api/items/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_status: status }),
    });

    if (!res.ok) {
      let msg = "Update status failed.";
      try {
        const data = await res.json();
        if (data && data.error) msg = data.error;
      } catch {
        // ignore
      }
      alert(msg);
      return;
    }

    await loadItems();
    return;
  }

  if (action === "delete") {
    const ok = confirm(`Delete item #${id}?`);
    if (!ok) {
      return;
    }

    const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
    if (!res.ok) {
      let msg = "Delete failed.";
      try {
        const data = await res.json();
        if (data && data.error) {
          msg = data.error;
        }
      } catch {
        // ignore
      }
      alert(msg);
      return;
    }

    await loadItems();
    return;
  }

  if (action === "edit") {
    const item = lastItemsById.get(String(id));
    if (!item) {
      alert("找不到该条目（请先刷新列表）");
      return;
    }

    itemIdInput.value = id;
    titleInput.value = item.title || "";
    detailInput.value = item.detail || "";
    urgencyLevelSelect.value = String(item.urgency_level ?? "0");
    projectStatusSelect.value = String(item.project_status ?? "0");
    parentIdsInput.value = item.parent_ids || "";
    childIdsInput.value = item.child_ids || "";
    prerequisiteIdsInput.value = item.prerequisite_ids || "";
    deadlineValueInput.value = item.deadline_value || "";
    syncDeadlineInputControl();
    formTitle.textContent = `Edit Item #${id}`;
    submitBtn.textContent = "Save";
  }
});

if (detailModalCloseBtn) {
  detailModalCloseBtn.addEventListener("click", closeDetailModal);
}
if (detailModalBackdrop) {
  detailModalBackdrop.addEventListener("click", (e) => {
    if (e.target === detailModalBackdrop) closeDetailModal();
  });
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDetailModal();
});

syncDeadlineInputControl();
renderTableHead();
loadItems();
