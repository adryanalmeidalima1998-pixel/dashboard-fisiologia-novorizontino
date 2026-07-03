'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

const STORAGE_KEY = 'rtp_decisao_clinica_v1'

const initialState = {
  atleta: 'ARTHUR BARBOSA',
  lesao: 'Anterior de coxa',
  fase: 'Fase 2',
  diaRtp: 18,
  data: new Date().toISOString().slice(0, 10),
  sessao: 'Sessão 6',
  criterios: {
    dor: 1,
    rigidez: 0,
    confianca: 9,
    resposta24h: 'Sem reação',
    forca: 92,
    assimetria: 6,
    amplitude: 100,
    salto: 96,
    dorPosChute: 0,
    qualidadeMovimento: 'Boa',
    toleranciaChute: 'Sem dor',
    toleranciaSprint: 'Não aplicado',
    toleranciaCod: 'Sem dor',
    edema: false,
    dorPalpacao: false,
    limitacaoAdm: false,
  },
  planejado: {
    distancia: 3700,
    vmax: 19,
    hsr: 0,
    sprint: 0,
    acc3: 12,
    dcc3: 15,
    chutes: 8,
  },
  realizado: {
    distancia: 3645,
    vmax: 18.8,
    hsr: 0,
    sprint: 0,
    acc3: 11,
    dcc3: 14,
    chutes: 8,
  },
  proximaMeta: {
    distancia: 3900,
    vmax: 19,
    hsr: 0,
    sprint: 0,
    acc3: 14,
    dcc3: 16,
    objetivo: 'Consolidar volume, manter controle de velocidade e evoluir carga mecânica sem ultrapassar o limite definido pela comissão.',
  },
  justificativa: 'Atleta apresentou boa resposta clínica, sem dor relevante, boa confiança e cumprimento adequado da carga planejada.',
  assinaturas: {
    fisiologista: '',
    preparador: '',
    fisioterapeuta: '',
    medico: '',
  },
}

function toNumber(value) {
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function scoreDor(dor) {
  if (dor <= 2) return 100
  if (dor <= 4) return 65
  return 25
}

function scoreRigidez(rigidez) {
  if (rigidez <= 2) return 100
  if (rigidez <= 5) return 65
  return 25
}

function scoreConfianca(confianca) {
  if (confianca >= 8) return 100
  if (confianca >= 6) return 65
  return 25
}

function scoreForca(forca) {
  if (forca >= 90) return 100
  if (forca >= 85) return 70
  return 35
}

function scoreAssimetria(assimetria) {
  if (assimetria < 10) return 100
  if (assimetria <= 15) return 70
  return 35
}

function scoreResposta(resposta24h) {
  if (resposta24h === 'Sem reação') return 100
  if (resposta24h === 'Rigidez leve') return 70
  if (resposta24h === 'Dor leve') return 55
  return 25
}

function scoreGesto(criterios) {
  let score = 100
  if (criterios.dorPosChute > 2) score -= 35
  if (criterios.qualidadeMovimento === 'Regular') score -= 20
  if (criterios.qualidadeMovimento === 'Ruim') score -= 45
  if (criterios.toleranciaChute === 'Desconforto') score -= 15
  if (criterios.toleranciaChute === 'Dor') score -= 40
  if (criterios.toleranciaCod === 'Desconforto') score -= 15
  if (criterios.toleranciaCod === 'Dor') score -= 40
  if (criterios.toleranciaSprint === 'Desconforto') score -= 15
  if (criterios.toleranciaSprint === 'Dor') score -= 40
  return clamp(score)
}

function cumprimento(realizado, planejado) {
  const keys = ['distancia', 'vmax', 'hsr', 'sprint', 'acc3', 'dcc3', 'chutes']
  const scores = keys.map((key) => {
    const p = toNumber(planejado[key])
    const r = toNumber(realizado[key])
    if (!p && !r) return 100
    if (!p && r > 0) return 50
    const ratio = (r / p) * 100
    const erro = Math.abs(100 - ratio)
    return clamp(100 - erro)
  })
  return Math.round(scores.reduce((sum, item) => sum + item, 0) / scores.length)
}

function statusColor(score) {
  if (score >= 80) return 'text-emerald-400 border-emerald-500 bg-emerald-500/10'
  if (score >= 60) return 'text-yellow-300 border-yellow-400 bg-yellow-400/10'
  return 'text-red-400 border-red-500 bg-red-500/10'
}

function decisionLabel(readiness, criterios) {
  if (criterios.dor > 4 || criterios.rigidez > 5 || criterios.forca < 85 || criterios.assimetria > 15 || readiness < 60) {
    return { label: 'REGREDIR', color: 'text-red-400 border-red-500 bg-red-500/10' }
  }
  if (readiness >= 80 && criterios.dor <= 2 && criterios.rigidez <= 2 && criterios.confianca >= 8 && criterios.forca >= 90 && criterios.assimetria < 10) {
    return { label: 'PROGREDIR', color: 'text-emerald-400 border-emerald-500 bg-emerald-500/10' }
  }
  return { label: 'MANTER', color: 'text-yellow-300 border-yellow-400 bg-yellow-400/10' }
}

function Field({ label, value, onChange, type = 'text', min, max, step = '1' }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-yellow-400">{label}</span>
      <input
        type={type}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-yellow-500/60 bg-black px-3 py-2 text-sm font-bold text-white outline-none focus:border-yellow-300 print:border-zinc-600"
      />
    </label>
  )
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-yellow-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-yellow-500/60 bg-black px-3 py-2 text-sm font-bold text-white outline-none focus:border-yellow-300"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

function Panel({ title, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-yellow-500/80 bg-black/70 p-4 shadow-[0_0_18px_rgba(234,179,8,0.12)] ${className}`}>
      <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-yellow-400">{title}</h2>
      {children}
    </section>
  )
}

function ScoreCard({ label, value, suffix = '%', colorClass }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${colorClass || statusColor(value)}`}>
      <p className="text-[10px] font-black uppercase tracking-wider text-zinc-300">{label}</p>
      <p className="mt-1 text-3xl font-black">{value}{suffix}</p>
    </div>
  )
}

function CheckLine({ label, ok }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-800 py-2 text-sm">
      <span>{label}</span>
      <span className={ok ? 'text-emerald-400' : 'text-red-400'}>{ok ? '●' : '●'}</span>
    </div>
  )
}

function NumberGrid({ title, data, setData }) {
  const items = [
    ['distancia', 'DT'], ['vmax', 'Vmax'], ['hsr', 'HSR'], ['sprint', 'Sprint'], ['acc3', 'ACC >3'], ['dcc3', 'DCC >3'], ['chutes', 'Chutes'],
  ]
  return (
    <div>
      <p className="mb-2 text-xs font-black uppercase text-zinc-300">{title}</p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {items.map(([key, label]) => (
          <Field
            key={key}
            label={label}
            type="number"
            step="0.1"
            value={data[key]}
            onChange={(value) => setData((prev) => ({ ...prev, [key]: value }))}
          />
        ))}
      </div>
    </div>
  )
}

export default function DecisaoClinicaRTP() {
  const [form, setForm] = useState(initialState)
  const printRef = useRef(null)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved) setForm(JSON.parse(saved))
    } catch (error) {
      console.error('Erro ao carregar decisão clínica RTP:', error)
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(form))
    } catch (error) {
      console.error('Erro ao salvar decisão clínica RTP:', error)
    }
  }, [form])

  const c = form.criterios
  const gpsScore = useMemo(() => cumprimento(form.realizado, form.planejado), [form.realizado, form.planejado])
  const readiness = useMemo(() => {
    const total =
      scoreDor(toNumber(c.dor)) * 0.15 +
      scoreRigidez(toNumber(c.rigidez)) * 0.10 +
      scoreConfianca(toNumber(c.confianca)) * 0.10 +
      scoreForca(toNumber(c.forca)) * 0.20 +
      scoreAssimetria(toNumber(c.assimetria)) * 0.15 +
      gpsScore * 0.15 +
      scoreResposta(c.resposta24h) * 0.10 +
      scoreGesto(c) * 0.05
    return Math.round(total)
  }, [c, gpsScore])

  const decision = decisionLabel(readiness, c)

  const updateRoot = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))
  const updateCriteria = (key, value) => setForm((prev) => ({ ...prev, criterios: { ...prev.criterios, [key]: value } }))
  const updateNext = (key, value) => setForm((prev) => ({ ...prev, proximaMeta: { ...prev.proximaMeta, [key]: value } }))
  const updateSign = (key, value) => setForm((prev) => ({ ...prev, assinaturas: { ...prev.assinaturas, [key]: value } }))

  function resetForm() {
    if (confirm('Deseja limpar a aba e voltar ao modelo inicial?')) setForm(initialState)
  }

  function exportPdf() {
    window.print()
  }

  return (
    <main className="min-h-screen bg-[#050505] p-4 text-white print:bg-white print:p-0">
      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-page { width: 297mm; min-height: 210mm; margin: 0; padding: 8mm; background: #050505 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-avoid { break-inside: avoid; }
          input, select, textarea { border: none !important; background: transparent !important; color: white !important; padding-left: 0 !important; }
        }
      `}</style>

      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-yellow-500/70 bg-black p-3">
        <div>
          <h1 className="text-xl font-black uppercase text-yellow-400">Aba Decisão Clínica RTP</h1>
          <p className="text-sm text-zinc-400">Editável, salva no navegador e gera PDF para comissão técnica.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={resetForm} className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-bold text-zinc-200 hover:bg-zinc-900">Limpar modelo</button>
          <button onClick={exportPdf} className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-black uppercase text-black hover:bg-yellow-300">Gerar PDF</button>
        </div>
      </div>

      <div ref={printRef} className="print-page mx-auto max-w-[1500px] rounded-2xl border border-yellow-500 bg-black p-5 shadow-[0_0_30px_rgba(234,179,8,0.18)]">
        <header className="mb-4 grid grid-cols-12 gap-3 border-b border-yellow-500/70 pb-4">
          <div className="col-span-12 flex items-center gap-4 lg:col-span-5">
            <img src="/club/escudonovorizontino.png" alt="Escudo Novorizontino" className="h-20 w-20 object-contain" />
            <div>
              <h1 className="text-3xl font-black uppercase leading-tight text-yellow-400">Decisão Clínica RTP</h1>
              <p className="text-sm font-bold uppercase tracking-wider text-zinc-300">Retorno de lesão · Departamento de Performance</p>
            </div>
          </div>
          <div className="col-span-12 grid grid-cols-2 gap-2 lg:col-span-7 lg:grid-cols-4">
            <Field label="Atleta" value={form.atleta} onChange={(v) => updateRoot('atleta', v)} />
            <Field label="Lesão" value={form.lesao} onChange={(v) => updateRoot('lesao', v)} />
            <Field label="Fase" value={form.fase} onChange={(v) => updateRoot('fase', v)} />
            <Field label="Dia RTP" type="number" value={form.diaRtp} onChange={(v) => updateRoot('diaRtp', v)} />
            <Field label="Data" type="date" value={form.data} onChange={(v) => updateRoot('data', v)} />
            <Field label="Sessão" value={form.sessao} onChange={(v) => updateRoot('sessao', v)} />
            <ScoreCard label="Readiness" value={readiness} />
            <div className={`rounded-xl border p-3 text-center ${decision.color}`}>
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-300">Decisão</p>
              <p className="mt-2 text-2xl font-black">{decision.label}</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-3">
          <Panel title="1. Status Clínico" className="col-span-12 lg:col-span-4 print-avoid">
            <div className="grid grid-cols-3 gap-2">
              <Field label="Dor 0-10" type="number" min="0" max="10" value={c.dor} onChange={(v) => updateCriteria('dor', toNumber(v))} />
              <Field label="Rigidez 0-10" type="number" min="0" max="10" value={c.rigidez} onChange={(v) => updateCriteria('rigidez', toNumber(v))} />
              <Field label="Confiança 0-10" type="number" min="0" max="10" value={c.confianca} onChange={(v) => updateCriteria('confianca', toNumber(v))} />
            </div>
            <div className="mt-3">
              <SelectField label="Resposta 24h" value={c.resposta24h} onChange={(v) => updateCriteria('resposta24h', v)} options={['Sem reação', 'Rigidez leve', 'Dor leve', 'Piora']} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <ScoreCard label="Dor" value={scoreDor(toNumber(c.dor))} />
              <ScoreCard label="Rigidez" value={scoreRigidez(toNumber(c.rigidez))} />
              <ScoreCard label="Confiança" value={scoreConfianca(toNumber(c.confianca))} />
            </div>
          </Panel>

          <Panel title="2. Avaliação Funcional" className="col-span-12 lg:col-span-4 print-avoid">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Força %" type="number" value={c.forca} onChange={(v) => updateCriteria('forca', toNumber(v))} />
              <Field label="Assimetria %" type="number" value={c.assimetria} onChange={(v) => updateCriteria('assimetria', toNumber(v))} />
              <Field label="Amplitude %" type="number" value={c.amplitude} onChange={(v) => updateCriteria('amplitude', toNumber(v))} />
              <Field label="Salto %" type="number" value={c.salto} onChange={(v) => updateCriteria('salto', toNumber(v))} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <ScoreCard label="Força" value={scoreForca(toNumber(c.forca))} />
              <ScoreCard label="Assimetria" value={scoreAssimetria(toNumber(c.assimetria))} />
            </div>
          </Panel>

          <Panel title="3. Gesto Específico" className="col-span-12 lg:col-span-4 print-avoid">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Dor pós-chute" type="number" min="0" max="10" value={c.dorPosChute} onChange={(v) => updateCriteria('dorPosChute', toNumber(v))} />
              <SelectField label="Movimento" value={c.qualidadeMovimento} onChange={(v) => updateCriteria('qualidadeMovimento', v)} options={['Boa', 'Regular', 'Ruim']} />
              <SelectField label="Chute" value={c.toleranciaChute} onChange={(v) => updateCriteria('toleranciaChute', v)} options={['Sem dor', 'Desconforto', 'Dor', 'Não aplicado']} />
              <SelectField label="Sprint" value={c.toleranciaSprint} onChange={(v) => updateCriteria('toleranciaSprint', v)} options={['Sem dor', 'Desconforto', 'Dor', 'Não aplicado']} />
              <SelectField label="COD" value={c.toleranciaCod} onChange={(v) => updateCriteria('toleranciaCod', v)} options={['Sem dor', 'Desconforto', 'Dor', 'Não aplicado']} />
              <ScoreCard label="Gesto" value={scoreGesto(c)} />
            </div>
          </Panel>

          <Panel title="4. Carga da Sessão — Planejado x Realizado" className="col-span-12 lg:col-span-8 print-avoid">
            <div className="space-y-4">
              <NumberGrid title="Planejado" data={form.planejado} setData={(fn) => setForm((prev) => ({ ...prev, planejado: typeof fn === 'function' ? fn(prev.planejado) : fn }))} />
              <NumberGrid title="Realizado" data={form.realizado} setData={(fn) => setForm((prev) => ({ ...prev, realizado: typeof fn === 'function' ? fn(prev.realizado) : fn }))} />
            </div>
          </Panel>

          <Panel title="5. Cumprimento da Sessão" className="col-span-12 lg:col-span-4 print-avoid">
            <div className="grid grid-cols-2 gap-2">
              <ScoreCard label="GPS" value={gpsScore} />
              <ScoreCard label="Clínico" value={Math.round((scoreDor(c.dor) + scoreRigidez(c.rigidez) + scoreResposta(c.resposta24h)) / 3)} />
              <ScoreCard label="Funcional" value={Math.round((scoreForca(c.forca) + scoreAssimetria(c.assimetria)) / 2)} />
              <ScoreCard label="Readiness" value={readiness} />
            </div>
            <div className={`mt-3 rounded-xl border p-4 text-center ${decision.color}`}>
              <p className="text-xs font-black uppercase tracking-wider">Decisão automática</p>
              <p className="text-4xl font-black">{decision.label}</p>
            </div>
          </Panel>

          <Panel title="6. Checklist Médico" className="col-span-12 lg:col-span-3 print-avoid">
            <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={!c.edema} onChange={(e) => updateCriteria('edema', !e.target.checked)} /> Sem edema</label>
            <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={!c.dorPalpacao} onChange={(e) => updateCriteria('dorPalpacao', !e.target.checked)} /> Sem dor à palpação</label>
            <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={!c.limitacaoAdm} onChange={(e) => updateCriteria('limitacaoAdm', !e.target.checked)} /> Sem limitação ADM</label>
            <CheckLine label="Dor ≤ 2/10" ok={c.dor <= 2} />
            <CheckLine label="Rigidez ≤ 2/10" ok={c.rigidez <= 2} />
          </Panel>

          <Panel title="7. Checklist Performance" className="col-span-12 lg:col-span-3 print-avoid">
            <CheckLine label="Força ≥ 90%" ok={c.forca >= 90} />
            <CheckLine label="Assimetria < 10%" ok={c.assimetria < 10} />
            <CheckLine label="Confiança ≥ 8/10" ok={c.confianca >= 8} />
            <CheckLine label="Carga cumprida ≥ 80%" ok={gpsScore >= 80} />
            <CheckLine label="Gesto específico seguro" ok={scoreGesto(c) >= 80} />
          </Panel>

          <Panel title="8. Próxima Meta" className="col-span-12 lg:col-span-6 print-avoid">
            <div className="grid grid-cols-3 gap-2">
              <Field label="DT" type="number" value={form.proximaMeta.distancia} onChange={(v) => updateNext('distancia', toNumber(v))} />
              <Field label="Vmax" type="number" step="0.1" value={form.proximaMeta.vmax} onChange={(v) => updateNext('vmax', toNumber(v))} />
              <Field label="HSR" type="number" value={form.proximaMeta.hsr} onChange={(v) => updateNext('hsr', toNumber(v))} />
              <Field label="Sprint" type="number" value={form.proximaMeta.sprint} onChange={(v) => updateNext('sprint', toNumber(v))} />
              <Field label="ACC >3" type="number" value={form.proximaMeta.acc3} onChange={(v) => updateNext('acc3', toNumber(v))} />
              <Field label="DCC >3" type="number" value={form.proximaMeta.dcc3} onChange={(v) => updateNext('dcc3', toNumber(v))} />
            </div>
            <label className="mt-3 block">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-yellow-400">Objetivo da próxima sessão</span>
              <textarea value={form.proximaMeta.objetivo} onChange={(e) => updateNext('objetivo', e.target.value)} rows={3} className="w-full rounded-lg border border-yellow-500/60 bg-black p-3 text-sm font-bold text-white outline-none" />
            </label>
          </Panel>

          <Panel title="9. Justificativa para Comissão Técnica" className="col-span-12 lg:col-span-8 print-avoid">
            <textarea value={form.justificativa} onChange={(e) => updateRoot('justificativa', e.target.value)} rows={5} className="w-full rounded-lg border border-yellow-500/60 bg-black p-3 text-sm font-bold text-white outline-none" />
          </Panel>

          <Panel title="10. Assinaturas" className="col-span-12 lg:col-span-4 print-avoid">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Fisiologista" value={form.assinaturas.fisiologista} onChange={(v) => updateSign('fisiologista', v)} />
              <Field label="Preparador RTP" value={form.assinaturas.preparador} onChange={(v) => updateSign('preparador', v)} />
              <Field label="Fisioterapeuta" value={form.assinaturas.fisioterapeuta} onChange={(v) => updateSign('fisioterapeuta', v)} />
              <Field label="Médico" value={form.assinaturas.medico} onChange={(v) => updateSign('medico', v)} />
            </div>
          </Panel>
        </div>

        <footer className="mt-4 border-t border-yellow-500/70 pt-3 text-center text-[10px] font-black uppercase tracking-widest text-zinc-400">
          Decisão clínica RTP · Verde = progredir · Amarelo = manter · Vermelho = regredir · Documento gerado para discussão multidisciplinar
        </footer>
      </div>
    </main>
  )
}
