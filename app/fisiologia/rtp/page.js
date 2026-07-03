'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

const STORAGE_KEY = 'novorizontino_rtp_module_v2'
const LEGACY_KEY = 'novorizontino_rtp_module_v1'

const emptyAthlete = {
  id: '', nome: '', categoria: 'Profissional', posicao: '', dominancia: '', lesao: 'Anterior de coxa', musculo: '', grau: '',
  dataLesao: '', inicioRtp: '', fase: 'Fase 2', medico: '', fisioterapeuta: '', preparador: '', status: 'Em RTP'
}

const emptyWorst = { dt: 0, hsr: 0, sprint: 0, sprints: 0, vmax: 0, acc3: 0, dcc3: 0, codAlto: 0, playerLoad: 0 }
const emptySession = {
  id:'', atletaId:'', data:'', sessao:'', fase:'Fase 2', tipo:'Campo + força', objetivo:'', tempo:0,
  planejado:{ dt:0, hsr:0, sprint:0, sprints:0, vmax:0, acc3:0, dcc3:0, codAlto:0, playerLoad:0 },
  realizado:{ dt:0, hsr:0, sprint:0, sprints:0, vmax:0, acc3:0, dcc3:0, codAlto:0, playerLoad:0 },
  clinico:{ dor:0, rigidez:0, confianca:8, dorChute:0, forca:90, assimetria:8, resposta24h:'Sem reação', qualidadeMovimento:'Boa', toleranciaGesto:'Sem dor' },
  campo:'', forcaDesc:'', observacoes:'', anexos:[]
}

function uid(){ return `${Date.now()}-${Math.random().toString(16).slice(2)}` }
function num(v){ return Number(v || 0) }
function clamp(v,min=0,max=100){ return Math.max(min, Math.min(max, v)) }
function pct(v,r){ return r ? Math.round((num(v)/num(r))*100) : 0 }
function money(v){ return new Intl.NumberFormat('pt-BR').format(num(v)) }
function statusColor(kind){ return kind === 'green' ? 'bg-emerald-500 text-white' : kind === 'yellow' ? 'bg-amber-400 text-black' : 'bg-red-500 text-white' }
function barColor(p){ return p <= 60 ? 'bg-emerald-500' : p <= 85 ? 'bg-amber-400' : 'bg-red-500' }
function metricKeys(){ return ['dt','hsr','sprint','sprints','vmax','acc3','dcc3','codAlto','playerLoad'] }
function metricLabel(k){ return ({dt:'DT', hsr:'HSR', sprint:'Sprint', sprints:'Sprints', vmax:'Vmáx', acc3:'ACC>3', dcc3:'DCC>3', codAlto:'COD alto', playerLoad:'Player Load'})[k] || k }

function migrateLegacy(v1){
  if(!v1) return { athletes: [], worst: {}, sessions: [] }
  return {
    athletes: v1.athletes || [],
    worst: v1.worst || {},
    sessions: (v1.sessions || []).map(s => ({
      ...emptySession,
      id: s.id || uid(), atletaId: s.atletaId || '', data: s.data || '', sessao: s.sessao || '', fase: s.fase || 'Fase 2', objetivo: s.objetivo || '', tempo: s.tempo || 0,
      realizado: { dt:s.dt||0, hsr:s.hsr||0, sprint:s.sprint||0, sprints:s.sprints||0, vmax:s.vmax||0, acc3:s.acc3||0, dcc3:s.dcc3||0, codAlto:s.codAlto||0, playerLoad:s.playerLoad||0 },
      planejado: { dt:0, hsr:0, sprint:0, sprints:0, vmax:0, acc3:0, dcc3:0, codAlto:0, playerLoad:0 },
      clinico: { dor:s.dor||0, rigidez:s.rigidez||0, confianca:s.confianca||8, dorChute:s.dorChute||0, forca:s.forca||90, assimetria:s.assimetria||8, resposta24h:s.resposta24h||'Sem reação', qualidadeMovimento:'Boa', toleranciaGesto:'Sem dor' },
      campo:s.campo||'', forcaDesc:s.forcaDesc||'', observacoes:s.observacoes||'', anexos:s.anexos||[]
    }))
  }
}

function clinicalStatus(c){
  if(num(c.dor)>4 || num(c.rigidez)>5 || num(c.dorChute)>2 || num(c.forca)<85 || num(c.assimetria)>15 || num(c.confianca)<6 || c.resposta24h === 'Piora') return 'red'
  if(num(c.dor)>2 || num(c.rigidez)>2 || num(c.dorChute)>0 || num(c.forca)<90 || num(c.assimetria)>10 || num(c.confianca)<8 || c.resposta24h === 'Rigidez leve' || c.resposta24h === 'Dor leve') return 'yellow'
  return 'green'
}
function readiness(c){
  const dor = clamp(100 - num(c.dor)*15)
  const rig = clamp(100 - num(c.rigidez)*12)
  const conf = clamp(num(c.confianca)*10)
  const chute = clamp(100 - num(c.dorChute)*20)
  const forca = clamp(num(c.forca))
  const assim = clamp(100 - num(c.assimetria)*5)
  const resp = c.resposta24h === 'Sem reação' ? 100 : c.resposta24h === 'Rigidez leve' ? 75 : c.resposta24h === 'Dor leve' ? 55 : 25
  return Math.round(dor*.15 + rig*.10 + conf*.10 + chute*.10 + forca*.25 + assim*.15 + resp*.15)
}
function decision(score, st){
  if(st === 'red' || score < 60) return { label:'REGREDIR', color:'red' }
  if(st === 'yellow' || score < 80) return { label:'MANTER', color:'yellow' }
  return { label:'PROGREDIR', color:'green' }
}
function compliance(planned, done){
  const keys = metricKeys().filter(k => num(planned[k]) > 0)
  if(!keys.length) return 0
  const scores = keys.map(k => clamp(100 - Math.abs(num(done[k]) - num(planned[k])) / num(planned[k]) * 100, 0, 100))
  return Math.round(scores.reduce((a,b)=>a+b,0) / scores.length)
}
function parseNumber(v){ return Number(String(v ?? '').replace('.', '').replace(',', '.')) || 0 }
function normalizeHeader(h){ return String(h || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'') }
function mapCsvRow(row){
  const mapped = {}
  Object.keys(row).forEach(k => { mapped[normalizeHeader(k)] = row[k] })
  return {
    data: mapped.data || mapped.date || '',
    sessao: mapped.sessao || mapped.session || '',
    realizado: {
      dt: parseNumber(mapped.dt || mapped.distanciatotal || mapped.totaldistance || mapped.distance),
      hsr: parseNumber(mapped.hsr || mapped.dist2025 || mapped.highspeedrunning),
      sprint: parseNumber(mapped.sprint || mapped.dist25 || mapped.sprintdistance),
      sprints: parseNumber(mapped.sprints || mapped.numerosprints),
      vmax: parseNumber(mapped.vmax || mapped.velocidademaxima || mapped.maxspeed),
      acc3: parseNumber(mapped.acc3 || mapped.acc || mapped.aceleracoes3),
      dcc3: parseNumber(mapped.dcc3 || mapped.dcc || mapped.desaceleracoes3),
      codAlto: parseNumber(mapped.codalto || mapped.cod),
      playerLoad: parseNumber(mapped.playerload || mapped.load)
    }
  }
}

export default function RTPModuleV2(){
  const [tab,setTab] = useState('dashboard')
  const [data,setData] = useState({ athletes: [], worst: {}, sessions: [] })
  const [selectedId,setSelectedId] = useState('')
  const [athlete,setAthlete] = useState(emptyAthlete)
  const [session,setSession] = useState(emptySession)
  const [filters,setFilters] = useState({ fase:'Todas', texto:'', inicio:'', fim:'' })
  const [plannerPct,setPlannerPct] = useState(60)
  const reportRef = useRef(null)

  useEffect(()=>{
    const saved = localStorage.getItem(STORAGE_KEY)
    const legacy = localStorage.getItem(LEGACY_KEY)
    const parsed = saved ? JSON.parse(saved) : migrateLegacy(legacy ? JSON.parse(legacy) : null)
    setData(parsed)
    setSelectedId(parsed.athletes?.[0]?.id || '')
  },[])
  useEffect(()=>{ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) },[data])

  const selected = data.athletes.find(a=>a.id===selectedId) || null
  const worst = data.worst[selectedId] || emptyWorst
  const allSessions = data.sessions.filter(s=>s.atletaId===selectedId).sort((a,b)=>String(a.data).localeCompare(String(b.data)))
  const filteredSessions = allSessions.filter(s => {
    const byFase = filters.fase === 'Todas' || s.fase === filters.fase
    const byText = !filters.texto || `${s.sessao} ${s.objetivo} ${s.campo} ${s.observacoes}`.toLowerCase().includes(filters.texto.toLowerCase())
    const byStart = !filters.inicio || String(s.data) >= filters.inicio
    const byEnd = !filters.fim || String(s.data) <= filters.fim
    return byFase && byText && byStart && byEnd
  })
  const last = allSessions[allSessions.length-1] || emptySession
  const week = allSessions.reduce((acc,s)=>{ metricKeys().forEach(k => acc[k] = num(acc[k]) + num(s.realizado?.[k])); return acc }, {...emptyWorst})
  const score = readiness(last.clinico || emptySession.clinico)
  const st = clinicalStatus(last.clinico || emptySession.clinico)
  const dec = decision(score, st)
  const planner = useMemo(()=>[60,70,80,90].map(p=>({ p, dt:Math.round(worst.dt*p/100), hsr:Math.round(worst.hsr*p/100), sprint:Math.round(worst.sprint*p/100), sprints:Math.round(worst.sprints*p/100), vmax:((worst.vmax*p/100)||0).toFixed(1), acc3:Math.round(worst.acc3*p/100), dcc3:Math.round(worst.dcc3*p/100), codAlto:Math.round(worst.codAlto*p/100), playerLoad:Math.round(worst.playerLoad*p/100) })),[worst])
  const nextPlan = useMemo(()=>{ const p=plannerPct; const plan={}; metricKeys().forEach(k => plan[k] = k === 'vmax' ? Number((worst[k]*p/100).toFixed(1)) : Math.round(worst[k]*p/100)); return plan },[plannerPct,worst])

  function saveAthlete(){
    if(!athlete.nome) return alert('Digite o nome do atleta')
    const a = { ...athlete, id: athlete.id || uid() }
    setData(d=>({ ...d, athletes: athlete.id ? d.athletes.map(x=>x.id===athlete.id?a:x) : [...d.athletes,a], worst: d.worst[a.id] ? d.worst : { ...d.worst, [a.id]: emptyWorst } }))
    setSelectedId(a.id); setAthlete(emptyAthlete)
  }
  function editAthlete(a){ setAthlete(a); setTab('atletas') }
  function saveWorst(field,value){ setData(d=>({ ...d, worst: { ...d.worst, [selectedId]: { ...(d.worst[selectedId]||emptyWorst), [field]: Number(value) } } })) }
  function updateSession(path,value){
    setSession(s=>{
      const copy = structuredClone(s)
      const [a,b] = path.split('.')
      if(b) copy[a][b] = value
      else copy[a] = value
      return copy
    })
  }
  function loadPlanIntoSession(){
    setSession(s => ({ ...s, planejado: { ...s.planejado, ...nextPlan } }))
    setTab('sessoes')
  }
  function saveSession(){
    if(!selectedId) return alert('Cadastre/selecione um atleta primeiro')
    if(!session.data) return alert('Digite a data da sessão')
    const s = { ...session, atletaId:selectedId, id: session.id || uid() }
    setData(d=>({ ...d, sessions: session.id ? d.sessions.map(x=>x.id===session.id?s:x) : [...d.sessions,s] }))
    setSession(emptySession)
  }
  function editSession(s){ setSession(structuredClone(s)); setTab('sessoes') }
  function duplicateSession(s){ setSession({ ...structuredClone(s), id:'', data:'', sessao:`${s.sessao || 'Sessão'} - cópia`, anexos:[] }); setTab('sessoes') }
  function removeSession(id){ if(confirm('Excluir sessão?')) setData(d=>({ ...d, sessions:d.sessions.filter(s=>s.id!==id) })) }
  async function addFiles(files){
    const list = await Promise.all([...files].map(file => new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve({ id: uid(), nome:file.name, tipo:file.type, tamanho:file.size, dataUrl:reader.result })
      reader.readAsDataURL(file)
    })))
    setSession(s=>({ ...s, anexos:[...(s.anexos||[]), ...list] }))
  }
  function removeAttachment(id){ setSession(s=>({ ...s, anexos:(s.anexos||[]).filter(a=>a.id!==id) })) }
  function importCsv(file){
    if(!selectedId) return alert('Selecione um atleta')
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      const lines = text.split(/\r?\n/).filter(Boolean)
      if(lines.length < 2) return alert('CSV sem dados')
      const sep = lines[0].includes(';') ? ';' : ','
      const headers = lines[0].split(sep).map(h=>h.trim())
      const imported = lines.slice(1).map(line => {
        const values = line.split(sep)
        const row = {}; headers.forEach((h,i)=> row[h] = values[i])
        const mapped = mapCsvRow(row)
        return { ...emptySession, id:uid(), atletaId:selectedId, data:mapped.data, sessao:mapped.sessao || `Sessão ${allSessions.length+1}`, fase:selected?.fase || 'Fase 2', realizado:mapped.realizado, objetivo:'Importado do CTR/CSV', clinico:{...emptySession.clinico} }
      }).filter(s=>s.data || Object.values(s.realizado).some(Boolean))
      setData(d=>({ ...d, sessions:[...d.sessions, ...imported] }))
      alert(`${imported.length} sessão(ões) importada(s).`)
    }
    reader.readAsText(file)
  }
  function exportCsv(){
    const headers = ['data','sessao','fase','dt','hsr','sprint','sprints','vmax','acc3','dcc3','codAlto','playerLoad','dor','rigidez','confianca','forca','assimetria','readiness']
    const rows = allSessions.map(s => [s.data,s.sessao,s.fase,...['dt','hsr','sprint','sprints','vmax','acc3','dcc3','codAlto','playerLoad'].map(k=>s.realizado?.[k]||0),s.clinico?.dor,s.clinico?.rigidez,s.clinico?.confianca,s.clinico?.forca,s.clinico?.assimetria,readiness(s.clinico||emptySession.clinico)])
    const csv = [headers.join(';'), ...rows.map(r=>r.join(';'))].join('\n')
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `rtp_${selected?.nome || 'atleta'}_sessoes.csv`; a.click(); URL.revokeObjectURL(url)
  }
  function printPdf(){ window.print() }

  return (
    <main className="min-h-screen bg-slate-100 p-5 text-slate-900 print:bg-white print:p-0">
      <div className="mx-auto max-w-[1800px] space-y-4">
        <Header selected={selected} score={score} dec={dec} onPrint={printPdf} />

        <div className="flex flex-wrap gap-2 print:hidden">
          {['dashboard','atletas','sessoes','planejamento','decisao','relatorio'].map(t => <button key={t} onClick={()=>setTab(t)} className={`rounded-xl px-4 py-2 text-xs font-black uppercase ${tab===t?'bg-amber-500 text-black':'bg-white text-slate-600 border'}`}>{t}</button>)}
        </div>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr] print:block">
          <aside className="space-y-4 print:hidden">
            <Panel title="Atleta RTP">
              <select value={selectedId} onChange={e=>setSelectedId(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-amber-500">
                <option value="">Selecionar atleta</option>
                {data.athletes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
              {selected && <div className="mt-3 rounded-xl bg-slate-900 p-4 text-white">
                <p className="text-xs uppercase text-slate-400">{selected.lesao}</p>
                <p className="text-xl font-black text-amber-400">{selected.nome}</p>
                <p className="text-sm">{selected.fase} · {selected.status}</p>
                <button onClick={()=>editAthlete(selected)} className="mt-3 rounded-lg bg-amber-500 px-3 py-2 text-xs font-black text-black">Editar cadastro</button>
              </div>}
            </Panel>
            <Panel title="Resumo atual">
              <Mini label="Sessões" value={allSessions.length} />
              <Mini label="DT acumulada" value={`${money(week.dt)} m`} />
              <Mini label="% pior semana" value={`${pct(week.dt,worst.dt)}%`} />
              <Mini label="Último readiness" value={`${score}%`} />
            </Panel>
          </aside>

          <div className="space-y-4">
            {tab === 'dashboard' && <Dashboard selected={selected} worst={worst} week={week} sessions={allSessions} last={last} score={score} dec={dec} />}
            {tab === 'atletas' && <Athletes athlete={athlete} setAthlete={setAthlete} saveAthlete={saveAthlete} athletes={data.athletes} editAthlete={editAthlete} selectedId={selectedId} />}
            {tab === 'sessoes' && <Sessions selected={selected} session={session} updateSession={updateSession} setSession={setSession} saveSession={saveSession} addFiles={addFiles} removeAttachment={removeAttachment} sessions={filteredSessions} filters={filters} setFilters={setFilters} editSession={editSession} duplicateSession={duplicateSession} removeSession={removeSession} importCsv={importCsv} exportCsv={exportCsv} />}
            {tab === 'planejamento' && <Planning worst={worst} saveWorst={saveWorst} planner={planner} plannerPct={plannerPct} setPlannerPct={setPlannerPct} nextPlan={nextPlan} loadPlanIntoSession={loadPlanIntoSession} />}
            {tab === 'decisao' && <Clinical last={last} score={score} st={st} dec={dec} />}
            {tab === 'relatorio' && <Report refEl={reportRef} selected={selected} worst={worst} week={week} sessions={allSessions} last={last} score={score} dec={dec} printPdf={printPdf} />}
          </div>
        </section>
      </div>
    </main>
  )
}

function Header({selected, score, dec, onPrint}){ return <header className="rounded-2xl border-4 border-amber-500 bg-white p-5 shadow-sm print:border-2 print:shadow-none">
  <div className="flex flex-wrap items-center justify-between gap-4">
    <div><p className="text-xs font-black uppercase tracking-[.25em] text-slate-500">Grêmio Novorizontino SAF</p><h1 className="text-3xl font-black uppercase">Módulo RTP — Retorno de Lesão</h1><p className="text-sm text-slate-500">Dashboard interativo · sessões · planejamento · decisão clínica · PDF</p></div>
    <div className="flex gap-3"><div className={`rounded-2xl px-5 py-3 text-center ${statusColor(dec.color)}`}><p className="text-xs font-black uppercase">Decisão</p><p className="text-2xl font-black">{dec.label}</p></div><div className="rounded-2xl bg-slate-900 px-5 py-3 text-center text-white"><p className="text-xs font-black uppercase text-slate-400">Readiness</p><p className="text-3xl font-black text-amber-400">{score}%</p></div><button onClick={onPrint} className="print:hidden rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-black">Gerar PDF</button></div>
  </div>
  {selected && <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6"><Info label="Atleta" value={selected.nome}/><Info label="Lesão" value={selected.lesao}/><Info label="Músculo" value={selected.musculo || '—'}/><Info label="Fase" value={selected.fase}/><Info label="Categoria" value={selected.categoria}/><Info label="Preparador" value={selected.preparador || '—'}/></div>}
</header> }
function Panel({title, children}){ return <div className="rounded-2xl border bg-white p-4 shadow-sm"><h2 className="mb-3 text-sm font-black uppercase text-slate-600">{title}</h2>{children}</div> }
function Info({label,value}){ return <div className="rounded-xl bg-slate-100 p-3"><p className="text-[10px] font-black uppercase text-slate-500">{label}</p><p className="text-sm font-black">{value}</p></div> }
function Mini({label,value}){ return <div className="mb-2 flex items-center justify-between rounded-xl bg-slate-100 p-3"><span className="text-xs font-bold text-slate-500">{label}</span><b>{value}</b></div> }
function Field({label, value, onChange, type='text', children}){ return <label className="block"><span className="mb-1 block text-[10px] font-black uppercase text-slate-500">{label}</span>{children || <input type={type} value={value} onChange={e=>onChange(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-amber-500"/>}</label> }
function MetricInput({label,value,onChange}){ return <label><span className="mb-1 block text-[10px] font-black uppercase text-slate-500">{label}</span><input type="number" value={value} onChange={e=>onChange(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-amber-500"/></label> }
function Progress({label,value,reference}){ const p=pct(value,reference); return <div><div className="mb-1 flex justify-between text-xs font-bold"><span>{label}</span><span>{p}%</span></div><div className="h-3 rounded-full bg-slate-200"><div className={`h-3 rounded-full ${barColor(p)}`} style={{width:`${Math.min(p,100)}%`}}/></div></div> }
function Pill({children,color='slate'}){ const cls = color==='green'?'bg-emerald-100 text-emerald-800':color==='yellow'?'bg-amber-100 text-amber-900':color==='red'?'bg-red-100 text-red-800':'bg-slate-100 text-slate-700'; return <span className={`rounded-full px-3 py-1 text-xs font-black ${cls}`}>{children}</span> }

function Dashboard({selected,worst,week,sessions,last,score,dec}){ return <div className="grid gap-4 xl:grid-cols-3">
  <Panel title="Comparação com pior cenário"><div className="space-y-4">{metricKeys().slice(0,8).map(k=><Progress key={k} label={metricLabel(k)} value={week[k]} reference={worst[k]}/>)}</div></Panel>
  <Panel title="Última sessão"><div className="grid grid-cols-2 gap-2">{metricKeys().slice(0,8).map(k=><Info key={k} label={metricLabel(k)} value={last.realizado?.[k] || 0}/>)}</div><div className="mt-4 flex gap-2"><Pill color={dec.color}>{dec.label}</Pill><Pill>Readiness {score}%</Pill></div></Panel>
  <Panel title="Evolução"><div className="space-y-2">{sessions.slice(-6).map(s=><div key={s.id} className="rounded-xl bg-slate-100 p-3"><div className="flex justify-between"><b>{s.data} · {s.sessao}</b><Pill color={clinicalStatus(s.clinico)}>{readiness(s.clinico)}%</Pill></div><div className="mt-2 grid grid-cols-4 gap-2 text-xs"><span>DT {s.realizado?.dt||0}</span><span>HSR {s.realizado?.hsr||0}</span><span>V {s.realizado?.vmax||0}</span><span>Comp. {compliance(s.planejado||{},s.realizado||{})}%</span></div></div>)}</div></Panel>
</div> }

function Athletes({athlete,setAthlete,saveAthlete,athletes,editAthlete}){ return <Panel title="Cadastro de atleta RTP"><div className="grid gap-3 md:grid-cols-4"><Field label="Nome" value={athlete.nome} onChange={v=>setAthlete({...athlete,nome:v})}/><Field label="Categoria" value={athlete.categoria} onChange={v=>setAthlete({...athlete,categoria:v})}/><Field label="Posição" value={athlete.posicao} onChange={v=>setAthlete({...athlete,posicao:v})}/><Field label="Dominância" value={athlete.dominancia} onChange={v=>setAthlete({...athlete,dominancia:v})}/><Field label="Lesão" value={athlete.lesao} onChange={v=>setAthlete({...athlete,lesao:v})}/><Field label="Músculo" value={athlete.musculo} onChange={v=>setAthlete({...athlete,musculo:v})}/><Field label="Grau" value={athlete.grau} onChange={v=>setAthlete({...athlete,grau:v})}/><Field label="Fase" value={athlete.fase} onChange={v=>setAthlete({...athlete,fase:v})}/><Field label="Data lesão" type="date" value={athlete.dataLesao} onChange={v=>setAthlete({...athlete,dataLesao:v})}/><Field label="Início RTP" type="date" value={athlete.inicioRtp} onChange={v=>setAthlete({...athlete,inicioRtp:v})}/><Field label="Médico" value={athlete.medico} onChange={v=>setAthlete({...athlete,medico:v})}/><Field label="Fisioterapeuta" value={athlete.fisioterapeuta} onChange={v=>setAthlete({...athlete,fisioterapeuta:v})}/></div><button onClick={saveAthlete} className="mt-4 rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-black">Salvar atleta</button><div className="mt-5 grid gap-3 md:grid-cols-3">{athletes.map(a=><div key={a.id} className="rounded-xl border p-3"><b>{a.nome}</b><p className="text-sm text-slate-500">{a.lesao} · {a.fase}</p><button onClick={()=>editAthlete(a)} className="mt-2 text-xs font-black text-amber-600">Editar</button></div>)}</div></Panel> }

function Sessions({selected,session,updateSession,setSession,saveSession,addFiles,removeAttachment,sessions,filters,setFilters,editSession,duplicateSession,removeSession,importCsv,exportCsv}){ return <div className="space-y-4"><Panel title="V2 — Cadastro de sessões RTP"><div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">Agora a sessão tem planejado x realizado, indicadores clínicos, anexos CTR/PDF com armazenamento local, importação CSV e duplicação para progressão.</div><div className="grid gap-3 md:grid-cols-5"><Field label="Data" type="date" value={session.data} onChange={v=>updateSession('data',v)}/><Field label="Sessão" value={session.sessao} onChange={v=>updateSession('sessao',v)}/><Field label="Fase" value={session.fase} onChange={v=>updateSession('fase',v)}/><Field label="Tipo" value={session.tipo} onChange={v=>updateSession('tipo',v)}/><Field label="Tempo (min)" type="number" value={session.tempo} onChange={v=>updateSession('tempo',Number(v))}/></div><div className="mt-3"><Field label="Objetivo" value={session.objetivo} onChange={v=>updateSession('objetivo',v)}/></div><div className="mt-4 grid gap-4 xl:grid-cols-2"><div className="rounded-xl bg-slate-100 p-4"><h3 className="mb-3 text-xs font-black uppercase">Planejado</h3><div className="grid grid-cols-3 gap-2">{metricKeys().map(k=><MetricInput key={k} label={metricLabel(k)} value={session.planejado?.[k]} onChange={v=>updateSession(`planejado.${k}`,Number(v))}/>)}</div></div><div className="rounded-xl bg-slate-100 p-4"><h3 className="mb-3 text-xs font-black uppercase">Realizado GPS / CTR</h3><div className="grid grid-cols-3 gap-2">{metricKeys().map(k=><MetricInput key={k} label={metricLabel(k)} value={session.realizado?.[k]} onChange={v=>updateSession(`realizado.${k}`,Number(v))}/>)}</div></div></div><div className="mt-4 grid gap-3 md:grid-cols-6"><MetricInput label="Dor 0-10" value={session.clinico?.dor} onChange={v=>updateSession('clinico.dor',Number(v))}/><MetricInput label="Rigidez 0-10" value={session.clinico?.rigidez} onChange={v=>updateSession('clinico.rigidez',Number(v))}/><MetricInput label="Confiança 0-10" value={session.clinico?.confianca} onChange={v=>updateSession('clinico.confianca',Number(v))}/><MetricInput label="Dor pós-chute" value={session.clinico?.dorChute} onChange={v=>updateSession('clinico.dorChute',Number(v))}/><MetricInput label="Força %" value={session.clinico?.forca} onChange={v=>updateSession('clinico.forca',Number(v))}/><MetricInput label="Assimetria %" value={session.clinico?.assimetria} onChange={v=>updateSession('clinico.assimetria',Number(v))}/></div><div className="mt-3 grid gap-3 md:grid-cols-3"><Field label="Resposta 24h"><select value={session.clinico?.resposta24h} onChange={e=>updateSession('clinico.resposta24h',e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-amber-500"><option>Sem reação</option><option>Rigidez leve</option><option>Dor leve</option><option>Piora</option></select></Field><Field label="Qualidade movimento"><select value={session.clinico?.qualidadeMovimento} onChange={e=>updateSession('clinico.qualidadeMovimento',e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-amber-500"><option>Boa</option><option>Regular</option><option>Ruim</option></select></Field><Field label="Tolerância gesto"><select value={session.clinico?.toleranciaGesto} onChange={e=>updateSession('clinico.toleranciaGesto',e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-amber-500"><option>Sem dor</option><option>Desconforto</option><option>Dor</option></select></Field></div><div className="mt-4 grid gap-3 md:grid-cols-3"><label><span className="mb-1 block text-[10px] font-black uppercase text-slate-500">Campo</span><textarea value={session.campo} onChange={e=>updateSession('campo',e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-amber-500 min-h-[100px]"/></label><label><span className="mb-1 block text-[10px] font-black uppercase text-slate-500">Força específica</span><textarea value={session.forcaDesc} onChange={e=>updateSession('forcaDesc',e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-amber-500 min-h-[100px]"/></label><label><span className="mb-1 block text-[10px] font-black uppercase text-slate-500">Observações</span><textarea value={session.observacoes} onChange={e=>updateSession('observacoes',e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-amber-500 min-h-[100px]"/></label></div><div className="mt-4 rounded-xl border border-dashed p-4"><b className="text-sm uppercase">Anexos CTR / PDF / imagem</b><input type="file" multiple onChange={e=>addFiles(e.target.files)} className="mt-2 block w-full text-sm"/><div className="mt-3 flex flex-wrap gap-2">{(session.anexos||[]).map(a=><span key={a.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold"><a href={a.dataUrl} download={a.nome} className="text-amber-700">{a.nome}</a> <button onClick={()=>removeAttachment(a.id)} className="ml-2 text-red-600">×</button></span>)}</div></div><div className="mt-4 flex flex-wrap gap-2"><button onClick={saveSession} className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-black">Salvar sessão</button><button onClick={()=>setSession(emptySession)} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white">Limpar</button><label className="rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-700 border cursor-pointer">Importar CSV CTR<input type="file" accept=".csv" onChange={e=>e.target.files?.[0] && importCsv(e.target.files[0])} className="hidden"/></label><button onClick={exportCsv} className="rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-700 border">Exportar CSV</button></div></Panel><Panel title="Histórico de sessões"><div className="mb-3 grid gap-2 md:grid-cols-4"><input placeholder="Buscar" value={filters.texto} onChange={e=>setFilters({...filters,texto:e.target.value})} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-amber-500"/><select value={filters.fase} onChange={e=>setFilters({...filters,fase:e.target.value})} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-amber-500"><option>Todas</option><option>Fase 1</option><option>Fase 2</option><option>Fase 3</option><option>Fase 4</option><option>Reintegração</option></select><input type="date" value={filters.inicio} onChange={e=>setFilters({...filters,inicio:e.target.value})} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-amber-500"/><input type="date" value={filters.fim} onChange={e=>setFilters({...filters,fim:e.target.value})} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-amber-500"/></div><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm"><thead><tr className="bg-slate-900 text-white"><th className="p-2 text-left">Data</th><th>Sessão</th><th>Fase</th><th>DT</th><th>HSR</th><th>Sprint</th><th>Vmáx</th><th>ACC</th><th>DCC</th><th>Comp.</th><th>Clin.</th><th>Ações</th></tr></thead><tbody>{sessions.map(s=>{ const clin=clinicalStatus(s.clinico); return <tr key={s.id} className="border-b"><td className="p-2 font-bold">{s.data}</td><td>{s.sessao}</td><td>{s.fase}</td><td>{s.realizado?.dt}</td><td>{s.realizado?.hsr}</td><td>{s.realizado?.sprint}</td><td>{s.realizado?.vmax}</td><td>{s.realizado?.acc3}</td><td>{s.realizado?.dcc3}</td><td>{compliance(s.planejado||{},s.realizado||{})}%</td><td><Pill color={clin}>{readiness(s.clinico)}%</Pill></td><td><button onClick={()=>editSession(s)} className="mr-2 font-black text-amber-600">Editar</button><button onClick={()=>duplicateSession(s)} className="mr-2 font-black text-slate-600">Duplicar</button><button onClick={()=>removeSession(s.id)} className="font-black text-red-600">Excluir</button></td></tr>})}</tbody></table></div></Panel></div> }

function Planning({worst,saveWorst,planner,plannerPct,setPlannerPct,nextPlan,loadPlanIntoSession}){ return <div className="space-y-4"><Panel title="Pior cenário manual"><div className="grid gap-3 md:grid-cols-5">{metricKeys().map(k=><MetricInput key={k} label={metricLabel(k)} value={worst[k]} onChange={v=>saveWorst(k,Number(v))}/>)}</div></Panel><Panel title="Planejador automático 60–90%"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="bg-slate-900 text-white"><th className="p-2">%</th>{metricKeys().map(k=><th key={k}>{metricLabel(k)}</th>)}</tr></thead><tbody>{planner.map(row=><tr key={row.p} className="border-b text-center"><td className="p-2 font-black text-amber-600">{row.p}%</td>{metricKeys().map(k=><td key={k}>{row[k]}</td>)}</tr>)}</tbody></table></div><div className="mt-5 rounded-xl bg-slate-100 p-4"><label className="text-xs font-black uppercase">Criar planejamento para próxima sessão: {plannerPct}%</label><input type="range" min="60" max="90" step="5" value={plannerPct} onChange={e=>setPlannerPct(Number(e.target.value))} className="mt-2 w-full"/><div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-9">{metricKeys().map(k=><Info key={k} label={metricLabel(k)} value={nextPlan[k]}/>)}</div><button onClick={loadPlanIntoSession} className="mt-4 rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-black">Enviar para nova sessão</button></div></Panel></div> }

function Clinical({last,score,st,dec}){ const c=last.clinico||emptySession.clinico; return <Panel title="Decisão clínica RTP"><div className="grid gap-4 lg:grid-cols-3"><div className="rounded-2xl bg-slate-900 p-6 text-center text-white"><p className="text-xs font-black uppercase text-slate-400">Readiness</p><p className="text-6xl font-black text-amber-400">{score}%</p><div className={`mx-auto mt-4 inline-block rounded-full px-5 py-2 text-sm font-black ${statusColor(dec.color)}`}>{dec.label}</div></div><div className="lg:col-span-2 grid gap-3 md:grid-cols-3"><Info label="Dor" value={`${c.dor}/10`}/><Info label="Rigidez" value={`${c.rigidez}/10`}/><Info label="Confiança" value={`${c.confianca}/10`}/><Info label="Dor pós-chute" value={`${c.dorChute}/10`}/><Info label="Força" value={`${c.forca}%`}/><Info label="Assimetria" value={`${c.assimetria}%`}/><Info label="Resposta 24h" value={c.resposta24h}/><Info label="Movimento" value={c.qualidadeMovimento}/><Info label="Gesto" value={c.toleranciaGesto}/></div></div><div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900">Regra: verde progride, amarelo mantém, vermelho regride. O cálculo considera dor, rigidez, confiança, força, assimetria, dor pós-chute e resposta 24h.</div></Panel> }

function Report({selected,worst,week,sessions,last,score,dec,printPdf}){ return <div className="rounded-2xl border-4 border-amber-500 bg-white p-5" id="rtp-report"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[.25em] text-slate-500">Relatório para Comissão Técnica</p><h2 className="text-3xl font-black">RTP — {selected?.nome || 'Atleta'}</h2><p className="text-sm text-slate-500">{selected?.lesao || 'Lesão'} · {selected?.fase || 'Fase'}</p></div><button onClick={printPdf} className="print:hidden rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-black">Gerar PDF</button></div><div className="grid gap-4 md:grid-cols-4"><Info label="Readiness" value={`${score}%`}/><Info label="Decisão" value={dec.label}/><Info label="DT semana" value={`${money(week.dt)} m`}/><Info label="% pior semana" value={`${pct(week.dt,worst.dt)}%`}/></div><div className="mt-4 grid gap-4 lg:grid-cols-2"><Panel title="Comparação com pior cenário">{metricKeys().slice(0,8).map(k=><Progress key={k} label={metricLabel(k)} value={week[k]} reference={worst[k]}/>)}</Panel><Panel title="Última sessão / critérios"><ClinicalMini c={last.clinico||emptySession.clinico}/></Panel></div><Panel title="Sessões realizadas"><table className="mt-2 w-full text-sm"><thead><tr className="bg-slate-900 text-white"><th className="p-2 text-left">Data</th><th>Fase</th><th>DT</th><th>HSR</th><th>Sprint</th><th>Vmáx</th><th>Readiness</th></tr></thead><tbody>{sessions.map(s=><tr key={s.id} className="border-b text-center"><td className="p-2 text-left font-bold">{s.data}</td><td>{s.fase}</td><td>{s.realizado?.dt}</td><td>{s.realizado?.hsr}</td><td>{s.realizado?.sprint}</td><td>{s.realizado?.vmax}</td><td>{readiness(s.clinico)}%</td></tr>)}</tbody></table></Panel></div> }
function ClinicalMini({c}){ return <div className="grid grid-cols-2 gap-2 text-sm"><Info label="Dor" value={`${c.dor}/10`}/><Info label="Rigidez" value={`${c.rigidez}/10`}/><Info label="Confiança" value={`${c.confianca}/10`}/><Info label="Força" value={`${c.forca}%`}/><Info label="Assimetria" value={`${c.assimetria}%`}/><Info label="Resposta 24h" value={c.resposta24h}/></div> }

// Classes utilitárias usadas nesta página.
// O projeto já usa Tailwind; o @apply abaixo não é necessário porque usamos className inline.
// Classe base replicada como string em vários inputs: mantenha no globals se preferir.
