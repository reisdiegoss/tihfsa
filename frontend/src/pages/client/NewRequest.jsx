/**
 * NewRequest — formulário PWA do usuário com estilo moderno e seletor inteligente de UH vs Local Físico.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  MapPin,
  Building2,
  Hotel,
  ChevronDown,
} from "lucide-react";
import api from "../../api/client";
import { useAuth } from "../../contexts/AuthContext";

export default function NewRequest() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [currentUserData, setCurrentUserData] = useState(null);

  // Estados de localização
  const [locationType, setLocationType] = useState("LOCAL"); // "LOCAL" | "UH"
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const [locationComplement, setLocationComplement] = useState("");

  const [form, setForm] = useState({
    category_id: null,
    subcategory_id: null,
    location: "",
    title: "",
    description: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // 1. Categorias (já filtradas no backend por is_public para colaborador)
    api.get("/categories").then((r) => setCategories(r.data)).catch(console.error);

    // 2. Locais físicos
    api.get("/public/locations").then((r) => setLocations(r.data)).catch(() => {
      api.get("/locations").then((r) => setLocations(r.data)).catch(console.error);
    });

    // 3. UHs cadastradas
    api.get("/public/rooms").then((r) => setRooms(r.data)).catch(console.error);

    // 4. Perfil completo do usuário (para detectar setor e contexto)
    api.get("/auth/me").then((r) => {
      setCurrentUserData(r.data);
      applyDepartmentContext(r.data);
    }).catch(() => {
      if (user) applyDepartmentContext(user);
    });
  }, []);

  const applyDepartmentContext = (userData) => {
    const dept = (userData?.department_name || userData?.department || "").toLowerCase();
    if (userData?.is_room || dept.includes("govern") || dept.includes("camareira") || dept.includes("hospedag")) {
      setLocationType("UH");
      if (userData?.room_number) {
        setSelectedRoom(userData.room_number);
        setForm((prev) => ({ ...prev, location: `UH ${userData.room_number}` }));
      }
    } else {
      setLocationType("LOCAL");
      if (dept.includes("a&b") || dept.includes("alimento") || dept.includes("bar") || dept.includes("restaurante")) {
        setSelectedLocation("Gero");
        setForm((prev) => ({ ...prev, location: "Gero" }));
      } else if (dept.includes("recep") || dept.includes("front") || dept.includes("portaria")) {
        setSelectedLocation("Recepção/Lobby");
        setForm((prev) => ({ ...prev, location: "Recepção/Lobby" }));
      }
    }
  };

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
          const finalLoc = locationComplement.trim()
            ? `${selectedLocation} - ${locationComplement.trim()}`
            : selectedLocation;
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
    } else if (locName) {
      const finalLoc = locationComplement.trim()
        ? `${locName} - ${locationComplement.trim()}`
        : locName;
      setForm((prev) => ({ ...prev, location: finalLoc.toUpperCase() }));
    } else {
      setForm((prev) => ({ ...prev, location: "" }));
    }
  };

  const handleComplementChange = (val) => {
    setLocationComplement(val);
    if (selectedLocation && selectedLocation !== "OUTRO") {
      const finalLoc = val.trim() ? `${selectedLocation} - ${val.trim()}` : selectedLocation;
      setForm((prev) => ({ ...prev, location: finalLoc.toUpperCase() }));
    }
  };

  const handleCustomLocationChange = (val) => {
    setCustomLocation(val);
    setForm((prev) => ({ ...prev, location: val.trim().toUpperCase() }));
  };

  const selectedCategory = categories.find((c) => c.id === form.category_id);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.location) return;
    setLoading(true);

    // Concatena a Localização no título para que a TI visualize de imediato
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
        <button
          onClick={() => navigate("/app")}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-bold text-slate-900">Abrir Novo Chamado</h1>
      </header>

      <form onSubmit={submit} className="max-w-lg mx-auto p-4 sm:p-6 space-y-4">

        {/* Localização (UH vs Local Físico) */}
        <div className="bg-white rounded-2xl p-5 border border-blue-200 shadow-sm shadow-blue-500/10 space-y-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-blue-600" />
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Onde é o problema? <span className="text-red-500">*</span>
              </label>
            </div>
            {form.location && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md text-blue-700 bg-blue-50 border border-blue-200">
                {form.location}
              </span>
            )}
          </div>

          {/* Toggle Pills: Local Físico vs Apartamento / UH */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => handleSwitchLocationType("LOCAL")}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                locationType === "LOCAL"
                  ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
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
                  ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Hotel size={13} />
              <span>Apartamento / UH</span>
            </button>
          </div>

          {/* MODO 1: Apartamento / UH */}
          {locationType === "UH" && (
            <div className="space-y-2 animate-fade-in">
              <div className="relative">
                <select
                  value={selectedRoom}
                  onChange={(e) => handleSelectRoom(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer"
                  required={locationType === "UH"}
                >
                  <option value="">Selecione o Quarto / UH...</option>
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
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              </div>
              <p className="text-[10px] text-slate-400">Selecione o quarto onde o problema ocorre.</p>
            </div>
          )}

          {/* MODO 2: Local Físico / Setor */}
          {locationType === "LOCAL" && (
            <div className="space-y-3 animate-fade-in">
              <div className="relative">
                <select
                  value={selectedLocation}
                  onChange={(e) => handleSelectLocation(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-xs sm:text-sm bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer"
                  required={locationType === "LOCAL"}
                >
                  <option value="">Selecione o Local Físico...</option>
                  {locations.map((loc) => {
                    const deptName = currentUserData?.department_name || "";
                    const deptId = currentUserData?.department_id || null;
                    const isMatchDept = Boolean(
                      (deptId && loc.department_ids && loc.department_ids.includes(deptId)) ||
                      (deptName && loc.department_names && loc.department_names.some(d => d.toLowerCase() === deptName.toLowerCase())) ||
                      (deptName && (
                        (deptName.toLowerCase().includes("a&b") && ["gero", "bar da piscina"].some(k => loc.name.toLowerCase().includes(k))) ||
                        (deptName.toLowerCase().includes("recep") && loc.name.toLowerCase().includes("recep"))
                      ))
                    );
                    return (
                      <option key={loc.id} value={loc.name}>
                        {loc.name} {loc.floor ? `(${loc.floor})` : ""} {isMatchDept ? "⭐ [Seu Setor]" : (loc.department_names?.length ? `• ${loc.department_names.join(", ")}` : "")}
                      </option>
                    );
                  })}
                  <option value="OUTRO">Outro Local (Digitar Manualmente)...</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              </div>

              {selectedLocation === "OUTRO" ? (
                <input
                  type="text"
                  value={customLocation}
                  onChange={(e) => handleCustomLocationChange(e.target.value)}
                  placeholder="Digite o local (Ex: Garagem, Almoxarifado, Sala de Treinamento)..."
                  className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  required
                  autoFocus
                />
              ) : selectedLocation && (
                <input
                  type="text"
                  value={locationComplement}
                  onChange={(e) => handleComplementChange(e.target.value)}
                  placeholder="Ponto de referência opcional (Ex: Balcão, Mesa 3, Próximo ao elevador)..."
                  className="w-full px-4 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              )}
              <p className="text-[10px] text-slate-400">Locais e setores das áreas operacionais do hotel.</p>
            </div>
          )}
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

          {selectedCategory && selectedCategory.subcategories && selectedCategory.subcategories.length > 0 && (
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
              placeholder="Ex: TV sem sinal, Telefone mudo, Ponto de rede falhando..."
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

