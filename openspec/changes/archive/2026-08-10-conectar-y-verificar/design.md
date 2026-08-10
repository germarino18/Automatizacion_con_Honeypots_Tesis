## Context

Estado verificado del proyecto (no se re-investigó durante este change):

- NO existe `.env`: `docker compose ps` advierte que todas las variables (POSTGRES_*, N8N_*, COWRIE_*, DIONAEA_*, GRAFANA_*, NETWORK_*) están vacías. Nada puede levantar sin `.env`.
- NO hay contenedores corriendo (`docker ps` vacío).
- `DIONAEA_OUTPUT_ENDPOINT` es letra muerta: la imagen oficial `dinotools/dionaea` en Docker Hub NO documenta esa variable; solo soporta `DIONAEA_SKIP_INIT`, `DIONAEA_FORCE_INIT`, `DIONAEA_FORCE_INIT_CONF`, `DIONAEA_FORCE_INIT_DATA`. La config versionada de Dionaea escribe a archivo local (`file://var/lib/dionaea/dionaea.json`) y `submit_http_post` apunta a example.org. Por lo tanto Dionaea NO puede enviar webhooks a n8n con la config actual. COWRIE sí (imagen `cowrie/cowrie` soporta `COWRIE_OUTPUT_ENDPOINT`, var presente en `docker-compose.yml`).
- `src_ip` en `honeypot_events` es `INET NOT NULL` — rechaza valores no-IP.
- El repo tiene `workflows/` con dos playbooks prototipo (pb-h1-reconocimiento, pb-h2-ejecucion-comandos), pero NO hay workflows webhook versionados (están en la UI de n8n, según tasks 2.1-2.2 de `workflows-n8n`).

El change `workflows-n8n` está en curso (4/15 tareas) y necesita esta cadena levantada y verificada para poder cerrarse. Este change es el plan de diagnóstico/verificación secuencial que lo precede.

## Goals / Non-Goals

**Goals:**
- Llevar el stack a estado operativo verificable: `.env` válido → servicios healthy → n8n respondiendo → red interna funcional → webhooks respondiendo → Cowrie emitiendo eventos que llegan a `honeypot_events`.
- Inventariar lo que ya existe en n8n (workflows activos) antes de continuar `workflows-n8n`.
- Dejar documentado el hallazgo de Dionaea como dependencia a un change futuro, con el conocimiento técnico ya verificado.
- Cada decisión del diagnóstico queda registrada con su razón (gobernanza MEDIUM — config/operación de infraestructura local académica).

**Non-Goals:**
- NO resolver el puente de Dionaea (ni sidecar, ni scripts, ni cambios de config) — es un change separado futuro.
- NO tocar el change `workflows-n8n` (ni proposal, design, specs, ni tasks).
- NO crear workflows webhook nuevos; solo verificar endpoints.
- NO migrar el esquema de `honeypot_events` (se mantiene `INET NOT NULL`).

## Decisions

### Decisión 1: Diagnóstico de abajo hacia arriba (cadena honeypot → n8n → PostgreSQL)

**Elegido:** Verificar en orden de dependencia: `.env` (Paso 0) → stack healthy (Paso 1) → n8n healthz (Paso 2) → red interna (Paso 3) → inventario de workflows (Paso 4) → endpoints webhook (Paso 5) → emisión real de Cowrie y persistencia (Paso 6).

| Opción | Pro | Contra |
|--------|-----|--------|
| Abajo hacia arriba (elegida) | Cada paso solo se ejecuta si el anterior pasó; errores aislados y trazables | Más pasos que un smoke test global |
| Smoke test global primero | Rápido, una sola corrida | No permite ubicar cuál eslabón de la cadena falla |

**Razón:** El objetivo es DIAGNÓSTICO, no solo "que corra". Si el Paso 6 falla, necesitamos saber si falló el envío, la red, el workflow o la persistencia. Verificar de abajo hacia arriba aísla el eslabón roto y produce evidencia útil para la tesis.

### Decisión 2: `.env` creado local, versionado mediante `.env.example`

**Elegido:** Crear `.env` manualmente en el repo (gitignored) con credenciales reales de desarrollo académico local, y crear/actualizar un `.env.example` versionable con las MISMAS claves y placeholders.

| Opción | Pro | Contra |
|--------|-----|--------|
| `.env` local + `.env.example` en git (elegida) | Credenciales fuera de git; plantilla documenta las claves; reproducible | Dos archivos que pueden desincronizarse |
| `.env` versionado | Simple | Fuga de credenciales; mala práctica de seguridad |
| Solo `.env` local | Simple | Nadie sabe qué variables requiere el compose sin leerlo |

**Razón:** Gobernanza MEDIUM y buenas prácticas: las credenciales reales no van a git (`.env` ya está excluido por `.gitignore` del change archivado `infraestructura-docker`), y `.env.example` documenta el contrato de variables. Verificación objetiva del Paso 0: `docker compose config` NO debe emitir warnings de variables vacías.

### Decisión 3: No resolver Dionaea en este change

**Elegido:** Documentar el hallazgo como dependencia a un change futuro de "puente Dionaea" (sidecar que lea `dionaea.json` local y reenvíe a n8n), SIN implementarlo.

| Opción | Pro | Contra |
|--------|-----|--------|
| Documentar + change futuro (elegida) | Alcance acotado; este change desbloquea el cierre de `workflows-n8n`; el puente es un entregable propio | Dionaea queda mudo por ahora |
| Implementar sidecar acá | Dionaea operativa pronto | Mezcla dos concerns; retrasa el diagnóstico; agrega superficie de bugs |

**Razón:** El puente de Dionaea es un componente de software nuevo (sidecar, lectura de archivo, reenvío HTTP) con ciclo de diseño propio. Meterlo en un change de diagnóstico violaría el principio de un cambio por objetivo y retrasaría el cierre de `workflows-n8n`. Se registra como dependencia documentada con los hallazgos ya verificados (variable no soportada, config escribe a archivo, `submit_http_post` → example.org).

### Decisión 4: Inventario de workflows por export (solo lectura)

**Elegido:** Usar `docker exec -u node soc-n8n n8n export:workflow --all` + revisión en UI para inventariar workflows existentes/activos.

| Opción | Pro | Contra |
|--------|-----|--------|
| CLI export + UI (elegida) | Datos versionables/archivables; verificación cruzada | Requiere n8n corriendo |
| Solo UI | Rápido | No deja evidencia archivable en el repo |

**Razón:** El inventario es insumo directo para saber qué hereda `workflows-n8n`. Exportar da evidencia reproducible y respaldo fuera de la UI (alineado con la decisión "workflows versionables" de `workflows-n8n`).

### Decisión 5: Simulación de ataque real con login SSH a Cowrie

**Elegido:** En el Paso 6 se simula un login SSH al honeypot (vía `docker exec soc-cowrie` o `ssh` externo al puerto mapeado) y se valida con `psql SELECT` que aparece una fila nueva en `honeypot_events`.

| Opción | Pro | Contra |
|--------|-----|--------|
| Login SSH real + SELECT (elegida) | Prueba de extremo a extremo real: honeypot → webhook → workflow → BD | Requiere que Pasos 0-5 hayan pasado |
| Solo POST sintético al webhook | Rápido | No prueba que COWRIE emita, solo que n8n recibe |

**Razón:** El POST sintético del Paso 5 prueba el receptor; el login SSH del Paso 6 prueba al EMISOR. Para cerrar `workflows-n8n` se necesita la cadena completa, y este es el único test de extremo a extremo disponible. Si se descubre que a Dionaea no le llega nada en la cadena real, eso NO se resuelve acá — se documenta como dependencia del change "puente Dionaea".

### Decisión 6: Evidencia documentada de cada paso (gobernanza MEDIUM)

**Elegido:** Cada paso produce evidencia en texto/terminal y se registra su resultado y la razón de cualquier desviación en las notas del change.

**Razón:** Es una tesis académica: la trazabilidad del diagnóstico (qué se probó, qué pasó, qué se decidió y por qué) es parte del entregable. Ningún resultado se asume — se verifica y se anota.

## Risks / Trade-offs

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Puertos del host ocupados (2222/2223, 445/21/80, 5678, 3000, 80/443) | `up -d` falla parcialmente | Verificar ocupación antes del Paso 1; documentar conflicto |
| `src_ip` INET rechaza valores no-IP | Fila no insertada en Paso 6 | El mapeo del workflow (`workflows-n8n`) ya contempla fallback a `'0.0.0.0'`; se verifica el INSERT resultante |
| n8n levanta pero `/healthz` no responde al primer intento | Falso negativo del Paso 2 | Reintentar con `start_period` del healthcheck (60s); esperar `docker compose ps` healthy antes de curl |
| Webhooks devuelven 404 en Paso 5 | Workflows no activos o rutas distintas | Revisar inventario del Paso 4; reportar 404 como hallazgo (no como bloqueo del change) |
| Dionaea no emite nada en la cadena real (Paso 6) | Dionaea documentado como mudo | NO resolver acá; documentar como dependencia del change "puente Dionaea" |
| `.env` con valores inválidos pasa `docker compose config` | Diagnóstico falla en Pasos posteriores | Validar valores concretos (IPs de subred, claves mínimas) al crearlo; `config` solo detecta vacíos, no inválidos |
| `export:workflow` requiere usuario node en contenedor | Comando falla | Usar `docker exec -u node soc-n8n n8n export:workflow --all` (usuario por defecto de la imagen n8nio) |