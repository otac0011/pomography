#!/usr/bin/env python3
"""Dev server for Pomona: static files (no caching) + two local-only helpers used by tools/bake.html.

    python tools/serve.py [port]          # default 8190

  GET  /__climate_list     -> JSON list of region ids that have raw weather cached in cache/climate/
  POST /__save?name=NAME   -> writes the request body to assets/NAME.json (NAME must be [a-z0-9-]+)
"""
import http.server, json, os, re, socketserver, sys
from urllib.parse import urlparse, parse_qs

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8190


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/__climate_list":
            d = os.path.join(ROOT, "cache", "climate")
            ids = sorted(f[:-5] for f in os.listdir(d) if f.endswith(".json")) if os.path.isdir(d) else []
            b = json.dumps(ids).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(b)))
            self.end_headers()
            self.wfile.write(b)
            return
        super().do_GET()

    def do_POST(self):
        u = urlparse(self.path)
        if u.path == "/__save":
            name = parse_qs(u.query).get("name", [""])[0]
            if not re.fullmatch(r"[a-z0-9-]+", name):
                self.send_error(400, "bad name")
                return
            n = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(n)
            json.loads(body)  # must parse
            with open(os.path.join(ROOT, "assets", name + ".json"), "wb") as f:
                f.write(body)
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"saved %d bytes" % len(body))
            return
        self.send_error(404)

    def log_message(self, fmt, *args):
        pass


class T(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    print("Pomona dev server on http://localhost:%d/" % PORT)
    T(("127.0.0.1", PORT), H).serve_forever()
