from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Tuple


def _is_yyyy_mm_dd(s: str) -> bool:
    s = (s or "").strip()
    if not s or len(s) != 10:
        return False
    try:
        datetime.strptime(s, "%Y-%m-%d")
        return True
    except ValueError:
        return False


CSV_HEADERS = [
    "id",
    "title",
    "detail",
    "created_at",
    "updated_at",
    "urgency_level",
    "project_status",
    "project_category",
    "economic_benefit_expectation",
    "planned_execute_date",
    "planned_time",
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
    "project_status": "3",
    "project_category": "2",
    "economic_benefit_expectation": "4",
    "planned_execute_date": "",
    "planned_time": "",
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


def normalize_project_category(raw: str) -> str:
    """
    0 待定
    1 管理项目
    2 执行项目（缺省）
    3 灵感项目
    """
    raw = (raw or "").strip()
    return raw if raw in {"0", "1", "2", "3"} else "2"


def normalize_economic_benefit_expectation(raw: str) -> str:
    """
    0 已产生收益
    1 短期将产生收益
    2 短期不耗资金、未来能产生收益
    3 有望产生收益但不明朗
    4 不涉及（缺省）
    5 需投入资金、预期无收益或遥遥无期
    """
    raw = (raw or "").strip()
    return raw if raw in {"0", "1", "2", "3", "4", "5"} else "4"


def normalize_planned_execute_date(raw: str) -> str:
    raw = (raw or "").strip()
    if not raw:
        return ""
    return raw if _is_yyyy_mm_dd(raw) else ""


def normalize_planned_time(raw: str) -> str:
    raw = (str(raw) if raw is not None else "").strip()
    if not raw:
        return ""
    return raw[:64]


def normalize_project_status(raw: str) -> str:
    """
    Project status:
    0 待开始
    1 进行中
    2 已完成
    3 计划中
    4 阻塞
    5 中止
    """
    raw = (raw or "").strip()
    return raw if raw in {"0", "1", "2", "3", "4", "5"} else "3"


def normalize_item(row: Dict[str, str]) -> Dict[str, str]:
    normalized = {**DEFAULT_ITEM_FIELDS, **row}
    if normalized.get("urgency_level") is None or normalized["urgency_level"] == "":
        normalized["urgency_level"] = "0"
    if normalized.get("project_status") is None or normalized["project_status"] == "":
        normalized["project_status"] = "3"
    normalized["project_status"] = normalize_project_status(normalized["project_status"])
    normalized["project_category"] = normalize_project_category(str(normalized.get("project_category", "")))
    normalized["economic_benefit_expectation"] = normalize_economic_benefit_expectation(
        str(normalized.get("economic_benefit_expectation", ""))
    )
    normalized["planned_execute_date"] = normalize_planned_execute_date(
        str(normalized.get("planned_execute_date", ""))
    )
    normalized["planned_time"] = normalize_planned_time(str(normalized.get("planned_time", "")))
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

