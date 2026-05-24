import { useState, useCallback } from 'react'

/**
 * Hook de exportação PDF.
 * Captura o elemento referenciado em altíssima resolução e gera um PDF
 * com o layout exato da página, sem quebrar elementos.
 *
 * @param {string} filename — nome do arquivo sem extensão
 */
export function usePdfExport(filename = 'relatorio') {
  const [exporting, setExporting] = useState(false)

  const exportPdf = useCallback(async (ref) => {
    if (!ref?.current) return
    setExporting(true)

    try {
      // Importação dinâmica — não impacta o bundle inicial
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF }   = await import('jspdf')

      const element = ref.current

      // Força scroll para o topo antes de capturar
      const prevScrollY = window.scrollY
      window.scrollTo(0, 0)

      const canvas = await html2canvas(element, {
        scale: 2,                         // 2x = alta resolução
        useCORS: true,                    // imagens externas
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        width:  element.scrollWidth,
        height: element.scrollHeight,
        windowWidth:  element.scrollWidth,
        windowHeight: element.scrollHeight,
        onclone: (clonedDoc) => {
          // Garante que elementos ocultos por overflow não sejam cortados
          const clonedEl = clonedDoc.body.querySelector('[data-pdf-root]')
          if (clonedEl) {
            clonedEl.style.overflow = 'visible'
            clonedEl.style.height   = 'auto'
          }
        },
      })

      window.scrollTo(0, prevScrollY)

      // Dimensões em pontos PDF (escala 0.75 = px → pt)
      const ptWidth  = canvas.width  * 0.75
      const ptHeight = canvas.height * 0.75

      // A4 portrait máximo de largura: 595pt. Se for mais largo usa landscape
      const orientation = ptWidth > 595 ? 'landscape' : 'portrait'
      const pageW = orientation === 'landscape' ? 841.89 : 595.28
      const pageH = orientation === 'landscape' ? 595.28 : 841.89

      const ratio    = pageW / ptWidth           // fator de escala para caber na página
      const imgW     = pageW
      const imgH     = ptHeight * ratio

      const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4' })

      if (imgH <= pageH) {
        // Cabe numa só página
        pdf.addImage(canvas.toDataURL('image/png', 1.0), 'PNG', 0, 0, imgW, imgH)
      } else {
        // Quebra em múltiplas páginas sem cortar no meio de elementos
        let offsetPt = 0
        while (offsetPt < imgH) {
          const sliceH = Math.min(pageH, imgH - offsetPt)
          // Calcula slice do canvas em pixels
          const slicePx   = (sliceH / ratio) / 0.75
          const offsetPx  = (offsetPt / ratio) / 0.75

          const sliceCanvas  = document.createElement('canvas')
          sliceCanvas.width  = canvas.width
          sliceCanvas.height = Math.ceil(slicePx)
          const ctx = sliceCanvas.getContext('2d')
          ctx.drawImage(canvas, 0, -offsetPx)

          if (offsetPt > 0) pdf.addPage()
          pdf.addImage(sliceCanvas.toDataURL('image/png', 1.0), 'PNG', 0, 0, imgW, sliceH)
          offsetPt += sliceH
        }
      }

      pdf.save(`${filename}.pdf`)
    } catch (err) {
      console.error('[usePdfExport] Erro ao gerar PDF:', err)
      alert('Erro ao gerar PDF. Tente novamente.')
    } finally {
      setExporting(false)
    }
  }, [filename])

  return { exportPdf, exporting }
}
