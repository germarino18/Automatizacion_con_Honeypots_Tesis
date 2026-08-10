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
- Usar la tabla existente `honeypot_events` (16 columnas, creada por `init.sql`) — NO crear DDL en los workflows
- **Cowrie**: usar el playbook PB-H1 existente como receptor en `/webhook/cowrie` (arreglando su SQL) + PB-H2 como sub-workflow para comandos
- **Dionaea**: crear workflow "Dionaea Webhook" que recibe POST en `/webhook/dionaea` y guarda en BD
- Exportar los workflows como archivos JSON en el repositorio
- Que quede funcionando y persistente (si n8n se reinicia, los workflows siguen)

**Non-Goals:**
- NO incluye dashboards de Grafana (próximo cambio)
- NO incluye alertas ni notificaciones (próximo cambio)
- NO re-crea desde cero el receptor de Cowrie: se adopta y corrige el playbook existente
- (El enriquecimiento AbuseIPDB/Shodan/VirusTotal y el scoring YA existen en PB-H1/PB-H2; este change los deja funcionando pero no amplía su lógica)
- NO incluye análisis ni correlación entre eventos

## Decisions

### Decisión 1: Tabla única vs tablas separadas por honeypot

**Elegido:** Tabla única `honeypot_events` con campo `source_honeypot` y `raw_data` JSONB — ya existe, creada por `postgres/init.sql`.

| Opción | Pro | Contra |
|--------|-----|--------|
| Tabla única + JSONB (elegida) | Consultas simples, schema flexible, fácil de expandir | Validación menos estricta |
| Tablas separadas (cowrie_events, dionaea_events) | Schema rígido, mejor integridad | Más complejo, joins innecesarios para dashboards |

**Razón:** Para la etapa actual priorizamos simplicidad y flexibilidad. JSONB nos permite capturar TODO lo que mande cada honeypot sin tener que adaptar el schema cada vez. El esquema real de 16 columnas ya contempla `username`/`commands` para Cowrie, `malware_hash`/`malware_filename` para Dionaea, y campos de uso futuro (`risk_score`, `att_ck_technique`, `enrichment_data`, `playbook_id`). `init.sql` es la fuente única del esquema — los workflows solo insertan, no ejecutan DDL.

> **Nota de alineación:** La spec original planeaba una tabla `attack_events` de 10 columnas; esa tabla NO existe. El cambio se alinea con `honeypot_events` real, que es más completa.

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

### Decisión 4: Estrategia de mapeo de payload → columnas

**Elegido:** Normalización mínima en un nodo Code + `raw_data` completo. Cada workflow tiene un nodo Code que aplana el payload del honeypot a las columnas de `honeypot_events` (con fallbacks), valida `src_ip`, y el nodo PostgreSQL inserta con **parámetros** (`$1, $2...`), nunca interpolación directa.

**Nota de adopción:** PB-H1 ya tiene su nodo "Normalizar Datos" y PB-H2 su "Extraer IOCs" — se **mantienen** como punto de normalización, pero sus nodos PostgreSQL deben migrarse de interpolación a parámetros (ver anti-patrón abajo).

**Mapeo Cowrie** (payload tipo jsonlog; campos en camelCase o snake_case):

| Columna | Origen | Fallback | Nota |
|---------|--------|----------|------|
| `source_honeypot` | `'cowrie'` | — | constante |
| `src_ip` | `src_ip` | `source_ip` | validar IP; si inválida → `'0.0.0.0'` |
| `dst_port` | `dst_port` | `port` | castear `parseInt` |
| `protocol` | `protocol` | derivar del `eventid` | `ssh`/`telnet` |
| `username` | `username` | — | NULL si no viene |
| `commands` | `command` | `input` | Cowrie usa `input` en command events |
| `timestamp` | `timestamp` | `NOW()` | ISO string ok |
| `raw_data` | payload íntegro | — | siempre |

**Mapeo Dionaea** (payload de connection events; campos anidados en `connection.*`):

| Columna | Origen | Fallback | Nota |
|---------|--------|----------|------|
| `source_honeypot` | `'dionaea'` | — | constante |
| `src_ip` | `connection.remote_host` | `remote_host` | validar IP; si inválida → `'0.0.0.0'` |
| `dst_port` | `connection.local_port` | `local_port` | castear `parseInt` |
| `protocol` | `connection.protocol` | `protocol` | smbd, ftpd, httpd... |
| `malware_hash` | `download.sha256` | — | solo si capturó binario |
| `malware_filename` | `download.filename` | — | ídem |
| `timestamp` | `timestamp` | `NOW()` | |
| `raw_data` | payload íntegro | — | siempre |

**Reglas transversales:**
- **`src_ip` INET NOT NULL**: si el payload no trae una IP válida (hostname, vacío), el nodo Code usa `'0.0.0.0'` como IP desconocida. NO se migra el esquema a nullable (se evita el cambio de schema).
- **INSERT parametrizado**: el nodo PostgreSQL recibe valores limpios del nodo Code con placeholders `$1, $2...`. Prohibida la interpolación `{{ $json[...] }}` dentro del query (riesgo de inyección y errores de tipo).
- **Columnas de uso futuro** (`risk_score`, `att_ck_technique`, `enrichment_data`, `playbook_id`): quedan con su default/NULL; los playbooks posteriores las llenan.
- **Anti-patrón detectado (debe corregirse)**: los playbooks PB-H1 y PB-H2 (`workflows/*.json`) interpolan `{{ $json[...] }}` directo en el SQL — Y PB-H1 castea `'{{enrichment_timestamp}}'::jsonb` que es un timestamp ISO (no JSON válido) y **falla en runtime**. Este change los migra a INSERT parametrizado con cast correcto.
- **`raw_data` obligatorio**: los playbooks actuales NO guardan el payload completo — deben agregar `raw_data` = payload íntegro al INSERT.

### Decisión 5: Arquitectura de receptores (playbooks existentes)

**Contexto:** El usuario tiene 2 playbooks previos (`C:\Tesis n8n HoneyPots\`) que ya están en el repo (`workflows/`): PB-H1 escucha en `/webhook/cowrie` y PB-H2 en `/webhook/cowrie-command`.

**Problema:** n8n no permite dos workflows ACTIVOS con la misma ruta webhook, y Cowrie manda TODOS sus eventos a una sola URL (`COWRIE_OUTPUT_ENDPOINT=http://n8n:5678/webhook/cowrie`). La ruta `/webhook/cowrie-command` de PB-H2 **nunca recibiría tráfico** — PB-H2 jamás se dispararía en producción.

**Elegido:** PB-H1 como receptor único de Cowrie + PB-H2 como **sub-workflow** ejecutado por PB-H1.

```
Cowrie ──todos los eventos──▶ /webhook/cowrie (PB-H1, receptor)
                                   │
                                   │ nodo "Execute Workflow" de n8n
                                   │ (solo si el evento trae comando)
                                   ▼
                             PB-H2 (sub-workflow, sin ruta propia)
```

- PB-H1: receptor activo en `/webhook/cowrie`; su webhook original se mantiene.
- PB-H2: pierde su rol de webhook — se ejecuta vía nodo *Execute Workflow* (sub-workflow). Se puede conservar su nodo Webhook para testing manual, pero **no se activa**.
- La ruta `/webhook/dionaea` queda libre para el workflow Dionaea nuevo (no había conflictos — no existe ningún playbook para Dionaea).

## Risks / Trade-offs

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| n8n se reinicia y pierde workflows no guardados | Medio | Exportar los workflows a JSON y tenerlos en git |
| `src_ip` es INET y rechaza valores no-IP (hostnames, vacíos) | Medio | El nodo Code valida el campo; si no es IP válida inserta `'0.0.0.0'` (IP desconocida) — ver Decisión 4 |
| Formato del webhook cambia entre versiones de los honeypots | Bajo | El campo `raw_data` JSONB captura todo aunque cambie la estructura |
| PostgreSQL se llena de datos basura (escaneos) | Medio | Agregar rate-limiting o filtros después, por ahora almacenamos todo |
| La tabla crece rápido sin límite | Bajo | Agregar política de retención (ej: borrar datos > 30 días) cuando sea necesario |
| Los playbooks PB-H1/PB-H2 tienen SQL con interpolación y cast JSONB inválido | Alto | Migrar a INSERT parametrizado y cast correcto en este change (Decisión 4/5) |
| PB-H2 queda "huérfano" si el nodo Execute Workflow no se configura bien | Medio | Probar la ruta de comandos con un evento de prueba con `command` (task 4.x) |
