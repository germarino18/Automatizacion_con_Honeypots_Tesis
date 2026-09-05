# Despliegue GLPI

## Purpose

Define el contrato de despliegue, configuración y seguridad de la instancia GLPI del proyecto, así como su API REST, para que la integración con n8n pueda crear tickets reales en GLPI de forma auditada y sin exponer credenciales en el repositorio.

## Requirements

### Requirement: El sistema SHALL desplegar GLPI en docker-compose

El stack SHALL incluir un servicio `glpi` (container `soc-glpi`) con la imagen oficial `glpi/glpi` con **tag fijo a una versión** (`glpi/glpi:11.0.8`; Apache interno en puerto 80) y un servicio `glpi-db` (container `soc-glpi-db`) con imagen oficial MySQL/MariaDB, en la red `red_interna`, con volúmenes nombrados (`glpi_data` → `/var/glpi` y `glpi_db_data` → `/var/lib/mysql`). El puerto de GLPI se publica bind a `127.0.0.1` (`"127.0.0.1:${GLPI_PORT:-8080}:80"`); el puerto de MySQL NO se publica al host. GLPI SHALL usar una base de datos MySQL/MariaDB dedicada (GLPI no soporta PostgreSQL, que es la base del stack).

#### Scenario: El contenedor GLPI arranca y queda healthy

- **WHEN** se ejecuta `docker compose up -d`
- **THEN** los contenedores `soc-glpi` y `soc-glpi-db` quedan en estado `running`/`healthy`
- **AND** GLPI responde por HTTP en el puerto bind a `127.0.0.1`

#### Scenario: GLPI usa la base de datos MySQL dedicada

- **WHEN** el servicio `glpi-db` se inicia y GLPI conecta a su base
- **THEN** GLPI utiliza MySQL/MariaDB (`glpi_db_data`) para su esquema, sin usar la PostgreSQL del stack
- **AND** los datos de GLPI persisten en el volumen nombrado `glpi_db_data`

#### Scenario: Variables de entorno mínimas de GLPI

- **WHEN** se inspecciona el servicio `glpi` en compose
- **THEN** recibe `GLPI_DB_HOST=glpi-db`, `GLPI_DB_PORT=3306`, `GLPI_DB_NAME`, `GLPI_DB_USER`, `GLPI_DB_PASSWORD`, `GLPI_APP_TOKEN` y `GLPI_USER_TOKEN` desde el entorno
- **AND** ningún valor de credencial aparece como literal en el repositorio

### Requirement: La API REST de GLPI SHALL habilitarse para la integración con n8n

La instancia GLPI desplegada SHALL tener habilitada la **REST API** (Setup → General → API: Enable Rest API=Yes y Enable login with credentials=Yes, o vía configuración equivalente), con al menos un **cliente de API** (App-Token) y un **usuario API dedicado** con perfil limitado (NO super-admin) que disponga de un `user_token`. El flujo de autenticación SHALL ser: `POST /apirest.php/initSession` (App-Token + Authorization `user_token`) para obtener el `session_token`, operaciones autenticadas con `Session-Token`, y `GET /apirest.php/killSession` para cerrar la sesión.

#### Scenario: Inicio y cierre de sesión de la API

- **WHEN** un cliente envía `POST /apirest.php/initSession` con App-Token y `user_token` válidos
- **THEN** la API responde con un `session_token`
- **AND** al enviar `GET /apirest.php/killSession` con ese token, la sesión se cierra correctamente

#### Scenario: Usuario API con perfil limitado

- **WHEN** se configura el usuario API dedicado para n8n
- **THEN** usa un perfil con permisos restringidos (no super-admin) y autentica con `user_token`, sin exponer su contraseña

### Requirement: Las credenciales de GLPI SHALL referenciarse por entorno sin literales

Los tokens y contraseñas de GLPI (`GLPI_APP_TOKEN`, `GLPI_USER_TOKEN`, `GLPI_DB_PASSWORD`, etc.) SHALL definirse en `.env` y `.env.example` por nombre de variable y consumirse por referencia en compose y en el workflow n8n (`{{ $env.GLPI_APP_TOKEN }}`, `{{ $env.GLPI_USER_TOKEN }}`). NO SHALL commitearse valores reales en el repositorio ni hardcodearse en el workflow.

#### Scenario: `.env.example` documenta las variables de GLPI

- **WHEN** se inspecciona `.env.example`
- **THEN** contiene las variables `GLPI_*` nuevas vacías/placeholder con comentario de uso

#### Scenario: Ningún secreto GLPI literal en el repo

- **WHEN** se ejecuta una búsqueda de credenciales sobre los archivos nuevos y el workflow
- **THEN** no se encuentran App-Token/User-Token/passwords reales (solo referencias `${VAR}` o `{{ $env.* }}`)

### Requirement: Las cuentas de GLPI por defecto SHALL cambiarse antes de su uso operativo

Todas las cuentas por defecto de GLPI (`glpi/glpi`, `tech/tech`, `normal/normal`, `post-only/postonly`) SHALL cambiarse de contraseña al primer acceso, y SHALL crearse un usuario API dedicado con perfil limitado para la integración. NO SHALL dejarse credenciales por defecto vigentes.

#### Scenario: Sin contraseñas por defecto vigentes

- **WHEN** se audita la instancia GLPI tras el deploy
- **THEN** ninguna de las cuentas por defecto conserva su contraseña original

#### Scenario: Usuario API dedicado creado

- **WHEN** se configura la integración GLPI–n8n
- **THEN** existe un usuario no-super-admin con `user_token` dedicado al flujo de creación de tickets

### Requirement: El proceso rápido SHALL documentar la configuración previa de GLPI

El README/guía SHALL documentar los pasos posteriores al deploy para dejar GLPI operativo y seguro: primer arranque, cambio de contraseñas por defecto, habilitación de la REST API, creación del cliente de API y del usuario API dedicado, y volcado de los tokens al `.env`. SHALL usar placeholders no triviales en los ejemplos de credenciales.

#### Scenario: Guía reproducible de configuración de GLPI

- **WHEN** un administrador sigue la guía del README desde `cp .env.example .env` y `docker compose up -d`
- **THEN** encuentra los pasos explícitos para endurecer GLPI y habilitar la API REST
- **AND** los ejemplos de credenciales usan placeholders no triviales (sin literales débiles como `admin`/`password`)

### Requirement: Las notificaciones de correo de GLPI SHALL estar disponibles para los tickets

GLPI SHALL estar configurado para notificar por correo los tickets creados: la creación de tickets desde la integración n8n **no** debe usar `_disablenotif: true` (notificaciones habilitadas). La configuración de un servidor de correo saliente (SMTP) en GLPI (Setup → Notifications) SHALL documentarse como paso de configuración. Si no hay SMTP configurado, la creación del ticket funciona igual (el email simplemente no se envía) y el workflow no debe fallar por ello.

#### Scenario: Notificaciones habilitadas al crear ticket

- **WHEN** el workflow n8n crea un ticket en GLPI vía `POST /Ticket`
- **THEN** el body del ticket no deshabilita las notificaciones (`_disablenotif` no es `true`)
- **AND** si hay SMTP configurado, GLPI envía la notificación de correo del ticket

#### Scenario: Ausencia de SMTP no rompe la creación del ticket

- **WHEN** GLPI no tiene servidor de correo saliente configurado y se crea un ticket
- **THEN** el ticket se crea y persiste correctamente
- **AND** el workflow no falla por la falta de notificación por correo