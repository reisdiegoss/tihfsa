import { useState, useEffect } from "react";
import {
  FileText, Plus, Search, Edit3, Trash2, CheckCircle2,
  Clock, Upload, Copy, Sparkles, Filter, ChevronRight,
  Headphones, Radio, Smartphone, Laptop, Key, Layers, Eye
} from "lucide-react";
import api from "../../../api/client";
import WordRibbonEditor from "./WordRibbonEditor";

export default function TermTemplatesTab() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Estado do Editor Ribbon
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const res = await api.get("/terms/templates");
      setTemplates(res.data || []);
    } catch (err) {
      console.error("Erro ao carregar modelos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (tmpl) => {
    setEditingTemplate(tmpl);
    setIsEditorOpen(true);
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Tem certeza que deseja excluir o modelo "${title}"?`)) return;

    try {
      await api.delete(`/terms/templates/${id}`);
      loadTemplates();
    } catch (err) {
      console.error("Erro ao excluir modelo:", err);
      alert("Falha ao excluir modelo: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleSaveTemplate = async (templateData) => {
    if (editingTemplate?.id) {
      await api.put(`/terms/templates/${editingTemplate.id}`, templateData);
    } else {
      await api.post("/terms/templates", templateData);
    }
    setIsEditorOpen(false);
    setEditingTemplate(null);
    loadTemplates();
  };

  const getCategoryIcon = (cat) => {
    const lower = (cat || "").toLowerCase();
    if (lower.includes("comunica") || lower.includes("rádio") || lower.includes("ht")) {
      return <Radio size={16} className="text-amber-500" />;
    }
    if (lower.includes("telefonia") || lower.includes("celular")) {
      return <Smartphone size={16} className="text-emerald-500" />;
    }
    if (lower.includes("notebook") || lower.includes("computa")) {
      return <Laptop size={16} className="text-blue-500" />;
    }
    if (lower.includes("acesso") || lower.includes("chave") || lower.includes("segurança")) {
      return <Key size={16} className="text-purple-500" />;
    }
    return <FileText size={16} className="text-slate-500" />;
  };

  const categories = ["all", "Geral", "Comunicação", "Telefonia", "Notebook", "Acesso e Segurança"];

  const filteredTemplates = templates.filter((t) => {
    const matchesCat = selectedCategory === "all" || t.category === selectedCategory;
    const matchesSearch =
      !searchTerm ||
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Sparkles size={20} className="text-amber-500" />
            Modelos de Documentos & Builder Word
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Crie novos modelos visuais com barra de ferramentas estilo Word, importe arquivos .docx ou configure tags dinâmicas
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-2xl shadow-lg shadow-blue-500/25 transition-all cursor-pointer hover:shadow-none"
          >
            <Plus size={16} />
            Novo Modelo (Editor Word)
          </button>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        {/* Categorias Pills */}
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                selectedCategory === cat
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              {cat === "all" ? "Todos os Modelos" : cat}
            </button>
          ))}
        </div>

        {/* Input de Busca */}
        <div className="relative w-full md:w-72">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar modelo..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-sm"
          />
        </div>
      </div>

      {/* Grid de Modelos */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 text-slate-400">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-semibold mt-3">Carregando modelos de termos...</span>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <FileText size={28} />
          </div>
          <h3 className="text-base font-bold text-slate-800">Nenhum modelo encontrado</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Não encontramos nenhum modelo nesta categoria ou busca. Crie um novo modelo usando nosso editor Word ou importe um .docx.
          </p>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition-all cursor-pointer"
          >
            Criar Primeiro Modelo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTemplates.map((template) => {
            let defaultItems = [];
            try {
              defaultItems = JSON.parse(template.default_items || "[]");
            } catch {
              defaultItems = [];
            }

            return (
              <div
                key={template.id}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-5">
                  {/* Header do Card */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold">
                      {getCategoryIcon(template.category)}
                      {template.category}
                    </span>

                    <span className="text-[11px] text-slate-400 font-medium">
                      Atualizado em {new Date(template.updated_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>

                  {/* Título & Descrição */}
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                    {template.title}
                  </h3>

                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {template.description || "Sem descrição informada para este modelo de documento."}
                  </p>

                  {/* Badges de recursos */}
                  <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Layers size={11} className="text-blue-500" />
                      {defaultItems.length} {defaultItems.length === 1 ? "item padrão" : "itens padrão"}
                    </span>
                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Sparkles size={11} />
                      Tags Dinâmicas
                    </span>
                  </div>
                </div>

                {/* Footer do Card com Ações */}
                <div className="bg-slate-50/80 px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => setPreviewTemplate(template)}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                  >
                    <Eye size={13} />
                    Prévia A4
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(template)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                      title="Editar no Ribbon Word"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(template.id, template.title)}
                      className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                      title="Excluir Modelo"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DO EDITOR RIBBON ESTILO WORD */}
      {isEditorOpen && (
        <WordRibbonEditor
          initialTitle={editingTemplate?.title || ""}
          initialCategory={editingTemplate?.category || "Geral"}
          initialDescription={editingTemplate?.description || ""}
          initialHtml={editingTemplate?.content_html || ""}
          initialDefaultItems={editingTemplate?.default_items || "[]"}
          onSave={handleSaveTemplate}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingTemplate(null);
          }}
        />
      )}

      {/* MODAL DE PRÉVIA RÁPIDA A4 */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-100 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-300">
            {/* Header da Prévia */}
            <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{previewTemplate.title}</h3>
                  <p className="text-xs text-slate-500">Visualização fiel no formato de folha A4</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const t = previewTemplate;
                    setPreviewTemplate(null);
                    handleOpenEdit(t);
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 size={13} />
                  Abrir no Editor
                </button>
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Folha A4 */}
            <div className="flex-1 overflow-auto p-6 flex justify-center bg-slate-200/90">
              <div
                className="w-full max-w-[210mm] bg-white p-8 sm:p-12 shadow-xl border border-slate-300 text-slate-900"
                dangerouslySetInnerHTML={{ __html: previewTemplate.content_html }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
