"""Serve the existing static production build on the local computer only."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

output = Path(__file__).resolve().parents[1] / "frontend" / "out"
if not (output / "index.html").is_file():
    raise SystemExit("Run npm ci and npm run build from frontend before starting.")
ThreadingHTTPServer(("127.0.0.1", 3000), partial(SimpleHTTPRequestHandler, directory=str(output))).serve_forever()
