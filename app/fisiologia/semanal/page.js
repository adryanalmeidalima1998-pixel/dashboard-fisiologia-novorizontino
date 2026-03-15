'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo } from 'react'
import { useData } from '../../context/DataContext'
import { AthleteAvatar } from '../../utils/athletePhotos'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, ReferenceLine, Cell, LabelList,
  LineChart, Line, Legend,
} from 'recharts'

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

function isoDate(d) { return d.toISOString().split('T')[0] }

function acwrColor(v) {
  if (!v) return 'text-slate-400'
  if (v >= 0.8 && v <= 1.3) return 'text-green-600'
  if (v < 0.8 || (v > 1.3 && v <= 1.5)) return 'text-amber-600'
  return 'text-red-600'
}
function acwrBg(v) {
  if (!v) return 'bg-slate-100'
  if (v >= 0.8 && v <= 1.3) return 'bg-green-100'
  if (v < 0.8 || (v > 1.3 && v <= 1.5)) return 'bg-amber-100'
  return 'bg-red-100'
}
function monotonyColor(v) {
  if (!v) return 'text-slate-400'
  if (v < 1.5) return 'text-green-600'
  if (v < 2.0) return 'text-amber-600'
  return 'text-red-600'
}
function gpsColor(val, avg, metric) {
  if (val === null || val === undefined) return 'bg-white'
  const ratio = avg > 0 ? val / avg : 0
  if (ratio > 1.2) return 'bg-green-100'
  if (ratio < 0.8) return 'bg-slate-50'
  return 'bg-white'
}


// Helper para TH clicável com seta de ordenação
function SortTh({ label, col, sort, onSort, className = "" }) {
  const active = sort.col === col
  const arrow = active ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ' ↕'
  return (
    <th
      className={`py-2 px-2 font-black uppercase tracking-widest text-[10px] text-slate-500 cursor-pointer hover:text-amber-600 select-none whitespace-nowrap ${className}`}
      onClick={() => onSort(col)}
    >
      {label}<span className="text-[8px] ml-0.5 opacity-60">{arrow}</span>
    </th>
  )
}

// Dias da semana para tabela
const WEEK_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export default function SemanalDashboard() {
  const router = useRouter()
  const { gpsData, bemEstarData, isLoadingBemEstar, fetchBemEstar, playerPositions } = useData()
  const [weekOffset, setWeekOffset] = useState(0)
  const [activeTab, setActiveTab] = useState('carga')
  const [evolucaoWeeks, setEvolucaoWeeks] = useState(12)
  const [evolucaoAtleta, setEvolucaoAtleta] = useState('')
  const [evolucaoMetric, setEvolucaoMetric] = useState('totalDistance')
  const [filterPosition, setFilterPosition] = useState('')
  const [isPdfLoading, setIsPdfLoading] = useState(false)
  // Ordenação das tabelas: { col, dir }
  const [sortCarga, setSortCarga] = useState({ col: 'total', dir: 'desc' })
  const [sortGps, setSortGps] = useState({ col: 'totalDistance', dir: 'desc' })
  const [sortBem, setSortBem] = useState({ col: 'avg', dir: 'desc' })
  // Atletas excluídos da média do grupo (DM, goleiro no profissional, erro GPS, etc.)
  const [excludedAthletes, setExcludedAthletes] = useState(new Set())
  const [showExcludePanel, setShowExcludePanel] = useState(false)

  function toggleExclude(athlete) {
    setExcludedAthletes(prev => {
      const next = new Set(prev)
      next.has(athlete) ? next.delete(athlete) : next.add(athlete)
      return next
    })
  }

  // Posições únicas disponíveis
  const availablePositions = useMemo(() => {
    const set = new Set(Object.values(playerPositions).filter(Boolean))
    return Array.from(set).sort()
  }, [playerPositions])

  // Toggle sort helper
  function toggleSort(current, col, setter) {
    if (current.col === col) {
      setter({ col, dir: current.dir === 'desc' ? 'asc' : 'desc' })
    } else {
      setter({ col, dir: 'desc' })
    }
  }

  const { monday, sunday } = useMemo(() => getWeekBounds(weekOffset), [weekOffset])
  const weekLabel = `${monday.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${sunday.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`

  // Dias da semana como string YYYY-MM-DD
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i)
      return isoDate(d)
    })
  }, [monday])

  // Dados de bem-estar da semana
  const weekBemEstar = useMemo(() => {
    return bemEstarData.filter(r => {
      const d = new Date(r.date + 'T12:00:00')
      return d >= monday && d <= sunday
    })
  }, [bemEstarData, monday, sunday])

  // Dados GPS da semana
  const weekGps = useMemo(() => {
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
      return dt >= monday && dt <= sunday
    })
  }, [gpsData, monday, sunday])

  // Atletas únicos com dados na semana — normaliza nomes para evitar duplicatas
  // ex: "João Pedro" e "JOAO PEDRO" do formulário vs GPS viram a mesma entrada
  const weekAthletes = useMemo(() => {
    // Mapeia normalized → nome canônico (primeiro encontrado como referência)
    const normToCanonical = {}
    const addName = (name) => {
      if (!name) return
      const norm = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z\s]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
      if (!normToCanonical[norm]) normToCanonical[norm] = name
    }
    // GPS é fonte primária para nome canônico
    weekGps.flatMap(s => s.rows.filter(r => r.periodNumber === 0 && !r.isOutlier).map(r => r.playerName)).forEach(addName)
    weekBemEstar.map(r => r.playerName).forEach(addName)

    let list = Object.values(normToCanonical).sort()
    if (filterPosition) list = list.filter(a => playerPositions[a] === filterPosition)
    return list
  }, [weekBemEstar, weekGps, filterPosition, playerPositions])

  // Helper: normaliza um nome para comparação
  function normName(n) {
    if (!n) return ''
    return n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z\s]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
  }

  // Mapeia norm → nome canônico (usando weekAthletes já deduplucado)
  const canonicalByNorm = useMemo(() => {
    const map = {}
    weekAthletes.forEach(a => { map[normName(a)] = a })
    return map
  }, [weekAthletes])

  // Resolve qualquer nome para o canônico
  const resolveCanonical = (name) => canonicalByNorm[normName(name)] || name

  // sRPE-load por atleta por dia — usa normalização de nome para agrupar variações
  const srpeMatrix = useMemo(() => {
    const matrix = {}
    for (const athlete of weekAthletes) {
      matrix[athlete] = {}
      for (const day of weekDays) {
        const posts = weekBemEstar.filter(r =>
          normName(r.playerName) === normName(athlete) && r.type === 'post' && r.date === day
        )
        const load = posts.reduce((s, r) => s + (r.srpeLoad || 0), 0)
        matrix[athlete][day] = load || null
      }
    }
    return matrix
  }, [weekAthletes, weekBemEstar, weekDays])

  // GPS por atleta (soma da semana, period=Session)
  const gpsWeekly = useMemo(() => {
    const map = {}
    for (const athlete of weekAthletes) {
      const rows = weekGps.flatMap(s => s.rows.filter(r => r.playerName === athlete && r.periodNumber === 0 && !r.isOutlier))
      if (rows.length === 0) { map[athlete] = null; continue }
      map[athlete] = {
        sessions: rows.length,
        totalDistance: rows.reduce((s, r) => s + (r.totalDistance || 0), 0),
        hsr: rows.reduce((s, r) => s + (r.hsr || 0), 0),
        sprintDistance: rows.reduce((s, r) => s + (r.sprintDistance || 0), 0),
        sprintCount: rows.reduce((s, r) => s + (r.sprintCount || 0), 0),
        accDecel: rows.reduce((s, r) => s + (r.acceleration || 0) + (r.deceleration || 0), 0),
        avgMmin: rows.reduce((s, r) => s + (r.distanceRelative || 0), 0) / rows.length,
        maxVelocity: Math.max(...rows.map(r => r.maxVelocity || 0)),
        playerLoad: rows.reduce((s, r) => s + (r.playerLoad || 0), 0),
      }
    }
    return map
  }, [weekAthletes, weekGps])

  // Cálculo de monotonia e strain por atleta
  const weekStats = useMemo(() => {
    const stats = {}
    for (const athlete of weekAthletes) {
      const dailyLoads = weekDays.map(d => srpeMatrix[athlete][d] || 0)
      const weeklySum = dailyLoads.reduce((a, b) => a + b, 0)
      const mean = weeklySum / 7
      const sd = Math.sqrt(dailyLoads.map(v => Math.pow(v - mean, 2)).reduce((a, b) => a + b, 0) / 7)
      const monotony = sd > 0 ? mean / sd : 0
      const strain = weeklySum * monotony

      // ACWR: semana atual / média das 3 semanas anteriores
      const prevLoads = [1, 2, 3].map(w => {
        const { monday: pm, sunday: ps } = getWeekBounds(weekOffset - w)
        const posts = bemEstarData.filter(r => {
          if (normName(r.playerName) !== normName(athlete) || r.type !== 'post' || !r.srpeLoad) return false
          const d = new Date(r.date + 'T12:00:00')
          return d >= pm && d <= ps
        })
        return posts.reduce((s, r) => s + r.srpeLoad, 0)
      })
      const prevAvg = prevLoads.reduce((a, b) => a + b, 0) / 3
      const acwr = prevAvg > 0 ? weeklySum / prevAvg : null

      stats[athlete] = { weeklySum, monotony, strain, acwr }
    }
    return stats
  }, [weekAthletes, srpeMatrix, weekDays, bemEstarData, weekOffset])

  // ── Listas ordenadas por aba ─────────────────────────────────────────────────
  const sortedCargaAthletes = useMemo(() => {
    const list = [...weekAthletes]
    const { col, dir } = sortCarga
    list.sort((a, b) => {
      let va, vb
      if (col === 'name') { va = a; vb = b; return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va) }
      if (col === 'total') { va = weekStats[a]?.weeklySum || 0; vb = weekStats[b]?.weeklySum || 0 }
      else if (col === 'mono') { va = weekStats[a]?.monotony || 0; vb = weekStats[b]?.monotony || 0 }
      else if (col === 'strain') { va = weekStats[a]?.strain || 0; vb = weekStats[b]?.strain || 0 }
      else if (col === 'acwr') { va = weekStats[a]?.acwr || 0; vb = weekStats[b]?.acwr || 0 }
      else { va = 0; vb = 0 }
      return dir === 'desc' ? vb - va : va - vb
    })
    return list
  }, [weekAthletes, weekStats, sortCarga])

  const sortedGpsAthletes = useMemo(() => {
    const list = weekAthletes.filter(a => gpsWeekly[a])
    const { col, dir } = sortGps
    list.sort((a, b) => {
      if (col === 'name') return dir === 'asc' ? a.localeCompare(b) : b.localeCompare(a)
      const va = gpsWeekly[a]?.[col] || 0
      const vb = gpsWeekly[b]?.[col] || 0
      return dir === 'desc' ? vb - va : va - vb
    })
    return list
  }, [weekAthletes, gpsWeekly, sortGps])

  const sortedBemAthletes = useMemo(() => {
    const list = weekAthletes.filter(a => weekBemEstar.some(r => normName(r.playerName) === normName(a)))
    const { col, dir } = sortBem
    list.sort((a, b) => {
      if (col === 'name') return dir === 'asc' ? a.localeCompare(b) : b.localeCompare(a)
      const getAvg = (name) => {
        const scores = weekDays.map(d => {
          const pre = weekBemEstar.find(r => r.playerName === name && r.type === 'pre' && r.date === d)
          return pre?.wellnessScore || null
        }).filter(Boolean)
        return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
      }
      const va = getAvg(a), vb = getAvg(b)
      return dir === 'desc' ? vb - va : va - vb
    })
    return list
  }, [weekAthletes, weekBemEstar, weekDays, sortBem])

  // Médias do grupo para carga (exclui atletas marcados)
  const groupCargaAvg = useMemo(() => {
    const vals = weekAthletes
      .filter(a => !excludedAthletes.has(a))
      .map(a => weekStats[a]?.weeklySum || 0).filter(v => v > 0)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }, [weekAthletes, weekStats, excludedAthletes])

  // Médias de GPS (para colorização relativa) — exclui atletas marcados como fora da média
  const gpsAvgs = useMemo(() => {
    const vals = Object.entries(gpsWeekly)
      .filter(([name, v]) => v !== null && !excludedAthletes.has(name))
      .map(([, v]) => v)
    if (vals.length === 0) return {}
    return {
      totalDistance: vals.reduce((s, v) => s + v.totalDistance, 0) / vals.length,
      hsr: vals.reduce((s, v) => s + v.hsr, 0) / vals.length,
      sprintDistance: vals.reduce((s, v) => s + v.sprintDistance, 0) / vals.length,
      accDecel: vals.reduce((s, v) => s + v.accDecel, 0) / vals.length,
      playerLoad: vals.reduce((s, v) => s + v.playerLoad, 0) / vals.length,
    }
  }, [gpsWeekly, excludedAthletes])

  // ── MÉDIAS GPS: grupo + por posição ─────────────────────────────────────────
  const GPS_METRICS = [
    { key: 'totalDistance', label: 'Distância Total', unit: 'm', color: '#f59e0b', decimals: 0 },
    { key: 'avgMmin',       label: 'm/min',           unit: 'm/min', color: '#10b981', decimals: 1 },
    { key: 'hsr',           label: 'HSR',             unit: 'm', color: '#3b82f6', decimals: 0 },
    { key: 'sprintDistance',label: 'Sprint',          unit: 'm', color: '#ef4444', decimals: 0 },
    { key: 'sprintCount',   label: 'Nº Sprints',      unit: '', color: '#8b5cf6', decimals: 0 },
    { key: 'accDecel',      label: 'ACC+DEC',         unit: '', color: '#f97316', decimals: 0 },
    { key: 'playerLoad',    label: 'Player Load',     unit: '', color: '#06b6d4', decimals: 0 },
  ]

  const mediaGpsData = useMemo(() => {
    // Para a MÉDIA do grupo, exclui atletas marcados — mas mostra todos na tabela
    const athletesWithGps = weekAthletes.filter(a => gpsWeekly[a])
    const athletesForAvg = athletesWithGps.filter(a => !excludedAthletes.has(a))
    if (!athletesForAvg.length && !athletesWithGps.length) return null

    // Médias do grupo por métrica (apenas atletas não excluídos)
    const teamAvgs = {}
    GPS_METRICS.forEach(m => {
      const vals = athletesForAvg.map(a => gpsWeekly[a][m.key] || 0).filter(v => v > 0)
      teamAvgs[m.key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    })

    // Posições com pelo menos 1 atleta com GPS (não excluído)
    const positions = [...new Set(athletesForAvg.map(a => playerPositions[a]).filter(Boolean))].sort()

    // Médias por posição por métrica (apenas atletas não excluídos)
    const posAvgs = {}
    positions.forEach(pos => {
      const posAthletes = athletesForAvg.filter(a => playerPositions[a] === pos)
      posAvgs[pos] = {}
      GPS_METRICS.forEach(m => {
        const vals = posAthletes.map(a => gpsWeekly[a][m.key] || 0).filter(v => v > 0)
        posAvgs[pos][m.key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
      })
    })

    // Dados para o gráfico de cada métrica: um ponto por posição + time todo
    const chartData = GPS_METRICS.map(m => {
      const points = [
        { label: 'EQUIPE', value: teamAvgs[m.key], isTeam: true },
        ...positions.map(pos => ({ label: pos, value: posAvgs[pos][m.key], isTeam: false })),
      ]
      return { ...m, points, teamAvg: teamAvgs[m.key] }
    })

    return { chartData, teamAvgs, positions, n: athletesForAvg.length, nTotal: athletesWithGps.length, nExcluded: excludedAthletes.size }
  }, [weekAthletes, gpsWeekly, playerPositions, excludedAthletes])

  // ── DADOS HISTÓRICOS PARA ABA EVOLUÇÃO ───────────────────────────────────
  const GPS_EVOLUCAO_METRICS = [
    { key: 'totalDistance',   label: 'Distância Total', unit: 'm',     color: '#f59e0b', decimals: 0 },
    { key: 'hsr',             label: 'HSR',             unit: 'm',     color: '#3b82f6', decimals: 0 },
    { key: 'sprintDistance',  label: 'Sprint',          unit: 'm',     color: '#ef4444', decimals: 0 },
    { key: 'sprintCount',     label: 'Nº Sprints',      unit: '',      color: '#8b5cf6', decimals: 0 },
    { key: 'accDecel',        label: 'ACC+DEC',         unit: '',      color: '#f97316', decimals: 0 },
    { key: 'avgMmin',         label: 'm/min',           unit: 'm/min', color: '#10b981', decimals: 1 },
    { key: 'playerLoad',      label: 'Player Load',     unit: '',      color: '#06b6d4', decimals: 0 },
    { key: 'maxVelocity',     label: 'Vmax',            unit: 'km/h',  color: '#ec4899', decimals: 1 },
  ]

  const historicalWeeks = useMemo(() => {
    const weeks = []
    for (let w = -(evolucaoWeeks - 1); w <= 0; w++) {
      const { monday: wMon, sunday: wSun } = getWeekBounds(w)
      const label = wMon.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

      // Sessões GPS da semana
      const wGps = gpsData.filter(s => {
        const dateStr = s.date || ''
        let dt
        if (dateStr.includes('-')) dt = new Date(dateStr + 'T12:00:00')
        else { const [d, m, y] = dateStr.split('/'); if (!d||!m||!y) return false; dt = new Date(`${y}-${m}-${d}T12:00:00`) }
        return dt >= wMon && dt <= wSun
      })

      // Lista de atletas da semana
      const wAthletes = [...new Set(wGps.flatMap(s => s.rows.filter(r => r.periodNumber === 0 && !r.isOutlier).map(r => r.playerName)))]

      // Médias do grupo por métrica GPS
      const groupGps = {}
      GPS_EVOLUCAO_METRICS.forEach(m => {
        const vals = wAthletes.map(a => {
          const rows = wGps.flatMap(s => s.rows.filter(r => r.playerName === a && r.periodNumber === 0 && !r.isOutlier))
          if (!rows.length) return null
          if (m.key === 'avgMmin') return rows.reduce((s,r) => s+(r.distanceRelative||0),0)/rows.length
          if (m.key === 'maxVelocity') return Math.max(...rows.map(r => r.maxVelocity||0))
          if (m.key === 'accDecel') return rows.reduce((s,r) => s+(r.acceleration||0)+(r.deceleration||0),0)
          return rows.reduce((s,r) => s+(r[m.key]||0),0)
        }).filter(v => v !== null && v > 0)
        groupGps[m.key] = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null
      })

      // Dados por atleta (se modo individual)
      const atletaGps = {}
      wAthletes.forEach(a => {
        const rows = wGps.flatMap(s => s.rows.filter(r => r.playerName === a && r.periodNumber === 0 && !r.isOutlier))
        if (!rows.length) return
        const ag = {}
        GPS_EVOLUCAO_METRICS.forEach(m => {
          if (m.key === 'avgMmin') ag[m.key] = rows.reduce((s,r) => s+(r.distanceRelative||0),0)/rows.length
          else if (m.key === 'maxVelocity') ag[m.key] = Math.max(...rows.map(r => r.maxVelocity||0))
          else if (m.key === 'accDecel') ag[m.key] = rows.reduce((s,r) => s+(r.acceleration||0)+(r.deceleration||0),0)
          else ag[m.key] = rows.reduce((s,r) => s+(r[m.key]||0),0)
        })
        atletaGps[a] = ag
      })

      weeks.push({ label, weekOffset: w, groupGps, atletaGps, athleteCount: wAthletes.length, sessionCount: wGps.length })
    }
    return weeks
  }, [gpsData, evolucaoWeeks])

  // Lista de atletas com GPS histórico (para seletor)
  const atletasComHistorico = useMemo(() => {
    const set = new Set(historicalWeeks.flatMap(w => Object.keys(w.atletaGps)))
    return Array.from(set).sort()
  }, [historicalWeeks])

  // Dados do gráfico de linha para a métrica selecionada
  const evolucaoChartData = useMemo(() => {
    return historicalWeeks.map(w => {
      const point = { label: w.label, sessions: w.sessionCount, athletes: w.athleteCount }
      if (evolucaoAtleta) {
        point.value = w.atletaGps[evolucaoAtleta]?.[evolucaoMetric] ?? null
      } else {
        point.value = w.groupGps[evolucaoMetric]
      }
      return point
    })
  }, [historicalWeeks, evolucaoAtleta, evolucaoMetric])

  const totalLoad = weekAthletes.reduce((s, a) => s + (weekStats[a]?.weeklySum || 0), 0)
  const avgAcwr = weekAthletes.filter(a => weekStats[a]?.acwr).length > 0
    ? weekAthletes.filter(a => weekStats[a]?.acwr).reduce((s, a) => s + weekStats[a].acwr, 0) / weekAthletes.filter(a => weekStats[a]?.acwr).length
    : null
  const highRiskCount = weekAthletes.filter(a => weekStats[a]?.acwr > 1.5 || weekStats[a]?.monotony > 2).length

  return (
    <div className="min-h-screen bg-white text-black p-4 font-sans">
      <div className="max-w-[1600px] mx-auto flex flex-col gap-5">

        {/* HEADER */}
        <header className="flex justify-between items-center border-b-4 border-amber-500 pb-3">
          <div className="flex items-center gap-4">
            <img src="/club/escudonovorizontino.png" alt="Escudo" className="h-14 w-auto" />
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-black uppercase leading-none">Microciclo Semanal</h1>
              <p className="text-sm font-bold tracking-widest text-slate-600 uppercase">Carga, Monotonia & ACWR</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => router.push('/fisiologia')} className="bg-slate-200 text-slate-800 px-3 py-1 rounded-md text-xs font-bold hover:bg-slate-300 transition-colors">← VOLTAR</button>
            <button
              onClick={async () => {
                setIsPdfLoading(true)
                try {
                  const { default: jsPDF } = await import('jspdf')
                  const { default: autoTable } = await import('jspdf-autotable')
                  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
                  const pageW = doc.internal.pageSize.getWidth()
                  const pageH = doc.internal.pageSize.getHeight()

                  // ── Cabeçalho ──
                  doc.setFillColor(245, 158, 11)
                  doc.rect(0, 0, pageW, 18, 'F')
                  doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0)
                  doc.text('RELATÓRIO SEMANAL DE CARGA', 14, 11)
                  doc.setFontSize(9); doc.setFont('helvetica', 'normal')
                  doc.text(weekLabel, pageW - 14, 11, { align: 'right' })

                  // ── KPIs ──
                  doc.setFontSize(8); doc.setTextColor(80, 80, 80)
                  doc.text(`Atletas: ${weekAthletes.length}  |  Sessões GPS: ${weekGps.length}  |  ACWR Médio: ${avgAcwr ? avgAcwr.toFixed(2) : '—'}  |  Risco Elevado: ${highRiskCount}`, 14, 25)

                  // ── Heatmap de carga (tabela) ──
                  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(0,0,0)
                  doc.text('HEATMAP DE CARGA sRPE × min', 14, 32)
                  const heatHead = [['Atleta', ...WEEK_DAYS, 'Total UA', 'ACWR', 'Monotonia']]
                  const heatBody = sortedCargaAthletes.slice(0, 25).map(a => {
                    const st = weekStats[a]
                    return [
                      a.split(' ').slice(0,2).join(' '),
                      ...weekDays.map(d => srpeMatrix[a][d] ? srpeMatrix[a][d].toFixed(0) : '—'),
                      st?.weeklySum?.toFixed(0) || '—',
                      st?.acwr ? st.acwr.toFixed(2) : '—',
                      st?.monotony ? st.monotony.toFixed(2) : '—',
                    ]
                  })
                  autoTable(doc, {
                    startY: 34,
                    head: heatHead,
                    body: heatBody,
                    styles: { fontSize: 7, cellPadding: 1.5 },
                    headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
                    alternateRowStyles: { fillColor: [250, 250, 250] },
                    didParseCell: (data) => {
                      if (data.section === 'body') {
                        const val = parseFloat(data.cell.text[0])
                        if (!isNaN(val) && data.column.index >= 1 && data.column.index <= 7) {
                          if (val >= 600) { data.cell.styles.fillColor = [254, 240, 138]; data.cell.styles.textColor = [146, 64, 14] }
                          else if (val >= 400) { data.cell.styles.fillColor = [254, 215, 170]; data.cell.styles.textColor = [154, 52, 18] }
                          else if (val > 0) { data.cell.styles.fillColor = [254, 243, 199]; data.cell.styles.textColor = [180, 83, 9] }
                        }
                      }
                    },
                    margin: { left: 14, right: 14 },
                  })

                  let y = doc.lastAutoTable.finalY + 8

                  // ── GPS Médias ──
                  const gpsKeys2 = ['totalDistance','hsr','sprintDistance','sprintCount','accDecel','avgMmin','playerLoad']
                  const gpsLabels2 = ['Dist (m)','HSR (m)','Sprint (m)','Nº Sprints','ACC+DEC','m/min','PL']
                  const gpsAthletesForPdf = weekAthletes.filter(a => gpsWeekly[a])
                  if (gpsAthletesForPdf.length > 0 && y < pageH - 40) {
                    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(0,0,0)
                    doc.text('MÉDIAS GPS SEMANAL', 14, y)
                    const gpsGroupAvg2 = {}
                    gpsKeys2.forEach(k => {
                      const vals = gpsAthletesForPdf.map(a => gpsWeekly[a]?.[k] || 0).filter(v => v > 0)
                      gpsGroupAvg2[k] = vals.length ? vals.reduce((a,b) => a+b,0) / vals.length : null
                    })
                    autoTable(doc, {
                      startY: y + 2,
                      head: [['Atleta', ...gpsLabels2]],
                      body: [
                        ['Média Grupo', ...gpsKeys2.map(k => gpsGroupAvg2[k] != null ? (k === 'avgMmin' ? gpsGroupAvg2[k].toFixed(1) : gpsGroupAvg2[k].toFixed(0)) : '—')],
                        ...gpsAthletesForPdf.slice(0, 15).map(a => {
                          const g = gpsWeekly[a]
                          return [
                            a.split(' ').slice(0,2).join(' '),
                            ...gpsKeys2.map(k => g?.[k] != null ? (k === 'avgMmin' ? g[k].toFixed(1) : g[k].toFixed(0)) : '—')
                          ]
                        })
                      ],
                      styles: { fontSize: 7, cellPadding: 1.5 },
                      headStyles: { fillColor: [30,30,30], textColor: 255, fontStyle: 'bold' },
                      bodyStyles: { textColor: [40,40,40] },
                      rowPageBreak: 'avoid',
                      margin: { left: 14, right: 14 },
                    })
                  }

                  // ── Alertas ACWR ──
                  const alertas = weekAthletes.filter(a => weekStats[a]?.acwr > 1.5 || weekStats[a]?.monotony > 2)
                  if (alertas.length > 0) {
                    const finalY2 = doc.lastAutoTable ? doc.lastAutoTable.finalY + 8 : y + 8
                    if (finalY2 < pageH - 30) {
                      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(200, 0, 0)
                      doc.text(`⚠ ALERTAS DE CARGA (${alertas.length} atleta(s))`, 14, finalY2)
                      autoTable(doc, {
                        startY: finalY2 + 2,
                        head: [['Atleta', 'ACWR', 'Monotonia', 'Strain', 'Situação']],
                        body: alertas.map(a => {
                          const st = weekStats[a]
                          return [
                            a.split(' ').slice(0,2).join(' '),
                            st?.acwr?.toFixed(2) || '—',
                            st?.monotony?.toFixed(2) || '—',
                            st?.strain?.toFixed(0) || '—',
                            st?.acwr > 1.5 ? 'ACWR ALTO' : 'MONOTONIA ALTA',
                          ]
                        }),
                        styles: { fontSize: 7, cellPadding: 1.5 },
                        headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
                        alternateRowStyles: { fillColor: [255, 245, 245] },
                        margin: { left: 14, right: 14 },
                      })
                    }
                  }

                  // ── Rodapé ──
                  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150)
                  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} · Central de Fisiologia GN · Confidencial`, pageW / 2, pageH - 5, { align: 'center' })

                  doc.save(`relatorio-semanal-${monday.toISOString().split('T')[0]}.pdf`)
                } catch(e) {
                  console.error('PDF error:', e)
                } finally {
                  setIsPdfLoading(false)
                }
              }}
              disabled={isPdfLoading || weekAthletes.length === 0}
              className="flex items-center gap-2 bg-black text-white px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPdfLoading ? '⏳ Gerando...' : '⬇ PDF Semanal'}
            </button>
            {availablePositions.length > 0 && (
              <select
                value={filterPosition}
                onChange={e => setFilterPosition(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1 text-xs font-black bg-white text-slate-700 focus:border-amber-400 focus:outline-none">
                <option value="">Todas as posições</option>
                {availablePositions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
            <div className="flex items-center gap-1">
              <button onClick={() => setWeekOffset(w => w - 1)} className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-600 font-black text-sm transition-all">‹</button>
              <div className="bg-amber-500 text-black px-3 py-1 font-black text-xs uppercase italic shadow-md min-w-[160px] text-center">{weekLabel}</div>
              <button onClick={() => setWeekOffset(w => Math.min(0, w + 1))} className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-600 font-black text-sm transition-all">›</button>
            </div>
          </div>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Carga Total Semana</p>
            <p className="text-2xl font-black text-black">{totalLoad > 0 ? totalLoad.toFixed(0) : '—'}</p>
            <p className="text-[10px] text-slate-500">UA (sRPE × min)</p>
          </div>
          <div className={`border rounded-xl p-3 ${acwrBg(avgAcwr)}`}>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">ACWR Médio</p>
            <p className={`text-2xl font-black ${acwrColor(avgAcwr)}`}>{avgAcwr ? avgAcwr.toFixed(2) : '—'}</p>
            <p className="text-[10px] text-slate-500">ideal: 0.8 – 1.3</p>
          </div>
          <div className={`border rounded-xl p-3 ${highRiskCount > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Risco Elevado</p>
            <p className={`text-2xl font-black ${highRiskCount > 0 ? 'text-red-600' : 'text-green-600'}`}>{highRiskCount}</p>
            <p className="text-[10px] text-slate-500">ACWR {'>'} 1.5 ou mono. {'>'} 2</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Atletas na semana</p>
            <p className="text-2xl font-black text-black">{weekAthletes.length}</p>
            <p className="text-[10px] text-slate-500">{weekGps.length} sessão(ões) GPS</p>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
          {[
            { id: 'carga', label: 'Carga & Monotonia' },
            { id: 'gps', label: 'GPS Semanal' },
            { id: 'bemEstar', label: 'Bem-Estar Diário' },
            { id: 'heatmap', label: '🌡 Heatmap' },
            { id: 'mediaGps', label: '📊 Médias GPS' },
            { id: 'evolucao', label: '📈 Evolução Semanal' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ${activeTab === t.id ? 'border-b-2 border-amber-500 text-black' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB: CARGA & MONOTONIA */}
        {activeTab === 'carga' && (
          <div className="overflow-x-auto">
            {sortedCargaAthletes.length > 0 ? (
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-900">
                    <SortTh label="Atleta" col="name" sort={sortCarga} onSort={c => toggleSort(sortCarga, c, setSortCarga)} className="text-left pr-4" />
                    {weekDays.map((d, i) => (
                      <th key={d} className="text-center py-2 px-2 font-black uppercase tracking-widest text-[10px] text-slate-500 min-w-[60px]">
                        {WEEK_DAYS[i]}<br />
                        <span className="font-medium normal-case text-[9px]">{new Date(d + 'T12:00:00').getDate()}</span>
                      </th>
                    ))}
                    <SortTh label="Total UA" col="total" sort={sortCarga} onSort={c => toggleSort(sortCarga, c, setSortCarga)} />
                    <SortTh label="Mono." col="mono" sort={sortCarga} onSort={c => toggleSort(sortCarga, c, setSortCarga)} />
                    <SortTh label="Strain" col="strain" sort={sortCarga} onSort={c => toggleSort(sortCarga, c, setSortCarga)} />
                    <SortTh label="ACWR" col="acwr" sort={sortCarga} onSort={c => toggleSort(sortCarga, c, setSortCarga)} />
                  </tr>
                </thead>
                <tbody>
                  {sortedCargaAthletes.map((athlete, idx) => {
                    const stats = weekStats[athlete]
                    const total = stats?.weeklySum || 0
                    const below20 = groupCargaAvg && total > 0 && total < groupCargaAvg * 0.8
                    return (
                      <tr
                        key={athlete}
                        className={`border-b border-slate-100 cursor-pointer hover:bg-amber-50 transition-colors ${below20 ? 'bg-red-50/60' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                        onClick={() => router.push(`/fisiologia/individual?atleta=${encodeURIComponent(athlete)}`)}
                      >
                        <td className="py-2 pr-4 font-bold text-black text-xs">
                          <div className="flex items-center gap-2">
                            <AthleteAvatar name={athlete} size="w-7 h-7" />
                            <span>{athlete.split(' ').slice(0, 2).join(' ')}</span>
                            {below20 && <span className="ml-1 text-[8px] bg-red-100 text-red-600 px-1 py-0.5 rounded font-black">↓20%</span>}
                          </div>
                        </td>
                        {weekDays.map(d => {
                          const load = srpeMatrix[athlete][d]
                          const intensity = load ? Math.min(load / 800, 1) : 0
                          return (
                            <td key={d} className="text-center py-2 px-2">
                              {load ? (
                                <div
                                  className="mx-auto w-10 h-7 rounded flex items-center justify-center font-black text-[10px]"
                                  style={{ backgroundColor: `rgba(245, 158, 11, ${0.15 + intensity * 0.75})`, color: intensity > 0.5 ? '#92400e' : '#b45309' }}
                                >
                                  {load.toFixed(0)}
                                </div>
                              ) : (
                                <div className="mx-auto w-10 h-7 rounded flex items-center justify-center text-slate-300 text-[10px]">—</div>
                              )}
                            </td>
                          )
                        })}
                        <td className={`text-center py-2 px-2 font-black ${below20 ? 'text-red-600' : 'text-black'}`}>{total > 0 ? total.toFixed(0) : '—'}</td>
                        <td className={`text-center py-2 px-2 font-black ${monotonyColor(stats?.monotony)}`}>{stats?.monotony > 0 ? stats.monotony.toFixed(2) : '—'}</td>
                        <td className="text-center py-2 px-2 font-bold text-slate-600">{stats?.strain > 0 ? stats.strain.toFixed(0) : '—'}</td>
                        <td className={`text-center py-2 px-2 font-black ${acwrColor(stats?.acwr)}`}>{stats?.acwr ? stats.acwr.toFixed(2) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
                {groupCargaAvg && (
                  <tfoot className="border-t-2 border-slate-300 bg-amber-50">
                    <tr>
                      <td className="py-2 pr-4 font-black text-[10px] uppercase text-amber-700">Média Grupo</td>
                      {weekDays.map(d => {
                        const dayLoads = sortedCargaAthletes.map(a => srpeMatrix[a][d]).filter(Boolean)
                        const dayAvg = dayLoads.length ? dayLoads.reduce((a,b) => a+b, 0) / dayLoads.length : null
                        const intensity = dayAvg ? Math.min(dayAvg / 800, 1) : 0
                        return (
                          <td key={d} className="text-center py-2 px-2">
                            {dayAvg ? (
                              <div className="mx-auto w-10 h-7 rounded flex items-center justify-center font-black text-[10px]"
                                style={{ backgroundColor: `rgba(245, 158, 11, ${0.15 + intensity * 0.75})`, color: '#92400e' }}>
                                {dayAvg.toFixed(0)}
                              </div>
                            ) : <span className="text-slate-300 text-[10px]">—</span>}
                          </td>
                        )
                      })}
                      <td className="text-center py-2 px-2 font-black text-amber-700">{groupCargaAvg.toFixed(0)}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                )}
              </table>
            ) : (
              <div className="text-center py-12 text-slate-400 font-medium text-sm">Sem dados de carga para esta semana</div>
            )}
            <div className="mt-3 flex flex-wrap gap-4 text-[10px] font-bold text-slate-500">
              <span>🟡 Intensidade da cor = carga sRPE×min</span>
              <span className="text-red-500">🔴 Fundo vermelho = carga &gt;20% abaixo da média do grupo</span>
              <span>ACWR ideal: 0.8–1.3 | &gt;1.5 = risco</span>
              <span>Monotonia &lt;1.5 = ✓ | &gt;2.0 = atenção</span>
            </div>
          </div>
        )}

        {/* TAB: GPS SEMANAL */}
        {activeTab === 'gps' && (
          <div className="overflow-x-auto">
            {/* Botão de seleção para média */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {excludedAthletes.size > 0 && (
                  <span className="bg-amber-100 text-amber-700 border border-amber-300 px-2 py-1 rounded-lg text-[10px] font-black uppercase">
                    ⚠ {excludedAthletes.size} atleta(s) fora da média
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowExcludePanel(p => !p)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${showExcludePanel ? 'bg-amber-500 text-black border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-400'}`}
              >
                ☑ Selecionar atletas p/ média
              </button>
            </div>

            {/* Painel de seleção */}
            {showExcludePanel && (() => {
              const athletesWithGps = weekAthletes.filter(a => gpsWeekly[a])
              return (
                <div className="mb-4 border-2 border-amber-300 bg-amber-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-amber-800">Atletas incluídos na média do grupo</p>
                      <p className="text-[10px] text-amber-600 font-medium mt-0.5">
                        Desmarque atletas que não participaram normalmente (DM, goleiro no profissional, erro de GPS, etc.)
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setExcludedAthletes(new Set())}
                        className="text-[10px] font-black uppercase tracking-widest text-amber-700 hover:text-amber-900 px-2 py-1 rounded-lg border border-amber-300 hover:bg-amber-100 transition-all"
                      >
                        Incluir todos
                      </button>
                      <button
                        onClick={() => setExcludedAthletes(new Set(athletesWithGps))}
                        className="text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-800 px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 transition-all"
                      >
                        Desmarcar todos
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {athletesWithGps.map(athlete => {
                      const isExcluded = excludedAthletes.has(athlete)
                      const g = gpsWeekly[athlete]
                      return (
                        <button
                          key={athlete}
                          onClick={() => toggleExclude(athlete)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                            isExcluded
                              ? 'bg-white border-slate-200 text-slate-400 line-through opacity-60'
                              : 'bg-white border-amber-400 text-black hover:bg-amber-50'
                          }`}
                        >
                          <AthleteAvatar name={athlete} size="w-6 h-6" />
                          <span>{athlete.split(' ').slice(0, 2).join(' ')}</span>
                          <span className="text-[9px] text-slate-400 font-medium">{g?.sessions ?? 0} sess.</span>
                          {isExcluded
                            ? <span className="text-[9px] bg-red-100 text-red-500 px-1 rounded font-black">FORA</span>
                            : <span className="text-[9px] bg-green-100 text-green-700 px-1 rounded font-black">✓</span>
                          }
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-3 text-[10px] text-amber-600 font-bold">
                    Média calculada com {athletesWithGps.length - excludedAthletes.size} atleta(s) de {athletesWithGps.length} com GPS na semana
                  </p>
                </div>
              )
            })()}
            {sortedGpsAthletes.length > 0 ? (() => {
              // Médias GPS do grupo (somente atletas com dados E não excluídos)
              const gpsKeys = ['totalDistance','hsr','sprintDistance','sprintCount','accDecel','avgMmin','maxVelocity','playerLoad']
              const groupGpsAvg = {}
              gpsKeys.forEach(k => {
                const vals = sortedGpsAthletes
                  .filter(a => !excludedAthletes.has(a))
                  .map(a => gpsWeekly[a]?.[k] || 0).filter(v => v > 0)
                groupGpsAvg[k] = vals.length ? vals.reduce((a,b) => a+b,0) / vals.length : null
              })
              // Cor relativa à média: verde >120%, vermelho <80%
              function cellCls(val, avg) {
                if (!val || !avg) return ''
                const r = val / avg
                if (r > 1.2) return 'bg-green-100 text-green-800'
                if (r < 0.8) return 'bg-red-50 text-red-700'
                return ''
              }
              return (
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b-2 border-slate-900">
                      <SortTh label="Atleta" col="name" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} className="text-left pr-4" />
                      <SortTh label="Sessões" col="sessions" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} />
                      <SortTh label="Dist (m)" col="totalDistance" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} />
                      <SortTh label="HSR (m)" col="hsr" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} />
                      <SortTh label="Sprint (m)" col="sprintDistance" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} />
                      <SortTh label="Sprints" col="sprintCount" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} />
                      <SortTh label="ACC+DEC" col="accDecel" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} />
                      <SortTh label="m/min" col="avgMmin" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} />
                      <SortTh label="Vmax" col="maxVelocity" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} />
                      <SortTh label="PL" col="playerLoad" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedGpsAthletes.map((athlete, idx) => {
                      const g = gpsWeekly[athlete]
                      const isExcluded = excludedAthletes.has(athlete)
                      return (
                        <tr key={athlete} className={`border-b border-slate-100 hover:bg-amber-50 cursor-pointer ${isExcluded ? 'opacity-50 bg-slate-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                          onClick={() => router.push(`/fisiologia/individual?atleta=${encodeURIComponent(athlete)}`)}>
                          <td className="py-2 pr-4 font-bold text-black">
                            <div className="flex items-center gap-2">
                              <AthleteAvatar name={athlete} size="w-7 h-7" />
                              <span>{athlete.split(' ').slice(0, 2).join(' ')}</span>
                              {isExcluded && (
                                <span className="text-[8px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-black uppercase">Fora da média</span>
                              )}
                            </div>
                          </td>
                          <td className="text-center py-2 px-3 font-bold text-slate-600">{g.sessions}</td>
                          <td className={`text-center py-2 px-3 font-black rounded ${cellCls(g.totalDistance, groupGpsAvg.totalDistance)}`}>{g.totalDistance.toFixed(0)}</td>
                          <td className={`text-center py-2 px-3 font-black rounded ${cellCls(g.hsr, groupGpsAvg.hsr)}`}>{g.hsr.toFixed(0)}</td>
                          <td className={`text-center py-2 px-3 font-bold rounded ${cellCls(g.sprintDistance, groupGpsAvg.sprintDistance)}`}>{g.sprintDistance.toFixed(0)}</td>
                          <td className={`text-center py-2 px-3 font-bold rounded ${cellCls(g.sprintCount, groupGpsAvg.sprintCount)}`}>{g.sprintCount}</td>
                          <td className={`text-center py-2 px-3 font-black rounded ${cellCls(g.accDecel, groupGpsAvg.accDecel)}`}>{g.accDecel}</td>
                          <td className={`text-center py-2 px-3 font-bold rounded ${cellCls(g.avgMmin, groupGpsAvg.avgMmin)}`}>{g.avgMmin.toFixed(1)}</td>
                          <td className="text-center py-2 px-3 font-bold text-slate-700">{g.maxVelocity.toFixed(1)}</td>
                          <td className={`text-center py-2 px-3 font-bold rounded ${cellCls(g.playerLoad, groupGpsAvg.playerLoad)}`}>{g.playerLoad.toFixed(0)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-300 bg-amber-50">
                    <tr>
                      <td className="py-2 pr-4 font-black text-[10px] uppercase text-amber-700">
                        Média Grupo
                        {excludedAthletes.size > 0 && (
                          <span className="ml-1 text-[8px] bg-amber-200 text-amber-800 px-1 py-0.5 rounded normal-case font-black">
                            {sortedGpsAthletes.filter(a => !excludedAthletes.has(a)).length}/{sortedGpsAthletes.length} atletas
                          </span>
                        )}
                      </td>
                      <td className="text-center py-2 px-3 text-amber-500 font-black">—</td>
                      {gpsKeys.map(k => (
                        <td key={k} className="text-center py-2 px-3 font-black text-amber-700 text-[10px]">
                          {groupGpsAvg[k] != null ? (k === 'avgMmin' ? groupGpsAvg[k].toFixed(1) : k === 'maxVelocity' ? groupGpsAvg[k].toFixed(1) : groupGpsAvg[k].toFixed(0)) : '—'}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              )
            })() : (
              <div className="text-center py-12 text-slate-400 font-medium text-sm">Sem GPS para esta semana. Carregue um CSV na página inicial.</div>
            )}
            <div className="mt-3 flex flex-wrap gap-4 text-[10px] font-bold text-slate-500">
              <span className="text-green-700">🟢 Verde = &gt;20% acima da média do grupo</span>
              <span className="text-red-600">🔴 Vermelho = &gt;20% abaixo da média do grupo</span>
            </div>
          </div>
        )}

        {/* TAB: BEM-ESTAR DIÁRIO */}
        {activeTab === 'bemEstar' && (
          <div className="overflow-x-auto">
            <div className="flex justify-end mb-2">
              <button onClick={fetchBemEstar} disabled={isLoadingBemEstar} className="bg-slate-100 hover:bg-amber-100 text-slate-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all">
                {isLoadingBemEstar ? 'Carregando...' : '↻ Atualizar Bem-Estar'}
              </button>
            </div>
            {sortedBemAthletes.length > 0 ? (() => {
              // Média do grupo por dia e geral
              const dayGroupAvgs = weekDays.map(d => {
                const scores = sortedBemAthletes.map(a => {
                  const pre = weekBemEstar.find(r => normName(r.playerName) === normName(a) && r.type === 'pre' && r.date === d)
                  return pre?.wellnessScore || null
                }).filter(Boolean)
                return scores.length ? scores.reduce((a,b) => a+b,0) / scores.length : null
              })
              const allGroupScores = dayGroupAvgs.filter(Boolean)
              const groupWellnessAvg = allGroupScores.length ? allGroupScores.reduce((a,b) => a+b,0) / allGroupScores.length : null

              return (
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b-2 border-slate-900">
                      <SortTh label="Atleta" col="name" sort={sortBem} onSort={c => toggleSort(sortBem, c, setSortBem)} className="text-left pr-4" />
                      {weekDays.map((d, i) => (
                        <th key={d} className="text-center py-2 px-2 font-black uppercase tracking-widest text-[10px] text-slate-500 min-w-[60px]">
                          {WEEK_DAYS[i]}<br />
                          <span className="font-medium normal-case text-[9px]">{new Date(d + 'T12:00:00').getDate()}</span>
                        </th>
                      ))}
                      <SortTh label="Média" col="avg" sort={sortBem} onSort={c => toggleSort(sortBem, c, setSortBem)} />
                      <th className="text-center py-2 px-2 font-black uppercase tracking-widest text-[10px] text-slate-500">Alertas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBemAthletes.map((athlete, idx) => {
                      const scores = weekDays.map(d => {
                        const pre = weekBemEstar.find(r => normName(r.playerName) === normName(athlete) && r.type === 'pre' && r.date === d)
                        return pre?.wellnessScore || null
                      })
                      const validScores = scores.filter(s => s !== null)
                      const avgScore = validScores.length > 0 ? validScores.reduce((a, b) => a + b, 0) / validScores.length : null
                      const hasDor = weekBemEstar.some(r => normName(r.playerName) === normName(athlete) && r.temDor)
                      const hasBaixo = scores.some(s => s !== null && s < 2.5)
                      const belowGroup = groupWellnessAvg && avgScore && avgScore < groupWellnessAvg * 0.8

                      return (
                        <tr key={athlete} className={`border-b border-slate-100 hover:bg-amber-50 cursor-pointer ${belowGroup ? 'bg-red-50/40' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                          onClick={() => router.push(`/fisiologia/individual?atleta=${encodeURIComponent(athlete)}`)}>
                          <td className="py-2 pr-4 font-bold text-black">
                            <div className="flex items-center gap-2">
                              <AthleteAvatar name={athlete} size="w-7 h-7" />
                              <span>
                                {athlete.split(' ').slice(0, 2).join(' ')}
                                {belowGroup && <span className="ml-2 text-[8px] bg-red-100 text-red-600 px-1 py-0.5 rounded font-black">↓20%</span>}
                              </span>
                            </div>
                          </td>
                          {scores.map((s, i) => (
                            <td key={i} className="text-center py-2 px-2">
                              {s !== null ? (
                                <div className={`mx-auto w-9 h-7 rounded flex items-center justify-center font-black text-xs ${s >= 3.5 ? 'bg-green-100 text-green-700' : s >= 2.5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                  {s.toFixed(1)}
                                </div>
                              ) : (
                                <div className="mx-auto w-9 h-7 rounded flex items-center justify-center text-slate-200 text-xs">—</div>
                              )}
                            </td>
                          ))}
                          <td className="text-center py-2 px-2">
                            <span className={`font-black text-xs ${avgScore ? (avgScore >= 3.5 ? 'text-green-600' : avgScore >= 2.5 ? 'text-amber-600' : 'text-red-600') : 'text-slate-400'}`}>
                              {avgScore ? avgScore.toFixed(1) : '—'}
                            </span>
                          </td>
                          <td className="text-center py-2 px-2">
                            <div className="flex gap-1 justify-center">
                              {hasBaixo && <span className="text-[8px] bg-red-100 text-red-600 px-1 py-0.5 rounded font-black">SCORE</span>}
                              {hasDor && <span className="text-[8px] bg-orange-100 text-orange-600 px-1 py-0.5 rounded font-black">DOR</span>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-300 bg-amber-50">
                    <tr>
                      <td className="py-2 pr-4 font-black text-[10px] uppercase text-amber-700">Média Grupo</td>
                      {dayGroupAvgs.map((avg, i) => (
                        <td key={i} className="text-center py-2 px-2">
                          {avg !== null ? (
                            <div className={`mx-auto w-9 h-7 rounded flex items-center justify-center font-black text-xs ${avg >= 3.5 ? 'bg-green-100 text-green-700' : avg >= 2.5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                              {avg.toFixed(1)}
                            </div>
                          ) : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                      ))}
                      <td className="text-center py-2 px-2">
                        <span className={`font-black text-xs ${groupWellnessAvg ? (groupWellnessAvg >= 3.5 ? 'text-green-600' : groupWellnessAvg >= 2.5 ? 'text-amber-600' : 'text-red-600') : 'text-slate-400'}`}>
                          {groupWellnessAvg ? groupWellnessAvg.toFixed(1) : '—'}
                        </span>
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )
            })() : (
              <div className="text-center py-12 text-slate-400 font-medium text-sm">Sem dados de bem-estar para esta semana</div>
            )}
            <div className="mt-3 flex flex-wrap gap-4 text-[10px] font-bold text-slate-500">
              <span className="text-green-600">🟢 ≥ 3.5 = Prontidão boa</span>
              <span className="text-amber-600">🟡 2.5–3.4 = Atenção</span>
              <span className="text-red-600">🔴 &lt; 2.5 = Alerta</span>
              <span className="text-red-500">↓20% = wellness abaixo de 80% da média do grupo</span>
            </div>
          </div>
        )}

        {/* TAB: HEATMAP */}
        {activeTab === 'heatmap' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Visualização rápida</p>
                <h2 className="text-xl font-black text-black uppercase leading-none">Heatmap de Carga</h2>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-bold">
                <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded" style={{background:'rgba(245,158,11,0.9)'}} /> Alta (&gt;600 UA)</span>
                <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded" style={{background:'rgba(245,158,11,0.55)'}} /> Média</span>
                <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded" style={{background:'rgba(245,158,11,0.2)'}} /> Baixa</span>
                <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded bg-slate-100" /> Ausente</span>
              </div>
            </div>

            {sortedCargaAthletes.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm font-medium">Sem dados de carga para esta semana</div>
            ) : (
              <div className="overflow-x-auto">
                <div className="inline-block min-w-full">
                  {/* Header dos dias */}
                  <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: '200px repeat(7, 1fr) 80px 60px' }}>
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-2">Atleta</div>
                    {WEEK_DAYS.map((d, i) => (
                      <div key={d} className="text-center text-[9px] font-black uppercase tracking-widest text-slate-500">
                        {d}<br />
                        <span className="font-medium normal-case text-[8px]">
                          {new Date(weekDays[i] + 'T12:00:00').getDate()}
                        </span>
                      </div>
                    ))}
                    <div className="text-center text-[9px] font-black uppercase tracking-widest text-slate-500">Total</div>
                    <div className="text-center text-[9px] font-black uppercase tracking-widest text-slate-500">ACWR</div>
                  </div>

                  {/* Linhas dos atletas */}
                  {sortedCargaAthletes.map((athlete, idx) => {
                    const stats = weekStats[athlete]
                    const total = stats?.weeklySum || 0
                    const maxLoad = Math.max(...sortedCargaAthletes.map(a => weekStats[a]?.weeklySum || 0), 1)
                    return (
                      <div
                        key={athlete}
                        className="grid gap-1 mb-0.5 items-center cursor-pointer group"
                        style={{ gridTemplateColumns: '200px repeat(7, 1fr) 80px 60px' }}
                        onClick={() => router.push(`/fisiologia/individual?atleta=${encodeURIComponent(athlete)}`)}
                      >
                        {/* Nome */}
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg group-hover:bg-amber-50 transition-colors">
                          <AthleteAvatar name={athlete} size="w-6 h-6" />
                          <span className="text-xs font-bold text-black truncate">{athlete.split(' ').slice(0,2).join(' ')}</span>
                        </div>

                        {/* Células de carga por dia */}
                        {weekDays.map(d => {
                          const load = srpeMatrix[athlete][d]
                          const intensity = load ? Math.min(load / 800, 1) : 0
                          const bgAlpha = load ? 0.15 + intensity * 0.75 : 0
                          return (
                            <div
                              key={d}
                              className="h-10 rounded-lg flex items-center justify-center transition-all"
                              style={{
                                backgroundColor: load ? `rgba(245,158,11,${bgAlpha})` : '#f8fafc',
                                border: load ? 'none' : '1px solid #f1f5f9',
                              }}
                            >
                              {load ? (
                                <span
                                  className="text-[10px] font-black"
                                  style={{ color: intensity > 0.5 ? '#92400e' : '#b45309' }}
                                >
                                  {load.toFixed(0)}
                                </span>
                              ) : (
                                <span className="text-slate-200 text-[9px]">—</span>
                              )}
                            </div>
                          )
                        })}

                        {/* Total com barra inline */}
                        <div className="relative h-10 rounded-lg overflow-hidden bg-slate-100">
                          <div
                            className="absolute inset-y-0 left-0 rounded-lg transition-all"
                            style={{
                              width: `${(total / maxLoad) * 100}%`,
                              backgroundColor: total > 0 ? 'rgba(245,158,11,0.35)' : 'transparent',
                            }}
                          />
                          <div className="relative flex items-center justify-center h-full">
                            <span className="text-[10px] font-black text-slate-700">{total > 0 ? total.toFixed(0) : '—'}</span>
                          </div>
                        </div>

                        {/* ACWR badge */}
                        <div className={`h-10 rounded-lg flex items-center justify-center text-[10px] font-black ${
                          !stats?.acwr ? 'bg-slate-100 text-slate-400'
                          : stats.acwr >= 0.8 && stats.acwr <= 1.3 ? 'bg-green-100 text-green-700'
                          : stats.acwr > 1.3 && stats.acwr <= 1.5 ? 'bg-amber-100 text-amber-700'
                          : stats.acwr > 1.5 ? 'bg-red-100 text-red-700'
                          : 'bg-slate-100 text-slate-400'
                        }`}>
                          {stats?.acwr ? stats.acwr.toFixed(2) : '—'}
                        </div>
                      </div>
                    )
                  })}

                  {/* Linha de média do grupo */}
                  {groupCargaAvg && (
                    <div className="grid gap-1 mt-1 border-t-2 border-slate-900 pt-1 items-center" style={{ gridTemplateColumns: '200px repeat(7, 1fr) 80px 60px' }}>
                      <div className="px-2 py-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-amber-700">Média Grupo</span>
                      </div>
                      {weekDays.map(d => {
                        const dayLoads = sortedCargaAthletes.map(a => srpeMatrix[a][d]).filter(Boolean)
                        const dayAvg = dayLoads.length ? dayLoads.reduce((a,b) => a+b,0) / dayLoads.length : null
                        const intensity = dayAvg ? Math.min(dayAvg / 800, 1) : 0
                        return (
                          <div
                            key={d}
                            className="h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: dayAvg ? `rgba(245,158,11,${0.15 + intensity * 0.75})` : '#f8fafc', border: dayAvg ? 'none' : '1px solid #f1f5f9' }}
                          >
                            {dayAvg ? (
                              <span className="text-[10px] font-black" style={{ color: '#92400e' }}>{dayAvg.toFixed(0)}</span>
                            ) : <span className="text-slate-200 text-[9px]">—</span>}
                          </div>
                        )
                      })}
                      <div className="h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                        <span className="text-[10px] font-black text-amber-700">{groupCargaAvg.toFixed(0)}</span>
                      </div>
                      <div className="h-10 rounded-lg bg-slate-50 flex items-center justify-center">
                        <span className="text-[10px] font-black text-slate-500">
                          {avgAcwr ? avgAcwr.toFixed(2) : '—'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-500">
              <span>🌡 Cor = intensidade da carga sRPE×min do dia</span>
              <span className="text-green-600">ACWR 0.8–1.3 = zona ideal</span>
              <span className="text-amber-600">ACWR 1.3–1.5 = atenção</span>
              <span className="text-red-600">ACWR &gt;1.5 = risco</span>
            </div>
          </div>
        )}

        {/* TAB: MÉDIAS GPS */}
        {activeTab === 'mediaGps' && (
          <div className="flex flex-col gap-8">
            {!mediaGpsData ? (
              <div className="text-center py-16 text-slate-400 font-medium text-sm">Sem GPS para esta semana. Carregue um CSV na página inicial.</div>
            ) : (
              <>
                {/* CABEÇALHO DA SEÇÃO */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Médias da semana</p>
                    <h2 className="text-xl font-black text-black uppercase leading-none">Grupo + Por Posição</h2>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">Atletas na Média</p>
                    <p className="text-2xl font-black text-amber-700">{mediaGpsData.n}</p>
                    {mediaGpsData.nExcluded > 0 && (
                      <p className="text-[9px] text-amber-500 font-bold">{mediaGpsData.nExcluded} excluído(s)</p>
                    )}
                  </div>
                </div>

                {/* GRID DE GRÁFICOS — um por métrica */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {mediaGpsData.chartData.map(metric => {
                    const fmt = v => v == null ? '—' : metric.decimals === 1 ? v.toFixed(1) : v.toFixed(0)
                    // Tooltip customizado
                    const CustomTooltip = ({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="bg-white border border-slate-200 rounded-lg p-2 text-xs shadow-lg">
                          <p className="font-black text-slate-700 mb-0.5">{label}</p>
                          <p style={{ color: metric.color }} className="font-black">
                            {fmt(payload[0]?.value)} {metric.unit}
                          </p>
                        </div>
                      )
                    }
                    return (
                      <div key={metric.key} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                        {/* Título + valor médio do grupo */}
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{metric.label}</p>
                            <p className="text-2xl font-black leading-none" style={{ color: metric.color }}>
                              {fmt(metric.teamAvg)}
                              <span className="text-xs font-bold text-slate-400 ml-1">{metric.unit}</span>
                            </p>
                            <p className="text-[9px] text-slate-400 mt-0.5 font-bold uppercase">Média da equipe</p>
                          </div>
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-black"
                            style={{ backgroundColor: metric.color }}
                          >
                            {metric.label.charAt(0)}
                          </div>
                        </div>

                        {/* Gráfico de barras: EQUIPE + posições */}
                        {metric.points.length > 1 && mediaGpsData.positions.length > 0 ? (
                          <ResponsiveContainer width="100%" height={160}>
                            <BarChart
                              data={metric.points}
                              margin={{ top: 4, right: 4, bottom: 4, left: -20 }}
                              barSize={28}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                              <XAxis
                                dataKey="label"
                                tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <YAxis
                                tick={{ fontSize: 8, fill: '#94a3b8' }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={v => metric.decimals === 1 ? v.toFixed(1) : v.toFixed(0)}
                              />
                              <RTooltip content={<CustomTooltip />} />
                              {/* Linha de referência = média do grupo */}
                              {metric.teamAvg && (
                                <ReferenceLine
                                  y={metric.teamAvg}
                                  stroke={metric.color}
                                  strokeDasharray="4 2"
                                  strokeWidth={1.5}
                                  label={{ value: 'Equipe', position: 'insideTopRight', fontSize: 8, fill: metric.color, fontWeight: 'bold' }}
                                />
                              )}
                              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {metric.points.map((entry, i) => (
                                  <Cell
                                    key={i}
                                    fill={entry.isTeam ? metric.color : `${metric.color}55`}
                                    stroke={entry.isTeam ? metric.color : 'none'}
                                    strokeWidth={entry.isTeam ? 2 : 0}
                                  />
                                ))}
                                <LabelList
                                  dataKey="value"
                                  position="top"
                                  style={{ fontSize: 8, fontWeight: 'bold', fill: '#64748b' }}
                                  formatter={v => v != null ? fmt(v) : ''}
                                />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          // Sem posições cadastradas: barra simples de contexto
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: '100%', backgroundColor: `${metric.color}40` }} />
                            </div>
                            <span className="text-[9px] text-slate-400 font-bold">Sem posições cadastradas</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* LEGENDA */}
                <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-500 border-t border-slate-100 pt-3">
                  <span>📊 Barra sólida = média da equipe · Barras transparentes = média por posição</span>
                  <span>— — Linha tracejada = referência da equipe</span>
                  <span>Posições com cadastro no Catapult aparecem automaticamente</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB: EVOLUÇÃO SEMANAL */}
        {activeTab === 'evolucao' && (() => {
          const metricObj = GPS_EVOLUCAO_METRICS.find(m => m.key === evolucaoMetric) || GPS_EVOLUCAO_METRICS[0]
          const fmt = v => v == null ? '—' : metricObj.decimals === 1 ? v.toFixed(1) : v.toFixed(0)
          const hasData = evolucaoChartData.some(d => d.value != null)

          // Média geral do período
          const validVals = evolucaoChartData.map(d => d.value).filter(v => v != null)
          const periodAvg = validVals.length ? validVals.reduce((a,b)=>a+b,0)/validVals.length : null

          // Tooltip customizado
          const EvolTooltip = ({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const val = payload[0]?.value
            return (
              <div className="bg-white border border-slate-200 rounded-xl p-3 text-xs shadow-xl">
                <p className="font-black text-slate-700 mb-1">Semana {label}</p>
                <p className="font-black" style={{ color: metricObj.color }}>
                  {val != null ? fmt(val) : '—'} {metricObj.unit}
                </p>
                {payload[0]?.payload?.sessions > 0 && (
                  <p className="text-slate-400 text-[10px] mt-0.5">{payload[0].payload.sessions} sessão(ões) GPS</p>
                )}
              </div>
            )
          }

          return (
            <div className="flex flex-col gap-6">

              {/* CONTROLES */}
              <div className="flex flex-wrap items-center gap-3">

                {/* Seletor de métrica */}
                <div className="flex flex-wrap gap-1">
                  {GPS_EVOLUCAO_METRICS.map(m => (
                    <button
                      key={m.key}
                      onClick={() => setEvolucaoMetric(m.key)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                        evolucaoMetric === m.key
                          ? 'text-white shadow-md'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                      style={evolucaoMetric === m.key ? { backgroundColor: m.color } : {}}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  {/* Seletor de semanas */}
                  <div className="flex gap-1">
                    {[4, 8, 12].map(w => (
                      <button
                        key={w}
                        onClick={() => setEvolucaoWeeks(w)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${
                          evolucaoWeeks === w ? 'bg-black text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {w}sem
                      </button>
                    ))}
                  </div>

                  {/* Seletor de atleta */}
                  <select
                    value={evolucaoAtleta}
                    onChange={e => setEvolucaoAtleta(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-black bg-white text-slate-700 focus:border-amber-400 focus:outline-none"
                  >
                    <option value="">📊 Média do Grupo</option>
                    {atletasComHistorico.map(a => (
                      <option key={a} value={a}>{a.split(' ').slice(0,2).join(' ')}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* KPIs do período */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Média do Período</p>
                  <p className="text-2xl font-black" style={{ color: metricObj.color }}>
                    {periodAvg != null ? fmt(periodAvg) : '—'}
                    <span className="text-xs font-bold text-slate-400 ml-1">{metricObj.unit}</span>
                  </p>
                  <p className="text-[9px] text-slate-400 font-bold">{evolucaoWeeks} semanas</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Melhor Semana</p>
                  {(() => {
                    const best = evolucaoChartData.reduce((b, d) => (d.value != null && (b == null || d.value > b.value)) ? d : b, null)
                    return best ? (
                      <>
                        <p className="text-2xl font-black text-green-600">{fmt(best.value)}<span className="text-xs font-bold text-slate-400 ml-1">{metricObj.unit}</span></p>
                        <p className="text-[9px] text-slate-400 font-bold">Semana de {best.label}</p>
                      </>
                    ) : <p className="text-2xl font-black text-slate-300">—</p>
                  })()}
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Tendência (últimas 4 sem.)</p>
                  {(() => {
                    const last4 = evolucaoChartData.slice(-4).filter(d => d.value != null)
                    if (last4.length < 2) return <p className="text-2xl font-black text-slate-300">—</p>
                    const first2avg = last4.slice(0, 2).reduce((s,d)=>s+d.value,0)/2
                    const last2avg = last4.slice(-2).reduce((s,d)=>s+d.value,0)/2
                    const delta = last2avg - first2avg
                    const pct = first2avg > 0 ? (delta / first2avg) * 100 : 0
                    const isUp = delta >= 0
                    return (
                      <>
                        <p className={`text-2xl font-black ${isUp ? 'text-green-600' : 'text-red-500'}`}>
                          {isUp ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}%
                        </p>
                        <p className="text-[9px] text-slate-400 font-bold">{isUp ? 'Alta' : 'Queda'} vs. início do período</p>
                      </>
                    )
                  })()}
                </div>
              </div>

              {/* GRÁFICO PRINCIPAL */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      {evolucaoAtleta ? evolucaoAtleta.split(' ').slice(0,2).join(' ') : 'Média do Grupo'}
                    </p>
                    <h2 className="text-xl font-black text-black uppercase leading-none">{metricObj.label} — Semana a Semana</h2>
                  </div>
                  <div className="w-3 h-3 rounded-full mt-2" style={{ backgroundColor: metricObj.color }} />
                </div>

                {!hasData ? (
                  <div className="flex items-center justify-center h-64 text-slate-300 font-medium text-sm">
                    Sem dados GPS no período selecionado
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={evolucaoChartData} margin={{ top: 10, right: 20, bottom: 10, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 9, fontWeight: 'bold', fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                        interval={evolucaoWeeks <= 4 ? 0 : evolucaoWeeks <= 8 ? 1 : 2}
                      />
                      <YAxis
                        tick={{ fontSize: 9, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={v => metricObj.decimals === 1 ? v.toFixed(1) : v.toFixed(0)}
                        domain={['auto', 'auto']}
                      />
                      <RTooltip content={<EvolTooltip />} />
                      {periodAvg != null && (
                        <ReferenceLine
                          y={periodAvg}
                          stroke={metricObj.color}
                          strokeDasharray="5 3"
                          strokeWidth={1.5}
                          label={{ value: `Média ${fmt(periodAvg)}`, position: 'insideTopRight', fontSize: 9, fill: metricObj.color, fontWeight: 'bold' }}
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={metricObj.color}
                        strokeWidth={2.5}
                        dot={(props) => {
                          const { cx, cy, payload } = props
                          if (payload.value == null) return null
                          return <circle key={payload.label} cx={cx} cy={cy} r={4} fill={metricObj.color} stroke="white" strokeWidth={2} />
                        }}
                        activeDot={{ r: 6, fill: metricObj.color, stroke: 'white', strokeWidth: 2 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* GRADE: TODAS AS MÉTRICAS — visão de grupo */}
              {!evolucaoAtleta && (
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-3">Todas as Métricas — Média do Grupo</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {GPS_EVOLUCAO_METRICS.map(m => {
                      const vals = historicalWeeks.map(w => ({ label: w.label, value: w.groupGps[m.key] }))
                      const hasVals = vals.some(v => v.value != null)
                      const avg = (() => {
                        const v2 = vals.map(v=>v.value).filter(v=>v!=null)
                        return v2.length ? v2.reduce((a,b)=>a+b,0)/v2.length : null
                      })()
                      const fmtM = v => v == null ? '—' : m.decimals === 1 ? v.toFixed(1) : v.toFixed(0)
                      return (
                        <div
                          key={m.key}
                          className={`bg-white border rounded-xl p-3 cursor-pointer transition-all hover:shadow-md ${evolucaoMetric === m.key ? 'border-2 shadow-md' : 'border-slate-100'}`}
                          style={evolucaoMetric === m.key ? { borderColor: m.color } : {}}
                          onClick={() => setEvolucaoMetric(m.key)}
                        >
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{m.label}</p>
                          <p className="text-lg font-black" style={{ color: m.color }}>
                            {fmtM(avg)}<span className="text-[10px] font-bold text-slate-400 ml-1">{m.unit}</span>
                          </p>
                          {hasVals && (
                            <div className="mt-1.5 h-8">
                              <ResponsiveContainer width="100%" height={32}>
                                <LineChart data={vals} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                                  <Line type="monotone" dataKey="value" stroke={m.color} strokeWidth={1.5} dot={false} connectNulls={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* GRADE: visão por atleta com mini-sparklines */}
              {evolucaoAtleta && (
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-3">
                    {evolucaoAtleta.split(' ').slice(0,2).join(' ')} — Todas as Métricas
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {GPS_EVOLUCAO_METRICS.map(m => {
                      const vals = historicalWeeks.map(w => ({ label: w.label, value: w.atletaGps[evolucaoAtleta]?.[m.key] ?? null }))
                      const hasVals = vals.some(v => v.value != null)
                      const avg = (() => {
                        const v2 = vals.map(v=>v.value).filter(v=>v!=null)
                        return v2.length ? v2.reduce((a,b)=>a+b,0)/v2.length : null
                      })()
                      const fmtM = v => v == null ? '—' : m.decimals === 1 ? v.toFixed(1) : v.toFixed(0)
                      return (
                        <div
                          key={m.key}
                          className={`bg-white border rounded-xl p-3 cursor-pointer transition-all hover:shadow-md ${evolucaoMetric === m.key ? 'border-2 shadow-md' : 'border-slate-100'}`}
                          style={evolucaoMetric === m.key ? { borderColor: m.color } : {}}
                          onClick={() => setEvolucaoMetric(m.key)}
                        >
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{m.label}</p>
                          <p className="text-lg font-black" style={{ color: m.color }}>
                            {fmtM(avg)}<span className="text-[10px] font-bold text-slate-400 ml-1">{m.unit}</span>
                          </p>
                          {hasVals && (
                            <div className="mt-1.5 h-8">
                              <ResponsiveContainer width="100%" height={32}>
                                <LineChart data={vals} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                                  <Line type="monotone" dataKey="value" stroke={m.color} strokeWidth={1.5} dot={false} connectNulls={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-500 border-t border-slate-100 pt-3">
                <span>📈 Clique nas métricas para trocar o gráfico principal</span>
                <span>— — Linha tracejada = média do período selecionado</span>
                <span>Pontos ausentes = semanas sem sessão GPS registrada</span>
              </div>
            </div>
          )
        })()}

        {/* FOOTER */}
        <footer className="flex justify-between items-center border-t-2 border-slate-900 pt-3 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              ACWR = semana atual / média 3 semanas anteriores · Monotonia = média diária / desvio padrão
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-black italic tracking-tight uppercase">© Fisiologia GN</p>
        </footer>

      </div>
    </div>
  )
}
