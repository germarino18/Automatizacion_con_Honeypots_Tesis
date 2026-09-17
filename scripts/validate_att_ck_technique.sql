-- =====================================================================
-- validate_att_ck_technique.sql
-- Validación de integridad: att_ck_technique recalculada vs persistida
-- ---------------------------------------------------------------------
-- Objetivo : Reproducir la lógica del pipeline (PB-H1 + PB-H2 + dionaea)
--            a partir del payload ORIGINAL y compararla contra la técnica
--            persistida en honeypot_events.
--
-- Lógica del pipeline (corregida):
--   1. dionaea                -> T1190  (web exploitation)
--   2. cowrie con comando     -> T1059  (PB-H2 sobrescribe si commands != '')
--   3. cowrie sin comando     -> T1595  (PB-H1, FIJO: el bug T1046 se eliminó)
--
-- GOTCHA CRÍTICO — dos shapes distintos de raw_data:
--   * Banco histórico (ids 2-101): raw_data ANIDADO
--       -> el payload original está en  raw_data->'raw_data'->>'input'
--   * Pipeline vivo  (ids 191+):   raw_data PLANO
--       -> el payload original está en  raw_data->>'input'
--   Se usa COALESCE con ambas rutas para cubrir los dos casos.
--
--   La columna `commands` NO se usa como fuente de verdad (sería circular:
--   es una SALIDA del pipeline). Se incluye solo como cross-check de
--   integridad de la extracción.
--
-- Uso: docker exec -i soc-postgres psql -U <user> -d <db> -f validate_att_ck_technique.sql
-- =====================================================================

\echo '=== RESUMEN: recalculada vs persistida (todo el banco) ==='

WITH base AS (
  SELECT
    id,
    source_honeypot,
    att_ck_technique,
    COALESCE(commands, '') AS col_commands,
    COALESCE(
      NULLIF(TRIM(COALESCE(raw_data->'raw_data'->>'input', raw_data->>'input', '')), ''),
      NULLIF(TRIM(COALESCE(raw_data->'raw_data'->>'command', raw_data->>'command', '')), ''),
      ''
    ) AS payload_cmd
  FROM honeypot_events
  WHERE id BETWEEN 2 AND 101
),
calc AS (
  SELECT
    id,
    source_honeypot,
    att_ck_technique AS persisted,
    col_commands,
    payload_cmd,
    CASE
      WHEN source_honeypot = 'dionaea' THEN 'T1190'
      WHEN payload_cmd <> ''           THEN 'T1059'
      ELSE 'T1595'
    END AS recalculated
  FROM base
)
SELECT
  count(*)                                              AS total,
  count(*) FILTER (WHERE persisted = recalculated)       AS coinciden,
  count(*) FILTER (WHERE persisted <> recalculated)      AS difieren
FROM calc;

\echo ''
\echo '=== DETALLE DE DISCREPANCIAS (vacio = integridad correcta) ==='

WITH base AS (
  SELECT
    id,
    source_honeypot,
    att_ck_technique,
    COALESCE(commands, '') AS col_commands,
    COALESCE(
      NULLIF(TRIM(COALESCE(raw_data->'raw_data'->>'input', raw_data->>'input', '')), ''),
      NULLIF(TRIM(COALESCE(raw_data->'raw_data'->>'command', raw_data->>'command', '')), ''),
      ''
    ) AS payload_cmd
  FROM honeypot_events
  WHERE id BETWEEN 2 AND 101
)
SELECT
  id,
  source_honeypot,
  att_ck_technique AS persisted,
  CASE
    WHEN source_honeypot = 'dionaea' THEN 'T1190'
    WHEN payload_cmd <> ''           THEN 'T1059'
    ELSE 'T1595'
  END AS recalculated,
  payload_cmd
FROM base
WHERE att_ck_technique <> CASE
    WHEN source_honeypot = 'dionaea' THEN 'T1190'
    WHEN payload_cmd <> ''           THEN 'T1059'
    ELSE 'T1595'
  END
ORDER BY id;

\echo ''
\echo '=== CROSS-CHECK: extraccion (columna commands) vs payload original ==='

WITH base AS (
  SELECT
    id,
    COALESCE(commands, '') AS col_commands,
    COALESCE(
      NULLIF(TRIM(COALESCE(raw_data->'raw_data'->>'input', raw_data->>'input', '')), ''),
      NULLIF(TRIM(COALESCE(raw_data->'raw_data'->>'command', raw_data->>'command', '')), ''),
      ''
    ) AS payload_cmd
  FROM honeypot_events
  WHERE id BETWEEN 2 AND 101
)
SELECT
  count(*) FILTER (WHERE (col_commands = '') <> (payload_cmd = '')) AS extraccion_inconsistente,
  count(*)                                                          AS total
FROM base;

\echo ''
\echo '=== DISTRIBUCION POR TECNICA (persistida) ==='

SELECT att_ck_technique, source_honeypot, count(*)
FROM honeypot_events
WHERE id BETWEEN 2 AND 101
GROUP BY 1, 2
ORDER BY 3 DESC;
