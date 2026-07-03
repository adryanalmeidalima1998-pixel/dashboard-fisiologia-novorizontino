'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

const STORAGE_KEY = 'novorizontino_rtp_module_v1'

const emptyAthlete = {
  id: '', nome: '', categoria: 'Profissional', posicao: '', dominancia: '', lesao: 'Anterior de coxa', musculo: '', grau: '',
  dataLesao: '', inicioRtp: '', fase: 'Fase 2', medico: '', fisioterapeuta: '', preparador: '', status: 'Em RTP'
}

const emptyWorst = { dt: 0, hsr: 0, sprint: 0, sprints: 0, vmax: 0, acc3: 0, dcc3: 0, codAlto: 0, playerLoad: 0 }
const emptySession = { id:'', atletaId:'', data:'', sessao:'', fase:'Fase 2', tempo:0, objetivo:'', dt:0, hsr:0, sprint:0, sprints:0, vmax:0, acc3:0, dcc3:0, codAlto:0, dor:0, rigidez:0, confianca:8, dorChute:0, forca:90, assimetria:8, resposta24h:'Sem reação', campo:'', forcaDesc:'', observacoes:'', anexos:[] }

function uid(){ return `${Date.now()}-${Math.random().toString(16).slice(2)}` }
function num(v){ return Number(v || 0) }
function pct(v,r){ return r ? Math.round((num(v)/num(r))*100) : 0 }
function clamp(v,min=0,max=100){ return Math.max(min, Math.min(max, v)) }
function statusClass(kind){ return kind === 'green' ? 'bg-emerald-500 text-white' : kind === 'yellow' ? 'bg-amber-400 text-black' : 'bg-red-500 text-white' }
function clinicalStatus(s){
  if(num(s.dor)>4 || num(s.rigidez)>5 || num(s.dorChute)>2 || num(s.forca)<85 || num(s.assimetria)>15 || num(s.confianca)<6 || s.resposta24h === 'Piora') return 'red'
  if(num(s.dor)>2 || num(s.rigidez)>2 || num(s.dorChute)>0 || num(s.forca)<90 || num(s.assimetria)>10 || num(s.confianca)<8 || s.resposta24h === 'Rigidez leve' || s.resposta24h === 'Dor leve') return 'yellow'
  return 'green'
}
function readiness(s){
  const dor = clamp(100 - num(s.dor)*15)
  const rig = clamp(100 - num(s.rigidez)*12)
  const conf = clamp(num(s.confianca)*10)
  const chute = clamp(100 - num(s.dorChute)*20)
  const forca = clamp(num(s.forca))
  const assim = clamp(100 - num(s.assimetria)*5)
  const resp = s.resposta24h === 'Sem reação' ? 100 : s.resposta24h === 'Rigidez leve' ? 75 : s.resposta24h === 'Dor leve' ? 55 : 25
  return Math.round(dor*.15 + rig*.10 + conf*.10 + chute*.10 + forca*.25 + assim*.15 + resp*.15)
}
function decision(score, st){
  if(st === 'red' || score < 60) return { label:'REGREDIR', color:'red' }
  if(st === 'yellow' || score < 80) return { label:'MANTER', color:'yellow' }
  return { label:'PROGREDIR', color:'green' }
}

export default function RTPModule(){
  const [tab,setTab] = useState('dashboard')
  const [data,setData] = useState({ athletes: [], worst: {}, sessions: [] })
  const [selectedId,setSelectedId] = useState('')
  const [athlete,setAthlete] = useState(emptyAthlete)
  const [session,setSession] = useState(emptySession)
  const reportRef = useRef(null)

  useEffect(()=>{ const saved = localStorage.getItem(STORAGE_KEY); if(saved){ const parsed=JSON.parse(saved); setData(parsed); setSelectedId(parsed.athletes?.[0]?.id || '') } },[])
  useEffect(()=>{ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) },[data])

  const selected = data.athletes.find(a=>a.id===selectedId) || null
  const worst = data.worst[selectedId] || emptyWorst
  const sessions = data.sessions.filter(s=>s.atletaId===selectedId).sort((a,b)=>String(a.data).localeCompare(String(b.data)))
  const last = sessions[sessions.length-1] || emptySession
  const week = sessions.reduce((acc,s)=>({ dt:acc.dt+num(s.dt), hsr:acc.hsr+num(s.hsr), sprint:acc.sprint+num(s.sprint), sprints:acc.sprints+num(s.sprints), acc3:acc.acc3+num(s.acc3), dcc3:acc.dcc3+num(s.dcc3), codAlto:acc.codAlto+num(s.codAlto), playerLoad:acc.playerLoad+num(s.playerLoad) }), {dt:0,hsr:0,sprint:0,sprints:0,acc3:0,dcc3:0,codAlto:0,playerLoad:0})
  const score = readiness(last)
  const st = clinicalStatus(last)
  const dec = decision(score, st)
  const planner = useMemo(()=>[60,70,80,90].map(p=>({ p, dt:Math.round(worst.dt*p/100), hsr:Math.round(worst.hsr*p/100), sprint:Math.round(worst.sprint*p/100), sprints:Math.round(worst.sprints*p/100), vmax:((worst.vmax*p/100)||0).toFixed(1), acc3:Math.round(worst.acc3*p/100), dcc3:Math.round(worst.dcc3*p/100), codAlto:Math.round(worst.codAlto*p/100) })),[worst])

  function saveAthlete(){
    if(!athlete.nome) return alert('Digite o nome do atleta')
    const a = { ...athlete, id: athlete.id || uid() }
    setData(d=>({ ...d, athletes: athlete.id ? d.athletes.map(x=>x.id===athlete.id?a:x) : [...d.athletes,a], worst: d.worst[a.id] ? d.worst : { ...d.worst, [a.id]: emptyWorst } }))
    setSelectedId(a.id); setAthlete(emptyAthlete)
  }
  function editAthlete(a){ setAthlete(a); setTab('atletas') }
  function saveWorst(field,value){ setData(d=>({ ...d, worst: { ...d.worst, [selectedId]: { ...(d.worst[selectedId]||emptyWorst), [field]: Number(value) } } })) }
  function saveSession(){
    if(!selectedId) return alert('Cadastre/selecione um atleta primeiro')
    if(!session.data) return alert('Digite a data da sessão')
    const s = { ...session, atletaId:selectedId, id: session.id || uid() }
    setData(d=>({ ...d, sessions: session.id ? d.sessions.map(x=>x.id===session.id?s:x) : [...d.sessions,s] }))
    setSession(emptySession)
  }
  function editSession(s){ setSession(s); setTab('sessoes') }
  function removeSession(id){ if(confirm('Excluir sessão?')) setData(d=>({ ...d, sessions:d.sessions.filter(s=>s.id!==id) })) }
  function addFiles(files){ const anexos=[...files].map(f=>({ nome:f.name, tipo:f.type, tamanho:f.size })); setSession(s=>({ ...s, anexos:[...(s.anexos||[]), ...anexos] })) }
  function exportPdf(){ window.print() }

  return <main className="min-h-screen bg-slate-100 p-5 text-slate-900 print:bg-white">
    <style>{`@media print{.no-print{display:none!important}.print-area{box-shadow:none!important;border:0!important}.page-break{break-before:page}}`}</style>
    <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-3xl font-black uppercase">Módulo RTP</h1><p className="text-sm text-slate-500">Retorno de lesão • cadastro • sessões • planejamento • decisão clínica • relatório</p></div>
      <div className="flex flex-wrap gap-2">
        <select value={selectedId} onChange={e=>setSelectedId(e.target.value)} className="rounded-xl border p-3 font-bold"><option value="">Selecionar atleta</option>{data.athletes.map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}</select>
        <button onClick={exportPdf} className="rounded-xl bg-black px-4 py-3 text-sm font-black uppercase text-white">Gerar PDF</button>
      </div>
    </div>

    <div className="no-print mb-4 flex flex-wrap gap-2">
      {[['dashboard','Dashboard'],['atletas','Atletas'],['cenario','Pior cenário'],['sessoes','Sessões + CTR'],['planejamento','Planejador 60–90%'],['decisao','Decisão clínica'],['relatorio','Relatório comissão']].map(([id,label])=><button key={id} onClick={()=>setTab(id)} className={`rounded-xl px-4 py-2 text-xs font-black uppercase ${tab===id?'bg-amber-500 text-black':'bg-white text-slate-700 border'}`}>{label}</button>)}
    </div>

    {!selected && tab !== 'atletas' && <EmptyState setTab={setTab}/>} 

    {tab==='atletas' && <Panel title="Cadastro do atleta RTP"><div className="grid grid-cols-1 gap-3 md:grid-cols-4"><Input label="Nome" v={athlete.nome} set={v=>setAthlete({...athlete,nome:v})}/><Input label="Categoria" v={athlete.categoria} set={v=>setAthlete({...athlete,categoria:v})}/><Input label="Posição" v={athlete.posicao} set={v=>setAthlete({...athlete,posicao:v})}/><Input label="Dominância" v={athlete.dominancia} set={v=>setAthlete({...athlete,dominancia:v})}/><Input label="Lesão" v={athlete.lesao} set={v=>setAthlete({...athlete,lesao:v})}/><Input label="Músculo" v={athlete.musculo} set={v=>setAthlete({...athlete,musculo:v})}/><Input label="Grau" v={athlete.grau} set={v=>setAthlete({...athlete,grau:v})}/><Input label="Fase" v={athlete.fase} set={v=>setAthlete({...athlete,fase:v})}/><Input label="Data da lesão" type="date" v={athlete.dataLesao} set={v=>setAthlete({...athlete,dataLesao:v})}/><Input label="Início RTP" type="date" v={athlete.inicioRtp} set={v=>setAthlete({...athlete,inicioRtp:v})}/><Input label="Médico" v={athlete.medico} set={v=>setAthlete({...athlete,medico:v})}/><Input label="Fisioterapeuta" v={athlete.fisioterapeuta} set={v=>setAthlete({...athlete,fisioterapeuta:v})}/><Input label="Preparador RTP" v={athlete.preparador} set={v=>setAthlete({...athlete,preparador:v})}/></div><button onClick={saveAthlete} className="mt-4 rounded-xl bg-amber-500 px-5 py-3 font-black uppercase">Salvar atleta</button><div className="mt-5 grid gap-2">{data.athletes.map(a=><div key={a.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><b>{a.nome}</b><button onClick={()=>editAthlete(a)} className="rounded-lg bg-black px-3 py-2 text-xs font-bold text-white">Editar</button></div>)}</div></Panel>}

    {selected && tab==='cenario' && <Panel title="Pior cenário competitivo do atleta"><p className="mb-4 text-sm text-slate-500">Digite manualmente o pior cenário/semana que será usado como 100%. O sistema calcula 60% a 90% automaticamente.</p><div className="grid grid-cols-2 gap-3 md:grid-cols-5">{Object.keys(emptyWorst).map(k=><Input key={k} label={labels[k]||k} type="number" v={worst[k]} set={v=>saveWorst(k,v)}/>)}</div></Panel>}

    {selected && tab==='sessoes' && <Panel title="Cadastro de sessões e anexos CTR"><div className="grid grid-cols-1 gap-3 md:grid-cols-5"><Input label="Data" type="date" v={session.data} set={v=>setSession({...session,data:v})}/><Input label="Sessão" v={session.sessao} set={v=>setSession({...session,sessao:v})}/><Input label="Fase" v={session.fase} set={v=>setSession({...session,fase:v})}/><Input label="Tempo min" type="number" v={session.tempo} set={v=>setSession({...session,tempo:v})}/><Input label="Objetivo" v={session.objetivo} set={v=>setSession({...session,objetivo:v})}/>{['dt','hsr','sprint','sprints','vmax','acc3','dcc3','codAlto','dor','rigidez','confianca','dorChute','forca','assimetria'].map(k=><Input key={k} label={labels[k]||k} type="number" v={session[k]} set={v=>setSession({...session,[k]:v})}/>)}</div><div className="mt-3 grid gap-3 md:grid-cols-3"><TextArea label="Campo" v={session.campo} set={v=>setSession({...session,campo:v})}/><TextArea label="Força específica" v={session.forcaDesc} set={v=>setSession({...session,forcaDesc:v})}/><TextArea label="Observações" v={session.observacoes} set={v=>setSession({...session,observacoes:v})}/></div><div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4"><label className="text-xs font-black uppercase text-slate-500">Anexar CTR / PDF / imagem da sessão</label><input type="file" multiple onChange={e=>addFiles(e.target.files)} className="mt-2 block w-full"/><div className="mt-2 flex flex-wrap gap-2">{(session.anexos||[]).map((a,i)=><span key={i} className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold">{a.nome}</span>)}</div></div><button onClick={saveSession} className="mt-4 rounded-xl bg-amber-500 px-5 py-3 font-black uppercase">Salvar sessão</button><SessionTable sessions={sessions} edit={editSession} remove={removeSession}/></Panel>}

    {selected && tab==='dashboard' && <div ref={reportRef} className="print-area rounded-2xl bg-white p-5 shadow-xl"><Header selected={selected} score={score} dec={dec}/><div className="mt-5 grid gap-4 lg:grid-cols-4"><Metric title="Readiness" value={`${score}%`} color="amber"/><Metric title="Decisão" value={dec.label} color={dec.color}/><Metric title="Sessões" value={sessions.length}/><Metric title="Última Vmax" value={`${num(last.vmax)} km/h`}/></div><div className="mt-5 grid gap-4 lg:grid-cols-2"><PanelLite title="% da pior semana acumulado">{[['Distância',week.dt,worst.dt],['HSR',week.hsr,worst.hsr],['Sprint',week.sprint,worst.sprint],['ACC>3',week.acc3,worst.acc3],['DCC>3',week.dcc3,worst.dcc3]].map(([l,v,r])=><Bar key={l} label={l} p={pct(v,r)} sub={`${v} / ${r}`}/>)}</PanelLite><PanelLite title="Últimas sessões"><SessionTable sessions={sessions.slice(-5)} edit={editSession} remove={removeSession} compact/></PanelLite></div></div>}

    {selected && tab==='planejamento' && <Panel title="Planejador automático 60% a 90%"><table className="w-full overflow-hidden rounded-xl text-sm"><thead className="bg-black text-white"><tr><th className="p-3 text-left">%</th><th>DT</th><th>HSR</th><th>Sprint</th><th>Sprints</th><th>Vmáx</th><th>ACC&gt;3</th><th>DCC&gt;3</th><th>COD Alto</th></tr></thead><tbody>{planner.map(r=><tr key={r.p} className="border-b bg-white text-center"><td className="p-3 text-left font-black">{r.p}%</td><td>{r.dt}</td><td>{r.hsr}</td><td>{r.sprint}</td><td>{r.sprints}</td><td>{r.vmax}</td><td>{r.acc3}</td><td>{r.dcc3}</td><td>{r.codAlto}</td></tr>)}</tbody></table></Panel>}

    {selected && tab==='decisao' && <Panel title="Decisão clínica RTP"><div className="grid gap-4 lg:grid-cols-3"><Metric title="Readiness" value={`${score}%`} color="amber"/><Metric title="Status clínico" value={st.toUpperCase()} color={st}/><Metric title="Decisão" value={dec.label} color={dec.color}/></div><div className="mt-5 grid gap-3 md:grid-cols-3"><Criteria label="Dor 0–2" v={`${last.dor}/10`} ok={num(last.dor)<=2}/><Criteria label="Rigidez 0–2" v={`${last.rigidez}/10`} ok={num(last.rigidez)<=2}/><Criteria label="Confiança ≥8" v={`${last.confianca}/10`} ok={num(last.confianca)>=8}/><Criteria label="Dor pós-chute 0" v={`${last.dorChute}/10`} ok={num(last.dorChute)===0}/><Criteria label="Força ≥90%" v={`${last.forca}%`} ok={num(last.forca)>=90}/><Criteria label="Assimetria <10%" v={`${last.assimetria}%`} ok={num(last.assimetria)<10}/></div><TextArea label="Justificativa para comissão técnica" v={last.observacoes || ''} set={()=>{}} disabled/></Panel>}

    {selected && tab==='relatorio' && <div className="print-area rounded-2xl bg-white p-6 shadow-xl"><Header selected={selected} score={score} dec={dec}/><h2 className="mt-6 text-xl font-black uppercase">Resumo para comissão técnica</h2><p className="mt-2 text-sm">Atleta em {selected.fase}, lesão: {selected.lesao}. Readiness atual: {score}%. Decisão sugerida: {dec.label}.</p><div className="mt-4 grid gap-4 lg:grid-cols-2"><PanelLite title="Última sessão"><p>Data: <b>{last.data || '-'}</b></p><p>DT: <b>{last.dt} m</b></p><p>HSR: <b>{last.hsr} m</b></p><p>Vmax: <b>{last.vmax} km/h</b></p><p>ACC/DCC &gt;3: <b>{last.acc3}/{last.dcc3}</b></p></PanelLite><PanelLite title="Clínico"><p>Dor: <b>{last.dor}/10</b></p><p>Rigidez: <b>{last.rigidez}/10</b></p><p>Confiança: <b>{last.confianca}/10</b></p><p>Força: <b>{last.forca}%</b></p><p>Assimetria: <b>{last.assimetria}%</b></p></PanelLite></div><div className="mt-8 grid grid-cols-3 gap-8 text-center text-xs font-bold uppercase"><div className="border-t pt-2">Preparador RTP</div><div className="border-t pt-2">Fisioterapia</div><div className="border-t pt-2">Médico</div></div></div>}
  </main>
}

const labels={dt:'Distância total',hsr:'HSR 20–25',sprint:'Sprint >25',sprints:'Nº sprints',vmax:'Vmáx km/h',acc3:'ACC >3',dcc3:'DCC >3',codAlto:'COD alto',playerLoad:'Player Load',dor:'Dor 0–10',rigidez:'Rigidez 0–10',confianca:'Confiança 0–10',dorChute:'Dor pós-chute',forca:'Força %',assimetria:'Assimetria %'}
function Panel({title,children}){ return <section className="rounded-2xl bg-white p-5 shadow-xl"><h2 className="mb-4 text-xl font-black uppercase">{title}</h2>{children}</section> }
function PanelLite({title,children}){ return <section className="rounded-xl border bg-white p-4"><h3 className="mb-3 text-sm font-black uppercase text-slate-500">{title}</h3>{children}</section> }
function Input({label,v,set,type='text'}){ return <label className="block"><span className="text-[10px] font-black uppercase text-slate-500">{label}</span><input type={type} value={v ?? ''} onChange={e=>set(e.target.value)} className="mt-1 w-full rounded-xl border p-3 text-sm font-bold"/></label> }
function TextArea({label,v,set,disabled=false}){ return <label className="block"><span className="text-[10px] font-black uppercase text-slate-500">{label}</span><textarea value={v ?? ''} disabled={disabled} onChange={e=>set(e.target.value)} className="mt-1 min-h-[110px] w-full rounded-xl border p-3 text-sm"/></label> }
function Metric({title,value,color}){ const c=color==='green'?'bg-emerald-500':color==='yellow'?'bg-amber-400':color==='red'?'bg-red-500':color==='amber'?'bg-amber-500':'bg-black'; return <div className={`${c} rounded-2xl p-5 text-black ${color==='red'||color==='green'||color===undefined?'text-white':'text-black'}`}><p className="text-xs font-black uppercase opacity-70">{title}</p><p className="text-3xl font-black">{value}</p></div> }
function Header({selected,score,dec}){ return <header className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-amber-500 pb-4"><div><p className="text-xs font-black uppercase text-slate-500">Grêmio Novorizontino SAF</p><h1 className="text-3xl font-black uppercase">Relatório RTP</h1><p className="font-bold">{selected.nome} • {selected.lesao} • {selected.fase}</p></div><div className="text-right"><p className="text-xs font-black uppercase text-slate-500">Readiness / Decisão</p><p className="text-4xl font-black">{score}%</p><span className={`rounded-full px-4 py-1 text-xs font-black uppercase ${statusClass(dec.color)}`}>{dec.label}</span></div></header> }
function Bar({label,p,sub}){ const c=p<60?'bg-emerald-500':p<=90?'bg-amber-400':'bg-red-500'; return <div className="mb-3"><div className="mb-1 flex justify-between text-xs font-bold"><span>{label}</span><span>{p}% • {sub}</span></div><div className="h-3 rounded-full bg-slate-200"><div className={`h-3 rounded-full ${c}`} style={{width:`${Math.min(p,100)}%`}}/></div></div> }
function Criteria({label,v,ok}){ return <div className={`rounded-xl p-4 ${ok?'bg-emerald-50 border border-emerald-200':'bg-amber-50 border border-amber-200'}`}><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="text-2xl font-black">{v}</p></div> }
function SessionTable({sessions,edit,remove,compact=false}){ return <div className="mt-4 overflow-auto"><table className="w-full text-xs"><thead className="bg-slate-900 text-white"><tr><th className="p-2 text-left">Data</th><th>DT</th><th>HSR</th><th>Vmax</th><th>ACC</th><th>DCC</th>{!compact&&<th>Ações</th>}</tr></thead><tbody>{sessions.map(s=><tr key={s.id} className="border-b bg-white text-center"><td className="p-2 text-left font-bold">{s.data}</td><td>{s.dt}</td><td>{s.hsr}</td><td>{s.vmax}</td><td>{s.acc3}</td><td>{s.dcc3}</td>{!compact&&<td className="flex justify-center gap-2 p-2"><button onClick={()=>edit(s)} className="rounded bg-black px-2 py-1 text-white">Editar</button><button onClick={()=>remove(s.id)} className="rounded bg-red-600 px-2 py-1 text-white">Excluir</button></td>}</tr>)}</tbody></table></div> }
function EmptyState({setTab}){ return <div className="rounded-2xl bg-white p-8 text-center shadow-xl"><h2 className="text-2xl font-black">Comece cadastrando um atleta RTP</h2><p className="mt-2 text-slate-500">Depois cadastre o pior cenário e as sessões do atleta.</p><button onClick={()=>setTab('atletas')} className="mt-4 rounded-xl bg-amber-500 px-5 py-3 font-black uppercase">Cadastrar atleta</button></div> }
