## Why

El proyecto necesita una infraestructura Docker base que permita ejecutar todos los servicios (honeypots, n8n, PostgreSQL, Grafana, Nginx) de forma orquestada, portable y reproducible. Actualmente solo existe documentación conceptual y archivos de workflow, pero no hay un entorno funcional. Sin esta base, no es posible ejecutar, probar ni validar ninguno de los componentes del sistema.

## What Changes

- Crear el archivo `docker-compose.yml` con todos los servicios del sistema
- Crear el archivo `.env` con variables de entorno para configuración sensible
- Crear la estructura de directorios para volúmenes persistentes (`postgres/`, `n8n/`, `cowrie/`, `dionaea/`, `grafana/`, `nginx/`)
- Configurar redes Docker segmentadas (DMZ e interna) según la arquitectura definida
- Configurar healthchecks para todos los servicios
- Configurar dependencias de arranque entre servicios
- Agregar `.gitignore` apropiado excluyendo volúmenes de datos, `.env` y credenciales
- Verificar que todos los servicios levanten correctamente con `docker compose up -d`

## Capabilities

### New Capabilities
- `infraestructura-docker`: Capacidad base de infraestructura Docker Compose que define y orquesta todos los servicios del sistema, incluyendo redes segmentadas, volúmenes persistentes, healthchecks y dependencias de arranque. Es el prerrequisito para todos los demás componentes.

### Modified Capabilities
<!-- No hay specs existentes aún, este es el primer cambio del proyecto -->

## Impact

- **Nuevos archivos**: `docker-compose.yml`, `.env`, estructura de directorios (`postgres/`, `n8n/`, `cowrie/`, `dionaea/`, `grafana/`, `nginx/`, `backups/`, `scripts/`)
- **Archivos modificados**: `.gitignore` (agregar exclusiones de volúmenes y credenciales)
- **Dependencias**: Docker Desktop 29.5.2+ (ya instalado), WSL2 backend
- **Documentación**: Actualizar `README.md` con instrucciones de despliegue adaptadas a Windows
- **Riesgos**: Puertos 2222, 2223, 445, 21, 80, 443, 5678, 3000 deben estar libres en el host
