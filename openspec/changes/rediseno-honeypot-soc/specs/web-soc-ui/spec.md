## RENAMED Requirements

- FROM: `### Requirement: La UI SHALL seguir el design system Obsidian Sentinel`
- TO: `### Requirement: La UI SHALL seguir la identidad v3 "threat ops"`

## MODIFIED Requirements

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