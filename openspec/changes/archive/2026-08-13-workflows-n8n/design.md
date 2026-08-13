## Context

Actualmente el SOC tiene:
- **Cowrie** (honeypot SSH/Telnet) → escucha en puertos 2222-2223
- **Dionaea** (honeypot malware) → escucha en puertos 21, 8080, 4445
- **n8n** (orquestador) → http://n8n:5678, recibe webhooks pero sin workflows
- **PostgreSQL** → base de datos operativa, actualmente solo usada por n8n como backend interno

Los honeypots ya están configurados para enviar webhooks a n8n, pero no hay workflows que procesen esos datos. La información de ataques se pierde.

Necesitamos:
1. Un esquema de base de datos para almacenar eventos de ataque
2. Workflows de n8n que reciban los webhooks y persistan los datos
3. Que los workflows sean versionables (archivos importables, no solo desde la UI)
4. Un **sidecar unificado** (contenedor Python nuevo) que lea los logs de ambos honeypots y los reenvíe a n8n — los honeypots NO postean HTTP directo (ver Decisión 6)

## Goals / Non-Goals

**Goals:**
- Usar la tabla existente `honeypot_events` (16 columnas, creada por `init.sql`) — NO crear DDL en los workflows
- **Emisión (Camino B)**: construir el sidecar unificado que lee el jsonlog de Cowrie → POST a `/webhook/cowrie`; y que DEJE preparada la fuente Dionaea (`dionaea.json` → POST a `/webhook/dionaea`) para activarse en fase posterior
- **Cowrie (config)**: overlay `cowrie/config/cowrie.cfg` `[output_jsonlog]` `logfile = log/cowrie.json` para que el jsonlog salga del volumen anónimo y sea legible por el sidecar
- **Cowrie**: usar el playbook PB-H1 existente como receptor en `/webhook/cowrie` (arreglando su SQL) + PB-H2 como sub-workflow para comandos
- **Dionaea**: crear workflow "Dionaea Webhook" que recibe POST en `/webhook/dionaea` y guarda en BD
- Exportar los workflows como archivos JSON en el repositorio
- Que quede funcionando y persistente (si n8n se reinicia, los workflows siguen)

**Non-Goals:**
- NO incluye dashboards de Grafana (próximo cambio)
- NO incluye alertas ni notificaciones (próximo cambio)
- NO re-crea desde cero el receptor de Cowrie: se adopta y corrige el playbook existente
- (El enriquecimiento AbuseIPDB/Shodan/VirusTotal y el scoring YA existen en PB-H1/PB-H2; este change los deja funcionando pero no amplía su lógica)
- NO incluye análisis ni correlación entre eventos

## Decisions

### Decisión 1: Tabla única vs tablas separadas por honeypot

**Elegido:** Tabla única `honeypot_events` con campo `source_honeypot` y `raw_data` JSONB — ya existe, creada por `postgres/init.sql`.

| Opción | Pro | Contra |
|--------|-----|--------|
| Tabla única + JSONB (elegida) | Consultas simples, schema flexible, fácil de expandir | Validación menos estricta |
| Tablas separadas (cowrie_events, dionaea_events) | Schema rígido, mejor integridad | Más complejo, joins innecesarios para dashboards |

**Razón:** Para la etapa actual priorizamos simplicidad y flexibilidad. JSONB nos permite capturar TODO lo que mande cada honeypot sin tener que adaptar el schema cada vez. El esquema real de 16 columnas ya contempla `username`/`commands` para Cowrie, `malware_hash`/`malware_filename` para Dionaea, y campos de uso futuro (`risk_score`, `att_ck_technique`, `enrichment_data`, `playbook_id`). `init.sql` es la fuente única del esquema — los workflows solo insertan, no ejecutan DDL.

> **Nota de alineación:** La spec original planeaba una tabla `attack_events` de 10 columnas; esa tabla NO existe. El cambio se alinea con `honeypot_events` real, que es más completa.

### Decisión 2: Workflows versionables vs solo UI

**Elegido:** Exportar workflows como JSON en `n8n/workflows/`.

n8n permite exportar/importar workflows como JSON. Los guardamos en el repo para:
- Poder restaurarlos si se borra el contenedor
- Versionar los cambios (git)
- Tener un respaldo fuera de la UI de n8n

### Decisión 3: Puerto del webhook en n8n

**Elegido:** Usar el webhook por defecto de n8n (puerto 5678, ruta `/webhook/<nombre>`).

Los webhooks de n8n (destino de los POST, hoy emitidos por el sidecar — ver Decisión 6) son:
- Cowrie → `http://n8n:5678/webhook/cowrie`
- Dionaea → `http://n8n:5678/webhook/dionaea`

> **Nota Camino B:** las URLs de destino son las mismas, pero quien postea es el sidecar unificado (Decisión 6), no los honeypots directamente.

### Decisión 4: Estrategia de mapeo de payload → columnas

**Elegido:** Normalización mínima en un nodo Code + `raw_data` completo. Cada workflow tiene un nodo Code que aplana el payload del honeypot a las columnas de `honeypot_events` (con fallbacks), valida `src_ip`, y el nodo PostgreSQL inserta con **parámetros** (`$1, $2...`), nunca interpolación directa.

**Nota de adopción:** PB-H1 ya tiene su nodo "Normalizar Datos" y PB-H2 su "Extraer IOCs" — se **mantienen** como punto de normalización, pero sus nodos PostgreSQL deben migrarse de interpolación a parámetros (ver anti-patrón abajo).

**Mapeo Cowrie** (payload tipo jsonlog; campos en camelCase o snake_case):

| Columna | Origen | Fallback | Nota |
|---------|--------|----------|------|
| `source_honeypot` | `'cowrie'` | — | constante |
| `src_ip` | `src_ip` | `source_ip` | validar IP; si inválida → `'0.0.0.0'` |
| `dst_port` | `dst_port` | `port` | castear `parseInt` |
| `protocol` | `protocol` | derivar del `eventid` | `ssh`/`telnet` |
| `username` | `username` | — | NULL si no viene |
| `commands` | `command` | `input` | Cowrie usa `input` en command events |
| `timestamp` | `timestamp` | `NOW()` | ISO string ok |
| `raw_data` | payload íntegro | — | siempre |

**Mapeo Dionaea** (payload de connection events; campos anidados en `connection.*`):

| Columna | Origen | Fallback | Nota |
|---------|--------|----------|------|
| `source_honeypot` | `'dionaea'` | — | constante |
| `src_ip` | `connection.remote_host` | `remote_host` | validar IP; si inválida → `'0.0.0.0'` |
| `dst_port` | `connection.local_port` | `local_port` | castear `parseInt` |
| `protocol` | `connection.protocol` | `protocol` | smbd, ftpd, httpd... |
| `malware_hash` | `download.sha256` | — | solo si capturó binario |
| `malware_filename` | `download.filename` | — | ídem |
| `timestamp` | `timestamp` | `NOW()` | |
| `raw_data` | payload íntegro | — | siempre |

**Reglas transversales:**
- **`src_ip` INET NOT NULL**: si el payload no trae una IP válida (hostname, vacío), el nodo Code usa `'0.0.0.0'` como IP desconocida. NO se migra el esquema a nullable (se evita el cambio de schema).
- **INSERT parametrizado**: el nodo PostgreSQL recibe valores limpios del nodo Code con placeholders `$1, $2...`. Prohibida la interpolación `{{ $json[...] }}` dentro del query (riesgo de inyección y errores de tipo).
- **Columnas de uso futuro** (`risk_score`, `att_ck_technique`, `enrichment_data`, `playbook_id`): quedan con su default/NULL; los playbooks posteriores las llenan.
- **Anti-patrón detectado (debe corregirse)**: los playbooks PB-H1 y PB-H2 (`workflows/*.json`) interpolan `{{ $json[...] }}` directo en el SQL — Y PB-H1 castea `'{{enrichment_timestamp}}'::jsonb` que es un timestamp ISO (no JSON válido) y **falla en runtime**. Este change los migra a INSERT parametrizado con cast correcto.
- **`raw_data` obligatorio**: los playbooks actuales NO guardan el payload completo — deben agregar `raw_data` = payload íntegro al INSERT.

### Decisión 5: Arquitectura de receptores (playbooks existentes)

**Contexto:** El usuario tiene 2 playbooks previos (`C:\Tesis n8n HoneyPots\`) que ya están en el repo (`workflows/`): PB-H1 escucha en `/webhook/cowrie` y PB-H2 en `/webhook/cowrie-command`.

**Problema:** n8n no permite dos workflows ACTIVOS con la misma ruta webhook, y todos los eventos de Cowrie llegan a una sola URL (`http://n8n:5678/webhook/cowrie`, emitidos por el sidecar de la Decisión 6; en la anterior asunción se usaba `COWRIE_OUTPUT_ENDPOINT`, verificada como **código muerto** en cowrie 3.0.12). La ruta `/webhook/cowrie-command` de PB-H2 **nunca recibiría tráfico** — PB-H2 jamás se dispararía en producción.

**Elegido:** PB-H1 como receptor único de Cowrie + PB-H2 como **sub-workflow** ejecutado por PB-H1.

```
Cowrie ──todos los eventos──▶ /webhook/cowrie (PB-H1, receptor)
                                   │
                                   │ nodo "Execute Workflow" de n8n
                                   │ (solo si el evento trae comando)
                                   ▼
                             PB-H2 (sub-workflow, sin ruta propia)
```

- PB-H1: receptor activo en `/webhook/cowrie`; su webhook original se mantiene.
- PB-H2: pierde su rol de webhook — se ejecuta vía nodo *Execute Workflow* (sub-workflow). Se puede conservar su nodo Webhook para testing manual, pero **no se activa**.
- La ruta `/webhook/dionaea` queda libre para el workflow Dionaea nuevo (no había conflictos — no existe ningún playbook para Dionaea).

### Decisión 6: Arquitectura de emisión — sidecar unificado (Camino B)

**Reemplaza la asunción anterior:** en las decisiones previas se asumía que Cowrie enviaba webhooks HTTP directo a n8n. Eso es **FALSO** (verificado en el change archivado `conectar-y-verificar`): la imagen `cowrie/cowrie:latest` (3.0.12) NO tiene el módulo de output `cowrie.output.http` (tiene 36 módulos de output, ninguno http) y la variable `COWRIE_OUTPUT_ENDPOINT` es código muerto. Dionaea tampoco soporta emisión HTTP nativa (`DIONAEA_OUTPUT_ENDPOINT` inexistente).

**Elegido (Camino B):** un **sidecar unificado** (contenedor Python) que lee los logs de AMBOS honeypots y los postea a los webhooks de n8n. Absorbe el futuro "puente Dionaea".

```
cowrie   (jsonlog → bind-mount cowrie/logs)   ──┐
                                                 │
                                                 ├──▶ sidecar (python) ──POST──▶ http://n8n:5678/webhook/cowrie|dionaea ──▶ n8n workflow ──▶ PostgreSQL honeypot_events
                                                 │
dionaea  (dionaea.json → bind-mount dionaea/logs) ──┘
```

**El puente reemplaza la emisión HTTP nativa**: los honeypots escriben logs; el sidecar los lee y los reemite a n8n. Es el único punto que toca red y los webhooks.

**Diseño del sidecar (`soc-sidecar`):**
- **Nombre sugerido del contenedor:** `soc-sidecar` (alternativa `soc-bridge`)
- **Imagen:** `python:3-alpine` (o `python:3-slim`) — imagen python mínima, sin depender del contenedor distroless de Cowrie
- **Redes:** `red_dmz` + `red_interna` — necesita alcanzar el bind-mount de cowrie (en `red_dmz`) Y n8n (en `red_interna`)
- **Montajes (solo lectura):** volumen/bind-mount `cowrie/logs` (jsonlog) + `dionaea/logs` (dionaea.json)
- **Env vars:**
  - `COWRIE_JSONLOG_PATH` → ruta al jsonlog de cowrie (ej: `/logs/cowrie.json`)
  - `DIONAEA_JSONLOG_PATH` → ruta a `dionaea.json` (opcional en esta fase)
  - `N8N_COWRIE_URL` → `http://n8n:5678/webhook/cowrie`
  - `N8N_DIONAEA_URL` → `http://n8n:5678/webhook/dionaea`
- **Retry strategy:** si n8n está caído, reintenta con backoff (aleatorio/exp/exponencial) y retiene el evento en cola hasta éxito — cowrie escribe al archivo pase lo que pase, el sidecar NO debe perder eventos.
- **Log rotation:** debe detectar la recreación/re-escritura del archivo (p.ej. truncado o nuevo inode) y re-tail desde el principio de ese archivo nuevo, sin duplicar ni perder líneas.
- **Payload normalization:** pass-through del event dict + tag `source_honeypot`. **Forma canónica (verificada en E2E 6.8):** los workflows PB-H1 ("Normalizar Datos") y Dionaea ("Mapear Dionaea") leen los campos del honeypot desde la RAÍZ del body del webhook, por lo que el sidecar aplana el payload con el tag al mismo nivel (no anidado):
  ```json
  { "source_honeypot": "cowrie", "session": "...", "src_ip": "...", "eventid": "...", ... }
  ```
  La forma anidada `{ "source_honeypot": "cowrie", "event": { ... } }` se descartó en el apply: los nodos Code leen `payload.src_ip`/`payload.eventid` en la raíz, y no se modifican los workflows. `raw_data` del workflow captura este payload íntegro (incluye `source_honeypot`).
  Para cowrie, claves canónicas comunes: `session`, `protocol`, `src_ip`, `src_port`, `dst_ip`, `dst_port`, `eventid`, `sensor`, `uuid`, `timestamp`, `message`; por eventid: `login.success` → `username`/`password`; `command.input` → `input`; `client.version` → `version`; `log.closed` → `ttylog`/`size`/`shasum`/`duplicate`/`duration_ms`.
- **Strip de password (opcional):** el sidecar PUEDE eliminar el campo `password` de `login.success` antes de postear (política de seguridad); en todo caso el workflow de n8n DEBE filtrarlo antes de persistir (ver nota de seguridad).
- **TDD obligatorio:** el sidecar es código que nosotros escribimos — se debe testar con unit tests (tailer, retry, normalización) antes de integrar.

**Config overlay de Cowrie** (slot oficial de config, hoy vacío): crear `cowrie/config/cowrie.cfg`:

```ini
[output_jsonlog]
enabled = true
logfile = log/cowrie.json
```

- `cwd` de la imagen es `/cowrie/cowrie-git`, así que `log/cowrie.json` resuelve a `/cowrie/cowrie-git/log/cowrie.json` = **bind-mount `cowrie/logs`** (verificado como usable).
- Impide que el jsonlog caiga en el volumen anónimo; el sidecar lee desde el bind-mount.
- Los env vars no pueden crear secciones, por eso se usa el archivo `.cfg` (no `COWRIE_<SECTION>_<OPTION>`).

**Dionaea — fuente preparada / fase posterior:** el sidecar DEBE diseñarse capaz de leer `dionaea.json` y postear a `/webhook/dionaea` (formato de ihandler `log_json` de `dinotools/dionaea`), pero para ESTE change la fuente dionaea está **dormante**: Dionaea sigue inerte por configuración (`services-enabled/` e `ihandlers-enabled/` vacíos → 0 listeners). Habilitar los servicios de Dionaea (y su ihandler `log_json`) es una fase posterior y NO bloquea este change. Con `dionaea.json` ausente, el sidecar arranca igual y solo procesa cowrie.

### Decisión 7: Despertar Dionaea (6.7) y política de captura de malware

**Contexto — por qué Dionaea hoy es un honeypot mudo (verificado en exploración):**

La imagen `dinotools/dionaea:latest` trae un directorio `template/` que contiene los `services-enabled/` (16 symlinks) e `ihandlers-enabled/` (6 symlinks) por defecto. El `entrypoint.sh` los copia a `etc/` **SOLO si `etc/dionaea` NO existe** en el contenedor:

```sh
test ! -d /opt/dionaea/etc/dionaea && init_etc   # copia template/etc si no existe
```

Nuestro bind-mount `./dionaea/config:/opt/dionaea/etc` hace que `etc/dionaea` EXISTA → el template **nunca se copia** → no hay `services-enabled/` ni `ihandlers-enabled/` → **0 listeners y 0 ihandlers**. Se confirmó en el log del contenedor vivo: `Initializing services ...` sin ninguna línea de bind/listen posterior. El contenedor está Up pero no atiende nada.

**Elegido:** crear los directorios `*-enabled` como **copias reales** de los `.yaml` (no symlinks — frágiles en Windows + OneDrive + git; dionaea solo lee los archivos, no distingue symlink vs copia).

**Servicios a habilitar (`services-enabled/`):**

| Servicio | Puerto | Recomendación | Razón |
|----------|--------|---------------|-------|
| `smb` | 445 (✓ compose) | ✅ **Sí** | El rey del malware en Windows (gusans EternalBlue, ransomware) |
| `ftp` | 21 (✓ compose) | ✅ **Sí** | Bots dropean payloads vía FTP |
| `http` | 80 (✓ compose) | ✅ **Sí** | Emula servidor web; captura requests de explotación |
| `mssql` | 1433 (Agregado) | ✅ **Sí** | Favorita de ransomware moderno (REvil, LockBit). **Decidido incluir** (puerto 1433 verificado LIBRE en el host, 2026-08-12) — requiere `.env` (`DIONAEA_MSSQL_PORT=1433`) + mapeo en compose + copia de `mssql.yaml` |
| resto (epmap, sip, upnp, mongo...) | — | ❌ No | Ruido, bajo valor de captura |

**Regla de oro:** un servicio sin puerto mapeado en el compose es plataforma perdida. Base = los 4 del compose: `smb` (445), `ftp` (21), `http` (80), `mssql` (1433).

**Ihandlers a habilitar (`ihandlers-enabled/`):**

| Ihandler | Recomendación | Razón |
|----------|---------------|-------|
| `log_json` | ✅ **OBLIGATORIO** | Genera `dionaea.json` que alimenta el sidecar. **NO está en el template** — hay que crearlo y **corregir su path** (ver abajo) |
| `emuprofile` | ✅ Sí | Perfiles para el módulo `emu` (ya cargado en cfg) — análisis en sandbox |
| `ftp` | ✅ Sí | Pareja del servicio ftp activo |
| `store` | ⚠️ **TEMPORAL** | Solo para la prueba EICAR controlada (política de malware, ver abajo). OFF por defecto |
| `tftp_download` | ❌ | No habilitamos tftp |
| `cmdshell` | ❌ | Shell falsa = más interacción pero más riesgo/complejidad; agregable luego |
| `log_sqlite` | ❌ | Duplica en SQLite local lo que ya centralizamos en PostgreSQL — ruido |
| fail2ban, virustotal, submit_http, p0f, nfq, s3, hpfeeds, log_db_sql... | ❌ | APIs, credenciales o servicios externos que no aportan |

**Path corregido de `log_json` (crítico):** el yaml de `ihandlers-available/` apunta a `file://var/lib/dionaea/dionaea.json` — **FUERA** del bind-mount `./dionaea/logs`. El sidecar espera `/logs/dionaea/dionaea/dionaea.json` = `var/log/dionaea/dionaea.json` en el contenedor. El `log_json.yaml` habilitado debe apuntar a:

```yaml
- name: log_json
  config:
    handlers:
      - file:///opt/dionaea/var/log/dionaea/dionaea.json
```

**Gotcha de URL `file://` (verificado 2026-08-12):** `urlparse('file://var/log/...')` interpreta `var` como **host** (`netloc`), produciendo el path absoluto `/log/dionaea/dionaea.json` → el FileHandler lanza `Unable to open file /log/dionaea/dionaea.json` (error crítico en el arranque). La URL correcta es **triple-slash** `file:///opt/dionaea/var/log/...` → `urlparse` da el path absoluto completo del contenedor, que coincide con el bind-mount `./dionaea/logs:/opt/dionaea/var/log`. El sidecar lee `dionaea/logs/dionaea/dionaea.json`.

**Política de captura de malware (decisión del usuario):**

- **`store` OFF por defecto → modo metadata-only.** El `dionaea.json` ya captura `sha256`, `md5`, `url`, `tamaño`, `src_ip` — dataset COMPLETO para la tesis de automatización sin almacenar binarios.
- **Nunca se almacena malware real en la máquina del usuario.** Si el honeypot está expuesto a internet y llega malware real, se pierde (solo queda el hash) — mitigación aceptada.
- **Captura de binarios = prueba controlada con EICAR** (el "archivo de prueba" inofensivo que todo AV reconoce como malware sin serlo): se enciende `store` temporalmente, se sirve un EICAR desde un HTTP local, se provoca la descarga, se verifica que el archivo capturado ES el EICAR, y se apaga `store`. La cadena queda probada, cero riesgo.

**Discrepancia de rutas de binarios (hallazgo):** el compose monta `./dionaea/binaries:/opt/dionaea/var/dionaea/binaries` pero el cfg tiene `download.dir=var/lib/dionaea/binaries/` → los binarios caerían en un volumen anónimo, NO al host. **Se deja SIN corregir** — es una contención de facto: aunque algo se descargue, no llega al filesystem del host. Documentado como mitigación adicional (no como mecanismo de seguridad formal).

**Versionado:** los 2 directorios `*-enabled` están en `.gitignore` hoy — se deben **sacar del ignore** para versionarlos (repo público, config reproducible).

### Decisión 8: HALLAZGO — `log_json` NO emite eventos de descarga; fork mínimo del handler

**Hallazgo verificado en código (2026-08-12, explore):** el `log_json.py` de la imagen (`/opt/dionaea/lib/dionaea/python/dionaea/log_json.py`) **solo serializa eventos de conexión** (`dionaea.connection.*`), credenciales (ftp/mssql/mysql login), comandos FTP y p0f. **NO tiene manejador para `dionaea.download.offer` / `dionaea.download.complete` / `dionaea.download.complete.hash`** — el hash del binario capturado circula internamente por incidentes (lo maneja `store.py`), pero jamás llega al `dionaea.json`.

**Implicación:** aunque la descarga TFTP del EICAR tenga éxito y `store` guarde el binario, el sidecar → n8n → PostgreSQL **NUNCA vería `download.sha256`** en el payload. El mapeo `malware_hash ← download.sha256` de la Decisión 4 quedaría siempre NULL.

**Elegido: fork mínimo de `log_json.py`** (montado como bind-mount sobre la imagen):

- Copiar `log_json.py` del contenedor a `dionaea/python/log_json.py`
- Agregar UN manejador (~20 líneas): `handle_incident_dionaea_download_complete_hash` → serializa `download` con `{md5, url, file}` (el binario con nombre = md5, ya que `store.py` usa `md5file`, no sha256) asociado a la conexión (`icd.con` como en las credenciales)
- Montar en compose: `./dionaea/python/log_json.py:/opt/dionaea/lib/dionaea/python/dionaea/log_json.py` (bind-mount de archivo)
- NO se toca el sidecar, los workflows n8n ni el esquema PostgreSQL — el payload de conexión simplemente llega enriquecido con la sección `download`

**Nota técnica:** `store.py` calcula **MD5** (`md5file`), no SHA256. El fork expone ese MD5 como `download.md5`; el schema `honeypot_events.malware_hash` lo recibe. Se documenta que la imagen entrega MD5 — suficiente para la tesis (identificación + verificación contra el EICAR).

**Nota de trigger (Opción B):** el incidente `dionaea.download.offer` (que dispara `tftp_download.py`) se origina en ataques REALES vía el módulo `emu` emulando shellcode que ejecuta `tftp.exe -i <host> get <file>`, o por reporte interno de script python dentro del daemon. No es alcanzable por curl externo. La prueba EICAR controlada usa un **perfil de emulación conocido** (`dionaea.module.emu.profile` con `CreateProcess("tftp.exe -i ... get ...")` — el patrón de la doc oficial) para que la descarga salga del servidor TFTP local que nosotros controlamos. Ver 6.7.4.

### Decisión 8b: HALLAZGO — bug upstream en `tftp.py` rompe la descarga TFTP; fork mínimo

**Hallazgo verificado en código (2026-08-12, apply):** al inspeccionar el `tftp.py` de la imagen (`/opt/dionaea/lib/dionaea/python/dionaea/tftp.py`, handler `handle_established`, ~línea 928), el código accede a `g_dionaea.config()['downloads']` — **formato viejo de la config, ya eliminado en la imagen actual** → lanza `KeyError` en runtime. Ese tramo es exactamente el que crea el archivo temporal del binario que `store`/`tftp_download` luego mueven, así que **ninguna descarga TFTP puede completarse con la imagen stock** aunque el trigger (Dionaea Offer) se dispare.

Verificado por dónde se busca la clave: `store.py` usa el formato nuevo `g_dionaea.config()['dionaea']['download.dir']` (el que sí existe en la imagen). Discordancia upstream: `tftp.py` quedó con el acceso viejo.

**Elegido: fork mínimo de `tftp.py`** (mismo patrón que la Decisión 8, bind-mount de archivo):

- Copiar `tftp.py` del contenedor a `dionaea/python/tftp.py`
- Reemplazar el acceso roto `g_dionaea.config()['downloads']` por `g_dionaea.config()['dionaea']['download.dir']` (misma clave que usa `store.py`), con `suffix='.tmp'` (mínimo cambio, respeta el flujo de `tftp_download.py` que mueve del `.tmp` al destino). Respetando exactamente el estilo del archivo
- Montar en compose: `./dionaea/python/tftp.py:/opt/dionaea/lib/dionaea/python/dionaea/tftp.py`
- Compilado y validado contra Python 3.6.9 del contenedor (`py_compile` OK)
- NO se toca el sidecar ni los workflows — solo desbloquea la cadena de descarga que la prueba EICAR de 6.7.5 necesita

**Nota:** si `download.dir` no estuviera configurado devolvería `None` y `NamedTemporaryFile(dir=None)` cae al tempdir del sistema — sin crash, contenido de facto. La imagen siempre lo define (`download.dir=var/lib/dionaea/binaries/`).

### Resultado de la prueba EICAR (6.7.5) — verificado 2026-08-13

Prueba de extremo a extremo con EICAR ACCEPTADA. La cadena completa se disparó con **trigger real** (no simulación directa):

1. Shellcode x86-32 real (GetPC + burn loop) enviado al servicio **mssqld:1433**.
2. El módulo **emu** de dionaea lo detecta (`shellcode found offset 0`), lo emula y perfila la llamada **`WinExec("tftp.exe -i 172.20.0.7 get eicar.txt")`** (`dionaea.module.emu.profile` + `profiledump`).
3. Se emite **`dionaea.download.offer`** con `url: tftp://172.20.0.7/eicar.txt`.
4. El fork de **`tftp.py`** (Decisión 8b) hace `do download` / `Connecting to 172.20.0.7 to download`, descarga el EICAR del servidor TFTP local.
5. El handler **`store`** (temporal) guarda el binario y emite `dionaea.download.complete` → `.hash` → `.unique`; `md5file` confirma **MD5=`44d88612fea8a8f36de82e1278abb02f`** (el hash canónico del EICAR).
6. El fork de **`log_json.py`** (Decisión 8) serializa `download.md5` en `dionaea.json` (payload con `md5`, `url`, `file`).
7. **sidecar** → n8n (`PB-DIONAEA-v1.0`) → PostgreSQL `honeypot_events` fila **id=53** con `source_honeypot='dionaea'`, `src_ip=172.20.0.1`, `dst_port=1433`, `protocol=mssqld`, `malware_hash=44d88612fea8a8f36de82e1278abb02f`, `playbook_id=PB-DIONAEA-v1.0`, `att_ck_technique=T1190` (fila id=52 registra el cliente TFTP `172.20.0.7`).

**Gotchas documentados en la prueba:**

- **Log congelado dentro del contenedor:** con Docker Desktop + bind-mount, `docker exec ... dionaea.log` muestra el archivo CONGELADO a mitad de línea (stale mount). El log vivo es el del HOST: `dionaea/logs/dionaea/dionaea.log`. Siempre leer desde el host.
- **`download.dir` relativo:** el cfg tiene `download.dir=var/lib/dionaea/binaries/` (ruta relativa) → el binario cae en `/opt/dionaea/var/lib/dionaea/binaries/` DENTRO del contenedor, NO en el bind `./dionaea/binaries:/opt/dionaea/var/dionaea/binaries`. Decisión 7 lo documenta como contención de facto; confirmado en la prueba.
- **Causa raíz del eslabón faltante pre-prueba:** `store.yaml`/`tftp_download.yaml` se crearon DESPUÉS del primer arranque del contenedor y dionaea solo lee los `ihandler_configs` al iniciar → los handlers nunca se cargaron. Se resolvió con `docker compose up -d --force-recreate dionaea`.

**Limpieza post-prueba (metadata-only, política Decisión 7):** `store.yaml` y `tftp_download.yaml` removidos de `dionaea/config/dionaea/ihandlers-enabled/` (quedan solo `emuprofile`, `log_json`, `ftp`); contenedor auxiliar `tftp-eicar` eliminado; `soc-dionaea` recreado y verificado con binds 445/21/80/1433 y SIN store/tftp_download en el arranque.

## Risks / Trade-offs

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| n8n se reinicia y pierde workflows no guardados | Medio | Exportar los workflows a JSON y tenerlos en git |
| `src_ip` es INET y rechaza valores no-IP (hostnames, vacíos) | Medio | El nodo Code valida el campo; si no es IP válida inserta `'0.0.0.0'` (IP desconocida) — ver Decisión 4 |
| Formato del webhook cambia entre versiones de los honeypots | Bajo | El campo `raw_data` JSONB captura todo aunque cambie la estructura |
| PostgreSQL se llena de datos basura (escaneos) | Medio | Agregar rate-limiting o filtros después, por ahora almacenamos todo |
| La tabla crece rápido sin límite | Bajo | Agregar política de retención (ej: borrar datos > 30 días) cuando sea necesario |
| Los playbooks PB-H1/PB-H2 tienen SQL con interpolación y cast JSONB inválido | Alto | Migrar a INSERT parametrizado y cast correcto en este change (Decisión 4/5) |
| PB-H2 queda "huérfano" si el nodo Execute Workflow no se configura bien | Medio | Probar la ruta de comandos con un evento de prueba con `command` (task 4.x) |
| Cowrie NO emite HTTP nativo — la Decisión 5 asumía webhook directo | Alto | Sidecar unificado (Decisión 6) es quien postea; overlay `cowrie.cfg` expone el jsonlog en el bind-mount |
| n8n caído → cowrie escribe al archivo sin parar | Medio | Sidecar con retry + cola en memoria; sin pérdida de eventos (TDD) |
| Rotación/recreación del jsonlog rompe el tailer del sidecar | Medio | Sidecar detecta recreación del archivo y re-tail desde inicio (TDD) |
| El sidecar no alcanza n8n o el bind-mount (redes/permisos) | Alto | Sidecar en `red_dmz` + `red_interna`; verificar conectividad (task 6.x) |
| `password` en `login.success` se persiste sin filtrar | Medio | Sidecar opcionalmente la elimina; el workflow la filtra SIEMPRE antes de insertar |
| `dionaea.json` no existe en esta fase | Bajo | Fuente dionaea dormante; el sidecar arranca con solo cowrie |
| Dionaea expuesto a internet captura malware REAL | Alto | Política Decisión 7: `store` OFF por defecto → metadata-only; binarios caen en volumen anónimo (ruta de descargas sin bind-mount) → nunca al host |
| Los `*-enabled` de dionaea en `.gitignore` no se versionan | Medio | Sacar los 2 directorios del `.gitignore` y commitear los yaml habilitados (Decisión 7) |
| Symlinks en `*-enabled` (estilo imagen) se rompen en Windows/OneDrive | Medio | Usar copias reales de los `.yaml`, no symlinks (Decisión 7) |
| `log_json` apunta a `var/lib/...` fuera del bind-mount | Alto | Reescribir el handler a `file:///opt/dionaea/var/log/dionaea/dionaea.json` (triple-slash, Decisión 7) |
| `log_json` NO emite eventos de descarga (hallazgo) | Alto | Fork mínimo de `log_json.py` con manejador `download.complete.hash` (Decisión 8) |
| El trigger de descarga no es alcanzable por curl (solo emu/shellcode o python interno) | Medio | Prueba EICAR con perfil de emulación `CreateProcess("tftp.exe ...")` contra el servicio local (6.7.4) |
| El binario capturado se guarda con nombre = MD5 (`store.py` usa `md5file`) | Bajo | Documentar; `malware_hash` recibe MD5 — verificación contra EICAR por hash |
| Fork montado sobre la imagen se pierde si dionaea reinicia SIN el bind-mount | Medio | El bind-mount está en compose; el archivo versionado en `dionaea/python/log_json.py` |
| Bug upstream en `tftp.py`: `KeyError` en `handle_established` rompe TODA descarga TFTP | Alto | Fork mínimo de `tftp.py` con acceso `['dionaea']['download.dir']` (Decisión 8b); bind-mount en compose |
