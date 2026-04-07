import { escapeHtml } from "./util/escapeHtml.js";
import { VIEW_CONFIG } from "./ui/viewConfig.js";
import { renderTableHead } from "./ui/renderTableHead.js";
import { renderItemsTable } from "./ui/renderItemsTable.js";
import { renderPriorityPanel } from "./ui/renderPriorityPanel.js";
import { renderProjectStatusBadge } from "./ui/badges.js";
import { formatValue } from "./ui/formatters.js";
import { createFormModal } from "./ui/modals/formModal.js";
import { createDetailModal } from "./ui/modals/detailModal.js";
import { createItemsCache } from "./state/itemsCache.js";
import { listItems, createItem, updateItem, deleteItem, patchStatus, patchParent } from "./api/items.js";

const form = document.getElementById("item-form");
const formTitle = document.getElementById("form-title"); // legacy (removed from page)
const itemIdInput = document.getElementById("item-id");
const titleInput = document.getElementById("title");
const detailInput = document.getElementById("detail");
const submitBtn = document.getElementById("submit-btn");
const cancelBtn = document.getElementById("cancel-btn");
const formMessage = document.getElementById("form-message");

const newItemBtn = document.getElementById("new-item-btn");
const formModalBackdrop = document.getElementById("form-modal-backdrop");
const formModalCloseBtn = document.getElementById("form-modal-close");
const formModalTitle = document.getElementById("form-modal-title");
const formModalSub = document.getElementById("form-modal-sub");
const itemsDirHint = document.getElementById("items-dir-hint");

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
const statusFilterCheckboxes = Array.from(document.querySelectorAll('input.status-filter[type="checkbox"]'));

const priorityLimitInput = document.getElementById("priority-limit");
const priorityRefreshBtn = document.getElementById("priority-refresh-btn");
const priorityItemsBody = document.getElementById("priority-items-body");
const priorityPanel = document.getElementById("priority-panel");
const filterPanel = document.getElementById("filter-panel");
const switchToPriorityBtn = document.getElementById("switch-to-priority");
const switchToFilterBtn = document.getElementById("switch-to-filter");
const switcherTitle = document.getElementById("switcher-title");
const switcherSub = document.getElementById("switcher-sub");

const itemsBody = document.getElementById("items-body");
const itemsHeadRow = document.getElementById("items-head-row");

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

const allItemsCache = createItemsCache({ ttlMs: 5000 });

function invalidateAllItemsCache() {
  allItemsCache.clear();
}

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

const formModal = createFormModal({
  backdrop: formModalBackdrop,
  titleEl: formModalTitle,
  subEl: formModalSub,
  messageEl: formMessage,
});

const detailModal = createDetailModal({
  backdrop: detailModalBackdrop,
  titleEl: detailModalTitle,
  subEl: detailModalSub,
  bodyEl: detailModalBody,
  viewConfig: VIEW_CONFIG,
});

function updateFilterUpButton() {
  if (!filterUpBtn) return;
  const hasRoot = Boolean(filterRootIdInput && filterRootIdInput.value.trim());
  filterUpBtn.disabled = !hasRoot;
}

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
    const checked = statusFilterCheckboxes.filter((c) => c.checked).map((c) => c.value);
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
  const params = getCurrentFilters();
  const items = await listItems({
    title: params.get("title") || "",
    detail: params.get("detail") || "",
    rootId: params.get("root_id") || "",
    statuses: (params.get("statuses") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  }).catch((e) => {
    alert(String(e?.message || e || "加载失败"));
    return [];
  });

  lastItemsById = new Map(items.map((i) => [String(i.id), i]));
  updateFilterUpButton();
  await updateItemsDirHint();
  renderItemsTable({ itemsBody, items, viewConfig: VIEW_CONFIG });
}

function ensureStatusChecked(statusValue) {
  const v = String(statusValue ?? "").trim();
  for (const c of statusFilterCheckboxes) {
    if (String(c.value) === v) {
      c.checked = true;
      return;
    }
  }
}

async function getAllItemsCached() {
  const cached = allItemsCache.get();
  if (cached) return cached;

  const items = await listItems({ all: true }).catch(() => []);
  const byId = new Map(items.map((i) => [String(i.id), i]));
  allItemsCache.set(byId);
  return byId;
}

async function updateItemsDirHint() {
  if (!itemsDirHint) return;
  const rid = filterRootIdInput ? filterRootIdInput.value.trim() : "";
  if (!rid) {
    itemsDirHint.textContent = "当前目录：根目录";
    return;
  }
  const byId = await getAllItemsCached();
  const cur = byId.get(String(rid));
  if (!cur) {
    itemsDirHint.textContent = `当前目录：#${rid}`;
    return;
  }
  itemsDirHint.textContent = `当前目录：${cur.title || ("#" + rid)}`;
}

async function loadTopPriorityItems() {
  if (!priorityItemsBody) return;
  const byId = await getAllItemsCached();

  let limit = 5;
  if (priorityLimitInput) {
    const v = String(priorityLimitInput.value || "").trim();
    const n = v && /^\d+$/.test(v) ? Number(v) : 5;
    limit = Math.max(1, Math.min(50, n));
  }

  renderPriorityPanel({ priorityItemsBody, itemsById: byId, limit });
}

// ---- Move modal + prereq choice modal (still in this entry; will be extracted next) ----

function openMoveModal(movingId) {
  if (!moveModalBackdrop) return;
  invalidateAllItemsCache();
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
  invalidateAllItemsCache();
  pathPickerState.mode = "pick-prereq";
  prereqState.targetId = String(targetId);
  moveState.movingId = null;
  moveState.browseParentId = null;
  moveModalBackdrop.style.display = "flex";
  moveModalBackdrop.setAttribute("aria-hidden", "false");
  loadAllItemsForMoveModal();
}

async function loadAllItemsForMoveModal() {
  // Always fetch fresh list here to avoid stale cache affecting move/prereq pickers,
  // especially in quick successive actions (e2e) or reused servers.
  const items = await listItems({ all: true }).catch(() => []);
  const byId = new Map(items.map((i) => [String(i.id), i]));
  allItemsById = byId;
  allItemsCache.set(byId);
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
          const prereqBtn = isPickPrereq ? `<button type="button" data-pick-prereq="${escapeHtml(cid)}">选择</button>` : "";
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
  try {
    await patchParent(moveState.movingId, parentIdOrEmpty);
  } catch (e) {
    alert(String(e?.message || e || "移动失败。"));
    return;
  }
  invalidateAllItemsCache();
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
  if (formTitle) formTitle.textContent = "Add New Item";
  submitBtn.textContent = "Create";
  titleInput.value = "";
  detailInput.value = "";
  urgencyLevelSelect.value = "0";
  projectStatusSelect.value = "0";
  const defaultParent = filterRootIdInput ? filterRootIdInput.value.trim() : "";
  setFormParentById(defaultParent);
  childIdsInput.value = "";
  prerequisiteIdsInput.value = "";
  deadlineValueInput.value = "";
  syncDeadlineInputControl();
}

form?.addEventListener("submit", async (event) => {
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
  let createdOrUpdated = null;
  try {
    createdOrUpdated = isEdit ? await updateItem(id, payload) : await createItem(payload);
  } catch (e) {
    formMessage.textContent = String(e?.message || e || "Request failed.");
    return;
  }

  // Keep legacy prereq linking flow (PATCH {add}) unchanged for now.
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
      invalidateAllItemsCache();
      await loadItems();
        resetForm();
        return;
      }
      formMessage.textContent = `新建成功，并已关联为 #${targetId} 的前置项目（#${newId}）。`;
    } else {
      formMessage.textContent = "新建成功，但未获取到新项目ID，无法自动关联。";
    }
    resetForm();
    invalidateAllItemsCache();
    await loadItems();
    formModal.close();
    return;
  }

  formMessage.textContent = isEdit ? "Item updated." : "Item created.";
  resetForm();
  invalidateAllItemsCache();
  await loadItems();
  formModal.close();
});

cancelBtn?.addEventListener("click", () => {
  formMessage.textContent = "";
  resetForm();
  formModal.close();
});

urgencyLevelSelect?.addEventListener("change", () => {
  syncDeadlineInputControl();
});

searchBtn?.addEventListener("click", () => {
  loadItems();
});

clearBtn?.addEventListener("click", () => {
  if (filterRootIdInput) filterRootIdInput.value = "";
  updateFilterUpButton();
  filterTitleInput.value = "";
  filterDetailInput.value = "";
  for (const c of statusFilterCheckboxes) c.checked = c.value === "0" || c.value === "1";
  loadItems();
});

filterUpBtn?.addEventListener("click", () => {
  if (!filterRootIdInput) return;
  const rootId = filterRootIdInput.value.trim();
  if (!rootId) return;

  const rootItem = lastItemsById.get(String(rootId));
  const parent = rootItem ? String(rootItem.parent_ids || "").trim() : "";
  filterRootIdInput.value = parent;
  updateFilterUpButton();
  loadItems();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

itemsBody?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.getAttribute("data-action");
  const id = target.getAttribute("data-id");
  if (!action || !id) return;

  if (action === "nav-children") {
    if (filterRootIdInput) filterRootIdInput.value = String(id);
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
    if (!item) return alert("找不到该条目详情（请先刷新列表）");
    detailModal.open(item);
    return;
  }

  if (action === "add-child") {
    itemIdInput.value = "";
    if (formTitle) formTitle.textContent = `Add Child Project (Parent #${id})`;
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
    formModal.open({ title: `新增子项目（上级 #${id}）` });
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

    try {
      await patchStatus(id, status);
    } catch (e) {
      alert(String(e?.message || e || "Update status failed."));
      return;
    }
    invalidateAllItemsCache();
    await loadItems();
    return;
  }

  if (action === "delete") {
    if (!confirm(`Delete item #${id}?`)) return;
    try {
      await deleteItem(id);
    } catch (e) {
      alert(String(e?.message || e || "Delete failed."));
      return;
    }
    invalidateAllItemsCache();
    await loadItems();
    return;
  }

  if (action === "edit") {
    const item = lastItemsById.get(String(id));
    if (!item) return alert("找不到该条目（请先刷新列表）");

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
    if (formTitle) formTitle.textContent = `Edit Item #${id}`;
    submitBtn.textContent = "Save";
    formModal.open({ title: `编辑项目 #${id}` });
  }
});

detailModalCloseBtn?.addEventListener("click", () => detailModal.close());
detailModalBackdrop?.addEventListener("click", (e) => {
  if (e.target === detailModalBackdrop) detailModal.close();
});

moveModalCloseBtn?.addEventListener("click", closeMoveModal);
moveModalBackdrop?.addEventListener("click", (e) => {
  if (e.target === moveModalBackdrop) closeMoveModal();
});

moveModalCrumbs?.addEventListener("click", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  const crumb = t.getAttribute("data-crumb");
  if (!crumb) return;
  moveState.browseParentId = crumb === "root" ? null : crumb;
  renderMoveModal();
});

moveModalList?.addEventListener("click", async (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;

  const pickPrereq = t.getAttribute("data-pick-prereq");
  if (pickPrereq) {
    const targetId = prereqState.targetId;
    if (!targetId) return alert("缺少目标项目，请重试。");
    if (String(pickPrereq) === String(targetId)) return alert("不能选择自己作为前置项目。");

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

    // Close first so the backdrop won't block next interactions.
    closeMoveModal();
    invalidateAllItemsCache();
    await loadItems();
    return;
  }

  const enter = t.getAttribute("data-move-enter");
  if (!enter) return;
  if (pathPickerState.mode === "move") {
    const moving = allItemsById.get(String(moveState.movingId || ""));
    const blocked = moving ? getDescendantsOf(String(moving.id)) : new Set();
    if (moving) blocked.add(String(moving.id));
    if (blocked.has(String(enter))) return alert("不能进入自己或自己的子项目目录。");
  }
  moveState.browseParentId = enter;
  renderMoveModal();
});

moveModalMoveHereBtn?.addEventListener("click", () => {
  if (pathPickerState.mode === "pick-parent") return pickParentHere();
  if (pathPickerState.mode === "pick-prereq") return alert("请在列表里点击“选择”来关联该项目为前置项目。");

  const moving = allItemsById.get(String(moveState.movingId || ""));
  if (moving) {
    const blocked = getDescendantsOf(String(moving.id));
    blocked.add(String(moving.id));
    const dest = moveState.browseParentId ? String(moveState.browseParentId) : "";
    if (dest && blocked.has(dest)) return alert("不能移动到自己或自己的子项目目录。");
  }
  moveProjectTo(moveState.browseParentId ? String(moveState.browseParentId) : "");
});

moveModalMoveRootBtn?.addEventListener("click", () => {
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

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  detailModal.close();
  closeMoveModal();
  formModal.close();
});

function openPrereqChoiceModal(targetId) {
  if (!prereqChoiceBackdrop) return;
  prereqState.targetId = String(targetId);
  const item = lastItemsById.get(String(targetId));
  if (prereqChoiceTitle) prereqChoiceTitle.textContent = item?.title ? `添加前置项目：${item.title}` : "添加前置项目";
  if (prereqChoiceSub) prereqChoiceSub.textContent = `目标项目 #${String(targetId)}`;
  prereqChoiceBackdrop.style.display = "flex";
  prereqChoiceBackdrop.setAttribute("aria-hidden", "false");
}

function closePrereqChoiceModal() {
  if (!prereqChoiceBackdrop) return;
  prereqChoiceBackdrop.style.display = "none";
  prereqChoiceBackdrop.setAttribute("aria-hidden", "true");
}

syncDeadlineInputControl();
renderTableHead({ itemsHeadRow, viewConfig: VIEW_CONFIG });
updateFilterUpButton();

parentPathBtn?.addEventListener("click", () => openParentPathPicker());

await loadItems();
await loadTopPriorityItems();

function setTopPanel(mode) {
  const isPriority = mode === "priority";
  if (priorityPanel) priorityPanel.style.display = isPriority ? "" : "none";
  if (filterPanel) filterPanel.style.display = isPriority ? "none" : "";
  if (switchToPriorityBtn) switchToPriorityBtn.classList.toggle("primary", isPriority);
  if (switchToFilterBtn) switchToFilterBtn.classList.toggle("primary", !isPriority);
  if (switcherTitle) switcherTitle.textContent = isPriority ? "高优先级项目" : "Filter";
  if (switcherSub) {
    switcherSub.textContent = isPriority
      ? "展示全局优先级 TopN（只显示标题，可快速定位到所在目录）"
      : "按目录/状态/标题/详情筛选项目列表";
  }
}

setTopPanel("priority");

switchToPriorityBtn?.addEventListener("click", () => setTopPanel("priority"));
switchToFilterBtn?.addEventListener("click", () => setTopPanel("filter"));

priorityRefreshBtn?.addEventListener("click", () => {
  allItemsCache.clear();
  loadTopPriorityItems();
});
priorityLimitInput?.addEventListener("change", () => loadTopPriorityItems());

priorityItemsBody?.addEventListener("click", async (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  const action = t.getAttribute("data-action");
  const id = t.getAttribute("data-id");
  if (action !== "priority-locate" || !id) return;

  const byId = await getAllItemsCached();
  const item = byId.get(String(id));
  if (!item) return;

  const parentId = String(item.parent_ids || "").trim();
  if (filterRootIdInput) filterRootIdInput.value = parentId;
  ensureStatusChecked(String(item.project_status ?? "0"));

  updateFilterUpButton();
  await loadItems();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

newItemBtn?.addEventListener("click", () => {
  resetForm();
  const pid = filterRootIdInput ? filterRootIdInput.value.trim() : "";
  formModal.open({
    title: "新增项目",
    sub: pid ? `默认上级目录：#${pid}` : "默认上级目录：根目录",
  });
  titleInput.focus();
});

formModalCloseBtn?.addEventListener("click", () => formModal.close());
formModalBackdrop?.addEventListener("click", (e) => {
  if (e.target === formModalBackdrop) formModal.close();
});

prereqChoiceCloseBtn?.addEventListener("click", closePrereqChoiceModal);
prereqChoiceCancelBtn?.addEventListener("click", closePrereqChoiceModal);
prereqChoiceBackdrop?.addEventListener("click", (e) => {
  if (e.target === prereqChoiceBackdrop) closePrereqChoiceModal();
});

prereqChoiceCreateNewBtn?.addEventListener("click", () => {
  const targetId = prereqState.targetId;
  if (!targetId) return;
  prereqState.pendingNewPrereqFor = String(targetId);
  closePrereqChoiceModal();

  itemIdInput.value = "";
  if (formTitle) formTitle.textContent = `新建前置项目（将关联到 #${targetId}）`;
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
  formModal.open({ title: `新建前置项目（关联到 #${targetId}）` });
});

prereqChoiceLinkExistingBtn?.addEventListener("click", () => {
  const targetId = prereqState.targetId;
  if (!targetId) return;
  closePrereqChoiceModal();
  openPrereqPicker(targetId);
});

