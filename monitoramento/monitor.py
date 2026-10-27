#!/usr/bin/env python3
"""Verifica endpoints públicos, registra disponibilidade e emite alertas por transição.
Somente biblioteca padrão. Credenciais chegam exclusivamente por secrets do Actions.
"""
import json
import os
import smtplib
import ssl
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CFG = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
DEST = ROOT / "data" / "status.json"
DEST.parent.mkdir(parents=True, exist_ok=True)
try:
    old = json.loads(DEST.read_text(encoding="utf-8"))
except (FileNotFoundError, ValueError):
    old = {}
old_by_id = {x["id"]: x for x in old.get("monitores", [])}
events = old.get("eventos", [])[-499:]
now = datetime.now(timezone.utc).isoformat(timespec="seconds")
updated = []


def probe(mon):
    started = time.monotonic()
    code = None
    error = ""
    try:
        req = urllib.request.Request(
            mon["url"], headers={"User-Agent": "ConsultoriaRF-Uptime/1.0", "Accept": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=12) as response:
            code = response.status
            body = response.read(131072)
            if not (200 <= code < 400):
                raise ValueError("Resposta HTTP " + str(code))
            if mon.get("tipo") == "fastapi":
                payload = json.loads(body)
                if not isinstance(payload, dict) or not payload.get("openapi"):
                    raise ValueError("Resposta recebida não é OpenAPI do backend")
        ok = True
    except urllib.error.HTTPError as exc:
        code = exc.code
        error = "HTTP " + str(code)
        ok = False
    except Exception as exc:
        error = (type(exc).__name__ + ": " + str(exc))[:190]
        ok = False
    return ok, code, int((time.monotonic() - started) * 1000), error


def notify(message):
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    if token and chat:
        try:
            body = json.dumps({"chat_id": chat, "text": message}, ensure_ascii=False).encode()
            req = urllib.request.Request("https://api.telegram.org/bot" + token + "/sendMessage",
                                         data=body, headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=12) as r:
                r.read()
            print("Notificação Telegram enviada.")
        except Exception as exc:
            print("Falha ao enviar Telegram:", type(exc).__name__)
    if os.environ.get("SMTP_HOST") and os.environ.get("ALERT_EMAIL_TO"):
        try:
            mail = EmailMessage()
            mail["Subject"] = "[RF Monitor] " + message.split("\n", 1)[0]
            mail["From"] = os.environ.get("SMTP_FROM") or os.environ.get("SMTP_USER")
            mail["To"] = os.environ["ALERT_EMAIL_TO"]
            mail.set_content(message)
            host = os.environ["SMTP_HOST"]
            port = int(os.environ.get("SMTP_PORT") or "587")
            if port == 465:
                conn = smtplib.SMTP_SSL(host, port, timeout=15, context=ssl.create_default_context())
            else:
                conn = smtplib.SMTP(host, port, timeout=15)
            with conn as smtp:
                if port != 465:
                    smtp.starttls(context=ssl.create_default_context())
                if os.environ.get("SMTP_USER") and os.environ.get("SMTP_PASSWORD"):
                    smtp.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
                smtp.send_message(mail)
            print("Notificação por e-mail enviada.")
        except Exception as exc:
            print("Falha ao enviar e-mail:", type(exc).__name__)


for mon in CFG["monitores"]:
    if mon.get("ativo") is False:
        continue
    before = old_by_id.get(mon["id"], {})
    ok, code, ms, err = probe(mon)
    failures = 0 if ok else before.get("falhas_seguidas", 0) + 1
    threshold = CFG.get("falhas_para_alerta", 3)
    status = ("lento" if ms > CFG.get("limite_lentidao_ms", 2500) else "online") if ok else ("offline" if failures >= threshold else "instavel")
    previous = before.get("estado", "aguardando")
    item = {
        "id": mon["id"], "nome": mon["nome"], "url": mon["url"],
        "estado": status, "http": code, "tempo_ms": ms,
        "erro": err, "ultima_verificacao": now,
        "ultimo_sucesso": now if ok else before.get("ultimo_sucesso"),
        "falhas_seguidas": failures,
        "total_testes": before.get("total_testes", 0) + 1,
        "testes_ok": before.get("testes_ok", 0) + int(ok),
        "mudanca_em": now if status != previous else before.get("mudanca_em", now),
        "recentes": (before.get("recentes", []) + [status])[-48:],
    }
    updated.append(item)
    event = None
    if status == "offline" and previous != "offline":
        event = {"em": now, "id": mon["id"], "nome": mon["nome"], "tipo": "queda",
                 "detalhe": err or "A API não respondeu corretamente."}
        notify("API FORA DO AR: " + mon["nome"] + "\n" + mon["url"] + "\n" + event["detalhe"])
    elif ok and previous == "offline":
        event = {"em": now, "id": mon["id"], "nome": mon["nome"], "tipo": "recuperacao",
                 "detalhe": "Resposta válida após indisponibilidade."}
        notify("API RECUPERADA: " + mon["nome"] + "\n" + mon["url"])
    if event:
        events.append(event)
    print(mon["nome"], status, str(code), str(ms) + "ms")

DEST.write_text(json.dumps({
    "atualizado_em": now,
    "intervalo_minutos": CFG.get("intervalo_minutos", 5),
    "monitores": updated, "eventos": events[-500:]
}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
