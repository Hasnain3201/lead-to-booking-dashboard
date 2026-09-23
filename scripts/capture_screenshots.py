"""Capture interface screenshots with headless Chrome for review and the README.

Start the app first (python serve.py --no-browser), then run:
    python scripts/capture_screenshots.py --out docs/assets
"""

import argparse
import base64
import json
import shutil
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

from websockets.sync.client import connect

CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "google-chrome",
    "chromium",
    "chromium-browser",
]

DESKTOP = (1440, 900)
MOBILE = (390, 844)

# name, viewport, theme, JavaScript run before capture, capture full page
SHOTS = [
    ("hero", DESKTOP, "night", "window.scrollTo(0, 0)", False),
    ("current", DESKTOP, "night", "scrollToId('current', -30)", False),
    ("tide", DESKTOP, "night", "scrollToId('tide', -30)", False),
    ("sources", DESKTOP, "night", "scrollToId('sources', -30)", False),
    ("attention", DESKTOP, "night", "scrollToId('attention', -30)", False),
    ("records", DESKTOP, "night", "scrollToId('records', -30)", False),
    ("brief", DESKTOP, "night", "scrollToId('brief', -30)", False),
    ("intake", DESKTOP, "night", "scrollToId('intake', -30)", False),
    ("drawer", DESKTOP, "night", "scrollToId('records', -30); clickFirst('tr.clickable')", False),
    ("palette", DESKTOP, "night", "window.scrollTo(0,0); openPalette('I04')", False),
    ("day-hero", DESKTOP, "day", "window.scrollTo(0, 0)", False),
    ("day-current", DESKTOP, "day", "scrollToId('current', -30)", False),
    ("mobile-hero", MOBILE, "night", "window.scrollTo(0, 0)", False),
    ("mobile-current", MOBILE, "night", "scrollToId('current', -10)", False),
    ("mobile-attention", MOBILE, "night", "scrollToId('attention', -10)", False),
]

HELPERS = """
window.scrollToId = (id, offset) => {
  const el = document.getElementById(id);
  const top = el.getBoundingClientRect().top + window.scrollY + offset;
  document.documentElement.style.scrollBehavior = 'auto';
  window.scrollTo(0, top);
};
window.clickFirst = (selector) => document.querySelector(selector)?.click();
window.openPalette = (query) => {
  const init = {key: 'k', metaKey: true, bubbles: true};
  document.body.dispatchEvent(new KeyboardEvent('keydown', init));
  setTimeout(() => {
    const input = document.querySelector('.palette input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, query);
    input.dispatchEvent(new Event('input', {bubbles: true}));
  }, 400);
};
"""


class Page:
    def __init__(self, ws):
        self.ws = ws
        self.next_id = 0

    def send(self, method, **params):
        self.next_id += 1
        self.ws.send(json.dumps({"id": self.next_id, "method": method, "params": params}))
        while True:
            message = json.loads(self.ws.recv())
            if message.get("id") == self.next_id:
                if "error" in message:
                    raise RuntimeError(f"{method}: {message['error']}")
                return message.get("result", {})

    def evaluate(self, expression):
        return self.send("Runtime.evaluate", expression=expression, awaitPromise=True)


def find_chrome():
    for candidate in CHROME_CANDIDATES:
        if Path(candidate).exists() or shutil.which(candidate):
            return candidate
    raise SystemExit("Google Chrome or Chromium is required for screenshots.")


def wait_for(url, attempts=150):
    for _ in range(attempts):
        try:
            with urllib.request.urlopen(url) as response:
                return json.loads(response.read())
        except OSError:
            time.sleep(0.2)
    raise SystemExit(f"Could not reach {url}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8765/")
    parser.add_argument("--out", type=Path, default=Path("exports/shots"))
    parser.add_argument("--only", nargs="*", help="Capture only these shot names")
    parser.add_argument("--scale", type=float, default=2)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    port = 9333
    profile = tempfile.mkdtemp(prefix="leadflow-chrome-")
    chrome = subprocess.Popen(
        [
            find_chrome(),
            "--headless=new",
            f"--remote-debugging-port={port}",
            f"--user-data-dir={profile}",
            "--hide-scrollbars",
            "--force-color-profile=srgb",
            "--no-first-run",
            "about:blank",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        wait_for(f"http://127.0.0.1:{port}/json/version")
        target = next(t for t in wait_for(f"http://127.0.0.1:{port}/json") if t["type"] == "page")
        with connect(target["webSocketDebuggerUrl"], max_size=64 * 1024 * 1024) as ws:
            page = Page(ws)
            page.send("Page.enable")
            for name, (width, height), theme, script, full in SHOTS:
                if args.only and name not in args.only:
                    continue
                page.send(
                    "Emulation.setDeviceMetricsOverride",
                    width=width,
                    height=height,
                    deviceScaleFactor=args.scale,
                    mobile=width < 600,
                )
                page.send(
                    "Page.addScriptToEvaluateOnNewDocument",
                    source=f"localStorage.setItem('leadflow-theme', '{theme}');",
                )
                page.send("Page.navigate", url=args.url)
                page.evaluate(
                    "new Promise(r => { const t = () => document.querySelector('#current') "
                    "? r(true) : setTimeout(t, 100); t(); })"
                )
                time.sleep(2.2)
                page.evaluate(HELPERS)
                page.evaluate(script)
                time.sleep(2.6)
                shot = page.send("Page.captureScreenshot", format="png", captureBeyondViewport=full)
                path = args.out / f"{name}.png"
                path.write_bytes(base64.b64decode(shot["data"]))
                print(path)
    finally:
        chrome.terminate()
        shutil.rmtree(profile, ignore_errors=True)


if __name__ == "__main__":
    main()
