from __future__ import annotations

from typing import Dict, List


def apply_prerequisite_blocking(
    items: List[Dict[str, str]],
    *,
    raw_prereqs: Dict[int, List[int]],
    by_id: Dict[int, Dict[str, str]],
) -> None:
    for item in items:
        this_id = int(item["id"])
        prereqs = raw_prereqs.get(this_id, [])
        incomplete: List[int] = []
        for pre in prereqs:
            pre_status = str(by_id.get(pre, {}).get("project_status", "0"))
            if pre_status != "2":
                incomplete.append(pre)

        if incomplete:
            item["project_status"] = "4"
            item["blocked_by_ids"] = ";".join(str(i) for i in sorted(set(incomplete)))
        else:
            item["blocked_by_ids"] = ""
            if prereqs and str(item.get("project_status", "0")) == "4":
                # Only auto-recover from "blocked" to "not started".
                # Otherwise keep user's chosen status (e.g. planned/in-progress) stable.
                item["project_status"] = "0"
            elif not prereqs and str(item.get("project_status", "0")) == "4":
                # If the last prerequisite edge is removed (e.g. "删除目标"),
                # unblock the item as well.
                item["project_status"] = "0"

