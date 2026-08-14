import { useState } from "react";
import { X, FileText, Download, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

/**
 * Visualizador Interno Universal de Mídia & Documentos (Imagens e PDFs)
 * Permite visualizar qualquer imagem ou PDF diretamente na interface sem abrir novas abas ou baixar arquivos.
 */
export default function MediaViewerModal({ isOpen, file, onClose }) {
  const [zoom, setZoom] = useState(1);

  if (!isOpen || !file) return null;

  const isImage = file.type?.includes("image") || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(file.url || file.name || "");
  const isPdf = file.type?.includes("pdf") || /\.pdf$/i.test(file.url || file.name || "");

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setZoom(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 sm:p-6 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col h-[90vh]">

        {/* Modal Header */}
        <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
              {isImage ? <ZoomIn size={18} /> : <FileText size={18} />}
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-white text-sm truncate" title={file.name}>
                {file.name || "Visualizar Anexo"}
              </h3>
              <p className="text-[11px] font-semibold text-slate-400">
                Visualizador Interno {isImage ? "de Imagem" : isPdf ? "de PDF" : "de Documento"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Controls for Images */}
            {isImage && (
              <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700 mr-2">
                <button
                  onClick={handleZoomOut}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  title="Reduzir Zoom"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="text-xs font-mono font-bold text-slate-400 px-1.5">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  title="Aumentar Zoom"
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  onClick={handleResetZoom}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  title="Resetar Zoom"
                >
                  <Maximize2 size={14} />
                </button>
              </div>
            )}

            {/* Direct Download option */}
            <a
              href={file.url}
              download={file.name}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
              title="Download do Arquivo Original"
            >
              <Download size={18} />
            </a>

            {/* Close Modal */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body / Viewer */}
        <div className="flex-1 bg-slate-950 overflow-auto flex items-center justify-center p-4 relative select-none">
          {isImage ? (
            <div className="overflow-auto max-w-full max-h-full flex items-center justify-center transition-all">
              <img
                src={file.url}
                alt={file.name}
                style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-2xl transition-transform duration-200"
              />
            </div>
          ) : isPdf ? (
            <iframe
              src={`${file.url}#toolbar=1`}
              title={file.name}
              className="w-full h-full rounded-xl border border-slate-800 bg-white"
            />
          ) : (
            <div className="text-center text-slate-400 space-y-3">
              <FileText size={48} className="mx-auto text-slate-600" />
              <p className="font-bold text-slate-300">Pré-visualização indisponível para este formato</p>
              <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold text-xs"
              >
                Abrir Arquivo <Download size={14} />
              </a>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
