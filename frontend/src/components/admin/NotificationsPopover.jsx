import { useState, useEffect, useRef, useMemo } from "react";
import { 
  Bell, CheckCheck, RefreshCw, AlertTriangle, ShieldAlert, 
  Clock, CheckCircle2, ArrowRight, ExternalLink, Activity,
  Layers, Radio, Wifi, ChevronRight, X
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";

// Formatação amigável de tempo relativo
function getRelativeTime(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSecs = Math.floor((now.getTime() - d.getTime()) / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "agora mesmo";
    if (diffMins < 60) return `há ${diffMins} min`;
    if (diffHours < 24) return `há ${diffHours}h`;
    if (diffDays === 1) return "ontem";
    if (diffDays < 7) return `há ${diffDays}d`;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch {
    return "";
  }
}

export default function NotificationsPopover() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all"); // "all" | "noc" | "pending"
  const [data, setData] = useState({
    active_count: 0,
    critical_count: 0,
    pending_validation_count: 0,
    items: [],
  });

  const popoverRef = useRef(null);

  // Armazenamento de IDs lidos no localStorage
  const [readIds, setReadIds] = useState(() => {
    try {
      const saved = localStorage.getItem("tihfsa_read_notifications");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveReadIds = (ids) => {
    setReadIds(ids);
    try {
      localStorage.setItem("tihfsa_read_notifications", JSON.stringify(ids));
    } catch (e) {
      console.error(e);
    }
  };

  // Buscar dados da API
  const fetchNotifications = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const res = await api.get("/tickets/notifications?limit=25");
      if (res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error("[Notifications] Erro ao carregar:", err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Atualização em background a cada 30 segundos
    const timer = setInterval(() => {
      fetchNotifications(true);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Fechar ao clicar fora ou pressionar Escape
  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Contagem de não lidas
  const unreadItems = useMemo(() => {
    return (data.items || []).filter(item => !readIds.includes(item.id));
  }, [data.items, readIds]);

  const unreadCount = unreadItems.length;
  const hasCriticalUnread = unreadItems.some(item => item.category === "noc_critical" || item.priority === "Crítica");

  // Filtros de abas
  const filteredItems = useMemo(() => {
    const list = data.items || [];
    if (activeTab === "noc") {
      return list.filter(item => item.is_noc || item.priority === "Crítica");
    }
    if (activeTab === "pending") {
      return list.filter(item => item.status === "Aguardando Validação" || item.status === "Novo");
    }
    return list;
  }, [data.items, activeTab]);

  // Ações
  const handleMarkAllAsRead = () => {
    const allIds = (data.items || []).map(i => i.id);
    const newRead = Array.from(new Set([...readIds, ...allIds]));
    saveReadIds(newRead);
  };

  const handleItemClick = (item) => {
    if (!readIds.includes(item.id)) {
      saveReadIds([...readIds, item.id]);
    }
    setIsOpen(false);
    navigate(`/admin/tickets?ticketId=${item.id}`);
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Botão Gatilho (Sino) */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications(true);
        }}
        className={`relative p-2 rounded-xl transition-all cursor-pointer shrink-0 ${
          isOpen
            ? "text-blue-600 bg-blue-50"
            : "text-slate-400 hover:text-blue-600 hover:bg-slate-50"
        }`}
        title="Notificações & Alertas NOC"
      >
        <Bell size={20} className={hasCriticalUnread ? "text-amber-500 animate-pulse" : ""} />

        {/* Badge de Não Lidas */}
        {unreadCount > 0 && (
          <span 
            className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center border-2 border-white shadow-sm ${
              hasCriticalUnread 
                ? "bg-red-500 text-white animate-bounce" 
                : "bg-blue-600 text-white"
            }`}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-[420px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header do Popover */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400 flex items-center justify-center">
                <Bell size={16} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm tracking-tight text-white">Central de Alertas & NOC</h3>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/20 text-red-300 border border-red-500/30">
                      {unreadCount} nova{unreadCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">Notificações em tempo real da infraestrutura</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleMarkAllAsRead}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Marcar todas como lidas"
              >
                <CheckCheck size={16} />
              </button>
              <button
                onClick={() => fetchNotifications(false)}
                className={`p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer ${loading ? "animate-spin text-blue-400" : ""}`}
                title="Atualizar notificações"
              >
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {/* Abas de Filtro */}
          <div className="px-3 pt-2.5 pb-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === "all"
                  ? "bg-white text-blue-700 shadow-sm border border-slate-200 font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              Todas ({(data.items || []).length})
            </button>
            <button
              onClick={() => setActiveTab("noc")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "noc"
                  ? "bg-red-50 text-red-700 shadow-sm border border-red-200 font-bold"
                  : "text-slate-600 hover:text-red-700 hover:bg-slate-200/60"
              }`}
            >
              <span>🚨 Alertas NOC</span>
              {data.critical_count > 0 && (
                <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center">
                  {data.critical_count}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("pending")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "pending"
                  ? "bg-amber-50 text-amber-800 shadow-sm border border-amber-200 font-bold"
                  : "text-slate-600 hover:text-amber-800 hover:bg-slate-200/60"
              }`}
            >
              <span>⏳ Pendentes</span>
              {data.pending_validation_count > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center">
                  {data.pending_validation_count}
                </span>
              )}
            </button>
          </div>

          {/* Lista com Rolagem */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {loading && (data.items || []).length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-500" />
                <p className="text-xs font-medium">Carregando alertas...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-12 px-6 text-center text-slate-500">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 border border-emerald-100">
                  <CheckCircle2 size={24} />
                </div>
                <p className="text-sm font-bold text-slate-800">Nenhum alerta pendente</p>
                <p className="text-xs text-slate-400 mt-1 max-w-[240px] mx-auto">
                  Todos os dispositivos e chamados estão em dia e operando normalmente.
                </p>
              </div>
            ) : (
              filteredItems.map((item) => {
                const isUnread = !readIds.includes(item.id);
                const isNocCritical = item.category === "noc_critical" || item.priority === "Crítica";
                const isPendingValidation = item.status === "Aguardando Validação";
                const isNew = item.status === "Novo";

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-start gap-3 relative ${
                      isUnread ? "bg-blue-50/30" : ""
                    }`}
                  >
                    {/* Indicador de não lido */}
                    {isUnread && (
                      <span className="absolute left-1.5 top-5 w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                    )}

                    {/* Ícone de Categoria */}
                    <div className="shrink-0 mt-0.5">
                      {isNocCritical ? (
                        <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 border border-red-200 flex items-center justify-center shadow-xs">
                          <ShieldAlert size={16} />
                        </div>
                      ) : item.is_noc ? (
                        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center shadow-xs">
                          <Activity size={16} />
                        </div>
                      ) : isPendingValidation ? (
                        <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center shadow-xs">
                          <Clock size={16} />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center shadow-xs">
                          <AlertTriangle size={16} />
                        </div>
                      )}
                    </div>

                    {/* Conteúdo da Notificação */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className={`text-xs font-bold truncate ${isUnread ? "text-slate-900 font-extrabold" : "text-slate-700"}`}>
                          {item.title}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium ml-1">
                          {getRelativeTime(item.created_at)}
                        </span>
                      </div>

                      {item.summary && (
                        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                          {item.summary}
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                        <span 
                          className={`px-1.5 py-0.5 rounded-md font-bold ${
                            item.priority === "Crítica" 
                              ? "bg-red-100 text-red-700" 
                              : item.priority === "Alta" 
                              ? "bg-amber-100 text-amber-800" 
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {item.priority}
                        </span>

                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                          {item.status}
                        </span>

                        {item.asset_name && (
                          <span className="text-slate-400 truncate max-w-[120px]">
                            • {item.asset_name}
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight size={14} className="text-slate-300 self-center shrink-0" />
                  </div>
                );
              })
            )}
          </div>

          {/* Rodapé do Popover */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate("/admin/tickets");
              }}
              className="w-full py-1.5 px-3 rounded-xl text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Ver todos os chamados no painel</span>
              <ArrowRight size={14} />
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
