'use client'

import { usePdfExport } from '../hooks/usePdfExport'

/**
 * Botão de exportação PDF plug-and-play.
 *
 * Props:
 *   contentRef  — React ref do elemento a capturar
 *   filename    — nome do arquivo sem extensão (default: 'relatorio')
 *   label       — texto do botão (default: 'Exportar PDF')
 */
export default function ExportPdfButton({ contentRef, filename = 'relatorio', label = 'Exportar PDF' }) {
  const { exportPdf, exporting } = usePdfExport(filename)

  return (
    <button
      onClick={() => exportPdf(contentRef)}
      disabled={exporting}
      className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-black
        border border-slate-300 bg-white text-slate-700
        hover:bg-slate-50 hover:border-slate-400
        active:scale-95
        disabled:opacity-50 disabled:cursor-wait
        transition-all duration-150
      `}
      title="Exportar página como PDF"
    >
      {exporting ? (
        <>
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Gerando...
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          {label}
        </>
      )}
    </button>
  )
}
