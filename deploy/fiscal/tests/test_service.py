"""Synthetic operational HTTP/PDF contract. No SEFAZ, certificates or customer XML."""
import io
import http.client
import json
from pathlib import Path
import sys
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from pypdf import PdfReader

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import build_server  # noqa: E402

XML = (Path(__file__).resolve().parents[3] / "tests/fixtures/nfe-entrada-qa.xml").read_text(encoding="utf-8")
SECRET = "qa-fiscal-server-key-" + "1" * 40


class FiscalServiceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = build_server(("127.0.0.1", 0), SECRET)
        cls.worker = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.worker.start()
        cls.origin = "http://127.0.0.1:" + str(cls.server.server_port)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.worker.join(timeout=3)

    def request(self, xml=XML, key=SECRET, path="/v1/documentos/nfe/danfe.pdf", extra=None):
        body = json.dumps({"xml": xml}).encode()
        headers = {"Content-Type": "application/json", "X-Fiscal-Service-Key": key, **(extra or {})}
        try:
            response = urlopen(Request(self.origin + path, data=body, headers=headers), timeout=10)
        except HTTPError as error:
            response = error
        with response:
            return response.status, response.headers, response.read()

    def test_authorized_complete_xml_produces_real_pdf_with_items(self):
        status, headers, body = self.request()
        self.assertEqual(status, 200)
        self.assertEqual(headers.get("Content-Type"), "application/pdf")
        self.assertIn("no-store", headers.get("Cache-Control"))
        text = " ".join(page.extract_text() for page in PdfReader(io.BytesIO(body)).pages)
        for value in ["FORNECEDOR SINTETICO QA", "Peca sintetica QA", "Acessorio sintetico QA", "123"]:
            self.assertIn(value, text)

    def test_authentication_precedes_xml_processing(self):
        status, _, body = self.request("not xml", key="wrong-key")
        self.assertEqual(status, 401)
        self.assertNotIn(SECRET.encode(), body)
        self.assertNotIn(b"not xml", body)

    def test_summary_denied_or_mismatched_protocol_never_produces_pdf(self):
        for xml in ["<resNFe/>", XML.replace("<cStat>100</cStat>", "<cStat>110</cStat>"),
                    XML.replace("<chNFe>", "<chNFe>9")]:
            with self.subTest(xml_kind=xml[:15]):
                self.assertEqual(self.request(xml)[0], 422)

    def test_doctype_entities_and_large_payload_are_rejected(self):
        self.assertEqual(self.request('<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]>' + XML)[0], 422)
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        try:
            connection.putrequest("POST", "/v1/documentos/nfe/danfe.pdf")
            connection.putheader("X-Fiscal-Service-Key", SECRET)
            connection.putheader("Content-Type", "application/json")
            connection.putheader("Content-Length", str(12 * 1024 * 1024 + 1))
            connection.endheaders()
            self.assertEqual(connection.getresponse().status, 413)
        finally:
            connection.close()

    def test_unknown_route_does_not_render(self):
        self.assertEqual(self.request(path="/other")[0], 404)

    def test_service_refuses_to_start_without_a_key(self):
        with self.assertRaises(ValueError):
            build_server(("127.0.0.1", 0), "")


if __name__ == "__main__":
    unittest.main()
