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
  const [assets, setAssets] = useState([]);
  const [form, setForm] = useState({ category_id: null, subcategory_id: null, title: "", description: "", asset_id: null });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get("/categories").then((r) => setCategories(r.data));
    if (user?.id) api.get(`/assets/user/${user.id}`).then((r) => setAssets(r.data)).catch(() => {});
  }, [user]);

  const selectedCategory = categories.find((c) => c.id === form.category_id);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title) return;
    setLoading(true);
    try {
      await api.post("/tickets", {
        title: form.title,
        description: form.description,
        requester_id: user.id,
        category_id: form.category_id,
        subcategory_id: form.subcategory_id,
        asset_id: form.asset_id,
      });
      setSuccess(true);
      setTimeout(() => navigate("/"), 2000);
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
    <div className="min-h-screen w-full bg-slate-50 text-slate-900">
      <header className="px-5 py-4 bg-white border-b border-slate-200 sticky top-0 z-20 flex items-center gap-3 shadow-xs">
        <button onClick={() => navigate("/")} className="p-1 rounded-lg text-slate-400 hover:text-slate-800 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-bold text-slate-900">Abrir Novo Chamado</h1>
      </header>

      <form onSubmit={submit} className="max-w-lg mx-auto p-4 sm:p-6 space-y-4">
        {/* Category Step */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Categoria</label>
            <select
              value={form.category_id || ""}
              onChange={(e) => setForm({ ...form, category_id: Number(e.target.value) || null, subcategory_id: null })}
              className="w-full px-4 py-3 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
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

        {/* User Assets list */}
        {assets.length > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Equipamento Relacionado (Opcional)
            </label>
            <div className="space-y-2">
              {assets.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setForm({ ...form, asset_id: form.asset_id === a.id ? null : a.id })}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all cursor-pointer border ${
                    form.asset_id === a.id
                      ? "bg-blue-50 border-blue-600 text-blue-900 font-semibold shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <Monitor size={18} className={form.asset_id === a.id ? "text-blue-600" : "text-slate-400"} />
                  <span className="text-xs sm:text-sm truncate">{a.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Details Form */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Título do Pedido</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: Impressora sem papel, TV sem sinal..."
              className="w-full px-4 py-3 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Descrição Detalhada</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Conte-nos o que aconteceu para agilizar o suporte..."
              rows={4}
              className="w-full px-4 py-3 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 resize-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !form.title}
          className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-xs sm:text-sm font-extrabold text-white transition-all cursor-pointer shadow-lg ${
            form.title
              ? "bg-blue-600 hover:bg-blue-700 shadow-blue-500/25"
              : "bg-slate-300 text-slate-500 cursor-not-allowed"
          }`}
        >
          <Send size={18} />
          <span>{loading ? "Enviando Solicitacao..." : "Enviar Chamado de Suporte"}</span>
        </button>
      </form>
    </div>
  );
}
