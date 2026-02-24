'use client'

import { useRouter } from 'next/navigation'
import { useData } from '../context/DataContext'
import { useEffect, useState, useRef } from 'react'

export default function Fisiologia() {
  const router = useRouter()
  const {
    gpsData, isLoadingGps, uploadStatus, uploadQueue, uploadGpsFile, uploadMultipleGpsFiles, deleteGpsSession,
    bemEstarData, isLoadingBemEstar, fetchBemEstar,
  } = useData()
  const [dragOver, setDragOver] = useState(false)
  const [pendingFiles, setPendingFiles] = useState([])   // array de { file, name }
  const [editingIdx, setEditingIdx] = useState(null)
  const nameInputRef = useRef(null)

  useEffect(() => {
    if (bemEstarData.length === 0) fetchBemEstar()
  }, [])

  // Quando arquivos são selecionados, abre modal de confirmação
  function handleFilesSelect(files) {
    if (!files || files.length === 0) return
    const validFiles = Array.from(files).filter(f => f.name.endsWith('.csv'))
    if (validFiles.length === 0) return
    setPendingFiles(validFiles.map(f => ({ file: f, name: f.name.replace(/\.csv$/i, '') })))
    setEditingIdx(null)
  }

  async function confirmUpload() {
    if (pendingFiles.length === 0) return
    if (pendingFiles.length === 1) {
      await uploadGpsFile(pendingFiles[0].file, pendingFiles[0].name)
    } else {
      const filesWithNames = pendingFiles.map(p => {
        const dt = new DataTransfer()
        dt.items.add(p.file)
        return { file: p.file, name: p.name }
      })
      // Usa uploadMultipleGpsFiles mas com nomes personalizados
      const namedFiles = pendingFiles.map(p => {
        const renamed = new File([p.file], p.name + '.csv', { type: p.file.type })
        return renamed
      })
      await uploadMultipleGpsFiles(namedFiles)
    }
    setPendingFiles([])
    setEditingIdx(null)
  }

  function cancelUpload() {
    setPendingFiles([])
    setEditingIdx(null)
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
      descricao: 'Histórico completo por atleta. Tendências de bem-estar, carga GPS e alertas personalizados.',
      rota: '/fisiologia/individual',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
  ]

  const isUploading = uploadQueue.some(q => q.status === 'uploading')

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
            </div>

            {/* Fila de upload múltiplo */}
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

            {/* Lista de sessões */}
            {gpsData.length > 0 && (
              <div className="mt-3 flex flex-col gap-0.5 max-h-40 overflow-y-auto">
                {Object.entries(
                  gpsData.reduce((acc, s) => {
                    acc[s.date] = acc[s.date] || []
                    acc[s.date].push(s)
                    return acc
                  }, {})
                ).slice(0, 6).map(([date, sessions]) => (
                  <div key={date}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 pt-1.5 pb-0.5">{date}</p>
                    {sessions.map(s => (
                      <div key={s.id} className="flex items-center justify-between py-1 pl-2 border-l-2 border-amber-200">
                        <span className="text-[10px] font-bold text-slate-700 truncate max-w-[200px]">{s.name}</span>
                        <button onClick={() => deleteGpsSession(s.id)} className="text-[9px] text-red-400 hover:text-red-600 font-black px-1.5 transition-colors ml-2" title="Remover">✕</button>
                      </div>
                    ))}
                  </div>
                ))}
                {gpsData.length > 6 && <p className="text-[9px] text-slate-400 font-medium pt-1">+{gpsData.length - 6} mais...</p>}
              </div>
            )}

            {gpsData.length === 0 && !uploadStatus && uploadQueue.length === 0 && (
              <p className="mt-2 text-[10px] text-slate-400 font-medium">Arraste um ou mais .csv ou clique em "Upload CSV(s)" — você pode selecionar vários de uma vez</p>
            )}
          </div>
        </div>

        {/* MODAL DE CONFIRMAÇÃO DE ARQUIVOS */}
        {pendingFiles.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl border-2 border-slate-200 p-6 w-full max-w-lg mx-4">
              <h3 className="text-base font-black uppercase tracking-tighter text-black mb-1">
                {pendingFiles.length === 1 ? 'Nome da Sessão' : `${pendingFiles.length} Sessões para Upload`}
              </h3>
              <p className="text-xs text-slate-500 font-medium mb-4">
                {pendingFiles.length === 1
                  ? 'Edite o nome para identificar esta sessão'
                  : 'Edite os nomes clicando em cada um. Confirme para enviar todos.'}
              </p>

              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto mb-4">
                {pendingFiles.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-black w-5 text-right">{i + 1}.</span>
                    {editingIdx === i ? (
                      <input
                        autoFocus
                        type="text"
                        value={p.name}
                        onChange={e => setPendingFiles(prev => prev.map((f, idx) => idx === i ? { ...f, name: e.target.value } : f))}
                        onBlur={() => setEditingIdx(null)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingIdx(null) }}
                        className="flex-1 border-2 border-amber-400 rounded-lg px-3 py-1.5 text-xs font-bold text-black focus:outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingIdx(i)}
                        className="flex-1 text-left border border-slate-200 hover:border-amber-400 rounded-lg px-3 py-1.5 text-xs font-bold text-black transition-colors"
                      >
                        {p.name}
                        <span className="ml-2 text-[9px] text-slate-400">✏</span>
                      </button>
                    )}
                    <button
                      onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-red-400 hover:text-red-600 font-black text-xs px-1"
                    >✕</button>
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

        {/* GRID DE FERRAMENTAS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
              Bem-estar via Google Sheets · GPS via Catapult CSV · CMJ em breve
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-black italic tracking-tight uppercase">© Fisiologia GN</p>
        </footer>

      </div>
    </div>
  )
}
