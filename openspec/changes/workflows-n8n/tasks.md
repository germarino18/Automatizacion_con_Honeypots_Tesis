## 1. Base de Datos

- [x] 1.1 La tabla `honeypot_events` ya existe en PostgreSQL (creada por init.sql)
- [x] 1.2 Verificada: tabla con 16 columnas, índices y relaciones OK

## 2. Workflow Cowrie en n8n

- [x] 2.1 Ingresar a n8n UI (http://localhost:5678) con credenciales admin
- [x] 2.2 Crear workflow "Cowrie Webhook" con nodo Webhook en `/webhook/cowrie` — nodo guardado, falta nodo PostgreSQL
- [ ] 2.2 Crear workflow "Cowrie Webhook" con nodo Webhook en `/webhook/cowrie`
- [ ] 2.3 Agregar nodo PostgreSQL con consulta INSERT parametrizada
- [ ] 2.4 Configurar nodo de respuesta HTTP 200 para confirmación al honeypot
- [ ] 2.5 Activar el workflow y exportarlo como `n8n/workflows/cowrie-webhook.json`

## 3. Workflow Dionaea en n8n

- [ ] 3.1 Crear workflow "Dionaea Webhook" con nodo Webhook en `/webhook/dionaea`
- [ ] 3.2 Agregar nodo PostgreSQL con consulta INSERT parametrizada
- [ ] 3.3 Configurar nodo de respuesta HTTP 200 para confirmación al honeypot
- [ ] 3.4 Activar el workflow y exportarlo como `n8n/workflows/dionaea-webhook.json`

## 4. Verificación y Cierre

- [ ] 4.1 Verificar que ambos endpoints respondan HTTP 200 con un POST de prueba
- [ ] 4.2 Confirmar que los datos aparecen en la tabla `attack_events` de PostgreSQL
- [ ] 4.3 Verificar persistencia: reiniciar n8n y confirmar que los workflows sigan activos
