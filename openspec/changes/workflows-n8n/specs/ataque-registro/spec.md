## ADDED Requirements

### Requirement: El sistema DEBE recibir eventos de Cowrie vía webhook
El playbook **PB-H1** (workflow "PB-H1 - Reconocimiento y Escaneo") SHALL exponer un endpoint POST en `/webhook/cowrie` que acepte datos JSON de eventos SSH/Telnet.

#### Scenario: Cowrie envía evento de login
- **WHEN** Cowrie envía un POST a `http://n8n:5678/webhook/cowrie` con un payload JSON que contiene `session`, `src_ip`, `username`, `password` y `timestamp`
- **THEN** el workflow PB-H1 recibe el evento y lo procesa sin errores

#### Scenario: Cowrie envía evento de comando ejecutado
- **WHEN** Cowrie envía un POST al webhook con un payload JSON que contiene `command` ejecutado por el atacante
- **THEN** el workflow PB-H1 recibe el evento, extrae los campos relevantes y ejecuta el sub-workflow **PB-H2** vía nodo *Execute Workflow*
- **AND** PB-H2 procesa el comando (extracción de IOCs, enriquecimiento, scoring) y persiste

### Requirement: El sistema DEBE recibir eventos de Dionaea vía webhook
El workflow "Dionaea Webhook" SHALL exponer un endpoint POST en `/webhook/dionaea` que acepte datos JSON de eventos de servicios (SMB, FTP, HTTP, etc.).

#### Scenario: Dionaea envía evento de conexión
- **WHEN** Dionaea envía un POST a `http://n8n:5678/webhook/dionaea` con un payload JSON que contiene `remote_host`, `remote_port`, `local_port`, `protocol` y `timestamp`
- **THEN** el workflow recibe el evento y lo procesa sin errores

### Requirement: Los eventos SHALL persistirse en PostgreSQL
Cada workflow (PB-H1, PB-H2, Dionaea Webhook) SHALL insertar un registro en la tabla `honeypot_events` de PostgreSQL con los siguientes campos:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | SERIAL PRIMARY KEY | Identificador único |
| `timestamp` | TIMESTAMPTZ | Momento del evento (default: CURRENT_TIMESTAMP) |
| `source_honeypot` | VARCHAR(50) NOT NULL | Honeypot de origen: `cowrie` o `dionaea` |
| `src_ip` | INET NOT NULL | IP del atacante (IPv4/IPv6; rechaza valores no-IP) |
| `dst_port` | INTEGER | Puerto destino del honeypot |
| `protocol` | VARCHAR(20) | Protocolo usado (SSH, Telnet, SMB, FTP, HTTP) |
| `username` | VARCHAR(100) | Usuario usado (Cowrie, si aplica) |
| `commands` | TEXT | Comandos ejecutados (Cowrie, si aplica) |
| `malware_hash` | VARCHAR(64) | Hash SHA256 de malware (Dionaea, si aplica) |
| `malware_filename` | VARCHAR(255) | Nombre del archivo capturado (Dionaea, si aplica) |
| `playbook_id` | VARCHAR(50) | ID del playbook ejecutado (uso futuro) |
| `risk_score` | DECIMAL(3,2) DEFAULT 0.00 | Score de riesgo (0.00 - 1.00) |
| `att_ck_technique` | VARCHAR(20) | Técnica MITRE ATT&CK (uso futuro) |
| `enrichment_data` | JSONB | Datos enriquecidos (uso futuro) |
| `raw_data` | JSONB | Payload completo original del webhook |
| `created_at` | TIMESTAMPTZ DEFAULT NOW() | Momento de inserción |

#### Scenario: Insertar evento de Cowrie en PostgreSQL
- **WHEN** el workflow PB-H1 recibe un evento válido
- **THEN** se inserta un registro en `honeypot_events` con `source_honeypot='cowrie'` y los datos correspondientes
- **AND** el campo `raw_data` contiene el payload JSON completo
- **AND** cuando el evento contiene un comando, el sub-workflow PB-H2 inserta su propio registro con `playbook_id='PB-H2-v1.0'` y `att_ck_technique='T1059'`

#### Scenario: Insertar evento de Dionaea en PostgreSQL
- **WHEN** el workflow Dionaea recibe un evento válido
- **THEN** se inserta un registro en `honeypot_events` con `source_honeypot='dionaea'` y los datos correspondientes
- **AND** el campo `raw_data` contiene el payload JSON completo

### Requirement: El esquema SHALL proveerse al arrancar por init.sql
La tabla `honeypot_events` (con sus índices y la vista `metrics_summary`) SHALL crearse por `postgres/init.sql` cuando PostgreSQL arranca por primera vez. Los workflows SHALL asumir que el esquema existe y solo insertar — NO ejecutan DDL.

#### Scenario: Primer arranque de PostgreSQL
- **WHEN** el contenedor PostgreSQL se inicia por primera vez (volumen vacío)
- **THEN** `init.sql` crea la tabla `honeypot_events` con los índices y la vista `metrics_summary`
- **AND** los workflows insertan eventos sin errores

#### Scenario: Tabla ausente (contenedor recreado)
- **WHEN** se elimina el volumen de PostgreSQL y se recrea el contenedor
- **THEN** `init.sql` se vuelve a ejecutar (montado en `/docker-entrypoint-initdb.d`) y recrea el esquema
- **AND** los workflows insertan eventos sin errores

### Requirement: Los workflows SHALL ser exportables como JSON
Los workflows SHALL guardarse como archivos JSON en la ruta `n8n/workflows/` del proyecto para su versionado en git.

#### Scenario: Exportar workflow PB-H1 (receptor Cowrie)
- **WHEN** se exporta el workflow PB-H1 desde n8n (con su SQL corregido)
- **THEN** se guarda como `n8n/workflows/pb-h1-reconocimiento-v1.0.json`

#### Scenario: Exportar workflow PB-H2 (sub-workflow comandos)
- **WHEN** se exporta el workflow PB-H2 desde n8n (con su SQL corregido)
- **THEN** se guarda como `n8n/workflows/pb-h2-ejecucion-comandos-v1.0.json`

#### Scenario: Exportar workflow Dionaea
- **WHEN** se exporta el workflow Dionaea desde n8n
- **THEN** se guarda como `n8n/workflows/dionaea-webhook.json`
