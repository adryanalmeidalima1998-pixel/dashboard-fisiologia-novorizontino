'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo, useRef } from 'react'
import { useData, calcVmaxPct } from '../../context/DataContext'
import { AthleteAvatar } from '../../utils/athletePhotos'
import ExportPdfButton from '../../../components/ExportPdfButton'

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function parseDate(dateStr) {
  if (!dateStr) return null
  if (dateStr.includes('/')) {
    const [d, m, y] = dateStr.split('/')
    return new Date(`${y}-${m}-${d}T12:00:00`)
  }
  return new Date(dateStr + 'T12:00:00')
}

function daysAgo(dateStr) {
  const d = parseDate(dateStr)
  if (!d) return null
  return Math.round((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
}

function fmt(v, dec = 0) {
  if (v == null || isNaN(v)) return '—'
  return dec === 1 ? v.toFixed(1) : v.toFixed(0)
}

const RESULT_COLOR = {
  V: { bg: 'bg-green-100 border-green-300', text: 'text-green-700', dot: 'bg-green-500', label: 'Vitória' },
  E: { bg: 'bg-amber-100 border-amber-300', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Empate' },
  D: { bg: 'bg-red-100 border-red-200',     text: 'text-red-700',   dot: 'bg-red-500',   label: 'Derrota' },
}

function ResultBadge({ result }) {
  const r = RESULT_COLOR[result]
  if (!r) return null
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase ${r.bg} ${r.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${r.dot}`} />
      {r.label}
    </span>
  )
}

function StatCard({ label, value, unit = '', sub, color = 'text-black', bg = 'bg-slate-50 border-slate-200' }) {
  return (
    <div className={`border rounded-xl p-3 ${bg}`}>
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-black leading-none ${color}`}>{value}<span className="text-xs font-bold text-slate-400 ml-1">{unit}</span></p>
      {sub && <p className="text-[10px] text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

// ─── PÁGINA ───────────────────────────────────────────────────────────────────
export default function JogosPage() {
  const contentRef = useRef(null)
  const router = useRouter()
  const { gpsData, bemEstarData, vmaxBaseline, isExcluded } = useData()
  const [selectedGameId, setSelectedGameId] = useState(null)
  const [activeTab, setActiveTab] = useState('gps')

  // Todos os jogos registrados (sessões com metadata.type === 'jogo')
  const allGames = useMemo(() => {
    return gpsData
      .filter(s => s.metadata?.type === 'jogo' || s.metadata?.sessionType === 'jogo')
      .sort((a, b) => {
        const da = parseDate(a.date), db = parseDate(b.date)
        return db - da
      })
  }, [gpsData])

  const activeGame = useMemo(() => {
    if (selectedGameId) return allGames.find(g => g.id === selectedGameId) || allGames[0]
    return allGames[0] || null
  }, [allGames, selectedGameId])

  // Métricas GPS do jogo selecionado
  const gameGps = useMemo(() => {
    if (!activeGame) return []
    return activeGame.rows
      .filter(r => r.periodNumber === 0 && !r.isOutlier && r.playerName && !isExcluded(r.playerName))
      .map(r => {
        const vm = vmaxBaseline[r.playerName]
        const vmaxPct = vm ? calcVmaxPct(r.maxVelocity, vm) : null
        return { ...r, vmaxPct, achieved90: vmaxPct != null && vmaxPct >= 90, accDecTotal: (r.acceleration || 0) + (r.deceleration || 0) }
      })
      .sort((a, b) => (b.totalDistance || 0) - (a.totalDistance || 0))
  }, [activeGame, vmaxBaseline])

  // Médias do jogo
  const gameAvg = useMemo(() => {
    if (!gameGps.length) return null
    const n = gameGps.length
    return {
      dist:   gameGps.reduce((s, r) => s + (r.totalDistance || 0), 0) / n,
      mmin:   gameGps.reduce((s, r) => s + (r.distanceRelative || 0), 0) / n,
      hsr:    gameGps.reduce((s, r) => s + (r.hsr || 0), 0) / n,
      sprint: gameGps.reduce((s, r) => s + (r.sprintDistance || 0), 0) / n,
      pl:     gameGps.reduce((s, r) => s + (r.playerLoad || 0), 0) / n,
      vmax90: gameGps.filter(r => r.achieved90).length,
      n,
    }
  }, [gameGps])

  // Carga da semana ANTERIOR ao jogo (treinos) para comparação
  const priorWeekLoad = useMemo(() => {
    if (!activeGame) return null
    const gameDate = parseDate(activeGame.date)
    if (!gameDate) return null
    const monday = new Date(gameDate)
    monday.setDate(gameDate.getDate() - ((gameDate.getDay() + 6) % 7))
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23, 59, 59, 999)
    // Treinos da semana do jogo (excluindo o próprio jogo)
    const weekSessions = gpsData.filter(s => {
      if (s.id === activeGame.id) return false
      const dt = parseDate(s.date)
      return dt && dt >= monday && dt <= sunday
    })
    if (!weekSessions.length) return null
    const allRows = weekSessions.flatMap(s => s.rows.filter(r => r.periodNumber === 0 && !r.isOutlier))
    const names = [...new Set(allRows.map(r => r.playerName))].filter(n => n && !isExcluded(n))
    if (!names.length) return null
    const n = names.length
    return {
      dist:   allRows.reduce((s, r) => s + (r.totalDistance || 0), 0) / n,
      hsr:    allRows.reduce((s, r) => s + (r.hsr || 0), 0) / n,
      sprint: allRows.reduce((s, r) => s + (r.sprintDistance || 0), 0) / n,
      pl:     allRows.reduce((s, r) => s + (r.playerLoad || 0), 0) / n,
      sessions: weekSessions.length,
    }
  }, [activeGame, gpsData])

  // Bem-estar nas 48h após o jogo (recuperação pós-jogo)
  const postGameWellness = useMemo(() => {
    if (!activeGame) return []
    const gameDate = parseDate(activeGame.date)
    if (!gameDate) return []
    const limit = new Date(gameDate.getTime() + 48 * 60 * 60 * 1000)
    const limitStr = limit.toISOString().split('T')[0]
    const gameDateStr = activeGame.date?.includes('/')
      ? activeGame.date.split('/').reverse().join('-')
      : activeGame.date
    // Registros pré-treino nos 2 dias seguintes ao jogo
    const records = bemEstarData.filter(r => {
      if (r.type !== 'pre') return false
      return r.date > gameDateStr && r.date <= limitStr
    })
    // Agrupa por atleta: pega o primeiro registro de cada um
    const byAthlete = {}
    for (const r of records) {
      if (!byAthlete[r.playerName] || r.date < byAthlete[r.playerName].date) {
        byAthlete[r.playerName] = r
      }
    }
    return Object.values(byAthlete).sort((a, b) => (a.wellnessScore || 0) - (b.wellnessScore || 0))
  }, [activeGame, bemEstarData])

  // Estatísticas da temporada
  const seasonStats = useMemo(() => {
    const V = allGames.filter(g => g.metadata?.result === 'V').length
    const E = allGames.filter(g => g.metadata?.result === 'E').length
    const D = allGames.filter(g => g.metadata?.result === 'D').length
    return { V, E, D, total: allGames.length }
  }, [allGames])

  const meta = activeGame?.metadata || {}
  const result = meta.result || null
  const opponent = meta.opponent || '—'

  return (
    <div className="min-h-screen bg-white text-black p-4 font-sans" ref={contentRef} data-pdf-root>
      <div className="max-w-[1500px] mx-auto flex flex-col gap-5">

        {/* HEADER */}
        <header className="flex flex-wrap justify-between items-center border-b-4 border-amber-500 pb-3 gap-3">
          <div className="flex items-center gap-4">
            <img src="/club/escudonovorizontino.png" alt="Escudo" className="h-14 w-auto" />
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-black uppercase leading-none">Dashboard de Jogos</h1>
              <p className="text-sm font-bold tracking-widest text-slate-600 uppercase">Análise pós-jogo & Recuperação</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ExportPdfButton contentRef={contentRef} filename="dashboard-jogos" />
            <button onClick={() => router.push('/fisiologia')} className="bg-slate-200 text-slate-800 px-3 py-1 rounded-md text-xs font-bold hover:bg-slate-300 transition-colors">← VOLTAR</button>
          </div>
        </header>

        {allGames.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-slate-500 font-black uppercase tracking-widest text-sm mb-2">Nenhum jogo registrado</p>
            <p className="text-slate-400 text-xs font-medium">Faça upload de um CSV com o tipo "⚽ Jogo" para ver a análise aqui.</p>
          </div>
        ) : (
          <>
            {/* STATS DA TEMPORADA */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard label="Jogos" value={seasonStats.total} sub="na temporada" />
              <StatCard label="Vitórias" value={seasonStats.V} bg="bg-green-50 border-green-200" color="text-green-700" />
              <StatCard label="Empates" value={seasonStats.E} bg="bg-amber-50 border-amber-200" color="text-amber-700" />
              <StatCard label="Derrotas" value={seasonStats.D} bg="bg-red-50 border-red-200" color="text-red-600" />
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">Aproveitamento</p>
                {seasonStats.total > 0 && (
                  <div className="flex h-3 rounded-full overflow-hidden w-full">
                    <div className="bg-green-500" style={{ width: `${(seasonStats.V / seasonStats.total) * 100}%` }} />
                    <div className="bg-amber-400" style={{ width: `${(seasonStats.E / seasonStats.total) * 100}%` }} />
                    <div className="bg-red-500" style={{ width: `${(seasonStats.D / seasonStats.total) * 100}%` }} />
                  </div>
                )}
                <p className="text-[10px] font-black text-slate-600 mt-1">
                  {seasonStats.total > 0 ? `${Math.round(((seasonStats.V + seasonStats.E * 0.5) / seasonStats.total) * 100)}% pts` : '—'}
                </p>
              </div>
            </div>

            {/* SELETOR DE JOGO */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Jogo:</span>
              <div className="flex flex-wrap gap-2">
                {allGames.map(g => {
                  const m = g.metadata || {}
                  const isActive = (selectedGameId ? g.id === selectedGameId : g.id === allGames[0]?.id)
                  const rc = RESULT_COLOR[m.result]
                  return (
                    <button
                      key={g.id}
                      onClick={() => { setSelectedGameId(g.id); setActiveTab('gps') }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-black transition-all ${
                        isActive ? 'border-amber-500 bg-amber-50 text-black' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {m.result && rc && <span className={`w-2 h-2 rounded-full ${rc.dot} flex-shrink-0`} />}
                      <span>{m.opponent || g.name}</span>
                      <span className="text-[9px] font-medium text-slate-400">{g.date}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* JOGO SELECIONADO — CABEÇALHO */}
            {activeGame && (
              <div className={`border-2 rounded-2xl p-5 ${result ? RESULT_COLOR[result]?.bg || 'bg-slate-50 border-slate-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Jogo selecionado</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-2xl font-black text-black">
                        Novorizontino vs {opponent}
                      </h2>
                      {result && <ResultBadge result={result} />}
                    </div>
                    <p className="text-xs text-slate-500 font-bold mt-1">{activeGame.date} · {activeGame.name}</p>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    {gameAvg && (
                      <>
                        <div className="text-center">
                          <p className="text-[9px] font-black uppercase text-slate-500">Atletas</p>
                          <p className="text-xl font-black text-black">{gameAvg.n}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] font-black uppercase text-slate-500">≥90% Vmax</p>
                          <p className="text-xl font-black text-green-600">{gameAvg.vmax90}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] font-black uppercase text-slate-500">Dist. média</p>
                          <p className="text-xl font-black text-black">{fmt(gameAvg.dist)} m</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] font-black uppercase text-slate-500">HSR médio</p>
                          <p className="text-xl font-black text-blue-600">{fmt(gameAvg.hsr)} m</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TABS */}
            <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
              {[
                { id: 'gps',         label: '📡 GPS do Jogo' },
                { id: 'comparacao',  label: '⚖ Carga vs Treinos' },
                { id: 'recuperacao', label: `💤 Recuperação pós-jogo${postGameWellness.length > 0 ? ` (${postGameWellness.length})` : ''}` },
              ].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-2 text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeTab === t.id ? 'border-b-2 border-amber-500 text-black' : 'text-slate-400 hover:text-slate-600'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* TAB: GPS DO JOGO */}
            {activeTab === 'gps' && (
              <div className="flex flex-col gap-4">
                {gameGps.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">Sem GPS para este jogo.</div>
                ) : (
                  <>
                    {/* KPIs rápidos */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <StatCard label="Distância média" value={fmt(gameAvg?.dist)} unit="m" />
                      <StatCard label="m/min médio" value={fmt(gameAvg?.mmin, 1)} />
                      <StatCard label="HSR médio" value={fmt(gameAvg?.hsr)} unit="m" bg="bg-blue-50 border-blue-200" color="text-blue-700" />
                      <StatCard label="Sprint médio" value={fmt(gameAvg?.sprint)} unit="m" bg="bg-red-50 border-red-200" color="text-red-600" />
                      <StatCard label="≥90% Vmax" value={gameAvg?.vmax90} sub={`de ${gameAvg?.n} atletas`} bg="bg-green-50 border-green-200" color="text-green-700" />
                    </div>

                    {/* Tabela detalhada */}
                    <div className="border border-slate-200 rounded-xl p-4 overflow-x-auto">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Métricas por atleta</p>
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="border-b-2 border-slate-900">
                            {['Atleta', 'Dist (m)', 'm/min', 'HSR (m)', 'Sprint (m)', 'Sprints', 'ACC+DEC', 'Vmax km/h', '% Vmax', 'PL', '≥90%'].map(h => (
                              <th key={h} className="text-left py-2 pr-3 font-black uppercase tracking-widest text-[10px] text-slate-500 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {gameGps.map((r, i) => (
                            <tr key={i}
                              className={`border-b border-slate-100 cursor-pointer hover:bg-amber-50 transition-colors ${r.achieved90 ? 'bg-green-50/40' : ''}`}
                              onClick={() => router.push(`/fisiologia/individual?atleta=${encodeURIComponent(r.playerName)}`)}>
                              <td className="py-2 pr-3 font-bold">
                                <div className="flex items-center gap-2">
                                  <AthleteAvatar name={r.playerName} size="w-7 h-7" />
                                  <span>{r.playerName.split(' ').slice(0, 2).join(' ')}</span>
                                </div>
                              </td>
                              <td className="py-2 pr-3 font-black">{fmt(r.totalDistance)}</td>
                              <td className="py-2 pr-3">{fmt(r.distanceRelative, 1)}</td>
                              <td className="py-2 pr-3 font-black text-blue-700">{fmt(r.hsr)}</td>
                              <td className="py-2 pr-3">{fmt(r.sprintDistance)}</td>
                              <td className="py-2 pr-3">{r.sprintCount ?? '—'}</td>
                              <td className="py-2 pr-3">{r.accDecTotal}</td>
                              <td className="py-2 pr-3 font-bold text-amber-700">{fmt(r.maxVelocity, 1)}</td>
                              <td className={`py-2 pr-3 font-black ${r.vmaxPct >= 90 ? 'text-green-600' : r.vmaxPct >= 80 ? 'text-amber-600' : 'text-slate-500'}`}>
                                {r.vmaxPct ? `${r.vmaxPct}%` : '—'}
                              </td>
                              <td className="py-2 pr-3">{fmt(r.playerLoad)}</td>
                              <td className="py-2 pr-3">
                                {r.achieved90
                                  ? <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-black">✓ SIM</span>
                                  : <span className="text-[9px] text-slate-400">—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {gameAvg && (
                          <tfoot className="border-t-2 border-slate-300 bg-amber-50">
                            <tr>
                              <td className="py-2 pr-3 font-black text-[10px] uppercase text-amber-700">Média</td>
                              <td className="py-2 pr-3 font-black text-amber-700">{fmt(gameAvg.dist)}</td>
                              <td className="py-2 pr-3 font-black text-amber-700">{fmt(gameAvg.mmin, 1)}</td>
                              <td className="py-2 pr-3 font-black text-amber-700">{fmt(gameAvg.hsr)}</td>
                              <td className="py-2 pr-3 font-black text-amber-700">{fmt(gameAvg.sprint)}</td>
                              <td colSpan={5} />
                              <td className="py-2 pr-3 font-black text-amber-700">{fmt(gameAvg.pl)}</td>
                              <td />
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB: COMPARAÇÃO CARGA vs TREINOS */}
            {activeTab === 'comparacao' && (
              <div className="flex flex-col gap-4">
                {!priorWeekLoad ? (
                  <div className="text-center py-12 text-slate-400">Sem sessões de treino na semana deste jogo para comparar.</div>
                ) : (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                      <p className="text-xs font-black text-blue-700 uppercase tracking-widest">
                        Comparando o jogo vs {priorWeekLoad.sessions} treino{priorWeekLoad.sessions !== 1 ? 's' : ''} da mesma semana
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        { label: 'Distância média', gameVal: gameAvg?.dist, trainVal: priorWeekLoad?.dist, unit: 'm', dec: 0 },
                        { label: 'HSR médio', gameVal: gameAvg?.hsr, trainVal: priorWeekLoad?.hsr, unit: 'm', dec: 0 },
                        { label: 'Sprint médio', gameVal: gameAvg?.sprint, trainVal: priorWeekLoad?.sprint, unit: 'm', dec: 0 },
                        { label: 'Player Load médio', gameVal: gameAvg?.pl, trainVal: priorWeekLoad?.pl, unit: '', dec: 0 },
                      ].map(({ label, gameVal, trainVal, unit, dec }) => {
                        const delta = gameVal != null && trainVal != null ? gameVal - trainVal : null
                        const pct = trainVal && trainVal > 0 ? Math.round((gameVal / trainVal) * 100) : null
                        return (
                          <div key={label} className="border border-slate-200 rounded-xl p-4">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">{label}</p>
                            <div className="flex items-end justify-between mb-3">
                              <div>
                                <p className="text-[9px] text-green-600 font-black uppercase mb-0.5">⚽ Jogo</p>
                                <p className="text-2xl font-black text-black">{fmt(gameVal, dec)}<span className="text-xs text-slate-400 ml-1">{unit}</span></p>
                              </div>
                              <div className="text-right">
                                <p className="text-[9px] text-blue-500 font-black uppercase mb-0.5">🏃 Treinos</p>
                                <p className="text-lg font-black text-slate-500">{fmt(trainVal, dec)}<span className="text-xs text-slate-400 ml-1">{unit}</span></p>
                              </div>
                            </div>
                            {/* Barra comparativa */}
                            {pct != null && (
                              <div>
                                <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 mb-1">
                                  <div className="bg-green-500 rounded-full transition-all" style={{ width: `${Math.min(pct, 150) / 1.5}%` }} />
                                </div>
                                <p className={`text-[10px] font-black ${pct > 100 ? 'text-green-600' : pct < 80 ? 'text-red-500' : 'text-slate-500'}`}>
                                  {pct}% da carga dos treinos
                                  {delta != null && <span className="ml-1">({delta > 0 ? '+' : ''}{fmt(delta, dec)} {unit})</span>}
                                </p>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB: RECUPERAÇÃO PÓS-JOGO */}
            {activeTab === 'recuperacao' && (
              <div className="flex flex-col gap-4">
                {postGameWellness.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <p className="text-sm font-medium">Sem registros de bem-estar nas 48h seguintes a este jogo.</p>
                    <p className="text-xs mt-1">Os atletas precisam preencher o check-in no dia seguinte.</p>
                  </div>
                ) : (
                  <>
                    {/* Resumo */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <StatCard
                        label="Atletas com check-in"
                        value={postGameWellness.length}
                        sub="nas 48h seguintes"
                      />
                      <StatCard
                        label="Wellness médio pós-jogo"
                        value={(postGameWellness.reduce((s, r) => s + (r.wellnessScore || 0), 0) / postGameWellness.length).toFixed(1)}
                        unit="/5"
                        bg={postGameWellness.reduce((s, r) => s + (r.wellnessScore || 0), 0) / postGameWellness.length >= 3.5 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}
                        color={postGameWellness.reduce((s, r) => s + (r.wellnessScore || 0), 0) / postGameWellness.length >= 3.5 ? 'text-green-700' : 'text-amber-700'}
                      />
                      <StatCard
                        label="Com dor relatada"
                        value={postGameWellness.filter(r => r.temDor).length}
                        bg={postGameWellness.filter(r => r.temDor).length > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}
                        color={postGameWellness.filter(r => r.temDor).length > 0 ? 'text-orange-600' : 'text-green-700'}
                      />
                      <StatCard
                        label="Bem-estar baixo (<2.5)"
                        value={postGameWellness.filter(r => r.wellnessScore < 2.5).length}
                        bg={postGameWellness.filter(r => r.wellnessScore < 2.5).length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}
                        color={postGameWellness.filter(r => r.wellnessScore < 2.5).length > 0 ? 'text-red-600' : 'text-green-700'}
                      />
                    </div>

                    {/* Lista de atletas */}
                    <div className="border border-slate-200 rounded-xl p-4">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Bem-estar individual — primeiras 48h</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                        {postGameWellness.map(r => {
                          const ws = r.wellnessScore
                          const wsBg = ws >= 3.5 ? 'bg-green-50 border-green-200' : ws >= 2.5 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
                          const wsColor = ws >= 3.5 ? 'text-green-700' : ws >= 2.5 ? 'text-amber-700' : 'text-red-600'
                          return (
                            <div key={r.playerName}
                              className={`border rounded-xl p-3 cursor-pointer hover:shadow-md transition-all ${wsBg}`}
                              onClick={() => router.push(`/fisiologia/individual?atleta=${encodeURIComponent(r.playerName)}`)}>
                              <div className="flex items-center gap-2 mb-2">
                                <AthleteAvatar name={r.playerName} size="w-8 h-8" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-black text-black truncate">{r.playerName.split(' ').slice(0, 2).join(' ')}</p>
                                  <p className="text-[9px] text-slate-500 font-medium">{r.date}</p>
                                </div>
                                <span className={`text-xl font-black ${wsColor}`}>{ws?.toFixed(1) ?? '—'}</span>
                              </div>
                              <div className="grid grid-cols-5 gap-1">
                                {[
                                  { label: 'Sono', value: r.sono, invert: false },
                                  { label: 'Fad', value: r.fadiga, invert: true },
                                  { label: 'DOMS', value: r.doms, invert: true },
                                  { label: 'Str', value: r.estresse, invert: true },
                                  { label: 'Hum', value: r.humor, invert: false },
                                ].map(({ label, value, invert }) => {
                                  const score = value ? (invert ? 6 - value : value) : null
                                  const c = score >= 3.5 ? 'text-green-600' : score >= 2 ? 'text-amber-600' : score ? 'text-red-600' : 'text-slate-300'
                                  return (
                                    <div key={label} className="flex flex-col items-center">
                                      <span className="text-[8px] font-black text-slate-400 uppercase">{label}</span>
                                      <span className={`text-[10px] font-black ${c}`}>{value ?? '—'}</span>
                                    </div>
                                  )
                                })}
                              </div>
                              {r.temDor && (
                                <div className="mt-1.5">
                                  <span className="text-[8px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-black uppercase">Dor</span>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* FOOTER */}
        <footer className="flex justify-between items-center border-t-2 border-slate-900 pt-3 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              Apenas sessões cadastradas como "Jogo" aparecem aqui · Recuperação = check-ins das 48h seguintes ao jogo
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-black italic tracking-tight uppercase">© Fisiologia GN</p>
        </footer>

      </div>
    </div>
  )
}
