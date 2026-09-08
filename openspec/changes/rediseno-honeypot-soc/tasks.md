## 1. Identidad v3 en tokens

- [ ] 1.1 Re-mapear en `web/src/styles/tokens.css` los valores v3: `--bg-base #0a0a0b`, superficies `#131319`/`#0f0f12`, `--text-primary #f2f2f4`, secondary `#a1a1ab`, `--accent #5468ff`, `--accent-strong #4353cc`, `--accent-soft rgba(84,104,255,0.18)`, `--accent-contrast #101218`, bordes `#1f1f24`/`#23232b`, `--success #5ce0a8`, `--link #a7b0ff`, `--link-hover #cdd2ff`, `--selection rgba(84,104,255,0.35)`, `--focus-ring #5468ff`
- [ ] 1.2 Aplicar severidades v3 tono-por-tono en `tokens.css`: crítico fg `#ff8f80`/borde `rgba(255,90,70,0.38)`/bg `rgba(255,80,60,0.14)`, alto fg `#ffc46b`, medio fg `#a7b0ff`, bajo fg `#a1a1ab` (manteniendo los `--severity-*-soft` vía `color-mix`)
- [ ] 1.3 Agregar tokens v3 nuevos en `tokens.css`: `--grid-line rgba(255,255,255,0.016)`, `--bg-radial rgba(84,104,255,0.13)`, `--sidebar-w 272px`
- [ ] 1.4 Agregar dependencia `@fontsource/chivo` en `web/package.json` e importar weights 400/500/700 latin en el entry de la web
- [ ] 1.5 Poner `--font-ui` en la pila Chivo y conservar `--font-mono` (JetBrains Mono) para telemetría
- [ ] 1.6 Sincronizar `web/src/lib/colorTokens.ts` en lockstep (`TOKEN_ACCENT #5468ff`, `TOKEN_ACCENT_STRONG #4353cc`, `TOKEN_BG_ELEVATED` v3)
- [ ] 1.7 Re-derivar en `web/src/features/geo-map/colorScale.ts` la rampa `BUCKET_COLORS` (5 buckets azul v3) y `MAP_NEUTRAL_COLOR` desde los nuevos accent/bg-elevated
- [ ] 1.8 Implementar el fondo v3 con `body::before` (gradiente radial `rgba(84,104,255,0.13)` + grid overlay 56px `rgba(255,255,255,0.016)`, `pointer-events:none`, estático) en `web/src/styles/app.css`
- [ ] 1.9 Verificar Fase 1: `pnpm --dir web test` (incluye `colorScale.test.ts` del drift test), `pnpm --dir web lint`, `pnpm --dir web build`, y auditar contraste AA del login standalone contra el mockup v3

## 2. Componentes v3 por pantalla

- [ ] 2.1 Sidebar v3: gradiente `linear-gradient(180deg,#131319,#0c0c10 62%,#090909)`, icono escudo `linear-gradient(150deg,#38449e,#141733)`, marca "HONEYPOT SOC / threat ops", sección "Operación" con item activo (barra 3px + gradiente), panel "Servicios" con estados de `useHealth` (operativo/degradado/caído), "Cerrar sesión", `--sidebar-w 272px`, rail ≤900px conservado
- [ ] 2.2 Header v3: kicker mono uppercase de la sección + título (de `SECTION_BY_PATH`), dot verde pulsante "24 H" a la derecha (pulse envuelto en `prefers-reduced-motion`), botón "Exportar CSV" existente en el Resumen
- [ ] 2.3 Login v3: card `linear-gradient(165deg,#14141b,#0c0c10 62%)`, heading "HONEYPOT SOC / threat ops", indicador "API en línea · v3.0" con pulse, campos Usuario/Contraseña existentes, botón "Ingresar"
- [ ] 2.4 Banner "Amenaza activa · severidad crítica" en `AtaquesEnVivo` sobre el evento real de severidad máxima del feed (IP/honeypot/técnica/timestamp, sin inventar campos), con scan line respetando `prefers-reduced-motion` y botón "Investigar" que abre el `EventDetailDrawer`
- [ ] 2.5 Chips del feed: estado de conexión (SSE/polling/offline), eventos/s, "en ventana", y botón Pausar/Reanudar (UI-only: congela buffer y ventana EPS, mantiene suscripción SSE)
- [ ] 2.6 Drawer de incidente v3: donut SVG de risk score con label central mono + `SeverityBadge`, grid de detalles (IP, geo/ASN, honeypot, protocolo, usuario, password, técnica, sesión, hash, detectado)
- [ ] 2.7 Pipeline de automatización n8n en el drawer: timeline vertical de nodos derivado de `responses` (`action_type` como nombre, estado ok/pendiente/reintento según `status`, timestamp, `details` mono), con empty state conservado
- [ ] 2.8 Bloques "Comandos ejecutados en la sesión" y `raw_data` re-estilizados (surface/borde/padding v3, mono, `overflow-x:auto`) en el drawer
- [ ] 2.9 Explorador/EventsTable, MITRE, mapa (colorScale re-derivado en 1.7), Malware/IoC, Automatización, Workflows n8n y 404 re-estilizados a la identidad v3 (sin residuos cyan)
- [ ] 2.10 Verificar Fase 2: `pnpm --dir web test`, `pnpm --dir web lint`, `pnpm --dir web build`, y recorrido manual de las 10 pantallas contra `Honeypot SOC v3.dc.html`

## 3. Resumen bento

- [ ] 3.1 Reestructurar `web/src/features/overview/Resumen.tsx` a bento grid CSS (4 columnas, gap ~12px, tiles con spans por clase, reflujo 2→1 columna responsive)
- [ ] 3.2 Tile hero (span 2×2): "Total de ataques · 24 h" con `overview.total_eventos` formateado con `Intl.NumberFormat('es-AR')` y sub-stats reales (`ips_unicas`, `total_malware`, count de `alertas_criticas`)
- [ ] 3.3 Tile "Eventos por honeypot": barras de progreso con `eventos_por_honeypot` y montos alineados (contenedor con `max-width`)
- [ ] 3.4 Tiles "MTTD"/"MTTR" 1×1: `mttd_seconds`/`mttr_seconds` formateados en mono con hint de descripción
- [ ] 3.5 Fila inferior: "Top IPs atacantes" (columnas IP/count/risk existentes) y "Alertas críticas" clickeable a detalle (list de `alertas_criticas`)
- [ ] 3.6 Conservar loading/error/empty states existentes dentro de los tiles de la bento grid
- [ ] 3.7 Verificar Fase 3: `pnpm --dir web test`, `pnpm --dir web lint`, `pnpm --dir web build`, comparación visual del layout contra `Opcion B - Bento.dc.html` y del color contra `Honeypot SOC v3.dc.html`

## 4. Verificación y barrido

- [ ] 4.1 Barrido final `rg '06b6d4|0891b2|111827|243244'` en `web/src` sin resultados (sin residuos del look cyan anterior)
- [ ] 4.2 Auditoría de contraste AA (≥4.5:1) sobre superficies near-black de primary/secondary/faint nuevos; ajustar faint no esencial o subirlo a `#8b8b95` si falla
- [ ] 4.3 Auditoría `prefers-reduced-motion` (desactivar scan/pulse/row-flash) y foco visible 2px `#5468ff` en toda la app
- [ ] 4.4 Checklist final contra mockups: identidad v3 en las 10 pantallas (Resumen, Ataques en Vivo, Explorador, MITRE, Mapa, Malware/IoC, Automatización, Workflows n8n, Login, 404), `openspec verify` del change, y confirmación apply-ready con `openspec status --change "rediseno-honeypot-soc"`