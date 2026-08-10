## Why

Los honeypots (Cowrie y Dionaea) ya están configurados para enviar webhooks a n8n cuando detectan actividad, pero n8n no tiene workflows que procesen esos datos de forma correcta y persistente. Esto significa que los datos de los ataques se pierden. Necesitamos workflows que reciban, procesen y almacenen estos eventos en PostgreSQL para poder analizarlos después en Grafana.

Sin los workflows, el sistema de detección está mudo — los honeypots ven actividad pero no queda registro.

## What Changes

- Usar la tabla existente `honeypot_events` en PostgreSQL (16 columnas, creada por `init.sql`) como esquema unificado para ataques de Cowrie y Dionaea
- **Cowrie**: adoptar el playbook existente **PB-H1** (`pb-h1-reconocimiento-v1.0.json`) como receptor del webhook `/webhook/cowrie` — arreglar su SQL (parametrizado, cast JSONB correcto, `raw_data`, validación `src_ip`) en lugar de crear un workflow desde cero
- **Cowrie (comandos)**: convertir el playbook **PB-H2** (`pb-h2-ejecucion-comandos-v1.0.json`) en sub-workflow ejecutado desde PB-H1 vía nodo *Execute Workflow* cuando el evento contiene un comando
- **Dionaea**: crear workflow `Dionaea Webhook` que reciba eventos de malware/SMB/FTP en `/webhook/dionaea` y los guarde en PostgreSQL (no existe hoy)
- Agregar campo `source_honeypot` para identificar qué honeypot generó cada evento
- Configurar n8n para que los workflows se importen desde archivos versionables (no solo desde la UI)

## Capabilities

### New Capabilities
- `ataque-registro`: Capacidad de recibir eventos de ataque vía webhook, parsear los datos según el tipo de honeypot (Cowrie/Dionaea) y persistirlos en PostgreSQL con un esquema normalizado.

### Modified Capabilities
- *(Ninguna — es la primera capacidad post-infraestructura)*

## Impact

- **PostgreSQL**: La tabla `honeypot_events` ya existe (creada por `init.sql` con índices y vista); los workflows la pueblan
- **n8n**: Tres workflows importables vía archivos JSON — PB-H1 (receptor Cowrie), PB-H2 (sub-workflow comandos), Dionaea Webhook (nuevo)
- **Cowrie/Dionaea**: Sin cambios — ya envían los webhooks, solo necesitan ser recibidos. (Nota: la emisión real de Dionaea se resuelve en el change `conectar-y-verificar` / "puente Dionaea")
- **Grafana**: Beneficiario downstream — cuando lleguemos a dashboards ya tendrá datos
