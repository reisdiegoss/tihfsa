/**
 * TicketDetailDrawer — Painel lateral de detalhe do chamado.
 * 
 * Usa as rotas reais do backend:
 * - GET    /tickets/{id}              → Detalhe com interactions
 * - PATCH  /tickets/{id}              → Atualizar status/dados
 * - POST   /tickets/{id}/interactions → Adicionar comentário
 */
import { useState, useEffect } from "react";
import { X, Send, User, MapPin, Tag, AlertCircle, Clock, CheckCircle, ShieldCheck, Wrench } from "lucide-react";
import api from "../../api/client";

export default function TicketDetailDrawer({ ticketId, onClose, onUpdate }) {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchTicket = () => {
    if (!ticketId) return;
    setLoading(true);
    api.get(`/tickets/${ticketId}`)
      .then((r) => setTicket(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTicket();
  }, [ticketId]);

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    try {
      // Rota real: PATCH /tickets/{id} com body { status: "..." }
      await api.patch(`/tickets/${ticketId}`, { status: newStatus });
      fetchTicket();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
      alert("Erro ao alterar status. Verifique suas permissões.");
    } finally {
      setUpdating(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setUpdating(true);
    try {
      // Rota real: POST /tickets/{id}/interactions com body { message: "..." }
      await api.post(`/tickets/${ticketId}/interactions`, { message: newComment });
      setNewComment("");
      fetchTicket();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  if (!ticketId) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end transition-opacity">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
        
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Chamado #{ticketId}</span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
              ticket?.status === "Em Andamento" ? "bg-amber-100 text-amber-700" :
              ticket?.status === "Fechado" ? "bg-emerald-100 text-emerald-700" :
              ticket?.status === "Aguardando Validação" ? "bg-purple-100 text-purple-700" :
              ticket?.status === "Rejeitado" ? "bg-red-100 text-red-700" :
              "bg-blue-100 text-blue-700"
            }`}>
              {ticket?.status || "Carregando..."}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Body */}
        {loading ? (
          <div className="flex-1 p-8 flex items-center justify-center text-slate-400 font-medium">
            Carregando detalhes do chamado...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Title & Description */}
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 mb-2">{ticket?.title}</h2>
              <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100 font-medium">
                {ticket?.description || "Sem descrição detalhada."}
              </p>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <User size={18} className="text-slate-400 shrink-0" />
                <div className="truncate">
                  <p className="text-[11px] font-bold text-slate-400 uppercase">Solicitante</p>
                  <p className="text-xs font-bold text-slate-800 truncate">{ticket?.requester_name || "Desconhecido"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <Wrench size={18} className="text-slate-400 shrink-0" />
                <div className="truncate">
                  <p className="text-[11px] font-bold text-slate-400 uppercase">Técnico</p>
                  <p className="text-xs font-bold text-slate-800 truncate">{ticket?.technician_name || "Não atribuído"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <Tag size={18} className="text-slate-400 shrink-0" />
                <div className="truncate">
                  <p className="text-[11px] font-bold text-slate-400 uppercase">Categoria</p>
                  <p className="text-xs font-bold text-slate-800 truncate">{ticket?.category_name || "Geral"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <AlertCircle size={18} className="text-slate-400 shrink-0" />
                <div className="truncate">
                  <p className="text-[11px] font-bold text-slate-400 uppercase">Prioridade</p>
                  <p className="text-xs font-bold text-slate-800 truncate">{ticket?.priority || "Média"}</p>
                </div>
              </div>
            </div>

            {/* Quick Status Action Bar */}
            {ticket?.status !== "Fechado" && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Alterar Status Rápido</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    disabled={updating || ticket?.status === "Em Andamento"}
                    onClick={() => handleStatusChange("Em Andamento")}
                    className="py-2.5 px-3 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold text-xs border border-amber-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
                  >
                    <Clock size={14} /> Em Andamento
                  </button>
                  <button
                    disabled={updating || ticket?.status === "Aguardando Validação"}
                    onClick={() => handleStatusChange("Aguardando Validação")}
                    className="py-2.5 px-3 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold text-xs border border-purple-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
                  >
                    <ShieldCheck size={14} /> Validar
                  </button>
                  <button
                    disabled={updating}
                    onClick={() => handleStatusChange("Fechado")}
                    className="py-2.5 px-3 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs border border-emerald-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
                  >
                    <CheckCircle size={14} /> Concluir
                  </button>
                </div>
              </div>
            )}

            {/* Attachments Section */}
            {ticket?.attachments && ticket.attachments.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Tag size={16} className="text-slate-400" /> Anexos do Chamado
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {ticket.attachments.map(att => (
                    <a 
                      key={att.id} 
                      href={`http://localhost:8000${att.file_path}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="block border border-slate-200 rounded-xl overflow-hidden hover:border-blue-400 transition-colors group"
                    >
                      {att.content_type.includes("image") ? (
                        <div className="h-32 bg-slate-100 relative">
                          <img src={`http://localhost:8000${att.file_path}`} alt={att.file_name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="h-32 bg-slate-100 flex flex-col items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors">
                          <AlertCircle size={32} />
                          <span className="text-xs font-bold mt-2">Visualizar PDF</span>
                        </div>
                      )}
                      <div className="p-2 bg-white">
                        <p className="text-[10px] font-bold text-slate-600 truncate" title={att.file_name}>{att.file_name}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Interactions / Timeline History */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-900">Histórico & Comentários</h3>
              
              <div className="space-y-3">
                {(!ticket?.interactions || ticket.interactions.length === 0) ? (
                  <p className="text-xs text-slate-400 font-medium italic">Nenhum comentário adicionado ainda.</p>
                ) : (
                  ticket.interactions.map((i) => (
                    <div key={i.id} className={`p-3 rounded-xl border space-y-1 ${
                      i.is_solution
                        ? "bg-emerald-50 border-emerald-200"
                        : "bg-slate-50 border-slate-100"
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">
                          {i.is_solution && "✅ "}
                          Usuário #{i.user_id}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {new Date(i.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium">{i.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        {/* Drawer Footer (New Comment Input) */}
        <form onSubmit={handleAddComment} className="p-4 border-t border-slate-100 bg-white flex items-center gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Escreva uma resposta ou atualização..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 outline-none focus:border-blue-400 transition-colors font-medium"
          />
          <button
            type="submit"
            disabled={updating || !newComment.trim()}
            className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
          >
            <Send size={16} />
          </button>
        </form>

      </div>
    </div>
  );
}
