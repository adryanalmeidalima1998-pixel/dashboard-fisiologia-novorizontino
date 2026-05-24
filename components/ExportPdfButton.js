'use client'

import { usePdfExport } from '../hooks/usePdfExport'

/**
 * Botão de exportação PDF.
 * Adicione data-pdf-hide em elementos que não devem aparecer no PDF.
 * Adicione data-pdf-root na div raiz que será capturada.
 */
export default function ExportPdfButton({ filename = 'relatorio', label = 'Exportar PDF' }) {
  const { exportPdf, exporting } = usePdfExport(filename)

  return (
    <button
      onClick={exportPdf}
      disabled={exporting}
      data-pdf-hide
      className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-black
        border border-slate-300 bg-white text-slate-700
        hover:bg-slate-50 hover:border-slate-400
        active:scale-95 disabled:opacity-50 disabled:cursor-wait
        transition-all duration-150
      `}
      title="Exportar como PDF"
    >
      {exporting ? (
        <>
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Preparando...
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          {label}
        </>
      )}
    </button>
  )
}
