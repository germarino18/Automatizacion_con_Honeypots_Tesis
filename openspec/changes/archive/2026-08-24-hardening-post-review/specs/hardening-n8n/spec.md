# Delta Spec: hardening-n8n

## ADDED Requirements

### Requirement: PB-H2 SHALL consultar reputación de dominios extraídos en VirusTotal

El nodo "VirusTotal Lookup" del workflow PB-H2 (`workflows/b-h2-ejecucion-comandos-v1.0.json`) SHALL consultar el endpoint de reputación de dominios (`GET https://www.virustotal.com/api/v3/domains/{domain}`) iterando sobre los dominios producidos por el nodo "Extraer IOCs" (`extracted_domains`). El nodo NO SHALL construir URLs con campos inexistentes como `file_hash`.

#### Scenario: Reputación de dominio malicioso consultada correctamente

- **WHEN** PB-H2 procesa una sesión Cowrie con comandos maliciosos y "Extraer IOCs" produce `extracted_domains`
- **THEN** el nodo "VirusTotal Lookup" emite una petición por dominio a `https://www.virustotal.com/api/v3/domains/<dominio>` con header `x-apikey`
- **AND** ninguna URL resultante contiene `undefined`

#### Scenario: Sesión sin dominios extraídos

- **WHEN** "Extraer IOCs" no encuentra dominios en la sesión analizada
- **THEN** el nodo VT no realiza peticiones inválidas y la ejecución continúa sin romper la cadena

### Requirement: Los nodos HTTP de los playbooks SHALL reintentar ante fallos transitorios

Los nodos HTTP de PB-H2 ("VirusTotal Lookup"), `webhook-glpi-ticket.json` y `webhook-firewall-block.json` SHALL configurar `retryOnFail: true` con `maxTries: 3` y un `retryWaitTime` definido, de modo que fallos transitorios (timeout, 429/5xx) no interrumpan la cadena de automatización.

#### Scenario: Fallo transitorio recuperado por reintento

- **WHEN** un endpoint HTTP devuelve un error transitorio (p. ej., timeout o 429)
- **THEN** el nodo reintenta automáticamente hasta 3 veces esperando el intervalo configurado entre intentos
- **AND** si un reintento tiene éxito, el flujo continúa normalmente

### Requirement: Los nodos Postgres críticos SHALL tolerar fallos sin detener la cadena

Los nodos Postgres críticos de persistencia (eventos, bloqueos, tickets) SHALL configurar `onError: continueRegularOutput` (o mecanismo equivalente documentado), registrando el fallo en la ejecución sin detener la respuesta automática posterior.

#### Scenario: Fallo puntual de base de datos no rompe la cadena

- **WHEN** un nodo Postgres crítico falla (p. ej., conexión rechazada momentánea)
- **THEN** el workflow continúa con la rama siguiente usando la salida regular
- **AND** el error queda registrado y visible en el historial de ejecuciones de n8n
