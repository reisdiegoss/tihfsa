import { useState, useEffect, useRef, useMemo } from "react";
import { 
  QrCode, Plus, Search, Filter, RefreshCw, Wifi, Laptop, 
  Download, Edit2, Trash2, Image as ImageIcon, CheckCircle2, 
  Layers, ExternalLink, Calendar, MapPin, User, Building2, AlertCircle
} from "lucide-react";
import api from "../../api/client";
import { formatWifiPayload, formatEquipmentPayload, renderQRCodeToCanvas } from "../../utils/qrGenerator";
import QRCodeFormModal from "../../components/admin/QRCodeFormModal";
import QRCodeExportModal from "../../components/admin/QRCodeExportModal";
import QRCodeLogoModal from "../../components/admin/QRCodeLogoModal";

// Sub-componente para renderizar a miniatura do QR Code em cada card
function QRCodeThumbnail({ item, defaultLogoUrl }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !item) return;

    let payloadText = "";
    if (item.type === "wifi") {
      payloadText = formatWifiPayload(item.ssid, item.password, item.security_type, item.is_hidden);
    } else {
      payloadText = formatEquipmentPayload(item);
    }

    renderQRCodeToCanvas(canvasRef.current, {
      text: payloadText,
      size: 160,
      logoUrl: item.logo_url || defaultLogoUrl,
      includeLogo: item.include_logo !== false,
    });
  }, [item, defaultLogoUrl]);

  return (
    <div className="w-20 h-20 bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-center shrink-0">
      <canvas ref={canvasRef} className="w-full h-full object-contain rounded-lg" />
    </div>
  );
}

export default function QRCodeManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all"); // "all" | "equipment" | "wifi"
  const [defaultLogoUrl, setDefaultLogoUrl] = useState(null);

  // Modais
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [selectedExportItem, setSelectedExportItem] = useState(null);

  const [logoModalOpen, setLogoModalOpen] = useState(false);

  // Deletar confirmação
  const [deletingId, setDeletingId] = useState(null);

  // Buscar itens da API
  const fetchItems = async () => {
    setLoading(true);
    try {
      const [qrRes, logoRes] = await Promise.allSettled([
        api.get("/qrcodes/"),
        api.get("/qrcodes/logo"),
      ]);

      if (qrRes.status === "fulfilled" && qrRes.value.data?.items) {
        setItems(qrRes.value.data.items);
      }
      if (logoRes.status === "fulfilled" && logoRes.value.data?.default_logo_url) {
        setDefaultLogoUrl(logoRes.value.data.default_logo_url);
      }
    } catch (err) {
      console.error("Erro ao carregar QR Codes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  // Exclusão
  const handleDelete = async (id) => {
    if (!window.confirm("Deseja realmente excluir este QR Code?")) return;
    setDeletingId(id);
    try {
      await api.delete(`/qrcodes/${id}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error("Erro ao excluir QR Code:", err);
      alert("Erro ao excluir o QR Code.");
    } finally {
      setDeletingId(null);
    }
  };

  // Filtragem
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedType !== "all" && item.type !== selectedType) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchTitle = item.title?.toLowerCase().includes(term);
        const matchCompany = item.company?.toLowerCase().includes(term);
        const matchCollaborator = item.collaborator?.toLowerCase().includes(term);
        const matchAsset = item.asset_name?.toLowerCase().includes(term);
        const matchSsid = item.ssid?.toLowerCase().includes(term);
        const matchCode = item.code?.toLowerCase().includes(term);
        return matchTitle || matchCompany || matchCollaborator || matchAsset || matchSsid || matchCode;
      }
      return true;
    });
  }, [items, selectedType, searchTerm]);

  // Contadores
  const wifiCount = items.filter((i) => i.type === "wifi").length;
  const equipCount = items.filter((i) => i.type === "equipment").length;

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <QrCode size={22} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Gerenciador de QR Codes
              </h1>
              <p className="text-xs font-semibold text-slate-400">
                Emissão de QR Codes para Equipamentos e Conexão Wi-Fi de Eventos
              </p>
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setLogoModalOpen(true)}
            className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-2xl border border-slate-200 transition-all cursor-pointer flex items-center gap-2 shadow-2xs"
            title="Cadastrar ou alterar a logo da empresa no centro dos QR Codes"
          >
            <ImageIcon size={16} className="text-blue-600" />
            <span>{defaultLogoUrl ? "Alterar Logo Central" : "Cadastrar Logo Central"}</span>
          </button>

          <button
            onClick={() => {
              setEditingItem(null);
              setFormModalOpen(true);
            }}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-2xl shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-2"
          >
            <Plus size={16} />
            <span>Novo QR Code</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas Rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total de QR Codes</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{items.length}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <QrCode size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Wi-Fi de Eventos</p>
            <p className="text-2xl font-black text-blue-600 mt-1">{wifiCount}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Wifi size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Equipamentos / Tags</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{equipCount}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Laptop size={24} />
          </div>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Barra de Busca */}
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl w-full md:w-96 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 transition-all">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Buscar por título, SSID, colaborador, patrimônio..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent text-xs font-medium text-slate-800 placeholder-slate-400 outline-none w-full"
          />
        </div>

        {/* Abas de Tipo */}
        <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl w-full md:w-auto">
          <button
            onClick={() => setSelectedType("all")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedType === "all"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Todos ({items.length})
          </button>
          <button
            onClick={() => setSelectedType("wifi")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              selectedType === "wifi"
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Wifi size={13} />
            <span>Wi-Fi ({wifiCount})</span>
          </button>
          <button
            onClick={() => setSelectedType("equipment")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              selectedType === "equipment"
                ? "bg-white text-emerald-700 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Laptop size={13} />
            <span>Equipamentos ({equipCount})</span>
          </button>
        </div>
      </div>

      {/* Grid de Cards de QR Codes */}
      {loading ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center text-center">
          <RefreshCw size={28} className="animate-spin text-blue-600 mb-3" />
          <p className="text-sm font-bold text-slate-700">Carregando registros de QR Codes...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
            <QrCode size={32} />
          </div>
          <h3 className="text-base font-bold text-slate-800">Nenhum QR Code encontrado</h3>
          <p className="text-xs text-slate-400 max-w-sm mt-1">
            {searchTerm
              ? "Nenhum resultado corresponde à sua pesquisa. Tente ajustar os termos."
              : "Cadastre seu primeiro QR Code para rede Wi-Fi de eventos ou equipamentos corporativos."}
          </p>
          <button
            onClick={() => {
              setEditingItem(null);
              setFormModalOpen(true);
            }}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            + Cadastrar Novo QR Code
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const isWifi = item.type === "wifi";

            return (
              <div
                key={item.id}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition-all p-5 flex flex-col justify-between group"
              >
                <div>
                  {/* Topo do Card com Badge e Ações Rápidas */}
                  <div className="flex items-start justify-between gap-3 mb-3.5">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                      isWifi
                        ? "bg-blue-50 text-blue-700 border border-blue-100"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                    }`}>
                      {isWifi ? <Wifi size={12} /> : <Laptop size={12} />}
                      {isWifi ? "Wi-Fi Evento" : "Equipamento"}
                    </span>

                    <span className="text-[10px] font-bold font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                      {item.code}
                    </span>
                  </div>

                  {/* Corpo: Miniatura QR + Informações Principais */}
                  <div className="flex items-center gap-3.5 mb-4">
                    <QRCodeThumbnail item={item} defaultLogoUrl={defaultLogoUrl} />

                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-extrabold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-[11px] font-semibold text-slate-400 truncate">
                        {item.company || "Hotel Fasano Salvador"}
                      </p>

                      {isWifi ? (
                        <div className="mt-1.5 space-y-0.5 text-xs">
                          <p className="text-slate-700 font-bold truncate">
                            <span className="text-slate-400 font-normal">SSID:</span> {item.ssid}
                          </p>
                          <p className="text-slate-500 text-[11px] truncate">
                            <span className="text-slate-400">Senha:</span> {item.password || "Aberta"}
                          </p>
                        </div>
                      ) : (
                        <div className="mt-1.5 space-y-0.5 text-xs">
                          <p className="text-slate-700 font-bold truncate">
                            <span className="text-slate-400 font-normal">Item:</span> {item.asset_name || "—"}
                          </p>
                          <p className="text-slate-500 text-[11px] truncate">
                            <span className="text-slate-400">Resp:</span> {item.collaborator || "—"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Detalhes extras */}
                  <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
                    {item.address && (
                      <p className="flex items-center gap-1.5 truncate">
                        <MapPin size={12} className="text-slate-400 shrink-0" />
                        <span className="truncate">{item.address}</span>
                      </p>
                    )}
                    {item.created_at && (
                      <p className="flex items-center gap-1.5 text-slate-400 text-[10px]">
                        <Calendar size={12} className="shrink-0" />
                        <span>Criado em {new Date(item.created_at).toLocaleDateString("pt-BR")}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Barra de Ações no Rodapé do Card */}
                <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setSelectedExportItem(item);
                      setExportModalOpen(true);
                    }}
                    className="flex-1 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                    title="Emitir, ajustar resolução e baixar imagem ou imprimir display de mesa"
                  >
                    <Download size={13} />
                    <span>Emitir / Baixar</span>
                  </button>

                  <button
                    onClick={() => {
                      setEditingItem(item);
                      setFormModalOpen(true);
                    }}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
                    title="Editar informações deste QR Code"
                  >
                    <Edit2 size={15} />
                  </button>

                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                    title="Excluir QR Code"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modais Integrados */}
      <QRCodeFormModal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        editingItem={editingItem}
        defaultLogoUrl={defaultLogoUrl}
        onSaved={fetchItems}
      />

      <QRCodeExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        item={selectedExportItem}
        defaultLogoUrl={defaultLogoUrl}
      />

      <QRCodeLogoModal
        isOpen={logoModalOpen}
        onClose={() => setLogoModalOpen(false)}
        onLogoUpdated={(newLogoUrl) => setDefaultLogoUrl(newLogoUrl)}
      />
    </div>
  );
}
