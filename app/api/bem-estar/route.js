const SHEETS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS-cmQfBRf3_LpTHaqJmmolqENeue_-egKq6xpPvvW3bFWxqfZF9HbidZdWIqrKWT12-6Zf7BqQ4GSV/pub?gid=0&single=true&output=csv'

export async function GET() {
  try {
    const res = await fetch(SHEETS_URL, {
      next: { revalidate: 60 }, // cache por 60s
    })

    if (!res.ok) {
      return Response.json({ error: 'Erro ao buscar planilha' }, { status: 502 })
    }

    const text = await res.text()

    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    console.error('bem-estar API error:', err)
    return Response.json({ error: 'Erro interno' }, { status: 500 })
  }
}
