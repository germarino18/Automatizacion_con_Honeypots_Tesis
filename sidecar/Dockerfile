# soc-sidecar: unified honeypot -> n8n bridge
# Reads cowrie.json (and optionally dionaea.json) and POSTs normalized
# events to the n8n webhooks with retries + in-memory queue.
FROM python:3-alpine

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

ENV COWRIE_JSONLOG_PATH=/logs/cowrie/cowrie.json
ENV DIONAEA_JSONLOG_PATH=/logs/dionaea/dionaea/dionaea.json
ENV N8N_COWRIE_URL=http://n8n:5678/webhook/cowrie
ENV N8N_DIONAEA_URL=http://n8n:5678/webhook/dionaea

ENTRYPOINT ["./entrypoint.sh"]