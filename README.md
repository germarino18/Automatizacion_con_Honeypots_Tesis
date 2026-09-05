
# Automaticacion_n8n_honeypots

## Objetivos

* Capturar ataques reales
* Automatizar análisis de eventos
* Enriquecer inteligencia de amenazas
* Reducir MTTD y MTTR
* Correlacionar eventos con MITRE ATT&CK
* Generar inteligencia táctica

---

## Arquitectura

Componentes principales:

* Cowrie Honeypot
* Dionaea Honeypot
* n8n Orchestrator
* PostgreSQL
* Docker
* MITRE ATT&CK Mapping

---

## Tecnologías Utilizadas

| Tecnología   | Propósito             |
| ------------ | --------------------- |
| Docker       | Contenerización       |
| n8n          | Automatización SOAR   |
| PostgreSQL   | Persistencia          |
| Cowrie       | Honeypot SSH/Telnet   |
| Dionaea      | Captura de malware    |
| MITRE ATT&CK | Clasificación táctica |

---

## Grafana (Visualización)

### Acceso

* URL: `http://localhost:${GRAFANA_PORT:-3000}`
* Credenciales de administrador: variables `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` del archivo `.env`

### Provisioning (GitOps)

Grafana se aprovisiona desde archivos versionados (sin configuración manual por la UI):

| Recurso            | Ruta en el repo                                                          | Montaje en el contenedor                            |
| ------------------ | ------------------------------------------------------------------------ | --------------------------------------------------- |
| Datasource         | `grafana/provisioning/datasources/postgres.yml`                          | `/var/lib/grafana/provisioning/datasources/`        |
| Provider de dashboards | `grafana/provisioning/dashboards/dashboards.yml`                     | `/var/lib/grafana/provisioning/dashboards/`         |
| Dashboards (JSON)  | `grafana/dashboards/*.json`                                              | `/var/lib/grafana/dashboards/`                      |

El provider `honeypots` escanea `/var/lib/grafana/dashboards` cada `updateIntervalSeconds` (30 s): cualquier edición de un JSON se refleja en la UI sin reiniciar el contenedor.

### Dashboards disponibles

| Dashboard              | UID           | Descripción                                                        |
| ---------------------- | ------------- | ------------------------------------------------------------------ |
| SOC Overview           | `soc-overview` | Totales, eventos por honeypot, serie temporal, top IPs, riesgo      |
| MITRE ATT&CK           | `mitre-attack` | Frecuencia de técnicas y detalle, filtrable por técnica              |
| Origen geográfico      | `geo-origen`   | Mapa Geomap por país (best-effort) + top países + fallback a IPs     |
| Malware / IoC          | `malware-ioc`  | Hashes de malware (EICAR) y detalle de capturas de Dionaea           |

### Cómo agregar un dashboard

1. Crear el JSON en `grafana/dashboards/` (el dashboard debe definir un `uid` único, ej. `mi-dashboard`).
2. Esperar el re-escaneo (≤ 30 s) o reiniciar con `docker compose restart grafana`.
3. Consultar vía API: `GET /api/search?type=dash-db` (autorización basic con `GRAFANA_ADMIN_USER`/`GRAFANA_ADMIN_PASSWORD`).

### Credenciales del datasource (mecanismo por entorno)

El datasource PostgreSQL referencia las credenciales **por nombre de variable** y Grafana las resuelve en runtime desde el entorno del contenedor:

```yaml
user: ${POSTGRES_USER}
secureJsonData:
  password: ${POSTGRES_PASSWORD}
```

Las variables `POSTGRES_USER`, `POSTGRES_PASSWORD` y `POSTGRES_DB` se inyectan al servicio `grafana` en `docker-compose.yml` (bloque `environment`). **Nunca** se commitean valores literales de credenciales en el repo.

### Verificación rápida

```bash
# Datasource registrado
curl -u "$GRAFANA_ADMIN_USER:$GRAFANA_ADMIN_PASSWORD" "http://localhost:${GRAFANA_PORT:-3000}/api/datasources"

# Dashboards aprovisionados
curl -u "$GRAFANA_ADMIN_USER:$GRAFANA_ADMIN_PASSWORD" "http://localhost:${GRAFANA_PORT:-3000}/api/search?type=dash-db"
```

---

## Consola Web SOC

Interfaz web (SPA React) que consume la API del SOC (`soc-api`) para visualizar la telemetría de los honeypots y ejecutar acciones de respuesta automatizada a través de n8n.

### Acceso

* URL: `http://localhost/` (servida por nginx)
* Login: usuario y contraseña definidos en las variables `SOC_ADMIN_USER` / `SOC_ADMIN_PASSWORD` del archivo `.env` (la sesión se emite como cookie JWT `HttpOnly` firmada con `SOC_JWT_SECRET`, expiración 8 h)

### Arquitectura

```
browser → nginx :80 → soc-web (SPA estática)
                    → /api/  → soc-api (FastAPI) → PostgreSQL
                                                → n8n (workflows de respuesta)
```

* `nginx` enruta `location /` al build estático (`soc-web`) y `location /api/` a la API (`soc-api`), sin exponer puertos de estos servicios al host.
* La API lee directamente de PostgreSQL y delega las acciones de automatización a los webhooks de n8n (`/webhook/cowrie`, `/webhook/dionaea`, `/webhook/firewall-block`, `/webhook/glpi-ticket`).
* El feed de *Ataques en Vivo* usa SSE (`GET /api/v1/events/live`) con fallback automático a polling.

### Pantallas

| Pantalla                  | Ruta             | Contenido                                                                 |
| ------------------------- | ---------------- | ------------------------------------------------------------------------- |
| Resumen del SOC           | `/`              | Total de ataques, alertas críticas, IPs únicas, MTTD/MTTR, top atacantes   |
| Ataques en Vivo           | `/live`          | Feed SSE de eventos en tiempo real, indicador eventos/seg, amenaza activa  |
| Explorador de Eventos     | `/eventos`       | Filtros, paginación, exportación CSV, detalle con `raw_data` y respuestas  |
| Matriz MITRE ATT&CK       | `/mitre`         | Técnicas detectadas agrupadas por táctica                                  |
| Mapa Geográfico           | `/mapa`          | Origen geográfico de los ataques (mapa vectorial offline)                  |
| Malware & IoC             | `/malware`       | Hashes únicos capturados por Dionaea y tabla de IoCs                       |
| Automatización y Respuesta| `/automatizacion`| Estado de workflows y ejecuciones n8n, historial de respuestas             |

Desde **Automatización** se disparan tres acciones sobre n8n: simular ataque (cowrie/dionaea), bloquear IP (firewall) y crear ticket GLPI; cada acción queda registrada en la tabla `responses`.

### Variables de entorno

Nuevas para la consola (en `.env`; `.env.example` incluye placeholders vacíos):

```env
SOC_ADMIN_USER=
SOC_ADMIN_PASSWORD=
SOC_JWT_SECRET=
```

`N8N_API_KEY` y `POSTGRES_*` ya existían para el stack anterior y son reutilizadas por la API.

### Verificación rápida

```bash
# Salud de la API (público)
curl http://localhost/api/v1/health

# Login (guarda la cookie de sesión)
curl -c cookies.txt -X POST http://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$SOC_ADMIN_USER\",\"password\":\"$SOC_ADMIN_PASSWORD\"}"

# Métricas del overview (autenticado)
curl -b cookies.txt http://localhost/api/v1/overview
```

---

## GLPI (SIEM de Tickets — integración real)

GLPI es el ITSM/SIEM de tickets del stack. La acción **"Crear ticket SOC"** de la consola web (`/automatizacion`) dispara `POST /api/v1/automation/create-ticket` → webhook de n8n `/webhook/glpi-ticket` → API REST de GLPI (`initSession` → `POST /Ticket` → `killSession`) que crea un **ticket real**, y el workflow registra la auditoría local en la tabla `responses` (tanto éxito como error). GLPI corre en la red `red_interna` con su propia base de datos MySQL (no consume la PostgreSQL del stack) y su GUI se publica **solo en loopback**.

```
consola web → soc-api (POST /api/v1/automation/create-ticket)
            → n8n (webhook /webhook/glpi-ticket)
            → GLPI REST API (http://glpi/apirest.php, red_interna)
            → auditoría en PostgreSQL `responses`
```

### Servicios en Docker Compose

| Servicio  | Imagen            | Contenedor    | Acceso                                                      |
| --------- | ----------------- | ------------- | ---------------------------------------------------------- |
| `glpi`    | `glpi/glpi:11.0.8`| `soc-glpi`    | GUI `http://127.0.0.1:${GLPI_PORT}` (bind a loopback)       |
| `glpi-db` | `mysql:8.4`       | `soc-glpi-db` | solo red interna (sin puerto publicado al host)            |

Volúmenes nombrados: `glpi_data` (`/var/glpi`) y `glpi_db_data` (`/var/lib/mysql`). El servicio `glpi` consume variables `GLPI_DB_*` (la imagen oficial usa `GLPI_*`, **no** `MYSQL_*`); el servicio `glpi-db` usa `MYSQL_*` solo para el bootstrap de la BD y el usuario.

### Configuración previa (una vez, tras el primer arranque)

> GLPI arranca con credenciales por defecto y API REST deshabilitada. Esta configuración es **manual y se hace UNA sola vez** tras el primer `docker compose up -d`; queda documentada como parte de la tesis.

1. **Primer arranque**: `docker compose up -d`. GLPI auto-instala su base de datos (440+ tablas) en `glpi-db`. La GUI responde en `http://127.0.0.1:${GLPI_PORT}` (login inicial `glpi/glpi`).
2. **Cambiar las contraseñas de las cuentas por defecto** (`admin/glpi`, `tech/glpi`, etc.) — obligatorio en este proyecto.
3. **Habilitar la API REST**: Setup → General → API: *Enable Rest API* = Yes y *Enable login with credentials* = Yes.
4. **Crear el cliente de API** (App-Token) y un **usuario API dedicado** con su `user_token` (ej. cliente `api-soc`). El usuario API debe tener perfil con **privilegio mínimo**: crear tickets sin borrarlos (verificado: `DELETE` responde `ERROR_GLPI_DELETE`).
5. **Volcar los tokens** al `.env` como `GLPI_APP_TOKEN` y `GLPI_USER_TOKEN` (`.env` está en `.gitignore`; `.env.example` trae placeholders `CHANGEME_...`).
6. **Reiniciar n8n** para que tome las nuevas variables: `docker compose up -d` (o `docker restart soc-n8n`).

Verificación manual del flujo de autenticación contra `apirest.php`:

```bash
curl -X POST "http://127.0.0.1:8081/apirest.php/initSession" \
  -H "App-Token: $GLPI_APP_TOKEN" \
  -H "Authorization: user_token $GLPI_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

> **Dentro de los contenedores**, n8n llama a GLPI por la DNS de la red Compose: `http://glpi/apirest.php` (nunca `127.0.0.1:8081`). El workflow `workflows/webhook-glpi-ticket.json` consume los tokens por entorno (`{{ $env.GLPI_APP_TOKEN }}`, `{{ $env.GLPI_USER_TOKEN }}`); para eso el servicio `n8n` define `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`.

### Variables de entorno GLPI

| Variable                 | Dónde se usa                                                         | Ejemplo          |
| ------------------------ | -------------------------------------------------------------------- | ---------------- |
| `GLPI_DB_HOST`           | Servicio `glpi` (host de la BD dedicada)                             | `glpi-db`        |
| `GLPI_DB_PORT`           | Servicio `glpi` (puerto MySQL)                                       | `3306`           |
| `GLPI_DB_NAME`           | Servicio `glpi` y bootstrap de `glpi-db` (`MYSQL_DATABASE`)          | *(definir en `.env`)* |
| `GLPI_DB_USER`           | Servicio `glpi` y bootstrap de `glpi-db` (`MYSQL_USER`)              | *(definir en `.env`)* |
| `GLPI_DB_PASSWORD`       | Servicio `glpi` y bootstrap de `glpi-db` (`MYSQL_PASSWORD`)          | *(secreta)*      |
| `GLPI_DB_ROOT_PASSWORD`  | Password root del MySQL dedicado (solo admin interno de `glpi-db`; no la consume GLPI) | *(secreta)* |
| `GLPI_PORT`              | Bind `127.0.0.1:${GLPI_PORT}:80` de `glpi`. 8080 choca con `DIONAEA_HTTP_PORT` → usar 8081 | `8081` |
| `GLPI_APP_TOKEN`         | Workflow n8n `{{ $env.GLPI_APP_TOKEN }}` (App-Token de la REST API)  | `CHANGEME_tras_configuracion_glpi_grupo2` |
| `GLPI_USER_TOKEN`        | Workflow n8n `{{ $env.GLPI_USER_TOKEN }}` (`user_token` del usuario API) | `CHANGEME_tras_configuracion_glpi_grupo2` |

### Comportamiento de la auditoría de errores (hallazgo de tesis)

El workflow registra **tanto el éxito como el fallo** en `responses`, de modo que la tesis conserva evidencia evaluable de ambos casos:

* **Flujo**: *Webhook Ticket* → *Init Session* → guard *Session Iniciada?* → *Create Ticket* → *Kill Session* → code *Normalizar Estado* (fuente única: `{ok, ticket_id, errorMessage, event_id, name, content, urgency}`) → derivación por *Ticket Creado?*.
* **Éxito**: nodo *Crear Ticket* inserta `status='completed'` con `glpi_ticket_id` en `details` (además de name/content/urgency/created_at).
* **Error**: nodo *Registrar Error* inserta `status='error'` con el motivo en `details.error`.

**Con GLPI caído** (verificado): la rama de error responde en **~6 s** (timeout de la API de **10 s** en `api/app/services/n8n_client.py`: el workflow reintenta y luego responde `success: false`), y la API responde **HTTP 502** con `{"detail": "n8n no reportó éxito"}` — **no hay falso éxito** en la UI, y el intento fallido queda auditado en `responses` (`status='error'` + `details.error`).

### Nota SMTP (pendiente, no bloqueante)

Las notificaciones por email de GLPI están **diferidas/pendientes de configurar**: requieren un servidor SMTP en *Setup → Notifications*. Es opcional y **no bloqueante**: la creación del ticket funciona igual sin SMTP.

---

## Funcionalidades

* Captura automatizada de eventos
* Enriquecimiento de IPs
* Clasificación MITRE ATT&CK
* Captura de malware
* Alertas automáticas
* Persistencia relacional
* Automatización de playbooks
* Integración vía Webhooks

> **Enriquecimiento externo (AbuseIPDB, Shodan, VirusTotal, WhoisFreaks):** la autenticación vive exclusivamente en credenciales genéricas de n8n (`httpHeaderAuth`/`httpQueryAuth`) referenciadas por nombre/ID en los JSON versionados; las claves nunca se commitean en este repo y los nodos son fail-open (un fallo de API no interrumpe la ingesta ni la respuesta del webhook).

---

## Instalación

### Requisitos

* Docker
* Docker Compose
* Git

### Clonar repositorio

```bash
git clone https://github.com/germarino18/Automatizacion_con_Honeypots_Tesis
cd Automatizacion_con_Honeypots_Tesis
```

### Configurar variables de entorno

El stack se configura íntegramente desde `.env`; sin este paso los contenedores levantan sin credenciales válidas.

```bash
cp .env.example .env
```

Completar al menos las variables obligatorias: `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`, `N8N_BASIC_AUTH_*` y `N8N_ENCRYPTION_KEY`, `WEBHOOK_URL`, puertos de honeypots (`COWRIE_*`, `DIONAEA_*`), credenciales de Grafana (`GRAFANA_*`), subredes (`NETWORK_DMZ_SUBNET`, `NETWORK_INTERNAL_SUBNET`) y las de la consola SOC (`SOC_ADMIN_USER`, `SOC_ADMIN_PASSWORD`, `SOC_JWT_SECRET`). Para la API pública de n8n, crear la clave en la UI (Settings > n8n API) y cargarla en `N8N_API_KEY`.

### Levantar servicios

```bash
docker compose up -d
```

---

## Variables de Entorno

Ejemplo:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=cambia-esta-clave-segura
POSTGRES_DB=honeypots
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=cambia-esta-clave-segura
```

> Todos los valores son placeholders de ejemplo: reemplázalos por credenciales fuertes en tu `.env` (nunca subas valores reales al repositorio).

---

## Métricas Evaluadas

* MTTD
* MTTR
* Cobertura MITRE ATT&CK
* Tasa de falsos positivos
* Técnicas identificadas

---

## Seguridad

* Contenedores aislados
* Restricción de tráfico saliente
* Segmentación de red
* Persistencia segura
* Logs centralizados

---

## Casos de Uso

* Investigación académica
* Laboratorios SOC
* Inteligencia de amenazas
* Formación universitaria
* Simulación de ataques
* Análisis táctico

---

## Futuras Mejoras

* Integración con IA/LLMs
* Dashboards avanzados
* Correlación avanzada
* Clustering distribuido
* Detección basada en ML
* Notificaciones por email de GLPI (SMTP — ver sección GLPI)

---

## Referencias

* MITRE ATT&CK
* Cowrie
* Dionaea
* n8n
* Docker
* PostgreSQL

---

## Licencia

MIT License

---

## Autores

* Ignacio Navarria
* Germán Marino
