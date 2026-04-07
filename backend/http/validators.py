from __future__ import annotations

from typing import Iterable, Optional, Set, Tuple

from flask import Request, jsonify


def parse_int_str(value: str) -> Optional[int]:
    raw = (value or "").strip()
    if not raw:
        return None
    if not raw.isdigit():
        return None
    return int(raw)


def parse_statuses_csv(value: str) -> Optional[Set[str]]:
    raw = (value or "").strip()
    if not raw:
        return None
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    # legacy normalization: "3" treated as "0"
    parts = ["0" if p == "3" else p for p in parts]
    if not parts or any(p not in {"0", "1", "2", "4", "5"} for p in parts):
        return None
    return set(parts)


def bad_request(message: str):
    return jsonify({"error": message}), 400


def not_found(message: str):
    return jsonify({"error": message}), 404

