# Delta Spec: despliegue-web

## ADDED Requirements

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
