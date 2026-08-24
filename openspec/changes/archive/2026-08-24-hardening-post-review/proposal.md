# Proposal: hardening-post-review

## Why

Una revisión post-audit del repositorio identificó brechas de seguridad y resiliencia que comprometen la defensa de la tesis: no existe ningún control de egress (la salvaguarda ética más importante según el documento de tesis), los paneles de administración (n8n y Grafana) están expuestos en todas las interfaces, un nodo del playbook PB-H2 consulta a VirusTotal con un campo inexistente (`file_hash`) produciendo llamadas a `/files/undefined`, ninguno de los 5 workflows tiene reintentos ni manejo de errores (debilitando la hipótesis de automatización confiable), y el quickstart del README omite el paso `cp .env.example .env` además de publicar credenciales triviales en sus ejemplos.

## What Changes

- Agregar `firewall/setup-ufw.sh`: política de salida por defecto DENY con allowlist explícita (DNS 53/tcp+udp, HTTPS 443 saliente hacia APIs VirusTotal/GLPI), manteniendo públicos únicamente los puertos del experimento (honeypots 21/2222-2223/8080/4445/1433 y nginx 80/443).
- Agregar `docs/firewall.md` documentando cada regla del firewall para su defensa ante el tribunal.
- Modificar `docker-compose.yml`: bind de n8n y Grafana a `127.0.0.1` (los puertos honeypot y nginx permanecen públicos) + snippet `DOCKER-USER` de iptables documentado como defensa en profundidad en la VM.
- Corregir el nodo "VirusTotal Lookup" en `workflows/b-h2-ejecucion-comandos-v1.0.json`: consultar reputación de dominios extraídos vía `GET /api/v3/domains/{domain}` iterando sobre `extracted_domains` (Opción A aprobada); la variante B (mover VT a PB-DIONAEA con `malware_hash` real) queda como mejora futura en design.md.
- Agregar resiliencia a los workflows: `retryOnFail:true`, `maxTries:3`, `retryWaitTime` en nodos HTTP ("VirusTotal Lookup", HTTP de webhook-glpi-ticket.json y webhook-firewall-block.json) y `onError` apropiado en nodos Postgres críticos.
- Corregir README: insertar paso `cp .env.example .env` entre `git clone` y `docker compose up -d`, y reemplazar literales triviales (`password`, `admin`) por placeholders no triviales tipo `cambia-esta-clave-segura`.
- Re-sincronizar los workflows modificados a la instancia viva de n8n vía API PUT preservando IDs.

No hay cambios breaking: los puertos del experimento (honeypots y nginx) siguen públicos; la API FastAPI y la consola web no cambian su comportamiento observable.

## Capabilities

### New Capabilities

- `hardening-n8n`: Corrección del lookup de reputación en PB-H2 (endpoint domains con dominios extraídos) y requisitos de resiliencia de ejecución (reintentos y manejo de errores) para los playbooks n8n del SOC.

### Modified Capabilities

- `despliegue-web`: Nuevos requisitos de exposición de red (solo loopback para servicios de administración n8n/Grafana), control de tráfico de salida del host (egress filtering con allowlist), paso obligatorio de configuración `.env` en el quickstart y prohibición de credenciales triviales en la documentación.

## Impact

- **Archivos nuevos**: `firewall/setup-ufw.sh`, `docs/firewall.md`.
- **Archivos modificados**: `docker-compose.yml` (líneas ~58 y ~138, binds), `workflows/b-h2-ejecucion-comandos-v1.0.json` (nodo "VirusTotal Lookup"), `workflows/webhook-glpi-ticket.json` y `workflows/webhook-firewall-block.json` (nodos HTTP/Postgres), `README.md` (quickstart líneas 184-195 y variables líneas 204-208).
- **Instancia viva**: re-sincronización vía `PUT http://localhost:5678/api/v1/workflows/{id}` con header `X-N8N-API-KEY` (IDs: PB-H2=`nFnt9n3Gk8Gh27mg`, glpi=`soc-glpi-ticket-01`, firewall=`soc-firewall-block-01`).
- **Sin cambios**: API FastAPI, consola web React, esquema Postgres, puertos honeypot, nginx, Grafana provisioning.
- **Seguridad**: ítems de firewall/exposición son HIGH security; plan ya aprobado explícitamente por el usuario.
- **Evaluado y descartado**: recomendación de inyección SQL (#3) — los 3 workflows ya usan queries parametrizadas `$1..$14`; se documenta en design.md solo para trazabilidad.
