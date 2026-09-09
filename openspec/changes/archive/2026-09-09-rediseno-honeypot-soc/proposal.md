## Why

La web del SOC sigue la estética "Obsidian Sentinel" (accent cyan `#06b6d4`, superficies azuladas `#0f172a`/`#1e293b`, Inter) que ya no coincide con el diseño definitivo de la tesis: el mockup aprobado "Honeypot SOC v3" define una identidad **"threat ops"** (acento azul `#5468ff`, fondo near-black `#0a0a0b`, tipografía Chivo, gradiente radial + grid sutil) y el "Resumen" debe pasar a una **bento grid** de tiles de tamaños variados (opción B aprobada). El `polish-ui` ya entregó la base token-driven (escalas `--space/--text/--z/--severity-*-soft`, primitivas `.btn/.field/.badge/.overlay/.error-box`, `useDialogLock`, sidebar rail ≤900px, a11y). Este change re-aplica esa misma base con los valores y componentes visuales de la v3, preservando el 100% de la funcionalidad. Para una defensa de tesis, la identidad visual es parte del entregable.

## What Changes

**IDENTIDAD v3 "threat ops" (todos los valores de diseño)**
- Paleta: accent azul `#5468ff` (focus-visible igual), links `#a7b0ff` → hover `#cdd2ff`, selection `rgba(84,104,255,0.35)`.
- Superficies near-black: fondo base `#0a0a0b`, texto `#f2f2f4`, bordes `#23232b`/`#1f1f24`, superficies `#0f0f12`/`#131319`, elevados con gradientes azulados (`#141733` → `#0d0d12`).
- Fondo de página: `radial-gradient(1100px 600px at 12% -10%, rgba(84,104,255,0.13), transparent 68%)` + grid overlay horizontal y vertical `rgba(255,255,255,0.016)` cada 56px.
- Tipografía: **Chivo** para toda la UI (`@fontsource/chivo`, nueva dependencia font-only; la consola corre sin internet por lo que debe empaquetarse local), headings weight 500 con `letter-spacing:-0.02em`, body 14px/1.5 antialiased. **JetBrains Mono se conserva** para toda la telemetría (IPs, hashes, técnica, comandos, risk scores, timestamps).
- Selección de texto y estado de la "API en línea v3.0" (dot verde con pulse).

**COMPONENTES VISUALES v3 (nuevos, sobre el incident detail y el login)**
- Login v3: "HONEYPOT SOC / threat ops", card con gradiente `#14141b → #0c0c10`, campos Usuario/Contraseña (labels Space-Mono uppercase), botón "Ingresar", indicador "API en línea · v3.0".
- Header top bar: kicker (ruta) + título, control "24 H" con dot pulse, y en Resumen el botón "Exportar CSV".
- Sección de alertas: header "Alertas críticas recientes" con contador "6 SIN CERRAR".
- Feed en vivo: chips "Conexión SSE activa", `ev/s`, "en ventana", botón Pausar/Reanudar feed, y banner "Amenaza activa — severidad crítica" (borde/bg rojos suaves, scan line, botón "Investigar").
- Detalle de incidente (EventDetailDrawer): Risk score 78/100 con donut SVG y badge "Crítico", grid `dl` de detalles, "Pipeline de automatización n8n" (timeline vertical de nodos ok/pendiente/reintento con dot + ring), "Comandos ejecutados en la sesión" (bloque `pre` mono) y `raw_data` (bloque `pre` mono colapsable).

**RESUMEN BENTO (opción B)**
- El Resumen pasa de "metric-grid + panel-grid" a una **bento grid** de tiles de tamaños variados sobre los mismos datos reales de `GET /api/v1/overview`:
  - Tile grande (span 2×2): "Total de ataques · 24 h" con `1 284`, sub-stats "213 IPs únicas / 17 muestras / N críticas".
  - Tiles de stat: Eventos por honeypot (barras), MTTD ("42 s · detección media"), MTTR ("3m 18s · respuesta media").
  - Segunda fila: Top IPs atacantes (IP, count, risk badge) y Alertas críticas (list).
- No se inventan campos de datos: se re-mapean los campos reales de `useOverview` (total_eventos, ips_unicas, alertas_criticas, eventos_por_honeypot, top_ips, mttd_seconds/mttr_seconds). Las cuevas de los mockups (1 284, 6 críticas, etc.) son referencia VISUAL, no contrato.

**MANTENER TODAS LAS PANTALLAS**
- La identidad v3 se aplica a TODAS las pantallas existentes (Resumen, Ataques en Vivo, Explorador de Eventos, MITRE ATT&CK, Mapa Geográfico, Malware/IoC, Automatización, Workflows n8n, Login, 404) para que ninguna conserve el look cyan anterior. Las pantallas que no son Resumen conservan su layout funcional actual, solo re-estilizado.

**FUNCIONALIDAD INTACTA**
- No cambia ningún endpoint, contrato de datos, workflow n8n ni esquema de DB. No se agregan características. Los tests existentes no se rompen (el test de drift `colorScale.test.ts` exige actualizar `colorTokens.ts` al mismo tiempo que `tokens.css`).

## Capabilities

### New Capabilities
- _(ninguna nueva — los componentes visuales nuevos se modelan como requirements dentro de `web-soc-ui` para mantener el cambio mínimo y evita especificaciones fragmentadas)_

### Modified Capabilities
- `web-soc-ui`: El requisito de design system (hoy "La UI SHALL seguir el design system Obsidian Sentinel") se reescribe a la identidad v3 "threat ops": paleta `#5468ff`, superficies near-black, tipografía Chivo (UI) + JetBrains Mono (telemetría), fondo con gradiente radial + grid overlay, primitivas/escaleas conservadas de polish-ui, sidebar con brand "HONEYPOT SOC / threat ops", Resumen en bento grid (requirement nuevo del Resumen), componentes visuales v3 (risk score, pipeline timeline, comandos/raw_data, banner amenaza activa), y login v3.

## Impact

- **CSS**: `web/src/styles/tokens.css` (valores de color/fuentes re-mapeados a v3, nuevo stack Chivo) y `web/src/styles/app.css` (fondo v3 con gradiente+grid, superficies near-black, componentes v3: bento tiles, donut, timeline, `pre` blocks, banner amenaza, chips de feed, login v3).
- **Componentes/features**: `web/src/features/auth/Login.tsx`, `web/src/components/Sidebar.tsx`, `web/src/components/Header.tsx`, `web/src/features/overview/Resumen.tsx` (bento), `web/src/features/live-feed/AtaquesEnVivo.tsx` (banner amenaza + chips), `web/src/features/events-explorer/EventDetailDrawer.tsx` (risk score, pipeline timeline, comandos, raw_data), `web/src/components/SeverityBadge.tsx` (severity con badges v3).
- **Código TS**: `web/src/lib/colorTokens.ts` (valores accent/bg-elevated nuevos; el test `colorScale.test.ts` que lee `tokens.css` fallará si no se actualizan en conjunto), `web/src/features/geo-map/colorScale.ts` (BUCKET_COLORS re-derivados del azul).
- **Dependencias**: AGREGADA `@fontsource/chivo` (única dependencia nueva, font-only empaquetada localmente — la consola corre en red interna sin internet). Ninguna dependencia eliminada.
- **Verificación**: `pnpm --dir web test` (vitest, incluye drift de colorTokens), `pnpm --dir web lint`, `pnpm --dir web build` todos verdes; checkpoint visual manual de las 10 pantallas contra los mockups v3 en `Honeypot SOC v3.dc.html` y `Opcion B - Bento.dc.html`.
- **Sin cambios de API/servidores/DB/n8n**: ningún endpoint del backend, workflow n8n o esquema PostgreSQL se modifica.