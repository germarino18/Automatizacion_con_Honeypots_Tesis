#!/usr/bin/env python3
"""
Firewall Agent - Honeypot SOC (Tesis: Automatización con Honeypots)

Sidecar HTTP minimalista (stdlib) que ejecuta bloqueos REALES de IP
sobre la cadena DOCKER-USER de iptables (netns del host de Docker).

Endpoints:
  GET  /health               -> estado del servicio y de la cadena
  GET  /tokens               -> provee app_token/user_token de GLPI (sin exponer $env en n8n)
  POST /block                -> inserta DROP para una IP (con auto-expiración)
  POST /unblock              -> elimina las reglas DROP de una IP
  GET  /rules                -> lista las reglas DROP activas

Contrato /block:
  { "ip": "1.2.3.4", "duration": 3600, "reason": "Honeypot reconnaissance - PB-H1" }
Respuesta:
  { "applied": true, "rule": "-A DOCKER-USER -s 1.2.3.4 -m comment --comment ... -j DROP" }
  ó { "applied": false, "error": "..." }

El bloqueo se auto-expira transcurrido `duration` segundos.
"""
import ipaddress
import json
import os
import re
import shlex
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = "0.0.0.0"
PORT = 8099
CHAIN = "DOCKER-USER"
COMMENT_PREFIX = "honeypot-soc:"

# IP -> list of threading.Timer (una por regla activa)
_expire_timers = {}
_lock = threading.Lock()


def _sanitize_comment(reason: str) -> str:
    """Limita caracteres para el comentario de iptables (evita inyección)."""
    cleaned = re.sub(r"[^A-Za-z0-9 _.:@-]", "_", reason or "").strip()
    return (cleaned[:120]) if cleaned else "honeypot"


def _parse_ip(raw: str):
    """Valida y normaliza una IP. Soporta IPv4 e IPv6."""
    try:
        return ipaddress.ip_address(raw.strip())
    except ValueError:
        return None


def _iptables(ip, *extra):
    """Ejecuta iptables/ip6tables según versión de IP. Devuelve (code, stdout, stderr)."""
    addr = ipaddress.ip_address(ip)
    binary = "ip6tables" if addr.version == 6 else "iptables"
    try:
        proc = subprocess.run(
            [binary, "-w", *extra],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return proc.returncode, proc.stdout, proc.stderr
    except subprocess.TimeoutExpired:
        return 124, "", "timeout"


def _rule_args(addr: ipaddress.IPv4Address | ipaddress.IPv6Address, comment: str):
    return ["-I", CHAIN, "1", "-s", str(addr), "-m", "comment", "--comment", comment, "-j", "DROP"]


def _insert_rule(addr, comment):
    return _iptables(str(addr), *_rule_args(addr, comment))


def _check_rule(addr, comment):
    return _iptables(str(addr), "-C", CHAIN, "-s", str(addr), "-m", "comment", "--comment", comment, "-j", "DROP")


def _delete_rule(addr, comment):
    return _iptables(str(addr), "-D", CHAIN, "-s", str(addr), "-m", "comment", "--comment", comment, "-j", "DROP")


def _delete_all_for_ip(addr):
    """Elimina todas las reglas DROP de una IP en DOCKER-USER (cualquier comentario)."""
    removed = 0
    # iptables -S emite reglas en formato shell; shlex respeta el quoting del comentario
    _, out, _ = _iptables(str(addr), "-S", CHAIN)
    for line in out.splitlines():
        if line.startswith("-A") and f"-s {addr}" in line and "-j DROP" in line:
            args = shlex.split(line)[2:]  # quita "-A" y el nombre de la cadena (CHAIN se pasa aparte)
            binary = "ip6tables" if addr.version == 6 else "iptables"
            subprocess.run([binary, "-w", "-D", CHAIN, *args], capture_output=True, text=True, timeout=30)
            removed += 1
    return removed


def _cancel_timers(ip: str):
    with _lock:
        for t in _expire_timers.pop(ip, []):
            t.cancel()


def _schedule_expire(ip: str, addr, comment: str, duration: int):
    def _expire():
        _delete_rule(addr, comment)
        with _lock:
            if ip in _expire_timers and _expire_timers[ip]:
                _expire_timers[ip] = [_t for _t in _expire_timers[ip] if not _t.is_alive()]
    t = threading.Timer(max(duration, 1), _expire)
    t.daemon = True
    with _lock:
        _expire_timers.setdefault(ip, []).append(t)
    t.start()


def _chain_exists() -> bool:
    code, _, _ = _iptables("127.0.0.1", "-n", "-L", CHAIN)
    return code == 0


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # silencioso salvo error
        pass

    def _json(self, code: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
        except ValueError:
            length = 0
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return {}

    def do_GET(self):
        if self.path == "/health":
            ok = _chain_exists()
            payload = {
                "ok": ok,
                "service": "firewall-agent",
                "chain": CHAIN,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
            self._json(200 if ok else 503, payload)
            return
        if self.path == "/rules":
            _, out, err = _iptables("127.0.0.1", "-S", CHAIN)
            rules = [l for l in out.splitlines() if l.startswith("-A") and "-j DROP" in l]
            self._json(200, {"chain": CHAIN, "rules": rules, "count": len(rules), "stderr": err or None})
            return
        if self.path == "/tokens":
            # M-04: expone los tokens GLPI al workflow webhook-glpi-ticket (red interna).
            # El workflow los consume como $json; evita $env.* en expresiones de n8n.
            self._json(200, {
                "app_token": os.environ.get("GLPI_APP_TOKEN", ""),
                "user_token": os.environ.get("GLPI_USER_TOKEN", ""),
            })
            return
        self._json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/block" and self.path != "/unblock":
            self._json(404, {"error": "not found"})
            return
        data = self._read_body()
        raw_ip = data.get("ip") or ""
        addr = _parse_ip(raw_ip)
        if addr is None:
            self._json(400, {"applied": False, "error": f"invalid IP: {raw_ip!r}"})
            return
        ip_str = str(addr)

        if self.path == "/unblock":
            _cancel_timers(ip_str)
            removed = _delete_all_for_ip(addr)
            self._json(200, {"released": True, "ip": ip_str, "rules_removed": removed})
            return

        # /block
        try:
            duration = max(int(data.get("duration") or 3600), 1)
        except (TypeError, ValueError):
            duration = 3600
        reason = _sanitize_comment(data.get("reason") or "honeypot")
        comment = COMMENT_PREFIX + reason

        rc, _, stderr = _insert_rule(addr, comment)
        if rc != 0:
            self._json(503, {"applied": False, "ip": ip_str, "error": stderr.strip() or "iptables insert failed"})
            return

        # Verificación: la regla debe estar presente
        vr, _, vstderr = _check_rule(addr, comment)
        rule = "-A DOCKER-USER -s %s -m comment --comment \"%s\" -j DROP" % (ip_str, comment)
        if vr != 0:
            self._json(503, {"applied": False, "ip": ip_str, "error": ("rule not confirmed: " + vstderr.strip())})
            return

        _schedule_expire(ip_str, addr, comment, duration)
        self._json(200, {
            "applied": True,
            "ip": ip_str,
            "rule": rule,
            "duration": duration,
            "reason": reason,
            "expires_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + duration)),
        })


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"firewall-agent listening on {HOST}:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()