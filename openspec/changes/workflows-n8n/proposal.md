## Why

Los honeypots (Cowrie y Dionaea) ya están enviando webhooks a n8n cuando detectan actividad, pero n8n no tiene ningún workflow configurado. Esto significa que los datos de los ataques se pierden. Necesitamos crear workflows que reciban, procesen y almacenen estos eventos en PostgreSQL para poder analizarlos después en Grafana.

Sin los workflows, el sistema de detección está mudo — los honeypots ven actividad pero no queda registro.

## What Changes

- Crear tabla `attack_events` en PostgreSQL con esquema unificado para ataques de Cowrie y Dionaea
- Crear workflow en n8n `Cowrie Webhook` que reciba eventos SSH/Telnet y los guarde en PostgreSQL
- Crear workflow en n8n `Dionaea Webhook` que reciba eventos de malware/SMB/FTP y los guarde en PostgreSQL
- Agregar campo `source` para identificar qué honeypot generó cada evento
- Configurar n8n para que los workflows se importen desde archivos versionables (no solo desde la UI)

## Capabilities

### New Capabilities
- `ataque-registro`: Capacidad de recibir eventos de ataque vía webhook, parsear los datos según el tipo de honeypot (Cowrie/Dionaea) y persistirlos en PostgreSQL con un esquema normalizado.

### Modified Capabilities
- *(Ninguna — es la primera capacidad post-infraestructura)*

## Impact

- **PostgreSQL**: Nueva tabla `attack_events` (o vistas) en la base de datos existente
- **n8n**: Dos nuevos workflows importables vía archivos JSON
- **Cowrie/Dionaea**: Sin cambios — ya envían los webhooks, solo necesitan ser recibidos
- **Grafana**: Beneficiario downstream — cuando lleguemos a dashboards ya tendrá datos
