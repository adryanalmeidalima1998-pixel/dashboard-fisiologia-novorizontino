'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { useData, normalizeName } from '../../context/DataContext'
import { AthleteAvatar } from '../../utils/athletePhotos'

// ─── ZONAS ────────────────────────────────────────────────────────────────────
const ZONES = [
  { label: 'Normal',          range: '0 a -5%',    color: '#10b981', bg: 'bg-green-50',  border: 'border-green-300',  text: 'text-green-700',  badge: 'bg-green-100 text-green-700',   action: 'Treino normal'    },
  { label: 'Atenção',         range: '-5 a -10%',  color: '#f59e0b', bg: 'bg-amber-50',  border: 'border-amber-300',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700',   action: 'Ajuste leve'     },
  { label: 'Fadiga Moderada', range: '-10 a -15%', color: '#f97316', bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700', action: 'Reduzir carga'   },
  { label: 'Alto Risco',      range: '> -15%',     color: '#ef4444', bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-700',    badge: 'bg-red-100 text-red-700',       action: 'Modificar treino' },
]

function getZone(pct) {
  if (pct === null || pct === undefined) return null
  if (pct >= -5)  return ZONES[0]
  if (pct >= -10) return ZONES[1]
  if (pct >= -15) return ZONES[2]
  return ZONES[3]
}

// baseline = melhor média histórica do atleta
function calcFadiga(mediaHoje, melhorHistorico) {
  if (!mediaHoje || !melhorHistorico) return null
  return Math.round(((mediaHoje - melhorHistorico) / melhorHistorico) * 1000) / 10
}

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// GPS últimos 2 dias
function getGpsLast2Days(gpsData, athleteName, referenceDate) {
  const norm   = normalizeName(athleteName)
  const ref    = referenceDate ? new Date(referenceDate) : new Date()
  const cutoff = new Date(ref)
  cutoff.setDate(cutoff.getDate() - 2)
  cutoff.setHours(0, 0, 0, 0)

  let hsr = 0, sprint = 0, sessions = 0
  for (const session of gpsData) {
    let sd
    if (session.date?.includes('/')) {
      const [d, m, y] = session.date.split('/')
      sd = new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T12:00:00`)
    } else {
      sd = new Date((session.date || '') + 'T12:00:00')
    }
    if (sd < cutoff || sd > ref) continue
    for (const row of session.rows) {
      if (normalizeName(row.playerName) !== norm) continue
      hsr    += row.hsr            || 0
      sprint += row.sprintDistance || 0
      sessions++
    }
  }
  if (!sessions) return null
  return { hsr: Math.round(hsr), sprint: Math.round(sprint), sessions }
}

// ─── COMPONENTE ───────────────────────────────────────────────────────────────
export default function CMJPage() {
  const router = useRouter()
  const { gpsData, excludedNamesNorm } = useData()

  const [coletas,    setColetas]    = useState([])
  const [isLoading,  setIsLoading]  = useState(true)
  const [fetchError, setFetchError] = useState(null)

  const [activeTab,  setActiveTab]  = useState('semaforo')

  // form
  const [atleta,     setAtleta]     = useState('')
  const [data,       setData]       = useState(() => new Date().toISOString().split('T')[0])
  const [s1,         setS1]         = useState('')
  const [s2,         setS2]         = useState('')
  const [s3,         setS3]         = useState('')
  const [saving,     setSaving]     = useState(false)
  const [saveError,  setSaveError]  = useState(null)
  const [success,    setSuccess]    = useState(false)

  const [focused,    setFocused]    = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [deleting,   setDeleting]   = useState(null)

  // ── Elenco ────────────────────────────────────────────────────────────────
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
      const d = await res.json()
      setColetas(d.coletas || [])
    } catch (e) {
      setFetchError(e.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Status do elenco — baseline automático ────────────────────────────────
  const athleteStatus = useMemo(() => {
    return athletes.map(name => {
      const norm        = normalizeName(name)
      const minhas      = coletas.filter(c => normalizeName(c.athlete_name) === norm)
      const sorted      = [...minhas].sort((a, b) => new Date(b.data_coleta) - new Date(a.data_coleta))
      const ultima      = sorted[0] || null
      const melhor      = minhas.length ? Math.max(...minhas.map(c => c.media)) : null
      const pct         = ultima && melhor ? calcFadiga(ultima.media, melhor) : null
      const zone        = getZone(pct)
      const refDate     = ultima?.data_coleta ? new Date(ultima.data_coleta).toISOString().split('T')[0] : null
      const gpsLast2    = getGpsLast2Days(gpsData, name, refDate)
      const highLoad    = gpsLast2 && pct !== null && gpsLast2.hsr > 1500 && pct <= -10
      return { name, ultima, melhor, pct, zone, coletas: sorted, gpsLast2, highLoad }
    })
  }, [athletes, coletas, gpsData])

  const sorted = useMemo(() => {
    const order = { 'Alto Risco': 0, 'Fadiga Moderada': 1, 'Atenção': 2, 'Normal': 3 }
    return [...athleteStatus].sort((a, b) => {
      const ao = a.zone ? order[a.zone.label] : (a.ultima ? 4 : 5)
      const bo = b.zone ? order[b.zone.label] : (b.ultima ? 4 : 5)
      return ao - bo
    })
  }, [athleteStatus])

  const zoneCounts = useMemo(() => {
    const c = { 'Normal': 0, 'Atenção': 0, 'Fadiga Moderada': 0, 'Alto Risco': 0 }
    for (const a of athleteStatus) if (a.zone) c[a.zone.label]++
    return c
  }, [athleteStatus])

  const alertCount = useMemo(() => athleteStatus.filter(a => a.highLoad).length, [athleteStatus])

  // ── Preview ───────────────────────────────────────────────────────────────
  const media = useMemo(() => {
    const vals = [s1, s2, s3].map(parseFloat).filter(v => !isNaN(v) && v > 0)
    if (!vals.length) return null
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10
  }, [s1, s2, s3])

  const atletaStatus = atleta ? athleteStatus.find(a => a.name === atleta) : null
  const previewMelhor = atletaStatus?.melhor || (media || null) // se não tem histórico, usa a média atual como referência
  const previewPct  = media && previewMelhor ? calcFadiga(media, Math.max(previewMelhor, media)) : null
  const previewZone = getZone(previewPct)
  const colGps      = atleta ? getGpsLast2Days(gpsData, atleta, data) : null

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!atleta)  return setSaveError('Selecione um atleta.')
    if (!media)   return setSaveError('Insira pelo menos 1 valor de salto.')
    setSaveError(null); setSaving(true)
    try {
      const res = await fetch('/api/cmj', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          type: 'coleta',
          athlete_name: atleta,
          data_coleta:  data,
          salto_1: parseFloat(s1) || null,
          salto_2: parseFloat(s2) || null,
          salto_3: parseFloat(s3) || null,
          media,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setS1(''); setS2(''); setS3('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      setFocused(atleta)
      setActiveTab('semaforo')
      await fetchAll()
    } catch (e) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirmDel) return
    setDeleting(confirmDel)
    try {
      await fetch(`/api/cmj/${confirmDel}?table=coletas`, { method: 'DELETE' })
      await fetchAll()
    } finally {
      setDeleting(null)
      setConfirmDel(null)
    }
  }

  const focusedData = focused ? athleteStatus.find(a => a.name === focused) : null

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white text-black p-4 font-sans">
      <div className="max-w-[1400px] mx-auto flex flex-col gap-6">

        {/* HEADER */}
        <header className="flex justify-between items-center border-b-4 border-amber-500 pb-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/fisiologia')}
              className="bg-slate-100 hover:bg-amber-500 transition-all p-2 rounded-xl"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-3xl font-black tracking-tighter text-black uppercase leading-none">Índice de Fadiga</h1>
              <p className="text-sm font-bold tracking-widest text-slate-500 uppercase">CMJ · Counter Movement Jump</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {alertCount > 0 && (
              <div className="bg-red-600 text-white px-4 py-1.5 font-black text-xs uppercase tracking-widest rounded-xl">
                ⚠ {alertCount} alerta{alertCount > 1 ? 's' : ''} GPS
              </div>
            )}
            <div className="bg-amber-500 text-black px-6 py-1 font-black text-sm uppercase italic shadow-md">
              Monitoramento Diário
            </div>
          </div>
        </header>

        {/* CARDS DE ZONA */}
        <div className="grid grid-cols-4 gap-4">
          {ZONES.map(z => (
            <div key={z.label} className={`border-2 ${z.border} ${z.bg} rounded-2xl p-5`}>
              <p className={`text-[10px] font-black uppercase tracking-widest ${z.text} mb-1`}>{z.label}</p>
              <p className={`text-5xl font-black ${z.text}`}>{zoneCounts[z.label] ?? 0}</p>
              <p className={`text-xs font-bold mt-2 ${z.text} opacity-80`}>{z.range}</p>
              <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${z.text} opacity-60`}>{z.action}</p>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div className="flex gap-2">
          {[
            { key: 'semaforo',  label: '🚦 Semáforo do Elenco' },
            { key: 'registrar', label: '📥 Registrar Coleta'    },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all border-2 ${
                activeTab === t.key
                  ? 'bg-amber-500 border-amber-500 text-black shadow-sm'
                  : 'border-slate-200 text-slate-500 hover:border-amber-400 bg-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── ABA SEMÁFORO ── */}
        {activeTab === 'semaforo' && (
          <div className="border-2 border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {isLoading ? (
              <div className="py-20 text-center text-slate-400 text-sm font-bold">Carregando...</div>
            ) : fetchError ? (
              <div className="py-20 text-center text-red-500 text-sm font-bold">{fetchError}</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-slate-200 bg-slate-50">
                        {['Atleta', 'Melhor Histórico', 'Coleta', 'Média CMJ', 'Fadiga', 'Zona', 'HSR 2d', 'Sprint 2d', 'Ação'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sorted.map(({ name, ultima, melhor, pct, zone, gpsLast2, highLoad }) => (
                        <tr
                          key={name}
                          onClick={() => setFocused(focused === name ? null : name)}
                          className={`cursor-pointer transition-all ${
                            focused === name ? 'bg-amber-50 border-l-4 border-amber-500' :
                            highLoad ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <AthleteAvatar name={name} size={32} />
                              <div>
                                <p className="text-xs font-black text-black">{name}</p>
                                {highLoad && <p className="text-[10px] font-black text-red-600">⚠ carga alta + fadiga</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono font-black text-slate-700 text-sm">
                            {melhor ? `${melhor} cm` : <span className="text-slate-300 text-xs font-bold">sem histórico</span>}
                          </td>
                          <td className="px-4 py-3 text-xs font-bold text-slate-500">
                            {ultima ? fmtDate(ultima.data_coleta) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3 font-mono font-black text-black text-sm">
                            {ultima ? `${ultima.media} cm` : <span className="text-slate-300 text-xs font-bold">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {pct !== null
                              ? <span className={`text-lg font-black ${zone?.text}`}>{pct > 0 ? '+' : ''}{pct}%</span>
                              : <span className="text-slate-300 text-xs font-bold">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {zone
                              ? <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${zone.badge}`}>{zone.label}</span>
                              : <span className="text-slate-300 text-xs font-bold">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {gpsLast2
                              ? <span className={`font-mono font-black text-xs ${gpsLast2.hsr > 1500 ? 'text-orange-600' : 'text-slate-600'}`}>{gpsLast2.hsr.toLocaleString('pt-BR')} m</span>
                              : <span className="text-slate-300 text-xs font-bold">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {gpsLast2
                              ? <span className={`font-mono font-black text-xs ${gpsLast2.sprint > 300 ? 'text-orange-600' : 'text-slate-600'}`}>{gpsLast2.sprint.toLocaleString('pt-BR')} m</span>
                              : <span className="text-slate-300 text-xs font-bold">—</span>}
                          </td>
                          <td className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {zone?.action || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Detalhe atleta */}
                {focusedData && (
                  <div className={`border-t-4 border-amber-500 bg-amber-50 p-6`}>
                    <div className="flex items-center gap-4 mb-5">
                      <AthleteAvatar name={focusedData.name} size={48} />
                      <div className="flex-1">
                        <h3 className="text-xl font-black uppercase tracking-tighter text-black">{focusedData.name}</h3>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                          {focusedData.coletas.length} coleta{focusedData.coletas.length !== 1 ? 's' : ''} registrada{focusedData.coletas.length !== 1 ? 's' : ''} · Melhor histórico: <strong>{focusedData.melhor ?? '—'} cm</strong>
                        </p>
                      </div>

                      {focusedData.gpsLast2 && (
                        <div className={`border-2 rounded-xl px-5 py-3 text-center ${focusedData.highLoad ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">GPS Últimos 2 Dias</p>
                          <div className="flex gap-5">
                            <div>
                              <p className={`text-sm font-black font-mono ${focusedData.gpsLast2.hsr > 1500 ? 'text-orange-600' : 'text-black'}`}>{focusedData.gpsLast2.hsr.toLocaleString('pt-BR')} m</p>
                              <p className="text-[9px] font-black uppercase text-slate-400">HSR</p>
                            </div>
                            <div>
                              <p className={`text-sm font-black font-mono ${focusedData.gpsLast2.sprint > 300 ? 'text-orange-600' : 'text-black'}`}>{focusedData.gpsLast2.sprint.toLocaleString('pt-BR')} m</p>
                              <p className="text-[9px] font-black uppercase text-slate-400">Sprint</p>
                            </div>
                          </div>
                          {focusedData.highLoad && <p className="text-[9px] font-black text-red-600 mt-1 uppercase">⚠ Carga alta + fadiga</p>}
                        </div>
                      )}

                      {focusedData.pct !== null && focusedData.zone && (
                        <div className={`border-2 rounded-xl px-6 py-3 text-center ${focusedData.zone.border} ${focusedData.zone.bg}`}>
                          <p className={`text-4xl font-black ${focusedData.zone.text}`}>
                            {focusedData.pct > 0 ? '+' : ''}{focusedData.pct}%
                          </p>
                          <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${focusedData.zone.text}`}>
                            {focusedData.zone.label}
                          </p>
                          <p className={`text-[9px] font-bold uppercase ${focusedData.zone.text} opacity-70`}>
                            {focusedData.zone.action}
                          </p>
                        </div>
                      )}

                      <button
                        onClick={() => setFocused(null)}
                        className="text-slate-400 hover:text-black font-black text-xl ml-2"
                      >✕</button>
                    </div>

                    {/* Histórico */}
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Histórico de Coletas</p>
                    {focusedData.coletas.length === 0 ? (
                      <p className="text-xs font-bold text-slate-400">Nenhuma coleta ainda.</p>
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {focusedData.coletas.map(c => {
                          const p = focusedData.melhor ? calcFadiga(c.media, focusedData.melhor) : null
                          const z = getZone(p)
                          const saltos = [c.salto_1, c.salto_2, c.salto_3].filter(v => v != null)
                          return (
                            <div key={c.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs group">
                              <span className="font-black text-slate-500 w-14 shrink-0">{fmtDate(c.data_coleta)}</span>
                              <span className="font-mono text-slate-400 flex-1">{saltos.length ? saltos.join(' / ') + ' cm' : '—'}</span>
                              <span className="font-black font-mono text-black mr-4">Ø {c.media} cm</span>
                              {p !== null && (
                                <span className={`font-black w-14 text-right shrink-0 ${z?.text}`}>
                                  {p > 0 ? '+' : ''}{p}%
                                </span>
                              )}
                              {confirmDel === c.id ? (
                                <div className="flex gap-2 ml-3">
                                  <button onClick={handleDelete} disabled={deleting === c.id} className="text-red-600 font-black text-[10px] uppercase">Sim</button>
                                  <button onClick={() => setConfirmDel(null)} className="text-slate-400 font-black text-[10px] uppercase">Não</button>
                                </div>
                              ) : (
                                <button
                                  onClick={e => { e.stopPropagation(); setConfirmDel(c.id) }}
                                  className="ml-3 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
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

        {/* ── ABA REGISTRAR ── */}
        {activeTab === 'registrar' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Formulário */}
            <div className="border-2 border-slate-200 rounded-2xl p-6 shadow-sm bg-white">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Coleta Diária</p>
              <h2 className="text-xl font-black uppercase tracking-tighter text-black mb-5">Registrar Saltos</h2>

              <div className="space-y-4">
                {/* Atleta */}
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1">Atleta</label>
                  <select
                    value={atleta}
                    onChange={e => { setAtleta(e.target.value); setSaveError(null) }}
                    className="w-full border-2 border-slate-200 hover:border-amber-400 focus:border-amber-500 rounded-xl px-3 py-2.5 text-sm font-bold text-black focus:outline-none bg-white transition-all"
                  >
                    <option value="">Selecionar atleta...</option>
                    {athletes.map(a => {
                      const st = athleteStatus.find(x => x.name === a)
                      return (
                        <option key={a} value={a}>
                          {a}{st?.melhor ? ` — melhor: ${st.melhor} cm` : ''}
                        </option>
                      )
                    })}
                  </select>

                  {/* GPS do atleta selecionado */}
                  {colGps && (
                    <div className="mt-2 border border-slate-200 rounded-xl px-4 py-2 flex gap-5 bg-slate-50">
                      <div>
                        <p className={`text-sm font-black font-mono ${colGps.hsr > 1500 ? 'text-orange-600' : 'text-slate-700'}`}>{colGps.hsr.toLocaleString('pt-BR')} m</p>
                        <p className="text-[9px] font-black uppercase text-slate-400">HSR 2d</p>
                      </div>
                      <div>
                        <p className={`text-sm font-black font-mono ${colGps.sprint > 300 ? 'text-orange-600' : 'text-slate-700'}`}>{colGps.sprint.toLocaleString('pt-BR')} m</p>
                        <p className="text-[9px] font-black uppercase text-slate-400">Sprint 2d</p>
                      </div>
                      <div>
                        <p className="text-sm font-black font-mono text-slate-700">{colGps.sessions}</p>
                        <p className="text-[9px] font-black uppercase text-slate-400">Sessões</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Data */}
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1">Data</label>
                  <input
                    type="date"
                    value={data}
                    onChange={e => setData(e.target.value)}
                    className="w-full border-2 border-slate-200 hover:border-amber-400 focus:border-amber-500 rounded-xl px-3 py-2.5 text-sm font-bold text-black focus:outline-none transition-all"
                  />
                </div>

                {/* Saltos */}
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-2">
                    Tentativas (cm) <span className="text-slate-300 font-bold normal-case">mín. 1</span>
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[['1ª', s1, setS1], ['2ª', s2, setS2], ['3ª', s3, setS3]].map(([lbl, val, set]) => (
                      <div key={lbl}>
                        <p className="text-[9px] font-black uppercase tracking-widest text-center text-slate-400 mb-1">{lbl}</p>
                        <input
                          type="number" step="0.1" min="0" max="120"
                          value={val}
                          onChange={e => { set(e.target.value); setSaveError(null) }}
                          placeholder="—"
                          className="w-full border-2 border-slate-200 hover:border-amber-400 focus:border-amber-500 rounded-xl px-2 py-4 text-xl text-center font-black font-mono text-black focus:outline-none transition-all"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {saveError  && <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">{saveError}</p>}
                {success    && <p className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2">✅ Coleta salva com sucesso!</p>}

                <button
                  onClick={handleSubmit}
                  disabled={saving || !atleta || !media}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black py-4 rounded-xl text-sm font-black uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                >
                  {saving ? 'Salvando...' : 'Salvar Coleta'}
                </button>
              </div>
            </div>

            {/* Preview resultado */}
            <div className="border-2 border-slate-200 rounded-2xl p-6 shadow-sm bg-white flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Preview</p>
                <h2 className="text-xl font-black uppercase tracking-tighter text-black mb-5">Resultado em Tempo Real</h2>

                {!media ? (
                  <div className="flex flex-col items-center justify-center h-48 text-slate-300">
                    <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <p className="text-sm font-black uppercase tracking-widest">Digite os saltos para ver</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b-2 border-slate-100 pb-4">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-400">Média dos saltos</span>
                      <span className="text-3xl font-black font-mono text-black">{media} cm</span>
                    </div>

                    {atletaStatus?.melhor && (
                      <div className="flex justify-between items-center border-b-2 border-slate-100 pb-4">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Melhor histórico</span>
                        <span className="text-xl font-black font-mono text-slate-600">{atletaStatus.melhor} cm</span>
                      </div>
                    )}

                    {previewPct !== null && previewZone ? (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black uppercase tracking-widest text-slate-400">Fadiga</span>
                          <span className={`text-5xl font-black ${previewZone.text}`}>
                            {previewPct > 0 ? '+' : ''}{previewPct}%
                          </span>
                        </div>
                        <div className={`border-2 ${previewZone.border} ${previewZone.bg} rounded-xl p-4 text-center`}>
                          <p className={`text-lg font-black uppercase tracking-tighter ${previewZone.text}`}>{previewZone.label}</p>
                          <p className={`text-xs font-black uppercase tracking-widest mt-1 ${previewZone.text} opacity-70`}>{previewZone.action}</p>
                        </div>
                        {colGps && colGps.hsr > 1500 && previewPct <= -10 && (
                          <div className="bg-red-600 text-white rounded-xl p-3 text-center">
                            <p className="text-xs font-black uppercase tracking-widest">⚠ Alta carga GPS + fadiga — modificar treino</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 text-center">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                          {!atleta ? 'Selecione um atleta' : 'Primeiro registro — será o baseline inicial'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Fórmula */}
              <div className="mt-6 pt-4 border-t-2 border-slate-100">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Fórmula</p>
                <p className="text-xs font-mono font-bold text-slate-500">
                  Fadiga (%) = ((média hoje — melhor histórico) / melhor histórico) x 100
                </p>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <footer className="flex justify-between items-center border-t-2 border-slate-900 pt-3 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              Baseline automático · Melhor média histórica · Integração GPS Catapult
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-black italic tracking-tight uppercase">© Fisiologia GN</p>
        </footer>

      </div>
    </div>
  )
}
