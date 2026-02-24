import { sql } from '@vercel/postgres'

// DELETE /api/gps/sessions/[id]
// IMPORTANTE: No Next.js 15+, `params` é uma Promise e deve ser await-ado
export async function DELETE(request, context) {
  try {
    const params = await context.params
    const rawId = params?.id

    const id = rawId !== undefined && rawId !== null ? Number(rawId) : NaN

    if (!rawId || isNaN(id) || id <= 0) {
      console.error('GPS delete: ID inválido recebido:', rawId)
      return Response.json({ error: `ID inválido: "${rawId}"` }, { status: 400 })
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
