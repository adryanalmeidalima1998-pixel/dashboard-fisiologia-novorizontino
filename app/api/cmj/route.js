import { sql } from '@vercel/postgres'

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS cmj_baseline (
      id             SERIAL PRIMARY KEY,
      athlete_name   VARCHAR(255) NOT NULL UNIQUE,
      melhor_salto   FLOAT NOT NULL,
      data_avaliacao DATE,
      updated_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS cmj_coletas (
      id           SERIAL PRIMARY KEY,
      athlete_name VARCHAR(255) NOT NULL,
      data_coleta  DATE NOT NULL,
      salto_1      FLOAT,
      salto_2      FLOAT,
      salto_3      FLOAT,
      media        FLOAT NOT NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_cmj_athlete ON cmj_coletas (athlete_name)`
  await sql`CREATE INDEX IF NOT EXISTS idx_cmj_date    ON cmj_coletas (data_coleta DESC)`
}

// GET /api/cmj
export async function GET() {
  try {
    await ensureTables()
    const { rows: baselines } = await sql`SELECT * FROM cmj_baseline ORDER BY athlete_name ASC`
    const { rows: coletas }   = await sql`SELECT * FROM cmj_coletas   ORDER BY data_coleta DESC, created_at DESC`
    return Response.json({ baselines, coletas })
  } catch (err) {
    console.error('CMJ GET error:', err)
    return Response.json({ error: 'Erro ao buscar dados CMJ.' }, { status: 500 })
  }
}

// POST /api/cmj
// body { type: 'baseline', athlete_name, melhor_salto, data_avaliacao? }
// body { type: 'coleta',   athlete_name, data_coleta, salto_1?, salto_2?, salto_3?, media }
export async function POST(request) {
  try {
    await ensureTables()
    const body = await request.json()

    if (body.type === 'baseline') {
      const { athlete_name, melhor_salto, data_avaliacao } = body
      if (!athlete_name || !melhor_salto)
        return Response.json({ error: 'athlete_name e melhor_salto são obrigatórios.' }, { status: 400 })

      const { rows } = await sql`
        INSERT INTO cmj_baseline (athlete_name, melhor_salto, data_avaliacao, updated_at)
        VALUES (${athlete_name}, ${melhor_salto}, ${data_avaliacao || null}, NOW())
        ON CONFLICT (athlete_name) DO UPDATE
          SET melhor_salto   = EXCLUDED.melhor_salto,
              data_avaliacao = EXCLUDED.data_avaliacao,
              updated_at     = NOW()
        RETURNING *
      `
      return Response.json({ baseline: rows[0] })
    }

    if (body.type === 'coleta') {
      const { athlete_name, data_coleta, salto_1, salto_2, salto_3, media } = body
      if (!athlete_name || !data_coleta || media === undefined)
        return Response.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })

      const { rows } = await sql`
        INSERT INTO cmj_coletas (athlete_name, data_coleta, salto_1, salto_2, salto_3, media)
        VALUES (${athlete_name}, ${data_coleta}, ${salto_1 ?? null}, ${salto_2 ?? null}, ${salto_3 ?? null}, ${media})
        RETURNING *
      `
      return Response.json({ coleta: rows[0] })
    }

    return Response.json({ error: 'type inválido. Use "baseline" ou "coleta".' }, { status: 400 })
  } catch (err) {
    console.error('CMJ POST error:', err)
    return Response.json({ error: 'Erro ao salvar.' }, { status: 500 })
  }
}
