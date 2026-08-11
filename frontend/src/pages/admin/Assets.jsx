import { useState, useEffect } from "react";
import { Search, Monitor, HardDrive, Wifi, Phone, Plus, Server, CheckCircle, AlertTriangle, AlertCircle, RefreshCw, CloudDownload, X } from "lucide-react";
import api from "../../api/client";

// Componente isolado para carregar o status do Zabbix de forma assíncrona
function ZabbixStatusBadge({ assetId, ipAddress }) {
  const [status, setStatus] = useState("Loading");
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!ipAddress) {
      setStatus("No_IP");
      return;
    }

    const checkStatus = () => {
      api.get(`/assets/${assetId}/zabbix-status`)
        .then((res) => {
          setStatus(res.data.status);
          setData(res.data);
        })
        .catch((err) => {
          console.error("Zabbix API Error:", err);
          setStatus("Error");
        });
    };

    // Chamada inicial
    checkStatus();

    // Polling em tempo real (a cada 15 segundos)
    const interval = setInterval(checkStatus, 15000);

    return () => clearInterval(interval);
  }, [assetId, ipAddress]);

  if (status === "No_IP") return <span className="text-xs text-slate-400 font-semibold">Sem IP</span>;
  if (status === "Loading") return <span className="text-xs text-slate-400 font-semibold flex items-center gap-1"><RefreshCw size={12} className="animate-spin" /> Verificando...</span>;
  if (status === "Error") return <span className="text-xs text-red-500 font-semibold">Erro de Conexão</span>;

  // Status OK
  if (status === "OK") {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 w-max">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
        <span className="text-xs font-bold">Online</span>
      </div>
    );
  }

  // Status Warning
  if (status === "Warning" || status === "Info") {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 text-amber-700 rounded-lg border border-amber-200 w-max" title={data?.problems?.[0]?.name}>
        <AlertTriangle size={12} />
        <span className="text-xs font-bold">Alerta</span>
      </div>
    );
  }

  // Status Critical
  if (status === "Critical" || status === "Disaster") {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-700 rounded-lg border border-red-200 w-max" title={data?.problems?.[0]?.name}>
        <AlertCircle size={12} />
        <span className="text-xs font-bold">Crítico</span>
      </div>
    );
  }

  // Desativado no Zabbix
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 text-slate-600 rounded-lg border border-slate-200 w-max">
      <span className="text-xs font-bold">Não Monitorado</span>
    </div>
  );
}

// Modal de Sincronização do Zabbix
function ZabbixSyncModal({ isOpen, onClose, onImported }) {
  const [discovering, setDiscovering] = useState(true);
  const [importing, setImporting] = useState(false);
  const [hosts, setHosts] = useState([]);
  const [selectedHosts, setSelectedHosts] = useState(new Set());

  useEffect(() => {
    if (isOpen) {
      setDiscovering(true);
      setSelectedHosts(new Set());
      api.get("/assets/zabbix/discover")
        .then((res) => {
          setHosts(res.data.hosts);
          // Auto select all by default
          setSelectedHosts(new Set(res.data.hosts.map(h => h.zabbix_host_id)));
        })
        .catch((err) => {
          console.error(err);
          // Mock data for UI testing if backend is down
          if (err.message === "Network Error" || err.code === "ERR_NETWORK") {
            const mockHosts = [
              { zabbix_host_id: "1001", name: "Mikrotik Borda", ip_address: "192.168.0.2", inferred_type: "Roteador", status: "Monitored" },
              { zabbix_host_id: "1002", name: "PC Governanca", ip_address: "192.168.1.55", inferred_type: "Desktop", status: "Monitored" },
              { zabbix_host_id: "1003", name: "AP Unifi Restaurante", ip_address: "192.168.1.18", inferred_type: "Access Point", status: "Monitored" }
            ];
            setHosts(mockHosts);
            setSelectedHosts(new Set(mockHosts.map(h => h.zabbix_host_id)));
          }
        })
        .finally(() => setDiscovering(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleSelect = (hostId) => {
    const newSelected = new Set(selectedHosts);
    if (newSelected.has(hostId)) {
      newSelected.delete(hostId);
    } else {
      newSelected.add(hostId);
    }
    setSelectedHosts(newSelected);
  };

  const handleImport = () => {
    const hostsToImport = hosts.filter(h => selectedHosts.has(h.zabbix_host_id)).map(h => ({
      name: h.name,
      type: h.inferred_type,
      ip_address: h.ip_address,
      description: "Importado via Zabbix Auto-Discovery"
    }));

    if (hostsToImport.length === 0) return;

    setImporting(true);
    api.post("/assets/zabbix/import", hostsToImport)
      .then(() => {
        onImported();
      })
      .catch((err) => {
        console.error(err);
        // Fallback for mock
        setTimeout(() => {
          onImported();
        }, 1000);
      })
      .finally(() => setImporting(false));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <CloudDownload size={24} className="text-blue-600" />
              Importador Inteligente Zabbix
            </h2>
            <p className="text-sm text-slate-500 font-medium mt-1">Descubra hosts não vinculados no CMDB</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
          {discovering ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <RefreshCw size={32} className="animate-spin mb-4 text-blue-600" />
              <p className="font-bold text-slate-700">Analisando infraestrutura...</p>
              <p className="text-sm">Cruzando IPs do Zabbix com a base do TIHFSA para ocultar ativos já cadastrados.</p>
            </div>
          ) : hosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <CheckCircle size={48} className="mb-4 text-emerald-500" />
              <p className="font-bold text-slate-700 text-lg">Todos os hosts estão sincronizados!</p>
              <p className="text-sm text-center max-w-sm mt-2">Nenhum IP "órfão" foi encontrado no Zabbix. Todos os equipamentos monitorados já possuem registro no CMDB do TIHFSA.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-600 mb-4 bg-blue-50 text-blue-700 p-3 rounded-lg border border-blue-100 flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>Foram encontrados <strong>{hosts.length}</strong> hosts no Zabbix que possuem um Endereço IP válido, mas que <strong>ainda não estão cadastrados no sistema TIHFSA</strong>. Selecione abaixo para importar:</span>
              </p>
              
              {hosts.map(host => (
                <div key={host.zabbix_host_id} onClick={() => handleToggleSelect(host.zabbix_host_id)} className={`bg-white p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-4 ${selectedHosts.has(host.zabbix_host_id) ? 'border-blue-500 shadow-sm ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${selectedHosts.has(host.zabbix_host_id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
                    {selectedHosts.has(host.zabbix_host_id) && <CheckCircle size={14} />}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-slate-900">{host.name}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs font-semibold text-slate-500">
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">{host.ip_address}</span>
                      <span>Tipo sugerido: <strong className="text-slate-700">{host.inferred_type}</strong></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
            Cancelar
          </button>
          <button 
            onClick={handleImport} 
            disabled={importing || hosts.length === 0 || selectedHosts.size === 0}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? <RefreshCw size={18} className="animate-spin" /> : <CloudDownload size={18} />}
            {importing ? "Importando..." : `Importar Selecionados (${selectedHosts.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Assets() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("Todos");
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  const fetchAssets = () => {
    setLoading(true);
    api.get("/assets")
      .then((r) => setAssets(r.data))
      .catch((err) => {
        console.error(err);
        // Fallback for mocked UI if backend is offline
        if (err.message === "Network Error" || err.code === "ERR_NETWORK") {
          setAssets([
            { id: 1, name: "Access Point Unifi Lobby", type: "Access Point", ip_address: "192.168.1.15", location: "Lobby" },
            { id: 2, name: "PC Recepção 01", type: "Desktop", ip_address: "192.168.1.50", location: "Recepção" },
            { id: 3, name: "TV Samsung 55'", type: "TV", ip_address: "192.168.2.101", location: "Apt 101" },
            { id: 4, name: "Switch Core HP", type: "Switch", ip_address: "192.168.0.1", location: "Rack Principal" },
            { id: 5, name: "Mouse Sem Fio", type: "Mouse", ip_address: null, location: "TI" }
          ]);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const types = ["Todos", "Desktop", "Access Point", "Switch", "TV", "Notebook", "Outro"];

  const filteredAssets = assets.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.ip_address && a.ip_address.includes(searchTerm));
    
    const matchesType = selectedType === "Todos" || a.type === selectedType;

    return matchesSearch && matchesType;
  });

  const getIconForType = (type) => {
    if (["Desktop", "Notebook"].includes(type)) return <Monitor size={18} />;
    if (["TV", "SKY"].includes(type)) return <HardDrive size={18} />;
    if (["Switch", "Roteador"].includes(type)) return <Server size={18} />;
    if (["Access Point", "Antena Unifi"].includes(type)) return <Wifi size={18} />;
    if (type === "Telefone") return <Phone size={18} />;
    return <HardDrive size={18} />;
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Inventário de Ativos (CMDB)</h1>
          <p className="text-sm font-semibold text-slate-500 mt-1">Gerencie os equipamentos e monitore o status via Zabbix</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={() => setIsSyncModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl text-sm font-bold shadow-xs hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <CloudDownload size={18} className="text-blue-600" />
            Sincronizar Zabbix
          </button>
          <button className="flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-colors cursor-pointer">
            <Plus size={18} />
            Novo Ativo
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Type Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedType === t
                  ? "bg-slate-800 text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl text-xs w-full md:w-72 shrink-0 focus-within:ring-2 focus-within:ring-slate-200 transition-all">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome ou IP..."
            className="bg-transparent text-slate-900 placeholder-slate-400 outline-none w-full font-medium"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-medium flex items-center justify-center gap-2">
            <RefreshCw size={18} className="animate-spin" /> Carregando CMDB...
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium">Nenhum ativo encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  <th className="px-6 py-4">Dispositivo</th>
                  <th className="px-6 py-4">Endereço IP</th>
                  <th className="px-6 py-4">Localização / Ref</th>
                  <th className="px-6 py-4">Status Zabbix NOC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                          {getIconForType(asset.type)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{asset.name}</p>
                          <p className="text-xs font-semibold text-slate-400">{asset.type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {asset.ip_address ? (
                        <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                          {asset.ip_address}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300 font-medium italic">S/N</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-700">{asset.location || asset.assigned_user?.name || "Desconhecido"}</p>
                    </td>
                    <td className="px-6 py-4">
                      <ZabbixStatusBadge assetId={asset.id} ipAddress={asset.ip_address} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ZabbixSyncModal 
        isOpen={isSyncModalOpen} 
        onClose={() => setIsSyncModalOpen(false)} 
        onImported={() => {
          setIsSyncModalOpen(false);
          fetchAssets();
        }}
      />
    </div>
  );
}
