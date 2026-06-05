## 1. Estructura de Directorios y Archivos Base

- [x] 1.1 Crear estructura de directorios para volúmenes: `postgres/data`, `n8n/data`, `cowrie/logs`, `cowrie/downloads`, `cowrie/config`, `dionaea/logs`, `dionaea/binaries`, `dionaea/config`, `grafana/`, `nginx/certs`, `backups/`, `scripts/`
- [x] 1.2 Crear archivo `.env` con todas las variables de entorno requeridas
- [x] 1.3 Crear script `postgres/init.sql` con esquema de base de datos
- [x] 1.4 Crear archivo `nginx/nginx.conf` con configuración de proxy reverso

## 2. Docker Compose

- [x] 2.1 Crear `docker-compose.yml` con servicio PostgreSQL (imagen, environment, volumes, networks, healthcheck)
- [x] 2.2 Agregar servicio n8n con autenticación básica, backend PostgreSQL y healthcheck
- [x] 2.3 Agregar servicio Cowrie con webhook a n8n, volúmenes y redes
- [x] 2.4 Agregar servicio Dionaea con webhook a n8n, volúmenes y redes
- [x] 2.5 Agregar servicio Grafana con conexión a PostgreSQL
- [x] 2.6 Agregar servicio Nginx como proxy reverso
- [x] 2.7 Configurar redes DMZ e interna con subredes definidas
- [x] 2.8 Verificar que `docker compose config` no muestre errores de sintaxis

## 3. Git y Exclusiones

- [x] 3.1 Actualizar `.gitignore` para excluir `.env`, directorios de datos, logs y binarios
- [x] 3.2 Verificar que `.env` no esté siendo trackeado por git

## 4. Verificación y Pruebas

- [x] 4.1 Ejecutar `docker compose up -d` y verificar que todos los contenedores arranquen
- [x] 4.2 Verificar healthchecks: `docker compose ps` muestra todos los servicios como "healthy" o "up"
- [x] 4.3 Verificar redes: `docker network ls` muestra `honeypot_dmz` y `honeypot_internal`
- [x] 4.4 Verificar conectividad: n8n accesible en `http://localhost:5678` (HTTP 200)
- [x] 4.5 Verificar persistencia: PostgreSQL escribe datos en `postgres/data/` correctamente
