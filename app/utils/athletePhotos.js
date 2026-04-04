'use client'

import { useState, useEffect, useRef } from 'react'

// ── MAPA DE FOTOS ESTÁTICAS (fallback) ────────────────────────────────────────
const PHOTO_MAP = {
  'adrian_da_silva_ferreira':          'adrian.png',
  'adrian':                            'adrian.png',
  'bernardo_lima':                     'bernardo_lima.png',
  'bruno_santana_vitorio':             'bruno_santana.png',
  'bruno_santana':                     'bruno_santana.png',
  'caio_flavio_martins_guimaraes':     'caio_flavio.png',
  'caio_flavio':                       'caio_flavio.png',
  'carlos_roberto_pereira':            'carlos_roberto.png',
  'carlos_roberto':                    'carlos_roberto.png',
  'daniel_da_silva_santos_junior':     'daniel_junior.png',
  'daniel_junior':                     'daniel_junior.png',
  'dhiogo_batista_barros':             'dhiogo_batista.png',
  'dhiogo_batista':                    'dhiogo_batista.png',
  'felipe_aguiar_samogim':             'felipe_samogim.png',
  'felipe_samogim':                    'felipe_samogim.png',
  'felipe_marques_toscano':            'felipe_toscano.png',
  'felipe_toscano':                    'felipe_toscano.png',
  'francisco_reidiney_duarte':         'francisco.png',
  'francisco':                         'francisco.png',
  'gabriel_correia_da_silva':          'gabriel_correia.png',
  'gabriel_correia':                   'gabriel_correia.png',
  'gustavo_mattei_hobold':             'gustavo_hobold.png',
  'gustavo_hobold':                    'gustavo_hobold.png',
  'joao_pedro_bezerra_vieira':         'joao_pedro.png',
  'joao_pedro_bezerra':                'joao_pedro.png',
  'joao_pedro_vieira':                 'joao_pedro.png',
  'joao_pedro':                        'joao_pedro.png',
  'joao_pedro_vieira_ferraz':          'joao_ferraz.png',
  'joao_ferraz':                       'joao_ferraz.png',
  'kawe_rodrigues_silva':              'kawe_rodrigues.png',
  'kawe_rodrigues':                    'kawe_rodrigues.png',
  'kayke_pereira_da_silva':            'kayki_andrade.png',
  'kayke_pereira':                     'kayki_andrade.png',
  'kayki_andrade':                     'kayki_andrade.png',
  'leonardo_goncalves_da_silva':       'leonardo_goncalves.png',
  'leonardo_goncalves':                'leonardo_goncalves.png',
  'mateus_geres_vinha_santos':         'matheus_geres.png',
  'matheus_geres_vinha_santos':        'matheus_geres.png',
  'mateus_geres':                      'matheus_geres.png',
  'matheus_geres':                     'matheus_geres.png',
  'matias_luderia_coronel':            'matias.png',
  'matias':                            'matias.png',
  'mauricio_alves_rocha':              'mauricio.png',
  'mauricio_alves':                    'mauricio.png',
  'mauricio':                          'mauricio.png',
  'nicolas_badu_reis':                 'nicolas_badu.png',
  'nicolas_badu':                      'nicolas_badu.png',
  'pedro_henrique_samanes_zenatti':    'pedro_zenatti.png',
  'pedro_henrique_samanes':            'pedro_zenatti.png',
  'pedro_zenatti':                     'pedro_zenatti.png',
  'pedro_henrique_vazan_reis':         'pedro_vazan.png',
  'pedro_henrique_vazan':              'pedro_vazan.png',
  'pedro_vazan':                       'pedro_vazan.png',
  'pedro_henrique_martins':            'pedro_henrique_martins.png',
  'pedro_miguel':                      'pedro_miguel.png',
  'plaza':                             'plaza.png',
  'rodrigo_campos_dos_santos':         'rodrigo_campos.png',
  'rodrigo_campos':                    'rodrigo_campos.png',
  'tiago_cardozo_fernandes':           'tiago_cardozo.png',
  'tiago_cardozo':                     'tiago_cardozo.png',
  'victor_henrique_cretuchi':          'victor_cretuchi.png',
  'victor_cretuchi':                   'victor_cretuchi.png',
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
export function normalizeKey(name) {
  if (!name) return ''
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z\s]/g, '')
    .replace(/\s+/g, '_')
    .trim()
    .replace(/_+/g, '_')
    .replace(/^_|_$/, '')
    .toLowerCase()
}

export function getStaticPhoto(playerName) {
  if (!playerName) return null
  const key = normalizeKey(playerName)
  if (PHOTO_MAP[key]) return '/club/' + PHOTO_MAP[key]
  const tokens = key.split('_')
  for (let i = tokens.length - 1; i >= 2; i--) {
    const partial = tokens.slice(0, i).join('_')
    if (PHOTO_MAP[partial]) return '/club/' + PHOTO_MAP[partial]
  }
  return null
}

// Alias retrocompatível
export function getAthletePhoto(playerName) { return getStaticPhoto(playerName) }

export function photoStorageKey(name) { return 'aphoto_' + normalizeKey(name) }

export function getCustomPhoto(name) {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(photoStorageKey(name)) || null } catch { return null }
}

export function saveCustomPhoto(name, dataUrl) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(photoStorageKey(name), dataUrl)
    window.dispatchEvent(new CustomEvent('athlete-photo-updated', {
      detail: { key: photoStorageKey(name), url: dataUrl, name }
    }))
  } catch (e) { console.warn('Erro ao salvar foto:', e) }
}

export function compressAndSave(name, file, onDone) {
  const reader = new FileReader()
  reader.onload = (ev) => {
    const img = new Image()
    img.onload = () => {
      const MAX = 300
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * ratio)
      canvas.height = Math.round(img.height * ratio)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
      saveCustomPhoto(name, dataUrl)
      if (onDone) onDone(dataUrl)
    }
    img.src = ev.target.result
  }
  reader.readAsDataURL(file)
}

// ── AthleteAvatar ─────────────────────────────────────────────────────────────
// clickable={true} habilita overlay de câmera + upload ao clicar
export function AthleteAvatar({ name, size = 'w-10 h-10', className = '', ring = false, clickable = true }) {
  const [customPhoto, setCustomPhoto] = useState(null)
  const [hovered, setHovered]         = useState(false)
  const [saving, setSaving]           = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    setCustomPhoto(getCustomPhoto(name))
    const handler = (e) => {
      if (e.detail.key === photoStorageKey(name)) setCustomPhoto(e.detail.url)
    }
    window.addEventListener('athlete-photo-updated', handler)
    return () => window.removeEventListener('athlete-photo-updated', handler)
  }, [name])

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setSaving(true)
    compressAndSave(name, file, (url) => { setCustomPhoto(url); setSaving(false) })
    e.target.value = ''
  }

  const photo    = customPhoto || getStaticPhoto(name)
  const initials = name ? name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') : '?'
  const ringCls  = ring ? 'ring-2 ring-amber-400 ring-offset-1' : ''

  const wrapProps = clickable ? {
    onClick:      (e) => { e.stopPropagation(); fileRef.current?.click() },
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    title:        photo ? 'Clique para trocar a foto' : 'Clique para inserir a foto',
  } : {}

  const overlay = clickable && (hovered || saving) ? (
    <div className="absolute inset-0 rounded-full bg-black/55 flex items-center justify-center pointer-events-none">
      {saving
        ? <svg className="w-2/5 h-2/5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
        : <svg className="w-2/5 h-2/5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
      }
    </div>
  ) : null

  const inputEl = clickable ? <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} /> : null

  if (photo) {
    return (
      <div className={`relative flex-shrink-0 ${size} ${clickable ? 'cursor-pointer' : ''}`} {...wrapProps}>
        <img src={photo} alt={name || ''} className={`${size} rounded-full object-cover object-top flex-shrink-0 ${ringCls} ${className}`}
          onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex' }} />
        {overlay}
        {inputEl}
      </div>
    )
  }

  return (
    <div className={`relative ${size} rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 ${ringCls} ${className} ${clickable ? 'cursor-pointer' : ''}`} {...wrapProps}>
      <span className="text-slate-500 font-black text-xs leading-none select-none">{initials}</span>
      {overlay}
      {inputEl}
    </div>
  )
}
