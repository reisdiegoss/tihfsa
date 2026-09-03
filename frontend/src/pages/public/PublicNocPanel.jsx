import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { 
  Activity, Server, Wifi, Cpu, AlertCircle, CheckCircle, 
  RefreshCw, MapPin, Tag, Copy, Check, Tv, Maximize2, Terminal, X, Search, Network,
  Lock, Unlock, Key
} from "lucide-react";
import api from "../../api/client";
import TopologyMapBuilder from "../../components/admin/TopologyMapBuilder";

// Helper de cópia para área de transferência (com suporte a HTTP e HTTPS)
const copyToClipboard = async (text) => {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("navigator.clipboard falhou, tentando fallback...", err);
    }
  }

  // Fallback para HTTP não seguro (IP local / LAN)
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    if (successful) return true;
  } catch (err) {
    console.error("document.execCommand falhou:", err);
  }

  return false;
};

export default function PublicNocPanel() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Ler filtros da URL (Suporte a múltiplos navegadores/TVs)
  const locationId = searchParams.get("location_id") || "";
  const assetType = searchParams.get("type") || "Todos";
  const statusFilter = searchParams.get("status") || "Todos";
  const viewMode = searchParams.get("view") || "grid"; // 'grid', 'compact', 'map'
  const mapId = searchParams.get("map_id") || "";
  const refreshIntervalSec = parseInt(searchParams.get("refresh") || "15", 10);

  const [mapsList, setMapsList] = useState([]);
  const [currentMapId, setCurrentMapId] = useState(mapId || "");

  const [data, setData] = useState({
    assets: [],
    total_count: 0,
    online_count: 0,
    offline_count: 0,
    problem_count: 0,
    locations: [],
    asset_types: [],
  });

  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [countdown, setCountdown] = useState(refreshIntervalSec);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal de Diagnóstico Ping ao Vivo
  const [pingModal, setPingModal] = useState({ open: false, asset: null, loading: false, result: null });

  // Unlock Modal & State (TV Inline Editing)
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [unlockUsername, setUnlockUsername] = useState("admin");
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [unlockTimer, setUnlockTimer] = useState(null);

  const handleUnlockSubmit = (e) => {
    e.preventDefault();
    setUnlockError("");
    const formData = new URLSearchParams();
    formData.append("username", unlockUsername);
    formData.append("password", unlockPassword);

    api.post("/auth/login", formData, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    })
      .then((res) => {
        setIsUnlocked(true);
        setUnlockModalOpen(false);
        setUnlockPassword("");
        // Auto lock after 3 minutes
        resetUnlockTimer();
      })
      .catch((err) => {
        setUnlockError("Credenciais inválidas");
      });
  };

  const resetUnlockTimer = () => {
    if (unlockTimer) clearTimeout(unlockTimer);
    const timer = setTimeout(() => {
      setIsUnlocked(false);
    }, 3 * 60 * 1000); // 3 minutes
    setUnlockTimer(timer);
  };

  // Reset timer on user interaction if unlocked
  useEffect(() => {
    const handleActivity = () => {
      if (isUnlocked) resetUnlockTimer();
    };
    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);
    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
    };
  }, [isUnlocked, unlockTimer]);

  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (locationId) params.append("location_id", locationId);
    if (assetType && assetType !== "Todos") params.append("type", assetType);
    if (statusFilter && statusFilter !== "Todos") params.append("status", statusFilter);

    // Atualiza também a lista de mapas caso algum tenha sido renomeado ou criado
    api.get("/network-maps")
      .then((res) => setMapsList(res.data || []))
      .catch(() => {});

    api.get(`/zabbix/public-noc?${params.toString()}`)
      .then((res) => {
        setData(res.data || {});
        setLastUpdate(new Date());
        setCountdown(refreshIntervalSec);
      })
      .catch((err) => {
        console.error("Public NOC API Error:", err);
      })
      .finally(() => setLoading(false));
  };

  // Carregar mapas disponíveis para seleção de diagrama na TV
  useEffect(() => {
    api.get("/network-maps")
      .then((res) => {
        const list = res.data || [];
        setMapsList(list);
        if (!mapId && list.length > 0) {
          setCurrentMapId(String(list[0].id));
        }
      })
      .catch((err) => console.error("Erro ao carregar lista de mapas:", err));
  }, []);

  useEffect(() => {
    if (mapId) {
      setCurrentMapId(mapId);
    }
  }, [mapId]);

  useEffect(() => {
    fetchData();
  }, [locationId, assetType, statusFilter]);

  // Timer de Auto-Refresh e Contagem Regressiva
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchData();
          return refreshIntervalSec;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [refreshIntervalSec, locationId, assetType, statusFilter]);

  // Atualizar parâmetros da URL quando o usuário altera um filtro na tela
  const handleFilterChange = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (!value || value === "Todos") {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
    if (key === "view" && value === "map" && currentMapId) {
      newParams.set("map_id", currentMapId);
    }
    setSearchParams(newParams);
  };

  // Selecionar diagrama específico para a TV
  const handleMapChange = (newMapId) => {
    setCurrentMapId(newMapId);
    const newParams = new URLSearchParams(searchParams);
    if (newMapId) {
      newParams.set("map_id", newMapId);
    } else {
      newParams.delete("map_id");
    }
    setSearchParams(newParams);
  };

  const handleCopyShareableUrl = async () => {
    const params = new URLSearchParams();
    if (locationId) params.set("location_id", locationId);
    if (assetType && assetType !== "Todos") params.set("type", assetType);
    if (statusFilter && statusFilter !== "Todos") params.set("status", statusFilter);
    if (viewMode) params.set("view", viewMode);

    // Se estiver visualizando o fluxograma, garante que o ID do mapa atual seja incluído
    const effectiveMapId = currentMapId || mapId;
    if (effectiveMapId && viewMode === "map") {
      params.set("map_id", effectiveMapId);
    }

    params.set("refresh", String(refreshIntervalSec));
    const fullUrl = `${window.location.origin}/noc?${params.toString()}`;

    const ok = await copyToClipboard(fullUrl);
    if (ok) {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } else {
      // Se a cópia automática falhar por restrições de permissão do navegador, abre prompt
      window.prompt("Copie a URL abaixo para abrir na TV:", fullUrl);
    }
  };

  const handleRunLivePing = (asset) => {
    setPingModal({ open: true, asset, loading: true, result: null });
    api.get(`/zabbix/live-ping/${asset.id}`)
      .then((res) => {
        setPingModal((prev) => ({ ...prev, loading: false, result: res.data }));
      })
      .catch((err) => {
        setPingModal((prev) => ({ 
          ...prev, 
          loading: false, 
          result: { status: "offline", output: `Erro ao executar ping: ${err.message}` } 
        }));
      });
  };

  // Filtragem local por busca rápida de nome/IP
  const filteredAssets = (data.assets || []).filter((a) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      a.name.toLowerCase().includes(term) ||
      (a.ip_address && a.ip_address.includes(term)) ||
      (a.location_name && a.location_name.toLowerCase().includes(term))
    );
  });

  return (
    <div className={`bg-slate-950 text-slate-100 font-sans flex flex-col ${
      viewMode === "map"
        ? "h-screen w-full p-3 md:p-4 space-y-3 overflow-hidden"
        : "min-h-screen p-4 md:p-6 lg:p-8 space-y-6"
    }`}>
      
      {/* Top Header / TV Control Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl backdrop-blur-xl flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        
        {/* Branding & Status Live */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0 shadow-[0_0_20px_rgba(37,99,235,0.3)]">
            <Tv size={26} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">TIHFSA • Painel NOC TV</h1>
              <button 
                onClick={() => {
                  if (isUnlocked) {
                    setIsUnlocked(false);
                    if (unlockTimer) clearTimeout(unlockTimer);
                  } else {
                    setUnlockModalOpen(true);
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold transition-colors cursor-pointer border ${
                  isUnlocked 
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20" 
                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                }`}
                title={isUnlocked ? "Modo de Edição Ativo. Cliqua para bloquear." : "Clique para desbloquear edição"}
              >
                {isUnlocked ? (
                  <>
                    <Unlock size={14} className="animate-pulse" />
                    MODO DE EDIÇÃO AO VIVO
                  </>
                ) : (
                  <>
                    <Lock size={14} />
                    TRANSMISSÃO PÚBLICA AO VIVO
                  </>
                )}
              </button>
            </div>
            <p className="text-xs font-semibold text-slate-400 mt-1 flex items-center gap-2">
              <span>Monitoramento Unificado ICMP / Zabbix / SNMP</span>
              <span className="text-slate-600">•</span>
              <span>Atualização em <strong className="text-blue-400">{countdown}s</strong></span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-500">Última leitura: {lastUpdate.toLocaleTimeString()}</span>
            </p>
          </div>
        </div>

        {/* Toolbar & Multi-Window URL Filters */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Filtro por Localização */}
          <select
            value={locationId}
            onChange={(e) => handleFilterChange("location_id", e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-extrabold text-slate-300 outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="">Todas as Localizações</option>
            {(data.locations || []).map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>

          {/* Filtro por Tipo */}
          <select
            value={assetType}
            onChange={(e) => handleFilterChange("type", e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-extrabold text-slate-300 outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="Todos">Todos os Tipos</option>
            {(data.asset_types || []).map((t) => (
              <option key={t.id} value={t.name}>{t.name}</option>
            ))}
          </select>

          {/* Filtro por Status */}
          <select
            value={statusFilter}
            onChange={(e) => handleFilterChange("status", e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-extrabold text-slate-300 outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="Todos">Todos os Status</option>
            <option value="icmp_online">🟢 Conectividade Ping Online</option>
            <option value="icmp_offline">🔴 Conectividade Ping Offline</option>
            <option value="zabbix_problem">🔴 Alertas NOC Ativos</option>
            <option value="zabbix_ok">🟢 Sem Alertas NOC</option>
          </select>

          {/* Modo de Visualização */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
            <button
              onClick={() => handleFilterChange("view", "grid")}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                viewMode === "grid" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Mosaico Cards
            </button>
            <button
              onClick={() => handleFilterChange("view", "compact")}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                viewMode === "compact" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Lista
            </button>
            <button
              onClick={() => handleFilterChange("view", "map")}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === "map" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <Network size={13} /> Fluxograma
            </button>
          </div>

          {/* Seletor de Diagrama para TV (Visível quando em modo Fluxograma) */}
          {viewMode === "map" && mapsList.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-950 border border-emerald-500/40 rounded-xl px-2.5 py-1.5 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
              <Network size={13} className="text-emerald-400 shrink-0" />
              <select
                value={currentMapId || ""}
                onChange={(e) => handleMapChange(e.target.value)}
                className="bg-transparent text-xs font-black text-emerald-300 outline-none cursor-pointer max-w-[200px] truncate"
                title="Selecione qual diagrama de rede exibir na TV"
              >
                {mapsList.map((m) => (
                  <option key={m.id} value={m.id} className="bg-slate-900 text-white font-bold">
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Botão Copiar URL Configurada para TV */}
          <button
            onClick={handleCopyShareableUrl}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] cursor-pointer"
            title="Copiar URL formatada com estes filtros para abrir no navegador da TV"
          >
            {copiedUrl ? <Check size={14} /> : <Copy size={14} />}
            <span>{copiedUrl ? "URL Copiada!" : "Copiar URL TV"}</span>
          </button>

          <button
            onClick={fetchData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer"
            title="Recarregar dados agora"
          >
            <RefreshCw size={16} className={loading ? "animate-spin text-blue-400" : ""} />
          </button>
        </div>
      </div>

      {/* Exibição do Mapa de Topologia em Tela Cheia para TV */}
      {viewMode === "map" ? (
        <div className="flex-1 w-full h-full min-h-0 flex flex-col">
          <TopologyMapBuilder 
            isPublicView={!isUnlocked} 
            mapId={currentMapId ? parseInt(currentMapId, 10) : (mapId ? parseInt(mapId, 10) : undefined)} 
            refreshTrigger={lastUpdate}
            onMapLoaded={(loadedMap) => {
              if (loadedMap?.id) {
                const idStr = String(loadedMap.id);
                if (idStr !== currentMapId) {
                  setCurrentMapId(idStr);
                }
              }
            }}
          />
        </div>
      ) : (
        <>
          {/* Counter Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Monitored */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Total de Ativos</p>
            <p className="text-3xl font-black text-white mt-1">{data.total_count || 0}</p>
            <p className="text-[10px] font-semibold text-slate-500 mt-1">Dispositivos no filtro</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
            <Server size={22} />
          </div>
        </div>

        {/* ICMP Ping Online */}
        <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase text-emerald-400 tracking-wider">Conectividade Ping</p>
            <p className="text-3xl font-black text-emerald-300 mt-1">{data.online_count || 0}</p>
            <p className="text-[10px] font-semibold text-emerald-500/80 mt-1">
              {data.offline_count > 0 ? `🔴 ${data.offline_count} Indisponível(is)` : "🟢 100% Respondem ao Ping"}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
            <CheckCircle size={22} />
          </div>
        </div>

        {/* Zabbix NOC Alerts */}
        <div className={`border rounded-2xl p-4 flex items-center justify-between ${
          (data.problem_count || 0) > 0 
            ? "bg-amber-950/40 border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.1)]" 
            : "bg-slate-900/80 border-slate-800"
        }`}>
          <div>
            <p className="text-[11px] font-extrabold uppercase text-amber-400 tracking-wider">Alertas NOC (Zabbix)</p>
            <p className="text-3xl font-black text-amber-300 mt-1">{data.problem_count || 0}</p>
            <p className="text-[10px] font-semibold text-amber-500/80 mt-1">Alertas de saúde ativos</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 border border-amber-500/30">
            <AlertCircle size={22} className={(data.problem_count || 0) > 0 ? "animate-pulse" : ""} />
          </div>
        </div>

        {/* Search Quick Input */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Busca rápida no painel TV..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 outline-none focus:border-blue-500 transition-all"
            />
          </div>
        </div>

      </div>

      {/* Main Asset Grid Display */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
          {filteredAssets.map((asset) => (
            <div 
              key={asset.id}
              className={`rounded-2xl p-4 border transition-all duration-300 flex flex-col justify-between space-y-3 ${
                asset.icmp_status === "offline"
                  ? "bg-red-950/40 border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.2)] animate-pulse"
                  : asset.zabbix_status === "problem"
                  ? "bg-amber-950/20 border-amber-500/40"
                  : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div>
                {/* Header Card */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-black text-sm text-white truncate max-w-[160px]">{asset.name}</h3>
                    <p className="text-[11px] font-semibold text-slate-400 truncate">{asset.brand} {asset.model}</p>
                  </div>
                  
                  {/* Protocol Badge */}
                  {asset.monitoring_protocol === "snmp" ? (
                    <span className="px-2 py-0.5 rounded text-[9px] font-mono font-black bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      SNMP
                    </span>
                  ) : asset.monitoring_protocol === "agent" ? (
                    <span className="px-2 py-0.5 rounded text-[9px] font-mono font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                      AGENT
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[9px] font-mono font-black bg-slate-800 text-slate-400 border border-slate-700">
                      ICMP
                    </span>
                  )}
                </div>

                {/* Sub details */}
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] uppercase font-bold text-slate-500">IP:</span>
                    <span className="font-mono font-bold text-slate-200">{asset.ip_address || "Sem IP"}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Local:</span>
                    <span className="font-bold text-blue-400 truncate max-w-[110px]">{asset.location_name || "Geral"}</span>
                  </div>

                  {asset.asset_tag && (
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Patrimônio:</span>
                      <span className="font-mono font-bold text-slate-300">{asset.asset_tag}</span>
                    </div>
                  )}
                </div>

                {/* Zabbix Alert Pill if active */}
                {asset.zabbix_status === "problem" && (
                  <div className="mt-3 p-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-[11px] font-bold flex items-center gap-1.5">
                    <AlertCircle size={14} className="text-red-400 shrink-0 animate-pulse" />
                    <span className="truncate">{asset.zabbix_alert_title || "Em Alerta"}</span>
                  </div>
                )}
              </div>

              {/* Status Footer & Live Ping Action */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    asset.icmp_status === "offline" ? "bg-red-500 animate-ping" : "bg-emerald-500 animate-pulse"
                  }`} />
                  <span className={`text-xs font-black ${
                    asset.icmp_status === "offline" ? "text-red-400" : "text-emerald-400"
                  }`}>
                    {asset.icmp_status === "offline" ? "OFFLINE" : "PING OK"}
                  </span>
                </div>

                <button
                  onClick={() => handleRunLivePing(asset)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                  title="Executar teste Ping ICMP ao vivo"
                >
                  <Terminal size={11} className="text-blue-400" /> Ping ao Vivo
                </button>
              </div>

            </div>
          ))}
        </div>
      ) : (
        /* Visualização em Tabela Compacta */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-black text-slate-400 uppercase bg-slate-950/60">
                <th className="px-5 py-4">Equipamento</th>
                <th className="px-4 py-4">IP</th>
                <th className="px-4 py-4">Local</th>
                <th className="px-4 py-4">Protocolo</th>
                <th className="px-4 py-4">Ping ICMP</th>
                <th className="px-4 py-4">Alerta Zabbix</th>
                <th className="px-5 py-4 text-right">Diagnóstico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs font-semibold">
              {filteredAssets.map((asset) => (
                <tr key={asset.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-white">
                    {asset.name} <span className="text-slate-500 text-[11px] font-normal">• {asset.type}</span>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-slate-300">{asset.ip_address || "—"}</td>
                  <td className="px-4 py-3.5 text-blue-400 font-bold">{asset.location_name || "Geral"}</td>
                  <td className="px-4 py-3.5">
                    <span className="font-mono text-[10px] font-black uppercase text-purple-400">
                      {asset.monitoring_protocol}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-black ${
                      asset.icmp_status === "offline" ? "bg-red-500/20 text-red-400 border border-red-500/40" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    }`}>
                      {asset.icmp_status === "offline" ? "🔴 OFFLINE" : "🟢 ONLINE"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {asset.zabbix_status === "problem" ? (
                      <span className="text-red-400 font-bold truncate max-w-[200px] block" title={asset.zabbix_alert_title}>
                        {asset.zabbix_alert_title}
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">Sem alertas</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => handleRunLivePing(asset)}
                      className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Terminal size={12} /> Ping ao Vivo
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>
      )}

      {/* Ping Modal */}
      {pingModal.open && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                  <Terminal size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-200">Terminal de Diagnóstico</h3>
                  <p className="text-xs text-slate-400">Ping ICMP para {pingModal.asset?.ip_address || "N/A"}</p>
                </div>
              </div>
              <button 
                onClick={() => setPingModal({ open: false, asset: null, loading: false, result: null })}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 bg-[#0a0a0a] font-mono text-sm h-80 overflow-y-auto">
              <div className="text-emerald-400 mb-2">$ ping -c 4 {pingModal.asset?.ip_address}</div>
              {pingModal.loading ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-3">
                  <RefreshCw size={32} className="animate-spin text-blue-500" />
                  <p className="font-bold">Disparando pacotes ICMP para {pingModal.asset?.ip_address}...</p>
                </div>
              ) : pingModal.result ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Status Conectividade</span>
                      <p className={`text-lg font-black mt-0.5 ${
                        pingModal.result.status === "online" ? "text-emerald-400" : "text-red-400"
                      }`}>
                        {pingModal.result.status === "online" ? "🟢 ONLINE" : "🔴 OFFLINE"}
                      </p>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Latência / Perda</span>
                      <p className="text-lg font-black text-blue-400 mt-0.5">
                        {pingModal.result.latency_ms} ms <span className="text-xs text-slate-400">({pingModal.result.packet_loss}% perda)</span>
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {pingModal.result.output}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setPingModal({ open: false, asset: null, loading: false, result: null })}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-extrabold text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Unlock Modal for TV Editing */}
      {unlockModalOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Key size={20} />
                </div>
                <h2 className="text-lg font-bold text-white">Desbloquear Painel</h2>
              </div>
              <button onClick={() => setUnlockModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-slate-400 mb-4">
              O modo de edição permite arrastar e modificar o mapa diretamente na TV. O painel bloqueará automaticamente após 3 minutos de inatividade.
            </p>

            <form onSubmit={handleUnlockSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Usuário</label>
                <input
                  type="text"
                  value={unlockUsername}
                  onChange={(e) => setUnlockUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:border-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Senha de Admin</label>
                <input
                  type="password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:border-blue-500 outline-none"
                  required
                  autoFocus
                />
              </div>

              {unlockError && (
                <div className="text-xs text-red-400 bg-red-400/10 p-2 rounded-lg text-center font-semibold">
                  {unlockError}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-2 text-sm font-bold transition-all cursor-pointer shadow-lg shadow-blue-500/20"
                >
                  Confirmar e Desbloquear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

