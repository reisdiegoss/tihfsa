import { useState, useEffect, useMemo } from "react";
import {
  FolderKanban,
  LayoutGrid,
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
  ArrowLeft,
  Copy,
  Sliders,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../api/client";
import { projectsApi } from "../../api/projects";

// Colunas padrão de fluxo de trabalho do Quadro Trello
const WORKFLOW_COLUMNS = [
  { id: "A Fazer", title: "A Fazer", color: "border-slate-300 bg-slate-50 text-slate-800", badgeBg: "bg-slate-200 text-slate-700" },
  { id: "Em Andamento", title: "Em Andamento", color: "border-blue-300 bg-blue-50/40 text-blue-900", badgeBg: "bg-blue-100 text-blue-700" },
  { id: "Em Revisão", title: "Em Revisão / Bloqueado", color: "border-amber-300 bg-amber-50/40 text-amber-900", badgeBg: "bg-amber-100 text-amber-800" },
  { id: "Concluído", title: "Concluído", color: "border-emerald-300 bg-emerald-50/40 text-emerald-900", badgeBg: "bg-emerald-100 text-emerald-800" },
];

const CATEGORY_STYLES = {
  "Infraestrutura": { bg: "from-emerald-600 to-teal-700", text: "text-emerald-700", chip: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  "Redes & Wi-Fi": { bg: "from-blue-600 to-cyan-700", text: "text-blue-700", chip: "bg-blue-100 text-blue-800 border-blue-200" },
  "Sistemas & ERP": { bg: "from-purple-600 to-indigo-700", text: "text-purple-700", chip: "bg-purple-100 text-purple-800 border-purple-200" },
  "Hotelaria & UHs": { bg: "from-amber-600 to-orange-700", text: "text-amber-700", chip: "bg-amber-100 text-amber-800 border-amber-200" },
  "Segurança & CFTV": { bg: "from-rose-600 to-red-700", text: "text-rose-700", chip: "bg-rose-100 text-rose-800 border-rose-200" },
  "Telecom & VoIP": { bg: "from-indigo-600 to-blue-800", text: "text-indigo-700", chip: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  "Hardware & Servidores": { bg: "from-cyan-700 to-slate-800", text: "text-cyan-700", chip: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  "Outros": { bg: "from-slate-600 to-slate-800", text: "text-slate-700", chip: "bg-slate-100 text-slate-800 border-slate-200" },
};

const PRIORITY_BADGES = {
  "Urgente": "bg-red-500 text-white",
  "Alta": "bg-orange-500 text-white",
  "Média": "bg-blue-500 text-white",
  "Baixa": "bg-emerald-600 text-white",
};

// Modelos de Projetos de TI (Trello Templates)
const IT_TEMPLATES = [
  {
    id: "wifi-upgrade",
    title: "Upgrade Wi-Fi Ruckus & Cisco",
    category: "Redes & Wi-Fi",
    description: "Mapeamento de RF, calibração de APs nos blocos de apartamentos e testes de roaming de hóspedes.",
    icon: Wifi,
    color: "from-blue-600 to-cyan-600",
    tasks: [
      {
        title: "Site Survey e Mapeamento de Cobertura RF",
        status: "A Fazer",
        priority: "Alta",
        checklist: [
          { id: 1, text: "Medir atenuação nas portas acústicas das UHs", done: false },
          { id: 2, text: "Mapear canais livres de 2.4GHz e 5GHz", done: false },
          { id: 3, text: "Definir posições ótimas dos novos APs nos corredores", done: false },
        ],
      },
      {
        title: "Passagem de Cabeamento Cat6 Blindado",
        status: "A Fazer",
        priority: "Média",
        checklist: [
          { id: 1, text: "Lançar cabos do rack até pontos dos tetos", done: false },
          { id: 2, text: "Conectorizar patch panels Keystone RJ-45", done: false },
          { id: 3, text: "Certificação com Fluke e etiquetagem dos pontos", done: false },
        ],
      },
      {
        title: "Instalação e Patching dos Switches PoE+",
        status: "Em Andamento",
        priority: "Alta",
        checklist: [
          { id: 1, text: "Montagem física no rack 19 polegadas", done: true },
          { id: 2, text: "Configuração das VLANs 10 (Gerência) e 20 (Hóspedes)", done: false },
          { id: 3, text: "Habilitação do protocolo LACP / Link Aggregation", done: false },
        ],
      },
      {
        title: "Fixação Física e Ativação dos APs",
        status: "A Fazer",
        priority: "Média",
        checklist: [
          { id: 1, text: "Encaixe no suporte do teto rebaixado", done: false },
          { id: 2, text: "Provisionamento no Ruckus SmartZone / Cloud", done: false },
        ],
      },
      {
        title: "Homologação de Roaming e Portal Captivo",
        status: "A Fazer",
        priority: "Urgente",
        checklist: [
          { id: 1, text: "Caminhada de teste com handover entre APs", done: false },
          { id: 2, text: "Validação do login integrado com PMS Opera", done: false },
        ],
      },
    ],
  },
  {
    id: "cftv-seguranca",
    title: "Expansão de CFTV & NVRs IP",
    category: "Segurança & CFTV",
    description: "Instalação de novas câmeras IP em pontos cegos, migração de storage e políticas de retenção.",
    icon: ShieldCheck,
    color: "from-rose-600 to-red-600",
    tasks: [
      {
        title: "Mapeamento dos Pontos Cegos com Segurança Patrimonial",
        status: "A Fazer",
        priority: "Alta",
        checklist: [
          { id: 1, text: "Reunião de alinhamento com a chefia de segurança", done: false },
          { id: 2, text: "Definição de câmeras dome vs varifocal bullet", done: false },
        ],
      },
      {
        title: "Infraestrutura de Tubulação e Fibra para Guarita",
        status: "A Fazer",
        priority: "Média",
        checklist: [
          { id: 1, text: "Lançamento de eletroduto galvanizado", done: false },
          { id: 2, text: "Fusão de fibra óptica monomodo", done: false },
        ],
      },
      {
        title: "Configuração do Storage RAID e Retenção de 30 Dias",
        status: "Em Andamento",
        priority: "Urgente",
        checklist: [
          { id: 1, text: "Inicialização do arranjo RAID-5 de discos WD Purple", done: true },
          { id: 2, text: "Definição de taxa de bits H.265+ e 25 FPS", done: false },
        ],
      },
      {
        title: "Comissionamento das Câmeras no NVR e Video Wall",
        status: "A Fazer",
        priority: "Alta",
        checklist: [
          { id: 1, text: "Ajuste de foco e sensor infravermelho noturno", done: false },
          { id: 2, text: "Configuração das permissões de operadores no client", done: false },
        ],
      },
    ],
  },
  {
    id: "servers-ha",
    title: "Servidores & Virtualização (Datacenter)",
    category: "Hardware & Servidores",
    description: "Configuração de hosts físicos, arranjo SAN/iSCSI, políticas Veeam e testes de failover.",
    icon: Cpu,
    color: "from-cyan-700 to-slate-800",
    tasks: [
      {
        title: "Inventário de Consumo das VMs Legadas",
        status: "Concluído",
        priority: "Média",
        checklist: [
          { id: 1, text: "Levantamento de IOPS, vCPU e memória RAM", done: true },
          { id: 2, text: "Mapeamento de dependências e portas de rede", done: true },
        ],
      },
      {
        title: "Instalação do SO Hypervisor e Configuração da iDRAC",
        status: "Em Andamento",
        priority: "Alta",
        checklist: [
          { id: 1, text: "Update de firmware de BIOS, controladora e placas", done: true },
          { id: 2, text: "Configuração de IP fixo na gerência fora-de-banda", done: false },
        ],
      },
      {
        title: "Migração a Quente da VM do Banco de Dados",
        status: "A Fazer",
        priority: "Urgente",
        checklist: [
          { id: 1, text: "Snapshot de segurança pré-migração", done: false },
          { id: 2, text: "Live migration para o novo host", done: false },
          { id: 3, text: "Validação de latência e integridade do banco", done: false },
        ],
      },
      {
        title: "Configuração dos Jobs de Backup Veeam Noturnos",
        status: "A Fazer",
        priority: "Alta",
        checklist: [
          { id: 1, text: "Criação do repositório imutável contra ransomware", done: false },
          { id: 2, text: "Simulação de restore em sandbox isolada", done: false },
        ],
      },
    ],
  },
  {
    id: "hotelaria-uhs",
    title: "Manutenção Preventiva de UHs (Hotelaria)",
    category: "Hotelaria & UHs",
    description: "Auditoria preventiva nos quartos: IPTV, telefonia IP, fechadura RFID e sinal Wi-Fi.",
    icon: Layers,
    color: "from-amber-600 to-orange-700",
    tasks: [
      {
        title: "Auditoria do Ponto de Wi-Fi e IPTV nos Quartos 101 a 115",
        status: "A Fazer",
        priority: "Média",
        checklist: [
          { id: 1, text: "Medir velocidade de download na Smart TV (mín 30Mbps)", done: false },
          { id: 2, text: "Testar canal de boas-vindas do hóspede", done: false },
        ],
      },
      {
        title: "Teste de Ramal Telefônico e Campainha",
        status: "Em Andamento",
        priority: "Baixa",
        checklist: [
          { id: 1, text: "Discagem para Recepção e Governança", done: true },
          { id: 2, text: "Limpeza do teclado e substituição do espiral se danificado", done: false },
        ],
      },
      {
        title: "Checagem de Tensão da Bateria da Fechadura RFID",
        status: "A Fazer",
        priority: "Alta",
        checklist: [
          { id: 1, text: "Leitura de volts com multímetro (mínimo 5.6V)", done: false },
          { id: 2, text: "Lubrificação da lingueta e teste do cartão mestre", done: false },
        ],
      },
    ],
  },
];

export default function Projects() {
  const { user, isAdmin, isTechnician } = useAuth();

  // Estado Geral
  const [projects, setProjects] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [allAssetsList, setAllAssetsList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Navegação: Se null -> Tela de Workspaces/Hub de Quadros; Se ID -> Quadro Trello Aberto
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [activeBoard, setActiveBoard] = useState(null);
  const [loadingBoard, setLoadingBoard] = useState(false);

  // Aba no Hub de Workspaces: 'boards' | 'templates'
  const [workspaceTab, setWorkspaceTab] = useState("boards");

  // Filtros no Hub de Quadros
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("ALL");

  // Cartão Aberto no Modal Trello
  const [activeCard, setActiveCard] = useState(null);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [newChecklistText, setNewChecklistText] = useState("");
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [tempDescription, setTempDescription] = useState("");
  const [cardCommentText, setCardCommentText] = useState("");
  const [sendingCardComment, setSendingCardComment] = useState(false);

  // Inline Composer de Cartão na Coluna do Trello
  const [inlineComposerColumn, setInlineComposerColumn] = useState(null);
  const [inlineCardTitle, setInlineCardTitle] = useState("");
  const [savingInlineCard, setSavingInlineCard] = useState(false);

  // Modais de Criação e Power-Ups
  const [isNewBoardModalOpen, setIsNewBoardModalOpen] = useState(false);
  const [newBoardForm, setNewBoardForm] = useState({
    title: "",
    category: "Infraestrutura",
    priority: "Média",
    due_date: "",
    budget: "",
    description: "",
  });
  const [creatingBoard, setCreatingBoard] = useState(false);

  // Modais de Vínculos do Quadro (Power-Ups)
  const [isAssetsModalOpen, setIsAssetsModalOpen] = useState(false);
  const [assetSearchQuery, setAssetSearchQuery] = useState("");
  const [isTicketsModalOpen, setIsTicketsModalOpen] = useState(false);
  const [ticketSearchId, setTicketSearchId] = useState("");
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [selectedMemberToAdd, setSelectedMemberToAdd] = useState("");
  const [isButlerModalOpen, setIsButlerModalOpen] = useState(false);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);

  // Carregar lista de Projetos (Quadros), Usuários e Ativos
  const loadWorkspaceData = async () => {
    try {
      setLoading(true);
      const [prjRes, usrRes, astRes] = await Promise.all([
        projectsApi.getProjects(),
        api.get("/users?limit=100").catch(() => ({ data: [] })),
        api.get("/assets?limit=250").catch(() => ({ data: [] })),
      ]);
      setProjects(prjRes || []);
      setUsersList(usrRes.data?.items || usrRes.data || []);
      setAllAssetsList(astRes.data?.items || astRes.data || []);
    } catch (err) {
      console.error("Erro ao carregar dados do workspace:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, []);

  // Carregar dados completos do Quadro Ativo
  const loadBoardDetail = async (boardId) => {
    if (!boardId) return;
    try {
      setLoadingBoard(true);
      const data = await projectsApi.getProject(boardId);
      setActiveBoard(data);
      // Se tiver um cartão aberto, atualiza ele também
      if (activeCard) {
        const freshTask = (data.tasks || []).find((t) => t.id === activeCard.id);
        if (freshTask) setActiveCard(freshTask);
      }
    } catch (err) {
      console.error("Erro ao carregar quadro:", err);
    } finally {
      setLoadingBoard(false);
    }
  };

  useEffect(() => {
    if (activeBoardId) {
      loadBoardDetail(activeBoardId);
    } else {
      setActiveBoard(null);
      setActiveCard(null);
      setIsCardModalOpen(false);
    }
  }, [activeBoardId]);

  // Filtro de Projetos no Hub
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchSearch =
        !searchQuery ||
        p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = selectedCategoryFilter === "ALL" || p.category === selectedCategoryFilter;
      return matchSearch && matchCat;
    });
  }, [projects, searchQuery, selectedCategoryFilter]);

  // Manipulação de Criação de Novo Quadro
  const handleCreateBoard = async (e) => {
    e.preventDefault();
    if (!newBoardForm.title.trim()) return;
    try {
      setCreatingBoard(true);
      const created = await projectsApi.createProject({
        title: newBoardForm.title.trim(),
        category: newBoardForm.category,
        priority: newBoardForm.priority,
        due_date: newBoardForm.due_date || null,
        budget: newBoardForm.budget ? parseFloat(newBoardForm.budget) : 0,
        description: newBoardForm.description || null,
        manager_id: user?.id,
      });

      // Cria tarefas padrão essenciais
      await projectsApi.createTask(created.id, {
        title: "Levantamento inicial de requisitos",
        status: "A Fazer",
        priority: "Média",
        checklist: [{ id: 1, text: "Alinhamento com stakeholders", done: false }],
      });

      setIsNewBoardModalOpen(false);
      setNewBoardForm({
        title: "",
        category: "Infraestrutura",
        priority: "Média",
        due_date: "",
        budget: "",
        description: "",
      });
      await loadWorkspaceData();
      // Abre o quadro recém-criado
      setActiveBoardId(created.id);
    } catch (err) {
      console.error("Erro ao criar quadro:", err);
      alert("Erro ao criar quadro de projeto. Verifique os dados.");
    } finally {
      setCreatingBoard(false);
    }
  };

  // Instanciar a partir de um Modelo de Projeto (Template)
  const handleUseTemplate = async (tpl) => {
    try {
      setLoading(true);
      const created = await projectsApi.createProject({
        title: `${tpl.title} — ${new Date().toLocaleDateString("pt-BR")}`,
        category: tpl.category,
        priority: "Alta",
        description: tpl.description,
        manager_id: user?.id,
      });

      // Cria todas as tarefas do modelo
      for (const t of tpl.tasks) {
        await projectsApi.createTask(created.id, {
          title: t.title,
          status: t.status,
          priority: t.priority,
          checklist: t.checklist || [],
        });
      }

      await loadWorkspaceData();
      setActiveBoardId(created.id);
    } catch (err) {
      console.error("Erro ao instanciar modelo:", err);
      alert("Não foi possível criar o projeto a partir do modelo.");
    } finally {
      setLoading(false);
    }
  };

  // Drag and Drop Nativo do Trello
  const handleDragStart = (e, task) => {
    e.dataTransfer.setData("application/json", JSON.stringify(task));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropOnColumn = async (e, targetStatus) => {
    e.preventDefault();
    const rawData = e.dataTransfer.getData("application/json");
    if (!rawData || !activeBoard) return;
    const task = JSON.parse(rawData);
    if (task.status === targetStatus) return;

    // Atualização otimista imediata na interface
    setActiveBoard((prev) => {
      if (!prev) return prev;
      const updatedTasks = prev.tasks.map((t) =>
        t.id === task.id ? { ...t, status: targetStatus, completed_at: targetStatus === "Concluído" ? new Date().toISOString() : null } : t
      );
      return { ...prev, tasks: updatedTasks };
    });

    try {
      await projectsApi.updateTask(activeBoard.id, task.id, {
        status: targetStatus,
      });
      loadBoardDetail(activeBoard.id);
    } catch (err) {
      console.error("Erro ao mover cartão:", err);
      loadBoardDetail(activeBoard.id);
    }
  };

  // Inline Card Composer (Adicionar cartão na coluna do Trello)
  const handleCreateInlineCard = async (status) => {
    if (!inlineCardTitle.trim() || !activeBoard) return;
    try {
      setSavingInlineCard(true);
      await projectsApi.createTask(activeBoard.id, {
        title: inlineCardTitle.trim(),
        status: status,
        priority: "Média",
        checklist: [],
      });
      setInlineCardTitle("");
      setInlineComposerColumn(null);
      loadBoardDetail(activeBoard.id);
    } catch (err) {
      console.error("Erro ao criar cartão inline:", err);
      alert("Erro ao adicionar cartão.");
    } finally {
      setSavingInlineCard(false);
    }
  };

  // Abrir Detalhe do Cartão Trello
  const handleOpenCard = (task) => {
    setActiveCard(task);
    setTempDescription(task.description || "");
    setIsEditingDescription(false);
    setIsCardModalOpen(true);
  };

  // Salvar Descrição do Cartão
  const handleSaveDescription = async () => {
    if (!activeCard || !activeBoard) return;
    try {
      await projectsApi.updateTask(activeBoard.id, activeCard.id, {
        description: tempDescription,
      });
      setActiveCard((prev) => ({ ...prev, description: tempDescription }));
      setIsEditingDescription(false);
      loadBoardDetail(activeBoard.id);
    } catch (err) {
      console.error("Erro ao salvar descrição:", err);
    }
  };

  // Checklist: Adicionar Subtarefa
  const handleAddChecklistItem = async () => {
    if (!newChecklistText.trim() || !activeCard || !activeBoard) return;
    const currentList = Array.isArray(activeCard.checklist) ? activeCard.checklist : [];
    const newItem = {
      id: Date.now(),
      text: newChecklistText.trim(),
      done: false,
    };
    const updated = [...currentList, newItem];
    setActiveCard((prev) => ({ ...prev, checklist: updated }));
    setNewChecklistText("");

    try {
      await projectsApi.updateTask(activeBoard.id, activeCard.id, {
        checklist: updated,
      });
      loadBoardDetail(activeBoard.id);
    } catch (err) {
      console.error("Erro ao adicionar checklist:", err);
    }
  };

  // Checklist: Marcar/Desmarcar
  const handleToggleChecklistItem = async (itemId) => {
    if (!activeCard || !activeBoard) return;
    const currentList = Array.isArray(activeCard.checklist) ? activeCard.checklist : [];
    const updated = currentList.map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );
    setActiveCard((prev) => ({ ...prev, checklist: updated }));

    try {
      await projectsApi.updateTask(activeBoard.id, activeCard.id, {
        checklist: updated,
      });
      loadBoardDetail(activeBoard.id);
    } catch (err) {
      console.error("Erro ao alternar checklist:", err);
    }
  };

  // Checklist: Excluir item
  const handleDeleteChecklistItem = async (itemId) => {
    if (!activeCard || !activeBoard) return;
    const currentList = Array.isArray(activeCard.checklist) ? activeCard.checklist : [];
    const updated = currentList.filter((item) => item.id !== itemId);
    setActiveCard((prev) => ({ ...prev, checklist: updated }));

    try {
      await projectsApi.updateTask(activeBoard.id, activeCard.id, {
        checklist: updated,
      });
      loadBoardDetail(activeBoard.id);
    } catch (err) {
      console.error("Erro ao excluir item:", err);
    }
  };

  // Alterar Status do Cartão pelo Modal
  const handleChangeCardStatus = async (newStatus) => {
    if (!activeCard || !activeBoard || activeCard.status === newStatus) return;
    try {
      await projectsApi.updateTask(activeBoard.id, activeCard.id, {
        status: newStatus,
      });
      setActiveCard((prev) => ({ ...prev, status: newStatus }));
      loadBoardDetail(activeBoard.id);
    } catch (err) {
      console.error("Erro ao atualizar status:", err);
    }
  };

  // Alterar Prioridade do Cartão
  const handleChangeCardPriority = async (newPriority) => {
    if (!activeCard || !activeBoard) return;
    try {
      await projectsApi.updateTask(activeBoard.id, activeCard.id, {
        priority: newPriority,
      });
      setActiveCard((prev) => ({ ...prev, priority: newPriority }));
      loadBoardDetail(activeBoard.id);
    } catch (err) {
      console.error("Erro ao alterar prioridade:", err);
    }
  };

  // Atribuir Responsável ao Cartão
  const handleAssignCardMember = async (userId) => {
    if (!activeCard || !activeBoard) return;
    const uid = userId ? parseInt(userId) : null;
    try {
      await projectsApi.updateTask(activeBoard.id, activeCard.id, {
        assigned_to_id: uid,
      });
      const assignedObj = usersList.find((u) => u.id === uid) || null;
      setActiveCard((prev) => ({ ...prev, assigned_to_id: uid, assigned_to: assignedObj }));
      loadBoardDetail(activeBoard.id);
    } catch (err) {
      console.error("Erro ao atribuir membro:", err);
    }
  };

  // Vincular Ativo do CMDB diretamente ao Cartão
  const handleLinkAssetToCard = async (assetId) => {
    if (!activeCard || !activeBoard) return;
    const aid = assetId ? parseInt(assetId) : null;
    try {
      await projectsApi.updateTask(activeBoard.id, activeCard.id, {
        asset_id: aid,
      });
      const assetObj = allAssetsList.find((a) => a.id === aid) || null;
      setActiveCard((prev) => ({ ...prev, asset_id: aid, asset: assetObj }));
      // Se não estiver vinculado ao quadro geral, vincula também
      if (aid && !activeBoard.assets?.some((a) => a.id === aid)) {
        await projectsApi.linkAsset(activeBoard.id, aid);
      }
      loadBoardDetail(activeBoard.id);
    } catch (err) {
      console.error("Erro ao vincular ativo ao cartão:", err);
    }
  };

  // Alternar Bloqueio do Cartão
  const handleToggleCardBlocked = async () => {
    if (!activeCard || !activeBoard) return;
    const newBlocked = !activeCard.is_blocked;
    let reason = null;
    if (newBlocked) {
      reason = prompt("Motivo do bloqueio / impedimento:", activeCard.blocked_reason || "") || "Aguardando terceiros ou suprimentos";
    }
    try {
      await projectsApi.updateTask(activeBoard.id, activeCard.id, {
        is_blocked: newBlocked,
        blocked_reason: reason,
      });
      setActiveCard((prev) => ({ ...prev, is_blocked: newBlocked, blocked_reason: reason }));
      loadBoardDetail(activeBoard.id);
    } catch (err) {
      console.error("Erro ao alternar bloqueio:", err);
    }
  };

  // Excluir Cartão
  const handleDeleteCard = async () => {
    if (!activeCard || !activeBoard) return;
    if (!confirm(`Deseja realmente excluir o cartão "${activeCard.title}"?`)) return;
    try {
      await projectsApi.deleteTask(activeBoard.id, activeCard.id);
      setIsCardModalOpen(false);
      setActiveCard(null);
      loadBoardDetail(activeBoard.id);
    } catch (err) {
      console.error("Erro ao excluir cartão:", err);
    }
  };

  // Postar Comentário no Cartão / Linha do Tempo
  const handlePostComment = async () => {
    if (!cardCommentText.trim() || !activeBoard || !activeCard) return;
    try {
      setSendingCardComment(true);
      await projectsApi.addTimelineComment(
        activeBoard.id,
        `[Cartão: ${activeCard.title}] ${cardCommentText.trim()}`,
        "comment"
      );
      setCardCommentText("");
      loadBoardDetail(activeBoard.id);
    } catch (err) {
      console.error("Erro ao postar comentário:", err);
    } finally {
      setSendingCardComment(false);
    }
  };

  // Power-Ups do Quadro: Adicionar/Remover Membro da Equipe
  const handleAddBoardMember = async () => {
    if (!selectedMemberToAdd || !activeBoard) return;
    try {
      await projectsApi.addMember(activeBoard.id, parseInt(selectedMemberToAdd));
      setSelectedMemberToAdd("");
      loadBoardDetail(activeBoard.id);
    } catch (err) {
      console.error("Erro ao adicionar membro:", err);
      alert("Erro ao adicionar membro ao quadro.");
    }
  };

  const handleRemoveBoardMember = async (userId) => {
    if (!activeBoard) return;
    try {
      await projectsApi.removeMember(activeBoard.id, userId);
      loadBoardDetail(activeBoard.id);
    } catch (err) {
      console.error("Erro ao remover membro:", err);
    }
  };

  // Power-Ups do Quadro: Vincular/Desvincular Ativo CMDB
  const handleLinkBoardAsset = async (assetId) => {
    if (!activeBoard) return;
    try {
      await projectsApi.linkAsset(activeBoard.id, assetId);
      loadBoardDetail(activeBoard.id);
    } catch (err) {
      console.error("Erro ao vincular ativo:", err);
    }
  };

  const handleUnlinkBoardAsset = async (assetId) => {
    if (!activeBoard) return;
    try {
      await projectsApi.unlinkAsset(activeBoard.id, assetId);
      loadBoardDetail(activeBoard.id);
    } catch (err) {
      console.error("Erro ao desvincular ativo:", err);
    }
  };

  // Power-Ups do Quadro: Vincular Chamado Existente
  const handleLinkBoardTicket = async () => {
    if (!ticketSearchId.trim() || !activeBoard) return;
    try {
      await projectsApi.linkTicket(activeBoard.id, parseInt(ticketSearchId.trim()));
      setTicketSearchId("");
      loadBoardDetail(activeBoard.id);
    } catch (err) {
      console.error("Erro ao vincular chamado:", err);
      alert("Chamado não encontrado ou já vinculado.");
    }
  };

  const handleUnlinkBoardTicket = async (ticketId) => {
    if (!activeBoard) return;
    try {
      await projectsApi.unlinkTicket(activeBoard.id, ticketId);
      loadBoardDetail(activeBoard.id);
    } catch (err) {
      console.error("Erro ao desvincular chamado:", err);
    }
  };

  // Excluir Quadro Completo
  const handleDeleteBoard = async () => {
    if (!activeBoard) return;
    if (!confirm(`Atenção: Deseja realmente excluir permanentemente o quadro "${activeBoard.title}" e todos os seus cartões?`)) return;
    try {
      await projectsApi.deleteProject(activeBoard.id);
      setActiveBoardId(null);
      await loadWorkspaceData();
    } catch (err) {
      console.error("Erro ao excluir quadro:", err);
    }
  };

  // Cálculo de progresso do checklist do cartão ativo
  const cardChecklistStats = useMemo(() => {
    if (!activeCard || !Array.isArray(activeCard.checklist) || activeCard.checklist.length === 0) {
      return { total: 0, done: 0, percent: 0 };
    }
    const total = activeCard.checklist.length;
    const done = activeCard.checklist.filter((i) => i.done).length;
    const percent = Math.round((done / total) * 100);
    return { total, done, percent };
  }, [activeCard]);

  // Ativos CMDB elegíveis para vincular
  const availableAssetsToLink = useMemo(() => {
    const linkedIds = new Set((activeBoard?.assets || []).map((a) => a.id));
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
  }, [allAssetsList, activeBoard, assetSearchQuery]);

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-slate-100 font-sans">
      {/* ========================================================================= */}
      {/* BARRA SUPERIOR DO WORKSPACE (Estilo Trello Workspace Header)             */}
      {/* ========================================================================= */}
      <header className="bg-slate-950/80 backdrop-blur border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg shadow-md shadow-blue-500/20 text-white">
            <FolderKanban className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-wider uppercase text-blue-400">Área de Trabalho</span>
              <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">TIHFSA</span>
            </div>
            <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Hotel Fasano Salvador — Projetos & Entregas de TI
            </h1>
          </div>
        </div>

        {/* Botões do Topo */}
        <div className="flex items-center gap-2">
          {activeBoard ? (
            <button
              onClick={() => setActiveBoardId(null)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Ver Todos os Quadros
            </button>
          ) : (
            <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700">
              <button
                onClick={() => setWorkspaceTab("boards")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  workspaceTab === "boards" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Quadros ({projects.length})
              </button>
              <button
                onClick={() => setWorkspaceTab("templates")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  workspaceTab === "templates" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Modelos de Projetos
              </button>
            </div>
          )}

          {!activeBoard && (
            <button
              onClick={() => setIsNewBoardModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Criar Novo Quadro
            </button>
          )}

          <button
            onClick={() => (activeBoardId ? loadBoardDetail(activeBoardId) : loadWorkspaceData())}
            title="Recarregar"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || loadingBoard ? "animate-spin text-blue-400" : ""}`} />
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* VISÃO 1: HUB DE QUADROS & MODELOS (Trello Workspace Home)                */}
      {/* ========================================================================= */}
      {!activeBoardId && (
        <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
          {/* Aba de Quadros */}
          {workspaceTab === "boards" && (
            <>
              {/* Barra de Filtros e Busca */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-800/40 border border-slate-800 p-3 rounded-xl">
                <div className="relative flex-1 min-w-[240px] max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrar quadros por nome ou código..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  <span className="text-xs text-slate-400">Categoria:</span>
                  {["ALL", "Infraestrutura", "Redes & Wi-Fi", "Sistemas & ERP", "Segurança & CFTV", "Hardware & Servidores"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategoryFilter(cat)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition whitespace-nowrap ${
                        selectedCategoryFilter === cat
                          ? "bg-blue-600/30 border-blue-500 text-blue-300 font-semibold"
                          : "bg-slate-900/60 border-slate-700/60 text-slate-400 hover:text-white hover:border-slate-600"
                      }`}
                    >
                      {cat === "ALL" ? "Todas" : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grade de Quadros (Trello Boards Grid) */}
              <div>
                <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-blue-400" />
                  Seus Quadros de Trabalho ({filteredProjects.length})
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {/* Card Criar Novo Quadro */}
                  <div
                    onClick={() => setIsNewBoardModalOpen(true)}
                    className="group cursor-pointer rounded-xl border border-dashed border-slate-700 hover:border-blue-500/60 bg-slate-850/40 hover:bg-slate-800/60 p-5 flex flex-col items-center justify-center min-h-[160px] text-center transition duration-200"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-800 group-hover:bg-blue-600/20 group-hover:text-blue-400 text-slate-400 flex items-center justify-center transition mb-2">
                      <Plus className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-blue-300 transition">
                      Criar novo quadro
                    </span>
                    <span className="text-[11px] text-slate-500 mt-1">Inicie um projeto do zero</span>
                  </div>

                  {/* Lista de Quadros Existentes */}
                  {filteredProjects.map((prj) => {
                    const style = CATEGORY_STYLES[prj.category] || CATEGORY_STYLES["Outros"];
                    const completedTasks = prj.tasks_completed || 0;
                    const totalTasks = prj.tasks_count || 0;
                    const progressPct = prj.progress || 0;

                    return (
                      <div
                        key={prj.id}
                        onClick={() => setActiveBoardId(prj.id)}
                        className="group cursor-pointer rounded-xl overflow-hidden border border-slate-800 hover:border-slate-600 bg-slate-850 hover:bg-slate-800 shadow-lg hover:shadow-2xl transition duration-200 flex flex-col"
                      >
                        {/* Banner Colorido Superior */}
                        <div className={`h-14 bg-gradient-to-r ${style.bg} p-3 flex items-start justify-between relative`}>
                          <span className="text-[10px] font-bold tracking-wider uppercase bg-black/30 backdrop-blur text-white px-2 py-0.5 rounded-full border border-white/20">
                            {prj.category}
                          </span>
                          <span className="text-xs font-mono font-bold text-white/90 bg-black/20 px-1.5 py-0.5 rounded">
                            {prj.code}
                          </span>
                        </div>

                        {/* Corpo do Quadro */}
                        <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                          <div>
                            <h3 className="text-sm font-bold text-white group-hover:text-blue-300 transition line-clamp-1">
                              {prj.title}
                            </h3>
                            <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                              {prj.description || "Sem descrição informada."}
                            </p>
                          </div>

                          {/* Barra de Progresso */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] font-medium text-slate-400">
                              <span>Progresso</span>
                              <span className="text-emerald-400 font-bold">{progressPct}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>

                          {/* Rodapé com Indicadores */}
                          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1" title="Tarefas no Quadro">
                                <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                                {completedTasks}/{totalTasks}
                              </span>
                              {prj.assets_count > 0 && (
                                <span className="flex items-center gap-1" title="Equipamentos CMDB">
                                  <Server className="w-3.5 h-3.5 text-amber-400" />
                                  {prj.assets_count}
                                </span>
                              )}
                              {prj.tickets_count > 0 && (
                                <span className="flex items-center gap-1" title="Chamados Vinculados">
                                  <Ticket className="w-3.5 h-3.5 text-rose-400" />
                                  {prj.tickets_count}
                                </span>
                              )}
                            </div>

                            {/* Membros */}
                            <div className="flex -space-x-1.5 overflow-hidden">
                              {(prj.members || []).slice(0, 3).map((m, idx) => (
                                <div
                                  key={idx}
                                  title={m.display_name}
                                  className="w-5 h-5 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-[9px] flex items-center justify-center border border-slate-900"
                                >
                                  {m.display_name.charAt(0)}
                                </div>
                              ))}
                              {(prj.members || []).length === 0 && (
                                <span className="text-[10px] text-slate-500">Sem equipe</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Aba de Modelos (Templates de TI) */}
          {workspaceTab === "templates" && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-purple-900/40 border border-blue-500/30 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold tracking-wider uppercase mb-1">
                  <Sparkles className="w-4 h-4" /> Modelos Oficiais de Gestão de TI
                </div>
                <h2 className="text-xl font-bold">Inicie Projetos Prontos em 1 Clique</h2>
                <p className="text-xs text-slate-300 max-w-2xl mt-1">
                  Evite criar do zero. Utilize os fluxos testados da nossa infraestrutura hoteleira contendo checklists,
                  tarefas pré-configuradas e etapas de validação para Wi-Fi, Servidores, CFTV e UHs.
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

                      {/* Prévia das Tarefas */}
                      <div className="space-y-1.5 bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                        <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                          <span>Tarefas incluídas no modelo ({tpl.tasks.length}):</span>
                        </div>
                        <div className="space-y-1 mt-1">
                          {tpl.tasks.map((task, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              <span className="truncate flex-1">{task.title}</span>
                              <span className="text-[10px] text-slate-500">
                                ({task.checklist.length} subitens)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => handleUseTemplate(tpl)}
                        className="w-full py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition active:scale-98"
                      >
                        <Copy className="w-4 h-4" />
                        Usar este Modelo de Projeto
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      )}

      {/* ========================================================================= */}
      {/* VISÃO 2: QUADRO TRELLO ABERTO (Active Board Canvas)                      */}
      {/* ========================================================================= */}
      {activeBoardId && activeBoard && (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
          {/* Barra Superior do Quadro Específico */}
          <div className="bg-slate-950/90 border-b border-slate-800 px-5 py-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveBoardId(null)}
                title="Voltar ao Workspace"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold bg-blue-900/60 text-blue-300 border border-blue-700/60 px-1.5 py-0.5 rounded">
                    {activeBoard.code}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {activeBoard.category}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {activeBoard.progress || 0}% Concluído
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  {activeBoard.title}
                </h2>
              </div>
            </div>

            {/* Power-Ups e Controles do Quadro */}
            <div className="flex items-center flex-wrap gap-2">
              {/* Membros do Quadro */}
              <button
                onClick={() => setIsMembersModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs border border-slate-700 transition"
              >
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span>Equipe ({(activeBoard.members || []).length})</span>
              </button>

              {/* Power-Up: CMDB Ativos */}
              <button
                onClick={() => setIsAssetsModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs border border-slate-700 transition"
              >
                <Server className="w-3.5 h-3.5 text-amber-400" />
                <span>Ativos CMDB ({(activeBoard.assets || []).length})</span>
              </button>

              {/* Power-Up: Chamados */}
              <button
                onClick={() => setIsTicketsModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs border border-slate-700 transition"
              >
                <Ticket className="w-3.5 h-3.5 text-rose-400" />
                <span>Chamados ({(activeBoard.tickets || []).length})</span>
              </button>

              {/* Automação Butler */}
              <button
                onClick={() => setIsButlerModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600/20 to-orange-600/20 hover:from-amber-600/30 hover:to-orange-600/30 text-amber-300 text-xs font-semibold border border-amber-500/40 transition"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>Automação Butler</span>
              </button>

              {/* Linha do Tempo */}
              <button
                onClick={() => setIsTimelineModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs border border-slate-700 transition"
              >
                <History className="w-3.5 h-3.5 text-indigo-400" />
                <span>Histórico</span>
              </button>

              {/* Excluir Quadro */}
              {isAdmin && (
                <button
                  onClick={handleDeleteBoard}
                  title="Excluir Quadro"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-700 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Canvas das Colunas / Listas Trello com Scroll Horizontal */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden p-5 flex gap-4 items-start">
            {WORKFLOW_COLUMNS.map((column) => {
              const columnTasks = (activeBoard.tasks || []).filter((t) => t.status === column.id);

              return (
                <div
                  key={column.id}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDropOnColumn(e, column.id)}
                  className="w-80 flex-shrink-0 bg-slate-950/60 border border-slate-800/90 rounded-2xl flex flex-col max-h-[calc(100vh-140px)] shadow-xl"
                >
                  {/* Cabeçalho da Lista */}
                  <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                        {column.title}
                      </h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${column.badgeBg}`}>
                        {columnTasks.length}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setInlineComposerColumn(column.id);
                        setInlineCardTitle("");
                      }}
                      className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition"
                      title="Adicionar cartão"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Área de Cartões com Rolagem Interna */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[100px]">
                    {columnTasks.map((task) => {
                      const priorityChip = PRIORITY_BADGES[task.priority] || "bg-slate-600 text-white";
                      const checklistCount = Array.isArray(task.checklist) ? task.checklist.length : 0;
                      const checklistDone = Array.isArray(task.checklist) ? task.checklist.filter((i) => i.done).length : 0;
                      const hasChecklist = checklistCount > 0;
                      const allDone = hasChecklist && checklistDone === checklistCount;

                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task)}
                          onClick={() => handleOpenCard(task)}
                          className={`group cursor-pointer bg-slate-850 hover:bg-slate-800 border rounded-xl p-3 shadow-md hover:shadow-lg transition-all duration-150 transform hover:-translate-y-0.5 select-none ${
                            task.is_blocked
                              ? "border-rose-500/70 bg-rose-950/10"
                              : allDone
                              ? "border-emerald-500/60"
                              : "border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          {/* Etiquetas e Prioridade */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${priorityChip}`}>
                              {task.priority}
                            </span>

                            {task.is_blocked && (
                              <span className="text-[9px] font-bold bg-rose-600 text-white px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                                <Ban className="w-2.5 h-2.5" /> BLOQUEADO
                              </span>
                            )}
                          </div>

                          {/* Título do Cartão */}
                          <h4 className="text-xs font-semibold text-white group-hover:text-blue-300 transition line-clamp-2 leading-relaxed">
                            {task.title}
                          </h4>

                          {/* Badges / Indicadores do Cartão */}
                          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                            <div className="flex items-center gap-2.5">
                              {/* Checklist Badge */}
                              {hasChecklist && (
                                <span
                                  className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                    allDone ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/60" : "text-slate-400 bg-slate-800"
                                  }`}
                                  title={`Checklist: ${checklistDone} de ${checklistCount} concluídos`}
                                >
                                  <CheckSquare className="w-3 h-3" />
                                  {checklistDone}/{checklistCount}
                                </span>
                              )}

                              {/* Ativo Vinculado */}
                              {task.asset && (
                                <span
                                  className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded"
                                  title={`Ativo: ${task.asset.name} (${task.asset.asset_tag || "Sem tag"})`}
                                >
                                  <Server className="w-3 h-3" />
                                  {task.asset.asset_tag || "CMDB"}
                                </span>
                              )}

                              {/* Chamado Vinculado */}
                              {task.ticket_id && (
                                <span
                                  className="flex items-center gap-1 text-[10px] text-rose-400 bg-rose-950/60 border border-rose-800/60 px-1.5 py-0.5 rounded"
                                  title={`Chamado vinculado #${task.ticket_id}`}
                                >
                                  <Ticket className="w-3 h-3" />#{task.ticket_id}
                                </span>
                              )}
                            </div>

                            {/* Membro Atribuído */}
                            {task.assigned_to ? (
                              <div
                                title={`Responsável: ${task.assigned_to.display_name}`}
                                className="w-5 h-5 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-[9px] flex items-center justify-center border border-slate-700"
                              >
                                {task.assigned_to.display_name.charAt(0)}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-600">—</span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Inline Composer (Se ativo nesta coluna) */}
                    {inlineComposerColumn === column.id && (
                      <div className="bg-slate-850 border border-blue-500/80 rounded-xl p-3 space-y-2 shadow-lg animate-in fade-in duration-150">
                        <textarea
                          autoFocus
                          rows={2}
                          value={inlineCardTitle}
                          onChange={(e) => setInlineCardTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleCreateInlineCard(column.id);
                            }
                          }}
                          placeholder="Insira o título para este cartão..."
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                        />
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => handleCreateInlineCard(column.id)}
                            disabled={savingInlineCard || !inlineCardTitle.trim()}
                            className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow transition"
                          >
                            {savingInlineCard ? "Adicionando..." : "Adicionar Cartão"}
                          </button>
                          <button
                            onClick={() => {
                              setInlineComposerColumn(null);
                              setInlineCardTitle("");
                            }}
                            className="p-1 text-slate-400 hover:text-white transition"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Rodapé da Coluna: Botão Adicionar Cartão */}
                  {inlineComposerColumn !== column.id && (
                    <div className="p-2 border-t border-slate-800/80">
                      <button
                        onClick={() => {
                          setInlineComposerColumn(column.id);
                          setInlineCardTitle("");
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 text-xs font-medium transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Adicionar um cartão
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISÃO 3: MODAL DO CARTÃO ESTILO TRELLO (Card Detail Modal)                */}
      {/* ========================================================================= */}
      {isCardModalOpen && activeCard && activeBoard && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col my-auto">
            {/* Cabeçalho do Cartão */}
            <div className="p-6 border-b border-slate-800 flex items-start justify-between gap-4 sticky top-0 bg-slate-900 z-10">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded">
                    {activeBoard.code}
                  </span>
                  <span className="text-xs text-slate-400">
                    Na lista <strong className="text-white underline">{activeCard.status}</strong>
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight leading-snug">
                  {activeCard.title}
                </h3>
              </div>

              <button
                onClick={() => setIsCardModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Grid Principal: Lado Esquerdo (Conteúdo) + Lado Direito (Ações Trello) */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Lado Esquerdo: Descrição, Checklist, Power-Ups e Atividades */}
              <div className="lg:col-span-2 space-y-6">
                {/* Metadados rápidos: Membro, Prioridade e Status */}
                <div className="flex flex-wrap gap-4 items-center bg-slate-850 p-4 rounded-xl border border-slate-800">
                  {/* Responsável */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Responsável
                    </span>
                    <select
                      value={activeCard.assigned_to_id || ""}
                      onChange={(e) => handleAssignCardMember(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Não Atribuído</option>
                      {usersList.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.display_name} ({u.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Prioridade */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Prioridade
                    </span>
                    <select
                      value={activeCard.priority || "Média"}
                      onChange={(e) => handleChangeCardPriority(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="Baixa">🟢 Baixa</option>
                      <option value="Média">🔵 Média</option>
                      <option value="Alta">🟠 Alta</option>
                      <option value="Urgente">🔴 Urgente</option>
                    </select>
                  </div>

                  {/* Mover de Lista */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Etapa / Lista
                    </span>
                    <select
                      value={activeCard.status}
                      onChange={(e) => handleChangeCardStatus(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      {WORKFLOW_COLUMNS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Alerta de Bloqueio se houver */}
                {activeCard.is_blocked && (
                  <div className="bg-rose-950/40 border border-rose-500/70 p-4 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider">
                        Atividade Bloqueada
                      </h4>
                      <p className="text-xs text-rose-200 mt-0.5">
                        {activeCard.blocked_reason || "Sem justificativa informada."}
                      </p>
                    </div>
                  </div>
                )}

                {/* Seção de Descrição */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <Edit3 className="w-4 h-4 text-blue-400" />
                      Descrição
                    </h4>
                    {!isEditingDescription && (
                      <button
                        onClick={() => setIsEditingDescription(true)}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                      >
                        Editar
                      </button>
                    )}
                  </div>

                  {isEditingDescription ? (
                    <div className="space-y-2">
                      <textarea
                        rows={4}
                        value={tempDescription}
                        onChange={(e) => setTempDescription(e.target.value)}
                        placeholder="Adicione detalhes, especificações técnicas, links..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSaveDescription}
                          className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={() => {
                            setTempDescription(activeCard.description || "");
                            setIsEditingDescription(false);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => setIsEditingDescription(true)}
                      className="cursor-pointer bg-slate-850 hover:bg-slate-800 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300 min-h-[60px] whitespace-pre-wrap transition"
                    >
                      {activeCard.description || "Clique para adicionar uma descrição detalhada a este cartão..."}
                    </div>
                  )}
                </div>

                {/* Checklist Trello com Barra de Progresso Verde */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                      Lista de Verificação (Checklist)
                    </h4>
                    <span className="text-xs font-bold text-emerald-400">
                      {cardChecklistStats.percent}%
                    </span>
                  </div>

                  {/* Barra de Progresso Estilo Trello */}
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${cardChecklistStats.percent}%` }}
                    />
                  </div>

                  {/* Itens do Checklist */}
                  <div className="space-y-2">
                    {(activeCard.checklist || []).map((item) => (
                      <div
                        key={item.id}
                        className="group flex items-center justify-between gap-3 bg-slate-850 hover:bg-slate-800 border border-slate-800/80 px-3.5 py-2.5 rounded-xl transition"
                      >
                        <div
                          onClick={() => handleToggleChecklistItem(item.id)}
                          className="flex items-center gap-3 cursor-pointer flex-1"
                        >
                          {item.done ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-500 group-hover:text-slate-400 flex-shrink-0" />
                          )}
                          <span
                            className={`text-xs ${
                              item.done
                                ? "line-through text-slate-500 font-medium"
                                : "text-slate-200"
                            }`}
                          >
                            {item.text}
                          </span>
                        </div>

                        <button
                          onClick={() => handleDeleteChecklistItem(item.id)}
                          className="text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition p-1"
                          title="Remover item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Adicionar Item ao Checklist */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={newChecklistText}
                      onChange={(e) => setNewChecklistText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddChecklistItem();
                        }
                      }}
                      placeholder="Adicionar um item de verificação..."
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={handleAddChecklistItem}
                      disabled={!newChecklistText.trim()}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow transition"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>

                {/* Seção Power-Ups Vinculados Diretamente a Este Cartão */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-amber-400" />
                    Conexões & Power-Ups do Cartão
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Equipamento CMDB */}
                    <div className="bg-slate-850 border border-slate-800 rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                        <span className="flex items-center gap-1.5">
                          <Server className="w-3.5 h-3.5 text-amber-400" /> Ativo CMDB
                        </span>
                        {activeCard.asset && (
                          <button
                            onClick={() => handleLinkAssetToCard(null)}
                            className="text-[10px] text-rose-400 hover:underline"
                          >
                            Desvincular
                          </button>
                        )}
                      </div>

                      {activeCard.asset ? (
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                          <div className="text-xs font-bold text-white line-clamp-1">{activeCard.asset.name}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Tag: <span className="font-mono text-amber-400">{activeCard.asset.asset_tag || "S/N"}</span> • {activeCard.asset.type}
                          </div>
                        </div>
                      ) : (
                        <select
                          onChange={(e) => handleLinkAssetToCard(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                        >
                          <option value="">Vincular equipamento...</option>
                          {allAssetsList.map((ast) => (
                            <option key={ast.id} value={ast.id}>
                              [{ast.asset_tag || "S/T"}] {ast.name} ({ast.type})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Chamado Helpdesk */}
                    <div className="bg-slate-850 border border-slate-800 rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                        <span className="flex items-center gap-1.5">
                          <Ticket className="w-3.5 h-3.5 text-rose-400" /> Chamado Helpdesk
                        </span>
                      </div>

                      {activeCard.ticket ? (
                        <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                          <div className="text-xs font-bold text-white line-clamp-1">
                            #{activeCard.ticket.id} — {activeCard.ticket.title}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Status: <span className="text-rose-400 font-semibold">{activeCard.ticket.status}</span> • Prioridade: {activeCard.ticket.priority}
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500 italic py-1">
                          Nenhum chamado de suporte atrelado a este cartão.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Comentários e Histórico do Cartão */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-400" />
                    Atividade & Comentários
                  </h4>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={cardCommentText}
                      onChange={(e) => setCardCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handlePostComment();
                        }
                      }}
                      placeholder="Escreva um comentário neste cartão..."
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={handlePostComment}
                      disabled={sendingCardComment || !cardCommentText.trim()}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow transition flex items-center gap-1.5"
                    >
                      <Send className="w-3 h-3" />
                      Enviar
                    </button>
                  </div>
                </div>
              </div>

              {/* Lado Direito: Ações Laterais estilo Trello */}
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Ações do Cartão
                  </span>

                  <div className="space-y-2">
                    {/* Botão Bloquear / Desbloquear */}
                    <button
                      onClick={handleToggleCardBlocked}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                        activeCard.is_blocked
                          ? "bg-rose-600/20 border-rose-500 text-rose-300 hover:bg-rose-600/30"
                          : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200"
                      }`}
                    >
                      <Ban className="w-3.5 h-3.5 text-rose-400" />
                      {activeCard.is_blocked ? "Desbloquear Cartão" : "Marcar como Bloqueado"}
                    </button>

                    {/* Mover para Concluído */}
                    <button
                      onClick={() => handleChangeCardStatus("Concluído")}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-emerald-950/40 border border-slate-700 hover:border-emerald-600 text-slate-200 hover:text-emerald-300 text-xs font-semibold transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Mover para Concluído
                    </button>

                    {/* Excluir Cartão */}
                    <button
                      onClick={handleDeleteCard}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 border border-slate-700 hover:border-rose-700 text-slate-400 hover:text-rose-300 text-xs font-semibold transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir Cartão
                    </button>
                  </div>
                </div>

                {/* Informações de Criação */}
                <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <div>Criado em: {new Date(activeCard.created_at).toLocaleDateString("pt-BR")}</div>
                  {activeCard.completed_at && (
                    <div className="text-emerald-400 font-semibold">
                      Concluído em: {new Date(activeCard.completed_at).toLocaleDateString("pt-BR")}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CRIAR NOVO QUADRO DE PROJETO                                    */}
      {/* ========================================================================= */}
      {isNewBoardModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400">
                  <LayoutGrid className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Criar Novo Quadro de Projeto</h3>
                  <p className="text-xs text-slate-400">Organize tarefas, equipe e equipamentos da TI</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewBoardModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBoard} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Título do Quadro / Projeto *
                </label>
                <input
                  type="text"
                  required
                  value={newBoardForm.title}
                  onChange={(e) => setNewBoardForm({ ...newBoardForm, title: e.target.value })}
                  placeholder="Ex: Upgrade de Switches Core e Distribuição"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Categoria
                  </label>
                  <select
                    value={newBoardForm.category}
                    onChange={(e) => setNewBoardForm({ ...newBoardForm, category: e.target.value })}
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
                    Prioridade
                  </label>
                  <select
                    value={newBoardForm.priority}
                    onChange={(e) => setNewBoardForm({ ...newBoardForm, priority: e.target.value })}
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
                  Descrição do Objetivo
                </label>
                <textarea
                  rows={3}
                  value={newBoardForm.description}
                  onChange={(e) => setNewBoardForm({ ...newBoardForm, description: e.target.value })}
                  placeholder="Escopo geral, benefícios para a operação e resultados esperados..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewBoardModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingBoard}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition"
                >
                  {creatingBoard ? "Criando..." : "Criar Quadro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: GESTÃO DE EQUIPE DO QUADRO                                      */}
      {/* ========================================================================= */}
      {isMembersModalOpen && activeBoard && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Equipe Técnica do Quadro</h3>
              </div>
              <button onClick={() => setIsMembersModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Adicionar Membro */}
            <div className="flex gap-2">
              <select
                value={selectedMemberToAdd}
                onChange={(e) => setSelectedMemberToAdd(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Selecione um técnico da TI...</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.display_name} ({u.role})
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddBoardMember}
                disabled={!selectedMemberToAdd}
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold transition"
              >
                Adicionar
              </button>
            </div>

            {/* Membros Atuais */}
            <div className="space-y-2 max-h-60 overflow-y-auto pt-2">
              {(activeBoard.members || []).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between bg-slate-850 p-2.5 rounded-xl border border-slate-800"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                      {m.display_name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{m.display_name}</div>
                      <div className="text-[10px] text-slate-400">{m.email || m.role}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveBoardMember(m.id)}
                    className="text-slate-500 hover:text-rose-400 p-1"
                    title="Remover do quadro"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {(activeBoard.members || []).length === 0 && (
                <div className="text-xs text-slate-500 text-center py-4">Nenhum membro vinculado ainda.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: POWER-UP ATIVOS CMDB DO QUADRO                                  */}
      {/* ========================================================================= */}
      {isAssetsModalOpen && activeBoard && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Equipamentos & Ativos (CMDB)</h3>
                  <p className="text-xs text-slate-400">Ativos físicos ou lógicos envolvidos neste projeto</p>
                </div>
              </div>
              <button onClick={() => setIsAssetsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Busca para Vincular Novo Ativo */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300 block">Vincular Novo Equipamento</span>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={assetSearchQuery}
                  onChange={(e) => setAssetSearchQuery(e.target.value)}
                  placeholder="Pesquisar por nome, patrimônio ou modelo..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {assetSearchQuery && (
                <div className="max-h-40 overflow-y-auto bg-slate-950 border border-slate-800 rounded-lg divide-y divide-slate-800">
                  {availableAssetsToLink.slice(0, 5).map((a) => (
                    <div
                      key={a.id}
                      className="p-2 flex items-center justify-between hover:bg-slate-800/60 transition"
                    >
                      <div>
                        <div className="text-xs font-bold text-white">{a.name}</div>
                        <div className="text-[10px] text-slate-400">
                          [{a.asset_tag || "Sem Tag"}] • {a.type} • {a.location_name || "Sem local"}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          handleLinkBoardAsset(a.id);
                          setAssetSearchQuery("");
                        }}
                        className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold"
                      >
                        Vincular
                      </button>
                    </div>
                  ))}
                  {availableAssetsToLink.length === 0 && (
                    <div className="p-3 text-xs text-slate-500 text-center">Nenhum equipamento encontrado.</div>
                  )}
                </div>
              )}
            </div>

            {/* Lista dos Ativos já Vinculados */}
            <div className="flex-1 overflow-y-auto space-y-2 pt-2">
              <span className="text-xs font-semibold text-slate-300 block">
                Equipamentos Vinculados ({(activeBoard.assets || []).length})
              </span>
              {(activeBoard.assets || []).map((ast) => (
                <div
                  key={ast.id}
                  className="flex items-center justify-between bg-slate-850 p-3 rounded-xl border border-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{ast.name}</div>
                      <div className="text-[10px] text-slate-400">
                        Tag: <span className="font-mono text-amber-300">{ast.asset_tag || "S/T"}</span> • {ast.type} • {ast.model || "Modelo padrão"}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnlinkBoardAsset(ast.id)}
                    className="text-slate-500 hover:text-rose-400 p-1"
                    title="Desvincular do quadro"
                  >
                    <Unlink className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {(activeBoard.assets || []).length === 0 && (
                <div className="text-xs text-slate-500 text-center py-6">Nenhum ativo associado a este projeto.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: POWER-UP CHAMADOS DO QUADRO                                     */}
      {/* ========================================================================= */}
      {isTicketsModalOpen && activeBoard && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-rose-400" />
                <h3 className="text-sm font-bold text-white">Chamados Vinculados</h3>
              </div>
              <button onClick={() => setIsTicketsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Vincular Chamado por ID */}
            <div className="flex gap-2">
              <input
                type="number"
                value={ticketSearchId}
                onChange={(e) => setTicketSearchId(e.target.value)}
                placeholder="Número ID do Chamado (Ex: 104)..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
              <button
                onClick={handleLinkBoardTicket}
                disabled={!ticketSearchId.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold transition"
              >
                Vincular
              </button>
            </div>

            {/* Chamados Vinculados */}
            <div className="flex-1 overflow-y-auto space-y-2 pt-2">
              {(activeBoard.tickets || []).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between bg-slate-850 p-3 rounded-xl border border-slate-800"
                >
                  <div>
                    <div className="text-xs font-bold text-white">
                      #{t.id} — {t.title}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Status: <span className="text-rose-400 font-semibold">{t.status}</span> • Prioridade: {t.priority}
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnlinkBoardTicket(t.id)}
                    className="text-slate-500 hover:text-rose-400 p-1"
                    title="Desvincular chamado"
                  >
                    <Unlink className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {(activeBoard.tickets || []).length === 0 && (
                <div className="text-xs text-slate-500 text-center py-6">Nenhum chamado vinculado.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: AUTOMAÇÃO BUTLER (Regras Ativas do Trello)                     */}
      {/* ========================================================================= */}
      {isButlerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400">
                <Zap className="w-5 h-5 animate-pulse" />
                <h3 className="text-base font-bold text-white">Automações Ativas (Butler)</h3>
              </div>
              <button onClick={() => setIsButlerModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 bg-slate-850 border border-slate-800 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" /> Regra 1: Carimbo de Conclusão Automática
                </div>
                <p className="text-xs text-slate-300">
                  Quando um cartão for arrastado para a coluna <strong>"Concluído"</strong>, a data de finalização é registrada e o progresso do quadro é recalculado instantaneamente.
                </p>
              </div>

              <div className="p-3.5 bg-slate-850 border border-slate-800 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
                  <CheckSquare className="w-4 h-4" /> Regra 2: Checklist 100% Completo
                </div>
                <p className="text-xs text-slate-300">
                  Ao marcar todos os subitens de verificação de um cartão, a borda do cartão ganha destaque verde indicando prontidão para entrega.
                </p>
              </div>

              <div className="p-3.5 bg-slate-850 border border-slate-800 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-400">
                  <AlertTriangle className="w-4 h-4" /> Regra 3: Alerta de Impedimento (Bloqueio)
                </div>
                <p className="text-xs text-slate-300">
                  Ao marcar uma atividade como bloqueada, um badge vermelho piscante é acionado e o evento é inserido no log de auditoria do projeto.
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

      {/* ========================================================================= */}
      {/* MODAL 6: LINHA DO TEMPO / HISTÓRICO COMPLETO DO QUADRO                   */}
      {/* ========================================================================= */}
      {isTimelineModalOpen && activeBoard && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-indigo-400">
                <History className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">Linha do Tempo de Atividades</h3>
              </div>
              <button onClick={() => setIsTimelineModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {(activeBoard.timeline || []).map((ev) => (
                <div key={ev.id} className="p-3 bg-slate-850 border border-slate-800 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-semibold text-white">{ev.author?.display_name || "Sistema"}</span>
                    <span>{new Date(ev.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  <p className="text-xs text-slate-200">{ev.content}</p>
                </div>
              ))}
              {(activeBoard.timeline || []).length === 0 && (
                <div className="text-xs text-slate-500 text-center py-6">Nenhum evento registrado ainda.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
