/**
 * ValidationPage — pagina publica para gestor aprovar/rejeitar chamado adaptada para telas móveis e desktops.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import api from "../../api/client";

export default function ValidationPage() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState("loading"); // loading, form, success, error
  const [rejectionReason, setRejectionReason] = useState("");
  const [message, setMessage] = useState("");

  const token = params.get("token");
  const action = params.get("action");

  useEffect(() => {
    if (!token || !action) {
      setStatus("error");
      setMessage("Link de validação inválido ou expirado.");
      return;
    }
    setStatus("form");
  }, [token, action]);

  const handleValidation = async (finalAction) => {
    setStatus("loading");
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const ticketId = payload.ticket_id;

      await api.post(`/tickets/${ticketId}/validate`, {
        action: finalAction,
        token: token,
        rejection_reason: finalAction === "reject" ? rejectionReason : null,
      });

      setStatus("success");
      setMessage(finalAction === "approve"
        ? "Solução aprovada com sucesso! O chamado foi encerrado."
        : "Solução recusada. O técnico foi notificado com a sua justificativa.");
    } catch (err) {
      setStatus("error");
      setMessage(err.response?.data?.detail || "Erro ao processar a validação do chamado.");
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}
    >
      <div className="w-full max-w-md animate-fade-in my-auto">
        <div className="text-center mb-6">
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center font-extrabold text-xl shadow-lg"
            style={{
              background: "linear-gradient(135deg, #d4af37 0%, #f3e5ab 50%, #aa820a 100%)",
              color: "#0b0f19",
            }}
          >
            TI
          </div>
          <h1 className="text-xl font-extrabold text-white">Validação de Solução</h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">TIHFSA — Hotel Fasano Salvador</p>
        </div>

        <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-4">
          {status === "loading" && (
            <div className="text-center py-8 space-y-3">
              <div className="w-10 h-10 border-4 border-amber-400/20 border-t-amber-400 rounded-full animate-spin mx-auto" />
              <p className="text-xs font-semibold text-slate-300">Processando resposta...</p>
            </div>
          )}

          {status === "form" && action === "approve" && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Aprovar Solução Aplicada?</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Confirmo que o atendimento atendeu aos padrões e que o problema foi corrigido.
                </p>
              </div>
              <button
                onClick={() => handleValidation("approve")}
                className="w-full py-3.5 rounded-xl text-xs sm:text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-500 transition-all cursor-pointer shadow-lg shadow-emerald-600/25"
              >
                Aprovar e Fechar Chamado
              </button>
            </div>
          )}

          {status === "form" && action === "reject" && (
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
                <XCircle size={36} />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-bold text-white">Recusar Solução</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Descreva o motivo da recusa para orientar o suporte técnico.
                </p>
              </div>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explique o que precisa ser ajustado no atendimento..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl text-xs sm:text-sm glass-input resize-none"
              />
              <button
                onClick={() => handleValidation("reject")}
                className="w-full py-3.5 rounded-xl text-xs sm:text-sm font-extrabold text-white bg-red-600 hover:bg-red-500 transition-all cursor-pointer shadow-lg shadow-red-600/25"
              >
                Confirmar Recusa da Solução
              </button>
            </div>
          )}

          {status === "success" && (
            <div className="text-center py-4 space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="text-lg font-bold text-white">Registrado com Sucesso</h2>
              <p className="text-xs text-slate-300 leading-relaxed">{message}</p>
            </div>
          )}

          {status === "error" && (
            <div className="text-center py-4 space-y-3">
              <div className="w-14 h-14 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
                <AlertTriangle size={32} />
              </div>
              <h2 className="text-lg font-bold text-white">Atenção</h2>
              <p className="text-xs text-slate-300 leading-relaxed">{message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
