
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
* Integración SIEM
* Correlación avanzada
* Clustering distribuido
* Detección basada en ML

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
