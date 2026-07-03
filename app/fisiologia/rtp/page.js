'use client'

import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'

const STORAGE_KEY = 'gnf_rtp_dashboard_v2'

const emptyWorst = {
  totalDistance: 21886,
  hsr: 687,
  sprint: 154,
  sprints: 5,
  vmax: 31.6,
  acc3: 47,
  dcc3: 74,
  playerLoad: 0,
}

const defaultData = {
  selectedId: 'arthur',
  athletes: [
    {
      id: 'arthur',
      name: 'ARTHUR BARBOSA',
      injury: 'Anterior de coxa',
      phase: 'Fase 2',
      startDate: '2026-06-18',
      pain: 1,
      stiffness: 0,
      confidence: 9,
      kickPain: 0,
      forceIndex: 90,
      asymmetry: 5,
      objective: 'Consolidar volume, controlar velocidade e evoluir carga mecânica sem ultrapassar 60% da Vmáx.',
      worst: { ...emptyWorst },
      sessions: [
        {
          id: 's1',
          date: '2026-07-01',
          label: '01/07',
          totalDistance: 3078,
          metersMin: 0,
          hsr: 0,
          sprint: 0,
          sprints: 0,
          vmax: 18.9,
          acc3: 7,
          dcc3: 5,
          playerLoad: 0,
          codLow: 177,
          codMed: 11,
          codHigh: 5,
          kicks: 0,
          strongKicks: 0,
          notes: 'Sessão Fase 2 controlada.',
          files: [],
        },
        {
          id: 's2',
          date: '2026-07-02',
          label: '02/07',
          totalDistance: 3521,
          metersMin: 0,
          hsr: 0,
          sprint: 0,
          sprints: 0,
          vmax: 18.5,
          acc3: 5,
          dcc3: 7,
          playerLoad: 0,
          codLow: 217,
          codMed: 49,
          codHigh: 16,
          kicks: 0,
          strongKicks: 0,
          notes: 'Maior volume com baixa exposição à velocidade.',
          files: [],
        },
      ],
    },
    {
      id: 'hector',
      name: 'HÉCTOR',
      injury: 'Anterior de coxa',
      phase: 'Fase 3',
      startDate: '2026-06-18',
      pain: 1,
      stiffness: 1,
      confidence: 8,
      kickPain: 0,
      forceIndex: 88,
      asymmetry: 6,
      objective: 'Aumentar especificidade, HSR controlado, chutes progressivos e resposta 24h positiva.',
      worst: { ...emptyWorst, totalDistance: 24000, hsr: 900, sprint: 250, sprints: 8, vmax: 31.0, acc3: 70, dcc3: 90, playerLoad: 2500 },
      sessions: [
        {
          id: 'h1',
          date: '2026-07-01',
          label: '01/07',
          totalDistance: 3106,
          metersMin: 0,
          hsr: 141,
          sprint: 28,
          sprints: 1,
          vmax: 25.2,
          acc3: 16,
          dcc3: 15,
          playerLoad: 0,
          codLow: 52,
          codMed: 23,
          codHigh: 11,
          kicks: 10,
          strongKicks: 2,
          notes: 'Sessão locomotora com HSR controlado.',
          files: [],
        },
        {
          id: 'h2',
          date: '2026-07-02',
          label: '02/07',
          totalDistance: 3323,
          metersMin: 0,
          hsr: 14,
          sprint: 0,
          sprints: 0,
          vmax: 21.0,
          acc3: 4,
          dcc3: 3,
          playerLoad: 0,
          codLow: 14,
          codMed: 7,
          codHigh: 2,
          kicks: 8,
          strongKicks: 0,
          notes: 'Sessão técnica/regenerativa.',
          files: [],
        },
      ],
    },
  ],
}

const metrics = [
  ['totalDistance', 'Distância Total', 'm'],
  ['hsr', 'HSR >20 km/h', 'm'],
  ['sprint', 'Sprint >25 km/h', 'm'],
  ['sprints', 'Nº Sprints', ''],
  ['acc3', 'ACC >3 m/s²', ''],
  ['dcc3', 'DCC >3 m/s²', ''],
]

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function n(value) {
  const parsed = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

function formatNumber(value, decimals = 0) {
  return n(value).toLocaleString('pt-BR', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })
}

function pct(value, reference) {
  if (!reference) return 0
  return Math.round((n(value) / n(reference)) * 100)
}

function daysBetween(dateString) {
  if (!dateString) return 0
  const start = new Date(`${dateString}T00:00:00`)
  const now = new Date()
  const diff = now.getTime() - start.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function getColorByPercent(value) {
  if (value < 60) return 'bg-emerald-500'
  if (value <= 90) return 'bg-yellow-400'
  return 'bg-red-500'
}

function getTextByPercent(value) {
  if (value < 60) return 'text-emerald-400'
  if (value <= 90) return 'text-yellow-400'
  return 'text-red-400'
}

function normalizeHeader(header = '') {
  return String(header).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
}

function getRowValue(row, possibleHeaders) {
  const normalizedRow = Object.keys(row).reduce((acc, key) => {
    acc[normalizeHeader(key)] = row[key]
    return acc
  }, {})
  for (const header of possibleHeaders) {
    const value = normalizedRow[normalizeHeader(header)]
    if (value !== undefined && value !== '') return value
  }
  return ''
}

export default function RTPPage() {
  const [data, setData] = useState(defaultData)
  const [editing, setEditing] = useState(true)
  const [plannerStart, setPlannerStart] = useState(60)
  const [plannerEnd, setPlannerEnd] = useState(90)
  const [plannerSessions, setPlannerSessions] = useState(6)
  const [message, setMessage] = useState('')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setData(JSON.parse(saved))
    } catch (error) {
      console.error(error)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.error(error)
      setMessage('Atenção: o armazenamento local ficou cheio. Reduza o tamanho dos anexos CTR.')
    }
  }, [data])

  const athlete = useMemo(() => data.athletes.find((item) => item.id === data.selectedId) || data.athletes[0], [data])
  const week = useMemo(() => athlete.sessions.reduce((acc, session) => {
    acc.totalDistance += n(session.totalDistance)
    acc.hsr += n(session.hsr)
    acc.sprint += n(session.sprint)
    acc.sprints += n(session.sprints)
    acc.acc3 += n(session.acc3)
    acc.dcc3 += n(session.dcc3)
    acc.playerLoad += n(session.playerLoad)
    return acc
  }, { totalDistance: 0, hsr: 0, sprint: 0, sprints: 0, acc3: 0, dcc3: 0, playerLoad: 0 }), [athlete])

  const lastSession = athlete.sessions[athlete.sessions.length - 1] || {}
  const vmaxLimit60 = n(athlete.worst.vmax) * 0.6
  const vmaxPct = pct(lastSession.vmax, athlete.worst.vmax)
  const readiness = useMemo(() => {
    const painScore = Math.max(0, 100 - n(athlete.pain) * 15)
    const stiffnessScore = Math.max(0, 100 - n(athlete.stiffness) * 12)
    const confidenceScore = Math.min(100, n(athlete.confidence) * 10)
    const forceScore = Math.min(100, n(athlete.forceIndex))
    const asymmetryScore = Math.max(0, 100 - n(athlete.asymmetry) * 5)
    const speedScore = n(lastSession.vmax) <= vmaxLimit60 ? 100 : Math.max(0, 100 - (n(lastSession.vmax) - vmaxLimit60) * 10)
    const loadScore = Math.max(0, 100 - Math.max(0, pct(week.totalDistance, athlete.worst.totalDistance) - 90) * 3)
    return Math.round((painScore * 0.18) + (stiffnessScore * 0.12) + (confidenceScore * 0.12) + (forceScore * 0.18) + (asymmetryScore * 0.15) + (speedScore * 0.15) + (loadScore * 0.10))
  }, [athlete, lastSession, week, vmaxLimit60])

  function updateAthlete(patch) {
    setData((prev) => ({
      ...prev,
      athletes: prev.athletes.map((item) => item.id === athlete.id ? { ...item, ...patch } : item),
    }))
  }

  function updateWorst(key, value) {
    updateAthlete({ worst: { ...athlete.worst, [key]: n(value) } })
  }

  function updateSession(sessionId, patch) {
    updateAthlete({
      sessions: athlete.sessions.map((session) => session.id === sessionId ? { ...session, ...patch } : session),
    })
  }

  function addAthlete() {
    const id = uid()
    const newAthlete = {
      ...defaultData.athletes[0],
      id,
      name: 'NOVO ATLETA',
      sessions: [],
      worst: { ...emptyWorst },
    }
    setData((prev) => ({ ...prev, selectedId: id, athletes: [...prev.athletes, newAthlete] }))
  }

  function addSession() {
    updateAthlete({
      sessions: [
        ...athlete.sessions,
        {
          id: uid(),
          date: new Date().toISOString().slice(0, 10),
          label: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          totalDistance: 0,
          metersMin: 0,
          hsr: 0,
          sprint: 0,
          sprints: 0,
          vmax: 0,
          acc3: 0,
          dcc3: 0,
          playerLoad: 0,
          codLow: 0,
          codMed: 0,
          codHigh: 0,
          kicks: 0,
          strongKicks: 0,
          notes: '',
          files: [],
        },
      ],
    })
  }

  function removeSession(sessionId) {
    updateAthlete({ sessions: athlete.sessions.filter((session) => session.id !== sessionId) })
  }

  async function attachFiles(sessionId, files) {
    const fileList = Array.from(files || [])
    const encoded = await Promise.all(fileList.map((file) => new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve({ id: uid(), name: file.name, type: file.type, size: file.size, dataUrl: reader.result })
      reader.readAsDataURL(file)
    })))
    const session = athlete.sessions.find((item) => item.id === sessionId)
    updateSession(sessionId, { files: [...(session?.files || []), ...encoded] })
  }

  function removeFile(sessionId, fileId) {
    const session = athlete.sessions.find((item) => item.id === sessionId)
    updateSession(sessionId, { files: (session?.files || []).filter((file) => file.id !== fileId) })
  }

  function importCtrCsv(file) {
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const imported = result.data.map((row) => {
          const date = getRowValue(row, ['date', 'data', 'session date']) || new Date().toISOString().slice(0, 10)
          const safeDate = String(date).includes('/') ? String(date).split('/').reverse().join('-') : String(date).slice(0, 10)
          return {
            id: uid(),
            date: safeDate,
            label: String(date).includes('/') ? String(date).slice(0, 5) : new Date(`${safeDate}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            totalDistance: n(getRowValue(row, ['distancia total', 'dist total', 'total distance', 'distance', 'dt'])),
            metersMin: n(getRowValue(row, ['metros/min', 'm/min', 'meterage per minute', 'distancia relativa'])),
            hsr: n(getRowValue(row, ['hsr', 'dist 20/25', '20-25', 'dist 20 25', 'high speed running'])),
            sprint: n(getRowValue(row, ['sprint', 'dist 25', '>25', 'dist >25', 'sprint distance'])),
            sprints: n(getRowValue(row, ['n sprints', 'sprints', 'sprint count', 'nº sprints'])),
            vmax: n(getRowValue(row, ['vmax', 'vel max', 'velocidade maxima', 'max velocity', 'max speed'])),
            acc3: n(getRowValue(row, ['acc >3', 'acc3', 'acc 3', 'acceleration 3'])),
            dcc3: n(getRowValue(row, ['dcc >3', 'dcc3', 'dec >3', 'deceleration 3'])),
            playerLoad: n(getRowValue(row, ['player load', 'playerload', 'pl'])),
            codLow: n(getRowValue(row, ['cod baixo', 'low cod'])),
            codMed: n(getRowValue(row, ['cod medio', 'cod médio', 'medium cod'])),
            codHigh: n(getRowValue(row, ['cod alto', 'high cod'])),
            kicks: n(getRowValue(row, ['chutes', 'kicks', 'finalizacoes', 'finalizações'])),
            strongKicks: n(getRowValue(row, ['chutes fortes', 'strong kicks'])),
            notes: `Importado do CTR: ${file.name}`,
            files: [],
          }
        }).filter((session) => session.totalDistance || session.vmax || session.hsr || session.sprint)
        updateAthlete({ sessions: [...athlete.sessions, ...imported] })
        setMessage(`${imported.length} sessão(ões) importada(s) do CTR.`)
      },
    })
  }

  function plannerRows() {
    const total = Math.max(1, n(plannerSessions))
    const start = n(plannerStart)
    const end = n(plannerEnd)
    return Array.from({ length: total }).map((_, index) => {
      const p = total === 1 ? end : start + ((end - start) / (total - 1)) * index
      return {
        session: index + 1,
        p: Math.round(p),
        totalDistance: Math.round(athlete.worst.totalDistance * p / 100),
        hsr: Math.round(athlete.worst.hsr * p / 100),
        sprint: Math.round(athlete.worst.sprint * p / 100),
        sprints: Math.round(athlete.worst.sprints * p / 100),
        vmax: (athlete.worst.vmax * p / 100).toFixed(1),
        acc3: Math.round(athlete.worst.acc3 * p / 100),
        dcc3: Math.round(athlete.worst.dcc3 * p / 100),
      }
    })
  }

  function printPdf() {
    document.title = `RTP_${athlete.name}`
    window.print()
  }

  return (
    <main className="min-h-screen bg-black text-white p-4 print:p-0">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 6mm; }
          body { background: #000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          [data-pdf-hide] { display: none !important; }
          [data-pdf-root] { width: 100% !important; transform: scale(.82); transform-origin: top left; }
          aside, nav { display: none !important; }
        }
        .input { width: 100%; border-radius: .5rem; border: 1px solid rgb(63 63 70); background: #050505; padding: .5rem .65rem; color: white; font-size: .85rem; font-weight: 700; outline: none; }
        .input:focus { border-color: rgb(234 179 8); box-shadow: 0 0 0 1px rgba(234,179,8,.35); }
        @media print {
          .input { border: none; background: transparent; padding: 0; }
        }
      `}</style>

      <div data-pdf-hide className="mx-auto mb-4 max-w-[1500px] rounded-2xl border border-yellow-500 bg-zinc-950 p-4 shadow-2xl">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setEditing(!editing)} className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-black text-black hover:bg-yellow-300">
            {editing ? 'Ocultar edição' : 'Editar dashboard'}
          </button>
          <button onClick={printPdf} className="rounded-lg border border-yellow-500 px-4 py-2 text-sm font-black text-yellow-300 hover:bg-yellow-500/10">
            Gerar PDF
          </button>
          <button onClick={addAthlete} className="rounded-lg border border-emerald-500 px-4 py-2 text-sm font-black text-emerald-300 hover:bg-emerald-500/10">
            + Cadastrar atleta
          </button>
          <label className="rounded-lg border border-sky-500 px-4 py-2 text-sm font-black text-sky-300 hover:bg-sky-500/10 cursor-pointer">
            Importar CTR/CSV
            <input type="file" accept=".csv,.txt" className="hidden" onChange={(e) => importCtrCsv(e.target.files?.[0])} />
          </label>
          {message && <span className="text-sm text-yellow-300">{message}</span>}
        </div>
      </div>

      {editing && (
        <section data-pdf-hide className="mx-auto mb-4 grid max-w-[1500px] grid-cols-1 gap-4 xl:grid-cols-3">
          <Panel title="Cadastro do atleta">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Selecionar atleta">
                <select value={athlete.id} onChange={(e) => setData((prev) => ({ ...prev, selectedId: e.target.value }))} className="input">
                  {data.athletes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Nome">
                <input value={athlete.name} onChange={(e) => updateAthlete({ name: e.target.value })} className="input" />
              </Field>
              <Field label="Lesão">
                <input value={athlete.injury} onChange={(e) => updateAthlete({ injury: e.target.value })} className="input" />
              </Field>
              <Field label="Fase">
                <input value={athlete.phase} onChange={(e) => updateAthlete({ phase: e.target.value })} className="input" />
              </Field>
              <Field label="Início RTP">
                <input type="date" value={athlete.startDate} onChange={(e) => updateAthlete({ startDate: e.target.value })} className="input" />
              </Field>
              <Field label="Objetivo da próxima sessão">
                <input value={athlete.objective} onChange={(e) => updateAthlete({ objective: e.target.value })} className="input" />
              </Field>
            </div>
          </Panel>

          <Panel title="Pior cenário do atleta (digitação manual)">
            <div className="grid grid-cols-3 gap-3">
              {[
                ['totalDistance', 'DT'], ['hsr', 'HSR'], ['sprint', 'Sprint'], ['sprints', 'Nº Sprints'], ['vmax', 'Vmáx'], ['acc3', 'ACC >3'], ['dcc3', 'DCC >3'], ['playerLoad', 'Player Load'],
              ].map(([key, label]) => (
                <Field key={key} label={label}>
                  <input type="number" value={athlete.worst[key]} onChange={(e) => updateWorst(key, e.target.value)} className="input" />
                </Field>
              ))}
            </div>
          </Panel>

          <Panel title="Indicadores clínicos / critérios">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Dor 0-10"><input type="number" value={athlete.pain} onChange={(e) => updateAthlete({ pain: n(e.target.value) })} className="input" /></Field>
              <Field label="Rigidez 0-10"><input type="number" value={athlete.stiffness} onChange={(e) => updateAthlete({ stiffness: n(e.target.value) })} className="input" /></Field>
              <Field label="Confiança 0-10"><input type="number" value={athlete.confidence} onChange={(e) => updateAthlete({ confidence: n(e.target.value) })} className="input" /></Field>
              <Field label="Dor pós-chute"><input type="number" value={athlete.kickPain} onChange={(e) => updateAthlete({ kickPain: n(e.target.value) })} className="input" /></Field>
              <Field label="Força %"><input type="number" value={athlete.forceIndex} onChange={(e) => updateAthlete({ forceIndex: n(e.target.value) })} className="input" /></Field>
              <Field label="Assimetria %"><input type="number" value={athlete.asymmetry} onChange={(e) => updateAthlete({ asymmetry: n(e.target.value) })} className="input" /></Field>
            </div>
          </Panel>
        </section>
      )}

      <section data-pdf-root className="mx-auto max-w-[1500px] rounded-3xl border border-yellow-500 bg-black p-5 shadow-[0_0_40px_rgba(234,179,8,.18)]">
        <div className="mb-4 grid grid-cols-12 gap-4 border-b border-yellow-500/50 pb-4">
          <div className="col-span-5 flex items-center gap-4">
            <img src="/club/escudonovorizontino.png" className="h-24 w-24 object-contain" alt="Escudo" />
            <div>
              <h1 className="text-3xl font-black uppercase leading-none text-yellow-400">Grêmio Novorizontino SAF</h1>
              <h2 className="mt-1 text-xl font-black uppercase tracking-wide text-zinc-100">Dashboard RTP — Retorno de Lesão</h2>
              <p className="text-sm font-bold uppercase tracking-widest text-zinc-400">Departamento de Performance</p>
            </div>
          </div>
          <TopCard label="Atleta" value={athlete.name} />
          <TopCard label="Fase" value={athlete.phase} />
          <TopCard label="Dias RTP" value={daysBetween(athlete.startDate)} sub={`Início: ${athlete.startDate}`} />
          <TopCard label="Readiness" value={`${readiness}%`} color={readiness >= 80 ? 'text-emerald-400' : readiness >= 60 ? 'text-yellow-400' : 'text-red-400'} />
          <TopCard label="Vmax limite" value={`≤ ${formatNumber(vmaxLimit60, 1)}`} sub="60% da Vmáx" color="text-emerald-400" />
        </div>

        <div className="grid grid-cols-12 gap-4">
          <Box className="col-span-3" title="Situação clínica">
            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="Dor" value={`${athlete.pain}/10`} color="text-emerald-400" />
              <MiniStat label="Rigidez" value={`${athlete.stiffness}/10`} color="text-emerald-400" />
              <MiniStat label="Confiança" value={`${athlete.confidence}/10`} color="text-emerald-400" />
            </div>
            <p className="mt-4 text-xs font-bold text-zinc-300"><span className="text-yellow-400">Lesão:</span> {athlete.injury}</p>
            <p className="text-xs font-bold text-zinc-300"><span className="text-yellow-400">Última sessão:</span> {lastSession.label || '-'} · {formatNumber(lastSession.totalDistance)} m · Vmáx {formatNumber(lastSession.vmax, 1)} km/h</p>
          </Box>

          <Box className="col-span-4" title="Resumo da última sessão">
            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="Distância" value={formatNumber(lastSession.totalDistance)} />
              <MiniStat label="m/min" value={formatNumber(lastSession.metersMin, 1)} />
              <MiniStat label="Vmax" value={formatNumber(lastSession.vmax, 1)} sub={`${vmaxPct}% da Vmáx`} />
              <MiniStat label="HSR" value={`${formatNumber(lastSession.hsr)} m`} />
              <MiniStat label="Sprint" value={`${formatNumber(lastSession.sprint)} m`} />
              <MiniStat label="ACC/DCC" value={`${formatNumber(lastSession.acc3)}/${formatNumber(lastSession.dcc3)}`} />
            </div>
          </Box>

          <Box className="col-span-3" title="Próxima meta">
            <p className="text-sm font-bold leading-relaxed text-zinc-200">{athlete.objective}</p>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-black">
              <span>DT: <b className="text-yellow-400">{formatNumber(athlete.worst.totalDistance * plannerStart / 100)} m</b></span>
              <span>HSR: <b className="text-yellow-400">{formatNumber(athlete.worst.hsr * plannerStart / 100)} m</b></span>
              <span>Sprint: <b className="text-yellow-400">{formatNumber(athlete.worst.sprint * plannerStart / 100)} m</b></span>
              <span>Vmax: <b className="text-yellow-400">{formatNumber(athlete.worst.vmax * plannerStart / 100, 1)} km/h</b></span>
              <span>ACC: <b className="text-yellow-400">{formatNumber(athlete.worst.acc3 * plannerStart / 100)}</b></span>
              <span>DCC: <b className="text-yellow-400">{formatNumber(athlete.worst.dcc3 * plannerStart / 100)}</b></span>
            </div>
          </Box>

          <Box className="col-span-2" title="Status">
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-[12px] border-yellow-400 text-center shadow-[0_0_20px_rgba(234,179,8,.4)]">
              <div><p className="text-3xl font-black text-emerald-400">{readiness}%</p><p className="text-xs font-black text-zinc-300">READINESS</p></div>
            </div>
            <div className="mt-2 space-y-1 text-xs font-bold"><Legend color="bg-emerald-500" text="≥80% pronto" /><Legend color="bg-yellow-400" text="60–79% atenção" /><Legend color="bg-red-500" text="<60% risco" /></div>
          </Box>

          <Box className="col-span-6" title="1. Evolução da carga externa">
            <div className="mb-3 flex h-28 items-end gap-4 border-b border-zinc-700 pb-2">
              {athlete.sessions.slice(-8).map((session) => {
                const max = Math.max(...athlete.sessions.map((s) => n(s.totalDistance)), 1)
                return <div key={session.id} className="flex flex-1 flex-col items-center gap-1"><span className="text-[10px] font-black text-zinc-300">{session.label}</span><span className="text-[10px] font-black text-white">{formatNumber(session.totalDistance)}</span><div className="w-full rounded-t bg-yellow-400" style={{ height: `${Math.max(8, n(session.totalDistance) / max * 75)}px` }} /></div>
              })}
            </div>
            <SessionTable sessions={athlete.sessions} updateSession={updateSession} removeSession={removeSession} attachFiles={attachFiles} removeFile={removeFile} editing={editing} />
            {editing && <button data-pdf-hide onClick={addSession} className="mt-3 rounded-lg bg-yellow-400 px-3 py-2 text-xs font-black text-black">+ Adicionar sessão</button>}
          </Box>

          <Box className="col-span-3" title="2. Comparação com a pior semana (100%)">
            {metrics.map(([key, label]) => <Progress key={key} label={label} value={week[key]} reference={athlete.worst[key]} />)}
          </Box>

          <Box className="col-span-3" title="3. Critérios de progressão">
            <Criteria label="Dor ≤ 2/10" ok={athlete.pain <= 2} />
            <Criteria label="Rigidez ≤ 2/10" ok={athlete.stiffness <= 2} />
            <Criteria label="Confiança ≥ 8/10" ok={athlete.confidence >= 8} />
            <Criteria label="Vmáx ≤ 60%" ok={lastSession.vmax <= vmaxLimit60} warn={lastSession.vmax > vmaxLimit60 && lastSession.vmax <= athlete.worst.vmax * .75} />
            <Criteria label="Carga semanal ≤ 90%" ok={pct(week.totalDistance, athlete.worst.totalDistance) <= 90} warn={pct(week.totalDistance, athlete.worst.totalDistance) <= 100} />
            <Criteria label="Dor pós-chute ≤ 2" ok={athlete.kickPain <= 2} />
          </Box>

          <Box className="col-span-3" title="4. Distribuição da última sessão">
            <p className="text-sm font-bold">Distância total: <b className="text-yellow-400">{formatNumber(lastSession.totalDistance)} m</b></p>
            <p className="text-sm font-bold">HSR / DT: <b className="text-yellow-400">{formatNumber(pct(lastSession.hsr, lastSession.totalDistance), 1)}%</b></p>
            <p className="text-sm font-bold">Sprint / DT: <b className="text-yellow-400">{formatNumber(pct(lastSession.sprint, lastSession.totalDistance), 1)}%</b></p>
            <p className="text-sm font-bold">ACC + DCC: <b className="text-yellow-400">{formatNumber(n(lastSession.acc3) + n(lastSession.dcc3))}</b></p>
            <p className="text-sm font-bold">Player Load: <b className="text-yellow-400">{formatNumber(lastSession.playerLoad)}</b></p>
          </Box>

          <Box className="col-span-3" title="5. Carga mecânica — semana">
            <div className="grid grid-cols-2 gap-3"><MiniStat label="ACC semana" value={formatNumber(week.acc3)} /><MiniStat label="DCC semana" value={formatNumber(week.dcc3)} /><MiniStat label="Sprint semana" value={`${formatNumber(week.sprint)} m`} color="text-red-400" /><MiniStat label="PL semana" value={formatNumber(week.playerLoad)} /></div>
          </Box>

          <Box className="col-span-3" title="6. Chutes — controle específico">
            <div className="grid grid-cols-3 gap-2"><MiniStat label="Finalizações" value={formatNumber(lastSession.kicks)} /><MiniStat label="Fortes" value={formatNumber(lastSession.strongKicks)} /><MiniStat label="Dor pós" value={`${athlete.kickPain}/10`} color="text-emerald-400" /></div>
          </Box>

          <Box className="col-span-3" title="7. Observação técnica">
            <p className="text-sm font-bold leading-relaxed text-zinc-200">Usar a página para reunião rápida entre fisiologia, preparação, DM e comissão. O foco é controlar progressão, critérios e a próxima sessão em uma única tela.</p>
          </Box>

          <Box className="col-span-12" title={`8. Planejador automático — ${plannerStart}% até ${plannerEnd}% do pior cenário`}>
            <div data-pdf-hide className="mb-3 flex flex-wrap gap-3">
              <Field label="Início %"><input className="input w-24" type="number" value={plannerStart} onChange={(e) => setPlannerStart(n(e.target.value))} /></Field>
              <Field label="Final %"><input className="input w-24" type="number" value={plannerEnd} onChange={(e) => setPlannerEnd(n(e.target.value))} /></Field>
              <Field label="Sessões"><input className="input w-24" type="number" value={plannerSessions} onChange={(e) => setPlannerSessions(n(e.target.value))} /></Field>
            </div>
            <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-yellow-400">{['Sessão','%','DT','HSR','Sprint','Nº Sprint','Vmax','ACC>3','DCC>3'].map((h) => <th className="p-2 text-left" key={h}>{h}</th>)}</tr></thead><tbody>{plannerRows().map((row) => <tr key={row.session} className="border-t border-zinc-800"><td className="p-2 font-black">S{row.session}</td><td className={`p-2 font-black ${getTextByPercent(row.p)}`}>{row.p}%</td><td className="p-2">{formatNumber(row.totalDistance)}</td><td className="p-2">{formatNumber(row.hsr)}</td><td className="p-2">{formatNumber(row.sprint)}</td><td className="p-2">{row.sprints}</td><td className="p-2">{row.vmax}</td><td className="p-2">{row.acc3}</td><td className="p-2">{row.dcc3}</td></tr>)}</tbody></table></div>
          </Box>
        </div>

        <footer className="mt-4 flex items-center justify-between border-t border-yellow-500/50 pt-3 text-[11px] font-black uppercase tracking-widest text-zinc-400">
          <span>Legenda: verde = ideal · amarelo = atenção · vermelho = elevado risco</span>
          <span>Dados provenientes das sessões GPS/CTR cadastradas no sistema</span>
        </footer>
      </section>
    </main>
  )
}

function Panel({ title, children }) {
  return <div className="rounded-2xl border border-yellow-500 bg-zinc-950 p-4"><h3 className="mb-3 text-sm font-black uppercase text-yellow-400">{title}</h3>{children}</div>
}

function Field({ label, children }) {
  return <label className="block text-[11px] font-black uppercase tracking-wide text-zinc-400">{label}<div className="mt-1">{children}</div></label>
}

function Box({ title, className = '', children }) {
  return <section className={`rounded-xl border border-yellow-500 bg-black/80 p-3 ${className}`}><h3 className="mb-3 text-sm font-black uppercase text-yellow-400">{title}</h3>{children}</section>
}

function TopCard({ label, value, sub, color = 'text-yellow-400' }) {
  return <div className="col-span-1 rounded-xl border border-yellow-500 p-3 text-center"><p className="text-[11px] font-black uppercase tracking-widest text-zinc-300">{label}</p><p className={`truncate text-xl font-black ${color}`}>{value}</p>{sub && <p className="text-[10px] font-bold text-zinc-400">{sub}</p>}</div>
}

function MiniStat({ label, value, sub, color = 'text-yellow-400' }) {
  return <div className="rounded-lg border border-yellow-500/70 p-3 text-center"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</p><p className={`text-xl font-black ${color}`}>{value}</p>{sub && <p className="text-[10px] font-bold text-zinc-400">{sub}</p>}</div>
}

function Legend({ color, text }) {
  return <div className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${color}`} /> <span>{text}</span></div>
}

function Progress({ label, value, reference }) {
  const p = pct(value, reference)
  return <div className="mb-3"><div className="mb-1 flex justify-between text-xs font-black"><span>{label}</span><span className={getTextByPercent(p)}>{p}%</span></div><div className="h-3 rounded-full bg-zinc-800"><div className={`h-3 rounded-full ${getColorByPercent(p)}`} style={{ width: `${Math.min(100, p)}%` }} /></div></div>
}

function Criteria({ label, ok, warn }) {
  const color = ok ? 'bg-emerald-500' : warn ? 'bg-yellow-400' : 'bg-red-500'
  return <div className="mb-2 flex items-center justify-between border-b border-zinc-800 pb-2 text-xs font-bold"><span>{label}</span><span className={`h-3 w-3 rounded-full ${color}`} /></div>
}

function SessionTable({ sessions, updateSession, removeSession, attachFiles, removeFile, editing }) {
  const cols = [
    ['date', 'Data'], ['totalDistance', 'DT'], ['metersMin', 'm/min'], ['hsr', 'HSR'], ['sprint', 'Sprint'], ['sprints', 'Nº Sprint'], ['vmax', 'Vmax'], ['acc3', 'ACC'], ['dcc3', 'DCC'], ['playerLoad', 'PL'],
  ]
  return <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-yellow-400">{cols.map(([, label]) => <th key={label} className="p-1 text-left">{label}</th>)}{editing && <th className="p-1">CTR</th>}</tr></thead><tbody>{sessions.map((s) => <tr key={s.id} className="border-t border-zinc-800">{cols.map(([key]) => <td key={key} className="p-1">{editing ? <input type={key === 'date' ? 'date' : 'number'} value={s[key] || ''} onChange={(e) => updateSession(s.id, { [key]: key === 'date' ? e.target.value : n(e.target.value), label: key === 'date' ? new Date(`${e.target.value}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : s.label })} className="w-20 rounded border border-zinc-700 bg-black px-1 py-1 text-white" /> : (key === 'date' ? s.label : formatNumber(s[key], key === 'vmax' || key === 'metersMin' ? 1 : 0))}</td>)}{editing && <td className="p-1"><div className="flex flex-col gap-1"><label className="cursor-pointer rounded bg-zinc-800 px-2 py-1 text-center text-[10px] font-black text-yellow-300">Anexar<input className="hidden" type="file" multiple accept=".pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg" onChange={(e) => attachFiles(s.id, e.target.files)} /></label><button onClick={() => removeSession(s.id)} className="rounded bg-red-500/20 px-2 py-1 text-[10px] font-black text-red-300">Excluir</button>{(s.files || []).map((file) => <div key={file.id} className="flex items-center gap-1 text-[10px]"><a href={file.dataUrl} download={file.name} className="max-w-[100px] truncate text-sky-300">{file.name}</a><button onClick={() => removeFile(s.id, file.id)} className="text-red-300">x</button></div>)}</div></td>}</tr>)}</tbody></table></div>
}
