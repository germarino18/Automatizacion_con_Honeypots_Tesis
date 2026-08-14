## Why

Grafana ya está desplegado en `docker-compose.yml` (servicio `grafana`, red `red_interna`, puerto 3000) pero NO tiene dashboards ni datasource provisionado: la carpeta `grafana/` solo contiene la base de datos runtime (`grafana.db`). La tubería de datos completa (honeypots → sidecar → n8n → PostgreSQL `honeypot_events`) ya está verificada y poblada por la capacidad `ataque-registro`, así que el beneficiario downstream declarado en el change `workflows-n8n` ya tiene datos que hoy nadie visualiza. Sin capa de visualización, el SOC no puede observar ataques en tiempo real ni soportar las métricas de la tesis (MTTD, MTTR, cobertura MITRE ATT&CK).

## What Changes

- **Provisioning-first**: datasource PostgreSQL provisionado por archivo (`grafana/provisioning/datasources/postgres.yml`) y dashboards provisionados por archivo (`grafana/provisioning/dashboards/dashboards.yml` + JSON en `grafana/dashboards/`), versionables en git — mismo patrón que los workflows de n8n en `n8n/workflows/`. Nada se configura a mano desde la UI.
- **Mecanismo de credenciales del datasource**: el archivo de provisioning NO soporta interpolación de variables de Compose, por lo que las credenciales se referencian por nombre de variable de entorno (`${POSTGRES_USER}`, `${POSTGRES_PASSWORD}`, `${POSTGRES_DB}`) que Grafana resuelve en runtime; el mecanismo elegido se detalla en `design.md`.
- **Dashboards** (alineados a `docs/historias_de_usuario.md`):
  - **Overview / SOC**: total de eventos, eventos por honeypot, eventos en el tiempo, top `src_ip`, distribución de `risk_score` (HU 1, 3, 7).
  - **MITRE ATT&CK**: paneles de técnicas por táctica con filtro (HU 2).
  - **Origen geográfico**: mapa de origen de ataques a partir de `enrichment_data` (geoip) con fallback a `src_ip` — best-effort porque la data geo puede ser escasa (HU 4).
  - **Malware / IoC**: `malware_hash`, `malware_filename`, top hashes (HU 5).
- **Verificación operativa**: datasource con health OK contra `postgres:5432` (ambos en `red_interna`) y dashboards cargados vía API de Grafana.
- **Sin cambios de runtime obligatorios**: se prefiere solo agregar archivos bajo `grafana/`. El único ajuste potencial de `docker-compose.yml` sería montar `./grafana/provisioning` y `./grafana/dashboards` en el contenedor (el bind-mount actual `./grafana:/var/lib/grafana` ya cubre esas rutas — se confirma en design/tasks).

## Capabilities

### New Capabilities
- `visualizacion-grafana`: Capacidad de provisionar el datasource PostgreSQL de Grafana y los dashboards SOC (overview, MITRE ATT&CK, mapa geográfico, malware/IoC) vía archivos versionables, para visualizar los eventos de `honeypot_events` y soportar las métricas de la tesis.

### Modified Capabilities
- *(Ninguna — no cambian REQUIREMENTS de `ataque-registro`; es solo lectura de datos)*

## Impact

- **Grafana**: se agregan `grafana/provisioning/datasources/postgres.yml`, `grafana/provisioning/dashboards/dashboards.yml` y `grafana/dashboards/*.json`. El bind-mount existente `./grafana:/var/lib/grafana` ya expone la carpeta `provisioning` al contenedor.
- **PostgreSQL**: sin cambios de esquema — solo se lee `honeypot_events`, `responses` y la vista `metrics_summary`.
- **docker-compose.yml / .env**: sin cambios en el escenario preferido (solo se agregan archivos bajo `grafana/`). Se documenta en design si un montaje adicional resulta imprescindible.
- **Seguridad**: no se persisten credenciales en los archivos de provisioning; se referencian por nombre de variable de entorno.