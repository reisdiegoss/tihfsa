/**
 * NewRequest — formulário PWA do usuário com estilo moderno e cascata fluida.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Monitor, CheckCircle2 } from "lucide-react";
import api from "../../api/client";
import { useAuth } from "../../contexts/AuthContext";

export default function NewRequest() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ category_id: null, subcategory_id: null, location: "", title: "", description: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get("/categories").then((r) => setCategories(r.data));
  }, []);

  const selectedCategory = categories.find((c) => c.id === form.category_id);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.location) return;
    setLoading(true);
    
    // Concatena a Localização no título para que a TI bata o olho e saiba onde é.
    const finalTitle = `[${form.location}] ${form.title}`;
    
    try {
      await api.post("/tickets", {
        title: finalTitle,
        description: form.description,
        requester_id: user.id,
        category_id: form.category_id,
        subcategory_id: form.subcategory_id,
      });
      setSuccess(true);
      setTimeout(() => navigate("/app"), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-6 bg-slate-50">
        <div className="text-center animate-fade-in max-w-sm w-full bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-3">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
            <CheckCircle2 size={36} />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Solicitação Enviada!</h2>
          <p className="text-xs text-slate-500">Sua solicitação foi gravada com sucesso. Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900 pb-8">
      <header className="px-5 py-4 bg-white border-b border-slate-200 sticky top-0 z-20 flex items-center gap-3 shadow-xs">
        <button onClick={() => navigate("/app")} className="p-1 rounded-lg text-slate-400 hover:text-slate-800 transition-colors cursor-pointer">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-bold text-slate-900">Abrir Novo Chamado</h1>
      </header>

      <form onSubmit={submit} className="max-w-lg mx-auto p-4 sm:p-6 space-y-4">
        
        {/* Localização (UH) Step */}
        <div className="bg-white rounded-2xl p-5 border border-blue-200 shadow-sm shadow-blue-500/10 space-y-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Local / UH da Vistoria <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value.toUpperCase() })}
              placeholder="Ex: UH 201, Restaurante, Lobby..."
              className="w-full px-4 py-3 rounded-xl text-sm font-bold bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              required
            />
            <p className="text-[10px] text-slate-400 mt-2 font-medium">Este campo é essencial para a TI saber exatamente para onde ir.</p>
          </div>
        </div>

        {/* Category Step */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Categoria <span className="text-red-500">*</span></label>
            <select
              value={form.category_id || ""}
              onChange={(e) => setForm({ ...form, category_id: Number(e.target.value) || null, subcategory_id: null })}
              className="w-full px-4 py-3 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              required
            >
              <option value="">Selecione a área do problema...</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {selectedCategory && (
            <div className="animate-fade-in">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Tipo Específico</label>
              <select
                value={form.subcategory_id || ""}
                onChange={(e) => setForm({ ...form, subcategory_id: Number(e.target.value) || null })}
                className="w-full px-4 py-3 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Selecione a subcategoria...</option>
                {selectedCategory.subcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Details Form */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Resumo do Problema <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: TV sem sinal, Telefone mudo..."
              className="w-full px-4 py-3 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Detalhes</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descreva mais detalhes se necessário..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 resize-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !form.title || !form.location || !form.category_id}
          className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-xs sm:text-sm font-extrabold text-white transition-all cursor-pointer shadow-lg mt-4 ${
            form.title && form.location && form.category_id
              ? "bg-blue-600 hover:bg-blue-700 shadow-blue-500/25"
              : "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
          }`}
        >
          {loading ? <CheckCircle2 size={18} className="animate-pulse" /> : <Send size={18} />}
          <span>{loading ? "Enviando..." : "Enviar Chamado para TI"}</span>
        </button>
      </form>
    </div>
  );
}
