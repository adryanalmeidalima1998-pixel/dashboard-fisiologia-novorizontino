'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo } from 'react'
import { useData } from '../../context/DataContext'
import { AthleteAvatar } from '../../utils/athletePhotos'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function parseGpsDate(dateStr) {
  if (!dateStr) return null
  if (dateStr.includes('/')) {
    const [d, m, y] = dateStr.split('/')
    return new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T12:00:00`)
  }
  return new Date(dateStr + 'T12:00:00')
}

function isoDate(d) { return d.toISOString().split('T')[0] }

// Retorna { monday, sunday } de um offset em semanas (0 = semana atual)
function getWeekBounds(offset = 0) {
  const today = new Date()
  const dow = today.getDay() === 0 ? 6 : today.getDay() - 1
  const monday = new Date(today); monday.setDate(today.getDate() - dow + offset * 7); monday.setHours(0,0,0,0)
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23,59,59,999)
  return { monday, sunday }
}

function acwrZone(v) {
  if (v == null) return { label: 'Sem dados', short: '—',    color: '#94a3b8', bg: 'bg-slate-100',  text: 'text-slate-500', ring: 'ring-slate-300' }
  if (v < 0.80)                return { label: 'Destreino',  short: '<0.80', color: '#f59e0b', bg: 'bg-amber-100', text: 'text-amber-700', ring: 'ring-amber-400' }
  if (v <= 1.30)               return { label: 'Zona ideal', short: '0.80–1.30', color: '#16a34a', bg: 'bg-green-100', text: 'text-green-700', ring: 'ring-green-400' }
  if (v <= 1.50)               return { label: 'Atenção',    short: '1.30–1.50', color: '#d97706', bg: 'bg-orange-100', text: 'text-orange-700', ring: 'ring-orange-400' }
  return                              { label: 'Zona perigo', short: '>1.50', color: '#dc2626', bg: 'bg-red-100',   text: 'text-red-700',   ring: 'ring-red-400' }
}

function acwrBarColor(v) {
  if (v == null) return '#cbd5e1'
  if (v < 0.80)  return '#f59e0b'
  if (v <= 1.30) return '#16a34a'
  if (v <= 1.50) return '#ea580c'
  return '#dc2626'
}

function fmt(v, dec = 2) {
  if (v == null || isNaN(v)) return '—'
  return Number(v).toFixed(dec)
}

const METRIC_OPTIONS = [
  { key: 'gps',  label: 'GPS — Distância total (m)', desc: 'Carga externa. Recomendado.' },
  { key: 'srpe', label: 'sRPE × Duração (UA)',        desc: 'Carga interna. Requer formulário pós-treino.' },
]

const ZONE_LEGEND = [
  { label: 'Destreino',  range: '< 0.80',        color: '#f59e0b', bg: 'bg-amber-400' },
  { label: 'Zona ideal', range: '0.80 – 1.30',   color: '#16a34a', bg: 'bg-green-500' },
  { label: 'Atenção',    range: '1.30 – 1.50',   color: '#ea580c', bg: 'bg-orange-500' },
  { label: 'Perigo',     range: '> 1.50',         color: '#dc2626', bg: 'bg-red-500' },
]

// ─── CUSTOM TOOLTIP para o gráfico de tendência ──────────────────────────────
function AcwrTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 shadow-xl rounded-xl p-3 text-xs">
      <p className="font-black text-slate-700 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="font-medium text-slate-600">{p.name}:</span>
          <span className="font-black" style={{ color: p.color }}>
            {p.value != null ? Number(p.value).toFixed(2) : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── PÁGINA ──────────────────────────────────────────────────────────────────
export default function AcwrPage() {
  const router = useRouter()
  const { gpsData, bemEstarData, playerPositions } = useData()

  const [metricKey, setMetricKey]           = useState('gps')
  const [filterPosition, setFilterPosition] = useState('')
  const [selectedAthlete, setSelectedAthlete] = useState(null)
  const [historyWeeks, setHistoryWeeks]     = useState(8)
  const [sortCol, setSortCol]               = useState('acwr')
  const [sortDir, setSortDir]               = useState('desc')

  // ── Posições disponíveis ──────────────────────────────────────────────────
  const availablePositions = useMemo(() => {
    return [...new Set(Object.values(playerPositions).filter(Boolean))].sort()
  }, [playerPositions])

  // ── Lista de atletas unificada ─────────────────────────────────────────────
  const allAthletes = useMemo(() => {
    const names = new Set()
    for (const s of gpsData) for (const r of s.rows) if (r.playerName && !r.isOutlier && r.periodNumber === 0) names.add(r.playerName)
    for (const r of bemEstarData) if (r.playerName) names.add(r.playerName)
    return [...names].sort()
  }, [gpsData, bemEstarData])

  // ── Mapa de carga diária por atleta { name: { 'yyyy-mm-dd': carga } } ─────
  const loadMap = useMemo(() => {
    const map = {}
    if (metricKey === 'gps') {
      for (const session of gpsData) {
        const d = parseGpsDate(session.date)
        if (!d) continue
        const key = isoDate(d)
        for (const row of session.rows) {
          if (row.periodNumber !== 0 || row.isOutlier || !row.totalDistance || row.totalDistance <= 0) continue
          const n = row.playerName
          if (!map[n]) map[n] = {}
          map[n][key] = (map[n][key] || 0) + row.totalDistance
        }
      }
    } else {
      for (const r of bemEstarData) {
        if (r.type !== 'post' || !r.srpeLoad || !r.playerName) continue
        const n = r.playerName
        if (!map[n]) map[n] = {}
        map[n][r.date] = (map[n][r.date] || 0) + r.srpeLoad
      }
    }
    return map
  }, [gpsData, bemEstarData, metricKey])

  // ── ACWR por atleta (semana atual) ────────────────────────────────────────
  const acwrData = useMemo(() => {
    const now = new Date()
    return allAthletes.map(name => {
      const dl = loadMap[name] || {}

      // Aguda: últimos 7 dias
      const acuteStart = new Date(now); acuteStart.setDate(now.getDate() - 6); acuteStart.setHours(0,0,0,0)
      const acuteLoad = Object.entries(dl)
        .filter(([d]) => new Date(d + 'T12:00:00') >= acuteStart)
        .reduce((s, [, v]) => s + v, 0)

      // Crônica: média 4 semanas de 7 dias cada
      const weekLoads = [0, 1, 2, 3].map(w => {
        const wEnd   = new Date(now); wEnd.setDate(now.getDate() - w * 7);       wEnd.setHours(23,59,59,999)
        const wStart = new Date(now); wStart.setDate(now.getDate() - w * 7 - 6); wStart.setHours(0,0,0,0)
        return Object.entries(dl)
          .filter(([d]) => { const dt = new Date(d + 'T12:00:00'); return dt >= wStart && dt <= wEnd })
          .reduce((s, [, v]) => s + v, 0)
      })
      const chronicLoad = weekLoads.reduce((a, b) => a + b, 0) / 4
      const acwr = chronicLoad > 0 ? acuteLoad / chronicLoad : null

      // Monotonia e strain (base GPS ou sRPE da semana atual)
      const { monday, sunday } = getWeekBounds(0)
      const weekDailyLoads = []
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday); d.setDate(monday.getDate() + i)
        weekDailyLoads.push(dl[isoDate(d)] || 0)
      }
      const weekSum = weekDailyLoads.reduce((a, b) => a + b, 0)
      const mean = weekSum / 7
      const sd = Math.sqrt(weekDailyLoads.map(v => Math.pow(v - mean, 2)).reduce((a, b) => a + b, 0) / 7)
      const monotony = sd > 0 ? mean / sd : null
      const strain = weekSum > 0 && monotony ? weekSum * monotony : null

      // Dias desde o último registro
      const lastDate = Object.keys(dl).sort().reverse()[0]
      const daysSinceLast = lastDate
        ? Math.round((Date.now() - new Date(lastDate + 'T12:00:00').getTime()) / 86400000)
        : null

      return {
        name,
        position: playerPositions[name] || null,
        acuteLoad,
        chronicLoad,
        acwr,
        weekLoads,
        monotony,
        strain,
        daysSinceLast,
        zone: acwrZone(acwr),
      }
    })
  }, [allAthletes, loadMap, playerPositions])

  // ── Tendência histórica por atleta (N semanas) ────────────────────────────
  const trendData = useMemo(() => {
    if (!selectedAthlete) return []
    const dl = loadMap[selectedAthlete] || {}
    const now = new Date()
    const weeks = []
    for (let w = historyWeeks - 1; w >= 0; w--) {
      const wEnd   = new Date(now); wEnd.setDate(now.getDate() - w * 7);       wEnd.setHours(23,59,59,999)
      const wStart = new Date(now); wStart.setDate(now.getDate() - w * 7 - 6); wStart.setHours(0,0,0,0)
      const acute = Object.entries(dl)
        .filter(([d]) => { const dt = new Date(d + 'T12:00:00'); return dt >= wStart && dt <= wEnd })
        .reduce((s, [, v]) => s + v, 0)
      // Crônica para aquela semana
      const prevWeeks = [0,1,2,3].map(pw => {
        const pEnd   = new Date(wEnd);   pEnd.setDate(wEnd.getDate() - pw * 7)
        const pStart = new Date(pEnd);   pStart.setDate(pEnd.getDate() - 6); pStart.setHours(0,0,0,0)
        return Object.entries(dl)
          .filter(([d]) => { const dt = new Date(d + 'T12:00:00'); return dt >= pStart && dt <= pEnd })
          .reduce((s, [, v]) => s + v, 0)
      })
      const chronic = prevWeeks.reduce((a, b) => a + b, 0) / 4
      const acwrVal = chronic > 0 ? acute / chronic : null
      const label = wStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
      weeks.push({ label, acute, chronic, acwr: acwrVal })
    }
    return weeks
  }, [selectedAthlete, loadMap, historyWeeks])

  // ── Tendência de TODA A EQUIPE (média ACWR) ────────────────────────────────
  const teamTrendData = useMemo(() => {
    if (selectedAthlete) return []
    const now = new Date()
    const weeks = []
    for (let w = historyWeeks - 1; w >= 0; w--) {
      const wEnd   = new Date(now); wEnd.setDate(now.getDate() - w * 7);       wEnd.setHours(23,59,59,999)
      const wStart = new Date(now); wStart.setDate(now.getDate() - w * 7 - 6); wStart.setHours(0,0,0,0)
      const label = wStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

      const acwrValues = allAthletes.map(name => {
        const dl = loadMap[name] || {}
        const acute = Object.entries(dl)
          .filter(([d]) => { const dt = new Date(d + 'T12:00:00'); return dt >= wStart && dt <= wEnd })
          .reduce((s, [, v]) => s + v, 0)
        const prevWeeks = [0,1,2,3].map(pw => {
          const pEnd   = new Date(wEnd);   pEnd.setDate(wEnd.getDate() - pw * 7)
          const pStart = new Date(pEnd);   pStart.setDate(pEnd.getDate() - 6); pStart.setHours(0,0,0,0)
          return Object.entries(dl)
            .filter(([d]) => { const dt = new Date(d + 'T12:00:00'); return dt >= pStart && dt <= pEnd })
            .reduce((s, [, v]) => s + v, 0)
        })
        const chronic = prevWeeks.reduce((a, b) => a + b, 0) / 4
        return chronic > 0 ? acute / chronic : null
      }).filter(v => v != null)

      const teamAvg = acwrValues.length ? acwrValues.reduce((a, b) => a + b, 0) / acwrValues.length : null
      const inDanger = acwrValues.filter(v => v > 1.5).length
      weeks.push({ label, acwr: teamAvg, inDanger })
    }
    return weeks
  }, [selectedAthlete, allAthletes, loadMap, historyWeeks])

  const chartData = selectedAthlete ? trendData : teamTrendData

  // ── Distribuição por zona ─────────────────────────────────────────────────
  const zoneDist = useMemo(() => {
    const filtered = acwrData.filter(a => !filterPosition || a.position === filterPosition)
    return {
      semDados: filtered.filter(a => a.acwr == null).length,
      destreino: filtered.filter(a => a.acwr != null && a.acwr < 0.80).length,
      ideal:     filtered.filter(a => a.acwr != null && a.acwr >= 0.80 && a.acwr <= 1.30).length,
      atencao:   filtered.filter(a => a.acwr != null && a.acwr > 1.30 && a.acwr <= 1.50).length,
      perigo:    filtered.filter(a => a.acwr != null && a.acwr > 1.50).length,
      total:     filtered.length,
    }
  }, [acwrData, filterPosition])

  // ── Lista filtrada + ordenada ─────────────────────────────────────────────
  const displayed = useMemo(() => {
    let list = [...acwrData]
    if (filterPosition) list = list.filter(a => a.position === filterPosition)
    list.sort((a, b) => {
      let va, vb
      if (sortCol === 'name')       { va = a.name;       vb = b.name; return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va) }
      if (sortCol === 'acwr')       { va = a.acwr ?? -1;  vb = b.acwr ?? -1 }
      if (sortCol === 'acute')      { va = a.acuteLoad;   vb = b.acuteLoad }
      if (sortCol === 'chronic')    { va = a.chronicLoad; vb = b.chronicLoad }
      if (sortCol === 'monotony')   { va = a.monotony ?? 0; vb = b.monotony ?? 0 }
      if (sortCol === 'strain')     { va = a.strain ?? 0;   vb = b.strain ?? 0 }
      if (sortCol === 'days')       { va = a.daysSinceLast ?? 999; vb = b.daysSinceLast ?? 999 }
      return sortDir === 'asc' ? va - vb : vb - va
    })
    return list
  }, [acwrData, filterPosition, sortCol, sortDir])

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortCol(col); setSortDir('desc') }
  }

  function SortTh({ label, col, className = '' }) {
    const active = sortCol === col
    return (
      <th
        onClick={() => toggleSort(col)}
        className={`py-2 px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:text-amber-600 select-none whitespace-nowrap text-left ${className}`}
      >
        {label}
        <span className="text-[8px] ml-0.5 opacity-50">{active ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ' ↕'}</span>
      </th>
    )
  }

  // ── Atleta selecionado ────────────────────────────────────────────────────
  const selectedData = selectedAthlete ? acwrData.find(a => a.name === selectedAthlete) : null

  const unitLabel = metricKey === 'gps' ? 'm' : 'UA'

  return (
    <div className="min-h-screen bg-white text-black p-4 font-sans">
      <div className="max-w-[1400px] mx-auto flex flex-col gap-5">

        {/* HEADER */}
        <header className="flex justify-between items-center border-b-4 border-amber-500 pb-3">
          <div className="flex items-center gap-4">
            <img src="/club/escudonovorizontino.png" alt="Escudo" className="h-14 w-auto" />
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-black uppercase leading-none">ACWR</h1>
              <p className="text-sm font-bold tracking-widest text-slate-600 uppercase">Razão Carga Aguda : Crônica</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/fisiologia')}
            className="bg-slate-200 text-slate-800 px-3 py-1 rounded-md text-xs font-bold hover:bg-slate-300 transition-colors"
          >
            ← Voltar
          </button>
        </header>

        {/* CONTROLES */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Métrica */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Carga:</span>
            <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
              {METRIC_OPTIONS.map(m => (
                <button
                  key={m.key}
                  onClick={() => setMetricKey(m.key)}
                  title={m.desc}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${metricKey === m.key ? 'bg-amber-500 text-black shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {m.key === 'gps' ? '📡 GPS Distância' : '💓 sRPE × Min'}
                </button>
              ))}
            </div>
          </div>

          {/* Posição */}
          {availablePositions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Posição:</span>
              <select
                value={filterPosition}
                onChange={e => setFilterPosition(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-black bg-white text-slate-700 uppercase tracking-widest focus:border-amber-400 focus:outline-none"
              >
                <option value="">Todas</option>
                {availablePositions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}

          {/* Semanas no gráfico */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Histórico:</span>
            {[4, 8, 12, 16].map(w => (
              <button
                key={w}
                onClick={() => setHistoryWeeks(w)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${historyWeeks === w ? 'bg-amber-500 text-black' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                {w}sem
              </button>
            ))}
          </div>
        </div>

        {/* KPI ZONAS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: '🟢 Zona ideal',  value: zoneDist.ideal,     bg: 'bg-green-50 border-green-200',   text: 'text-green-700',  sub: '0.80 – 1.30' },
            { label: '🟡 Destreino',   value: zoneDist.destreino, bg: 'bg-amber-50 border-amber-200',   text: 'text-amber-700',  sub: '< 0.80' },
            { label: '🟠 Atenção',     value: zoneDist.atencao,   bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', sub: '1.30 – 1.50' },
            { label: '🔴 Perigo',      value: zoneDist.perigo,    bg: 'bg-red-50 border-red-200',       text: 'text-red-700',    sub: '> 1.50' },
          ].map(k => (
            <div key={k.label} className={`border rounded-xl p-3 ${k.bg}`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{k.label}</p>
              <p className={`text-3xl font-black ${k.text}`}>{k.value}</p>
              <p className="text-[9px] text-slate-500">de {zoneDist.total} atletas · ACWR {k.sub}</p>
            </div>
          ))}
        </div>

        {/* GRÁFICO DE TENDÊNCIA */}
        <div className="border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-black">
                {selectedAthlete ? `Tendência ACWR — ${selectedAthlete.split(' ').slice(0,2).join(' ')}` : 'Tendência ACWR — Equipe (média)'}
              </p>
              <p className="text-[10px] text-slate-500 font-medium">Últimas {historyWeeks} semanas · {METRIC_OPTIONS.find(m => m.key === metricKey)?.label}</p>
            </div>
            {selectedAthlete && (
              <button
                onClick={() => setSelectedAthlete(null)}
                className="text-[10px] font-black text-slate-500 hover:text-amber-600 bg-slate-100 hover:bg-amber-50 px-3 py-1.5 rounded-lg transition-all uppercase tracking-widest"
              >
                ✕ Ver equipe
              </button>
            )}
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[0, 'auto']} />
              <RTooltip content={<AcwrTooltip />} />
              {/* Zonas de referência */}
              <ReferenceLine y={0.80} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1}
                label={{ value: '0.80', position: 'insideTopLeft', fontSize: 9, fill: '#f59e0b', fontWeight: 'bold' }} />
              <ReferenceLine y={1.30} stroke="#16a34a" strokeDasharray="4 2" strokeWidth={1}
                label={{ value: '1.30', position: 'insideTopLeft', fontSize: 9, fill: '#16a34a', fontWeight: 'bold' }} />
              <ReferenceLine y={1.50} stroke="#dc2626" strokeDasharray="4 2" strokeWidth={1}
                label={{ value: '1.50', position: 'insideTopLeft', fontSize: 9, fill: '#dc2626', fontWeight: 'bold' }} />
              <Line
                type="monotone"
                dataKey="acwr"
                name="ACWR"
                stroke="#f59e0b"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>

          {/* Legenda de zonas */}
          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-100">
            {ZONE_LEGEND.map(z => (
              <div key={z.label} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${z.bg}`} />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{z.label}</span>
                <span className="text-[9px] text-slate-400">ACWR {z.range}</span>
              </div>
            ))}
          </div>
        </div>

        {/* TABELA DE ATLETAS */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-widest text-black">
              Atletas — {displayed.length} {filterPosition ? `· ${filterPosition}` : ''}
            </p>
            <p className="text-[10px] text-slate-400 font-medium">Clique num atleta para ver a tendência individual</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <SortTh label="Atleta"     col="name"     className="min-w-[160px]" />
                  <th className="py-2 px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-left">Posição</th>
                  <SortTh label="ACWR"       col="acwr" />
                  <th className="py-2 px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-left">Zona</th>
                  <SortTh label={`Aguda (${unitLabel})`}   col="acute" />
                  <SortTh label={`Crônica (${unitLabel})`} col="chronic" />
                  <SortTh label="Monotonia"  col="monotony" />
                  <SortTh label="Strain"     col="strain" />
                  <SortTh label="Dias s/ dado" col="days" />
                  <th className="py-2 px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-left">Semana (7d)</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((a, i) => {
                  const isSelected = selectedAthlete === a.name
                  const z = a.zone
                  const barMax = Math.max(...displayed.map(x => x.acwr ?? 0), 1.6)
                  const barPct = a.acwr != null ? Math.min((a.acwr / barMax) * 100, 100) : 0

                  return (
                    <tr
                      key={a.name}
                      onClick={() => setSelectedAthlete(isSelected ? null : a.name)}
                      className={`border-b border-slate-50 cursor-pointer transition-all ${isSelected ? 'bg-amber-50 border-amber-200' : 'hover:bg-slate-50'} ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}
                    >
                      {/* Atleta */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <AthleteAvatar name={a.name} size="w-7 h-7" />
                          <span className="font-black text-black truncate max-w-[120px]">
                            {a.name.split(' ').slice(0, 2).join(' ')}
                          </span>
                        </div>
                      </td>

                      {/* Posição */}
                      <td className="py-2.5 px-3">
                        {a.position ? (
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {a.position}
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>

                      {/* ACWR + barra */}
                      <td className="py-2.5 px-3 min-w-[100px]">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm" style={{ color: acwrBarColor(a.acwr), minWidth: '36px' }}>
                            {fmt(a.acwr)}
                          </span>
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[40px]">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${barPct}%`, backgroundColor: acwrBarColor(a.acwr) }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Zona */}
                      <td className="py-2.5 px-3">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${z.bg} ${z.text}`}>
                          {z.label}
                        </span>
                      </td>

                      {/* Aguda */}
                      <td className="py-2.5 px-3 font-black text-black">{fmt(a.acuteLoad, 0)}</td>

                      {/* Crônica */}
                      <td className="py-2.5 px-3 text-slate-600 font-medium">{fmt(a.chronicLoad, 0)}</td>

                      {/* Monotonia */}
                      <td className="py-2.5 px-3">
                        <span className={`font-black ${!a.monotony ? 'text-slate-400' : a.monotony < 1.5 ? 'text-green-600' : a.monotony < 2.0 ? 'text-amber-600' : 'text-red-600'}`}>
                          {fmt(a.monotony)}
                        </span>
                      </td>

                      {/* Strain */}
                      <td className="py-2.5 px-3 text-slate-600 font-medium">{fmt(a.strain, 0)}</td>

                      {/* Dias sem dado */}
                      <td className="py-2.5 px-3">
                        {a.daysSinceLast != null ? (
                          <span className={`font-black ${a.daysSinceLast <= 3 ? 'text-green-600' : a.daysSinceLast <= 7 ? 'text-amber-600' : 'text-red-500'}`}>
                            {a.daysSinceLast}d
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>

                      {/* Mini sparkline da semana (barras de 7 dias) */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-end gap-0.5 h-5">
                          {a.weekLoads.map((v, idx) => {
                            const maxV = Math.max(...a.weekLoads, 1)
                            const pct = Math.round((v / maxV) * 100)
                            return (
                              <div
                                key={idx}
                                className="w-2 rounded-sm transition-all"
                                style={{
                                  height: `${Math.max(pct, 4)}%`,
                                  backgroundColor: v > 0 ? acwrBarColor(a.acwr) : '#e2e8f0',
                                  opacity: idx === 0 ? 1 : 0.55 + idx * 0.075,
                                }}
                              />
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* PAINEL DO ATLETA SELECIONADO */}
        {selectedData && (
          <div className={`border-2 ${selectedData.zone.ring} ring-2 rounded-2xl p-5 ${selectedData.zone.bg}`}>
            <div className="flex items-center gap-4 mb-4 flex-wrap">
              <AthleteAvatar name={selectedData.name} size="w-12 h-12" ring />
              <div>
                <p className="text-base font-black text-black uppercase tracking-tighter">{selectedData.name}</p>
                <p className={`text-[11px] font-black uppercase tracking-widest ${selectedData.zone.text}`}>
                  {selectedData.zone.label} — ACWR {fmt(selectedData.acwr)}
                </p>
              </div>
              <button
                onClick={() => router.push(`/fisiologia/individual?atleta=${encodeURIComponent(selectedData.name)}`)}
                className="ml-auto bg-black text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-black transition-all"
              >
                Ver perfil completo →
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Carga aguda (7d)',   value: `${fmt(selectedData.acuteLoad, 0)} ${unitLabel}`,  sub: 'soma últimos 7 dias' },
                { label: 'Carga crônica',      value: `${fmt(selectedData.chronicLoad, 0)} ${unitLabel}`, sub: 'média 4 semanas' },
                { label: 'Monotonia',          value: fmt(selectedData.monotony),                        sub: 'média diária / DP' },
                { label: 'Strain',             value: fmt(selectedData.strain, 0),                       sub: 'carga × monotonia' },
              ].map(k => (
                <div key={k.label} className="bg-white/70 rounded-xl p-3 border border-white/60">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">{k.label}</p>
                  <p className="text-xl font-black text-black leading-none">{k.value}</p>
                  <p className="text-[9px] text-slate-500 mt-0.5">{k.sub}</p>
                </div>
              ))}
            </div>

            {/* Distribuição de carga nas últimas 4 semanas */}
            <div className="mt-4 pt-4 border-t border-black/10">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2">Carga por semana (4 semanas)</p>
              <div className="flex items-end gap-3">
                {selectedData.weekLoads.map((v, i) => {
                  const maxV = Math.max(...selectedData.weekLoads, 1)
                  const pct = Math.max((v / maxV) * 100, 4)
                  const labels = ['Sem -3', 'Sem -2', 'Sem -1', 'Esta sem.']
                  return (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1">
                      <span className="text-[9px] font-black text-slate-600">{fmt(v, 0)}</span>
                      <div className="w-full rounded-t-md transition-all" style={{ height: `${pct * 0.8}px`, backgroundColor: i === 3 ? acwrBarColor(selectedData.acwr) : '#cbd5e1' }} />
                      <span className="text-[8px] font-bold text-slate-500 whitespace-nowrap">{labels[i]}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Interpretação */}
            <div className="mt-3 pt-3 border-t border-black/10">
              <p className="text-[10px] text-slate-600 font-medium leading-relaxed">
                {selectedData.acwr == null
                  ? 'Sem histórico GPS suficiente para calcular o ACWR. Registre ao menos 2 semanas de dados.'
                  : selectedData.acwr < 0.80
                  ? `ACWR ${fmt(selectedData.acwr)} — atleta abaixo da zona ideal. Carga aguda muito baixa em relação à base. Risco de perda de condição e lesão por desuso.`
                  : selectedData.acwr <= 1.30
                  ? `ACWR ${fmt(selectedData.acwr)} — zona ideal. Carga aguda equilibrada com a base crônica. Menor risco de lesão por sobrecarga.`
                  : selectedData.acwr <= 1.50
                  ? `ACWR ${fmt(selectedData.acwr)} — atenção. Carga aguda acima do ideal. Monitorar sinais de fadiga e bem-estar nos próximos dias.`
                  : `ACWR ${fmt(selectedData.acwr)} — zona de perigo. Carga aguda excessiva frente à base crônica. Risco elevado de lesão por sobrecarga. Considerar redução de volume.`
                }
                {selectedData.monotony != null && selectedData.monotony >= 2.0 && ` Monotonia alta (${fmt(selectedData.monotony)}) — variar os estímulos durante a semana.`}
              </p>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <footer className="flex justify-between items-center border-t-2 border-slate-900 pt-3 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              ACWR = carga aguda 7d / média crônica 4 semanas · Monotonia = média diária / desvio padrão · Strain = carga semanal × monotonia
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-black italic tracking-tight uppercase">© Fisiologia GN</p>
        </footer>
      </div>
    </div>
  )
}
