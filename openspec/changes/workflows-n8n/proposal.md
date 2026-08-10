## Why

La tubería de eventos está rota hoy: Cowrie NO postea HTTP a n8n (verificado: la imagen `cowrie/cowrie:latest` es la **3.0.12** y su conjunto de 36 módulos de output NO incluye `cowrie.output.http`; la variable `COWRIE_OUTPUT_ENDPOINT` es código muerto). Dionaea está inerte por configuración (0 listeners) y n8n no tiene workflows que procesen los datos de forma correcta y persistente. Esto significa que los datos de los ataques se pierden.

Necesitamos un **sidecar unificado (Camino B)**: un contenedor Python que lea los logs de ambos honeypots (jsonlog de Cowrie y `dionaea.json` de Dionaea) y los POSTee a los webhooks de n8n, más workflows que reciban, procesen y almacenen estos eventos en PostgreSQL para poder analizarlos después en Grafana.

Sin el sidecar y los workflows, el sistema de detección está mudo — los honeypots ven actividad pero no queda registro.

## What Changes

- Tubería de eventos completa: **log honeypot → sidecar unificado → webhook de n8n → workflow → PostgreSQL `honeypot_events`** (Camino B)
- **Sidecar unificado (Camino B)**: nuevo contenedor Python que lee el jsonlog de Cowrie (bind-mount `cowrie/logs`) y el `dionaea.json` de Dionaea (fuente preparada, dormante por ahora) y los POSTea a los webhooks de n8n — absorbe el futuro "puente Dionaea"
- **Cowrie**: overlay de configuración `cowrie/config/cowrie.cfg` con `[output_jsonlog]` (`logfile = log/cowrie.json`) para exponer el jsonlog en el bind-mount `cowrie/logs`; NO postea HTTP (la imagen 3.0.12 no tiene módulo http)
- Usar la tabla existente `honeypot_events` en PostgreSQL (16 columnas, creada por `init.sql`) como esquema unificado para ataques de Cowrie y Dionaea
- **n8n · Cowrie**: adoptar el playbook existente **PB-H1** (`pb-h1-reconocimiento-v1.0.json`) como receptor del webhook `/webhook/cowrie` — arreglar su SQL (parametrizado, cast JSONB correcto, `raw_data`, validación `src_ip`) en lugar de crear un workflow desde cero
- **n8n · Cowrie (comandos)**: convertir el playbook **PB-H2** (`pb-h2-ejecucion-comandos-v1.0.json`) en sub-workflow ejecutado desde PB-H1 vía nodo *Execute Workflow* cuando el evento contiene un comando
- **n8n · Dionaea**: crear workflow `Dionaea Webhook` que reciba eventos de malware/SMB/FTP en `/webhook/dionaea` y los guarde en PostgreSQL (no existe hoy); la emisión real llega vía sidecar cuando Dionaea se habilite (fase posterior)
- Agregar campo `source_honeypot` para identificar qué honeypot generó cada evento
- Configurar n8n para que los workflows se importen desde archivos versionables (no solo desde la UI)

## Capabilities

### New Capabilities
- `ataque-registro`: Capacidad de recibir eventos de ataque vía webhook, parsear los datos según el tipo de honeypot (Cowrie/Dionaea) y persistirlos en PostgreSQL con un esquema normalizado.

### Modified Capabilities
- *(Ninguna — es la primera capacidad post-infraestructura)*

## Impact

- **PostgreSQL**: La tabla `honeypot_events` ya existe (creada por `init.sql` con índices y vista); los workflows la pueblan
- **n8n**: Tres workflows importables vía archivos JSON — PB-H1 (receptor Cowrie), PB-H2 (sub-workflow comandos), Dionaea Webhook (nuevo). Sin la emisión directa de los honeypots, los webhooks dependen del sidecar.
- **Cowrie**: requiere overlay `cowrie/config/cowrie.cfg` (bind-mount `cowrie/config`) con `[output_jsonlog]` para que el jsonlog se escriba en el bind-mount `cowrie/logs` (hoy lo escribe en un volumen anónimo). No envía HTTP.
- **Sidecar (nuevo contenedor)**: se une a `red_dmz` + `red_interna`, monta `cowrie/logs` y `dionaea/logs` (solo lectura) y POSTea a `http://n8n:5678/webhook/cowrie` y `http://n8n:5678/webhook/dionaea`
- **Dionaea**: sin cambios en este change — sigue inerte por configuración; habilitar sus servicios es fase posterior. Su fuente `dionaea.json` queda preparada en el sidecar.
- **Grafana**: Beneficiario downstream — cuando lleguemos a dashboards ya tendrá datos
