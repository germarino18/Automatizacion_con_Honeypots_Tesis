## 1. Scaffolding del backend API (`api/`)

- [x] 1.1 Crear estructura `api/` con `app/` (main, config, routers, repositories, services, schemas), `tests/`, `requirements.txt`, `Dockerfile`, `pytest.ini` y `.dockerignore`
- [x] 1.2 Definir `api/requirements.txt`: `fastapi`, `uvicorn[standard]`, `asyncpg`, `PyJWT`, `httpx`, `python-dotenv`; separar dev deps (pytest, pytest-asyncio) en `requirements-dev.txt`
- [x] 1.3 Crear `api/app/config.py` con Pydantic Settings que lea del entorno: `POSTGRES_*`, `SOC_ADMIN_USER`, `SOC_ADMIN_PASSWORD`, `SOC_JWT_SECRET`, `N8N_API_KEY`, `N8N_INTERNAL_URL`, `JWT_EXPIRES_MINUTES` (default 480) — sin valores literales de credenciales
- [x] 1.4 Crear `api/app/main.py` con la app FastAPI, CORS para localhost de desarrollo, router de health público y mounting de routers de API con prefijo `/api/v1`
- [x] 1.5 Crear `api/app/db.py` con el pool de `asyncpg` (`postgresql://user:pass@postgres:5432/db` desde config) y función de init/shutdown del pool
- [x] 1.6 `api/Dockerfile` multi-stage o directo (python:3.11-slim): instalar requirements, copiar `app/`, healthcheck `GET /api/v1/health`, CMD uvicorn `app.main:app` en `0.0.0.0:8000`
- [x] 1.7 Test de humo: `GET /api/v1/health` responde 200 con `status: ok` cuando el entorno de test usa un PostgreSQL de prueba (o SQLite/mock) — verifica que la app importa y arranca

## 2. API — Autenticación por sesión JWT (design D3, spec api-soc)

- [x] 2.1 Crear `api/app/services/auth.py`: verificación de credenciales con comparación de tiempo constante contra `SOC_ADMIN_USER`/`SOC_ADMIN_PASSWORD`, emisión de JWT (sub, exp, iat) firmado con `SOC_JWT_SECRET`, y decode/validación
- [x] 2.2 Crear dependencia FastAPI `require_auth` que lea el token (cookie `session` o header `Authorization: Bearer`) y falle con HTTP 401 si es inválido/expirado/ausente
- [x] 2.3 Router `api/app/routers/auth.py`: `POST /api/v1/auth/login` (valida credenciales → setea cookie HttpOnly SameSite=Lax con el token → 200) y `POST /api/v1/auth/logout` (limpia cookie → 200)
- [x] 2.4 Test: login con credenciales correctas → 200 + token; incorrectas → 401 sin detalle de cuál campo falló; acceso a endpoint protegido sin token → 401; logout → 200
- [x] 2.5 Verificar que ningún log de la API imprime credenciales ni tokens (revisión de logging en login)

## 3. API — Repositorios de acceso a datos (design D5, spec api-soc)

- [x] 3.1 Crear `api/app/repositories/events.py`: `list_events(filters, page, page_size)` con SQL parametrizado (filtros: `from`/`to` sobre `timestamp`, `source_honeypot`, `protocol`, `src_ip`, `severity`→buckets de `risk_score`, `technique`, `username`, `search` sobre `commands`/`raw_data`), `ORDER BY timestamp DESC`, `LIMIT/OFFSET`, y `count_events` para el total
- [x] 3.2 Crear `api/app/repositories/events.py`: `get_event_by_id(id)` con las 16 columnas tipadas + `raw_data`/`enrichment_data` JSONB + respuestas de `responses` por `event_id`
- [x] 3.3 Crear `api/app/repositories/overview.py`: agregados por rango — total eventos, eventos por `source_honeypot`, top `src_ip` (vista `top_attackers` o query equivalente), alertas críticas recientes (buckets severidad), total `malware_hash` no nulo, MTTD = AVG(`created_at`−`timestamp`), MTTR = AVG delta a respuesta en `responses` (o NULL)
- [x] 3.4 Crear `api/app/repositories/mitre.py`: agrupar por `att_ck_technique` con conteo en el rango, y catálogo MITRE embebido (técnica → táctica/nombre) en `api/app/data/mitre_catalog.json`
- [x] 3.5 Crear `api/app/repositories/geo.py`: agrupar por país extrayendo de `enrichment_data` (JSONB), fallback a tabla de rangos de IP si no hay geo, ordenado por cantidad descendente
- [x] 3.6 Crear `api/app/repositories/malware.py` (agrupar `malware_hash` con `malware_filename`, `src_ip`, `timestamp`) y `api/app/repositories/iocs.py` (listar/filtrar tabla `iocs` por `ioc_type`, `severity`, búsqueda `ioc_value`)
- [x] 3.7 Crear `api/app/repositories/responses.py`: listar `responses` con filtros `action_type`, `status`, `event_id`, rango de fechas
- [x] 3.8 Tests unitarios de repositorios con PostgreSQL de prueba: filtros combinados, paginación fuera de rango, severidad por bucket, orden por timestamp, búsqueda de texto, consultas con datos y con cero filas (sin errores)

## 4. API — Routers de datos (spec api-soc)

- [x] 4.1 Router `api/app/routers/overview.py`: `GET /api/v1/overview` protegido con `from`/`to` opcionales — devuelve métricas del overview (ceros/vacío si no hay datos, 200 siempre)
- [x] 4.2 Router `api/app/routers/events.py`: `GET /api/v1/events` protegido con paginación + filtros (validación Pydantic de query params, page/page_size con defaults y límites) y `GET /api/v1/events/{id}` (404 si no existe)
- [x] 4.3 Router `api/app/routers/mitre.py`: `GET /api/v1/mitre` protegido con rango — técnicas con conteo + metadata del catálogo; lista vacía sin errores si no hay técnicas
- [x] 4.4 Router `api/app/routers/geo.py`: `GET /api/v1/geo/countries` protegido con rango — países ordenados por cantidad; lista vacía sin data geo
- [x] 4.5 Router `api/app/routers/malware.py`: `GET /api/v1/malware` protegido con rango — hashes únicos con frecuencia/detalle; `GET /api/v1/iocs` con filtros por tipo/severidad/búsqueda
- [x] 4.6 Router `api/app/routers/health.py`: `GET /api/v1/health` público (API + query de prueba a postgres → `ok`/`degraded`) y `GET /api/v1/health/services` protegido (+ healthz de n8n vía httpx)
- [x] 4.7 Tests de integración con `TestClient`/httpx: cada endpoint responde 200 con datos de prueba, 401 sin token, y los shapes de respuesta coinciden con los DTOs Pydantic
- [x] 4.8 Verificar `GET /api/v1/openapi.json` lista todos los endpoints y que `docs` (Swagger UI) carga en el navegador

## 5. API — Feed de eventos en vivo por SSE (design D4, spec api-soc)

- [x] 5.1 Crear `api/app/services/live.py`: generador async que poll a `honeypot_events WHERE id > last_id ORDER BY id LIMIT N` cada 2s (constante configurable) y emite `event: event` + `ping` de heartbeat cada 15s
- [x] 5.2 Router `api/app/routers/live.py`: `GET /api/v1/events/live` protegido (401 sin token) que devuelve `StreamingResponse` con `text/event-stream`, headers `Cache-Control: no-cache` y `X-Accel-Buffering: no`
- [x] 5.3 Manejar desconexión del cliente (cancelación del generador sin errores) y no dejar streams huérfanos
- [x] 5.4 Tests: suscriptor recibe evento nuevo dentro de <= 5s tras insertar una fila de prueba en `honeypot_events`; heartbeat emitido sin eventos; 401 sin token; desconexión limpia sin excepciones

## 6. API — Integración con n8n (design D6, specs api-soc + automatizacion-web)

- [x] 6.1 Crear `api/app/services/n8n_client.py` (httpx, header `X-N8N-API-KEY` con `N8N_API_KEY`): `list_workflows()` → `GET {N8N_INTERNAL_URL}/api/v1/workflows`, `list_executions()` → `GET {N8N_INTERNAL_URL}/api/v1/executions?limit=50`
- [x] 6.2 En `n8n_client.py`: `simulate(honeypot, payload)` → POST a `{N8N_INTERNAL_URL}/webhook/cowrie` o `/webhook/dionaea`; `block_ip(src_ip, event_id, reason, duration=None)` → POST a `{N8N_INTERNAL_URL}/webhook/firewall-block` con payload `{event_id, ip: src_ip, duration, reason}` (duration opcional/null); `create_ticket(event_id, name, content, urgency)` → POST a `{N8N_INTERNAL_URL}/webhook/glpi-ticket` con payload `{event_id, name, content, urgency}`; todos con timeout y captura de errores de conexión
- [x] 6.3 Router `api/app/routers/automation.py` (protegido): `GET /api/v1/automation/workflows` (n8n caído → 502/503 sin datos falsos) y `GET /api/v1/automation/executions` (n8n caído → 200 con lista vacía + `degraded: true`), según spec automatizacion-web
- [x] 6.4 Router `automation.py`: `POST /api/v1/automation/simulate` — valida `honeypot` (422 si no es cowrie/dionaea), delega a n8n, devuelve resultado del webhook; 502/503 si n8n falla sin reportar éxito
- [x] 6.5 Router `automation.py`: `POST /api/v1/automation/block-ip` — valida `src_ip` (422 si inválida), mapea `{src_ip, event_id, reason}` → `{event_id, ip: src_ip, duration, reason}` (duration opcional), delega a `{N8N_INTERNAL_URL}/webhook/firewall-block`, devuelve resultado; 502/503 si n8n falla
- [x] 6.6 Router `automation.py`: `POST /api/v1/automation/create-ticket` — valida `name`/`content` (422 si vacíos), delega a `{N8N_INTERNAL_URL}/webhook/glpi-ticket`, devuelve resultado; 502/503 si n8n falla
- [x] 6.7 Router `automation.py`: `GET /api/v1/automation/responses` con filtros — lee de `responses` (repositorio 3.7)
- [x] 6.8 Tests de integración: mock de n8n (httpx MockTransport) para workflows/executions/simulate/block-ip/create-ticket OK y con n8n caído → degradación correcta; 422 con honeypot inválido, IP inválida y ticket sin `name`/`content`
- [x] 6.9 Migración de autenticación de lecturas n8n: Basic Auth → header `X-N8N-API-KEY` (n8n 2.x eliminó Basic Auth de la API pública; key creada desde UI owner, guardada en `.env` como `N8N_API_KEY`; suite completa 162 tests green)

## 7. Verificación/activación de los workflows n8n existentes (design D6, spec automatizacion-web)

- [x] 7.1 Verificar/importar en el n8n corriendo los workflows EXISTENTES `workflows/webhook-firewall-block.json` y `workflows/webhook-glpi-ticket.json` (UI o `n8n import:workflow --input=...`), activándolos si no lo están, siguiendo las convenciones del repo
- [x] 7.2 Validar que las rutas `/webhook/firewall-block` y `/webhook/glpi-ticket` no colisionan con los workflows activos existentes (`/webhook/cowrie`, `/webhook/dionaea`)
- [x] 7.3 Verificación manual block-ip: `curl -X POST -H "Content-Type: application/json" -d '{"event_id":null,"ip":"8.8.8.8","duration":3600,"reason":"test"}' http://localhost:5678/webhook/firewall-block` → 200 y una fila en `responses` con `action_type='bloqueo'` y `actor='n8n-automated'`
- [x] 7.4 Verificación manual ticket: `curl -X POST -H "Content-Type: application/json" -d '{"event_id":null,"name":"Alerta SOC","content":"prueba","urgency":"high"}' http://localhost:5678/webhook/glpi-ticket` → 200 y una fila en `responses` con `action_type='alerta'` y `actor='n8n-automated'`
- [x] 7.5 Verificar que los workflows existentes siguen activos y respondiendo tras la importación (POST de prueba a `/webhook/cowrie` y `/webhook/dionaea`)

## 8. Scaffolding del frontend (`web/`) + design system (design D2/D9, spec web-soc-ui)

- [ ] 8.1 Crear proyecto Vite React-TS en `web/` (`npm create vite@latest` con template react-ts), estructura `src/` (components, screens, hooks, services, styles), `package.json` con `react-router-dom`, `@tanstack/react-query`, `recharts`, `react-simple-maps`, `d3-geo`
- [ ] 8.2 Agregar `web/Dockerfile` multi-stage: stage build (node:20-alpine, `npm ci && npm run build`) → stage serve (nginx:alpine) con config mínima que sirve `dist/` y `try_files $uri /index.html` (fallback SPA)
- [ ] 8.3 Crear `web/src/styles/tokens.css` con las CSS custom properties del design system Obsidian Sentinel (fondos `#0a0a0c`/`#0f172a`/`#1e293b`, accent `#06b6d4`, success `#10b981`, severidad `#ef4444`/`#f97316`/`#f59e0b`, radio 0.25rem, sidebar 240px) y utilidades de tipografía (Inter UI, JetBrains Mono telemetría) con fuentes woff2 locales
- [ ] 8.4 Crear layout base: `App.tsx` con Router, `Sidebar` (240px con links a las 8 pantallas + estados de servicios desde health) y `Header` (usuario, logout)
- [ ] 8.5 Crear `web/src/services/api.ts` (cliente fetch con base `/api/v1`, credenciales por cookie, manejo de 401 → redirect a login) y hooks de react-query para overview, events, mitre, geo, malware, iocs, automation, health
- [ ] 8.6 Verificación de build: `docker build web` (o `npm run build` local) produce `dist/` sin errores y sirve `index.html` con el fallback SPA

## 9. Frontend — Flujo de login y protección de rutas (spec web-soc-ui)

- [ ] 9.1 Pantalla `Login.tsx`: formulario usuario/contraseña que llama `POST /api/v1/auth/login` (credentials include), maneja error de credenciales en pantalla y redirige a `/` al éxito
- [ ] 9.2 Contexto de sesión (`AuthContext`): estado autenticado, función logout (llama `POST /api/v1/auth/logout` y limpia estado), persistencia del estado durante la sesión
- [ ] 9.3 Guard de rutas: `<RequireAuth>` que redirige a `/login` si no hay sesión; ruta 404 para rutas desconocidas
- [ ] 9.4 Verificación manual: sin sesión → redirect a login; login válido → dashboard; logout → login; acceso a ruta protegida sin sesión → login

## 10. Frontend — Pantallas (spec web-soc-ui)

- [ ] 10.1 **Resumen del SOC** (`/`): consume `/overview` — tarjetas de métricas (total ataques, alertas críticas, IPs únicas, MTTD/MTTR), top IPs con risk score, comparativa Cowrie/Dionaea, alertas críticas recientes; estados vacíos y de error con retry
- [ ] 10.2 **Ataques en Vivo** (`/live`): suscripción SSE a `/events/live` (EventSource con fetch fallback a polling de `/events`), tabla de feed con timestamp/IP/honeypot/protocolo/técnica/severidad, indicador eventos/seg, panel de amenaza activa; degradación a polling indicada en UI
- [ ] 10.3 **Explorador de Eventos** (`/eventos`): filtros (rango de fechas, severidad, honeypot, protocolo, IP, técnica, búsqueda de texto), tabla paginada, orden por timestamp, exportación CSV client-side (separador `;`, UTF-8 BOM), apertura de detalle de evento (`/events/{id}` con raw_data y respuestas)
- [ ] 10.4 **Matriz MITRE ATT&CK** (`/mitre`): consume `/mitre` — técnicas con conteo agrupadas por táctica; selección de técnica navega al explorador con filtro aplicado; estado vacío
- [ ] 10.5 **Mapa Geográfico** (`/mapa`): consume `/geo/countries` — mapa vectorial offline con topojson embebido coloreado por cantidad + tabla de países; estado vacío informativo
- [ ] 10.6 **Malware & IoC** (`/malware`): consume `/malware` y `/iocs` — hashes únicos con detalle, tabla de IoCs con filtro por tipo/severidad y búsqueda por valor
- [ ] 10.7 **Automatización y Respuesta** (`/automatizacion`): consume `/automation/workflows`, `/automation/executions`, `/automation/responses` — estado de pipelines n8n, historial de ejecuciones y respuestas; acciones: simular ataque (modal con honeypot + payload), bloquear IP (modal con IP + razón + duration opcional) y crear ticket GLPI (modal con nombre, contenido y urgencia); estado degradado deshabilita acciones
- [ ] 10.8 Aplicar design system en todas las pantallas: badges de severidad con colores semánticos, telemetría (IPs/hashes/IDs MITRE) en JetBrains Mono, layout denso con sidebar fijo
- [ ] 10.9 Verificación manual end-to-end del frontend: navegar todas las pantallas con el stack arriba, verificar render con datos reales, estados vacíos y errores de API

## 11. Despliegue en docker-compose y nginx (design D7, spec despliegue-web)

- [ ] 11.1 Agregar servicio `api` a `docker-compose.yml`: build `./api`, container `soc-api`, red `red_interna`, `depends_on` postgres healthy, `environment` con `POSTGRES_*`, `SOC_ADMIN_*`, `SOC_JWT_SECRET`, `N8N_API_KEY`, `N8N_INTERNAL_URL=http://n8n:5678` — sin puerto publicado al host
- [ ] 11.2 Agregar servicio `web` a `docker-compose.yml`: build `./web`, container `soc-web`, red `red_interna`, `depends_on` api — sin puerto publicado al host
- [ ] 11.3 Actualizar `nginx/nginx.conf`: upstreams `api_backend` (api:8000) y `web_backend` (web:80); `location /` → web (fallback SPA), `location /api/` → api con `proxy_buffering off` y headers X-Forwarded, mantener `location /webhook/` (n8n) y `location /grafana/` (grafana)
- [ ] 11.4 Agregar a `.env` y `.env.example`: `SOC_ADMIN_USER`, `SOC_ADMIN_PASSWORD`, `SOC_JWT_SECRET` (placeholder vacío en `.env.example` con comentario de uso); documentar que `N8N_API_KEY` y `POSTGRES_*` ya existían
- [ ] 11.5 Verificar `docker compose config` sin warnings de variables vacías y que `nginx` monta el mismo `nginx.conf` actualizado
- [ ] 11.6 Grep de secretos: `git grep -iE "(SOC_ADMIN_PASSWORD|SOC_JWT_SECRET)=.+[A-Za-z0-9]{8,}"` NO debe arrojar valores reales (solo referencias en compose/env)

## 12. Verificación integral y cierre

- [ ] 12.1 `docker compose up -d` → `soc-api` y `soc-web` en estado running/healthy; `docker compose ps` lista 8 servicios sin Exit/Unhealthy
- [ ] 12.2 Login en la consola web (`http://localhost/`) con credenciales SOC del `.env` → redirige al Resumen del SOC con métricas reales de `honeypot_events`
- [ ] 12.3 Abrir Ataques en Vivo, generar un evento (simulación desde la UI de Automatización o `docker exec`/curl a un honeypot) y confirmar que aparece en el feed SIN recargar la página (<= 5s)
- [ ] 12.4 Explorar eventos con filtros, paginar, exportar CSV y abrir el detalle de un evento (raw_data + respuestas)
- [ ] 12.5 Ejecutar una simulación de ataque desde la UI de Automatización y confirmar que el evento resultante aparece en el Explorador y en el feed en vivo
- [ ] 12.6 Bloquear una IP desde la UI y confirmar que aparece un registro en `responses` (`action_type='bloqueo'`, `actor='n8n-automated'`)
- [ ] 12.7 Crear un ticket GLPI desde la UI y confirmar que aparece un registro en `responses` (`action_type='alerta'`, `actor='n8n-automated'`)
- [ ] 12.8 Regresión del stack existente: repetir verificaciones de `diagnostico-cadena` — healthz de n8n (host y red interna), POST de prueba a `/webhook/cowrie` y `/webhook/dionaea`, persistencia de un evento real, acceso a Grafana (`http://localhost/grafana/`) con dashboards OK
- [ ] 12.9 Revisión final de secretos: `git grep -iE "(password|secret).*=.+[A-Za-z0-9]{8,}"` sobre los archivos nuevos NO debe arrojar credenciales reales
- [ ] 12.10 Documentar en README (sección "Consola Web SOC"): acceso, login, arquitectura (api/web/nginx), acciones de automatización, variables nuevas del `.env` y verificación rápida (curl a health/login/overview)
- [ ] 12.11 Confirmar `openspec status --change web-soc-funcional` con todos los artifacts completos y listo para `/opsx:apply`