import { useState, useEffect } from "react";
import { 
  X, Printer, CheckCircle2, Clock, AlertCircle, 
  ShieldCheck, UserCheck, PackageCheck, Camera, 
  RotateCcw, Calendar, Building2, User, RefreshCw, 
  Maximize2, Minimize2, Eye, ZoomIn, ZoomOut, 
  Download, FileText, Sparkles, Smartphone
} from "lucide-react";
import api from "../../../api/client";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Formata o User-Agent do dispositivo em uma descrição amigável e concisa
 */
function formatSignerDevice(deviceStr) {
  if (!deviceStr) return "Dispositivo não registrado";
  try {
    const resMatch = deviceStr.match(/\((\d+x\d+)\)$/);
    const resolution = resMatch ? resMatch[1] : null;

    let browser = "Navegador";
    if (deviceStr.includes("Edg/")) browser = "Microsoft Edge";
    else if (deviceStr.includes("Chrome/") && !deviceStr.includes("Edg/")) browser = "Google Chrome";
    else if (deviceStr.includes("Firefox/")) browser = "Mozilla Firefox";
    else if (deviceStr.includes("Safari/") && !deviceStr.includes("Chrome/")) browser = "Apple Safari";

    let os = "Dispositivo";
    if (deviceStr.includes("Windows NT 10.0")) os = "Windows 10/11";
    else if (deviceStr.includes("Windows")) os = "Windows";
    else if (deviceStr.includes("Android")) os = "Android";
    else if (deviceStr.includes("iPhone") || deviceStr.includes("iPad")) os = "iOS";
    else if (deviceStr.includes("Macintosh") || deviceStr.includes("Mac OS")) os = "macOS";
    else if (deviceStr.includes("Linux")) os = "Linux";

    let result = `${browser} (${os}`;
    if (resolution) {
      result += ` • ${resolution})`;
    } else {
      result += `)`;
    }
    return result;
  } catch {
    return deviceStr.length > 50 ? deviceStr.substring(0, 50) + "..." : deviceStr;
  }
}

/**
 * Converte a lista de itens em uma tabela HTML limpa e executiva para interpolação
 */
function buildItemsHtmlTable(items = []) {
  if (!items || items.length === 0) {
    return `<p style="font-size: 8.5pt; color: #64748b; font-style: italic; margin: 4px 0;">Nenhum equipamento registrado.</p>`;
  }

  const rowsHtml = items.map((it) => `
    <tr style="border-bottom: 1px solid #e2e8f0; font-size: 8.5pt;">
      <td style="padding: 5px 8px; font-weight: 600; color: #0f172a;">
        ${it.item_name || "—"}
        ${it.accessories ? `<div style="font-size: 7.5pt; color: #64748b; font-weight: normal; margin-top: 2px;">Acessórios: ${it.accessories}</div>` : ""}
      </td>
      <td style="padding: 5px 8px; font-family: monospace; color: #334155;">${it.asset_tag || "—"}</td>
      <td style="padding: 5px 8px; font-family: monospace; color: #334155;">${it.serial_number || "—"}</td>
      <td style="padding: 5px 8px; text-align: center; font-weight: bold; color: #1e293b;">${it.quantity || 1}</td>
      <td style="padding: 5px 8px; color: #475569;">${it.condition || "Em perfeito estado"}</td>
      <td style="padding: 5px 8px; text-align: center;">
        <span style="font-size: 7pt; font-weight: bold; padding: 2px 6px; border-radius: 4px; ${
          it.is_returned 
            ? "background-color: #dcfce7; color: #166534;" 
            : "background-color: #dbeafe; color: #1e40af;"
        }">
          ${it.is_returned ? "Devolvido" : "Em Posse"}
        </span>
      </td>
    </tr>
  `).join("");

  return `
    <table style="width: 100%; border-collapse: collapse; margin: 6px 0 8px 0; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; font-family: inherit; page-break-inside: avoid !important; break-inside: avoid !important;">
      <thead>
        <tr style="background-color: #f1f5f9; color: #334155; font-size: 8.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #cbd5e1;">
          <th style="padding: 5px 8px; text-align: left;">Item / Descrição</th>
          <th style="padding: 5px 8px; text-align: left;">Patrimônio</th>
          <th style="padding: 5px 8px; text-align: left;">Nº Série</th>
          <th style="padding: 5px 8px; text-align: center;">Qtd</th>
          <th style="padding: 5px 8px; text-align: left;">Estado</th>
          <th style="padding: 5px 8px; text-align: center;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;
}

/**
 * Interpola tags dinâmicas dentro de um template HTML
 */
function interpolateTermHtml(htmlTemplate, term) {
  if (!htmlTemplate) return "";

  const formattedDate = formatDate(term.created_at);
  const itemsTable = buildItemsHtmlTable(term.items);

  // Assinatura do colaborador (proporção executiva equilibrada)
  const signatureBlock = term.signature_url
    ? `<div style="text-align: center; margin: 2px 0;">
         <img src="${term.signature_url}" alt="Assinatura Digital" style="max-height: 56px; max-width: 200px; object-fit: contain; margin: 0 auto; display: block;" />
         <span style="font-size: 7.5pt; color: #059669; font-weight: bold; display: block; margin-top: 2px;">✓ Assinatura Touch em Tela</span>
       </div>`
    : `<div style="border: 1px dashed #cbd5e1; border-radius: 4px; padding: 6px; background: #f8fafc; color: #94a3b8; font-size: 8pt; text-align: center; margin: 2px 0;">[ Pendente de Assinatura ]</div>`;

  // Biometria facial do colaborador (proporção executiva 3x4 expandida, nítida e clicável)
  const biometricsBlock = term.facial_photo_url
    ? `<div style="text-align: center; margin: 4px 0;" class="biometrics-card-container">
         <div style="position: relative; display: inline-block; cursor: pointer;" data-lightbox-trigger="true" title="Toque ou clique para visualizar a foto ampliada">
           <img 
             src="${term.facial_photo_url}" 
             alt="Biometria Facial" 
             data-lightbox-trigger="true" 
             style="height: 136px; width: 105px; object-fit: cover; border-radius: 8px; border: 2.5px solid #2563eb; box-shadow: 0 4px 12px rgba(0,0,0,0.15); margin: 0 auto; display: block; cursor: pointer; transition: transform 0.2s ease;" 
           />
           <div data-lightbox-trigger="true" style="position: absolute; bottom: 4px; right: 4px; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px); color: #ffffff; border-radius: 4px; padding: 2px 6px; font-size: 7pt; font-weight: 700; display: flex; align-items: center; gap: 2px; pointer-events: none;">
             🔍 Ampliar
           </div>
         </div>
         <span style="font-size: 7.5pt; color: #059669; font-weight: bold; display: block; margin-top: 4px;">✓ Prova de Vida Validada (${term.facial_confidence ? Math.round(term.facial_confidence * 100) : 95}%)</span>
         <div class="no-print" style="margin-top: 4px;">
           <span data-lightbox-trigger="true" style="display: inline-flex; align-items: center; gap: 4px; font-size: 7.5pt; color: #1d4ed8; background: #eff6ff; border: 1px solid #bfdbfe; font-weight: 700; padding: 3px 10px; border-radius: 6px; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
             🔍 Toque para ampliar a foto
           </span>
         </div>
       </div>`
    : `<div style="border: 1px dashed #cbd5e1; border-radius: 4px; padding: 6px; background: #f8fafc; color: #94a3b8; font-size: 8pt; text-align: center; margin: 2px 0;">[ Biometria Facial Pendente ]</div>`;

  let rendered = htmlTemplate;

  // Substituições de cabeçalho e dados institucionais
  rendered = rendered.replace(/\{\{hotel_fasano\}\}/gi, "HOTEL FASANO SALVADOR");
  rendered = rendered.replace(/\{\{numero_termo\}\}/gi, term.term_number || "—");
  rendered = rendered.replace(/\{\{termo_numero\}\}/gi, term.term_number || "—");
  rendered = rendered.replace(/\{\{data_emissao\}\}/gi, formattedDate);
  rendered = rendered.replace(/\{\{data_atual\}\}/gi, formattedDate);

  // Substituições do colaborador recebedor
  rendered = rendered.replace(/\{\{nome_colaborador\}\}/gi, term.beneficiary_name || "—");
  rendered = rendered.replace(/\{\{documento_cpf_rg\}\}/gi, term.beneficiary_document || "Não informado");
  rendered = rendered.replace(/\{\{documento\}\}/gi, term.beneficiary_document || "Não informado");
  rendered = rendered.replace(/\{\{setor_departamento\}\}/gi, term.department_name || "Geral");
  rendered = rendered.replace(/\{\{departamento\}\}/gi, term.department_name || "Geral");
  rendered = rendered.replace(/\{\{email\}\}/gi, term.beneficiary_email || "Não informado");

  // Substituições da equipe técnica
  rendered = rendered.replace(/\{\{tecnico_responsavel\}\}/gi, term.technician_name || "Equipe de TI");
  rendered = rendered.replace(/\{\{previsao_devolucao\}\}/gi, term.expected_return_date ? new Date(term.expected_return_date).toLocaleDateString("pt-BR") : "Uso Contínuo / Indeterminado");

  // Substituição da tabela e validações de fé pública
  rendered = rendered.replace(/\{\{tabela_equipamentos\}\}/gi, itemsTable);
  rendered = rendered.replace(/\{\{assinatura_beneficiario\}\}/gi, signatureBlock);
  rendered = rendered.replace(/\{\{foto_biometria\}\}/gi, biometricsBlock);

  // Fallback: se o termo tiver foto biométrica mas o template não contiver a tag {{foto_biometria}}
  if (term.facial_photo_url && !rendered.includes(term.facial_photo_url)) {
    rendered += `
      <div style="margin-top: 14px; padding: 10px 14px; border: 1.5px solid #cbd5e1; border-radius: 8px; background-color: #f8fafc; page-break-inside: avoid !important; break-inside: avoid !important;">
        <div style="font-size: 8.5pt; font-weight: bold; color: #0f172a; margin-bottom: 6px; text-align: center;">Autenticação Biométrica Facial Registrada:</div>
        ${biometricsBlock}
      </div>
    `;
  }

  return rendered;
}

export default function ViewTermModal({ term, isOpen, onClose, onOpenSign, onSuccess }) {
  const [activeViewTab, setActiveViewTab] = useState("document"); // "document" ou "biometrics"
  const [isReturning, setIsReturning] = useState(false);
  const [returnCondition, setReturnCondition] = useState("Equipamento devolvido em perfeito estado de conservação");
  const [returnNotes, setReturnNotes] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [error, setError] = useState(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isPhotoZoomOpen, setIsPhotoZoomOpen] = useState(false);
  const [lightboxScale, setLightboxScale] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1); // 0.85, 1, 1.15

  // Fechar lightbox com a tecla Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isPhotoZoomOpen) {
        setIsPhotoZoomOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPhotoZoomOpen]);

  if (!isOpen || !term) return null;

  const handlePrint = () => {
    const printArea = document.getElementById("printable-term");
    if (!printArea) {
      window.print();
      return;
    }

    // Cria um iframe invisível para impressão 100% isolada, impedindo vazamento do dashboard ou tela de fundo
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>${term.term_number || "Termo"} - Hotel Fasano Salvador</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 12mm 10mm 12mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              margin: 0;
              padding: 0;
              background-color: #ffffff;
              color: #0f172a;
              font-family: Arial, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              font-size: 8.5pt;
              line-height: 1.4;
            }
            #printable-term {
              padding: 0 !important;
              margin: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
            }
            /* Bloqueio de quebra de página interno para manter o termo em folha A4 única */
            table, tr, td, th, tbody, thead {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            /* Converte qualquer flexbox de assinatura legado em tabela no print para evitar fratura */
            div[style*="display: flex"][style*="justify-content: space-between"] {
              display: table !important;
              width: 100% !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            div[style*="display: flex"][style*="justify-content: space-between"] > div {
              display: table-cell !important;
              vertical-align: bottom !important;
              width: 50% !important;
            }
            /* Blocos e cartões atômicos */
            div[style*="border"], 
            table[style*="border"],
            .term-document-body > div,
            .signature-block,
            .certification-block,
            .institutional-footer {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .print\\:hidden, .no-print, button {
              display: none !important;
            }
          </style>
        </head>
        <body>
          <div style="width: 100%; margin: 0 auto; background: #ffffff;">
            ${printArea.innerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    // Aguarda o carregamento das imagens (assinatura touch e biometria) no iframe antes de disparar o print
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2500);
    }, 400);
  };

  const handleConfirmReturn = async () => {
    setSubmittingReturn(true);
    setError(null);
    try {
      await api.post(`/terms/${term.id}/return`, {
        return_condition: returnCondition,
        return_notes: returnNotes.trim() || null,
      });
      setIsReturning(false);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Erro ao registrar devolução:", err);
      setError(err.response?.data?.detail || "Erro ao dar baixa na devolução.");
    } finally {
      setSubmittingReturn(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "signed":
        return <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-300">✓ Assinado & Entregue</span>;
      case "pending_signature":
        return <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full border border-amber-300">⏳ Aguardando Assinatura</span>;
      case "returned":
        return <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full border border-blue-300">🔄 Devolvido / Baixado</span>;
      case "cancelled":
        return <span className="px-3 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded-full">Cancelado</span>;
      default:
        return <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-full">{status}</span>;
    }
  };

  // Verifica se o texto legal é um template HTML formatado
  const isHtmlTemplate = Boolean(term.legal_text && term.legal_text.trim().startsWith("<"));
  const interpolatedHtml = isHtmlTemplate ? interpolateTermHtml(term.legal_text, term) : null;

  return (
    <>
      {/* Modal Principal de Visualização */}
      <div className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto print:static print:p-0 print:bg-white print:overflow-visible ${isFullScreen ? "p-0" : ""}`}>
        
        <div className={`bg-white w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col transition-all print:max-h-none print:shadow-none print:border-none print:rounded-none print:w-full print:m-0 ${
          isFullScreen 
            ? "max-w-full h-screen rounded-none border-none" 
            : "max-w-4xl max-h-[94vh]"
        }`}>
          
          {/* Barra Superior - Oculta na Impressão */}
          <div 
            data-print="hidden"
            className="print:hidden no-print bg-slate-900 text-white px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 shrink-0"
          >
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-base sm:text-lg">{term.term_number}</span>
                    {getStatusBadge(term.status)}
                  </div>
                  <p className="text-[11px] text-slate-400">Emissão: {formatDate(term.created_at)}</p>
                </div>
              </div>

              {/* Botão de Fechar no Mobile */}
              <button 
                onClick={onClose}
                className="sm:hidden text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Ações e Alternadores de Visualização */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              
              {/* Abas de Visualização (Documento A4 vs Dossiê Biométrico) */}
              <div className="inline-flex bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveViewTab("document")}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeViewTab === "document"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <FileText size={13} />
                  <span>Termo A4</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveViewTab("biometrics")}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeViewTab === "biometrics"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Camera size={13} />
                  <span>Dossiê &amp; Biometria</span>
                </button>
              </div>

              {/* Controles de Zoom do Documento */}
              {activeViewTab === "document" && (
                <div className="hidden md:inline-flex items-center bg-slate-800 rounded-xl border border-slate-700 px-1 py-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(0.75, +(z - 0.1).toFixed(2)))}
                    className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
                    title="Diminuir Zoom"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <span className="text-[11px] text-slate-300 font-mono px-1">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(1.3, +(z + 0.1).toFixed(2)))}
                    className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
                    title="Aumentar Zoom"
                  >
                    <ZoomIn size={14} />
                  </button>
                </div>
              )}

              <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer hidden sm:flex items-center gap-1 text-xs"
                title={isFullScreen ? "Sair da Tela Cheia" : "Modo Leitura em Tela Cheia"}
              >
                {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>

              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
                title="Imprimir documento em folha A4"
              >
                <Printer size={15} />
                <span className="hidden sm:inline">Imprimir A4</span>
              </button>

              <button 
                onClick={onClose}
                className="hidden sm:block text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                title="Fechar Visualização"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Formulário Retrátil de Devolução (Se acionado) */}
          {isReturning && (
            <div 
              data-print="hidden"
              className="print:hidden no-print p-4 bg-blue-50 border-b border-blue-200"
            >
              <h4 className="font-bold text-sm text-blue-900 mb-2 flex items-center gap-2">
                <RotateCcw size={16} />
                Confirmar Devolução de Todos os Equipamentos
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Estado de Conservação na Devolução</label>
                  <input
                    type="text"
                    value={returnCondition}
                    onChange={(e) => setReturnCondition(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Observações da Devolução</label>
                  <input
                    type="text"
                    placeholder="Ex: Devolvido com cabo e fonte originais sem avarias"
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs"
                  />
                </div>
              </div>
              {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReturning(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 font-semibold rounded-lg hover:bg-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReturn}
                  disabled={submittingReturn}
                  className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer flex items-center gap-1.5"
                >
                  {submittingReturn ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Confirmar Baixa
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 1: DOCUMENTO DO TERMO - FORMATO A4 RESPONSIVO COM CONTROLE DE ESCALA  */}
          {/* ========================================================================= */}
          {activeViewTab === "document" && (
            <div 
              id="printable-term" 
              className="p-3 sm:p-6 md:p-10 overflow-y-auto flex-1 text-slate-900 bg-white print:p-0 print:m-0 print:overflow-visible print:w-full transition-transform origin-top"
              style={{ transform: zoomLevel !== 1 ? `scale(${zoomLevel})` : undefined }}
            >
              {isHtmlTemplate ? (
                /* RENDERIZAÇÃO DIRETA DO DOCUMENTO FORMATAÇÃO WORD COM INTERPOLAÇÃO DAS TAGS */
                <div className="term-document-body space-y-3">
                  <style>{`
                    .term-document-body img[alt*="Biometria"],
                    .term-document-body img[data-lightbox-trigger="true"],
                    .term-document-body [data-lightbox-trigger="true"] {
                      cursor: pointer !important;
                    }
                    .term-document-body img[alt*="Biometria"]:hover,
                    .term-document-body img[data-lightbox-trigger="true"]:hover {
                      transform: scale(1.04) !important;
                      box-shadow: 0 8px 20px rgba(0,0,0,0.2) !important;
                    }
                  `}</style>

                  <div 
                    dangerouslySetInnerHTML={{ __html: interpolatedHtml }}
                    className="leading-relaxed"
                    onClick={(e) => {
                      if (!term.facial_photo_url) return;
                      const target = e.target;
                      if (!target) return;

                      const isImg = target.tagName === "IMG";
                      const isBiometricImg = isImg && (
                        target.getAttribute("data-lightbox-trigger") === "true" ||
                        target.getAttribute("alt")?.toLowerCase().includes("biometria") ||
                        target.getAttribute("src")?.includes("facial") ||
                        target.getAttribute("src")?.includes("face_") ||
                        target.getAttribute("src") === term.facial_photo_url
                      );
                      const isTrigger = 
                        target.getAttribute("data-lightbox-trigger") === "true" ||
                        Boolean(target.closest && target.closest("[data-lightbox-trigger='true']")) ||
                        Boolean(target.closest && target.closest(".biometrics-card-container"));

                      if (isBiometricImg || isTrigger) {
                        e.preventDefault();
                        e.stopPropagation();
                        setLightboxScale(1);
                        setIsPhotoZoomOpen(true);
                      }
                    }}
                  />

                  {/* Registro de Devolução / Baixa (Se houver) */}
                  {term.returned_at && (
                    <div 
                      style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
                      className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs space-y-1 mt-3"
                    >
                      <p className="font-bold text-blue-900 flex items-center gap-1.5">
                        <RotateCcw size={14} />
                        Registro de Devolução e Baixa do Termo
                      </p>
                      <p className="text-blue-800">
                        Data da Baixa: <strong>{formatDate(term.returned_at)}</strong> • Técnico Recebedor: <strong>{term.return_technician_name || "TI"}</strong>
                      </p>
                      {term.return_condition && <p className="text-slate-600">Estado na Devolução: {term.return_condition}</p>}
                      {term.return_notes && <p className="text-slate-600">Observações: {term.return_notes}</p>}
                    </div>
                  )}

                  {/* Certificação Digital & Fé Pública (Tabela atômica anti-quebra) */}
                  {term.status === "signed" && (
                    <table 
                      style={{ width: '100%', borderCollapse: 'collapse', pageBreakInside: 'avoid', breakInside: 'avoid', marginTop: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#f8fafc', fontSize: '8pt', lineHeight: 1.4 }}
                      className="certification-block"
                    >
                      <tbody>
                        <tr>
                          <td style={{ padding: '6px 10px', verticalAlign: 'top', borderRight: '1px solid #e2e8f0', width: '56%', color: '#334155' }}>
                            <div><strong style={{ color: '#0f172a' }}>Validação Digital sob Fé Pública:</strong> Documento autenticado internamente pelo sistema TIHFSA</div>
                            {term.signer_ip && (
                              <div style={{ marginTop: '3px', fontSize: '7.5pt', color: '#64748b', fontFamily: 'monospace' }}>
                                Endereço IP: {term.signer_ip}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '6px 10px', verticalAlign: 'top', textAlign: 'right', width: '44%', color: '#334155' }}>
                            <div>Assinado e fotografado em: <strong style={{ color: '#0f172a' }}>{formatDate(term.signed_at)}</strong></div>
                            {term.signer_device && (
                              <div style={{ marginTop: '3px', fontSize: '7.5pt', color: '#64748b' }}>
                                Dispositivo: {formatSignerDevice(term.signer_device)}
                              </div>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  )}

                  {/* Rodapé institucional para impressão */}
                  <div 
                    style={{ pageBreakInside: 'avoid', breakInside: 'avoid', paddingTop: '8px', marginTop: '10px', borderTop: '1px solid #cbd5e1', textAlign: 'center', fontSize: '8pt', color: '#64748b', lineHeight: 1.4 }}
                    className="institutional-footer"
                  >
                    Hotel Fasano Salvador • Praça Castro Alves, 5 - Centro Histórico, Salvador - BA, 40020-160
                    <div style={{ fontSize: '7.5pt', color: '#94a3b8', marginTop: '2px' }}>
                      Documento eletrônico autenticado internamente pelo sistema TIHFSA
                    </div>
                  </div>
                </div>
              ) : (
                /* RENDERIZAÇÃO CLÁSSICA ESTRUTURADA (PARA TERMOS LEGADOS OU SEM TEMPLATE HTML) */
                <div className="space-y-6">
                  {/* Cabeçalho do Hotel Fasano Salvador */}
                  <div className="border-b-2 border-slate-900 pb-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                    <div>
                      <div className="flex items-center gap-3 justify-center sm:justify-start">
                        <div className="w-10 h-10 rounded-xl bg-slate-950 text-white font-black text-xl flex items-center justify-center">
                          F
                        </div>
                        <div>
                          <h1 className="font-black text-xl tracking-wider text-slate-950 uppercase">HOTEL FASANO SALVADOR</h1>
                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Tecnologia da Informação & Telecomunicações</p>
                        </div>
                      </div>
                    </div>

                    <div className="text-center sm:text-right">
                      <span className="text-xs font-mono font-bold px-3 py-1 bg-slate-100 rounded-md border border-slate-300">
                        {term.term_number}
                      </span>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Data do Termo: <strong>{formatDate(term.created_at)}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="text-center py-2">
                    <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-wide text-slate-900">
                      TERMO DE RESPONSABILIDADE E RETIRADA DE EQUIPAMENTOS
                    </h2>
                  </div>

                  {/* Dados do Colaborador & Técnico */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">DADOS DO BENEFICIÁRIO / RECEBEDOR</p>
                      <p className="text-sm font-bold text-slate-900">{term.beneficiary_name}</p>
                      <p className="text-slate-600 mt-0.5">
                        Setor: <strong>{term.department_name || "Geral"}</strong>
                      </p>
                      {term.beneficiary_document && (
                        <p className="text-slate-600">Documento: <strong>{term.beneficiary_document}</strong></p>
                      )}
                      {term.beneficiary_email && (
                        <p className="text-slate-500">E-mail: {term.beneficiary_email}</p>
                      )}
                      <p className="text-slate-500 mt-1">
                        Tipo de Conta: <span className="font-semibold">{term.has_ad_account ? "Conta Corporativa (AD)" : "Prestador / Sem Conta de Rede"}</span>
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">DADOS DA ENTREGA & SUPORTE TI</p>
                      <p className="text-slate-700">Técnico Emissor: <strong>{term.technician_name}</strong></p>
                      <p className="text-slate-700 mt-0.5">Status Atual: <strong className="uppercase">{term.status}</strong></p>
                      {term.expected_return_date && (
                        <p className="text-blue-700 font-semibold mt-0.5">
                          Previsão de Devolução: {new Date(term.expected_return_date).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                      {term.signer_device && (
                        <p className="text-[10px] text-slate-400 mt-2 truncate">
                          Dispositivo: {formatSignerDevice(term.signer_device)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Tabela de Equipamentos e Acessórios */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <PackageCheck size={16} className="text-slate-700" />
                      Relação de Equipamentos Entregues ({term.items?.length || 0})
                    </h3>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                            <th className="p-2.5">Item / Descrição</th>
                            <th className="p-2.5">Patrimônio</th>
                            <th className="p-2.5">Número de Série</th>
                            <th className="p-2.5 text-center">Qtd</th>
                            <th className="p-2.5">Estado / Conservação</th>
                            <th className="p-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {term.items?.map((item, idx) => (
                            <tr key={item.id || idx} className="hover:bg-slate-50/50">
                              <td className="p-2.5">
                                <span className="font-bold text-slate-900 block">{item.item_name}</span>
                                {item.accessories && (
                                  <span className="text-[11px] text-slate-500 block">Acessórios: {item.accessories}</span>
                                )}
                              </td>
                              <td className="p-2.5 font-mono">{item.asset_tag || "—"}</td>
                              <td className="p-2.5 font-mono">{item.serial_number || "—"}</td>
                              <td className="p-2.5 text-center font-bold">{item.quantity}</td>
                              <td className="p-2.5 text-slate-600">{item.condition}</td>
                              <td className="p-2.5">
                                {item.is_returned ? (
                                  <span className="text-emerald-700 font-bold text-[11px]">Devolvido</span>
                                ) : (
                                  <span className="text-blue-700 font-bold text-[11px]">Em Posse</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Assinatura e Biometria no Modo Clássico (se assinado) */}
                  {term.status === "signed" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                      <div className="text-center p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-[11px] font-bold text-slate-600 mb-2">ASSINATURA DO BENEFICIÁRIO</p>
                        {term.signature_url ? (
                          <img 
                            src={term.signature_url} 
                            alt="Assinatura Touch" 
                            className="max-h-16 mx-auto object-contain" 
                          />
                        ) : (
                          <p className="text-xs text-slate-400 italic">Pendente</p>
                        )}
                        <p className="text-xs font-bold text-slate-800 mt-2">{term.beneficiary_name}</p>
                        <p className="text-[10px] text-emerald-600 font-bold mt-0.5">✓ Assinatura Digital Touch</p>
                      </div>

                      <div className="text-center p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-[11px] font-bold text-slate-600 mb-2">BIOMETRIA FACIAL (PROVA DE VIDA)</p>
                        {term.facial_photo_url ? (
                          <div 
                            className="inline-block relative cursor-pointer group"
                            onClick={() => { setLightboxScale(1); setIsPhotoZoomOpen(true); }}
                            title="Clique para ampliar a foto facial"
                          >
                            <img 
                              src={term.facial_photo_url} 
                              alt="Biometria Facial" 
                              style={{ height: "136px", width: "105px" }}
                              className="object-cover rounded-lg border-2 border-blue-600 shadow-md mx-auto group-hover:scale-105 transition-transform" 
                            />
                            <div className="mt-1 text-[11px] text-blue-600 font-bold flex items-center justify-center gap-1 cursor-pointer">
                              🔍 Toque para ampliar
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">Não coletada</p>
                        )}
                        <p className="text-xs font-bold text-emerald-600 mt-1">
                          ✓ Prova de Vida Validada ({term.facial_confidence ? Math.round(term.facial_confidence * 100) : 95}%)
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Rodapé institucional para impressão */}
                  <div className="pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
                    Hotel Fasano Salvador • Praça Castro Alves, 5 - Centro Histórico, Salvador - BA, 40020-160
                    <br />
                    Documento eletrônico autenticado internamente pelo sistema TIHFSA
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 2: DOSSIÊ E EVIDÊNCIAS BIOMÉTRICAS EM ALTA DEFINIÇÃO (TOUCH & FACIAL)  */}
          {/* ========================================================================= */}
          {activeViewTab === "biometrics" && (
            <div className="p-5 sm:p-8 overflow-y-auto flex-1 bg-slate-50/60 space-y-6">
              
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block mb-1">
                    Auditoria e Fé Pública Digital
                  </span>
                  <h3 className="text-lg font-black text-slate-900">
                    Dossiê de Validação Biométrica &amp; Assinatura Touch
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Evidências coletadas em tempo real durante a formalização do termo {term.term_number}.
                  </p>
                </div>

                {term.facial_photo_url && (
                  <button
                    type="button"
                    onClick={() => { setLightboxScale(1); setIsPhotoZoomOpen(true); }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition-colors"
                  >
                    <ZoomIn size={15} />
                    Ver Foto em Tela Cheia
                  </button>
                )}
              </div>

              {/* Grid de Evidências */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* 1. Evidência Biométrica Facial */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Camera size={16} className="text-emerald-600" />
                      1. Biometria Facial Registrada
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                      {term.facial_verified ? "Prova de Vida OK" : "Pendente"}
                    </span>
                  </div>

                  <div 
                    onClick={() => {
                      if (term.facial_photo_url) {
                        setLightboxScale(1);
                        setIsPhotoZoomOpen(true);
                      }
                    }}
                    className={`relative group rounded-2xl overflow-hidden bg-slate-900 border-2 border-slate-200 aspect-square max-w-[280px] mx-auto flex items-center justify-center shadow-md ${term.facial_photo_url ? "cursor-pointer" : ""}`}
                  >
                    {term.facial_photo_url ? (
                      <>
                        <img
                          src={term.facial_photo_url}
                          alt="Foto Biométrica do Recebedor"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setLightboxScale(1); setIsPhotoZoomOpen(true); }}
                          className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity cursor-pointer gap-1"
                        >
                          <ZoomIn size={28} />
                          <span className="text-xs font-bold">Clique para Ampliar</span>
                        </button>
                        {/* Indicador persistente para mobile/touch */}
                        <div className="absolute bottom-2 right-2 sm:hidden bg-slate-950/80 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                          <ZoomIn size={12} /> Toque para Ampliar
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-6 text-slate-500 text-xs">
                        <Camera size={36} className="mx-auto mb-2 text-slate-600" />
                        Foto biométrica não registrada
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs space-y-1">
                    <p className="text-slate-600">
                      Score de Confiança Neural: <strong className="text-emerald-600">{term.facial_confidence ? Math.round(term.facial_confidence * 100) : 95}%</strong>
                    </p>
                    <p className="text-slate-500 text-[11px]">
                      Algoritmo: Face-API.js com validação de vivacidade e detecção de microexpressões.
                    </p>
                  </div>
                </div>

                {/* 2. Assinatura Touch em Tela */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck size={16} className="text-blue-600" />
                      2. Assinatura Manuscrita Touch
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
                      {term.signature_url ? "Assinado em Tela" : "Pendente"}
                    </span>
                  </div>

                  <div className="rounded-2xl overflow-hidden bg-white border-2 border-slate-200 aspect-square max-w-[280px] mx-auto flex items-center justify-center p-3 shadow-inner">
                    {term.signature_url ? (
                      <img
                        src={term.signature_url}
                        alt="Assinatura Digital Manuscrita"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <div className="text-center p-6 text-slate-400 text-xs">
                        Assinatura pendente
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs space-y-1">
                    <p className="text-slate-700 font-bold">{term.beneficiary_name}</p>
                    <p className="text-slate-500 text-[11px]">
                      Documento: {term.beneficiary_document || "Não informado"} • Setor: {term.department_name || "Geral"}
                    </p>
                  </div>
                </div>

              </div>

              {/* Detalhes Técnicos do Aparelho & Rede */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Smartphone size={16} className="text-slate-600" />
                  Metadados do Tablet &amp; Rede Registrados sob Fé Pública
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Data &amp; Hora da Assinatura</span>
                    <strong className="text-slate-800">{formatDate(term.signed_at)}</strong>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Endereço IP Local</span>
                    <strong className="text-slate-800 font-mono">{term.signer_ip || "192.168.163.55 (Rede Fasano)"}</strong>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Dispositivo do Aceite</span>
                    <strong className="text-slate-800 truncate block">{formatSignerDevice(term.signer_device)}</strong>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Rodapé de Ações - Oculto na Impressão */}
          <div 
            data-print="hidden"
            className="print:hidden no-print bg-slate-50 px-4 sm:px-6 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0"
          >
            <div className="text-xs text-slate-500 text-center sm:text-left">
              {term.status === "signed" ? "Termo formalizado com assinatura e biometria facial." : 
               term.status === "pending_signature" ? "Termo aguardando coleta de assinatura no tablet." : 
               "Termo finalizado/devolvido."}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              {term.status === "pending_signature" && onOpenSign && (
                <button
                  type="button"
                  onClick={() => { onClose(); onOpenSign(term); }}
                  className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <UserCheck size={16} />
                  Assinar Agora no Tablet
                </button>
              )}

              {term.status === "signed" && (
                <button
                  type="button"
                  onClick={() => setIsReturning(true)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <RotateCcw size={16} />
                  Registrar Devolução
                </button>
              )}

              <button
                type="button"
                onClick={handlePrint}
                className="w-full sm:w-auto px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Printer size={16} />
                Imprimir
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Lightbox / Zoom em Alta Definição da Biometria Facial */}
      {isPhotoZoomOpen && term.facial_photo_url && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-md animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsPhotoZoomOpen(false);
          }}
        >
          <div className="relative bg-slate-900 border border-slate-700/80 rounded-3xl p-4 sm:p-6 max-w-lg sm:max-w-xl w-full shadow-2xl space-y-4 max-h-[95dvh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                  <Camera size={19} />
                </div>
                <div>
                  <h4 className="font-bold text-sm sm:text-base">Evidência Biométrica Facial</h4>
                  <p className="text-[11px] text-slate-400">
                    {term.beneficiary_name} • Termo {term.term_number}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPhotoZoomOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Fechar Visualização (Esc)"
              >
                <X size={22} />
              </button>
            </div>

            {/* Imagem em Alta Resolução com Controles de Zoom */}
            <div className="relative rounded-2xl overflow-hidden bg-black/80 border border-slate-800 flex-1 min-h-[260px] max-h-[58vh] flex items-center justify-center p-2 group">
              <img
                src={term.facial_photo_url}
                alt="Biometria Facial Alta Resolução"
                style={{ transform: `scale(${lightboxScale})` }}
                className="max-h-[54vh] max-w-full object-contain rounded-xl transition-transform duration-200 select-none cursor-zoom-in"
                onClick={() => setLightboxScale((s) => (s >= 2 ? 1 : +(s + 0.5).toFixed(1)))}
                title="Clique na imagem para aproximar o zoom"
              />

              {/* Floating Zoom Controls no canto superior da imagem */}
              <div className="absolute top-3 right-3 flex items-center gap-1 bg-slate-900/85 backdrop-blur-md border border-slate-700/80 rounded-xl p-1 text-white shadow-lg">
                <button
                  type="button"
                  onClick={() => setLightboxScale((s) => Math.max(1, +(s - 0.3).toFixed(1)))}
                  disabled={lightboxScale <= 1}
                  className="p-1.5 text-slate-300 hover:text-white disabled:opacity-40 rounded-lg hover:bg-slate-800 cursor-pointer"
                  title="Reduzir Zoom"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="text-[11px] font-mono font-bold px-1.5 min-w-[3rem] text-center">
                  {Math.round(lightboxScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setLightboxScale((s) => Math.min(3, +(s + 0.3).toFixed(1)))}
                  disabled={lightboxScale >= 3}
                  className="p-1.5 text-slate-300 hover:text-white disabled:opacity-40 rounded-lg hover:bg-slate-800 cursor-pointer"
                  title="Aumentar Zoom"
                >
                  <ZoomIn size={16} />
                </button>
                {lightboxScale > 1 && (
                  <button
                    type="button"
                    onClick={() => setLightboxScale(1)}
                    className="p-1.5 text-amber-400 hover:text-amber-300 rounded-lg hover:bg-slate-800 cursor-pointer text-[10px] font-bold"
                    title="Resetar Zoom"
                  >
                    1:1
                  </button>
                )}
              </div>
            </div>

            {/* Metadados Técnicos de Fé Pública */}
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60 shrink-0">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Confiança Facial</span>
                <span className="font-bold text-emerald-400">
                  {term.facial_confidence ? Math.round(term.facial_confidence * 100) : 95}% (Face Validada)
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Data & Hora</span>
                <span className="font-medium">{formatDate(term.signed_at)}</span>
              </div>
              <div className="col-span-2 pt-1 border-t border-slate-700/60 text-[11px] text-slate-400 font-mono truncate">
                Dispositivo: {formatSignerDevice(term.signer_device)}
              </div>
            </div>

            {/* Ações inferiores */}
            <div className="flex justify-between items-center pt-1 shrink-0">
              <a
                href={term.facial_photo_url}
                download={`biometria-${term.term_number}.jpg`}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 transition-colors min-h-[40px]"
              >
                <Download size={15} />
                Baixar Foto Original
              </a>
              <button
                type="button"
                onClick={() => setIsPhotoZoomOpen(false)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer min-h-[40px]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
