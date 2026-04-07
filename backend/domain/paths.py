from __future__ import annotations

from typing import Dict, List

from ..domain_graph import compute_paths


def apply_paths(items: List[Dict[str, str]]) -> None:
    paths = compute_paths(items)
    for item in items:
        item["path"] = paths.get(int(item["id"]), str(item["id"]))

