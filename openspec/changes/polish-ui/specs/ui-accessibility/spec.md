## ADDED Requirements

### Requirement: La interfaz SHALL ser operable por teclado
Los elementos interactivos no nativos (filas clickeables de tablas, controles custom) SHALL ser alcanzables y activables por teclado: foco visible, `tabIndex` o elemento real según el caso, y activación con Enter/Espacio cuando aplique. Ningún control esencial SHALL depender exclusivamente de clic.

#### Scenario: Navegación de filas del Explorador por teclado
- **WHEN** el usuario navega con Tab sobre la tabla de eventos del Explorador
- **THEN** cada fila accionable recibe foco visible y puede activarse con Enter (y Espacio si aplica la modalidad fila)
- **AND** el foco indica claramente la fila seleccionada antes de abrir el detalle

#### Scenario: Acción de detalle sin ratón
- **WHEN** el usuario activa una fila accionable solo con teclado
- **THEN** se abre el detalle del evento igual que con clic

### Requirement: Los overlays (modal y drawer) SHALL gestionar foco, tecla Escape y scroll
El Modal y el EventDetailDrawer SHALL bloquear el scroll del fondo mientras están abiertos, cerrarse con Escape y trasladar/restaurar el foco de forma predecible (foco inicial dentro del overlay; foco restaurado al elemento que lo abrió al cerrar). El foco SHALL permanecer dentro del overlay mientras esté abierto.

#### Scenario: Cerrar con Escape
- **WHEN** el modal o el drawer están abiertos y el usuario pulsa Escape
- **THEN** el overlay se cierra y el foco vuelve al elemento que lo abrió

#### Scenario: Scroll del fondo bloqueado
- **WHEN** el modal o el drawer están abiertos
- **THEN** el fondo no hace scroll mientras el overlay permanece abierto

#### Scenario: Foco contenido en el overlay
- **WHEN** el modal o el drawer están abiertos y el usuario cicla con Tab
- **THEN** el foco recorre los elementos del overlay sin salirse hacia el fondo

### Requirement: Los controles interactivos SHALL mostrar un anillo de foco consistente
Todos los controles enfocables (botones, inputs, selects, textareas, enlaces, filas accionables) SHALL presentar el mismo anillo de foco de 2px usando el token de focus-ring del design system, sobre la base del `:focus-visible` existente.

#### Scenario: Anillo de foco visible por teclado
- **WHEN** el usuario recorre la interfaz con Tab
- **THEN** cada control enfocado muestra el anillo de foco de 2px consistente, sin depender de hover de ratón

#### Scenario: Sin anillo en interacción por ratón
- **WHEN** el usuario interactúa con el ratón
- **THEN** no se muestra el anillo de foco (se preserva el comportamiento de `:focus-visible`)

### Requirement: La UI SHALL respetar `prefers-reduced-motion`
Las animaciones decorativas o informativas (row-flash de eventos en vivo, pulse de severidad, spin de carga) SHALL desactivarse o reducirse cuando el usuario activa el modo "reducir movimiento" del sistema operativo.

#### Scenario: Modo reducir movimiento activado
- **WHEN** el usuario tiene `prefers-reduced-motion: reduce` en el sistema
- **THEN** las animaciones row-flash, pulse y spin no se ejecutan o se reemplazan por anuncio estático, sin afectar la legibilidad de estados (loading/error)

### Requirement: La estructura SHALL usar landmarks semánticos correctos
El contenido principal de la aplicación SHALL estar marcado con el landmark `<main>` (no un `<div>` genérico), preservando la accesibilidad de navegación por lectores de pantalla.

#### Scenario: Landmark principal
- **WHEN** se inspecciona el árbol de la app autenticada
- **THEN** la zona de contenido principal está dentro de un elemento `<main>` único

### Requirement: El texto secundario SHALL cumplir contraste AA
Los colores de texto de baja prominencia (`--text-faint` y derivados) SHALL cumplir el contraste AA (≥4.5:1) en los tamaños en que se usan, o quedar reservados a tamaños donde el ratio es cumplible.

#### Scenario: Contraste del texto secundario
- **WHEN** se mide el contraste de un texto etiqueta/label con color secundario sobre su fondo
- **THEN** el ratio es ≥4.5:1 (AA) para texto normal