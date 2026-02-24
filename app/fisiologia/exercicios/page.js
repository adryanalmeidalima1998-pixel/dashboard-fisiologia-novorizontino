'use client'

import { useRouter } from 'next/navigation'
import { useState, useMemo } from 'react'
import { useData } from '../../context/DataContext'

// ─── BIBLIOTECA DE EXERCÍCIOS (catálogo editável) ─────────────────────────────
const CATEGORIAS = ['Todos', 'Reduzido', 'Inter-setorial', 'Transição', 'Jogo Formal', 'Físico', 'Técnico']

const EXERCICIOS_PADRAO = [
  { id: 1, nome: 'Posse de bola 4x4 (20x20m)', categoria: 'Reduzido', descricao: 'Posse de bola em espaço reduzido, foco em pressão e transições', mMin: 70, hsrMin: 2.5, accDecMin: 1.2, wcs: 8, jogadores: '8–10' },
  { id: 2, nome: 'Posse de bola 6x6 (30x30m)', categoria: 'Reduzido', descricao: 'Maior espaço, mais corrida, menos contato', mMin: 80, hsrMin: 3.5, accDecMin: 1.0, wcs: 9, jogadores: '12–14' },
  { id: 3, nome: 'Jogo reduzido 5x5+2 (35x25m)', categoria: 'Reduzido', descricao: 'Jokers, criar superioridade, transição rápida', mMin: 85, hsrMin: 4.2, accDecMin: 1.3, wcs: 10, jogadores: '12' },
  { id: 4, nome: 'Jogo inter-setorial (50x40m)', categoria: 'Inter-setorial', descricao: 'Defesa x Meio, pressão alta, organização defensiva', mMin: 90, hsrMin: 5.5, accDecMin: 1.5, wcs: 12, jogadores: '14–16' },
  { id: 5, nome: 'Jogo inter-setorial (60x50m)', categoria: 'Inter-setorial', descricao: 'Maior espaço, corrida longa, mais HSR', mMin: 105, hsrMin: 7.0, accDecMin: 1.2, wcs: 13, jogadores: '18–20' },
  { id: 6, nome: 'Transição ofensiva (campo aberto)', categoria: 'Transição', descricao: 'Recuperação de bola e avanço rápido, sprints em linha', mMin: 115, hsrMin: 10.0, accDecMin: 2.0, wcs: 16, jogadores: '10–14' },
  { id: 7, nome: 'Transição defensiva (blocos)', categoria: 'Transição', descricao: 'Bloco defensivo, sprint para retornar posição', mMin: 100, hsrMin: 8.0, accDecMin: 2.5, wcs: 14, jogadores: '10–14' },
  { id: 8, nome: 'Jogo formal 11x11 (campo reduzido)', categoria: 'Jogo Formal', descricao: 'Campo ≈75% do tamanho oficial, menos corrida de cruzeta', mMin: 110, hsrMin: 9.0, accDecMin: 1.1, wcs: 14, jogadores: '22' },
  { id: 9, nome: 'Jogo formal 11x11 (campo oficial)', categoria: 'Jogo Formal', descricao: 'Jogo treino ou amistoso no campo completo', mMin: 118, hsrMin: 12.0, accDecMin: 1.0, wcs: 15, jogadores: '22+' },
  { id: 10, nome: 'Sprints curtos (10–20m)', categoria: 'Físico', descricao: 'Aceleração máxima, baixo volume, foco em qualidade neuromuscular', mMin: 30, hsrMin: 0.5, accDecMin: 3.0, wcs: 6, jogadores: 'Todo o grupo' },
  { id: 11, nome: 'Sprint longo (30–60m)', categoria: 'Físico', descricao: 'Velocidade de cruzeta, alta intensidade máxima', mMin: 40, hsrMin: 2.0, accDecMin: 1.8, wcs: 8, jogadores: 'Todo o grupo' },
  { id: 12, nome: 'Fartlek com bola', categoria: 'Físico', descricao: 'Alternância de ritmos com bola, resistência aeróbia', mMin: 95, hsrMin: 6.0, accDecMin: 0.8, wcs: 11, jogadores: '10–16' },
  { id: 13, nome: 'Rondo 3x1 (8m)', categoria: 'Técnico', descricao: 'Mínima corrida, foco técnico, recuperação ativa', mMin: 25, hsrMin: 0.2, accDecMin: 0.5, wcs: 4, jogadores: '8–12' },
  { id: 14, nome: 'Cruzamento + finalização', categoria: 'Técnico', descricao: 'Sprints periféricos, corrida de ataque, finalizações', mMin: 55, hsrMin: 3.5, accDecMin: 2.2, wcs: 9, jogadores: '10–14' },
]

function SortTh({ label, col, sort, onSort }) {
  const active = sort.col === col
  return (
    <th className="py-2 px-2 font-black uppercase tracking-widest text-[10px] text-slate-500 cursor-pointer hover:text-amber-600 select-none whitespace-nowrap text-left"
      onClick={() => onSort(col)}>
      {label}<span className="text-[8px] ml-0.5 opacity-60">{active ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ' ↕'}</span>
    </th>
  )
}

function intensityColor(val, low, high) {
  if (!val) return 'bg-slate-50 text-slate-400'
  if (val >= high) return 'bg-green-100 text-green-700'
  if (val >= low) return 'bg-amber-100 text-amber-700'
  return 'bg-slate-100 text-slate-500'
}

export default function ExerciciosPage() {
  const router = useRouter()
  const { gpsData } = useData()
  const [categoria, setCategoria] = useState('Todos')
  const [sort, setSort] = useState({ col: 'categoria', dir: 'asc' })
  const [editingId, setEditingId] = useState(null)
  const [exercises, setExercises] = useState(EXERCICIOS_PADRAO)
  const [editForm, setEditForm] = useState({})
  const [showAddModal, setShowAddModal] = useState(false)
  const [newExercise, setNewExercise] = useState({ nome: '', categoria: 'Reduzido', descricao: '', mMin: '', hsrMin: '', accDecMin: '', wcs: '', jogadores: '' })
  const [showCalcModal, setShowCalcModal] = useState(false)
  const [calcExercise, setCalcExercise] = useState(null)
  const [calcDuracao, setCalcDuracao] = useState(20)

  function toggleSort(current, col, setter) {
    setter(current.col === col ? { col, dir: current.dir === 'desc' ? 'asc' : 'desc' } : { col, dir: 'asc' })
  }

  const filtered = useMemo(() => {
    let list = categoria === 'Todos' ? exercises : exercises.filter(e => e.categoria === categoria)
    const { col, dir } = sort
    list = [...list].sort((a, b) => {
      if (col === 'nome' || col === 'categoria') return dir === 'asc' ? a[col].localeCompare(b[col]) : b[col].localeCompare(a[col])
      const va = a[col] ?? 0, vb = b[col] ?? 0
      return dir === 'desc' ? vb - va : va - vb
    })
    return list
  }, [exercises, categoria, sort])

  // Médias GPS reais por categoria (se tivermos dados GPS marcados - usamos médias gerais como proxy)
  const gpsAvgs = useMemo(() => {
    const allRows = gpsData.flatMap(s => s.rows.filter(r => r.periodNumber === 0 && !r.isOutlier))
    if (!allRows.length) return null
    const n = allRows.length
    return {
      mMin: allRows.reduce((s, r) => s + (r.distanceRelative || 0), 0) / n,
      hsr: allRows.reduce((s, r) => s + (r.hsr || 0), 0) / n / 90, // por minuto estimado
      accDec: allRows.reduce((s, r) => s + (r.acceleration || 0) + (r.deceleration || 0), 0) / n / 90,
    }
  }, [gpsData])

  function startEdit(ex) {
    setEditingId(ex.id)
    setEditForm({ ...ex })
  }

  function saveEdit() {
    setExercises(prev => prev.map(e => e.id === editingId ? { ...editForm, id: editingId, mMin: +editForm.mMin, hsrMin: +editForm.hsrMin, accDecMin: +editForm.accDecMin, wcs: +editForm.wcs } : e))
    setEditingId(null)
  }

  function addExercise() {
    const newId = Math.max(...exercises.map(e => e.id)) + 1
    setExercises(prev => [...prev, { ...newExercise, id: newId, mMin: +newExercise.mMin || 0, hsrMin: +newExercise.hsrMin || 0, accDecMin: +newExercise.accDecMin || 0, wcs: +newExercise.wcs || 0 }])
    setShowAddModal(false)
    setNewExercise({ nome: '', categoria: 'Reduzido', descricao: '', mMin: '', hsrMin: '', accDecMin: '', wcs: '', jogadores: '' })
  }

  function removeExercise(id) {
    setExercises(prev => prev.filter(e => e.id !== id))
  }

  const catColors = {
    'Reduzido': 'bg-blue-100 text-blue-700',
    'Inter-setorial': 'bg-purple-100 text-purple-700',
    'Transição': 'bg-amber-100 text-amber-700',
    'Jogo Formal': 'bg-green-100 text-green-700',
    'Físico': 'bg-red-100 text-red-700',
    'Técnico': 'bg-slate-100 text-slate-600',
  }

  return (
    <div className="min-h-screen bg-white text-black p-4 font-sans">
      <div className="max-w-[1600px] mx-auto flex flex-col gap-5">

        {/* HEADER */}
        <header className="flex flex-wrap justify-between items-center border-b-4 border-amber-500 pb-3 gap-3">
          <div className="flex items-center gap-4">
            <img src="/club/escudonovorizontino.png" alt="Escudo" className="h-14 w-auto" />
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-black uppercase leading-none">Biblioteca de Exercícios</h1>
              <p className="text-sm font-bold tracking-widest text-slate-600 uppercase">Catálogo de Prescrição — Custo GPS Esperado</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/fisiologia')} className="bg-slate-200 text-slate-800 px-3 py-1 rounded-md text-xs font-bold hover:bg-slate-300 transition-colors">← VOLTAR</button>
            <button onClick={() => setShowAddModal(true)} className="bg-amber-500 text-black px-3 py-1 rounded-md text-xs font-black hover:bg-amber-400 transition-colors">+ Novo exercício</button>
          </div>
        </header>

        {/* EXPLICAÇÃO */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-black uppercase tracking-widest text-amber-700 mb-2">Como usar este catálogo</p>
          <p className="text-xs text-slate-600 leading-relaxed">
            Cada exercício tem custo GPS <strong>por minuto</strong> estimado. Multiplique pelos minutos planejados para estimar a carga total da sessão.
            Use o botão <strong>"Calcular"</strong> para simular uma tarefa com a duração desejada e visualizar o custo esperado.
            Edite os valores com base nos dados reais do seu banco GPS.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Exercícios</p>
            <p className="text-2xl font-black">{exercises.length}</p>
            <p className="text-[10px] text-slate-500">no catálogo</p>
          </div>
          {gpsAvgs && (
            <>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">m/min real médio</p>
                <p className="text-2xl font-black text-amber-600">{gpsAvgs.mMin.toFixed(0)}</p>
                <p className="text-[10px] text-slate-500">do banco GPS</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">HSR/min real</p>
                <p className="text-2xl font-black text-amber-600">{gpsAvgs.hsr.toFixed(2)}</p>
                <p className="text-[10px] text-slate-500">do banco GPS (est. 90min)</p>
              </div>
            </>
          )}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Categorias</p>
            <p className="text-2xl font-black text-blue-600">{CATEGORIAS.length - 1}</p>
            <p className="text-[10px] text-slate-500">tipos de tarefa</p>
          </div>
        </div>

        {/* FILTROS */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 shrink-0">Categoria:</span>
          {CATEGORIAS.map(c => (
            <button key={c} onClick={() => setCategoria(c)}
              className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${categoria === c ? 'bg-amber-500 text-black' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {c}
            </button>
          ))}
        </div>

        {/* TABELA */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-slate-900 bg-slate-50">
                  <SortTh label="Exercício" col="nome" sort={sort} onSort={c => toggleSort(sort, c, setSort)} />
                  <SortTh label="Categoria" col="categoria" sort={sort} onSort={c => toggleSort(sort, c, setSort)} />
                  <th className="text-left py-2 px-2 font-black uppercase tracking-widest text-[10px] text-slate-500 whitespace-nowrap">Jogadores</th>
                  <SortTh label="m/min" col="mMin" sort={sort} onSort={c => toggleSort(sort, c, setSort)} />
                  <SortTh label="HSR/min (m)" col="hsrMin" sort={sort} onSort={c => toggleSort(sort, c, setSort)} />
                  <SortTh label="ACC+DEC/min" col="accDecMin" sort={sort} onSort={c => toggleSort(sort, c, setSort)} />
                  <SortTh label="WCS (PL)" col="wcs" sort={sort} onSort={c => toggleSort(sort, c, setSort)} />
                  <th className="text-left py-2 px-2 font-black uppercase tracking-widest text-[10px] text-slate-500">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(ex => (
                  <tr key={ex.id} className="border-b border-slate-100 hover:bg-amber-50">
                    {editingId === ex.id ? (
                      // Modo edição inline
                      <>
                        <td className="py-1.5 px-2" colSpan={2}>
                          <input value={editForm.nome} onChange={e => setEditForm(p => ({ ...p, nome: e.target.value }))}
                            className="border border-amber-400 rounded px-2 py-0.5 text-xs font-bold w-full" />
                        </td>
                        <td className="py-1.5 px-2">
                          <select value={editForm.categoria} onChange={e => setEditForm(p => ({ ...p, categoria: e.target.value }))}
                            className="border border-slate-200 rounded px-2 py-0.5 text-xs w-full">
                            {CATEGORIAS.slice(1).map(c => <option key={c}>{c}</option>)}
                          </select>
                        </td>
                        {['mMin', 'hsrMin', 'accDecMin', 'wcs'].map(f => (
                          <td key={f} className="py-1.5 px-2">
                            <input type="number" value={editForm[f]} onChange={e => setEditForm(p => ({ ...p, [f]: e.target.value }))}
                              className="border border-slate-200 rounded px-2 py-0.5 text-xs font-bold w-16" />
                          </td>
                        ))}
                        <td className="py-1.5 px-2">
                          <button onClick={saveEdit} className="bg-amber-500 text-black px-2 py-0.5 rounded text-[10px] font-black mr-1 hover:bg-amber-400">✓</button>
                          <button onClick={() => setEditingId(null)} className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] font-black hover:bg-slate-300">✕</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 px-2">
                          <p className="font-black text-black">{ex.nome}</p>
                          {ex.descricao && <p className="text-[9px] text-slate-400 font-medium mt-0.5">{ex.descricao}</p>}
                        </td>
                        <td className="py-2 px-2"><span className={`text-[10px] font-black px-2 py-0.5 rounded-lg uppercase ${catColors[ex.categoria] || 'bg-slate-100 text-slate-500'}`}>{ex.categoria}</span></td>
                        <td className="py-2 px-2 text-slate-600 font-bold">{ex.jogadores}</td>
                        <td className="py-2 px-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${intensityColor(ex.mMin, 70, 100)}`}>{ex.mMin}</span>
                        </td>
                        <td className="py-2 px-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${intensityColor(ex.hsrMin, 3, 7)}`}>{ex.hsrMin}</span>
                        </td>
                        <td className="py-2 px-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${intensityColor(ex.accDecMin, 1, 2)}`}>{ex.accDecMin}</span>
                        </td>
                        <td className="py-2 px-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${intensityColor(ex.wcs, 8, 13)}`}>{ex.wcs}</span>
                        </td>
                        <td className="py-2 px-2">
                          <button onClick={() => { setCalcExercise(ex); setShowCalcModal(true) }} className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[9px] font-black hover:bg-amber-200 mr-1">Calcular</button>
                          <button onClick={() => startEdit(ex)} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px] font-black hover:bg-slate-200 mr-1">Editar</button>
                          <button onClick={() => removeExercise(ex.id)} className="bg-red-50 text-red-400 px-2 py-0.5 rounded text-[9px] font-black hover:bg-red-100">✕</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL CALCULAR */}
        {showCalcModal && calcExercise && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl border-2 border-slate-200 p-6 w-full max-w-md mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-black uppercase tracking-tighter">Simular carga</h3>
                <button onClick={() => setShowCalcModal(false)} className="text-slate-400 font-black text-lg">✕</button>
              </div>
              <p className="text-xs font-black text-black mb-4">{calcExercise.nome}</p>
              <div className="mb-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Duração (min)</label>
                <input type="number" value={calcDuracao} onChange={e => setCalcDuracao(+e.target.value)} min={1} max={120}
                  className="border-2 border-amber-500 rounded-lg px-3 py-2 text-lg font-black w-full focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Distância', value: (calcExercise.mMin * calcDuracao).toFixed(0), unit: 'm' },
                  { label: 'HSR total', value: (calcExercise.hsrMin * calcDuracao).toFixed(0), unit: 'm' },
                  { label: 'ACC+DEC total', value: (calcExercise.accDecMin * calcDuracao).toFixed(0), unit: '' },
                  { label: 'WCS (Player Load)', value: calcExercise.wcs, unit: '/min × ' + calcDuracao + 'min' },
                ].map(item => (
                  <div key={item.label} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">{item.label}</p>
                    <p className="text-xl font-black text-black">{item.value}</p>
                    <p className="text-[9px] text-slate-400 font-medium">{item.unit}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-[9px] font-black text-amber-700 uppercase mb-1">Custo total estimado</p>
                <p className="text-xs text-slate-600">{calcExercise.mMin * calcDuracao}m distância · {(calcExercise.hsrMin * calcDuracao).toFixed(0)}m HSR · {(calcExercise.accDecMin * calcDuracao).toFixed(0)} ações ACC/DEC</p>
              </div>
            </div>
          </div>
        )}

        {/* MODAL NOVO EXERCÍCIO */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl border-2 border-slate-200 p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-black uppercase tracking-tighter">Novo Exercício</h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 font-black text-lg">✕</button>
              </div>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Nome', key: 'nome', type: 'text' },
                  { label: 'Descrição', key: 'descricao', type: 'text' },
                  { label: 'Jogadores', key: 'jogadores', type: 'text' },
                  { label: 'm/min típico', key: 'mMin', type: 'number' },
                  { label: 'HSR/min (m)', key: 'hsrMin', type: 'number' },
                  { label: 'ACC+DEC/min', key: 'accDecMin', type: 'number' },
                  { label: 'WCS / Player Load', key: 'wcs', type: 'number' },
                ].map(({ label, key, type }) => (
                  <div key={key}>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">{label}</label>
                    <input type={type} value={newExercise[key]} onChange={e => setNewExercise(p => ({ ...p, [key]: e.target.value }))}
                      className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold w-full focus:border-amber-400 focus:outline-none" />
                  </div>
                ))}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Categoria</label>
                  <select value={newExercise.categoria} onChange={e => setNewExercise(p => ({ ...p, categoria: e.target.value }))}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold w-full focus:border-amber-400 focus:outline-none">
                    {CATEGORIAS.slice(1).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <button onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-black uppercase rounded-xl hover:bg-slate-200">Cancelar</button>
                <button onClick={addExercise} disabled={!newExercise.nome} className="px-5 py-2 bg-amber-500 text-black text-xs font-black uppercase rounded-xl hover:bg-amber-400 disabled:opacity-40">Salvar</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
