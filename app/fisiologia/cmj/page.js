'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { useData, normalizeName } from '../../context/DataContext'
import { AthleteAvatar } from '../../utils/athletePhotos'

// ─── ZONAS ────────────────────────────────────────────────────────────────────
const ZONES = [
  { label: 'Normal',          range: '0 a -5%',    text: 'text-green-700',  badge: 'bg-green-100 text-green-700',   border: 'border-green-300',  bg: 'bg-green-50',  action: 'Treino normal'    },
  { label: 'Atenção',         range: '-5 a -10%',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700',   border: 'border-amber-300',  bg: 'bg-amber-50',  action: 'Ajuste leve'      },
  { label: 'Fadiga Moderada', range: '-10 a -15%', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700', border: 'border-orange-300', bg: 'bg-orange-50', action: 'Reduzir carga'    },
  { label: 'Alto Risco',      range: '> -15%',     text: 'text-red-700',    badge: 'bg-red-100 text-red-700',       border: 'border-red-300',    bg: 'bg-red-50',    action: 'Modificar treino' },
]

function getZone(pct) {
  if (pct === null || pct === undefined) return null
  if (pct >= -5)  return ZONES[0]
  if (pct >= -10) return ZONES[1]
  if (pct >= -15) return ZONES[2]
  return ZONES[3]
}

function calcFadiga(media, melhor) {
  if (!media || !melhor) return null
  return Math.round(((media - melhor) / melhor) * 1000) / 10
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function getGps2d(gpsData, name, refDate) {
  const norm   = normalizeName(name)
  const ref    = refDate ? new Date(refDate) : new Date()
  const cutoff = new Date(ref); cutoff.setDate(cutoff.getDate() - 2); cutoff.setHours(0,0,0,0)
  let hsr = 0, sprint = 0, sessions = 0
  for (const s of gpsData) {
    let sd
    if (s.date?.includes('/')) { const [d,m,y] = s.date.split('/'); sd = new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T12:00:00`) }
    else sd = new Date((s.date||'')+'T12:00:00')
    if (sd < cutoff || sd > ref) continue
    for (const r of s.rows) {
      if (normalizeName(r.playerName) !== norm) continue
      hsr += r.hsr || 0; sprint += r.sprintDistance || 0; sessions++
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

  // form coleta
  const [atleta,    setAtleta]    = useState('')
  const [data,      setData]      = useState(() => new Date().toISOString().split('T')[0])
  const [s1,        setS1]        = useState('')
  const [s2,        setS2]        = useState('')
  const [s3,        setS3]        = useState('')
  const [saving,    setSaving]    = useState(false)
  const [saveErr,   setSaveErr]   = useState(null)
  const [saveOk,    setSaveOk]    = useState(false)

  // form avaliação física
  const [avalData,    setAvalData]    = useState(() => { const d = new Date(); d.setMonth(d.getMonth()-2); return d.toISOString().split('T')[0] })
  const [avalSaltos,  setAvalSaltos]  = useState({})
  const [avalSaving,  setAvalSaving]  = useState(false)
  const [avalErr,     setAvalErr]     = useState(null)
  const [avalOk,      setAvalOk]      = useState(false)

  const [focused,    setFocused]    = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [deleting,   setDeleting]   = useState(null)

  // ── Elenco ────────────────────────────────────────────────────────────────
  const athletes = useMemo(() => {
    const names = new Set()
    for (const s of gpsData) for (const r of s.rows) {
      const n = r.playerName?.trim()
      if (n && !excludedNamesNorm?.has(normalizeName(n))) names.add(n)
    }
    return Array.from(names).sort((a,b) => a.localeCompare(b,'pt-BR'))
  }, [gpsData, excludedNamesNorm])

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/cmj')
      if (!res.ok) throw new Error('Erro ao buscar dados')
      const d = await res.json()
      setColetas(d.coletas || [])
    } catch (e) { setFetchError(e.message) }
    finally { setIsLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Status ────────────────────────────────────────────────────────────────
  const athleteStatus = useMemo(() => {
    return athletes.map(name => {
      const norm    = normalizeName(name)
      const minhas  = coletas.filter(c => normalizeName(c.athlete_name) === norm)
      const sorted  = [...minhas].sort((a,b) => new Date(b.data_coleta)-new Date(a.data_coleta))
      const ultima  = sorted[0] || null
      const melhor  = minhas.length ? Math.max(...minhas.map(c => c.media)) : null
      const pct     = ultima && melhor ? calcFadiga(ultima.media, melhor) : null
      const zone    = getZone(pct)
      const ref     = ultima?.data_coleta ? new Date(ultima.data_coleta).toISOString().split('T')[0] : null
      const gps2d   = getGps2d(gpsData, name, ref)
      const alert   = gps2d && pct !== null && gps2d.hsr > 1500 && pct <= -10
      return { name, ultima, melhor, pct, zone, coletas: sorted, gps2d, alert }
    })
  }, [athletes, coletas, gpsData])

  // apenas quem tem coleta
  const comColeta = useMemo(() => {
    const order = { 'Alto Risco': 0, 'Fadiga Moderada': 1, 'Atenção': 2, 'Normal': 3 }
    return athleteStatus
      .filter(a => a.ultima !== null)
      .sort((a,b) => {
        const ao = a.zone ? order[a.zone.label] : 4
        const bo = b.zone ? order[b.zone.label] : 4
        return ao - bo
      })
  }, [athleteStatus])

  const zoneCounts = useMemo(() => {
    const c = { 'Normal': 0, 'Atenção': 0, 'Fadiga Moderada': 0, 'Alto Risco': 0 }
    for (const a of comColeta) if (a.zone) c[a.zone.label]++
    return c
  }, [comColeta])

  // ── Preview ───────────────────────────────────────────────────────────────
  const media = useMemo(() => {
    const vals = [s1,s2,s3].map(parseFloat).filter(v => !isNaN(v) && v > 0)
    if (!vals.length) return null
    return Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10
  }, [s1,s2,s3])

  const atletaSt    = atleta ? athleteStatus.find(a => a.name === atleta) : null
  const prevMelhor  = atletaSt?.melhor ? Math.max(atletaSt.melhor, media||0) : (media||null)
  const prevPct     = media && atletaSt?.melhor ? calcFadiga(media, atletaSt.melhor) : null
  const prevZone    = getZone(prevPct)
  const colGps      = atleta ? getGps2d(gpsData, atleta, data) : null

  // ── Submit coleta ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!atleta) return setSaveErr('Selecione um atleta.')
    if (!media)  return setSaveErr('Insira pelo menos 1 salto.')
    setSaveErr(null); setSaving(true)
    try {
      const res = await fetch('/api/cmj', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ type:'coleta', athlete_name:atleta, data_coleta:data,
          salto_1: parseFloat(s1)||null, salto_2: parseFloat(s2)||null, salto_3: parseFloat(s3)||null, media }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setS1(''); setS2(''); setS3(''); setSaveOk(true)
      setTimeout(()=>setSaveOk(false),3000)
      setFocused(atleta); setActiveTab('semaforo')
      await fetchAll()
    } catch(e) { setSaveErr(e.message) }
    finally { setSaving(false) }
  }

  // ── Submit avaliação física ────────────────────────────────────────────────
  const handleAvaliacao = async () => {
    const entradas = athletes.filter(a => parseFloat(avalSaltos[a]) > 0)
    if (!entradas.length) return setAvalErr('Preencha pelo menos um atleta.')
    if (!avalData) return setAvalErr('Informe a data.')
    setAvalErr(null); setAvalSaving(true)
    try {
      await Promise.all(entradas.map(a => fetch('/api/cmj', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ type:'coleta', athlete_name:a, data_coleta:avalData,
          salto_1:parseFloat(avalSaltos[a]), salto_2:null, salto_3:null, media:parseFloat(avalSaltos[a]) }),
      })))
      setAvalSaltos({}); setAvalOk(true)
      setTimeout(()=>setAvalOk(false),3000)
      await fetchAll()
    } catch(e) { setAvalErr(e.message) }
    finally { setAvalSaving(false) }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirmDel) return
    setDeleting(confirmDel)
    try {
      await fetch(`/api/cmj/${confirmDel}?table=coletas`, { method:'DELETE' })
      await fetchAll()
    } finally { setDeleting(null); setConfirmDel(null) }
  }

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ['Atleta','Data','Salto 1','Salto 2','Salto 3','Media','Melhor','Fadiga%','Zona','Acao','HSR 2d','Sprint 2d'],
      ...comColeta.map(a => [
        a.name,
        a.ultima ? new Date(a.ultima.data_coleta).toLocaleDateString('pt-BR') : '',
        a.ultima?.salto_1??'', a.ultima?.salto_2??'', a.ultima?.salto_3??'',
        a.ultima?.media??'', a.melhor??'', a.pct??'',
        a.zone?.label??'', a.zone?.action??'',
        a.gps2d?.hsr??'', a.gps2d?.sprint??'',
      ])
    ]
    const csv  = rows.map(r=>r.join(';')).join('\n')
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'})
    const url  = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `cmj_${new Date().toISOString().split('T')[0]}.csv`
    link.click(); URL.revokeObjectURL(url)
  }

  const focusedData = focused ? athleteStatus.find(a => a.name === focused) : null

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white text-black p-4 font-sans">
      <div className="max-w-[1400px] mx-auto flex flex-col gap-6">

        {/* HEADER */}
        <header className="flex justify-between items-center border-b-4 border-amber-500 pb-3">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/fisiologia')} className="bg-slate-100 hover:bg-amber-500 transition-all p-2 rounded-xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-3xl font-black tracking-tighter text-black uppercase leading-none">Índice de Fadiga</h1>
              <p className="text-sm font-bold tracking-widest text-slate-500 uppercase">CMJ · Counter Movement Jump</p>
            </div>
          </div>
          <div className="bg-amber-500 text-black px-6 py-1 font-black text-sm uppercase italic shadow-md">
            Monitoramento Diário
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
            { key: 'avaliacao', label: '📋 Avaliação Física'    },
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
          <>
            {isLoading ? (
              <div className="py-20 text-center text-slate-400 text-sm font-bold">Carregando...</div>
            ) : fetchError ? (
              <div className="py-20 text-center text-red-500 text-sm font-bold">{fetchError}</div>
            ) : comColeta.length === 0 ? (
              <div className="py-20 text-center border-2 border-slate-200 rounded-2xl">
                <p className="text-slate-400 text-sm font-black uppercase tracking-widest">Nenhuma coleta registrada hoje</p>
                <p className="text-slate-300 text-xs font-bold mt-1">Use a aba "Registrar Coleta" para adicionar</p>
              </div>
            ) : (
              <>
                {/* Topo: contador + export */}
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {comColeta.length} atleta{comColeta.length !== 1 ? 's' : ''} com coleta
                  </p>
                  <button
                    onClick={exportCSV}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Exportar CSV
                  </button>
                </div>

                {/* Grid de cards — idêntico ao Dashboard Diário */}
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
                  {comColeta.map(({ name, ultima, melhor, pct, zone, gps2d, alert }) => (
                    <div
                      key={name}
                      onClick={() => setFocused(focused === name ? null : name)}
                      className={`border-2 rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${
                        focused === name   ? 'border-amber-500 bg-amber-50' :
                        alert              ? 'border-red-300 bg-red-50' :
                        zone               ? zone.border + ' ' + zone.bg :
                        'border-slate-200 bg-white hover:border-amber-400'
                      }`}
                    >
                      {/* Foto pequena + nome — igual ao diário */}
                      <div className="flex items-center gap-2.5 mb-3">
                        <AthleteAvatar name={name} size="w-10 h-10" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black uppercase tracking-tighter text-black truncate">{name}</p>
                          {zone
                            ? <div className={`mt-0.5 inline-flex px-1.5 py-0.5 rounded text-[9px] font-black ${zone.badge}`}>{zone.label}</div>
                            : <p className="text-[9px] text-slate-400 font-bold italic mt-0.5">Sem histórico</p>
                          }
                        </div>
                      </div>

                      {/* Fadiga % + CMJ hoje */}
                      <div className="pb-3 mb-3 border-b border-slate-100">
                        {pct !== null ? (
                          <div className="flex items-end justify-between">
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Fadiga</p>
                              <p className={`text-2xl font-black leading-none ${zone?.text}`}>{pct > 0 ? '+' : ''}{pct}%</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">CMJ</p>
                              <p className="text-sm font-black font-mono text-black">{ultima?.media} cm</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-end justify-between">
                            <div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">CMJ hoje</p>
                              <p className="text-lg font-black font-mono text-black">{ultima?.media} cm</p>
                            </div>
                            <p className="text-[9px] text-slate-400 font-bold italic">1º registro</p>
                          </div>
                        )}
                      </div>

                      {/* GPS 2 dias */}
                      <div className="grid grid-cols-2 gap-1">
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">HSR 2D</span>
                          <span className={`text-xs font-black ${gps2d?.hsr > 1500 ? 'text-orange-600' : 'text-black'}`}>
                            {gps2d ? `${gps2d.hsr.toLocaleString('pt-BR')} m` : '—'}
                          </span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sprint 2D</span>
                          <span className={`text-xs font-black ${gps2d?.sprint > 300 ? 'text-orange-600' : 'text-black'}`}>
                            {gps2d ? `${gps2d.sprint.toLocaleString('pt-BR')} m` : '—'}
                          </span>
                        </div>
                      </div>

                      {alert && (
                        <div className="mt-2 bg-red-600 text-white rounded-lg px-2 py-0.5 text-center">
                          <p className="text-[8px] font-black uppercase">⚠ Carga alta + fadiga</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Detalhe ao clicar */}
                {focusedData && (
                  <div className={`border-2 rounded-2xl p-5 ${focusedData.zone ? focusedData.zone.border + ' ' + focusedData.zone.bg : 'border-amber-400 bg-amber-50'}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <AthleteAvatar name={focusedData.name} size="w-12 h-12" />
                      <div className="flex-1">
                        <h3 className="text-base font-black uppercase tracking-tighter text-black">{focusedData.name}</h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          {focusedData.coletas.length} coleta{focusedData.coletas.length !== 1 ? 's' : ''} · Melhor: <strong>{focusedData.melhor ?? '—'} cm</strong>
                        </p>
                      </div>
                      {focusedData.pct !== null && focusedData.zone && (
                        <div className="text-right">
                          <p className={`text-3xl font-black ${focusedData.zone.text}`}>{focusedData.pct > 0 ? '+' : ''}{focusedData.pct}%</p>
                          <p className={`text-[9px] font-black uppercase tracking-widest ${focusedData.zone.text}`}>{focusedData.zone.label} · {focusedData.zone.action}</p>
                        </div>
                      )}
                      <button onClick={() => setFocused(null)} className="text-slate-400 hover:text-black font-black text-xl ml-2">✕</button>
                    </div>

                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Histórico</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {focusedData.coletas.map(c => {
                        const p = focusedData.melhor ? calcFadiga(c.media, focusedData.melhor) : null
                        const z = getZone(p)
                        const saltos = [c.salto_1, c.salto_2, c.salto_3].filter(v => v != null)
                        return (
                          <div key={c.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs group">
                            <span className="font-black text-slate-500 w-12 shrink-0">{fmtDate(c.data_coleta)}</span>
                            <span className="font-mono text-slate-400 flex-1 text-[10px]">{saltos.length ? saltos.join(' / ')+' cm' : '—'}</span>
                            <span className="font-black font-mono text-black mr-3">Ø {c.media} cm</span>
                            {p !== null && <span className={`font-black w-12 text-right shrink-0 ${z?.text}`}>{p > 0 ? '+' : ''}{p}%</span>}
                            {confirmDel === c.id ? (
                              <div className="flex gap-2 ml-2">
                                <button onClick={handleDelete} disabled={deleting===c.id} className="text-red-600 font-black text-[9px] uppercase">Sim</button>
                                <button onClick={() => setConfirmDel(null)} className="text-slate-400 font-black text-[9px] uppercase">Não</button>
                              </div>
                            ) : (
                              <button onClick={e => { e.stopPropagation(); setConfirmDel(c.id) }} className="ml-2 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── ABA REGISTRAR COLETA ── */}
        {activeTab === 'registrar' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border-2 border-slate-200 rounded-2xl p-6 shadow-sm bg-white">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Coleta Diária</p>
              <h2 className="text-xl font-black uppercase tracking-tighter text-black mb-5">Registrar Saltos</h2>
              <div className="space-y-4">

                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1">Atleta</label>
                  <select value={atleta} onChange={e => { setAtleta(e.target.value); setSaveErr(null) }}
                    className="w-full border-2 border-slate-200 hover:border-amber-400 focus:border-amber-500 rounded-xl px-3 py-2.5 text-sm font-bold text-black focus:outline-none bg-white transition-all">
                    <option value="">Selecionar atleta...</option>
                    {athletes.map(a => {
                      const st = athleteStatus.find(x => x.name === a)
                      return <option key={a} value={a}>{a}{st?.melhor ? ` — melhor: ${st.melhor} cm` : ''}</option>
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
                  <input type="date" value={data} onChange={e => setData(e.target.value)}
                    className="w-full border-2 border-slate-200 hover:border-amber-400 focus:border-amber-500 rounded-xl px-3 py-2.5 text-sm font-bold text-black focus:outline-none transition-all" />
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-2">
                    Tentativas (cm) <span className="text-slate-300 font-bold normal-case">mín. 1</span>
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[['1ª', s1, setS1], ['2ª', s2, setS2], ['3ª', s3, setS3]].map(([lbl, val, set]) => (
                      <div key={lbl}>
                        <p className="text-[9px] font-black uppercase tracking-widest text-center text-slate-400 mb-1">{lbl}</p>
                        <input type="number" step="0.1" min="0" max="120" value={val}
                          onChange={e => { set(e.target.value); setSaveErr(null) }}
                          placeholder="—"
                          className="w-full border-2 border-slate-200 hover:border-amber-400 focus:border-amber-500 rounded-xl px-2 py-4 text-xl text-center font-black font-mono text-black focus:outline-none transition-all" />
                      </div>
                    ))}
                  </div>
                </div>

                {saveErr && <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">{saveErr}</p>}
                {saveOk  && <p className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2">✅ Coleta salva!</p>}

                <button onClick={handleSubmit} disabled={saving || !atleta || !media}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black py-4 rounded-xl text-sm font-black uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
                  {saving ? 'Salvando...' : 'Salvar Coleta'}
                </button>
              </div>
            </div>

            {/* Preview */}
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
                      <span className="text-xs font-black uppercase tracking-widest text-slate-400">Média</span>
                      <span className="text-3xl font-black font-mono text-black">{media} cm</span>
                    </div>
                    {atletaSt?.melhor && (
                      <div className="flex justify-between items-center border-b-2 border-slate-100 pb-4">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Melhor histórico</span>
                        <span className="text-xl font-black font-mono text-slate-600">{atletaSt.melhor} cm</span>
                      </div>
                    )}
                    {prevPct !== null && prevZone ? (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black uppercase tracking-widest text-slate-400">Fadiga</span>
                          <span className={`text-5xl font-black ${prevZone.text}`}>{prevPct > 0 ? '+' : ''}{prevPct}%</span>
                        </div>
                        <div className={`border-2 ${prevZone.border} ${prevZone.bg} rounded-xl p-4 text-center`}>
                          <p className={`text-lg font-black uppercase tracking-tighter ${prevZone.text}`}>{prevZone.label}</p>
                          <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${prevZone.text} opacity-70`}>{prevZone.action}</p>
                        </div>
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
              <div className="mt-6 pt-4 border-t-2 border-slate-100">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Fórmula</p>
                <p className="text-xs font-mono font-bold text-slate-500">
                  Fadiga (%) = ((média hoje — melhor histórico) / melhor histórico) x 100
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── ABA AVALIAÇÃO FÍSICA ── */}
        {activeTab === 'avaliacao' && (
          <div className="border-2 border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
            <div className="px-6 py-5 border-b-2 border-slate-200">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Histórico</p>
              <h2 className="text-xl font-black uppercase tracking-tighter text-black">Avaliação Física — Pré-Temporada</h2>
              <p className="text-xs font-bold text-slate-500 mt-1">
                Digite o melhor salto de cada atleta na avaliação física. Esses valores entram no histórico e serão usados como baseline.
              </p>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1">Data da Avaliação</label>
                  <input type="date" value={avalData} onChange={e => setAvalData(e.target.value)}
                    className="border-2 border-slate-200 hover:border-amber-400 focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm font-bold text-black focus:outline-none transition-all" />
                </div>
                <div className="flex-1 bg-amber-50 border-2 border-amber-200 rounded-xl px-4 py-3">
                  <p className="text-xs font-black text-amber-800">
                    Deixe em branco os atletas que não participaram da avaliação.
                  </p>
                </div>
              </div>

              <div className="border-2 border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b-2 border-slate-200">
                      {['Atleta', 'Melhor Atual', 'Salto da Avaliação (cm)'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {athletes.map(a => {
                      const st = athleteStatus.find(x => x.name === a)
                      return (
                        <tr key={a} className="hover:bg-slate-50 transition-all">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <AthleteAvatar name={a} size="w-8 h-8" />
                              <span className="text-sm font-black text-black">{a}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {st?.melhor
                              ? <span className="font-mono font-black text-slate-600">{st.melhor} cm</span>
                              : <span className="text-xs font-bold text-slate-300">sem registro</span>}
                          </td>
                          <td className="px-4 py-3">
                            <input type="number" step="0.1" min="0" max="120"
                              value={avalSaltos[a] || ''}
                              onChange={e => setAvalSaltos(prev => ({ ...prev, [a]: e.target.value }))}
                              placeholder="—"
                              className="w-32 border-2 border-slate-200 hover:border-amber-400 focus:border-amber-500 rounded-xl px-3 py-2 text-sm font-black font-mono text-center text-black focus:outline-none transition-all" />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {avalErr && <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">{avalErr}</p>}
              {avalOk  && <p className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2">✅ Avaliação registrada! Baseline atualizado automaticamente.</p>}

              <button onClick={handleAvaliacao}
                disabled={avalSaving || !Object.values(avalSaltos).some(v => parseFloat(v) > 0)}
                className="bg-amber-500 hover:bg-amber-400 text-black px-8 py-4 rounded-xl text-sm font-black uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
                {avalSaving ? 'Salvando...' : 'Salvar Avaliação'}
              </button>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <footer className="flex justify-between items-center border-t-2 border-slate-900 pt-3 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              Baseline automático · Melhor histórico · GPS Catapult integrado
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-black italic tracking-tight uppercase">© Fisiologia GN</p>
        </footer>

      </div>
    </div>
  )
}
