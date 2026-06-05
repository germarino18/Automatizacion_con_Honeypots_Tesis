# Especificación: Infraestructura Docker

## ADDED Requirements

### Requirement: El sistema SHALL definir servicios en docker-compose.yml
El sistema SHALL contar con un archivo `docker-compose.yml` en la raíz del proyecto que defina los siguientes servicios: PostgreSQL, n8n, Cowrie, Dionaea, Grafana y Nginx.

#### Scenario: Verificar existencia de docker-compose.yml
- **WHEN** se ejecuta `Test-Path -LiteralPath "docker-compose.yml"`
- **THEN** el archivo existe en la raíz del proyecto

#### Scenario: Verificar servicios definidos
- **WHEN** se ejecuta `docker compose config --services`
- **THEN** la salida incluye: postgres, n8n, cowrie, dionaea, grafana, nginx

### Requirement: Los servicios SHALL tener healthchecks
Cada servicio SHALL definir un healthcheck que verifique su estado operativo antes de permitir que otros servicios dependan de él.

#### Scenario: PostgreSQL tiene healthcheck
- **WHEN** se inspecciona el servicio postgres
- **THEN** tiene un healthcheck que ejecuta `pg_isready`

#### Scenario: n8n tiene healthcheck
- **WHEN** se inspecciona el servicio n8n
- **THEN** tiene un healthcheck que verifica el endpoint `/healthz`

### Requirement: Las dependencias entre servicios SHALL respetar orden de arranque
Los servicios SHALL definir `depends_on` con `condition: service_healthy` para garantizar que los servicios dependientes arranquen solo cuando sus dependencias estén operativas.

#### Scenario: n8n depende de PostgreSQL saludable
- **WHEN** se revisa depends_on del servicio n8n
- **THEN** incluye postgres con `condition: service_healthy`

#### Scenario: Honeypots dependen de n8n
- **WHEN** se revisa depends_on de cowrie y dionaea
- **THEN** incluyen n8n como dependencia

#### Scenario: Grafana depende de PostgreSQL saludable
- **WHEN** se revisa depends_on de grafana
- **THEN** incluye postgres con `condition: service_healthy`

### Requirement: El sistema SHALL tener dos redes segmentadas
El sistema SHALL definir dos redes Docker: `honeypot_dmz` (subred 172.20.0.0/24) para honeypots y `honeypot_internal` (subred 172.21.0.0/24, `internal: true`) para servicios internos.

#### Scenario: Red DMZ existe
- **WHEN** se ejecuta `docker network ls`
- **THEN** existe una red llamada `honeypot_dmz`

#### Scenario: Red interna existe y es interna
- **WHEN** se ejecuta `docker network inspect honeypot_internal`
- **THEN** la red tiene `"Internal": true`

#### Scenario: Cada servicio está en la red correcta
- **WHEN** se inspeccionan las redes de cada contenedor
- **THEN** cowrie y dionaea están en `honeypot_dmz`, y postgres, n8n, grafana están en `honeypot_internal`

### Requirement: Los datos persistentes SHALL usar volúmenes montados
Los servicios SHALL montar directorios del host como volúmenes para persistir datos de configuración, logs y bases de datos.

#### Scenario: PostgreSQL persiste datos
- **WHEN** se inspecciona el servicio postgres
- **THEN** tiene un volumen que monta `./postgres/data` en `/var/lib/postgresql/data`

#### Scenario: n8n persiste configuración
- **WHEN** se inspecciona el servicio n8n
- **THEN** tiene un volumen que monta `./n8n/data` en `/home/node/.n8n`

#### Scenario: Cowrie persiste logs y descargas
- **WHEN** se inspecciona el servicio cowrie
- **THEN** tiene volúmenes que montan `./cowrie/logs` y `./cowrie/downloads`

#### Scenario: Dionaea persiste logs y binarios
- **WHEN** se inspecciona el servicio dionaea
- **THEN** tiene volúmenes que montan `./dionaea/logs` y `./dionaea/binaries`

### Requirement: Las variables de entorno SHALL estar externalizadas
El sistema SHALL leer todas las variables de entorno sensibles desde un archivo `.env` en la raíz del proyecto.

#### Scenario: docker-compose.yml referencia variables del .env
- **WHEN** se revisa docker-compose.yml
- **THEN** todas las variables sensibles usan sintaxis `${VARIABLE}`

#### Scenario: .env contiene variables requeridas
- **WHEN** se revisa el archivo `.env`
- **THEN** contiene: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, N8N_BASIC_AUTH_USER, N8N_BASIC_AUTH_PASSWORD, N8N_ENCRYPTION_KEY, COWRIE_SSH_PORT, COWRIE_TELNET_PORT, DIONAEA_SMB_PORT, DIONAEA_FTP_PORT, DIONAEA_HTTP_PORT

### Requirement: Los honeypots SHALL enviar eventos a n8n vía webhook
Cowrie SHALL enviar eventos a `http://n8n:5678/webhook/cowrie` y Dionaea a `http://n8n:5678/webhook/dionaea`.

#### Scenario: Cowrie configura webhook output
- **WHEN** se revisa la configuración de cowrie
- **THEN** tiene configurado COWRIE_OUTPUT_ENDPOINT apuntando a n8n

#### Scenario: Dionaea configura webhook output
- **WHEN** se revisa la configuración de dionaea
- **THEN** tiene configurado DIONAEA_OUTPUT_ENDPOINT apuntando a n8n

### Requirement: n8n SHALL usar PostgreSQL como backend
n8n SHALL configurarse para usar PostgreSQL como base de datos para almacenar workflows, credenciales y configuración.

#### Scenario: n8n configurado con DB_TYPE=postgresdb
- **WHEN** se revisan las variables de entorno de n8n
- **THEN** incluye DB_TYPE=postgresdb, DB_POSTGRESDB_HOST=postgres y credenciales correspondientes

### Requirement: El repositorio SHALL excluir datos sensibles y volúmenes
.gitignore SHALL excluir el archivo `.env`, los directorios de datos (`postgres/data`, `n8n/data`, etc.) y archivos de log de honeypots.

#### Scenario: .env está en .gitignore
- **WHEN** se revisa `.gitignore`
- **THEN** incluye `.env`

#### Scenario: Directorios de datos están en .gitignore
- **WHEN** se revisa `.gitignore`
- **THEN** incluye `postgres/`, `n8n/`, `cowrie/`, `dionaea/`, `grafana/`
