from __future__ import annotations

import csv
import os
from pathlib import Path
from typing import Dict, List

from .normalize import CSV_HEADERS, normalize_item
from .utils.atomic_write import atomic_write_text


ROOT_DIR = Path(__file__).resolve().parents[1]

_DEFAULT_DATA_FILE = ROOT_DIR / "database.csv"
_ENV_DATA_FILE = "MYWEB_DATA_FILE"
_ENV_TEST_MODE = "MYWEB_TEST_MODE"


def get_data_file() -> Path:
    """
    Allow tests to override the CSV path without touching real data:
      MYWEB_DATA_FILE=/path/to/testdatabase.csv
    """
    raw = (os.environ.get(_ENV_DATA_FILE) or "").strip()
    chosen = _DEFAULT_DATA_FILE if not raw else Path(raw).expanduser().resolve()

    # Strong isolation: if test mode is enabled, never allow writing to real database.csv.
    test_mode = (os.environ.get(_ENV_TEST_MODE) or "").strip() in {"1", "true", "True", "yes", "YES"}
    if test_mode:
        try:
            if chosen.resolve() == _DEFAULT_DATA_FILE.resolve():
                raise RuntimeError(
                    "TEST MODE is enabled but data file points to real database.csv. "
                    "Set MYWEB_DATA_FILE to a dedicated test CSV (e.g. tests/e2e/testdatabase.csv)."
                )
        except FileNotFoundError:
            # If resolve fails for some reason, still block the default path.
            if str(chosen) == str(_DEFAULT_DATA_FILE):
                raise RuntimeError(
                    "TEST MODE is enabled but data file points to real database.csv. "
                    "Set MYWEB_DATA_FILE to a dedicated test CSV."
                )

    return chosen


def ensure_data_file() -> None:
    data_file = get_data_file()
    if data_file.exists():
        return
    data_file.parent.mkdir(parents=True, exist_ok=True)
    with data_file.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADERS)
        writer.writeheader()


def read_items_raw() -> tuple[list[Dict[str, str]], list[str]]:
    ensure_data_file()
    data_file = get_data_file()
    with data_file.open("r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        source_fields = reader.fieldnames or []
        rows = [normalize_item(row) for row in reader if row.get("id")]
    rows.sort(key=lambda x: int(x["id"]))
    return rows, source_fields


def write_items_raw(items: List[Dict[str, str]]) -> None:
    data_file = get_data_file()
    data_file.parent.mkdir(parents=True, exist_ok=True)
    def _write(f) -> None:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADERS)
        writer.writeheader()
        writer.writerows(items)

    atomic_write_text(data_file, newline="", encoding="utf-8", write_fn=_write)

