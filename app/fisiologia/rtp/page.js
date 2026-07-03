'use client'

import { useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'novorizontino_rtp_module_v3_v5'
const LEGACY_KEYS = ['novorizontino_rtp_module_v2','novorizontino_rtp_module_v1']

const metricLabels = {
  dt:'Distância total', hsr:'HSR 20-25', sprint:'Sprint >25', sprints:'Sprints', vmax:'Vmáx',
  acc3:'ACC >3', dcc3:'DCC >3', codAlto:'COD alto', playerLoad:'Player Load'
}
const metricUnits = { dt:'m', hsr:'m', sprint:'m', sprints:'', vmax:'km/h', acc3:'', dcc3:'', codAlto:'', playerLoad:'' }
const metrics = Object.keys(metricLabels)

const emptyAthlete = {
  id:'', nome:'', categoria:'Profissional', posicao:'', dominancia:'', lesao:'Anterior de coxa', musculo:'Reto femoral', grau:'',
  dataLesao:'', inicioRtp:'', fase:'Fase 2', medico:'', fisioterapeuta:'', preparador:'', status:'Em RTP'
}
const emptyWorst = { dt:0, hsr:0, sprint:0, sprints:0, vmax:0, acc3:0, dcc3:0, codAlto:0, playerLoad:0 }
const emptySession = {
  id:'', atletaId:'', data:'', sessao:'', fase:'Fase 2', tipo:'Campo + força', objetivo:'', tempo:0,
  plannedPct:60,
  planejado:{...emptyWorst}, realizado:{...emptyWorst},
  clinico:{ dor:0, rigidez:0, confianca:8, dorChute:0, forca:90, assimetria:8, resposta24h:'Sem reação', qualidadeMovimento:'Boa', toleranciaGesto:'Sem dor' },
  campo:'', forcaDesc:'', observacoes:'', anexos:[]
}

function uid(){ return `${Date.now()}-${Math.random().toString(16).slice(2)}` }
function n(v){ return Number(v || 0) }
function clamp(v,min=0,max=100){ return Math.max(min, Math.min(max, v)) }
function fmt(v){ return new Intl.NumberFormat('pt-BR').format(n(v)) }
function pct(v,r){ return r ? Math.round((n(v)/n(r))*100) : 0 }
function target(worst, p){ const out={}; metrics.forEach(k=> out[k] = k==='vmax' ? Number((n(worst[k])*p/100).toFixed(1)) : Math.round(n(worst[k])*p/100)); return out }
function barColor(p){ return p <= 60 ? 'bg-emerald-500' : p <= 85 ? 'bg-amber-400' : 'bg-red-500' }
function badgeColor(c){ return c==='green'?'bg-emerald-500 text-white':c==='yellow'?'bg-amber-400 text-black':'bg-red-500 text-white' }
function statusClinical(c){
  if(n(c.dor)>4 || n(c.rigidez)>5 || n(c.dorChute)>2 || n(c.forca)<85 || n(c.assimetria)>15 || n(c.confianca)<6 || c.resposta24h==='Piora' || c.toleranciaGesto==='Dor') return 'red'
  if(n(c.dor)>2 || n(c.rigidez)>2 || n(c.dorChute)>0 || n(c.forca)<90 || n(c.assimetria)>10 || n(c.confianca)<8 || ['Rigidez leve','Dor leve'].includes(c.resposta24h) || c.toleranciaGesto==='Desconforto') return 'yellow'
  return 'green'
}
function readiness(c, compliance=100){
  const dor = clamp(100 - n(c.dor)*15)
  const rig = clamp(100 - n(c.rigidez)*12)
  const conf = clamp(n(c.confianca)*10)
  const chute = clamp(100 - n(c.dorChute)*20)
  const forca = clamp(n(c.forca))
  const assim = clamp(100 - n(c.assimetria)*5)
  const resp = c.resposta24h==='Sem reação'?100:c.resposta24h==='Rigidez leve'?75:c.resposta24h==='Dor leve'?55:25
  return Math.round(dor*.13 + rig*.08 + conf*.09 + chute*.08 + forca*.22 + assim*.14 + resp*.14 + clamp(compliance)*.12)
}
function decision(score, status, alerts){
  if(status==='red' || score < 60 || alerts.some(a=>a.level==='red')) return {label:'REGREDIR', color:'red'}
  if(status==='yellow' || score < 80 || alerts.some(a=>a.level==='yellow')) return {label:'MANTER', color:'yellow'}
  return {label:'PROGREDIR', color:'green'}
}
function compliance(planned, done){
  const keys = metrics.filter(k=> n(planned?.[k]) > 0)
  if(!keys.length) return 100
  const values = keys.map(k=> clamp(100 - Math.abs(n(done?.[k]) - n(planned?.[k])) / n(planned?.[k]) * 100))
  return Math.round(values.reduce((a,b)=>a+b,0)/values.length)
}
function weekTotals(sessions){ return sessions.reduce((acc,s)=>{ metrics.forEach(k=> acc[k]+=n(s.realizado?.[k])); return acc }, {...emptyWorst}) }
function comparePrev(sessions, key){ if(sessions.length<2) return 0; const a=n(sessions[sessions.length-2]?.realizado?.[key]); const b=n(sessions[sessions.length-1]?.realizado?.[key]); return a ? Math.round(((b-a)/a)*100) : 0 }
function buildPlanner(worst){ return [40,50,60,70,80,90,100].map(p=>({p, ...target(worst,p)})) }
function inferNextPct(last, score, dec){
  const base = n(last?.plannedPct || 60)
  if(dec.color==='green') return clamp(base+10,40,100)
  if(dec.color==='yellow') return base
  return clamp(base-10,40,100)
}
function makeAlerts({worst, week, last, sessions, score}){
  const alerts=[]
  const c=last?.clinico || emptySession.clinico
  if(n(c.dor)>4) alerts.push({level:'red', title:'Dor alta', text:'Dor >4/10. Recomendado regredir carga e reavaliar.'})
  else if(n(c.dor)>2) alerts.push({level:'yellow', title:'Dor moderada', text:'Manter fase e evitar progressão agressiva.'})
  if(n(c.dorChute)>2) alerts.push({level:'red', title:'Dor pós-chute', text:'Reduzir finalizações/chutes fortes e reforçar força específica.'})
  else if(n(c.dorChute)>0) alerts.push({level:'yellow', title:'Atenção ao gesto específico', text:'Controlar volume/intensidade de chutes.'})
  if(n(c.forca)<85) alerts.push({level:'red', title:'Força insuficiente', text:'Força <85%. Priorizar academia e critérios clínicos.'})
  else if(n(c.forca)<90) alerts.push({level:'yellow', title:'Força em zona amarela', text:'Manter progressão conservadora.'})
  if(n(c.assimetria)>15) alerts.push({level:'red', title:'Assimetria elevada', text:'Assimetria >15%. Reavaliar mecânica e força.'})
  else if(n(c.assimetria)>10) alerts.push({level:'yellow', title:'Assimetria moderada', text:'Monitorar antes de aumentar HSR/sprint.'})
  metrics.forEach(k=>{ if(worst[k] && pct(week[k],worst[k])>100) alerts.push({level:'red', title:`${metricLabels[k]} acima do pior cenário`, text:'Carga acumulada ultrapassou 100% da referência.'}) })
  if(worst.dt && pct(week.dt,worst.dt)>90) alerts.push({level:'yellow', title:'Carga semanal alta', text:'Distância acumulada acima de 90% do pior cenário.'})
  if(comparePrev(sessions,'dt')>20) alerts.push({level:'yellow', title:'Salto de volume', text:'Aumento >20% na distância entre sessões.'})
  if(comparePrev(sessions,'acc3')>30) alerts.push({level:'yellow', title:'Salto mecânico', text:'Aumento >30% em ACC>3 entre sessões.'})
  if(score<60) alerts.push({level:'red', title:'Readiness baixo', text:'Não recomendar progressão.'})
  return alerts
}
function recommendation({athlete,last,dec,nextPct,nextPlan,alerts}){
  if(dec.color==='red') return `Regredir ou repetir sessão leve. Priorizar controle clínico, força específica e técnica sem estresse. Evitar HSR/sprints/chutes fortes até normalizar os critérios.`
  if(dec.color==='yellow') return `Manter a fase atual e repetir carga próxima da última sessão. Ajustar apenas 1 variável por vez, com foco em qualidade do movimento e resposta em 24h.`
  const quad = String(athlete?.lesao||'').toLowerCase().includes('anterior') || String(athlete?.musculo||'').toLowerCase().includes('reto')
  return `Progredir para ${nextPct}% do pior cenário. Próxima meta sugerida: DT ${fmt(nextPlan.dt)} m, HSR ${fmt(nextPlan.hsr)} m, sprint ${fmt(nextPlan.sprint)} m, Vmáx ${nextPlan.vmax || 0} km/h, ACC>3 ${nextPlan.acc3}, DCC>3 ${nextPlan.dcc3}. ${quad ? 'Controlar volume e intensidade de chutes, especialmente finalizações fortes.' : 'Controlar exposição à velocidade e sprints.'}`
}

export default function RTPModulePage(){
  const [data,setData] = useState({athletes:[], worst:{}, sessions:[]})
  const [selectedId,setSelectedId] = useState('')
  const [athlete,setAthlete] = useState(emptyAthlete)
  const [session,setSession] = useState(emptySession)
  const [tab,setTab] = useState('dashboard')
  const [plannerPct,setPlannerPct] = useState(60)

  useEffect(()=>{
    let saved = localStorage.getItem(STORAGE_KEY)
    if(!saved){ for(const k of LEGACY_KEYS){ saved = localStorage.getItem(k); if(saved) break } }
    if(saved){ try{ const parsed=JSON.parse(saved); setData({athletes:parsed.athletes||[], worst:parsed.worst||{}, sessions:parsed.sessions||[]}); setSelectedId(parsed.athletes?.[0]?.id || '') }catch{} }
  },[])
  useEffect(()=>{ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) },[data])

  const selected = data.athletes.find(a=>a.id===selectedId) || data.athletes[0] || null
  const athleteId = selected?.id || ''
  const worst = data.worst[athleteId] || {...emptyWorst}
  const sessions = data.sessions.filter(s=>s.atletaId===athleteId).sort((a,b)=>String(a.data).localeCompare(String(b.data)))
  const week = useMemo(()=>weekTotals(sessions),[data.sessions, athleteId])
  const last = sessions.at(-1) || emptySession
  const lastComp = compliance(last.planejado,last.realizado)
  const score = readiness(last.clinico || emptySession.clinico, lastComp)
  const alerts = makeAlerts({worst, week, last, sessions, score})
  const clinStatus = statusClinical(last.clinico || emptySession.clinico)
  const dec = decision(score, clinStatus, alerts)
  const nextPct = inferNextPct(last, score, dec)
  const nextPlan = target(worst,nextPct)
  const planner = buildPlanner(worst)
  const manualPlan = target(worst, plannerPct)
  const rec = recommendation({athlete:selected,last,dec,nextPct,nextPlan,alerts})

  function saveAthlete(){
    const item = {...athlete, id:athlete.id || uid()}
    setData(d=>({ ...d, athletes:d.athletes.some(a=>a.id===item.id)? d.athletes.map(a=>a.id===item.id?item:a) : [...d.athletes,item] }))
    setSelectedId(item.id); setAthlete(emptyAthlete)
  }
  function saveWorst(k,v){ if(!athleteId) return; setData(d=>({...d, worst:{...d.worst, [athleteId]:{...(d.worst[athleteId]||emptyWorst), [k]:Number(v)}}})) }
  function updateSession(path,value){
    setSession(s=>{ const copy=structuredClone(s); const parts=path.split('.'); let cur=copy; parts.slice(0,-1).forEach(p=>cur=cur[p]); cur[parts.at(-1)] = value; return copy })
  }
  function saveSession(){
    if(!athleteId) return alert('Cadastre/selecione um atleta primeiro.')
    const item = {...session, id:session.id || uid(), atletaId:athleteId}
    setData(d=>({...d, sessions:d.sessions.some(s=>s.id===item.id)? d.sessions.map(s=>s.id===item.id?item:s) : [...d.sessions,item]}))
    setSession({...emptySession, atletaId:athleteId})
  }
  function loadPlan(p=plannerPct){ setSession(s=>({...s, plannedPct:p, planejado:target(worst,p)})); setTab('sessoes') }
  function loadSuggested(){ setSession(s=>({...s, plannedPct:nextPct, planejado:nextPlan, objetivo:rec})); setTab('sessoes') }
  function addFiles(files){
    const arr = Array.from(files||[])
    Promise.all(arr.map(file=>new Promise(resolve=>{ const r=new FileReader(); r.onload=()=>resolve({id:uid(), nome:file.name, tipo:file.type, tamanho:file.size, dataUrl:r.result}); r.readAsDataURL(file) }))).then(items=>setSession(s=>({...s, anexos:[...(s.anexos||[]),...items]})))
  }
  function exportJson(){
    const blob = new Blob([JSON.stringify({athlete:selected,worst,sessions},null,2)], {type:'application/json'})
    const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`rtp-${selected?.nome||'atleta'}.json`; a.click(); URL.revokeObjectURL(url)
  }
  function exportCsv(){
    const header = ['data','sessao','fase',...metrics.map(k=>`realizado_${k}`),'readiness','decisao']
    const rows = sessions.map(s=>[s.data,s.sessao,s.fase,...metrics.map(k=>s.realizado?.[k]||0),readiness(s.clinico, compliance(s.planejado,s.realizado)), decision(readiness(s.clinico, compliance(s.planejado,s.realizado)), statusClinical(s.clinico), []).label])
    const csv=[header,...rows].map(r=>r.join(';')).join('\n')
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`historico-rtp-${selected?.nome||'atleta'}.csv`; a.click(); URL.revokeObjectURL(url)
  }
  function printPdf(){ window.print() }

  return <main className="min-h-screen bg-slate-100 p-4 text-slate-950 print:bg-white print:p-0">
    <div className="mx-auto max-w-[1700px] space-y-4">
      <header className="rounded-3xl border-4 border-amber-500 bg-white p-5 shadow-sm print:border-2 print:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.25em] text-slate-500">Grêmio Novorizontino SAF</p>
            <h1 className="text-3xl font-black uppercase">Módulo RTP — V3/V4/V5</h1>
            <p className="text-sm text-slate-500">Planejador automático · Relatório profissional · Inteligência de progressão</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <button onClick={exportJson} className="rounded-2xl border px-4 py-3 text-sm font-black">Exportar JSON</button>
            <button onClick={exportCsv} className="rounded-2xl border px-4 py-3 text-sm font-black">Exportar CSV</button>
            <button onClick={printPdf} className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-black">Gerar PDF</button>
          </div>
        </div>
        {selected && <div className="mt-4 grid gap-3 md:grid-cols-6"><Info label="Atleta" value={selected.nome}/><Info label="Lesão" value={selected.lesao}/><Info label="Músculo" value={selected.musculo}/><Info label="Fase" value={selected.fase}/><Info label="Readiness" value={`${score}%`}/><Info label="Decisão" value={dec.label}/></div>}
      </header>

      <nav className="flex flex-wrap gap-2 print:hidden">
        {['dashboard','atleta','sessoes','planejador','inteligencia','relatorio'].map(t=><button key={t} onClick={()=>setTab(t)} className={`rounded-xl px-4 py-2 text-sm font-black uppercase ${tab===t?'bg-slate-900 text-white':'bg-white border'}`}>{t}</button>)}
      </nav>

      {!selected && <Panel title="Comece cadastrando um atleta"><AthleteForm athlete={athlete} setAthlete={setAthlete} saveAthlete={saveAthlete}/></Panel>}

      {selected && <>
        {tab==='dashboard' && <Dashboard selected={selected} worst={worst} sessions={sessions} week={week} last={last} score={score} dec={dec} alerts={alerts} rec={rec}/>} 
        {tab==='atleta' && <div className="grid gap-4 lg:grid-cols-2"><Panel title="Cadastro do atleta"><AthleteForm athlete={athlete} setAthlete={setAthlete} saveAthlete={saveAthlete}/></Panel><Panel title="Atletas cadastrados"><div className="space-y-2">{data.athletes.map(a=><div key={a.id} className="flex items-center justify-between rounded-xl bg-slate-100 p-3"><button onClick={()=>setSelectedId(a.id)} className="text-left font-black">{a.nome}<p className="text-xs font-bold text-slate-500">{a.lesao} · {a.fase}</p></button><button onClick={()=>setAthlete(a)} className="text-sm font-black text-amber-600">Editar</button></div>)}</div></Panel></div>}
        {tab==='sessoes' && <Sessions session={session} setSession={setSession} updateSession={updateSession} saveSession={saveSession} addFiles={addFiles} sessions={sessions} setEdit={setSession}/>} 
        {tab==='planejador' && <Planner worst={worst} saveWorst={saveWorst} planner={planner} plannerPct={plannerPct} setPlannerPct={setPlannerPct} manualPlan={manualPlan} loadPlan={loadPlan} nextPct={nextPct} nextPlan={nextPlan} loadSuggested={loadSuggested}/>} 
        {tab==='inteligencia' && <Intelligence alerts={alerts} rec={rec} nextPct={nextPct} nextPlan={nextPlan} dec={dec} score={score} last={last} sessions={sessions} selected={selected}/>} 
        {tab==='relatorio' && <Report selected={selected} worst={worst} sessions={sessions} week={week} last={last} score={score} dec={dec} alerts={alerts} rec={rec} nextPct={nextPct} nextPlan={nextPlan} printPdf={printPdf}/>} 
      </>}
    </div>
  </main>
}

function Dashboard({selected,worst,sessions,week,last,score,dec,alerts,rec}){ return <div className="grid gap-4 xl:grid-cols-3">
  <Panel title="Status executivo"><div className="rounded-3xl bg-slate-900 p-6 text-center text-white"><p className="text-xs font-black uppercase text-slate-400">Readiness RTP</p><p className="text-7xl font-black text-amber-400">{score}%</p><span className={`mt-4 inline-block rounded-full px-5 py-2 text-sm font-black ${badgeColor(dec.color)}`}>{dec.label}</span></div><div className="mt-4 grid grid-cols-2 gap-2"><Info label="Sessões" value={sessions.length}/><Info label="DT acum." value={`${fmt(week.dt)} m`}/><Info label="% DT pior cenário" value={`${pct(week.dt,worst.dt)}%`}/><Info label="Última sessão" value={last.data || '—'}/></div></Panel>
  <Panel title="Comparação com pior cenário"><div className="space-y-4">{metrics.slice(0,8).map(k=><Progress key={k} label={metricLabels[k]} value={week[k]} reference={worst[k]}/>)}</div></Panel>
  <Panel title="Recomendação automática"><p className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-950">{rec}</p><div className="mt-4 space-y-2">{alerts.slice(0,5).map((a,i)=><Alert key={i} alert={a}/>)}</div></Panel>
  <div className="xl:col-span-3"><Panel title="Histórico completo de sessões"><HistoryTable sessions={sessions}/></Panel></div>
</div> }
function Planner({worst,saveWorst,planner,plannerPct,setPlannerPct,manualPlan,loadPlan,nextPct,nextPlan,loadSuggested}){ return <div className="space-y-4"><Panel title="Pior cenário do atleta — preencher manualmente"><div className="grid gap-3 md:grid-cols-5">{metrics.map(k=><MetricInput key={k} label={`${metricLabels[k]} ${metricUnits[k]}`} value={worst[k]} onChange={v=>saveWorst(k,v)}/>)}</div></Panel><Panel title="Planejador automático 40–100%"><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm"><thead><tr className="bg-slate-900 text-white"><th className="p-2">%</th>{metrics.map(k=><th key={k}>{metricLabels[k]}</th>)}</tr></thead><tbody>{planner.map(row=><tr key={row.p} className="border-b text-center"><td className="p-2 font-black text-amber-600">{row.p}%</td>{metrics.map(k=><td key={k}>{row[k]}</td>)}</tr>)}</tbody></table></div></Panel><div className="grid gap-4 lg:grid-cols-2"><Panel title="Criar planejamento manual"><label className="text-xs font-black uppercase">Percentual escolhido: {plannerPct}%</label><input type="range" min="40" max="100" step="5" value={plannerPct} onChange={e=>setPlannerPct(Number(e.target.value))} className="mt-2 w-full"/><MetricGrid obj={manualPlan}/><button onClick={()=>loadPlan(plannerPct)} className="mt-4 rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-black">Enviar para nova sessão</button></Panel><Panel title="Próxima sessão sugerida"><p className="mb-3 text-sm font-bold text-slate-600">Baseada em readiness, decisão clínica, alertas e última carga planejada.</p><MetricGrid obj={nextPlan}/><button onClick={loadSuggested} className="mt-4 rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white">Usar sugestão {nextPct}%</button></Panel></div></div> }
function Intelligence({alerts,rec,nextPct,nextPlan,dec,score,last,sessions,selected}){ return <div className="grid gap-4 lg:grid-cols-3"><Panel title="Inteligência de progressão"><div className="rounded-3xl bg-slate-900 p-6 text-center text-white"><p className="text-xs font-black uppercase text-slate-400">Decisão automática</p><p className="text-4xl font-black text-amber-400">{dec.label}</p><p className="mt-2 text-sm">Readiness {score}%</p></div><p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-950">{rec}</p></Panel><Panel title="Alertas de carga e critérios"><div className="space-y-2">{alerts.length ? alerts.map((a,i)=><Alert key={i} alert={a}/>) : <div className="rounded-xl bg-emerald-50 p-4 text-sm font-black text-emerald-800">Sem alertas relevantes. Atleta apto a progredir conforme critérios.</div>}</div></Panel><Panel title="Recomendações baseadas na lesão"><ul className="space-y-2 text-sm font-bold text-slate-700"><li>• Progredir apenas 1 variável dominante por sessão.</li><li>• Lesão anterior de coxa: controlar acelerações explosivas e volume/intensidade de chutes.</li><li>• Validar resposta 24h antes de subir fase ou percentual.</li><li>• Força ≥90% e assimetria &lt;10% como referência para progressão.</li></ul><div className="mt-4"><h3 className="mb-2 text-xs font-black uppercase text-slate-500">Próxima meta</h3><MetricGrid obj={nextPlan}/></div></Panel><div className="lg:col-span-3"><Panel title="Tendências sessão a sessão"><HistoryTable sessions={sessions}/></Panel></div></div> }
function Sessions({session,setSession,updateSession,saveSession,addFiles,sessions,setEdit}){ return <div className="space-y-4"><Panel title="Cadastrar / editar sessão RTP"><div className="grid gap-3 md:grid-cols-5"><Field label="Data" type="date" value={session.data} onChange={v=>updateSession('data',v)}/><Field label="Sessão" value={session.sessao} onChange={v=>updateSession('sessao',v)}/><Field label="Fase" value={session.fase} onChange={v=>updateSession('fase',v)}/><Field label="Tipo" value={session.tipo} onChange={v=>updateSession('tipo',v)}/><Field label="Tempo" type="number" value={session.tempo} onChange={v=>updateSession('tempo',Number(v))}/></div><div className="mt-4 grid gap-4 lg:grid-cols-2"><MetricBlock title="Planejado" base="planejado" obj={session.planejado} update={updateSession}/><MetricBlock title="Realizado" base="realizado" obj={session.realizado} update={updateSession}/></div><div className="mt-4 grid gap-3 md:grid-cols-6"><MetricInput label="Dor 0-10" value={session.clinico.dor} onChange={v=>updateSession('clinico.dor',Number(v))}/><MetricInput label="Rigidez 0-10" value={session.clinico.rigidez} onChange={v=>updateSession('clinico.rigidez',Number(v))}/><MetricInput label="Confiança 0-10" value={session.clinico.confianca} onChange={v=>updateSession('clinico.confianca',Number(v))}/><MetricInput label="Dor pós-chute" value={session.clinico.dorChute} onChange={v=>updateSession('clinico.dorChute',Number(v))}/><MetricInput label="Força %" value={session.clinico.forca} onChange={v=>updateSession('clinico.forca',Number(v))}/><MetricInput label="Assimetria %" value={session.clinico.assimetria} onChange={v=>updateSession('clinico.assimetria',Number(v))}/></div><div className="mt-4 grid gap-3 md:grid-cols-3"><SelectField label="Resposta 24h" value={session.clinico.resposta24h} onChange={v=>updateSession('clinico.resposta24h',v)} options={['Sem reação','Rigidez leve','Dor leve','Piora']}/><SelectField label="Movimento" value={session.clinico.qualidadeMovimento} onChange={v=>updateSession('clinico.qualidadeMovimento',v)} options={['Boa','Regular','Ruim']}/><SelectField label="Gesto específico" value={session.clinico.toleranciaGesto} onChange={v=>updateSession('clinico.toleranciaGesto',v)} options={['Sem dor','Desconforto','Dor']}/></div><div className="mt-4 grid gap-3 md:grid-cols-3"><TextArea label="Campo" value={session.campo} onChange={v=>updateSession('campo',v)}/><TextArea label="Força específica" value={session.forcaDesc} onChange={v=>updateSession('forcaDesc',v)}/><TextArea label="Observações" value={session.observacoes} onChange={v=>updateSession('observacoes',v)}/></div><div className="mt-4 rounded-xl border border-dashed p-4"><b className="text-sm uppercase">Anexos CTR / GPS / PDF / imagem</b><input type="file" multiple onChange={e=>addFiles(e.target.files)} className="mt-2 block w-full text-sm"/><div className="mt-3 flex flex-wrap gap-2">{(session.anexos||[]).map(a=><a key={a.id} href={a.dataUrl} download={a.nome} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-amber-700">{a.nome}</a>)}</div></div><div className="mt-4 flex gap-2"><button onClick={saveSession} className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-black">Salvar sessão</button><button onClick={()=>setSession(emptySession)} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white">Limpar</button></div></Panel><Panel title="Histórico completo"><HistoryTable sessions={sessions} edit={setEdit}/></Panel></div> }
function Report({selected,worst,sessions,week,last,score,dec,alerts,rec,nextPct,nextPlan,printPdf}){ return <div id="rtp-report" className="rounded-3xl border-4 border-amber-500 bg-white p-6 print:border-2"><div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.25em] text-slate-500">Relatório profissional RTP</p><h2 className="text-4xl font-black">{selected.nome}</h2><p className="text-sm font-bold text-slate-500">{selected.lesao} · {selected.musculo} · {selected.fase}</p></div><button onClick={printPdf} className="print:hidden rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-black">Gerar PDF</button></div><div className="grid gap-3 md:grid-cols-6"><Info label="Readiness" value={`${score}%`}/><Info label="Decisão" value={dec.label}/><Info label="Sessões" value={sessions.length}/><Info label="DT atual" value={`${fmt(week.dt)} m`}/><Info label="% pior DT" value={`${pct(week.dt,worst.dt)}%`}/><Info label="Próxima meta" value={`${nextPct}%`}/></div><div className="mt-4 grid gap-4 lg:grid-cols-2"><Panel title="Comparação com pior cenário">{metrics.slice(0,8).map(k=><Progress key={k} label={metricLabels[k]} value={week[k]} reference={worst[k]}/>)}</Panel><Panel title="Decisão e recomendação"><div className={`mb-3 inline-block rounded-full px-5 py-2 text-sm font-black ${badgeColor(dec.color)}`}>{dec.label}</div><p className="rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-950">{rec}</p><div className="mt-3 space-y-2">{alerts.slice(0,4).map((a,i)=><Alert key={i} alert={a}/>)}</div></Panel></div><div className="mt-4"><Panel title="Próxima sessão sugerida"><MetricGrid obj={nextPlan}/></Panel></div><div className="mt-4"><Panel title="Histórico completo"><HistoryTable sessions={sessions}/></Panel></div><div className="mt-6 grid grid-cols-3 gap-6 text-center text-xs font-bold text-slate-500"><div>Preparador RTP<br/><br/>________________________</div><div>Fisioterapia<br/><br/>________________________</div><div>Médico<br/><br/>________________________</div></div></div> }

function AthleteForm({athlete,setAthlete,saveAthlete}){ return <><div className="grid gap-3 md:grid-cols-4"><Field label="Nome" value={athlete.nome} onChange={v=>setAthlete({...athlete,nome:v})}/><Field label="Categoria" value={athlete.categoria} onChange={v=>setAthlete({...athlete,categoria:v})}/><Field label="Posição" value={athlete.posicao} onChange={v=>setAthlete({...athlete,posicao:v})}/><Field label="Dominância" value={athlete.dominancia} onChange={v=>setAthlete({...athlete,dominancia:v})}/><Field label="Lesão" value={athlete.lesao} onChange={v=>setAthlete({...athlete,lesao:v})}/><Field label="Músculo" value={athlete.musculo} onChange={v=>setAthlete({...athlete,musculo:v})}/><Field label="Grau" value={athlete.grau} onChange={v=>setAthlete({...athlete,grau:v})}/><Field label="Fase" value={athlete.fase} onChange={v=>setAthlete({...athlete,fase:v})}/><Field label="Data lesão" type="date" value={athlete.dataLesao} onChange={v=>setAthlete({...athlete,dataLesao:v})}/><Field label="Início RTP" type="date" value={athlete.inicioRtp} onChange={v=>setAthlete({...athlete,inicioRtp:v})}/><Field label="Médico" value={athlete.medico} onChange={v=>setAthlete({...athlete,medico:v})}/><Field label="Preparador" value={athlete.preparador} onChange={v=>setAthlete({...athlete,preparador:v})}/></div><button onClick={saveAthlete} className="mt-4 rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-black">Salvar atleta</button></> }
function HistoryTable({sessions,edit}){ return <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm"><thead><tr className="bg-slate-900 text-white"><th className="p-2 text-left">Data</th><th>Sessão</th><th>Fase</th><th>DT</th><th>HSR</th><th>Sprint</th><th>Vmáx</th><th>ACC</th><th>DCC</th><th>Comp.</th><th>Readiness</th><th>Decisão</th><th></th></tr></thead><tbody>{sessions.map(s=>{ const comp=compliance(s.planejado,s.realizado); const score=readiness(s.clinico,comp); const dec=decision(score,statusClinical(s.clinico),[]); return <tr key={s.id} className="border-b text-center"><td className="p-2 text-left font-bold">{s.data}</td><td>{s.sessao}</td><td>{s.fase}</td><td>{s.realizado?.dt}</td><td>{s.realizado?.hsr}</td><td>{s.realizado?.sprint}</td><td>{s.realizado?.vmax}</td><td>{s.realizado?.acc3}</td><td>{s.realizado?.dcc3}</td><td>{comp}%</td><td>{score}%</td><td><span className={`rounded-full px-2 py-1 text-xs font-black ${badgeColor(dec.color)}`}>{dec.label}</span></td><td>{edit && <button onClick={()=>edit(s)} className="font-black text-amber-600">Editar</button>}</td></tr>})}</tbody></table></div> }
function MetricBlock({title,base,obj,update}){ return <div className="rounded-2xl bg-slate-100 p-4"><h3 className="mb-3 text-xs font-black uppercase text-slate-500">{title}</h3><div className="grid gap-2 md:grid-cols-3">{metrics.map(k=><MetricInput key={k} label={metricLabels[k]} value={obj[k]} onChange={v=>update(`${base}.${k}`,Number(v))}/>)}</div></div> }
function MetricGrid({obj}){ return <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">{metrics.map(k=><Info key={k} label={metricLabels[k]} value={`${obj[k] || 0} ${metricUnits[k]}`}/>)}</div> }
function Alert({alert}){ return <div className={`rounded-xl p-3 text-sm font-bold ${alert.level==='red'?'bg-red-50 text-red-800':alert.level==='yellow'?'bg-amber-50 text-amber-900':'bg-emerald-50 text-emerald-800'}`}><b>{alert.title}</b><p className="text-xs opacity-80">{alert.text}</p></div> }
function Panel({title,children}){ return <section className="rounded-2xl border bg-white p-4 shadow-sm"><h2 className="mb-3 text-sm font-black uppercase text-slate-600">{title}</h2>{children}</section> }
function Info({label,value}){ return <div className="rounded-xl bg-slate-100 p-3"><p className="text-[10px] font-black uppercase text-slate-500">{label}</p><p className="text-sm font-black">{value}</p></div> }
function Progress({label,value,reference}){ const p=pct(value,reference); return <div className="mb-3"><div className="mb-1 flex justify-between text-xs font-bold"><span>{label}</span><span>{p}%</span></div><div className="h-3 rounded-full bg-slate-200"><div className={`h-3 rounded-full ${barColor(p)}`} style={{width:`${Math.min(p,100)}%`}}/></div></div> }
function Field({label,value,onChange,type='text'}){ return <label className="block"><span className="mb-1 block text-[10px] font-black uppercase text-slate-500">{label}</span><input type={type} value={value} onChange={e=>onChange(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-amber-500"/></label> }
function SelectField({label,value,onChange,options}){ return <label className="block"><span className="mb-1 block text-[10px] font-black uppercase text-slate-500">{label}</span><select value={value} onChange={e=>onChange(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-amber-500">{options.map(o=><option key={o}>{o}</option>)}</select></label> }
function MetricInput({label,value,onChange}){ return <label className="block"><span className="mb-1 block text-[10px] font-black uppercase text-slate-500">{label}</span><input type="number" value={value} onChange={e=>onChange(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-amber-500"/></label> }
function TextArea({label,value,onChange}){ return <label className="block"><span className="mb-1 block text-[10px] font-black uppercase text-slate-500">{label}</span><textarea value={value} onChange={e=>onChange(e.target.value)} className="min-h-[110px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-amber-500"/></label> }
