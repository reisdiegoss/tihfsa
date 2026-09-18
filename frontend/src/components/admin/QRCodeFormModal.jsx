import { useState, useEffect, useRef } from "react";
import { 
  X, Wifi, Laptop, Save, RefreshCw, Eye, 
  Sparkles, CheckCircle2, AlertCircle, ShieldCheck, Lock, Building2, User, MapPin, MessageSquare
} from "lucide-react";
import api from "../../api/client";
import { formatWifiPayload, formatEquipmentPayload, renderQRCodeToCanvas } from "../../utils/qrGenerator";

export default function QRCodeFormModal({ isOpen, onClose, editingItem, defaultLogoUrl, onSaved }) {
  const [activeTab, setActiveTab] = useState("equipment"); // "equipment" | "wifi"
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [assetsList, setAssetsList] = useState([]);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    company: "Hotel Fasano Salvador",
    // Wi-Fi
    ssid: "",
    password: "",
    security_type: "WPA",
    is_hidden: false,
    // Equipamento
    collaborator: "",
    asset_name: "",
    brand: "",
    model: "",
    address: "",
    message: "",
    asset_id: null,
    encode_mode: "vcard",
    // Visual
    include_logo: true,
  });

  const canvasRef = useRef(null);

  // Carregar lista de ativos cadastrados no CMDB para sugestão rápida
  useEffect(() => {
    if (isOpen) {
      api.get("/assets/?limit=100")
        .then((res) => {
          if (res.data?.items) setAssetsList(res.data.items);
          else if (Array.isArray(res.data)) setAssetsList(res.data);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Preencher dados na abertura
  useEffect(() => {
    if (isOpen) {
      setErrorMsg("");
      if (editingItem) {
        setActiveTab(editingItem.type || "equipment");
        setFormData({
          title: editingItem.title || "",
          company: editingItem.company || "Hotel Fasano Salvador",
          ssid: editingItem.ssid || "",
          password: editingItem.password || "",
          security_type: editingItem.security_type || "WPA",
          is_hidden: editingItem.is_hidden || false,
          collaborator: editingItem.collaborator || "",
          asset_name: editingItem.asset_name || "",
          brand: editingItem.brand || "",
          model: editingItem.model || "",
          address: editingItem.address || "",
          message: editingItem.message || "",
          asset_id: editingItem.asset_id || null,
          encode_mode: editingItem.encode_mode || "vcard",
          include_logo: editingItem.include_logo !== false,
        });
      } else {
        // Novo item limpo
        setFormData({
          title: "",
          company: "Hotel Fasano Salvador",
          ssid: "",
          password: "",
          security_type: "WPA",
          is_hidden: false,
          collaborator: "",
          asset_name: "",
          brand: "",
          model: "",
          address: "",
          message: "Em caso de perda ou dúvidas, favor entrar em contato com o suporte de TI (Ramal 8000).",
          asset_id: null,
          encode_mode: "vcard",
          include_logo: true,
        });
      }
    }
  }, [isOpen, editingItem]);

  // Atualizar preview ao vivo no canvas
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    let payloadText = "";
    if (activeTab === "wifi") {
      const ssid = formData.ssid || "WiFi-Fasano-Evento";
      const pwd = formData.password || "";
      payloadText = formatWifiPayload(ssid, pwd, formData.security_type, formData.is_hidden);
    } else {
      payloadText = formatEquipmentPayload({
        code: editingItem?.code || "QR-PREVIEW",
        company: formData.company,
        asset_name: formData.asset_name,
        title: formData.title,
        collaborator: formData.collaborator,
        brand: formData.brand,
        model: formData.model,
        address: formData.address,
        message: formData.message,
        encode_mode: formData.encode_mode || "vcard",
      }, formData.encode_mode || "vcard");
    }

    renderQRCodeToCanvas(canvasRef.current, {
      text: payloadText,
      size: 280,
      logoUrl: defaultLogoUrl,
      includeLogo: formData.include_logo,
    });
  }, [isOpen, activeTab, formData, defaultLogoUrl, editingItem]);

  const handleAssetSelect = (e) => {
    const assetId = e.target.value;
    if (!assetId) {
      setFormData((prev) => ({ ...prev, asset_id: null }));
      return;
    }
    const found = assetsList.find((a) => String(a.id) === String(assetId));
    if (found) {
      setFormData((prev) => ({
        ...prev,
        asset_id: found.id,
        asset_name: found.name || found.asset_tag || "",
        brand: found.brand || "",
        model: found.model || "",
        collaborator: found.assigned_user_name || prev.collaborator,
        address: found.location_name || prev.address,
        title: prev.title || `${found.name} - ${found.brand || ""} ${found.model || ""}`.trim(),
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!formData.title.trim()) {
      setErrorMsg("Informe um título ou identificação para o QR Code.");
      return;
    }

    if (activeTab === "wifi" && !formData.ssid.trim()) {
      setErrorMsg("Informe o nome da rede Wi-Fi (SSID).");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        type: activeTab,
        title: formData.title.trim(),
        company: formData.company.trim(),
        ssid: activeTab === "wifi" ? formData.ssid.trim() : null,
        password: activeTab === "wifi" ? formData.password : null,
        security_type: activeTab === "wifi" ? formData.security_type : null,
        is_hidden: activeTab === "wifi" ? formData.is_hidden : false,
        collaborator: activeTab === "equipment" ? formData.collaborator.trim() : null,
        asset_name: activeTab === "equipment" ? formData.asset_name.trim() : null,
        brand: activeTab === "equipment" ? formData.brand.trim() : null,
        model: activeTab === "equipment" ? formData.model.trim() : null,
        address: activeTab === "equipment" ? formData.address.trim() : null,
        message: activeTab === "equipment" ? formData.message.trim() : null,
        asset_id: activeTab === "equipment" ? formData.asset_id : null,
        encode_mode: formData.encode_mode || "vcard",
        include_logo: formData.include_logo,
      };

      if (editingItem) {
        await api.put(`/qrcodes/${editingItem.id}`, payload);
      } else {
        await api.post("/qrcodes/", payload);
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error("Erro ao salvar QR Code:", err);
      setErrorMsg(err.response?.data?.detail || "Erro ao salvar informações do QR Code.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              activeTab === "wifi" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
            }`}>
              {activeTab === "wifi" ? <Wifi size={22} /> : <Laptop size={22} />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {editingItem ? "Editar QR Code" : "Novo QR Code para Evento / Equipamento"}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Gere e personalize códigos com a logo da empresa centralizada
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          
          {/* Formulário (7 Colunas) */}
          <form onSubmit={handleSubmit} className="md:col-span-7 p-6 space-y-4">
            {errorMsg && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2 border border-red-100">
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Selector de Tipo (Abas) */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Tipo de QR Code
              </label>
              <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setActiveTab("equipment")}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "equipment"
                      ? "bg-white text-emerald-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Laptop size={16} />
                  <span>🏷️ Equipamento</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("wifi")}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "wifi"
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Wifi size={16} />
                  <span>📶 Wi-Fi de Eventos</span>
                </button>
              </div>
            </div>

            {/* Título e Empresa */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Título / Identificador <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={activeTab === "wifi" ? "Ex: Wi-Fi Casamento Silva" : "Ex: MacBook Pro Diretor"}
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Empresa / Evento
                </label>
                <input
                  type="text"
                  placeholder="Hotel Fasano Salvador"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                />
              </div>
            </div>

            {/* Campos Específicos: WI-FI */}
            {activeTab === "wifi" && (
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800">
                  <Wifi size={15} />
                  <span>Parâmetros de Conexão Automática</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome da Rede (SSID) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Fasano_Evento_VIP"
                    value={formData.ssid}
                    onChange={(e) => setFormData({ ...formData, ssid: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Senha da Rede
                    </label>
                    <input
                      type="text"
                      placeholder="Senha do Wi-Fi (opcional se aberta)"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Criptografia / Segurança
                    </label>
                    <select
                      value={formData.security_type}
                      onChange={(e) => setFormData({ ...formData, security_type: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                    >
                      <option value="WPA">WPA / WPA2 / WPA3 (Padrão)</option>
                      <option value="WEP">WEP</option>
                      <option value="nopass">Sem Senha (Rede Aberta)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="is_hidden"
                    checked={formData.is_hidden}
                    onChange={(e) => setFormData({ ...formData, is_hidden: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="is_hidden" className="text-xs font-semibold text-slate-600 cursor-pointer">
                    Rede com SSID Oculto (Hidden Network)
                  </label>
                </div>

                <p className="text-[11px] text-blue-700 leading-tight">
                  ✨ <strong>Compatibilidade Universal:</strong> Ao ler o QR Code, celulares <strong>Android</strong> e <strong>iPhone (iOS)</strong> conectam automaticamente sem digitar a senha.
                </p>
              </div>
            )}

            {/* Campos Específicos: EQUIPAMENTO */}
            {activeTab === "equipment" && (
              <div className="space-y-3">
                {/* Vínculo Opcional com CMDB */}
                {assetsList.length > 0 && !editingItem && (
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Preencher com Ativo existente no CMDB (Opcional):
                    </label>
                    <select
                      onChange={handleAssetSelect}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 outline-none"
                    >
                      <option value="">-- Selecionar equipamento cadastrado para auto-preencher --</option>
                      {assetsList.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.brand || ""} {a.model || ""}) {a.asset_tag ? `[Tag: ${a.asset_tag}]` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Colaborador / Responsável
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: João da Silva"
                      value={formData.collaborator}
                      onChange={(e) => setFormData({ ...formData, collaborator: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nome do Equipamento / Hostname / Patrimônio
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: NB-FASANO-042"
                      value={formData.asset_name}
                      onChange={(e) => setFormData({ ...formData, asset_name: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Marca
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Apple, Dell, Lenovo"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Modelo
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: MacBook Air 13 M2"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Endereço / Localização
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Prédio Histórico, Sala de Eventos 2 / Recepção"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Uma Mensagem Personalizada
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Equipamento de propriedade do Hotel Fasano Salvador. Em caso de perda, favor devolver na Recepção ou ligar para o ramal 8000."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none resize-none"
                  />
                </div>
              </div>
            )}

            {/* Toggle de Logo Central */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-700">Incluir Logo Central da Empresa</p>
                <p className="text-[11px] text-slate-400">Insere o PNG da marca no centro do código com correção de erro H</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.include_logo}
                  onChange={(e) => setFormData({ ...formData, include_logo: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-blue-500/20 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    <span>{editingItem ? "Salvar Alterações" : "Emitir e Registrar"}</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Coluna Direita: Preview Dinâmico do QR Code (5 Colunas) */}
          <div className="md:col-span-5 p-6 bg-slate-50/70 flex flex-col items-center justify-center">
            <div className="text-center mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-white text-slate-700 border border-slate-200 shadow-2xs">
                <Eye size={12} className="text-blue-500" />
                Pré-visualização em Tempo Real
              </span>
              <p className="text-xs text-slate-400 font-medium mt-1">
                {activeTab === "wifi" ? "Scan direto para Wi-Fi" : "Ficha Digital Web Universal (iOS / Android)"}
              </p>
            </div>

            {/* Container do Canvas */}
            <div className="p-4 bg-white rounded-3xl shadow-md border border-slate-200/80 flex flex-col items-center justify-center">
              <canvas ref={canvasRef} className="max-w-[240px] max-h-[240px] w-full h-auto rounded-xl" />

              <div className="mt-3 text-center">
                <p className="text-xs font-extrabold text-slate-800 line-clamp-1">
                  {formData.title || "QR Code de Evento"}
                </p>
                <p className="text-[11px] font-semibold text-slate-400">
                  {formData.company || "Hotel Fasano Salvador"}
                </p>
              </div>
            </div>

            <div className="mt-4 max-w-xs text-center text-[11px] text-slate-500 leading-tight">
              {activeTab === "wifi" ? (
                <span>
                  📶 <strong>SSID:</strong> {formData.ssid || "—"} | <strong>Segurança:</strong> {formData.security_type}
                </span>
              ) : (
                <span>
                  📱 Ao escanear, o iPhone ou Android abrirá a ficha digital com todos os dados cadastrados.
                </span>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
