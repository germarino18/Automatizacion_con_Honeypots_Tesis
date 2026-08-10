## 0. Archivo .env y validación

- [ ] 0.1 Crear archivo `.env` en la raíz con todas las variables que requiere `docker-compose.yml` (POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, N8N_BASIC_AUTH_USER, N8N_BASIC_AUTH_PASSWORD, N8N_ENCRYPTION_KEY, WEBHOOK_URL, COWRIE_SSH_PORT, COWRIE_TELNET_PORT, DIONAEA_SMB_PORT, DIONAEA_FTP_PORT, DIONAEA_HTTP_PORT, GRAFANA_ADMIN_USER, GRAFANA_ADMIN_PASSWORD, NETWORK_DMZ_SUBNET, NETWORK_INTERNAL_SUBNET) con valores reales válidos (subredes Docker no colisionantes, contraseñas de min. N caracteres, N8N_ENCRYPTION_KEY de 32+ chars)
- [ ] 0.2 Crear/actualizar `.env.example` versionable con las MISMAS claves y placeholders vacíos como documentación del contrato
- [ ] 0.3 Ejecutar `docker compose config` y confirmar que NO aparecen warnings de variables vacías
- [ ] 0.4 Validar valores por semántica (no solo por no-vacío): subredes IP válidas, puertos libres, claves mínimas — registrar cada valor y su razón (gobernanza MEDIUM)

## 1. Levantar el stack

- [ ] 1.1 Verificar que los puertos del host (2222/2223, 445/21/80, 5678, 3000, 80/443) estén libres antes de arrancar
- [ ] 1.2 Ejecutar `docker compose up -d` y confirmar que los 6 servicios arrancan sin errores de creación
- [ ] 1.3 Ejecutar `docker compose ps` y confirmar estado 6/6 operativos (postgres/n8n/grafana `healthy`; cowrie/dionaea/nginx `running`)
- [ ] 1.4 Si algún servicio queda `Unhealthy`/`Exit`, documentar la causa, corregir variable de `.env` si procede y reintentar — registrar resultado

## 2. Verificar n8n desde el host

- [ ] 2.1 Ejecutar `curl http://localhost:5678/healthz` y verificar respuesta HTTP 200
- [ ] 2.2 Si no responde al primer intento, esperar el `start_period` del healthcheck (60s), reintentar y dejar registro del retry
- [ ] 2.3 Confirmar acceso a la UI `http://localhost:5678` con las credenciales de N8N_BASIC_AUTH

## 3. Conectividad de red interna

- [ ] 3.1 Ejecutar `docker exec soc-cowrie curl http://n8n:5678/healthz` y confirmar HTTP 200 (Cowrie alcanza n8n por nombre de red)
- [ ] 3.2 Ejecutar el equivalente desde `soc-dionaea` y confirmar HTTP 200 (o registrar el fallo como hallazgo de red)
- [ ] 3.3 Registrar ambos resultados como evidencia de la red interna (red_dmz ↔ red_interna)

## 4. Inventario de workflows en n8n

- [ ] 4.1 Ejecutar `docker exec -u node soc-n8n n8n export:workflow --all` y guardar el resultado como inventario (archivo/local o stdout)
- [ ] 4.2 Revisar en la UI `http://localhost:5678` los workflows existentes y su estado de activación
- [ ] 4.3 Cruzar ambas fuentes y registrar: cuáles existen, cuáles están activos, y qué se hereda de cara a `workflows-n8n` (NO modificar nada en n8n)

## 5. Probar endpoints webhook

- [ ] 5.1 Ejecutar `curl -X POST -H "Content-Type: application/json" -d '{"test":true}' http://localhost:5678/webhook/cowrie` y registrar el código HTTP (200 o 404)
- [ ] 5.2 Ejecutar `curl -X POST -H "Content-Type: application/json" -d '{"test":true}' http://localhost:5678/webhook/dionaea` y registrar el código HTTP (200 o 404)
- [ ] 5.3 Interpretar resultados: 200 = receptor activo; 404 = workflow inactivo/ruta distinta — registrar hallazgo (no bloquea el change)

## 6. Validar emisión real de Cowrie y persistencia

- [ ] 6.1 Simular un login SSH contra Cowrie (via `docker exec soc-cowrie` emitiendo un evento local o `ssh` externo al puerto mapeado) con credenciales de honeypot
- [ ] 6.2 Consultar PostgreSQL: `docker exec soc-postgres psql -U <user> -d <db> -c "SELECT id, timestamp, source_honeypot, src_ip, username, commands FROM honeypot_events ORDER BY id DESC LIMIT 5;"` y confirmar una fila nueva con `source_honeypot='cowrie'` y `src_ip` INET válido
- [ ] 6.3 Registrar si Dionaea emitió o no algo (esperado: NO emite por config actual) — documentar como hallazgo y dependencia del change "puente Dionaea"; NO implementar solución acá

## 7. Cierre y doc

- [ ] 7.1 Consolidar la evidencia de los pasos 0-6 en las notas de decisión del change (qué se probó, resultado, y razón de cada decisión/desviación)
- [ ] 7.2 Registrar explícitamente la dependencia futura del change "puente Dionaea" (sidecar lector de `dionaea.json` → reenvío a n8n) con el conocimiento técnico ya verificado
- [ ] 7.3 Confirmar que NO se tocó el change `workflows-n8n` (ni proposal/design/specs/tasks) y que no quedan archivos de sidecar/scripts del puente en el repo