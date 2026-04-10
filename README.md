## 项目管理平台（Flask + CSV）

一个轻量的“项目管理/任务管理”Demo：后端用 Flask 提供 REST API，前端使用 Jinja 模板（`templates/index.html`）+ 原生 ES Modules（`static/js/app.js`）渲染与交互，数据持久化在 `database.csv`（CSV 作为简易数据库）。

## 项目路径与文件结构

项目根目录（示例）：`/Users/wenhaoye/github/MyWeb`

- **后端**
  - `app.py`: Flask 应用启动入口（支持 `FLASK_RUN_PORT`、`MYWEB_DEBUG`）
  - `backend/`: 后端模块拆分（路由/业务/归一化/CSV 存储/图算法）
- **前端**
  - `templates/index.html`: 页面主体（extends `templates/base.html`，并 include modal partials）
  - `templates/base.html`: 基础 head/CSS/JS 引用
  - `templates/partials/modals/`: 弹窗片段（form/detail/move/prereq_choice/schedule/goal_new_choice）
  - `static/styles/app.css`: 页面样式（从模板内联抽离）
  - `static/js/app.js`: 前端入口（ES Modules 组装 API/state/UI）
  - `static/js/api/`: REST API client（fetch 封装）
  - `static/js/state/`: 前端状态/缓存（如 all-items 缓存）
  - `static/js/ui/`: 渲染/格式化/徽章与 modal 组件（含 `goalLinePanel.js` 目标主线面板）
- **数据**
  - `database.csv`: 项目数据存储（首行是表头，后续为记录）
- **备份**
  - `bak/`: 自动/手动备份输出目录（`*.csv` + `backup_state.json`）
  - `history_backup/`: 旧内容/历史备份（不参与当前 Demo 运行）

## 运行方式

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install flask
python3 app.py
```

打开 `http://127.0.0.1:5000`

## 如何运行测试

测试使用独立 CSV，不会影响真实数据：
- **数据文件覆盖**：设置环境变量 `MYWEB_DATA_FILE=/path/to/testdatabase.csv`
- **强隔离（推荐）**：测试运行会设置 `MYWEB_TEST_MODE=1`，若未正确覆盖数据文件导致指向真实 `database.csv`，程序将直接报错退出

### 后端单元测试（pytest）

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install flask pytest
pytest -q
```

### 前端综合功能测试（Playwright）

Playwright 测试在 `tests/e2e/` 下，默认会启动一个测试用 Flask（端口 `5001`）并使用 `tests/e2e/testdatabase.csv`。

```bash
cd tests/e2e
npm i
npx playwright test
```

#### 当前 e2e 用例覆盖的功能点（`tests/e2e/project.spec.js`）

- **`crud_create_and_list`**：从 UI 新建项目，验证 Items 列表出现该条目与状态徽章。
- **`prereq_link_existing_blocks`**：从 UI 给项目关联“已有前置项目”，验证目标项目进入阻塞状态，并能在详情里看到前置/阻塞信息。
- **`move_project_via_modal`**：通过“移动”弹窗把子项目移动到父项目目录下，并通过 Filter 面板按目录过滤验证子项目可见。
- **`delete_parent_with_child_should_fail`**：父项目存在子项目时，UI 点击删除应失败并弹出错误提示。
- **`quick_status_change_should_update_badge`**：用列表快捷按钮切换状态（开始/完成），并验证徽章更新（完成后需在 Filter 面板勾选“已完成”再 Search）。
- **`detail_modal_should_show_status_badge`**：详情弹窗能展示状态徽章。
- **`goal_line_panel_switch`**：顶部切换到“目标主线”面板，验证面板显示与标题更新。
- **`items_show_all_default_checked`**：Items 区“显示全部”默认勾选。
- **`prereq_picker_global_search_finds_item_outside_current_dir`**：前置项目选择弹窗输入搜索词时，支持全局搜索并能选到不在当前目录的项目。
- **`backup_and_export_endpoints_smoke`**：备份与导出接口 smoke（`POST /api/backup`、`GET /api/data/export`）。

说明：
- e2e 用例访问页面时会使用 `/?e2e=1`，跳过一些非关键启动流程以提升测试稳定性。
- 默认会使用系统 Chrome（Playwright 配置 `channel: "chrome"`），用于避免下载 Playwright 浏览器。
- 若要观察操作过程：`npx playwright test --headed` 或 `npx playwright test --debug`

## 数据模型（CSV 字段）

`database.csv` 的列头由后端自动维护（缺列会自动补齐并回写）。当前字段：

- **基础字段**
  - `id`: 自增 ID（正整数）
  - `title`: 标题
  - `detail`: 详情内容
  - `created_at`: 创建时间（精确到秒，`YYYY-MM-DD HH:MM:SS`）
  - `updated_at`: 更新时间（精确到秒，`YYYY-MM-DD HH:MM:SS`）
- **时间紧急程度**
  - `urgency_level`: `"0".."4"`
  - `deadline_value`: 当 `urgency_level="4"` 时可填写日期（否则后端会清空）
- **分类与收益预期**
  - `project_category`: `"0"|"1"|"2"|"3"|"4"`（待定 / 管理项目 / 执行项目 / 灵感项目 / 目标主线）
  - `economic_benefit_expectation`: `"0".."5"`（收益相关档位，缺省为不涉及）
- **日程**
  - `planned_execute_date`: 计划执行日（`YYYY-MM-DD`，可为空）
  - `planned_time`: 计划时段说明（短文本，可为空）
- **项目状态**
  - `project_status`: `"0"|"1"|"2"|"3"|"4"|"5"`
    - `0`: 待开始
    - `1`: 进行中
    - `2`: 已完成
    - `3`: 计划中
    - `4`: 阻塞（由前置项目未完成自动推导）
    - `5`: 中止
- **优先级（派生字段，不可编辑）**
  - `priority`: 数值越大优先级越高（用于列表排序与“高优先级项目”面板）
  - 规则补充：**所有已完成(2)/中止(5) 的项目会被强制放到比任何未完成项目更低的优先级区间**
- **层级关系（单父节点约束）**
  - `parent_ids`: 上级项目 ID（**最多一个**；CSV 内用 `;` 分隔，但系统会校验最多只能有一个）
  - `child_ids`: 下级项目 ID 列表（`;` 分隔）
  - `path`: 项目多级路径（自动生成，形如 `1/4/9`）
- **依赖关系**
  - `prerequisite_ids`: 前置项目 ID 列表（`;` 分隔）
  - `blocked_by_ids`: 自动生成的“未完成前置项目 ID 列表”（`;` 分隔）

## 关键规则与后端模块说明（`app.py`）

当前后端已拆分到 `backend/` 包中，`app.py` 仅负责启动与配置。

后端关键模块：
- `backend/routes/`: API 路由分层（`items`、`backup` 等）
- `backend/backup.py`: 备份任务（手动/定时、状态文件）
- `backend/utils/atomic_write.py`: CSV 等原子写入辅助
- `backend/http/validators.py`: HTTP 参数解析/校验与通用错误响应
- `backend/services/item_queries.py`: 列表过滤与排序（从路由层抽离）
- `backend/service_items.py`: 业务归一化与派生字段计算（父子同步、阻塞规则、`path`、`priority`）
- `backend/domain_graph.py`: 图相关能力（环检测、子树、路径计算）
- `backend/normalize.py`: 状态/字段缺省/ID 列表解析、CSV headers
- `backend/storage_csv.py`: CSV 文件读写（支持 `MYWEB_DATA_FILE`、`MYWEB_TEST_MODE` 强隔离）
- `backend/domain/`: 领域规则拆分（priority/paths/blocking/enrich）

## 前端模块说明

- **`templates/index.html`**
  - **顶部切换**：高优先级 / **日程** / Filter / **目标主线**（四块面板切换）
  - **高优先级项目面板**：展示 TopN（可调），每行有“定位”按钮；可选“包含进行中”
  - **日程面板**：按日期查看当日 `planned_execute_date` 的项目；支持前一天/今天/后一天、刷新；行内可定位、详情、改期、开始/暂停、完成等
  - **目标主线面板**：在 `project_category=4` 的根目标下，按前置依赖分层展示子目标卡片；可选根目标、刷新、仅未完成主线；卡片上可定位、详情、新增子目标、删除目标（断开前置）、计划/开始/**暂停**/完成等
  - **过滤器**：按上级目录（root）过滤、按状态多选过滤、按标题/详情关键字过滤（通过切换按钮显示）
  - **列表**：主列表列可配置（见 `static/js/ui/viewConfig.js` 的 `VIEW_CONFIG.listColumns`），Actions 固定存在
  - **目录提示**：Items 标题旁显示“当前目录：xxx”
  - **按钮位置**：`返回上级` 位于 Items 区域，与 `新增项目` 并列
  - **弹窗**
    - 新增/编辑弹窗：创建/编辑项目（默认上级目录取当前 filter 的 `root_id`）
    - 详情弹窗：展示 `VIEW_CONFIG.detailFields` + 详情内容
    - 移动/路径选择弹窗：面包屑 + 当前目录列表（复用于“移动项目”和“选择上级路径/关联前置项目”）
    - Add Prereq 选择弹窗：两步交互（新建 / 关联已有）

- **`static/js/app.js`（入口）**
  - 负责 DOM 绑定、页面流程编排、调用 API、刷新列表/面板
  - **计划日顺延（每日一次）**：启动时若本地尚未记录“今日已顺延”，则对**所有未完成**（`project_status ≠ 2`，含**阻塞 4**、待开始 0）且 `planned_execute_date` 早于今天的项目，逐个调用 `PATCH .../schedule` 将日期 **+1 天**（`keep_status` 保留状态）；标记键为 `localStorage` 的 `myweb:schedule_rollover_ran_at`（值为当天 `YYYY-MM-DD`）
  - **暂停语义（日程 / 目标主线）**：进行中点“暂停”→ 计划中（`3`）；计划中点“暂停”→ 清空计划执行日，后端将项目置为待开始（`0`），从当日日程列表中消失
- **`static/js/ui/viewConfig.js`**
  - `VIEW_CONFIG`: 控制“主列表展示字段”和“详情弹窗展示字段”
- **`static/js/ui/renderItemsTable.js` / `static/js/ui/renderTableHead.js`**
  - 获取列表后渲染表头与主列表
  - **默认排序**：列表按后端计算的 `priority` 从高到低返回
  - **目录弹窗复用**
    - `openMoveModal()`：移动项目
    - `openParentPathPicker()`：选择上级路径（写回表单的 `parent_ids`）
    - `openPrereqPicker()`：关联已有前置项目（选择后调用后端追加接口）
  - **Add Prereq 两步交互**
    - `openPrereqChoiceModal()`：先选择“新建前置项目 / 关联已有项目”
    - 新建：创建成功后自动调用后端接口把新项目追加为目标项目的前置

## API 接口说明（输入/输出）

统一说明：

- **Content-Type**: `application/json`
- **成功返回**：JSON（对象或数组）
- **失败返回**：HTTP `400/404` + `{"error": "<message>"}`（前端会弹窗提示/表单提示）

### GET `/api/items`

获取项目列表（支持过滤）。

- **Query 参数（可选）**
  - `title`: 标题包含（大小写不敏感）
  - `detail`: 详情包含（大小写不敏感）
  - `q`: 标题或详情关键字（大小写不敏感，OR 匹配）
  - `statuses`: 状态过滤，多值逗号分隔，例如 `0,1`
  - `root_id`: 按上级目录过滤，返回该项目及其子树
  - `parent_id`: 返回某个目录下的直接子项目（用于目录弹窗浏览）
  - `all=1`: 返回所有项目（忽略默认“只看根项目”的行为）

- **返回**
  - `200 OK`：`[item, ...]`

说明：
- 默认返回顺序：按 `priority` 降序（高优先级在前）
- 当指定 `root_id` 时，返回的是该目录的子树 **但不包含目录本身**

### POST `/api/items`

创建项目。

- **Body**
  - 必填：`title`
  - 可选：`detail`, `urgency_level`, `deadline_value`, `project_status`, `parent_ids`, `child_ids`, `prerequisite_ids`

- **返回**
  - `201 Created`：新建的 `item`（含 `id/created_at/updated_at` 等）

### PUT `/api/items/<id>`

更新项目（全量更新表单字段）。

- **Body**
  - 必填：`title`
  - 可选：同 POST

- **返回**
  - `200 OK`：更新后的 `item`

### DELETE `/api/items/<id>`

删除项目。

- **约束**
  - 若该项目存在子项目（`child_ids` 非空），删除会失败并提示先删除子项目
  - 删除成功后，会自动从其他项目的 `parent_ids` / `child_ids` / `prerequisite_ids` 中清理该 id

- **返回**
  - `200 OK`：`{"ok": true}`

### PATCH `/api/items/<id>/status`

仅更新项目状态（用于“开始/暂停/完成/中止”快捷按钮）。

- **Body**
  - `project_status`: `"0"|"1"|"2"|"3"|"4"|"5"`

- **返回**
  - `200 OK`：更新后的 `item`

### PATCH `/api/items/<id>/schedule`

仅更新计划执行日（日程、顺延、改期弹窗等）。

- **Body**
  - `planned_execute_date`: `YYYY-MM-DD` 或空字符串（清空）
  - 可选：`keep_status` 为真时，改期后不自动把进行中改为计划中（用于批量顺延等）

- **规则摘要**
  - 未完成项目不可将计划日改到**今天之前**
  - 清空计划日且非阻塞时，状态会回到待开始（`0`）；阻塞（`4`）有特殊分支（见 `backend/routes/items.py`）

- **返回**
  - `200 OK`：更新后的 `item`

### PATCH `/api/items/<id>/parent`

仅更新上级目录（用于“移动项目”）。

- **Body**
  - `parent_id`: `""`（移动到根目录）或 `"123"`（移动到某个项目下）

- **返回**
  - `200 OK`：更新后的 `item`

### PATCH `/api/items/<id>/prerequisites`

追加一个“已有项目”作为前置项目（用于 Add Prereq 的“关联已有项目”与“新建后自动关联”）。

- **Body**
  - `add`: `"123"`（要追加的前置项目 id）

- **返回**
  - `200 OK`：更新后的 `item`

## 常见操作提示

- **默认视图**：不填 `root_id` 时，后端默认只返回“根项目”（`parent_ids` 为空）
- **日程列表**：只展示 `planned_execute_date` 等于所选日期的项目；计划中与进行中均可使用“暂停”（见上文顺延与暂停语义）
- **阻塞规则**：当 `prerequisite_ids` 中存在任何未完成项目（状态不为 `2`），该项目会自动变为 `4(阻塞)` 并维护 `blocked_by_ids`
- **解除阻塞**：
  - 前置全部完成时：项目将从 `4` 自动恢复为 `0`（若之前处于阻塞）
  - 删除最后一个前置关联（例如“删除目标”）时：若项目仍处于 `4`，也会恢复为 `0`
- **单父节点约束**：一个项目最多只能有一个上级目录，违反会在写入时返回 `400` 错误

## 备份与导出

页面 Items 区域提供：
- **立即备份**：触发一次手动备份，将当前 `database.csv` 复制到 `bak/` 下（带时间戳文件名）
- **导出CSV**：下载当前 `database.csv`（浏览器选择保存位置，相当于复制一份）
- **上次备份时间**：显示最近一次自动/手动备份的时间

对应接口：
- `GET /api/backup/status`
- `POST /api/backup`
- `GET /api/data/export`

环境变量：
- `MYWEB_BACKUP_INTERVAL_SEC`: 自动备份间隔秒数（默认 `600`；设为 `0` 关闭自动备份）
- `MYWEB_BAK_DIR`: 备份输出目录（默认项目根目录下的 `bak/`）
