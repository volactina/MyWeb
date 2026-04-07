## 项目管理平台（Flask + CSV）

一个轻量的“项目管理/任务管理”Demo：后端用 Flask 提供 REST API，前端使用 `templates/index.html` + `static/app.js` 渲染与交互，数据持久化在 `database.csv`（CSV 作为简易数据库）。

## 项目路径与文件结构

项目根目录（示例）：`/Users/wenhaoye/github/MyWeb`

- **后端**
  - `app.py`: Flask 应用入口、CSV 读写、数据规范化/校验、项目层级与依赖规则、API 路由实现
- **前端**
  - `templates/index.html`: 管理页面（表单、过滤器、列表、详情弹窗、移动/路径选择弹窗、Add Prereq 选择弹窗）
  - `static/app.js`: 前端交互逻辑（CRUD 请求、过滤查询、列表渲染、弹窗逻辑、快速状态按钮、移动/选择路径、Add Prereq 两步交互）
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
- **层级关系（单父节点约束）**
  - `parent_ids`: 上级项目 ID（**最多一个**；CSV 内用 `;` 分隔，但系统会校验最多只能有一个）
  - `child_ids`: 下级项目 ID 列表（`;` 分隔）
  - `path`: 项目多级路径（自动生成，形如 `1/4/9`）
- **依赖关系**
  - `prerequisite_ids`: 前置项目 ID 列表（`;` 分隔）
  - `blocked_by_ids`: 自动生成的“未完成前置项目 ID 列表”（`;` 分隔）

## 关键规则与后端模块说明（`app.py`）

`app.py` 主要模块/函数职责：

- **数据持久化**
  - `read_items()`: 读取 CSV，做字段补齐/迁移，再执行统一的归一化与校验
  - `write_items(items)`: 写入前再次归一化与校验，保证落盘数据一致性
  - `CSV_HEADERS` / `DEFAULT_ITEM_FIELDS`: 当前 CSV 字段定义与缺省值
- **归一化与校验**
  - `normalize_item(row)`: 单行缺省字段补齐、状态值规整
  - `normalize_project_status(raw)`: 将状态归一化（含兼容 `3 -> 0`）
  - `parse_id_list(raw)`: 解析 `;` 分隔的 ID 列表（去重、排序、规范化字符串）
  - `validate_references_and_cycles(items)`: 引用存在性、自引用、循环依赖检测（层级与依赖统一做有向图环检测）
- **关系同步与路径计算**
  - `enrich_and_normalize_items(items)`: 中心逻辑
    - 同步 `parent_ids`/`child_ids` 的双向一致性
    - **强制单父节点**（一个项目最多一个上级）
    - 应用“前置未完成则阻塞”的规则并维护 `blocked_by_ids`
    - 计算 `path`
  - `compute_paths(items)`: 生成 `path`
  - `subtree_ids(root_id, items)`: 计算某个项目的整棵子树（用于按目录过滤/移动校验）

## 前端模块说明

- **`templates/index.html`**
  - **创建/编辑表单**：标题、详情、紧急程度 + 日期、状态、上级路径选择、子项目/前置项目 ID 输入等
  - **过滤器**：按上级目录（root）过滤、按状态多选过滤、按标题/详情关键字过滤
  - **列表**：主列表列可配置（见 `static/app.js` 的 `VIEW_CONFIG.listColumns`），Actions 固定存在
  - **弹窗**
    - 详情弹窗：展示 `VIEW_CONFIG.detailFields` + 详情内容
    - 移动/路径选择弹窗：面包屑 + 当前目录列表（复用于“移动项目”和“选择上级路径/关联前置项目”）
    - Add Prereq 选择弹窗：两步交互（新建 / 关联已有）

- **`static/app.js`**
  - `VIEW_CONFIG`: 控制“主列表展示字段”和“详情弹窗展示字段”
  - `loadItems()/renderItems()`: 获取列表并渲染
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
