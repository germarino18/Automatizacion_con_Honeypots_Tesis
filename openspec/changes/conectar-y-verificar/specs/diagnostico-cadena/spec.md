## ADDED Requirements

### Requirement: El entorno SHALL estar configurado con un `.env` válido
El sistema SHALL contar con un archivo `.env` en la raíz que defina todos los valores requeridos por `docker-compose.yml` (POSTGRES_*, N8N_BASIC_AUTH_*, N8N_ENCRYPTION_KEY, WEBHOOK_URL, COWRIE_*, DIONAEA_*, GRAFANA_*, NETWORK_*). `docker compose config` SHALL resolver el compose SIN warnings de variables vacías.

#### Scenario: compose resuelve con variables definidas
- **WHEN** se ejecuta `docker compose config` con el `.env` presente
- **THEN** el comando no emite warnings de variables vacías
- **AND** cada variable interpolada aparece con un valor no vacío

#### Scenario: resolución falla sin `.env`
- **WHEN** se ejecuta `docker compose config` sin `.env` (o con `.env.example` solo)
- **THEN** se registran warnings/errores por variables no definidas
- **AND** se documenta que el Paso 0 está incompleto

### Requirement: Los servicios del stack SHALL estar levantados y healthy
Todos los servicios definidos en `docker compose up -d` (postgres, n8n, cowrie, dionaea, grafana, nginx) SHALL arrancar y alcanzar el estado operativo. Para los servicios con healthcheck (postgres, n8n, grafana), `docker compose ps` SHALL mostrar estado `healthy`.

#### Scenario: stack completo operativo
- **WHEN** se ejecuta `docker compose up -d`
- **THEN** `docker compose ps` lista los 6 servicios
- **AND** no hay servicios en estado `Exit`, `Restarting` o `Unhealthy`

### Requirement: n8n SHALL responder a healthz desde el host y desde la red interna
El servicio n8n SHALL exponer `GET /healthz` con respuesta HTTP 200, tanto desde el host (`http://localhost:5678/healthz`) como desde los contenedores honeypot por nombre de servicio (`http://n8n:5678/healthz`).

#### Scenario: healthz desde el host
- **WHEN** se ejecuta `curl http://localhost:5678/healthz`
- **THEN** la respuesta es HTTP 200

#### Scenario: salud del endpoint en la red interna
- **WHEN** se ejecuta `docker exec soc-cowrie curl http://n8n:5678/healthz` (o equivalente desde dionaea)
- **THEN** la respuesta es HTTP 200
- **AND** se confirma que los honeypots alcanzan a n8n por nombre de red

### Requirement: El inventario de workflows SHALL registrarse antes de continuar
El sistema SHALL inventariar los workflows existentes y su estado de activación en n8n, tanto por export CLI como por revisión en UI, antes de asumir qué se hereda para `workflows-n8n`.

#### Scenario: exportar workflows activos
- **WHEN** se ejecuta `docker exec -u node soc-n8n n8n export:workflow --all`
- **THEN** se obtiene una lista/archivo de workflows existentes
- **AND** el resultado queda registrado como evidencia del inventario

#### Scenario: cruce con la UI
- **WHEN** se revisa la UI de n8n (`http://localhost:5678`)
- **THEN** los workflows vistos en UI coinciden con el export CLI
- **AND** se registra cuáles están activos

### Requirement: Los endpoints webhook SHALL responder a POST de prueba
Los endpoints `/webhook/cowrie` y `/webhook/dionaea` SHALL recibir un POST de prueba JSON y devolver respuesta HTTP. Una respuesta `200` indica receptor activo (workflow activo); una respuesta `404` indica webhook inexistente o workflow inactivo.

#### Scenario: POST de prueba a /webhook/cowrie
- **WHEN** se ejecuta `curl -X POST -H "Content-Type: application/json" -d '{"test":true}' http://localhost:5678/webhook/cowrie`
- **THEN** se obtiene una respuesta HTTP (200 o 404)
- **AND** el código obtenido se registra como hallazgo

#### Scenario: POST de prueba a /webhook/dionaea
- **WHEN** se ejecuta `curl -X POST -H "Content-Type: application/json" -d '{"test":true}' http://localhost:5678/webhook/dionaea`
- **THEN** se obtiene una respuesta HTTP (200 o 404)
- **AND** el código obtenido se registra como hallazgo

### Requirement: La cadena real de Cowrie SHALL persistir un evento en PostgreSQL
Un login SSH simulado contra Cowrie (vía `docker exec soc-cowrie` o `ssh` externo al puerto mapeado) SHALL producir, a través del workflow webhook y sin cambios de esquema, una fila nueva en la tabla `honeypot_events` de PostgreSQL con `source_honeypot='cowrie'` y `src_ip` válido.

#### Scenario: login SSH simulado genera evento
- **WHEN** se simula un login SSH contra el puerto de Cowrie
- **THEN** el endpoint `/webhook/cowrie` recibe el evento y el workflow lo procesa
- **AND** `psql SELECT ... FROM honeypot_events WHERE source_honeypot='cowrie'` muestra una fila nueva con `src_ip` válido (INET)

#### Scenario: ausencia de evento por emisor mudo
- **WHEN** tras la simulación no aparece fila nueva (o Dionaea no emite nada)
- **THEN** se documenta el hallazgo (emisor con webhook no soportado / workflow no activo)
- **AND** NO se implementa solución en este change; se registra como dependencia del change "puente Dionaea"

### Requirement: La limitación de emisión de Dionaea SHALL documentarse como dependencia
El hallazgo de que `DIONAEA_OUTPUT_ENDPOINT` no es soportada por la imagen oficial `dinotools/dionaea` (que además versiona config con salida a archivo local y `submit_http_post` hacia example.org) SHALL quedar documentado como dependencia a un change futuro, sin implementar sidecar ni scripts en este change.

#### Scenario: registro del hallazgo como dependencia
- **WHEN** se confirma en la documentación oficial que la imagen no soporta la variable de envío HTTP
- **THEN** la limitación queda registrada en este change como dependencia/ conocimiento
- **AND** el change "puente Dionaea" (sidecar lector de `dionaea.json` → reenvío a n8n) queda referenciado como paso futuro