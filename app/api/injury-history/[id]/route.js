import { sql } from '@vercel/postgres'

// DELETE /api/injury-history/[id]
export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    const { rows } = await sql`DELETE FROM injury_history WHERE id = ${id} RETURNING id`
    if (rows.length === 0) return Response.json({ error: 'Lesão não encontrada.' }, { status: 404 })
    return Response.json({ deleted: rows[0].id })
  } catch (err) {
    console.error('Injury DELETE error:', err)
    return Response.json({ error: 'Erro ao deletar lesão.' }, { status: 500 })
  }
}
