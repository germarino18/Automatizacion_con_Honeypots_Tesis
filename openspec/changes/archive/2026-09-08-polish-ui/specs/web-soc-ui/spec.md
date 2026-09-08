## MODIFIED Requirements

### Requirement: La UI SHALL seguir el design system Obsidian Sentinel
La aplicación SHALL implementar el design system del prototipo: dark-first (fondos `#0a0a0c`/`#0f172a`/`#1e293b`), accent cyan `#06b6d4`, tipografía Inter + JetBrains Mono (telemetría), escala de severidad semántica (low/medium/high/critical) y sidebar de 240px que colapsa a rail de iconos ≤900px. El sistema de tokens SHALL estar escalado por tipografía, espaciado, z-index, severidad (con variantes soft derivadas), focus-ring, duración de movimiento y radios. Los controles repetidos (botones, inputs, badges, overlays, cajas de error) SHALL usar primitivas compartidas en lugar de recetas paralelas, y el contenido SHALL limitarse a un ancho máximo.

#### Scenario: Tokens de diseño aplicados
- **WHEN** se inspecciona el CSS de la app
- **THEN** las variables de color/fuente/sombra corresponden al design system Obsidian Sentinel

#### Scenario: Escalas de tokens declaradas
- **WHEN** se inspecciona `tokens.css`
- **THEN** existen escalas `--space-*`, `--text-*`, `--z-*`, `--severity-*-soft`, `--focus-ring`, `--duration-*` y `--radius-lg`, y los valores mágicos repetidos en `app.css` están reemplazados por esas variables

#### Scenario: Recetas consolidadas en primitivas
- **WHEN** se inspecciona el CSS de botones, inputs, labels, badges, overlays y cajas de error
- **THEN** cada caso usa la primitiva compartida correspondiente (`.btn` con variants, `.field`, `.label`, `.badge`, `.overlay`, `.error-box`) sin recetas duplicadas

#### Scenario: Severidad semántica con fuente única de verdad
- **WHEN** se cambia una variable `--severity-*` base
- **THEN** sus variantes soft (fondos de badge, focus indirecto, zebra de severidad) se actualizan sin edición manual adicional

#### Scenario: Telemetría en JetBrains Mono
- **WHEN** se renderizan IPs, hashes, IDs de técnica o comandos
- **THEN** usan fuente monoespaciada JetBrains Mono

#### Scenario: Severidad semántica
- **WHEN** un evento tiene severidad critical
- **THEN** se renderiza con el color/estilo de la escala de severidad definida (rojo para crítico)

#### Scenario: Sidebar colapsado en pantallas pequeñas
- **WHEN** el viewport es de 900px o menos
- **THEN** el sidebar colapsa a rail de iconos sin perder la accesibilidad ni la navegación entre pantallas

#### Scenario: Ancho máximo de contenido
- **WHEN** la app se visualiza en pantallas ultra anchas
- **THEN** el contenido de pantalla se limita a un ancho máximo legible y se centra, evitando filas de tarjetas/tablas de más de ~1440px