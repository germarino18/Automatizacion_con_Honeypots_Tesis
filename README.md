
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

## Funcionalidades

* Captura automatizada de eventos
* Enriquecimiento de IPs
* Clasificación MITRE ATT&CK
* Captura de malware
* Alertas automáticas
* Persistencia relacional
* Automatización de playbooks
* Integración vía Webhooks

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

### Levantar servicios

```bash
docker compose up -d
```

---

## Variables de Entorno

Ejemplo:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_DB=honeypots
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=admin
```

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
