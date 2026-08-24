# Firewall y control de egress (salvaguarda ética)

## Por qué existe este control

La tesis plantea honeypots que **reciben ataques reales**. El riesgo ético central del
experimento es el inverso al habitual: no es que un atacante entre, sino que **un atacante
que compromete un servicio vulnerable use la VM como plataforma para atacar hacia afuera**
(pivot a otras máquinas, participación en botnets, spam, escaneo de terceros).

Por eso la salvaguarda más importante, según el propio marco metodológico de la tesis, es
el **egress filtering**: la política por defecto es *denegar todo tráfico saliente* y solo
permitir una lista explícita (allowlist) de lo que el stack necesita para funcionar.
Si un honeypot es comprometido, el agresor queda encerrado en una caja sin salida.

`firewall/setup-ufw.sh` aplica esa política con UFW en la VM anfitriona. El script es
**idempotente**: puede ejecutarse varias veces sin duplicar reglas ni cambiar el resultado.

## Reglas que aplica el script

| # | Regla | Dirección | Justificación |
|---|-------|-----------|---------------|
| 1 | `default deny outgoing` | salida host | Salvaguarda ética central: nada sale salvo allowlist |
| 2 | `default deny incoming` | entrada host | Postura por defecto; lo necesario se abre explícito |
| 3 | `limit 22/tcp` (SSH) | entrada | Se habilita ANTES de `ufw enable` para evitar autolockout del investigador; `limit` añade rate-limit anti fuerza bruta |
| 4 | `allow out 53/tcp+udp` (DNS) | salida | Sin resolución DNS ninguna API externa funciona (VirusTotal, GLPI, WHOIS…) |
| 5 | `allow out 443/tcp` (HTTPS) | salida | APIs de enriquecimiento y ticketing: VirusTotal, GLPI, WHOIS, AbuseIPDB, Shodan, Slack |
| 6 | `allow 21/tcp` | entrada | Dionaea FTP — superficie del experimento, debe seguir pública |
| 7 | `allow 2222:2223/tcp` | entrada | Cowrie SSH/Telnet — superficie del experimento |
| 8 | `allow 8080/tcp` | entrada | Dionaea HTTP — superficie del experimento |
| 9 | `allow 4445/tcp` | entrada | Dionaea SMB (mapeado 4445→445) — superficie del experimento |
| 10 | `allow 1433/tcp` | entrada | Dionaea MSSQL — superficie del experimento |
| 11 | `allow 80,443/tcp` | entrada | nginx con la consola SOC — acceso legítimo público |

Los puertos del experimento (6–11) se dejan abiertos **a propósito**: capturar ataques en
ellos ES el objetivo de la tesis. El firewall protege todo lo demás.

### Efectos colaterales esperados (documentados, no accidentes)

- **apt sobre HTTP** (`http://archive.ubuntu.com`, puerto 80): queda bloqueado. Para
  actualizar el host, abrir temporalmente `sudo ufw allow out 80/tcp comment 'apt http'`,
  actualizar, y borrar la regla (`sudo ufw delete allow out 80/tcp`). O usar mirrors HTTPS.
- **NTP** (123/udp): bloqueado; si la VM pierde sincronía de reloj, añadir
  `sudo ufw allow out 123/udp comment 'NTP'` como excepción documentada.
- **Contenedores Docker**: su tráfico sale por FORWARD (no por OUTPUT), así que la política
  de UFW no les afecta; n8n sigue pudiendo llamar a VirusTotal/GLPI desde dentro de la red
  interna. La capa que gobierna ese flujo se describe abajo.

## Nota Docker: UFW no filtra lo publicado con `-p`

UFW gestiona INPUT/OUTPUT, pero Docker publica puertos con DNAT en la cadena **FORWARD**
de iptables, saltándose esas cadenas. Consecuencia práctica conocida: una regla UFW no
bloquea un puerto publicado por Docker aunque parezca cubierto.

El control primario del proyecto contra esto es el **bind a loopback** en
`docker-compose.yml`: n8n publica `127.0.0.1:5678:5678` y Grafana
`127.0.0.1:${GRAFANA_PORT:-3000}:3000`, de modo que solo son alcanzables desde la propia
VM (localmente o vía túnel SSH). Eso ya resuelve la exposición de administración.

### Defensa en profundidad opcional: cadena DOCKER-USER

Como segunda capa (opcional y manual, para no acoplar dos mecanismos distintos ni arriesgar
la demo ante el tribunal), Docker expone la cadena `DOCKER-USER` justo antes de sus reglas,
y sí filtra el tráfico DNATeado. Blindar los puertos de administración aunque alguien cambie
mañana un bind a `0.0.0.0`:

```bash
# Interfaz externa de la VM (ajustar si no es la ruta por defecto)
IFACE_EXT=$(ip route get 1.1.1.1 | awk '{print $5; exit}')

# 1) Permitir el retorno de conexiones ya establecidas
sudo iptables -I DOCKER-USER -i "$IFACE_EXT" -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# 2) Bloquear conexiones NUEVAS desde fuera hacia los puertos de administración
#    (se usan los puertos CONTENEDOR: n8n=5678, grafana=3000)
sudo iptables -I DOCKER-USER 2 -i "$IFACE_EXT" -p tcp -m multiport --dports 5678,3000 -j DROP
```

Persistencia entre reinicios (opcional):

```bash
sudo apt install iptables-persistent
sudo netfilter-persistent save
```

Notas:

- El acceso local por loopback y el túnel SSH siguen funcionando: ese tráfico no pasa por
  FORWARD, luego no le afecta `DOCKER-USER`.
- Si se borran las reglas: `iptables -L DOCKER-USER --line-numbers` para localizarlas y
  `iptables -D DOCKER-USER <n>` para eliminarlas.

## Acceso legítimo tras restringir n8n/Grafana a loopback

Con los binds `127.0.0.1` el investigador conserva tres caminos:

1. **Desde la propia VM**: `http://localhost:5678` y `http://localhost:${GRAFANA_PORT:-3000}`.
2. **Túnel SSH desde el equipo del investigador**:
   ```bash
   ssh -L 5678:localhost:5678 -L 3001:localhost:3001 usuario@vm-honeypots
   ```
   y luego abrir las mismas URLs locales en el navegador.
3. **Proxy nginx existente**: Grafana sigue publicado bajo `/grafana/` en el nginx de la
   consola SOC (puertos 80/443 públicos).

## Verificación post-aplicación (en la VM)

```bash
sudo bash firewall/setup-ufw.sh          # aplicar
sudo ufw status verbose                   # debe mostrar "deny (outgoing)" como política

# Allowlist OK: estas dos deben funcionar
dig +short example.com                    # DNS OK
curl -sI https://www.virustotal.com | head -n 1   # HTTPS OK

# Egress denegado: un puerto arbitrario NO permitido debe fallar (timeout)
timeout 5 bash -c 'cat < /dev/null > /dev/tcp/93.184.216.34/25' || echo "BLOQUEADO (esperado)"

# Los puertos del experimento siguen accesibles desde fuera (escanear desde otra máquina)
nc -zv <IP_DE_LA_VM> 2222                 # Cowrie OK
```

## Rollback

```bash
sudo ufw disable      # desactiva el firewall por completo y restaura el estado previo
sudo ufw status       # confirmar: Status: inactive
```

Cada fase del hardening es independiente y reversible por git (`git checkout` del archivo
afectado) más `docker compose up -d` o `ufw disable` según corresponda.
