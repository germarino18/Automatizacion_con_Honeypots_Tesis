## Context

Grafana ya está en `docker-compose.yml` (imagen `grafana/grafana:latest`, container `soc-grafana`, puerto `${GRAFANA_PORT:-3000}:3000`, bind-mount `./grafana:/var/lib/grafana`, red `red_interna`). Está funcionando como servicio pero sin dashboards ni datasource: la carpeta `grafana/` solo tiene el runtime DB (`grafana.db`).

La tubería de datos está COMPLETA y verificada: honeypots (Cowrie/Dionaea) → sidecar unificado → webhooks n8n → PostgreSQL `honeypot_events` (capacidad `ataque-registro`, archivada con 40/40 tasks). Los datos existen; falta la capa de visualización que fue declarada como beneficiario downstream. El análisis recae en PostgreSQL, que corre en la MISMA red `red_interna` (internal) que Grafana, alcanzable por nombre de servicio `postgres:5432`.

Stakeholders: operador SOC (monitoreo en tiempo real, filtrado por severidad/fecha/IP), investigador (MITRE ATT&CK, IoCs, origen geográfico), administrador (métricas MTTD/MTTR). Alineación con `docs/historias_de_usuario.md` (HU 1–5, 7) y con las métricas de la tesis del README.

## Goals / Non-Goals

**Goals:**
- Provisionar UN datasource PostgreSQL en Grafana vía archivos versionables (`grafana/provisioning/datasources/postgres.yml`) apuntando a `postgres:5432`.
- Provisionar dashboards SOC vía `grafana/provisioning/dashboards/dashboards.yml` + JSON versionables en `grafana/dashboards/`, siguiendo el patrón GitOps del repo (workflows n8n versionados en `n8n/workflows/`).
- Cubrir las historias de usuario relevantes con 4 dashboards: Overview/SOC, MITRE ATT&CK, Origen geográfico, Malware/IoC.
- Mantener las credenciales fuera de los archivos (referencia por nombre de variable de entorno).
- Verificar que el datasource haga health OK y los dashboards se carguen vía API de Grafana.

**Non-Goals:**
- NO modificar el esquema PostgreSQL ni crear vistas/tablas nuevas (solo lectura de `honeypot_events`, `responses`, `metrics_summary`).
- NO configurar alertas (email/Discord/Telegram) — fase posterior.
- NO habilitar servicios de Dionaea ni tocar los honeypots.
- NO construir dashboards con la UI manualmente (provisioning-first).
- NO abarcar todas las historias (HU 8 alertas, HU 9 sesiones forenses, HU 10 reportes quedan fuera).
- NO cambiar nginx ni el proxy reverso (acceso por `http://localhost:3000` directo).

## Decisions

### D1. Provisioning-first con archivos versionables (no UI)
Los dashboards y el datasource se definen por archivo bajo `grafana/provisioning/` y `grafana/dashboards/`, versionables en git.
- **Por qué**: mismo patrón que los workflows n8n (versionados como JSON); reproducibilidad y diffs claros en las revisión; GitOps natural; la propuesta lo declara como dirección.
- **Alternativas**: crear dashboards a mano en la UI (rápido pero efímero, no versionable, no reproducible) — descartada.

### D2. Mecanismo de credenciales del datasource: env vars resueltas por Grafana en runtime
Grafana soporta lookups de variables de entorno en TODOS los archivos de provisioning (`${VAR}` y `$VAR`). Por lo tanto el datasource se escribe con referencias:

```yaml
datasources:
  - name: PostgreSQL - Honeypots
    type: postgres
    url: postgres:5432
    user: ${POSTGRES_USER}
    jsonData:
      database: ${POSTGRES_DB}
      sslmode: disable
      postgresVersion: 1500
    secureJsonData:
      password: ${POSTGRES_PASSWORD}
```

- **Por qué**: cero secretos en el repo; Grafana re-expande en cada arranque; el password va en `secureJsonData` (cifrado por Grafana).
- **Prerrequisito real**: Docker Compose solo inyecta en el contenedor las variables que el servicio declara en `environment:`. El servicio `grafana` hoy NO recibe `POSTGRES_*`, así que hay que agregar `POSTGRES_USER`, `POSTGRES_PASSWORD` y `POSTGRES_DB` al bloque `environment` del servicio grafana en `docker-compose.yml`. Esto SÍ es un cambio de compose y está justificado: es el mecanismo mínimo para que Grafana resuelva las credenciales sin hardcodearlas.
- **Alternativas consideradas**:
  - `GF_DATASOURCES_*` como env vars (provisioning 100% por entorno): válido, pero el YAML de datasource es más legible y extensible y permite el mismo patrón para los dashboards; de todos modos también exigiría pasar `POSTGRES_*` al contenedor.
  - Valores literales en el YAML: descartado — viola la regla de no commitear credenciales.
  - `env_file: .env` en grafana: descartado por menos explícito (inyecta TODAS las vars del proyecto); se prefiere listar solo las tres necesarias en `environment:`.
- **Nota de sintaxis**: se usa `${VAR}` para valores de una sola expansión (los passwords del proyecto no contienen `$`); se documenta en README del cambio.

### D3. Cuatro dashboards alineados a las historias de usuario
| Dashboard | Archivo | Historias | Paneles clave |
|---|---|---|---|
| SOC Overview | `grafana/dashboards/soc-overview.json` | HU 1, 3, 7 | total eventos, eventos por honeypot (cowrie/dionaea), serie temporal de eventos, top 10 `src_ip`, distribución de `risk_score` (buckets), latencia de ingesta (M TTD aproximado: diff `created_at` vs `timestamp`) |
| MITRE ATT&CK | `grafana/dashboards/mitre-attack.json` | HU 2 | técnicas por táctica (count), tabla de técnicas con `att_ck_technique`, filtro por táctica/técnica vía template vars |
| Origen geográfico | `grafana/dashboards/geo-origen.json` | HU 4 | mapa (panel Geomap) agrupando por país a partir de `enrichment_data` JSONB (geoip), fallback a `src_ip`; best-effort si la data geo es escasa |
| Malware / IoC | `grafana/dashboards/malware-ioc.json` | HU 5 | top `malware_hash`, tabla `malware_hash` + `malware_filename` + `src_ip` + `timestamp`, conteo por `source_honeypot` |

- **Por qué 4**: es la PRIMERA capa de visualización; cubre las HU prioritarias sin sobre-ambicionar. Dashboards posteriores (sesiones, reportes, alertas) quedan como non-goal.
- Template vars: `$honeypot`, `$protocol`, `$src_ip` (regex o tipo query) para el filtrado de HU 3 (severidad/date/IP se cubren con filtros de tiempo y template vars).

### D4. Acceso a PostgreSQL vía red interna
Grafana y PostgreSQL están en `red_interna` (misma red Docker, `internal: true` → sin salida a internet). El datasource usa `url: postgres:5432` (nombre de servicio, resuelto por Docker DNS). El acceso a la UI es por host: `http://localhost:3000` (bind `${GRAFANA_PORT:-3000}`). Sin TLS interno (sslmode disable), aceptable porque la red es internal.

### D5. Bind-mount actual cubre provisioning
El volume `./grafana:/var/lib/grafana` ya monta todo `grafana/` en el contenedor: `grafana/provisioning/datasources/...` → `/var/lib/grafana/provisioning/datasources/...` y `grafana/dashboards/...` → `/var/lib/grafana/dashboards/...`, que son las rutas por defecto que Grafana escanea. Esto significa que agregar archivos bajo `grafana/` NO requiere montajes nuevos en compose (la única modificación compose es la de D2). La ruta del provider de dashboards en `dashboards.yml` apunta a `/var/lib/grafana/dashboards`.

### D5b. `.gitignore`: versionar provisioning y dashboards (hallazgo en apply)
`grafana/` estaba en `.gitignore` (línea 13, "Datos de Servicios"), lo que habría impedido versionar el datasource y los dashboards — contradiciendo D1. Se agregan excepciones para las subcarpetas versionables: `!grafana/provisioning/`, `!grafana/provisioning/**`, `!grafana/dashboards/`, `!grafana/dashboards/**` (mismo patrón que `!dionaea/python/` ya usado en workflows-n8n). El runtime DB `grafana/grafana.db`, `unified-search/`, etc. siguen ignorados.

## Risks / Trade-offs

- **[Credenciales no resueltas] → Mitigación**: si `POSTGRES_*` no está en el `environment` de grafana, Grafana deja el datasource con valores vacíos y el health falla. Task de verificación: curl a la API de datasource para comprobar health + revisar logs de provisioning. Se agrega la línea de compose como task explícito con justificación.
- **[Data geo escasa para el mapa] → Mitigación**: el dashboard geo usa `enrichment_data` con fallback a `src_ip`; se documenta como best-effort y no bloquea la entrega si el mapa queda mayormente vacío.
- **[Cobertura MITRE parcial] → Mitigación**: `att_ck_technique` hoy se puebla para comandos (T1059) y usa futuro en otros casos; el panel muestra lo que hay y admite filtros — no se inventa data.
- **[Cambio mínimo en compose] → Mitigación**: solo se agregan 3 variables de entorno al servicio grafana; nada más del archivo cambia. El resto del change es puramente aditivo bajo `grafana/`.
- **[Dashboard JSON versionable pero voluminoso] → Trade-off**: aceptado — es el mismo trade-off que los workflows n8n; los JSON son el artefacto de la revisión.
- **[Grafana `latest` ya en uso] → Trade-off**: se mantiene la imagen actual del repo (sin pin de versión) para no ampliar el alcance; se nota en la verificación la versión efectiva.

## Migration Plan

1. **Deploy**: agregar `POSTGRES_*` al `environment` del servicio grafana → `docker compose up -d grafana` (recrea solo grafana; PostgreSQL y n8n no se tocan).
2. **Provisioning**: copiar `grafana/provisioning/` y `grafana/dashboards/` (los montajes ya existen por el bind-mount) — Grafana carga el datasource y los dashboards al arrancar y re-escanea según `updateIntervalSeconds`.
3. **Rollback**: revertir el commit del change y `docker compose up -d grafana`; eliminar los archivos bajo `grafana/` restaura el estado previo (Grafana conserva el runtime DB). No hay migración destructiva de datos.

## Open Questions

- ¿Se desea un dashboard adicional de "sesiones" (HU 9) en esta fase? Se asume NO (non-goal) — puede proponerse como change futuro.
- ¿El mapa geo necesita el plugin Geomap (incluido por defecto en Grafana) o se prefiere tabla de países como fallback robusto? Se asume: Geomap con fallback a tabla.
- Confirmar en la verificación si la versión de Grafana (`latest` al desplegar) soporta los paneles usados; si no, ajustar a paneles base.