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
La pantalla "Resumen del SOC" SHALL consumir `GET /api/v1/overview` y mostrar, en una **bento grid** de tiles de tamaños variados, los mismos datos de siempre: total de ataques (con sub-stats de IPs únicas, muestras de malware y críticas), eventos por honeypot, MTTD/MTTR estimados, top IPs atacantes con su risk score y alertas críticas recientes. No SHALL inventarse campos de datos: las cifras decorativas del mockup (1 284, 213 IPs, 6 críticas) son referencia visual, no contrato.

#### Scenario: Dashboard bento con datos
- **WHEN** el usuario abre el Resumen y la API devuelve métricas
- **THEN** la bento grid renderiza: un tile grande (span 2×2) "Total de ataques · 24 h" con el total real y sus sub-stats (`ips_unicas`, `total_malware`, cantidad de críticas), un tile "Eventos por honeypot" con barras de progreso, tiles de "MTTD" / "MTTR" con sus valore en mono y hint de descripción, y en la segunda fila "Top IPs atacantes" (IP, count, risk) y "Alertas críticas" (list clickeable a detalle)

#### Scenario: Dashboard sin datos
- **WHEN** la API devuelve métricas en cero/vacías
- **THEN** la pantalla muestra los estados vacíos/ceros existentes dentro de los tiles de la bento grid sin errores de render

#### Scenario: Error de API en el dashboard
- **WHEN** la API no responde o responde con error
- **THEN** la pantalla muestra el estado de error existente con opción de reintentar, conservando la estructura de pantalla

#### Scenario: Bento grid responsive
- **WHEN** el viewport se reduce por debajo del ancho de 4 columnas
- **THEN** los tiles refluyen a menos columnas (2 → 1) sin solaparse ni perder datos, manteniendo legibilidad

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

### Requirement: La UI SHALL seguir la identidad v3 "threat ops"
La aplicación SHALL implementar la identidad visual v3 "threat ops" del mockup `Honeypot SOC v3.dc.html`: dark-first near-black (fondo base `#0a0a0b`, texto `#f2f2f4`, bordes `#1f1f24`/`#23232b`, superficies `#0f0f12`/`#131319`), accent azul `#5468ff` (también para el focus-visible), enlaces `#a7b0ff` → hover `#cdd2ff`, selección de texto `rgba(84,104,255,0.35)`, y fondo de página con gradiente radial `rgba(84,104,255,0.13)` + grid overlay horizontal/vertical de `rgba(255,255,255,0.016)` cada 56px. La tipografía SHALL ser Chivo para toda la UI (headings weight 500 con `letter-spacing:-0.02em`, body 14px/1.5 antialiased) y JetBrains Mono para toda la telemetría. La escala de severidad, el sidebar rail ≤900px y las primitivas compartidas (`.btn`, `.field`, `.label`, `.badge`, `.overlay`, `.error-box`) del design system anterior SHALL conservarse. La identidad SHALL aplicarse a TODAS las pantallas (Resumen, Ataques en Vivo, Explorador, MITRE, Mapa, Malware/IoC, Automatización, Workflows n8n, Login, 404).

#### Scenario: Tokens de diseño v3 aplicados
- **WHEN** se inspecciona el CSS de la app
- **THEN** las variables de color/fuente corresponden a la identidad v3 (accent `#5468ff`, fondos near-black, superficiales elevadas azuladas) y no queda ningún valor del look cyan anterior (accent `#06b6d4`, superficies `#111827`/`#243244`)

#### Scenario: Fondo con gradiente radial y grid overlay
- **WHEN** se visualiza la app autenticada
- **THEN** el fondo de página muestra el gradiente radial azul en la esquina superior izquierda (`radial-gradient(1100px 600px at 12% -10%, rgba(84,104,255,0.13), transparent 68%)`) con un grid overlay sutil horizontal y vertical de 56px, sin interferir con los textos ni el contraste

#### Scenario: Tipografía de UI Chivo y telemetría mono
- **WHEN** se inspecciona la pila de fuentes de la app
- **THEN** `--font-ui` usa Chivo (empaquetado localmente vía `@fontsource/chivo`) para headings y body
- **AND** `--font-mono` conserva JetBrains Mono para IPs, hashes, IDs de técnica, risk scores, timestamps, comandos y `raw_data`

#### Scenario: Escalas y primitivas del design system conservadas
- **WHEN** se inspecciona `tokens.css` y `app.css`
- **THEN** siguen existiendo las escalas `--space-*`, `--text-*`, `--z-*`, `--severity-*-soft`, `--focus-ring`, `--duration-*` y `--radius-lg` introducidas por el cambio polish-ui
- **AND** los controles repetidos siguen usando las primitivas compartidas (`.btn` con variants, `.field`, `.label`, `.badge`, `.overlay`, `.error-box`) sin recetas duplicadas

#### Scenario: Severidad semántica con fuente única de verdad
- **WHEN** se cambia una variable `--severity-*` base
- **THEN** sus variantes soft/borde (fondos de badge, focus indirecto, zebra de severidad) se actualizan sin edición manual adicional, manteniendo la legibilidad AA sobre las superficies near-black

#### Scenario: Identidad de marca y login v3
- **WHEN** el usuario entra a la app o ve el login
- **THEN** el branding muestra "HONEYPOT SOC / threat ops" con el icono de escudo con gradiente azul `#38449e → #141733`
- **AND** el login v3 muestra la card con gradiente `linear-gradient(165deg,#14141b,#0c0c10 62%)`, campos Usuario/Contraseña con labels mono uppercase, botón "Ingresar" y el indicador verde "API en línea · v3.0" con pulse

#### Scenario: Sidebar con branding v3 y servicios
- **WHEN** el usuario ve el sidebar expandido o colapsado
- **THEN** muestra la marca "HONEYPOT SOC / threat ops", la navegación "Operación" con el item activo resaltado en azul (marca de 3px a la izquierda + gradiente), el panel "Servicios" con estado operativo/degradado/caído, y el botón "Cerrar sesión"
- **AND** a ≤900px colapsa a rail de iconos sin perder accesibilidad ni navegación

#### Scenario: Top bar con kicker, "24 H" y Exportar CSV
- **WHEN** el usuario está en una pantalla de la app autenticada
- **THEN** el header sticky con blur muestra el kicker de la sección (label mono uppercase) y el título, el control "24 H" con dot verde pulsante a la derecha, y en el Resumen además el botón "Exportar CSV"

#### Scenario: Banner de amenaza activa en Ataques en Vivo
- **WHEN** el feed en vivo recibe eventos y existe un evento de severidad máxima
- **THEN** se muestra el banner "Amenaza activa · severidad crítica" con borde/bg rojos suaves, scan line animada, la IP/honeypot/técnica/timestamp del evento real, y un botón "Investigar" que abre el detalle del incidente

#### Scenario: Detalle de incidente con componentes v3
- **WHEN** el usuario abre el detalle de un evento
- **THEN** se muestran: risk score con donut SVG y badge de severidad (Crítico/Alto/Medio/Bajo), grid de detalles (IP origen, geo/ASN, honeypot, protocolo, usuario, password, técnica, sesión, hash, detectado), el pipeline de automatización n8n como timeline vertical de nodos con estado ok/pendiente/reintento, el bloque "Comandos ejecutados en la sesión" y el bloque `raw_data`, todos en fuente mono

#### Scenario: Navegación y priorización de severidad crítica
- **WHEN** los riesgos se muestran en top IPs o alertas
- **THEN** usan la escala de severidad v3 tono-por-tono (rojo para crítico, ámbar para alto, azul para medio, neutro para bajo) y el contador de alertas sin cerrar ("N SIN CERRAR") refleja las alertas críticas reales pendientes

#### Scenario: Contraste AA y accesibilidad preservados en la identidad v3
- **WHEN** se mide el contraste del texto normal y secundario sobre las superficies near-black v3
- **THEN** el ratio es ≥4.5:1 (AA) en los tamaños usados, el focus-visible es de 2px en accent `#5468ff`, se respeta `prefers-reduced-motion` (sin scan/pulse/row-flash en modo reducir) y se conserva la operabilidad por teclado, la gestión de foco en overlays y los landmarks semánticos

