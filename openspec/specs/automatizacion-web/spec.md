## Purpose
La capacidad de automatización SHALL orquestar acciones reales sobre n8n — ejecutar el playbook de simulación por la cadena real, registrar bloqueos de IP y crear tickets GLPI reales vía API REST — exponiendo workflows, ejecuciones y el historial de respuestas a la consola web con auditoría en la tabla `responses`.

## Requirements

### Requirement: La API SHALL listar los workflows de n8n
El servicio `soc-api` SHALL exponer `GET /api/v1/automation/workflows` (protegido) que liste los workflows de n8n vía la API pública de n8n (`/api/v1/workflows`) autenticando con el header `X-N8N-API-KEY` (desde `N8N_API_KEY` del entorno; n8n 2.x eliminó Basic Auth de su API pública), devolviendo `id`, `name` y `active`.

#### Scenario: Listar workflows con n8n disponible
- **WHEN** n8n responde a la API pública con una API key válida
- **THEN** la API devuelve HTTP 200 con la lista de workflows y su estado `active`
- **AND** los workflows desactivados se marcan como tales en el payload

#### Scenario: n8n no disponible
- **WHEN** n8n no responde o rechaza las credenciales
- **THEN** la API responde HTTP 502/503 con un mensaje claro y sin datos falsos

### Requirement: La API SHALL listar las ejecuciones recientes de n8n
La API SHALL exponer `GET /api/v1/automation/executions` (protegido) que consulte `/api/v1/executions` de n8n y devuelva las ejecuciones recientes con `id`, `workflowId`, `status` (success/error/waiting) y `startedAt`, ordenadas por fecha descendente.

#### Scenario: Ejecuciones disponibles
- **WHEN** n8n tiene ejecuciones registradas y responde la API pública
- **THEN** la API devuelve HTTP 200 con las ejecuciones recientes y su estado

#### Scenario: Sin ejecuciones o n8n caído
- **WHEN** no hay ejecuciones o n8n no responde
- **THEN** la API devuelve lista vacía con `degraded: true` y mensaje, sin fallar la petición completa

### Requirement: El sistema SHALL ejecutar un playbook (simulación de ataque) por la cadena real
La API SHALL exponer `POST /api/v1/automation/simulate` (protegido) que reciba `{ "honeypot": "cowrie" | "dionaea", "payload": {...} }` y POSTee el payload al webhook correspondiente de n8n (`/webhook/cowrie` o `/webhook/dionaea`), recorriendo la cadena real hasta PostgreSQL.

#### Scenario: Simular ataque Cowrie
- **WHEN** el operador envía `POST /api/v1/automation/simulate` con `honeypot: "cowrie"` y un payload con `src_ip`, `username`, `eventid`
- **THEN** la API POSTea a `http://n8n:5678/webhook/cowrie` y devuelve HTTP 200 con el resultado del webhook
- **AND** el evento termina persistido en `honeypot_events` con `source_honeypot='cowrie'` (verificación posterior)

#### Scenario: Simular ataque Dionaea
- **WHEN** el operador envía `POST /api/v1/automation/simulate` con `honeypot: "dionaea"` y un payload de conexión
- **THEN** la API POSTea a `http://n8n:5678/webhook/dionaea` y devuelve HTTP 200 con el resultado

#### Scenario: Honeypot no soportado
- **WHEN** el campo `honeypot` no es `cowrie` ni `dionaea`
- **THEN** la API responde HTTP 422 sin enviar nada a n8n

#### Scenario: n8n no disponible al simular
- **WHEN** n8n no responde al POST del webhook
- **THEN** la API responde HTTP 502/503 y NO reporta éxito

### Requirement: El sistema SHALL registrar un bloqueo de IP vía n8n
La API SHALL exponer `POST /api/v1/automation/block-ip` (protegido) que reciba `{ "src_ip": "...", "event_id": <id|null>, "reason": "..." }` y POSTee a `{N8N_INTERNAL_URL}/webhook/firewall-block`, reutilizando el workflow EXISTENTE `workflows/webhook-firewall-block.json`, que inserta un registro en la tabla `responses` con `action_type='bloqueo'`, `actor='n8n-automated'` y `status` según el resultado. Mapeo de payload: la API traduce su entrada a `{ event_id, ip: src_ip, duration, reason }` (duration opcional/null).

#### Scenario: Bloqueo de IP exitoso
- **WHEN** el operador envía `POST /api/v1/automation/block-ip` con `src_ip` válido y n8n procesa el workflow `firewall-block`
- **THEN** la API devuelve HTTP 200 con el detalle de la respuesta
- **AND** existe un registro en `responses` con `action_type='bloqueo'`, `actor='n8n-automated'` y `status='completed'` (o el correspondiente)

#### Scenario: IP inválida
- **WHEN** el campo `src_ip` no es una IP válida
- **THEN** la API responde HTTP 422 sin enviar el bloqueo a n8n

#### Scenario: n8n no disponible al bloquear
- **WHEN** n8n no responde al webhook de bloqueo
- **THEN** la API responde HTTP 502/503 y NO registra un falso éxito en `responses`

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

### Requirement: La API SHALL exponer el historial de respuestas automáticas
La API SHALL exponer `GET /api/v1/automation/responses` (protegido) que devuelva registros de la tabla `responses` con filtros por `action_type`, `status`, `event_id` y rango de fechas, ordenados por `timestamp` descendente.

#### Scenario: Listar respuestas con filtros
- **WHEN** el cliente consulta con filtros de `action_type` y/o `status`
- **THEN** la API devuelve los registros de `responses` que cumplen los filtros

#### Scenario: Sin respuestas registradas
- **WHEN** no hay registros en `responses` en el rango
- **THEN** la API responde HTTP 200 con lista vacía sin errores