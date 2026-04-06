import csv
from datetime import datetime
from pathlib import Path
from typing import Dict, List

from flask import Flask, jsonify, render_template, request


app = Flask(__name__)

DATA_FILE = Path(__file__).resolve().parent / "database.csv"
CSV_HEADERS = ["id", "title", "detail", "created_at", "updated_at"]


def current_timestamp() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def ensure_data_file() -> None:
    if DATA_FILE.exists():
        return
    with DATA_FILE.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADERS)
        writer.writeheader()


def read_items() -> List[Dict[str, str]]:
    ensure_data_file()
    with DATA_FILE.open("r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = [row for row in reader if row.get("id")]
    rows.sort(key=lambda x: int(x["id"]))
    return rows


def write_items(items: List[Dict[str, str]]) -> None:
    with DATA_FILE.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADERS)
        writer.writeheader()
        writer.writerows(items)


def next_id(items: List[Dict[str, str]]) -> int:
    if not items:
        return 1
    return max(int(item["id"]) for item in items) + 1


@app.get("/")
def home():
    ensure_data_file()
    return render_template("index.html")


@app.get("/api/items")
def list_items():
    title_query = request.args.get("title", "").strip().lower()
    detail_query = request.args.get("detail", "").strip().lower()
    items = read_items()

    if title_query:
        items = [i for i in items if title_query in i["title"].lower()]
    if detail_query:
        items = [i for i in items if detail_query in i["detail"].lower()]

    return jsonify(items)


@app.post("/api/items")
def create_item():
    payload = request.get_json(silent=True) or {}
    title = (payload.get("title") or "").strip()
    detail = (payload.get("detail") or "").strip()

    if not title:
        return jsonify({"error": "title is required"}), 400

    items = read_items()
    now = current_timestamp()
    new_item = {
        "id": str(next_id(items)),
        "title": title,
        "detail": detail,
        "created_at": now,
        "updated_at": now,
    }
    items.append(new_item)
    write_items(items)

    return jsonify(new_item), 201


@app.put("/api/items/<int:item_id>")
def update_item(item_id: int):
    payload = request.get_json(silent=True) or {}
    title = (payload.get("title") or "").strip()
    detail = (payload.get("detail") or "").strip()

    if not title:
        return jsonify({"error": "title is required"}), 400

    items = read_items()
    target = None
    for item in items:
        if int(item["id"]) == item_id:
            target = item
            break

    if target is None:
        return jsonify({"error": "item not found"}), 404

    target["title"] = title
    target["detail"] = detail
    target["updated_at"] = current_timestamp()
    write_items(items)

    return jsonify(target)


@app.delete("/api/items/<int:item_id>")
def delete_item(item_id: int):
    items = read_items()
    kept = [item for item in items if int(item["id"]) != item_id]

    if len(kept) == len(items):
        return jsonify({"error": "item not found"}), 404

    write_items(kept)
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(debug=True)
