'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useMemo, useEffect, Suspense } from 'react'
import { useData, calcVmaxPct } from '../../context/DataContext'

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
function acwrColor(v) {
  if (v == null) return '#64748b'
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

// Sparkline SVG puro
function Spark({ values, color = '#f59e0b', h = 40, w = 180 }) {
  const valid = values.filter(v => v != null && !isNaN(v))
  if (valid.length < 2) return <span style={{ color: '#e2e8f0', fontSize: 9 }}>—</span>
  const min = Math.min(...valid), max = Math.max(...valid), range = max - min || 1
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * w,
    y: v != null ? h - ((v - min) / range) * (h - 10) - 5 : null,
  }))
  const segs = []; let cur = []
  for (const p of pts) {
    if (p.y == null) { if (cur.length) { segs.push(cur); cur = [] } } else cur.push(p)
  }
  if (cur.length) segs.push(cur)
  const last   = pts.filter(p => p.y != null).slice(-1)[0]
  const avgVal = valid.reduce((a, b) => a + b, 0) / valid.length
  const avgY   = h - ((avgVal - min) / range) * (h - 10) - 5

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: w, height: h, display: 'block', overflow: 'visible' }}>
      <line x1={0} y1={avgY} x2={w} y2={avgY} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3,2" />
      {segs.map((seg, si) => (
        <polyline key={si} points={seg.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
          fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {last && <circle cx={last.x} cy={last.y} r="3.5" fill={color} stroke="white" strokeWidth="1.5" />}
    </svg>
  )
}

function Bar({ value, max, color = '#f59e0b', h = 5 }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div style={{ background: '#f1f5f9', borderRadius: 99, height: h, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99 }} />
    </div>
  )
}

function Kpi({ label, value, unit = '', color = '#0f172a', bg = '#f8fafc', border = '#e2e8f0' }) {
  return (
    <div style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 10, padding: '9px 12px' }}>
      <div style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.02em' }}>
        {value ?? '—'}{unit && <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', marginLeft: 2 }}>{unit}</span>}
      </div>
    </div>
  )
}

function SecTitle({ children, accent = '#f59e0b' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
      <div style={{ width: 3, height: 14, background: accent, borderRadius: 2, flexShrink: 0 }} />
      <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#334155' }}>{children}</span>
    </div>
  )
}

// ─── CONTEÚDO ─────────────────────────────────────────────────────────────────
function PrintContent() {
  const searchParams = useSearchParams()
  const athleteName  = searchParams.get('atleta') || ''
  const periodParam  = searchParams.get('periodo') || 'all'

  const { gpsData, bemEstarData, vmaxBaseline, playerPositions, normalizeName } = useData()
  const norm = normalizeName(athleteName)

  const cutoffDate = useMemo(() => {
    if (periodParam === 'all') return null
    const d = new Date(); d.setDate(d.getDate() - parseInt(periodParam))
    return d.toISOString().split('T')[0]
  }, [periodParam])

  // ── Sessões GPS ──────────────────────────────────────────────────────────────
  const gpsSessions = useMemo(() => {
    const result = []
    for (const session of gpsData) {
      const sd = toSortable(session.date)
      if (cutoffDate && sd < cutoffDate) continue
      const row = session.rows.find(
        r => normalizeName(r.playerName) === norm && r.periodNumber === 0 && !r.isOutlier
      )
      if (!row) continue
      result.push({
        date: session.date, sortable: sd, sessionName: session.name,
        totalDistance: row.totalDistance, distanceRelative: row.distanceRelative,
        hsr: row.hsr, sprintDistance: row.sprintDistance, sprintCount: row.sprintCount,
        acceleration: row.acceleration, deceleration: row.deceleration,
        playerLoad: row.playerLoad, maxVelocity: row.maxVelocity, durationMin: row.durationMin,
      })
    }
    return result.sort((a, b) => b.sortable.localeCompare(a.sortable))
  }, [gpsData, norm, cutoffDate, normalizeName])

  // ── Wellness por data (só para cruzar sRPE e dores) ──────────────────────────
  const wellByDate = useMemo(() => {
    const map = {}
    for (const r of bemEstarData) {
      if (normalizeName(r.playerName) !== norm) continue
      if (!map[r.date]) map[r.date] = {}
      if (r.type === 'pre')  map[r.date].pre  = r
      if (r.type === 'post') map[r.date].post = r
    }
    return map
  }, [bemEstarData, norm, normalizeName])

  // ── Histórico de dores (todo o histórico, sem corte de período) ──────────────
  const doresHistorico = useMemo(() =>
    bemEstarData
      .filter(r => normalizeName(r.playerName) === norm && r.type === 'pre' && r.temDor && r.dorLocalizada)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [bemEstarData, norm, normalizeName]
  )

  const painFreq = useMemo(() => {
    const freq = {}
    for (const r of doresHistorico) {
      for (const p of r.dorLocalizada.split(',').map(x => x.trim()).filter(x => x && x !== '0 - Sem dor')) {
        freq[p] = (freq[p] || 0) + 1
      }
    }
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [doresHistorico])

  // ── ACWR por sessão ──────────────────────────────────────────────────────────
  const acwrMap = useMemo(() => {
    const result = {}
    for (const s of gpsSessions) {
      const refDate    = new Date(s.sortable + 'T12:00:00')
      const acuteStart = new Date(refDate); acuteStart.setDate(refDate.getDate() - 6)
      const acute = gpsSessions
        .filter(r => { const d = new Date(r.sortable + 'T12:00:00'); return d >= acuteStart && d <= refDate })
        .reduce((sum, r) => sum + (r.totalDistance || 0), 0)
      const wks = [0, 1, 2, 3].map(w => {
        const wE = new Date(refDate); wE.setDate(refDate.getDate() - w * 7); wE.setHours(23, 59, 59)
        const wS = new Date(refDate); wS.setDate(refDate.getDate() - w * 7 - 6); wS.setHours(0, 0, 0)
        return gpsSessions
          .filter(r => { const d = new Date(r.sortable + 'T12:00:00'); return d >= wS && d <= wE })
          .reduce((sum, r) => sum + (r.totalDistance || 0), 0)
      })
      const chronic  = wks.reduce((a, b) => a + b, 0) / 4
      result[s.sortable] = chronic > 0 ? parseFloat((acute / chronic).toFixed(2)) : null
    }
    return result
  }, [gpsSessions])

  // ── Estatísticas GPS ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!gpsSessions.length) return null
    const v   = k => gpsSessions.map(s => s[k]).filter(x => x != null && x > 0)
    const avg = k => { const a = v(k); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null }
    const max = k => { const a = v(k); return a.length ? Math.max(...a) : null }
    const sum = k => v(k).reduce((s, x) => s + x, 0)
    return {
      sessions:    gpsSessions.length,
      totalDist:   sum('totalDistance'),
      avgDist:     avg('totalDistance'),   maxDist:    max('totalDistance'),
      avgMmin:     avg('distanceRelative'),
      avgHsr:      avg('hsr'),             maxHsr:     max('hsr'),   totalHsr: sum('hsr'),
      avgSprint:   avg('sprintDistance'),  maxSprint:  max('sprintDistance'), totalSprint: sum('sprintDistance'),
      avgLoad:     avg('playerLoad'),      maxLoad:    max('playerLoad'),
      avgVmax:     avg('maxVelocity'),     maxVmax:    max('maxVelocity'),
      avgAccDec:   (() => { const a = gpsSessions.map(s => (s.acceleration||0)+(s.deceleration||0)).filter(x=>x>0); return a.length ? a.reduce((s,x)=>s+x,0)/a.length : null })(),
    }
  }, [gpsSessions])

  const vmaxMax  = vmaxBaseline[athleteName] || null
  const position = playerPositions[athleteName] || null

  const periodoLabel = periodParam === 'all' ? 'Histórico completo' : `Últimos ${periodParam} dias`
  const geradoEm     = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  // Sparklines — ordem cronológica crescente
  const asc        = [...gpsSessions].reverse()
  const distPoints = asc.map(s => s.totalDistance)
  const hsrPoints  = asc.map(s => s.hsr)
  const mminPoints = asc.map(s => s.distanceRelative)
  const loadPoints = asc.map(s => s.playerLoad)
  const vmaxPoints = asc.map(s => s.maxVelocity)
  const acwrPoints = asc.map(s => acwrMap[s.sortable])

  if (!athleteName) return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Atleta não especificado.</div>

  const stripe = { position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: 'linear-gradient(90deg,#f59e0b 0%,#fbbf24 55%,#1e293b 100%)' }
  const page   = { width: 794, background: 'white', padding: '28px 32px', position: 'relative', fontFamily: "'Inter',sans-serif" }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Inter',sans-serif;background:white;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
        @media print{
          @page{size:A4 portrait;margin:0;}
          html,body{width:210mm;}
          .no-print{display:none!important;}
          .pg2{page-break-before:always;}
        }
        @media screen{
          body{background:#94a3b8;padding-bottom:48px;}
          .a4{box-shadow:0 8px 40px rgba(0,0,0,.22);margin:32px auto;}
        }
      `}</style>

      {/* Botões tela */}
      <div className="no-print" style={{ position:'fixed',top:16,right:16,zIndex:9999,display:'flex',gap:8 }}>
        <button onClick={() => window.print()} style={{ background:'#f59e0b',color:'#000',border:'none',borderRadius:8,padding:'10px 22px',fontWeight:900,fontSize:13,cursor:'pointer',textTransform:'uppercase',fontFamily:'Inter,sans-serif' }}>
          🖨️ Salvar PDF
        </button>
        <button onClick={() => window.close()} style={{ background:'#1e293b',color:'#fff',border:'none',borderRadius:8,padding:'10px 16px',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:'Inter,sans-serif' }}>
          ✕ Fechar
        </button>
      </div>

      {/* ════════════════════════ PÁGINA 1 — KPIs + SPARKLINES + TABELA GPS */}
      <div className="a4" style={{ ...page, minHeight: 1123 }}>
        <div style={stripe} />

        {/* Header */}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,paddingBottom:12,borderBottom:'2.5px solid #f1f5f9' }}>
          <div style={{ display:'flex',alignItems:'center',gap:12 }}>
            <img src="/club/escudonovorizontino.png" alt="" style={{ height:44,width:'auto' }} />
            <div>
              <div style={{ fontSize:7,fontWeight:900,letterSpacing:'0.12em',textTransform:'uppercase',color:'#94a3b8',marginBottom:2 }}>Grêmio Novorizontino · Fisiologia</div>
              <div style={{ fontSize:19,fontWeight:900,letterSpacing:'-0.03em',color:'#0f172a',lineHeight:1 }}>Relatório GPS Individual</div>
              <div style={{ fontSize:10,fontWeight:600,color:'#64748b',marginTop:2 }}>{periodoLabel} · {geradoEm}</div>
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:18,fontWeight:900,color:'#0f172a',letterSpacing:'-0.02em',lineHeight:1 }}>{athleteName.split(' ').slice(0,2).join(' ')}</div>
            {position && <div style={{ display:'inline-block',background:'#fef3c7',color:'#92400e',fontSize:8,fontWeight:900,letterSpacing:'0.1em',textTransform:'uppercase',padding:'2px 8px',borderRadius:6,marginTop:4,border:'1px solid #fde68a' }}>{position}</div>}
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(8,1fr)',gap:7,marginBottom:12 }}>
          <Kpi label="Sessões"      value={stats?.sessions}                   color="#0f172a" />
          <Kpi label="Dist. Média"  value={stats?.avgDist?.toFixed(0)}  unit="m"    color="#f59e0b" bg="#fffbeb" border="#fde68a" />
          <Kpi label="m/min Média"  value={stats?.avgMmin?.toFixed(1)}         color="#10b981" bg="#f0fdf4" border="#bbf7d0" />
          <Kpi label="HSR Média"    value={stats?.avgHsr?.toFixed(0)}    unit="m"   color="#3b82f6" bg="#eff6ff" border="#bfdbfe" />
          <Kpi label="Sprint Médio" value={stats?.avgSprint?.toFixed(0)} unit="m"   color="#8b5cf6" bg="#f5f3ff" border="#ddd6fe" />
          <Kpi label="Player Load"  value={stats?.avgLoad?.toFixed(0)}           color="#06b6d4" bg="#ecfeff" border="#a5f3fc" />
          <Kpi label="Vmax Máxima"  value={stats?.maxVmax?.toFixed(1)}   unit="km/h" color="#ef4444" bg="#fef2f2" border="#fecaca" />
          {vmaxMax
            ? <Kpi label="Vmax Baseline" value={vmaxMax.toFixed(1)} unit="km/h" color="#92400e" bg="#fffbeb" border="#fde68a" />
            : <Kpi label="Dist. Total" value={(stats?.totalDist/1000)?.toFixed(1)} unit="km" color="#0f172a" />
          }
        </div>

        {/* Sparklines 2×3 */}
        <div style={{ background:'#fafafa',border:'1.5px solid #f1f5f9',borderRadius:12,padding:'12px 14px',marginBottom:12 }}>
          <SecTitle>Evolução por Métrica — {gpsSessions.length} sessões</SecTitle>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10 }}>
            {[
              { label:'Distância Total (m)', pts:distPoints, color:'#f59e0b', avg:stats?.avgDist,  fmt:v=>v?.toFixed(0) },
              { label:'m/min',               pts:mminPoints, color:'#10b981', avg:stats?.avgMmin,  fmt:v=>v?.toFixed(1) },
              { label:'HSR (m)',             pts:hsrPoints,  color:'#3b82f6', avg:stats?.avgHsr,   fmt:v=>v?.toFixed(0) },
              { label:'Player Load',         pts:loadPoints, color:'#06b6d4', avg:stats?.avgLoad,  fmt:v=>v?.toFixed(0) },
              { label:'Vmax (km/h)',         pts:vmaxPoints, color:'#ef4444', avg:stats?.avgVmax,  fmt:v=>v?.toFixed(1) },
              { label:'ACWR',               pts:acwrPoints, color:'#f97316', avg:null,             fmt:v=>v?.toFixed(2) },
            ].map(({ label, pts, color, avg, fmt }) => {
              const valid = pts.filter(v => v != null && !isNaN(v))
              const last  = valid[valid.length - 1]
              return (
                <div key={label} style={{ background:'white',border:'1px solid #f1f5f9',borderRadius:9,padding:'8px 10px' }}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:5 }}>
                    <div style={{ fontSize:7,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.07em',color:'#94a3b8' }}>{label}</div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:14,fontWeight:900,color,lineHeight:1 }}>{last != null ? fmt(last) : '—'}</div>
                      {avg != null && <div style={{ fontSize:7,color:'#94a3b8',marginTop:1 }}>méd: {fmt(avg)}</div>}
                    </div>
                  </div>
                  <Spark values={pts} color={color} h={36} w={198} />
                </div>
              )
            })}
          </div>
        </div>

        {/* Tabela de sessões */}
        <div style={{ background:'#fafafa',border:'1.5px solid #f1f5f9',borderRadius:12,padding:'12px 14px' }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
            <SecTitle>Todas as Sessões GPS</SecTitle>
            <span style={{ fontSize:8,fontWeight:700,color:'#94a3b8' }}>{gpsSessions.length} sessões · mais recente → mais antiga</span>
          </div>
          {gpsSessions.length > 0 ? (
            <table style={{ width:'100%',borderCollapse:'collapse',fontSize:8 }}>
              <thead>
                <tr style={{ background:'#1e293b' }}>
                  {['Data','Sessão','Dist (m)','m/min','HSR (m)','Sprint (m)','Nº Spr.','ACC+DEC','P.Load','Vmax','%Vmax','ACWR','Wellness','sRPE','UA'].map(h => (
                    <th key={h} style={{ padding:'4px 5px',textAlign:'left',color:'white',fontWeight:800,fontSize:7,letterSpacing:'0.05em',textTransform:'uppercase',borderRight:'1px solid #334155',whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gpsSessions.map((s, i) => {
                  const well = wellByDate[s.sortable]
                  const ws   = well?.pre?.wellnessScore
                  const acwr = acwrMap[s.sortable]
                  const pct  = vmaxMax ? calcVmaxPct(s.maxVelocity, vmaxMax) : null
                  const hasDor = well?.pre?.temDor
                  return (
                    <tr key={i} style={{ background: hasDor ? '#fff7ed' : i % 2 === 0 ? 'white' : '#f8fafc', borderBottom:'1px solid #f1f5f9' }}>
                      <td style={{ padding:'3px 5px',fontWeight:700,whiteSpace:'nowrap',borderRight:'1px solid #f1f5f9',color:'#334155' }}>{fmtDate(s.date)}</td>
                      <td style={{ padding:'3px 5px',fontSize:7,color:'#64748b',borderRight:'1px solid #f1f5f9',maxWidth:72,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{s.sessionName}</td>
                      <td style={{ padding:'3px 5px',fontWeight:800,color:'#f59e0b',borderRight:'1px solid #f1f5f9' }}>{s.totalDistance?.toFixed(0) ?? '—'}</td>
                      <td style={{ padding:'3px 5px',borderRight:'1px solid #f1f5f9',color:'#10b981',fontWeight:600 }}>{s.distanceRelative?.toFixed(1) ?? '—'}</td>
                      <td style={{ padding:'3px 5px',borderRight:'1px solid #f1f5f9',color:'#3b82f6',fontWeight:600 }}>{s.hsr?.toFixed(0) ?? '—'}</td>
                      <td style={{ padding:'3px 5px',borderRight:'1px solid #f1f5f9',color:'#8b5cf6' }}>{s.sprintDistance?.toFixed(0) ?? '—'}</td>
                      <td style={{ padding:'3px 5px',borderRight:'1px solid #f1f5f9' }}>{s.sprintCount ?? '—'}</td>
                      <td style={{ padding:'3px 5px',borderRight:'1px solid #f1f5f9' }}>{((s.acceleration||0)+(s.deceleration||0)).toFixed(0)}</td>
                      <td style={{ padding:'3px 5px',borderRight:'1px solid #f1f5f9',color:'#06b6d4',fontWeight:600 }}>{s.playerLoad?.toFixed(0) ?? '—'}</td>
                      <td style={{ padding:'3px 5px',borderRight:'1px solid #f1f5f9',color:'#ef4444',fontWeight:700 }}>{s.maxVelocity?.toFixed(1) ?? '—'}</td>
                      <td style={{ padding:'3px 5px',fontWeight:800,borderRight:'1px solid #f1f5f9',color:pct>=90?'#16a34a':pct>=80?'#d97706':'#94a3b8' }}>{pct ? `${pct}%` : '—'}</td>
                      <td style={{ padding:'3px 5px',borderRight:'1px solid #f1f5f9' }}>
                        {acwr != null
                          ? <span style={{ background:acwrBg(acwr),color:acwrColor(acwr),padding:'1px 4px',borderRadius:3,fontWeight:800,fontSize:7 }}>{acwr.toFixed(2)}</span>
                          : <span style={{ color:'#cbd5e1' }}>—</span>}
                      </td>
                      <td style={{ padding:'3px 5px',borderRight:'1px solid #f1f5f9' }}>
                        {ws != null
                          ? <span style={{ background:scoreBg(ws),color:scoreColor(ws),padding:'1px 4px',borderRadius:3,fontWeight:800,fontSize:7 }}>{ws.toFixed(1)}</span>
                          : <span style={{ color:'#cbd5e1' }}>—</span>}
                      </td>
                      <td style={{ padding:'3px 5px',borderRight:'1px solid #f1f5f9',color:'#7c3aed' }}>{well?.post?.srpe ?? '—'}</td>
                      <td style={{ padding:'3px 5px',fontWeight:700,color:'#7c3aed' }}>{well?.post?.srpeLoad?.toFixed(0) ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign:'center',padding:'32px 0',color:'#cbd5e1',fontSize:12 }}>Nenhuma sessão GPS neste período</div>
          )}
        </div>

        <div style={{ marginTop:10,paddingTop:8,borderTop:'1px solid #f1f5f9',display:'flex',justifyContent:'space-between' }}>
          <span style={{ fontSize:7,color:'#cbd5e1',fontWeight:600 }}>Fisiologia · Grêmio Novorizontino · {geradoEm}</span>
          <span style={{ fontSize:7,color:'#cbd5e1',fontWeight:600 }}>1 / 2</span>
        </div>
      </div>

      {/* ════════════════════════ PÁGINA 2 — ANÁLISE GPS + DORES */}
      <div className="a4 pg2" style={{ ...page, minHeight: 1123 }}>
        <div style={stripe} />

        {/* Mini header */}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,paddingBottom:10,borderBottom:'2px solid #f1f5f9' }}>
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <img src="/club/escudonovorizontino.png" alt="" style={{ height:30,width:'auto' }} />
            <div>
              <div style={{ fontSize:7,fontWeight:900,letterSpacing:'0.1em',textTransform:'uppercase',color:'#94a3b8' }}>Relatório GPS Individual · Pág. 2</div>
              <div style={{ fontSize:14,fontWeight:900,letterSpacing:'-0.02em',color:'#0f172a' }}>
                {athleteName}
                {position && <span style={{ fontSize:9,fontWeight:700,color:'#92400e',background:'#fef3c7',padding:'1px 6px',borderRadius:5,marginLeft:6,border:'1px solid #fde68a' }}>{position}</span>}
              </div>
            </div>
          </div>
          <div style={{ fontSize:9,fontWeight:700,color:'#94a3b8' }}>{periodoLabel}</div>
        </div>

        {/* Totais acumulados */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14 }}>
          <Kpi label="Distância Total" value={(stats?.totalDist/1000)?.toFixed(1)} unit="km"  color="#f59e0b" bg="#fffbeb" border="#fde68a" />
          <Kpi label="HSR Total"       value={stats?.totalHsr?.toFixed(0)}         unit="m"   color="#3b82f6" bg="#eff6ff" border="#bfdbfe" />
          <Kpi label="Sprint Total"    value={stats?.totalSprint?.toFixed(0)}       unit="m"   color="#8b5cf6" bg="#f5f3ff" border="#ddd6fe" />
          <Kpi label="Sessões"         value={stats?.sessions}                                 color="#0f172a" />
        </div>

        {/* Máximos + Médias vs Máximos */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14 }}>
          {/* Máximos com barra */}
          <div style={{ background:'#fafafa',border:'1.5px solid #f1f5f9',borderRadius:12,padding:'12px 14px' }}>
            <SecTitle accent="#ef4444">Máximos Históricos</SecTitle>
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {[
                { label:'Distância Máxima', value:stats?.maxDist?.toFixed(0),   unit:'m',    max:stats?.maxDist,   color:'#f59e0b' },
                { label:'HSR Máximo',       value:stats?.maxHsr?.toFixed(0),    unit:'m',    max:stats?.maxHsr,    color:'#3b82f6' },
                { label:'Sprint Máximo',    value:stats?.maxSprint?.toFixed(0), unit:'m',    max:stats?.maxSprint, color:'#8b5cf6' },
                { label:'Player Load Máx.', value:stats?.maxLoad?.toFixed(0),   unit:'',     max:stats?.maxLoad,   color:'#06b6d4' },
                { label:'Vmax Máxima',      value:stats?.maxVmax?.toFixed(1),   unit:'km/h', max:null,             color:'#ef4444' },
              ].map(({ label, value, unit, max, color }) => (
                <div key={label}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3 }}>
                    <span style={{ fontSize:8,fontWeight:700,color:'#475569' }}>{label}</span>
                    <span style={{ fontSize:14,fontWeight:900,color }}>
                      {value ?? '—'}<span style={{ fontSize:8,fontWeight:600,color:'#94a3b8',marginLeft:2 }}>{unit}</span>
                    </span>
                  </div>
                  {max && <Bar value={parseFloat(value)||0} max={max} color={color} h={5} />}
                </div>
              ))}
            </div>
          </div>

          {/* Médias vs Máximos */}
          <div style={{ background:'#fafafa',border:'1.5px solid #f1f5f9',borderRadius:12,padding:'12px 14px' }}>
            <SecTitle accent="#10b981">Médias vs Máximos</SecTitle>
            <div style={{ display:'flex',flexDirection:'column',gap:7 }}>
              {[
                { label:'Dist. (m)',    avg:stats?.avgDist,   max:stats?.maxDist,   color:'#f59e0b', d:0 },
                { label:'HSR (m)',      avg:stats?.avgHsr,    max:stats?.maxHsr,    color:'#3b82f6', d:0 },
                { label:'Sprint (m)',   avg:stats?.avgSprint, max:stats?.maxSprint, color:'#8b5cf6', d:0 },
                { label:'m/min',        avg:stats?.avgMmin,   max:null,             color:'#10b981', d:1 },
                { label:'Vmax (km/h)',  avg:stats?.avgVmax,   max:stats?.maxVmax,   color:'#ef4444', d:1 },
              ].map(({ label, avg, max, color, d }) => (
                <div key={label} style={{ background:'white',border:'1px solid #f1f5f9',borderRadius:7,padding:'6px 10px' }}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:max&&avg?3:0 }}>
                    <span style={{ fontSize:8,fontWeight:700,color:'#475569' }}>{label}</span>
                    <div style={{ display:'flex',gap:14,alignItems:'center' }}>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontSize:6,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.06em' }}>Média</div>
                        <div style={{ fontSize:13,fontWeight:900,color }}>{avg!=null?avg.toFixed(d):'—'}</div>
                      </div>
                      {max && <div style={{ textAlign:'center' }}>
                        <div style={{ fontSize:6,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.06em' }}>Máx.</div>
                        <div style={{ fontSize:13,fontWeight:900,color:'#0f172a' }}>{max.toFixed(d)}</div>
                      </div>}
                    </div>
                  </div>
                  {max && avg && <Bar value={avg} max={max} color={color} h={4} />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ACWR zonas */}
        <div style={{ background:'#fafafa',border:'1.5px solid #f1f5f9',borderRadius:12,padding:'12px 14px',marginBottom:14 }}>
          <SecTitle accent="#f97316">ACWR — Zonas de Risco</SecTitle>
          <div style={{ display:'grid',gridTemplateColumns:'1fr auto',gap:16,alignItems:'start' }}>
            <div>
              <div style={{ fontSize:7,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.07em',color:'#94a3b8',marginBottom:4 }}>Evolução ACWR — todas as sessões</div>
              <Spark values={acwrPoints} color="#f97316" h={44} w={400} />
              <div style={{ display:'flex',gap:12,marginTop:5 }}>
                {[{l:'< 0.8 Subcarga',c:'#64748b'},{l:'0.8–1.3 Ideal',c:'#16a34a'},{l:'1.3–1.5 Elevado',c:'#d97706'},{l:'> 1.5 Alto Risco',c:'#dc2626'}].map(z=>(
                  <div key={z.l} style={{ display:'flex',alignItems:'center',gap:4 }}>
                    <div style={{ width:7,height:7,borderRadius:99,background:z.c,flexShrink:0 }} />
                    <span style={{ fontSize:7,fontWeight:700,color:z.c }}>{z.l}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display:'flex',flexDirection:'column',gap:5,minWidth:170 }}>
              {(() => {
                const vals  = Object.values(acwrMap).filter(v => v != null)
                const total = vals.length
                const z     = { ideal:0, elevado:0, risco:0, baixo:0 }
                for (const v of vals) {
                  if (v>=0.8&&v<=1.3) z.ideal++
                  else if (v>1.3&&v<=1.5) z.elevado++
                  else if (v>1.5) z.risco++
                  else z.baixo++
                }
                return [
                  { label:'Ideal (0.8–1.3)',   count:z.ideal,   color:'#16a34a', bg:'#f0fdf4', border:'#bbf7d0' },
                  { label:'Elevado (1.3–1.5)', count:z.elevado, color:'#d97706', bg:'#fffbeb', border:'#fde68a' },
                  { label:'Alto Risco (>1.5)', count:z.risco,   color:'#dc2626', bg:'#fef2f2', border:'#fecaca' },
                  { label:'Subcarga (<0.8)',   count:z.baixo,   color:'#64748b', bg:'#f8fafc', border:'#e2e8f0' },
                ].map(({ label, count, color, bg, border }) => (
                  <div key={label} style={{ background:bg,border:`1px solid ${border}`,borderRadius:7,padding:'5px 10px',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                    <span style={{ fontSize:8,fontWeight:700,color:'#475569' }}>{label}</span>
                    <span style={{ fontSize:16,fontWeight:900,color }}>{count}<span style={{ fontSize:8,color:'#94a3b8',marginLeft:2 }}>/{total}</span></span>
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>

        {/* ── DORES — foco total no histórico ──────────────────────────────── */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14 }}>
          {/* Frequência */}
          <div style={{ background:'#fafafa',border:'1.5px solid #fff1e6',borderRadius:12,padding:'12px 14px' }}>
            <SecTitle accent="#f97316">Dores Mais Frequentes — Histórico completo</SecTitle>
            {painFreq.length > 0 ? (
              <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
                {painFreq.map(([region, count], i) => {
                  const maxC  = painFreq[0][1]
                  const pct   = (count / maxC) * 100
                  const color = pct > 66 ? '#dc2626' : pct > 33 ? '#f97316' : '#fbbf24'
                  const label = region.split(' - ').slice(-1)[0]
                  return (
                    <div key={i} style={{ display:'flex',alignItems:'center',gap:8 }}>
                      <span style={{ fontSize:9,fontWeight:700,color:'#475569',width:148,flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{label}</span>
                      <div style={{ flex:1, background:'#f1f5f9',borderRadius:99,height:7,overflow:'hidden' }}>
                        <div style={{ width:`${pct}%`,height:'100%',background:color,borderRadius:99 }} />
                      </div>
                      <span style={{ fontSize:10,fontWeight:900,color,width:22,textAlign:'right',flexShrink:0 }}>{count}×</span>
                    </div>
                  )
                })}
              </div>
            ) : <div style={{ fontSize:11,color:'#cbd5e1',textAlign:'center',padding:'24px 0' }}>Nenhuma dor relatada</div>}
          </div>

          {/* Histórico cronológico */}
          <div style={{ background:'#fafafa',border:'1.5px solid #fff1e6',borderRadius:12,padding:'12px 14px' }}>
            <SecTitle accent="#f97316">Histórico Cronológico de Dores</SecTitle>
            {doresHistorico.length > 0 ? (
              <div style={{ display:'flex',flexDirection:'column',gap:4,maxHeight:280,overflow:'hidden' }}>
                {doresHistorico.map((r, i) => (
                  <div key={i} style={{ display:'flex',gap:8,background:'white',border:'1px solid #fed7aa',borderRadius:7,padding:'5px 9px',alignItems:'flex-start' }}>
                    <div style={{ flexShrink:0,marginTop:1 }}>
                      <div style={{ fontSize:8,fontWeight:800,color:'#f97316',whiteSpace:'nowrap' }}>{fmtDate(r.date)}</div>
                      {r.wellnessScore != null && (
                        <span style={{ display:'block',background:scoreBg(r.wellnessScore),color:scoreColor(r.wellnessScore),fontSize:7,fontWeight:800,padding:'0px 4px',borderRadius:3,marginTop:1,textAlign:'center' }}>
                          W {r.wellnessScore.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize:8,color:'#475569',fontWeight:500,lineHeight:1.4 }}>{r.dorLocalizada}</span>
                  </div>
                ))}
              </div>
            ) : <div style={{ fontSize:11,color:'#cbd5e1',textAlign:'center',padding:'24px 0' }}>Nenhuma dor no histórico</div>}
          </div>
        </div>

        {/* Observações */}
        <div style={{ background:'#fafafa',border:'1.5px solid #f1f5f9',borderRadius:12,padding:'12px 14px' }}>
          <SecTitle accent="#94a3b8">Observações</SecTitle>
          {[1,2,3,4].map(i=>(
            <div key={i} style={{ borderBottom:'1px solid #e2e8f0',height:26,marginBottom:3 }} />
          ))}
        </div>

        <div style={{ marginTop:10,paddingTop:8,borderTop:'1px solid #f1f5f9',display:'flex',justifyContent:'space-between' }}>
          <span style={{ fontSize:7,color:'#cbd5e1',fontWeight:600 }}>Fisiologia · Grêmio Novorizontino · {geradoEm}</span>
          <span style={{ fontSize:7,color:'#cbd5e1',fontWeight:600 }}>2 / 2</span>
        </div>
      </div>
    </>
  )
}

export default function PrintIndividual() {
  return (
    <Suspense fallback={
      <div style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',fontFamily:'Inter,sans-serif',color:'#94a3b8',fontSize:14,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase' }}>
        Preparando relatório...
      </div>
    }>
      <PrintContent />
    </Suspense>
  )
}
