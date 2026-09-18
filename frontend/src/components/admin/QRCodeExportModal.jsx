import { useState, useEffect, useRef } from "react";
import { 
  X, Download, Printer, Wifi, Laptop, CheckCircle2, 
  Sparkles, Sliders, Layers, ArrowDownToLine, RefreshCw, ExternalLink 
} from "lucide-react";
import { formatWifiPayload, formatEquipmentPayload, renderQRCodeToCanvas } from "../../utils/qrGenerator";

export default function QRCodeExportModal({ isOpen, onClose, item, defaultLogoUrl }) {
  const [downloadSize, setDownloadSize] = useState(1024); // 256 | 512 | 1024 | 2048
  const [exporting, setExporting] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [printMode, setPrintMode] = useState(false);

  const previewCanvasRef = useRef(null);
  const exportCanvasRef = useRef(null);

  const isWifi = item?.type === "wifi";

  // Gera o texto bruto a ser codificado no QR
  const getPayloadText = () => {
    if (!item) return "";
    if (isWifi) {
      return formatWifiPayload(item.ssid, item.password, item.security_type, item.is_hidden);
    }
    return formatEquipmentPayload(item);
  };

  // Renderiza preview em tela
  useEffect(() => {
    if (!isOpen || !item || !previewCanvasRef.current) return;

    setPreviewLoaded(false);
    const text = getPayloadText();
    const logoToUse = item.logo_url || defaultLogoUrl;

    renderQRCodeToCanvas(previewCanvasRef.current, {
      text,
      size: 320,
      logoUrl: logoToUse,
      includeLogo: item.include_logo !== false,
    }).then(() => {
      setPreviewLoaded(true);
    });
  }, [isOpen, item, defaultLogoUrl]);

  // Função para download no tamanho selecionado
  const handleDownload = async () => {
    if (!item || !exportCanvasRef.current) return;

    setExporting(true);
    try {
      const text = getPayloadText();
      const logoToUse = item.logo_url || defaultLogoUrl;

      await renderQRCodeToCanvas(exportCanvasRef.current, {
        text,
        size: downloadSize,
        logoUrl: logoToUse,
        includeLogo: item.include_logo !== false,
      });

      // Gera download
      const dataUrl = exportCanvasRef.current.toDataURL("image/png");
      const safeTitle = (item.title || "qrcode").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
      const filename = `qrcode_${safeTitle}_${downloadSize}px.png`;

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Erro ao exportar QR Code:", err);
    } finally {
      setExporting(false);
    }
  };

  // Função para imprimir Display de Mesa / Placa
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      
      {/* Estilos específicos para Impressão limpa de Display de Mesa */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-qr-placard, #printable-qr-placard * {
            visibility: visible;
          }
          #printable-qr-placard {
            position: fixed;
            left: 0;
            top: 0;
            width: 100vw;
            height: 100vh;
            display: flex !important;
            align-items: center;
            justify-content: center;
            background: white !important;
            padding: 40px;
          }
        }
      `}</style>

      {/* Elemento Oculto de Impressão de Display de Mesa */}
      <div id="printable-qr-placard" className="hidden">
        <div className="border-4 border-slate-900 rounded-3xl p-10 max-w-md w-full text-center flex flex-col items-center">
          <div className="mb-4">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
              {item.company || "Hotel Fasano Salvador"}
            </h1>
            <p className="text-sm font-bold text-slate-500 mt-0.5">
              {isWifi ? "Acesso à Rede Wi-Fi de Eventos" : "Identificação e Ficha Técnica"}
            </p>
          </div>

          <div className="p-3 bg-white border-2 border-slate-200 rounded-2xl my-4">
            <canvas ref={previewCanvasRef} className="w-[280px] h-[280px]" />
          </div>

          {isWifi ? (
            <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-1.5 mt-2">
              <p className="text-xs font-bold text-slate-500 uppercase">Rede Wi-Fi (SSID):</p>
              <p className="text-lg font-black text-slate-900 font-mono">{item.ssid}</p>
              {item.password && (
                <>
                  <p className="text-xs font-bold text-slate-500 uppercase pt-1">Senha de Acesso:</p>
                  <p className="text-base font-bold text-slate-800 font-mono">{item.password}</p>
                </>
              )}
              <p className="text-[11px] text-slate-500 italic pt-2 text-center">
                Aponte a câmera do seu celular para conectar automaticamente.
              </p>
            </div>
          ) : (
            <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-1 mt-2 text-xs">
              <p><strong className="text-slate-900">Equipamento:</strong> {item.asset_name || item.title}</p>
              {item.collaborator && <p><strong className="text-slate-900">Responsável:</strong> {item.collaborator}</p>}
              {item.brand && <p><strong className="text-slate-900">Marca/Modelo:</strong> {item.brand} {item.model || ""}</p>}
              {item.address && <p><strong className="text-slate-900">Local:</strong> {item.address}</p>}
              {item.message && <p className="text-slate-600 italic pt-1">{item.message}</p>}
            </div>
          )}

          <div className="mt-6 text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
            TIHFSA • Hotel Fasano Salvador
          </div>
        </div>
      </div>

      {/* Canvas Oculto para Exportação em Alta Resolução (Offscreen) */}
      <canvas ref={exportCanvasRef} className="hidden" />

      {/* Modal Interativo Normal */}
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              isWifi ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
            }`}>
              <Download size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Emitir e Baixar QR Code</h2>
              <p className="text-xs text-slate-400 font-medium">
                Escolha a resolução e formato ideal para sua impressão
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Card com Preview Central */}
          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-3xl border border-slate-200/70">
            <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center">
              <canvas ref={previewCanvasRef} className="w-[200px] h-[200px] rounded-lg" />
            </div>

            <div className="text-center mt-3.5">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                isWifi ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"
              }`}>
                {isWifi ? <Wifi size={12} /> : <Laptop size={12} />}
                {isWifi ? "Wi-Fi de Eventos" : "Equipamento"}
              </span>
              <h3 className="text-sm font-bold text-slate-800 mt-1">{item.title}</h3>
              <p className="text-xs text-slate-400 font-medium">{item.company || "Hotel Fasano Salvador"}</p>
            </div>
          </div>

          {/* Seletor de Resolução / Tamanho do Download */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sliders size={14} className="text-blue-500" />
              <span>Ajuste do Tamanho do QR Code para Download:</span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { size: 256, label: "256 px", desc: "Pequeno / Web" },
                { size: 512, label: "512 px", desc: "Crachás e Tags" },
                { size: 1024, label: "1024 px", desc: "Placas de Mesa" },
                { size: 2048, label: "2048 px", desc: "Totens e Banners" },
              ].map((opt) => (
                <button
                  key={opt.size}
                  type="button"
                  onClick={() => setDownloadSize(opt.size)}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                    downloadSize === opt.size
                      ? "border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20 shadow-xs"
                      : "border-slate-200 hover:bg-slate-50 text-slate-600"
                  }`}
                >
                  <p className="text-xs font-extrabold">{opt.label}</p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Destaque de Conexão ou Dados */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-1 text-slate-600">
            {isWifi ? (
              <>
                <p><strong>Rede:</strong> {item.ssid}</p>
                <p><strong>Senha:</strong> {item.password || "Nenhuma (Rede aberta)"}</p>
                <p><strong>Criptografia:</strong> {item.security_type || "WPA"}</p>
              </>
            ) : (
              <>
                <p><strong>Ficha Digital:</strong> {window.location.origin}/qr/{item.code}</p>
                <p><strong>Responsável:</strong> {item.collaborator || "—"}</p>
                <p><strong>Patrimônio/Nome:</strong> {item.asset_name || "—"}</p>
              </>
            )}
          </div>
        </div>

        {/* Footer com Botões de Ação */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            onClick={handlePrint}
            className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-all flex items-center gap-2 cursor-pointer shadow-xs"
            title="Imprimir placa ou display de mesa formatado para eventos"
          >
            <Printer size={15} />
            <span>Imprimir Display de Mesa</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2.5 text-slate-500 hover:bg-slate-200/60 rounded-xl text-xs font-bold transition-all"
            >
              Fechar
            </button>
            <button
              onClick={handleDownload}
              disabled={exporting}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-blue-500/20 cursor-pointer"
            >
              {exporting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Gerando Imagem...</span>
                </>
              ) : (
                <>
                  <ArrowDownToLine size={15} />
                  <span>Baixar PNG ({downloadSize}px)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
