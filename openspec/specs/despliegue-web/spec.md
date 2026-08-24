## Requirements

### Requirement: El servicio `api` SHALL desplegarse en docker-compose
El servicio `api` (container `soc-api`) SHALL agregarse a `docker-compose.yml` con imagen construida desde `api/` (Python + FastAPI), en la red `red_interna`, con `depends_on` a `postgres` (healthy) y expuesto solo a la red interna (no publica puerto al host salvo configuración explícita de desarrollo).

#### Scenario: El contenedor api arranca y queda healthy
- **WHEN** se ejecuta `docker compose up -d`
- **THEN** el contenedor `soc-api` queda en estado `running`/`healthy`
- **AND** su healthcheck (si aplica) responde OK

#### Scenario: La API alcanza PostgreSQL
- **WHEN** la API ejecuta una consulta de prueba a `postgres:5432` por nombre de servicio
- **THEN** la conexión es exitosa y la consulta devuelve datos de `honeypot_events`

#### Scenario: Variables de entorno mínimas
- **WHEN** se inspecciona el servicio `api` en compose
- **THEN** recibe `POSTGRES_*`, `SOC_ADMIN_USER`, `SOC_ADMIN_PASSWORD`, `SOC_JWT_SECRET`, `N8N_API_KEY` y `N8N_INTERNAL_URL` desde el entorno
- **AND** ningún valor de credencial aparece como literal en el repositorio

### Requirement: El servicio `web` SHALL construir y servir la SPA
El servicio `web` (container `soc-web`) SHALL construir la aplicación React (build de producción) y servirla, ya sea vía un servidor estático propio o dejando los artefactos en un volumen compartido con nginx.

#### Scenario: Build de producción exitoso
- **WHEN** se ejecuta el build del frontend
- **THEN** se generan los artefactos estáticos (HTML/JS/CSS) sin errores

#### Scenario: La SPA se sirve por HTTP
- **WHEN** se consulta la ruta raíz de la app servida
- **THEN** se devuelve el `index.html` de la SPA y los assets estáticos

#### Scenario: Fallback de rutas SPA
- **WHEN** se navega a una ruta interna de la SPA (ej. `/eventos`) directamente
- **THEN** el servidor devuelve `index.html` (fallback) y el router la resuelve en cliente

### Requirement: nginx SHALL rutear el tráfico de la consola web
El `nginx.conf` SHALL actualizarse para: servir la SPA en `/`, proxear `/api/` hacia `soc-api` (puerto interno), mantener `/webhook/` hacia n8n (sin buffering para webhooks) y mantener `/grafana/` hacia Grafana. NO SHALL romperse el acceso existente a n8n y Grafana.

#### Scenario: La raíz sirve la SPA
- **WHEN** se consulta `http://localhost/`
- **THEN** nginx devuelve el `index.html` de la consola web

#### Scenario: Proxy del API
- **WHEN** se consulta `http://localhost/api/v1/overview` con sesión válida
- **THEN** nginx proxea la petición a `soc-api` y devuelve la respuesta JSON

#### Scenario: Webhooks de n8n intactos
- **WHEN** el sidecar o una herramienta POSTea a `http://localhost/webhook/cowrie`
- **THEN** nginx proxea a n8n y la cadena existente sigue funcionando

#### Scenario: Grafana intacto
- **WHEN** se consulta `http://localhost/grafana/`
- **THEN** nginx proxea a Grafana y los dashboards siguen disponibles

#### Scenario: SSE sin buffering
- **WHEN** un cliente se suscribe a `http://localhost/api/v1/events/live` (SSE)
- **THEN** nginx NO bufferiza la respuesta (`proxy_buffering off` o equivalente) y el stream fluye en tiempo real

### Requirement: Las credenciales SHALL referenciarse por entorno sin literales
Toda credencial nueva (admin SOC, JWT secret) SHALL definirse en `.env` y `.env.example` por nombre de variable (`SOC_ADMIN_USER`, `SOC_ADMIN_PASSWORD`, `SOC_JWT_SECRET`) y consumirse por referencia en compose. NO SHALL commitearse valores reales en el repositorio.

#### Scenario: `.env.example` documenta las variables nuevas
- **WHEN** se inspecciona `.env.example`
- **THEN** contiene las variables nuevas vacías/placeholder con comentario de uso

#### Scenario: Ningún secreto literal en el repo
- **WHEN** se ejecuta una búsqueda de credenciales sobre los archivos nuevos
- **THEN** no se encuentran valores reales de password/secret (solo referencias `${VAR}`)

### Requirement: La verificación end-to-end SHALL validar la consola web
El change SHALL incluir una verificación integral: `docker compose up -d`, login en la consola, carga del dashboard con datos reales, suscripción en vivo, exploración/exportación y una acción de automatización (simulación) cuyo evento termine visible en el feed.

#### Scenario: Cadena completa operativa
- **WHEN** se levanta el stack completo y se realiza login en la consola
- **THEN** el dashboard muestra métricas reales de `honeypot_events`
- **AND** una simulación de ataque desde la UI produce un evento nuevo visible en Ataques en Vivo y en el Explorador

#### Scenario: Regresión del stack existente
- **WHEN** tras el deploy se ejecutan las verificaciones de `diagnostico-cadena` (healthz, webhooks, persistencia)
- **THEN** los resultados siguen siendo válidos (ningún servicio existente se degradó)