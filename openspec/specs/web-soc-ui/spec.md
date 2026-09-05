## Purpose
La aplicación web SHALL ser una SPA (React + Vite + TypeScript) que reproduzca las 8 pantallas del prototipo Obsidian Sentinel — resumen del SOC, ataques en vivo, mapa geográfico, automatización y respuesta, malware & IoC, login, matriz MITRE ATT&CK y explorador de eventos — consumiendo la API del SOC con login, datos en vivo y el design system definido.

## Requirements

### Requirement: La aplicación SHALL ser un SPA con las 8 pantallas del prototipo
La aplicación web (`web/`, React + Vite + TypeScript) SHALL implementar una Single Page Application con navegación por router que reproduzca las 8 pantallas del prototipo Stitch: Resumen del SOC, Ataques en Vivo, Mapa Geográfico, Automatización y Respuesta, Malware & IoC, Login, Matriz MITRE ATT&CK y Explorador de Eventos.

#### Scenario: Navegación entre pantallas
- **WHEN** el usuario autenticado navega por el sidebar
- **THEN** el router cambia de vista sin recargar la página
- **AND** cada pantalla corresponde a una ruta única (ej. `/`, `/live`, `/mapa`, `/automatizacion`, `/malware`, `/login`, `/mitre`, `/eventos`)

#### Scenario: Ruta desconocida
- **WHEN** el usuario ingresa una ruta que no existe en la app
- **THEN** la app muestra una vista 404 con acceso a la navegación principal

### Requirement: El flujo de login SHALL autenticar contra la API
La pantalla Login SHALL enviar las credenciales a `POST /api/v1/auth/login`, almacenar la sesión (cookie/token emitido) y redirigir al dashboard. Las rutas de la app SHALL estar protegidas: sin sesión válida, el usuario es redirigido a `/login`.

#### Scenario: Login exitoso
- **WHEN** el usuario ingresa credenciales válidas y envía el formulario
- **THEN** la app redirige al Resumen del SOC
- **AND** el estado de la sesión queda disponible en toda la app (contexto/estado global)

#### Scenario: Login fallido
- **WHEN** el usuario ingresa credenciales inválidas
- **THEN** la app muestra un error en pantalla y NO redirige

#### Scenario: Acceso a ruta protegida sin sesión
- **WHEN** un usuario sin sesión intenta abrir una ruta protegida
- **THEN** la app redirige a `/login`

#### Scenario: Logout
- **WHEN** el usuario cierra sesión
- **THEN** la app llama a `POST /api/v1/auth/logout`, limpia el estado local y redirige a `/login`

### Requirement: El Resumen del SOC SHALL mostrar métricas reales del overview
La pantalla "Resumen del SOC" SHALL consumir `GET /api/v1/overview` y mostrar: total de ataques (rango), alertas críticas recientes, amenazas/IPs únicas, eventos por honeypot, top IPs atacantes con su risk score, comparativa Cowrie/Dionaea y MTTD/MTTR estimados.

#### Scenario: Dashboard con datos
- **WHEN** el usuario abre el Resumen y la API devuelve métricas
- **THEN** las tarjetas de métricas, el top de IPs y la comparativa de honeypots se renderizan con los valores reales

#### Scenario: Dashboard sin datos
- **WHEN** la API devuelve métricas en cero/vacías
- **THEN** la pantalla muestra estados vacíos/ceros sin errores de render

#### Scenario: Error de API en el dashboard
- **WHEN** la API no responde o responde con error
- **THEN** la pantalla muestra un estado de error con opción de reintentar

### Requirement: Ataques en Vivo SHALL actualizarse sin recargar la página
La pantalla "Ataques en Vivo" SHALL suscribirse a `GET /api/v1/events/live` (SSE) y mostrar el feed de eventos nuevos en tiempo real (timestamp, IP origen, honeypot, protocolo, técnica MITRE, severidad), con indicador visual de eventos/segundo y panel de amenaza activa.

#### Scenario: Evento nuevo sin recargar
- **WHEN** un evento nuevo llega por SSE mientras la pantalla está abierta
- **THEN** el feed se actualiza automáticamente añadiendo el evento sin recargar la página

#### Scenario: Degradación a polling
- **WHEN** la conexión SSE falla o no está disponible
- **THEN** la pantalla degrada a polling de `GET /api/v1/events` (últimos eventos) con intervalo corto y lo indica en la UI

#### Scenario: Sesión expirada durante la suscripción
- **WHEN** el token expira mientras el feed está activo y la API responde 401
- **THEN** la app redirige al login o renueva la sesión según la estrategia de auth

### Requirement: El Explorador de Eventos SHALL filtrar, paginar y exportar
La pantalla "Explorador de Eventos" SHALL consumir `GET /api/v1/events` con filtros combinables (fecha, severidad, honeypot, protocolo, IP, técnica MITRE, búsqueda de texto), paginación y exportación a CSV de los resultados filtrados.

#### Scenario: Filtrar por severidad y honeypot
- **WHEN** el usuario selecciona severidad y honeypot en los controles
- **THEN** la tabla se actualiza mostrando solo los eventos que cumplen ambos filtros

#### Scenario: Búsqueda de texto
- **WHEN** el usuario escribe un término de búsqueda
- **THEN** la tabla se acota a eventos cuyo `commands`/`raw_data` contiene el término

#### Scenario: Paginación
- **WHEN** la lista supera el tamaño de página
- **THEN** se muestran controles de paginación que navegan entre páginas

#### Scenario: Exportar CSV
- **WHEN** el usuario pulsa exportar
- **THEN** se descarga un CSV con los eventos filtrados actuales

#### Scenario: Detalle de evento
- **WHEN** el usuario selecciona un evento de la tabla
- **THEN** se abre el detalle consumiendo `GET /api/v1/events/{id}` con `raw_data` y respuestas asociadas

### Requirement: La Matriz MITRE ATT&CK SHALL mostrar las técnicas observadas
La pantalla "Matriz MITRE ATT&CK" SHALL consumir `GET /api/v1/mitre` y presentar las técnicas detectadas organizadas por táctica, con conteo de eventos por técnica y navegación hacia el explorador filtrado por técnica.

#### Scenario: Matriz con técnicas observadas
- **WHEN** hay eventos con `att_ck_technique` poblado
- **THEN** la matriz renderiza las técnicas con su conteo agrupadas por táctica

#### Scenario: Sin técnicas
- **WHEN** no hay técnicas registradas
- **THEN** la matriz se muestra vacía con un mensaje de estado vacío sin errores

#### Scenario: Filtrar explorador por técnica
- **WHEN** el usuario selecciona una técnica en la matriz
- **THEN** la app navega al Explorador de Eventos con esa técnica aplicada como filtro

### Requirement: El Mapa Geográfico SHALL mostrar el origen de los ataques
La pantalla "Mapa Geográfico" SHALL consumir `GET /api/v1/geo/countries` y visualizar los países de origen con su cantidad de eventos (mapa o lista agrupada), degradando con gracia cuando la data geo sea escasa.

#### Scenario: Mapa con geolocalización
- **WHEN** hay eventos con país en `enrichment_data`
- **THEN** el mapa/lista muestra los países con su cantidad de eventos

#### Scenario: Sin data geo
- **WHEN** no hay datos geográficos en el rango
- **THEN** la pantalla muestra un estado vacío informativo sin errores

### Requirement: Malware & IoC SHALL listar muestras e indicadores
La pantalla "Malware & IoC" SHALL consumir `GET /api/v1/malware` y `GET /api/v1/iocs` y mostrar: hashes de malware con archivo/origen, tabla de IoCs con tipo/severidad, y búsqueda por valor.

#### Scenario: Listado de malware
- **WHEN** hay eventos con `malware_hash`
- **THEN** se muestran los hashes únicos con frecuencia, archivo, `src_ip` y `timestamp`

#### Scenario: Listado y búsqueda de IoCs
- **WHEN** el usuario busca por valor o filtra por tipo
- **THEN** la tabla de IoCs se acota a los resultados coincidentes

### Requirement: Automatización y Respuesta SHALL orquestar acciones reales
La pantalla "Automatización y Respuesta" SHALL consumir `GET /api/v1/automation/workflows`, `GET /api/v1/automation/executions` y `GET /api/v1/automation/responses`, mostrar el estado de los pipelines n8n, y ofrecer las acciones de simulación de ataque (`POST /api/v1/automation/simulate`), bloqueo de IP (`POST /api/v1/automation/block-ip`) y creación de ticket GLPI (`POST /api/v1/automation/create-ticket`).

#### Scenario: Ver workflows y ejecuciones
- **WHEN** la pantalla se abre con n8n disponible
- **THEN** se listan los workflows de n8n con su estado y las ejecuciones recientes

#### Scenario: Simular ataque desde la UI
- **WHEN** el usuario elige honeypot, ingresa un payload/escenario y confirma
- **THEN** la app llama a `simulate` y muestra el resultado del webhook
- **AND** el evento resultante aparece luego en el feed/explorador

#### Scenario: Bloquear IP desde la UI
- **WHEN** el usuario ingresa una IP (y evento origen/duration opcionales) y confirma
- **THEN** la app llama a `block-ip` y muestra el resultado de la respuesta automática

#### Scenario: Crear ticket GLPI desde la UI
- **WHEN** el usuario ingresa nombre, contenido y urgencia del ticket y confirma
- **THEN** la app llama a `create-ticket` y muestra el resultado de la respuesta automática

#### Scenario: Estado degradado de n8n
- **WHEN** n8n no está disponible
- **THEN** la pantalla muestra el estado degradado y deshabilita las acciones que requieren n8n

### Requirement: La UI SHALL seguir el design system Obsidian Sentinel
La aplicación SHALL implementar el design system del prototipo: dark-first (fondos `#0a0a0c`/`#0f172a`/`#1e293b`), accent cyan `#06b6d4`, tipografía Inter + JetBrains Mono (telemetría), escala de severidad semántica (low/medium/high/critical) y sidebar fijo de 240px.

#### Scenario: Tokens de diseño aplicados
- **WHEN** se inspecciona el CSS de la app
- **THEN** las variables de color/fuente/sombra corresponden al design system Obsidian Sentinel

#### Scenario: Telemetría en JetBrains Mono
- **WHEN** se renderizan IPs, hashes, IDs de técnica o comandos
- **THEN** usan fuente monoespaciada JetBrains Mono

#### Scenario: Severidad semántica
- **WHEN** un evento tiene severidad critical
- **THEN** se renderiza con el color/estilo de la escala de severidad definida (rojo para crítico)