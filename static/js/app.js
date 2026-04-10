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
import { listItems, createItem, updateItem, deleteItem, patchStatus, patchParent, patchSchedule } from "./api/items.js";

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
const projectCategorySelect = document.getElementById("project-category");
const economicBenefitSelect = document.getElementById("economic-benefit-expectation");
const parentIdsInput = document.getElementById("parent-ids");
const parentPathInput = document.getElementById("parent-path");
const parentPathBtn = document.getElementById("parent-path-btn");
const childIdsInput = document.getElementById("child-ids");
const prerequisiteIdsInput = document.getElementById("prerequisite-ids");
const deadlineValueInput = document.getElementById("deadline-value");
const deadlineValueWrap = document.getElementById("deadline-value-wrap");
const plannedTimeInput = document.getElementById("planned-time");

const filterTitleInput = document.getElementById("filter-title");
const filterDetailInput = document.getElementById("filter-detail");
const filterRootIdInput = document.getElementById("filter-root-id");
const itemsRootIdInput = document.getElementById("items-root-id");
const itemsShowAllCheckbox = document.getElementById("items-show-all");
const filterUpBtn = document.getElementById("filter-up-btn");
const itemsRootBtn = document.getElementById("items-root-btn");
const newInspireBtn = document.getElementById("new-inspire-btn");
const searchBtn = document.getElementById("search-btn");
const clearBtn = document.getElementById("clear-btn");
const filterResultsBody = document.getElementById("filter-results-body");
const statusFilterCheckboxes = Array.from(document.querySelectorAll('input.status-filter[type="checkbox"]'));

const priorityLimitInput = document.getElementById("priority-limit");
const priorityIncludeInProgress = document.getElementById("priority-include-inprogress");
const priorityRefreshBtn = document.getElementById("priority-refresh-btn");
const priorityItemsBody = document.getElementById("priority-items-body");
const priorityPanel = document.getElementById("priority-panel");
const dailyPanel = document.getElementById("daily-panel");
const filterPanel = document.getElementById("filter-panel");
const switchToPriorityBtn = document.getElementById("switch-to-priority");
const switchToDailyBtn = document.getElementById("switch-to-daily");
const switchToFilterBtn = document.getElementById("switch-to-filter");
const switcherTitle = document.getElementById("switcher-title");
const switcherSub = document.getElementById("switcher-sub");

const dailyDateInput = document.getElementById("daily-date");
const dailyPrevBtn = document.getElementById("daily-prev-btn");
const dailyTodayBtn = document.getElementById("daily-today-btn");
const dailyNextBtn = document.getElementById("daily-next-btn");
const dailyRefreshBtn = document.getElementById("daily-refresh-btn");
const dailyItemsBody = document.getElementById("daily-items-body");

const scheduleModalBackdrop = document.getElementById("schedule-modal-backdrop");
const scheduleModalCloseBtn = document.getElementById("schedule-modal-close");
const scheduleModalCancelBtn = document.getElementById("schedule-cancel-btn");
const scheduleModalTitle = document.getElementById("schedule-modal-title");
const scheduleModalSub = document.getElementById("schedule-modal-sub");
const scheduleDateInput = document.getElementById("schedule-date");
const scheduleSaveBtn = document.getElementById("schedule-save-btn");
const schedulePauseBtn = document.getElementById("schedule-pause-btn");
const scheduleClearBtn = document.getElementById("schedule-clear-btn");
const scheduleMessage = document.getElementById("schedule-message");

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

const scheduleState = {
  targetId: null, // string | null
};

let topPanelMode = "priority"; // "priority" | "daily" | "filter"
let locatedItemId = null;

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
  const hasRoot = Boolean(itemsRootIdInput && itemsRootIdInput.value.trim());
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

function getItemsBrowseRootId() {
  return itemsRootIdInput ? String(itemsRootIdInput.value || "").trim() : "";
}

function getFilterSearchParams() {
  const params = new URLSearchParams();
  if (filterRootIdInput && filterRootIdInput.value.trim()) {
    params.set("root_id", filterRootIdInput.value.trim());
  }
  if (statusFilterCheckboxes.length > 0) {
    const checked = statusFilterCheckboxes.filter((c) => c.checked).map((c) => c.value);
    if (checked.length > 0) params.set("statuses", checked.join(","));
  }
  if (filterTitleInput.value.trim()) params.set("title", filterTitleInput.value.trim());
  if (filterDetailInput.value.trim()) params.set("detail", filterDetailInput.value.trim());
  return params;
}

async function loadItems() {
  const rootId = getItemsBrowseRootId();
  const showAll = Boolean(itemsShowAllCheckbox?.checked);
  const statuses = showAll ? [] : ["0", "1", "3"]; // hide 已完成(2) / 阻塞(4) / 中止(5)

  const items = await listItems({
    parentId: rootId,
    statuses,
  }).catch((e) => {
    alert(String(e?.message || e || "加载失败"));
    return [];
  });

  lastItemsById = new Map(items.map((i) => [String(i.id), i]));
  updateFilterUpButton();
  await updateItemsDirHint();
  renderItemsTable({ itemsBody, items, viewConfig: VIEW_CONFIG, locatedItemId });

  if (locatedItemId != null && itemsBody) {
    const sel = String(locatedItemId);
    const row = itemsBody.querySelector(`tr[data-item-id="${sel}"]`);
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => {
        row.classList.remove("locate-highlight");
      }, 3500);
    }
    locatedItemId = null;
  }
}

async function loadFilterResults() {
  if (!filterResultsBody) return;
  const params = getFilterSearchParams();

  // Filter panel results should support global search: when root_id is empty, search all items.
  const rootId = params.get("root_id") || "";
  const all = !String(rootId).trim();

  const statuses = (params.get("statuses") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const items = await listItems({
    all,
    rootId,
    title: params.get("title") || "",
    detail: params.get("detail") || "",
    statuses,
  }).catch((e) => {
    filterResultsBody.innerHTML = `<tr><td colspan="2">加载失败：${escapeHtml(String(e?.message || e || ""))}</td></tr>`;
    return [];
  });

  if (!Array.isArray(items) || items.length === 0) {
    filterResultsBody.innerHTML = `<tr><td colspan="2">（无匹配项目）</td></tr>`;
    return;
  }

  filterResultsBody.innerHTML = items
    .map((it) => {
      const id = String(it.id);
      const title = escapeHtml(it.title || "");
      const badge = renderProjectStatusBadge(it);
      return `
        <tr>
          <td><div class="cell-title">${badge}<span>${title}</span> <span class="muted">#${escapeHtml(id)}</span></div></td>
          <td class="actions">
            <button type="button" data-action="filter-locate" data-id="${escapeHtml(id)}">定位</button>
          </td>
        </tr>
      `;
    })
    .join("");
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
  if (cached) {
    allItemsById = cached;
    return cached;
  }

  const items = await listItems({ all: true }).catch(() => []);
  const byId = new Map(items.map((i) => [String(i.id), i]));
  allItemsById = byId;
  allItemsCache.set(byId);
  return byId;
}

async function updateItemsDirHint() {
  if (!itemsDirHint) return;
  const rid = itemsRootIdInput ? itemsRootIdInput.value.trim() : "";
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
  const includeInProgress = Boolean(priorityIncludeInProgress?.checked);

  let limit = 5;
  if (priorityLimitInput) {
    const v = String(priorityLimitInput.value || "").trim();
    const n = v && /^\d+$/.test(v) ? Number(v) : 5;
    limit = Math.max(1, Math.min(50, n));
  }

  renderPriorityPanel({ priorityItemsBody, itemsById: byId, limit, includeInProgress });
}

function yyyyMmDd(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(yyyy, deltaDays) {
  const raw = String(yyyy || "").trim();
  if (!raw) return "";
  const dt = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return "";
  dt.setDate(dt.getDate() + Number(deltaDays || 0));
  return yyyyMmDd(dt);
}

function isYmdBefore(a, b) {
  const aa = String(a || "").trim();
  const bb = String(b || "").trim();
  if (!aa || !bb) return false;
  // YYYY-MM-DD is lexicographically sortable
  return aa < bb;
}

async function runScheduleRolloverOncePerDay() {
  // If a project was scheduled for a past date and still not done, roll it forward to today.
  // Run at most once per day to avoid repeated patching.
  const today = yyyyMmDd(new Date());
  if (!today) return;

  const key = "myweb:schedule_rollover_ran_at";
  try {
    const last = String(window.localStorage.getItem(key) || "").trim();
    if (last === today) return;
  } catch {
    // ignore storage errors; fallthrough to run once in this session
  }

  const byId = await getAllItemsCached();
  const overdue = Array.from(byId.values()).filter((it) => {
    const d = String(it?.planned_execute_date || "").trim();
    if (!d) return false;
    if (!isYmdBefore(d, today)) return false;
    const st = String(it?.project_status ?? "0");
    // 今天以前的日程：计划中/进行中顺延一天，保留状态
    return st === "1" || st === "3";
  });

  if (overdue.length > 0) {
    for (const it of overdue) {
      const id = String(it.id);
      const d = String(it.planned_execute_date || "").trim();
      const next = addDays(d, 1);
      if (!next) continue;
      try {
        await patchSchedule(id, next, { keepStatus: true });
      } catch {
        // ignore individual failures
      }
    }
    invalidateAllItemsCache();
  }

  try {
    window.localStorage.setItem(key, today);
  } catch {
    // ignore
  }
}

async function loadDailyItems() {
  if (!dailyItemsBody) return;
  const date = String(dailyDateInput?.value || "").trim();
  if (!date) {
    dailyItemsBody.innerHTML = `<tr><td colspan="2">请选择日期。</td></tr>`;
    return;
  }
  const byId = await getAllItemsCached();
  const items = Array.from(byId.values()).filter((it) => String(it?.planned_execute_date || "").trim() === date);
  items.sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
  if (items.length === 0) {
    dailyItemsBody.innerHTML = `<tr><td colspan="2">（当天暂无计划项目）</td></tr>`;
    return;
  }
  dailyItemsBody.innerHTML = items
    .map((it) => {
      const id = String(it.id);
      const title = escapeHtml(it.title || "");
      const badge = renderProjectStatusBadge(it);
      const st = String(it.project_status ?? "0");
      const pauseBtn =
        st === "1"
          ? `<button type="button" data-action="daily-pause" data-id="${escapeHtml(id)}">暂停</button>`
          : "";
      const startBtn =
        st === "3"
          ? `<button type="button" data-action="daily-start" data-id="${escapeHtml(id)}">开始</button>`
          : "";
      const completeBtn =
        st === "2"
          ? `<button type="button" data-action="daily-undo-complete" data-id="${escapeHtml(id)}">撤销完成</button>`
          : `<button type="button" data-action="daily-complete" data-id="${escapeHtml(id)}">完成</button>`;
      return `
        <tr>
          <td><div class="cell-title">${badge}<span>${title}</span> <span class="muted">#${escapeHtml(id)}</span></div></td>
          <td class="actions">
            <button type="button" data-action="daily-locate" data-id="${escapeHtml(id)}">定位</button>
            <button type="button" data-action="daily-detail" data-id="${escapeHtml(id)}">详情</button>
            <button type="button" data-action="daily-reschedule" data-id="${escapeHtml(id)}">改期</button>
            ${startBtn}
            ${pauseBtn}
            ${completeBtn}
          </td>
        </tr>
      `;
    })
    .join("");
}

function openScheduleModal(targetId, { defaultDate } = {}) {
  if (!scheduleModalBackdrop) return;
  scheduleState.targetId = String(targetId);
  const item = lastItemsById.get(String(targetId));
  if (scheduleModalTitle) scheduleModalTitle.textContent = item?.title ? `加入日程：${item.title}` : "加入日程";
  if (scheduleModalSub) scheduleModalSub.textContent = `项目 #${String(targetId)}`;
  if (scheduleMessage) scheduleMessage.textContent = "";
  if (schedulePauseBtn) {
    schedulePauseBtn.hidden = String(item?.project_status ?? "0") !== "1";
  }
  const initial =
    String(defaultDate || "").trim() ||
    String(item?.planned_execute_date || "").trim() ||
    yyyyMmDd(new Date());
  if (scheduleDateInput) scheduleDateInput.value = initial;
  scheduleModalBackdrop.style.display = "flex";
  scheduleModalBackdrop.setAttribute("aria-hidden", "false");
}

function closeScheduleModal() {
  if (!scheduleModalBackdrop) return;
  scheduleModalBackdrop.style.display = "none";
  scheduleModalBackdrop.setAttribute("aria-hidden", "true");
  scheduleState.targetId = null;
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
  projectStatusSelect.value = "3";
  if (projectCategorySelect) projectCategorySelect.value = "2";
  if (economicBenefitSelect) economicBenefitSelect.value = "4";
  const defaultParent = itemsRootIdInput ? itemsRootIdInput.value.trim() : "";
  setFormParentById(defaultParent);
  childIdsInput.value = "";
  prerequisiteIdsInput.value = "";
  deadlineValueInput.value = "";
  if (plannedTimeInput) plannedTimeInput.value = "";
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
    project_category: projectCategorySelect ? projectCategorySelect.value : "2",
    economic_benefit_expectation: economicBenefitSelect ? economicBenefitSelect.value : "4",
    planned_time: plannedTimeInput ? plannedTimeInput.value.trim() : "",
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
    const msg = String(e?.message || e || "Request failed.");
    const hint =
      msg.includes("进行中项目数量已达上限") || msg.includes("上限")
        ? " 可将部分「进行中」改为「计划中」后再试。"
        : "";
    formMessage.textContent = msg + hint;
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
  loadFilterResults();
});

clearBtn?.addEventListener("click", () => {
  if (filterRootIdInput) filterRootIdInput.value = "";
  updateFilterUpButton();
  filterTitleInput.value = "";
  filterDetailInput.value = "";
  for (const c of statusFilterCheckboxes) c.checked = c.value === "0" || c.value === "1" || c.value === "3";
  if (filterResultsBody) {
    filterResultsBody.innerHTML = `<tr><td colspan="2" class="muted">（请先点击 Search）</td></tr>`;
  }
});

filterUpBtn?.addEventListener("click", () => {
  if (!itemsRootIdInput) return;
  const rootId = itemsRootIdInput.value.trim();
  if (!rootId) return;

  const rootItem = lastItemsById.get(String(rootId));
  const parent = rootItem ? String(rootItem.parent_ids || "").trim() : "";
  itemsRootIdInput.value = parent;
  updateFilterUpButton();
  loadItems();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

itemsRootBtn?.addEventListener("click", async () => {
  if (itemsRootIdInput) itemsRootIdInput.value = "";
  updateFilterUpButton();
  await loadItems();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

itemsShowAllCheckbox?.addEventListener("change", () => {
  loadItems();
});

itemsBody?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.getAttribute("data-action");
  const id = target.getAttribute("data-id");
  if (!action || !id) return;

  if (action === "nav-children") {
    if (itemsRootIdInput) itemsRootIdInput.value = String(id);
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
    projectStatusSelect.value = "3";
    if (projectCategorySelect) projectCategorySelect.value = "2";
    if (economicBenefitSelect) economicBenefitSelect.value = "4";
    setFormParentById(id);
    childIdsInput.value = "";
    prerequisiteIdsInput.value = "";
    deadlineValueInput.value = "";
    if (plannedTimeInput) plannedTimeInput.value = "";
    syncDeadlineInputControl();
    titleInput.focus();
    formModal.open({ title: `新增子项目（上级 #${id}）` });
    return;
  }

  if (action === "add-prereq") {
    openPrereqChoiceModal(id);
    return;
  }

  if (action === "add-schedule") {
    const defaultDate = String(dailyDateInput?.value || "").trim() || yyyyMmDd(new Date());
    openScheduleModal(id, { defaultDate });
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
      const updated = await patchStatus(id, status);
      // - 开始：默认加入今日日程（若未设置执行日期）
      // - 暂停（计划中）：保留当前计划执行日期
      if (status === "1") {
        const hasDate = String(updated?.planned_execute_date || "").trim();
        if (!hasDate) {
          await patchSchedule(id, yyyyMmDd(new Date()));
        }
      }
    } catch (e) {
      const msg = String(e?.message || e || "Update status failed.");
      const hint =
        msg.includes("进行中项目数量已达上限") || msg.includes("上限")
          ? "\n\n可将部分「进行中」项目改为「计划中」后再试。"
          : "";
      alert(msg + hint);
      return;
    }
    invalidateAllItemsCache();
    await loadItems();
    await loadTopPriorityItems();
    await loadDailyItems();
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
    projectStatusSelect.value = String(item.project_status ?? "3");
    if (projectCategorySelect) projectCategorySelect.value = String(item.project_category ?? "2");
    if (economicBenefitSelect) economicBenefitSelect.value = String(item.economic_benefit_expectation ?? "4");
    setFormParentById(item.parent_ids || "");
    childIdsInput.value = item.child_ids || "";
    prerequisiteIdsInput.value = item.prerequisite_ids || "";
    deadlineValueInput.value = item.deadline_value || "";
    if (plannedTimeInput) plannedTimeInput.value = String(item.planned_time || "").trim();
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
  closeScheduleModal();
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

// Daily maintenance: roll overdue scheduled items forward once per day.
await runScheduleRolloverOncePerDay();

await loadItems();
await loadTopPriorityItems();
if (dailyDateInput && !String(dailyDateInput.value || "").trim()) {
  dailyDateInput.value = yyyyMmDd(new Date());
}
await loadDailyItems();

function setTopPanel(mode) {
  topPanelMode = mode;
  const isPriority = mode === "priority";
  const isDaily = mode === "daily";
  const isFilter = mode === "filter";
  if (priorityPanel) priorityPanel.style.display = isPriority ? "" : "none";
  if (dailyPanel) dailyPanel.style.display = isDaily ? "" : "none";
  if (filterPanel) filterPanel.style.display = isFilter ? "" : "none";
  if (switchToPriorityBtn) switchToPriorityBtn.classList.toggle("primary", isPriority);
  if (switchToDailyBtn) switchToDailyBtn.classList.toggle("primary", isDaily);
  if (switchToFilterBtn) switchToFilterBtn.classList.toggle("primary", isFilter);
  if (switcherTitle) switcherTitle.textContent = isPriority ? "高优先级项目" : isDaily ? "日程面板" : "Filter";
  if (switcherSub) {
    switcherSub.textContent = isPriority
      ? "展示全局优先级 TopN（只显示标题，可快速定位到所在目录）"
      : isDaily
        ? "选择日期，查看计划在当天执行的项目（含阻塞项目）"
        : "按目录/状态/标题/详情筛选项目列表";
  }
}

setTopPanel("priority");

switchToPriorityBtn?.addEventListener("click", () => setTopPanel("priority"));
switchToDailyBtn?.addEventListener("click", () => {
  setTopPanel("daily");
  loadDailyItems();
});
switchToFilterBtn?.addEventListener("click", () => setTopPanel("filter"));

priorityRefreshBtn?.addEventListener("click", () => {
  allItemsCache.clear();
  loadTopPriorityItems();
});
priorityLimitInput?.addEventListener("change", () => loadTopPriorityItems());
priorityIncludeInProgress?.addEventListener("change", () => loadTopPriorityItems());

dailyDateInput?.addEventListener("change", () => loadDailyItems());
dailyRefreshBtn?.addEventListener("click", () => {
  allItemsCache.clear();
  loadDailyItems();
});
dailyTodayBtn?.addEventListener("click", () => {
  if (dailyDateInput) dailyDateInput.value = yyyyMmDd(new Date());
  loadDailyItems();
});
dailyPrevBtn?.addEventListener("click", () => {
  if (!dailyDateInput) return;
  dailyDateInput.value = addDays(dailyDateInput.value, -1);
  loadDailyItems();
});
dailyNextBtn?.addEventListener("click", () => {
  if (!dailyDateInput) return;
  dailyDateInput.value = addDays(dailyDateInput.value, 1);
  loadDailyItems();
});

filterResultsBody?.addEventListener("click", async (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  const action = t.getAttribute("data-action");
  const id = t.getAttribute("data-id");
  if (action !== "filter-locate" || !id) return;

  const byId = await getAllItemsCached();
  const item = byId.get(String(id));
  if (!item) return;

  // Locate: switch Items list to the item's parent folder (so the item is visible there).
  const parentId = String(item.parent_ids || "").trim();
  if (itemsRootIdInput) itemsRootIdInput.value = parentId;
  locatedItemId = String(id);
  updateFilterUpButton();
  await loadItems();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

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
  if (itemsRootIdInput) itemsRootIdInput.value = parentId;
  locatedItemId = String(id);
  ensureStatusChecked(String(item.project_status ?? "0"));

  updateFilterUpButton();
  await loadItems();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

newItemBtn?.addEventListener("click", () => {
  resetForm();
  const pid = itemsRootIdInput ? itemsRootIdInput.value.trim() : "";
  formModal.open({
    title: "新增项目",
    sub: pid ? `默认上级目录：#${pid}` : "默认上级目录：根目录",
  });
  titleInput.focus();
});

newInspireBtn?.addEventListener("click", () => {
  resetForm();
  if (projectCategorySelect) projectCategorySelect.value = "3";
  projectStatusSelect.value = "0";
  const pid = itemsRootIdInput ? itemsRootIdInput.value.trim() : "";
  formModal.open({
    title: "新增灵感项目",
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

prereqChoiceCreateNewBtn?.addEventListener("click", async () => {
  const targetId = prereqState.targetId;
  if (!targetId) return;
  prereqState.pendingNewPrereqFor = String(targetId);
  closePrereqChoiceModal();

  // Ensure path label can resolve (setFormParentById depends on allItemsById).
  await getAllItemsCached();
  const targetItem = lastItemsById.get(String(targetId));
  const defaultParentId = targetItem ? String(targetItem.parent_ids || "").trim() : "";

  itemIdInput.value = "";
  if (formTitle) formTitle.textContent = `新建前置项目（将关联到 #${targetId}）`;
  submitBtn.textContent = "Create";
  titleInput.value = "";
  detailInput.value = "";
  urgencyLevelSelect.value = "0";
  projectStatusSelect.value = "3";
  if (projectCategorySelect) projectCategorySelect.value = "2";
  if (economicBenefitSelect) economicBenefitSelect.value = "4";
  setFormParentById(defaultParentId);
  childIdsInput.value = "";
  prerequisiteIdsInput.value = "";
  deadlineValueInput.value = "";
  if (plannedTimeInput) plannedTimeInput.value = "";
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

dailyItemsBody?.addEventListener("click", async (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  const action = t.getAttribute("data-action");
  const id = t.getAttribute("data-id");
  if (!action || !id) return;

  if (action === "daily-locate") {
    const byId = await getAllItemsCached();
    const item = byId.get(String(id));
    if (!item) return;
    const parentId = String(item.parent_ids || "").trim();
    if (itemsRootIdInput) itemsRootIdInput.value = parentId;
    locatedItemId = String(id);
    ensureStatusChecked(String(item.project_status ?? "0"));
    updateFilterUpButton();
    await loadItems();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (action === "daily-reschedule") {
    const defaultDate = String(dailyDateInput?.value || "").trim() || yyyyMmDd(new Date());
    openScheduleModal(id, { defaultDate });
    return;
  }

  if (action === "daily-pause") {
    try {
      await patchStatus(id, "3");
    } catch (e) {
      const msg = String(e?.message || e || "暂停失败");
      const hint =
        msg.includes("进行中项目数量已达上限") || msg.includes("上限")
          ? "\n\n可将部分「进行中」项目改为「计划中」后再试。"
          : "";
      alert(msg + hint);
      return;
    }
    invalidateAllItemsCache();
    await loadItems();
    await loadTopPriorityItems();
    await loadDailyItems();
    return;
  }

  if (action === "daily-start") {
    const byId = await getAllItemsCached();
    const item = byId.get(String(id));
    if (!item) return;
    if (String(item.project_status ?? "0") === "4") {
      const blockedBy = String(item.blocked_by_ids ?? "").trim();
      const msg = blockedBy
        ? `该项目处于阻塞状态，当前被以下前置项目阻塞：${blockedBy}。请先完成前置项目。`
        : "该项目处于阻塞状态，请先完成前置项目。";
      alert(msg);
      return;
    }
    try {
      const updated = await patchStatus(id, "1");
      const hasDate = String(updated?.planned_execute_date || "").trim();
      if (!hasDate) {
        await patchSchedule(id, yyyyMmDd(new Date()));
      }
    } catch (e) {
      const msg = String(e?.message || e || "开始失败");
      const hint =
        msg.includes("进行中项目数量已达上限") || msg.includes("上限")
          ? "\n\n可将部分「进行中」项目改为「计划中」后再试。"
          : "";
      alert(msg + hint);
      return;
    }
    invalidateAllItemsCache();
    await loadItems();
    await loadTopPriorityItems();
    await loadDailyItems();
    return;
  }

  if (action === "daily-undo-complete") {
    try {
      await patchStatus(id, "3");
    } catch (e) {
      alert(String(e?.message || e || "撤销完成失败"));
      return;
    }
    invalidateAllItemsCache();
    await loadItems();
    await loadTopPriorityItems();
    await loadDailyItems();
    return;
  }

  if (action === "daily-detail") {
    const byId = await getAllItemsCached();
    const item = byId.get(String(id));
    if (!item) return alert("找不到该条目详情（请先刷新列表）");
    detailModal.open(item);
    return;
  }

  if (action === "daily-complete") {
    const byId = await getAllItemsCached();
    const item = byId.get(String(id));
    if (!item) return;
    if (String(item.project_status ?? "0") === "4") {
      const blockedBy = String(item.blocked_by_ids ?? "").trim();
      const msg = blockedBy
        ? `该项目处于阻塞状态，当前被以下前置项目阻塞：${blockedBy}。请先完成前置项目。`
        : "该项目处于阻塞状态，请先完成前置项目。";
      alert(msg);
      return;
    }
    try {
      await patchStatus(id, "2");
    } catch (e) {
      alert(String(e?.message || e || "完成失败"));
      return;
    }
    invalidateAllItemsCache();
    await loadItems();
    await loadTopPriorityItems();
    await loadDailyItems();
    return;
  }
});

scheduleSaveBtn?.addEventListener("click", async () => {
  const targetId = scheduleState.targetId;
  if (!targetId) return;
  const date = String(scheduleDateInput?.value || "").trim();
  try {
    await patchSchedule(targetId, date);
  } catch (e) {
    if (scheduleMessage) scheduleMessage.textContent = String(e?.message || e || "保存失败");
    return;
  }
  invalidateAllItemsCache();
  await loadItems();
  await loadTopPriorityItems();
  await loadDailyItems();
  closeScheduleModal();
});

schedulePauseBtn?.addEventListener("click", async () => {
  const targetId = scheduleState.targetId;
  if (!targetId) return;
  try {
    await patchStatus(targetId, "3");
  } catch (e) {
    const msg = String(e?.message || e || "暂停失败");
    const hint =
      msg.includes("进行中项目数量已达上限") || msg.includes("上限")
        ? "\n\n可将部分「进行中」项目改为「计划中」后再试。"
        : "";
    if (scheduleMessage) scheduleMessage.textContent = msg + hint;
    else alert(msg + hint);
    return;
  }
  invalidateAllItemsCache();
  await loadItems();
  await loadTopPriorityItems();
  await loadDailyItems();
  closeScheduleModal();
});

scheduleClearBtn?.addEventListener("click", async () => {
  const targetId = scheduleState.targetId;
  if (!targetId) return;
  try {
    await patchSchedule(targetId, "");
  } catch (e) {
    if (scheduleMessage) scheduleMessage.textContent = String(e?.message || e || "清空失败");
    return;
  }
  invalidateAllItemsCache();
  await loadItems();
  await loadTopPriorityItems();
  await loadDailyItems();
  closeScheduleModal();
});

scheduleModalCloseBtn?.addEventListener("click", () => closeScheduleModal());
scheduleModalCancelBtn?.addEventListener("click", () => closeScheduleModal());
scheduleModalBackdrop?.addEventListener("click", (e) => {
  if (e.target === scheduleModalBackdrop) closeScheduleModal();
});

