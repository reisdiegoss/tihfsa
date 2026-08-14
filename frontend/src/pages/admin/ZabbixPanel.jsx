import { useState, useEffect } from "react";
import { 
  Activity, AlertTriangle, AlertCircle, ShieldAlert, CheckCircle, 
  Info, TicketPlus, RefreshCw, Server, Terminal, ExternalLink, Filter, Tv, Network, List
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import TopologyMapBuilder from "../../components/admin/TopologyMapBuilder";

export default function ZabbixPanel() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("alerts"); // 'alerts' ou 'topology'
  const [alerts, setAlerts] = useState([]);
  const [totalNetworkProblems, setTotalNetworkProblems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [creatingTicket, setCreatingTicket] = useState(null);

  const fetchAlerts = () => {
    setLoading(true);
    api.get("/zabbix/alerts")
      .then((res) => {
        setAlerts(res.data.alerts || []);
        setTotalNetworkProblems(res.data.total_zabbix_problems || 0);
        setLastUpdate(new Date());
      })
      .catch((err) => {
        console.error("Zabbix API Error:", err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAlerts();
    // Auto-refresh a cada 30 segundos (NOC Standard)
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateTicket = (alertItem) => {
    if (alertItem.ticket_id) {
      navigate("/admin/tickets");
      return;
    }

    setCreatingTicket(alertItem.eventid);
    const payload = {
      title: `${alertItem.host || "Host"} - ${alertItem.name}`,
      description: `Alerta Zabbix NOC (Evento: ${alertItem.eventid})\nGravidade: ${alertItem.severity}`,
      asset_id: alertItem.asset_id,
    };

    api.post(`/zabbix/alerts/${alertItem.eventid}/create-ticket`, payload)
      .then(() => {
        fetchAlerts();
      })
      .catch((err) => {
        console.error(err);
        alert("Erro ao criar chamado.");
      })
      .finally(() => setCreatingTicket(null));
  };

  // Zabbix Severities: 0=Not classified, 1=Information, 2=Warning, 3=Average, 4=High, 5=Disaster
  const getSeverityStyle = (severity) => {
    const s = parseInt(severity);
    if (s >= 5) return { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", icon: <ShieldAlert size={20} className="text-red-500" />, label: "Desastre" };
    if (s === 4) return { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-400", icon: <AlertCircle size={20} className="text-orange-500" />, label: "Crítico" };
    if (s === 3) return { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", icon: <AlertTriangle size={20} className="text-amber-500" />, label: "Atenção (Alta)" };
    if (s === 2) return { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-400", icon: <AlertTriangle size={20} className="text-yellow-500" />, label: "Atenção" };
    if (s === 1) return { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400", icon: <Info size={20} className="text-blue-500" />, label: "Info" };
    return { bg: "bg-slate-500/10", border: "border-slate-500/30", text: "text-slate-400", icon: <Info size={20} className="text-slate-500" />, label: "Não Classificado" };
  };

  const disasterCount = alerts.filter(a => parseInt(a.severity) >= 4).length;
  const warningCount = alerts.filter(a => parseInt(a.severity) === 2 || parseInt(a.severity) === 3).length;

  return (
    // Tema Escuro forçado para o painel NOC
    <div className="bg-slate-950 min-h-[calc(100vh-80px)] -m-4 sm:-m-8 p-4 sm:p-8 font-sans text-slate-300">
      
      {/* NOC Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
              <Activity className="text-blue-400" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight uppercase">Zabbix NOC Panel</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-semibold text-emerald-400">Integração Ativa (Filtrado por Ativos TIHFSA)</span>
                <span className="text-xs text-slate-500 ml-2">| Última atualização: {lastUpdate.toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-3 flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Críticos (Ativos TIHFSA)</p>
              <p className="text-2xl font-black text-red-500">{disasterCount}</p>
            </div>
            <div className="h-10 w-px bg-slate-800"></div>
            <div className="text-left">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Atenção (Ativos TIHFSA)</p>
              <p className="text-2xl font-black text-amber-500">{warningCount}</p>
            </div>
          </div>

          <a 
            href="/noc" 
            target="_blank"
            rel="noopener noreferrer"
            className="h-14 px-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 cursor-pointer text-xs uppercase"
            title="Abrir URL pública em tela cheia para TV ou Monitor de setor (sem necessidade de senha)"
          >
            <Tv size={18} />
            <span>Painel TV Público (/noc)</span>
          </a>

          <button 
            onClick={fetchAlerts}
            className="h-14 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)] flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Recarregar</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs (Feed de Incidentes vs Topologia de Rede) */}
      <div className="bg-slate-900 p-1.5 rounded-2xl border border-slate-800 mb-6 flex items-center gap-2 max-w-md">
        <button
          onClick={() => setActiveTab("alerts")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === "alerts"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <List size={16} /> Incidentes & Chamados NOC
        </button>
        <button
          onClick={() => setActiveTab("topology")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === "topology"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <Network size={16} /> Fluxograma de Topologia
        </button>
      </div>

      {activeTab === "topology" ? (
        <TopologyMapBuilder />
      ) : (
        <>
          {/* Info Bar Explicativa do Filtro */}
          <div className="bg-slate-900/80 border border-blue-900/40 rounded-2xl p-4 mb-6 text-xs text-slate-400 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Filter size={18} className="text-blue-400 shrink-0" />
              <span>
                Exibindo apenas alertas de equipamentos <strong>importados no CMDB do TIHFSA</strong>. Chamados são <strong>abertos automaticamente</strong> para cada alerta detectado.
              </span>
            </div>
            <span className="text-[11px] font-bold bg-blue-950 text-blue-300 border border-blue-800/50 px-3 py-1 rounded-full">
              {alerts.length} alertas de ativos ({totalNetworkProblems} incidentes globais no Zabbix)
            </span>
          </div>

      {/* Main Alert Feed */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Terminal size={16} /> Feed de Incidentes dos Equipamentos do TIHFSA
          </h2>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span>Alertas ativos: <strong className="text-slate-300">{alerts.length}</strong></span>
          </div>
        </div>

        {loading && alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500">
            <RefreshCw size={40} className="animate-spin mb-4 text-blue-500 opacity-50" />
            <p className="font-bold text-slate-400">Consultando Zabbix Server e chamados automáticos...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500">
            <CheckCircle size={64} className="mb-4 text-emerald-500/50" />
            <p className="font-black text-xl text-emerald-400">Tudo OK com os Equipamentos do TIHFSA!</p>
            <p className="text-sm font-medium mt-2 text-slate-400">Nenhum incidente ativo nos equipamentos cadastrados no momento.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {alerts.sort((a, b) => parseInt(b.severity) - parseInt(a.severity)).map((alertItem) => {
              const style = getSeverityStyle(alertItem.severity);
              const timeString = new Date(alertItem.clock * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              
              return (
                <div key={alertItem.eventid} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:bg-slate-800/50 group">
                  
                  <div className="flex items-start gap-4">
                    <div className={`mt-1 p-2.5 rounded-xl ${style.bg} ${style.border} border`}>
                      {style.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                          {style.label}
                        </span>
                        <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                          <Server size={12} className="text-blue-400" /> {alertItem.host}
                        </span>
                        {alertItem.host_ip && (
                          <span className="text-[11px] font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                            {alertItem.host_ip}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-200">{alertItem.name}</h3>
                      <p className="text-xs text-slate-500 font-medium mt-1">Evento Zabbix: #{alertItem.eventid} • Iniciado às {timeString}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
                    {alertItem.ticket_id ? (
                      <button
                        onClick={() => navigate("/admin/tickets")}
                        className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                      >
                        <CheckCircle size={16} />
                        <span>Chamado #{alertItem.ticket_id} Aberto Automático</span>
                        <ExternalLink size={14} />
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleCreateTicket(alertItem)}
                        disabled={creatingTicket === alertItem.eventid}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {creatingTicket === alertItem.eventid ? <RefreshCw size={16} className="animate-spin" /> : <TicketPlus size={16} />}
                        Abrir Chamado
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
        </>
      )}

    </div>
  );
}
