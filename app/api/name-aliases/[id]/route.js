import { sql } from '@vercel/postgres'

// DELETE /api/name-aliases/[id]
export async function DELETE(request, context) {
  try {
    const params = await context.params
    const id = Number(params?.id)
    if (isNaN(id) || id <= 0) return Response.json({ error: 'ID inválido.' }, { status: 400 })

    const { rowCount } = await sql`DELETE FROM name_aliases WHERE id = ${id}`
    if (rowCount === 0) return Response.json({ error: 'Alias não encontrado.' }, { status: 404 })

    return Response.json({ success: true })
  } catch (err) {
    console.error('name-aliases DELETE error:', err)
    return Response.json({ error: 'Erro ao remover alias.' }, { status: 500 })
  }
}
