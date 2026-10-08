import { useState, useEffect, useMemo } from "react";
import api from "../../api/client";
import {
  BarChart3,
  Calendar,
  Download,
  Printer,
  RefreshCw,
  Ticket,
  Monitor,
  Cpu,
  WifiOff,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  HardDrive,
  Users,
  Search,
  ChevronDown,
  Layers,
  ArrowUpDown,
  Filter,
  Flame,
  Activity,
  ShieldCheck,
  Star,
  Building,
} from "lucide-react";

export default function Reports() {
  const [activeTab, setActiveTab] = useState("tickets"); // tickets | assets | hardware | outages
  const [loading, setLoading] = useState(false);

  // ── Preferência de Período com Memória no LocalStorage ─────────────────────
  const getDefaultDateRange = () => {
    const saved = localStorage.getItem("tihfsa_reports_date_range");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.startDate && parsed.endDate) return parsed;
      } catch (e) {
        console.error("Erro ao ler período salvo:", e);
      }
    }
    // Fallback: 1º dia do mês corrente até a data de hoje
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return {
      preset: "current_month",
      startDate: `${year}-${month}-01`,
      endDate: `${year}-${month}-${day}`,
    };
  };

  const [dateRange, setDateRange] = useState(getDefaultDateRange);
  const [minOutageSeconds, setMinOutageSeconds] = useState(120); // 2 minutos tolerância padrão
  const [searchFilter, setSearchFilter] = useState("");

  // Dados carregados de cada relatório
  const [ticketsData, setTicketsData] = useState(null);
  const [assetsData, setAssetsData] = useState(null);
  const [hardwareData, setHardwareData] = useState(null);
  const [outagesData, setOutagesData] = useState(null);

  // Atualizar período e persistir no localStorage
  const handlePresetChange = (preset) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    let sDate = `${year}-${month}-01`;
    let eDate = `${year}-${month}-${day}`;

    if (preset === "current_month") {
      sDate = `${year}-${month}-01`;
      eDate = `${year}-${month}-${day}`;
    } else if (preset === "last_7_days") {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      sDate = past.toISOString().split("T")[0];
      eDate = `${year}-${month}-${day}`;
    } else if (preset === "last_30_days") {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      sDate = past.toISOString().split("T")[0];
      eDate = `${year}-${month}-${day}`;
    } else if (preset === "last_month") {
      const firstDayLastMonth = new Date(year, now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(year, now.getMonth(), 0);
      sDate = firstDayLastMonth.toISOString().split("T")[0];
      eDate = lastDayLastMonth.toISOString().split("T")[0];
    } else if (preset === "current_year") {
      sDate = `${year}-01-01`;
      eDate = `${year}-${month}-${day}`;
    }

    const updated = { preset, startDate: sDate, endDate: eDate };
    setDateRange(updated);
    localStorage.setItem("tihfsa_reports_date_range", JSON.stringify(updated));
  };

  const handleCustomDateChange = (field, value) => {
    const updated = {
      ...dateRange,
      preset: "custom",
      [field]: value,
    };
    setDateRange(updated);
    localStorage.setItem("tihfsa_reports_date_range", JSON.stringify(updated));
  };

  // Carregar dados conforme a aba ativa
  const fetchReportData = async () => {
    setLoading(true);
    try {
      if (activeTab === "tickets") {
        const res = await api.get("/reports/tickets", {
          params: { start_date: dateRange.startDate, end_date: dateRange.endDate },
        });
        setTicketsData(res.data);
      } else if (activeTab === "assets") {
        const res = await api.get("/reports/assets");
        setAssetsData(res.data);
      } else if (activeTab === "hardware") {
        const res = await api.get("/reports/hardware-performance");
        setHardwareData(res.data);
      } else if (activeTab === "outages") {
        const res = await api.get("/reports/outages", {
          params: {
            start_date: dateRange.startDate,
            end_date: dateRange.endDate,
            min_duration_seconds: minOutageSeconds,
          },
        });
        setOutagesData(res.data);
      }
    } catch (err) {
      console.error("Erro ao buscar relatório:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [activeTab, dateRange.startDate, dateRange.endDate, minOutageSeconds]);

  // Exportação para Excel / CSV
  const handleExportCSV = () => {
    let rows = [];
    let filename = `relatorio_${activeTab}_${dateRange.startDate}_a_${dateRange.endDate}.csv`;

    if (activeTab === "tickets" && ticketsData?.analytic_data) {
      rows = [
        ["ID", "Título", "Status", "Prioridade", "Departamento", "Localização", "Solicitante", "Técnico", "Problema", "Data Abertura", "Data Solução", "Duração (min)", "SLA Estourado"],
        ...ticketsData.analytic_data.map(t => [
          t.id, `"${t.title.replace(/"/g, '""')}"`, t.status, t.priority,
          `"${t.department || ''}"`, `"${t.location || ''}"`, `"${t.requester || ''}"`,
          `"${t.technician || ''}"`, `"${t.problem_type || ''}"`,
          t.created_at || "", t.solved_at || "", t.duration_minutes || "",
          t.sla_breached ? "SIM" : "NÃO"
        ])
      ];
    } else if (activeTab === "assets" && assetsData?.analytic_data) {
      filename = `relatorio_ativos_${new Date().toISOString().split("T")[0]}.csv`;
      rows = [
        ["ID", "Nome do Ativo", "Patrimônio/Tag", "Número de Série", "Categoria", "Fabricante", "Modelo", "Departamento", "Localização", "Status", "IP", "Garantia", "Valor (R$)", "Total Chamados"],
        ...assetsData.analytic_data.map(a => [
          a.id, `"${a.name.replace(/"/g, '""')}"`, a.tag || "", a.serial_number || "",
          `"${a.category || ''}"`, `"${a.brand || ''}"`, `"${a.model || ''}"`,
          `"${a.department || ''}"`, `"${a.location || ''}"`, a.status, a.ip_address || "",
          a.warranty_status || "", a.purchase_price || "", a.ticket_count || 0
        ])
      ];
    } else if (activeTab === "hardware" && hardwareData?.analytic_data) {
      filename = `relatorio_desempenho_maquinas_${new Date().toISOString().split("T")[0]}.csv`;
      rows = [
        ["ID", "Hostname", "Usuário Logado", "IP", "Sistema Operacional", "Status", "CPU (%)", "RAM Total (GB)", "RAM Usada (GB)", "RAM (%)", "Disco C: Livre (GB)", "Uptime (dias)", "Alertas"],
        ...hardwareData.analytic_data.map(h => [
          h.id, h.hostname, `"${h.logged_user || ''}"`, h.ip_address, `"${h.os_name || ''}"`,
          h.status, h.cpu_usage_pct, h.ram_total_gb, h.ram_used_gb, h.ram_usage_pct,
          h.disk_c_free_gb || "", h.uptime_days || 0, `"${(h.alerts || []).join('; ')}"`
        ])
      ];
    } else if (activeTab === "outages" && outagesData?.timeline_events) {
      rows = [
        ["ID", "Origem", "Dispositivo", "Tipo", "IP", "MAC", "Início da Queda", "Retorno Online", "Duração", "Duração (Segundos)", "Status", "Motivo/Alarme"],
        ...outagesData.timeline_events.map(o => [
          o.id, o.source, `"${o.device_name.replace(/"/g, '""')}"`, `"${o.device_type || ''}"`,
          o.ip_address || "", o.mac_address || "", o.started_at || "", o.ended_at || "",
          o.duration_formatted, o.duration_seconds, o.status, `"${(o.trigger_reason || '').replace(/"/g, '""')}"`
        ])
      ];
    }

    if (rows.length === 0) {
      alert("Não há dados carregados para exportar no momento.");
      return;
    }

    const csvContent = "\uFEFF" + rows.map(e => e.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 w-full animate-fade-in text-slate-800">
      
      {/* ── CABEÇALHO OFICIAL (Visível em Tela e no PDF/Print) ──────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs print:shadow-none print:border-none print:p-0">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center font-extrabold shadow-md shadow-blue-600/20 print:w-8 print:h-8">
              <BarChart3 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Relatórios Executivos & Analíticos</h1>
                <span className="hidden print:inline-block px-2 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
                  Hotel Fasano Salvador
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Métricas de Service Desk, Gestão de Ativos, Telemetria de Agentes e Estabilidade de Rede (Zabbix & UniFi).
              </p>
            </div>
          </div>
        </div>

        {/* Botões de Ação (Ocultos na Impressão) */}
        <div className="flex items-center gap-2.5 print:hidden">
          <button
            onClick={fetchReportData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
            title="Atualizar dados"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-blue-600" : ""} />
            Atualizar
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Download size={15} />
            Exportar Excel (CSV)
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Printer size={15} />
            Imprimir / Gerar PDF
          </button>
        </div>
      </div>

      {/* ── BARRA DE CONTROLE: SELETOR DE PERÍODO & MEMÓRIA (Oculto no Print) ── */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Navegação entre as 4 Abas */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/60 overflow-x-auto max-w-full">
            {[
              { id: "tickets", label: "Chamados & SLA", icon: Ticket },
              { id: "assets", label: "Ativos & CMDB", icon: Monitor },
              { id: "hardware", label: "Desempenho de Máquinas", icon: Cpu },
              { id: "outages", label: "Quedas & Flapping (Rede)", icon: WifiOff },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-white text-blue-700 shadow-sm shadow-slate-200"
                    : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Atalhos Rápidos de Período */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 mr-1">
              <Calendar size={14} /> Período:
            </span>
            {[
              { id: "current_month", label: "Mês Atual" },
              { id: "last_7_days", label: "Últimos 7 dias" },
              { id: "last_30_days", label: "Últimos 30 dias" },
              { id: "last_month", label: "Mês Anterior" },
              { id: "current_year", label: "Ano Atual" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handlePresetChange(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  dateRange.preset === p.id
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Inputs De / Até e Filtros Específicos */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-semibold">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">De:</span>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => handleCustomDateChange("startDate", e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Até:</span>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => handleCustomDateChange("endDate", e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Filtro de Tolerância de Quedas (Apenas na aba Quedas) */}
          {activeTab === "outages" && (
            <div className="flex items-center gap-2 bg-amber-50/80 px-3 py-1.5 rounded-xl border border-amber-200/60">
              <span className="text-amber-800 font-extrabold">Tolerância Mínima:</span>
              <select
                value={minOutageSeconds}
                onChange={(e) => setMinOutageSeconds(Number(e.target.value))}
                className="bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs font-bold text-amber-900 outline-none cursor-pointer"
              >
                <option value={0}>Todas as oscilações (0s)</option>
                <option value={60}>Quedas acima de 1 min (60s)</option>
                <option value={120}>Quedas acima de 2 min (120s — Padrão)</option>
                <option value={300}>Quedas acima de 5 min (300s)</option>
                <option value={900}>Quedas graves acima de 15 min (900s)</option>
              </select>
            </div>
          )}

          {/* Campo de Busca Rápida na Tabela */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrar dados da tabela..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* ── IDENTIFICAÇÃO DE IMPRESSÃO (Apenas Visível no Print) ─────────────── */}
      <div className="hidden print:block mb-6 pb-4 border-b border-slate-300">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-xl font-black text-slate-900">
              {activeTab === "tickets" && "Relatório Gerencial de Chamados e Nível de Serviço (SLA)"}
              {activeTab === "assets" && "Relatório Consolidado do Inventário Patrimonial (CMDB)"}
              {activeTab === "hardware" && "Relatório de Desempenho e Telemetria de Estações de Trabalho"}
              {activeTab === "outages" && "Relatório de Quedas, Flapping e Estabilidade de Rede (Zabbix & UniFi)"}
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Período de Análise: <strong>{dateRange.startDate}</strong> até <strong>{dateRange.endDate}</strong>
            </p>
          </div>
          <div className="text-right text-[11px] text-slate-500">
            <p>Gerado em: {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR")}</p>
            <p>TI Hotel Fasano Salvador</p>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 1. ABA: CHAMADOS & SLA                                                 */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeTab === "tickets" && ticketsData && (
        <div className="space-y-6">
          
          {/* Top Cards de Indicadores de Chamados */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Total Chamados</span>
              <p className="text-2xl font-black text-slate-900 mt-1">{ticketsData.summary.total_tickets}</p>
              <span className="text-[11px] font-bold text-slate-500">no período</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-extrabold text-emerald-600 uppercase tracking-wider block">Resolvidos / Concluídos</span>
              <p className="text-2xl font-black text-emerald-600 mt-1">{ticketsData.summary.completed_total}</p>
              <span className="text-[11px] font-extrabold text-emerald-700">{ticketsData.summary.resolution_rate_pct}% de resolução</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-extrabold text-blue-600 uppercase tracking-wider block">Em Atendimento</span>
              <p className="text-2xl font-black text-blue-700 mt-1">
                {ticketsData.summary.in_progress_count + ticketsData.summary.new_count}
              </p>
              <span className="text-[11px] font-bold text-slate-500">{ticketsData.summary.new_count} novos</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-extrabold text-indigo-600 uppercase tracking-wider block">Tempo Médio (TMA)</span>
              <p className="text-2xl font-black text-indigo-700 mt-1">{ticketsData.summary.avg_tma_minutes}m</p>
              <span className="text-[11px] font-bold text-slate-500">tempo de resolução</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-extrabold text-purple-600 uppercase tracking-wider block">Conformidade SLA</span>
              <p className="text-2xl font-black text-purple-700 mt-1">{ticketsData.summary.sla_compliance_pct}%</p>
              <span className="text-[11px] font-bold text-slate-500">{ticketsData.summary.sla_breached_count} estourados</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-extrabold text-amber-500 uppercase tracking-wider block">Satisfação (CSAT)</span>
              <p className="text-2xl font-black text-amber-600 mt-1 flex items-center gap-1">
                ★ {ticketsData.summary.csat_average}
              </p>
              <span className="text-[11px] font-bold text-slate-500">{ticketsData.summary.csat_total_surveys} avaliações</span>
            </div>
          </div>

          {/* Gráficos / Rankings de Departamentos e Problemas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Top Departamentos */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
              <h3 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-2">
                <Building size={16} className="text-blue-600" />
                Chamados por Setor / Departamento
              </h3>
              <div className="space-y-2.5">
                {ticketsData.ranking_departments.slice(0, 6).map((dept, idx) => {
                  const pct = ticketsData.summary.total_tickets > 0
                    ? Math.round((dept.count / ticketsData.summary.total_tickets) * 100)
                    : 0;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-700">{dept.name}</span>
                        <span className="text-slate-500">{dept.count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Problemas Reincidentes */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
              <h3 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                Tipos de Problemas Mais Reincidentes
              </h3>
              <div className="space-y-2.5">
                {ticketsData.ranking_problem_types.slice(0, 6).map((prob, idx) => {
                  const pct = ticketsData.summary.total_tickets > 0
                    ? Math.round((prob.count / ticketsData.summary.total_tickets) * 100)
                    : 0;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-700">{prob.name}</span>
                        <span className="text-slate-500">{prob.count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Produtividade por Técnico */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
            <h3 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-2">
              <Users size={16} className="text-indigo-600" />
              Produtividade da Equipe Técnica
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-black text-slate-400 uppercase">
                    <th className="py-2.5 px-3">Técnico</th>
                    <th className="py-2.5 px-3 text-center">Atribuídos</th>
                    <th className="py-2.5 px-3 text-center">Resolvidos</th>
                    <th className="py-2.5 px-3 text-center">Taxa de Conclusão</th>
                    <th className="py-2.5 px-3 text-right">TMA Médio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {ticketsData.ranking_technicians.map((t, idx) => {
                    const rate = t.total_assigned > 0 ? Math.round((t.solved / t.total_assigned) * 100) : 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-extrabold text-slate-900">{t.name}</td>
                        <td className="py-2.5 px-3 text-center">{t.total_assigned}</td>
                        <td className="py-2.5 px-3 text-center text-emerald-700 font-bold">{t.solved}</td>
                        <td className="py-2.5 px-3 text-center">{rate}%</td>
                        <td className="py-2.5 px-3 text-right font-mono">{t.avg_tma_minutes} min</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabela Analítica de Chamados */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Lista Analítica de Chamados ({ticketsData.analytic_data.length} registros)
              </h3>
            </div>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50 shadow-xs">
                  <tr className="border-b border-slate-200 text-[11px] font-black text-slate-400 uppercase">
                    <th className="py-3 px-3">#ID</th>
                    <th className="py-3 px-3">Título</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Setor</th>
                    <th className="py-3 px-3">Técnico</th>
                    <th className="py-3 px-3">Abertura</th>
                    <th className="py-3 px-3">TMA</th>
                    <th className="py-3 px-3 text-center">SLA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {ticketsData.analytic_data
                    .filter(t => !searchFilter || t.title.toLowerCase().includes(searchFilter.toLowerCase()) || t.department.toLowerCase().includes(searchFilter.toLowerCase()))
                    .map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-500">#{t.id}</td>
                        <td className="py-2.5 px-3 font-extrabold text-slate-900 max-w-xs truncate" title={t.title}>
                          {t.title}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-800">
                            {t.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">{t.department}</td>
                        <td className="py-2.5 px-3">{t.technician}</td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {t.created_at ? new Date(t.created_at).toLocaleDateString("pt-BR") : "—"}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {t.duration_minutes !== null ? `${t.duration_minutes}m` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {t.sla_breached ? (
                            <span className="text-red-600 font-bold">Estourado</span>
                          ) : (
                            <span className="text-emerald-600 font-bold">No Prazo</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 2. ABA: ATIVOS & CMDB                                                  */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeTab === "assets" && assetsData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Total Ativos</span>
              <p className="text-2xl font-black text-slate-900 mt-1">{assetsData.summary.total_assets}</p>
              <span className="text-[11px] font-bold text-slate-500">{assetsData.summary.in_use_count} em operação</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-extrabold text-blue-600 uppercase tracking-wider block">Investimento Total</span>
              <p className="text-2xl font-black text-blue-700 mt-1">
                R$ {assetsData.summary.total_purchase_value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] font-bold text-slate-500">valor patrimonial</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-extrabold text-amber-600 uppercase tracking-wider block">Em Manutenção</span>
              <p className="text-2xl font-black text-amber-600 mt-1">{assetsData.summary.maintenance_count}</p>
              <span className="text-[11px] font-bold text-slate-500">{assetsData.summary.available_count} disponíveis</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-extrabold text-red-600 uppercase tracking-wider block">Garantias Expiradas</span>
              <p className="text-2xl font-black text-red-600 mt-1">{assetsData.summary.warranty_expired}</p>
              <span className="text-[11px] font-bold text-slate-500">fora da garantia</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-extrabold text-indigo-600 uppercase tracking-wider block">Vencendo em 90d</span>
              <p className="text-2xl font-black text-indigo-700 mt-1">{assetsData.summary.warranty_expiring_90}</p>
              <span className="text-[11px] font-bold text-slate-500">atenção para renovação</span>
            </div>
          </div>

          {/* Ativos Mais Problemáticos (Top Chamados) */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
            <h3 className="text-sm font-black text-slate-900 mb-3 flex items-center gap-2">
              <Flame size={16} className="text-rose-500" />
              Equipamentos que Mais Geraram Chamados (Ativos Problemáticos)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-black text-slate-400 uppercase">
                    <th className="py-2.5 px-3">Equipamento</th>
                    <th className="py-2.5 px-3">Categoria</th>
                    <th className="py-2.5 px-3">Setor / Localização</th>
                    <th className="py-2.5 px-3 text-center">Garantia</th>
                    <th className="py-2.5 px-3 text-right">Chamados Abertos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {assetsData.problematic_assets.map((a, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-extrabold text-slate-900">
                        {a.name} {a.tag && <span className="text-slate-400 font-mono text-[11px]">({a.tag})</span>}
                      </td>
                      <td className="py-2.5 px-3">{a.category}</td>
                      <td className="py-2.5 px-3">{a.department} • {a.location}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          a.warranty_status === "Expirada" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                        }`}>
                          {a.warranty_status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-rose-600 font-mono">
                        {a.ticket_count} chamados
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabela Geral de Inventário */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Inventário Analítico ({assetsData.analytic_data.length} itens)
              </h3>
            </div>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50 shadow-xs">
                  <tr className="border-b border-slate-200 text-[11px] font-black text-slate-400 uppercase">
                    <th className="py-3 px-3">Equipamento</th>
                    <th className="py-3 px-3">Tag / S/N</th>
                    <th className="py-3 px-3">Categoria</th>
                    <th className="py-3 px-3">Setor</th>
                    <th className="py-3 px-3">IP / MAC</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Valor Compra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {assetsData.analytic_data
                    .filter(a => !searchFilter || a.name.toLowerCase().includes(searchFilter.toLowerCase()) || (a.tag && a.tag.toLowerCase().includes(searchFilter.toLowerCase())))
                    .map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-extrabold text-slate-900">{a.name}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">{a.tag || a.serial_number || "—"}</td>
                        <td className="py-2.5 px-3">{a.category}</td>
                        <td className="py-2.5 px-3">{a.department}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">{a.ip_address || "—"}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            {a.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {a.purchase_price ? `R$ ${a.purchase_price.toFixed(2)}` : "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 3. ABA: DESEMPENHO DE MÁQUINAS (TELEMETRIA DO AGENTE)                  */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeTab === "hardware" && hardwareData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Estações Monitoradas</span>
              <p className="text-2xl font-black text-slate-900 mt-1">{hardwareData.summary.total_machines}</p>
              <span className="text-[11px] font-bold text-emerald-600">{hardwareData.summary.online_count} online agora</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-extrabold text-red-600 uppercase tracking-wider block">Gargalo de CPU</span>
              <p className="text-2xl font-black text-red-600 mt-1">{hardwareData.summary.cpu_critical_count}</p>
              <span className="text-[11px] font-bold text-slate-500">acima de 80% uso</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-extrabold text-amber-600 uppercase tracking-wider block">RAM Saturada</span>
              <p className="text-2xl font-black text-amber-600 mt-1">{hardwareData.summary.ram_critical_count}</p>
              <span className="text-[11px] font-bold text-slate-500">acima de 85% uso</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-extrabold text-purple-600 uppercase tracking-wider block">Disco C: Crítico</span>
              <p className="text-2xl font-black text-purple-600 mt-1">{hardwareData.summary.disk_critical_count}</p>
              <span className="text-[11px] font-bold text-slate-500">&lt; 15GB livres</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-extrabold text-blue-600 uppercase tracking-wider block">Upgrade Necessário</span>
              <p className="text-2xl font-black text-blue-700 mt-1">{hardwareData.summary.upgrade_needed_count}</p>
              <span className="text-[11px] font-bold text-slate-500">máquinas sinalizadas</span>
            </div>
          </div>

          {/* Recomendações de Upgrade Automáticas */}
          {hardwareData.upgrade_recommendations.length > 0 && (
            <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 p-5 rounded-3xl border border-blue-200/80 shadow-xs">
              <h3 className="text-sm font-black text-blue-900 mb-3 flex items-center gap-2">
                <AlertOctagon size={16} className="text-blue-600" />
                Diagnóstico de Upgrades Recomendados para a Gestão de TI
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {hardwareData.upgrade_recommendations.map((rec, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-2xl border border-blue-100 shadow-xs space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-extrabold text-slate-900 text-xs block">{rec.hostname}</span>
                        <span className="text-[11px] text-slate-500">{rec.logged_user} • {rec.ip_address}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
                        {rec.ram_total_gb}GB RAM
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {rec.recommendations.map((item, i) => (
                        <li key={i} className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabela Analítica de Telemetria */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Métricas em Tempo Real de Todas as Máquinas
              </h3>
            </div>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50 shadow-xs">
                  <tr className="border-b border-slate-200 text-[11px] font-black text-slate-400 uppercase">
                    <th className="py-3 px-3">Hostname</th>
                    <th className="py-3 px-3">Usuário Logado</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-center">CPU (%)</th>
                    <th className="py-3 px-3 text-center">RAM Usada</th>
                    <th className="py-3 px-3 text-center">Disco C:</th>
                    <th className="py-3 px-3 text-right">Uptime</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {hardwareData.analytic_data
                    .filter(h => !searchFilter || h.hostname.toLowerCase().includes(searchFilter.toLowerCase()) || (h.logged_user && h.logged_user.toLowerCase().includes(searchFilter.toLowerCase())))
                    .map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-extrabold text-slate-900">{h.hostname}</td>
                        <td className="py-2.5 px-3 text-slate-600">{h.logged_user || "—"}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            h.status === "online" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                          }`}>
                            {h.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold">
                          <span className={h.cpu_usage_pct >= 80 ? "text-red-600" : ""}>
                            {h.cpu_usage_pct}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {h.ram_used_gb} / {h.ram_total_gb} GB ({h.ram_usage_pct}%)
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {h.disk_c_free_gb ? `${h.disk_c_free_gb.toFixed(1)} GB livre` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                          {h.uptime_days} dias
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* 4. ABA: QUEDAS & FLAPPING (ZABBIX & UNIFI)                             */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeTab === "outages" && outagesData && (
        <div className="space-y-6">
          
          {/* Top Cards de Indicadores de Queda */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">Total de Quedas</span>
              <p className="text-2xl font-black text-rose-600 mt-1">{outagesData.summary.total_outage_events}</p>
              <span className="text-[11px] font-bold text-slate-500">eventos no período</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-extrabold text-amber-600 uppercase tracking-wider block">Dispositivos Afetados</span>
              <p className="text-2xl font-black text-amber-600 mt-1">{outagesData.summary.unique_affected_devices}</p>
              <span className="text-[11px] font-bold text-slate-500">itens sofreram queda</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-extrabold text-purple-600 uppercase tracking-wider block">Tempo Total Offline</span>
              <p className="text-2xl font-black text-purple-700 mt-1">{outagesData.summary.total_downtime_formatted}</p>
              <span className="text-[11px] font-bold text-slate-500">downtime acumulado</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-extrabold text-blue-600 uppercase tracking-wider block">Duração Média da Queda</span>
              <p className="text-2xl font-black text-blue-700 mt-1">{outagesData.summary.avg_outage_formatted}</p>
              <span className="text-[11px] font-bold text-slate-500">MTTR de rede</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-extrabold text-emerald-600 uppercase tracking-wider block">Disponibilidade / Uptime</span>
              <p className="text-2xl font-black text-emerald-700 mt-1">{outagesData.summary.estimated_uptime_sla_pct}%</p>
              <span className="text-[11px] font-bold text-slate-500">SLA de rede estimado</span>
            </div>
          </div>

          {/* 🚨 RANKING TOP FLAPPING DEVICES (QUEM MAIS CAI E QUANTO TEMPO FICA FORA) */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Flame size={18} className="text-rose-600" />
                  Top Flapping Devices — Dispositivos com Quedas Constantes
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Equipamentos que apresentaram maior frequência de interrupção no período selecionado.
                </p>
              </div>
            </div>

            {outagesData.top_flapping_devices.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-semibold space-y-2">
                <CheckCircle2 size={36} className="text-emerald-500 mx-auto" />
                <p className="text-xs">Nenhum equipamento com registro de instabilidade no período.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-black text-slate-400 uppercase">
                      <th className="py-2.5 px-3">Dispositivo</th>
                      <th className="py-2.5 px-3">Origem</th>
                      <th className="py-2.5 px-3">IP / MAC</th>
                      <th className="py-2.5 px-3 text-center">Quedas no Período</th>
                      <th className="py-2.5 px-3 text-center">Tempo Total Offline</th>
                      <th className="py-2.5 px-3 text-right">Duração Média</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {outagesData.top_flapping_devices.map((dev, idx) => (
                      <tr key={idx} className="hover:bg-rose-50/40 transition-colors">
                        <td className="py-3 px-3">
                          <p className="font-extrabold text-slate-900">{dev.device_name}</p>
                          <span className="text-[11px] text-slate-400">{dev.device_type || "Equipamento"}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-700 uppercase">
                            {dev.source}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                          {dev.ip_address || dev.mac_address || "—"}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200">
                            {dev.outage_count}x
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                          {dev.total_downtime_formatted}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-600">
                          {dev.avg_downtime_formatted}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Linha do Tempo Cronológica de Eventos de Queda */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Histórico Cronológico de Quedas ({outagesData.timeline_events.length} eventos)
              </h3>
            </div>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50 shadow-xs">
                  <tr className="border-b border-slate-200 text-[11px] font-black text-slate-400 uppercase">
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Origem</th>
                    <th className="py-3 px-3">Dispositivo</th>
                    <th className="py-3 px-3">Início da Queda</th>
                    <th className="py-3 px-3">Restabelecimento</th>
                    <th className="py-3 px-3 text-center">Tempo Offline</th>
                    <th className="py-3 px-3">Motivo / Trigger</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {outagesData.timeline_events
                    .filter(o => !searchFilter || o.device_name.toLowerCase().includes(searchFilter.toLowerCase()) || (o.ip_address && o.ip_address.includes(searchFilter)))
                    .map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3">
                          {ev.status === "ongoing" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                              Offline Agora
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                              Normalizado
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-700 uppercase">
                            {ev.source}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-extrabold text-slate-900">
                          {ev.device_name}
                          {ev.ip_address && <span className="block text-[11px] text-slate-400 font-mono">{ev.ip_address}</span>}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {ev.started_at ? new Date(ev.started_at).toLocaleString("pt-BR") : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {ev.ended_at ? new Date(ev.ended_at).toLocaleString("pt-BR") : "Ainda Offline"}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">
                          {ev.duration_formatted}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate" title={ev.trigger_reason}>
                          {ev.trigger_reason || "Perda de comunicação"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
