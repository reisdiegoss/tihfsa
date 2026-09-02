import { useState, useEffect } from "react";
import { 
  Search, Monitor, HardDrive, Wifi, Phone, Plus, Server, 
  CheckCircle, AlertTriangle, AlertCircle, RefreshCw, CloudDownload, 
  X, Edit3, Trash2, Tag, Cpu, MapPin, Hash, ShieldAlert, Layers, Activity
} from "lucide-react";
import api from "../../api/client";
import ZabbixItemsConfigModal from "../../components/ZabbixItemsConfigModal";

// Componente de Conectividade ICMP (Ping)
function IcmpConnectivityBadge({ asset }) {
  const icmp = asset?.icmp_status;

  if (icmp === "online") {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200/80 font-extrabold text-xs">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <span>Online</span>
      </div>
    );
  }

  if (icmp === "offline") {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 rounded-xl border border-red-200 font-extrabold text-xs">
        <span className="w-2 h-2 rounded-full bg-red-600 animate-ping shrink-0" />
        <span>Offline</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-500 rounded-xl border border-slate-200 text-xs font-semibold">
      <span>Sem IP</span>
    </div>
  );
}

// Componente de Alertas NOC do Zabbix
function ProtocolBadge({ asset }) {
  const proto = (asset?.monitoring_protocol || "icmp").toLowerCase();
  
  if (proto === "snmp") {
    return (
      <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md text-[10px] font-mono font-extrabold border border-purple-200 shrink-0" title="Monitorado via protocolo SNMP (Interface / Hardware)">
        <Cpu size={10} className="text-purple-600 shrink-0" /> SNMP
      </span>
    );
  }

  if (proto === "agent") {
    return (
      <span className="inline-flex items-center gap-1 bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded-md text-[10px] font-mono font-extrabold border border-cyan-200 shrink-0" title="Monitorado via Zabbix Agent (SO / Serviços)">
        <Server size={10} className="text-cyan-600 shrink-0" /> AGENT
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[10px] font-mono font-extrabold border border-slate-200 shrink-0" title="Monitorado via teste de conectividade ICMP (Ping)">
      <Wifi size={10} className="text-slate-400 shrink-0" /> ICMP
    </span>
  );
}

// Componente de Alertas NOC (Zabbix) com Identificação do Protocolo (SNMP vs ICMP vs Agent)
function ZabbixAlertBadge({ asset }) {
  const status = asset?.zabbix_status;
  const alertTitle = asset?.zabbix_alert_title;

  if (status === "problem") {
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        <ProtocolBadge asset={asset} />
        <div 
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 rounded-xl border border-red-200 shadow-2xs font-extrabold text-[11px] max-w-[140px] xl:max-w-[170px] truncate cursor-help"
          title={alertTitle || "Alerta ativo no Zabbix"}
        >
          <AlertCircle size={13} className="text-red-600 shrink-0 animate-pulse" />
          <span className="truncate">{alertTitle || "Em Alerta"}</span>
        </div>
      </div>
    );
  }

  if (status === "ok") {
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        <ProtocolBadge asset={asset} />
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 font-extrabold text-xs">
          <CheckCircle size={13} className="text-blue-600 shrink-0" />
          <span>Sem Alertas</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <ProtocolBadge asset={asset} />
      <span className="text-xs text-slate-300 italic">—</span>
    </div>
  );
}


// Modal de Importação em Lote UniFi
function UnifiSyncModal({ isOpen, onClose, onImported }) {
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [devices, setDevices] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [selectedDeviceIps, setSelectedDeviceIps] = useState(new Set());
  const [globalCategoryId, setGlobalCategoryId] = useState("");
  const [typeFilter, setTypeFilter] = useState("Todos");
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      Promise.all([
        api.get("/integrations/unifi/devices"),
        api.get("/categories/"),
        api.get("/assets/")
      ])
        .then(([unifiRes, catsRes, assetsRes]) => {
          setCategoriesList(catsRes.data);
          
          const existingIps = new Set(assetsRes.data.map(a => a.ip_address).filter(Boolean));
          
          const rawDevices = unifiRes.data.devices || [];
          const processedDevices = rawDevices.map(d => ({
            ...d,
            already_exists: existingIps.has(d.ip)
          }));
          
          setDevices(processedDevices);
        })
        .catch(err => console.error("Erro ao carregar dispositivos UniFi:", err))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleDeviceSelection = (ip) => {
    setSelectedDeviceIps(prev => {
      const next = new Set(prev);
      if (next.has(ip)) next.delete(ip);
      else next.add(ip);
      return next;
    });
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredDevices = typeFilter === "Todos" 
    ? devices 
    : devices.filter(d => (typeFilter === "uap" ? d.type === "uap" : d.type !== "uap"));

  const sortedDevices = [...filteredDevices].sort((a, b) => {
    const aVal = sortConfig.key === 'name' ? (a.name || a.hostname || "") : (a.ip || "");
    const bVal = sortConfig.key === 'name' ? (b.name || b.hostname || "") : (b.ip || "");
    
    if (sortConfig.key === 'ip') {
       const aParts = aVal.split('.').map(Number);
       const bParts = bVal.split('.').map(Number);
       if (aParts.length === 4 && bParts.length === 4) {
          for (let i = 0; i < 4; i++) {
             if (aParts[i] !== bParts[i]) {
                return sortConfig.direction === 'asc' ? aParts[i] - bParts[i] : bParts[i] - aParts[i];
             }
          }
          return 0;
       }
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleSelectAll = () => {
    const importable = sortedDevices.filter(d => !d.already_exists && d.ip);
    
    // Check if ALL importable in the CURRENT filter are selected
    const allSelected = importable.length > 0 && importable.every(d => selectedDeviceIps.has(d.ip));
    
    setSelectedDeviceIps(prev => {
      const next = new Set(prev);
      importable.forEach(d => {
        if (allSelected) next.delete(d.ip);
        else next.add(d.ip);
      });
      return next;
    });
  };

  const handleImport = async () => {
    if (selectedDeviceIps.size === 0) {
      return alert("Selecione pelo menos um dispositivo para importar.");
    }

    const payload = [];
    devices.forEach(d => {
      if (selectedDeviceIps.has(d.ip) && !d.already_exists) {
        payload.push({
          name: d.name || d.hostname || `UniFi-${d.ip}`,
          type: d.type === "uap" ? "Access Point" : "Switch",
          ip_address: d.ip,
          mac_address: d.mac || null,
          category_id: globalCategoryId ? Number(globalCategoryId) : null
        });
      }
    });

    setImporting(true);
    try {
      await api.post("/assets/unifi/import", payload);
      onImported();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Erro ao importar dispositivos UniFi.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-blue-600 p-6 text-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-extrabold flex items-center gap-2">
              <span className="text-2xl">📡</span> Sincronização em Lote: UniFi Controladora
            </h2>
            <p className="text-blue-100 text-sm mt-1">Importe APs e Switches diretamente para o CMDB.</p>
          </div>
          <button onClick={onClose} className="p-2 bg-blue-700/50 hover:bg-blue-700 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <RefreshCw size={40} className="animate-spin mb-4 text-blue-500" />
              <p className="font-medium">Comunicando com a controladora UniFi...</p>
            </div>
          ) : devices.length === 0 ? (
            <div className="text-center py-12 text-slate-500 bg-white rounded-2xl border border-slate-200">
              <p>Nenhum dispositivo encontrado na controladora configurada.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-slate-700 font-bold mb-1 text-sm">Filtrar por Tipo:</label>
                  <select 
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="Todos">Todos os Equipamentos</option>
                    <option value="uap">Apenas Antenas (AP)</option>
                    <option value="usw">Apenas Switches</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-slate-700 font-bold mb-1 text-sm">Categoria Global (Opcional):</label>
                  <select 
                    value={globalCategoryId}
                    onChange={(e) => setGlobalCategoryId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="">-- Nenhuma Categoria --</option>
                    {categoriesList.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col justify-end">
                  <button 
                    onClick={toggleSelectAll}
                    className="mt-6 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors"
                  >
                    Selecionar Todos (Filtrados)
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100/50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-bold text-slate-600 w-12 text-center"></th>
                      <th 
                        className="px-4 py-3 font-bold text-slate-600 cursor-pointer hover:bg-slate-200/50 transition-colors"
                        onClick={() => requestSort('name')}
                      >
                        Dispositivo {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th 
                        className="px-4 py-3 font-bold text-slate-600 cursor-pointer hover:bg-slate-200/50 transition-colors"
                        onClick={() => requestSort('ip')}
                      >
                        IP {sortConfig.key === 'ip' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th className="px-4 py-3 font-bold text-slate-600">Tipo</th>
                      <th className="px-4 py-3 font-bold text-slate-600">Status no CMDB</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedDevices.map((d, i) => {
                      const isSelected = selectedDeviceIps.has(d.ip);
                      return (
                        <tr key={i} className={`hover:bg-slate-50 transition-colors ${d.already_exists ? 'opacity-60 bg-slate-50/50' : ''}`}>
                          <td className="px-4 py-3 text-center">
                            <input 
                              type="checkbox"
                              disabled={d.already_exists || !d.ip}
                              checked={isSelected}
                              onChange={() => toggleDeviceSelection(d.ip)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-800">{d.name || d.hostname || "Sem Nome"}</td>
                          <td className="px-4 py-3 font-mono text-slate-600">{d.ip || "Sem IP"}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {d.type === "uap" ? (
                              <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md text-xs"><Wifi size={12}/> AP</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-200 px-2 py-0.5 rounded-md text-xs"><Server size={12}/> Switch</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {d.already_exists ? (
                              <span className="text-emerald-600 text-xs font-bold flex items-center gap-1"><CheckCircle size={14}/> Já cadastrado</span>
                            ) : !d.ip ? (
                              <span className="text-red-500 text-xs font-bold">Sem IP (Ignorado)</span>
                            ) : (
                              <span className="text-blue-500 text-xs font-bold">Novo</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 shrink-0 rounded-b-3xl">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-slate-200 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={loading || importing || selectedDeviceIps.size === 0}
            className="flex items-center gap-2 bg-blue-600 text-white px-8 py-2.5 rounded-xl font-extrabold hover:bg-blue-700 transition-all shadow-md disabled:opacity-50"
          >
            {importing ? <RefreshCw size={18} className="animate-spin" /> : <CloudDownload size={18} />}
            {importing ? "Importando..." : `Importar Selecionados (${selectedDeviceIps.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal de Cadastrar / Editar Ativo (CMDB)

function AssetFormModal({ isOpen, onClose, assetToEdit, onSaved, usersList, locationsList, assetTypesConfig = [] }) {
  const [formData, setFormData] = useState({
    name: "",
    type: "Desktop",
    asset_tag: "",
    ip_address: "",
    brand: "",
    model: "",
    serial_number: "",
    mac_address: "",
    assigned_user_id: "",
    location_id: "",
    description: "",
    specs: {},
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (assetToEdit) {
      setFormData({
        name: assetToEdit.name || "",
        type: assetToEdit.type || "Desktop",
        asset_tag: assetToEdit.asset_tag || "",
        ip_address: assetToEdit.ip_address || "",
        brand: assetToEdit.brand || "",
        model: assetToEdit.model || "",
        serial_number: assetToEdit.serial_number || "",
        mac_address: assetToEdit.mac_address || "",
        assigned_user_id: assetToEdit.assigned_user_id ? String(assetToEdit.assigned_user_id) : "",
        location_id: assetToEdit.location_id ? String(assetToEdit.location_id) : "",
        description: assetToEdit.description || "",
        specs: assetToEdit.specs || {},
      });
    } else {
      setFormData({
        name: "",
        type: assetTypesConfig.length > 0 ? assetTypesConfig[0].name : "Desktop",
        asset_tag: "",
        ip_address: "",
        brand: "",
        model: "",
        serial_number: "",
        mac_address: "",
        assigned_user_id: "",
        location_id: "",
        description: "",
        specs: {},
      });
    }
  }, [assetToEdit, isOpen, assetTypesConfig]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert("Por favor, preencha o nome do ativo.");

    setSaving(true);
    const payload = {
      name: formData.name.strip ? formData.name.strip() : formData.name,
      type: formData.type,
      asset_tag: formData.asset_tag?.trim() || null,
      ip_address: formData.ip_address?.trim() || null,
      brand: formData.brand?.trim() || null,
      model: formData.model?.trim() || null,
      serial_number: formData.serial_number?.trim() || null,
      mac_address: formData.mac_address?.trim() || null,
      description: formData.description?.trim() || null,
      assigned_user_id: formData.assigned_user_id ? Number(formData.assigned_user_id) : null,
      location_id: formData.location_id ? Number(formData.location_id) : null,
      specs: formData.specs || {},
    };

    try {
      if (assetToEdit) {
        await api.patch(`/assets/${assetToEdit.id}`, payload);
      } else {
        await api.post("/assets/", payload);
      }
      onSaved();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Erro ao salvar equipamento.");
    } finally {
      setSaving(false);
    }
  };

  const defaultTypes = [
    "Desktop", "Notebook", "TV", "SKY", "Switch", "Roteador", 
    "Access Point", "Antena Unifi", "Monitor", "Teclado", "Mouse", 
    "Impressora", "Telefone", "Caixa de Som", "Outro"
  ];

  const typeOptions = assetTypesConfig.length > 0 
    ? assetTypesConfig.map(t => t.name)
    : defaultTypes;

  const selectedTypeConfig = assetTypesConfig.find(t => t.name === formData.type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Cpu size={22} className="text-blue-600" />
              {assetToEdit ? "Editar Equipamento" : "Cadastrar Novo Ativo (CMDB)"}
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Preencha os dados do dispositivo para controle patrimonial e Zabbix
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Nome do Ativo */}
            <div className="space-y-1 sm:col-span-2">
              <label className="block text-slate-800 font-extrabold">Nome do Dispositivo / Host *</label>
              <input
                type="text"
                required
                placeholder="Ex: PC-RECEPCAO-01, SW-CORE-TERREO"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-blue-500 font-medium"
              />
            </div>

            {/* Tipo de Ativo */}
            <div className="space-y-1">
              <label className="block text-slate-800 font-extrabold">Tipo de Equipamento</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-blue-500 font-medium cursor-pointer"
              >
                {typeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Patrimônio / Tag */}
            <div className="space-y-1">
              <label className="block text-slate-800 font-extrabold">Patrimônio / Tag</label>
              <input
                type="text"
                placeholder="Ex: PAT-00123"
                value={formData.asset_tag}
                onChange={(e) => setFormData({ ...formData, asset_tag: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-blue-500 font-medium"
              />
            </div>

            {/* Localização Física (NOVO) */}
            <div className="space-y-1">
              <label className="block text-slate-800 font-extrabold flex items-center gap-1">
                <MapPin size={14} className="text-blue-600" /> Localização Física
              </label>
              <select
                value={formData.location_id}
                onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-blue-500 font-medium cursor-pointer"
              >
                <option value="">Nenhuma / Não atribuída</option>
                {locationsList.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    📍 {loc.name} {loc.floor ? `(${loc.floor})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Colaborador ou Apt Responsável */}
            <div className="space-y-1">
              <label className="block text-slate-800 font-extrabold">Colaborador / Apt Responsável</label>
              <select
                value={formData.assigned_user_id}
                onChange={(e) => setFormData({ ...formData, assigned_user_id: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-blue-500 font-medium cursor-pointer"
              >
                <option value="">Nenhum / Não Atribuído</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.is_room ? `🏢 ${u.display_name}` : `👤 ${u.display_name} (${u.department_name || "Geral"})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Endereço IP */}
            <div className="space-y-1">
              <label className="block text-slate-800 font-extrabold">Endereço IP (Zabbix NOC)</label>
              <input
                type="text"
                placeholder="Ex: 192.168.1.50"
                value={formData.ip_address}
                onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-blue-500 font-mono"
              />
            </div>

            {/* Marca */}
            <div className="space-y-1">
              <label className="block text-slate-800 font-extrabold">Marca / Fabricante</label>
              <input
                type="text"
                placeholder="Ex: Dell, Samsung, HP, Ubiquiti"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-blue-500 font-medium"
              />
            </div>

            {/* Modelo */}
            <div className="space-y-1">
              <label className="block text-slate-800 font-extrabold">Modelo</label>
              <input
                type="text"
                placeholder="Ex: Latitude 5420, UN55AU7000"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-blue-500 font-medium"
              />
            </div>

            {/* Número de Série */}
            <div className="space-y-1">
              <label className="block text-slate-800 font-extrabold">Número de Série (S/N)</label>
              <input
                type="text"
                placeholder="Ex: SN123456789"
                value={formData.serial_number}
                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-blue-500 font-mono"
              />
            </div>

            {/* Descrição */}
            <div className="sm:col-span-2 space-y-1">
              <label className="block text-slate-800 font-extrabold">Descrição / Observações</label>
              <textarea
                rows={2}
                placeholder="Detalhes sobre a garantia, ponto de rede ou características adicionais..."
                value={formData.description}
              />
            </div>

            {/* Campos Especiais Dinâmicos por Tipo de Equipamento */}
            {selectedTypeConfig?.custom_fields?.length > 0 && (
              <div className="sm:col-span-2 border-t border-slate-100 pt-3 mt-1 space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={14} className="text-blue-600" />
                  Características Especiais ({selectedTypeConfig.name})
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
                  {selectedTypeConfig.custom_fields.map((field) => (
                    <div key={field.key} className="space-y-1">
                      <label className="block text-slate-800 font-extrabold text-[11px]">
                        {field.name} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      {field.field_type === "select" ? (
                        <select
                          value={formData.specs?.[field.key] || ""}
                          onChange={(e) => setFormData({
                            ...formData,
                            specs: { ...formData.specs, [field.key]: e.target.value }
                          })}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value="">Selecione...</option>
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : field.field_type === "boolean" ? (
                        <label className="flex items-center gap-2 pt-1 font-bold text-slate-700 cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={!!formData.specs?.[field.key]}
                            onChange={(e) => setFormData({
                              ...formData,
                              specs: { ...formData.specs, [field.key]: e.target.checked }
                            })}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                          />
                          <span>Sim</span>
                        </label>
                      ) : (
                        <input
                          type={field.field_type === "number" ? "number" : "text"}
                          placeholder={`Informe ${field.name.toLowerCase()}...`}
                          value={formData.specs?.[field.key] || ""}
                          onChange={(e) => setFormData({
                            ...formData,
                            specs: { ...formData.specs, [field.key]: e.target.value }
                          })}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? <RefreshCw size={18} className="animate-spin" /> : null}
              {saving ? "Salvando..." : assetToEdit ? "Salvar Alterações" : "Cadastrar Ativo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal de Importação Zabbix — Acordeão por Grupo com seleção individual de hosts
function ZabbixSyncModal({ isOpen, onClose, onImported }) {
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  const [groupsTree, setGroupsTree] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [groupMappings, setGroupMappings] = useState({});
  const [selectedHostIds, setSelectedHostIds] = useState(new Set());
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      Promise.all([
        api.get("/assets/zabbix/groups-and-hosts"),
        api.get("/categories/")
      ])
        .then(([treeRes, catsRes]) => {
          setGroupsTree(treeRes.data);
          setCategoriesList(catsRes.data);
          const initialMap = {};
          treeRes.data.forEach(g => {
            if (g.suggested_category_id) {
              initialMap[g.zabbix_group_id] = g.suggested_category_id;
            }
          });
          setGroupMappings(initialMap);
          const defaultExpanded = new Set();
          if (treeRes.data.length > 0) defaultExpanded.add(treeRes.data[0].zabbix_group_id);
          setExpandedGroups(defaultExpanded);
        })
        .catch((err) => console.error("Erro ao carregar Zabbix tree:", err))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleCategoryChange = (groupId, categoryId) => {
    setGroupMappings(prev => ({
      ...prev,
      [groupId]: categoryId ? Number(categoryId) : null
    }));
  };

  const toggleHostSelection = (hostId) => {
    setSelectedHostIds(prev => {
      const next = new Set(prev);
      if (next.has(hostId)) next.delete(hostId);
      else next.add(hostId);
      return next;
    });
  };

  const toggleSelectAllInGroup = (group) => {
    const importableHosts = group.hosts.filter(h => !h.already_exists);
    const allSelected = importableHosts.every(h => selectedHostIds.has(h.zabbix_host_id));

    setSelectedHostIds(prev => {
      const next = new Set(prev);
      importableHosts.forEach(h => {
        if (allSelected) next.delete(h.zabbix_host_id);
        else next.add(h.zabbix_host_id);
      });
      return next;
    });
  };

  const handleImport = async () => {
    const hostsPayload = [];
    groupsTree.forEach(group => {
      const categoryId = groupMappings[group.zabbix_group_id] || null;
      group.hosts.forEach(host => {
        if (selectedHostIds.has(host.zabbix_host_id) && !host.already_exists) {
          hostsPayload.push({
            hostid: host.zabbix_host_id,
            name: host.name,
            host_name: host.name,
            type: host.inferred_type,
            inferred_type: host.inferred_type,
            ip_address: host.ip_address,
            category_id: categoryId,
          });
        }
      });
    });

    if (hostsPayload.length === 0) {
      alert("Selecione ao menos um equipamento para importar.");
      return;
    }

    setImporting(true);
    try {
      await api.post("/categories/zabbix-sync");
      const res = await api.post("/assets/zabbix/import-groups-and-hosts", { hosts: hostsPayload });
      alert(res.data.message || "Equipamentos importados com sucesso!");
      onImported();
    } catch (err) {
      console.error(err);
      alert("Erro ao importar equipamentos.");
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = selectedHostIds.size;
  const totalHosts = groupsTree.reduce((sum, g) => sum + g.host_count, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <CloudDownload size={22} className="text-blue-600" />
              Importar do Zabbix
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Expanda cada grupo, defina a categoria e selecione os equipamentos que deseja importar
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <RefreshCw size={36} className="animate-spin mb-4 text-blue-600" />
              <p className="font-bold text-slate-700">Consultando Zabbix Server...</p>
              <p className="text-xs text-slate-400 mt-1">Carregando grupos de hosts e equipamentos monitorados</p>
            </div>
          ) : groupsTree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <AlertCircle size={40} className="mb-4 text-amber-500" />
              <p className="font-bold text-slate-700">Nenhum grupo encontrado no Zabbix</p>
              <p className="text-xs text-slate-400 mt-1">Verifique a conexão com o Zabbix Server</p>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3.5 text-xs font-semibold text-blue-800 flex items-center gap-3">
                <Server size={18} className="text-blue-600 shrink-0" />
                <span>
                  <strong>{groupsTree.length}</strong> grupos de hosts encontrados com <strong>{totalHosts}</strong> equipamentos monitorados.
                  {selectedCount > 0 && (
                    <span className="ml-2 bg-blue-600 text-white px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                      {selectedCount} selecionado{selectedCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </span>
              </div>

              {groupsTree.map((group) => {
                const isExpanded = expandedGroups.has(group.zabbix_group_id);
                const importableHosts = group.hosts.filter(h => !h.already_exists);
                const existingHosts = group.hosts.filter(h => h.already_exists);
                const selectedInGroup = importableHosts.filter(h => selectedHostIds.has(h.zabbix_host_id)).length;
                const allInGroupSelected = importableHosts.length > 0 && selectedInGroup === importableHosts.length;

                return (
                  <div key={group.zabbix_group_id} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    <div
                      className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => toggleGroup(group.zabbix_group_id)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isExpanded ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
                          <Server size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-extrabold text-slate-900 text-sm truncate">{group.zabbix_group_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] font-semibold text-slate-400">
                              {group.host_count} hosts
                            </span>
                            {existingHosts.length > 0 && (
                              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                                {existingHosts.length} já no CMDB
                              </span>
                            )}
                            {selectedInGroup > 0 && (
                              <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                {selectedInGroup} selecionado{selectedInGroup !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 w-48" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={groupMappings[group.zabbix_group_id] || ""}
                          onChange={(e) => handleCategoryChange(group.zabbix_group_id, e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none focus:border-blue-500 font-bold text-[11px] cursor-pointer text-slate-700"
                        >
                          <option value="">Sem categoria</option>
                          {categoriesList.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-3">
                        {importableHosts.length > 0 && (
                          <div className="flex items-center justify-between px-2">
                            <label className="flex items-center gap-2 text-xs font-extrabold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={allInGroupSelected}
                                onChange={() => toggleSelectAllInGroup(group)}
                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                              />
                              <span>Selecionar todos disponíveis neste grupo ({importableHosts.length})</span>
                            </label>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {group.hosts.map((host) => {
                            const isSelected = selectedHostIds.has(host.zabbix_host_id);
                            return (
                              <div
                                key={host.zabbix_host_id}
                                className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                                  host.already_exists
                                    ? "bg-slate-100/70 border-slate-200 opacity-60"
                                    : isSelected
                                    ? "bg-blue-50/80 border-blue-300 text-blue-950 font-bold shadow-2xs cursor-pointer"
                                    : "bg-white border-slate-200 hover:border-blue-200 cursor-pointer"
                                }`}
                                onClick={() => !host.already_exists && toggleHostSelection(host.zabbix_host_id)}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <input
                                    type="checkbox"
                                    disabled={host.already_exists}
                                    checked={host.already_exists || isSelected}
                                    onChange={() => {}}
                                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-800 truncate">{host.name}</p>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold">
                                      {host.ip_address ? (
                                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                          {host.ip_address}
                                        </span>
                                      ) : (
                                        <span className="italic">Sem IP</span>
                                      )}
                                      <span>• {host.inferred_type}</span>
                                    </div>
                                  </div>
                                </div>

                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                                  host.status === "Monitored"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-slate-100 text-slate-500"
                                }`}>
                                  {host.status === "Monitored" ? "● Monitorado" : "○ Desativado"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs font-semibold text-slate-400">
            {selectedCount > 0 ? (
              <span className="text-slate-700">{selectedCount} equipamento{selectedCount !== 1 ? "s" : ""} selecionado{selectedCount !== 1 ? "s" : ""} para importação</span>
            ) : (
              <span>Expanda os grupos e selecione os equipamentos</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
              Cancelar
            </button>
            <button
              onClick={handleImport}
              disabled={importing || selectedCount === 0}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? <RefreshCw size={18} className="animate-spin" /> : <CloudDownload size={18} />}
              {importing ? "Importando..." : `Importar ${selectedCount} Equipamento${selectedCount !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function Assets() {
  const [assets, setAssets] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [locationsList, setLocationsList] = useState([]);
  const [assetTypesConfig, setAssetTypesConfig] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("Todos");
  const [selectedLocation, setSelectedLocation] = useState("Todas");
  const [selectedStatus, setSelectedStatus] = useState("Todos");
  
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isUnifiSyncModalOpen, setIsUnifiSyncModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [assetToEdit, setAssetToEdit] = useState(null);
  
  const [isZabbixConfigModalOpen, setIsZabbixConfigModalOpen] = useState(false);
  const [assetForZabbixConfig, setAssetForZabbixConfig] = useState(null);

  const openZabbixConfigModal = (asset) => {
    if (!asset.ip_address) {
      return alert("É necessário que o ativo possua um IP para configurar o mapeamento do Zabbix.");
    }
    setAssetForZabbixConfig(asset);
    setIsZabbixConfigModalOpen(true);
  };


  const fetchAssets = () => {
    setLoading(true);
    api.get("/assets/")
      .then((r) => setAssets(r.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  const fetchUsers = () => {
    api.get("/users/")
      .then((r) => setUsersList(r.data))
      .catch(console.error);
  };

  const fetchLocations = () => {
    api.get("/locations/?active_only=true")
      .then((r) => setLocationsList(r.data))
      .catch(console.error);
  };

  const fetchAssetTypesConfig = () => {
    api.get("/asset-types/?active_only=true")
      .then((r) => setAssetTypesConfig(r.data))
      .catch(console.error);
  };

  useEffect(() => {
    fetchAssets();
    fetchUsers();
    fetchLocations();
    fetchAssetTypesConfig();

    // Auto-refresh do status Zabbix a cada 30 segundos
    const interval = setInterval(fetchAssets, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleDeleteAsset = async (assetId, assetName) => {
    if (!window.confirm(`Tem certeza que deseja excluir o ativo "${assetName}"?`)) return;
    try {
      await api.delete(`/assets/${assetId}`);
      fetchAssets();
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir ativo.");
    }
  };

  const openNewAssetModal = () => {
    setAssetToEdit(null);
    setIsFormModalOpen(true);
  };

  const openEditAssetModal = (asset) => {
    setAssetToEdit(asset);
    setIsFormModalOpen(true);
  };

  // Obter tipos únicos para o filtro
  const assetTypes = ["Todos", ...new Set(assets.map((a) => a.type))];

  // Métricas de Conectividade ICMP & Zabbix em Tempo Real
  const onlinePingCount = assets.filter(a => a.icmp_status === "online").length;
  const offlinePingCount = assets.filter(a => a.icmp_status === "offline").length;
  const zabbixProblemCount = assets.filter(a => a.zabbix_status === "problem").length;
  const zabbixOkCount = assets.filter(a => a.zabbix_status === "ok").length;
  const unmonitoredCount = assets.filter(a => a.zabbix_status === "unmonitored" || a.zabbix_status === "no_ip").length;

  // Filtragem Unificada
  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (asset.ip_address && asset.ip_address.includes(searchTerm)) ||
      (asset.asset_tag && asset.asset_tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (asset.assigned_user_name && asset.assigned_user_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (asset.location_name && asset.location_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = selectedType === "Todos" || asset.type === selectedType;
    const matchesLocation = selectedLocation === "Todas" || String(asset.location_id) === selectedLocation;
    
    let matchesStatus = true;
    if (selectedStatus === "icmp_online") matchesStatus = asset.icmp_status === "online";
    else if (selectedStatus === "icmp_offline") matchesStatus = asset.icmp_status === "offline";
    else if (selectedStatus === "zabbix_problem") matchesStatus = asset.zabbix_status === "problem";
    else if (selectedStatus === "zabbix_ok") matchesStatus = asset.zabbix_status === "ok";
    else if (selectedStatus === "unmonitored") matchesStatus = asset.zabbix_status === "unmonitored" || asset.zabbix_status === "no_ip";

    return matchesSearch && matchesType && matchesLocation && matchesStatus;
  });

  const getIconForType = (type) => {
    switch (type) {
      case "Desktop":
      case "Notebook":
        return <Monitor size={20} />;
      case "Switch":
      case "Roteador":
        return <HardDrive size={20} />;
      case "Access Point":
      case "Antena Unifi":
        return <Wifi size={20} />;
      case "Telefone":
        return <Phone size={20} />;
      default:
        return <Server size={20} />;
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Server size={28} className="text-blue-600" /> Gestão de Ativos & Monitoramento Zabbix
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1">
            CMDB unificado com status de conectividade e alertas em tempo real da infraestrutura
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => fetchAssets()}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-2xl text-xs font-extrabold transition-all cursor-pointer"
            title="Atualizar status dos ativos"
          >
            <RefreshCw size={16} className={loading ? "animate-spin text-blue-600" : ""} /> Atualizar Status
          </button>
          <button
            onClick={() => setIsSyncModalOpen(true)}
            className="flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-2xl text-xs font-extrabold shadow-md hover:bg-slate-800 transition-all cursor-pointer"
          >
            <CloudDownload size={18} className="text-blue-400" /> Importar do Zabbix
          </button>
          <button
            onClick={() => setIsUnifiSyncModalOpen(true)}
            className="flex items-center gap-2 bg-blue-900 text-white px-5 py-3 rounded-2xl text-xs font-extrabold shadow-md hover:bg-blue-800 transition-all cursor-pointer"
          >
            <CloudDownload size={18} className="text-blue-400" /> Importar da UniFi
          </button>
          <button
            onClick={openNewAssetModal}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-2xl text-xs font-extrabold shadow-md shadow-blue-600/20 hover:bg-blue-700 transition-all cursor-pointer"
          >
            <Plus size={18} /> Novo Ativo
          </button>
        </div>
      </div>

      {/* Cards de Métricas em Tempo Real (Conectividade Ping & Alertas Zabbix Separados) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total de Ativos */}
        <div 
          onClick={() => setSelectedStatus("Todos")}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            selectedStatus === "Todos"
              ? "bg-white border-blue-600 shadow-md ring-2 ring-blue-500/10"
              : "bg-white border-slate-200/80 hover:border-slate-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-extrabold uppercase tracking-wider">Total de Ativos</span>
            <Server size={18} className="text-blue-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{assets.length}</p>
          <p className="text-[10px] font-semibold text-slate-400 mt-1">Dispositivos cadastrados</p>
        </div>

        {/* Conectividade ICMP (Ping) */}
        <div 
          onClick={() => setSelectedStatus("icmp_online")}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            selectedStatus === "icmp_online" || selectedStatus === "icmp_offline"
              ? "bg-emerald-50/60 border-emerald-500 shadow-md ring-2 ring-emerald-500/10"
              : "bg-white border-slate-200/80 hover:border-emerald-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">Conectividade Ping</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-2xl font-black text-emerald-950 flex items-baseline gap-1.5">
            <span>{onlinePingCount}</span>
            <span className="text-xs font-extrabold text-emerald-700">Online</span>
            {offlinePingCount > 0 && (
              <span className="text-xs font-extrabold text-red-600">({offlinePingCount} Off)</span>
            )}
          </p>
          <p className="text-[10px] font-semibold text-emerald-700 mt-1">Respondem ao teste de Ping</p>
        </div>

        {/* Alertas NOC (Zabbix) */}
        <div 
          onClick={() => setSelectedStatus("zabbix_problem")}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            selectedStatus === "zabbix_problem"
              ? "bg-amber-50/80 border-amber-500 shadow-md ring-2 ring-amber-500/10"
              : "bg-white border-slate-200/80 hover:border-amber-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-amber-800">Alertas Zabbix NOC</span>
            <AlertCircle size={18} className="text-amber-600 animate-pulse" />
          </div>
          <p className="text-2xl font-black text-amber-950 flex items-baseline gap-1.5">
            <span>{zabbixProblemCount}</span>
            <span className="text-xs font-extrabold text-amber-700">Em Alerta</span>
          </p>
          <p className="text-[10px] font-semibold text-amber-700 mt-1">Alertas de saúde/serviços ativos</p>
        </div>

        {/* Sem IP / Manual */}
        <div 
          onClick={() => setSelectedStatus("unmonitored")}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            selectedStatus === "unmonitored"
              ? "bg-slate-100 border-slate-400 shadow-md"
              : "bg-white border-slate-200/80 hover:border-slate-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-extrabold uppercase tracking-wider">Sem IP / Manual</span>
            <Hash size={18} />
          </div>
          <p className="text-2xl font-black text-slate-800">{unmonitoredCount}</p>
          <p className="text-[10px] font-semibold text-slate-400 mt-1">Fora do monitoramento de rede</p>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
        
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por nome, IP, patrimônio, local..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          
          {/* Status Filter Dropdown */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="Todos">Todos os Status</option>
            <option value="icmp_online">🟢 Conectividade: Online (Ping)</option>
            <option value="icmp_offline">🔴 Conectividade: Offline (Ping)</option>
            <option value="zabbix_problem">🔴 Alertas NOC: Em Alerta (Zabbix)</option>
            <option value="zabbix_ok">🟢 Alertas NOC: Sem Alertas (Zabbix)</option>
            <option value="unmonitored">⚪ Sem IP / Não Monitorados</option>
          </select>

          {/* Filter by Type */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
          >
            {assetTypes.map((t) => (
              <option key={t} value={t}>{t === "Todos" ? "Todos os Tipos" : t}</option>
            ))}
          </select>

          {/* Filter by Location */}
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="Todas">Todas as Localizações</option>
            {locationsList.map((loc) => (
              <option key={loc.id} value={loc.id}>📍 {loc.name}</option>
            ))}
          </select>

          <span className="text-xs font-bold text-slate-400 ml-2">
            Exibindo: <span className="text-slate-900 font-black">{filteredAssets.length}</span> ativos
          </span>
        </div>
      </div>

      {/* Assets Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-semibold space-y-3">
            <RefreshCw size={24} className="animate-spin mx-auto text-blue-600" />
            <p className="text-xs">Carregando inventário de ativos e consultando Zabbix em tempo real...</p>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-semibold space-y-3">
            <Server size={36} className="mx-auto text-slate-300" />
            <p className="text-sm font-bold text-slate-600">Nenhum ativo encontrado.</p>
            <p className="text-xs text-slate-400">Tente ajustar a busca ou os filtros de status.</p>
          </div>
        ) : (
          <div>
            {/* Visualização de Cards para Telas Menores (< 1024px) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden p-4">
              {filteredAssets.map((asset) => (
                <div key={asset.id} className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 space-y-3 shadow-xs">
                  {/* Top Bar: Icon, Name, Actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center shrink-0 shadow-2xs">
                        {getIconForType(asset.type)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm truncate">{asset.name}</h4>
                        <p className="text-[11px] font-semibold text-slate-400 truncate">{asset.brand} {asset.model} • {asset.type}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openZabbixConfigModal(asset)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                        title="Configurar Itens Zabbix"
                      >
                        <Activity size={15} />
                      </button>
                      <button
                        onClick={() => openEditAssetModal(asset)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                        title="Editar Equipamento"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteAsset(asset.id, asset.name)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                        title="Excluir Equipamento"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Specs Badges */}
                  {asset.specs && Object.keys(asset.specs).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(asset.specs).slice(0, 4).map(([k, v]) => (
                        v !== null && v !== "" && (
                          <span key={k} className="text-[9px] font-bold bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                            {String(v)}
                          </span>
                        )
                      ))}
                    </div>
                  )}

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-200/60">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">IP / Host</span>
                      {asset.ip_address ? (
                        <span className="font-mono font-bold text-slate-700">{asset.ip_address}</span>
                      ) : (
                        <span className="text-slate-300 italic">Sem IP</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Patrimônio</span>
                      {asset.asset_tag ? (
                        <span className="font-mono font-bold text-slate-700">{asset.asset_tag}</span>
                      ) : (
                        <span className="text-slate-300 italic">—</span>
                      )}
                    </div>

                    <div className="col-span-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Localização & Responsável</span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {asset.location_name ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                            <MapPin size={10} className="text-blue-600" /> {asset.location_name}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Sem localização</span>
                        )}
                        <span className="text-slate-400">•</span>
                        <span className="font-bold text-slate-700">{asset.assigned_user_name || "Não atribuído"}</span>
                      </div>
                    </div>

                    <div className="col-span-2 pt-1 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Ping ICMP</span>
                        <IcmpConnectivityBadge asset={asset} />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Alertas NOC</span>
                        <ZabbixAlertBadge asset={asset} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Visualização de Tabela para Desktop (>= 1024px) */}
            <div className="hidden lg:block overflow-x-auto [scrollbar-width:thin]">
              <table className="w-full min-w-[1080px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                    <th className="px-5 py-4 pl-6">Dispositivo</th>
                    <th className="px-4 py-4">Patrimônio</th>
                    <th className="px-4 py-4">IP</th>
                    <th className="px-4 py-4">Localização</th>
                    <th className="px-4 py-4">Responsável</th>
                    <th className="px-4 py-4">Conectividade</th>
                    <th className="px-4 py-4">Alertas NOC</th>
                    <th className="px-5 py-4 text-right pr-6 w-28 sticky right-0 bg-slate-50/95 backdrop-blur-sm shadow-[-10px_0_15px_-10px_rgba(0,0,0,0.05)] z-10">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                  {filteredAssets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-5 py-3.5 pl-6">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                            {getIconForType(asset.type)}
                          </div>
                          <div className="min-w-0 max-w-[220px] xl:max-w-[260px]">
                            <p className="font-extrabold text-slate-900 truncate">{asset.name}</p>
                            <p className="text-[11px] font-semibold text-slate-400 truncate">{asset.brand} {asset.model} • {asset.type}</p>
                            {asset.specs && Object.keys(asset.specs).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {Object.entries(asset.specs).slice(0, 2).map(([k, v]) => (
                                  v !== null && v !== "" && (
                                    <span key={k} className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 truncate max-w-[120px]">
                                      {String(v)}
                                    </span>
                                  )
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {asset.asset_tag ? (
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border border-slate-200">
                            <Tag size={11} className="text-slate-400 shrink-0" /> {asset.asset_tag}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-300 italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {asset.ip_address ? (
                          <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                            {asset.ip_address}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-300 italic">Sem IP</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {asset.location_name ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                            <MapPin size={11} className="text-blue-600 shrink-0" /> {asset.location_name}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Não informada</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="text-slate-800 font-bold text-xs">
                          {asset.assigned_user_name || "Não atribuído"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <IcmpConnectivityBadge asset={asset} />
                      </td>
                      <td className="px-4 py-3.5">
                        <ZabbixAlertBadge asset={asset} />
                      </td>
                      <td className="px-5 py-3.5 text-right pr-6 w-32 whitespace-nowrap sticky right-0 bg-white group-hover:bg-slate-50/50 shadow-[-10px_0_15px_-10px_rgba(0,0,0,0.03)] z-10">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openZabbixConfigModal(asset)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
                            title="Configurar Itens Zabbix"
                          >
                            <Activity size={16} />
                          </button>
                          <button
                            onClick={() => openEditAssetModal(asset)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                            title="Editar Equipamento"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteAsset(asset.id, asset.name)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                            title="Excluir Equipamento"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal Form de Ativo */}
      <AssetFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        assetToEdit={assetToEdit}
        onSaved={() => {
          setIsFormModalOpen(false);
          fetchAssets();
        }}
        usersList={usersList}
        locationsList={locationsList}
        assetTypesConfig={assetTypesConfig}
      />

      {/* Modal de Importação Zabbix */}
      <ZabbixSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onImported={() => {
          setIsSyncModalOpen(false);
          fetchAssets();
        }}
      />
      <UnifiSyncModal
        isOpen={isUnifiSyncModalOpen}
        onClose={() => setIsUnifiSyncModalOpen(false)}
        onImported={() => {
          setIsUnifiSyncModalOpen(false);
          fetchAssets();
        }}
      />

      {/* Modal de Configuração de Itens Zabbix */}
      <ZabbixItemsConfigModal
        isOpen={isZabbixConfigModalOpen}
        onClose={() => setIsZabbixConfigModalOpen(false)}
        asset={assetForZabbixConfig}
      />

    </div>
  );
}
