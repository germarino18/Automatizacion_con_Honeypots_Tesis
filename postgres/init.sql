-- ===========================================
-- ESQUEMA DE BASE DE DATOS PARA HONEYPOT SOC
-- Tesis: Orquestación de Honeypots con n8n
-- ===========================================

-- Tabla principal: eventos de honeypots
CREATE TABLE IF NOT EXISTS honeypot_events (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    source_honeypot VARCHAR(50) NOT NULL,        -- 'cowrie' o 'dionaea'
    src_ip INET NOT NULL,                         -- IP del atacante
    dst_port INTEGER,                             -- Puerto destino
    protocol VARCHAR(20),                         -- Protocolo (SSH, Telnet, SMB, FTP, HTTP)
    username VARCHAR(100),                        -- Usuario usado (si aplica)
    commands TEXT,                                -- Comandos ejecutados (Cowrie)
    malware_hash VARCHAR(64),                     -- Hash SHA256 de malware (Dionaea)
    malware_filename VARCHAR(255),                -- Nombre del archivo capturado
    playbook_id VARCHAR(50),                      -- ID del playbook ejecutado
    risk_score DECIMAL(3,2) DEFAULT 0.00,         -- Score de riesgo (0.00 - 1.00)
    att_ck_technique VARCHAR(20),                 -- Técnica MITRE ATT&CK
    enrichment_data JSONB,                        -- Datos enriquecidos (VirusTotal, AbuseIPDB, etc.)
    raw_data JSONB,                               -- Datos crudos del webhook
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de respuestas automáticas
CREATE TABLE IF NOT EXISTS responses (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES honeypot_events(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    action_type VARCHAR(50) NOT NULL,             -- Tipo: alerta, bloqueo, playbook, etc.
    actor VARCHAR(100),                           -- Qué ejecutó la acción (n8n, manual)
    status VARCHAR(20) DEFAULT 'pending',          -- pending, completed, failed
    evidence_uri TEXT,                            -- URI de evidencia (log, captura)
    details JSONB,                                -- Detalles adicionales
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de indicadores de compromiso (IoCs)
CREATE TABLE IF NOT EXISTS iocs (
    id SERIAL PRIMARY KEY,
    ioc_type VARCHAR(20) NOT NULL,                -- ip, domain, url, hash, email
    ioc_value TEXT NOT NULL,                      -- El valor del IoC
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP WITH TIME ZONE,
    source VARCHAR(50),                           -- honeypot, osint, manual
    severity VARCHAR(20) DEFAULT 'medium',        -- low, medium, high, critical
    tags TEXT[],                                  -- Etiquetas para categorizar
    notes TEXT,
    UNIQUE(ioc_type, ioc_value)
);

-- Tabla de sesiones de ataque (para reconstrucción forense)
CREATE TABLE IF NOT EXISTS attack_sessions (
    id SERIAL PRIMARY KEY,
    src_ip INET NOT NULL,
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP WITH TIME ZONE,
    total_events INTEGER DEFAULT 0,
    techniques_detected TEXT[],                    -- Técnicas MITRE ATT&CK observadas
    risk_score DECIMAL(3,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,               -- ¿Sesión aún activa?
    metadata JSONB
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_events_src_ip ON honeypot_events(src_ip);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON honeypot_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_honeypot ON honeypot_events(source_honeypot);
CREATE INDEX IF NOT EXISTS idx_events_technique ON honeypot_events(att_ck_technique);
CREATE INDEX IF NOT EXISTS idx_events_risk_score ON honeypot_events(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_responses_event_id ON responses(event_id);
CREATE INDEX IF NOT EXISTS idx_iocs_type_value ON iocs(ioc_type, ioc_value);
CREATE INDEX IF NOT EXISTS idx_sessions_ip ON attack_sessions(src_ip);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON attack_sessions(is_active);

-- Vista para métricas diarias
CREATE OR REPLACE VIEW metrics_summary AS
SELECT
    DATE(timestamp) as fecha,
    COUNT(*) as total_eventos,
    COUNT(DISTINCT src_ip) as ips_unicas,
    COUNT(DISTINCT att_ck_technique) as tecnicas_detectadas,
    AVG(risk_score) as riesgo_promedio,
    MAX(risk_score) as riesgo_maximo
FROM honeypot_events
GROUP BY DATE(timestamp)
ORDER BY fecha DESC;

-- Vista para top atacantes
CREATE OR REPLACE VIEW top_attackers AS
SELECT
    src_ip,
    COUNT(*) as total_ataques,
    COUNT(DISTINCT att_ck_technique) as tecnicas_usadas,
    MAX(risk_score) as max_riesgo,
    AVG(risk_score) as riesgo_promedio,
    MIN(timestamp) as primer_ataque,
    MAX(timestamp) as ultimo_ataque
FROM honeypot_events
GROUP BY src_ip
ORDER BY total_ataques DESC;
