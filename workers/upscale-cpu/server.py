#!/usr/bin/env python3
"""Worker privado de super-resolução 4x, ONNX CPU. Não publicar na internet."""
import hmac
import io
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps, UnidentifiedImageError

MODEL = os.environ["UPSCALE_MODEL_PATH"]
TOKEN = os.environ["UPSCALE_WORKER_TOKEN"]
HOST = os.getenv("UPSCALE_HOST", "127.0.0.1")
PORT = int(os.getenv("UPSCALE_PORT", "3391"))
Image.MAX_IMAGE_PIXELS = 1_000_000
opts = ort.SessionOptions()
opts.intra_op_num_threads = 1
opts.inter_op_num_threads = 1
session = ort.InferenceSession(MODEL, sess_options=opts, providers=["CPUExecutionProvider"])
input_name = session.get_inputs()[0].name
lock = threading.Lock()

def upscale(raw):
    with Image.open(io.BytesIO(raw)) as src:
        if src.format not in ("PNG", "JPEG", "WEBP"):
            raise ValueError("unsupported format")
        if src.width > 512 or src.height > 512 or src.width * src.height > 262144:
            raise ValueError("image too large")
        img = ImageOps.exif_transpose(src).convert("RGB")
    array = np.asarray(img, dtype=np.float32).transpose(2, 0, 1)[None] / 255.0
    result = session.run(None, {input_name: array})[0]
    if result.shape != (1, 3, img.height * 4, img.width * 4):
        raise RuntimeError("unexpected output")
    pixels = np.clip(result[0].transpose(1, 2, 0) * 255, 0, 255).astype(np.uint8)
    output = io.BytesIO()
    Image.fromarray(pixels).save(output, format="WEBP", quality=88, method=4)
    return output.getvalue()

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/health":
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true,"provider":"CPUExecutionProvider"}')

    def do_POST(self):
        auth = self.headers.get("Authorization", "")
        if not hmac.compare_digest(auth, "Bearer " + TOKEN):
            self.send_error(401)
            return
        if self.path != "/upscale":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 2 * 1024 * 1024:
                self.send_error(413)
                return
            raw = self.rfile.read(length)
            if not lock.acquire(blocking=False):
                self.send_error(429)
                return
            try:
                result = upscale(raw)
            finally:
                lock.release()
            self.send_response(200)
            self.send_header("Content-Type", "image/webp")
            self.send_header("Content-Length", str(len(result)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(result)
        except (ValueError, UnidentifiedImageError, OSError):
            self.send_error(422)
        except Exception:
            self.send_error(500)

if __name__ == "__main__":
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
