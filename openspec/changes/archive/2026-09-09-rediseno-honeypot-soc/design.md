## Context

`polish-ui` (cerrado y archivado en `openspec/changes/archive/2026-09-08-polish-ui/`) dejó una base sólida: escalas de tokens (`--space-*`, `--text-*`, `--z-*`, `--duration-*`, `--radius-lg`, `--focus-ring`, `--severity-*-soft` vía `color-mix`), primitivas compartidas (`--btn`, `--field`, `--label`, `--badge`, `--overlay`, `--error-box`), hook `useDialogLock`, sidebar rail ≤900px, y la capacidad `ui-accessibility` en verde (129 tests). Sobre esa base, la identidad actual es "Obsidian Sentinel" (accent cyan `#06b6d4`, superficies azul pizarra `#111827`/`#243244`, fuente Inter).

El usuario aprobó la identidad v3 "threat ops" del mockup `Honeypot SOC v3.dc.html` (dark-first near-black con accent azul `#5468ff`, Chivo, gradiente radial + grid overlay) y el layout de dashboard tipo bento del mockup `Opcion B - Bento.dc.html` (solo layout: las cifras y el morado `#9184d9` de ese mockup NO se adoptan). Este cambio es DECLARATIVO y de UI: re-mapea tokens y componentes visuales. No toca API, base de datos, ni workflows n8n. No se propone ningún capability nuevo: solo se modifica `web-soc-ui` (requirements) y se mantiene `ui-accessibility` intacta y en verde.

## Goals

- Aplicar la identidad v3 a TODAS las pantallas (Resumen, Ataques en Vivo, Explorador, MITRE, Mapa, Malware/IoC, Automatización, Workflows n8n, Login, 404) sin rastro del look cyan anterior.
- Re-mapear los valores de tokens en `web/src/styles/tokens.css` (fuente única de verdad) y sincronizar el duplicado de TypeScript en `web/src/lib/colorTokens.ts` para que el test antidrift (`colorScale.test.ts`) siga verde.
- Implementar el Resumen como bento grid consumiendo los MISMOS campos reales de `GET /api/v1/overview` de hoy (sin inventar datos).
- Introducir los componentes visuales v3: donut de risk score, timeline de pipeline n8n, bloques mono de comandos/`raw_data`, banner de amenaza activa, chips de estado del feed, login v3, sidebar v3.
- Mantener la funcionalidad intacta (lo único nuevo es un botón Pausar/Reanudar del feed, UI-only, ver Decisión 8).
- Mantener `ui-accessibility` en verde: contraste AA sobre superficies near-black, focus-visible `#5468ff`, `prefers-reduced-motion`, operabilidad por teclado.

## Non-Goals

- NO cambia la API, el esquema de datos, la base de datos ni los workflows n8n. Los números del mockup (1 284, 213 IPs, 6 críticas) son referencia visual, no contrato.
- NO migra de framework CSS (se sigue con CSS vanilla + tokens; NO Tailwind ni librerías de UI).
- NO agrega features nuevas (sin exportar CSV nuevo, sin mapa nuevo, sin capacidades nuevas).
- NO rompe tests existentes ni degrada la accesibilidad.
- NO toca el capability spec `ui-accessibility` (queda sin cambios en el repo).
- NO introduce capturas/goldens de pantalla ni tooling de diseño.

## Decisions

### D1 — Re-mapeo de tokens de color en `tokens.css` (single source of truth)

Se cambian SOLO los valores; la semántica y estructura de tokens (escalas, primitivas, `--severity-*-soft` con `color-mix`) se conserva. Mapeo principal:

| Token | Antes | V3 |
| --- | --- | --- |
| `--bg-base` | `#08080a` | `#0a0a0b` |
| `--bg-surface`, `--bg-elevated` | `#111827`, `#243244` | `#131319`, `#0f0f12` (superficies azuladas near-black) |
| `--text-primary` | `#e2e8f0` | `#f2f2f4` |
| `--text-secondary/faint` | `#9ca3af`, `#64748b` | `#a1a1ab`, `#6e6e78` (auditar ≥12px/faint ≥ `#8b8b95` para AA) |
| `--accent` | `#06b6d4` | `#5468ff` |
| `--accent-strong` | `#0891b2` | `#4353cc` |
| `--accent-soft`, `--accent-contrast` | cyan-soft, `#062a30` | `rgba(84,104,255,0.18)`, `#101218` |
| `--border-subtle` | `#273449` | `#1f1f24` / `#23232b` |
| `--success` | `#10b981` | `#5ce0a8` (verde del mockup `#5ce0a8`) |
| `--link`, `--link-hover` | `#0891b2`, `#06b6d4` | `#a7b0ff`, `#cdd2ff` |
| `--selection` | auto | `rgba(84,104,255,0.35)` |
| `--focus-ring` | `#06b6d4` | `#5468ff` (2px) |

Severidades v3 (tono-por-tono sobre near-black): crítico fg `#ff8f80` / borde `rgba(255,90,70,0.38)` / bg `rgba(255,80,60,0.14)`; alto fg `#ffc46b`; medio fg `#a7b0ff` (v3 usa azul para MEDIO, cambio intencional); bajo fg `#a1a1ab`. Nuevos tokens: `--grid-line rgba(255,255,255,0.016)`, `--bg-radial rgba(84,104,255,0.13)`, `--sidebar-w 272px` (expandido).

Los mockups son referencia VISUAL: ante un color que no se pueda mapear 1:1 por contraste (ej. `#6e6e78` too faint para texto <12px), prevalece AA (Decisión 7).

### D2 — Tipografía: Chivo (UI) + JetBrains Mono (telemetría)

El v3 usa Chivo. El repo es de red interna SIN internet en runtime; las fuentes se venden vía npm (ya hay `@fontsource/inter` y `@fontsource/jetbrains-mono`). Se agrega la dependencia `@fontsource/chivo` (solo fuentes, sin assets dinámicos), importando en el entry de la web los weights usados por el mockup (400/500/700) con subset latin. `--font-ui` pasa a la pila Chivo; `--font-mono` conserva JetBrains Mono. Los kickers del mockup usan Space Mono — NO se adopta: se conserva JetBrains Mono para todo lo mono (decisión previa del usuario). Trade-off: +peso de bundle (~3 woff2); ver Riesgo R2.

### D3 — Fondo de página v3: gradiente radial + grid overlay

Se implementa como pseudo-elemento fijo (`body::before`) con `pointer-events:none; z-index:0` detrás del `#root`, compuesto por:
- `radial-gradient(1100px 600px at 12% -10%, rgba(84,104,255,0.13), transparent 68%)`
- grid: `linear-gradient(rgba(255,255,255,0.016) 1px, transparent 1px) 0 0 / 100% 56px` +
- `linear-gradient(90deg, rgba(255,255,255,0.016) 1px, transparent 1px) 0 0 / 56px 100%`

Es estático (no anima), así que no interactúa con `prefers-reduced-motion`. No debe interferir con el contraste ni con la operabilidad (keyboard, lectura de pantalla).

### D4 — Resumen en bento grid (layout solo del mockup B)

`Resumen.tsx` se reestructura con CSS Grid explícito (4 columnas, ~12px gap) y tiles con spans controlados por clase (`--bento-tile--hero`, `--wide`, etc.), usando `minmax(0,1fr)` y reflujo a 2/1 columas en viewports angostos. Mapeo a datos reales:
- Tile hero (span 2×2): "Total de ataques · 24 h" → `overview.total_eventos`; sub-stats `ips_unicas` ("IPs únicas"), `total_malware` ("muestras de malware"), count de `alertas_criticas` (="críticas"). Monto con `Intl.NumberFormat('es-AR')`.
- "Eventos por honeypot": barras de progreso con `eventos_por_honeypot`, contenedor con `max-width` para que los montos queden alineados (like mockup).
- "MTTD" / "MTTR": tiles 1×1 con `mttd_seconds`/`mttr_seconds` formateados y hint de descripción.
- Fila inferior: "Top IPs atacantes" (todas las columnas de `top_ips` existentes: IP, count, risk) y "Alertas críticas" (list de `alertas_criticas` clickeable → detalle del evento).
- Los estados loading/error/empty existentes SE CONSERVAN dentro de los tiles (Scenario "Dashboard sin datos"/"Error de API").

### D5 — Componentes visuales v3 (datos reales, no inventados)

- **Donut de risk score** (`EventDetailDrawer`): SVG `<circle>` con `stroke-dasharray` sobre el `event.risk_score` (ya mostrado hoy como `<span className="font-mono">`), con label central en mono y badge de severidad (`SeverityBadge`).
- **Pipeline de automatización n8n**: timeline vertical de nodos derivado de `responses` (ya existe `ResponsesTable`): cada `ResponseItem` → nodo con `action_type` como nombre, estado ok/pendiente/reintento según `status`, `timestamp`, y `details` en mono. Estados vacío/ausentes degradan a los empty states actuales.
- **Comandos/`raw_data`**: se conservan los bloques `<pre className="raw-json">` existentes (fuente mono, `overflow-x:auto`), solo re-estilizados (surface, borde, padding) con las primitivas v3.
- **Banner de amenaza activa** (`AtaquesEnVivo`): se muestra sobre el evento real de severidad máxima del feed buffer (campos reales: IP, honeypot, técnica, timestamp), con borde/bg rojos suaves + scan line animada (envuelta en `prefers-reduced-motion`) y botón "Investigar" → `EventDetailDrawer`.
- **Chips del feed**: estado de conexión (SSE/polling/offline), eventos/s, "en ventana" (`events.length` / `MAX_LIVE_EVENTS`), botón Pausar/Reanudar (ver D8).
- **Top bar v3** (`Header`): kicker de sección mono uppercase + título (de `SECTION_BY_PATH`), dot verde pulsante con "24 H" a la derecha, y en Resumen el botón "Exportar CSV" existente.
- **Login v3** (`Login`): card con gradiente `linear-gradient(165deg,#14141b,#0c0c10 62%)`, heading "HONEYPOT SOC / threat ops", indicador verde "API en línea · v3.0" con pulse, campos Usuario/Contraseña existentes, botón "Ingresar".
- **Sidebar v3** (`Sidebar`): gradiente `linear-gradient(180deg,#131319 0%,#0c0c10 62%,#090909 100%)`, icono de escudo con gradiente `linear-gradient(150deg,#38449e,#141733)`, marca "HONEYPOT SOC / threat ops", sección "Operación" con item activo resaltado (barra 3px + gradiente), panel "Servicios" con estados de `useHealth` (operativo/degradado/caído), botón "Cerrar sesión". Ancho `--sidebar-w 272px`; a ≤900px rail de iconos (ya implementado por polish-ui).

### D6 — Sincronización colorTokens Drift Test (colorScale)

`web/src/lib/colorTokens.ts` duplica `TOKEN_ACCENT`/`TOKEN_ACCENT_STRONG`/`TOKEN_BG_ELEVATED` y `web/src/features/geo-map/colorScale.ts` deriva `BUCKET_COLORS`/`MAP_NEUTRAL_COLOR` de esos tokens; `colorScale.test.ts` lee `tokens.css` y falla en drift. En este cambio se actualizan EN LOCKSTEP: nuevo accent `#5468ff`, accent-strong `#4353cc`, bg-elevated `#0f0f12`/`#131319`, y la rampa del mapa se re-deriva a la escala azul v3 (los 5 buckets + neutral), conservando shocks/contraste de la rampa. El test, corregido para el caso de uso de siempre (igualdad con los nuevos valores), sigue siendo la salvaguarda: si algún deploy cambia el token sin actualizar `colorTokens.ts`, el test se rompe.

### D7 — Accesibilidad heredada (ui-accessibility intacta)

`openspec/specs/ui-accessibility/spec.md` no cambia. Toda decisión visual respeta: contraste AA (≥4.5:1) del texto sobre near-black; focus-visible 2px `#5468ff`; `prefers-reduced-motion` (scan line, pulse y flashes de fila se desactivan); operabilidad por teclado; `useDialogLock` y gestión de foco del drawer; landmarks semánticos. Los colores del mockup que NO pasen AA en el tamaño previsto se ajustan al valor AN que sí la pasa (ej. `#6e6e78` solo para elementos no esenciales o se sube a `#8b8b95`).

### D8 — Botón Pausar/Reanudar del feed (UI-only)

Hoy `useLiveEvents` no tiene pausa. El mockup v3 incluye el control; para no crear "features", se implementa como estado local de UI: en pausa, se corta el buffer de eventos acumulados (se detiene el `setEvents` de `applyEvents` y se pausa la ventana de EPS) y se mantiene el render estático; al reanudar se reanuda la suscripción en vivo (la conexión SSE sigue activa). No toca el backend, no cambia `liveFeed.ts` salvo un flag opcional en el hook. Se encuadra como confirmación C3.

### D9 — Constraint de feedback (verificación)

Cada fase termina con: `pnpm --dir web test`, `pnpm --dir web lint`, `pnpm --dir web build` y un checkpoint visual manual contra los dos mockups. Sin build de artefacto (regla del proyecto: "Never build after changes" — se interpreta como no generar builds de distribución; el `pnpm build` de la web es verificación CI).

### D10 — Fase 7: card hero del mockup "Ataques capturados" (feedback operador)

El operador pegó el código crudo del mockup para la card hero y pidió implementarla en Resumen (tile hero del bento) y en la familia visual del panel "Amenaza activa" de Ataques en Vivo. Decisiones concretas:

- **Space Mono ADOPTADA para el hero** (actualiza D2, que la descartaba): se agrega `@fontsource/space-mono` (400/700, subset latin) SOLO para numerales/labels del hero card (`--font-mono-hero`). El font-pair queda Chivo (UI) + Space Mono (hero) + JetBrains Mono (telemetría). Alternativa de una línea si el operador prefiere menos fuentes: mapear `--font-mono-hero` a la pila `--font-mono` existente (ver report de la fase).
- **Sparkline REAL, no decorativo**: se extendió el backend (`GET /api/v1/overview`) con `eventos_por_hora` (24 buckets UTC de `honeypot_events` agrupados por `date_trunc('hour')`, alineados al `to`/ahora) para alimentar la geometría del trend (`mapToTrendGeometry`), en lugar del array estático de 24 puntos del mockup. El área/linea replica la fórmula del mockup (`pts = (i/(len-1)*240),(44-(v/max)*40*g)`).
- **Bloqueos SÍ derivable y agregado**: el workflow `firewall-block` registra cada bloqueo automático en `responses` con `action_type='bloqueo'` (status completed). `bloqueos_ufw` cuenta esas filas (con el mismo filtro de rango temporal); si el operador prefiere no mostrar el tile, es quitar el cuarto tile.
- **AA sobre los tonos del mockup**: `#8b93ff`, `#a1a1ab`, `#ff8f80`, `#5ce0a8` pasan AA (≥4.5:1) sobre `#0d0d12`/`#141733`; `#6e6e78` NO (3.85:1) → el token de muted del hero se sube a `#8e8e99` (≥5.9:1) manteniendo el look. Confirma la política heredada de D7.
- **Count-up**: progreso 0→1 con rAF (`useCountUpProgress`), targets reales vía `countUpTargets` (valores exactos en progreso 1); con `prefers-reduced-motion` salta directo a 1. Los tiles MTTD/MTTR muestran "—" si el dato es null (mismo wording que el `formatDuration` actual, sin datos inventados).

### D11 — Fase 8: fusión hero + strip honeypots, y card "Amenaza activa" del mockup (feedback operador #2)

El operador pidió fusionar la card hero con el tile "Eventos por honeypot" en UN solo card y reemplazar el panel de amenaza activa por el markup exacto del mockup. Decisiones concretas:

- **Hero full-width con strip de honeypots**: el hero pasa a `grid-column: 1 / -1` como primera fila del bento y la comparativa por honeypot entra al pie del card como `honeypot-strip` horizontal (label mono + barra proporcional + count), alimentado por `eventos_por_honeypot` REAL vía el helper puro `buildHoneypotStrip` (`pct = Math.round(count/max*100)`). Si la distribución está vacía el strip se oculta por completo (sin empty state dentro del hero). El tile `.bento-honeypots` se elimina del grid y los tiles restantes quedan como fila 1×2 (Top IPs + Alertas) sin huecos. El card se vuelve más compacto sin aumentar altura (padding 24→20px, gap 32→24px; el flex ya hace wrap).
- **`--scan-duration` parametrizado**: el hero conserva 7s; la card de amenaza usa `--scan-duration: 5s` sobre los mismos keyframes `hero-scan`. Un solo `@keyframes`, dos duraciones.
- **Mapeo severidad→tono de la amenaza activa** (helper puro `threatSeverityTone` + `THREAT_TONE_LABEL`): critical y unknown → familia roja del mockup (label `#ff8f80`, scanline `#ff6a55`, botón `#ffb3a8`); high → ámbar `--severity-high`; medium → azul `--severity-medium`; low → `#8b93ff` (borde/glow derivados con `color-mix`). El label solo lleva sufijo si hay severidad conocida; unknown muestra "Amenaza activa" sin sufijo. `EventItem.severity` es obligatorio en la API, pero el fallback unknown cubre eventos de terceros/robustez.
- **El botón "Investigar" conserva el handler existente** (abre el `EventDetailDrawer`) y la fila de stats extra (ev/s, ventana, fuente SSE) se elimina: el mockup manda y esos indicadores ya viven en los chips del feed (`FeedChips`). El indicador offline de conexión (banner) queda intacto.
- **Hover del botón = box-shadow puro** (`transition: box-shadow 0.2s ease`): cambio de iluminación, NO de layout; se confirma dejarlo fuera del kill-list de `prefers-reduced-motion` (las animaciones scan/fadeUp de la card sí se neutralizan allí, como en el hero).
- **AA Fase 8**: sin regresiones — `#ffb3a8`/`#b4baff` pasan AA sobre el fondo oscuro del gradiente; el timestamp usa `--hero-muted` `#8e8e99` (swap D10, el `#6e6e78` del mockup falla 3.85:1).

### D12 — Fase 9: tiles del hero en una fila + Investigar a `.btn--primary` (feedback operador #3)

- **Investigar migra de botón rojo mockup a la CTA canónica de la app**: `.threat-card-btn` (borde `rgba(255,90,70,.5)`, bg `rgba(255,80,60,.12)`, color `#ffb3a8`, glow rojo al hover) se reemplaza por `.btn .btn--primary` (familia tint unificada desde Fase 6: gradiente accent-soft + borde accent 40% + glow azul) por consistencia con el resto de botones de la app. Se conservan texto "Investigar" y su onClick (abre `EventDetailDrawer`); NO se inventan rutas. La CARD roja del mockup (gradiente rojizo, border, scanline 5s) queda intacta — solo el botón cambia. CSS muerto eliminado: `.threat-card-btn`/hover y los custom props `--threat-btn-*` de `.threat-card` y sus tone variants (verificado sin referencias restantes).
- **Hero como banner ancho y bajo**: `.hero-inner` queda en 3 filas — (A) `hero-main` + `hero-trend-block` a la derecha (`margin-left:auto`), (B) `.hero-stats-segmented` a ancho completo propio (`flex:1 1 100%`) con siempre 4 columnas `repeat(4, minmax(0,1fr))` y tiles `min-width:0` (los tiles flex-grow llenan el ancho en vez de envolver a 2×2 en 1440/900/768 y sidebar colapsado), (C) `honeypot-strip` intacto. Compactación adicional: padding 20→16px, gap 24→20px, value `clamp(2rem,3.4vw,48px)` — medido en Chromium real la card pasa de 383px a ~263–280px. El patrón segmentado (gap 1px, tiles `#0d0d12`, labels mono + valores tono-por-tono) se conserva.
- **Pausar/Reanudar**: ya normalizado en `.btn .btn--ghost` desde Fase 6; la auditoría de la página live encuentra solo acción buttons estándar (Cerrar sesión `.btn--tint-danger`, Pausar `.btn--ghost`, Investigar `.btn--primary`); banners polling/offline son informativos sin botón.

## Risks

- **R1 — Drift tokens.css ↔ colorTokens.ts**: cualquier token de color remapeado rompe `colorScale.test.ts` si no se tocan en lockstep. Mitigación: tarea explícita de sync (D6) antes de cerrar Fase 1; el test se mantiene como red.
- **R2 — Bundle de fuentes**: `@fontsource/chivo` agrega ~3 woff2 (400/500/700, latin). Mitigación: importar solo los pesos usados; el peso extra es aceptable y es el mismo mecanismo de `@fontsource/inter`/`jetbrains-mono` actuales.
- **R3 — Contraste AA sobre near-black con text secondary/faint**: `#6e6e78` falla para texto <14px. Mitigación: `--text-secondary` `#a1a1ab`; faint solo para adornos no esenciales o se sube a `#8b8b95`.
- **R4 — Bento y severidad "medio azul"**: cambiar el significado perceptivo de MEDIO a azul puede confundir si hay residual cyan. Mitigación: este cambio elimina TODO el cyan; "medio azul" es equivalente al "info/neutro" del v3 (confirmación C1).
- **R5 — Superficies y bordes heredados con referencias a `#111827`/`#243244`**: si un componente estiliza en duro (no token) un color del look anterior, queda cyan residual. Mitigación: barrido final `rg '(06b6d4|0891b2|111827|243244|06b6d4)'` en `web/src` como tarea de verificación.

## Migration Plan

- **Fase 1 — Identidad v3 en tokens**: re-mapeo de `tokens.css` + sync `colorTokens.ts`/`colorScale.ts` + agregar `@fontsource/chivo` + fondo gradiente/grid + link/selection/focus tokens. Checkpoint: `pnpm --dir web test` (incl. `colorScale.test.ts`), `lint`, `build`, revisión visual de contraste del login standalone.
- **Fase 2 — Componentes v3 por pantalla**: sidebar (gradiente/marca/servicios/ancho 272px), header (kickers/24H), login v3, banner de amenaza + chips del feed + Pausar en Ataques en Vivo, drawer (donut, timeline, comandos/raw), tabla/explorador, MITRE, mapa (re-derivación de rampa), malware/IoC, automatización/workflows, 404. Checkpoint: tests+lint+build + recorrido manual de las 10 pantallas.
- **Fase 3 — Resumen bento**: reestructura de `Resumen.tsx` a bento grid con tiles reales + estados loading/error/empty + responsive. Checkpoint: tests+lint+build + comparación visual con `Opcion B - Bento.dc.html` (layout) y `Honeypot SOC v3.dc.html` (color).
- **Fase 4 — Verificación y barrido**: tests completos, lint, build, barrido de rainbow residual cyan, auditoría de contraste de los textos primary/secondary/faint nuevos, auditoría de `prefers-reduced-motion` y focus-visible, y checklist contra los dos mockups.

## Open Questions

Las siguientes se encuadran como **confirmaciones** (no bloquean: se ejecuta la opción recomendada salvo devolución del usuario):

- **C1 — Severidad MEDIO en azul**: el v3 mapea el nivel medio a `#a7b0ff` (azul tipo enlace). ¿Se confirma que el nivel MEDIO deja de ser ámbar y pasa a azul (v3), manteniendo solo crítico/alto en rojo/ámbar? Recomendado: sí.
- **C2 — Substats y redondeos del hero tile**: ¿se confirman las etiquetas "IPs únicas / muestras de malware / críticas" y el formato `Intl.NumberFormat('es-AR')` (con puntos de miles)? Recomendado: sí.
- **C3 — Pausar/Reanudar del feed**: ¿se confirma como control UI-only (congela el buffer y el contador de EPS, mantiene la suscripción SSE activa) sin cambios de backend? Recomendado: sí; es la única pieza que no existía en polish-ui (D8).
- **C4 — Ancho del sidebar**: v3 usa 272px expandido (hoy 240px). ¿Se confirma `--sidebar-w: 272px` con rail ≤900px conservado? Recomendado: sí.
- **C5 — "API en línea · v3.0"**: ¿se reemplaza el texto de estado actual del health ticker por el wording v3 "API en línea · v3.0"? Recomendado: sí.
- **C6 — Dependencia nueva**: ¿se acepta la única dependencia nueva `@fontsource/chivo` (pesos 400/500/700, latin) como trade-off del v3? Recomendado: sí.