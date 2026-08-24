#!/usr/bin/env bash
# ============================================================
# setup-ufw.sh - Egress filtering deny-by-default (tesis honeypots)
#
# Salvaguarda etica central del experimento: por defecto NADA sale
# de la VM hacia internet; solo DNS (53) y HTTPS (443) estan
# permitidos como allowlist explícita.
#
# Idempotente: puede ejecutarse varias veces sin duplicar reglas
# (ufw omite las reglas identicas ya existentes).
#
# Uso:      sudo bash firewall/setup-ufw.sh
# Rollback: sudo ufw disable   (ver docs/firewall.md)
# ============================================================
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "[!] Este script debe ejecutarse como root (sudo)." >&2
  exit 1
fi

if ! command -v ufw >/dev/null 2>&1; then
  echo "[!] ufw no esta instalado. Instalarlo con: apt install ufw" >&2
  exit 1
fi

echo "== Politica por defecto =="
# Salvaguarda etica: denegar todo trafico saliente del host por defecto.
# Nota: los contenedores Docker no pasan por OUTPUT (usan FORWARD con sus
# propias reglas); ver docs/firewall.md para la capa DOCKER-USER.
ufw default deny outgoing
ufw default deny incoming

echo "== SSH entrante (ANTES de enable para evitar autolockout) =="
# limit = permite SSH pero con rate-limit anti fuerza bruta
ufw limit 22/tcp

echo "== Allowlist saliente =="
# Resolucion DNS necesaria para cualquier llamada a APIs externas
ufw allow out 53/tcp comment 'DNS saliente'
ufw allow out 53/udp comment 'DNS saliente'
# HTTPS hacia APIs externas (VirusTotal, GLPI, WHOIS, Slack, AbuseIPDB, Shodan)
ufw allow out 443/tcp comment 'HTTPS saliente (APIs VirusTotal/GLPI/etc)'

echo "== Puertos entrantes del experimento (deben seguir publicos) =="
ufw allow 21/tcp        comment 'Honeypot Dionaea FTP'
ufw allow 2222:2223/tcp comment 'Honeypot Cowrie SSH/Telnet'
ufw allow 8080/tcp      comment 'Honeypot Dionaea HTTP'
ufw allow 4445/tcp      comment 'Honeypot Dionaea SMB'
ufw allow 1433/tcp      comment 'Honeypot Dionaea MSSQL'
ufw allow 80/tcp        comment 'nginx HTTP (consola SOC)'
ufw allow 443/tcp       comment 'nginx HTTPS (consola SOC)'

echo "== Habilitar firewall =="
ufw --force enable

echo "== Estado final =="
ufw status verbose
