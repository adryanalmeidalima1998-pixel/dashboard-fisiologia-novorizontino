import { sql } from '@vercel/postgres'

// Normaliza nome (mesma lógica do DataContext)
function normalizeName(name) {
  if (!name) return ''
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// GET /api/squad-exclusions
export async function GET() {
  try {
    const { rows } = await sql`
      SELECT id, player_name, normalized_name, excluded_at
      FROM squad_exclusions
      ORDER BY player_name ASC
    `
    return Response.json({ exclusions: rows })
  } catch (err) {
    console.error('squad-exclusions GET error:', err)
    return Response.json({ error: 'Erro ao buscar exclusões.' }, { status: 500 })
  }
}

// POST /api/squad-exclusions
export async function POST(request) {
  try {
    const { player_name } = await request.json()
    if (!player_name?.trim()) {
      return Response.json({ error: 'player_name obrigatório.' }, { status: 400 })
    }

    const norm = normalizeName(player_name.trim())

    const { rows } = await sql`
      INSERT INTO squad_exclusions (player_name, normalized_name)
      VALUES (${player_name.trim()}, ${norm})
      ON CONFLICT (normalized_name) DO UPDATE
        SET player_name = EXCLUDED.player_name,
            excluded_at = NOW()
      RETURNING id, player_name, normalized_name, excluded_at
    `
    return Response.json({ exclusion: rows[0] }, { status: 201 })
  } catch (err) {
    console.error('squad-exclusions POST error:', err)
    return Response.json({ error: 'Erro ao excluir atleta.' }, { status: 500 })
  }
}
