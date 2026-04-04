'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useData } from '../../context/DataContext'

// ─── FATORES DIÁRIOS (Ravé et al., 2020 – Tabela 4, Semana 2 in-season) ──────
// Multiplicadores aplicados sobre o Gref de cada métrica para cada tipo de dia
// Baseados na distribuição % do GD calculada a partir dos dados do artigo
const DAILY_FACTORS = {
  'GD-5': { totalDistance: 0.50, hsr: 0.20, sprintDistance: 0.10, sprintCount: 0.70, playerLoad: 0.50 },
  'GD-4': { totalDistance: 0.65, hsr: 0.28, sprintDistance: 0.18, sprintCount: 0.86, playerLoad: 0.65 },
  'GD-3': { totalDistance: 0.75, hsr: 0.70, sprintDistance: 0.54, sprintCount: 0.76, playerLoad: 0.75 },
  'GD-2': { totalDistance: 0.45, hsr: 0.28, sprintDistance: 0.18, sprintCount: 0.38, playerLoad: 0.45 },
  'GD-1': { totalDistance: 0.35, hsr: 0.14, sprintDistance: 0.00, sprintCount: 0.28, playerLoad: 0.35 },
  'GD':   { totalDistance: 1.00, hsr: 1.00, sprintDistance: 1.00, sprintCount: 1.00, playerLoad: 1.00 },
  'GD+1': { totalDistance: 0.20, hsr: 0.05, sprintDistance: 0.00, sprintCount: 0.10, playerLoad: 0.20 },
  'GD+2': { totalDistance: 0.30, hsr: 0.10, sprintDistance: 0.05, sprintCount: 0.15, playerLoad: 0.30 },
}

// Fatores semanais (Fw) para escalar a exigência total da semana vs. jogo (Ravé et al.)
// WTL = Fw × Gref → reflete a carga total da semana como múltiplo do Gref
const WEEKLY_FW = {
  'Semana 1 (Fase inicial)':   { totalDistance: 2.8, hsr: 1.8, sprintDistance: 1.4, sprintCount: 3.0, playerLoad: 2.8 },
  'Semana 2 (Carga média)':    { totalDistance: 3.2, hsr: 2.0, sprintDistance: 1.5, sprintCount: 3.4, playerLoad: 3.2 },
  'Semana 3 (Carga alta)':     { totalDistance: 3.4, hsr: 2.2, sprintDistance: 1.5, sprintCount: 3.4, playerLoad: 3.4 },
  'Semana 4 (Descarga)':       { totalDistance: 2.6, hsr: 1.6, sprintDistance: 1.3, sprintCount: 2.8, playerLoad: 2.6 },
}

// Rótulos dos dias do microciclo
const DAY_LABELS = {
  'GD-5': { short: 'GD-5', desc: 'Carga alta', color: 'bg-blue-100 text-blue-800', border: 'border-blue-300' },
  'GD-4': { short: 'GD-4', desc: 'Carga alta', color: 'bg-blue-100 text-blue-800', border: 'border-blue-300' },
  'GD-3': { short: 'GD-3', desc: 'Carga alta + velocidade', color: 'bg-orange-100 text-orange-800', border: 'border-orange-300' },
  'GD-2': { short: 'GD-2', desc: 'Carga média', color: 'bg-yellow-100 text-yellow-800', border: 'border-yellow-300' },
  'GD-1': { short: 'GD-1', desc: 'Ativação/tapering', color: 'bg-green-100 text-green-700', border: 'border-green-300' },
  'GD':   { short: 'JOGO', desc: 'Referência de jogo', color: 'bg-red-100 text-red-800', border: 'border-red-400' },
  'GD+1': { short: 'GD+1', desc: 'Regenerativo', color: 'bg-slate-100 text-slate-500', border: 'border-slate-200' },
  'GD+2': { short: 'GD+2', desc: 'Transição', color: 'bg-slate-100 text-slate-600', border: 'border-slate-200' },
}

const METRICS = [
  { key: 'totalDistance',   label: 'Dist. Total', unit: 'm',     decimals: 0 },
  { key: 'hsr',             label: 'HSR >20km/h', unit: 'm',     decimals: 0 },
  { key: 'sprintDistance',  label: 'Sprint >25',  unit: 'm',     decimals: 0 },
  { key: 'sprintCount',     label: 'Nº Sprints',  unit: '',      decimals: 1 },
  { key: 'playerLoad',      label: 'Player Load', unit: '',      decimals: 0 },
]

function fmt(val, decimals) {
  if (val == null || isNaN(val)) return '—'
  return decimals === 0 ? Math.round(val).toLocaleString('pt-BR') : val.toFixed(decimals)
}

function colorForFactor(f) {
  if (f >= 0.90) return 'bg-red-100 text-red-800 font-black'
  if (f >= 0.60) return 'bg-orange-100 text-orange-800 font-black'
  if (f >= 0.35) return 'bg-yellow-100 text-yellow-800 font-bold'
  return 'bg-slate-100 text-slate-500 font-medium'
}

export default function PlanejamentoCarga() {
  const router = useRouter()
  const { gpsData, playerPositions } = useData()

  const [nJogos, setNJogos]             = useState(3)
  const [fwLabel, setFwLabel]           = useState('Semana 2 (Carga média)')
  const [microDias, setMicroDias]       = useState(['GD-4', 'GD-3', 'GD-2', 'GD-1', 'GD', 'GD+1'])
  const [activeTab, setActiveTab]       = useState('planejamento')
  const [posFilter, setPosFilter]       = useState('todas')

  // ── Filtra apenas sessões de jogo ────────────────────────────────────────────
  const jogoSessions = useMemo(() => {
    return gpsData
      .filter(s => {
        const t = s.metadata?.type || s.metadata?.sessionType || ''
        return t === 'jogo'
      })
      .sort((a, b) => {
        const da = a.date || a.sessionDate || ''
        const db = b.date || b.sessionDate || ''
        return db.localeCompare(da) // mais recentes primeiro
      })
  }, [gpsData])

  const jogosUsados = jogoSessions.slice(0, nJogos)

  // ── Calcula Gref por posição ─────────────────────────────────────────────────
  // Gref = média dos N jogos por posição (só period 0, sem outliers)
  const grefByPosition = useMemo(() => {
    const acc = {} // posição → { metric → [values] }

    for (const session of jogosUsados) {
      const rows0 = session.rows.filter(r => r.periodNumber === 0 && !r.isOutlier && r.playerName)
      for (const row of rows0) {
        // Tenta posição pelo GPS, depois pelo mapa de posições do DataContext
        const pos = (row.positionName?.trim()) || playerPositions[row.playerName] || 'Sem posição'
        if (!acc[pos]) acc[pos] = {}
        for (const m of METRICS) {
          if (!acc[pos][m.key]) acc[pos][m.key] = []
          const v = row[m.key]
          if (v != null && v > 0) acc[pos][m.key].push(v)
        }
      }
    }

    // Converte para médias
    const result = {}
    for (const [pos, metricsMap] of Object.entries(acc)) {
      result[pos] = {}
      for (const m of METRICS) {
        const vals = metricsMap[m.key] || []
        result[pos][m.key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
      }
    }
    return result
  }, [jogosUsados, playerPositions])

  const positions = Object.keys(grefByPosition).sort()
  const displayPositions = posFilter === 'todas' ? positions : positions.filter(p => p === posFilter)

  const fw = WEEKLY_FW[fwLabel]

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function getTarget(pos, metricKey, dayKey) {
    const gref = grefByPosition[pos]?.[metricKey]
    if (gref == null) return null
    if (dayKey === 'GD') return gref
    const factor = DAILY_FACTORS[dayKey]?.[metricKey]
    if (factor == null) return null
    return gref * factor
  }

  function getWTL(pos, metricKey) {
    const gref = grefByPosition[pos]?.[metricKey]
    if (gref == null || !fw) return null
    return gref * fw[metricKey]
  }

  // ── Dia do microciclo: toggle ────────────────────────────────────────────────
  const ALL_DAY_TYPES = ['GD-5', 'GD-4', 'GD-3', 'GD-2', 'GD-1', 'GD', 'GD+1', 'GD+2']
  function toggleDia(day) {
    setMicroDias(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => ALL_DAY_TYPES.indexOf(a) - ALL_DAY_TYPES.indexOf(b))
    )
  }

  const hasData = positions.length > 0
  const hasGames = jogoSessions.length > 0

  return (
    <div className="min-h-screen bg-white text-black p-4 font-sans">
      <div className="max-w-[1700px] mx-auto flex flex-col gap-5">

        {/* HEADER */}
        <header className="flex justify-between items-center border-b-4 border-amber-500 pb-3 flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <img src="/club/escudonovorizontino.png" alt="Escudo" className="h-14 w-auto" />
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-black uppercase leading-none">
                Planejamento de Carga
              </h1>
              <p className="text-sm font-bold tracking-widest text-slate-600 uppercase">
                Gref × Microciclo · Ravé et al., 2020
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push('/fisiologia')}
            className="bg-slate-200 text-slate-800 px-3 py-1 rounded-md text-xs font-bold hover:bg-slate-300 transition-colors"
          >
            ← VOLTAR
          </button>
        </header>

        {/* CONTROLES */}
        <div className="flex flex-wrap items-end gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">

          {/* N jogos */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-amber-800">
              Nº de Jogos p/ Gref
            </label>
            <div className="flex bg-white border border-amber-300 rounded-lg overflow-hidden">
              {[1, 2, 3, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setNJogos(n)}
                  className={`px-4 py-1.5 text-xs font-black transition-all ${
                    nJogos === n ? 'bg-amber-500 text-black' : 'text-slate-500 hover:bg-amber-50'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-amber-700 font-bold">
              {jogosUsados.length} jogo(s) disponível(s) · usando {Math.min(nJogos, jogosUsados.length)}
            </p>
          </div>

          {/* Semana (Fw) */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-amber-800">
              Fase da Temporada (Fw)
            </label>
            <select
              value={fwLabel}
              onChange={e => setFwLabel(e.target.value)}
              className="border border-amber-300 rounded-lg px-3 py-1.5 text-xs font-bold bg-white focus:border-amber-500 focus:outline-none"
            >
              {Object.keys(WEEKLY_FW).map(k => <option key={k}>{k}</option>)}
            </select>
            <p className="text-[9px] text-amber-700 font-bold">Fw Dist: ×{fw?.totalDistance} · HSR: ×{fw?.hsr}</p>
          </div>

          {/* Posição */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-amber-800">Posição</label>
            <select
              value={posFilter}
              onChange={e => setPosFilter(e.target.value)}
              className="border border-amber-300 rounded-lg px-3 py-1.5 text-xs font-bold bg-white focus:border-amber-500 focus:outline-none"
            >
              <option value="todas">Todas</option>
              {positions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Dias do microciclo */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-amber-800">
              Dias do Microciclo
            </label>
            <div className="flex flex-wrap gap-1">
              {ALL_DAY_TYPES.map(day => {
                const active = microDias.includes(day)
                const info = DAY_LABELS[day]
                return (
                  <button
                    key={day}
                    onClick={() => toggleDia(day)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black border-2 transition-all ${
                      active ? `${info.color} ${info.border}` : 'bg-white border-slate-200 text-slate-400'
                    }`}
                  >
                    {info.short}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Metodologia badge */}
          <div className="ml-auto bg-white border border-amber-300 rounded-xl px-4 py-2 text-center">
            <p className="text-[8px] font-black uppercase tracking-widest text-amber-600">Metodologia</p>
            <p className="text-[10px] font-black text-slate-700">Ravé et al. (2020)</p>
            <p className="text-[8px] text-slate-400">Frontiers in Physiology</p>
          </div>
        </div>

        {!hasGames ? (
          <div className="text-center py-16 text-slate-400 font-medium text-sm">
            Nenhuma sessão de jogo encontrada. Carregue um CSV com tipo "Jogo" na página inicial.
          </div>
        ) : (
          <>
            {/* KPIs dos jogos usados */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Jogos usados</p>
                <p className="text-2xl font-black text-red-700">{Math.min(nJogos, jogoSessions.length)}</p>
                <div className="flex flex-col gap-0.5 mt-1">
                  {jogosUsados.slice(0, 3).map(s => (
                    <p key={s.id || s.sessionDate} className="text-[9px] text-slate-500 font-bold truncate">
                      {s.metadata?.opponent ? `vs ${s.metadata.opponent} · ` : ''}{s.date || s.sessionDate}
                    </p>
                  ))}
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Posições detectadas</p>
                <p className="text-2xl font-black text-black">{positions.length}</p>
                <p className="text-[10px] text-slate-400 truncate">{positions.slice(0, 4).join(' · ')}</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Fase selecionada</p>
                <p className="text-sm font-black text-amber-800 leading-tight">{fwLabel.split('(')[0].trim()}</p>
                <p className="text-[10px] text-amber-600 font-bold mt-0.5">WTL ≈ Gref × {fw?.totalDistance}</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Dias no microciclo</p>
                <p className="text-2xl font-black text-green-700">{microDias.length}</p>
                <p className="text-[10px] text-slate-400">{microDias.join(' → ')}</p>
              </div>
            </div>

            {/* TABS */}
            <div className="flex gap-1 border-b border-slate-200">
              {[
                { id: 'planejamento', label: '📋 Planejamento por Dia' },
                { id: 'gref',        label: '🎯 Gref por Posição' },
                { id: 'wtl',         label: '📊 Carga Semanal (WTL)' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ${
                    activeTab === t.id
                      ? 'border-b-2 border-amber-500 text-black'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── TAB: PLANEJAMENTO POR DIA ─────────────────────────────────────── */}
            {activeTab === 'planejamento' && (
              <div className="flex flex-col gap-6">
                {!hasData ? (
                  <p className="text-center py-8 text-slate-400 text-sm">Sem dados de posição nos jogos.</p>
                ) : (
                  <>
                    {/* Uma tabela por posição */}
                    {displayPositions.map(pos => {
                      const gref = grefByPosition[pos]
                      return (
                        <div key={pos} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                          {/* Header da posição */}
                          <div className="bg-slate-900 px-4 py-2.5 flex items-center gap-3">
                            <span className="text-amber-400 font-black text-sm uppercase tracking-widest">{pos}</span>
                            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                              Alvos de treino por dia do microciclo
                            </span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-xs">
                              <thead>
                                <tr className="border-b-2 border-slate-200 bg-slate-50">
                                  <th className="text-left py-2 px-3 font-black text-[10px] uppercase tracking-widest text-slate-500 min-w-[120px]">
                                    Métrica
                                  </th>
                                  <th className="text-center py-2 px-2 font-black text-[10px] uppercase tracking-widest text-red-500 min-w-[90px]">
                                    GREF (Jogo)
                                  </th>
                                  {microDias.filter(d => d !== 'GD').map(day => {
                                    const info = DAY_LABELS[day]
                                    const f = DAILY_FACTORS[day]
                                    return (
                                      <th key={day} className={`text-center py-2 px-2 font-black text-[10px] uppercase tracking-widest min-w-[90px] ${info?.color}`}>
                                        {info?.short}
                                        <div className="font-medium normal-case text-[8px] opacity-70 mt-0.5">{info?.desc}</div>
                                      </th>
                                    )
                                  })}
                                </tr>
                              </thead>
                              <tbody>
                                {METRICS.map((m, mi) => {
                                  const grefVal = gref?.[m.key]
                                  return (
                                    <tr key={m.key} className={`border-b border-slate-100 ${mi % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                      <td className="py-2 px-3 font-bold text-slate-700">
                                        {m.label}
                                        <span className="text-slate-400 font-normal ml-1">{m.unit}</span>
                                      </td>
                                      {/* Gref */}
                                      <td className="text-center py-2 px-2">
                                        <span className="bg-red-100 text-red-800 font-black px-2 py-1 rounded-lg text-xs">
                                          {fmt(grefVal, m.decimals)}
                                        </span>
                                      </td>
                                      {/* Dias de treino */}
                                      {microDias.filter(d => d !== 'GD').map(day => {
                                        const f = DAILY_FACTORS[day]?.[m.key]
                                        const target = grefVal != null && f != null ? grefVal * f : null
                                        // Faixa ±10%
                                        const lo = target != null ? target * 0.90 : null
                                        const hi = target != null ? target * 1.10 : null
                                        return (
                                          <td key={day} className={`text-center py-2 px-2 ${colorForFactor(f || 0)}`}>
                                            {target != null ? (
                                              <div className="flex flex-col items-center">
                                                <span className="text-xs">{fmt(target, m.decimals)}</span>
                                                <span className="text-[8px] opacity-60 font-normal">
                                                  {fmt(lo, m.decimals)}–{fmt(hi, m.decimals)}
                                                </span>
                                              </div>
                                            ) : '—'}
                                          </td>
                                        )
                                      })}
                                    </tr>
                                  )
                                })}
                                {/* Linha dos fatores */}
                                <tr className="border-t-2 border-slate-300 bg-amber-50">
                                  <td className="py-1.5 px-3 text-[9px] font-black uppercase tracking-widest text-amber-700">
                                    Fator (×Gref)
                                  </td>
                                  <td className="text-center py-1.5 px-2 text-[9px] font-black text-red-600">×1.00</td>
                                  {microDias.filter(d => d !== 'GD').map(day => {
                                    const fDist = DAILY_FACTORS[day]?.totalDistance
                                    return (
                                      <td key={day} className="text-center py-1.5 px-2 text-[9px] font-black text-amber-700">
                                        ×{fDist?.toFixed(2) ?? '—'}
                                      </td>
                                    )
                                  })}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    })}

                    {/* Legenda */}
                    <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-500 border-t border-slate-100 pt-3">
                      <span className="text-red-600">🔴 Gref = média dos {Math.min(nJogos, jogoSessions.length)} último(s) jogo(s) por posição</span>
                      <span>Faixa = ±10% do alvo</span>
                      <span>Fatores: Ravé et al. (2020), Frontiers in Physiology, doi: 10.3389/fphys.2020.00944</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── TAB: GREF POR POSIÇÃO ─────────────────────────────────────────── */}
            {activeTab === 'gref' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Game Reference</p>
                    <h2 className="text-xl font-black text-black uppercase leading-none">Gref por Posição</h2>
                  </div>
                  <div className="text-[10px] font-bold text-slate-400">
                    Média de {Math.min(nJogos, jogoSessions.length)} jogo(s) · period 0 · sem outliers
                  </div>
                </div>

                {/* Jogos incluídos */}
                <div className="flex flex-wrap gap-2">
                  {jogosUsados.map((s, i) => (
                    <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
                      <span className="font-black text-slate-700">
                        {s.metadata?.opponent ? `vs ${s.metadata.opponent}` : s.sessionName || 'Jogo'}
                      </span>
                      <span className="text-slate-400 ml-2">{s.date || s.sessionDate}</span>
                      {s.metadata?.result && (
                        <span className={`ml-2 font-black ${
                          s.metadata.result === 'V' ? 'text-green-600' :
                          s.metadata.result === 'D' ? 'text-red-600' : 'text-amber-600'
                        }`}>{s.metadata.result}</span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b-2 border-slate-900">
                        <th className="text-left py-2 px-3 font-black uppercase tracking-widest text-[10px] text-slate-500 min-w-[140px]">Posição</th>
                        {METRICS.map(m => (
                          <th key={m.key} className="text-center py-2 px-3 font-black uppercase tracking-widest text-[10px] text-slate-500 min-w-[100px]">
                            {m.label}<br />
                            <span className="font-medium normal-case text-[9px] text-slate-400">{m.unit}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayPositions.map((pos, idx) => (
                        <tr key={pos} className={`border-b border-slate-100 hover:bg-amber-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                          <td className="py-2.5 px-3 font-black text-black text-xs">{pos}</td>
                          {METRICS.map(m => {
                            const val = grefByPosition[pos]?.[m.key]
                            return (
                              <td key={m.key} className="text-center py-2.5 px-3 font-bold text-slate-800">
                                {fmt(val, m.decimals)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="text-[10px] font-bold text-slate-400 border-t border-slate-100 pt-3">
                  Ravé et al. (2020): Gref = média dos 5 melhores jogos. Aqui usando média dos últimos {Math.min(nJogos, jogoSessions.length)} para maior relevância ao contexto atual.
                </div>
              </div>
            )}

            {/* ── TAB: CARGA SEMANAL (WTL) ──────────────────────────────────────── */}
            {activeTab === 'wtl' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Weekly Training Load</p>
                    <h2 className="text-xl font-black text-black uppercase leading-none">Carga Semanal Total</h2>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
                    <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest">Equação</p>
                    <p className="text-xs font-black text-slate-800">WTL = Fw(i) × Gref</p>
                    <p className="text-[9px] text-slate-400">Ravé et al., 2020 – Eq. 1</p>
                  </div>
                </div>

                {/* Fatores Fw ativos */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {METRICS.map(m => (
                    <div key={m.key} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center">
                      <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">{m.label}</p>
                      <p className="text-lg font-black text-amber-700">×{fw?.[m.key]?.toFixed(1)}</p>
                      <p className="text-[8px] text-slate-400">Fw para {fwLabel.split('(')[0].trim()}</p>
                    </div>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b-2 border-slate-900">
                        <th className="text-left py-2 px-3 font-black uppercase tracking-widest text-[10px] text-slate-500">Posição</th>
                        {METRICS.map(m => (
                          <th key={m.key} className="text-center py-2 px-2 min-w-[110px]">
                            <div className="font-black text-[10px] text-slate-500 uppercase tracking-widest">{m.label}</div>
                            <div className="text-[8px] text-amber-600 font-black">Gref → WTL</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayPositions.map((pos, idx) => (
                        <tr key={pos} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                          <td className="py-2.5 px-3 font-black text-black text-xs">{pos}</td>
                          {METRICS.map(m => {
                            const gref = grefByPosition[pos]?.[m.key]
                            const wtl = getWTL(pos, m.key)
                            return (
                              <td key={m.key} className="text-center py-2 px-2">
                                {gref != null ? (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-[10px] text-slate-400">{fmt(gref, m.decimals)}</span>
                                    <span className="text-amber-600">↓</span>
                                    <span className="font-black text-sm text-black">{fmt(wtl, m.decimals)}</span>
                                  </div>
                                ) : '—'}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Referência da literatura */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-[10px] text-slate-500 font-bold leading-relaxed">
                  <p className="font-black text-slate-700 mb-2 text-xs uppercase tracking-widest">Referência — Ravé et al. (2020)</p>
                  <p>Carga crônica alta em futebol profissional: dist. total acumulada ≈ 111.500 m/semana · HSR+Sprint combinados ≈ 3.727–6.173 m.</p>
                  <p className="mt-1">ACWR recomendado: 0.8–1.3 (zona segura). Aumentos progressivos de ~10% entre semanas mantêm ACWR nessa faixa.</p>
                  <p className="mt-1">DTL = FGD(i) × Gref, onde FGD(i) é o fator ponderado diário definido pelo planejamento tático-físico da semana.</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* FOOTER */}
        <footer className="flex justify-between items-center border-t-2 border-slate-900 pt-3 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              WTL = Fw(i) × Gref · DTL = FGD(i) × Gref · Ravé et al. (2020), Frontiers in Physiology 11:944
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-black italic tracking-tight uppercase">© Fisiologia GN</p>
        </footer>

      </div>
    </div>
  )
}
