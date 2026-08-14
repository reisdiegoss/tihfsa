/**
 * TicketDetailDrawer — Painel lateral de detalhe do chamado com Linha do Tempo (Timeline),
 * exibição do nome de quem enviou, suporte a MÚLTIPLOS anexos por mensagem e visualizador interno de mídia/PDF.
 */
import { useState, useEffect, useRef } from "react";
import { 
  X, Send, User, Tag, AlertCircle, Clock, CheckCircle, 
  ShieldCheck, Wrench, Paperclip, FileText, Download,
  MessageSquare, Sparkles, Eye, PlusCircle, Trash2
} from "lucide-react";
import api from "../../api/client";
import MediaViewerModal from "../ui/MediaViewerModal";

export default function TicketDetailDrawer({ ticketId, onClose, onUpdate }) {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [updating, setUpdating] = useState(false);

  // Estado do Visualizador Interno Universal
  const [viewerFile, setViewerFile] = useState(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

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

  // Handler para auto-expansão dinâmica da área de texto de comentário
  const handleCommentChange = (e) => {
    setNewComment(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.max(42, textareaRef.current.scrollHeight)}px`;
    }
  };

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    try {
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
    if (!newComment.trim() && selectedFiles.length === 0) return;
    setUpdating(true);

    try {
      let createdInteractionId = null;

      // 1. Enviar mensagem de comentário se houver texto
      if (newComment.trim()) {
        const interactionRes = await api.post(`/tickets/${ticketId}/interactions`, { message: newComment });
        createdInteractionId = interactionRes.data.id;
      }

      // 2. Enviar MÚLTIPLOS arquivos selecionados vinculados a este balão de mensagem
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append("file", file);
        if (createdInteractionId) {
          formData.append("interaction_id", createdInteractionId);
        }
        await api.post(`/tickets/${ticketId}/attachments`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      }

      setSelectedFiles([]);
      setNewComment("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      fetchTicket();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
      alert("Erro ao registrar comentário ou enviar anexos.");
    } finally {
      setUpdating(false);
    }
  };

  const handleFileSelect = (e) => {
    const pickedFiles = Array.from(e.target.files || []);
    if (pickedFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...pickedFiles]);
    }
    e.target.value = ""; // Limpa a seleção do input para permitir selecionar o mesmo arquivo novamente se desejar
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const openInternalViewer = (att) => {
    setViewerFile({
      name: att.file_name,
      url: `http://localhost:8000${att.file_path}`,
      type: att.content_type
    });
    setIsViewerOpen(true);
  };

  if (!ticketId) return null;

  const getRoleBadge = (roleStr) => {
    const r = (roleStr || "").toLowerCase();
    if (r.includes("admin")) return <span className="text-[10px] font-extrabold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Admin</span>;
    if (r.includes("tech") || r.includes("tecnico")) return <span className="text-[10px] font-extrabold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Técnico</span>;
    if (r.includes("manager") || r.includes("gerente")) return <span className="text-[10px] font-extrabold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Gestor</span>;
    return <span className="text-[10px] font-extrabold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Solicitante</span>;
  };

  // Anexos iniciais da abertura do chamado (sem interaction_id)
  const initialAttachments = ticket?.attachments?.filter(a => !a.interaction_id) || [];

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end transition-opacity">
        <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
          
          {/* Drawer Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Chamado #{ticketId}</span>
              <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${
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
            <div className="flex-1 p-8 flex flex-col items-center justify-center text-slate-400 font-semibold gap-3">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span>Carregando detalhes do chamado...</span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Title */}
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 mb-1">{ticket?.title}</h2>
              </div>

              {/* Information Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <User size={18} className="text-blue-600 shrink-0" />
                  <div className="truncate">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Solicitante</p>
                    <p className="text-xs font-extrabold text-slate-900 truncate" title={ticket?.requester_name}>
                      {ticket?.requester_name || "Desconhecido"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <Wrench size={18} className="text-amber-600 shrink-0" />
                  <div className="truncate">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Técnico</p>
                    <p className="text-xs font-extrabold text-slate-900 truncate" title={ticket?.technician_name}>
                      {ticket?.technician_name || "Não atribuído"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <Tag size={18} className="text-purple-600 shrink-0" />
                  <div className="truncate">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Categoria</p>
                    <p className="text-xs font-extrabold text-slate-900 truncate">{ticket?.category_name || "Geral"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <AlertCircle size={18} className="text-red-500 shrink-0" />
                  <div className="truncate">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Prioridade</p>
                    <p className="text-xs font-extrabold text-slate-900 truncate">{ticket?.priority || "Média"}</p>
                  </div>
                </div>
              </div>

              {/* Quick Status Action Bar */}
              {ticket?.status !== "Fechado" && (
                <div className="space-y-2">
                  <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Alterar Status Rápido</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      disabled={updating || ticket?.status === "Em Andamento"}
                      onClick={() => handleStatusChange("Em Andamento")}
                      className="py-2.5 px-3 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 font-extrabold text-xs border border-amber-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
                    >
                      <Clock size={14} /> Em Andamento
                    </button>
                    <button
                      disabled={updating || ticket?.status === "Aguardando Validação"}
                      onClick={() => handleStatusChange("Aguardando Validação")}
                      className="py-2.5 px-3 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 font-extrabold text-xs border border-purple-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
                    >
                      <ShieldCheck size={14} /> Validar
                    </button>
                    <button
                      disabled={updating}
                      onClick={() => handleStatusChange("Fechado")}
                      className="py-2.5 px-3 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-extrabold text-xs border border-emerald-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
                    >
                      <CheckCircle size={14} /> Concluir
                    </button>
                  </div>
                </div>
              )}

              {/* TIMELINE HISTÓRICO & COMENTÁRIOS */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare size={14} className="text-blue-600" /> Linha do Tempo & Histórico
                  </h3>
                  <span className="text-[11px] font-bold text-slate-400">
                    {(ticket?.interactions?.length || 0) + 1} evento{(ticket?.interactions?.length || 0) !== 0 ? "s" : ""}
                  </span>
                </div>
                
                {/* Vertical Timeline Container */}
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  
                  {/* Evento 0: Abertura do Chamado pelo Solicitante */}
                  <div className="relative group">
                    <div className="absolute -left-6 top-1 w-5 h-5 rounded-full border-2 border-blue-600 bg-blue-50 text-blue-600 flex items-center justify-center z-10">
                      <PlusCircle size={12} />
                    </div>

                    <div className="p-4 rounded-2xl border border-blue-100 bg-blue-50/40">
                      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-xs">{ticket?.requester_name || "Solicitante"}</span>
                          <span className="text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">Abertura do Chamado</span>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-400">
                          {new Date(ticket.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                        {ticket?.description || "Sem descrição detalhada."}
                      </p>

                      {/* Anexos Iniciais da Abertura do Chamado */}
                      {initialAttachments.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-blue-100 grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {initialAttachments.map(att => (
                            <div
                              key={att.id}
                              onClick={() => openInternalViewer(att)}
                              className="border border-slate-200 bg-white rounded-xl overflow-hidden hover:border-blue-500 transition-all cursor-pointer group/att shadow-2xs"
                            >
                              {att.content_type.includes("image") ? (
                                <div className="h-24 bg-slate-100 relative overflow-hidden">
                                  <img src={`http://localhost:8000${att.file_path}`} alt={att.file_name} className="w-full h-full object-cover group-hover/att:scale-105 transition-transform" />
                                  <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover/att:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold gap-1">
                                    <Eye size={14} /> Visualizar
                                  </div>
                                </div>
                              ) : (
                                <div className="h-24 bg-slate-50 flex flex-col items-center justify-center text-slate-400 p-2 group-hover/att:text-blue-600 transition-colors">
                                  <FileText size={28} />
                                  <span className="text-[10px] font-bold text-slate-600 mt-1 truncate max-w-full">Documento PDF</span>
                                </div>
                              )}
                              <div className="p-2 bg-white border-t border-slate-100 flex items-center justify-between">
                                <p className="text-[10px] font-bold text-slate-700 truncate" title={att.file_name}>{att.file_name}</p>
                                <Eye size={12} className="text-blue-600 shrink-0" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Interações / Comentários Adicionais */}
                  {ticket?.interactions?.map((item) => {
                    const dateStr = new Date(item.created_at).toLocaleString("pt-BR", {
                      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
                    });
                    const userName = item.user_name || `Usuário #${item.user_id}`;

                    return (
                      <div key={item.id} className="relative group">
                        
                        {/* Timeline Node Icon */}
                        <div className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 bg-white flex items-center justify-center z-10 ${
                          item.is_solution
                            ? "border-emerald-500 text-emerald-600 bg-emerald-50"
                            : "border-blue-500 text-blue-600"
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${item.is_solution ? "bg-emerald-500" : "bg-blue-600"}`} />
                        </div>

                        {/* Message Card / Bubble */}
                        <div className={`p-4 rounded-2xl border transition-all ${
                          item.is_solution
                            ? "bg-emerald-50/70 border-emerald-200 shadow-xs"
                            : "bg-slate-50/80 border-slate-200/80 hover:bg-slate-50"
                        }`}>
                          
                          {/* Header: User Name + Role Badge + Timestamp */}
                          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 text-xs">{userName}</span>
                              {getRoleBadge(item.user_role)}
                              {item.is_solution && (
                                <span className="text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                  <Sparkles size={10} /> Solução
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-semibold text-slate-400">{dateStr}</span>
                          </div>

                          {/* Message Content */}
                          {item.message && (
                            <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                              {item.message}
                            </p>
                          )}

                          {/* Anexos Múltiplos Dentro do Próprio Balão da Mensagem */}
                          {item.attachments && item.attachments.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-200/60 grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {item.attachments.map(att => (
                                <div
                                  key={att.id}
                                  onClick={() => openInternalViewer(att)}
                                  className="border border-slate-200 bg-white rounded-xl overflow-hidden hover:border-blue-500 transition-all cursor-pointer group/att shadow-2xs"
                                >
                                  {att.content_type.includes("image") ? (
                                    <div className="h-24 bg-slate-100 relative overflow-hidden">
                                      <img src={`http://localhost:8000${att.file_path}`} alt={att.file_name} className="w-full h-full object-cover group-hover/att:scale-105 transition-transform" />
                                      <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover/att:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold gap-1">
                                        <Eye size={14} /> Visualizar
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="h-24 bg-slate-50 flex flex-col items-center justify-center text-slate-400 p-2 group-hover/att:text-blue-600 transition-colors">
                                      <FileText size={28} />
                                      <span className="text-[10px] font-bold text-slate-600 mt-1 truncate max-w-full">Documento PDF</span>
                                    </div>
                                  )}
                                  <div className="p-2 bg-white border-t border-slate-100 flex items-center justify-between">
                                    <p className="text-[10px] font-bold text-slate-700 truncate" title={att.file_name}>{att.file_name}</p>
                                    <Eye size={12} className="text-blue-600 shrink-0" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* Drawer Footer — Campo de Resposta Expansível & Múltiplos Anexos */}
          <div className="p-4 border-t border-slate-100 bg-white">
            
            {/* Lista de Múltiplos Arquivos Selecionados */}
            {selectedFiles.length > 0 && (
              <div className="mb-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-blue-700 uppercase tracking-wider">
                    {selectedFiles.length} anexo{selectedFiles.length > 1 ? "s" : ""} selecionado{selectedFiles.length > 1 ? "s" : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedFiles([])}
                    className="text-[11px] font-bold text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                  >
                    Limpar todos
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {selectedFiles.map((file, i) => (
                    <div key={i} className="p-2 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-1.5 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Paperclip size={14} className="text-blue-600 shrink-0" />
                        <div className="truncate">
                          <p className="text-xs font-extrabold text-blue-900 truncate" title={file.name}>{file.name}</p>
                          <p className="text-[9px] font-semibold text-blue-600">{(file.size / 1024).toFixed(0)} KB</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSelectedFile(i)}
                        className="p-1 text-blue-400 hover:text-red-600 rounded-full transition-colors shrink-0 cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleAddComment} className="flex items-end gap-2">
              
              {/* Input oculto de arquivo com suporte a seleção múltipla */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
              />

              {/* Botão de Anexo */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-xl transition-colors shrink-0 cursor-pointer relative"
                title="Anexar Imagem(ns) ou PDF(s)"
              >
                <Paperclip size={18} />
                {selectedFiles.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-extrabold flex items-center justify-center">
                    {selectedFiles.length}
                  </span>
                )}
              </button>

              {/* Dynamic Auto-Expanding Textarea */}
              <textarea
                ref={textareaRef}
                rows={1}
                value={newComment}
                onChange={handleCommentChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAddComment(e);
                  }
                }}
                placeholder="Escreva uma mensagem ou atualização (Pressione Enter para enviar)..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all font-medium resize-none overflow-hidden min-h-[42px] max-h-[160px]"
              />

              {/* Botão de Envio */}
              <button
                type="submit"
                disabled={updating || (!newComment.trim() && selectedFiles.length === 0)}
                className="p-3 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 transition-colors shrink-0 cursor-pointer font-bold shadow-md shadow-blue-600/20"
              >
                <Send size={18} />
              </button>
            </form>
          </div>

        </div>
      </div>

      {/* Visualizador Interno Universal Modal */}
      <MediaViewerModal
        isOpen={isViewerOpen}
        file={viewerFile}
        onClose={() => {
          setIsViewerOpen(false);
          setViewerFile(null);
        }}
      />
    </>
  );
}
