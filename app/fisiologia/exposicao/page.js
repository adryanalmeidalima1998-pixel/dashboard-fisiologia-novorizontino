'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo } from 'react'
import { useData, calcVmaxPct } from '../../context/DataContext'

function daysBetween(dateStr1, dateStr2) {
  const d1 = typeof dateStr1 === 'string' ? new Date(dateStr1.split('/').reverse().join('-')) : dateStr1
  const d2 = typeof dateStr2 === 'string' ? new Date(dateStr2.split('/').reverse().join('-')) : dateStr2
  return Math.round(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24))
}

function daysAgo(dateStr) {
  const d = new Date(dateStr.includes('/') ? dateStr.split('/').reverse().join('-') : dateStr)
  return Math.round((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
}

function urgencyColor(days) {
  if (days === null || days === undefined) return 'bg-slate-100 text-slate-400'
  if (days <= 5) return 'bg-green-100 text-green-700'
  if (days <= 10) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

function urgencyDot(days) {
  if (days === null || days === undefined) return 'bg-slate-300'
  if (days <= 5) return 'bg-green-500'
  if (days <= 10) return 'bg-amber-500'
  return 'bg-red-500'
}

function SortTh({ label, col, sort, onSort }) {
  const active = sort.col === col
  return (
    <th className="py-2 px-2 font-black uppercase tracking-widest text-[10px] text-slate-500 cursor-pointer hover:text-amber-600 select-none whitespace-nowrap text-left"
      onClick={() => onSort(col)}>
      {label}<span className="text-[8px] ml-0.5 opacity-60">{active ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ' ↕'}</span>
    </th>
  )
}

export default function ExposicaoDashboard() {
  const router = useRouter()
  const { gpsData, bemEstarData, vmaxBaseline } = useData()
  const [sortMain, setSortMain] = useState({ col: 'diasSemVmax90', dir: 'desc' })
  const [filterRisco, setFilterRisco] = useState(false)

  function toggleSort(current, col, setter) {
    setter(current.col === col ? { col, dir: current.dir === 'desc' ? 'asc' : 'desc' } : { col, dir: 'desc' })
  }

  // Todos os atletas
  const allAthletes = useMemo(() => {
    const names = new Set([
      ...bemEstarData.map(r => r.playerName),
      ...gpsData.flatMap(s => s.rows.filter(r => !r.isOutlier).map(r => r.playerName))
    ])
    return Array.from(names).sort()
  }, [bemEstarData, gpsData])

  // Todas as linhas GPS de sessão completa (period=0)
  const allSessionRows = useMemo(() => {
    return gpsData.flatMap(session =>
      session.rows
        .filter(r => r.periodNumber === 0 && !r.isOutlier)
        .map(r => ({ ...r, _sessionName: session.name, _sessionDate: session.date }))
    )
  }, [gpsData])

  // Por atleta: exposições
  const exposureData = useMemo(() => {
    const today = new Date()

    return allAthletes.map(athlete => {
      const rows = allSessionRows
        .filter(r => r.playerName === athlete)
        .sort((a, b) => {
          const da = new Date(a.sessionDate?.split('/').reverse().join('-') || '2000-01-01')
          const db = new Date(b.sessionDate?.split('/').reverse().join('-') || '2000-01-01')
          return db - da // mais recente primeiro
        })

      if (!rows.length) return { athlete, rows: [], noData: true }

      const vmaxMax = vmaxBaseline[athlete] || null

      // Última exposição a ≥90% Vmax
      const last90 = rows.find(r => {
        if (!vmaxMax || !r.maxVelocity) return false
        return calcVmaxPct(r.maxVelocity, vmaxMax) >= 90
      })

      // Última exposição a sprint (>21 km/h típico)
      const lastSprint = rows.find(r => (r.sprintDistance || 0) > 0 || (r.sprintCount || 0) > 0)

      // Última sessão com HSR alto (> 80th percentil do atleta)
      const hsrValues = rows.map(r => r.hsr || 0)
      const hsrP80 = hsrValues.length ? hsrValues.sort((a, b) => a - b)[Math.floor(hsrValues.length * 0.8)] : 0
      const lastHighHsr = rows.find(r => (r.hsr || 0) >= hsrP80 && hsrP80 > 0)

      // Cálculo de dias
      const diasSemVmax90 = last90?.sessionDate ? daysAgo(last90.sessionDate) : null
      const diasSemSprint = lastSprint?.sessionDate ? daysAgo(lastSprint.sessionDate) : null
      const diasSemHsrAlto = lastHighHsr?.sessionDate ? daysAgo(lastHighHsr.sessionDate) : null

      // Últimas 4 semanas: acumulado de sprints e HSR
      const fourWeeksAgo = new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000)
      const recentRows = rows.filter(r => {
        const d = new Date(r.sessionDate?.split('/').reverse().join('-') || '2000-01-01')
        return d >= fourWeeksAgo
      })
      const totalSprints4w = recentRows.reduce((s, r) => s + (r.sprintCount || 0), 0)
      const totalSprintDist4w = recentRows.reduce((s, r) => s + (r.sprintDistance || 0), 0)
      const totalHsr4w = recentRows.reduce((s, r) => s + (r.hsr || 0), 0)

      // Último % Vmax
      const lastRow = rows[0]
      const lastVmaxPct = lastRow && vmaxMax ? calcVmaxPct(lastRow.maxVelocity, vmaxMax) : null

      // Risco destreino velocidade: sem exposição ≥90% Vmax há >10 dias
      const riscoDestreino = diasSemVmax90 === null || diasSemVmax90 > 10

      return {
        athlete,
        vmaxMax,
        lastVmaxPct,
        diasSemVmax90,
        diasSemSprint,
        diasSemHsrAlto,
        totalSprints4w,
        totalSprintDist4w,
        totalHsr4w,
        riscoDestreino,
        lastSessionDate: lastRow?.sessionDate || null,
        noData: false,
      }
    })
  }, [allAthletes, allSessionRows, vmaxBaseline])

  // Ordenação
  const sortedData = useMemo(() => {
    let list = [...exposureData]
    if (filterRisco) list = list.filter(d => d.riscoDestreino)
    const { col, dir } = sortMain
    list.sort((a, b) => {
      if (col === 'athlete') return dir === 'asc' ? a.athlete.localeCompare(b.athlete) : b.athlete.localeCompare(a.athlete)
      const va = a[col] ?? (dir === 'desc' ? -Infinity : Infinity)
      const vb = b[col] ?? (dir === 'desc' ? -Infinity : Infinity)
      return dir === 'desc' ? vb - va : va - vb
    })
    return list
  }, [exposureData, sortMain, filterRisco])

  const riscoCount = exposureData.filter(d => d.riscoDestreino && !d.noData).length
  const semDados = exposureData.filter(d => d.noData).length

  return (
    <div className="min-h-screen bg-white text-black p-4 font-sans">
      <div className="max-w-[1500px] mx-auto flex flex-col gap-5">

        {/* HEADER */}
        <header className="flex flex-wrap justify-between items-center border-b-4 border-amber-500 pb-3 gap-3">
          <div className="flex items-center gap-4">
            <img src="/club/escudonovorizontino.png" alt="Escudo" className="h-14 w-auto" />
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-black uppercase leading-none">Dashboard de Exposição</h1>
              <p className="text-sm font-bold tracking-widest text-slate-600 uppercase">Velocidade · Sprint · HSR · Risco de Destreino</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/fisiologia')} className="bg-slate-200 text-slate-800 px-3 py-1 rounded-md text-xs font-bold hover:bg-slate-300 transition-colors">← VOLTAR</button>
          </div>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className={`border-2 rounded-xl p-3 ${riscoCount > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Risco Destreino Vel.</p>
            <p className={`text-2xl font-black ${riscoCount > 0 ? 'text-red-600' : 'text-green-600'}`}>{riscoCount}</p>
            <p className="text-[10px] text-slate-500">&gt;10 dias sem ≥90% Vmax</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Com GPS</p>
            <p className="text-2xl font-black text-black">{exposureData.filter(d => !d.noData).length}</p>
            <p className="text-[10px] text-slate-500">de {allAthletes.length} atletas</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Sessões GPS</p>
            <p className="text-2xl font-black text-black">{gpsData.length}</p>
            <p className="text-[10px] text-slate-500">carregadas no banco</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Sem GPS</p>
            <p className="text-2xl font-black text-slate-400">{semDados}</p>
            <p className="text-[10px] text-slate-500">atletas sem dados</p>
          </div>
        </div>

        {/* ALERTAS DE RISCO */}
        {riscoCount > 0 && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
            <p className="text-xs font-black uppercase tracking-widest text-red-600 mb-3">⚠ Atletas com risco de destreino de velocidade</p>
            <div className="flex flex-wrap gap-2">
              {exposureData.filter(d => d.riscoDestreino && !d.noData).map(d => (
                <div key={d.athlete} className="bg-white border border-red-200 rounded-lg px-3 py-2 flex items-center gap-3">
                  <div>
                    <p className="text-xs font-black text-black">{d.athlete}</p>
                    <p className="text-[9px] text-red-600 font-bold">
                      {d.diasSemVmax90 !== null ? `${d.diasSemVmax90} dias sem ≥90% Vmax` : 'Nunca alcançou ≥90% Vmax'}
                    </p>
                  </div>
                  <div className="bg-red-100 text-red-700 text-[9px] font-black px-2 py-1 rounded-lg uppercase">
                    {d.diasSemVmax90 !== null ? `${d.diasSemVmax90}d` : '—'}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-red-500 font-bold mt-3">
              → Recomendação: inserir 2–4 exposições curtas de alta velocidade na próxima sessão (ex.: sprints curtos controlados)
            </p>
          </div>
        )}

        {/* FILTROS */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Filtrar:</span>
          <button
            onClick={() => setFilterRisco(!filterRisco)}
            className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${filterRisco ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {filterRisco ? '✓ ' : ''}Só em risco
          </button>
        </div>

        {/* TABELA PRINCIPAL */}
        <div className="border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">
            Exposição por Atleta — Últimas exposições e acumulados (4 semanas)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-slate-900">
                  <SortTh label="Atleta" col="athlete" sort={sortMain} onSort={c => toggleSort(sortMain, c, setSortMain)} />
                  <SortTh label="Vmax Ref." col="vmaxMax" sort={sortMain} onSort={c => toggleSort(sortMain, c, setSortMain)} />
                  <SortTh label="Últ. %Vmax" col="lastVmaxPct" sort={sortMain} onSort={c => toggleSort(sortMain, c, setSortMain)} />
                  <SortTh label="Dias s/ ≥90% Vmax" col="diasSemVmax90" sort={sortMain} onSort={c => toggleSort(sortMain, c, setSortMain)} />
                  <SortTh label="Dias s/ Sprint" col="diasSemSprint" sort={sortMain} onSort={c => toggleSort(sortMain, c, setSortMain)} />
                  <SortTh label="Dias s/ HSR alto" col="diasSemHsrAlto" sort={sortMain} onSort={c => toggleSort(sortMain, c, setSortMain)} />
                  <SortTh label="Sprints 4sem" col="totalSprints4w" sort={sortMain} onSort={c => toggleSort(sortMain, c, setSortMain)} />
                  <SortTh label="Dist. Sprint 4sem" col="totalSprintDist4w" sort={sortMain} onSort={c => toggleSort(sortMain, c, setSortMain)} />
                  <SortTh label="HSR 4sem (m)" col="totalHsr4w" sort={sortMain} onSort={c => toggleSort(sortMain, c, setSortMain)} />
                  <th className="text-left py-2 px-2 font-black uppercase tracking-widest text-[10px] text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((d, i) => {
                  if (d.noData) return (
                    <tr key={d.athlete} className="border-b border-slate-100 opacity-40">
                      <td className="py-2 pr-3 font-bold text-slate-500">{d.athlete}</td>
                      <td colSpan={9} className="py-2 pr-3 text-slate-400 italic text-[10px]">Sem GPS carregado</td>
                    </tr>
                  )
                  return (
                    <tr key={d.athlete} className={`border-b border-slate-100 hover:bg-amber-50 ${d.riscoDestreino ? 'bg-red-50/40' : ''}`}>
                      <td className="py-2 pr-3 font-black text-black">{d.athlete}</td>
                      <td className="py-2 pr-3 font-bold text-amber-700">{d.vmaxMax ? `${d.vmaxMax.toFixed(1)} km/h` : '—'}</td>
                      <td className={`py-2 pr-3 font-black ${d.lastVmaxPct >= 90 ? 'text-green-600' : d.lastVmaxPct >= 80 ? 'text-amber-600' : 'text-slate-500'}`}>
                        {d.lastVmaxPct ? `${d.lastVmaxPct}%` : '—'}
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${urgencyColor(d.diasSemVmax90)}`}>
                          {d.diasSemVmax90 !== null ? `${d.diasSemVmax90}d` : 'Nunca'}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${urgencyColor(d.diasSemSprint)}`}>
                          {d.diasSemSprint !== null ? `${d.diasSemSprint}d` : '—'}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${urgencyColor(d.diasSemHsrAlto)}`}>
                          {d.diasSemHsrAlto !== null ? `${d.diasSemHsrAlto}d` : '—'}
                        </span>
                      </td>
                      <td className="py-2 pr-3 font-bold">{d.totalSprints4w || '—'}</td>
                      <td className="py-2 pr-3 font-bold">{d.totalSprintDist4w ? `${d.totalSprintDist4w.toFixed(0)} m` : '—'}</td>
                      <td className="py-2 pr-3 font-bold">{d.totalHsr4w ? `${d.totalHsr4w.toFixed(0)} m` : '—'}</td>
                      <td className="py-2 pr-3">
                        {d.riscoDestreino
                          ? <span className="text-[9px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-black uppercase">⚠ Risco</span>
                          : <span className="text-[9px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-black uppercase">✓ OK</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* LEGENDA */}
        <div className="border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Guia de Interpretação</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <p className="font-black text-black mb-2">Dias desde última exposição</p>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500 shrink-0" /><span className="text-slate-600">≤ 5 dias — Exposição recente, adequada</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" /><span className="text-slate-600">6–10 dias — Atenção, janela se fechando</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 shrink-0" /><span className="text-slate-600">&gt; 10 dias — Risco de destreino de velocidade</span></div>
              </div>
            </div>
            <div>
              <p className="font-black text-black mb-2">% Vmax (últ. sessão)</p>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2"><span className="font-black text-green-600">≥ 90%</span><span className="text-slate-600">— Exposição de alta velocidade atingida</span></div>
                <div className="flex items-center gap-2"><span className="font-black text-amber-600">80–89%</span><span className="text-slate-600">— Zona submáxima, considerar progressão</span></div>
                <div className="flex items-center gap-2"><span className="font-black text-slate-500">&lt; 80%</span><span className="text-slate-600">— Baixa intensidade, sem exposição adequada</span></div>
              </div>
            </div>
            <div>
              <p className="font-black text-black mb-2">Recomendações práticas</p>
              <ul className="flex flex-col gap-1 text-slate-600">
                <li>• Atleta &gt;10d sem ≥90% Vmax → 2–4 sprints curtos de 15–30m</li>
                <li>• HSR alto P80 = percentil 80 do histórico do atleta</li>
                <li>• Acumulados 4 semanas para gestão de carga progressiva</li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
