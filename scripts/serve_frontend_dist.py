#!/usr/bin/env python
"""
Serve a prebuilt frontend dist directory with SPA history fallback.
"""

from __future__ import annotations

import argparse
import functools
import http.server
import os
from pathlib import Path


class SPARequestHandler(http.server.SimpleHTTPRequestHandler):
    """Serve static files and fallback to index.html for client-side routes."""

    def do_GET(self) -> None:  # noqa: N802 - inherited method name
        request_path = self.path.split("?", 1)[0].split("#", 1)[0]

        # Avoid masking backend/API routing mistakes.
        if request_path.startswith("/api/"):
            self.send_error(404, "API route is not served by frontend static server")
            return

        resolved_path = self.translate_path(request_path)
        if os.path.exists(resolved_path):
            super().do_GET()
            return

        self.path = "/index.html"
        super().do_GET()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve frontend dist with SPA fallback.")
    parser.add_argument("--directory", required=True, help="Path to frontend dist directory")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=3001, help="Bind port (default: 3001)")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    dist_dir = Path(args.directory).resolve()
    index_file = dist_dir / "index.html"

    if not index_file.exists():
        raise SystemExit(f"index.html not found in dist directory: {index_file}")

    handler = functools.partial(SPARequestHandler, directory=str(dist_dir))
    server = http.server.ThreadingHTTPServer((args.host, args.port), handler)

    print(f"Serving static frontend from {dist_dir}")
    print(f"Open: http://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
