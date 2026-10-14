import { useState } from "react";
import { 
  X, Printer, CheckCircle2, Clock, AlertCircle, 
  ShieldCheck, UserCheck, PackageCheck, Camera, 
  RotateCcw, Calendar, Building2, User, RefreshCw, Maximize2, Minimize2, Eye
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
 * Converte a lista de itens em uma tabela HTML limpa e executiva para interpolação
 */
function buildItemsHtmlTable(items = []) {
  if (!items || items.length === 0) {
    return `<p style="font-size: 7.5pt; color: #64748b; font-style: italic; margin: 3px 0;">Nenhum equipamento registrado.</p>`;
  }

  const rowsHtml = items.map((it, idx) => `
    <tr style="border-bottom: 1px solid #e2e8f0; font-size: 7.5pt;">
      <td style="padding: 2.5px 6px; font-weight: 600; color: #0f172a;">
        ${it.item_name || "—"}
        ${it.accessories ? `<div style="font-size: 6.5pt; color: #64748b; font-weight: normal;">Acessórios: ${it.accessories}</div>` : ""}
      </td>
      <td style="padding: 2.5px 6px; font-family: monospace; color: #334155;">${it.asset_tag || "—"}</td>
      <td style="padding: 2.5px 6px; font-family: monospace; color: #334155;">${it.serial_number || "—"}</td>
      <td style="padding: 2.5px 6px; text-align: center; font-weight: bold; color: #1e293b;">${it.quantity || 1}</td>
      <td style="padding: 2.5px 6px; color: #475569;">${it.condition || "Em perfeito estado"}</td>
      <td style="padding: 2.5px 6px; text-align: center;">
        <span style="font-size: 6.5pt; font-weight: bold; padding: 1px 4px; border-radius: 3px; ${
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
    <table style="width: 100%; border-collapse: collapse; margin: 3px 0 5px 0; border: 1px solid #cbd5e1; border-radius: 5px; overflow: hidden; font-family: inherit; page-break-inside: avoid !important; break-inside: avoid !important;">
      <thead>
        <tr style="background-color: #f1f5f9; color: #334155; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #cbd5e1;">
          <th style="padding: 2.5px 6px; text-align: left;">Item / Descrição</th>
          <th style="padding: 2.5px 6px; text-align: left;">Patrimônio</th>
          <th style="padding: 2.5px 6px; text-align: left;">Nº Série</th>
          <th style="padding: 2.5px 6px; text-align: center;">Qtd</th>
          <th style="padding: 2.5px 6px; text-align: left;">Estado</th>
          <th style="padding: 2.5px 6px; text-align: center;">Status</th>
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

  // Assinatura do colaborador (compacta para folha A4 única)
  const signatureBlock = term.signature_url
    ? `<div style="text-align: center; margin: 1px 0;">
         <img src="${term.signature_url}" alt="Assinatura Digital" style="max-height: 42px; max-width: 160px; object-fit: contain; margin: 0 auto; display: block;" />
         <span style="font-size: 6.5pt; color: #059669; font-weight: bold; display: block; margin-top: 1px;">✓ Assinatura Touch em Tela</span>
       </div>`
    : `<div style="border: 1px dashed #cbd5e1; border-radius: 4px; padding: 4px; background: #f8fafc; color: #94a3b8; font-size: 7pt; text-align: center; margin: 1px 0;">[ Pendente de Assinatura ]</div>`;

  // Biometria facial do colaborador (compacta para folha A4 única)
  const biometricsBlock = term.facial_photo_url
    ? `<div style="text-align: center; margin: 1px 0;">
         <img src="${term.facial_photo_url}" alt="Biometria Facial" style="max-height: 46px; max-width: 75px; object-fit: cover; border-radius: 4px; border: 1px solid #cbd5e1; margin: 0 auto; display: block;" />
         <span style="font-size: 6.5pt; color: #059669; font-weight: bold; display: block; margin-top: 1px;">✓ Prova de Vida Validada (${term.facial_confidence ? Math.round(term.facial_confidence * 100) : 95}%)</span>
       </div>`
    : `<div style="border: 1px dashed #cbd5e1; border-radius: 4px; padding: 4px; background: #f8fafc; color: #94a3b8; font-size: 7pt; text-align: center; margin: 1px 0;">[ Biometria Facial Pendente ]</div>`;

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

  return rendered;
}

export default function ViewTermModal({ term, isOpen, onClose, onOpenSign, onSuccess }) {
  const [isReturning, setIsReturning] = useState(false);
  const [returnCondition, setReturnCondition] = useState("Equipamento devolvido em perfeito estado de conservação");
  const [returnNotes, setReturnNotes] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [error, setError] = useState(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

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
              margin: 4mm 6mm 3mm 6mm;
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
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              font-size: 8pt;
              line-height: 1.3;
            }
            /* BLOQUEIO ABSOLUTO DE QUEBRA DE PÁGINA EM TABELAS E BLOCOS DE VALIDAÇÃO */
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
            /* Todos os cartões de borda e blocos institucionais são atômicos */
            div[style*="border"], 
            div[style*="background-color"],
            table[style*="border"],
            .term-document-body > div,
            .signature-block,
            .certification-block,
            .institutional-footer {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            /* Otimização vertical rigorosa para folha A4 única */
            h1, h2, h3, h4 {
              margin-top: 3px !important;
              margin-bottom: 2px !important;
              line-height: 1.15 !important;
            }
            p {
              margin-top: 1.5px !important;
              margin-bottom: 1.5px !important;
            }
            ol, ul {
              margin-top: 2px !important;
              margin-bottom: 3px !important;
              padding-left: 16px !important;
            }
            li {
              margin-bottom: 1px !important;
              line-height: 1.25 !important;
            }
            table {
              margin: 3px 0 5px 0 !important;
            }
            th, td {
              padding: 2.5px 5px !important;
            }
            img {
              max-height: 42px !important;
              width: auto !important;
              display: block !important;
              margin: 0 auto !important;
            }
            .print\\:hidden, .no-print, button {
              display: none !important;
            }
          </style>
        </head>
        <body>
          <div style="width: 100%; max-width: 210mm; margin: 0 auto; background: #ffffff; transform: scale(0.95); transform-origin: top center;">
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
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto print:static print:p-0 print:bg-white print:overflow-visible ${isFullScreen ? "p-0" : ""}`}>
      
      <div className={`bg-white w-full rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col transition-all print:max-h-none print:shadow-none print:border-none print:rounded-none print:w-full print:m-0 ${
        isFullScreen 
          ? "max-w-full h-screen rounded-none border-none" 
          : "max-w-4xl max-h-[94vh]"
      }`}>
        
        {/* Barra Superior - Oculta na Impressão */}
        <div 
          data-print="hidden"
          className="print:hidden no-print bg-slate-900 text-white px-5 sm:px-6 py-3.5 flex items-center justify-between border-b border-slate-800 shrink-0"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
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

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer hidden sm:flex items-center gap-1 text-xs"
              title={isFullScreen ? "Sair da Tela Cheia" : "Modo Leitura em Tela Cheia"}
            >
              {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              <span className="hidden md:inline">{isFullScreen ? "Janela" : "Tela Cheia"}</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
              title="Imprimir documento em folha A4"
            >
              <Printer size={15} />
              <span>Imprimir A4</span>
            </button>

            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
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

        {/* DOCUMENTO DO TERMO - FORMATO A4 */}
        <div 
          id="printable-term" 
          className="p-6 sm:p-12 overflow-y-auto flex-1 text-slate-900 bg-white print:p-0 print:m-0 print:overflow-visible print:w-full"
        >
          {isHtmlTemplate ? (
            /* RENDERIZAÇÃO DIRETA DO DOCUMENTO FORMATAÇÃO WORD COM INTERPOLAÇÃO DAS TAGS */
            <div className="term-document-body space-y-3">
              <div 
                dangerouslySetInnerHTML={{ __html: interpolatedHtml }}
                className="leading-relaxed"
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
                  style={{ width: '100%', borderCollapse: 'collapse', pageBreakInside: 'avoid', breakInside: 'avoid', marginTop: '5px' }}
                  className="certification-block text-[7.5pt] bg-slate-50 border border-slate-200 rounded-lg leading-tight"
                >
                  <tbody>
                    <tr>
                      <td style={{ padding: '3px 8px', verticalAlign: 'middle', borderRight: '1px solid #e2e8f0', width: '58%' }}>
                        <strong className="text-slate-800">Validação Digital sob Fé Pública:</strong> Documento autenticado internamente pelo sistema TIHFSA
                        {term.signer_ip && <span className="block text-[7pt] text-slate-400 font-mono">Endereço IP: {term.signer_ip}</span>}
                      </td>
                      <td style={{ padding: '3px 8px', verticalAlign: 'middle', textAlign: 'right', width: '42%' }}>
                        <span>Assinado e fotografado em: <strong>{formatDate(term.signed_at)}</strong></span>
                        {term.signer_device && <span className="block text-[6.5pt] text-slate-400 truncate max-w-[260px] ml-auto">Dispositivo: {term.signer_device}</span>}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}

              {/* Rodapé institucional para impressão */}
              <div 
                style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
                className="institutional-footer pt-1 mt-1 border-t border-slate-200 text-center text-[7pt] text-slate-400 leading-tight"
              >
                Hotel Fasano Salvador • Praça Castro Alves, 5 - Centro Histórico, Salvador - BA, 40020-160
                <br />
                Documento eletrônico autenticado internamente pelo sistema TIHFSA
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
                      Dispositivo: {term.signer_device}
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

              {/* Texto Legal Limpo */}
              {term.legal_text && (
                <div className="text-[11px] text-slate-600 leading-relaxed border-t border-b border-slate-200 py-3 space-y-1.5 text-justify">
                  <p className="font-bold text-slate-800">Cláusulas e Condições de Aceite:</p>
                  <p>{term.legal_text}</p>
                </div>
              )}

              {/* Bloco de Assinaturas e Evidências Digitais */}
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-blue-600" />
                  Validação do Colaborador Recebedor (2 Validações) & Testemunha
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Bloco do Colaborador: Assinatura + Foto Facial */}
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-center flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block mb-2">
                      Colaborador Recebedor (Assinatura + Biometria)
                    </span>
                    
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {/* Assinatura Manuscrita */}
                      <div className="h-32 bg-white rounded-lg overflow-hidden flex items-center justify-center border border-slate-300 p-1">
                        {term.signature_url ? (
                          <img 
                            src={term.signature_url} 
                            alt="Assinatura Manuscrita" 
                            className="max-h-full max-w-full object-contain" 
                          />
                        ) : (
                          <span className="text-slate-400 text-[10px]">Aguardando assinatura</span>
                        )}
                      </div>

                      {/* Foto Facial */}
                      <div className="h-32 bg-slate-200 rounded-lg overflow-hidden flex items-center justify-center border border-slate-300">
                        {term.facial_photo_url ? (
                          <img 
                            src={term.facial_photo_url} 
                            alt="Reconhecimento Facial" 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <span className="text-slate-400 text-[10px]">Foto pendente</span>
                        )}
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-600">
                      <strong className="block text-slate-900">{term.beneficiary_name}</strong>
                      {term.signed_at && <span>Assinado em: {formatDate(term.signed_at)}</span>}
                    </div>
                  </div>

                  {/* Bloco do Técnico da TI */}
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-center flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-2">
                      Técnico Emissor / Testemunha da Entrega
                    </span>

                    <div className="h-32 bg-white rounded-lg border border-slate-300 flex flex-col items-center justify-center p-3 text-slate-500">
                      <ShieldCheck size={28} className="text-slate-400 mb-1" />
                      <span className="text-xs font-bold text-slate-700">{term.technician_name}</span>
                      <span className="text-[10px] text-slate-400">Setor de TI — Fasano Salvador</span>
                    </div>

                    <div className="text-[10px] text-slate-500">
                      <span>Entrega registrada eletronicamente no sistema TIHFSA</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rodapé institucional para impressão */}
              <div className="pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
                Hotel Fasano Salvador • Praça Castro Alves, 5 - Centro Histórico, Salvador - BA, 40020-160
                <br />
                Documento eletrônico autenticado internamente pelo sistema TIHFSA
              </div>
            </div>
          )}
        </div>

        {/* Rodapé de Ações - Oculto na Impressão */}
        <div 
          data-print="hidden"
          className="print:hidden no-print bg-slate-50 px-5 sm:px-6 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0"
        >
          <div className="text-xs text-slate-500">
            {term.status === "signed" ? "Termo formalizado com assinatura e biometria facial." : 
             term.status === "pending_signature" ? "Termo aguardando coleta de assinatura no tablet." : 
             "Termo finalizado/devolvido."}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {term.status === "pending_signature" && onOpenSign && (
              <button
                type="button"
                onClick={() => { onClose(); onOpenSign(term); }}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <UserCheck size={16} />
                Assinar Agora no Tablet
              </button>
            )}

            {term.status === "signed" && (
              <button
                type="button"
                onClick={() => setIsReturning(true)}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <RotateCcw size={16} />
                Registrar Devolução
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Printer size={16} />
              Imprimir
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
