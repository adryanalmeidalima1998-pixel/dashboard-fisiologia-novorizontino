'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useMemo, Suspense } from 'react'
import { useData, calcVmaxPct } from '../../context/DataContext'
import { AthleteAvatar } from '../../utils/athletePhotos'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ReferenceLine, Cell, LabelList, ResponsiveContainer,
} from 'recharts'

// ─── MÉTRICAS ─────────────────────────────────────────────────────────────────
const METRICS = [
  { key: 'totalDistance',    label: 'Distância Total', short: 'Dist.',   unit: 'm',     dec: 0, color: '#f59e0b' },
  { key: 'distanceRelative', label: 'm/min',           short: 'm/min',   unit: 'm/min', dec: 1, color: '#10b981' },
  { key: 'hsr',              label: 'HSR',             short: 'HSR',     unit: 'm',     dec: 0, color: '#3b82f6' },
  { key: 'sprintDistance',   label: 'Sprint',          short: 'Sprint',  unit: 'm',     dec: 0, color: '#ef4444' },
  { key: 'sprintCount',      label: 'Nº Sprints',      short: 'Sprints', unit: '',      dec: 0, color: '#8b5cf6' },
  { key: 'accDecel',         label: 'ACC + DEC',       short: 'ACC+DEC', unit: '',      dec: 0, color: '#f97316' },
  { key: 'playerLoad',       label: 'Player Load',     short: 'PL',      unit: '',      dec: 0, color: '#06b6d4' },
  { key: 'vmaxPct',          label: '% Vmax',          short: '%Vmax',   unit: '%',     dec: 0, color: '#ec4899' },
]

const PERIOD_LABELS = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }
const TYPE_LABELS   = { treino: '🏃 Treino', jogo: '⚽ Jogo' }

// ─── CUSTOM TOOLTIP ──────────────────────────────────────────────────────────
function MetricTooltip({ active, payload, label, metric }) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value
  return (
    <div className="bg-white border border-slate-200 shadow-xl rounded-xl p-3 text-xs">
      <p className="font-black text-slate-800 mb-1">{label}</p>
      <p className="font-black" style={{ color: metric.color }}>
        {val != null ? (metric.dec === 1 ? val.toFixed(1) : val.toFixed(0)) : '—'} {metric.unit}
      </p>
    </div>
  )
}

// ─── GRÁFICO DE BARRA POR MÉTRICA ─────────────────────────────────────────────
function MetricBarChart({ data, metric, avg, onAthleteClick }) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-48 text-slate-300 text-sm">Sem dados</div>
  )
  const fmt = v => v == null ? '' : metric.dec === 1 ? v.toFixed(1) : v.toFixed(0)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 20, right: 8, bottom: 30, left: -10 }} barSize={20}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="shortName"
          tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
          interval={0}
          angle={-35}
          textAnchor="end"
        />
        <YAxis
          tick={{ fontSize: 8, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => metric.dec === 1 ? v.toFixed(1) : v.toFixed(0)}
        />
        <RTooltip content={<MetricTooltip metric={metric} />} />
        {avg != null && (
          <ReferenceLine
            y={avg}
            stroke={metric.color}
            strokeDasharray="4 2"
            strokeWidth={1.5}
            label={{
              value: `Ø ${fmt(avg)}`,
              position: 'insideTopRight',
              fontSize: 8,
              fill: metric.color,
              fontWeight: 'bold',
            }}
          />
        )}
        <Bar
          dataKey="value"
          radius={[3, 3, 0, 0]}
          onClick={d => onAthleteClick(d.fullName)}
          cursor="pointer"
        >
          {data.map((entry, i) => {
            const ratio = avg && avg > 0 ? entry.value / avg : 1
            const isHigh = ratio >= 1.15
            const isLow  = ratio < 0.85
            return (
              <Cell
                key={i}
                fill={isHigh ? metric.color : isLow ? '#fca5a5' : `${metric.color}80`}
              />
            )
          })}
          <LabelList
            dataKey="value"
            position="top"
            style={{ fontSize: 8, fontWeight: 'bold', fill: '#475569' }}
            formatter={fmt}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── PÁGINA ──────────────────────────────────────────────────────────────────
function SessaoContent() {
  const router = useRouter()
  const params = useSearchParams()
  const { gpsData, vmaxBaseline, playerPositions } = useData()

  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [filterPosition, setFilterPosition] = useState('')
  const [activeMetric, setActiveMetric] = useState(null) // null = todas as métricas

  // Lista de sessões ordenadas mais recentes primeiro
  const sessionOptions = useMemo(() => [...gpsData].reverse(), [gpsData])

  const activeSession = useMemo(() => {
    if (selectedSessionId) return gpsData.find(s => s.id === selectedSessionId) || null
    return sessionOptions[0] || null
  }, [gpsData, sessionOptions, selectedSessionId])

  // Posições disponíveis
  const availablePositions = useMemo(() => {
    const s = new Set(Object.values(playerPositions).filter(Boolean))
    return Array.from(s).sort()
  }, [playerPositions])

  // Rows da sessão: period=0, não-outlier
  const sessionRows = useMemo(() => {
    if (!activeSession) return []
    return activeSession.rows.filter(r => r.periodNumber === 0 && !r.isOutlier && r.playerName)
  }, [activeSession])

  // Atletas com dados, com vmaxPct calculado
  const athletes = useMemo(() => {
    return sessionRows
      .filter(r => !filterPosition || playerPositions[r.playerName] === filterPosition)
      .map(r => {
        const baseline = vmaxBaseline[r.playerName]
        return {
          ...r,
          position: playerPositions[r.playerName] || null,
          accDecel: (r.acceleration || 0) + (r.deceleration || 0),
          vmaxPct: baseline ? calcVmaxPct(r.maxVelocity, baseline) : null,
        }
      })
  }, [sessionRows, filterPosition, playerPositions, vmaxBaseline])

  // Médias do grupo
  const groupAvgs = useMemo(() => {
    if (!athletes.length) return {}
    const avgs = {}
    METRICS.forEach(m => {
      const vals = athletes.map(a => a[m.key]).filter(v => v != null && v > 0)
      avgs[m.key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    })
    return avgs
  }, [athletes])

  // Dados por métrica: sorted desc por valor
  function getChartData(metric) {
    return [...athletes]
      .filter(a => a[metric.key] != null)
      .sort((a, b) => (b[metric.key] || 0) - (a[metric.key] || 0))
      .map(a => ({
        shortName: (a.playerName || '').split(' ').slice(0, 2).map((w, i) => i === 0 ? w.charAt(0) + '.' : w).join(' '),
        fullName: a.playerName,
        value: metric.dec === 1
          ? parseFloat((a[metric.key] || 0).toFixed(1))
          : Math.round(a[metric.key] || 0),
        position: a.position,
      }))
  }

  // Métricas a mostrar
  const metricsToShow = activeMetric ? METRICS.filter(m => m.key === activeMetric) : METRICS

  // Info da sessão ativa
  const sessionMeta = activeSession?.metadata || {}
  const sessionType = sessionMeta.sessionType || sessionMeta.type
  const sessionPeriod = sessionMeta.sessionPeriod || sessionMeta.period

  // KPIs rápidos da sessão
  const kpis = useMemo(() => {
    if (!athletes.length) return null
    const avg = key => { const v = athletes.map(a => a[key]).filter(v => v > 0); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null }
    return {
      n: athletes.length,
      avgDist: avg('totalDistance'),
      avgMmin: avg('distanceRelative'),
      avgHsr: avg('hsr'),
      avgSprint: avg('sprintDistance'),
      topDist: [...athletes].sort((a,b) => (b.totalDistance||0) - (a.totalDistance||0))[0],
      topHsr:  [...athletes].sort((a,b) => (b.hsr||0) - (a.hsr||0))[0],
      above90vmax: athletes.filter(a => a.vmaxPct && a.vmaxPct >= 90).length,
    }
  }, [athletes])

  return (
    <div className="min-h-screen bg-white text-black p-4 font-sans">
      <div className="max-w-[1600px] mx-auto flex flex-col gap-5">

        {/* HEADER */}
        <header className="flex flex-wrap justify-between items-center border-b-4 border-amber-500 pb-3 gap-3">
          <div className="flex items-center gap-4">
            <img src="/club/escudonovorizontino.png" alt="Escudo" className="h-14 w-auto" />
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-black uppercase leading-none">Sessão GPS</h1>
              <p className="text-sm font-bold tracking-widest text-slate-500 uppercase">Métricas da Sessão em Gráfico</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => router.push('/fisiologia')} className="bg-slate-200 text-slate-800 px-3 py-1.5 rounded-md text-xs font-black hover:bg-slate-300 transition-colors">
              ← VOLTAR
            </button>
          </div>
        </header>

        {/* CONTROLES */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Seletor de sessão */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sessão:</span>
            <select
              value={selectedSessionId || ''}
              onChange={e => setSelectedSessionId(e.target.value ? Number(e.target.value) : null)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-black bg-white text-slate-700 focus:border-amber-400 focus:outline-none min-w-[280px]"
            >
              {sessionOptions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.date} · {s.name}
                </option>
              ))}
              {sessionOptions.length === 0 && <option value="">Nenhuma sessão</option>}
            </select>
          </div>

          {/* Filtro posição */}
          {availablePositions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Posição:</span>
              <select
                value={filterPosition}
                onChange={e => setFilterPosition(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-black bg-white text-slate-700 focus:border-amber-400 focus:outline-none"
              >
                <option value="">Todas</option>
                {availablePositions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* BADGES SESSÃO */}
        {activeSession && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
              📅 {activeSession.date}
            </span>
            {sessionType && (
              <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                {TYPE_LABELS[sessionType] || sessionType}
              </span>
            )}
            {sessionPeriod && (
              <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                {PERIOD_LABELS[sessionPeriod] || sessionPeriod}
              </span>
            )}
            {sessionMeta.opponent && (
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                vs {sessionMeta.opponent}
              </span>
            )}
          </div>
        )}

        {/* SEM DADOS */}
        {!activeSession && (
          <div className="text-center py-20 text-slate-300">
            <p className="text-5xl mb-3">📭</p>
            <p className="text-lg font-black uppercase">Nenhuma sessão GPS disponível</p>
            <p className="text-sm font-medium mt-1">Carregue um CSV na página inicial.</p>
          </div>
        )}

        {/* KPIs RÁPIDOS */}
        {kpis && (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
            {[
              { label: 'Atletas', value: kpis.n, unit: '', color: 'text-black' },
              { label: 'Dist. Média', value: kpis.avgDist?.toFixed(0), unit: 'm', color: 'text-amber-600' },
              { label: 'm/min Médio', value: kpis.avgMmin?.toFixed(1), unit: '', color: 'text-emerald-600' },
              { label: 'HSR Médio', value: kpis.avgHsr?.toFixed(0), unit: 'm', color: 'text-blue-600' },
              { label: 'Sprint Médio', value: kpis.avgSprint?.toFixed(0), unit: 'm', color: 'text-red-600' },
              { label: '≥90% Vmax', value: kpis.above90vmax, unit: ' atl.', color: 'text-pink-600' },
              { label: 'Top Dist.', value: kpis.topDist?.playerName?.split(' ').slice(0,2).join(' '), unit: '', color: 'text-slate-700', small: true },
            ].map((k, i) => (
              <div key={i} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{k.label}</p>
                <p className={`${k.small ? 'text-sm' : 'text-xl'} font-black leading-none ${k.color}`}>
                  {k.value ?? '—'}<span className="text-xs text-slate-400 ml-0.5">{k.unit}</span>
                </p>
              </div>
            ))}
          </div>
        )}

        {/* FILTRO DE MÉTRICA */}
        {athletes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveMetric(null)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all border ${
                activeMetric === null
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
              }`}
            >
              Todas
            </button>
            {METRICS.map(m => (
              <button
                key={m.key}
                onClick={() => setActiveMetric(m.key === activeMetric ? null : m.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all border ${
                  activeMetric === m.key
                    ? 'text-white border-transparent'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
                style={activeMetric === m.key ? { backgroundColor: m.color, borderColor: m.color } : {}}
              >
                {m.short}
              </button>
            ))}
          </div>
        )}

        {/* GRÁFICOS */}
        {athletes.length > 0 && (
          <div className={`grid gap-5 ${metricsToShow.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'}`}>
            {metricsToShow.map(metric => {
              const chartData = getChartData(metric)
              const avg = groupAvgs[metric.key]
              const maxVal = chartData[0]?.value
              return (
                <div key={metric.key} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                  {/* Header do card */}
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{metric.label}</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-xl font-black leading-none" style={{ color: metric.color }}>
                          {avg != null ? (metric.dec === 1 ? avg.toFixed(1) : avg.toFixed(0)) : '—'}
                        </p>
                        <span className="text-xs text-slate-400 font-bold">{metric.unit} média</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Máx</p>
                      <p className="text-sm font-black text-slate-700">
                        {maxVal != null ? (metric.dec === 1 ? maxVal.toFixed(1) : maxVal) : '—'}
                        <span className="text-[9px] text-slate-400 ml-0.5">{metric.unit}</span>
                      </p>
                    </div>
                  </div>
                  {/* Gráfico */}
                  <MetricBarChart
                    data={chartData}
                    metric={metric}
                    avg={avg}
                    onAthleteClick={name => router.push(`/fisiologia/individual?atleta=${encodeURIComponent(name)}`)}
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* LEGENDA */}
        {athletes.length > 0 && (
          <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-500 border-t border-slate-100 pt-3">
            <span style={{ color: '#f59e0b' }}>■ Cor sólida = &gt;15% acima da média</span>
            <span className="text-red-300">■ Vermelho claro = &gt;15% abaixo da média</span>
            <span>— — Linha = média do grupo</span>
            <span>Clique em qualquer atleta nos cards de rank para ver o perfil individual</span>
          </div>
        )}

        {/* TABELA COMPARATIVA COMPLETA */}
        {athletes.length > 0 && (
          <div className="border border-slate-100 rounded-2xl p-4">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Comparativo Completo — Todos os atletas</p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-900">
                    <th className="text-left py-2 px-3 font-black uppercase tracking-widest text-[9px] text-slate-500">Atleta</th>
                    <th className="text-center py-2 px-2 font-black uppercase tracking-widest text-[9px] text-slate-500">Pos.</th>
                    {METRICS.map(m => (
                      <th key={m.key} className="text-center py-2 px-2 font-black uppercase tracking-widest text-[9px] whitespace-nowrap" style={{ color: m.color }}>
                        {m.short}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...athletes].sort((a,b) => (b.totalDistance||0) - (a.totalDistance||0)).map((a, i) => (
                    <tr
                      key={a.playerName}
                      className={`border-b border-slate-100 cursor-pointer hover:bg-amber-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
                      onClick={() => router.push(`/fisiologia/individual?atleta=${encodeURIComponent(a.playerName)}`)}
                    >
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <AthleteAvatar name={a.playerName} size="w-6 h-6" />
                          <span className="font-bold text-black">{a.playerName.split(' ').slice(0,2).join(' ')}</span>
                        </div>
                      </td>
                      <td className="text-center py-2 px-2">
                        <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{a.position || '—'}</span>
                      </td>
                      {METRICS.map(m => {
                        const val = a[m.key]
                        const avg = groupAvgs[m.key]
                        const ratio = avg && val ? val / avg : 1
                        const cls = ratio >= 1.15 ? 'bg-green-100 text-green-800' : ratio < 0.85 ? 'bg-red-50 text-red-700' : 'text-slate-700'
                        return (
                          <td key={m.key} className={`text-center py-2 px-2 font-black text-[10px] rounded ${cls}`}>
                            {val != null ? (m.dec === 1 ? val.toFixed(1) : Math.round(val)) : '—'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-300 bg-amber-50">
                  <tr>
                    <td className="py-2 px-3 font-black text-[10px] uppercase text-amber-700" colSpan={2}>Média Grupo</td>
                    {METRICS.map(m => (
                      <td key={m.key} className="text-center py-2 px-2 font-black text-[10px] text-amber-700">
                        {groupAvgs[m.key] != null ? (m.dec === 1 ? groupAvgs[m.key].toFixed(1) : Math.round(groupAvgs[m.key])) : '—'}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <footer className="flex justify-between items-center border-t-2 border-slate-900 pt-3 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              Todos os atletas do período 0 (sessão completa) · Outliers GPS removidos automaticamente
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-black italic tracking-tight uppercase">© Fisiologia GN</p>
        </footer>

      </div>
    </div>
  )
}

export default function SessaoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center text-slate-400 font-black">Carregando...</div>}>
      <SessaoContent />
    </Suspense>
  )
}
