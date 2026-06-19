'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useData, calcVmaxPct } from '../../context/DataContext'
import ExportPdfButton from '../../../components/ExportPdfButton'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LineChart, Line, CartesianGrid } from 'recharts'

// ─── ESTATÍSTICAS ─────────────────────────────────────────────────────────────

function rankArray(arr) {
  const n = arr.length
  const indexed = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
  const ranks = new Array(n)
  let j = 0
  while (j < n) {
    let k = j
    while (k < n - 1 && indexed[k + 1].v === indexed[k].v) k++
    const avg = (j + k) / 2 + 1
    for (let m = j; m <= k; m++) ranks[indexed[m].i] = avg
    j = k + 1
  }
  return ranks
}

function pearsonRanks(rx, ry) {
  const n = rx.length
  const mx = rx.reduce((a, b) => a + b, 0) / n
  const my = ry.reduce((a, b) => a + b, 0) / n
  let num = 0, dx2 = 0, dy2 = 0
  for (let i = 0; i < n; i++) {
    const dx = rx[i] - mx, dy = ry[i] - my
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy
  }
  return dx2 === 0 || dy2 === 0 ? 0 : num / Math.sqrt(dx2 * dy2)
}

function spearman(x, y) { return pearsonRanks(rankArray(x), rankArray(y)) }

function kendallTauB(x, y) {
  const n = x.length
  let C = 0, D = 0, tX = 0, tY = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = Math.sign(x[i] - x[j]), dy = Math.sign(y[i] - y[j])
      if (dx === 0 && dy === 0) continue
      if (dx === 0) { tX++; continue }
      if (dy === 0) { tY++; continue }
      if (dx === dy) C++; else D++
    }
  }
  const denom = Math.sqrt((C + D + tX) * (C + D + tY))
  return denom === 0 ? 0 : (C - D) / denom
}

// Cliff's Delta (rank-biserial) — compara dois grupos par a par
function cliffsDelta(groupA, groupB) {
  if (!groupA.length || !groupB.length) return null
  let fav = 0, unfav = 0
  const total = groupA.length * groupB.length
  for (const a of groupA) {
    for (const b of groupB) {
      if (a > b) fav++
      else if (a < b) unfav++
    }
  }
  return (fav - unfav) / total
}

// Coeficiente Eta — diferença entre grupos categóricos (V/E/D)
// groups: { V: [values], E: [values], D: [values] }
function etaCoefficient(groups) {
  const all = Object.values(groups).flat()
  if (all.length < 3) return null
  const grandMean = all.reduce((a, b) => a + b, 0) / all.length
  const ssBetween = Object.values(groups).reduce((acc, vals) => {
    if (!vals.length) return acc
    const gMean = vals.reduce((a, b) => a + b, 0) / vals.length
    return acc + vals.length * Math.pow(gMean - grandMean, 2)
  }, 0)
  const ssTotal = all.reduce((acc, v) => acc + Math.pow(v - grandMean, 2), 0)
  if (ssTotal === 0) return 0
  const eta2 = ssBetween / ssTotal
  return { eta: Math.sqrt(eta2), eta2 }
}

// Força para Eta
function etaLabel(eta) {
  if (eta == null) return '—'
  if (eta >= 0.80) return 'Muito forte'
  if (eta >= 0.60) return 'Forte'
  if (eta >= 0.40) return 'Moderada'
  if (eta >= 0.20) return 'Fraca'
  return 'Muito fraca'
}

function eta2Label(eta2) {
  if (eta2 == null) return '—'
  const p = eta2 * 100
  if (p >= 30) return 'Diferença relevante'
  if (p >= 15) return 'Diferença moderada'
  if (p >= 5)  return 'Diferença baixa'
  return 'Pouca diferença'
}

// Força para Spearman/Kendall
function forceLabel(v) {
  const a = Math.abs(v)
  if (a >= 0.65) return 'Sinal forte'
  if (a >= 0.45) return 'Sinal consistente'
  if (a >= 0.25) return 'Sinal leve'
  if (a >= 0.10) return 'Tendência inicial'
  return 'Sem padrão claro'
}

// Força para Cliff's Delta
function deltaLabel(v) {
  if (v == null) return '—'
  const a = Math.abs(v)
  if (a >= 0.70) return 'Sinal muito forte'
  if (a >= 0.50) return 'Sinal forte'
  if (a >= 0.30) return 'Sinal competitivo'
  if (a >= 0.10) return 'Tendência inicial'
  return 'Sem padrão claro'
}

function fmtCorr(v) {
  if (v == null || isNaN(v)) return '—'
  return (v >= 0 ? '+' : '') + v.toFixed(2)
}

function pctDiff(a, b) {
  if (a == null || b == null || b === 0) return null
  return ((a - b) / b) * 100
}

// ─── HIPÓTESES ────────────────────────────────────────────────────────────────

const HYPOTHESES = {
  dist: {
    pos: 'Maior distância total tende a aparecer nas vitórias. Pode indicar equipe com mais posse e controle territorial.',
    neg: 'Menor distância nas vitórias pode indicar equipe compacta que explora espaços em transição.',
    neu: 'Distância total pouco conclusiva isoladamente. Analise junto com ritmo (M/min) e contexto do jogo.',
  },
  mmin: {
    pos: 'Maior ritmo (M/min) associado a melhores resultados. Indica equipe fisicamente presente e verticalmente ativa.',
    neg: 'Ritmo mais alto em derrotas pode indicar jogo sem bola, pressão sofrida e recomposição constante.',
    neu: 'Ritmo de jogo não apresenta padrão claro entre os resultados na amostra atual.',
  },
  hsr: {
    pos: 'Mais alta velocidade nos jogos de vitória. Equipe usa deslocamentos intensos para criar e explorar espaços.',
    neg: 'Alta velocidade mais presente em derrotas. Pode indicar corridas de recuperação e exposição defensiva.',
    neu: 'HSR não apresenta padrão claro entre os resultados na amostra atual.',
  },
  sprint: {
    pos: 'Mais sprints nas vitórias. Indica equipe explosiva e capaz de atacar o espaço nos momentos decisivos.',
    neg: 'Mais sprints nas derrotas pode indicar necessidade de perseguir adversários ou cobrir espaços deixados.',
    neu: 'Volume de sprints não diferencia claramente vitória e derrota na amostra atual.',
  },
  pl: {
    pos: 'Maior carga nas vitórias. Pode indicar domínio físico e capacidade de sustentar intensidade ao longo do jogo.',
    neg: 'Carga mais alta nas derrotas pode indicar desgaste excessivo, jogo mais longo sem bola ou sobreposição física.',
    neu: 'Carga total não apresenta associação clara com o resultado.',
  },
  accDec: {
    pos: 'Mais acelerações e desacelerações nos melhores resultados. Indica equipe mais ativa para pressionar, reagir à perda e disputar segunda bola.',
    neg: 'Volume de ACC+DEC maior em derrotas pode indicar jogo mais reativo, com mais ajustes defensivos e menos fluidez.',
    neu: 'ACC+DEC não apresenta padrão claro entre os resultados na amostra atual.',
  },
  vmax90: {
    pos: 'Mais atletas chegando perto da velocidade máxima nas vitórias. Pode indicar transições ofensivas e ataque ao espaço.',
    neg: 'Picos de velocidade máxima mais presentes em derrotas. Pode indicar exposição defensiva, recomposições longas ou jogo mais aberto.',
    neu: '≥90% Vmax não diferencia claramente os resultados na amostra atual.',
  },
}

// Hipótese para modo perfil (comparação vs média geral)
const PROFILE_HYPOTHESES = {
  dist: {
    above: 'Distância total acima da média geral. Pode indicar maior volume de jogo e controle territorial neste cenário.',
    below: 'Distância total abaixo da média geral. Pode indicar jogo mais compacto, menor posse ou jogo em transição.',
    neutral: 'Distância total dentro da média geral. Sem perfil físico dominante nesta métrica.',
  },
  mmin: {
    above: 'Ritmo de jogo (M/min) acima da média geral. Indicativo de maior intensidade e presença física.',
    below: 'Ritmo de jogo abaixo da média geral. Pode indicar jogos mais lentos, de maior controle do adversário ou baixa intensidade.',
    neutral: 'Ritmo dentro do padrão geral da equipe.',
  },
  hsr: {
    above: 'Alta velocidade acima da média geral. Indica maior volume de corridas intensas neste cenário.',
    below: 'Alta velocidade abaixo da média. Pode indicar menor profundidade ofensiva ou menor necessidade de corridas intensas.',
    neutral: 'HSR dentro do padrão geral.',
  },
  sprint: {
    above: 'Sprints acima da média geral. Equipe mais explosiva e em transições verticais neste cenário.',
    below: 'Sprints abaixo da média. Jogo com menos ruptura ou menos oportunidade de atacar o espaço.',
    neutral: 'Volume de sprints dentro do padrão geral.',
  },
  pl: {
    above: 'Carga (PL) acima da média geral. Indica exigência física maior neste grupo de jogos.',
    below: 'Carga abaixo da média. Jogo menos exigente fisicamente ou com menor desgaste neuromuscular.',
    neutral: 'Carga dentro do padrão geral da equipe.',
  },
  accDec: {
    above: 'ACC+DEC acima da média. Mais ações curtas de aceleração e desaceleração: pressão, reação e disputa de segunda bola.',
    below: 'ACC+DEC abaixo da média. Jogo com menos rupturas curtas, possivelmente mais longo e posicional.',
    neutral: 'ACC+DEC dentro do padrão geral.',
  },
  vmax90: {
    above: 'Mais atletas atingindo ≥90% da Vmax neste cenário. Pode indicar picos de intensidade ou exposição a corridas longas.',
    below: 'Menos atletas atingindo ≥90% da Vmax. Intensidade máxima menos exigida neste grupo de jogos.',
    neutral: '≥90% Vmax dentro do padrão geral.',
  },
}

function getProfileHypothesis(key, diffPct) {
  const h = PROFILE_HYPOTHESES[key]
  if (!h) return ''
  if (diffPct == null) return h.neutral
  if (diffPct > 3) return h.above
  if (diffPct < -3) return h.below
  return h.neutral
}

function getHypothesis(key, k) {
  const h = HYPOTHESES[key]
  if (!h) return ''
  if (Math.abs(k) < 0.08) return h.neu
  return k > 0 ? h.pos : h.neg
}

// ─── CONFIGS ──────────────────────────────────────────────────────────────────

const METRICS = [
  { key: 'dist',   label: 'Distância média',  unit: 'm',     dec: 0 },
  { key: 'mmin',   label: 'M/min médio',       unit: 'm/min', dec: 1 },
  { key: 'hsr',    label: 'HSR médio',          unit: 'm',     dec: 0 },
  { key: 'sprint', label: 'Sprint médio',       unit: 'm',     dec: 0 },
  { key: 'pl',     label: 'PL médio',           unit: '',      dec: 1 },
  { key: 'accDec', label: 'ACC+DEC médio',      unit: '',      dec: 0 },
  { key: 'vmax90', label: '≥90% Vmax',          unit: 'at.',   dec: 0 },
]

const RESULT_CFG = {
  V: { label: 'Vitória', pts: 3, text: 'text-green-600', bar: '#22c55e', border: 'border-green-200', bg: 'bg-green-50' },
  E: { label: 'Empate',  pts: 1, text: 'text-amber-600', bar: '#f59e0b', border: 'border-amber-200', bg: 'bg-amber-50' },
  D: { label: 'Derrota', pts: 0, text: 'text-red-600',   bar: '#ef4444', border: 'border-red-200',   bg: 'bg-red-50' },
}

const COMPETICOES = ['Série C', 'Copa do Brasil', 'Paulistão', 'Brasileiro SUB20 Série B', 'Paulistão SUB20 Série A', 'Copa Sul Sudeste', 'Amistoso', 'Outra']

// ─── COMPONENTES ──────────────────────────────────────────────────────────────

function CorrBadge({ value }) {
  if (value == null || isNaN(value)) return <span className="text-slate-300 font-black text-sm">—</span>
  const a = Math.abs(value)
  const pos = value >= 0
  const bg = a >= 0.25
    ? (pos ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')
    : 'bg-slate-100 text-slate-600'
  return <span className={`inline-block font-black text-sm px-2 py-0.5 rounded ${bg}`}>{fmtCorr(value)}</span>
}

function DeltaBadge({ value }) {
  if (value == null || isNaN(value)) return <span className="text-slate-300 font-black text-sm">—</span>
  const a = Math.abs(value)
  const pos = value >= 0
  const bg = a >= 0.30
    ? (pos ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')
    : a >= 0.10
      ? (pos ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')
      : 'bg-slate-100 text-slate-500'
  return <span className={`inline-block font-black text-sm px-2 py-0.5 rounded ${bg}`}>{fmtCorr(value)}</span>
}

function DirBadge({ value }) {
  if (value == null || isNaN(value) || Math.abs(value) < 0.05)
    return <span className="text-xs text-slate-400 font-bold">Neutra</span>
  return value > 0
    ? <span className="text-xs font-black text-green-600">↑ Positiva</span>
    : <span className="text-xs font-black text-red-600">↓ Negativa</span>
}

function EtaBadge({ eta, eta2 }) {
  if (eta == null) return <span className="text-slate-300 font-black text-sm">—</span>
  const color = eta >= 0.60 ? 'bg-violet-100 text-violet-800'
    : eta >= 0.40 ? 'bg-blue-100 text-blue-700'
    : eta >= 0.20 ? 'bg-slate-100 text-slate-600'
    : 'bg-slate-50 text-slate-400'
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`inline-block font-black text-sm px-2 py-0.5 rounded ${color}`}>
        {eta.toFixed(2)}
      </span>
      <span className="text-[9px] text-slate-400 font-bold">{(eta2 * 100).toFixed(0)}% variação</span>
    </div>
  )
}

function PctBadge({ v, inv = false }) {
  if (v == null) return <span className="text-slate-300 text-xs">—</span>
  const isGood = inv ? v < 0 : v > 0
  const label = (v > 0 ? '+' : '') + v.toFixed(1) + '%'
  return <span className={`text-xs font-black ${isGood ? 'text-green-600' : 'text-red-600'}`}>{label}</span>
}

// ─── HELPERS NOVOS ─────────────────────────────────────────────────────────────

// Categorias de métricas para "Leitura por Tipo de Métrica"
const METRIC_CATEGORIES = [
  { id: 'volume',        label: 'Volume',            desc: 'Quanto a equipe percorre e acumula',  keys: ['dist', 'pl', 'accDec'] },
  { id: 'intensidade',   label: 'Intensidade',       desc: 'Quão rápido e forte a equipe joga',   keys: ['mmin', 'hsr', 'sprint'] },
  { id: 'explosividade', label: 'Explosividade',     desc: 'Ações curtas e máximas',              keys: ['sprint', 'accDec', 'vmax90'] },
  { id: 'risco',         label: 'Exposição / Risco', desc: 'Sinais de desgaste e exposição',      keys: ['pl', 'vmax90', 'sprint'] },
]

// Confiabilidade pela amostra (regra solicitada)
function confiabilidade(n) {
  if (n >= 21) return { label: 'Boa',        color: 'text-green-600',  tone: 'amostra robusta' }
  if (n >= 11) return { label: 'Moderada',   color: 'text-amber-600',  tone: 'amostra moderada' }
  if (n >= 6)  return { label: 'Baixa',      color: 'text-orange-600', tone: 'amostra baixa' }
  return { label: 'Muito baixa', color: 'text-red-600', tone: 'leitura exploratória' }
}

// Força da evidência a partir de Eta e Cliff's Delta
function evidenciaLabel(eta, cd) {
  const e = eta ?? 0
  const d = Math.abs(cd ?? 0)
  if (e >= 0.60 || d >= 0.50) return 'Forte'
  if (e >= 0.40 || d >= 0.30) return 'Moderada'
  if (e >= 0.20 || d >= 0.10) return 'Fraca'
  return 'Muito fraca'
}

function evidenciaColor(label) {
  if (label === 'Forte')    return 'bg-violet-100 text-violet-800'
  if (label === 'Moderada') return 'bg-blue-100 text-blue-700'
  if (label === 'Fraca')    return 'bg-slate-100 text-slate-600'
  return 'bg-slate-50 text-slate-400'
}

// Direção de associação por Cliff's Delta (V x D)
function assocResult(cd) {
  if (cd == null) return null
  if (cd >= 0.10) return 'V'
  if (cd <= -0.10) return 'D'
  return null
}

// Detecta índices fora da curva (z-score) em um vetor
function outlierFlags(values) {
  const vals = values.filter(v => v != null && !isNaN(v))
  if (vals.length < 4) return values.map(() => 0)
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  const sd = Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length)
  if (sd === 0) return values.map(() => 0)
  return values.map(v => (v == null || isNaN(v)) ? 0 : (v - mean) / sd)
}

// Texto curto de associação por métrica
function metricAssocText(label, cd) {
  const r = assocResult(cd)
  if (r === 'V') return `${label} aparece mais associado à vitória`
  if (r === 'D') return `${label} aparece mais associado à derrota`
  return `${label} sem padrão claro entre resultados`
}

const mandoLabel = m => m === 'M' ? 'Casa' : m === 'V' ? 'Fora' : 'Sem mando'
const resultLabel = r => RESULT_CFG[r]?.label || '—'

function dateShort(g) {
  const d = g.date?.includes('/') ? g.date.split('/').reverse().join('-') : g.date
  return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : (g.date || '—')
}
function dateFull(g) {
  const d = g.date?.includes('/') ? g.date.split('/').reverse().join('-') : g.date
  return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : (g.date || '—')
}

// Tooltip da linha do tempo
function TimelineTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  const d = payload[0].payload
  const rc = RESULT_CFG[d.result]
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-black text-slate-800">{d.dateFull} · {d.opponent}</p>
      <p className={`font-black ${rc?.text || 'text-slate-500'}`}>{rc?.label || '—'} {d.score}</p>
      <p className="text-slate-500 font-medium">{d.mando} · {d.competition}</p>
      <p className="text-slate-700 font-bold mt-0.5">Valor: {d.value != null ? d.value.toFixed(1) : '—'}</p>
    </div>
  )
}

// Dot colorido por resultado
function TimelineDot({ cx, cy, payload }) {
  if (cx == null || cy == null) return null
  const color = RESULT_CFG[payload.result]?.bar || '#94a3b8'
  return <circle cx={cx} cy={cy} r={5} fill={color} stroke="#fff" strokeWidth={1.5} />
}

// ─── MODAL DE EDIÇÃO (EXPANDIDO) ───────────────────────────────────────────────

const NIVEL_ADV   = ['Forte', 'Médio', 'Fraco']
const ESTADO_PLACAR = ['Vencendo', 'Empatando', 'Perdendo', 'Alternado']
const MODELO_JOGO = ['Pressão alta', 'Bloco médio', 'Bloco baixo', 'Transição', 'Controle com bola', 'Jogo direto', 'Misto']
const GRAMADO     = ['Bom', 'Regular', 'Ruim', 'Sintético']
const CLIMA       = ['Normal', 'Calor', 'Chuva', 'Frio', 'Vento']

function EditContextModal({ game, onClose, onSave }) {
  const [form, setForm] = useState({
    result:        game.result        || '',
    mando:         game.mando         || '',
    opponent:      game.opponent      || '',
    competition:   game.competition   || '',
    score_pro:     game.score_pro     ?? '',
    score_con:     game.score_con     ?? '',
    nivel_adv:     game.nivel_adv     || '',
    estado_placar: game.estado_placar || '',
    modelo_jogo:   game.modelo_jogo   || '',
    formacao:      game.formacao      || '',
    decisivo:      game.decisivo      || '',
    viagem_longa:  game.viagem_longa  || '',
    gramado:       game.gramado       || '',
    clima:         game.clima         || '',
    obs:           game.obs           || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/gps/sessions/${game.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: {
            result:        form.result        || null,
            mando:         form.mando         || null,
            opponent:      form.opponent      || null,
            competition:   form.competition   || null,
            score_pro:     form.score_pro !== '' ? Number(form.score_pro) : null,
            score_con:     form.score_con !== '' ? Number(form.score_con) : null,
            nivel_adv:     form.nivel_adv     || null,
            estado_placar: form.estado_placar || null,
            modelo_jogo:   form.modelo_jogo   || null,
            formacao:      form.formacao      || null,
            decisivo:      form.decisivo      || null,
            viagem_longa:  form.viagem_longa  || null,
            gramado:       form.gramado       || null,
            clima:         form.clima         || null,
            obs:           form.obs           || null,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro ao salvar.'); return }
      onSave(game.id, data.metadata)
    } catch { setError('Erro de conexão.') }
    finally { setSaving(false) }
  }

  const inp = 'w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-amber-400'
  const lbl = 'text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1'
  const dateStr = game.date?.includes('/') ? game.date.split('/').reverse().join('-') : game.date

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-black uppercase tracking-tight">Editar Contexto do Jogo</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {dateStr ? new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR') : ''} · {game.opponent || 'Sem adversário'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-3 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Resultado</label>
              <div className="flex gap-1">
                {[['V','✅'],['E','🟡'],['D','❌']].map(([val,ic]) => (
                  <button key={val} onClick={() => set('result', form.result === val ? '' : val)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${form.result === val ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                    {ic} {val}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={lbl}>Mando</label>
              <div className="flex gap-1">
                {[['M','🏠 Casa'],['V','✈️ Fora']].map(([val,ic]) => (
                  <button key={val} onClick={() => set('mando', form.mando === val ? '' : val)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${form.mando === val ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className={lbl}>Adversário</label>
            <input className={inp} value={form.opponent} onChange={e => set('opponent', e.target.value)} placeholder="Ex: Mirassol" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Competição</label>
              <select className={inp} value={form.competition} onChange={e => set('competition', e.target.value)}>
                <option value="">Selecionar</option>
                {COMPETICOES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Formação inicial</label>
              <input className={inp} value={form.formacao} onChange={e => set('formacao', e.target.value)} placeholder="Ex: 4-2-3-1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Gols Pró</label>
              <input type="number" min="0" className={inp} value={form.score_pro} onChange={e => set('score_pro', e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className={lbl}>Gols Contra</label>
              <input type="number" min="0" className={inp} value={form.score_con} onChange={e => set('score_con', e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Nível do adversário</label>
              <select className={inp} value={form.nivel_adv} onChange={e => set('nivel_adv', e.target.value)}>
                <option value="">Não informado</option>
                {NIVEL_ADV.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Estado do placar</label>
              <select className={inp} value={form.estado_placar} onChange={e => set('estado_placar', e.target.value)}>
                <option value="">Não informado</option>
                {ESTADO_PLACAR.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={lbl}>Modelo de jogo predominante</label>
            <select className={inp} value={form.modelo_jogo} onChange={e => set('modelo_jogo', e.target.value)}>
              <option value="">Não informado</option>
              {MODELO_JOGO.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Gramado</label>
              <select className={inp} value={form.gramado} onChange={e => set('gramado', e.target.value)}>
                <option value="">Não informado</option>
                {GRAMADO.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Clima</label>
              <select className={inp} value={form.clima} onChange={e => set('clima', e.target.value)}>
                <option value="">Não informado</option>
                {CLIMA.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Jogo decisivo</label>
              <div className="flex gap-1">
                {[['Sim','Sim'],['Nao','Não']].map(([val,l]) => (
                  <button key={val} onClick={() => set('decisivo', form.decisivo === val ? '' : val)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${form.decisivo === val ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={lbl}>Viagem longa</label>
              <div className="flex gap-1">
                {[['Sim','Sim'],['Nao','Não']].map(([val,l]) => (
                  <button key={val} onClick={() => set('viagem_longa', form.viagem_longa === val ? '' : val)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${form.viagem_longa === val ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className={lbl}>Observação livre</label>
            <textarea className={inp + ' resize-none'} rows={2} value={form.obs} onChange={e => set('obs', e.target.value)} placeholder="Anotações do jogo..." />
          </div>

          {error && <p className="text-red-600 text-xs font-bold">{error}</p>}
        </div>

        <div className="flex gap-2 justify-end p-5 border-t border-slate-100 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 text-sm font-black bg-amber-500 text-black rounded-lg hover:bg-amber-400 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar contexto'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PÁGINA ───────────────────────────────────────────────────────────────────

export default function CorrelacaoPage() {
  const router = useRouter()
  const { gpsData, vmaxBaseline, isExcluded, fetchGpsSessions } = useData()

  const [filterMando,  setFilterMando]  = useState('all')
  const [filterResult, setFilterResult] = useState('all')
  const [filterComp,   setFilterComp]   = useState('all')
  const [filterLast,   setFilterLast]   = useState(0)
  const [selectedMetric, setSelectedMetric] = useState('mmin')
  const [timelineMetric, setTimelineMetric] = useState('mmin')
  const [intensosMetric, setIntensosMetric] = useState('dist')
  const [editGame, setEditGame] = useState(null)
  const [showCtxTable, setShowCtxTable] = useState(false)
  const [metaOverrides, setMetaOverrides] = useState({})

  // ── Extrair todos os jogos ────────────────────────────────────────────────
  const allGames = useMemo(() => {
    return gpsData
      .filter(s => s.metadata?.type === 'jogo' || s.metadata?.sessionType === 'jogo')
      .map(session => {
        const meta = { ...(session.metadata || {}), ...(metaOverrides[session.id] || {}) }
        const rows = session.rows
          .filter(r => r.periodNumber === 0 && !r.isOutlier && r.playerName && !isExcluded(r.playerName))
          .map(r => {
            const vm = vmaxBaseline[r.playerName]
            const vmaxPct = vm ? calcVmaxPct(r.maxVelocity, vm) : null
            return { ...r, vmaxPct, achieved90: vmaxPct != null && vmaxPct >= 90, accDecTotal: (r.acceleration || 0) + (r.deceleration || 0) }
          })
        if (!rows.length) return null
        const n = rows.length
        const sum = fn => rows.reduce((s, r) => s + (fn(r) || 0), 0)
        return {
          id: session.id, date: session.date,
          opponent: meta.opponent || '—',
          result: meta.result || null,
          mando:  meta.mando  || null,
          competition: meta.competition || null,
          score_pro: meta.score_pro ?? null,
          score_con: meta.score_con ?? null,
          nivel_adv:     meta.nivel_adv     || null,
          estado_placar: meta.estado_placar || null,
          modelo_jogo:   meta.modelo_jogo   || null,
          formacao:      meta.formacao      || null,
          decisivo:      meta.decisivo      || null,
          viagem_longa:  meta.viagem_longa  || null,
          gramado:       meta.gramado       || null,
          clima:         meta.clima         || null,
          obs:           meta.obs           || null,
          pts: meta.result === 'V' ? 3 : meta.result === 'E' ? 1 : meta.result === 'D' ? 0 : null,
          dist:   sum(r => r.totalDistance) / n,
          mmin:   sum(r => r.distanceRelative) / n,
          hsr:    sum(r => r.hsr) / n,
          sprint: sum(r => r.sprintDistance) / n,
          pl:     sum(r => r.playerLoad) / n,
          accDec: sum(r => r.accDecTotal) / n,
          vmax90: rows.filter(r => r.achieved90).length,
          n,
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        const da = a.date?.includes('/') ? a.date.split('/').reverse().join('-') : (a.date || '')
        const db = b.date?.includes('/') ? b.date.split('/').reverse().join('-') : (b.date || '')
        return db.localeCompare(da)
      })
  }, [gpsData, vmaxBaseline, isExcluded, metaOverrides])

  const gamesWithResult = useMemo(() => allGames.filter(g => g.result && g.pts != null), [allGames])
  const hasMando  = useMemo(() => allGames.some(g => g.mando), [allGames])
  const semMando  = useMemo(() => allGames.filter(g => g.result && !g.mando).length, [allGames])

  // Competições disponíveis (a partir dos jogos com resultado)
  const availableComps = useMemo(() => {
    const set = new Set(gamesWithResult.map(g => g.competition).filter(Boolean))
    return [...set].sort()
  }, [gamesWithResult])

  // Média geral de TODOS os jogos (referência para modo perfil)
  const globalAvg = useMemo(() => {
    const g = gamesWithResult
    if (!g.length) return {}
    const avg = {}
    METRICS.forEach(m => { avg[m.key] = g.reduce((s, x) => s + (x[m.key] || 0), 0) / g.length })
    return avg
  }, [gamesWithResult])

  function handleMetaSave(id, newMeta) {
    setMetaOverrides(prev => ({ ...prev, [id]: newMeta }))
    setEditGame(null)
    fetchGpsSessions()
  }

  // ── Filtros (mando + resultado + competição + últimos) ────────────────────
  const filteredGames = useMemo(() => {
    let g = [...gamesWithResult]
    if (filterComp   !== 'all') g = g.filter(x => x.competition === filterComp)
    if (filterMando  !== 'all') g = g.filter(x => x.mando === filterMando)
    if (filterResult !== 'all') g = g.filter(x => x.result === filterResult)
    if (filterLast > 0) g = g.slice(0, filterLast)
    return g
  }, [gamesWithResult, filterComp, filterMando, filterResult, filterLast])

  // jogos em ordem cronológica (asc) para timeline e ranking
  const chronoGames = useMemo(() => {
    return [...filteredGames].sort((a, b) => {
      const da = a.date?.includes('/') ? a.date.split('/').reverse().join('-') : (a.date || '')
      const db = b.date?.includes('/') ? b.date.split('/').reverse().join('-') : (b.date || '')
      return da.localeCompare(db)
    })
  }, [filteredGames])

  // ── Detectar modo: correlação vs perfil ──────────────────────────────────
  const uniqueResults = useMemo(() => new Set(filteredGames.map(g => g.result)), [filteredGames])
  const isProfileMode = filteredGames.length > 0 && uniqueResults.size < 2
  const singleResult = isProfileMode ? [...uniqueResults][0] : null

  // ── Modo correlação ────────────────────────────────────────────────────────
  const correlations = useMemo(() => {
    if (isProfileMode || filteredGames.length < 3) return []
    const pts = filteredGames.map(g => g.pts)
    const wins  = filteredGames.filter(g => g.result === 'V')
    const draws = filteredGames.filter(g => g.result === 'E')
    const loses = filteredGames.filter(g => g.result === 'D')
    return METRICS.map(m => {
      const xs = filteredGames.map(g => g[m.key])
      const k = filteredGames.length >= 4 ? kendallTauB(xs, pts) : null
      const s = filteredGames.length >= 4 ? spearman(xs, pts) : null
      const cd = (wins.length && loses.length)
        ? cliffsDelta(wins.map(g => g[m.key]), loses.map(g => g[m.key]))
        : null
      const etaGroups = {
        ...(wins.length  ? { V: wins.map(g => g[m.key])  } : {}),
        ...(draws.length ? { E: draws.map(g => g[m.key]) } : {}),
        ...(loses.length ? { D: loses.map(g => g[m.key]) } : {}),
      }
      const etaResult = Object.keys(etaGroups).length >= 2 ? etaCoefficient(etaGroups) : null
      const groupAvgs = Object.entries(etaGroups).map(([r, vals]) => ({
        r, avg: vals.reduce((a, b) => a + b, 0) / vals.length
      }))
      const topGroup  = groupAvgs.reduce((a, b) => b.avg > a.avg ? b : a, groupAvgs[0])
      const botGroup  = groupAvgs.reduce((a, b) => b.avg < a.avg ? b : a, groupAvgs[0])
      return { ...m, k, s, cd, eta: etaResult?.eta ?? null, eta2: etaResult?.eta2 ?? null, topGroup: topGroup?.r, botGroup: botGroup?.r }
    }).sort((a, b) => (b.eta ?? 0) - (a.eta ?? 0))
  }, [filteredGames, isProfileMode])

  // ── Modo perfil ────────────────────────────────────────────────────────────
  const profileData = useMemo(() => {
    if (!isProfileMode || !filteredGames.length) return []
    return METRICS.map(m => {
      const filtAvg = filteredGames.reduce((s, g) => s + (g[m.key] || 0), 0) / filteredGames.length
      const gAvg = globalAvg[m.key]
      const diff = pctDiff(filtAvg, gAvg)
      return { ...m, filtAvg, gAvg, diff }
    }).sort((a, b) => Math.abs(b.diff ?? 0) - Math.abs(a.diff ?? 0))
  }, [filteredGames, globalAvg, isProfileMode])

  // ── Médias por resultado (respeitando filtros) ─────────────────────────────
  const avgByResult = useMemo(() => {
    const g = { V: [], E: [], D: [] }
    filteredGames.forEach(x => { if (g[x.result]) g[x.result].push(x) })
    const avg = (games, key) => games.length ? games.reduce((s, x) => s + (x[key] || 0), 0) / games.length : null
    return { ...g, avg }
  }, [filteredGames])

  const meanR = (r, key) => avgByResult.avg(avgByResult[r] || [], key)

  // ── Stats do filtro atual ──────────────────────────────────────────────────
  const stats = useMemo(() => {
    const g = filteredGames
    const V = g.filter(x => x.result === 'V').length
    const E = g.filter(x => x.result === 'E').length
    const D = g.filter(x => x.result === 'D').length
    const pts = V * 3 + E
    const max = g.length * 3
    const aprov = max > 0 ? ((pts / max) * 100).toFixed(0) : '0'
    const topEta = correlations.find(c => c.eta != null)
    const winMetric  = [...correlations].filter(c => (c.cd ?? 0) > 0).sort((a, b) => (b.cd) - (a.cd))[0] || null
    const loseMetric = [...correlations].filter(c => (c.cd ?? 0) < 0).sort((a, b) => (a.cd) - (b.cd))[0] || null
    const maxDiff = [...correlations].filter(c => c.eta2 != null).sort((a, b) => (b.eta2) - (a.eta2))[0] || null
    const conf = confiabilidade(g.length)
    return { total: allGames.length, withResult: gamesWithResult.length, sample: g.length, V, E, D, aprov, topEta, winMetric, loseMetric, maxDiff, conf }
  }, [filteredGames, allGames, gamesWithResult, correlations])

  // ── Leitura por tipo de métrica ────────────────────────────────────────────
  const categoryReadings = useMemo(() => {
    if (isProfileMode || !correlations.length) return []
    const byKey = Object.fromEntries(correlations.map(c => [c.key, c]))
    return METRIC_CATEGORIES.map(cat => {
      const sobeV = [], sobeD = [], neutro = []
      cat.keys.forEach(k => {
        const c = byKey[k]
        if (!c) return
        const r = assocResult(c.cd)
        if (r === 'V') sobeV.push(c.label)
        else if (r === 'D') sobeD.push(c.label)
        else neutro.push(c.label)
      })
      return { ...cat, sobeV, sobeD, neutro }
    })
  }, [correlations, isProfileMode])

  // ── Perguntas rápidas ──────────────────────────────────────────────────────
  const quickQA = useMemo(() => {
    if (isProfileMode || !correlations.length) return []
    const posList = [...correlations].filter(c => (c.cd ?? 0) >= 0.10).sort((a, b) => b.cd - a.cd).slice(0, 3).map(c => c.label.toLowerCase())
    const negList = [...correlations].filter(c => (c.cd ?? 0) <= -0.10).sort((a, b) => a.cd - b.cd).slice(0, 3).map(c => c.label.toLowerCase())
    const distV = meanR('V', 'dist'), distD = meanR('D', 'dist')
    const mminE = meanR('E', 'mmin')
    const mminGeral = filteredGames.length ? filteredGames.reduce((s, g) => s + (g.mmin || 0), 0) / filteredGames.length : null
    const top = stats.maxDiff
    const riskMetric = [...correlations].find(c => (c.key === 'vmax90' || c.key === 'pl') && (c.cd ?? 0) <= -0.10)

    const qa = []
    qa.push({ q: 'Quando vencemos, o que mais aumenta?',
      a: posList.length ? `As vitórias estão mais associadas a ${posList.join(', ')}, indicando equipe mais ativa em pressão, reação à perda e ataque ao espaço.` : 'Ainda sem associação clara nas vitórias para esta amostra.' })
    qa.push({ q: 'Quando perdemos, o que mais chama atenção?',
      a: negList.length ? `As derrotas apresentam maior presença de ${negList.join(', ')}, o que pode indicar jogos mais abertos, recomposição longa ou exposição defensiva.` : 'Nenhuma métrica se destaca claramente nas derrotas nesta amostra.' })
    qa.push({ q: 'O time corre mais quando vence?',
      a: (distV != null && distD != null)
        ? (distV > distD * 1.02 ? `Sim. A distância média nas vitórias (${Math.round(distV)}m) é maior que nas derrotas (${Math.round(distD)}m).`
          : distV < distD * 0.98 ? `Não. A equipe percorre mais nas derrotas (${Math.round(distD)}m) do que nas vitórias (${Math.round(distV)}m), o que pode indicar jogo sem bola.`
          : 'A distância percorrida é parecida entre vitória e derrota nesta amostra.')
        : 'Amostra insuficiente de vitórias e derrotas para comparar.' })
    qa.push({ q: 'O time fica mais intenso nos empates?',
      a: (mminE != null && mminGeral != null)
        ? (mminE > mminGeral * 1.02 ? `Nos empates o ritmo (M/min) tende a ser mais alto (${mminE.toFixed(1)}) que a média do recorte (${mminGeral.toFixed(1)}).`
          : mminE < mminGeral * 0.98 ? `Nos empates o ritmo costuma cair em relação à média do recorte.`
          : 'O ritmo nos empates fica próximo da média do recorte.')
        : 'Sem empates suficientes nesta amostra para avaliar.' })
    qa.push({ q: 'Qual métrica parece mais importante para o resultado?',
      a: top ? `${top.label} é a que mais diferencia os resultados (Eta² ${(top.eta2 * 100).toFixed(0)}% da variação). É a leitura que merece mais atenção neste recorte.` : 'Nenhuma métrica se destaca de forma clara ainda.' })
    qa.push({ q: 'Existe algum alerta físico/tático?',
      a: riskMetric ? `Sim. ${riskMetric.label} aparece mais nas derrotas, o que pode indicar exposição defensiva ou desgaste, não necessariamente melhor desempenho físico.` : 'Nenhum alerta físico/tático evidente na amostra atual.' })
    return qa
  }, [correlations, isProfileMode, filteredGames, stats.maxDiff])

  // ── Casa x Fora (dentro do filtro atual) ───────────────────────────────────
  const mandoSplit = useMemo(() => {
    const build = m => {
      const gs = filteredGames.filter(g => g.mando === m)
      const V = gs.filter(g => g.result === 'V').length
      const E = gs.filter(g => g.result === 'E').length
      const D = gs.filter(g => g.result === 'D').length
      const pts = V * 3 + E
      const aprov = gs.length ? ((pts / (gs.length * 3)) * 100).toFixed(0) : '0'
      // métrica mais associada à vitória neste mando
      let winMetric = null, alertMetric = null
      if (gs.length >= 3) {
        const wins = gs.filter(g => g.result === 'V')
        const loses = gs.filter(g => g.result === 'D')
        if (wins.length && loses.length) {
          const deltas = METRICS.map(mt => ({ mt, cd: cliffsDelta(wins.map(g => g[mt.key]), loses.map(g => g[mt.key])) }))
          winMetric = [...deltas].filter(d => (d.cd ?? 0) > 0).sort((a, b) => b.cd - a.cd)[0]?.mt || null
          alertMetric = [...deltas].filter(d => (d.cd ?? 0) < 0).sort((a, b) => a.cd - b.cd)[0]?.mt || null
        }
      }
      return { games: gs.length, V, E, D, aprov, winMetric, alertMetric }
    }
    return { casa: build('M'), fora: build('V') }
  }, [filteredGames])

  // ── Resumo por competição ──────────────────────────────────────────────────
  const competitionBreakdown = useMemo(() => {
    const comps = [...new Set(filteredGames.map(g => g.competition).filter(Boolean))]
    return comps.map(comp => {
      const gs = filteredGames.filter(g => g.competition === comp)
      const V = gs.filter(g => g.result === 'V').length
      const E = gs.filter(g => g.result === 'E').length
      const D = gs.filter(g => g.result === 'D').length
      const aprov = gs.length ? (((V * 3 + E) / (gs.length * 3)) * 100).toFixed(0) : '0'
      const wins = gs.filter(g => g.result === 'V'), loses = gs.filter(g => g.result === 'D')
      let winMetric = null
      if (wins.length && loses.length) {
        const deltas = METRICS.map(mt => ({ mt, cd: cliffsDelta(wins.map(g => g[mt.key]), loses.map(g => g[mt.key])) }))
        winMetric = [...deltas].filter(d => (d.cd ?? 0) > 0).sort((a, b) => b.cd - a.cd)[0]?.mt || null
      }
      return { comp, games: gs.length, V, E, D, aprov, winMetric }
    }).sort((a, b) => b.games - a.games)
  }, [filteredGames])

  // ── Gráficos ──────────────────────────────────────────────────────────────
  const barData = useMemo(() => {
    return ['V','E','D'].map(r => {
      const val = meanR(r, selectedMetric)
      return { name: RESULT_CFG[r].label, value: val, result: r }
    }).filter(d => d.value != null)
  }, [selectedMetric, avgByResult])

  const rankingData = useMemo(() => {
    if (isProfileMode) {
      return profileData.map(p => ({ name: p.label, value: parseFloat((p.diff || 0).toFixed(1)), isProfile: true }))
    }
    return correlations.map(c => ({ name: c.label, value: parseFloat((c.cd ?? c.k ?? 0).toFixed(2)) }))
  }, [correlations, profileData, isProfileMode])

  // Timeline
  const selTimeline = METRICS.find(m => m.key === timelineMetric)
  const timelineData = useMemo(() => {
    return chronoGames.map(g => ({
      label: dateShort(g),
      value: g[timelineMetric],
      result: g.result,
      opponent: g.opponent,
      score: (g.score_pro != null && g.score_con != null) ? `${g.score_pro}x${g.score_con}` : '—',
      mando: mandoLabel(g.mando),
      competition: g.competition || 'Não informado',
      dateFull: dateFull(g),
    }))
  }, [chronoGames, timelineMetric])

  // Jogos mais intensos
  const selIntensos = METRICS.find(m => m.key === intensosMetric)
  const intensosData = useMemo(() => {
    const vals = filteredGames.map(g => g[intensosMetric])
    const zs = outlierFlags(vals)
    const ranked = filteredGames.map((g, i) => ({ g, val: g[intensosMetric], z: zs[i] }))
      .filter(x => x.val != null)
      .sort((a, b) => b.val - a.val)
    const maxVal = ranked.length ? ranked[0].val : null
    const minVal = ranked.length ? ranked[ranked.length - 1].val : null
    return ranked.map((x, i) => ({ ...x, rank: i + 1, isMax: x.val === maxVal, isMin: x.val === minVal, isOutlier: Math.abs(x.z) >= 2 }))
  }, [filteredGames, intensosMetric])

  // ── Alertas inteligentes ───────────────────────────────────────────────────
  const smartAlerts = useMemo(() => {
    const a = []
    const n = filteredGames.length
    if (n > 0 && n < 6) a.push({ tone: 'warn', text: `Amostra reduzida (${n} jogos). Use como tendência exploratória, não como conclusão definitiva.` })
    if (stats.V === 1) a.push({ tone: 'warn', text: 'O recorte atual possui apenas 1 vitória. Evite conclusões definitivas sobre o que funciona.' })
    if (stats.E === 1) a.push({ tone: 'info', text: 'Apenas 1 empate no recorte. A leitura dos empates é frágil.' })
    if (stats.D === 1) a.push({ tone: 'warn', text: 'O recorte atual possui apenas 1 derrota. Evite conclusões definitivas sobre o que prejudica.' })
    // métrica puxada por outlier
    if (!isProfileMode) {
      const vals = filteredGames.map(g => g[intensosMetric])
      const zs = outlierFlags(vals)
      if (zs.some(z => Math.abs(z) >= 2)) {
        a.push({ tone: 'info', text: `O valor de ${selIntensos?.label} pode estar sendo puxado por um jogo fora da curva. Veja o ranking de "Jogos mais intensos".` })
      }
      // métrica de risco associada à derrota
      const risk = correlations.find(c => (c.key === 'vmax90' || c.key === 'pl') && (c.cd ?? 0) <= -0.10)
      if (risk) a.push({ tone: 'warn', text: `Maior ${risk.label} nas derrotas pode indicar exposição defensiva ou desgaste, não necessariamente melhor desempenho físico.` })
    }
    // competição com poucos jogos
    if (filterComp !== 'all' && n > 0 && n < 6) a.push({ tone: 'info', text: `A competição "${filterComp}" tem poucos jogos no recorte. Leia apenas como tendência.` })
    return a
  }, [filteredGames, stats, isProfileMode, intensosMetric, selIntensos, correlations, filterComp])

  // ── Resumo automático ──────────────────────────────────────────────────────
  const autoSummary = useMemo(() => {
    if (!filteredGames.length) return null
    if (isProfileMode) {
      const rc = RESULT_CFG[singleResult]
      const acima = profileData.filter(p => (p.diff || 0) > 5).map(p => p.label.toLowerCase())
      const abaixo = profileData.filter(p => (p.diff || 0) < -5).map(p => p.label.toLowerCase())
      let txt = `O filtro atual contém apenas ${rc?.label.toLowerCase() || 'um resultado'}s, portanto a correlação com pontuação não é aplicável. A leitura abaixo compara o perfil físico deste recorte contra a média geral de todos os jogos. `
      if (acima.length) txt += `Métricas acima da média: ${acima.join(', ')}. `
      if (abaixo.length) txt += `Métricas abaixo da média: ${abaixo.join(', ')}. `
      if (!acima.length && !abaixo.length) txt += 'As métricas ficaram próximas da média geral neste recorte.'
      return { intro: txt, pos: [], neg: [], emp: [], interpret: '', alerta: 'Correlação não implica causalidade. Leia em conjunto com contexto, adversário, mando, calendário, estratégia e placar.' }
    }
    if (!correlations.length) return { intro: 'Ajuste os filtros ou adicione mais jogos para gerar análises.', pos: [], neg: [], emp: [], interpret: '', alerta: '' }

    const pos = [...correlations].filter(c => (c.cd ?? 0) >= 0.10).sort((a, b) => b.cd - a.cd).map(c => c.label.toLowerCase())
    const neg = [...correlations].filter(c => (c.cd ?? 0) <= -0.10).sort((a, b) => a.cd - b.cd).map(c => c.label.toLowerCase())
    const emp = avgByResult.E.length >= 2
      ? METRICS.map(m => ({ m, e: meanR('E', m.key), g: filteredGames.reduce((s, x) => s + (x[m.key] || 0), 0) / filteredGames.length }))
          .filter(x => x.e != null && x.g && x.e > x.g * 1.03).map(x => x.m.label.toLowerCase())
      : []

    const intro = `A amostra filtrada possui ${filteredGames.length} jogos: ${stats.V} vitórias, ${stats.E} empates e ${stats.D} derrotas. A leitura principal usa Eta, Eta², Kendall Tau-b, Spearman e Índice de Dominância V×D para identificar quais métricas GPS aparecem mais associadas aos resultados.`
    let interpret = ''
    if (pos.length) interpret += `Na prática, quando a equipe vence costuma aparecer mais ${pos.slice(0, 3).join(', ')}: sinais de equipe ativa para pressionar, reagir à perda e atacar o espaço. `
    if (neg.length) interpret += `Já nas derrotas chama atenção ${neg.slice(0, 3).join(', ')}, o que pode indicar jogo mais aberto, recomposição longa ou exposição defensiva.`
    if (!pos.length && !neg.length) interpret = 'Nenhuma métrica se separou de forma clara entre os resultados ainda. Continue registrando jogos para a leitura ganhar robustez.'
    const alerta = 'Correlação não implica causalidade. A leitura deve ser combinada com contexto do jogo, adversário, mando, calendário, estratégia, placar e modelo de jogo.'
    return { intro, pos, neg, emp, interpret, alerta }
  }, [filteredGames, isProfileMode, singleResult, correlations, profileData, avgByResult, stats])

  const selMeta = METRICS.find(m => m.key === selectedMetric)

  const pageTitle = isProfileMode
    ? `Perfil Físico — ${RESULT_CFG[singleResult]?.label || 'Filtro'}`
    : 'GPS × Resultado'

  // Contexto preenchido
  const ctxComplete = g => g.result && g.mando && g.opponent && g.opponent !== '—' && g.competition && g.score_pro != null && g.score_con != null
  const ctxFilled = allGames.filter(ctxComplete).length

  // Rótulos de filtro ativo
  const fMandoTxt  = filterMando === 'all' ? 'Todos' : mandoLabel(filterMando)
  const fResultTxt = filterResult === 'all' ? 'Todos' : resultLabel(filterResult)
  const fCompTxt   = filterComp === 'all' ? 'Todas' : filterComp
  const fLastTxt   = filterLast === 0 ? 'Todos os jogos' : `Últimos ${filterLast}`
  const exportDate = new Date().toLocaleDateString('pt-BR')


  return (
    <div className="min-h-screen bg-white text-black p-4 font-sans">
      <div className="max-w-[1400px] mx-auto flex flex-col gap-5" data-pdf-root>

        {/* HEADER */}
        <header className="flex flex-wrap justify-between items-center border-b-4 border-amber-500 pb-3 gap-3">
          <div className="flex items-center gap-4">
            <img src="/club/escudonovorizontino.png" alt="Escudo" className="h-14 w-auto" />
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-black uppercase leading-none">{pageTitle}</h1>
              <p className="text-sm font-bold tracking-widest text-slate-600 uppercase">
                {isProfileMode ? 'Perfil comparativo vs média geral' : 'Eta · Spearman · Kendall Tau-b · Dominância V×D'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap" data-pdf-hide>
            <ExportPdfButton filename="gps-resultado" />
            <button onClick={() => router.push('/fisiologia')}
              className="bg-slate-200 text-slate-800 px-3 py-1.5 rounded-md text-xs font-bold hover:bg-slate-300 transition-colors">
              ← VOLTAR
            </button>
            <button onClick={() => setShowCtxTable(v => !v)}
              className={`px-3 py-1.5 rounded-md text-xs font-black border transition-all ${showCtxTable ? 'bg-amber-500 text-black border-amber-500' : 'border-amber-400 text-amber-600 hover:bg-amber-50'}`}>
              ✏️ Editar contexto dos jogos
            </button>
          </div>
        </header>

        {/* CAPA / RESUMO EXECUTIVO — só no PDF */}
        <section className="hidden print:block border border-slate-200 rounded-xl p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Relatório · GPS × Resultado</p>
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-800">Grêmio Novorizontino · Fisiologia</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">Categoria profissional · Exportado em {exportDate}</p>
          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
            <p><strong>Filtros aplicados:</strong> Competição {fCompTxt} · Mando {fMandoTxt} · Resultado {fResultTxt} · {fLastTxt}</p>
            <p><strong>Amostra:</strong> {stats.sample} jogos ({stats.V}V · {stats.E}E · {stats.D}D) · Aproveitamento {stats.aprov}% · Confiabilidade {stats.conf.label}</p>
          </div>
          {!isProfileMode && (
            <div className="mt-3 text-xs text-slate-600 leading-relaxed">
              <p className="font-black uppercase tracking-widest text-[10px] text-slate-500 mb-1">Achados principais</p>
              <p>Associadas à vitória: {(autoSummary?.pos?.length ? autoSummary.pos.join(', ') : '—')}.</p>
              <p>Associadas à derrota: {(autoSummary?.neg?.length ? autoSummary.neg.join(', ') : '—')}.</p>
              <p>Sem padrão claro: leitura exige mais jogos onde os sinais ainda são fracos.</p>
            </div>
          )}
        </section>

        {/* RESUMO DO FILTRO ATIVO */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Filtro atual</p>
            <span className={`text-[10px] font-black uppercase tracking-widest ${stats.conf.color}`}>Confiabilidade: {stats.conf.label}</span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm">
            <span><span className="text-slate-400 font-bold">Competição:</span> <strong className="text-slate-800">{fCompTxt}</strong></span>
            <span><span className="text-slate-400 font-bold">Mando:</span> <strong className="text-slate-800">{fMandoTxt}</strong></span>
            <span><span className="text-slate-400 font-bold">Resultado:</span> <strong className="text-slate-800">{fResultTxt}</strong></span>
            <span><span className="text-slate-400 font-bold">Recorte:</span> <strong className="text-slate-800">{fLastTxt}</strong></span>
            <span><span className="text-slate-400 font-bold">Amostra:</span> <strong className="text-slate-800">{stats.sample} jogos</strong></span>
            <span className="text-green-600 font-black">{stats.V}V</span>
            <span className="text-amber-600 font-black">{stats.E}E</span>
            <span className="text-red-600 font-black">{stats.D}D</span>
          </div>
          {stats.sample > 0 && stats.sample < 6 && (
            <p className="mt-2 text-xs text-amber-700 font-bold">⚠️ Amostra reduzida. Use como tendência exploratória, não como conclusão definitiva.</p>
          )}
        </div>

        {/* CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3">
          {[
            { label: 'Jogos no filtro', value: stats.sample, color: 'text-black' },
            { label: 'Vitórias', value: stats.V, color: 'text-green-600' },
            { label: 'Empates',  value: stats.E, color: 'text-amber-600' },
            { label: 'Derrotas', value: stats.D, color: 'text-red-600' },
            { label: 'Aproveitamento', value: stats.aprov + '%', color: 'text-black' },
            { label: 'Assoc. + à vitória', value: stats.winMetric ? stats.winMetric.label.split(' ')[0] : '—', sub: stats.winMetric ? 'Associação mais forte' : 'Sem sinal', color: 'text-green-700', small: true },
            { label: 'Assoc. + à derrota', value: stats.loseMetric ? stats.loseMetric.label.split(' ')[0] : '—', sub: stats.loseMetric ? 'Atenção' : 'Sem sinal', color: 'text-red-700', small: true },
            { label: 'Maior diferença V×D', value: stats.maxDiff ? `${stats.maxDiff.label.split(' ')[0]}` : '—', sub: stats.maxDiff ? `Eta² ${(stats.maxDiff.eta2 * 100).toFixed(0)}%` : 'Sem sinal', color: 'text-violet-700', small: true },
            { label: 'Confiabilidade', value: stats.conf.label, sub: stats.conf.tone, color: stats.conf.color, small: true },
          ].map(({ label, value, color, small, sub }) => (
            <div key={label} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
              <p className={`font-black leading-tight ${small ? 'text-sm' : 'text-2xl'} ${color}`}>{value}</p>
              {sub && <p className="text-[9px] text-slate-400 font-bold mt-0.5">{sub}</p>}
            </div>
          ))}
        </div>

        {/* ALERTAS INTELIGENTES */}
        {smartAlerts.length > 0 && (
          <div className="flex flex-col gap-2">
            {smartAlerts.map((al, i) => (
              <div key={i} className={`rounded-xl p-3 text-xs font-bold flex items-start gap-2 border ${al.tone === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                <span>{al.tone === 'warn' ? '⚠️' : 'ℹ️'}</span><span>{al.text}</span>
              </div>
            ))}
          </div>
        )}
        {semMando > 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 font-bold flex items-center gap-2" data-pdf-hide>
            🏟️ {semMando} jogo{semMando > 1 ? 's' : ''} sem mando definido. Use "Editar contexto dos jogos" para completar Casa/Fora.
          </div>
        )}

        {/* TABELA EDIÇÃO CONTEXTO */}
        {showCtxTable && (
          <div className="border border-amber-200 rounded-xl overflow-hidden" data-pdf-hide>
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-amber-800">Editar Contexto dos Jogos</h2>
                <p className="text-[10px] text-amber-600 font-medium mt-0.5">Clique em Editar para completar mando, placar, competição e contexto tático</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">Contexto preenchido: {ctxFilled}/{allGames.length} jogos</span>
                <button onClick={() => setShowCtxTable(false)} className="text-amber-600 hover:text-amber-800 text-sm font-black">Fechar ✕</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['Data','Adversário','Resultado','Placar','Mando','Competição','Contexto',''].map(h => (
                      <th key={h} className="text-left text-[9px] font-black uppercase tracking-widest text-slate-400 px-3 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allGames.map(g => {
                    const rc = RESULT_CFG[g.result]
                    const placar = g.score_pro != null && g.score_con != null ? `${g.score_pro}x${g.score_con}` : '—'
                    const complete = ctxComplete(g)
                    return (
                      <tr key={g.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${complete ? '' : 'border-l-4 border-l-amber-400'}`}>
                        <td className="px-3 py-2 text-xs font-bold text-slate-700 whitespace-nowrap">{dateShort(g)}</td>
                        <td className="px-3 py-2 text-xs text-slate-700">{g.opponent}</td>
                        <td className="px-3 py-2">{rc ? <span className={`text-xs font-black ${rc.text}`}>{rc.label}</span> : <span className="text-xs text-slate-300">—</span>}</td>
                        <td className="px-3 py-2 text-xs font-bold text-slate-600">{placar}</td>
                        <td className="px-3 py-2">
                          {g.mando === 'M' ? <span className="text-xs font-black text-blue-600">🏠 Casa</span>
                           : g.mando === 'V' ? <span className="text-xs font-black text-purple-600">✈️ Fora</span>
                           : <span className="text-xs text-red-400 font-bold">Sem mando</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500">{g.competition || <span className="text-amber-500 font-bold">Pendente</span>}</td>
                        <td className="px-3 py-2">{complete ? <span className="text-[10px] font-black text-green-600">Completo</span> : <span className="text-[10px] font-black text-amber-600">Incompleto</span>}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => setEditGame(g)}
                            className="px-2.5 py-1 text-[10px] font-black bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-700 rounded-md transition-colors">
                            Editar
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* FILTROS */}
        <div className="flex flex-col gap-2" data-pdf-hide>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 w-16">Mando:</span>
            {[['all','Todos'],['M','Casa'],['V','Fora']].map(([k,l]) => (
              <button key={k} onClick={() => setFilterMando(k)}
                className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-md border transition-all ${filterMando === k ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 w-16">Resultado:</span>
            {[['all','Todos'],['V','Vitórias'],['E','Empates'],['D','Derrotas']].map(([k,l]) => (
              <button key={k} onClick={() => setFilterResult(k)}
                className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-md border transition-all ${filterResult === k ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 w-16">Competição:</span>
            <button onClick={() => setFilterComp('all')}
              className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-md border transition-all ${filterComp === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}>
              Todas
            </button>
            {availableComps.map(c => (
              <button key={c} onClick={() => setFilterComp(c)}
                className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-md border transition-all ${filterComp === c ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                {c}
              </button>
            ))}
            {availableComps.length === 0 && <span className="text-[10px] text-slate-400 font-bold">Preencha a competição dos jogos no editor de contexto.</span>}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 w-16">Recorte:</span>
            {[[0,'Todos'],[5,'Últimos 5'],[10,'Últimos 10']].map(([k,l]) => (
              <button key={k} onClick={() => setFilterLast(k)}
                className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-md border transition-all ${filterLast === k ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {gamesWithResult.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-slate-200 rounded-xl">
            <p className="text-4xl mb-4">📊</p>
            <p className="text-slate-600 font-black uppercase tracking-widest text-sm mb-2">Dados insuficientes</p>
            <p className="text-slate-400 text-xs font-medium max-w-xs">Suba CSVs de jogos com resultado (V/E/D) para começar a análise.</p>
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 font-bold">
            Nenhum jogo no recorte atual. Ajuste os filtros de competição, mando ou resultado.
          </div>
        ) : (
          <>
            {/* RESUMO AUTOMÁTICO */}
            {autoSummary && (
              <div className={`border rounded-xl p-4 ${isProfileMode ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isProfileMode ? 'text-blue-600' : 'text-slate-500'}`}>
                  {isProfileMode ? `Modo Perfil — ${RESULT_CFG[singleResult]?.label || ''}` : 'Resumo Automático'}
                </p>
                <p className="text-sm text-slate-700 leading-relaxed">{autoSummary.intro}</p>
                {!isProfileMode && (
                  <div className="mt-2 text-sm text-slate-700 leading-relaxed space-y-1">
                    {autoSummary.pos.length > 0 && <p><strong className="text-green-700">Vitórias</strong> mais associadas a: {autoSummary.pos.join(', ')}.</p>}
                    {autoSummary.neg.length > 0 && <p><strong className="text-red-700">Derrotas</strong> mais associadas a: {autoSummary.neg.join(', ')}.</p>}
                    {autoSummary.emp.length > 0 && <p><strong className="text-amber-700">Empates</strong> com leitura acima da média em: {autoSummary.emp.join(', ')}.</p>}
                  </div>
                )}
                {autoSummary.interpret && (
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed"><strong className="text-slate-700">Interpretação prática:</strong> {autoSummary.interpret}</p>
                )}
                {autoSummary.alerta && (
                  <p className="mt-2 text-xs text-slate-500 font-medium leading-relaxed"><strong>Alerta:</strong> {autoSummary.alerta}</p>
                )}
              </div>
            )}

            {/* ── MODO CORRELAÇÃO ── */}
            {!isProfileMode && (
              <>
                {filteredGames.length < 4 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 font-bold">
                    São necessários pelo menos 4 jogos para calcular correlações. Ajuste os filtros.
                  </div>
                ) : (
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Análise GPS × Resultado</h2>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                          {filteredGames.length} jogos · Ordenado por Eta (diferença entre V/E/D) · Dominância compara V×D par a par
                        </p>
                      </div>
                      <div className="flex gap-3 text-[9px] font-black uppercase tracking-widest text-slate-400">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-400 inline-block"/>Eta</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"/>Vitória</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>Derrota</span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1000px]">
                        <thead>
                          <tr className="border-b border-slate-100">
                            {['Métrica GPS','Eta','Eta²','Mais presente em','Kendall','Dominância V×D','Força','Hipótese'].map(h => (
                              <th key={h} className="text-left text-[9px] font-black uppercase tracking-widest text-slate-400 px-4 py-3">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {correlations.map(c => (
                            <tr key={c.key} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 text-sm font-black text-slate-800">{c.label}</td>
                              <td className="px-4 py-3"><EtaBadge eta={c.eta} eta2={c.eta2} /></td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-sm font-black text-slate-700">{c.eta2 != null ? (c.eta2 * 100).toFixed(0) + '%' : '—'}</span>
                                  <span className="text-[9px] text-slate-400 font-bold">{eta2Label(c.eta2)}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {c.topGroup ? (
                                  <span className={`text-xs font-black ${RESULT_CFG[c.topGroup]?.text || 'text-slate-600'}`}>
                                    {RESULT_CFG[c.topGroup]?.label || c.topGroup}
                                  </span>
                                ) : <span className="text-slate-300 text-xs">—</span>}
                              </td>
                              <td className="px-4 py-3"><CorrBadge value={c.k} /></td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-0.5">
                                  <DeltaBadge value={c.cd} />
                                  <span className="text-[9px] text-slate-400 font-bold">{deltaLabel(c.cd)}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-xs font-bold text-slate-600">{etaLabel(c.eta)}</td>
                              <td className="px-4 py-3 text-xs text-slate-500 max-w-[220px] leading-relaxed">{getHypothesis(c.key, c.cd ?? c.k ?? 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── MODO PERFIL ── */}
            {isProfileMode && (
              <div className="border border-blue-100 rounded-xl overflow-hidden">
                <div className="bg-blue-50 border-b border-blue-100 px-4 py-3">
                  <h2 className="text-sm font-black uppercase tracking-widest text-blue-800">
                    Perfil Físico — {RESULT_CFG[singleResult]?.label} vs Média Geral
                  </h2>
                  <p className="text-[10px] text-blue-500 font-medium mt-0.5">
                    {filteredGames.length} jogos · Comparação vs {gamesWithResult.length} jogos totais · Ordenado por maior diferença
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {['Métrica','Neste recorte','Média geral','Diferença','Padrão','Interpretação'].map(h => (
                          <th key={h} className="text-left text-[9px] font-black uppercase tracking-widest text-slate-400 px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {profileData.map(p => {
                        const fmt = v => v == null ? '—' : p.dec === 1 ? v.toFixed(1) : Math.round(v)
                        const inv = p.key === 'pl' || p.key === 'accDec'
                        const isAbove = (p.diff || 0) > 3
                        const isBelow = (p.diff || 0) < -3
                        const padrao = isAbove ? 'Acima da média' : isBelow ? 'Abaixo da média' : 'Na média'
                        const padraoColor = isAbove
                          ? (inv ? 'text-orange-600' : 'text-green-600')
                          : isBelow ? (inv ? 'text-green-600' : 'text-red-600') : 'text-slate-400'
                        return (
                          <tr key={p.key} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="px-4 py-3 text-sm font-black text-slate-800">{p.label}</td>
                            <td className="px-4 py-3 text-sm font-black text-slate-800">
                              {fmt(p.filtAvg)}<span className="text-[10px] text-slate-400 font-normal ml-0.5">{p.unit}</span>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-500 font-medium">
                              {fmt(p.gAvg)}<span className="text-[10px] text-slate-400 font-normal ml-0.5">{p.unit}</span>
                            </td>
                            <td className="px-4 py-3"><PctBadge v={p.diff} inv={inv} /></td>
                            <td className="px-4 py-3"><span className={`text-xs font-black ${padraoColor}`}>{padrao}</span></td>
                            <td className="px-4 py-3 text-xs text-slate-500 max-w-[280px] leading-relaxed">{getProfileHypothesis(p.key, p.diff)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* LEITURA POR TIPO DE MÉTRICA */}
            {!isProfileMode && categoryReadings.length > 0 && (
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-100 px-4 py-3">
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Leitura por Tipo de Métrica</h2>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">O que sobe nas vitórias, o que sobe nas derrotas e o que não tem padrão claro</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
                  {categoryReadings.map(cat => (
                    <div key={cat.id} className="border border-slate-100 rounded-lg p-3">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-700">{cat.label}</p>
                      <p className="text-[10px] text-slate-400 font-medium mb-2">{cat.desc}</p>
                      <div className="flex flex-col gap-1 text-xs">
                        <p><span className="font-black text-green-600">Sobe na vitória:</span> <span className="text-slate-600">{cat.sobeV.length ? cat.sobeV.join(', ') : '—'}</span></p>
                        <p><span className="font-black text-red-600">Sobe na derrota:</span> <span className="text-slate-600">{cat.sobeD.length ? cat.sobeD.join(', ') : '—'}</span></p>
                        <p><span className="font-black text-slate-400">Sem padrão claro:</span> <span className="text-slate-500">{cat.neutro.length ? cat.neutro.join(', ') : '—'}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PERGUNTAS RÁPIDAS */}
            {!isProfileMode && quickQA.length > 0 && (
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-100 px-4 py-3">
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Perguntas Rápidas</h2>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">Respostas automáticas para a comissão, conforme os filtros</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
                  {quickQA.map((qa, i) => (
                    <div key={i} className="border border-slate-100 rounded-lg p-3">
                      <p className="text-xs font-black text-slate-800 mb-1">{qa.q}</p>
                      <p className="text-xs text-slate-600 leading-relaxed">{qa.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* GRÁFICOS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="border border-slate-100 rounded-xl p-4">
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-600 mb-1">
                  {isProfileMode ? 'Diferença vs Média Geral (%)' : 'Índice de Dominância V×D'}
                </h2>
                {rankingData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={rankingData} layout="vertical" margin={{ left: 90, right: 20 }}>
                      <XAxis type="number" tickCount={5} tick={{ fontSize: 9, fontWeight: 700 }}
                        tickFormatter={v => isProfileMode ? v.toFixed(0) + '%' : v.toFixed(1)} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} width={88} />
                      <Tooltip formatter={v => [isProfileMode ? v.toFixed(1) + '%' : fmtCorr(v), isProfileMode ? 'Dif. vs média' : 'Dominância']}
                        contentStyle={{ fontSize: 11, fontWeight: 700 }} />
                      <ReferenceLine x={0} stroke="#94a3b8" strokeDasharray="4 2" />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {rankingData.map((d, i) => <Cell key={i} fill={d.value >= 0 ? '#22c55e' : '#ef4444'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-xs text-slate-400 text-center py-8">Dados insuficientes</p>}
              </div>

              <div className="border border-slate-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-black uppercase tracking-widest text-slate-600">Média por Resultado</h2>
                  <select value={selectedMetric} onChange={e => setSelectedMetric(e.target.value)}
                    className="border border-slate-200 rounded-md px-2 py-1 text-xs font-bold focus:outline-none focus:border-amber-400">
                    {METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </div>
                {barData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} />
                      <YAxis tick={{ fontSize: 9, fontWeight: 700 }} tickFormatter={v => selMeta?.dec === 1 ? v.toFixed(1) : Math.round(v)} />
                      <Tooltip formatter={v => [selMeta?.dec === 1 ? v.toFixed(1) : Math.round(v), selMeta?.label]} contentStyle={{ fontSize: 11, fontWeight: 700 }} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {barData.map((d, i) => <Cell key={i} fill={RESULT_CFG[d.result]?.bar || '#94a3b8'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-xs text-slate-400 text-center py-8">Dados insuficientes</p>}
              </div>
            </div>

            {/* LINHA DO TEMPO */}
            <div className="border border-slate-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <h2 className="text-xs font-black uppercase tracking-widest text-slate-600">Linha do Tempo dos Jogos</h2>
                  <p className="text-[10px] text-slate-400 font-medium">Evolução cronológica · cor por resultado</p>
                </div>
                <select value={timelineMetric} onChange={e => setTimelineMetric(e.target.value)}
                  className="border border-slate-200 rounded-md px-2 py-1 text-xs font-bold focus:outline-none focus:border-amber-400">
                  {METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </div>
              {timelineData.length > 1 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={timelineData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fontWeight: 700 }} />
                    <YAxis tick={{ fontSize: 9, fontWeight: 700 }} tickFormatter={v => selTimeline?.dec === 1 ? v.toFixed(1) : Math.round(v)} />
                    <Tooltip content={<TimelineTooltip />} />
                    <Line type="monotone" dataKey="value" stroke="#64748b" strokeWidth={2} dot={<TimelineDot />} activeDot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="text-xs text-slate-400 text-center py-8">Poucos jogos no recorte para montar a linha do tempo.</p>}
              <div className="flex gap-4 mt-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>Vitória</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"/>Empate</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>Derrota</span>
              </div>
            </div>

            {/* JOGOS MAIS INTENSOS */}
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Jogos Mais Intensos</h2>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">Ranking por métrica · 🔥 maior · ❄️ menor · ⚠️ fora da curva</p>
                </div>
                <select value={intensosMetric} onChange={e => setIntensosMetric(e.target.value)}
                  className="border border-slate-200 rounded-md px-2 py-1 text-xs font-bold focus:outline-none focus:border-amber-400">
                  {METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px]">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['#','Data','Adversário','Placar','Resultado','Mando','Competição', selIntensos?.label || 'Valor'].map(h => (
                        <th key={h} className="text-left text-[9px] font-black uppercase tracking-widest text-slate-400 px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {intensosData.map(({ g, val, rank, isMax, isMin, isOutlier }) => {
                      const rc = RESULT_CFG[g.result]
                      const placar = g.score_pro != null && g.score_con != null ? `${g.score_pro}x${g.score_con}` : '—'
                      return (
                        <tr key={g.id} className={`border-b border-slate-50 hover:bg-slate-50 ${isMax ? 'bg-amber-50/40' : ''}`}>
                          <td className="px-4 py-2.5 text-xs font-black text-slate-400">{rank}</td>
                          <td className="px-4 py-2.5 text-xs font-bold text-slate-700 whitespace-nowrap">{dateShort(g)}</td>
                          <td className="px-4 py-2.5 text-xs text-slate-700">{g.opponent}</td>
                          <td className="px-4 py-2.5 text-xs font-bold text-slate-600">{placar}</td>
                          <td className="px-4 py-2.5">{rc ? <span className={`text-xs font-black ${rc.text}`}>{rc.label}</span> : <span className="text-xs text-slate-300">—</span>}</td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">{mandoLabel(g.mando)}</td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">{g.competition || 'Não informado'}</td>
                          <td className="px-4 py-2.5 text-sm font-black text-slate-800">
                            {val != null ? (selIntensos?.dec === 1 ? val.toFixed(1) : Math.round(val)) : '—'}
                            <span className="ml-1">{isMax ? '🔥' : isMin ? '❄️' : ''}{isOutlier && !isMax && !isMin ? '⚠️' : ''}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MÉDIAS POR RESULTADO */}
            {!isProfileMode && (
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-100 px-4 py-3">
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Médias por Resultado</h2>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                    V ({avgByResult.V.length}j) · E ({avgByResult.E.length}j) · D ({avgByResult.D.length}j) · Dif. = Vitória vs Derrota
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left text-[9px] font-black uppercase tracking-widest text-slate-400 px-4 py-3">Métrica</th>
                        {['V','E','D'].map(r => (
                          <th key={r} className={`text-center text-[9px] font-black uppercase tracking-widest px-4 py-3 ${RESULT_CFG[r].text}`}>
                            {RESULT_CFG[r].label}
                          </th>
                        ))}
                        <th className="text-center text-[9px] font-black uppercase tracking-widest text-slate-400 px-4 py-3">Dif. V×D</th>
                        <th className="text-left text-[9px] font-black uppercase tracking-widest text-slate-400 px-4 py-3">Mais associado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {METRICS.map(m => {
                        const vv = meanR('V', m.key), ve = meanR('E', m.key), vd = meanR('D', m.key)
                        const vals = { V: vv, E: ve, D: vd }
                        const validVals = Object.entries(vals).filter(([, v]) => v != null)
                        if (!validVals.length) return null
                        const topResult = validVals.reduce((a, b) => b[1] > a[1] ? b : a)?.[0]
                        const fmt = v => v == null ? '—' : m.dec === 1 ? v.toFixed(1) : Math.round(v)
                        const diff = pctDiff(vv, vd)
                        return (
                          <tr key={m.key} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="px-4 py-2.5 text-sm font-black text-slate-800">{m.label}</td>
                            {['V','E','D'].map(r => (
                              <td key={r} className={`px-4 py-2.5 text-center text-sm font-black ${topResult === r ? 'text-amber-600' : 'text-slate-700'}`}>
                                {fmt(vals[r])}<span className="text-[10px] font-normal text-slate-400 ml-0.5">{m.unit}</span>
                              </td>
                            ))}
                            <td className="px-4 py-2.5 text-center">
                              {diff == null ? <span className="text-slate-300 text-xs">—</span>
                                : <span className={`text-xs font-black ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-slate-400'}`}>{(diff > 0 ? '+' : '') + diff.toFixed(1)}%</span>}
                            </td>
                            <td className="px-4 py-2.5 text-xs font-bold">
                              {topResult ? <span className={RESULT_CFG[topResult].text}>Mais associado à {RESULT_CFG[topResult].label.toLowerCase()}</span> : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CASA x FORA */}
            {hasMando && !isProfileMode && (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[['casa', '🏠 Casa', mandoSplit.casa], ['fora', '✈️ Fora', mandoSplit.fora]].map(([id, title, d]) => (
                    <div key={id} className="border border-slate-100 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">{title}</h3>
                        <span className="text-xs font-black text-slate-500">{d.games} jogo{d.games !== 1 ? 's' : ''}</span>
                      </div>
                      {d.games === 0 ? (
                        <p className="text-xs text-slate-400 font-medium">Nenhum jogo neste mando no recorte atual.</p>
                      ) : (
                        <>
                          <div className="flex gap-4 text-sm mb-2">
                            <span className="text-green-600 font-black">{d.V}V</span>
                            <span className="text-amber-600 font-black">{d.E}E</span>
                            <span className="text-red-600 font-black">{d.D}D</span>
                            <span className="text-slate-700 font-black ml-auto">{d.aprov}% aprov.</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            <span className="font-black text-green-700">Mais associado à vitória:</span> {d.winMetric ? d.winMetric.label : 'amostra insuficiente'}.
                          </p>
                          <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                            <span className="font-black text-red-700">Alerta nas derrotas:</span> {d.alertMetric ? `${d.alertMetric.label} aparece mais` : 'sem alerta evidente'}.
                          </p>
                          {d.games < 3 && <p className="text-[10px] text-amber-600 font-bold mt-1">Amostra por mando reduzida. Leitura apenas exploratória.</p>}
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 leading-relaxed">
                  Em casa, a equipe apresenta maior associação com {mandoSplit.casa.winMetric ? mandoSplit.casa.winMetric.label : 'nenhuma métrica clara'}. Fora de casa, o padrão mais forte aparece em {mandoSplit.fora.winMetric ? mandoSplit.fora.winMetric.label : 'nenhuma métrica clara'}.
                </div>

                {/* Dominância por mando (tabela detalhada) */}
                {filteredGames.length >= 4 && (
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-100 px-4 py-3">
                      <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Dominância por Mando</h2>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                        Índice V×D por Casa e Fora · Casa ({filteredGames.filter(g => g.mando === 'M').length}j) · Fora ({filteredGames.filter(g => g.mando === 'V').length}j)
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[600px]">
                        <thead>
                          <tr className="border-b border-slate-100">
                            {['Métrica','Geral','Casa','Fora','Padrão'].map(h => (
                              <th key={h} className="text-left text-[9px] font-black uppercase tracking-widest text-slate-400 px-4 py-3">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {METRICS.map(m => {
                            const calcDelta = games => {
                              const w = games.filter(g => g.result === 'V').map(g => g[m.key])
                              const l = games.filter(g => g.result === 'D').map(g => g[m.key])
                              return w.length && l.length ? cliffsDelta(w, l) : null
                            }
                            const vg = calcDelta(filteredGames)
                            const vh = calcDelta(filteredGames.filter(g => g.mando === 'M'))
                            const va = calcDelta(filteredGames.filter(g => g.mando === 'V'))
                            let padrao = '—'
                            if (vh != null && va != null) {
                              if (Math.abs(vh) > Math.abs(va) + 0.1) padrao = 'Sinal mais forte em casa'
                              else if (Math.abs(va) > Math.abs(vh) + 0.1) padrao = 'Sinal mais forte fora'
                              else if (Math.sign(vh) !== Math.sign(va) && Math.abs(vh) > 0.1 && Math.abs(va) > 0.1) padrao = 'Padrão invertido por mando'
                              else padrao = 'Padrão similar'
                            }
                            return (
                              <tr key={m.key} className="border-b border-slate-50 hover:bg-slate-50">
                                <td className="px-4 py-2.5 text-sm font-black text-slate-800">{m.label}</td>
                                <td className="px-4 py-2.5"><DeltaBadge value={vg} /></td>
                                <td className="px-4 py-2.5"><DeltaBadge value={vh} /></td>
                                <td className="px-4 py-2.5"><DeltaBadge value={va} /></td>
                                <td className="px-4 py-2.5 text-xs text-slate-500 font-medium">{padrao}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* RESUMO POR COMPETIÇÃO */}
            {!isProfileMode && filterComp === 'all' && competitionBreakdown.length > 1 && (
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-100 px-4 py-3">
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Resumo por Competição</h2>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">Campanha e métrica mais associada à vitória em cada competição</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {['Competição','Jogos','V','E','D','Aprov.','Métrica + vitória'].map(h => (
                          <th key={h} className="text-left text-[9px] font-black uppercase tracking-widest text-slate-400 px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {competitionBreakdown.map(c => (
                        <tr key={c.comp} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-4 py-2.5 text-sm font-black text-slate-800">{c.comp}</td>
                          <td className="px-4 py-2.5 text-sm font-bold text-slate-600">{c.games}</td>
                          <td className="px-4 py-2.5 text-sm font-black text-green-600">{c.V}</td>
                          <td className="px-4 py-2.5 text-sm font-black text-amber-600">{c.E}</td>
                          <td className="px-4 py-2.5 text-sm font-black text-red-600">{c.D}</td>
                          <td className="px-4 py-2.5 text-sm font-bold text-slate-700">{c.aprov}%</td>
                          <td className="px-4 py-2.5 text-xs text-slate-600">{c.winMetric ? c.winMetric.label : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* INSIGHTS */}
            <div className="border border-slate-100 rounded-xl p-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-3">Insights</h2>
              <div className="flex flex-col gap-3">
                {isProfileMode ? (
                  profileData.map(p => {
                    const inv = p.key === 'pl' || p.key === 'accDec'
                    const isAbove = (p.diff || 0) > 3
                    const isBelow = (p.diff || 0) < -3
                    const isGood = isAbove ? !inv : (isBelow ? inv : null)
                    const border = isGood === true ? 'bg-green-50 border-green-200' : isGood === false ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
                    const barColor = isGood === true ? 'bg-green-400' : isGood === false ? 'bg-red-400' : 'bg-slate-300'
                    const label = isAbove ? `${p.diff?.toFixed(1)}% acima da média` : isBelow ? `${p.diff?.toFixed(1)}% abaixo da média` : 'Dentro da média'
                    return (
                      <div key={p.key} className={`flex gap-3 p-3 rounded-lg border ${border}`}>
                        <div className={`w-1 rounded-full flex-shrink-0 ${barColor}`} />
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">{p.label} · {label}</p>
                          <p className="text-xs text-slate-600 leading-relaxed">{getProfileHypothesis(p.key, p.diff)}</p>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  correlations.map(c => {
                    const val = c.cd ?? c.k ?? 0
                    const assoc = assocResult(c.cd)
                    const ev = evidenciaLabel(c.eta, c.cd)
                    const pos = assoc === 'V'
                    const neg = assoc === 'D'
                    const border = pos ? 'bg-green-50 border-green-200' : neg ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
                    const barColor = pos ? 'bg-green-400' : neg ? 'bg-red-400' : 'bg-slate-300'
                    const assocTxt = pos ? 'Associado à vitória' : neg ? 'Associado à derrota' : 'Sem padrão claro'
                    const alerta = neg && (c.key === 'vmax90' || c.key === 'pl' || c.key === 'sprint')
                      ? 'Atenção: métrica alta na derrota não significa melhor desempenho físico. Pode indicar exposição defensiva ou desgaste.'
                      : ev === 'Muito fraca' || ev === 'Fraca'
                        ? 'Evidência ainda frágil para esta amostra. Trate como tendência exploratória.'
                        : 'Leia em conjunto com adversário, mando, placar e modelo de jogo.'
                    return (
                      <div key={c.key} className={`flex gap-3 p-3 rounded-lg border ${border}`}>
                        <div className={`w-1 rounded-full flex-shrink-0 ${barColor}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${evidenciaColor(ev)}`}>{ev}</span>
                            <p className={`text-[10px] font-black uppercase tracking-widest ${pos ? 'text-green-700' : neg ? 'text-red-700' : 'text-slate-500'}`}>
                              {c.label} · {assocTxt} · Dominância {fmtCorr(c.cd)}{c.eta != null ? ` · η${c.eta.toFixed(2)}` : ''}
                            </p>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{getHypothesis(c.key, val)}</p>
                          <p className="text-[10px] text-slate-400 font-medium mt-1">{alerta}</p>
                        </div>
                      </div>
                    )
                  })
                )}
                <p className="text-[10px] text-slate-400 font-bold mt-1">
                  * Correlação não implica causalidade. Analise sempre em conjunto com: mando, adversário, modelo de jogo e placar.
                </p>
              </div>
            </div>

            {/* METODOLOGIA */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-600 mb-2">Metodologia</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                A leitura combina métodos complementares, em linguagem simples: o <strong className="text-slate-700">Eta (η)</strong> mede o quanto as métricas GPS diferem entre vitória, empate e derrota. O <strong className="text-slate-700">Eta² (η²)</strong> mostra qual percentual da variação da métrica está associado ao tipo de resultado. <strong className="text-slate-700">Kendall Tau-b</strong> e <strong className="text-slate-700">Spearman</strong> analisam a tendência ordinal entre a métrica e a pontuação (V=3, E=1, D=0). A <strong className="text-slate-700">Dominância V×D</strong> compara vitória contra derrota par a par: valor positivo indica tendência maior nas vitórias, valor negativo indica tendência maior nas derrotas, e valor próximo de zero indica ausência de padrão claro. Quando o filtro retorna apenas um tipo de resultado, a página entra em Modo Perfil e compara o recorte contra a média geral. Nenhum método prova causalidade.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div className="bg-white border border-slate-100 rounded-lg p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Dominância V×D</p>
                  <p className="text-xs text-slate-600">+ positivo = mais associado à vitória<br/>– negativo = mais associado à derrota<br/>0 = sem padrão claro</p>
                </div>
                <div className="bg-white border border-slate-100 rounded-lg p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Eta²</p>
                  <p className="text-xs text-slate-600">0% a 5% = baixa diferença<br/>6% a 14% = diferença moderada<br/>15% ou mais = diferença relevante</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {editGame && (
        <EditContextModal
          game={editGame}
          onClose={() => setEditGame(null)}
          onSave={handleMetaSave}
        />
      )}
    </div>
  )
}
