import { sql } from '@vercel/postgres'

// PUT /api/athletes/[id]
export async function PUT(request, { params }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, full_name, birth_date, weight_kg, height_cm, dominant_foot, city, position, notes } = body

    if (!name) return Response.json({ error: 'name é obrigatório.' }, { status: 400 })

    const { rows } = await sql`
      UPDATE athletes SET
        name          = ${name},
        full_name     = ${full_name || null},
        birth_date    = ${birth_date || null},
        weight_kg     = ${weight_kg || null},
        height_cm     = ${height_cm || null},
        dominant_foot = ${dominant_foot || null},
        city          = ${city || null},
        position      = ${position || null},
        notes         = ${notes || null},
        updated_at    = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    if (rows.length === 0) return Response.json({ error: 'Atleta não encontrado.' }, { status: 404 })
    return Response.json({ athlete: rows[0] })
  } catch (err) {
    console.error('Athletes PUT error:', err)
    return Response.json({ error: 'Erro ao atualizar atleta.' }, { status: 500 })
  }
}

// DELETE /api/athletes/[id]
export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    // Deleta lesões associadas primeiro
    await sql`DELETE FROM injury_history WHERE athlete_name = (SELECT name FROM athletes WHERE id = ${id})`
    const { rows } = await sql`DELETE FROM athletes WHERE id = ${id} RETURNING name`
    if (rows.length === 0) return Response.json({ error: 'Atleta não encontrado.' }, { status: 404 })
    return Response.json({ deleted: rows[0].name })
  } catch (err) {
    console.error('Athletes DELETE error:', err)
    return Response.json({ error: 'Erro ao deletar atleta.' }, { status: 500 })
  }
}
