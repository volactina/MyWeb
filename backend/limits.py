from __future__ import annotations

import os
from typing import Dict, List, Optional


def max_in_progress_items() -> int:
    """
    Max concurrent in-progress (进行中) items. 0 or negative = unlimited.
    Override with env MYWEB_MAX_IN_PROGRESS (default 5).
    """
    raw = (os.environ.get("MYWEB_MAX_IN_PROGRESS") or "5").strip()
    try:
        return int(raw)
    except ValueError:
        return 5


def count_in_progress(items: List[Dict[str, str]], *, exclude_id: Optional[int] = None) -> int:
    c = 0
    for i in items:
        if exclude_id is not None and int(i["id"]) == exclude_id:
            continue
        if str(i.get("project_status", "0")) == "1":
            c += 1
    return c


def in_progress_limit_message() -> str:
    m = max_in_progress_items()
    return f"进行中项目数量已达上限（最多 {m} 条），请先将部分项目改为计划中"


def can_transition_to_in_progress(
    items: List[Dict[str, str]], *, item_id: Optional[int], previous_status: str
) -> bool:
    if str(previous_status) == "1":
        return True
    cap = max_in_progress_items()
    if cap <= 0:
        return True
    exclude = item_id if item_id is not None else None
    return count_in_progress(items, exclude_id=exclude) < cap
