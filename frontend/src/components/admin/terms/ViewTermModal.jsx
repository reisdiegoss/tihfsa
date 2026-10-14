import { useState } from "react";
import { 
  X, Printer, CheckCircle2, Clock, AlertCircle, 
  ShieldCheck, UserCheck, PackageCheck, Camera, 
  RotateCcw, Download, Calendar, Building2, User, RefreshCw
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

export default function ViewTermModal({ term, isOpen, onClose, onOpenSign, onSuccess }) {
  const [isReturning, setIsReturning] = useState(false);
  const [returnCondition, setReturnCondition] = useState("Equipamento devolvido em perfeito estado de conservação");
  const [returnNotes, setReturnNotes] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !term) return null;

  const handlePrint = () => {
    window.print();
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[94vh]">
        
        {/* Barra Superior - Oculta na Impressão */}
        <div className="print:hidden bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg">{term.term_number}</span>
                {getStatusBadge(term.status)}
              </div>
              <p className="text-xs text-slate-400">Emissão: {formatDate(term.created_at)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 transition-colors cursor-pointer"
            >
              <Printer size={16} />
              Imprimir (A4)
            </button>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Formulário Retrátil de Devolução (Se acionado) */}
        {isReturning && (
          <div className="print:hidden p-4 bg-blue-50 border-b border-blue-200">
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

        {/* DOCUMENTO DO TERMO - FORMATO A4 / RELATÓRIO */}
        <div id="printable-term" className="p-6 sm:p-10 overflow-y-auto space-y-6 flex-1 text-slate-900 bg-white">
          
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

          {/* Texto Legal */}
          <div className="text-[11px] text-slate-600 leading-relaxed border-t border-b border-slate-200 py-3 space-y-1.5 text-justify">
            <p className="font-bold text-slate-800">Cláusulas e Condições de Aceite:</p>
            <p>{term.legal_text}</p>
          </div>

          {/* EVIDÊNCIAS DIGITAIS: FOTO BIOMÉTRICA & ASSINATURA ELETRÔNICA */}
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-blue-600" />
              Evidências Digitais de Aceite e Fé Pública
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Foto Facial */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-center flex flex-col justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Reconhecimento Facial (Biometria)
                </span>
                
                <div className="h-44 bg-slate-200 rounded-lg overflow-hidden flex items-center justify-center border border-slate-300">
                  {term.facial_photo_url ? (
                    <img 
                      src={term.facial_photo_url} 
                      alt="Reconhecimento Facial do Beneficiário" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="text-slate-400 text-xs p-4 flex flex-col items-center gap-1">
                      <Camera size={24} />
                      <span>Foto não capturada</span>
                    </div>
                  )}
                </div>

                <div className="mt-2 text-[10px] text-slate-500">
                  {term.facial_verified ? (
                    <span className="text-emerald-700 font-bold block">
                      ✓ Rosto Verificado com Sucesso {term.facial_confidence ? `(${(term.facial_confidence * 100).toFixed(0)}%)` : ""}
                    </span>
                  ) : (
                    <span className="text-slate-400 block">Sem biometria registrada</span>
                  )}
                  {term.signed_at && <span>Capturado em: {formatDate(term.signed_at)}</span>}
                </div>
              </div>

              {/* Assinatura Manuscrita */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-center flex flex-col justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Assinatura Digital Manuscrita
                </span>

                <div className="h-44 bg-white rounded-lg overflow-hidden flex items-center justify-center border border-slate-300 p-2">
                  {term.signature_url ? (
                    <img 
                      src={term.signature_url} 
                      alt="Assinatura Manuscrita" 
                      className="max-h-full max-w-full object-contain" 
                    />
                  ) : (
                    <div className="text-slate-400 text-xs flex flex-col items-center gap-1">
                      <UserCheck size={24} />
                      <span>Aguardando assinatura</span>
                    </div>
                  )}
                </div>

                <div className="mt-2 text-[10px] text-slate-500">
                  <span className="font-bold text-slate-800 block">{term.beneficiary_name}</span>
                  {term.signed_at ? (
                    <span>Assinado eletronicamente em: {formatDate(term.signed_at)}</span>
                  ) : (
                    <span className="text-amber-600 font-semibold">Pendente de assinatura</span>
                  )}
                  {term.signer_ip && <span className="block text-[9px] text-slate-400">IP: {term.signer_ip}</span>}
                </div>
              </div>

            </div>
          </div>

          {/* Devolução / Baixa (Se houver) */}
          {term.returned_at && (
            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl text-xs space-y-1">
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

          {/* Rodapé institucional para impressão */}
          <div className="pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
            Hotel Fasano Salvador • Praça Castro Alves, 5 - Centro Histórico, Salvador - BA, 40020-160
            <br />
            Documento eletrônico autenticado internamente pelo sistema TIHFSA
          </div>

        </div>

        {/* Rodapé de Ações - Oculto na Impressão */}
        <div className="print:hidden bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {term.status === "signed" ? "Termo assinado e em posse do colaborador." : 
             term.status === "pending_signature" ? "Termo aguardando assinatura do colaborador." : 
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
