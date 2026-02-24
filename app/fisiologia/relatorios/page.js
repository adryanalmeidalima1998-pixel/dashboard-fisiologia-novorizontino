'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo } from 'react'
import { useData, calcVmaxPct } from '../../context/DataContext'

function scoreBg(s) {
  if (!s) return 'bg-slate-100 text-slate-400'
  if (s >= 3.5) return 'bg-green-100 text-green-700'
  if (s >= 2.5) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

function acwrLabel(v) {
  if (!v) return { label: '—', cls: 'text-slate-400' }
  if (v >= 0.8 && v <= 1.3) return { label: `${v.toFixed(2)} ✓`, cls: 'text-green-600' }
  if (v < 0.8 || (v > 1.3 && v <= 1.5)) return { label: `${v.toFixed(2)} ⚠`, cls: 'text-amber-600' }
  return { label: `${v.toFixed(2)} ⚠`, cls: 'text-red-600' }
}

function getWeekBounds(offset = 0) {
  const today = new Date()
  const dow = today.getDay() === 0 ? 6 : today.getDay() - 1
  const monday = new Date(today); monday.setDate(today.getDate() - dow + offset * 7); monday.setHours(0,0,0,0)
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23,59,59,999)
  return { monday, sunday }
}

function daysAgo(dateStr) {
  if (!dateStr) return Infinity
  const d = new Date(dateStr.includes('/') ? dateStr.split('/').reverse().join('-') : dateStr)
  return Math.round((Date.now() - d.getTime()) / (1000*60*60*24))
}

export default function RelatoriosPage() {
  const router = useRouter()
  const { gpsData, bemEstarData, vmaxBaseline } = useData()
  const [activeReport, setActiveReport] = useState('pos-sessao')
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [selectedAthlete, setSelectedAthlete] = useState('')
  const [weekOffset, setWeekOffset] = useState(0)

  const { monday, sunday } = useMemo(() => getWeekBounds(weekOffset), [weekOffset])
  const weekLabel = `${monday.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })} – ${sunday.toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' })}`

  const allAthletes = useMemo(() => {
    const names = new Set([...bemEstarData.map(r => r.playerName), ...gpsData.flatMap(s => s.rows.filter(r => !r.isOutlier).map(r => r.playerName))])
    return Array.from(names).sort()
  }, [bemEstarData, gpsData])

  const athlete = selectedAthlete || allAthletes[0] || ''
  const sessionOptions = useMemo(() => gpsData.slice().reverse(), [gpsData])
  const activeSession = useMemo(() => {
    if (selectedSessionId) return gpsData.find(s => s.id === selectedSessionId)
    return gpsData[gpsData.length - 1] || null
  }, [gpsData, selectedSessionId])

  // ─── PÓS-SESSÃO ──────────────────────────────────────────────────────────────
  const posSessao = useMemo(() => {
    if (!activeSession) return null
    const rows = activeSession.rows.filter(r => r.periodNumber === 0 && !r.isOutlier)
    if (!rows.length) return null
    const n = rows.length
    const avg = (key) => rows.reduce((s, r) => s + (r[key] || 0), 0) / n
    const group = { dist: avg('totalDistance'), mMin: avg('distanceRelative'), hsr: avg('hsr'), sprint: avg('sprintDistance'), accDec: rows.reduce((s, r) => s + (r.acceleration||0) + (r.deceleration||0), 0) / n, pl: avg('playerLoad') }
    const byPos = {}
    for (const r of rows) {
      const pos = 'Equipe'
      if (!byPos[pos]) byPos[pos] = []
      byPos[pos].push(r)
    }
    const top5 = [...rows].sort((a,b) => (b.totalDistance||0) - (a.totalDistance||0)).slice(0,5)
    const alerts = rows.filter(r => { const vm = vmaxBaseline[r.playerName]; const pct = vm ? calcVmaxPct(r.maxVelocity, vm) : null; return pct && pct >= 90 })
    const srpePost = bemEstarData.filter(r => r.type === 'post' && r.date === activeSession.date && r.srpeLoad)
    const avgSrpe = srpePost.length ? srpePost.reduce((s, r) => s + r.srpeLoad, 0) / srpePost.length : null
    return { rows, group, top5, alerts, avgSrpe, srpePost, n }
  }, [activeSession, bemEstarData, vmaxBaseline])

  // ─── PÓS-JOGO ────────────────────────────────────────────────────────────────
  const posJogo = useMemo(() => {
    if (!activeSession) return null
    return activeSession.rows.filter(r => r.periodNumber === 0 && !r.isOutlier).map(r => {
      const vm = vmaxBaseline[r.playerName]
      const pct = vm ? calcVmaxPct(r.maxVelocity, vm) : null
      return { ...r, vmaxPct: pct, achieved90: pct && pct >= 90, accDecTotal: (r.acceleration||0)+(r.deceleration||0) }
    }).sort((a, b) => (b.totalDistance||0) - (a.totalDistance||0))
  }, [activeSession, vmaxBaseline])

  // ─── SEMANAL ─────────────────────────────────────────────────────────────────
  const semanal = useMemo(() => {
    const weekBem = bemEstarData.filter(r => { const d = new Date(r.date+'T12:00:00'); return d >= monday && d <= sunday })
    const weekGps = gpsData.filter(s => { const dt = new Date(s.date?.includes('/') ? s.date.split('/').reverse().join('-')+'T12:00:00' : (s.date||'2000-01-01')+'T12:00:00'); return dt >= monday && dt <= sunday })
    const athletes = new Set([...weekBem.map(r => r.playerName), ...weekGps.flatMap(s => s.rows.filter(r => r.periodNumber===0 && !r.isOutlier).map(r => r.playerName))])
    return Array.from(athletes).sort().map(name => {
      const posts = weekBem.filter(r => r.playerName === name && r.type === 'post' && r.srpeLoad)
      const wells = weekBem.filter(r => r.playerName === name && r.type === 'pre')
      const gpsRows = weekGps.flatMap(s => s.rows.filter(r => r.playerName === name && r.periodNumber === 0 && !r.isOutlier))
      const weeklyLoad = posts.reduce((s, r) => s + r.srpeLoad, 0)
      const daily = Array(7).fill(0)
      posts.forEach(r => {
        const dow = (new Date(r.date+'T12:00:00').getDay() + 6) % 7
        daily[dow] += r.srpeLoad
      })
      const mean7 = weeklyLoad / 7
      const sd7 = Math.sqrt(daily.map(v => Math.pow(v-mean7,2)).reduce((a,b)=>a+b,0)/7)
      const mono = sd7 > 0 ? mean7/sd7 : 0
      const strain = weeklyLoad * mono
      const prevLoads = [1,2,3].map(w => {
        const { monday: pm, sunday: ps } = getWeekBounds(weekOffset - w)
        return bemEstarData.filter(r => r.playerName===name && r.type==='post' && r.srpeLoad && new Date(r.date+'T12:00:00')>=pm && new Date(r.date+'T12:00:00')<=ps).reduce((s,r)=>s+r.srpeLoad,0)
      })
      const prevAvg = prevLoads.reduce((a,b)=>a+b,0)/3
      const acwr = prevAvg > 0 ? weeklyLoad/prevAvg : null
      const avgWell = wells.length ? wells.reduce((s,r)=>s+(r.wellnessScore||0),0)/wells.length : null
      const totalHsr = gpsRows.reduce((s,r)=>s+(r.hsr||0),0)
      const totalSprint = gpsRows.reduce((s,r)=>s+(r.sprintDistance||0),0)
      return { name, weeklyLoad, monotony: mono, strain, acwr, avgWell, totalHsr, totalSprint, sessions: gpsRows.length }
    })
  }, [bemEstarData, gpsData, monday, sunday, weekOffset])

  // ─── INDIVIDUAL ──────────────────────────────────────────────────────────────
  const individual = useMemo(() => {
    const gpsRows = gpsData.flatMap(s => s.rows.filter(r => r.playerName===athlete && r.periodNumber===0 && !r.isOutlier))
      .sort((a,b) => new Date(b.sessionDate?.split('/').reverse().join('-')) - new Date(a.sessionDate?.split('/').reverse().join('-')))
    const wellRows = bemEstarData.filter(r => r.playerName===athlete && r.type==='pre').sort((a,b)=>b.timestamp-a.timestamp)
    const postRows = bemEstarData.filter(r => r.playerName===athlete && r.type==='post' && r.srpeLoad).sort((a,b)=>b.timestamp-a.timestamp)
    const last8w = new Date(Date.now() - 56*24*60*60*1000)
    const recentGps = gpsRows.filter(r => new Date(r.sessionDate?.split('/').reverse().join('-'))>=last8w)
    const recentWell = wellRows.filter(r => new Date(r.date)>=last8w)
    const vmaxMax = vmaxBaseline[athlete]
    const lastPct = gpsRows[0] && vmaxMax ? calcVmaxPct(gpsRows[0].maxVelocity, vmaxMax) : null
    const row90 = gpsRows.find(r => vmaxMax && calcVmaxPct(r.maxVelocity, vmaxMax) >= 90)
    const diasSem90 = row90 ? daysAgo(row90.sessionDate) : null
    const avgWell = recentWell.length ? recentWell.reduce((s,r)=>s+(r.wellnessScore||0),0)/recentWell.length : null
    const totalLoad8w = postRows.filter(r => new Date(r.date)>=last8w).reduce((s,r)=>s+r.srpeLoad,0)
    const painFreq = {}
    for (const r of wellRows.slice(0,60)) {
      if (!r.temDor || !r.dorLocalizada) continue
      r.dorLocalizada.split(',').map(p=>p.trim()).forEach(p => { if (p && p!=='0 - Sem dor') painFreq[p]=(painFreq[p]||0)+1 })
    }
    const topPains = Object.entries(painFreq).sort((a,b)=>b[1]-a[1]).slice(0,5)
    const lastWell = wellRows[0]
    return { gpsRows, wellRows, postRows, recentGps, recentWell, vmaxMax, lastPct, diasSem90, avgWell, totalLoad8w, topPains, lastWell }
  }, [gpsData, bemEstarData, athlete, vmaxBaseline])

  // ─── RECOMENDAÇÕES AUTOMÁTICAS ────────────────────────────────────────────────
  const recommendations = useMemo(() => {
    const recs = []
    // Checa bem-estar + GPS do dia mais recente
    const today = new Date().toISOString().split('T')[0]
    const latestDate = bemEstarData.length ? [...new Set(bemEstarData.map(r => r.date))].sort().reverse()[0] : null
    if (latestDate) {
      const preToday = bemEstarData.filter(r => r.type === 'pre' && r.date === latestDate)
      // Atletas com bem-estar baixo
      preToday.filter(r => r.wellnessScore < 2.5).forEach(r => {
        recs.push({ type: 'warning', text: `${r.playerName}: bem-estar ↓ (${r.wellnessScore?.toFixed(1)}) — avaliar reduzir carga mecânica hoje` })
      })
      // Com dor
      preToday.filter(r => r.temDor && r.dorLocalizada).forEach(r => {
        recs.push({ type: 'info', text: `${r.playerName}: dor localizada relatada (${r.dorLocalizada.split(',')[0]}) — checar com fisioterapia` })
      })
    }
    // Risco destreino velocidade
    allAthletes.forEach(name => {
      const rows = gpsData.flatMap(s => s.rows.filter(r => r.playerName === name && r.periodNumber === 0 && !r.isOutlier))
        .sort((a,b) => new Date(b.sessionDate?.split('/').reverse().join('-')) - new Date(a.sessionDate?.split('/').reverse().join('-')))
      const vmaxMax = vmaxBaseline[name]
      if (!vmaxMax || !rows.length) return
      const row90 = rows.find(r => calcVmaxPct(r.maxVelocity, vmaxMax) >= 90)
      const dias = row90 ? daysAgo(row90.sessionDate) : null
      if (dias === null || dias > 10) {
        recs.push({ type: 'velocity', text: `${name}: ${dias !== null ? `${dias} dias` : 'nunca'} sem ≥90% Vmax → inserir 2–4 exposições de alta velocidade` })
      }
    })
    // ACWR alto esta semana
    semanal.filter(d => d.acwr > 1.5).forEach(d => {
      recs.push({ type: 'danger', text: `${d.name}: ACWR = ${d.acwr.toFixed(2)} (> 1.5) — alto risco de lesão, reduzir carga` })
    })
    semanal.filter(d => d.acwr && d.acwr < 0.8).forEach(d => {
      recs.push({ type: 'info', text: `${d.name}: ACWR = ${d.acwr.toFixed(2)} (< 0.8) — sub-carga, considerar progressão` })
    })
    return recs
  }, [bemEstarData, gpsData, vmaxBaseline, allAthletes, semanal])

  const reportTypes = [
    { id: 'pos-sessao', label: '1. Pós-Sessão', icon: '⚡' },
    { id: 'pos-jogo', label: '2. Pós-Jogo', icon: '⚽' },
    { id: 'semanal', label: '3. Semanal', icon: '📅' },
    { id: 'individual', label: '4. Individual', icon: '👤' },
  ]

  return (
    <div className="min-h-screen bg-white text-black p-4 font-sans">
      <div className="max-w-[1500px] mx-auto flex flex-col gap-5">

        {/* HEADER */}
        <header className="flex flex-wrap justify-between items-center border-b-4 border-amber-500 pb-3 gap-3">
          <div className="flex items-center gap-4">
            <img src="/club/escudonovorizontino.png" alt="Escudo" className="h-14 w-auto" />
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-black uppercase leading-none">Relatórios Automáticos</h1>
              <p className="text-sm font-bold tracking-widest text-slate-600 uppercase">Pós-Sessão · Pós-Jogo · Semanal · Individual</p>
            </div>
          </div>
          <button onClick={() => router.push('/fisiologia')} className="bg-slate-200 text-slate-800 px-3 py-1 rounded-md text-xs font-bold hover:bg-slate-300 transition-colors">← VOLTAR</button>
        </header>

        {/* RECOMENDAÇÕES AUTOMÁTICAS */}
        {recommendations.length > 0 && (
          <div className="border-2 border-amber-300 bg-amber-50 rounded-xl p-4">
            <p className="text-xs font-black uppercase tracking-widest text-amber-700 mb-3">🤖 Recomendações Automáticas — Você valida, não obedece cegamente</p>
            <div className="flex flex-col gap-2">
              {recommendations.map((rec, i) => {
                const colors = { warning: 'bg-amber-100 border-amber-300 text-amber-800', info: 'bg-blue-50 border-blue-200 text-blue-700', velocity: 'bg-red-50 border-red-200 text-red-700', danger: 'bg-red-100 border-red-300 text-red-800' }
                const icons = { warning: '⚠', info: 'ℹ', velocity: '⚡', danger: '🚨' }
                return (
                  <div key={i} className={`border rounded-lg px-3 py-2 text-xs font-bold flex items-start gap-2 ${colors[rec.type] || 'bg-slate-100 border-slate-200 text-slate-700'}`}>
                    <span className="shrink-0">{icons[rec.type]}</span>
                    <span>{rec.text}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* TABS RELATÓRIOS */}
        <div className="flex gap-2 flex-wrap">
          {reportTypes.map(r => (
            <button key={r.id} onClick={() => setActiveReport(r.id)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeReport === r.id ? 'bg-amber-500 text-black' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {r.icon} {r.label}
            </button>
          ))}
        </div>

        {/* ─── RELATÓRIO 1: PÓS-SESSÃO ─── */}
        {activeReport === 'pos-sessao' && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sessão:</span>
              <select value={selectedSessionId || ''} onChange={e => setSelectedSessionId(e.target.value || null)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold focus:border-amber-400 focus:outline-none">
                <option value="">Mais recente ({gpsData[gpsData.length-1]?.name || '—'})</option>
                {sessionOptions.map(s => <option key={s.id} value={s.id}>{s.name} ({s.date})</option>)}
              </select>
            </div>

            {posSessao ? (
              <>
                <div className="bg-slate-900 text-white rounded-xl p-5">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Relatório Pós-Sessão</p>
                      <p className="text-xl font-black">{activeSession?.name}</p>
                      <p className="text-sm text-slate-400 font-medium">{activeSession?.date} · {posSessao.n} atletas</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-slate-400 uppercase font-black">sRPE médio</p>
                      <p className="text-2xl font-black text-amber-400">{posSessao.avgSrpe ? posSessao.avgSrpe.toFixed(0) : '—'}</p>
                      <p className="text-[9px] text-slate-400">UA</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {[
                      { label: 'Dist. Média', val: posSessao.group.dist?.toFixed(0), unit: 'm' },
                      { label: 'm/min', val: posSessao.group.mMin?.toFixed(1), unit: 'm/min' },
                      { label: 'HSR médio', val: posSessao.group.hsr?.toFixed(0), unit: 'm' },
                      { label: 'Sprint médio', val: posSessao.group.sprint?.toFixed(0), unit: 'm' },
                      { label: 'ACC+DEC', val: posSessao.group.accDec?.toFixed(1), unit: '/atleta' },
                      { label: 'Player Load', val: posSessao.group.pl?.toFixed(0), unit: 'UA' },
                    ].map(item => (
                      <div key={item.label} className="text-center">
                        <p className="text-[8px] text-slate-400 font-black uppercase tracking-wider">{item.label}</p>
                        <p className="text-lg font-black text-amber-400">{item.val ?? '—'}</p>
                        <p className="text-[8px] text-slate-500">{item.unit}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Top 5 — Distância Total</p>
                    <div className="flex flex-col gap-2">
                      {posSessao.top5.map((r, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-amber-600 w-4">{i+1}.</span>
                          <span className="text-xs font-black flex-1 truncate">{r.playerName}</span>
                          <span className="text-xs font-black text-black">{r.totalDistance?.toFixed(0)} m</span>
                          <span className="text-[10px] text-slate-400">{r.hsr?.toFixed(0)}m HSR</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Atletas que atingiram ≥90% Vmax</p>
                    {posSessao.alerts.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {posSessao.alerts.map((r, i) => {
                          const vm = vmaxBaseline[r.playerName]
                          const pct = vm ? calcVmaxPct(r.maxVelocity, vm) : null
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <span className="w-2 h-2 bg-green-500 rounded-full shrink-0" />
                              <span className="text-xs font-black flex-1">{r.playerName}</span>
                              <span className="text-xs font-black text-green-600">{pct}%</span>
                              <span className="text-[10px] text-slate-400">{r.maxVelocity?.toFixed(1)} km/h</span>
                            </div>
                          )
                        })}
                      </div>
                    ) : <p className="text-slate-400 text-sm text-center py-4">Nenhum atleta atingiu ≥90% Vmax</p>}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Todos os atletas — Métricas completas</p>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="border-b-2 border-slate-200">
                          {['Atleta', 'Dist (m)', 'm/min', 'HSR (m)', 'Sprint (m)', 'ACC+DEC', 'PL', 'Vmax', '% Vmax', 'sRPE', 'Carga UA'].map(h => (
                            <th key={h} className="text-left py-1.5 pr-3 font-black uppercase tracking-widest text-[9px] text-slate-400">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {posSessao.rows.map((r, i) => {
                          const vm = vmaxBaseline[r.playerName]
                          const pct = vm ? calcVmaxPct(r.maxVelocity, vm) : null
                          const srpe = posSessao.srpePost.find(p => p.playerName === r.playerName)
                          return (
                            <tr key={i} className="border-b border-slate-100 hover:bg-amber-50">
                              <td className="py-1.5 pr-3 font-black">{r.playerName}</td>
                              <td className="py-1.5 pr-3">{r.totalDistance?.toFixed(0)}</td>
                              <td className="py-1.5 pr-3">{r.distanceRelative?.toFixed(1)}</td>
                              <td className="py-1.5 pr-3">{r.hsr?.toFixed(0)}</td>
                              <td className="py-1.5 pr-3">{r.sprintDistance?.toFixed(0)}</td>
                              <td className="py-1.5 pr-3">{(r.acceleration||0)+(r.deceleration||0)}</td>
                              <td className="py-1.5 pr-3">{r.playerLoad?.toFixed(0)}</td>
                              <td className="py-1.5 pr-3">{r.maxVelocity?.toFixed(1)}</td>
                              <td className={`py-1.5 pr-3 font-black ${pct >= 90 ? 'text-green-600' : pct >= 80 ? 'text-amber-600' : 'text-slate-500'}`}>{pct ? `${pct}%` : '—'}</td>
                              <td className="py-1.5 pr-3">{srpe?.srpe ?? '—'}</td>
                              <td className="py-1.5 pr-3 font-bold text-purple-600">{srpe?.srpeLoad?.toFixed(0) ?? '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : <div className="text-center py-12 text-slate-400">Nenhuma sessão GPS carregada. Carregue um CSV Catapult na página inicial.</div>}
          </div>
        )}

        {/* ─── RELATÓRIO 2: PÓS-JOGO ─── */}
        {activeReport === 'pos-jogo' && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sessão/Jogo:</span>
              <select value={selectedSessionId || ''} onChange={e => setSelectedSessionId(e.target.value || null)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold focus:border-amber-400 focus:outline-none">
                <option value="">Mais recente</option>
                {sessionOptions.map(s => <option key={s.id} value={s.id}>{s.name} ({s.date})</option>)}
              </select>
            </div>
            {posJogo?.length > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3"><p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Total atletas</p><p className="text-2xl font-black">{posJogo.length}</p></div>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3"><p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Atingiram ≥90% Vmax</p><p className="text-2xl font-black text-green-600">{posJogo.filter(r => r.achieved90).length}</p></div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3"><p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Dist. máx.</p><p className="text-2xl font-black text-amber-700">{Math.max(...posJogo.map(r => r.totalDistance||0)).toFixed(0)} m</p></div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3"><p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">HSR médio</p><p className="text-2xl font-black">{(posJogo.reduce((s,r)=>s+(r.hsr||0),0)/posJogo.length).toFixed(0)} m</p></div>
                </div>
                <div className="border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Análise pós-jogo — Métricas de intensidade e velocidade</p>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="border-b-2 border-slate-900">
                          {['Atleta', 'Dist (m)', 'm/min', 'HSR (m)', 'Sprint (m)', 'Sprints', 'ACC+DEC', 'Vmax (km/h)', '% Vmax', 'WCS/PL', '≥90%'].map(h => (
                            <th key={h} className="text-left py-2 pr-3 font-black uppercase tracking-widest text-[10px] text-slate-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {posJogo.map((r, i) => (
                          <tr key={i} className={`border-b border-slate-100 hover:bg-amber-50 ${r.achieved90 ? 'bg-green-50/30' : ''}`}>
                            <td className="py-2 pr-3 font-black">{r.playerName}</td>
                            <td className="py-2 pr-3">{r.totalDistance?.toFixed(0)}</td>
                            <td className="py-2 pr-3">{r.distanceRelative?.toFixed(1)}</td>
                            <td className="py-2 pr-3">{r.hsr?.toFixed(0)}</td>
                            <td className="py-2 pr-3">{r.sprintDistance?.toFixed(0)}</td>
                            <td className="py-2 pr-3">{r.sprintCount}</td>
                            <td className="py-2 pr-3">{r.accDecTotal}</td>
                            <td className="py-2 pr-3 font-bold text-amber-700">{r.maxVelocity?.toFixed(1)}</td>
                            <td className={`py-2 pr-3 font-black ${r.vmaxPct >= 90 ? 'text-green-600' : r.vmaxPct >= 80 ? 'text-amber-600' : 'text-slate-500'}`}>{r.vmaxPct ? `${r.vmaxPct}%` : '—'}</td>
                            <td className="py-2 pr-3">{r.playerLoad?.toFixed(0)}</td>
                            <td className="py-2 pr-3">{r.achieved90 ? <span className="text-[9px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-black">✓ SIM</span> : <span className="text-[9px] text-slate-400">—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : <div className="text-center py-12 text-slate-400">Sem dados GPS para gerar relatório pós-jogo.</div>}
          </div>
        )}

        {/* ─── RELATÓRIO 3: SEMANAL ─── */}
        {activeReport === 'semanal' && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-2">
              <button onClick={() => setWeekOffset(w => w-1)} className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center font-black text-sm">‹</button>
              <div className="bg-amber-500 text-black px-4 py-1 font-black text-xs uppercase italic shadow-md min-w-[200px] text-center">{weekLabel}</div>
              <button onClick={() => setWeekOffset(w => Math.min(0, w+1))} className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center font-black text-sm">›</button>
            </div>
            {semanal.length > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3"><p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Atletas semana</p><p className="text-2xl font-black">{semanal.length}</p></div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3"><p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Carga total</p><p className="text-2xl font-black">{semanal.reduce((s,d)=>s+d.weeklyLoad,0).toFixed(0)}</p><p className="text-[10px] text-slate-500">UA (equipe)</p></div>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3"><p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">ACWR alto (>1.5)</p><p className="text-2xl font-black text-red-600">{semanal.filter(d => d.acwr > 1.5).length}</p></div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3"><p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Monotonia alta (>2)</p><p className="text-2xl font-black text-amber-700">{semanal.filter(d => d.monotony > 2).length}</p></div>
                </div>
                <div className="border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Resumo semanal — Carga, monotonia, ACWR e GPS</p>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="border-b-2 border-slate-900">
                          {['Atleta', 'Carga semanal', 'Monotonia', 'Strain', 'ACWR', 'Sessões GPS', 'HSR sem. (m)', 'Sprint sem. (m)', 'Bem-estar médio'].map(h => (
                            <th key={h} className="text-left py-2 pr-3 font-black uppercase tracking-widest text-[10px] text-slate-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {semanal.sort((a,b)=>b.weeklyLoad-a.weeklyLoad).map((d, i) => {
                          const ac = acwrLabel(d.acwr)
                          return (
                            <tr key={i} className={`border-b border-slate-100 hover:bg-amber-50 ${d.acwr > 1.5 ? 'bg-red-50/40' : ''}`}>
                              <td className="py-2 pr-3 font-black">{d.name}</td>
                              <td className="py-2 pr-3 font-bold text-purple-600">{d.weeklyLoad.toFixed(0)} UA</td>
                              <td className={`py-2 pr-3 font-black ${d.monotony > 2 ? 'text-red-600' : d.monotony > 1.5 ? 'text-amber-600' : 'text-green-600'}`}>{d.monotony.toFixed(2)}</td>
                              <td className="py-2 pr-3 font-bold">{d.strain.toFixed(0)}</td>
                              <td className={`py-2 pr-3 font-black ${ac.cls}`}>{ac.label}</td>
                              <td className="py-2 pr-3">{d.sessions}</td>
                              <td className="py-2 pr-3">{d.totalHsr.toFixed(0)}</td>
                              <td className="py-2 pr-3">{d.totalSprint.toFixed(0)}</td>
                              <td className="py-2 pr-3"><span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${scoreBg(d.avgWell)}`}>{d.avgWell ? d.avgWell.toFixed(1) : '—'}</span></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : <div className="text-center py-12 text-slate-400">Sem dados para esta semana.</div>}
          </div>
        )}

        {/* ─── RELATÓRIO 4: INDIVIDUAL ─── */}
        {activeReport === 'individual' && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Atleta:</span>
              <select value={athlete} onChange={e => setSelectedAthlete(e.target.value)}
                className="border-2 border-amber-500 rounded-lg px-3 py-1.5 text-sm font-black bg-white focus:outline-none">
                {allAthletes.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            {individual.gpsRows.length > 0 || individual.wellRows.length > 0 ? (
              <>
                {/* Cabeçalho do relatório individual */}
                <div className="bg-slate-900 text-white rounded-xl p-5">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Relatório Individual — 8 semanas</p>
                      <p className="text-2xl font-black">{athlete}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-[9px] text-slate-400 uppercase font-black">Vmax ref.</p>
                        <p className="text-xl font-black text-amber-400">{individual.vmaxMax ? `${individual.vmaxMax.toFixed(1)} km/h` : '—'}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-slate-400 uppercase font-black">Últ. % Vmax</p>
                        <p className={`text-xl font-black ${individual.lastPct >= 90 ? 'text-green-400' : individual.lastPct >= 80 ? 'text-amber-400' : 'text-slate-400'}`}>{individual.lastPct ? `${individual.lastPct}%` : '—'}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-slate-400 uppercase font-black">Dias s/ ≥90%</p>
                        <p className={`text-xl font-black ${individual.diasSem90 !== null && individual.diasSem90 <= 5 ? 'text-green-400' : individual.diasSem90 !== null && individual.diasSem90 <= 10 ? 'text-amber-400' : 'text-red-400'}`}>
                          {individual.diasSem90 !== null ? `${individual.diasSem90}d` : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-slate-700 pt-4">
                    <div><p className="text-[9px] text-slate-400 uppercase font-black">Sessões GPS (8sem)</p><p className="text-lg font-black text-amber-400">{individual.recentGps.length}</p></div>
                    <div><p className="text-[9px] text-slate-400 uppercase font-black">Carga sRPE (8sem)</p><p className="text-lg font-black text-amber-400">{individual.totalLoad8w.toFixed(0)} UA</p></div>
                    <div><p className="text-[9px] text-slate-400 uppercase font-black">Bem-estar médio (8sem)</p><p className="text-lg font-black text-amber-400">{individual.avgWell ? individual.avgWell.toFixed(1) : '—'}</p></div>
                    <div><p className="text-[9px] text-slate-400 uppercase font-black">Dores relatadas (hist.)</p><p className="text-lg font-black text-amber-400">{individual.wellRows.filter(r => r.temDor).length}</p></div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Últimas 8 sessões GPS</p>
                    <div className="flex flex-col gap-2">
                      {individual.recentGps.slice(0, 8).map((r, i) => {
                        const pct = individual.vmaxMax ? calcVmaxPct(r.maxVelocity, individual.vmaxMax) : null
                        return (
                          <div key={i} className="flex items-center gap-3 py-1 border-b border-slate-100">
                            <span className="text-[10px] font-black text-slate-400 w-20 shrink-0">{r.sessionDate}</span>
                            <span className="text-xs font-black flex-1">{r.totalDistance?.toFixed(0)}m</span>
                            <span className="text-[10px] text-slate-500">{r.hsr?.toFixed(0)}m HSR</span>
                            <span className={`text-[10px] font-black ${pct >= 90 ? 'text-green-600' : pct >= 80 ? 'text-amber-600' : 'text-slate-400'}`}>{pct ? `${pct}%` : '—'}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Prontidão — Últimas entradas bem-estar</p>
                    <div className="flex flex-col gap-2">
                      {individual.wellRows.slice(0, 8).map((r, i) => (
                        <div key={i} className="flex items-center gap-3 py-1 border-b border-slate-100">
                          <span className="text-[10px] font-black text-slate-400 w-20 shrink-0">{r.date}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${scoreBg(r.wellnessScore)}`}>{r.wellnessScore?.toFixed(1) ?? '—'}</span>
                          <span className="text-[10px] text-slate-500 flex-1">S:{r.sono} F:{r.fadiga} D:{r.doms}</span>
                          {r.temDor && <span className="text-[9px] bg-orange-100 text-orange-600 px-1 py-0.5 rounded font-black">DOR</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {individual.topPains.length > 0 && (
                  <div className="border border-orange-200 bg-orange-50 rounded-xl p-4">
                    <p className="text-xs font-black uppercase tracking-widest text-orange-700 mb-3">Top regiões de dor (histórico)</p>
                    <div className="flex flex-wrap gap-2">
                      {individual.topPains.map(([region, count]) => (
                        <div key={region} className="bg-white border border-orange-200 rounded-lg px-3 py-1.5">
                          <span className="text-xs font-black text-slate-700">{region}</span>
                          <span className="ml-2 text-[10px] text-orange-600 font-black">{count}×</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : <div className="text-center py-12 text-slate-400">Sem dados para {athlete || 'este atleta'}.</div>}
          </div>
        )}

      </div>
    </div>
  )
}
