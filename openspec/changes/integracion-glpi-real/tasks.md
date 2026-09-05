## 1. Infraestructura y configuración de GLPI

- [x] 1.1 Agregar los servicios `glpi-db` (imagen oficial MySQL/MariaDB) y `glpi` (imagen oficial `glpi/glpi:11.0.8` con tag fijo) a `docker-compose.yml`, con volúmenes nombrados `glpi_data` (→`/var/glpi`) y `glpi_db_data` (→`/var/lib/mysql`), en la red `red_interna` (D-glpi-1, D-glpi-2).
- [x] 1.2 Publicar el puerto de GLPI bind a `127.0.0.1` (`"127.0.0.1:${GLPI_PORT:-8080}:80"`) y NO publicar el puerto MySQL al host (precedente `despliegue-web`).
- [x] 1.3 Agregar las variables `GLPI_DB_HOST=glpi-db`, `GLPI_DB_PORT=3306`, `GLPI_DB_NAME`, `GLPI_DB_USER`, `GLPI_DB_PASSWORD`, `GLPI_APP_TOKEN` y `GLPI_USER_TOKEN` a `.env.example` (con placeholder no trivial) y a `.env` (valores reales, NO versionados) (D-glpi-3).
- [x] 1.4 Configurar las variables de entorno del servicio `glpi` en compose para consumir `GLPI_*` por referencia (sin literales).
- [x] 1.5 Levantar el stack (`docker compose up -d`) y verificar que `soc-glpi` y `soc-glpi-db` quedan `running`/`healthy` y que GLPI responde por HTTP en 127.0.0.1.

## 2. Configuración única de GLPI (post-deploy manual)

- [x] 2.1 Cambiar las contraseñas de TODAS las cuentas por defecto de GLPI (`glpi/glpi`, `tech/tech`, `normal/normal`, `post-only/postonly`) al primer acceso (spec `despliegue-glpi`).
- [x] 2.2 Habilitar la REST API (Setup → General → API): "Enable Rest API=Yes" y "Enable login with credentials=Yes".
- [x] 2.3 Crear un cliente de API (App-Token) y copiar el valor a `GLPI_APP_TOKEN` en `.env` (D-glpi-3).
- [x] 2.4 Crear un usuario API dedicado con perfil limitado (NO super-admin) y generar su `user_token`, copiándolo a `GLPI_USER_TOKEN` en `.env`.
- [ ] 2.5 Configurar el servidor de correo saliente (SMTP) en GLPI (Setup → Notifications) para habilitar las notificaciones de email de los tickets (decisión del usuario; opcional si no se quiere email, la creación de ticket funciona igual).
- [x] 2.6 Verificar manualmente el flujo `initSession` → `POST /Ticket` → `killSession` contra `apirest.php` con los tokens (crear y borrar un ticket de prueba si aplica).

## 3. Rework del workflow n8n webhook-glpi-ticket

- [x] 3.1 Editar `workflows/webhook-glpi-ticket.json`: agregar el nodo HTTP "Init Session" (`POST /apirest.php/initSession` con `Content-Type`, `App-Token: {{ $env.GLPI_APP_TOKEN }}`, `Authorization: user_token {{ $env.GLPI_USER_TOKEN }}`) capturando `session_token` (D-glpi-4).
- [x] 3.2 Agregar el nodo HTTP "Create Ticket" (`POST /apirest.php/Ticket` con headers `App-Token` + `Session-Token: {{ $('Init Session').item.json.session_token }}` y body `{"input": {...}}`), traduciendo `urgency` (low→2/medium→3/high→4, fallback 3) en el workflow (D-glpi-5) y **sin** `_disablenotif: true` (notificaciones de email habilitadas por decisión del usuario).
- [x] 3.3 Agregar el nodo HTTP "Kill Session" (`GET /apirest.php/killSession` con `App-Token` + `Session-Token`) para cerrar la sesión (D-glpi-4).
- [x] 3.4 Actualizar el nodo PostgreSQL "Crear Ticket" (auditoría) para que `details` incluya `glpi_ticket_id` (del nodo Create Ticket) además de name/content/urgency/created_at, conservando `action_type='alerta'` y `actor='n8n-automated'` (D-glpi-6). En fallo de GLPI, el workflow inserta una fila de auditoría con `status='error'` y `details.error` con el motivo (D-glpi-7, decisión del usuario).
- [x] 3.5 Actualizar el nodo "Responder" para devolver `{ success, message, action_id, glpi_ticket_id, timestamp }`.
- [x] 3.6 Configurar `retryOnFail: true`, `maxTries: 3` y `retryWaitTime` en los nodos HTTP nuevos e `onError: continueRegularOutput` en el nodo PostgreSQL (precedente `hardening-n8n`).
- [x] 3.7 Importar y activar el workflow reworkado en el n8n corriendo, verificando que la ruta `/webhook/glpi-ticket` sigue registrada y que no colisiona con `/webhook/firewall-block` ni `/webhook/cowrie|dionaea`.

## 4. Actualización de tests de la API

- [x] 4.1 Extender `api/tests/test_n8n_client.py` para cubrir el contrato `create_ticket` y el flujo hacia `/webhook/glpi-ticket` (verificar que el payload `{event_id, name, content, urgency}` sigue enviándose tal cual).
- [x] 4.2 Extender `api/tests/test_automation.py` para el endpoint `create-ticket`: 200 con éxito, 422 con `name`/`content` vacíos, 502/503 sin falso éxito cuando n8n/GLPI falla, y que `glpi_ticket_id` (si lo devuelve el workflow) viaja en `result`.
- [x] 4.3 Ejecutar la suite de tests de la API (`api/tests/`) y confirmar que no hay regresiones en `test_automation.py`/`test_n8n_client.py` ni en el resto.

## 5. Verificación end-to-end

- [x] 5.1 Crear un ticket desde la UI (`POST /api/v1/automation/create-ticket`) y confirmar que aparece un **ticket real en GLPI** (vía API/UI) con name/content y urgencia traducida correctamente (D-glpi-5).
- [x] 5.2 Confirmar que el INSERT en `responses` registra `action_type='alerta'`, `actor='n8n-automated'`, `status='completed'` y `details.glpi_ticket_id` igual al ticket real creado.
- [ ] 5.3 Verificar que la notificación de email se dispara (si hay SMTP configurado) al crear el ticket, y que la creación NO depende de SMTP (el workflow no falla sin él).
- [x] 5.4 Verificar el registro de error GLPI: forzar un fallo (p. ej. token inválido o GLPI parado) y confirmar que `responses` registra el intento con `status='error'` y `details.error`, sin reportar éxito falso en la API (D-glpi-7).
- [x] 5.5 Ejecutar las verificaciones de regresión de `diagnostico-cadena` (healthz, webhooks cowrie/dionaea/firewall-block, persistencia) y confirmar que ningún servicio existente se degradó.
- [x] 5.6 Verificar que no hay secretos GLPI literales en el repo (grep App-Token/User-Token/passwords) y que `.env` está excluido por `.gitignore`.

## 6. Documentación y cierre del change

- [ ] 6.1 Documentar en README la configuración previa de GLPI (primer arranque, cambio de contraseñas, habilitación de REST API, creación de cliente API y usuario API, configuración SMTP para notificaciones, volcado de tokens al `.env`) con placeholders no triviales (spec `despliegue-glpi`). Incluir también el comportamiento de auditoría de errores (registro de `status='error'` cuando GLPI falla).
- [ ] 6.2 Sincronizar las specs delta a las specs principales (`openspec-sync-specs`): aplicar MODIFIED en `automatizacion-web` y crear/agregar la capacidad `despliegue-glpi` en main specs.
- [ ] 6.3 Archivar el change (`openspec-archive-change`) tras confirmar la verificación end-to-end y aplicar el cierre (`/opsx-archive`).
