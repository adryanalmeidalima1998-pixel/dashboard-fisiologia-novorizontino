'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'

const POSICOES = ['GK', 'ZAG', 'LD', 'LE', 'VOL', 'MC', 'MEI', 'PD', 'PE', 'CA', 'ATA']

const PES = ['Direito', 'Esquerdo', 'Ambidestro']

const TIPOS_LESAO = [
  'Muscular', 'Ligamentar', 'Tendinosa', 'Óssea / Fratura',
  'Contusão', 'Entorse', 'Luxação', 'Sobrecarga', 'Outro'
]

const SEVERIDADES = [
  { label: 'Leve', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { label: 'Moderada', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { label: 'Grave', color: 'bg-red-100 text-red-700 border-red-300' },
]

// ─── PONTOS ANATÔMICOS (mesmas coordenadas da página individual) ─────────────
const ANATOMY_POINTS = {
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

// ─── SVG DO BONECO ────────────────────────────────────────────────────────────
function BodyShape({ cx }) {
  return (
    <g>
      <circle cx={cx} cy={36} r={22} fill="#dde4ef" stroke="#8fa3be" strokeWidth="1.5"/>
      <ellipse cx={cx - 23} cy={38} rx={5} ry={8} fill="#d0d9e8" stroke="#8fa3be" strokeWidth="1"/>
      <ellipse cx={cx + 23} cy={38} rx={5} ry={8} fill="#d0d9e8" stroke="#8fa3be" strokeWidth="1"/>
      <path d={`M ${cx-8} 57 C ${cx-8} 57 ${cx-6} 72 ${cx-6} 74 L ${cx+6} 74 C ${cx+6} 72 ${cx+8} 57 ${cx+8} 57 Z`}
        fill="#dde4ef" stroke="#8fa3be" strokeWidth="1"/>
      <path d={`M ${cx-8} 73 C ${cx-28} 74 ${cx-48} 78 ${cx-54} 90 C ${cx-60} 104 ${cx-58} 120 ${cx-52} 132 L ${cx-42} 158 C ${cx-38} 172 ${cx-40} 190 ${cx-42} 208 L ${cx+42} 208 C ${cx+40} 190 ${cx+38} 172 ${cx+42} 158 L ${cx+52} 132 C ${cx+58} 120 ${cx+60} 104 ${cx+54} 90 C ${cx+48} 78 ${cx+28} 74 ${cx+8} 73 Z`}
        fill="#dde4ef" stroke="#8fa3be" strokeWidth="1.5"/>
      <path d={`M ${cx+42} 84 C ${cx+52} 84 ${cx+68} 94 ${cx+76} 112 L ${cx+82} 148 C ${cx+84} 158 ${cx+80} 170 ${cx+74} 172 L ${cx+64} 172 C ${cx+68} 164 ${cx+70} 154 ${cx+68} 144 L ${cx+62} 108 C ${cx+58} 94 ${cx+46} 86 ${cx+36} 84 Z`}
        fill="#dde4ef" stroke="#8fa3be" strokeWidth="1.2"/>
      <path d={`M ${cx+74} 172 L ${cx+64} 172 C ${cx+66} 186 ${cx+70} 210 ${cx+72} 224 C ${cx+73} 232 ${cx+76} 237 ${cx+80} 237 C ${cx+84} 237 ${cx+87} 232 ${cx+88} 224 L ${cx+84} 186 Z`}
        fill="#dde4ef" stroke="#8fa3be" strokeWidth="1.2"/>
      <path d={`M ${cx-42} 84 C ${cx-52} 84 ${cx-68} 94 ${cx-76} 112 L ${cx-82} 148 C ${cx-84} 158 ${cx-80} 170 ${cx-74} 172 L ${cx-64} 172 C ${cx-68} 164 ${cx-70} 154 ${cx-68} 144 L ${cx-62} 108 C ${cx-58} 94 ${cx-46} 86 ${cx-36} 84 Z`}
        fill="#dde4ef" stroke="#8fa3be" strokeWidth="1.2"/>
      <path d={`M ${cx-74} 172 L ${cx-64} 172 C ${cx-66} 186 ${cx-70} 210 ${cx-72} 224 C ${cx-73} 232 ${cx-76} 237 ${cx-80} 237 C ${cx-84} 237 ${cx-87} 232 ${cx-88} 224 L ${cx-84} 186 Z`}
        fill="#dde4ef" stroke="#8fa3be" strokeWidth="1.2"/>
      <path d={`M ${cx-42} 207 C ${cx-42} 218 ${cx-40} 230 ${cx-36} 236 L ${cx+36} 236 C ${cx+40} 230 ${cx+42} 218 ${cx+42} 207 Z`}
        fill="#d4dce9" stroke="#8fa3be" strokeWidth="1.2"/>
      <path d={`M ${cx-36} 234 C ${cx-24} 232 ${cx-10} 232 ${cx-8} 234 C ${cx-6} 262 ${cx-6} 288 ${cx-10} 316 C ${cx-12} 322 ${cx-18} 326 ${cx-22} 326 C ${cx-26} 326 ${cx-32} 322 ${cx-34} 316 C ${cx-36} 288 ${cx-36} 262 ${cx-36} 234 Z`}
        fill="#dde4ef" stroke="#8fa3be" strokeWidth="1.2"/>
      <path d={`M ${cx+8} 234 C ${cx+10} 232 ${cx+24} 232 ${cx+36} 234 C ${cx+36} 262 ${cx+36} 288 ${cx+34} 316 C ${cx+32} 322 ${cx+26} 326 ${cx+22} 326 C ${cx+18} 326 ${cx+12} 322 ${cx+10} 316 C ${cx+6} 288 ${cx+6} 262 ${cx+8} 234 Z`}
        fill="#dde4ef" stroke="#8fa3be" strokeWidth="1.2"/>
      <ellipse cx={cx-22} cy={327} rx={14} ry={10} fill="#c8d5e5" stroke="#8fa3be" strokeWidth="1"/>
      <ellipse cx={cx+22} cy={327} rx={14} ry={10} fill="#c8d5e5" stroke="#8fa3be" strokeWidth="1"/>
      <path d={`M ${cx-36} 336 C ${cx-36} 352 ${cx-34} 372 ${cx-28} 386 C ${cx-26} 394 ${cx-22} 398 ${cx-18} 398 C ${cx-14} 398 ${cx-10} 394 ${cx-12} 386 C ${cx-10} 372 ${cx-10} 352 ${cx-10} 336 Z`}
        fill="#dde4ef" stroke="#8fa3be" strokeWidth="1.2"/>
      <path d={`M ${cx+10} 336 C ${cx+10} 352 ${cx+10} 372 ${cx+12} 386 C ${cx+10} 394 ${cx+14} 398 ${cx+18} 398 C ${cx+22} 398 ${cx+26} 394 ${cx+28} 386 C ${cx+34} 372 ${cx+36} 352 ${cx+36} 336 Z`}
        fill="#dde4ef" stroke="#8fa3be" strokeWidth="1.2"/>
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
      <BodyShape cx={cx} />
      <path d={`M ${cx} 74 L ${cx} 208`} stroke="#a0b3cc" strokeWidth="1" strokeDasharray="3,3"/>
      <path d={`M ${cx-14} 88 C ${cx-28} 92 ${cx-34} 106 ${cx-30} 118 C ${cx-26} 126 ${cx-16} 126 ${cx-10} 120`}
        fill="none" stroke="#9ab0c8" strokeWidth="1.2"/>
      <path d={`M ${cx+14} 88 C ${cx+28} 92 ${cx+34} 106 ${cx+30} 118 C ${cx+26} 126 ${cx+16} 126 ${cx+10} 120`}
        fill="none" stroke="#9ab0c8" strokeWidth="1.2"/>
    </g>
  )
}

function InjuryBodyMap({ injuries, onSelectRegion, selectedRegion, interactive = false }) {
  const [hovered, setHovered] = useState(null)

  const regionCounts = useMemo(() => {
    const counts = {}
    injuries.forEach(inj => {
      counts[inj.body_region] = (counts[inj.body_region] || 0) + 1
    })
    return counts
  }, [injuries])

  const maxCount = Math.max(...Object.values(regionCounts), 1)

  function dotColor(code) {
    if (interactive && selectedRegion === code) return '#2563eb'
    const c = regionCounts[code]; if (!c) return interactive ? '#94a3b8' : null
    const ratio = c / maxCount
    return ratio > 0.66 ? '#dc2626' : ratio > 0.33 ? '#f97316' : '#fbbf24'
  }

  function dotOpacity(code) {
    if (interactive && selectedRegion === code) return 1
    if (regionCounts[code]) return 0.92
    return interactive ? 0.35 : 0
  }

  return (
    <div>
      <div className="flex justify-around text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 px-4">
        <span>FRENTE</span><span>COSTAS</span>
      </div>
      <svg viewBox="0 0 500 430" className="w-full max-w-sm mx-auto block" style={{ maxHeight: 340 }}>
        <BodyShape cx={125} />
        <line x1="250" y1="0" x2="250" y2="430" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="5,3" />
        <BodyBack cx={375} />

        {Object.entries(ANATOMY_POINTS).map(([code, pos]) => {
          const color = dotColor(code)
          const opacity = dotOpacity(code)
          const count = regionCounts[code] || 0
          const isHov = hovered === code
          const isSel = interactive && selectedRegion === code

          if (!interactive && !color) return null
          if (!interactive && opacity === 0) return null

          return (
            <g
              key={code}
              onMouseEnter={() => setHovered(code)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => interactive && onSelectRegion && onSelectRegion(code)}
              style={{ cursor: interactive ? 'pointer' : 'default' }}
            >
              {(isHov || isSel || count > 0) && (
                <circle cx={pos.x} cy={pos.y} r={isHov || isSel ? 14 : 10}
                  fill={color || '#94a3b8'} fillOpacity={0.2} />
              )}
              <circle
                cx={pos.x} cy={pos.y} r={isHov || isSel ? 9 : 6}
                fill={color || '#94a3b8'}
                fillOpacity={opacity}
                stroke={isSel ? '#1d4ed8' : 'white'}
                strokeWidth={isSel ? 2.5 : 1.5}
              />
              {count > 1 && (
                <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize="7" fontWeight="bold" fill="white">{count}</text>
              )}
              {(isHov || isSel) && (
                <g>
                  <rect x={pos.x - 42} y={pos.y - 28} width="84" height="16" rx="4" fill="rgba(15,23,42,0.88)" />
                  <text x={pos.x} y={pos.y - 17} textAnchor="middle" fontSize="9" fontWeight="bold" fill="white">
                    {pos.label}{count > 0 ? ` (${count}x)` : ''}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
      {!interactive && (
        <div className="flex items-center justify-center gap-4 mt-1">
          {[['#fbbf24', '1x'], ['#f97316', '2-3x'], ['#dc2626', '3x+']].map(([c, l]) => (
            <div key={l} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
              <span className="text-[9px] font-bold text-slate-500">{l}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── MODAL DE ATLETA ──────────────────────────────────────────────────────────
function AthleteModal({ athlete, onClose, onSave }) {
  const [form, setForm] = useState({
    name: '',
    full_name: '',
    birth_date: '',
    weight_kg: '',
    height_cm: '',
    dominant_foot: '',
    city: '',
    position: '',
    notes: '',
    ...athlete,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.name.trim()) { setError('Nome no sistema é obrigatório.'); return }
    setSaving(true)
    setError('')
    try {
      const url = athlete?.id ? `/api/athletes/${athlete.id}` : '/api/athletes'
      const method = athlete?.id ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, weight_kg: form.weight_kg || null, height_cm: form.height_cm || null }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro ao salvar.'); return }
      onSave(data.athlete)
    } catch {
      setError('Erro de conexão.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full border border-slate-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-amber-400 bg-white"
  const labelCls = "text-[10px] font-black uppercase tracking-widest text-slate-500"

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-black uppercase tracking-tight">
            {athlete?.id ? 'Editar Atleta' : 'Novo Atleta'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <p className={labelCls}>Nome no Sistema *</p>
              <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="Ex: Rodrigo Campos" />
              <p className="text-[10px] text-slate-400 mt-0.5">Mesmo nome que aparece no GPS e Bem-Estar</p>
            </div>
            <div className="col-span-2">
              <p className={labelCls}>Nome Completo</p>
              <input className={inputCls} value={form.full_name} onChange={e => set('full_name', e.target.value)}
                placeholder="Ex: Rodrigo Campos da Silva" />
            </div>
            <div>
              <p className={labelCls}>Data de Nascimento</p>
              <input type="date" className={inputCls} value={form.birth_date}
                onChange={e => set('birth_date', e.target.value)} />
            </div>
            <div>
              <p className={labelCls}>Cidade de Origem</p>
              <input className={inputCls} value={form.city} onChange={e => set('city', e.target.value)}
                placeholder="Ex: São Paulo, SP" />
            </div>
            <div>
              <p className={labelCls}>Peso (kg)</p>
              <input type="number" step="0.1" className={inputCls} value={form.weight_kg}
                onChange={e => set('weight_kg', e.target.value)} placeholder="Ex: 78.5" />
            </div>
            <div>
              <p className={labelCls}>Altura (cm)</p>
              <input type="number" className={inputCls} value={form.height_cm}
                onChange={e => set('height_cm', e.target.value)} placeholder="Ex: 181" />
            </div>
            <div>
              <p className={labelCls}>Pé Dominante</p>
              <select className={inputCls} value={form.dominant_foot} onChange={e => set('dominant_foot', e.target.value)}>
                <option value="">Selecionar</option>
                {PES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <p className={labelCls}>Posição</p>
              <select className={inputCls} value={form.position} onChange={e => set('position', e.target.value)}>
                <option value="">Selecionar</option>
                {POSICOES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <p className={labelCls}>Observações</p>
              <textarea className={inputCls} rows={2} value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Informações adicionais..." />
            </div>
          </div>

          {error && <p className="text-red-600 text-xs font-bold">{error}</p>}

          <div className="flex gap-2 justify-end pt-2">
            <button onClick={onClose}
              className="px-4 py-2 text-sm font-bold border border-slate-200 rounded-md hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 text-sm font-black bg-amber-500 text-black rounded-md hover:bg-amber-400 disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar Atleta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MODAL DE LESÃO ───────────────────────────────────────────────────────────
function InjuryModal({ athleteName, onClose, onSave }) {
  const [selectedRegion, setSelectedRegion] = useState(null)
  const [form, setForm] = useState({
    injury_date: new Date().toISOString().split('T')[0],
    injury_type: '',
    description: '',
    severity: '',
    days_out: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!selectedRegion) { setError('Selecione a região no bonequinho.'); return }
    if (!form.injury_type) { setError('Tipo de lesão é obrigatório.'); return }
    if (!form.injury_date) { setError('Data é obrigatória.'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/injury-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athlete_name: athleteName,
          body_region: selectedRegion,
          ...form,
          days_out: form.days_out || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro ao salvar.'); return }
      onSave(data.injury)
    } catch {
      setError('Erro de conexão.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full border border-slate-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-amber-400 bg-white"
  const labelCls = "text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5 block"

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight">Registrar Lesão</h2>
            <p className="text-xs text-slate-500 font-medium">{athleteName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold">✕</button>
        </div>

        <div className="p-5 grid grid-cols-2 gap-5">
          {/* Lado esquerdo: bonequinho interativo */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
              Clique na região afetada
            </p>
            <InjuryBodyMap
              injuries={[]}
              onSelectRegion={setSelectedRegion}
              selectedRegion={selectedRegion}
              interactive={true}
            />
            {selectedRegion && (
              <div className="mt-2 text-center">
                <span className="inline-block bg-blue-100 text-blue-700 text-xs font-black px-3 py-1 rounded-full">
                  {ANATOMY_POINTS[selectedRegion]?.label}
                </span>
              </div>
            )}
          </div>

          {/* Lado direito: formulário */}
          <div className="flex flex-col gap-3">
            <div>
              <label className={labelCls}>Data da Lesão</label>
              <input type="date" className={inputCls} value={form.injury_date}
                onChange={e => set('injury_date', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Tipo de Lesão</label>
              <select className={inputCls} value={form.injury_type} onChange={e => set('injury_type', e.target.value)}>
                <option value="">Selecionar tipo...</option>
                {TIPOS_LESAO.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Gravidade</label>
              <div className="flex gap-2 flex-wrap">
                {SEVERIDADES.map(s => (
                  <button key={s.label}
                    onClick={() => set('severity', form.severity === s.label ? '' : s.label)}
                    className={`px-3 py-1.5 rounded-md text-xs font-black border transition-all ${
                      form.severity === s.label
                        ? s.color + ' ring-2 ring-offset-1 ring-current'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Dias Afastado</label>
              <input type="number" className={inputCls} value={form.days_out}
                onChange={e => set('days_out', e.target.value)} placeholder="Ex: 14" />
            </div>
            <div>
              <label className={labelCls}>Descrição / Observação</label>
              <textarea className={inputCls} rows={4} value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Descreva a lesão, mecanismo de trauma, tratamento realizado..." />
            </div>

            {error && <p className="text-red-600 text-xs font-bold">{error}</p>}

            <div className="flex gap-2 justify-end mt-auto pt-2">
              <button onClick={onClose}
                className="px-4 py-2 text-sm font-bold border border-slate-200 rounded-md hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 text-sm font-black bg-red-600 text-white rounded-md hover:bg-red-500 disabled:opacity-50">
                {saving ? 'Salvando...' : 'Registrar Lesão'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── CARD DO ATLETA NA LISTA ──────────────────────────────────────────────────
function AthleteCard({ athlete, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        selected
          ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-400'
          : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-black text-slate-600">
            {athlete.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-800 truncate">{athlete.name}</p>
          <p className="text-[10px] text-slate-400 font-medium">
            {[athlete.position, athlete.city].filter(Boolean).join(' · ') || 'Sem dados'}
          </p>
        </div>
      </div>
    </button>
  )
}

// ─── BADGE DE GRAVIDADE ───────────────────────────────────────────────────────
function SeverityBadge({ severity }) {
  const s = SEVERIDADES.find(s => s.label === severity)
  if (!s) return <span className="text-slate-400 text-xs">—</span>
  return <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${s.color}`}>{s.label}</span>
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function AtletasPage() {
  const router = useRouter()
  const [athletes, setAthletes] = useState([])
  const [injuries, setInjuries] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedAthlete, setSelectedAthlete] = useState(null)
  const [search, setSearch] = useState('')
  const [filterPos, setFilterPos] = useState('')
  const [showAthleteModal, setShowAthleteModal] = useState(false)
  const [editingAthlete, setEditingAthlete] = useState(null)
  const [showInjuryModal, setShowInjuryModal] = useState(false)
  const [activeTab, setActiveTab] = useState('lesoes')
  const [deletingInjury, setDeletingInjury] = useState(null)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      const [aRes, iRes] = await Promise.all([
        fetch('/api/athletes'),
        fetch('/api/injury-history'),
      ])
      const aData = await aRes.json()
      const iData = await iRes.json()
      setAthletes(aData.athletes || [])
      setInjuries(iData.injuries || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filteredAthletes = useMemo(() => {
    return athletes.filter(a => {
      const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
        (a.full_name || '').toLowerCase().includes(search.toLowerCase())
      const matchPos = !filterPos || a.position === filterPos
      return matchSearch && matchPos
    })
  }, [athletes, search, filterPos])

  const selectedInjuries = useMemo(() => {
    if (!selectedAthlete) return []
    return injuries.filter(i => i.athlete_name === selectedAthlete.name)
  }, [injuries, selectedAthlete])

  function handleAthleteSave(saved) {
    setAthletes(prev => {
      const idx = prev.findIndex(a => a.id === saved.id)
      if (idx >= 0) {
        const upd = [...prev]; upd[idx] = saved; return upd
      }
      return [...prev, saved].sort((a, b) => a.name.localeCompare(b.name))
    })
    if (selectedAthlete?.id === saved.id) setSelectedAthlete(saved)
    setShowAthleteModal(false)
    setEditingAthlete(null)
  }

  function handleInjurySave(saved) {
    setInjuries(prev => [saved, ...prev])
    setShowInjuryModal(false)
  }

  async function handleDeleteAthlete(athlete) {
    if (!confirm(`Deletar ${athlete.name}? Isso remove o atleta e todo o histórico de lesões.`)) return
    try {
      await fetch(`/api/athletes/${athlete.id}`, { method: 'DELETE' })
      setAthletes(prev => prev.filter(a => a.id !== athlete.id))
      setInjuries(prev => prev.filter(i => i.athlete_name !== athlete.name))
      if (selectedAthlete?.id === athlete.id) setSelectedAthlete(null)
    } catch (err) {
      console.error(err)
    }
  }

  async function handleDeleteInjury(injury) {
    if (!confirm('Deletar este registro de lesão?')) return
    setDeletingInjury(injury.id)
    try {
      await fetch(`/api/injury-history/${injury.id}`, { method: 'DELETE' })
      setInjuries(prev => prev.filter(i => i.id !== injury.id))
    } catch (err) {
      console.error(err)
    } finally {
      setDeletingInjury(null)
    }
  }

  function calcAge(birthDate) {
    if (!birthDate) return null
    const diff = Date.now() - new Date(birthDate).getTime()
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
  }

  return (
    <div className="min-h-screen bg-white text-black p-4 font-sans">
      <div className="max-w-[1400px] mx-auto flex flex-col gap-5">

        {/* HEADER */}
        <header className="flex justify-between items-center border-b-4 border-amber-500 pb-3">
          <div className="flex items-center gap-4">
            <img src="/club/escudonovorizontino.png" alt="Escudo" className="h-14 w-auto" />
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-black uppercase leading-none">Cadastro de Atletas</h1>
              <p className="text-sm font-bold tracking-widest text-slate-600 uppercase">Perfil & Histórico de Lesões</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/fisiologia')}
              className="bg-slate-200 text-slate-800 px-3 py-1 rounded-md text-xs font-bold hover:bg-slate-300 transition-colors">
              ← VOLTAR
            </button>
            <button
              onClick={() => { setEditingAthlete(null); setShowAthleteModal(true) }}
              className="bg-amber-500 text-black px-4 py-1.5 rounded-md text-xs font-black hover:bg-amber-400 transition-colors">
              + Novo Atleta
            </button>
          </div>
        </header>

        {/* CORPO DA PÁGINA */}
        <div className="grid grid-cols-[280px_1fr] gap-5">

          {/* ── LISTA DE ATLETAS ── */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400 placeholder:text-slate-400"
                placeholder="Buscar atleta..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400 text-slate-600"
                value={filterPos}
                onChange={e => setFilterPos(e.target.value)}
              >
                <option value="">Todas as posições</option>
                {POSICOES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 max-h-[calc(100vh-220px)] overflow-y-auto pr-0.5">
              {loading ? (
                <p className="text-xs text-slate-400 font-bold text-center py-8">Carregando...</p>
              ) : filteredAthletes.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-2xl mb-2">👤</p>
                  <p className="text-xs text-slate-400 font-bold">Nenhum atleta cadastrado</p>
                </div>
              ) : (
                filteredAthletes.map(a => (
                  <AthleteCard
                    key={a.id}
                    athlete={a}
                    selected={selectedAthlete?.id === a.id}
                    onClick={() => { setSelectedAthlete(a); setActiveTab('lesoes') }}
                  />
                ))
              )}
            </div>

            <p className="text-[10px] text-slate-400 font-bold text-center">
              {filteredAthletes.length} atleta{filteredAthletes.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* ── PAINEL DO ATLETA SELECIONADO ── */}
          {!selectedAthlete ? (
            <div className="flex items-center justify-center h-64 border-2 border-dashed border-slate-200 rounded-xl">
              <div className="text-center">
                <p className="text-4xl mb-3">🏃</p>
                <p className="text-sm text-slate-400 font-bold">Selecione um atleta</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">

              {/* Info card */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl font-black text-black">
                        {selectedAthlete.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-xl font-black uppercase tracking-tight">{selectedAthlete.name}</h2>
                      {selectedAthlete.full_name && (
                        <p className="text-sm text-slate-500 font-medium">{selectedAthlete.full_name}</p>
                      )}
                      <div className="flex gap-2 mt-1">
                        {selectedAthlete.position && (
                          <span className="bg-slate-200 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                            {selectedAthlete.position}
                          </span>
                        )}
                        {selectedAthlete.dominant_foot && (
                          <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                            {selectedAthlete.dominant_foot === 'Direito' ? 'Pé D' :
                             selectedAthlete.dominant_foot === 'Esquerdo' ? 'Pé E' : 'Ambidestro'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingAthlete(selectedAthlete); setShowAthleteModal(true) }}
                      className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-md hover:bg-white transition-colors">
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => handleDeleteAthlete(selectedAthlete)}
                      className="px-3 py-1.5 text-xs font-bold border border-red-200 text-red-600 rounded-md hover:bg-red-50 transition-colors">
                      🗑
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Idade', value: calcAge(selectedAthlete.birth_date) ? `${calcAge(selectedAthlete.birth_date)} anos` : null },
                    { label: 'Peso', value: selectedAthlete.weight_kg ? `${selectedAthlete.weight_kg} kg` : null },
                    { label: 'Altura', value: selectedAthlete.height_cm ? `${selectedAthlete.height_cm} cm` : null },
                    { label: 'Cidade', value: selectedAthlete.city || null },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white border border-slate-100 rounded-lg p-2.5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                      <p className="text-sm font-black text-slate-800 mt-0.5">{value || '—'}</p>
                    </div>
                  ))}
                </div>

                {selectedAthlete.notes && (
                  <p className="mt-3 text-xs text-slate-600 bg-white border border-slate-100 rounded-lg p-2.5">
                    {selectedAthlete.notes}
                  </p>
                )}
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-200">
                {[
                  { id: 'lesoes', label: `Histórico de Lesões${selectedInjuries.length > 0 ? ` (${selectedInjuries.length})` : ''}` },
                  { id: 'heatmap', label: 'Mapa Corporal' },
                ].map(tab => (
                  <button key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 text-xs font-black uppercase tracking-widest border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-amber-500 text-black'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab: Heatmap */}
              {activeTab === 'heatmap' && (
                <div className="grid grid-cols-2 gap-5 items-start">
                  <div className="border border-slate-100 rounded-xl p-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">
                      Regiões com mais lesões
                    </h3>
                    {selectedInjuries.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-8">Nenhuma lesão registrada</p>
                    ) : (
                      <InjuryBodyMap injuries={selectedInjuries} interactive={false} />
                    )}
                  </div>
                  <div className="border border-slate-100 rounded-xl p-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">
                      Por região
                    </h3>
                    {selectedInjuries.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-8">Sem dados</p>
                    ) : (() => {
                      const counts = {}
                      selectedInjuries.forEach(i => {
                        const label = ANATOMY_POINTS[i.body_region]?.label || i.body_region
                        counts[label] = (counts[label] || 0) + 1
                      })
                      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
                      const max = sorted[0]?.[1] || 1
                      return (
                        <div className="flex flex-col gap-2">
                          {sorted.map(([region, count]) => (
                            <div key={region} className="flex items-center gap-2">
                              <p className="text-[11px] font-bold text-slate-700 w-32 flex-shrink-0">{region}</p>
                              <div className="flex-1 bg-slate-100 rounded-full h-2">
                                <div
                                  className="h-2 rounded-full bg-red-500"
                                  style={{ width: `${(count / max) * 100}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-black text-slate-600 w-6 text-right">{count}x</span>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}

              {/* Tab: Lista de Lesões */}
              {activeTab === 'lesoes' && (
                <div className="flex flex-col gap-3">
                  <div className="flex justify-end">
                    <button
                      onClick={() => setShowInjuryModal(true)}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-black hover:bg-red-500 transition-colors flex items-center gap-1.5">
                      + Registrar Lesão
                    </button>
                  </div>

                  {selectedInjuries.length === 0 ? (
                    <div className="text-center border-2 border-dashed border-slate-200 rounded-xl py-12">
                      <p className="text-3xl mb-2">🏥</p>
                      <p className="text-sm text-slate-400 font-bold">Nenhuma lesão registrada</p>
                      <p className="text-xs text-slate-300 mt-1">Clique em "Registrar Lesão" para adicionar o histórico</p>
                    </div>
                  ) : (
                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            {['Data', 'Região', 'Tipo', 'Gravidade', 'Dias Afastado', 'Descrição', ''].map(h => (
                              <th key={h} className="text-left text-[9px] font-black uppercase tracking-widest text-slate-400 px-3 py-2.5">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedInjuries.map(inj => (
                            <tr key={inj.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                              <td className="px-3 py-2.5 text-xs font-bold text-slate-700 whitespace-nowrap">
                                {new Date(inj.injury_date).toLocaleDateString('pt-BR')}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="text-xs font-black text-slate-800">
                                  {ANATOMY_POINTS[inj.body_region]?.label || inj.body_region}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-slate-600 font-medium">{inj.injury_type}</td>
                              <td className="px-3 py-2.5"><SeverityBadge severity={inj.severity} /></td>
                              <td className="px-3 py-2.5 text-xs font-bold text-slate-700">
                                {inj.days_out ? `${inj.days_out}d` : '—'}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-slate-500 max-w-[200px] truncate">
                                {inj.description || '—'}
                              </td>
                              <td className="px-3 py-2.5">
                                <button
                                  onClick={() => handleDeleteInjury(inj)}
                                  disabled={deletingInjury === inj.id}
                                  className="text-red-400 hover:text-red-600 text-xs font-bold disabled:opacity-50">
                                  🗑
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Resumo */}
                  {selectedInjuries.length > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Total de Lesões', value: selectedInjuries.length },
                        {
                          label: 'Dias Afastado (total)',
                          value: selectedInjuries.reduce((sum, i) => sum + (parseInt(i.days_out) || 0), 0)
                        },
                        {
                          label: 'Região mais afetada',
                          value: (() => {
                            const counts = {}
                            selectedInjuries.forEach(i => {
                              counts[i.body_region] = (counts[i.body_region] || 0) + 1
                            })
                            const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
                            return top ? ANATOMY_POINTS[top[0]]?.label || top[0] : '—'
                          })()
                        },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                          <p className="text-xl font-black text-slate-800 mt-1">{value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      </div>

      {/* MODAIS */}
      {showAthleteModal && (
        <AthleteModal
          athlete={editingAthlete}
          onClose={() => { setShowAthleteModal(false); setEditingAthlete(null) }}
          onSave={handleAthleteSave}
        />
      )}
      {showInjuryModal && selectedAthlete && (
        <InjuryModal
          athleteName={selectedAthlete.name}
          onClose={() => setShowInjuryModal(false)}
          onSave={handleInjurySave}
        />
      )}
    </div>
  )
}
