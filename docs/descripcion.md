# Automaticacion_n8n_honeypots

## Descripción

Sistema de orquestación de honeypots research basado en n8n para captura, enriquecimiento, correlación táctica y automatización de eventos de ciberseguridad.

El proyecto integra honeypots de media interacción, automatización SOAR low-code y análisis táctico mediante MITRE ATT&CK.

# Plataforma de Visualización y Gestión para Honeypots Orquestados con n8n

# Justificación Técnica

La arquitectura propuesta ya contiene los componentes fundamentales para una interfaz:

| Componente           | Estado actual | Utilidad para la interfaz        |
| -------------------- | ------------- | -------------------------------- |
| Cowrie               | Implementado  | Generación de eventos SSH/Telnet |
| Dionaea              | Implementado  | Captura de malware y explotación |
| n8n                  | Implementado  | Orquestación y automatización    |
| PostgreSQL           | Implementado  | Persistencia de datos            |
| Webhooks             | Implementados | Integración frontend/backend     |
| MITRE ATT&CK Mapping | Implementado  | Visualización táctica            |
| Docker               | Implementado  | Despliegue modular               |

Esto permite desarrollar una interfaz sin necesidad de rediseñar la arquitectura principal.

---

# Arquitectura para la Interfaz

## Backend

Tecnologías sugeridas:

* Node.js + Express
* NestJS
* Spring Boot
* FastAPI (Python)

Responsabilidades:

* Exponer API REST
* Consultar PostgreSQL
* Consumir eventos de n8n
* Gestionar autenticación
* Emitir eventos en tiempo real
* Controlar permisos y usuarios

---

## Frontend

Tecnologías sugeridas:

* React
* Next.js
* TailwindCSS
* Material UI
* Recharts / Chart.js

Funcionalidades:

* Dashboard SOC
* Tabla de eventos
* Visualización MITRE ATT&CK
* Mapa geográfico de ataques
* Timeline de sesiones
* Visualización de malware
* Logs enriquecidos
* Panel de métricas

---

## Comunicación en Tiempo Real

Tecnologías sugeridas:

* WebSockets
* Socket.IO
* Server-Sent Events

Permitiría:

* Ver ataques en vivo
* Alertas instantáneas
* Actualización automática del dashboard

---

# Funcionalidades Posibles de la Plataforma

## Dashboard General

* Total de ataques
* Países de origen
* Técnicas ATT&CK detectadas
* Eventos por honeypot
* Alertas críticas
* Ataques por protocolo
* MTTD y MTTR

---

## Gestión de Eventos

* Filtrado por IP
* Filtrado por fecha
* Filtrado por severidad
* Filtrado por técnica ATT&CK
* Búsqueda avanzada
* Exportación CSV/PDF

---

## Visualización MITRE ATT&CK

* Heatmap de tácticas
* Técnicas más utilizadas
* Relación atacante/técnica
* Timeline táctico

---

## Gestión de Malware

* Hash SHA256
* VirusTotal
* Descargas capturadas
* URLs maliciosas
* Binarios detectados

---

## Sistema de Alertas

* Alertas en tiempo real
* Integración Discord
* Integración Telegram
* Integración Slack
* Integración Email

---

## Módulo de Simulación

Se puede desarrollar un entorno controlado para:

* Simular ataques SSH
* Simular brute force
* Simular descarga de malware
* Validar playbooks
* Verificar automatizaciones
* Probar resiliencia del sistema

Esto sería extremadamente valioso para:

* Investigación académica
* Laboratorios universitarios
* Formación en ciberseguridad
* Pruebas SOC
* Demostraciones técnicas

---

## Funcionalidades mínimas

### Backend

* API REST
* Consulta PostgreSQL
* Login JWT
* WebSockets
* Endpoint de eventos

### Frontend

* Login
* Dashboard
* Tabla de eventos
* Métricas básicas
* Vista MITRE ATT&CK
* Alertas en vivo

### Infraestructura

* Docker Compose
* PostgreSQL
* n8n
* Cowrie
* Dionaea


## Estructura del Proyecto

```bash
project/
│
├── docker/
├── n8n/
├── cowrie/
├── dionaea/
├── database/
├── workflows/
├── scripts/
├── docs/
└── README.md