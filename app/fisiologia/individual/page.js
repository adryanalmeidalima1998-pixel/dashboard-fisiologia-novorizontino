'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useMemo, Suspense } from 'react'
import { useData, calcVmaxPct } from '../../context/DataContext'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip as RTooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as CTooltip
} from 'recharts'

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function scoreBg(s) {
  if (s === null || s === undefined) return 'bg-slate-100 text-slate-400'
  if (s >= 3.5) return 'bg-green-100 text-green-700'
  if (s >= 2.5) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

function vmaxColor(pct) {
  if (!pct) return 'text-slate-400'
  if (pct >= 90) return 'text-green-600'
  if (pct >= 80) return 'text-amber-600'
  return 'text-red-600'
}

const DOR_LABELS = {
  '1': 'Anterior Coxa D', '2': 'Anterior Coxa E', '3': 'Adutor Coxa D', '4': 'Adutor Coxa E',
  '5': 'Tibial Ant. D', '6': 'Tibial Ant. E', '7': 'Post. Coxa D', '8': 'Post. Coxa E',
  '9': 'Panturrilha D', '10': 'Panturrilha E', '11': 'Glúteo E', '12': 'Glúteo D',
  '13': 'Flex. Quadril D', '14': 'Flex. Quadril E', '15': 'Peitoral D', '16': 'Peitoral E',
  '17': 'Dorso E', '18': 'Dorso D', '19': 'Bíceps D', '20': 'Bíceps E',
  '21': 'Tríceps E', '22': 'Tríceps D',
  'A': 'Abdome', 'B': 'Joelho Ant. D', 'C': 'Joelho Ant. E', 'D': 'Tornozelo D', 'E': 'Tornozelo E',
  'F': 'Lombar', 'G': 'Joelho Post. E', 'H': 'Joelho Post. D', 'I': 'Tendão Calc. E', 'J': 'Tendão Calc. D',
  'L': 'Deltoide D', 'M': 'Deltoide E', 'N': 'Punho D', 'O': 'Punho E',
  'P': 'Cervical', 'Q': 'Cotovelo E', 'R': 'Cotovelo D',
}

// ─── COMPONENTES ──────────────────────────────────────────────────────────────

function PlayerRadarChart({ athleteData, compData, compLabel }) {
  if (!athleteData) return <div className="h-48 flex items-center justify-center text-slate-300 italic text-sm">Sem dados GPS</div>
  const metrics = [
    { key: 'distanceRelative', label: 'm/min' },
    { key: 'hsr', label: 'HSR' },
    { key: 'sprintDistance', label: 'Sprint' },
    { key: 'accDecel', label: 'ACC+DEC' },
    { key: 'playerLoad', label: 'PL' },
    { key: 'maxVelocity', label: 'Vmax' },
  ]
  const data = metrics.map(m => {
    const av = athleteData[m.key] || 0
    const cv = compData[m.key] || 0
    const maxV = Math.max(av, cv, 0.001)
    return { subject: m.label, Atleta: parseFloat(((av/maxV)*100).toFixed(1)), [compLabel]: parseFloat(((cv/maxV)*100).toFixed(1)) }
  })
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar name={compLabel} dataKey={compLabel} stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.1} />
        <Radar name="Atleta" dataKey="Atleta" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} />
        <RTooltip />
        <Legend wrapperStyle={{ fontSize: 10, fontWeight: 'black', textTransform: 'uppercase', paddingTop: '10px' }} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

function AnatomyFigure({ activeRegions, hoveredRegion, onHover }) {
  const maxCount = Math.max(...Object.values(activeRegions), 1)
  const dotColor = (code) => {
    const c = activeRegions[code]; if (!c) return null
    const i = c / maxCount
    return i > 0.66 ? '#dc2626' : i > 0.33 ? '#f97316' : '#fbbf24'
  }
  const POINTS = {
    'P':{x:140,y:28,label:'Cervical'},'L':{x:183,y:82,label:'Deltoide D'},'M':{x:97,y:82,label:'Deltoide E'},
    '15':{x:162,y:118,label:'Peitoral D'},'16':{x:118,y:118,label:'Peitoral E'},'19':{x:196,y:128,label:'Bíceps D'},
    '20':{x:84,y:128,label:'Bíceps E'},'A':{x:140,y:158,label:'Abdome'},'R':{x:202,y:162,label:'Cotovelo D'},
    'Q':{x:78,y:162,label:'Cotovelo E'},'N':{x:208,y:198,label:'Punho D'},'O':{x:72,y:198,label:'Punho E'},
    '13':{x:158,y:200,label:'Flex. Quadril D'},'14':{x:122,y:200,label:'Flex. Quadril E'},'3':{x:152,y:240,label:'Adutor D'},
    '4':{x:128,y:240,label:'Adutor E'},'1':{x:162,y:258,label:'Ant. Coxa D'},'2':{x:118,y:258,label:'Ant. Coxa E'},
    'B':{x:162,y:318,label:'Joelho Ant. D'},'C':{x:118,y:318,label:'Joelho Ant. E'},'5':{x:162,y:368,label:'Tibial Ant. D'},
    '6':{x:118,y:368,label:'Tibial Ant. E'},'D':{x:162,y:430,label:'Tornozelo D'},'E':{x:118,y:430,label:'Tornozelo E'},
    '17':{x:403,y:115,label:'Dorso E'},'18':{x:437,y:115,label:'Dorso D'},'F':{x:420,y:162,label:'Lombar'},
    '21':{x:387,y:128,label:'Tríceps E'},'22':{x:453,y:128,label:'Tríceps D'},'11':{x:406,y:208,label:'Glúteo E'},
    '12':{x:434,y:208,label:'Glúteo D'},'8':{x:406,y:262,label:'Post. Coxa E'},'7':{x:434,y:262,label:'Post. Coxa D'},
    'G':{x:406,y:320,label:'Joelho Post. E'},'H':{x:434,y:320,label:'Joelho Post. D'},'10':{x:406,y:368,label:'Panturrilha E'},
    '9':{x:434,y:368,label:'Panturrilha D'},'I':{x:406,y:428,label:'Tendão Calc. E'},'J':{x:434,y:428,label:'Tendão Calc. D'},
  }
  return (
    <div className="relative">
      <div className="flex justify-around text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
        <span>FRENTE</span><span>COSTAS</span>
      </div>
      <svg viewBox="0 0 560 460" className="w-full max-w-md mx-auto block" style={{ maxHeight: 380 }}>
        {/* Anatomia Base Realista */}
        <ellipse cx="140" cy="26" rx="22" ry="24" fill="#e8c9a0" stroke="#c8a070" strokeWidth="1.2"/>
        <path d="M96 82 Q94 120 97 175 Q100 195 108 200 L172 200 Q180 195 183 175 Q186 120 184 82 Q162 85 140 85 Q118 85 96 82Z" fill="#c8a070" stroke="#a87850" strokeWidth="1.2"/>
        <line x1="280" y1="0" x2="280" y2="460" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="6,3"/>
        <ellipse cx="420" cy="26" rx="22" ry="24" fill="#e8c9a0" stroke="#c8a070" strokeWidth="1.2"/>
        <path d="M376 82 Q374 120 377 175 Q380 195 388 200 L452 200 Q460 195 463 175 Q466 120 464 82 Q442 85 420 85 Q398 85 376 82Z" fill="#c8a070" stroke="#a87850" strokeWidth="1.2"/>
        {Object.entries(POINTS).map(([code, pos]) => {
          const color = dotColor(code); const isHov = hoveredRegion === code
          if (!color && !isHov) return null
          return (
            <g key={code} onMouseEnter={() => onHover(code)} onMouseLeave={() => onHover(null)} style={{ cursor: 'pointer' }}>
              <circle cx={pos.x} cy={pos.y} r={isHov ? 12 : 8} fill={color || '#f59e0b'} fillOpacity={color ? 0.9 : 0.3} stroke="white" strokeWidth="1.5"/>
              {isHov && (
                <g>
                    <rect x={pos.x > 280 ? pos.x - 85 : pos.x + 10} y={pos.y - 12} width="75" height="24" rx="4" fill="black" />
                    <text x={pos.x > 280 ? pos.x - 47.5 : pos.x + 47.5} y={pos.y + 4} textAnchor="middle" fontSize="9" fontWeight="bold" fill="white">{pos.label}</text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── CONTEÚDO PRINCIPAL ───────────────────────────────────────────────────────
function IndividualContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { gpsData, bemEstarData, vmaxBaseline } = useData()
  const [hoveredRegion, setHoveredRegion] = useState(null)

  const allAthletes = useMemo(() => {
    const names = new Set([...bemEstarData.map(r => r.playerName), ...gpsData.flatMap(s => s.rows.map(r => r.playerName))])
    return Array.from(names).sort()
  }, [bemEstarData, gpsData])

  const [selectedAthlete, setSelectedAthlete] = useState(() => searchParams.get('atleta') || allAthletes[0] || '')
  const athlete = selectedAthlete

  // Dados Filtrados
  const gpsHistory = useMemo(() => gpsData
    .flatMap(s => s.rows.filter(r => r.playerName === athlete && r.periodNumber === 0 && !r.isOutlier))
    .sort((a, b) => new Date(a.sessionDate?.split('/').reverse().join('-')) - new Date(b.sessionDate?.split('/').reverse().join('-')))
    .slice(-8), [gpsData, athlete])

  const wellHistory = useMemo(() => bemEstarData
    .filter(r => r.playerName === athlete && r.type === 'pre')
    .sort((a, b) => a.timestamp - b.timestamp).slice(-8), [bemEstarData, athlete])

  const srpeHistory = useMemo(() => bemEstarData
    .filter(r => r.playerName === athlete && r.type === 'post' && r.srpeLoad)
    .sort((a, b) => a.timestamp - b.timestamp).slice(-8), [bemEstarData, athlete])

  // KPIs
  const vmaxRef = vmaxBaseline[athlete] || 0
  const latestGps = gpsHistory[gpsHistory.length - 1] || null
  const latestVmaxPct = latestGps && vmaxRef ? calcVmaxPct(latestGps.maxVelocity, vmaxRef) : 0
  
  const daysSinceHighVmax = useMemo(() => {
    const sorted = [...gpsData].flatMap(s => s.rows.filter(r => r.playerName === athlete && r.periodNumber === 0))
        .sort((a, b) => new Date(b.sessionDate?.split('/').reverse().join('-')) - new Date(a.sessionDate?.split('/').reverse().join('-')))
    const idx = sorted.findIndex(r => (vmaxBaseline[athlete] ? calcVmaxPct(r.maxVelocity, vmaxBaseline[athlete]) : 0) >= 90)
    return idx === -1 ? 99 : idx
  }, [gpsData, athlete, vmaxBaseline])

  const painCodeMap = useMemo(() => {
    const map = {}; for (const r of bemEstarData.filter(r => r.playerName === athlete)) {
      if (!r.temDor || !r.dorLocalizada) continue
      const code = r.dorLocalizada.split(' - ')[0].trim(); if (DOR_LABELS[code]) map[code] = (map[code] || 0) + 1
    }
    return map
  }, [bemEstarData, athlete])

  const radarAthlete = useMemo(() => {
    if (!gpsHistory.length) return null
    return {
        distanceRelative: gpsHistory.reduce((s, r) => s + (r.distanceRelative || 0), 0) / gpsHistory.length,
        hsr: gpsHistory.reduce((s, r) => s + (r.hsr || 0), 0) / gpsHistory.length,
        sprintDistance: gpsHistory.reduce((s, r) => s + (r.sprintDistance || 0), 0) / gpsHistory.length,
        accDecel: gpsHistory.reduce((s, r) => s + (r.acceleration || 0) + (r.deceleration || 0), 0) / gpsHistory.length,
        playerLoad: gpsHistory.reduce((s, r) => s + (r.playerLoad || 0), 0) / gpsHistory.length,
        maxVelocity: gpsHistory.reduce((s, r) => s + (r.maxVelocity || 0), 0) / gpsHistory.length,
    }
  }, [gpsHistory])

  const radarGroup = useMemo(() => {
    const rows = gpsData.flatMap(s => s.rows.filter(r => r.playerName !== athlete && r.periodNumber === 0))
    if (!rows.length) return radarAthlete
    return {
        distanceRelative: rows.reduce((s, r) => s + (r.distanceRelative || 0), 0) / rows.length,
        hsr: rows.reduce((s, r) => s + (r.hsr || 0), 0) / rows.length,
        sprintDistance: rows.reduce((s, r) => s + (r.sprintDistance || 0), 0) / rows.length,
        accDecel: rows.reduce((s, r) => s + (r.acceleration || 0) + (r.deceleration || 0), 0) / rows.length,
        playerLoad: rows.reduce((s, r) => s + (r.playerLoad || 0), 0) / rows.length,
        maxVelocity: rows.reduce((s, r) => s + (r.maxVelocity || 0), 0) / rows.length,
    }
  }, [gpsData, athlete, radarAthlete])

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-6">
      <div className="max-w-[1400px] mx-auto flex flex-col gap-6">
        
        {/* HEADER OFICIAL */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <img src="/club/escudonovorizontino.png" alt="Escudo" className="h-16 w-auto" />
            <div>
              <h1 className="text-xl font-black text-black uppercase tracking-tighter leading-none">Grêmio Novorizontino</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Departamento de Fisiologia</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 text-black px-4 py-2 rounded-lg font-black uppercase text-xs tracking-widest shadow-sm">
              Central de Fisiologia
            </div>
            <select value={athlete} onChange={e => setSelectedAthlete(e.target.value)}
              className="border-2 border-slate-200 rounded-lg px-4 py-2 text-sm font-black bg-white focus:outline-none focus:border-amber-500 transition-all">
              {allAthletes.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {/* KPIs ESTILO CARDS HOME */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Último % Vmax</p>
                <div className="flex items-baseline gap-2">
                    <span className={`text-3xl font-black ${vmaxColor(latestVmaxPct)}`}>{latestVmaxPct}%</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">da Ref.</span>
                </div>
                <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">Ref: {vmaxRef.toFixed(1)} km/h</p>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dias sem ≥90%</p>
                <span className={`text-3xl font-black ${daysSinceHighVmax <= 5 ? 'text-green-600' : daysSinceHighVmax <= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                    {daysSinceHighVmax === 99 ? '—' : daysSinceHighVmax}
                </span>
                <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">Sessões registradas</p>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bem-Estar Médio</p>
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-800">{(wellHistory.reduce((a,b)=>a+b.wellnessScore,0)/wellHistory.length || 0).toFixed(1)}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">/ 5.0</span>
                </div>
                <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">Últimas 8 entradas</p>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Carga sRPE</p>
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-800">{srpeHistory[srpeHistory.length-1]?.srpeLoad?.toFixed(0) || '—'}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">UA</span>
                </div>
                <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase">Última sessão</p>
            </div>
        </div>

        {/* GRID PRINCIPAL */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6">Radar de Métricas GPS (Média 8 sessões)</p>
              <PlayerRadarChart athleteData={radarAthlete} compData={radarGroup} compLabel="Média Grupo" />
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6">Carga Semanal sRPE (Últimas 8 sessões)</p>
              <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={srpeHistory.map(r => ({ date: r.date, load: r.srpeLoad }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{fontSize: 9, fontWeight: 'bold', fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fontSize: 9, fontWeight: 'bold', fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                      <CTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Line type="monotone" dataKey="load" stroke="#f59e0b" strokeWidth={4} dot={{r: 5, fill: '#f59e0b', strokeWidth: 2, stroke: 'white'}} activeDot={{r: 8}} />
                  </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-6">Mapa de Dor Localizada</p>
            <AnatomyFigure activeRegions={painCodeMap} hoveredRegion={hoveredRegion} onHover={setHoveredRegion} />
            <div className="mt-8">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Top Regiões de Dor</p>
              <div className="grid grid-cols-1 gap-2">
                  {Object.entries(painCodeMap).sort((a,b)=>b[1]-a[1]).slice(0, 4).map(([code, count]) => (
                      <div key={code} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100 transition-all hover:bg-amber-50">
                          <span className="text-[10px] font-black uppercase text-slate-700">{DOR_LABELS[code] || code}</span>
                          <span className="text-xs font-black text-amber-600 bg-amber-100 px-2 py-1 rounded-lg">{count}×</span>
                      </div>
                  ))}
                  {Object.keys(painCodeMap).length === 0 && <p className="text-xs text-slate-300 italic text-center py-4">Nenhum relato de dor recente.</p>}
              </div>
            </div>
          </div>
        </div>

        {/* HISTÓRICOS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Histórico GPS (8 sessões)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                  <thead>
                      <tr className="border-b-2 border-slate-100">
                          <th className="py-3 font-black uppercase text-slate-400 text-[10px] tracking-widest">Data</th>
                          <th className="py-3 font-black uppercase text-slate-400 text-[10px] tracking-widest">Dist (m)</th>
                          <th className="py-3 font-black uppercase text-slate-400 text-[10px] tracking-widest">HSR (m)</th>
                          <th className="py-3 font-black uppercase text-slate-400 text-[10px] tracking-widest">% Vmax</th>
                      </tr>
                  </thead>
                  <tbody>
                      {[...gpsHistory].reverse().map((r, i) => {
                          const pct = vmaxRef ? calcVmaxPct(r.maxVelocity, vmaxRef) : 0
                          return (
                              <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                  <td className="py-3 font-bold text-slate-600">{r.sessionDate}</td>
                                  <td className="py-3 font-black text-slate-800">{r.totalDistance?.toFixed(0)}</td>
                                  <td className="py-3 font-black text-slate-500">{r.hsr?.toFixed(0)}</td>
                                  <td className={`py-3 font-black ${vmaxColor(pct)}`}>{pct}%</td>
                              </tr>
                          )
                      })}
                  </tbody>
              </table>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Histórico Bem-Estar (8 entradas)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                  <thead>
                      <tr className="border-b-2 border-slate-100">
                          <th className="py-3 font-black uppercase text-slate-400 text-[10px] tracking-widest">Data</th>
                          <th className="py-3 font-black uppercase text-slate-400 text-[10px] tracking-widest">Score</th>
                          <th className="py-3 font-black uppercase text-slate-400 text-[10px] tracking-widest">S/F/D</th>
                          <th className="py-3 font-black uppercase text-slate-400 text-[10px] tracking-widest">Dor</th>
                      </tr>
                  </thead>
                  <tbody>
                      {[...wellHistory].reverse().map((r, i) => (
                          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                              <td className="py-3 font-bold text-slate-600">{r.date}</td>
                              <td className="py-3">
                                  <span className={`px-2 py-1 rounded-lg font-black text-[10px] ${scoreBg(r.wellnessScore)}`}>{r.wellnessScore.toFixed(1)}</span>
                              </td>
                              <td className="py-3 font-bold text-slate-500">{r.sono}/{r.fadiga}/{r.doms}</td>
                              <td className="py-3">
                                  {r.temDor ? <span className="bg-red-100 text-red-600 px-2 py-1 rounded-lg font-black text-[9px] uppercase">Relatada</span> : <span className="text-slate-300">—</span>}
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default function IndividualPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-black text-slate-400 animate-pulse uppercase tracking-widest">Carregando Perfil do Atleta...</div>}>
      <IndividualContent />
    </Suspense>
  )
}
