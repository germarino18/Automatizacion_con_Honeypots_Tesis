## ADDED Requirements

### Requirement: El datasource PostgreSQL SHALL provisionarse por archivo
Grafana SHALL provisionar un datasource de tipo PostgreSQL apuntando a `postgres:5432` (nombre de servicio en `red_interna`) mediante un archivo de provisioning versionable en `grafana/provisioning/datasources/postgres.yml`, sin configuración manual desde la UI.

#### Scenario: Grafana arranca con provisioning
- **WHEN** el contenedor Grafana arranca y el archivo `grafana/provisioning/datasources/postgres.yml` existe
- **THEN** el datasource "PostgreSQL - Honeypots" queda registrado en Grafana apuntando a `postgres:5432`
- **AND** el datasource responde con status OK al endpoint de health de la API de Grafana

### Requirement: Las credenciales del datasource SHALL referenciarse por variable de entorno
Los archivos de provisioning SHALL referenciar el usuario, la base de datos y la contraseña de PostgreSQL por NOMBRE de variable de entorno (`${POSTGRES_USER}`, `${POSTGRES_DB}`, `${POSTGRES_PASSWORD}`), resueltos por Grafana en runtime desde el entorno del contenedor. NO SHALL commitearse valores literales de credenciales en el repositorio.

#### Scenario: La contraseña no aparece en los archivos
- **WHEN** se inspeccionan `grafana/provisioning/datasources/postgres.yml` y los dashboards en `grafana/dashboards/`
- **THEN** no se encuentra ningún valor real de contraseña o usuario de PostgreSQL
- **AND** la contraseña se referencia como `${POSTGRES_PASSWORD}` y viaja en `secureJsonData`

#### Scenario: Variables ausentes en el contenedor
- **WHEN** el contenedor Grafana arranca sin `POSTGRES_*` en su entorno (falta la línea en `docker-compose.yml`)
- **THEN** el datasource queda con credenciales vacías y el health del datasource NO es OK
- **AND** los logs de provisioning de Grafana muestran el fallo de conexión

### Requirement: Los dashboards SHALL provisionarse por archivos versionables
Grafana SHALL provisionar los dashboards desde archivos JSON versionables en `grafana/dashboards/` mediante el provider definido en `grafana/provisioning/dashboards/dashboards.yml` (tipo `file`, path `/var/lib/grafana/dashboards`), de modo que aparezcan sin importación manual.

#### Scenario: Grafana escanea el path de dashboards
- **WHEN** Grafana arranca (o transcurre `updateIntervalSeconds`) con archivos JSON en `grafana/dashboards/`
- **THEN** los dashboards aparecen en la UI de Grafana
- **AND** cada dashboard es consultable vía `GET /api/search?type=dash-db` de la API de Grafana

#### Scenario: Un dashboard se corrige y se re-escribe
- **WHEN** se edita un JSON de `grafana/dashboards/` y Grafana re-escanea el path
- **THEN** la versión nueva reemplaza a la anterior sin acción manual

### Requirement: El dashboard SOC Overview SHALL mostrar métricas operativas
El dashboard "SOC Overview" SHALL mostrar: total de eventos, eventos por honeypot (`cowrie`/`dionaea`), serie temporal de eventos, top de `src_ip` y distribución de `risk_score`, leyendo de la tabla `honeypot_events`.

#### Scenario: Panel de total de eventos
- **WHEN** se abre el dashboard SOC Overview
- **THEN** se muestra el conteo total de registros de `honeypot_events` en el rango de tiempo seleccionado
- **AND** los paneles se actualizan automáticamente según el refresh configurado (nuevos eventos sin recargar la página)

#### Scenario: Distribución por honeypot y top de IPs
- **WHEN** existen eventos de `cowrie` y `dionaea` con distintas `src_ip`
- **THEN** se visualiza la proporción de eventos por `source_honeypot`
- **AND** se listan las `src_ip` más frecuentes con su conteo

### Requirement: El dashboard MITRE ATT&CK SHALL permitir filtrar por técnica
El dashboard "MITRE ATT&CK" SHALL mostrar la frecuencia de técnicas (`att_ck_technique`) presentes en `honeypot_events` y SHALL permitir filtrar los paneles por técnica vía variable de template.

#### Scenario: Panel táctico con conteo de técnicas
- **WHEN** existen eventos con `att_ck_technique` poblado (ej. `T1059`)
- **THEN** se muestra el conteo de eventos por técnica
- **AND** la selección de una técnica en el filtro acota los demás paneles

#### Scenario: Sin técnicas registradas
- **WHEN** no hay eventos con `att_ck_technique` en el rango
- **THEN** los paneles muestran cero/ vacío sin errores de consulta

### Requirement: El dashboard de origen geográfico SHALL ser best-effort
El dashboard "Origen geográfico" SHALL intentar mostrar el origen de los ataques por país usando los datos de geolocalización presentes en `enrichment_data` (JSONB) cuando existan, con fallback a `src_ip`; su resultado SHALL degradar con gracia si la data geo es escasa.

#### Scenario: Eventos con geolocalización
- **WHEN** `enrichment_data` contiene datos geo (país/coordenadas) para eventos con `src_ip`
- **THEN** el mapa Geomap agrupa los ataques por país con su cantidad

#### Scenario: Sin data geolocalizada
- **WHEN** `enrichment_data` no contiene datos geo en el rango consultado
- **THEN** el dashboard muestra el mapa vacío o la tabla de países vacía sin errores

### Requirement: El dashboard Malware/IoC SHALL listar indicadores de compromiso
El dashboard "Malware/IoC" SHALL mostrar los indicadores de compromiso capturados por Dionaea: los `malware_hash` más frecuentes y una tabla de detalle con `malware_hash`, `malware_filename`, `src_ip` y `timestamp`.

#### Scenario: Tabla de hashes capturados
- **WHEN** existen eventos con `malware_hash` y `malware_filename`
- **THEN** el dashboard lista los hashes únicos con su frecuencia
- **AND** la tabla de detalle muestra el archivo, la IP de origen y el timestamp de cada captura

#### Scenario: Sin muestras de malware
- **WHEN** no hay eventos con `malware_hash` en el rango
- **THEN** los paneles del dashboard muestran cero/ vacío sin errores

### Requirement: Los dashboards SHALL soportar filtros dinámicos por honeypot, protocolo e IP
Los dashboards SHALL exponer variables de template para filtrar por `source_honeypot`, `protocol` y `src_ip`, y SHALL usar el rango de tiempo de Grafana para acotar por fecha (filtrado de la HU 3).

#### Scenario: Filtrar por honeypot
- **WHEN** el operador selecciona `cowrie` en la variable de template
- **THEN** todos los paneles del dashboard se acotan a eventos con `source_honeypot='cowrie'`

#### Scenario: Acotar por rango de fechas
- **WHEN** el operador cambia el rango de tiempo del dashboard
- **THEN** todas las consultas usan el campo `timestamp` de `honeypot_events` dentro de ese rango