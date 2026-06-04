FASE 1: Inicialización de Docker
Paso 1.1: Actualizar Sistema e Instalar Dependencias
# Conéctate a tu VM por SSH
ssh usuario@ip-de-tu-vm

# Actualizar paquetes del sistema
sudo apt update && sudo apt upgrade -y

# Instalar herramientas básicas
sudo apt install -y curl git wget net-tools htop unzip

# Verificar versión de Ubuntu
lsb_release -a
Paso 1.2: Instalar Docker Engine
# Descargar script oficial de instalación
curl -fsSL https://get.docker.com -o get-docker.sh

# Ejecutar el script
sudo sh get-docker.sh

# Agregar tu usuario al grupo docker (evita usar sudo constantemente)
sudo usermod -aG docker $USER

# Aplicar cambios de grupo sin cerrar sesión
newgrp docker

# Verificar instalación
docker --version
docker compose version
Paso 1.3: Crear Estructura de Directorios del Proyecto
# Crear carpeta principal del proyecto
mkdir -p ~/honeypot-soc/{n8n,cowrie,dionaea,postgres,grafana,nginx,backups,scripts}

# Navegar al directorio
cd ~/honeypot-soc

# Crear archivo .env para variables sensibles
nano .env
Paso 1.4: Configurar Variables de Entorno (.env)
Copia y pega esto en tu archivo .env (CAMBIA LAS CONTRASEÑAS):
# ===========================================
# VARIABLES DE ENTORNO - HONEYPOT SOC
# ===========================================

# PostgreSQL
POSTGRES_USER=n8n_user
POSTGRES_PASSWORD=TuContrasenaSegura123!
POSTGRES_DB=honeydb

# n8n
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=TuContrasenaN8n456!
N8N_ENCRYPTION_KEY=tu-clave-de-encripcion-segura-aqui-minimo-32-caracteres
WEBHOOK_URL=https://tu-ip-publica-o-dominio.com/

# Cowrie
COWRIE_SSH_PORT=2222
COWRIE_TELNET_PORT=2223

# Dionaea
DIONAEA_SMB_PORT=445
DIONAEA_FTP_PORT=21
DIONAEA_HTTP_PORT=8080

# Grafana
GRAFANA_ADMIN_USER=grafana_admin
GRAFANA_ADMIN_PASSWORD=TuContrasenaGrafana789!

# Nginx
NGINX_EMAIL=tu-email@universidad.edu

# APIs OSINT (obtén tus propias keys gratuitas)
VIRUSTOTAL_API_KEY=tu-api-key-virustotal
ABUSEIPDB_API_KEY=tu-api-key-abuseipdb
SHODAN_API_KEY=tu-api-key-shodan

# Red
NETWORK_DMZ_SUBNET=172.20.0.0/24
NETWORK_INTERNAL_SUBNET=172.21.0.0/24
FASE 2: Archivo Docker Compose
Paso 2.1: Crear docker-compose.yml
nano docker-compose.yml
version: '3.8'

services:
  # ===========================================
  # BASE DE DATOS (PostgreSQL)
  # ===========================================
  postgres:
    image: postgres:15-alpine
    container_name: soc-postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - ./postgres/data:/var/lib/postgresql/data
      - ./postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - red_interna
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ===========================================
  # ORQUESTADOR (n8n)
  # ===========================================
  n8n:
    image: n8n/n8n:latest
    container_name: soc-n8n
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_BASIC_AUTH_USER}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_BASIC_AUTH_PASSWORD}
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
      - WEBHOOK_URL=${WEBHOOK_URL}
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_USER=${POSTGRES_USER}
      - DB_POSTGRESDB_PASSWORD=${POSTGRES_PASSWORD}
      - DB_POSTGRESDB_DATABASE=${POSTGRES_DB}
      - N8N_USER_FOLDER=/home/node/.n8n
    volumes:
      - ./n8n/data:/home/node/.n8n
    ports:
      - "5678:5678"
    networks:
      - red_interna
      - red_dmz
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://localhost:5678/healthz || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ===========================================
  # HONEYPOT SSH (Cowrie)
  # ===========================================
  cowrie:
    image: cowrie/cowrie:latest
    container_name: soc-cowrie
    environment:
      - COWRIE_SSH_PORT=${COWRIE_SSH_PORT}
      - COWRIE_OUTPUT_ENDPOINT=http://n8n:5678/webhook/cowrie
    volumes:
      - ./cowrie/config:/cowrie/cowrie-git/etc
      - ./cowrie/logs:/cowrie/cowrie-git/log
      - ./cowrie/downloads:/cowrie/cowrie-git/dl
    ports:
      - "${COWRIE_SSH_PORT}:2222"
      - "${COWRIE_TELNET_PORT}:2223"
    networks:
      - red_dmz
      - red_interna
    restart: unless-stopped
    depends_on:
      - n8n

  # ===========================================
  # HONEYPOT MALWARE (Dionaea)
  # ===========================================
  dionaea:
    image: dinotools/dionaea:latest
    container_name: soc-dionaea
    environment:
      - DIONAEA_OUTPUT_ENDPOINT=http://n8n:5678/webhook/dionaea
    volumes:
      - ./dionaea/config:/opt/dionaea/etc
      - ./dionaea/logs:/opt/dionaea/var/log
      - ./dionaea/binaries:/opt/dionaea/var/dionaea/binaries
    ports:
      - "${DIONAEA_SMB_PORT}:445"
      - "${DIONAEA_FTP_PORT}:21"
      - "${DIONAEA_HTTP_PORT}:80"
    networks:
      - red_dmz
      - red_interna
    restart: unless-stopped
    depends_on:
      - n8n

  # ===========================================
  # VISUALIZACIÓN (Grafana)
  # ===========================================
  grafana:
    image: grafana/grafana:latest
    container_name: soc-grafana
    environment:
      - GF_SECURITY_ADMIN_USER=${GRAFANA_ADMIN_USER}
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
      - GF_INSTALL_PLUGINS=grafana-piechart-panel
    volumes:
      - ./grafana//var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    ports:
      - "3000:3000"
    networks:
      - red_interna
    depends_on:
      - postgres
    restart: unless-stopped

  # ===========================================
  # PROXY REVERSO (Nginx)
  # ===========================================
  nginx:
    image: nginx:alpine
    container_name: soc-nginx
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/certs:/etc/nginx/certs
    ports:
      - "80:80"
      - "443:443"
    networks:
      - red_interna
    depends_on:
      - n8n
    restart: unless-stopped


# ===========================================
# REDES
# ===========================================
networks:
  red_dmz:
    name: honeypot_dmz
    driver: bridge
    ipam:
      config:
        - subnet: ${NETWORK_DMZ_SUBNET}
  
  red_interna:
    name: honeypot_internal
    driver: bridge
    internal: true
    ipam:
      config:
        - subnet: ${NETWORK_INTERNAL_SUBNET}

# ===========================================
# VOLÚMENES
# ===========================================
volumes:
  postgres_
  n8n_
  grafana_
FASE 3: Base de Datos PostgreSQL
Paso 3.1: Crear Script de Inicialización
nano postgres/init.sql
-- ===========================================
-- ESQUEMA DE BASE DE DATOS PARA HONEYPOT SOC
-- Tesis: Orquestación de Honeypots con n8n
-- ===========================================

-- Tabla de eventos de honeypots
CREATE TABLE IF NOT EXISTS honeypot_events (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    source_honeypot VARCHAR(50) NOT NULL,
    src_ip INET NOT NULL,
    dst_port INTEGER,
    commands TEXT,
    playbook_id VARCHAR(50),
    risk_score DECIMAL(3,2),
    att_ck_technique VARCHAR(20),
    enrichment_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de respuestas
CREATE TABLE IF NOT EXISTS responses (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES honeypot_events(id),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    action_type VARCHAR(50) NOT NULL,
    actor VARCHAR(100),
    status VARCHAR(20),
    evidence_uri TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_events_src_ip ON honeypot_events(src_ip);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON honeypot_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_technique ON honeypot_events(att_ck_technique);
CREATE INDEX IF NOT EXISTS idx_responses_event_id ON responses(event_id);

-- Vista para métricas MTTD/MTTR
CREATE OR REPLACE VIEW metrics_summary AS
SELECT 
    DATE(timestamp) as fecha,
    COUNT(*) as total_eventos,
    AVG(risk_score) as riesgo_promedio
FROM honeypot_events
GROUP BY DATE(timestamp);



FASE 4: Configuración de Red y Seguridad
Paso 4.1: Configurar Firewall UFW
# Habilitar UFW
sudo ufw enable

# Permitir SSH (puerto 22)
sudo ufw allow 22/tcp

# Permitir puertos de honeypots (EXPUESTOS A INTERNET)
sudo ufw allow 2222/tcp  # Cowrie SSH
sudo ufw allow 2223/tcp  # Cowrie Telnet
sudo ufw allow 445/tcp   # Dionaea SMB
sudo ufw allow 21/tcp    # Dionaea FTP
sudo ufw allow 80/tcp    # HTTP para Nginx
sudo ufw allow 443/tcp   # HTTPS para Nginx

# DENEGAR acceso directo a servicios internos
sudo ufw deny 5678/tcp   # n8n (solo accesible vía Nginx)
sudo ufw deny 3000/tcp   # Grafana (solo red interna)
sudo ufw deny 5432/tcp   # PostgreSQL (solo red interna)

# Habilitar logging
sudo ufw logging on

# Verificar estado
sudo ufw status verbose
Paso 4.2: Configurar Nginx (Proxy Reverso)
nano nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream n8n {
        server n8n:5678;
    }

    upstream grafana {
        server grafana:3000;
    }

    # Redirección HTTP → HTTPS
    server {
        listen 80;
        server_name _;
        return 301 https://$server_name$request_uri;
    }

    # n8n con HTTPS
    server {
        listen 443 ssl;
        server_name _;

        ssl_certificate /etc/nginx/certs/fullchain.pem;
        ssl_certificate_key /etc/nginx/certs/privkey.pem;

        location / {
            proxy_pass http://n8n;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /webhook/ {
            proxy_pass http://n8n;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_buffering off;
        }
    }
}
Paso 4.3: Generar Certificados SSL (Autofirmados para Pruebas)
# Crear directorio para certificados
mkdir -p nginx/certs

# Generar certificado autofirmado (para pruebas académicas)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/privkey.pem \
  -out nginx/certs/fullchain.pem \
  -subj "/C=CR/ST=Alajuela/L=Alajuela/O=Universidad Técnica Nacional/CN=localhost"
FASE 5: Despliegue y Verificación
Paso 5.1: Iniciar los Servicios
# Navegar al directorio del proyecto
cd ~/honeypot-soc

# Iniciar todos los servicios en modo detach
docker compose up -d

# Verificar estado de los contenedores
docker compose ps

# Ver logs en tiempo real
docker compose logs -f
Paso 5.2: Verificar Conectividad
# Verificar que PostgreSQL esté accesible desde n8n
docker exec soc-n8n ping -c 3 postgres

# Verificar que los honeypots puedan enviar webhooks a n8n
docker exec soc-cowrie curl -v http://n8n:5678/webhook/cowrie

# Verificar puertos expuestos
sudo netstat -tlnp | grep -E '2222|445|80|443'
