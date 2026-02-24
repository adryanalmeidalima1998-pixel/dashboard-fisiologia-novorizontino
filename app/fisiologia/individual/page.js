'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useMemo, Suspense } from 'react'
import { useData, calcVmaxPct } from '../../context/DataContext'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip as RTooltip, Legend
} from 'recharts'

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
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

// Coordenadas dos pontos de dor no SVG (viewBox "0 0 500 440")
// x 0-250 = frente | x 250-500 = costas
const ANATOMY_POINTS = {
  'P': { x: 125, y: 68, label: 'Cervical' },
  'L': { x: 178, y: 108, label: 'Deltoide D' },
  'M': { x: 72, y: 108, label: 'Deltoide E' },
  '15': { x: 148, y: 138, label: 'Peitoral D' },
  '16': { x: 102, y: 138, label: 'Peitoral E' },
  'A': { x: 125, y: 163, label: 'Abdome' },
  '19': { x: 192, y: 145, label: 'Bíceps D' },
  '20': { x: 58, y: 145, label: 'Bíceps E' },
  'R': { x: 197, y: 178, label: 'Cotovelo D' },
  'Q': { x: 53, y: 178, label: 'Cotovelo E' },
  'N': { x: 200, y: 210, label: 'Punho D' },
  'O': { x: 50, y: 210, label: 'Punho E' },
  '13': { x: 148, y: 208, label: 'Flex. Quadril D' },
  '14': { x: 102, y: 208, label: 'Flex. Quadril E' },
  '1': { x: 150, y: 262, label: 'Ant. Coxa D' },
  '2': { x: 100, y: 262, label: 'Ant. Coxa E' },
  '3': { x: 140, y: 252, label: 'Adutor D' },
  '4': { x: 110, y: 252, label: 'Adutor E' },
  'B': { x: 150, y: 315, label: 'Joelho Ant. D' },
  'C': { x: 100, y: 315, label: 'Joelho Ant. E' },
  '5': { x: 150, y: 352, label: 'Tibial Ant. D' },
  '6': { x: 100, y: 352, label: 'Tibial Ant. E' },
  'D': { x: 150, y: 390, label: 'Tornozelo D' },
  'E': { x: 100, y: 390, label: 'Tornozelo E' },
  '18': { x: 348, y: 132, label: 'Dorso D' },
  '17': { x: 302, y: 132, label: 'Dorso E' },
  'F': { x: 375, y: 168, label: 'Lombar' },
  '22': { x: 438, y: 145, label: 'Tríceps D' },
  '21': { x: 312, y: 145, label: 'Tríceps E' },
  '12': { x: 348, y: 210, label: 'Glúteo D' },
  '11': { x: 302, y: 210, label: 'Glúteo E' },
  '7': { x: 348, y: 262, label: 'Post. Coxa D' },
  '8': { x: 302, y: 262, label: 'Post. Coxa E' },
  'H': { x: 348, y: 315, label: 'Joelho Post. D' },
  'G': { x: 302, y: 315, label: 'Joelho Post. E' },
  '9': { x: 348, y: 352, label: 'Panturrilha D' },
  '10': { x: 302, y: 352, label: 'Panturrilha E' },
  'J': { x: 348, y: 390, label: 'Tendão Calc. D' },
  'I': { x: 302, y: 390, label: 'Tendão Calc. E' },
}

const POSICOES = ['GK', 'ZAG', 'LD', 'LE', 'VOL', 'MC', 'MEI', 'PD', 'PE', 'CA', 'ATA']

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function scoreBg(s) {
  if (s === null || s === undefined) return 'bg-slate-100 text-slate-400'
  if (s >= 3.5) return 'bg-green-100 text-green-700'
  if (s >= 2.5) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

// ─── COMPONENTES ──────────────────────────────────────────────────────────────

function Sparkline({ values, color = '#f59e0b', height = 32 }) {
  const valid = values.filter(v => v !== null)
  if (valid.length < 2) return <div className="flex items-center justify-center text-slate-300 text-xs">—</div>
  const min = Math.min(...valid), max = Math.max(...valid), range = max - min || 1
  const w = 200
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * w,
    y: v !== null ? height - ((v - min) / range) * (height - 6) - 3 : null
  }))
  const pathParts = []
  let inPath = false
  for (const { x, y } of pts) {
    if (y === null) { inPath = false; continue }
    if (!inPath) { pathParts.push(`M ${x} ${y}`); inPath = true }
    else pathParts.push(`L ${x} ${y}`)
  }
  const lastDot = pts.filter(p => p.y !== null).slice(-1)[0]
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }}>
      <path d={pathParts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {lastDot && <circle cx={lastDot.x} cy={lastDot.y} r="3" fill={color} />}
    </svg>
  )
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

// ─── RADAR CHART ──────────────────────────────────────────────────────────────
function PlayerRadarChart({ athleteData, compData, compLabel }) {
  if (!athleteData) return (
    <div className="flex items-center justify-center h-48 text-slate-300 text-sm">Sem dados GPS para gerar radar</div>
  )
  const metrics = [
    { key: 'distanceRelative', label: 'm/min', unit: 'm/min' },
    { key: 'hsr', label: 'HSR', unit: 'm' },
    { key: 'sprintDistance', label: 'Sprint', unit: 'm' },
    { key: 'accDecel', label: 'ACC+DEC', unit: '' },
    { key: 'playerLoad', label: 'Player Load', unit: '' },
    { key: 'maxVelocity', label: 'Vmax', unit: 'km/h' },
  ]
  const radarPoints = metrics.map(m => {
    const av = athleteData[m.key] || 0
    const cv = (compData || athleteData)[m.key] || 0
    const maxV = Math.max(av, cv, 0.001)
    return { subject: m.label, Atleta: parseFloat(((av / maxV) * 100).toFixed(1)), [compLabel]: parseFloat(((cv / maxV) * 100).toFixed(1)), rawA: av, rawC: cv, unit: m.unit }
  })

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    const item = radarPoints.find(d => d.subject === label)
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-2 text-xs shadow-lg">
        <p className="font-black text-black mb-1">{label}</p>
        {payload.map(p => (
          <p key={p.name} style={{ color: p.color }} className="font-bold">
            {p.name}: {p.name === 'Atleta' ? item?.rawA?.toFixed(1) : item?.rawC?.toFixed(1)} {item?.unit}
          </p>
        ))}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={radarPoints} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar name={compLabel} dataKey={compLabel} stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.2} strokeWidth={1.5} />
        <Radar name="Atleta" dataKey="Atleta" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.35} strokeWidth={2} />
        <RTooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 10, fontWeight: 'bold' }} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

// ─── FIGURA ANATÔMICA REALISTA ────────────────────────────────────────────────
export function AnatomyFigure({ activeRegions, hoveredRegion, onHover }) {
  const maxCount = Math.max(...Object.values(activeRegions), 1)

  function dotColor(code) {
    const c = activeRegions[code]; if (!c) return null
    const i = c / maxCount
    return i > 0.66 ? '#dc2626' : i > 0.33 ? '#f97316' : '#fbbf24'
  }

  // Pontos calibrados para o SVG realista abaixo (viewBox 0 0 560 480)
  // Frente: centro x≈140 | Costas: centro x≈420
  const POINTS = {
    // ── FRENTE ──
    'P':  { x: 140, y: 28,  label: 'Cervical' },
    'L':  { x: 183, y: 82,  label: 'Deltoide D' },
    'M':  { x: 97,  y: 82,  label: 'Deltoide E' },
    '15': { x: 162, y: 118, label: 'Peitoral D' },
    '16': { x: 118, y: 118, label: 'Peitoral E' },
    '19': { x: 196, y: 128, label: 'Bíceps D' },
    '20': { x: 84,  y: 128, label: 'Bíceps E' },
    'A':  { x: 140, y: 158, label: 'Abdome' },
    'R':  { x: 202, y: 162, label: 'Cotovelo D' },
    'Q':  { x: 78,  y: 162, label: 'Cotovelo E' },
    'N':  { x: 208, y: 198, label: 'Punho D' },
    'O':  { x: 72,  y: 198, label: 'Punho E' },
    '13': { x: 158, y: 200, label: 'Flex. Quadril D' },
    '14': { x: 122, y: 200, label: 'Flex. Quadril E' },
    '3':  { x: 152, y: 240, label: 'Adutor D' },
    '4':  { x: 128, y: 240, label: 'Adutor E' },
    '1':  { x: 162, y: 258, label: 'Ant. Coxa D' },
    '2':  { x: 118, y: 258, label: 'Ant. Coxa E' },
    'B':  { x: 162, y: 318, label: 'Joelho Ant. D' },
    'C':  { x: 118, y: 318, label: 'Joelho Ant. E' },
    '5':  { x: 162, y: 368, label: 'Tibial Ant. D' },
    '6':  { x: 118, y: 368, label: 'Tibial Ant. E' },
    'D':  { x: 162, y: 430, label: 'Tornozelo D' },
    'E':  { x: 118, y: 430, label: 'Tornozelo E' },

    // ── COSTAS ──
    '17': { x: 403, y: 115, label: 'Dorso E' },
    '18': { x: 437, y: 115, label: 'Dorso D' },
    'F':  { x: 420, y: 162, label: 'Lombar' },
    '21': { x: 387, y: 128, label: 'Tríceps E' },
    '22': { x: 453, y: 128, label: 'Tríceps D' },
    '11': { x: 406, y: 208, label: 'Glúteo E' },
    '12': { x: 434, y: 208, label: 'Glúteo D' },
    '8':  { x: 406, y: 262, label: 'Post. Coxa E' },
    '7':  { x: 434, y: 262, label: 'Post. Coxa D' },
    'G':  { x: 406, y: 320, label: 'Joelho Post. E' },
    'H':  { x: 434, y: 320, label: 'Joelho Post. D' },
    '10': { x: 406, y: 368, label: 'Panturrilha E' },
    '9':  { x: 434, y: 368, label: 'Panturrilha D' },
    'I':  { x: 406, y: 428, label: 'Tendão Calc. E' },
    'J':  { x: 434, y: 428, label: 'Tendão Calc. D' },
  }

  return (
    <div>
      <div className="flex justify-around text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 px-4">
        <span>FRENTE</span><span>COSTAS</span>
      </div>

      <svg viewBox="0 0 560 460" className="w-full max-w-md mx-auto block" style={{ maxHeight: 400 }}>

        {/* ═══════════════════════════════════════════════
            FRENTE — centro x=140
        ═══════════════════════════════════════════════ */}

        {/* Cabeça */}
        <ellipse cx="140" cy="26" rx="22" ry="24" fill="#e8c9a0" stroke="#c8a070" strokeWidth="1.2"/>
        {/* Pescoço */}
        <rect x="133" y="48" width="14" height="16" rx="4" fill="#e8c9a0" stroke="#c8a070" strokeWidth="1"/>
        {/* Ombros (trapézio) */}
        <path d="M90 70 Q97 62 140 65 Q183 62 190 70 L186 88 Q183 80 140 82 Q97 80 94 88 Z" fill="#d4a880" stroke="#c8a070" strokeWidth="1"/>
        {/* Tronco */}
        <path d="M96 82 Q94 120 97 175 Q100 195 108 200 L172 200 Q180 195 183 175 Q186 120 184 82 Q162 85 140 85 Q118 85 96 82Z" fill="#c8a070" stroke="#a87850" strokeWidth="1.2"/>
        {/* Músculo peitoral D */}
        <ellipse cx="162" cy="115" rx="20" ry="15" fill="#d4a068" stroke="#a87850" strokeWidth="0.8" opacity="0.7"/>
        {/* Músculo peitoral E */}
        <ellipse cx="118" cy="115" rx="20" ry="15" fill="#d4a068" stroke="#a87850" strokeWidth="0.8" opacity="0.7"/>
        {/* Abdome (linhas) */}
        <line x1="140" y1="102" x2="140" y2="195" stroke="#a87850" strokeWidth="0.8" opacity="0.4"/>
        <line x1="120" y1="118" x2="160" y2="118" stroke="#a87850" strokeWidth="0.8" opacity="0.3"/>
        <line x1="118" y1="135" x2="162" y2="135" stroke="#a87850" strokeWidth="0.8" opacity="0.3"/>
        <line x1="118" y1="152" x2="162" y2="152" stroke="#a87850" strokeWidth="0.8" opacity="0.3"/>
        <line x1="118" y1="168" x2="162" y2="168" stroke="#a87850" strokeWidth="0.8" opacity="0.3"/>

        {/* Braço D — superior */}
        <path d="M184 82 Q202 88 208 120 Q210 138 206 155 L198 155 Q198 138 196 120 Q190 95 180 90Z" fill="#e8c9a0" stroke="#c8a070" strokeWidth="1"/>
        {/* Braço D — inferior (antebraço) */}
        <path d="M198 155 Q208 160 212 185 Q214 195 212 205 L204 205 Q206 195 205 185 Q203 165 196 160Z" fill="#e8c9a0" stroke="#c8a070" strokeWidth="1"/>
        {/* Mão D */}
        <ellipse cx="208" cy="212" rx="10" ry="8" fill="#e8c9a0" stroke="#c8a070" strokeWidth="0.8"/>

        {/* Braço E — superior */}
        <path d="M96 82 Q78 88 72 120 Q70 138 74 155 L82 155 Q82 138 84 120 Q90 95 100 90Z" fill="#e8c9a0" stroke="#c8a070" strokeWidth="1"/>
        {/* Braço E — inferior (antebraço) */}
        <path d="M82 155 Q72 160 68 185 Q66 195 68 205 L76 205 Q74 195 75 185 Q77 165 84 160Z" fill="#e8c9a0" stroke="#c8a070" strokeWidth="1"/>
        {/* Mão E */}
        <ellipse cx="72" cy="212" rx="10" ry="8" fill="#e8c9a0" stroke="#c8a070" strokeWidth="0.8"/>

        {/* Quadril */}
        <path d="M108 200 Q96 210 96 225 L108 225 Q110 215 140 215 Q170 215 172 225 L184 225 Q184 210 172 200Z" fill="#c8a070" stroke="#a87850" strokeWidth="1"/>

        {/* Coxa D */}
        <path d="M140 215 Q168 218 172 225 Q176 270 172 310 L156 310 Q162 270 158 228Z" fill="#d4a880" stroke="#c8a070" strokeWidth="1"/>
        {/* Músculo quadríceps D */}
        <ellipse cx="162" cy="262" rx="14" ry="30" fill="#c8a070" stroke="#a87850" strokeWidth="0.8" opacity="0.6"/>

        {/* Coxa E */}
        <path d="M140 215 Q112 218 108 225 Q104 270 108 310 L124 310 Q118 270 122 228Z" fill="#d4a880" stroke="#c8a070" strokeWidth="1"/>
        {/* Músculo quadríceps E */}
        <ellipse cx="118" cy="262" rx="14" ry="30" fill="#c8a070" stroke="#a87850" strokeWidth="0.8" opacity="0.6"/>

        {/* Joelho D */}
        <ellipse cx="162" cy="316" rx="13" ry="10" fill="#c0956a" stroke="#a87850" strokeWidth="1"/>
        {/* Joelho E */}
        <ellipse cx="118" cy="316" rx="13" ry="10" fill="#c0956a" stroke="#a87850" strokeWidth="1"/>

        {/* Perna D (tibial) */}
        <path d="M156 326 Q164 330 166 370 Q166 390 162 408 L154 408 Q158 390 158 370 Q157 340 152 330Z" fill="#d4a880" stroke="#c8a070" strokeWidth="1"/>
        {/* Perna E (tibial) */}
        <path d="M124 326 Q116 330 114 370 Q114 390 118 408 L126 408 Q122 390 122 370 Q123 340 128 330Z" fill="#d4a880" stroke="#c8a070" strokeWidth="1"/>

        {/* Tornozelo + pé D */}
        <ellipse cx="162" cy="414" rx="12" ry="7" fill="#c0956a" stroke="#a87850" strokeWidth="0.8"/>
        <ellipse cx="164" cy="432" rx="14" ry="7" fill="#c8a070" stroke="#a87850" strokeWidth="0.8"/>
        {/* Tornozelo + pé E */}
        <ellipse cx="118" cy="414" rx="12" ry="7" fill="#c0956a" stroke="#a87850" strokeWidth="0.8"/>
        <ellipse cx="116" cy="432" rx="14" ry="7" fill="#c8a070" stroke="#a87850" strokeWidth="0.8"/>


        {/* ═══════════════════════════════════════════════
            DIVISOR
        ═══════════════════════════════════════════════ */}
        <line x1="280" y1="0" x2="280" y2="460" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="6,3"/>


        {/* ═══════════════════════════════════════════════
            COSTAS — centro x=420
        ═══════════════════════════════════════════════ */}

        {/* Cabeça */}
        <ellipse cx="420" cy="26" rx="22" ry="24" fill="#e8c9a0" stroke="#c8a070" strokeWidth="1.2"/>
        {/* Pescoço */}
        <rect x="413" y="48" width="14" height="16" rx="4" fill="#e8c9a0" stroke="#c8a070" strokeWidth="1"/>
        {/* Ombros */}
        <path d="M370 70 Q377 62 420 65 Q463 62 470 70 L466 88 Q463 80 420 82 Q377 80 374 88 Z" fill="#d4a880" stroke="#c8a070" strokeWidth="1"/>
        {/* Tronco costas */}
        <path d="M376 82 Q374 120 377 175 Q380 195 388 200 L452 200 Q460 195 463 175 Q466 120 464 82 Q442 85 420 85 Q398 85 376 82Z" fill="#c8a070" stroke="#a87850" strokeWidth="1.2"/>
        {/* Músculo dorsal E */}
        <ellipse cx="403" cy="120" rx="18" ry="28" fill="#b87848" stroke="#a87850" strokeWidth="0.8" opacity="0.6"/>
        {/* Músculo dorsal D */}
        <ellipse cx="437" cy="120" rx="18" ry="28" fill="#b87848" stroke="#a87850" strokeWidth="0.8" opacity="0.6"/>
        {/* Espinha */}
        <line x1="420" y1="85" x2="420" y2="200" stroke="#a87850" strokeWidth="1.5" opacity="0.5"/>
        {/* Lombar */}
        <ellipse cx="420" cy="168" rx="22" ry="14" fill="#a86840" stroke="#906030" strokeWidth="0.8" opacity="0.5"/>

        {/* Braço D costas — superior */}
        <path d="M464 82 Q480 88 486 120 Q488 138 484 155 L476 155 Q476 138 475 120 Q470 95 462 90Z" fill="#e8c9a0" stroke="#c8a070" strokeWidth="1"/>
        {/* Braço D costas — inferior */}
        <path d="M476 155 Q486 160 490 185 Q492 195 490 205 L482 205 Q484 195 483 185 Q481 165 475 160Z" fill="#e8c9a0" stroke="#c8a070" strokeWidth="1"/>
        <ellipse cx="488" cy="212" rx="10" ry="8" fill="#e8c9a0" stroke="#c8a070" strokeWidth="0.8"/>

        {/* Braço E costas — superior */}
        <path d="M376 82 Q360 88 354 120 Q352 138 356 155 L364 155 Q364 138 366 120 Q370 95 380 90Z" fill="#e8c9a0" stroke="#c8a070" strokeWidth="1"/>
        {/* Braço E costas — inferior */}
        <path d="M364 155 Q354 160 350 185 Q348 195 350 205 L358 205 Q356 195 357 185 Q359 165 366 160Z" fill="#e8c9a0" stroke="#c8a070" strokeWidth="1"/>
        <ellipse cx="352" cy="212" rx="10" ry="8" fill="#e8c9a0" stroke="#c8a070" strokeWidth="0.8"/>

        {/* Glúteo */}
        <path d="M388 200 Q376 210 376 228 L396 228 Q398 215 420 215 Q442 215 444 228 L464 228 Q464 210 452 200Z" fill="#c8a070" stroke="#a87850" strokeWidth="1"/>
        <ellipse cx="406" cy="218" rx="18" ry="14" fill="#b87848" stroke="#a87850" strokeWidth="0.8" opacity="0.6"/>
        <ellipse cx="434" cy="218" rx="18" ry="14" fill="#b87848" stroke="#a87850" strokeWidth="0.8" opacity="0.6"/>

        {/* Posterior coxa E */}
        <path d="M420 215 Q448 218 452 225 Q456 270 452 310 L436 310 Q442 270 438 228Z" fill="#d4a880" stroke="#c8a070" strokeWidth="1"/>
        <ellipse cx="434" cy="265" rx="14" ry="32" fill="#c8a070" stroke="#a87850" strokeWidth="0.8" opacity="0.6"/>

        {/* Posterior coxa D */}
        <path d="M420 215 Q392 218 388 225 Q384 270 388 310 L404 310 Q398 270 402 228Z" fill="#d4a880" stroke="#c8a070" strokeWidth="1"/>
        <ellipse cx="406" cy="265" rx="14" ry="32" fill="#c8a070" stroke="#a87850" strokeWidth="0.8" opacity="0.6"/>

        {/* Joelho post. E */}
        <ellipse cx="434" cy="316" rx="13" ry="10" fill="#c0956a" stroke="#a87850" strokeWidth="1"/>
        {/* Joelho post. D */}
        <ellipse cx="406" cy="316" rx="13" ry="10" fill="#c0956a" stroke="#a87850" strokeWidth="1"/>

        {/* Panturrilha E */}
        <path d="M436 326 Q444 332 444 370 Q444 390 440 408 L432 408 Q436 390 436 370 Q435 342 430 330Z" fill="#d4a880" stroke="#c8a070" strokeWidth="1"/>
        <ellipse cx="434" cy="368" rx="10" ry="28" fill="#c8a070" stroke="#a87850" strokeWidth="0.8" opacity="0.7"/>
        {/* Panturrilha D */}
        <path d="M404 326 Q396 332 396 370 Q396 390 400 408 L408 408 Q404 390 404 370 Q405 342 410 330Z" fill="#d4a880" stroke="#c8a070" strokeWidth="1"/>
        <ellipse cx="406" cy="368" rx="10" ry="28" fill="#c8a070" stroke="#a87850" strokeWidth="0.8" opacity="0.7"/>

        {/* Tendão Aquiles + pé E */}
        <rect x="428" y="408" width="10" height="18" rx="3" fill="#b87848" stroke="#906030" strokeWidth="0.8"/>
        <ellipse cx="436" cy="432" rx="14" ry="7" fill="#c8a070" stroke="#a87850" strokeWidth="0.8"/>
        {/* Tendão Aquiles + pé D */}
        <rect x="402" y="408" width="10" height="18" rx="3" fill="#b87848" stroke="#906030" strokeWidth="0.8"/>
        <ellipse cx="406" cy="432" rx="14" ry="7" fill="#c8a070" stroke="#a87850" strokeWidth="0.8"/>


        {/* ═══════════════════════════════════════════════
            PONTOS DE DOR
        ═══════════════════════════════════════════════ */}
        {Object.entries(POINTS).map(([code, pos]) => {
          const color = dotColor(code)
          const count = activeRegions[code] || 0
          const isHov = hoveredRegion === code
          if (!color && !isHov) return null
          return (
            <g key={code} onMouseEnter={() => onHover(code)} onMouseLeave={() => onHover(null)}
              style={{ cursor: 'pointer' }}>
              {/* Halo externo */}
              {(color || isHov) && (
                <circle cx={pos.x} cy={pos.y} r={isHov ? 14 : 10}
                  fill={color || '#f59e0b'} fillOpacity={0.25}
                  stroke={color || '#f59e0b'} strokeWidth="1" strokeOpacity={0.5}/>
              )}
              {/* Ponto central */}
              <circle cx={pos.x} cy={pos.y} r={isHov ? 8 : 6}
                fill={color || '#f59e0b'} fillOpacity={color ? 0.92 : 0.5}
                stroke="white" strokeWidth="1.5"/>
              {/* Contador */}
              {count > 1 && (
                <text x={pos.x} y={pos.y + 3} textAnchor="middle"
                  fontSize="7" fontWeight="bold" fill="white">{count}</text>
              )}
              {/* Tooltip hover */}
              {isHov && (() => {
                const isRight = pos.x > 280
                const tx = isRight ? pos.x + 16 : pos.x - 16
                const anchor = isRight ? 'start' : 'end'
                const lw = pos.label.length * 5.5 + 8
                const lx = isRight ? tx - 4 : tx - lw + 4
                return (
                  <g>
                    <rect x={lx} y={pos.y - 14} width={lw} height={16} rx="3"
                      fill="white" stroke="#cbd5e1" strokeWidth="0.8" opacity="0.95"/>
                    <text x={tx} y={pos.y - 3} textAnchor={anchor}
                      fontSize="8.5" fontWeight="bold" fill="#1e293b">{pos.label}</text>
                  </g>
                )
              })()}
            </g>
          )
        })}
      </svg>

      <div className="flex items-center justify-center gap-4 mt-2">
        {[['bg-amber-400', '1× relatado'], ['bg-orange-500', 'Frequente'], ['bg-red-600', 'Recorrente']].map(([bg, lbl]) => (
          <div key={lbl} className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded-full ${bg} inline-block`} />
            <span className="text-[9px] font-black text-slate-500 uppercase">{lbl}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── CONTEÚDO PRINCIPAL ───────────────────────────────────────────────────────
function IndividualContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { gpsData, bemEstarData, vmaxBaseline } = useData()
  const [activeTab, setActiveTab] = useState('visao')
  const [hoveredRegion, setHoveredRegion] = useState(null)
  const [showPositionConfig, setShowPositionConfig] = useState(false)
  const [playerPositions, setPlayerPositions] = useState({})
  const [sortGps, setSortGps] = useState({ col: 'sessionDate', dir: 'desc' })
  const [sortBem, setSortBem] = useState({ col: 'date', dir: 'desc' })

  function toggleSort(current, col, setter) {
    setter(current.col === col ? { col, dir: current.dir === 'desc' ? 'asc' : 'desc' } : { col, dir: 'desc' })
  }

  const allAthletes = useMemo(() => {
    const names = new Set([
      ...bemEstarData.map(r => r.playerName),
      ...gpsData.flatMap(s => s.rows.filter(r => !r.isOutlier).map(r => r.playerName))
    ])
    return Array.from(names).sort()
  }, [bemEstarData, gpsData])

  const [selectedAthlete, setSelectedAthlete] = useState(() => searchParams.get('atleta') || '')
  const athlete = selectedAthlete || allAthletes[0] || ''

  const wellinessHistory = useMemo(() => bemEstarData
    .filter(r => r.playerName === athlete && r.type === 'pre')
    .sort((a, b) => a.timestamp - b.timestamp).slice(-60), [bemEstarData, athlete])

  const srpeHistory = useMemo(() => bemEstarData
    .filter(r => r.playerName === athlete && r.type === 'post' && r.srpeLoad)
    .sort((a, b) => a.timestamp - b.timestamp).slice(-60), [bemEstarData, athlete])

  const gpsHistory = useMemo(() => gpsData
    .flatMap(s => s.rows.filter(r => r.playerName === athlete && r.periodNumber === 0 && !r.isOutlier))
    .sort((a, b) => new Date(a.sessionDate?.split('/').reverse().join('-')) - new Date(b.sessionDate?.split('/').reverse().join('-'))),
    [gpsData, athlete])

  const latestSessionPeriods = useMemo(() => {
    if (!gpsData.length) return []
    return gpsData[gpsData.length - 1].rows.filter(r => r.playerName === athlete && !r.isOutlier)
  }, [gpsData, athlete])

  const vmaxMax = vmaxBaseline[athlete] || null
  const latestGps = gpsHistory[gpsHistory.length - 1] || null
  const vmaxPct = latestGps && vmaxMax ? calcVmaxPct(latestGps.maxVelocity, vmaxMax) : null

  // ─── DOR ─────────────────────────────────────────────────────────────────────
  const painCodeMap = useMemo(() => {
    const map = {}
    // Usamos os novos pontos calibrados para mapeamento
    const VALID_CODES = {
      'P':1,'L':1,'M':1,'15':1,'16':1,'19':1,'20':1,'A':1,'R':1,'Q':1,'N':1,'O':1,
      '13':1,'14':1,'3':1,'4':1,'1':1,'2':1,'B':1,'C':1,'5':1,'6':1,'D':1,'E':1,
      '17':1,'18':1,'F':1,'21':1,'22':1,'11':1,'12':1,'8':1,'7':1,'G':1,'H':1,'10':1,'9':1,'I':1,'J':1
    }
    for (const r of wellinessHistory) {
      if (!r.temDor || !r.dorLocalizada) continue
      const parts = r.dorLocalizada.split(',').map(p => p.trim())
      for (const part of parts) {
        if (!part || part === '0 - Sem dor') continue
        const code = part.split(' - ')[0].trim()
        if (VALID_CODES[code]) {
          map[code] = (map[code] || 0) + 1
        } else {
          for (const [k, v] of Object.entries(DOR_LABELS)) {
            if (part.toLowerCase().includes(v.toLowerCase()) || v.toLowerCase().includes(part.toLowerCase())) {
              map[k] = (map[k] || 0) + 1; break
            }
          }
        }
      }
    }
    return map
  }, [wellinessHistory])

  const painHistory = useMemo(() => wellinessHistory.filter(r => r.temDor && r.dorLocalizada).slice().reverse().slice(0, 20), [wellinessHistory])

  const painFrequency = useMemo(() => {
    const freq = {}
    for (const r of wellinessHistory) {
      if (!r.temDor || !r.dorLocalizada) continue
      const parts = r.dorLocalizada.split(',').map(p => p.trim())
      for (const part of parts) {
        if (part && part !== '0 - Sem dor') freq[part] = (freq[part] || 0) + 1
      }
    }
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [wellinessHistory])

  // ─── RADAR ───────────────────────────────────────────────────────────────────
  const athletePosition = playerPositions[athlete] || null

  const radarData = useMemo(() => {
    if (!gpsHistory.length) return null
    const n = gpsHistory.length
    return {
      distanceRelative: gpsHistory.reduce((s, r) => s + (r.distanceRelative || 0), 0) / n,
      hsr: gpsHistory.reduce((s, r) => s + (r.hsr || 0), 0) / n,
      sprintDistance: gpsHistory.reduce((s, r) => s + (r.sprintDistance || 0), 0) / n,
      accDecel: gpsHistory.reduce((s, r) => s + (r.acceleration || 0) + (r.deceleration || 0), 0) / n,
      playerLoad: gpsHistory.reduce((s, r) => s + (r.playerLoad || 0), 0) / n,
      maxVelocity: gpsHistory.reduce((s, r) => s + (r.maxVelocity || 0), 0) / n,
    }
  }, [gpsHistory])

  const compData = useMemo(() => {
    const compareAthletes = athletePosition
      ? allAthletes.filter(a => a !== athlete && playerPositions[a] === athletePosition)
      : allAthletes.filter(a => a !== athlete)
    const rows = gpsData.flatMap(s => s.rows.filter(r => compareAthletes.includes(r.playerName) && r.periodNumber === 0 && !r.isOutlier))
    if (!rows.length) return null
    const n = rows.length
    return {
      distanceRelative: rows.reduce((s, r) => s + (r.distanceRelative || 0), 0) / n,
      hsr: rows.reduce((s, r) => s + (r.hsr || 0), 0) / n,
      sprintDistance: rows.reduce((s, r) => s + (r.sprintDistance || 0), 0) / n,
      accDecel: rows.reduce((s, r) => s + (r.acceleration || 0) + (r.deceleration || 0), 0) / n,
      playerLoad: rows.reduce((s, r) => s + (r.playerLoad || 0), 0) / n,
      maxVelocity: rows.reduce((s, r) => s + (r.maxVelocity || 0), 0) / n,
    }
  }, [gpsData, allAthletes, athlete, athletePosition, playerPositions])

  const compLabel = athletePosition ? `Média ${athletePosition}` : 'Média Equipe'

  // ─── SCORES ──────────────────────────────────────────────────────────────────
  const lastWellness = wellinessHistory[wellinessHistory.length - 1]
  const wellScores = wellinessHistory.map(r => r.wellnessScore).filter(Boolean)
  const avgWellness = wellScores.length ? wellScores.reduce((a, b) => a + b, 0) / wellScores.length : null

  const wellnessPoints = wellinessHistory.slice(-30).map(r => r.wellnessScore)
  const sonoPoints = wellinessHistory.slice(-30).map(r => r.sono)
  const fadPoints = wellinessHistory.slice(-30).map(r => r.fadiga ? (6 - r.fadiga) : null)
  const gpsDistPoints = gpsHistory.map(r => r.totalDistance)
  const gpsHsrPoints = gpsHistory.map(r => r.hsr)
  const srpeLoadPoints = srpeHistory.slice(-30).map(r => r.srpeLoad)

  // Tabelas ordenadas
  const sortedGps = useMemo(() => {
    const list = [...gpsHistory]
    const { col, dir } = sortGps
    list.sort((a, b) => {
      if (col === 'sessionDate') {
        const da = new Date(a.sessionDate?.split('/').reverse().join('-')), db = new Date(b.sessionDate?.split('/').reverse().join('-'))
        return dir === 'desc' ? db - da : da - db
      }
      const va = a[col] ?? 0, vb = b[col] ?? 0
      return dir === 'desc' ? vb - va : va - vb
    })
    return list
  }, [gpsHistory, sortGps])

  const sortedWellness = useMemo(() => {
    const list = [...wellinessHistory]
    const { col, dir } = sortBem
    list.sort((a, b) => {
      if (col === 'date') return dir === 'desc' ? new Date(b.date) - new Date(a.date) : new Date(a.date) - new Date(b.date)
      const va = a[col] ?? 0, vb = b[col] ?? 0
      return dir === 'desc' ? vb - va : va - vb
    })
    return list
  }, [wellinessHistory, sortBem])

  if (!athlete) return (
    <div className="flex flex-col items-center justify-center py-20">
      <p className="text-slate-400 font-medium">Sem atletas disponíveis. Carregue dados na página inicial.</p>
    </div>
  )

  return (
    <div className="max-w-[1400px] mx-auto flex flex-col gap-5">

      {/* HEADER */}
      <header className="flex flex-wrap justify-between items-center border-b-4 border-amber-500 pb-3 gap-3">
        <div className="flex items-center gap-4">
          <img src="/club/escudonovorizontino.png" alt="Escudo" className="h-14 w-auto" />
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-black uppercase leading-none">Atleta Individual</h1>
            <p className="text-sm font-bold tracking-widest text-slate-600 uppercase">Histórico & Tendências</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => router.push('/fisiologia')} className="bg-slate-200 text-slate-800 px-3 py-1 rounded-md text-xs font-bold hover:bg-slate-300 transition-colors">← VOLTAR</button>
          <button onClick={() => setShowPositionConfig(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded-md text-xs font-bold transition-colors border border-slate-200">⚙ Posições</button>
          <select value={athlete} onChange={e => setSelectedAthlete(e.target.value)}
            className="border-2 border-amber-500 rounded-lg px-3 py-1.5 text-sm font-black text-black bg-white focus:outline-none max-w-[220px]">
            <option value="">Selecionar atleta...</option>
            {allAthletes.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </header>

      {/* RESUMO TOPO */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Último Bem-Estar</p>
          <div className="flex items-end gap-2">
            <span className={`text-3xl font-black leading-none ${scoreBg(lastWellness?.wellnessScore).split(' ')[1]}`}>{lastWellness?.wellnessScore?.toFixed(1) || '—'}</span>
            <span className="text-xs font-bold text-slate-400 mb-1">/ 5.0</span>
          </div>
          <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">{lastWellness?.date || 'Sem dados'}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Média Wellness</p>
          <span className="text-3xl font-black leading-none text-slate-700">{avgWellness?.toFixed(1) || '—'}</span>
          <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500" style={{ width: `${(avgWellness / 5) * 100}%` }} />
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Última Vmax</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black leading-none text-slate-700">{latestGps?.maxVelocity?.toFixed(1) || '—'}</span>
            <span className="text-xs font-bold text-slate-400 mb-1">km/h</span>
          </div>
          {vmaxPct && <p className={`text-[10px] font-black mt-1 ${vmaxPct >= 90 ? 'text-green-600' : 'text-amber-600'}`}>{vmaxPct}% da Vmax Base</p>}
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Dist. Média (GPS)</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black leading-none text-slate-700">{(gpsDistPoints.reduce((a, b) => a + b, 0) / (gpsDistPoints.length || 1)).toFixed(0)}</span>
            <span className="text-xs font-bold text-slate-400 mb-1">m</span>
          </div>
          <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">{gpsHistory.length} sessões registradas</p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {[
          { id: 'visao', label: 'Visão Geral' },
          { id: 'gps', label: 'GPS & Carga' },
          { id: 'bemEstar', label: 'Bem-Estar' },
          { id: 'dor', label: `Dor Localizada${Object.keys(painCodeMap).length > 0 ? ` (${Object.keys(painCodeMap).length} regiões)` : ''}` },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeTab === t.id ? 'border-b-2 border-amber-500 text-black' : 'text-slate-400 hover:text-slate-600'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── VISÃO GERAL ── */}
      {activeTab === 'visao' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Radar */}
          <div className="border border-slate-200 rounded-xl p-4 md:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                Radar de Métricas Físicas — Atleta vs {compLabel}
              </p>
              {!compData && <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-1 rounded-lg font-bold">Configure posições para comparar por função</span>}
            </div>
            <PlayerRadarChart athleteData={radarData} compData={compData || radarData} compLabel={compLabel} />
            <p className="text-[9px] text-slate-400 font-medium mt-1 text-center">
              Valores relativos ao máximo entre atleta e grupo · Médias de todas as sessões GPS carregadas
            </p>
          </div>

          <div className="border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Tendência Bem-Estar (30 dias)</p>
            <Sparkline values={wellnessPoints} color="#f59e0b" height={48} />
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div><p className="text-[9px] font-black uppercase text-slate-400 mb-1">Sono</p><Sparkline values={sonoPoints} color="#3b82f6" height={28} /></div>
              <div><p className="text-[9px] font-black uppercase text-slate-400 mb-1">Fadiga (inv.)</p><Sparkline values={fadPoints} color="#ef4444" height={28} /></div>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">sRPE-Load (30 pós)</p>
            {srpeLoadPoints.length > 0 ? <Sparkline values={srpeLoadPoints} color="#8b5cf6" height={48} /> : <div className="text-center py-6 text-slate-300 text-sm">Sem dados de sRPE</div>}
            {srpeHistory.slice(-5).reverse().map((r, i) => (
              <div key={i} className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-[10px] text-slate-500">{r.date}</span>
                <span className="text-xs font-black text-slate-700">sRPE {r.srpe} × {r.duracaoSessao}min</span>
                <span className="text-xs font-black text-purple-600">{r.srpeLoad.toFixed(0)} UA</span>
              </div>
            ))}
          </div>

          <div className="border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">GPS — Distância Total</p>
            {gpsDistPoints.length > 0 ? (
              <>
                <Sparkline values={gpsDistPoints} color="#10b981" height={48} />
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="text-center"><p className="text-[9px] font-black uppercase text-slate-400">Última</p><p className="text-sm font-black">{latestGps?.totalDistance?.toFixed(0)} m</p></div>
                  <div className="text-center"><p className="text-[9px] font-black uppercase text-slate-400">Média</p><p className="text-sm font-black">{(gpsDistPoints.reduce((a, b) => a + b, 0) / gpsDistPoints.length).toFixed(0)} m</p></div>
                  <div className="text-center"><p className="text-[9px] font-black uppercase text-slate-400">Máxima</p><p className="text-sm font-black">{Math.max(...gpsDistPoints).toFixed(0)} m</p></div>
                </div>
              </>
            ) : <div className="text-center py-6 text-slate-300 text-sm">Sem GPS carregado</div>}
          </div>

          <div className="border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Dores mais frequentes</p>
            {painFrequency.length > 0
              ? <div className="flex flex-col gap-2">{painFrequency.map(([region, count]) => (
                <div key={region} className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 w-24 shrink-0 truncate">{region.split(' - ').slice(-1)[0]}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2"><div className="bg-orange-400 h-2 rounded-full" style={{ width: `${(count / painFrequency[0][1]) * 100}%` }} /></div>
                  <span className="text-xs font-black text-orange-600 w-8 text-right">{count}×</span>
                </div>
              ))}</div>
              : <div className="text-center py-8 text-slate-300 text-sm">Sem dores relatadas</div>
            }
          </div>
        </div>
      )}

      {/* ── GPS & CARGA ── */}
      {activeTab === 'gps' && (
        <div className="flex flex-col gap-5">
          {latestSessionPeriods.length > 0 && (
            <div className="border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Última sessão — por período</p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b-2 border-slate-900">
                      {['Período', 'Dist (m)', 'm/min', 'HSR (m)', 'Sprint (m)', 'Sprints', 'ACC', 'DEC', 'PL', 'Vmax'].map(h => (
                        <th key={h} className="text-left py-2 pr-3 font-black uppercase tracking-widest text-[10px] text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {latestSessionPeriods.map((row, i) => (
                      <tr key={i} className={`border-b border-slate-100 ${row.periodNumber === 0 ? 'font-black bg-amber-50' : ''}`}>
                        <td className="py-2 pr-3">{row.period}</td>
                        <td className="py-2 pr-3">{row.totalDistance?.toFixed(0) ?? '—'}</td>
                        <td className="py-2 pr-3">{row.distanceRelative?.toFixed(1) ?? '—'}</td>
                        <td className="py-2 pr-3">{row.hsr?.toFixed(0) ?? '—'}</td>
                        <td className="py-2 pr-3">{row.sprintDistance?.toFixed(0) ?? '—'}</td>
                        <td className="py-2 pr-3">{row.sprintCount ?? '—'}</td>
                        <td className="py-2 pr-3">{row.acceleration ?? '—'}</td>
                        <td className="py-2 pr-3">{row.deceleration ?? '—'}</td>
                        <td className="py-2 pr-3">{row.playerLoad?.toFixed(0) ?? '—'}</td>
                        <td className="py-2 pr-3">{row.maxVelocity?.toFixed(1) ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {gpsHistory.length > 0 ? (
            <div className="border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Histórico GPS — Todas as sessões</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><p className="text-[10px] font-black uppercase text-slate-400 mb-1">Distância Total</p><Sparkline values={gpsDistPoints} color="#10b981" height={36} /></div>
                <div><p className="text-[10px] font-black uppercase text-slate-400 mb-1">HSR (m)</p><Sparkline values={gpsHsrPoints} color="#f59e0b" height={36} /></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <SortTh label="Data" col="sessionDate" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} />
                      <SortTh label="Dist (m)" col="totalDistance" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} />
                      <SortTh label="m/min" col="distanceRelative" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} />
                      <SortTh label="HSR (m)" col="hsr" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} />
                      <SortTh label="Sprint (m)" col="sprintDistance" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} />
                      <SortTh label="ACC" col="acceleration" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} />
                      <SortTh label="DEC" col="deceleration" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} />
                      <SortTh label="Vmax" col="maxVelocity" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} />
                      <SortTh label="PL" col="playerLoad" sort={sortGps} onSort={c => toggleSort(sortGps, c, setSortGps)} />
                      <th className="text-left py-1.5 px-2 font-black uppercase tracking-widest text-[9px] text-slate-400">% Vmax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedGps.map((row, i) => {
                      const pct = vmaxMax ? calcVmaxPct(row.maxVelocity, vmaxMax) : null
                      return (
                        <tr key={i} className="border-b border-slate-100 hover:bg-amber-50">
                          <td className="py-1.5 pr-3 font-bold text-slate-600">{row.sessionDate}</td>
                          <td className="py-1.5 pr-3 font-black">{row.totalDistance?.toFixed(0)}</td>
                          <td className="py-1.5 pr-3">{row.distanceRelative?.toFixed(1)}</td>
                          <td className="py-1.5 pr-3">{row.hsr?.toFixed(0)}</td>
                          <td className="py-1.5 pr-3">{row.sprintDistance?.toFixed(0)}</td>
                          <td className="py-1.5 pr-3">{row.acceleration}</td>
                          <td className="py-1.5 pr-3">{row.deceleration}</td>
                          <td className="py-1.5 pr-3">{row.maxVelocity?.toFixed(1)}</td>
                          <td className="py-1.5 pr-3">{row.playerLoad?.toFixed(0)}</td>
                          <td className={`py-1.5 pr-3 font-black ${pct >= 90 ? 'text-green-600' : pct >= 80 ? 'text-amber-600' : 'text-slate-500'}`}>{pct ? `${pct}%` : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : <div className="text-center py-12 text-slate-400">Sem GPS para este atleta.</div>}
        </div>
      )}

      {/* ── BEM-ESTAR ── */}
      {activeTab === 'bemEstar' && (
        <div className="flex flex-col gap-5">
          {wellinessHistory.length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'Sono', key: 'sono', color: '#3b82f6', invert: false },
                  { label: 'Fadiga (inv)', key: 'fadiga', color: '#ef4444', invert: true },
                  { label: 'DOMS (inv)', key: 'doms', color: '#f97316', invert: true },
                  { label: 'Estresse (inv)', key: 'estresse', color: '#8b5cf6', invert: true },
                  { label: 'Humor', key: 'humor', color: '#10b981', invert: false },
                  { label: 'Score Geral', key: 'wellnessScore', color: '#f59e0b', invert: false },
                ].map(({ label, key, color, invert }) => {
                  const vals = wellinessHistory.slice(-30).map(r => invert ? (6 - r[key]) : r[key])
                  const last = wellinessHistory[wellinessHistory.length - 1][key]
                  return (
                    <div key={key} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{label}</p>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xl font-black">{last || '—'}</span>
                        <div className="w-20"><Sparkline values={vals} color={color} height={20} /></div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Histórico de Bem-Estar</p>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b-2 border-slate-200">
                        <SortTh label="Data" col="date" sort={sortBem} onSort={c => toggleSort(sortBem, c, setSortBem)} />
                        <SortTh label="Sono" col="sono" sort={sortBem} onSort={c => toggleSort(sortBem, c, setSortBem)} />
                        <SortTh label="Fadiga" col="fadiga" sort={sortBem} onSort={c => toggleSort(sortBem, c, setSortBem)} />
                        <SortTh label="DOMS" col="doms" sort={sortBem} onSort={c => toggleSort(sortBem, c, setSortBem)} />
                        <SortTh label="Estresse" col="estresse" sort={sortBem} onSort={c => toggleSort(sortBem, c, setSortBem)} />
                        <SortTh label="Humor" col="humor" sort={sortBem} onSort={c => toggleSort(sortBem, c, setSortBem)} />
                        <SortTh label="Score" col="wellnessScore" sort={sortBem} onSort={c => toggleSort(sortBem, c, setSortBem)} />
                        <th className="text-left py-1.5 px-2 font-black uppercase tracking-widest text-[9px] text-slate-400">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedWellness.map((row, i) => (
                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-1.5 pr-3 font-bold text-slate-600">{row.date}</td>
                          <td className="py-1.5 pr-3">{row.sono}</td>
                          <td className="py-1.5 pr-3">{row.fadiga}</td>
                          <td className="py-1.5 pr-3">{row.doms}</td>
                          <td className="py-1.5 pr-3">{row.estresse}</td>
                          <td className="py-1.5 pr-3">{row.humor}</td>
                          <td className={`py-1.5 pr-3 font-black ${scoreBg(row.wellnessScore).split(' ')[1]}`}>{row.wellnessScore?.toFixed(1)}</td>
                          <td className="py-1.5 pr-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${scoreBg(row.wellnessScore)}`}>
                              {row.wellnessScore >= 3.5 ? 'ÓTIMO' : row.wellnessScore >= 2.5 ? 'ALERTA' : 'CRÍTICO'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : <div className="text-center py-12 text-slate-400">Sem dados de bem-estar para este atleta.</div>}
        </div>
      )}

      {/* ── DOR LOCALIZADA ── */}
      {activeTab === 'dor' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Mapa de Dores (Acumulado)</p>
            <AnatomyFigure activeRegions={painCodeMap} hoveredRegion={hoveredRegion} onHover={setHoveredRegion} />
          </div>
          <div className="flex flex-col gap-5">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Top Regiões Relatadas</p>
              <div className="flex flex-col gap-3">
                {Object.entries(painCodeMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([code, count]) => (
                  <div key={code} className={`flex items-center justify-between p-2 rounded-lg transition-colors ${hoveredRegion === code ? 'bg-amber-50' : 'bg-slate-50'}`}
                    onMouseEnter={() => setHoveredRegion(code)} onMouseLeave={() => setHoveredRegion(null)}>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                      <span className="text-xs font-black uppercase text-slate-700">{DOR_LABELS[code] || code}</span>
                    </div>
                    <span className="text-xs font-black text-orange-600">{count}× relatado</span>
                  </div>
                ))}
                {Object.keys(painCodeMap).length === 0 && <p className="text-sm text-slate-300 text-center py-4">Nenhum relato de dor recente.</p>}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Últimos Relatos</p>
              <div className="flex flex-col gap-2">
                {painHistory.map((r, i) => (
                  <div key={i} className="border-l-2 border-amber-500 pl-3 py-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase">{r.date}</p>
                    <p className="text-xs font-bold text-slate-700">{r.dorLocalizada}</p>
                    {r.comentariosDor && <p className="text-[10px] text-slate-500 italic mt-0.5">"{r.comentariosDor}"</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIG POSIÇÕES */}
      {showPositionConfig && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-slate-900 p-4 flex justify-between items-center">
              <h3 className="text-white font-black uppercase tracking-widest text-sm">Configurar Posições</h3>
              <button onClick={() => setShowPositionConfig(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="p-4 max-h-[400px] overflow-y-auto">
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-4 italic">Defina a posição de cada atleta para habilitar comparações por função no radar.</p>
              <div className="flex flex-col gap-2">
                {allAthletes.map(name => (
                  <div key={name} className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-xs font-black text-slate-700">{name}</span>
                    <select value={playerPositions[name] || ''} onChange={e => setPlayerPositions(prev => ({ ...prev, [name]: e.target.value }))}
                      className="text-xs font-bold border rounded px-2 py-1 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500">
                      <option value="">Equipe</option>
                      {POSICOES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <button onClick={() => setShowPositionConfig(false)} className="w-full bg-amber-500 text-black font-black py-2 rounded-lg text-xs uppercase tracking-widest hover:bg-amber-600 transition-colors">Salvar e Fechar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default function IndividualPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-black text-slate-400 animate-pulse uppercase tracking-widest">Carregando Painel...</div>}>
      <IndividualContent />
    </Suspense>
  )
}
