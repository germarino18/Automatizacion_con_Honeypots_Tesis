## 1. Datasource PostgreSQL provisionado

- [x] 1.1 Crear `grafana/provisioning/datasources/postgres.yml` (apiVersion: 1) con el datasource `type: postgres`, `name: PostgreSQL - Honeypots`, `url: postgres:5432`, `user: ${POSTGRES_USER}`, `jsonData.database: ${POSTGRES_DB}`, `jsonData.sslmode: disable`, `jsonData.postgresVersion: 1500`, `secureJsonData.password: ${POSTGRES_PASSWORD}`, `isDefault: true`, `editable: false`
- [x] 1.2 Agregar `POSTGRES_USER`, `POSTGRES_PASSWORD` y `POSTGRES_DB` al bloque `environment` del servicio `grafana` en `docker-compose.yml` (única modificación de compose; justificación en design D2 — sin valores literales, solo `$VAR`)
- [x] 1.3 Verificar que ningún archivo nuevo bajo `grafana/` contenga valores reales de usuario/contraseña (grep de secretos previo a commit)
- [x] 1.4 Ejecutar `docker compose up -d grafana` y confirmar que el contenedor `soc-grafana` queda healthy
- [x] 1.5 Verificar vía API que el datasource quedó registrado y con health OK: `curl -u "$GRAFANA_ADMIN_USER:$GRAFANA_ADMIN_PASSWORD" "http://localhost:$GRAFANA_PORT/api/datasources"` → filtrar por `name`, y `curl ... "/api/datasources/proxy/uid/<uid>/healthz"` (o comprobar `type: postgres` y `url: postgres:5432` en el JSON)
- [x] 1.6 Verificar en los logs de Grafana (`docker logs soc-grafana`) que no hay errores de provisioning del datasource

## 2. Provider de dashboards y estructura versionable

- [x] 2.1 Crear `grafana/provisioning/dashboards/dashboards.yml` (apiVersion: 1) con provider `type: file`, `name: honeypots`, `orgId: 1`, `updateIntervalSeconds: 30`, `options.path: /var/lib/grafana/dashboards`, `allowUiUpdates: false`
- [x] 2.2 Crear la carpeta `grafana/dashboards/` dentro del repo (los 4 JSON de dashboards viven ahí, versionables)
- [x] 2.3 Confirmar (documentación) que el bind-mount existente `./grafana:/var/lib/grafana` expone `/var/lib/grafana/provisioning` y `/var/lib/grafana/dashboards` al contenedor sin montajes nuevos
- [x] 2.4 **FIX .gitignore (hallazgo en apply):** `grafana/` está ignorado en `.gitignore` (línea 13), lo que impediría versionar `grafana/provisioning/` y `grafana/dashboards/`. Agregar excepciones (`!grafana/provisioning/`, `!grafana/provisioning/**`, `!grafana/dashboards/`, `!grafana/dashboards/**`) — mismo patrón que `!dionaea/python/` ya presente. Verificar con `git check-ignore` que los archivos nuevos ya no están ignorados y que `grafana/grafana.db` sigue ignorado. **Nota (apply):** se reemplazó `grafana/` por `grafana/*` (el patrón de directorio ignorado impide que git descienda a re-incluir; mismo caso que la línea `dionaea/` no ignorada). Verificado: provisioning y dashboards aparecen como untracked; `grafana.db`, `plugins/`, `unified-search/` siguen ignorados.

## 3. Dashboard SOC Overview

- [x] 3.1 Crear `grafana/dashboards/soc-overview.json` (uid `soc-overview`, título "SOC Overview", tags `honeypot`, refresh `30s`, schemaVersion 39) con template vars `$honeypot` (query `source_honeypot`) y `$protocol`
- [x] 3.2 Panel Stat "Total de eventos": `SELECT COUNT(*) FROM honeypot_events WHERE $__timeFilter(timestamp)`
- [x] 3.3 Panel Pie/Bar "Eventos por honeypot": `SELECT source_honeypot, COUNT(*) FROM honeypot_events WHERE $__timeFilter(timestamp) GROUP BY source_honeypot`
- [x] 3.4 Panel Time series "Eventos en el tiempo": `SELECT $__timeGroupAlias(timestamp,1h), COUNT(*) AS eventos FROM honeypot_events WHERE $__timeFilter(timestamp) GROUP BY 1 ORDER BY 1`
- [x] 3.5 Panel Bar gauge/Table "Top src_ip": `SELECT src_ip, COUNT(*) AS intentos FROM honeypot_events WHERE $__timeFilter(timestamp) GROUP BY src_ip ORDER BY intentos DESC LIMIT 10`
- [x] 3.6 Panel de distribución de riesgo: `SELECT risk_score, COUNT(*) FROM honeypot_events WHERE $__timeFilter(timestamp) GROUP BY risk_score` (o buckets 0-0.2/0.2-0.4/... para distribución legible)
- [x] 3.7 Verificar con datos: `docker compose exec` consultas equivalentes a los paneles en PostgreSQL devuelven los mismos conteos que el dashboard

## 4. Dashboard MITRE ATT&CK

- [x] 4.1 Crear `grafana/dashboards/mitre-attack.json` (uid `mitre-attack`, título "MITRE ATT&CK", tags `honeypot`, `mitre`) con template var `$technique` (query `att_ck_technique`) para filtrar
- [x] 4.2 Panel "Técnicas por táctica/conteo": `SELECT att_ck_technique, COUNT(*) AS eventos FROM honeypot_events WHERE $__timeFilter(timestamp) GROUP BY att_ck_technique ORDER BY eventos DESC`
- [x] 4.3 Panel tabla "Detalle de eventos por técnica" con columnas `timestamp`, `att_ck_technique`, `src_ip`, `source_honeypot`, `risk_score`
- [x] 4.4 Vincular la selección de técnica en `$technique` a todos los paneles (filtro `att_ck_technique = '${technique:singlequote}'`)
- [x] 4.5 Verificar que con `att_ck_technique` nulo el dashboard no arroja error (consulta tolera NULL/vacío)

## 5. Dashboard Origen geográfico (best-effort)

- [x] 5.1 Crear `grafana/dashboards/geo-origen.json` (uid `geo-origen`, título "Origen geográfico", tags `honeypot`, `geo`)
- [x] 5.2 Panel Geomap agrupando por país: query sobre `honeypot_events` extrayendo país de `enrichment_data` (JSONB, campo geo/país) con `COALESCE` y fallback a tabla de países si el campo no existe
- [x] 5.3 Panel tabla "Top países": conteo por país (o por `src_ip` si no hay geo) documentado como best-effort
- [x] 5.4 Verificar degradación: con `enrichment_data` sin datos geo el dashboard renderiza vacío sin errores en el navegador

## 6. Dashboard Malware / IoC

- [x] 6.1 Crear `grafana/dashboards/malware-ioc.json` (uid `malware-ioc`, título "Malware / IoC", tags `honeypot`, `ioc`)
- [x] 6.2 Panel "Top malware_hash": `SELECT malware_hash, COUNT(*) AS capturas FROM honeypot_events WHERE $__timeFilter(timestamp) AND malware_hash IS NOT NULL GROUP BY malware_hash ORDER BY capturas DESC LIMIT 10`
- [x] 6.3 Panel tabla detalle IoC: `SELECT timestamp, malware_hash, malware_filename, src_ip, source_honeypot FROM honeypot_events WHERE $__timeFilter(timestamp) AND malware_hash IS NOT NULL ORDER BY timestamp DESC`
- [x] 6.4 Verificar tolerancia a datos ausentes (Dionaea dormante → sin `malware_hash` → paneles vacíos, sin errores)

## 7. Verificación integral y cierre

- [x] 7.1 `docker compose up -d grafana` con los archivos en su lugar y confirmar que el datasource figura en `GET /api/datasources` y los 4 dashboards en `GET /api/search?type=dash-db`
- [x] 7.2 Abrir cada dashboard en `http://localhost:${GRAFANA_PORT:-3000}` (login `GF_SECURITY_ADMIN_USER`/`GF_SECURITY_ADMIN_PASSWORD`) y confirmar render sin errores; captura de pantalla opcional
- [x] 7.3 Ejecutar una simulación de ataque (si el entorno lo permite, HU 6) y confirmar que los nuevos eventos aparecen en el dashboard en tiempo real (refresh)
- [x] 7.4 Revisión final de secretos: `git grep -iE "(password|secret).*=.+[A-Za-z0-9]{8,}"` sobre los archivos nuevos NO debe arrojar credenciales reales (solo referencias `${VAR}`)
- [x] 7.5 Documentar en README (sección Grafana): rutas de provisioning, cómo se agrega un dashboard, mecanismo de credenciales por env y URLs de acceso
- [x] 7.6 Actualizar `CHANGES.md`/roadmap si aplica y confirmar que `openspec status --change grafana-dashboards` está listo para `/opsx:apply`. **Nota:** `CHANGES.md` NO existe en este repo (no hay roadmap-generator aplicado); se omite su creación por instrucción. `openspec status --change grafana-dashboards` → 4/4 artifacts completos (proposal, design, specs, tasks); los 35 tasks están marcados. Listo para `/opsx:apply`.