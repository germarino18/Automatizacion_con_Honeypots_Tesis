## Context

El SOC ya tiene la cadena de datos completa y verificada: honeypots (Cowrie/Dionaea) → sidecar unificado → webhooks n8n → PostgreSQL `honeypot_events` (capacidad `ataque-registro` archivada), diagnóstico end-to-end (`diagnostico-cadena` archivada) y una capa de visualización Grafana con 4 dashboards provisionados (`visualizacion-grafana` archivada). La infraestructura incluye: `postgres` (15-alpine), `n8n` (orquestador con backend PostgreSQL), `cowrie`, `dionaea`, `grafana`, `nginx` (proxy reverso que hoy solo sirve n8n en `/` y Grafana en `/grafana/`) y `sidecar`. El esquema real de PostgreSQL incluye `honeypot_events` (16 columnas), `responses`, `iocs`, `attack_sessions` y las vistas `metrics_summary`/`top_attackers`.

Lo que FALTA es la consola web operativa: el prototipo estático de Stitch ("Honeypot SOC: Threat Intelligence Platform", proyecto `10945377982112649629`) define el producto deseado — 8 pantallas (Resumen del SOC, Ataques en Vivo, Mapa Geográfico, Automatización y Respuesta, Malware & IoC, Login, Matriz MITRE ATT&CK, Explorador de Eventos) con design system "Obsidian Sentinel" (dark-first, Inter + JetBrains Mono, accent cyan `#06b6d4`). Ese prototipo es mockup: los datos son estáticos. Este change lo convierte en una aplicación funcional conectada a los datos reales del SOC, alineada con las historias de usuario HU 1–7 y HU 9–10.

Restricciones del entorno: Windows/PowerShell (host de desarrollo), redes Docker `red_dmz` (solo los honeypots cowrie/dionaea, con salida) y `red_interna` (red bridge de servicios internos — postgres, n8n, grafana, nginx, sidecar; sin `internal: true`). nginx es el único punto de entrada al stack desde el host (puertos 80/443). Los honeypots NO comparten red con los servicios internos: el sidecar es la ÚNICA vía de eventos (lee los jsonlog y POSTea a los webhooks de n8n por red interna `http://n8n:5678/webhook/...`).

Stakeholders: operador SOC (monitoreo en tiempo real, respuesta), investigador (MITRE, IoCs, origen geo), administrador (métricas MTTD/MTTR), y el equipo de tesis (demo evaluable). Alineación con `docs/historias_de_usuario.md` y con el PRD de Stitch.

## Goals / Non-Goals

**Goals:**
- Construir una API backend (FastAPI) que exponga los datos reales de PostgreSQL (eventos, métricas, MITRE, geo, malware/IoC, respuestas) y las acciones de automatización hacia n8n, con autenticación por sesión JWT y feed en vivo por SSE.
- Construir un frontend SPA (React + Vite + TS) que replique las 8 pantallas del prototipo Stitch consumiendo la API real, con el design system Obsidian Sentinel.
- Desplegar ambos servicios en docker-compose y rutearlos por nginx (`/` SPA, `/api/` API, conservando `/webhook/` y `/grafana/`).
- Permitir acciones reales de automatización desde la web: simular ataque (cadena real hasta PostgreSQL), bloquear IP y crear ticket GLPI (vía los workflows n8n existentes → tabla `responses`).
- Verificar end-to-end: login → dashboard con datos → evento en vivo → simulación visible en el feed → sin regresión en la cadena existente.

**Non-Goals:**
- NO implementar alertas a Discord/Telegram/Email (HU 8) — queda como change futuro.
- NO implementar laboratorio de simulaciones avanzado (HU 6 parcial: solo simulación vía webhook real, sin perfilado EICAR/emu de dionaea — eso ya se probó en el change workflows-n8n).
- NO modificar el esquema PostgreSQL ni los workflows n8n existentes (se reutilizan `workflows/webhook-firewall-block.json` y `workflows/webhook-glpi-ticket.json`; no se crean workflows nuevos; `honeypot_events`, `responses`, `iocs`, `attack_sessions` se leen/escriben tal cual).
- NO tocar los honeypots, grafana ni el sidecar.
- NO integrar OAuth/SSO ni multi-tenant: autenticación simple de un administrador SOC (propósito de tesis/demo).
- NO construir dashboards nuevos en Grafana (la consola web es complementaria, no reemplaza Grafana).
- NO publicar el API o el frontend fuera de la red interna (se sirve por nginx en el host).

## Decisions

### D1. Backend: FastAPI (Python) vs alternativa Node/Express

**Elegido:** **FastAPI** (Python 3.11, uvicorn) con `asyncpg` para PostgreSQL, `PyJWT` para auth y `httpx` para llamadas a n8n.

- **Por qué**: el proyecto ya es Python-first (el sidecar es Python puro; dionaea es Python). FastAPI da: tipado con Pydantic (DTOs de los eventos), documentación OpenAPI automática (`/docs`), soporte nativo de async (ideal para SSE), y validación de query params/filtros sin boilerplate.
- **Alternativas**:
  - Node/Express: válido pero parte el stack en dos lenguajes; el sidecar y la lógica existente son Python. Descartado por coherencia.
  - Go: excelente rendimiento pero sin precedente en el repo y sobre-ingeniería para una API de demo.
  - Reusar n8n como API (nodos webhook): descartado — n8n es orquestador, no una capa de API con filtros/paginación/SSE reutilizables; acoplaría la UI a la lógica de workflows.

### D2. Frontend: React + Vite + TypeScript vs alternativas

**Elegido:** **React 18 + Vite + TypeScript** con `react-router-dom` (SPA routing), `@tanstack/react-query` (fetch/caching/retry), `recharts` (gráficos) y mapa offline con `react-simple-maps`/`d3-geo` (topojson embebido). Estilos con **CSS variables + Tailwind** opcional; se priorizan CSS custom properties del design system (tokens Obsidian Sentinel).

- **Por qué**: SPA pura (sin SSR) es lo que pide el PRD ("Flujo de Navegación (SPA)"), Vite es el build tool estándar de 2026, TS da seguridad sobre los DTOs del API, react-query maneja el estado del servidor (refetch, cache, error states) y recharts es declarativo y offline-friendly.
- **Alternativas**:
  - Next.js: sobre-ingeniería para una SPA interna sin SEO ni SSR; el deploy es un static build servido por nginx. Descartado.
  - Vue/Svelte: válidos pero el prototipo y el ecosistema del equipo apuntan a React.
  - Vanilla JS/HTML: descartado — 8 pantallas con estado en vivo y gráficos exigen un framework.
- **Mapa offline**: el host de demo puede no tener acceso a tile servers de mapas, por lo que la UI no debe depender de tiles externos. Se usa un mapa vectorial embebido (world topojson de baja resolución) con `react-simple-maps` — sin tiles externos, renderiza países con color por cantidad de eventos. Alternativa: leaflet con tiles de OSM (depende de internet) — descartado por la restricción de red del entorno de demo.

### D3. Autenticación: sesión JWT simple (no OAuth)

**Elegido:** **JWT emitido por la API** con credenciales `SOC_ADMIN_USER`/`SOC_ADMIN_PASSWORD` del entorno; token firmado con `SOC_JWT_SECRET`, expiración 8h, enviado como cookie `HttpOnly`/`SameSite=Lax` (con fallback a header `Authorization: Bearer` para pruebas). Endpoints: `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, rutas protegidas devuelven 401 sin token válido.

- **Por qué**: propósito de tesis/demo SOC — un solo administrador, cero infraestructura de identidad. JWT con cookie HttpOnly es suficiente y enseñable (se explica el mecanismo en el README/memoria). Sin refresh token: al expirar se redirige a login.
- **Alternativas**:
  - OAuth/Keycloak: sobre-ingeniería y dependencia externa para una demo de tesis. Descartado.
  - Sesión server-side con cookies de estado: válido pero exige almacenar sesiones; JWT es stateless y más simple de explicar/verificar.
  - Basic auth en cada request: simple pero sin expiración/logout real y mala UX. Descartado.

### D4. Datos en vivo: SSE (Server-Sent Events) vs WebSocket vs polling

**Elegido:** **SSE** en `GET /api/v1/events/live` (evento `event: event` por fila nueva, `ping` de heartbeat cada 15s, autenticado). El backend consulta `honeypot_events` por `id > last_sent` con polling interno de ~2s (mismo patrón que el tailer del sidecar, pero sobre la BD) y emite por el stream.

- **Por qué**: la dirección es unidireccional (BD → UI), SSE es nativo de HTTP (funciona tras nginx con `proxy_buffering off`, sin handshake especial), tiene reconexión automática en el navegador y en FastAPI es un `StreamingResponse` simple. Polling de BD cada 2s es trivial y suficiente para un SOC de demo (no decenas de miles de eventos/seg).
- **Alternativas**:
  - WebSocket: bidireccional (no lo necesitamos), más complejo tras nginx (upgrade headers) y sin ventaja para este caso. Descartado.
  - Polling desde el cliente cada 2s: más requests y más latencia percibida; SSE lo hace con una sola conexión. Se mantiene como **fallback** si SSE falla (degradación en UI).
  - `LISTEN/NOTIFY` de PostgreSQL: elegante pero agrega complejidad de conexión dedicada; el polling de 2s es suficiente y más simple. Se deja como mejora futura.

### D5. Acceso a datos: capa de repositorio con SQL parametrizado (no ORM)

**Elegido:** **Capa de repositorios** (`api/app/repositories/`) con SQL explícito parametrizado (`asyncpg`), mapeado a DTOs Pydantic. Las vistas `metrics_summary`/`top_attackers` y las tablas existentes se usan tal cual; filtros/paginación se aplican en queries.

- **Por qué**: el esquema ya existe y está documentado en `postgres/init.sql`; un ORM (SQLAlchemy) agrega migraciones/abstracción que aquí no aportan. SQL explícito + parámetros evita inyección y hace los queries revisables (mismo espíritu que el INSERT parametrizado de los workflows n8n).
- **Regla**: las consultas solo LEEN `honeypot_events`, `iocs`, `attack_sessions`, `responses` y las vistas; el único WRITE del sistema es la inserción en `responses` hecha por el workflow n8n (no por la API).

### D6. Integración con n8n: API pública de n8n + webhook de acción

**Elegido:** dos vías de integración:

1. **Lectura** (listar workflows/ejecuciones): la API usa la API pública de n8n (`GET /api/v1/workflows`, `GET /api/v1/executions`) con el header `X-N8N-API-KEY` (desde `N8N_API_KEY`; n8n 2.x eliminó Basic Auth de la API pública) vía `httpx` desde la `red_interna`.
2. **Escritura (acciones)**:
   - **Simular ataque**: `POST /api/v1/automation/simulate` → POST a `http://n8n:5678/webhook/cowrie` o `/webhook/dionaea` con payload de prueba → recorre la cadena REAL (workflow → INSERT → PostgreSQL).
   - **Bloquear IP**: `POST /api/v1/automation/block-ip` → POST a `http://n8n:5678/webhook/firewall-block` (workflow EXISTENTE `webhook-firewall-block.json`) → INSERT en `responses` (`action_type='bloqueo'`, `actor='n8n-automated'`). Mapeo de payload: la API recibe `{src_ip, event_id, reason}` y POSTea `{event_id, ip: src_ip, duration, reason}` (duration opcional/null, coincide con el contrato del workflow).
   - **Crear ticket GLPI**: `POST /api/v1/automation/create-ticket` → POST a `http://n8n:5678/webhook/glpi-ticket` (workflow EXISTENTE `webhook-glpi-ticket.json`) → INSERT en `responses` (`action_type='alerta'`, `actor='n8n-automated'`). Payload `{event_id, name, content, urgency}` (mismo contrato que el webhook).

**Workflows n8n EXISTENTES reutilizados** (se versionan en `workflows/` y ya están en el repo):
- `webhook-firewall-block.json`: receptor webhook `firewall-block` + nodo PostgreSQL con INSERT parametrizado en `responses` (`action_type='bloqueo'`, `actor='n8n-automated'`, `status='completed'`, `details` JSONB `{ip, duration, reason, executed_at}`), devolviendo el id insertado.
- `webhook-glpi-ticket.json`: receptor webhook `glpi-ticket` + nodo PostgreSQL con INSERT parametrizado en `responses` (`action_type='alerta'`, `actor='n8n-automated'`, `status='completed'`, `details` JSONB `{ticket_name, content, urgency, created_at}`), devolviendo el id insertado.

Solo se verifica/activa la importación de ambos en el n8n corriendo (UI o `n8n import:workflow`), siguiendo las convenciones del repo; no se crean workflows nuevos.

- **Por qué**: mantener a n8n como orquestador (SOAR) — la API NO escribe `responses` directo; delega la acción al orquestador y reporta el resultado. Esto respeta la arquitectura existente y hace la acción auditable en n8n.
- **Alternativas**: que la API escriba directo en `responses` (más simple pero salta a n8n y rompe la cadena SOAR) — descartado.

### D7. Despliegue: servicios `api` y `web` + nginx

**Elegido:**
- **`api`** (container `soc-api`): imagen `python:3.11-slim` construida desde `api/`, red `red_interna` (alcanza postgres y n8n), sin puerto publicado al host (solo nginx lo alcanza por red interna). Recibe `POSTGRES_*`, `SOC_ADMIN_USER`, `SOC_ADMIN_PASSWORD`, `SOC_JWT_SECRET`, `N8N_API_KEY`, `N8N_INTERNAL_URL=http://n8n:5678`. Healthcheck: `GET /api/v1/health`.
- **`web`** (container `soc-web`): imagen `node:20-alpine` construida desde `web/` con build multi-stage (build → nginx:alpine sirviendo estáticos en el mismo contenedor). Sin puerto publicado; nginx lo alcanza por red interna. Fallback SPA con `try_files $uri /index.html`.
- **`nginx`**: se actualiza `nginx/nginx.conf`:
  - `location /` → upstream `web` (SPA)
  - `location /api/` → upstream `api:8000` con `proxy_buffering off` (SSE), headers de forwarding
  - `location /webhook/` → n8n (se mantiene, sin buffering)
  - `location /grafana/` → grafana (se mantiene)
- **Por qué**: un solo punto de entrada (nginx) mantiene la topología existente; los contenedores nuevos viven en la `red_interna` sin exponerse al host (superficie de ataque mínima, coherente con la segmentación del proyecto).

### D8. Severidad: mapeo de `risk_score` a severidad

**Elegido:** bucket de severidad derivado del `risk_score` (0.00–1.00) para la UI y los filtros: `low` [0, 0.33), `medium` [0.33, 0.66), `high` [0.66, 0.85), `critical` [0.85, 1]. Cuando `risk_score` es 0 (default) se considera `low`. El mapeo vive en un módulo compartido de la API (`api/app/services/severity.py`) y se documenta en el README.

- **Por qué**: `risk_score` está poblado por los workflows PB-H1/PB-H2; la UI necesita una escala categórica para badges y filtros (como el prototipo). Alternativa: usar `att_ck_technique` o reglas por fuente — descartada por falta de cobertura uniforme.

### D9. Design system Obsidian Sentinel en la UI

**Elegido:** portar los tokens del design system del prototipo Stitch a **CSS custom properties** en `web/src/styles/tokens.css`: fondos (`#0a0a0c` base, `#0f172a` surface, `#1e293b` elevated), accent `#06b6d4`, success `#10b981`, severidad (`#ef4444` critical, `#f97316` high, `#f59e0b` medium), tipografía Inter (UI) + JetBrains Mono (telemetría: IPs, hashes, IDs MITRE), radio `0.25rem`, sidebar 240px. Fuentes servidas localmente (woff2) para no depender de Google Fonts (red interna sin salida).

- **Por qué**: fidelidad al prototipo aprobado (la UI ya fue diseñada en Stitch); tokens como variables hacen el tema mantenible y verificable (escenario "Tokens de diseño aplicados").

### D10. Exportación CSV del explorador

**Elegido:** la exportación CSV se genera en el **frontend** (client-side) a partir de la página actual de resultados (`/api/v1/events`), con separador `;` (locale español) y codificación UTF-8 BOM para Excel. No se agrega endpoint de exportación server-side.

- **Por qué**: simple, sin costo de servidor, y suficiente para la HU 10 (exportar CSV). Alternativa: endpoint `/export` con streaming server-side — se deja como mejora si el volumen lo amerita.

### D11. Frontend: arquitectura feature-based, pnpm como gestor y login demo pre-llenado (Option A)

**Elegido:** tres decisiones aplicadas durante la implementación de los grupos 8–9:

1. **Estructura feature-based (Screaming Architecture)** en `web/src/`: `app/` (App con router+providers, entry `main.tsx`, vista 404), `features/<dominio>/` (cada feature posee su pantalla + sus hooks react-query privados: auth, overview, live-feed, events-explorer, mitre, geo-map, malware, automation), `components/` (UI compartida: Sidebar, Header, ScreenPlaceholder), `lib/` (cliente API `api.ts` + infraestructura transversal) y `styles/` (tokens/app CSS sin cambios). Convención: un hook vive junto a la feature que lo consume; solo lo verdaderamente cruzado sube a `lib/` o `components/`. Casos límite documentados: `useHealth.ts` → `lib/` (infraestructura de salud consumida por el Sidebar, no es UI); `useEvents.ts` → `events-explorer/` (el feed en vivo separará su parte SSE al implementarse en el grupo 10); `NoEncontrado.tsx` → `app/` (vista ligada al catch-all del router).
2. **pnpm como package manager** (v11.1.2 fijada en `packageManager`): se elimina `package-lock.json`, se genera `pnpm-lock.yaml` y el build stage del `web/Dockerfile` usa corepack (`corepack enable && pnpm install --frozen-lockfile && pnpm run build`) sobre `node:20-alpine`; el stage de nginx queda intacto. Nota crítica: pnpm 11 ya NO lee overrides desde `package.json` (ni npm-style ni `pnpm.overrides`) — la configuración se movió a `pnpm-workspace.yaml`, por lo que el override de seguridad `d3-color ^3.1.0` vive allí (verificado con `pnpm why d3-color`: una única versión 3.1.0).
3. **Login demo pre-llenado ("Option A")**: `features/auth/Login.tsx` pre-completa usuario/contraseña desde `VITE_SOC_DEMO_USER` / `VITE_SOC_DEMO_PASSWORD` (vacíos por defecto; ejemplo vacío versionado en `web/.env.example`). Los valores reales NUNCA se versionan: `.gitignore` raíz ya cubre `.env`/`.env.local` a cualquier profundidad. La sesión sigue siendo la cookie HttpOnly (D3): `AuthContext` sondea un endpoint protegido (`GET /overview`; `/health` es público y no sirve como sonda) para restaurar el estado al recargar, `RequireAuth` redirige a `/login` sin sesión mostrando estado "Verificando…" para evitar flash de login, y el logout del Header llama `POST /auth/logout` y limpia el contexto.

- **Por qué**: la estructura feature-based mantiene cada dominio del SOC cohesivo y escalable para los grupos 10–12; pnpm da installs determinísticos más rápidos y lockfile estándar para CI/Docker; Option A elimina fricción en la demo evaluable de la tesis sin comprometer secretos (los campos editables permiten probar también credenciales erróneas y el error 401).

## Risks / Trade-offs

- **[n8n caído al listar workflows/ejecuciones] → Mitigación**: la API degrada con `degraded: true` y lista vacía; la UI muestra estado degradado y deshabilita acciones. No falla la app completa.
- **[n8n caído al simular/bloquear] → Mitigación**: la API responde 502/503 y NO reporta éxito falso; la UI muestra el error y permite reintentar.
- **[SSE cortado por nginx] → Mitigación**: `proxy_buffering off` + `X-Accel-Buffering: no` en el endpoint; fallback a polling en el frontend.
- **[Rendimiento de polling cada 2s sobre la BD] → Mitigación**: query `WHERE id > $1 ORDER BY id LIMIT N` usa el índice PK; rango de tiempo opcional para acotar; aceptable para el volumen de un SOC de tesis.
- **[JWT en cookie HttpOnly vs CORS] → Mitigación**: el frontend se sirve en el MISMO origen (nginx, `/` y `/api/` en el mismo host:puerto) → no hay CORS real; cookies SameSite=Lax funcionan sin configuración extra. Si en dev se usan puertos distintos (Vite dev server), se habilita CORS en la API SOLO para localhost de desarrollo.
- **[Secretos en el repo] → Mitigación**: `SOC_*` solo por entorno; revisión con grep de secretos previo a commit (mismo proceso que grafana/workflows).
- **[Workflows n8n reutilizados rompen la cadena existente] → Mitigación**: `webhook-firewall-block.json` (`/webhook/firewall-block`) y `webhook-glpi-ticket.json` (`/webhook/glpi-ticket`) usan rutas webhook que no colisionan con `/webhook/cowrie` ni `/webhook/dionaea`; el INSERT en `responses` es aditivo (tabla ya existe con índices). Se verifica que los workflows existentes sigan activos tras la importación.
- **[Mapa offline pobre visualmente] → Trade-off**: el topojson embebido de baja resolución es suficiente para países; se complementa con lista/tabla de países ordenada por cantidad.
- **[Un único admin SOC] → Trade-off**: aceptado — la tesis no requiere multi-tenant; el modelo de auth (D3) es extensible a más usuarios con tabla `users` en un change futuro.
- **[La consola duplica parcialmente Grafana] → Trade-off**: complemento, no reemplazo: Grafana queda para deep-dive analítico (series, alertas futuras); la consola cubre operación interactiva y automatización que Grafana no ofrece.
- **[Build del frontend requiere Node en el pipeline] → Mitigación**: el build ocurre en el multi-stage de Docker (`web/Dockerfile`), no en la máquina del desarrollador; `npm ci` corre en el contenedor.

## Migration Plan

1. **Deploy**: agregar los servicios `api` y `web` a `docker-compose.yml` (aditivo, no toca los existentes), crear `api/` y `web/` con su código, actualizar `nginx/nginx.conf` (nuevos upstreams y locations), agregar variables `SOC_*` al `.env`/`.env.example`, y verificar/activar en el n8n corriendo los workflows existentes `workflows/webhook-firewall-block.json` y `workflows/webhook-glpi-ticket.json` (importación manual o `n8n import:workflow --input=...` si no están activos).
2. **Arranque**: `docker compose up -d` → postgres, n8n, grafana, nginx, api, web levantan; nginx sirve SPA en `/` y proxea `/api/`.
3. **Verificación**: login → dashboard con datos reales → feed en vivo → simulación de ataque visible → bloqueo de IP con registro en `responses` → regresión de `diagnostico-cadena` (healthz, webhooks, persistencia).
4. **Rollback**: revertir el commit del change y `docker compose up -d`; eliminar `api/` y `web/` restaura el estado previo (los servicios existentes no se ven afectados). Los workflows reutilizados (`webhook-firewall-block.json`, `webhook-glpi-ticket.json`) son los mismos del repo y pueden desactivarse desde la UI de n8n si se importaron. No hay migración destructiva de datos.

## Open Questions

- ¿El dashboard "Resumen" debe reemplazar la home de n8n en nginx o coexistir? Se asume: la SPA es la home (`/`); n8n sigue accesible por su puerto directo `http://localhost:5678` (como hoy) y vía red interna. Confirmar si se quiere también un `location /n8n/` en nginx.
- ¿Se desea el refresh del feed de Ataques en Vivo configurable (1s/2s/5s)? Se asume polling interno de 2s (D4); se expone como constante configurable.
- ¿El MTTD/MTTR debe calcularse con una query dedicada o con la vista `metrics_summary`? Se asume: MTTD = AVG(`created_at` − `timestamp`) en el rango; MTTR = AVG de tiempo entre evento y su respuesta en `responses` si existe data, si no se muestra "—". Confirmar en verificación si la data disponible permite MTTR real.
- ¿El prototipo incluye pantalla "Detalle de Incidente" (PRD punto 5) aunque el listado de pantallas no la lista? Se asume NO como pantalla independiente; el detalle de evento (spec api-soc) cubre el caso con `GET /api/v1/events/{id}` + respuestas, y el Explorador permite abrirlo. Si el usuario quiere una pantalla de incidente dedicada, se propone como change futuro.