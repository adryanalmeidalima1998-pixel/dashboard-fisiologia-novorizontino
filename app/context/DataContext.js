'use client'

import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import Papa from 'papaparse'

const DataContext = createContext(null)

// ─── NORMALIZAÇÃO DE NOMES ────────────────────────────────────────────────────
export function normalizeName(name) {
  if (!name) return ''
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

let _canonicalMap = {}

export function buildCanonicalMap(gpsData, bemEstarData) {
  const map = {}
  for (const session of gpsData) {
    for (const row of session.rows) {
      const orig = row.playerName?.trim()
      if (!orig) continue
      const norm = normalizeName(orig)
      if (!map[norm]) map[norm] = orig
    }
  }
  for (const r of bemEstarData) {
    const orig = r.playerName?.trim()
    if (!orig) continue
    const norm = normalizeName(orig)
    if (!map[norm]) map[norm] = orig
  }
  _canonicalMap = map
  return map
}

export function getCanonicalName(name) {
  if (!name) return name
  const norm = normalizeName(name)
  return _canonicalMap[norm] || name
}

// ─── SUGESTÃO AUTOMÁTICA DE ALIASES ──────────────────────────────────────────
export function suggestNameMatches(gpsNames, bemNames, existingAliases) {
  const aliasedGpsNames = new Set(existingAliases.map(a => a.gps_name))
  const suggestions = []

  for (const gpsName of gpsNames) {
    if (aliasedGpsNames.has(gpsName)) continue
    const gpsNorm = normalizeName(gpsName)
    if (bemNames.some(b => normalizeName(b) === gpsNorm)) continue

    const gpsTokens = gpsNorm.split(' ').filter(Boolean)

    for (const bemName of bemNames) {
      const bemNorm = normalizeName(bemName)
      if (bemNorm === gpsNorm) continue
      const bemTokens = bemNorm.split(' ').filter(Boolean)

      const shorter = gpsTokens.length <= bemTokens.length ? gpsTokens : bemTokens
      const longer  = gpsTokens.length <= bemTokens.length ? bemTokens : gpsTokens

      if (shorter.length >= 2 && shorter.every(t => longer.includes(t))) {
        suggestions.push({
          gpsName,
          bemName,
          confidence: shorter.length / longer.length,
        })
      }
    }
  }

  const seen = new Set()
  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .filter(s => { if (seen.has(s.gpsName)) return false; seen.add(s.gpsName); return true })
}

// ─── BEM-ESTAR PARSER ────────────────────────────────────────────────────────
export function parseBemEstarCSV(csvText) {
  const { data } = Papa.parse(csvText, { header: true, skipEmptyLines: true })

  return data.map(row => {
    const rawTs = row['Carimbo de data/hora'] || ''
    let timestamp
    let date = null
    if (rawTs.match(/^\d{2}\/\d{2}\/\d{4}/)) {
      const [datePart, timePart = '00:00:00'] = rawTs.split(' ')
      const [dd, mm, yyyy] = datePart.split('/')
      date = `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`
      timestamp = new Date(`${yyyy}-${mm}-${dd}T${timePart}`)
    } else {
      timestamp = new Date(rawTs)
      date = !isNaN(timestamp) ? timestamp.toISOString().split('T')[0] : null
    }
    if (!date) return null

    const _atividadeRaw = row['Atividade:'] || ''
    const _atividadeNorm = _atividadeRaw
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[-_]/g, ' ')
      .trim().toLowerCase()
    const isPre  = _atividadeNorm.includes('pre')
    const isPost = _atividadeNorm.includes('pos') || _atividadeNorm.includes('post')
    const _hasSrpe    = !!(row['Percepção Subjetiva de Esforço:'] || '').trim()
    const _hasWellness = !!(row['Fadiga'] || row['Qualidade do Sono'] || row['Humor'] || '').toString().trim()
    const _isPre  = isPre  || (!isPost && _hasWellness && !_hasSrpe)
    const _isPost = isPost || (!isPre  && _hasSrpe)

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
      playerName: rawName,
      _normalizedName: normalizeName(rawName),
      type: _isPre ? 'pre' : _isPost ? 'post' : 'unknown',
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
export function applyAliasesToSessions(sessions, aliases) {
  if (!aliases || aliases.length === 0) return sessions
  const aliasMap = {}
  for (const a of aliases) aliasMap[a.gps_name] = a.bem_name
  return sessions.map(session => ({
    ...session,
    rows: session.rows.map(row => {
      const mapped = aliasMap[row.playerName]
      return mapped ? { ...row, playerName: mapped, _originalName: row.playerName } : row
    }),
  }))
}

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
  const [nameAliases, setNameAliases] = useState([])
  const [isLoadingAliases, setIsLoadingAliases] = useState(false)

  // ── EXCLUSÕES DE ELENCO ───────────────────────────────────────────────────
  const [squadExclusions, setSquadExclusions] = useState([]) // [{id, player_name, normalized_name}]
  const [isLoadingExclusions, setIsLoadingExclusions] = useState(false)

  // Set de nomes normalizados excluídos — use este para filtrar qualquer lista de atletas
  const excludedNamesNorm = useMemo(() => {
    return new Set(squadExclusions.map(e => e.normalized_name))
  }, [squadExclusions])

  // Helper: retorna true se o atleta está excluído do elenco
  const isExcluded = useCallback((name) => {
    return excludedNamesNorm.has(normalizeName(name))
  }, [excludedNamesNorm])

  const SHEETS_URL = '/api/bem-estar'

  // ── Carregar exclusões ────────────────────────────────────────────────────
  const fetchSquadExclusions = useCallback(async () => {
    setIsLoadingExclusions(true)
    try {
      const res = await fetch('/api/squad-exclusions')
      if (!res.ok) return
      const { exclusions } = await res.json()
      setSquadExclusions(exclusions || [])
    } catch (e) {
      console.error('Erro ao buscar exclusões:', e)
    } finally {
      setIsLoadingExclusions(false)
    }
  }, [])

  useEffect(() => { fetchSquadExclusions() }, [fetchSquadExclusions])

  const addSquadExclusion = useCallback(async (playerName) => {
    try {
      const res = await fetch('/api/squad-exclusions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_name: playerName }),
      })
      const data = await res.json()
      if (!res.ok) return { success: false, error: data.error }
      setSquadExclusions(prev => {
        const norm = normalizeName(playerName)
        const next = prev.filter(e => e.normalized_name !== norm)
        return [...next, data.exclusion]
      })
      return { success: true }
    } catch (e) {
      return { success: false, error: 'Falha de rede.' }
    }
  }, [])

  const removeSquadExclusion = useCallback(async (id) => {
    try {
      const res = await fetch(`/api/squad-exclusions/${id}`, { method: 'DELETE' })
      if (!res.ok) return { success: false }
      setSquadExclusions(prev => prev.filter(e => e.id !== id))
      return { success: true }
    } catch (e) {
      return { success: false, error: 'Falha de rede.' }
    }
  }, [])

  // ── Carregar sessões GPS ──────────────────────────────────────────────────
  const fetchGpsSessions = useCallback(async () => {
    setIsLoadingGps(true)
    setGpsError(null)
    try {
      const res = await fetch('/api/gps/sessions')
      if (!res.ok) throw new Error('Erro ao buscar sessões GPS')
      const { sessions } = await res.json()
      const processedSessions = applyAliasesToSessions(sessions || [], nameAliases)
      setGpsData(processedSessions)
      setVmaxBaseline(calcVmaxBaseline(processedSessions))
    } catch (e) {
      setGpsError(e.message)
    } finally {
      setIsLoadingGps(false)
    }
  }, [nameAliases])

  useEffect(() => {
    fetchGpsSessions()
  }, [fetchGpsSessions])

  // ── Carregar aliases de nomes ────────────────────────────────────────────
  const fetchNameAliases = useCallback(async () => {
    setIsLoadingAliases(true)
    try {
      const res = await fetch('/api/name-aliases')
      if (!res.ok) return
      const { aliases } = await res.json()
      setNameAliases(aliases || [])
    } catch (e) {
      console.error('Erro ao buscar aliases:', e)
    } finally {
      setIsLoadingAliases(false)
    }
  }, [])

  useEffect(() => { fetchNameAliases() }, [fetchNameAliases])

  const addNameAlias = useCallback(async (gpsName, bemName) => {
    try {
      const res = await fetch('/api/name-aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gps_name: gpsName, bem_name: bemName }),
      })
      const data = await res.json()
      if (!res.ok) return { success: false, error: data.error }
      setNameAliases(prev => {
        const next = prev.filter(a => a.gps_name !== gpsName)
        return [...next, data.alias]
      })
      return { success: true }
    } catch (e) {
      return { success: false, error: 'Falha de rede.' }
    }
  }, [])

  const removeNameAlias = useCallback(async (id) => {
    try {
      const res = await fetch(`/api/name-aliases/${id}`, { method: 'DELETE' })
      if (!res.ok) return { success: false }
      setNameAliases(prev => prev.filter(a => a.id !== id))
      return { success: true }
    } catch (e) {
      return { success: false, error: 'Falha de rede.' }
    }
  }, [])

  // Recalcula mapa canônico
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
    if (metadata.mando) formData.append('mando', metadata.mando)

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
      if (item.metadata.mando) formData.append('mando', item.metadata.mando)

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
      if (!res.ok) return { success: false, error: data.error || 'Erro ao excluir sessão.' }
      setGpsData(prev => {
        const next = prev.filter(s => s.id !== id)
        setVmaxBaseline(calcVmaxBaseline(next))
        return next
      })
      return { success: true }
    } catch (e) {
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
      if (!res.ok) return { success: false, error: data.error || 'Erro ao excluir sessões.' }
      setGpsData(prev => {
        const next = prev.filter(s => !ids.includes(s.id))
        setVmaxBaseline(calcVmaxBaseline(next))
        return next
      })
      return { success: true, deleted: data.deleted }
    } catch (e) {
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

  const getBemEstarForAthlete = useCallback((targetName) => {
    const normTarget = normalizeName(targetName)
    return bemEstarData.filter(r => normalizeName(r.playerName) === normTarget)
  }, [bemEstarData])

  // ── Lista de atletas unificada — SEM os excluídos ────────────────────────
  const getUnifiedAthletes = useCallback(() => {
    const seen = new Set()
    const result = []
    for (const session of gpsData) {
      for (const row of session.rows) {
        if (!row.playerName || row.isOutlier) continue
        const norm = normalizeName(row.playerName)
        if (excludedNamesNorm.has(norm)) continue // ← filtra excluídos
        if (!seen.has(norm)) {
          seen.add(norm)
          result.push(row.playerName)
        }
      }
    }
    for (const r of bemEstarData) {
      if (!r.playerName) continue
      const norm = normalizeName(r.playerName)
      if (excludedNamesNorm.has(norm)) continue // ← filtra excluídos
      if (!seen.has(norm)) {
        seen.add(norm)
        result.push(r.playerName)
      }
    }
    return result.sort()
  }, [gpsData, bemEstarData, excludedNamesNorm])

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
      playerPositions: (() => {
        const map = {}
        for (const session of gpsData) {
          for (const row of session.rows) {
            if (row.playerName && row.positionName && !map[row.playerName]) {
              map[row.playerName] = row.positionName
            }
          }
        }
        return map
      })(),
      canonicalMap,
      getBemEstarForAthlete,
      getUnifiedAthletes,
      normalizeName,
      nameAliases,
      isLoadingAliases,
      addNameAlias,
      removeNameAlias,
      fetchNameAliases,
      suggestNameMatches,
      applyAliasesToSessions,
      // ── Exclusões de elenco ──────────────────────────────────────────────
      squadExclusions,
      excludedNamesNorm,
      isExcluded,
      isLoadingExclusions,
      addSquadExclusion,
      removeSquadExclusion,
      fetchSquadExclusions,
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
