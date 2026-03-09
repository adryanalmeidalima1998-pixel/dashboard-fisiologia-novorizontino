'use client'

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

function buildRadarPoints(athleteData, compData, compLabel) {
  return RADAR_METRICS.map(m => {
    const av = athleteData[m.key] || 0
    const cv = (compData || athleteData)[m.key] || 0
    const maxV = Math.max(av, cv, 0.001)
    return {
      subject: m.label,
      Atleta: parseFloat(((av / maxV) * 100).toFixed(1)),
      [compLabel]: parseFloat(((cv / maxV) * 100).toFixed(1)),
      rawA: av, rawC: cv, unit: m.unit
    }
  })
}

function SingleRadar({ athleteData, compData, compLabel, compColor = '#94a3b8' }) {
  if (!athleteData) return (
    <div className="flex items-center justify-center h-48 text-slate-300 text-sm">Sem dados GPS</div>
  )
  const radarPoints = buildRadarPoints(athleteData, compData, compLabel)

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    const item = radarPoints.find(d => d.subject === label)
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-2 text-xs shadow-lg z-50">
        <p className="font-black text-black mb-1">{label}</p>
        {payload.map(p => (
          <p key={p.name} style={{ color: p.color }} className="font-bold">
            {p.name}: {p.name === 'Atleta'
              ? `${item?.rawA?.toFixed(1)} ${item?.unit}`
              : `${item?.rawC?.toFixed(1)} ${item?.unit}`}
          </p>
        ))}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={radarPoints} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar name={compLabel} dataKey={compLabel} stroke={compColor} fill={compColor} fillOpacity={0.2} strokeWidth={1.5} />
        <Radar name="Atleta" dataKey="Atleta" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.35} strokeWidth={2} />
        <RTooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 10, fontWeight: 'bold' }} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

function PlayerRadarChart({ athleteData, compTeamData, compPosData, athletePosition }) {
  if (!athleteData) return (
    <div className="flex items-center justify-center h-48 text-slate-300 text-sm">Sem dados GPS para gerar radar</div>
  )
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="border border-slate-100 rounded-xl p-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 text-center">vs Média da Equipe</p>
        <SingleRadar athleteData={athleteData} compData={compTeamData} compLabel="Média Equipe" compColor="#94a3b8" />
        <p className="text-[9px] text-slate-400 text-center mt-1">Valores relativos ao máximo entre atleta e grupo</p>
      </div>
      <div className="border border-slate-100 rounded-xl p-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 text-center">
          vs Média da Posição {athletePosition ? <span className="text-amber-600">({athletePosition})</span> : ''}
        </p>
        {compPosData
          ? <SingleRadar athleteData={athleteData} compData={compPosData} compLabel={athletePosition ? `Média ${athletePosition}` : 'Média Posição'} compColor="#6366f1" />
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
  const { gpsData, bemEstarData, vmaxBaseline, playerPositions: ctxPositions } = useData()
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
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                Radar de Métricas Físicas
              </p>
              {athletePosition
                ? <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-1 rounded-lg font-bold uppercase">{athletePosition}</span>
                : <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-1 rounded-lg font-bold">Configure a posição no ⚙ para ver radar por posição</span>
              }
            </div>
            <PlayerRadarChart athleteData={radarData} compTeamData={compTeamData} compPosData={compPosData} athletePosition={athletePosition} />
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
