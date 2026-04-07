import os

from backend import create_app


app = create_app()


if __name__ == "__main__":
    port = int(os.environ.get("FLASK_RUN_PORT", "5000"))
    debug = (os.environ.get("MYWEB_DEBUG", "1").strip() != "0")
    app.run(debug=debug, port=port)
