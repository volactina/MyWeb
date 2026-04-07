from __future__ import annotations

import csv
from pathlib import Path
from typing import Dict, List

from .normalize import CSV_HEADERS, normalize_item


ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT_DIR / "database.csv"


def ensure_data_file() -> None:
    if DATA_FILE.exists():
        return
    with DATA_FILE.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADERS)
        writer.writeheader()


def read_items_raw() -> tuple[list[Dict[str, str]], list[str]]:
    ensure_data_file()
    with DATA_FILE.open("r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        source_fields = reader.fieldnames or []
        rows = [normalize_item(row) for row in reader if row.get("id")]
    rows.sort(key=lambda x: int(x["id"]))
    return rows, source_fields


def write_items_raw(items: List[Dict[str, str]]) -> None:
    with DATA_FILE.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADERS)
        writer.writeheader()
        writer.writerows(items)

