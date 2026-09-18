import { useState, useEffect, useRef } from "react";
import { 
  X, Download, Printer, Wifi, Laptop, CheckCircle2, 
  Sparkles, Sliders, Layers, ArrowDownToLine, RefreshCw, ExternalLink 
} from "lucide-react";
import { formatWifiPayload, formatEquipmentPayload, formatEquipmentText, renderQRCodeToCanvas } from "../../utils/qrGenerator";

export default function QRCodeExportModal({ isOpen, onClose, item, defaultLogoUrl }) {
  const [downloadSize, setDownloadSize] = useState(1024); // 256 | 512 | 1024 | 2048
  const [exporting, setExporting] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [printMode, setPrintMode] = useState(false);
  const [showPasswordOnPlacard, setShowPasswordOnPlacard] = useState(true);
  const [equipmentMode, setEquipmentMode] = useState("url"); // "url" (Modal Nativo iOS/Android) | "text" (Texto Puro)
  const [qrDataUrl, setQrDataUrl] = useState("");

  const previewCanvasRef = useRef(null);
  const exportCanvasRef = useRef(null);

  const isWifi = item?.type === "wifi";

  // Sincroniza modo padrão do item ao abrir (sempre prioriza URL para modal nativo)
  useEffect(() => {
    if (item) {
      setEquipmentMode(item.encode_mode === "text" ? "text" : "url");
    }
  }, [isOpen, item]);

  // Gera o texto bruto a ser codificado no QR
  const getPayloadText = () => {
    if (!item) return "";
    if (isWifi) {
      return formatWifiPayload(item.ssid, item.password, item.security_type, item.is_hidden);
    }
    return formatEquipmentPayload(item, equipmentMode);
  };

  // Renderiza preview em tela e gera imagem para impressão
  useEffect(() => {
    if (!isOpen || !item || !previewCanvasRef.current) return;

    setPreviewLoaded(false);
    const text = getPayloadText();
    const logoToUse = item.logo_url || defaultLogoUrl;

    renderQRCodeToCanvas(previewCanvasRef.current, {
      text,
      size: 400,
      logoUrl: logoToUse,
      includeLogo: item.include_logo !== false,
    }).then(() => {
      setPreviewLoaded(true);
      if (previewCanvasRef.current) {
        try {
          const url = previewCanvasRef.current.toDataURL("image/png");
          setQrDataUrl(url);
        } catch (e) {
          console.error("Erro ao gerar dataUrl do QR:", e);
        }
      }
    });
  }, [isOpen, item, defaultLogoUrl, equipmentMode]);

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
    if (previewCanvasRef.current) {
      try {
        const url = previewCanvasRef.current.toDataURL("image/png");
        setQrDataUrl(url);
      } catch (e) {
        console.error(e);
      }
    }
    setTimeout(() => {
      window.print();
    }, 80);
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      
      {/* Estilos específicos para Impressão limpa de Display de Mesa */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-qr-placard, #printable-qr-placard * {
            visibility: visible !important;
          }
          #printable-qr-placard {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            background: white !important;
            padding: 20px !important;
            margin: 0 !important;
            z-index: 999999 !important;
          }
        }
      `}</style>

      {/* Elemento Oculto de Impressão de Display de Mesa */}
      <div id="printable-qr-placard" className="hidden">
        <div className="border-4 border-slate-900 rounded-3xl p-10 max-w-md w-full text-center flex flex-col items-center bg-white">
          <div className="mb-4">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
              {item.company || "Hotel Fasano Salvador"}
            </h1>
            <p className="text-sm font-bold text-slate-500 mt-0.5">
              {isWifi ? "Acesso à Rede Wi-Fi de Eventos" : "Identificação e Ficha Técnica"}
            </p>
          </div>

          <div className="p-3 bg-white border-2 border-slate-200 rounded-2xl my-4 flex items-center justify-center">
            {qrDataUrl ? (
              <img 
                src={qrDataUrl} 
                alt="QR Code" 
                className="w-[280px] h-[280px] object-contain"
              />
            ) : (
              <div className="w-[280px] h-[280px] bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                Gerando QR Code...
              </div>
            )}
          </div>

          {isWifi ? (
            <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-1.5 mt-2">
              <p className="text-xs font-bold text-slate-500 uppercase">Rede Wi-Fi (SSID):</p>
              <p className="text-lg font-black text-slate-900 font-mono">{item.ssid}</p>
              {showPasswordOnPlacard && item.password ? (
                <>
                  <p className="text-xs font-bold text-slate-500 uppercase pt-1">Senha de Acesso:</p>
                  <p className="text-base font-bold text-slate-800 font-mono">{item.password}</p>
                </>
              ) : null}
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

          {/* Opção para Display de Mesa (Wi-Fi): Exibir ou Ocultar Senha */}
          {isWifi && item.password && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Exibir senha no Display de Mesa
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {showPasswordOnPlacard
                    ? "A senha do Wi-Fi será impressa de forma legível no display."
                    : "A senha ficará oculta na impressão (conexão exclusivamente via leitura do QR Code)."}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={showPasswordOnPlacard}
                  onChange={(e) => setShowPasswordOnPlacard(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          )}

          {/* Informação de Formato para Equipamento: Sempre Modal Nativo iOS / Android */}
          {!isWifi && (
            <div className="bg-blue-50/70 p-4 rounded-2xl border border-blue-200/80 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm">📱</span>
                <p className="text-xs font-bold text-blue-900">Modal Nativo iOS & Android</p>
              </div>
              <p className="text-[11px] text-blue-700/90 leading-relaxed">
                Ao escanear com a câmera do celular ou pelo leitor do app, é exibido diretamente o <strong>Modal de Alerta Nativo</strong> (Cupertino no iOS e Material no Android) contendo apenas o botão <strong>OK</strong>.
              </p>
            </div>
          )}

          {/* Destaque de Conexão ou Dados */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-1 text-slate-600">
            {isWifi ? (
              <>
                <p><strong>Rede:</strong> {item.ssid}</p>
                <p>
                  <strong>Senha:</strong> {item.password || "Nenhuma (Rede aberta)"}
                  {item.password && !showPasswordOnPlacard && (
                    <span className="ml-2 text-amber-700 text-[10px] font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      Oculta no Display Impresso
                    </span>
                  )}
                </p>
                <p><strong>Criptografia:</strong> {item.security_type || "WPA"}</p>
              </>
            ) : (
              <>
                <p><strong>Link de Leitura:</strong> {window.location.origin}/qr/{item.code}</p>
                <p><strong>Visualização:</strong> Modal Nativo iOS (Cupertino) / Android (Material) com botão OK</p>
                <p><strong>Responsável:</strong> {item.collaborator || "—"}</p>
                <p><strong>Patrimônio/Nome:</strong> {item.asset_name || item.title || "—"}</p>
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
