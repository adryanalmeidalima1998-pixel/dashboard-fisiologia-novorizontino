'use client'
import React from 'react'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useMemo, Suspense } from 'react'
import { useData, calcVmaxPct } from '../../context/DataContext'
import { AthleteAvatar } from '../../utils/athletePhotos'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip as RTooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine,
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

// Coordenadas dos pontos de dor — boneco realista (viewBox "0 0 500 430")
// x 0-250 = frente (centro 125) | x 250-500 = costas (centro 375)
const ANATOMY_POINTS = {
  // ── FRENTE ────────────────────────────────────────────────────
  'P':  { x: 125, y: 66,  label: 'Cervical' },
  'L':  { x: 174, y: 88,  label: 'Deltoide D' },
  'M':  { x: 76,  y: 88,  label: 'Deltoide E' },
  '15': { x: 147, y: 118, label: 'Peitoral D' },
  '16': { x: 103, y: 118, label: 'Peitoral E' },
  'A':  { x: 125, y: 155, label: 'Abdome' },
  '19': { x: 198, y: 116, label: 'Bíceps D' },
  '20': { x: 52,  y: 116, label: 'Bíceps E' },
  'R':  { x: 204, y: 160, label: 'Cotovelo D' },
  'Q':  { x: 46,  y: 160, label: 'Cotovelo E' },
  'N':  { x: 202, y: 202, label: 'Punho D' },
  'O':  { x: 48,  y: 202, label: 'Punho E' },
  '13': { x: 143, y: 213, label: 'Flex. Quadril D' },
  '14': { x: 107, y: 213, label: 'Flex. Quadril E' },
  '1':  { x: 143, y: 268, label: 'Ant. Coxa D' },
  '2':  { x: 107, y: 268, label: 'Ant. Coxa E' },
  '3':  { x: 136, y: 255, label: 'Adutor D' },
  '4':  { x: 114, y: 255, label: 'Adutor E' },
  'B':  { x: 145, y: 322, label: 'Joelho Ant. D' },
  'C':  { x: 105, y: 322, label: 'Joelho Ant. E' },
  '5':  { x: 144, y: 362, label: 'Tibial Ant. D' },
  '6':  { x: 106, y: 362, label: 'Tibial Ant. E' },
  'D':  { x: 145, y: 400, label: 'Tornozelo D' },
  'E':  { x: 105, y: 400, label: 'Tornozelo E' },
  // ── COSTAS ────────────────────────────────────────────────────
  '18': { x: 395, y: 118, label: 'Dorso D' },
  '17': { x: 355, y: 118, label: 'Dorso E' },
  'F':  { x: 375, y: 165, label: 'Lombar' },
  '22': { x: 449, y: 116, label: 'Tríceps D' },
  '21': { x: 301, y: 116, label: 'Tríceps E' },
  '12': { x: 393, y: 213, label: 'Glúteo D' },
  '11': { x: 357, y: 213, label: 'Glúteo E' },
  '7':  { x: 393, y: 268, label: 'Post. Coxa D' },
  '8':  { x: 357, y: 268, label: 'Post. Coxa E' },
  'H':  { x: 395, y: 322, label: 'Joelho Post. D' },
  'G':  { x: 355, y: 322, label: 'Joelho Post. E' },
  '9':  { x: 393, y: 362, label: 'Panturrilha D' },
  '10': { x: 357, y: 362, label: 'Panturrilha E' },
  'J':  { x: 393, y: 400, label: 'Tendão Calc. D' },
  'I':  { x: 357, y: 400, label: 'Tendão Calc. E' },
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
const RADAR_METRICS = [
  { key: 'distanceRelative', label: 'm/min', unit: 'm/min' },
  { key: 'hsr', label: 'HSR', unit: 'm' },
  { key: 'sprintDistance', label: 'Sprint', unit: 'm' },
  { key: 'accDecel', label: 'ACC+DEC', unit: '' },
  { key: 'playerLoad', label: 'Player Load', unit: '' },
  { key: 'maxVelocity', label: 'Vmax', unit: 'km/h' },
]

function buildRadarPointsDual(athleteData, compareData, compareLabel) {
  return RADAR_METRICS.map(m => {
    const av = athleteData[m.key] || 0
    const cv = compareData ? (compareData[m.key] || 0) : 0
    const maxV = Math.max(av, cv, 0.001)
    return {
      subject: m.label,
      A: parseFloat(((av / maxV) * 100).toFixed(1)),
      B: parseFloat(((cv / maxV) * 100).toFixed(1)),
      rawA: av, rawB: cv, unit: m.unit,
      labelA: 'Atleta A', labelB: compareLabel || 'Atleta B',
    }
  })
}

function SingleRadar({ athleteData, compData, compLabel, compColor = '#94a3b8', nameA = 'Atleta', isDual = false }) {
  if (!athleteData) return (
    <div className="flex items-center justify-center h-48 text-slate-300 text-sm">Sem dados GPS</div>
  )
  const radarPoints = buildRadarPointsDual(athleteData, compData || athleteData, compLabel)

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    const item = radarPoints.find(d => d.subject === label)
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-2 text-xs shadow-lg z-50">
        <p className="font-black text-black mb-1">{label}</p>
        <p style={{ color: '#f59e0b' }} className="font-bold">
          {nameA}: {item?.rawA?.toFixed(1)} {item?.unit}
        </p>
        {compData && (
          <p style={{ color: compColor }} className="font-bold">
            {compLabel}: {item?.rawB?.toFixed(1)} {item?.unit}
          </p>
        )}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={radarPoints} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        {compData && <Radar name={compLabel} dataKey="B" stroke={compColor} fill={compColor} fillOpacity={0.2} strokeWidth={1.5} />}
        <Radar name={nameA} dataKey="A" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.35} strokeWidth={2} />
        <RTooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 10, fontWeight: 'bold' }} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

function PlayerRadarChart({ athleteData, compTeamData, compPosData, athletePosition, athleteName }) {
  if (!athleteData) return (
    <div className="flex items-center justify-center h-48 text-slate-300 text-sm">Sem dados GPS para gerar radar</div>
  )
  const shortName = athleteName ? athleteName.split(' ')[0] : 'Atleta'
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="border border-slate-100 rounded-xl p-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 text-center">vs Média da Equipe</p>
        <SingleRadar athleteData={athleteData} compData={compTeamData} compLabel="Média Equipe" compColor="#94a3b8" nameA={shortName} />
        <p className="text-[9px] text-slate-400 text-center mt-1">Valores relativos ao máximo entre atleta e grupo</p>
      </div>
      <div className="border border-slate-100 rounded-xl p-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 text-center">
          vs Média da Posição {athletePosition ? <span className="text-amber-600">({athletePosition})</span> : ''}
        </p>
        {compPosData
          ? <SingleRadar athleteData={athleteData} compData={compPosData} compLabel={athletePosition ? `Média ${athletePosition}` : 'Média Posição'} compColor="#6366f1" nameA={shortName} />
          : <div className="flex flex-col items-center justify-center h-48 text-slate-300 text-sm gap-2">
              <span>Posição não identificada</span>
              {!athletePosition && <span className="text-[10px] text-slate-300">Configure a posição no modal ⚙</span>}
            </div>
        }
        <p className="text-[9px] text-slate-400 text-center mt-1">
          {compPosData ? 'Comparação com atletas da mesma posição' : 'Carregue sessões com "Position Name" ou configure manualmente'}
        </p>
      </div>
    </div>
  )
}

// ─── FIGURA ANATÔMICA REALISTA ────────────────────────────────────────────────
// Desenha um boneco humano com proporções anatômicas usando paths SVG curvos
function BodyShape({ cx }) {
  const s = `
    M ${cx} 14 
    m 0 0
  `.trim() // apenas para localização de referência

  return (
    <g>
      {/* ── CABEÇA ── */}
      <circle cx={cx} cy={36} r={22} fill="#dde4ef" stroke="#8fa3be" strokeWidth="1.5"/>
      {/* orelhas */}
      <ellipse cx={cx - 23} cy={38} rx={5} ry={8} fill="#d0d9e8" stroke="#8fa3be" strokeWidth="1"/>
      <ellipse cx={cx + 23} cy={38} rx={5} ry={8} fill="#d0d9e8" stroke="#8fa3be" strokeWidth="1"/>

      {/* ── PESCOÇO ── */}
      <path d={`M ${cx-8} 57 C ${cx-8} 57 ${cx-6} 72 ${cx-6} 74 L ${cx+6} 74 C ${cx+6} 72 ${cx+8} 57 ${cx+8} 57 Z`}
        fill="#dde4ef" stroke="#8fa3be" strokeWidth="1"/>

      {/* ── TRONCO (ombros → quadril com curvas naturais) ── */}
      <path d={`
        M ${cx-8} 73
        C ${cx-28} 74 ${cx-48} 78 ${cx-54} 90
        C ${cx-60} 104 ${cx-58} 120 ${cx-52} 132
        L ${cx-42} 158
        C ${cx-38} 172 ${cx-40} 190 ${cx-42} 208
        L ${cx+42} 208
        C ${cx+40} 190 ${cx+38} 172 ${cx+42} 158
        L ${cx+52} 132
        C ${cx+58} 120 ${cx+60} 104 ${cx+54} 90
        C ${cx+48} 78 ${cx+28} 74 ${cx+8} 73
        Z
      `} fill="#dde4ef" stroke="#8fa3be" strokeWidth="1.5"/>

      {/* ── BRAÇO ESQUERDO (braço direito do jogador, lado direito da tela) ── */}
      {/* Parte superior */}
      <path d={`
        M ${cx+42} 84
        C ${cx+52} 84 ${cx+68} 94 ${cx+76} 112
        L ${cx+82} 148
        C ${cx+84} 158 ${cx+80} 170 ${cx+74} 172
        L ${cx+64} 172
        C ${cx+68} 164 ${cx+70} 154 ${cx+68} 144
        L ${cx+62} 108
        C ${cx+58} 94 ${cx+46} 86 ${cx+36} 84
        Z
      `} fill="#dde4ef" stroke="#8fa3be" strokeWidth="1.2"/>
      {/* Antebraço */}
      <path d={`
        M ${cx+74} 172 L ${cx+64} 172
        C ${cx+66} 186 ${cx+70} 210 ${cx+72} 224
        C ${cx+73} 232 ${cx+76} 237 ${cx+80} 237
        C ${cx+84} 237 ${cx+87} 232 ${cx+88} 224
        L ${cx+84} 186 Z
      `} fill="#dde4ef" stroke="#8fa3be" strokeWidth="1.2"/>

      {/* ── BRAÇO DIREITO (braço esquerdo do jogador, lado esquerdo da tela) ── */}
      <path d={`
        M ${cx-42} 84
        C ${cx-52} 84 ${cx-68} 94 ${cx-76} 112
        L ${cx-82} 148
        C ${cx-84} 158 ${cx-80} 170 ${cx-74} 172
        L ${cx-64} 172
        C ${cx-68} 164 ${cx-70} 154 ${cx-68} 144
        L ${cx-62} 108
        C ${cx-58} 94 ${cx-46} 86 ${cx-36} 84
        Z
      `} fill="#dde4ef" stroke="#8fa3be" strokeWidth="1.2"/>
      <path d={`
        M ${cx-74} 172 L ${cx-64} 172
        C ${cx-66} 186 ${cx-70} 210 ${cx-72} 224
        C ${cx-73} 232 ${cx-76} 237 ${cx-80} 237
        C ${cx-84} 237 ${cx-87} 232 ${cx-88} 224
        L ${cx-84} 186 Z
      `} fill="#dde4ef" stroke="#8fa3be" strokeWidth="1.2"/>

      {/* ── QUADRIL / PELVE ── */}
      <path d={`
        M ${cx-42} 207
        C ${cx-42} 218 ${cx-40} 230 ${cx-36} 236
        L ${cx+36} 236
        C ${cx+40} 230 ${cx+42} 218 ${cx+42} 207
        Z
      `} fill="#d4dce9" stroke="#8fa3be" strokeWidth="1.2"/>

      {/* ── COXA DIREITA (lado esquerdo tela = perna esq. jogador) ── */}
      <path d={`
        M ${cx-36} 234
        C ${cx-24} 232 ${cx-10} 232 ${cx-8} 234
        C ${cx-6} 262 ${cx-6} 288 ${cx-10} 316
        C ${cx-12} 322 ${cx-18} 326 ${cx-22} 326
        C ${cx-26} 326 ${cx-32} 322 ${cx-34} 316
        C ${cx-36} 288 ${cx-36} 262 ${cx-36} 234
        Z
      `} fill="#dde4ef" stroke="#8fa3be" strokeWidth="1.2"/>

      {/* ── COXA ESQUERDA (lado direito tela = perna dir. jogador) ── */}
      <path d={`
        M ${cx+8} 234
        C ${cx+10} 232 ${cx+24} 232 ${cx+36} 234
        C ${cx+36} 262 ${cx+36} 288 ${cx+34} 316
        C ${cx+32} 322 ${cx+26} 326 ${cx+22} 326
        C ${cx+18} 326 ${cx+12} 322 ${cx+10} 316
        C ${cx+6} 288 ${cx+6} 262 ${cx+8} 234
        Z
      `} fill="#dde4ef" stroke="#8fa3be" strokeWidth="1.2"/>

      {/* ── JOELHOS ── */}
      <ellipse cx={cx-22} cy={327} rx={14} ry={10} fill="#c8d5e5" stroke="#8fa3be" strokeWidth="1"/>
      <ellipse cx={cx+22} cy={327} rx={14} ry={10} fill="#c8d5e5" stroke="#8fa3be" strokeWidth="1"/>

      {/* ── PERNA DIREITA (esq. jogador) ── */}
      <path d={`
        M ${cx-36} 336
        C ${cx-36} 352 ${cx-34} 372 ${cx-28} 386
        C ${cx-26} 394 ${cx-22} 398 ${cx-18} 398
        C ${cx-14} 398 ${cx-10} 394 ${cx-12} 386
        C ${cx-10} 372 ${cx-10} 352 ${cx-10} 336
        Z
      `} fill="#dde4ef" stroke="#8fa3be" strokeWidth="1.2"/>

      {/* ── PERNA ESQUERDA (dir. jogador) ── */}
      <path d={`
        M ${cx+10} 336
        C ${cx+10} 352 ${cx+10} 372 ${cx+12} 386
        C ${cx+10} 394 ${cx+14} 398 ${cx+18} 398
        C ${cx+22} 398 ${cx+26} 394 ${cx+28} 386
        C ${cx+34} 372 ${cx+36} 352 ${cx+36} 336
        Z
      `} fill="#dde4ef" stroke="#8fa3be" strokeWidth="1.2"/>

      {/* ── TORNOZELOS / PÉS ── */}
      <ellipse cx={cx-20} cy={402} rx={16} ry={8} fill="#c8d5e5" stroke="#8fa3be" strokeWidth="1"/>
      <ellipse cx={cx+20} cy={402} rx={16} ry={8} fill="#c8d5e5" stroke="#8fa3be" strokeWidth="1"/>
      <ellipse cx={cx-22} cy={410} rx={14} ry={6} fill="#bcc8dc" stroke="#8fa3be" strokeWidth="1"/>
      <ellipse cx={cx+22} cy={410} rx={14} ry={6} fill="#bcc8dc" stroke="#8fa3be" strokeWidth="1"/>
    </g>
  )
}

function BodyBack({ cx }) {
  return (
    <g>
      {/* Reutiliza a mesma forma com leve detalhe adicional nas costas */}
      <BodyShape cx={cx} />
      {/* Linha da coluna vertebral (costas) */}
      <path d={`M ${cx} 74 L ${cx} 208`} stroke="#a0b3cc" strokeWidth="1" strokeDasharray="3,3"/>
      {/* Escápulas */}
      <path d={`M ${cx-14} 88 C ${cx-28} 92 ${cx-34} 106 ${cx-30} 118 C ${cx-26} 126 ${cx-16} 126 ${cx-10} 120`}
        fill="none" stroke="#9ab0c8" strokeWidth="1.2"/>
      <path d={`M ${cx+14} 88 C ${cx+28} 92 ${cx+34} 106 ${cx+30} 118 C ${cx+26} 126 ${cx+16} 126 ${cx+10} 120`}
        fill="none" stroke="#9ab0c8" strokeWidth="1.2"/>
    </g>
  )
}

function AnatomyFigure({ activeRegions, hoveredRegion, onHover }) {
  const maxCount = Math.max(...Object.values(activeRegions), 1)

  function dotColor(code) {
    const c = activeRegions[code]; if (!c) return null
    const i = c / maxCount
    return i > 0.66 ? '#dc2626' : i > 0.33 ? '#f97316' : '#fbbf24'
  }

  return (
    <div>
      <div className="flex justify-around text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 px-4">
        <span>FRENTE</span><span>COSTAS</span>
      </div>
      <svg viewBox="0 0 500 430" className="w-full max-w-sm mx-auto block" style={{ maxHeight: 360 }}>

        {/* ── FRENTE (cx=125) ── */}
        <BodyShape cx={125} />

        {/* Divisor */}
        <line x1="250" y1="0" x2="250" y2="430" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="5,3" />

        {/* ── COSTAS (cx=375) ── */}
        <BodyBack cx={375} />

        {/* ── PONTOS DE DOR ── */}
        {Object.entries(ANATOMY_POINTS).map(([code, pos]) => {
          const color = dotColor(code)
          const count = activeRegions[code] || 0
          const isHov = hoveredRegion === code
          if (!color && !isHov) return null
          return (
            <g key={code} onMouseEnter={() => onHover(code)} onMouseLeave={() => onHover(null)} style={{ cursor: 'pointer' }}>
              {/* Halo de destaque */}
              {(color || isHov) && (
                <circle cx={pos.x} cy={pos.y} r={isHov ? 14 : 10}
                  fill={color || '#fbbf24'} fillOpacity={0.2} />
              )}
              <circle cx={pos.x} cy={pos.y} r={isHov ? 9 : 6}
                fill={color || '#fbbf24'} fillOpacity={color ? 0.92 : 0.5}
                stroke="white" strokeWidth="1.5" />
              {count > 1 && (
                <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize="7" fontWeight="bold" fill="white">{count}</text>
              )}
              {isHov && (
                <g>
                  <rect x={pos.x - 36} y={pos.y - 26} width="72" height="16" rx="4"
                    fill="rgba(15,23,42,0.85)" />
                  <text x={pos.x} y={pos.y - 15} textAnchor="middle" fontSize="9" fontWeight="bold" fill="white">
                    {pos.label}
                  </text>
                </g>
              )}
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
  const { gpsData, bemEstarData, vmaxBaseline, playerPositions: ctxPositions, isExcluded } = useData()
  const [activeTab, setActiveTab] = useState('visao')
  const [hoveredRegion, setHoveredRegion] = useState(null)
  const [showPositionConfig, setShowPositionConfig] = useState(false)
  const [sortGps, setSortGps] = useState({ col: 'sessionDate', dir: 'desc' })
  const [sortBem, setSortBem] = useState({ col: 'date', dir: 'desc' })
  // Posições: usa as do contexto (CSV) mas permite override manual
  const [positionOverrides, setPositionOverrides] = useState({})

  function toggleSort(current, col, setter) {
    setter(current.col === col ? { col, dir: current.dir === 'desc' ? 'asc' : 'desc' } : { col, dir: 'desc' })
  }

  const allAthletes = useMemo(() => {
    const names = new Set([
      ...bemEstarData.map(r => r.playerName),
      ...gpsData.flatMap(s => s.rows.filter(r => !r.isOutlier).map(r => r.playerName))
    ])
    return Array.from(names).filter(n => n && !isExcluded(n)).sort()
  }, [bemEstarData, gpsData, isExcluded])

  const [selectedAthlete, setSelectedAthlete] = useState(() => searchParams.get('atleta') || '')
  const [compareAthlete, setCompareAthlete] = useState('')
  const athlete = selectedAthlete || allAthletes[0] || ''
  const compareMode = !!(compareAthlete && compareAthlete !== athlete)

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

  // ── ALERTA DE TENDÊNCIA: 3+ sessões seguidas abaixo da média do grupo ────────
  const trendAlert = useMemo(() => {
    if (gpsHistory.length < 3) return null
    const last3 = gpsHistory.slice(-3)

    // Média do grupo por métrica (todas as sessões, excluindo o próprio atleta)
    const groupRows = gpsData.flatMap(s => s.rows.filter(r => r.playerName !== athlete && r.periodNumber === 0 && !r.isOutlier))
    if (!groupRows.length) return null

    const alerts = []
    const checkMetric = (key, label, unit) => {
      const groupAvg = groupRows.reduce((s, r) => s + (r[key] || 0), 0) / groupRows.length
      if (!groupAvg) return
      const allBelow = last3.every(r => (r[key] || 0) < groupAvg * 0.85)
      if (allBelow) {
        const lastVal = last3[last3.length - 1][key] || 0
        const pct = Math.round((lastVal / groupAvg) * 100)
        alerts.push({ metric: label, value: lastVal.toFixed(key === 'distanceRelative' ? 1 : 0), unit, pct, groupAvg: groupAvg.toFixed(key === 'distanceRelative' ? 1 : 0) })
      }
    }
    checkMetric('totalDistance',    'Distância Total', 'm')
    checkMetric('hsr',              'HSR',             'm')
    checkMetric('distanceRelative', 'm/min',           'm/min')
    checkMetric('sprintDistance',   'Sprint',          'm')
    checkMetric('playerLoad',       'Player Load',     '')
    return alerts.length ? alerts : null
  }, [gpsHistory, gpsData, athlete])

  // ── GRÁFICO DE EVOLUÇÃO TEMPORAL (últimas 12 sessões) ───────────────────────
  const temporalChartData = useMemo(() => {
    const last12 = gpsHistory.slice(-12)
    if (last12.length < 2) return null

    const groupRows = gpsData.flatMap(s => s.rows.filter(r => r.playerName !== athlete && r.periodNumber === 0 && !r.isOutlier))
    const groupAvgDist   = groupRows.length ? groupRows.reduce((s,r) => s+(r.totalDistance||0),0)/groupRows.length : null
    const groupAvgHsr    = groupRows.length ? groupRows.reduce((s,r) => s+(r.hsr||0),0)/groupRows.length : null
    const groupAvgMmin   = groupRows.length ? groupRows.reduce((s,r) => s+(r.distanceRelative||0),0)/groupRows.length : null
    const groupAvgPl     = groupRows.length ? groupRows.reduce((s,r) => s+(r.playerLoad||0),0)/groupRows.length : null

    return {
      points: last12.map(r => ({
        label: r.sessionDate ? r.sessionDate.slice(0, 5) : '?',
        dist:  Math.round(r.totalDistance || 0),
        hsr:   Math.round(r.hsr || 0),
        mmin:  parseFloat((r.distanceRelative || 0).toFixed(1)),
        pl:    Math.round(r.playerLoad || 0),
      })),
      avgs: { dist: groupAvgDist, hsr: groupAvgHsr, mmin: groupAvgMmin, pl: groupAvgPl },
    }
  }, [gpsHistory, gpsData, athlete])

  // Merge: CSV positions + manual overrides
  const playerPositions = useMemo(() => ({ ...ctxPositions, ...positionOverrides }), [ctxPositions, positionOverrides])

  const vmaxMax = vmaxBaseline[athlete] || null
  const latestGps = gpsHistory[gpsHistory.length - 1] || null
  const vmaxPct = latestGps && vmaxMax ? calcVmaxPct(latestGps.maxVelocity, vmaxMax) : null

  // ─── DOR ─────────────────────────────────────────────────────────────────────
  const painCodeMap = useMemo(() => {
    const map = {}
    for (const r of wellinessHistory) {
      if (!r.temDor || !r.dorLocalizada) continue
      const parts = r.dorLocalizada.split(',').map(p => p.trim())
      for (const part of parts) {
        if (!part || part === '0 - Sem dor') continue
        const code = part.split(' - ')[0].trim()
        if (ANATOMY_POINTS[code]) {
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

  // ── TIMELINE DE LESÕES ───────────────────────────────────────────────────────
  // Agrupa episódios por região do corpo, em ordem cronológica
  const injuryTimeline = useMemo(() => {
    // Monta lista de eventos: { date, codes: [code,...], labels: [label,...], wellnessScore }
    const events = []
    const sorted = [...wellinessHistory].filter(r => r.temDor && r.dorLocalizada).sort((a, b) => a.date.localeCompare(b.date))
    for (const r of sorted) {
      const parts = r.dorLocalizada.split(',').map(p => p.trim()).filter(p => p && p !== '0 - Sem dor')
      const codes = []
      const labels = []
      for (const part of parts) {
        const code = part.split(' - ')[0].trim()
        if (ANATOMY_POINTS[code]) {
          codes.push(code)
          labels.push(DOR_LABELS[code] || code)
        } else {
          for (const [k, v] of Object.entries(DOR_LABELS)) {
            if (part.toLowerCase().includes(v.toLowerCase())) {
              codes.push(k); labels.push(v); break
            }
          }
        }
      }
      if (codes.length > 0) events.push({ date: r.date, codes, labels, wellnessScore: r.wellnessScore })
    }

    // Agrupa por região (código): lista de datas em que apareceu
    const byRegion = {}
    for (const ev of events) {
      for (let i = 0; i < ev.codes.length; i++) {
        const code = ev.codes[i]
        if (!byRegion[code]) byRegion[code] = { code, label: ev.labels[i], dates: [] }
        byRegion[code].dates.push(ev.date)
      }
    }
    // Ordena por frequência desc
    return {
      events,
      byRegion: Object.values(byRegion).sort((a, b) => b.dates.length - a.dates.length),
    }
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

  const compTeamData = useMemo(() => {
    const rows = gpsData.flatMap(s => s.rows.filter(r => r.playerName !== athlete && r.periodNumber === 0 && !r.isOutlier))
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
  }, [gpsData, athlete])

  const compPosData = useMemo(() => {
    if (!athletePosition) return null
    const rows = gpsData.flatMap(s => s.rows.filter(r => {
      if (r.playerName === athlete || r.periodNumber !== 0 || r.isOutlier) return false
      // posição vem do CSV ou do playerPositions
      const pos = r.positionName || playerPositions[r.playerName]
      return pos === athletePosition
    }))
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
  }, [gpsData, athlete, athletePosition, playerPositions])

  // ─── DADOS DO ATLETA DE COMPARAÇÃO ───────────────────────────────────────────
  const compareGpsHistory = useMemo(() => {
    if (!compareMode) return []
    return gpsData
      .flatMap(s => s.rows.filter(r => r.playerName === compareAthlete && r.periodNumber === 0 && !r.isOutlier))
      .sort((a, b) => new Date(a.sessionDate?.split('/').reverse().join('-')) - new Date(b.sessionDate?.split('/').reverse().join('-')))
  }, [gpsData, compareAthlete, compareMode])

  const compareWellnessHistory = useMemo(() => {
    if (!compareMode) return []
    return bemEstarData
      .filter(r => r.playerName === compareAthlete && r.type === 'pre')
      .sort((a, b) => a.timestamp - b.timestamp).slice(-60)
  }, [bemEstarData, compareAthlete, compareMode])

  const compareRadarData = useMemo(() => {
    if (!compareMode || !compareGpsHistory.length) return null
    const n = compareGpsHistory.length
    return {
      distanceRelative: compareGpsHistory.reduce((s, r) => s + (r.distanceRelative || 0), 0) / n,
      hsr: compareGpsHistory.reduce((s, r) => s + (r.hsr || 0), 0) / n,
      sprintDistance: compareGpsHistory.reduce((s, r) => s + (r.sprintDistance || 0), 0) / n,
      accDecel: compareGpsHistory.reduce((s, r) => s + (r.acceleration || 0) + (r.deceleration || 0), 0) / n,
      playerLoad: compareGpsHistory.reduce((s, r) => s + (r.playerLoad || 0), 0) / n,
      maxVelocity: compareGpsHistory.reduce((s, r) => s + (r.maxVelocity || 0), 0) / n,
    }
  }, [compareGpsHistory, compareMode])

  const compareStats = useMemo(() => {
    if (!compareMode) return null
    const wellScores = compareWellnessHistory.map(r => r.wellnessScore).filter(Boolean)
    const lastWell = compareWellnessHistory[compareWellnessHistory.length - 1]
    const latestGpsC = compareGpsHistory[compareGpsHistory.length - 1] || null
    const vmaxMaxC = vmaxBaseline[compareAthlete] || null
    return {
      avgWellness: wellScores.length ? wellScores.reduce((a, b) => a + b, 0) / wellScores.length : null,
      lastWellnessScore: lastWell?.wellnessScore ?? null,
      gpsCount: compareGpsHistory.length,
      wellCount: compareWellnessHistory.length,
      avgDist: compareGpsHistory.length ? compareGpsHistory.reduce((s, r) => s + (r.totalDistance || 0), 0) / compareGpsHistory.length : null,
      avgHsr: compareGpsHistory.length ? compareGpsHistory.reduce((s, r) => s + (r.hsr || 0), 0) / compareGpsHistory.length : null,
      avgMmin: compareGpsHistory.length ? compareGpsHistory.reduce((s, r) => s + (r.distanceRelative || 0), 0) / compareGpsHistory.length : null,
      vmaxBaseline: vmaxMaxC,
      lastVmax: latestGpsC?.maxVelocity ?? null,
    }
  }, [compareMode, compareWellnessHistory, compareGpsHistory, vmaxBaseline, compareAthlete])
  const lastWellness = wellinessHistory[wellinessHistory.length - 1]
  const wellScores = wellinessHistory.map(r => r.wellnessScore).filter(Boolean)
  const avgWellness = wellScores.length ? wellScores.reduce((a, b) => a + b, 0) / wellScores.length : null

  // ── ÍNDICE DE RECUPERAÇÃO ────────────────────────────────────────────────────
  // Compara pares consecutivos de wellness pré para mostrar tendência de recuperação
  const recoveryIndex = useMemo(() => {
    const pre = wellinessHistory.filter(r => r.wellnessScore != null).sort((a, b) => a.date.localeCompare(b.date))
    if (pre.length < 2) return null
    const last = pre[pre.length - 1]
    const prev = pre[pre.length - 2]
    const delta = parseFloat((last.wellnessScore - prev.wellnessScore).toFixed(2))
    const daysDiff = Math.round(
      (new Date(last.date + 'T12:00:00') - new Date(prev.date + 'T12:00:00')) / (1000 * 60 * 60 * 24)
    )
    // Tendência dos últimos 5 pares (média dos deltas)
    const pairs = []
    for (let i = pre.length - 1; i >= 1 && pairs.length < 5; i--) {
      pairs.push(pre[i].wellnessScore - pre[i - 1].wellnessScore)
    }
    const avgTrend = pairs.length ? pairs.reduce((a, b) => a + b, 0) / pairs.length : 0
    // Sparkline dos últimos 8 deltas
    const sparkline = pre.slice(-9).map((r, i, arr) =>
      i === 0 ? null : parseFloat((r.wellnessScore - arr[i - 1].wellnessScore).toFixed(2))
    ).filter(v => v !== null)
    return { delta, daysDiff, avgTrend, sparkline, lastScore: last.wellnessScore, prevScore: prev.wellnessScore }
  }, [wellinessHistory])

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
          <select value={athlete} onChange={e => { setSelectedAthlete(e.target.value); if (e.target.value === compareAthlete) setCompareAthlete('') }}
            className="border-2 border-amber-500 rounded-lg px-3 py-1.5 text-sm font-black text-black bg-white focus:outline-none max-w-[220px]">
            <option value="">Selecionar atleta...</option>
            {allAthletes.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {/* Seletor de comparação */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">vs</span>
            <select
              value={compareAthlete}
              onChange={e => setCompareAthlete(e.target.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-black bg-white focus:outline-none max-w-[220px] transition-all ${compareMode ? 'border-2 border-blue-400 text-blue-700' : 'border border-slate-200 text-slate-400'}`}
            >
              <option value="">Comparar com...</option>
              {allAthletes.filter(a => a !== athlete).map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            {compareMode && (
              <button onClick={() => setCompareAthlete('')} className="text-slate-400 hover:text-red-500 font-black text-sm transition-colors">✕</button>
            )}
          </div>
        </div>
      </header>

      {/* MODAL POSIÇÕES */}
      {showPositionConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-slate-200 p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-black uppercase tracking-tighter">Configurar Posições</h3>
              <button onClick={() => setShowPositionConfig(false)} className="text-slate-400 hover:text-slate-700 font-black text-lg">✕</button>
            </div>
            <p className="text-xs text-slate-500 mb-4">Atribua posições para comparação no radar por função tática.</p>
            <div className="flex flex-col gap-2">
              {allAthletes.map(a => (
                <div key={a} className="flex items-center gap-3">
                  <span className="text-xs font-bold flex-1 truncate">{a}</span>
                  <select value={playerPositions[a] || ''} onChange={e => setPositionOverrides(prev => ({ ...prev, [a]: e.target.value || undefined }))}
                    className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold bg-white focus:border-amber-400 focus:outline-none">
                    <option value="">— Posição —</option>
                    {POSICOES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setShowPositionConfig(false)} className="px-5 py-2 bg-amber-500 text-black text-xs font-black uppercase tracking-widest rounded-xl hover:bg-amber-400">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="col-span-2 bg-slate-50 border-2 border-slate-200 rounded-xl p-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Atleta</p>
          <div className="flex items-center gap-4 flex-wrap">
            <AthleteAvatar name={athlete} size="w-20 h-20" ring className="border-2 border-white shadow-md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-xl font-black">{athlete}</p>
                {athletePosition && <span className="bg-amber-100 text-amber-700 text-xs font-black px-2 py-0.5 rounded-lg uppercase">{athletePosition}</span>}
              </div>
              <div className="mt-3 flex gap-3 flex-wrap">
                {vmaxMax && <div className="bg-amber-50 border border-amber-200 rounded-lg px-2 py-1"><p className="text-[9px] font-black text-amber-700 uppercase">Vmax baseline</p><p className="text-sm font-black text-amber-800">{vmaxMax.toFixed(1)} km/h</p></div>}
                {vmaxPct && <div className={`border rounded-lg px-2 py-1 ${vmaxPct >= 90 ? 'bg-green-50 border-green-200' : vmaxPct >= 80 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}><p className="text-[9px] font-black text-slate-600 uppercase">Últ. % Vmax</p><p className={`text-sm font-black ${vmaxPct >= 90 ? 'text-green-700' : vmaxPct >= 80 ? 'text-amber-700' : 'text-slate-600'}`}>{vmaxPct}%</p></div>}
                {lastWellness && <div className={`border rounded-lg px-2 py-1 ${scoreBg(lastWellness.wellnessScore)}`}><p className="text-[9px] font-black uppercase">Bem-estar último</p><p className="text-sm font-black">{lastWellness.wellnessScore?.toFixed(1) ?? '—'}</p></div>}
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1"><p className="text-[9px] font-black text-slate-500 uppercase">Registros</p><p className="text-sm font-black">{wellinessHistory.length} bem-estar · {gpsHistory.length} GPS</p></div>
              </div>
            </div>
          </div>
        </div>
        <div className={`border-2 rounded-xl p-4 ${scoreBg(lastWellness?.wellnessScore)}`}>
          <p className="text-[9px] font-black uppercase tracking-widest mb-1 opacity-60">Bem-Estar (último)</p>
          <p className="text-3xl font-black">{lastWellness?.wellnessScore?.toFixed(1) ?? '—'}</p>
          <p className="text-[10px] mt-1 opacity-70">Média 30d: {avgWellness ? avgWellness.toFixed(1) : '—'}</p>
          {recoveryIndex && (
            <div className={`mt-2 flex items-center gap-1.5 text-[10px] font-black ${recoveryIndex.delta > 0.3 ? 'text-green-700' : recoveryIndex.delta < -0.3 ? 'text-red-600' : 'text-slate-500'}`}>
              <span>{recoveryIndex.delta > 0.3 ? '↑' : recoveryIndex.delta < -0.3 ? '↓' : '→'}</span>
              <span>{recoveryIndex.delta > 0 ? '+' : ''}{recoveryIndex.delta.toFixed(1)} em {recoveryIndex.daysDiff}d</span>
            </div>
          )}
        </div>
        <div className={`border-2 rounded-xl p-4 ${Object.keys(painCodeMap).length > 0 ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200'}`}>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Dores relatadas</p>
          <p className={`text-3xl font-black ${Object.keys(painCodeMap).length > 0 ? 'text-orange-600' : 'text-black'}`}>{wellinessHistory.filter(r => r.temDor).length}</p>
          <p className="text-[10px] text-slate-500 mt-1">{Object.keys(painCodeMap).length} regiões afetadas</p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {[
          { id: 'visao', label: 'Visão Geral' },
          { id: 'gps', label: 'GPS & Carga' },
          { id: 'bemEstar', label: 'Bem-Estar' },
          { id: 'dor', label: `Dor Localizada${Object.keys(painCodeMap).length > 0 ? ` (${Object.keys(painCodeMap).length} regiões)` : ''}` },
          { id: 'lesoes', label: `📅 Histórico de Lesões${painHistory.length > 0 ? ` (${painHistory.length})` : ''}` },
          { id: 'cmj', label: '🦵 CMJ — Fadiga' },
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
          {/* Radar — modo normal vs modo comparação */}
          <div className="border border-slate-200 rounded-xl p-4 md:col-span-2">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                Radar de Métricas Físicas
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {compareMode && (
                  <span className="text-[9px] bg-blue-100 text-blue-700 border border-blue-200 px-2 py-1 rounded-lg font-black uppercase">
                    Modo Comparação: {athlete.split(' ')[0]} vs {compareAthlete.split(' ')[0]}
                  </span>
                )}
                {athletePosition && !compareMode
                  ? <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-1 rounded-lg font-bold uppercase">{athletePosition}</span>
                  : !compareMode && <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-1 rounded-lg font-bold">Configure a posição no ⚙ para ver radar por posição</span>
                }
              </div>
            </div>

            {compareMode && compareRadarData ? (
              /* MODO COMPARAÇÃO: um radar único com as duas séries sobrepostas */
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                  {/* Card atleta A */}
                  <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <AthleteAvatar name={athlete} size="w-10 h-10" ring />
                    <div>
                      <p className="text-xs font-black text-black">{athlete.split(' ').slice(0,2).join(' ')}</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {radarData && RADAR_METRICS.slice(0,3).map(m => (
                          <span key={m.key} className="text-[9px] font-bold text-amber-700">
                            {m.label}: <span className="font-black">{radarData[m.key]?.toFixed(m.key === 'distanceRelative' || m.key === 'maxVelocity' ? 1 : 0)}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="ml-auto w-3 h-3 rounded-full bg-amber-400 flex-shrink-0" />
                  </div>
                  {/* Card atleta B */}
                  <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                    <AthleteAvatar name={compareAthlete} size="w-10 h-10" ring />
                    <div>
                      <p className="text-xs font-black text-black">{compareAthlete.split(' ').slice(0,2).join(' ')}</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {compareRadarData && RADAR_METRICS.slice(0,3).map(m => (
                          <span key={m.key} className="text-[9px] font-bold text-blue-700">
                            {m.label}: <span className="font-black">{compareRadarData[m.key]?.toFixed(m.key === 'distanceRelative' || m.key === 'maxVelocity' ? 1 : 0)}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="ml-auto w-3 h-3 rounded-full bg-blue-400 flex-shrink-0" />
                  </div>
                </div>

                {/* Radar único sobreposto */}
                <div className="border border-slate-100 rounded-xl p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 text-center">Radar comparativo — histórico completo</p>
                  <SingleRadar
                    athleteData={radarData}
                    compData={compareRadarData}
                    compLabel={compareAthlete.split(' ')[0]}
                    compColor="#3b82f6"
                    nameA={athlete.split(' ')[0]}
                  />
                  <p className="text-[9px] text-slate-400 text-center mt-1">Valores normalizados pelo máximo entre os dois atletas por métrica</p>
                </div>

                {/* Tabela de comparação direta */}
                <div className="border border-slate-100 rounded-xl p-4 overflow-x-auto">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Médias históricas — face a face</p>
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b-2 border-slate-900">
                        <th className="text-left py-2 pr-4 font-black uppercase tracking-widest text-[10px] text-slate-500">Métrica</th>
                        <th className="text-center py-2 px-3 font-black uppercase tracking-widest text-[10px] text-amber-600">{athlete.split(' ')[0]}</th>
                        <th className="text-center py-2 px-3 font-black uppercase tracking-widest text-[10px] text-blue-600">{compareAthlete.split(' ')[0]}</th>
                        <th className="text-center py-2 px-3 font-black uppercase tracking-widest text-[10px] text-slate-400">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {RADAR_METRICS.map(m => {
                        const vA = radarData?.[m.key] ?? null
                        const vB = compareRadarData?.[m.key] ?? null
                        const delta = vA != null && vB != null ? vA - vB : null
                        const fmt = v => v == null ? '—' : (m.key === 'distanceRelative' || m.key === 'maxVelocity' ? v.toFixed(1) : v.toFixed(0))
                        const aWins = delta != null && delta > 0
                        const bWins = delta != null && delta < 0
                        return (
                          <tr key={m.key} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-2 pr-4 font-bold text-slate-600">{m.label} <span className="text-slate-400 font-normal">{m.unit}</span></td>
                            <td className={`text-center py-2 px-3 font-black ${aWins ? 'text-amber-600 bg-amber-50 rounded' : 'text-slate-700'}`}>{fmt(vA)}</td>
                            <td className={`text-center py-2 px-3 font-black ${bWins ? 'text-blue-600 bg-blue-50 rounded' : 'text-slate-700'}`}>{fmt(vB)}</td>
                            <td className={`text-center py-2 px-3 font-black text-[10px] ${aWins ? 'text-amber-500' : bWins ? 'text-blue-500' : 'text-slate-400'}`}>
                              {delta != null ? `${delta > 0 ? '+' : ''}${fmt(delta)}` : '—'}
                            </td>
                          </tr>
                        )
                      })}
                      {/* Bem-estar */}
                      <tr className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2 pr-4 font-bold text-slate-600">Bem-estar médio <span className="text-slate-400 font-normal">/5</span></td>
                        <td className={`text-center py-2 px-3 font-black ${avgWellness != null && compareStats?.avgWellness != null && avgWellness > compareStats.avgWellness ? 'text-amber-600 bg-amber-50 rounded' : 'text-slate-700'}`}>
                          {avgWellness?.toFixed(1) ?? '—'}
                        </td>
                        <td className={`text-center py-2 px-3 font-black ${compareStats?.avgWellness != null && avgWellness != null && compareStats.avgWellness > avgWellness ? 'text-blue-600 bg-blue-50 rounded' : 'text-slate-700'}`}>
                          {compareStats?.avgWellness?.toFixed(1) ?? '—'}
                        </td>
                        <td className="text-center py-2 px-3 text-slate-400 text-[10px] font-black">
                          {avgWellness != null && compareStats?.avgWellness != null
                            ? `${(avgWellness - compareStats.avgWellness) > 0 ? '+' : ''}${(avgWellness - compareStats.avgWellness).toFixed(1)}`
                            : '—'}
                        </td>
                      </tr>
                      <tr className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2 pr-4 font-bold text-slate-600">Sessões GPS</td>
                        <td className="text-center py-2 px-3 font-black text-slate-700">{gpsHistory.length}</td>
                        <td className="text-center py-2 px-3 font-black text-slate-700">{compareStats?.gpsCount ?? '—'}</td>
                        <td className="text-center py-2 px-3 text-slate-400 text-[10px] font-black">—</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* MODO NORMAL: radar vs equipe e vs posição */
              <PlayerRadarChart athleteData={radarData} compTeamData={compTeamData} compPosData={compPosData} athletePosition={athletePosition} athleteName={athlete} />
            )}
          </div>

          <div className="border border-slate-200 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">Tendência Bem-Estar (30 dias)</p>
              {recoveryIndex && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-black ${
                  recoveryIndex.delta > 0.3 ? 'bg-green-50 border-green-200 text-green-700' :
                  recoveryIndex.delta < -0.3 ? 'bg-red-50 border-red-200 text-red-600' :
                  'bg-slate-50 border-slate-200 text-slate-500'
                }`}>
                  <span>{recoveryIndex.delta > 0.3 ? '↑' : recoveryIndex.delta < -0.3 ? '↓' : '→'}</span>
                  <span>{recoveryIndex.delta > 0 ? '+' : ''}{recoveryIndex.delta.toFixed(1)} em {recoveryIndex.daysDiff}d</span>
                </div>
              )}
            </div>
            <Sparkline values={wellnessPoints} color="#f59e0b" height={48} />
            {recoveryIndex && recoveryIndex.sparkline.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-[9px] font-black uppercase text-slate-400 mb-1">
                  Δ Recuperação — últimas {recoveryIndex.sparkline.length} transições
                  {recoveryIndex.avgTrend !== 0 && (
                    <span className={`ml-2 ${recoveryIndex.avgTrend > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      tendência: {recoveryIndex.avgTrend > 0 ? '+' : ''}{recoveryIndex.avgTrend.toFixed(2)}/sessão
                    </span>
                  )}
                </p>
                <Sparkline
                  values={recoveryIndex.sparkline}
                  color={recoveryIndex.avgTrend >= 0 ? '#16a34a' : '#dc2626'}
                  height={28}
                />
                <p className="text-[9px] text-slate-400 mt-1">
                  {recoveryIndex.prevScore.toFixed(1)} → {recoveryIndex.lastScore.toFixed(1)} (último par)
                </p>
              </div>
            )}
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

              {/* ALERTA DE TENDÊNCIA */}
              {trendAlert && (
                <div className="mb-4 bg-amber-50 border-2 border-amber-300 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0">📉</span>
                    <div>
                      <p className="text-xs font-black text-amber-800 uppercase tracking-wide mb-1">
                        Alerta de Tendência — 3 sessões consecutivas abaixo da média do grupo
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {trendAlert.map((a, i) => (
                          <div key={i} className="bg-white border border-amber-200 rounded-lg px-2 py-1">
                            <span className="text-[10px] font-black text-amber-700">{a.metric}: </span>
                            <span className="text-[10px] font-black text-red-600">{a.value}{a.unit}</span>
                            <span className="text-[9px] text-slate-500"> ({a.pct}% da média {a.groupAvg}{a.unit})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* GRÁFICO DE EVOLUÇÃO TEMPORAL */}
              {temporalChartData && (
                <div className="mb-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Evolução — Últimas {temporalChartData.points.length} sessões</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { key: 'dist', label: 'Distância Total (m)', color: '#f59e0b', avg: temporalChartData.avgs.dist },
                      { key: 'hsr',  label: 'HSR (m)',             color: '#3b82f6', avg: temporalChartData.avgs.hsr },
                      { key: 'mmin', label: 'm/min',               color: '#10b981', avg: temporalChartData.avgs.mmin },
                      { key: 'pl',   label: 'Player Load',         color: '#06b6d4', avg: temporalChartData.avgs.pl },
                    ].map(({ key, label, color, avg }) => (
                      <div key={key} className="border border-slate-100 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                          {avg && <p className="text-[9px] font-bold text-slate-400">Média grupo: <span style={{color}}>{key === 'mmin' ? avg.toFixed(1) : Math.round(avg)}</span></p>}
                        </div>
                        <ResponsiveContainer width="100%" height={120}>
                          <LineChart data={temporalChartData.points} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <RTooltip
                              contentStyle={{ fontSize: 11, fontWeight: 'bold', border: '1px solid #e2e8f0', borderRadius: 8 }}
                              formatter={v => [key === 'mmin' ? v.toFixed(1) : v, label]}
                            />
                            {avg && (
                              <ReferenceLine
                                y={avg}
                                stroke={color}
                                strokeDasharray="4 2"
                                strokeOpacity={0.5}
                                label={{ value: 'Grupo', position: 'insideTopRight', fontSize: 7, fill: color }}
                              />
                            )}
                            <Line
                              type="monotone"
                              dataKey={key}
                              stroke={color}
                              strokeWidth={2}
                              dot={{ fill: color, r: 3 }}
                              activeDot={{ r: 5 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                  const pts = wellinessHistory.slice(-30).map(r => r[key] !== null ? (invert ? 6 - r[key] : r[key]) : null)
                  const last = pts.filter(Boolean).slice(-1)[0]
                  return (
                    <div key={key} className="border border-slate-200 rounded-xl p-3">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
                        <span className="text-sm font-black" style={{ color }}>{last?.toFixed(1) ?? '—'}</span>
                      </div>
                      <Sparkline values={pts} color={color} height={36} />
                    </div>
                  )
                })}
              </div>
              <div className="border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Histórico completo</p>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b-2 border-slate-200">
                        <SortTh label="Data" col="date" sort={sortBem} onSort={c => toggleSort(sortBem, c, setSortBem)} />
                        <SortTh label="Score" col="wellnessScore" sort={sortBem} onSort={c => toggleSort(sortBem, c, setSortBem)} />
                        <SortTh label="Sono" col="sono" sort={sortBem} onSort={c => toggleSort(sortBem, c, setSortBem)} />
                        <SortTh label="Fadiga" col="fadiga" sort={sortBem} onSort={c => toggleSort(sortBem, c, setSortBem)} />
                        <SortTh label="DOMS" col="doms" sort={sortBem} onSort={c => toggleSort(sortBem, c, setSortBem)} />
                        <SortTh label="Estresse" col="estresse" sort={sortBem} onSort={c => toggleSort(sortBem, c, setSortBem)} />
                        <SortTh label="Humor" col="humor" sort={sortBem} onSort={c => toggleSort(sortBem, c, setSortBem)} />
                        <th className="text-left py-1.5 pr-3 font-black uppercase tracking-widest text-[9px] text-slate-400">Urina</th>
                        <th className="text-left py-1.5 pr-3 font-black uppercase tracking-widest text-[9px] text-slate-400">Dor</th>
                        <SortTh label="sRPE" col="srpe" sort={sortBem} onSort={c => toggleSort(sortBem, c, setSortBem)} />
                        <th className="text-left py-1.5 pr-3 font-black uppercase tracking-widest text-[9px] text-slate-400">UA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedWellness.map((r, i) => {
                        const post = bemEstarData.find(p => p.playerName === athlete && p.type === 'post' && p.date === r.date)
                        return (
                          <tr key={i} className="border-b border-slate-100 hover:bg-amber-50">
                            <td className="py-1.5 pr-3 font-bold text-slate-600">{r.date}</td>
                            <td className="py-1.5 pr-3"><span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${scoreBg(r.wellnessScore)}`}>{r.wellnessScore?.toFixed(1) ?? '—'}</span></td>
                            <td className="py-1.5 pr-3">{r.sono ?? '—'}</td>
                            <td className="py-1.5 pr-3">{r.fadiga ?? '—'}</td>
                            <td className="py-1.5 pr-3">{r.doms ?? '—'}</td>
                            <td className="py-1.5 pr-3">{r.estresse ?? '—'}</td>
                            <td className="py-1.5 pr-3">{r.humor ?? '—'}</td>
                            <td className="py-1.5 pr-3">{r.corUrina ?? '—'}</td>
                            <td className="py-1.5 pr-3">{r.temDor ? <span className="text-[9px] bg-orange-100 text-orange-600 px-1 py-0.5 rounded font-black">DOR</span> : '—'}</td>
                            <td className="py-1.5 pr-3">{post?.srpe ?? '—'}</td>
                            <td className="py-1.5 pr-3 font-bold text-purple-600">{post?.srpeLoad?.toFixed(0) ?? '—'}</td>
                          </tr>
                        )
                      })}
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
          <div className="border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Mapa Anatômico de Dores</p>
            {Object.keys(painCodeMap).length > 0 ? (
              <AnatomyFigure activeRegions={painCodeMap} hoveredRegion={hoveredRegion} onHover={setHoveredRegion} />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-slate-300">
                <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-sm font-medium">Sem dores relatadas neste histórico</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Regiões Afetadas — Frequência total</p>
              {Object.keys(painCodeMap).length > 0 ? (
                <div className="flex flex-col gap-2">
                  {Object.entries(painCodeMap).sort((a, b) => b[1] - a[1]).map(([code, count]) => {
                    const label = DOR_LABELS[code] || ANATOMY_POINTS[code]?.label || code
                    const maxC = Math.max(...Object.values(painCodeMap))
                    const intensity = count / maxC
                    const barColor = intensity > 0.66 ? 'bg-red-500' : intensity > 0.33 ? 'bg-orange-400' : 'bg-amber-300'
                    const textColor = intensity > 0.66 ? 'text-red-600' : intensity > 0.33 ? 'text-orange-500' : 'text-amber-500'
                    return (
                      <div key={code} className="flex items-center gap-2"
                        onMouseEnter={() => setHoveredRegion(code)}
                        onMouseLeave={() => setHoveredRegion(null)}>
                        <span className="text-[10px] font-black text-slate-400 w-6 text-right shrink-0">{code}</span>
                        <span className="text-xs font-bold w-36 shrink-0">{label}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-2"><div className={`${barColor} h-2 rounded-full`} style={{ width: `${(count / maxC) * 100}%` }} /></div>
                        <span className={`text-xs font-black w-8 text-right ${textColor}`}>{count}×</span>
                      </div>
                    )
                  })}
                </div>
              ) : <p className="text-slate-400 text-sm text-center py-4">Sem regiões afetadas</p>}
            </div>

            <div className="border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Histórico de ocorrências</p>
              {painHistory.length > 0 ? (
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                  {painHistory.map((r, i) => (
                    <div key={i} className="border-l-2 border-orange-300 pl-3 py-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-700">{r.date}</span>
                        <span className="text-[9px] bg-orange-100 text-orange-600 font-black px-2 py-0.5 rounded-full">DOR</span>
                      </div>
                      <p className="text-[10px] text-slate-600 mt-0.5 leading-relaxed">{r.dorLocalizada}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-slate-400 text-sm text-center py-4">Sem histórico</p>}
            </div>
          </div>
        </div>
      )}
      {/* ── HISTÓRICO DE LESÕES ── */}
      {activeTab === 'cmj' && (() => {
        const norm = normalizeName(athlete)
        const minhasColetas = cmjColetas.filter(c => normalizeName(c.athlete_name) === norm)
        const sorted = [...minhasColetas].sort((a, b) => new Date(b.data_coleta) - new Date(a.data_coleta))
        const melhor = minhasColetas.length ? Math.max(...minhasColetas.map(c => c.media)) : null

        function calcFadigaCmj(media, best) {
          if (!media || !best) return null
          return Math.round(((media - best) / best) * 1000) / 10
        }
        function getZoneCmj(pct) {
          if (pct === null || pct === undefined) return null
          if (pct >= -5)  return { label: 'NORMAL',          text: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-300',  badge: 'bg-green-100 text-green-700'   }
          if (pct >= -10) return { label: 'ATENÇÃO',         text: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-300',  badge: 'bg-amber-100 text-amber-700'   }
          if (pct >= -15) return { label: 'FADIGA MODERADA', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-300', badge: 'bg-orange-100 text-orange-700' }
          return            { label: 'ALTO RISCO',      text: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-300',    badge: 'bg-red-100 text-red-700'       }
        }

        const ultimaColeta = sorted[0] || null
        const ultimaPct    = ultimaColeta && melhor ? calcFadigaCmj(ultimaColeta.media, melhor) : null
        const ultimaZone   = getZoneCmj(ultimaPct)

        return (
          <div>
            {/* KPI topo */}
            {sorted.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <p className="text-sm font-black uppercase tracking-widest">Sem coletas CMJ registradas para este atleta</p>
                <p className="text-xs font-bold mt-1">Registre coletas na página de Índice de Fadiga</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  <div className="border-2 border-slate-200 rounded-xl p-4 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Melhor Histórico</p>
                    <p className="text-3xl font-black font-mono text-black">{melhor ?? '—'}</p>
                    <p className="text-[9px] font-black text-slate-400">cm</p>
                  </div>
                  <div className="border-2 border-slate-200 rounded-xl p-4 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Última Coleta</p>
                    <p className="text-3xl font-black font-mono text-black">{ultimaColeta?.media ?? '—'}</p>
                    <p className="text-[9px] font-black text-slate-400">cm</p>
                  </div>
                  <div className={`border-2 rounded-xl p-4 text-center ${ultimaZone ? ultimaZone.border + ' ' + ultimaZone.bg : 'border-slate-200'}`}>
                    <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${ultimaZone ? ultimaZone.text : 'text-slate-400'}`}>Fadiga Atual</p>
                    <p className={`text-3xl font-black ${ultimaZone ? ultimaZone.text : 'text-slate-300'}`}>
                      {ultimaPct !== null ? `${ultimaPct > 0 ? '+' : ''}${ultimaPct}%` : '—'}
                    </p>
                    {ultimaZone && <p className={`text-[9px] font-black uppercase ${ultimaZone.text}`}>{ultimaZone.label}</p>}
                  </div>
                  <div className="border-2 border-slate-200 rounded-xl p-4 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Coletas</p>
                    <p className="text-3xl font-black font-mono text-black">{sorted.length}</p>
                    <p className="text-[9px] font-black text-slate-400">registros</p>
                  </div>
                </div>

                {/* Histórico */}
                <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Histórico de Coletas</p>
                <div className="border-2 border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-slate-200 bg-slate-50">
                        {['Data', 'T1 (cm)', 'T2 (cm)', 'T3 (cm)', 'Média', 'Melhor ref.', 'Fadiga', 'Zona'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sorted.map((c, i) => {
                        const p = melhor ? calcFadigaCmj(c.media, melhor) : null
                        const z = getZoneCmj(p)
                        return (
                          <tr key={c.id} className={i === 0 ? 'bg-amber-50' : 'hover:bg-slate-50'}>
                            <td className="px-4 py-3 font-black text-sm text-black">
                              {new Date(c.data_coleta).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                              {i === 0 && <span className="ml-2 text-[9px] bg-amber-500 text-black px-1.5 py-0.5 rounded font-black uppercase">Última</span>}
                            </td>
                            <td className="px-4 py-3 font-mono font-bold text-slate-600">{c.salto_1 ?? '—'}</td>
                            <td className="px-4 py-3 font-mono font-bold text-slate-600">{c.salto_2 ?? '—'}</td>
                            <td className="px-4 py-3 font-mono font-bold text-slate-600">{c.salto_3 ?? '—'}</td>
                            <td className="px-4 py-3 font-black font-mono text-black">{c.media} cm</td>
                            <td className="px-4 py-3 font-mono text-slate-500">{melhor ? `${melhor} cm` : '—'}</td>
                            <td className="px-4 py-3">
                              {p !== null
                                ? <span className={`font-black text-sm ${z?.text}`}>{p > 0 ? '+' : ''}{p}%</span>
                                : <span className="text-slate-300 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              {z
                                ? <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${z.badge}`}>{z.label}</span>
                                : <span className="text-slate-300 text-xs">—</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )
      })()}

            {activeTab === 'lesoes' && (() => {
        const { events, byRegion } = injuryTimeline
        if (events.length === 0) return (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300">
            <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium">Sem episódios de dor no histórico</p>
          </div>
        )

        // Span de datas para escalar a timeline
        const allDates = events.map(e => e.date).sort()
        const firstDate = new Date(allDates[0] + 'T12:00:00')
        const lastDate  = new Date(allDates[allDates.length - 1] + 'T12:00:00')
        const totalDays = Math.max((lastDate - firstDate) / (1000 * 60 * 60 * 24), 1)

        function datePct(dateStr) {
          const d = new Date(dateStr + 'T12:00:00')
          return Math.round(((d - firstDate) / (totalDays * 1000 * 60 * 60 * 24)) * 100)
        }

        // Cores por intensidade de frequência
        const maxFreq = Math.max(...byRegion.map(r => r.dates.length), 1)
        function regionColor(count) {
          const i = count / maxFreq
          if (i > 0.66) return { dot: 'bg-red-500', text: 'text-red-700', bar: 'bg-red-400', light: 'bg-red-50 border-red-200' }
          if (i > 0.33) return { dot: 'bg-orange-400', text: 'text-orange-600', bar: 'bg-orange-400', light: 'bg-orange-50 border-orange-200' }
          return { dot: 'bg-amber-400', text: 'text-amber-600', bar: 'bg-amber-300', light: 'bg-amber-50 border-amber-200' }
        }

        return (
          <div className="flex flex-col gap-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Episódios</p>
                <p className="text-2xl font-black text-black">{events.length}</p>
                <p className="text-[10px] text-slate-500">relatos de dor</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Regiões afetadas</p>
                <p className="text-2xl font-black text-black">{byRegion.length}</p>
                <p className="text-[10px] text-slate-500">distintas</p>
              </div>
              <div className={`border rounded-xl p-3 ${regionColor(byRegion[0]?.dates.length || 0).light}`}>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Região mais recorrente</p>
                <p className={`text-sm font-black leading-tight ${regionColor(byRegion[0]?.dates.length || 0).text}`}>
                  {byRegion[0]?.label ?? '—'}
                </p>
                {byRegion[0] && <p className="text-[10px] text-slate-500 mt-0.5">{byRegion[0].dates.length}× relatado</p>}
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Último episódio</p>
                <p className="text-sm font-black text-black">{events[events.length - 1]?.date ?? '—'}</p>
                <p className="text-[10px] text-slate-500">
                  {events[events.length - 1] ? `${Math.round((Date.now() - new Date(events[events.length-1].date + 'T12:00:00').getTime()) / (1000*60*60*24))}d atrás` : ''}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* TIMELINE por região */}
              <div className="border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Timeline por região do corpo</p>
                <div className="flex flex-col gap-4">
                  {byRegion.map(({ code, label, dates }) => {
                    const c = regionColor(dates.length)
                    return (
                      <div key={code}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${c.dot} flex-shrink-0`} />
                            <span className="text-xs font-black text-black">{label}</span>
                            <span className="text-[9px] text-slate-400 font-medium">[{code}]</span>
                          </div>
                          <span className={`text-xs font-black ${c.text}`}>{dates.length}×</span>
                        </div>
                        {/* Barra de timeline com marcadores de data */}
                        <div className="relative h-5 bg-slate-100 rounded-full overflow-hidden">
                          {dates.map((d, i) => {
                            const pct = datePct(d)
                            return (
                              <div
                                key={i}
                                title={d}
                                className={`absolute top-1 w-3 h-3 rounded-full ${c.dot} border-2 border-white`}
                                style={{ left: `calc(${pct}% - 6px)` }}
                              />
                            )
                          })}
                        </div>
                        <div className="flex justify-between text-[8px] text-slate-400 font-medium mt-0.5">
                          <span>{allDates[0]}</span>
                          <span>{allDates[allDates.length - 1]}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-[9px] font-black text-slate-400 border-t border-slate-100 pt-3">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Alta recorrência</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" />Moderada</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />Baixa</span>
                </div>
              </div>

              {/* CRONOGRAMA VERTICAL de todos os episódios */}
              <div className="border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Cronograma — todos os episódios</p>
                <div className="relative">
                  {/* Linha central */}
                  <div className="absolute left-16 top-0 bottom-0 w-px bg-slate-200" />
                  <div className="flex flex-col gap-0">
                    {[...events].reverse().map((ev, i) => {
                      const ws = ev.wellnessScore
                      const wsBg = ws >= 3.5 ? 'bg-green-100 text-green-700' : ws >= 2.5 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      // Agrupa por mês para separadores
                      const month = ev.date.substring(0, 7)
                      const prevMonth = i > 0 ? [...events].reverse()[i - 1].date.substring(0, 7) : null
                      const showMonth = month !== prevMonth
                      return (
                        <div key={i}>
                          {showMonth && (
                            <div className="flex items-center gap-2 my-2 pl-0">
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 w-14 text-right">
                                {new Date(month + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                              </span>
                              <div className="flex-1 h-px bg-slate-200 ml-2" />
                            </div>
                          )}
                          <div className="flex items-start gap-3 py-1.5">
                            {/* Data */}
                            <span className="text-[9px] text-slate-400 font-bold w-14 text-right flex-shrink-0 pt-0.5">
                              {ev.date.substring(5).replace('-', '/')}
                            </span>
                            {/* Ponto na linha */}
                            <div className="flex-shrink-0 w-3 h-3 rounded-full bg-orange-400 border-2 border-white mt-0.5 relative z-10" />
                            {/* Conteúdo */}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap gap-1 mb-0.5">
                                {ev.labels.map((l, j) => (
                                  <span key={j} className="text-[9px] font-black bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded">{l}</span>
                                ))}
                              </div>
                              {ws && (
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${wsBg}`}>Wellness {ws.toFixed(1)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default function IndividualDashboard() {
  return (
    <div className="min-h-screen bg-white text-black p-4 font-sans">
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-slate-400 font-black uppercase tracking-widest text-sm">Carregando...</div></div>}>
        <IndividualContent />
      </Suspense>
    </div>
  )
}
