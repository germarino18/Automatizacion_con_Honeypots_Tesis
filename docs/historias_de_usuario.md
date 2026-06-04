# Historias de Usuario
Epic: Gestión y Monitoreo de Honeypots
# Historia de Usuario 1

Título: Visualizar ataques en tiempo real

Como analista de seguridad, quiero visualizar eventos de ataque en tiempo real, para detectar rápidamente actividades sospechosas.

Criterios de aceptación
Los eventos deben aparecer automáticamente sin recargar la página.
Debe visualizarse IP origen.
Debe visualizarse timestamp.
Debe visualizarse honeypot afectado.
Debe visualizarse severidad.

# Historia de Usuario 2

Título: Consultar técnicas MITRE ATT&CK

Como investigador de ciberseguridad, quiero visualizar las técnicas MITRE ATT&CK asociadas a cada ataque, para analizar el comportamiento táctico del atacante.

Criterios de aceptación
Cada evento debe contener técnica ATT&CK.
Debe existir un panel táctico.
Debe poder filtrarse por táctica.
Debe poder exportarse la información.

# Historia de Usuario 3

Título: Filtrar eventos

Como operador SOC, quiero filtrar eventos por severidad, fecha e IP, para facilitar investigaciones específicas.

Criterios de aceptación
Deben existir filtros dinámicos.
La búsqueda debe ser instantánea.
Debe existir paginación.
Debe poder ordenarse por fecha.

# Historia de Usuario 4

Título: Visualizar origen geográfico

Como analista de amenazas, quiero visualizar un mapa de origen de ataques, para identificar regiones con mayor actividad maliciosa.

Criterios de aceptación
Debe existir mapa interactivo.
Debe marcar IPs geolocalizadas.
Debe mostrar cantidad de ataques por país.

# Historia de Usuario 5

Título: Gestionar indicadores de compromiso

Como investigador, quiero almacenar indicadores de compromiso extraídos automáticamente, para reutilizarlos en investigaciones futuras.

Criterios de aceptación
Debe almacenarse hash.
Debe almacenarse IP maliciosa.
Debe almacenarse URL maliciosa.
Debe existir búsqueda de IoCs.

# Historia de Usuario 6

Título: Simular ataques controlados

Como docente o investigador, quiero ejecutar simulaciones de ataques, para validar el comportamiento del sistema.

Criterios de aceptación
Debe existir módulo de simulación.
Debe registrarse el ataque generado.
Debe activarse el playbook correspondiente.
Debe visualizarse el resultado.

# Historia de Usuario 7

Título: Visualizar métricas operativas

Como administrador SOC, quiero visualizar métricas de desempeño, para evaluar la eficiencia del sistema.

Criterios de aceptación
Debe visualizarse MTTD.
Debe visualizarse MTTR.
Debe visualizarse cantidad de eventos.
Deben existir gráficos históricos.

# Historia de Usuario 8

Título: Recibir alertas automáticas

Como operador SOC, quiero recibir alertas automáticas ante eventos críticos, para responder rápidamente.

Criterios de aceptación
Debe integrarse con Discord.
Debe integrarse con Telegram.
Debe integrarse con Email.
Debe configurarse severidad mínima.

# Historia de Usuario 9

Título: Consultar sesiones de ataque completas

Como analista forense, quiero reconstruir sesiones completas del atacante, para comprender la secuencia del ataque.

Criterios de aceptación
Deben visualizarse comandos ejecutados.
Deben visualizarse archivos descargados.
Debe existir timeline.
Debe visualizarse duración de sesión.

# Historia de Usuario 10

Título: Exportar reportes

Como investigador académico, quiero exportar reportes automáticos, para documentar resultados de investigación.

Criterios de aceptación
Debe exportar PDF.
Debe exportar CSV.
Debe incluir métricas.
Debe incluir eventos filtrados.
