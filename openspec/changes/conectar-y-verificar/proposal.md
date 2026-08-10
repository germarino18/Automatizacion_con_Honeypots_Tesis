## Why

El change `workflows-n8n` (en curso, 4/15 tareas) creó los workflows webhook en la UI de n8n, pero NO pueden verificarse ni cerrarse porque el stack no está levantado: no existe `.env` (todas las variables del compose están vacías), ningún contenedor corre, y `DIONAEA_OUTPUT_ENDPOINT` es letra muerta (la imagen oficial `dinotools/dionaea` no la documenta; solo soporta DIONAEA_SKIP_INIT, DIONAEA_FORCE_INIT, DIONAEA_FORCE_INIT_CONF, DIONAEA_FORCE_INIT_DATA). Sin un diagnóstico secuencial de la cadena honeypot → n8n → PostgreSQL, es imposible confirmar que los workflows de `workflows-n8n` realmente reciben y persisten eventos.

Este change crea el plan de conexión y verificación (pasos 0-6, de abajo hacia arriba) que PRECEDE al cierre de `workflows-n8n`, y documenta explícitamente la limitación de Dionaea como dependencia a un change futuro (sin resolverla aquí).

## What Changes

- Crear y validar el archivo `.env` con credenciales reales (POSTGRES_*, N8N_BASIC_AUTH_*, N8N_ENCRYPTION_KEY, WEBHOOK_URL, COWRIE_*, DIONAEA_*, GRAFANA_*, NETWORK_*) y confirmar con `docker compose config` que no queden variables vacías.
- Levantar el stack con `docker compose up -d` y confirmar que los 6 servicios (postgres, n8n, cowrie, dionaea, grafana, nginx) queden healthy con `docker compose ps`.
- Verificar que n8n responda HTTP 200 en `http://localhost:5678/healthz` (host e interno).
- Verificar conectividad de red interna: los contenedores honeypot alcanzan a n8n por nombre de red (`docker exec soc-cowrie curl http://n8n:5678/healthz`).
- Inventariar los workflows existentes/activos en n8n (UI + `n8n export:workflow --all`) para saber qué se hereda antes de continuar `workflows-n8n`.
- Probar los endpoints webhook `/webhook/cowrie` y `/webhook/dionaea` con POST de prueba y registrar la respuesta (200 vs 404).
- Validar que COWRIE realmente envía eventos: simular login SSH y confirmar una fila nueva en `honeypot_events` (psql SELECT).
- Documentar (NO resolver) la incapacidad de Dionaea de emitir webhooks con la config actual, como dependencia a un change futuro de "puente Dionaea" (sidecar que lea `dionaea.json` y reenvíe a n8n).

**No-goals (explícitos):** NO se implementa el puente de Dionaea (ni sidecar ni scripts) en este change; NO se modifica el change `workflows-n8n` (proposal, design, specs ni tasks).

## Capabilities

### New Capabilities
- `diagnostico-cadena`: Capacidad de conectar y verificar la cadena de comunicación del SOC — `.env` válido, stack healthy, n8n alcanzable (host + red interna), inventario de workflows, endpoints webhook respondiendo, y confirmación de que Cowrie emite eventos que se persisten en `honeypot_events`.

### Modified Capabilities
- *(Ninguna — el stack `infraestructura-docker` está archivado y no se cambian requisitos de `ataque-registro` de `workflows-n8n`; este change solo verifica la cadena.)*

## Impact

- **`.env`** (NUEVO): archivo no versionado (gitignored) con credenciales reales; única fuente de variables para `docker-compose.yml`.
- **`docker-compose.yml`**: sin cambios de código; se usa para `config`, `up` y `ps` como parte de la operación.
- **n8n**: estado operativo (healthz, red interna, inventario de workflows, export — solo lectura, no se crean workflows aquí).
- **PostgreSQL**: se consulta `honeypot_events` (solo lectura de verificación).
- **`workflows-n8n`**: NO se toca. Este change es su prerrequisito de verificación.
- **Dependencia futura documentada**: change "puente Dionaea" (sidecar lector de `dionaea.json` → reenvío a n8n), con hallazgos ya verificados como conocimiento inicial.
- **Riesgo de entorno**: puertos 2222/2223 (Cowrie), 445/21/80 (Dionaea), 5678 (n8n), 3000 (Grafana), 80/443 (Nginx) deben estar libres en el host al levantar.