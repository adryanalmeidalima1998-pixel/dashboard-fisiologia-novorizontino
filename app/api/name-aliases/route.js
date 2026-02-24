import { sql } from '@vercel/postgres'

// GET /api/name-aliases — retorna todos os aliases salvos
export async function GET() {
  try {
    // Cria a tabela se não existir (idempotente)
    await sql`
      CREATE TABLE IF NOT EXISTS name_aliases (
        id          SERIAL PRIMARY KEY,
        gps_name    VARCHAR(255) NOT NULL UNIQUE,
        bem_name    VARCHAR(255) NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `
    const { rows } = await sql`SELECT id, gps_name, bem_name FROM name_aliases ORDER BY gps_name`
    return Response.json({ aliases: rows })
  } catch (err) {
    console.error('name-aliases GET error:', err)
    return Response.json({ error: 'Erro ao buscar aliases.' }, { status: 500 })
  }
}

// POST /api/name-aliases — cria ou atualiza um alias
// Body: { gps_name: string, bem_name: string }
export async function POST(request) {
  try {
    const { gps_name, bem_name } = await request.json()
    if (!gps_name?.trim() || !bem_name?.trim()) {
      return Response.json({ error: 'gps_name e bem_name são obrigatórios.' }, { status: 400 })
    }
    await sql`
      CREATE TABLE IF NOT EXISTS name_aliases (
        id          SERIAL PRIMARY KEY,
        gps_name    VARCHAR(255) NOT NULL UNIQUE,
        bem_name    VARCHAR(255) NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `
    const { rows } = await sql`
      INSERT INTO name_aliases (gps_name, bem_name)
      VALUES (${gps_name.trim()}, ${bem_name.trim()})
      ON CONFLICT (gps_name) DO UPDATE SET bem_name = EXCLUDED.bem_name
      RETURNING id, gps_name, bem_name
    `
    return Response.json({ alias: rows[0] })
  } catch (err) {
    console.error('name-aliases POST error:', err)
    return Response.json({ error: 'Erro ao salvar alias.' }, { status: 500 })
  }
}
