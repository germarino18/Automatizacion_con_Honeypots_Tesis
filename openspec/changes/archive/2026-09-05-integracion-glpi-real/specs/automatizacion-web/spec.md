## MODIFIED Requirements

### Requirement: El sistema SHALL crear un ticket GLPI vía n8n
La API SHALL exponer `POST /api/v1/automation/create-ticket` (protegido) que reciba `{ "event_id": <id|null>, "name": "...", "content": "...", "urgency": "..." }` y POSTee a `{N8N_INTERNAL_URL}/webhook/glpi-ticket`, reutilizando el workflow EXISTENTE `workflows/webhook-glpi-ticket.json`. El workflow SHALL crear un **ticket real en GLPI vía su API REST** (`initSession` → `POST /Ticket` → `killSession`, con App-Token y user-token desde el entorno) y además insertar un registro en la tabla `responses` con `action_type='alerta'` y `actor='n8n-automated'` como auditoría local. El `details` del registro de `responses` SHALL incluir el identificador real del ticket GLPI (`glpi_ticket_id`) además de `name`, `content`, `urgency` y `created_at`. Cuando la creación del ticket GLPI falla, el workflow SHALL registrar el intento fallido en `responses` con `status='error'` (y motivo en `details.error`) para conservar la evidencia del fallo, sin reportar éxito falso.

#### Scenario: Ticket GLPI real creado y auditado
- **WHEN** el operador envía `POST /api/v1/automation/create-ticket` con `name` y `content` no vacíos y n8n procesa el workflow `glpi-ticket`
- **THEN** GLPI crea un ticket real vía su API REST (initSession → POST /Ticket → killSession)
- **AND** la API devuelve HTTP 200 con el detalle de la respuesta incluyendo el `glpi_ticket_id`
- **AND** existe un registro en `responses` con `action_type='alerta'`, `actor='n8n-automated'`, `status='completed'` y `details.glpi_ticket_id` igual al ticket creado en GLPI

#### Scenario: Los tickets se crean con notificaciones de correo habilitadas
- **WHEN** el workflow crea un ticket en GLPI vía `POST /Ticket`
- **THEN** el body del ticket no deshabilita las notificaciones (`_disablenotif` no es `true`)
- **AND** si hay SMTP configurado en GLPI, se envía la notificación de correo del ticket

#### Scenario: Campos obligatorios faltantes
- **WHEN** el payload no incluye `name` o `content` (o vienen vacíos)
- **THEN** la API responde HTTP 422 sin enviar el ticket a n8n

#### Scenario: n8n no disponible al crear ticket
- **WHEN** n8n no responde al webhook de ticket
- **THEN** la API responde HTTP 502/503 y NO registra un falso éxito en `responses`

#### Scenario: GLPI no disponible al crear el ticket
- **WHEN** el workflow n8n intenta crear el ticket pero GLPI (o su API REST) no está disponible o rechaza la creación
- **THEN** GLPI no crea el ticket y el workflow registra el intento fallido en `responses` con `status='error'` (y `details.error` con el motivo)
- **AND** la API no reporta éxito falso (HTTP 502/503 según el caso)

#### Scenario: La auditoría local falla al crear el ticket
- **WHEN** el ticket real en GLPI se crea correctamente pero el INSERT de auditoría en `responses` falla (p. ej., fallo puntual de PostgreSQL)
- **THEN** el workflow continúa tolerando el fallo del nodo de auditoría (onError continueRegularOutput) sin registrar un falso éxito
- **AND** el ticket real en GLPI permanece creado y el fallo queda visible en el historial de ejecuciones de n8n

#### Scenario: La traducción de urgencia se aplica en el workflow
- **WHEN** la API envía el payload con `urgency` como string (`low`, `medium` o `high`) al webhook `glpi-ticket`
- **THEN** el workflow traduce la urgencia a un entero GLPI (1–5) antes de POST /Ticket
- **AND** el valor traducido se refleja en el ticket creado en GLPI
