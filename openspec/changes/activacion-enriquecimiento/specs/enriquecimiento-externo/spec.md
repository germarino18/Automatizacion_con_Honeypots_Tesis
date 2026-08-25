# Enriquecimiento Externo (delta)

## ADDED Requirements

### Requirement: Los nodos de enriquecimiento SHALL autenticarse mediante credenciales genéricas existentes de n8n

Los 4 nodos HTTP de threat-intel SHALL referenciar las credenciales genéricas reales de la instancia viva: "AbuseIPDB Lookup" → `httpHeaderAuth` id `pOftx3uHPzasbso2` ("AbuseIPDB_API"); "Shodan Lookup" → `httpQueryAuth` id `hmmo7081ofRjmfJV` ("Shodan_API"); "VirusTotal Lookup" → `httpHeaderAuth` id `pvp88GzNywM5sois` ("VirusTotal_API"); "WHOIS Domain" → `httpQueryAuth` id `Hk0aMavA8sk8CWIC` ("Whois_API"). Los nodos NO SHALL contener parámetros manuales de autenticación cuyos valores usen expresiones `$credentials[...]["apiKey"]`.

#### Scenario: Petición a AbuseIPDB autenticada y exitosa

- **WHEN** PB-H1 procesa un evento con `src_ip` válido y se inspecciona la salida del nodo "AbuseIPDB Lookup"
- **THEN** la petición incluye el header `Key` inyectado por la credencial `httpHeaderAuth`
- **AND** la respuesta es un cuerpo real de AbuseIPDB (con `data.abuseConfidenceScore`) y no un payload de error 401/403

#### Scenario: Sin expresiones rotas en los JSON versionados

- **WHEN** se inspeccionan `workflows/pb-h1-reconocimiento-v1.0.json` y `workflows/b-h2-ejecucion-comandos-v1.0.json`
- **THEN** ningún nodo contiene la cadena `$credentials[` en sus parámetros de envío (headers/query)
- **AND** los bloques `credentials` de los 4 nodos usan exclusivamente los IDs reales listados arriba

#### Scenario: Referencia a credencial inexistente rechazada

- **WHEN** un nodo de enriquecimiento referencia un id de credencial que no existe en la instancia viva
- **THEN** el cambio NO se considera completo y el PUT no se realiza hasta corregir la referencia

### Requirement: El rewire SHALL preservar los parámetros no-auth y la semántica fail-open

La eliminación de parámetros manuales SHALL limitarse a las entradas de autenticación rota. SHALL conservarse: el header `Accept: application/json` en "AbuseIPDB Lookup"; `sendQuery: true` con el parámetro `domainName` en "WHOIS Domain"; las URLs y expresiones de negocio; los reintentos de "VirusTotal Lookup" (`retryOnFail: true`, `maxTries: 3`, espera entre intentos). Los 4 nodos SHALL mantener `onError: continueRegularOutput`, de modo que un fallo o ausencia de cualquier API externa nunca interrumpa la ingesta, la respuesta 200 del webhook ni la persistencia del evento (Camino B).

#### Scenario: API externa caída durante el procesamiento

- **WHEN** cualquiera de las APIs de enriquecimiento falla o agota reintentos durante una ejecución
- **THEN** la ejecución continúa por la salida regular del nodo afectado
- **AND** el webhook responde 200 y el evento queda persistido en PostgreSQL con enriquecimiento parcial o nulo

#### Scenario: Parámetros de negocio intactos tras el rewire

- **WHEN** se compara el JSON post-edición contra el original
- **THEN** solo cambian los bloques `credentials` y desaparecen las entradas auth manuales listadas en design.md (D1)
- **AND** `Accept`, `domainName`, URLs, reintentos y `onError` permanecen idénticos

### Requirement: La sincronización SHALL preservar IDs de nodos y el estado de activación vivo

La re-sincronización vía `PUT /api/v1/workflows/{id}` (payload `{name,nodes,connections,settings}`) SHALL preservar los IDs de workflows y de todos los nodos. Tras el sync, PB-H1 (`ITqYH4UNwfatkrRS`) SHALL permanecer activo (`active: true`, recibe webhooks de producción) y PB-H2 (`nFnt9n3Gk8Gh27mg`) SHALL permanecer inactivo (sub-workflow invocado vía `executeWorkflowTrigger`).

#### Scenario: Verificación post-sync por API

- **WHEN** se consulta `GET /api/v1/workflows/ITqYH4UNwfatkrRS` y `GET /api/v1/workflows/nFnt9n3Gk8Gh27mg` tras el PUT
- **THEN** PB-H1 reporta `active: true` y PB-H2 reporta `active: false`
- **AND** los IDs de los 4 nodos rewireados (`http-abuseipdb`, `http-shodan`, `http-virustotal`, `http-whois`) permanecen sin cambios

#### Scenario: Auditoría pre-sync de nodos no relacionados

- **WHEN** se comparan los bloques `credentials` de los nodos no-enriquecimiento (Postgres, Slack, Firewall, GLPI) entre el JSON versionado y el workflow vivo
- **THEN** cualquier discrepancia se corrige en el JSON versionado con los valores vivos ANTES de ejecutar el PUT
- **AND** el PUT no introduce referencias de credenciales que no existan en la instancia viva

### Requirement: La verificación E2E SHALL evidenciar enriquecimiento real con persistencia

Un evento Cowrie sintético enviado a `POST /webhook/cowrie` SHALL producir: respuesta HTTP 200, una ejecución en n8n donde los nodos de enriquecimiento reporten éxito con datos reales de las APIs (no errores de autenticación) y una fila nueva en `honeypot_events` en PostgreSQL. La evidencia SHALL registrarse (id de ejecución, salidas de nodos, fila de BD).

#### Scenario: Evento sintético produce evidencia completa

- **WHEN** se envía un POST JSON válido (misma forma que eventos Cowrie reales: `src_ip`, comando, sesión) a `http://localhost:5678/webhook/cowrie`
- **THEN** la respuesta es HTTP 200 con estado `processed`
- **AND** la ejecución correspondiente en `GET /api/v1/executions?limit=10` muestra "AbuseIPDB Lookup"/"Shodan Lookup" con salidas exitosas conteniendo datos reales de reputación
- **AND** existe una fila nueva en `honeypot_events` para el `src_ip` del evento sintético
