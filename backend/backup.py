from __future__ import annotations

import json
import os
import shutil
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .storage_csv import ensure_data_file, get_data_file


ROOT_DIR = Path(__file__).resolve().parents[1]


def get_bak_dir() -> Path:
    raw = (os.environ.get("MYWEB_BAK_DIR") or "").strip()
    return (ROOT_DIR / "bak") if not raw else Path(raw).expanduser().resolve()


def get_state_file() -> Path:
    return get_bak_dir() / "backup_state.json"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _load_state() -> dict:
    state_file = get_state_file()
    if not state_file.exists():
        return {}
    try:
        return json.loads(state_file.read_text(encoding="utf-8") or "{}")
    except Exception:
        return {}


def _save_state(state: dict) -> None:
    bak_dir = get_bak_dir()
    state_file = get_state_file()
    bak_dir.mkdir(parents=True, exist_ok=True)
    state_file.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


@dataclass(frozen=True)
class BackupResult:
    ok: bool
    file: Optional[str] = None
    at_utc: Optional[str] = None
    kind: Optional[str] = None  # "auto" | "manual"
    error: Optional[str] = None


_lock = threading.Lock()


def get_backup_status() -> dict:
    st = _load_state()
    return {
        "last_backup_at_utc": st.get("last_backup_at_utc") or "",
        "last_backup_kind": st.get("last_backup_kind") or "",
        "last_backup_file": st.get("last_backup_file") or "",
        "backup_interval_sec": int(os.environ.get("MYWEB_BACKUP_INTERVAL_SEC", "600")),
    }


def _backup_filename(data_file: Path) -> str:
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    return f"{data_file.stem}-{ts}.csv"


def backup_now(*, kind: str) -> BackupResult:
    with _lock:
        try:
            ensure_data_file()
            data_file = get_data_file()
            bak_dir = get_bak_dir()
            bak_dir.mkdir(parents=True, exist_ok=True)
            dst = bak_dir / _backup_filename(data_file)
            shutil.copy2(str(data_file), str(dst))
            at = _utc_now_iso()
            st = _load_state()
            st.update({"last_backup_at_utc": at, "last_backup_kind": kind, "last_backup_file": dst.name})
            _save_state(st)
            return BackupResult(ok=True, file=dst.name, at_utc=at, kind=kind)
        except Exception as e:
            return BackupResult(ok=False, error=str(e))


def backup_if_due() -> Optional[BackupResult]:
    interval = int(os.environ.get("MYWEB_BACKUP_INTERVAL_SEC", "600"))
    if interval <= 0:
        return None
    st = _load_state()
    last_at = st.get("last_backup_at_utc") or ""
    if last_at:
        try:
            # parse ISO; accept both Z and +00:00
            dt = datetime.fromisoformat(last_at.replace("Z", "+00:00"))
            last_ts = dt.timestamp()
        except Exception:
            last_ts = 0.0
    else:
        last_ts = 0.0

    if time.time() - last_ts < interval:
        return None
    return backup_now(kind="auto")


def start_backup_thread() -> None:
    # In test mode, never start background thread.
    if (os.environ.get("MYWEB_TEST_MODE") or "").strip() in {"1", "true", "True", "yes", "YES"}:
        return

    def _loop() -> None:
        while True:
            try:
                backup_if_due()
            except Exception:
                pass
            time.sleep(5)

    t = threading.Thread(target=_loop, name="myweb-backup", daemon=True)
    t.start()

