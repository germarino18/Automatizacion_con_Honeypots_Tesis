# 📚 Aprendizaje — Automatización con Honeypots

> Archivo de aprendizaje colaborativo. Acá queda registrado todo lo que vamos viendo: conceptos, comandos, decisiones y explicaciones.
> 
> **Autores**: Ignacio Navarria & Germán Marino
> **Fecha de inicio**: 04/06/2026

---

## Índice de Contenidos

1. [Lección 1: ¿Qué es Docker?](#lección-1-qué-es-docker)
2. [Lección 2: Docker Desktop vs Docker Engine](#lección-2-docker-desktop-vs-docker-engine)
3. [Lección 3: Conceptos Clave de Docker](#lección-3-conceptos-clave-de-docker)
4. [Lección 4: Docker Compose](#lección-4-docker-compose)
5. [Próximas Lecciones](#próximas-lecciones)

---

## Lección 1: ¿Qué es Docker?

### El Problema que Resuelve Docker

Imaginá que desarrollás una aplicación en tu PC. Funciona perfecto. Se la mandás a tu compañero y... no le funciona. ¿Por qué?

- Tu compañero tiene otra versión de Node.js
- Usa Windows y vos usás Mac
- Le falta una librería
- Tiene otra configuración de base de datos

**Docker resuelve este problema** permitiendo empaquetar una aplicación con **todo lo que necesita** para funcionar (código, librerías, configuración, variables de entorno) en un paquete llamado **contenedor**.

### Analogía: El Contenedor de Carga

Pensá en los contenedores de los barcos de carga:

| Mundo Real | Docker |
|------------|--------|
| Contenedor de barco | Contenedor Docker |
| La carga que va adentro | Tu aplicación + sus dependencias |
| El barco | Docker Engine (el motor) |
| El puerto | Tu PC (host) |

Un contenedor de barco lleva mercancía de un país a otro sin importar **cómo** se maneje en cada país. Lo mismo hace Docker: tu aplicación viaja dentro de un contenedor y funciona igual en cualquier lado.

### ¿Y entonces qué es Docker?

**Docker** es una plataforma que te permite:
1. **Crear contenedores** (empaquetar aplicaciones con todo lo que necesitan)
2. **Distribuirlos** (subirlos a internet, compartirlos)
3. **Ejecutarlos** en cualquier computadora que tenga Docker instalado

### Contenedor vs Máquina Virtual

Esta es una duda común. La diferencia es importante:

| Característica | Máquina Virtual (VM) | Contenedor Docker |
|----------------|---------------------|-------------------|
| Sistema operativo | Cada VM tiene su propio SO completo | Todos los contenedores comparten el SO del host |
| Arranque | Minutos | Segundos |
| Tamaño | Gigabytes | Megabytes |
| Recurso usado | Alto (cada VM consume memoria/CPU aparte) | Bajo (comparten el kernel del host) |
| Aislamiento | Total (cada VM está completamente aislada) | Bueno (comparten kernel pero tienen su propio espacio) |

**En resumen**: Los contenedores son como "VM livianas" que arrancan al instante y consumen pocos recursos.

---

## Lección 2: Docker Desktop vs Docker Engine

Cuando decimos "instalar Docker" en Windows hay dos componentes:

### Docker Engine (El Motor)
- Es el programa que **crea y ejecuta** los contenedores
- Es lo que realmente hace funcionar Docker
- En Linux se instala directo
- En Windows necesita una capa intermedia

### Docker Desktop (La Interfaz)
- Es una aplicación con **interfaz gráfica** para Windows/Mac
- Incluye Docker Engine adentro
- Agrega herramientas útiles: panel visual, gestión de contenedores, settings
- Es la forma recomendada de usar Docker en Windows

### ¿Por qué Docker Desktop necesita WSL2?

En Windows, Docker no puede crear contenedores directamente porque los contenedores usan el kernel de Linux. Para solucionarlo, Docker Desktop usa **WSL2** (Windows Subsystem for Linux versión 2):

```
┌──────────────────────────────────────────────┐
│               TU PC (Windows)                  │
│                                                │
│  ┌─────────────────┐  ┌──────────────────┐   │
│  │  Docker Desktop  │  │  WSL2            │   │
│  │  (Interfaz)      │─▶│  (Linux mini)    │   │
│  │                  │  │                  │   │
│  │  ┌─────────────┐ │  │  ┌────────────┐ │   │
│  │  │Docker Engine │ │  │  │Contenedores│ │   │
│  │  └─────────────┘ │  │  └────────────┘ │   │
│  └─────────────────┘  └──────────────────┘   │
└──────────────────────────────────────────────┘
```

WSL2 es como tener Ubuntu (Linux) funcionando adentro de Windows sin necesidad de una máquina virtual pesada. Docker lo usa para ejecutar los contenedores Linux.

---

## Lección 3: Conceptos Clave de Docker

### 1. Imagen (Image)
Es como un **molde** o una **plantilla** para crear contenedores. Una imagen contiene:
- Un sistema operativo base mínimo (ej: Alpine Linux = 5 MB)
- Las aplicaciones y librerías necesarias
- La configuración por defecto

Ejemplos de imágenes que vamos a usar:
- `postgres:15-alpine` → Base de datos PostgreSQL
- `cowrie/cowrie:latest` → Honeypot SSH
- `n8n/n8n:latest` → Orquestador de automatizaciones
- `grafana/grafana:latest` → Panel de visualización

### 2. Contenedor (Container)
Es una **instancia en ejecución** de una imagen. Si la imagen es el molde, el contenedor es la galletita ya horneada y funcionando.

Podés tener múltiples contenedores de la misma imagen:
```bash
# Una imagen de PostgreSQL puede generar muchos contenedores
# cada uno con sus propios datos y configuración
```

### 3. Puerto (Port)
Los contenedores están aislados. Para acceder a ellos desde tu PC, tenés que **mapear puertos**:

```bash
# Puerto interno del contenedor : Puerto de tu PC
# Ejemplo: n8n corre en el puerto 5678 adentro del contenedor
# Lo mapeamos al puerto 5678 de tu PC
5678:5678

# Otro ejemplo: PostgreSQL corre en el 5432
5432:5432
```

### 4. Volumen (Volume)
Los contenedores son **temporales**: si borrás un contenedor, perdés todo lo que tenía adentro. Los **volúmenes** son como discos externos que persisten los datos aunque borres el contenedor.

```
Contenedor                     Volumen
┌──────────────┐              ┌──────────┐
│  PostgreSQL  │──escribe──▶  │  DATOS   │
│  (se borra)  │              │(persisten)│
└──────────────┘              └──────────┘
```

### 5. Red (Network)
Los contenedores pueden comunicarse entre sí a través de redes internas. Vamos a crear dos redes:

- **red_dmz** → Para servicios expuestos (honeypots)
- **red_interna** → Para servicios internos (base de datos, n8n)

```
red_dmz (expuesta)        red_interna (segura)
┌──────────┐              ┌──────────┐
│  Cowrie  │──────┐       │  n8n     │
├──────────┤      │       ├──────────┤
│ Dionaea  │──────┤       │PostgreSQL│
└──────────┘      │       ├──────────┤
                  │       │ Grafana  │
                  └──────▶└──────────┘
                     Webhooks
```

---

## Lección 4: Docker Compose

### El Problema

Nuestro proyecto tiene **muchos servicios** que necesitan arrancar en orden:

1. PostgreSQL tiene que arrancar primero
2. n8n necesita que PostgreSQL esté listo
3. Cowrie y Dionaea necesitan a n8n
4. Grafana necesita a PostgreSQL
5. Nginx necesita a n8n

Si tuvieras que arrancar cada uno a mano con comandos separados, sería un caos.

### La Solución: Docker Compose

**Docker Compose** es una herramienta que permite definir y ejecutar **múltiples contenedores** con un solo archivo de configuración.

Se escribe en un archivo `docker-compose.yml` con este formato:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: usuario
      POSTGRES_PASSWORD: contraseña
    volumes:
      - ./postgres/data:/var/lib/postgresql/data
    networks:
      - red_interna

  n8n:
    image: n8n/n8n:latest
    depends_on:
      - postgres
    ports:
      - "5678:5678"
```

### Comandos básicos de Docker Compose

| Comando | Qué hace |
|---------|----------|
| `docker compose up -d` | Arranca todos los servicios |
| `docker compose down` | Detiene y borra los contenedores |
| `docker compose ps` | Muestra el estado de los servicios |
| `docker compose logs -f` | Muestra los logs en tiempo real |
| `docker compose restart` | Reinicia todos los servicios |

---

---

## Lección 5: El Flujo OPSX (cómo organizamos el proyecto)

### ¿Qué es OPSX?

OPSX (OpenSpec) es el sistema que usamos para **organizar el trabajo** del proyecto. En vez de arrancar a codear sin rumbo, cada cambio pasa por un flujo:

```
Explorar → Proponer → Implementar → Archivar
  pensar      planear     codear      cerrar
```

### Los 4 Artefactos de cada Cambio

Cada vez que queremos hacer un cambio en el proyecto, OPSX nos guía a crear 4 documentos:

#### 1️⃣ Propuesta (`proposal.md`)
**¿Qué vamos a hacer y por qué?**
- Describe el problema o necesidad
- Lista los cambios concretos
- Define qué capacidades nuevas se crean
- Evalúa el impacto en el resto del proyecto

#### 2️⃣ Diseño (`design.md`)
**¿Cómo lo vamos a hacer?**
- Contexto actual y estado del proyecto
- Objetivos (qué logramos y qué queda afuera)
- Decisiones técnicas con justificación (ej: "elegimos PostgreSQL porque...")
- Riesgos y cómo mitigarlos

#### 3️⃣ Especificaciones (`specs/`)
**¿Qué debe cumplir el sistema?**
- Requerimientos detallados escritos como: "El sistema DEBE hacer X"
- Escenarios de prueba: "CUANDO pasa X, ENTONCES debería pasar Y"
- Estos escenarios después se convierten en tests

#### 4️⃣ Tareas (`tasks.md`)
**Checklist de implementación**
- Pasos concretos para codear, ordenados por dependencia
- Cada tarea es chica y verificable (sabés cuando está terminada)

### ¿Por qué tanto documento?

Parece mucho, pero tiene una razón:
- **No codeamos sin rumbo** — cada línea tiene un porqué
- **Tu compañero puede entender todo** aunque no haya estado en la sesión
- **La facultad puede evaluar el proceso**, no solo el código final
- **Si volvemos al proyecto en 6 meses**, entendemos todo al toque

---

## Lección 6: ¿Qué acabamos de hacer? (infraestructura-docker)

Nuestro primer cambio se llama **infraestructura-docker** y crea la base de TODO el sistema.

### Arquitectura de Servicios

```
                  ┌──────────────┐
                  │   INTERNET   │
                  └──────┬───────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
    ┌─────▼─────┐  ┌────▼─────┐        │
    │  Cowrie   │  │ Dionaea  │        │
    │ SSH/Telnet│  │ Malware  │        │
    └─────┬─────┘  └────┬─────┘        │
          │              │              │
          │  Webhooks    │  Webhooks    │
          └──────┬───────┘              │
                 │                      │
          ┌──────▼───────┐              │
          │     n8n      │              │
          │  Orquestador │              │
          └──────┬───────┘              │
                 │                      │
          ┌──────▼───────┐   ┌─────────▼──────┐
          │  PostgreSQL  │   │    Grafana     │
          │  Base Datos  │   │  Dashboard     │
          └──────────────┘   └────────────────┘
                 │                      │
          ┌──────▼──────────────────────▼──────┐
          │             Nginx                  │
          │         Proxy Reverso              │
          └────────────────────────────────────┘
```

### Redes Segmentadas

Dividimos los servicios en **dos redes** por seguridad:

| Red | Subred | Servicios | ¿Acceso a internet? |
|-----|--------|-----------|---------------------|
| 🔴 DMZ | 172.20.0.0/24 | Cowrie, Dionaea | Sí (expuestos) |
| 🔵 Interna | 172.21.0.0/24 | PostgreSQL, n8n, Grafana | **No** (segura) |

**¿Por qué?** Si un atacante logra escapar del honeypot, se encuentra en la red DMZ. Desde ahí NO puede ver la base de datos ni el orquestador. La red interna no tiene salida a internet.

### Decisiones Técnicas Clave

| Decisión | Elegimos | Alternativa | ¿Por qué? |
|----------|----------|-------------|-----------|
| Orquestación | Docker Compose | Kubernetes | Un solo equipo, no necesitamos clustering |
| Base de datos | PostgreSQL 15 Alpine | Imagen completa | Alpine ocupa ~5MB vs ~200MB |
| Autenticación n8n | Básica | OAuth | Simple para entorno académico |
| Backend n8n | PostgreSQL | Archivos locales | Persistencia real, recuperable |

---

---

## Lección 7: Puertos y Conflictos en Windows

### ¿Qué es un puerto?

Un **puerto** es como una "puerta" numerada por donde las aplicaciones se comunican. Imaginá que tu PC es un edificio:

- **Dirección IP** = La dirección del edificio
- **Puerto** = El número de departamento

Cuando un servicio quiere comunicarse, "abre" un puerto y escucha. Si dos servicios quieren usar el mismo puerto... ¡problema!

### Por qué tuvimos conflictos en Windows

Al levantar Docker en Windows nos encontramos con dos conflictos:

| Puerto | Lo quería usar | Lo usa |
|--------|----------------|--------|
| **80** | Nginx y Dionaea | Nginx se lo ganó |
| **445** | Dionaea (SMB) | **Windows** (compartir archivos) |

### Cómo lo solucionamos

No podemos cambiar el puerto que Windows usa internamente, así que cambiamos los puertos **externos** (del host) que mapean a los puertos **internos** (del contenedor):

```
Original:  HTTP_PORT=80  →  Puerto 80 del host : Puerto 80 del contenedor
Cambiado:  HTTP_PORT=8080  →  Puerto 8080 del host : Puerto 80 del contenedor

Original:  SMB_PORT=445  →  Puerto 445 del host : Puerto 445 del contenedor
Cambiado:  SMB_PORT=4445  →  Puerto 4445 del host : Puerto 445 del contenedor
```

El servicio adentro del contenedor **siempre usa el mismo puerto** (80 para HTTP, 445 para SMB), pero desde afuera accedemos por otro puerto. Esto es posible gracias al mapeo de puertos de Docker.

---

## Lección 8: El Proyecto Ya Está Funcionando 🎉

### ¿Qué logramos?

```
docker compose up -d → 6 servicios funcionando:

┌─────────────────────────────────────────────────┐
│               TU PC (Windows)                     │
│                                                   │
│  ┌────────────┐  ┌────────────┐                   │
│  │  soc-n8n   │  │soc-postgres│                   │
│  │ :5678      │  │ :5432      │                   │
│  │ (healthy)  │  │ (healthy)  │                   │
│  └─────┬──────┘  └────────────┘                   │
│        │                                           │
│  ┌─────▼──────┐  ┌────────────┐                   │
│  │ soc-cowrie │  │soc-dionaea│                   │
│  │ :2222-2223 │  │ :21,8080,4445│                 │
│  └────────────┘  └────────────┘                   │
│                                                   │
│  ┌────────────┐  ┌────────────┐                   │
│  │soc-grafana │  │ soc-nginx  │                   │
│  │ :3000      │  │ :80,443    │                   │
│  └────────────┘  └────────────┘                   │
└─────────────────────────────────────────────────┘
```

### URLs accesibles ahora mismo

| Servicio | URL | Usuario | Contraseña |
|----------|-----|---------|------------|
| **n8n** (orquestador) | http://localhost:5678 | admin | TuContrasenaN8n456! |
| **Grafana** (dashboard) | http://localhost:3000 | grafana_admin | TuContrasenaGrafana789! |
| **Nginx** (proxy) | http://localhost:80 | — | — |

### Nota importante sobre puertos

En Windows, algunos puertos están reservados:
- **80** → Puede usarlo Nginx o algún otro servicio
- **443** → Similar al 80, para HTTPS
- **445** → Windows SMB (compartir archivos) - **no se puede liberar fácilmente**
- **21** → FTP (suele estar libre)

Si al reiniciar la PC algún servicio no arranca por puerto ocupado, revisar esta sección.

---

## Lección 9: Solución de Problemas — Grafana en Bucle de Reinicio

### El Problema

Después de levantar todo con `docker compose up -d`, Grafana entraba en un bucle de reinicio:
```
soc-grafana   Started
soc-grafana   exited (error)
soc-grafana   Started
soc-grafana   exited (error)
... (se repite infinitamente)
```

### La Causa

Grafana tenía configurada la variable `GF_INSTALL_PLUGINS=grafana-piechart-panel`. Esta variable le dice a Grafana que **descargue un plugin** desde internet al arrancar.

El problema es que Grafana está en la **red interna** (`red_interna`), que tiene `internal: true`. Esto significa que **no tiene acceso a internet** por diseño de seguridad.

```
GF_INSTALL_PLUGINS → intenta descargar de grafana.com
                              ↓
                 red_interna (internal: true)
                              ↓
                 ¡No hay internet! DNS falla
                              ↓
                   Grafana falla y se reinicia
```

### La Solución

Simple: eliminamos la variable `GF_INSTALL_PLUGINS` del `docker-compose.yml`. Ese plugin (`grafana-piechart-panel`) ya no es necesario en Grafana 13 porque los gráficos de tortilla vienen incluidos.

```
# ANTES (roto):
environment:
  - GF_INSTALL_PLUGINS=grafana-piechart-panel  ← intenta descargar

# DESPUÉS (anda):
environment:
  # Sin GF_INSTALL_PLUGINS → no intenta descargar nada
```

### Conceptos que aprendimos acá

1. **Red interna (`internal: true`)**: Los contenedores en esta red NO tienen acceso a internet. Es una medida de seguridad.
2. **`GF_INSTALL_PLUGINS` está deprecado**: En Grafana 13 ya no se usa, hay formas más nuevas.
3. **Logs para diagnosticar**: `docker compose logs grafana` nos mostró el error exacto.
4. **Los warnings no siempre son errores**: Después de arreglarlo, Grafana tira warnings como `update check failed` (no puede checkear actualizaciones sin internet) o `database locked` (locks de SQLite). Estos **no causan reinicios**, son normales.

---

## Lección 10: Cómo Pausar el Proyecto (stop/start)

### ¿Por qué pausar?

Cuando no estamos trabajando, los contenedores siguen consumiendo **RAM** y **CPU** innecesariamente. Podemos "apagarlos" sin perder datos.

### Stop vs Down

| Comando | ¿Borra contenedores? | ¿Borra datos? | ¿Libera RAM? |
|---------|:-------------------:|:-------------:|:------------:|
| `docker compose stop` | ❌ | ❌ | ✅ |
| `docker compose down` | ✅ | ❌ (conserva volúmenes) | ✅ |
| `docker compose down -v` | ✅ | ✅ **BORRA TODO** | ✅ |

**Regla de oro:** Siempre usar `stop` cuando terminamos. `down -v` SOLO si queremos resetear todo desde cero.

### Los Scripts

Creamos dos archivos en la raíz del proyecto:

#### `stop.bat`
```batch
@echo off
echo Deteniendo el SOC de Honeypots...
docker compose stop
pause
```
**Qué hace:** Detiene todos los contenedores, libera RAM, pero mantiene:
- ✅ Bases de datos (PostgreSQL)
- ✅ Logs de honeypots
- ✅ Configuraciones
- ✅ Contenedores (no los borra)

#### `start.bat`
```batch
@echo off
echo Iniciando el SOC de Honeypots...
docker compose start
pause
```
**Qué hace:** Reanuda todos los contenedores exactamente como estaban.

### Cómo usarlos
- **Doble click** en el archivo
- O desde terminal: `.\stop.bat` / `.\start.bat`

---

## Próximas Lecciones

- [ ] **Lección 11**: ¿Qué es un Honeypot? (Cowrie y Dionaea)
- [ ] **Lección 12**: ¿Qué es n8n y cómo funciona?
- [ ] **Lección 13**: MITRE ATT&CK (clasificación táctica de ataques)
- [ ] **Lección 14**: PostgreSQL y bases de datos
- [ ] **Lección 15**: Redes y seguridad en Docker
- [ ] **Lección 16**: n8n Workflows — automatizando respuestas a ataques ⬅️ PRÓXIMA

---

*Este archivo se va actualizando a medida que avanzamos con el proyecto.*
*Última actualización: 04/06/2026*
