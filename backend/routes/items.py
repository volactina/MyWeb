from __future__ import annotations

from typing import Dict

from flask import Blueprint, jsonify, request

from ..http.validators import bad_request, not_found, parse_int_str, parse_statuses_csv
from ..normalize import current_timestamp, normalize_project_status, parse_id_list
from ..service_items import next_id, read_items, subtree_ids, write_items
from ..services.item_queries import apply_filters, sort_by_priority


def register_item_routes(bp: Blueprint) -> None:
    @bp.get("/api/items")
    def list_items():
        title_query = request.args.get("title", "").strip().lower()
        detail_query = request.args.get("detail", "").strip().lower()
        root_id_raw = request.args.get("root_id", "").strip()
        parent_id_raw = request.args.get("parent_id", "").strip()
        statuses_raw = request.args.get("statuses", "").strip()
        all_raw = request.args.get("all", "").strip()

        root_id = parse_int_str(root_id_raw) if root_id_raw else None
        if root_id_raw and root_id is None:
            return bad_request("invalid root_id")
        parent_id = parse_int_str(parent_id_raw) if parent_id_raw else None
        if parent_id_raw and parent_id is None:
            return bad_request("invalid parent_id")

        allowed_statuses = parse_statuses_csv(statuses_raw)
        if statuses_raw and allowed_statuses is None:
            return bad_request("invalid statuses")

        all_flag = all_raw in {"1", "true", "True"}

        items = read_items()
        try:
            items = apply_filters(
                items,
                title_query=title_query,
                detail_query=detail_query,
                root_id=root_id,
                parent_id=parent_id,
                allowed_statuses=allowed_statuses,
                all_flag=all_flag,
                subtree_ids_fn=subtree_ids,
            )
        except ValueError as e:
            return bad_request(str(e))

        sort_by_priority(items)
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
            return bad_request("title is required")

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
            return bad_request(str(e))

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
            return bad_request("title is required")

        items = read_items()
        target = None
        for item in items:
            if int(item["id"]) == item_id:
                target = item
                break

        if target is None:
            return not_found("item not found")

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
            return bad_request(str(e))

        return jsonify(target)

    @bp.patch("/api/items/<int:item_id>/status")
    def update_item_status(item_id: int):
        payload = request.get_json(silent=True) or {}
        project_status = normalize_project_status(
            str(payload.get("project_status") if payload.get("project_status") is not None else "")
        )
        if project_status not in {"0", "1", "2", "4", "5"}:
            return bad_request("invalid project_status")

        items = read_items()
        target = None
        for item in items:
            if int(item["id"]) == item_id:
                target = item
                break

        if target is None:
            return not_found("item not found")

        target["project_status"] = project_status
        target["updated_at"] = current_timestamp()
        try:
            write_items(items)
        except ValueError as e:
            return bad_request(str(e))

        return jsonify(target)

    @bp.patch("/api/items/<int:item_id>/parent")
    def update_item_parent(item_id: int):
        payload = request.get_json(silent=True) or {}
        parent_id_raw = payload.get("parent_id", "")
        parent_id_raw = "" if parent_id_raw is None else str(parent_id_raw).strip()

        if parent_id_raw and not parent_id_raw.isdigit():
            return bad_request("invalid parent_id")

        items = read_items()
        by_id: Dict[int, Dict[str, str]] = {int(i["id"]): i for i in items}
        target = by_id.get(item_id)
        if target is None:
            return not_found("item not found")

        for item in by_id.values():
            children_list, _ = parse_id_list(item.get("child_ids", ""))
            if item_id in children_list:
                children_list = [i for i in children_list if i != item_id]
                item["child_ids"] = ";".join(str(i) for i in children_list)

        if parent_id_raw:
            parent_id = int(parent_id_raw)
            if parent_id not in by_id:
                return bad_request("parent_id does not exist")
            if parent_id == item_id:
                return bad_request("cannot move under itself")
            try:
                descendants = subtree_ids(item_id, items)
            except ValueError:
                descendants = {item_id}
            if parent_id in descendants:
                return bad_request("cannot move under its own subtree")
            target["parent_ids"] = str(parent_id)
        else:
            target["parent_ids"] = ""

        target["updated_at"] = current_timestamp()
        try:
            write_items(list(by_id.values()))
        except ValueError as e:
            return bad_request(str(e))

        return jsonify(target)

    @bp.patch("/api/items/<int:item_id>/prerequisites")
    def update_item_prerequisites(item_id: int):
        payload = request.get_json(silent=True) or {}
        add_raw = payload.get("add", "")
        add_raw = "" if add_raw is None else str(add_raw).strip()
        if not add_raw or not add_raw.isdigit():
            return bad_request("invalid add id")

        add_id = int(add_raw)
        items = read_items()
        by_id: Dict[int, Dict[str, str]] = {int(i["id"]): i for i in items}
        target = by_id.get(item_id)
        if target is None:
            return not_found("item not found")
        if add_id not in by_id:
            return bad_request("add id does not exist")
        if add_id == item_id:
            return bad_request("prerequisite cannot be itself")

        prereqs, _ = parse_id_list(target.get("prerequisite_ids", ""))
        prereqs.append(add_id)
        prereqs = sorted(set(prereqs))
        target["prerequisite_ids"] = ";".join(str(i) for i in prereqs)
        target["updated_at"] = current_timestamp()

        try:
            write_items(list(by_id.values()))
        except ValueError as e:
            return bad_request(str(e))

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
            return not_found("item not found")

        children, _ = parse_id_list(target.get("child_ids", ""))
        if children:
            return bad_request("delete failed: please delete all child projects first")

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
            return bad_request(str(e))

        return jsonify({"ok": True})

