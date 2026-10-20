import { useState, useEffect, useMemo } from "react";
import { 
  BookOpen, Search, Plus, RefreshCw, ThumbsUp, ThumbsDown, 
  Eye, Tag, ChevronRight, ArrowLeft, Printer, Edit3, Trash2, 
  HelpCircle, Ticket, Monitor, Activity, Server, X, 
  ShieldCheck, Clock, Sparkles, Layers, Check, AlertCircle, FileText
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import knowledgeBaseApi from "../../api/knowledgeBase";

// Mapeamento dinâmico de ícones por nome
const ICON_MAP = {
  HelpCircle,
  Ticket,
  Monitor,
  Activity,
  Server,
  BookOpen,
  ShieldCheck,
  Layers,
  FileText,
};

export default function KnowledgeBase() {
  const { user, isAdmin, isTechnician } = useAuth();

  const [categories, setCategories] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedLevel, setSelectedLevel] = useState("ALL");
  const [selectedRole, setSelectedRole] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeArticle, setActiveArticle] = useState(null);
  const [feedbackGiven, setFeedbackGiven] = useState({});

  // Modal de Criação / Edição de Artigo
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [editorForm, setEditorForm] = useState({
    title: "",
    slug: "",
    category_id: "",
    summary: "",
    content: "",
    target_role: "technician",
    support_level: "ALL",
    tags: "",
    is_published: true,
  });
  const [savingArticle, setSavingArticle] = useState(false);
  const [editorTab, setEditorTab] = useState("write"); // 'write' ou 'preview'

  // Carregar Categorias e Artigos
  const loadData = async () => {
    try {
      setLoading(true);
      const [catsData, artsData] = await Promise.all([
        knowledgeBaseApi.getCategories(),
        knowledgeBaseApi.getArticles(),
      ]);
      setCategories(catsData || []);
      setArticles(artsData || []);
    } catch (err) {
      console.error("Erro ao carregar dados da Base de Conhecimento:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Abrir artigo específico por slug ou ID
  const handleOpenArticle = async (articleSummary) => {
    try {
      const fullArt = await knowledgeBaseApi.getArticle(articleSummary.slug || articleSummary.id);
      setActiveArticle(fullArt);
      // Atualizar views_count na lista local
      setArticles((prev) =>
        prev.map((a) => (a.id === fullArt.id ? { ...a, views_count: fullArt.views_count } : a))
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Erro ao abrir artigo:", err);
    }
  };

  // Feedback (Útil / Não Útil)
  const handleFeedback = async (articleId, isHelpful) => {
    if (feedbackGiven[articleId]) return;
    try {
      const res = await knowledgeBaseApi.sendFeedback(articleId, isHelpful);
      setFeedbackGiven((prev) => ({ ...prev, [articleId]: isHelpful ? "helpful" : "unhelpful" }));
      if (activeArticle && activeArticle.id === articleId) {
        setActiveArticle((prev) => ({
          ...prev,
          helpful_count: res.helpful_count,
          unhelpful_count: res.unhelpful_count,
        }));
      }
    } catch (err) {
      console.error("Erro ao enviar feedback:", err);
    }
  };

  // Sincronizar Seed Padrão (Admin)
  const handleSyncSeed = async () => {
    if (!window.confirm("Deseja sincronizar e atualizar os artigos padrão do sistema?")) return;
    try {
      setLoading(true);
      await knowledgeBaseApi.triggerSeed(true);
      await loadData();
      alert("Base de Conhecimento sincronizada com sucesso!");
    } catch (err) {
      console.error("Erro ao sincronizar seed:", err);
      alert("Falha ao sincronizar artigos.");
    } finally {
      setLoading(false);
    }
  };

  // Abrir modal de criação
  const handleOpenCreate = () => {
    setEditingArticle(null);
    setEditorForm({
      title: "",
      slug: "",
      category_id: categories[0]?.id || "",
      summary: "",
      content: "",
      target_role: "technician",
      support_level: "ALL",
      tags: "",
      is_published: true,
    });
    setEditorTab("write");
    setIsEditorOpen(true);
  };

  // Abrir modal de edição
  const handleOpenEdit = (article) => {
    setEditingArticle(article);
    setEditorForm({
      title: article.title || "",
      slug: article.slug || "",
      category_id: article.category_id || categories[0]?.id || "",
      summary: article.summary || "",
      content: article.content || "",
      target_role: article.target_role || "technician",
      support_level: article.support_level || "ALL",
      tags: Array.isArray(article.tags) ? article.tags.join(", ") : "",
      is_published: article.is_published !== false,
    });
    setEditorTab("write");
    setIsEditorOpen(true);
  };

  // Salvar artigo (Criar ou Atualizar)
  const handleSaveArticle = async (e) => {
    e.preventDefault();
    if (!editorForm.title.trim() || !editorForm.content.trim()) {
      alert("Por favor preencha o título e o conteúdo.");
      return;
    }

    try {
      setSavingArticle(true);
      const tagsArray = editorForm.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        title: editorForm.title.trim(),
        category_id: parseInt(editorForm.category_id),
        summary: editorForm.summary.trim(),
        content: editorForm.content.trim(),
        target_role: editorForm.target_role,
        support_level: editorForm.support_level,
        tags: tagsArray,
        is_published: editorForm.is_published,
      };

      if (editingArticle) {
        const updated = await knowledgeBaseApi.updateArticle(editingArticle.id, payload);
        setActiveArticle(updated);
      } else {
        await knowledgeBaseApi.createArticle(payload);
      }

      setIsEditorOpen(false);
      await loadData();
    } catch (err) {
      console.error("Erro ao salvar artigo:", err);
      alert("Erro ao salvar artigo: " + (err.response?.data?.detail || err.message));
    } finally {
      setSavingArticle(false);
    }
  };

  // Excluir Artigo (Admin)
  const handleDeleteArticle = async (articleId) => {
    if (!window.confirm("Tem certeza que deseja excluir permanentemente este artigo?")) return;
    try {
      await knowledgeBaseApi.deleteArticle(articleId);
      if (activeArticle?.id === articleId) {
        setActiveArticle(null);
      }
      await loadData();
    } catch (err) {
      console.error("Erro ao excluir artigo:", err);
      alert("Erro ao excluir artigo.");
    }
  };

  // Filtragem dos Artigos
  const filteredArticles = useMemo(() => {
    return articles.filter((art) => {
      // Filtro de Categoria
      if (selectedCategory !== "all" && String(art.category_id) !== String(selectedCategory)) {
        return false;
      }
      // Filtro de Nível de Suporte (N1, N2, N3)
      if (selectedLevel !== "ALL") {
        if (art.support_level !== "ALL" && art.support_level !== selectedLevel) {
          return false;
        }
      }
      // Filtro de Role
      if (selectedRole !== "ALL" && art.target_role !== selectedRole) {
        return false;
      }
      // Busca Textual
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inTitle = (art.title || "").toLowerCase().includes(q);
        const inSummary = (art.summary || "").toLowerCase().includes(q);
        const inTags = (art.tags || []).some((t) => (t || "").toLowerCase().includes(q));
        if (!inTitle && !inSummary && !inTags) return false;
      }
      return true;
    });
  }, [articles, selectedCategory, selectedLevel, selectedRole, searchQuery]);

  // Renderizador simplificado de Markdown (para não depender de libs pesadas adicionais)
  const renderMarkdown = (text) => {
    if (!text) return null;
    const lines = text.split("\n");
    return (
      <div className="prose prose-slate max-w-none space-y-4 text-slate-700 leading-relaxed">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (trimmed.startsWith("# ")) {
            return (
              <h1 key={idx} className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-6 pb-2 border-b border-slate-200">
                {trimmed.replace("# ", "")}
              </h1>
            );
          }
          if (trimmed.startsWith("## ")) {
            return (
              <h2 key={idx} className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-6 mb-2">
                {trimmed.replace("## ", "")}
              </h2>
            );
          }
          if (trimmed.startsWith("### ")) {
            return (
              <h3 key={idx} className="text-lg font-bold text-slate-900 mt-4 mb-1">
                {trimmed.replace("### ", "")}
              </h3>
            );
          }
          if (trimmed.startsWith("> ")) {
            return (
              <div key={idx} className="p-4 my-3 bg-blue-50/70 border-l-4 border-blue-600 rounded-r-2xl text-blue-900 text-sm font-medium">
                {trimmed.replace("> ", "")}
              </div>
            );
          }
          if (trimmed.startsWith("```")) {
            return null; // Trata blocos de código
          }
          if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
            return (
              <li key={idx} className="ml-5 list-disc text-sm sm:text-base">
                {trimmed.replace(/^[\*\-]\s+/, "")}
              </li>
            );
          }
          if (/^\d+\.\s/.test(trimmed)) {
            return (
              <li key={idx} className="ml-5 list-decimal text-sm sm:text-base">
                {trimmed.replace(/^\d+\.\s+/, "")}
              </li>
            );
          }
          if (trimmed === "---") {
            return <hr key={idx} className="my-6 border-slate-200" />;
          }
          if (!trimmed) {
            return <div key={idx} className="h-1" />;
          }
          return (
            <p key={idx} className="text-sm sm:text-base text-slate-700">
              {trimmed}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header com Visual NOC/Helpdesk Premium */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-700/50">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-500/30">
              <Sparkles size={14} className="text-blue-400" />
              <span>Base de Conhecimento & Procedimentos (TIHFSA)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <BookOpen className="text-blue-400" size={32} />
              Central de Conhecimento & Onboarding
            </h1>
            <p className="text-slate-300 text-sm sm:text-base max-w-2xl leading-relaxed">
              Manuais operacionais, procedimentos ITIL (N1, N2, N3), arquitetura de UHs, topologias e guias de implantação com controle por perfil de acesso.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={handleSyncSeed}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white rounded-2xl text-xs sm:text-sm font-bold border border-slate-600 transition-all cursor-pointer shadow-sm"
                  title="Sincronizar artigos padrão"
                >
                  <RefreshCw size={16} />
                  <span>Sincronizar Padrões</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 hover:scale-105 transition-all cursor-pointer"
                >
                  <Plus size={18} />
                  <span>Novo Artigo</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Barra de Busca Dinâmica */}
        <div className="relative mt-6 max-w-3xl">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquise por procedimentos, termos, erros, sintomas ou tags (ex: TV UH, loop STP, biometria)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-10 py-3.5 bg-slate-950/60 border border-slate-700 rounded-2xl text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-md transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Seção Principal: Lista de Artigos OU Leitor do Artigo Ativo */}
      {activeArticle ? (
        /* Visualização Detalhada do Artigo */
        <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200 space-y-8 animate-fadeIn">
          {/* Navegação Superior */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <button
              type="button"
              onClick={() => setActiveArticle(null)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold transition-colors cursor-pointer"
            >
              <ArrowLeft size={16} />
              <span>Voltar para Lista de Procedimentos</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="p-2 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                title="Imprimir Artigo"
              >
                <Printer size={18} />
              </button>
              {(isAdmin || isTechnician) && (
                <button
                  type="button"
                  onClick={() => handleOpenEdit(activeArticle)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Edit3 size={15} />
                  <span>Editar</span>
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleDeleteArticle(activeArticle.id)}
                  className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors cursor-pointer"
                  title="Excluir Artigo"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Cabeçalho do Artigo */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-bold text-xs border border-blue-200 flex items-center gap-1.5">
                <FileText size={13} />
                {activeArticle.category_name}
              </span>

              {activeArticle.support_level !== "ALL" && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase ${
                    activeArticle.support_level === "N1"
                      ? "bg-sky-100 text-sky-800 border border-sky-300"
                      : activeArticle.support_level === "N2"
                      ? "bg-purple-100 text-purple-800 border border-purple-300"
                      : "bg-rose-100 text-rose-800 border border-rose-300"
                  }`}
                >
                  Tier {activeArticle.support_level}
                </span>
              )}

              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold uppercase">
                {activeArticle.target_role === "requester"
                  ? "Autoatendimento"
                  : activeArticle.target_role === "technician"
                  ? "Técnico"
                  : "Administrador"}
              </span>

              <div className="ml-auto text-xs text-slate-400 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Eye size={14} /> {activeArticle.views_count} visualizações
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={14} /> Atualizado em{" "}
                  {new Date(activeArticle.updated_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
              {activeArticle.title}
            </h1>

            {activeArticle.summary && (
              <p className="text-slate-600 text-base sm:text-lg italic border-l-4 border-slate-300 pl-4 py-1">
                {activeArticle.summary}
              </p>
            )}

            {/* Tags */}
            {activeArticle.tags && activeArticle.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2">
                {activeArticle.tags.map((t, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium"
                  >
                    <Tag size={11} className="text-slate-400" />
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Conteúdo Renderizado */}
          <div className="pt-6 border-t border-slate-100">
            {renderMarkdown(activeArticle.content)}
          </div>

          {/* Rodapé de Utilidade / Feedback */}
          <div className="mt-12 pt-8 border-t border-slate-200 bg-slate-50/70 -mx-6 sm:-mx-10 -mb-6 sm:-mb-10 p-6 sm:p-8 rounded-b-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                Este procedimento foi útil para você?
              </h4>
              <p className="text-xs text-slate-500">
                Ajude-nos a manter a base de conhecimento sempre calibrada.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleFeedback(activeArticle.id, true)}
                disabled={Boolean(feedbackGiven[activeArticle.id])}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                  feedbackGiven[activeArticle.id] === "helpful"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                    : "bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border-slate-200"
                }`}
              >
                <ThumbsUp size={16} />
                <span>Sim ({activeArticle.helpful_count || 0})</span>
              </button>

              <button
                type="button"
                onClick={() => handleFeedback(activeArticle.id, false)}
                disabled={Boolean(feedbackGiven[activeArticle.id])}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                  feedbackGiven[activeArticle.id] === "unhelpful"
                    ? "bg-rose-600 text-white border-rose-600 shadow-md"
                    : "bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border-slate-200"
                }`}
              >
                <ThumbsDown size={16} />
                <span>Não ({activeArticle.unhelpful_count || 0})</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Lista e Filtros de Artigos */
        <div className="space-y-6">
          {/* Cards de Categorias */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
                selectedCategory === "all"
                  ? "bg-blue-50 border-blue-400 text-blue-900 shadow-sm ring-2 ring-blue-500/20"
                  : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/50"
              }`}
            >
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-2.5 font-bold">
                <Layers size={18} />
              </div>
              <h3 className="font-extrabold text-sm leading-tight">Todas as Coleções</h3>
              <p className="text-xs text-slate-500 mt-1">{articles.length} procedimentos</p>
            </button>

            {categories.map((cat) => {
              const IconComponent = ICON_MAP[cat.icon] || BookOpen;
              const isSelected = String(selectedCategory) === String(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-blue-50 border-blue-400 text-blue-900 shadow-sm ring-2 ring-blue-500/20"
                      : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2.5 font-bold ${
                      isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    <IconComponent size={18} />
                  </div>
                  <h3 className="font-extrabold text-sm leading-tight truncate">{cat.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">{cat.articles_count || 0} artigos</p>
                </button>
              );
            })}
          </div>

          {/* Filtros de Pílulas: Nível de Atendimento (N1, N2, N3) e Papel */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
                Nível ITIL:
              </span>
              {[
                { label: "Todos os Níveis", val: "ALL" },
                { label: "🟦 N1 (Service Desk)", val: "N1" },
                { label: "🟪 N2 (Avançado)", val: "N2" },
                { label: "🟥 N3 (Infra / Redes)", val: "N3" },
              ].map((lvl) => (
                <button
                  key={lvl.val}
                  type="button"
                  onClick={() => setSelectedLevel(lvl.val)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedLevel === lvl.val
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {lvl.label}
                </button>
              ))}
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
                  Público:
                </span>
                {[
                  { label: "Todos", val: "ALL" },
                  { label: "Solicitante", val: "requester" },
                  { label: "Técnico", val: "technician" },
                  { label: "Admin", val: "admin" },
                ].map((r) => (
                  <button
                    key={r.val}
                    type="button"
                    onClick={() => setSelectedRole(r.val)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedRole === r.val
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Grid de Artigos */}
          {loading ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <RefreshCw className="animate-spin text-blue-600 mx-auto mb-3" size={32} />
              <p className="text-slate-600 font-bold text-sm">Carregando Base de Conhecimento...</p>
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <AlertCircle className="text-slate-300 mx-auto mb-3" size={48} />
              <h3 className="text-lg font-extrabold text-slate-800">Nenhum procedimento encontrado</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
                Não encontramos artigos correspondentes aos filtros ou termo de busca informado. Tente
                limpar a pesquisa.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory("all");
                  setSelectedLevel("ALL");
                  setSelectedRole("ALL");
                  setSearchQuery("");
                }}
                className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-500 cursor-pointer"
              >
                Limpar Todos os Filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredArticles.map((art) => (
                <div
                  key={art.id}
                  onClick={() => handleOpenArticle(art)}
                  className="group bg-white rounded-3xl p-6 border border-slate-200 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/10 transition-all flex flex-col justify-between cursor-pointer relative overflow-hidden"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-[11px] border border-blue-200">
                        {art.category_name || "Geral"}
                      </span>

                      {art.support_level !== "ALL" && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            art.support_level === "N1"
                              ? "bg-sky-100 text-sky-800"
                              : art.support_level === "N2"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          Tier {art.support_level}
                        </span>
                      )}
                    </div>

                    <h3 className="font-extrabold text-base text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                      {art.title}
                    </h3>

                    {art.summary && (
                      <p className="text-slate-500 text-xs sm:text-sm line-clamp-2 leading-relaxed">
                        {art.summary}
                      </p>
                    )}
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Eye size={13} /> {art.views_count}
                      </span>
                      {art.helpful_count > 0 && (
                        <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                          <ThumbsUp size={12} /> {art.helpful_count}
                        </span>
                      )}
                    </div>

                    <span className="font-bold text-blue-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                      Ler manual <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Editor de Artigo (Criação / Edição) */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header Modal */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {editingArticle ? "Editar Procedimento" : "Novo Artigo na Base de Conhecimento"}
                </h3>
                <p className="text-xs text-slate-500">
                  Documente soluções, guias operacionais e procedimentos técnicos.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="bg-slate-100 p-1 rounded-xl flex items-center">
                  <button
                    type="button"
                    onClick={() => setEditorTab("write")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      editorTab === "write" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                    }`}
                  >
                    Escrever
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorTab("preview")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      editorTab === "preview" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                    }`}
                  >
                    Pré-visualizar
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveArticle} className="p-6 overflow-y-auto space-y-4 flex-1">
              {editorTab === "write" ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Título do Procedimento *
                      </label>
                      <input
                        type="text"
                        required
                        value={editorForm.title}
                        onChange={(e) => setEditorForm({ ...editorForm, title: e.target.value })}
                        placeholder="Ex: Como Configurar Ponto de Rede no Gero"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Categoria *
                      </label>
                      <select
                        required
                        value={editorForm.category_id}
                        onChange={(e) => setEditorForm({ ...editorForm, category_id: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Público Alvo (Role)
                      </label>
                      <select
                        value={editorForm.target_role}
                        onChange={(e) => setEditorForm({ ...editorForm, target_role: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="requester">Solicitante (Colaborador / PWA)</option>
                        <option value="technician">Técnico de TI (N1, N2, N3)</option>
                        {isAdmin && <option value="admin">Administrador (TI / Gestão)</option>}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nível de Suporte (ITIL)
                      </label>
                      <select
                        value={editorForm.support_level}
                        onChange={(e) => setEditorForm({ ...editorForm, support_level: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="ALL">Todos os Níveis</option>
                        <option value="N1">N1 (Service Desk / Básico)</option>
                        <option value="N2">N2 (Field Services / Avançado)</option>
                        <option value="N3">N3 (Infraestrutura / Redes / Servidores)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Tags (separadas por vírgula)
                      </label>
                      <input
                        type="text"
                        value={editorForm.tags}
                        onChange={(e) => setEditorForm({ ...editorForm, tags: e.target.value })}
                        placeholder="Ex: tv, sky, gero, rede"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Resumo Breve (Exibido no card)
                    </label>
                    <input
                      type="text"
                      value={editorForm.summary}
                      onChange={(e) => setEditorForm({ ...editorForm, summary: e.target.value })}
                      placeholder="Descrição em uma frase do objetivo deste procedimento..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Conteúdo Completo (Suporta formatação Markdown) *
                    </label>
                    <textarea
                      required
                      rows={14}
                      value={editorForm.content}
                      onChange={(e) => setEditorForm({ ...editorForm, content: e.target.value })}
                      placeholder="# Título Principal&#10;&#10;Descreva o passo a passo com clareza...&#10;&#10;## 1. Passo Inicial&#10;* Item 1&#10;* Item 2&#10;&#10;> Dica importante"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              ) : (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 min-h-[300px]">
                  <h2 className="text-xl font-bold text-slate-900 mb-2">{editorForm.title || "Sem Título"}</h2>
                  <p className="text-xs text-slate-500 italic mb-4">{editorForm.summary}</p>
                  {renderMarkdown(editorForm.content || "_Nenhum conteúdo digitado ainda._")}
                </div>
              )}

              {/* Botões do Rodapé */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingArticle}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
                >
                  {savingArticle ? "Salvando..." : "Salvar Artigo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
