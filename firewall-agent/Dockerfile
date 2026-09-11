# ===========================================
# FIREWALL AGENT - Honeypot SOC
# Tesis: Automatización con Honeypots
# Sidecar de bloqueo real vía iptables (DOCKER-USER)
# Requiere: --network host + cap_add NET_ADMIN
# ===========================================
FROM alpine:3.20

RUN apk add --no-cache iptables ip6tables python3 py3-pip bash && \
    rm -rf /var/cache/apk/*

WORKDIR /opt/firewall-agent
COPY server.py /opt/firewall-agent/server.py

EXPOSE 8099

# -w evita colisiones con el lock de xtables (docker)
CMD ["python3", "/opt/firewall-agent/server.py"]