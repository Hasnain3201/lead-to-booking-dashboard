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
from io import BytesIO
from pathlib import Path

from PIL import Image
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
    ("hero", DESKTOP, "day", "window.scrollTo(0, 0)", False),
    ("current", DESKTOP, "day", "hideDock(); scrollToId('current', 40)", False),
    ("tide", DESKTOP, "day", "hideDock(); scrollToId('tide', -30)", False),
    ("sources", DESKTOP, "day", "hideDock(); scrollToId('sources', -30)", False),
    ("attention", DESKTOP, "day", "hideDock(); scrollToId('attention', -30)", False),
    ("records", DESKTOP, "day", "hideDock(); scrollToId('records', -30)", False),
    ("brief", DESKTOP, "day", "hideDock(); scrollToId('brief', -30)", False),
    ("intake", DESKTOP, "day", "hideDock(); scrollToId('intake', -30)", False),
    (
        "drawer",
        DESKTOP,
        "day",
        "scrollToId('records', -30); searchRecord('I0391')",
        False,
    ),
    ("palette", DESKTOP, "day", "window.scrollTo(0,0); openPalette('I04')", False),
    (
        "failure",
        DESKTOP,
        "day",
        "clickText('Load a broken sample');setTimeout(() => clickText('Validate and import'), 900)",
        False,
    ),
    ("dark-hero", DESKTOP, "night", "window.scrollTo(0, 0)", False),
    ("dark-current", DESKTOP, "night", "hideDock(); scrollToId('current', 40)", False),
    ("mobile-hero", MOBILE, "day", "window.scrollTo(0, 0)", False),
    ("mobile-sources", MOBILE, "day", "hideDock(); scrollToId('sources', -10)", False),
    ("mobile-attention", MOBILE, "day", "hideDock(); scrollToId('attention', -10)", False),
]

HELPERS = """
window.scrollToId = (id, offset) => {
  const el = document.getElementById(id);
  const top = el.getBoundingClientRect().top + window.scrollY + offset;
  document.documentElement.style.scrollBehavior = 'auto';
  window.scrollTo(0, top);
};
window.clickFirst = (selector) => document.querySelector(selector)?.click();
window.clickText = (text) => [...document.querySelectorAll('button')]
  .find((b) => b.textContent.trim().startsWith(text))?.click();
window.searchRecord = (id) => {
  const input = document.querySelector('.records .search input');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, id);
  input.dispatchEvent(new Event('input', {bubbles: true}));
  setTimeout(() => document.querySelector('.records tr.clickable')?.click(), 400);
};
window.hideDock = () => {
  const dock = document.querySelector('.dock');
  if (dock) dock.style.visibility = 'hidden';
};
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
        self.events = []

    def send(self, method, **params):
        self.next_id += 1
        self.ws.send(json.dumps({"id": self.next_id, "method": method, "params": params}))
        while True:
            message = json.loads(self.ws.recv())
            if message.get("id") == self.next_id:
                if "error" in message:
                    raise RuntimeError(f"{method}: {message['error']}")
                return message.get("result", {})
            if "method" in message:
                self.events.append(message["method"])

    def wait_event(self, method):
        while method not in self.events:
            message = json.loads(self.ws.recv())
            if "method" in message:
                self.events.append(message["method"])
        self.events.remove(method)

    def evaluate(self, expression):
        result = self.send(
            "Runtime.evaluate", expression=expression, awaitPromise=True, returnByValue=True
        )
        return result.get("result", {}).get("value")


def save(data, path, jpeg):
    if not jpeg:
        path.write_bytes(data)
        return path
    path = path.with_suffix(".jpg")
    Image.open(BytesIO(data)).convert("RGB").save(path, quality=86, optimize=True, progressive=True)
    return path


def record(page, selector, path, frames=72, step_ms=50, width=1200):
    """Record an element as an animated WebP, stepping Chrome's virtual clock per frame."""
    page.evaluate(
        "document.querySelector('.dock').style.visibility = 'hidden';"
        f"document.querySelector('{selector}').scrollIntoView({{block: 'center'}})"
    )
    time.sleep(0.5)
    rect = page.evaluate(
        f"(() => {{ const r = document.querySelector('{selector}').getBoundingClientRect();"
        " return {x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height}; })()"
    )
    clip = {**rect, "scale": 1}
    page.send("Emulation.setVirtualTimePolicy", policy="pause")
    images = []
    for _ in range(frames):
        page.send("Emulation.setVirtualTimePolicy", policy="advance", budget=step_ms)
        page.wait_event("Emulation.virtualTimeBudgetExpired")
        shot = page.send("Page.captureScreenshot", format="png", clip=clip)
        image = Image.open(BytesIO(base64.b64decode(shot["data"]))).convert("RGB")
        ratio = width / image.width
        images.append(image.resize((width, round(image.height * ratio)), Image.LANCZOS))
    images[0].save(
        path, save_all=True, append_images=images[1:], duration=step_ms, loop=0, quality=72
    )
    return path


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


def prepare(page, args, viewport, theme, script):
    width, height = viewport
    page.send(
        "Emulation.setDeviceMetricsOverride",
        width=width,
        height=height,
        deviceScaleFactor=args.scale,
        mobile=width < 600,
    )
    theme_script = page.send(
        "Page.addScriptToEvaluateOnNewDocument",
        source=f"localStorage.setItem('leadflow-theme-v2', '{theme}');",
    )
    page.send("Page.navigate", url=args.url)
    page.evaluate(
        "new Promise(r => { const t = () => document.querySelector('#current') "
        "? r(true) : setTimeout(t, 100); t(); })"
    )
    page.send("Page.removeScriptToEvaluateOnNewDocument", identifier=theme_script["identifier"])
    time.sleep(2.2)
    page.evaluate(HELPERS)
    page.evaluate(script)
    time.sleep(2.6)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8765/")
    parser.add_argument("--out", type=Path, default=Path("exports/shots"))
    parser.add_argument("--only", nargs="*", help="Capture only these shot names")
    parser.add_argument("--scale", type=float, default=2)
    parser.add_argument("--jpeg", action="store_true", help="Save compressed JPEG files")
    parser.add_argument("--animate", action="store_true", help="Also record the flow animation")
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
            for name, viewport, theme, script, full in SHOTS:
                if args.only and name not in args.only:
                    continue
                prepare(page, args, viewport, theme, script)
                shot = page.send("Page.captureScreenshot", format="png", captureBeyondViewport=full)
                data = base64.b64decode(shot["data"])
                print(save(data, args.out / f"{name}.png", args.jpeg))
            if args.animate:
                # Virtual time stays paused afterwards, so the recording must come last.
                prepare(page, args, DESKTOP, "day", "hideDock()")
                print(record(page, ".current", args.out / "current.webp"))
    finally:
        chrome.terminate()
        shutil.rmtree(profile, ignore_errors=True)
    combine_mobile(args.out)


def combine_mobile(out):
    """Place the mobile captures side by side on one dark canvas."""
    paths = [next(out.glob(f"mobile-{name}.*"), None) for name in ("hero", "sources", "attention")]
    if not all(paths):
        return
    shots = [Image.open(path).convert("RGB") for path in paths]
    gap = shots[0].width // 12
    width = sum(shot.width for shot in shots) + gap * (len(shots) + 1)
    height = max(shot.height for shot in shots) + gap * 2
    canvas = Image.new("RGB", (width, height), (234, 230, 222))
    x = gap
    for shot in shots:
        canvas.paste(shot, (x, gap))
        x += shot.width + gap
    path = out / "mobile.jpg"
    canvas.save(path, quality=86, optimize=True, progressive=True)
    print(path)


if __name__ == "__main__":
    main()
