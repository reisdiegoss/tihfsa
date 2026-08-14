import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Send, ArrowLeft, MapPin, UploadCloud, X, File as FileIcon } from "lucide-react";
import { useDropzone } from "react-dropzone";
import api from "../../api/client";
import { useAuth } from "../../contexts/AuthContext";

export default function NewTicket() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Data from API
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [assets, setAssets] = useState([]);
  const [locations, setLocations] = useState([]);
  const [requesterAssets, setRequesterAssets] = useState([]);
  
  // Selections
  const [departmentId, setDepartmentId] = useState("");
  const [requesterId, setRequesterId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [problemTypeId, setProblemTypeId] = useState("");
  
  // Text fields
  const [customTitle, setCustomTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Média");
  
  // Attachments
  const [files, setFiles] = useState([]);
  
  const [loading, setLoading] = useState(false);

  // Load initial data
  useEffect(() => {
    api.get("/departments/").then(r => setDepartments(r.data)).catch(console.error);
    api.get("/categories/").then(r => setCategories(r.data)).catch(console.error);
    api.get("/locations/").then(r => setLocations(r.data)).catch(console.error);
  }, []);

  // Fetch assets when category or requester changes
  useEffect(() => {
    if (categoryId) {
      let url = `/assets/?category_id=${categoryId}`;
      if (requesterId) {
        url += `&assigned_user_id=${requesterId}`;
      }
      api.get(url)
        .then(r => {
          setAssets(r.data);
        })
        .catch(console.error);
    } else {
      setAssets([]);
    }
  }, [categoryId, requesterId]);

  // Handle location auto-population from asset
  useEffect(() => {
    if (assetId) {
      const selectedAsset = assets.find(a => a.id === Number(assetId));
      if (selectedAsset && selectedAsset.location_id) {
        setLocation(selectedAsset.location_id.toString());
      }
    }
  }, [assetId, assets]);

  // Load users when department changes
  useEffect(() => {
    if (departmentId) {
      api.get(`/users/simple?department_id=${departmentId}`).then(r => {
        setUsers(r.data);
        setRequesterId(""); // reset
      }).catch(console.error);
    } else {
      setUsers([]);
      setRequesterId("");
    }
  }, [departmentId]);

  // Load requester assets when requester changes
  useEffect(() => {
    if (requesterId) {
      api.get(`/assets/?assigned_user_id=${requesterId}`).then(r => {
        setRequesterAssets(r.data);
      }).catch(console.error);
    } else {
      setRequesterAssets([]);
    }
  }, [requesterId]);

  // Categories filtering based on requester assets and globals
  const displayedCategories = categories.filter(c => {
    if (requesterAssets.length === 0) return true; // Show all if no assets
    const hasCategory = requesterAssets.some(a => a.category_id === c.id);
    return c.is_global || hasCategory;
  });

  const selectedCategory = categories.find(c => c.id === Number(categoryId));
  const problemTypes = selectedCategory?.problem_types || [];

  const onDrop = useCallback(acceptedFiles => {
    setFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'application/pdf': ['.pdf']
    }
  });

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!requesterId) return alert("Selecione o solicitante.");
    if (!categoryId) return alert("Selecione a categoria.");
    
    // Determine the title
    let finalTitle = "";
    if (problemTypeId === "other") {
      if (!customTitle) return alert("Informe o problema.");
      finalTitle = customTitle;
    } else if (problemTypeId) {
      const pt = problemTypes.find(p => p.id === Number(problemTypeId));
      finalTitle = pt ? pt.name : customTitle;
    } else {
      finalTitle = customTitle || "Incidente";
    }

    if (location) {
      const locObj = locations.find(l => l.id === Number(location));
      const locName = locObj ? locObj.name : location;
      finalTitle = `[${locName.toUpperCase()}] ${finalTitle}`;
    }

    setLoading(true);
    try {
      // 1. Create Ticket
      const ticketRes = await api.post("/tickets/", {
        title: finalTitle,
        description: description || null,
        priority,
        requester_id: Number(requesterId),
        technician_id: user.id,
        category_id: Number(categoryId),
        problem_type_id: problemTypeId && problemTypeId !== "other" ? Number(problemTypeId) : null,
        asset_id: assetId ? Number(assetId) : null,
      });

      const ticketId = ticketRes.data.id;

      // 2. Upload Attachments
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        await api.post(`/tickets/${ticketId}/attachments`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      }

      navigate("/admin/tickets");
    } catch (error) {
      console.error(error);
      alert("Erro ao criar chamado.");
    } finally {
      setLoading(false);
    }
  };

  const priorities = [
    { value: "Baixa", color: "border-slate-500 bg-slate-50 text-slate-700" },
    { value: "Média", color: "border-blue-600 bg-blue-50 text-blue-700" },
    { value: "Alta", color: "border-amber-500 bg-amber-50 text-amber-700" },
    { value: "Crítica", color: "border-red-600 bg-red-50 text-red-700" },
  ];

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-4xl mx-auto">
      
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Novo Chamado Técnico</h1>
          <p className="text-sm font-semibold text-slate-500 mt-1">Siga o fluxo para registrar o incidente</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Setor e Usuário */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs">1</span>
            Identificação
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Setor / OU</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              >
                <option value="">Selecione o setor...</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Solicitante <span className="text-red-500">*</span></label>
              <select
                required
                value={requesterId}
                onChange={(e) => setRequesterId(e.target.value)}
                disabled={!departmentId}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-50"
              >
                <option value="">{departmentId ? "Selecione o usuário..." : "Selecione o setor primeiro"}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.display_name} {u.is_room ? `(UH ${u.room_number})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Classificação */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs">2</span>
            Classificação do Incidente
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Categoria <span className="text-red-500">*</span></label>
                <select
                  required
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setAssetId("");
                    setProblemTypeId("");
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                >
                  <option value="">Selecione a categoria...</option>
                  {displayedCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {categoryId && (
                <div className="space-y-2 animate-fade-in">
                  <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Item / Ativo (CMDB)</label>
                  <select
                    value={assetId}
                    onChange={(e) => setAssetId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 cursor-pointer"
                  >
                    <option value="">Nenhum / Não aplicável</option>
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} {a.location_name ? `📍 ${a.location_name}` : ""} {a.ip_address ? `(${a.ip_address})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {categoryId && (
                <div className="space-y-2 animate-fade-in">
                  <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Problema Reportado <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={problemTypeId}
                    onChange={(e) => setProblemTypeId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  >
                    <option value="">Selecione o problema...</option>
                    {problemTypes.map((pt) => (
                      <option key={pt.id} value={pt.id}>{pt.name}</option>
                    ))}
                    <option value="other">Outro (Especificar)</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detalhamento */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs">3</span>
            Detalhamento
          </h2>
          <div className="space-y-6">
            
            {(!categoryId || problemTypeId === "other") && (
              <div className="space-y-2 animate-fade-in">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Título Resumido <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Ex: Wi-Fi lento no Restaurante"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <MapPin size={12} /> Local / UH Onde o problema ocorre
              </label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              >
                <option value="">Selecione o local...</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Descrição Detalhada</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.max(100, e.target.scrollHeight)}px`;
                }}
                placeholder="Descreva o cenário, testes já realizados..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 resize-none overflow-hidden min-h-[100px]"
              />
            </div>
            
            {/* Anexos */}
            <div className="space-y-2">
              <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Anexos (Imagens, PDFs)</label>
              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${
                  isDragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                }`}
              >
                <input {...getInputProps()} />
                <UploadCloud size={32} className="mx-auto text-slate-400 mb-2" />
                <p className="text-sm font-bold text-slate-700">Clique ou arraste arquivos aqui</p>
                <p className="text-xs font-medium text-slate-500 mt-1">JPG, PNG, WEBP ou PDF</p>
              </div>

              {files.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  {files.map((file, i) => (
                    <div key={i} className="bg-slate-100 border border-slate-200 rounded-xl p-2 relative flex items-center gap-2 group">
                      <button 
                        type="button" 
                        onClick={() => removeFile(i)}
                        className="absolute -top-2 -right-2 bg-white border border-slate-200 text-slate-500 hover:text-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={14} />
                      </button>
                      <div className="w-8 h-8 rounded bg-white flex items-center justify-center shrink-0">
                        {file.type.includes("image") ? (
                          <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover rounded" />
                        ) : (
                          <FileIcon size={16} className="text-slate-400" />
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-700 truncate">{file.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Prioridade e Submit */}
        <div className="flex flex-col md:flex-row gap-6 items-end">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex-1 w-full">
            <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block mb-3">Nível de Prioridade</label>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {priorities.map((prio) => (
                <label
                  key={prio.value}
                  className={`flex items-center justify-center py-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                    priority === prio.value
                      ? prio.color
                      : "border-slate-100 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="priority"
                    value={prio.value}
                    checked={priority === prio.value}
                    onChange={(e) => setPriority(e.target.value)}
                    className="hidden"
                  />
                  <span className="font-bold text-sm">{prio.value}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex-shrink-0 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 rounded-3xl font-bold shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 cursor-pointer w-full md:w-auto h-fit"
          >
            {loading ? "Registrando..." : "Registrar Chamado"}
            <Send size={18} />
          </button>
        </div>

      </form>
    </div>
  );
}
