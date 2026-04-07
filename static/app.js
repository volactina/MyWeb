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
const parentPathInput = document.getElementById("parent-path");
const parentPathBtn = document.getElementById("parent-path-btn");
const childIdsInput = document.getElementById("child-ids");
const prerequisiteIdsInput = document.getElementById("prerequisite-ids");
const deadlineValueInput = document.getElementById("deadline-value");
const deadlineValueWrap = document.getElementById("deadline-value-wrap");

const filterTitleInput = document.getElementById("filter-title");
const filterDetailInput = document.getElementById("filter-detail");
const filterRootIdInput = document.getElementById("filter-root-id");
const filterUpBtn = document.getElementById("filter-up-btn");
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

const moveModalBackdrop = document.getElementById("move-modal-backdrop");
const moveModalCloseBtn = document.getElementById("move-modal-close");
const moveModalTitle = document.getElementById("move-modal-title");
const moveModalSub = document.getElementById("move-modal-sub");
const moveModalCrumbs = document.getElementById("move-modal-crumbs");
const moveModalList = document.getElementById("move-modal-list");
const moveModalMoveHereBtn = document.getElementById("move-modal-move-here");
const moveModalMoveRootBtn = document.getElementById("move-modal-move-root");
const moveModalHint = document.getElementById("move-modal-hint");

const prereqChoiceBackdrop = document.getElementById("prereq-choice-backdrop");
const prereqChoiceCloseBtn = document.getElementById("prereq-choice-close");
const prereqChoiceCreateNewBtn = document.getElementById("prereq-choice-create-new");
const prereqChoiceLinkExistingBtn = document.getElementById("prereq-choice-link-existing");
const prereqChoiceCancelBtn = document.getElementById("prereq-choice-cancel");
const prereqChoiceTitle = document.getElementById("prereq-choice-title");
const prereqChoiceSub = document.getElementById("prereq-choice-sub");

let lastItemsById = new Map();
let allItemsById = new Map();

const pathPickerState = {
  mode: "move", // "move" | "pick-parent" | "pick-prereq"
};

const moveState = {
  movingId: null, // string
  browseParentId: null, // string | null (null means root)
};

const prereqState = {
  targetId: null, // string | null (the project we are adding prereq for)
  pendingNewPrereqFor: null, // string | null (after creating new item, link it as prereq of this id)
};

function updateFilterUpButton() {
  if (!filterUpBtn) return;
  const hasRoot = Boolean(filterRootIdInput && filterRootIdInput.value.trim());
  filterUpBtn.disabled = !hasRoot;
}

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
  updateFilterUpButton();
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

function openMoveModal(movingId) {
  if (!moveModalBackdrop) return;
  pathPickerState.mode = "move";
  moveState.movingId = String(movingId);
  moveState.browseParentId = null;
  moveModalBackdrop.style.display = "flex";
  moveModalBackdrop.setAttribute("aria-hidden", "false");
  loadAllItemsForMoveModal();
}

function closeMoveModal() {
  if (!moveModalBackdrop) return;
  moveModalBackdrop.style.display = "none";
  moveModalBackdrop.setAttribute("aria-hidden", "true");
  moveState.movingId = null;
  moveState.browseParentId = null;
  pathPickerState.mode = "move";
}

function openPrereqPicker(targetId) {
  if (!moveModalBackdrop) return;
  pathPickerState.mode = "pick-prereq";
  prereqState.targetId = String(targetId);
  moveState.movingId = null;
  moveState.browseParentId = null;
  moveModalBackdrop.style.display = "flex";
  moveModalBackdrop.setAttribute("aria-hidden", "false");
  loadAllItemsForMoveModal();
}

async function loadAllItemsForMoveModal() {
  const res = await fetch("/api/items?all=1");
  const items = await res.json();
  if (Array.isArray(items)) {
    allItemsById = new Map(items.map((i) => [String(i.id), i]));
  } else {
    allItemsById = new Map();
  }
  renderMoveModal();
}

function getPathLabelForParentId(parentIdOrEmpty) {
  const pid = String(parentIdOrEmpty || "").trim();
  if (!pid) return "/";
  const item = allItemsById.get(pid);
  if (!item) return `/#${pid}`;
  return `/${String(item.path || pid)}`;
}

function setFormParentById(parentIdOrEmpty) {
  const pid = String(parentIdOrEmpty || "").trim();
  if (parentIdsInput) parentIdsInput.value = pid;
  if (parentPathInput) parentPathInput.value = getPathLabelForParentId(pid);
}

function getChildrenOf(parentIdOrNull) {
  const pid = parentIdOrNull ? String(parentIdOrNull) : "";
  const out = [];
  for (const item of allItemsById.values()) {
    const p = String(item.parent_ids || "").trim();
    if (!pid && !p) out.push(item);
    if (pid && p === pid) out.push(item);
  }
  out.sort((a, b) => Number(a.id) - Number(b.id));
  return out;
}

function getAncestorChain(fromIdOrNull) {
  if (!fromIdOrNull) return [];
  const chain = [];
  let cur = String(fromIdOrNull);
  const seen = new Set();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const item = allItemsById.get(cur);
    if (!item) break;
    chain.push(item);
    cur = String(item.parent_ids || "").trim();
  }
  return chain.reverse();
}

function getDescendantsOf(rootId) {
  const rid = String(rootId);
  const childrenMap = new Map();
  for (const item of allItemsById.values()) {
    const pid = String(item.parent_ids || "").trim();
    if (!pid) continue;
    if (!childrenMap.has(pid)) childrenMap.set(pid, []);
    childrenMap.get(pid).push(String(item.id));
  }
  const out = new Set();
  const stack = [rid];
  while (stack.length) {
    const cur = stack.pop();
    const kids = childrenMap.get(cur) || [];
    for (const k of kids) {
      if (out.has(k)) continue;
      out.add(k);
      stack.push(k);
    }
  }
  return out;
}

function renderMoveModal() {
  if (!moveModalBackdrop) return;
  const isPickParent = pathPickerState.mode === "pick-parent";
  const isPickPrereq = pathPickerState.mode === "pick-prereq";
  const moving = isPickParent || isPickPrereq ? null : allItemsById.get(String(moveState.movingId || ""));
  if (!isPickParent && !isPickPrereq && !moving) {
    if (moveModalTitle) moveModalTitle.textContent = "移动项目";
    if (moveModalSub) moveModalSub.textContent = "未找到要移动的项目，请刷新后重试。";
    if (moveModalList) moveModalList.innerHTML = "";
    return;
  }

  if (moveModalTitle) {
    moveModalTitle.textContent = isPickParent
      ? "选择上级路径"
      : isPickPrereq
        ? "关联已有前置项目"
        : `移动：${moving?.title || ""}`;
  }
  const hereLabel = moveState.browseParentId ? `#${moveState.browseParentId}` : "根目录";
  if (moveModalSub) {
    moveModalSub.textContent = isPickParent
      ? `当前选择：${hereLabel}`
      : isPickPrereq
        ? `当前目录：${hereLabel}（点击“选择”来关联）`
        : `当前选择目录：${hereLabel}`;
  }

  const chain = getAncestorChain(moveState.browseParentId);
  if (moveModalCrumbs) {
    const rootCrumb = `<button type="button" class="crumb" data-crumb="root">根目录</button>`;
    const others = chain
      .map(
        (x) =>
          `<button type="button" class="crumb" data-crumb="${escapeHtml(String(x.id))}">${escapeHtml(
            x.title || `#${x.id}`
          )}</button>`
      )
      .join(`<span class="muted">/</span>`);
    moveModalCrumbs.innerHTML = rootCrumb + (others ? `<span class="muted">/</span>${others}` : "");
  }

  const blockedSet = new Set();
  if (!isPickParent && !isPickPrereq && moving) {
    const movingId = String(moving.id);
    for (const x of getDescendantsOf(movingId)) blockedSet.add(x);
    blockedSet.add(movingId);
  }

  const children = getChildrenOf(moveState.browseParentId);
  if (moveModalList) {
    if (children.length === 0) {
      moveModalList.innerHTML = `<tr><td colspan="2">（空）</td></tr>`;
    } else {
      moveModalList.innerHTML = children
        .map((c) => {
          const cid = String(c.id);
          const disabled = blockedSet.has(cid);
          const prereqBtn = isPickPrereq
            ? `<button type="button" data-pick-prereq="${escapeHtml(cid)}">选择</button>`
            : "";
          return `
            <tr>
              <td>${escapeHtml(c.title || "")} <span class="muted">#${escapeHtml(cid)}</span>${
                disabled ? ' <span class="muted">（不可选）</span>' : ""
              }</td>
              <td class="actions">
                <button type="button" data-move-enter="${escapeHtml(cid)}">进入</button>
                ${prereqBtn}
              </td>
            </tr>
          `;
        })
        .join("");
    }
  }

  if (moveModalHint) {
    moveModalHint.textContent =
      pathPickerState.mode === "pick-parent"
        ? "提示：选择“当前目录”作为上级路径（根目录表示无上级）。"
        : pathPickerState.mode === "pick-prereq"
          ? "提示：选择一个已有项目作为前置项目（不能选择自己）。"
        : "提示：不能移动到自己或自己的子项目目录中。";
  }
}

async function moveProjectTo(parentIdOrEmpty) {
  if (!moveState.movingId) return;
  const res = await fetch(`/api/items/${encodeURIComponent(moveState.movingId)}/parent`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parent_id: parentIdOrEmpty }),
  });
  if (!res.ok) {
    let msg = "移动失败。";
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
  closeMoveModal();
}

function openParentPathPicker() {
  if (!moveModalBackdrop) return;
  pathPickerState.mode = "pick-parent";
  moveState.movingId = null;
  moveState.browseParentId = null;
  moveModalBackdrop.style.display = "flex";
  moveModalBackdrop.setAttribute("aria-hidden", "false");
  loadAllItemsForMoveModal();
}

function pickParentHere() {
  setFormParentById(moveState.browseParentId ? String(moveState.browseParentId) : "");
  closeMoveModal();
}

function resetForm() {
  itemIdInput.value = "";
  formTitle.textContent = "Add New Item";
  submitBtn.textContent = "Create";
  titleInput.value = "";
  detailInput.value = "";
  urgencyLevelSelect.value = "0";
  projectStatusSelect.value = "0";
  setFormParentById("");
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

  const createdOrUpdated = await res.json();

  // If user just created a "new prerequisite project" for some target, link it now.
  if (!isEdit && prereqState.pendingNewPrereqFor) {
    const targetId = String(prereqState.pendingNewPrereqFor);
    prereqState.pendingNewPrereqFor = null;
    const newId = createdOrUpdated && createdOrUpdated.id ? String(createdOrUpdated.id) : "";
    if (newId) {
      const linkRes = await fetch(`/api/items/${encodeURIComponent(targetId)}/prerequisites`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ add: newId }),
      });
      if (!linkRes.ok) {
        let msg = `新建成功，但关联到 #${targetId} 失败。`;
        try {
          const data = await linkRes.json();
          if (data && data.error) msg = data.error;
        } catch {
          // ignore
        }
        formMessage.textContent = msg;
        await loadItems();
        resetForm();
        return;
      }
      formMessage.textContent = `新建成功，并已关联为 #${targetId} 的前置项目（#${newId}）。`;
    } else {
      formMessage.textContent = "新建成功，但未获取到新项目ID，无法自动关联。";
    }
    resetForm();
    await loadItems();
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
  updateFilterUpButton();
  filterTitleInput.value = "";
  filterDetailInput.value = "";
  // Reset status filters to default: 0/1 checked
  for (const c of statusFilterCheckboxes) {
    c.checked = c.value === "0" || c.value === "1";
  }
  loadItems();
});

if (filterUpBtn) {
  filterUpBtn.addEventListener("click", () => {
    if (!filterRootIdInput) return;
    const rootId = filterRootIdInput.value.trim();
    if (!rootId) return;

    const rootItem = lastItemsById.get(String(rootId));
    const parent = rootItem ? String(rootItem.parent_ids || "").trim() : "";
    filterRootIdInput.value = parent; // empty => root view
    updateFilterUpButton();
    loadItems();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

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

  if (action === "nav-children") {
    if (filterRootIdInput) {
      filterRootIdInput.value = String(id);
    }
    updateFilterUpButton();
    loadItems();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (action === "move") {
    openMoveModal(id);
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
    setFormParentById(id);
    childIdsInput.value = "";
    prerequisiteIdsInput.value = "";
    deadlineValueInput.value = "";
    syncDeadlineInputControl();
    titleInput.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (action === "add-prereq") {
    openPrereqChoiceModal(id);
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
    setFormParentById(item.parent_ids || "");
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

if (moveModalCloseBtn) {
  moveModalCloseBtn.addEventListener("click", closeMoveModal);
}
if (moveModalBackdrop) {
  moveModalBackdrop.addEventListener("click", (e) => {
    if (e.target === moveModalBackdrop) closeMoveModal();
  });
}
if (moveModalCrumbs) {
  moveModalCrumbs.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const crumb = t.getAttribute("data-crumb");
    if (!crumb) return;
    moveState.browseParentId = crumb === "root" ? null : crumb;
    renderMoveModal();
  });
}
if (moveModalList) {
  moveModalList.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    const pickPrereq = t.getAttribute("data-pick-prereq");
    if (pickPrereq) {
      const targetId = prereqState.targetId;
      if (!targetId) {
        alert("缺少目标项目，请重试。");
        return;
      }
      if (String(pickPrereq) === String(targetId)) {
        alert("不能选择自己作为前置项目。");
        return;
      }
      (async () => {
        const res = await fetch(`/api/items/${encodeURIComponent(targetId)}/prerequisites`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ add: pickPrereq }),
        });
        if (!res.ok) {
          let msg = "关联失败。";
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
        closeMoveModal();
      })();
      return;
    }

    const enter = t.getAttribute("data-move-enter");
    if (!enter) return;
    if (pathPickerState.mode === "move") {
      const moving = allItemsById.get(String(moveState.movingId || ""));
      const blocked = moving ? getDescendantsOf(String(moving.id)) : new Set();
      if (moving) blocked.add(String(moving.id));
      if (blocked.has(String(enter))) {
        alert("不能进入自己或自己的子项目目录。");
        return;
      }
    }
    moveState.browseParentId = enter;
    renderMoveModal();
  });
}
if (moveModalMoveHereBtn) {
  moveModalMoveHereBtn.addEventListener("click", () => {
    if (pathPickerState.mode === "pick-parent") {
      pickParentHere();
      return;
    }
    if (pathPickerState.mode === "pick-prereq") {
      alert("请在列表里点击“选择”来关联该项目为前置项目。");
      return;
    }
    const moving = allItemsById.get(String(moveState.movingId || ""));
    if (moving) {
      const blocked = getDescendantsOf(String(moving.id));
      blocked.add(String(moving.id));
      const dest = moveState.browseParentId ? String(moveState.browseParentId) : "";
      if (dest && blocked.has(dest)) {
        alert("不能移动到自己或自己的子项目目录。");
        return;
      }
    }
    moveProjectTo(moveState.browseParentId ? String(moveState.browseParentId) : "");
  });
}
if (moveModalMoveRootBtn) {
  moveModalMoveRootBtn.addEventListener("click", () => {
    if (pathPickerState.mode === "pick-parent") {
      setFormParentById("");
      closeMoveModal();
      return;
    }
    if (pathPickerState.mode === "pick-prereq") {
      alert("关联前置项目不支持“移动到根目录”。请在列表里选择一个项目。");
      return;
    }
    moveProjectTo("");
  });
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDetailModal();
  if (e.key === "Escape") closeMoveModal();
});

function openPrereqChoiceModal(targetId) {
  if (!prereqChoiceBackdrop) return;
  prereqState.targetId = String(targetId);
  const item = lastItemsById.get(String(targetId));
  if (prereqChoiceTitle) {
    prereqChoiceTitle.textContent = item?.title ? `添加前置项目：${item.title}` : "添加前置项目";
  }
  if (prereqChoiceSub) {
    prereqChoiceSub.textContent = `目标项目 #${String(targetId)}`;
  }
  prereqChoiceBackdrop.style.display = "flex";
  prereqChoiceBackdrop.setAttribute("aria-hidden", "false");
}

function closePrereqChoiceModal() {
  if (!prereqChoiceBackdrop) return;
  prereqChoiceBackdrop.style.display = "none";
  prereqChoiceBackdrop.setAttribute("aria-hidden", "true");
}

syncDeadlineInputControl();
renderTableHead();
updateFilterUpButton();
if (parentPathBtn) {
  parentPathBtn.addEventListener("click", () => {
    openParentPathPicker();
  });
}
loadItems();

if (prereqChoiceCloseBtn) prereqChoiceCloseBtn.addEventListener("click", closePrereqChoiceModal);
if (prereqChoiceCancelBtn) prereqChoiceCancelBtn.addEventListener("click", closePrereqChoiceModal);
if (prereqChoiceBackdrop) {
  prereqChoiceBackdrop.addEventListener("click", (e) => {
    if (e.target === prereqChoiceBackdrop) closePrereqChoiceModal();
  });
}
if (prereqChoiceCreateNewBtn) {
  prereqChoiceCreateNewBtn.addEventListener("click", () => {
    const targetId = prereqState.targetId;
    if (!targetId) return;
    prereqState.pendingNewPrereqFor = String(targetId);
    closePrereqChoiceModal();

    // Switch to create mode; user will create a new project, then we will link it as prerequisite.
    itemIdInput.value = "";
    formTitle.textContent = `新建前置项目（将关联到 #${targetId}）`;
    submitBtn.textContent = "Create";
    titleInput.value = "";
    detailInput.value = "";
    urgencyLevelSelect.value = "0";
    projectStatusSelect.value = "0";
    setFormParentById("");
    childIdsInput.value = "";
    prerequisiteIdsInput.value = "";
    deadlineValueInput.value = "";
    syncDeadlineInputControl();
    titleInput.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
if (prereqChoiceLinkExistingBtn) {
  prereqChoiceLinkExistingBtn.addEventListener("click", () => {
    const targetId = prereqState.targetId;
    if (!targetId) return;
    closePrereqChoiceModal();
    openPrereqPicker(targetId);
  });
}
