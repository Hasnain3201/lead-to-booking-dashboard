"""Run with: python serve.py"""

import sys
from pathlib import Path

# Run directly from a checkout even when a host skips editable-install .pth files.
sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from leadflow.server import main  # noqa: E402

if __name__ == "__main__":
    main()
