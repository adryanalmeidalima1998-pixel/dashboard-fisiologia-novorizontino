'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo } from 'react'
import { useData, calcVmaxPct } from '../../context/DataContext'
import { AthleteAvatar } from '../../utils/athletePhotos'

// ─── CONFIGURAÇÃO DE MÉTRICAS ─────────────────────────────────────────────────
const METRICS = [
  { key: 'totalDistance',   label: 'Distância Total', unit: 'm',     decimals: 0, higherBetter: true,  color: '#f59e0b', icon: '📏' },
  { key: 'distanceRelative',label: 'm/min',           unit: 'm/min', decimals: 1, higherBetter: true,  color: '#10b981', icon: '⚡' },
  { key: 'hsr',             label: 'HSR',             unit: 'm',     decimals: 0, higherBetter: true,  color: '#3b82f6', icon: '🚀' },
  { key: 'sprintDistance',  label: 'Sprint',          unit: 'm',     decimals: 0, higherBetter: true,  color: '#ef4444', icon: '💨' },
  { key: 'sprintCount',     label: 'Nº Sprints',      unit: '',      decimals: 0, higherBetter: true,  color: '#8b5cf6', icon: '🔢' },
  { key: 'accDecel',        label: 'ACC + DEC',       unit: '',      decimals: 0, higherBetter: true,  color: '#f97316', icon: '🔄' },
  { key: 'playerLoad',      label: 'Player Load',     unit: '',      decimals: 0, higherBetter: true,  color: '#06b6d4', icon: '🔋' },
  { key: 'vmaxPct',         label: '% Vmax',          unit: '%',     decimals: 0, higherBetter: true,  color: '#ec4899', icon: '🏁' },
]

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getWeekBounds(offset = 0) {
  const today = new Date()
  const dow = today.getDay() === 0 ? 6 : today.getDay() - 1
  const monday = new Date(today)
  monday.setDate(today.getDate() - dow + offset * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { monday, sunday }
}

function fmtMetric(value, metric) {
  if (value == null || isNaN(value)) return '—'
  return metric.decimals === 1 ? value.toFixed(1) : value.toFixed(0)
}

function deltaCls(delta) {
  if (delta > 0) return 'text-green-600'
  if (delta < 0) return 'text-red-500'
  return 'text-slate-400'
}

function deltaSign(delta) {
  if (delta > 0) return `+${delta.toFixed(0)}`
  return delta.toFixed(0)
}

// ─── COMPONENTE: CARD DO ATLETA ───────────────────────────────────────────────
function AthleteCard({ rank, athlete, value, avg, metric, isTop, onClick }) {
  const delta = value != null && avg != null ? value - avg : null
  const pct = avg > 0 && value != null ? Math.round((value / avg) * 100) : null
  const barWidth = pct ? Math.min(pct, 150) : 0
  const barColor = isTop ? metric.color : '#ef4444'
  const rankColors = isTop
    ? ['bg-amber-400 text-black', 'bg-slate-300 text-slate-800', 'bg-amber-700 text-white', 'bg-slate-100 text-slate-600', 'bg-slate-100 text-slate-600']
    : ['bg-red-600 text-white', 'bg-red-400 text-white', 'bg-red-300 text-red-900', 'bg-slate-100 text-slate-600', 'bg-slate-100 text-slate-600']

  return (
    <div
      onClick={onClick}
      className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col gap-3 cursor-pointer hover:shadow-md hover:border-slate-200 transition-all group"
    >
      {/* Rank + atleta */}
      <div className="flex items-center gap-3">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${rankColors[rank - 1] || 'bg-slate-100 text-slate-600'}`}>
          {rank}
        </div>
        <AthleteAvatar name={athlete.name} size="w-10 h-10" ring />
        <div className="flex-1 min-w-0">
          <p className="font-black text-black text-sm leading-tight truncate">
            {athlete.name.split(' ').slice(0, 2).join(' ')}
          </p>
          {athlete.position && (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{athlete.position}</p>
          )}
        </div>
        {/* Valor principal */}
        <div className="text-right flex-shrink-0">
          <p className="text-xl font-black leading-none" style={{ color: barColor }}>
            {fmtMetric(value, metric)}
          </p>
          <p className="text-[9px] font-bold text-slate-400 uppercase">{metric.unit || 'un.'}</p>
        </div>
      </div>

      {/* Barra comparativa vs média */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">vs Média do Grupo</span>
          {delta != null && (
            <span className={`text-[10px] font-black ${deltaCls(delta)}`}>
              {deltaSign(delta)} {metric.unit}
            </span>
          )}
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden relative">
          {/* linha de referência 100% */}
          <div className="absolute top-0 bottom-0 w-px bg-slate-300" style={{ left: '66.6%' }} />
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(barWidth * 0.666, 100)}%`,
              backgroundColor: barColor,
              opacity: 0.85,
            }}
          />
        </div>
        {pct != null && (
          <p className="text-[9px] font-bold text-slate-400 mt-0.5 text-right">{pct}% da média</p>
        )}
      </div>
    </div>
  )
}

// ─── COMPONENTE: SEÇÃO TOP/BOTTOM ─────────────────────────────────────────────
function RankingSection({ title, emoji, athletes, metric, avg, isTop, onAthleteClick }) {
  if (!athletes.length) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">{emoji} {title}</h3>
        <div className="bg-slate-50 rounded-2xl p-8 text-center text-slate-300 text-sm font-medium">
          Sem dados suficientes
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-black uppercase tracking-widest" style={{ color: isTop ? metric.color : '#ef4444' }}>
        {emoji} {title}
      </h3>
      <div className="flex flex-col gap-2">
        {athletes.map((a, i) => (
          <AthleteCard
            key={a.name}
            rank={i + 1}
            athlete={a}
            value={a.value}
            avg={avg}
            metric={metric}
            isTop={isTop}
            onClick={() => onAthleteClick(a.name)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function DestaquesDashboard() {
  const router = useRouter()
  const { gpsData, playerPositions, vmaxBaseline, isExcluded } = useData()

  // ── Estado de filtros ──────────────────────────────────────────────────────
  const [mode, setMode] = useState('sessao')          // 'sessao' | 'semanal'
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedMetricKey, setSelectedMetricKey] = useState('totalDistance')
  const [topN] = useState(5)
  const [sessionTypeFilter, setSessionTypeFilter] = useState('todos') // 'todos' | 'treino' | 'jogo'

  // ── Sessões disponíveis ────────────────────────────────────────────────────
  const sessionOptions = useMemo(() => [...gpsData].reverse(), [gpsData])

  const activeSession = useMemo(() => {
    if (selectedSessionId) return gpsData.find(s => s.id === selectedSessionId) || null
    return sessionOptions[0] || null
  }, [gpsData, sessionOptions, selectedSessionId])

  // ── Semana ─────────────────────────────────────────────────────────────────
  const { monday, sunday } = useMemo(() => getWeekBounds(weekOffset), [weekOffset])
  const weekLabel = `${monday.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${sunday.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`

  const weekSessions = useMemo(() => {
    return gpsData.filter(s => {
      const dateStr = s.date || ''
      let dt
      if (dateStr.includes('-')) {
        dt = new Date(dateStr + 'T12:00:00')
      } else {
        const [d, m, y] = dateStr.split('/')
        if (!d || !m || !y) return false
        dt = new Date(`${y}-${m}-${d}T12:00:00`)
      }
      if (!(dt >= monday && dt <= sunday)) return false
      if (sessionTypeFilter === 'todos') return true
      const t = s.metadata?.sessionType || s.metadata?.type || ''
      return t === sessionTypeFilter
    })
  }, [gpsData, monday, sunday, sessionTypeFilter])

  // ── Dados de atletas para o contexto selecionado ───────────────────────────
  const athleteRows = useMemo(() => {
    // Pega as rows period=0, não-outlier, e injeta vmaxPct
    const sessions = mode === 'sessao'
      ? (activeSession ? [activeSession] : [])
      : weekSessions

    // Agrega por atleta: soma distâncias, maior velocidade, etc.
    const map = {}

    for (const session of sessions) {
      for (const row of session.rows) {
        if (row.periodNumber !== 0 || row.isOutlier || !row.playerName) continue
        const name = row.playerName
        if (isExcluded(name)) continue
        if (!map[name]) {
          map[name] = {
            name,
            position: playerPositions[name] || null,
            sessions: 0,
            totalDistance: 0,
            hsr: 0,
            sprintDistance: 0,
            sprintCount: 0,
            accDecel: 0,
            playerLoad: 0,
            distanceRelativeSum: 0,
            maxVelocity: 0,
          }
        }
        const a = map[name]
        a.sessions++
        a.totalDistance += row.totalDistance || 0
        a.hsr += row.hsr || 0
        a.sprintDistance += row.sprintDistance || 0
        a.sprintCount += row.sprintCount || 0
        a.accDecel += (row.acceleration || 0) + (row.deceleration || 0)
        a.playerLoad += row.playerLoad || 0
        a.distanceRelativeSum += row.distanceRelative || 0
        a.maxVelocity = Math.max(a.maxVelocity, row.maxVelocity || 0)
      }
    }

    // Calcula derivados
    return Object.values(map).map(a => ({
      ...a,
      distanceRelative: a.sessions > 0 ? a.distanceRelativeSum / a.sessions : 0,
      vmaxPct: (() => {
        const baseline = vmaxBaseline[a.name]
        return baseline && a.maxVelocity ? calcVmaxPct(a.maxVelocity, baseline) : null
      })(),
    }))
  }, [mode, activeSession, weekSessions, playerPositions, vmaxBaseline])

  // ── Métrica selecionada ────────────────────────────────────────────────────
  const metric = METRICS.find(m => m.key === selectedMetricKey) || METRICS[0]

  // ── Ranking ────────────────────────────────────────────────────────────────
  const { top5, bottom5, avg } = useMemo(() => {
    const withValue = athleteRows
      .map(a => ({ ...a, value: a[metric.key] }))
      .filter(a => a.value != null && !isNaN(a.value) && a.value > 0)

    if (!withValue.length) return { top5: [], bottom5: [], avg: null }

    withValue.sort((a, b) => b.value - a.value)

    const avgVal = withValue.reduce((s, a) => s + a.value, 0) / withValue.length

    const top = withValue.slice(0, topN)
    const bot = [...withValue].reverse().slice(0, topN).reverse() // pior primeiro → reordenar pior ao melhor dos piores

    return { top5: top, bottom5: bot, avg: avgVal }
  }, [athleteRows, metric, topN])

  // ── Stats de contexto ──────────────────────────────────────────────────────
  const contextLabel = mode === 'sessao'
    ? (activeSession ? `${activeSession.name} · ${activeSession.date}` : 'Nenhuma sessão')
    : weekLabel

  const nSessions = mode === 'sessao' ? (activeSession ? 1 : 0) : weekSessions.length
  const sessionTypeBadge = mode === 'semanal' && sessionTypeFilter !== 'todos'
    ? (sessionTypeFilter === 'treino' ? '🏃 Só treinos' : '⚽ Só jogos')
    : null

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white text-black p-4 font-sans">
      <div className="max-w-[1400px] mx-auto flex flex-col gap-5">

        {/* HEADER */}
        <header className="flex flex-wrap justify-between items-center border-b-4 border-amber-500 pb-3 gap-3">
          <div className="flex items-center gap-4">
            <img src="/club/escudonovorizontino.png" alt="Escudo" className="h-14 w-auto" />
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-black uppercase leading-none">Destaques</h1>
              <p className="text-sm font-bold tracking-widest text-slate-500 uppercase">Top 5 · Bottom 5 por Métrica</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/fisiologia')}
            className="bg-slate-200 text-slate-800 px-3 py-1.5 rounded-md text-xs font-black hover:bg-slate-300 transition-colors"
          >
            ← VOLTAR
          </button>
        </header>

        {/* CONTROLES */}
        <div className="flex flex-wrap gap-3 items-start">

          {/* Toggle Sessão / Semanal */}
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            {[
              { id: 'sessao',  label: '📋 Por Sessão' },
              { id: 'semanal', label: '📅 Semanal' },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${
                  mode === m.id
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Toggle Tipo de Sessão — só aparece no modo semanal */}
          {mode === 'semanal' && (
            <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
              {[
                { id: 'todos',  label: 'Todos' },
                { id: 'treino', label: '🏃 Treino' },
                { id: 'jogo',   label: '⚽ Jogo' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setSessionTypeFilter(t.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${
                    sessionTypeFilter === t.id
                      ? t.id === 'jogo' ? 'bg-green-500 text-white shadow-sm' : t.id === 'treino' ? 'bg-blue-500 text-white shadow-sm' : 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Filtro sessão */}
          {mode === 'sessao' && (
            <select
              value={selectedSessionId || ''}
              onChange={e => setSelectedSessionId(e.target.value ? Number(e.target.value) : null)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-black bg-white text-slate-700 focus:border-amber-400 focus:outline-none min-w-[260px]"
            >
              {sessionOptions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.date} · {s.name}
                  {s.metadata?.sessionType ? ` (${s.metadata.sessionType})` : ''}
                </option>
              ))}
              {sessionOptions.length === 0 && <option value="">Nenhuma sessão</option>}
            </select>
          )}

          {/* Filtro semana */}
          {mode === 'semanal' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setWeekOffset(w => w - 1)}
                className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-600 font-black transition-all"
              >‹</button>
              <div className="bg-amber-500 text-black px-4 py-2 font-black text-xs uppercase italic shadow-sm min-w-[180px] text-center rounded-lg">
                {weekLabel}
              </div>
              <button
                onClick={() => setWeekOffset(w => Math.min(0, w + 1))}
                className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-600 font-black transition-all"
              >›</button>
            </div>
          )}
        </div>

        {/* SELETOR DE MÉTRICA */}
        <div className="flex flex-wrap gap-2">
          {METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => setSelectedMetricKey(m.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all border ${
                selectedMetricKey === m.key
                  ? 'text-white border-transparent shadow-md'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
              style={selectedMetricKey === m.key ? { backgroundColor: m.color, borderColor: m.color } : {}}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {/* CONTEXTO ATIVO */}
        <div className="flex flex-wrap items-center gap-4 bg-slate-50 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-xs font-black text-slate-600 uppercase tracking-wide">{contextLabel}</span>
            {sessionTypeBadge && (
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide ${sessionTypeFilter === 'jogo' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                {sessionTypeBadge}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <div className="text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Atletas</p>
              <p className="text-lg font-black text-black leading-none">{athleteRows.length}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sessões</p>
              <p className="text-lg font-black text-black leading-none">{nSessions}</p>
            </div>
            {avg != null && (
              <div className="text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Média {metric.label}</p>
                <p className="text-lg font-black leading-none" style={{ color: metric.color }}>
                  {fmtMetric(avg, metric)} <span className="text-xs text-slate-400">{metric.unit}</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* SEM DADOS */}
        {athleteRows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-300">
            <p className="text-5xl">📭</p>
            <p className="text-lg font-black uppercase tracking-wide">
              {mode === 'sessao' ? 'Nenhuma sessão GPS disponível' : 'Sem GPS nesta semana'}
            </p>
            <p className="text-sm font-medium">
              {mode === 'sessao' ? 'Carregue um CSV na página inicial.' : 'Navegue entre semanas ou carregue sessões.'}
            </p>
          </div>
        )}

        {/* RANKINGS */}
        {athleteRows.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* TOP 5 */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 pb-2 border-b-2" style={{ borderColor: metric.color }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-base" style={{ backgroundColor: metric.color }}>
                  {metric.icon}
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Top 5</p>
                  <h2 className="text-lg font-black uppercase leading-none text-black">{metric.label}</h2>
                </div>
                <div className="ml-auto bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg">
                  <span className="text-xs font-black text-amber-700">🏆 DESTAQUES</span>
                </div>
              </div>
              <RankingSection
                title="Melhores da sessão"
                emoji="🏆"
                athletes={top5}
                metric={metric}
                avg={avg}
                isTop={true}
                onAthleteClick={name => router.push(`/fisiologia/individual?atleta=${encodeURIComponent(name)}`)}
              />
            </div>

            {/* BOTTOM 5 */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 pb-2 border-b-2 border-red-300">
                <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center text-base">
                  📉
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Bottom 5</p>
                  <h2 className="text-lg font-black uppercase leading-none text-black">{metric.label}</h2>
                </div>
                <div className="ml-auto bg-red-50 border border-red-200 px-3 py-1 rounded-lg">
                  <span className="text-xs font-black text-red-600">⚠ ATENÇÃO</span>
                </div>
              </div>
              <RankingSection
                title="Abaixo da média"
                emoji="⚠"
                athletes={bottom5}
                metric={metric}
                avg={avg}
                isTop={false}
                onAthleteClick={name => router.push(`/fisiologia/individual?atleta=${encodeURIComponent(name)}`)}
              />
            </div>

          </div>
        )}

        {/* FOOTER */}
        <footer className="flex justify-between items-center border-t-2 border-slate-900 pt-3 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              Clique em qualquer atleta para abrir o perfil individual · Semanal = somatório de todas as sessões da semana
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-black italic tracking-tight uppercase">© Fisiologia GN</p>
        </footer>

      </div>
    </div>
  )
}