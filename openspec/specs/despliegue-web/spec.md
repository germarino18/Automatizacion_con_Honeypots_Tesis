## Purpose
El despliegue SHALL levantar la consola web del SOC (`api` + `web` + `nginx` + `postgres`) en docker-compose, con credenciales por entorno sin literales, servicios de administración expuestos solo en loopback, control de egress deny-by-default en el host, quickstart de `.env` y verificación end-to-end.

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

### Requirement: Los servicios de administración SHALL exponerse solo en loopback

En `docker-compose.yml`, los servicios de administración n8n y Grafana SHALL publicar sus puertos vinculados a `127.0.0.1` (`"127.0.0.1:5678:5678"` y `"127.0.0.1:${GRAFANA_PORT:-3000}:3000"`). Los puertos del experimento (honeypots 21, 2222-2223, 8080, 4445, 1433 y nginx 80/443) SHALL permanecer públicos en todas las interfaces.

#### Scenario: Bind de administración restringido a localhost

- **WHEN** se ejecuta `docker compose up -d` y se inspecciona `docker ps`
- **THEN** n8n aparece como `127.0.0.1:5678->5678` y Grafana como `127.0.0.1:<puerto>->3000`

#### Scenario: Puertos del experimento intactos

- **WHEN** un atacante escanea las interfaces públicas de la VM
- **THEN** los puertos honeypot (21, 2222-2223, 8080, 4445, 1433) y nginx (80/443) siguen accesibles
- **AND** los puertos 5678 (n8n) y el de Grafana NO responden desde fuera de la VM

#### Scenario: Acceso legítimo del investigador preservado

- **WHEN** el investigador accede desde la propia VM o vía túnel SSH / proxy nginx existente (`/grafana/`)
- **THEN** la UI de n8n y Grafana sigue siendo alcanzable

### Requirement: El host SHALL aplicar control de egress deny-by-default con allowlist

El repositorio SHALL incluir `firewall/setup-ufw.sh` que configure UFW con `default deny outgoing`, una allowlist saliente explícita (DNS 53/tcp+udp, HTTPS 443/tcp hacia APIs externas), SSH entrante permitido antes de habilitar el firewall, y los puertos del experimento abiertos entrantes. Cada regla SHALL estar explicada en `docs/firewall.md`.

#### Scenario: Script aplica política de egress por defecto denegada

- **WHEN** se ejecuta `firewall/setup-ufw.sh` en la VM
- **THEN** `ufw status verbose` muestra `default deny outgoing` junto con las reglas de allowlist activas

#### Scenario: Allowlist permite DNS y HTTPS salientes

- **WHEN** tras aplicar el firewall el stack resuelve dominios y llama a APIs HTTPS (VirusTotal/GLPI)
- **THEN** las consultas DNS (53/tcp+udp) y HTTPS (443/tcp) salientes tienen éxito

#### Scenario: Tráfico saliente no autorizado bloqueado

- **WHEN** un proceso comprometido intenta conectar a un puerto arbitrario distinto del allowlist
- **THEN** la conexión saliente es rechazada por UFW

#### Scenario: Documentación defendible

- **WHEN** se revisa `docs/firewall.md`
- **THEN** cada regla del script tiene su justificación ética/metodológica alineada con la tesis

### Requirement: El quickstart SHALL incluir la configuración previa de `.env`

El README SHALL documentar el paso `cp .env.example .env` entre la clonación del repositorio y `docker compose up -d`, con una nota breve de las variables obligatorias, de modo que un lector nuevo pueda levantar el stack completo sin pasos ocultos.

#### Scenario: Quickstart reproducible de cero

- **WHEN** un usuario sigue el quickstart del README literalmente desde `git clone`
- **THEN** encuentra explícitamente el paso `cp .env.example .env` antes de `docker compose up -d`
- **AND** el stack levanta con todas sus variables configuradas

### Requirement: La documentación SHALL usar placeholders no triviales en ejemplos de credenciales

Los bloques de ejemplo de Variables de Entorno del README SHALL usar placeholders no triviales (p. ej., `cambia-esta-clave-segura`) en lugar de literales débiles como `password` o `admin`.

#### Scenario: Sin literales triviales en ejemplos

- **WHEN** se inspeccionan los bloques de ejemplo del README
- **THEN** ninguna credencial de ejemplo es un valor trivial conocido (`password`, `admin`)
- **AND** cada placeholder indica claramente que debe sustituirse