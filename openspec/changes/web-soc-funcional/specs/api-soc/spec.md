## ADDED Requirements

### Requirement: La API SHALL autenticar por sesión JWT
El servicio `soc-api` SHALL exponer `POST /api/v1/auth/login` que valide las credenciales `SOC_ADMIN_USER`/`SOC_ADMIN_PASSWORD` (del entorno) y emita un token JWT firmado con `SOC_JWT_SECRET` con expiración limitada (default 8h). El token SHALL enviarse por cookie `HttpOnly`/`SameSite` o header `Authorization: Bearer`, y las rutas de datos SHALL rechazar peticiones sin token válido con HTTP 401.

#### Scenario: Login con credenciales válidas
- **WHEN** un usuario envía `POST /api/v1/auth/login` con `SOC_ADMIN_USER` y `SOC_ADMIN_PASSWORD` correctos
- **THEN** la API responde HTTP 200 con un token JWT (cookie `HttpOnly`) y un payload con el usuario y expiración
- **AND** el token permite acceder a las rutas de datos protegidas

#### Scenario: Login con credenciales inválidas
- **WHEN** un usuario envía credenciales incorrectas o incompletas
- **THEN** la API responde HTTP 401 sin emitir token
- **AND** no se expone en la respuesta si el usuario o la contraseña fue lo fallido

#### Scenario: Acceso sin token
- **WHEN** una petición a un endpoint de datos no incluye token válido (ausente, expirado o mal formado)
- **THEN** la API responde HTTP 401 y no devuelve datos

#### Scenario: Logout
- **WHEN** el usuario envía `POST /api/v1/auth/logout` con sesión activa
- **THEN** la API invalida la sesión/cookie y responde HTTP 200

### Requirement: La API SHALL exponer métricas de overview del SOC
La API SHALL exponer `GET /api/v1/overview` (protegido) que devuelva métricas agregadas de `honeypot_events` para el rango de tiempo consultado: total de eventos, eventos por `source_honeypot`, top `src_ip`, alertas críticas recientes (por `risk_score`/severidad), total de malware (`malware_hash` no nulo) y MTTD/MTTR estimados (diff `created_at` vs `timestamp`).

#### Scenario: Overview con datos
- **WHEN** existe una sesión válida y hay eventos en `honeypot_events` en el rango
- **THEN** la API devuelve los agregados de `metrics_summary` y `top_attackers` (o consultas equivalentes) con conteos correctos
- **AND** el payload incluye `total_eventos`, `eventos_por_honeypot`, `top_ips` y `alertas_criticas`

#### Scenario: Overview sin datos en el rango
- **WHEN** no hay eventos en el rango consultado
- **THEN** la API responde HTTP 200 con ceros/arreglos vacíos sin errores

#### Scenario: Filtrar por rango de fechas
- **WHEN** el cliente envía `from`/`to` (ISO 8601) como query params
- **THEN** los agregados se acotan a eventos con `timestamp` dentro del rango

### Requirement: La API SHALL exponer el explorador de eventos con filtros y paginación
La API SHALL exponer `GET /api/v1/events` (protegido) que devuelva eventos de `honeypot_events` con paginación (`page`, `page_size`) y filtros combinables: `from`/`to`, `source_honeypot`, `protocol`, `src_ip`, `severity` (derivada de `risk_score`), `technique`, `username` y texto libre (sobre `commands`/`raw_data`).

#### Scenario: Listar eventos paginados
- **WHEN** el cliente consulta `GET /api/v1/events?page=1&page_size=25`
- **THEN** la API devuelve la página solicitada con `items`, `total`, `page` y `page_size`
- **AND** los eventos se ordenan por `timestamp` descendente por defecto

#### Scenario: Filtrar por honeypot y protocolo
- **WHEN** el cliente envía `source_honeypot=cowrie` y `protocol=ssh`
- **THEN** la API devuelve solo eventos que cumplen ambos filtros

#### Scenario: Filtrar por severidad
- **WHEN** el cliente envía `severity=critical`
- **THEN** la API devuelve solo eventos con `risk_score` en el bucket definido para crítico (>= 0.8 o configuración del design)

#### Scenario: Búsqueda de texto libre
- **WHEN** el cliente envía `search=wget`
- **THEN** la API devuelve eventos cuyo `commands` o `raw_data` contiene el término

#### Scenario: Paginación fuera de rango
- **WHEN** `page` supera la última página disponible
- **THEN** la API responde HTTP 200 con `items` vacío y `total` real

### Requirement: La API SHALL exponer el detalle de un evento individual
La API SHALL exponer `GET /api/v1/events/{id}` (protegido) que devuelva el evento completo con sus columnas tipadas, incluyendo `raw_data` y `enrichment_data` (JSONB), y las `responses` asociadas por `event_id`.

#### Scenario: Evento existente
- **WHEN** el cliente consulta un `id` que existe en `honeypot_events`
- **THEN** la API devuelve HTTP 200 con el evento y su `raw_data` íntegro
- **AND** las respuestas de la tabla `responses` con ese `event_id` se incluyen como arreglo anidado

#### Scenario: Evento inexistente
- **WHEN** el cliente consulta un `id` que no existe
- **THEN** la API responde HTTP 404

### Requirement: La API SHALL exponer las técnicas MITRE ATT&CK agregadas
La API SHALL exponer `GET /api/v1/mitre` (protegido) que agrupe eventos por `att_ck_technique` y devuelva el conteo, con mapeo estático a táctica/nombre desde un catálogo MITRE embebido.

#### Scenario: Técnicas con datos
- **WHEN** hay eventos con `att_ck_technique` poblado (ej. `T1059`, `T1190`)
- **THEN** la API devuelve cada técnica con su conteo y metadata (táctica, nombre) del catálogo embebido

#### Scenario: Sin técnicas registradas
- **WHEN** no hay eventos con `att_ck_technique` en el rango
- **THEN** la API responde HTTP 200 con una lista vacía sin errores

### Requirement: La API SHALL exponer la geolocalización de orígenes (best-effort)
La API SHALL exponer `GET /api/v1/geo/countries` (protegido) que agrupe eventos por país usando los datos geográficos presentes en `enrichment_data` (JSONB), con fallback a una tabla de rangos de IP cuando no exista geo; el resultado SHALL degradar con gracia si la data geo es escasa.

#### Scenario: Eventos con geolocalización
- **WHEN** `enrichment_data` contiene país/coordenadas para eventos en el rango
- **THEN** la API devuelve la cantidad de eventos por país ordenada descendente

#### Scenario: Sin data geolocalizada
- **WHEN** no hay datos geo en `enrichment_data` en el rango
- **THEN** la API responde HTTP 200 con lista vacía o fallback sin errores

### Requirement: La API SHALL exponer malware e IoCs
La API SHALL exponer `GET /api/v1/malware` y `GET /api/v1/iocs` (protegidos): el primero agrupa `malware_hash`/`malware_filename` de `honeypot_events`; el segundo lista la tabla `iocs` con filtros por `ioc_type`, `severity` y búsqueda de `ioc_value`.

#### Scenario: Listar hashes de malware
- **WHEN** hay eventos con `malware_hash` no nulo
- **THEN** la API devuelve los hashes únicos con frecuencia, archivo, `src_ip` y `timestamp`

#### Scenario: Buscar IoCs por tipo
- **WHEN** el cliente consulta `GET /api/v1/iocs?ioc_type=ip`
- **THEN** la API devuelve solo IoCs de ese tipo de la tabla `iocs`

#### Scenario: Sin muestras de malware
- **WHEN** no hay eventos con `malware_hash` en el rango
- **THEN** la API responde HTTP 200 con lista vacía sin errores

### Requirement: La API SHALL exponer el estado de salud de los servicios
La API SHALL exponer `GET /api/v1/health` (público) que reporte el estado de la propia API y de PostgreSQL (query de prueba), y `GET /api/v1/health/services` (protegido) que reporte además n8n (`/healthz`), como consumible por el sidebar del frontend.

#### Scenario: Todos los servicios sanos
- **WHEN** PostgreSQL responde y n8n responde `healthz` 200
- **THEN** la API devuelve HTTP 200 con `status: ok` por servicio

#### Scenario: Un servicio degradado
- **WHEN** PostgreSQL o n8n no responden
- **THEN** la API devuelve HTTP 200 con `status: degraded` y el detalle por servicio (no falla la petición completa)

### Requirement: La API SHALL emitir eventos en vivo vía SSE
La API SHALL exponer `GET /api/v1/events/live` (protegido) como **Server-Sent Events** que empuje eventos nuevos de `honeypot_events` (id mayor al último enviado) en tiempo real, con heartbeat periódico y desconexión limpia al cerrar la sesión del cliente.

#### Scenario: Nuevo evento publicado en el feed
- **WHEN** un evento nuevo se inserta en `honeypot_events` mientras un cliente está suscrito
- **THEN** el cliente recibe un `event: event` con el payload del evento en un plazo <= 5 segundos

#### Scenario: Heartbeat y reconexión
- **WHEN** no hay eventos nuevos durante un intervalo
- **THEN** la API envía un comentario/evento `ping` periódico para mantener la conexión viva
- **AND** si el cliente se desconecta, la API cierra el stream sin errores al cancelar la petición

#### Scenario: Suscripción sin sesión
- **WHEN** una petición a `/api/v1/events/live` no incluye token válido
- **THEN** la API responde HTTP 401 y no abre el stream