# ===========================================
# FIREWALL AGENT - Honeypot SOC
# Tesis: Automatización con Honeypots
# Sidecar de bloqueo real vía iptables (DOCKER-USER)
# Requiere: --network host + cap_add NET_ADMIN
# ===========================================
FROM alpine:3.20

# ipset: allowlist de egress para las APIs de enriquecimiento (ver egress-setup.sh)
RUN apk add --no-cache iptables ipset ip6tables python3 py3-pip bash && \
    rm -rf /var/cache/apk/*

WORKDIR /opt/firewall-agent
COPY server.py /opt/firewall-agent/server.py
COPY egress-setup.sh /opt/firewall-agent/egress-setup.sh
RUN chmod +x /opt/firewall-agent/egress-setup.sh

EXPOSE 8099

# Arranque: aplica el egress filtering de DOCKER-USER y luego levanta el API.
# Así las reglas se re-aplican en cada reinicio del contenedor (persistencia
# en Docker Desktop/WSL2, donde no hay iptables-persistent del host).
# -w evita colisiones con el lock de xtables (docker)
CMD ["/bin/bash", "-c", "/opt/firewall-agent/egress-setup.sh && exec python3 /opt/firewall-agent/server.py"]