## Context

El frontend (`web/`) del SOC ya entrega las 8 pantallas funcionales contra la API (Resumen, Live, Explorador, MITRE, Mapa, Malware/IoC, Automatización, Login) con tests verdes (vitest en `web/`, pytest 127+ en `api/`). El acabado visual es "de borrador": `tokens.css` declara 20 custom properties pero sin escalas; `app.css` (1357 líneas, 133 clases BEM-lite) repite recetas paralelas; no existe finesse de interacción (sin `:active`, sin foco gestionado en overlays, filas de tabla no operables por teclado); y hay nits de consistencia y accesibilidad (padding `th`/`td` distinto, `--text-faint:#64748b` falla AA a 10-11px, sidebar fijo de 240px que nunca colapsa, sin `prefers-reduced-motion`, `recharts` muerto).

Diagnóstico ya verificado en exploración previa (se cita, no se re-deriva): recetas paralelas, sin escalas de tokens, falta de finesse, nits de consistencia/a11y (detalles en `proposal.md`).

**Restricciones duras**: CSS vanilla + design tokens (decisión confirmada: NO Tailwind). `web/` usa React 18 + TypeScript + Vite. Los tests existentes NO deben romperse. Verificación sin tooling de screenshots: `pnpm --dir web test`, `pnpm --dir web lint`, `pnpm --dir web build`, más checkpoint visual manual de las 8 pantallas.

## Goals / Non-Goals

**Goals:**
- Misma estética Obsidian Sentinel pero con acabado pulido: escalas de tokens, primitivas compartidas, interacción con feedback, a11y real (foco, Escape, scroll-lock, reduce-motion, landmarks, contraste AA).
- Reducir ~30-40% el CSS de app.css eliminando recetas duplicadas.
- Dejar el sistema token-driven: cambiar un `--severity-*` propaga a fondos/bordes/textos.
- Sidebar responsive (≤900px) y `.screen` con `max-width` para ultrawide.
- Tests verdes antes y después; cero cambios en API/backend/DB.

**Non-Goals:**
- No migración a Tailwind ni a otra librería de estilos.
- No rediseño visual: no se cambia el look & feel, los colores base ni la composición de las 8 pantallas.
- No se tocan los estados loading/error/empty ya correctos ni los patrones a11y existentes buenos (focus-visible global, icon-only `aria-hidden` del sidebar, `role="dialog"`+`aria-label`).
- No se añaden nuevas dependencias de runtime (ni de test salvo que sea imprescindible).
- No se introduce tooling de screenshot/visual-regression en este change (fuera de alcance; verificación manual).
- No se reescribe arquitectura de componentes ni se agrega librería de focus-trap.

## Decisions

### D1 — Escalado de tokens (Fase 2)
Se amplía `tokens.css` con escalas numéricas y tipográficas:
- `--space-{1..8}`: múltiplos de 4px (4/8/12/16/20/24/32/48). Reemplaza los 41 paddings/margins sueltos.
- `--text-{xs,sm,base,lg,xl,2xl}`: 12/13/14/16/20/24px (valores confirmables), reemplaza los 57 font-size hardcodeados (que hoy tienen 9 valores distintos).
- `--z-header:10`, `--z-drawer:50`, `--z-modal:60`: los valores mágicos actuales pasan a ser tokens.
- `--duration-fast:-150ms`, `--duration-base:200ms`, `--duration-slow:300ms`.
- `--radius-lg:12px` (además del radio existente).
- `--focus-ring: 0 0 0 2px var(--accent-soft)` (sombra, no borde).
- `--severity-{low,medium,high,critical}-soft`: derivados vía `color-mix(in srgb, var(--severity-*) 12%, transparent)` para que el color severidad sea fuente única de verdad.

**Alternativa considerada**: mantener soft colors como rgba literal. Rechazada: ya hay divergencia hoy (opacidades .12/.14/.16/.4 del mismo rojo). **Trade-off**: `color-mix` requiere navegador moderno (2023+); para la defensa y el público objetivo (Vite dev/prod en desktop moderno) es aceptable. **A confirmar por el usuario**: navegadores objetivo.

### D2 — Consolidación de recetas en primitivas (Fase 2)
Se colapsan las recetas paralelas en primitivas BEM-lite (mismo estilo plano del proyecto):
- `.btn` con variant modifiers `.btn--primary`, `.btn--ghost`, `.btn--danger` (absorbe `.btn-accent`, `.login-submit`, `.error-state-retry`).
- `.field` (label+control) + `.label` (absorbe ~7 recetas de label 10-12px uppercase 600).
- `.badge` base con modifiers `.badge--severity-*`, `.badge--status`, `.badge--action` (absorbe los 3 sistemas de badges).
- `.overlay` único (absorbe `.drawer-overlay`/`.modal-overlay` con sus rgba casi idénticos).
- `.error-box` (absorbe `.login-error`, `.modal-error`).

El selector `.data-table`, `.screen`, `.sidebar`, etc. se conservan; la consolidación es mecánica (buscar-reemplazar selectores → nueva clase base). Cada selector viejo que se elimina debe ser verificado con `rg` para no perder estilos.

### D3 — `colorScale.ts` unificado y testeable (Fase 2)
`web/src/.../colorScale.ts` hoy re-duplica hex del design system (BUCKET_COLORS re-usa `--accent`, MAP_NEUTRAL_COLOR re-usa `--bg-elevated`). Decisión: crear módulo de constantes de color en TS (`web/src/lib/colorTokens.ts` o equivalente) que sea la única fuente de valores para el código TS, y una **prueba unitaria vitest que lee `tokens.css` y verifica que las constantes TS coinciden con las variables CSS**. Así la fuente de verdad sigue siendo tokens.css y la desalineación rompe el test.

**Alternativa considerada**: leer `getComputedStyle` en runtime. Rechazada: frágil (necesita DOM montado, no aplica en SSR, acopla datos a la pintura).

### D4 — Accesibilidad de filas del Explorador (Fase 3)
Se prioriza la opción de **botón real "Ver detalle"** si el layout lo permite; si se prefiere cero cambio visual, alternativa: `tabIndex={0}` + `role="button"` + `onKeyDown` enter/espacio + `aria-selected` sobre el `<tr>` (hoy `EventsTable.tsx:42-46` usa `<tr onClick>` con 0 soporte teclado). **A confirmar por el usuario**: la fila clickeable completa vs. botón "ver detalle" en columna de acción. Ambos respetan WCAG si la fila no contiene otros interactivos; el botón real es la práctica recomendada, el `tabIndex` es menos invasivo visualmente.

### D5 — Sidebar responsive (Fase 3)
Colapso a **rail de iconos** a ≤900px: el sidebar pasa a 64px, los labels se ocultan con media query, los links conservan `title`/`aria-label` (el patrón icon-only existente ya es accesible). Sin drawer extra (evita duplicar patrón de overlay ya consolidado).

**Alternativa considerada**: drawer deslizante con botón hamburguesa. Rechazada por mayor complejidad y porque duplicaría la mecánica de overlay; el rail de iconos es el patrón estándar para dashboards de monitorización y es más barato en riesgo.

### D6 — Foco/scroll en overlays sin dependencia nueva (Fase 1)
`useDialogLock` (hook compartido, `web/src/hooks/useDialogLock.ts`): bloquea scroll del body (`overflow:hidden`), cierra con Escape, restaura scroll y foco al abridor al cerrar. El focus-trap manual mínimo (Tab cicla entre primer/último elemento enfocable) se implementa sin librerías. **Decisión**: no añadir dependency de focus-trap — el markup de Modal/Drawer es simple y el a11y test manual lo cubre.

### D7 — `recharts` muerto (Fase 1)
Verificar con `rg "recharts" web/src` que hay 0 imports; si es así eliminar de `web/package.json`. Si apareciera algún import (charts personalizados), se mantiene y se documenta. **La verificación es parte de la tarea.**

### D8 — Contraste `--text-faint` (Fase 3)
Subir a `#94a3b8` (AA sobre `#0f172a`-ish) o reservarlo a ≥12px. Decisión recomendada: reposicionar `--text-faint` como texto de 12-13px+ y usar `--text-muted` para lo pequeño; si el usuario prefiere el mínimo cambio, basta cambiar el valor a `#94a3b8` y subir tamaño/letter-spacing en labels. **A confirmar**.

### D9 — Landmark y nits (Fase 1)
`<div className="app-main">` → `<main>` (cero impacto CSS; el CSS ya apunta a `.app-main`). th/td padding unificado (7px 10px). Zebra striping `nth-child(even)` con `--bg-subtle`. `.screen` `max-width:1440px`. Fix del selector pegado a comentario en app.css:238.

## Risks / Trade-offs

- **Regresión visual al colapsar recetas** → Cada Fase 2 se ejecuta con carpetas de prueba en verde antes/después, `pnpm --dir web build`, y checkpoint visual manual de las 8 pantallas; las clases viejas se eliminan solo tras `rg` que confirme 0 usos.
- **`color-mix` no soportado en el navegador que use el jurado/revisor** → fallback estático opcional en `tokens.css` (definir el soft literal después del color-mix) o confirmar objetivo de navegador moderno (decisión a confirmar).
- **Eliminar `recharts` mal por algún import oculto** → la tarea verifica con `rg` y `pnpm --dir web build` antes de borrar; si compila, no hay dependencia real.
- **Focus-trap manual con regresión en Tab** → cobertura con checkpoint manual + test unitario del helper de foco (listado de elementos enfocables) en vitest/jsdom.
- **Sidebar rail de iconos rompe tests de snapshot/style de pantallas** → se verifica con `pnpm --dir web test`; los cambios son solo CSS/media queries salvo los labels ocultos del rail.
- **Sweep masivo de 57+41+26 valores en app.css introduce typos** → tareas por secciones de CSS (una tarea por área: botones/inputs/badges/overlays/tablas), cada una con su verificación; los tokens validan por construcción (un token = un valor).
- **Sin screenshots automatizados** → mitigación es el checklist visual manual por pantalla señalado en tasks.md; no se inventa tooling nuevo.

## Migration Plan

1. Fase 1 (quick wins): se aplica directo, commits por tarea, sin migración de datos. Reversible por `git revert`.
2. Fase 2 (estructural): primero se crean los tokens nuevos y las primitivas; después el sweep por secciones; al final de cada sección se eliminan las recetas huérfanas verificadas con `rg`. Riesgo bajo por ser CSS vanilla con selectores independientes.
3. Fase 3 (pulido): media queries nuevas + a11y. Ningún cambio de contrato con backend.
4. Rollback: `git revert <commit>` por tarea; no existe migración de datos ni de esquema involucrada.

## Open Questions

- **Navegadores objetivo** del despliegue final (define si `color-mix` y `:active` con media queries van con fallback).
- **Fila clickeable completa vs botón "Ver detalle"** en el Explorador (D4) — se implementa la opción elegida solo tras confirmación del usuario.
- **Estrategia exacta de `--text-faint`**: cambiar el valor a AA vs. reservarlo a ≥12px con `--text-muted` para lo pequeño (D8).
- **Valores exactos de la escala tipográfica** (`--text-xs..2xl`): propuesta 12/13/14/16/20/24px sujetos a revisión visual.