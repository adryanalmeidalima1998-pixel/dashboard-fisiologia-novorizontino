'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import Papa from 'papaparse'

const DataContext = createContext(null)

// ─── BEM-ESTAR PARSER (client-side, Google Sheets) ────────────────────────────
export function parseBemEstarCSV(csvText) {
  const { data } = Papa.parse(csvText, { header: true, skipEmptyLines: true })

  return data.map(row => {
    const timestamp = new Date(row['Carimbo de data/hora'])
    const date = timestamp.toISOString().split('T')[0]
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

    return {
      timestamp,
      date,
      playerName: row['Atleta:']?.trim(),
      type: isPre ? 'pre' : isPost ? 'post' : 'unknown',
      fadiga, sono, doms, estresse, humor, corUrina,
      temDor,
      dorLocalizada: temDor ? dorLocalizada : '',
      srpe, duracaoSessao,
      srpeLoad: srpe && duracaoSessao ? srpe * duracaoSessao : null,
      wellnessScore,
    }
  }).filter(r => r.playerName)
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
  const [uploadQueue, setUploadQueue] = useState([]) // { file, name, status }

  const [bemEstarData, setBemEstarData] = useState([])
  const [isLoadingBemEstar, setIsLoadingBemEstar] = useState(false)
  const [bemEstarError, setBemEstarError] = useState(null)

  const [vmaxBaseline, setVmaxBaseline] = useState({})

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

  // ── Upload de UM CSV GPS ──────────────────────────────────────────────────
  const uploadGpsFile = useCallback(async (file, sessionName = '') => {
    if (!file || !file.name.endsWith('.csv')) {
      setUploadStatus({ type: 'error', message: 'Selecione um arquivo .csv do Catapult.' })
      return false
    }

    setUploadStatus({ type: 'loading', message: `Enviando ${file.name}...` })

    const formData = new FormData()
    formData.append('file', file)
    formData.append('session_name', sessionName || file.name.replace(/\.csv$/i, ''))

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

  // ── Upload de MÚLTIPLOS CSVs GPS (sequencial) ─────────────────────────────
  const uploadMultipleGpsFiles = useCallback(async (files) => {
    if (!files || files.length === 0) return

    const fileArray = Array.from(files)
    const queue = fileArray.map(f => ({
      file: f,
      name: f.name.replace(/\.csv$/i, ''),
      status: 'pending', // pending | uploading | success | error
      message: '',
    }))
    setUploadQueue(queue)

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i]
      setUploadQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'uploading' } : q))

      const formData = new FormData()
      formData.append('file', item.file)
      formData.append('session_name', item.name)

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
      if (res.ok) await fetchGpsSessions()
    } catch (e) {
      console.error('Erro ao deletar sessão:', e)
    }
  }, [fetchGpsSessions])

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
      fetchGpsSessions,
      bemEstarData,
      isLoadingBemEstar,
      bemEstarError,
      fetchBemEstar,
      vmaxBaseline,
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
