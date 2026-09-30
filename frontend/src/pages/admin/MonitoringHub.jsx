import { useState, useEffect } from "react";
import { 
  Activity, Ticket, Tv, ExternalLink, RefreshCw, 
  Clock, AlertTriangle, AlertCircle, ShieldAlert, CheckCircle2, 
  Users, Building, ChevronRight, Layers, ArrowUpRight, Flame
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../api/client";
import ZabbixPanel from "./ZabbixPanel";

export default function MonitoringHub() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "helpdesk"; // 'helpdesk' ou 'noc'
  const [activeTab, setActiveTab] = useState(initialTab);

  // Helpdesk Data States
  const [summaryData, setSummaryData] = useState(null);
  const [loadingHelpdesk, setLoadingHelpdesk] = useState(true);
  const [periodDays, setPeriodDays] = useState(7);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const fetchHelpdeskSummary = () => {
    setLoadingHelpdesk(true);
    api.get(`/monitoring/helpdesk/summary?period_days=${periodDays}`)
      .then((res) => {
        setSummaryData(res.data);
        setLastUpdate(new Date());
      })
      .catch((err) => {
        console.error("Erro ao carregar dados de monitoramento do Helpdesk:", err);
      })
      .finally(() => setLoadingHelpdesk(false));
  };

  useEffect(() => {
    if (activeTab === "helpdesk") {
      fetchHelpdeskSummary();
      const interval = setInterval(fetchHelpdeskSummary, 20000); // 20s refresh
      return () => clearInterval(interval);
    }
  }, [activeTab, periodDays]);

  const kpis = summaryData?.kpis || {};
  const urgentQueue = summaryData?.urgent_queue || [];
  const techLoad = summaryData?.technicians_load || [];
  const topSectors = summaryData?.top_sectors || [];

  const formatMinutesRemaining = (mins) => {
    if (mins < 0) return `${Math.abs(mins)} min estourado`;
    if (mins < 60) return `${mins} min restantes`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m restantes` : `${h}h restantes`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Bar com Hub Navigation e Botões para TVs */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
              <Activity size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 leading-tight tracking-tight">
                Central de Monitoramento & Wallboards
              </h1>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Visão operacional em tempo real de Infraestrutura (NOC) e Chamados de Helpdesk do Hotel Fasano Salvador
              </p>
            </div>
          </div>
        </div>

        {/* Botões Rápidos para Abertura das TVs */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <a
            href="/noc"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 transition-all font-bold text-xs shadow-md shadow-slate-900/10 cursor-pointer border border-slate-800"
            title="Abre a tela cheia do painel de NOC para a TV de Redes"
          >
            <Tv size={16} className="text-emerald-400" />
            <span>📺 TV 1: NOC & Redes</span>
            <ExternalLink size={13} className="text-slate-400 ml-0.5" />
          </a>

          <a
            href="/tv/helpdesk"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 transition-all font-bold text-xs shadow-md shadow-blue-600/20 cursor-pointer border border-blue-500"
            title="Abre a tela cheia do painel de Helpdesk para a TV de Chamados"
          >
            <Tv size={16} className="text-amber-300" />
            <span>📺 TV 2: Helpdesk & SLA</span>
            <ExternalLink size={13} className="text-white/70 ml-0.5" />
          </a>
        </div>
      </div>

      {/* Seletor de Abas do Hub */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-200/60 rounded-2xl w-full sm:w-fit overflow-x-auto">
        <button
          onClick={() => handleTabChange("helpdesk")}
          className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all duration-200 cursor-pointer whitespace-nowrap ${
            activeTab === "helpdesk"
              ? "bg-white text-blue-600 shadow-sm shadow-slate-200/60 scale-[1.01]"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60 font-bold"
          }`}
        >
          <Ticket size={17} />
          <span>Helpdesk & Chamados (SLA)</span>
          {kpis.total_open !== undefined && (
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
              kpis.total_open > 0 ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-500"
            }`}>
              {kpis.total_open}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange("noc")}
          className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all duration-200 cursor-pointer whitespace-nowrap ${
            activeTab === "noc"
              ? "bg-white text-blue-600 shadow-sm shadow-slate-200/60 scale-[1.01]"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60 font-bold"
          }`}
        >
          <Activity size={17} />
          <span>NOC & Infraestrutura (Zabbix)</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* ABA 1: HELPDESK & CHAMADOS (SLA)                          */}
      {/* ======================================================== */}
      {activeTab === "helpdesk" && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Action & Status Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 text-xs">
            <div className="flex items-center gap-2 text-slate-600 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Monitoramento em tempo real • Atualizado às {lastUpdate.toLocaleTimeString()}</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Período SLA:</span>
                <select
                  value={periodDays}
                  onChange={(e) => setPeriodDays(parseInt(e.target.value, 10))}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-bold text-slate-700"
                >
                  <option value={1}>Últimas 24h</option>
                  <option value={7}>Últimos 7 dias</option>
                  <option value={30}>Últimos 30 dias</option>
                </select>
              </div>

              <button
                onClick={fetchHelpdeskSummary}
                disabled={loadingHelpdesk}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer transition-colors"
                title="Atualizar agora"
              >
                <RefreshCw size={14} className={loadingHelpdesk ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Cards de KPIs Principais */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* Total Ativos */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Abertos Ativos</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{kpis.total_open ?? 0}</p>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">
                <span>{kpis.new_count ?? 0} Novos</span> • <span>{kpis.in_progress_count ?? 0} Em atend.</span>
              </div>
            </div>

            {/* Sem Técnico */}
            <div className={`p-4 rounded-2xl border shadow-2xs ${
              (kpis.unassigned_count || 0) > 0 ? "bg-amber-50/70 border-amber-200" : "bg-white border-slate-200"
            }`}>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Sem Técnico</p>
                {(kpis.unassigned_count || 0) > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                )}
              </div>
              <p className={`text-2xl font-black mt-1 ${
                (kpis.unassigned_count || 0) > 0 ? "text-amber-700" : "text-slate-900"
              }`}>
                {kpis.unassigned_count ?? 0}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Fila de Triagem</p>
            </div>

            {/* Críticos */}
            <div className={`p-4 rounded-2xl border shadow-2xs ${
              (kpis.critical_count || 0) > 0 ? "bg-red-50/70 border-red-200" : "bg-white border-slate-200"
            }`}>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Críticos</p>
                {(kpis.critical_count || 0) > 0 && (
                  <Flame size={14} className="text-red-500 animate-bounce" />
                )}
              </div>
              <p className={`text-2xl font-black mt-1 ${
                (kpis.critical_count || 0) > 0 ? "text-red-600" : "text-slate-900"
              }`}>
                {kpis.critical_count ?? 0}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Alta gravidade</p>
            </div>

            {/* Conformidade SLA */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Conformidade SLA</p>
              <p className={`text-2xl font-black mt-1 ${
                (kpis.compliance_rate || 0) >= 90 ? "text-emerald-600" : (kpis.compliance_rate || 0) >= 75 ? "text-amber-600" : "text-red-600"
              }`}>
                {kpis.compliance_rate ?? 100}%
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Meta ITIL &gt; 90%</p>
            </div>

            {/* SLA em Risco */}
            <div className={`p-4 rounded-2xl border shadow-2xs ${
              (kpis.sla_warning_count || 0) > 0 ? "bg-orange-50/70 border-orange-200" : "bg-white border-slate-200"
            }`}>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">SLA em Risco</p>
              <p className="text-2xl font-black text-orange-600 mt-1">{kpis.sla_warning_count ?? 0}</p>
              <p className="text-[11px] text-slate-500 mt-1">&lt; 30 min para estourar</p>
            </div>

            {/* SLA Estourado */}
            <div className={`p-4 rounded-2xl border shadow-2xs ${
              (kpis.sla_breached_count || 0) > 0 ? "bg-red-50/80 border-red-300" : "bg-white border-slate-200"
            }`}>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">SLA Estourado</p>
              <p className={`text-2xl font-black mt-1 ${
                (kpis.sla_breached_count || 0) > 0 ? "text-red-600" : "text-slate-900"
              }`}>
                {kpis.sla_breached_count ?? 0}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Prazos vencidos</p>
            </div>
          </div>

          {/* Grid Principal: Fila Prioritária + Carga de Técnicos & Setores */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Coluna 1 & 2: Fila Prioritária de Chamados (66%) */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Flame size={18} className="text-orange-500" />
                  <h2 className="font-extrabold text-sm text-slate-800">
                    Fila Prioritária e Cronômetro de SLA
                  </h2>
                </div>
                <button
                  onClick={() => navigate("/admin/tickets")}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  <span>Ver todos os chamados</span>
                  <ChevronRight size={14} />
                </button>
              </div>

              {urgentQueue.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2 opacity-80" />
                  <p className="text-sm font-bold text-slate-700">Fila limpa!</p>
                  <p className="text-xs text-slate-400 mt-0.5">Nenhum chamado aberto com SLA em risco no momento.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                  {urgentQueue.map((ticket) => {
                    const sla = ticket.sla || {};
                    const isBreached = (sla.status || ticket.sla_status) === "BREACHED";
                    const isWarning = (sla.status || ticket.sla_status) === "WARNING";
                    const remainingMins = ticket.sla_remaining_minutes !== undefined 
                      ? ticket.sla_remaining_minutes 
                      : (sla.remaining_minutes || 0);

                    return (
                      <div 
                        key={ticket.id}
                        onClick={() => navigate(`/admin/tickets?ticketId=${ticket.id}`)}
                        className="p-3.5 hover:bg-slate-50/80 rounded-2xl transition-all cursor-pointer flex items-center justify-between gap-4 group"
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-slate-900">#{ticket.id}</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                              ticket.priority === "Crítica" ? "bg-red-100 text-red-700" :
                              ticket.priority === "Alta" ? "bg-orange-100 text-orange-700" :
                              ticket.priority === "Média" ? "bg-blue-100 text-blue-700" :
                              "bg-slate-100 text-slate-600"
                            }`}>
                              {ticket.priority}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400">
                              {ticket.category_name}
                            </span>
                          </div>

                          <h3 className="text-sm font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                            {ticket.title}
                          </h3>

                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span>Solicitante: <strong>{ticket.requester_name}</strong></span>
                            <span>•</span>
                            <span>Setor: <strong>{ticket.department_name}</strong></span>
                            <span>•</span>
                            <span>Técnico: <strong>{ticket.technician_name || "Nenhum (Triagem)"}</strong></span>
                          </div>
                        </div>

                        {/* Status de SLA Chip */}
                        <div className="text-right shrink-0">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black shadow-2xs ${
                            isBreached 
                              ? "bg-red-600 text-white animate-pulse" 
                              : isWarning 
                              ? "bg-amber-100 text-amber-900 border border-amber-300" 
                              : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          }`}>
                            <Clock size={12} />
                            <span>{formatMinutesRemaining(remainingMins)}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Coluna 3: Carga dos Técnicos & Setores (33%) */}
            <div className="space-y-6">
              
              {/* Carga por Técnico */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Users size={18} className="text-blue-600" />
                    <h3 className="font-extrabold text-sm text-slate-800">Carga dos Técnicos</h3>
                  </div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase">Em Atendimento</span>
                </div>

                <div className="space-y-3">
                  {techLoad.map((tech) => (
                    <div key={tech.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-black flex items-center justify-center text-[11px] border border-slate-200">
                          {tech.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{tech.name}</p>
                          <p className="text-[10px] text-slate-400 capitalize">{tech.role}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                          tech.active_tickets_count > 4 
                            ? "bg-red-100 text-red-800" 
                            : tech.active_tickets_count > 0 
                            ? "bg-blue-100 text-blue-800" 
                            : "bg-slate-100 text-slate-500"
                        }`}>
                          {tech.active_tickets_count} chamado{tech.active_tickets_count !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Setores com mais Chamados */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Building size={18} className="text-purple-600" />
                    <h3 className="font-extrabold text-sm text-slate-800">Gargalos por Setor</h3>
                  </div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase">Ativos</span>
                </div>

                <div className="space-y-2.5">
                  {topSectors.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-2">Sem chamados ativos.</p>
                  ) : (
                    topSectors.map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 truncate max-w-[180px]">{s.department}</span>
                        <span className="font-black bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-lg border border-purple-100">
                          {s.count}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 2: NOC & INFRAESTRUTURA (ZABBIX & REDES)              */}
      {/* ======================================================== */}
      {activeTab === "noc" && (
        <div className="space-y-6 animate-fade-in">
          <ZabbixPanel />
        </div>
      )}

    </div>
  );
}
