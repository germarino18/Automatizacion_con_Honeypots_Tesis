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

# ------------------------------------------------------------
# 4) API del agente: filtrado en INPUT (capa crítica)
#
# POR QUÉ EN INPUT Y NO EN DOCKER-USER:
#   El agente escucha en 172.21.0.1 = puerta de enlace de red_interna, que
#   es una IP LOCAL del host. El tráfico dirigido a una IP local entra por
#   la cadena INPUT, NO por FORWARD. DOCKER-USER solo ve FORWARD, así que
#   las reglas de egress de más arriba NO protegen este puerto: sin la
#   regla de abajo, un contenedor de honeypot_dmz (cowrie/dionaea) puede
#   alcanzar el API del agente. Verificado empíricamente.
#
# POR QUÉ POR SUBRED Y NO POR INTERFAZ:
#   El nombre del bridge (br-<hash>) depende del ID de la red y CAMBIA si
#   la red se recrea (docker compose down/up). Una regla con -i br-xxxx
#   quedaría huérfana en silencio y el puerto expuesto sin que se note.
#   La subred es estable.
#
# Idempotente: igual que las reglas de egress, se borran por número de
# línea las que llevan la marca y se re-insertan limpias.
# ------------------------------------------------------------
AGENT_PORT="${AGENT_PORT:-8099}"
INTERNAL_SUBNET="${INTERNAL_SUBNET:-172.21.0.0/24}"
MARK_IN="honeypot-soc:api-in"

iptables -w -L INPUT --line-numbers -n | grep -- "$MARK_IN" | awk '{print $1}' | sort -rn | while read -r num; do
  iptables -w -D INPUT "$num" 2>/dev/null || true
done || true

# Orden final deseado (de arriba hacia abajo):
#   1) ACCEPT  -i lo                        (host local: healthcheck del contenedor)
#   2) ACCEPT  -s red_interna               (n8n -> API)
#   3) DROP    todo el resto del puerto     (incluye honeypot_dmz: cowrie/dionaea)
#
# Se inserta SIEMPRE en el índice 1, de abajo hacia arriba: con la cadena
# INPUT vacía cualquier otro índice falla con "Index of insertion too big"
# (INPUT arranca sin reglas, a diferencia de DOCKER-USER). Insertar en
# índice 2 abortaba el script bajo `set -e`, el contenedor entraba en
# restart loop y el agente quedaba caído: peor que el problema que resolvía.
#
# POR QUÉ HACE FALTA LA REGLA DE `lo` (verificado empíricamente):
#   El tráfico del propio host hacia una IP LOCAL como 172.21.0.1 se entrega
#   por la interfaz `lo`, y su dirección de ORIGEN NO es la IP local
#   esperada: en este entorno (Docker Desktop sobre WSL2) el origen termina
#   siendo 192.168.65.6 (interfaz `services1` del VM), no 172.21.0.1.
#   Medido: con -s 172.21.0.0/24, -s 172.21.0.1/32 y -s 127.0.0.1/32 la regla
#   contó 0 paquetes y la conexión cayó en el DROP; -s 192.168.65.6/32 y
#   -i lo SÍ la aceptaron. Conclusión: para tráfico host-local el filtro
#   correcto es la INTERFAZ (`lo`), no la dirección de origen.
#   Sin esta regla, el healthcheck del contenedor queda en timeout
#   permanente (agente "unhealthy") y el propio host no puede consultar su API.
#   Es seguro: `lo` es tráfico exclusivamente local del netns del host; un
#   contenedor de la DMZ no puede originar tráfico por `lo` (llega por el
#   bridge de la DMZ), así que sigue cayendo en el DROP.
#
# RESILIENCIA: estas reglas son defensa en profundidad (el bind a
# red_interna y la autenticación por header siguen protegiendo el API si
# faltan). Un fallo aquí se reporta con fuerza pero NO debe impedir que
# arranque el servidor: sin agente no hay bloqueo en absoluto.
api_in_ok=1
iptables -w -I INPUT 1 -p tcp --dport "$AGENT_PORT" -m comment --comment "$MARK_IN:drop-rest" -j DROP || api_in_ok=0
iptables -w -I INPUT 1 -p tcp --dport "$AGENT_PORT" -s "$INTERNAL_SUBNET" -m comment --comment "$MARK_IN:allow-internal" -j ACCEPT || api_in_ok=0
iptables -w -I INPUT 1 -i lo -p tcp --dport "$AGENT_PORT" -m comment --comment "$MARK_IN:allow-localhost" -j ACCEPT || api_in_ok=0

if [ "$api_in_ok" = "1" ]; then
  echo "[api-in] INPUT filtrado: ${INTERNAL_SUBNET} + lo -> tcp/${AGENT_PORT}; el resto DROP"
else
  echo "[api-in] ADVERTENCIA: no se pudieron aplicar todas las reglas de INPUT." >&2
  echo "[api-in] El API sigue protegido por bind + X-Agent-Secret, pero SIN esta capa de red." >&2
fi
iptables -w -L INPUT -n -v