import { useState, useEffect, useMemo } from "react";
import {
  FolderKanban,
  Plus,
  Search,
  RefreshCw,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  User as UserIcon,
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
  ShieldAlert,
  HardDrive,
  Check,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../api/client";
import projectsApi from "../../api/projects";

const PROJECT_STATUSES = [
  "Planejamento",
  "Em Andamento",
  "Pausado",
  "Concluído",
  "Cancelado",
];

const PROJECT_CATEGORIES = [
  "Infraestrutura",
  "Redes & Wi-Fi",
  "Sistemas & ERP",
  "Hotelaria & UHs",
  "Segurança & CFTV",
  "Telecom & VoIP",
  "Hardware & Servidores",
  "Outros",
];

const KANBAN_COLUMNS = [
  { id: "A Fazer", title: "A Fazer", color: "border-slate-300 bg-slate-50 text-slate-700", badge: "bg-slate-200 text-slate-800" },
  { id: "Em Andamento", title: "Em Andamento", color: "border-blue-300 bg-blue-50/50 text-blue-700", badge: "bg-blue-100 text-blue-800" },
  { id: "Em Revisão", title: "Em Revisão", color: "border-purple-300 bg-purple-50/50 text-purple-700", badge: "bg-purple-100 text-purple-800" },
  { id: "Concluído", title: "Concluído", color: "border-emerald-300 bg-emerald-50/50 text-emerald-700", badge: "bg-emerald-100 text-emerald-800" },
];

export default function Projects() {
  const { user, isAdmin, isTechnician } = useAuth();

  const [projects, setProjects] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [allAssetsList, setAllAssetsList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros e Navegação por Abas
  const [activeTab, setActiveTab] = useState("projects"); // 'projects', 'kanban', 'detail', 'team', 'assets', 'tickets', 'timeline'
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedProjectDetail, setSelectedProjectDetail] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  // Modais de Projeto
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
  const [savingProject, setSavingProject] = useState(false);

  // Modais de Tarefa / Kanban
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    status: "A Fazer",
    priority: "Média",
    is_blocked: false,
    blocked_reason: "",
    assigned_to_id: "",
    due_date: "",
    create_ticket: false,
    ticket_category_id: "",
  });
  const [savingTask, setSavingTask] = useState(false);

  // Modal de Bloqueio Rápido de Tarefa
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [blockingTask, setBlockingTask] = useState(null);
  const [blockReasonInput, setBlockReasonInput] = useState("");

  // Modal de Chamados
  const [isLinkTicketModalOpen, setIsLinkTicketModalOpen] = useState(false);
  const [ticketIdToLink, setTicketIdToLink] = useState("");
  const [linkingTicket, setLinkingTicket] = useState(false);

  // Modal de Equipe / Membro Técnico
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [selectedUserIdToAdd, setSelectedUserIdToAdd] = useState("");

  // Modal de Ativos / CMDB
  const [isLinkAssetModalOpen, setIsLinkAssetModalOpen] = useState(false);
  const [assetSearchQuery, setAssetSearchQuery] = useState("");
  const [loadingAssets, setLoadingAssets] = useState(false);

  // Linha do Tempo / Timeline
  const [newTimelineComment, setNewTimelineComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  // Carregar Projetos, Usuários e Categorias
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

      if (selectedProjectId) {
        loadProjectDetail(selectedProjectId);
      } else if (projectsData && projectsData.length > 0 && !selectedProjectId) {
        setSelectedProjectId(projectsData[0].id);
      }
    } catch (err) {
      console.error("Erro ao carregar dados de projetos:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadProjectDetail = async (id) => {
    try {
      const detail = await projectsApi.getProject(id);
      setSelectedProjectDetail(detail);
    } catch (err) {
      console.error("Erro ao carregar detalhes do projeto:", err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadProjectDetail(selectedProjectId);
    }
  }, [selectedProjectId]);

  // Ações de Projetos
  const handleOpenCreateProject = () => {
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
  };

  const handleOpenEditProject = (proj) => {
    setEditingProject(proj);
    setProjectForm({
      title: proj.title || "",
      category: proj.category || "Infraestrutura",
      status: proj.status || "Planejamento",
      priority: proj.priority || "Média",
      start_date: proj.start_date || "",
      due_date: proj.due_date || "",
      budget: proj.budget ? String(proj.budget) : "",
      manager_id: proj.manager_id || "",
      description: proj.description || "",
    });
    setIsProjectModalOpen(true);
  };

  const handleSaveProject = async (e) => {
    e.preventDefault();
    if (!projectForm.title.trim()) {
      alert("Por favor informe o título do projeto.");
      return;
    }

    try {
      setSavingProject(true);
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
        const newProj = await projectsApi.createProject(payload);
        setSelectedProjectId(newProj.id);
      }

      setIsProjectModalOpen(false);
      await loadData();
    } catch (err) {
      console.error("Erro ao salvar projeto:", err);
      alert("Falha ao salvar projeto: " + (err.response?.data?.detail || err.message));
    } finally {
      setSavingProject(false);
    }
  };

  const handleDeleteProject = async (projId) => {
    if (!window.confirm("Atenção: deseja excluir este projeto e todas as suas tarefas? Chamados vinculados não serão apagados.")) return;
    try {
      await projectsApi.deleteProject(projId);
      if (selectedProjectId === projId) {
        setSelectedProjectId(null);
        setSelectedProjectDetail(null);
      }
      await loadData();
    } catch (err) {
      console.error("Erro ao excluir projeto:", err);
      alert("Falha ao excluir projeto: " + (err.response?.data?.detail || err.message));
    }
  };

  // Ações de Tarefas / Kanban
  const handleOpenCreateTask = (defaultStatus = "A Fazer") => {
    if (!selectedProjectId) {
      alert("Selecione um projeto antes de criar uma tarefa.");
      return;
    }
    setEditingTask(null);
    setTaskForm({
      title: "",
      description: "",
      status: defaultStatus,
      priority: "Média",
      is_blocked: false,
      blocked_reason: "",
      assigned_to_id: user?.id || "",
      due_date: "",
      create_ticket: false,
      ticket_category_id: categoriesList[0]?.id || "",
    });
    setIsTaskModalOpen(true);
  };

  const handleOpenEditTask = (task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title || "",
      description: task.description || "",
      status: task.status || "A Fazer",
      priority: task.priority || "Média",
      is_blocked: task.is_blocked || false,
      blocked_reason: task.blocked_reason || "",
      assigned_to_id: task.assigned_to_id || "",
      due_date: task.due_date || "",
      create_ticket: false,
      ticket_category_id: categoriesList[0]?.id || "",
    });
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = async (e) => {
    e.preventDefault();
    if (!taskForm.title.trim()) {
      alert("Por favor informe o título da tarefa.");
      return;
    }

    try {
      setSavingTask(true);
      const payload = {
        title: taskForm.title.trim(),
        description: taskForm.description ? taskForm.description.trim() : null,
        status: taskForm.status,
        priority: taskForm.priority,
        is_blocked: taskForm.is_blocked,
        blocked_reason: taskForm.is_blocked ? (taskForm.blocked_reason?.trim() || "Impedimento técnico reportado") : null,
        assigned_to_id: taskForm.assigned_to_id ? parseInt(taskForm.assigned_to_id) : null,
        due_date: taskForm.due_date || null,
        create_ticket: taskForm.create_ticket,
        ticket_category_id: taskForm.ticket_category_id ? parseInt(taskForm.ticket_category_id) : null,
      };

      if (editingTask) {
        await projectsApi.updateTask(selectedProjectId, editingTask.id, payload);
      } else {
        await projectsApi.createTask(selectedProjectId, payload);
      }

      setIsTaskModalOpen(false);
      await loadProjectDetail(selectedProjectId);
      await loadData();
    } catch (err) {
      console.error("Erro ao salvar tarefa:", err);
      alert("Falha ao salvar tarefa: " + (err.response?.data?.detail || err.message));
    } finally {
      setSavingTask(false);
    }
  };

  const handleMoveTaskStatus = async (task, newStatus) => {
    try {
      await projectsApi.updateTask(selectedProjectId, task.id, { status: newStatus });
      await loadProjectDetail(selectedProjectId);
      await loadData();
    } catch (err) {
      console.error("Erro ao mover status da tarefa:", err);
      alert("Falha ao atualizar tarefa.");
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Deseja excluir esta tarefa do projeto?")) return;
    try {
      await projectsApi.deleteTask(selectedProjectId, taskId);
      await loadProjectDetail(selectedProjectId);
      await loadData();
    } catch (err) {
      console.error("Erro ao excluir tarefa:", err);
      alert("Falha ao excluir tarefa.");
    }
  };

  // Bloqueio / Desbloqueio Rápido de Tarefa
  const handleOpenBlockModal = (task) => {
    setBlockingTask(task);
    setBlockReasonInput(task.blocked_reason || "");
    setIsBlockModalOpen(true);
  };

  const handleConfirmBlockTask = async (e) => {
    e.preventDefault();
    if (!blockingTask) return;
    try {
      await projectsApi.updateTask(selectedProjectId, blockingTask.id, {
        is_blocked: true,
        blocked_reason: blockReasonInput.trim() || "Impedimento técnico reportado.",
      });
      setIsBlockModalOpen(false);
      setBlockingTask(null);
      setBlockReasonInput("");
      await loadProjectDetail(selectedProjectId);
      await loadData();
    } catch (err) {
      console.error("Erro ao bloquear tarefa:", err);
      alert("Falha ao bloquear tarefa.");
    }
  };

  const handleUnblockTask = async (task) => {
    try {
      await projectsApi.updateTask(selectedProjectId, task.id, {
        is_blocked: false,
        blocked_reason: null,
      });
      await loadProjectDetail(selectedProjectId);
      await loadData();
    } catch (err) {
      console.error("Erro ao desbloquear tarefa:", err);
      alert("Falha ao desbloquear tarefa.");
    }
  };

  // Chamados Vinculados
  const handleLinkTicket = async (e) => {
    e.preventDefault();
    const tId = parseInt(ticketIdToLink);
    if (!tId || isNaN(tId)) {
      alert("Informe um número de chamado válido.");
      return;
    }

    try {
      setLinkingTicket(true);
      await projectsApi.linkTicket(selectedProjectId, tId);
      setIsLinkTicketModalOpen(false);
      setTicketIdToLink("");
      await loadProjectDetail(selectedProjectId);
      await loadData();
      alert(`Chamado #${tId} vinculado com sucesso ao projeto!`);
    } catch (err) {
      console.error("Erro ao vincular chamado:", err);
      alert("Falha ao vincular chamado: " + (err.response?.data?.detail || err.message));
    } finally {
      setLinkingTicket(false);
    }
  };

  const handleUnlinkTicket = async (ticketId) => {
    if (!window.confirm(`Deseja desvincular o chamado #${ticketId} deste projeto?`)) return;
    try {
      await projectsApi.unlinkTicket(selectedProjectId, ticketId);
      await loadProjectDetail(selectedProjectId);
      await loadData();
    } catch (err) {
      console.error("Erro ao desvincular chamado:", err);
      alert("Falha ao desvincular chamado.");
    }
  };

  // Equipe Técnica / Membros
  const handleAddMember = async (userId) => {
    if (!selectedProjectId || !userId) return;
    try {
      await projectsApi.addMember(selectedProjectId, parseInt(userId));
      await loadProjectDetail(selectedProjectId);
      await loadData();
      setIsAddMemberModalOpen(false);
      setSelectedUserIdToAdd("");
    } catch (err) {
      console.error("Erro ao associar técnico:", err);
      alert("Falha ao associar técnico: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm("Deseja desvincular este técnico da equipe do projeto?")) return;
    try {
      await projectsApi.removeMember(selectedProjectId, userId);
      await loadProjectDetail(selectedProjectId);
      await loadData();
    } catch (err) {
      console.error("Erro ao remover técnico:", err);
      alert("Falha ao remover técnico.");
    }
  };

  // Ativos / CMDB Vinculados
  const handleOpenLinkAssetModal = async () => {
    setIsLinkAssetModalOpen(true);
    if (allAssetsList.length === 0) {
      try {
        setLoadingAssets(true);
        const res = await api.get("/assets/?is_active=true");
        setAllAssetsList(res.data || []);
      } catch (err) {
        console.error("Erro ao carregar ativos:", err);
      } finally {
        setLoadingAssets(false);
      }
    }
  };

  const handleLinkAsset = async (assetId) => {
    if (!selectedProjectId || !assetId) return;
    try {
      await projectsApi.linkAsset(selectedProjectId, assetId);
      await loadProjectDetail(selectedProjectId);
      await loadData();
      setIsLinkAssetModalOpen(false);
    } catch (err) {
      console.error("Erro ao vincular ativo:", err);
      alert("Falha ao vincular ativo: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleUnlinkAsset = async (assetId) => {
    if (!window.confirm("Deseja desvincular este equipamento do projeto?")) return;
    try {
      await projectsApi.unlinkAsset(selectedProjectId, assetId);
      await loadProjectDetail(selectedProjectId);
      await loadData();
    } catch (err) {
      console.error("Erro ao desvincular ativo:", err);
      alert("Falha ao desvincular equipamento.");
    }
  };

  // Linha do Tempo / Timeline
  const handlePostTimelineComment = async (e) => {
    e.preventDefault();
    if (!newTimelineComment.trim() || !selectedProjectId) return;
    try {
      setPostingComment(true);
      await projectsApi.addTimelineComment(selectedProjectId, newTimelineComment.trim());
      setNewTimelineComment("");
      await loadProjectDetail(selectedProjectId);
    } catch (err) {
      console.error("Erro ao publicar nota na timeline:", err);
      alert("Falha ao publicar nota.");
    } finally {
      setPostingComment(false);
    }
  };

  // Filtros de Projetos
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (categoryFilter !== "ALL" && p.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inTitle = (p.title || "").toLowerCase().includes(q);
        const inCode = (p.code || "").toLowerCase().includes(q);
        const inDesc = (p.description || "").toLowerCase().includes(q);
        if (!inTitle && !inCode && !inDesc) return false;
      }
      return true;
    });
  }, [projects, statusFilter, categoryFilter, searchQuery]);

  // Ativos disponíveis para vínculo (exclui os já vinculados)
  const availableAssetsToLink = useMemo(() => {
    const linkedIds = new Set((selectedProjectDetail?.assets || []).map((a) => a.id));
    return allAssetsList.filter((a) => {
      if (linkedIds.has(a.id)) return false;
      if (!assetSearchQuery.trim()) return true;
      const q = assetSearchQuery.toLowerCase().trim();
      const name = (a.name || "").toLowerCase();
      const tag = (a.asset_tag || "").toLowerCase();
      const ip = (a.ip_address || "").toLowerCase();
      const model = (a.model || "").toLowerCase();
      return name.includes(q) || tag.includes(q) || ip.includes(q) || model.includes(q);
    });
  }, [allAssetsList, selectedProjectDetail?.assets, assetSearchQuery]);

  // Usuários disponíveis para equipe (exclui o gestor e os já membros)
  const availableUsersForTeam = useMemo(() => {
    const existingIds = new Set([
      selectedProjectDetail?.manager_id,
      ...(selectedProjectDetail?.members || []).map((m) => m.id),
    ]);
    return usersList.filter((u) => !existingIds.has(u.id));
  }, [usersList, selectedProjectDetail]);

  // Estatísticas Gerais (KPIs)
  const stats = useMemo(() => {
    const total = projects.length;
    const inProgress = projects.filter((p) => p.status === "Em Andamento").length;
    const completed = projects.filter((p) => p.status === "Concluído").length;
    const totalBudget = projects.reduce((acc, p) => acc + (parseFloat(p.budget) || 0), 0);
    const avgProgress = total > 0 ? Math.round(projects.reduce((acc, p) => acc + (p.progress || 0), 0) / total) : 0;
    return { total, inProgress, completed, totalBudget, avgProgress };
  }, [projects]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header com Visual NOC/Helpdesk Premium */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-700/50">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-500/30">
              <Sparkles size={14} className="text-blue-400" />
              <span>Gestão de Projetos, CMDB & Portfólio ITIL (TIHFSA)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <FolderKanban className="text-blue-400" size={32} />
              Projetos & Central de Entregas
            </h1>
            <p className="text-slate-300 text-sm sm:text-base max-w-2xl leading-relaxed">
              Coordene metas de infraestrutura, tarefas em Kanban, equipamentos afetados (CMDB), equipe técnica e chamados de suporte.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white rounded-2xl text-xs sm:text-sm font-bold border border-slate-600 transition-all cursor-pointer shadow-sm"
              title="Atualizar dados"
            >
              <RefreshCw size={16} />
              <span>Atualizar</span>
            </button>

            {(isAdmin || isTechnician) && (
              <button
                type="button"
                onClick={handleOpenCreateProject}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 hover:scale-105 transition-all cursor-pointer"
              >
                <Plus size={18} />
                <span>Novo Projeto</span>
              </button>
            )}
          </div>
        </div>

        {/* KPIs de Portfólio */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-slate-700/60">
          <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80">
            <p className="text-slate-400 text-xs font-semibold">Total de Projetos</p>
            <h3 className="text-xl sm:text-2xl font-black text-white mt-1">{stats.total}</h3>
          </div>
          <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80">
            <p className="text-slate-400 text-xs font-semibold">Em Andamento</p>
            <h3 className="text-xl sm:text-2xl font-black text-blue-400 mt-1">{stats.inProgress}</h3>
          </div>
          <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80">
            <p className="text-slate-400 text-xs font-semibold">Progresso Médio</p>
            <h3 className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">{stats.avgProgress}%</h3>
          </div>
          <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80">
            <p className="text-slate-400 text-xs font-semibold">Orçamento Alocado</p>
            <h3 className="text-xl sm:text-2xl font-black text-amber-300 mt-1">
              R$ {stats.totalBudget.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </h3>
          </div>
        </div>
      </div>

      {/* Barra de Abas e Filtros Rápidos */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        {/* Abas */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("projects")}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "projects"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            📑 Visão Geral
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("kanban")}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "kanban"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            📋 Quadro Kanban
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("team")}
            disabled={!selectedProjectId}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5 ${
              activeTab === "team"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Users size={15} />
            <span>Equipe ({selectedProjectDetail?.members?.length || 0})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("assets")}
            disabled={!selectedProjectId}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5 ${
              activeTab === "assets"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Server size={15} />
            <span>Ativos CMDB ({selectedProjectDetail?.assets?.length || 0})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tickets")}
            disabled={!selectedProjectId}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5 ${
              activeTab === "tickets"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Ticket size={15} />
            <span>Chamados ({selectedProjectDetail?.tickets?.length || 0})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("timeline")}
            disabled={!selectedProjectId}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5 ${
              activeTab === "timeline"
                ? "bg-violet-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <History size={15} />
            <span>Linha do Tempo</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("detail")}
            disabled={!selectedProjectId}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer disabled:opacity-40 ${
              activeTab === "detail"
                ? "bg-slate-700 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            ⚙️ Escopo & Detalhes
          </button>
        </div>

        {/* Busca e Filtros Rápidos */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:w-56">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar projeto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="ALL">Status: Todos</option>
            {PROJECT_STATUSES.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="ALL">Categoria: Todas</option>
            {PROJECT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Conteúdo Dinâmico por Aba */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
          <RefreshCw className="animate-spin text-blue-500 mx-auto mb-3" size={32} />
          <p className="text-slate-500 text-sm font-medium">Carregando projetos...</p>
        </div>
      ) : activeTab === "projects" ? (
        /* ─── ABA 1: LISTAGEM DE PROJETOS EM CARDS ─── */
        filteredProjects.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-4">
            <FolderKanban className="text-slate-300 mx-auto" size={48} />
            <div>
              <h3 className="font-extrabold text-slate-800 text-base">Nenhum projeto encontrado</h3>
              <p className="text-slate-500 text-sm mt-1">Crie o primeiro projeto para gerenciar prazos, tarefas e equipamentos da TI.</p>
            </div>
            <button
              type="button"
              onClick={handleOpenCreateProject}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer hover:bg-blue-500"
            >
              <Plus size={16} />
              <span>Criar Novo Projeto</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((p) => {
              const isSelected = selectedProjectId === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedProjectId(p.id);
                  }}
                  className={`bg-white rounded-3xl p-6 border transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden ${
                    isSelected
                      ? "border-blue-500 ring-2 ring-blue-500/20 shadow-lg"
                      : "border-slate-200 hover:border-slate-300 hover:shadow-md"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-black">
                        {p.code}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          p.status === "Em Andamento"
                            ? "bg-blue-100 text-blue-800"
                            : p.status === "Concluído"
                            ? "bg-emerald-100 text-emerald-800"
                            : p.status === "Pausado"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-lg text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                      {p.title}
                    </h3>

                    {p.description && (
                      <p className="text-slate-500 text-xs line-clamp-2 leading-relaxed">
                        {p.description}
                      </p>
                    )}

                    {/* Barra de Progresso */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-xs font-bold text-slate-600">
                        <span>Progresso</span>
                        <span>{p.progress || 0}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all"
                          style={{ width: `${Math.min(100, Math.max(0, p.progress || 0))}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Gestor</span>
                        <strong className="text-slate-700 truncate block">{p.manager?.display_name || "Não atribuído"}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Prazo</span>
                        <strong className="text-slate-700 block">
                          {p.due_date ? new Date(p.due_date).toLocaleDateString("pt-BR") : "Sem prazo"}
                        </strong>
                      </div>
                    </div>

                    {/* Chips de Recursos Vinculados */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 text-[11px] font-semibold text-slate-600">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100">
                        <Users size={12} className="text-indigo-600" />
                        {p.members_count || p.members?.length || 0} técnicos
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100">
                        <Server size={12} className="text-emerald-600" />
                        {p.assets_count || 0} ativos
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100">
                        <Ticket size={12} className="text-amber-600" />
                        {p.tickets_count || 0} chamados
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-400 text-xs">{p.tasks_count || 0} tarefas</span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProjectId(p.id);
                          setActiveTab("kanban");
                        }}
                        className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-bold text-xs cursor-pointer"
                      >
                        Abrir Kanban
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditProject(p);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                        title="Editar Projeto"
                      >
                        <Edit3 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : activeTab === "kanban" ? (
        /* ─── ABA 2: QUADRO KANBAN DE TAREFAS COM SUPORTE A BLOQUEIOS ─── */
        <div className="space-y-4">
          {/* Seletor de Projeto Ativo no Kanban */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Projeto Ativo:</span>
              <select
                value={selectedProjectId || ""}
                onChange={(e) => setSelectedProjectId(parseInt(e.target.value))}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.title} ({p.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenCreateTask("A Fazer")}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                <Plus size={16} />
                <span>Nova Tarefa</span>
              </button>
            </div>
          </div>

          {/* 4 Colunas Kanban */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            {KANBAN_COLUMNS.map((col) => {
              const tasksInCol = (selectedProjectDetail?.tasks || []).filter(
                (t) => t.status === col.id
              );

              return (
                <div
                  key={col.id}
                  className={`rounded-2xl border p-4 space-y-3 min-h-[500px] flex flex-col justify-between ${col.color}`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-current/10">
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-sm">{col.title}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${col.badge}`}>
                          {tasksInCol.length}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenCreateTask(col.id)}
                        className="p-1 rounded-lg hover:bg-black/5 text-current cursor-pointer"
                        title={`Adicionar tarefa em ${col.title}`}
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    {/* Lista de Cartões */}
                    <div className="space-y-3">
                      {tasksInCol.map((task) => (
                        <div
                          key={task.id}
                          className={`bg-white rounded-xl p-3.5 shadow-xs border transition-all space-y-2.5 relative group text-slate-800 ${
                            task.is_blocked
                              ? "border-rose-400 ring-2 ring-rose-300/40 bg-rose-50/20"
                              : "border-slate-200 hover:shadow-md"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                  task.priority === "Urgente"
                                    ? "bg-rose-100 text-rose-800"
                                    : task.priority === "Alta"
                                    ? "bg-orange-100 text-orange-800"
                                    : task.priority === "Média"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {task.priority}
                              </span>

                              {task.is_blocked && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-rose-600 text-white animate-pulse">
                                  <Ban size={10} />
                                  Bloqueado
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => handleOpenEditTask(task)}
                                className="p-1 text-slate-400 hover:text-blue-600 rounded"
                                title="Editar Tarefa"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTask(task.id)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded"
                                title="Excluir Tarefa"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          <h5 className="font-bold text-sm leading-tight text-slate-900">
                            {task.title}
                          </h5>

                          {task.description && (
                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                              {task.description}
                            </p>
                          )}

                          {/* Caixa de Bloqueio com Motivo e Botão de Ação */}
                          {task.is_blocked ? (
                            <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 text-xs space-y-1">
                              <div className="flex items-center justify-between font-bold text-[11px]">
                                <span className="flex items-center gap-1 text-rose-700">
                                  <AlertTriangle size={13} className="text-rose-600" />
                                  Impedimento Ativo
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUnblockTask(task)}
                                  className="text-[10px] px-2 py-0.5 bg-rose-200 hover:bg-rose-300 rounded font-bold text-rose-900 cursor-pointer"
                                  title="Liberar e desbloquear atividade"
                                >
                                  Desbloquear
                                </button>
                              </div>
                              {task.blocked_reason && (
                                <p className="text-[11px] text-rose-800 leading-tight italic">
                                  "{task.blocked_reason}"
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleOpenBlockModal(task)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-500 font-bold cursor-pointer"
                                title="Sinalizar bloqueio / impedimento"
                              >
                                Sinalizar Bloqueio
                              </button>
                            </div>
                          )}

                          {/* Chamado Vinculado */}
                          {task.ticket && (
                            <div className="p-1.5 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center justify-between text-[11px] text-blue-900 font-semibold">
                              <span className="flex items-center gap-1 truncate">
                                <Ticket size={12} className="text-blue-600 shrink-0" />
                                #{task.ticket.id} {task.ticket.title}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-200 text-blue-900 font-bold shrink-0">
                                {task.ticket.status}
                              </span>
                            </div>
                          )}

                          {/* Rodapé do Cartão */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                            <span className="truncate max-w-[120px]" title={task.assigned_to?.display_name}>
                              👤 {task.assigned_to?.display_name?.split(" ")[0] || "Livre"}
                            </span>

                            {/* Controles para Mover entre Colunas */}
                            <div className="flex items-center gap-1">
                              {col.id !== "A Fazer" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const prevStatus =
                                      col.id === "Concluído"
                                        ? "Em Revisão"
                                        : col.id === "Em Revisão"
                                        ? "Em Andamento"
                                        : "A Fazer";
                                    handleMoveTaskStatus(task, prevStatus);
                                  }}
                                  className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                                  title="Mover para esquerda"
                                >
                                  <ChevronLeft size={13} />
                                </button>
                              )}
                              {col.id !== "Concluído" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextStatus =
                                      col.id === "A Fazer"
                                        ? "Em Andamento"
                                        : col.id === "Em Andamento"
                                        ? "Em Revisão"
                                        : "Concluído";
                                    handleMoveTaskStatus(task, nextStatus);
                                  }}
                                  className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                                  title="Mover para direita"
                                >
                                  <ChevronRight size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenCreateTask(col.id)}
                    className="w-full py-2 bg-white/70 hover:bg-white text-xs font-bold rounded-xl border border-dashed border-current/30 text-current transition-colors flex items-center justify-center gap-1 cursor-pointer mt-4"
                  >
                    <Plus size={14} />
                    <span>Adicionar Cartão</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : activeTab === "team" ? (
        /* ─── ABA 3: EQUIPE TÉCNICA DO PROJETO ─── */
        selectedProjectDetail && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Users className="text-indigo-600" size={24} />
                  Equipe & Colaboradores do Projeto
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Defina o gestor geral e os técnicos de TI participantes na execução deste projeto.
                </p>
              </div>

              {(isAdmin || isTechnician) && (
                <button
                  type="button"
                  onClick={() => setIsAddMemberModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md cursor-pointer transition-all"
                >
                  <Plus size={16} />
                  <span>Associar Técnico à Equipe</span>
                </button>
              )}
            </div>

            {/* Cartão do Gestor do Projeto */}
            <div className="p-5 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-md">
                  👑
                </div>
                <div>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-200 text-indigo-900 text-[10px] font-black uppercase">
                    Gestor do Projeto
                  </span>
                  <h4 className="text-base font-bold text-slate-900 mt-1">
                    {selectedProjectDetail.manager?.display_name || "Não atribuído"}
                  </h4>
                  <p className="text-xs text-slate-600">{selectedProjectDetail.manager?.email || "Sem e-mail"}</p>
                </div>
              </div>
            </div>

            {/* Lista de Técnicos Participantes */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Técnicos Participantes ({selectedProjectDetail.members?.length || 0})
              </h4>

              {(!selectedProjectDetail.members || selectedProjectDetail.members.length === 0) ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs">
                  Nenhum técnico participante associado a este projeto ainda. Clique em "Associar Técnico à Equipe" para adicionar.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {selectedProjectDetail.members.map((member) => (
                    <div
                      key={member.id}
                      className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 hover:bg-white hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center font-bold text-sm">
                          {member.display_name?.charAt(0) || "U"}
                        </div>
                        <div className="truncate">
                          <h5 className="font-bold text-sm text-slate-900 truncate">{member.display_name}</h5>
                          <p className="text-xs text-slate-500 truncate">{member.role || "Técnico"}</p>
                        </div>
                      </div>

                      {(isAdmin || isTechnician) && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Remover técnico da equipe"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      ) : activeTab === "assets" ? (
        /* ─── ABA 4: ATIVOS & EQUIPAMENTOS CMDB DO PROJETO ─── */
        selectedProjectDetail && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Server className="text-emerald-600" size={24} />
                  Equipamentos & Ativos Envolvidos (CMDB)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Vincule os equipamentos que serão instalados, atualizados ou afetados pelo projeto (switches, servidores, APs, nobreaks).
                </p>
              </div>

              {(isAdmin || isTechnician) && (
                <button
                  type="button"
                  onClick={handleOpenLinkAssetModal}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md cursor-pointer transition-all"
                >
                  <Plus size={16} />
                  <span>Vincular Equipamento (CMDB)</span>
                </button>
              )}
            </div>

            {(!selectedProjectDetail.assets || selectedProjectDetail.assets.length === 0) ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs">
                Nenhum equipamento associado a este projeto ainda. Vincule switches, servidores ou APs para rastrear os ativos afetados.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedProjectDetail.assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 hover:bg-white hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black">
                        {asset.type}
                      </span>
                      {(isAdmin || isTechnician) && (
                        <button
                          type="button"
                          onClick={() => handleUnlinkAsset(asset.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-md cursor-pointer"
                          title="Desvincular equipamento do projeto"
                        >
                          <Unlink size={15} />
                        </button>
                      )}
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-slate-900 leading-snug">{asset.name}</h4>
                      <p className="text-xs text-slate-500">
                        {asset.brand || ""} {asset.model || ""}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Patrimônio</span>
                        <strong className="text-slate-800 font-mono">{asset.asset_tag || "S/N"}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">IP</span>
                        <strong className="text-slate-800 font-mono">{asset.ip_address || "DHCP"}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      ) : activeTab === "tickets" ? (
        /* ─── ABA 5: CHAMADOS DE SUPORTE VINCULADOS ─── */
        selectedProjectDetail && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Ticket className="text-amber-600" size={24} />
                  Chamados do Helpdesk Vinculados ({selectedProjectDetail.tickets?.length || 0})
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Acompanhe chamados de origem ou pendências técnicas associadas a este projeto.
                </p>
              </div>

              {(isAdmin || isTechnician) && (
                <button
                  type="button"
                  onClick={() => setIsLinkTicketModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md cursor-pointer transition-all"
                >
                  <LinkIcon size={16} />
                  <span>Vincular Chamado Existente</span>
                </button>
              )}
            </div>

            {(!selectedProjectDetail.tickets || selectedProjectDetail.tickets.length === 0) ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs">
                Nenhum chamado de suporte está vinculado a este projeto ainda.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                {selectedProjectDetail.tickets.map((t) => (
                  <div key={t.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-800 rounded-lg text-xs font-black">
                        #{t.id}
                      </span>
                      <div>
                        <h5 className="font-bold text-sm text-slate-900">{t.title}</h5>
                        <p className="text-xs text-slate-500">
                          Solicitante: {t.requester_name || "N/A"} • Técnico: {t.technician_name || "Não atribuído"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                        {t.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUnlinkTicket(t.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                        title="Desvincular chamado"
                      >
                        <Unlink size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      ) : activeTab === "timeline" ? (
        /* ─── ABA 6: LINHA DO TEMPO HÍBRIDA & HISTÓRICO ─── */
        selectedProjectDetail && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6 animate-fadeIn">
            <div>
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <History className="text-violet-600" size={24} />
                Linha do Tempo & Andamento Técnico
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Feed cronológico com comentários da equipe e registros automáticos de tarefas e entregas.
              </p>
            </div>

            {/* Caixa de Novo Comentário */}
            <form onSubmit={handlePostTimelineComment} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Registrar Atualização / Comentário da Equipe
              </label>
              <textarea
                rows={2}
                value={newTimelineComment}
                onChange={(e) => setNewTimelineComment(e.target.value)}
                placeholder="Ex: Concluído teste de sinal Wi-Fi nas UHs 201-208. Switch configurado com VLAN 30."
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={postingComment || !newTimelineComment.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Send size={14} />
                  <span>{postingComment ? "Publicando..." : "Publicar Nota"}</span>
                </button>
              </div>
            </form>

            {/* Feed de Eventos Cronológicos */}
            <div className="space-y-4 pt-2">
              {(!selectedProjectDetail.timeline || selectedProjectDetail.timeline.length === 0) ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs">
                  Nenhum registro na linha do tempo ainda.
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                  {selectedProjectDetail.timeline.map((entry) => {
                    const isSystem = entry.event_type !== "comment";
                    return (
                      <div key={entry.id} className="relative group">
                        {/* Marcador do Timeline */}
                        <div
                          className={`absolute -left-6 top-1.5 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[10px] shadow-xs ${
                            entry.event_type === "task"
                              ? "bg-blue-600 text-white"
                              : entry.event_type === "ticket"
                              ? "bg-amber-500 text-white"
                              : entry.event_type === "asset"
                              ? "bg-emerald-600 text-white"
                              : entry.event_type === "status"
                              ? "bg-purple-600 text-white"
                              : "bg-slate-800 text-white"
                          }`}
                        >
                          {entry.event_type === "comment" ? "💬" : "•"}
                        </div>

                        <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/80 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800">
                              {entry.author?.display_name || "Sistema"}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {entry.created_at ? new Date(entry.created_at).toLocaleString("pt-BR") : ""}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                            {entry.content}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )
      ) : (
        /* ─── ABA 7: DETALHES GERAIS & ESCOPO DO PROJETO ─── */
        selectedProjectDetail && (
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm space-y-8 animate-fadeIn">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-black">
                    {selectedProjectDetail.code}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                    {selectedProjectDetail.category}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                    {selectedProjectDetail.status}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
                  {selectedProjectDetail.title}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenEditProject(selectedProjectDetail)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  <Edit3 size={15} />
                  <span>Editar Projeto</span>
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleDeleteProject(selectedProjectDetail.id)}
                    className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50 cursor-pointer"
                    title="Excluir Projeto"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>

            {/* Informações Gerais */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <span className="text-xs text-slate-500 font-bold uppercase block">Gestor Responsável</span>
                <strong className="text-slate-800 text-sm">{selectedProjectDetail.manager?.display_name || "Não atribuído"}</strong>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-bold uppercase block">Data de Início</span>
                <strong className="text-slate-800 text-sm">
                  {selectedProjectDetail.start_date ? new Date(selectedProjectDetail.start_date).toLocaleDateString("pt-BR") : "Não definida"}
                </strong>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-bold uppercase block">Data de Conclusão / Prazo</span>
                <strong className="text-slate-800 text-sm">
                  {selectedProjectDetail.due_date ? new Date(selectedProjectDetail.due_date).toLocaleDateString("pt-BR") : "Não definida"}
                </strong>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-bold uppercase block">Orçamento Previsto</span>
                <strong className="text-slate-800 text-sm text-emerald-700">
                  R$ {parseFloat(selectedProjectDetail.budget || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </strong>
              </div>
            </div>

            {selectedProjectDetail.description && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Escopo & Descrição do Projeto</h4>
                <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  {selectedProjectDetail.description}
                </p>
              </div>
            )}
          </div>
        )
      )}

      {/* ─── MODAL PROJETO (CRIAR / EDITAR) ─── */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {editingProject ? `Editar: ${editingProject.code}` : "Novo Projeto de TI"}
                </h3>
                <p className="text-xs text-slate-500">
                  Defina o escopo, cronograma, gestor e orçamento.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsProjectModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Título do Projeto *</label>
                <input
                  type="text"
                  required
                  value={projectForm.title}
                  onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                  placeholder="Ex: Upgrade de Switches UniFi do Bloco B"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Categoria *</label>
                  <select
                    value={projectForm.category}
                    onChange={(e) => setProjectForm({ ...projectForm, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PROJECT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={projectForm.status}
                    onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PROJECT_STATUSES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Prioridade</label>
                  <select
                    value={projectForm.priority}
                    onChange={(e) => setProjectForm({ ...projectForm, priority: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Baixa">Baixa</option>
                    <option value="Média">Média</option>
                    <option value="Alta">Alta</option>
                    <option value="Crítica">Crítica</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Gestor Responsável</label>
                  <select
                    value={projectForm.manager_id}
                    onChange={(e) => setProjectForm({ ...projectForm, manager_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Não atribuído</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.display_name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Data de Início</label>
                  <input
                    type="date"
                    value={projectForm.start_date}
                    onChange={(e) => setProjectForm({ ...projectForm, start_date: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Previsão de Conclusão</label>
                  <input
                    type="date"
                    value={projectForm.due_date}
                    onChange={(e) => setProjectForm({ ...projectForm, due_date: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Orçamento (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={projectForm.budget}
                    onChange={(e) => setProjectForm({ ...projectForm, budget: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Descrição / Escopo</label>
                <textarea
                  rows={4}
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  placeholder="Detalhes, justificativa técnica e objetivos deste projeto..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsProjectModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingProject}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {savingProject ? "Salvando..." : editingProject ? "Atualizar Projeto" : "Criar Projeto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL TAREFA (CRIAR / EDITAR) ─── */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {editingTask ? "Editar Tarefa" : "Nova Tarefa Kanban"}
                </h3>
                <p className="text-xs text-slate-500">
                  Atribua a um técnico, defina prazo, impedimentos e coluna.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTaskModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Título da Tarefa *</label>
                <input
                  type="text"
                  required
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  placeholder="Ex: Passar cabeamento estruturado no 2º andar"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Coluna (Status)</label>
                  <select
                    value={taskForm.status}
                    onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none"
                  >
                    {KANBAN_COLUMNS.map((col) => (
                      <option key={col.id} value={col.id}>{col.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Prioridade</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none"
                  >
                    <option value="Baixa">Baixa</option>
                    <option value="Média">Média</option>
                    <option value="Alta">Alta</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Responsável</label>
                  <select
                    value={taskForm.assigned_to_id}
                    onChange={(e) => setTaskForm({ ...taskForm, assigned_to_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none"
                  >
                    <option value="">Não atribuído</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.display_name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Data Limite</label>
                  <input
                    type="date"
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Seção de Bloqueio / Impedimento */}
              <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={taskForm.is_blocked}
                    onChange={(e) => setTaskForm({ ...taskForm, is_blocked: e.target.checked })}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-xs font-bold text-rose-900 flex items-center gap-1">
                    <Ban size={13} className="text-rose-600" />
                    Atividade com Bloqueio / Impedimento Técnico
                  </span>
                </label>

                {taskForm.is_blocked && (
                  <div>
                    <label className="block text-[11px] font-bold text-rose-800 mb-1">
                      Motivo do Bloqueio *
                    </label>
                    <input
                      type="text"
                      required={taskForm.is_blocked}
                      value={taskForm.blocked_reason}
                      onChange={(e) => setTaskForm({ ...taskForm, blocked_reason: e.target.value })}
                      placeholder="Ex: Aguardando entrega dos patch cords pelo fornecedor"
                      className="w-full px-3 py-1.5 bg-white border border-rose-300 rounded-lg text-xs"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  placeholder="Instruções e detalhes técnicos da tarefa..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                />
              </div>

              {!editingTask && (
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={taskForm.create_ticket}
                      onChange={(e) => setTaskForm({ ...taskForm, create_ticket: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-blue-900">
                      Gerar chamado vinculado no Helpdesk automaticamente
                    </span>
                  </label>

                  {taskForm.create_ticket && (
                    <div className="pt-2">
                      <label className="block text-[11px] font-bold text-blue-800 mb-1">Categoria do Chamado</label>
                      <select
                        value={taskForm.ticket_category_id}
                        onChange={(e) => setTaskForm({ ...taskForm, ticket_category_id: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-blue-300 rounded-lg text-xs"
                      >
                        {categoriesList.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingTask}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {savingTask ? "Salvando..." : editingTask ? "Atualizar Tarefa" : "Criar Tarefa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL BLOQUEAR TAREFA RÁPIDO ─── */}
      {isBlockModalOpen && blockingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-rose-700 flex items-center gap-2">
                  <Ban size={20} />
                  Sinalizar Impedimento Técnico
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Tarefa: <strong>{blockingTask.title}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBlockModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmBlockTask} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Motivo do Bloqueio *</label>
                <textarea
                  rows={3}
                  required
                  value={blockReasonInput}
                  onChange={(e) => setBlockReasonInput(e.target.value)}
                  placeholder="Ex: Aguardando liberação de acesso ao switch core pela gerência de segurança..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBlockModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Confirmar Bloqueio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL VINCULAR ATIVO CMDB ─── */}
      {isLinkAssetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Server className="text-emerald-600" size={20} />
                  Vincular Equipamento (CMDB)
                </h3>
                <p className="text-xs text-slate-500">
                  Selecione o switch, AP, servidor ou equipamento envolvido neste projeto.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsLinkAssetModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por patrimônio, nome, modelo ou IP..."
                  value={assetSearchQuery}
                  onChange={(e) => setAssetSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {loadingAssets ? (
                <div className="p-8 text-center text-slate-400 text-xs">Carregando catálogo de ativos...</div>
              ) : availableAssetsToLink.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Nenhum equipamento disponível encontrado.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {availableAssetsToLink.slice(0, 30).map((asset) => (
                    <div
                      key={asset.id}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800">
                            {asset.type}
                          </span>
                          <h5 className="font-bold text-xs text-slate-900">{asset.name}</h5>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Patrimônio: {asset.asset_tag || "S/N"} • IP: {asset.ip_address || "DHCP"} • {asset.brand} {asset.model}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleLinkAsset(asset.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer shrink-0"
                      >
                        Vincular
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL ASSOCIAR TÉCNICO À EQUIPE ─── */}
      {isAddMemberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Users className="text-indigo-600" size={20} />
                  Associar Técnico à Equipe
                </h3>
                <p className="text-xs text-slate-500">
                  Adicione colaboradores de TI para atuarem neste projeto.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddMemberModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Selecione o Técnico *</label>
                <select
                  value={selectedUserIdToAdd}
                  onChange={(e) => setSelectedUserIdToAdd(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Selecione um usuário...</option>
                  {availableUsersForTeam.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.display_name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddMemberModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!selectedUserIdToAdd}
                  onClick={() => handleAddMember(selectedUserIdToAdd)}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL VINCULAR CHAMADO EXISTENTE ─── */}
      {isLinkTicketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Vincular Chamado</h3>
                <p className="text-xs text-slate-500">
                  Informe o número do chamado (ID) para associá-lo a este projeto.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsLinkTicketModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleLinkTicket} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ID do Chamado *</label>
                <input
                  type="number"
                  required
                  placeholder="Ex: 142"
                  value={ticketIdToLink}
                  onChange={(e) => setTicketIdToLink(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLinkTicketModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={linkingTicket}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {linkingTicket ? "Vinculando..." : "Vincular"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
