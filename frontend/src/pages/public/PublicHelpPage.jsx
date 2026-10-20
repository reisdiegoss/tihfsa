import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  HelpCircle, Search, ArrowLeft, PlusCircle, CheckCircle2, 
  ThumbsUp, ThumbsDown, BookOpen, ChevronRight, X, Sparkles, FileText, ExternalLink
} from "lucide-react";
import knowledgeBaseApi from "../../api/knowledgeBase";

export default function PublicHelpPage() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [feedbackDone, setFeedbackDone] = useState({});

  useEffect(() => {
    async function fetchHelp() {
      try {
        setLoading(true);
        // Busca apenas artigos com target_role = requester
        const data = await knowledgeBaseApi.getArticles({ target_role: "requester" });
        setArticles(data || []);
      } catch (err) {
        console.error("Erro ao carregar Central de Ajuda:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchHelp();
  }, []);

  const handleOpenArticle = async (art) => {
    try {
      const full = await knowledgeBaseApi.getArticle(art.slug || art.id);
      setSelectedArticle(full);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.error(e);
    }
  };

  const handleFeedback = async (id, isHelpful) => {
    if (feedbackDone[id]) return;
    try {
      await knowledgeBaseApi.sendFeedback(id, isHelpful);
      setFeedbackDone((prev) => ({ ...prev, [id]: true }));
      if (selectedArticle && selectedArticle.id === id) {
        setSelectedArticle((prev) => ({
          ...prev,
          helpful_count: (prev.helpful_count || 0) + (isHelpful ? 1 : 0),
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredArticles = articles.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (a.title || "").toLowerCase().includes(q) ||
      (a.summary || "").toLowerCase().includes(q) ||
      (a.tags || []).some((t) => (t || "").toLowerCase().includes(q))
    );
  });

  const renderSimpleMarkdown = (content) => {
    if (!content) return null;
    const lines = content.split("\n");
    return (
      <div className="space-y-4 text-slate-700 leading-relaxed text-sm sm:text-base">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (trimmed.startsWith("# ")) {
            return (
              <h1 key={idx} className="text-2xl sm:text-3xl font-black text-slate-900 mt-6 pb-2 border-b border-slate-200">
                {trimmed.replace("# ", "")}
              </h1>
            );
          }
          if (trimmed.startsWith("## ")) {
            return (
              <h2 key={idx} className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-6 mb-2">
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
              <div key={idx} className="p-4 my-3 bg-blue-50 border-l-4 border-blue-600 rounded-r-2xl text-blue-900 text-sm font-medium">
                {trimmed.replace("> ", "")}
              </div>
            );
          }
          if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
            return (
              <li key={idx} className="ml-5 list-disc">
                {trimmed.replace(/^[\*\-]\s+/, "")}
              </li>
            );
          }
          if (/^\d+\.\s/.test(trimmed)) {
            return (
              <li key={idx} className="ml-5 list-decimal">
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
          return <p key={idx}>{trimmed}</p>;
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
              TI
            </div>
            <div>
              <h1 className="font-extrabold text-sm sm:text-base text-slate-900 leading-tight">
                TIHFSA • Central de Ajuda
              </h1>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Hotel Fasano Salvador
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/chamado"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-sm transition-all"
            >
              <PlusCircle size={16} />
              <span>Abrir Chamado</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Search Area */}
      <div className="bg-gradient-to-b from-blue-900 to-slate-900 text-white py-12 px-4 sm:px-6 text-center relative overflow-hidden">
        <div className="max-w-3xl mx-auto space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-500/30">
            <Sparkles size={14} />
            <span>Autoatendimento & Dúvidas Frequentes</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight">
            Como podemos te ajudar hoje?
          </h2>
          <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto">
            Encontre guias rápidos sobre abertura de chamados, prazos de atendimento e aprovação de serviços.
          </p>

          {/* Search Box */}
          <div className="relative max-w-xl mx-auto pt-2">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Digite sua dúvida (ex: como abrir chamado, quarto, aprovar)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-10 py-3 bg-white text-slate-900 placeholder-slate-400 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/30 shadow-lg"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 mt-8">
        {selectedArticle ? (
          /* Reader View */
          <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200 space-y-6 animate-fadeIn">
            <button
              type="button"
              onClick={() => setSelectedArticle(null)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold transition-colors cursor-pointer"
            >
              <ArrowLeft size={16} />
              <span>Voltar para Dúvidas Frequentes</span>
            </button>

            <div className="space-y-3 pt-2">
              <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-bold text-xs border border-blue-200">
                Guia do Colaborador
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                {selectedArticle.title}
              </h1>
              {selectedArticle.summary && (
                <p className="text-slate-500 text-sm sm:text-base border-l-4 border-slate-300 pl-3">
                  {selectedArticle.summary}
                </p>
              )}
            </div>

            <div className="pt-6 border-t border-slate-100">
              {renderSimpleMarkdown(selectedArticle.content)}
            </div>

            {/* Helpful Box */}
            <div className="mt-8 pt-6 border-t border-slate-100 bg-slate-50 p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="font-bold text-slate-900 text-sm">Este guia esclareceu sua dúvida?</p>
                <p className="text-xs text-slate-500">Avalie para sabermos se o artigo foi útil.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleFeedback(selectedArticle.id, true)}
                  disabled={Boolean(feedbackDone[selectedArticle.id])}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 text-xs font-bold transition-all disabled:opacity-60"
                >
                  <ThumbsUp size={14} />
                  <span>Sim ({selectedArticle.helpful_count || 0})</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleFeedback(selectedArticle.id, false)}
                  disabled={Boolean(feedbackDone[selectedArticle.id])}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-rose-50 hover:text-rose-700 text-xs font-bold transition-all disabled:opacity-60"
                >
                  <ThumbsDown size={14} />
                  <span>Não</span>
                </button>
              </div>
            </div>

            {/* Call to Action */}
            <div className="text-center pt-4">
              <Link
                to="/chamado"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all"
              >
                <PlusCircle size={18} />
                <span>Precisa de Ajuda Técnica? Abrir Chamado Agora</span>
              </Link>
            </div>
          </div>
        ) : (
          /* Cards Grid */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
                <BookOpen size={20} className="text-blue-600" />
                Artigos e Manuais Rápidos
              </h3>
              <span className="text-xs font-semibold text-slate-500">
                {filteredArticles.length} artigos disponíveis
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-500 font-bold text-sm">
                Carregando guias de autoatendimento...
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center border border-slate-200">
                <HelpCircle size={40} className="text-slate-300 mx-auto mb-2" />
                <h4 className="font-extrabold text-slate-800">Nenhum guia encontrado</h4>
                <p className="text-xs text-slate-500 mt-1">Tente pesquisar com outras palavras.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredArticles.map((art) => (
                  <div
                    key={art.id}
                    onClick={() => handleOpenArticle(art)}
                    className="group bg-white rounded-3xl p-6 border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-3">
                        <FileText size={20} />
                      </div>
                      <h4 className="font-extrabold text-slate-900 text-base group-hover:text-blue-600 transition-colors leading-snug">
                        {art.title}
                      </h4>
                      {art.summary && (
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {art.summary}
                        </p>
                      )}
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-600">
                      <span>Ver passo a passo</span>
                      <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Banner de Abertura Imediata */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6 mt-8">
              <div className="space-y-1 text-center sm:text-left">
                <h4 className="text-lg font-black text-slate-900">
                  Não encontrou a resposta para o seu problema?
                </h4>
                <p className="text-xs sm:text-sm text-slate-500">
                  Nossa equipe de TI está à disposição para atendimento presencial ou remoto.
                </p>
              </div>
              <Link
                to="/chamado"
                className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all"
              >
                <PlusCircle size={18} />
                <span>Abrir Novo Chamado</span>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
