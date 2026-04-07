## 项目管理平台（Flask + CSV）

一个轻量的“项目管理/任务管理”Demo：后端用 Flask 提供 REST API，前端使用 `templates/index.html` + `static/app.js` 渲染与交互，数据持久化在 `database.csv`（CSV 作为简易数据库）。

## 项目路径与文件结构

项目根目录（示例）：`/Users/wenhaoye/github/MyWeb`

- **后端**
  - `app.py`: Flask 应用启动入口（支持 `FLASK_RUN_PORT`、`MYWEB_DEBUG`）
  - `backend/`: 后端模块拆分（路由/业务/归一化/CSV 存储/图算法）
- **前端**
  - `templates/index.html`: 管理页面（优先级面板/Filter 面板切换、Items 列表、各类弹窗）
  - `static/app.js`: 前端交互逻辑（CRUD 请求、过滤查询、列表渲染、弹窗、快速状态按钮、移动/选路径、Add Prereq 两步交互、优先级面板与定位）
- **数据**
  - `database.csv`: 项目数据存储（首行是表头，后续为记录）
- **备份**
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

说明：
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
- **项目状态**
  - `project_status`: `"0"|"1"|"2"|"4"|"5"`
    - `0`: 待开始
    - `1`: 进行中
    - `2`: 已完成
    - `4`: 阻塞（由前置项目未完成自动推导）
    - `5`: 中止
    - 历史兼容：如出现 `3(暂停)` 会被后端归一化为 `0(待开始)`
- **优先级（派生字段，不可编辑）**
  - `priority`: 数值越大优先级越高（用于列表排序与“高优先级项目”面板）
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
- `backend/routes.py`: API 路由（`/api/items` CRUD + `PATCH status/parent/prerequisites`）
- `backend/service_items.py`: 业务归一化与派生字段计算（父子同步、阻塞规则、`path`、`priority`）
- `backend/domain_graph.py`: 图相关能力（环检测、子树、路径计算）
- `backend/normalize.py`: 状态/字段缺省/ID 列表解析、CSV headers
- `backend/storage_csv.py`: CSV 文件读写（支持 `MYWEB_DATA_FILE`、`MYWEB_TEST_MODE` 强隔离）

## 前端模块说明

- **`templates/index.html`**
  - **顶部切换**：高优先级项目面板 / Filter 面板（默认显示高优先级）
  - **高优先级项目面板**：展示 TopN（可调），每行有“定位”按钮
  - **过滤器**：按上级目录（root）过滤、按状态多选过滤、按标题/详情关键字过滤（通过切换按钮显示）
  - **列表**：主列表列可配置（见 `static/app.js` 的 `VIEW_CONFIG.listColumns`），Actions 固定存在
  - **目录提示**：Items 标题旁显示“当前目录：xxx”
  - **按钮位置**：`返回上级` 位于 Items 区域，与 `新增项目` 并列
  - **弹窗**
    - 新增/编辑弹窗：创建/编辑项目（默认上级目录取当前 filter 的 `root_id`）
    - 详情弹窗：展示 `VIEW_CONFIG.detailFields` + 详情内容
    - 移动/路径选择弹窗：面包屑 + 当前目录列表（复用于“移动项目”和“选择上级路径/关联前置项目”）
    - Add Prereq 选择弹窗：两步交互（新建 / 关联已有）

- **`static/app.js`**
  - `VIEW_CONFIG`: 控制“主列表展示字段”和“详情弹窗展示字段”
  - `loadItems()/renderItems()`: 获取列表并渲染
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
  - `project_status`: `"0"|"1"|"2"|"4"|"5"`（`3` 会被归一化为 `0`）

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
- **阻塞规则**：当 `prerequisite_ids` 中存在任何未完成项目（状态不为 `2`），该项目会自动变为 `4(阻塞)` 并维护 `blocked_by_ids`
- **单父节点约束**：一个项目最多只能有一个上级目录，违反会在写入时返回 `400` 错误
