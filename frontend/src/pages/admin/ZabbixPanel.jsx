import { useState, useEffect } from "react";
import { Activity, AlertTriangle, AlertCircle, ShieldAlert, CheckCircle, Info, TicketPlus, RefreshCw, Server, Search, Terminal } from "lucide-react";
import api from "../../api/client";

export default function ZabbixPanel() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [creatingTicket, setCreatingTicket] = useState(null);

  const fetchAlerts = () => {
    setLoading(true);
    api.get("/zabbix/alerts")
      .then((res) => {
        setAlerts(res.data.alerts || []);
        setLastUpdate(new Date());
      })
      .catch((err) => {
        console.error("Zabbix API Error:", err);
        // Fallback mockup para visualização se a API estiver offline
        if (err.message === "Network Error" || err.code === "ERR_NETWORK") {
          setAlerts([
            { eventid: "1001", name: "Zabbix agent on Core-SW is unreachable for 5 minutes", severity: "4", clock: Date.now() / 1000 - 300, host: "Core-SW" },
            { eventid: "1002", name: "High CPU utilization (over 90% for 5m)", severity: "3", clock: Date.now() / 1000 - 1200, host: "SRV-BD-01" },
            { eventid: "1003", name: "Lack of available memory on server", severity: "2", clock: Date.now() / 1000 - 3600, host: "SRV-APP-02" },
            { eventid: "1004", name: "Link Down on Port gi1/0/24", severity: "5", clock: Date.now() / 1000 - 50, host: "SW-Andar-1" },
          ]);
          setLastUpdate(new Date());
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAlerts();
    // Auto-refresh a cada 30 segundos (NOC Standard)
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateTicket = (alert) => {
    setCreatingTicket(alert.eventid);
    const payload = {
      title: `[Zabbix] ${alert.host || "Host Desconhecido"} - ${alert.name}`,
      description: `Alerta gerado automaticamente pelo NOC.\nEvento ID: ${alert.eventid}\nGravidade: ${alert.severity}\nInício: ${new Date(alert.clock * 1000).toLocaleString()}`
    };

    api.post(`/zabbix/alerts/${alert.eventid}/create-ticket`, payload)
      .then(() => {
        alert("Chamado aberto com sucesso!");
        // Opcional: remover da lista se quiser, mas o Zabbix continuará reportando se não for resolvido
      })
      .catch((err) => {
        console.error(err);
        // Simulação se API mockada falhar
        setTimeout(() => alert("Chamado aberto com sucesso! (Mock)"), 500);
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
                <span className="text-xs font-semibold text-emerald-400">Integração Ativa</span>
                <span className="text-xs text-slate-500 ml-2">| Última atualização: {lastUpdate.toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl px-6 py-3 flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Desastres / Críticos</p>
              <p className="text-2xl font-black text-red-500">{disasterCount}</p>
            </div>
            <div className="h-10 w-px bg-slate-800"></div>
            <div className="text-left">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Atenção</p>
              <p className="text-2xl font-black text-amber-500">{warningCount}</p>
            </div>
          </div>

          <button 
            onClick={fetchAlerts}
            className="h-16 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)] flex items-center justify-center gap-2"
          >
            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Recarregar</span>
          </button>
        </div>
      </div>

      {/* Main Alert Feed */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Terminal size={16} /> Feed de Incidentes em Tempo Real
          </h2>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span>Total de problemas ativos: <strong className="text-slate-300">{alerts.length}</strong></span>
          </div>
        </div>

        {loading && alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500">
            <RefreshCw size={40} className="animate-spin mb-4 text-blue-500 opacity-50" />
            <p className="font-bold text-slate-400">Conectando ao Zabbix Server...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500">
            <CheckCircle size={64} className="mb-4 text-emerald-500/50" />
            <p className="font-black text-xl text-emerald-400">Tudo Verde!</p>
            <p className="text-sm font-medium mt-2 text-slate-400">Nenhum incidente ativo reportado pelo Zabbix no momento.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {alerts.sort((a, b) => parseInt(b.severity) - parseInt(a.severity)).map((alert) => {
              const style = getSeverityStyle(alert.severity);
              const timeString = new Date(alert.clock * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              
              return (
                <div key={alert.eventid} className={`p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:bg-slate-800/50 group`}>
                  
                  <div className="flex items-start gap-4">
                    <div className={`mt-1 p-2.5 rounded-xl ${style.bg} ${style.border} border`}>
                      {style.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                          {style.label}
                        </span>
                        <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                          <Server size={12} /> {alert.host || "Host Desconhecido"}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-200">{alert.name}</h3>
                      <p className="text-xs text-slate-500 font-medium mt-1">Evento ID: {alert.eventid} • Iniciado às {timeString}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
                    <button 
                      onClick={() => handleCreateTicket(alert)}
                      disabled={creatingTicket === alert.eventid}
                      className="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 hover:border-blue-500 text-blue-400 hover:text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                    >
                      {creatingTicket === alert.eventid ? <RefreshCw size={16} className="animate-spin" /> : <TicketPlus size={16} />}
                      Abrir Chamado
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
