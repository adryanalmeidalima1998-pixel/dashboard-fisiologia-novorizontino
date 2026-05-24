'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useData, calcVmaxPct } from '../../context/DataContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'

// ─── HELPERS ESTATÍSTICOS ─────────────────────────────────────────────────────

function rankArray(arr) {
  const n = arr.length
  const indexed = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
  const ranks = new Array(n)
  let j = 0
  while (j < n) {
    let k = j
    while (k < n - 1 && indexed[k + 1].v === indexed[k].v) k++
    const avgRank = (j + k) / 2 + 1
    for (let m = j; m <= k; m++) ranks[indexed[m].i] = avgRank
    j = k + 1
  }
  return ranks
}

function pearsonOnRanks(rx, ry) {
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

function spearman(x, y) {
  return pearsonOnRanks(rankArray(x), rankArray(y))
}

function kendallTauB(x, y) {
  const n = x.length
  let C = 0, D = 0, tX = 0, tY = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = Math.sign(x[i] - x[j])
      const dy = Math.sign(y[i] - y[j])
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

function fmt1(v) { return v == null || isNaN(v) ? '—' : v.toFixed(1) }
function fmtCorr(v) { if (v == null || isNaN(v)) return '—'; return (v >= 0 ? '+' : '') + v.toFixed(2) }
function fmtPct(v) { return v == null || isNaN(v) ? '—' : v.toFixed(0) + '%' }

// ─── DEFINIÇÃO DAS MÉTRICAS ───────────────────────────────────────────────────

const METRICS = [
  { key: 'dist',   label: 'Distância média',  unit: 'm',    dec: 0 },
  { key: 'mmin',   label: 'M/min médio',       unit: 'm/min', dec: 1 },
  { key: 'hsr',    label: 'HSR médio',          unit: 'm',    dec: 0 },
  { key: 'sprint', label: 'Sprint médio',       unit: 'm',    dec: 0 },
  { key: 'pl',     label: 'PL médio',           unit: '',     dec: 1 },
  { key: 'accDec', label: 'ACC+DEC médio',      unit: '',     dec: 0 },
  { key: 'vmax90', label: '≥90% Vmax',          unit: 'at.',  dec: 0 },
]

const RESULT_CFG = {
  V: { label: 'Vitória', pts: 3, bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: '#22c55e' },
  E: { label: 'Empate',  pts: 1, bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: '#f59e0b' },
  D: { label: 'Derrota', pts: 0, bg: 'bg-red-50 border-red-200',     text: 'text-red-700',   bar: '#ef4444' },
}

// ─── COMPONENTES ──────────────────────────────────────────────────────────────

function CorrBadge({ value }) {
  if (value == null || isNaN(value)) return <span className="text-slate-300 font-black text-sm">—</span>
  const a = Math.abs(value)
  const pos = value >= 0
  const bg = a >= 0.3
    ? (pos ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')
    : (pos ? 'bg-slate-100 text-slate-600' : 'bg-slate-100 text-slate-600')
  return (
    <span className={`inline-block font-black text-sm px-2 py-0.5 rounded ${bg}`}>
      {fmtCorr(value)}
    </span>
  )
}

function DirBadge({ value }) {
  if (value == null || isNaN(value)) return null
  if (Math.abs(value) < 0.05) return <span className="text-xs text-slate-400 font-bold">Neutra</span>
  return value > 0
    ? <span className="text-xs font-black text-green-600">↑ Positiva</span>
    : <span className="text-xs font-black text-red-600">↓ Negativa</span>
}

function InsightText({ games }) {
  const insights = useMemo(() => {
    if (!games.length) return []
    const results = []

    const xs = {}
    METRICS.forEach(m => { xs[m.key] = games.map(g => g[m.key]) })
    const pts = games.map(g => g.pts)

    METRICS.forEach(m => {
      const k = kendallTauB(xs[m.key], pts)
      const s = spearman(xs[m.key], pts)
      if (Math.abs(k) >= 0.25 || Math.abs(s) >= 0.3) {
        results.push({ label: m.label, k, s })
      }
    })
    results.sort((a, b) => Math.abs(b.k) - Math.abs(a.k))
    return results
  }, [games])

  if (!insights.length) return (
    <p className="text-sm text-slate-500">Não foram encontradas associações relevantes com a amostra atual de jogos.</p>
  )

  return (
    <div className="flex flex-col gap-3">
      {insights.map(({ label, k, s }) => {
        const pos = k >= 0
        const força = forceLabel(k)
        const text = pos
          ? `${label} apresentou associação positiva com a pontuação (Kendall ${fmtCorr(k)}, Spearman ${fmtCorr(s)}). Nos jogos em que o valor físico foi maior, o resultado tendeu a ser melhor.`
          : `${label} apresentou associação negativa com a pontuação (Kendall ${fmtCorr(k)}, Spearman ${fmtCorr(s)}). Valores mais altos estiveram mais presentes em jogos de menor pontuação — pode indicar maior desgaste competitivo.`
        return (
          <div key={label} className={`flex gap-3 p-3 rounded-lg border ${pos ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className={`w-1 rounded-full flex-shrink-0 ${pos ? 'bg-green-400' : 'bg-red-400'}`} />
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${pos ? 'text-green-700' : 'text-red-700'}`}>
                {força} — {label}
              </p>
              <p className="text-xs text-slate-600">{text}</p>
            </div>
          </div>
        )
      })}
      <p className="text-[10px] text-slate-400 font-bold">
        * Correlação não implica causalidade. Os padrões acima são associações estatísticas, não relações de causa e efeito.
      </p>
    </div>
  )
}

// ─── PÁGINA ───────────────────────────────────────────────────────────────────

export default function CorrelacaoPage() {
  const router = useRouter()
  const { gpsData, vmaxBaseline, isExcluded } = useData()
  const [filterMando, setFilterMando] = useState('all')   // 'all' | 'M' | 'V'
  const [selectedMetric, setSelectedMetric] = useState('mmin')

  // ── 1. Extrair jogos com médias GPS ─────────────────────────────────────────
  const allGames = useMemo(() => {
    return gpsData
      .filter(s => s.metadata?.type === 'jogo' || s.metadata?.sessionType === 'jogo')
      .filter(s => s.metadata?.result)
      .map(session => {
        const rows = session.rows
          .filter(r => r.periodNumber === 0 && !r.isOutlier && r.playerName && !isExcluded(r.playerName))
          .map(r => {
            const vm = vmaxBaseline[r.playerName]
            const vmaxPct = vm ? calcVmaxPct(r.maxVelocity, vm) : null
            return { ...r, vmaxPct, achieved90: vmaxPct != null && vmaxPct >= 90, accDecTotal: (r.acceleration || 0) + (r.deceleration || 0) }
          })

        if (!rows.length) return null
        const n = rows.length
        const sum = (fn) => rows.reduce((s, r) => s + (fn(r) || 0), 0)

        const result = session.metadata?.result
        const mando  = session.metadata?.mando || null

        return {
          id: session.id,
          date: session.date,
          opponent: session.metadata?.opponent || '—',
          result,
          mando,
          pts: result === 'V' ? 3 : result === 'E' ? 1 : 0,
          // métricas
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
        const da = a.date?.includes('/') ? a.date.split('/').reverse().join('-') : a.date
        const db = b.date?.includes('/') ? b.date.split('/').reverse().join('-') : b.date
        return db?.localeCompare(da)
      })
  }, [gpsData, vmaxBaseline, isExcluded])

  const hasMando = useMemo(() => allGames.some(g => g.mando), [allGames])

  const filteredGames = useMemo(() => {
    if (filterMando === 'all') return allGames
    return allGames.filter(g => g.mando === filterMando)
  }, [allGames, filterMando])

  // ── 2. Calcular correlações ──────────────────────────────────────────────────
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

  // ── 3. Correlações por mando (geral / mandante / visitante) ──────────────────
  const mandoCorr = useMemo(() => {
    if (!hasMando || allGames.length < 4) return null
    const calc = (games) => {
      if (games.length < 3) return null
      const pts = games.map(g => g.pts)
      const result = {}
      METRICS.forEach(m => {
        const xs = games.map(g => g[m.key])
        result[m.key] = kendallTauB(xs, pts)
      })
      return result
    }
    return {
      all:  calc(allGames),
      home: calc(allGames.filter(g => g.mando === 'M')),
      away: calc(allGames.filter(g => g.mando === 'V')),
    }
  }, [allGames, hasMando])

  // ── 4. Médias por resultado ──────────────────────────────────────────────────
  const avgByResult = useMemo(() => {
    const groups = { V: [], E: [], D: [] }
    allGames.forEach(g => { if (groups[g.result]) groups[g.result].push(g) })
    const avg = (games, key) => {
      if (!games.length) return null
      return games.reduce((s, g) => s + (g[key] || 0), 0) / games.length
    }
    return { V: groups.V, E: groups.E, D: groups.D, avg }
  }, [allGames])

  // ── 5. Stats gerais ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const V = allGames.filter(g => g.result === 'V').length
    const E = allGames.filter(g => g.result === 'E').length
    const D = allGames.filter(g => g.result === 'D').length
    const pts = V * 3 + E
    const max = allGames.length * 3
    const aprov = max > 0 ? ((pts / max) * 100).toFixed(0) : '0'
    const bestK = correlations.find(c => c.k > 0 && Math.abs(c.k) >= 0.2)
    const worstK = correlations.find(c => c.k < 0 && Math.abs(c.k) >= 0.2)
    return { total: allGames.length, V, E, D, aprov, bestK, worstK }
  }, [allGames, correlations])

  // ── 6. Dados do gráfico de barras ────────────────────────────────────────────
  const barData = useMemo(() => {
    const m = selectedMetric
    return ['V', 'E', 'D'].map(r => {
      const games = avgByResult[r]
      const val = avgByResult.avg(games, m)
      return { name: RESULT_CFG[r].label, value: val, result: r }
    }).filter(d => d.value != null)
  }, [selectedMetric, avgByResult])

  // ── 7. Gráfico de ranking de correlação ──────────────────────────────────────
  const rankingData = useMemo(() => {
    return correlations.map(c => ({ name: c.label, value: parseFloat(c.k.toFixed(2)) }))
  }, [correlations])

  const selMetricCfg = METRICS.find(m => m.key === selectedMetric)

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
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/fisiologia')}
              className="bg-slate-200 text-slate-800 px-3 py-1 rounded-md text-xs font-bold hover:bg-slate-300 transition-colors">
              ← VOLTAR
            </button>
            {hasMando && (
              <div className="flex gap-1">
                {[['all', 'Todos'], ['M', 'Mandante'], ['V', 'Visitante']].map(([k, l]) => (
                  <button key={k} onClick={() => setFilterMando(k)}
                    className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-md border transition-all ${
                      filterMando === k ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-500 hover:border-slate-400'
                    }`}>
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {allGames.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-4xl mb-4">📊</p>
            <p className="text-slate-600 font-black uppercase tracking-widest text-sm mb-2">Dados insuficientes</p>
            <p className="text-slate-400 text-xs font-medium max-w-xs">
              É necessário pelo menos 4 jogos com resultado cadastrado para calcular as correlações.
              Suba os CSVs dos jogos com o resultado marcado (V/E/D).
            </p>
          </div>
        ) : (
          <>
            {/* ── CARDS RESUMO ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { label: 'Jogos', value: stats.total, color: 'text-black' },
                { label: 'Vitórias', value: stats.V, color: 'text-green-600' },
                { label: 'Empates', value: stats.E, color: 'text-amber-600' },
                { label: 'Derrotas', value: stats.D, color: 'text-red-600' },
                { label: 'Aproveitamento', value: stats.aprov + '%', color: 'text-black' },
                { label: 'Melhor assoc. +', value: stats.bestK ? `${stats.bestK.label.split(' ')[0]} (${fmtCorr(stats.bestK.k)})` : '—', color: 'text-green-700', small: true },
                { label: 'Maior assoc. −', value: stats.worstK ? `${stats.worstK.label.split(' ')[0]} (${fmtCorr(stats.worstK.k)})` : '—', color: 'text-red-700', small: true },
              ].map(({ label, value, color, small }) => (
                <div key={label} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
                  <p className={`font-black leading-tight ${small ? 'text-sm' : 'text-2xl'} ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* ── TABELA DE CORRELAÇÃO PRINCIPAL ── */}
            {filteredGames.length < 4 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 font-bold">
                São necessários pelo menos 4 jogos para o filtro selecionado. Selecione "Todos" ou adicione mais jogos.
              </div>
            ) : (
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Correlação GPS × Pontuação</h2>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      {filteredGames.length} jogos · Pontuação: V=3 E=1 D=0 · Ordenado por Kendall Tau-b
                    </p>
                  </div>
                  <div className="flex gap-3 text-[9px] font-black uppercase tracking-widest text-slate-400">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-400"/><span>Positiva</span></div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400"/><span>Negativa</span></div>
                  </div>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Métrica GPS', 'Kendall Tau-b', 'Spearman', 'Direção', 'Força', 'Leitura'].map(h => (
                        <th key={h} className="text-left text-[9px] font-black uppercase tracking-widest text-slate-400 px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {correlations.map(c => {
                      const leitura = Math.abs(c.k) < 0.1
                        ? 'Sem tendência clara entre esta métrica e o resultado'
                        : c.k > 0
                          ? `Maior ${c.label.toLowerCase()} aparece mais nos jogos com melhor resultado`
                          : `Maior ${c.label.toLowerCase()} aparece mais nos jogos com pior resultado`
                      return (
                        <tr key={c.key} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-black text-slate-800">{c.label}</td>
                          <td className="px-4 py-3"><CorrBadge value={c.k} /></td>
                          <td className="px-4 py-3"><CorrBadge value={c.s} /></td>
                          <td className="px-4 py-3"><DirBadge value={c.k} /></td>
                          <td className="px-4 py-3 text-xs font-bold text-slate-600">{forceLabel(c.k)}</td>
                          <td className="px-4 py-3 text-xs text-slate-500 max-w-[280px]">{leitura}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── GRID GRÁFICOS + MÉDIAS ── */}
            <div className="grid grid-cols-2 gap-5">

              {/* Ranking de correlação */}
              <div className="border border-slate-100 rounded-xl p-4">
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-600 mb-3">
                  Ranking Kendall Tau-b
                </h2>
                {rankingData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={rankingData} layout="vertical" margin={{ left: 90, right: 20 }}>
                      <XAxis type="number" domain={[-1, 1]} tickCount={5} tick={{ fontSize: 9, fontWeight: 700 }}
                        tickFormatter={v => v.toFixed(1)} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} width={88} />
                      <Tooltip formatter={(v) => [fmtCorr(v), 'Kendall Tau-b']}
                        contentStyle={{ fontSize: 11, fontWeight: 700 }} />
                      <ReferenceLine x={0} stroke="#94a3b8" strokeDasharray="4 2" />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {rankingData.map((d, i) => (
                          <Cell key={i} fill={d.value >= 0 ? '#22c55e' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-8">Dados insuficientes</p>
                )}
              </div>

              {/* Barras por resultado */}
              <div className="border border-slate-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-black uppercase tracking-widest text-slate-600">
                    Média por Resultado
                  </h2>
                  <select
                    value={selectedMetric}
                    onChange={e => setSelectedMetric(e.target.value)}
                    className="border border-slate-200 rounded-md px-2 py-1 text-xs font-bold focus:outline-none focus:border-amber-400"
                  >
                    {METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </div>
                {barData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} />
                      <YAxis tick={{ fontSize: 9, fontWeight: 700 }}
                        tickFormatter={v => selMetricCfg?.dec === 1 ? v.toFixed(1) : Math.round(v)} />
                      <Tooltip
                        formatter={v => [selMetricCfg?.dec === 1 ? v.toFixed(1) : Math.round(v), selMetricCfg?.label]}
                        contentStyle={{ fontSize: 11, fontWeight: 700 }} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {barData.map((d, i) => (
                          <Cell key={i} fill={RESULT_CFG[d.result]?.bar || '#94a3b8'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-8">Dados insuficientes</p>
                )}
              </div>
            </div>

            {/* ── MÉDIAS POR RESULTADO (tabela) ── */}
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Médias por Resultado</h2>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                  V ({avgByResult.V.length}j) · E ({avgByResult.E.length}j) · D ({avgByResult.D.length}j)
                </p>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-[9px] font-black uppercase tracking-widest text-slate-400 px-4 py-3">Métrica</th>
                    {['V', 'E', 'D'].map(r => (
                      <th key={r} className={`text-center text-[9px] font-black uppercase tracking-widest px-4 py-3 ${RESULT_CFG[r].text}`}>
                        {RESULT_CFG[r].label}
                      </th>
                    ))}
                    <th className="text-left text-[9px] font-black uppercase tracking-widest text-slate-400 px-4 py-3">Melhor cenário</th>
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

                    // Métrica é "melhor" se for maior (exceto PL e accDec que podem ser piores)
                    const invertido = (m.key === 'pl' || m.key === 'accDec')
                    const best = validVals.reduce((a, b) =>
                      (invertido ? b[1] < a[1] : b[1] > a[1]) ? b : a
                    )?.[0]

                    const fmt = v => v == null ? '—' : m.dec === 1 ? v.toFixed(1) : Math.round(v)

                    return (
                      <tr key={m.key} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-sm font-black text-slate-800">{m.label}</td>
                        {['V', 'E', 'D'].map(r => (
                          <td key={r} className={`px-4 py-2.5 text-center text-sm font-black ${
                            best === r ? 'text-amber-600' : 'text-slate-700'
                          }`}>
                            {fmt(vals[r])}
                            {m.unit && <span className="text-[10px] font-normal text-slate-400 ml-0.5">{m.unit}</span>}
                          </td>
                        ))}
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
            {hasMando && mandoCorr && (
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-100 px-4 py-3">
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Correlação por Mando (Kendall Tau-b)</h2>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                    Mandante ({allGames.filter(g => g.mando === 'M').length}j) · Visitante ({allGames.filter(g => g.mando === 'V').length}j)
                  </p>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left text-[9px] font-black uppercase tracking-widest text-slate-400 px-4 py-3">Métrica</th>
                      {['Geral', 'Mandante', 'Visitante'].map(h => (
                        <th key={h} className="text-center text-[9px] font-black uppercase tracking-widest text-slate-400 px-4 py-3">{h}</th>
                      ))}
                      <th className="text-left text-[9px] font-black uppercase tracking-widest text-slate-400 px-4 py-3">Padrão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {METRICS.map(m => {
                      const vg = mandoCorr.all?.[m.key]
                      const vh = mandoCorr.home?.[m.key]
                      const va = mandoCorr.away?.[m.key]
                      let padrao = '—'
                      if (vh != null && va != null) {
                        if (Math.abs(vh) > Math.abs(va) + 0.1) padrao = 'Mais forte como mandante'
                        else if (Math.abs(va) > Math.abs(vh) + 0.1) padrao = 'Mais forte como visitante'
                        else if (Math.sign(vh) !== Math.sign(va) && Math.abs(vh) > 0.1 && Math.abs(va) > 0.1) padrao = 'Padrão invertido por mando'
                        else padrao = 'Padrão similar'
                      }
                      return (
                        <tr key={m.key} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-4 py-2.5 text-sm font-black text-slate-800">{m.label}</td>
                          <td className="px-4 py-2.5 text-center"><CorrBadge value={vg} /></td>
                          <td className="px-4 py-2.5 text-center"><CorrBadge value={vh} /></td>
                          <td className="px-4 py-2.5 text-center"><CorrBadge value={va} /></td>
                          <td className="px-4 py-2.5 text-xs text-slate-500 font-medium">{padrao}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── INSIGHT AUTOMÁTICO ── */}
            <div className="border border-slate-100 rounded-xl p-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-3">Insights Automáticos</h2>
              <InsightText games={allGames} />
            </div>

            {/* ── METODOLOGIA ── */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-600 mb-2">Metodologia</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                O resultado de cada jogo foi convertido em pontuação: vitória = 3, empate = 1 e derrota = 0.
                Foram aplicadas duas medidas não paramétricas: <strong className="text-slate-700">Kendall Tau-b</strong> e <strong className="text-slate-700">Spearman</strong>.
                O Kendall Tau-b foi usado como referência principal por lidar melhor com resultados ordinais e empates frequentes nas classificações.
                O Spearman foi utilizado como medida complementar para validar a tendência dos rankings.
                Os resultados devem ser interpretados como <strong className="text-slate-700">associação, não como causalidade</strong>.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
