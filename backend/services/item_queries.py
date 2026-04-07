from __future__ import annotations

from typing import Dict, Iterable, List, Optional, Set


def apply_filters(
    items: List[Dict[str, str]],
    *,
    title_query: str = "",
    detail_query: str = "",
    root_id: Optional[int] = None,
    parent_id: Optional[int] = None,
    allowed_statuses: Optional[Set[str]] = None,
    all_flag: bool = False,
    subtree_ids_fn=None,
) -> List[Dict[str, str]]:
    out = list(items)

    if parent_id is not None:
        out = [i for i in out if str(i.get("parent_ids", "")).strip() == str(parent_id)]
    elif root_id is not None:
        if subtree_ids_fn is None:
            raise ValueError("subtree_ids_fn is required when filtering by root_id")
        allowed = subtree_ids_fn(int(root_id), out)
        rid = int(root_id)
        out = [i for i in out if int(i["id"]) in allowed and int(i["id"]) != rid]
    else:
        if not all_flag:
            out = [i for i in out if not str(i.get("parent_ids", "")).strip()]

    t = (title_query or "").strip().lower()
    if t:
        out = [i for i in out if t in str(i.get("title", "")).lower()]
    d = (detail_query or "").strip().lower()
    if d:
        out = [i for i in out if d in str(i.get("detail", "")).lower()]

    if allowed_statuses:
        out = [i for i in out if str(i.get("project_status", "0")) in allowed_statuses]

    return out


def sort_by_priority(items: List[Dict[str, str]]) -> None:
    def priority_key(x: Dict[str, str]) -> tuple[int, int]:
        p_raw = str(x.get("priority", "0")).strip()
        p = int(p_raw) if p_raw.lstrip("-").isdigit() else 0
        return (-p, int(x["id"]))

    items.sort(key=priority_key)

