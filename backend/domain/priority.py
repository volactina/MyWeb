from __future__ import annotations

from datetime import datetime
from typing import Dict, List

from ..normalize import normalize_project_status


def _parse_ts(ts: str) -> int:
    ts = (ts or "").strip()
    if not ts:
        return 0
    try:
        return int(datetime.strptime(ts, "%Y-%m-%d %H:%M:%S").timestamp())
    except ValueError:
        return 0


def compute_priority(items: List[Dict[str, str]]) -> None:
    # Derived priority (higher first). Stored as string for CSV compatibility.
    status_weight = {
        "1": 500,  # 进行中
        "0": 400,  # 待开始
        "4": 300,  # 阻塞
        "2": 100,  # 已完成
        "5": 0,    # 中止
    }

    for item in items:
        st = normalize_project_status(str(item.get("project_status", "0")))
        urg_raw = str(item.get("urgency_level", "0")).strip()
        urg = int(urg_raw) if urg_raw.isdigit() else 0
        urg = max(0, min(4, urg))
        updated_epoch = _parse_ts(str(item.get("updated_at", "")))
        score = status_weight.get(st, 0) * 1_000_000_000 + urg * 1_000_000 + updated_epoch
        item["priority"] = str(score)

