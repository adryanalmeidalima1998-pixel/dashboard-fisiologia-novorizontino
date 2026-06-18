'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

// ─── PALETA (hex puro, sem oklch — seguro pro html2canvas) ──────────────────
const GOLD   = '#F5B50A'
const BG     = '#0B0B0C'
const CARD   = '#161618'
const CARD2  = '#1E1E20'
const BORDER = '#2C2C30'
const TXT    = '#FFFFFF'
const TXT2   = '#9CA3AF'
const TXT3   = '#6B7280'

const ZONE_COLOR = {
  'Normal':          '#22C55E',
  'Atenção':         '#F59E0B',
  'Fadiga Moderada': '#F97316',
  'Alto Risco':      '#EF4444',
}
const ZONE_ORDER = ['Normal', 'Atenção', 'Fadiga Moderada', 'Alto Risco']

function fmtData(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function CmjReport({ comColeta = [], zoneCounts = {} }) {
  const reportRef  = useRef(null)
  const donutRef   = useRef(null)
  const barRef     = useRef(null)
  const topRef     = useRef(null)
  const scatterRef = useRef(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  // ── Dados derivados ────────────────────────────────────────────────────────
  const dados = useMemo(() => {
    const validos = comColeta.filter(a => a.ultima?.media != null)
    const ranking = [...validos].sort((a, b) => b.ultima.media - a.ultima.media)
    const medias  = validos.map(a => a.ultima.media)
    const mediaElenco = medias.length ? medias.reduce((x, y) => x + y, 0) / medias.length : 0

    const maior = ranking[0] || null
    const menor = ranking[ranking.length - 1] || null

    const top5Maiores = ranking.slice(0, 5)
    const top5Menores = ranking.slice(-5).reverse()

    const scatter = validos
      .filter(a => a.gps2d && a.pct != null)
      .map(a => ({ x: a.pct, y: a.gps2d.hsr, label: a.name, zone: a.zone?.label, alert: a.alert }))

    const alertas = validos.filter(a => a.alert)

    return { validos, ranking, mediaElenco, maior, menor, top5Maiores, top5Menores, scatter, alertas }
  }, [comColeta])

  const totalAval = dados.validos.length

  // ── Charts ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let charts = []
    let cancelled = false

    ;(async () => {
      const { default: Chart } = await import('chart.js/auto')
      if (cancelled) return

      const baseFont = { family: 'Helvetica, Arial, sans-serif' }
      Chart.defaults.devicePixelRatio = 2
      Chart.defaults.animation = false
      Chart.defaults.responsive = true
      Chart.defaults.maintainAspectRatio = false
      Chart.defaults.font.family = baseFont.family

      // 1) DONUT — distribuição por zona
      if (donutRef.current) {
        const labels = ZONE_ORDER.filter(z => (zoneCounts[z] ?? 0) > 0)
        const data   = labels.map(z => zoneCounts[z])
        const colors = labels.map(z => ZONE_COLOR[z])
        charts.push(new Chart(donutRef.current, {
          type: 'doughnut',
          data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: BG, borderWidth: 3, hoverOffset: 0 }] },
          options: {
            cutout: '62%',
            plugins: {
              legend: {
                position: 'bottom',
                labels: { color: TXT2, font: { size: 11, weight: 'bold' }, padding: 12, boxWidth: 12, boxHeight: 12 },
              },
              tooltip: { enabled: false },
            },
          },
        }))
      }

      // 2) BARRA VERTICAL — ranking de CMJ (média) por atleta
      if (barRef.current) {
        const rk = dados.ranking.slice(0, 18)
        charts.push(new Chart(barRef.current, {
          type: 'bar',
          data: {
            labels: rk.map(a => a.name.split(' ')[0]),
            datasets: [{
              data: rk.map(a => a.ultima.media),
              backgroundColor: rk.map(a => ZONE_COLOR[a.zone?.label] || GOLD),
              borderRadius: 4,
              borderSkipped: false,
            }],
          },
          options: {
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: {
              x: { ticks: { color: TXT3, font: { size: 9, weight: 'bold' }, maxRotation: 60, minRotation: 60 }, grid: { display: false }, border: { color: BORDER } },
              y: { ticks: { color: TXT3, font: { size: 10 } }, grid: { color: '#202023' }, border: { display: false }, title: { display: true, text: 'CMJ (cm)', color: TXT2, font: { size: 10, weight: 'bold' } } },
            },
          },
        }))
      }

      // 3) BARRA HORIZONTAL — Top 5 maiores x menores saltos
      if (topRef.current) {
        const maiores = dados.top5Maiores
        const menores = dados.top5Menores
        const labels = [
          ...maiores.map(a => a.name.split(' ')[0]),
          ...menores.map(a => a.name.split(' ')[0]),
        ]
        const vals = [...maiores.map(a => a.ultima.media), ...menores.map(a => a.ultima.media)]
        const cols = [...maiores.map(() => '#22C55E'), ...menores.map(() => '#EF4444')]
        charts.push(new Chart(topRef.current, {
          type: 'bar',
          data: { labels, datasets: [{ data: vals, backgroundColor: cols, borderRadius: 4, borderSkipped: false }] },
          options: {
            indexAxis: 'y',
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: {
              x: { ticks: { color: TXT3, font: { size: 9 } }, grid: { color: '#202023' }, border: { display: false } },
              y: { ticks: { color: TXT2, font: { size: 10, weight: 'bold' } }, grid: { display: false }, border: { color: BORDER } },
            },
          },
        }))
      }

      // 4) DISPERSÃO — Fadiga (%) x Carga HSR 2D
      if (scatterRef.current && dados.scatter.length) {
        charts.push(new Chart(scatterRef.current, {
          type: 'scatter',
          data: {
            datasets: [{
              data: dados.scatter,
              pointBackgroundColor: dados.scatter.map(p => ZONE_COLOR[p.zone] || GOLD),
              pointBorderColor: dados.scatter.map(p => p.alert ? '#FFFFFF' : 'transparent'),
              pointBorderWidth: dados.scatter.map(p => p.alert ? 2 : 0),
              pointRadius: dados.scatter.map(p => p.alert ? 7 : 5),
            }],
          },
          options: {
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: {
              x: { ticks: { color: TXT3, font: { size: 10 } }, grid: { color: '#202023' }, border: { color: BORDER }, title: { display: true, text: 'Fadiga (%)', color: TXT2, font: { size: 10, weight: 'bold' } } },
              y: { ticks: { color: TXT3, font: { size: 10 } }, grid: { color: '#202023' }, border: { color: BORDER }, title: { display: true, text: 'HSR 2D (m)', color: TXT2, font: { size: 10, weight: 'bold' } } },
            },
          },
        }))
      }
    })()

    return () => { cancelled = true; charts.forEach(c => c.destroy()) }
  }, [comColeta, zoneCounts, dados])

  // ── Export PDF ───────────────────────────────────────────────────────────
  const exportPDF = async () => {
    if (!reportRef.current) return
    setPdfLoading(true)
    try {
      const html2canvas   = (await import('html2canvas')).default
      const { default: jsPDF } = await import('jspdf')

      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: BG,
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: reportRef.current.scrollWidth,
      })

      const pdf   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const imgW  = pageW
      const imgH  = (canvas.height * imgW) / canvas.width
      const img   = canvas.toDataURL('image/png')

      if (imgH <= pageH) {
        pdf.addImage(img, 'PNG', 0, 0, imgW, imgH)
      } else {
        // paginação por fatias verticais
        let heightLeft = imgH
        let position   = 0
        pdf.addImage(img, 'PNG', 0, position, imgW, imgH)
        heightLeft -= pageH
        while (heightLeft > 0) {
          position -= pageH
          pdf.addPage()
          pdf.addImage(img, 'PNG', 0, position, imgW, imgH)
          heightLeft -= pageH
        }
      }
      pdf.save(`relatorio-cmj-${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (e) {
      console.error('Erro ao gerar PDF:', e)
      alert('Não foi possível gerar o PDF. Veja o console.')
    } finally {
      setPdfLoading(false)
    }
  }

  // ── Estado vazio ───────────────────────────────────────────────────────────
  if (!totalAval) {
    return (
      <div className="py-20 text-center border-2 border-slate-200 rounded-2xl">
        <p className="text-slate-400 text-sm font-black uppercase tracking-widest">Sem coletas para gerar o relatório</p>
        <p className="text-slate-300 text-xs font-bold mt-1">Registre coletas para liberar o relatório visual</p>
      </div>
    )
  }

  // ── helpers de estilo inline ───────────────────────────────────────────────
  const card   = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16 }
  const kicker  = { fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: TXT3 }
  const chartBox = (h) => ({ position: 'relative', height: h, width: '100%' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Barra de ação (fora da captura) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: '#94A3B8' }}>
          Pré-visualização do relatório · {totalAval} atletas
        </p>
        <button
          onClick={exportPDF}
          disabled={pdfLoading}
          style={{
            background: GOLD, color: '#000', fontWeight: 900, fontSize: 12, letterSpacing: 1,
            textTransform: 'uppercase', padding: '10px 22px', borderRadius: 12, border: 'none',
            cursor: pdfLoading ? 'wait' : 'pointer', opacity: pdfLoading ? 0.6 : 1,
            display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 8px rgba(245,181,10,0.3)',
          }}
        >
          {pdfLoading ? 'Gerando PDF...' : '⬇ Exportar PDF'}
        </button>
      </div>

      {/* Wrapper com scroll horizontal pra preview; o PDF sai inteiro */}
      <div style={{ overflowX: 'auto', borderRadius: 16 }}>
        {/* ====== PÔSTER CAPTURADO ====== */}
        <div ref={reportRef} style={{ width: 1320, background: BG, color: TXT, padding: 28, fontFamily: 'Helvetica, Arial, sans-serif' }}>

          {/* HEADER */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `3px solid ${GOLD}`, paddingBottom: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <img src="/club/escudonovorizontino.png" alt="Escudo" style={{ height: 64, width: 'auto' }} crossOrigin="anonymous" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 3, color: GOLD, textTransform: 'uppercase' }}>Grêmio Novorizontino · Fisiologia</div>
                <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1, lineHeight: 1, textTransform: 'uppercase' }}>Relatório de Fadiga · CMJ</div>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, color: TXT2, textTransform: 'uppercase', marginTop: 4 }}>Counter Movement Jump · Monitoramento Neuromuscular</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ background: GOLD, color: '#000', padding: '6px 16px', fontWeight: 900, fontSize: 12, textTransform: 'uppercase', fontStyle: 'italic' }}>Emitido em {fmtData(new Date())}</div>
              <div style={{ ...kicker, marginTop: 8, color: TXT3 }}>Status mais recente por atleta</div>
            </div>
          </div>

          {/* KPIs */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            {[
              { lbl: 'Média do Elenco', val: `${dados.mediaElenco.toFixed(1)} cm`, sub: 'CMJ médio', color: GOLD },
              { lbl: 'Maior Salto', val: dados.maior ? `${dados.maior.ultima.media} cm` : '-', sub: dados.maior?.name || '', color: '#22C55E' },
              { lbl: 'Menor Salto', val: dados.menor ? `${dados.menor.ultima.media} cm` : '-', sub: dados.menor?.name || '', color: '#EF4444' },
              { lbl: 'Atletas Avaliados', val: String(totalAval), sub: 'com coleta', color: TXT },
            ].map((k, i) => (
              <div key={i} style={{ ...card, flex: 1 }}>
                <div style={kicker}>{k.lbl}</div>
                <div style={{ fontSize: 38, fontWeight: 900, color: k.color, lineHeight: 1.1, marginTop: 4 }}>{k.val}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: TXT2, marginTop: 2 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* GRID PRINCIPAL: esquerda (charts) + direita (ranking) */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>

            {/* COLUNA ESQUERDA */}
            <div style={{ flex: '1 1 0', display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

              {/* Linha: Donut + Top5 */}
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ ...card, flex: 1 }}>
                  <div style={{ ...kicker, marginBottom: 8 }}>Distribuição por Zona de Fadiga</div>
                  <div style={chartBox(230)}><canvas ref={donutRef} /></div>
                </div>
                <div style={{ ...card, flex: 1 }}>
                  <div style={{ ...kicker, marginBottom: 8 }}>Top 5 Maiores e Menores</div>
                  <div style={chartBox(230)}><canvas ref={topRef} /></div>
                </div>
              </div>

              {/* Ranking em barras */}
              <div style={card}>
                <div style={{ ...kicker, marginBottom: 8 }}>Ranking de CMJ por Atleta</div>
                <div style={chartBox(240)}><canvas ref={barRef} /></div>
              </div>

              {/* Dispersão */}
              <div style={card}>
                <div style={{ ...kicker, marginBottom: 8 }}>Dispersão · Fadiga (%) x Carga HSR 2D</div>
                {dados.scatter.length
                  ? <div style={chartBox(220)}><canvas ref={scatterRef} /></div>
                  : <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TXT3, fontSize: 12, fontWeight: 700 }}>Sem dados de GPS cruzados com coletas</div>}
                <div style={{ fontSize: 10, color: TXT3, marginTop: 6 }}>Pontos com borda branca = alerta (carga alta + fadiga)</div>
              </div>
            </div>

            {/* COLUNA DIREITA: ranking tabela */}
            <div style={{ ...card, width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ ...kicker, marginBottom: 10 }}>Ranking Completo</div>
              <div style={{ display: 'flex', fontSize: 9, fontWeight: 800, letterSpacing: 1, color: TXT3, textTransform: 'uppercase', paddingBottom: 6, borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ width: 26 }}>#</div>
                <div style={{ flex: 1 }}>Atleta</div>
                <div style={{ width: 56, textAlign: 'right' }}>CMJ</div>
                <div style={{ width: 56, textAlign: 'right' }}>Fadiga</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {dados.ranking.map((a, i) => (
                  <div key={a.name} style={{ display: 'flex', alignItems: 'center', fontSize: 12, padding: '6px 0', borderBottom: `1px solid ${CARD2}` }}>
                    <div style={{ width: 26, fontWeight: 900, color: TXT3 }}>{i + 1}</div>
                    <div style={{ flex: 1, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                    <div style={{ width: 56, textAlign: 'right', fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{a.ultima.media}</div>
                    <div style={{ width: 56, textAlign: 'right', fontWeight: 900, color: ZONE_COLOR[a.zone?.label] || TXT2, fontVariantNumeric: 'tabular-nums' }}>
                      {a.pct != null ? `${a.pct > 0 ? '+' : ''}${a.pct}%` : '-'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RODAPÉ: zonas + alertas */}
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ ...card, flex: 2 }}>
              <div style={{ ...kicker, marginBottom: 10 }}>Classificação por Zona</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {ZONE_ORDER.map(z => (
                  <div key={z} style={{ flex: 1, background: CARD2, borderRadius: 10, padding: 10, borderLeft: `4px solid ${ZONE_COLOR[z]}` }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: ZONE_COLOR[z], lineHeight: 1 }}>{zoneCounts[z] ?? 0}</div>
                    <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', marginTop: 4 }}>{z}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ ...card, flex: 1, borderColor: dados.alertas.length ? '#EF4444' : BORDER }}>
              <div style={{ ...kicker, marginBottom: 8, color: dados.alertas.length ? '#EF4444' : TXT3 }}>
                Alertas · Carga Alta + Fadiga
              </div>
              {dados.alertas.length === 0
                ? <div style={{ fontSize: 13, fontWeight: 700, color: '#22C55E' }}>Nenhum atleta em alerta</div>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {dados.alertas.slice(0, 6).map(a => (
                      <div key={a.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
                        <span>{a.name}</span>
                        <span style={{ color: '#EF4444', fontWeight: 900 }}>{a.pct}% · {a.gps2d?.hsr?.toLocaleString('pt-BR')} m</span>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>

          {/* assinatura */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, paddingTop: 12, borderTop: `2px solid ${BORDER}` }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: TXT3, textTransform: 'uppercase' }}>
              Departamento de Saúde e Performance · Baseline automático · GPS Catapult integrado
            </div>
            <div style={{ fontSize: 10, fontWeight: 900, fontStyle: 'italic', color: GOLD, textTransform: 'uppercase' }}>Tigre do Vale · Confidencial</div>
          </div>
        </div>
      </div>
    </div>
  )
}
