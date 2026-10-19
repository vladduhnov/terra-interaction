"""Stage the static prototype for GitHub Pages. No third-party dependencies."""
from pathlib import Path
import shutil
import json
import os

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "dist"
FILES = (
    "index.html", "workspace.css", "workspace.js", "map.html",
    "input-showcase.html", "Assistant - Typing Right Thinking.json",
    "Assistant-Typing Right.json", "demo-assets.csv",
)

# Validate everything before touching the generated output.
for name in (*FILES, "Icons", "geolava-assets"):
    if not (ROOT / name).exists():
        raise FileNotFoundError(f"Missing site asset: {name}")
token = os.environ.get("MAPBOX_ACCESS_TOKEN", "").strip()
if not token:
    raise RuntimeError("Set MAPBOX_ACCESS_TOKEN before building the site.")
if not token.startswith("pk."):
    raise RuntimeError("Use a browser-public Mapbox token beginning with pk.")
OUTPUT.mkdir(exist_ok=True)
for name in FILES:
    shutil.copy2(ROOT / name, OUTPUT / name)
for name in ("Icons", "geolava-assets"):
    shutil.copytree(ROOT / name, OUTPUT / name, dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns(".DS_Store"))
(OUTPUT / "config.js").write_text("window.GEOLAVA_CONFIG = " + json.dumps({"mapboxAccessToken": token}) + ";\n")
(OUTPUT / ".nojekyll").touch()
print(f"Static site ready: {OUTPUT}")
