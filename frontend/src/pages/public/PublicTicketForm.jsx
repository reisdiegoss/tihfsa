/**
 * PublicTicketForm — Formulário público para abertura de chamados.
 * 
 * Regras de Negócio e Permissão:
 * - O chamado possui obrigatoriamente um solicitante (requester_id) ativo.
 * - Isso garante que tanto o próprio colaborador quanto a chefia do seu setor
 *   (manager_name / gestor do departamento) consigam visualizar e acompanhar o chamado no sistema.
 * - Suporta envio de fotos e evidências diretamente no momento da abertura.
 * - Captura transparente de IP, hostname e user-agent para auditoria anti-fraude.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, User, CheckCircle2, Send, ArrowLeft, ArrowRight,
  Monitor, AlertCircle, Building2, MapPin, FileText, ChevronDown,
  ShieldCheck, UploadCloud, X, Image as ImageIcon, Paperclip, ExternalLink,
  Hotel
} from "lucide-react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";

const publicApi = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

export default function PublicTicketForm() {
  // Steps: 0 = identificação do solicitante, 1 = formulário e fotos, 2 = sucesso
  const [step, setStep] = useState(0);

  // Step 0 — Identificação
  const [username, setUsername] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef(null);

  // Step 1 — Formulário
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [locationType, setLocationType] = useState("LOCAL"); // 'LOCAL' | 'UH'
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");
  const [locationComplement, setLocationComplement] = useState("");
  const [customLocation, setCustomLocation] = useState("");

  const [form, setForm] = useState({
    category_id: null,
    subcategory_id: null,
    problem_type_id: null,
    location: "",
    title: "",
    description: "",
  });
  const [files, setFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const fileInputRef = useRef(null);

  const [clientInfo, setClientInfo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [createdTicket, setCreatedTicket] = useState(null);
  const [error, setError] = useState(null);

  // Carrega informações do cliente (IP e Hostname detectado via CMDB/Sentinel Agent)
  useEffect(() => {
    const query = selectedUser?.id ? `?user_id=${selectedUser.id}` : "";
    publicApi.get(`/public/client-info${query}`)
      .then((res) => setClientInfo(res.data))
      .catch(() => {});
  }, [selectedUser]);

  // Debounced search de colaboradores
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
    }, 350);
  }, []);

  // Carrega categorias, locais físicos e UHs ao acessar a etapa do formulário
  useEffect(() => {
    if (step === 1) {
      if (categories.length === 0) {
        publicApi.get("/public/categories").then((r) => setCategories(r.data)).catch(() => {});
      }
      if (locations.length === 0) {
        publicApi.get("/public/locations").then((r) => setLocations(r.data)).catch(() => {});
      }
      if (rooms.length === 0) {
        publicApi.get("/public/rooms").then((r) => setRooms(r.data)).catch(() => {});
      }
    }
  }, [step, categories.length, locations.length, rooms.length]);



  const handleSwitchLocationType = (type) => {
    setLocationType(type);
    if (type === "UH") {
      if (selectedRoom) {
        setForm((prev) => ({ ...prev, location: `UH ${selectedRoom}` }));
      } else {
        setForm((prev) => ({ ...prev, location: "" }));
      }
    } else {
      if (selectedLocation) {
        if (selectedLocation === "OUTRO") {
          setForm((prev) => ({ ...prev, location: customLocation.trim().toUpperCase() }));
        } else {
          const finalLoc = locationComplement.trim() ? `${selectedLocation} - ${locationComplement.trim()}` : selectedLocation;
          setForm((prev) => ({ ...prev, location: finalLoc.toUpperCase() }));
        }
      } else {
        setForm((prev) => ({ ...prev, location: "" }));
      }
    }
  };

  const handleSelectRoom = (roomNum) => {
    setSelectedRoom(roomNum);
    setForm((prev) => ({ ...prev, location: `UH ${roomNum}` }));
  };

  const handleSelectLocation = (locName) => {
    setSelectedLocation(locName);
    if (locName === "OUTRO") {
      setForm((prev) => ({ ...prev, location: customLocation.trim().toUpperCase() }));
    } else {
      const finalLoc = locationComplement.trim() ? `${locName} - ${locationComplement.trim()}` : locName;
      setForm((prev) => ({ ...prev, location: finalLoc.toUpperCase() }));
    }
  };

  const handleComplementChange = (comp) => {
    setLocationComplement(comp);
    if (selectedLocation && selectedLocation !== "OUTRO") {
      const finalLoc = comp.trim() ? `${selectedLocation} - ${comp.trim()}` : selectedLocation;
      setForm((prev) => ({ ...prev, location: finalLoc.toUpperCase() }));
    }
  };

  const handleCustomLocationChange = (text) => {
    setCustomLocation(text);
    setForm((prev) => ({ ...prev, location: text.toUpperCase() }));
  };

  const selectUser = (user) => {
    setSelectedUser(user);
    setUsername(user.display_name);
    setSearchResults([]);
  };

  const goToForm = () => {
    if (!selectedUser) return;
    setStep(1);
  };

  // Gerenciamento de Anexos / Fotos
  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;

    const validFiles = selected.filter((f) => {
      const isAllowed = f.type.startsWith("image/") || f.type === "application/pdf";
      return isAllowed && f.size <= 15 * 1024 * 1024; // max 15MB
    });

    const newFiles = [...files, ...validFiles];
    setFiles(newFiles);

    // Gera previews
    const newPreviews = validFiles.map((file) => ({
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(2),
      isImage: file.type.startsWith("image/"),
      url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    }));
    setFilePreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeFile = (index) => {
    if (filePreviews[index]?.url) {
      URL.revokeObjectURL(filePreviews[index].url);
    }
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFilePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const selectedCategory = categories.find((c) => c.id === form.category_id);
  const selectedSubcategory = selectedCategory?.subcategories?.find((s) => s.id === form.subcategory_id);

  // Submissão do chamado + upload dos anexos
  const submit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.location || !selectedUser) return;
    setSubmitting(true);
    setUploadStatus("Criando chamado...");
    setError(null);

    try {
      // 1. Cria o chamado vinculado ao solicitante obrigatório
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

      const ticket = res.data;

      // 2. Se houver fotos/arquivos, faz o upload vinculado ao ticket recém-criado
      if (files.length > 0) {
        setUploadStatus(`Enviando anexos (0/${files.length})...`);
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setUploadStatus(`Enviando anexo (${i + 1}/${files.length})...`);
          const formData = new FormData();
          formData.append("file", file);
          try {
            await publicApi.post(`/public/tickets/${ticket.id}/attachments`, formData, {
              headers: { "Content-Type": "multipart/form-data" },
            });
          } catch (uploadErr) {
            console.warn("Erro ao anexar arquivo:", file.name, uploadErr);
          }
        }
      }

      setCreatedTicket(ticket);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || "Erro ao registrar chamado. Verifique os dados e tente novamente.");
    } finally {
      setSubmitting(false);
      setUploadStatus("");
    }
  };

  const resetForm = () => {
    filePreviews.forEach((p) => { if (p.url) URL.revokeObjectURL(p.url); });
    setStep(0);
    setUsername("");
    setSearchResults([]);
    setSelectedUser(null);
    setForm({ category_id: null, subcategory_id: null, problem_type_id: null, location: "", title: "", description: "" });
    setFiles([]);
    setFilePreviews([]);
    setCreatedTicket(null);
    setError(null);
  };

  // ─── Step 2: Sucesso com Garantia de Visibilidade ───
  if (step === 2) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6" style={styles.bgGradient}>
        <div className="text-center max-w-md w-full p-6 sm:p-8 rounded-3xl space-y-5 animate-fade-in" style={styles.card}>
          <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center shadow-lg" style={{ background: "rgba(16,185,129,0.15)", border: "2px solid rgba(16,185,129,0.3)" }}>
            <CheckCircle2 size={44} style={{ color: "#10b981" }} />
          </div>

          <div>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase mb-2" style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}>
              Chamado Aberto #{createdTicket?.id}
            </span>
            <h2 className="text-2xl font-black" style={{ color: "#f8fafc" }}>Chamado Registrado!</h2>
            <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>
              A equipe de TI já foi notificada e o chamado está registrado no sistema.
            </p>
          </div>

          {/* Card de Visibilidade e Setor */}
          <div className="rounded-2xl p-4 text-left space-y-3" style={{ background: "rgba(15,23,42,0.7)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2 pb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <ShieldCheck size={18} style={{ color: "#10b981" }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#cbd5e1" }}>Visibilidade do Chamado</span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between py-1">
                <span style={{ color: "#64748b" }}>Solicitante Vinculado:</span>
                <span className="font-semibold text-right" style={{ color: "#f1f5f9" }}>{createdTicket?.requester_name}</span>
              </div>
              <div className="flex justify-between py-1">
                <span style={{ color: "#64748b" }}>Setor:</span>
                <span className="font-semibold text-right" style={{ color: "#60a5fa" }}>{createdTicket?.department_name || "Geral"}</span>
              </div>
              <div className="flex justify-between py-1">
                <span style={{ color: "#64748b" }}>Gestor / Chefe do Setor:</span>
                <span className="font-semibold text-right" style={{ color: "#34d399" }}>{createdTicket?.manager_name || "Chefia do Departamento"}</span>
              </div>
              {clientInfo?.hostname && (
                <div className="flex justify-between py-1">
                  <span style={{ color: "#64748b" }}>Computador / Hostname:</span>
                  <span className="font-semibold text-right" style={{ color: "#38bdf8" }}>{clientInfo.hostname}</span>
                </div>
              )}
            </div>

            <div className="pt-2 text-[11px] leading-relaxed" style={{ color: "#94a3b8", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              💡 <strong>Você e seu chefe de setor</strong> podem visualizar e acompanhar o andamento deste chamado a qualquer momento pelo portal interno ou aplicativo corporativo.
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="space-y-2.5 pt-2">
            <button
              onClick={() => { window.location.href = "/app"; }}
              className="w-full py-3.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
              style={styles.btnPrimary}
            >
              <ExternalLink size={16} />
              <span>Acessar Portal do Colaborador</span>
            </button>
            <button
              onClick={resetForm}
              className="w-full py-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer"
              style={styles.btnSecondary}
            >
              Abrir Outro Chamado
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full pb-10" style={styles.bgGradient}>
      {/* Header */}
      <header className="px-5 py-4 sticky top-0 z-20 flex items-center gap-3 backdrop-blur-md" style={styles.header}>
        {step === 1 && (
          <button onClick={() => setStep(0)} className="p-1.5 rounded-lg transition-colors cursor-pointer" style={styles.btnGhost}>
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow" style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}>
            <Monitor size={16} color="#fff" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold" style={{ color: "#f1f5f9" }}>Hotel Fasano Salvador</h1>
            <p className="text-[10px] font-medium" style={{ color: "#64748b" }}>Central de Ajuda — TI Helpdesk</p>
          </div>
        </div>
      </header>

      {/* Barra de Progresso com Explicação */}
      <div className="max-w-lg mx-auto px-4 mt-4 mb-5">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: step === 0 ? "50%" : "100%",
                background: "linear-gradient(90deg, #3b82f6, #8b5cf6)"
              }}
            />
          </div>
          <span className="text-[11px] font-bold" style={{ color: "#94a3b8" }}>
            {step === 0 ? "Passo 1/2: Solicitante" : "Passo 2/2: Dados do Chamado"}
          </span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4">
        {/* ─── Step 0: Identificação do Solicitante Obrigatório ─── */}
        {step === 0 && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-5 sm:p-6 rounded-2xl space-y-4" style={styles.card}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(59,130,246,0.15)" }}>
                  <User size={16} style={{ color: "#3b82f6" }} />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold" style={{ color: "#e2e8f0" }}>Quem está solicitando?</h2>
                  <p className="text-[11px]" style={{ color: "#94a3b8" }}>
                    Vincule o chamado ao seu usuário para que <strong>você e a chefia do seu setor</strong> possam visualizá-lo.
                  </p>
                </div>
              </div>

              {/* Campo de Busca */}
              <div className="relative pt-1">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                  <Search size={16} style={{ color: "#64748b" }} />
                </div>
                <input
                  type="text"
                  value={selectedUser ? selectedUser.display_name : username}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => { if (selectedUser) { setSelectedUser(null); setUsername(""); } }}
                  placeholder="Digite seu nome ou login de rede..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={styles.input}
                  autoFocus
                />
                {searching && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Lista de Resultados de Busca */}
              {searchResults.length > 0 && !selectedUser && (
                <div className="rounded-xl overflow-hidden max-h-64 overflow-y-auto" style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(15,23,42,0.8)" }}>
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => selectUser(u)}
                      type="button"
                      className="w-full px-4 py-3 flex items-center gap-3 text-left transition-colors cursor-pointer hover:bg-slate-800/80"
                      style={styles.resultItem}
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(59,130,246,0.15)" }}>
                        <User size={16} style={{ color: "#3b82f6" }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate" style={{ color: "#f1f5f9" }}>{u.display_name}</p>
                        <p className="text-[11px] truncate" style={{ color: "#94a3b8" }}>
                          Setor: <strong style={{ color: "#cbd5e1" }}>{u.department_name || "Sem setor"}</strong>
                          {u.manager_name && <span> · Chefe: <strong style={{ color: "#60a5fa" }}>{u.manager_name}</strong></span>}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Card de Confirmação do Solicitante Selecionado */}
              {selectedUser && (
                <div className="rounded-2xl p-4 space-y-2.5 animate-fade-in" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} style={{ color: "#10b981" }} />
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#10b981" }}>Colaborador Confirmado</span>
                  </div>

                  <div className="text-xs space-y-1 pl-1">
                    <p className="text-sm font-black" style={{ color: "#f8fafc" }}>{selectedUser.display_name}</p>
                    <p style={{ color: "#94a3b8" }}>
                      Setor: <strong style={{ color: "#60a5fa" }}>{selectedUser.department_name || "Sem setor"}</strong>
                    </p>
                    <p style={{ color: "#94a3b8" }}>
                      Chefe / Gestor do Setor: <strong style={{ color: "#34d399" }}>{selectedUser.manager_name || "Gestão Geral"}</strong>
                    </p>
                    {clientInfo?.hostname && (
                      <p style={{ color: "#94a3b8" }}>
                        Computador de Origem: <strong style={{ color: "#38bdf8" }}>{clientInfo.hostname}</strong> <span style={{ color: "#64748b" }}>({clientInfo.ip})</span>
                      </p>
                    )}
                  </div>

                  <div className="pt-2 text-[11px] flex items-center gap-1.5" style={{ color: "#6ee7b7", borderTop: "1px solid rgba(16,185,129,0.15)" }}>
                    <ShieldCheck size={14} />
                    <span>Visibilidade garantida para você e para o chefe do setor.</span>
                  </div>
                </div>
              )}

              {username.length >= 2 && searchResults.length === 0 && !searching && !selectedUser && (
                <div className="rounded-xl p-3 flex items-center gap-2.5" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <AlertCircle size={16} style={{ color: "#ef4444" }} />
                  <p className="text-xs" style={{ color: "#fca5a5" }}>
                    Nenhum colaborador encontrado com &quot;{username}&quot;. Verifique o nome ou login.
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={goToForm}
              disabled={!selectedUser}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-black transition-all cursor-pointer shadow-lg"
              style={selectedUser ? styles.btnPrimary : styles.btnDisabled}
            >
              <span>Avançar para Dados do Chamado</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ─── Step 1: Formulário + Fotos e Evidências ─── */}
        {step === 1 && (
          <form onSubmit={submit} className="space-y-4 animate-fade-in">
            {/* Resumo do Solicitante e Estação no Topo */}
            <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(59,130,246,0.2)" }}>
                    <User size={14} style={{ color: "#3b82f6" }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate" style={{ color: "#f1f5f9" }}>{selectedUser?.display_name}</p>
                    <p className="text-[10px] truncate" style={{ color: "#94a3b8" }}>
                      Setor: {selectedUser?.department_name || "Geral"} {selectedUser?.manager_name ? `· Chefe: ${selectedUser.manager_name}` : ""}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="text-[11px] font-bold px-2 py-1 rounded transition-colors"
                  style={{ color: "#60a5fa" }}
                >
                  Alterar
                </button>
              </div>

              {clientInfo?.hostname && (
                <div className="pt-1.5 flex items-center gap-1.5 text-[11px]" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", color: "#38bdf8" }}>
                  <Monitor size={13} />
                  <span>Máquina identificada: <strong>{clientInfo.hostname}</strong> ({clientInfo.ip})</span>
                </div>
              )}
            </div>

            {/* Localização / UH Inteligente */}
            <div className="p-5 rounded-2xl space-y-4 relative overflow-hidden" style={styles.card}>
              <div className="absolute top-0 left-0 w-1 h-full" style={{ background: "linear-gradient(180deg, #3b82f6, #8b5cf6)" }} />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin size={16} style={{ color: "#3b82f6" }} />
                  <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>
                    Onde é o problema? <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                </div>
                {form.location && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md text-blue-400 bg-blue-500/10 border border-blue-500/20">
                    {form.location}
                  </span>
                )}
              </div>

              {/* Toggle Pills: Local Físico vs UH */}
              <div className="grid grid-cols-2 p-1 rounded-xl" style={{ background: "rgba(15,23,42,0.7)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <button
                  type="button"
                  onClick={() => handleSwitchLocationType("LOCAL")}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    locationType === "LOCAL"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Building2 size={13} />
                  <span>Local Físico / Setor</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchLocationType("UH")}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    locationType === "UH"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Hotel size={13} />
                  <span>Apartamento / UH</span>
                </button>
              </div>

              {/* MODO 1: Apartamento / UH */}
              {locationType === "UH" && (
                <div className="space-y-3 animate-fade-in">
                  <div className="relative">
                    <select
                      value={selectedRoom}
                      onChange={(e) => handleSelectRoom(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none appearance-none cursor-pointer"
                      style={styles.input}
                      required={locationType === "UH"}
                    >
                      <option value="">Selecione a UH (Apartamento)...</option>
                      {/* Agrupamento Dinâmico por Andares */}
                      {(() => {
                        const floorsGrouped = {};
                        rooms.forEach((r) => {
                          const f = r.floor || "Outros Andares";
                          if (!floorsGrouped[f]) floorsGrouped[f] = [];
                          floorsGrouped[f].push(r);
                        });
                        return Object.entries(floorsGrouped).map(([floorName, floorRooms]) => (
                          <optgroup key={floorName} label={floorName}>
                            {floorRooms.map((r) => (
                              <option key={r.id} value={r.number}>
                                {r.name} ({floorName})
                              </option>
                            ))}
                          </optgroup>
                        ));
                      })()}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#64748b" }} />
                  </div>
                  <p className="text-[10px]" style={{ color: "#64748b" }}>Selecione o quarto onde o hóspede ou equipamento necessita de atendimento.</p>
                </div>
              )}

              {/* MODO 2: Local Físico / Setor */}
              {locationType === "LOCAL" && (
                <div className="space-y-3 animate-fade-in">
                  <div className="relative">
                    <select
                      value={selectedLocation}
                      onChange={(e) => handleSelectLocation(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none appearance-none cursor-pointer"
                      style={styles.input}
                      required={locationType === "LOCAL"}
                    >
                      <option value="">Selecione o Local Físico...</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.name}>
                          {loc.name} {loc.floor ? `(${loc.floor})` : ""} {loc.department_names?.length ? `• ${loc.department_names.join(", ")}` : ""}
                        </option>
                      ))}
                      <option value="OUTRO">Outro Local (Digitar Manualmente)...</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#64748b" }} />
                  </div>

                  {/* Campo livre se for OUTRO */}
                  {selectedLocation === "OUTRO" ? (
                    <input
                      type="text"
                      value={customLocation}
                      onChange={(e) => handleCustomLocationChange(e.target.value)}
                      placeholder="Digite o local (Ex: Sala de Reunião, Garagem, Almoxarifado)..."
                      className="w-full px-4 py-2.5 rounded-xl text-xs outline-none animate-fade-in"
                      style={styles.input}
                      required
                      autoFocus
                    />
                  ) : selectedLocation && (
                    <input
                      type="text"
                      value={locationComplement}
                      onChange={(e) => handleComplementChange(e.target.value)}
                      placeholder="Ponto de referência opcional (Ex: Mesa 4, Próximo ao elevador, Balcão)..."
                      className="w-full px-4 py-2.5 rounded-xl text-xs outline-none animate-fade-in"
                      style={styles.input}
                    />
                  )}
                  <p className="text-[10px]" style={{ color: "#64748b" }}>Locais físicos e áreas comuns cadastradas do hotel.</p>
                </div>
              )}
            </div>

            {/* Categoria / Subcategoria */}
            <div className="p-5 rounded-2xl space-y-3" style={styles.card}>
              <div className="flex items-center gap-2">
                <Building2 size={16} style={{ color: "#8b5cf6" }} />
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>Categoria do Chamado</label>
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
                    <option value="">Tipo específico de problema...</option>
                    {selectedSubcategory.problem_types.map((pt) => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#64748b" }} />
                </div>
              )}
            </div>

            {/* Título e Descrição */}
            <div className="p-5 rounded-2xl space-y-3" style={styles.card}>
              <div className="flex items-center gap-2">
                <FileText size={16} style={{ color: "#f59e0b" }} />
                <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>
                  O que está acontecendo? <span style={{ color: "#ef4444" }}>*</span>
                </label>
              </div>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: TV do quarto sem imagem, Impressora travada, Wi-Fi oscilando..."
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={styles.input}
                required
              />
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detalhes adicionais (opcional): quando começou, mensagem de erro, etc..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                style={styles.input}
              />
            </div>

            {/* Fotos e Evidências */}
            <div className="p-5 rounded-2xl space-y-3" style={styles.card}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon size={16} style={{ color: "#06b6d4" }} />
                  <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>
                    Fotos / Evidências (Opcional)
                  </label>
                </div>
                <span className="text-[10px]" style={{ color: "#64748b" }}>Max 15MB por foto</span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3.5 px-4 rounded-xl border border-dashed flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
                style={{ borderColor: "rgba(255,255,255,0.15)", background: "rgba(15,23,42,0.4)", color: "#cbd5e1" }}
              >
                <UploadCloud size={18} style={{ color: "#38bdf8" }} />
                <span className="text-xs font-semibold">Tirar Foto ou Anexar Arquivo</span>
              </button>

              {/* Pré-visualização de Imagens e Arquivos */}
              {filePreviews.length > 0 && (
                <div className="grid grid-cols-3 gap-2.5 pt-2 animate-fade-in">
                  {filePreviews.map((p, idx) => (
                    <div key={idx} className="relative rounded-xl overflow-hidden group aspect-square flex flex-col items-center justify-center p-1.5" style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      {p.isImage && p.url ? (
                        <img src={p.url} alt={p.name} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center p-1">
                          <Paperclip size={20} style={{ color: "#94a3b8" }} />
                          <span className="text-[9px] mt-1 line-clamp-1" style={{ color: "#cbd5e1" }}>{p.name}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer shadow-md"
                        style={{ background: "rgba(239,68,68,0.9)", color: "#fff" }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Mensagem de Erro */}
            {error && (
              <div className="rounded-xl p-3 flex items-center gap-2.5 animate-fade-in" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <AlertCircle size={16} style={{ color: "#ef4444" }} />
                <p className="text-xs" style={{ color: "#fca5a5" }}>{error}</p>
              </div>
            )}

            {/* Botão de Envio */}
            <button
              type="submit"
              disabled={submitting || !form.title || !form.location}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-black transition-all cursor-pointer shadow-lg"
              style={form.title && form.location ? styles.btnPrimary : styles.btnDisabled}
            >
              {submitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{uploadStatus || "Registrando chamado..."}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Send size={16} />
                  <span>Registrar Chamado na TI</span>
                </div>
              )}
            </button>
          </form>
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.25s ease-out; }
        select option { background: #1e293b; color: #e2e8f0; }
      `}</style>
    </div>
  );
}

// ─── Estilos Inline Elegantes ───
const styles = {
  bgGradient: {
    background: "linear-gradient(180deg, #0b1120 0%, #172033 50%, #0b1120 100%)",
    minHeight: "100vh",
  },
  header: {
    background: "rgba(11,17,32,0.88)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  card: {
    background: "rgba(30,41,59,0.55)",
    border: "1px solid rgba(255,255,255,0.07)",
    backdropFilter: "blur(10px)",
  },
  input: {
    background: "rgba(11,17,32,0.7)",
    border: "1px solid rgba(255,255,255,0.09)",
    color: "#f1f5f9",
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #2563eb, #7c3aed)",
    color: "#fff",
    boxShadow: "0 4px 18px rgba(37,99,235,0.3)",
  },
  btnSecondary: {
    background: "rgba(255,255,255,0.06)",
    color: "#cbd5e1",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  btnDisabled: {
    background: "rgba(255,255,255,0.04)",
    color: "#475569",
    cursor: "not-allowed",
  },
  btnGhost: {
    color: "#94a3b8",
  },
  resultItem: {
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
};
