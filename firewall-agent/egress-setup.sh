#!/usr/bin/env bash
# ============================================================
# egress-setup.sh - Egress filtering por subred DMZ
# (misma fuente que firewall/setup-docker-egress.sh)
#
# Se ejecuta en el ARRANQUE del contenedor firewall-agent
# (network_mode: host + NET_ADMIN), de modo que las reglas de
# DOCKER-USER se re-aplican en cada reinicio del contenedor o del
# engine de Docker (persistencia en Docker Desktop / WSL2, donde
# no hay iptables-persistent del host).
#
# Complementa firewall/setup-ufw.sh: UFW filtra el OUTPUT del host,
# no el FORWARD de los contenedores. Esta capa cierra DOCKER-USER:
#   * Subred honeypot dmz (cowrie/dionaea) -> DENEGADO por defecto.
#   * Solo se permite: DNS (53), HTTPS a las APIs de enriquecimiento
#     (AbuseIPDB, Shodan, VirusTotal, WhoisFreaks) via ipset, y el
#     tráfico intra-subred / ya establecido.
#
# Idempotente: marca sus reglas con comentarios honeypot-soc:egress:*
# y las re-crea limpias en cada ejecución (no duplica).
# ============================================================
set -euo pipefail

# ------------------------------------------------------------
# Configuración (ajustar si la subred cambia en docker-compose)
# ------------------------------------------------------------
DMZ_SUBNET="${DMZ_SUBNET:-172.20.0.0/24}"
IPSET_NAME="honeypot_api_egress"
MARK="honeypot-soc:egress"
CHAIN="DOCKER-USER"

# APIs de enriquecimiento permitidas (solo HTTPS 443)
API_DOMAINS=(
  api.abuseipdb.com
  api.shodan.io
  www.virustotal.com
  api.whoisfreaks.com
)

echo "[egress] config: DMZ=${DMZ_SUBNET} ipset=${IPSET_NAME}"

# ------------------------------------------------------------
# 1) ipset: resolver IPs ACTUALES de las APIs (se refrescan en
#    cada arranque; si una API cambia de IP por CDN, el reinicio
#    del contenedor vuelve a resolver)
# ------------------------------------------------------------
ipset list "$IPSET_NAME" >/dev/null 2>&1 || ipset create "$IPSET_NAME" hash:ip family inet
ipset flush "$IPSET_NAME"
for domain in "${API_DOMAINS[@]}"; do
  while read -r ip _; do
    [ -n "$ip" ] && ipset add "$IPSET_NAME" "$ip" -exist && echo "[egress] permitida: $domain -> $ip"
  done < <(getent ahostsv4 "$domain" 2>/dev/null | awk '{print $1}' | sort -u || true)
done

# ------------------------------------------------------------
# 2) Limpiar reglas previas del script (idempotencia)
#    Borrado por NUMERO DE LINEA: robusto ante el formato exacto
#    de iptables (backend nftables es estricto con -D por specs).
# ------------------------------------------------------------
iptables -w -L "$CHAIN" --line-numbers -n | grep -- "$MARK" | awk '{print $1}' | sort -rn | while read -r num; do
  iptables -w -D "$CHAIN" "$num" 2>/dev/null || true
done || true

# ------------------------------------------------------------
# 3) Insertar reglas en ORDEN (crítico)
#    El tráfico entrante externo (atacante -> honeypot) tiene source
#    FUERA de 172.20.0.0/24, así que NO lo tocan estas reglas.
#    En cambio, el retorno honeypot -> atacante SALE con source DMZ:
#    el ACCEPT ESTABLISHED/RELATED primero evita romperlo.
#    El acceso del operador (host -> honeypot) entra desde la gateway
#    172.20.0.1 (dentro de la subred): lo permite la regla intra-DMZ.
# ------------------------------------------------------------
# Los -I 1 apilan: insertar de abajo hacia arriba para que queden en orden
# 1) Denegar todo lo demás de la subred DMZ
iptables -w -I "$CHAIN" 1 -s "$DMZ_SUBNET" -m comment --comment "$MARK:drop-all" -j DROP
# 2) HTTPS a las APIs de enriquecimiento (ipset con IPs resueltas)
iptables -w -I "$CHAIN" 1 -s "$DMZ_SUBNET" -p tcp --dport 443 -m set --match-set "$IPSET_NAME" dst -m comment --comment "$MARK:enrich-apis" -j ACCEPT
# 3) DNS (TCP y UDP) hacia cualquier resolver
iptables -w -I "$CHAIN" 1 -s "$DMZ_SUBNET" -p udp --dport 53 -m comment --comment "$MARK:dns" -j ACCEPT
iptables -w -I "$CHAIN" 1 -s "$DMZ_SUBNET" -p tcp --dport 53 -m comment --comment "$MARK:dns" -j ACCEPT
# 4) Intra-subred DMZ (honeypots <-> gateway; host operador -> honeypot)
iptables -w -I "$CHAIN" 1 -s "$DMZ_SUBNET" -d "$DMZ_SUBNET" -m comment --comment "$MARK:intra-dmz" -j ACCEPT
# 5) Conexiones ya establecidas / relacionadas (no romper retornos)
iptables -w -I "$CHAIN" 1 -m conntrack --ctstate ESTABLISHED,RELATED -m comment --comment "$MARK:established" -j ACCEPT

echo "[egress] reglas DOCKER-USER aplicadas:"
iptables -w -L "$CHAIN" -n -v