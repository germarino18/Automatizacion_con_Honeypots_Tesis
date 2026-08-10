## 1. Base de Datos

- [x] 1.1 La tabla `honeypot_events` ya existe en PostgreSQL (creada por init.sql)
- [x] 1.2 Verificada: tabla con 16 columnas, índices y relaciones OK

## 2. Receptor Cowrie — adoptar y corregir PB-H1

- [x] 2.1 Ingresar a n8n UI (http://localhost:5678) con credenciales admin
- [ ] 2.2 Importar/verificar el playbook PB-H1 (`workflows/pb-h1-reconocimiento-v1.0.json`) — webhook `/webhook/cowrie` activo como receptor de Cowrie
- [ ] 2.3 Corregir nodo "Normalizar Datos": agregar `raw_data` = payload íntegro, validar `src_ip` (INET; si inválida → `'0.0.0.0'`)
- [ ] 2.4 Corregir nodo "PostgreSQL Auditoría": migrar de interpolación `{{ $json[...] }}` a INSERT parametrizado (`$1, $2...`) con cast JSONB correcto (o `NULL` si no hay JSON)
- [ ] 2.5 Conectar nodo *Execute Workflow* hacia PB-H2 cuando el evento contiene `command` (rama de comandos)
- [ ] 2.6 Activar PB-H1 y exportarlo como `n8n/workflows/pb-h1-reconocimiento-v1.0.json`

## 3. Sub-workflow Cowrie — corregir PB-H2

- [ ] 3.1 Importar/verificar el playbook PB-H2 (`workflows/pb-h2-ejecucion-comandos-v1.0.json`) como **sub-workflow** (NO como webhook activo)
- [ ] 3.2 Corregir nodo "Extraer IOCs": agregar `raw_data` = payload íntegro, validar `src_ip`
- [ ] 3.3 Corregir nodo "PostgreSQL Auditoría": INSERT parametrizado, cast JSONB correcto, `dst_port` desde payload (no hardcodeado 2222)
- [ ] 3.4 Corregir nodo "PostgreSQL Respuestas": INSERT parametrizado a `responses` (sin interpolación)
- [ ] 3.5 Exportar PB-H2 como `n8n/workflows/pb-h2-ejecucion-comandos-v1.0.json` (webhook propio desactivado o marcado como test manual)

## 4. Workflow Dionaea en n8n

- [ ] 4.1 Crear workflow "Dionaea Webhook" con nodo Webhook en `/webhook/dionaea`
- [ ] 4.2 Agregar nodo Code con mapeo Dionaea (Decisión 4): `src_ip` ← `connection.remote_host`, `malware_hash` ← `download.sha256`, `raw_data` = payload íntegro, validar `src_ip` INET
- [ ] 4.3 Agregar nodo PostgreSQL con INSERT parametrizado a `honeypot_events`
- [ ] 4.4 Configurar nodo de respuesta HTTP 200 para confirmación
- [ ] 4.5 Activar el workflow y exportarlo como `n8n/workflows/dionaea-webhook.json`

## 5. Verificación y Cierre

- [ ] 5.1 Verificar `/webhook/cowrie` responda HTTP 200 con un POST de login de prueba
- [ ] 5.2 Verificar ruta de comandos: POST con `command` → se ejecuta PB-H2 (sub-workflow) sin errores
- [ ] 5.3 Confirmar que los datos aparecen en la tabla `honeypot_events` de PostgreSQL (fuente cowrie, con `raw_data`)
- [ ] 5.4 Verificar persistencia: reiniciar n8n y confirmar que los workflows sigan activos
- [ ] 5.5 Confirmar que NO quedan workflows duplicados en la ruta `/webhook/cowrie` (solo PB-H1 activo)