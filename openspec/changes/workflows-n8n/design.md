## Context

Actualmente el SOC tiene:
- **Cowrie** (honeypot SSH/Telnet) → escucha en puertos 2222-2223
- **Dionaea** (honeypot malware) → escucha en puertos 21, 8080, 4445
- **n8n** (orquestador) → http://n8n:5678, recibe webhooks pero sin workflows
- **PostgreSQL** → base de datos operativa, actualmente solo usada por n8n como backend interno

Los honeypots ya están configurados para enviar webhooks a n8n, pero no hay workflows que procesen esos datos. La información de ataques se pierde.

Necesitamos:
1. Un esquema de base de datos para almacenar eventos de ataque
2. Workflows de n8n que reciban los webhooks y persistan los datos
3. Que los workflows sean versionables (archivos importables, no solo desde la UI)

## Goals / Non-Goals

**Goals:**
- Crear tabla `attack_events` en PostgreSQL con esquema normalizado
- Workflow "Cowrie Webhook" que recibe POST en `/webhook/cowrie` y guarda en BD
- Workflow "Dionaea Webhook" que recibe POST en `/webhook/dionaea` y guarda en BD
- Exportar los workflows como archivos JSON en el repositorio
- Que quede funcionando y persistente (si n8n se reinicia, los workflows siguen)

**Non-Goals:**
- NO incluye dashboards de Grafana (próximo cambio)
- NO incluye alertas ni notificaciones (próximo cambio)
- NO incluye clasificación MITRE ATT&CK de ataques
- NO incluye análisis ni correlación entre eventos

## Decisions

### Decisión 1: Tabla única vs tablas separadas por honeypot

**Elegido:** Tabla única `attack_events` con campo `source` y `raw_data` JSONB.

| Opción | Pro | Contra |
|--------|-----|--------|
| Tabla única + JSONB | Consultas simples, schema flexible, fácil de expandir | Validación menos estricta |
| Tablas separadas (cowrie_events, dionaea_events) | Schema rígido, mejor integridad | Más complejo, joins innecesarios para dashboards |

**Razón:** Para la etapa actual priorizamos simplicidad y flexibilidad. JSONB nos permite capturar TODO lo que mande cada honeypot sin tener que adaptar el schema cada vez.

### Decisión 2: Workflows versionables vs solo UI

**Elegido:** Exportar workflows como JSON en `n8n/workflows/`.

n8n permite exportar/importar workflows como JSON. Los guardamos en el repo para:
- Poder restaurarlos si se borra el contenedor
- Versionar los cambios (git)
- Tener un respaldo fuera de la UI de n8n

### Decisión 3: Puerto del webhook en n8n

**Elegido:** Usar el webhook por defecto de n8n (puerto 5678, ruta `/webhook/<nombre>`).

Los honeypots ya apuntan a:
- Cowrie → `http://n8n:5678/webhook/cowrie`
- Dionaea → `http://n8n:5678/webhook/dionaea`

No hay que cambiar nada del lado de los honeypots.

## Risks / Trade-offs

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| n8n se reinicia y pierde workflows no guardados | Medio | Exportar los workflows a JSON y tenerlos en git |
| Formato del webhook cambia entre versiones de los honeypots | Bajo | El campo `raw_data` JSONB captura todo aunque cambie la estructura |
| PostgreSQL se llena de datos basura (escaneos) | Medio | Agregar rate-limiting o filtros después, por ahora almacenamos todo |
| La tabla crece rápido sin límite | Bajo | Agregar política de retención (ej: borrar datos > 30 días) cuando sea necesario |
