import { useState, useEffect, useMemo, useRef } from "react";
import { 
  BookOpen, Search, Plus, RefreshCw, ThumbsUp, ThumbsDown, 
  Eye, Tag, ChevronRight, ArrowLeft, Printer, Edit3, Trash2, 
  HelpCircle, Ticket, Monitor, Activity, Server, X, 
  ShieldCheck, Clock, Sparkles, Layers, Check, AlertCircle, FileText,
  Camera, Image as ImageIcon, UploadCloud, Copy, ExternalLink, CheckCircle, AlertTriangle, Info,
  ZoomIn, Download, Settings, Wifi, Phone, Database, LifeBuoy, Terminal, FolderPlus
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import knowledgeBaseApi from "../../api/knowledgeBase";

// Mapeamento dinâmico de ícones disponíveis
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
  Phone,
  Wifi,
  Database,
  Settings,
  LifeBuoy,
  Terminal,
};

const AVAILABLE_ICONS = [
  "HelpCircle", "Ticket", "Monitor", "Activity", "Server", 
  "BookOpen", "ShieldCheck", "Layers", "FileText", "Phone", 
  "Wifi", "Database", "Settings", "LifeBuoy", "Terminal"
];

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

  // Modal de Criação / Edição de Artigo / Tutorial
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
    attachments: [],
    is_published: true,
  });
  const [savingArticle, setSavingArticle] = useState(false);
  const [editorTab, setEditorTab] = useState("write"); // 'write' ou 'preview'
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Modal de Gestão de Categorias
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    slug: "",
    icon: "BookOpen",
    description: "",
    min_role: "technician",
    order_index: 0,
    is_active: true,
  });
  const [savingCategory, setSavingCategory] = useState(false);

  // Lightbox Modal para Zoom em Telas e Imagens
  const [lightboxImage, setLightboxImage] = useState(null);
  const [copiedCodeIndex, setCopiedCodeIndex] = useState(null);

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
    if (!window.confirm("Deseja sincronizar e atualizar os artigos e categorias padrão do sistema?")) return;
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

  // ─── GESTÃO DE ARTIGOS ──────────────────────────────────────────

  const handleOpenCreateArticle = () => {
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
      attachments: [],
      is_published: true,
    });
    setEditorTab("write");
    setIsEditorOpen(true);
  };

  const handleOpenEditArticle = (article) => {
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
      attachments: Array.isArray(article.attachments) ? article.attachments : [],
      is_published: article.is_published !== false,
    });
    setEditorTab("write");
    setIsEditorOpen(true);
  };

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
        attachments: editorForm.attachments || [],
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

  const handleDeleteArticle = async (articleId) => {
    if (!window.confirm("Tem certeza que deseja excluir permanentemente este procedimento?")) return;
    try {
      await knowledgeBaseApi.deleteArticle(articleId);
      if (activeArticle?.id === articleId) {
        setActiveArticle(null);
      }
      await loadData();
    } catch (err) {
      console.error("Erro ao excluir artigo:", err);
      alert("Erro ao excluir artigo: " + (err.response?.data?.detail || err.message));
    }
  };

  // ─── UPLOAD DE TELAS / PRINTS ───────────────────────────────────

  const handleUploadAttachment = async (file, insertAtCursor = false) => {
    if (!file) return;
    try {
      setUploadingMedia(true);
      const res = await knowledgeBaseApi.uploadMedia(file);
      const newAttachment = {
        url: res.url,
        filename: res.filename,
        size: res.size,
        uploaded_at: new Date().toISOString(),
      };

      setEditorForm((prev) => {
        const updatedAttachments = [...(prev.attachments || []), newAttachment];
        let updatedContent = prev.content;

        if (insertAtCursor) {
          const textarea = textareaRef.current;
          const cleanTitle = res.filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
          const imgMarkdown = `\n\n![${cleanTitle}](${res.url})\n*Legenda: ${cleanTitle}*\n\n`;
          if (textarea) {
            const start = textarea.selectionStart || updatedContent.length;
            const end = textarea.selectionEnd || updatedContent.length;
            updatedContent =
              updatedContent.substring(0, start) +
              imgMarkdown +
              updatedContent.substring(end);
          } else {
            updatedContent += imgMarkdown;
          }
        }

        return {
          ...prev,
          attachments: updatedAttachments,
          content: updatedContent,
        };
      });
    } catch (err) {
      console.error("Erro no upload de tela:", err);
      alert("Falha ao enviar imagem: " + (err.response?.data?.detail || err.message));
    } finally {
      setUploadingMedia(false);
    }
  };

  // Intercepta Ctrl+V no textarea para upload instantâneo de prints da área de transferência
  const handleEditorPaste = async (e) => {
    const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          await handleUploadAttachment(file, true);
        }
        break;
      }
    }
  };

  // Inserir tag Markdown de anexo no conteúdo
  const handleInsertAttachmentTag = (att) => {
    const textarea = textareaRef.current;
    const cleanTitle = att.filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
    const imgMarkdown = `\n\n![${cleanTitle}](${att.url})\n*Legenda: ${cleanTitle}*\n\n`;
    
    setEditorForm((prev) => {
      let updatedContent = prev.content;
      if (textarea) {
        const start = textarea.selectionStart || updatedContent.length;
        const end = textarea.selectionEnd || updatedContent.length;
        updatedContent =
          updatedContent.substring(0, start) +
          imgMarkdown +
          updatedContent.substring(end);
      } else {
        updatedContent += imgMarkdown;
      }
      return { ...prev, content: updatedContent };
    });
  };

  // Remover anexo da lista do artigo
  const handleRemoveAttachment = (attUrl) => {
    setEditorForm((prev) => ({
      ...prev,
      attachments: (prev.attachments || []).filter((a) => a.url !== attUrl),
    }));
  };

  // Inserções rápidas na barra de formatação Markdown
  const handleInsertFormat = (prefix, suffix = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = editorForm.content.substring(start, end) || "texto";
    const replacement = `${prefix}${selectedText}${suffix}`;

    const newContent =
      editorForm.content.substring(0, start) +
      replacement +
      editorForm.content.substring(end);

    setEditorForm((prev) => ({ ...prev, content: newContent }));

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 50);
  };

  // ─── GESTÃO DE CATEGORIAS ───────────────────────────────────────

  const handleOpenCategoriesModal = () => {
    setEditingCategory(null);
    setCategoryForm({
      name: "",
      slug: "",
      icon: "BookOpen",
      description: "",
      min_role: "technician",
      order_index: categories.length + 1,
      is_active: true,
    });
    setIsCategoryModalOpen(true);
  };

  const handleEditCategory = (cat) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name || "",
      slug: cat.slug || "",
      icon: cat.icon || "BookOpen",
      description: cat.description || "",
      min_role: cat.min_role || "technician",
      order_index: cat.order_index || 0,
      is_active: cat.is_active !== false,
    });
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      alert("Por favor informe o nome da categoria.");
      return;
    }

    try {
      setSavingCategory(true);
      const payload = {
        name: categoryForm.name.trim(),
        icon: categoryForm.icon,
        description: categoryForm.description.trim(),
        min_role: categoryForm.min_role,
        order_index: parseInt(categoryForm.order_index) || 0,
        is_active: categoryForm.is_active,
      };

      if (editingCategory) {
        await knowledgeBaseApi.updateCategory(editingCategory.id, payload);
      } else {
        await knowledgeBaseApi.createCategory(payload);
      }

      setEditingCategory(null);
      setCategoryForm({
        name: "",
        slug: "",
        icon: "BookOpen",
        description: "",
        min_role: "technician",
        order_index: categories.length + 1,
        is_active: true,
      });

      await loadData();
    } catch (err) {
      console.error("Erro ao salvar categoria:", err);
      alert("Falha ao salvar categoria: " + (err.response?.data?.detail || err.message));
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (catId) => {
    if (!window.confirm("Atenção: excluir esta categoria também removerá seus artigos vinculados. Continuar?")) return;
    try {
      await knowledgeBaseApi.deleteCategory(catId);
      if (editingCategory?.id === catId) {
        setEditingCategory(null);
      }
      await loadData();
    } catch (err) {
      console.error("Erro ao excluir categoria:", err);
      alert("Falha ao excluir categoria: " + (err.response?.data?.detail || err.message));
    }
  };

  // Copiar código para clipboard
  const handleCopyCode = (codeText, index) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCodeIndex(index);
    setTimeout(() => setCopiedCodeIndex(null), 2000);
  };

  // ─── FILTRAGEM DOS ARTIGOS ──────────────────────────────────────

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

  // ─── RENDERIZADOR MARKDOWN COM SUPORTE A TELAS E CÓDIGOS ────────

  const renderMarkdown = (text) => {
    if (!text) return null;
    const lines = text.split("\n");
    const elements = [];
    let inCodeBlock = false;
    let codeBuffer = [];
    let codeLang = "";

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const trimmed = line.trim();

      // Bloco de Código (```)
      if (trimmed.startsWith("```")) {
        if (inCodeBlock) {
          // Fechamento de bloco
          const codeString = codeBuffer.join("\n");
          const blockIdx = idx;
          elements.push(
            <div key={`code-${blockIdx}`} className="my-4 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-lg text-slate-100 font-mono text-xs sm:text-sm">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-slate-400 text-xs font-sans">
                <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-300">
                  <Terminal size={14} className="text-blue-400" />
                  {codeLang || "script / comando"}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(codeString, blockIdx)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer text-xs"
                >
                  {copiedCodeIndex === blockIdx ? (
                    <>
                      <Check size={13} className="text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 overflow-x-auto leading-relaxed text-slate-200">
                <code>{codeString}</code>
              </pre>
            </div>
          );
          codeBuffer = [];
          codeLang = "";
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
          codeLang = trimmed.replace("```", "").trim();
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        continue;
      }

      // Imagem / Print de Tela Markdown: ![alt](url)
      const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
      if (imgMatch) {
        const alt = imgMatch[1];
        const url = imgMatch[2];
        elements.push(
          <div key={`img-${idx}`} className="my-6 rounded-2xl overflow-hidden border border-slate-200 bg-slate-900/5 shadow-md group relative">
            <div className="relative overflow-hidden flex items-center justify-center p-2 bg-slate-950/5">
              <img
                src={url}
                alt={alt}
                onClick={() => setLightboxImage({ url, alt })}
                className="max-h-[520px] w-auto max-w-full rounded-xl object-contain cursor-zoom-in group-hover:scale-[1.01] transition-transform duration-200"
                loading="lazy"
              />
              <button
                type="button"
                onClick={() => setLightboxImage({ url, alt })}
                className="absolute top-4 right-4 p-2 bg-slate-900/80 hover:bg-blue-600 text-white rounded-xl shadow-lg backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="Ampliar Tela em Tela Cheia"
              >
                <ZoomIn size={18} />
              </button>
            </div>
            {alt && (
              <div className="px-4 py-2 bg-white border-t border-slate-200 text-center text-xs font-medium text-slate-600 flex items-center justify-center gap-1.5">
                <ImageIcon size={13} className="text-blue-500" />
                <span>{alt}</span>
                <span className="text-slate-400 text-[11px]">(clique para ampliar)</span>
              </div>
            )}
          </div>
        );
        continue;
      }

      // Títulos
      if (trimmed.startsWith("# ")) {
        elements.push(
          <h1 key={idx} className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-8 pb-2 border-b border-slate-200">
            {trimmed.replace("# ", "")}
          </h1>
        );
        continue;
      }
      if (trimmed.startsWith("## ")) {
        elements.push(
          <h2 key={idx} className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-6 mb-2">
            {trimmed.replace("## ", "")}
          </h2>
        );
        continue;
      }
      if (trimmed.startsWith("### ")) {
        elements.push(
          <h3 key={idx} className="text-lg font-bold text-slate-900 mt-5 mb-1.5">
            {trimmed.replace("### ", "")}
          </h3>
        );
        continue;
      }

      // Alertas e Destaques
      if (trimmed.startsWith("> ")) {
        const textAlert = trimmed.replace("> ", "");
        const isWarning = textAlert.includes("[AVISO]") || textAlert.includes("[ALERTA]") || textAlert.includes("Atenção");
        const isSuccess = textAlert.includes("[DICA]") || textAlert.includes("[SUCESSO]");
        const isDanger = textAlert.includes("[PERIGO]") || textAlert.includes("[ERRO]");

        let alertClasses = "bg-blue-50/80 border-blue-600 text-blue-950";
        let AlertIcon = Info;
        if (isWarning) {
          alertClasses = "bg-amber-50/80 border-amber-500 text-amber-950";
          AlertIcon = AlertTriangle;
        } else if (isSuccess) {
          alertClasses = "bg-emerald-50/80 border-emerald-500 text-emerald-950";
          AlertIcon = CheckCircle;
        } else if (isDanger) {
          alertClasses = "bg-rose-50/80 border-rose-600 text-rose-950";
          AlertIcon = AlertCircle;
        }

        elements.push(
          <div key={idx} className={`p-4 my-4 border-l-4 rounded-r-2xl text-sm font-medium flex items-start gap-3 shadow-sm ${alertClasses}`}>
            <AlertIcon size={18} className="shrink-0 mt-0.5 text-current opacity-80" />
            <div className="leading-relaxed">{textAlert}</div>
          </div>
        );
        continue;
      }

      // Listas
      if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
        elements.push(
          <li key={idx} className="ml-6 list-disc text-sm sm:text-base text-slate-700 py-0.5">
            {trimmed.replace(/^[\*\-]\s+/, "")}
          </li>
        );
        continue;
      }
      if (/^\d+\.\s/.test(trimmed)) {
        elements.push(
          <li key={idx} className="ml-6 list-decimal text-sm sm:text-base text-slate-700 py-0.5">
            {trimmed.replace(/^\d+\.\s+/, "")}
          </li>
        );
        continue;
      }

      // Separador
      if (trimmed === "---") {
        elements.push(<hr key={idx} className="my-6 border-slate-200" />);
        continue;
      }

      // Linha em branco
      if (!trimmed) {
        elements.push(<div key={idx} className="h-1.5" />);
        continue;
      }

      // Parágrafo com suporte a código inline e links
      elements.push(
        <p key={idx} className="text-sm sm:text-base text-slate-700 leading-relaxed">
          {trimmed}
        </p>
      );
    }

    return <div className="space-y-2">{elements}</div>;
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
              Tutoriais ilustrados com telas, procedimentos ITIL (N1, N2, N3), topologias e onboarding com permissões dinâmicas por perfil.
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
                  onClick={handleOpenCategoriesModal}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800/90 hover:bg-slate-700 text-slate-100 hover:text-white rounded-2xl text-xs sm:text-sm font-bold border border-slate-600 transition-all cursor-pointer shadow-sm"
                  title="Gerenciar Categorias da Base"
                >
                  <FolderPlus size={16} className="text-blue-400" />
                  <span>Categorias ({categories.length})</span>
                </button>
              </>
            )}

            {(isAdmin || isTechnician) && (
              <button
                type="button"
                onClick={handleOpenCreateArticle}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 hover:scale-105 transition-all cursor-pointer"
              >
                <Plus size={18} />
                <span>Novo Tutorial</span>
              </button>
            )}
          </div>
        </div>

        {/* Barra de Busca Dinâmica */}
        <div className="relative mt-6 max-w-3xl">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquise por procedimentos, termos, erros, sintomas ou tags (ex: TV UH, loop STP, biometria, senha)..."
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
        /* Visualização Detalhada do Artigo (Leitor) */
        <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200 space-y-8 animate-fadeIn">
          {/* Navegação Superior */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <button
              type="button"
              onClick={() => setActiveArticle(null)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold transition-colors cursor-pointer"
            >
              <ArrowLeft size={16} />
              <span>Voltar para Lista de Procedimentos</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="p-2 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                title="Imprimir Tutorial"
              >
                <Printer size={18} />
              </button>
              {(isAdmin || isTechnician) && (
                <button
                  type="button"
                  onClick={() => handleOpenEditArticle(activeArticle)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Edit3 size={15} />
                  <span>Editar Tutorial</span>
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleDeleteArticle(activeArticle.id)}
                  className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors cursor-pointer"
                  title="Excluir Tutorial"
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

              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold border border-slate-200">
                Público: {activeArticle.target_role === "requester" ? "Colaborador" : activeArticle.target_role === "technician" ? "Técnico TI" : "Admin"}
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
              {activeArticle.title}
            </h1>

            {activeArticle.summary && (
              <p className="text-slate-600 text-base sm:text-lg leading-relaxed bg-slate-50 p-4 rounded-2xl border-l-4 border-blue-500 font-medium">
                {activeArticle.summary}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 text-xs text-slate-500 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-4">
                <span>Autor: <strong className="text-slate-700">{activeArticle.author_name}</strong></span>
                <span>Atualizado em: {new Date(activeArticle.updated_at).toLocaleDateString("pt-BR")}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><Eye size={14} /> {activeArticle.views_count} visualizações</span>
                <span className="flex items-center gap-1 text-emerald-600 font-bold"><ThumbsUp size={14} /> {activeArticle.helpful_count}</span>
              </div>
            </div>
          </div>

          {/* Conteúdo Renderizado do Tutorial */}
          <div className="pt-2">
            {renderMarkdown(activeArticle.content)}
          </div>

          {/* Galeria de Telas & Evidências Anexadas (se houver anexos) */}
          {activeArticle.attachments && activeArticle.attachments.length > 0 && (
            <div className="mt-10 pt-8 border-t border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                <Camera size={18} className="text-blue-600" />
                <h3 className="text-lg font-black text-slate-900">
                  Telas e Evidências deste Procedimento ({activeArticle.attachments.length})
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {activeArticle.attachments.map((att, attIdx) => (
                  <div
                    key={attIdx}
                    onClick={() => setLightboxImage({ url: att.url, alt: att.filename })}
                    className="group relative bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-blue-400 transition-all cursor-zoom-in"
                  >
                    <div className="h-32 bg-slate-900/5 flex items-center justify-center p-2">
                      <img src={att.url} alt={att.filename} className="h-full w-full object-contain rounded-lg" loading="lazy" />
                    </div>
                    <div className="p-2.5 bg-white border-t border-slate-100">
                      <p className="text-xs font-bold text-slate-800 truncate">{att.filename}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Clique para ampliar tela</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {activeArticle.tags && activeArticle.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-4">
              <Tag size={14} className="text-slate-400" />
              {activeArticle.tags.map((tag, tIdx) => (
                <span key={tIdx} className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold">
                  #{tag}
                </span>
              ))}
            </div>
          )}

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
              <RefreshCw className="animate-spin text-blue-500 mx-auto mb-3" size={32} />
              <p className="text-slate-500 text-sm font-medium">Carregando base de conhecimento...</p>
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-4">
              <BookOpen className="text-slate-300 mx-auto" size={48} />
              <div>
                <h3 className="font-extrabold text-slate-800 text-base">Nenhum procedimento encontrado</h3>
                <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
                  Tente ajustar os filtros de categoria, nível ou termo de pesquisa.
                </p>
              </div>
              {(isAdmin || isTechnician) && (
                <button
                  type="button"
                  onClick={handleOpenCreateArticle}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer hover:bg-blue-500"
                >
                  <Plus size={16} />
                  <span>Criar Novo Tutorial</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredArticles.map((art) => (
                <div
                  key={art.id}
                  onClick={() => handleOpenArticle(art)}
                  className="bg-white rounded-3xl p-6 border border-slate-200 hover:border-blue-400 hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-blue-600 uppercase tracking-wider truncate flex items-center gap-1">
                        <FileText size={12} />
                        {art.category_name}
                      </span>
                      {art.support_level !== "ALL" && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
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

                    {art.attachments && art.attachments.length > 0 && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold">
                        <Camera size={12} className="text-blue-600" />
                        <span>{art.attachments.length} tela(s) anexada(s)</span>
                      </div>
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

      {/* ─── MODAL EDITOR DE ARTIGO / TUTORIAL ───────────────────────── */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header Modal */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Edit3 size={18} className="text-blue-600" />
                  {editingArticle ? "Editar Procedimento / Tutorial" : "Novo Artigo / Tutorial"}
                </h3>
                <p className="text-xs text-slate-500">
                  Crie guias passo a passo, anexe telas e configure permissões de acesso.
                </p>
              </div>

              <div className="flex items-center gap-3">
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
                        Título do Tutorial *
                      </label>
                      <input
                        type="text"
                        required
                        value={editorForm.title}
                        onChange={(e) => setEditorForm({ ...editorForm, title: e.target.value })}
                        placeholder="Ex: Como Configurar Ramal SIP no Gero"
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
                            {c.name} ({c.min_role})
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
                        <option value="N3">N3 (Infra / Redes / Servidores)</option>
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
                        placeholder="Ex: tv, sky, voip, unifi"
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
                      placeholder="Descrição em uma frase do objetivo deste tutorial..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Barra de Formatação & Upload de Telas */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-100 rounded-2xl border border-slate-200">
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleInsertFormat("# ", "")}
                          className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-extrabold cursor-pointer"
                          title="Título Principal"
                        >
                          H1
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertFormat("## ", "")}
                          className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-extrabold cursor-pointer"
                          title="Subtítulo"
                        >
                          H2
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertFormat("**", "**")}
                          className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                          title="Negrito"
                        >
                          B
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertFormat("* ", "")}
                          className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                          title="Lista"
                        >
                          • Lista
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertFormat("1. ", "")}
                          className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                          title="Lista Numerada"
                        >
                          1. Num
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertFormat("> [DICA] ", "")}
                          className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                          title="Alerta / Dica"
                        >
                          &gt; Dica
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertFormat("```bash\n", "\n```")}
                          className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                          title="Bloco de Código"
                        >
                          &lt;/&gt; Código
                        </button>
                      </div>

                      {/* Botão de Anexo de Tela / Imagem */}
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleUploadAttachment(e.target.files[0], true);
                              e.target.value = "";
                            }
                          }}
                        />
                        <button
                          type="button"
                          disabled={uploadingMedia}
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50"
                        >
                          <Camera size={14} />
                          <span>{uploadingMedia ? "Enviando..." : "Anexar Tela / Print"}</span>
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <textarea
                        ref={textareaRef}
                        required
                        rows={13}
                        value={editorForm.content}
                        onPaste={handleEditorPaste}
                        onChange={(e) => setEditorForm({ ...editorForm, content: e.target.value })}
                        placeholder="# Título Principal&#10;&#10;Dica: você pode tirar um Print da Tela (PrtScn) e colar (Ctrl+V) diretamente aqui dentro para anexar a imagem automaticamente!&#10;&#10;## 1. Passo Inicial&#10;* Conecte o cabo...&#10;&#10;> [DICA] Salve a configuração antes de reiniciar."
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {uploadingMedia && (
                        <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center rounded-2xl">
                          <div className="flex items-center gap-2 text-blue-600 font-bold text-sm bg-white px-4 py-2 rounded-xl shadow-lg border border-slate-100">
                            <RefreshCw size={18} className="animate-spin" />
                            <span>Enviando captura de tela e inserindo Markdown...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Galeria de Telas Anexadas ao Tutorial */}
                  {editorForm.attachments && editorForm.attachments.length > 0 && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <ImageIcon size={14} className="text-blue-500" />
                          Telas Anexadas a este Tutorial ({editorForm.attachments.length})
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Clique em &quot;Inserir&quot; para colocar no texto
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {editorForm.attachments.map((att, aIdx) => (
                          <div key={aIdx} className="bg-white border border-slate-200 rounded-xl p-2 relative group shadow-2xs">
                            <div className="h-24 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center mb-2">
                              <img src={att.url} alt={att.filename} className="h-full w-full object-contain" />
                            </div>
                            <p className="text-[11px] font-bold text-slate-800 truncate" title={att.filename}>
                              {att.filename}
                            </p>
                            <div className="flex items-center justify-between gap-1 mt-2">
                              <button
                                type="button"
                                onClick={() => handleInsertAttachmentTag(att)}
                                className="flex-1 py-1 px-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold rounded-md transition-colors cursor-pointer"
                              >
                                Inserir no Texto
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveAttachment(att.url)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                                title="Remover tela"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Aba de Pré-visualização */
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 min-h-[350px]">
                  <h2 className="text-2xl font-black text-slate-900 mb-2">{editorForm.title || "Sem Título"}</h2>
                  {editorForm.summary && <p className="text-sm text-slate-600 italic mb-6">{editorForm.summary}</p>}
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
                  {savingArticle ? "Salvando..." : "Salvar Tutorial"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL DE GESTÃO DE CATEGORIAS (ADMIN) ─────────────────── */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <FolderPlus size={20} className="text-blue-600" />
                  Gerenciador de Categorias da Base
                </h3>
                <p className="text-xs text-slate-500">
                  Crie, edite e organize os agrupamentos de manuais e procedimentos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Formulário de Adicionar / Editar */}
              <form onSubmit={handleSaveCategory} className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  {editingCategory ? <Edit3 size={15} /> : <Plus size={15} />}
                  {editingCategory ? `Editando: ${editingCategory.name}` : "Adicionar Nova Categoria"}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nome da Categoria *</label>
                    <input
                      type="text"
                      required
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      placeholder="Ex: Telefonia IP & Ramais"
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Público Mínimo (Role)</label>
                    <select
                      value={categoryForm.min_role}
                      onChange={(e) => setCategoryForm({ ...categoryForm, min_role: e.target.value })}
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="requester">Solicitante (Público Geral)</option>
                      <option value="technician">Técnico de TI (N1/N2/N3)</option>
                      <option value="admin">Administrador (Exclusivo)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Descrição Explicativa</label>
                  <input
                    type="text"
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    placeholder="Breve resumo sobre quais assuntos entram nesta categoria..."
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Seletor Visual de Ícones */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Ícone Ilustrativo</label>
                  <div className="flex flex-wrap items-center gap-2">
                    {AVAILABLE_ICONS.map((iconKey) => {
                      const IconComp = ICON_MAP[iconKey] || BookOpen;
                      const isSelected = categoryForm.icon === iconKey;
                      return (
                        <button
                          key={iconKey}
                          type="button"
                          onClick={() => setCategoryForm({ ...categoryForm, icon: iconKey })}
                          className={`p-2 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-500/30 scale-105"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                          }`}
                          title={iconKey}
                        >
                          <IconComp size={16} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  {editingCategory && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategory(null);
                        setCategoryForm({
                          name: "",
                          slug: "",
                          icon: "BookOpen",
                          description: "",
                          min_role: "technician",
                          order_index: categories.length + 1,
                          is_active: true,
                        });
                      }}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-white text-xs font-bold cursor-pointer"
                    >
                      Cancelar Edição
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={savingCategory}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {savingCategory ? "Salvando..." : editingCategory ? "Atualizar Categoria" : "Cadastrar Categoria"}
                  </button>
                </div>
              </form>

              {/* Tabela de Categorias Existentes */}
              <div className="space-y-3">
                <h4 className="text-sm font-black text-slate-800">Categorias Cadastradas ({categories.length})</h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  {categories.map((cat) => {
                    const IconComp = ICON_MAP[cat.icon] || BookOpen;
                    return (
                      <div key={cat.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold shrink-0">
                            <IconComp size={18} />
                          </div>
                          <div>
                            <h5 className="font-bold text-sm text-slate-900 leading-tight">{cat.name}</h5>
                            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-md">{cat.description || "Sem descrição"}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">
                            {cat.min_role === "requester" ? "Colaborador" : cat.min_role === "technician" ? "Técnico" : "Admin"}
                          </span>
                          <span className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-bold">
                            {cat.articles_count || 0} artigos
                          </span>
                          <button
                            type="button"
                            onClick={() => handleEditCategory(cat)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Editar Categoria"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                            title="Excluir Categoria"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── LIGHTBOX MODAL PARA ZOOM DE TELAS ─────────────────────── */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-60 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-fadeIn cursor-zoom-out"
        >
          <div className="absolute top-4 right-4 flex items-center gap-3 z-10" onClick={(e) => e.stopPropagation()}>
            <a
              href={lightboxImage.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 bg-slate-800 hover:bg-blue-600 text-white rounded-xl shadow-lg transition-colors"
              title="Abrir em Nova Aba"
            >
              <ExternalLink size={20} />
            </a>
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="p-2.5 bg-slate-800 hover:bg-red-600 text-white rounded-xl shadow-lg transition-colors cursor-pointer"
              title="Fechar (Esc)"
            >
              <X size={20} />
            </button>
          </div>

          <div className="max-w-5xl max-h-[85vh] p-2 flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.alt || "Captura de Tela"}
              className="max-h-[80vh] w-auto max-w-full rounded-2xl shadow-2xl object-contain border border-slate-700"
            />
            {lightboxImage.alt && (
              <p className="mt-3 text-slate-300 text-sm font-semibold text-center bg-slate-900/80 px-4 py-1.5 rounded-full border border-slate-700">
                {lightboxImage.alt}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
