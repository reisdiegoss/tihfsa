import { useState, useEffect } from "react";
import { X, Send, User, MapPin, Tag, AlertCircle, Clock, CheckCircle, ShieldCheck } from "lucide-react";
import api from "../../api/client";

export default function TicketDetailDrawer({ ticketId, onClose, onUpdate }) {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!ticketId) return;
    setLoading(true);
    api.get(`/tickets/${ticketId}`)
      .then((r) => setTicket(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ticketId]);

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    try {
      await api.patch(`/tickets/${ticketId}/status`, { status: newStatus });
      const updated = await api.get(`/tickets/${ticketId}`);
      setTicket(updated.data);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setUpdating(true);
    try {
      await api.post(`/tickets/${ticketId}/comments`, { content: newComment });
      setNewComment("");
      const updated = await api.get(`/tickets/${ticketId}`);
      setTicket(updated.data);
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
              ticket?.status === "Aguardando Validacao" ? "bg-purple-100 text-purple-700" :
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
                <MapPin size={18} className="text-slate-400 shrink-0" />
                <div className="truncate">
                  <p className="text-[11px] font-bold text-slate-400 uppercase">Localização</p>
                  <p className="text-xs font-bold text-slate-800 truncate">Apt {ticket?.apartment_number || "N/A"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <Tag size={18} className="text-slate-400 shrink-0" />
                <div className="truncate">
                  <p className="text-[11px] font-bold text-slate-400 uppercase">Categoria</p>
                  <p className="text-xs font-bold text-slate-800 truncate">{ticket?.category || "Geral"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <AlertCircle size={18} className="text-slate-400 shrink-0" />
                <div className="truncate">
                  <p className="text-[11px] font-bold text-slate-400 uppercase">Prioridade</p>
                  <p className="text-xs font-bold text-slate-800 truncate">{ticket?.priority || "Normal"}</p>
                </div>
              </div>
            </div>

            {/* Quick Status Action Bar */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Alterar Status Rápido</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  disabled={updating}
                  onClick={() => handleStatusChange("Em Andamento")}
                  className="py-2.5 px-3 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold text-xs border border-amber-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Clock size={14} /> Em Andamento
                </button>
                <button
                  disabled={updating}
                  onClick={() => handleStatusChange("Aguardando Validacao")}
                  className="py-2.5 px-3 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold text-xs border border-purple-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck size={14} /> Validar Solução
                </button>
                <button
                  disabled={updating}
                  onClick={() => handleStatusChange("Fechado")}
                  className="py-2.5 px-3 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs border border-emerald-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle size={14} /> Concluir
                </button>
              </div>
            </div>

            {/* Comments / Timeline History */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-900">Histórico & Comentários</h3>
              
              <div className="space-y-3">
                {ticket?.comments?.length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium italic">Nenhum comentário adicionado ainda.</p>
                ) : (
                  ticket?.comments?.map((c) => (
                    <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">{c.author_name}</span>
                        <span className="text-[10px] font-semibold text-slate-400">{c.created_at}</span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium">{c.content}</p>
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
