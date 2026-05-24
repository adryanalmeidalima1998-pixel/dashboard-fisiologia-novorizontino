'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useCallback } from 'react'
import { useData, calcVmaxPct } from '../../context/DataContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'

// ─── ESTATÍSTICAS ─────────────────────────────────────────────────────────────

function rankArray(arr) {
  const n = arr.length
  const indexed = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
  const ranks = new Array(n)
  let j = 0
  while (j < n) {
    let k = j
    while (k < n - 1 && indexed[k + 1].v === indexed[k].v) k++
    const avg = (j + k) / 2 + 1
    for (let m = j; m <= k; m++) ranks[indexed[m].i] = avg
    j = k + 1
  }
  return ranks
}

function pearsonRanks(rx, ry) {
  const n = rx.length
  const mx = rx.reduce((a, b) => a + b, 0) / n
  const my = ry.reduce((a, b) => a + b, 0) / n
  let num = 0, dx2 = 0, dy2 = 0
  for (let i = 0; i < n; i++) {
    const dx = rx[i] - mx, dy = ry[i] - my
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy
  }
  return dx2 === 0 || dy2 === 0 ? 0 : num / Math.sqrt(dx2 * dy2)
}

function spearman(x, y) { return pearsonRanks(rankArray(x), rankArray(y)) }

function kendallTauB(x, y) {
  const n = x.length
  let C = 0, D = 0, tX = 0, tY = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = Math.sign(x[i] - x[j]), dy = Math.sign(y[i] - y[j])
      if (dx === 0 && dy === 0) continue
      if (dx === 0) { tX++; continue }
      if (dy === 0) { tY++; continue }
      if (dx === dy) C++; else D++
    }
  }
  const denom = Math.sqrt((C + D + tX) * (C + D + tY))
  return denom === 0 ? 0 : (C - D) / denom
}

function forceLabel(v) {
  const a = Math.abs(v)
  if (a >= 0.5) return 'Forte'
  if (a >= 0.3) return 'Moderada'
  if (a >= 0.15) return 'Fraca'
  return 'Muito Fraca'
}

function fmtCorr(v) {
  if (v == null || isNaN(v)) return '—'
  return (v >= 0 ? '+' : '') + v.toFixed(2)
}

function pct(a, b) {
  if (!a || !b) return null
  return ((a - b) / b) * 100
}

// ─── HIPÓTESES POR MÉTRICA ────────────────────────────────────────────────────

const HYPOTHESES = {
  dist: {
    pos: 'Maior distância total tende a aparecer nas vitórias. Pode indicar equipe com mais posse e controle territorial.',
    neg: 'Menor distância nas vitórias pode indicar equipe compacta que explora espaços em transição.',
    neu: 'Distância total pouco conclusiva isoladamente. Analise junto com ritmo (M/min) e contexto do jogo.',
  },
  mmin: {
    pos: 'Maior ritmo (M/min) associado a melhores resultados. Indica equipe fisicamente presente e verticalmente ativa.',
    neg: 'Ritmo mais alto em derrotas pode indicar jogo sem bola, pressão sofrida e recomposição constante.',
    neu: 'Ritmo de jogo não diferencia claramente os resultados na amostra atual.',
  },
  hsr: {
    pos: 'Mais alta velocidade nos jogos de vitória. Equipe usa deslocamentos intensos para criar e explorar espaços.',
    neg: 'Alta velocidade mais presente em derrotas. Pode indicar corridas de recuperação e exposição defensiva.',
    neu: 'HSR não apresenta padrão claro entre os resultados na amostra atual.',
  },
  sprint: {
    pos: 'Mais sprints nas vitórias. Indica equipe explosiva e capaz de atacar o espaço nos momentos decisivos.',
    neg: 'Mais sprints nas derrotas pode indicar necessidade de perseguir adversários ou cobrir espaços deixados.',
    neu: 'Volume de sprints não diferencia claramente vitória e derrota na amostra atual.',
  },
  pl: {
    pos: 'Maior carga nas vitórias. Pode indicar domínio físico e capacidade de sustentar intensidade alta.',
    neg: 'Carga mais alta nas derrotas pode indicar desgaste excessivo, jogo mais longo sem bola ou sobreposição física.',
    neu: 'Carga total não apresenta associação clara com o resultado.',
  },
  accDec: {
    pos: 'Mais acelerações e desacelerações nos melhores resultados. Indica equipe mais ativa para pressionar, reagir à perda e disputar segunda bola.',
    neg: 'Volume de ACC+DEC maior em derrotas pode indicar jogo mais reativo, com mais ajustes defensivos e menos fluidez.',
    neu: 'ACC+DEC não apresenta padrão claro entre os resultados na amostra atual.',
  },
  vmax90: {
    pos: 'Mais atletas chegando perto da velocidade máxima nas vitórias. Pode indicar transições ofensivas e ataque ao espaço.',
    neg: 'Picos de velocidade máxima mais presentes em derrotas. Pode indicar exposição defensiva, recomposições longas ou jogo mais aberto.',
    neu: '≥90% Vmax não diferencia claramente os resultados na amostra atual.',
  },
}

function getHypothesis(key, k) {
  const h = HYPOTHESES[key]
  if (!h) return ''
  if (Math.abs(k) < 0.08) return h.neu
  return k > 0 ? h.pos : h.neg
}

// ─── CONFIGURAÇÕES ────────────────────────────────────────────────────────────

const METRICS = [
  { key: 'dist',   label: 'Distância média',  unit: 'm',     dec: 0 },
  { key: 'mmin',   label: 'M/min médio',       unit: 'm/min', dec: 1 },
  { key: 'hsr',    label: 'HSR médio',          unit: 'm',     dec: 0 },
  { key: 'sprint', label: 'Sprint médio',       unit: 'm',     dec: 0 },
  { key: 'pl',     label: 'PL médio',           unit: '',      dec: 1 },
  { key: 'accDec', label: 'ACC+DEC médio',      unit: '',      dec: 0 },
  { key: 'vmax90', label: '≥90% Vmax',          unit: 'at.',   dec: 0 },
]

const RESULT_CFG = {
  V: { label: 'Vitória', pts: 3, text: 'text-green-600', bar: '#22c55e', border: 'border-green-200', bg: 'bg-green-50' },
  E: { label: 'Empate',  pts: 1, text: 'text-amber-600', bar: '#f59e0b', border: 'border-amber-200', bg: 'bg-amber-50' },
  D: { label: 'Derrota', pts: 0, text: 'text-red-600',   bar: '#ef4444', border: 'border-red-200',   bg: 'bg-red-50' },
}

const COMPETICOES = ['Série C', 'Copa do Brasil', 'Paulistão', 'Brasileiro SUB20 Série B', 'Paulistão SUB20 Série A', 'Copa Sul Sudeste', 'Amistoso', 'Outra']

// ─── COMPONENTES PEQUENOS ─────────────────────────────────────────────────────

function CorrBadge({ value }) {
  if (value == null || isNaN(value)) return <span className="text-slate-300 font-black text-sm">—</span>
  const a = Math.abs(value)
  const pos = value >= 0
  const bg = a >= 0.3
    ? (pos ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')
    : 'bg-slate-100 text-slate-600'
  return <span className={`inline-block font-black text-sm px-2 py-0.5 rounded ${bg}`}>{fmtCorr(value)}</span>
}

function DirBadge({ value }) {
  if (value == null || isNaN(value) || Math.abs(value) < 0.05)
    return <span className="text-xs text-slate-400 font-bold">Neutra</span>
  return value > 0
    ? <span className="text-xs font-black text-green-600">↑ Positiva</span>
    : <span className="text-xs font-black text-red-600">↓ Negativa</span>
}

function PctDiff({ v, inv = false }) {
  if (v == null) return <span className="text-slate-300 text-xs">—</span>
  const pos = inv ? v < 0 : v > 0
  const label = (v > 0 ? '+' : '') + v.toFixed(0) + '%'
  return <span className={`text-xs font-black ${pos ? 'text-green-600' : 'text-red-600'}`}>{label}</span>
}

// ─── MODAL DE EDIÇÃO DE CONTEXTO ─────────────────────────────────────────────

function EditContextModal({ game, onClose, onSave }) {
  const [form, setForm] = useState({
    result:      game.result || '',
    mando:       game.mando  || '',
    opponent:    game.opponent || '',
    competition: game.competition || '',
    score_pro:   game.score_pro   ?? '',
    score_con:   game.score_con   ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/gps/sessions/${game.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: {
            result:      form.result      || null,
            mando:       form.mando       || null,
            opponent:    form.opponent    || null,
            competition: form.competition || null,
            score_pro:   form.score_pro !== '' ? Number(form.score_pro) : null,
            score_con:   form.score_con !== '' ? Number(form.score_con) : null,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro ao salvar.'); return }
      onSave(game.id, data.metadata)
    } catch {
      setError('Erro de conexão.')
    } finally {
      setSaving(false)
    }
  }

  const inp = 'w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-amber-400'
  const lbl = 'text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1'

  const dateStr = game.date?.includes('/')
    ? game.date.split('/').reverse().join('-')
    : game.date

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-black uppercase tracking-tight">Editar Contexto do Jogo</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {dateStr ? new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR') : ''} · {game.opponent || 'Jogo sem adversário'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Resultado</label>
              <div className="flex gap-1">
                {[['V','✅'], ['E','🟡'], ['D','❌']].map(([val, ic]) => (
                  <button key={val} onClick={() => set('result', form.result === val ? '' : val)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${form.result === val ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                    {ic} {val}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={lbl}>Mando</label>
              <div className="flex gap-1">
                {[['M','🏠'], ['V','✈️']].map(([val, ic]) => (
                  <button key={val} onClick={() => set('mando', form.mando === val ? '' : val)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${form.mando === val ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                    {ic} {val === 'M' ? 'Casa' : 'Fora'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className={lbl}>Adversário</label>
            <input className={inp} value={form.opponent} onChange={e => set('opponent', e.target.value)} placeholder="Ex: Mirassol" />
          </div>

          <div>
            <label className={lbl}>Competição</label>
            <select className={inp} value={form.competition} onChange={e => set('competition', e.target.value)}>
              <option value="">Selecionar</option>
              {COMPETICOES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Gols Pró</label>
              <input type="number" min="0" className={inp} value={form.score_pro}
                onChange={e => set('score_pro', e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className={lbl}>Gols Contra</label>
              <input type="number" min="0" className={inp} value={form.score_con}
                onChange={e => set('score_con', e.target.value)} placeholder="0" />
            </div>
          </div>

          {error && <p className="text-red-600 text-xs font-bold">{error}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <button onClick={onClose} className="px-4 py-2 text-sm font-bold border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 text-sm font-black bg-amber-500 text-black rounded-lg hover:bg-amber-400 disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── PÁGINA ───────────────────────────────────────────────────────────────────

export default function CorrelacaoPage() {
  const router = useRouter()
  const { gpsData, vmaxBaseline, isExcluded, fetchGpsSessions } = useData()

  const [filterMando,  setFilterMando]  = useState('all')
  const [filterResult, setFilterResult] = useState('all')
  const [filterLast,   setFilterLast]   = useState(0)
  const [selectedMetric, setSelectedMetric] = useState('mmin')
  const [editGame,  setEditGame]  = useState(null)
  const [showCtxTable, setShowCtxTable] = useState(false)
  // cache local de metadata editada (para não precisar recarregar tudo)
  const [metaOverrides, setMetaOverrides] = useState({})

  // ── Extrair jogos ──────────────────────────────────────────────────────────
  const allGames = useMemo(() => {
    return gpsData
      .filter(s => s.metadata?.type === 'jogo' || s.metadata?.sessionType === 'jogo')
      .map(session => {
        const meta = { ...(session.metadata || {}), ...(metaOverrides[session.id] || {}) }
        const rows = session.rows
          .filter(r => r.periodNumber === 0 && !r.isOutlier && r.playerName && !isExcluded(r.playerName))
          .map(r => {
            const vm = vmaxBaseline[r.playerName]
            const vmaxPct = vm ? calcVmaxPct(r.maxVelocity, vm) : null
            return { ...r, vmaxPct, achieved90: vmaxPct != null && vmaxPct >= 90, accDecTotal: (r.acceleration || 0) + (r.deceleration || 0) }
          })
        if (!rows.length) return null
        const n = rows.length
        const sum = fn => rows.reduce((s, r) => s + (fn(r) || 0), 0)
        return {
          id:          session.id,
          date:        session.date,
          opponent:    meta.opponent    || '—',
          result:      meta.result      || null,
          mando:       meta.mando       || null,
          competition: meta.competition || null,
          score_pro:   meta.score_pro   ?? null,
          score_con:   meta.score_con   ?? null,
          pts: meta.result === 'V' ? 3 : meta.result === 'E' ? 1 : meta.result === 'D' ? 0 : null,
          dist:   sum(r => r.totalDistance) / n,
          mmin:   sum(r => r.distanceRelative) / n,
          hsr:    sum(r => r.hsr) / n,
          sprint: sum(r => r.sprintDistance) / n,
          pl:     sum(r => r.playerLoad) / n,
          accDec: sum(r => r.accDecTotal) / n,
          vmax90: rows.filter(r => r.achieved90).length,
          n,
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        const da = a.date?.includes('/') ? a.date.split('/').reverse().join('-') : (a.date || '')
        const db = b.date?.includes('/') ? b.date.split('/').reverse().join('-') : (b.date || '')
        return db.localeCompare(da)
      })
  }, [gpsData, vmaxBaseline, isExcluded, metaOverrides])

  const gamesWithResult = useMemo(() => allGames.filter(g => g.result && g.pts != null), [allGames])
  const hasMando = useMemo(() => allGames.some(g => g.mando), [allGames])
  const semMando = useMemo(() => allGames.filter(g => g.result && !g.mando).length, [allGames])

  function handleMetaSave(id, newMeta) {
    setMetaOverrides(prev => ({ ...prev, [id]: newMeta }))
    setEditGame(null)
    // recarrega do banco em background
    fetchGpsSessions()
  }

  // ── Filtros ────────────────────────────────────────────────────────────────
  const filteredGames = useMemo(() => {
    let g = [...gamesWithResult]
    if (filterMando  !== 'all') g = g.filter(x => x.mando === filterMando)
    if (filterResult !== 'all') g = g.filter(x => x.result === filterResult)
    if (filterLast > 0) g = g.slice(0, filterLast)
    return g
  }, [gamesWithResult, filterMando, filterResult, filterLast])

  // ── Correlações ────────────────────────────────────────────────────────────
  const correlations = useMemo(() => {
    if (filteredGames.length < 4) return []
    const pts = filteredGames.map(g => g.pts)
    return METRICS.map(m => {
      const xs = filteredGames.map(g => g[m.key])
      const k = kendallTauB(xs, pts)
      const s = spearman(xs, pts)
      return { ...m, k, s }
    }).sort((a, b) => Math.abs(b.k) - Math.abs(a.k))
  }, [filteredGames])

  // ── Médias por resultado ───────────────────────────────────────────────────
  const avgByResult = useMemo(() => {
    const g = { V: [], E: [], D: [] }
    gamesWithResult.forEach(x => { if (g[x.result]) g[x.result].push(x) })
    const avg = (games, key) => games.length ? games.reduce((s, x) => s + (x[key] || 0), 0) / games.length : null
    return { ...g, avg }
  }, [gamesWithResult])

  // ── Stats gerais ───────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const V = gamesWithResult.filter(g => g.result === 'V').length
    const E = gamesWithResult.filter(g => g.result === 'E').length
    const D = gamesWithResult.filter(g => g.result === 'D').length
    const pts = V * 3 + E
    const max = gamesWithResult.length * 3
    const aprov = max > 0 ? ((pts / max) * 100).toFixed(0) : '0'
    const sorted = [...correlations]
    const bestK  = sorted.find(c => c.k > 0)
    const worstK = [...sorted].reverse().find(c => c.k < 0)
    const confianca = gamesWithResult.length >= 20 ? 'Alta' : gamesWithResult.length >= 12 ? 'Moderada' : 'Baixa'
    return { total: allGames.length, withResult: gamesWithResult.length, V, E, D, aprov, bestK, worstK, confianca }
  }, [gamesWithResult, allGames, correlations])

  // ── Dados de gráficos ──────────────────────────────────────────────────────
  const barData = useMemo(() => {
    return ['V', 'E', 'D'].map(r => {
      const val = avgByResult.avg(avgByResult[r], selectedMetric)
      return { name: RESULT_CFG[r].label, value: val, result: r }
    }).filter(d => d.value != null)
  }, [selectedMetric, avgByResult])

  const rankingData = useMemo(() =>
    correlations.map(c => ({ name: c.label, value: parseFloat(c.k.toFixed(2)) }))
  , [correlations])

  const selMeta = METRICS.find(m => m.key === selectedMetric)

  // ── Resumo automático ──────────────────────────────────────────────────────
  const autoSummary = useMemo(() => {
    if (correlations.length === 0) return null
    const top = correlations.filter(c => Math.abs(c.k) >= 0.15)
    if (!top.length) return 'Na amostra atual, nenhuma métrica física apresentou associação relevante com o resultado. Isso é esperado em amostras pequenas — continue registrando jogos para identificar padrões.'
    const pos = top.filter(c => c.k > 0).map(c => c.label.toLowerCase())
    const neg = top.filter(c => c.k < 0).map(c => c.label.toLowerCase())
    let txt = 'Na amostra atual'
    if (pos.length) txt += `, ${pos.join(' e ')} aparecem mais associadas aos melhores resultados`
    if (neg.length) txt += `${pos.length ? ', enquanto' : ','} ${neg.join(' e ')} aparecem mais nos jogos de pior resultado`
    txt += '. A força das associações ainda é '
    const maxK = Math.max(...top.map(c => Math.abs(c.k)))
    txt += maxK >= 0.5 ? 'forte' : maxK >= 0.3 ? 'moderada' : 'fraca'
    txt += ` — os dados devem ser lidos como tendência${stats.confianca === 'Baixa' ? ' inicial' : ''}, não como conclusão definitiva.`
    return txt
  }, [correlations, stats.confianca])

  const dateLabel = g => {
    const d = g.date?.includes('/') ? g.date.split('/').reverse().join('-') : g.date
    return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : g.date
  }

  return (
    <div className="min-h-screen bg-white text-black p-4 font-sans">
      <div className="max-w-[1400px] mx-auto flex flex-col gap-5">

        {/* HEADER */}
        <header className="flex flex-wrap justify-between items-center border-b-4 border-amber-500 pb-3 gap-3">
          <div className="flex items-center gap-4">
            <img src="/club/escudonovorizontino.png" alt="Escudo" className="h-14 w-auto" />
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-black uppercase leading-none">GPS × Resultado</h1>
              <p className="text-sm font-bold tracking-widest text-slate-600 uppercase">Impacto Físico no Resultado — Spearman & Kendall Tau-b</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => router.push('/fisiologia')}
              className="bg-slate-200 text-slate-800 px-3 py-1.5 rounded-md text-xs font-bold hover:bg-slate-300 transition-colors">
              ← VOLTAR
            </button>
            <button onClick={() => setShowCtxTable(v => !v)}
              className={`px-3 py-1.5 rounded-md text-xs font-black border transition-all ${showCtxTable ? 'bg-amber-500 text-black border-amber-500' : 'border-amber-400 text-amber-600 hover:bg-amber-50'}`}>
              ✏️ Editar contexto dos jogos
            </button>
          </div>
        </header>

        {/* ── CARDS RESUMO ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: 'Jogos c/ Resultado', value: stats.withResult, color: 'text-black' },
            { label: 'Vitórias', value: stats.V, color: 'text-green-600' },
            { label: 'Empates',  value: stats.E, color: 'text-amber-600' },
            { label: 'Derrotas', value: stats.D, color: 'text-red-600' },
            { label: 'Aproveitamento', value: stats.aprov + '%', color: 'text-black' },
            { label: 'Melhor Assoc. +', value: stats.bestK ? `${stats.bestK.label.split(' ')[0]} ${fmtCorr(stats.bestK.k)}` : '—', color: 'text-green-700', small: true },
            { label: 'Maior Assoc. −', value: stats.worstK ? `${stats.worstK.label.split(' ')[0]} ${fmtCorr(stats.worstK.k)}` : '—', color: 'text-red-700', small: true },
            { label: 'Confiabilidade', value: stats.confianca, color: stats.confianca === 'Alta' ? 'text-green-600' : stats.confianca === 'Moderada' ? 'text-amber-600' : 'text-red-600', small: true },
          ].map(({ label, value, color, small }) => (
            <div key={label} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
              <p className={`font-black leading-tight ${small ? 'text-sm' : 'text-2xl'} ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Alerta confiabilidade */}
        {stats.confianca === 'Baixa' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 font-bold flex items-center gap-2">
            ⚠️ Amostra pequena ({stats.withResult} jogos com resultado). Os padrões indicam tendência inicial, não conclusão definitiva. Continue registrando jogos.
          </div>
        )}

        {/* Alerta mando */}
        {semMando > 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 font-bold flex items-center gap-2">
            🏟️ {semMando} jogo{semMando > 1 ? 's' : ''} sem mando definido. Complete Casa/Fora para liberar análises separadas. Use o botão "Editar contexto dos jogos" acima.
          </div>
        )}

        {/* ── TABELA DE EDIÇÃO DE CONTEXTO ── */}
        {showCtxTable && (
          <div className="border border-amber-200 rounded-xl overflow-hidden">
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-amber-800">Editar Contexto dos Jogos</h2>
                <p className="text-[10px] text-amber-600 font-medium mt-0.5">Clique em Editar para completar mando, placar e competição</p>
              </div>
              <button onClick={() => setShowCtxTable(false)} className="text-amber-600 hover:text-amber-800 text-sm font-black">Fechar ✕</button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Data', 'Adversário', 'Resultado', 'Placar', 'Mando', 'Competição', ''].map(h => (
                    <th key={h} className="text-left text-[9px] font-black uppercase tracking-widest text-slate-400 px-3 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allGames.map(g => {
                  const rc = RESULT_CFG[g.result]
                  const placar = g.score_pro != null && g.score_con != null ? `${g.score_pro}x${g.score_con}` : '—'
                  return (
                    <tr key={g.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 text-xs font-bold text-slate-700 whitespace-nowrap">{dateLabel(g)}</td>
                      <td className="px-3 py-2 text-xs font-medium text-slate-700">{g.opponent}</td>
                      <td className="px-3 py-2">
                        {rc ? <span className={`text-xs font-black ${rc.text}`}>{rc.label}</span>
                           : <span className="text-xs text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-xs font-bold text-slate-600">{placar}</td>
                      <td className="px-3 py-2">
                        {g.mando === 'M' ? <span className="text-xs font-black text-blue-600">🏠 Casa</span>
                         : g.mando === 'V' ? <span className="text-xs font-black text-purple-600">✈️ Fora</span>
                         : <span className="text-xs text-red-400 font-bold">Sem mando</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">{g.competition || '—'}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => setEditGame(g)}
                          className="px-2.5 py-1 text-[10px] font-black bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-700 rounded-md transition-colors">
                          Editar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── FILTROS ── */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filtrar:</span>
          {[['all','Todos'], ['M','Casa'], ['V','Fora']].map(([k,l]) => (
            <button key={k} onClick={() => setFilterMando(k)}
              className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-md border transition-all ${filterMando === k ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}>
              {l}
            </button>
          ))}
          <span className="w-px h-4 bg-slate-200" />
          {[['all','Todos os resultados'], ['V','Vitórias'], ['E','Empates'], ['D','Derrotas']].map(([k,l]) => (
            <button key={k} onClick={() => setFilterResult(k)}
              className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-md border transition-all ${filterResult === k ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}>
              {l}
            </button>
          ))}
          <span className="w-px h-4 bg-slate-200" />
          {[[0,'Todos'], [5,'Últimos 5'], [10,'Últimos 10']].map(([k,l]) => (
            <button key={k} onClick={() => setFilterLast(k)}
              className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-md border transition-all ${filterLast === k ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}>
              {l}
            </button>
          ))}
        </div>

        {gamesWithResult.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-slate-200 rounded-xl">
            <p className="text-4xl mb-4">📊</p>
            <p className="text-slate-600 font-black uppercase tracking-widest text-sm mb-2">Dados insuficientes</p>
            <p className="text-slate-400 text-xs font-medium max-w-xs">
              É necessário pelo menos 4 jogos com resultado cadastrado para calcular as correlações.
            </p>
          </div>
        ) : (
          <>
            {/* ── RESUMO AUTOMÁTICO ── */}
            {autoSummary && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Resumo Automático</p>
                <p className="text-sm text-slate-700 leading-relaxed">{autoSummary}</p>
              </div>
            )}

            {/* ── TABELA DE CORRELAÇÃO ── */}
            {filteredGames.length < 4 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 font-bold">
                São necessários pelo menos 4 jogos para o filtro selecionado. Ajuste os filtros ou adicione mais jogos.
              </div>
            ) : (
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Correlação GPS × Pontuação</h2>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      {filteredGames.length} jogos · V=3 E=1 D=0 · Ordenado por Kendall Tau-b
                    </p>
                  </div>
                  <div className="flex gap-3 text-[9px] font-black uppercase tracking-widest text-slate-400">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"/>Positiva</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>Negativa</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px]">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {['Métrica GPS', 'Kendall Tau-b', 'Spearman', 'Direção', 'Força', 'Melhor Cenário', 'Hipótese de Leitura'].map(h => (
                          <th key={h} className="text-left text-[9px] font-black uppercase tracking-widest text-slate-400 px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {correlations.map(c => {
                        const bestResult = c.k > 0 ? 'Vitória' : c.k < -0.05 ? 'Derrota' : '—'
                        return (
                          <tr key={c.key} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-sm font-black text-slate-800">{c.label}</td>
                            <td className="px-4 py-3"><CorrBadge value={c.k} /></td>
                            <td className="px-4 py-3"><CorrBadge value={c.s} /></td>
                            <td className="px-4 py-3"><DirBadge value={c.k} /></td>
                            <td className="px-4 py-3 text-xs font-bold text-slate-600">{forceLabel(c.k)}</td>
                            <td className="px-4 py-3 text-xs font-bold text-slate-700">{bestResult}</td>
                            <td className="px-4 py-3 text-xs text-slate-500 max-w-[280px] leading-relaxed">{getHypothesis(c.key, c.k)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── GRÁFICOS ── */}
            <div className="grid grid-cols-2 gap-5">
              <div className="border border-slate-100 rounded-xl p-4">
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-600 mb-3">Ranking Kendall Tau-b</h2>
                {rankingData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={rankingData} layout="vertical" margin={{ left: 90, right: 20 }}>
                      <XAxis type="number" domain={[-1, 1]} tickCount={5} tick={{ fontSize: 9, fontWeight: 700 }} tickFormatter={v => v.toFixed(1)} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} width={88} />
                      <Tooltip formatter={v => [fmtCorr(v), 'Kendall Tau-b']} contentStyle={{ fontSize: 11, fontWeight: 700 }} />
                      <ReferenceLine x={0} stroke="#94a3b8" strokeDasharray="4 2" />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {rankingData.map((d, i) => <Cell key={i} fill={d.value >= 0 ? '#22c55e' : '#ef4444'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-xs text-slate-400 text-center py-8">Dados insuficientes</p>}
              </div>

              <div className="border border-slate-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-black uppercase tracking-widest text-slate-600">Média por Resultado</h2>
                  <select value={selectedMetric} onChange={e => setSelectedMetric(e.target.value)}
                    className="border border-slate-200 rounded-md px-2 py-1 text-xs font-bold focus:outline-none focus:border-amber-400">
                    {METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </div>
                {barData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} />
                      <YAxis tick={{ fontSize: 9, fontWeight: 700 }} tickFormatter={v => selMeta?.dec === 1 ? v.toFixed(1) : Math.round(v)} />
                      <Tooltip formatter={v => [selMeta?.dec === 1 ? v.toFixed(1) : Math.round(v), selMeta?.label]} contentStyle={{ fontSize: 11, fontWeight: 700 }} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {barData.map((d, i) => <Cell key={i} fill={RESULT_CFG[d.result]?.bar || '#94a3b8'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-xs text-slate-400 text-center py-8">Dados insuficientes</p>}
              </div>
            </div>

            {/* ── MÉDIAS POR RESULTADO COM % DIFF ── */}
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Médias por Resultado</h2>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                  V ({avgByResult.V.length}j) · E ({avgByResult.E.length}j) · D ({avgByResult.D.length}j) · Dif. = Vitória vs Derrota
                </p>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-[9px] font-black uppercase tracking-widest text-slate-400 px-4 py-3">Métrica</th>
                    {['V','E','D'].map(r => (
                      <th key={r} className={`text-center text-[9px] font-black uppercase tracking-widest px-4 py-3 ${RESULT_CFG[r].text}`}>
                        {RESULT_CFG[r].label}
                      </th>
                    ))}
                    <th className="text-center text-[9px] font-black uppercase tracking-widest text-slate-400 px-4 py-3">Dif. V×D</th>
                    <th className="text-left text-[9px] font-black uppercase tracking-widest text-slate-400 px-4 py-3">Melhor</th>
                  </tr>
                </thead>
                <tbody>
                  {METRICS.map(m => {
                    const vv = avgByResult.avg(avgByResult.V, m.key)
                    const ve = avgByResult.avg(avgByResult.E, m.key)
                    const vd = avgByResult.avg(avgByResult.D, m.key)
                    const vals = { V: vv, E: ve, D: vd }
                    const validVals = Object.entries(vals).filter(([, v]) => v != null)
                    if (!validVals.length) return null
                    const inv = m.key === 'pl' || m.key === 'accDec'
                    const best = validVals.reduce((a, b) => (inv ? b[1] < a[1] : b[1] > a[1]) ? b : a)?.[0]
                    const fmt = v => v == null ? '—' : m.dec === 1 ? v.toFixed(1) : Math.round(v)
                    const diffPct = vv != null && vd != null ? pct(vv, vd) : null
                    return (
                      <tr key={m.key} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-sm font-black text-slate-800">{m.label}</td>
                        {['V','E','D'].map(r => (
                          <td key={r} className={`px-4 py-2.5 text-center text-sm font-black ${best === r ? 'text-amber-600' : 'text-slate-700'}`}>
                            {fmt(vals[r])}
                            {m.unit && <span className="text-[10px] font-normal text-slate-400 ml-0.5">{m.unit}</span>}
                          </td>
                        ))}
                        <td className="px-4 py-2.5 text-center">
                          <PctDiff v={diffPct} inv={inv} />
                        </td>
                        <td className="px-4 py-2.5 text-xs font-bold text-slate-500">
                          {best ? RESULT_CFG[best].label : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* ── CORRELAÇÃO POR MANDO ── */}
            {hasMando && filteredGames.length >= 4 && (
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-100 px-4 py-3">
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Correlação por Mando (Kendall Tau-b)</h2>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                    Casa ({gamesWithResult.filter(g => g.mando === 'M').length}j) · Fora ({gamesWithResult.filter(g => g.mando === 'V').length}j)
                  </p>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Métrica','Geral','Casa','Fora','Padrão'].map(h => (
                        <th key={h} className="text-left text-[9px] font-black uppercase tracking-widest text-slate-400 px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {METRICS.map(m => {
                      const calc = games => {
                        if (games.length < 3) return null
                        const pts = games.map(g => g.pts)
                        return kendallTauB(games.map(g => g[m.key]), pts)
                      }
                      const vg = calc(gamesWithResult)
                      const vh = calc(gamesWithResult.filter(g => g.mando === 'M'))
                      const va = calc(gamesWithResult.filter(g => g.mando === 'V'))
                      let padrao = '—'
                      if (vh != null && va != null) {
                        if (Math.abs(vh) > Math.abs(va) + 0.1) padrao = 'Mais forte em casa'
                        else if (Math.abs(va) > Math.abs(vh) + 0.1) padrao = 'Mais forte fora'
                        else if (Math.sign(vh) !== Math.sign(va) && Math.abs(vh) > 0.1 && Math.abs(va) > 0.1) padrao = 'Padrão invertido por mando'
                        else padrao = 'Padrão similar'
                      }
                      return (
                        <tr key={m.key} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-4 py-2.5 text-sm font-black text-slate-800">{m.label}</td>
                          <td className="px-4 py-2.5"><CorrBadge value={vg} /></td>
                          <td className="px-4 py-2.5"><CorrBadge value={vh} /></td>
                          <td className="px-4 py-2.5"><CorrBadge value={va} /></td>
                          <td className="px-4 py-2.5 text-xs text-slate-500 font-medium">{padrao}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── INSIGHTS ── */}
            <div className="border border-slate-100 rounded-xl p-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-3">Insights</h2>
              {correlations.length === 0 ? (
                <p className="text-sm text-slate-500">Ajuste os filtros ou adicione mais jogos para gerar insights.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {correlations.map(c => {
                    const hipotese = getHypothesis(c.key, c.k)
                    const pos = c.k >= 0
                    const relevant = Math.abs(c.k) >= 0.15
                    return (
                      <div key={c.key} className={`flex gap-3 p-3 rounded-lg border ${relevant
                        ? (pos ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')
                        : 'bg-slate-50 border-slate-200'}`}>
                        <div className={`w-1 rounded-full flex-shrink-0 ${relevant ? (pos ? 'bg-green-400' : 'bg-red-400') : 'bg-slate-300'}`} />
                        <div>
                          <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${relevant ? (pos ? 'text-green-700' : 'text-red-700') : 'text-slate-500'}`}>
                            {forceLabel(c.k)} · {c.label} · Kendall {fmtCorr(c.k)}
                          </p>
                          <p className="text-xs text-slate-600 leading-relaxed">{hipotese}</p>
                        </div>
                      </div>
                    )
                  })}
                  <p className="text-[10px] text-slate-400 font-bold mt-1">
                    * Correlação não implica causalidade. Analise sempre em conjunto com contexto: mando, adversário, placar e modelo de jogo.
                  </p>
                </div>
              )}
            </div>

            {/* ── METODOLOGIA ── */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-600 mb-2">Metodologia</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                O resultado foi convertido em pontuação: vitória = 3, empate = 1 e derrota = 0. As métricas GPS foram comparadas com essa pontuação usando <strong className="text-slate-700">Kendall Tau-b</strong> e <strong className="text-slate-700">Spearman</strong>, dois métodos não paramétricos baseados em ranking. O Kendall Tau-b é o indicador principal por lidar melhor com resultados ordinais e empates frequentes. A análise identifica associação entre desempenho físico e resultado, mas não prova causalidade. Os achados devem ser interpretados junto com mando de campo, adversário, modelo de jogo e placar.
              </p>
            </div>
          </>
        )}
      </div>

      {/* MODAL DE EDIÇÃO */}
      {editGame && (
        <EditContextModal
          game={editGame}
          onClose={() => setEditGame(null)}
          onSave={handleMetaSave}
        />
      )}
    </div>
  )
}
