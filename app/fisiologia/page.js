'use client'

import { useRouter } from 'next/navigation'
import { useData, suggestNameMatches, normalizeName } from '../context/DataContext'
import { useEffect, useState, useMemo } from 'react'

const PERIOD_LABELS = { manha: '🌅 Manhã', tarde: '☀️ Tarde', noite: '🌙 Noite' }
const RESULT_LABELS = { V: '✅ Vitória', E: '🟡 Empate', D: '❌ Derrota' }
const EMPTY_META = { sessionType: 'treino', sessionPeriod: 'tarde', opponent: '', result: '' }

// ── Cópia local do calcReadiness (mesma lógica do Dashboard Diário) ────────────
function calcReadiness(preData, acwr, daysSinceLastGps) {
  let score = 0
  if (preData?.wellnessScore != null) {
    score += Math.min((preData.wellnessScore / 5) * 50, 50)
  } else {
    score += 30
  }
  if (acwr != null) {
    if (acwr >= 0.8 && acwr <= 1.3) score += 30
    else if (acwr >= 0.7 && acwr < 0.8) score += 20
    else if (acwr > 1.3 && acwr <= 1.5) score += 15
    else if (acwr > 1.5) score += 0
    else score += 10
  } else {
    score += 20
  }
  if (daysSinceLastGps != null) {
    if (daysSinceLastGps === 0) score += 10
    else if (daysSinceLastGps === 1) score += 20
    else if (daysSinceLastGps === 2) score += 18
    else score += 12
  } else {
    score += 15
  }
  return Math.round(score)
}

export default function Fisiologia() {
  const router = useRouter()
  const {
    gpsData, isLoadingGps, uploadStatus, uploadQueue, uploadGpsFile, uploadMultipleGpsFiles, deleteGpsSession, bulkDeleteGpsSessions,
    bemEstarData, isLoadingBemEstar, fetchBemEstar,
    nameAliases, isLoadingAliases, addNameAlias, removeNameAlias,
  } = useData()
  const [dragOver, setDragOver] = useState(false)
  const [showCsvManager, setShowCsvManager] = useState(false)
  const [showAliasManager, setShowAliasManager] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [aliasLoading, setAliasLoading] = useState(new Set())
  const [aliasError, setAliasError] = useState(null)
  const [manualGps, setManualGps] = useState('')
  const [manualBem, setManualBem] = useState('')
  // pendingFiles: array de { file, name, meta: { sessionType, sessionPeriod, opponent, result } }
  const [pendingFiles, setPendingFiles] = useState([])
  const [editingIdx, setEditingIdx] = useState(null)

  useEffect(() => {
    if (bemEstarData.length === 0) fetchBemEstar()
  }, [])

  // Nomes únicos GPS vs bem-estar para detectar divergências
  const gpsNames = useMemo(() => {
    const names = new Set()
    for (const s of gpsData) for (const r of s.rows) if (r.playerName) names.add(r.playerName)
    return Array.from(names).sort()
  }, [gpsData])

  const bemNames = useMemo(() => {
    return [...new Set(bemEstarData.map(r => r.playerName).filter(Boolean))].sort()
  }, [bemEstarData])

  // Nomes GPS que não têm correspondência exata no bem-estar (potencialmente duplicados)
  const unmatchedGpsNames = useMemo(() => {
    const bemNormed = new Set(bemNames.map(n => normalizeName(n)))
    const aliasedGps = new Set(nameAliases.map(a => a.gps_name))
    return gpsNames.filter(n => !bemNormed.has(normalizeName(n)) && !aliasedGps.has(n))
  }, [gpsNames, bemNames, nameAliases])

  // Sugestões automáticas de matches
  const suggestions = useMemo(() => {
    if (!gpsNames.length || !bemNames.length) return []
    return suggestNameMatches(gpsNames, bemNames, nameAliases)
  }, [gpsNames, bemNames, nameAliases])

  // ── PRONTIDÃO DA EQUIPE HOJE ──────────────────────────────────────────────────
  // Calcula score de prontidão para cada atleta com bem-estar de hoje
  const teamReadiness = useMemo(() => {
    if (!bemEstarData.length) return null
    const todayStr = new Date().toISOString().split('T')[0]
    const todayPre = {}
    for (const r of bemEstarData) {
      if (r.date === todayStr && r.type === 'pre') todayPre[r.playerName] = r
    }
    if (Object.keys(todayPre).length === 0) return null

    const scores = Object.entries(todayPre).map(([name, preData]) => {
      // ACWR simples: carga semana atual / média 3 semanas anteriores
      const today = new Date()
      const dow = today.getDay() === 0 ? 6 : today.getDay() - 1
      const monday = new Date(today); monday.setDate(today.getDate() - dow); monday.setHours(0,0,0,0)
      const curLoad = bemEstarData.filter(r => r.playerName === name && r.type === 'post' && r.srpeLoad && new Date(r.date + 'T12:00:00') >= monday).reduce((s,r) => s + r.srpeLoad, 0)
      const prevLoads = [1,2,3].map(w => {
        const pm = new Date(monday); pm.setDate(monday.getDate() - w * 7)
        const ps = new Date(pm); ps.setDate(pm.getDate() + 6); ps.setHours(23,59,59,999)
        return bemEstarData.filter(r => r.playerName === name && r.type === 'post' && r.srpeLoad && new Date(r.date+'T12:00:00') >= pm && new Date(r.date+'T12:00:00') <= ps).reduce((s,r) => s+r.srpeLoad,0)
      })
      const prevAvg = prevLoads.reduce((a,b) => a+b,0) / 3
      const acwr = prevAvg > 0 ? curLoad / prevAvg : null

      // Dias desde último GPS
      const lastGpsDates = gpsData.flatMap(s => s.rows.filter(r => r.playerName === name && r.periodNumber === 0 && !r.isOutlier).map(() => s.date)).sort().reverse()
      const lastGps = lastGpsDates[0]
      let daysSince = null
      if (lastGps) {
        const d = lastGps.includes('/') ? new Date(lastGps.split('/').reverse().join('-')+'T12:00:00') : new Date(lastGps+'T12:00:00')
        daysSince = Math.round((Date.now() - d.getTime()) / (1000*60*60*24))
      }

      return { name, score: calcReadiness(preData, acwr, daysSince) }
    })

    const avg = Math.round(scores.reduce((s, a) => s + a.score, 0) / scores.length)
    const green  = scores.filter(a => a.score >= 75).length
    const yellow = scores.filter(a => a.score >= 50 && a.score < 75).length
    const red    = scores.filter(a => a.score < 50).length
    return { avg, green, yellow, red, total: scores.length }
  }, [bemEstarData, gpsData])

  function handleFilesSelect(files) {
    if (!files || files.length === 0) return
    const validFiles = Array.from(files).filter(f => f.name.endsWith('.csv'))
    if (validFiles.length === 0) return
    setPendingFiles(validFiles.map(f => ({
      file: f,
      name: f.name.replace(/\.csv$/i, ''),
      meta: { ...EMPTY_META },
    })))
    setEditingIdx(null)
  }

  async function confirmUpload() {
    if (pendingFiles.length === 0) return
    if (pendingFiles.length === 1) {
      const p = pendingFiles[0]
      await uploadGpsFile(p.file, p.name, p.meta)
    } else {
      await uploadMultipleGpsFiles(pendingFiles.map(p => ({
        file: p.file,
        name: p.name,
        metadata: p.meta,
      })))
    }
    setPendingFiles([])
    setEditingIdx(null)
  }

  function cancelUpload() {
    setPendingFiles([])
    setEditingIdx(null)
  }

  function updatePending(idx, field, value) {
    setPendingFiles(prev => prev.map((f, i) => i === idx ? { ...f, [field]: value } : f))
  }

  function updateMeta(idx, field, value) {
    setPendingFiles(prev => prev.map((f, i) => i === idx
      ? { ...f, meta: { ...f.meta, [field]: value } }
      : f
    ))
  }

  const ferramentas = [
    {
      id: 'diario',
      titulo: 'Dashboard Diário',
      descricao: 'Prontidão de hoje. Bem-estar, alertas, % Vmax e GPS da sessão mais recente por atleta.',
      rota: '/fisiologia/diario',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      )
    },
    {
      id: 'bemEstar',
      titulo: 'Bem-Estar & sRPE',
      descricao: 'Monitoramento completo de bem-estar, dor, hidratação e percepção de esforço dos atletas.',
      rota: '/fisiologia/bem-estar',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      )
    },
    {
      id: 'semanal',
      titulo: 'Microciclo Semanal',
      descricao: 'Cargas acumuladas, monotonia, strain e ACWR da semana. Visão de equipe e posição.',
      rota: '/fisiologia/semanal',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      id: 'individual',
      titulo: 'Atleta Individual',
      descricao: 'Histórico completo por atleta. Radar de métricas, dor localizada com boneco anatômico, GPS e bem-estar.',
      rota: '/fisiologia/individual',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
    {
      id: 'exposicao',
      titulo: 'Exposição à Velocidade',
      descricao: 'Última exposição a ≥90% Vmax, sprint e HSR alto. Atletas em risco de destreino de velocidade.',
      rota: '/fisiologia/exposicao',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    },
    {
      id: 'exercicios',
      titulo: 'Biblioteca de Exercícios',
      descricao: 'Catálogo de tarefas com custo GPS esperado (m/min, HSR, ACC/DEC, WCS). Sua ferramenta de prescrição.',
      rota: '/fisiologia/exercicios',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      )
    },
    {
      id: 'relatorios',
      titulo: 'Relatórios Automáticos',
      descricao: 'Pós-sessão, pós-jogo, semanal e individual. Recomendações automáticas para decisões rápidas.',
      rota: '/fisiologia/relatorios',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      id: 'destaques',
      titulo: 'Destaques da Sessão',
      descricao: 'Top 5 e Bottom 5 por métrica GPS. Filtre por sessão ou semanal completo e navegue entre todas as métricas.',
      rota: '/fisiologia/destaques',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      )
    },
    {
      id: 'sessao',
      titulo: 'Sessão GPS — Gráficos',
      descricao: 'Métricas da sessão em gráfico de barras por atleta. Visualize distância, HSR, sprint, ACC+DEC e mais por sessão.',
      rota: '/fisiologia/sessao',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      id: 'jogos',
      titulo: 'Dashboard de Jogos',
      descricao: 'Análise pós-jogo: GPS, comparação vs. treinos da semana, ≥90% Vmax e recuperação nas 48h seguintes. Histórico da temporada.',
      rota: '/fisiologia/jogos',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
  ]

  const isUploading = uploadQueue.some(q => q.status === 'uploading')

  // Badge visual de tipo/turno da sessão
  function SessionBadge({ session }) {
    const meta = session.metadata || {}
    const isJogo = meta.type === 'jogo'
    return (
      <div className="flex items-center gap-1 flex-wrap">
        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${isJogo ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
          {isJogo ? '⚽ Jogo' : '🏃 Treino'}
        </span>
        {meta.period && (
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
            {PERIOD_LABELS[meta.period] || meta.period}
          </span>
        )}
        {isJogo && meta.opponent && (
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
            vs {meta.opponent}
          </span>
        )}
        {isJogo && meta.result && (
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
            {RESULT_LABELS[meta.result] || meta.result}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-black p-4 font-sans">
      <div className="max-w-[1400px] mx-auto flex flex-col gap-6">

        {/* HEADER */}
        <header className="flex justify-between items-center border-b-4 border-amber-500 pb-3">
          <div className="flex items-center gap-4">
            <img src="/club/escudonovorizontino.png" alt="Escudo" className="h-16 w-auto" />
            <div>
              <h1 className="text-3xl font-black tracking-tighter text-black uppercase leading-none">Grêmio Novorizontino</h1>
              <p className="text-base font-bold tracking-widest text-slate-600 uppercase">Departamento de Fisiologia</p>
            </div>
          </div>
          <div className="text-right flex flex-col items-end gap-2">
            <div className="bg-amber-500 text-black px-6 py-1 font-black text-xl uppercase italic shadow-md">
              Central de Fisiologia
            </div>
            <div className="text-slate-600 font-black text-[10px] mt-1 tracking-wider uppercase">
              Performance & Monitoramento de Carga
            </div>
          </div>
        </header>

        {/* STATUS DE DADOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* BEM-ESTAR */}
          <div className="border-2 border-slate-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${bemEstarData.length > 0 ? 'bg-green-500' : isLoadingBemEstar ? 'bg-amber-500 animate-pulse' : 'bg-red-400'}`} />
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Bem-Estar & sRPE</p>
                <p className="text-sm font-bold text-black">
                  {isLoadingBemEstar ? 'Carregando...' : bemEstarData.length > 0 ? `${bemEstarData.length} registros carregados` : 'Não carregado'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push('/fisiologia/bem-estar')}
                className="bg-amber-500 hover:bg-amber-400 text-black px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all"
              >
                Ver dados
              </button>
              <button
                onClick={fetchBemEstar}
                disabled={isLoadingBemEstar}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
              >
                {isLoadingBemEstar ? '...' : '↻'}
              </button>
            </div>
          </div>

          {/* GPS */}
          <div
            className={`border-2 rounded-xl p-4 transition-all ${dragOver ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFilesSelect(e.dataTransfer.files) }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${isLoadingGps || isUploading ? 'bg-amber-500 animate-pulse' : gpsData.length > 0 ? 'bg-green-500' : 'bg-slate-300'}`} />
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">GPS Catapult</p>
                  <p className="text-sm font-bold text-black">
                    {isLoadingGps ? 'Carregando...' : gpsData.length === 0 ? 'Nenhuma sessão salva' : `${gpsData.length} sessão(ões) no banco`}
                  </p>
                </div>
              </div>
              <label className={`cursor-pointer px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isUploading ? 'bg-slate-200 text-slate-400 cursor-wait' : 'bg-amber-500 hover:bg-amber-400 text-black'}`}>
                + Upload CSV(s)
                <input
                  type="file"
                  accept=".csv"
                  multiple
                  className="hidden"
                  disabled={isUploading}
                  onChange={e => { handleFilesSelect(e.target.files); e.target.value = '' }}
                />
              </label>
              {gpsData.length > 0 && (
                <button
                  onClick={() => setShowCsvManager(true)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-slate-200"
                >
                  📂 Gerenciar
                </button>
              )}
            </div>

            {/* Fila de upload */}
            {uploadQueue.length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                {uploadQueue.map((item, i) => (
                  <div key={i} className={`flex items-center gap-2 text-xs px-2 py-1 rounded-lg font-bold ${item.status === 'success' ? 'bg-green-100 text-green-700' : item.status === 'error' ? 'bg-red-100 text-red-700' : item.status === 'uploading' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                    <span>{item.status === 'uploading' ? '⏳' : item.status === 'success' ? '✓' : item.status === 'error' ? '✕' : '○'}</span>
                    <span className="truncate max-w-[200px]">{item.file.name}</span>
                    {item.message && <span className="text-[10px] ml-auto truncate">{item.message}</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Feedback upload único */}
            {uploadStatus && uploadQueue.length === 0 && (
              <div className={`mt-2 text-xs font-bold px-2 py-1.5 rounded-lg ${uploadStatus.type === 'success' ? 'bg-green-100 text-green-700' : uploadStatus.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                {uploadStatus.message}
              </div>
            )}

            {gpsData.length === 0 && !uploadStatus && uploadQueue.length === 0 && (
              <p className="mt-2 text-[10px] text-slate-400 font-medium">Arraste um ou mais .csv ou clique em "Upload CSV(s)"</p>
            )}
          </div>
        </div>

        {/* ALERTA DE NOMES DIVERGENTES */}
        {(suggestions.length > 0 || unmatchedGpsNames.length > 0) && gpsData.length > 0 && bemEstarData.length > 0 && (
          <div className="border-2 border-amber-400 bg-amber-50 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-sm font-black text-amber-900">Nomes divergentes detectados</p>
                <p className="text-xs text-amber-700 font-medium mt-0.5">
                  {suggestions.length > 0 && `${suggestions.length} match(es) sugerido(s) automaticamente · `}
                  {unmatchedGpsNames.length > 0 && `${unmatchedGpsNames.length} nome(s) GPS sem equivalente no bem-estar`}
                  {nameAliases.length > 0 && ` · ${nameAliases.length} alias(es) ativo(s)`}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAliasManager(true)}
              className="shrink-0 bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
            >
              🔗 Resolver nomes
            </button>
          </div>
        )}

        {/* MODAL DE UPLOAD COM METADADOS */}
        {pendingFiles.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl border-2 border-slate-200 p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-base font-black uppercase tracking-tighter text-black mb-1">
                {pendingFiles.length === 1 ? 'Configurar Sessão' : `${pendingFiles.length} Sessões para Upload`}
              </h3>
              <p className="text-xs text-slate-500 font-medium mb-5">
                Defina o nome, tipo (treino ou jogo) e turno de cada sessão antes de salvar.
              </p>

              <div className="flex flex-col gap-5 mb-5">
                {pendingFiles.map((p, i) => (
                  <div key={i} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                    {/* Número + Nome */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] text-slate-400 font-black w-5 text-right shrink-0">{i + 1}.</span>
                      {editingIdx === i ? (
                        <input
                          autoFocus
                          type="text"
                          value={p.name}
                          onChange={e => updatePending(i, 'name', e.target.value)}
                          onBlur={() => setEditingIdx(null)}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingIdx(null) }}
                          className="flex-1 border-2 border-amber-400 rounded-lg px-3 py-1.5 text-xs font-bold text-black focus:outline-none bg-white"
                        />
                      ) : (
                        <button
                          onClick={() => setEditingIdx(i)}
                          className="flex-1 text-left border border-slate-200 hover:border-amber-400 rounded-lg px-3 py-1.5 text-xs font-bold text-black transition-colors bg-white"
                        >
                          {p.name}
                          <span className="ml-2 text-[9px] text-slate-400">✏</span>
                        </button>
                      )}
                      <button
                        onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-red-400 hover:text-red-600 font-black text-xs px-1 shrink-0"
                      >✕</button>
                    </div>

                    {/* Metadados em linha */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Tipo */}
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1">Tipo</label>
                        <div className="flex gap-1">
                          {['treino', 'jogo'].map(t => (
                            <button key={t} onClick={() => updateMeta(i, 'sessionType', t)}
                              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${p.meta.sessionType === t ? (t === 'jogo' ? 'bg-green-500 text-white' : 'bg-blue-500 text-white') : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                              {t === 'treino' ? '🏃 Treino' : '⚽ Jogo'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Turno */}
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1">Turno</label>
                        <div className="flex gap-1">
                          {[['manha', '🌅'], ['tarde', '☀️'], ['noite', '🌙']].map(([val, icon]) => (
                            <button key={val} onClick={() => updateMeta(i, 'sessionPeriod', val)}
                              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${p.meta.sessionPeriod === val ? 'bg-amber-500 text-black' : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                              {icon}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Adversário (só se jogo) */}
                      {p.meta.sessionType === 'jogo' && (
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1">Adversário</label>
                          <input
                            type="text"
                            placeholder="Ex: Mirassol"
                            value={p.meta.opponent}
                            onChange={e => updateMeta(i, 'opponent', e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold bg-white focus:border-amber-400 focus:outline-none"
                          />
                        </div>
                      )}

                      {/* Resultado (só se jogo) */}
                      {p.meta.sessionType === 'jogo' && (
                        <div>
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1">Resultado</label>
                          <div className="flex gap-1">
                            {[['V', '✅'], ['E', '🟡'], ['D', '❌']].map(([val, icon]) => (
                              <button key={val} onClick={() => updateMeta(i, 'result', p.meta.result === val ? '' : val)}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${p.meta.result === val ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                                {icon} {val}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 justify-end">
                <button onClick={cancelUpload} className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all">
                  Cancelar
                </button>
                <button
                  onClick={confirmUpload}
                  disabled={pendingFiles.some(p => !p.name.trim())}
                  className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-amber-500 text-black hover:bg-amber-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {pendingFiles.length === 1 ? 'Salvar Sessão' : `Salvar ${pendingFiles.length} Sessões`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL GERENCIAR CSVs */}
        {showCsvManager && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl border-2 border-slate-200 p-6 w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">

              {/* Cabeçalho */}
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h3 className="text-base font-black uppercase tracking-tighter text-black">Sessões GPS Armazenadas</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {gpsData.length} sessão(ões) no banco
                    {selectedIds.size > 0 && <span className="ml-2 text-amber-600 font-black">· {selectedIds.size} selecionada(s)</span>}
                  </p>
                </div>
                <button onClick={() => { setShowCsvManager(false); setDeleteError(null); setConfirmDeleteId(null); setSelectedIds(new Set()) }} className="text-slate-400 hover:text-slate-700 font-black text-xl leading-none">✕</button>
              </div>

              {/* Barra de ações em lote */}
              {gpsData.length > 0 && (
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
                  <button
                    onClick={() => setSelectedIds(selectedIds.size === gpsData.length ? new Set() : new Set(gpsData.map(s => s.id)))}
                    className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg border border-slate-200 hover:border-slate-300 transition-all"
                  >
                    {selectedIds.size === gpsData.length ? '☐ Desmarcar todos' : '☑ Selecionar todos'}
                  </button>

                  {selectedIds.size > 0 && (
                    <button
                      disabled={isBulkDeleting}
                      onClick={async () => {
                        if (!window.confirm(`Excluir ${selectedIds.size} sessão(ões) selecionada(s)? Esta ação não pode ser desfeita.`)) return
                        setIsBulkDeleting(true)
                        setDeleteError(null)
                        const result = await bulkDeleteGpsSessions(Array.from(selectedIds))
                        setIsBulkDeleting(false)
                        if (!result?.success) {
                          setDeleteError(result?.error || 'Erro ao excluir sessões.')
                        } else {
                          setSelectedIds(new Set())
                        }
                      }}
                      className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isBulkDeleting ? (
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                      ) : '🗑'}
                      {isBulkDeleting ? 'Excluindo...' : `Excluir ${selectedIds.size} selecionada(s)`}
                    </button>
                  )}
                </div>
              )}

              {/* Erro global */}
              {deleteError && (
                <div className="mb-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-3 py-2 rounded-lg flex items-center justify-between">
                  <span>❌ {deleteError}</span>
                  <button onClick={() => setDeleteError(null)} className="text-red-400 hover:text-red-600 font-black ml-2">✕</button>
                </div>
              )}

              {/* Lista de sessões */}
              <div className="overflow-y-auto flex-1 flex flex-col gap-2">
                {gpsData.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">Nenhuma sessão armazenada.</div>
                ) : (
                  gpsData.map((session) => {
                    const meta = session.metadata || {}
                    const isJogo = meta.type === 'jogo' || meta.sessionType === 'jogo'
                    const uploadDate = session.uploadedAt ? new Date(session.uploadedAt).toLocaleDateString('pt-BR') : '—'
                    const athletes = [...new Set((session.rows || []).filter(r => !r.isOutlier && r.periodNumber === 0).map(r => r.playerName))].length
                    const isDeleting = deletingId === session.id
                    const isConfirming = confirmDeleteId === session.id
                    const isSelected = selectedIds.has(session.id)

                    return (
                      <div key={session.id}
                        className={`flex items-center gap-3 border rounded-xl px-3 py-3 transition-all cursor-pointer select-none
                          ${isDeleting ? 'opacity-40 bg-red-50 border-red-200' :
                            isSelected ? 'border-amber-400 bg-amber-50' :
                            isConfirming ? 'border-red-300 bg-red-50' :
                            'border-slate-200 hover:bg-slate-50'}`}
                        onClick={() => {
                          if (isDeleting || isBulkDeleting) return
                          setSelectedIds(prev => {
                            const next = new Set(prev)
                            next.has(session.id) ? next.delete(session.id) : next.add(session.id)
                            return next
                          })
                          setConfirmDeleteId(null)
                        }}
                      >
                        {/* Checkbox */}
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-amber-500 border-amber-500' : 'border-slate-300'}`}>
                          {isSelected && <span className="text-white text-xs font-black leading-none">✓</span>}
                        </div>

                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 ${isJogo ? 'bg-green-100' : 'bg-blue-100'}`}>
                          {isDeleting ? (
                            <svg className="w-4 h-4 animate-spin text-red-500" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                          ) : isJogo ? '⚽' : '🏃'}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-black truncate">{session.name}</p>
                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            <span className="text-[10px] text-slate-500 font-medium">{session.date || '—'}</span>
                            {athletes > 0 && <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">{athletes} atletas</span>}
                            {isJogo && meta.opponent && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">vs {meta.opponent}</span>}
                            {isJogo && meta.result && <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">{meta.result === 'V' ? '✅ V' : meta.result === 'E' ? '🟡 E' : '❌ D'}</span>}
                            <span className="text-[10px] text-slate-400">Upload: {uploadDate}</span>
                          </div>
                        </div>

                        {/* Botão excluir individual */}
                        <div className="shrink-0" onClick={e => e.stopPropagation()}>
                          {isConfirming ? (
                            <div className="flex items-center gap-1">
                              <button
                                disabled={isDeleting}
                                onClick={async () => {
                                  setDeletingId(session.id)
                                  setConfirmDeleteId(null)
                                  setDeleteError(null)
                                  const result = await deleteGpsSession(session.id)
                                  setDeletingId(null)
                                  setSelectedIds(prev => { const n = new Set(prev); n.delete(session.id); return n })
                                  if (!result?.success) setDeleteError(result?.error || `Erro ao excluir "${session.name}"`)
                                }}
                                className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded-lg text-[10px] font-black transition-all disabled:opacity-50"
                              >✓</button>
                              <button onClick={() => setConfirmDeleteId(null)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded-lg text-[10px] font-black transition-all">✕</button>
                            </div>
                          ) : (
                            <button
                              disabled={isDeleting || !!deletingId || isBulkDeleting}
                              onClick={() => setConfirmDeleteId(session.id)}
                              className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              🗑
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100">
                <label className="cursor-pointer bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                  + Upload novo CSV
                  <input
                    type="file"
                    accept=".csv"
                    multiple
                    className="hidden"
                    onChange={e => {
                      setShowCsvManager(false); setDeleteError(null); setConfirmDeleteId(null); setSelectedIds(new Set())
                      handleFilesSelect(e.target.files); e.target.value = ''
                    }}
                  />
                </label>
                <button onClick={() => { setShowCsvManager(false); setDeleteError(null); setConfirmDeleteId(null); setSelectedIds(new Set()) }}
                  className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL RESOLVER NOMES DIVERGENTES */}
        {showAliasManager && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl border-2 border-slate-200 p-6 w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-base font-black uppercase tracking-tighter text-black">Resolver Nomes Divergentes</h3>
                <button onClick={() => { setShowAliasManager(false); setAliasError(null); setManualGps(''); setManualBem('') }} className="text-slate-400 hover:text-slate-700 font-black text-xl leading-none">✕</button>
              </div>
              <p className="text-xs text-slate-500 mb-4">Vincule nomes do GPS (Catapult) com o nome correspondente no Bem-Estar. O sistema vai cruzar os dados automaticamente.</p>

              {aliasError && (
                <div className="mb-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-3 py-2 rounded-lg flex items-center justify-between">
                  <span>❌ {aliasError}</span>
                  <button onClick={() => setAliasError(null)} className="ml-2 font-black">✕</button>
                </div>
              )}

              <div className="overflow-y-auto flex-1 flex flex-col gap-5">

                {/* SUGESTÕES AUTOMÁTICAS */}
                {suggestions.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">✨ Sugestões automáticas — clique para confirmar</p>
                    <div className="flex flex-col gap-2">
                      {suggestions.map((s, i) => {
                        const isLoading = aliasLoading.has(s.gpsName)
                        return (
                          <div key={i} className="flex items-center gap-2 border border-amber-200 bg-amber-50 rounded-xl px-3 py-2.5">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-black text-slate-700 bg-blue-100 px-2 py-0.5 rounded">📡 {s.gpsName}</span>
                                <span className="text-slate-400 text-xs">→</span>
                                <span className="text-xs font-black text-slate-700 bg-green-100 px-2 py-0.5 rounded">📋 {s.bemName}</span>
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${s.confidence > 0.7 ? 'bg-green-200 text-green-800' : 'bg-amber-200 text-amber-800'}`}>
                                  {Math.round(s.confidence * 100)}% similar
                                </span>
                              </div>
                            </div>
                            <button
                              disabled={isLoading}
                              onClick={async () => {
                                setAliasLoading(prev => new Set(prev).add(s.gpsName))
                                const result = await addNameAlias(s.gpsName, s.bemName)
                                setAliasLoading(prev => { const n = new Set(prev); n.delete(s.gpsName); return n })
                                if (!result?.success) setAliasError(result?.error || 'Erro ao salvar alias.')
                              }}
                              className="shrink-0 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all disabled:opacity-50 flex items-center gap-1"
                            >
                              {isLoading ? <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : '✓'}
                              {isLoading ? '' : 'Confirmar'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ALIASES ATIVOS */}
                {nameAliases.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">✅ Vínculos ativos ({nameAliases.length})</p>
                    <div className="flex flex-col gap-1.5">
                      {nameAliases.map(alias => (
                        <div key={alias.id} className="flex items-center gap-2 border border-green-200 bg-green-50 rounded-xl px-3 py-2">
                          <div className="flex-1 flex items-center gap-2 flex-wrap min-w-0">
                            <span className="text-xs font-black text-slate-700 bg-blue-100 px-2 py-0.5 rounded truncate">📡 {alias.gps_name}</span>
                            <span className="text-slate-400 text-xs shrink-0">→</span>
                            <span className="text-xs font-black text-slate-700 bg-green-100 px-2 py-0.5 rounded truncate">📋 {alias.bem_name}</span>
                          </div>
                          <button
                            onClick={async () => {
                              const result = await removeNameAlias(alias.id)
                              if (!result?.success) setAliasError('Erro ao remover vínculo.')
                            }}
                            className="shrink-0 text-red-400 hover:text-red-600 font-black text-xs px-2 py-1 rounded hover:bg-red-50 transition-all"
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* NOMES GPS SEM MATCH */}
                {unmatchedGpsNames.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">📡 Nomes GPS sem correspondência no bem-estar</p>
                    <div className="flex flex-wrap gap-1.5">
                      {unmatchedGpsNames.map(n => (
                        <button key={n}
                          onClick={() => setManualGps(n)}
                          className={`text-[10px] font-black px-2 py-1 rounded border transition-all ${manualGps === n ? 'bg-blue-500 text-white border-blue-500' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* VÍNCULO MANUAL */}
                <div className="border-2 border-slate-200 rounded-xl p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">🔗 Criar vínculo manual</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">Nome GPS (Catapult) 📡</label>
                      <input
                        type="text"
                        placeholder="Ex: FELIPE SAMOGIM"
                        value={manualGps}
                        onChange={e => setManualGps(e.target.value.toUpperCase())}
                        list="gps-names-list"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold bg-white focus:border-amber-400 focus:outline-none uppercase"
                      />
                      <datalist id="gps-names-list">{gpsNames.map(n => <option key={n} value={n}/>)}</datalist>
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">Nome Bem-Estar (Formulário) 📋</label>
                      <input
                        type="text"
                        placeholder="Ex: FELIPE AGUIAR SAMOGIM"
                        value={manualBem}
                        onChange={e => setManualBem(e.target.value.toUpperCase())}
                        list="bem-names-list"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold bg-white focus:border-amber-400 focus:outline-none uppercase"
                      />
                      <datalist id="bem-names-list">{bemNames.map(n => <option key={n} value={n}/>)}</datalist>
                    </div>
                  </div>
                  <button
                    disabled={!manualGps.trim() || !manualBem.trim()}
                    onClick={async () => {
                      setAliasError(null)
                      const result = await addNameAlias(manualGps.trim(), manualBem.trim())
                      if (result?.success) { setManualGps(''); setManualBem('') }
                      else setAliasError(result?.error || 'Erro ao salvar.')
                    }}
                    className="bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    + Criar vínculo
                  </button>
                </div>

              </div>

              <div className="flex justify-end mt-4 pt-4 border-t border-slate-100">
                <button
                  onClick={() => { setShowAliasManager(false); setAliasError(null); setManualGps(''); setManualBem('') }}
                  className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* KPI PRONTIDÃO DA EQUIPE HOJE */}
        {teamReadiness && (
          <div
            className="border-2 border-slate-200 rounded-2xl p-4 cursor-pointer hover:border-amber-400 transition-all"
            onClick={() => router.push('/fisiologia/diario')}
          >
            <div className="flex items-center justify-between flex-wrap gap-4">
              {/* Score principal */}
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black flex-shrink-0 ${
                  teamReadiness.avg >= 75 ? 'bg-green-100 text-green-700 border-2 border-green-300' :
                  teamReadiness.avg >= 50 ? 'bg-amber-100 text-amber-700 border-2 border-amber-300' :
                  'bg-red-100 text-red-700 border-2 border-red-300'
                }`}>
                  {teamReadiness.avg}
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Prontidão da Equipe — Hoje</p>
                  <p className="text-xl font-black text-black leading-tight">
                    {teamReadiness.avg >= 75 ? 'Treino Normal' : teamReadiness.avg >= 50 ? 'Treino Modificado' : 'Repouso Sugerido'}
                  </p>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                    Baseado em {teamReadiness.total} check-in{teamReadiness.total !== 1 ? 's' : ''} de hoje · score 0–100
                  </p>
                </div>
              </div>

              {/* Distribuição */}
              <div className="flex items-center gap-3">
                {/* Barra de distribuição */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex h-3 rounded-full overflow-hidden w-48 bg-slate-100">
                    {teamReadiness.green > 0 && (
                      <div className="bg-green-500 h-full transition-all" style={{ width: `${(teamReadiness.green / teamReadiness.total) * 100}%` }} />
                    )}
                    {teamReadiness.yellow > 0 && (
                      <div className="bg-amber-400 h-full transition-all" style={{ width: `${(teamReadiness.yellow / teamReadiness.total) * 100}%` }} />
                    )}
                    {teamReadiness.red > 0 && (
                      <div className="bg-red-500 h-full transition-all" style={{ width: `${(teamReadiness.red / teamReadiness.total) * 100}%` }} />
                    )}
                  </div>
                  <div className="flex justify-between text-[9px] font-black w-48">
                    <span className="text-green-600">{teamReadiness.green} normal</span>
                    <span className="text-amber-600">{teamReadiness.yellow} modif.</span>
                    <span className="text-red-600">{teamReadiness.red} repouso</span>
                  </div>
                </div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Ver detalhes →
                </div>
              </div>
            </div>
          </div>
        )}

        {/* GRID DE FERRAMENTAS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {ferramentas.map((item) => (
            <button
              key={item.id}
              onClick={() => router.push(item.rota)}
              className="group border-2 border-slate-200 hover:border-amber-500 bg-white p-8 rounded-2xl text-left transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <div className="w-14 h-14 bg-slate-100 group-hover:bg-amber-500 rounded-xl flex items-center justify-center mb-6 transition-all duration-200 text-slate-500 group-hover:text-black">
                {item.icon}
              </div>
              <h2 className="text-lg font-black uppercase tracking-tighter mb-2 text-black group-hover:text-amber-600 transition-colors">
                {item.titulo}
              </h2>
              <p className="text-slate-500 text-xs leading-relaxed font-medium group-hover:text-slate-700 transition-colors">
                {item.descricao}
              </p>
              <div className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-600 opacity-0 group-hover:opacity-100 transition-all">
                Acessar
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </button>
          ))}
        </div>

        {/* FOOTER */}
        <footer className="flex justify-between items-center border-t-2 border-slate-900 pt-3 mt-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              Bem-estar via Google Sheets · GPS via Catapult CSV · Radar por posição · Exposição à velocidade · Relatórios automáticos
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-black italic tracking-tight uppercase">© Fisiologia GN</p>
        </footer>

      </div>
    </div>
  )
}
