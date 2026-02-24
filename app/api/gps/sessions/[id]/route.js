import { sql } from '@vercel/postgres'

// DELETE /api/gps/sessions/[id]
export async function DELETE(request, { params }) {
  try {
    const id = parseInt(params.id)
    if (isNaN(id)) {
      return Response.json({ error: 'ID inválido.' }, { status: 400 })
    }

    const { rowCount } = await sql`
      DELETE FROM gps_sessions WHERE id = ${id}
    `

    if (rowCount === 0) {
      return Response.json({ error: 'Sessão não encontrada.' }, { status: 404 })
    }

    return Response.json({ success: true, message: 'Sessão removida.' })

  } catch (err) {
    console.error('GPS delete error:', err)
    return Response.json({ error: 'Erro ao remover sessão.' }, { status: 500 })
  }
}
