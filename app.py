import csv
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Set, Tuple

from flask import Flask, jsonify, render_template, request


app = Flask(__name__)

DATA_FILE = Path(__file__).resolve().parent / "database.csv"
CSV_HEADERS = [
    "id",
    "title",
    "detail",
    "created_at",
    "updated_at",
    "urgency_level",
    "project_status",
    "parent_ids",
    "child_ids",
    "prerequisite_ids",
    "blocked_by_ids",
    "deadline_value",
    "path",
]

DEFAULT_ITEM_FIELDS: Dict[str, str] = {
    "urgency_level": "0",
    "project_status": "0",
    "parent_ids": "",
    "child_ids": "",
    "prerequisite_ids": "",
    "blocked_by_ids": "",
    "deadline_value": "",
    "path": "",
}


def current_timestamp() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def normalize_project_status(raw: str) -> str:
    """
    Project status:
    0 待开始
    1 进行中
    2 已完成
    4 阻塞
    5 中止

    Status 3(暂停) is deprecated and will be treated as 0(待开始).
    """
    raw = (raw or "").strip()
    if raw == "3":
        return "0"
    return raw if raw in {"0", "1", "2", "4", "5"} else "0"


def ensure_data_file() -> None:
    if DATA_FILE.exists():
        return
    with DATA_FILE.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADERS)
        writer.writeheader()


def normalize_item(row: Dict[str, str]) -> Dict[str, str]:
    normalized = {**DEFAULT_ITEM_FIELDS, **row}
    if normalized.get("urgency_level") is None or normalized["urgency_level"] == "":
        normalized["urgency_level"] = "0"
    if normalized.get("project_status") is None or normalized["project_status"] == "":
        normalized["project_status"] = "0"
    normalized["project_status"] = normalize_project_status(normalized["project_status"])
    if normalized.get("parent_ids") is None:
        normalized["parent_ids"] = ""
    if normalized.get("child_ids") is None:
        normalized["child_ids"] = ""
    if normalized.get("prerequisite_ids") is None:
        normalized["prerequisite_ids"] = ""
    if normalized.get("blocked_by_ids") is None:
        normalized["blocked_by_ids"] = ""
    if normalized.get("deadline_value") is None:
        normalized["deadline_value"] = ""
    if normalized.get("path") is None:
        normalized["path"] = ""

    # Ensure all expected keys exist (DictWriter will drop unknown keys)
    for k in CSV_HEADERS:
        normalized.setdefault(k, "")
    return normalized


def parse_id_list(raw: str) -> Tuple[List[int], str]:
    """
    Returns (ids, normalized_string). Input format: "1;2;  3".
    """
    raw = (raw or "").strip()
    if not raw:
        return ([], "")
    parts = [p.strip() for p in raw.split(";")]
    ids: List[int] = []
    for p in parts:
        if not p:
            continue
        if not p.isdigit():
            raise ValueError(f"invalid id '{p}' (must be integer)")
        value = int(p)
        if value <= 0:
            raise ValueError(f"invalid id '{p}' (must be positive)")
        ids.append(value)
    # de-dup + stable sorted
    ids = sorted(set(ids))
    return ids, ";".join(str(i) for i in ids)


def build_edges(items: List[Dict[str, str]]) -> Dict[int, Set[int]]:
    """
    Build directed edges (for cycle detection):
    - parent -> child (hierarchy)
    - prerequisite -> project (dependency)
    """
    edges: Dict[int, Set[int]] = {}

    def add_edge(a: int, b: int) -> None:
        edges.setdefault(a, set()).add(b)

    for item in items:
        this_id = int(item["id"])
        parent_list, _ = parse_id_list(item.get("parent_ids", ""))
        child_list, _ = parse_id_list(item.get("child_ids", ""))
        prereq_list, _ = parse_id_list(item.get("prerequisite_ids", ""))

        for p in parent_list:
            add_edge(p, this_id)
        for c in child_list:
            add_edge(this_id, c)
        for pre in prereq_list:
            add_edge(pre, this_id)

    return edges


def validate_references_and_cycles(items: List[Dict[str, str]]) -> None:
    id_set = {int(i["id"]) for i in items}

    # Existence + self reference checks
    for item in items:
        this_id = int(item["id"])
        parents, _ = parse_id_list(item.get("parent_ids", ""))
        children, _ = parse_id_list(item.get("child_ids", ""))
        prereqs, _ = parse_id_list(item.get("prerequisite_ids", ""))

        if this_id in parents or this_id in children or this_id in prereqs:
            raise ValueError("referenced ids cannot include itself")

        for ref_id in parents + children + prereqs:
            if ref_id not in id_set:
                raise ValueError(f"referenced id '{ref_id}' does not exist")

    # Cycle check in parent->child graph
    edges = build_edges(items)
    visited: Set[int] = set()
    in_stack: Set[int] = set()

    def dfs(u: int) -> None:
        visited.add(u)
        in_stack.add(u)
        for v in edges.get(u, set()):
            if v not in visited:
                dfs(v)
            elif v in in_stack:
                raise ValueError("cycle detected in project dependencies")
        in_stack.remove(u)

    for node in id_set:
        if node not in visited:
            dfs(node)


def compute_paths(items: List[Dict[str, str]]) -> Dict[int, str]:
    """
    Compute multi-level path for each item.
    If multiple parent chains exist, keep all paths separated by ' | '.
    Paths are id-based, like '1/4/9'. Root item -> '9'.
    """
    id_set = {int(i["id"]) for i in items}

    parents_map: Dict[int, Set[int]] = {i: set() for i in id_set}
    for item in items:
        this_id = int(item["id"])
        parent_list, _ = parse_id_list(item.get("parent_ids", ""))
        for p in parent_list:
            parents_map[this_id].add(p)

    # also infer parents from other items' child_ids
    for item in items:
        this_id = int(item["id"])
        child_list, _ = parse_id_list(item.get("child_ids", ""))
        for c in child_list:
            if c in parents_map:
                parents_map[c].add(this_id)

    memo: Dict[int, List[str]] = {}

    def paths_to(n: int) -> List[str]:
        if n in memo:
            return memo[n]
        ps = sorted(parents_map.get(n, set()))
        if not ps:
            memo[n] = [str(n)]
            return memo[n]
        all_paths: List[str] = []
        for p in ps:
            for prefix in paths_to(p):
                all_paths.append(f"{prefix}/{n}")
        # de-dup but keep order
        seen: Set[str] = set()
        unique: List[str] = []
        for x in all_paths:
            if x in seen:
                continue
            seen.add(x)
            unique.append(x)
        memo[n] = unique
        return unique

    out: Dict[int, str] = {}
    for n in sorted(id_set):
        out[n] = " | ".join(paths_to(n))
    return out


def subtree_ids(root_id: int, items: List[Dict[str, str]]) -> Set[int]:
    by_id = {int(i["id"]): i for i in items}
    if root_id not in by_id:
        raise ValueError("root_id does not exist")

    children_map: Dict[int, List[int]] = {}
    for item in items:
        this_id = int(item["id"])
        child_list, _ = parse_id_list(item.get("child_ids", ""))
        children_map[this_id] = child_list

    allowed: Set[int] = set()
    stack = [root_id]
    while stack:
        cur = stack.pop()
        if cur in allowed:
            continue
        allowed.add(cur)
        for c in children_map.get(cur, []):
            stack.append(c)
    return allowed


def enrich_and_normalize_items(items: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """
    - Normalize parent/child id lists to a stable format
    - Sync both directions:
      - If A lists parents: add A to each parent's children
      - If A lists children: add A to each child's parents
      - Removed relations are removed from the other side as well, unless re-added explicitly there
    - Validate existence + cycles
    - Compute multi-level path
    """
    ids = {int(i["id"]) for i in items}

    # Parse and normalize user-provided strings first
    raw_parents: Dict[int, List[int]] = {}
    raw_children: Dict[int, List[int]] = {}
    raw_prereqs: Dict[int, List[int]] = {}
    for item in items:
        this_id = int(item["id"])
        parents, parents_norm = parse_id_list(item.get("parent_ids", ""))
        children, children_norm = parse_id_list(item.get("child_ids", ""))
        prereqs, prereqs_norm = parse_id_list(item.get("prerequisite_ids", ""))
        item["parent_ids"] = parents_norm
        item["child_ids"] = children_norm
        item["prerequisite_ids"] = prereqs_norm
        raw_parents[this_id] = parents
        raw_children[this_id] = children
        raw_prereqs[this_id] = prereqs

        if str(item.get("urgency_level", "0")) != "4":
            item["deadline_value"] = ""

        # Ensure deprecated status is normalized before any rules apply.
        item["project_status"] = normalize_project_status(str(item.get("project_status", "0")))

    # Build unified directed relations parent -> child from both fields
    edges: Dict[int, Set[int]] = {i: set() for i in ids}
    reverse_edges: Dict[int, Set[int]] = {i: set() for i in ids}

    def add_edge(p: int, c: int) -> None:
        if p in edges:
            edges[p].add(c)
        if c in reverse_edges:
            reverse_edges[c].add(p)

    for child_id, parents in raw_parents.items():
        for p in parents:
            add_edge(p, child_id)

    for parent_id, children in raw_children.items():
        for c in children:
            add_edge(parent_id, c)

    # Rewrite both sides from the unified relation sets (this is the "sync")
    for item in items:
        this_id = int(item["id"])
        parent_list = sorted(reverse_edges.get(this_id, set()))
        child_list = sorted(edges.get(this_id, set()))
        if len(parent_list) > 1:
            raise ValueError(f"each project can only have one parent (id={this_id})")
        item["parent_ids"] = ";".join(str(i) for i in parent_list)
        item["child_ids"] = ";".join(str(i) for i in child_list)

    # Validate existence/self/cycle after sync
    validate_references_and_cycles(items)

    # Apply prerequisite blocking rule
    by_id: Dict[int, Dict[str, str]] = {int(i["id"]): i for i in items}
    for item in items:
        this_id = int(item["id"])
        prereqs = raw_prereqs.get(this_id, [])
        incomplete: List[int] = []
        for pre in prereqs:
            pre_status = str(by_id.get(pre, {}).get("project_status", "0"))
            if pre_status != "2":
                incomplete.append(pre)

        if incomplete:
            item["project_status"] = "4"  # blocked
            item["blocked_by_ids"] = ";".join(str(i) for i in sorted(set(incomplete)))
        else:
            item["blocked_by_ids"] = ""
            if prereqs:
                # all prerequisites done -> pending
                item["project_status"] = "0"

    paths = compute_paths(items)
    for item in items:
        item["path"] = paths.get(int(item["id"]), str(item["id"]))
    return items


def read_items() -> List[Dict[str, str]]:
    ensure_data_file()
    with DATA_FILE.open("r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        source_fields = reader.fieldnames or []
        rows = [normalize_item(row) for row in reader if row.get("id")]

    rows.sort(key=lambda x: int(x["id"]))

    # Auto-migrate old CSV missing new columns by writing back once.
    if any(h not in source_fields for h in CSV_HEADERS):
        rows = enrich_and_normalize_items(rows)
        write_items(rows)
    else:
        rows = enrich_and_normalize_items(rows)

    return rows


def write_items(items: List[Dict[str, str]]) -> None:
    items = enrich_and_normalize_items(items)
    with DATA_FILE.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADERS)
        writer.writeheader()
        writer.writerows(items)


def next_id(items: List[Dict[str, str]]) -> int:
    if not items:
        return 1
    return max(int(item["id"]) for item in items) + 1


@app.get("/")
def home():
    ensure_data_file()
    return render_template("index.html")


@app.get("/api/items")
def list_items():
    title_query = request.args.get("title", "").strip().lower()
    detail_query = request.args.get("detail", "").strip().lower()
    root_id_raw = request.args.get("root_id", "").strip()
    parent_id_raw = request.args.get("parent_id", "").strip()
    statuses_raw = request.args.get("statuses", "").strip()
    all_raw = request.args.get("all", "").strip()
    items = read_items()

    if parent_id_raw:
        if not parent_id_raw.isdigit():
            return jsonify({"error": "invalid parent_id"}), 400
        items = [i for i in items if str(i.get("parent_ids", "")).strip() == parent_id_raw]
    elif root_id_raw:
        if not root_id_raw.isdigit():
            return jsonify({"error": "invalid root_id"}), 400
        try:
            allowed = subtree_ids(int(root_id_raw), items)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        items = [i for i in items if int(i["id"]) in allowed]
    else:
        if all_raw not in {"1", "true", "True"}:
            # Default: show root projects (no parent) like a "root folder"
            items = [i for i in items if not str(i.get("parent_ids", "")).strip()]

    if title_query:
        items = [i for i in items if title_query in i["title"].lower()]
    if detail_query:
        items = [i for i in items if detail_query in i["detail"].lower()]

    if statuses_raw:
        parts = [p.strip() for p in statuses_raw.split(",") if p.strip()]
        # allow legacy "3" in query, treat as "0"
        parts = ["0" if p == "3" else p for p in parts]
        if not parts or any(p not in {"0", "1", "2", "4", "5"} for p in parts):
            return jsonify({"error": "invalid statuses"}), 400
        allowed_statuses = set(parts)
        items = [i for i in items if str(i.get("project_status", "0")) in allowed_statuses]

    return jsonify(items)


@app.post("/api/items")
def create_item():
    payload = request.get_json(silent=True) or {}
    title = (payload.get("title") or "").strip()
    detail = (payload.get("detail") or "").strip()
    urgency_level = str(payload.get("urgency_level") if payload.get("urgency_level") is not None else "0").strip()
    project_status = normalize_project_status(
        str(payload.get("project_status") if payload.get("project_status") is not None else "0")
    )
    parent_ids = (payload.get("parent_ids") or "").strip()
    child_ids = (payload.get("child_ids") or "").strip()
    prerequisite_ids = (payload.get("prerequisite_ids") or "").strip()
    deadline_value = (payload.get("deadline_value") or "").strip()

    if not title:
        return jsonify({"error": "title is required"}), 400

    items = read_items()
    now = current_timestamp()
    new_item = {
        "id": str(next_id(items)),
        "title": title,
        "detail": detail,
        "created_at": now,
        "updated_at": now,
        "urgency_level": urgency_level if urgency_level in {"0", "1", "2", "3", "4"} else "0",
        "project_status": project_status,
        "parent_ids": parent_ids,
        "child_ids": child_ids,
        "prerequisite_ids": prerequisite_ids,
        "blocked_by_ids": "",
        "deadline_value": deadline_value,
        "path": "",
    }
    items.append(new_item)
    try:
        write_items(items)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify(new_item), 201


@app.put("/api/items/<int:item_id>")
def update_item(item_id: int):
    payload = request.get_json(silent=True) or {}
    title = (payload.get("title") or "").strip()
    detail = (payload.get("detail") or "").strip()
    urgency_level = str(payload.get("urgency_level") if payload.get("urgency_level") is not None else "0").strip()
    project_status = normalize_project_status(
        str(payload.get("project_status") if payload.get("project_status") is not None else "0")
    )
    parent_ids = (payload.get("parent_ids") or "").strip()
    child_ids = (payload.get("child_ids") or "").strip()
    prerequisite_ids = (payload.get("prerequisite_ids") or "").strip()
    deadline_value = (payload.get("deadline_value") or "").strip()

    if not title:
        return jsonify({"error": "title is required"}), 400

    items = read_items()
    target = None
    for item in items:
        if int(item["id"]) == item_id:
            target = item
            break

    if target is None:
        return jsonify({"error": "item not found"}), 404

    target["title"] = title
    target["detail"] = detail
    target["urgency_level"] = urgency_level if urgency_level in {"0", "1", "2", "3", "4"} else "0"
    target["project_status"] = project_status
    target["parent_ids"] = parent_ids
    target["child_ids"] = child_ids
    target["prerequisite_ids"] = prerequisite_ids
    target["deadline_value"] = deadline_value
    target["updated_at"] = current_timestamp()
    try:
        write_items(items)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify(target)


@app.patch("/api/items/<int:item_id>/status")
def update_item_status(item_id: int):
    payload = request.get_json(silent=True) or {}
    project_status = normalize_project_status(
        str(payload.get("project_status") if payload.get("project_status") is not None else "")
    )
    if project_status not in {"0", "1", "2", "4", "5"}:
        return jsonify({"error": "invalid project_status"}), 400

    items = read_items()
    target = None
    for item in items:
        if int(item["id"]) == item_id:
            target = item
            break

    if target is None:
        return jsonify({"error": "item not found"}), 404

    target["project_status"] = project_status
    target["updated_at"] = current_timestamp()
    try:
        write_items(items)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify(target)


@app.patch("/api/items/<int:item_id>/parent")
def update_item_parent(item_id: int):
    payload = request.get_json(silent=True) or {}
    parent_id_raw = payload.get("parent_id", "")
    parent_id_raw = "" if parent_id_raw is None else str(parent_id_raw).strip()

    if parent_id_raw and not parent_id_raw.isdigit():
        return jsonify({"error": "invalid parent_id"}), 400

    items = read_items()
    by_id: Dict[int, Dict[str, str]] = {int(i["id"]): i for i in items}
    target = by_id.get(item_id)
    if target is None:
        return jsonify({"error": "item not found"}), 404

    if parent_id_raw:
        parent_id = int(parent_id_raw)
        if parent_id not in by_id:
            return jsonify({"error": "parent_id does not exist"}), 400
        if parent_id == item_id:
            return jsonify({"error": "cannot move under itself"}), 400
        try:
            descendants = subtree_ids(item_id, items)
        except ValueError:
            descendants = {item_id}
        if parent_id in descendants:
            return jsonify({"error": "cannot move under its own subtree"}), 400
        target["parent_ids"] = str(parent_id)
    else:
        target["parent_ids"] = ""

    target["updated_at"] = current_timestamp()
    try:
        write_items(list(by_id.values()))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return jsonify(target)


@app.patch("/api/items/<int:item_id>/prerequisites")
def update_item_prerequisites(item_id: int):
    """
    Append an existing project id into prerequisite_ids.
    Payload:
      - {"add": "<id>"}  (required)
    """
    payload = request.get_json(silent=True) or {}
    add_raw = payload.get("add", "")
    add_raw = "" if add_raw is None else str(add_raw).strip()
    if not add_raw or not add_raw.isdigit():
        return jsonify({"error": "invalid add id"}), 400

    add_id = int(add_raw)
    items = read_items()
    by_id: Dict[int, Dict[str, str]] = {int(i["id"]): i for i in items}
    target = by_id.get(item_id)
    if target is None:
        return jsonify({"error": "item not found"}), 404
    if add_id not in by_id:
        return jsonify({"error": "add id does not exist"}), 400
    if add_id == item_id:
        return jsonify({"error": "prerequisite cannot be itself"}), 400

    prereqs, _ = parse_id_list(target.get("prerequisite_ids", ""))
    prereqs.append(add_id)
    prereqs = sorted(set(prereqs))
    target["prerequisite_ids"] = ";".join(str(i) for i in prereqs)
    target["updated_at"] = current_timestamp()

    try:
        write_items(list(by_id.values()))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify(target)


@app.delete("/api/items/<int:item_id>")
def delete_item(item_id: int):
    items = read_items()
    target = None
    for item in items:
        if int(item["id"]) == item_id:
            target = item
            break

    if target is None:
        return jsonify({"error": "item not found"}), 404

    children, _ = parse_id_list(target.get("child_ids", ""))
    if children:
        return (
            jsonify({"error": "delete failed: please delete all child projects first"}),
            400,
        )

    kept = [item for item in items if int(item["id"]) != item_id]

    # Remove any remaining references to this id, then let write_items sync both sides.
    for item in kept:
        parents, _ = parse_id_list(item.get("parent_ids", ""))
        children_list, _ = parse_id_list(item.get("child_ids", ""))
        prereqs, _ = parse_id_list(item.get("prerequisite_ids", ""))
        parents = [i for i in parents if i != item_id]
        children_list = [i for i in children_list if i != item_id]
        prereqs = [i for i in prereqs if i != item_id]
        item["parent_ids"] = ";".join(str(i) for i in parents)
        item["child_ids"] = ";".join(str(i) for i in children_list)
        item["prerequisite_ids"] = ";".join(str(i) for i in prereqs)

    try:
        write_items(kept)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(debug=True)
