'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import Papa from 'papaparse'

const DataContext = createContext(null)

// ─── NORMALIZAÇÃO DE NOMES ────────────────────────────────────────────────────
// Remove acentos, padroniza maiúsculas, espaços duplos e preposições
// para que "João Da Silva" == "JOAO DA SILVA" == "Joao da Silva"
export function normalizeName(name) {
  if (!name) return ''
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // remove acentos
    .replace(/[^a-zA-Z\s]/g, '')      // remove caracteres especiais
    .replace(/\s+/g, ' ')             // espaços duplos
    .trim()
    .toLowerCase()
}

// Mapa de nome normalizado → nome canônico (primeiro que aparece)
// Permite cruzar GPS com bem-estar mesmo com nomes diferentes
let _canonicalMap = {}

export function buildCanonicalMap(gpsData, bemEstarData) {
  const map = {}
  // GPS: nome original → normalizado
  for (const session of gpsData) {
    for (const row of session.rows) {
      const orig = row.playerName?.trim()
      if (!orig) continue
      const norm = normalizeName(orig)
      if (!map[norm]) map[norm] = orig // primeiro GPS vira canônico
    }
  }
  // Bem-estar: se nome normalizado já existe, registra equivalência
  for (const r of bemEstarData) {
    const orig = r.playerName?.trim()
    if (!orig) continue
    const norm = normalizeName(orig)
    if (!map[norm]) map[norm] = orig
  }
  _canonicalMap = map
  return map
}

// Retorna o nome canônico para qualquer variação
export function getCanonicalName(name) {
  if (!name) return name
  const norm = normalizeName(name)
  return _canonicalMap[norm] || name
}

// ─── BEM-ESTAR PARSER (client-side, Google Sheets) ────────────────────────────
export function parseBemEstarCSV(csvText) {
  const { data } = Papa.parse(csvText, { header: true, skipEmptyLines: true })

  return data.map(row => {
    const rawTs = row['Carimbo de data/hora'] || ''
    let timestamp
    if (rawTs.match(/^\d{2}\/\d{2}\/\d{4}/)) {
      const [datePart, timePart = '00:00:00'] = rawTs.split(' ')
      const [dd, mm, yyyy] = datePart.split('/')
      timestamp = new Date(`${yyyy}-${mm}-${dd}T${timePart}`)
    } else {
      timestamp = new Date(rawTs)
    }
    const date = !isNaN(timestamp) ? timestamp.toISOString().split('T')[0] : null
    if (!date) return null
    const isPre = row['Atividade:'] === 'Pré-Atividade'
    const isPost = row['Atividade:'] === 'Pós-Atividade'

    const fadiga = parseFloat(row['Fadiga']) || null
    const sono = parseFloat(row['Qualidade do Sono']) || null
    const doms = parseFloat(row['Dor Muscular Geral']) || null
    const estresse = parseFloat(row['Nível de Estresse']) || null
    const humor = parseFloat(row['Humor']) || null
    const corUrina = parseFloat(row['Cor da Urina']) || null
    const srpe = parseFloat(row['Percepção Subjetiva de Esforço:']) || null
    const duracaoSessao = parseFloat(row['Tempo da Sessão em minutos (somente números)']) || null
    const dorResposta = row['Está sentindo dor localizada em um dos pontos  acima?'] || ''
    const dorLocalizada = row['Dor Localizada:'] || ''
    const temDor = dorResposta.toLowerCase() === 'sim'

    const wellnessItems = [
      fadiga ? (6 - fadiga) : null,
      sono,
      doms ? (6 - doms) : null,
      estresse ? (6 - estresse) : null,
      humor,
    ].filter(v => v !== null)

    const wellnessScore = wellnessItems.length > 0
      ? wellnessItems.reduce((a, b) => a + b, 0) / wellnessItems.length
      : null

    const rawName = row['Atleta:']?.trim()

    return {
      timestamp,
      date,
      playerName: rawName,           // mantém original para exibição
      _normalizedName: normalizeName(rawName),
      type: isPre ? 'pre' : isPost ? 'post' : 'unknown',
      fadiga, sono, doms, estresse, humor, corUrina,
      temDor,
      dorLocalizada: temDor ? dorLocalizada : '',
      srpe, duracaoSessao,
      srpeLoad: srpe && duracaoSessao ? srpe * duracaoSessao : null,
      wellnessScore,
    }
  }).filter(r => r && r.playerName)
}

// ─── CÁLCULOS ─────────────────────────────────────────────────────────────────
export function calcVmaxBaseline(gpsData) {
  const baseline = {}
  for (const session of gpsData) {
    for (const row of session.rows) {
      if (row.periodNumber !== 0 || row.isOutlier || !row.maxVelocity) continue
      if (!baseline[row.playerName] || row.maxVelocity > baseline[row.playerName]) {
        baseline[row.playerName] = row.maxVelocity
      }
    }
  }
  return baseline
}

export function calcVmaxPct(sessionVmax, historicalMax) {
  if (!sessionVmax || !historicalMax) return null
  return Math.round((sessionVmax / historicalMax) * 100)
}

// ─── PROVIDER ─────────────────────────────────────────────────────────────────
export function DataProvider({ children }) {
  const [gpsData, setGpsData] = useState([])
  const [isLoadingGps, setIsLoadingGps] = useState(false)
  const [gpsError, setGpsError] = useState(null)
  const [uploadStatus, setUploadStatus] = useState(null)
  const [uploadQueue, setUploadQueue] = useState([])

  const [bemEstarData, setBemEstarData] = useState([])
  const [isLoadingBemEstar, setIsLoadingBemEstar] = useState(false)
  const [bemEstarError, setBemEstarError] = useState(null)

  const [vmaxBaseline, setVmaxBaseline] = useState({})
  const [canonicalMap, setCanonicalMap] = useState({})

  const SHEETS_URL = '/api/bem-estar'

  // ── Carregar sessões GPS ──────────────────────────────────────────────────
  const fetchGpsSessions = useCallback(async () => {
    setIsLoadingGps(true)
    setGpsError(null)
    try {
      const res = await fetch('/api/gps/sessions')
      if (!res.ok) throw new Error('Erro ao buscar sessões GPS')
      const { sessions } = await res.json()
      setGpsData(sessions || [])
      setVmaxBaseline(calcVmaxBaseline(sessions || []))
    } catch (e) {
      setGpsError(e.message)
    } finally {
      setIsLoadingGps(false)
    }
  }, [])

  useEffect(() => {
    fetchGpsSessions()
  }, [fetchGpsSessions])

  // Recalcula mapa canônico quando ambas as fontes estão disponíveis
  useEffect(() => {
    if (gpsData.length > 0 || bemEstarData.length > 0) {
      const map = buildCanonicalMap(gpsData, bemEstarData)
      setCanonicalMap(map)
    }
  }, [gpsData, bemEstarData])

  // ── Upload de UM CSV GPS ──────────────────────────────────────────────────
  const uploadGpsFile = useCallback(async (file, sessionName = '', metadata = {}) => {
    if (!file || !file.name.endsWith('.csv')) {
      setUploadStatus({ type: 'error', message: 'Selecione um arquivo .csv do Catapult.' })
      return false
    }

    setUploadStatus({ type: 'loading', message: `Enviando ${file.name}...` })

    const formData = new FormData()
    formData.append('file', file)
    formData.append('session_name', sessionName || file.name.replace(/\.csv$/i, ''))
    if (metadata.sessionType) formData.append('session_type', metadata.sessionType)
    if (metadata.sessionPeriod) formData.append('session_period', metadata.sessionPeriod)
    if (metadata.opponent) formData.append('opponent', metadata.opponent)
    if (metadata.result) formData.append('result', metadata.result)

    try {
      const res = await fetch('/api/gps/upload', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok || data.error) {
        setUploadStatus({ type: 'error', message: data.error || 'Erro ao processar CSV.' })
        return false
      }

      setUploadStatus({ type: 'success', message: data.message })
      await fetchGpsSessions()
      setTimeout(() => setUploadStatus(null), 5000)
      return true

    } catch (e) {
      setUploadStatus({ type: 'error', message: 'Falha na conexão com o servidor.' })
      return false
    }
  }, [fetchGpsSessions])

  // ── Upload de MÚLTIPLOS CSVs GPS ──────────────────────────────────────────
  const uploadMultipleGpsFiles = useCallback(async (filesWithMeta) => {
    if (!filesWithMeta || filesWithMeta.length === 0) return

    const queue = filesWithMeta.map(item => ({
      file: item.file,
      name: item.name,
      metadata: item.metadata || {},
      status: 'pending',
      message: '',
    }))
    setUploadQueue(queue)

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i]
      setUploadQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'uploading' } : q))

      const formData = new FormData()
      formData.append('file', item.file)
      formData.append('session_name', item.name)
      if (item.metadata.sessionType) formData.append('session_type', item.metadata.sessionType)
      if (item.metadata.sessionPeriod) formData.append('session_period', item.metadata.sessionPeriod)
      if (item.metadata.opponent) formData.append('opponent', item.metadata.opponent)
      if (item.metadata.result) formData.append('result', item.metadata.result)

      try {
        const res = await fetch('/api/gps/upload', { method: 'POST', body: formData })
        const data = await res.json()

        if (!res.ok || data.error) {
          setUploadQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'error', message: data.error || 'Erro' } : q))
        } else {
          setUploadQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'success', message: data.message } : q))
        }
      } catch (e) {
        setUploadQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'error', message: 'Falha na conexão' } : q))
      }
    }

    await fetchGpsSessions()
    setTimeout(() => setUploadQueue([]), 8000)
  }, [fetchGpsSessions])

  // ── Deletar sessão GPS ────────────────────────────────────────────────────
  const deleteGpsSession = useCallback(async (id) => {
    try {
      const res = await fetch(`/api/gps/sessions/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        return { success: false, error: data.error || 'Erro ao excluir sessão.' }
      }
      // Atualiza estado local imediatamente (otimista)
      setGpsData(prev => {
        const next = prev.filter(s => s.id !== id)
        setVmaxBaseline(calcVmaxBaseline(next))
        return next
      })
      return { success: true }
    } catch (e) {
      console.error('Erro ao deletar sessão:', e)
      return { success: false, error: 'Falha de rede.' }
    }
  }, [])

  // ── Deletar múltiplas sessões GPS ─────────────────────────────────────────
  const bulkDeleteGpsSessions = useCallback(async (ids) => {
    try {
      const res = await fetch('/api/gps/sessions/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const data = await res.json()
      if (!res.ok) {
        return { success: false, error: data.error || 'Erro ao excluir sessões.' }
      }
      setGpsData(prev => {
        const next = prev.filter(s => !ids.includes(s.id))
        setVmaxBaseline(calcVmaxBaseline(next))
        return next
      })
      return { success: true, deleted: data.deleted }
    } catch (e) {
      console.error('Erro ao deletar sessões em lote:', e)
      return { success: false, error: 'Falha de rede.' }
    }
  }, [])

  // ── Bem-estar do Google Sheets ────────────────────────────────────────────
  const fetchBemEstar = useCallback(async () => {
    setIsLoadingBemEstar(true)
    setBemEstarError(null)
    try {
      const res = await fetch(SHEETS_URL)
      if (!res.ok) throw new Error('Erro ao buscar planilha')
      const text = await res.text()
      setBemEstarData(parseBemEstarCSV(text))
    } catch (e) {
      setBemEstarError(e.message)
    } finally {
      setIsLoadingBemEstar(false)
    }
  }, [])

  // ── Busca de bem-estar por nome (com normalização) ────────────────────────
  // Use esta função em vez de filtrar por playerName diretamente
  const getBemEstarForAthlete = useCallback((targetName) => {
    const normTarget = normalizeName(targetName)
    return bemEstarData.filter(r => normalizeName(r.playerName) === normTarget)
  }, [bemEstarData])

  // ── Lista de atletas unificada (sem duplicatas por variação de nome) ──────
  const getUnifiedAthletes = useCallback(() => {
    const seen = new Set()
    const result = []
    // GPS é fonte primária para nome canônico
    for (const session of gpsData) {
      for (const row of session.rows) {
        if (!row.playerName || row.isOutlier) continue
        const norm = normalizeName(row.playerName)
        if (!seen.has(norm)) {
          seen.add(norm)
          result.push(row.playerName)
        }
      }
    }
    // Bem-estar: adiciona quem não tem GPS
    for (const r of bemEstarData) {
      if (!r.playerName) continue
      const norm = normalizeName(r.playerName)
      if (!seen.has(norm)) {
        seen.add(norm)
        result.push(r.playerName)
      }
    }
    return result.sort()
  }, [gpsData, bemEstarData])

  return (
    <DataContext.Provider value={{
      gpsData,
      isLoadingGps,
      gpsError,
      uploadStatus,
      uploadQueue,
      uploadGpsFile,
      uploadMultipleGpsFiles,
      deleteGpsSession,
      bulkDeleteGpsSessions,
      fetchGpsSessions,
      bemEstarData,
      isLoadingBemEstar,
      bemEstarError,
      fetchBemEstar,
      vmaxBaseline,
      canonicalMap,
      getBemEstarForAthlete,
      getUnifiedAthletes,
      normalizeName,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
