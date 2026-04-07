from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Tuple


CSV_HEADERS = [
    "id",
    "title",
    "detail",
    "created_at",
    "updated_at",
    "urgency_level",
    "project_status",
    "priority",
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
    "priority": "0",
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
    if normalized.get("priority") is None:
        normalized["priority"] = "0"

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
    ids = sorted(set(ids))
    return ids, ";".join(str(i) for i in ids)

