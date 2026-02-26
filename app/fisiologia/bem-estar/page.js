'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo, useEffect } from 'react'
import { useData } from '../../context/DataContext'
import { AthleteAvatar } from '../../utils/athletePhotos'

const DOR_LABELS = {
  '1': 'Anterior Coxa D', '2': 'Anterior Coxa E', '3': 'Adutor Coxa D', '4': 'Adutor Coxa E',
  '5': 'Tibial Ant. D', '6': 'Tibial Ant. E', '7': 'Post. Coxa D', '8': 'Post. Coxa E',
  '9': 'Panturrilha D', '10': 'Panturrilha E', '11': 'Glúteo E', '12': 'Glúteo D',
  '13': 'Flex. Quadril D', '14': 'Flex. Quadril E', '15': 'Peitoral D', '16': 'Peitoral E',
  '17': 'Dorso E', '18': 'Dorso D', '19': 'Bíceps D', '20': 'Bíceps E',
  '21': 'Tríceps E', '22': 'Tríceps D',
  'A': 'Abdome', 'B': 'Joelho Ant. D', 'C': 'Joelho Ant. E', 'D': 'Tornozelo D', 'E': 'Tornozelo E',
  'F': 'Lombar', 'G': 'Joelho Post. E', 'H': 'Joelho Post. D', 'I': 'Tendão Calc. E', 'J': 'Tendão Calc. D',
  'L': 'Deltoide D', 'M': 'Deltoide E', 'N': 'Punho D', 'O': 'Punho E',
  'P': 'Cervical', 'Q': 'Cotovelo E', 'R': 'Cotovelo D',
}

function scoreColor(score) {
  if (!score) return 'bg-slate-100 text-slate-400'
  if (score >= 3.5) return 'bg-green-100 text-green-700'
  if (score >= 2.5) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

function scoreBg(score) {
  if (!score) return 'bg-slate-50'
  if (score >= 3.5) return 'bg-green-50'
  if (score >= 2.5) return 'bg-amber-50'
  return 'bg-red-50'
}

function urinaColor(val) {
  if (!val) return 'bg-slate-100 text-slate-400'
  if (val <= 2) return 'bg-green-100 text-green-700'
  if (val <= 3) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

function MetricBar({ value, max = 5, invert = false, label }) {
  if (!value) return <span className="text-slate-300 font-black">—</span>
  const pct = invert ? ((max + 1 - value) / max) * 100 : (value / max) * 100
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex flex-col items-center gap-0.5 w-full">
      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      <div className="w-full bg-slate-100 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] font-black text-slate-600">{value}</span>
    </div>
  )
}

export default function BemEstarPage() {
  const router = useRouter()
  const { bemEstarData, isLoadingBemEstar, fetchBemEstar, playerPositions } = useData()
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedAtleta, setSelectedAtleta] = useState('Todos')
  const [filterPosition, setFilterPosition] = useState('')
  const [activeTab, setActiveTab] = useState('pre') // 'pre' | 'post' | 'dor'
  const [lastUpdated, setLastUpdated] = useState(null)

  const availablePositions = useMemo(() => {
    const set = new Set(Object.values(playerPositions).filter(Boolean))
    return Array.from(set).sort()
  }, [playerPositions])

  // Sempre rebusca ao entrar na página para pegar respostas novas
  useEffect(() => {
    fetchBemEstar()
  }, [])

  // Auto-refresh a cada 30 segundos: atletas respondem e o dash atualiza sozinho
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBemEstar()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // Datas disponíveis
  const dates = useMemo(() => {
    const d = [...new Set(bemEstarData.map(r => r.date))].sort().reverse()
    return d
  }, [bemEstarData])

  // Atletas disponíveis
  const atletas = useMemo(() => {
    return ['Todos', ...[...new Set(bemEstarData.map(r => r.playerName))].sort()]
  }, [bemEstarData])

  // Data selecionada padrão = mais recente
  const currentDate = selectedDate || dates[0] || ''

  // Filtrar por data e atleta
  const filtered = useMemo(() => {
    return bemEstarData.filter(r => {
      if (r.date !== currentDate) return false
      if (selectedAtleta !== 'Todos' && r.playerName !== selectedAtleta) return false
      if (filterPosition && playerPositions[r.playerName] !== filterPosition) return false
      return true
    })
  }, [bemEstarData, currentDate, selectedAtleta, filterPosition, playerPositions])

  const preData = filtered.filter(r => r.type === 'pre')
  const postData = filtered.filter(r => r.type === 'post')

  // Estatísticas do dia
  const stats = useMemo(() => {
    const scores = preData.map(r => r.wellnessScore).filter(Boolean)
    const alertas = preData.filter(r => r.wellnessScore < 2.5 || r.temDor || r.corUrina >= 4)
    const comDor = preData.filter(r => r.temDor)
    const media = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
    const srpes = postData.map(r => r.srpe).filter(Boolean)
    const mediaSrpe = srpes.length > 0 ? srpes.reduce((a, b) => a + b, 0) / srpes.length : null
    // Total = atletas únicos que responderam qualquer formulário no dia
    const nomesUnicos = new Set([...preData.map(r => r.playerName), ...postData.map(r => r.playerName)])
    return { total: nomesUnicos.size, preTotal: preData.length, postTotal: postData.length, alertas: alertas.length, comDor: comDor.length, media, mediaSrpe }
  }, [preData, postData])

  // Atletas com dor (para aba dor)
  const atletasComDor = useMemo(() => {
    return preData.filter(r => r.temDor && r.dorLocalizada)
  }, [preData])

  return (
    <div className="min-h-screen bg-white text-black p-4 font-sans">
      <div className="max-w-[1400px] mx-auto flex flex-col gap-5">

        {/* HEADER */}
        <header className="flex justify-between items-center border-b-4 border-amber-500 pb-3">
          <div className="flex items-center gap-4">
            <img src="/club/escudonovorizontino.png" alt="Escudo" className="h-14 w-auto" />
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-black uppercase leading-none">Bem-Estar & sRPE</h1>
              <p className="text-sm font-bold tracking-widest text-slate-600 uppercase">Monitoramento de Prontidão</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/fisiologia')} className="bg-slate-200 text-slate-800 px-3 py-1 rounded-md text-xs font-bold hover:bg-slate-300 transition-colors">
              ← VOLTAR
            </button>
            <div className="flex flex-col items-end gap-0.5">
              <button onClick={async () => { await fetchBemEstar(); setLastUpdated(new Date()) }} disabled={isLoadingBemEstar} className="bg-amber-500 text-black px-3 py-1 rounded-md text-xs font-black hover:bg-amber-400 transition-colors disabled:opacity-50">
                {isLoadingBemEstar ? '⟳ Carregando...' : '↻ Atualizar'}
              </button>
              {lastUpdated && <span className="text-[9px] text-slate-400 font-medium">atualizado {lastUpdated.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>}
            </div>
          </div>
        </header>

        {/* FILTROS */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Data:</span>
            <select
              value={currentDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-black bg-white focus:border-amber-500 focus:outline-none"
            >
              {dates.map(d => (
                <option key={d} value={d}>
                  {new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Atleta:</span>
            <select
              value={selectedAtleta}
              onChange={e => setSelectedAtleta(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-black bg-white focus:border-amber-500 focus:outline-none"
            >
              {atletas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {availablePositions.length > 0 && selectedAtleta === 'Todos' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Posição:</span>
              <select
                value={filterPosition}
                onChange={e => setFilterPosition(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-black bg-white focus:border-amber-500 focus:outline-none"
              >
                <option value="">Todas</option>
                {availablePositions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* RESUMO */}
        {(preData.length > 0 || postData.length > 0) && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Responderam</p>
              <p className="text-2xl font-black text-black">{stats.total}</p>
              <p className="text-[10px] text-slate-500">{stats.preTotal} pré · {stats.postTotal} pós</p>
            </div>
            <div className={`border rounded-xl p-3 ${stats.alertas > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Alertas</p>
              <p className={`text-2xl font-black ${stats.alertas > 0 ? 'text-red-600' : 'text-green-600'}`}>{stats.alertas}</p>
              <p className="text-[10px] text-slate-500">score {'<'} 2.5 / dor / desidrat.</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Média Wellness</p>
              <p className={`text-2xl font-black ${!stats.media ? 'text-slate-400' : stats.media >= 3.5 ? 'text-green-600' : stats.media >= 2.5 ? 'text-amber-600' : 'text-red-600'}`}>
                {stats.media ? stats.media.toFixed(1) : '—'}
              </p>
              <p className="text-[10px] text-slate-500">escala 1–5</p>
            </div>
            <div className={`border rounded-xl p-3 ${stats.comDor > 0 ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200'}`}>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Com Dor</p>
              <p className={`text-2xl font-black ${stats.comDor > 0 ? 'text-orange-600' : 'text-slate-400'}`}>{stats.comDor}</p>
              <p className="text-[10px] text-slate-500">dor localizada</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Média sRPE</p>
              <p className="text-2xl font-black text-black">{stats.mediaSrpe ? stats.mediaSrpe.toFixed(1) : '—'}</p>
              <p className="text-[10px] text-slate-500">percepção esforço</p>
            </div>
          </div>
        )}

        {/* ABAS */}
        <div className="flex gap-2 border-b border-slate-200">
          {[
            { id: 'pre', label: `Pré-Atividade (${preData.length})` },
            { id: 'post', label: `Pós-Atividade / sRPE (${postData.length})` },
            { id: 'dor', label: `Dor Localizada (${atletasComDor.length})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-black uppercase tracking-widest border-b-2 transition-all -mb-px ${activeTab === tab.id ? 'border-amber-500 text-black' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* CONTEÚDO - PRÉ */}
        {activeTab === 'pre' && (
          <div>
            {preData.length === 0 ? (
              <div className="text-center py-16 text-slate-400 font-black uppercase text-sm">Sem registros pré-atividade nesta data</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {preData.sort((a, b) => (a.wellnessScore || 5) - (b.wellnessScore || 5)).map((r, i) => {
                  const hasAlert = (r.wellnessScore && r.wellnessScore < 2.5) || r.temDor || (r.corUrina >= 4)
                  return (
                    <div key={i} className={`border-2 rounded-xl p-4 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-center gap-2.5 mb-3">
                        <AthleteAvatar name={r.playerName} size="w-9 h-9" ring={!hasAlert} className={hasAlert ? 'ring-2 ring-red-400 ring-offset-1' : ''} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black uppercase tracking-tighter text-black leading-tight truncate">{r.playerName}</p>
                          <div className={`mt-0.5 inline-flex px-1.5 py-0.5 rounded text-[9px] font-black ${scoreColor(r.wellnessScore)}`}>
                            {r.wellnessScore ? r.wellnessScore.toFixed(1) : '—'}
                          </div>
                        </div>
                      </div>

                      {/* Barras de métricas */}
                      <div className="grid grid-cols-5 gap-1 mb-3">
                        <MetricBar label="Sono" value={r.sono} max={5} />
                        <MetricBar label="Fadiga" value={r.fadiga} max={5} invert />
                        <MetricBar label="DOMS" value={r.doms} max={5} invert />
                        <MetricBar label="Stress" value={r.estresse} max={5} invert />
                        <MetricBar label="Humor" value={r.humor} max={5} />
                      </div>

                      {/* Hidratação */}
                      {r.corUrina && (
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider mb-2 ${urinaColor(r.corUrina)}`}>
                          💧 Urina {r.corUrina}/8
                        </div>
                      )}

                      {/* Dor */}
                      {r.temDor && r.dorLocalizada && (
                        <div className="bg-red-50 border border-red-200 rounded-lg px-2 py-1 mt-1">
                          <p className="text-[9px] font-black text-red-600 uppercase mb-0.5">🩹 Dor</p>
                          <p className="text-[10px] text-red-700 font-medium">{r.dorLocalizada}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* CONTEÚDO - PÓS */}
        {activeTab === 'post' && (
          <div>
            {postData.length === 0 ? (
              <div className="text-center py-16 text-slate-400 font-black uppercase text-sm">Sem registros pós-atividade nesta data</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {postData.sort((a, b) => (b.srpe || 0) - (a.srpe || 0)).map((r, i) => (
                  <div key={i} className="border-2 border-slate-200 rounded-xl p-4 bg-white">
                    <div className="flex items-center gap-2.5 mb-3">
                      <AthleteAvatar name={r.playerName} size="w-9 h-9" ring />
                      <p className="text-xs font-black uppercase tracking-tighter text-black leading-tight truncate">{r.playerName}</p>
                    </div>

                    {/* sRPE */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">sRPE</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-black ${!r.srpe ? 'text-slate-300' : r.srpe >= 8 ? 'text-red-600' : r.srpe >= 5 ? 'text-amber-600' : 'text-green-600'}`}>
                          {r.srpe ?? '—'}
                        </span>
                        {r.srpe && (
                          <span className="text-[9px] text-slate-400 font-black">
                            {r.srpe <= 2 ? 'Muito Fraco' : r.srpe <= 4 ? 'Moderado' : r.srpe <= 6 ? 'Forte' : r.srpe <= 8 ? 'Muito Forte' : 'Máximo'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Carga (UA) */}
                    {r.srpeLoad && (
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Carga (UA)</span>
                        <span className="text-sm font-black text-black">{r.srpeLoad.toFixed(0)}</span>
                      </div>
                    )}

                    {/* Duração */}
                    {r.duracaoSessao && (
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Duração</span>
                        <span className="text-sm font-black text-black">{r.duracaoSessao} min</span>
                      </div>
                    )}

                    {/* Barra visual sRPE */}
                    {r.srpe && (
                      <div className="mt-2 w-full bg-slate-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${r.srpe >= 8 ? 'bg-red-500' : r.srpe >= 5 ? 'bg-amber-500' : 'bg-green-500'}`}
                          style={{ width: `${(r.srpe / 10) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CONTEÚDO - DOR */}
        {activeTab === 'dor' && (
          <div>
            {atletasComDor.length === 0 ? (
              <div className="text-center py-16 text-green-600 font-black uppercase text-sm">✓ Nenhum atleta com dor localizada nesta data</div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Mapa de frequência de dor */}
                <div className="border-2 border-orange-200 bg-orange-50 rounded-xl p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-orange-700 mb-3">Regiões mais afetadas</p>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const freq = {}
                      atletasComDor.forEach(r => {
                        r.dorLocalizada.split(',').forEach(d => {
                          const key = d.trim()
                          if (key) freq[key] = (freq[key] || 0) + 1
                        })
                      })
                      return Object.entries(freq)
                        .sort((a, b) => b[1] - a[1])
                        .map(([key, count]) => (
                          <div key={key} className="flex items-center gap-1 bg-white border border-orange-200 rounded-lg px-2 py-1">
                            <span className="text-xs font-black text-orange-800">{DOR_LABELS[key] || key}</span>
                            <span className="bg-orange-500 text-white text-[9px] font-black px-1.5 rounded-full">{count}</span>
                          </div>
                        ))
                    })()}
                  </div>
                </div>

                {/* Lista por atleta */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {atletasComDor.map((r, i) => (
                    <div key={i} className="border-2 border-red-200 bg-red-50 rounded-xl p-4">
                      <div className="flex items-center gap-2.5 mb-2">
                        <AthleteAvatar name={r.playerName} size="w-9 h-9" className="ring-2 ring-red-400 ring-offset-1" />
                        <p className="text-xs font-black uppercase tracking-tighter text-red-800 truncate">{r.playerName}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {r.dorLocalizada.split(',').map(d => d.trim()).filter(Boolean).map((d, j) => (
                          <span key={j} className="bg-white border border-red-200 text-red-700 text-[10px] font-black px-2 py-0.5 rounded-lg">
                            {DOR_LABELS[d] || d}
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[9px] text-slate-500 font-bold">Wellness:</span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${scoreColor(r.wellnessScore)}`}>
                          {r.wellnessScore ? r.wellnessScore.toFixed(1) : '—'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Estado vazio */}
        {bemEstarData.length === 0 && !isLoadingBemEstar && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Sem dados de bem-estar</p>
            <p className="text-xs text-slate-400 mt-1 font-medium">Clique em "Atualizar" para carregar do Google Sheets</p>
          </div>
        )}

        {/* FOOTER */}
        <footer className="flex justify-between items-center border-t-2 border-slate-900 pt-3 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              Dados via Google Sheets · Wellness = média(sono, 6-fadiga, 6-doms, 6-estresse, humor) · Auto-refresh 30s
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-black italic tracking-tight uppercase">© Fisiologia GN</p>
        </footer>

      </div>
    </div>
  )
}
