## Why

La especificación `automatizacion-web` establece que el sistema **SHALL crear un ticket GLPI** vía n8n, pero el workflow actual (`workflows/webhook-glpi-ticket.json`) solo inserta un registro de auditoría local en la tabla `responses` (`action_type='alerta'`, `actor='n8n-automated'`) — NO crea un ticket real en ninguna instancia GLPI. La automatización es, por tanto, simulada: se audita como si el ticket se hubiera creado, pero no existe un ticket real. Esta brecha impide que la tesis demuestre una respuesta automática genuina y evaluable frente a un incidente SOC real.

## What Changes

- **BREAKING (comportamiento)**: el workflow `webhook-glpi-ticket.json` deja de ser solo una inserción local; se reestructura para **crear un ticket real en GLPI vía su API REST** (`initSession` → `POST /Ticket` → `killSession`) **y además** conserva la inserción local en `responses` como auditoría (para Grafana/evidencia de tesis). El trigger manual de la UI (`POST /api/v1/automation/create-ticket` → `/webhook/glpi-ticket`) se preserva intacto como punto de entrada primario.
- **Despliegue de GLPI** en el mismo stack docker-compose (autocontenido y reproducible para la tesis): servicio `glpi` (imagen oficial `glpi/glpi:11.0.8` tag fijo) + servicio `glpi-db` (MySQL/MariaDB dedicado, porque GLPI NO soporta PostgreSQL y el stack usa PostgreSQL).
- **Variables de entorno nuevas**: `GLPI_*` (host DB, usuario, password, tokens `GLPI_APP_TOKEN`/`GLPI_USER_TOKEN`, etc.) agregadas a `.env`/`.env.example`, consumidas por referencia en compose y en el workflow n8n (`{{ $env.GLPI_APP_TOKEN }}` / `{{ $env.GLPI_USER_TOKEN }}`). Ningún secreto se versiona.
- **Mapeo de urgencia**: el payload de la API `{event_id, name, content, urgency}` se mantiene (el frontend sigue enviando `low/medium/high`); la traducción a entero GLPI (1–5) ocurre en el workflow n8n.
- **Detalle de auditoría**: `responses.details` pasa a almacenar también el `glpi_ticket_id` real devuelto por la API de GLPI (además de name/content/urgency), y los **fallos** de creación de ticket GLPI se registran en `responses` con `status='error'` y motivo en `details.error` (evidencia de errores para la tesis).
- **Notificaciones de email**: los tickets creados se crean con notificaciones de correo habilitadas (se omite `_disablenotif: true`); se documenta la configuración SMTP en GLPI (opcional: si no hay SMTP, la creación funciona igual).
- **Endurecimiento**: cambio de las cuentas GLPI por defecto y uso de un usuario API dedicado con `user_token` (no super-admin), tokens vía entorno, bind de GLPI a `127.0.0.1` (precedente `hardening-n8n`/`despliegue-web`).

## Capabilities

### New Capabilities

- `despliegue-glpi`: despliegue de GLPI y su base de datos MySQL dedicada en docker-compose (servicios, red, bind de puertos, variables de entorno, endurecimiento de cuentas/API y habilitación de la API REST para integración con n8n).

### Modified Capabilities

- `automatizacion-web`: el requisito "crear un ticket GLPI vía n8n" cambia de comportamiento local-simulado (solo INSERT en `responses`) a **crear el ticket real en GLPI vía API REST + auditoría local en `responses`**, preservando el trigger manual de la UI y el contrato del payload `{event_id, name, content, urgency}`.

## Impact

- **docker-compose.yml**: se agregan los servicios `glpi` y `glpi-db`, más volúmenes nombrados (`glpi_data`, `glpi_db_data`) y defaults de entorno `GLPI_*`. Red: `red_interna` (precedente n8n/api/web), puerto GLPI bind a `127.0.0.1`.
- **workflows/webhook-glpi-ticket.json**: reestructuración del workflow (3 nodos HTTP: initSession → create Ticket → killSession) + nodo PostgreSQL de auditoría existente, con `retryOnFail`/`onError` (precedente `hardening-n8n`).
- **api/app/services/n8n_client.py**, **api/app/routers/automation.py**, **api/app/schemas/automation.py**: el contrato del endpoint `create-ticket` no cambia (`event_id/name/content/urgency`, validación 422 de `name`/`content`); NO se toca el flujo API → webhook. Solo si aplica: ajuste nulo/menor. El frontend (`web/src/features/automation/ActionModals.tsx`, `mutations.ts`) NO cambia.
- **.env / .env.example**: se agregan variables `GLPI_*`.
- **Tests**: `api/tests/test_automation.py`, `api/tests/test_n8n_client.py` (y verificación E2E) se actualizan/extienden para cubrir el nuevo contrato real (ticket GLPI + auditoría).
- **GLPI**: instancia desplegada en el stack; configuración manual única (habilitar API REST, crear cliente de API y usuario API) documentada como paso post-deploy en tesis/README.
- **nginx**: sin cambios requeridos (GLPI se consume por red interna desde n8n, no se publica por nginx).
