
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
git clone https://github.com/navanacho/Automaticacion_n8n_honeypots.git
cd Automaticacion_n8n_honeypots
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
