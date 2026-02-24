'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useMemo, Suspense } from 'react'
import { useData, calcVmaxPct } from '../../context/DataContext'

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function scoreColor(s) {
  if (s === null || s === undefined) return '#94a3b8'
  if (s >= 3.5) return '#16a34a'
  if (s >= 2.5) return '#d97706'
  return '#dc2626'
}
function scoreBg(s) {
  if (s === null || s === undefined) return 'bg-slate-100 text-slate-400'
  if (s >= 3.5) return 'bg-green-100 text-green-700'
  if (s >= 2.5) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

// Mini sparkline SVG
function Sparkline({ values, color = '#f59e0b', height = 32 }) {
  const valid = values.filter(v => v !== null)
  if (valid.length < 2) return <div className="flex items-center justify-center text-slate-300 text-xs">— sem dados —</div>
  const min = Math.min(...valid)
  const max = Math.max(...valid)
  const range = max - min || 1
  const w = 200
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = v !== null ? height - ((v - min) / range) * (height - 6) - 3 : null
    return { x, y }
  })
  const pathParts = []
  let inPath = false
  for (const { x, y } of pts) {
    if (y === null) { inPath = false; continue }
    if (!inPath) { pathParts.push(`M ${x} ${y}`); inPath = true }
    else pathParts.push(`L ${x} ${y}`)
  }
  const dots = pts.filter(p => p.y !== null)
  const lastDot = dots[dots.length - 1]
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }}>
      <path d={pathParts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {lastDot && <circle cx={lastDot.x} cy={lastDot.y} r="3" fill={color} />}
    </svg>
  )
}

// Bar chart horizontal simples
function MiniBar({ value, max, color = 'bg-amber-400', label }) {
  const pct = max > 0 ? Math.min((value || 0) / max, 1) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 w-16 shrink-0">{label}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-black text-slate-700 w-12 text-right">{value?.toFixed(value > 10 ? 0 : 1) ?? '—'}</span>
    </div>
  )
}

// ─── CONTEÚDO (separado por causa do Suspense) ────────────────────────────────
function IndividualContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { gpsData, bemEstarData, vmaxBaseline } = useData()
  const [activeTab, setActiveTab] = useState('visao') // 'visao' | 'gps' | 'bemEstar'

  // Lista de atletas disponíveis
  const allAthletes = useMemo(() => {
    const names = new Set([
      ...bemEstarData.map(r => r.playerName),
      ...gpsData.flatMap(s => s.rows.filter(r => !r.isOutlier).map(r => r.playerName))
    ])
    return Array.from(names).sort()
  }, [bemEstarData, gpsData])

  const [selectedAthlete, setSelectedAthlete] = useState(() => {
    const param = searchParams.get('atleta')
    return param || ''
  })

  const athlete = selectedAthlete || allAthletes[0] || ''

  // ─── DADOS DO ATLETA ─────────────────────────────────────────────────────────

  // Bem-estar pré por data (últimos 60 dias)
  const wellinessHistory = useMemo(() => {
    return bemEstarData
      .filter(r => r.playerName === athlete && r.type === 'pre')
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-60)
  }, [bemEstarData, athlete])

  // sRPE pós por data
  const srpeHistory = useMemo(() => {
    return bemEstarData
      .filter(r => r.playerName === athlete && r.type === 'post' && r.srpeLoad)
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-60)
  }, [bemEstarData, athlete])

  // GPS do atleta (todas as sessões, period=0)
  const gpsHistory = useMemo(() => {
    return gpsData
      .flatMap(s => s.rows.filter(r => r.playerName === athlete && r.periodNumber === 0 && !r.isOutlier))
      .sort((a, b) => new Date(a.sessionDate.split('/').reverse().join('-')) - new Date(b.sessionDate.split('/').reverse().join('-')))
  }, [gpsData, athlete])

  // GPS por período (detalhamento da sessão mais recente)
  const latestSessionPeriods = useMemo(() => {
    if (gpsData.length === 0) return []
    const latestSession = gpsData[gpsData.length - 1]
    return latestSession.rows.filter(r => r.playerName === athlete && !r.isOutlier)
  }, [gpsData, athlete])

  // Vmax baseline
  const vmaxMax = vmaxBaseline[athlete] || null
  const latestGps = gpsHistory[gpsHistory.length - 1] || null
  const vmaxPct = latestGps && vmaxMax ? calcVmaxPct(latestGps.maxVelocity, vmaxMax) : null

  // Dores relatadas (top regiões)
  const painFrequency = useMemo(() => {
    const freq = {}
    for (const r of wellinessHistory) {
      if (!r.temDor || !r.dorLocalizada) continue
      const parts = r.dorLocalizada.split(',').map(p => p.trim())
      for (const part of parts) {
        if (part && part !== '0 - Sem dor') {
          freq[part] = (freq[part] || 0) + 1
        }
      }
    }
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [wellinessHistory])

  // Últimas métricas de bem-estar
  const lastWellness = wellinessHistory[wellinessHistory.length - 1]
  const wellScores = wellinessHistory.map(r => r.wellnessScore)
  const avgWellness = wellScores.filter(s => s !== null).length > 0
    ? wellScores.filter(s => s !== null).reduce((a, b) => a + b, 0) / wellScores.filter(s => s !== null).length
    : null

  // Gráficos
  const wellnessChartDates = wellinessHistory.slice(-30)
  const wellnessPoints = wellnessChartDates.map(r => r.wellnessScore)
  const fadPoints = wellinessHistory.slice(-30).map(r => r.fadiga ? (6 - r.fadiga) : null)
  const sonoPoints = wellinessHistory.slice(-30).map(r => r.sono)
  const gpsDistPoints = gpsHistory.map(r => r.totalDistance)
  const gpsHsrPoints = gpsHistory.map(r => r.hsr)
  const srpeLoadPoints = srpeHistory.slice(-30).map(r => r.srpeLoad)

  if (!athlete) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-slate-400 font-medium">Sem atletas disponíveis. Carregue dados na página inicial.</p>
      </div>
    )
  }

  return (
    <div className="max-w-[1400px] mx-auto flex flex-col gap-5">

      {/* HEADER */}
      <header className="flex justify-between items-center border-b-4 border-amber-500 pb-3">
        <div className="flex items-center gap-4">
          <img src="/club/escudonovorizontino.png" alt="Escudo" className="h-14 w-auto" />
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-black uppercase leading-none">Atleta Individual</h1>
            <p className="text-sm font-bold tracking-widest text-slate-600 uppercase">Histórico & Tendências</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/fisiologia')} className="bg-slate-200 text-slate-800 px-3 py-1 rounded-md text-xs font-bold hover:bg-slate-300 transition-colors">← VOLTAR</button>
          <select
            value={athlete}
            onChange={e => setSelectedAthlete(e.target.value)}
            className="border-2 border-amber-500 rounded-lg px-3 py-1.5 text-sm font-black text-black bg-white focus:outline-none max-w-[220px]"
          >
            <option value="">Selecionar atleta...</option>
            {allAthletes.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </header>

      {athlete && (
        <>
          {/* PROFILE CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2 bg-slate-50 border-2 border-slate-200 rounded-xl p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Atleta</p>
              <p className="text-xl font-black text-black leading-tight">{athlete}</p>
              <div className="mt-3 flex gap-3 flex-wrap">
                {vmaxMax && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                    <p className="text-[9px] font-black text-amber-700 uppercase">Vmax baseline</p>
                    <p className="text-sm font-black text-amber-800">{vmaxMax.toFixed(1)} km/h</p>
                  </div>
                )}
                {vmaxPct && (
                  <div className={`border rounded-lg px-2 py-1 ${vmaxPct >= 90 ? 'bg-green-50 border-green-200' : vmaxPct >= 80 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                    <p className="text-[9px] font-black text-slate-600 uppercase">Últ. % Vmax</p>
                    <p className={`text-sm font-black ${vmaxPct >= 90 ? 'text-green-700' : vmaxPct >= 80 ? 'text-amber-700' : 'text-slate-600'}`}>{vmaxPct}%</p>
                  </div>
                )}
                {lastWellness && (
                  <div className={`border rounded-lg px-2 py-1 ${scoreBg(lastWellness.wellnessScore)}`}>
                    <p className="text-[9px] font-black uppercase">Bem-estar hoje</p>
                    <p className="text-sm font-black">{lastWellness.wellnessScore?.toFixed(1) ?? '—'}</p>
                  </div>
                )}
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                  <p className="text-[9px] font-black text-slate-500 uppercase">Registros total</p>
                  <p className="text-sm font-black text-black">{wellinessHistory.length} bem-estar · {gpsHistory.length} GPS</p>
                </div>
              </div>
            </div>

            <div className={`border-2 rounded-xl p-4 ${scoreBg(lastWellness?.wellnessScore)}`}>
              <p className="text-[9px] font-black uppercase tracking-widest mb-1 opacity-60">Score Bem-Estar (último)</p>
              <p className="text-3xl font-black">{lastWellness?.wellnessScore?.toFixed(1) ?? '—'}</p>
              <p className="text-[10px] mt-1 font-medium opacity-70">
                Média 30d: {avgWellness ? avgWellness.toFixed(1) : '—'}
              </p>
            </div>

            <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Dores relatadas</p>
              <p className="text-3xl font-black text-black">{wellinessHistory.filter(r => r.temDor).length}</p>
              <p className="text-[10px] text-slate-500 mt-1">
                de {wellinessHistory.length} registros ({wellinessHistory.length > 0 ? Math.round(wellinessHistory.filter(r => r.temDor).length / wellinessHistory.length * 100) : 0}%)
              </p>
            </div>
          </div>

          {/* TABS */}
          <div className="flex gap-1 border-b border-slate-200">
            {[
              { id: 'visao', label: 'Visão Geral' },
              { id: 'gps', label: 'GPS & Carga' },
              { id: 'bemEstar', label: 'Bem-Estar' },
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

          {/* TAB: VISÃO GERAL */}
          {activeTab === 'visao' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* Tendência bem-estar */}
              <div className="border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Tendência Bem-Estar (últimos 30 dias)</p>
                <Sparkline values={wellnessPoints} color="#f59e0b" height={48} />
                <div className="flex justify-between mt-2 text-[9px] font-bold text-slate-400">
                  <span>Sono</span>
                  <Sparkline values={sonoPoints} color="#3b82f6" height={24} />
                  <span className="ml-2">Fadiga (inv)</span>
                  <Sparkline values={fadPoints} color="#ef4444" height={24} />
                </div>
              </div>

              {/* sRPE-load */}
              <div className="border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">sRPE-Load (últimos 30 registros pós)</p>
                {srpeLoadPoints.length > 0 ? (
                  <Sparkline values={srpeLoadPoints} color="#8b5cf6" height={48} />
                ) : (
                  <div className="text-center py-6 text-slate-300 text-sm font-medium">Sem dados de sRPE</div>
                )}
                {srpeHistory.slice(-5).reverse().map(r => (
                  <div key={r.timestamp?.toISOString()} className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-[10px] text-slate-500">{r.date}</span>
                    <span className="text-xs font-black text-slate-700">sRPE {r.srpe} × {r.duracaoSessao}min</span>
                    <span className="text-xs font-black text-purple-600">{r.srpeLoad.toFixed(0)} UA</span>
                  </div>
                ))}
              </div>

              {/* GPS histórico */}
              <div className="border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">GPS — Distância Total (todas as sessões)</p>
                {gpsDistPoints.length > 0 ? (
                  <>
                    <Sparkline values={gpsDistPoints} color="#10b981" height={48} />
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="text-center">
                        <p className="text-[9px] font-black uppercase text-slate-400">Última sessão</p>
                        <p className="text-sm font-black text-black">{latestGps?.totalDistance?.toFixed(0)} m</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] font-black uppercase text-slate-400">Média</p>
                        <p className="text-sm font-black text-black">{(gpsDistPoints.reduce((a, b) => a + b, 0) / gpsDistPoints.length).toFixed(0)} m</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] font-black uppercase text-slate-400">Máxima</p>
                        <p className="text-sm font-black text-black">{Math.max(...gpsDistPoints).toFixed(0)} m</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6 text-slate-300 text-sm font-medium">Sem GPS carregado</div>
                )}
              </div>

              {/* Mapa de dores */}
              <div className="border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Regiões com dor (frequência histórica)</p>
                {painFrequency.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {painFrequency.map(([region, count]) => (
                      <MiniBar
                        key={region}
                        label={region.split(' - ')[0]}
                        value={count}
                        max={painFrequency[0][1]}
                        color="bg-orange-400"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-300 text-sm font-medium">Sem dores relatadas</div>
                )}
              </div>
            </div>
          )}

          {/* TAB: GPS & CARGA */}
          {activeTab === 'gps' && (
            <div className="flex flex-col gap-5">

              {/* Sessão mais recente - por período */}
              {latestSessionPeriods.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">
                    Última sessão: {gpsData[gpsData.length - 1]?.date} — Detalhamento por período
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="border-b-2 border-slate-900">
                          {['Período', 'Dist (m)', 'm/min', 'HSR (m)', 'Sprint (m)', 'Sprints', 'ACC', 'DEC', 'PL', 'Vmax km/h'].map(h => (
                            <th key={h} className="text-left py-2 pr-3 font-black uppercase tracking-widest text-[10px] text-slate-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {latestSessionPeriods.map((row, i) => (
                          <tr key={i} className={`border-b border-slate-100 ${row.periodNumber === 0 ? 'font-black bg-amber-50' : ''}`}>
                            <td className="py-2 pr-3 text-black">{row.period}</td>
                            <td className="py-2 pr-3">{row.totalDistance?.toFixed(0) ?? '—'}</td>
                            <td className="py-2 pr-3">{row.distanceRelative?.toFixed(1) ?? '—'}</td>
                            <td className="py-2 pr-3">{row.hsr?.toFixed(0) ?? '—'}</td>
                            <td className="py-2 pr-3">{row.sprintDistance?.toFixed(0) ?? '—'}</td>
                            <td className="py-2 pr-3">{row.sprintCount ?? '—'}</td>
                            <td className="py-2 pr-3">{row.acceleration ?? '—'}</td>
                            <td className="py-2 pr-3">{row.deceleration ?? '—'}</td>
                            <td className="py-2 pr-3">{row.playerLoad?.toFixed(0) ?? '—'}</td>
                            <td className="py-2 pr-3">{row.maxVelocity?.toFixed(1) ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Histórico GPS todas as sessões */}
              {gpsHistory.length > 0 ? (
                <div className="border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Histórico GPS — Todas as sessões carregadas</p>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Distância Total</p>
                      <Sparkline values={gpsDistPoints} color="#10b981" height={40} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-1">HSR (m)</p>
                      <Sparkline values={gpsHsrPoints} color="#f59e0b" height={40} />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="border-b-2 border-slate-200">
                          {['Data', 'Dist (m)', 'm/min', 'HSR (m)', 'Sprint (m)', 'ACC', 'DEC', 'Vmax', 'PL', '% Vmax'].map(h => (
                            <th key={h} className="text-left py-1.5 pr-3 font-black uppercase tracking-widest text-[9px] text-slate-400">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {gpsHistory.slice().reverse().map((row, i) => {
                          const pct = vmaxMax ? calcVmaxPct(row.maxVelocity, vmaxMax) : null
                          return (
                            <tr key={i} className="border-b border-slate-100 hover:bg-amber-50">
                              <td className="py-1.5 pr-3 font-bold text-slate-600">{row.sessionDate}</td>
                              <td className="py-1.5 pr-3 font-black text-black">{row.totalDistance?.toFixed(0)}</td>
                              <td className="py-1.5 pr-3">{row.distanceRelative?.toFixed(1)}</td>
                              <td className="py-1.5 pr-3">{row.hsr?.toFixed(0)}</td>
                              <td className="py-1.5 pr-3">{row.sprintDistance?.toFixed(0)}</td>
                              <td className="py-1.5 pr-3">{row.acceleration}</td>
                              <td className="py-1.5 pr-3">{row.deceleration}</td>
                              <td className="py-1.5 pr-3">{row.maxVelocity?.toFixed(1)}</td>
                              <td className="py-1.5 pr-3">{row.playerLoad?.toFixed(0)}</td>
                              <td className={`py-1.5 pr-3 font-black ${pct >= 90 ? 'text-green-600' : pct >= 80 ? 'text-amber-600' : 'text-slate-500'}`}>
                                {pct ? `${pct}%` : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 font-medium">Sem GPS para este atleta. Carregue um CSV Catapult na página inicial.</div>
              )}
            </div>
          )}

          {/* TAB: BEM-ESTAR */}
          {activeTab === 'bemEstar' && (
            <div className="flex flex-col gap-5">
              {wellinessHistory.length > 0 ? (
                <>
                  {/* Tendências individuais */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { label: 'Sono', key: 'sono', color: '#3b82f6', invert: false },
                      { label: 'Fadiga (inv)', key: 'fadiga', color: '#ef4444', invert: true },
                      { label: 'DOMS (inv)', key: 'doms', color: '#f97316', invert: true },
                      { label: 'Estresse (inv)', key: 'estresse', color: '#8b5cf6', invert: true },
                      { label: 'Humor', key: 'humor', color: '#10b981', invert: false },
                      { label: 'Score Geral', key: 'wellnessScore', color: '#f59e0b', invert: false },
                    ].map(({ label, key, color, invert }) => {
                      const pts = wellinessHistory.slice(-30).map(r => {
                        const v = r[key]
                        return v !== null ? (invert ? 6 - v : v) : null
                      })
                      const last = pts.filter(v => v !== null).slice(-1)[0]
                      return (
                        <div key={key} className="border border-slate-200 rounded-xl p-3">
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
                            <span className="text-sm font-black" style={{ color }}>{last?.toFixed(1) ?? '—'}</span>
                          </div>
                          <Sparkline values={pts} color={color} height={36} />
                        </div>
                      )
                    })}
                  </div>

                  {/* Histórico tabela */}
                  <div className="border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Histórico completo de bem-estar</p>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="border-b-2 border-slate-200">
                            {['Data', 'Score', 'Sono', 'Fadiga', 'DOMS', 'Estresse', 'Humor', 'Urina', 'Dor', 'sRPE', 'Carga UA'].map(h => (
                              <th key={h} className="text-left py-1.5 pr-3 font-black uppercase tracking-widest text-[9px] text-slate-400">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {wellinessHistory.slice().reverse().map((r, i) => {
                            const post = bemEstarData.find(p => p.playerName === athlete && p.type === 'post' && p.date === r.date)
                            return (
                              <tr key={i} className="border-b border-slate-100 hover:bg-amber-50">
                                <td className="py-1.5 pr-3 font-bold text-slate-600">{r.date}</td>
                                <td className="py-1.5 pr-3">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${scoreBg(r.wellnessScore)}`}>
                                    {r.wellnessScore?.toFixed(1) ?? '—'}
                                  </span>
                                </td>
                                <td className="py-1.5 pr-3">{r.sono ?? '—'}</td>
                                <td className="py-1.5 pr-3">{r.fadiga ?? '—'}</td>
                                <td className="py-1.5 pr-3">{r.doms ?? '—'}</td>
                                <td className="py-1.5 pr-3">{r.estresse ?? '—'}</td>
                                <td className="py-1.5 pr-3">{r.humor ?? '—'}</td>
                                <td className="py-1.5 pr-3">{r.corUrina ?? '—'}</td>
                                <td className="py-1.5 pr-3">
                                  {r.temDor ? <span className="text-[9px] bg-orange-100 text-orange-600 px-1 py-0.5 rounded font-black">DOR</span> : '—'}
                                </td>
                                <td className="py-1.5 pr-3">{post?.srpe ?? '—'}</td>
                                <td className="py-1.5 pr-3 font-bold text-purple-600">{post?.srpeLoad?.toFixed(0) ?? '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-slate-400 font-medium">Sem dados de bem-estar para este atleta.</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── WRAPPER COM SUSPENSE (necessário pelo useSearchParams) ───────────────────
export default function IndividualDashboard() {
  return (
    <div className="min-h-screen bg-white text-black p-4 font-sans">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-slate-400 font-black uppercase tracking-widest text-sm">Carregando...</div>
        </div>
      }>
        <IndividualContent />
      </Suspense>
    </div>
  )
}
