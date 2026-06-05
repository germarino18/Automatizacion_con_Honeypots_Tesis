## ADDED Requirements

### Requirement: El sistema DEBE recibir eventos de Cowrie vía webhook
El workflow "Cowrie Webhook" SHALL exponer un endpoint POST en `/webhook/cowrie` que acepte datos JSON de eventos SSH/Telnet.

#### Scenario: Cowrie envía evento de login
- **WHEN** Cowrie envía un POST a `http://n8n:5678/webhook/cowrie` con un payload JSON que contiene `session`, `src_ip`, `username`, `password` y `timestamp`
- **THEN** el workflow recibe el evento y lo procesa sin errores

#### Scenario: Cowrie envía evento de comando ejecutado
- **WHEN** Cowrie envía un POST al webhook con un payload JSON que contiene `command` ejecutado por el atacante
- **THEN** el workflow recibe el evento y extrae los campos relevantes

### Requirement: El sistema DEBE recibir eventos de Dionaea vía webhook
El workflow "Dionaea Webhook" SHALL exponer un endpoint POST en `/webhook/dionaea` que acepte datos JSON de eventos de servicios (SMB, FTP, HTTP, etc.).

#### Scenario: Dionaea envía evento de conexión
- **WHEN** Dionaea envía un POST a `http://n8n:5678/webhook/dionaea` con un payload JSON que contiene `remote_host`, `remote_port`, `local_port`, `protocol` y `timestamp`
- **THEN** el workflow recibe el evento y lo procesa sin errores

### Requirement: Los eventos SHALL persistirse en PostgreSQL
Cada workflow SHALL insertar un registro en la tabla `attack_events` de PostgreSQL con los siguientes campos comunes:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | SERIAL PRIMARY KEY | Identificador único |
| `source` | VARCHAR(50) | Honeypot de origen: `cowrie` o `dionaea` |
| `event_type` | VARCHAR(100) | Tipo de evento (login, command, connection, etc.) |
| `src_ip` | VARCHAR(45) | IP del atacante (soporta IPv6) |
| `src_port` | INTEGER | Puerto de origen |
| `dst_port` | INTEGER | Puerto destino del honeypot |
| `protocol` | VARCHAR(50) | Protocolo usado (SSH, SMB, FTP, etc.) |
| `timestamp` | TIMESTAMPTZ | Momento del evento |
| `raw_data` | JSONB | Payload completo original del webhook |
| `created_at` | TIMESTAMPTZ DEFAULT NOW() | Momento de inserción |

#### Scenario: Insertar evento de Cowrie en PostgreSQL
- **WHEN** el workflow Cowrie recibe un evento válido
- **THEN** se inserta un registro en `attack_events` con `source='cowrie'` y los datos correspondientes
- **AND** el campo `raw_data` contiene el payload JSON completo

#### Scenario: Insertar evento de Dionaea en PostgreSQL
- **WHEN** el workflow Dionaea recibe un evento válido
- **THEN** se inserta un registro en `attack_events` con `source='dionaea'` y los datos correspondientes
- **AND** el campo `raw_data` contiene el payload JSON completo

### Requirement: La tabla SHALL crearse automáticamente
El workflow SHALL crear la tabla `attack_events` si no existe al recibir el primer evento (no requiere migración manual).

#### Scenario: Primera ejecución sin tabla existente
- **WHEN** el workflow recibe su primer evento
- **AND** la tabla `attack_events` no existe en la base de datos
- **THEN** el workflow ejecuta `CREATE TABLE IF NOT EXISTS` para crearla
- **AND** luego inserta el registro exitosamente

### Requirement: Los workflows SHALL ser exportables como JSON
Los workflows SHALL guardarse como archivos JSON en la ruta `n8n/workflows/` del proyecto para su versionado en git.

#### Scenario: Exportar workflow Cowrie
- **WHEN** se exporta el workflow Cowrie desde n8n
- **THEN** se guarda como `n8n/workflows/cowrie-webhook.json`

#### Scenario: Exportar workflow Dionaea
- **WHEN** se exporta el workflow Dionaea desde n8n
- **THEN** se guarda como `n8n/workflows/dionaea-webhook.json`
