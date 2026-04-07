const { test, expect } = require("@playwright/test");

async function createProject(page, title) {
  await page.locator("#new-item-btn").click();
  await expect(page.locator("#form-modal-backdrop")).toBeVisible();
  await page.locator("#title").fill(title);
  const resPromise = page.waitForResponse((res) => res.url().includes("/api/items") && res.request().method() === "POST");
  await page.locator("#submit-btn").click();
  await resPromise;
  // form modal should close on success
  await expect(page.locator("#form-modal-backdrop")).toBeHidden();
}

async function waitForListReload(page) {
  // loadItems() triggers GET /api/items?... after most actions
  await page.waitForResponse((res) => res.url().includes("/api/items") && res.request().method() === "GET");
}

async function getItemIdByTitle(page, title) {
  const res = await page.request.get("/api/items?all=1");
  expect(res.ok()).toBeTruthy();
  const items = await res.json();
  const found = (items || []).find((x) => String(x.title || "") === String(title));
  if (!found) {
    throw new Error(`Cannot find item by title: ${title}`);
  }
  return String(found.id);
}

async function showFilterPanel(page) {
  // Filter panel is hidden by default (priority panel is default).
  if (await page.locator("#filter-panel").isVisible()) return;
  const btn = page.locator("#switch-to-filter");
  if ((await btn.count()) > 0) {
    await btn.click();
  }
  await expect(page.locator("#filter-panel")).toBeVisible();
}

async function ensureStatusVisible(page, statusValue) {
  await showFilterPanel(page);
  const cb = page.locator(`input.status-filter[type="checkbox"][value="${statusValue}"]`);
  if ((await cb.count()) === 0) return;
  if (!(await cb.isChecked())) {
    await cb.check();
  }
}

test("crud_create_and_list", async ({ page }) => {
  await page.goto("/");
  await createProject(page, "E2E Root A");
  await expect(page.locator("tbody#items-body tr", { hasText: "E2E Root A" }).first()).toBeVisible();
  // Status badge should appear next to title in list
  await expect(page.locator("tbody#items-body .badge").first()).toBeVisible();
});

test("prereq_link_existing_blocks", async ({ page }) => {
  await page.goto("/");

  await createProject(page, "A prereq");
  await createProject(page, "B target");

  // Find row for B target
  const row = page.locator("tbody#items-body tr", { hasText: "B target" }).first();
  await row.getByRole("button", { name: "Add Prereq" }).click();

  // Choice modal -> link existing
  await page.getByRole("button", { name: "关联已有项目" }).click();

  // In browser modal list, choose A prereq
  const aRow = page.locator("#move-modal-list tr", { hasText: "A prereq" }).first();
  await aRow.getByRole("button", { name: "选择" }).click();

  // After linking prereq, target becomes blocked (4). Ensure blocked status is visible in list filters.
  await ensureStatusVisible(page, "4");
  await showFilterPanel(page);
  await page.locator("#search-btn").click();

  // Open detail of B target, verify status badge shows blocked and prerequisite_ids includes A's id
  const row2 = page.locator("tbody#items-body tr", { hasText: "B target" }).first();
  await row2.getByRole("button", { name: "详情" }).click();
  await expect(page.locator("#detail-modal-body .badge.status-4")).toBeVisible();
  // detail table contains prerequisite ids; just assert it has something non-empty
  await expect(page.locator("#detail-modal-body")).toContainText("前置项目列表");
  await page.getByRole("button", { name: "关闭" }).click();
});

test("move_project_via_modal", async ({ page }) => {
  await page.goto("/");

  await createProject(page, "P parent");
  await createProject(page, "C child");

  const parentId = await getItemIdByTitle(page, "P parent");

  const childRow = page.locator("tbody#items-body tr", { hasText: "C child" }).first();
  await childRow.getByRole("button", { name: "移动" }).click();

  // Enter parent folder then move here
  const parentRow = page.locator("#move-modal-list tr", { hasText: "P parent" }).first();
  await parentRow.getByRole("button", { name: "进入" }).click();
  await page.getByRole("button", { name: "移动到此处" }).click();

  // Switch filter root to parent and verify child appears in subtree
  await showFilterPanel(page);
  await page.locator("#filter-root-id").fill(parentId);
  await page.locator("#search-btn").click();
  await expect(page.locator("tbody#items-body tr", { hasText: "C child" }).first()).toBeVisible();
});

test("delete_parent_with_child_should_fail", async ({ page }) => {
  await page.goto("/");

  await createProject(page, "DEL parent");
  await createProject(page, "DEL child");

  const childRow = page.locator("tbody#items-body tr", { hasText: "DEL child" }).first();
  await childRow.getByRole("button", { name: "移动" }).click();

  const parentRow = page.locator("#move-modal-list tr", { hasText: "DEL parent" }).first();
  await parentRow.getByRole("button", { name: "进入" }).click();
  await page.getByRole("button", { name: "移动到此处" }).click();
  await waitForListReload(page);

  // Attempt delete parent should alert failure
  const parentRowInList = page.locator("tbody#items-body tr", { hasText: "DEL parent" }).first();
  await expect(parentRowInList).toBeVisible();

  const gotAlert = new Promise((resolve) => {
    /** @param {import('@playwright/test').Dialog} d */
    const handler = async (d) => {
      try {
        if (d.type() === "confirm") {
          await d.accept();
          return;
        }
        const msg = d.message();
        await d.accept();
        page.off("dialog", handler);
        resolve(msg);
      } catch {
        // ignore
      }
    };
    page.on("dialog", handler);
  });

  await parentRowInList.getByRole("button", { name: "Delete" }).click();
  const alertMsg = await gotAlert;
  expect(String(alertMsg)).toContain("delete failed");
});

test("quick_status_change_should_update_badge", async ({ page }) => {
  await page.goto("/");
  await createProject(page, "STATUS item");

  await expect(page.locator("tbody#items-body tr", { hasText: "STATUS item" }).first().locator(".badge.status-0")).toBeVisible();

  const startBtn = page.locator("tbody#items-body tr", { hasText: "STATUS item" }).first().getByRole("button", { name: "开始" });
  if (await startBtn.count()) {
    await startBtn.click();
    await waitForListReload(page);
  }
  // badge should become in-progress
  await expect(page.locator("tbody#items-body tr", { hasText: "STATUS item" }).first().locator(".badge.status-1")).toBeVisible();

  await page.locator("tbody#items-body tr", { hasText: "STATUS item" }).first().getByRole("button", { name: "完成" }).click();
  await waitForListReload(page);
  // completed is filtered out by default; enable status 2 then search
  await ensureStatusVisible(page, "2");
  await page.locator("#search-btn").click();
  await waitForListReload(page);
  const row2 = page.locator("tbody#items-body tr", { hasText: "STATUS item" }).first();
  await expect(row2.locator(".badge.status-2")).toBeVisible();
});

test("detail_modal_should_show_status_badge", async ({ page }) => {
  await page.goto("/");
  await createProject(page, "DETAIL item");

  const row = page.locator("tbody#items-body tr", { hasText: "DETAIL item" }).first();
  await row.getByRole("button", { name: "详情" }).click();
  await expect(page.locator("#detail-modal-body .badge")).toBeVisible();
  await page.getByRole("button", { name: "关闭" }).click();
});

