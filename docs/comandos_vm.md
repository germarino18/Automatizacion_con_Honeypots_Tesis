Comandos de Implementación – Honeypot SOC
🔹 Conexión a la VM
ssh usuario@ip-de-tu-vm
🔹 Actualización del sistema
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git wget net-tools htop unzip
lsb_release -a
🔹 Instalación de Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

docker --version
docker compose version
🔹 Estructura del proyecto
mkdir -p ~/honeypot-soc/{n8n,cowrie,dionaea,postgres,grafana,nginx,backups,scripts}
cd ~/honeypot-soc
nano .env
🔹 Inicialización de servicios
docker compose up -d
docker compose ps
docker compose logs -f
🔹 Verificaciones de red
docker exec soc-n8n ping -c 3 postgres
docker exec soc-cowrie curl -v http://n8n:5678/webhook/cowrie
sudo netstat -tlnp | grep -E '2222|445|80|443'
🔹 Firewall (UFW)
sudo ufw enable

sudo ufw allow 22/tcp
sudo ufw allow 2222/tcp
sudo ufw allow 2223/tcp
sudo ufw allow 445/tcp
sudo ufw allow 21/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

sudo ufw deny 5678/tcp
sudo ufw deny 3000/tcp
sudo ufw deny 5432/tcp

sudo ufw logging on
sudo ufw status verbose
🔹 Certificados SSL
mkdir -p nginx/certs

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/privkey.pem \
  -out nginx/certs/fullchain.pem \
  -subj "/C=CR/ST=Alajuela/L=Alajuela/O=Universidad Técnica Nacional/CN=localhost"
🔹 PostgreSQL – consultas
docker exec -it soc-postgres psql -U n8n_user -d honeydb

SELECT COUNT(*) FROM honeypot_events;
SELECT att_ck_technique, COUNT(*) FROM honeypot_events GROUP BY att_ck_technique;
SELECT AVG(risk_score) FROM honeypot_events;

COPY honeypot_events TO '/tmp/events.csv' WITH CSV HEADER;
🔹 Test de Webhook
curl -X POST http://localhost:5678/webhook/test -d '{"test": "ok"}'
