## Why

El frontend (`web/`) está funcionalmente completo — 8 pantallas, integración con API, tests verdes — pero la sensación visual es de "borrador": se repiten recetas paralelas casi idénticas (3 botones, 4 inputs, 3 badges, 2 overlays, 2 cajas de error, ~7 labels), `tokens.css` no tiene escalas (57 valores de fuentes, 41 paddings, 26 colores hardcodeados), falta finesse de interacción (sin `:active`, sin foco gestionado, filas de tabla no accesibles por teclado) y hay nits de consistencia/a11y (th/td con paddings distintos, `--text-faint` que falla AA, sidebar que nunca colapsa, sin `prefers-reduced-motion`). Para una defensa de tesis de un SOC, el acabado visual y la accesibilidad son parte del entregable.

## What Changes

**FASE 1 — Quick wins (bajo riesgo, mecánico)**
- Respeto de `prefers-reduced-motion`: se desactivan spin/pulse/row-flash.
- Unificar padding vertical de `th`/`td` (mismo valor).
- Estados de interacción: `:active` + transition en `.btn`, `.sidebar-link`, `.mitre-row-btn`.
- Escape + scroll-lock (body `overflow: hidden`) en Modal y EventDetailDrawer (useEffect compartido).
- Landmark semántico: `<div className="app-main">` → `<main>` en AppShell.
- Zebra striping sutil en `.data-table`.
- Focus-ring en inputs/selects (`box-shadow 0 0 0 2px`) en vez de borde de 1px.
- Eliminar dependencia muerta `recharts` (verificar que no haya imports) o decidir conservarla.
- Fix de bug cosmético app.css:238 y `max-width` (1440px) en `.screen`.

**FASE 2 — Estructural (refactor token-driven)**
- Expandir `tokens.css`: `--space-{1..8}`, `--text-{xs..2xl}`, `--z-*`, `--severity-*-soft`, `--focus-ring`, `--duration-*`, `--radius-lg`.
- Barrer app.css reemplazando valores mágicos (57+41+26) por los tokens nuevos. Objetivo −30-40% de CSS.
- Colapsar recetas paralelas en primitivas compartidas: `.btn` (variants), `.field`, `.label`, `.badge`, `.overlay`, `.error-box`.
- Severity soft colors token-driven (fuente única de verdad).
- Unificar `colorScale.ts` con tokens (BUCKET_COLORS / MAP_NEUTRAL_COLOR) vía módulo testable.
- (Opcional) tokens de z-index aplicados.

**FASE 3 — Pulido fino (responsive + a11y)**
- Política responsive: sidebar colapsa ≤900px, padding de `.screen` en @media, mapa con su @media actual.
- Contraste: `--text-faint` sube a AA (`#94a3b8`) o se reserva a textos ≥12px.
- Filas clickeables del Explorador accesibles por teclado (tabIndex + Enter/Espacio, o botón "ver detalle" real — elegir la mejor opción).
- Focus-ring 2px consistente en todos los interactivos.
- Sidebar.tsx:138 título en español ("operativo"/"caído").

**No se toca (a preservar)**: estados loading/error/empty de las 8 pantallas, `focus-visible` global para botones/links, patrón icon-only con `aria-hidden` del sidebar, `role="dialog"` + `aria-label` del drawer.

## Capabilities

### New Capabilities
- `ui-accessibility`: Requisitos de accesibilidad e interacción del frontend — filas clickeables por teclado, gestión de foco + Escape + scroll-lock en modal/drawer, focus-rings consistentes, `prefers-reduced-motion`, landmarks semánticos y contraste AA del texto secundario.

### Modified Capabilities
- `web-soc-ui`: El requisito de design system se expande — tokens por escala (`--space-*`, `--text-*`, `--z-*`, severity soft, focus-ring, duración, radio), consolidación de recetas paralelas en primitivas compartidas y política responsive (collapso del sidebar y `max-width` de `.screen`).

## Impact

- **CSS**: `web/src/styles/tokens.css` (expansión de tokens), `web/src/styles/app.css` (sweep de valores mágicos, consolidación de recetas, media queries).
- **Componentes**: `web/src/components/Modal.tsx`, `EventDetailDrawer.tsx`, `AppShell.tsx`, `Sidebar.tsx`, y botones/inputs compartidos en `web/src/features/*` y `web/src/components/`.
- **Código new**: módulo de constantes de color derivado de tokens (librería `colorScale.ts`) con test unitario.
- **Dependencias**: posible eliminación de `recharts@^3.1.0` de `web/package.json` (dependencia muerta, 0 imports).
- **Verificación**: `pnpm --dir web test` (vitest), `pnpm --dir web lint` (oxlint) y `pnpm --dir web build` deben seguir verdes. No hay tooling de screenshot para regresión visual — el checkpoint visual es manual sobre las 8 pantallas.
- **Sin cambios de API/servidores** (ningún endpoint del backend, n8n o DB se modifica).