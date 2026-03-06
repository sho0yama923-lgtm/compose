#!/usr/bin/env python3

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


HOST = "127.0.0.1"
START_PORT = 8080
END_PORT = 8090
ROOT = Path(__file__).resolve().parent


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


def main():
    handler = partial(NoCacheHandler, directory=str(ROOT))

    for port in range(START_PORT, END_PORT + 1):
        try:
            httpd = ThreadingHTTPServer((HOST, port), handler)
            break
        except OSError:
            continue
    else:
        raise SystemExit(f"No free port found in {START_PORT}-{END_PORT}")

    url = f"http://{HOST}:{port}"
    print(url, flush=True)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
