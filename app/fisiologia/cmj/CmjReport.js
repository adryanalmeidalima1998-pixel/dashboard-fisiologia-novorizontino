'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

// ─── PALETA (hex puro, seguro pro html2canvas) ──────────────────────────────
const GOLD   = '#F5B50A'
const BG     = '#0B0B0C'
const CARD   = '#161618'
const CARD2  = '#1E1E20'
const BORDER = '#2C2C30'
const TXT    = '#FFFFFF'
const TXT2   = '#9CA3AF'
const TXT3   = '#6B7280'

const GREEN  = '#22C55E'
const RED    = '#EF4444'

const ZONE_COLOR = {
  'Normal':          '#22C55E',
  'Atenção':         '#F59E0B',
  'Fadiga Moderada': '#F97316',
  'Alto Risco':      '#EF4444',
}
const ZONE_ORDER = ['Normal', 'Atenção', 'Fadiga Moderada', 'Alto Risco']
const ZONE_RANGE = {
  'Normal': '0 a -5%', 'Atenção': '-5 a -10%', 'Fadiga Moderada': '-10 a -15%', 'Alto Risco': '> -15%',
}

// ─── Agrupamento de posição ─────────────────────────────────────────────────
function posGroup(raw) {
  if (!raw) return 'Sem Posição'
  const p = String(raw).toLowerCase()
  if (/(^gk$|goleir|goalkeep|arqueir)/.test(p)) return 'Goleiros'
  if (/(^zag|zagueir|defend|centre.?back|center.?back|^cb$|^dc$|beque)/.test(p)) return 'Zagueiros'
  if (/(^l[de]$|lateral|full.?back|wing.?back|^fb$|ala\b|^ld$|^le$)/.test(p)) return 'Laterais'
  if (/(^vol|^mc$|^mei$|volant|meia|meio|midfield|^cm$|^dm$|^am$)/.test(p)) return 'Meio-campistas'
  if (/(^p[de]$|^ca$|^ata|atacant|ponta|forward|strik|winger|attack|^cf$|^st$)/.test(p)) return 'Atacantes'
  return 'Outros'
}
const GROUP_ORDER = ['Goleiros', 'Zagueiros', 'Laterais', 'Meio-campistas', 'Atacantes', 'Outros', 'Sem Posição']

function fmtData(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
const first2 = (n) => n.split(' ').slice(0, 2).join(' ')

export default function CmjReport({ comColeta = [], zoneCounts = {}, playerPositions = {} }) {
  const pageRefs = useRef([])
  const donutFaixaRef = useRef(null)
  const barDistRef    = useRef(null)
  const barPosRef     = useRef(null)
  const donutRiscoRef = useRef(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  // ── Dados derivados ────────────────────────────────────────────────────────
  const d = useMemo(() => {
    const validos = comColeta.filter(a => a.ultima?.media != null)
    const ranking = [...validos].sort((a, b) => b.ultima.media - a.ultima.media)
    const medias  = validos.map(a => a.ultima.media)
    const n = medias.length
    const mean = n ? medias.reduce((x, y) => x + y, 0) / n : 0
    const sd = n > 1 ? Math.sqrt(medias.reduce((s, v) => s + (v - mean) ** 2, 0) / n) : 0
    const thrHigh = mean + 0.5 * sd
    const thrLow  = mean - 0.5 * sd

    const faixaOf = (v) => v > thrHigh ? 'acima' : (v < thrLow ? 'abaixo' : 'media')
    const faixaCounts = { acima: 0, media: 0, abaixo: 0 }
    validos.forEach(a => { faixaCounts[faixaOf(a.ultima.media)]++ })

    const maior = ranking[0] || null
    const menor = ranking[n - 1] || null
    const amplitude = maior && menor ? (maior.ultima.media - menor.ultima.media) : 0

    const top5Maiores = ranking.slice(0, 5)
    const top5Menores = ranking.slice(-5).reverse()

    // por posição
    const grupos = {}
    validos.forEach(a => {
      const g = posGroup(playerPositions[a.name])
      if (!grupos[g]) grupos[g] = []
      grupos[g].push(a.ultima.media)
    })
    const posStats = GROUP_ORDER
      .filter(g => grupos[g]?.length)
      .map(g => ({
        grupo: g,
        n: grupos[g].length,
        media: grupos[g].reduce((x, y) => x + y, 0) / grupos[g].length,
      }))
    const temPosicao = posStats.some(p => p.grupo !== 'Sem Posição')

    const alertas = validos.filter(a => a.alert)
    const emRisco = (zoneCounts['Atenção'] ?? 0) + (zoneCounts['Fadiga Moderada'] ?? 0) + (zoneCounts['Alto Risco'] ?? 0)

    // INSIGHTS automáticos
    const insights = []
    if (n) {
      const pctAcima = Math.round(faixaCounts.acima / n * 100)
      insights.push(`${faixaCounts.acima} atleta(s) (${pctAcima}%) acima da média neuromuscular do elenco.`)
    }
    if (faixaCounts.abaixo > 0) {
      insights.push(`${faixaCounts.abaixo} atleta(s) abaixo da média: priorizar força explosiva e pliometria.`)
    }
    if (posStats.length >= 2 && temPosicao) {
      const ord = [...posStats].filter(p => p.grupo !== 'Sem Posição').sort((a, b) => b.media - a.media)
      const alta = ord[0], baixa = ord[ord.length - 1]
      insights.push(`Maior média por posição: ${alta.grupo} (${alta.media.toFixed(1)} cm). Menor: ${baixa.grupo} (${baixa.media.toFixed(1)} cm).`)
    }
    if (maior && menor) {
      insights.push(`Amplitude de ${amplitude.toFixed(1)} cm entre ${first2(maior.name)} (${maior.ultima.media} cm) e ${first2(menor.name)} (${menor.ultima.media} cm).`)
    }
    insights.push(emRisco > 0
      ? `${emRisco} atleta(s) fora da zona Normal de fadiga: ajustar carga e recuperação.`
      : `Elenco 100% em zona Normal de fadiga neuromuscular.`)
    if (alertas.length > 0) {
      insights.push(`${alertas.length} atleta(s) em ALERTA: carga alta (HSR 2D) somada a fadiga elevada.`)
    }

    return {
      validos, ranking, n, mean, sd, thrHigh, thrLow, faixaCounts, faixaOf,
      maior, menor, amplitude, top5Maiores, top5Menores, posStats, temPosicao,
      alertas, emRisco, insights,
    }
  }, [comColeta, zoneCounts, playerPositions])

  // ── Charts ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let charts = []
    let cancelled = false
    ;(async () => {
      const { default: Chart } = await import('chart.js/auto')
      if (cancelled) return
      Chart.defaults.devicePixelRatio = 2
      Chart.defaults.animation = false
      Chart.defaults.responsive = true
      Chart.defaults.maintainAspectRatio = false
      Chart.defaults.font.family = 'Helvetica, Arial, sans-serif'

      // Donut faixa de salto
      if (donutFaixaRef.current) {
        charts.push(new Chart(donutFaixaRef.current, {
          type: 'doughnut',
          data: {
            labels: ['Acima da Média', 'Na Média', 'Abaixo da Média'],
            datasets: [{
              data: [d.faixaCounts.acima, d.faixaCounts.media, d.faixaCounts.abaixo],
              backgroundColor: [GREEN, GOLD, RED], borderColor: BG, borderWidth: 3,
            }],
          },
          options: {
            cutout: '60%',
            plugins: { legend: { position: 'bottom', labels: { color: TXT2, font: { size: 11, weight: 'bold' }, padding: 10, boxWidth: 12, boxHeight: 12 } }, tooltip: { enabled: false } },
          },
        }))
      }

      // Barra distribuição dos saltos por faixa
      if (barDistRef.current) {
        charts.push(new Chart(barDistRef.current, {
          type: 'bar',
          data: {
            labels: [`< ${d.thrLow.toFixed(1)}`, `${d.thrLow.toFixed(1)} - ${d.thrHigh.toFixed(1)}`, `> ${d.thrHigh.toFixed(1)}`],
            datasets: [{ data: [d.faixaCounts.abaixo, d.faixaCounts.media, d.faixaCounts.acima], backgroundColor: [RED, GOLD, GREEN], borderRadius: 6, borderSkipped: false }],
          },
          options: {
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: {
              x: { ticks: { color: TXT2, font: { size: 10, weight: 'bold' } }, grid: { display: false }, border: { color: BORDER } },
              y: { ticks: { color: TXT3, font: { size: 10 }, precision: 0 }, grid: { color: '#202023' }, border: { display: false }, title: { display: true, text: 'Nº de atletas', color: TXT2, font: { size: 10, weight: 'bold' } } },
            },
          },
        }))
      }

      // Barra média por posição
      if (barPosRef.current && d.temPosicao) {
        const ps = d.posStats.filter(p => p.grupo !== 'Sem Posição')
        charts.push(new Chart(barPosRef.current, {
          type: 'bar',
          data: {
            labels: ps.map(p => p.grupo),
            datasets: [{ data: ps.map(p => +p.media.toFixed(1)), backgroundColor: GOLD, borderRadius: 6, borderSkipped: false }],
          },
          options: {
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: {
              x: { ticks: { color: TXT2, font: { size: 10, weight: 'bold' }, maxRotation: 20, minRotation: 0 }, grid: { display: false }, border: { color: BORDER } },
              y: { ticks: { color: TXT3, font: { size: 10 } }, grid: { color: '#202023' }, border: { display: false }, title: { display: true, text: 'CMJ médio (cm)', color: TXT2, font: { size: 10, weight: 'bold' } } },
            },
          },
        }))
      }

      // Donut risco (zonas de fadiga)
      if (donutRiscoRef.current) {
        const labels = ZONE_ORDER.filter(z => (zoneCounts[z] ?? 0) > 0)
        charts.push(new Chart(donutRiscoRef.current, {
          type: 'doughnut',
          data: { labels, datasets: [{ data: labels.map(z => zoneCounts[z]), backgroundColor: labels.map(z => ZONE_COLOR[z]), borderColor: BG, borderWidth: 3 }] },
          options: {
            cutout: '60%',
            plugins: { legend: { position: 'bottom', labels: { color: TXT2, font: { size: 10, weight: 'bold' }, padding: 8, boxWidth: 11, boxHeight: 11 } }, tooltip: { enabled: false } },
          },
        }))
      }
    })()
    return () => { cancelled = true; charts.forEach(c => c.destroy()) }
  }, [d, zoneCounts])

  // ── Export PDF (página por página, sem cortes) ──────────────────────────────
  const exportPDF = async () => {
    const pages = pageRefs.current.filter(Boolean)
    if (!pages.length) return
    setPdfLoading(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const { default: jsPDF } = await import('jspdf')
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()

      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], { backgroundColor: BG, scale: 2, useCORS: true, logging: false, windowWidth: pages[i].scrollWidth })
        const img = canvas.toDataURL('image/png')
        // fit total dentro da página (nada é cortado)
        const scale = Math.min(pageW / canvas.width, pageH / canvas.height)
        const w = canvas.width * scale
        const h = canvas.height * scale
        const x = (pageW - w) / 2
        const y = (pageH - h) / 2
        if (i > 0) pdf.addPage()
        pdf.setFillColor(11, 11, 12)
        pdf.rect(0, 0, pageW, pageH, 'F')
        pdf.addImage(img, 'PNG', x, y, w, h)
      }
      pdf.save(`relatorio-cmj-${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (e) {
      console.error('Erro ao gerar PDF:', e)
      alert('Não foi possível gerar o PDF. Veja o console.')
    } finally {
      setPdfLoading(false)
    }
  }

  if (!d.n) {
    return (
      <div className="py-20 text-center border-2 border-slate-200 rounded-2xl">
        <p className="text-slate-400 text-sm font-black uppercase tracking-widest">Sem coletas para gerar o relatório</p>
        <p className="text-slate-300 text-xs font-bold mt-1">Registre coletas para liberar o relatório visual</p>
      </div>
    )
  }

  // ── estilos inline ─────────────────────────────────────────────────────────
  const PAGE_W = 1320
  const PAGE_H = 934 // A4 paisagem ~ 297x210
  const page   = { width: PAGE_W, minHeight: PAGE_H, background: BG, color: TXT, padding: 28, fontFamily: 'Helvetica, Arial, sans-serif', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }
  const card   = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, boxSizing: 'border-box' }
  const kicker = { fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: TXT3 }
  const chartBox = (h) => ({ position: 'relative', height: h, width: '100%' })
  const faixaColor = (v) => v > d.thrHigh ? GREEN : (v < d.thrLow ? RED : GOLD)
  const faixaLabel = (v) => v > d.thrHigh ? 'Acima' : (v < d.thrLow ? 'Abaixo' : 'Na média')

  const Header = ({ sub }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `3px solid ${GOLD}`, paddingBottom: 14, marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <img src="/club/escudonovorizontino.png" alt="Escudo" style={{ height: 60, width: 'auto' }} crossOrigin="anonymous" />
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 3, color: GOLD, textTransform: 'uppercase' }}>Grêmio Novorizontino · Fisiologia</div>
          <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: -1, lineHeight: 1, textTransform: 'uppercase' }}>Relatório de Fadiga · CMJ</div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: TXT2, textTransform: 'uppercase', marginTop: 3 }}>{sub}</div>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ background: GOLD, color: '#000', padding: '6px 16px', fontWeight: 900, fontSize: 12, textTransform: 'uppercase', fontStyle: 'italic' }}>Emitido em {fmtData(new Date())}</div>
        <div style={{ ...kicker, marginTop: 8 }}>Status mais recente por atleta · {d.n} avaliados</div>
      </div>
    </div>
  )

  const Foot = ({ p }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 12, borderTop: `2px solid ${BORDER}` }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: TXT3, textTransform: 'uppercase' }}>Departamento de Saúde e Performance · CMJ Counter Movement Jump · GPS Catapult integrado</div>
      <div style={{ fontSize: 10, fontWeight: 900, fontStyle: 'italic', color: GOLD, textTransform: 'uppercase' }}>Tigre do Vale · {p}</div>
    </div>
  )

  const maxMedia = d.maior ? d.maior.ultima.media : 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Ação (fora da captura) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: '#94A3B8' }}>
          Pré-visualização · 2 páginas A4 · {d.n} atletas
        </p>
        <button onClick={exportPDF} disabled={pdfLoading}
          style={{ background: GOLD, color: '#000', fontWeight: 900, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', padding: '10px 22px', borderRadius: 12, border: 'none', cursor: pdfLoading ? 'wait' : 'pointer', opacity: pdfLoading ? 0.6 : 1, boxShadow: '0 2px 8px rgba(245,181,10,0.3)' }}>
          {pdfLoading ? 'Gerando PDF...' : '⬇ Exportar PDF'}
        </button>
      </div>

      <div style={{ overflowX: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ═══════════════ PÁGINA 1 · PERFORMANCE NEUROMUSCULAR ═══════════════ */}
        <div ref={el => pageRefs.current[0] = el} style={page}>
          <Header sub="Performance Neuromuscular · Avaliação de Salto Vertical" />

          {/* Resumo geral */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            {[
              { lbl: 'Média do Elenco', val: `${d.mean.toFixed(1)} cm`, sub: 'CMJ médio geral', color: GOLD },
              { lbl: 'Maior Salto', val: d.maior ? `${d.maior.ultima.media} cm` : '-', sub: d.maior ? first2(d.maior.name) : '', color: GREEN },
              { lbl: 'Menor Salto', val: d.menor ? `${d.menor.ultima.media} cm` : '-', sub: d.menor ? first2(d.menor.name) : '', color: RED },
              { lbl: 'Amplitude', val: `${d.amplitude.toFixed(1)} cm`, sub: `Desvio-padrão ${d.sd.toFixed(1)}`, color: TXT },
            ].map((k, i) => (
              <div key={i} style={{ ...card, flex: 1 }}>
                <div style={kicker}>{k.lbl}</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: k.color, lineHeight: 1.1, marginTop: 4 }}>{k.val}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: TXT2, marginTop: 2 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Linha de 3 gráficos */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div style={{ ...card, flex: 1 }}>
              <div style={{ ...kicker, marginBottom: 6 }}>Distribuição de Atletas por Faixa</div>
              <div style={chartBox(220)}><canvas ref={donutFaixaRef} /></div>
            </div>
            <div style={{ ...card, flex: 1 }}>
              <div style={{ ...kicker, marginBottom: 6 }}>Distribuição dos Saltos</div>
              <div style={chartBox(220)}><canvas ref={barDistRef} /></div>
            </div>
            <div style={{ ...card, flex: 1 }}>
              <div style={{ ...kicker, marginBottom: 6 }}>Média de CMJ por Posição</div>
              {d.temPosicao
                ? <div style={chartBox(220)}><canvas ref={barPosRef} /></div>
                : <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: TXT3, fontSize: 12, fontWeight: 700, padding: 12 }}>Posições não disponíveis no GPS deste período</div>}
            </div>
          </div>

          {/* Top5 + Literatura */}
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ ...card, flex: 1 }}>
              <div style={{ ...kicker, marginBottom: 10, color: GREEN }}>Top 5 Maiores Saltos</div>
              {d.top5Maiores.map((a, i) => (
                <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 16, fontWeight: 900, color: TXT3, fontSize: 12 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{first2(a.name)}</span>
                  <div style={{ width: 90, height: 8, background: CARD2, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${(a.ultima.media / maxMedia) * 100}%`, height: '100%', background: GREEN }} />
                  </div>
                  <span style={{ width: 52, textAlign: 'right', fontWeight: 900, fontSize: 12 }}>{a.ultima.media} cm</span>
                </div>
              ))}
            </div>
            <div style={{ ...card, flex: 1 }}>
              <div style={{ ...kicker, marginBottom: 10, color: RED }}>Top 5 Menores Saltos</div>
              {d.top5Menores.map((a, i) => (
                <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 16, fontWeight: 900, color: TXT3, fontSize: 12 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{first2(a.name)}</span>
                  <div style={{ width: 90, height: 8, background: CARD2, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${(a.ultima.media / maxMedia) * 100}%`, height: '100%', background: RED }} />
                  </div>
                  <span style={{ width: 52, textAlign: 'right', fontWeight: 900, fontSize: 12 }}>{a.ultima.media} cm</span>
                </div>
              ))}
            </div>
            <div style={{ ...card, flex: 1.2 }}>
              <div style={{ ...kicker, marginBottom: 8 }}>Classificação Segundo a Literatura</div>
              {[
                { c: GREEN, t: `Acima da média (> ${d.thrHigh.toFixed(1)} cm)`, s: 'Excelente desempenho neuromuscular. Marques et al. (2019), Comfort et al. (2014).' },
                { c: GOLD, t: `Na média (${d.thrLow.toFixed(1)} - ${d.thrHigh.toFixed(1)} cm)`, s: 'Faixa esperada para futebol competitivo. Loturco et al. (2016), Izquierdo et al. (2019).' },
                { c: RED, t: `Abaixo da média (< ${d.thrLow.toFixed(1)} cm)`, s: 'Atenção ao desenvolvimento de força explosiva. Gathercole et al. (2015), Markovic (2007).' },
              ].map((x, i) => (
                <div key={i} style={{ borderLeft: `4px solid ${x.c}`, paddingLeft: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: x.c }}>{x.t}</div>
                  <div style={{ fontSize: 11, color: TXT2, marginTop: 2, lineHeight: 1.35 }}>{x.s}</div>
                </div>
              ))}
            </div>
          </div>

          <Foot p="Página 1 de 2" />
        </div>

        {/* ═══════════════ PÁGINA 2 · RANKING, RISCO E INSIGHTS ═══════════════ */}
        <div ref={el => pageRefs.current[1] = el} style={page}>
          <Header sub="Ranking Completo · Classificação de Risco · Insights" />

          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            {/* Ranking completo em 2 colunas */}
            <div style={{ ...card, flex: 1.6 }}>
              <div style={{ ...kicker, marginBottom: 10 }}>Ranking Completo · Maior para Menor Salto</div>
              <div style={{ display: 'flex', gap: 18 }}>
                {[0, 1].map(col => {
                  const half = Math.ceil(d.ranking.length / 2)
                  const slice = col === 0 ? d.ranking.slice(0, half) : d.ranking.slice(half)
                  const offset = col === 0 ? 0 : half
                  return (
                    <div key={col} style={{ flex: 1 }}>
                      <div style={{ display: 'flex', fontSize: 9, fontWeight: 800, letterSpacing: 1, color: TXT3, textTransform: 'uppercase', paddingBottom: 5, borderBottom: `1px solid ${BORDER}` }}>
                        <div style={{ width: 22 }}>#</div>
                        <div style={{ flex: 1 }}>Atleta</div>
                        <div style={{ width: 46, textAlign: 'right' }}>CMJ</div>
                        <div style={{ width: 64, textAlign: 'right' }}>Faixa</div>
                      </div>
                      {slice.map((a, i) => (
                        <div key={a.name} style={{ display: 'flex', alignItems: 'center', fontSize: 11.5, padding: '4.5px 0', borderBottom: `1px solid ${CARD2}` }}>
                          <div style={{ width: 22, fontWeight: 900, color: TXT3 }}>{offset + i + 1}</div>
                          <div style={{ flex: 1, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{first2(a.name)}</div>
                          <div style={{ width: 46, textAlign: 'right', fontWeight: 900 }}>{a.ultima.media}</div>
                          <div style={{ width: 64, textAlign: 'right', fontWeight: 800, fontSize: 10, color: faixaColor(a.ultima.media) }}>{faixaLabel(a.ultima.media)}</div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Classificação de risco */}
            <div style={{ ...card, flex: 1 }}>
              <div style={{ ...kicker, marginBottom: 8 }}>Classificação de Risco · Fadiga</div>
              <div style={chartBox(170)}><canvas ref={donutRiscoRef} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                {ZONE_ORDER.map(z => (
                  <div key={z} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: CARD2, borderRadius: 8, padding: '6px 10px', borderLeft: `4px solid ${ZONE_COLOR[z]}` }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 800 }}>{z}</span>
                      <span style={{ fontSize: 10, color: TXT3, marginLeft: 6 }}>{ZONE_RANGE[z]}</span>
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 900, color: ZONE_COLOR[z] }}>{zoneCounts[z] ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Insights + Informações importantes */}
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ ...card, flex: 1.3 }}>
              <div style={{ ...kicker, marginBottom: 10, color: GOLD }}>Insights do Relatório</div>
              {d.insights.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 9 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: GOLD, marginTop: 5, flexShrink: 0 }} />
                  <div style={{ fontSize: 12.5, color: '#E5E7EB', lineHeight: 1.4 }}>{t}</div>
                </div>
              ))}
            </div>
            <div style={{ ...card, flex: 1 }}>
              <div style={{ ...kicker, marginBottom: 10 }}>Informações Importantes</div>
              {[
                'Acompanhar a evolução individual nas próximas coletas de CMJ.',
                'Atletas abaixo da média: reforçar força explosiva, pliometria e potência.',
                'Monitorar diariamente a zona de fadiga e reduzir carga em Atenção ou pior.',
                'Cruzar CMJ com HSR e Sprint 2D para decisão de carga individualizada.',
                'Alinhar estratégias de treino e recuperação com a comissão técnica.',
              ].map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 9 }}>
                  <div style={{ color: GOLD, fontWeight: 900, fontSize: 13, lineHeight: 1.2 }}>›</div>
                  <div style={{ fontSize: 12.5, color: '#E5E7EB', lineHeight: 1.4 }}>{t}</div>
                </div>
              ))}
            </div>
          </div>

          <Foot p="Página 2 de 2" />
        </div>
      </div>
    </div>
  )
}
