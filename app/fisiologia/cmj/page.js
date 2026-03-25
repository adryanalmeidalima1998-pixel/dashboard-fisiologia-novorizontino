'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { useData, normalizeName } from '../../context/DataContext'
import { AthleteAvatar } from '../../utils/athletePhotos'

// ─── ZONAS ───────────────────────────────────────────────────────────────────
const ZONES = [
  { label: 'Normal',          range: '0 a -5%',    color: '#10b981', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', action: 'Treino normal'    },
  { label: 'Atenção',         range: '-5 a -10%',  color: '#f59e0b', bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-400',   action: 'Ajuste leve'     },
  { label: 'Fadiga Moderada', range: '-10 a -15%', color: '#f97316', bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-700',  badge: 'bg-orange-100 text-orange-700',   dot: 'bg-orange-500',  action: 'Reduzir carga'   },
  { label: 'Alto Risco',      range: '> -15%',     color: '#ef4444', bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     badge: 'bg-red-100 text-red-700',         dot: 'bg-red-500',     action: 'Modificar treino' },
]

function getZone(pct) {
  if (pct === null || pct === undefined) return null
  if (pct >= -5)  return ZONES[0]
  if (pct >= -10) return ZONES[1]
  if (pct >= -15) return ZONES[2]
  return ZONES[3]
}

// Fadiga (%) = ((média saltos - melhor salto) / melhor salto) × 100
function calcFadiga(media, melhorSalto) {
  if (!media || !melhorSalto) return null
  return Math.round(((media - melhorSalto) / melhorSalto) * 1000) / 10
}

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ─── INTEGRAÇÃO GPS: HSR + Sprint dos últimos 2 dias ─────────────────────────
function getGpsLast2Days(gpsData, athleteName, referenceDate) {
  const norm    = normalizeName(athleteName)
  const refDate = referenceDate ? new Date(referenceDate) : new Date()
  const cutoff  = new Date(refDate)
  cutoff.setDate(cutoff.getDate() - 2)
  cutoff.setHours(0, 0, 0, 0)

  let totalHsr    = 0
  let totalSprint = 0
  let sessions    = 0

  for (const session of gpsData) {
    // parseia data da sessão (formato "DD/MM/YYYY" do Catapult)
    let sessionDate
    if (session.date?.includes('/')) {
      const [d, m, y] = session.date.split('/')
      sessionDate = new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T12:00:00`)
    } else {
      sessionDate = new Date(session.date + 'T12:00:00')
    }

    if (sessionDate < cutoff || sessionDate > refDate) continue

    for (const row of session.rows) {
      if (normalizeName(row.playerName) !== norm) continue
      totalHsr    += row.hsr           || 0
      totalSprint += row.sprintDistance || 0
      sessions++
    }
  }

  if (sessions === 0) return null
  return { hsr: Math.round(totalHsr), sprint: Math.round(totalSprint), sessions }
}

// Alerta: alta carga GPS + queda CMJ
function hasHighLoadAlert(gpsLast2, pct) {
  if (!gpsLast2 || pct === null) return false
  return gpsLast2.hsr > 1500 && pct <= -10
}

// ─── COMPONENTE ───────────────────────────────────────────────────────────────
export default function CMJPage() {
  const router = useRouter()
  const { gpsData, excludedNamesNorm } = useData()

  const [baselines,  setBaselines]  = useState([])
  const [coletas,    setColetas]    = useState([])
  const [isLoading,  setIsLoading]  = useState(true)
  const [fetchError, setFetchError] = useState(null)

  const [activeTab, setActiveTab] = useState('semaforo')

  // form coleta
  const [colAtleta,  setColAtleta]  = useState('')
  const [colData,    setColData]    = useState(() => new Date().toISOString().split('T')[0])
  const [colS1,      setColS1]      = useState('')
  const [colS2,      setColS2]      = useState('')
  const [colS3,      setColS3]      = useState('')
  const [colSaving,  setColSaving]  = useState(false)
  const [colError,   setColError]   = useState(null)
  const [colSuccess, setColSuccess] = useState(false)

  // form baseline
  const [blAtleta,   setBlAtleta]   = useState('')
  const [blMelhor,   setBlMelhor]   = useState('')
  const [blData,     setBlData]     = useState('')
  const [blSaving,   setBlSaving]   = useState(false)
  const [blError,    setBlError]    = useState(null)
  const [blSuccess,  setBlSuccess]  = useState(false)

  const [focusedAthlete, setFocusedAthlete] = useState(null)
  const [confirmDel,     setConfirmDel]     = useState(null)
  const [deleting,       setDeleting]       = useState(null)

  // ── Elenco vindo do GPS ────────────────────────────────────────────────────
  const athletes = useMemo(() => {
    const names = new Set()
    for (const session of gpsData) {
      for (const row of session.rows) {
        const name = row.playerName?.trim()
        if (!name) continue
        if (excludedNamesNorm?.has(normalizeName(name))) continue
        names.add(name)
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [gpsData, excludedNamesNorm])

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/cmj')
      if (!res.ok) throw new Error('Erro ao buscar dados')
      const data = await res.json()
      setBaselines(data.baselines || [])
      setColetas(data.coletas   || [])
    } catch (e) {
      setFetchError(e.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Mapa de baselines ─────────────────────────────────────────────────────
  const baselineMap = useMemo(() => {
    const map = {}
    for (const b of baselines) map[normalizeName(b.athlete_name)] = b
    return map
  }, [baselines])

  // ── Status do elenco com GPS integrado ────────────────────────────────────
  const athleteStatus = useMemo(() => {
    return athletes.map(name => {
      const norm     = normalizeName(name)
      const baseline = baselineMap[norm] || null
      const minhasColetas = coletas.filter(c => normalizeName(c.athlete_name) === norm)
      const ultima   = minhasColetas[0] || null

      const pct  = ultima && baseline ? calcFadiga(ultima.media, baseline.melhor_salto) : null
      const zone = getZone(pct)

      // GPS: HSR + Sprint últimos 2 dias (a partir da data da coleta ou hoje)
      const refDate   = ultima?.data_coleta ? new Date(ultima.data_coleta).toISOString().split('T')[0] : null
      const gpsLast2  = getGpsLast2Days(gpsData, name, refDate)
      const highLoad  = hasHighLoadAlert(gpsLast2, pct)

      return { name, baseline, ultima, pct, zone, coletas: minhasColetas, gpsLast2, highLoad }
    })
  }, [athletes, baselineMap, coletas, gpsData])

  const sortedStatus = useMemo(() => {
    const order = { 'Alto Risco': 0, 'Fadiga Moderada': 1, 'Atenção': 2, 'Normal': 3 }
    return [...athleteStatus].sort((a, b) => {
      const ao = a.zone ? order[a.zone.label] : (a.baseline ? 4 : 5)
      const bo = b.zone ? order[b.zone.label] : (b.baseline ? 4 : 5)
      return ao - bo
    })
  }, [athleteStatus])

  const zoneCounts = useMemo(() => {
    const c = { 'Normal': 0, 'Atenção': 0, 'Fadiga Moderada': 0, 'Alto Risco': 0 }
    for (const a of athleteStatus) if (a.zone) c[a.zone.label]++
    return c
  }, [athleteStatus])

  const alertCount = useMemo(() => athleteStatus.filter(a => a.highLoad).length, [athleteStatus])

  // ── Preview coleta ─────────────────────────────────────────────────────────
  const colMedia = useMemo(() => {
    const vals = [parseFloat(colS1), parseFloat(colS2), parseFloat(colS3)].filter(v => !isNaN(v) && v > 0)
    if (!vals.length) return null
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
  }, [colS1, colS2, colS3])

  const colBaseline = colAtleta ? baselineMap[normalizeName(colAtleta)] : null
  const previewPct  = colMedia && colBaseline ? calcFadiga(colMedia, colBaseline.melhor_salto) : null
  const previewZone = getZone(previewPct)

  // GPS do atleta selecionado no formulário (últimos 2 dias)
  const colGps = useMemo(() => {
    if (!colAtleta) return null
    return getGpsLast2Days(gpsData, colAtleta, colData)
  }, [colAtleta, colData, gpsData])

  // ── Submit coleta ──────────────────────────────────────────────────────────
  const submitColeta = async () => {
    if (!colAtleta) return setColError('Selecione um atleta.')
    if (!colMedia)  return setColError('Insira pelo menos 1 valor de salto válido.')
    setColError(null); setColSaving(true)
    try {
      const res = await fetch('/api/cmj', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'coleta',
          athlete_name: colAtleta,
          data_coleta:  colData,
          salto_1: parseFloat(colS1) || null,
          salto_2: parseFloat(colS2) || null,
          salto_3: parseFloat(colS3) || null,
          media: colMedia,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setColS1(''); setColS2(''); setColS3('')
      setColSuccess(true)
      setTimeout(() => setColSuccess(false), 3000)
      setFocusedAthlete(colAtleta)
      setActiveTab('semaforo')
      await fetchAll()
    } catch (e) {
      setColError(e.message)
    } finally {
      setColSaving(false)
    }
  }

  // ── Submit baseline ────────────────────────────────────────────────────────
  const submitBaseline = async () => {
    if (!blAtleta) return setBlError('Selecione um atleta.')
    if (!blMelhor) return setBlError('Informe o melhor salto.')
    setBlError(null); setBlSaving(true)
    try {
      const res = await fetch('/api/cmj', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'baseline',
          athlete_name:   blAtleta,
          melhor_salto:   parseFloat(blMelhor),
          data_avaliacao: blData || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setBlMelhor(''); setBlData('')
      setBlSuccess(true)
      setTimeout(() => setBlSuccess(false), 3000)
      await fetchAll()
    } catch (e) {
      setBlError(e.message)
    } finally {
      setBlSaving(false)
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirmDel) return
    setDeleting(confirmDel.id)
    try {
      await fetch(`/api/cmj/${confirmDel.id}?table=${confirmDel.table}`, { method: 'DELETE' })
      await fetchAll()
    } finally {
      setDeleting(null)
      setConfirmDel(null)
    }
  }

  const focusedData = useMemo(() =>
    focusedAthlete ? athleteStatus.find(a => a.name === focusedAthlete) : null,
    [focusedAthlete, athleteStatus]
  )

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button
            onClick={() => router.push('/fisiologia')}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-slate-800 leading-tight">Índice de Fadiga — CMJ</h1>
            <p className="text-xs text-slate-400">Coleta Diária · Counter Movement Jump · GPS integrado</p>
          </div>
          {alertCount > 0 && (
            <div className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <span>⚠</span> {alertCount} alerta{alertCount > 1 ? 's' : ''} GPS
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-4">

        {/* Cards de zona */}
        <div className="grid grid-cols-4 gap-2">
          {ZONES.map(z => (
            <div key={z.label} className={`rounded-xl border-2 p-3 ${z.bg} ${z.border}`}>
              <p className={`text-xs font-semibold ${z.text}`}>{z.label}</p>
              <p className={`text-3xl font-black ${z.text} mt-0.5`}>{zoneCounts[z.label] ?? 0}</p>
              <p className={`text-xs mt-1 ${z.text} opacity-70`}>{z.action}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {[
            { key: 'semaforo',  label: '🚦 Semáforo'        },
            { key: 'registrar', label: '📥 Registrar Coleta' },
            { key: 'baseline',  label: '📐 Baselines'        },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === t.key
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── ABA SEMÁFORO ── */}
        {activeTab === 'semaforo' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="py-16 text-center text-slate-400 text-sm">Carregando...</div>
            ) : fetchError ? (
              <div className="py-16 text-center text-red-400 text-sm">{fetchError}</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-slate-400 uppercase tracking-wide bg-slate-50 border-b border-slate-100">
                        <th className="text-left   px-4 py-3 font-medium">Atleta</th>
                        <th className="text-center px-3 py-3 font-medium">Baseline</th>
                        <th className="text-center px-3 py-3 font-medium">Coleta</th>
                        <th className="text-center px-3 py-3 font-medium">Média CMJ</th>
                        <th className="text-center px-3 py-3 font-medium">Fadiga</th>
                        <th className="text-center px-3 py-3 font-medium">Zona</th>
                        <th className="text-center px-3 py-3 font-medium">HSR 2d</th>
                        <th className="text-center px-3 py-3 font-medium">Sprint 2d</th>
                        <th className="text-center px-3 py-3 font-medium">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {sortedStatus.map(({ name, baseline, ultima, pct, zone, gpsLast2, highLoad }) => (
                        <tr
                          key={name}
                          onClick={() => setFocusedAthlete(focusedAthlete === name ? null : name)}
                          className={`cursor-pointer transition-colors ${
                            focusedAthlete === name
                              ? 'bg-blue-50'
                              : highLoad
                              ? 'bg-red-50/40 hover:bg-red-50'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <AthleteAvatar name={name} size={30} />
                              <div>
                                <span className="text-xs font-semibold text-slate-700">{name}</span>
                                {highLoad && (
                                  <span className="block text-xs text-red-500 font-bold">⚠ carga alta + fadiga</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="text-center px-3 py-3 font-mono text-sm font-bold text-slate-600">
                            {baseline
                              ? `${baseline.melhor_salto} cm`
                              : <span className="text-slate-300 text-xs font-normal">sem baseline</span>}
                          </td>
                          <td className="text-center px-3 py-3 text-xs text-slate-400">
                            {ultima ? fmtDate(ultima.data_coleta) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="text-center px-3 py-3 font-mono text-sm font-bold text-slate-700">
                            {ultima ? `${ultima.media} cm` : <span className="text-slate-300 text-xs font-normal">—</span>}
                          </td>
                          <td className="text-center px-3 py-3">
                            {pct !== null
                              ? <span className={`text-base font-black ${zone?.text}`}>{pct > 0 ? '+' : ''}{pct}%</span>
                              : <span className="text-xs text-slate-300">—</span>}
                          </td>
                          <td className="text-center px-3 py-3">
                            {zone
                              ? <span className={`text-xs font-bold px-2 py-1 rounded-full ${zone.badge}`}>{zone.label}</span>
                              : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                          {/* GPS últimos 2 dias */}
                          <td className="text-center px-3 py-3">
                            {gpsLast2
                              ? <span className={`text-xs font-mono font-bold ${gpsLast2.hsr > 1500 ? 'text-orange-600' : 'text-slate-600'}`}>
                                  {gpsLast2.hsr.toLocaleString('pt-BR')} m
                                </span>
                              : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                          <td className="text-center px-3 py-3">
                            {gpsLast2
                              ? <span className={`text-xs font-mono font-bold ${gpsLast2.sprint > 300 ? 'text-orange-600' : 'text-slate-600'}`}>
                                  {gpsLast2.sprint.toLocaleString('pt-BR')} m
                                </span>
                              : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                          <td className="text-center px-3 py-3 text-xs text-slate-400">
                            {zone?.action || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Detalhe ao clicar */}
                {focusedData && (
                  <div className={`border-t-2 ${focusedData.zone?.border || 'border-slate-200'} ${focusedData.zone?.bg || 'bg-slate-50'} p-5`}>
                    <div className="flex items-center gap-3 mb-4">
                      <AthleteAvatar name={focusedData.name} size={44} />
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-800">{focusedData.name}</h3>
                        <p className="text-xs text-slate-500">
                          Baseline: <strong>{focusedData.baseline?.melhor_salto ?? '—'} cm</strong>
                          {focusedData.baseline?.data_avaliacao && ` · avaliado em ${fmtDate(focusedData.baseline.data_avaliacao)}`}
                        </p>
                      </div>

                      {/* GPS últimos 2 dias — destaque */}
                      {focusedData.gpsLast2 && (
                        <div className={`rounded-xl px-4 py-2 text-center ${focusedData.highLoad ? 'bg-red-100' : 'bg-slate-100'}`}>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">GPS últimos 2 dias</p>
                          <div className="flex gap-4">
                            <div>
                              <p className={`text-sm font-black font-mono ${focusedData.gpsLast2.hsr > 1500 ? 'text-orange-600' : 'text-slate-700'}`}>
                                {focusedData.gpsLast2.hsr.toLocaleString('pt-BR')} m
                              </p>
                              <p className="text-xs text-slate-400">HSR</p>
                            </div>
                            <div>
                              <p className={`text-sm font-black font-mono ${focusedData.gpsLast2.sprint > 300 ? 'text-orange-600' : 'text-slate-700'}`}>
                                {focusedData.gpsLast2.sprint.toLocaleString('pt-BR')} m
                              </p>
                              <p className="text-xs text-slate-400">Sprint</p>
                            </div>
                            <div>
                              <p className="text-sm font-black font-mono text-slate-700">{focusedData.gpsLast2.sessions}</p>
                              <p className="text-xs text-slate-400">Sessões</p>
                            </div>
                          </div>
                          {focusedData.highLoad && (
                            <p className="text-xs text-red-600 font-bold mt-1">⚠ Alta carga + CMJ em queda</p>
                          )}
                        </div>
                      )}

                      {focusedData.pct !== null && focusedData.zone && (
                        <div className="text-right">
                          <span className={`text-3xl font-black ${focusedData.zone.text}`}>
                            {focusedData.pct > 0 ? '+' : ''}{focusedData.pct}%
                          </span>
                          <p className={`text-xs font-semibold mt-0.5 ${focusedData.zone.text}`}>
                            {focusedData.zone.label} · {focusedData.zone.action}
                          </p>
                        </div>
                      )}

                      <button
                        onClick={() => setFocusedAthlete(null)}
                        className="text-slate-300 hover:text-slate-500 transition-colors ml-2 shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Histórico de coletas */}
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Histórico de coletas diárias
                    </h4>
                    {focusedData.coletas.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2">Nenhuma coleta registrada ainda.</p>
                    ) : (
                      <div className="space-y-1 max-h-52 overflow-y-auto">
                        {focusedData.coletas.map(c => {
                          const p = focusedData.baseline ? calcFadiga(c.media, focusedData.baseline.melhor_salto) : null
                          const z = getZone(p)
                          const saltos = [c.salto_1, c.salto_2, c.salto_3].filter(v => v !== null && v !== undefined)
                          return (
                            <div key={c.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-xs group">
                              <span className="text-slate-500 w-20 shrink-0">{fmtDate(c.data_coleta)}</span>
                              <span className="text-slate-400 font-mono flex-1">
                                {saltos.length ? saltos.join(' / ') + ' cm' : '—'}
                              </span>
                              <span className="font-bold font-mono text-slate-700 mr-3">Ø {c.media} cm</span>
                              {p !== null && (
                                <span className={`font-black w-14 text-right shrink-0 ${z?.text}`}>
                                  {p > 0 ? '+' : ''}{p}%
                                </span>
                              )}
                              {confirmDel?.id === c.id ? (
                                <div className="flex items-center gap-2 ml-3">
                                  <button onClick={handleDelete} disabled={deleting === c.id} className="text-red-500 font-bold">Sim</button>
                                  <button onClick={() => setConfirmDel(null)} className="text-slate-400">Não</button>
                                </div>
                              ) : (
                                <button
                                  onClick={e => { e.stopPropagation(); setConfirmDel({ id: c.id, table: 'coletas' }) }}
                                  className="ml-3 text-slate-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── ABA REGISTRAR COLETA ── */}
        {activeTab === 'registrar' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-md mx-auto">
            <h2 className="font-semibold text-slate-700 mb-5 flex items-center gap-2">
              <span className="text-lg">🦵</span> Coleta Diária
            </h2>
            <div className="space-y-4">

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Atleta</label>
                <select
                  value={colAtleta}
                  onChange={e => { setColAtleta(e.target.value); setColError(null) }}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                >
                  <option value="">Selecionar atleta...</option>
                  {athletes.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                {colBaseline && (
                  <p className="text-xs text-slate-400 mt-1 pl-1">
                    Baseline: <strong className="text-slate-600">{colBaseline.melhor_salto} cm</strong>
                    {colBaseline.data_avaliacao && ` · avaliado em ${fmtDate(colBaseline.data_avaliacao)}`}
                  </p>
                )}
                {colAtleta && !colBaseline && (
                  <p className="text-xs text-amber-500 mt-1 pl-1">⚠ Sem baseline. Vá em "Baselines" primeiro.</p>
                )}
                {/* GPS do atleta selecionado */}
                {colGps && (
                  <div className="mt-2 bg-slate-50 rounded-lg px-3 py-2 flex gap-4 text-xs">
                    <div>
                      <span className={`font-bold font-mono ${colGps.hsr > 1500 ? 'text-orange-600' : 'text-slate-600'}`}>
                        {colGps.hsr.toLocaleString('pt-BR')} m
                      </span>
                      <span className="text-slate-400 ml-1">HSR 2d</span>
                    </div>
                    <div>
                      <span className={`font-bold font-mono ${colGps.sprint > 300 ? 'text-orange-600' : 'text-slate-600'}`}>
                        {colGps.sprint.toLocaleString('pt-BR')} m
                      </span>
                      <span className="text-slate-400 ml-1">Sprint 2d</span>
                    </div>
                    <div>
                      <span className="font-bold font-mono text-slate-600">{colGps.sessions}</span>
                      <span className="text-slate-400 ml-1">sessões</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Data</label>
                <input
                  type="date"
                  value={colData}
                  onChange={e => setColData(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Saltos (cm) <span className="normal-case font-normal text-slate-300">mín. 1</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[['1ª', colS1, setColS1], ['2ª', colS2, setColS2], ['3ª', colS3, setColS3]].map(([lbl, val, set]) => (
                    <div key={lbl}>
                      <div className="text-xs text-slate-400 text-center mb-1">{lbl} tentativa</div>
                      <input
                        type="number" step="0.1" min="0" max="120"
                        value={val}
                        onChange={e => { set(e.target.value); setColError(null) }}
                        placeholder="—"
                        className="w-full border border-slate-200 rounded-xl px-2 py-3 text-base text-center font-mono font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              {colMedia && (
                <div className={`rounded-xl p-4 border-2 ${previewZone ? previewZone.border + ' ' + previewZone.bg : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-slate-500">Média dos saltos</span>
                    <span className="font-black font-mono text-slate-800 text-lg">{colMedia} cm</span>
                  </div>
                  {previewPct !== null && previewZone ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">Fadiga</span>
                        <span className={`font-black text-2xl ${previewZone.text}`}>
                          {previewPct > 0 ? '+' : ''}{previewPct}%
                        </span>
                      </div>
                      <div className={`mt-3 text-sm font-bold text-center py-2 rounded-lg ${previewZone.badge}`}>
                        {previewZone.label} · {previewZone.action}
                      </div>
                      {colGps && colGps.hsr > 1500 && previewPct <= -10 && (
                        <div className="mt-2 bg-red-100 text-red-700 text-xs font-bold text-center py-2 rounded-lg">
                          ⚠ Alta carga GPS + fadiga — considerar modificar treino
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">Cadastre o baseline para ver a variação.</p>
                  )}
                </div>
              )}

              {colError   && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{colError}</p>}
              {colSuccess && <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2 font-semibold">✅ Coleta salva!</p>}

              <button
                onClick={submitColeta}
                disabled={colSaving || !colAtleta || !colMedia}
                className="w-full bg-blue-600 text-white rounded-xl py-3.5 text-sm font-bold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                {colSaving ? 'Salvando...' : 'Salvar Coleta'}
              </button>
            </div>
          </div>
        )}

        {/* ── ABA BASELINES ── */}
        {activeTab === 'baseline' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="font-semibold text-slate-700 mb-1 flex items-center gap-2">
                <span className="text-lg">📐</span> Cadastrar / Atualizar Baseline
              </h2>
              <p className="text-xs text-slate-400 mb-5">
                Melhor salto da avaliação física. Referência fixa para calcular o índice de fadiga no pré-jogo.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Atleta</label>
                  <select
                    value={blAtleta}
                    onChange={e => { setBlAtleta(e.target.value); setBlError(null) }}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                  >
                    <option value="">Selecionar atleta...</option>
                    {athletes.map(a => {
                      const bl = baselineMap[normalizeName(a)]
                      return <option key={a} value={a}>{a}{bl ? ` (atual: ${bl.melhor_salto} cm)` : ''}</option>
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Melhor Salto (cm)</label>
                  <input
                    type="number" step="0.1" min="0" max="120"
                    value={blMelhor}
                    onChange={e => { setBlMelhor(e.target.value); setBlError(null) }}
                    placeholder="ex: 42.5"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Data da Avaliação <span className="normal-case font-normal text-slate-300">opcional</span>
                  </label>
                  <input
                    type="date"
                    value={blData}
                    onChange={e => setBlData(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>

                {blError   && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{blError}</p>}
                {blSuccess && <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2 font-semibold">✅ Baseline salvo!</p>}

                <button
                  onClick={submitBaseline}
                  disabled={blSaving || !blAtleta || !blMelhor}
                  className="w-full bg-slate-800 text-white rounded-xl py-3.5 text-sm font-bold hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  {blSaving ? 'Salvando...' : 'Salvar Baseline'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-700 text-sm">Baselines Cadastrados</h3>
                <p className="text-xs text-slate-400">{baselines.length} atleta{baselines.length !== 1 ? 's' : ''}</p>
              </div>
              {baselines.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">Nenhum baseline cadastrado ainda.</div>
              ) : (
                <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
                  {baselines.map(b => (
                    <div key={b.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 group">
                      <div className="flex items-center gap-2">
                        <AthleteAvatar name={b.athlete_name} size={28} />
                        <div>
                          <p className="text-xs font-semibold text-slate-700">{b.athlete_name}</p>
                          {b.data_avaliacao && <p className="text-xs text-slate-400">{fmtDate(b.data_avaliacao)}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-black font-mono text-slate-700">{b.melhor_salto} cm</span>
                        {confirmDel?.id === b.id ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            <button onClick={handleDelete} disabled={deleting === b.id} className="text-red-500 font-bold">Sim</button>
                            <button onClick={() => setConfirmDel(null)} className="text-slate-400">Não</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDel({ id: b.id, table: 'baseline' })}
                            className="text-slate-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Fórmula */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Fórmula</p>
          <p className="text-xs text-slate-500 font-mono bg-slate-50 rounded-lg px-3 py-2 inline-block">
            Fadiga (%) = ((média 3 saltos — melhor salto) / melhor salto) x 100
          </p>
        </div>

      </div>
    </div>
  )
}
