-- ============================================================
-- SCHEMA: Central de Fisiologia — Grêmio Novorizontino
-- Rodar UMA VEZ no painel do Vercel Postgres (Query Editor)
-- ============================================================

CREATE TABLE IF NOT EXISTS gps_sessions (
  id            SERIAL PRIMARY KEY,
  session_date  VARCHAR(20)  NOT NULL,      -- "13/02/2026" (formato Catapult)
  session_name  VARCHAR(255) NOT NULL,      -- "Treino Manhã", "Jogo Tarde" etc.
  filename      VARCHAR(255),               -- nome do arquivo original
  uploaded_at   TIMESTAMPTZ DEFAULT NOW(),
  rows          JSONB NOT NULL              -- array de atletas parseados
);

-- Índice para consultas por data
CREATE INDEX IF NOT EXISTS idx_gps_sessions_date
  ON gps_sessions (session_date);

-- Unicidade por data + nome (permite múltiplas sessões no mesmo dia)
CREATE UNIQUE INDEX IF NOT EXISTS idx_gps_sessions_date_name
  ON gps_sessions (session_date, session_name);

-- ============================================================
-- MIGRAÇÃO (só se já tinha a tabela antiga — schema anterior)
-- DROP INDEX IF EXISTS idx_gps_sessions_date_unique;
-- ALTER TABLE gps_sessions ADD COLUMN IF NOT EXISTS session_name VARCHAR(255);
-- UPDATE gps_sessions SET session_name = filename WHERE session_name IS NULL;
-- ALTER TABLE gps_sessions ALTER COLUMN session_name SET NOT NULL;
-- CREATE UNIQUE INDEX idx_gps_sessions_date_name ON gps_sessions (session_date, session_name);
-- ============================================================
