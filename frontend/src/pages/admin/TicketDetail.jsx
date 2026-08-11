/**
 * TicketDetail — detalhe do chamado com timeline de interações e visual Glassmorphism refinado.
 */
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, CheckCircle, Clock, User, Monitor, Tag } from "lucide-react";
import api from "../../api/client";
import StatusBadge from "../../components/ui/StatusBadge";

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [message, setMessage] = useState("");
  const [solution, setSolution] = useState("");
  const [showSolve, setShowSolve] = useState(false);

  const fetchTicket = () => {
    api.get(`/tickets/${id}`).then((r) => setTicket(r.data)).catch(console.error);
  };

  useEffect(() => { fetchTicket(); }, [id]);

  const addComment = async () => {
    if (!message.trim()) return;
    await api.post(`/tickets/${id}/interactions`, { message });
    setMessage("");
    fetchTicket();
  };

  const solveTicket = async () => {
    if (!solution.trim()) return;
    await api.patch(`/tickets/${id}/solve`, { solution_message: solution });
    setSolution("");
    setShowSolve(false);
    fetchTicket();
  };

  if (!ticket) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
      Carregando chamado...
    </div>
  );

  return (
    <div className="animate-fade-in max-w-4xl mx-auto space-y-5">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
      >
        <ArrowLeft size={16} /> <span>Voltar aos Chamados</span>
      </button>

      {/* Main Info Card */}
      <div className="glass-card rounded-2xl p-5 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-amber-400">
                #{ticket.id}
              </span>
              <span className={`text-xs font-bold priority-${ticket.priority?.toLowerCase?.() || "medium"}`}>
                Prioridade {ticket.priority}
              </span>
            </div>
            <h1 className="text-base md:text-xl font-bold text-white mt-1.5">{ticket.title}</h1>
          </div>
          <StatusBadge status={ticket.status} />
        </div>

        {ticket.description && (
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5">
            {ticket.description}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs pt-2">
          <div className="p-3 rounded-xl bg-white/5 border border-white/5">
            <span className="text-slate-400 block mb-1">Solicitante</span>
            <p className="font-semibold text-white truncate">{ticket.requester_name || "-"}</p>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/5">
            <span className="text-slate-400 block mb-1">Técnico Responsável</span>
            <p className="font-semibold text-white truncate">{ticket.technician_name || "Não atribuído"}</p>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/5">
            <span className="text-slate-400 block mb-1">Categoria</span>
            <p className="font-semibold text-white truncate">
              {ticket.category_name || "-"} {ticket.subcategory_name ? `> ${ticket.subcategory_name}` : ""}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/5">
            <span className="text-slate-400 block mb-1">Equipamento / Ativo</span>
            <p className="font-semibold text-white truncate">{ticket.asset_name || "-"}</p>
          </div>
        </div>
      </div>

      {/* Timeline Card */}
      <div className="glass-card rounded-2xl p-5 md:p-6 space-y-5">
        <h2 className="text-sm font-bold text-white tracking-wide border-b border-white/10 pb-3">
          Histórico e Interações
        </h2>

        <div className="space-y-4">
          {ticket.interactions?.map((inter) => (
            <div
              key={inter.id}
              className={`p-4 rounded-xl border transition-all ${
                inter.is_solution
                  ? "bg-emerald-950/30 border-emerald-500/30"
                  : "bg-white/5 border-white/5"
              }`}
            >
              <p className="text-xs md:text-sm text-slate-200 leading-relaxed">{inter.message}</p>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-400">
                <span>Atendimento #{inter.user_id}</span>
                <span>•</span>
                <span>{new Date(inter.created_at).toLocaleString("pt-BR")}</span>
                {inter.is_solution && (
                  <span className="flex items-center gap-1 font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    <CheckCircle size={12} /> Solução Aplicada
                  </span>
                )}
              </div>
            </div>
          ))}

          {(!ticket.interactions || ticket.interactions.length === 0) && (
            <p className="text-xs text-slate-500 text-center py-6">
              Nenhuma interação registrada até o momento
            </p>
          )}
        </div>

        {/* Comment Input */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Adicionar nota técnica ou atualização..."
            className="flex-1 px-4 py-2.5 rounded-xl text-xs md:text-sm glass-input"
            onKeyDown={(e) => e.key === "Enter" && addComment()}
          />
          <button
            onClick={addComment}
            className="px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <Send size={16} /> <span>Comentar</span>
          </button>
        </div>

        {/* Solve Action */}
        {ticket.status !== "Fechado" && ticket.status !== "Aguardando Validacao" && (
          <div className="pt-4 border-t border-white/10">
            {!showSolve ? (
              <button
                onClick={() => setShowSolve(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all cursor-pointer shadow-lg shadow-emerald-600/20"
              >
                <CheckCircle size={18} />
                <span>Concluir e Enviar para Validação</span>
              </button>
            ) : (
              <div className="space-y-3 p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Descreva a Solução Aplicada</h3>
                <textarea
                  value={solution}
                  onChange={(e) => setSolution(e.target.value)}
                  placeholder="Explicação técnica da solução que será enviada para aprovação do gestor..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl text-xs md:text-sm glass-input resize-none"
                />
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={solveTicket}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all cursor-pointer"
                  >
                    Enviar Solução
                  </button>
                  <button
                    onClick={() => setShowSolve(false)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs md:text-sm text-slate-400 hover:text-white bg-white/5 border border-white/10 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
