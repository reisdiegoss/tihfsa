import { useState, useEffect, useMemo } from "react";
import {
  FolderKanban,
  Plus,
  Search,
  RefreshCw,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Users,
  Ticket,
  Link as LinkIcon,
  Unlink,
  Trash2,
  Edit3,
  X,
  Sparkles,
  Server,
  MessageSquare,
  History,
  Send,
  Ban,
  CheckSquare,
  Square,
  Tag,
  MoveRight,
  ExternalLink,
  DollarSign,
  UserCheck,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../api/client";
import projectsApi from "../../api/projects";

// Colunas Principais do Quadro Trello (Etapas do Projeto)
const BOARD_COLUMNS = [
  { id: "Planejamento", title: "Planejamento", color: "bg-slate-100 border-slate-300 text-slate-800", headerBg: "bg-slate-200/70", dot: "bg-slate-500" },
  { id: "Em Andamento", title: "Em Andamento", color: "bg-blue-50/60 border-blue-200 text-blue-900", headerBg: "bg-blue-100/70", dot: "bg-blue-600" },
  { id: "Pausado", title: "Pausado / Bloqueado", color: "bg-amber-50/60 border-amber-200 text-amber-900", headerBg: "bg-amber-100/70", dot: "bg-amber-600" },
  { id: "Concluído", title: "Concluído", color: "bg-emerald-50/60 border-emerald-200 text-emerald-900", headerBg: "bg-emerald-100/70", dot: "bg-emerald-600" },
];

const CATEGORY_COLORS = {
  "Infraestrutura": "bg-emerald-500 text-white",
  "Redes & Wi-Fi": "bg-blue-500 text-white",
  "Sistemas & ERP": "bg-purple-500 text-white",
  "Hotelaria & UHs": "bg-amber-500 text-white",
  "Segurança & CFTV": "bg-rose-500 text-white",
  "Telecom & VoIP": "bg-indigo-500 text-white",
  "Hardware & Servidores": "bg-cyan-600 text-white",
  "Outros": "bg-slate-500 text-white",
};

export default function Projects() {
  const { user, isAdmin, isTechnician } = useAuth();

  const [projects, setProjects] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [allAssetsList, setAllAssetsList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Cartão Ativo Aberto (Modal Estilo Trello)
  const [openCardId, setOpenCardId] = useState(null);
  const [cardDetail, setCardDetail] = useState(null);
  const [loadingCardDetail, setLoadingCardDetail] = useState(false);

  // Filtros Globais do Quadro
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedMemberFilter, setSelectedMemberFilter] = useState("ALL");

  // Criação Rápida de Cartão na Coluna (Inline Trello Composer)
  const [inlineComposerColumn, setInlineComposerColumn] = useState(null);
  const [inlineTitle, setInlineTitle] = useState("");
  const [savingInlineCard, setSavingInlineCard] = useState(false);

  // Adição Rápida de Item no Checklist (Dentro do Modal)
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [newChecklistAssignedId, setNewChecklistAssignedId] = useState("");
  const [isAddingChecklistItem, setIsAddingChecklistItem] = useState(false);

  // Comentário da Linha do Tempo
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  // Modais de Vínculo
  const [isLinkAssetOpen, setIsLinkAssetOpen] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [isLinkTicketOpen, setIsLinkTicketOpen] = useState(false);
  const [ticketIdInput, setTicketIdInput] = useState("");
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState("");

  // Modal para Bloquear Tarefa do Checklist
  const [blockingTask, setBlockingTask] = useState(null);
  const [blockReason, setBlockReason] = useState("");
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);

  // Modal de Criação Completa / Edição de Projeto
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [projectForm, setProjectForm] = useState({
    title: "",
    category: "Infraestrutura",
    status: "Planejamento",
    priority: "Média",
    start_date: "",
    due_date: "",
    budget: "",
    manager_id: "",
    description: "",
  });

  // Carregar Dados Gerais
  const loadData = async () => {
    try {
      setLoading(true);
      const [projectsData, usersData, catsData] = await Promise.all([
        projectsApi.getProjects(),
        api.get("/users/?is_active=true").then((r) => r.data).catch(() => []),
        api.get("/categories").then((r) => r.data).catch(() => []),
      ]);
      setProjects(projectsData || []);
      setUsersList(usersData || []);
      setCategoriesList(catsData || []);

      if (openCardId) {
        loadCardDetail(openCardId);
      }
    } catch (err) {
      console.error("Erro ao carregar projetos:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadCardDetail = async (id) => {
    try {
      setLoadingCardDetail(true);
      const detail = await projectsApi.getProject(id);
      setCardDetail(detail);
    } catch (err) {
      console.error("Erro ao abrir detalhes do cartão:", err);
    } finally {
      setLoadingCardDetail(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCard = (project) => {
    setOpenCardId(project.id);
    loadCardDetail(project.id);
  };

  const handleCloseCard = () => {
    setOpenCardId(null);
    setCardDetail(null);
    setNewChecklistTitle("");
    setIsAddingChecklistItem(false);
    loadData();
  };

  // Mover Projeto entre Colunas (Drag & Drop ou Clique)
  const handleMoveProjectStatus = async (projectId, newStatus) => {
    try {
      // Atualização otimista no estado local
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, status: newStatus } : p))
      );
      if (cardDetail && cardDetail.id === projectId) {
        setCardDetail((prev) => ({ ...prev, status: newStatus }));
      }
      await projectsApi.updateProject(projectId, { status: newStatus });
      await loadData();
      if (openCardId === projectId) {
        await loadCardDetail(projectId);
      }
    } catch (err) {
      console.error("Erro ao mover projeto:", err);
      alert("Falha ao mover projeto.");
      loadData();
    }
  };

  // Drag and Drop HTML5
  const handleDragStart = (e, projectId) => {
    e.dataTransfer.setData("projectId", String(projectId));
  };

  const handleDropOnColumn = (e, targetStatus) => {
    e.preventDefault();
    const pId = e.dataTransfer.getData("projectId");
    if (pId) {
      handleMoveProjectStatus(parseInt(pId), targetStatus);
    }
  };

  // Criador Rápido de Cartão Trello (Inline no final da coluna)
  const handleQuickCreateCard = async (statusCol) => {
    if (!inlineTitle.trim()) return;
    try {
      setSavingInlineCard(true);
      const newProj = await projectsApi.createProject({
        title: inlineTitle.trim(),
        status: statusCol,
        category: "Infraestrutura",
        priority: "Média",
        manager_id: user?.id || null,
      });
      setInlineTitle("");
      setInlineComposerColumn(null);
      await loadData();
      // Opcional: abre o cartão recém-criado imediatamente
      handleOpenCard(newProj);
    } catch (err) {
      console.error("Erro ao criar cartão rápido:", err);
      alert("Falha ao criar cartão: " + (err.response?.data?.detail || err.message));
    } finally {
      setSavingInlineCard(false);
    }
  };

  // Checklist Actions (Tarefas internas estilo Trello)
  const handleAddChecklistItem = async (e) => {
    e.preventDefault();
    if (!newChecklistTitle.trim() || !cardDetail) return;
    try {
      await projectsApi.createTask(cardDetail.id, {
        title: newChecklistTitle.trim(),
        assigned_to_id: newChecklistAssignedId ? parseInt(newChecklistAssignedId) : user?.id,
        status: "A Fazer",
        priority: "Média",
      });
      setNewChecklistTitle("");
      setNewChecklistAssignedId("");
      setIsAddingChecklistItem(false);
      await loadCardDetail(cardDetail.id);
      await loadData();
    } catch (err) {
      console.error("Erro ao adicionar item no checklist:", err);
      alert("Falha ao adicionar tarefa.");
    }
  };

  const handleToggleTaskCompleted = async (task) => {
    if (!cardDetail) return;
    const isCompleted = task.status === "Concluído";
    const nextStatus = isCompleted ? "A Fazer" : "Concluído";
    try {
      await projectsApi.updateTask(cardDetail.id, task.id, {
        status: nextStatus,
        is_blocked: isCompleted ? task.is_blocked : false, // se concluiu, desbloqueia
      });
      await loadCardDetail(cardDetail.id);
      await loadData();
    } catch (err) {
      console.error("Erro ao alterar tarefa:", err);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Deseja remover este item do checklist?")) return;
    try {
      await projectsApi.deleteTask(cardDetail.id, taskId);
      await loadCardDetail(cardDetail.id);
      await loadData();
    } catch (err) {
      console.error("Erro ao excluir tarefa:", err);
    }
  };

  // Bloqueio no Checklist
  const handleOpenBlockModal = (task) => {
    setBlockingTask(task);
    setBlockReason(task.blocked_reason || "");
    setIsBlockModalOpen(true);
  };

  const handleConfirmBlockTask = async (e) => {
    e.preventDefault();
    if (!blockingTask || !cardDetail) return;
    try {
      await projectsApi.updateTask(cardDetail.id, blockingTask.id, {
        is_blocked: true,
        blocked_reason: blockReason.trim() || "Impedimento técnico reportado.",
      });
      setIsBlockModalOpen(false);
      setBlockingTask(null);
      setBlockReason("");
      await loadCardDetail(cardDetail.id);
      await loadData();
    } catch (err) {
      console.error("Erro ao bloquear tarefa:", err);
    }
  };

  const handleUnblockTask = async (task) => {
    if (!cardDetail) return;
    try {
      await projectsApi.updateTask(cardDetail.id, task.id, {
        is_blocked: false,
        blocked_reason: null,
      });
      await loadCardDetail(cardDetail.id);
      await loadData();
    } catch (err) {
      console.error("Erro ao desbloquear tarefa:", err);
    }
  };

  // Vínculo de Membros da Equipe
  const handleAddMember = async (userId) => {
    if (!cardDetail || !userId) return;
    try {
      await projectsApi.addMember(cardDetail.id, parseInt(userId));
      await loadCardDetail(cardDetail.id);
      await loadData();
      setIsAddMemberOpen(false);
      setSelectedMemberToAdd("");
    } catch (err) {
      console.error("Erro ao adicionar membro:", err);
      alert("Falha ao adicionar membro.");
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!cardDetail || !window.confirm("Deseja remover este técnico do projeto?")) return;
    try {
      await projectsApi.removeMember(cardDetail.id, userId);
      await loadCardDetail(cardDetail.id);
      await loadData();
    } catch (err) {
      console.error("Erro ao remover membro:", err);
    }
  };

  // Vínculo de Ativos CMDB
  const handleOpenLinkAsset = async () => {
    setIsLinkAssetOpen(true);
    if (allAssetsList.length === 0) {
      try {
        const res = await api.get("/assets/?is_active=true");
        setAllAssetsList(res.data || []);
      } catch (err) {
        console.error("Erro ao carregar ativos:", err);
      }
    }
  };

  const handleLinkAsset = async (assetId) => {
    if (!cardDetail || !assetId) return;
    try {
      await projectsApi.linkAsset(cardDetail.id, assetId);
      await loadCardDetail(cardDetail.id);
      await loadData();
      setIsLinkAssetOpen(false);
    } catch (err) {
      console.error("Erro ao vincular ativo:", err);
      alert("Falha ao vincular ativo.");
    }
  };

  const handleUnlinkAsset = async (assetId) => {
    if (!cardDetail || !window.confirm("Desvincular este equipamento do projeto?")) return;
    try {
      await projectsApi.unlinkAsset(cardDetail.id, assetId);
      await loadCardDetail(cardDetail.id);
      await loadData();
    } catch (err) {
      console.error("Erro ao desvincular ativo:", err);
    }
  };

  // Vínculo de Chamados
  const handleLinkTicket = async (e) => {
    e.preventDefault();
    const tId = parseInt(ticketIdInput);
    if (!tId || !cardDetail) return;
    try {
      await projectsApi.linkTicket(cardDetail.id, tId);
      await loadCardDetail(cardDetail.id);
      await loadData();
      setIsLinkTicketOpen(false);
      setTicketIdInput("");
    } catch (err) {
      console.error("Erro ao vincular chamado:", err);
      alert("Falha ao vincular chamado: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleUnlinkTicket = async (ticketId) => {
    if (!cardDetail || !window.confirm("Desvincular este chamado do projeto?")) return;
    try {
      await projectsApi.unlinkTicket(cardDetail.id, ticketId);
      await loadCardDetail(cardDetail.id);
      await loadData();
    } catch (err) {
      console.error("Erro ao desvincular chamado:", err);
    }
  };

  // Comentários da Linha do Tempo
  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !cardDetail) return;
    try {
      setPostingComment(true);
      await projectsApi.addTimelineComment(cardDetail.id, newComment.trim());
      setNewComment("");
      await loadCardDetail(cardDetail.id);
    } catch (err) {
      console.error("Erro ao postar comentário:", err);
    } finally {
      setPostingComment(false);
    }
  };

  // Filtros Globais dos Cartões
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (selectedCategory !== "ALL" && p.category !== selectedCategory) return false;
      if (selectedMemberFilter !== "ALL") {
        const memId = parseInt(selectedMemberFilter);
        const isManager = p.manager_id === memId;
        const isMember = (p.members || []).some((m) => m.id === memId);
        if (!isManager && !isMember) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inTitle = (p.title || "").toLowerCase().includes(q);
        const inCode = (p.code || "").toLowerCase().includes(q);
        const inDesc = (p.description || "").toLowerCase().includes(q);
        if (!inTitle && !inCode && !inDesc) return false;
      }
      return true;
    });
  }, [projects, selectedCategory, selectedMemberFilter, searchQuery]);

  // Ativos disponíveis para vínculo no modal
  const availableAssetsToLink = useMemo(() => {
    const linkedIds = new Set((cardDetail?.assets || []).map((a) => a.id));
    return allAssetsList.filter((a) => {
      if (linkedIds.has(a.id)) return false;
      if (!assetSearch.trim()) return true;
      const q = assetSearch.toLowerCase().trim();
      return (
        (a.name || "").toLowerCase().includes(q) ||
        (a.asset_tag || "").toLowerCase().includes(q) ||
        (a.ip_address || "").toLowerCase().includes(q) ||
        (a.model || "").toLowerCase().includes(q)
      );
    });
  }, [allAssetsList, cardDetail?.assets, assetSearch]);

  // Usuários disponíveis para equipe
  const availableUsersForTeam = useMemo(() => {
    const existingIds = new Set([
      cardDetail?.manager_id,
      ...(cardDetail?.members || []).map((m) => m.id),
    ]);
    return usersList.filter((u) => !existingIds.has(u.id));
  }, [usersList, cardDetail]);

  // Contagem de Checklist no Cartão Aberto
  const checklistStats = useMemo(() => {
    const tasks = cardDetail?.tasks || [];
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "Concluído").length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pct };
  }, [cardDetail]);

  return (
    <div className="space-y-4 pb-8 min-h-[calc(100vh-100px)] flex flex-col">
      {/* ─── BARRA DE TOPO DO QUADRO (ESTILO TRELLO BOARD BAR) ─── */}
      <div className="bg-white/90 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <FolderKanban size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Quadro de Projetos de TI
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-blue-100 text-blue-800">
                {projects.length} projetos
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Gerencie metas, prazos, entregas e ativos no formato de quadro Kanban contínuo.
            </p>
          </div>
        </div>

        {/* Ferramentas e Filtros no Topo */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-48 sm:w-60">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrar projetos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-100/80 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-blue-400 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="ALL">Categoria: Todas</option>
            {Object.keys(CATEGORY_COLORS).map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={selectedMemberFilter}
            onChange={(e) => setSelectedMemberFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="ALL">Membro: Todos</option>
            {usersList.map((u) => (
              <option key={u.id} value={u.id}>{u.display_name}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={loadData}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            title="Atualizar quadro"
          >
            <RefreshCw size={16} />
          </button>

          {(isAdmin || isTechnician) && (
            <button
              type="button"
              onClick={() => {
                setEditingProject(null);
                setProjectForm({
                  title: "",
                  category: "Infraestrutura",
                  status: "Planejamento",
                  priority: "Média",
                  start_date: new Date().toISOString().split("T")[0],
                  due_date: "",
                  budget: "",
                  manager_id: user?.id || "",
                  description: "",
                });
                setIsProjectModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>Novo Projeto</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── O QUADRO TRELLO: COLUNAS HORIZONTAIS ─── */}
      <div className="flex-1 flex gap-4 overflow-x-auto pb-4 items-start select-none">
        {BOARD_COLUMNS.map((col) => {
          const cardsInCol = filteredProjects.filter((p) => p.status === col.id);
          const isComposerActive = inlineComposerColumn === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDropOnColumn(e, col.id)}
              className={`w-80 sm:w-88 shrink-0 rounded-2xl border flex flex-col max-h-[calc(100vh-190px)] shadow-xs transition-colors ${col.color}`}
            >
              {/* Cabeçalho da Lista */}
              <div className={`p-3.5 rounded-t-2xl flex items-center justify-between font-bold border-b border-black/5 ${col.headerBg}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                  <h3 className="text-sm font-black text-slate-800">{col.title}</h3>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-white/80 text-slate-700 shadow-2xs">
                  {cardsInCol.length}
                </span>
              </div>

              {/* Lista de Cartões (Scrollável Verticalmente) */}
              <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
                {cardsInCol.map((project) => {
                  const tasksCount = project.tasks_count || 0;
                  const tasksDone = project.tasks_completed_count || 0;
                  const hasTasks = tasksCount > 0;
                  const allTasksDone = hasTasks && tasksCount === tasksDone;
                  const catClass = CATEGORY_COLORS[project.category] || "bg-slate-500 text-white";

                  return (
                    <div
                      key={project.id}
                      draggable="true"
                      onDragStart={(e) => handleDragStart(e, project.id)}
                      onClick={() => handleOpenCard(project)}
                      className="bg-white rounded-xl p-3.5 shadow-2xs hover:shadow-md border border-slate-200/90 hover:border-blue-400/80 transition-all cursor-pointer space-y-2.5 group relative"
                    >
                      {/* Barra / Etiqueta da Categoria */}
                      <div className="flex items-center justify-between gap-1">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${catClass}`}>
                          {project.category}
                        </span>
                        <span className="text-[11px] font-black text-slate-400 font-mono">
                          {project.code}
                        </span>
                      </div>

                      {/* Título do Projeto */}
                      <h4 className="font-bold text-sm text-slate-900 leading-snug group-hover:text-blue-600 transition-colors">
                        {project.title}
                      </h4>

                      {/* Barra de Progresso do Cartão */}
                      {hasTasks && (
                        <div className="space-y-1">
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                allTasksDone ? "bg-emerald-500" : "bg-blue-600"
                              }`}
                              style={{ width: `${project.progress || 0}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Badges do Cartão (Estilo Trello) */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[11px] text-slate-500">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Data de Entrega */}
                          {project.due_date && (
                            <span
                              className={`inline-flex items-center gap-1 font-semibold ${
                                project.status === "Concluído"
                                  ? "text-emerald-700"
                                  : new Date(project.due_date) < new Date()
                                  ? "text-rose-600 font-bold"
                                  : "text-slate-500"
                              }`}
                              title="Data de Conclusão / Prazo"
                            >
                              <Clock size={12} />
                              {new Date(project.due_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                            </span>
                          )}

                          {/* Checklist de Tarefas */}
                          {hasTasks && (
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold ${
                                allTasksDone
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "text-slate-600"
                              }`}
                              title="Tarefas concluídas"
                            >
                              <CheckSquare size={12} />
                              {tasksDone}/{tasksCount}
                            </span>
                          )}

                          {/* Ativos CMDB */}
                          {(project.assets_count || 0) > 0 && (
                            <span className="inline-flex items-center gap-1 text-slate-500" title="Equipamentos CMDB vinculados">
                              <Server size={12} className="text-emerald-600" />
                              {project.assets_count}
                            </span>
                          )}

                          {/* Chamados Vinculados */}
                          {(project.tickets_count || 0) > 0 && (
                            <span className="inline-flex items-center gap-1 text-slate-500" title="Chamados Helpdesk">
                              <Ticket size={12} className="text-amber-600" />
                              {project.tickets_count}
                            </span>
                          )}
                        </div>

                        {/* Avatares dos Membros do Projeto (Canto Direito Inferior) */}
                        <div className="flex items-center -space-x-1.5 overflow-hidden">
                          {project.manager && (
                            <div
                              className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-black ring-2 ring-white"
                              title={`Gestor: ${project.manager.display_name}`}
                            >
                              {project.manager.display_name?.charAt(0) || "G"}
                            </div>
                          )}
                          {(project.members || []).slice(0, 3).map((m) => (
                            <div
                              key={m.id}
                              className="w-5 h-5 rounded-full bg-slate-700 text-white flex items-center justify-center text-[9px] font-bold ring-2 ring-white"
                              title={m.display_name}
                            >
                              {m.display_name?.charAt(0) || "U"}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Inline Composer Trello */}
                {isComposerActive ? (
                  <div className="bg-white rounded-xl p-3 shadow-md border border-blue-400 space-y-2 animate-fadeIn">
                    <textarea
                      rows={2}
                      autoFocus
                      placeholder="Insira o título deste projeto..."
                      value={inlineTitle}
                      onChange={(e) => setInlineTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleQuickCreateCard(col.id);
                        }
                      }}
                      className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={savingInlineCard || !inlineTitle.trim()}
                        onClick={() => handleQuickCreateCard(col.id)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {savingInlineCard ? "Adicionando..." : "Adicionar Cartão"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setInlineComposerColumn(null);
                          setInlineTitle("");
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  (isAdmin || isTechnician) && (
                    <button
                      type="button"
                      onClick={() => {
                        setInlineComposerColumn(col.id);
                        setInlineTitle("");
                      }}
                      className="w-full py-2 px-3 hover:bg-black/5 text-slate-600 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer text-left"
                    >
                      <Plus size={15} />
                      <span>Adicionar um cartão</span>
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── MODAL DO CARTÃO (O FAMOSO TRELLO CARD MODAL) ─── */}
      {openCardId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header do Cartão */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/50">
              <div className="flex items-start gap-3 flex-1">
                <FolderKanban className="text-blue-600 shrink-0 mt-1" size={24} />
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-black font-mono">
                      {cardDetail?.code || "PRJ"}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">
                      na lista
                    </span>
                    <select
                      value={cardDetail?.status || "Planejamento"}
                      onChange={(e) => handleMoveProjectStatus(cardDetail.id, e.target.value)}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none"
                    >
                      {BOARD_COLUMNS.map((col) => (
                        <option key={col.id} value={col.id}>{col.title}</option>
                      ))}
                    </select>
                  </div>

                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                    {cardDetail?.title}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseCard}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                title="Fechar cartão"
              >
                <X size={20} />
              </button>
            </div>

            {/* Conteúdo do Cartão (Grid 2 Colunas: Principal + Ações) */}
            <div className="p-5 sm:p-7 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Coluna Principal (8 colunas) */}
              <div className="lg:col-span-8 space-y-6">
                {/* Meta-Informações (Membros, Etiqueta, Datas) */}
                <div className="flex flex-wrap items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                  {/* Gestor & Membros */}
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Equipe</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {cardDetail?.manager && (
                        <div
                          className="px-2 py-1 rounded-lg bg-blue-100 text-blue-900 text-xs font-bold flex items-center gap-1"
                          title="Gestor do Projeto"
                        >
                          👑 {cardDetail.manager.display_name}
                        </div>
                      )}
                      {(cardDetail?.members || []).map((m) => (
                        <div
                          key={m.id}
                          className="px-2 py-1 rounded-lg bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1 group"
                        >
                          <span>{m.display_name}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(m.id)}
                            className="text-slate-400 hover:text-rose-600 rounded"
                            title="Remover da equipe"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setIsAddMemberOpen(true)}
                        className="px-2 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
                      >
                        + Membro
                      </button>
                    </div>
                  </div>

                  {/* Categoria */}
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Categoria</span>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${CATEGORY_COLORS[cardDetail?.category] || "bg-slate-500 text-white"}`}>
                      {cardDetail?.category}
                    </span>
                  </div>

                  {/* Prazo */}
                  {cardDetail?.due_date && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Prazo de Entrega</span>
                      <span className="text-xs font-bold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                        📅 {new Date(cardDetail.due_date).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Descrição */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <MessageSquare size={14} />
                    <span>Descrição / Escopo</span>
                  </h4>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {cardDetail?.description || "Nenhuma descrição detalhada informada para este projeto."}
                  </div>
                </div>

                {/* CHECKLIST ESTILO TRELLO (Tarefas & Etapas) */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <CheckSquare className="text-blue-600" size={16} />
                      <span>Checklist de Tarefas & Etapas</span>
                    </h4>
                    <span className="text-xs font-bold text-slate-500">
                      {checklistStats.completed} de {checklistStats.total} concluídas
                    </span>
                  </div>

                  {/* Barra de Progresso Verde Trello */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-slate-600 w-8">{checklistStats.pct}%</span>
                    <div className="h-2 flex-1 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          checklistStats.pct === 100 ? "bg-emerald-500" : "bg-blue-600"
                        }`}
                        style={{ width: `${checklistStats.pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Itens do Checklist */}
                  <div className="space-y-2 pt-1">
                    {(cardDetail?.tasks || []).map((task) => {
                      const isDone = task.status === "Concluído";
                      return (
                        <div
                          key={task.id}
                          className={`p-3 rounded-xl border flex items-start justify-between gap-3 transition-colors ${
                            task.is_blocked
                              ? "bg-rose-50/60 border-rose-300"
                              : isDone
                              ? "bg-slate-50 border-slate-200 opacity-70"
                              : "bg-white border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-start gap-3 flex-1">
                            <button
                              type="button"
                              onClick={() => handleToggleTaskCompleted(task)}
                              className="mt-0.5 text-blue-600 hover:text-blue-700 cursor-pointer"
                            >
                              {isDone ? (
                                <CheckCircle2 size={18} className="text-emerald-600" />
                              ) : (
                                <Square size={18} className="text-slate-400" />
                              )}
                            </button>

                            <div className="space-y-1 flex-1">
                              <span
                                className={`text-sm leading-snug font-medium block ${
                                  isDone ? "line-through text-slate-400" : "text-slate-900"
                                }`}
                              >
                                {task.title}
                              </span>

                              {/* Aviso de Bloqueio */}
                              {task.is_blocked && (
                                <div className="p-2 bg-rose-100/70 border border-rose-300 rounded-lg text-rose-900 text-xs flex items-center justify-between gap-2">
                                  <span className="font-bold flex items-center gap-1">
                                    <AlertTriangle size={13} className="text-rose-600" />
                                    Bloqueado: {task.blocked_reason || "Sem motivo informado"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleUnblockTask(task)}
                                    className="px-2 py-0.5 bg-rose-200 hover:bg-rose-300 rounded font-bold text-[10px] text-rose-900 cursor-pointer"
                                  >
                                    Desbloquear
                                  </button>
                                </div>
                              )}

                              {/* Responsável e Chamado */}
                              <div className="flex items-center gap-3 text-xs text-slate-500">
                                {task.assigned_to && (
                                  <span>👤 {task.assigned_to.display_name}</span>
                                )}
                                {task.ticket && (
                                  <span className="text-blue-600 font-semibold">
                                    🎫 #{task.ticket.id} {task.ticket.title}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {!task.is_blocked && !isDone && (
                              <button
                                type="button"
                                onClick={() => handleOpenBlockModal(task)}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 cursor-pointer"
                                title="Sinalizar impedimento"
                              >
                                Bloquear
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(task.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                              title="Excluir item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Adicionar Item no Checklist */}
                  {isAddingChecklistItem ? (
                    <form onSubmit={handleAddChecklistItem} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Adicionar um item de tarefa..."
                        value={newChecklistTitle}
                        onChange={(e) => setNewChecklistTitle(e.target.value)}
                        className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <select
                          value={newChecklistAssignedId}
                          onChange={(e) => setNewChecklistAssignedId(e.target.value)}
                          className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-700"
                        >
                          <option value="">Atribuir a técnico...</option>
                          {usersList.map((u) => (
                            <option key={u.id} value={u.id}>{u.display_name}</option>
                          ))}
                        </select>

                        <div className="flex items-center gap-2">
                          <button
                            type="submit"
                            disabled={!newChecklistTitle.trim()}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            Adicionar
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsAddingChecklistItem(false)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 rounded"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsAddingChecklistItem(true)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                    >
                      + Adicionar item
                    </button>
                  )}
                </div>

                {/* ATIVOS CMDB VINCULADOS */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <Server className="text-emerald-600" size={16} />
                      <span>Equipamentos CMDB Vinculados ({cardDetail?.assets?.length || 0})</span>
                    </h4>
                    <button
                      type="button"
                      onClick={handleOpenLinkAsset}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                    >
                      + Vincular Ativo
                    </button>
                  </div>

                  {(!cardDetail?.assets || cardDetail.assets.length === 0) ? (
                    <p className="text-xs text-slate-400 italic">Nenhum equipamento associado.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {cardDetail.assets.map((asset) => (
                        <div key={asset.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs">
                          <div>
                            <span className="font-bold text-slate-800 block truncate">{asset.name}</span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              Tag: {asset.asset_tag || "S/N"} • IP: {asset.ip_address || "DHCP"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUnlinkAsset(asset.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            title="Desvincular"
                          >
                            <Unlink size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* CHAMADOS VINCULADOS */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <Ticket className="text-amber-600" size={16} />
                      <span>Chamados do Helpdesk ({cardDetail?.tickets?.length || 0})</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsLinkTicketOpen(true)}
                      className="text-xs font-bold text-amber-700 hover:text-amber-800 cursor-pointer"
                    >
                      + Vincular Chamado
                    </button>
                  </div>

                  {(!cardDetail?.tickets || cardDetail.tickets.length === 0) ? (
                    <p className="text-xs text-slate-400 italic">Nenhum chamado vinculado.</p>
                  ) : (
                    <div className="space-y-2">
                      {cardDetail.tickets.map((t) => (
                        <div key={t.id} className="p-2.5 bg-amber-50/50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-black text-amber-800">#{t.id}</span>
                            <span className="font-bold text-slate-800 truncate">{t.title}</span>
                            <span className="px-1.5 py-0.5 rounded bg-white text-[10px] font-bold text-slate-600 border border-amber-200">
                              {t.status}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUnlinkTicket(t.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            title="Desvincular chamado"
                          >
                            <Unlink size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ATIVIDADE & COMENTÁRIOS DA LINHA DO TEMPO */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <History className="text-violet-600" size={16} />
                    <span>Atividade & Comentários</span>
                  </h4>

                  <form onSubmit={handlePostComment} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Escreva um comentário técnico..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="flex-1 text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <button
                      type="submit"
                      disabled={postingComment || !newComment.trim()}
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      Enviar
                    </button>
                  </form>

                  <div className="space-y-2.5 pt-2">
                    {(!cardDetail?.timeline || cardDetail.timeline.length === 0) ? (
                      <p className="text-xs text-slate-400 italic">Nenhuma atividade registrada ainda.</p>
                    ) : (
                      cardDetail.timeline.map((entry) => (
                        <div key={entry.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
                          <div className="flex items-center justify-between text-slate-500 text-[11px]">
                            <strong className="text-slate-800">{entry.author?.display_name || "Sistema"}</strong>
                            <span>{new Date(entry.created_at).toLocaleString("pt-BR")}</span>
                          </div>
                          <p className="text-slate-700 whitespace-pre-line">{entry.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Coluna Lateral de Ações Trello (4 colunas) */}
              <div className="lg:col-span-4 space-y-5">
                <div>
                  <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Adicionar ao Cartão
                  </h5>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => setIsAddMemberOpen(true)}
                      className="w-full px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Users size={14} className="text-indigo-600" />
                      <span>Membros da Equipe</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingChecklistItem(true)}
                      className="w-full px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <CheckSquare size={14} className="text-blue-600" />
                      <span>Checklist de Tarefas</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenLinkAsset}
                      className="w-full px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Server size={14} className="text-emerald-600" />
                      <span>Equipamento CMDB</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsLinkTicketOpen(true)}
                      className="w-full px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Ticket size={14} className="text-amber-600" />
                      <span>Chamado Helpdesk</span>
                    </button>
                  </div>
                </div>

                <div>
                  <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Ações do Projeto
                  </h5>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        handleCloseCard();
                        setEditingProject(cardDetail);
                        setProjectForm({
                          title: cardDetail.title || "",
                          category: cardDetail.category || "Infraestrutura",
                          status: cardDetail.status || "Planejamento",
                          priority: cardDetail.priority || "Média",
                          start_date: cardDetail.start_date || "",
                          due_date: cardDetail.due_date || "",
                          budget: cardDetail.budget ? String(cardDetail.budget) : "",
                          manager_id: cardDetail.manager_id || "",
                          description: cardDetail.description || "",
                        });
                        setIsProjectModalOpen(true);
                      }}
                      className="w-full px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Edit3 size={14} className="text-slate-600" />
                      <span>Editar Dados Gerais</span>
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm("Atenção: deseja excluir este projeto permanentemente?")) {
                            await projectsApi.deleteProject(cardDetail.id);
                            handleCloseCard();
                            loadData();
                          }
                        }}
                        className="w-full px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <Trash2 size={14} className="text-rose-600" />
                        <span>Excluir Projeto</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL VINCULAR ATIVO CMDB ─── */}
      {isLinkAssetOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Server className="text-emerald-600" size={18} />
                Vincular Ativo CMDB
              </h3>
              <button
                type="button"
                onClick={() => setIsLinkAssetOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-3 flex-1 overflow-y-auto">
              <input
                type="text"
                placeholder="Buscar por tag, nome, modelo ou IP..."
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                {availableAssetsToLink.length === 0 ? (
                  <p className="p-4 text-center text-xs text-slate-400">Nenhum equipamento encontrado.</p>
                ) : (
                  availableAssetsToLink.slice(0, 20).map((asset) => (
                    <div key={asset.id} className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 text-xs">
                      <div>
                        <strong className="text-slate-800 block">{asset.name}</strong>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Tag: {asset.asset_tag || "S/N"} • IP: {asset.ip_address || "DHCP"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleLinkAsset(asset.id)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Vincular
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL ASSOCIAR TÉCNICO À EQUIPE ─── */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Users className="text-indigo-600" size={18} />
                Adicionar Membro à Equipe
              </h3>
              <button
                type="button"
                onClick={() => setIsAddMemberOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <select
                value={selectedMemberToAdd}
                onChange={(e) => setSelectedMemberToAdd(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none"
              >
                <option value="">Selecione o técnico...</option>
                {availableUsersForTeam.map((u) => (
                  <option key={u.id} value={u.id}>{u.display_name} ({u.role})</option>
                ))}
              </select>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!selectedMemberToAdd}
                  onClick={() => handleAddMember(selectedMemberToAdd)}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL VINCULAR CHAMADO ─── */}
      {isLinkTicketOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Ticket className="text-amber-600" size={18} />
                Vincular Chamado Helpdesk
              </h3>
              <button
                type="button"
                onClick={() => setIsLinkTicketOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleLinkTicket} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ID do Chamado *</label>
                <input
                  type="number"
                  required
                  placeholder="Ex: 142"
                  value={ticketIdInput}
                  onChange={(e) => setTicketIdInput(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLinkTicketOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold"
                >
                  Vincular
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL BLOQUEAR TAREFA ─── */}
      {isBlockModalOpen && blockingTask && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-black text-rose-700 flex items-center gap-2">
                <Ban size={18} />
                Sinalizar Impedimento Técnico
              </h3>
              <button
                type="button"
                onClick={() => setIsBlockModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmBlockTask} className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                Tarefa: <strong>{blockingTask.title}</strong>
              </p>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Motivo do Bloqueio *</label>
                <textarea
                  rows={3}
                  required
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Ex: Aguardando resposta do fornecedor sobre entrega dos cabos..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBlockModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold"
                >
                  Confirmar Bloqueio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL COMPLETO DE PROJETO (CRIAR / EDITAR) ─── */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">
                {editingProject ? `Editar: ${editingProject.code}` : "Novo Projeto de TI"}
              </h3>
              <button
                type="button"
                onClick={() => setIsProjectModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!projectForm.title.trim()) return;
                try {
                  const payload = {
                    title: projectForm.title.trim(),
                    category: projectForm.category,
                    status: projectForm.status,
                    priority: projectForm.priority,
                    start_date: projectForm.start_date || null,
                    due_date: projectForm.due_date || null,
                    budget: projectForm.budget ? parseFloat(projectForm.budget) : 0.0,
                    manager_id: projectForm.manager_id ? parseInt(projectForm.manager_id) : null,
                    description: projectForm.description ? projectForm.description.trim() : null,
                  };

                  if (editingProject) {
                    await projectsApi.updateProject(editingProject.id, payload);
                  } else {
                    await projectsApi.createProject(payload);
                  }
                  setIsProjectModalOpen(false);
                  await loadData();
                } catch (err) {
                  alert("Erro ao salvar: " + (err.response?.data?.detail || err.message));
                }
              }}
              className="p-5 space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Título do Projeto *</label>
                <input
                  type="text"
                  required
                  value={projectForm.title}
                  onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                  placeholder="Ex: Reforma da Rede Wi-Fi dos Pavimentos"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Categoria *</label>
                  <select
                    value={projectForm.category}
                    onChange={(e) => setProjectForm({ ...projectForm, category: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    {Object.keys(CATEGORY_COLORS).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Coluna Inicial</label>
                  <select
                    value={projectForm.status}
                    onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    {BOARD_COLUMNS.map((col) => (
                      <option key={col.id} value={col.id}>{col.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Gestor do Projeto</label>
                  <select
                    value={projectForm.manager_id}
                    onChange={(e) => setProjectForm({ ...projectForm, manager_id: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="">Não atribuído</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>{u.display_name} ({u.role})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Prazo de Entrega</label>
                  <input
                    type="date"
                    value={projectForm.due_date}
                    onChange={(e) => setProjectForm({ ...projectForm, due_date: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Descrição / Escopo</label>
                <textarea
                  rows={3}
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  placeholder="Justificativa técnica, objetivos e escopo..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsProjectModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  {editingProject ? "Atualizar" : "Criar Projeto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
