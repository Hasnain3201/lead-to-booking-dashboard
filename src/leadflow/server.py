"""Run with: python -m leadflow.server"""

import argparse
import threading
import webbrowser

import uvicorn

from leadflow.api import DIST, create_app


def main():
    parser = argparse.ArgumentParser(description="Serve the Leadflow dashboard locally.")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    if not DIST.is_dir():
        print("Frontend build not found. Run: npm --prefix frontend ci")
        print("Then run: npm --prefix frontend run build")
    url = f"http://127.0.0.1:{args.port}"
    if not args.no_browser:
        threading.Timer(1.0, webbrowser.open, [url]).start()
    print(f"Leadflow running at {url} (Control-C to stop)")
    uvicorn.run(create_app(), host="127.0.0.1", port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
