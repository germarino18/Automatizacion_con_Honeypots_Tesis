## Context

La cadena de respuesta automática del SOC ya está operativa: honeypots (Cowrie/Dionaea) → sidecar unificado → webhooks n8n → PostgreSQL `honeypot_events`, y la consola web (`api`/`web`) permite al operador ejecutar acciones SOAR vía n8n. La especificación `automatizacion-web` establece que el sistema **SHALL crear un ticket GLPI** vía n8n, con endpoint `POST /api/v1/automation/create-ticket` (trigger manual de la UI, contrato `{event_id, name, content, urgency}`).

Sin embargo, el workflow `workflows/webhook-glpi-ticket.json` ("PB-R2 - Respuesta Automatica: Creacion de Tickets (GLPI)") es **simulado**: solo inserta un registro de auditoría en la tabla `responses` (`action_type='alerta'`, `actor='n8n-automated'`, `details` JSONB con `ticket_name/content/urgency/created_at`) y responde éxito — **NO crea ningún ticket en una instancia GLPI real**. No existe GLPI en el stack.

El objetivo de este change es cerrar esa brecha: hacer la creación de tickets **real** integrando GLPI vía su API REST, manteniendo el registro local de auditoría (para Grafana y evidencia de tesis) y preservando el trigger manual de la UI como punto de entrada primario.

Restricciones del entorno (verificadas): el stack usa **PostgreSQL** (`postgres:15-alpine`, DB `honeypot_soc`). **GLPI requiere MySQL/MariaDB, no PostgreSQL** → se necesita un servicio de base de datos dedicado. Redes Docker: `red_dmz` (honeypots) y `red_interna` (postgres, n8n, grafana, nginx, api, web, sidecar). n8n (5678) y grafana se publican en `127.0.0.1` (precedente de hardening). n8n es el orquestador: la API delega las acciones por webhook y NO escribe `responses` directo (arquitectura SOAR, design D6 del change web-soc-funcional).

Stakeholders: operador SOC (crea tickets de incidentes), investigador de tesis (evidencia evaluable de respuesta automática real), administrador (configura GLPI/API). El hardering sigue el precedente `hardening-n8n` (retryOnFail/onError) y `despliegue-web` (bind loopback, credenciales por entorno sin literales).

## Goals / Non-Goals

**Goals:**
- Desplegar GLPI (imagen oficial `glpi/glpi` con tag fijo `11.0.8`) + base de datos MySQL/MariaDB dedicada en el mismo stack docker-compose, autocontenido y reproducible para la tesis.
- Crear un ticket **real** en GLPI vía su API REST (`initSession` → `POST /Ticket` → `killSession`) desde el workflow n8n `webhook-glpi-ticket.json`.
- Conservar la inserción local en `responses` como auditoría (Grafana/tesis), ahora enriqueciendo `details` con el `glpi_ticket_id` real.
- Preservar el trigger manual de la UI: `POST /api/v1/automation/create-ticket` → `/webhook/glpi-ticket` (el contrato API `{event_id, name, content, urgency}` y el frontend NO cambian).
- Endurecer GLPI (cuentas por defecto, usuario API dedicado con `user_token`, tokens por entorno, bind loopback).
- Verificar end-to-end: crear ticket desde la UI → ticket real visible en GLPI → registro en `responses` con `glpi_ticket_id` → sin regresión en la cadena existente.

**Non-Goals:**
- NO sustituir el patrón SOAR: sigue siendo n8n quien orquesta y escribe `responses`; la API NO llama a GLPI directo.
- NO cambiar el contrato del endpoint `create-ticket` ni el frontend (el mapeo de urgencia ocurre en el workflow).
- NO publicar GLPI por nginx ni exponerlo fuera de la red interna (se accede por red interna desde n8n; UI vía `127.0.0.1` bind).
- NO migrar el esquema PostgreSQL de `honeypot_events`/`responses` (solo se agrega un campo en el JSONB `details` de futuras inserciones).
- NO implementar sincronización bidireccional ni webhooks salientes de GLPI (feedback de estado del ticket) — cambio futuro.
- NO emitir alertas externas (Discord/Email) desde GLPI — fuera de alcance.

## Decisions

### D-glpi-1. Imagen de GLPI: oficial `glpi/glpi` con tag fijo

**Elegido:** imagen **oficial `glpi/glpi`** con **tag fijo** (`glpi/glpi:11.0.8`, GLPI 11.0.8 en 2026), que corre Apache interno en el puerto 80 y auto-instala en el primer arranque (desactivable con `GLPI_SKIP_AUTOINSTALL=true`). Se **fija el tag** para reproducibilidad exacta de la tesis (decisión del usuario), en lugar de `latest`.

- **Por qué**: mantenimiento activo por GLPI Project (compatible con el estándar de versiones de GLPI), con variables `GLPI_*` documentadas y volumen formal (`/var/glpi`). Fijar el tag garantiza que la demo y la evidencia de la tesis sean reproducibles entre ejecuciones/máquinas.
- **Alternativas**:
  - `diouxx/glpi`: común pero **stale** (mantenimiento irregular) — descartado por seguridad/soporte.
  - `glpi/glpi:latest`: se mantiene al día pero no es reproducible — descartado por decisión del usuario (reproducibilidad de tesis).
  - Image propia desde `nginx`+`php-fpm`+GLPI tarball: más control pero más superficie de build y mantenimiento — descartado por complejidad innecesaria para un stack de tesis.

### D-glpi-2. Base de datos MySQL/MariaDB dedicada + ubicación en red interna

**Elegido:** servicio **`glpi-db`** con imagen oficial `mysql` (o `mariadb`), volúmenes nombrados `glpi_data` (→`/var/glpi`) y `glpi_db_data` (→`/var/lib/mysql`), y ambos servicios (`glpi` y `glpi-db`) en la **red `red_interna`**. El puerto de GLPI (80) se publica bind a **`127.0.0.1`** (`"127.0.0.1:${GLPI_PORT:-8080}:80"`); el puerto MySQL NO se publica al host (solo alcanzable por red interna).

- **Por qué**: GLPI **requiere** MySQL/MariaDB y el stack usa PostgreSQL — no hay manera de reutilizar `postgres` sin violar el requisito de GLPI. Colocarlo en `red_interna` sigue el precedente de segmentación (n8n/api/web viven allí) y que n8n lo alcance por nombre de servicio (`http://glpi:80`). Bind a loopback repite el precedente de `despliegue-web`/`hardening-n8n` (admin services a `127.0.0.1`).
- **Alternativas**:
  - Usar la PostgreSQL existente: **imposible** — GLPI no soporta PostgreSQL. Descartado por restricción técnica dura.
  - Publicar MySQL al host: innecesario y amplía superficie de ataque — descartado.
  - Red separada para GLPI: sobre-segmentación; GLPI solo lo consumen n8n (red interna) y el administrador (loopback). Descartado.

### D-glpi-3. Autenticación de la API GLPI: usuario dedicado + user_token + app_token por entorno

**Elegido:** habilitar la **REST API** de GLPI (Setup → General → API: "Enable Rest API=Yes", "Enable login with credentials=Yes"), crear un **cliente de API** (App-Token) y un **usuario API dedicado** con perfil limitado (NO super-admin) cuyo `user_token` se genera por usuario. Ambos tokens se referencian por entorno en n8n (`{{ $env.GLPI_APP_TOKEN }}`, `{{ $env.GLPI_USER_TOKEN }}`) y viven en `.env` (NUNCA versionados). El flujo de auth es: `POST /apirest.php/initSession` (App-Token + Authorization `user_token <token>`) → operaciones → `GET /apirest.php/killSession`.

- **Por qué**: `user_token` evita exponer la contraseña del usuario en el workflow (si se filtra el workflow, el token se revoca sin resetear password). Perfil limitado reduce el impacto si el token se compromete. Precedente:`SOC_*`/`N8N_*` se referencian por entorno; `.gitignore` raíz cubre `.env`.
- **Alternativas**:
  - Basic `user:pass` en el header (`Basic base64(user:pass)`): válido pero expone la contraseña en el workflow/ejecuciones de n8n — descartado por hardening.
  - App-Token + External Token de GLPI para login automático: el flujo con `user_token` es el documentado y más simple para un usuario API dedicado; el External Token puede usarse como fallback. Se documenta.
  - Tokens hardcodeados en el workflow JSON: **descartado** — el workflow está versionado en el repo.

### D-glpi-4. Rework del workflow n8n: 3 nodos HTTP + auditoría PostgreSQL

**Elegido:** reestructurar `webhook-glpi-ticket.json` en este flujo de nodos:

1. **Webhook Ticket** (existente, `POST /webhook/glpi-ticket`) — entrada, contrato intacto.
2. **Init Session** (nodo HTTP `POST http://glpi/apirest.php/initSession`, headers `Content-Type: application/json`, `App-Token: {{ $env.GLPI_APP_TOKEN }}`, `Authorization: user_token {{ $env.GLPI_USER_TOKEN }}`), captura `session_token` del response.
3. **Create Ticket** (nodo HTTP `POST http://glpi/apirest.php/Ticket`, headers `Content-Type: application/json`, `App-Token: {{ $env.GLPI_APP_TOKEN }}`, `Session-Token: {{ $('Init Session').item.json.session_token }}`, body `{"input": {"name": "...", "content": "...", "type": 1, "urgency": <int>, "impact": 3, "_disablenotif": true}}`), captura `{id}`.
4. **Kill Session** (nodo HTTP `GET http://glpi/apirest.php/killSession`, headers `App-Token` + `Session-Token`) — cierre de sesión.
5. **Crear Ticket (auditoría)** (nodo PostgreSQL existente) — INSERT en `responses`, ahora con `details` agregando `glpi_ticket_id` (del paso 3) además de name/content/urgency/created_at.
6. **Responder** (existente) — devuelve `{ success, message, action_id, glpi_ticket_id, timestamp }`.

Cada nodo HTTP con `retryOnFail: true`, `maxTries: 3` y un `retryWaitTime` definido (precedente `hardening-n8n`); el nodo PostgreSQL conserva `onError: continueRegularOutput` para tolerar fallos puntuales sin romper la respuesta.

- **Por qué**: conserva la arquitectura SOAR (n8n orquesta; la API y el frontend no cambian) y materializa el requisito real de la spec. El `glpi_ticket_id` en `details` enlaza la auditoría local con el ticket real (evidencia defendible).
- **Alternativas**:
  - Hacer que la API llame a GLPI directo (sin n8n): rompe el patrón SOAR y haría que `responses`/historial de n8n dejaran de ser la fuente de auditoría — descartado.
  - Un solo nodo HTTP con todo el ciclo en una función/código: menos legible y no reutiliza el patrón de nodos de la repo — descartado.

### D-glpi-5. Mapeo de urgencia y ubicación de la traducción: en el workflow n8n

**Elegido:** el contrato de la API `{event_id, name, content, urgency}` se mantiene **idéntico**; el frontend sigue enviando `urgency` como string (`low/medium/high`). La **traducción a entero GLPI (1–5)** ocurre **en el workflow n8n** con una expresión/mapping en el nodo "Create Ticket" (`low→2, medium→3, high→4`, o tablero de mapeo con fallback a `3`).

- **Por qué**: no tocar `schemas/automation.py` (evita romper frontend, `test_automation.py` y `test_n8n_client.py`) ni `routers/automation.py`. La traducción es una lógica de integración GLPI que pertenece al workflow (contract of the webhook), manteniendo la UI agnóstica del protocolo GLPI.
- **Alternativa considerada**: traducir en la API (schemas) a int antes de POSTear. Funcionaría pero expone el formato GSGLPI en el contrato de la API y obligaría a tocar schemas/tests/frontend para nada — descartado por minimizar superficie de cambio.

- **Elegido para `_disablenotif` (decisión del usuario)**: **notificaciones de email HABILITADAS** para el ticket creado. El body del `POST /Ticket` NO usa `_disablenotif: true` (se omite o se usa `false`), de modo que GLPI dispara sus notificaciones por email al ticket (más completo y demostrable en la tesis: la respuesta automática no solo crea el ticket, sino que notifica). Requiere que GLPI tenga configurado un servidor de correo saliente (SMTP) en Setup → Notifications, lo cual se documenta como paso de configuración (spec `despliegue-glpi`).
- **Importante**: si GLPI no tiene SMTP configurado, la creación del ticket funciona igual; solo no se envía el email. El workflow no falla por falta de SMTP.

### D-glpi-6. Capa de API / frontend: sin cambios (salvo el registro de errores GLPI en la auditoría)

**Elegido:** el endpoint `POST /api/v1/automation/create-ticket` y su cliente `n8n_client.create_ticket()` **no cambian** (mismo contrato y misma URL `/webhook/glpi-ticket`). El frontend (`ActionModals.tsx`, `mutations.ts`) **no cambia**. La API sigue reportando 502/503 vía `_ensure_success` si n8n responde `success: false`, y pasa `glpi_ticket_id` dentro de `result` (que es un dict opaco).

**Elegido:** el endpoint `POST /api/v1/automation/create-ticket` y su cliente `n8n_client.create_ticket()` **no cambian** (mismo contrato y misma URL `/webhook/glpi-ticket`). El frontend (`ActionModals.tsx`, `mutations.ts`) **no cambia**. La única posible micro-adaptación: si el payload devuelto por el workflow incluye `glpi_ticket_id`, la API lo pasa tal cual dentro de `result` (es transparente, ya que `CreateTicketResponse.result: dict` es opaco).

- **Por qué**: el objetivo es que el comportamiento de negocio sea real, no cambiar la superficie de la API; minimiza regresión y mantiene los tests existentes (actualizándolos solo para reflejar el nuevo `result`). Las pruebas E2E se extienden para verificar el ticket real en GLPI.
- **Alternativa**: agregar un campo `glpi_ticket_id` tipado al `CreateTicketResponse`; útil para la UI pero opcional y posterior — descartado en este change para no tocar el frontend.

### D-glpi-7. Auditoría de errores GLPI en `responses` (decisión del usuario)

**Elegido:** **sí** registrar en `responses` los intentos **fallidos** de creación de ticket GLPI con `status='error'` (y, si aplica, `details.error` con el motivo), además de los exitosos con `status='completed'` y `glpi_ticket_id`. El workflow, en el flujo `onError`, inserta también la fila de auditoría de fallo. Esto es evidencia valiosa para la tesis: demuestra tanto los casos de éxito como los de fallo de la respuesta automática (y permite métricas de tasa de éxito/fallo en Grafana).

- **Por qué**: pedido explícito del usuario (la información de errores es importante para la tesis). Distingue el comportamiento real de la degradación: la API sigue sin reportar falso éxito (502/503), pero el intento queda auditado en la BD.
- **Concretamente**: el nodo de auditoría inserta con `action_type='alerta'`, `actor='n8n-automated'`, y `status='completed'` (si GLPI creó el ticket) o `status='error'` (si GLPI n8n falló o GLPI rechazó el ticket). En `details` se guarda `glpi_ticket_id` cuando existe y/o `error` con la descripción del fallo.
- **Alternativa**: no insertar nada en fallo (default anterior) — descartado por decisión del usuario: se pierde la evidencia del fallo.

## Risks / Trade-offs

- **[GLPI no disponible / API caída al crear ticket] → Mitigación**: el workflow con `retryOnFail` reintenta; si tras reintentos falla, `respondToWebhook` reporta `success: false` y la API (`_ensure_success`) responde 502 SIN reportar falso éxito en la UI. La auditoría local **sí** registra el intento: en fallo el nodo de auditoría inserta una fila con `status='error'` (y `details.error`), de modo que la tesis conserva la evidencia del fallo (D-glpi-7).
- **[Auto-install de GLPI en primer arranque con SQL sellado] → Mitigación**: primer arranque con auto-install habilitado; el seed de tablas MySQL queda en `glpi_db_data`. Se documenta el flujo de primer deploy y se versiona el DDL/init de MySQL en `postgres`-like (o se acepta la instalación automática de GLPI). No es destructivo: se captura el estado inicial.
- **[Dependencia de una imagen con tag fijo] → Trade-off**: se usa `glpi/glpi:11.0.8` fijado para reproducibilidad de la tesis; no recibe updates automáticos de imagen (se actualiza el tag deliberadamente). Aceptado por decisión del usuario.
- **[MySQL adicional aumenta los servicios del stack] → Trade-off**: aceptado — es el costo de un GLPI real autocontenido; el servicio queda en `red_interna` sin puerto publicado.
- **[Tokens GLPI en `.env`] → Mitigación**: `.gitignore` raíz cubre `.env`; el workflow usa `{{ $env.* }}` (nunca literales); se agregan a `.env.example` con placeholder no trivial; revisión con grep de secretos previo a commit (precedente `despliegue-web`).
- **[Cuentas GLPI por defecto (glpi/glpi, tech/tech, normal/normal, post-only/postonly)] → Mitigación**: cambio de contraseñas de TODAS las cuentas por defecto al primer acceso y creación de un usuario API dedicado con perfil limitado (NO super-admin). Documentado en tasks.
- **[El workflow reworkado rompe la cadena actual] → Mitigación**: se mantiene la ruta `/webhook/glpi-ticket` y el nodo PostgreSQL de auditoría existente; se activa/verifica el workflow en n8n y se valida que `/webhook/firewall-block` y `/webhook/cowrie|dionaea` no se ven afectados (regresión `diagnostico-cadena`).
- **[Binding de GLPI solo loopback limita acceso remoto] → Trade-off**: GLPI se consume por red interna desde n8n; si el operador necesita la UI GLPI remota, se documenta el túnel SSH / acceso vía host. Aceptado por hardening.

## Migration Plan

1. **Deploy**: agregar servicios `glpi-db` y `glpi` a `docker-compose.yml` (aditivo) con volúmenes nombrados `glpi_data`/`glpi_db_data` y defaults `GLPI_*`; agregar variables `GLPI_*` a `.env`/`.env.example`.
2. **Primer arranque + configuración única**: `docker compose up -d` → GLPI auto-instala; cambio de contraseñas de cuentas por defecto; Setup → General → API: Enable Rest API + Enable login with credentials; crear cliente de API (App-Token) y usuario API dedicado (`user_token`); copiar ambos tokens al `.env`.
3. **Rework del workflow**: editar `workflows/webhook-glpi-ticket.json` (nodes initSession/create/killSession + auditoría con `glpi_ticket_id`, retryOnFail) e importar/activar en el n8n corriendo.
4. **Verificación**: crear ticket desde la UI (`POST /api/v1/automation/create-ticket`) → confirmar ticket real en GLPI (API o UI) → confirmar INSERT en `responses` con `glpi_ticket_id` → regresión de `diagnostico-cadena` (healthz, webhooks, persistencia).
5. **Actualización de specs y sync/archive**: actualizar/extender tests (`test_automation.py`, `test_n8n_client.py`), sync delta specs → main specs (automatizacion-web, nueva despliegue-glpi) y archivar el change.

**Rollback**: revertir el commit del change → `docker compose up -d`; remover `glpi`/`glpi-db` y los volúmenes nombrados restaura el estado previo (los servicios existentes no se ven afectados; el workflow puede revertirse al JSON original). No hay migración destructiva sobre `responses`/`honeypot_events`.

## Open Questions

- ~~¿Se fija el tag de la imagen `glpi/glpi` (p. ej. `glpi/glpi:11.0.8`) para reproducibilidad exacta de tesis, o se deja `latest`?~~ **RESUELTO** por el usuario: se fija `glpi/glpi:11.0.8` (D-glpi-1).
- ~~¿Se debe INSERTAR un registro de `responses` con `status='error'` cuando GLPI falla...?~~ **RESUELTO** por el usuario: **sí**, se registra el fallo en `responses` con `status='error'` (D-glpi-7).
- ~~¿`_disablenotif: true` en el body del Ticket debe ser configurable por entorno?~~ **RESUELTO** por el usuario: notificaciones de email **habilitadas** (se omite `_disablenotif: true`), configurando SMTP en GLPI; el workflow no falla si no hay SMTP.
- ~~¿El mapeo de urgencia exacto (low/medium/high → 2/3/4 con fallback) es el deseado...?~~ **RESUELTO** por el usuario: `low→2, medium→3, high→4`, con fallback a 3 (D-glpi-5).
