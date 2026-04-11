'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useMemo, useEffect, Suspense } from 'react'
import { useData, calcVmaxPct } from '../../../context/DataContext'

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—'
  if (d.includes('/')) return d
  const [y, m, dd] = d.split('-')
  return `${dd}/${m}/${y}`
}
function toSortable(d) {
  return d ? (d.includes('/') ? d.split('/').reverse().join('-') : d) : ''
}
function scoreColor(s) {
  if (s == null) return '#94a3b8'
  if (s >= 3.5) return '#16a34a'
  if (s >= 2.5) return '#d97706'
  return '#dc2626'
}
function scoreBg(s) {
  if (s == null) return '#f1f5f9'
  if (s >= 3.5) return '#dcfce7'
  if (s >= 2.5) return '#fef3c7'
  return '#fee2e2'
}
function acwrColor(v) {
  if (v == null) return '#94a3b8'
  if (v >= 0.8 && v <= 1.3) return '#16a34a'
  if (v > 1.3 && v <= 1.5) return '#d97706'
  return v > 1.5 ? '#dc2626' : '#64748b'
}
function acwrBg(v) {
  if (v == null) return '#f1f5f9'
  if (v >= 0.8 && v <= 1.3) return '#dcfce7'
  if (v > 1.3 && v <= 1.5) return '#fef3c7'
  return v > 1.5 ? '#fee2e2' : '#f1f5f9'
}

// Mini sparkline SVG puro
function Spark({ values, color = '#f59e0b', h = 32, w = 100 }) {
  const valid = values.filter(v => v != null)
  if (valid.length < 2) return <span style={{ color: '#cbd5e1', fontSize: 9 }}>—</span>
  const min = Math.min(...valid), max = Math.max(...valid), range = max - min || 1
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * w,
    y: v != null ? h - ((v - min) / range) * (h - 6) - 3 : null,
  }))
  const d = []
  let pen = false
  for (const p of pts) {
    if (p.y == null) { pen = false; continue }
    d.push(pen ? `L${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `M${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    pen = true
  }
  const last = pts.filter(p => p.y != null).slice(-1)[0]
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: w, height: h, display: 'block' }}>
      <path d={d.join(' ')} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      {last && <circle cx={last.x} cy={last.y} r="3" fill={color} />}
    </svg>
  )
}

function MiniBar({ value, max, color = '#f59e0b' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div style={{ background: '#f1f5f9', borderRadius: 99, height: 5, overflow: 'hidden', marginTop: 3 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99 }} />
    </div>
  )
}

function KpiCard({ label, value, unit, sub, color = '#1e293b', bg = '#f8fafc', border = '#e2e8f0' }) {
  return (
    <div style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 10, padding: '8px 12px', minWidth: 0 }}>
      <div style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.02em' }}>
        {value ?? '—'}<span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginLeft: 2 }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 8, color: '#94a3b8', fontWeight: 600, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function SectionTitle({ children, accent = '#f59e0b' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
      <div style={{ width: 3, height: 14, background: accent, borderRadius: 2, flexShrink: 0 }} />
      <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#334155' }}>{children}</span>
    </div>
  )
}

// ─── CONTEÚDO DO RELATÓRIO ────────────────────────────────────────────────────
function PrintContent() {
  const searchParams = useSearchParams()
  const athleteName  = searchParams.get('atleta') || ''
  const periodParam  = searchParams.get('periodo') || 'all'

  const { gpsData, bemEstarData, vmaxBaseline, playerPositions, normalizeName } = useData()

  const [cmjColetas, setCmjColetas] = useState([])
  useEffect(() => {
    fetch('/api/cmj')
      .then(r => r.ok ? r.json() : { coletas: [] })
      .then(d => setCmjColetas(d.coletas || []))
      .catch(() => {})
  }, [])

  const cutoffDate = useMemo(() => {
    if (periodParam === 'all') return null
    const d = new Date(); d.setDate(d.getDate() - parseInt(periodParam))
    return d.toISOString().split('T')[0]
  }, [periodParam])

  const norm = normalizeName(athleteName)

  const gpsHistory = useMemo(() => gpsData
    .flatMap(s => {
      const sd = toSortable(s.date)
      if (cutoffDate && sd < cutoffDate) return []
      return s.rows
        .filter(r => normalizeName(r.playerName) === norm && r.periodNumber === 0 && !r.isOutlier)
        .map(r => ({ ...r, _sessionDate: s.date }))
    })
    .sort((a, b) => toSortable(a.sessionDate || a._sessionDate).localeCompare(toSortable(b.sessionDate || b._sessionDate))),
    [gpsData, norm, cutoffDate, normalizeName]
  )

  const wellHistory = useMemo(() => bemEstarData
    .filter(r => normalizeName(r.playerName) === norm && r.type === 'pre' && (!cutoffDate || r.date >= cutoffDate))
    .sort((a, b) => a.date.localeCompare(b.date)),
    [bemEstarData, norm, cutoffDate, normalizeName]
  )

  const srpeHistory = useMemo(() => bemEstarData
    .filter(r => normalizeName(r.playerName) === norm && r.type === 'post' && r.srpeLoad && (!cutoffDate || r.date >= cutoffDate))
    .sort((a, b) => a.date.localeCompare(b.date)),
    [bemEstarData, norm, cutoffDate, normalizeName]
  )

  const gpsStats = useMemo(() => {
    if (!gpsHistory.length) return null
    const v  = k => gpsHistory.map(r => r[k]).filter(x => x != null && x > 0)
    const avg = k => { const a = v(k); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null }
    const max = k => { const a = v(k); return a.length ? Math.max(...a) : null }
    return {
      sessions: gpsHistory.length,
      avgDist: avg('totalDistance'), maxDist: max('totalDistance'),
      avgMmin: avg('distanceRelative'),
      avgHsr: avg('hsr'), maxHsr: max('hsr'),
      avgSprint: avg('sprintDistance'),
      avgLoad: avg('playerLoad'),
      avgVmax: avg('maxVelocity'), maxVmax: max('maxVelocity'),
      avgAccDec: (() => {
        const a = gpsHistory.map(r => (r.acceleration||0)+(r.deceleration||0)).filter(x=>x>0)
        return a.length ? a.reduce((s,x)=>s+x,0)/a.length : null
      })(),
    }
  }, [gpsHistory])

  const wellStats = useMemo(() => {
    if (!wellHistory.length) return null
    const avg = k => { const v = wellHistory.map(r => r[k]).filter(x => x != null); return v.length ? v.reduce((s,x)=>s+x,0)/v.length : null }
    return {
      count: wellHistory.length,
      avgWellness: avg('wellnessScore'), avgSono: avg('sono'),
      avgFadiga: avg('fadiga'), avgDoms: avg('doms'),
      avgEstresse: avg('estresse'), avgHumor: avg('humor'),
      dores: wellHistory.filter(r => r.temDor).length,
    }
  }, [wellHistory])

  const lastWell = wellHistory[wellHistory.length - 1]
  const lastGps  = gpsHistory[gpsHistory.length - 1]
  const vmaxMax  = vmaxBaseline[athleteName] || null
  const vmaxPct  = lastGps && vmaxMax ? calcVmaxPct(lastGps.maxVelocity, vmaxMax) : null
  const position = playerPositions[athleteName] || null

  // ACWR por sessão
  const acwrMap = useMemo(() => {
    const result = {}
    for (const row of gpsHistory) {
      const key = toSortable(row.sessionDate || row._sessionDate)
      const refDate = new Date(key + 'T12:00:00')
      if (isNaN(refDate)) continue
      const acuteStart = new Date(refDate); acuteStart.setDate(refDate.getDate() - 6)
      const acute = gpsHistory
        .filter(r => { const d = new Date(toSortable(r.sessionDate||r._sessionDate)+'T12:00:00'); return d>=acuteStart&&d<=refDate })
        .reduce((s, r) => s + (r.totalDistance||0), 0)
      const wks = [0,1,2,3].map(w => {
        const wE = new Date(refDate); wE.setDate(refDate.getDate()-w*7); wE.setHours(23,59,59)
        const wS = new Date(refDate); wS.setDate(refDate.getDate()-w*7-6); wS.setHours(0,0,0)
        return gpsHistory.filter(r => { const d = new Date(toSortable(r.sessionDate||r._sessionDate)+'T12:00:00'); return d>=wS&&d<=wE })
          .reduce((s,r)=>s+(r.totalDistance||0),0)
      })
      const chronic = wks.reduce((a,b)=>a+b,0)/4
      result[key] = chronic > 0 ? parseFloat((acute/chronic).toFixed(2)) : null
    }
    return result
  }, [gpsHistory])

  const painFreq = useMemo(() => {
    const freq = {}
    for (const r of wellHistory) {
      if (!r.temDor || !r.dorLocalizada) continue
      for (const p of r.dorLocalizada.split(',').map(x=>x.trim()).filter(x=>x&&x!=='0 - Sem dor')) {
        freq[p] = (freq[p]||0) + 1
      }
    }
    return Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0, 8)
  }, [wellHistory])

  const dores = useMemo(() => wellHistory.filter(r=>r.temDor&&r.dorLocalizada).reverse().slice(0,12), [wellHistory])

  const myCmj = useMemo(() => {
    const n = normalizeName(athleteName)
    return cmjColetas.filter(c=>normalizeName(c.athlete_name)===n).sort((a,b)=>new Date(b.data_coleta)-new Date(a.data_coleta))
  }, [cmjColetas, athleteName, normalizeName])
  const cmjBest   = myCmj.length ? Math.max(...myCmj.map(c=>c.media)) : null
  const cmjLast   = myCmj[0] || null
  const cmjFadiga = cmjLast && cmjBest ? Math.round(((cmjLast.media-cmjBest)/cmjBest)*1000)/10 : null

  const periodoLabel = periodParam === 'all' ? 'Histórico completo' : `Últimos ${periodParam} dias`
  const geradoEm     = new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })

  const wellPoints = wellHistory.slice(-30).map(r => r.wellnessScore)
  const sonoPoints = wellHistory.slice(-30).map(r => r.sono)
  const loadPoints = srpeHistory.slice(-20).map(r => r.srpeLoad)
  const distPoints = gpsHistory.slice(-20).map(r => r.totalDistance)
  const hsrPoints  = gpsHistory.slice(-20).map(r => r.hsr)

  if (!athleteName) return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Atleta não especificado.</div>

  const headerStripe = { position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 60%, #1e293b 100%)' }
  const pageStyle    = { width: 794, minHeight: 1123, background: 'white', padding: '32px 36px', position: 'relative', overflow: 'hidden' }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: white; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body { width: 210mm; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
        }
        @media screen {
          body { background: #cbd5e1; padding-bottom: 40px; }
          .a4-page { box-shadow: 0 8px 40px rgba(0,0,0,0.2); margin: 32px auto; }
        }
      `}</style>

      {/* Botões — só na tela */}
      <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, zIndex: 1000, display: 'flex', gap: 8 }}>
        <button onClick={() => window.print()} style={{ background: '#f59e0b', color: '#000', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 900, fontSize: 13, cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
          🖨️ Salvar PDF
        </button>
        <button onClick={() => window.close()} style={{ background: '#1e293b', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          ✕ Fechar
        </button>
      </div>

      {/* ══════════════════════════════════════════════════ PÁGINA 1 */}
      <div className="a4-page" style={pageStyle}>
        <div style={headerStripe} />

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18, paddingBottom:14, borderBottom:'2px solid #f1f5f9' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <img src="/club/escudonovorizontino.png" alt="" style={{ height:48, width:'auto' }} />
            <div>
              <div style={{ fontSize:7, fontWeight:900, letterSpacing:'0.12em', textTransform:'uppercase', color:'#94a3b8', marginBottom:2 }}>Grêmio Novorizontino · Fisiologia</div>
              <div style={{ fontSize:18, fontWeight:900, letterSpacing:'-0.03em', color:'#0f172a', textTransform:'uppercase', lineHeight:1 }}>Relatório Individual</div>
              <div style={{ fontSize:10, fontWeight:600, color:'#64748b', marginTop:2 }}>Análise de Performance · {periodoLabel}</div>
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:7, color:'#cbd5e1', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>Gerado em</div>
            <div style={{ fontSize:10, fontWeight:700, color:'#64748b' }}>{geradoEm}</div>
          </div>
        </div>

        {/* Perfil */}
        <div style={{ display:'flex', gap:14, marginBottom:16, background:'#fafafa', border:'1.5px solid #f1f5f9', borderRadius:14, padding:'14px 18px', alignItems:'center' }}>
          <div style={{ width:64, height:64, borderRadius:10, overflow:'hidden', border:'2.5px solid #f59e0b', flexShrink:0, background:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <img
              src={`/athletes/${athleteName.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z\s]/g,'').trim().toLowerCase().replace(/\s+/g,'_')}.png`}
              alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}
              onError={e => { e.target.style.display='none' }}
            />
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:20, fontWeight:900, letterSpacing:'-0.03em', color:'#0f172a', lineHeight:1 }}>{athleteName}</div>
            {position && <span style={{ display:'inline-block', background:'#fef3c7', color:'#92400e', fontSize:8, fontWeight:900, letterSpacing:'0.1em', textTransform:'uppercase', padding:'2px 8px', borderRadius:6, marginTop:4, border:'1px solid #fde68a' }}>{position}</span>}
          </div>
          <div style={{ display:'flex', gap:8, flexShrink:0 }}>
            {vmaxMax && <KpiCard label="Vmax Baseline" value={vmaxMax.toFixed(1)} unit="km/h" bg="#fffbeb" border="#fde68a" color="#92400e" />}
            {vmaxPct  && <KpiCard label="Últ. % Vmax" value={`${vmaxPct}%`} bg={vmaxPct>=90?'#f0fdf4':vmaxPct>=80?'#fffbeb':'#f8fafc'} border={vmaxPct>=90?'#bbf7d0':vmaxPct>=80?'#fde68a':'#e2e8f0'} color={vmaxPct>=90?'#15803d':vmaxPct>=80?'#92400e':'#475569'} />}
            <KpiCard label="Bem-estar últ." value={lastWell?.wellnessScore?.toFixed(1)} bg={scoreBg(lastWell?.wellnessScore)} border="#e2e8f0" color={scoreColor(lastWell?.wellnessScore)} />
            <KpiCard label="Sessões GPS" value={gpsStats?.sessions ?? '—'} sub={`${wellStats?.count ?? 0} check-ins`} />
          </div>
        </div>

        {/* Grid GPS + Wellness */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>

          {/* GPS médias */}
          <div style={{ background:'#fafafa', border:'1.5px solid #f1f5f9', borderRadius:12, padding:'12px 14px' }}>
            <SectionTitle>Médias GPS</SectionTitle>
            {gpsStats ? (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:7, marginBottom:10 }}>
                  {[
                    { label:'Dist. Média', value:gpsStats.avgDist?.toFixed(0),    unit:'m',     max:gpsStats.maxDist,  color:'#f59e0b' },
                    { label:'HSR Média',   value:gpsStats.avgHsr?.toFixed(0),     unit:'m',     max:gpsStats.maxHsr,   color:'#3b82f6' },
                    { label:'m/min',       value:gpsStats.avgMmin?.toFixed(1),    unit:'',      max:null,              color:'#10b981' },
                    { label:'Sprint Méd.', value:gpsStats.avgSprint?.toFixed(0),  unit:'m',     max:null,              color:'#8b5cf6' },
                    { label:'Player Load', value:gpsStats.avgLoad?.toFixed(0),    unit:'',      max:null,              color:'#06b6d4' },
                    { label:'Vmax Média',  value:gpsStats.avgVmax?.toFixed(1),    unit:'km/h',  max:gpsStats.maxVmax,  color:'#ef4444' },
                  ].map(({ label, value, unit, max, color }) => (
                    <div key={label} style={{ background:'white', border:'1px solid #f1f5f9', borderRadius:8, padding:'7px 9px' }}>
                      <div style={{ fontSize:7, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', color:'#94a3b8' }}>{label}</div>
                      <div style={{ fontSize:15, fontWeight:900, color, lineHeight:1.2, marginTop:2 }}>
                        {value??'—'}<span style={{ fontSize:8, fontWeight:600, color:'#94a3b8', marginLeft:2 }}>{unit}</span>
                      </div>
                      {max && <MiniBar value={parseFloat(value)||0} max={max} color={color} />}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:7, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', color:'#94a3b8', marginBottom:3 }}>Distância — evolução</div>
                <Spark values={distPoints} color="#f59e0b" h={28} w={272} />
              </>
            ) : <div style={{ fontSize:11, color:'#cbd5e1', textAlign:'center', padding:'20px 0' }}>Sem dados GPS</div>}
          </div>

          {/* Wellness */}
          <div style={{ background:'#fafafa', border:'1.5px solid #f1f5f9', borderRadius:12, padding:'12px 14px' }}>
            <SectionTitle accent="#10b981">Bem-estar</SectionTitle>
            {wellStats ? (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:7, marginBottom:10 }}>
                  {[
                    { label:'Score Médio',  value:wellStats.avgWellness?.toFixed(2), color:scoreColor(wellStats.avgWellness), bg:scoreBg(wellStats.avgWellness) },
                    { label:'Sono Médio',   value:wellStats.avgSono?.toFixed(1),     color:'#3b82f6',  bg:'#eff6ff' },
                    { label:'Fadiga Média', value:wellStats.avgFadiga?.toFixed(1),   color:'#ef4444',  bg:'#fef2f2' },
                    { label:'DOMS Médio',   value:wellStats.avgDoms?.toFixed(1),     color:'#f97316',  bg:'#fff7ed' },
                    { label:'Estresse Md.', value:wellStats.avgEstresse?.toFixed(1), color:'#8b5cf6',  bg:'#f5f3ff' },
                    { label:'Dores',        value:wellStats.dores,                   color:wellStats.dores>0?'#dc2626':'#16a34a', bg:wellStats.dores>0?'#fef2f2':'#f0fdf4' },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} style={{ background:bg, borderRadius:8, padding:'7px 9px', border:'1px solid #f1f5f9' }}>
                      <div style={{ fontSize:7, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', color:'#94a3b8' }}>{label}</div>
                      <div style={{ fontSize:15, fontWeight:900, color, lineHeight:1.2, marginTop:2 }}>{value??'—'}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <div>
                    <div style={{ fontSize:7, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', color:'#94a3b8', marginBottom:3 }}>Score wellness</div>
                    <Spark values={wellPoints} color="#f59e0b" h={28} w={120} />
                  </div>
                  <div>
                    <div style={{ fontSize:7, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', color:'#94a3b8', marginBottom:3 }}>Sono</div>
                    <Spark values={sonoPoints} color="#3b82f6" h={28} w={120} />
                  </div>
                </div>
              </>
            ) : <div style={{ fontSize:11, color:'#cbd5e1', textAlign:'center', padding:'20px 0' }}>Sem dados</div>}
          </div>
        </div>

        {/* Tabela de sessões */}
        <div style={{ background:'#fafafa', border:'1.5px solid #f1f5f9', borderRadius:12, padding:'12px 14px', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <SectionTitle>Histórico de Sessões</SectionTitle>
            <span style={{ fontSize:8, fontWeight:700, color:'#94a3b8' }}>{gpsHistory.length} sessões GPS · {wellHistory.length} check-ins</span>
          </div>
          {gpsHistory.length > 0 ? (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:8 }}>
              <thead>
                <tr style={{ background:'#1e293b', color:'white' }}>
                  {['Data','Dist (m)','m/min','HSR','Sprint','ACC+DEC','P.Load','Vmax','%Vmax','ACWR','Wellness','sRPE','UA','Dor'].map(h => (
                    <th key={h} style={{ padding:'4px 6px', textAlign:'left', fontWeight:800, fontSize:7, letterSpacing:'0.06em', textTransform:'uppercase', whiteSpace:'nowrap', borderRight:'1px solid #334155' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...gpsHistory].reverse().map((row, i) => {
                  const dk   = toSortable(row.sessionDate || row._sessionDate)
                  const wRow = wellHistory.find(w => w.date === dk)
                  const sRow = srpeHistory.find(s => s.date === dk)
                  const acwr = acwrMap[dk]
                  const pct  = vmaxMax ? calcVmaxPct(row.maxVelocity, vmaxMax) : null
                  const ws   = wRow?.wellnessScore
                  return (
                    <tr key={i} style={{ background: i%2===0?'white':'#f8fafc', borderBottom:'1px solid #f1f5f9' }}>
                      <td style={{ padding:'3px 6px', fontWeight:700, whiteSpace:'nowrap', borderRight:'1px solid #f1f5f9' }}>{fmtDate(row.sessionDate||row._sessionDate)}</td>
                      <td style={{ padding:'3px 6px', fontWeight:700, borderRight:'1px solid #f1f5f9' }}>{row.totalDistance?.toFixed(0)??'—'}</td>
                      <td style={{ padding:'3px 6px', borderRight:'1px solid #f1f5f9' }}>{row.distanceRelative?.toFixed(1)??'—'}</td>
                      <td style={{ padding:'3px 6px', borderRight:'1px solid #f1f5f9' }}>{row.hsr?.toFixed(0)??'—'}</td>
                      <td style={{ padding:'3px 6px', borderRight:'1px solid #f1f5f9' }}>{row.sprintDistance?.toFixed(0)??'—'}</td>
                      <td style={{ padding:'3px 6px', borderRight:'1px solid #f1f5f9' }}>{((row.acceleration||0)+(row.deceleration||0)).toFixed(0)}</td>
                      <td style={{ padding:'3px 6px', borderRight:'1px solid #f1f5f9' }}>{row.playerLoad?.toFixed(0)??'—'}</td>
                      <td style={{ padding:'3px 6px', borderRight:'1px solid #f1f5f9' }}>{row.maxVelocity?.toFixed(1)??'—'}</td>
                      <td style={{ padding:'3px 6px', fontWeight:700, color:pct>=90?'#16a34a':pct>=80?'#d97706':'#64748b', borderRight:'1px solid #f1f5f9' }}>{pct?`${pct}%`:'—'}</td>
                      <td style={{ padding:'3px 6px', borderRight:'1px solid #f1f5f9' }}>
                        {acwr!=null ? <span style={{ background:acwrBg(acwr), color:acwrColor(acwr), padding:'1px 4px', borderRadius:3, fontWeight:800, fontSize:7 }}>{acwr.toFixed(2)}</span> : '—'}
                      </td>
                      <td style={{ padding:'3px 6px', borderRight:'1px solid #f1f5f9' }}>
                        {ws!=null ? <span style={{ background:scoreBg(ws), color:scoreColor(ws), padding:'1px 4px', borderRadius:3, fontWeight:800, fontSize:7 }}>{ws.toFixed(1)}</span> : '—'}
                      </td>
                      <td style={{ padding:'3px 6px', borderRight:'1px solid #f1f5f9' }}>{sRow?.srpe??'—'}</td>
                      <td style={{ padding:'3px 6px', fontWeight:700, color:'#7c3aed', borderRight:'1px solid #f1f5f9' }}>{sRow?.srpeLoad?.toFixed(0)??'—'}</td>
                      <td style={{ padding:'3px 6px', color:wRow?.temDor?'#dc2626':'#94a3b8', fontWeight:wRow?.temDor?900:400, textAlign:'center' }}>{wRow?.temDor?'⚠':'—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : <div style={{ textAlign:'center', padding:'20px 0', color:'#cbd5e1', fontSize:11 }}>Sem sessões GPS neste período</div>}
        </div>

        {/* sRPE + HSR side-by-side */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div style={{ background:'#fafafa', border:'1.5px solid #f1f5f9', borderRadius:12, padding:'12px 14px' }}>
            <SectionTitle accent="#8b5cf6">Carga Interna — sRPE</SectionTitle>
            {srpeHistory.length > 0 ? (
              <>
                <div style={{ marginBottom:8 }}>
                  <div style={{ fontSize:7, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', color:'#94a3b8', marginBottom:3 }}>Carga UA — evolução</div>
                  <Spark values={loadPoints} color="#8b5cf6" h={28} w={240} />
                </div>
                {srpeHistory.slice(-5).reverse().map((r, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'white', border:'1px solid #f1f5f9', borderRadius:6, padding:'4px 9px', marginBottom:4 }}>
                    <span style={{ fontSize:8, fontWeight:700, color:'#64748b' }}>{r.date}</span>
                    <span style={{ fontSize:8, color:'#475569' }}>sRPE <b>{r.srpe}</b> × {r.duracaoSessao}min</span>
                    <span style={{ fontSize:9, fontWeight:900, color:'#7c3aed' }}>{r.srpeLoad?.toFixed(0)} UA</span>
                  </div>
                ))}
              </>
            ) : <div style={{ fontSize:11, color:'#cbd5e1', textAlign:'center', padding:'16px 0' }}>Sem sRPE</div>}
          </div>

          <div style={{ background:'#fafafa', border:'1.5px solid #f1f5f9', borderRadius:12, padding:'12px 14px' }}>
            <SectionTitle accent="#ef4444">HSR & Velocidade</SectionTitle>
            {gpsStats ? (
              <>
                <div style={{ marginBottom:8 }}>
                  <div style={{ fontSize:7, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', color:'#94a3b8', marginBottom:3 }}>HSR — evolução</div>
                  <Spark values={hsrPoints} color="#3b82f6" h={28} w={240} />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
                  {[
                    { label:'HSR máximo',  value:gpsStats.maxHsr?.toFixed(0),    unit:'m',     color:'#3b82f6' },
                    { label:'Vmax máxima', value:gpsStats.maxVmax?.toFixed(1),   unit:'km/h',  color:'#ef4444' },
                    { label:'Sprint médio',value:gpsStats.avgSprint?.toFixed(0), unit:'m',     color:'#8b5cf6' },
                    { label:'ACC+DEC méd.', value:gpsStats.avgAccDec?.toFixed(0), unit:'',    color:'#f97316' },
                  ].map(({ label, value, unit, color }) => (
                    <div key={label} style={{ background:'white', border:'1px solid #f1f5f9', borderRadius:7, padding:'7px 9px' }}>
                      <div style={{ fontSize:7, fontWeight:800, textTransform:'uppercase', color:'#94a3b8' }}>{label}</div>
                      <div style={{ fontSize:15, fontWeight:900, color, marginTop:2 }}>{value??'—'} <span style={{ fontSize:8, color:'#94a3b8' }}>{unit}</span></div>
                    </div>
                  ))}
                </div>
              </>
            ) : <div style={{ fontSize:11, color:'#cbd5e1', textAlign:'center', padding:'16px 0' }}>Sem GPS</div>}
          </div>
        </div>

        <div style={{ marginTop:14, paddingTop:8, borderTop:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:7, color:'#cbd5e1', fontWeight:600 }}>Fisiologia · Grêmio Novorizontino · {geradoEm}</span>
          <span style={{ fontSize:7, color:'#cbd5e1', fontWeight:600 }}>1 / 2</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════ PÁGINA 2 */}
      <div className="a4-page page-break" style={pageStyle}>
        <div style={headerStripe} />

        {/* Mini header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, paddingBottom:10, borderBottom:'2px solid #f1f5f9' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <img src="/club/escudonovorizontino.png" alt="" style={{ height:30, width:'auto' }} />
            <div>
              <div style={{ fontSize:7, fontWeight:900, letterSpacing:'0.1em', textTransform:'uppercase', color:'#94a3b8' }}>Relatório Individual · Pág. 2</div>
              <div style={{ fontSize:13, fontWeight:900, letterSpacing:'-0.02em', color:'#0f172a' }}>{athleteName}</div>
            </div>
          </div>
          {position && <span style={{ background:'#fef3c7', color:'#92400e', fontSize:8, fontWeight:900, letterSpacing:'0.1em', textTransform:'uppercase', padding:'3px 10px', borderRadius:6, border:'1px solid #fde68a' }}>{position}</span>}
        </div>

        {/* Dores */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
          <div style={{ background:'#fafafa', border:'1.5px solid #f1f5f9', borderRadius:12, padding:'12px 14px' }}>
            <SectionTitle accent="#f97316">Dores Mais Frequentes</SectionTitle>
            {painFreq.length > 0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {painFreq.map(([region, count], i) => {
                  const maxC = painFreq[0][1], pct = (count/maxC)*100
                  const color = pct>66?'#dc2626':pct>33?'#f97316':'#fbbf24'
                  return (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:8, fontWeight:700, color:'#475569', width:150, flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{region.split(' - ').slice(-1)[0]}</span>
                      <div style={{ flex:1, background:'#f1f5f9', borderRadius:99, height:6, overflow:'hidden' }}>
                        <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:99 }} />
                      </div>
                      <span style={{ fontSize:9, fontWeight:900, color, width:22, textAlign:'right', flexShrink:0 }}>{count}×</span>
                    </div>
                  )
                })}
              </div>
            ) : <div style={{ fontSize:11, color:'#cbd5e1', textAlign:'center', padding:'20px 0' }}>Nenhuma dor relatada</div>}
          </div>

          <div style={{ background:'#fafafa', border:'1.5px solid #f1f5f9', borderRadius:12, padding:'12px 14px' }}>
            <SectionTitle accent="#f97316">Histórico de Dores</SectionTitle>
            {dores.length > 0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:220, overflow:'hidden' }}>
                {dores.map((r, i) => (
                  <div key={i} style={{ display:'flex', gap:8, background:'white', border:'1px solid #fee2e2', borderRadius:6, padding:'4px 9px', alignItems:'flex-start' }}>
                    <span style={{ fontSize:7, fontWeight:800, color:'#f97316', whiteSpace:'nowrap', marginTop:1, flexShrink:0 }}>{fmtDate(r.date)}</span>
                    <span style={{ fontSize:8, color:'#475569', fontWeight:500, lineHeight:1.4 }}>{r.dorLocalizada}</span>
                  </div>
                ))}
              </div>
            ) : <div style={{ fontSize:11, color:'#cbd5e1', textAlign:'center', padding:'20px 0' }}>Nenhuma dor no período</div>}
          </div>
        </div>

        {/* CMJ */}
        <div style={{ background:'#fafafa', border:'1.5px solid #f1f5f9', borderRadius:12, padding:'12px 14px', marginBottom:12 }}>
          <SectionTitle accent="#06b6d4">Fadiga — CMJ</SectionTitle>
          {myCmj.length > 0 ? (
            <>
              <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                <KpiCard label="Melhor histórico" value={cmjBest}         unit="cm" bg="#f0f9ff" border="#bae6fd" color="#0369a1" />
                <KpiCard label="Última coleta"    value={cmjLast?.media}  unit="cm" />
                <KpiCard
                  label="Fadiga atual"
                  value={cmjFadiga!=null?`${cmjFadiga>0?'+':''}${cmjFadiga}%`:'—'}
                  bg={cmjFadiga==null?'#f8fafc':cmjFadiga>=-5?'#f0fdf4':cmjFadiga>=-10?'#fef3c7':cmjFadiga>=-15?'#fff7ed':'#fef2f2'}
                  border={cmjFadiga==null?'#e2e8f0':cmjFadiga>=-5?'#bbf7d0':cmjFadiga>=-10?'#fde68a':cmjFadiga>=-15?'#fed7aa':'#fecaca'}
                  color={cmjFadiga==null?'#94a3b8':cmjFadiga>=-5?'#15803d':cmjFadiga>=-10?'#92400e':cmjFadiga>=-15?'#9a3412':'#991b1b'}
                />
                <KpiCard label="Total coletas" value={myCmj.length} />
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:8 }}>
                <thead>
                  <tr style={{ background:'#1e293b', color:'white' }}>
                    {['Data','T1','T2','T3','Média','Ref.','Fadiga','Zona'].map(h=>(
                      <th key={h} style={{ padding:'4px 7px', textAlign:'left', fontWeight:800, fontSize:7, letterSpacing:'0.06em', textTransform:'uppercase', borderRight:'1px solid #334155' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {myCmj.slice(0, 10).map((c, i) => {
                    const p = cmjBest ? Math.round(((c.media-cmjBest)/cmjBest)*1000)/10 : null
                    const zL = p==null?'—':p>=-5?'Normal':p>=-10?'Atenção':p>=-15?'Fadiga Mod.':'Alto Risco'
                    const zC = p==null?'#94a3b8':p>=-5?'#16a34a':p>=-10?'#d97706':p>=-15?'#ea580c':'#dc2626'
                    const zB = p==null?'#f1f5f9':p>=-5?'#dcfce7':p>=-10?'#fef3c7':p>=-15?'#ffedd5':'#fee2e2'
                    return (
                      <tr key={i} style={{ background:i%2===0?'white':'#f8fafc', borderBottom:'1px solid #f1f5f9' }}>
                        <td style={{ padding:'3px 7px', fontWeight:700 }}>{new Date(c.data_coleta).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'})}</td>
                        <td style={{ padding:'3px 7px' }}>{c.salto_1??'—'}</td>
                        <td style={{ padding:'3px 7px' }}>{c.salto_2??'—'}</td>
                        <td style={{ padding:'3px 7px' }}>{c.salto_3??'—'}</td>
                        <td style={{ padding:'3px 7px', fontWeight:900 }}>{c.media} cm</td>
                        <td style={{ padding:'3px 7px', color:'#94a3b8' }}>{cmjBest} cm</td>
                        <td style={{ padding:'3px 7px', fontWeight:900, color:zC }}>{p!=null?`${p>0?'+':''}${p}%`:'—'}</td>
                        <td style={{ padding:'3px 7px' }}><span style={{ background:zB, color:zC, padding:'1px 5px', borderRadius:3, fontWeight:800, fontSize:7 }}>{zL}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          ) : <div style={{ fontSize:11, color:'#cbd5e1', textAlign:'center', padding:'20px 0' }}>Sem coletas CMJ para este atleta</div>}
        </div>

        {/* Observações */}
        <div style={{ background:'#fafafa', border:'1.5px solid #f1f5f9', borderRadius:12, padding:'12px 14px' }}>
          <SectionTitle accent="#94a3b8">Observações</SectionTitle>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ borderBottom:'1px solid #e2e8f0', height:26, marginBottom:4 }} />
          ))}
        </div>

        <div style={{ marginTop:14, paddingTop:8, borderTop:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:7, color:'#cbd5e1', fontWeight:600 }}>Fisiologia · Grêmio Novorizontino · {geradoEm}</span>
          <span style={{ fontSize:7, color:'#cbd5e1', fontWeight:600 }}>2 / 2</span>
        </div>
      </div>
    </>
  )
}

export default function PrintIndividual() {
  return (
    <Suspense fallback={
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', fontFamily:'sans-serif', color:'#94a3b8', fontSize:14, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' }}>
        Preparando relatório...
      </div>
    }>
      <PrintContent />
    </Suspense>
  )
}
