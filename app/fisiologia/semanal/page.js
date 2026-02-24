'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo } from 'react'
import { useData } from '../../context/DataContext'

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function getWeekBounds(offset = 0) {
  const today = new Date()
  const dow = today.getDay() === 0 ? 6 : today.getDay() - 1
  const monday = new Date(today)
  monday.setDate(today.getDate() - dow + offset * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { monday, sunday }
}

function isoDate(d) { return d.toISOString().split('T')[0] }

function acwrColor(v) {
  if (!v) return 'text-slate-400'
  if (v >= 0.8 && v <= 1.3) return 'text-green-600'
  if (v < 0.8 || (v > 1.3 && v <= 1.5)) return 'text-amber-600'
  return 'text-red-600'
}
function acwrBg(v) {
  if (!v) return 'bg-slate-100'
  if (v >= 0.8 && v <= 1.3) return 'bg-green-100'
  if (v < 0.8 || (v > 1.3 && v <= 1.5)) return 'bg-amber-100'
  return 'bg-red-100'
}
function monotonyColor(v) {
  if (!v) return 'text-slate-400'
  if (v < 1.5) return 'text-green-600'
  if (v < 2.0) return 'text-amber-600'
  return 'text-red-600'
}
function gpsColor(val, avg, metric) {
  if (val === null || val === undefined) return 'bg-white'
  const ratio = avg > 0 ? val / avg : 0
  if (ratio > 1.2) return 'bg-green-100'
  if (ratio < 0.8) return 'bg-slate-50'
  return 'bg-white'
}


// Helper para TH clicável com seta de ordenação
function SortTh({ label, col, sort, onSort, className = "" }) {
  const active = sort.col === col
  const arrow = active ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ' ↕'
  return (
    <th
      className={`py-2 px-2 font-black uppercase tracking-widest text-[10px] text-slate-500 cursor-pointer hover:text-amber-600 select-none whitespace-nowrap ${className}`}
      onClick={() => onSort(col)}
    >
      {label}<span className="text-[8px] ml-0.5 opacity-60">{arrow}</span>
    </th>
  )
}

// Dias da semana para tabela
const WEEK_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export default function SemanalDashboard() {
  const router = useRouter()
  const { gpsData, bemEstarData, isLoadingBemEstar, fetchBemEstar, playerPositions } = useData()
  const [weekOffset, setWeekOffset] = useState(0)
  const [activeTab, setActiveTab] = useState('carga') // 'carga' | 'gps' | 'bemEstar'
  const [filterPosition, setFilterPosition] = useState('')
  // Ordenação das tabelas: { col, dir }
  const [sortCarga, setSortCarga] = useState({ col: 'total', dir: 'desc' })
  const [sortGps, setSortGps] = useState({ col: 'totalDistance', dir: 'desc' })
  const [sortBem, setSortBem] = useState({ col: 'avg', dir: 'desc' })

  // Posições únicas disponíveis
  const availablePositions = useMemo(() => {
    const set = new Set(Object.values(playerPositions).filter(Boolean))
    return Array.from(set).sort()
  }, [playerPositions])

  // Toggle sort helper
  function toggleSort(current, col, setter) {
    if (current.col === col) {
      setter({ col, dir: current.dir === 'desc' ? 'asc' : 'desc' })
    } else {
      setter({ col, dir: 'desc' })
    }
  }

  const { monday, sunday } = useMemo(() => getWeekBounds(weekOffset), [weekOffset])
  const weekLabel = `${monday.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${sunday.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`

  // Dias da semana como string YYYY-MM-DD
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i)
      return isoDate(d)
    })
  }, [monday])

  // Dados de bem-estar da semana
  const weekBemEstar = useMemo(() => {
    return bemEstarData.filter(r => {
      const d = new Date(r.date + 'T12:00:00')
      return d >= monday && d <= sunday
    })
  }, [bemEstarData, monday, sunday])

  // Dados GPS da semana
  const weekGps = useMemo(() => {
    return gpsData.filter(s => {
      const dateStr = s.date || ''
      let dt
      if (dateStr.includes('-')) {
        dt = new Date(dateStr + 'T12:00:00')
      } else {
        const [d, m, y] = dateStr.split('/')
        if (!d || !m || !y) return false
        dt = new Date(`${y}-${m}-${d}T12:00:00`)
      }
      return dt >= monday && dt <= sunday
    })
  }, [gpsData, monday, sunday])

  // Atletas únicos com dados na semana — normaliza nomes para evitar duplicatas
  // ex: "João Pedro" e "JOAO PEDRO" do formulário vs GPS viram a mesma entrada
  const weekAthletes = useMemo(() => {
    // Mapeia normalized → nome canônico (primeiro encontrado como referência)
    const normToCanonical = {}
    const addName = (name) => {
      if (!name) return
      const norm = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z\s]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
      if (!normToCanonical[norm]) normToCanonical[norm] = name
    }
    // GPS é fonte primária para nome canônico
    weekGps.flatMap(s => s.rows.filter(r => r.periodNumber === 0 && !r.isOutlier).map(r => r.playerName)).forEach(addName)
    weekBemEstar.map(r => r.playerName).forEach(addName)

    let list = Object.values(normToCanonical).sort()
    if (filterPosition) list = list.filter(a => playerPositions[a] === filterPosition)
    return list
  }, [weekBemEstar, weekGps, filterPosition, playerPositions])

  // Helper: normaliza um nome para comparação
  function normName(n) {
    if (!n) return ''
    return n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z\s]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
  }

  // Mapeia norm → nome canônico (usando weekAthletes já deduplucado)
  const canonicalByNorm = useMemo(() => {
    const map = {}
    weekAthletes.forEach(a => { map[normName(a)] = a })
    return map
  }, [weekAthletes])

  // Resolve qualquer nome para o canônico
  const resolveCanonical = (name) => canonicalByNorm[normName(name)] || name

  // sRPE-load por atleta por dia — usa normalização de nome para agrupar variações
  const srpeMatrix = useMemo(() => {
    const matrix = {}
    for (const athlete of weekAthletes) {
      matrix[athlete] = {}
      for (const day of weekDays) {
        const posts = weekBemEstar.filter(r =>
          normName(r.playerName) === normName(athlete) && r.type === 'post' && r.date === day
        )
        const load = posts.reduce((s, r) => s + (r.srpeLoad || 0), 0)
        matrix[athlete][day] = load || null
      }
    }
    return matrix
  }, [weekAthletes, weekBemEstar, weekDays])

  // GPS por atleta (soma da semana, period=Session)
  const gpsWeekly = useMemo(() => {
    const map = {}
    for (const athlete of weekAthletes) {
      const rows = weekGps.flatMap(s => s.rows.filter(r => r.playerName === athlete && r.periodNumber === 0 && !r.isOutlier))
      if (rows.length === 0) { map[athlete] = null; continue }
      map[athlete] = {
        sessions: rows.length,
        totalDistance: rows.reduce((s, r) => s + (r.totalDistance || 0), 0),
        hsr: rows.reduce((s, r) => s + (r.hsr || 0), 0),
        sprintDistance: rows.reduce((s, r) => s + (r.sprintDistance || 0), 0),
        sprintCount: rows.reduce((s, r) => s + (r.sprintCount || 0), 0),
        accDecel: rows.reduce((s, r) => s + (r.acceleration || 0) + (r.deceleration || 0), 0),
        avgMmin: rows.reduce((s, r) => s + (r.distanceRelative || 0), 0) / rows.length,
        maxVelocity: Math.max(...rows.map(r => r.maxVelocity || 0)),
        playerLoad: rows.reduce((s, r) => s + (r.playerLoad || 0), 0),
      }
    }
    return map
  }, [weekAthletes, weekGps])

  // Cálculo de monotonia e strain por atleta
  const weekStats = useMemo(() => {
    const stats = {}
    for (const athlete of weekAthletes) {
      const dailyLoads = weekDays.map(d => srpeMatrix[athlete][d] || 0)
      const weeklySum = dailyLoads.reduce((a, b) => a + b, 0)
      const mean = weeklySum / 7
      const sd = Math.sqrt(dailyLoads.map(v => Math.pow(v - mean, 2)).reduce((a, b) => a + b, 0) / 7)
      const monotony = sd > 0 ? mean / sd : 0
      const strain = weeklySum * monotony

      // ACWR: semana atual / média das 3 semanas anteriores
      const prevLoads = [1, 2, 3].map(w => {
        const { monday: pm, sunday: ps } = getWeekBounds(weekOffset - w)
        const posts = bemEstarData.filter(r => {
          if (normName(r.playerName) !== normName(athlete) || r.type !== 'post' || !r.srpeLoad) return false
          const d = new Date(r.date + 'T12:00:00')
          return d >= pm && d <= ps
        })
        return posts.reduce((s, r) => s + r.srpeLoad, 0)
      })
      const prevAvg = prevLoads.reduce((a, b) => a + b, 0) / 3
      const acwr = prevAvg > 0 ? weeklySum / prevAvg : null

      stats[athlete] = { weeklySum, monotony, strain, acwr }
    }
    return stats
  }, [weekAthletes, srpeMatrix, weekDays, bemEstarData, weekOffset])

  // ── Listas ordenadas por aba ─────────────────────────────────────────────────
  const sortedCargaAthletes = useMemo(() => {
    const list = [...weekAthletes]
    const { col, dir } = sortCarga
    list.sort((a, b) => {
      let va, vb
      if (col === 'name') { va = a; vb = b; return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va) }
      if (col === 'total') { va = weekStats[a]?.weeklySum || 0; vb = weekStats[b]?.weeklySum || 0 }
      else if (col === 'mono') { va = weekStats[a]?.monotony || 0; vb = weekStats[b]?.monotony || 0 }
      else if (col === 'strain') { va = weekStats[a]?.strain || 0; vb = weekStats[b]?.strain || 0 }
      else if (col === 'acwr') { va = weekStats[a]?.acwr || 0; vb = weekStats[b]?.acwr || 0 }
      else { va = 0; vb = 0 }
      return dir === 'desc' ? vb - va : va - vb
    })
    return list
  }, [weekAthletes, weekStats, sortCarga])

  const sortedGpsAthletes = useMemo(() => {
    const list = weekAthletes.filter(a => gpsWeekly[a])
    const { col, dir } = sortGps
    list.sort((a, b) => {
      if (col === 'name') return dir === 'asc' ? a.localeCompare(b) : b.localeCompare(a)
      const va = gpsWeekly[a]?.[col] || 0
      const vb = gpsWeekly[b]?.[col] || 0
      return dir === 'desc' ? vb - va : va - vb
    })
    return list
  }, [weekAthletes, gpsWeekly, sortGps])

  const sortedBemAthletes = useMemo(() => {
    const list = weekAthletes.filter(a => weekBemEstar.some(r => normName(r.playerName) === normName(a)))
    const { col, dir } = sortBem
    list.sort((a, b) => {
      if (col === 'name') return dir === 'asc' ? a.localeCompare(b) : b.localeCompare(a)
      const getAvg = (name) => {
        const scores = weekDays.map(d => {
          const pre = weekBemEstar.find(r => r.playerName === name && r.type === 'pre' && r.date === d)
          return pre?.wellnessScore || null
        }).filter(Boolean)
        return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
      }
      const va = getAvg(a), vb = getAvg(b)
      return dir === 'desc' ? vb - va : va - vb
    })
    return list
  }, [weekAthletes, weekBemEstar, weekDays, sortBem])

  // Médias do grupo para carga
  const groupCargaAvg = useMemo(() => {
    const vals = weekAthletes.map(a => weekStats[a]?.weeklySum || 0).filter(v => v > 0)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }, [weekAthletes, weekStats])

  // Médias de GPS (para colorização relativa)
  const gpsAvgs = useMemo(() => {
    const vals = Object.values(gpsWeekly).filter(v => v !== null)
    if (vals.length === 0) return {}
    return {
      totalDistance: vals.reduce((s, v) => s + v.totalDistance, 0) / vals.length,
      hsr: vals.reduce((s, v) => s + v.hsr, 0) / vals.length,
      sprintDistance: vals.reduce((s, v) => s + v.sprintDistance, 0) / vals.length,
      accDecel: vals.reduce((s, v) => s + v.accDecel, 0) / vals.length,
      playerLoad: vals.reduce((s, v) => s + v.playerLoad, 0) / vals.length,
    }
  }, [gpsWeekly])

  const totalLoad = weekAthletes.reduce((s, a) => s + (weekStats[a]?.weeklySum || 0), 0)
  const avgAcwr = weekAthletes.filter(a => weekStats[a]?.acwr).length > 0
    ? weekAthletes.filter(a => weekStats[a]?.acwr).reduce((s, a) => s + weekStats[a].acwr, 0) / weekAthletes.filter(a => weekStats[a]?.acwr).length
    : null
  const highRiskCount = weekAthletes.filter(a => weekStats[a]?.acwr > 1.5 || weekStats[a]?.monotony > 2).length

  return (
    <div className="min-h-screen bg-white text-black p-4 font-sans">
      <div className="max-w-[1600px] mx-auto flex flex-col gap-5">

        {/* HEADER */}
        <header className="flex justify-between items-center border-b-4 border-amber-500 pb-3">
          <div className="flex items-center gap-4">
            <img src="/club/escudonovorizontino.png" alt="Escudo" className="h-14 w-auto" />
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-black uppercase leading-none">Microciclo Semanal</h1>
              <p className="text-sm font-bold tracking-widest text-slate-600 uppercase">Carga, Monotonia & ACWR</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => router.push('/fisiologia')} className="bg-slate-200 text-slate-800 px-3 py-1 rounded-md text-xs font-bold hover:bg-slate-300 transition-colors">← VOLTAR</button>
            {availablePositions.length > 0 && (
              <select
                value={filterPosition}
                onChange={e => setFilterPosition(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1 text-xs font-black bg-white text-slate-700 focus:border-amber-400 focus:outline-none">
                <option value="">Todas as posições</option>
                {availablePositions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
            <div className="flex items-center gap-1">
              <button onClick={() => setWeekOffset(w => w - 1)} className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-600 font-black text-sm transition-all">‹</button>
              <div className="bg-amber-500 text-black px-3 py-1 font-black text-xs uppercase italic shadow-md min-w-[160px] text-center">{weekLabel}</div>
              <button onClick={() => setWeekOffset(w => Math.min(0, w + 1))} className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-600 font-black text-sm transition-all">›</button>
            </div>
          </div>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Carga Total Semana</p>
            <p className="text-2xl font-black text-black">{totalLoad > 0 ? totalLoad.toFixed(0) : '—'}</p>
            <p className="text-[10px] text-slate-500">UA (sRPE × min)</p>
          </div>
          <div className={`border rounded-xl p-3 ${acwrBg(avgAcwr)}`}>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">ACWR Médio</p>
            <p className={`text-2xl font-black ${acwrColor(avgAcwr)}`}>{avgAcwr ? avgAcwr.toFixed(2) : '—'}</p>
            <p className="text-[10px] text-slate-500">ideal: 0.8 – 1.3</p>
          </div>
          <div className={`border rounded-xl p-3 ${highRiskCount > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Risco Elevado</p>
            <p className={`text-2xl font-black ${highRiskCount > 0 ? 'text-red-600' : 'text-green-600'}`}>{highRiskCount}</p>
            <p className="text-[10px] text-slate-500">ACWR {'>'} 1.5 ou mono. {'>'} 2</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Atletas na semana</p>
            <p className="text-2xl font-black text-black">{weekAthletes.length}</p>
            <p className="text-[10px] text-slate-500">{weekGps.length} sessão(ões) GPS</p>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-1 border-b border-slate-200">
          {[
            { id: 'carga', label: 'Carga & Monotonia' },
            { id: 'gps', label: 'GPS Semanal' },
            { id: 'bemEstar', label: 'Bem-Estar Diário' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ${activeTab === t.id ? 'border-b-2 border-amber-500 text-black' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB: CARGA & MONOTONIA */}
        {activeTab === 'carga' && (
          <div className="overflow-x-auto">
            {sortedCargaAthletes.length > 0 ? (
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-900">
                    <SortTh label="Atleta" col="name" sort={sortCarga} onSort={c => toggleSort(sortCarga, c, setSortCarga)} className="text-left pr-4" />
                    {weekDays.map((d, i) => (
                      <th key={d} className="text-center py-2 px-2 font-black uppercase tracking-widest text-[10px] text-slate-500 min-w-[60px]">
                        {WEEK_DAYS[i]}<br />
                        <span className="font-medium normal-case text-[9px]">{new Date(d + 'T12:00:00').getDate()}</span>
                      </th>
                    ))}
                    <SortTh label="Total UA" col="total" sort={sortCarga} onSort={c => toggleSort(sortCarga, c, setSortCarga)} />
                    <SortTh label="Mono." col="mono" sort={sortCarga} onSort={c => toggleSort(sortCarga, c, setSortCarga)} />
                    <SortTh label="Strain" col="strain" sort={sortCarga} onSort={c => toggleSort(sortCarga, c, setSortCarga)} />
                    <SortTh label="ACWR" col="acwr" sort={sortCarga} onSort={c => toggleSort(sortCarga, c, setSortCarga)} />
                  </tr>
                </thead>
                <tbody>
                  {sortedCargaAthletes.map((athlete, idx) => {
                    const stats = weekStats[athlete]
                    const total = stats?.weeklySum || 0
                    const below20 = groupCargaAvg && total > 0 && total < groupCargaAvg * 0.8
                    return (
                      <tr
                        key={athlete}
                        className={`border-b border-slate-100 cursor-pointer hover:bg-amber-50 transition-colors ${below20 ? 'bg-red-50/60' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                        onClick={() => router.push(`/fisiologia/individual?atleta=${encodeURIComponent(athlete)}`)}
                      >
                        <td className="py-2 pr-4 font-bold text-black text-xs">
                          <span>{athlete.split(' ').slice(0, 2).join(' ')}</span>
                          {below20 && <span className="ml-2 text-[8px] bg-red-100 text-red-600 px-1 py-0.5 rounded font-black">↓20%</span>}
                        </td>
                        {weekDays.map(d => {
                          const load = srpeMatrix[athlete][d]
                          const intensity = load ? Math.min(load / 800, 1) : 0
                          return (
                            <td key={d} className="text-center py-2 px-2">
                              {load ? (
                                <div
                                  className="mx-auto w-10 h-7 rounded flex items-center justify-center font-black text-[10px]"
                                  style={{ backgroundColor: `rgba(245, 158, 11, ${0.15 + intensity * 0.75})`, color: intensity > 0.5 ? '#92400e' : '#b45309' }}
                                >
                                  {load.toFixed(0)}
                                </div>
                              ) : (
                                <div className="mx-auto w-10 h-7 rounded flex items-center justify-center text-slate-300 text-[10px]">—</div>
                              )}
                            </td>
                          )
                        })}
                        <td className={`text-center py-2 px-2 font-black ${below20 ? 'text-red-600' : 'text-black'}`}>{total > 0 ? total.toFixed(0) : '—'}</td>
                        <td className={`text-center py-2 px-2 font-black ${monotonyColor(stats?.monotony)}`}>{stats?.monotony > 0 ? stats.monotony.toFixed(2) : '—'}</td>
                        <td className="text-center py-2 px-2 font-bold text-slate-600">{stats?.strain > 0 ? stats.strain.toFixed(0) : '—'}</td>
                        <td className={`text-center py-2 px-2 font-black ${acwrColor(stats?.acwr)}`}>{stats?.acwr ? stats.acwr.toFixed(2) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
                {groupCargaAvg && (
                  <tfoot className="border-t-2 border-slate-300 bg-amber-50">
                    <tr>
                      <td className="py-2 pr-4 font-black text-[10px] uppercase text-amber-700">Média Grupo</td>
                      {weekDays.map(d => {
                        const dayLoads = sortedCargaAthletes.map(a => srpeMatrix[a][d]).filter(Boolean)
                        const dayAvg = dayLoads.length ? dayLoads.reduce((a,b) => a+b, 0) / dayLoads.length : null
                        const intensity = dayAvg ? Math.min(dayAvg / 800, 1) : 0
                        return (
                          <td key={d} className="text-center py-2 px-2">
                            {dayAvg ? (
                              <div className="mx-auto w-10 h-7 rounded flex items-center justify-center font-black text-[10px]"
                                style={{ backgroundColor: `rgba(245, 158, 11, ${0.15 + intensity * 0.75})`, color: '#92400e' }}>
                                {dayAvg.toFixed(0)}
                              </div>
                            ) : <span className="text-slate-300 text-[10px]">—</span>}
                          </td>
                        )
                      })}
                      <td className="text-center py-2 px-2 font-black text-amber-700">{groupCargaAvg.toFixed(0)}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                )}
              </table>
            ) : (
              <div className="text-center py-12 text-slate-400 font-medium text-sm">Sem dados de carga para esta semana</div>
            )}
            <div className="mt-3 flex flex-wrap gap-4 text-[10px] font-bold text-slate-500">
              <span>🟡 Intensidade da cor = carga sRPE×min</span>
              <span className="text-red-500">🔴 Fundo vermelho = carga &gt;20% abaixo da média do grupo</span>
              <span>ACWR ideal: 0.8–1.3 | &gt;1.5 = risco</span>
              <span>Monotonia &lt;1.5 = ✓ | &gt;2.0 = atenção</span>
            </div>
          </div>
        )}

        {/* TAB: GPS SEMANAL */}
        {activeTab === 'gps' && (
          <div className="overflow-x-auto">
            {sortedGpsAthletes.length > 0 ? (() => {
              // Médias GPS do grupo (somente atletas com dados)
              const gpsKeys = ['totalDistance','hsr','sprintDistance','sprintCount','accDecel','avgMmin','maxVelocity','playerLoad']
              const groupGpsAvg = {}
              gpsKeys.forEach(k => {
                const vals = sortedGpsAthletes.map(a => gpsWeekly[a]?.[k] || 0).filter(v => v > 0)
                groupGpsAvg[k] = vals.length ? vals.reduce((a,b) => a+b,0) / vals.length : null
              })
              // Cor relativa à média: verde >120%, vermelho <80%
              function cellCls(val, avg) {
                if (!val || !avg) return ''
                const r = val / avg
                if (r > 1.2) return 'bg-green-100 text-green-800'
                if (r < 0.8) return 'bg-red-50 text-red-700'
                return ''
              }
              return (
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b-2 border-slate-900">
                      <SortTh label="Atleta" col="name" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} className="text-left pr-4" />
                      <SortTh label="Sessões" col="sessions" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} />
                      <SortTh label="Dist (m)" col="totalDistance" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} />
                      <SortTh label="HSR (m)" col="hsr" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} />
                      <SortTh label="Sprint (m)" col="sprintDistance" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} />
                      <SortTh label="Sprints" col="sprintCount" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} />
                      <SortTh label="ACC+DEC" col="accDecel" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} />
                      <SortTh label="m/min" col="avgMmin" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} />
                      <SortTh label="Vmax" col="maxVelocity" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} />
                      <SortTh label="PL" col="playerLoad" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedGpsAthletes.map((athlete, idx) => {
                      const g = gpsWeekly[athlete]
                      return (
                        <tr key={athlete} className={`border-b border-slate-100 hover:bg-amber-50 cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                          onClick={() => router.push(`/fisiologia/individual?atleta=${encodeURIComponent(athlete)}`)}>
                          <td className="py-2 pr-4 font-bold text-black">{athlete.split(' ').slice(0, 2).join(' ')}</td>
                          <td className="text-center py-2 px-3 font-bold text-slate-600">{g.sessions}</td>
                          <td className={`text-center py-2 px-3 font-black rounded ${cellCls(g.totalDistance, groupGpsAvg.totalDistance)}`}>{g.totalDistance.toFixed(0)}</td>
                          <td className={`text-center py-2 px-3 font-black rounded ${cellCls(g.hsr, groupGpsAvg.hsr)}`}>{g.hsr.toFixed(0)}</td>
                          <td className={`text-center py-2 px-3 font-bold rounded ${cellCls(g.sprintDistance, groupGpsAvg.sprintDistance)}`}>{g.sprintDistance.toFixed(0)}</td>
                          <td className={`text-center py-2 px-3 font-bold rounded ${cellCls(g.sprintCount, groupGpsAvg.sprintCount)}`}>{g.sprintCount}</td>
                          <td className={`text-center py-2 px-3 font-black rounded ${cellCls(g.accDecel, groupGpsAvg.accDecel)}`}>{g.accDecel}</td>
                          <td className={`text-center py-2 px-3 font-bold rounded ${cellCls(g.avgMmin, groupGpsAvg.avgMmin)}`}>{g.avgMmin.toFixed(1)}</td>
                          <td className="text-center py-2 px-3 font-bold text-slate-700">{g.maxVelocity.toFixed(1)}</td>
                          <td className={`text-center py-2 px-3 font-bold rounded ${cellCls(g.playerLoad, groupGpsAvg.playerLoad)}`}>{g.playerLoad.toFixed(0)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-300 bg-amber-50">
                    <tr>
                      <td className="py-2 pr-4 font-black text-[10px] uppercase text-amber-700">Média Grupo</td>
                      <td className="text-center py-2 px-3 text-amber-500 font-black">—</td>
                      {gpsKeys.map(k => (
                        <td key={k} className="text-center py-2 px-3 font-black text-amber-700 text-[10px]">
                          {groupGpsAvg[k] != null ? (k === 'avgMmin' ? groupGpsAvg[k].toFixed(1) : k === 'maxVelocity' ? groupGpsAvg[k].toFixed(1) : groupGpsAvg[k].toFixed(0)) : '—'}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              )
            })() : (
              <div className="text-center py-12 text-slate-400 font-medium text-sm">Sem GPS para esta semana. Carregue um CSV na página inicial.</div>
            )}
            <div className="mt-3 flex flex-wrap gap-4 text-[10px] font-bold text-slate-500">
              <span className="text-green-700">🟢 Verde = &gt;20% acima da média do grupo</span>
              <span className="text-red-600">🔴 Vermelho = &gt;20% abaixo da média do grupo</span>
            </div>
          </div>
        )}

        {/* TAB: BEM-ESTAR DIÁRIO */}
        {activeTab === 'bemEstar' && (
          <div className="overflow-x-auto">
            <div className="flex justify-end mb-2">
              <button onClick={fetchBemEstar} disabled={isLoadingBemEstar} className="bg-slate-100 hover:bg-amber-100 text-slate-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all">
                {isLoadingBemEstar ? 'Carregando...' : '↻ Atualizar Bem-Estar'}
              </button>
            </div>
            {sortedBemAthletes.length > 0 ? (() => {
              // Média do grupo por dia e geral
              const dayGroupAvgs = weekDays.map(d => {
                const scores = sortedBemAthletes.map(a => {
                  const pre = weekBemEstar.find(r => normName(r.playerName) === normName(a) && r.type === 'pre' && r.date === d)
                  return pre?.wellnessScore || null
                }).filter(Boolean)
                return scores.length ? scores.reduce((a,b) => a+b,0) / scores.length : null
              })
              const allGroupScores = dayGroupAvgs.filter(Boolean)
              const groupWellnessAvg = allGroupScores.length ? allGroupScores.reduce((a,b) => a+b,0) / allGroupScores.length : null

              return (
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b-2 border-slate-900">
                      <SortTh label="Atleta" col="name" sort={sortBem} onSort={c => toggleSort(sortBem, c, setSortBem)} className="text-left pr-4" />
                      {weekDays.map((d, i) => (
                        <th key={d} className="text-center py-2 px-2 font-black uppercase tracking-widest text-[10px] text-slate-500 min-w-[60px]">
                          {WEEK_DAYS[i]}<br />
                          <span className="font-medium normal-case text-[9px]">{new Date(d + 'T12:00:00').getDate()}</span>
                        </th>
                      ))}
                      <SortTh label="Média" col="avg" sort={sortBem} onSort={c => toggleSort(sortBem, c, setSortBem)} />
                      <th className="text-center py-2 px-2 font-black uppercase tracking-widest text-[10px] text-slate-500">Alertas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBemAthletes.map((athlete, idx) => {
                      const scores = weekDays.map(d => {
                        const pre = weekBemEstar.find(r => normName(r.playerName) === normName(athlete) && r.type === 'pre' && r.date === d)
                        return pre?.wellnessScore || null
                      })
                      const validScores = scores.filter(s => s !== null)
                      const avgScore = validScores.length > 0 ? validScores.reduce((a, b) => a + b, 0) / validScores.length : null
                      const hasDor = weekBemEstar.some(r => normName(r.playerName) === normName(athlete) && r.temDor)
                      const hasBaixo = scores.some(s => s !== null && s < 2.5)
                      const belowGroup = groupWellnessAvg && avgScore && avgScore < groupWellnessAvg * 0.8

                      return (
                        <tr key={athlete} className={`border-b border-slate-100 hover:bg-amber-50 cursor-pointer ${belowGroup ? 'bg-red-50/40' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                          onClick={() => router.push(`/fisiologia/individual?atleta=${encodeURIComponent(athlete)}`)}>
                          <td className="py-2 pr-4 font-bold text-black">
                            {athlete.split(' ').slice(0, 2).join(' ')}
                            {belowGroup && <span className="ml-2 text-[8px] bg-red-100 text-red-600 px-1 py-0.5 rounded font-black">↓20%</span>}
                          </td>
                          {scores.map((s, i) => (
                            <td key={i} className="text-center py-2 px-2">
                              {s !== null ? (
                                <div className={`mx-auto w-9 h-7 rounded flex items-center justify-center font-black text-xs ${s >= 3.5 ? 'bg-green-100 text-green-700' : s >= 2.5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                  {s.toFixed(1)}
                                </div>
                              ) : (
                                <div className="mx-auto w-9 h-7 rounded flex items-center justify-center text-slate-200 text-xs">—</div>
                              )}
                            </td>
                          ))}
                          <td className="text-center py-2 px-2">
                            <span className={`font-black text-xs ${avgScore ? (avgScore >= 3.5 ? 'text-green-600' : avgScore >= 2.5 ? 'text-amber-600' : 'text-red-600') : 'text-slate-400'}`}>
                              {avgScore ? avgScore.toFixed(1) : '—'}
                            </span>
                          </td>
                          <td className="text-center py-2 px-2">
                            <div className="flex gap-1 justify-center">
                              {hasBaixo && <span className="text-[8px] bg-red-100 text-red-600 px-1 py-0.5 rounded font-black">SCORE</span>}
                              {hasDor && <span className="text-[8px] bg-orange-100 text-orange-600 px-1 py-0.5 rounded font-black">DOR</span>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-300 bg-amber-50">
                    <tr>
                      <td className="py-2 pr-4 font-black text-[10px] uppercase text-amber-700">Média Grupo</td>
                      {dayGroupAvgs.map((avg, i) => (
                        <td key={i} className="text-center py-2 px-2">
                          {avg !== null ? (
                            <div className={`mx-auto w-9 h-7 rounded flex items-center justify-center font-black text-xs ${avg >= 3.5 ? 'bg-green-100 text-green-700' : avg >= 2.5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                              {avg.toFixed(1)}
                            </div>
                          ) : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                      ))}
                      <td className="text-center py-2 px-2">
                        <span className={`font-black text-xs ${groupWellnessAvg ? (groupWellnessAvg >= 3.5 ? 'text-green-600' : groupWellnessAvg >= 2.5 ? 'text-amber-600' : 'text-red-600') : 'text-slate-400'}`}>
                          {groupWellnessAvg ? groupWellnessAvg.toFixed(1) : '—'}
                        </span>
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )
            })() : (
              <div className="text-center py-12 text-slate-400 font-medium text-sm">Sem dados de bem-estar para esta semana</div>
            )}
            <div className="mt-3 flex flex-wrap gap-4 text-[10px] font-bold text-slate-500">
              <span className="text-green-600">🟢 ≥ 3.5 = Prontidão boa</span>
              <span className="text-amber-600">🟡 2.5–3.4 = Atenção</span>
              <span className="text-red-600">🔴 &lt; 2.5 = Alerta</span>
              <span className="text-red-500">↓20% = wellness abaixo de 80% da média do grupo</span>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <footer className="flex justify-between items-center border-t-2 border-slate-900 pt-3 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              ACWR = semana atual / média 3 semanas anteriores · Monotonia = média diária / desvio padrão
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-black italic tracking-tight uppercase">© Fisiologia GN</p>
        </footer>

      </div>
    </div>
  )
}
