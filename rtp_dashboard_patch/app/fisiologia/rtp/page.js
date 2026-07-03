'use client'

import { useEffect, useMemo, useState } from 'react'
import { useData, normalizeName, calcVmaxPct } from '@/app/context/DataContext'

const ATHLETE_CONFIGS = {
  'arthur barbosa': {
    atleta: 'Arthur Barbosa',
    lesao: 'Anterior de coxa',
    fase: 'Fase 2',
    inicioRtp: '18/06/2026',
    vmaxReferencia: 31.6,
    limiteVmaxPct: 60,
    dor: 1,
    rigidez: 0,
    confianca: 9,
    chutes: { finalizacoes: 0, fortes: 0, dor: 0 },
    piorSemana: {
      totalDistance: 21886,
      hsr: 687,
      sprintDistance: 154,
      sprintCount: 5,
      acceleration: 47,
      deceleration: 74,
      maxVelocity: 31.6,
    },
    proximaSessao: {
      totalDistance: '3.700 m',
      hsr: '0 m',
      sprintDistance: '0 m',
      maxVelocity: '≤ 19,0 km/h',
      acceleration: '10–12',
      deceleration: '12–15',
      objetivo: 'Consolidar volume, controlar velocidade e evoluir carga mecânica sem ultrapassar 60% da Vmáx.',
    },
  },
  'hector': {
    atleta: 'Héctor',
    lesao: 'Anterior de coxa',
    fase: 'Fase 3',
    inicioRtp: '18/06/2026',
    vmaxReferencia: 31.6,
    limiteVmaxPct: 85,
    dor: 0,
    rigidez: 1,
    confianca: 8,
    chutes: { finalizacoes: 16, fortes: 6, dor: 0 },
    piorSemana: {
      totalDistance: 21886,
      hsr: 687,
      sprintDistance: 154,
      sprintCount: 5,
      acceleration: 47,
      deceleration: 74,
      maxVelocity: 31.6,
    },
    proximaSessao: {
      totalDistance: '3.900–4.100 m',
      hsr: '150–200 m',
      sprintDistance: '20–30 m',
      maxVelocity: '25–26 km/h',
      acceleration: '15–18',
      deceleration: '15–18',
      objetivo: 'Aumentar carga locomotora e mecânica com controle de velocidade e progressão dos chutes.',
    },
  },
}

const METRICS = [
  { key: 'totalDistance', label: 'Distância Total', unit: 'm' },
  { key: 'hsr', label: 'HSR >20 km/h', unit: 'm' },
  { key: 'sprintDistance', label: 'Sprint >25 km/h', unit: 'm' },
  { key: 'sprintCount', label: 'Nº Sprints', unit: '' },
  { key: 'acceleration', label: 'ACC >3 m/s²', unit: '' },
  { key: 'deceleration', label: 'DCC >3 m/s²', unit: '' },
]

function fmt(value, decimals = 0) {
  if (value == null || Number.isNaN(value)) return '—'
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })
}

function toISODate(brDate) {
  if (!brDate) return ''
  const [dd, mm, yyyy] = brDate.split('/')
  return `${yyyy}-${mm}-${dd}`
}

function daysBetween(brDate) {
  const iso = toISODate(brDate)
  if (!iso) return null
  const start = new Date(`${iso}T00:00:00`)
  const today = new Date()
  return Math.max(0, Math.floor((today - start) / (1000 * 60 * 60 * 24)))
}

function getStatusColor(pct) {
  if (pct < 60) return 'bg-emerald-500'
  if (pct < 80) return 'bg-amber-400'
  return 'bg-red-500'
}

function getReadinessColor(value) {
  if (value >= 80) return 'text-emerald-400'
  if (value >= 60) return 'text-amber-300'
  return 'text-red-400'
}

function percent(value, reference) {
  if (!reference) return 0
  return Math.round(((value || 0) / reference) * 100)
}

function calcReadiness({ dor, rigidez, confianca, cargaPct, vmaxPct, assimetria = 5 }) {
  const dorScore = Math.max(0, 100 - dor * 20)
  const rigidezScore = Math.max(0, 100 - rigidez * 15)
  const confiancaScore = Math.min(100, confianca * 10)
  const cargaScore = Math.max(0, 100 - Math.abs(70 - cargaPct))
  const vmaxScore = Math.min(100, vmaxPct || 0)
  const assimScore = Math.max(0, 100 - assimetria * 5)
  return Math.round(dorScore * 0.2 + rigidezScore * 0.15 + confiancaScore * 0.2 + cargaScore * 0.2 + vmaxScore * 0.15 + assimScore * 0.1)
}

function Panel({ title, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-amber-400/70 bg-black/80 shadow-[0_0_18px_rgba(245,158,11,0.12)] ${className}`}>
      {title && <div className="border-b border-amber-400/40 px-4 py-2 text-[12px] font-black uppercase tracking-wide text-amber-300">{title}</div>}
      <div className="p-4">{children}</div>
    </section>
  )
}

function StatCard({ label, value, sub, color = 'text-amber-300' }) {
  return (
    <div className="rounded-xl border border-amber-400/60 bg-zinc-950 px-4 py-3 text-center">
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300">{label}</p>
      <p className={`mt-1 text-2xl font-black ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-[10px] font-bold text-zinc-400">{sub}</p>}
    </div>
  )
}

function ProgressLine({ label, value, reference }) {
  const p = percent(value, reference)
  return (
    <div className="space-y-1">
      <div className="flex items-end justify-between gap-2 text-xs">
        <span className="font-bold text-zinc-200">{label}</span>
        <span className="font-black text-amber-300">{p}%</span>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-zinc-800">
        <div className={`h-full rounded-full ${getStatusColor(p)}`} style={{ width: `${Math.min(p, 100)}%` }} />
      </div>
    </div>
  )
}

function MiniBar({ label, value, max, color = 'bg-amber-400' }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex justify-between text-[10px] font-bold text-zinc-300">
        <span>{label}</span><span>{fmt(value)}</span>
      </div>
      <div className="h-20 rounded bg-zinc-900 p-1 flex items-end">
        <div className={`w-full rounded-t ${color}`} style={{ height: `${pct}%` }} />
      </div>
    </div>
  )
}

function Criteria({ label, ok, warning }) {
  const color = ok ? 'bg-emerald-500' : warning ? 'bg-amber-400' : 'bg-red-500'
  return (
    <div className="flex items-center justify-between border-b border-zinc-800 py-2 text-sm">
      <span className="font-semibold text-zinc-200">{label}</span>
      <span className={`h-3 w-3 rounded-full ${color}`} />
    </div>
  )
}

export default function RTPPage() {
  const { gpsData, fetchGpsSessions, getUnifiedAthletes, isLoadingGps, vmaxBaseline } = useData()
  const [selectedAthlete, setSelectedAthlete] = useState('Arthur Barbosa')

  useEffect(() => { fetchGpsSessions?.() }, [fetchGpsSessions])

  const athletes = useMemo(() => getUnifiedAthletes?.() || [], [getUnifiedAthletes, gpsData])

  const config = useMemo(() => {
    const key = normalizeName(selectedAthlete)
    return ATHLETE_CONFIGS[key] || ATHLETE_CONFIGS[Object.keys(ATHLETE_CONFIGS).find(k => key.includes(k) || k.includes(key))] || {
      atleta: selectedAthlete,
      lesao: 'Definir lesão',
      fase: 'Definir fase',
      inicioRtp: '',
      vmaxReferencia: vmaxBaseline?.[selectedAthlete] || 31.6,
      limiteVmaxPct: 60,
      dor: 0,
      rigidez: 0,
      confianca: 8,
      chutes: { finalizacoes: 0, fortes: 0, dor: 0 },
      piorSemana: { totalDistance: 21886, hsr: 687, sprintDistance: 154, sprintCount: 5, acceleration: 47, deceleration: 74, maxVelocity: 31.6 },
      proximaSessao: { totalDistance: 'Definir', hsr: 'Definir', sprintDistance: 'Definir', maxVelocity: 'Definir', acceleration: 'Definir', deceleration: 'Definir', objetivo: 'Definir objetivo da próxima sessão.' },
    }
  }, [selectedAthlete, vmaxBaseline])

  const athleteSessions = useMemo(() => {
    const target = normalizeName(selectedAthlete)
    return (gpsData || [])
      .map(session => {
        const row = (session.rows || []).find(r => r.periodNumber === 0 && normalizeName(r.playerName) === target && !r.isOutlier)
        if (!row) return null
        return {
          id: session.id,
          date: row.sessionDate || session.sessionDate || session.session_date,
          name: session.sessionName || session.session_name || row.period || 'Sessão',
          totalDistance: row.totalDistance || 0,
          distanceRelative: row.distanceRelative || 0,
          hsr: row.hsr || 0,
          sprintDistance: row.sprintDistance || 0,
          sprintCount: row.sprintCount || 0,
          playerLoad: row.playerLoad || 0,
          acceleration: row.acceleration || 0,
          deceleration: row.deceleration || 0,
          maxVelocity: row.maxVelocity || 0,
        }
      })
      .filter(Boolean)
      .sort((a, b) => toISODate(a.date).localeCompare(toISODate(b.date)))
  }, [gpsData, selectedAthlete])

  const lastSessions = athleteSessions.slice(-6)
  const currentWeek = useMemo(() => {
    const acc = { totalDistance: 0, hsr: 0, sprintDistance: 0, sprintCount: 0, acceleration: 0, deceleration: 0, playerLoad: 0, maxVelocity: 0 }
    for (const s of lastSessions) {
      acc.totalDistance += s.totalDistance || 0
      acc.hsr += s.hsr || 0
      acc.sprintDistance += s.sprintDistance || 0
      acc.sprintCount += s.sprintCount || 0
      acc.acceleration += s.acceleration || 0
      acc.deceleration += s.deceleration || 0
      acc.playerLoad += s.playerLoad || 0
      acc.maxVelocity = Math.max(acc.maxVelocity, s.maxVelocity || 0)
    }
    return acc
  }, [lastSessions])

  const last = lastSessions[lastSessions.length - 1]
  const vmaxRef = config.vmaxReferencia || config.piorSemana.maxVelocity || vmaxBaseline?.[selectedAthlete]
  const vmaxPct = last?.maxVelocity && vmaxRef ? calcVmaxPct(last.maxVelocity, vmaxRef) : 0
  const weeklyPct = percent(currentWeek.totalDistance, config.piorSemana.totalDistance)
  const readiness = calcReadiness({ dor: config.dor, rigidez: config.rigidez, confianca: config.confianca, cargaPct: weeklyPct, vmaxPct })
  const limiteVmax = vmaxRef ? vmaxRef * (config.limiteVmaxPct / 100) : null
  const maxBar = Math.max(...lastSessions.map(s => s.totalDistance || 0), 1)

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-[1720px] px-4 py-4">
        <div className="rounded-3xl border border-amber-400 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),transparent_32%),linear-gradient(180deg,#080808,#000)] p-5 shadow-2xl">
          <header className="mb-4 grid grid-cols-12 gap-4 border-b border-amber-400/50 pb-4">
            <div className="col-span-12 flex items-center gap-4 lg:col-span-5">
              <img src="/club/escudonovorizontino.png" alt="Escudo" className="h-24 w-24 object-contain" />
              <div>
                <h1 className="text-3xl font-black uppercase tracking-wide text-amber-300 lg:text-4xl">Grêmio Novorizontino SAF</h1>
                <p className="text-xl font-black uppercase text-zinc-100">Dashboard RTP — Retorno de Lesão</p>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Departamento de Performance</p>
              </div>
            </div>
            <div className="col-span-12 grid grid-cols-2 gap-3 lg:col-span-7 lg:grid-cols-5">
              <div className="rounded-xl border border-amber-400/70 bg-zinc-950 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Atleta</p>
                <select value={selectedAthlete} onChange={e => setSelectedAthlete(e.target.value)} className="mt-1 w-full bg-black text-lg font-black uppercase text-amber-300 outline-none">
                  {[config.atleta, ...athletes].filter(Boolean).filter((v, i, a) => a.findIndex(x => normalizeName(x) === normalizeName(v)) === i).map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <StatCard label="Fase" value={config.fase} />
              <StatCard label="Dias RTP" value={config.inicioRtp ? daysBetween(config.inicioRtp) : '—'} sub={config.inicioRtp ? `Início: ${config.inicioRtp}` : ''} />
              <StatCard label="Readiness" value={`${readiness}%`} color={getReadinessColor(readiness)} />
              <StatCard label="Vmax limite" value={limiteVmax ? `≤ ${fmt(limiteVmax, 1)}` : '—'} sub={`${config.limiteVmaxPct}% da Vmáx`} color="text-emerald-400" />
            </div>
          </header>

          <div className="grid grid-cols-12 gap-4">
            <Panel title="Situação Clínica" className="col-span-12 lg:col-span-3">
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Dor" value={`${config.dor}/10`} color="text-emerald-400" />
                <StatCard label="Rigidez" value={`${config.rigidez}/10`} color="text-emerald-400" />
                <StatCard label="Confiança" value={`${config.confianca}/10`} color="text-emerald-400" />
              </div>
              <div className="mt-4 rounded-xl bg-zinc-950 p-3 text-sm font-semibold text-zinc-300">
                <p><span className="text-amber-300">Lesão:</span> {config.lesao}</p>
                <p><span className="text-amber-300">Última sessão:</span> {last ? `${last.date} · ${fmt(last.totalDistance)} m · Vmáx ${fmt(last.maxVelocity, 1)} km/h` : 'Sem dados carregados'}</p>
              </div>
            </Panel>

            <Panel title="Resumo da Última Sessão" className="col-span-12 lg:col-span-4">
              {last ? (
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="Distância" value={`${fmt(last.totalDistance)} m`} />
                  <StatCard label="m/min" value={fmt(last.distanceRelative, 1)} />
                  <StatCard label="Vmax" value={`${fmt(last.maxVelocity, 1)}`} sub={`${vmaxPct}% da Vmáx`} />
                  <StatCard label="HSR" value={`${fmt(last.hsr)} m`} />
                  <StatCard label="Sprint" value={`${fmt(last.sprintDistance)} m`} />
                  <StatCard label="ACC/DCC" value={`${fmt(last.acceleration)}/${fmt(last.deceleration)}`} />
                </div>
              ) : <p className="text-zinc-400">Carregue sessões GPS ou selecione um atleta com dados.</p>}
            </Panel>

            <Panel title="Próxima Meta" className="col-span-12 lg:col-span-3">
              <p className="text-sm font-semibold leading-relaxed text-zinc-200">{config.proximaSessao.objetivo}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold">
                <p>DT: <span className="text-amber-300">{config.proximaSessao.totalDistance}</span></p>
                <p>HSR: <span className="text-amber-300">{config.proximaSessao.hsr}</span></p>
                <p>Sprint: <span className="text-amber-300">{config.proximaSessao.sprintDistance}</span></p>
                <p>Vmax: <span className="text-amber-300">{config.proximaSessao.maxVelocity}</span></p>
                <p>ACC: <span className="text-amber-300">{config.proximaSessao.acceleration}</span></p>
                <p>DCC: <span className="text-amber-300">{config.proximaSessao.deceleration}</span></p>
              </div>
            </Panel>

            <Panel title="Status" className="col-span-12 lg:col-span-2">
              <div className="flex items-center justify-center">
                <div className="grid h-32 w-32 place-items-center rounded-full border-[14px] border-amber-400 bg-zinc-950 text-center">
                  <div>
                    <p className={`text-3xl font-black ${getReadinessColor(readiness)}`}>{readiness}%</p>
                    <p className="text-[10px] font-black uppercase text-zinc-400">Readiness</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs font-bold text-zinc-300">
                <p><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> ≥80% pronto</p>
                <p><span className="inline-block h-2 w-2 rounded-full bg-amber-400" /> 60–79% atenção</p>
                <p><span className="inline-block h-2 w-2 rounded-full bg-red-500" /> &lt;60% risco</p>
              </div>
            </Panel>

            <Panel title="1. Evolução da Carga Externa" className="col-span-12 lg:col-span-7">
              <div className="grid grid-cols-6 gap-3">
                {lastSessions.map(s => <MiniBar key={`${s.date}-${s.name}`} label={s.date?.slice(0,5) || s.date} value={s.totalDistance} max={maxBar} />)}
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="text-amber-300">
                    <tr>{['Data','DT','m/min','HSR','Sprint','Nº Sprint','Vmax','ACC','DCC','PL'].map(h => <th key={h} className="border-b border-amber-400/40 py-2 pr-3 uppercase">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {lastSessions.map(s => (
                      <tr key={`${s.date}-${s.name}`} className="border-b border-zinc-800 font-semibold text-zinc-200">
                        <td className="py-2 pr-3 text-amber-200">{s.date}</td>
                        <td className="pr-3">{fmt(s.totalDistance)}</td>
                        <td className="pr-3">{fmt(s.distanceRelative, 1)}</td>
                        <td className="pr-3">{fmt(s.hsr)}</td>
                        <td className="pr-3">{fmt(s.sprintDistance)}</td>
                        <td className="pr-3">{fmt(s.sprintCount)}</td>
                        <td className="pr-3">{fmt(s.maxVelocity, 1)}</td>
                        <td className="pr-3">{fmt(s.acceleration)}</td>
                        <td className="pr-3">{fmt(s.deceleration)}</td>
                        <td className="pr-3">{fmt(s.playerLoad)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="2. Comparação com a Pior Semana (100%)" className="col-span-12 lg:col-span-3">
              <div className="space-y-3">
                {METRICS.map(m => <ProgressLine key={m.key} label={m.label} value={currentWeek[m.key]} reference={config.piorSemana[m.key]} />)}
              </div>
            </Panel>

            <Panel title="3. Critérios de Progressão" className="col-span-12 lg:col-span-2">
              <Criteria label="Dor ≤ 2/10" ok={config.dor <= 2} />
              <Criteria label="Rigidez ≤ 2/10" ok={config.rigidez <= 2} />
              <Criteria label="Confiança ≥ 8/10" ok={config.confianca >= 8} />
              <Criteria label={`Vmax ≤ ${config.limiteVmaxPct}%`} ok={vmaxPct <= config.limiteVmaxPct} warning={vmaxPct <= config.limiteVmaxPct + 5} />
              <Criteria label="Carga semanal < 60%" ok={weeklyPct < 60} warning={weeklyPct <= 70} />
              <Criteria label="Dor pós-chute ≤ 2" ok={(config.chutes?.dor || 0) <= 2} />
            </Panel>

            <Panel title="4. Distribuição da Última Sessão" className="col-span-12 lg:col-span-3">
              <div className="space-y-2 text-sm font-bold text-zinc-200">
                <p>Distância total: <span className="text-amber-300">{last ? `${fmt(last.totalDistance)} m` : '—'}</span></p>
                <p>HSR / DT: <span className="text-amber-300">{last?.totalDistance ? fmt((last.hsr / last.totalDistance) * 100, 1) : '—'}%</span></p>
                <p>Sprint / DT: <span className="text-amber-300">{last?.totalDistance ? fmt((last.sprintDistance / last.totalDistance) * 100, 1) : '—'}%</span></p>
                <p>ACC + DCC: <span className="text-amber-300">{last ? fmt(last.acceleration + last.deceleration) : '—'}</span></p>
                <p>Player Load: <span className="text-amber-300">{last ? fmt(last.playerLoad) : '—'}</span></p>
              </div>
            </Panel>

            <Panel title="5. Carga Mecânica — Máximos e Volume" className="col-span-12 lg:col-span-3">
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="ACC semana" value={fmt(currentWeek.acceleration)} color="text-emerald-400" />
                <StatCard label="DCC semana" value={fmt(currentWeek.deceleration)} color="text-amber-300" />
                <StatCard label="Sprint semana" value={`${fmt(currentWeek.sprintDistance)} m`} color="text-red-400" />
                <StatCard label="PL semana" value={fmt(currentWeek.playerLoad)} />
              </div>
            </Panel>

            <Panel title="6. Chutes — Controle Específico" className="col-span-12 lg:col-span-3">
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Finalizações" value={config.chutes?.finalizacoes ?? 0} color="text-emerald-400" />
                <StatCard label="Fortes" value={config.chutes?.fortes ?? 0} color="text-amber-300" />
                <StatCard label="Dor pós" value={`${config.chutes?.dor ?? 0}/10`} color="text-emerald-400" />
              </div>
            </Panel>

            <Panel title="7. Observação Técnica" className="col-span-12 lg:col-span-3">
              <p className="text-sm font-semibold leading-relaxed text-zinc-200">
                {isLoadingGps ? 'Carregando dados do GPS...' : 'Usar a página para reunião rápida entre fisiologia, preparação, DM e comissão. O foco é controlar progressão, critérios e a próxima sessão em uma única tela.'}
              </p>
            </Panel>
          </div>

          <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-amber-400/50 pt-3 text-[11px] font-bold uppercase tracking-widest text-zinc-400">
            <span>Legenda: verde = ideal · amarelo = atenção · vermelho = elevado risco</span>
            <span>Dados provenientes das sessões GPS cadastradas no sistema</span>
          </footer>
        </div>
      </div>
    </div>
  )
}
