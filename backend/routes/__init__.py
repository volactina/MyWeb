from __future__ import annotations

from flask import Blueprint, render_template

from .items import register_item_routes


bp = Blueprint("api", __name__)


@bp.get("/")
def home():
    return render_template("index.html")


register_item_routes(bp)

