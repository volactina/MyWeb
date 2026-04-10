from pathlib import Path

from flask import Flask

from .routes import bp as api_bp
from .backup import start_backup_thread


def create_app() -> Flask:
    root_dir = Path(__file__).resolve().parents[1]
    app = Flask(
        __name__,
        template_folder=str(root_dir / "templates"),
        static_folder=str(root_dir / "static"),
        static_url_path="/static",
    )
    app.register_blueprint(api_bp)
    start_backup_thread()
    return app

