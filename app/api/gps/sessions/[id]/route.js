import { sql } from '@vercel/postgres'

// DELETE /api/gps/sessions/[id]
export async function DELETE(request, context) {
  try {
    const params = await context.params
    const rawId = params?.id
    const id = rawId !== undefined && rawId !== null ? Number(rawId) : NaN

    if (!rawId || isNaN(id) || id <= 0) {
      console.error('GPS delete: ID inválido recebido:', rawId)
      return Response.json({ error: `ID inválido: "${rawId}"` }, { status: 400 })
    }

    const { rowCount } = await sql`DELETE FROM gps_sessions WHERE id = ${id}`

    if (rowCount === 0) {
      return Response.json({ error: 'Sessão não encontrada.' }, { status: 404 })
    }

    return Response.json({ success: true, message: 'Sessão removida.' })
  } catch (err) {
    console.error('GPS delete error:', err)
    return Response.json({ error: 'Erro ao remover sessão.' }, { status: 500 })
  }
}

// PATCH /api/gps/sessions/[id]
// body: { metadata: { result, mando, opponent, competition, ... } }
// Faz merge: preserva campos existentes, sobrescreve só o que vier no body
export async function PATCH(request, context) {
  try {
    const params = await context.params
    const rawId = params?.id
    const id = rawId !== undefined && rawId !== null ? Number(rawId) : NaN

    if (!rawId || isNaN(id) || id <= 0) {
      return Response.json({ error: `ID inválido: "${rawId}"` }, { status: 400 })
    }

    const body = await request.json()
    const { metadata: patch } = body

    if (!patch || typeof patch !== 'object') {
      return Response.json({ error: 'Body inválido. Envie { metadata: { ... } }' }, { status: 400 })
    }

    // Busca metadata atual
    const { rows } = await sql`SELECT metadata FROM gps_sessions WHERE id = ${id}`
    if (!rows.length) {
      return Response.json({ error: 'Sessão não encontrada.' }, { status: 404 })
    }

    const current = rows[0].metadata || {}
    const merged = { ...current, ...patch }

    await sql`
      UPDATE gps_sessions
      SET metadata = ${JSON.stringify(merged)}
      WHERE id = ${id}
    `

    return Response.json({ success: true, metadata: merged })
  } catch (err) {
    console.error('GPS PATCH error:', err)
    return Response.json({ error: 'Erro ao atualizar sessão.' }, { status: 500 })
  }
}
