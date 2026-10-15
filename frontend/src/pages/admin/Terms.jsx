import { useState, useEffect } from "react";
import { 
  FileText, Plus, Search, Filter, RefreshCw, 
  CheckCircle2, Clock, RotateCcw, AlertCircle, Eye, 
  UserCheck, ShieldCheck, Camera, Headphones, Radio, 
  Smartphone, Laptop, Key, Package, Building2, ChevronRight, X, Sparkles,
  LayoutGrid, List, Download, ArrowDownToLine, Calendar, User
} from "lucide-react";
import api from "../../api/client";
import NewTermModal from "../../components/admin/terms/NewTermModal";
import SignTermModal from "../../components/admin/terms/SignTermModal";
import ViewTermModal from "../../components/admin/terms/ViewTermModal";
import TermTemplatesTab from "../../components/admin/terms/TermTemplatesTab";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export default function Terms() {
  const [terms, setTerms] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending_signature: 0, signed: 0, returned: 0, cancelled: 0 });
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Abas Principais ("terms" = Termos Emitidos, "templates" = Modelos de Documentos)
  const [activeMainTab, setActiveMainTab] = useState("terms");

  // Modo de Visualização: 'grid' (cards touch) ou 'table' (tabela clássica)
  const [viewMode, setViewMode] = useState(() => {
    return typeof window !== "undefined" && window.innerWidth < 1024 ? "grid" : "table";
  });

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(() => {
    try {
      return localStorage.getItem("terms_pwa_banner_dismissed") === "true";
    } catch {
      return false;
    }
  });

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  // Modais
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState(null);

  // Detecção de PWA e instalação
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (
        window.matchMedia("(display-mode: standalone)").matches || 
        window.navigator.standalone === true ||
        document.referrer.includes("android-app://")
      ) {
        setIsStandalone(true);
      }

      const handler = (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setIsInstallable(true);
      };

      const installedHandler = () => {
        setIsStandalone(true);
        setIsBannerDismissed(true);
        try {
          localStorage.setItem("terms_pwa_banner_dismissed", "true");
        } catch {}
      };

      window.addEventListener("beforeinstallprompt", handler);
      window.addEventListener("appinstalled", installedHandler);
      return () => {
        window.removeEventListener("beforeinstallprompt", handler);
        window.removeEventListener("appinstalled", installedHandler);
      };
    }
  }, []);

  const handleDismissBanner = () => {
    setIsBannerDismissed(true);
    try {
      localStorage.setItem("terms_pwa_banner_dismissed", "true");
    } catch {}
  };

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstallable(false);
        handleDismissBanner();
      }
      setDeferredPrompt(null);
    } else {
      // Dica para iOS/Safari
      alert(
        "📱 Para instalar no iPad ou iPhone:\n1. Toque no botão 'Compartilhar' (ícone de quadrado com seta para cima no Safari)\n2. Role para baixo e selecione 'Adicionar à Tela de Início'."
      );
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (departmentFilter) params.department_id = departmentFilter;
      if (searchTerm) params.search = searchTerm;

      const [termsRes, statsRes, deptsRes] = await Promise.all([
        api.get("/terms", { params }),
        api.get("/terms/stats"),
        api.get("/departments"),
      ]);

      setTerms(termsRes.data || []);
      setStats(statsRes.data || { total: 0, pending_signature: 0, signed: 0, returned: 0, cancelled: 0 });
      setDepartments(deptsRes.data || []);
    } catch (err) {
      console.error("Erro ao carregar termos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, departmentFilter]);

  // Debounce para busca textual
  useEffect(() => {
    const handler = setTimeout(() => {
      loadData();
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleOpenSign = (term) => {
    setSelectedTerm(term);
    setIsSignModalOpen(true);
  };

  const handleOpenView = (term) => {
    setSelectedTerm(term);
    setIsViewModalOpen(true);
  };

  const handleSaveAndSignNew = (newTerm) => {
    setIsNewModalOpen(false);
    setSelectedTerm(newTerm);
    setIsSignModalOpen(true);
    loadData();
  };

  const getItemIcon = (name) => {
    const lower = name.toLowerCase();
    if (lower.includes("fone")) return <Headphones size={13} className="text-blue-500 shrink-0" />;
    if (lower.includes("rádio") || lower.includes("radio")) return <Radio size={13} className="text-amber-500 shrink-0" />;
    if (lower.includes("celular")) return <Smartphone size={13} className="text-emerald-500 shrink-0" />;
    if (lower.includes("notebook")) return <Laptop size={13} className="text-purple-500 shrink-0" />;
    if (lower.includes("chave")) return <Key size={13} className="text-orange-500 shrink-0" />;
    return <Package size={13} className="text-slate-500 shrink-0" />;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "signed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200">
            <CheckCircle2 size={12} />
            Assinado & Entregue
          </span>
        );
      case "pending_signature":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-200">
            <Clock size={12} />
            Aguardando Assinatura
          </span>
        );
      case "returned":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-200">
            <RotateCcw size={12} />
            Devolvido / Baixado
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full border border-slate-200">
            Cancelado
          </span>
        );
      default:
        return <span className="text-xs font-bold text-slate-600">{status}</span>;
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      
      {/* Banner PWA de Instalação no Aparelho (Tablet / Smartphone) */}
      {!isStandalone && !isBannerDismissed && (
        <div className="relative bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-4 sm:p-5 text-white shadow-xl shadow-blue-950/20 flex flex-col sm:flex-row items-center justify-between gap-4 border border-blue-800/40">
          <div className="flex items-center gap-3.5 w-full sm:w-auto">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center shrink-0 text-blue-300">
              <Smartphone size={24} />
            </div>
            <div className="pr-8 sm:pr-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold tracking-tight">Aplicativo Termos TIHFSA</span>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full border border-blue-400/30">PWA Tablet & Mobile</span>
              </div>
              <p className="text-xs text-blue-200/80 mt-0.5">
                Instale no iPad, tablet Android ou celular para coletar assinaturas e fotos com câmera nativa sem barras de navegador.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleInstallPWA}
              className="w-full sm:w-auto px-5 py-2.5 bg-white text-blue-900 hover:bg-blue-50 font-black text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 active:scale-95"
            >
              <ArrowDownToLine size={16} />
              {isInstallable ? "Instalar no Aparelho" : "Como Instalar no Aparelho"}
            </button>
            <button
              type="button"
              onClick={handleDismissBanner}
              className="p-2 text-blue-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              title="Dispensar aviso"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0">
              <FileText size={22} />
            </div>
            <span>Termos de Retirada</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gestão digital 100% sem papel com assinatura em tela e reconhecimento facial na entrega
          </p>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-500/25 transition-all cursor-pointer min-h-[44px]"
        >
          <Plus size={18} />
          Novo Termo de Retirada
        </button>
      </div>

      {/* Sub-Navegação de Abas */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveMainTab("terms")}
          className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
            activeMainTab === "terms"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <FileText size={16} />
          Termos Emitidos
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-black ${
            activeMainTab === "terms" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
          }`}>
            {stats.total}
          </span>
        </button>

        <button
          onClick={() => setActiveMainTab("templates")}
          className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer shrink-0 ${
            activeMainTab === "templates"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Sparkles size={16} className={activeMainTab === "templates" ? "text-amber-300" : "text-amber-500"} />
          Modelos de Documentos (Builder Word)
        </button>
      </div>

      {activeMainTab === "templates" ? (
        <TermTemplatesTab />
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold shrink-0">
                <FileText size={22} />
              </div>
              <div>
                <p className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Total</p>
                <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{stats.total}</p>
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-amber-200/80 shadow-sm flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
                <Clock size={22} />
              </div>
              <div>
                <p className="text-[11px] sm:text-xs font-bold text-amber-600 uppercase tracking-wider">Aguardando</p>
                <p className="text-xl sm:text-2xl font-black text-amber-700 mt-0.5">{stats.pending_signature}</p>
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-emerald-200/80 shadow-sm flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <p className="text-[11px] sm:text-xs font-bold text-emerald-600 uppercase tracking-wider">Assinados</p>
                <p className="text-xl sm:text-2xl font-black text-emerald-700 mt-0.5">{stats.signed}</p>
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-blue-200/80 shadow-sm flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                <RotateCcw size={22} />
              </div>
              <div>
                <p className="text-[11px] sm:text-xs font-bold text-blue-600 uppercase tracking-wider">Devolvidos</p>
                <p className="text-xl sm:text-2xl font-black text-blue-700 mt-0.5">{stats.returned}</p>
              </div>
            </div>
          </div>

          {/* Barra de Filtros, Busca e Alternância de Visualização */}
          <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search size={18} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nome, setor, termo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
              {/* Filtro Status */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 sm:flex-none bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[42px]"
              >
                <option value="">Todos os Status</option>
                <option value="pending_signature">⏳ Aguardando Assinatura</option>
                <option value="signed">✓ Assinados & Ativos</option>
                <option value="returned">🔄 Devolvidos / Baixados</option>
                <option value="cancelled">Cancelados</option>
              </select>

              {/* Filtro Setor */}
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="flex-1 sm:flex-none bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[42px]"
              >
                <option value="">Todos os Setores</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              {/* Botões de Alternância Grid vs Tabela */}
              <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded-xl transition-all cursor-pointer ${
                    viewMode === "grid" 
                      ? "bg-white text-blue-600 shadow-sm font-bold" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="Modo Cards Touch (Tablet / Smartphone)"
                >
                  <LayoutGrid size={18} />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-2 rounded-xl transition-all cursor-pointer ${
                    viewMode === "table" 
                      ? "bg-white text-blue-600 shadow-sm font-bold" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="Modo Tabela Clássica"
                >
                  <List size={18} />
                </button>
              </div>

              <button
                onClick={loadData}
                title="Recarregar"
                className="p-2.5 text-slate-500 hover:text-blue-600 rounded-2xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer min-h-[42px] min-w-[42px] flex items-center justify-center"
              >
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* LISTAGEM DE TERMOS: LOADING / VAZIO / CARDS OU TABELA */}
          {loading && terms.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center text-slate-400 shadow-sm">
              <RefreshCw size={36} className="animate-spin mx-auto mb-3 text-blue-500" />
              <p className="text-sm font-bold text-slate-700">Carregando termos de responsabilidade...</p>
              <p className="text-xs text-slate-400 mt-1">Buscando registros e validações biométricas</p>
            </div>
          ) : terms.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center text-slate-400 shadow-sm">
              <FileText size={48} className="mx-auto mb-3 text-slate-300" />
              <p className="text-base font-bold text-slate-700">Nenhum termo encontrado</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Clique em "Novo Termo de Retirada" para cadastrar a entrega de equipamentos para colaboradores.
              </p>
            </div>
          ) : viewMode === "grid" ? (
            /* VISUALIZAÇÃO EM CARDS TOUCH (TABLET / CELULAR / DESKTOP RESPONSIVO) */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
              {terms.map((t) => (
                <div
                  key={t.id}
                  className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-blue-300 transition-all p-5 flex flex-col justify-between gap-4 group"
                >
                  {/* Topo do Card: Número do Termo e Badge de Status */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="font-mono font-black text-xs text-blue-700 bg-blue-50 px-3 py-1 rounded-xl border border-blue-200">
                        {t.term_number}
                      </span>
                      {getStatusBadge(t.status)}
                    </div>

                    {/* Informações do Colaborador */}
                    <div className="flex items-start gap-3 mt-2">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
                        {t.beneficiary_name?.slice(0, 2).toUpperCase() || "CL"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold text-slate-900 text-base leading-snug truncate">
                          {t.beneficiary_name}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1 text-slate-600 font-semibold truncate">
                            <Building2 size={13} className="text-slate-400 shrink-0" />
                            {t.department_name || "Geral"}
                          </span>
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                            t.has_ad_account 
                              ? "bg-slate-100 text-slate-700" 
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}>
                            {t.has_ad_account ? "AD" : "Externo"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Equipamentos Entregues */}
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Itens no Termo ({t.items?.length || 0})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {t.items?.slice(0, 4).map((item, i) => (
                          <span 
                            key={i} 
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold"
                          >
                            {getItemIcon(item.item_name)}
                            <span className="truncate max-w-[120px]">{item.item_name}</span>
                            {item.quantity > 1 && <strong className="text-blue-600">x{item.quantity}</strong>}
                          </span>
                        ))}
                        {t.items?.length > 4 && (
                          <span className="px-2 py-1 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold">
                            +{t.items.length - 4} mais
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Detalhes de Emissão e Biometria */}
                    <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-400" />
                        <span>{formatDate(t.created_at)}</span>
                      </div>
                      <div>
                        {t.facial_verified ? (
                          <span 
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200"
                            title="Rosto validado e foto registrada"
                          >
                            <Camera size={12} />
                            Facial OK
                          </span>
                        ) : t.signature_url ? (
                          <span 
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200"
                            title="Assinatura manuscrita registrada"
                          >
                            <UserCheck size={12} />
                            Assinado
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            Pendente
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ações Touch Ergonômicas (Mínimo 44px de altura) */}
                  <div className="pt-2 flex items-center gap-2">
                    {t.status === "pending_signature" ? (
                      <>
                        <button
                          onClick={() => handleOpenSign(t)}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-extrabold rounded-2xl shadow-md shadow-blue-500/25 transition-all cursor-pointer min-h-[44px]"
                        >
                          <UserCheck size={16} />
                          Assinar no Aparelho
                        </button>
                        <button
                          onClick={() => handleOpenView(t)}
                          className="p-3 text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-2xl transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="Visualizar Termo / Dossiê"
                        >
                          <Eye size={18} />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleOpenView(t)}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-slate-700 text-xs font-bold rounded-2xl border border-slate-200 transition-all cursor-pointer min-h-[44px]"
                      >
                        <Eye size={16} />
                        Visualizar Termo & Biometria
                      </button>
                    )}
                  </div>

                </div>
              ))}
            </div>
          ) : (
            /* VISUALIZAÇÃO EM TABELA CLÁSSICA */
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-500 font-bold text-xs uppercase tracking-wider border-b border-slate-200">
                      <th className="py-4 px-6">Termo</th>
                      <th className="py-4 px-6">Colaborador / Setor</th>
                      <th className="py-4 px-6">Equipamentos Entregues</th>
                      <th className="py-4 px-6">Técnico Emissor</th>
                      <th className="py-4 px-6">Data</th>
                      <th className="py-4 px-6">Biometria</th>
                      <th className="py-4 px-6">Status</th>
                      <th className="py-4 px-6 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {terms.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                        
                        {/* Número do Termo */}
                        <td className="py-4 px-6">
                          <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                            {t.term_number}
                          </span>
                        </td>

                        {/* Beneficiário e Setor */}
                        <td className="py-4 px-6">
                          <div className="min-w-[180px]">
                            <p className="font-bold text-slate-900 leading-tight">{t.beneficiary_name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-slate-500 flex items-center gap-1">
                                <Building2 size={12} className="text-slate-400" />
                                {t.department_name || "Geral"}
                              </span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                t.has_ad_account 
                                  ? "bg-slate-100 text-slate-600" 
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}>
                                {t.has_ad_account ? "AD" : "Externo"}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Itens Entregues */}
                        <td className="py-4 px-6">
                          <div className="flex flex-wrap gap-1.5 max-w-[260px]">
                            {t.items?.slice(0, 3).map((item, i) => (
                              <span 
                                key={i} 
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-medium"
                              >
                                {getItemIcon(item.item_name)}
                                <span className="truncate max-w-[100px]">{item.item_name}</span>
                                {item.quantity > 1 && <strong className="text-blue-600">x{item.quantity}</strong>}
                              </span>
                            ))}
                            {t.items?.length > 3 && (
                              <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded-md text-[10px] font-bold">
                                +{t.items.length - 3}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Técnico Emissor */}
                        <td className="py-4 px-6 text-xs text-slate-600 font-medium">
                          {t.technician_name}
                        </td>

                        {/* Data */}
                        <td className="py-4 px-6 text-xs text-slate-500 whitespace-nowrap">
                          {formatDate(t.created_at)}
                        </td>

                        {/* Evidências / Biometria Facial */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          {t.facial_verified ? (
                            <span 
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200"
                              title="Rosto validado e foto registrada"
                            >
                              <Camera size={12} />
                              Facial OK
                            </span>
                          ) : t.signature_url ? (
                            <span 
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200"
                              title="Apenas assinatura manuscrita"
                            >
                              <UserCheck size={12} />
                              Assinado
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              Pendente
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          {getStatusBadge(t.status)}
                        </td>

                        {/* Ações */}
                        <td className="py-4 px-6 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {t.status === "pending_signature" && (
                              <button
                                onClick={() => handleOpenSign(t)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
                                title="Abrir no tablet para o colaborador assinar"
                              >
                                <UserCheck size={14} />
                                Assinar no Tablet
                              </button>
                            )}

                            <button
                              onClick={() => handleOpenView(t)}
                              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                              title="Visualizar Termo / Imprimir A4"
                            >
                              <Eye size={18} />
                            </button>
                          </div>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAIS */}
      <NewTermModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={loadData}
        onSaveAndSign={handleSaveAndSignNew}
      />

      <SignTermModal
        term={selectedTerm}
        isOpen={isSignModalOpen}
        onClose={() => { setIsSignModalOpen(false); setSelectedTerm(null); }}
        onSuccess={loadData}
      />

      <ViewTermModal
        term={selectedTerm}
        isOpen={isViewModalOpen}
        onClose={() => { setIsViewModalOpen(false); setSelectedTerm(null); }}
        onOpenSign={handleOpenSign}
        onSuccess={loadData}
      />

    </div>
  );
}
