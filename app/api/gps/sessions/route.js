import { sql } from '@vercel/postgres'

// GET /api/gps/sessions — retorna todas as sessões salvas
export async function GET() {
  try {
    const { rows } = await sql`
      SELECT id, session_date, session_name, filename, uploaded_at, rows, metadata
      FROM gps_sessions
      ORDER BY session_date DESC, session_name ASC
    `

    const sessions = rows.map(r => ({
      id: r.id,
      date: r.session_date,
      name: r.session_name,
      filename: r.filename,
      uploadedAt: r.uploaded_at,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata || {}),
      rows: typeof r.rows === 'string' ? JSON.parse(r.rows) : r.rows,
    }))

    return Response.json({ sessions })

  } catch (err) {
    console.error('GPS sessions fetch error:', err)
    return Response.json({ error: 'Erro ao buscar sessões.' }, { status: 500 })
  }
}
