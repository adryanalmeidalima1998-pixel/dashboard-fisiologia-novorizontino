import { sql } from '@vercel/postgres'

// ─── PARSER (server-side) ─────────────────────────────────────────────────────
function parseGpsCSV(csvText) {
  const lines = csvText.split('\n')

  let sessionDate = null
  for (const line of lines.slice(0, 10)) {
    const m = line.match(/(\d{2}\/\d{2}\/\d{4})/)
    if (m) { sessionDate = m[1]; break }
  }
  if (!sessionDate) return { error: 'Data da sessão não encontrada no CSV.' }

  let headerIndex = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Player Name')) { headerIndex = i; break }
  }
  if (headerIndex === -1) return { error: 'Formato inválido. "Player Name" não encontrado.' }

  const headers = lines[headerIndex].split(',').map(h => h.replace(/"/g, '').trim())

  const rows = []
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = []
    let current = ''
    let inQuote = false
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue }
      if (ch === ',' && !inQuote) { values.push(current.trim()); current = ''; continue }
      current += ch
    }
    values.push(current.trim())
    if (values.length < headers.length) continue
    const row = {}
    headers.forEach((h, idx) => { row[h] = values[idx] || '' })
    rows.push(row)
  }

  if (rows.length === 0) return { error: 'Nenhuma linha de dados encontrada.' }

  const sessionDists = rows
    .filter(r => parseInt(r['Period Number']) === 0)
    .map(r => parseFloat(r['DISTÂNCIA TOTAL (m)']) || 0)
    .filter(d => d > 0)

  const mean = sessionDists.reduce((a, b) => a + b, 0) / (sessionDists.length || 1)
  const std = Math.sqrt(
    sessionDists.map(d => Math.pow(d - mean, 2)).reduce((a, b) => a + b, 0) / (sessionDists.length || 1)
  )
  const outlierThreshold = mean + 3 * std

  const parsed = rows
    .filter(r => r['Player Name']?.trim())
    .map(r => {
      const totalDist = parseFloat(r['DISTÂNCIA TOTAL (m)']) || 0
      const durationSec = parseFloat(r['DURAÇÃO TOTAL']) || 1
      const isOutlier = totalDist > outlierThreshold || totalDist > 15000
      return {
        sessionDate,
        playerName: r['Player Name'].trim(),
        period: r['Period Name']?.trim() || '',
        periodNumber: parseInt(r['Period Number']) || 0,
        totalDistance:    isOutlier ? null : totalDist,
        distanceRelative: isOutlier ? null : (parseFloat(r['DISTÂNCIA RELATIVA (m/min)']) || 0),
        hsr:              isOutlier ? null : (parseFloat(r['DISTÂNCIA EM ALTA >20KM']) || 0),
        sprintDistance:   isOutlier ? null : (parseFloat(r['DISTÂNCIA SPRINTS >25KM']) || 0),
        sprintCount:      isOutlier ? null : (parseInt(r['NÚMERO DE SPRINTS >25KM']) || 0),
        playerLoad:       isOutlier ? null : (parseFloat(r['TOTAL PL']) || 0),
        acceleration:     isOutlier ? null : (parseInt(r['ACELERAÇÃO']) || 0),
        deceleration:     isOutlier ? null : (parseInt(r['DECELERAÇÃO']) || 0),
        accelDecelAvg:    isOutlier ? null : (parseInt(r['Acel + Decel MÉDIA']) || 0),
        maxVelocity:      isOutlier ? null : (parseFloat(r['VELOCIDADE MÁXIMA km/h']) || 0),
        durationMin: durationSec / 60,
        isOutlier,
      }
    })

  return { sessionDate, rows: parsed }
}

// ─── POST /api/gps/upload ─────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const formData = await request.formData()
    const file        = formData.get('file')
    const sessionName = (formData.get('session_name') || '').trim()

    if (!file) {
      return Response.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
    }
    if (!file.name.endsWith('.csv')) {
      return Response.json({ error: 'Envie um arquivo .csv do Catapult.' }, { status: 400 })
    }

    const csvText = await file.text()
    const result  = parseGpsCSV(csvText)

    if (result.error) {
      return Response.json({ error: result.error }, { status: 422 })
    }

    const { sessionDate, rows } = result

    // Nome da sessão: campo enviado pelo usuário ou nome do arquivo sem extensão
    const name = sessionName || file.name.replace(/\.csv$/i, '')

    // Upsert — se (data + nome) já existe, atualiza
    await sql`
      INSERT INTO gps_sessions (session_date, session_name, filename, rows)
      VALUES (${sessionDate}, ${name}, ${file.name}, ${JSON.stringify(rows)})
      ON CONFLICT (session_date, session_name)
      DO UPDATE SET
        filename    = EXCLUDED.filename,
        rows        = EXCLUDED.rows,
        uploaded_at = NOW()
    `

    const playersCount  = [...new Set(rows.filter(r => r.periodNumber === 0 && !r.isOutlier).map(r => r.playerName))].length
    const outliersCount = rows.filter(r => r.isOutlier && r.periodNumber === 0).length

    return Response.json({
      success: true,
      sessionDate,
      sessionName: name,
      filename: file.name,
      playersCount,
      outliersCount,
      message: `"${name}" (${sessionDate}) salva com ${playersCount} atletas.${outliersCount > 0 ? ` ${outliersCount} outlier(s) ignorado(s).` : ''}`,
    })

  } catch (err) {
    console.error('GPS upload error:', err)
    return Response.json({ error: 'Erro interno ao processar o arquivo.' }, { status: 500 })
  }
}
