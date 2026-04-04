'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useRef, useCallback } from 'react'
import { useData } from '../../context/DataContext'
import { AthleteAvatar, compressAndSave, getCustomPhoto, getStaticPhoto, photoStorageKey } from '../../utils/athletePhotos'

export default function FotosAtletas() {
  const router = useRouter()
  const { gpsData, bemEstarData } = useData()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('todos') // 'todos' | 'com_foto' | 'sem_foto'
  const [tick, setTick] = useState(0) // força re-render ao salvar

  // Todos os atletas únicos (GPS + Bem-Estar)
  const allAthletes = useMemo(() => {
    const names = new Set()
    for (const s of gpsData)
      for (const r of s.rows)
        if (r.playerName && r.periodNumber === 0 && !r.isOutlier) names.add(r.playerName)
    for (const r of bemEstarData)
      if (r.playerName) names.add(r.playerName)
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [gpsData, bemEstarData])

  // Re-render quando uma foto for salva em qualquer card
  const handlePhotoSaved = useCallback(() => setTick(t => t + 1), [])

  const withPhoto    = allAthletes.filter(n => getCustomPhoto(n) || getStaticPhoto(n))
  const withoutPhoto = allAthletes.filter(n => !getCustomPhoto(n) && !getStaticPhoto(n))

  const filtered = allAthletes
    .filter(n => {
      if (filter === 'com_foto')  return getCustomPhoto(n) || getStaticPhoto(n)
      if (filter === 'sem_foto')  return !getCustomPhoto(n) && !getStaticPhoto(n)
      return true
    })
    .filter(n => !search.trim() || n.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div className="min-h-screen bg-white text-black p-4 font-sans">
      <div className="max-w-[1400px] mx-auto flex flex-col gap-5">

        {/* HEADER */}
        <header className="flex justify-between items-center border-b-4 border-amber-500 pb-3">
          <div className="flex items-center gap-4">
            <img src="/club/escudonovorizontino.png" alt="Escudo" className="h-14 w-auto" />
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-black uppercase leading-none">Fotos dos Atletas</h1>
              <p className="text-sm font-bold tracking-widest text-slate-600 uppercase">Inserir e Gerenciar</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/fisiologia')}
            className="bg-slate-200 text-slate-800 px-3 py-1 rounded-md text-xs font-bold hover:bg-slate-300 transition-colors"
          >
            ← VOLTAR
          </button>
        </header>

        {/* INSTRUÇÃO */}
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex items-start gap-3">
          <span className="text-2xl">📸</span>
          <div>
            <p className="text-sm font-black text-amber-900 uppercase tracking-wide">Como usar</p>
            <p className="text-sm text-amber-800 mt-0.5">
              Clique na foto (ou no círculo com as iniciais) de qualquer atleta para inserir ou trocar a imagem.
              Funciona também em todos os outros cards e tabelas do sistema — o avatar fica clicável em qualquer tela.
            </p>
            <p className="text-xs text-amber-600 mt-1 font-bold">
              Fotos ficam salvas neste dispositivo. Formatos aceitos: JPG, PNG, WEBP. Imagens são redimensionadas automaticamente.
            </p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Total de atletas</p>
            <p className="text-2xl font-black text-black">{allAthletes.length}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Com foto</p>
            <p className="text-2xl font-black text-green-700">{withPhoto.length}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Sem foto</p>
            <p className="text-2xl font-black text-red-600">{withoutPhoto.length}</p>
          </div>
        </div>

        {/* FILTROS */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar atleta..."
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold bg-white focus:border-amber-400 focus:outline-none min-w-[200px]"
          />
          <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
            {[
              { id: 'todos',     label: 'Todos'     },
              { id: 'com_foto',  label: '✅ Com foto' },
              { id: 'sem_foto',  label: '❌ Sem foto' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wide transition-all ${
                  filter === f.id ? 'bg-amber-500 text-black shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-auto">
            {filtered.length} atleta(s)
          </span>
        </div>

        {/* GRID DE ATLETAS */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 font-medium text-sm">
            Nenhum atleta encontrado. Carregue GPS ou bem-estar para popular a lista.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {filtered.map(name => (
              <AthleteCard key={name} name={name} onSaved={handlePhotoSaved} tick={tick} />
            ))}
          </div>
        )}

        {/* FOOTER */}
        <footer className="flex justify-between items-center border-t-2 border-slate-900 pt-3 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              Fotos salvas localmente neste dispositivo · Não requer upload para servidor
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-black italic tracking-tight uppercase">© Fisiologia GN</p>
        </footer>

      </div>
    </div>
  )
}

// ── Card individual do atleta ──────────────────────────────────────────────────
function AthleteCard({ name, onSaved }) {
  const [customPhoto, setCustomPhoto] = useState(() => getCustomPhoto(name))
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const fileRef = useRef(null)

  const hasCustom = !!customPhoto
  const hasStatic = !!getStaticPhoto(name)
  const hasAnyPhoto = hasCustom || hasStatic

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setSaving(true)
    compressAndSave(name, file, (url) => {
      setCustomPhoto(url)
      setSaving(false)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2000)
      if (onSaved) onSaved()
    })
    e.target.value = ''
  }

  const displayPhoto = customPhoto || getStaticPhoto(name)
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
  const shortName = name.split(' ').slice(0, 2).join(' ')

  return (
    <div className="flex flex-col items-center gap-2 p-3 rounded-xl border border-slate-100 hover:border-amber-300 hover:shadow-md transition-all bg-white group">

      {/* Avatar grande e clicável */}
      <div
        className="relative w-20 h-20 cursor-pointer flex-shrink-0"
        onClick={() => fileRef.current?.click()}
        title={hasAnyPhoto ? 'Clique para trocar a foto' : 'Clique para inserir a foto'}
      >
        {displayPhoto ? (
          <img
            src={displayPhoto}
            alt={name}
            className="w-20 h-20 rounded-full object-cover object-top border-2 border-slate-200 group-hover:border-amber-400 transition-all"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-slate-200 group-hover:bg-amber-50 border-2 border-slate-200 group-hover:border-amber-400 transition-all flex items-center justify-center">
            <span className="text-slate-500 font-black text-lg leading-none">{initials}</span>
          </div>
        )}

        {/* Overlay */}
        <div className={`absolute inset-0 rounded-full flex items-center justify-center transition-opacity ${saving ? 'bg-black/60 opacity-100' : 'bg-black/50 opacity-0 group-hover:opacity-100'}`}>
          {saving
            ? <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            : <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
          }
        </div>

        {/* Badge de status */}
        {justSaved && (
          <div className="absolute -bottom-1 -right-1 bg-green-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">✓ ok</div>
        )}
        {!justSaved && hasCustom && (
          <div className="absolute -bottom-1 -right-1 bg-amber-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full">custom</div>
        )}
        {!justSaved && !hasCustom && hasStatic && (
          <div className="absolute -bottom-1 -right-1 bg-slate-300 text-slate-600 text-[9px] font-black px-1.5 py-0.5 rounded-full">estática</div>
        )}
        {!justSaved && !hasAnyPhoto && (
          <div className="absolute -bottom-1 -right-1 bg-red-100 text-red-500 text-[9px] font-black px-1.5 py-0.5 rounded-full">sem foto</div>
        )}
      </div>

      {/* Nome */}
      <p className="text-[10px] font-black text-slate-800 text-center leading-tight line-clamp-2">{shortName}</p>

      {/* Botão de upload */}
      <button
        onClick={() => fileRef.current?.click()}
        className="text-[9px] font-black uppercase tracking-widest text-amber-600 hover:text-amber-800 transition-colors"
      >
        {hasAnyPhoto ? '↺ Trocar' : '+ Inserir'}
      </button>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}
