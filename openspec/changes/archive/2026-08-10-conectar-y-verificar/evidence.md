# Evidence — Change `conectar-y-verificar`

Fecha: 2026-08-10 · Entorno: Windows, Docker Desktop 28.1.1 · Canal: diagnóstico secuencial de la cadena honeypot → n8n → PostgreSQL.

Regla: ninguna credencial real se anota en este archivo (se referencian como "ofuscadas"). Valores por defecto técnicos (puertos, subredes, URLs) sí.

---

## Paso 0 — `.env` y validación

| Ítem | Resultado | Razón |
|------|-----------|-------|
| 0.1 `.env` | ✅ Existente, verificado como correcto (sin regenerar). | Aprobado por el humano antes de este apply. |
| 0.2 `.env.example` | ✅ Existente con las MISMAS claves y placeholders vacíos. | Contrato versionable; `.env` en `.gitignore`. |
| 0.3 `docker compose config` | ✅ exit 0, **sin warnings** de variables vacías (stderr vacío). | Todas las variables interpolan. |
| 0.4 Semántica | ✅ Subredes `172.20.0.0/24` y `172.21.0.0/24` válidas (/24, rangos privados 172.16/12, no colisionantes entre sí). `N8N_ENCRYPTION_KEY` = 48 chars (≥32). Puertos asignados no colisionan en el host (ver paso 1). | Valores aprobados. |

**Cambio en `docker-compose.yml`** (único): línea 135 `- "3000:3000"` → `- "${GRAFANA_PORT:-3000}:3000"`. Verificado con `docker compose config`: grafana publica `3001:3000`.

---

## Paso 1 — Stack

| Ítem | Resultado |
|------|-----------|
| 1.1 Puertos libres | `2222, 2223, 21, 8080, 5678, 80, 443, 3001` **LIBRES**. `445` ocupado por SMB de Windows (por eso `DIONAEA_SMB_PORT=4445`) y `3000` por Grafana nativo (por eso `GRAFANA_PORT=3001`). |
| 1.2 `docker compose up -d` | ✅ 6 imágenes pull ok (postgres, n8n, cowrie, **dionaea**, grafana, nginx) y 6 contenedores creados/arrancados sin errores de creación. |
| 1.3 `docker compose ps` | 6/6 `Up`: `soc-postgres (healthy)`, `soc-n8n (healthy)`, `soc-cowrie (Up)`, `soc-dionaea (Up)`, `soc-grafana (Up)`, `soc-nginx (Up)`. |
| 1.4 Unhealthy/Exit | Ninguno. |

**Desviación F1:** grafana figura `Up` y NO `healthy` porque `docker-compose.yml` no define healthcheck para grafana (solo postgres y n8n lo tienen). No es un fallo; es la config archivada. Se deja anotado para el próximo change (agregar healthcheck opcional).

---

## Paso 2 — n8n desde el host

| Ítem | Resultado |
|------|-----------|
| 2.1 `GET /healthz` | ✅ HTTP 200 `{"status":"ok"}` al primer intento. |
| 2.2 retry | No hizo falta: n8n ya estaba `healthy`. |
| 2.3 UI | ✅ La raíz `http://localhost:5678/` responde HTTP 200 (SPA de la UI). El LOGIN en browser es paso humano (usuario `nachonave`, password ofuscada) — ver hallazgo F4. |

---

## Paso 3 — Red interna

Ambas imágenes mínimas NO traen `curl` ni `sh` estándar, así que la prueba se hizo con `python3 - urllib` dentro del contenedor (equivalente funcional, no causal):

| Ítem | Resultado |
|------|-----------|
| 3.1 Cowrie → n8n | ✅ `COWRIE->N8N HTTP 200 {"status":"ok"}` desde soc-cowrie a `http://n8n:5678/healthz`. |
| 3.2 Dionaea → n8n | ✅ `DIONAEA->N8N HTTP 200 {"status":"ok"}` desde soc-dionaea. |
| 3.3 Registro | Ambos honeypots alcanzan n8n por NOMBRE de servicio → `red_dmz` (172.20.0.0/24) ↔ `red_interna` (172.21.0.0/24) operativas vía el gateway de las redes Docker. |

---

## Paso 4 — Inventario de workflows

| Ítem | Resultado |
|------|-----------|
| 4.1 Export CLI | `n8n export:workflow --all` → **"No workflows found with specified filters"** (exit 1). Evidencia cruda en `evidence-workflows.md` (sustituyó al .json porque el export falló, tal como admite el plan). Log de arranque de n8n corrobora: **0 draft workflows, 0 published workflows** (n8n 2.33.7). |
| 4.2/4.3 Cruce UI | No cruce automático posible: el probe `GET /rest/workflows` con HTTP Basic (credenciales `.env` ofuscadas) devolvió **401** (n8n 2.x exige sesión/cookie). La página raíz sí sirve 200. |

**Hallazgo F3 (importante):** la BD de n8n no contiene NINGÚN workflow. El change `workflows-n8n` (4/15) aún NO creó los receptores `/webhook/cowrie` ni `/webhook/dionaea`. Inventario heredado para `workflows-n8n` = **vacío**.

**Hallazgo F4:** el login de la UI no es verificable por máquina con HTTP Basic sobre `/rest` (401). Se confirma en browser por el humano (user `nachonave`) como paso pendiente de la tarea 2.3.

---

## Paso 5 — Endpoints webhook

| Endpoint | POST `{"test":true}` | Interpretación |
|----------|----------------------|----------------|
| `/webhook/cowrie` | **HTTP 404** | Receptor inexistente (0 workflows). Hallazgo esperado, NO bloquea. |
| `/webhook/dionaea` | **HTTP 404** | Ídem. Hallazgo esperado, NO bloquea. |

→ Ratifica F3: faltan los workflows receptores que creará `workflows-n8n`.

---

## Paso 6 — Emisión real de Cowrie (extremo a extremo)

**6.1 Emisor (✅ probado real):** con OpenSSH del host (`ssh -p 2222 root@localhost`, password `x` vía `SSH_ASKPASS`), Cowrie **autenticó al atacante** (honeypot) y ejecutó comandos (honeypot shell real: `uid=0(root)`, `uname -a` → kernel falso "Linux svr04 ...Debian", `whoami` → root). Face: sesión origen `172.20.0.1` (INET válido del rango DMZ).

Eventos capturados en el jsonlog de cowrie (`/cowrie/cowrie-git/var/log/cowrie/cowrie.json`):
```
cowrie.session.connect   ×3   cowrie.client.version ×3   cowrie.client.kex ×3
cowrie.login.success     ×2   cowrie.session.params ×2   cowrie.command.input ×2
cowrie.session.closed    ×3   cowrie.log.closed     ×2
```
Muestras reales (src_ip INET válida):
```
{"eventid":"cowrie.login.success","src_ip":"172.20.0.1","username":"root","dst_port":2222,"timestamp":"2026-08-10T18:27:04.149700Z"}
{"eventid":"cowrie.command.input","src_ip":"172.20.0.1","input":"uname -a; ls /tmp; whoami","timestamp":"2026-08-10T18:27:04.161806Z"}
```

**6.2 Persistencia (❌ NO persistida):**
```sql
docker exec soc-postgres psql -U honeypot_admin -d honeypot_soc -c "SELECT id, timestamp, source_honeypot, src_ip, username, commands FROM honeypot_events ORDER BY id DESC LIMIT 5;"
```
Resultado: **0 rows**. NO hay fila nueva (`source_honeypot='cowrie'` ausente).

**Causa raíz (F5, verificado):** la cadena webhook-http de cowrie está rota por DOS motivos independientes:
1. **`COWRIE_OUTPUT_ENDPOINT` es letra muerta.** Búsqueda en el fuente de cowrie 3.0.12 (`/cowrie/cowrie-git`, recursiva sobre *.py/*.cfg/*.sh/*.txt): **0 coincidencias** para `OUTPUT_ENDPOINT`/`OUTPUT_HTTP`. El engine cargado en runtime es **solo `jsonlog`** ("Loaded output engine: jsonlog"; "No operator config file found; using bundled defaults only"). Cowrie escribe a `var/log/cowrie/cowrie.json` (ruta del default, NO al bind-mount `cowrie/logs` → el mount es inútil igualmente).
2. **No existe el receptor** `/webhook/cowrie` en n8n (F3) — aunque cowrie emítiera HTTP, obtendría 404.

→ El criterio "fila nueva en `honeypot_events`" **NO se cumple aún**, y dependiendo del change `conectar-y-verificar` (que no crea workflows, no-goal) se registra como hallazgo, NO como implementación aquí. Probará el cierre del mismo cambio cuando `workflows-n8n` cree el receptor y se configure la salida HTTP de cowrie.

**6.3 Dionaea (✅ esperado: NO emitió).** Confirmado doble:
- Logs de dionaea en el bind-mount (`dionaea/logs/dionaea/dionaea.log`, `dionaea-errors.log`): **0 bytes**.
- Sockets del contenedor: **ningún servicio de dionaea escuchando** (solo el DNS interno `127.0.0.11`).
- **F7:** `dionaea/config/dionaea/ihandlers-enabled/` y `services-enabled/` están **VACÍOS** (gitignored por diseño, pero jamás poblados) → la config no habilita servicios ni handlers, dionaea es inert por config. A esto se suma `DIONAEA_OUTPUT_ENDPOINT` insoportada (letra muerta de la imagen oficial, según ya sabía el change).

---

## Paso 7 — Cierre

- **7.1** este archivo consolida pasos 0–6 con resultado y razón de cada desviación.
- **7.2** dependencia futura registrada: change **"puente Dionaea"** (sidecar que lea `dionaea.json`/log y reenvíe a n8n) — ver sección siguiente.
- **7.3** `git status` OK: el change `workflows-n8n` NO aparece modificado (ni proposal/design/specs/tasks); no quedan scripts sidecar/bridge en el repo (solo activos de UI de n8n dentro del volumen gitignored `n8n/data`). Únicas modificaciones: `docker-compose.yml` (1 línea), `tasks.md`, y los artefactos nuevos de evidencia de este change.

---

## Dependencia registrada: change "puente Dionaea"

Conocimiento técnico ya verificado (base del change futuro):
- La imagen oficial `dinotools/dionaea:latest` NO soporta `DIONAEA_OUTPUT_ENDPOINT` (letra muerta; solo vars DIONAEA_SKIP_INIT/FORCE_INIT/_). No hay forma declarativa de que dionaea postee a n8n.
- En este despliegue dionaea además NO escucha servicios: `services-enabled/` y `ihandlers-enabled/` vacíos → 0 listeners, 0 logs. El puente futuro dependerá PRIMERO de habilitar servicios de dionaea.
- Config escrita para que dionaea escriba local: `logging.default.filename=var/log/dionaea/dionaea.log` (bind-mount a `dionaea/logs/`), y `ihandler log_json` disponible en `ihandlers-available/` (salida tipo `dionaea.json`) para que el sidecar la lea y reenvíe a `http://n8n:5678/webhook/dionaea`.
- El sidecar debe vivir en `red_dmz`/`red_interna` (dionaea alcanza n8n por nombre: verificado HTTP 200 en paso 3.2).

**NO se implementa nada de esto en este change (no-goal).**

---

## Resumen de hallazgos (F1–F10)

- F1: grafana sin healthcheck → muestra `Up`, no `healthy`.
- F2: imágenes honeypot sin `curl`/`sh` → prueba de red con `python3 - urllib` (equivalente).
- F3: BD de n8n con **0 workflows** → `/webhook/*` devuelve 404; `workflows-n8n` debe crearlos.
- F4: `GET /rest/workflows` con Basic Auth del `.env` → 401; login de UI = paso humano pendiente (user `nachonave`).
- F5: `COWRIE_OUTPUT_ENDPOINT` = letra muerta (0 matches en fuente 3.0.12); engine solo `jsonlog`; log a ruta interna, bind-mount `cowrie/logs` sin efecto → cowrie NO postea a n8n.
- F6: dirs de bind de cowrie (`config`, `logs`) creados vacíos por Docker → operación con "bundled defaults only".
- F7: dionaea con `services-enabled/` y `ihandlers-enabled/` vacíos → 0 listeners; inert.
- F8: imagen `dinotools/dionaea:latest` SÍ se bajó de Docker Hub (no hubo error de pull).
- F9: puerto 445 (SMB Win) y 3000 (grafana nativo) ocupados → desviación válida a 4445/3001.
- F10: resto de puertos libres y validados.

## Estado de la cadena (conclusión diagnóstica)

```
.env ✅ → stack 6/6 ✅ → n8n healthz ✅ → red interna ✅ → webhooks (receptores ⛔ 404)
→ emisión cowrie ✅ (jsonlog) → persistencia PostgreSQL ⛔ (0 rows)
```
La cadena que este change debía verificar queda **bloqueada en el eslabón receptor + salida http de cowrie**, porque `workflows-n8n` aún no creó los workflows webhook y la salida HTTP de cowrie nunca estuvo activa. Es exactamente el output de DIAGNÓSTICO para el que fue diseñado el change; su cierre/knowledge queda como prerrequisito verificado para `workflows-n8n` y para el change "puente Dionaea".