"""Regressões do worker ONNX CPU; sem executar inferência nos testes HTTP."""
import http.client
import importlib.util
import os
import threading
import unittest
from http.server import ThreadingHTTPServer
from unittest.mock import patch

os.environ.setdefault("UPSCALE_MODEL_PATH", "/var/tmp/avila-upscale-model/model.onnx")
os.environ.setdefault("UPSCALE_WORKER_TOKEN", "test-token-1234567890")
spec = importlib.util.spec_from_file_location("worker", os.path.join(os.path.dirname(__file__), "server.py"))
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class WorkerHTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http = ThreadingHTTPServer(("127.0.0.1", 0), worker.Handler)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join(timeout=2)

    def request(self, method, path, body=b"", token=None):
        headers = {"Content-Length": str(len(body))}
        if token:
            headers["Authorization"] = "Bearer " + token
        conn = http.client.HTTPConnection("127.0.0.1", self.http.server_port, timeout=5)
        try:
            conn.request(method, path, body=body, headers=headers)
            response = conn.getresponse()
            return response.status, response.read()
        finally:
            conn.close()

    def test_health(self):
        status, body = self.request("GET", "/health")
        self.assertEqual(status, 200)
        self.assertIn(b"CPUExecutionProvider", body)

    def test_requires_token(self):
        self.assertEqual(self.request("POST", "/upscale", b"x")[0], 401)
        self.assertEqual(self.request("POST", "/upscale", b"x", "wrong")[0], 401)

    def test_rejects_oversized_payload(self):
        # Send headers only: server must reject before reading the body.
        conn = http.client.HTTPConnection("127.0.0.1", self.http.server_port, timeout=5)
        try:
            conn.putrequest("POST", "/upscale")
            conn.putheader("Authorization", "Bearer " + os.environ["UPSCALE_WORKER_TOKEN"])
            conn.putheader("Content-Length", str(2 * 1024 * 1024 + 1))
            conn.endheaders()
            self.assertEqual(conn.getresponse().status, 413)
        finally:
            conn.close()

    def test_rejects_invalid_image(self):
        self.assertEqual(self.request("POST", "/upscale", b"invalid", os.environ["UPSCALE_WORKER_TOKEN"])[0], 422)

    def test_success_and_busy(self):
        with patch.object(worker, "upscale", return_value=b"fake-webp"):
            status, body = self.request("POST", "/upscale", b"valid", os.environ["UPSCALE_WORKER_TOKEN"])
            self.assertEqual((status, body), (200, b"fake-webp"))
        worker.lock.acquire()
        try:
            self.assertEqual(self.request("POST", "/upscale", b"valid", os.environ["UPSCALE_WORKER_TOKEN"])[0], 429)
        finally:
            worker.lock.release()


if __name__ == "__main__":
    unittest.main()
