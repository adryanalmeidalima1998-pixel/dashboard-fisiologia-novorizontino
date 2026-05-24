import { sql } from '@vercel/postgres'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS injury_history (
      id            SERIAL PRIMARY KEY,
      athlete_name  VARCHAR(255) NOT NULL,
      injury_date   DATE NOT NULL,
      body_region   VARCHAR(10) NOT NULL,
      injury_type   VARCHAR(255) NOT NULL,
      description   TEXT,
      severity      VARCHAR(20),
      days_out      INTEGER,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_injury_athlete ON injury_history (athlete_name)`
  await sql`CREATE INDEX IF NOT EXISTS idx_injury_date    ON injury_history (injury_date DESC)`
}

// GET /api/injury-history?athlete_name=Rodrigo
export async function GET(request) {
  try {
    await ensureTable()
    const { searchParams } = new URL(request.url)
    const athleteName = searchParams.get('athlete_name')

    if (athleteName) {
      const { rows } = await sql`
        SELECT * FROM injury_history
        WHERE athlete_name = ${athleteName}
        ORDER BY injury_date DESC
      `
      return Response.json({ injuries: rows })
    }

    // Retorna todas
    const { rows } = await sql`SELECT * FROM injury_history ORDER BY injury_date DESC`
    return Response.json({ injuries: rows })
  } catch (err) {
    console.error('Injury GET error:', err)
    return Response.json({ error: 'Erro ao buscar histórico.' }, { status: 500 })
  }
}

// POST /api/injury-history
export async function POST(request) {
  try {
    await ensureTable()
    const body = await request.json()
    const { athlete_name, injury_date, body_region, injury_type, description, severity, days_out } = body

    if (!athlete_name || !injury_date || !body_region || !injury_type) {
      return Response.json({ error: 'Campos obrigatórios: athlete_name, injury_date, body_region, injury_type.' }, { status: 400 })
    }

    const { rows } = await sql`
      INSERT INTO injury_history (athlete_name, injury_date, body_region, injury_type, description, severity, days_out)
      VALUES (
        ${athlete_name},
        ${injury_date},
        ${body_region},
        ${injury_type},
        ${description || null},
        ${severity || null},
        ${days_out || null}
      )
      RETURNING *
    `
    return Response.json({ injury: rows[0] })
  } catch (err) {
    console.error('Injury POST error:', err)
    return Response.json({ error: 'Erro ao salvar lesão.' }, { status: 500 })
  }
}
