from __future__ import annotations

from flask import Blueprint, jsonify, send_file

from ..backup import backup_now, get_backup_status
from ..storage_csv import get_data_file


def register_backup_routes(bp: Blueprint) -> None:
    @bp.get("/api/backup/status")
    def backup_status():
        return jsonify(get_backup_status())

    @bp.post("/api/backup")
    def backup_manual():
        res = backup_now(kind="manual")
        if not res.ok:
            return jsonify({"error": res.error or "backup failed"}), 500
        return jsonify({"ok": True, "file": res.file, "at_utc": res.at_utc, "kind": res.kind})

    @bp.get("/api/data/export")
    def export_data_csv():
        path = get_data_file()
        # Let browser pick destination; this streams current CSV.
        return send_file(
            path,
            as_attachment=True,
            download_name=path.name,
            mimetype="text/csv; charset=utf-8",
        )

