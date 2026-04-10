from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Callable, Optional, TextIO


def atomic_write_text(
    path: Path,
    *,
    encoding: str = "utf-8",
    newline: Optional[str] = "",
    write_fn: Callable[[TextIO], None],
) -> None:
    """
    Atomically write a text file by writing to a temp file in the same directory
    then replacing the destination. This avoids partial/corrupted writes if the
    process is interrupted or concurrent readers access the file.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    fd, tmp_name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=str(path.parent))
    tmp_path = Path(tmp_name)
    try:
        with os.fdopen(fd, "w", encoding=encoding, newline=newline) as f:
            write_fn(f)
            f.flush()
            os.fsync(f.fileno())
        os.replace(str(tmp_path), str(path))
    finally:
        try:
            if tmp_path.exists():
                tmp_path.unlink()
        except OSError:
            pass

