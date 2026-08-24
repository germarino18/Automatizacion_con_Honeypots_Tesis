# Tasks: hardening-post-review

## 1. README: quickstart y credenciales (#1 + #7) [LOW]

- [x] 1.1 Insertar en README.md el paso `cp .env.example .env` entre `git clone` y `docker compose up -d` (sección quickstart, líneas ~184-195), con nota breve de las variables obligatorias
- [x] 1.2 Reemplazar literales triviales del bloque de Variables de Entorno (~líneas 204-208): `POSTGRES_PASSWORD=password` y `N8N_BASIC_AUTH_PASSWORD=admin` por placeholders tipo `cambia-esta-clave-segura`

## 2. Firewall egress: script y documentación (#2) [HIGH]

- [x] 2.1 Crear `firewall/setup-ufw.sh` idempotente: `ufw default deny outgoing`, allowlist saliente DNS 53/tcp+udp y HTTPS 443/tcp, SSH entrante permitido ANTES de `ufw enable`, puertos del experimento entrantes (21, 2222-2223, 8080, 4445, 1433, 80, 443), y `ufw status verbose` al final
- [x] 2.2 Crear `docs/firewall.md` explicando cada regla con su justificación ética/metodológica para la defensa de tesis
- [x] 2.3 Documentar en `docs/firewall.md` el snippet `DOCKER-USER` de iptables como defensa en profundidad opcional para la VM (complementa que UFW no filtra tráfico DNATeado por Docker)

## 3. Exposición de administración en compose (#4) [HIGH]

- [x] 3.1 En `docker-compose.yml`, cambiar bind de n8n `"5678:5678"` → `"127.0.0.1:5678:5678"` (~línea 58)
- [x] 3.2 En `docker-compose.yml`, cambiar bind de Grafana `"${GRAFANA_PORT:-3000}:3000"` → `"127.0.0.1:${GRAFANA_PORT:-3000}:3000"` (~línea 138)
- [x] 3.3 Verificar que los puertos honeypot (21, 2222-2223, 8080, 4445, 1433) y nginx (80/443) permanecen públicos sin cambios

## 4. PB-H2: fix VirusTotal Lookup → dominios (Opción A) (#5)

- [x] 4.1 Editar `workflows/b-h2-ejecucion-comandos-v1.0.json`: nodo "VirusTotal Lookup" pasa a `GET https://www.virustotal.com/api/v3/domains/{{ $json["domain"] }}` iterando sobre `extracted_domains` del nodo "Extraer IOCs" (header `x-apikey` se mantiene)
- [x] 4.2 Validar sintaxis JSON del archivo modificado y confirmar que ninguna URL construida puede contener `undefined`

## 5. Resiliencia de workflows y re-sincronización al n8n vivo (#6)

- [x] 5.1 Agregar `retryOnFail: true`, `maxTries: 3`, `retryWaitTime: 5000` a los nodos HTTP de `workflows/b-h2-ejecucion-comandos-v1.0.json` ("VirusTotal Lookup"), `workflows/webhook-glpi-ticket.json` y `workflows/webhook-firewall-block.json`
- [x] 5.2 Agregar `onError: "continueRegularOutput"` a los nodos Postgres críticos (persistencia de eventos, bloqueos y tickets)
- [x] 5.3 Validar sintaxis JSON de los tres archivos modificados
- [x] 5.4 Re-sincronizar al n8n vivo vía `PUT http://localhost:5678/api/v1/workflows/{id}` con header `X-N8N-API-KEY` (`$env:N8N_API_KEY` del `.env`), payload `{name,nodes,connections,settings}`, preservando IDs: PB-H2=`nFnt9n3Gk8Gh27mg`, glpi=`soc-glpi-ticket-01`, firewall=`soc-firewall-block-01`
- [x] 5.5 Confirmar en la UI de n8n que los tres workflows quedaron activos y sin nodos en error de configuración

## 6. Validación final

- [x] 6.1 Ejecutar tests API: `powershell -ExecutionPolicy Bypass -File api\run-tests.ps1` (esperado 162/162)
- [x] 6.2 Ejecutar tests web: `cd web && pnpm test` (127), `pnpm lint` y `pnpm build`
- [x] 6.3 Verificación manual de compose: recrear stack (`docker compose up -d`) y comprobar binds `127.0.0.1` para n8n/Grafana y acceso legítimo desde la VM o túnel SSH
- [ ] 6.4 Verificación manual de firewall: aplicar `firewall/setup-ufw.sh` en VM de prueba, comprobar DNS/HTTPS salientes OK, puerto arbitrario saliente bloqueado y rollback documentado (`ufw disable`)
- [x] 6.5 Ejecutar una sesión de ataque de prueba end-to-end y verificar que PB-H2 consulta VT por dominio sin URLs `undefined` y que la cadena de respuesta automática sigue operativa
