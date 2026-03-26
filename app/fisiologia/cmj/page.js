'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { useData, normalizeName } from '../../context/DataContext'
import { AthleteAvatar } from '../../utils/athletePhotos'

// ─── ZONAS ────────────────────────────────────────────────────────────────────
const ZONES = [
  { label: 'NORMAL',          range: '0 a -5%',    text: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-300',  badge: 'bg-green-100 text-green-700',   dot: 'bg-green-500',  action: 'Treino normal'    },
  { label: 'ATENÇÃO',         range: '-5 a -10%',  text: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-300',  badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500',  action: 'Ajuste leve'     },
  { label: 'FADIGA MODERADA', range: '-10 a -15%', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-300', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', action: 'Reduzir carga'   },
  { label: 'ALTO RISCO',      range: '> -15%',     text: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-300',    badge: 'bg-red-100 text-red-700',       dot: 'bg-red-500',    action: 'Modificar treino' },
]

function getZone(pct) {
  if (pct === null || pct === undefined) return null
  if (pct >= -5)  return ZONES[0]
  if (pct >= -10) return ZONES[1]
  if (pct >= -15) return ZONES[2]
  return ZONES[3]
}

function calcFadiga(mediaHoje, melhorHistorico) {
  if (!mediaHoje || !melhorHistorico) return null
  return Math.round(((mediaHoje - melhorHistorico) / melhorHistorico) * 1000) / 10
}

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

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
    } else { sd = new Date((session.date || '') + 'T12:00:00') }
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

// ─── CARD DO ATLETA (estilo diário) ──────────────────────────────────────────
function AthleteCard({ data, onClick }) {
  const { name, ultima, melhor, pct, zone, gpsLast2, highLoad } = data
  const hasData = !!ultima

  return (
    <div
      onClick={() => onClick(name)}
      className={`border-2 rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${
        highLoad    ? 'border-red-300 bg-red-50' :
        zone        ? zone.border + ' ' + zone.bg :
        hasData     ? 'border-slate-200 bg-white hover:border-amber-400' :
                      'border-slate-200 bg-white hover:border-amber-400'
      }`}
    >
      {/* Header: avatar + nome + zona */}
      <div className="flex items-center gap-2.5 mb-3">
        <AthleteAvatar name={name} size={40} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase tracking-tighter text-black truncate">{name}</p>
          {highLoad ? (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
              <span className="text-[9px] font-black text-red-600 uppercase tracking-wider">Carga alta + fadiga</span>
            </div>
          ) : zone ? (
            <div className={`mt-0.5 inline-flex px-1.5 py-0.5 rounded text-[9px] font-black ${zone.badge}`}>
              {zone.label}
            </div>
          ) : (
            <div className="mt-0.5 text-[9px] font-black text-slate-400 uppercase tracking-wider">
              Sem coleta
            </div>
          )}
        </div>
        {pct !== null && zone && (
          <div className={`px-2 py-1 rounded-lg text-sm font-black shrink-0 ${zone.badge}`}>
            {pct > 0 ? '+' : ''}{pct}%
          </div>
        )}
      </div>

      {/* Métricas CMJ */}
      {hasData ? (
        <div className="grid grid-cols-3 gap-1 pb-3 border-b border-slate-100">
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Melhor</span>
            <span className="text-xs font-black text-black">{melhor ? `${melhor} cm` : '—'}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Hoje</span>
            <span className="text-xs font-black text-black">{ultima.media} cm</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Data</span>
            <span className="text-xs font-black text-black">{fmtDate(ultima.data_coleta)}</span>
          </div>
        </div>
      ) : (
        <div className="text-[10px] text-slate-400 italic pb-3 border-b border-slate-100 font-medium">
          Sem registro de CMJ
        </div>
      )}

      {/* GPS últimos 2 dias */}
      {gpsLast2 ? (
        <div className="grid grid-cols-2 gap-1 pt-2">
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">HSR 2d</span>
            <span className={`text-xs font-black ${gpsLast2.hsr > 1500 ? 'text-orange-600' : 'text-black'}`}>
              {gpsLast2.hsr.toLocaleString('pt-BR')} m
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sprint 2d</span>
            <span className={`text-xs font-black ${gpsLast2.sprint > 300 ? 'text-orange-600' : 'text-black'}`}>
              {gpsLast2.sprint.toLocaleString('pt-BR')} m
            </span>
          </div>
        </div>
      ) : (
        <div className="pt-2">
          <span className="text-[9px] text-slate-400 italic font-medium">Sem GPS recente</span>
        </div>
      )}
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function CMJPage() {
  const router = useRouter()
  const { gpsData, excludedNamesNorm } = useData()

  const [coletas,    setColetas]    = useState([])
  const [isLoading,  setIsLoading]  = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [activeTab,  setActiveTab]  = useState('semaforo')

  // form
  const [atleta,    setAtleta]    = useState('')
  const [data,      setData]      = useState(() => new Date().toISOString().split('T')[0])
  const [s1,        setS1]        = useState('')
  const [s2,        setS2]        = useState('')
  const [s3,        setS3]        = useState('')
  const [saving,    setSaving]    = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [success,   setSuccess]   = useState(false)

  // detalhe
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

  // ── Status — baseline automático (melhor média histórica) ─────────────────
  const athleteStatus = useMemo(() => {
    return athletes.map(name => {
      const norm     = normalizeName(name)
      const minhas   = coletas.filter(c => normalizeName(c.athlete_name) === norm)
      const sorted   = [...minhas].sort((a, b) => new Date(b.data_coleta) - new Date(a.data_coleta))
      const ultima   = sorted[0] || null
      const melhor   = minhas.length ? Math.max(...minhas.map(c => c.media)) : null
      const pct      = ultima && melhor ? calcFadiga(ultima.media, melhor) : null
      const zone     = getZone(pct)
      const refDate  = ultima?.data_coleta ? new Date(ultima.data_coleta).toISOString().split('T')[0] : null
      const gpsLast2 = getGpsLast2Days(gpsData, name, refDate)
      const highLoad = !!(gpsLast2 && pct !== null && gpsLast2.hsr > 1500 && pct <= -10)
      return { name, ultima, melhor, pct, zone, coletas: sorted, gpsLast2, highLoad }
    })
  }, [athletes, coletas, gpsData])

  const sortedStatus = useMemo(() => {
    const order = { 'ALTO RISCO': 0, 'FADIGA MODERADA': 1, 'ATENÇÃO': 2, 'NORMAL': 3 }
    return [...athleteStatus].sort((a, b) => {
      const ao = a.zone ? order[a.zone.label] : (a.ultima ? 4 : 5)
      const bo = b.zone ? order[b.zone.label] : (b.ultima ? 4 : 5)
      return ao - bo
    })
  }, [athleteStatus])

  const zoneCounts  = useMemo(() => {
    const c = { 'NORMAL': 0, 'ATENÇÃO': 0, 'FADIGA MODERADA': 0, 'ALTO RISCO': 0 }
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

  const atletaStatus  = atleta ? athleteStatus.find(a => a.name === atleta) : null
  const melhorAtual   = atletaStatus?.melhor ?? null
  const baselinePreview = media && melhorAtual ? Math.max(melhorAtual, media) : (melhorAtual || media)
  const previewPct    = media && melhorAtual ? calcFadiga(media, melhorAtual) : null
  const previewZone   = getZone(previewPct)
  const colGps        = atleta ? getGpsLast2Days(gpsData, atleta, data) : null

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!atleta) return setSaveError('Selecione um atleta.')
    if (!media)  return setSaveError('Insira pelo menos 1 valor de salto.')
    setSaveError(null); setSaving(true)
    try {
      const res = await fetch('/api/cmj', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'coleta', athlete_name: atleta, data_coleta: data,
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
    } catch (e) { setSaveError(e.message) }
    finally     { setSaving(false) }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirmDel) return
    setDeleting(confirmDel)
    try {
      await fetch(`/api/cmj/${confirmDel}?table=coletas`, { method: 'DELETE' })
      await fetchAll()
    } finally { setDeleting(null); setConfirmDel(null) }
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
              className="bg-slate-200 text-slate-800 px-3 py-1 rounded-md text-xs font-bold hover:bg-slate-300 transition-colors"
            >
              ← Voltar
            </button>
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-black uppercase leading-none">Índice de Fadiga — CMJ</h1>
              <p className="text-sm font-bold tracking-widest text-slate-600 uppercase">Counter Movement Jump · Monitoramento Diário</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {alertCount > 0 && (
              <div className="bg-red-600 text-white px-4 py-1 font-black text-xs uppercase tracking-widest rounded-lg">
                ⚠ {alertCount} alerta{alertCount > 1 ? 's' : ''} GPS
              </div>
            )}
            <div className="bg-amber-500 text-black px-4 py-1 font-black text-sm uppercase italic shadow-md">
              Monitoramento Diário
            </div>
          </div>
        </header>

        {/* CARDS DE ZONA */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ZONES.map(z => (
            <div key={z.label} className={`border-2 ${z.border} ${z.bg} rounded-xl p-4`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${z.dot}`} />
                <p className={`text-[10px] font-black uppercase tracking-widest ${z.text}`}>{z.label}</p>
              </div>
              <p className={`text-4xl font-black ${z.text}`}>{zoneCounts[z.label] ?? 0}</p>
              <p className={`text-[9px] font-bold mt-1 ${z.text} opacity-70`}>{z.range} · {z.action}</p>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: 'semaforo',  label: '🚦 Semáforo' },
            { key: 'registrar', label: '📥 Registrar Coleta' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border-2 ${
                activeTab === t.key
                  ? 'bg-amber-500 border-amber-500 text-black shadow-sm'
                  : 'border-slate-200 text-slate-500 hover:border-amber-400 bg-white'
              }`}
            >
              {t.label}
            </button>
          ))}
          <span className="text-[10px] text-slate-400 font-bold ml-2 uppercase tracking-widest">
            {athleteStatus.filter(a => a.ultima).length} / {athletes.length} atletas com coleta
          </span>
        </div>

        {/* ── ABA SEMÁFORO ── */}
        {activeTab === 'semaforo' && (
          <>
            {isLoading ? (
              <div className="py-20 text-center text-slate-400 text-sm font-bold">Carregando...</div>
            ) : fetchError ? (
              <div className="py-20 text-center text-red-500 text-sm font-bold">{fetchError}</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                {sortedStatus.map(a => (
                  <AthleteCard
                    key={a.name}
                    data={a}
                    onClick={name => setFocused(focused === name ? null : name)}
                  />
                ))}
              </div>
            )}

            {/* Modal detalhe atleta */}
            {focusedData && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setFocused(null)}>
                <div
                  className="bg-white rounded-2xl shadow-2xl border-2 border-slate-200 p-6 w-full max-w-lg mx-4 max-h-[85vh] flex flex-col"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <AthleteAvatar name={focusedData.name} size={48} />
                    <div className="flex-1">
                      <h3 className="text-lg font-black uppercase tracking-tighter text-black">{focusedData.name}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {focusedData.coletas.length} coleta{focusedData.coletas.length !== 1 ? 's' : ''} · Melhor: {focusedData.melhor ?? '—'} cm
                      </p>
                    </div>
                    {focusedData.pct !== null && focusedData.zone && (
                      <div className={`border-2 rounded-xl px-4 py-2 text-center ${focusedData.zone.border} ${focusedData.zone.bg}`}>
                        <p className={`text-3xl font-black ${focusedData.zone.text}`}>
                          {focusedData.pct > 0 ? '+' : ''}{focusedData.pct}%
                        </p>
                        <p className={`text-[9px] font-black uppercase tracking-widest ${focusedData.zone.text}`}>
                          {focusedData.zone.label}
                        </p>
                      </div>
                    )}
                    <button onClick={() => setFocused(null)} className="text-slate-400 hover:text-black font-black text-xl ml-1">✕</button>
                  </div>

                  {focusedData.gpsLast2 && (
                    <div className={`border-2 rounded-xl px-4 py-3 mb-4 flex gap-6 ${focusedData.highLoad ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">HSR 2d</p>
                        <p className={`text-sm font-black font-mono ${focusedData.gpsLast2.hsr > 1500 ? 'text-orange-600' : 'text-black'}`}>
                          {focusedData.gpsLast2.hsr.toLocaleString('pt-BR')} m
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sprint 2d</p>
                        <p className={`text-sm font-black font-mono ${focusedData.gpsLast2.sprint > 300 ? 'text-orange-600' : 'text-black'}`}>
                          {focusedData.gpsLast2.sprint.toLocaleString('pt-BR')} m
                        </p>
                      </div>
                      {focusedData.highLoad && (
                        <div className="flex items-center">
                          <span className="text-[10px] font-black text-red-600 uppercase tracking-wider">⚠ Carga alta + fadiga</span>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Histórico de Coletas</p>
                  <div className="overflow-y-auto flex-1 space-y-1">
                    {focusedData.coletas.length === 0 ? (
                      <p className="text-xs font-bold text-slate-400 py-4 text-center">Nenhuma coleta ainda.</p>
                    ) : (
                      focusedData.coletas.map(c => {
                        const p = focusedData.melhor ? calcFadiga(c.media, focusedData.melhor) : null
                        const z = getZone(p)
                        const saltos = [c.salto_1, c.salto_2, c.salto_3].filter(v => v != null)
                        return (
                          <div key={c.id} className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2 text-xs group hover:bg-slate-50">
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
                                onClick={() => setConfirmDel(c.id)}
                                className="ml-3 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── ABA REGISTRAR ── */}
        {activeTab === 'registrar' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Formulário */}
            <div className="border-2 border-slate-200 rounded-2xl p-6 shadow-sm bg-white">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Coleta Diária</p>
              <h2 className="text-xl font-black uppercase tracking-tighter text-black mb-5">Registrar Saltos</h2>

              <div className="space-y-4">
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
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1">Data</label>
                  <input
                    type="date" value={data} onChange={e => setData(e.target.value)}
                    className="w-full border-2 border-slate-200 hover:border-amber-400 focus:border-amber-500 rounded-xl px-3 py-2.5 text-sm font-bold text-black focus:outline-none transition-all"
                  />
                </div>

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

                {saveError && <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">{saveError}</p>}
                {success   && <p className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2">✅ Coleta salva!</p>}

                <button
                  onClick={handleSubmit}
                  disabled={saving || !atleta || !media}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black py-4 rounded-xl text-sm font-black uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                >
                  {saving ? 'Salvando...' : 'Salvar Coleta'}
                </button>
              </div>
            </div>

            {/* Preview */}
            <div className="border-2 border-slate-200 rounded-2xl p-6 shadow-sm bg-white flex flex-col">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Preview</p>
              <h2 className="text-xl font-black uppercase tracking-tighter text-black mb-5">Resultado em Tempo Real</h2>

              {!media ? (
                <div className="flex flex-col items-center justify-center flex-1 text-slate-300">
                  <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <p className="text-sm font-black uppercase tracking-widest">Digite os saltos para ver</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border-2 border-slate-200 rounded-xl p-3 text-center">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Média Hoje</p>
                      <p className="text-3xl font-black font-mono text-black">{media}</p>
                      <p className="text-[9px] font-black text-slate-400">cm</p>
                    </div>
                    <div className="border-2 border-slate-200 rounded-xl p-3 text-center">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Melhor Histórico</p>
                      <p className="text-3xl font-black font-mono text-black">{melhorAtual ?? '—'}</p>
                      <p className="text-[9px] font-black text-slate-400">cm</p>
                    </div>
                  </div>

                  {previewPct !== null && previewZone ? (
                    <>
                      <div className={`border-2 ${previewZone.border} ${previewZone.bg} rounded-xl p-5 text-center`}>
                        <p className={`text-6xl font-black ${previewZone.text}`}>
                          {previewPct > 0 ? '+' : ''}{previewPct}%
                        </p>
                        <p className={`text-sm font-black uppercase tracking-tighter mt-2 ${previewZone.text}`}>{previewZone.label}</p>
                        <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${previewZone.text} opacity-70`}>{previewZone.action}</p>
                      </div>
                      {colGps && colGps.hsr > 1500 && previewPct <= -10 && (
                        <div className="bg-red-600 text-white rounded-xl p-3 text-center">
                          <p className="text-xs font-black uppercase tracking-widest">⚠ Alta carga GPS + fadiga — modificar treino</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-5 text-center">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                        {!atleta ? 'Selecione um atleta' : 'Primeiro registro — será o baseline inicial'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-auto pt-4 border-t-2 border-slate-100">
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
              Baseline automático · Melhor média histórica · GPS Catapult integrado
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-black italic tracking-tight uppercase">© Fisiologia GN</p>
        </footer>

      </div>
    </div>
  )
}
