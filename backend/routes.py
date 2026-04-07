from __future__ import annotations

from typing import Dict

from flask import Blueprint, jsonify, render_template, request

from .normalize import current_timestamp, normalize_project_status, parse_id_list
from .service_items import next_id, read_items, subtree_ids, write_items


bp = Blueprint("api", __name__)


@bp.get("/")
def home():
    return render_template("index.html")


@bp.get("/api/items")
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
            items = [i for i in items if not str(i.get("parent_ids", "")).strip()]

    if title_query:
        items = [i for i in items if title_query in i["title"].lower()]
    if detail_query:
        items = [i for i in items if detail_query in i["detail"].lower()]

    if statuses_raw:
        parts = [p.strip() for p in statuses_raw.split(",") if p.strip()]
        parts = ["0" if p == "3" else p for p in parts]
        if not parts or any(p not in {"0", "1", "2", "4", "5"} for p in parts):
            return jsonify({"error": "invalid statuses"}), 400
        allowed_statuses = set(parts)
        items = [i for i in items if str(i.get("project_status", "0")) in allowed_statuses]

    return jsonify(items)


@bp.post("/api/items")
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


@bp.put("/api/items/<int:item_id>")
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


@bp.patch("/api/items/<int:item_id>/status")
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


@bp.patch("/api/items/<int:item_id>/parent")
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

    # Remove any stale references from existing parents' child_ids.
    # Otherwise, the bidirectional sync may "pull back" the old relation.
    for item in by_id.values():
        children_list, _ = parse_id_list(item.get("child_ids", ""))
        if item_id in children_list:
            children_list = [i for i in children_list if i != item_id]
            item["child_ids"] = ";".join(str(i) for i in children_list)

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


@bp.patch("/api/items/<int:item_id>/prerequisites")
def update_item_prerequisites(item_id: int):
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


@bp.delete("/api/items/<int:item_id>")
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

