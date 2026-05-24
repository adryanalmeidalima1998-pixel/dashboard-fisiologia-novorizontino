import { sql } from '@vercel/postgres'

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS athletes (
      id              SERIAL PRIMARY KEY,
      name            VARCHAR(255) NOT NULL UNIQUE,
      full_name       VARCHAR(255),
      birth_date      DATE,
      weight_kg       DECIMAL(5,2),
      height_cm       INTEGER,
      dominant_foot   VARCHAR(20),
      city            VARCHAR(255),
      position        VARCHAR(50),
      notes           TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_athletes_name ON athletes (name)`
}

// GET /api/athletes
export async function GET() {
  try {
    await ensureTable()
    const { rows } = await sql`SELECT * FROM athletes ORDER BY name ASC`
    return Response.json({ athletes: rows })
  } catch (err) {
    console.error('Athletes GET error:', err)
    return Response.json({ error: 'Erro ao buscar atletas.' }, { status: 500 })
  }
}

// POST /api/athletes
export async function POST(request) {
  try {
    await ensureTable()
    const body = await request.json()
    const { name, full_name, birth_date, weight_kg, height_cm, dominant_foot, city, position, notes } = body

    if (!name) return Response.json({ error: 'name é obrigatório.' }, { status: 400 })

    const { rows } = await sql`
      INSERT INTO athletes (name, full_name, birth_date, weight_kg, height_cm, dominant_foot, city, position, notes)
      VALUES (
        ${name},
        ${full_name || null},
        ${birth_date || null},
        ${weight_kg || null},
        ${height_cm || null},
        ${dominant_foot || null},
        ${city || null},
        ${position || null},
        ${notes || null}
      )
      ON CONFLICT (name) DO UPDATE SET
        full_name     = EXCLUDED.full_name,
        birth_date    = EXCLUDED.birth_date,
        weight_kg     = EXCLUDED.weight_kg,
        height_cm     = EXCLUDED.height_cm,
        dominant_foot = EXCLUDED.dominant_foot,
        city          = EXCLUDED.city,
        position      = EXCLUDED.position,
        notes         = EXCLUDED.notes,
        updated_at    = NOW()
      RETURNING *
    `
    return Response.json({ athlete: rows[0] })
  } catch (err) {
    console.error('Athletes POST error:', err)
    return Response.json({ error: 'Erro ao salvar atleta.' }, { status: 500 })
  }
}
