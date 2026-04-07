import sys
from pathlib import Path


# Make repo root importable even when running from tests/unit/.
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

