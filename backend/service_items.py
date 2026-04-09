from __future__ import annotations

from typing import Dict, List

from .domain_graph import subtree_ids, validate_references_and_cycles
from .domain.blocking import apply_prerequisite_blocking
from .domain.enrich import normalize_and_collect_relations, sync_bidirectional_and_enforce_single_parent
from .domain.paths import apply_paths
from .domain.priority import compute_priority
from .normalize import CSV_HEADERS
from .storage_csv import read_items_raw, write_items_raw


def next_id(items: List[Dict[str, str]]) -> int:
    if not items:
        return 1
    return max(int(item["id"]) for item in items) + 1


def enrich_and_normalize_items(items: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """
    - Normalize parent/child id lists to a stable format
    - Sync both directions:
      - If A lists parents: add A to each parent's children
      - If A lists children: add A to each child's parents
    - Enforce single-parent constraint
    - Validate existence + cycles
    - Apply prerequisite blocking rule
    - Compute multi-level path
    """
    ids, raw_parents, raw_children, raw_prereqs = normalize_and_collect_relations(items)
    sync_bidirectional_and_enforce_single_parent(
        items,
        ids=ids,
        raw_parents=raw_parents,
        raw_children=raw_children,
    )

    # Auto-category rule: if a project has any child projects, treat it as a management project.
    for item in items:
        if str(item.get("child_ids", "")).strip():
            item["project_category"] = "1"

    validate_references_and_cycles(items)

    by_id: Dict[int, Dict[str, str]] = {int(i["id"]): i for i in items}
    apply_prerequisite_blocking(items, raw_prereqs=raw_prereqs, by_id=by_id)
    apply_paths(items)
    compute_priority(items)
    return items


def read_items() -> List[Dict[str, str]]:
    rows, source_fields = read_items_raw()
    rows = enrich_and_normalize_items(rows)

    if any(h not in source_fields for h in CSV_HEADERS):
        write_items_raw(rows)
    return rows


def write_items(items: List[Dict[str, str]]) -> None:
    items = enrich_and_normalize_items(items)
    write_items_raw(items)


__all__ = [
    "read_items",
    "write_items",
    "next_id",
    "subtree_ids",
]

