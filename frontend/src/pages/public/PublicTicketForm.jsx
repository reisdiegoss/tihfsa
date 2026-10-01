/**
 * PublicTicketForm — Formulário público para abertura de chamados.
 * 
 * Fluxo:
 * 1. Usuário digita seu login de rede (ad_username)
 * 2. Sistema busca e mostra o nome para confirmação
 * 3. Usuário preenche o chamado (categoria, localização, título, descrição)
 * 4. Backend captura IP, hostname e user-agent transparentemente
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, User, CheckCircle2, Send, ArrowLeft, ArrowRight,
  Monitor, AlertCircle, Building2, MapPin, FileText, ChevronDown
} from "lucide-react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";

const publicApi = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

export default function PublicTicketForm() {
  // Steps: 0 = identificação, 1 = formulário, 2 = sucesso
  const [step, setStep] = useState(0);

  // Step 0 — Identificação
  const [username, setUsername] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef(null);

  // Step 1 — Formulário
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    category_id: null,
    subcategory_id: null,
    problem_type_id: null,
    location: "",
    title: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [createdTicket, setCreatedTicket] = useState(null);
  const [error, setError] = useState(null);

  // Debounced search
  const handleSearch = useCallback((value) => {
    setUsername(value);
    setSelectedUser(null);
    setError(null);

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (value.length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await publicApi.get(`/public/lookup-user?username=${encodeURIComponent(value)}`);
        setSearchResults(res.data);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, []);

  // Load categories when entering step 1
  useEffect(() => {
    if (step === 1 && categories.length === 0) {
      publicApi.get("/public/categories")
        .then((r) => setCategories(r.data))
        .catch(() => {});
    }
  }, [step, categories.length]);

  const selectUser = (user) => {
    setSelectedUser(user);
    setUsername(user.display_name);
    setSearchResults([]);
  };

  const goToForm = () => {
    if (!selectedUser) return;
    setStep(1);
  };

  const selectedCategory = categories.find((c) => c.id === form.category_id);
  const selectedSubcategory = selectedCategory?.subcategories?.find((s) => s.id === form.subcategory_id);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.location || !selectedUser) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await publicApi.post("/public/tickets", {
        user_id: selectedUser.id,
        username: selectedUser.ad_username || selectedUser.display_name,
        title: form.title,
        description: form.description || null,
        location: form.location || null,
        category_id: form.category_id,
        subcategory_id: form.subcategory_id,
        problem_type_id: form.problem_type_id,
      });
      setCreatedTicket(res.data);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || "Erro ao enviar chamado. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep(0);
    setUsername("");
    setSearchResults([]);
    setSelectedUser(null);
    setForm({ category_id: null, subcategory_id: null, problem_type_id: null, location: "", title: "", description: "" });
    setCreatedTicket(null);
    setError(null);
  };

  // ─── Step 2: Sucesso ───
  if (step === 2) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-6" style={styles.bgGradient}>
        <div className="text-center max-w-sm w-full p-8 rounded-3xl space-y-4 animate-fade-in" style={styles.card}>
          <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)" }}>
            <CheckCircle2 size={44} style={{ color: "#10b981" }} />
          </div>
          <h2 className="text-2xl font-extrabold" style={{ color: "#f1f5f9" }}>Chamado Enviado!</h2>
          <p className="text-sm" style={{ color: "#94a3b8" }}>
            Seu chamado <strong style={{ color: "#60a5fa" }}>#{createdTicket?.id}</strong> foi registrado com sucesso.
            A equipe de TI irá atender em breve.
          </p>
          <button onClick={resetForm} className="w-full py-3 rounded-xl text-sm font-bold transition-all" style={styles.btnPrimary}>
            Abrir Novo Chamado
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full pb-8" style={styles.bgGradient}>
      {/* Header */}
      <header className="px-5 py-4 sticky top-0 z-20 flex items-center gap-3 backdrop-blur-md" style={styles.header}>
        {step === 1 && (
          <button onClick={() => setStep(0)} className="p-1.5 rounded-lg transition-colors cursor-pointer" style={styles.btnGhost}>
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}>
            <Monitor size={16} color="#fff" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold" style={{ color: "#f1f5f9" }}>Hotel Fasano Salvador</h1>
            <p className="text-[10px] font-medium" style={{ color: "#64748b" }}>Abertura de Chamado — TI</p>
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="max-w-lg mx-auto px-4 mt-4 mb-6">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: step === 0 ? "50%" : "100%", background: "linear-gradient(90deg, #3b82f6, #8b5cf6)" }} />
          </div>
          <span className="text-[10px] font-bold" style={{ color: "#64748b" }}>
            {step === 0 ? "1/2" : "2/2"}
          </span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4">
        {/* ─── Step 0: Identificação ─── */}
        {step === 0 && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-5 rounded-2xl space-y-4" style={styles.card}>
              <div className="flex items-center gap-2 mb-1">
                <User size={16} style={{ color: "#3b82f6" }} />
                <h2 className="text-sm font-extrabold" style={{ color: "#e2e8f0" }}>Identificação</h2>
              </div>
              <p className="text-xs" style={{ color: "#94a3b8" }}>
                Digite seu <strong>login de rede</strong> (mesmo utilizado para entrar no computador).
              </p>

              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <Search size={16} style={{ color: "#64748b" }} />
                </div>
                <input
                  type="text"
                  value={selectedUser ? selectedUser.display_name : username}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => { if (selectedUser) { setSelectedUser(null); setUsername(""); } }}
                  placeholder="Ex: joao.silva"
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={styles.input}
                  autoFocus
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && !selectedUser && (
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => selectUser(u)}
                      className="w-full px-4 py-3 flex items-center gap-3 text-left transition-colors cursor-pointer"
                      style={styles.resultItem}
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(59,130,246,0.15)" }}>
                        <User size={14} style={{ color: "#3b82f6" }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: "#e2e8f0" }}>{u.display_name}</p>
                        <p className="text-[10px] truncate" style={{ color: "#64748b" }}>
                          {u.department_name || "Sem setor"}
                          {u.email && ` · ${u.email}`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected User Confirmation */}
              {selectedUser && (
                <div className="rounded-xl p-4 flex items-center gap-3 animate-fade-in" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                  <CheckCircle2 size={20} style={{ color: "#10b981" }} />
                  <div>
                    <p className="text-sm font-bold" style={{ color: "#e2e8f0" }}>{selectedUser.display_name}</p>
                    <p className="text-[10px]" style={{ color: "#64748b" }}>{selectedUser.department_name || "Sem setor"}</p>
                  </div>
                </div>
              )}

              {username.length >= 2 && searchResults.length === 0 && !searching && !selectedUser && (
                <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <AlertCircle size={16} style={{ color: "#ef4444" }} />
                  <p className="text-xs" style={{ color: "#fca5a5" }}>Nenhum usuário encontrado com este login de rede.</p>
                </div>
              )}
            </div>

            <button
              onClick={goToForm}
              disabled={!selectedUser}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-extrabold transition-all cursor-pointer"
              style={selectedUser ? styles.btnPrimary : styles.btnDisabled}
            >
              <span>Continuar</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ─── Step 1: Formulário ─── */}
        {step === 1 && (
          <form onSubmit={submit} className="space-y-4 animate-fade-in">
            {/* Localização */}
            <div className="p-5 rounded-2xl space-y-3 relative overflow-hidden" style={styles.card}>
              <div className="absolute top-0 left-0 w-1 h-full" style={{ background: "linear-gradient(180deg, #3b82f6, #8b5cf6)" }} />
              <div className="flex items-center gap-2">
                <MapPin size={16} style={{ color: "#3b82f6" }} />
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>
                  Local / UH <span style={{ color: "#ef4444" }}>*</span>
                </label>
              </div>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value.toUpperCase() })}
                placeholder="Ex: UH 201, Restaurante, Lobby..."
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={styles.input}
                required
              />
              <p className="text-[10px]" style={{ color: "#475569" }}>Onde a TI deve ir para resolver o problema.</p>
            </div>

            {/* Categoria */}
            <div className="p-5 rounded-2xl space-y-3" style={styles.card}>
              <div className="flex items-center gap-2">
                <Building2 size={16} style={{ color: "#8b5cf6" }} />
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>Categoria</label>
              </div>
              <div className="relative">
                <select
                  value={form.category_id || ""}
                  onChange={(e) => setForm({ ...form, category_id: Number(e.target.value) || null, subcategory_id: null, problem_type_id: null })}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none appearance-none cursor-pointer"
                  style={styles.input}
                >
                  <option value="">Selecione a área do problema...</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#64748b" }} />
              </div>

              {selectedCategory && selectedCategory.subcategories?.length > 0 && (
                <div className="relative animate-fade-in">
                  <select
                    value={form.subcategory_id || ""}
                    onChange={(e) => setForm({ ...form, subcategory_id: Number(e.target.value) || null, problem_type_id: null })}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none appearance-none cursor-pointer"
                    style={styles.input}
                  >
                    <option value="">Subcategoria...</option>
                    {selectedCategory.subcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#64748b" }} />
                </div>
              )}

              {selectedSubcategory && selectedSubcategory.problem_types?.length > 0 && (
                <div className="relative animate-fade-in">
                  <select
                    value={form.problem_type_id || ""}
                    onChange={(e) => setForm({ ...form, problem_type_id: Number(e.target.value) || null })}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none appearance-none cursor-pointer"
                    style={styles.input}
                  >
                    <option value="">Tipo de problema...</option>
                    {selectedSubcategory.problem_types.map((pt) => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#64748b" }} />
                </div>
              )}
            </div>

            {/* Detalhes */}
            <div className="p-5 rounded-2xl space-y-3" style={styles.card}>
              <div className="flex items-center gap-2">
                <FileText size={16} style={{ color: "#f59e0b" }} />
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>
                  Problema <span style={{ color: "#ef4444" }}>*</span>
                </label>
              </div>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: TV sem sinal, Telefone mudo..."
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={styles.input}
                required
              />
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detalhes adicionais (opcional)..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                style={styles.input}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl p-3 flex items-center gap-2 animate-fade-in" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <AlertCircle size={16} style={{ color: "#ef4444" }} />
                <p className="text-xs" style={{ color: "#fca5a5" }}>{error}</p>
              </div>
            )}

            {/* Resumo do solicitante */}
            <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
              <User size={14} style={{ color: "#3b82f6" }} />
              <p className="text-xs" style={{ color: "#94a3b8" }}>
                Solicitante: <strong style={{ color: "#e2e8f0" }}>{selectedUser?.display_name}</strong>
                {selectedUser?.department_name && <span> · {selectedUser.department_name}</span>}
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting || !form.title || !form.location}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-extrabold transition-all cursor-pointer"
              style={form.title && form.location ? styles.btnPrimary : styles.btnDisabled}
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send size={16} />
              )}
              <span>{submitting ? "Enviando..." : "Enviar Chamado para TI"}</span>
            </button>
          </form>
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
        select option { background: #1e293b; color: #e2e8f0; }
      `}</style>
    </div>
  );
}

// ─── Inline Styles ───
const styles = {
  bgGradient: {
    background: "linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
    minHeight: "100vh",
  },
  header: {
    background: "rgba(15,23,42,0.85)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  card: {
    background: "rgba(30,41,59,0.6)",
    border: "1px solid rgba(255,255,255,0.06)",
    backdropFilter: "blur(8px)",
  },
  input: {
    background: "rgba(15,23,42,0.6)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#e2e8f0",
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
    color: "#fff",
    boxShadow: "0 4px 20px rgba(59,130,246,0.25)",
  },
  btnDisabled: {
    background: "rgba(255,255,255,0.05)",
    color: "#475569",
    cursor: "not-allowed",
  },
  btnGhost: {
    color: "#94a3b8",
  },
  resultItem: {
    background: "rgba(15,23,42,0.4)",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
};
