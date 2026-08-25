# Proposal: activacion-enriquecimiento

## Why

La rama de enriquecimiento paralela del Camino B nunca funcionó autenticada: los 4 nodos HTTP de threat-intel referencian IDs de credenciales inexistentes (`abuseipdb-cred-001`, `shodan-cred-001`, `virustotal-cred-001`, `whois-cred-001`) y usan expresiones `$credentials["X"]["apiKey"]` que NO pueden resolver contra las credenciales genéricas reales de n8n (`httpHeaderAuth` almacena `{name,value}` de header; `httpQueryAuth` `{name,value}` de query param — ningún tipo tiene campo `apiKey`). Resultado: las peticiones salen sin autenticación, las APIs devuelven 401/403 y el error se traga silenciosamente por `onError: continueRegularOutput`, degradando el risk score a solo-heurística sin que nadie lo note. Las credenciales reales ya existen en la instancia viva de n8n (IDs verificados vía `GET /api/v1/credentials`): es el momento de cablearlas y validar el enriquecimiento end-to-end.

## What Changes

- **PB-H1** (`workflows/pb-h1-reconocimiento-v1.0.json`):
  - Nodo **"AbuseIPDB Lookup"**: eliminar el parámetro manual de header `Key` con expresión rota `$credentials["AbuseIPDB_API"]["apiKey"]`, conservando el header `Accept: application/json` y todo lo demás (URL, query params `ipAddress`/`maxAgeInDays`, `onError`). Rewirear credenciales a la real: `httpHeaderAuth` id `pOftx3uHPzasbso2` ("AbuseIPDB_API", header `Key` configurado).
  - Nodo **"Shodan Lookup"**: eliminar `sendQuery`/`queryParameters` completos (su único parámetro era el key roto); la autenticación la inyecta la credencial genérica. Rewirear a `httpQueryAuth` id `hmmo7081ofRjmfJV` ("Shodan_API", param `key` configurado).
- **PB-H2** (`workflows/b-h2-ejecucion-comandos-v1.0.json`):
  - Nodo **"VirusTotal Lookup"**: eliminar el parámetro manual de header `x-apikey` con expresión rota; conservar URL por dominio, `retryOnFail/maxTries/waitBetweenTries` y `onError`. Rewirear a `httpHeaderAuth` id `pvp88GzNywM5sois` ("VirusTotal_API", header `x-apikey` configurado).
  - Nodo **"WHOIS Domain"**: eliminar SOLO la entrada `apiKey` de `queryParameters` (conservar `domainName` y `sendQuery: true`, que son parámetros de negocio). Rewirear a `httpQueryAuth` id `Hk0aMavA8sk8CWIC` ("Whois_API", param `apiKey` configurado).
- Re-sincronizar ambos workflows al n8n vivo vía `PUT /api/v1/workflows/{id}` preservando node IDs: PB-H1 (`ITqYH4UNwfatkrRS`) debe permanecer ACTIVO (recibe webhooks de producción); PB-H2 (`nFnt9n3Gk8Gh27mg`) permanece inactivo (sub-workflow vía executeWorkflowTrigger).
- Verificación E2E: evento Cowrie sintético a `/webhook/cowrie` → HTTP 200 → inspección de ejecución vía API (nodos de enriquecimiento con salida real, no payloads de error) y fila persistida en PostgreSQL.
- Toque de documentación si existe mención del enriquecimiento pendiente de activación (README sección ~línea 144).

Sin cambios breaking: la ruta crítica sigue respondiendo 200 y persistiendo siempre; cada nodo de enriquecimiento conserva `onError: continueRegularOutput` (fail-open intacto).

## Capabilities

### New Capabilities

- `enriquecimiento-externo`: contrato del enriquecimiento externo autenticado de threat-intel (AbuseIPDB, Shodan, VirusTotal, WhoisFreaks) en los playbooks PB-H1/PB-H2: credenciales genéricas de n8n (`httpHeaderAuth`/`httpQueryAuth`) como único mecanismo de autenticación, sin duplicación manual de parámetros auth en los nodos, y semántica fail-open (un fallo de API nunca rompe la ingesta ni la respuesta 200).

### Modified Capabilities

(ninguna — los requisitos de `hardening-n8n` permanecen satisfechos: el lookup VT sigue consultando `/api/v3/domains/{domain}` con header `x-apikey` enviado —ahora inyectado por credencial— y conservando reintentos; no hay cambio de comportamiento a nivel de especificación.)

## Impact

- **Archivos modificados**: `workflows/pb-h1-reconocimiento-v1.0.json` (nodos "AbuseIPDB Lookup" ~líneas 38-85 y "Shodan Lookup" ~líneas 86-116), `workflows/b-h2-ejecucion-comandos-v1.0.json` (nodos "VirusTotal Lookup" ~líneas 75-108 y "WHOIS Domain" ~líneas 109-143).
- **Instancia viva**: re-sincronización vía `PUT http://localhost:5678/api/v1/workflows/{id}` con header `X-N8N-API-KEY` (valor de `N8N_API_KEY` en `.env`, jamás commiteado), payload `{name,nodes,connections,settings}`. El payload no incluye `active`, por lo que el estado de activación vivo queda intacto (PB-H1 activo, PB-H2 inactivo).
- **Credenciales**: solo nombres e IDs en repo/código. Los valores de las claves viven exclusivamente dentro de n8n. La credencial nativa sobrante "VirusTotal account" (`xl5MgqU88YomT0QR`, tipo `virusTotalApi`) queda intocada y sin uso.
- **Sin cambios**: API FastAPI (`api/`), sidecar, `docker-compose.yml`, esquema Postgres, integraciones placeholder Slack/GLPI/Firewall (siguen fuera de alcance), specs de otras capacidades.
- **Cuotas**: una única petición sintética E2E está holgadamente dentro del free tier (AbuseIPDB permite 1000/día; VT ~4 req/min).
