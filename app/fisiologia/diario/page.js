'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo, useRef } from 'react'
import { useData, calcVmaxPct } from '../../context/DataContext'
import { AthleteAvatar } from '../../utils/athletePhotos'
import ExportPdfButton from '../../../components/ExportPdfButton'

// ─── HELPERS ─────────────────────────────────────────────────────────────────
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

// ─── SEMÁFORO: score de prontidão 0–100 ──────────────────────────────────────
// Composição: wellness (50%) + ACWR risk (30%) + dias_sem_gps (20%)
function calcReadiness(preData, acwr, daysSinceLastGps) {
  let score = 0
  let reasons = []

  // 1. Wellness (0–50)
  if (preData?.wellnessScore != null) {
    const ws = preData.wellnessScore
    const wellPts = Math.min((ws / 5) * 50, 50)
    score += wellPts
    if (ws < 2.5) reasons.push('Bem-estar baixo')
    if (preData.temDor) reasons.push('Dor relatada')
    if (preData.corUrina >= 4) reasons.push('Desidratação')
  } else {
    score += 30 // sem dado → neutro
    reasons.push('Sem check-in de bem-estar')
  }

  // 2. ACWR (0–30): zona ideal 0.8–1.3 = 30pts
  if (acwr != null) {
    if (acwr >= 0.8 && acwr <= 1.3) score += 30
    else if (acwr >= 0.7 && acwr < 0.8) { score += 20; reasons.push('ACWR abaixo do ideal') }
    else if (acwr > 1.3 && acwr <= 1.5) { score += 15; reasons.push('ACWR elevado') }
    else if (acwr > 1.5) { score += 0; reasons.push('ACWR alto — risco de lesão') }
    else { score += 10; reasons.push('ACWR muito baixo') }
  } else {
    score += 20 // sem histórico suficiente → neutro
  }

  // 3. Descanso (0–20): último GPS há 1-2 dias = ideal
  if (daysSinceLastGps != null) {
    if (daysSinceLastGps === 0) { score += 10; reasons.push('Treinou hoje') }
    else if (daysSinceLastGps === 1) score += 20
    else if (daysSinceLastGps === 2) score += 18
    else if (daysSinceLastGps >= 3) { score += 12; reasons.push(`${daysSinceLastGps}d sem GPS`) }
  } else {
    score += 15
  }

  const verdict =
    score >= 75 ? { label: 'TREINO NORMAL',    color: '#16a34a', bg: 'bg-green-50 border-green-300',  dot: 'bg-green-500',  icon: '🟢' } :
    score >= 50 ? { label: 'TREINO MODIFICADO', color: '#d97706', bg: 'bg-amber-50 border-amber-300',  dot: 'bg-amber-500',  icon: '🟡' } :
                  { label: 'REPOUSO SUGERIDO',  color: '#dc2626', bg: 'bg-red-50 border-red-300',      dot: 'bg-red-500',    icon: '🔴' }

  return { score: Math.round(score), verdict, reasons }
}

function scoreColor(score) {
  if (score === null || score === undefined) return 'bg-slate-100 text-slate-400'
  if (score >= 3.5) return 'bg-green-100 text-green-700'
  if (score >= 2.5) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

function scoreDot(score) {
  if (score === null || score === undefined) return 'bg-slate-300'
  if (score >= 3.5) return 'bg-green-500'
  if (score >= 2.5) return 'bg-amber-500'
  return 'bg-red-500'
}

function vmaxColor(pct) {
  if (!pct) return 'text-slate-400'
  if (pct >= 90) return 'text-green-600'
  if (pct >= 80) return 'text-amber-600'
  return 'text-slate-500'
}

function urinaLabel(val) {
  const labels = { 1: 'Transparente', 2: 'Amarelo claro', 3: 'Amarelo', 4: 'Âmbar', 5: 'Escura' }
  return labels[val] || '-'
}
function urinaColor(val) {
  if (val <= 2) return 'bg-green-100 text-green-700'
  if (val === 3) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

function MetricBadge({ label, value, max = 5, invert = false }) {
  const pct = value ? value / max : 0
  const score = invert ? (max + 1 - value) / max : pct
  const color = score >= 0.7 ? 'text-green-600' : score >= 0.4 ? 'text-amber-600' : 'text-red-600'
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      <span className={`text-sm font-black ${value ? color : 'text-slate-300'}`}>{value ?? '—'}</span>
    </div>
  )
}

// ─── COMPONENTE CARD DO ATLETA ────────────────────────────────────────────────
function AthleteCard({ athlete, gpsRow, vmaxBaseline, recovery, onDetail }) {
  const { pre, post } = athlete
  const ws = pre?.wellnessScore
  const hasAlert = (ws && ws < 2.5) || pre?.temDor || (pre?.corUrina >= 4)
  const vmaxPct = gpsRow && vmaxBaseline[athlete.name]
    ? calcVmaxPct(gpsRow.maxVelocity, vmaxBaseline[athlete.name])
    : null

  function recoveryStyle(delta) {
    if (delta > 0.3) return { color: 'text-green-600', bg: 'bg-green-50 border-green-200', icon: '↑' }
    if (delta < -0.3) return { color: 'text-red-600',   bg: 'bg-red-50 border-red-200',   icon: '↓' }
    return { color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200', icon: '→' }
  }

  return (
    <div
      className={`border-2 rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${hasAlert ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:border-amber-400'}`}
      onClick={() => onDetail(athlete.name)}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <AthleteAvatar name={athlete.name} size="w-10 h-10" ring={!hasAlert} className={hasAlert ? 'ring-2 ring-red-400 ring-offset-1' : ''} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase tracking-tighter text-black truncate">{athlete.name}</p>
          {hasAlert ? (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
              <span className="text-[9px] font-black text-red-600 uppercase tracking-wider">Alerta</span>
            </div>
          ) : (
            <div className={`mt-0.5 inline-flex px-1.5 py-0.5 rounded text-[9px] font-black ${scoreColor(ws)}`}>
              {ws ? ws.toFixed(1) : '—'}
            </div>
          )}
        </div>
        {hasAlert && (
          <div className={`px-2 py-1 rounded-lg text-sm font-black shrink-0 ${scoreColor(ws)}`}>
            {ws ? ws.toFixed(1) : '—'}
          </div>
        )}
      </div>

      {pre && (
        <div className="grid grid-cols-5 gap-1 mb-3 pb-3 border-b border-slate-100">
          <MetricBadge label="Sono" value={pre.sono} invert={false} />
          <MetricBadge label="Fadiga" value={pre.fadiga} max={5} invert={true} />
          <MetricBadge label="DOMS" value={pre.doms} max={5} invert={true} />
          <MetricBadge label="Estresse" value={pre.estresse} max={5} invert={true} />
          <MetricBadge label="Humor" value={pre.humor} />
        </div>
      )}
      {!pre && (
        <div className="text-[10px] text-slate-400 italic mb-3 pb-3 border-b border-slate-100 font-medium">
          Sem registro de bem-estar hoje
        </div>
      )}

      {pre?.temDor && pre?.dorLocalizada && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-2 py-1 mb-2">
          <p className="text-[9px] font-black text-red-600 uppercase tracking-wider mb-0.5">Dor relatada</p>
          <p className="text-[10px] text-red-700 font-medium leading-relaxed">{pre.dorLocalizada}</p>
        </div>
      )}

      {pre?.corUrina && (
        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider mb-2 ${urinaColor(pre.corUrina)}`}>
          💧 {urinaLabel(pre.corUrina)}
        </div>
      )}

      {gpsRow && !gpsRow.isOutlier ? (
        <div className="grid grid-cols-4 gap-1 pt-2 border-t border-slate-100">
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Dist (m)</span>
            <span className="text-xs font-black text-black">{gpsRow.totalDistance?.toFixed(0) ?? '—'}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">m/min</span>
            <span className="text-xs font-black text-black">{gpsRow.distanceRelative?.toFixed(1) ?? '—'}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">HSR (m)</span>
            <span className="text-xs font-black text-black">{gpsRow.hsr?.toFixed(0) ?? '—'}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Vmax %</span>
            <span className={`text-xs font-black ${vmaxColor(vmaxPct)}`}>
              {vmaxPct ? `${vmaxPct}%` : `${gpsRow.maxVelocity?.toFixed(1)}km/h`}
            </span>
          </div>
        </div>
      ) : gpsRow?.isOutlier ? (
        <div className="pt-2 border-t border-slate-100">
          <span className="text-[9px] font-black text-red-500 uppercase tracking-wider">⚠ Erro de sensor GPS</span>
        </div>
      ) : (
        <div className="pt-2 border-t border-slate-100">
          <span className="text-[9px] text-slate-400 italic font-medium">Sem GPS nesta sessão</span>
        </div>
      )}

      {post && (
        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">sRPE</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-black">{post.srpe ?? '—'}</span>
            {post.srpeLoad && (
              <span className="text-[9px] text-slate-500 font-medium">({post.srpeLoad.toFixed(0)} UA)</span>
            )}
          </div>
        </div>
      )}

      {recovery && (
        <div className={`mt-2 pt-2 border-t border-slate-100`}>
          <div className={`flex items-center justify-between px-2 py-1 rounded-lg border ${recoveryStyle(recovery.delta).bg}`}>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Recuperação</span>
            <div className="flex items-center gap-1">
              <span className={`text-xs font-black ${recoveryStyle(recovery.delta).color}`}>
                {recoveryStyle(recovery.delta).icon} {recovery.delta > 0 ? '+' : ''}{recovery.delta.toFixed(1)}
              </span>
              <span className="text-[9px] text-slate-400 font-medium">
                em {recovery.daysDiff}d
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function DiarioDashboard() {
  const contentRef = useRef(null)
  const router = useRouter()
  const { gpsData, bemEstarData, vmaxBaseline, isLoadingBemEstar, fetchBemEstar, uploadGpsFile, playerPositions, excludedNamesNorm, normalizeName } = useData()
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedGpsDate, setSelectedGpsDate] = useState(null)
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [filterAlert, setFilterAlert] = useState(false)
  const [filterPosition, setFilterPosition] = useState('')
  const [viewMode, setViewMode] = useState('cards') // 'cards' | 'semaforo'

  const availablePositions = useMemo(() => {
    const set = new Set(Object.values(playerPositions).filter(Boolean))
    return Array.from(set).sort()
  }, [playerPositions])

  const gpsDates = useMemo(() => {
    return [...new Set(gpsData.map(s => s.date))]
      .sort((a, b) => {
        const sa = a.includes("/") ? a.split("/").reverse().join("-") : a
        const sb = b.includes("/") ? b.split("/").reverse().join("-") : b
        return sb.localeCompare(sa)
      })
  }, [gpsData])

  const activeGpsSession = useMemo(() => {
    if (gpsData.length === 0) return null
    const target = selectedGpsDate || gpsDates[0]
    return gpsData.find(s => s.date === target) || null
  }, [gpsData, selectedGpsDate, gpsDates])

  const gpsDaySessions = useMemo(() => {
    if (!activeGpsSession) return []
    const dayDate = activeGpsSession.date
    return gpsData.filter(s => s.date === dayDate)
  }, [gpsData, activeGpsSession])

  const gpsMap = useMemo(() => {
    if (gpsDaySessions.length === 0) return {}
    const sessionsToUse = selectedSessionId
      ? gpsDaySessions.filter(s => s.id === selectedSessionId)
      : gpsDaySessions

    const map = {}
    for (const session of sessionsToUse) {
      for (const row of session.rows) {
        if (row.periodNumber !== 0 || row.isOutlier) continue
        const name = row.playerName
        if (excludedNamesNorm.has(normalizeName(name))) continue
        if (!map[name]) {
          map[name] = { ...row, _sessionCount: 1 }
        } else {
          map[name].totalDistance    = (map[name].totalDistance    || 0) + (row.totalDistance    || 0)
          map[name].hsr              = (map[name].hsr              || 0) + (row.hsr              || 0)
          map[name].sprintDistance   = (map[name].sprintDistance   || 0) + (row.sprintDistance   || 0)
          map[name].sprintCount      = (map[name].sprintCount      || 0) + (row.sprintCount      || 0)
          map[name].acceleration     = (map[name].acceleration     || 0) + (row.acceleration     || 0)
          map[name].deceleration     = (map[name].deceleration     || 0) + (row.deceleration     || 0)
          map[name].playerLoad       = (map[name].playerLoad       || 0) + (row.playerLoad       || 0)
          map[name].durationMin      = (map[name].durationMin      || 0) + (row.durationMin      || 0)
          const totalDuration = map[name].durationMin
          map[name].distanceRelative = totalDuration > 0 ? map[name].totalDistance / totalDuration : 0
          map[name].maxVelocity = Math.max(map[name].maxVelocity || 0, row.maxVelocity || 0)
          map[name]._sessionCount += 1
        }
      }
    }
    return map
  }, [gpsDaySessions, selectedSessionId])

  const todayBemEstar = useMemo(() => {
    const pre = {}
    const post = {}
    for (const r of bemEstarData) {
      if (r.date !== selectedDate) continue
      if (r.type === 'pre') pre[r.playerName] = r
      if (r.type === 'post') post[r.playerName] = r
    }
    return { pre, post }
  }, [bemEstarData, selectedDate])

  const athletes = useMemo(() => {
    const names = new Set([
      ...Object.keys(todayBemEstar.pre),
      ...Object.keys(todayBemEstar.post),
      ...Object.keys(gpsMap),
    ])
    return Array.from(names)
      .filter(name => !excludedNamesNorm.has(normalizeName(name)))
      .sort()
      .map(name => ({
        name,
        pre: todayBemEstar.pre[name] || null,
        post: todayBemEstar.post[name] || null,
      }))
  }, [todayBemEstar, gpsMap, excludedNamesNorm])

  const pendingCheckin = useMemo(() => {
    const gpsNames = Object.keys(gpsMap)
    return gpsNames.filter(name => !todayBemEstar.pre[name]).sort()
  }, [gpsMap, todayBemEstar])

  const recoveryMap = useMemo(() => {
    const map = {}
    const todayDate = selectedDate
    for (const a of athletes) {
      const todayScore = todayBemEstar.pre[a.name]?.wellnessScore
      if (todayScore == null) { map[a.name] = null; continue }

      const prevPre = bemEstarData
        .filter(r => r.playerName === a.name && r.type === 'pre' && r.date < todayDate && r.wellnessScore != null)
        .sort((a, b) => b.date.localeCompare(a.date))[0]

      if (!prevPre) { map[a.name] = null; continue }

      const daysDiff = Math.round(
        (new Date(todayDate + 'T12:00:00') - new Date(prevPre.date + 'T12:00:00')) / (1000 * 60 * 60 * 24)
      )
      map[a.name] = {
        delta: parseFloat((todayScore - prevPre.wellnessScore).toFixed(2)),
        prevScore: prevPre.wellnessScore,
        prevDate: prevPre.date,
        daysDiff,
      }
    }
    return map
  }, [athletes, bemEstarData, selectedDate, todayBemEstar])

  const alerts = useMemo(() => {
    return athletes.filter(a => {
      const ws = a.pre?.wellnessScore
      return (ws && ws < 2.5) || a.pre?.temDor || (a.pre?.corUrina >= 4)
    })
  }, [athletes])

  // ── ACWR por atleta — GPS distância total como carga externa ──────────────
  // CORREÇÃO: era bemEstarData.srpeLoad + 3 semanas → agora gpsData + 4 semanas reais
  const athleteAcwr = useMemo(() => {
    const result = {}

    // Parse dd/mm/yyyy ou yyyy-mm-dd → Date
    function parseGpsDate(dateStr) {
      if (!dateStr) return null
      if (dateStr.includes('/')) {
        const [d, m, y] = dateStr.split('/')
        return new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T12:00:00`)
      }
      return new Date(dateStr + 'T12:00:00')
    }

    for (const athlete of athletes) {
      // 1. Monta mapa { 'yyyy-mm-dd': metros } com GPS (period 0, sem outliers)
      const loadByDate = {}
      for (const session of gpsData) {
        const sessionDate = parseGpsDate(session.date)
        if (!sessionDate || isNaN(sessionDate)) continue
        const key = sessionDate.toISOString().split('T')[0]
        for (const row of session.rows) {
          if (row.playerName !== athlete.name) continue
          if (row.periodNumber !== 0 || row.isOutlier) continue
          if (!row.totalDistance || row.totalDistance <= 0) continue
          loadByDate[key] = (loadByDate[key] || 0) + row.totalDistance
        }
      }

      // 2. Carga aguda: soma dos últimos 7 dias corridos
      const now = new Date()
      const acuteStart = new Date(now)
      acuteStart.setDate(now.getDate() - 6)
      acuteStart.setHours(0, 0, 0, 0)

      const acuteLoad = Object.entries(loadByDate)
        .filter(([d]) => new Date(d + 'T12:00:00') >= acuteStart)
        .reduce((s, [, v]) => s + v, 0)

      // 3. Carga crônica: média de 4 janelas de 7 dias (28 dias)
      const weekLoads = [0, 1, 2, 3].map(w => {
        const wEnd   = new Date(now); wEnd.setDate(now.getDate() - w * 7);       wEnd.setHours(23, 59, 59, 999)
        const wStart = new Date(now); wStart.setDate(now.getDate() - w * 7 - 6); wStart.setHours(0, 0, 0, 0)
        return Object.entries(loadByDate)
          .filter(([d]) => { const dt = new Date(d + 'T12:00:00'); return dt >= wStart && dt <= wEnd })
          .reduce((s, [, v]) => s + v, 0)
      })

      const chronicLoad = weekLoads.reduce((a, b) => a + b, 0) / 4

      // null quando sem histórico — evita 0.00 falso no semáforo
      result[athlete.name] = chronicLoad > 0 ? parseFloat((acuteLoad / chronicLoad).toFixed(3)) : null
    }

    return result
  }, [gpsData, athletes])

  // ── Readiness map ─────────────────────────────────────────────────────────────
  const readinessMap = useMemo(() => {
    const map = {}
    for (const a of athletes) {
      // Converte para yyyy-mm-dd antes de ordenar — dd/mm/yyyy não ordena lexicograficamente
      const lastGpsDates = gpsData
        .filter(s => s.rows.some(r => r.playerName === a.name && r.periodNumber === 0 && !r.isOutlier))
        .map(s => ({
          original: s.date,
          sortable: s.date.includes('/') ? s.date.split('/').reverse().join('-') : s.date,
        }))
        .sort((x, y) => y.sortable.localeCompare(x.sortable))
      const lastGps = lastGpsDates[0]?.original
      let daysSince = null
      if (lastGps) {
        const d = lastGps.includes('/') ? new Date(lastGps.split('/').reverse().join('-') + 'T12:00:00') : new Date(lastGps + 'T12:00:00')
        daysSince = Math.round((Date.now() - d.getTime()) / (1000*60*60*24))
      }
      map[a.name] = calcReadiness(a.pre, athleteAcwr[a.name], daysSince)
    }
    return map
  }, [athletes, athleteAcwr, gpsData])

  const displayed = useMemo(() => {
    let list = filterAlert ? alerts : athletes
    if (filterPosition) list = list.filter(a => playerPositions[a.name] === filterPosition)
    return list
  }, [filterAlert, alerts, athletes, filterPosition, playerPositions])

  const bemEstarDates = useMemo(() => {
    const dates = [...new Set(bemEstarData.map(r => r.date))].sort().reverse()
    return dates
  }, [bemEstarData])

  async function handleFileUpload(file) {
    if (!file) return
    await uploadGpsFile(file)
  }

  return (
    <div className="min-h-screen bg-white text-black p-4 font-sans" ref={contentRef} data-pdf-root>
      <div className="max-w-[1400px] mx-auto flex flex-col gap-5">

        {/* HEADER */}
        <header className="flex justify-between items-center border-b-4 border-amber-500 pb-3">
          <div className="flex items-center gap-4">
            <img src="/club/escudonovorizontino.png" alt="Escudo" className="h-14 w-auto" />
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-black uppercase leading-none">Dashboard Diário</h1>
              <p className="text-sm font-bold tracking-widest text-slate-600 uppercase">Prontidão & Carga por Atleta</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ExportPdfButton contentRef={contentRef} filename="dashboard-diario" />
            <button onClick={() => router.push('/fisiologia')} className="bg-slate-200 text-slate-800 px-3 py-1 rounded-md text-xs font-bold hover:bg-slate-300 transition-colors">
              ← VOLTAR
            </button>
            <div className="bg-amber-500 text-black px-4 py-1 font-black text-sm uppercase italic shadow-md">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' })}
            </div>
          </div>
        </header>

        {/* CONTROLES */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Bem-estar:</span>
            <select
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-black bg-white focus:border-amber-500 focus:outline-none"
            >
              {bemEstarDates.length > 0
                ? bemEstarDates.map(d => (
                  <option key={d} value={d}>{new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')}</option>
                ))
                : <option value={selectedDate}>{selectedDate}</option>
              }
            </select>
            <button onClick={fetchBemEstar} disabled={isLoadingBemEstar} className="bg-slate-100 hover:bg-amber-100 text-slate-600 px-2 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all disabled:opacity-50">
              {isLoadingBemEstar ? '...' : '↻'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">GPS:</span>
            {gpsDates.length > 0 ? (
              <select
                value={selectedGpsDate || gpsDates[0]}
                onChange={e => { setSelectedGpsDate(e.target.value); setSelectedSessionId(null) }}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-black bg-white focus:border-amber-500 focus:outline-none"
              >
                {gpsDates.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            ) : (
              <label className="cursor-pointer bg-amber-500 text-black px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 transition-all">
                + Carregar CSV
                <input type="file" accept=".csv" className="hidden" onChange={e => handleFileUpload(e.target.files[0])} />
              </label>
            )}
            {gpsDaySessions.length > 1 && (
              <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-700">Ver:</span>
                <button
                  onClick={() => setSelectedSessionId(null)}
                  className={`text-[10px] font-black px-2 py-0.5 rounded transition-all ${!selectedSessionId ? 'bg-amber-500 text-black' : 'text-amber-700 hover:bg-amber-100'}`}
                >
                  Soma do dia
                </button>
                {gpsDaySessions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSessionId(s.id)}
                    className={`text-[10px] font-black px-2 py-0.5 rounded transition-all ${selectedSessionId === s.id ? 'bg-amber-500 text-black' : 'text-amber-700 hover:bg-amber-100'}`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setFilterAlert(!filterAlert)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterAlert ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-red-100 hover:text-red-600'}`}
          >
            ⚠ Alertas {alerts.length > 0 && <span className="bg-white/30 px-1.5 rounded-full">{alerts.length}</span>}
          </button>
          {availablePositions.length > 0 && (
            <select
              value={filterPosition}
              onChange={e => setFilterPosition(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-black bg-white text-slate-700 uppercase tracking-widest focus:border-amber-400 focus:outline-none"
            >
              <option value="">Todas as posições</option>
              {availablePositions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}

          <div className="ml-auto flex bg-slate-100 rounded-xl p-1 gap-1">
            {[
              { id: 'cards',    label: '🃏 Cards' },
              { id: 'semaforo', label: '🚦 Semáforo' },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setViewMode(m.id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${viewMode === m.id ? 'bg-amber-500 text-black shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── SEMÁFORO DE PRONTIDÃO ────────────────────────────────────────────── */}
        {viewMode === 'semaforo' && athletes.length > 0 && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '🟢 Treino Normal',    count: displayed.filter(a => readinessMap[a.name]?.score >= 75).length,   bg: 'bg-green-50 border-green-200',  text: 'text-green-700' },
                { label: '🟡 Treino Modificado', count: displayed.filter(a => { const s = readinessMap[a.name]?.score; return s >= 50 && s < 75 }).length, bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
                { label: '🔴 Repouso Sugerido',  count: displayed.filter(a => readinessMap[a.name]?.score < 50).length,   bg: 'bg-red-50 border-red-200',      text: 'text-red-700'   },
              ].map(k => (
                <div key={k.label} className={`border rounded-xl p-3 ${k.bg}`}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{k.label}</p>
                  <p className={`text-3xl font-black ${k.text}`}>{k.count}</p>
                  <p className="text-[9px] text-slate-500">de {displayed.length} atletas</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
              {[...displayed]
                .sort((a, b) => (readinessMap[b.name]?.score || 0) - (readinessMap[a.name]?.score || 0))
                .map(a => {
                  const r = readinessMap[a.name]
                  if (!r) return null
                  const barW = r.score
                  return (
                    <div
                      key={a.name}
                      onClick={() => router.push(`/fisiologia/individual?atleta=${encodeURIComponent(a.name)}`)}
                      className={`border-2 rounded-xl p-4 cursor-pointer hover:shadow-md transition-all ${r.verdict.bg}`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <AthleteAvatar name={a.name} size="w-10 h-10" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-black truncate">{a.name.split(' ').slice(0,2).join(' ')}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-base">{r.verdict.icon}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: r.verdict.color }}>
                              {r.verdict.label}
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-2xl font-black leading-none" style={{ color: r.verdict.color }}>{r.score}</p>
                          <p className="text-[8px] text-slate-400 font-bold">/ 100</p>
                        </div>
                      </div>

                      <div className="h-2 bg-white/60 rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${barW}%`, backgroundColor: r.verdict.color }}
                        />
                      </div>

                      {r.reasons.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {r.reasons.slice(0, 3).map((reason, i) => (
                            <span key={i} className="text-[8px] font-black px-1.5 py-0.5 bg-white/50 rounded text-slate-600">
                              {reason}
                            </span>
                          ))}
                        </div>
                      )}

                      {athleteAcwr[a.name] != null && (
                        <p className="text-[9px] font-bold text-slate-500 mt-1">
                          ACWR: <span className="font-black">{athleteAcwr[a.name].toFixed(2)}</span>
                        </p>
                      )}
                    </div>
                  )
                })}
            </div>
            <p className="text-[10px] font-bold text-slate-400">
              Score = Wellness (50%) + ACWR GPS (30%) + Dias de descanso (20%) · Clique em qualquer atleta para o perfil individual
            </p>
          </div>
        )}

        {/* RESUMO DO DIA */}
        {viewMode === 'cards' && athletes.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Com dado hoje</p>
              <p className="text-2xl font-black text-black">{athletes.filter(a => a.pre).length}</p>
              <p className="text-[10px] text-slate-500">de {athletes.length} atletas</p>
            </div>
            <div className={`border rounded-xl p-3 ${alerts.length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Alertas</p>
              <p className={`text-2xl font-black ${alerts.length > 0 ? 'text-red-600' : 'text-green-600'}`}>{alerts.length}</p>
              <p className="text-[10px] text-slate-500">score {'<'} 2.5 ou dor/desidrat.</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Média Bem-Estar</p>
              <p className="text-2xl font-black text-black">
                {athletes.filter(a => a.pre?.wellnessScore).length > 0
                  ? (athletes.filter(a => a.pre?.wellnessScore).reduce((s, a) => s + a.pre.wellnessScore, 0) / athletes.filter(a => a.pre?.wellnessScore).length).toFixed(1)
                  : '—'
                }
              </p>
              <p className="text-[10px] text-slate-500">escala 1–5</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Sessões GPS</p>
              <p className="text-2xl font-black text-black">{gpsDaySessions.length}</p>
              <p className="text-[10px] text-slate-500">
                {gpsDaySessions.length > 1
                  ? gpsDaySessions.map(s => s.name).join(' + ')
                  : gpsDaySessions[0]?.name || '—'}
              </p>
            </div>
          </div>
        )}

        {/* AGUARDANDO CHECK-IN */}
        {viewMode === 'cards' && pendingCheckin.length > 0 && (
          <div className="border-2 border-blue-200 bg-blue-50 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-blue-700 mb-1">
                  ⏳ Aguardando check-in — {pendingCheckin.length} atleta{pendingCheckin.length !== 1 ? 's' : ''} com GPS mas sem bem-estar
                </p>
                <p className="text-[10px] text-blue-600 font-medium mb-3">
                  Estes atletas têm GPS no dia selecionado mas ainda não preencheram o formulário pré-treino.
                </p>
                <div className="flex flex-wrap gap-2">
                  {pendingCheckin.map(name => (
                    <div
                      key={name}
                      className="flex items-center gap-2 bg-white border border-blue-200 rounded-lg px-3 py-2 cursor-pointer hover:border-amber-400 transition-all"
                      onClick={() => router.push(`/fisiologia/individual?atleta=${encodeURIComponent(name)}`)}
                    >
                      <AthleteAvatar name={name} size="w-7 h-7" />
                      <span className="text-xs font-black text-slate-700">{name.split(' ').slice(0, 2).join(' ')}</span>
                      <span className="text-[8px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-black uppercase">Sem check-in</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-3xl font-black text-blue-300">{pendingCheckin.length}</span>
                <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">pendentes</span>
              </div>
            </div>
          </div>
        )}

        {/* ALERTAS DESTAQUE */}
        {viewMode === 'cards' && alerts.length > 0 && (
          <div className="border-2 border-red-300 bg-red-50 rounded-xl p-4">
            <p className="text-xs font-black uppercase tracking-widest text-red-600 mb-3">⚠ Atletas que precisam de atenção hoje</p>
            <div className="flex flex-wrap gap-2">
              {alerts.map(a => (
                <div key={a.name} className="bg-white border border-red-200 rounded-lg px-3 py-2">
                  <p className="text-xs font-black text-red-700">{a.name.split(' ').slice(0, 2).join(' ')}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {a.pre?.wellnessScore < 2.5 && <span className="text-[8px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-black uppercase">Score baixo {a.pre.wellnessScore.toFixed(1)}</span>}
                    {a.pre?.temDor && <span className="text-[8px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-black uppercase">Dor</span>}
                    {a.pre?.corUrina >= 4 && <span className="text-[8px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-black uppercase">Desidratação</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GRID DE ATLETAS */}
        {viewMode === 'cards' && (displayed.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {displayed.map(athlete => (
              <AthleteCard
                key={athlete.name}
                athlete={athlete}
                gpsRow={gpsMap[athlete.name] || null}
                vmaxBaseline={vmaxBaseline}
                recovery={recoveryMap[athlete.name] || null}
                onDetail={name => router.push(`/fisiologia/individual?atleta=${encodeURIComponent(name)}`)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Sem dados para esta data</p>
            <p className="text-xs text-slate-400 mt-1 font-medium">Selecione outra data ou atualize o bem-estar</p>
          </div>
        ))}

        {/* FOOTER */}
        <footer className="flex justify-between items-center border-t-2 border-slate-900 pt-3 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              Score bem-estar = média(sono, 6-fadiga, 6-doms, 6-estresse, humor) | ACWR = GPS distância 7d / média 4 semanas | Vmax% = sessão / baseline histórico
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-black italic tracking-tight uppercase">© Fisiologia GN</p>
        </footer>

      </div>
    </div>
  )
}
