from __future__ import annotations

from typing import Dict, List, Set

from .normalize import parse_id_list


def build_edges(items: List[Dict[str, str]]) -> Dict[int, Set[int]]:
    """
    Build directed edges (for cycle detection):
    - parent -> child (hierarchy)
    - prerequisite -> project (dependency)
    """
    edges: Dict[int, Set[int]] = {}

    def add_edge(a: int, b: int) -> None:
        edges.setdefault(a, set()).add(b)

    for item in items:
        this_id = int(item["id"])
        parent_list, _ = parse_id_list(item.get("parent_ids", ""))
        child_list, _ = parse_id_list(item.get("child_ids", ""))
        prereq_list, _ = parse_id_list(item.get("prerequisite_ids", ""))

        for p in parent_list:
            add_edge(p, this_id)
        for c in child_list:
            add_edge(this_id, c)
        for pre in prereq_list:
            add_edge(pre, this_id)

    return edges


def validate_references_and_cycles(items: List[Dict[str, str]]) -> None:
    id_set = {int(i["id"]) for i in items}

    for item in items:
        this_id = int(item["id"])
        parents, _ = parse_id_list(item.get("parent_ids", ""))
        children, _ = parse_id_list(item.get("child_ids", ""))
        prereqs, _ = parse_id_list(item.get("prerequisite_ids", ""))

        if this_id in parents or this_id in children or this_id in prereqs:
            raise ValueError("referenced ids cannot include itself")

        for ref_id in parents + children + prereqs:
            if ref_id not in id_set:
                raise ValueError(f"referenced id '{ref_id}' does not exist")

    edges = build_edges(items)
    visited: Set[int] = set()
    in_stack: Set[int] = set()

    def dfs(u: int) -> None:
        visited.add(u)
        in_stack.add(u)
        for v in edges.get(u, set()):
            if v not in visited:
                dfs(v)
            elif v in in_stack:
                raise ValueError("cycle detected in project dependencies")
        in_stack.remove(u)

    for node in id_set:
        if node not in visited:
            dfs(node)


def compute_paths(items: List[Dict[str, str]]) -> Dict[int, str]:
    """
    Compute multi-level path for each item.
    Paths are id-based, like '1/4/9'. Root item -> '9'.
    """
    id_set = {int(i["id"]) for i in items}

    parents_map: Dict[int, Set[int]] = {i: set() for i in id_set}
    for item in items:
        this_id = int(item["id"])
        parent_list, _ = parse_id_list(item.get("parent_ids", ""))
        for p in parent_list:
            parents_map[this_id].add(p)

    for item in items:
        this_id = int(item["id"])
        child_list, _ = parse_id_list(item.get("child_ids", ""))
        for c in child_list:
            if c in parents_map:
                parents_map[c].add(this_id)

    memo: Dict[int, List[str]] = {}

    def paths_to(n: int) -> List[str]:
        if n in memo:
            return memo[n]
        ps = sorted(parents_map.get(n, set()))
        if not ps:
            memo[n] = [str(n)]
            return memo[n]
        all_paths: List[str] = []
        for p in ps:
            for prefix in paths_to(p):
                all_paths.append(f"{prefix}/{n}")
        seen: Set[str] = set()
        unique: List[str] = []
        for x in all_paths:
            if x in seen:
                continue
            seen.add(x)
            unique.append(x)
        memo[n] = unique
        return unique

    out: Dict[int, str] = {}
    for n in sorted(id_set):
        out[n] = " | ".join(paths_to(n))
    return out


def subtree_ids(root_id: int, items: List[Dict[str, str]]) -> Set[int]:
    by_id = {int(i["id"]): i for i in items}
    if root_id not in by_id:
        raise ValueError("root_id does not exist")

    children_map: Dict[int, List[int]] = {}
    for item in items:
        this_id = int(item["id"])
        child_list, _ = parse_id_list(item.get("child_ids", ""))
        children_map[this_id] = child_list

    allowed: Set[int] = set()
    stack = [root_id]
    while stack:
        cur = stack.pop()
        if cur in allowed:
            continue
        allowed.add(cur)
        for c in children_map.get(cur, []):
            stack.append(c)
    return allowed

