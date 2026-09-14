import { useState, useEffect, useMemo, useRef } from "react";
import { 
  Search, Plus, FileText, ChevronRight, RefreshCw, 
  ArrowUpDown, ArrowUp, ArrowDown, Calendar, Clock, 
  Filter, X, RotateCcw, SlidersHorizontal, Tag, 
  Layers, AlertTriangle, ChevronLeft, ChevronsLeft, 
  ChevronsRight, CheckCircle2, User, Radio, Activity, Wifi,
  CheckSquare, Square, MinusSquare, ShieldCheck, MessageSquare, Send
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../contexts/AuthContext";
import TicketDetailDrawer from "../../components/admin/TicketDetailDrawer";

// Formatação robusta de Data e Hora
function formatDateTime(dateStr) {
  if (!dateStr) return { date: "—", time: "—", full: "—", relative: "", isToday: false };
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { date: "—", time: "—", full: "—", relative: "", isToday: false };

    const date = d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const time = d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const full = `${date} ${time}`;

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let relative = "";
    if (diffMins < 1) relative = "agora mesmo";
    else if (diffMins < 60) relative = `há ${diffMins} min`;
    else if (diffHours < 24) relative = `há ${diffHours} h`;
    else if (diffDays === 1) relative = "ontem";
    else if (diffDays < 7) relative = `há ${diffDays} dias`;
    else relative = date;

    const isToday = now.toDateString() === d.toDateString();

    return { date, time, full, relative, isToday };
  } catch {
    return { date: dateStr, time: "", full: dateStr, relative: "", isToday: false };
  }
}

// Pesos para ordenação de prioridade
const PRIORITY_WEIGHTS = {
  "Crítica": 4,
  "Alta": 3,
  "Média": 2,
  "Baixa": 1,
};

// Pesos para ordenação de status
const STATUS_WEIGHTS = {
  "Novo": 1,
  "Em Andamento": 2,
  "Aguardando Validação": 3,
  "Fechado": 4,
  "Rejeitado": 5,
};

export default function TicketList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isStaff } = useAuth();

  // Dados
  const [tickets, setTickets] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTicketId, setActiveTicketId] = useState(null);

  // Abre o drawer se ticketId estiver na URL (ex: via notificação)
  useEffect(() => {
    const tid = searchParams.get("ticketId");
    if (tid) {
      const parsed = parseInt(tid, 10);
      if (!isNaN(parsed) && parsed > 0) {
        setActiveTicketId(parsed);
      }
    }
  }, [searchParams]);

  const handleCloseDrawer = () => {
    setActiveTicketId(null);
    if (searchParams.get("ticketId")) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("ticketId");
      setSearchParams(newParams, { replace: true });
    }
  };

  // Estados de Filtro
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("Todos");
  const [selectedPriority, setSelectedPriority] = useState("Todas");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [selectedOrigin, setSelectedOrigin] = useState("Todas");
  const [dateFilter, setDateFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Estados de Ordenação (Padrão: Data/Hora decrescente - mais recentes primeiro)
  const [sortField, setSortField] = useState("created_at");
  const [sortDirection, setSortDirection] = useState("desc");

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Seleção Múltipla para Ações em Massa (Batch Actions)
  const [selectedTicketIds, setSelectedTicketIds] = useState([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchTargetStatus, setBatchTargetStatus] = useState("Em Andamento");
  const [batchComment, setBatchComment] = useState("");
  const [batchNotifyWhatsapp, setBatchNotifyWhatsapp] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchToast, setBatchToast] = useState(null);

  const fetchTickets = () => {
    setLoading(true);
    // Busca ampla de até 1000 chamados para filtragem e ordenação instantâneas no client
    api.get("/tickets?limit=1000")
      .then((r) => setTickets(Array.isArray(r.data) ? r.data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchCategories = () => {
    api.get("/categories/")
      .then((r) => setCategoriesList(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  };

  useEffect(() => {
    fetchTickets();
    fetchCategories();
  }, []);

  // Lista unificada de categorias
  const availableCategories = useMemo(() => {
    const set = new Set();
    categoriesList.forEach((c) => {
      if (c && c.name) set.add(c.name);
    });
    tickets.forEach((t) => {
      if (t.category_name) set.add(t.category_name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [categoriesList, tickets]);

  // Contadores de status em tempo real
  const statusCounts = useMemo(() => {
    const counts = {
      Todos: tickets.length,
      Novo: 0,
      "Em Andamento": 0,
      "Aguardando Validação": 0,
      Fechado: 0,
    };
    tickets.forEach((t) => {
      if (counts[t.status] !== undefined) {
        counts[t.status]++;
      }
    });
    return counts;
  }, [tickets]);

  // Detector de filtros ativos
  const hasActiveFilters = useMemo(() => {
    return (
      searchTerm.trim() !== "" ||
      selectedStatus !== "Todos" ||
      selectedPriority !== "Todas" ||
      selectedCategory !== "Todas" ||
      selectedOrigin !== "Todas" ||
      dateFilter !== "all" ||
      customStartDate !== "" ||
      customEndDate !== "" ||
      sortField !== "created_at" ||
      sortDirection !== "desc"
    );
  }, [
    searchTerm,
    selectedStatus,
    selectedPriority,
    selectedCategory,
    selectedOrigin,
    dateFilter,
    customStartDate,
    customEndDate,
    sortField,
    sortDirection,
  ]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim() !== "") count++;
    if (selectedStatus !== "Todos") count++;
    if (selectedPriority !== "Todas") count++;
    if (selectedCategory !== "Todas") count++;
    if (selectedOrigin !== "Todas") count++;
    if (dateFilter !== "all") count++;
    if (sortField !== "created_at" || sortDirection !== "desc") count++;
    return count;
  }, [
    searchTerm,
    selectedStatus,
    selectedPriority,
    selectedCategory,
    selectedOrigin,
    dateFilter,
    sortField,
    sortDirection,
  ]);

  // Limpeza de todos os filtros
  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedStatus("Todos");
    setSelectedPriority("Todas");
    setSelectedCategory("Todas");
    setSelectedOrigin("Todas");
    setDateFilter("all");
    setCustomStartDate("");
    setCustomEndDate("");
    setSortField("created_at");
    setSortDirection("desc");
    setCurrentPage(1);
  };

  // Alternador de ordenação por coluna
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      // Colunas de data, id e prioridade iniciam desc; texto inicia asc
      if (["created_at", "id", "priority"].includes(field)) {
        setSortDirection("desc");
      } else {
        setSortDirection("asc");
      }
    }
    setCurrentPage(1);
  };

  // Filtragem e Ordenação
  const processedTickets = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    return tickets
      .filter((t) => {
        // 1. Busca textual
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchesTitle = t.title?.toLowerCase().includes(term);
          const matchesId = t.id?.toString().includes(term);
          const matchesRequester = t.requester_name?.toLowerCase().includes(term);
          const matchesCategory = t.category_name?.toLowerCase().includes(term);
          const matchesTech = t.technician_name?.toLowerCase().includes(term);
          const matchesDesc = t.description?.toLowerCase().includes(term);

          if (!matchesTitle && !matchesId && !matchesRequester && !matchesCategory && !matchesTech && !matchesDesc) {
            return false;
          }
        }

        // 2. Status
        if (selectedStatus !== "Todos" && t.status !== selectedStatus) {
          return false;
        }

        // 3. Prioridade
        if (selectedPriority !== "Todas" && t.priority !== selectedPriority) {
          return false;
        }

        // 4. Categoria
        if (selectedCategory !== "Todas" && (t.category_name || "Geral") !== selectedCategory) {
          return false;
        }

        // 5. Origem / Tipo de Alerta
        if (selectedOrigin !== "Todas") {
          const title = t.title || "";
          const req = t.requester_name || "";
          const isZabbix = title.includes("[NOC Zabbix]") || req.toLowerCase().includes("zabbix");
          const isUniFi = title.includes("[NOC UniFi]") || req.toLowerCase().includes("unifi");
          const isAtivoAuto = title.includes("NOC Auto-Alerta") || title.includes("Ativo");

          if (selectedOrigin === "Zabbix" && !isZabbix) return false;
          if (selectedOrigin === "UniFi" && !isUniFi) return false;
          if (selectedOrigin === "Ativos" && !isAtivoAuto) return false;
          if (selectedOrigin === "Manuais" && (isZabbix || isUniFi || isAtivoAuto)) return false;
        }

        // 6. Data e Hora
        if (dateFilter !== "all" && t.created_at) {
          const ticketDate = new Date(t.created_at);
          const ticketTime = ticketDate.getTime();

          if (dateFilter === "today") {
            if (ticketDate < todayStart) return false;
          } else if (dateFilter === "24h") {
            const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
            if (ticketTime < cutoff) return false;
          } else if (dateFilter === "7d") {
            const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
            if (ticketTime < cutoff) return false;
          } else if (dateFilter === "30d") {
            const cutoff = now.getTime() - 30 * 24 * 60 * 60 * 1000;
            if (ticketTime < cutoff) return false;
          } else if (dateFilter === "this_month") {
            if (ticketDate.getFullYear() !== now.getFullYear() || ticketDate.getMonth() !== now.getMonth()) {
              return false;
            }
          } else if (dateFilter === "custom") {
            if (customStartDate) {
              const start = new Date(`${customStartDate}T00:00:00`);
              if (ticketDate < start) return false;
            }
            if (customEndDate) {
              const end = new Date(`${customEndDate}T23:59:59`);
              if (ticketDate > end) return false;
            }
          }
        }

        return true;
      })
      .sort((a, b) => {
        let cmp = 0;

        switch (sortField) {
          case "created_at": {
            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
            cmp = timeA - timeB;
            break;
          }
          case "id": {
            cmp = (a.id || 0) - (b.id || 0);
            break;
          }
          case "priority": {
            const weightA = PRIORITY_WEIGHTS[a.priority] || 0;
            const weightB = PRIORITY_WEIGHTS[b.priority] || 0;
            cmp = weightA - weightB;
            break;
          }
          case "status": {
            const weightA = STATUS_WEIGHTS[a.status] || 0;
            const weightB = STATUS_WEIGHTS[b.status] || 0;
            cmp = weightA - weightB;
            break;
          }
          case "requester": {
            const reqA = a.requester_name || "";
            const reqB = b.requester_name || "";
            cmp = reqA.localeCompare(reqB, "pt-BR");
            break;
          }
          case "category": {
            const catA = a.category_name || "Geral";
            const catB = b.category_name || "Geral";
            cmp = catA.localeCompare(catB, "pt-BR");
            break;
          }
          case "title": {
            const titleA = a.title || "";
            const titleB = b.title || "";
            cmp = titleA.localeCompare(titleB, "pt-BR");
            break;
          }
          default:
            cmp = 0;
        }

        return sortDirection === "asc" ? cmp : -cmp;
      });
  }, [
    tickets,
    searchTerm,
    selectedStatus,
    selectedPriority,
    selectedCategory,
    selectedOrigin,
    dateFilter,
    customStartDate,
    customEndDate,
    sortField,
    sortDirection,
  ]);

  // Paginação dos resultados
  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(processedTickets.length / pageSize));
  const paginatedTickets = useMemo(() => {
    if (pageSize === "all") return processedTickets;
    const start = (currentPage - 1) * pageSize;
    return processedTickets.slice(start, start + pageSize);
  }, [processedTickets, currentPage, pageSize]);

  // Funções de Seleção de Linhas (Batch Actions)
  const isAllPageSelected = useMemo(() => {
    if (paginatedTickets.length === 0) return false;
    return paginatedTickets.every((t) => selectedTicketIds.includes(t.id));
  }, [paginatedTickets, selectedTicketIds]);

  const isSomePageSelected = useMemo(() => {
    return paginatedTickets.some((t) => selectedTicketIds.includes(t.id)) && !isAllPageSelected;
  }, [paginatedTickets, selectedTicketIds, isAllPageSelected]);

  const toggleSelectTicket = (id) => {
    setSelectedTicketIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllPage = () => {
    if (isAllPageSelected) {
      // Remove os da página atual
      const pageIds = new Set(paginatedTickets.map((t) => t.id));
      setSelectedTicketIds((prev) => prev.filter((id) => !pageIds.has(id)));
    } else {
      // Adiciona todos os da página atual
      const newIds = new Set([...selectedTicketIds, ...paginatedTickets.map((t) => t.id)]);
      setSelectedTicketIds(Array.from(newIds));
    }
  };

  const selectAllFiltered = () => {
    setSelectedTicketIds(processedTickets.map((t) => t.id));
  };

  const clearSelection = () => {
    setSelectedTicketIds([]);
  };

  // Executar Atualização em Massa no Backend
  const handleBatchStatusSubmit = async (e) => {
    e.preventDefault();
    if (selectedTicketIds.length === 0) return;

    setBatchLoading(true);
    try {
      const payload = {
        ticket_ids: selectedTicketIds,
        status: batchTargetStatus,
        comment: batchComment.trim() || null,
        notify_whatsapp: batchNotifyWhatsapp,
      };

      const res = await api.post("/tickets/batch-status", payload);

      setIsBatchModalOpen(false);
      setBatchComment("");
      setSelectedTicketIds([]);
      
      setBatchToast({
        type: "success",
        message: `${res.data.updated_count} chamados atualizados com sucesso para "${res.data.new_status}" com log de auditoria gravado!`,
      });
      setTimeout(() => setBatchToast(null), 5000);

      // Recarrega a fila
      fetchTickets();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || "Erro ao atualizar chamados em lote.";
      alert(msg);
    } finally {
      setBatchLoading(false);
    }
  };

  // Helper visual para ícone de ordenação no cabeçalho
  const renderSortHeader = (field, label, className = "") => {
    const isActive = sortField === field;
    return (
      <th
        onClick={() => handleSort(field)}
        className={`px-6 py-4 cursor-pointer select-none transition-colors hover:text-blue-600 group ${className}`}
        title={`Clique para ordenar por ${label}`}
      >
        <div className="flex items-center gap-1.5">
          <span className={isActive ? "text-blue-600 font-extrabold" : ""}>{label}</span>
          {isActive ? (
            sortDirection === "asc" ? (
              <ArrowUp size={14} className="text-blue-600 shrink-0" />
            ) : (
              <ArrowDown size={14} className="text-blue-600 shrink-0" />
            )
          ) : (
            <ArrowUpDown size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
          )}
        </div>
      </th>
    );
  };

  const statuses = ["Todos", "Novo", "Em Andamento", "Aguardando Validação", "Fechado"];

  return (
    <div className="space-y-6 pb-20 animate-fade-in relative">
      
      {/* Toast de Confirmação */}
      {batchToast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 animate-fade-in border border-emerald-500">
          <CheckCircle2 size={20} className="shrink-0 text-emerald-200" />
          <span className="text-xs font-bold">{batchToast.message}</span>
          <button 
            onClick={() => setBatchToast(null)} 
            className="ml-2 text-white/70 hover:text-white cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            Fila de Chamados de TI
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
              {tickets.length} total
            </span>
          </h1>
          <p className="text-sm font-semibold text-slate-500 mt-1">
            Gerencie, atribua e resolva solicitações do hotel com controle cronológico e auditoria completa
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchTickets}
            className="flex items-center gap-2 bg-white text-slate-700 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold shadow-xs hover:bg-slate-50 transition-colors cursor-pointer"
            title="Recarregar fila de chamados"
          >
            <RefreshCw size={16} className={loading ? "animate-spin text-blue-600" : ""} />
            Atualizar
          </button>
          <button
            onClick={() => navigate("/admin/tickets/new")}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-xs hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Novo Chamado
          </button>
        </div>
      </div>

      {/* Main Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
        {/* Row 1: Status Pills + Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Status Pills with Dynamic Counters */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {statuses.map((status) => {
              const count = statusCounts[status] || 0;
              const isSelected = selectedStatus === status;
              return (
                <button
                  key={status}
                  onClick={() => {
                    setSelectedStatus(status);
                    setCurrentPage(1);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span>{status}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-md text-[11px] font-extrabold ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-slate-200/80 text-slate-600"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Input and Filter Toggle */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl text-xs w-full sm:w-80 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Buscar por título, ID, solicitante, categoria..."
                className="bg-transparent text-slate-900 placeholder-slate-400 outline-none w-full font-medium"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Limpar busca"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                showAdvancedFilters || activeFiltersCount > 0
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal size={14} />
              <span>Filtros</span>
              {activeFiltersCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Row 2: Advanced Filters & Sorting Controls (Expandable / Visible) */}
        <div className={`pt-3 border-t border-slate-100 ${showAdvancedFilters ? "block" : "hidden sm:block"}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            
            {/* Filter: Período de Data/Hora */}
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
                <Calendar size={13} className="text-blue-600" />
                Data & Hora
              </label>
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-3 py-2 outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="all">Todo o período</option>
                <option value="today">Hoje (00h às 23:59)</option>
                <option value="24h">Últimas 24 horas</option>
                <option value="7d">Últimos 7 dias</option>
                <option value="30d">Últimos 30 dias</option>
                <option value="this_month">Este Mês</option>
                <option value="custom">Personalizado...</option>
              </select>
            </div>

            {/* Filter: Prioridade */}
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
                <AlertTriangle size={13} className="text-amber-500" />
                Prioridade
              </label>
              <select
                value={selectedPriority}
                onChange={(e) => {
                  setSelectedPriority(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-3 py-2 outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="Todas">Todas as prioridades</option>
                <option value="Crítica">Crítica (Imediata)</option>
                <option value="Alta">Alta</option>
                <option value="Média">Média</option>
                <option value="Baixa">Baixa</option>
              </select>
            </div>

            {/* Filter: Categoria */}
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
                <Tag size={13} className="text-purple-500" />
                Categoria
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-3 py-2 outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="Todas">Todas as categorias</option>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Filter: Origem / Alerta NOC */}
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
                <Activity size={13} className="text-emerald-500" />
                Origem do Chamado
              </label>
              <select
                value={selectedOrigin}
                onChange={(e) => {
                  setSelectedOrigin(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-3 py-2 outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="Todas">Todas as origens</option>
                <option value="Zabbix">Alertas NOC Zabbix</option>
                <option value="UniFi">Alertas NOC UniFi</option>
                <option value="Ativos">Auto-Alertas de Ativos</option>
                <option value="Manuais">Usuários / Manuais</option>
              </select>
            </div>

            {/* Quick Sort Dropdown */}
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
                <ArrowUpDown size={13} className="text-blue-600" />
                Ordenar por
              </label>
              <select
                value={`${sortField}_${sortDirection}`}
                onChange={(e) => {
                  const [field, dir] = e.target.value.split("_");
                  setSortField(field);
                  setSortDirection(dir);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-3 py-2 outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="created_at_desc">Data/Hora: Mais Recentes ↓</option>
                <option value="created_at_asc">Data/Hora: Mais Antigos ↑</option>
                <option value="id_desc">ID: Maior para Menor (#)</option>
                <option value="id_asc">ID: Menor para Maior (#)</option>
                <option value="priority_desc">Prioridade: Maior Gravidade</option>
                <option value="priority_asc">Prioridade: Menor Gravidade</option>
                <option value="status_asc">Status: Fluxo de Resolução</option>
                <option value="title_asc">Título (A-Z)</option>
              </select>
            </div>

          </div>

          {/* Inline Custom Date Inputs (when 'custom' is selected) */}
          {dateFilter === "custom" && (
            <div className="mt-3 pt-3 border-t border-dashed border-slate-200 flex flex-wrap items-center gap-3 bg-blue-50/40 p-3 rounded-xl">
              <span className="text-xs font-extrabold text-blue-900 flex items-center gap-1.5">
                <Calendar size={14} className="text-blue-600" />
                Intervalo Personalizado:
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">De:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 text-xs font-bold rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Até:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 text-xs font-bold rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Active Filters Bar and Clear Button */}
          {hasActiveFilters && (
            <div className="mt-3 pt-2.5 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-500">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-700">Filtros aplicados:</span>
                {searchTerm && (
                  <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold">
                    Busca: "{searchTerm}"
                  </span>
                )}
                {selectedStatus !== "Todos" && (
                  <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-semibold">
                    Status: {selectedStatus}
                  </span>
                )}
                {selectedPriority !== "Todas" && (
                  <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-semibold">
                    Prioridade: {selectedPriority}
                  </span>
                )}
                {selectedCategory !== "Todas" && (
                  <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md font-semibold">
                    Categoria: {selectedCategory}
                  </span>
                )}
                {selectedOrigin !== "Todas" && (
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-semibold">
                    Origem: {selectedOrigin}
                  </span>
                )}
                {dateFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-semibold">
                    Data: {dateFilter === "custom" ? `${customStartDate || "início"} até ${customEndDate || "hoje"}` : dateFilter}
                  </span>
                )}
                {(sortField !== "created_at" || sortDirection !== "desc") && (
                  <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-semibold">
                    Ordem: {sortField} ({sortDirection})
                  </span>
                )}
              </div>

              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1 text-red-600 hover:text-red-700 font-bold hover:underline cursor-pointer ml-auto"
              >
                <RotateCcw size={13} />
                Limpar todos os filtros
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Sub-header with Results Summary & Page Size */}
        <div className="px-6 py-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="font-semibold text-slate-500">
              Exibindo <span className="font-extrabold text-slate-800">{processedTickets.length}</span> de{" "}
              <span className="font-extrabold text-slate-800">{tickets.length}</span> chamados
              {hasActiveFilters && (
                <span className="text-blue-600 font-bold ml-1.5">(filtrado)</span>
              )}
            </div>

            {isStaff && selectedTicketIds.length > 0 && (
              <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
                <span className="font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                  {selectedTicketIds.length} selecionado{selectedTicketIds.length > 1 ? "s" : ""}
                </span>
                {selectedTicketIds.length < processedTickets.length && (
                  <button
                    onClick={selectAllFiltered}
                    className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
                  >
                    Selecionar todos os {processedTickets.length} filtrados
                  </button>
                )}
                <button
                  onClick={clearSelection}
                  className="text-slate-500 hover:text-slate-700 font-medium hover:underline cursor-pointer"
                >
                  Desmarcar
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Por página:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(e.target.value === "all" ? "all" : Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 text-slate-700 font-bold rounded-lg px-2 py-1 outline-none text-xs cursor-pointer"
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="all">Todos</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-400 font-medium flex flex-col items-center justify-center gap-3">
            <RefreshCw size={28} className="animate-spin text-blue-600" />
            <span>Carregando lista de chamados...</span>
          </div>
        ) : paginatedTickets.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <FileText size={24} />
            </div>
            <p className="text-slate-600 font-bold">Nenhum chamado encontrado</p>
            <p className="text-xs text-slate-400">
              Nenhum registro corresponde aos filtros e termos de pesquisa aplicados.
            </p>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 cursor-pointer transition-colors"
              >
                <RotateCcw size={12} />
                Limpar Filtros
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  {/* Master Checkbox (apenas equipe staff) */}
                  {isStaff && (
                    <th className="px-4 py-4 w-10 text-center select-none">
                      <button
                        type="button"
                        onClick={toggleSelectAllPage}
                        className="text-slate-400 hover:text-blue-600 cursor-pointer flex items-center justify-center mx-auto"
                        title={isAllPageSelected ? "Desmarcar todos na página" : "Selecionar todos na página"}
                      >
                        {isAllPageSelected ? (
                          <CheckSquare size={18} className="text-blue-600" />
                        ) : isSomePageSelected ? (
                          <MinusSquare size={18} className="text-blue-600" />
                        ) : (
                          <Square size={18} />
                        )}
                      </button>
                    </th>
                  )}
                  {renderSortHeader("id", "Chamado")}
                  {renderSortHeader("requester", "Solicitante")}
                  {renderSortHeader("created_at", "Data & Hora", "bg-blue-50/30 text-blue-900/80")}
                  {renderSortHeader("category", "Categoria")}
                  {renderSortHeader("priority", "Prioridade")}
                  {renderSortHeader("status", "Status")}
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {paginatedTickets.map((t) => {
                  const dt = formatDateTime(t.created_at);
                  const isZabbix = t.title?.includes("[NOC Zabbix]");
                  const isUniFi = t.title?.includes("[NOC UniFi]");
                  const isAtivoAuto = t.title?.includes("NOC Auto-Alerta");
                  const isSelected = selectedTicketIds.includes(t.id);

                  return (
                    <tr
                      key={t.id}
                      onClick={() => setActiveTicketId(t.id)}
                      className={`transition-colors cursor-pointer group ${
                        isSelected ? "bg-blue-50/60 hover:bg-blue-50/80" : "hover:bg-slate-50/80"
                      }`}
                    >
                      {/* Checkbox Individual (Staff) */}
                      {isStaff && (
                        <td 
                          className="px-4 py-4 text-center w-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectTicket(t.id);
                          }}
                        >
                          <button
                            type="button"
                            className="text-slate-400 hover:text-blue-600 cursor-pointer flex items-center justify-center mx-auto"
                          >
                            {isSelected ? (
                              <CheckSquare size={18} className="text-blue-600" />
                            ) : (
                              <Square size={18} />
                            )}
                          </button>
                        </td>
                      )}

                      {/* Coluna 1: Chamado & ID */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition-transform group-hover:scale-105 ${
                            isUniFi ? "bg-cyan-50 text-cyan-600 border border-cyan-100" :
                            isZabbix ? "bg-amber-50 text-amber-600 border border-amber-100" :
                            isAtivoAuto ? "bg-purple-50 text-purple-600 border border-purple-100" :
                            "bg-blue-50 text-blue-600 border border-blue-100"
                          }`}>
                            {isUniFi ? <Wifi size={18} /> :
                             isZabbix ? <Activity size={18} /> :
                             <FileText size={18} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                {t.title}
                              </p>
                              {isUniFi && (
                                <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800">
                                  UniFi NOC
                                </span>
                              )}
                              {isZabbix && (
                                <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                  Zabbix NOC
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-semibold text-slate-400 mt-0.5 flex items-center gap-2">
                              <span>#{t.id}</span>
                              {t.technician_name && (
                                <span className="text-[11px] text-slate-500 font-medium">
                                  • Técnico: {t.technician_name}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Coluna 2: Solicitante */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="font-bold text-slate-800">{t.requester_name || "Sistema"}</p>
                        <p className="text-[11px] text-slate-400 font-medium">
                          {t.asset_id ? `Ativo ID #${t.asset_id}` : "Solicitação direta"}
                        </p>
                      </td>

                      {/* Coluna 3: Data & Hora Dedicada */}
                      <td className="px-6 py-4 whitespace-nowrap bg-blue-50/10">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                            <Calendar size={13} className="text-slate-400 shrink-0" />
                            {dt.date}
                            {dt.isToday && (
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700">
                                Hoje
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5 mt-0.5">
                            <Clock size={12} className="text-blue-600 shrink-0" />
                            {dt.time}
                            {dt.relative && (
                              <span className="text-[10px] font-medium text-slate-400 ml-0.5">
                                ({dt.relative})
                              </span>
                            )}
                          </span>
                        </div>
                      </td>

                      {/* Coluna 4: Categoria */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-700 text-xs bg-slate-100/80 px-2.5 py-1 rounded-lg">
                          {t.category_name || "Geral"}
                        </span>
                      </td>

                      {/* Coluna 5: Prioridade */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold inline-flex items-center gap-1 ${
                          t.priority === "Crítica" ? "bg-red-100 text-red-700" :
                          t.priority === "Alta" ? "bg-amber-100 text-amber-800" :
                          t.priority === "Média" ? "bg-blue-100 text-blue-700" :
                          "bg-slate-100 text-slate-700"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            t.priority === "Crítica" ? "bg-red-500 animate-pulse" :
                            t.priority === "Alta" ? "bg-amber-500" :
                            t.priority === "Média" ? "bg-blue-500" :
                            "bg-slate-400"
                          }`} />
                          {t.priority}
                        </span>
                      </td>

                      {/* Coluna 6: Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-block ${
                          t.status === "Em Andamento" ? "bg-amber-100 text-amber-800" :
                          t.status === "Fechado" ? "bg-emerald-100 text-emerald-700" :
                          t.status === "Aguardando Validação" ? "bg-purple-100 text-purple-700" :
                          "bg-blue-100 text-blue-700"
                        }`}>
                          {t.status}
                        </span>
                      </td>

                      {/* Coluna 7: Ação */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button 
                          className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center transition-all cursor-pointer ml-auto shadow-2xs"
                          title="Ver detalhes do chamado"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && pageSize !== "all" && (
          <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3 text-xs">
            <div className="text-slate-500 font-medium">
              Página <span className="font-extrabold text-slate-800">{currentPage}</span> de{" "}
              <span className="font-extrabold text-slate-800">{totalPages}</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Primeira página"
              >
                <ChevronsLeft size={16} />
              </button>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 font-semibold"
              >
                <ChevronLeft size={14} />
                Anterior
              </button>

              {/* Botões de página */}
              <div className="flex items-center gap-1 mx-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                  let pageNum = idx + 1;
                  if (totalPages > 5) {
                    if (currentPage > 3) {
                      pageNum = currentPage - 3 + idx + 1;
                    }
                    if (pageNum > totalPages) {
                      pageNum = totalPages - 4 + idx;
                    }
                  }
                  if (pageNum < 1) pageNum = 1;

                  const isCurrent = pageNum === currentPage;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isCurrent
                          ? "bg-blue-600 text-white shadow-2xs"
                          : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 font-semibold"
              >
                Próxima
                <ChevronRight size={14} />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Última página"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Batch Actions Bar (Barra Flutuante de Ações em Massa) */}
      {isStaff && selectedTicketIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700/80 backdrop-blur-md flex items-center gap-4 animate-slide-up flex-wrap max-w-full">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
              {selectedTicketIds.length}
            </span>
            <span className="text-xs font-bold text-slate-200">
              chamado{selectedTicketIds.length > 1 ? "s" : ""} selecionado{selectedTicketIds.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700 hidden sm:block" />

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBatchModalOpen(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <CheckSquare size={15} />
              <span>Alterar Status em Massa</span>
            </button>

            <button
              onClick={clearSelection}
              className="text-slate-400 hover:text-white text-xs font-medium px-2 py-1 transition-colors cursor-pointer"
            >
              Cancelar seleção
            </button>
          </div>
        </div>
      )}

      {/* Modal de Atualização de Status em Massa com Auditoria */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <CheckSquare size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Atualizar Status em Massa</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Aplicar novo status a {selectedTicketIds.length} chamado{selectedTicketIds.length > 1 ? "s" : ""} com auditoria
                  </p>
                </div>
              </div>
              <button
                onClick={() => !batchLoading && setIsBatchModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleBatchStatusSubmit} className="p-6 space-y-5">
              
              {/* Selected Tickets Summary */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Chamados Selecionados ({selectedTicketIds.length}):
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  {selectedTicketIds.map((id) => (
                    <span
                      key={id}
                      className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-extrabold"
                    >
                      #{id}
                    </span>
                  ))}
                </div>
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Novo Status:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {["Novo", "Em Andamento", "Aguardando Validação", "Fechado"].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setBatchTargetStatus(st)}
                      className={`px-3.5 py-2.5 rounded-xl text-xs font-extrabold border transition-all text-left flex items-center justify-between cursor-pointer ${
                        batchTargetStatus === st
                          ? "bg-blue-50 border-blue-600 text-blue-700 shadow-2xs"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span>{st}</span>
                      {batchTargetStatus === st && <CheckCircle2 size={16} className="text-blue-600" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason / Audit Comment Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Motivo / Justificativa para Auditoria (Opcional):
                </label>
                <textarea
                  value={batchComment}
                  onChange={(e) => setBatchComment(e.target.value)}
                  placeholder="Ex: Resolução em lote de alarmes de rede após normalização do link de internet ou manutenção programada..."
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium rounded-xl p-3 outline-none focus:border-blue-500 focus:bg-white transition-all resize-none"
                />
              </div>

              {/* Notify WhatsApp Checkbox */}
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <input
                  type="checkbox"
                  id="batchNotify"
                  checked={batchNotifyWhatsapp}
                  onChange={(e) => setBatchNotifyWhatsapp(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="batchNotify" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                  Enviar notificação de atualização em lote no grupo do WhatsApp
                </label>
              </div>

              {/* Audit Notice Box */}
              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-start gap-2.5">
                <ShieldCheck size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                  <strong className="font-extrabold">Registro de Auditoria:</strong> Cada chamado receberá um registro na Linha do Tempo indicando que o status foi atualizado em lote por <strong>{user?.display_name || "Você"}</strong> na data e hora atuais.
                </p>
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={batchLoading}
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={batchLoading}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {batchLoading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Atualizando...</span>
                    </>
                  ) : (
                    <>
                      <CheckSquare size={14} />
                      <span>Confirmar Atualização ({selectedTicketIds.length})</span>
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Slide-Over Detail Drawer */}
      <TicketDetailDrawer
        ticketId={activeTicketId}
        onClose={handleCloseDrawer}
        onUpdate={fetchTickets}
      />
    </div>
  );
}
