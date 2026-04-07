## 测试文档（功能点 + 用例映射）

目标：用一个**独立的测试数据文件** `testdatabase.csv` 运行测试，不影响真实数据 `database.csv`。

后端测试框架：`pytest`（Flask `test_client()`）  
前端综合功能测试：`Playwright`（Node）

数据文件覆盖方式：设置环境变量 `MYWEB_DATA_FILE=<path>`（后端会改用该 CSV）。

---

## 功能点 1：基础 CRUD（创建 + 列表读取）

- **说明**：能创建项目；默认列表（不传 `root_id`/`all`）只显示根项目（无上级）。
- **单元测试（pytest）**：`tests/unit/test_api.py::test_create_and_list_root_only`
  - **步骤**：POST 创建 1 个根项目；GET `/api/items`
  - **期望**：返回数组包含该项目；字段含 `id/created_at/updated_at`
- **功能测试（Playwright）**：`tests/e2e/project.spec.js::crud_create_and_list`
  - **步骤**：打开首页；填写标题；提交创建；列表出现该标题
  - **期望**：列表出现一行；标题旁显示状态徽标

---

## 功能点 2：前置项目阻塞规则（blocked_by_ids 自动维护）

- **说明**：若某项目存在未完成前置项目，则该项目自动变为 `4-阻塞`，并维护 `blocked_by_ids`；当所有前置项目完成后，自动转为 `0-待开始`。
- **单元测试（pytest）**：`tests/unit/test_api.py::test_prereq_blocking_rule`
  - **步骤**：创建 prereq 项目（待开始）；创建 target 项目并设置 `prerequisite_ids=prereq`；检查 target 变阻塞；将 prereq 改为完成；检查 target 解除阻塞
  - **期望**：阻塞时 `project_status=4` 且 `blocked_by_ids` 包含 prereq id；解除后 `project_status=0` 且 `blocked_by_ids` 为空
- **功能测试（Playwright）**：`tests/e2e/project.spec.js::prereq_link_existing_blocks`
  - **步骤**：创建 A、B；对 B 点 `Add Prereq` → `关联已有项目` → 选择 A；打开 B 详情
  - **期望**：B 详情里 `前置项目列表` 包含 A 的 id；状态显示为“阻塞”徽标

---

## 功能点 3：移动项目（修改 parent_ids + 单父约束）

- **说明**：移动接口 `PATCH /api/items/<id>/parent` 能修改上级目录；并强制单父节点（最多一个上级）。
- **单元测试（pytest）**：`tests/unit/test_api.py::test_move_parent_api`
  - **步骤**：创建 parent 与 child；调用 PATCH parent 接口把 child 移动到 parent；GET 列表（`all=1`）验证 child 的 `parent_ids`；再移动回根目录
  - **期望**：`parent_ids` 正确更新；移动回根目录后为空
- **功能测试（Playwright）**：`tests/e2e/project.spec.js::move_project_via_modal`
  - **步骤**：创建 parent 与 child；在 child 行点击 `移动`；进入 parent；点击 `移动到此处`；在详情验证 path/parent_ids
  - **期望**：child 的 `上级项目列表/Path` 更新；列表中仍可看到 child（用 `all=1` API 验证或通过“下级项目”导航验证）

---

## 功能点 4：删除约束（有子项目则禁止删除）

- **说明**：删除项目时，如果它仍有子项目，应返回 400 并提示先删除子项目。
- **单元测试（pytest）**：`tests/unit/test_api.py::test_delete_fails_when_has_children`
  - **步骤**：创建 parent/child；把 child 移动到 parent；尝试删除 parent
  - **期望**：返回 `400` 且错误包含 `delete failed`
- **功能测试（Playwright）**：`tests/e2e/project.spec.js::delete_parent_with_child_should_fail`
  - **步骤**：创建 parent/child；移动 child 到 parent；点击删除 parent
  - **期望**：弹窗提示删除失败（包含 `delete failed`）

---

## 功能点 5：追加前置项目接口（PATCH prerequisites）

- **说明**：`PATCH /api/items/<id>/prerequisites` 能把已有项目追加到 `prerequisite_ids`，重复追加会去重。
- **单元测试（pytest）**：`tests/unit/test_api.py::test_add_prereq_endpoint_appends_and_dedups`
  - **步骤**：创建 A/B；对 B 追加 A 两次
  - **期望**：B 的 `prerequisite_ids` 只包含一次 A
- **功能测试（Playwright）**：复用 `tests/e2e/project.spec.js::prereq_link_existing_blocks`
  - **步骤**：通过 UI“关联已有项目”选择前置
  - **期望**：接口成功写回，并触发阻塞状态

---

## 功能点 6：快捷状态切换（开始/完成）+ 状态徽标可视化

- **说明**：行内按钮可快速切换状态；列表与详情里有状态颜色徽标（badge）。
- **单元测试（pytest）**：`tests/unit/test_api.py::test_status_3_normalizes_to_0`
  - **步骤**：创建一个 `project_status=3` 的项目
  - **期望**：被归一化为 `0`
- **功能测试（Playwright）**
  - `tests/e2e/project.spec.js::quick_status_change_should_update_badge`
  - `tests/e2e/project.spec.js::detail_modal_should_show_status_badge`

## 如何运行

### 后端单元测试（pytest）

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install flask pytest
pytest -q
```

### 前端综合测试（Playwright）

```bash
npm init -y
npm i -D @playwright/test
npx playwright install
npx playwright test
```

