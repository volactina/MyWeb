from __future__ import annotations

from typing import Dict, List, Set, Tuple

from ..normalize import CSV_HEADERS, normalize_project_status, parse_id_list


def normalize_and_collect_relations(
    items: List[Dict[str, str]],
) -> Tuple[Set[int], Dict[int, List[int]], Dict[int, List[int]], Dict[int, List[int]]]:
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

    return ids, raw_parents, raw_children, raw_prereqs


def sync_bidirectional_and_enforce_single_parent(
    items: List[Dict[str, str]],
    *,
    ids: Set[int],
    raw_parents: Dict[int, List[int]],
    raw_children: Dict[int, List[int]],
) -> None:
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

