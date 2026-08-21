## Why

El SOC tiene la cadena de datos completa y verificada (honeypots → sidecar → n8n → PostgreSQL) y una capa de visualización en Grafana, pero carece de una consola web operativa que permita al analista interactuar con la telemetría en tiempo real, explorar eventos, correlacionar con MITRE ATT&CK, gestionar IoCs y disparar automatizaciones desde un único lugar. Existe un prototipo estático en Stitch ("Honeypot SOC: Threat Intelligence Platform", proyecto `10945377982112649629`) con 8 pantallas y un PRD que define el producto; este change lo convierte en una aplicación web REAL conectada a los datos reales del SOC, cumpliendo las historias de usuario HU 1–7 y HU 9–10.

## What Changes

- **API backend (`api/` + servicio `soc-api`)**: aplicación **FastAPI** que expone los datos de `honeypot_events`, `responses`, `iocs`, `attack_sessions` y las vistas `metrics_summary`/`top_attackers` vía REST, con autenticación por sesión (JWT), **SSE** para eventos en vivo y proxy/acciones hacia n8n (listar workflows y ejecuciones, ejecutar playbook/simulación, bloquear IP). Documentación OpenAPI auto-generada.
- **Frontend SPA (`web/` + servicio `soc-web`)**: aplicación **React + Vite + TypeScript** que replica las 8 pantallas del prototipo Stitch — Resumen del SOC, Ataques en Vivo, Mapa Geográfico, Automatización y Respuesta, Malware & IoC, Login, Matriz MITRE ATT&CK, Explorador de Eventos — consumiendo la API real y aplicando el design system **Obsidian Sentinel** (dark-first, Inter + JetBrains Mono, accent cyan `#06b6d4`).
- **Automatización conectada a n8n**: el frontend puede listar workflows/ejecuciones de n8n (vía API pública de n8n con header `X-N8N-API-KEY` desde `N8N_API_KEY`), ejecutar simulaciones de ataque (POST a `/webhook/cowrie` / `/webhook/dionaea`, cadena REAL hasta PostgreSQL), registrar bloqueos de IP reutilizando el workflow EXISTENTE `workflows/webhook-firewall-block.json` (webhook `/webhook/firewall-block` → INSERT en la tabla `responses` con `action_type='bloqueo'`, `actor='n8n-automated'`) y crear tickets GLPI reutilizando `workflows/webhook-glpi-ticket.json` (`/webhook/glpi-ticket` → `action_type='alerta'`).
- **Deploy tras nginx**: nginx pasa a servir el SPA en `/`, el API en `/api/` (con SSE habilitado), mantiene `/webhook/` y `/grafana/`. Se agregan los servicios `soc-api` y `soc-web` a `docker-compose.yml` y variables nuevas al `.env`/`.env.example`.
- **README**: documentar la consola web (acceso, login, arquitectura, verificación) junto a la sección Grafana existente.

## Capabilities

### New Capabilities

- `api-soc`: API REST + SSE del SOC (autenticación JWT, overview de métricas, explorador de eventos con filtros/paginación, técnicas MITRE, geolocalización, malware/IoCs, detalle de incidente, health de servicios y feed de eventos en vivo).
- `automatizacion-web`: orquestación desde la web — listar workflows/ejecuciones de n8n, ejecutar playbook (simulación de ataque por la cadena real), registrar bloqueos de IP y crear tickets GLPI vía los workflows n8n existentes, y consultar el historial de respuestas automáticas.
- `web-soc-ui`: aplicación SPA React con las 8 pantallas del prototipo Stitch, navegación, login, actualización en vivo sin recarga y design system Obsidian Sentinel.
- `despliegue-web`: servicios `soc-api` y `soc-web` en docker-compose, ruteo de nginx (SPA + API + SSE + webhooks + Grafana), variables de entorno y verificación end-to-end.

### Modified Capabilities

_No se modifican requirements existentes_ — el change es puramente aditivo: `ataque-registro`, `diagnostico-cadena` y `visualizacion-grafana` siguen vigentes sin cambios de contrato. `diagnostico-cadena` y `visualizacion-grafana` se benefician como consumidores de la nueva capa.

## Impact

- **Código nuevo**: `api/` (FastAPI: routers, servicios, DTOs, auth, SSE), `web/` (React/Vite/TS: screens, componentes, hooks, design tokens), tests unitarios + de integración en ambos.
- **Docker Compose**: se agregan los servicios `api` y `web`; `nginx` gana config nueva (SPA en `/`, proxy `/api/`). NO se tocan postgres, n8n, cowrie, dionaea, grafana ni sidecar.
- **n8n**: se reutilizan los workflows EXISTENTES del repo `workflows/webhook-firewall-block.json` (receptor `/webhook/firewall-block` → INSERT en `responses` con `action_type='bloqueo'`, `actor='n8n-automated'`) y `workflows/webhook-glpi-ticket.json` (receptor `/webhook/glpi-ticket` → `action_type='alerta'`). No se crean workflows nuevos; solo se verifica/activa su importación en el n8n corriendo.
- **Variables de entorno**: `SOC_ADMIN_USER`, `SOC_ADMIN_PASSWORD`, `SOC_JWT_SECRET` (y `SOC_API_PORT`/`SOC_WEB_PORT` si aplica) agregadas a `.env.example` y consumidas por los servicios nuevos. Sin credenciales literales en el repo.
- **Dependencias**: Python (fastapi, uvicorn, asyncpg, PyJWT, httpx) y Node (react, react-dom, react-router-dom, vite, typescript, @tanstack/react-query, recharts, react-simple-maps/d3-geo para el mapa offline). Se versionan en `api/requirements.txt` y `web/package.json`.