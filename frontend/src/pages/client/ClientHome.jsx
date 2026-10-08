/**
 * ClientHome — tela inicial do PWA do usuário (Light/Modern Theme) com acabamento premium.
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Ticket, Sparkles, ChevronRight, MapPin, LogOut, QrCode, ShieldCheck, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import api from "../../api/client";
import { useAuth } from "../../contexts/AuthContext";
import StatusBadge from "../../components/ui/StatusBadge";

export default function ClientHome() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loadingTicketDetail, setLoadingTicketDetail] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [submittingReopen, setSubmittingReopen] = useState(false);

  useEffect(() => {
    if (user?.id) {
      api.get(`/tickets/?requester_id=${user.id}&limit=5`).then((r) => setTickets(r.data)).catch(console.error);
    }
  }, [user?.id]);

  const handleOpenTicketDetail = async (ticketId) => {
    setLoadingTicketDetail(true);
    setReopening(false);
    setReopenReason("");
    try {
      const { data } = await api.get(`/tickets/${ticketId}`);
      setSelectedTicket(data);
    } catch (err) {
      console.error(err);
      alert("Não foi possível carregar os detalhes do chamado.");
    } finally {
      setLoadingTicketDetail(false);
    }
  };

  // Abre automaticamente o modal se ticketId estiver na URL (ex: via notificação de e-mail / whatsapp)
  useEffect(() => {
    const tid = searchParams.get("ticketId");
    if (tid) {
      const parsed = parseInt(tid, 10);
      if (!isNaN(parsed) && parsed > 0) {
        handleOpenTicketDetail(parsed);
      }
    }
  }, [searchParams]);

  const handleCloseDetailModal = () => {
    setSelectedTicket(null);
    setReopening(false);
    setReopenReason("");
    if (searchParams.get("ticketId")) {
      const next = new URLSearchParams(searchParams);
      next.delete("ticketId");
      setSearchParams(next, { replace: true });
    }
  };

  const handleConfirmReopen = async () => {
    if (!reopenReason.trim()) {
      alert("Por favor, preencha a justificativa da reabertura.");
      return;
    }
    setSubmittingReopen(true);
    try {
      await api.post(`/tickets/${selectedTicket.id}/reopen`, {
        reason: reopenReason.trim(),
      });
      alert("Chamado reaberto com sucesso sob garantia de atendimento!");
      setSelectedTicket(null);
      setReopening(false);
      setReopenReason("");
      if (user?.id) {
        const res = await api.get(`/tickets/?requester_id=${user.id}&limit=5`);
        setTickets(res.data);
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Falha ao reabrir chamado.");
    } finally {
      setSubmittingReopen(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900 pb-12">
      {/* Top Header */}
      <header className="px-5 py-4 bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm shadow-md"
              style={{
                background: "linear-gradient(135deg, #d4af37 0%, #f3e5ab 50%, #aa820a 100%)",
                color: "#0b0f19",
              }}
            >
              TI
            </div>
            <div>
              <div className="flex items-center gap-1">
                <h1 className="text-sm font-extrabold text-slate-900">TIHFSA Portal</h1>
                <Sparkles size={12} className="text-amber-500" />
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Acesso Colaborador</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2.5 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                {user?.displayName?.charAt(0) || "U"}
              </div>
              <span className="text-xs font-semibold text-slate-700 truncate max-w-[100px]">
                {user?.displayName?.split(" ")[0] || "Usuário"}
              </span>
            </div>

            <button
              onClick={logout}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all cursor-pointer"
              title="Sair da Sessão"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 sm:p-6 space-y-6">
        {/* Main Banner CTA */}
        <button
          onClick={() => navigate("/app/new-request")}
          className="w-full rounded-2xl p-6 text-left cursor-pointer transition-all duration-300 transform hover:-translate-y-1 shadow-xl shadow-blue-500/20 relative overflow-hidden group"
          style={{
            background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%)",
            color: "#fff",
          }}
        >
          <div className="absolute -right-10 -bottom-10 w-36 h-36 rounded-full bg-white/10 blur-xl group-hover:scale-125 transition-transform" />

          <div className="flex items-center justify-between relative z-10">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 bg-white/10 px-2.5 py-1 rounded-full border border-white/10 flex items-center gap-1 w-max">
                <MapPin size={12} /> Vistoria UH / Áreas
              </span>
              <p className="text-xl font-extrabold mt-2">Relatar Problema</p>
              <p className="text-xs text-blue-100 mt-1">Abra um chamado direto com a equipe de TI</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0 shadow-lg">
              <Plus size={24} />
            </div>
          </div>
        </button>

        {/* Leitor de QR Code Rápido */}
        <button
          onClick={() => navigate("/scan")}
          className="w-full bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <QrCode size={20} />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-slate-800">Escanear QR Code</p>
              <p className="text-[11px] text-slate-500">Leitor de tags de equipamentos e Wi-Fi</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
        </button>

        {/* Recent Tickets Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Meus Chamados Recentes
            </h2>
            <span className="text-xs font-semibold text-slate-400">
              {tickets.length} chamados
            </span>
          </div>

          <div className="space-y-2.5">
            {tickets.map((t) => (
              <div
                key={t.id}
                onClick={() => handleOpenTicketDetail(t.id)}
                className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col gap-2 group"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold text-slate-400">#{t.id}</span>
                    <StatusBadge status={t.status} />
                    {t.reopen_count > 0 && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                        {t.reopen_count}ª reabertura
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {new Date(t.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                
                <h3 className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                  {t.title}
                </h3>

                {/* Selo de Garantia Rápido se Fechado */}
                {(t.status === "Fechado" || t.status === "closed") && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                      <ShieldCheck size={12} className="text-emerald-600" />
                      Garantia de Atendimento
                    </span>
                    <span className="text-[10px] font-bold text-blue-600 group-hover:underline">
                      Ver Solução / Reabrir →
                    </span>
                  </div>
                )}
              </div>
            ))}

            {tickets.length === 0 && (
              <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                  <Ticket size={24} />
                </div>
                <p className="text-xs font-semibold text-slate-600">Nenhum chamado aberto recentemente</p>
                <p className="text-[11px] text-slate-400">Quando você reportar problemas durante vistorias, eles aparecerão aqui.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal de Detalhes do Chamado & Reabertura */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-slate-500">#{selectedTicket.id}</span>
                <StatusBadge status={selectedTicket.status} />
              </div>
              <button
                onClick={handleCloseDetailModal}
                className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 flex items-center justify-center text-slate-500 text-xs font-bold transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">{selectedTicket.title}</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {selectedTicket.description || "Sem descrição adicional informada."}
                </p>
              </div>

              {/* Informações de Atendimento */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs space-y-2 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Técnico Responsável:</span>
                  <span className="font-bold">{selectedTicket.technician_name || "Equipe de TI"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Data de Abertura:</span>
                  <span className="font-bold">{new Date(selectedTicket.created_at).toLocaleString("pt-BR")}</span>
                </div>
                {selectedTicket.closed_at && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Finalizado em:</span>
                    <span className="font-bold">{new Date(selectedTicket.closed_at).toLocaleString("pt-BR")}</span>
                  </div>
                )}
                {selectedTicket.closure_reason && (
                  <div className="pt-2 border-t border-slate-200/60">
                    <span className="text-slate-400 font-semibold block mb-0.5">Solução / Fechamento:</span>
                    <span className="font-medium text-emerald-700">{selectedTicket.closure_reason}</span>
                  </div>
                )}
              </div>

              {/* Bloco de Garantia de Serviço */}
              {(selectedTicket.status === "Fechado" || selectedTicket.status === "closed") && (
                <div className={`p-4 rounded-2xl border ${
                  selectedTicket.can_reopen
                    ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                    : "bg-slate-100 border-slate-200 text-slate-600"
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck size={16} className={selectedTicket.can_reopen ? "text-emerald-600" : "text-slate-400"} />
                    <span className="text-xs font-black">
                      {selectedTicket.can_reopen ? "Garantia de Atendimento Ativa" : "Prazo de Garantia Expirado"}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    {selectedTicket.can_reopen ? (
                      <>
                        Este serviço possui garantia válida até{" "}
                        <strong>{selectedTicket.warranty_expires_at ? new Date(selectedTicket.warranty_expires_at).toLocaleDateString("pt-BR") : "7 dias"}</strong>. Caso o mesmo problema persista, você pode reabrir o chamado.
                      </>
                    ) : (
                      "O prazo de garantia para reabertura deste chamado expirou. Se estiver enfrentando um novo problema, abra um novo chamado."
                    )}
                  </p>
                </div>
              )}

              {/* Formulário de Reabertura (se clicou em reabrir) */}
              {reopening && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3 animate-fade-in">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <RefreshCw size={14} />
                    <span>Justificativa da Reabertura</span>
                  </div>
                  <textarea
                    rows={3}
                    required
                    value={reopenReason}
                    onChange={(e) => setReopenReason(e.target.value)}
                    placeholder="Explique o que voltou a acontecer com o equipamento ou serviço..."
                    className="w-full bg-white border border-amber-300 rounded-xl p-3 text-xs text-slate-800 outline-none focus:border-amber-500 resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => { setReopening(false); setReopenReason(""); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200/50 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={submittingReopen || !reopenReason.trim()}
                      onClick={handleConfirmReopen}
                      className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {submittingReopen ? <RefreshCw size={12} className="animate-spin" /> : null}
                      <span>Confirmar Reabertura</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <button
                type="button"
                onClick={handleCloseDetailModal}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                Fechar
              </button>

              {(selectedTicket.status === "Fechado" || selectedTicket.status === "closed") && selectedTicket.can_reopen && !reopening && (
                <button
                  type="button"
                  onClick={() => setReopening(true)}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-600/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw size={14} />
                  <span>O problema voltou? Reabrir</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

