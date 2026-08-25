# Design: activacion-enriquecimiento

## Context

Verificación directa sobre los JSON versionados y la instancia viva de n8n:

| Nodo | Workflow | Expresión rota actual | Credencial real verificada (GET /api/v1/credentials) |
|------|----------|----------------------|------------------------------------------------------|
| "AbuseIPDB Lookup" (`http-abuseipdb`) | PB-H1 `ITqYH4UNwfatkrRS` | header `Key` = `$credentials["AbuseIPDB_API"]["apiKey"]` (~líneas 58-61) + `credentials.httpHeaderAuth.id = abuseipdb-cred-001` (inexistente) | `pOftx3uHPzasbso2`, tipo `httpHeaderAuth`, header configurado `Name=Key` |
| "Shodan Lookup" (`http-shodan`) | PB-H1 | query param `key` = `$credentials["Shodan_API"]["apiKey"]` (~líneas 91-98) + `shodan-cred-001` | `hmmo7081ofRjmfJV`, tipo `httpQueryAuth`, param `name=key` |
| "VirusTotal Lookup" (`http-virustotal`) | PB-H2 `nFnt9n3Gk8Gh27mg` | header `x-apikey` = `$credentials["VirusTotal_API"]["apiKey"]` (~líneas 79-87) + `virustotal-cred-001` | `pvp88GzNywM5sois`, tipo `httpHeaderAuth`, header `Name=x-apikey` |
| "WHOIS Domain" (`http-whois`) | PB-H2 | query param `apiKey` = `$credentials["Whois_API"]["apiKey"]` (~líneas 113-125, junto a `domainName`) + `whois-cred-001` | `Hk0aMavA8sk8CWIC`, tipo `httpQueryAuth`, param `name=apiKey` |

Por qué está roto: las credenciales reales son tipos GENÉRICOS de n8n. `httpHeaderAuth` almacena `{name, value}` del header y `httpQueryAuth` `{name, value}` del query param — ningún tipo expone un campo `apiKey`. La expresión `$credentials["X"]["apiKey"]` resuelve a vacío, así que la petición sale sin autenticación → 401/403 → `onError: continueRegularOutput` se traga el fallo silenciosamente. El fail-open del Camino B hizo invisible la avería: la ruta crítica siempre respondió 200 y persistió, pero el risk score se calculó solo con heurística de comando.

Estado relevante adicional:
- Convención de sync establecida: el JSON versionado es fuente de verdad; se sincroniza con `PUT http://localhost:5678/api/v1/workflows/{id}` + header `X-N8N-API-KEY` (`N8N_API_KEY` del `.env`, jamás commiteado), payload `{name,nodes,connections,settings}`, preservando IDs.
- El payload del PUT NO incluye el campo `active`: la API pública gestiona la activación por separado, por lo que el PUT por sí solo no puede desactivar PB-H1.
- Existe una credencial nativa sobrante "VirusTotal account" (`xl5MgqU88YomT0QR`, tipo `virusTotalApi`) que queda intocada y sin uso.
- README línea 166 lista "Enriquecimiento de IPs" como funcionalidad; línea 144 menciona `N8N_API_KEY`. Un grep de `docs/` + README no encontró ninguna mención explícita de "enriquecimiento pendiente de activación".

## Goals / Non-Goals

**Goals:**

- Que los 4 nodos de enriquecimiento emitan peticiones AUTENTICADAS usando las credenciales genéricas vivas (IDs verificados).
- Eliminar la duplicación manual de auth dañina (expresiones imposibles) sin tocar parámetros de negocio.
- Preservar intacto el fail-open (`onError: continueRegularOutput`) y la respuesta 200 garantizada del Camino B.
- Evidencia E2E: ejecución real con datos de AbuseIPDB/Shodan + fila en PostgreSQL.
- Mantener PB-H1 activo y PB-H2 inactivo durante y después del sync.

**Non-Goals:**

- No implementar integraciones placeholder Slack/GLPI/Firewall (siguen con URLs de ejemplo y sus credenciales placeholder fuera de alcance).
- No tocar `api/` FastAPI, sidecar, `docker-compose.yml`, esquema Postgres ni specs de otras capacidades.
- No eliminar ni modificar la credencial nativa sobrante "VirusTotal account".
- No renombrar workflows, nodos ni cambiar IDs.
- No ampliar el hardening (p. ej., añadir `onError` al nodo "PostgreSQL Auditoría" de PB-H1 — se documenta como mejora futura).

## Decisions

### D1 — Inyección automática por credencial genérica en vez de parámetros manuales

Las credenciales genéricas `httpHeaderAuth`/`httpQueryAuth` inyectan automáticamente su header/query-param configurado en los nodos `httpRequest` en runtime. La duplicación manual no es solo innecesaria: era activamente dañina porque sus expresiones no podían resolver. Ediciones exactas por nodo:

| Workflow | Nodo | ELIMINAR | CONSERVAR | Bloque credentials final |
|----------|------|----------|-----------|--------------------------|
| PB-H1 | "AbuseIPDB Lookup" | entrada `Key` dentro de `headerParameters.parameters` | `sendHeaders: true` + header `Accept: application/json`; query `ipAddress`/`maxAgeInDays`; URL; `onError` | `httpHeaderAuth {id: "pOftx3uHPzasbso2", name: "AbuseIPDB_API"}` |
| PB-H1 | "Shodan Lookup" | `sendQuery: true` y `queryParameters` COMPLETOS (su único parámetro era el key roto) | URL con expresión `src_ip`; `options`; `onError` | `httpQueryAuth {id: "hmmo7081ofRjmfJV", name: "Shodan_API"}` |
| PB-H2 | "VirusTotal Lookup" | `sendHeaders: true` y `headerParameters` COMPLETOS (único header era `x-apikey` roto) | URL por dominio; `retryOnFail/maxTries/waitBetweenTries`; `onError` | `httpHeaderAuth {id: "pvp88GzNywM5sois", name: "VirusTotal_API"}` |
| PB-H2 | "WHOIS Domain" | SOLO la entrada `apiKey` de `queryParameters.parameters` | `sendQuery: true` + parámetro `domainName` (negocio); URL; `onError` | `httpQueryAuth {id: "Hk0aMavA8sk8CWIC", name: "Whois_API"}` |

Los type keys de credencial ya declarados por cada nodo (`httpHeaderAuth` para AbuseIPDB/VirusTotal, `httpQueryAuth` para Shodan/Whois — verificado leyendo ambos JSON) coinciden con el tipo real de cada credencial viva; solo cambian `id` (y `name` ya coincide). Si el type key no coincidiera con el tipo real, n8n rechazaría el binding en el PUT.

**Alternativas descartadas:** (a) conservar headers manuales pero "arreglar" la expresión — imposible: los tipos genéricos no exponen campos nombrados a `$credentials`; (b) usar la credencial nativa `virusTotalApi` — solo cubre VT, dirección deprecada y obligaría a mezclar mecanismos.

### D2 — Sync preservando estado de activación

El payload `{name,nodes,connections,settings}` excluye `active`, así que el PUT no altera la activación vigente: PB-H1 sigue activo (webhooks de producción) y PB-H2 sigue inactivo (se invoca vía `executeWorkflowTrigger`). Verificación post-sync obligatoria con `GET /api/v1/workflows/{id}` de ambos.

**Hallazgo cosmético documentado:** el JSON versionado de PB-H2 declara `"active": true` en su metadata mientras la instancia viva lo tiene inactivo (es sub-workflow). Como el campo no viaja en el PUT, es solo ruido documental; se permite alinearlo a `false` en el archivo como limpieza opcional de bajo riesgo, sin efecto funcional.

### D3 — Auditoría pre-sync de credenciales NO relacionadas (riesgo principal)

El PUT sobrescribe TODOS los nodos con el contenido del repo. Si el JSON versionado contiene refs de credenciales obsoletas en nodos que HOY funcionan vivos (sospecha concreta: `postgres-cred-001` en "PostgreSQL Auditoría" de ambos workflows; también `slack-cred-001`/`firewall-cred-001`/`glpi-cred-001`), el PUT rompería referencias que hoy resuelven. Mitigación OBLIGATORIA antes del primer PUT:

1. `GET /api/v1/workflows/ITqYH4UNwfatkrRS` y `GET /api/v1/workflows/nFnt9n3Gk8Gh27mg` → extraer los bloques `credentials` vivos de todos los nodos.
2. Cruzar contra el JSON versionado; cualquier nodo no-enriquecimiento cuya ref difiera se actualiza EN EL REPO al valor vivo antes del PUT (el repo queda fuente de verdad Y truthful).
3. Confirmar vía `GET /api/v1/credentials` que los 4 IDs objetivo existen y son del tipo esperado.

Nota: PB-H1 "PostgreSQL Auditoría" carece de `onError` (a diferencia de su par en PB-H2): si su credencial quedara rota tras el sync, el webhook no respondería. Por eso la auditoría pre-sync + E2E post-sync son obligatorias, y ampliar ese nodo queda explícitamente fuera de alcance (mejora futura).

### D4 — Protocolo de verificación E2E

1. `POST http://localhost:5678/webhook/cowrie` con evento sintético de la misma forma usada en sesiones previas (`src_ip` público válido, comando, sesión). Se espera HTTP 200 `{"status":"processed",...}` — la respuesta llega desde "Responder Webhook", así que un 200 implica cadena completa OK.
2. `GET http://localhost:5678/api/v1/executions?limit=10` con `X-N8N-API-KEY` → localizar la ejecución, confirmar que "AbuseIPDB Lookup"/"Shodan Lookup" tienen salida exitosa con cuerpos reales (p. ej. `data.abuseConfidenceScore`, campos Shodan) y NO payloads 401/error.
3. Opcional de confirmación: `docker exec soc-postgres psql -U <user> -d <db> -c "SELECT id, src_ip, risk_score FROM honeypot_events ORDER BY id DESC LIMIT 1"` para ver la fila persistida.
4. Una sola petición sintética: holgadamente dentro del free tier (AbuseIPDB 1000/día, VT ~4 req/min).

### D5 — Documentación

No existe mención explícita de "enriquecimiento pendiente" en README/docs (verificado). Toque mínimo: nota breve en README (zona Funcionalidades ~línea 166 o Variables ~línea 144) indicando que el enriquecimiento usa credenciales genéricas de n8n y que las claves nunca viven en el repo. Solo eso; nada de documentación extensa nueva.

## Risks / Trade-offs

- [PUT sobrescribe refs de credenciales vivas con valores obsoletos del repo] → auditoría pre-sync D3 obligatoria; corregir en repo antes del PUT.
- [PB-H1 "PostgreSQL Auditoría" sin onError] → mitigado por D3 + E2E que prueba persistencia post-sync; mejora futura documentada, fuera de alcance.
- [Credencial mal configurada en origen (nombre de header/param incorrecto)] → los nombres fueron verificados en GET /api/v1/credentials (`Key`, `key`, `x-apikey`, `apiKey`); el E2E confirma respuestas 200 de las APIs reales.
- [Quota de free tier en pruebas repetidas] → una única petición sintética; si hay que repetir, esperar o rotar IP de prueba; AbuseIPDB 1000/día.
- [PUT pisa ajustes manuales hechos en la instancia viva] → convención ya establecida: repo = fuente de verdad; D3 hace el repo truthful antes de pisar.
- [Fail-open sigue ocultando fallos futuros de auth] → aceptado por diseño (Camino B); el E2E deja evidencia tangible de que HOY funciona; la consola SOC muestra errores de ejecución si reaparecen.
- [`sendQuery: true` residual en WHOIS] → intencional: `domainName` es parámetro de negocio; solo se elimina la entrada `apiKey`.

## Migration Plan

1. Rewirear PB-H1 JSON (D1) → validar sintaxis JSON (`ConvertFrom-Json`).
2. Auditoría pre-sync (D3): GET workflows vivos + GET credentials → corregir en repo cualquier ref obsoleta no-enriquecimiento.
3. Rewirear PB-H2 JSON (D1) → validar sintaxis.
4. PUT ambos workflows → GET de verificación (active flags + nodos actualizados + IDs intactos).
5. E2E (D4) → capturar evidencia (id ejecución, salidas de nodos, fila BD).
6. Toque de README (D5).
7. Ritual de cierre de sesión (engram sync → commit → push) — ítem final del checklist.

**Rollback:** `git checkout` de los dos JSON + re-PUT de la versión previa (recuperable de git). Peor caso realista: volver a peticiones sin autenticación — sin outage, porque el fail-open nunca interrumpe la ingesta.

## Open Questions

Ninguna bloqueante. Quedan registradas como mejoras futuras: añadir `onError: continueRegularOutput` al "PostgreSQL Auditoría" de PB-H1, y la limpieza cosmética del campo `"active"` en el JSON versionado de PB-H2.
