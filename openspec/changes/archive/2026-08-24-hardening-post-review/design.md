# Design: hardening-post-review

## Context

Una revisión post-audit sobre el repositorio produjo 7 recomendaciones externas que fueron verificadas una a una contra el código. Veredictos:

| Ítem | Veredicto | Evidencia verificada |
|------|-----------|---------------------|
| #1 Quickstart sin `.env` | PARCIAL | Todo lo necesario ya está versionado (`docker-compose.yml`, `postgres/init.sql`, configs Cowrie/Dionaea, `.env.example`, `web/.env.example`). El gap real: README líneas 184-195 va de `git clone` directo a `docker compose up -d` |
| #2 Sin egress filtering | VÁLIDA | Cero scripts/docs de firewall en el repo; la tesis llama al egress filtering "salvaguarda ética más importante" |
| #3 Inyección SQL | REFUTADA | Los 3 workflows usan queries parametrizadas `$1..$14`; NO entra en este change |
| #4 Exposición 0.0.0.0 | VÁLIDA | Compose bindea n8n `"5678:5678"` (~línea 58) y Grafana `"${GRAFANA_PORT:-3000}:3000"` (~línea 138); cero referencias a DOCKER-USER/iptables |
| #5 Bug VT Lookup | VÁLIDA | Nodo "VirusTotal Lookup" consulta `/files/{{ $json["file_hash"] }}` pero "Extraer IOCs" solo define `extracted_urls` y `extracted_domains` → URL queda `/files/undefined` |
| #6 Sin resiliencia | VÁLIDA | 0 nodos con `retryOnFail`/`onError` en los 5 workflows JSON de `workflows/` |
| #7 Creds triviales | VÁLIDA | README líneas 204-208 con literales `POSTGRES_PASSWORD=password` y `N8N_BASIC_AUTH_PASSWORD=admin` |

Estado actual relevante: los puertos honeypot (21, 2222-2223, 8080, 4445, 1433) y nginx (80/443) DEBEN seguir públicos porque son el experimento de tesis. Los workflows n8n están versionados como JSON en `workflows/` y sincronizados a la instancia viva vía `PUT http://localhost:5678/api/v1/workflows/{id}` con header `X-N8N-API-KEY`, payload `{name,nodes,connections,settings}`, preservando IDs.

## Goals / Non-Goals

**Goals:**

- Cerrar las brechas de seguridad HIGH: egress filtering (#2) y exposición de administración (#4).
- Corregir el bug funcional del VirusTotal Lookup en PB-H2 (#5, Opción A aprobada por el usuario).
- Dar resiliencia de ejecución a los playbooks (#6) para sostener la hipótesis de automatización confiable de la tesis.
- Hacer el quickstart reproducible y sin credenciales triviales (#1 + #7).

**Non-Goals:**

- No modificar la API FastAPI, la consola React, el esquema Postgres ni el provisioning de Grafana.
- No cambiar los puertos públicos del experimento (honeypots y nginx siguen expuestos).
- No renombrar workflows ni cambiar sus IDs.
- No implementar la variante B del lookup VT (queda documentada como mejora futura).
- No aplicar cambios SQL (ítem #3 refutado).

## Decisions

### D1 — Egress filtering con UFW deny-by-default y allowlist explícita (#2)

Se crea `firewall/setup-ufw.sh` (bash idempotente) que aplica:

- `ufw default deny outgoing` (la salvaguarda ética central de la tesis).
- Allowlist saliente mínima: DNS 53/tcp+udp y HTTPS 443/tcp (APIs VirusTotal y GLPI).
- Entrante: SSH permitido ANTES de `ufw enable` (evitar autolockout del investigador), y los puertos del experimento abiertos explícitamente (21, 2222-2223, 8080, 4445, 1433, 80, 443).
- Se acompaña de `docs/firewall.md` explicando cada regla y su justificación ética/metodológica para la defensa ante el tribunal.

**Alternativas descartadas:** iptables puro (sintaxis frágil y difícil de explicar en defensa), firewalld (no estándar en Ubuntu Server), no hacer nada (contradice la tesis).

**Nota Docker:** UFW no filtra tráfico publicado por `-p` de Docker (usa DNAT, saltándose INPUT). Por eso D2 complementa este control.

### D2 — Bind a loopback en compose + snippet DOCKER-USER documentado (#4)

- En `docker-compose.yml`: n8n → `"127.0.0.1:5678:5678"` y Grafana → `"${GRAFANA_PORT:-3000}:3000"` → `"127.0.0.1:${GRAFANA_PORT:-3000}:3000"`.
- El snippet `DOCKER-USER` de iptables (defensa en profundidad que filtra el tráfico DNATeado) se DOCUMENTA en `docs/firewall.md` como paso opcional/manual para la VM de demostración; no se automatiza en el script para no acoplar dos capas distintas ni arriesgar el entorno del tribunal.
- Acceso remoto a n8n/Grafana tras el cambio: vía túnel SSH o mediante nginx público existente (`/grafana/`). Se documenta.

**Alternativa descartada:** dejar 0.0.0.0 y depender solo de DOCKER-USER — el bind a loopback es el control primario simple y verificable; DOCKER-USER es segunda capa.

### D3 — VirusTotal Lookup por dominio (Opción A) (#5)

En `workflows/b-h2-ejecucion-comandos-v1.0.json`, el nodo "VirusTotal Lookup" pasa de consultar archivos a consultar reputación de dominios: `GET https://www.virustotal.com/api/v3/domains/{{ $json["domain"] }}`, iterando sobre `extracted_domains` producidos por el nodo "Extraer IOCs". La API key sigue tomándose del header `x-apikey` con expresión n8n.

**Variante B (mejora futura, NO implementada):** mover la consulta VT al playbook PB-DIONAEA usando `malware_hash` real del artefacto capturado contra `GET /api/v3/files/{hash}` — Dionaea sí entrega hashes; así el endpoint original tendría dato real.

**Riesgo conocido:** cuota gratuita de VT (~4 req/min). Mitigación: la iteración procesa dominios extraídos de UNA sesión maliciosa (volumen bajo) y el nodo lleva retry con espera (ver D4).

### D4 — Resiliencia: retryOnFail en HTTP + onError en Postgres (#6)

Sobre los JSON versionados de `workflows/`:

- Nodos HTTP ("VirusTotal Lookup" en PB-H2, nodos HTTP de `webhook-glpi-ticket.json` y `webhook-firewall-block.json`): `retryOnFail: true`, `maxTries: 3`, `retryWaitTime: 5000` (ms).
- Nodos Postgres críticos (persistencia de eventos/bloqueos/tickets): `onError: "continueRegularOutput"` para que un fallo puntual de BD no detenga la cadena de respuesta automática (el error queda registrado en la ejecución de n8n y visible en la consola SOC).

**Alternativa descartada:** `errorWorkflow` global — añade otro workflow que mantener y no aporta trazabilidad superior para esta escala; se deja como evolución posible.

### D5 — Sincronización al n8n vivo preservando IDs

Los workflows modificados (PB-H2=`nFnt9n3Gk8Gh27mg`, glpi=`soc-glpi-ticket-01`, firewall=`soc-firewall-block-01`) se re-sincronizan con `PUT http://localhost:5678/api/v1/workflows/{id}` + header `X-N8N-API-KEY` (variable `N8N_API_KEY` del `.env`), payload `{name,nodes,connections,settings}`. Siempre se edita primero el JSON versionado y luego se sincroniza (el repo es fuente de verdad).

### D6 — README: quickstart completo y placeholders no triviales (#1+#7)

- Insertar entre `git clone` y `docker compose up -d`: `cp .env.example .env` + nota breve de las variables obligatorias.
- Reemplazar literales triviales del bloque de ejemplo por placeholders tipo `cambia-esta-clave-segura`.

### Evaluada y descartada (trazabilidad)

Ítem #3 (inyección SQL): refutada por verificación directa — los tres workflows usan queries parametrizadas `$1..$14`. No genera tareas.

## Risks / Trade-offs

- [UFW puede bloquear al propio investigador] → el script permite SSH y muestra `ufw status verbose` al final; `docs/firewall.md` incluye instrucción de rollback (`ufw disable`).
- [Bind loopback rompe demos desde otra máquina] → acceso vía nginx (`/grafana/`) o túnel SSH; documentado en `docs/firewall.md`.
- [Cuota VT 4 req/min] → volumen bajo por sesión + retry con espera de 5 s.
- [`continueRegularOutput` puede silenciar fallos de BD] → el fallo queda en el historial de ejecuciones de n8n (visible en la consola SOC) y el resto de la cadena continúa, que es exactamente el comportamiento que la hipótesis requiere.
- [Re-sync PUT pisa ajustes manuales hechos en la instancia viva] → convención ya establecida: el JSON versionado es fuente de verdad; se sincroniza después de editar.

## Migration Plan

1. README (#1+#7) — sin riesgo operativo.
2. Firewall (#2) — aplicar en la VM; verificar egress con prueba DNS/HTTPS y rollback documentado.
3. Compose (#4) — `docker compose up -d` recrea contenedores; verificar `docker ps` (binds 127.0.0.1) y que honeypots/nginx siguen públicos.
4. Workflows (#5+#6) — editar JSON versionados, validar sintaxis JSON, sincronizar por API PUT.
5. Validación final — tests API (`powershell -ExecutionPolicy Bypass -File api\run-tests.ps1`, 162/162), tests web (`cd web && pnpm test && pnpm lint && pnpm build`), workflows activos en n8n y verificación manual del documento de egress.

**Rollback:** cada fase es independiente y reversible por git (`checkout` del archivo afectado) + recrear contenedores o `ufw disable` según la fase.

## Open Questions

Ninguna bloqueante. La variante B del lookup VT (PB-DIONAEA con `malware_hash`) queda registrada aquí como mejora futura, fuera del alcance actual.
