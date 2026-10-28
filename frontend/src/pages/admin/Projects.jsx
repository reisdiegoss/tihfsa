import { useState, useEffect, useMemo } from "react";
import {
  FolderKanban,
  LayoutGrid,
  Table as TableIcon,
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
  ExternalLink,
  DollarSign,
  UserCheck,
  Zap,
  Check,
  Layers,
  Cpu,
  Wifi,
  ShieldCheck,
  ArrowRight,
  Copy,
  SlidersHorizontal,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../api/client";
import { projectsApi } from "../../api/projects";

// As 4 Colunas Principais do Kanban de Projetos de TI
const KANBAN_STAGES = [
  {
    id: "Planejamento",
    title: "Planejamento",
    subtitle: "Backlog & Levantamento",
    color: "border-slate-700 bg-slate-900/60",
    headerBg: "bg-slate-800/80 text-slate-200 border-slate-700",
    dot: "bg-slate-400",
    badge: "bg-slate-700 text-slate-200",
  },
  {
    id: "Em Andamento",
    title: "Em Andamento",
    subtitle: "Execução & Implantação",
    color: "border-blue-900/50 bg-blue-950/20",
    headerBg: "bg-blue-900/40 text-blue-200 border-blue-700/60",
    dot: "bg-blue-500",
    badge: "bg-blue-800 text-blue-200",
  },
  {
    id: "Pausado",
    title: "Pausado / Bloqueado",
    subtitle: "Aguardando Terceiros/Peças",
    color: "border-amber-900/50 bg-amber-950/20",
    headerBg: "bg-amber-900/40 text-amber-200 border-amber-700/60",
    dot: "bg-amber-500",
    badge: "bg-amber-800 text-amber-200",
  },
  {
    id: "Concluído",
    title: "Concluído",
    subtitle: "Entregue & Homologado",
    color: "border-emerald-900/50 bg-emerald-950/20",
    headerBg: "bg-emerald-900/40 text-emerald-200 border-emerald-700/60",
    dot: "bg-emerald-500",
    badge: "bg-emerald-800 text-emerald-200",
  },
];

const CATEGORY_STYLES = {
  "Infraestrutura": { banner: "from-emerald-600 to-teal-700", text: "text-emerald-400", border: "border-emerald-500/30", chip: "bg-emerald-950/70 text-emerald-300 border-emerald-800" },
  "Redes & Wi-Fi": { banner: "from-blue-600 to-cyan-700", text: "text-blue-400", border: "border-blue-500/30", chip: "bg-blue-950/70 text-blue-300 border-blue-800" },
  "Sistemas & ERP": { banner: "from-purple-600 to-indigo-700", text: "text-purple-400", border: "border-purple-500/30", chip: "bg-purple-950/70 text-purple-300 border-purple-800" },
  "Hotelaria & UHs": { banner: "from-amber-600 to-orange-700", text: "text-amber-400", border: "border-amber-500/30", chip: "bg-amber-950/70 text-amber-300 border-amber-800" },
  "Segurança & CFTV": { banner: "from-rose-600 to-red-700", text: "text-rose-400", border: "border-rose-500/30", chip: "bg-rose-950/70 text-rose-300 border-rose-800" },
  "Telecom & VoIP": { banner: "from-indigo-600 to-blue-800", text: "text-indigo-400", border: "border-indigo-500/30", chip: "bg-indigo-950/70 text-indigo-300 border-indigo-800" },
  "Hardware & Servidores": { banner: "from-cyan-700 to-slate-800", text: "text-cyan-400", border: "border-cyan-500/30", chip: "bg-cyan-950/70 text-cyan-300 border-cyan-800" },
  "Outros": { banner: "from-slate-700 to-slate-900", text: "text-slate-400", border: "border-slate-700", chip: "bg-slate-800 text-slate-300 border-slate-700" },
};

const PRIORITY_BADGES = {
  "Crítica": "bg-rose-600 text-white",
  "Alta": "bg-orange-500 text-white",
  "Média": "bg-blue-600 text-white",
  "Baixa": "bg-emerald-600 text-white",
};

// Modelos de Projetos para Inicialização em 1 Clique
const IT_TEMPLATES = [
  {
    id: "wifi-upgrade",
    title: "Upgrade Wi-Fi Ruckus & Cisco",
    category: "Redes & Wi-Fi",
    description: "Mapeamento de RF, substituição de APs nos blocos de apartamentos e testes de roaming.",
    icon: Wifi,
    color: "from-blue-600 to-cyan-600",
    tasks: [
      "Site Survey e Mapeamento de Cobertura RF",
      "Passagem de Cabeamento Cat6 blindado",
      "Instalação e Patching dos Switches PoE+",
      "Montagem física dos APs nos tetos",
      "Testes de Roaming e Homologação do Portal Captivo",
    ],
  },
  {
    id: "cftv-seguranca",
    title: "Expansão de CFTV & NVRs IP",
    category: "Segurança & CFTV",
    description: "Instalação de câmeras em áreas críticas, lançamento de fibra para guarita e gravação RAID.",
    icon: ShieldCheck,
    color: "from-rose-600 to-red-600",
    tasks: [
      "Mapeamento dos Pontos Cegos com Segurança Patrimonial",
      "Lançamento de Fibra e Tubulação para Guarita",
      "Instalação das Câmeras Varifocais e Domo",
      "Configuração do Storage RAID e Retenção de 30 dias",
      "Comissionamento no NVR e Video Wall",
    ],
  },
  {
    id: "servers-ha",
    title: "Servidores & Virtualização (Datacenter)",
    category: "Hardware & Servidores",
    description: "Configuração de hosts Hyper-V/Proxmox, replicação de VMs e rotinas de backup imutável.",
    icon: Cpu,
    color: "from-cyan-700 to-slate-800",
    tasks: [
      "Inventário de Consumo das VMs Legadas",
      "Instalação do SO Hypervisor e Configuração da iDRAC",
      "Migração a Quente da VM do Banco de Dados",
      "Configuração dos Jobs de Backup Veeam Noturnos",
      "Simulação de Disaster Recovery e Restore em Sandbox",
    ],
  },
  {
    id: "hotelaria-uhs",
    title: "Manutenção Preventiva de UHs (Hotelaria)",
    category: "Hotelaria & UHs",
    description: "Revisão periódica nos quartos: IPTV, telefonia IP, fechadura RFID e sinal Wi-Fi.",
    icon: Layers,
    color: "from-amber-600 to-orange-700",
    tasks: [
      "Auditoria de Sinal Wi-Fi dentro do Quarto e Varanda",
      "Teste de Chamada e Viva-voz no Ramal Telefônico",
      "Validação do Sistema de IPTV e Canal de Boas-vindas",
      "Checagem de Tensão da Bateria da Fechadura RFID",
    ],
  },
];

export default function Projects() {
  const { user, isAdmin, isTechnician } = useAuth();

  // Dados do Portfólio
  const [projects, setProjects] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [allAssetsList, setAllAssetsList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modo de visualização principal: 'kanban' (padrão) | 'table' | 'templates'
  const [viewMode, setViewMode] = useState("kanban");

  // Filtros Globais do Kanban
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("ALL");
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState("ALL");

  // Criação Rápida Inline no Rodapé da Coluna do Kanban
  const [inlineColumn, setInlineColumn] = useState(null);
  const [inlineTitle, setInlineTitle] = useState("");
  const [creatingInline, setCreatingInline] = useState(false);

  // Modal Detalhe do Cartão do Projeto (Estilo Trello Modal)
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Estados internos do Modal do Projeto
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssignedId, setNewTaskAssignedId] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [projectCommentText, setProjectCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  // Modais Auxiliares
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectForm, setNewProjectForm] = useState({
    title: "",
    category: "Infraestrutura",
    status: "Planejamento",
    priority: "Média",
    due_date: "",
    budget: "",
    description: "",
  });
  const [creatingProject, setCreatingProject] = useState(false);

  // Vínculos CMDB e Chamados no Modal
  const [assetSearchQuery, setAssetSearchQuery] = useState("");
  const [ticketInputId, setTicketInputId] = useState("");
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState("");
  const [isButlerModalOpen, setIsButlerModalOpen] = useState(false);

  // Carregar Projetos
  const loadProjectsList = async () => {
    try {
      setLoading(true);
      const [prjRes, usrRes, astRes] = await Promise.all([
        projectsApi.getProjects(),
        api.get("/users?limit=100").catch(() => ({ data: [] })),
        api.get("/assets?limit=300").catch(() => ({ data: [] })),
      ]);
      setProjects(prjRes || []);
      setUsersList(usrRes.data?.items || usrRes.data || []);
      setAllAssetsList(astRes.data?.items || astRes.data || []);
    } catch (err) {
      console.error("Erro ao carregar portfólio de projetos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjectsList();
  }, []);

  // Carregar Detalhes do Projeto Aberto no Modal
  const loadProjectDetail = async (projectId) => {
    if (!projectId) return;
    try {
      setLoadingDetail(true);
      const detail = await projectsApi.getProject(projectId);
      setSelectedProject(detail);
    } catch (err) {
      console.error("Erro ao carregar detalhe do projeto:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      loadProjectDetail(selectedProjectId);
    } else {
      setSelectedProject(null);
    }
  }, [selectedProjectId]);

  // Filtragem dos Projetos no Kanban
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchSearch =
        !searchQuery ||
        p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = selectedCategoryFilter === "ALL" || p.category === selectedCategoryFilter;
      const matchPrio = selectedPriorityFilter === "ALL" || p.priority === selectedPriorityFilter;
      return matchSearch && matchCat && matchPrio;
    });
  }, [projects, searchQuery, selectedCategoryFilter, selectedPriorityFilter]);

  // Drag and Drop de Projetos entre as Etapas do Kanban
  const handleDragStart = (e, project) => {
    e.dataTransfer.setData("application/json", JSON.stringify(project));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropOnColumn = async (e, targetStatus) => {
    e.preventDefault();
    const rawData = e.dataTransfer.getData("application/json");
    if (!rawData) return;
    const project = JSON.parse(rawData);
    if (project.status === targetStatus) return;

    // Atualização otimista imediata no Kanban
    setProjects((prev) =>
      prev.map((p) => (p.id === project.id ? { ...p, status: targetStatus } : p))
    );

    try {
      await projectsApi.updateProject(project.id, { status: targetStatus });
      loadProjectsList();
    } catch (err) {
      console.error("Erro ao mover projeto no kanban:", err);
      loadProjectsList();
    }
  };

  // Criação Rápida Inline no Rodapé da Coluna
  const handleCreateInlineProject = async (status) => {
    if (!inlineTitle.trim()) return;
    try {
      setCreatingInline(true);
      await projectsApi.createProject({
        title: inlineTitle.trim(),
        status: status,
        category: "Infraestrutura",
        priority: "Média",
        manager_id: user?.id,
      });
      setInlineTitle("");
      setInlineColumn(null);
      loadProjectsList();
    } catch (err) {
      console.error("Erro ao criar projeto inline:", err);
      alert("Erro ao adicionar projeto.");
    } finally {
      setCreatingInline(false);
    }
  };

  // Criação Completa via Modal
  const handleCreateFullProject = async (e) => {
    e.preventDefault();
    if (!newProjectForm.title.trim()) return;
    try {
      setCreatingProject(true);
      const created = await projectsApi.createProject({
        title: newProjectForm.title.trim(),
        category: newProjectForm.category,
        status: newProjectForm.status,
        priority: newProjectForm.priority,
        due_date: newProjectForm.due_date || null,
        budget: newProjectForm.budget ? parseFloat(newProjectForm.budget) : 0,
        description: newProjectForm.description || null,
        manager_id: user?.id,
      });

      // Criação de tarefa inicial padrão
      await projectsApi.createTask(created.id, {
        title: "Levantamento de escopo e alinhamento inicial",
        status: "A Fazer",
        priority: "Média",
      });

      setIsNewProjectModalOpen(false);
      setNewProjectForm({
        title: "",
        category: "Infraestrutura",
        status: "Planejamento",
        priority: "Média",
        due_date: "",
        budget: "",
        description: "",
      });
      await loadProjectsList();
      setSelectedProjectId(created.id);
    } catch (err) {
      console.error("Erro ao criar projeto:", err);
      alert("Erro ao criar projeto. Verifique os dados.");
    } finally {
      setCreatingProject(false);
    }
  };

  // Instanciar Modelo de Projeto em 1 Clique
  const handleUseTemplate = async (tpl) => {
    try {
      setLoading(true);
      const created = await projectsApi.createProject({
        title: `${tpl.title} — ${new Date().toLocaleDateString("pt-BR")}`,
        category: tpl.category,
        status: "Planejamento",
        priority: "Alta",
        description: tpl.description,
        manager_id: user?.id,
      });

      for (const taskTitle of tpl.tasks) {
        await projectsApi.createTask(created.id, {
          title: taskTitle,
          status: "A Fazer",
          priority: "Média",
        });
      }

      await loadProjectsList();
      setViewMode("kanban");
      setSelectedProjectId(created.id);
    } catch (err) {
      console.error("Erro ao instanciar modelo:", err);
      alert("Erro ao criar projeto a partir do modelo.");
    } finally {
      setLoading(false);
    }
  };

  // Atualizar Status do Projeto dentro do Modal
  const handleUpdateProjectStatus = async (newStatus) => {
    if (!selectedProject || selectedProject.status === newStatus) return;
    try {
      await projectsApi.updateProject(selectedProject.id, { status: newStatus });
      setSelectedProject((prev) => ({ ...prev, status: newStatus }));
      loadProjectsList();
    } catch (err) {
      console.error("Erro ao atualizar status:", err);
    }
  };

  // Alternar Tarefa Concluída / Pendente dentro do Modal (Checklist do Projeto)
  const handleToggleTask = async (task) => {
    if (!selectedProject) return;
    const newStatus = task.status === "Concluído" ? "A Fazer" : "Concluído";

    // Otimista
    setSelectedProject((prev) => {
      if (!prev) return prev;
      const updatedTasks = prev.tasks.map((t) =>
        t.id === task.id ? { ...t, status: newStatus, completed_at: newStatus === "Concluído" ? new Date().toISOString() : null } : t
      );
      const total = updatedTasks.length;
      const completed = updatedTasks.filter((t) => t.status === "Concluído").length;
      const newProgress = total > 0 ? Math.round((completed / total) * 100) : 0;
      return { ...prev, tasks: updatedTasks, progress: newProgress };
    });

    try {
      await projectsApi.updateTask(selectedProject.id, task.id, { status: newStatus });
      loadProjectDetail(selectedProject.id);
      loadProjectsList();
    } catch (err) {
      console.error("Erro ao alternar status da tarefa:", err);
      loadProjectDetail(selectedProject.id);
    }
  };

  // Adicionar Tarefa ao Projeto (Item do Checklist)
  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !selectedProject) return;
    try {
      setAddingTask(true);
      await projectsApi.createTask(selectedProject.id, {
        title: newTaskTitle.trim(),
        status: "A Fazer",
        priority: "Média",
        assigned_to_id: newTaskAssignedId ? parseInt(newTaskAssignedId) : null,
      });
      setNewTaskTitle("");
      setNewTaskAssignedId("");
      loadProjectDetail(selectedProject.id);
      loadProjectsList();
    } catch (err) {
      console.error("Erro ao adicionar tarefa:", err);
    } finally {
      setAddingTask(false);
    }
  };

  // Excluir Tarefa do Projeto
  const handleDeleteTask = async (taskId) => {
    if (!selectedProject) return;
    try {
      await projectsApi.deleteTask(selectedProject.id, taskId);
      loadProjectDetail(selectedProject.id);
      loadProjectsList();
    } catch (err) {
      console.error("Erro ao excluir tarefa:", err);
    }
  };

  // Bloquear / Desbloquear Tarefa
  const handleToggleBlockTask = async (task) => {
    if (!selectedProject) return;
    const newBlocked = !task.is_blocked;
    let reason = null;
    if (newBlocked) {
      reason = prompt("Motivo do bloqueio / impedimento:", task.blocked_reason || "") || "Aguardando peças ou terceiros";
    }
    try {
      await projectsApi.updateTask(selectedProject.id, task.id, {
        is_blocked: newBlocked,
        blocked_reason: reason,
      });
      loadProjectDetail(selectedProject.id);
    } catch (err) {
      console.error("Erro ao alternar bloqueio da tarefa:", err);
    }
  };

  // Vincular/Desvincular Ativo CMDB ao Projeto
  const handleLinkAsset = async (assetId) => {
    if (!selectedProject) return;
    try {
      await projectsApi.linkAsset(selectedProject.id, assetId);
      loadProjectDetail(selectedProject.id);
      loadProjectsList();
    } catch (err) {
      console.error("Erro ao vincular ativo:", err);
    }
  };

  const handleUnlinkAsset = async (assetId) => {
    if (!selectedProject) return;
    try {
      await projectsApi.unlinkAsset(selectedProject.id, assetId);
      loadProjectDetail(selectedProject.id);
      loadProjectsList();
    } catch (err) {
      console.error("Erro ao desvincular ativo:", err);
    }
  };

  // Vincular/Desvincular Chamado Helpdesk ao Projeto
  const handleLinkTicket = async () => {
    if (!ticketInputId.trim() || !selectedProject) return;
    try {
      await projectsApi.linkTicket(selectedProject.id, parseInt(ticketInputId.trim()));
      setTicketInputId("");
      loadProjectDetail(selectedProject.id);
      loadProjectsList();
    } catch (err) {
      console.error("Erro ao vincular chamado:", err);
      alert("Chamado não encontrado ou já vinculado.");
    }
  };

  const handleUnlinkTicket = async (ticketId) => {
    if (!selectedProject) return;
    try {
      await projectsApi.unlinkTicket(selectedProject.id, ticketId);
      loadProjectDetail(selectedProject.id);
      loadProjectsList();
    } catch (err) {
      console.error("Erro ao desvincular chamado:", err);
    }
  };

  // Adicionar/Remover Membro da Equipe
  const handleAddMember = async () => {
    if (!selectedMemberToAdd || !selectedProject) return;
    try {
      await projectsApi.addMember(selectedProject.id, parseInt(selectedMemberToAdd));
      setSelectedMemberToAdd("");
      loadProjectDetail(selectedProject.id);
      loadProjectsList();
    } catch (err) {
      console.error("Erro ao adicionar membro:", err);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!selectedProject) return;
    try {
      await projectsApi.removeMember(selectedProject.id, userId);
      loadProjectDetail(selectedProject.id);
      loadProjectsList();
    } catch (err) {
      console.error("Erro ao remover membro:", err);
    }
  };

  // Postar Comentário na Linha do Tempo
  const handlePostComment = async () => {
    if (!projectCommentText.trim() || !selectedProject) return;
    try {
      setSendingComment(true);
      await projectsApi.addTimelineComment(selectedProject.id, projectCommentText.trim(), "comment");
      setProjectCommentText("");
      loadProjectDetail(selectedProject.id);
    } catch (err) {
      console.error("Erro ao postar comentário:", err);
    } finally {
      setSendingComment(false);
    }
  };

  // Excluir Projeto
  const handleDeleteProject = async () => {
    if (!selectedProject) return;
    if (!confirm(`Atenção: Deseja realmente excluir permanentemente o projeto "${selectedProject.title}"?`)) return;
    try {
      await projectsApi.deleteProject(selectedProject.id);
      setSelectedProjectId(null);
      loadProjectsList();
    } catch (err) {
      console.error("Erro ao excluir projeto:", err);
    }
  };

  // Ativos do CMDB disponíveis para vincular
  const availableAssetsToLink = useMemo(() => {
    const linkedIds = new Set((selectedProject?.assets || []).map((a) => a.id));
    return allAssetsList.filter((a) => {
      if (linkedIds.has(a.id)) return false;
      if (!assetSearchQuery) return true;
      const q = assetSearchQuery.toLowerCase();
      return (
        a.name?.toLowerCase().includes(q) ||
        a.asset_tag?.toLowerCase().includes(q) ||
        a.model?.toLowerCase().includes(q) ||
        a.brand?.toLowerCase().includes(q)
      );
    });
  }, [allAssetsList, selectedProject, assetSearchQuery]);

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-slate-100 font-sans">
      {/* ========================================================================= */}
      {/* BARRA SUPERIOR DO PORTFÓLIO DE PROJETOS                                  */}
      {/* ========================================================================= */}
      <header className="bg-slate-950/80 backdrop-blur border-b border-slate-800 px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20 text-white">
            <FolderKanban className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wider uppercase text-blue-400">Quadro de Projetos TI</span>
              <span className="text-[11px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">Hotel Fasano Salvador</span>
            </div>
            <h1 className="text-base font-bold text-white tracking-tight">
              Acompanhamento de Entregas & Infraestrutura
            </h1>
          </div>
        </div>

        {/* Controles de Visualização e Criação */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Alternador de Modos */}
          <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700">
            <button
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                viewMode === "kanban" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Quadro Kanban
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                viewMode === "table" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              Lista / Tabela
            </button>
            <button
              onClick={() => setViewMode("templates")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                viewMode === "templates" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Modelos de TI
            </button>
          </div>

          {/* Botão Butler Automação */}
          <button
            onClick={() => setIsButlerModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600/20 to-orange-600/20 hover:from-amber-600/30 hover:to-orange-600/30 text-amber-300 text-xs font-semibold border border-amber-500/40 transition"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Butler Automação</span>
          </button>

          {/* Botão Criar Novo Projeto */}
          <button
            onClick={() => setIsNewProjectModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Novo Projeto
          </button>

          <button
            onClick={loadProjectsList}
            title="Atualizar dados"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-400" : ""}`} />
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* BARRA DE FILTROS DO KANBAN                                               */}
      {/* ========================================================================= */}
      <div className="bg-slate-950/40 border-b border-slate-800/80 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Busca por Texto */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar por projeto, código ou escopo..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filtros de Categoria e Prioridade */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Categorias */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            <span className="text-[11px] text-slate-400 font-medium">Categoria:</span>
            {["ALL", "Infraestrutura", "Redes & Wi-Fi", "Sistemas & ERP", "Segurança & CFTV", "Hardware & Servidores"].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategoryFilter(cat)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition whitespace-nowrap ${
                  selectedCategoryFilter === cat
                    ? "bg-blue-600/30 border-blue-500 text-blue-300 font-semibold"
                    : "bg-slate-900 border-slate-700/60 text-slate-400 hover:text-white"
                }`}
              >
                {cat === "ALL" ? "Todas" : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISÃO 1: O KANBAN DE PROJETOS (O PROJETO ESTÁ DENTRO DO KANBAN!)         */}
      {/* ========================================================================= */}
      {viewMode === "kanban" && (
        <main className="flex-1 overflow-x-auto overflow-y-hidden p-5 flex gap-5 items-start">
          {KANBAN_STAGES.map((stage) => {
            const stageProjects = filteredProjects.filter((p) => p.status === stage.id);

            return (
              <div
                key={stage.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnColumn(e, stage.id)}
                className={`w-84 flex-shrink-0 border rounded-2xl flex flex-col max-h-[calc(100vh-140px)] shadow-xl ${stage.color}`}
              >
                {/* Cabeçalho da Etapa do Kanban */}
                <div className={`px-4 py-3 border-b rounded-t-2xl flex items-center justify-between ${stage.headerBg}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${stage.dot}`} />
                    <div>
                      <h3 className="text-xs font-bold tracking-wide uppercase">
                        {stage.title}
                      </h3>
                      <p className="text-[10px] text-slate-400 leading-none">{stage.subtitle}</p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stage.badge}`}>
                    {stageProjects.length}
                  </span>
                </div>

                {/* Lista de Projetos (Cartões) Nesta Coluna */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[120px]">
                  {stageProjects.map((project) => {
                    const style = CATEGORY_STYLES[project.category] || CATEGORY_STYLES["Outros"];
                    const priorityChip = PRIORITY_BADGES[project.priority] || "bg-slate-600 text-white";
                    const progressPct = project.progress || 0;
                    const tasksTotal = project.tasks_count || 0;
                    const tasksDone = project.tasks_completed_count || 0;

                    return (
                      <div
                        key={project.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, project)}
                        onClick={() => setSelectedProjectId(project.id)}
                        className="group cursor-pointer bg-slate-850 hover:bg-slate-800 border border-slate-700/80 hover:border-blue-500/70 rounded-xl p-3.5 shadow-md hover:shadow-2xl transition duration-150 transform hover:-translate-y-0.5 flex flex-col justify-between space-y-3 select-none"
                      >
                        {/* Topo do Cartão: Categoria, Código e Prioridade */}
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${style.chip}`}>
                            {project.category}
                          </span>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded">
                              {project.code}
                            </span>
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${priorityChip}`}>
                              {project.priority}
                            </span>
                          </div>
                        </div>

                        {/* Título e Descrição */}
                        <div>
                          <h4 className="text-sm font-bold text-white group-hover:text-blue-300 transition line-clamp-2 leading-snug">
                            {project.title}
                          </h4>
                          {project.description && (
                            <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                              {project.description}
                            </p>
                          )}
                        </div>

                        {/* Barra de Progresso do Projeto (% Tarefas Concluídas) */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                            <span>Entregas ({tasksDone}/{tasksTotal})</span>
                            <span className="text-emerald-400 font-bold">{progressPct}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>

                        {/* Rodapé: Badges de CMDB, Chamados e Membros */}
                        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                          <div className="flex items-center gap-2">
                            {/* Tarefas */}
                            <span className="flex items-center gap-1 text-[10px] text-slate-300" title="Tarefas no checklist">
                              <CheckSquare className="w-3 h-3 text-blue-400" />
                              {tasksDone}/{tasksTotal}
                            </span>

                            {/* Ativos CMDB */}
                            {project.assets_count > 0 && (
                              <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded" title="Equipamentos vinculados">
                                <Server className="w-3 h-3" />
                                {project.assets_count}
                              </span>
                            )}

                            {/* Chamados */}
                            {project.tickets_count > 0 && (
                              <span className="flex items-center gap-1 text-[10px] text-rose-400 bg-rose-950/60 border border-rose-800/60 px-1.5 py-0.5 rounded" title="Chamados vinculados">
                                <Ticket className="w-3 h-3" />
                                {project.tickets_count}
                              </span>
                            )}
                          </div>

                          {/* Avatares da Equipe */}
                          <div className="flex -space-x-1.5 overflow-hidden">
                            {(project.members || []).slice(0, 3).map((m, idx) => (
                              <div
                                key={idx}
                                title={m.display_name}
                                className="w-5 h-5 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-[9px] flex items-center justify-center border border-slate-900"
                              >
                                {m.display_name.charAt(0)}
                              </div>
                            ))}
                            {(project.members || []).length === 0 && (
                              <span className="text-[10px] text-slate-500 italic">Sem equipe</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Inline Composer (Se ativo nesta coluna) */}
                  {inlineColumn === stage.id && (
                    <div className="bg-slate-850 border border-blue-500 rounded-xl p-3 space-y-2 shadow-lg animate-in fade-in duration-150">
                      <input
                        autoFocus
                        type="text"
                        value={inlineTitle}
                        onChange={(e) => setInlineTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleCreateInlineProject(stage.id);
                          }
                        }}
                        placeholder="Nome do projeto..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => handleCreateInlineProject(stage.id)}
                          disabled={creatingInline || !inlineTitle.trim()}
                          className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow transition"
                        >
                          {creatingInline ? "Criando..." : "Adicionar Projeto"}
                        </button>
                        <button
                          onClick={() => {
                            setInlineColumn(null);
                            setInlineTitle("");
                          }}
                          className="p-1 text-slate-400 hover:text-white transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Rodapé da Coluna: Botão "+ Adicionar Projeto" */}
                {inlineColumn !== stage.id && (
                  <div className="p-2.5 border-t border-slate-800/80">
                    <button
                      onClick={() => {
                        setInlineColumn(stage.id);
                        setInlineTitle("");
                      }}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 text-xs font-semibold transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar um projeto
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </main>
      )}

      {/* ========================================================================= */}
      {/* VISÃO 2: TABELA ANALÍTICA DE PROJETOS                                    */}
      {/* ========================================================================= */}
      {viewMode === "table" && (
        <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
          <div className="bg-slate-850 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Código / Projeto</th>
                  <th className="p-3.5">Categoria</th>
                  <th className="p-3.5">Etapa (Kanban)</th>
                  <th className="p-3.5">Prioridade</th>
                  <th className="p-3.5">Progresso</th>
                  <th className="p-3.5">Equipe</th>
                  <th className="p-3.5">Ativos CMDB</th>
                  <th className="p-3.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredProjects.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedProjectId(p.id)}
                    className="hover:bg-slate-800/60 cursor-pointer transition"
                  >
                    <td className="p-3.5">
                      <span className="font-mono text-slate-400 font-bold mr-2">{p.code}</span>
                      <strong className="text-white">{p.title}</strong>
                    </td>
                    <td className="p-3.5">{p.category}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700 font-medium">
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${PRIORITY_BADGES[p.priority] || "bg-slate-700"}`}>
                        {p.priority}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${p.progress || 0}%` }} />
                        </div>
                        <span className="font-bold text-emerald-400">{p.progress || 0}%</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="text-slate-400">{(p.members || []).length} técnicos</span>
                    </td>
                    <td className="p-3.5">
                      <span className="text-amber-400 font-semibold">{p.assets_count || 0}</span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button className="text-blue-400 hover:text-blue-300 font-semibold text-xs">
                        Abrir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* VISÃO 3: MODELOS PRONTOS DE PROJETOS DE TI (TEMPLATES)                   */}
      {/* ========================================================================= */}
      {viewMode === "templates" && (
        <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
          <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-purple-900/40 border border-blue-500/30 rounded-2xl p-6 text-white">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold tracking-wider uppercase mb-1">
              <Sparkles className="w-4 h-4" /> Modelos de Gestão de Projetos de TI
            </div>
            <h2 className="text-xl font-bold">Crie Projetos com Checklists Testados em 1 Clique</h2>
            <p className="text-xs text-slate-300 max-w-2xl mt-1">
              Selecione um fluxo estruturado abaixo para criar o projeto diretamente no seu Kanban já com as etapas,
              equipamentos e tarefas práticas cadastradas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {IT_TEMPLATES.map((tpl) => {
              const Icon = tpl.icon;
              return (
                <div
                  key={tpl.id}
                  className="bg-slate-850 border border-slate-800 rounded-xl p-5 hover:border-blue-500/50 transition duration-200 flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className={`p-2.5 rounded-lg bg-gradient-to-tr ${tpl.color} text-white shadow-md`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-semibold text-blue-400 bg-blue-950/70 border border-blue-800/60 px-2.5 py-0.5 rounded-full">
                        {tpl.category}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white">{tpl.title}</h3>
                    <p className="text-xs text-slate-400 mt-1">{tpl.description}</p>
                  </div>

                  <div className="space-y-1.5 bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                      Checklist incluído ({tpl.tasks.length} atividades):
                    </span>
                    <div className="space-y-1">
                      {tpl.tasks.map((task, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                          <CheckSquare className="w-3 h-3 text-blue-400" />
                          <span className="truncate">{task}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => handleUseTemplate(tpl)}
                    className="w-full py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition active:scale-98"
                  >
                    <Copy className="w-4 h-4" />
                    Instanciar este Projeto no Kanban
                  </button>
                </div>
              );
            })}
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* MODAL DETALHE DO CARTÃO DO PROJETO (ESTILO TRELLO CARD MODAL)            */}
      {/* ========================================================================= */}
      {selectedProjectId && selectedProject && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col my-auto">
            {/* Cabeçalho do Projeto */}
            <div className="p-6 border-b border-slate-800 flex items-start justify-between gap-4 sticky top-0 bg-slate-900 z-10">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded">
                    {selectedProject.code}
                  </span>
                  <span className="text-xs text-slate-400">
                    Na etapa <strong className="text-white underline">{selectedProject.status}</strong> do Kanban
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight leading-snug">
                  {selectedProject.title}
                </h2>
              </div>

              <button
                onClick={() => setSelectedProjectId(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Grid Principal: Lado Esquerdo (Tarefas, Checklists, CMDB) + Lado Direito (Equipe, Status) */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Lado Esquerdo: Tarefas/Checklists, Power-Ups e Histórico */}
              <div className="lg:col-span-2 space-y-6">
                {/* Metadados Rápidos: Etapa, Categoria e Prioridade */}
                <div className="flex flex-wrap gap-4 items-center bg-slate-850 p-4 rounded-xl border border-slate-800">
                  {/* Mover de Etapa no Kanban */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Etapa no Kanban
                    </span>
                    <select
                      value={selectedProject.status}
                      onChange={(e) => handleUpdateProjectStatus(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500 font-semibold"
                    >
                      {KANBAN_STAGES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Categoria
                    </span>
                    <span className="text-xs font-semibold text-slate-200 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700">
                      {selectedProject.category}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Prioridade
                    </span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg ${PRIORITY_BADGES[selectedProject.priority] || "bg-slate-700"}`}>
                      {selectedProject.priority}
                    </span>
                  </div>
                </div>

                {/* Descrição do Projeto */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-blue-400" />
                    Escopo & Objetivo do Projeto
                  </h4>
                  <div className="bg-slate-850 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300 whitespace-pre-wrap">
                    {selectedProject.description || "Nenhuma descrição detalhada informada para este projeto."}
                  </div>
                </div>

                {/* ======================================================= */}
                {/* CHECKLIST DE TAREFAS / ETAPAS PRÁTICAS DO PROJETO       */}
                {/* ======================================================= */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                      Checklist de Tarefas Internas ({(selectedProject.tasks || []).length})
                    </h4>
                    <span className="text-xs font-bold text-emerald-400">
                      {selectedProject.progress || 0}% Concluído
                    </span>
                  </div>

                  {/* Barra de Progresso Verde Trello */}
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${selectedProject.progress || 0}%` }}
                    />
                  </div>

                  {/* Lista de Atividades do Checklist */}
                  <div className="space-y-2">
                    {(selectedProject.tasks || []).map((task) => {
                      const isDone = task.status === "Concluído";

                      return (
                        <div
                          key={task.id}
                          className={`group flex items-center justify-between gap-3 p-3 rounded-xl border transition ${
                            task.is_blocked
                              ? "bg-rose-950/20 border-rose-500/70"
                              : isDone
                              ? "bg-emerald-950/10 border-emerald-500/40"
                              : "bg-slate-850 border-slate-800/80 hover:border-slate-700"
                          }`}
                        >
                          <div
                            onClick={() => handleToggleTask(task)}
                            className="flex items-center gap-3 cursor-pointer flex-1"
                          >
                            {isDone ? (
                              <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-500 group-hover:text-slate-400 flex-shrink-0" />
                            )}
                            <div>
                              <span className={`text-xs ${isDone ? "line-through text-slate-500 font-medium" : "text-slate-200 font-medium"}`}>
                                {task.title}
                              </span>
                              {task.is_blocked && (
                                <div className="text-[10px] text-rose-400 font-semibold flex items-center gap-1 mt-0.5">
                                  <Ban className="w-3 h-3" /> Bloqueio: {task.blocked_reason || "Sem motivo informado"}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Responsável da Tarefa e Ações */}
                          <div className="flex items-center gap-2">
                            {task.assigned_to && (
                              <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                {task.assigned_to.display_name}
                              </span>
                            )}

                            {/* Botão Bloquear */}
                            <button
                              onClick={() => handleToggleBlockTask(task)}
                              title={task.is_blocked ? "Desbloquear tarefa" : "Marcar impedimento / bloquear"}
                              className={`p-1 rounded transition ${task.is_blocked ? "text-rose-400 hover:bg-rose-900/40" : "text-slate-500 hover:text-rose-400"}`}
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>

                            {/* Botão Excluir */}
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              title="Excluir tarefa"
                              className="text-slate-500 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {(selectedProject.tasks || []).length === 0 && (
                      <div className="text-xs text-slate-500 text-center py-4 bg-slate-850/40 rounded-xl border border-dashed border-slate-800">
                        Nenhuma tarefa interna cadastrada ainda. Adicione abaixo para dividir o projeto em etapas.
                      </div>
                    )}
                  </div>

                  {/* Adicionar Nova Tarefa ao Checklist */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTask();
                        }
                      }}
                      placeholder="Adicionar nova tarefa interna ao projeto..."
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <select
                      value={newTaskAssignedId}
                      onChange={(e) => setNewTaskAssignedId(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Atribuir a...</option>
                      {usersList.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.display_name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddTask}
                      disabled={addingTask || !newTaskTitle.trim()}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow transition"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>

                {/* ======================================================= */}
                {/* POWER-UPS: ATIVOS CMDB & CHAMADOS VINCULADOS           */}
                {/* ======================================================= */}
                <div className="space-y-4 pt-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-amber-400" />
                    Conexões & Power-Ups (CMDB e Chamados)
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Ativos CMDB */}
                    <div className="bg-slate-850 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                        <span className="flex items-center gap-1.5">
                          <Server className="w-3.5 h-3.5 text-amber-400" />
                          Ativos CMDB ({(selectedProject.assets || []).length})
                        </span>
                      </div>

                      {/* Lista de Ativos Vinculados */}
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {(selectedProject.assets || []).map((ast) => (
                          <div
                            key={ast.id}
                            className="flex items-center justify-between bg-slate-900 p-2 rounded-lg border border-slate-800"
                          >
                            <div className="truncate mr-2">
                              <span className="text-xs font-bold text-white block truncate">{ast.name}</span>
                              <span className="text-[10px] text-slate-400">
                                Tag: <span className="font-mono text-amber-400">{ast.asset_tag || "S/T"}</span> • {ast.type}
                              </span>
                            </div>
                            <button
                              onClick={() => handleUnlinkAsset(ast.id)}
                              className="text-slate-500 hover:text-rose-400 p-1"
                              title="Desvincular"
                            >
                              <Unlink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        {(selectedProject.assets || []).length === 0 && (
                          <div className="text-[11px] text-slate-500 italic py-1">
                            Nenhum equipamento associado.
                          </div>
                        )}
                      </div>

                      {/* Vincular Novo Ativo */}
                      <select
                        onChange={(e) => {
                          if (e.target.value) handleLinkAsset(parseInt(e.target.value));
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                      >
                        <option value="">+ Vincular equipamento do CMDB...</option>
                        {availableAssetsToLink.map((a) => (
                          <option key={a.id} value={a.id}>
                            [{a.asset_tag || "S/T"}] {a.name} ({a.type})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Chamados Vinculados */}
                    <div className="bg-slate-850 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                        <span className="flex items-center gap-1.5">
                          <Ticket className="w-3.5 h-3.5 text-rose-400" />
                          Chamados ({(selectedProject.tickets || []).length})
                        </span>
                      </div>

                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {(selectedProject.tickets || []).map((tk) => (
                          <div
                            key={tk.id}
                            className="flex items-center justify-between bg-slate-900 p-2 rounded-lg border border-slate-800"
                          >
                            <div className="truncate mr-2">
                              <span className="text-xs font-bold text-white block truncate">
                                #{tk.id} — {tk.title}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {tk.status} • {tk.priority}
                              </span>
                            </div>
                            <button
                              onClick={() => handleUnlinkTicket(tk.id)}
                              className="text-slate-500 hover:text-rose-400 p-1"
                              title="Desvincular"
                            >
                              <Unlink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        {(selectedProject.tickets || []).length === 0 && (
                          <div className="text-[11px] text-slate-500 italic py-1">
                            Nenhum chamado de suporte associado.
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={ticketInputId}
                          onChange={(e) => setTicketInputId(e.target.value)}
                          placeholder="Número ID do chamado..."
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                        />
                        <button
                          onClick={handleLinkTicket}
                          disabled={!ticketInputId.trim()}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold"
                        >
                          Vincular
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Linha do Tempo e Comentários */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-400" />
                    Histórico & Comentários de Evolução
                  </h4>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={projectCommentText}
                      onChange={(e) => setProjectCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handlePostComment();
                        }
                      }}
                      placeholder="Registrar comentário ou atualização nesta etapa..."
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={handlePostComment}
                      disabled={sendingComment || !projectCommentText.trim()}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow transition flex items-center gap-1.5"
                    >
                      <Send className="w-3 h-3" />
                      Enviar
                    </button>
                  </div>

                  {/* Feed do Histórico */}
                  <div className="space-y-2 max-h-48 overflow-y-auto pt-1">
                    {(selectedProject.timeline || []).map((tl) => (
                      <div key={tl.id} className="p-2.5 bg-slate-850 rounded-xl border border-slate-800 space-y-0.5">
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="font-semibold text-white">{tl.author?.display_name || "Sistema"}</span>
                          <span>{new Date(tl.created_at).toLocaleString("pt-BR")}</span>
                        </div>
                        <p className="text-xs text-slate-200">{tl.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Lado Direito: Equipe, Prazos e Ações do Cartão */}
              <div className="space-y-5">
                {/* Gestão de Equipe do Projeto */}
                <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Equipe Técnica Participante
                  </span>

                  <div className="space-y-2">
                    {(selectedProject.members || []).map((m) => (
                      <div key={m.id} className="flex items-center justify-between text-xs text-slate-200 bg-slate-900 p-2 rounded-lg border border-slate-800">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center">
                            {m.display_name.charAt(0)}
                          </div>
                          <span className="font-medium">{m.display_name}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveMember(m.id)}
                          className="text-slate-500 hover:text-rose-400 p-1"
                          title="Remover da equipe"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}

                    {/* Adicionar Membro */}
                    <div className="flex gap-2 pt-1">
                      <select
                        value={selectedMemberToAdd}
                        onChange={(e) => setSelectedMemberToAdd(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="">+ Convidar técnico...</option>
                        {usersList.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.display_name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleAddMember}
                        disabled={!selectedMemberToAdd}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* Prazos & Orçamento */}
                <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Planejamento & Prazos
                  </span>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Data de Início:</span>
                    <span className="font-medium">{selectedProject.start_date || "Não definida"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Previsão de Entrega:</span>
                    <span className="font-medium text-amber-300">{selectedProject.due_date || "Não definida"}</span>
                  </div>
                  {selectedProject.budget > 0 && (
                    <div className="flex justify-between pt-1 border-t border-slate-800">
                      <span className="text-slate-400">Orçamento Previsto:</span>
                      <span className="font-bold text-emerald-400">
                        R$ {parseFloat(selectedProject.budget).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Ações Rápidas */}
                <div className="space-y-2">
                  <button
                    onClick={() => handleUpdateProjectStatus("Concluído")}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 text-xs font-semibold transition"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Marcar Projeto como Concluído
                  </button>

                  {isAdmin && (
                    <button
                      onClick={handleDeleteProject}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-rose-600/10 hover:bg-rose-600/25 border border-rose-500/40 text-rose-300 text-xs font-semibold transition"
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir Projeto
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NOVO PROJETO (Criação Completa)                                   */}
      {/* ========================================================================= */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400">
                  <FolderKanban className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Cadastrar Novo Projeto</h3>
                  <p className="text-xs text-slate-400">Ele será inserido como um cartão no Kanban</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewProjectModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFullProject} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Título do Projeto *
                </label>
                <input
                  type="text"
                  required
                  value={newProjectForm.title}
                  onChange={(e) => setNewProjectForm({ ...newProjectForm, title: e.target.value })}
                  placeholder="Ex: Upgrade de Switches Core e Distribuição"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Categoria
                  </label>
                  <select
                    value={newProjectForm.category}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Infraestrutura">Infraestrutura</option>
                    <option value="Redes & Wi-Fi">Redes & Wi-Fi</option>
                    <option value="Sistemas & ERP">Sistemas & ERP</option>
                    <option value="Hotelaria & UHs">Hotelaria & UHs</option>
                    <option value="Segurança & CFTV">Segurança & CFTV</option>
                    <option value="Hardware & Servidores">Hardware & Servidores</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Etapa Inicial
                  </label>
                  <select
                    value={newProjectForm.status}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Planejamento">Planejamento</option>
                    <option value="Em Andamento">Em Andamento</option>
                    <option value="Pausado">Pausado</option>
                    <option value="Concluído">Concluído</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Prioridade
                  </label>
                  <select
                    value={newProjectForm.priority}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, priority: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Baixa">Baixa</option>
                    <option value="Média">Média</option>
                    <option value="Alta">Alta</option>
                    <option value="Crítica">Crítica</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Escopo e Descrição Geral
                </label>
                <textarea
                  rows={3}
                  value={newProjectForm.description}
                  onChange={(e) => setNewProjectForm({ ...newProjectForm, description: e.target.value })}
                  placeholder="Descreva as melhorias esperadas, áreas afetadas..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewProjectModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingProject}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow transition"
                >
                  {creatingProject ? "Criando..." : "Criar Projeto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BUTLER AUTOMAÇÃO                                                  */}
      {/* ========================================================================= */}
      {isButlerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400">
                <Zap className="w-5 h-5 animate-pulse" />
                <h3 className="text-base font-bold text-white">Automações Ativas no Kanban (Butler)</h3>
              </div>
              <button onClick={() => setIsButlerModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 bg-slate-850 border border-slate-800 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" /> Regra 1: Conclusão Automática do Projeto
                </div>
                <p className="text-xs text-slate-300">
                  Ao arrastar o cartão de um projeto para a coluna <strong>"Concluído"</strong> no Kanban, a data de encerramento é carimbada na hora e a barra de progresso avança para 100%.
                </p>
              </div>

              <div className="p-3.5 bg-slate-850 border border-slate-800 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
                  <CheckSquare className="w-4 h-4" /> Regra 2: Recalcular Progresso das Tarefas
                </div>
                <p className="text-xs text-slate-300">
                  Conforme a equipe marca os itens do checklist como concluídos dentro do projeto, o percentual de entrega do cartão avança dinamicamente no Kanban.
                </p>
              </div>

              <div className="p-3.5 bg-slate-850 border border-slate-800 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                  <AlertTriangle className="w-4 h-4" /> Regra 3: Auditoria na Linha do Tempo
                </div>
                <p className="text-xs text-slate-300">
                  Toda movimentação de projeto entre etapas do Kanban gera um registro com autor, data e hora no histórico do projeto.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsButlerModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
