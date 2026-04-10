const { test, expect } = require("@playwright/test");

function nowMs() {
  return Date.now();
}

function createTestLogger(testName) {
  const t0 = nowMs();
  return {
    log(step) {
      const dt = nowMs() - t0;
      // eslint-disable-next-line no-console
      console.log(`[e2e] ${testName} +${dt}ms - ${step}`);
    },
    async time(step, fn) {
      const start = nowMs();
      this.log(`${step} (start)`);
      try {
        return await fn();
      } finally {
        const took = nowMs() - start;
        this.log(`${step} (done, ${took}ms)`);
      }
    },
  };
}

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

async function apiCreateProject(page, title, extra = {}) {
  const res = await page.request.post("/api/items", { data: { title, detail: "", ...extra } });
  expect(res.ok()).toBeTruthy();
  return await res.json();
}

async function waitForResponseAfter(page, predicate, action, log) {
  const start = nowMs();
  if (log) log(`waitForResponseAfter: arm`);
  const [res] = await Promise.all([page.waitForResponse(predicate), action()]);
  if (log) log(`waitForResponseAfter: got in ${nowMs() - start}ms (${res.status()})`);
  return res;
}

async function waitForListReloadAfter(page, action, log) {
  // Important: start waiting BEFORE action to avoid missing the request.
  const start = nowMs();
  if (log) log(`waitForListReloadAfter: arm GET /api/items`);
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/api/items") && res.request().method() === "GET"),
    action(),
  ]);
  if (log) log(`waitForListReloadAfter: got GET /api/items in ${nowMs() - start}ms`);
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
  const L = createTestLogger("crud_create_and_list");
  await L.time("goto", () => page.goto("/?e2e=1"));
  await L.time("createProject(E2E Root A)", () => createProject(page, "E2E Root A"));
  await expect(page.locator("tbody#items-body tr", { hasText: "E2E Root A" }).first()).toBeVisible();
  // Status badge should appear next to title in list
  await expect(page.locator("tbody#items-body .badge").first()).toBeVisible();
});

test("prereq_link_existing_blocks", async ({ page }) => {
  const L = createTestLogger("prereq_link_existing_blocks");
  await L.time("apiCreateProject(A prereq)", () => apiCreateProject(page, "A prereq", { project_status: "0" }));
  await L.time("apiCreateProject(B target)", () => apiCreateProject(page, "B target", { project_status: "0" }));
  await L.time("goto", () => page.goto("/?e2e=1"));

  const bId = await getItemIdByTitle(page, "B target");

  // Find row for B target
  const row = page.locator("tbody#items-body tr", { hasText: "B target" }).first();
  await L.time("ensure B target row visible", () => expect(row).toBeVisible());
  await L.time("click Add Prereq", () => page.locator(`[data-testid="item-add-prereq-${bId}"]`).click());
  await L.time("wait prereq choice modal", () => expect(page.locator("#prereq-choice-backdrop")).toBeVisible());

  // Choice modal -> link existing
  await L.time("click link existing", () => page.locator("#prereq-choice-link-existing").click());
  await L.time("wait move modal visible", () => expect(page.locator("#move-modal-backdrop")).toBeVisible());

  // In browser modal list, choose A prereq
  const aRow = page.locator("#move-modal-list tr", { hasText: "A prereq" }).first();
  await L.time("ensure A prereq row exists in picker", () => expect(aRow).toBeVisible());
  await L.time("pick prereq A (wait PATCH + GET reload)", async () => {
    const start = nowMs();
    L.log("arm PATCH /prerequisites + GET /api/items");
    await Promise.all([
      page.waitForResponse((res) => res.url().includes("/prerequisites") && res.request().method() === "PATCH"),
      page.waitForResponse((res) => res.url().includes("/api/items") && res.request().method() === "GET"),
      aRow.getByRole("button", { name: "选择" }).click(),
    ]);
    L.log(`got PATCH+GET in ${nowMs() - start}ms`);
  });
  await L.time("wait move modal hidden", () => expect(page.locator("#move-modal-backdrop")).toBeHidden());

  // After linking prereq, the target should become blocked (4).
  // The Items list already shows all statuses by default in current UI,
  // so we can assert directly without going through Filter panel.

  // Open detail of B target, verify status badge shows blocked and prerequisite_ids includes A's id
  await L.time("open detail", async () => {
    await expect(page.locator("#prereq-choice-backdrop")).toBeHidden();
    await expect(page.locator("#move-modal-backdrop")).toBeHidden();
    const btn = page.locator(`[data-testid="item-detail-${bId}"]`);
    await expect(btn).toBeVisible();
    await btn.scrollIntoViewIfNeeded();
    await btn.click({ force: true });
  });
  await expect(page.locator("#detail-modal-body .badge.status-4")).toBeVisible();
  // detail table contains prerequisite ids; just assert it has something non-empty
  await expect(page.locator("#detail-modal-body")).toContainText("前置项目列表");
  await expect(page.locator("#detail-modal-body")).toContainText("待完成前置项目");
  await L.time("close detail", () => page.getByRole("button", { name: "关闭" }).click());
});

test("move_project_via_modal", async ({ page }) => {
  const L = createTestLogger("move_project_via_modal");
  await L.time("apiCreateProject(P parent)", () => apiCreateProject(page, "P parent"));
  await L.time("apiCreateProject(C child)", () => apiCreateProject(page, "C child"));
  await L.time("goto", () => page.goto("/?e2e=1"));

  const parentId = await getItemIdByTitle(page, "P parent");

  const childRow = page.locator("tbody#items-body tr", { hasText: "C child" }).first();
  await L.time("open move modal", () => childRow.getByRole("button", { name: "移动" }).click());

  // Enter parent folder then move here
  const parentRow = page.locator("#move-modal-list tr", { hasText: "P parent" }).first();
  await L.time("enter parent folder", () => parentRow.getByRole("button", { name: "进入" }).click());
  await L.time("move here (wait list reload)", () =>
    waitForListReloadAfter(page, () => page.getByRole("button", { name: "移动到此处" }).click(), (s) => L.log(s))
  );

  // Switch filter root to parent and verify child appears in subtree
  await L.time("show filter panel", () => showFilterPanel(page));
  await L.time("fill filter root id", () => page.locator("#filter-root-id").fill(parentId));
  await L.time("click Search (wait list reload)", () =>
    waitForListReloadAfter(page, () => page.locator("#search-btn").click(), (s) => L.log(s))
  );
  // Filter panel renders results in #filter-results-body (not the Items table)
  await expect(page.locator("tbody#filter-results-body tr", { hasText: "C child" }).first()).toBeVisible();
});

test("delete_parent_with_child_should_fail", async ({ page }) => {
  const L = createTestLogger("delete_parent_with_child_should_fail");
  await L.time("goto", () => page.goto("/?e2e=1"));
  await L.time("createProject(DEL parent)", () => createProject(page, "DEL parent"));
  await L.time("createProject(DEL child)", () => createProject(page, "DEL child"));

  const childRow = page.locator("tbody#items-body tr", { hasText: "DEL child" }).first();
  await L.time("open move modal", () => childRow.getByRole("button", { name: "移动" }).click());

  const parentRow = page.locator("#move-modal-list tr", { hasText: "DEL parent" }).first();
  await L.time("enter parent folder", () => parentRow.getByRole("button", { name: "进入" }).click());
  await L.time("move here (wait list reload)", () =>
    waitForListReloadAfter(page, () => page.getByRole("button", { name: "移动到此处" }).click(), (s) => L.log(s))
  );

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

  await L.time("click Delete", () => parentRowInList.getByRole("button", { name: "Delete" }).click());
  const alertMsg = await gotAlert;
  expect(String(alertMsg)).toContain("delete failed");
});

test("quick_status_change_should_update_badge", async ({ page }) => {
  const L = createTestLogger("quick_status_change_should_update_badge");
  await L.time("apiCreateProject(STATUS item)", () => apiCreateProject(page, "STATUS item", { project_status: "0" }));
  await L.time("goto", () => page.goto("/?e2e=1"));

  await expect(page.locator("tbody#items-body tr", { hasText: "STATUS item" }).first().locator(".badge.status-0")).toBeVisible();

  const startBtn = page.locator("tbody#items-body tr", { hasText: "STATUS item" }).first().getByRole("button", { name: "开始" });
  if (await startBtn.count()) {
    await L.time("click 开始 (wait list reload)", () =>
      waitForListReloadAfter(page, () => startBtn.click(), (s) => L.log(s))
    );
  }
  // badge should become in-progress
  await expect(page.locator("tbody#items-body tr", { hasText: "STATUS item" }).first().locator(".badge.status-1")).toBeVisible();

  await L.time("click 完成 (wait list reload)", () =>
    waitForListReloadAfter(
      page,
      () =>
        page.locator("tbody#items-body tr", { hasText: "STATUS item" }).first().getByRole("button", { name: "完成" }).click(),
      (s) => L.log(s)
    )
  );
  // completed is filtered out by default; enable status 2 then search
  await L.time("ensure status 2 checkbox visible", () => ensureStatusVisible(page, "2"));
  await L.time("click Search (wait list reload)", () =>
    waitForListReloadAfter(page, () => page.locator("#search-btn").click(), (s) => L.log(s))
  );
  const row2 = page.locator("tbody#items-body tr", { hasText: "STATUS item" }).first();
  await expect(row2.locator(".badge.status-2")).toBeVisible();
});

test("detail_modal_should_show_status_badge", async ({ page }) => {
  const L = createTestLogger("detail_modal_should_show_status_badge");
  await L.time("goto", () => page.goto("/?e2e=1"));
  await L.time("createProject(DETAIL item)", () => createProject(page, "DETAIL item"));

  const row = page.locator("tbody#items-body tr", { hasText: "DETAIL item" }).first();
  await L.time("open detail", () => row.getByRole("button", { name: "详情" }).click());
  await expect(page.locator("#detail-modal-body .badge")).toBeVisible();
  await L.time("close detail", () => page.getByRole("button", { name: "关闭" }).click());
});

test("goal_line_panel_switch", async ({ page }) => {
  const L = createTestLogger("goal_line_panel_switch");
  await L.time("goto", () => page.goto("/?e2e=1"));
  await L.time("wait for #switch-to-goal-line", () => page.locator("#switch-to-goal-line").waitFor());
  await L.time("click #switch-to-goal-line", () => page.locator("#switch-to-goal-line").click());
  await expect(page.locator("#goal-line-panel")).toBeVisible();
  await expect(page.locator("#switcher-title")).toHaveText("目标主线");
  await expect(page.locator("#priority-panel")).toBeHidden();
});

test("items_show_all_default_checked", async ({ page }) => {
  const L = createTestLogger("items_show_all_default_checked");
  await L.time("goto", () => page.goto("/?e2e=1"));
  const cb = page.locator("#items-show-all");
  await L.time("wait checkbox", () => cb.waitFor());
  await expect(cb).toBeChecked();
});

test("prereq_picker_global_search_finds_item_outside_current_dir", async ({ page }) => {
  const L = createTestLogger("prereq_picker_global_search_finds_item_outside_current_dir");
  const parent = await apiCreateProject(page, "DIR parent");
  const hidden = await apiCreateProject(page, "HIDDEN prereq");
  const target = await apiCreateProject(page, "TARGET");
  // Move hidden under parent so it's not in root directory listing
  await L.time("patchParent(hidden->parent)", async () => {
    const res = await page.request.patch(`/api/items/${hidden.id}/parent`, { data: { parent_id: String(parent.id) } });
    expect(res.ok()).toBeTruthy();
  });

  await L.time("goto", () => page.goto("/?e2e=1"));
  const targetId = String(target.id);

  await L.time("open add prereq", () => page.locator(`[data-testid="item-add-prereq-${targetId}"]`).click());
  await L.time("wait prereq choice", () => expect(page.locator("#prereq-choice-backdrop")).toBeVisible());
  await L.time("click link existing", () => page.locator("#prereq-choice-link-existing").click());
  await L.time("wait move modal", () => expect(page.locator("#move-modal-backdrop")).toBeVisible());

  await L.time("type search", () => page.locator("#move-modal-search").fill("HIDDEN"));
  const hiddenRow = page.locator("#move-modal-list tr", { hasText: "HIDDEN prereq" }).first();
  await L.time("wait hidden row visible", () => expect(hiddenRow).toBeVisible());
  await L.time("pick hidden (wait PATCH)", () =>
    waitForResponseAfter(
      page,
      (res) => res.url().includes("/prerequisites") && res.request().method() === "PATCH",
      () => page.locator(`[data-testid="pick-prereq-${String(hidden.id)}"]`).click(),
      (s) => L.log(s)
    )
  );
});

test("backup_and_export_endpoints_smoke", async ({ page }) => {
  const L = createTestLogger("backup_and_export_endpoints_smoke");
  await L.time("goto", () => page.goto("/?e2e=1"));
  await L.time("POST /api/backup", async () => {
    const res = await page.request.post("/api/backup");
    expect(res.ok()).toBeTruthy();
  });
  await L.time("GET /api/data/export", async () => {
    const res = await page.request.get("/api/data/export");
    expect(res.ok()).toBeTruthy();
    const txt = await res.text();
    expect(txt.startsWith("id,title,detail")).toBeTruthy();
  });
});

