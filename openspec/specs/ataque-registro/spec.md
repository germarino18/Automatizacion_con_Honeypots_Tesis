# ataque-registro Specification

## Purpose
TBD - created by archiving change workflows-n8n. Update Purpose after archive.
## Requirements
### Requirement: El sistema DEBE recibir eventos de Cowrie vía webhook
El playbook **PB-H1** (workflow "PB-H1 - Reconocimiento y Escaneo") SHALL exponer un endpoint POST en `/webhook/cowrie` que acepte datos JSON de eventos SSH/Telnet.

#### Scenario: Cowrie envía evento de login
- **WHEN** el sidecar unificado envía un POST a `http://n8n:5678/webhook/cowrie` con un payload JSON de un evento de Cowrie que contiene `session`, `src_ip`, `username`, `password` y `timestamp`
- **THEN** el workflow PB-H1 recibe el evento y lo procesa sin errores

#### Scenario: Cowrie envía evento de comando ejecutado
- **WHEN** el sidecar unificado envía un POST al webhook con un payload JSON que contiene `command` ejecutado por el atacante
- **THEN** el workflow PB-H1 recibe el evento, extrae los campos relevantes y ejecuta el sub-workflow **PB-H2** vía nodo *Execute Workflow*
- **AND** PB-H2 procesa el comando (extracción de IOCs, enriquecimiento, scoring) y persiste

### Requirement: El sistema DEBE recibir eventos de Dionaea vía webhook
El workflow "Dionaea Webhook" SHALL exponer un endpoint POST en `/webhook/dionaea` que acepte datos JSON de eventos de servicios (SMB, FTP, HTTP, etc.).

#### Scenario: Dionaea envía evento de conexión
- **WHEN** el sidecar unificado envía un POST a `http://n8n:5678/webhook/dionaea` con un payload JSON de un evento de Dionaea que contiene `remote_host`, `remote_port`, `local_port`, `protocol` y `timestamp`
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

#### Scenario: Persistencia del evento con `raw_data` de Cowrie
- **WHEN** el workflow PB-H1 recibe un evento Cowrie (emitido por el sidecar) y ejecuta el INSERT parametrizado
- **THEN** `raw_data` contiene el payload íntegro (incluyendo el tag `source_honeypot='cowrie'` añadido por el sidecar) sin perder campos
- **AND** `src_ip` se valida como INET (si no es IP válida → `'0.0.0.0'`)

#### Scenario: La password NO se persiste en crudo
- **WHEN** un evento `login.success` de Cowrie llega con el campo `password`
- **THEN** el workflow filtra/descarta el campo `password` antes del INSERT (el sidecar puede eliminarlo opcionalmente)
- **AND** la password NO aparece en ninguna columna ni en `raw_data` persistido

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

### Requirement: El jsonlog de Cowrie SHALL exponerse vía el bind-mount `cowrie/logs`
El overlay de configuración `cowrie/config/cowrie.cfg` SHALL activar `[output_jsonlog]` con `logfile = log/cowrie.json` (relativo al `cwd` de la imagen `/cowrie/cowrie-git`), de modo que el jsonlog se escriba en el bind-mount `cowrie/logs` y sea legible por el sidecar — no en un volumen anónimo.

#### Scenario: El jsonlog se escribe en el bind-mount
- **WHEN** `cowrie/config/cowrie.cfg` contiene `[output_jsonlog]` con `logfile = log/cowrie.json` y Cowrie arranca
- **THEN** el módulo `output_jsonlog` queda habilitado y cada evento se escribe como línea JSON en `cowrie/logs/cowrie.json`
- **AND** el archivo es legible desde el host/bind-mount (con independencia del contenedor distroless sin shell)

#### Scenario: El bind-mount de config es el slot oficial de overlay
- **WHEN** la imagen Cowrie (3.0.12) inicia y evalúa `get_config_path()`
- **THEN** detecta el overlay `cowrie/config/cowrie.cfg` montado en `/cowrie/cowrie-git/etc` antes que `cowrie.cfg`
- **AND** la sección `[output_jsonlog]` definida en el overlay prevalece sobre el default

#### Scenario: Env vars NO reemplazan el archivo para secciones nuevas
- **WHEN** se intentara configurar `output_jsonlog` solo con env vars (`COWRIE_<SECTION>_<OPTION>`)
- **THEN** NO se crea la sección nueva porque los env vars no pueden crear secciones
- **AND** por eso la configuración del jsonlog se hace por archivo `cowrie.cfg`, no por env

### Requirement: El sidecar SHALL leer el jsonlog de Cowrie y emitir `login.success`/`command` a n8n
Los eventos `login.success`, `command.input` (y demás canónicos de Cowrie) SHALL ser leídos por el sidecar desde `cowrie/logs/cowrie.json` y posteados lo antes posible a `http://n8n:5678/webhook/cowrie`, preservando el dict de campos canónicos del evento.

#### Scenario: Evento posteado con campos canónicos
- **WHEN** Cowrie escribe en `cowrie/logs/cowrie.json` una línea JSON de `login.success` con `session`, `src_ip`, `username`, `password`, `timestamp`
- **THEN** el sidecar la parsea y POSTea a `http://n8n:5678/webhook/cowrie`
- **AND** el payload conserva los campos canónicos comunes (`session`, `protocol`, `src_ip`, `src_port`, `dst_ip`, `dst_port`, `eventid`, `sensor`, `uuid`, `timestamp`, `message`) y por eventid (`username`/`password` para login, `input` para command)

#### Scenario: El payload del sidecar añade el tag `source_honeypot`
- **WHEN** el sidecar normaliza un evento de Cowrie
- **THEN** el body POSTeado es `{ "source_honeypot": "cowrie", "event": { ... } }`
- **AND** `source_honeypot` coincide con la constante esperada por la Decisión 4 del mapping

#### Scenario: n8n caído → retry sin pérdida de eventos
- **WHEN** n8n no responde y el POST falla para un evento ya leído del jsonlog
- **THEN** el sidecar reintenta con backoff (cola en memoria) hasta éxito
- **AND** ningún evento leído se descarta por el fallo temporal de n8n

### Requirement: El sidecar SHALL tolerar rotación/recreación del jsonlog
El tailer del sidecar SHALL detectar la recreación o re-escritura del archivo `cowrie.json` (truncado o reemplazado) y re-tail desde el inicio del archivo nuevo, sin duplicar ni perder líneas.

#### Scenario: El archivo se recrea en el mismo path
- **WHEN** `cowrie/logs/cowrie.json` se truncado/recrea (inode cambia o el archivo se vacía) mientras el sidecar está leyendo
- **THEN** el sidecar detecta el cambio (por tamaño/inode) y re-tail desde el inicio del archivo nuevo
- **AND** se procesan las líneas nuevas sin duplicar las ya enviadas y sin perder ninguna

#### Scenario: Rotación con renombrado del archivo
- **WHEN** el sistema de logs renombra `cowrie.json` (ej. `cowrie.json.1`) y crea un `cowrie.json` nuevo
- **THEN** el sidecar detecta el nuevo archivo y continúa tail desde su inicio
- **AND** la última línea del archivo renombrado no se duplica

### Requirement: El sidecar SHALL soportar la fuente dionaea (dormante en esta fase)
El lado del sidecar encargado de la fuente dionaea SHALL estar diseñado para leer `dionaea.json` y postear a `http://n8n:5678/webhook/dionaea`, pero en ESTE change la fuente está **dormante**: Dionaea sigue inerte por configuración y el sidecar arranca y funciona solo con Cowrie si `dionaea.json` no existe.

#### Scenario: `dionaea.json` presente → se postea a `/webhook/dionaea`
- **WHEN** existe `dionaea.json` con eventos (formato ihandler `log_json`, p.ej. campos en `connection.*`)
- **THEN** el sidecar los lee y los POSTea a `http://n8n:5678/webhook/dionaea`
- **AND** el payload añade `source_honeypot='dionaea'` (mapping de la Decisión 4)

#### Scenario: `dionaea.json` ausente → el sidecar igual funciona
- **WHEN** `dionaea.json` no existe (Dionaea inerte: `services-enabled/` e `ihandlers-enabled/` vacíos)
- **THEN** la fuente dionaea queda dormante y el sidecar no la intenta leer/emite
- **AND** el sidecar procesa Cowrie sin errores, sin bloqueo ni reintento infinito del archivo ausente

