## Context

El proyecto "Automatización con Honeypots" requiere una infraestructura Docker que orqueste múltiples servicios: honeypots (Cowrie, Dionaea), orquestador n8n, base de datos PostgreSQL, panel Grafana y proxy reverso Nginx. Actualmente no existe ningún archivo de infraestructura funcional — solo documentación conceptual pensada para un entorno Linux/VM.

El entorno objetivo es Windows 11 con Docker Desktop (v29.5.2) utilizando backend WSL2. Todos los servicios deben ejecutarse en contenedores Linux.

La documentación existente en `docs/Estructuración-PasosSeguir.md` contiene un `docker-compose.yml` de referencia que debe adaptarse al contexto Windows y a los requisitos actuales del proyecto.

## Goals / Non-Goals

**Goals:**
- Definir un `docker-compose.yml` funcional con todos los servicios del sistema
- Configurar redes Docker segmentadas (DMZ e interna) para aislamiento de servicios
- Configurar volúmenes persistentes para datos de PostgreSQL, configuración de n8n, logs de honeypots y dashboards de Grafana
- Establecer healthchecks y dependencias de arranque entre servicios
- Configurar variables de entorno externalizadas en archivo `.env`
- Crear script de inicialización de base de datos PostgreSQL (`init.sql`)
- Verificar que todos los servicios levanten correctamente

**Non-Goals:**
- No incluye configuración de seguridad avanzada (firewall UFW, certificados SSL) — se aborda en un cambio posterior
- No incluye la creación de workflows de n8n — esos ya existen en `workflows/` y se integran después
- No incluye la interfaz web frontend/backend — se aborda en cambios posteriores
- No incluye configuración de backups ni rotación de logs

## Decisions

### Decisión 1: Docker Compose V3.8 con sintaxis puente
- **Opción elegida**: Docker Compose file format v3.8, networks tipo bridge
- **Alternativa considerada**: Docker Swarm o Kubernetes
- **Por qué**: El proyecto es monohost (una sola PC). Docker Compose es la opción más simple y directa para orquestar múltiples contenedores en un solo equipo. Swarm y K8s agregan complejidad innecesaria para este caso de uso académico.

### Decisión 2: Dos redes segmentadas (DMZ + Interna)
- **Red DMZ** (`honeypot_dmz`): 172.20.0.0/24 — Contiene Cowrie y Dionaea (servicios expuestos a internet)
- **Red Interna** (`honeypot_internal`): 172.21.0.0/24 — Contiene PostgreSQL, n8n, Grafana (servicios sin exposición directa)
- **Red interna marcada como `internal: true`**: Sin acceso a internet ni al host
- **Por qué**: Segmentación de red realista. Si un honeypot es comprometido, el atacante no tiene acceso directo a la base de datos ni al orquestador. La red interna no tiene salida a internet, evitando exfiltración de datos.

### Decisión 3: PostgreSQL 15 Alpine
- **Opción elegida**: `postgres:15-alpine`
- **Por qué**: Alpine es ~5MB vs ~200MB de la imagen completa. PostgreSQL 15 es estable y tiene buen soporte. n8n tiene integración nativa con PostgreSQL.

### Decisión 4: n8n latest con autenticación básica
- **Opción elegida**: `n8n/n8n:latest`, autenticación básica activa, base de datos PostgreSQL como backend
- **Por qué**: n8n guarda sus workflows y credenciales en PostgreSQL en lugar de archivos locales, lo que permite persistencia real y recuperación ante fallos.

### Decisión 5: Cowrie y Dionaea con webhooks a n8n
- **Cowrie**: Envía eventos vía webhook a `http://n8n:5678/webhook/cowrie`
- **Dionaea**: Envía eventos vía webhook a `http://n8n:5678/webhook/dionaea`
- **Por qué**: n8n expone webhooks que reciben eventos HTTP POST. Los honeypots se configuran para enviar sus eventos a estos endpoints. n8n procesa los eventos y los guarda en PostgreSQL.

### Decisión 6: Healthchecks en servicios críticos
- **PostgreSQL**: Usa `pg_isready` para verificar que acepta conexiones
- **n8n**: Usa HTTP GET al endpoint `/healthz`
- **Por qué**: Los healthchecks permiten que Docker Compose espere a que un servicio realmente esté listo antes de arrancar el siguiente (ej: n8n espera a que PostgreSQL esté saludable).

### Decisión 7: Variables de entorno externalizadas
- **Opción elegida**: Archivo `.env` en la raíz con todas las variables sensibles
- **Por qué**: Separación de configuración sensible del código. El `.env` se excluye del repositorio vía `.gitignore`. Cada desarrollador puede tener su propio `.env`.

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| **Puertos ocupados**: Los puertos 2222, 2223, 445, 21, 80, 443, 5678, 3000 pueden estar en uso por otros servicios | Documentar puertos en la propuesta; verificar con `netstat -aon` antes de levantar |
| **Exposición accidental**: Si los honeypots están mal configurados, podrían exponer servicios internos | Segmentación de redes con `internal: true` en la red interna; los contenedores DMZ solo se comunican con n8n vía webhooks |
| **Pérdida de datos**: Si se borran los contenedores sin respaldo, se pierden los datos de PostgreSQL | Volúmenes persistentes montados en directorios del host (`./postgres/data`, `./n8n/data`) |
| **Docker Desktop en Windows**: Puede tener problemas de rendimiento o compatibilidad versus una VM Linux nativa | Usar backend WSL2 que es el recomendado por Docker para Windows; asegurar que WSL2 esté correctamente configurado |
| **n8n sin respaldo**: Si se corrompe la base de datos, se pierden los workflows | PostgreSQL como backend (no archivos locales); la base de datos tiene respaldo por los volúmenes persistentes |
