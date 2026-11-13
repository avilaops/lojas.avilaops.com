"""Private, stateless DANFE rendering. No certificates, SEFAZ or storage credentials."""
from __future__ import annotations

import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import re
import threading
import xml.etree.ElementTree as ET

from brazilfiscalreport.danfe import Danfe
from defusedxml.ElementTree import fromstring

LIMIT = 12 * 1024 * 1024
NS = {"n": "http://www.portalfiscal.inf.br/nfe"}


def validated_invoice(xml: str) -> str:
    if not isinstance(xml, str) or not xml or len(xml.encode("utf-8")) > LIMIT:
        raise ValueError("Invalid XML size")
    if re.search(r"<!DOCTYPE|<!ENTITY", xml, re.I):
        raise ValueError("Unsafe XML")
    try:
        root = fromstring(xml, forbid_dtd=True, forbid_entities=True, forbid_external=True)
    except (ET.ParseError, ValueError) as error:
        raise ValueError("Invalid XML") from error
    if root.tag != "{" + NS["n"] + "}nfeProc":
        raise ValueError("Complete NF-e required")
    invoices = root.findall("n:NFe/n:infNFe", NS)
    protocols = root.findall("n:protNFe/n:infProt", NS)
    if len(invoices) != 1 or len(protocols) != 1:
        raise ValueError("One invoice and authorization protocol required")
    invoice, protocol = invoices[0], protocols[0]
    identifier = invoice.get("Id", "")
    if not re.fullmatch(r"NFe\d{44}", identifier):
        raise ValueError("Invalid invoice identifier")
    if invoice.findtext("n:ide/n:mod", namespaces=NS) != "55":
        raise ValueError("NF-e model55 required")
    if protocol.findtext("n:cStat", namespaces=NS) != "100":
        raise ValueError("Authorized NF-e required")
    if protocol.findtext("n:chNFe", namespaces=NS) != identifier[3:]:
        raise ValueError("Authorization belongs to a different invoice")
    return identifier[3:]


def build_server(address: tuple[str, int], secret: str) -> ThreadingHTTPServer:
    if not isinstance(secret, str) or not re.fullmatch(r"[A-Za-z0-9_-]{32,128}", secret):
        raise ValueError("A strong service key is required")
    capacity = threading.BoundedSemaphore(2)

    class Handler(BaseHTTPRequestHandler):
        server_version = "FiscalRenderer"

        def setup(self):
            super().setup()
            self.connection.settimeout(15)

        def log_message(self, _format, *_args):
            # Never put XML, credentials or request headers in service logs.
            pass

        def send_bytes(self, status: int, body: bytes, kind="application/json", filename=None):
            self.send_response(status)
            self.send_header("Content-Type", kind)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "private, no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Connection", "close")
            if filename:
                self.send_header("Content-Disposition", 'attachment; filename="' + filename + '"')
            self.end_headers()
            self.close_connection = True
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def error(self, status: int, message: str):
            self.send_bytes(status, json.dumps({"erro": message}).encode())

        def do_GET(self):
            if self.path != "/healthz":
                return self.error(404, "Rota não encontrada.")
            source = os.environ.get("RENDER_GIT_COMMIT", "")
            self.send_bytes(200, json.dumps({"ok": True, "service": "lojas-fiscal-danfe", "source": source if re.fullmatch(r"[a-f0-9]{40}", source) else None}).encode())

        def do_POST(self):
            if self.path != "/v1/documentos/nfe/danfe.pdf":
                return self.error(404, "Rota não encontrada.")
            provided = self.headers.get("X-Fiscal-Service-Key", "")
            if not hmac.compare_digest(provided.encode(), secret.encode()):
                return self.error(401, "Autenticação necessária.")
            if self.headers.get("Transfer-Encoding"):
                return self.error(400, "Envie um corpo com tamanho definido.")
            length = self.headers.get("Content-Length", "")
            if not re.fullmatch(r"\d+", length) or int(length) < 1:
                return self.error(400, "Corpo inválido.")
            if int(length) > LIMIT:
                return self.error(413, "Arquivo fiscal excede o limite.")
            if self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower() != "application/json":
                return self.error(415, "Envie JSON.")
            if not capacity.acquire(blocking=False):
                return self.error(503, "Gerador ocupado. Tente novamente em instantes.")
            try:
                try:
                    raw = self.rfile.read(int(length))
                    if len(raw) != int(length):
                        raise ValueError("Truncated body")
                    payload = json.loads(raw)
                    if not isinstance(payload, dict) or set(payload) != {"xml"}:
                        raise ValueError("Invalid request")
                    xml = payload["xml"]
                    key = validated_invoice(xml)
                except Exception:
                    return self.error(422, "Envie XML completo de NF-e modelo55 com protocolo autorizado.")
                try:
                    pdf = bytes(Danfe(xml=xml).output())
                    if not pdf.startswith(b"%PDF-") or len(pdf) > LIMIT:
                        raise ValueError("Invalid PDF")
                except Exception:
                    print("DANFE_RENDER_FAILED", flush=True)
                    return self.error(502, "Não foi possível gerar o DANFE.")
                self.send_bytes(200, pdf, "application/pdf", "DANFE-" + key + ".pdf")
            finally:
                capacity.release()

    return ThreadingHTTPServer(address, Handler)


if __name__ == "__main__":
    build_server(("0.0.0.0", int(os.environ.get("PORT", "10000"))), os.environ.get("FISCAL_SHARED_SERVICE_KEY", "")).serve_forever()
