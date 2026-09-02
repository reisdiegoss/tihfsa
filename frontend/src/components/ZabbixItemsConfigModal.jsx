import { useState, useEffect } from "react";
import { X, Server, RefreshCw, Save, Plus, Trash2, Tag, Activity, Search } from "lucide-react";
import api from "../api/client";

const MONITOR_TYPES = [
  { value: "TRAFFIC_IN", label: "Tráfego de Entrada (Bits received)" },
  { value: "TRAFFIC_OUT", label: "Tráfego de Saída (Bits sent)" },
  { value: "STATUS_UPDOWN", label: "Status Porta (Up/Down)" },
  { value: "SDWAN_STATUS", label: "Saúde Rota (SD-WAN Health)" },
  { value: "SPEED", label: "Velocidade da Porta (Speed)" },
  { value: "CUSTOM", label: "Customizado (Outro)" }
];

export default function ZabbixItemsConfigModal({ isOpen, onClose, asset }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [discoveredItems, setDiscoveredItems] = useState([]);
  const [mappedItems, setMappedItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (isOpen && asset) {
      loadData();
    }
  }, [isOpen, asset]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Get currently mapped items from the asset
      const assetRes = await api.get(`/assets/${asset.id}`);
      const currentConfig = assetRes.data.zabbix_items || [];
      
      // 2. Discover items from Zabbix
      const discoverRes = await api.get(`/zabbix/assets/${asset.id}/discover-items`);
      const allItems = discoverRes.data.items || [];
      
      setDiscoveredItems(allItems);
      
      // Initialize mapped items state
      setMappedItems(currentConfig.map(c => ({
        ...c,
        isNew: false
      })));
      
    } catch (err) {
      console.error(err);
      alert("Erro ao carregar dados do Zabbix. Verifique se o ativo tem um IP configurado e é monitorado.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = (zabbixItem) => {
    if (mappedItems.some(m => m.zabbix_item_id === zabbixItem.itemid)) return;
    
    let guessType = "CUSTOM";
    let guessInterface = "";
    
    const nameLower = zabbixItem.name.toLowerCase();
    if (nameLower.includes("bits received")) guessType = "TRAFFIC_IN";
    else if (nameLower.includes("bits sent")) guessType = "TRAFFIC_OUT";
    else if (nameLower.includes("operational status") || nameLower.includes("interface status")) guessType = "STATUS_UPDOWN";
    else if (nameLower.includes("sd-wan") || nameLower.includes("health check state")) guessType = "SDWAN_STATUS";
    else if (nameLower.includes("speed")) guessType = "SPEED";

    if (zabbixItem.tags) {
      const ifaceTag = zabbixItem.tags.find(t => t.tag === "interface");
      if (ifaceTag) guessInterface = ifaceTag.value;
    }

    setMappedItems([
      ...mappedItems,
      {
        zabbix_item_id: zabbixItem.itemid,
        name: zabbixItem.name,
        monitor_type: guessType,
        interface_name: guessInterface,
        is_active: true,
        isNew: true
      }
    ]);
  };

  const handleRemoveItem = (index) => {
    const newItems = [...mappedItems];
    newItems.splice(index, 1);
    setMappedItems(newItems);
  };

  const handleUpdateMappedItem = (index, field, value) => {
    const newItems = [...mappedItems];
    newItems[index][field] = value;
    setMappedItems(newItems);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = mappedItems.map(m => ({
        zabbix_item_id: m.zabbix_item_id,
        name: m.name,
        interface_name: m.interface_name || "",
        monitor_type: m.monitor_type,
        is_active: m.is_active
      }));
      
      await api.post(`/assets/${asset.id}/zabbix-items`, payload);
      alert("Itens do Zabbix configurados com sucesso!");
      onClose();
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar configuração.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Activity size={22} className="text-blue-600" />
              Mapeamento de Itens Zabbix
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Configure quais métricas do Zabbix ({asset?.name}) você deseja monitorar nos mapas
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 flex flex-col lg:flex-row gap-6">
          
          {loading ? (
             <div className="flex flex-col items-center justify-center w-full py-16 text-slate-500">
               <RefreshCw size={36} className="animate-spin mb-4 text-blue-600" />
               <p className="font-bold text-slate-700">Descobrindo itens no Zabbix...</p>
             </div>
          ) : (
            <>
              {/* Esquerda: Itens disponíveis */}
              <div className="w-full lg:w-1/2 flex flex-col border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="bg-slate-100 p-3 border-b border-slate-200">
                  <h3 className="font-extrabold text-slate-800 text-sm">Itens Disponíveis no Zabbix</h3>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5 mb-2">Clique no + para adicionar ao monitoramento</p>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="text"
                      placeholder="Pesquisar métricas..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>
                <div className="overflow-y-auto flex-1 p-2 space-y-1 h-[400px]">
                  {discoveredItems
                    .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(item => {
                    const isMapped = mappedItems.some(m => m.zabbix_item_id === item.itemid);
                    return (
                      <div key={item.itemid} className={`p-2 rounded-xl border flex items-center justify-between gap-2 ${isMapped ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200 hover:border-blue-300 shadow-2xs'}`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-slate-800 truncate" title={item.name}>{item.name}</p>
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            <span className="text-[9px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">ID: {item.itemid}</span>
                            {item.tags?.map(t => (
                              <span key={t.tag+t.value} className="text-[9px] font-semibold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 truncate max-w-[100px]">
                                {t.tag}: {t.value}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          disabled={isMapped}
                          onClick={() => handleAddItem(item)}
                          className={`p-1.5 rounded-lg shrink-0 transition-colors ${isMapped ? 'text-slate-300' : 'text-blue-600 hover:bg-blue-50 cursor-pointer'}`}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Direita: Itens Mapeados */}
              <div className="w-full lg:w-1/2 flex flex-col border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="bg-blue-50 p-3 border-b border-blue-100">
                  <h3 className="font-extrabold text-blue-900 text-sm">Métricas a Monitorar</h3>
                  <p className="text-[10px] text-blue-700/70 font-medium mt-0.5">Defina o agrupador (Interface) e o tipo de cada um</p>
                </div>
                <div className="overflow-y-auto flex-1 p-3 space-y-3 h-[400px]">
                  {mappedItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                      <Tag size={32} className="mb-2 opacity-50" />
                      <p className="text-xs font-semibold">Nenhum item adicionado.</p>
                    </div>
                  ) : (
                    mappedItems.map((mapped, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-2xs relative">
                        <button onClick={() => handleRemoveItem(idx)} className="absolute top-3 right-3 text-slate-400 hover:text-red-500 transition-colors cursor-pointer">
                          <Trash2 size={14} />
                        </button>
                        
                        <p className="text-xs font-extrabold text-slate-900 pr-6 mb-2 truncate" title={mapped.name}>{mapped.name}</p>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Grupo / Interface</label>
                            <input 
                              type="text" 
                              value={mapped.interface_name} 
                              onChange={(e) => handleUpdateMappedItem(idx, "interface_name", e.target.value)}
                              placeholder="Ex: wan1, internal"
                              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Tipo de Métrica</label>
                            <select
                              value={mapped.monitor_type}
                              onChange={(e) => handleUpdateMappedItem(idx, "monitor_type", e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-blue-500 cursor-pointer"
                            >
                              {MONITOR_TYPES.map(mt => (
                                <option key={mt.value} value={mt.value}>{mt.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 bg-white flex items-center justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? "Salvando..." : "Salvar Configuração"}
          </button>
        </div>

      </div>
    </div>
  );
}
