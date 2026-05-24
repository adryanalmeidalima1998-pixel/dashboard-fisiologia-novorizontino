import { useState, useCallback } from 'react'

/**
 * Exporta a página como PDF usando window.print() com CSS injetado.
 * Não requer nenhuma dependência adicional.
 */
export function usePdfExport(filename = 'relatorio') {
  const [exporting, setExporting] = useState(false)

  const exportPdf = useCallback(() => {
    setExporting(true)

    // Muda o título do documento para nomear o arquivo no Save As do browser
    const prevTitle = document.title
    document.title = filename

    const styleId = '__pdf_print_override'
    const existing = document.getElementById(styleId)
    if (existing) existing.remove()

    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      @media print {
        /* Preservar cores exatas */
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }

        /* Página em A4 landscape para caber dashboards largos */
        @page {
          size: A4 landscape;
          margin: 8mm 10mm;
        }

        /* Esconder a sidebar */
        body > div > div:first-child,
        nav, aside,
        [data-sidebar] {
          display: none !important;
        }

        /* Main ocupa 100% */
        body > div > main,
        body > div > div:last-child {
          width: 100% !important;
          overflow: visible !important;
          height: auto !important;
          max-height: none !important;
        }

        /* Esconder elementos que não devem ir pro PDF */
        [data-pdf-hide] {
          display: none !important;
        }

        /* Evitar corte de cards e blocos */
        [data-pdf-root] > * {
          break-inside: avoid;
        }

        /* Forçar altura auto nos containers com scroll */
        [data-pdf-root],
        [data-pdf-root] * {
          overflow: visible !important;
          max-height: none !important;
          height: auto !important;
        }

        /* Manter o fundo branco da página */
        body, html {
          background: white !important;
        }
      }
    `
    document.head.appendChild(style)

    // Pequeno delay para o CSS ser aplicado antes de imprimir
    setTimeout(() => {
      window.print()

      // Cleanup após o diálogo de impressão fechar
      setTimeout(() => {
        const s = document.getElementById(styleId)
        if (s) s.remove()
        document.title = prevTitle
        setExporting(false)
      }, 500)
    }, 200)
  }, [filename])

  return { exportPdf, exporting }
}
