from __future__ import annotations

from typing import Dict, List, Set

from .domain_graph import compute_paths, subtree_ids, validate_references_and_cycles
from .normalize import CSV_HEADERS, normalize_project_status, parse_id_list
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
    ids = {int(i["id"]) for i in items}

    raw_parents: Dict[int, List[int]] = {}
    raw_children: Dict[int, List[int]] = {}
    raw_prereqs: Dict[int, List[int]] = {}
    for item in items:
        this_id = int(item["id"])
        parents, parents_norm = parse_id_list(item.get("parent_ids", ""))
        children, children_norm = parse_id_list(item.get("child_ids", ""))
        prereqs, prereqs_norm = parse_id_list(item.get("prerequisite_ids", ""))
        item["parent_ids"] = parents_norm
        item["child_ids"] = children_norm
        item["prerequisite_ids"] = prereqs_norm
        raw_parents[this_id] = parents
        raw_children[this_id] = children
        raw_prereqs[this_id] = prereqs

        if str(item.get("urgency_level", "0")) != "4":
            item["deadline_value"] = ""

        item["project_status"] = normalize_project_status(str(item.get("project_status", "0")))

        for k in CSV_HEADERS:
            item.setdefault(k, "")

    edges: Dict[int, Set[int]] = {i: set() for i in ids}
    reverse_edges: Dict[int, Set[int]] = {i: set() for i in ids}

    def add_edge(p: int, c: int) -> None:
        if p in edges:
            edges[p].add(c)
        if c in reverse_edges:
            reverse_edges[c].add(p)

    for child_id, parents in raw_parents.items():
        for p in parents:
            add_edge(p, child_id)

    for parent_id, children in raw_children.items():
        for c in children:
            add_edge(parent_id, c)

    for item in items:
        this_id = int(item["id"])
        parent_list = sorted(reverse_edges.get(this_id, set()))
        child_list = sorted(edges.get(this_id, set()))
        if len(parent_list) > 1:
            raise ValueError(f"each project can only have one parent (id={this_id})")
        item["parent_ids"] = ";".join(str(i) for i in parent_list)
        item["child_ids"] = ";".join(str(i) for i in child_list)

    validate_references_and_cycles(items)

    by_id: Dict[int, Dict[str, str]] = {int(i["id"]): i for i in items}
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
            if prereqs:
                item["project_status"] = "0"

    paths = compute_paths(items)
    for item in items:
        item["path"] = paths.get(int(item["id"]), str(item["id"]))
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

