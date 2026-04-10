from __future__ import annotations

from typing import Dict, List


def _has_deadline(item: Dict[str, str]) -> bool:
    return str(item.get("urgency_level", "0")) == "4" and bool(str(item.get("deadline_value", "")).strip())


def _deadline_value(item: Dict[str, str]) -> str:
    return str(item.get("deadline_value", "")).strip()


def apply_prerequisite_deadline_constraints(
    items: List[Dict[str, str]],
    *,
    raw_prereqs: Dict[int, List[int]],
    by_id: Dict[int, Dict[str, str]],
) -> None:
    """
    If a blocked item has a deadline (urgency_level=4 + deadline_value),
    then all its prerequisite items' deadlines must be no later than that deadline,
    unless they already have an earlier deadline.

    Implementation detail:
    - For prereqs without a deadline, set their deadline to the blocked item's deadline.
    - For prereqs with a later deadline, reduce to the blocked item's deadline.
    - For prereqs with an earlier deadline, keep as-is.
    """
    for item in items:
        this_id = int(item["id"])
        prereqs = raw_prereqs.get(this_id, [])
        if not prereqs:
            continue

        if str(item.get("project_status", "0")) != "4":
            continue

        if not _has_deadline(item):
            continue

        ddl = _deadline_value(item)
        if not ddl:
            continue

        for pre in prereqs:
            pre_item = by_id.get(int(pre))
            if not pre_item:
                continue
            if _has_deadline(pre_item):
                pre_ddl = _deadline_value(pre_item)
                if pre_ddl and pre_ddl <= ddl:
                    continue
            pre_item["urgency_level"] = "4"
            pre_item["deadline_value"] = ddl

